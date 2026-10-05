import { generateText, type LanguageModel } from "ai";
import {
  estimateOutputTokens,
  isRateLimitError,
  splitBatchForRetry,
} from "../models/provider-speed.ts";
import { getPattern, getValidPatternIds } from "../taxonomy/pattern-registry.ts";
import type {
  ClassifiedSentence,
  HashedSentence,
  PatternType,
  SentenceClassification,
} from "../types.ts";
import type { ClassifierOptions } from "./classifier.ts";
import { computeHeat, getDefaultClassification } from "./classifier.ts";

/** Gate positives in [0.4, 0.7) use medium classifier instead of full. */
export const MEDIUM_ESCALATION_THRESHOLD = 0.4;
export const FULL_ESCALATION_THRESHOLD = 0.7;

/** ~15 high-heat patterns for medium tier (patterns + metrics + arc_role, no Biber). */
export const MEDIUM_PATTERN_IDS = [
  "binary_contrast",
  "nominalization",
  "hedging",
  "sentence_opener_repetition",
  "importance_inflation",
  "transition_formulaic",
  "llm_fingerprint_word",
  "participial_cascade",
  "agentless_passive",
  "resumptive_phrase",
  "tricolon_abstract",
] as const;

const VALID_MEDIUM = new Set<string>([...new Set(MEDIUM_PATTERN_IDS)]);
const VALID_ALL = getValidPatternIds();

function buildMediumSystemPrompt(): string {
  const unique = [...new Set(MEDIUM_PATTERN_IDS)];
  const hints = unique
    .map((id) => {
      const entry = getPattern(id);
      return `   - ${id}: ${entry?.detection_hint ?? id}`;
    })
    .join("\n");

  return `You are a structural prose classifier (medium tier). For each numbered sentence produce:
- patterns: array of detected patterns with evidence (only from list below)
- metrics: word_count, clause_count, has_participial, has_relative_clause, clause_balance_ratio, construction_type
- arc_role: claim|evidence|pivot|resolution|transition|elaboration

Patterns to detect:
${hints}

Respond with ONLY valid JSON:
{"results": [{"patterns": [...], "metrics": {...}, "arc_role": "..."}]}
One object per sentence, in order.`;
}

export const MEDIUM_SYSTEM_PROMPT = buildMediumSystemPrompt();

export function gateNeedsMediumClassification(classification: SentenceClassification): boolean {
  const maxConf = Math.max(0, ...classification.patterns.map((p) => p.confidence));
  return maxConf >= MEDIUM_ESCALATION_THRESHOLD && maxConf < FULL_ESCALATION_THRESHOLD;
}

export function gateNeedsFullClassification(classification: SentenceClassification): boolean {
  return classification.patterns.some((p) => p.confidence >= FULL_ESCALATION_THRESHOLD);
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  return batches;
}

function parseMediumResponse(raw: string, expectedCount: number): SentenceClassification[] {
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const fence =
    cleaned.match(/```(?:json)?\s*([\s\S]*?)```/) ?? cleaned.match(/```(?:json)?\s*([\s\S]*)/);
  if (fence) cleaned = fence[1]!.trim();
  const start = cleaned.search(/[[{]/);
  if (start < 0) return Array.from({ length: expectedCount }, () => getDefaultClassification());
  cleaned = cleaned.slice(start).replace(/,(\s*[}\]])/g, "$1");
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return Array.from({ length: expectedCount }, () => getDefaultClassification());
  }
  const results = Array.isArray(parsed) ? parsed : (parsed as Record<string, unknown>).results;
  if (!Array.isArray(results)) {
    return Array.from({ length: expectedCount }, () => getDefaultClassification());
  }
  const out = results.map((r) =>
    r && typeof r === "object" && !Array.isArray(r)
      ? validateMedium(r as Record<string, unknown>)
      : getDefaultClassification(),
  );
  while (out.length < expectedCount) out.push(getDefaultClassification());
  return out.slice(0, expectedCount);
}

function validateMedium(raw: Record<string, unknown>): SentenceClassification {
  const base = getDefaultClassification();
  const patternsRaw = raw.patterns;
  let patterns = base.patterns;
  if (Array.isArray(patternsRaw)) {
    patterns = patternsRaw
      .filter((p) => p && typeof p === "object")
      .map((p) => p as Record<string, unknown>)
      .filter((p) => typeof p.type === "string" && VALID_MEDIUM.has(p.type))
      .map((p) => ({
        type: p.type as PatternType,
        confidence:
          typeof p.confidence === "number" ? Math.min(1, Math.max(0, p.confidence)) : 0.75,
        evidence: typeof p.evidence === "string" ? p.evidence : "",
      }))
      .filter((p) => VALID_ALL.has(p.type));
  }
  const metrics =
    raw.metrics && typeof raw.metrics === "object" ? (raw.metrics as Record<string, unknown>) : {};
  return {
    ...base,
    patterns,
    metrics: {
      ...base.metrics,
      word_count:
        typeof metrics.word_count === "number" ? metrics.word_count : base.metrics.word_count,
      clause_count:
        typeof metrics.clause_count === "number" ? metrics.clause_count : base.metrics.clause_count,
      has_participial: metrics.has_participial === true,
      has_relative_clause: metrics.has_relative_clause === true,
      clause_balance_ratio:
        typeof metrics.clause_balance_ratio === "number"
          ? metrics.clause_balance_ratio
          : base.metrics.clause_balance_ratio,
      construction_type:
        typeof metrics.construction_type === "string"
          ? metrics.construction_type
          : base.metrics.construction_type,
    },
    arc_role: typeof raw.arc_role === "string" ? raw.arc_role : base.arc_role,
  };
}

export class MediumClassifier {
  private model: LanguageModel;
  private systemPrompt: string;
  private batchSize: number;
  private maxParallel: number;
  private maxOutputTokens: number;

  constructor(model: LanguageModel, systemPrompt?: string, options?: ClassifierOptions) {
    this.model = model;
    this.systemPrompt = systemPrompt ?? MEDIUM_SYSTEM_PROMPT;
    this.batchSize = options?.batchSize ?? 8;
    this.maxParallel = options?.maxParallel ?? 2;
    this.maxOutputTokens =
      options?.maxOutputTokens ?? estimateOutputTokens(this.batchSize, "medium");
  }

  async classify(sentences: HashedSentence[]): Promise<ClassifiedSentence[]> {
    if (sentences.length === 0) return [];
    if (sentences.length <= this.batchSize) return this.classifyBatch(sentences);
    const batches = chunk(sentences, this.batchSize);
    const results: ClassifiedSentence[] = [];
    for (let i = 0; i < batches.length; i += this.maxParallel) {
      const wave = batches.slice(i, i + this.maxParallel);
      const waveResults = await Promise.all(wave.map((b) => this.classifyBatch(b)));
      for (const wr of waveResults) results.push(...wr);
    }
    return results;
  }

  private async classifyBatch(sentences: HashedSentence[]): Promise<ClassifiedSentence[]> {
    try {
      return await this.classifyBatchOnce(sentences);
    } catch (err) {
      if (isRateLimitError(err)) {
        const split = splitBatchForRetry(sentences);
        if (split) {
          const [a, b] = split;
          const ra = await this.classifyBatchOnce(a);
          const rb = await this.classifyBatchOnce(b);
          return [...ra, ...rb];
        }
      }
      return sentences.map((s) => ({
        ...s,
        classification: getDefaultClassification(),
        heat: 0,
      }));
    }
  }

  private async classifyBatchOnce(sentences: HashedSentence[]): Promise<ClassifiedSentence[]> {
    const userPrompt = sentences.map((s, i) => `[${i + 1}] ${s.text}`).join("\n");
    const maxOut = estimateOutputTokens(sentences.length, "medium");
    const { text } = await generateText({
      model: this.model,
      system: this.systemPrompt,
      prompt: userPrompt,
      maxOutputTokens: maxOut,
      providerOptions: { groq: { reasoningFormat: "parsed" } },
    });
    const classifications = parseMediumResponse(text, sentences.length);
    return sentences.map((s, i) => {
      const classification = classifications[i] ?? getDefaultClassification();
      return { ...s, classification, heat: computeHeat(classification) };
    });
  }
}

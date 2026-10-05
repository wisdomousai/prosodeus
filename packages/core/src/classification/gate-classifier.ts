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

export {
  FULL_ESCALATION_THRESHOLD,
  gateNeedsFullClassification,
  gateNeedsMediumClassification,
  MEDIUM_ESCALATION_THRESHOLD,
} from "./medium-classifier.ts";

const DEFAULT_BATCH_SIZE = 12;
const DEFAULT_MAX_PARALLEL = 2;

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

/** @deprecated use FULL_ESCALATION_THRESHOLD */
export const GATE_ESCALATION_THRESHOLD = 0.7;

/** High-heat patterns screened by the cheap gate (subset of full ruleset). */
export const GATE_PATTERN_IDS = [
  "binary_contrast",
  "nominalization",
  "hedging",
  "sentence_opener_repetition",
  "importance_inflation",
  "transition_formulaic",
  "llm_fingerprint_word",
  "participial_cascade",
] as const;

const VALID_GATE_PATTERNS = new Set<string>(GATE_PATTERN_IDS);
const VALID_ALL_PATTERNS = getValidPatternIds();

function buildGateSystemPrompt(): string {
  const hints = GATE_PATTERN_IDS.map((id) => {
    const entry = getPattern(id);
    return `   - ${id}: ${entry?.detection_hint ?? id}`;
  }).join("\n");

  return `You are a fast prose pattern screener. For each numbered sentence, detect ONLY these patterns:

${hints}

Respond with ONLY valid JSON (no markdown):
{"results": [{"patterns": [{"type": "<id>", "confidence": 0-1, "evidence": "<short quote>"}]}]}

One object per sentence, in order. Use an empty patterns array when none apply. Be conservative — only flag clear matches.`;
}

export const GATE_SYSTEM_PROMPT = buildGateSystemPrompt();

function parseGateResponse(raw: string, expectedCount: number): SentenceClassification[] {
  const parsed = extractJSON(raw);
  const results = extractResultsArray(parsed);
  if (!results?.length) {
    return Array.from({ length: expectedCount }, () => getDefaultClassification());
  }

  const classifications = results.map((r) =>
    r && typeof r === "object" && !Array.isArray(r)
      ? validateGateClassification(r as Record<string, unknown>)
      : getDefaultClassification(),
  );

  while (classifications.length < expectedCount) {
    classifications.push(getDefaultClassification());
  }
  return classifications.slice(0, expectedCount);
}

function validateGateClassification(raw: Record<string, unknown>): SentenceClassification {
  const base = getDefaultClassification();
  const patternsRaw = raw.patterns;
  if (!Array.isArray(patternsRaw)) return base;

  const patterns = patternsRaw
    .filter((p) => p && typeof p === "object" && !Array.isArray(p))
    .map((p) => p as Record<string, unknown>)
    .filter((p) => typeof p.type === "string" && VALID_GATE_PATTERNS.has(p.type))
    .map((p) => ({
      type: p.type as PatternType,
      confidence: typeof p.confidence === "number" ? clamp01(p.confidence) : 0.7,
      evidence: typeof p.evidence === "string" ? p.evidence : "",
    }))
    .filter((p) => VALID_ALL_PATTERNS.has(p.type));

  return { ...base, patterns };
}

function clamp01(v: unknown): number {
  if (typeof v !== "number" || Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function extractJSON(text: string): Record<string, unknown> | unknown[] | null {
  if (!text || typeof text !== "string") return null;
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const fenceMatch =
    cleaned.match(/```(?:json)?\s*([\s\S]*?)```/) ?? cleaned.match(/```(?:json)?\s*([\s\S]*)/);
  if (fenceMatch) cleaned = fenceMatch[1]!.trim();
  const start = cleaned.search(/[[{]/);
  if (start < 0) return null;
  cleaned = cleaned.slice(start).replace(/,(\s*[}\]])/g, "$1");
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function extractResultsArray(parsed: Record<string, unknown> | unknown[] | null): unknown[] | null {
  if (!parsed) return null;
  if (Array.isArray(parsed)) return parsed;
  const obj = parsed as Record<string, unknown>;
  for (const key of ["results", "result", "data", "classifications", "output"]) {
    const val = obj[key];
    if (Array.isArray(val)) return val;
  }
  if (obj.patterns) return [obj];
  return null;
}

/** Cheap pattern gate — tiny prompt, patterns-only output. */
export class GateClassifier {
  private model: LanguageModel;
  private systemPrompt: string;
  private batchSize: number;
  private maxParallel: number;

  constructor(model: LanguageModel, systemPrompt?: string, options?: ClassifierOptions) {
    this.model = model;
    this.systemPrompt = systemPrompt ?? GATE_SYSTEM_PROMPT;
    this.batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE;
    this.maxParallel = options?.maxParallel ?? DEFAULT_MAX_PARALLEL;
  }

  async classify(sentences: HashedSentence[]): Promise<ClassifiedSentence[]> {
    if (sentences.length === 0) return [];
    if (sentences.length <= this.batchSize) {
      return this.classifyBatch(sentences);
    }

    const batches = chunk(sentences, this.batchSize);
    const results: ClassifiedSentence[] = [];
    for (let i = 0; i < batches.length; i += this.maxParallel) {
      const wave = batches.slice(i, i + this.maxParallel);
      const waveResults = await Promise.all(wave.map((batch) => this.classifyBatch(batch)));
      for (const batchResult of waveResults) {
        results.push(...batchResult);
      }
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
          return [...(await this.classifyBatchOnce(a)), ...(await this.classifyBatchOnce(b))];
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
    const { text } = await generateText({
      model: this.model,
      system: this.systemPrompt,
      prompt: userPrompt,
      maxOutputTokens: estimateOutputTokens(sentences.length, "gate"),
      providerOptions: {
        groq: { reasoningFormat: "parsed" },
      },
    });
    const classifications = parseGateResponse(text, sentences.length);

    return sentences.map((s, i) => {
      const classification = classifications[i] ?? getDefaultClassification();
      return { ...s, classification, heat: computeHeat(classification) };
    });
  }
}

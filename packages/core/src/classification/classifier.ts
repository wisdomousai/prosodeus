import { query } from "@anthropic-ai/claude-agent-sdk";
import { generateText, type LanguageModel } from "ai";
import {
  estimateOutputTokens,
  isRateLimitError,
  splitBatchForRetry,
} from "../models/provider-speed.ts";
import {
  getHeatWeight,
  getPatternsByLevel,
  getValidPatternIds,
  PATTERN_REGISTRY,
} from "../taxonomy/pattern-registry.ts";
import type {
  ClassifiedSentence,
  HashedSentence,
  PatternType,
  SentenceClassification,
} from "../types.ts";

// ─── Valid pattern types (derived from registry) ────────────────────────────

const VALID_PATTERNS = getValidPatternIds();

// ─── System Prompt (stable prefix — maximizes cache hits) ────────────────────

/**
 * Build the system prompt dynamically from the pattern registry.
 * The stable prefix (Biber dimensions + response format) maximizes prefix cache hits.
 * The pattern detection hints are generated from registry entries.
 */
function buildSystemPrompt(): string {
  const lexical = getPatternsByLevel("lexical");
  const sentence = getPatternsByLevel("sentence");
  const paragraph = getPatternsByLevel("paragraph");

  const formatPatterns = (entries: typeof lexical) =>
    entries.map((e) => `   - ${e.id}: ${e.detection_hint}`).join("\n");

  return `You are a structural prose classifier. For each numbered sentence, produce one classification object.

1. "biber": confidence 0-1 for each dimension
   - informational: factual, referential (nouns, prepositions, attributive adjectives)
   - involved: interactive, affective (1st/2nd person, questions, emphatics)
   - narrative: past tense, temporal sequence (past tense, 3rd person, perfect aspect)
   - persuasive: argumentative, evaluative (modals, suasive verbs, conditional)
   - abstract: conceptual, technical (passives, nominalizations, conjuncts)
   - elaborative: detail-adding (relative clauses, prepositional phrases, appositives)

2. "patterns": array of detected patterns with evidence

   LEXICAL patterns:
${formatPatterns(lexical)}

   SENTENCE patterns:
${formatPatterns(sentence)}

   PARAGRAPH patterns (mark per-sentence signals):
${formatPatterns(paragraph)}

3. "metrics": word_count, clause_count, has_participial, has_relative_clause, clause_balance_ratio (0-1, 0.5=balanced), construction_type

4. "arc_role": "claim"|"evidence"|"pivot"|"resolution"|"transition"|"elaboration"

Respond with ONLY a valid JSON object (no markdown, no explanation) in this exact format:
{"results": [<one object per sentence>]}

Each result object has keys: biber, patterns, metrics, arc_role.
Be thorough with pattern detection — flag every pattern you see with evidence.`;
}

export const SYSTEM_PROMPT = buildSystemPrompt();

export interface ClassifierOptions {
  /** Sentences per LLM request (default 12). */
  batchSize?: number;
  /** Max concurrent batch requests (default 2). */
  maxParallel?: number;
  /** Cap generated tokens for this batch (computed from batch size when omitted). */
  maxOutputTokens?: number;
}

const DEFAULT_BATCH_SIZE = 12;
const DEFAULT_MAX_PARALLEL = 2;

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

// ─── Classifier ──────────────────────────────────────────────────────────────

export class LLMClassifier {
  private model: LanguageModel;
  private systemPrompt: string;
  private batchSize: number;
  private maxParallel: number;
  private defaultMaxOutputTokens: number;

  constructor(model: LanguageModel, systemPrompt?: string, options?: ClassifierOptions) {
    this.model = model;
    this.systemPrompt = systemPrompt ?? SYSTEM_PROMPT;
    this.batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE;
    this.maxParallel = options?.maxParallel ?? DEFAULT_MAX_PARALLEL;
    this.defaultMaxOutputTokens =
      options?.maxOutputTokens ?? estimateOutputTokens(this.batchSize, "full");
  }

  /**
   * Parse raw LLM response text into validated SentenceClassification[].
   * Exposed for testing the JSON extraction + validation pipeline without API calls.
   */
  parseResponse(raw: string, expectedCount: number): SentenceClassification[] {
    const parsed = extractJSON(raw);
    const results = extractResultsArray(parsed);

    if (!results || !Array.isArray(results) || results.length === 0) {
      throw new Error("Failed to parse classification response");
    }

    const classifications = results.map((r) =>
      r && typeof r === "object" && !Array.isArray(r)
        ? validateClassification(r as Record<string, unknown>)
        : getDefaultClassification(),
    );

    // Pad if fewer results than expected
    while (classifications.length < expectedCount) {
      classifications.push(getDefaultClassification());
    }

    // Truncate if more results than expected
    return classifications.slice(0, expectedCount);
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
          const ra = await this.classifyBatchOnce(a);
          const rb = await this.classifyBatchOnce(b);
          return [...ra, ...rb];
        }
      }
      console.error("Classification failed:", err);
      const status = (err as { statusCode?: number })?.statusCode;
      if (status && status >= 400) throw err;
      return sentences.map((sentence) => ({
        ...sentence,
        classification: getDefaultClassification(),
        heat: 0,
      }));
    }
  }

  private async classifyBatchOnce(sentences: HashedSentence[]): Promise<ClassifiedSentence[]> {
    const userPrompt = sentences.map((s, i) => `[${i + 1}] ${s.text}`).join("\n");

    let classifications: SentenceClassification[];

    try {
      const { text } = await generateText({
        model: this.model,
        system: this.systemPrompt,
        prompt: userPrompt,
        maxOutputTokens: estimateOutputTokens(sentences.length, "full"),
        providerOptions: {
          groq: { reasoningFormat: "parsed" },
        },
      });

      const parsed = extractJSON(text);
      const results = extractResultsArray(parsed);

      if (!Array.isArray(results) || results.length === 0) {
        console.error(
          "Classification returned non-array or empty results. Raw (first 500):",
          text.slice(0, 500),
        );
        classifications = sentences.map(() => getDefaultClassification());
      } else {
        classifications = results.map((r) =>
          r && typeof r === "object" && !Array.isArray(r)
            ? validateClassification(r as Record<string, unknown>)
            : getDefaultClassification(),
        );
      }
    } catch (err) {
      console.error("Classification failed:", err);
      throw err;
    }

    // Pad if model returned fewer results
    while (classifications.length < sentences.length) {
      classifications.push(getDefaultClassification());
    }

    return sentences.map((sentence, i) => ({
      ...sentence,
      classification: classifications[i] ?? getDefaultClassification(),
      heat: computeHeat(classifications[i] ?? getDefaultClassification()),
    }));
  }
}

// ─── Agent SDK Classifier ────────────────────────────────────────────────────

/**
 * Classifier that runs against the Claude Agent SDK (`query()`).
 *
 * Uses the locked minimal-overhead shape (see memory `project-agent-sdk-minimal-config`):
 *   tools: []           — kills the built-in Claude Code tool catalog
 *   allowedTools: []    — belt-and-suspenders permissions
 *   settingSources: []  — hermetic, no project/user config
 *   no outputFormat     — returns JSON-as-text, parsed with the same helpers as LLMClassifier
 *
 * Auth: relies on a local `claude login` (Anthropic OAuth credentials in
 * ~/.claude). Calls deduct from the user's $20/mo Agent SDK plan credit.
 */
export class AgentSDKClassifier {
  private model: string;
  private systemPrompt: string;

  constructor(opts: { model?: string; systemPrompt?: string } = {}) {
    this.model = opts.model ?? "claude-haiku-4-5";
    this.systemPrompt = opts.systemPrompt ?? SYSTEM_PROMPT;
  }

  async classify(sentences: HashedSentence[]): Promise<ClassifiedSentence[]> {
    if (sentences.length === 0) return [];

    // Pass the system prompt separately so the stable prefix stays cacheable
    // across calls — only the sentences vary. createAgentSDKModel relies on
    // the same `systemPrompt` option for every rewrite/suggest call.
    const userBlock = sentences.map((s, i) => `[${i + 1}] ${s.text}`).join("\n");

    // Normalize model name for the local Claude Code binary
    const modelForSdk =
      this.model === "claude-haiku-4-5"
        ? "haiku"
        : this.model === "claude-sonnet-4-6"
          ? "sonnet"
          : this.model;

    let classifications: SentenceClassification[];

    try {
      let assistantText = "";
      for await (const message of query({
        prompt: userBlock,
        options: {
          systemPrompt: this.systemPrompt,
          tools: [],
          allowedTools: [],
          settingSources: [],
          model: modelForSdk,
          persistSession: false,
          maxTurns: 1,
        },
      })) {
        if (message.type === "assistant") {
          for (const b of message.message?.content ?? []) {
            if (b.type === "text") assistantText += b.text;
          }
        }
      }

      const parsed = extractJSON(assistantText);
      const results = extractResultsArray(parsed);

      if (!Array.isArray(results) || results.length === 0) {
        console.error(
          "Classification (Agent SDK) returned non-array or empty. Raw (first 500):",
          assistantText.slice(0, 500),
        );
        classifications = sentences.map(() => getDefaultClassification());
      } else {
        classifications = results.map((r) =>
          r && typeof r === "object" && !Array.isArray(r)
            ? validateClassification(r as Record<string, unknown>)
            : getDefaultClassification(),
        );
      }
    } catch (err) {
      console.error("Classification (Agent SDK) failed:", err);
      throw err;
    }

    while (classifications.length < sentences.length) {
      classifications.push(getDefaultClassification());
    }

    return sentences.map((sentence, i) => ({
      ...sentence,
      classification: classifications[i] ?? getDefaultClassification(),
      heat: computeHeat(classifications[i] ?? getDefaultClassification()),
    }));
  }
}

/**
 * Extract JSON from model output, handling:
 * - <think>...</think> tags (Qwen 3, DeepSeek)
 * - Markdown ```json fences
 * - Trailing commas, truncated output
 * - Alternate keys (results, data, classifications, output)
 */
function extractJSON(text: string): Record<string, unknown> | unknown[] | null {
  if (!text || typeof text !== "string") return null;
  // Strip <think>...</think> blocks (Qwen 3 reasoning)
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  // Strip markdown fences (handle missing closing fence for truncated output)
  const fenceMatch =
    cleaned.match(/```(?:json)?\s*([\s\S]*?)```/) ?? cleaned.match(/```(?:json)?\s*([\s\S]*)/);
  if (fenceMatch) cleaned = fenceMatch[1]!.trim();
  // Find JSON start
  const start = cleaned.search(/[[{]/);
  if (start < 0) return null;
  cleaned = cleaned.slice(start);
  // Fix common LLM JSON mistakes: trailing commas before ] or }
  cleaned = cleaned.replace(/,(\s*[}\]])/g, "$1");
  // Try to trim trailing non-JSON text by finding last ] or }
  const trimmed = trimTrailingText(cleaned);
  for (const candidate of [cleaned, trimmed, tryRepairTruncated(cleaned)]) {
    if (!candidate) continue;
    try {
      return JSON.parse(candidate);
    } catch {}
  }
  return null;
}

/** Try to repair truncated JSON by closing open brackets/braces */
function tryRepairTruncated(s: string): string | null {
  const stack: string[] = [];
  let inString = false;
  let escape = false;
  let quote = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (c === "\\") escape = true;
      else if (c === quote) inString = false;
      continue;
    }
    if (c === '"' || c === "'") {
      inString = true;
      quote = c;
      continue;
    }
    if (c === "{" || c === "[") stack.push(c === "{" ? "}" : "]");
    else if (c === "}" || c === "]") stack.pop();
  }
  if (stack.length === 0) return null;
  return s + stack.reverse().join("");
}

/** Trim trailing non-JSON text after the last closing bracket/brace */
function trimTrailingText(s: string): string | null {
  // Find the last ] or } which likely closes the JSON
  const lastBracket = Math.max(s.lastIndexOf("]"), s.lastIndexOf("}"));
  if (lastBracket < 0) return null;
  const trimmed = s.slice(0, lastBracket + 1);
  return trimmed !== s ? trimmed : null;
}

/** Extract results array from parsed output; try multiple keys and formats */
function extractResultsArray(parsed: Record<string, unknown> | unknown[] | null): unknown[] | null {
  if (!parsed) return null;
  if (Array.isArray(parsed)) return parsed;
  const obj = parsed as Record<string, unknown>;
  const keys = ["results", "result", "data", "classifications", "output", "items"];
  for (const key of keys) {
    const val = obj[key];
    if (Array.isArray(val)) return val;
  }
  // Model returned a single classification object (has biber or patterns key)
  if (obj.biber || obj.patterns || obj.arc_role) {
    return [obj];
  }
  return null;
}

// ─── Validation + Defaults ───────────────────────────────────────────────────

function normalizePatterns(
  raw: unknown,
): Array<{ type: string; confidence: number; evidence: string }> {
  // Format 0: array of strings ["hedging", "nominalization"]
  if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === "string") {
    return (raw as string[])
      .filter((s): s is string => typeof s === "string" && VALID_PATTERNS.has(s))
      .map((type) => ({ type, confidence: 0.8, evidence: "" }));
  }
  // Format 1: array of {type, pattern, or name} + evidence
  // Some models put the pattern ID in `type` ({type: "hedging"}); others put
  // it in `name` and use `type` for the level ({type: "lexical", name: "hedging"}).
  // Pick whichever candidate is actually a valid pattern ID — order doesn't matter.
  if (Array.isArray(raw)) {
    return raw
      .filter((p) => p && typeof p === "object")
      .map((p) => {
        const obj = p as Record<string, unknown>;
        const candidates = [obj.type, obj.pattern, obj.name].filter(
          (v): v is string => typeof v === "string",
        );
        const type = candidates.find((c) => VALID_PATTERNS.has(c));
        if (!type) return null;
        return {
          type,
          confidence: typeof obj.confidence === "number" ? clamp01(obj.confidence) : 0.8,
          evidence: typeof obj.evidence === "string" ? obj.evidence : String(obj.evidence ?? ""),
        };
      })
      .filter((p): p is { type: string; confidence: number; evidence: string } => p !== null);
  }
  // Format 2: array of strings — ["hedging", "nominalization"]
  if (Array.isArray(raw)) {
    return raw
      .filter((s): s is string => typeof s === "string" && VALID_PATTERNS.has(s))
      .map((type) => ({ type, confidence: 0.8, evidence: "" }));
  }
  // Format 3: object {pattern_name: evidence_string} — Qwen 3 style
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return Object.entries(raw as Record<string, unknown>)
      .filter(([key]) => VALID_PATTERNS.has(key))
      .map(([key, value]) => ({
        type: key,
        confidence: 0.8,
        evidence: typeof value === "string" ? value : String(value),
      }));
  }
  return [];
}

function validateClassification(raw: Record<string, unknown>): SentenceClassification {
  const biber = (raw.biber ?? {}) as Record<string, unknown>;
  const patterns = normalizePatterns(raw.patterns);
  const metrics = (raw.metrics ?? {}) as Record<string, unknown>;

  return {
    biber: {
      informational: clamp01(biber.informational),
      involved: clamp01(biber.involved),
      narrative: clamp01(biber.narrative),
      persuasive: clamp01(biber.persuasive),
      abstract: clamp01(biber.abstract),
      elaborative: clamp01(biber.elaborative),
    },
    patterns: patterns
      .filter((p) => p && typeof p.type === "string" && VALID_PATTERNS.has(p.type))
      .map((p) => ({
        type: p.type as PatternType,
        confidence: typeof p.confidence === "number" ? clamp01(p.confidence) : 0.8,
        evidence: typeof p.evidence === "string" ? p.evidence : "",
      })),
    metrics: {
      word_count: typeof metrics.word_count === "number" ? metrics.word_count : 0,
      clause_count: typeof metrics.clause_count === "number" ? metrics.clause_count : 1,
      has_participial: metrics.has_participial === true,
      has_relative_clause: metrics.has_relative_clause === true,
      clause_balance_ratio: clamp01(metrics.clause_balance_ratio),
      construction_type:
        typeof metrics.construction_type === "string" ? metrics.construction_type : "simple",
    },
    arc_role: typeof raw.arc_role === "string" ? raw.arc_role : "claim",
  };
}

function clamp01(v: unknown): number {
  if (typeof v !== "number" || isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

export function getDefaultClassification(): SentenceClassification {
  return {
    biber: {
      informational: 0,
      involved: 0,
      narrative: 0,
      persuasive: 0,
      abstract: 0,
      elaborative: 0,
    },
    patterns: [],
    metrics: {
      word_count: 0,
      clause_count: 1,
      has_participial: false,
      has_relative_clause: false,
      clause_balance_ratio: 0.5,
      construction_type: "simple",
    },
    arc_role: "claim",
  };
}

// ─── Heat Score Computation ──────────────────────────────────────────────────

/**
 * Compute a heat score (0-10) for a single sentence based on its classification.
 * Higher = more problematic (more LLM-typical pattern density).
 *
 * Heat weights reflect each pattern's LLM overuse factor from the taxonomy.
 * Co-occurrence multiplier catches compounding — the core Prosodeus insight.
 */
export function computeHeat(classification: SentenceClassification): number {
  let heat = 0;

  // Pattern density: each detected pattern adds heat weighted by LLM overuse factor
  for (const pattern of classification.patterns) {
    const weight = getHeatWeight(pattern.type);
    heat += weight * pattern.confidence;
  }

  // Clause symmetry bonus (structural metric beyond pattern detection)
  const balance = classification.metrics.clause_balance_ratio;
  if (balance > 0.85 && classification.metrics.clause_count >= 2) {
    heat += (1.0 * (balance - 0.85)) / 0.15;
  }

  // Participial stacking bonus
  if (classification.metrics.has_participial && classification.metrics.clause_count >= 3) {
    heat += 0.8;
  }

  // Co-occurrence multiplier: 3+ patterns in one sentence is compounding
  if (classification.patterns.length >= 3) {
    heat *= 1.2;
  }

  return Math.min(10, Math.round(heat * 10) / 10);
}

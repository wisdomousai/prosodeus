import { generateText, type LanguageModel } from "ai";
import {
  STANDARD_SUGGEST_OUTPUT,
  type SuggestOutputProfile,
  suggestOutputForSpec,
} from "../models/model-capabilities.ts";
import type { MoonshotKeyKind } from "../models/moonshot-config.ts";
import { getPattern } from "../taxonomy/pattern-registry.ts";
import type {
  ClassifiedSentence,
  PatternType,
  RewriteSuggestion,
  SuggestionLevel,
} from "../types.ts";
import { filterRewriteSuggestions, isValidRewriteSuggestion } from "./suggestion-validation.ts";

/** Decode a JSON string literal captured from a partial object. */
function decodeJsonString(encoded: string): string {
  try {
    return JSON.parse(`"${encoded.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`) as string;
  } catch {
    return encoded.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
}

function normalizeSuggestionEntry(entry: unknown): { text: string; rationale: string } | null {
  if (typeof entry === "string" && entry.trim().length >= 12) {
    return { text: entry.trim(), rationale: "" };
  }
  if (typeof entry !== "object" || entry === null) return null;
  const o = entry as Record<string, unknown>;
  const textRaw = o.text ?? o.rewrite ?? o.alternative ?? o.suggestion;
  if (typeof textRaw !== "string" || textRaw.trim().length === 0) return null;
  const rationaleRaw = o.rationale ?? o.reason ?? o.explanation ?? "";
  return {
    text: textRaw.trim(),
    rationale: typeof rationaleRaw === "string" ? rationaleRaw.trim() : "",
  };
}

/** Extract suggestion objects from truncated or malformed JSON via regex. */
function salvageSuggestionTexts(raw: string): Array<{ text: string; rationale: string }> {
  const out: Array<{ text: string; rationale: string }> = [];
  const itemRe =
    /"(?:text|rewrite|alternative|suggestion)"\s*:\s*"((?:\\.|[^"\\])*)"(?:\s*,\s*"(?:rationale|reason|explanation)"\s*:\s*"((?:\\.|[^"\\])*)")?/gi;
  let match: RegExpExecArray | null;
  while ((match = itemRe.exec(raw)) !== null) {
    const text = decodeJsonString(match[1]!);
    if (text.trim().length < 12) continue;
    const rationale = match[2] ? decodeJsonString(match[2]) : "";
    out.push({ text: text.trim(), rationale: rationale.trim() });
  }
  return out;
}

/** Parse JSON from model output (markdown fences, prose prefixes, alternate keys). */
export function parseSuggestionsJson(text: string): Array<{ text: string; rationale: string }> {
  const candidates: string[] = [];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/gi);
  if (fenced) {
    for (const block of fenced) {
      const inner = block
        .replace(/```(?:json)?/i, "")
        .replace(/```$/, "")
        .trim();
      if (inner) candidates.push(inner);
    }
  }
  // Prefer the last complete-ish object block (models often prefix with prose).
  const blocks = [...text.matchAll(/\{[\s\S]*?\}(?=\s*(?:```|$|\n\n|\n\s*\n))/g)];
  for (const b of blocks) candidates.push(b[0]!);
  const brace = text.match(/\{[\s\S]*\}/);
  if (brace) candidates.push(brace[0]);

  for (const raw of candidates) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const list =
        (Array.isArray(parsed.suggestions) ? parsed.suggestions : null) ??
        (Array.isArray(parsed.alternatives) ? parsed.alternatives : null) ??
        (Array.isArray(parsed.rewrites) ? parsed.rewrites : null) ??
        (Array.isArray(parsed) ? parsed : null);
      if (!list) continue;
      const out = list
        .map(normalizeSuggestionEntry)
        .filter((s): s is { text: string; rationale: string } => s !== null)
        .filter((s) => s.text.length >= 12);
      if (out.length > 0) return out;
    } catch {
      /* try salvage on this candidate */
      const salvaged = salvageSuggestionTexts(raw);
      if (salvaged.length > 0) return salvaged;
    }
  }

  return salvageSuggestionTexts(text);
}

/** Parse batched suggest JSON (`sentences` array). */
export function parseBatchSuggestionsJson(text: string): Array<{
  idx?: number;
  id?: number;
  suggestions?: Array<{ text: string; rationale: string }>;
}> {
  const candidates: string[] = [];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/gi);
  if (fenced) {
    for (const block of fenced) {
      const inner = block
        .replace(/```(?:json)?/i, "")
        .replace(/```$/, "")
        .trim();
      if (inner) candidates.push(inner);
    }
  }
  const brace = text.match(/\{[\s\S]*\}/);
  if (brace) candidates.push(brace[0]);

  for (const raw of candidates) {
    try {
      const parsed = JSON.parse(raw) as { sentences?: unknown[] };
      if (!Array.isArray(parsed.sentences)) continue;
      return parsed.sentences as Array<{
        idx?: number;
        id?: number;
        suggestions?: Array<{ text: string; rationale: string }>;
      }>;
    } catch {
      /* try next */
    }
  }
  return [];
}

/** Get a short directive for a pattern, used in suggestion prompts */
function getPatternDirective(type: string): string {
  const entry = getPattern(type);
  if (!entry) return type.replace(/_/g, " ");
  // Extract a terse directive from the PCE directive by stripping "Do NOT"
  return entry.pce_directive.replace(/^Do NOT\s+/i, "avoid: ");
}

// ─── Level-specific system prompts ──────────────────────────────────────────

const WORD_SYSTEM_PROMPT = `You are a structural prose editor. For each detected pattern evidence phrase, suggest replacement words or short phrases that eliminate the pattern while preserving meaning.

Respond with ONLY valid JSON: {"suggestions": [{"text": "replacement phrase", "rationale": "...", "replacement_target": "original phrase"}]}

Rules:
- Replace ONLY the flagged phrase, not the whole sentence
- Preserve meaning exactly
- The rationale explains the lexical change (1 sentence)
- Do NOT use hedging, inflation, or LLM-typical words`;

const SENTENCE_SYSTEM_PROMPT = `You are a structural prose editor. Given a sentence with detected patterns, generate alternative phrasings that eliminate the specific patterns while preserving ALL factual content.

Respond with ONLY valid JSON: {"suggestions": [{"text": "...", "rationale": "..."}]}

Rules:
- Each alternative must be a complete replacement sentence
- Preserve every fact, name, number, and logical relationship
- Rationale: one short phrase (under 12 words) describing the structural change
- Do NOT use hedging, inflation, or LLM-typical words
- Make each alternative structurally distinct from the others
- Output compact JSON only — no markdown fences, no commentary`;

const GENERIC_SENTENCE_SYSTEM_PROMPT = `You are a structural prose editor. Generate alternative phrasings that improve rhythm, clarity, and structural variety while preserving ALL factual content.

Respond with ONLY valid JSON: {"suggestions": [{"text": "...", "rationale": "..."}]}

Rules:
- Each alternative must be a complete replacement sentence
- Preserve every fact, name, number, and logical relationship
- Vary sentence openings, clause structure, and rhythm across alternatives
- Rationale: one short phrase (under 12 words) describing the structural change
- Do NOT use hedging, inflation, or LLM-typical words
- Output compact JSON only — no markdown fences, no commentary`;

const PARAGRAPH_SYSTEM_PROMPT = `You are a structural prose editor. Given a paragraph with detected patterns across its sentences, rewrite the entire paragraph to eliminate the patterns while preserving ALL factual content and inter-sentence coherence.

Respond with ONLY valid JSON: {"suggestions": [{"text": "full rewritten paragraph", "rationale": "..."}]}

Rules:
- Rewrite the ENTIRE paragraph, not just one sentence
- Preserve every fact, name, number, and logical relationship
- Vary sentence lengths, openings, and structures within the paragraph
- The rationale summarizes the structural changes made (1-2 sentences)
- Do NOT use hedging, inflation, or LLM-typical words`;

export interface SuggestOptions {
  level?: SuggestionLevel;
  numAlternatives?: number;
  customInstruction?: string;
  /** Model spec (e.g. moonshot/kimi-for-coding) — selects output budget from config. */
  modelName?: string;
  moonshotKind?: MoonshotKeyKind;
}

export interface SuggestTokenBudgetOpts {
  patternCount?: number;
  batchSentences?: number;
  numAlternatives?: number;
}

export function suggestMaxOutputTokens(
  level: SuggestionLevel,
  profile: SuggestOutputProfile,
  opts?: SuggestTokenBudgetOpts,
): number {
  if (level === "paragraph") return profile.paragraphMax;
  if (opts?.batchSentences) {
    const n = opts.batchSentences;
    const alts = opts.numAlternatives ?? 3;
    return Math.min(profile.batchMax, Math.max(profile.batchBase, n * alts * profile.batchPerAlt));
  }
  const patterns = opts?.patternCount ?? 1;
  return Math.min(
    profile.sentenceMax,
    profile.sentenceBase + patterns * profile.sentencePerPattern,
  );
}

function resolveSuggestOutput(
  options?: Pick<SuggestOptions, "modelName" | "moonshotKind">,
): SuggestOutputProfile {
  const spec = options?.modelName?.trim();
  if (!spec) return STANDARD_SUGGEST_OUTPUT;
  return suggestOutputForSpec(spec, options?.moonshotKind);
}

async function generateSuggestText(
  model: LanguageModel,
  system: string,
  prompt: string,
  level: SuggestionLevel,
  outputProfile: SuggestOutputProfile,
  tokenOpts: SuggestTokenBudgetOpts,
): Promise<{ text: string; finishReason: string | undefined }> {
  return generateText({
    model,
    system,
    prompt,
    maxOutputTokens: suggestMaxOutputTokens(level, outputProfile, tokenOpts),
  });
}

function throwSuggestEmpty(message: string, detail?: string): never {
  const suffix = detail ? ` (${detail})` : "";
  throw new Error(`${message}${suffix}`);
}

function finalizeSuggestions(
  raw: string,
  finishReason: string | undefined,
  original: string,
  parsed: Array<{ text: string; rationale: string }>,
  numAlternatives: number,
): Array<{ text: string; rationale: string }> {
  if (!raw.trim()) {
    if (finishReason === "length") {
      throwSuggestEmpty(
        "Model ran out of output tokens before producing suggestions",
        "try again or use Rewrite for a custom pass",
      );
    }
    throwSuggestEmpty("Model returned an empty response");
  }

  const alternatives = parsed
    .filter((s) => isValidRewriteSuggestion(original, s.text))
    .slice(0, numAlternatives);

  if (alternatives.length > 0) return alternatives;

  if (parsed.length === 0) {
    throwSuggestEmpty(
      "Could not parse suggestions from model output",
      `${raw.length} chars returned`,
    );
  }
  throwSuggestEmpty(
    `All ${parsed.length} suggestion(s) failed validation`,
    "try Rewrite for a custom pass",
  );
}

// ─── Batched suggestions (one LLM call for multiple sentences) ───────────────

const BATCH_SYSTEM_PROMPT = `You are a structural prose editor.

CRITICAL RULE — READ CAREFULLY:
You must ONLY rewrite the exact sentence given to you.
- DO NOT invent cities, skylines, towers, warehouses, corporate headquarters, financial districts, or any new scene.
- DO NOT add new nouns, proper names, numbers, or narrative details that were not in the original sentence.
- If the original sentence is abstract ("When abstract nouns stack together..."), the rewrite must stay abstract.
- If the original sentence is generic, the rewrite must stay generic.
- The only allowed changes are structural (word order, clause structure, voice, rhythm).

BAD EXAMPLE (never do this):
Original: "When abstract nouns stack together, the sentence asks the reader to admire a shape instead of follow a thought."
Bad: "The city's skyline, once dominated by low-rise buildings, now rises with steel and glass towers..."

GOOD EXAMPLE:
Original: "When abstract nouns stack together, the sentence asks the reader to admire a shape instead of follow a thought."
Good: "When abstract nouns pile up, the sentence invites admiration of form rather than pursuit of meaning."

Respond with ONLY valid JSON:
{"sentences": [
  {"idx": 0, "suggestions": [{"text": "...", "rationale": "..."}]}
]}

Use idx as the bracketed index from the input ([0], [1], …), NOT the sentence id.`;

/**
 * Generate rewrite suggestions for multiple hot sentences in a single LLM call.
 * Returns RewriteSuggestion[] for all sentences that had patterns.
 */
export async function suggestRewritesBatch(
  sentences: ClassifiedSentence[],
  allSentences: ClassifiedSentence[],
  model: LanguageModel,
  numAlternatives = 3,
  options?: Pick<SuggestOptions, "modelName" | "moonshotKind">,
): Promise<RewriteSuggestion[]> {
  const hot = sentences.filter((s) => s.classification.patterns.length > 0);
  if (hot.length === 0) return [];

  const outputProfile = resolveSuggestOutput(options);
  const modelName = options?.modelName;

  const entries = hot.map((s, idx) => {
    const patterns = new Map<string, string>();
    for (const p of s.classification.patterns) {
      if (!patterns.has(p.type)) patterns.set(p.type, p.evidence);
    }
    const patternList = [...patterns.entries()]
      .map(([type, evidence]) => `${type}: ${getPatternDirective(type)} (evidence: "${evidence}")`)
      .join("; ");

    const prev = allSentences.find((x) => x.id === s.id - 1);
    const next = allSentences.find((x) => x.id === s.id + 1);

    return `[${idx}] id=${s.id}\nPatterns: ${patternList}\nBefore: ${prev?.text ?? "(start)"}\nSentence: ${s.text}\nAfter: ${next?.text ?? "(end)"}`;
  });

  const userPrompt = `Generate ${numAlternatives} alternative(s) for EACH sentence below.\n\n${entries.join("\n\n")}`;

  try {
    const { text, finishReason } = await generateSuggestText(
      model,
      BATCH_SYSTEM_PROMPT,
      userPrompt,
      "sentence",
      outputProfile,
      {
        batchSentences: hot.length,
        numAlternatives,
      },
    );

    const parsed = parseBatchSuggestionsJson(text);
    if (parsed.length === 0) {
      if (!text.trim() && finishReason === "length") {
        throwSuggestEmpty(
          "Batch suggest ran out of output tokens",
          "try fewer hot sentences or another model",
        );
      }
      if (!text.trim()) throwSuggestEmpty("Batch suggest returned empty response");
      throwSuggestEmpty(
        "Could not parse batch suggestions from model output",
        `${text.length} chars`,
      );
    }

    const results: RewriteSuggestion[] = [];
    for (const entry of parsed) {
      // Prefer batch index; fall back to sentence id for older model outputs.
      const source =
        typeof entry.idx === "number" && entry.idx >= 0 && entry.idx < hot.length
          ? hot[entry.idx]
          : typeof entry.id === "number"
            ? hot.find((s) => s.id === entry.id)
            : undefined;
      if (!source) continue;

      const alts = (entry.suggestions ?? [])
        .filter(
          (s): s is { text: string; rationale: string } =>
            typeof s.text === "string" && typeof s.rationale === "string",
        )
        .filter((s) => isValidRewriteSuggestion(source.text, s.text))
        .slice(0, numAlternatives);
      if (alts.length === 0) continue;

      const patternTypes = new Set(source.classification.patterns.map((p) => p.type));
      for (const type of patternTypes) {
        results.push({
          original: source.text,
          alternatives: alts,
          pattern_type: type,
          sentence_id: source.id,
          model_name: modelName,
          level: "sentence",
        });
      }
    }
    return filterRewriteSuggestions(results);
  } catch (err) {
    console.warn("[suggestRewritesBatch] failed:", err instanceof Error ? err.message : err);
    throw err;
  }
}

/**
 * Generate rewrite suggestions for a single sentence's detected patterns.
 * Supports word, sentence, and paragraph level granularity.
 * Returns RewriteSuggestion[] tagged with model name and level.
 */
export async function suggestRewrites(
  sentence: ClassifiedSentence,
  context: { before: string; after: string; paragraph?: string },
  model: LanguageModel,
  options?: SuggestOptions,
): Promise<RewriteSuggestion[]> {
  if (sentence.classification.patterns.length === 0) {
    throwSuggestEmpty(
      "No patterns on this sentence",
      "re-analyze the document or pick a highlighted hot sentence",
    );
  }

  const level = options?.level ?? "sentence";
  const numAlternatives = Math.min(5, Math.max(1, options?.numAlternatives ?? 3));
  const modelName = options?.modelName;

  // Group patterns by type (deduplicate)
  const uniquePatterns = new Map<PatternType, string>();
  for (const p of sentence.classification.patterns) {
    if (!uniquePatterns.has(p.type)) {
      uniquePatterns.set(p.type, p.evidence);
    }
  }

  const patternList = [...uniquePatterns.entries()]
    .map(([type, evidence]) => `- ${type}: ${getPatternDirective(type)} (evidence: "${evidence}")`)
    .join("\n");

  // Build level-specific prompt
  const systemPrompt =
    level === "word"
      ? WORD_SYSTEM_PROMPT
      : level === "paragraph"
        ? PARAGRAPH_SYSTEM_PROMPT
        : SENTENCE_SYSTEM_PROMPT;

  let userPrompt: string;
  if (level === "word") {
    userPrompt = `PATTERNS DETECTED:\n${patternList}\n\nSENTENCE: ${sentence.text}\n\nFor each evidence phrase, suggest ${numAlternatives} replacement word(s) or short phrase(s).`;
  } else if (level === "paragraph") {
    const paragraphText = context.paragraph || sentence.text;
    userPrompt = `PATTERNS DETECTED:\n${patternList}\n\nPARAGRAPH:\n${paragraphText}\n\nRewrite the entire paragraph. Generate ${numAlternatives} alternative version(s).`;
  } else {
    userPrompt = `PATTERNS DETECTED:\n${patternList}\n\nCONTEXT BEFORE: ${context.before || "(start of document)"}\nSENTENCE: ${sentence.text}\nCONTEXT AFTER: ${context.after || "(end of document)"}\n\nGenerate ${numAlternatives} alternative(s) that eliminate ALL listed patterns.`;
  }

  if (options?.customInstruction?.trim()) {
    userPrompt += `\n\nADDITIONAL INSTRUCTION: ${options.customInstruction.trim()}`;
  }

  try {
    const outputProfile = resolveSuggestOutput(options);
    const { text, finishReason } = await generateSuggestText(
      model,
      systemPrompt,
      userPrompt,
      level,
      outputProfile,
      {
        patternCount: uniquePatterns.size,
      },
    );

    const original = level === "paragraph" ? context.paragraph || sentence.text : sentence.text;

    const alternatives = finalizeSuggestions(
      text,
      finishReason,
      original,
      parseSuggestionsJson(text),
      numAlternatives,
    );

    return filterRewriteSuggestions(
      [...uniquePatterns.keys()].map((type) => ({
        original,
        alternatives,
        pattern_type: type,
        sentence_id: sentence.id,
        model_name: modelName,
        level,
      })),
    );
  } catch (err) {
    console.warn("[suggestRewrites] failed:", err instanceof Error ? err.message : err);
    throw err;
  }
}

/** On-demand rewrites when no patterns were flagged — structural variety pass. */
export async function suggestGenericRewrites(
  sentence: ClassifiedSentence,
  context: { before: string; after: string; paragraph?: string },
  model: LanguageModel,
  options?: SuggestOptions,
): Promise<RewriteSuggestion[]> {
  const level = options?.level ?? "sentence";
  const numAlternatives = Math.min(5, Math.max(1, options?.numAlternatives ?? 3));
  const modelName = options?.modelName;

  const userPrompt =
    `CONTEXT BEFORE: ${context.before || "(start of document)"}\n` +
    `SENTENCE: ${sentence.text}\n` +
    `CONTEXT AFTER: ${context.after || "(end of document)"}\n\n` +
    `Generate ${numAlternatives} structurally distinct alternative(s).` +
    (options?.customInstruction?.trim()
      ? `\n\nADDITIONAL INSTRUCTION: ${options.customInstruction.trim()}`
      : "");

  const outputProfile = resolveSuggestOutput(options);
  const { text, finishReason } = await generateSuggestText(
    model,
    GENERIC_SENTENCE_SYSTEM_PROMPT,
    userPrompt,
    level,
    outputProfile,
    { patternCount: 1 },
  );

  const alternatives = finalizeSuggestions(
    text,
    finishReason,
    sentence.text,
    parseSuggestionsJson(text),
    numAlternatives,
  );

  return filterRewriteSuggestions([
    {
      original: sentence.text,
      alternatives,
      pattern_type: "vocabulary_smoothing",
      sentence_id: sentence.id,
      model_name: modelName,
      level,
    },
  ]);
}

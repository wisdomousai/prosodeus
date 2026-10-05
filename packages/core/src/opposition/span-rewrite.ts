import { generateText, type LanguageModel } from "ai";
import type { OppositionSpan } from "./types.ts";

export interface SpanRewriteOptions {
  model: LanguageModel;
  maxOutputTokens?: number;
  /** Number of distinct alternatives to request (default 3). */
  count?: number;
}

export interface SpanRewriteContext {
  sentence: string;
  before?: string;
  after?: string;
  paragraph?: string;
}

const SYSTEM_PROMPT = `You are a surgical prose editor. You rewrite ONE flagged sentence to remove a vacuous binary opposition while preserving every factual claim.

Rules:
- Rewrite ONLY the flagged sentence. Do not touch surrounding sentences.
- Preserve every fact, name, number, measurement, and logical relationship.
- Remove the vacuous contrast ("not X, but Y", "most do X, the best do Y", "on the one hand... on the other hand", etc.).
- Replace it with a direct, active statement.
- Do NOT introduce a new binary opposition.
- Do NOT add hedging, inflation, or LLM-typical words.
- Output ONLY valid JSON: {"replacement": "the rewritten sentence"}`;

const ALTERNATIVES_SYSTEM_PROMPT = `You are a surgical prose editor. You rewrite ONE flagged sentence to remove a vacuous or weak binary opposition while preserving every factual claim.

Rules:
- Rewrite ONLY the flagged sentence. Do not touch surrounding sentences.
- Preserve every fact, name, number, measurement, and logical relationship.
- Remove the vacuous contrast ("not X, but Y", "most do X, the best do Y", "on the one hand... on the other hand", etc.).
- Replace it with a direct, active statement.
- Do NOT introduce a new binary opposition.
- Do NOT add hedging, inflation, or LLM-typical words.
- Provide distinct rewrites with different structure and wording.
- Output ONLY valid JSON: {"alternatives": ["rewrite one", "rewrite two", "rewrite three"]}`;

const FEW_SHOT_EXAMPLES = `
EXAMPLE 1
Flagged sentence: It's not about speed; it's about precision.
Context before: Engineering teams often argue over metrics.
Context after: The right metric depends on the failure mode.
Replacement: Precision matters more than speed for this failure mode.

EXAMPLE 2
Flagged sentence: Most companies focus on cutting costs. The best companies focus on creating value.
Context before: (start of paragraph)
Context after: The difference shows up in their capital allocation.
Replacement: The best companies allocate capital to create value, not just to cut costs.

EXAMPLE 3
Flagged sentence: On the one hand, the platform is easy to use. On the other hand, it lacks advanced features.
Context before: Buyers weigh trade-offs when choosing software.
Context after: That balance determines which teams adopt it.
Replacement: The platform is easy to use, but it lacks advanced features.

EXAMPLE 4
Flagged sentence: This isn't just a tool; it's a paradigm shift.
Context before: The product has been underestimated.
Context after: Teams that treat it as a minor utility miss its impact.
Replacement: This tool changes how the team works.
`;

function cleanModelOutput(raw: string): string {
  return raw
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/```(?:json)?\s*|```/gi, "")
    .trim();
}

function normalizeCandidateText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function parseReplacement(raw: string): string | null {
  const cleaned = cleanModelOutput(raw);

  const start = cleaned.search(/[{[]/);
  if (start >= 0) {
    const jsonish = cleaned.slice(start).replace(/,\s*([}\]])/g, "$1");
    try {
      const parsed = JSON.parse(jsonish) as Record<string, unknown>;
      const replacement = parsed.replacement ?? parsed.rewritten ?? parsed.text;
      if (typeof replacement === "string" && replacement.trim().length > 0) {
        return replacement.trim();
      }
    } catch {
      // fall through
    }
  }

  const match = cleaned.match(/"replacement"\s*:\s*"((?:\\.|[^"\\])*?)"/i);
  if (match?.[1]) {
    return match[1].replace(/\\"/g, '"').trim();
  }

  // Plain-text fallback: model returned a sentence without JSON wrapping.
  if (cleaned.length > 0 && !cleaned.startsWith("{") && !cleaned.startsWith("[")) {
    const firstLine = cleaned
      .split(/\n+/)
      .find((line) => line.trim().length > 0)
      ?.trim();
    if (firstLine && firstLine.length >= 12 && /[.!?]$/.test(firstLine)) {
      return firstLine;
    }
  }

  return null;
}

function parseAlternatives(raw: string, count: number): string[] {
  const cleaned = cleanModelOutput(raw);
  const collected: string[] = [];

  const push = (value: unknown) => {
    if (typeof value !== "string") return;
    const trimmed = value.trim();
    if (trimmed.length === 0) return;
    collected.push(trimmed);
  };

  const start = cleaned.search(/[{[]/);
  if (start >= 0) {
    const jsonish = cleaned.slice(start).replace(/,\s*([}\]])/g, "$1");
    try {
      const parsed = JSON.parse(jsonish) as Record<string, unknown> | string[];
      if (Array.isArray(parsed)) {
        for (const item of parsed) push(item);
      } else {
        const alternatives = parsed.alternatives ?? parsed.options ?? parsed.rewrites;
        if (Array.isArray(alternatives)) {
          for (const item of alternatives) push(item);
        } else {
          push(parsed.replacement ?? parsed.rewritten ?? parsed.text);
        }
      }
    } catch {
      // fall through
    }
  }

  if (collected.length === 0) {
    const single = parseReplacement(raw);
    if (single) collected.push(single);
  }

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const item of collected) {
    const normalized = normalizeCandidateText(item);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(item);
    if (unique.length >= count) break;
  }
  return unique;
}

function buildRewriteUserPrompt(
  span: OppositionSpan,
  context: SpanRewriteContext,
  closing: string,
): string {
  return `${FEW_SHOT_EXAMPLES}

REWRITE THIS ONE
Flagged sentence: ${context.sentence}
Evidence: ${span.evidence}
Pattern: ${span.patternType}
${context.before ? `Context before: ${context.before}\n` : ""}${context.after ? `Context after: ${context.after}\n` : ""}${context.paragraph ? `Paragraph context: ${context.paragraph}\n` : ""}
${closing}`;
}

/**
 * Rewrite a single flagged sentence to remove a vacuous opposition.
 * Returns `null` if the model did not produce a usable replacement.
 */
export async function rewriteSpan(
  span: OppositionSpan,
  context: SpanRewriteContext,
  options: SpanRewriteOptions,
): Promise<string | null> {
  const userPrompt = buildRewriteUserPrompt(span, context, "JSON replacement only:");

  const { text } = await generateText({
    model: options.model,
    system: SYSTEM_PROMPT,
    prompt: userPrompt,
    maxOutputTokens: options.maxOutputTokens ?? 256,
  });

  const replacement = parseReplacement(text);
  if (!replacement) return null;

  if (normalizeCandidateText(replacement) === normalizeCandidateText(context.sentence)) return null;

  return replacement;
}

/**
 * Draft multiple rewrite options for a flagged sentence.
 * Returns an empty array when the model produces nothing usable.
 */
export async function rewriteSpanAlternatives(
  span: OppositionSpan,
  context: SpanRewriteContext,
  options: SpanRewriteOptions,
): Promise<string[]> {
  const count = options.count ?? 3;
  const userPrompt = buildRewriteUserPrompt(
    span,
    context,
    `Provide ${count} distinct JSON alternatives only:`,
  );

  const { text } = await generateText({
    model: options.model,
    system: ALTERNATIVES_SYSTEM_PROMPT,
    prompt: userPrompt,
    maxOutputTokens: options.maxOutputTokens ?? 512,
  });

  const original = normalizeCandidateText(context.sentence);
  return parseAlternatives(text, count).filter(
    (alternative) => normalizeCandidateText(alternative) !== original,
  );
}

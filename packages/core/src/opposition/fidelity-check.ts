import { generateText, type LanguageModel } from "ai";

export interface FidelityCheckOptions {
  /** Minimum content-word overlap between original and rewrite (0-1). */
  overlapThreshold?: number;
  /** Optional model for LLM entailment judgment. If omitted, only overlap is checked. */
  entailmentModel?: LanguageModel;
  maxOutputTokens?: number;
}

export interface FidelityResult {
  passed: boolean;
  /** Composite score 0-1. */
  score: number;
  reason: string;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function overlapRatio(a: string, b: string): number {
  const aTokens = new Set(tokenize(a));
  const bTokens = new Set(tokenize(b));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;

  let shared = 0;
  for (const t of aTokens) {
    if (bTokens.has(t)) shared += 1;
  }
  return shared / Math.min(aTokens.size, bTokens.size);
}

function parseEntailmentResponse(raw: string): {
  entails: boolean;
  confidence: number;
  explanation: string;
} {
  const cleaned = raw
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/```(?:json)?\s*|```/gi, "")
    .trim();

  const start = cleaned.search(/[{[]/);
  if (start >= 0) {
    const jsonish = cleaned.slice(start).replace(/,\s*([}\]])/g, "$1");
    try {
      const parsed = JSON.parse(jsonish) as Record<string, unknown>;
      const entails = parsed.entails === true || String(parsed.entails).toLowerCase() === "true";
      const confidence =
        typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.8;
      const explanation = typeof parsed.explanation === "string" ? parsed.explanation.trim() : "";
      return { entails, confidence, explanation };
    } catch {
      // fall through
    }
  }

  // Salvage
  const entailsMatch = cleaned.match(/"entails"\s*:\s*(true|false)/i);
  const confMatch = cleaned.match(/"confidence"\s*:\s*([0-9.]+)/i);
  const explMatch = cleaned.match(/"explanation"\s*:\s*"((?:\\.|[^"\\])*?)"/i);
  return {
    entails: entailsMatch?.[1]?.toLowerCase() === "true",
    confidence: confMatch?.[1] ? Math.max(0, Math.min(1, Number.parseFloat(confMatch[1]))) : 0.5,
    explanation: explMatch?.[1]?.replace(/\\"/g, '"').trim() ?? "",
  };
}

const ENTAILMENT_SYSTEM_PROMPT = `You are a strict meaning-preservation judge.

Given an original sentence and a rewritten sentence, decide whether the rewrite entails all the factual claims and stance of the original.

Rules:
- Ignore stylistic changes (active vs passive, word order, etc.).
- Reject if any factual claim, number, name, or logical relationship is dropped, softened, or reversed.
- Reject if the rewrite adds a claim that the original did not make.
- Respond with ONLY valid JSON: {"entails": boolean, "confidence": 0-1, "explanation": "one sentence"}`;

/**
 * Check that a rewrite preserves the meaning of the original sentence.
 * Combines a content-word overlap guard with an optional LLM entailment judge.
 */
export async function checkFidelity(
  originalSentence: string,
  rewrittenSentence: string,
  options: FidelityCheckOptions = {},
): Promise<FidelityResult> {
  const overlapThreshold = options.overlapThreshold ?? 0.45;
  const overlap = overlapRatio(originalSentence, rewrittenSentence);

  if (overlap < overlapThreshold) {
    return {
      passed: false,
      score: overlap,
      reason: `Content-word overlap ${overlap.toFixed(2)} below threshold ${overlapThreshold}`,
    };
  }

  if (!options.entailmentModel) {
    return {
      passed: true,
      score: overlap,
      reason: `Overlap ${overlap.toFixed(2)} passed; no entailment model configured`,
    };
  }

  const userPrompt = `Original: ${originalSentence}\nRewritten: ${rewrittenSentence}\n\nDoes the rewritten sentence entail the factual claims and stance of the original?`;

  const { text } = await generateText({
    model: options.entailmentModel,
    system: ENTAILMENT_SYSTEM_PROMPT,
    prompt: userPrompt,
    maxOutputTokens: options.maxOutputTokens ?? 256,
  });

  const { entails, confidence, explanation } = parseEntailmentResponse(text);

  if (!entails) {
    return {
      passed: false,
      score: overlap * confidence,
      reason: explanation || "Entailment judge rejected the rewrite",
    };
  }

  return {
    passed: true,
    score: overlap * confidence,
    reason:
      explanation ||
      `Overlap ${overlap.toFixed(2)} and entailment confidence ${confidence.toFixed(2)}`,
  };
}

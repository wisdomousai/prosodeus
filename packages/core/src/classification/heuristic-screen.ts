import type { HashedSentence, PatternType, SentenceClassification } from "../types.ts";
import { getDefaultClassification } from "./classifier.ts";

/** Lexical patterns with high-precision regex/lexicon screens (zero API cost). */
const LEXICAL_PATTERNS: PatternType[] = [
  "transition_formulaic",
  "llm_fingerprint_word",
  "importance_inflation",
  "hedging",
];

const VALIDATORS: Record<string, (text: string) => { match: boolean; evidence: string }> = {
  transition_formulaic: (text) => {
    const m = text.match(/^(Moreover|Furthermore|Additionally|In conclusion|In essence)\b/i);
    return { match: !!m, evidence: m?.[0] ?? "" };
  },
  llm_fingerprint_word: (text) => {
    const m = text.match(/\b(delve|landscape|tapestry|multifaceted|nuanced)\b/i);
    return { match: !!m, evidence: m?.[0] ?? "" };
  },
  importance_inflation: (text) => {
    const m = text.match(/\b(crucial|fundamental|pivotal|groundbreaking|tremendous|essential)\b/i);
    return { match: !!m, evidence: m?.[0] ?? "" };
  },
  hedging: (text) => {
    const m = text.match(
      /\b(perhaps|might|somewhat|potentially|considerable|promising|significant)\b/i,
    );
    return { match: !!m, evidence: m?.[0] ?? "" };
  },
};

export type HeuristicScreenResult =
  | { kind: "certain_negative" }
  | { kind: "certain_positive"; classification: SentenceClassification }
  | { kind: "ambiguous" };

/**
 * Layer-0 heuristic screen. Returns certain classifications without LLM,
 * or `ambiguous` when the sentence should go to gate.
 */
export function heuristicScreen(sentence: HashedSentence): HeuristicScreenResult {
  const detected: SentenceClassification["patterns"] = [];

  for (const patternId of LEXICAL_PATTERNS) {
    const validator = VALIDATORS[patternId];
    if (!validator) continue;
    const { match, evidence } = validator(sentence.text);
    if (match) {
      detected.push({
        type: patternId,
        confidence: 0.85,
        evidence,
      });
    }
  }

  if (detected.length === 0) {
    return { kind: "certain_negative" };
  }

  // High-confidence single lexical hit with evidence in text -> skip gate.
  if (detected.length === 1 && detected[0]!.evidence.length > 0) {
    return {
      kind: "certain_positive",
      classification: { ...getDefaultClassification(), patterns: detected },
    };
  }

  return { kind: "ambiguous" };
}

export function heuristicScreenBatch(
  sentences: HashedSentence[],
): Map<number, HeuristicScreenResult> {
  const results = new Map<number, HeuristicScreenResult>();
  for (const s of sentences) {
    results.set(s.id, heuristicScreen(s));
  }
  return results;
}

import { describe, expect, test } from "bun:test";
import {
  resolveBackgroundSuggestBudget,
  selectHotSentencesForSuggest,
  sentenceImpactScore,
} from "../src/analysis/hot-sentences.ts";
import type { ClassifiedSentence, SentenceClassification } from "../src/types.ts";

function sentence(
  id: number,
  paragraphId: number,
  heat: number,
  patterns: Array<{ type: string; confidence: number }>,
  wordCount = 12,
): ClassifiedSentence {
  const classification = {
    biber: {
      informational: 0.5,
      involved: 0.2,
      narrative: 0.1,
      persuasive: 0.1,
      abstract: 0.05,
      elaborative: 0.05,
    },
    patterns: patterns.map((p) => ({
      type: p.type as never,
      confidence: p.confidence,
      evidence: "x",
    })),
    metrics: {
      word_count: wordCount,
      clause_count: 1,
      has_participial: false,
      has_relative_clause: false,
      clause_balance_ratio: 0.5,
      construction_type: "simple" as const,
    },
    arc_role: "claim" as const,
  } satisfies SentenceClassification;
  return {
    id,
    text: `Sentence ${id} text here.`,
    hash: `h${id}`,
    paragraph_id: paragraphId,
    classification,
    heat,
  };
}

describe("selectHotSentencesForSuggest", () => {
  test("picks one representative per hot region before filling budget", () => {
    const sentences = [
      sentence(0, 0, 6, [{ type: "hedging", confidence: 0.9 }]),
      sentence(1, 0, 5.5, [{ type: "hedging", confidence: 0.85 }]),
      sentence(2, 1, 6, [{ type: "transition_formulaic", confidence: 0.9 }]),
      sentence(3, 1, 5, [{ type: "transition_formulaic", confidence: 0.8 }]),
      sentence(4, 2, 4, [{ type: "importance_inflation", confidence: 0.9 }]),
    ];
    const picked = selectHotSentencesForSuggest(sentences, {
      maxCount: 3,
      hotRegions: [
        {
          start_sentence: 0,
          end_sentence: 1,
          heat: 5.5,
          primary_patterns: ["hedging"],
          description: "",
        },
        {
          start_sentence: 2,
          end_sentence: 3,
          heat: 5.5,
          primary_patterns: ["transition_formulaic"],
          description: "",
        },
      ],
    });
    expect(picked.map((s) => s.id)).toEqual([0, 2, 4]);
  });

  test("limits picks per paragraph on short documents", () => {
    const sentences = [
      sentence(0, 0, 7, [{ type: "hedging", confidence: 0.9 }]),
      sentence(1, 0, 6.5, [{ type: "nominalization", confidence: 0.9 }]),
      sentence(2, 0, 6, [{ type: "llm_fingerprint_word", confidence: 0.85 }]),
    ];
    const picked = selectHotSentencesForSuggest(sentences, {
      maxCount: 3,
      wordCount: 200,
    });
    expect(picked).toHaveLength(1);
    expect(picked[0]!.id).toBe(0);
  });

  test("skips low-heat noise", () => {
    const sentences = [
      sentence(0, 0, 1, [{ type: "hedging", confidence: 0.5 }]),
      sentence(1, 0, 5, [{ type: "hedging", confidence: 0.9 }]),
    ];
    const picked = selectHotSentencesForSuggest(sentences, { maxCount: 2 });
    expect(picked.map((s) => s.id)).toEqual([1]);
  });

  test("prefers short high-impact sentences when heat is tied", () => {
    const long = sentence(0, 0, 5, [{ type: "hedging", confidence: 0.9 }], 40);
    const short = sentence(1, 1, 5, [{ type: "transition_formulaic", confidence: 0.9 }], 10);
    expect(sentenceImpactScore(short)).toBeGreaterThan(sentenceImpactScore(long));
    const picked = selectHotSentencesForSuggest([long, short], { maxCount: 1 });
    expect(picked[0]!.id).toBe(1);
  });
});

describe("resolveBackgroundSuggestBudget", () => {
  test("scales with word count and caps by patterned sentences", () => {
    expect(resolveBackgroundSuggestBudget(100, 8, 2)).toBe(2);
    expect(resolveBackgroundSuggestBudget(400, 20, 10)).toBe(3);
    expect(resolveBackgroundSuggestBudget(800, 30, 2)).toBe(2);
  });
});

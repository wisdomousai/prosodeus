import { describe, expect, test } from "bun:test";
import { scanOppositions } from "../src/opposition/opposition-scan.ts";
import type { ClassifiedSentence, StylometricProfile } from "../src/types.ts";

function makeSentence(
  id: number,
  text: string,
  paragraphId: number,
  patterns: ClassifiedSentence["classification"]["patterns"] = [],
): ClassifiedSentence {
  return {
    id,
    text,
    hash: `h${id}`,
    paragraph_id: paragraphId,
    classification: {
      biber: {
        informational: 0.5,
        involved: 0.2,
        narrative: 0.1,
        persuasive: 0.1,
        abstract: 0.05,
        elaborative: 0.05,
      },
      patterns,
      metrics: {
        word_count: text.split(/\s+/).length,
        clause_count: 1,
        has_participial: false,
        has_relative_clause: false,
        clause_balance_ratio: 0.5,
        construction_type: "simple",
      },
      arc_role: "claim",
    },
    heat: 0,
  };
}

function makeProfile(sentences: ClassifiedSentence[]): StylometricProfile {
  return {
    word_count: sentences.reduce((sum, s) => sum + s.classification.metrics.word_count, 0),
    sentence_count: sentences.length,
    paragraph_count: new Set(sentences.map((s) => s.paragraph_id)).size,
    sentences,
    windows: [
      {
        size: "wide",
        start_sentence: 0,
        end_sentence: sentences.length - 1,
        word_count: 100,
        pattern_density: {} as StylometricProfile["windows"][0]["pattern_density"],
        biber_entropy: 1,
        length_entropy: 1,
        device_entropy: 1,
        sentence_length_autocorrelation: 0,
        co_occurrence: [],
        ttr: 0.8,
        hapax_ratio: 0.6,
        word_length_entropy: 2,
        opening_variety: 0.9,
        function_word_ratio: 0.4,
      },
    ],
    hot_regions: [],
    convergence_slope: 0,
    global_biber_entropy: 2,
    global_device_entropy: 2.5,
    global_sentence_length_autocorrelation: 0.2,
    mean_heat: 0,
    global_ttr: 0.8,
    global_mattr: 0.75,
    global_hapax_ratio: 0.6,
    global_word_length_entropy: 2,
    global_opening_variety: 0.9,
    global_function_word_ratio: 0.4,
  };
}

describe("scanOppositions", () => {
  test("maps sentence, paragraph, and section hits", () => {
    const sentences = [
      makeSentence(0, "Writing is not about volume but about precision.", 0, [
        { type: "binary_contrast", confidence: 0.9, evidence: "not about volume but" },
      ]),
      makeSentence(1, "Precision requires evidence.", 0),
      makeSentence(2, "It's not simply speed; it's clarity.", 1, [
        { type: "negation_reframe", confidence: 0.85, evidence: "not simply" },
      ]),
    ];
    const scan = scanOppositions(makeProfile(sentences));

    expect(scan.totalSentenceHits).toBe(2);
    expect(scan.sentences).toHaveLength(2);
    expect(scan.paragraphs).toHaveLength(2);
    expect(scan.sections).toHaveLength(1);
    expect(scan.sections[0]?.sentenceIds).toEqual([0, 2]);
  });

  test("ignores clause_symmetry without opposition language", () => {
    const sentences = [
      makeSentence(0, "Every claim becomes fundamental, crucial, and transformative.", 0, [
        { type: "clause_symmetry", confidence: 0.8, evidence: "fundamental, crucial" },
      ]),
    ];
    const scan = scanOppositions(makeProfile(sentences));
    expect(scan.totalSentenceHits).toBe(0);
  });
});

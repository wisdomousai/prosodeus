import { describe, expect, test } from "bun:test";
import {
  computeDensityViolations,
  isDensityViolation,
} from "../src/analysis/density-violations.ts";
import type { ClassifiedSentence, WindowMetrics } from "../src/types.ts";

function makeSentence(
  id: number,
  patterns: ClassifiedSentence["classification"]["patterns"],
): ClassifiedSentence {
  return {
    id,
    text: "We will delve into the landscape of synergy.",
    hash: `h${id}`,
    paragraph_id: 0,
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
        word_count: 8,
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

describe("density violations", () => {
  test("isDensityViolation respects hedging threshold", () => {
    expect(isDensityViolation("hedging", 2, 200, "general")).toBe(true);
    expect(isDensityViolation("hedging", 1, 200, "general")).toBe(false);
  });

  test("stricter genres lower hedging tolerance", () => {
    expect(isDensityViolation("hedging", 1, 200, "marketing")).toBe(true);
    expect(isDensityViolation("hedging", 1, 200, "general")).toBe(false);
  });

  test("computeDensityViolations flags over-threshold windows", () => {
    const sentences = [
      makeSentence(0, [{ type: "hedging", confidence: 1, evidence: "perhaps" }]),
      makeSentence(1, [{ type: "hedging", confidence: 1, evidence: "might" }]),
    ];
    const windows: WindowMetrics[] = [
      {
        size: "narrow",
        start_sentence: 0,
        end_sentence: 1,
        word_count: 200,
        pattern_density: {} as WindowMetrics["pattern_density"],
        biber_entropy: 0,
        length_entropy: 0,
        device_entropy: 0,
        sentence_length_autocorrelation: 0,
        co_occurrence: [],
        ttr: 0.8,
        hapax_ratio: 0.6,
        word_length_entropy: 2,
        opening_variety: 0.9,
        function_word_ratio: 0.4,
      },
    ];
    const violations = computeDensityViolations(
      windows,
      sentences,
      "general",
      new Set(["hedging"]),
    );
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]?.pattern_id).toBe("hedging");
  });
});

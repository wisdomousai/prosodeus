import { describe, expect, test } from "bun:test";
import {
  computeAutocorrelation,
  computeDeviceEntropy,
  countWords,
  shannonEntropy,
} from "../src/text/math.ts";
import type { ClassifiedSentence } from "../src/types.ts";

// ─── Helper ─────────────────────────────────────────────────────────────────

function makeSentence(
  id: number,
  text: string,
  patterns: ClassifiedSentence["classification"]["patterns"] = [],
): ClassifiedSentence {
  return {
    id,
    text,
    hash: `hash${id}`,
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
        word_count: text.split(/\s+/).length,
        clause_count: 1,
        has_participial: false,
        has_relative_clause: false,
        clause_balance_ratio: 0.5,
        construction_type: "simple",
      },
      arc_role: "claim",
    },
    heat: patterns.length,
  };
}

// ─── shannonEntropy ─────────────────────────────────────────────────────────

describe("shannonEntropy", () => {
  test("returns 0 for empty input", () => {
    expect(shannonEntropy([], 0)).toBe(0);
  });

  test("returns 0 for uniform distribution (single category)", () => {
    expect(shannonEntropy([10], 10)).toBe(0);
  });

  test("returns max entropy for equal distribution", () => {
    // 4 categories with equal counts: H = log2(4) = 2.0
    const result = shannonEntropy([25, 25, 25, 25], 100);
    expect(result).toBe(2);
  });

  test("returns intermediate value for skewed distribution", () => {
    const result = shannonEntropy([90, 10], 100);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1);
  });

  test("handles zero counts gracefully", () => {
    const result = shannonEntropy([50, 0, 50], 100);
    expect(result).toBe(1); // log2(2) = 1
  });
});

// ─── computeAutocorrelation ─────────────────────────────────────────────────

describe("computeAutocorrelation", () => {
  test("returns 0 for fewer than 3 values", () => {
    expect(computeAutocorrelation([])).toBe(0);
    expect(computeAutocorrelation([5])).toBe(0);
    expect(computeAutocorrelation([5, 10])).toBe(0);
  });

  test("returns 0 for constant values (zero variance)", () => {
    expect(computeAutocorrelation([5, 5, 5, 5, 5])).toBe(0);
  });

  test("returns high positive value for monotonic sequence", () => {
    // Alternating high/low should give negative autocorrelation
    // Constant increment should give positive
    const increasing = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = computeAutocorrelation(increasing);
    expect(result).toBeGreaterThan(0.5);
  });

  test("returns negative value for alternating pattern", () => {
    const alternating = [1, 10, 1, 10, 1, 10, 1, 10];
    const result = computeAutocorrelation(alternating);
    expect(result).toBeLessThan(-0.5);
  });
});

// ─── computeDeviceEntropy ───────────────────────────────────────────────────

describe("computeDeviceEntropy", () => {
  test("returns 0 for sentences with no patterns", () => {
    const sentences = [
      makeSentence(0, "Clean sentence here."),
      makeSentence(1, "Another clean one."),
    ];
    expect(computeDeviceEntropy(sentences)).toBe(0);
  });

  test("returns positive value for sentences with mixed patterns", () => {
    const sentences = [
      makeSentence(0, "The implementation of systems.", [
        { type: "nominalization", confidence: 0.9, evidence: "implementation" },
      ]),
      makeSentence(1, "While X is true, Y is false.", [
        { type: "binary_contrast", confidence: 0.8, evidence: "while X, Y" },
      ]),
      makeSentence(2, "Moreover, this adds complexity.", [
        { type: "transition_formulaic", confidence: 0.7, evidence: "Moreover" },
      ]),
    ];
    const result = computeDeviceEntropy(sentences);
    expect(result).toBeGreaterThan(0);
  });

  test("has higher entropy with more diverse patterns", () => {
    // All same pattern → lower entropy
    const uniform = [
      makeSentence(0, "a", [{ type: "nominalization", confidence: 0.9, evidence: "a" }]),
      makeSentence(1, "b", [{ type: "nominalization", confidence: 0.9, evidence: "b" }]),
      makeSentence(2, "c", [{ type: "nominalization", confidence: 0.9, evidence: "c" }]),
    ];
    // All different patterns → higher entropy
    const diverse = [
      makeSentence(0, "a", [{ type: "nominalization", confidence: 0.9, evidence: "a" }]),
      makeSentence(1, "b", [{ type: "binary_contrast", confidence: 0.9, evidence: "b" }]),
      makeSentence(2, "c", [{ type: "hedging", confidence: 0.9, evidence: "c" }]),
    ];
    expect(computeDeviceEntropy(diverse)).toBeGreaterThan(computeDeviceEntropy(uniform));
  });
});

// ─── countWords ─────────────────────────────────────────────────────────────

describe("countWords", () => {
  test("counts words in a simple string", () => {
    expect(countWords("hello world")).toBe(2);
  });

  test("handles extra whitespace", () => {
    expect(countWords("  hello   world  ")).toBe(2);
  });

  test("returns 0 for empty string", () => {
    expect(countWords("")).toBe(0);
  });

  test("returns 0 for whitespace-only string", () => {
    expect(countWords("   \t\n  ")).toBe(0);
  });

  test("counts single word", () => {
    expect(countWords("word")).toBe(1);
  });

  test("handles tabs and newlines", () => {
    expect(countWords("hello\tworld\nfoo")).toBe(3);
  });
});

import { describe, expect, test } from "bun:test";
import { buildNegativeConstraints, buildPositiveTargets } from "../src/rewrite/pce.ts";
import type { ClassifiedSentence, StylometricProfile } from "../src/types.ts";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeSentence(
  id: number,
  text: string,
  patterns: ClassifiedSentence["classification"]["patterns"] = [],
  heat = 0,
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
    heat,
  };
}

function makeProfile(overrides: Partial<StylometricProfile> = {}): StylometricProfile {
  return {
    word_count: 100,
    sentence_count: 5,
    paragraph_count: 1,
    sentences: [],
    windows: [],
    hot_regions: [],
    convergence_slope: 0,
    global_biber_entropy: 2.0,
    global_device_entropy: 2.5,
    global_sentence_length_autocorrelation: 0.2,
    mean_heat: 3,
    global_ttr: 0.8,
    global_mattr: 0.75,
    global_hapax_ratio: 0.6,
    global_word_length_entropy: 2.0,
    global_opening_variety: 0.9,
    global_function_word_ratio: 0.4,
    ...overrides,
  };
}

// ─── buildNegativeConstraints ───────────────────────────────────────────────

describe("buildNegativeConstraints", () => {
  test("returns strings for top patterns", () => {
    const sentences = [
      makeSentence(0, "The implementation of the system.", [
        { type: "nominalization", confidence: 0.9, evidence: "implementation" },
      ]),
      makeSentence(1, "Moreover, this is crucial.", [
        { type: "transition_formulaic", confidence: 0.8, evidence: "Moreover" },
        { type: "importance_inflation", confidence: 0.9, evidence: "crucial" },
      ]),
      makeSentence(2, "Another nominalization here.", [
        { type: "nominalization", confidence: 0.7, evidence: "nominalization" },
      ]),
    ];

    const constraints = buildNegativeConstraints(sentences);
    expect(constraints.length).toBeGreaterThan(0);
    expect(constraints.length).toBeLessThanOrEqual(8);
    // All should be strings
    for (const c of constraints) {
      expect(typeof c).toBe("string");
      expect(c.length).toBeGreaterThan(0);
    }
  });

  test("most frequent patterns appear first", () => {
    const sentences = [
      makeSentence(0, "a", [{ type: "nominalization", confidence: 0.9, evidence: "a" }]),
      makeSentence(1, "b", [{ type: "nominalization", confidence: 0.8, evidence: "b" }]),
      makeSentence(2, "c", [{ type: "nominalization", confidence: 0.7, evidence: "c" }]),
      makeSentence(3, "d", [{ type: "hedging", confidence: 0.6, evidence: "d" }]),
    ];
    const constraints = buildNegativeConstraints(sentences);
    // Nominalization (3 occurrences) should come before hedging (1)
    const nomIdx = constraints.findIndex((c) => c.includes("nominalize"));
    const hedgeIdx = constraints.findIndex((c) => c.includes("qualifier"));
    if (nomIdx >= 0 && hedgeIdx >= 0) {
      expect(nomIdx).toBeLessThan(hedgeIdx);
    }
  });

  test("returns empty array for no patterns", () => {
    const sentences = [makeSentence(0, "Clean sentence."), makeSentence(1, "Another clean one.")];
    const constraints = buildNegativeConstraints(sentences);
    expect(constraints).toEqual([]);
  });

  test("caps at 8 constraints max", () => {
    // Create sentences with many different pattern types
    const patternTypes = [
      "nominalization",
      "hedging",
      "importance_inflation",
      "transition_formulaic",
      "binary_contrast",
      "participial_cascade",
      "clause_symmetry",
      "that_subject",
      "em_dash_overuse",
      "llm_fingerprint_word",
    ] as const;
    const sentences = patternTypes.map((type, i) =>
      makeSentence(i, `sentence ${i}`, [{ type, confidence: 0.9, evidence: "test" }]),
    );
    const constraints = buildNegativeConstraints(sentences);
    expect(constraints.length).toBeLessThanOrEqual(8);
  });
});

// ─── buildPositiveTargets ───────────────────────────────────────────────────

describe("buildPositiveTargets", () => {
  test("returns targets when autocorrelation is high", () => {
    const profile = makeProfile({ global_sentence_length_autocorrelation: 0.4 });
    const targets = buildPositiveTargets(profile);
    expect(targets.some((t) => t.includes("sentence length"))).toBe(true);
  });

  test("returns targets when device entropy is low", () => {
    const profile = makeProfile({ global_device_entropy: 1.5 });
    const targets = buildPositiveTargets(profile);
    expect(targets.some((t) => t.includes("rhetorical"))).toBe(true);
  });

  test("returns targets when convergence is decaying", () => {
    const profile = makeProfile({ convergence_slope: -0.1 });
    const targets = buildPositiveTargets(profile);
    expect(targets.some((t) => t.includes("variety"))).toBe(true);
  });

  test("returns empty when all metrics are healthy", () => {
    const profile = makeProfile({
      global_sentence_length_autocorrelation: 0.1,
      global_device_entropy: 3.0,
      convergence_slope: 0.01,
    });
    const targets = buildPositiveTargets(profile);
    expect(targets).toEqual([]);
  });

  test("includes style guide targets when style name provided", () => {
    const profile = makeProfile({ global_sentence_length_autocorrelation: 0.4 });
    const targets = buildPositiveTargets(profile, "general");
    expect(targets.some((t) => t.includes("std dev"))).toBe(true);
    expect(targets.some((t) => t.includes("device entropy"))).toBe(true);
  });

  test("ignores invalid style name", () => {
    const profile = makeProfile({
      global_sentence_length_autocorrelation: 0.1,
      global_device_entropy: 3.0,
      convergence_slope: 0.01,
    });
    const targets = buildPositiveTargets(profile, "nonexistent-guide");
    // Should still work without crashing, just no guide-specific targets
    expect(Array.isArray(targets)).toBe(true);
  });
});

import { describe, expect, test } from "bun:test";
import {
  classifyModelTier,
  estimateCost,
  estimateTokens,
  getModelCost,
  planInterventions,
} from "../src/models/routing.ts";
import type { ClassifiedSentence, StylometricProfile } from "../src/types.ts";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeSentence(
  id: number,
  text: string,
  heat = 0,
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
    heat,
  };
}

function makeProfile(
  sentences: ClassifiedSentence[],
  overrides: Partial<StylometricProfile> = {},
): StylometricProfile {
  return {
    word_count: sentences.reduce((sum, s) => sum + s.classification.metrics.word_count, 0),
    sentence_count: sentences.length,
    paragraph_count: 1,
    sentences,
    windows: [],
    hot_regions: [],
    convergence_slope: 0,
    global_biber_entropy: 2.0,
    global_device_entropy: 2.5,
    global_sentence_length_autocorrelation: 0.2,
    mean_heat:
      sentences.length > 0 ? sentences.reduce((sum, s) => sum + s.heat, 0) / sentences.length : 0,
    global_ttr: 0.8,
    global_mattr: 0.75,
    global_hapax_ratio: 0.6,
    global_word_length_entropy: 2.0,
    global_opening_variety: 0.9,
    global_function_word_ratio: 0.4,
    ...overrides,
  };
}

// ─── classifyModelTier ──────────────────────────────────────────────────────

describe("classifyModelTier", () => {
  test("classifies gemma as cheap", () => {
    expect(classifyModelTier("google/gemma-3-1b-it")).toBe("cheap");
  });

  test("classifies qwen as cheap", () => {
    expect(classifyModelTier("qwen/qwen3-32b")).toBe("cheap");
  });

  test("classifies haiku as mid", () => {
    expect(classifyModelTier("claude-haiku-4-5-20251001")).toBe("mid");
  });

  test("classifies gpt-4o-mini as mid", () => {
    expect(classifyModelTier("gpt-4o-mini")).toBe("mid");
  });

  test("classifies opus as expensive", () => {
    expect(classifyModelTier("claude-opus-4-6")).toBe("expensive");
  });

  test("classifies unknown model as expensive (default)", () => {
    expect(classifyModelTier("some-unknown-model")).toBe("expensive");
  });
});

// ─── estimateTokens ─────────────────────────────────────────────────────────

describe("estimateTokens", () => {
  test("estimates ~4 chars per token", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcdefgh")).toBe(2);
  });

  test("rounds up partial tokens", () => {
    expect(estimateTokens("abc")).toBe(1); // 3/4 = 0.75, ceil = 1
  });

  test("returns 0 for empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });
});

// ─── estimateCost ───────────────────────────────────────────────────────────

describe("estimateCost", () => {
  test("computes cost for known model", () => {
    // gemma-3-1b: input $0.04/M, output $0.08/M
    const cost = estimateCost(1_000_000, 1_000_000, "google/gemma-3-1b-it");
    expect(cost).toBeCloseTo(0.04 + 0.08, 4);
  });

  test("uses tier defaults for unknown model", () => {
    // Unknown → expensive tier: input $3.00/M, output $15.00/M
    const cost = estimateCost(1_000_000, 1_000_000, "unknown-model-xyz");
    expect(cost).toBeCloseTo(3.0 + 15.0, 4);
  });

  test("returns 0 for 0 tokens", () => {
    expect(estimateCost(0, 0, "gpt-4o")).toBe(0);
  });
});

// ─── getModelCost ───────────────────────────────────────────────────────────

describe("getModelCost", () => {
  test("returns exact match cost", () => {
    const cost = getModelCost("gpt-4o");
    expect(cost.input_per_million).toBe(2.5);
    expect(cost.output_per_million).toBe(10.0);
  });

  test("falls back to tier default for unknown model", () => {
    const cost = getModelCost("totally-unknown");
    // expensive tier default
    expect(cost.input_per_million).toBe(3.0);
    expect(cost.output_per_million).toBe(15.0);
  });
});

// ─── planInterventions ──────────────────────────────────────────────────────

describe("planInterventions", () => {
  test("returns empty plan for no hot regions", () => {
    const sentences = [makeSentence(0, "Clean sentence."), makeSentence(1, "Another clean one.")];
    const profile = makeProfile(sentences, { hot_regions: [] });

    const report = planInterventions(profile, "gpt-4o");
    expect(report.interventions).toEqual([]);
    expect(report.total_tokens).toBe(0);
    expect(report.total_cost).toBe(0);
    expect(report.strategy).toBe("impact_per_dollar");
  });

  test("creates interventions for hot regions sorted by efficiency", () => {
    const sentences = [
      makeSentence(
        0,
        "The fundamental implementation of the system stands as testament to innovation.",
        7,
      ),
      makeSentence(1, "While the system processes data, the framework establishes patterns.", 6),
      makeSentence(2, "Clean sentence at the end.", 1),
    ];
    const profile = makeProfile(sentences, {
      hot_regions: [
        {
          start_sentence: 0,
          end_sentence: 0,
          heat: 7,
          primary_patterns: ["nominalization"],
          description: "Inflation",
        },
        {
          start_sentence: 1,
          end_sentence: 1,
          heat: 6,
          primary_patterns: ["binary_contrast"],
          description: "Contrast",
        },
      ],
    });

    const report = planInterventions(profile, "gpt-4o");
    expect(report.interventions.length).toBe(2);
    expect(report.total_tokens).toBeGreaterThan(0);
    expect(report.total_cost).toBeGreaterThan(0);
    // Sorted by efficiency descending
    expect(report.interventions[0]!.efficiency).toBeGreaterThanOrEqual(
      report.interventions[1]!.efficiency,
    );
  });

  test("respects budget constraint", () => {
    const sentences = [makeSentence(0, "A".repeat(200), 8), makeSentence(1, "B".repeat(200), 7)];
    const profile = makeProfile(sentences, {
      hot_regions: [
        {
          start_sentence: 0,
          end_sentence: 0,
          heat: 8,
          primary_patterns: ["nominalization"],
          description: "Region 1",
        },
        {
          start_sentence: 1,
          end_sentence: 1,
          heat: 7,
          primary_patterns: ["hedging"],
          description: "Region 2",
        },
      ],
    });

    // Very tiny budget should exclude some interventions
    const report = planInterventions(profile, "claude-opus-4-6", 0.000001);
    expect(report.interventions.length).toBeLessThan(2);
  });
});

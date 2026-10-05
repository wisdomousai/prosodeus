import { describe, expect, test } from "bun:test";
import { reverseEngineerGuide } from "../src/analysis/style-guide.ts";
import type { ClassifiedSentence } from "../src/types.ts";

// ─── Helper ─────────────────────────────────────────────────────────────────

function makeSentence(
  id: number,
  text: string,
  overrides: {
    patterns?: ClassifiedSentence["classification"]["patterns"];
    metrics?: Partial<ClassifiedSentence["classification"]["metrics"]>;
    biber?: Partial<ClassifiedSentence["classification"]["biber"]>;
    arc_role?: string;
  } = {},
): ClassifiedSentence {
  return {
    id,
    text,
    hash: `hash${id}`,
    paragraph_id: Math.floor(id / 3),
    classification: {
      biber: {
        informational: 0.5,
        involved: 0.2,
        narrative: 0.1,
        persuasive: 0.1,
        abstract: 0.05,
        elaborative: 0.05,
        ...overrides.biber,
      },
      patterns: overrides.patterns ?? [],
      metrics: {
        word_count: text.split(/\s+/).length,
        clause_count: 1,
        has_participial: false,
        has_relative_clause: false,
        clause_balance_ratio: 0.5,
        construction_type: "simple",
        ...overrides.metrics,
      },
      arc_role: overrides.arc_role ?? "claim",
    },
    heat: (overrides.patterns ?? []).length,
  };
}

// ─── reverseEngineerGuide ───────────────────────────────────────────────────

describe("reverseEngineerGuide", () => {
  const sampleSentences: ClassifiedSentence[] = [
    makeSentence(0, "The quick brown fox jumps over the lazy dog.", {
      patterns: [{ type: "hedging", confidence: 0.5, evidence: "quick" }],
      metrics: {
        word_count: 9,
        clause_count: 1,
        clause_balance_ratio: 0.5,
        has_participial: false,
      },
    }),
    makeSentence(1, "While the rain fell softly, she walked through the garden.", {
      patterns: [{ type: "binary_contrast", confidence: 0.7, evidence: "while..., she" }],
      metrics: {
        word_count: 10,
        clause_count: 2,
        clause_balance_ratio: 0.6,
        has_participial: false,
      },
    }),
    makeSentence(2, "Innovation drives progress.", {
      patterns: [{ type: "nominalization", confidence: 0.8, evidence: "innovation" }],
      metrics: {
        word_count: 3,
        clause_count: 1,
        clause_balance_ratio: 0.5,
        has_participial: false,
      },
    }),
    makeSentence(
      3,
      "The implementation of modern systems requires careful consideration of multiple factors.",
      {
        patterns: [
          { type: "nominalization", confidence: 0.9, evidence: "implementation" },
          { type: "nominalization", confidence: 0.7, evidence: "consideration" },
        ],
        metrics: {
          word_count: 11,
          clause_count: 1,
          clause_balance_ratio: 0.5,
          has_participial: false,
        },
      },
    ),
    makeSentence(4, "Having analyzed the data, the researchers published their findings.", {
      patterns: [{ type: "participial_cascade", confidence: 0.8, evidence: "Having analyzed" }],
      metrics: {
        word_count: 10,
        clause_count: 2,
        clause_balance_ratio: 0.7,
        has_participial: true,
      },
    }),
  ];

  test("produces a valid StyleGuide", () => {
    const guide = reverseEngineerGuide("test-guide", "A test guide", sampleSentences);
    expect(guide.name).toBe("test-guide");
    expect(guide.description).toBe("A test guide");
    expect(guide.continuity_parameter).toBe(0.5);
  });

  test("all 11 target dimensions are populated", () => {
    const guide = reverseEngineerGuide("test", "test", sampleSentences);
    const t = guide.targets;

    expect(t.sentence_length).toBeDefined();
    expect(t.sentence_length.mean).toBeGreaterThan(0);
    expect(t.sentence_length.std_dev).toBeGreaterThanOrEqual(0);
    expect(t.sentence_length.min).toBeGreaterThanOrEqual(1);
    expect(t.sentence_length.max).toBeGreaterThan(t.sentence_length.min);

    expect(t.nominalization_ratio).toBeDefined();
    expect(t.nominalization_ratio.max).toBeGreaterThanOrEqual(0);

    expect(t.participial_density).toBeDefined();
    expect(t.participial_density.max).toBeGreaterThanOrEqual(0);

    expect(t.clause_symmetry).toBeDefined();
    expect(t.clause_symmetry.max_balance).toBeGreaterThan(0);
    expect(t.clause_symmetry.max_balance).toBeLessThanOrEqual(1);

    expect(t.paragraph_arc_diversity).toBeDefined();
    expect(t.paragraph_arc_diversity.max_consecutive_same).toBeGreaterThanOrEqual(1);

    expect(t.resolution_completeness).toBeDefined();
    expect(t.resolution_completeness.target).toBeGreaterThanOrEqual(0);
    expect(t.resolution_completeness.target).toBeLessThanOrEqual(1);

    expect(t.binary_contrast_frequency).toBeDefined();
    expect(t.binary_contrast_frequency.per_1000_words.max).toBeGreaterThanOrEqual(
      t.binary_contrast_frequency.per_1000_words.min,
    );

    expect(t.sentence_length_autocorrelation).toBeDefined();
    expect(t.sentence_length_autocorrelation.max_rho).toBeGreaterThan(0);

    expect(t.device_entropy).toBeDefined();
    expect(t.device_entropy.min).toBeGreaterThanOrEqual(0);

    expect(t.importance_inflation).toBeDefined();
    expect(t.importance_inflation.max).toBeGreaterThanOrEqual(0);

    expect(t.transition_formulaicness).toBeDefined();
    expect(t.transition_formulaicness.max_ratio).toBeGreaterThanOrEqual(0);
  });

  test("sentence length targets reflect input text", () => {
    const guide = reverseEngineerGuide("test", "test", sampleSentences);
    // Mean word count of sample: (9+10+3+11+10)/5 = 8.6
    expect(guide.targets.sentence_length.mean).toBeGreaterThanOrEqual(5);
    expect(guide.targets.sentence_length.mean).toBeLessThanOrEqual(15);
  });

  test("participial density reflects input", () => {
    const guide = reverseEngineerGuide("test", "test", sampleSentences);
    // 1 out of 5 sentences has participial → 0.2
    expect(guide.targets.participial_density.max).toBe(0.2);
  });

  test("handles empty sentences gracefully", () => {
    const guide = reverseEngineerGuide("empty", "empty guide", []);
    expect(guide.name).toBe("empty");
    // Should use defaults, not crash
    expect(guide.targets.sentence_length.mean).toBe(16); // default
    expect(guide.targets.sentence_length.std_dev).toBe(8); // default
  });
});

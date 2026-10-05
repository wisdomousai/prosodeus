import { describe, expect, test } from "bun:test";
import { generateConstraints } from "../src/rewrite/constraints.ts";
import type { ClassifiedSentence, StylometricProfile } from "../src/types.ts";

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

describe("generateConstraints", () => {
  test("produces a ConstraintDocument with all fields", () => {
    const sentences = [
      makeSentence(0, "First sentence here."),
      makeSentence(1, "Second sentence here."),
    ];
    const profile = makeProfile(sentences);
    const doc = generateConstraints(profile);

    expect(doc.passage).toBe("First sentence here. Second sentence here.");
    expect(doc.diagnosis).toBeDefined();
    expect(doc.diagnosis.mean_heat).toBe(profile.mean_heat);
    expect(doc.constraints).toBeDefined();
    expect(doc.instruction).toContain("Rewrite the following passage");
    expect(doc.instruction).toContain("PASSAGE:");
  });

  test("includes hot patterns in avoid list", () => {
    const sentences = [
      makeSentence(
        0,
        "The implementation of the system.",
        [{ type: "nominalization", confidence: 0.9, evidence: "implementation" }],
        5,
      ),
      makeSentence(
        1,
        "Moreover, this furthermore adds complexity.",
        [
          { type: "transition_formulaic", confidence: 0.8, evidence: "Moreover" },
          { type: "nominalization", confidence: 0.7, evidence: "complexity" },
        ],
        6,
      ),
    ];
    const profile = makeProfile(sentences);
    const doc = generateConstraints(profile);

    expect(doc.diagnosis.hot_patterns).toContain("nominalization");
    expect(doc.constraints.avoid.length).toBeGreaterThan(0);
    expect(doc.constraints.avoid.some((a) => a.includes("Nominalization"))).toBe(true);
  });

  test("includes style guide violations in target list", () => {
    const sentences = [makeSentence(0, "Some text."), makeSentence(1, "More text.")];
    const profile = makeProfile(sentences, {
      delta: {
        guide: "general",
        violations: [
          {
            dimension: "device_entropy",
            current: 1.5,
            target: 2.5,
            severity: "high",
          },
        ],
        overall_distance: 0.5,
      },
    });
    const doc = generateConstraints(profile);

    expect(doc.constraints.target.length).toBeGreaterThan(0);
    expect(doc.constraints.style_guide).toBe("general");
    expect(doc.instruction).toContain("STYLE GUIDE: general");
  });

  test("adds structural targets for high autocorrelation", () => {
    const sentences = [makeSentence(0, "First."), makeSentence(1, "Second.")];
    const profile = makeProfile(sentences, {
      global_sentence_length_autocorrelation: 0.5,
    });
    const doc = generateConstraints(profile);

    expect(doc.constraints.target.some((t) => t.includes("sentence length"))).toBe(true);
  });

  test("adds structural targets for low device entropy", () => {
    const sentences = [makeSentence(0, "First."), makeSentence(1, "Second.")];
    const profile = makeProfile(sentences, {
      global_device_entropy: 1.5,
    });
    const doc = generateConstraints(profile);

    expect(doc.constraints.target.some((t) => t.includes("rhetorical variety"))).toBe(true);
  });

  test("adds structural targets for entropy decay", () => {
    const sentences = [makeSentence(0, "First."), makeSentence(1, "Second.")];
    const profile = makeProfile(sentences, {
      convergence_slope: -0.2,
    });
    const doc = generateConstraints(profile);

    expect(doc.constraints.target.some((t) => t.includes("entropy decay"))).toBe(true);
  });

  test("respects passage range", () => {
    const sentences = [
      makeSentence(0, "First."),
      makeSentence(1, "Second."),
      makeSentence(2, "Third."),
      makeSentence(3, "Fourth."),
    ];
    const profile = makeProfile(sentences);
    const doc = generateConstraints(profile, { start: 1, end: 2 });

    expect(doc.passage).toBe("Second. Third.");
    expect(doc.instruction).toContain("Second. Third.");
    expect(doc.instruction).not.toContain("First.");
  });

  test("handles empty pattern list gracefully", () => {
    const sentences = [makeSentence(0, "Clean sentence."), makeSentence(1, "Another clean one.")];
    const profile = makeProfile(sentences);
    const doc = generateConstraints(profile);

    expect(doc.diagnosis.hot_patterns).toEqual([]);
    expect(doc.constraints.avoid).toEqual([]);
  });

  test("instruction contains STRUCTURAL CONSTRAINTS header", () => {
    const sentences = [
      makeSentence(
        0,
        "The implementation stands as testament.",
        [
          { type: "nominalization", confidence: 0.9, evidence: "implementation" },
          { type: "importance_inflation", confidence: 0.8, evidence: "stands as testament" },
        ],
        7,
      ),
    ];
    const profile = makeProfile(sentences);
    const doc = generateConstraints(profile);

    expect(doc.instruction).toContain("STRUCTURAL CONSTRAINTS:");
    expect(doc.instruction).toContain("AVOID:");
    expect(doc.instruction).toContain("Preserve all factual content exactly");
  });

  test("playbook mode includes banned vocabulary and platform note", () => {
    const sentences = [
      makeSentence(0, "We will delve into synergy.", [
        { type: "llm_fingerprint_word", confidence: 0.9, evidence: "delve" },
      ]),
    ];
    const profile = makeProfile(sentences);
    const doc = generateConstraints(profile, undefined, {
      playbookId: "anti-slop-copy",
      platform: "linkedin",
    });

    expect(doc.instruction).toContain("BANNED VOCABULARY");
    expect(doc.instruction).toContain("delve");
    expect(doc.instruction).toContain("PLATFORM (LinkedIn)");
    expect(doc.instruction).toContain("Write the following passage");
  });

  test("playbook mode includes voice block when voiceDna provided", () => {
    const profile = makeProfile([makeSentence(0, "Sample copy.")]);
    const doc = generateConstraints(profile, undefined, {
      playbookId: "anti-slop-copy",
      voiceDna: "Direct, first-person, no corporate filler.",
    });
    expect(doc.instruction).toContain("VOICE:");
    expect(doc.instruction).toContain("first-person");
  });

  test("playbook mode includes lexicon swaps when provided", () => {
    const profile = makeProfile([makeSentence(0, "We leverage synergy.")]);
    const doc = generateConstraints(profile, undefined, {
      playbookId: "anti-slop-copy",
      lexiconSwaps: ['"leverage" → use'],
    });
    expect(doc.instruction).toContain("LEXICON SWAPS:");
    expect(doc.instruction).toContain("leverage");
  });
});

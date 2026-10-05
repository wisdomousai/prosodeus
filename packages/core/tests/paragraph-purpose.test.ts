import { describe, expect, test } from "bun:test";
import type { ParagraphPurpose } from "../src/analysis/paragraph-purpose.ts";
import { classifyParagraphs, getPurposeTargets } from "../src/analysis/paragraph-purpose.ts";
import type { ClassifiedSentence } from "../src/types.ts";

// ─── Helper ─────────────────────────────────────────────────────────────────

function makeSentence(
  id: number,
  paragraphId: number,
  overrides: {
    biber?: Partial<ClassifiedSentence["classification"]["biber"]>;
    arc_role?: string;
    patterns?: ClassifiedSentence["classification"]["patterns"];
  } = {},
): ClassifiedSentence {
  return {
    id,
    text: `Sentence ${id} text.`,
    hash: `hash${id}`,
    paragraph_id: paragraphId,
    classification: {
      biber: {
        informational: 0.3,
        involved: 0.1,
        narrative: 0.1,
        persuasive: 0.1,
        abstract: 0.1,
        elaborative: 0.1,
        ...overrides.biber,
      },
      patterns: overrides.patterns ?? [],
      metrics: {
        word_count: 10,
        clause_count: 1,
        has_participial: false,
        has_relative_clause: false,
        clause_balance_ratio: 0.5,
        construction_type: "simple",
      },
      arc_role: overrides.arc_role ?? "claim",
    },
    heat: 2,
  };
}

// ─── classifyParagraphs ─────────────────────────────────────────────────────

describe("classifyParagraphs", () => {
  test("groups sentences by paragraph_id", () => {
    const sentences = [
      makeSentence(0, 0),
      makeSentence(1, 0),
      makeSentence(2, 1),
      makeSentence(3, 1),
      makeSentence(4, 1),
    ];
    const result = classifyParagraphs(sentences);
    expect(result.length).toBe(2);
    expect(result[0]!.paragraph_id).toBe(0);
    expect(result[0]!.sentence_count).toBe(2);
    expect(result[1]!.paragraph_id).toBe(1);
    expect(result[1]!.sentence_count).toBe(3);
  });

  test("returns sorted by paragraph_id", () => {
    const sentences = [makeSentence(3, 2), makeSentence(0, 0), makeSentence(1, 1)];
    const result = classifyParagraphs(sentences);
    expect(result.map((r) => r.paragraph_id)).toEqual([0, 1, 2]);
  });

  test("assigns a purpose and confidence to each paragraph", () => {
    const sentences = [makeSentence(0, 0), makeSentence(1, 0)];
    const result = classifyParagraphs(sentences);
    expect(result[0]!.purpose).toBeDefined();
    expect(result[0]!.confidence).toBeGreaterThanOrEqual(0);
    expect(result[0]!.confidence).toBeLessThanOrEqual(1);
  });

  test("classifies high-narrative biber as narrative", () => {
    const sentences = [
      makeSentence(0, 0, { biber: { narrative: 0.9, involved: 0.5 }, arc_role: "elaboration" }),
      makeSentence(1, 0, { biber: { narrative: 0.8, involved: 0.4 }, arc_role: "elaboration" }),
      makeSentence(2, 0, { biber: { narrative: 0.85 }, arc_role: "elaboration" }),
    ];
    const result = classifyParagraphs(sentences);
    expect(result[0]!.purpose).toBe("narrative");
  });

  test("classifies high-persuasive biber as argumentative", () => {
    const sentences = [
      makeSentence(0, 0, { biber: { persuasive: 0.9 }, arc_role: "claim" }),
      makeSentence(1, 0, { biber: { persuasive: 0.85 }, arc_role: "evidence" }),
      makeSentence(2, 0, { biber: { persuasive: 0.8 }, arc_role: "claim" }),
    ];
    const result = classifyParagraphs(sentences);
    expect(result[0]!.purpose).toBe("argumentative");
  });

  test("classifies short paragraph with transition arcs as transitional", () => {
    const sentences = [makeSentence(0, 0, { arc_role: "transition" })];
    const result = classifyParagraphs(sentences);
    expect(result[0]!.purpose).toBe("transitional");
  });

  test("includes targets from PURPOSE_TARGETS for each paragraph", () => {
    const sentences = [makeSentence(0, 0)];
    const result = classifyParagraphs(sentences);
    const targets = result[0]!.targets;
    expect(targets.device_entropy).toBeDefined();
    expect(targets.length_std_dev).toBeDefined();
    expect(targets.max_autocorrelation).toBeDefined();
    expect(typeof targets.expects_resolution).toBe("boolean");
  });
});

// ─── getPurposeTargets ──────────────────────────────────────────────────────

describe("getPurposeTargets", () => {
  const purposes: ParagraphPurpose[] = [
    "analytical",
    "narrative",
    "argumentative",
    "transitional",
    "summary",
    "example",
    "definition",
  ];

  for (const purpose of purposes) {
    test(`returns targets for ${purpose}`, () => {
      const targets = getPurposeTargets(purpose);
      expect(targets.device_entropy.min).toBeGreaterThanOrEqual(0);
      expect(targets.device_entropy.max).toBeGreaterThan(targets.device_entropy.min);
      expect(targets.length_std_dev.min).toBeGreaterThanOrEqual(0);
      expect(targets.max_autocorrelation).toBeGreaterThan(0);
      expect(typeof targets.expects_resolution).toBe("boolean");
    });
  }

  test("narrative allows higher autocorrelation than analytical", () => {
    const narrative = getPurposeTargets("narrative");
    const analytical = getPurposeTargets("analytical");
    expect(narrative.max_autocorrelation).toBeGreaterThan(analytical.max_autocorrelation);
  });

  test("argumentative expects resolution", () => {
    expect(getPurposeTargets("argumentative").expects_resolution).toBe(true);
  });

  test("narrative does not expect resolution", () => {
    expect(getPurposeTargets("narrative").expects_resolution).toBe(false);
  });
});

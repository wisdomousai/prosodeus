import { describe, expect, test } from "bun:test";
import type { LanguageModel } from "ai";
import { computeHeat, LLMClassifier } from "../src/classification/classifier.ts";
import type { SentenceClassification } from "../src/types.ts";

// ─── parseResponse tests (no API calls) ──────────────────────────────────────

// Dummy LanguageModel — parseResponse never calls the model
const dummyModel = { modelId: "test", provider: "test" } as unknown as LanguageModel;
const classifier = new LLMClassifier(dummyModel);

describe("parseResponse", () => {
  test("parses clean JSON array", () => {
    const raw = JSON.stringify([
      {
        biber: {
          informational: 0.8,
          involved: 0.1,
          narrative: 0.2,
          persuasive: 0.3,
          abstract: 0.5,
          elaborative: 0.3,
        },
        patterns: [{ type: "nominalization", confidence: 0.9, evidence: "implementation" }],
        metrics: {
          word_count: 15,
          clause_count: 2,
          has_participial: false,
          has_relative_clause: false,
          clause_balance_ratio: 0.6,
          construction_type: "complex",
        },
        arc_role: "claim",
      },
    ]);
    const result = classifier.parseResponse(raw, 1);
    expect(result).toHaveLength(1);
    expect(result[0]!.biber.informational).toBe(0.8);
    expect(result[0]!.patterns[0]!.type).toBe("nominalization");
  });

  test("strips markdown fences", () => {
    const raw =
      '```json\n[{"biber":{"informational":0.5,"involved":0,"narrative":0,"persuasive":0,"abstract":0,"elaborative":0},"patterns":[],"metrics":{"word_count":5,"clause_count":1,"has_participial":false,"has_relative_clause":false,"clause_balance_ratio":0.5,"construction_type":"simple"},"arc_role":"claim"}]\n```';
    const result = classifier.parseResponse(raw, 1);
    expect(result).toHaveLength(1);
    expect(result[0]!.biber.informational).toBe(0.5);
  });

  test("extracts JSON array from surrounding text", () => {
    const raw =
      'Here is the classification:\n[{"biber":{"informational":0.3,"involved":0,"narrative":0,"persuasive":0,"abstract":0,"elaborative":0},"patterns":[],"metrics":{"word_count":5,"clause_count":1,"has_participial":false,"has_relative_clause":false,"clause_balance_ratio":0.5,"construction_type":"simple"},"arc_role":"claim"}]\nDone!';
    const result = classifier.parseResponse(raw, 1);
    expect(result).toHaveLength(1);
  });

  test("handles {results: [...]} wrapper", () => {
    const raw =
      '{"results":[{"biber":{"informational":0.6,"involved":0,"narrative":0,"persuasive":0,"abstract":0,"elaborative":0},"patterns":[],"metrics":{"word_count":8,"clause_count":1,"has_participial":false,"has_relative_clause":false,"clause_balance_ratio":0.5,"construction_type":"simple"},"arc_role":"evidence"}]}';
    const result = classifier.parseResponse(raw, 1);
    expect(result).toHaveLength(1);
    expect(result[0]!.arc_role).toBe("evidence");
  });

  test("fills defaults for missing fields", () => {
    const raw = '{"results":[{"biber":{}}]}';
    const result = classifier.parseResponse(raw, 1);
    expect(result[0]!.biber.informational).toBe(0);
    expect(result[0]!.patterns).toEqual([]);
    expect(result[0]!.metrics.construction_type).toBe("simple");
  });

  test("clamps values to 0-1 range", () => {
    const raw =
      '[{"biber":{"informational":1.5,"involved":-0.2,"narrative":0,"persuasive":0,"abstract":0,"elaborative":0},"patterns":[],"metrics":{"word_count":5,"clause_count":1,"has_participial":false,"has_relative_clause":false,"clause_balance_ratio":1.5,"construction_type":"simple"},"arc_role":"claim"}]';
    const result = classifier.parseResponse(raw, 1);
    expect(result[0]!.biber.informational).toBe(1);
    expect(result[0]!.biber.involved).toBe(0);
    expect(result[0]!.metrics.clause_balance_ratio).toBe(1);
  });

  test("throws on completely invalid input", () => {
    expect(() => classifier.parseResponse("not json at all", 1)).toThrow();
  });

  test("truncates results to expected count", () => {
    const items = Array(5).fill({
      biber: {
        informational: 0,
        involved: 0,
        narrative: 0,
        persuasive: 0,
        abstract: 0,
        elaborative: 0,
      },
      patterns: [],
      metrics: {
        word_count: 5,
        clause_count: 1,
        has_participial: false,
        has_relative_clause: false,
        clause_balance_ratio: 0.5,
        construction_type: "simple",
      },
      arc_role: "claim",
    });
    const raw = JSON.stringify(items);
    const result = classifier.parseResponse(raw, 3);
    expect(result).toHaveLength(3);
  });

  test("pads results when fewer than expected", () => {
    const raw = '[{"biber":{},"patterns":[],"metrics":{},"arc_role":"claim"}]';
    const result = classifier.parseResponse(raw, 3);
    expect(result).toHaveLength(3);
    // Padded entries should have defaults
    expect(result[2]!.biber.informational).toBe(0);
  });

  test("normalizes pattern string arrays", () => {
    const raw =
      '[{"biber":{},"patterns":["nominalization","hedging"],"metrics":{},"arc_role":"claim"}]';
    const result = classifier.parseResponse(raw, 1);
    expect(result[0]!.patterns).toHaveLength(2);
    expect(result[0]!.patterns[0]!.type).toBe("nominalization");
    expect(result[0]!.patterns[0]!.confidence).toBe(0.8);
  });

  test("normalizes pattern object map (Qwen 3 style)", () => {
    const raw =
      '[{"biber":{},"patterns":{"hedging":"perhaps","nominalization":"implementation"},"metrics":{},"arc_role":"claim"}]';
    const result = classifier.parseResponse(raw, 1);
    expect(result[0]!.patterns).toHaveLength(2);
    const types = result[0]!.patterns.map((p) => p.type).sort();
    expect(types).toEqual(["hedging", "nominalization"]);
  });

  test("filters out invalid pattern types", () => {
    const raw =
      '[{"biber":{},"patterns":[{"type":"fake_pattern","confidence":0.9,"evidence":"x"},{"type":"hedging","confidence":0.7,"evidence":"y"}],"metrics":{},"arc_role":"claim"}]';
    const result = classifier.parseResponse(raw, 1);
    expect(result[0]!.patterns).toHaveLength(1);
    expect(result[0]!.patterns[0]!.type).toBe("hedging");
  });

  test("handles <think> blocks from Qwen 3", () => {
    const raw =
      '<think>Let me analyze this sentence...</think>\n[{"biber":{"informational":0.5},"patterns":[],"metrics":{"word_count":5},"arc_role":"claim"}]';
    const result = classifier.parseResponse(raw, 1);
    expect(result).toHaveLength(1);
    expect(result[0]!.biber.informational).toBe(0.5);
  });
});

// ─── computeHeat tests ──────────────────────────────────────────────────────

describe("computeHeat", () => {
  test("returns 0 for clean sentence", () => {
    const classification: SentenceClassification = {
      biber: {
        informational: 0.5,
        involved: 0.3,
        narrative: 0,
        persuasive: 0,
        abstract: 0,
        elaborative: 0,
      },
      patterns: [],
      metrics: {
        word_count: 10,
        clause_count: 1,
        has_participial: false,
        has_relative_clause: false,
        clause_balance_ratio: 0.5,
        construction_type: "simple",
      },
      arc_role: "claim",
    };
    expect(computeHeat(classification)).toBe(0);
  });

  test("increases heat with detected patterns", () => {
    const classification: SentenceClassification = {
      biber: {
        informational: 0.8,
        involved: 0,
        narrative: 0,
        persuasive: 0,
        abstract: 0.6,
        elaborative: 0,
      },
      patterns: [
        { type: "nominalization", confidence: 0.9, evidence: "implementation" },
        { type: "binary_contrast", confidence: 0.8, evidence: "while X, Y" },
      ],
      metrics: {
        word_count: 20,
        clause_count: 2,
        has_participial: false,
        has_relative_clause: false,
        clause_balance_ratio: 0.5,
        construction_type: "complex",
      },
      arc_role: "claim",
    };
    const heat = computeHeat(classification);
    expect(heat).toBeGreaterThan(0);
    expect(heat).toBeLessThanOrEqual(10);
  });

  test("penalizes high clause symmetry", () => {
    const balanced: SentenceClassification = {
      biber: {
        informational: 0.5,
        involved: 0,
        narrative: 0,
        persuasive: 0,
        abstract: 0,
        elaborative: 0,
      },
      patterns: [],
      metrics: {
        word_count: 20,
        clause_count: 2,
        has_participial: false,
        has_relative_clause: false,
        clause_balance_ratio: 0.95,
        construction_type: "compound",
      },
      arc_role: "claim",
    };
    const unbalanced: SentenceClassification = {
      ...balanced,
      metrics: { ...balanced.metrics, clause_balance_ratio: 0.4 },
    };
    expect(computeHeat(balanced)).toBeGreaterThan(computeHeat(unbalanced));
  });

  test("importance_inflation has highest weight", () => {
    const withInflation: SentenceClassification = {
      biber: {
        informational: 0,
        involved: 0,
        narrative: 0,
        persuasive: 0,
        abstract: 0,
        elaborative: 0,
      },
      patterns: [
        { type: "importance_inflation", confidence: 1.0, evidence: "stands as testament" },
      ],
      metrics: {
        word_count: 10,
        clause_count: 1,
        has_participial: false,
        has_relative_clause: false,
        clause_balance_ratio: 0.5,
        construction_type: "simple",
      },
      arc_role: "claim",
    };
    const withHedging: SentenceClassification = {
      ...withInflation,
      patterns: [{ type: "hedging", confidence: 1.0, evidence: "perhaps" }],
    };
    expect(computeHeat(withInflation)).toBeGreaterThan(computeHeat(withHedging));
  });

  test("caps heat at 10", () => {
    const overloaded: SentenceClassification = {
      biber: {
        informational: 0,
        involved: 0,
        narrative: 0,
        persuasive: 0,
        abstract: 0,
        elaborative: 0,
      },
      patterns: [
        { type: "importance_inflation", confidence: 1, evidence: "a" },
        { type: "importance_inflation", confidence: 1, evidence: "b" },
        { type: "importance_inflation", confidence: 1, evidence: "c" },
        { type: "importance_inflation", confidence: 1, evidence: "d" },
        { type: "importance_inflation", confidence: 1, evidence: "e" },
        { type: "importance_inflation", confidence: 1, evidence: "f" },
        { type: "importance_inflation", confidence: 1, evidence: "g" },
        { type: "importance_inflation", confidence: 1, evidence: "h" },
        { type: "importance_inflation", confidence: 1, evidence: "i" },
        { type: "importance_inflation", confidence: 1, evidence: "j" },
      ],
      metrics: {
        word_count: 50,
        clause_count: 5,
        has_participial: true,
        has_relative_clause: true,
        clause_balance_ratio: 0.99,
        construction_type: "compound-complex",
      },
      arc_role: "claim",
    };
    expect(computeHeat(overloaded)).toBeLessThanOrEqual(10);
  });
});

import { describe, expect, test } from "bun:test";
import type { ClassifiedSentence, StylometricProfile } from "@prosodeus/core/browser";
import { mergePartialProfile, patchProfileSentenceText } from "./profile-merge";

function sentence(id: number, text: string, patterns: boolean, heat: number): ClassifiedSentence {
  return {
    id,
    text,
    hash: `hash-${id}-${text.length}`,
    paragraph_id: 0,
    classification: {
      biber: {
        informational: 0.5,
        involved: 0,
        narrative: 0,
        persuasive: 0,
        abstract: 0,
        elaborative: 0,
      },
      patterns: patterns
        ? [{ type: "importance_inflation", confidence: 0.9, evidence: "test" }]
        : [],
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

function profile(sentences: ClassifiedSentence[]): StylometricProfile {
  return {
    word_count: 10,
    sentence_count: sentences.length,
    paragraph_count: 1,
    sentences,
    windows: [],
    hot_regions: [],
    convergence_slope: 0,
    global_biber_entropy: 0,
    global_device_entropy: 0,
    global_sentence_length_autocorrelation: 0,
    mean_heat: sentences.reduce((s, x) => s + x.heat, 0) / Math.max(1, sentences.length),
    global_ttr: 0,
    global_mattr: 0,
    global_hapax_ratio: 0,
    global_word_length_entropy: 0,
    global_opening_variety: 0,
    global_function_word_ratio: 0,
  };
}

describe("mergePartialProfile", () => {
  test("preserves heat for unchanged sentences when partial is empty placeholder", () => {
    const prev = profile([
      sentence(0, "Unchanged sentence one.", true, 3.2),
      sentence(1, "Unchanged sentence two.", true, 2.1),
    ]);
    const partial = profile([
      { ...sentence(0, "Unchanged sentence one.", false, 0), hash: prev.sentences[0]!.hash },
      { ...sentence(1, "Unchanged sentence two.", false, 0), hash: prev.sentences[1]!.hash },
    ]);

    const merged = mergePartialProfile(prev, partial, false);
    expect(merged.sentences[0]!.heat).toBe(3.2);
    expect(merged.sentences[1]!.heat).toBe(2.1);
    expect(merged.sentences[0]!.classification.patterns.length).toBe(1);
  });

  test("returns partial as-is when done", () => {
    const prev = profile([sentence(0, "Old.", true, 5)]);
    const partial = profile([sentence(0, "Old.", false, 0)]);
    expect(mergePartialProfile(prev, partial, true)).toBe(partial);
  });

  test("takes fresh partial data when hash changed", () => {
    const prev = profile([sentence(0, "Before edit.", true, 4)]);
    const partial = profile([sentence(0, "After edit.", true, 1.5)]);
    const merged = mergePartialProfile(prev, partial, false);
    expect(merged.sentences[0]!.text).toBe("After edit.");
    expect(merged.sentences[0]!.heat).toBe(1.5);
  });
});

describe("patchProfileSentenceText", () => {
  test("updates sentence text without touching classification", () => {
    const prev = profile([sentence(0, "Before.", true, 3.5)]);
    const patched = patchProfileSentenceText(prev, 0, "After rewrite.");
    expect(patched.sentences[0]!.text).toBe("After rewrite.");
    expect(patched.sentences[0]!.heat).toBe(3.5);
    expect(patched.sentences[0]!.classification.patterns.length).toBe(1);
  });
});

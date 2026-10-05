import { describe, expect, test } from "bun:test";
import { LLM_MARKER_MATCHERS } from "../src/taxonomy/llm-marker-matchers.ts";

describe("LLM_MARKER_MATCHERS", () => {
  test("every matcher regex compiles", () => {
    for (const [_id, regexes] of Object.entries(LLM_MARKER_MATCHERS)) {
      for (const regex of regexes) {
        expect(regex).toBeInstanceOf(RegExp);
        expect(regex.source.length).toBeGreaterThan(0);
      }
    }
  });

  test("no matcher contains quote artifacts from the source export", () => {
    for (const [id, regexes] of Object.entries(LLM_MARKER_MATCHERS)) {
      for (const regex of regexes) {
        expect(`${id}: ${regex.source}`).not.toMatch(/["\u201C\u201D]/);
      }
    }
  });

  test("no matcher is unmatchable by construction", () => {
    // A start anchor after consuming text, or an end anchor before consuming text, can never match.
    const deadAnchor = /[A-Za-z0-9_\])}][\^]|\$[A-Za-z0-9_([\\]/;
    for (const [id, regexes] of Object.entries(LLM_MARKER_MATCHERS)) {
      for (const regex of regexes) {
        const withoutClassesAndLookarounds = regex.source
          .replace(/\[\^/g, "[")
          .replace(/\(\?<?[!=]/g, "(");
        expect(`${id}: ${regex.source}`).not.toMatch(deadAnchor);
        expect(withoutClassesAndLookarounds.length).toBeGreaterThan(0);
      }
    }
  });

  test("detects representative manual phrases", () => {
    const cases: Array<[string, string]> = [
      ["groundbreaking", "hyperbolic_adjective"],
      ["This is a game-changer.", "hyperbolic_adjective"],
      ["Moreover, the data shows this.", "additive_transition"],
      ["It is worth noting that this matters.", "emphasis_transition"],
      ["The AI landscape is evolving.", "spatial_metaphor"],
      ["a complex interplay of factors", "abstract_noun"],
    ];

    for (const [text, expectedId] of cases) {
      const regexes = LLM_MARKER_MATCHERS[expectedId];
      expect(regexes).toBeDefined();
      const matched = regexes?.some((r: RegExp) => r.test(text));
      expect(matched).toBe(true);
    }
  });

  test("does not match ordinary neutral sentences for strong patterns", () => {
    const regexes = LLM_MARKER_MATCHERS.hyperbolic_adjective;
    expect(regexes).toBeDefined();
    expect(regexes?.some((r: RegExp) => r.test("The meeting was productive."))).toBe(false);
  });
});

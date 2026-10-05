import { describe, expect, test } from "bun:test";
import {
  filterRewriteSuggestions,
  isValidRewriteSuggestion,
} from "../src/rewrite/suggestion-validation.ts";
import type { RewriteSuggestion } from "../src/types.ts";

const SOURCE =
  "When abstract nouns stack together, the sentence asks the reader to admire a shape instead of follow a thought.";

describe("isValidRewriteSuggestion", () => {
  test("accepts a structural paraphrase", () => {
    const alt =
      "When abstract nouns pile up, the sentence invites admiration of form rather than pursuit of meaning.";
    expect(isValidRewriteSuggestion(SOURCE, alt)).toBe(true);
  });

  test("rejects skyline hallucination", () => {
    const alt =
      "The city's skyline, once dominated by low-rise buildings, now rises with steel and glass towers.";
    expect(isValidRewriteSuggestion(SOURCE, alt)).toBe(false);
  });

  test("rejects placeholder text", () => {
    expect(isValidRewriteSuggestion(SOURCE, "Please provide the sentence to restructure.")).toBe(
      false,
    );
  });

  test("rejects identical text", () => {
    expect(isValidRewriteSuggestion(SOURCE, SOURCE)).toBe(false);
  });
});

describe("filterRewriteSuggestions", () => {
  test("drops suggestions with no valid alternatives", () => {
    const input: RewriteSuggestion[] = [
      {
        original: SOURCE,
        pattern_type: "hedging",
        sentence_id: 2,
        alternatives: [
          {
            text: "The city's skyline now rises with gleaming spires.",
            rationale: "bad",
          },
        ],
      },
    ];
    expect(filterRewriteSuggestions(input)).toEqual([]);
  });
});

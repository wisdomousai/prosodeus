import { describe, expect, test } from "bun:test";
import { analysisTextEquals, canonicalizeAnalysisText, hasAnalysisText } from "./analysis-text";

describe("analysis text identity", () => {
  test("ignores editor serialization whitespace", () => {
    expect(
      analysisTextEquals(
        "One sentence.\n\nSecond sentence.",
        " One   sentence.\nSecond sentence. ",
      ),
    ).toBe(true);
  });

  test("treats content edits as different", () => {
    expect(analysisTextEquals("One sentence.", "One stronger sentence.")).toBe(false);
  });

  test("normalizes non-breaking spaces", () => {
    expect(canonicalizeAnalysisText("One\u00a0sentence.")).toBe("One sentence.");
  });

  test("detects empty analysis text after normalization", () => {
    expect(hasAnalysisText(" \n\t ")).toBe(false);
  });
});

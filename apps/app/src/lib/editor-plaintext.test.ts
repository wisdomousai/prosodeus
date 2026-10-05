import { describe, expect, test } from "bun:test";
import { normalizeRewriteInsertText } from "./editor-plaintext";

describe("normalizeRewriteInsertText", () => {
  test("collapses internal line breaks to spaces", () => {
    expect(normalizeRewriteInsertText("Line one.\nLine two.")).toBe("Line one. Line two.");
  });

  test("trims surrounding whitespace", () => {
    expect(normalizeRewriteInsertText("  Rewritten sentence.  ")).toBe("Rewritten sentence.");
  });
});

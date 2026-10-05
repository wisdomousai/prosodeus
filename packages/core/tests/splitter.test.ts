import { describe, expect, test } from "bun:test";
import {
  diffChangedSentenceIds,
  diffSentences,
  splitAndHash,
  splitSentences,
} from "../src/text/splitter.ts";

describe("splitSentences", () => {
  test("splits simple sentences", () => {
    const text = "This is sentence one. This is sentence two. And a third.";
    const result = splitSentences(text);
    expect(result).toEqual(["This is sentence one.", "This is sentence two.", "And a third."]);
  });

  test("handles question marks and exclamation marks", () => {
    const result = splitSentences("What happened? I don't know! Really?");
    expect(result).toEqual(["What happened?", "I don't know!", "Really?"]);
  });

  test("preserves abbreviations", () => {
    const result = splitSentences("Dr. Smith went to Washington. He met Mr. Jones.");
    expect(result).toEqual(["Dr. Smith went to Washington.", "He met Mr. Jones."]);
  });

  test("handles decimal numbers", () => {
    const result = splitSentences("The value was 3.14 percent. That's significant.");
    expect(result).toEqual(["The value was 3.14 percent.", "That's significant."]);
  });

  test("handles ellipses", () => {
    const result = splitSentences("Well... That was unexpected. Right?");
    expect(result).toEqual(["Well...", "That was unexpected.", "Right?"]);
  });

  test("handles paragraph breaks", () => {
    const result = splitSentences(
      "First paragraph here.\n\nSecond paragraph starts. It continues.",
    );
    expect(result).toEqual(["First paragraph here.", "Second paragraph starts.", "It continues."]);
  });

  test("handles empty input", () => {
    expect(splitSentences("")).toEqual([]);
    expect(splitSentences("   ")).toEqual([]);
  });

  test("handles single sentence without period", () => {
    const result = splitSentences("Just a sentence without ending punctuation");
    expect(result).toEqual(["Just a sentence without ending punctuation"]);
  });

  test("handles quoted speech", () => {
    const result = splitSentences('"Hello there," she said. "How are you?"');
    expect(result).toEqual(['"Hello there," she said.', '"How are you?"']);
  });

  test("handles initials", () => {
    const result = splitSentences("J. K. Rowling wrote Harry Potter. The books are great.");
    expect(result).toEqual(["J. K. Rowling wrote Harry Potter.", "The books are great."]);
  });

  test("handles e.g. and i.e. abbreviations", () => {
    const result = splitSentences("Use a tool, e.g. a hammer. It works well, i.e. it's effective.");
    expect(result).toEqual(["Use a tool, e.g. a hammer.", "It works well, i.e. it's effective."]);
  });
});

describe("splitAndHash", () => {
  test("assigns sequential IDs", () => {
    const result = splitAndHash("First. Second. Third.");
    expect(result.map((s) => s.id)).toEqual([0, 1, 2]);
  });

  test("tracks paragraph IDs", () => {
    const result = splitAndHash("Para one sentence.\n\nPara two first. Para two second.");
    expect(result.map((s) => s.paragraph_id)).toEqual([0, 1, 1]);
  });

  test("produces consistent hashes", () => {
    const a = splitAndHash("Hello world. Goodbye world.");
    const b = splitAndHash("Hello world. Goodbye world.");
    expect(a[0]!.hash).toBe(b[0]!.hash);
    expect(a[1]!.hash).toBe(b[1]!.hash);
  });

  test("produces different hashes for different sentences", () => {
    const result = splitAndHash("First sentence here. Second sentence here.");
    expect(result[0]!.hash).not.toBe(result[1]!.hash);
  });
});

describe("diffSentences", () => {
  test("detects new sentences", () => {
    const old = splitAndHash("First. Second. Third.");
    const next = splitAndHash("First. Modified second. Third.");
    const changed = diffSentences(old, next);
    expect(changed).toEqual([1]); // only sentence at index 1 changed
  });

  test("returns empty array when nothing changed", () => {
    const old = splitAndHash("First. Second. Third.");
    const next = splitAndHash("First. Second. Third.");
    expect(diffSentences(old, next)).toEqual([]);
  });

  test("detects all new sentences on fresh text", () => {
    const old = splitAndHash("Original text here.");
    const next = splitAndHash("Completely different. Two sentences.");
    const changed = diffSentences(old, next);
    expect(changed).toEqual([0, 1]);
  });

  test("single character edit changes exactly one sentence id", () => {
    const base = "First sentence stays. Second sentence stays.";
    const old = splitAndHash(base);
    const next = splitAndHash("First sentence stays. Second sentence stayx.");
    expect(diffSentences(old, next)).toEqual([1]);
  });
});

describe("diffChangedSentenceIds", () => {
  test("compares baseline text to current text", () => {
    const baseline = "Alpha one. Beta two. Gamma three.";
    const current = "Alpha one. Beta TW0. Gamma three.";
    expect(diffChangedSentenceIds(baseline, current)).toEqual([1]);
  });

  test("returns empty when baseline is empty or text unchanged", () => {
    const text = "Same document throughout.";
    expect(diffChangedSentenceIds("", text)).toEqual([]);
    expect(diffChangedSentenceIds(text, text)).toEqual([]);
  });
});

import { describe, expect, test } from "bun:test";
import {
  resolveOppositionSnapshotRange,
  resolveOppositionSnapshotSentence,
} from "./sentence-replacement";

describe("resolveOppositionSnapshotSentence", () => {
  const text = [
    "The opening sentence is clean.",
    "Statistical writing is not about sounding decisive but about assigning force where evidence earns it.",
    "The closing sentence is clean.",
  ].join(" ");

  test("uses sentence id as a validated hint", () => {
    const sentence = resolveOppositionSnapshotSentence(
      text,
      1,
      "Statistical writing is not about sounding decisive but about assigning force where evidence earns it.",
    );
    expect(sentence?.id).toBe(1);
  });

  test("falls back to a unique original sentence match when the id is wrong", () => {
    const sentence = resolveOppositionSnapshotSentence(
      text,
      99,
      "Statistical writing is not about sounding decisive but about assigning force where evidence earns it.",
    );
    expect(sentence?.id).toBe(1);
  });

  test("rejects ambiguous original sentence matches", () => {
    const repeated = "Repeat this sentence. Repeat this sentence.";
    expect(resolveOppositionSnapshotSentence(repeated, 99, "Repeat this sentence.")).toBeNull();
  });
});

describe("resolveOppositionSnapshotRange", () => {
  const text = [
    "AI adoption is not about tools.",
    "It is about changing support workflows.",
    "The closing sentence is clean.",
  ].join(" ");

  test("uses validated adjacent sentence ids", () => {
    const range = resolveOppositionSnapshotRange(
      text,
      0,
      1,
      "AI adoption is not about tools. It is about changing support workflows.",
    );
    expect(range?.sentenceIds).toEqual([0, 1]);
  });

  test("falls back to a unique adjacent sentence range match", () => {
    const range = resolveOppositionSnapshotRange(
      text,
      99,
      100,
      "AI adoption is not about tools. It is about changing support workflows.",
    );
    expect(range?.sentenceIds).toEqual([0, 1]);
  });

  test("rejects ambiguous adjacent sentence ranges", () => {
    const repeated = "A is not about B. It is about C. A is not about B. It is about C.";
    expect(
      resolveOppositionSnapshotRange(repeated, 99, 100, "A is not about B. It is about C."),
    ).toBeNull();
  });
});

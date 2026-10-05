import { describe, expect, test } from "bun:test";
import type { OppositionEdit } from "./opposition-review-model";
import {
  buildOppositionReviewItem,
  buildOppositionReviewItems,
  isOppositionRunStale,
  normalizeOppositionSentence,
  oppositionEditKey,
  oppositionReplacementOptions,
} from "./opposition-review-model";

function edit(overrides: Partial<OppositionEdit> = {}): OppositionEdit {
  return {
    span: {
      sentence_id: 0,
      pattern_type: "binary_contrast",
      text: "It's not about speed; it's about precision.",
      evidence: "not about speed",
    },
    original_sentence: "It's not about speed; it's about precision.",
    rewritten_sentence: "Precision matters more than speed.",
    verdict: "vacuous",
    fidelity_score: 0.9,
    fidelity_reason: "Preserves meaning",
    accepted: true,
    ...overrides,
  };
}

describe("normalizeOppositionSentence", () => {
  test("collapses whitespace for no-op comparisons", () => {
    expect(normalizeOppositionSentence("  A   sentence\nwith spacing. ")).toBe(
      "A sentence with spacing.",
    );
  });
});

describe("oppositionReplacementOptions", () => {
  test("drops whitespace-normalized unchanged rewrites", () => {
    const item = edit({
      rewritten_sentence: "  It's not about speed;   it's about precision. ",
      alternatives: ["It's not about speed; it's about precision."],
    });
    expect(oppositionReplacementOptions(item)).toEqual([]);
  });

  test("keeps real alternatives when the main rewrite is unusable", () => {
    const item = edit({
      rewritten_sentence: "It's not about speed; it's about precision.",
      accepted: false,
      alternatives: ["Precision matters more than speed.", "Speed is secondary to precision."],
    });
    expect(oppositionReplacementOptions(item)).toEqual([
      "Precision matters more than speed.",
      "Speed is secondary to precision.",
    ]);
  });
});

describe("buildOppositionReviewItem", () => {
  test("drops edits with no usable correction", () => {
    const source = edit({
      rewritten_sentence: "It's not about speed; it's about precision.",
      alternatives: [],
      accepted: false,
    });
    expect(buildOppositionReviewItem(source)).toBeNull();
  });

  test("marks rejected edit with real alternatives as pending", () => {
    const source = edit({
      rewritten_sentence: "It's not about speed; it's about precision.",
      accepted: false,
      alternatives: ["Precision matters more than speed."],
    });
    const item = buildOppositionReviewItem(source);
    expect(item?.status).toBe("pending");
    expect(item?.primaryReplacement).toBe("Precision matters more than speed.");
  });

  test("preserves applied and ignored correction states", () => {
    const source = edit();
    expect(buildOppositionReviewItem(source, "applied")?.status).toBe("applied");
    expect(buildOppositionReviewItem(source, "ignored")?.status).toBe("ignored");
  });
});

describe("buildOppositionReviewItems", () => {
  test("does not require live profile sentence lookup", () => {
    const source = edit();
    const items = buildOppositionReviewItems([source], new Map());
    expect(items).toHaveLength(1);
    expect(items[0]?.key).toBe(oppositionEditKey(source));
    expect(items[0]?.status).toBe("pending");
  });

  test("filters no-op edits before review", () => {
    const source = edit({
      rewritten_sentence: "It's not about speed; it's about precision.",
      alternatives: [],
    });
    expect(buildOppositionReviewItems([source], new Map())).toEqual([]);
  });

  test("merges duplicate sentence edits into correction options", () => {
    const first = edit({
      rewritten_sentence: "Precision matters more than speed.",
      alternatives: ["Speed is secondary to precision."],
    });
    const second = edit({
      rewritten_sentence: "The team prioritized precision over speed.",
      fidelity_score: 0,
      fidelity_reason: "Manual review",
      accepted: false,
    });

    const items = buildOppositionReviewItems([first, second], new Map());

    expect(items).toHaveLength(1);
    expect(items[0]?.replacementOptions).toEqual([
      "Precision matters more than speed.",
      "Speed is secondary to precision.",
      "The team prioritized precision over speed.",
    ]);
  });

  test("keeps sentence-range edits separate from single-sentence edits", () => {
    const single = edit({
      span: { ...edit().span, sentence_id: 3 },
      original_sentence: "It is about building a culture.",
      rewritten_sentence: "Build the culture.",
    });
    const range = edit({
      span: { ...edit().span, sentence_id: 3, sentence_end_id: 4 },
      original_sentence: "Success is not about replacing people. It is about building a culture.",
      rewritten_sentence: "Success depends on building a culture.",
    });

    const items = buildOppositionReviewItems([single, range], new Map());

    expect(items).toHaveLength(2);
    expect(items.map((item) => item.key)).toEqual([
      oppositionEditKey(single),
      oppositionEditKey(range),
    ]);
  });
});

describe("isOppositionRunStale", () => {
  test("ignores editor serialization whitespace", () => {
    expect(
      isOppositionRunStale(
        "One sentence.\n\nSecond sentence.",
        " One   sentence.\nSecond sentence. ",
      ),
    ).toBe(false);
  });

  test("detects actual content changes", () => {
    expect(isOppositionRunStale("One sentence.", "One revised sentence.")).toBe(true);
  });
});

import { describe, expect, test } from "bun:test";
import type { RewriteSuggestion } from "@prosodeus/core/browser";
import {
  buildSuggestionReadyIds,
  buildSuggestQueuedIds,
  resolveSentenceInspectState,
  type SentenceInspectContext,
} from "./sentence-inspect-state.ts";

function ctx(overrides: Partial<SentenceInspectContext> = {}): SentenceInspectContext {
  return {
    profile: { sentences: [{ id: 1, text: "x", classification: { patterns: [] } }] } as never,
    analysisReady: true,
    staleSentenceIds: new Set(),
    batchTargetIds: new Set(),
    batchInFlight: false,
    suggestions: new Map(),
    suggestionsLoading: null,
    ...overrides,
  };
}

describe("resolveSentenceInspectState", () => {
  test("no profile", () => {
    expect(resolveSentenceInspectState(1, ctx({ profile: null }))).toBe("no_profile");
  });

  test("stale takes priority", () => {
    expect(resolveSentenceInspectState(1, ctx({ staleSentenceIds: new Set([1]) }))).toBe("stale");
  });

  test("suggest ready when map has entries", () => {
    const suggestions = new Map<number, RewriteSuggestion[]>([
      [
        1,
        [
          {
            sentence_id: 1,
            original: "x",
            alternatives: [],
            pattern_type: "hedging",
            level: "sentence",
          },
        ],
      ],
    ]);
    expect(resolveSentenceInspectState(1, ctx({ suggestions }))).toBe("suggest_ready");
  });

  test("suggest loading for active id", () => {
    expect(resolveSentenceInspectState(2, ctx({ suggestionsLoading: 2 }))).toBe("suggest_loading");
  });

  test("suggest queued when in batch targets and in flight", () => {
    expect(
      resolveSentenceInspectState(3, ctx({ batchTargetIds: new Set([3]), batchInFlight: true })),
    ).toBe("suggest_queued");
  });

  test("analyze pending while classify in flight", () => {
    expect(resolveSentenceInspectState(1, ctx({ analysisReady: false }))).toBe("analyze_pending");
  });

  test("critique ready default", () => {
    expect(resolveSentenceInspectState(1, ctx())).toBe("critique_ready");
  });
});

describe("buildSuggestQueuedIds", () => {
  test("returns targets minus ready while in flight", () => {
    const queued = buildSuggestQueuedIds({
      batchTargetIds: new Set([1, 2, 3]),
      batchInFlight: true,
      suggestions: new Map([[2, []]]),
    });
    expect([...queued].sort()).toEqual([1, 3]);
  });
});

describe("buildSuggestionReadyIds", () => {
  test("includes ids with non-empty suggestions", () => {
    const ready = buildSuggestionReadyIds(
      new Map<number, RewriteSuggestion[]>([
        [
          5,
          [
            {
              sentence_id: 5,
              original: "a",
              alternatives: [],
              pattern_type: "hedging",
              level: "sentence",
            },
          ],
        ],
      ]),
    );
    expect([...ready]).toEqual([5]);
  });
});

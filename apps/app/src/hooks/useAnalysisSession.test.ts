import { describe, expect, test } from "bun:test";
import type {
  ClassifiedSentence,
  RewriteSuggestion,
  StylometricProfile,
} from "@prosodeus/core/browser";
import type { AnalysisEvent } from "@/lib/analysis/events";
import {
  INITIAL_SESSION_STATE,
  type SessionAction,
  type SessionState,
  selectAnalysisRuntime,
  sessionReducer,
} from "./useAnalysisSession";

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
    word_count: 400,
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

const HOT_TEXT = "This groundbreaking framework fundamentally transforms the entire landscape.";

function suggestionFor(sentenceId: number, original: string): RewriteSuggestion {
  return {
    original,
    alternatives: [
      {
        text: "This framework changes parts of the landscape in measurable ways.",
        rationale: "reduce intensity",
      },
    ],
    pattern_type: "importance_inflation",
    sentence_id: sentenceId,
  };
}

function run(events: SessionAction[], from: SessionState = INITIAL_SESSION_STATE): SessionState {
  return events.reduce(sessionReducer, from);
}

const event = (e: AnalysisEvent): SessionAction => ({ type: "event", event: e });

describe("selectAnalysisRuntime", () => {
  test("uses desktop when the preload bridge is ready", () => {
    expect(
      selectAnalysisRuntime({
        desktopBridgeReady: true,
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Electron/39.0.0",
      }),
    ).toBe("desktop");
  });

  test("waits for the bridge inside Electron instead of falling back to web transport", () => {
    expect(
      selectAnalysisRuntime({
        desktopBridgeReady: false,
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Electron/39.0.0",
      }),
    ).toBe("pending-desktop-bridge");
  });

  test("uses web transport outside Electron when no bridge exists", () => {
    expect(
      selectAnalysisRuntime({
        desktopBridgeReady: false,
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/138.0.0.0",
      }),
    ).toBe("web");
  });
});

describe("sessionReducer — analyze lifecycle", () => {
  test("full analyze with batch: progress → partial → profile computes batch targets", () => {
    const p = profile([sentence(0, HOT_TEXT, true, 9), sentence(1, "Calm sentence.", false, 1)]);
    const state = run([
      {
        type: "analyze_started",
        opts: { analyzeMode: "full", suggestMode: "batch", topSuggestions: 3 },
        incremental: false,
        batchEnabled: true,
      },
      event({
        type: "progress",
        progress: { type: "progress", total: 2, cached: 0, classifying: 1 },
      }),
      event({ type: "profile", profile: p }),
    ]);

    expect(state.status).toBe("ready");
    expect(state.analyzeInFlight).toBe(false);
    expect(state.progress).toBeNull();
    expect(state.batchTargetIds.has(0)).toBe(true);
    expect(state.batchInFlight).toBe(true);
  });

  test("progress and profile_partial are ignored when no analyze is in flight", () => {
    const p = profile([sentence(0, HOT_TEXT, true, 9)]);
    const state = run([
      event({
        type: "progress",
        progress: { type: "progress", total: 5, cached: 0, classifying: 2 },
      }),
      event({ type: "profile_partial", profile: p, done: true }),
    ]);
    expect(state.progress).toBeNull();
    expect(state.profile).toBeNull();
    expect(state.status).toBe("idle");
  });

  test("profile_partial with done finishes the analyze", () => {
    const p = profile([sentence(0, HOT_TEXT, true, 9)]);
    const state = run([
      { type: "analyze_started", opts: undefined, incremental: false, batchEnabled: false },
      event({ type: "profile_partial", profile: p, done: true }),
    ]);
    expect(state.status).toBe("ready");
    expect(state.analyzeInFlight).toBe(false);
    expect(state.profile).not.toBeNull();
  });

  test("incremental analyze keeps suggestions, then prunes stale ones on profile", () => {
    const before = profile([sentence(0, HOT_TEXT, true, 9)]);
    const withSuggestions = run([
      { type: "analyze_started", opts: undefined, incremental: false, batchEnabled: true },
      event({ type: "profile", profile: before }),
      event({ type: "batch_suggestions", suggestions: [suggestionFor(0, HOT_TEXT)] }),
    ]);
    expect(withSuggestions.rewriteSuggestions.size).toBe(1);
    expect(withSuggestions.batchInFlight).toBe(false);

    // Incremental re-analyze: sentence 0 text changed, so its suggestion is stale.
    const after = profile([sentence(0, "A rewritten calmer sentence.", false, 2)]);
    const state = run(
      [
        {
          type: "analyze_started",
          opts: { analyzeMode: "incremental", suggestMode: "none", topSuggestions: 0 },
          incremental: true,
          batchEnabled: false,
        },
        event({ type: "profile", profile: after }),
      ],
      withSuggestions,
    );
    expect(state.rewriteSuggestions.size).toBe(0);
    expect(state.batchInFlight).toBe(false);
    expect(state.batchTargetIds.size).toBe(0);
  });

  test("analyze_error clears in-flight state and reports", () => {
    const state = run([
      { type: "analyze_started", opts: undefined, incremental: true, batchEnabled: false },
      event({ type: "analyze_error", message: "boom" }),
    ]);
    expect(state.status).toBe("error");
    expect(state.error).toBe("boom");
    expect(state.analyzeInFlight).toBe(false);
    expect(state.incrementalAnalyze).toBe(false);
  });
});

describe("sessionReducer — sentence suggestions", () => {
  test("valid on-demand suggestions land under their sentence id", () => {
    const p = profile([sentence(0, HOT_TEXT, true, 9)]);
    const state = run([
      { type: "analyze_started", opts: undefined, incremental: false, batchEnabled: false },
      event({ type: "profile", profile: p }),
      { type: "suggest_started", sentenceId: 0 },
      event({ type: "sentence_suggestions", suggestions: [suggestionFor(0, HOT_TEXT)] }),
    ]);
    expect(state.suggestionsLoading).toBeNull();
    expect(state.rewriteSuggestions.get(0)?.length).toBe(1);
    expect(state.suggestionsEmptyIds.has(0)).toBe(false);
  });

  test("empty result marks the requested sentence as empty", () => {
    const state = run([
      { type: "suggest_started", sentenceId: 4 },
      event({ type: "sentence_suggestions", suggestions: [] }),
    ]);
    expect(state.suggestionsLoading).toBeNull();
    expect(state.suggestionsEmptyIds.has(4)).toBe(true);
  });

  test("suggest_error with empty=true records empty, without surfacing an error", () => {
    const state = run([
      { type: "suggest_started", sentenceId: 2 },
      event({ type: "suggest_error", sentenceId: 2, message: "no patterns", empty: true }),
    ]);
    expect(state.error).toBeNull();
    expect(state.suggestionsEmptyIds.has(2)).toBe(true);
    expect(state.suggestionsLoading).toBeNull();
  });

  test("suggest_error with empty=false surfaces the message", () => {
    const state = run([
      { type: "suggest_started", sentenceId: 2 },
      event({ type: "suggest_error", sentenceId: 2, message: "401 unauthorized", empty: false }),
    ]);
    expect(state.error).toContain("401");
    expect(state.suggestionsLoading).toBeNull();
  });

  test("re-requesting a sentence clears its empty marker", () => {
    const state = run([
      { type: "suggest_started", sentenceId: 3 },
      event({ type: "sentence_suggestions", suggestions: [] }),
      { type: "suggest_started", sentenceId: 3 },
    ]);
    expect(state.suggestionsEmptyIds.has(3)).toBe(false);
    expect(state.suggestionsLoading).toBe(3);
  });
});

describe("sessionReducer — misc events", () => {
  test("generic error flips analyze and rewrite status", () => {
    const state = run([
      { type: "analyze_started", opts: undefined, incremental: false, batchEnabled: false },
      event({ type: "error", message: "server exploded" }),
    ]);
    expect(state.status).toBe("error");
    expect(state.rewriteStatus).toBe("error");
    expect(state.analyzeInFlight).toBe(false);
  });

  test("disconnect keeps ready results", () => {
    const p = profile([sentence(0, HOT_TEXT, true, 9)]);
    const ready = run([
      { type: "analyze_started", opts: undefined, incremental: false, batchEnabled: false },
      event({ type: "profile", profile: p }),
    ]);
    const state = run([event({ type: "connection", status: "disconnected" })], ready);
    expect(state.status).toBe("ready");
    expect(state.profile).not.toBeNull();
  });

  test("saved stamps lastSavedAt", () => {
    const state = run([event({ type: "saved" })]);
    expect(state.lastSavedAt).not.toBeNull();
  });
});

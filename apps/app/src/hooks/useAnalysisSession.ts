import type {
  RewriteSuggestion,
  SentenceClassification,
  StylometricProfile,
  SuggestionConfig,
} from "@prosodeus/core/browser";
import { selectHotSentencesFromProfile } from "@prosodeus/core/browser";
import type {
  AnalysisStatus,
  AnalyzeCallOptions,
  OppositionResultEvent,
  OppositionStatus,
  ProgressEvent,
  RewriteAlternativesEvent,
  RewriteConstraints,
  RewriteStatus,
  Version,
  VersionCompareEvent,
  VersionContentEvent,
} from "@prosodeus/shared/browser";
import {
  isBatchSuggestEnabled,
  isIncrementalAnalyze,
  resolveAnalyzeTopSuggestions,
} from "@prosodeus/shared/browser";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { createDesktopTransport } from "@/lib/analysis/desktop-transport";
import type { AnalysisEvent, AnalysisTransport } from "@/lib/analysis/events";
import { createWsTransport } from "@/lib/analysis/ws-transport";
import { isDesktop } from "@/lib/desktop-bridge";
import {
  patchProfileSentenceText as applyProfileSentenceTextPatch,
  mergePartialProfile,
} from "@/lib/profile-merge";
import {
  buildSuggestionMap,
  expectsBatchedSuggestions,
  pruneStaleSuggestions,
  sanitizeRewriteAlternatives,
} from "@/lib/suggestion-lifecycle";

export type { AnalyzeCallOptions, Version };

type AnalysisRuntime = "desktop" | "web" | "pending-desktop-bridge";

export function selectAnalysisRuntime(input: {
  desktopBridgeReady: boolean;
  userAgent?: string;
}): AnalysisRuntime {
  if (input.desktopBridgeReady) return "desktop";
  if (/\bElectron\b/i.test(input.userAgent ?? "")) return "pending-desktop-bridge";
  return "web";
}

export interface ProfileSentenceSnapshot {
  text: string;
  classification: SentenceClassification;
}

export interface SessionState {
  profile: StylometricProfile | null;
  progress: ProgressEvent | null;
  status: AnalysisStatus;
  error: string | null;
  rewriteStatus: RewriteStatus;
  rewriteStep: string | null;
  rewriteAlternatives: RewriteAlternativesEvent["data"] | null;
  rewriteSuggestions: Map<number, RewriteSuggestion[]>;
  batchTargetIds: Set<number>;
  batchInFlight: boolean;
  suggestionsLoading: number | null;
  suggestionsEmptyIds: Set<number>;
  suggestNotice: string | null;
  versions: Version[];
  versionContent: VersionContentEvent["data"] | null;
  versionCompare: VersionCompareEvent["data"] | null;
  lastSavedAt: number | null;
  // Opposition state
  oppositionStatus: OppositionStatus;
  oppositionStep: string | null;
  oppositionResult: OppositionResultEvent["data"] | null;
  // Analyze bookkeeping (guards)
  analyzeInFlight: boolean;
  incrementalAnalyze: boolean;
  lastAnalyzeOpts: AnalyzeCallOptions | undefined;
}

export const INITIAL_SESSION_STATE: SessionState = {
  profile: null,
  progress: null,
  status: "idle",
  error: null,
  rewriteStatus: "idle",
  rewriteStep: null,
  rewriteAlternatives: null,
  rewriteSuggestions: new Map(),
  batchTargetIds: new Set(),
  batchInFlight: false,
  suggestionsLoading: null,
  suggestionsEmptyIds: new Set(),
  suggestNotice: null,
  versions: [],
  versionContent: null,
  versionCompare: null,
  lastSavedAt: null,
  oppositionStatus: "idle",
  oppositionStep: null,
  oppositionResult: null,
  analyzeInFlight: false,
  incrementalAnalyze: false,
  lastAnalyzeOpts: undefined,
};

export type SessionAction =
  | { type: "event"; event: AnalysisEvent }
  | {
      type: "analyze_started";
      opts: AnalyzeCallOptions | undefined;
      incremental: boolean;
      batchEnabled: boolean;
    }
  | { type: "rewrite_alternatives_started" }
  | { type: "suggest_started"; sentenceId: number }
  | { type: "clear_rewrite_alternatives" }
  | { type: "clear_rewrite_suggestions" }
  | { type: "dismiss_suggestions"; sentenceId: number }
  | { type: "patch_profile_sentence"; sentenceId: number; newText: string }
  | { type: "clear_version_compare" }
  | { type: "opposition_started" }
  | { type: "opposition_progress"; step: string }
  | { type: "opposition_result"; data: OppositionResultEvent["data"] }
  | { type: "opposition_error"; message: string }
  | { type: "clear_opposition_result" }
  | { type: "reset" };

function batchTargetIdsFromProfile(profile: StylometricProfile, topN: number): Set<number> {
  return new Set(selectHotSentencesFromProfile(profile, topN).map((s) => s.id));
}

function withoutId(set: Set<number>, id: number): Set<number> {
  if (!set.has(id)) return set;
  const next = new Set(set);
  next.delete(id);
  return next;
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case "analyze_started": {
      const next: SessionState = {
        ...state,
        error: null,
        status: "analyzing",
        analyzeInFlight: true,
        incrementalAnalyze: action.incremental,
        lastAnalyzeOpts: action.opts,
      };
      if (!action.incremental) {
        next.rewriteSuggestions = new Map();
        next.batchTargetIds = new Set();
        next.batchInFlight = action.batchEnabled;
      }
      return next;
    }
    case "rewrite_alternatives_started":
      return {
        ...state,
        rewriteAlternatives: null,
        rewriteStatus: "rewriting",
        rewriteStep: "Generating alternatives…",
      };
    case "suggest_started":
      return {
        ...state,
        suggestionsLoading: action.sentenceId,
        suggestionsEmptyIds: withoutId(state.suggestionsEmptyIds, action.sentenceId),
      };
    case "clear_rewrite_alternatives":
      return { ...state, rewriteAlternatives: null, rewriteStatus: "idle", rewriteStep: null };
    case "clear_rewrite_suggestions":
      return {
        ...state,
        rewriteSuggestions: new Map(),
        batchTargetIds: new Set(),
        batchInFlight: false,
        suggestionsEmptyIds: new Set(),
      };
    case "dismiss_suggestions": {
      if (!state.rewriteSuggestions.has(action.sentenceId)) return state;
      const next = new Map(state.rewriteSuggestions);
      next.delete(action.sentenceId);
      return { ...state, rewriteSuggestions: next };
    }
    case "patch_profile_sentence": {
      if (!state.profile) return state;
      return {
        ...state,
        profile: applyProfileSentenceTextPatch(state.profile, action.sentenceId, action.newText),
      };
    }
    case "clear_version_compare":
      return { ...state, versionCompare: null };
    case "opposition_started":
      return {
        ...state,
        oppositionStatus: "running",
        oppositionStep: null,
        oppositionResult: null,
        error: null,
      };
    case "opposition_progress":
      return { ...state, oppositionStatus: "running", oppositionStep: action.step };
    case "opposition_result":
      return {
        ...state,
        oppositionStatus: "done",
        oppositionStep: null,
        oppositionResult: action.data,
        error: null,
      };
    case "opposition_error":
      return {
        ...state,
        oppositionStatus: "error",
        oppositionStep: null,
        error: action.message,
      };
    case "clear_opposition_result":
      return { ...state, oppositionStatus: "idle", oppositionStep: null, oppositionResult: null };
    case "reset":
      return { ...INITIAL_SESSION_STATE, versions: [], lastSavedAt: state.lastSavedAt };
    case "event":
      return applyEvent(state, action.event);
  }
}

function applyEvent(state: SessionState, event: AnalysisEvent): SessionState {
  switch (event.type) {
    case "connection": {
      if (event.status === "connecting") return { ...state, status: "connecting" };
      if (event.status === "connected") return { ...state, status: "idle" };
      // disconnected: keep results if we already have them
      return { ...state, status: state.status === "ready" ? "ready" : "idle" };
    }
    case "progress":
      if (!state.analyzeInFlight) return state;
      return { ...state, progress: event.progress };
    case "profile_partial": {
      if (!state.analyzeInFlight) return state;
      const merged = mergePartialProfile(state.profile, event.profile, event.done);
      const next: SessionState = { ...state, profile: merged };
      if (event.done) {
        next.progress = null;
        next.status = "ready";
        next.analyzeInFlight = false;
      }
      return next;
    }
    case "profile": {
      const next: SessionState = {
        ...state,
        profile: event.profile,
        progress: null,
        status: "ready",
        analyzeInFlight: false,
      };
      if (state.incrementalAnalyze) {
        next.incrementalAnalyze = false;
        next.rewriteSuggestions = pruneStaleSuggestions(state.rewriteSuggestions, event.profile);
        next.batchInFlight = false;
        next.batchTargetIds = new Set();
      } else if (isBatchSuggestEnabled(state.lastAnalyzeOpts)) {
        const topN = resolveAnalyzeTopSuggestions(state.lastAnalyzeOpts, event.profile.word_count);
        next.batchTargetIds = batchTargetIdsFromProfile(event.profile, topN);
        next.batchInFlight = expectsBatchedSuggestions(event.profile, topN);
      } else {
        next.batchTargetIds = new Set();
        next.batchInFlight = false;
      }
      return next;
    }
    case "batch_suggestions":
      // Batched suggestions arrive after `profile`; prune against the live
      // profile in case the user edited in between.
      return {
        ...state,
        rewriteSuggestions: pruneStaleSuggestions(
          buildSuggestionMap(event.suggestions),
          state.profile,
        ),
        batchInFlight: false,
      };
    case "rewrite_progress":
      return { ...state, rewriteStep: event.step, rewriteStatus: "rewriting" };
    case "rewrite_alternatives":
      return {
        ...state,
        rewriteAlternatives: sanitizeRewriteAlternatives(event.data),
        rewriteStep: null,
        rewriteStatus: "done",
      };
    case "opposition_progress":
      return { ...state, oppositionStatus: "running", oppositionStep: event.step };
    case "opposition_result":
      return {
        ...state,
        oppositionStatus: "done",
        oppositionStep: null,
        oppositionResult: event.data,
      };
    case "opposition_error":
      return {
        ...state,
        oppositionStatus: "error",
        oppositionStep: null,
        error: event.message,
      };
    case "sentence_suggestions": {
      const sentenceId = event.suggestions[0]?.sentence_id ?? state.suggestionsLoading;
      const next: SessionState = {
        ...state,
        suggestionsLoading: null,
        suggestNotice: event.notice ?? null,
      };
      if (sentenceId == null) return next;
      const validated = buildSuggestionMap(event.suggestions).get(sentenceId) ?? [];
      if (validated.length > 0) {
        next.rewriteSuggestions = new Map(state.rewriteSuggestions).set(sentenceId, validated);
        next.suggestionsEmptyIds = withoutId(state.suggestionsEmptyIds, sentenceId);
      } else {
        next.suggestionsEmptyIds = new Set(state.suggestionsEmptyIds).add(sentenceId);
      }
      return next;
    }
    case "versions":
      return { ...state, versions: event.versions };
    case "version_content":
      return { ...state, versionContent: event.data };
    case "version_compare":
      return { ...state, versionCompare: event.data };
    case "saved":
      return { ...state, lastSavedAt: Date.now() };
    case "analyze_error":
      return {
        ...state,
        analyzeInFlight: false,
        incrementalAnalyze: false,
        error: event.message,
        progress: null,
        status: "error",
      };
    case "rewrite_error":
      return {
        ...state,
        error: event.message,
        rewriteStep: null,
        rewriteStatus: "error",
      };
    case "suggest_error": {
      const next: SessionState = { ...state, suggestionsLoading: null };
      if (event.empty) {
        next.suggestionsEmptyIds = new Set(state.suggestionsEmptyIds).add(event.sentenceId);
      } else {
        next.error = event.message;
      }
      return next;
    }
    case "error":
      return {
        ...state,
        analyzeInFlight: false,
        error: event.message,
        status: "error",
        rewriteStatus: "error",
        oppositionStatus: state.oppositionStatus === "running" ? "error" : state.oppositionStatus,
      };
  }
}

export interface UseAnalysisSessionReturn {
  profile: StylometricProfile | null;
  progress: ProgressEvent | null;
  status: AnalysisStatus;
  error: string | null;
  analyze: (
    text: string,
    style?: string,
    model?: string,
    disabledPatterns?: string[],
    opts?: AnalyzeCallOptions,
  ) => void;
  // Rewrite alternatives
  rewriteStatus: RewriteStatus;
  rewriteStep: string | null;
  rewriteAlternatives: RewriteAlternativesEvent["data"] | null;
  requestRewriteAlternatives: (
    text: string,
    passageStart: number,
    passageEnd: number,
    constraints: RewriteConstraints,
    n: number,
    style?: string,
    model?: string,
  ) => void;
  clearRewriteAlternatives: () => void;
  // Versions
  versions: Version[];
  requestVersions: () => void;
  createVersion: (content: string, name?: string, source?: string) => void;
  getVersion: (versionId: number) => void;
  compareVersions: (a: number, b: number) => void;
  versionContent: VersionContentEvent["data"] | null;
  versionCompare: VersionCompareEvent["data"] | null;
  clearVersionCompare: () => void;
  // Opposition
  oppositionStatus: OppositionStatus;
  oppositionStep: string | null;
  oppositionResult: OppositionResultEvent["data"] | null;
  runOpposition: (text: string, style?: string, model?: string, maxPasses?: number) => void;
  clearOppositionResult: () => void;
  // Rewrite suggestions
  rewriteSuggestions: Map<number, RewriteSuggestion[]>;
  /** Sentence ids targeted by the post-analyze background suggest batch. */
  batchTargetIds: Set<number>;
  /** True until batched suggestions arrive or batch is skipped. */
  batchInFlight: boolean;
  suggestionsLoading: number | null;
  /** Sentence ids where the last on-demand suggest returned no usable options. */
  suggestionsEmptyIds: Set<number>;
  /** Info when suggest routed away from toolbar model (e.g. Kimi Code → Gemini). */
  suggestNotice: string | null;
  requestSuggestions: (
    sentenceId: number,
    documentText: string,
    config?: Partial<SuggestionConfig>,
    profileSentence?: ProfileSentenceSnapshot,
  ) => void;
  clearRewriteSuggestions: () => void;
  dismissSuggestions: (sentenceId: number) => void;
  /** Optimistically sync profile sentence text after inline rewrite (pre-analyze). */
  patchProfileSentenceText: (sentenceId: number, newText: string) => void;
  // Save
  save: (content: string) => void;
  /** Wall-clock ms when the transport last acknowledged a save. */
  lastSavedAt: number | null;
}

/**
 * One analysis session per document: a single state machine over normalized
 * transport events. Electron always uses desktop IPC; if preload has not
 * exposed the bridge yet, wait instead of silently falling back to WebSocket.
 */
export function useAnalysisSession(documentId: string | undefined): UseAnalysisSessionReturn {
  const [state, dispatch] = useReducer(sessionReducer, INITIAL_SESSION_STATE);
  const transportRef = useRef<AnalysisTransport | null>(null);

  useEffect(() => {
    dispatch({ type: "reset" });
    if (!documentId) return;

    let disposed = false;
    let disposeTransport: (() => void) | null = null;
    let timer: number | null = null;
    let attempts = 0;

    const connect = () => {
      if (disposed) return;

      const runtime = selectAnalysisRuntime({
        desktopBridgeReady: isDesktop(),
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      });

      if (runtime === "pending-desktop-bridge") {
        attempts++;
        if (attempts === 200) {
          dispatch({
            type: "event",
            event: {
              type: "error",
              message: "Desktop bridge is unavailable. Restart the desktop app before analyzing.",
            },
          });
        }
        timer = window.setTimeout(connect, attempts < 200 ? 50 : 500);
        return;
      }

      const transport =
        runtime === "desktop" ? createDesktopTransport(documentId) : createWsTransport(documentId);
      transportRef.current = transport;
      disposeTransport = transport.connect((event) => dispatch({ type: "event", event }));
    };

    connect();

    return () => {
      disposed = true;
      if (timer != null) window.clearTimeout(timer);
      disposeTransport?.();
      transportRef.current = null;
    };
  }, [documentId]);

  const analyze = useCallback(
    (
      text: string,
      style?: string,
      model?: string,
      disabledPatterns?: string[],
      opts?: AnalyzeCallOptions,
    ) => {
      const incremental = isIncrementalAnalyze(opts);
      const batchEnabled = isBatchSuggestEnabled(opts);
      const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
      const topSuggestions = resolveAnalyzeTopSuggestions(opts, wordCount);

      dispatch({ type: "analyze_started", opts, incremental, batchEnabled });
      transportRef.current?.analyze({
        text,
        style,
        model,
        disabledPatterns,
        opts,
        topSuggestions,
        suggestMode: batchEnabled ? "batch" : "none",
      });
    },
    [],
  );

  const requestRewriteAlternatives = useCallback(
    (
      text: string,
      passageStart: number,
      passageEnd: number,
      constraints: RewriteConstraints,
      n: number,
      style?: string,
      model?: string,
    ) => {
      dispatch({ type: "rewrite_alternatives_started" });
      transportRef.current?.rewriteAlternatives({
        text,
        passageStart,
        passageEnd,
        constraints,
        n,
        style,
        model,
      });
    },
    [],
  );

  const clearRewriteAlternatives = useCallback(() => {
    dispatch({ type: "clear_rewrite_alternatives" });
  }, []);

  const requestSuggestions = useCallback(
    (
      sentenceId: number,
      documentText: string,
      config?: Partial<SuggestionConfig>,
      profileSentence?: ProfileSentenceSnapshot,
    ) => {
      dispatch({ type: "suggest_started", sentenceId });
      transportRef.current?.suggest({ sentenceId, documentText, config, profileSentence });
    },
    [],
  );

  const clearRewriteSuggestions = useCallback(() => {
    dispatch({ type: "clear_rewrite_suggestions" });
  }, []);

  const dismissSuggestions = useCallback((sentenceId: number) => {
    dispatch({ type: "dismiss_suggestions", sentenceId });
  }, []);

  const patchProfileSentenceText = useCallback((sentenceId: number, newText: string) => {
    dispatch({ type: "patch_profile_sentence", sentenceId, newText });
  }, []);

  const requestVersions = useCallback(() => {
    transportRef.current?.listVersions();
  }, []);

  const createVersion = useCallback((content: string, name?: string, source?: string) => {
    transportRef.current?.createVersion(content, name, source);
  }, []);

  const getVersion = useCallback((versionId: number) => {
    transportRef.current?.getVersion(versionId);
  }, []);

  const compareVersions = useCallback((a: number, b: number) => {
    transportRef.current?.compareVersions(a, b);
  }, []);

  const clearVersionCompare = useCallback(() => {
    dispatch({ type: "clear_version_compare" });
  }, []);

  const runOpposition = useCallback(
    (text: string, style?: string, model?: string, maxPasses?: number) => {
      dispatch({ type: "opposition_started" });
      transportRef.current?.runOpposition({ text, style, model, maxPasses });
    },
    [],
  );

  const clearOppositionResult = useCallback(() => {
    dispatch({ type: "clear_opposition_result" });
  }, []);

  const save = useCallback((content: string) => {
    transportRef.current?.save(content);
  }, []);

  return {
    profile: state.profile,
    progress: state.progress,
    status: state.status,
    error: state.error,
    analyze,
    rewriteStatus: state.rewriteStatus,
    rewriteStep: state.rewriteStep,
    rewriteAlternatives: state.rewriteAlternatives,
    requestRewriteAlternatives,
    clearRewriteAlternatives,
    versions: state.versions,
    requestVersions,
    createVersion,
    getVersion,
    compareVersions,
    versionContent: state.versionContent,
    versionCompare: state.versionCompare,
    clearVersionCompare,
    oppositionStatus: state.oppositionStatus,
    oppositionStep: state.oppositionStep,
    oppositionResult: state.oppositionResult,
    runOpposition,
    clearOppositionResult,
    rewriteSuggestions: state.rewriteSuggestions,
    batchTargetIds: state.batchTargetIds,
    batchInFlight: state.batchInFlight,
    suggestionsLoading: state.suggestionsLoading,
    suggestionsEmptyIds: state.suggestionsEmptyIds,
    suggestNotice: state.suggestNotice,
    requestSuggestions,
    clearRewriteSuggestions,
    dismissSuggestions,
    patchProfileSentenceText,
    save,
    lastSavedAt: state.lastSavedAt,
  };
}

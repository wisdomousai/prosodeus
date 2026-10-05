import type {
  AiSlopMatcherMode,
  EquilibriumResult,
  RewriteAlternative,
  RewriteConstraints,
  RewriteResult,
  RewriteSuggestion,
  StyleGuide,
  StylometricProfile,
} from "@prosodeus/core";

export type { AiSlopMatcherMode, RewriteAlternative, RewriteConstraints } from "@prosodeus/core";

// ─── Client → Server Messages ────────────────────────────────────────────────

/** `incremental` skips batched rewrite suggestions by default (heatmap refresh only). */
export type AnalyzeMode = "full" | "incremental";

export interface AnalyzeMessage {
  type: "analyze";
  text: string;
  style?: string;
  model?: string;
  /** Number of hottest sentences to pre-generate suggestions for (default 3, 0 = skip). */
  top_suggestions?: number;
  /** Default `full`. Incremental implies top_suggestions 0 unless overridden. */
  analyze_mode?: AnalyzeMode;
  disabled_patterns?: string[];
  /** Incremental: only re-classify these sentence IDs (+ paragraph neighbors). */
  changed_sentence_ids?: number[];
  /** `viewport` scopes incremental classify to visible sentences (client-driven). */
  scope?: "document" | "viewport";
  /** `batch` pre-generates top-N suggestions; default skips (lazy/on-focus). */
  suggest_mode?: "batch" | "none";
  /** Static Kimi/OAI candidate matcher depth. Default `tiered`. */
  ai_slop_mode?: AiSlopMatcherMode;
}

export type SuggestionModelMode = "single" | "council";

export interface RewriteMessage {
  type: "rewrite";
  text: string;
  style?: string;
  model?: string;
  passage_start?: number;
  passage_end?: number;
  use_pce?: boolean;
  /** When set with n > 1, the server runs n rewrites in parallel and emits a `rewrite_alternatives` event instead of `rewrite_result`. */
  n?: number;
  /** Editorial constraints (statement force, expression budget, etc.) chosen in the Rewrite tab. */
  constraints?: RewriteConstraints;
  /** Hint for how much surrounding context the LLM sees. Default "auto" = 1 paragraph before/after. */
  context_hint?: "paragraph" | "section" | "auto";
}

export interface EquilibriumMessage {
  type: "equilibrium";
  text: string;
  style?: string;
  model?: string;
}

export interface ReverseGuideMessage {
  type: "reverse_guide";
  text: string;
  name: string;
  description: string;
}

export interface SaveMessage {
  type: "save";
  content: string;
  content_format?: "prosemirror" | "plaintext";
}

export interface ListIterationsMessage {
  type: "list_iterations";
}

export interface LoadContentMessage {
  type: "load_content";
}

export interface ListVersionsMessage {
  type: "list_versions";
}

export interface CreateVersionMessage {
  type: "create_version";
  content: string;
  name?: string;
  source?: string;
}

export interface GetVersionMessage {
  type: "get_version";
  version_id: number;
}

export interface CompareVersionsMessage {
  type: "compare_versions";
  version_a: number;
  version_b: number;
}

export interface OppositionMessage {
  type: "opposition_run";
  text: string;
  style?: string;
  model?: string;
  max_passes?: number;
}

export type ClientMessage =
  | AnalyzeMessage
  | RewriteMessage
  | EquilibriumMessage
  | ReverseGuideMessage
  | SaveMessage
  | ListIterationsMessage
  | LoadContentMessage
  | ListVersionsMessage
  | CreateVersionMessage
  | GetVersionMessage
  | CompareVersionsMessage
  | OppositionMessage;

// ─── Server → Client Messages ────────────────────────────────────────────────

export interface ProgressEvent {
  type: "progress";
  total: number;
  cached: number;
  classifying: number;
  completed?: number;
}

export interface ProfileEvent {
  type: "profile";
  data: StylometricProfile;
}

/** Streaming heatmap updates while classification batches complete. */
export interface ProfilePartialEvent {
  type: "profile_partial";
  data: StylometricProfile;
  done: boolean;
}

/** Pre-computed rewrite suggestions, sent after `profile` once the heavier suggestion model finishes. */
export interface SuggestionsEvent {
  type: "suggestions";
  data: RewriteSuggestion[];
}

export interface RewriteProgressEvent {
  type: "rewrite_progress";
  step: string;
}

export interface RewriteResultEvent {
  type: "rewrite_result";
  data: RewriteResult;
}

export interface RewriteAlternativesEvent {
  type: "rewrite_alternatives";
  data: {
    original: string;
    constraints: RewriteConstraints | null;
    alternatives: RewriteAlternative[];
  };
}

export interface EquilibriumProgressEvent {
  type: "equilibrium_progress";
  round: number;
}

export interface EquilibriumResultEvent {
  type: "equilibrium_result";
  data: EquilibriumResult;
}

export interface ReverseGuideResultEvent {
  type: "reverse_guide_result";
  data: StyleGuide;
}

export interface IterationsEvent {
  type: "iterations";
  data: Iteration[];
}

export interface SavedEvent {
  type: "saved";
}

export interface ContentEvent {
  type: "content";
  data: string | null;
  content_format?: "prosemirror" | "plaintext";
}

export interface ErrorEvent {
  type: "error";
  message: string;
}

export interface VersionsEvent {
  type: "versions";
  data: Version[];
}

export interface VersionContentEvent {
  type: "version_content";
  data: { id: number; content: string; profile: StylometricProfile | null };
}

export interface VersionCompareEvent {
  type: "version_compare";
  data: {
    a: { id: number; content: string; profile: StylometricProfile | null };
    b: { id: number; content: string; profile: StylometricProfile | null };
  };
}

export interface OppositionProgressEvent {
  type: "opposition_progress";
  step: string;
}

export interface OppositionResultEvent {
  type: "opposition_result";
  data: {
    original_text: string;
    rewritten_text: string;
    edits: Array<{
      span: {
        sentence_id: number;
        sentence_end_id?: number;
        pattern_type: string;
        text: string;
        evidence?: string;
      };
      original_sentence: string;
      rewritten_sentence: string;
      verdict: "vacuous" | "earned" | "uncertain";
      fidelity_score: number;
      fidelity_reason: string;
      accepted: boolean;
      alternatives?: string[];
    }>;
    metrics: {
      passes: number;
      spans_detected: number;
      vacuous_spans: number;
      earned_spans: number;
      uncertain_spans: number;
      accepted_edits: number;
      rejected_edits: number;
      fidelity_failures: number;
    };
  };
}

export type ServerEvent =
  | ProgressEvent
  | ProfileEvent
  | ProfilePartialEvent
  | SuggestionsEvent
  | RewriteProgressEvent
  | RewriteResultEvent
  | RewriteAlternativesEvent
  | EquilibriumProgressEvent
  | EquilibriumResultEvent
  | ReverseGuideResultEvent
  | IterationsEvent
  | VersionsEvent
  | VersionContentEvent
  | VersionCompareEvent
  | OppositionProgressEvent
  | OppositionResultEvent
  | SavedEvent
  | ContentEvent
  | ErrorEvent;

// ─── Shared Data Types ───────────────────────────────────────────────────────

export interface Iteration {
  id: number;
  created_at: string;
  source: string;
  mean_heat: number;
  sentence_count: number;
  word_count: number;
}

export interface Version {
  id: number;
  name: string | null;
  source: string;
  created_at: string;
  word_count: number;
  mean_heat: number;
}

export type AnalysisStatus = "idle" | "connecting" | "analyzing" | "ready" | "error";
export type RewriteStatus = "idle" | "rewriting" | "done" | "error";
export type EquilibriumStatus = "idle" | "running" | "done" | "error";
export type OppositionStatus = "idle" | "running" | "done" | "error";

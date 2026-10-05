import type {
  RewriteSuggestion,
  SentenceClassification,
  StylometricProfile,
  SuggestionConfig,
} from "@prosodeus/core/browser";
import type {
  AnalyzeCallOptions,
  OppositionResultEvent,
  ProgressEvent,
  RewriteAlternativesEvent,
  RewriteConstraints,
  Version,
  VersionCompareEvent,
  VersionContentEvent,
} from "@prosodeus/shared/browser";

/**
 * Normalized events emitted by an AnalysisTransport. Both the cloud WebSocket
 * and the desktop IPC adapter translate their native message/promise shapes
 * into this union, so the session hook holds a single state machine.
 */
export type AnalysisEvent =
  | { type: "connection"; status: "connecting" | "connected" | "disconnected" }
  | { type: "progress"; progress: ProgressEvent }
  | { type: "profile_partial"; profile: StylometricProfile; done: boolean }
  | { type: "profile"; profile: StylometricProfile }
  /** Post-analyze batched background suggestions. */
  | { type: "batch_suggestions"; suggestions: RewriteSuggestion[] }
  | { type: "rewrite_progress"; step: string }
  | { type: "rewrite_alternatives"; data: RewriteAlternativesEvent["data"] }
  /** On-demand per-sentence suggestions (may be empty). */
  | { type: "sentence_suggestions"; suggestions: RewriteSuggestion[]; notice?: string }
  | { type: "versions"; versions: Version[] }
  | { type: "version_content"; data: VersionContentEvent["data"] }
  | { type: "version_compare"; data: VersionCompareEvent["data"] }
  | { type: "saved" }
  | { type: "analyze_error"; message: string }
  | { type: "rewrite_error"; message: string }
  | { type: "opposition_progress"; step: string }
  | { type: "opposition_result"; data: OppositionResultEvent["data"] }
  | { type: "opposition_error"; message: string }
  | { type: "suggest_error"; sentenceId: number; message: string; empty: boolean }
  /** Untyped server error (WS `error` message). */
  | { type: "error"; message: string };

export interface AnalyzeRequest {
  text: string;
  style?: string;
  model?: string;
  disabledPatterns?: string[];
  opts?: AnalyzeCallOptions;
  /** Resolved from opts + word count by the session before dispatch. */
  topSuggestions: number;
  suggestMode: "batch" | "none";
}

export interface RewriteAlternativesRequest {
  text: string;
  passageStart: number;
  passageEnd: number;
  constraints: RewriteConstraints;
  n: number;
  style?: string;
  model?: string;
}

export interface SuggestRequest {
  sentenceId: number;
  documentText: string;
  config?: Partial<SuggestionConfig>;
  profileSentence?: { text: string; classification: SentenceClassification };
}

export interface OppositionRequest {
  text: string;
  style?: string;
  model?: string;
  maxPasses?: number;
}

export interface AnalysisTransport {
  /** Open the connection (if any) and start delivering events. Returns dispose. */
  connect(onEvent: (event: AnalysisEvent) => void): () => void;
  analyze(req: AnalyzeRequest): void;
  rewriteAlternatives(req: RewriteAlternativesRequest): void;
  suggest(req: SuggestRequest): void;
  runOpposition(req: OppositionRequest): void;
  save(content: string): void;
  listVersions(): void;
  createVersion(content: string, name?: string, source?: string): void;
  getVersion(versionId: number): void;
  compareVersions(a: number, b: number): void;
}

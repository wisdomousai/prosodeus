// WebSocket client

export type { AnalyzeCallOptions } from "./analyze-params.ts";
export {
  isBatchSuggestEnabled,
  isIncrementalAnalyze,
  resolveAnalyzeTopSuggestions,
  resolveBackgroundSuggestTopN,
} from "./analyze-params.ts";
export type {
  DocumentMeta,
  DocumentStatus,
  FolderMeta,
  ModelInfo,
  StyleInfo,
  TemplateMeta,
  TokenStorage,
  UserProfile,
  WorkspaceAnalytics,
  WorkspaceMeta,
  WorkspaceSettings,
} from "./api-client.ts";
// API client
export { ApiClient } from "./api-client.ts";
// Pattern management types
export type {
  PatternCreateRequest,
  PatternDetail,
  PatternExportPayload,
  PatternForkRequest,
  PatternImportRequest,
  PatternImportResult,
  PatternListItem,
  PatternListResponse,
  PatternScope,
  PatternUpdateRequest,
  PatternVersion,
} from "./pattern-types.ts";
// Pure helpers
export {
  DEFAULT_REWRITE_CONSTRAINTS,
  describeTone,
  encodeConstraintsAsDirectives,
  summarizeStructuralChange,
} from "./rewrite-constraints.ts";
export type { MeaningRiskLevel } from "./rewrite-meaning-assessment.ts";
export { assessRewriteMeaning } from "./rewrite-meaning-assessment.ts";
// User-defined style types
export type {
  UserStyle,
  UserStyleCreateRequest,
  UserStyleListResponse,
  UserStyleUpdateRequest,
  UserStyleVersion,
  UserStyleVersionListResponse,
} from "./style-types.ts";
export { WSClient } from "./ws-client.ts";
// WebSocket message types
export type {
  AiSlopMatcherMode,
  AnalysisStatus,
  AnalyzeMessage,
  // Client → Server
  AnalyzeMode,
  ClientMessage,
  CompareVersionsMessage,
  ContentEvent,
  CreateVersionMessage,
  EquilibriumMessage,
  EquilibriumProgressEvent,
  EquilibriumResultEvent,
  EquilibriumStatus,
  ErrorEvent,
  GetVersionMessage,
  // Shared
  Iteration,
  IterationsEvent,
  ListIterationsMessage,
  ListVersionsMessage,
  LoadContentMessage,
  OppositionMessage,
  OppositionProgressEvent,
  OppositionResultEvent,
  OppositionStatus,
  ProfileEvent,
  // Server → Client
  ProgressEvent,
  ReverseGuideMessage,
  ReverseGuideResultEvent,
  RewriteAlternative,
  RewriteAlternativesEvent,
  // Rewrite constraints (Packet 2)
  RewriteConstraints,
  RewriteMessage,
  RewriteProgressEvent,
  RewriteResultEvent,
  RewriteStatus,
  SavedEvent,
  SaveMessage,
  ServerEvent,
  SuggestionsEvent,
  Version,
  VersionCompareEvent,
  VersionContentEvent,
  VersionsEvent,
} from "./ws-types.ts";

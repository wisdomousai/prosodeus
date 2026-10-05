// Types

// Aggregation
export { computeConvergence, computeWindows } from "./analysis/aggregation.ts";
export type { AnalyzeOptions, AnalyzeProgress } from "./analysis/analyze.ts";
// Analyze (top-level pipeline)
export { analyze } from "./analysis/analyze.ts";
export type { HotSentenceSelectOpts } from "./analysis/hot-sentences.ts";
export {
  listEligibleHotSentences,
  resolveBackgroundSuggestBudget,
  selectHotSentencesForSuggest,
  selectHotSentencesFromProfile,
  sentenceImpactScore,
} from "./analysis/hot-sentences.ts";
export type {
  ParagraphAnalysis,
  ParagraphPurpose,
  ParagraphTargets,
} from "./analysis/paragraph-purpose.ts";
// Paragraph Purpose
export { classifyParagraphs, getPurposeTargets } from "./analysis/paragraph-purpose.ts";
// Profile
export { assembleProfile, detectHotRegions } from "./analysis/profile.ts";
// Style Guide
export {
  BUILT_IN_GUIDES,
  computeDelta,
  listStyleGuides,
  loadStyleGuide,
  reverseEngineerGuide,
} from "./analysis/style-guide.ts";
export {
  attachAiSlopCandidates,
  extractAiSlopCandidates,
  normalizeAiSlopMatcherMode,
  stripAiSlopCandidates,
} from "./classification/ai-slop-candidates.ts";
export type { ClassifierOptions } from "./classification/classifier.ts";
// Classifier
export {
  AgentSDKClassifier,
  computeHeat,
  getDefaultClassification,
  LLMClassifier,
  SYSTEM_PROMPT,
} from "./classification/classifier.ts";
export type {
  ClassifyPipelineOpts,
  ClassifyScopeOpts,
} from "./classification/classify-pipeline.ts";
export {
  classifyUncachedPipeline,
  filterUncachedScope,
} from "./classification/classify-pipeline.ts";
export {
  GATE_ESCALATION_THRESHOLD,
  GATE_PATTERN_IDS,
  GATE_SYSTEM_PROMPT,
  GateClassifier,
  gateNeedsFullClassification,
  gateNeedsMediumClassification,
} from "./classification/gate-classifier.ts";
export { heuristicScreen, heuristicScreenBatch } from "./classification/heuristic-screen.ts";
export {
  FULL_ESCALATION_THRESHOLD,
  MEDIUM_ESCALATION_THRESHOLD,
  MEDIUM_SYSTEM_PROMPT,
  MediumClassifier,
} from "./classification/medium-classifier.ts";
export { createAgentSDKModel } from "./models/agent-sdk-model.ts";
export type {
  CodexCatalogModel,
  CodexModelConfig,
  CodexModelMode,
  CodexTaskDepth,
  CodexTaskModelSelection,
} from "./models/codex-config.ts";
export {
  CODEX_DEFAULT_MODEL_SPEC,
  CODEX_LOCAL_HOST_MODE,
  codexModelConfigFromCatalog,
  codexModelSpec,
  codexRawModelId,
  DEFAULT_CODEX_MODEL,
  isCodexModelSpec,
  selectCodexTaskModel,
  visibleCodexModels,
} from "./models/codex-config.ts";
export type {
  LlmTask,
  ModelCapability,
  SuggestModelResolution,
  SuggestOutputProfile,
} from "./models/model-capabilities.ts";
// Task-aware model routing (suggest vs rewrite vs classify)
export {
  modelCapabilityForSpec,
  resolveSuggestCapableSpec,
  STANDARD_SUGGEST_OUTPUT,
  SUGGEST_CAPABLE_SPECS,
  SUGGEST_OUTPUT_BY_SPEC,
  suggestOutputForSpec,
  supportsTask,
  THINKING_SUGGEST_OUTPUT,
} from "./models/model-capabilities.ts";
export type { MoonshotClientConfig, MoonshotKeyKind } from "./models/moonshot-config.ts";
// Moonshot / Kimi endpoint routing (developer vs Kimi Code keys)
export {
  KIMI_CODING_BASE,
  listMoonshotModelOptions,
  MOONSHOT_CN_BASE,
  MOONSHOT_DEVELOPER_BASE,
  moonshotKeyKind,
  resolveMoonshotClient,
} from "./models/moonshot-config.ts";
export type { ClassifyPhase, ProviderSpeedProfile } from "./models/provider-speed.ts";
export {
  estimateOutputTokens,
  isRateLimitError,
  isRetryableProviderError,
  providerFromModelSpec,
  resolveSpeedProfile,
  splitBatchForRetry,
} from "./models/provider-speed.ts";
export type { CostReport, Intervention, ModelCost, ModelTier } from "./models/routing.ts";
// Smart Routing
export {
  classifyModelTier,
  estimateCost,
  estimateTokens,
  getModelCost,
  planInterventions,
} from "./models/routing.ts";
// Opposition rewriter (vacuous binary-opposition removal)
export type {
  OppositionEdit,
  OppositionMetrics,
  OppositionResult,
  OppositionSpan,
  OppositionSpanSource,
  RewriteOppositionsOptions,
  SubstanceVerdict,
} from "./opposition/index.ts";
export {
  checkFidelity,
  rewriteOppositions,
  rewriteSpan,
  scoreSubstance,
} from "./opposition/index.ts";
export type {
  CopyPlaybook,
  PlaybookAuditCheck,
  PlaybookLayer,
  PlaybookLayerId,
  PlaybookPlatform,
  PlaybookPlatformPreset,
} from "./playbooks/copy-playbook.ts";
export { COPY_PLAYBOOK, PLAYBOOK_PLATFORMS } from "./playbooks/copy-playbook.ts";
export type {
  BuildPlaybookPromptOptions,
  PlaybookAuditReport,
  PlaybookAuditResult,
  PlaybookAuditStatus,
  PlaybookCluster,
  PlaybookLayerScore,
  PlaybookLayerScores,
} from "./playbooks/playbook.ts";
export {
  buildPlaybookPrompt,
  filterPlaybookClusters,
  getPlatformPreset,
  getPlaybookPatternIds,
  runPlaybookAudit,
  scorePlaybookLayers,
} from "./playbooks/playbook.ts";
// Report
export { generateHtmlReport } from "./reporting/report.ts";
export type { ConstraintDocument, RewriteHistory } from "./rewrite/constraints.ts";
// Constraints
export { generateConstraints } from "./rewrite/constraints.ts";
export type {
  CouncilRound,
  EquilibriumResult,
  FindEquilibriumOptions,
  StructuralSketch,
} from "./rewrite/equilibrium.ts";
// Equilibrium Engine
export { findEquilibrium } from "./rewrite/equilibrium.ts";
// PCE (Propositional Content Extraction)
export {
  buildNegativeConstraints,
  buildPositiveTargets,
  extractPropositions,
  runPCE,
} from "./rewrite/pce.ts";
export type {
  MeaningRiskLevel,
  RewriteAlternative,
  RewriteConstraints,
} from "./rewrite/rewrite-policy.ts";
export {
  assessRewriteMeaning,
  DEFAULT_REWRITE_CONSTRAINTS,
  describeTone,
  encodeConstraintsAsDirectives,
  summarizeStructuralChange,
} from "./rewrite/rewrite-policy.ts";
// Rewriter
export { rewritePassage } from "./rewrite/rewriter.ts";
export type { SuggestOptions, SuggestTokenBudgetOpts } from "./rewrite/suggest.ts";
// Rewrite Suggestions
export {
  suggestGenericRewrites,
  suggestMaxOutputTokens,
  suggestRewrites,
  suggestRewritesBatch,
} from "./rewrite/suggest.ts";
export {
  filterRewriteSuggestion,
  filterRewriteSuggestions,
  isPlaceholderSuggestion,
  isValidRewriteSuggestion,
} from "./rewrite/suggestion-validation.ts";
export type {
  AnalyzeOpts,
  AnalyzeRunResult,
  ClassifyProgress,
  ClassifyResult,
  ClassifyTextOpts,
  EngineContext,
  EquilibriumOpts,
  ProfileSentenceSnapshot,
  ReverseGuideOpts,
  RewriteAlternativesResult,
  RewriteEngineResult,
  RewriteOpts,
  RewriteSingleResult,
  SuggestOpts,
} from "./runtime/engine.ts";
// Shared Engine (classify→cache→profile→action pipeline)
export {
  classifyText,
  engineAnalyze,
  engineEquilibrium,
  engineReverseGuide,
  engineRewrite,
  engineSuggest,
  resolveSuggestModel,
  SUGGEST_MODEL_SPECS,
} from "./runtime/engine.ts";
export type { ClassificationCache, StoredSuggestion, SuggestionCache } from "./storage/cache.ts";
// Cache
export { LocalCache, NullCache } from "./storage/cache.ts";
export type {
  PatternEntry,
  PatternExample,
  PatternFalsePositive,
  PatternFalseSubstitution,
  PatternLevel,
  PatternSeverity,
  PatternSubstitution,
  ResearchSource,
  RewriteOption,
  SelfAmplification,
  StyleGenre,
} from "./taxonomy/pattern-registry.ts";
// Pattern Registry (single source of truth for all pattern data)
export {
  getConstraintDirective,
  getHeatWeight,
  getPattern,
  getPatternByTaxonomyId,
  getPatternsByLevel,
  getPatternsByTag,
  getPCEDirective,
  getTolerance,
  getValidPatternIds,
  PATTERN_REGISTRY,
  rollRewriteOption,
} from "./taxonomy/pattern-registry.ts";
// Math utilities
export {
  computeAutocorrelation,
  computeDeviceEntropy,
  computeFunctionWordRatio,
  computeHapaxRatio,
  computeMATTR,
  computeOpeningVariety,
  computeTTR,
  computeWordLengthEntropy,
  countWords,
  shannonEntropy,
} from "./text/math.ts";
// ProseMirror text extraction (server-side)
export { extractPlainTextFromJSON } from "./text/prosemirror-text.ts";
// Splitter
export {
  diffChangedSentenceIds,
  diffSentences,
  splitAndHash,
  splitSentences,
} from "./text/splitter.ts";
export type {
  AiSlopCandidateMatch,
  AiSlopCandidateSource,
  AiSlopMatcherMode,
  AiSlopMatcherRole,
  AnalyzeRequest,
  AnalyzeResponse,
  BiberDimensions,
  ClassifiedSentence,
  DetectedPattern,
  HashedSentence,
  HotRegion,
  PatternType,
  PCEResult,
  Proposition,
  PropositionGraph,
  ProviderAdapter,
  RewriteOptions,
  RewriteResult,
  RewriteSuggestion,
  SentenceClassification,
  SentenceMetrics,
  StyleGuide,
  StyleGuideDelta,
  StyleGuideTargets,
  StylometricProfile,
  SuggestionConfig,
  SuggestionLevel,
  WindowMetrics,
  WindowSize,
} from "./types.ts";

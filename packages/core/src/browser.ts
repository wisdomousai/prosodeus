export {
  listEligibleHotSentences,
  resolveBackgroundSuggestBudget,
  selectHotSentencesFromProfile,
  sentenceImpactScore,
} from "./analysis/hot-sentences.ts";
export type {
  ParagraphAnalysis,
  ParagraphPurpose,
  ParagraphTargets,
} from "./analysis/paragraph-purpose.ts";
export {
  computeDelta,
  listStyleGuides,
  loadStyleGuide,
  reverseEngineerGuide,
} from "./analysis/style-guide.ts";
export {
  extractAiSlopCandidates,
  normalizeAiSlopMatcherMode,
} from "./classification/ai-slop-candidates.ts";
export {
  OPPOSITION_PATTERN_TYPES,
  type OppositionParagraphHit,
  type OppositionScan,
  type OppositionSectionHit,
  type OppositionSentenceHit,
  scanOppositions,
} from "./opposition/opposition-scan.ts";
export type { LexiconHit, LexiconSwap } from "./playbooks/copy-lexicon.ts";
export { COPY_LEXICON, formatLexiconSwaps, lexiconHits } from "./playbooks/copy-lexicon.ts";
export type {
  CopyPlaybook,
  PlaybookLayerId,
  PlaybookPlatform,
} from "./playbooks/copy-playbook.ts";
export {
  COPY_PLAYBOOK,
  getPlaybookPatternIds,
  PLAYBOOK_PLATFORMS,
} from "./playbooks/copy-playbook.ts";
export type {
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
  getLexiconHitsForText,
  getLexiconSwapLines,
  getPlatformPreset,
  runPlaybookAudit,
  scorePlaybookLayers,
} from "./playbooks/playbook.ts";
export { generateHtmlReport } from "./reporting/report.ts";
export type {
  ConstraintDocument,
  GenerateConstraintsOptions,
  PlaybookId,
} from "./rewrite/constraints.ts";
export { generateConstraints } from "./rewrite/constraints.ts";
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
export {
  filterRewriteSuggestion,
  filterRewriteSuggestions,
  isPlaceholderSuggestion,
  isValidRewriteSuggestion,
} from "./rewrite/suggestion-validation.ts";
export type { PatternEntry } from "./taxonomy/pattern-registry.ts";
export { getPattern } from "./taxonomy/pattern-registry.ts";
export { diffChangedSentenceIds, diffSentences, splitAndHash } from "./text/splitter.ts";
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

export interface StructuralSketch {
  region: { start: number; end: number };
  description: string;
  predicted_heat_reduction: number;
}

export interface CouncilRound {
  round: number;
  sketches: StructuralSketch[];
  simulated_heat: number;
  simulated_entropy: number;
  converged: boolean;
}

export interface EquilibriumResult {
  rounds: CouncilRound[];
  converged: boolean;
  final_heat: number;
  final_entropy: number;
  blueprint: StructuralSketch[];
  paragraph_purposes: import("./analysis/paragraph-purpose.ts").ParagraphAnalysis[];
  cost_estimate: { council_tokens: number; classifier_tokens: number };
}

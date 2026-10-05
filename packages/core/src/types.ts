// ─── Classifier Output (per sentence) ────────────────────────────────────────

export interface BiberDimensions {
  informational: number; // 0-1 confidence
  involved: number;
  narrative: number;
  persuasive: number;
  abstract: number;
  elaborative: number;
}

// Level 1: Lexical patterns
// Level 2: Sentence patterns
// Level 3: Paragraph patterns (detected per-sentence where applicable)
// Level 4: Document patterns (detected at profile/window level)
export type PatternType =
  // L-01 through L-08: Lexical (original)
  | "importance_inflation"
  | "resumptive_phrase"
  | "hedging"
  | "transition_formulaic"
  | "em_dash_overuse"
  | "nominalization"
  | "llm_fingerprint_word"
  | "tricolon_abstract"
  // L-09 through L-19: Lexical (expansion round 1)
  | "auxiliary_verb_inflation"
  | "personal_pronoun_skew"
  | "downtoner_divergence"
  | "content_function_ratio"
  | "temporal_sweeping_opener"
  | "epistemic_stance_deficit"
  | "vocabulary_smoothing"
  | "elegant_variation"
  | "contraction_fingerprint"
  | "intensifier_saturation"
  | "evasive_complexity"
  // L-20 through L-25: Lexical (expansion round 2 — tropes.fyi, GPTZero, NYT)
  | "idiom_avoidance"
  | "copula_substitution"
  | "marketing_register_leak"
  | "spectral_vocabulary_palette"
  | "character_name_convergence"
  | "invented_concept_label"
  // S-01 through S-10: Sentence (original)
  | "binary_contrast"
  | "participial_cascade"
  | "clause_symmetry"
  | "that_subject"
  | "sentence_length_clustering"
  | "exhaustive_setup"
  | "phrasal_coordination_chain"
  | "agentless_passive"
  | "imperative_opening"
  | "definitional_opening"
  // S-11 through S-20: Sentence (expansion round 1)
  | "subordinate_clause_inflation"
  | "clausal_coordination_divergence"
  | "dependency_distance_deficit"
  | "sentence_opener_repetition"
  | "punctuation_skew"
  | "monolithic_tense"
  | "cataphoric_deficit"
  | "concessive_while"
  | "weak_verb_padding"
  | "additive_negative_parallelism"
  // S-21 through S-26: Sentence (expansion round 2)
  | "negation_reframe"
  | "rhetorical_qa_cadence"
  | "svo_rigidity"
  | "over_explanation"
  | "forced_synesthesia"
  | "whether_universal_closer"
  // P-01 through P-07: Paragraph (original)
  | "general_specific_evaluative"
  | "resolution_complete"
  | "uniform_paragraph_length"
  | "topic_sentence_first"
  | "concluding_summary"
  | "parallel_paragraph_structure"
  | "vignette_then_principle"
  // P-08 through P-12: Paragraph (expansion round 1)
  | "dense_but_disconnected"
  | "markdown_compulsion"
  | "generic_specificity"
  | "rst_discourse_skew"
  | "inline_header_lists"
  // P-13 through P-15: Paragraph (expansion round 2)
  | "blocky_scene_architecture"
  | "listicle_in_trenchcoat"
  | "manufactured_fragments"
  // D-07 through D-10: Document (expansion round 1)
  | "emotional_positivity_bias"
  | "readability_uniformity"
  | "specificity_gradient_flat"
  | "cross_domain_rigidity"
  // D-11 through D-16: Document (expansion round 2)
  | "grammatical_perfection"
  | "digression_absence"
  | "vocabulary_collapse_over_length"
  | "sycophantic_closing"
  | "interactional_metadiscourse_deficit"
  | "cross_model_consensus";

export type AiSlopMatcherMode = "off" | "fast" | "tiered" | "exhaustive";

export type AiSlopCandidateSource = "kimi_field_manual" | "oai_regex_bundle";

export type AiSlopMatcherRole =
  | "manual_phrase"
  | "family_router"
  | "mechanism_router"
  | "surface_exact_or_near_exact"
  | "composite_group";

export interface AiSlopCandidateMatch {
  source: AiSlopCandidateSource;
  source_id: string;
  category: string;
  subcategory: string;
  matcher_role: AiSlopMatcherRole;
  evidence: string;
  start?: number;
  end?: number;
  mapped_pattern_types: PatternType[];
  verdict: "candidate_only";
}

export interface DetectedPattern {
  type: PatternType;
  confidence: number; // 0-1
  evidence: string; // the specific text that triggered detection
}

export interface SentenceMetrics {
  word_count: number;
  clause_count: number;
  has_participial: boolean;
  has_relative_clause: boolean;
  clause_balance_ratio: number; // 0-1, 0.5 = perfectly balanced
  construction_type: string; // e.g. "simple", "compound", "complex", "compound-complex"
}

export interface SentenceClassification {
  biber: BiberDimensions;
  patterns: DetectedPattern[];
  ai_slop_candidates?: AiSlopCandidateMatch[];
  metrics: SentenceMetrics;
  arc_role: string; // e.g. "claim", "evidence", "pivot", "resolution", "transition"
}

// ─── Splitter Output ─────────────────────────────────────────────────────────

export interface HashedSentence {
  id: number;
  text: string;
  hash: string;
  paragraph_id: number;
}

export interface ClassifiedSentence extends HashedSentence {
  classification: SentenceClassification;
  heat: number; // 0-10 composite score
}

// ─── Aggregation ─────────────────────────────────────────────────────────────

export type WindowSize = "narrow" | "medium" | "wide";

export interface WindowMetrics {
  size: WindowSize;
  start_sentence: number;
  end_sentence: number;
  word_count: number;

  // Pattern densities (hits per 100 words)
  pattern_density: Record<PatternType, number>;

  // Shannon entropy of Biber dimension tags
  biber_entropy: number;

  // Shannon entropy of sentence lengths
  length_entropy: number;

  // Device entropy: how evenly distributed rhetorical moves are
  device_entropy: number;

  // Autocorrelation of sentence lengths (target: ρ < 0.3)
  sentence_length_autocorrelation: number;

  // Co-occurrence: which patterns appear together
  co_occurrence: Array<[PatternType, PatternType, number]>;

  // Lexical diversity metrics
  ttr: number; // Type-Token Ratio (unique/total words)
  hapax_ratio: number; // Hapax legomena ratio (words appearing once / total)
  word_length_entropy: number; // Shannon entropy of word length distribution
  opening_variety: number; // Ratio of unique sentence openings
  function_word_ratio: number; // Function words / total words
}

export interface HotRegion {
  start_sentence: number;
  end_sentence: number;
  heat: number; // 0-10
  primary_patterns: PatternType[];
  description: string;
}

// ─── Style Guide ─────────────────────────────────────────────────────────────

export interface StyleGuideTargets {
  sentence_length: { mean: number; std_dev: number; min: number; max: number };
  nominalization_ratio: { max: number };
  participial_density: { max: number };
  clause_symmetry: { max_balance: number };
  paragraph_arc_diversity: { max_consecutive_same: number };
  resolution_completeness: { target: number };
  binary_contrast_frequency: { per_1000_words: { min: number; max: number } };
  sentence_length_autocorrelation: { max_rho: number };
  device_entropy: { min: number };
  importance_inflation: { max: number };
  transition_formulaicness: { max_ratio: number };
}

export interface StyleGuide {
  name: string;
  description: string;
  targets: StyleGuideTargets;
  continuity_parameter: number; // 0-1
  is_premium?: boolean;
  price_cents?: number;
  author?: string;
}

export interface StyleGuideDelta {
  guide: string;
  violations: Array<{
    dimension: string;
    current: number;
    target: number;
    severity: "low" | "medium" | "high";
  }>;
  overall_distance: number; // 0-1 normalized
}

// ─── Profile (top-level analysis result) ─────────────────────────────────────

export interface StylometricProfile {
  // Input metadata
  word_count: number;
  sentence_count: number;
  paragraph_count: number;

  // Per-sentence data
  sentences: ClassifiedSentence[];

  // Windowed aggregation
  windows: WindowMetrics[];

  // Hot regions (clusters of problems)
  hot_regions: HotRegion[];

  // Convergence: is entropy decreasing over document position?
  convergence_slope: number; // negative = decaying variety (bad)

  // Global metrics
  global_biber_entropy: number;
  global_device_entropy: number;
  global_sentence_length_autocorrelation: number;
  mean_heat: number;

  // Lexical diversity (global)
  global_ttr: number;
  global_mattr: number; // Moving Average TTR (length-corrected)
  global_hapax_ratio: number;
  global_word_length_entropy: number;
  global_opening_variety: number;
  global_function_word_ratio: number;

  // Style guide comparison (if guide provided)
  delta?: StyleGuideDelta;
}

// ─── PCE (Propositional Content Extraction) ─────────────────────────────────

export interface Proposition {
  subject: string;
  predicate: string;
  object?: string;
  modifiers?: string[];
}

export interface PropositionGraph {
  propositions: Proposition[];
  logical_flow: string[]; // e.g. ["1 CAUSES 2", "3 CONTRASTS 4"]
}

export interface PCEResult {
  /** Channel 1: Style-neutral proposition graph */
  propositions: PropositionGraph;
  /** Channel 2: Negative structural constraints (what to avoid) */
  avoid: string[];
  /** Channel 3: Positive style targets (how to write) */
  targets: string[];
}

// ─── Rewrite ────────────────────────────────────────────────────────────────

export interface RewriteOptions {
  /** The full profile from analysis */
  profile: StylometricProfile;
  /** Sentence range to rewrite (inclusive) */
  passageRange?: { start: number; end: number };
  /** Style guide name */
  style?: string;
  /** Whether to run PCE decomposition (slower but higher quality) */
  usePCE?: boolean;
  /** Progress callback */
  onProgress?: (step: string) => void;
  /** Override the rewrite system prompt (loaded from D1) */
  rewriteSystemPrompt?: string;
  /** Override the classifier system prompt (loaded from D1) */
  classifierSystemPrompt?: string;
  /** Extra editorial directives (e.g. "Statement force: measured", "Expression budget: allow one strongest expression"). Appended to the constraints sent to the model. */
  editorialDirectives?: string[];
  /** Slight temperature / phrasing perturbation seed when generating multiple alternatives. */
  variantSeed?: number;
}

export interface RewriteResult {
  /** The rewritten text */
  text: string;
  /** Original passage text */
  original: string;
  /** Metrics comparison */
  before: {
    mean_heat: number;
    device_entropy: number;
    autocorrelation: number;
    pattern_count: number;
  };
  after: {
    mean_heat: number;
    device_entropy: number;
    autocorrelation: number;
    pattern_count: number;
  };
  /** PCE data if usePCE was true */
  pce?: PCEResult;
  /** Constraints used for the rewrite */
  constraints: { avoid: string[]; targets: string[] };
}

// ─── Rewrite Suggestions ────────────────────────────────────────────────────

export type SuggestionLevel = "word" | "sentence" | "paragraph";

export interface SuggestionConfig {
  models: string[];
  mode?: "single" | "council";
  level: SuggestionLevel;
  num_alternatives: number;
  custom_instruction?: string;
}

export interface RewriteSuggestion {
  original: string;
  alternatives: Array<{ text: string; rationale: string }>;
  pattern_type: PatternType;
  sentence_id: number;
  model_name?: string;
  level?: SuggestionLevel;
}

// ─── API Types ───────────────────────────────────────────────────────────────

export interface AnalyzeRequest {
  text: string;
  style?: string; // style guide name
}

export interface AnalyzeResponse extends StylometricProfile {}

// ─── Provider Adapter ────────────────────────────────────────────────────────

/**
 * A provider adapter encapsulates everything needed to call a specific
 * LLM inference endpoint. Implement this interface to add a new provider.
 *
 * The classifier calls buildRequest() to get fetch params, then parseResponse()
 * to extract the completion text. This lets adapters handle auth, custom headers,
 * non-OpenAI response shapes, etc.
 */
export interface ProviderAdapter {
  readonly name: string;

  /** Number of sentences per API call */
  readonly batchSize: number;

  /** Max concurrent API calls */
  readonly maxParallel: number;

  /**
   * Build a fetch Request for the given prompt.
   * The adapter controls URL, method, headers, and body shape.
   */
  buildRequest(systemPrompt: string, userPrompt: string): Request;

  /**
   * Extract the completion text from the provider's response body.
   * Called with the parsed JSON body of a successful response.
   */
  parseResponse(body: unknown): string;
}

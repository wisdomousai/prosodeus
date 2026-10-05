import { LLM_MARKER_MATCHERS } from "../taxonomy/llm-marker-matchers.ts";
import { LLM_MARKER_PATTERNS } from "../taxonomy/llm-marker-patterns.ts";
import type {
  AiSlopCandidateMatch,
  AiSlopCandidateSource,
  AiSlopMatcherMode,
  AiSlopMatcherRole,
  HashedSentence,
  PatternType,
  SentenceClassification,
} from "../types.ts";

const DEFAULT_MODE: AiSlopMatcherMode = "tiered";

const FAST_MARKER_IDS = new Set([
  "abstract_noun",
  "additive_transition",
  "balanced_formula",
  "capability_claim",
  "chatbot_signoff",
  "chatgpt_quirk",
  "claude_quirk",
  "compare_contrast_frame",
  "contrastive_formula",
  "contrastive_negation",
  "emphasis_transition",
  "empty_conclusion",
  "erudite_adjective",
  "gemini_quirk",
  "hedge_phrase",
  "hedged_transition",
  "hyperbolic_adjective",
  "persona_flattening",
  "safety_disclaimer",
  "signposting_filler",
  "spatial_metaphor",
  "stereotyped_opener",
  "superlative",
  "sycophantic_opener",
  "vague_contextualizer",
]);

const MARKER_TO_PATTERN_TYPES: Record<string, PatternType[]> = {
  abstract_noun: ["llm_fingerprint_word", "evasive_complexity", "generic_specificity"],
  academic_transition: ["transition_formulaic", "llm_fingerprint_word"],
  additive_transition: ["transition_formulaic"],
  aspirational_noun: ["marketing_register_leak", "importance_inflation"],
  balanced_formula: ["clause_symmetry", "binary_contrast"],
  capability_claim: ["marketing_register_leak", "importance_inflation"],
  chatbot_signoff: ["sycophantic_closing", "emotional_positivity_bias"],
  chatgpt_quirk: ["llm_fingerprint_word"],
  claude_quirk: ["llm_fingerprint_word"],
  compare_contrast_frame: ["binary_contrast", "clause_symmetry"],
  content_farm_formula: ["listicle_in_trenchcoat", "generic_specificity"],
  contrastive_formula: ["binary_contrast"],
  contrastive_negation: ["negation_reframe", "binary_contrast"],
  emphasis_transition: ["transition_formulaic", "importance_inflation"],
  empowerment_verb: ["marketing_register_leak"],
  empty_conclusion: ["concluding_summary", "sycophantic_closing"],
  encouragement_phrase: ["emotional_positivity_bias", "sycophantic_closing"],
  engagement_bait: ["marketing_register_leak", "listicle_in_trenchcoat"],
  engagement_deficit: ["interactional_metadiscourse_deficit"],
  erudite_adjective: ["llm_fingerprint_word", "importance_inflation"],
  excess_noun: ["nominalization", "evasive_complexity"],
  faux_balance: ["binary_contrast", "concessive_while"],
  formal_verb: ["llm_fingerprint_word", "weak_verb_padding"],
  gemini_quirk: ["llm_fingerprint_word"],
  hedge_phrase: ["hedging"],
  hedge_uplink_combo: ["hedging", "importance_inflation"],
  hedged_complexity: ["hedging", "evasive_complexity"],
  hedged_transition: ["transition_formulaic", "hedging"],
  hyperbolic_adjective: ["importance_inflation", "intensifier_saturation"],
  impact_verb: ["importance_inflation", "weak_verb_padding"],
  innovation_adjective: ["marketing_register_leak", "importance_inflation"],
  journey_metaphor: ["marketing_register_leak", "spectral_vocabulary_palette"],
  listicle_frame: ["listicle_in_trenchcoat"],
  meta_commentary: ["resumptive_phrase", "interactional_metadiscourse_deficit"],
  outcome_inflator: ["importance_inflation"],
  outcome_noun: ["marketing_register_leak", "nominalization"],
  paragraph_template: ["parallel_paragraph_structure", "general_specific_evaluative"],
  persona_flattening: ["sycophantic_closing", "interactional_metadiscourse_deficit"],
  process_noun: ["nominalization"],
  pseudo_empathy: ["emotional_positivity_bias", "sycophantic_closing"],
  rlhf_artifact: ["sycophantic_closing", "llm_fingerprint_word"],
  safety_disclaimer: ["sycophantic_closing", "generic_specificity"],
  scholarly_adverb: ["llm_fingerprint_word"],
  scope_inflator: ["importance_inflation", "evasive_complexity"],
  search_optimizer: ["listicle_in_trenchcoat", "generic_specificity"],
  significance_claim: ["importance_inflation"],
  signposting_filler: ["transition_formulaic", "resumptive_phrase"],
  sophistication_adjective: ["llm_fingerprint_word", "importance_inflation"],
  spatial_metaphor: ["llm_fingerprint_word", "spectral_vocabulary_palette"],
  stereotyped_opener: ["temporal_sweeping_opener", "transition_formulaic"],
  strategy_verb: ["marketing_register_leak", "weak_verb_padding"],
  structural_padding: ["over_explanation", "resumptive_phrase"],
  superlative: ["importance_inflation", "intensifier_saturation"],
  sycophancy_pattern: ["sycophantic_closing", "emotional_positivity_bias"],
  sycophantic_opener: ["sycophantic_closing"],
  synergy_marker: ["marketing_register_leak", "llm_fingerprint_word"],
  temporal_framer: ["temporal_sweeping_opener"],
  title_template: ["listicle_in_trenchcoat", "generic_specificity"],
  triadic_list: ["tricolon_abstract", "phrasal_coordination_chain"],
  uplift_formula: ["emotional_positivity_bias", "marketing_register_leak"],
  vague_contextualizer: ["generic_specificity", "temporal_sweeping_opener"],
  voice_flattening: ["interactional_metadiscourse_deficit", "readability_uniformity"],
};

const COMMON_TRIGGER_WORDS = new Set([
  "about",
  "above",
  "across",
  "against",
  "also",
  "because",
  "between",
  "could",
  "does",
  "from",
  "have",
  "into",
  "more",
  "most",
  "other",
  "should",
  "that",
  "their",
  "there",
  "these",
  "this",
  "through",
  "while",
  "with",
  "within",
  "would",
]);

const metadataById = new Map(LLM_MARKER_PATTERNS.map((entry) => [entry.id, entry]));
const triggerTermsById = new Map(
  Object.entries(LLM_MARKER_MATCHERS).map(([id, regexes]) => [id, inferTriggerTerms(regexes)]),
);

export function normalizeAiSlopMatcherMode(mode?: AiSlopMatcherMode | null): AiSlopMatcherMode {
  if (mode === "off" || mode === "fast" || mode === "tiered" || mode === "exhaustive") {
    return mode;
  }
  return DEFAULT_MODE;
}

export function stripAiSlopCandidates(
  classification: SentenceClassification,
): SentenceClassification {
  if (!classification.ai_slop_candidates) return classification;
  const { ai_slop_candidates: _candidates, ...rest } = classification;
  return rest;
}

export function attachAiSlopCandidates(
  sentence: Pick<HashedSentence, "text">,
  classification: SentenceClassification,
  mode?: AiSlopMatcherMode,
): SentenceClassification {
  const base = stripAiSlopCandidates(classification);
  const candidates = extractAiSlopCandidates(sentence.text, mode);
  return candidates.length > 0 ? { ...base, ai_slop_candidates: candidates } : base;
}

export function extractAiSlopCandidates(
  text: string,
  mode?: AiSlopMatcherMode,
): AiSlopCandidateMatch[] {
  const resolvedMode = normalizeAiSlopMatcherMode(mode);
  if (resolvedMode === "off" || !text.trim()) return [];

  const lower = text.toLowerCase();
  const candidates: AiSlopCandidateMatch[] = [];
  const maxCandidates = maxCandidatesForMode(resolvedMode);

  for (const [sourceId, regexes] of Object.entries(LLM_MARKER_MATCHERS)) {
    if (!shouldScanMarker(sourceId, lower, resolvedMode)) continue;

    for (const regex of regexes) {
      regex.lastIndex = 0;
      const match = regex.exec(text);
      if (!match?.[0]) continue;

      candidates.push(buildCandidate(sourceId, regex, match));
      break;
    }

    if (candidates.length >= maxCandidates) break;
  }

  return dedupeCandidates(candidates).slice(0, maxCandidates);
}

function shouldScanMarker(sourceId: string, lowerText: string, mode: AiSlopMatcherMode): boolean {
  if (mode === "exhaustive") return true;
  if (mode === "fast" && !FAST_MARKER_IDS.has(sourceId)) return false;

  const triggers = triggerTermsById.get(sourceId) ?? [];
  if (triggers.length === 0) return mode === "fast" ? false : FAST_MARKER_IDS.has(sourceId);
  return triggers.some((term) => lowerText.includes(term));
}

function buildCandidate(
  sourceId: string,
  regex: RegExp,
  match: RegExpExecArray,
): AiSlopCandidateMatch {
  const entry = metadataById.get(sourceId);
  const source = sourceForRegex(regex);
  return {
    source,
    source_id: sourceId,
    category: categoryForEntry(sourceId),
    subcategory: entry?.name ?? sourceId.replace(/_/g, " "),
    matcher_role: roleForRegex(regex, source),
    evidence: match[0],
    start: match.index,
    end: match.index + match[0].length,
    mapped_pattern_types: MARKER_TO_PATTERN_TYPES[sourceId] ?? [],
    verdict: "candidate_only",
  };
}

function sourceForRegex(regex: RegExp): AiSlopCandidateSource {
  return regex.source.includes("A-Za-z0-9_") ? "oai_regex_bundle" : "kimi_field_manual";
}

function roleForRegex(regex: RegExp, source: AiSlopCandidateSource): AiSlopMatcherRole {
  if (source === "kimi_field_manual") return "manual_phrase";
  if (regex.source.length > 900) return "family_router";
  if (regex.source.length > 350) return "mechanism_router";
  return "surface_exact_or_near_exact";
}

function categoryForEntry(sourceId: string): string {
  const description = metadataById.get(sourceId)?.description ?? "";
  const match = description.match(/\(([^)]+)\)\.?$/);
  return match?.[1] ?? "LLM marker taxonomy";
}

function maxCandidatesForMode(mode: AiSlopMatcherMode): number {
  if (mode === "fast") return 4;
  if (mode === "exhaustive") return 20;
  return 8;
}

function inferTriggerTerms(regexes: RegExp[]): string[] {
  const terms = new Set<string>();
  for (const regex of regexes.slice(0, 40)) {
    for (const match of regex.source.matchAll(/[A-Za-z][A-Za-z-]{4,}/g)) {
      const term = match[0].toLowerCase().replace(/^-+|-+$/g, "");
      if (term.length < 5 || term.length > 28) continue;
      if (COMMON_TRIGGER_WORDS.has(term)) continue;
      if (term.includes("u00a") || term.includes("xa")) continue;
      terms.add(term);
      if (terms.size >= 80) break;
    }
    if (terms.size >= 80) break;
  }
  return [...terms].sort((a, b) => b.length - a.length || a.localeCompare(b));
}

function dedupeCandidates(candidates: AiSlopCandidateMatch[]): AiSlopCandidateMatch[] {
  const seen = new Set<string>();
  const out: AiSlopCandidateMatch[] = [];
  for (const candidate of candidates) {
    const key = `${candidate.source_id}:${candidate.evidence.toLowerCase()}:${candidate.start ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(candidate);
  }
  return out;
}

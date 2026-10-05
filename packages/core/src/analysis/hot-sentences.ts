import type { ClassifiedSentence, HotRegion, PatternType, StylometricProfile } from "../types.ts";

const DEFAULT_MIN_HEAT = 2.5;
const SHORT_FORM_MIN_HEAT = 1.8;
const DEFAULT_MIN_CONFIDENCE = 0.45;
const HIGH_CONF_SINGLE_PATTERN = 0.8;
const HIGH_CONF_MIN_HEAT = 1.0;

export interface HotSentenceSelectOpts {
  /** Max sentences to return. */
  maxCount: number;
  minHeat?: number;
  minPatternConfidence?: number;
  maxPerParagraph?: number;
  hotRegions?: HotRegion[];
  wordCount?: number;
  /** When set, only consider these sentence ids (e.g. viewport). */
  sentenceIds?: Set<number> | number[];
}

function primaryPattern(s: ClassifiedSentence): PatternType | null {
  const { patterns } = s.classification;
  if (patterns.length === 0) return null;
  return patterns.reduce((best, p) => (p.confidence > best.confidence ? p : best), patterns[0]!)
    .type;
}

/** Impact score favors high heat, confident patterns, and short punchy slop (social hooks). */
export function sentenceImpactScore(s: ClassifiedSentence): number {
  const words = Math.max(1, s.classification.metrics.word_count);
  const brevityBonus = words <= 20 ? 1.2 : words <= 35 ? 1.08 : 1;
  const patterns = s.classification.patterns;
  const avgConf = patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length;
  const compoundBonus = patterns.length >= 2 ? 1.12 : 1;
  return s.heat * brevityBonus * compoundBonus * (0.65 + 0.35 * avgConf);
}

function resolveMinHeat(wordCount: number, explicit?: number): number {
  if (explicit != null) return explicit;
  return wordCount <= 800 ? SHORT_FORM_MIN_HEAT : DEFAULT_MIN_HEAT;
}

function isEligible(s: ClassifiedSentence, minHeat: number, minConf: number): boolean {
  const { patterns } = s.classification;
  if (patterns.length === 0) return false;
  const maxConf = Math.max(...patterns.map((p) => p.confidence));
  if (maxConf < minConf) return false;
  if (maxConf >= HIGH_CONF_SINGLE_PATTERN && s.heat >= HIGH_CONF_MIN_HEAT) return true;
  return s.heat >= minHeat;
}

function resolveMaxPerParagraph(wordCount: number, explicit?: number): number {
  if (explicit != null) return explicit;
  if (wordCount <= 300) return 1;
  if (wordCount <= 800) return 2;
  return 2;
}

function inScope(s: ClassifiedSentence, scope?: Set<number> | number[]): boolean {
  if (!scope) return true;
  if (scope instanceof Set) return scope.has(s.id);
  return scope.includes(s.id);
}

/**
 * Pick sentences for background rewrite batching.
 *
 * Strategy (short-form aware):
 * 1. One representative per hot region (spread across slop clusters)
 * 2. Fill remaining budget by impact score with pattern + paragraph diversity
 * 3. Skip low-heat / low-confidence noise
 */
export function selectHotSentencesForSuggest(
  sentences: ClassifiedSentence[],
  opts: HotSentenceSelectOpts,
): ClassifiedSentence[] {
  const maxCount = Math.max(0, opts.maxCount);
  if (maxCount === 0) return [];

  const wordCount =
    opts.wordCount ?? sentences.reduce((sum, s) => sum + s.classification.metrics.word_count, 0);
  const minHeat = resolveMinHeat(wordCount, opts.minHeat);
  const minConf = opts.minPatternConfidence ?? DEFAULT_MIN_CONFIDENCE;
  const maxPerParagraph = resolveMaxPerParagraph(wordCount, opts.maxPerParagraph);

  const eligible = sentences.filter(
    (s) => inScope(s, opts.sentenceIds) && isEligible(s, minHeat, minConf),
  );
  if (eligible.length === 0) return [];

  const selected: ClassifiedSentence[] = [];
  const selectedIds = new Set<number>();
  const perParagraph = new Map<number, number>();
  const selectedPatterns = new Set<PatternType>();

  const canAdd = (s: ClassifiedSentence) => {
    if (selectedIds.has(s.id)) return false;
    return (perParagraph.get(s.paragraph_id) ?? 0) < maxPerParagraph;
  };

  const add = (s: ClassifiedSentence) => {
    selected.push(s);
    selectedIds.add(s.id);
    perParagraph.set(s.paragraph_id, (perParagraph.get(s.paragraph_id) ?? 0) + 1);
    const pp = primaryPattern(s);
    if (pp) selectedPatterns.add(pp);
  };

  // Phase 1: hot-region representatives (document-level slop clusters)
  const regions = [...(opts.hotRegions ?? [])].sort((a, b) => b.heat - a.heat);
  for (const region of regions) {
    if (selected.length >= maxCount) break;
    const inRegion = eligible
      .filter((s) => s.id >= region.start_sentence && s.id <= region.end_sentence)
      .sort((a, b) => sentenceImpactScore(b) - sentenceImpactScore(a));
    const pick = inRegion.find(canAdd);
    if (pick) add(pick);
  }

  // Phase 2: diversity-aware fill by impact
  const ranked = eligible
    .filter((s) => !selectedIds.has(s.id))
    .map((s) => {
      let score = sentenceImpactScore(s);
      const pp = primaryPattern(s);
      if (pp && !selectedPatterns.has(pp)) score *= 1.3;
      if ((perParagraph.get(s.paragraph_id) ?? 0) >= maxPerParagraph) score = 0;
      return { s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  for (const { s } of ranked) {
    if (selected.length >= maxCount) break;
    if (canAdd(s)) add(s);
  }

  return selected.sort((a, b) => a.id - b.id);
}

/** Suggest batch budget from document size; capped by patterned sentence count. */
export function resolveBackgroundSuggestBudget(
  wordCount: number,
  sentenceCount: number,
  patternedCount: number,
): number {
  if (patternedCount === 0) return 0;
  let budget: number;
  if (wordCount <= 150) budget = 2;
  else if (wordCount <= 500) budget = 3;
  else if (wordCount <= 1000) budget = 5;
  else budget = 3;
  return Math.min(budget, patternedCount, Math.max(1, Math.ceil(sentenceCount * 0.2)));
}

export function selectHotSentencesFromProfile(
  profile: Pick<StylometricProfile, "sentences" | "hot_regions" | "word_count">,
  maxCount?: number,
  scope?: Set<number> | number[],
): ClassifiedSentence[] {
  const patterned = profile.sentences.filter((s) => s.classification.patterns.length > 0).length;
  const budget =
    maxCount ??
    resolveBackgroundSuggestBudget(profile.word_count, profile.sentences.length, patterned);
  return selectHotSentencesForSuggest(profile.sentences, {
    maxCount: budget,
    hotRegions: profile.hot_regions,
    wordCount: profile.word_count,
    sentenceIds: scope,
  });
}

/** All eligible patterned sentences for highlight/nav (no batch budget cap). */
export function listEligibleHotSentences(
  profile: Pick<StylometricProfile, "sentences" | "word_count">,
): ClassifiedSentence[] {
  const wordCount = profile.word_count;
  const minHeat = resolveMinHeat(wordCount);
  const minConf = DEFAULT_MIN_CONFIDENCE;
  return profile.sentences
    .filter((s) => isEligible(s, minHeat, minConf))
    .sort((a, b) => sentenceImpactScore(b) - sentenceImpactScore(a));
}

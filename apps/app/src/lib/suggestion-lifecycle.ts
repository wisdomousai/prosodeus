import type { RewriteSuggestion, StylometricProfile } from "@prosodeus/core/browser";
import {
  filterRewriteSuggestions,
  isValidRewriteSuggestion,
  selectHotSentencesFromProfile,
} from "@prosodeus/core/browser";
import type { RewriteAlternativesEvent } from "@prosodeus/shared/browser";

/** Build a sentence-id map from raw suggestions, dropping invalid entries. */
export function buildSuggestionMap(
  suggestions: RewriteSuggestion[],
): Map<number, RewriteSuggestion[]> {
  const filtered = filterRewriteSuggestions(suggestions);
  const map = new Map<number, RewriteSuggestion[]>();
  for (const s of filtered) {
    const arr = map.get(s.sentence_id) ?? [];
    arr.push(s);
    map.set(s.sentence_id, arr);
  }
  return map;
}

/** Drop suggestions whose stored original no longer matches the live profile text. */
export function pruneStaleSuggestions(
  map: Map<number, RewriteSuggestion[]>,
  profile: StylometricProfile | null,
): Map<number, RewriteSuggestion[]> {
  if (!profile) return new Map();

  const next = new Map<number, RewriteSuggestion[]>();
  for (const sentence of profile.sentences) {
    const sugs = map.get(sentence.id);
    if (!sugs?.length) continue;

    const fresh = sugs
      .filter((s) => s.original.trim() === sentence.text.trim())
      .map((s) => ({ ...s, original: sentence.text }));
    const validated = filterRewriteSuggestions(fresh);
    if (validated.length > 0) next.set(sentence.id, validated);
  }
  return next;
}

/** True when the background batch will target at least one hot sentence. */
export function expectsBatchedSuggestions(profile: StylometricProfile, topN = 3): boolean {
  if (topN <= 0) return false;
  return selectHotSentencesFromProfile(profile, topN).length > 0;
}

export function sanitizeRewriteAlternatives(
  data: RewriteAlternativesEvent["data"],
): RewriteAlternativesEvent["data"] {
  const original = data.original;
  return {
    ...data,
    alternatives: data.alternatives
      .filter((alt) => isValidRewriteSuggestion(original, alt.text))
      .map((alt, index) => ({ ...alt, index })),
  };
}

export function removeSentenceSuggestions(
  map: Map<number, RewriteSuggestion[]>,
  sentenceId: number,
): Map<number, RewriteSuggestion[]> {
  if (!map.has(sentenceId)) return map;
  const next = new Map(map);
  next.delete(sentenceId);
  return next;
}

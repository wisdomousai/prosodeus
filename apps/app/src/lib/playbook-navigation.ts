import type { LexiconHit, StylometricProfile } from "@prosodeus/core/browser";
import { getLexiconHitsForText } from "@prosodeus/core/browser";

export interface SentenceCharRange {
  sentenceId: number;
  start: number;
  end: number;
}

/** Map sentence ids to character ranges in the editor plain text. */
export function buildSentenceCharRanges(
  profile: StylometricProfile,
  text: string,
): SentenceCharRange[] {
  const ranges: SentenceCharRange[] = [];
  let searchFrom = 0;
  const sorted = [...profile.sentences].sort((a, b) => a.id - b.id);
  for (const sentence of sorted) {
    const idx = text.indexOf(sentence.text, searchFrom);
    if (idx < 0) continue;
    ranges.push({ sentenceId: sentence.id, start: idx, end: idx + sentence.text.length });
    searchFrom = idx + sentence.text.length;
  }
  return ranges;
}

export function sentenceIdForTextOffset(
  profile: StylometricProfile,
  text: string,
  offset: number,
): number | null {
  for (const range of buildSentenceCharRanges(profile, text)) {
    if (offset >= range.start && offset < range.end) return range.sentenceId;
  }
  return null;
}

export function sentenceIdsForLexiconHits(profile: StylometricProfile, text: string): number[] {
  const hits = getLexiconHitsForText(text);
  const ids = hits
    .map((hit) => sentenceIdForTextOffset(profile, text, hit.index))
    .filter((id): id is number => id != null);
  return [...new Set(ids)];
}

export function sentenceIdsMatchingText(profile: StylometricProfile, pattern: RegExp): number[] {
  return profile.sentences.filter((s) => pattern.test(s.text)).map((s) => s.id);
}

export function sentenceIdsForPattern(profile: StylometricProfile, patternType: string): number[] {
  return profile.sentences
    .filter((s) => s.classification.patterns.some((p) => p.type === patternType))
    .map((s) => s.id);
}

export function lexiconHitsWithSentenceIds(
  profile: StylometricProfile,
  text: string,
): Array<LexiconHit & { sentenceId: number | null }> {
  return getLexiconHitsForText(text).map((hit) => ({
    ...hit,
    sentenceId: sentenceIdForTextOffset(profile, text, hit.index),
  }));
}

import type { ClassifiedSentence, StylometricProfile } from "@prosodeus/core/browser";

/**
 * Merge a streaming partial profile into the previous profile.
 * Preserves classification/heat for unchanged sentences when the partial
 * entry is an empty placeholder (cache hit pending LLM for changed sentences).
 */
export function mergePartialProfile(
  prev: StylometricProfile | null,
  partial: StylometricProfile,
  done: boolean,
): StylometricProfile {
  if (!prev || done) return partial;

  const prevByHash = new Map<string, ClassifiedSentence>();
  for (const s of prev.sentences) prevByHash.set(s.hash, s);

  const mergedSentences: ClassifiedSentence[] = partial.sentences.map((s) => {
    const previous = prevByHash.get(s.hash);
    if (!previous) return s;

    const partialEmpty = s.classification.patterns.length === 0;
    const prevHadPatterns = previous.classification.patterns.length > 0;
    if (partialEmpty && prevHadPatterns && s.text === previous.text) {
      return {
        ...s,
        classification: previous.classification,
        heat: previous.heat,
      };
    }
    return s;
  });

  return { ...partial, sentences: mergedSentences };
}

/** Keep heatmap alignment after an inline rewrite before analyze completes. */
export function patchProfileSentenceText(
  profile: StylometricProfile,
  sentenceId: number,
  newText: string,
): StylometricProfile {
  const text = newText.trim();
  return {
    ...profile,
    sentences: profile.sentences.map((s) => (s.id === sentenceId ? { ...s, text } : s)),
  };
}

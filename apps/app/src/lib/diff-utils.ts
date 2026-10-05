import type { StylometricProfile } from "@prosodeus/core/browser";
import { diffLines, diffWordsWithSpace } from "diff";

export interface DiffSegment {
  value: string;
  added?: boolean;
  removed?: boolean;
}

export function computeWordDiff(a: string, b: string): DiffSegment[] {
  return diffWordsWithSpace(a, b);
}

export function computeLineDiff(a: string, b: string): DiffSegment[] {
  return diffLines(a, b);
}

export interface ScoreDelta {
  metric: string;
  before: number;
  after: number;
  delta: number;
  improved: boolean;
}

export function computeScoreDelta(
  profileA: StylometricProfile,
  profileB: StylometricProfile,
): ScoreDelta[] {
  const deltas: ScoreDelta[] = [];

  const add = (metric: string, before: number, after: number, lowerIsBetter: boolean) => {
    const delta = after - before;
    deltas.push({
      metric,
      before,
      after,
      delta,
      improved: lowerIsBetter ? delta < 0 : delta > 0,
    });
  };

  add("Mean Density", profileA.mean_heat, profileB.mean_heat, true);
  add("Word Count", profileA.word_count, profileB.word_count, false);
  add("Sentence Count", profileA.sentence_count, profileB.sentence_count, false);

  if (
    profileA.global_device_entropy !== undefined &&
    profileB.global_device_entropy !== undefined
  ) {
    add("Device Entropy", profileA.global_device_entropy, profileB.global_device_entropy, false);
  }
  if (
    profileA.global_sentence_length_autocorrelation !== undefined &&
    profileB.global_sentence_length_autocorrelation !== undefined
  ) {
    add(
      "Autocorrelation",
      profileA.global_sentence_length_autocorrelation,
      profileB.global_sentence_length_autocorrelation,
      true,
    );
  }

  return deltas;
}

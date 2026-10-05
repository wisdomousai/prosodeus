import { isCountOverThreshold } from "../taxonomy/density-thresholds.ts";
import {
  getDensityThreshold,
  getPattern,
  getTolerance,
  type PatternLevel,
  type StyleGenre,
} from "../taxonomy/pattern-registry.ts";
import type { PatternType, WindowMetrics, WindowSize } from "../types.ts";

export interface DensityViolation {
  pattern_id: PatternType;
  window_size: WindowSize;
  start_sentence: number;
  end_sentence: number;
  word_count: number;
  count: number;
  max_allowed: number;
}

const LEVEL_WINDOW: Record<PatternLevel, WindowSize> = {
  lexical: "narrow",
  sentence: "medium",
  paragraph: "medium",
  document: "wide",
};

function countPatternsInSentences(
  sentences: Array<{
    classification: { patterns: Array<{ type: PatternType; confidence: number }> };
  }>,
): Map<PatternType, number> {
  const counts = new Map<PatternType, number>();
  for (const s of sentences) {
    for (const p of s.classification.patterns) {
      counts.set(p.type, (counts.get(p.type) ?? 0) + p.confidence);
    }
  }
  return counts;
}

export function computeDensityViolations(
  windows: WindowMetrics[],
  sentences: Array<{
    classification: { patterns: Array<{ type: PatternType; confidence: number }> };
  }>,
  genre: StyleGenre,
  patternFilter?: Set<PatternType>,
): DensityViolation[] {
  const violations: DensityViolation[] = [];
  const patternIds = patternFilter
    ? [...patternFilter]
    : ([
        ...new Set(sentences.flatMap((s) => s.classification.patterns.map((p) => p.type))),
      ] as PatternType[]);

  for (const patternId of patternIds) {
    const threshold = getDensityThreshold(patternId);
    if (!threshold) continue;

    const entry = getPattern(patternId);
    const preferredSize = entry ? LEVEL_WINDOW[entry.level] : "medium";
    const relevantWindows = windows.filter((w) => w.size === preferredSize);
    const tolerance = getTolerance(patternId, genre);

    for (const w of relevantWindows) {
      const windowSentences = sentences.slice(w.start_sentence, w.end_sentence + 1);
      const counts = countPatternsInSentences(windowSentences);
      const count = counts.get(patternId) ?? 0;
      const maxAllowed =
        threshold.unit === "per_1000_words"
          ? threshold.max_count * tolerance * (w.word_count / 1000)
          : threshold.max_count * tolerance * (w.word_count / Math.max(1, threshold.window_words));

      if (isCountOverThreshold(threshold, count, w.word_count, tolerance)) {
        violations.push({
          pattern_id: patternId,
          window_size: w.size,
          start_sentence: w.start_sentence,
          end_sentence: w.end_sentence,
          word_count: w.word_count,
          count,
          max_allowed: Math.round(maxAllowed * 1000) / 1000,
        });
      }
    }
  }

  return violations;
}

export function violationCountByPattern(violations: DensityViolation[]): Map<PatternType, number> {
  const map = new Map<PatternType, number>();
  for (const v of violations) {
    map.set(v.pattern_id, (map.get(v.pattern_id) ?? 0) + 1);
  }
  return map;
}

export function isDensityViolation(
  patternId: string,
  count: number,
  windowWords: number,
  genre: StyleGenre,
): boolean {
  const threshold = getDensityThreshold(patternId);
  if (!threshold) return false;
  return isCountOverThreshold(threshold, count, windowWords, getTolerance(patternId, genre));
}

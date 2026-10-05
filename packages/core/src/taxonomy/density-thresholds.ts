import type { PatternType } from "../types.ts";

export type DensityThresholdUnit = "count" | "per_1000_words";

export interface DensityThreshold {
  window_words: number;
  max_count: number;
  unit?: DensityThresholdUnit;
}

/** Default density thresholds for playbook-copy patterns (from docs/taxonomy.md). */
export const PLAYBOOK_DENSITY_THRESHOLDS: Partial<Record<PatternType, DensityThreshold>> = {
  importance_inflation: { window_words: 1000, max_count: 0, unit: "count" },
  resumptive_phrase: { window_words: 800, max_count: 1, unit: "count" },
  hedging: { window_words: 200, max_count: 1, unit: "count" },
  transition_formulaic: { window_words: 300, max_count: 1, unit: "count" },
  em_dash_overuse: { window_words: 250, max_count: 1, unit: "count" },
  llm_fingerprint_word: { window_words: 500, max_count: 1, unit: "count" },
  tricolon_abstract: { window_words: 400, max_count: 1, unit: "count" },
  temporal_sweeping_opener: { window_words: 1000, max_count: 1, unit: "count" },
  intensifier_saturation: { window_words: 300, max_count: 2, unit: "count" },
  marketing_register_leak: { window_words: 500, max_count: 1, unit: "count" },
  binary_contrast: { window_words: 1000, max_count: 4, unit: "per_1000_words" },
  sentence_length_clustering: { window_words: 500, max_count: 3, unit: "count" },
  concessive_while: { window_words: 1000, max_count: 4, unit: "per_1000_words" },
  additive_negative_parallelism: { window_words: 800, max_count: 1, unit: "count" },
  negation_reframe: { window_words: 200, max_count: 1, unit: "count" },
  over_explanation: { window_words: 500, max_count: 1, unit: "count" },
  uniform_paragraph_length: { window_words: 500, max_count: 2, unit: "count" },
  concluding_summary: { window_words: 800, max_count: 1, unit: "count" },
  manufactured_fragments: { window_words: 500, max_count: 2, unit: "count" },
  markdown_compulsion: { window_words: 500, max_count: 1, unit: "count" },
  generic_specificity: { window_words: 500, max_count: 2, unit: "count" },
  emotional_positivity_bias: { window_words: 2000, max_count: 1, unit: "count" },
};

export function getEffectiveMaxCount(
  threshold: DensityThreshold,
  windowWords: number,
  tolerance: number,
): number {
  if (tolerance === 0) return 0;
  const unit = threshold.unit ?? "count";
  if (unit === "per_1000_words") {
    return threshold.max_count * tolerance * (windowWords / 1000);
  }
  const scale = windowWords / Math.max(1, threshold.window_words);
  return threshold.max_count * tolerance * scale;
}

export function isCountOverThreshold(
  threshold: DensityThreshold,
  count: number,
  windowWords: number,
  tolerance: number,
): boolean {
  if (windowWords <= 0) return false;
  const maxAllowed = getEffectiveMaxCount(threshold, windowWords, tolerance);
  return count > maxAllowed + 1e-6;
}

import {
  computeAutocorrelation as autocorrelation,
  computeFunctionWordRatio,
  computeHapaxRatio,
  computeOpeningVariety,
  computeTTR,
  computeWordLengthEntropy,
  countWords,
  computeDeviceEntropy as deviceEntropy,
  shannonEntropy,
} from "../text/math.ts";
import type { ClassifiedSentence, PatternType, WindowMetrics, WindowSize } from "../types.ts";

// ─── Window Configuration ────────────────────────────────────────────────────

const WINDOW_CONFIGS: Record<WindowSize, { min_words: number; max_words: number }> = {
  narrow: { min_words: 50, max_words: 100 },
  medium: { min_words: 200, max_words: 500 },
  wide: { min_words: 1000, max_words: 2000 },
};

const ALL_PATTERNS: PatternType[] = [
  // Lexical (L-01 through L-08)
  "importance_inflation",
  "resumptive_phrase",
  "hedging",
  "transition_formulaic",
  "em_dash_overuse",
  "nominalization",
  "llm_fingerprint_word",
  "tricolon_abstract",
  // Sentence (S-01 through S-10)
  "binary_contrast",
  "participial_cascade",
  "clause_symmetry",
  "that_subject",
  "sentence_length_clustering",
  "exhaustive_setup",
  "phrasal_coordination_chain",
  "agentless_passive",
  "imperative_opening",
  "definitional_opening",
  // Paragraph (P-01 through P-07)
  "general_specific_evaluative",
  "resolution_complete",
  "uniform_paragraph_length",
  "topic_sentence_first",
  "concluding_summary",
  "parallel_paragraph_structure",
  "vignette_then_principle",
];

// ─── Window Computation ──────────────────────────────────────────────────────

/**
 * Compute windowed metrics at all three resolutions across the document.
 */
export function computeWindows(sentences: ClassifiedSentence[]): WindowMetrics[] {
  const windows: WindowMetrics[] = [];

  for (const size of ["narrow", "medium", "wide"] as WindowSize[]) {
    const config = WINDOW_CONFIGS[size];
    const sizeWindows = computeWindowsAtSize(sentences, size, config.min_words, config.max_words);
    windows.push(...sizeWindows);
  }

  return windows;
}

function computeWindowsAtSize(
  sentences: ClassifiedSentence[],
  size: WindowSize,
  minWords: number,
  maxWords: number,
): WindowMetrics[] {
  const windows: WindowMetrics[] = [];
  const targetWords = Math.floor((minWords + maxWords) / 2);
  const step = Math.max(1, Math.floor(targetWords / 50)); // slide by ~2% of target

  let start = 0;
  while (start < sentences.length) {
    // Expand window until we hit target word count or end of sentences
    let end = start;
    let wordCount = 0;
    while (end < sentences.length && wordCount < targetWords) {
      wordCount +=
        sentences[end]!.classification.metrics.word_count || countWords(sentences[end]!.text);
      end++;
    }

    if (wordCount < minWords && windows.length > 0) break; // don't create undersized trailing windows

    windows.push(computeSingleWindow(sentences, start, end, size, wordCount));
    start += step;
  }

  return windows;
}

function computeSingleWindow(
  sentences: ClassifiedSentence[],
  start: number,
  end: number,
  size: WindowSize,
  wordCount: number,
): WindowMetrics {
  const windowSentences = sentences.slice(start, end);
  const windowText = windowSentences.map((s) => s.text).join(" ");

  return {
    size,
    start_sentence: start,
    end_sentence: end - 1,
    word_count: wordCount,
    pattern_density: computePatternDensity(windowSentences, wordCount),
    biber_entropy: computeBiberEntropy(windowSentences),
    length_entropy: computeLengthEntropy(windowSentences),
    device_entropy: deviceEntropy(windowSentences),
    sentence_length_autocorrelation: autocorrelation(
      windowSentences.map((s) => s.classification.metrics.word_count || countWords(s.text)),
    ),
    co_occurrence: computeCoOccurrence(windowSentences),
    // Lexical diversity
    ttr: computeTTR(windowText),
    hapax_ratio: computeHapaxRatio(windowText),
    word_length_entropy: computeWordLengthEntropy(windowText),
    opening_variety: computeOpeningVariety(windowSentences),
    function_word_ratio: computeFunctionWordRatio(windowText),
  };
}

// ─── Pattern Density ─────────────────────────────────────────────────────────

function computePatternDensity(
  sentences: ClassifiedSentence[],
  wordCount: number,
): Record<PatternType, number> {
  const counts: Record<string, number> = {};
  for (const p of ALL_PATTERNS) counts[p] = 0;

  for (const s of sentences) {
    for (const p of s.classification.patterns) {
      if (p.type in counts) counts[p.type]! += p.confidence;
    }
  }

  const density: Record<string, number> = {};
  const per100 = wordCount > 0 ? 100 / wordCount : 0;
  for (const p of ALL_PATTERNS) {
    density[p] = Math.round(counts[p]! * per100 * 100) / 100;
  }

  return density as Record<PatternType, number>;
}

// ─── Shannon Entropy ─────────────────────────────────────────────────────────

/**
 * Shannon entropy of Biber dimension distributions across sentences.
 * Higher = more varied structural approaches.
 */
function computeBiberEntropy(sentences: ClassifiedSentence[]): number {
  if (sentences.length === 0) return 0;

  // For each sentence, find the dominant Biber dimension
  const dimensions = [
    "informational",
    "involved",
    "narrative",
    "persuasive",
    "abstract",
    "elaborative",
  ] as const;
  const counts: Record<string, number> = {};
  for (const d of dimensions) counts[d] = 0;

  for (const s of sentences) {
    let maxDim: string = dimensions[0];
    let maxVal = 0;
    for (const d of dimensions) {
      const val = s.classification.biber[d];
      if (val > maxVal) {
        maxVal = val;
        maxDim = d;
      }
    }
    counts[maxDim]!++;
  }

  return shannonEntropy(Object.values(counts), sentences.length);
}

/**
 * Shannon entropy of sentence lengths (binned into 5-word buckets).
 */
function computeLengthEntropy(sentences: ClassifiedSentence[]): number {
  if (sentences.length === 0) return 0;

  const bins: Record<number, number> = {};
  for (const s of sentences) {
    const wc = s.classification.metrics.word_count || countWords(s.text);
    const bin = Math.floor(wc / 5) * 5; // 5-word bins
    bins[bin] = (bins[bin] ?? 0) + 1;
  }

  return shannonEntropy(Object.values(bins), sentences.length);
}

// computeDeviceEntropy and shannonEntropy imported from math.ts

// computeAutocorrelation imported from math.ts

// ─── Co-occurrence ───────────────────────────────────────────────────────────

/**
 * Which patterns appear together in the same sentence.
 * Returns pairs with their co-occurrence count.
 */
function computeCoOccurrence(
  sentences: ClassifiedSentence[],
): Array<[PatternType, PatternType, number]> {
  const pairCounts: Record<string, number> = {};

  for (const s of sentences) {
    const types = [...new Set(s.classification.patterns.map((p) => p.type))];
    for (let i = 0; i < types.length; i++) {
      for (let j = i + 1; j < types.length; j++) {
        const key = [types[i], types[j]].sort().join("|");
        pairCounts[key] = (pairCounts[key] ?? 0) + 1;
      }
    }
  }

  return Object.entries(pairCounts)
    .filter(([, count]) => count > 0)
    .map(([key, count]): [PatternType, PatternType, number] => {
      const [a, b] = key.split("|") as [PatternType, PatternType];
      return [a, b, count];
    })
    .sort((a, b) => b[2] - a[2]); // sort by frequency desc
}

// ─── Convergence ─────────────────────────────────────────────────────────────

/**
 * Compute convergence slope: is entropy decreasing over document position?
 * Negative slope = variety is decaying (bad — LLM-typical context poisoning).
 * Uses linear regression on device entropy at medium windows.
 */
export function computeConvergence(windows: WindowMetrics[]): number {
  const mediumWindows = windows.filter((w) => w.size === "medium");
  if (mediumWindows.length < 2) return 0;

  const xs = mediumWindows.map((_, i) => i);
  const ys = mediumWindows.map((w) => w.device_entropy);

  return linearRegressionSlope(xs, ys);
}

function linearRegressionSlope(xs: number[], ys: number[]): number {
  const n = xs.length;
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (xs[i]! - xMean) * (ys[i]! - yMean);
    denominator += (xs[i]! - xMean) ** 2;
  }

  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 10000;
}

// countWords imported from math.ts

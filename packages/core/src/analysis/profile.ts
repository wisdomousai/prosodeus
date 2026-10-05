import { getPattern } from "../taxonomy/pattern-registry.ts";
import {
  computeAutocorrelation,
  computeDeviceEntropy,
  computeFunctionWordRatio,
  computeHapaxRatio,
  computeMATTR,
  computeOpeningVariety,
  computeTTR,
  computeWordLengthEntropy,
  countWords,
  shannonEntropy,
} from "../text/math.ts";
import type {
  ClassifiedSentence,
  HotRegion,
  PatternType,
  StyleGuideDelta,
  StylometricProfile,
} from "../types.ts";
import { computeConvergence, computeWindows } from "./aggregation.ts";

/**
 * Assemble a complete StylometricProfile from classified sentences.
 * This is the main entry point for the aggregation pipeline.
 */
export function assembleProfile(
  sentences: ClassifiedSentence[],
  delta?: StyleGuideDelta,
): StylometricProfile {
  const windows = computeWindows(sentences);
  const hotRegions = detectHotRegions(sentences);

  // Compute global metrics
  const totalWords = sentences.reduce(
    (sum, s) => sum + (s.classification.metrics.word_count || countWords(s.text)),
    0,
  );

  // Count unique paragraphs
  const paragraphs = new Set(sentences.map((s) => s.paragraph_id));

  // Global entropy: use all sentences as one big window
  const globalBiberEntropy = computeGlobalBiberEntropy(sentences);
  const globalDeviceEntropy = computeGlobalDeviceEntropy(sentences);
  const globalAutocorrelation = computeGlobalAutocorrelation(sentences);

  // Lexical diversity (global)
  const allText = sentences.map((s) => s.text).join(" ");

  return {
    word_count: totalWords,
    sentence_count: sentences.length,
    paragraph_count: paragraphs.size,
    sentences,
    windows,
    hot_regions: hotRegions,
    convergence_slope: computeConvergence(windows),
    global_biber_entropy: globalBiberEntropy,
    global_device_entropy: globalDeviceEntropy,
    global_sentence_length_autocorrelation: globalAutocorrelation,
    mean_heat:
      sentences.length > 0
        ? Math.round((sentences.reduce((sum, s) => sum + s.heat, 0) / sentences.length) * 10) / 10
        : 0,
    // Lexical diversity
    global_ttr: computeTTR(allText),
    global_mattr: computeMATTR(allText, 50),
    global_hapax_ratio: computeHapaxRatio(allText),
    global_word_length_entropy: computeWordLengthEntropy(allText),
    global_opening_variety: computeOpeningVariety(sentences),
    global_function_word_ratio: computeFunctionWordRatio(allText),
    delta,
  };
}

/**
 * Detect contiguous regions of high heat.
 * A hot region is 2+ consecutive sentences with heat >= 3.
 */
export function detectHotRegions(sentences: ClassifiedSentence[]): HotRegion[] {
  const HEAT_THRESHOLD = 3;
  const regions: HotRegion[] = [];
  let regionStart = -1;

  for (let i = 0; i <= sentences.length; i++) {
    const isHot = i < sentences.length && sentences[i]!.heat >= HEAT_THRESHOLD;

    if (isHot && regionStart === -1) {
      regionStart = i;
    } else if (!isHot && regionStart !== -1) {
      // End of hot region
      if (i - regionStart >= 2) {
        const regionSentences = sentences.slice(regionStart, i);
        const avgHeat =
          regionSentences.reduce((sum, s) => sum + s.heat, 0) / regionSentences.length;

        // Find primary patterns in this region
        const patternCounts: Record<string, number> = {};
        for (const s of regionSentences) {
          for (const p of s.classification.patterns) {
            patternCounts[p.type] = (patternCounts[p.type] ?? 0) + 1;
          }
        }
        const primaryPatterns = Object.entries(patternCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([type]) => type as PatternType);

        regions.push({
          start_sentence: regionStart,
          end_sentence: i - 1,
          heat: Math.round(avgHeat * 10) / 10,
          primary_patterns: primaryPatterns,
          description: describeRegion(primaryPatterns, avgHeat, i - regionStart),
        });
      }
      regionStart = -1;
    }
  }

  return regions;
}

function describeRegion(patterns: PatternType[], heat: number, length: number): string {
  const severity = heat >= 7 ? "High" : heat >= 5 ? "Moderate" : "Mild";
  const patternNames = patterns.map(formatPatternName).join(", ");
  return `${severity} structural clustering across ${length} sentences: ${patternNames || "general uniformity"}`;
}

function formatPatternName(p: PatternType): string {
  const entry = getPattern(p);
  return entry?.name ?? p.replace(/_/g, " ");
}

// ─── Global Metrics ──────────────────────────────────────────────────────────

function computeGlobalBiberEntropy(sentences: ClassifiedSentence[]): number {
  if (sentences.length === 0) return 0;
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

// computeGlobalDeviceEntropy delegates to shared math.ts
function computeGlobalDeviceEntropy(sentences: ClassifiedSentence[]): number {
  return computeDeviceEntropy(sentences);
}

function computeGlobalAutocorrelation(sentences: ClassifiedSentence[]): number {
  const lengths = sentences.map((s) => s.classification.metrics.word_count || countWords(s.text));
  return computeAutocorrelation(lengths);
}

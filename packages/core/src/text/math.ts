import type { ClassifiedSentence } from "../types.ts";

/**
 * Shannon entropy of a frequency distribution.
 * H = -Σ(p * log2(p)) where p = count/total
 */
export function shannonEntropy(counts: number[], total: number): number {
  if (total === 0) return 0;
  let entropy = 0;
  for (const count of counts) {
    if (count === 0) continue;
    const p = count / total;
    entropy -= p * Math.log2(p);
  }
  return Math.round(entropy * 1000) / 1000;
}

/**
 * Lag-1 autocorrelation of a numeric series.
 * ρ = Σ((x_i - mean)(x_{i+1} - mean)) / Σ((x_i - mean)²)
 * High values (>0.3) indicate monotonous rhythm.
 */
export function computeAutocorrelation(values: number[]): number {
  if (values.length < 3) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < values.length; i++) {
    denominator += (values[i]! - mean) ** 2;
    if (i < values.length - 1) {
      numerator += (values[i]! - mean) * (values[i + 1]! - mean);
    }
  }
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 1000;
}

/**
 * Device entropy: how evenly distributed rhetorical patterns are.
 * Higher = using a wider palette of devices.
 */
export function computeDeviceEntropy(sentences: ClassifiedSentence[]): number {
  const counts: Record<string, number> = {};
  for (const s of sentences) {
    for (const p of s.classification.patterns) {
      counts[p.type] = (counts[p.type] ?? 0) + 1;
    }
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  return shannonEntropy(Object.values(counts), total);
}

/**
 * Count words in a string by splitting on whitespace.
 */
export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

// ─── Lexical Diversity Metrics ──────────────────────────────────────────────

/**
 * Type-Token Ratio: unique words / total words.
 * Higher = more diverse vocabulary. Raw TTR decreases with text length,
 * so use computeMATTR for length-corrected global metric.
 */
export function computeTTR(text: string): number {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  return Math.round((new Set(words).size / words.length) * 1000) / 1000;
}

/**
 * Moving Average Type-Token Ratio: averages TTR over sliding windows
 * of fixed size. Corrects for raw TTR's length dependence.
 */
export function computeMATTR(text: string, windowSize = 50): number {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length <= windowSize) return computeTTR(text);

  let sum = 0;
  const n = words.length - windowSize + 1;
  for (let i = 0; i < n; i++) {
    const window = words.slice(i, i + windowSize);
    sum += new Set(window).size / windowSize;
  }
  return Math.round((sum / n) * 1000) / 1000;
}

/**
 * Hapax legomena ratio: words appearing exactly once / total words.
 * Higher = richer vocabulary. LLM text tends toward lower hapax ratios.
 */
export function computeHapaxRatio(text: string): number {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  const freq: Record<string, number> = {};
  for (const w of words) freq[w] = (freq[w] ?? 0) + 1;
  const hapax = Object.values(freq).filter((c) => c === 1).length;
  return Math.round((hapax / words.length) * 1000) / 1000;
}

/**
 * Shannon entropy of word length distribution.
 * Captures whether the writer uses a mix of short and long words.
 */
export function computeWordLengthEntropy(text: string): number {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  const bins: Record<number, number> = {};
  for (const w of words) {
    const len = w.replace(/[^a-zA-Z]/g, "").length;
    if (len > 0) bins[len] = (bins[len] ?? 0) + 1;
  }
  return shannonEntropy(Object.values(bins), words.length);
}

/**
 * Sentence opening variety: ratio of unique sentence openings to total sentences.
 * Uses first 3 words (lowercased, stripped) as the opening fingerprint.
 * Low values indicate repetitive sentence starts (common in LLM text).
 */
export function computeOpeningVariety(sentences: Array<{ text: string }>): number {
  if (sentences.length <= 1) return 1;
  const openings = sentences.map((s) => {
    const words = s.text.split(/\s+/).slice(0, 3);
    return words.map((w) => w.toLowerCase().replace(/[^a-z]/g, "")).join(" ");
  });
  return Math.round((new Set(openings).size / openings.length) * 1000) / 1000;
}

// Common English function words — POS proxy without a tagger
const FUNCTION_WORDS = new Set([
  "the",
  "a",
  "an",
  "this",
  "that",
  "these",
  "those",
  "in",
  "on",
  "at",
  "to",
  "for",
  "with",
  "from",
  "by",
  "of",
  "about",
  "and",
  "or",
  "but",
  "nor",
  "yet",
  "so",
  "i",
  "you",
  "he",
  "she",
  "it",
  "we",
  "they",
  "me",
  "him",
  "her",
  "us",
  "them",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "shall",
  "should",
  "may",
  "might",
  "can",
  "could",
  "must",
  "not",
  "no",
  "if",
  "then",
  "than",
  "as",
  "while",
  "when",
  "where",
  "how",
]);

/**
 * Function word ratio: function words / total words.
 * Serves as a POS proxy — LLM text tends toward higher function word ratios
 * due to hedging, filler, and over-qualification.
 */
export function computeFunctionWordRatio(text: string): number {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  const funcCount = words.filter((w) => FUNCTION_WORDS.has(w)).length;
  return Math.round((funcCount / words.length) * 1000) / 1000;
}

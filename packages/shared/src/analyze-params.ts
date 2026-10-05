import type { AiSlopMatcherMode } from "@prosodeus/core";
import type { AnalyzeMode } from "./ws-types.ts";

export interface AnalyzeCallOptions {
  analyzeMode?: AnalyzeMode;
  topSuggestions?: number;
  changedSentenceIds?: number[];
  scope?: "document" | "viewport";
  suggestMode?: "batch" | "none";
  aiSlopMode?: AiSlopMatcherMode;
}

/**
 * Upper bound on background suggest batch size (actual picks use hot-region logic).
 * Tuned for short-form assets (tweets, LinkedIn, blog posts ~300–1000 words).
 */
export function resolveBackgroundSuggestTopN(wordCount: number): number {
  if (wordCount <= 150) return 2;
  if (wordCount <= 500) return 3;
  if (wordCount <= 1000) return 5;
  return 3;
}

/** Resolve WS/IPC analyze params from explicit options + mode defaults. */
export function resolveAnalyzeTopSuggestions(
  opts?: AnalyzeCallOptions,
  wordCount?: number,
): number {
  if (opts?.topSuggestions !== undefined) return opts.topSuggestions;
  if (opts?.suggestMode === "none") return 0;
  if (opts?.suggestMode === "batch") {
    return wordCount != null ? resolveBackgroundSuggestTopN(wordCount) : 3;
  }
  return opts?.analyzeMode === "incremental" ? 0 : 0;
}

export function isIncrementalAnalyze(opts?: AnalyzeCallOptions): boolean {
  return opts?.analyzeMode === "incremental";
}

export function isBatchSuggestEnabled(opts?: AnalyzeCallOptions): boolean {
  if (opts?.suggestMode === "batch") return true;
  if (opts?.suggestMode === "none") return false;
  return (opts?.topSuggestions ?? 0) > 0;
}

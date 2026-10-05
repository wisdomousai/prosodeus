import type { PatternType } from "../types.ts";

/** Source of the detected contrast span. */
export type OppositionSpanSource = "detected_pattern" | "ai_slop_candidate";

/**
 * A region of text flagged as a candidate for opposition rewriting.
 *
 * The opposition rewriter operates at sentence or adjacent-sentence granularity:
 * the span covers the full sentence range that contains the opposition. This
 * avoids fragile sub-sentence parsing while still keeping edits local relative
 * to the whole passage.
 */
export interface OppositionSpan {
  /** First sentence id in the document. */
  sentenceId: number;
  /** Last sentence id when the opposition spans adjacent sentences. */
  sentenceEndId?: number;
  /** Character offset of the span within the sentence. */
  start: number;
  /** Character offset of the span end within the sentence. */
  end: number;
  /** The flagged text. */
  text: string;
  /** The primary Prosodeus pattern type driving the rewrite. */
  patternType: PatternType;
  /** Confidence from the classifier or slop matcher. */
  confidence: number;
  /** Where the detection came from. */
  source: OppositionSpanSource;
  /** Underlying evidence quote from the classifier/candidate. */
  evidence: string;
}

/** Substance judgment for a detected opposition. */
export type SubstanceVerdict = "vacuous" | "earned" | "uncertain";

/** A single rewrite decision with full provenance. */
export interface OppositionEdit {
  span: OppositionSpan;
  /** Original sentence text before editing. */
  originalSentence: string;
  /** Rewritten sentence text. */
  rewrittenSentence: string;
  verdict: SubstanceVerdict;
  /** Fidelity score 0-1. */
  fidelityScore: number;
  /** Human-readable fidelity explanation. */
  fidelityReason: string;
  /** Whether the edit was applied to the passage. */
  accepted: boolean;
  /** Optional rewrite choices when auto-apply did not run or failed. */
  alternatives?: string[];
}

/** Summary statistics for an opposition rewriter run. */
export interface OppositionMetrics {
  passes: number;
  spansDetected: number;
  vacuousSpans: number;
  earnedSpans: number;
  uncertainSpans: number;
  acceptedEdits: number;
  rejectedEdits: number;
  fidelityFailures: number;
}

/** Result of rewriting oppositions in a passage. */
export interface OppositionResult {
  originalText: string;
  rewrittenText: string;
  edits: OppositionEdit[];
  metrics: OppositionMetrics;
}

/** Options shared by scorer, rewriter, and fidelity checker. */
export interface OppositionModelOptions {
  /** Model used for substance scoring / rewrite / fidelity judgment. */
  model: import("ai").LanguageModel;
  /** Max output tokens for the model call. */
  maxOutputTokens?: number;
}

/** Runtime options for `rewriteOppositions`. */
export interface RewriteOppositionsOptions {
  /** Classifier that produces per-sentence pattern detections. */
  classifier: import("../analysis/analyze.ts").SentenceClassifier;
  /** Cache so unchanged sentences are not reclassified on each pass. */
  cache: import("../storage/cache.ts").ClassificationCache;
  /** Model for substance scoring. */
  judgeModel: import("ai").LanguageModel;
  /** Model for span/sentence rewrite. */
  rewriteModel: import("ai").LanguageModel;
  /** Max detection→rewrite passes (default 3). */
  maxPasses?: number;
  /** Style name passed through to the analyzer. */
  style?: string;
  /** Slop matcher mode for extra recall. */
  aiSlopMode?: import("../types.ts").AiSlopMatcherMode;
  /** Pattern types considered oppositional. Defaults to binary-contrast family. */
  targetPatterns?: PatternType[];
  /** Progress callback. */
  onProgress?: (message: string) => void;
}

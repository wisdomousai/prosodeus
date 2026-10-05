import type { ClassifiedSentence, PatternType, StylometricProfile, WindowSize } from "../types.ts";
import { isOppositionCandidate } from "./heuristics.ts";

export const OPPOSITION_PATTERN_TYPES = [
  "binary_contrast",
  "negation_reframe",
  "concessive_while",
  "clause_symmetry",
] as const satisfies readonly PatternType[];

export type OppositionPatternType = (typeof OPPOSITION_PATTERN_TYPES)[number];

export interface OppositionPatternHit {
  type: PatternType;
  evidence: string;
}

export interface OppositionSentenceHit {
  sentenceId: number;
  paragraphId: number;
  text: string;
  patterns: OppositionPatternHit[];
}

export interface OppositionParagraphHit {
  paragraphId: number;
  sentenceIds: number[];
  patterns: PatternType[];
  hitCount: number;
  excerpt: string;
}

export interface OppositionSectionHit {
  windowSize: Extract<WindowSize, "medium" | "wide">;
  startSentence: number;
  endSentence: number;
  wordCount: number;
  oppositionDensity: number;
  sentenceIds: number[];
  patterns: PatternType[];
}

export interface OppositionScan {
  sentences: OppositionSentenceHit[];
  paragraphs: OppositionParagraphHit[];
  sections: OppositionSectionHit[];
  totalSentenceHits: number;
}

function isOppositionPattern(type: PatternType): type is OppositionPatternType {
  return (OPPOSITION_PATTERN_TYPES as readonly PatternType[]).includes(type);
}

function patternsForSentence(s: ClassifiedSentence): OppositionPatternHit[] {
  const hits: OppositionPatternHit[] = [];
  const seen = new Set<PatternType>();

  const add = (type: PatternType, evidence: string) => {
    if (!isOppositionPattern(type)) return;
    if (type === "clause_symmetry" && !isOppositionCandidate(s.text, type)) return;
    if (seen.has(type)) return;
    seen.add(type);
    hits.push({ type, evidence });
  };

  for (const p of s.classification.patterns) {
    add(p.type, p.evidence);
  }
  for (const c of s.classification.ai_slop_candidates ?? []) {
    for (const mapped of c.mapped_pattern_types) {
      add(mapped, c.evidence);
    }
  }

  return hits;
}

function oppositionDensityForWindow(
  windowSentences: ClassifiedSentence[],
  wordCount: number,
): number {
  let count = 0;
  for (const s of windowSentences) {
    count += patternsForSentence(s).length;
  }
  if (wordCount <= 0) return 0;
  return Math.round((count / wordCount) * 1000 * 100) / 100;
}

/**
 * Map binary/contrastive opposition hits at sentence, paragraph, and section
 * (window) granularity from an analyzed profile.
 */
export function scanOppositions(profile: StylometricProfile): OppositionScan {
  const sentences: OppositionSentenceHit[] = [];

  for (const s of profile.sentences) {
    const patterns = patternsForSentence(s);
    if (patterns.length === 0) continue;
    sentences.push({
      sentenceId: s.id,
      paragraphId: s.paragraph_id,
      text: s.text,
      patterns,
    });
  }

  const paragraphMap = new Map<number, OppositionParagraphHit>();
  for (const hit of sentences) {
    const existing = paragraphMap.get(hit.paragraphId);
    if (existing) {
      existing.sentenceIds.push(hit.sentenceId);
      existing.hitCount += hit.patterns.length;
      for (const p of hit.patterns) {
        if (!existing.patterns.includes(p.type)) existing.patterns.push(p.type);
      }
    } else {
      paragraphMap.set(hit.paragraphId, {
        paragraphId: hit.paragraphId,
        sentenceIds: [hit.sentenceId],
        patterns: hit.patterns.map((p) => p.type),
        hitCount: hit.patterns.length,
        excerpt: hit.text,
      });
    }
  }

  const sections: OppositionSectionHit[] = [];
  for (const w of profile.windows) {
    if (w.size !== "medium" && w.size !== "wide") continue;
    const windowSentences = profile.sentences.slice(w.start_sentence, w.end_sentence + 1);
    const sentenceIds: number[] = [];
    const patterns = new Set<PatternType>();
    for (const s of windowSentences) {
      const pats = patternsForSentence(s);
      if (pats.length === 0) continue;
      sentenceIds.push(s.id);
      for (const p of pats) patterns.add(p.type);
    }
    if (sentenceIds.length === 0) continue;

    sections.push({
      windowSize: w.size,
      startSentence: w.start_sentence,
      endSentence: w.end_sentence,
      wordCount: w.word_count,
      oppositionDensity: oppositionDensityForWindow(windowSentences, w.word_count),
      sentenceIds,
      patterns: [...patterns],
    });
  }

  sections.sort((a, b) => b.oppositionDensity - a.oppositionDensity);

  return {
    sentences,
    paragraphs: [...paragraphMap.values()].sort((a, b) => b.hitCount - a.hitCount),
    sections,
    totalSentenceHits: sentences.length,
  };
}

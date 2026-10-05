/**
 * Shared pattern styling constants and helpers.
 * Extracted from the old Editor.tsx so both TiptapEditor and PatternTooltip use them.
 */

import type { DetectedPattern, PatternType } from "@prosodeus/core/browser";

/**
 * Restrained editorial palette: thin colored underlines, no background fills.
 * Each sin family maps to one of moss / ink / amber / blood / ash.
 */
export const SIN_COLORS = {
  falsdom: { color: "#5e7a3f", bg: "transparent", tooltip: "#5e7a3f" }, // moss — abstract claim stacks
  rigid: { color: "#2f4f78", bg: "transparent", tooltip: "#2f4f78" }, // ink — mirrored shapes / binary contrasts
  empty: { color: "#8a8078", bg: "transparent", tooltip: "#8a8078" }, // ash — hedging / filler
  hubris: { color: "#b88a2c", bg: "transparent", tooltip: "#b88a2c" }, // amber — strongest expressions
  mono: { color: "#a04141", bg: "transparent", tooltip: "#a04141" }, // restrained red — repetition
} as const;

export type SinKey = keyof typeof SIN_COLORS;

export function patternSin(type: string): SinKey {
  switch (type) {
    case "nominalization":
    case "agentless_passive":
    case "definitional_opening":
    case "tricolon_abstract":
      return "falsdom";
    case "binary_contrast":
    case "participial_cascade":
    case "clause_symmetry":
    case "exhaustive_setup":
    case "phrasal_coordination_chain":
    case "imperative_opening":
    case "em_dash_overuse":
    case "transition_formulaic":
      return "rigid";
    case "hedging":
    case "resumptive_phrase":
    case "resolution_complete":
    case "that_subject":
    case "concluding_summary":
      return "empty";
    case "importance_inflation":
    case "llm_fingerprint_word":
      return "hubris";
    default:
      return "mono";
  }
}

export const PATTERN_LABELS: Record<string, string> = {
  importance_inflation: "Inflation",
  resumptive_phrase: "Filler",
  hedging: "Hedging",
  transition_formulaic: "Formulaic",
  em_dash_overuse: "Em-dash",
  nominalization: "Nominalization",
  llm_fingerprint_word: "LLM Word",
  tricolon_abstract: "Tricolon",
  binary_contrast: "Binary Contrast",
  participial_cascade: "Cascade",
  clause_symmetry: "Symmetry",
  that_subject: "That-clause",
  sentence_length_clustering: "Clustering",
  exhaustive_setup: "Exhaustive Setup",
  phrasal_coordination_chain: "Chain",
  agentless_passive: "Passive",
  imperative_opening: "Imperative",
  definitional_opening: "Definition",
  general_specific_evaluative: "GSE Arc",
  resolution_complete: "Over-resolve",
  uniform_paragraph_length: "Uniform \u00B6",
  topic_sentence_first: "Topic First",
  concluding_summary: "Summary",
  parallel_paragraph_structure: "Parallel \u00B6",
  vignette_then_principle: "Vignette",
  auxiliary_verb_inflation: "Aux Verb",
  personal_pronoun_skew: "Pronoun Skew",
  downtoner_divergence: "Downtoner",
  content_function_ratio: "Content/Function",
  temporal_sweeping_opener: "Temporal Sweep",
  epistemic_stance_deficit: "Stance Deficit",
  vocabulary_smoothing: "Vocab Smoothing",
  elegant_variation: "Elegant Var.",
  contraction_fingerprint: "Contractions",
  intensifier_saturation: "Intensifiers",
  evasive_complexity: "Evasive",
  subordinate_clause_inflation: "Sub. Clause",
  sentence_opener_repetition: "Opener Repeat",
  weak_verb_padding: "Weak Verb",
};

/**
 * Heat → very subtle margin color. The editor body should stay calm: heat is
 * surfaced in margin ticks, badges, and pattern underlines, not as paragraph
 * backgrounds. The bg value here is intentionally near-transparent.
 */
export function heatToColor(heat: number): { bg: string; fg: string } {
  if (heat < 2) return { bg: "transparent", fg: "var(--ash)" };
  if (heat < 4) return { bg: "rgba(94, 122, 63, 0.06)", fg: "var(--moss)" };
  if (heat < 6) return { bg: "rgba(184, 138, 44, 0.07)", fg: "var(--amber)" };
  if (heat < 8) return { bg: "rgba(160, 65, 65, 0.08)", fg: "var(--blood)" };
  return { bg: "rgba(160, 65, 65, 0.12)", fg: "var(--blood)" };
}

export interface Segment {
  text: string;
  pattern?: DetectedPattern;
  patternIdx?: number;
}

/**
 * Break sentence text into segments, some of which are highlighted by pattern evidence.
 */
export function segmentSentence(text: string, patterns: DetectedPattern[]): Segment[] {
  const highlights: { start: number; end: number; pattern: DetectedPattern; patternIdx: number }[] =
    [];

  for (let i = 0; i < patterns.length; i++) {
    const p = patterns[i]!;
    if (!p.evidence) continue;
    const idx = text.toLowerCase().indexOf(p.evidence.toLowerCase());
    if (idx >= 0) {
      highlights.push({ start: idx, end: idx + p.evidence.length, pattern: p, patternIdx: i });
    }
  }

  highlights.sort((a, b) => a.start - b.start);

  // Remove overlaps (keep first)
  const filtered: typeof highlights = [];
  let lastEnd = 0;
  for (const h of highlights) {
    if (h.start >= lastEnd) {
      filtered.push(h);
      lastEnd = h.end;
    }
  }

  const segments: Segment[] = [];
  let pos = 0;
  for (const h of filtered) {
    if (h.start > pos) segments.push({ text: text.slice(pos, h.start) });
    segments.push({
      text: text.slice(h.start, h.end),
      pattern: h.pattern,
      patternIdx: h.patternIdx,
    });
    pos = h.end;
  }
  if (pos < text.length) segments.push({ text: text.slice(pos) });

  return segments;
}

export interface PatternRef {
  sentenceId: number;
  patternIdx: number;
  pattern: DetectedPattern;
  key: string;
}

export function collectPatterns(profile: {
  sentences: Array<{ id: number; text: string; classification: { patterns: DetectedPattern[] } }>;
}): PatternRef[] {
  const refs: PatternRef[] = [];
  for (const s of profile.sentences) {
    for (let i = 0; i < s.classification.patterns.length; i++) {
      const p = s.classification.patterns[i]!;
      if (p.evidence && s.text.toLowerCase().includes(p.evidence.toLowerCase())) {
        refs.push({
          sentenceId: s.id,
          patternIdx: i,
          pattern: p,
          key: `${s.id}-${i}`,
        });
      }
    }
  }
  return refs;
}

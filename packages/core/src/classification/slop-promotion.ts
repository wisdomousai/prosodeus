import { getPlaybookPatternIds } from "../playbooks/copy-playbook.ts";
import type { DetectedPattern, PatternType, SentenceClassification } from "../types.ts";

export interface PromoteSlopOptions {
  minConfidence?: number;
  playbookOnly?: boolean;
  maxConfidence?: number;
}

const DEFAULT_OPTS: Required<PromoteSlopOptions> = {
  minConfidence: 0.5,
  playbookOnly: true,
  maxConfidence: 0.7,
};

const DEFAULT_CANDIDATE_CONFIDENCE = 0.65;

export function promoteSlopCandidates(
  classification: SentenceClassification,
  opts?: PromoteSlopOptions,
): SentenceClassification {
  const { minConfidence, playbookOnly, maxConfidence } = { ...DEFAULT_OPTS, ...opts };
  const candidates = classification.ai_slop_candidates;
  if (!candidates?.length) return classification;

  const allowed = playbookOnly ? new Set(getPlaybookPatternIds()) : null;
  const existing = new Set(classification.patterns.map((p) => p.type));
  const promoted: DetectedPattern[] = [];

  for (const c of candidates) {
    const confidence = DEFAULT_CANDIDATE_CONFIDENCE;
    if (confidence < minConfidence) continue;
    for (const mapped of c.mapped_pattern_types) {
      if (allowed && !allowed.has(mapped)) continue;
      if (existing.has(mapped)) continue;
      existing.add(mapped);
      promoted.push({
        type: mapped,
        confidence: Math.min(maxConfidence, confidence),
        evidence: c.evidence,
      });
    }
  }

  if (promoted.length === 0) return classification;

  return {
    ...classification,
    patterns: [...classification.patterns, ...promoted],
  };
}

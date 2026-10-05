import type { ClassifiedSentence } from "../types.ts";

export type ParagraphPurpose =
  | "analytical"
  | "narrative"
  | "argumentative"
  | "transitional"
  | "summary"
  | "example"
  | "definition";

export interface ParagraphAnalysis {
  paragraph_id: number;
  purpose: ParagraphPurpose;
  confidence: number;
  sentence_count: number;
  /** Purpose-specific structural targets */
  targets: ParagraphTargets;
}

export interface ParagraphTargets {
  /** Target device entropy range */
  device_entropy: { min: number; max: number };
  /** Target sentence length variation */
  length_std_dev: { min: number };
  /** Max acceptable autocorrelation */
  max_autocorrelation: number;
  /** Whether resolution is expected */
  expects_resolution: boolean;
}

/**
 * Purpose-specific structural targets.
 * Narrative paragraphs tolerate more uniformity (rhythm matters);
 * analytical paragraphs need high device entropy (varied argument structures).
 */
const PURPOSE_TARGETS: Record<ParagraphPurpose, ParagraphTargets> = {
  analytical: {
    device_entropy: { min: 2.0, max: 4.0 },
    length_std_dev: { min: 8 },
    max_autocorrelation: 0.25,
    expects_resolution: false,
  },
  narrative: {
    device_entropy: { min: 1.5, max: 3.5 },
    length_std_dev: { min: 10 },
    max_autocorrelation: 0.35, // rhythm matters more in narrative
    expects_resolution: false,
  },
  argumentative: {
    device_entropy: { min: 2.2, max: 4.0 },
    length_std_dev: { min: 7 },
    max_autocorrelation: 0.2,
    expects_resolution: true,
  },
  transitional: {
    device_entropy: { min: 1.0, max: 3.0 },
    length_std_dev: { min: 4 },
    max_autocorrelation: 0.4, // transitions can be brief and uniform
    expects_resolution: false,
  },
  summary: {
    device_entropy: { min: 1.5, max: 3.0 },
    length_std_dev: { min: 5 },
    max_autocorrelation: 0.3,
    expects_resolution: true,
  },
  example: {
    device_entropy: { min: 1.8, max: 3.5 },
    length_std_dev: { min: 8 },
    max_autocorrelation: 0.3,
    expects_resolution: false,
  },
  definition: {
    device_entropy: { min: 1.5, max: 3.0 },
    length_std_dev: { min: 5 },
    max_autocorrelation: 0.35,
    expects_resolution: true,
  },
};

/**
 * Classify the purpose of each paragraph from its sentence classifications.
 * Uses Biber dimensions + arc_role distribution — no LLM call needed.
 */
export function classifyParagraphs(sentences: ClassifiedSentence[]): ParagraphAnalysis[] {
  // Group sentences by paragraph
  const paragraphs = new Map<number, ClassifiedSentence[]>();
  for (const s of sentences) {
    const existing = paragraphs.get(s.paragraph_id) ?? [];
    existing.push(s);
    paragraphs.set(s.paragraph_id, existing);
  }

  const results: ParagraphAnalysis[] = [];

  for (const [pid, paraSentences] of paragraphs) {
    const { purpose, confidence } = derivePurpose(paraSentences);
    results.push({
      paragraph_id: pid,
      purpose,
      confidence,
      sentence_count: paraSentences.length,
      targets: PURPOSE_TARGETS[purpose],
    });
  }

  return results.sort((a, b) => a.paragraph_id - b.paragraph_id);
}

function derivePurpose(sentences: ClassifiedSentence[]): {
  purpose: ParagraphPurpose;
  confidence: number;
} {
  const n = sentences.length;
  if (n === 0) return { purpose: "transitional", confidence: 0.5 };

  // Aggregate Biber dimensions
  const biber = {
    informational: 0,
    involved: 0,
    narrative: 0,
    persuasive: 0,
    abstract: 0,
    elaborative: 0,
  };
  for (const s of sentences) {
    for (const dim of Object.keys(biber) as (keyof typeof biber)[]) {
      biber[dim] += s.classification.biber[dim];
    }
  }
  // Normalize
  for (const dim of Object.keys(biber) as (keyof typeof biber)[]) {
    biber[dim] /= n;
  }

  // Count arc roles
  const roleCounts: Record<string, number> = {};
  for (const s of sentences) {
    roleCounts[s.classification.arc_role] = (roleCounts[s.classification.arc_role] ?? 0) + 1;
  }
  const roleRatios: Record<string, number> = {};
  for (const [role, count] of Object.entries(roleCounts)) {
    roleRatios[role] = count / n;
  }

  // Score each purpose
  const scores: Record<ParagraphPurpose, number> = {
    analytical: 0,
    narrative: 0,
    argumentative: 0,
    transitional: 0,
    summary: 0,
    example: 0,
    definition: 0,
  };

  // Narrative: high narrative Biber, evidence/elaboration arcs
  scores.narrative =
    biber.narrative * 2 + (roleRatios.elaboration ?? 0) + (biber.involved > 0.3 ? 0.3 : 0);

  // Argumentative: high persuasive, claim+evidence arcs
  scores.argumentative =
    biber.persuasive * 2 + (roleRatios.claim ?? 0) * 0.5 + (roleRatios.evidence ?? 0) * 0.5;

  // Analytical: high informational + abstract, mixed arcs
  scores.analytical = biber.informational + biber.abstract + (roleRatios.evidence ?? 0) * 0.5;

  // Transitional: short paragraph (1-2 sentences), transition arcs
  scores.transitional =
    (roleRatios.transition ?? 0) * 2 + (n <= 2 ? 0.5 : 0) + (roleRatios.pivot ?? 0);

  // Summary: resolution arcs, concluding patterns
  scores.summary = (roleRatios.resolution ?? 0) * 2 + (biber.informational > 0.5 ? 0.3 : 0);

  // Example: narrative + evidence, elaboration arcs
  scores.example =
    (roleRatios.evidence ?? 0) + (roleRatios.elaboration ?? 0) + biber.narrative * 0.5;

  // Definition: high abstract + informational, definitional patterns
  const hasDefinitional = sentences.some((s) =>
    s.classification.patterns.some((p) => p.type === "definitional_opening"),
  );
  scores.definition =
    biber.abstract * 1.5 + (hasDefinitional ? 1.0 : 0) + biber.informational * 0.5;

  // Pick highest score
  let bestPurpose: ParagraphPurpose = "analytical";
  let bestScore = -Infinity;
  for (const [purpose, score] of Object.entries(scores) as [ParagraphPurpose, number][]) {
    if (score > bestScore) {
      bestScore = score;
      bestPurpose = purpose;
    }
  }

  // Confidence: how much the winner exceeds the runner-up
  const sortedScores = Object.values(scores).sort((a, b) => b - a);
  const margin = sortedScores.length >= 2 ? sortedScores[0]! - sortedScores[1]! : sortedScores[0]!;
  const confidence = Math.min(1, 0.5 + margin * 0.3);

  return { purpose: bestPurpose, confidence: Math.round(confidence * 100) / 100 };
}

/**
 * Get the structural targets for a specific paragraph purpose.
 */
export function getPurposeTargets(purpose: ParagraphPurpose): ParagraphTargets {
  return PURPOSE_TARGETS[purpose];
}

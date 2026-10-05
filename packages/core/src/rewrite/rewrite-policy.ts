import type { RewriteResult } from "../types.ts";

/**
 * Editorial controls chosen by the user in the Rewrite tab.
 * Every field is optional; only set fields are added to the rewrite prompt.
 * Vocabulary mirrors `docs/ui-redesign-spec.md`.
 */
export interface RewriteConstraints {
  statement_force?: "tentative" | "measured" | "firm" | "emphatic";
  claim_certainty?: "qualify" | "preserve" | "strengthen" | "reduce";
  expression_budget?: "none" | "one" | "few" | "preserve";
  superlative_ceiling?: "none" | "one_per_section" | "preserve_if_evidence";
  binary_contrast?: "avoid" | "sparingly" | "preserve_if_central";
  abstraction_level?: "concrete" | "balanced" | "conceptual";
  rhythm_policy?: "vary_openings" | "break_mirrored" | "preserve_cadence";
  notes?: string;
}

export type MeaningRiskLevel = "low" | "elevated" | "high";

export interface RewriteAlternative {
  index: number;
  text: string;
  structural_summary: string;
  meaning_note: string;
  tone_note: string;
  metrics: {
    before: { mean_heat: number; pattern_count: number; word_count: number };
    after: { mean_heat: number; pattern_count: number; word_count: number };
  };
  meaning_risk?: MeaningRiskLevel;
  apply_blocked?: boolean;
}

export function encodeConstraintsAsDirectives(c: RewriteConstraints | null | undefined): string[] {
  if (!c) return [];
  const lines: string[] = [];

  switch (c.statement_force) {
    case "tentative":
      lines.push(
        "Statement force: tentative — qualify claims, prefer hedged wording over assertion.",
      );
      break;
    case "measured":
      lines.push(
        "Statement force: measured — state claims plainly, avoid both hedging and emphasis.",
      );
      break;
    case "firm":
      lines.push(
        "Statement force: firm — state claims directly without hedging, no superlative reinforcement.",
      );
      break;
    case "emphatic":
      lines.push(
        "Statement force: emphatic — state claims with conviction; one strongest expression is permitted if evidence-bearing.",
      );
      break;
  }

  switch (c.claim_certainty) {
    case "qualify":
      lines.push("Claim certainty: qualify — soften certainty markers, allow tentative phrasing.");
      break;
    case "preserve":
      lines.push(
        "Claim certainty: preserve — keep certainty roughly where the original placed it.",
      );
      break;
    case "strengthen":
      lines.push(
        "Claim certainty: strengthen — remove unnecessary hedges, but do not add superlatives.",
      );
      break;
    case "reduce":
      lines.push(
        "Claim certainty: reduce — convert assertions into observations or qualified statements.",
      );
      break;
  }

  switch (c.expression_budget) {
    case "none":
      lines.push(
        "Expression budget: allow no strongest expressions (no superlatives, no maximalist framings).",
      );
      break;
    case "one":
      lines.push("Expression budget: allow at most one strongest expression in the passage.");
      break;
    case "few":
      lines.push(
        "Expression budget: allow a few strongest expressions, but only where evidence is shown nearby.",
      );
      break;
    case "preserve":
      lines.push("Expression budget: preserve the original count of strongest expressions.");
      break;
  }

  switch (c.superlative_ceiling) {
    case "none":
      lines.push("Superlative ceiling: no superlatives anywhere.");
      break;
    case "one_per_section":
      lines.push("Superlative ceiling: one superlative per section maximum.");
      break;
    case "preserve_if_evidence":
      lines.push("Superlative ceiling: preserve a superlative only if it is evidence-bearing.");
      break;
  }

  switch (c.binary_contrast) {
    case "avoid":
      lines.push("Binary contrasts: avoid X-vs-Y framings entirely.");
      break;
    case "sparingly":
      lines.push("Binary contrasts: allow at most one X-vs-Y framing in the passage.");
      break;
    case "preserve_if_central":
      lines.push("Binary contrasts: preserve a binary framing only when it is the central claim.");
      break;
  }

  switch (c.abstraction_level) {
    case "concrete":
      lines.push(
        "Abstraction level: concrete — prefer specific names, numbers, and events over abstract nouns.",
      );
      break;
    case "balanced":
      lines.push(
        "Abstraction level: balanced — alternate between concrete examples and conceptual framing.",
      );
      break;
    case "conceptual":
      lines.push(
        "Abstraction level: conceptual — keep the passage in abstract / framing register.",
      );
      break;
  }

  switch (c.rhythm_policy) {
    case "vary_openings":
      lines.push(
        "Rhythm policy: vary sentence openings — do not start consecutive sentences with the same construction.",
      );
      break;
    case "break_mirrored":
      lines.push("Rhythm policy: break mirrored clauses — vary clause lengths and shapes.");
      break;
    case "preserve_cadence":
      lines.push("Rhythm policy: preserve the original cadence and clause shape.");
      break;
  }

  if (c.notes && c.notes.trim()) {
    lines.push(`Additional notes: ${c.notes.trim()}`);
  }

  return lines;
}

export function summarizeStructuralChange(r: RewriteResult): string {
  const parts: string[] = [];
  const heatDelta = r.after.mean_heat - r.before.mean_heat;
  if (heatDelta <= -0.5) parts.push(`density ↓${Math.abs(heatDelta).toFixed(1)}`);
  else if (heatDelta >= 0.5) parts.push(`density ↑${heatDelta.toFixed(1)}`);
  else parts.push("density ~same");

  const patternDelta = r.after.pattern_count - r.before.pattern_count;
  if (patternDelta < 0) parts.push(`${Math.abs(patternDelta)} fewer pattern hits`);
  else if (patternDelta > 0) parts.push(`${patternDelta} more pattern hits`);
  else parts.push("pattern hits ~same");

  const entropyDelta = r.after.device_entropy - r.before.device_entropy;
  if (entropyDelta >= 0.2) parts.push("more device variety");
  else if (entropyDelta <= -0.2) parts.push("less device variety");

  return parts.join(", ");
}

export function describeTone(c: RewriteConstraints | null | undefined): string {
  if (!c) return "Default tone";
  const bits: string[] = [];
  if (c.statement_force) bits.push(c.statement_force);
  if (c.expression_budget) bits.push(`${c.expression_budget} strongest expressions`);
  return bits.length > 0 ? `Tone: ${bits.join(", ")}` : "Default tone";
}

export const DEFAULT_REWRITE_CONSTRAINTS: RewriteConstraints = {
  statement_force: "measured",
  claim_certainty: "preserve",
  expression_budget: "one",
  superlative_ceiling: "preserve_if_evidence",
  binary_contrast: "sparingly",
  abstraction_level: "balanced",
  rhythm_policy: "vary_openings",
};

const STRONG_CERTAINTY =
  /\b(undoubtedly|unquestionably|always\b|never\b|proves?\b|certainly|definitively|guaranteed|indisputable)\b/gi;
const INTENSIFIERS =
  /\b(extremely|incredibly|absolutely|totally|utterly|profoundly|unbelievably)\b/gi;

export function assessRewriteMeaning(
  original: string,
  rewritten: string,
  constraints: RewriteConstraints | null | undefined,
): {
  meaning_note: string;
  meaning_risk: MeaningRiskLevel;
  apply_blocked: boolean;
} {
  const o = original.trim();
  const r = rewritten.trim();
  if (!o.length) {
    return {
      meaning_note: "No original passage to compare.",
      meaning_risk: "low",
      apply_blocked: false,
    };
  }

  const negO = (o.match(/\bnot\b|n't\b/gi) ?? []).length;
  const negR = (r.match(/\bnot\b|n't\b/gi) ?? []).length;
  const negDrop = negO >= 2 && negR < negO - 1;

  const strongO = [...o.matchAll(STRONG_CERTAINTY)].length;
  const strongR = [...r.matchAll(STRONG_CERTAINTY)].length;
  const strongSpike = strongR > strongO + 1;

  const intO = [...o.matchAll(INTENSIFIERS)].length;
  const intR = [...r.matchAll(INTENSIFIERS)].length;
  const intSpike = intR > intO + 2;

  const lenRatio = o.length > 0 ? r.length / o.length : 1;
  const drasticShrink = lenRatio < 0.55 && o.split(/\s+/).filter(Boolean).length > 12;

  let meaning_risk: MeaningRiskLevel = "low";
  const notes: string[] = [];

  if (negDrop) {
    meaning_risk = "high";
    notes.push(
      "Negation markers dropped relative to the source — the factual boundary of the claim may have shifted.",
    );
  }
  if (
    strongSpike &&
    (constraints?.claim_certainty === "preserve" || constraints?.claim_certainty === "qualify")
  ) {
    if (meaning_risk !== "high") meaning_risk = "elevated";
    notes.push(
      "Strong certainty language increased versus the original; verify claim scope still matches.",
    );
  }
  if (intSpike && constraints?.expression_budget === "none") {
    meaning_risk = "high";
    notes.push("Strong intensifiers appeared while the expression budget was set to none.");
  }
  if (drasticShrink) {
    if (meaning_risk === "low") meaning_risk = "elevated";
    notes.push("The rewrite is much shorter — check that supporting nuance was not removed.");
  }

  if (notes.length === 0) {
    notes.push("No automatic red flags on negation, certainty spikes, or length collapse.");
  }

  const apply_blocked =
    meaning_risk === "high" ||
    (meaning_risk === "elevated" &&
      constraints?.claim_certainty === "preserve" &&
      (negDrop || strongSpike));

  return {
    meaning_note: notes.join(" "),
    meaning_risk,
    apply_blocked,
  };
}

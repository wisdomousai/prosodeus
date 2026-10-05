import type { RewriteConstraints } from "@prosodeus/shared/browser";
import { DEFAULT_CONSTRAINTS } from "@/components/inspector/rewrite-constraints";
import type { SegmentedOption } from "./SegmentedControl";

export type ConstraintValue<K extends keyof RewriteConstraints> =
  NonNullable<RewriteConstraints[K]> extends string ? NonNullable<RewriteConstraints[K]> : never;

export type PolicySource =
  | "From style policy"
  | "From detected pattern"
  | "From density cluster"
  | "This run only";

export type EffectivePolicyRow = {
  label: string;
  value: string;
  description: string;
  source: PolicySource;
};

export const STATEMENT_FORCE_OPTIONS = [
  { value: "tentative", label: "Low-key" },
  { value: "measured", label: "Measured" },
  { value: "firm", label: "Confident" },
  { value: "emphatic", label: "Forceful" },
] satisfies SegmentedOption<ConstraintValue<"statement_force">>[];

export const CLAIM_CERTAINTY_OPTIONS = [
  { value: "qualify", label: "Qualify" },
  { value: "preserve", label: "Preserve" },
  { value: "strengthen", label: "Strengthen" },
  { value: "reduce", label: "Reduce" },
] satisfies SegmentedOption<ConstraintValue<"claim_certainty">>[];

export const EXPRESSION_BUDGET_OPTIONS = [
  { value: "none", label: "0" },
  { value: "one", label: "1" },
  { value: "few", label: "2-3" },
  { value: "preserve", label: "Preserve" },
] satisfies SegmentedOption<ConstraintValue<"expression_budget">>[];

export const SUPERLATIVE_OPTIONS = [
  { value: "none", label: "None" },
  { value: "one_per_section", label: "1 / section" },
  { value: "preserve_if_evidence", label: "If evidence" },
] satisfies SegmentedOption<ConstraintValue<"superlative_ceiling">>[];

export const BINARY_CONTRAST_OPTIONS = [
  { value: "avoid", label: "Avoid" },
  { value: "sparingly", label: "Sparingly" },
  { value: "preserve_if_central", label: "If central" },
] satisfies SegmentedOption<ConstraintValue<"binary_contrast">>[];

export const ABSTRACTION_OPTIONS = [
  { value: "concrete", label: "Concrete" },
  { value: "balanced", label: "Balanced" },
  { value: "conceptual", label: "Conceptual" },
] satisfies SegmentedOption<ConstraintValue<"abstraction_level">>[];

export const RHYTHM_OPTIONS = [
  { value: "vary_openings", label: "Vary openings" },
  { value: "break_mirrored", label: "Break mirrored" },
  { value: "preserve_cadence", label: "Preserve cadence" },
] satisfies SegmentedOption<ConstraintValue<"rhythm_policy">>[];

export const REPETITION_TOLERANCE_OPTIONS = [
  { value: "break_mirrored", label: "Low" },
  { value: "vary_openings", label: "Medium" },
  { value: "preserve_cadence", label: "High" },
] satisfies SegmentedOption<ConstraintValue<"rhythm_policy">>[];

const VALUE_LABELS = {
  statement_force: {
    tentative: "Low-key",
    measured: "Measured",
    firm: "Confident",
    emphatic: "Forceful",
  },
  claim_certainty: {
    qualify: "Qualify",
    preserve: "Preserve",
    strengthen: "Strengthen",
    reduce: "Reduce",
  },
  expression_budget: {
    none: "No strongest expressions",
    one: "1 strongest expression",
    few: "2-3 strongest expressions",
    preserve: "Preserve current count",
  },
  superlative_ceiling: {
    none: "No superlatives",
    one_per_section: "1 per section",
    preserve_if_evidence: "Only if evidence-bearing",
  },
  binary_contrast: {
    avoid: "Avoid",
    sparingly: "Use sparingly",
    preserve_if_central: "Only if central",
  },
  abstraction_level: {
    concrete: "Concrete",
    balanced: "Balanced",
    conceptual: "Conceptual",
  },
  rhythm_policy: {
    vary_openings: "Vary openings",
    break_mirrored: "Break mirrored",
    preserve_cadence: "Preserve cadence",
  },
} as const;

const VALUE_DESCRIPTIONS = {
  statement_force: {
    tentative: "Qualify claims and keep emphasis quiet.",
    measured: "State claims plainly without hedging or emphasis.",
    firm: "Make claims direct without adding superlative force.",
    emphatic: "Use conviction only where the evidence earns it.",
  },
  claim_certainty: {
    qualify: "Soften certainty markers.",
    preserve: "Keep certainty roughly where the original placed it.",
    strengthen: "Remove unnecessary hedges without adding hype.",
    reduce: "Convert assertions into observations where needed.",
  },
  expression_budget: {
    none: "Do not allow maximalist wording in the passage.",
    one: "Allow one strongest expression in the passage.",
    few: "Allow a small number only when evidence is nearby.",
    preserve: "Keep the original strongest-expression count.",
  },
  superlative_ceiling: {
    none: "Remove superlatives entirely.",
    one_per_section: "Permit one superlative in a section.",
    preserve_if_evidence: "Keep a superlative only when evidence-bearing.",
  },
  binary_contrast: {
    avoid: "Avoid X-vs-Y framing.",
    sparingly: "Allow at most one binary contrast in the passage.",
    preserve_if_central: "Preserve the contrast only when it is the central claim.",
  },
  abstraction_level: {
    concrete: "Prefer specific names, numbers, and events.",
    balanced: "Alternate concrete examples with conceptual framing.",
    conceptual: "Keep the passage in a framing register.",
  },
  rhythm_policy: {
    vary_openings: "Avoid consecutive sentences with the same opening construction.",
    break_mirrored: "Vary clause lengths and shapes.",
    preserve_cadence: "Keep the original cadence when repetition is deliberate.",
  },
} as const;

export function policyValueLabel<K extends keyof typeof VALUE_LABELS>(
  key: K,
  value: keyof (typeof VALUE_LABELS)[K] | undefined,
) {
  if (!value) return "Not set";
  return VALUE_LABELS[key][value];
}

export function policyValueDescription<K extends keyof typeof VALUE_DESCRIPTIONS>(
  key: K,
  value: keyof (typeof VALUE_DESCRIPTIONS)[K] | undefined,
) {
  if (!value) return "No policy value set.";
  return VALUE_DESCRIPTIONS[key][value];
}

export function sourceShortLabel(source: PolicySource): string {
  if (source === "From style policy") return "style";
  if (source === "From detected pattern") return "pattern";
  if (source === "From density cluster") return "density";
  return "run";
}

export function effectivePolicyRows(
  constraints: RewriteConstraints,
  hasDetectedPatterns: boolean,
): EffectivePolicyRow[] {
  const sourceFor = <K extends keyof RewriteConstraints>(
    key: K,
    fallback: PolicySource,
  ): PolicySource => (constraints[key] !== DEFAULT_CONSTRAINTS[key] ? "This run only" : fallback);

  return [
    {
      label: "Statement force",
      value: policyValueLabel(
        "statement_force",
        constraints.statement_force ?? DEFAULT_CONSTRAINTS.statement_force,
      ),
      description: policyValueDescription(
        "statement_force",
        constraints.statement_force ?? DEFAULT_CONSTRAINTS.statement_force,
      ),
      source: sourceFor("statement_force", "From style policy"),
    },
    {
      label: "Claim certainty",
      value: policyValueLabel(
        "claim_certainty",
        constraints.claim_certainty ?? DEFAULT_CONSTRAINTS.claim_certainty,
      ),
      description: policyValueDescription(
        "claim_certainty",
        constraints.claim_certainty ?? DEFAULT_CONSTRAINTS.claim_certainty,
      ),
      source: sourceFor("claim_certainty", "From style policy"),
    },
    {
      label: "Expression budget",
      value: policyValueLabel(
        "expression_budget",
        constraints.expression_budget ?? DEFAULT_CONSTRAINTS.expression_budget,
      ),
      description: policyValueDescription(
        "expression_budget",
        constraints.expression_budget ?? DEFAULT_CONSTRAINTS.expression_budget,
      ),
      source: sourceFor("expression_budget", "From density cluster"),
    },
    {
      label: "Superlative allowance",
      value: policyValueLabel(
        "superlative_ceiling",
        constraints.superlative_ceiling ?? DEFAULT_CONSTRAINTS.superlative_ceiling,
      ),
      description: policyValueDescription(
        "superlative_ceiling",
        constraints.superlative_ceiling ?? DEFAULT_CONSTRAINTS.superlative_ceiling,
      ),
      source: sourceFor("superlative_ceiling", "From style policy"),
    },
    {
      label: "Binary contrast",
      value: policyValueLabel(
        "binary_contrast",
        constraints.binary_contrast ?? DEFAULT_CONSTRAINTS.binary_contrast,
      ),
      description: policyValueDescription(
        "binary_contrast",
        constraints.binary_contrast ?? DEFAULT_CONSTRAINTS.binary_contrast,
      ),
      source: sourceFor(
        "binary_contrast",
        hasDetectedPatterns ? "From detected pattern" : "From style policy",
      ),
    },
    {
      label: "Abstraction",
      value: policyValueLabel(
        "abstraction_level",
        constraints.abstraction_level ?? DEFAULT_CONSTRAINTS.abstraction_level,
      ),
      description: policyValueDescription(
        "abstraction_level",
        constraints.abstraction_level ?? DEFAULT_CONSTRAINTS.abstraction_level,
      ),
      source: sourceFor("abstraction_level", "From style policy"),
    },
    {
      label: "Rhythm",
      value: policyValueLabel(
        "rhythm_policy",
        constraints.rhythm_policy ?? DEFAULT_CONSTRAINTS.rhythm_policy,
      ),
      description: policyValueDescription(
        "rhythm_policy",
        constraints.rhythm_policy ?? DEFAULT_CONSTRAINTS.rhythm_policy,
      ),
      source: sourceFor(
        "rhythm_policy",
        hasDetectedPatterns ? "From detected pattern" : "From style policy",
      ),
    },
  ];
}

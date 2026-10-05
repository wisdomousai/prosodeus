import type { PatternFilterState } from "@/components/patterns/PatternFilters";
import type { PatternDetail as PatternDetailType, PatternListItem } from "@/lib/api";

export const SAMPLE_PATTERN_DETAILS: PatternDetailType[] = [
  {
    id: "sample:binary_contrast",
    pattern_id: "binary_contrast",
    taxonomy_id: "S-01",
    name: "Binary contrast construction",
    level: "sentence",
    scope: "platform",
    heat_weight: 1.6,
    self_amplification: "high",
    severity: "high",
    tags: ["contrast", "structure", "density"],
    is_enabled: true,
    updated_at: "2026-05-15T00:00:00.000Z",
    description:
      "Flags repeated X-vs-Y framing where every claim is sharpened through a binary opposition.",
    detection_hint:
      "Detect adjacent clauses or sentences that repeatedly frame the argument as not X but Y, simple vs complex, or false binary opposition.",
    examples: [
      {
        text: "This is not about speed. It is about precision.",
        explanation: "The construction is acceptable once, but becomes mechanical in clusters.",
      },
    ],
    false_positives: [
      {
        text: "The policy distinguishes legal duties from operational preferences.",
        explanation: "A real distinction is not automatically a rhetorical binary.",
      },
    ],
    substitutions: [],
    false_substitutions: [],
    rewrite_menu: [
      {
        id: 1,
        instruction: "State the position directly without setting up the rejected opposite first.",
      },
      {
        id: 2,
        instruction: "Replace the binary with a gradient, sequence, or concrete condition.",
      },
    ],
    pce_directive:
      "Avoid repeated not-X-but-Y framings. Preserve genuine distinctions, but vary how the argument advances.",
    tolerance_overrides: { academic: 0.7, marketing: 1.1 },
    related_patterns: ["repeated_opening", "abstract_claim_stack"],
    research_sources: [],
    created_at: "2026-05-15T00:00:00.000Z",
    version: 1,
  },
  {
    id: "sample:repeated_opening",
    pattern_id: "repeated_opening",
    taxonomy_id: "S-02",
    name: "Repeated opening cluster",
    level: "sentence",
    scope: "platform",
    heat_weight: 1.2,
    self_amplification: "high",
    severity: "medium",
    tags: ["rhythm", "openings"],
    is_enabled: true,
    updated_at: "2026-05-15T00:00:00.000Z",
    description:
      "Detects consecutive or clustered sentences that begin with the same phrase shape.",
    detection_hint:
      "Flag two or more nearby sentences starting with the same phrase, lemma, or rhetorical frame.",
    examples: [
      {
        text: "What matters is trust. What matters is accountability. What matters is repair.",
        explanation: "The repetition can be intentional, but needs clear emphasis.",
      },
    ],
    false_positives: [
      {
        text: "We must act transparently. We must act together.",
        explanation: "Intentional parallelism may be acceptable in a short call to action.",
      },
    ],
    substitutions: [],
    false_substitutions: [],
    rewrite_menu: [
      { id: 1, instruction: "Vary the opening phrase while preserving sequence and emphasis." },
      {
        id: 2,
        instruction: "Combine repeated openings into one sentence if the ideas are adjacent.",
      },
    ],
    pce_directive:
      "Vary sentence openings unless repetition is clearly used as deliberate emphasis.",
    tolerance_overrides: { academic: 0.8, fiction: 1.2 },
    related_patterns: ["binary_contrast"],
    research_sources: [],
    created_at: "2026-05-15T00:00:00.000Z",
    version: 1,
  },
  {
    id: "sample:strong_expression_stack",
    pattern_id: "strong_expression_stack",
    taxonomy_id: "L-08",
    name: "Strong expression stack",
    level: "lexical",
    scope: "platform",
    heat_weight: 1.4,
    self_amplification: "med",
    severity: "medium",
    tags: ["intensity", "superlatives"],
    is_enabled: true,
    updated_at: "2026-05-15T00:00:00.000Z",
    description: "Flags passages where too many claims use maximum-intensity wording.",
    detection_hint:
      "Detect clusters of strongest, definitive, unprecedented, transformative, game-changing, and similar maximalist expressions.",
    examples: [
      {
        text: "This unprecedented, definitive breakthrough transforms every aspect of the field.",
        explanation: "Several strongest expressions compete in one claim.",
      },
    ],
    false_positives: [
      {
        text: "The strongest result appears in the third trial.",
        explanation: "Strongest can be evidence-bearing when tied to measured comparison.",
      },
    ],
    substitutions: [],
    false_substitutions: [],
    rewrite_menu: [
      { id: 1, instruction: "Keep one strongest expression only if evidence nearby earns it." },
      { id: 2, instruction: "Replace broad intensity with the concrete change or measurement." },
    ],
    pce_directive:
      "Limit high-intensity expressions. Prefer concrete evidence over maximal emphasis.",
    tolerance_overrides: { academic: 0.5, marketing: 1.4 },
    related_patterns: ["binary_contrast"],
    research_sources: [],
    created_at: "2026-05-15T00:00:00.000Z",
    version: 1,
  },
  {
    id: "sample:nominalization_density",
    pattern_id: "nominalization_density",
    taxonomy_id: "L-06",
    name: "Nominalization density",
    level: "lexical",
    scope: "platform",
    heat_weight: 1,
    self_amplification: "med",
    severity: "medium",
    tags: ["lexical", "density", "clarity"],
    is_enabled: true,
    updated_at: "2026-05-15T00:00:00.000Z",
    description:
      "Flags clusters of abstract noun forms where verbs would make agency and action clearer.",
    detection_hint:
      "Detect utilization, implementation, facilitation, optimization, transformation, and similar noun-heavy phrasing when several appear near each other.",
    examples: [
      {
        text: "The implementation of the optimization process enabled the facilitation of adoption.",
        explanation: "Actions are hidden inside nouns and the actor disappears.",
      },
    ],
    false_positives: [
      {
        text: "The implementation date is fixed by contract.",
        explanation: "A nominalization can be a precise technical term.",
      },
    ],
    substitutions: [],
    false_substitutions: [],
    rewrite_menu: [
      { id: 1, instruction: "Turn the abstract noun into a verb and name the actor." },
      {
        id: 2,
        instruction: "Keep technical terms only when the surrounding sentence carries agency.",
      },
    ],
    pce_directive:
      "Reduce noun-heavy abstraction when it hides who does what. Preserve terms of art.",
    tolerance_overrides: { academic: 1.1, technical: 1.2 },
    related_patterns: ["abstract_claim_stack", "weak_verb_padding"],
    research_sources: [],
    created_at: "2026-05-15T00:00:00.000Z",
    version: 1,
  },
  {
    id: "sample:abstract_claim_stack",
    pattern_id: "abstract_claim_stack",
    taxonomy_id: "P-10",
    name: "Abstract claim stack",
    level: "paragraph",
    scope: "platform",
    heat_weight: 1.3,
    self_amplification: "high",
    severity: "high",
    tags: ["abstraction", "evidence", "paragraph"],
    is_enabled: true,
    updated_at: "2026-05-15T00:00:00.000Z",
    description:
      "Flags paragraphs where several broad claims arrive without enough concrete evidence or examples.",
    detection_hint:
      "Detect adjacent sentences that use broad evaluative language without nearby data, example, method, source, or concrete noun anchors.",
    examples: [
      {
        text: "This creates a uniquely favorable environment for rapid advancement and strategic differentiation.",
        explanation: "The claim is large, but the passage has not shown what changed.",
      },
    ],
    false_positives: [
      {
        text: "This creates a favorable environment because licensing costs fell by 38 percent.",
        explanation: "A concrete causal reason supports the general claim.",
      },
    ],
    substitutions: [],
    false_substitutions: [],
    rewrite_menu: [
      { id: 1, instruction: "Add the concrete evidence before the claim or soften the claim." },
      { id: 2, instruction: "Replace abstract benefit language with the observable change." },
    ],
    pce_directive:
      "Do not stack broad claims without evidence. Lead with the concrete support or reduce claim force.",
    tolerance_overrides: { academic: 0.6, marketing: 1 },
    related_patterns: ["strong_expression_stack", "nominalization_density"],
    research_sources: [],
    created_at: "2026-05-15T00:00:00.000Z",
    version: 1,
  },
  {
    id: "sample:mirrored_clause_rhythm",
    pattern_id: "mirrored_clause_rhythm",
    taxonomy_id: "S-03",
    name: "Mirrored clause rhythm",
    level: "sentence",
    scope: "platform",
    heat_weight: 1.1,
    self_amplification: "med",
    severity: "low",
    tags: ["rhythm", "clause", "structure"],
    is_enabled: true,
    updated_at: "2026-05-15T00:00:00.000Z",
    description:
      "Flags repeated clause shapes that make adjacent sentences feel mechanically balanced.",
    detection_hint:
      "Detect nearby sentences with similar clause length, punctuation rhythm, and repeated connective structure.",
    examples: [
      {
        text: "The method clarifies the claim, and the evidence supports the claim.",
        explanation: "The rhythm repeats rather than moving the paragraph forward.",
      },
    ],
    false_positives: [
      {
        text: "The method clarifies the claim; the evidence tests it.",
        explanation: "Balanced contrast can be deliberate and economical.",
      },
    ],
    substitutions: [],
    false_substitutions: [],
    rewrite_menu: [
      {
        id: 1,
        instruction: "Break the mirrored shape with a shorter sentence or a concrete example.",
      },
      { id: 2, instruction: "Move one clause into the previous or next sentence to vary rhythm." },
    ],
    pce_directive: "Vary clause rhythm when adjacent sentences repeat the same structural shape.",
    tolerance_overrides: { academic: 0.9, fiction: 1.3 },
    related_patterns: ["repeated_opening", "clause_symmetry"],
    research_sources: [],
    created_at: "2026-05-15T00:00:00.000Z",
    version: 1,
  },
];

export function sampleListItems(): PatternListItem[] {
  const order = [
    "sample:repeated_opening",
    "sample:binary_contrast",
    "sample:strong_expression_stack",
    "sample:nominalization_density",
    "sample:abstract_claim_stack",
    "sample:mirrored_clause_rhythm",
  ];
  return [...SAMPLE_PATTERN_DETAILS]
    .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
    .map((p) => ({ ...p }));
}

export function filterSamplePatterns(
  items: PatternListItem[],
  filters: PatternFilterState,
): PatternListItem[] {
  return items.filter((p) => {
    if (filters.level !== "all" && p.level !== filters.level) return false;
    if (filters.scope !== "all" && p.scope !== filters.scope) return false;
    const q = filters.search.trim().toLowerCase();
    if (!q) return true;
    return [p.name, p.taxonomy_id, p.pattern_id, ...(p.tags ?? [])]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });
}

import type { RewriteConstraints } from "../rewrite/rewrite-policy.ts";
import type { PatternType } from "../types.ts";

export type PlaybookLayerId =
  | "lexical"
  | "phrase"
  | "structural"
  | "tone"
  | "formatting"
  | "content";

export type PlaybookPlatform = "linkedin" | "twitter" | "newsletter" | "ad_copy";

export interface PlaybookLayer {
  id: PlaybookLayerId;
  label: string;
  patterns: PatternType[];
}

export interface PlaybookAuditCheck {
  id: string;
  label: string;
  automated: boolean;
  hint?: string;
}

export interface PlaybookPlatformPreset {
  label: string;
  constraints: RewriteConstraints;
  tone_note: string;
}

export interface CopyPlaybook {
  id: string;
  name: string;
  description: string;
  layers: PlaybookLayer[];
  banned_words: string[];
  structural_bans: string[];
  platform_presets: Record<PlaybookPlatform, PlaybookPlatformPreset>;
  audit_checks: PlaybookAuditCheck[];
}

export const COPY_PLAYBOOK: CopyPlaybook = {
  id: "anti-slop-copy",
  name: "Anti-Slop Copy",
  description:
    "Curated playbook for marketing and social copy — flags AI slop across six layers and ships pre-generation constraints.",
  layers: [
    {
      id: "lexical",
      label: "Word-level",
      patterns: [
        "importance_inflation",
        "hedging",
        "llm_fingerprint_word",
        "intensifier_saturation",
        "transition_formulaic",
        "marketing_register_leak",
      ],
    },
    {
      id: "phrase",
      label: "Phrase-level",
      patterns: [
        "binary_contrast",
        "negation_reframe",
        "resumptive_phrase",
        "concessive_while",
        "additive_negative_parallelism",
        "temporal_sweeping_opener",
      ],
    },
    {
      id: "structural",
      label: "Structural",
      patterns: [
        "tricolon_abstract",
        "sentence_length_clustering",
        "concluding_summary",
        "uniform_paragraph_length",
        "manufactured_fragments",
      ],
    },
    {
      id: "tone",
      label: "Tone",
      patterns: ["emotional_positivity_bias", "hedging"],
    },
    {
      id: "formatting",
      label: "Formatting",
      patterns: ["em_dash_overuse", "markdown_compulsion"],
    },
    {
      id: "content",
      label: "Content",
      patterns: ["generic_specificity", "over_explanation"],
    },
  ],
  banned_words: [
    "delve",
    "leverage",
    "synergy",
    "optimize",
    "streamline",
    "empower",
    "innovative",
    "groundbreaking",
    "transformative",
    "utilize",
    "landscape",
    "harness",
    "unlock",
    "unleash",
    "seamless",
    "cutting-edge",
    "game-changer",
    "paradigm",
    "unprecedented",
    "elevate",
    "commence",
    "foster",
    "showcase",
    "vibrant",
    "robust",
    "scalable",
    "holistic",
    "actionable",
    "best-in-class",
    "world-class",
    "mission-critical",
  ],
  structural_bans: [
    "No \"It's not X, it's Y\" binary reframes",
    'No "Furthermore", "However", "Moreover", or "Therefore" as sentence openers',
    'No meta-commentary ("In this article, we will explore…", "Let me explain…")',
    'No vague closings ("The future looks bright", "Only time will tell")',
    "Prefer two-item lists when three is padding; avoid rigid First/Second/Third outlines",
    "Max 1 em dash per piece (or replace with period, comma, or parentheses)",
    "No bold decoration in body paragraphs",
    "Max 3 hashtags",
  ],
  platform_presets: {
    linkedin: {
      label: "LinkedIn",
      constraints: {
        binary_contrast: "avoid",
        abstraction_level: "concrete",
        expression_budget: "few",
        notes:
          "Descriptive lesson, not prescriptive contrast. Show what good networkers do instead of Stop X, Start Y.",
      },
      tone_note:
        "Write for LinkedIn thought leadership without the template: setup → contrast → lesson → CTA. Make the lesson descriptive rather than prescriptive.",
    },
    twitter: {
      label: "Twitter/X",
      constraints: {
        binary_contrast: "avoid",
        rhythm_policy: "vary_openings",
        expression_budget: "few",
        abstraction_level: "concrete",
        notes: "Start with a number or a scene, not a thesis.",
      },
      tone_note:
        "280 characters — open with a specific number, scene, or outcome. Avoid Most people do X, the best do Y.",
    },
    newsletter: {
      label: "Newsletter",
      constraints: {
        statement_force: "measured",
        abstraction_level: "concrete",
        notes:
          "Use I and you. Show reasoning or reflection. Skip third-person omniscient narrator.",
      },
      tone_note:
        "First person when allowed. Show reasoning (This suggests that…) rather than balanced summaries.",
    },
    ad_copy: {
      label: "Ad copy",
      constraints: {
        abstraction_level: "concrete",
        expression_budget: "one",
        binary_contrast: "avoid",
        notes: "Replace the turn with the detail — specific behavior beats rhetorical opposition.",
      },
      tone_note:
        "Replace contrast hooks with concrete details: what they do, how many, how long — not what they don't do.",
    },
  },
  audit_checks: [
    { id: "em_dash", label: "Em dash scan", automated: true },
    { id: "worst_words", label: "15 worst words scan", automated: true },
    { id: "lexicon_scan", label: "Lexicon swap scan", automated: true },
    { id: "binary_reframe", label: "Binary reframe scan", automated: true },
    { id: "formal_transitions", label: "Formal transition scan", automated: true },
    { id: "meta_commentary", label: "Meta-commentary scan", automated: true },
    { id: "vague_ending", label: "Vague ending scan", automated: true },
    { id: "three_item_list", label: "Three-item list check", automated: true },
    { id: "paragraph_opener", label: "Paragraph opener variety", automated: true },
    { id: "contraction", label: "Contraction check", automated: true },
    {
      id: "read_aloud",
      label: "Read-aloud test",
      automated: false,
      hint: "Read out loud. If a sentence doesn't sound like something you'd say over coffee, rewrite it.",
    },
    {
      id: "so_what",
      label: 'The "so what" test',
      automated: false,
      hint: "For each paragraph: what does the reader do differently? If nothing, cut or make specific.",
    },
    {
      id: "and_test",
      label: 'The "and" test',
      automated: false,
      hint: 'Replace but/rather than/instead of/not with "and". If more interesting, the contrast was fake.',
    },
  ],
};

export const PLAYBOOK_PLATFORMS = Object.keys(COPY_PLAYBOOK.platform_presets) as PlaybookPlatform[];

export function getPlaybookPatternIds(playbook: CopyPlaybook = COPY_PLAYBOOK): PatternType[] {
  const seen = new Set<PatternType>();
  const out: PatternType[] = [];
  for (const layer of playbook.layers) {
    for (const id of layer.patterns) {
      if (!seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
  }
  return out;
}

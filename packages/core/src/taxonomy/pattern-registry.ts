/**
 * Pattern Registry — Single source of truth for the Prosodeus taxonomy.
 *
 * Every pattern has:
 *   - id:                 Stable code identifier (matches PatternType union)
 *   - taxonomy_id:        Human-readable taxonomy reference (e.g. "L-01")
 *   - name:               Display name
 *   - level:              "lexical" | "sentence" | "paragraph" | "document"
 *   - heat_weight:        0-2, how much this pattern contributes to heat score
 *   - self_amplification:  "high" | "med" | "low" — priority for suppression
 *   - detection_hint:     One-line instruction for the LLM classifier
 *   - rewrite_menu:       Numbered options for the dice-roll constraint generator
 *   - pce_directive:      Terse "Do NOT..." string for the PCE negative-constraint channel
 *   - tolerance_overrides: Per-genre density adjustments (multiplier on acceptable density)
 *
 * constraints.ts, pce.ts, and classifier.ts all import from here.
 * The taxonomy docs (taxonomy.md, taxonomy-expansion.md) are the narrative form;
 * this file is the machine-readable form.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type PatternLevel = "lexical" | "sentence" | "paragraph" | "document";
export type SelfAmplification = "high" | "med" | "low";
export type StyleGenre =
  | "general"
  | "technical"
  | "literary-essay"
  | "journalism"
  | "fiction"
  | "academic"
  | "marketing"
  | "code";

export interface RewriteOption {
  /** 1-indexed option number matching the taxonomy docs */
  id: number;
  /** The instruction sent to the rewrite LLM. Contains {CONTENT} slot for flagged text. */
  instruction: string;
}

export interface PatternExample {
  text: string;
  source?: string;
  explanation?: string;
}

export interface PatternFalsePositive {
  text: string;
  explanation: string;
}

export interface PatternSubstitution {
  from: string;
  to: string;
  context?: string;
}

export interface PatternFalseSubstitution {
  from: string;
  to: string;
  why_wrong: string;
}

export interface ResearchSource {
  title: string;
  url?: string;
  citation?: string;
}

export type PatternSeverity = "low" | "medium" | "high" | "critical";

export interface PatternEntry {
  id: string;
  taxonomy_id: string;
  name: string;
  level: PatternLevel;
  heat_weight: number;
  self_amplification: SelfAmplification;
  /** One-line hint for the classifier LLM to detect this pattern */
  detection_hint: string;
  /** Numbered rewrite options — the dice-roll menu */
  rewrite_menu: RewriteOption[];
  /** Terse "Do NOT..." for PCE Channel 2 */
  pce_directive: string;
  /**
   * Per-genre tolerance multipliers. 1.0 = default threshold.
   * >1.0 = more tolerant (e.g., technical writing tolerates nominalizations).
   * <1.0 = less tolerant. 0 = suppress completely.
   * Genres not listed use 1.0.
   */
  tolerance_overrides: Partial<Record<StyleGenre, number>>;

  // ─── Enrichment fields (all optional for backward compat) ────────────
  /** What this pattern is and why it matters */
  description?: string;
  /** Text snippets that exhibit this pattern */
  examples?: PatternExample[];
  /** Text that looks like the pattern but isn't */
  false_positives?: PatternFalsePositive[];
  /** What to replace the pattern with */
  substitutions?: PatternSubstitution[];
  /** Substitutions that seem correct but aren't */
  false_substitutions?: PatternFalseSubstitution[];
  /** Freeform tags for filtering and grouping */
  tags?: string[];
  /** Severity classification */
  severity?: PatternSeverity;
  /** IDs of related patterns */
  related_patterns?: string[];
  /** Detailed notes for classifier tuning */
  detection_notes?: string;
  /** Academic or empirical sources */
  research_sources?: ResearchSource[];
  /** Rolling-window acceptable density (see docs/taxonomy.md) */
  density_threshold?: import("./density-thresholds.ts").DensityThreshold;
}

// ─── Registry ───────────────────────────────────────────────────────────────

export const PATTERN_REGISTRY: PatternEntry[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // LEVEL 1: LEXICAL PATTERNS
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "importance_inflation",
    taxonomy_id: "L-01",
    name: "Importance-Puffing Phrases",
    level: "lexical",
    heat_weight: 1.2,
    self_amplification: "med",
    tags: ["playbook-copy", "playbook-layer:lexical"],
    detection_hint:
      'superlative inflation — "crucial role", "deeply significant", "profoundly shapes", "stands as testament", "rich tapestry", "pivotal moment"',
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Delete the puffing phrase entirely. If the sentence still works without it, leave it deleted. If it doesn't, the sentence was saying nothing.",
      },
      {
        id: 2,
        instruction:
          "Replace with a specific, measurable claim. Instead of 'a profound impact on,' state what actually changed and by how much.",
      },
      {
        id: 3,
        instruction:
          "Replace with understatement. If something is genuinely significant, let the evidence carry the weight. Rewrite so the significance is implied by the specifics, not asserted by the narrator.",
      },
    ],
    pce_directive:
      "Do NOT use superlative inflation ('crucial', 'fundamental', 'remarkable', 'stands as testament')",
    tolerance_overrides: { marketing: 1.5, technical: 0, fiction: 0 },
  },
  {
    id: "resumptive_phrase",
    taxonomy_id: "L-02",
    name: "Resumptive/Meta-Transition Phrases",
    level: "lexical",
    heat_weight: 0.7,
    self_amplification: "high",
    tags: ["playbook-copy", "playbook-layer:phrase"],
    detection_hint:
      'filler openings — "In other words", "Put simply", "Essentially", "In essence", "Simply put", "At its core", "What this means is"',
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Delete the resumptive phrase and the sentence it introduces. The prior sentence already said this.",
      },
      {
        id: 2,
        instruction:
          "If the restatement adds genuine clarity, keep only the restatement and delete the original phrasing. Don't say it twice.",
      },
      {
        id: 3,
        instruction:
          "Replace the resumptive phrase with a forward-looking connector: 'Which means that...' or 'So when X happens...' — advance the argument instead of restating it.",
      },
      {
        id: 4,
        instruction:
          "Replace with a concrete example that illustrates the point instead of rephrasing it abstractly.",
      },
    ],
    pce_directive:
      "Do NOT use filler openings ('It is worth noting', 'Put simply', 'In essence', 'The fact that')",
    tolerance_overrides: { technical: 1.3 },
  },
  {
    id: "hedging",
    taxonomy_id: "L-03",
    name: "Hedging Stacks",
    level: "lexical",
    heat_weight: 0.5,
    self_amplification: "high",
    tags: ["playbook-copy", "playbook-layer:lexical", "playbook-layer:tone"],
    detection_hint:
      'multiple hedges in close proximity — "arguably", "somewhat", "relatively", "it should be noted", "one might argue", "to some extent" — flag when ≥2 hedges in 30 words',
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Remove all hedges from this passage. Make every claim direct. If genuinely uncertain, use a single precise hedge ('roughly 40%' or 'in most cases') rather than stacking qualifiers.",
      },
      {
        id: 2,
        instruction:
          "Replace the hedged claim with its strongest defensible version. What's the most you can say that's still true? Say that.",
      },
      {
        id: 3,
        instruction:
          "Replace with attribution: instead of 'it might be argued that X,' write 'Smith argues X' or 'The evidence suggests X' — anchor the uncertainty in a source, not in syntactic waffling.",
      },
    ],
    pce_directive: "Do NOT stack qualifiers ('might perhaps somewhat', 'arguably relatively')",
    tolerance_overrides: { academic: 1.5, journalism: 0.5, marketing: 0.3 },
  },
  {
    id: "transition_formulaic",
    taxonomy_id: "L-04",
    name: "Filler Discourse Markers",
    level: "lexical",
    heat_weight: 0.7,
    self_amplification: "med",
    tags: ["playbook-copy", "playbook-layer:lexical"],
    detection_hint:
      'sentence-initial mechanical connectives — "Moreover", "Furthermore", "Additionally", "Indeed", "Notably", "Importantly", "Certainly", "Crucially" — flag when ≥2 within 200 words',
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Delete the discourse marker. Start the sentence with its actual content. 'Moreover, the data shows...' → 'The data shows...'",
      },
      {
        id: 2,
        instruction:
          "Replace with a content-bearing connector that specifies the relationship: 'which compounds because...' or 'and the same pattern holds for...' or 'but this breaks down when...'",
      },
      {
        id: 3,
        instruction:
          "Replace the sentence opening with a callback to a specific prior point: 'The same 40% figure appears in...' rather than 'Additionally,...'",
      },
      {
        id: 4,
        instruction: "Merge this sentence into the previous one as a clause.",
      },
    ],
    pce_directive:
      "Do NOT use mechanical transitions ('Moreover', 'Furthermore', 'Additionally', 'In conclusion')",
    tolerance_overrides: { academic: 1.3 },
  },
  {
    id: "em_dash_overuse",
    taxonomy_id: "L-05",
    name: "Em-Dash Overuse",
    level: "lexical",
    heat_weight: 0.6,
    self_amplification: "med",
    tags: ["playbook-copy", "playbook-layer:formatting"],
    detection_hint:
      "em-dashes (— or --) used for parenthetical asides — flag when >1 per 200 words",
    rewrite_menu: [
      {
        id: 1,
        instruction: "Replace the em-dash parenthetical with a separate sentence.",
      },
      {
        id: 2,
        instruction: "Replace with a comma-set clause or parentheses.",
      },
      {
        id: 3,
        instruction:
          "Remove the aside entirely — if the parenthetical is truly parenthetical, the sentence should survive without it.",
      },
      {
        id: 4,
        instruction:
          "Move the parenthetical content to its own paragraph if it's substantive enough.",
      },
    ],
    pce_directive: "Do NOT overuse em-dashes as clause joiners",
    tolerance_overrides: { journalism: 1.5 },
  },
  {
    id: "nominalization",
    taxonomy_id: "L-06",
    name: "Nominalization Overuse",
    level: "lexical",
    heat_weight: 0.6,
    self_amplification: "high",
    detection_hint:
      'verb/adjective concepts expressed as nouns via -tion/-ment/-ness/-ity/-ance/-ence — "the implementation of" for "implementing", "utilization" for "using"',
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Rewrite using the verb form. Find every nominalization and convert it back to its verb: 'the implementation of the system' → 'implementing the system' or 'we implemented the system.'",
      },
      {
        id: 2,
        instruction:
          "Rewrite with a human agent performing an action. Add a subject who does the thing: 'the evaluation was conducted' → 'the team evaluated.'",
      },
      {
        id: 3,
        instruction:
          "Rewrite the sentence starting with the action verb. No throat-clearing, no setup — open with what happens.",
      },
    ],
    pce_directive:
      "Do NOT nominalize verbs ('utilization' → 'using', 'implementation' → 'implementing')",
    tolerance_overrides: { technical: 1.5, academic: 1.5, "literary-essay": 0.5 },
  },
  {
    id: "llm_fingerprint_word",
    taxonomy_id: "L-07",
    name: "LLM Lexical Fingerprint Words",
    level: "lexical",
    heat_weight: 1.0,
    self_amplification: "low",
    tags: ["playbook-copy", "playbook-layer:lexical"],
    detection_hint:
      'words with measurably higher LLM frequency — "delve" (+2665% GPT-4o), "tapestry" (~150×), "camaraderie" (~150×), "palpable" (~135×), "today\'s fast-paced world" (107× GPTZero), "notable works include" (120×), "showcasing" (20×), "remarked" (18×), "aligns" (16×), "surpassing" (12×), "nuanced", "multifaceted", "landscape", "underscores", "realm", "facilitate", "leverage", "robust", "intricate"',
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Replace with a plain-language equivalent. 'Utilize' → 'use.' 'Facilitate' → 'help' or 'make possible.' 'Leverage' → 'use' or omit.",
      },
      {
        id: 2,
        instruction:
          "Replace with a more specific word that says what you actually mean. 'Nuanced' → what kind of nuance? Describe it. 'Comprehensive' → how comprehensive? State the scope.",
      },
      {
        id: 3,
        instruction: "Delete the word and see if the sentence improves. Many of these are padding.",
      },
    ],
    pce_directive:
      "Do NOT use words like 'delve', 'landscape', 'tapestry', 'multifaceted', 'nuanced', 'robust'",
    tolerance_overrides: {},
  },
  {
    id: "tricolon_abstract",
    taxonomy_id: "L-08",
    name: "Tricolon with Abstracting Third Element",
    level: "lexical",
    heat_weight: 0.8,
    self_amplification: "high",
    tags: ["playbook-copy", "playbook-layer:structural"],
    detection_hint:
      'three-item list where the third is more abstract — "clarity, precision, and elegance" / "data, analysis, and insight"',
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Keep only two items. 'Clarity, precision, and elegance' → 'clarity and precision.' The third was padding.",
      },
      {
        id: 2,
        instruction:
          "Make the third item as concrete as the first two. 'Planning, execution, and a post-mortem process that actually gets read.'",
      },
      {
        id: 3,
        instruction:
          "Replace the tricolon with a single precise noun and a clause: 'Clarity — the kind that makes a reader forget they're reading.'",
      },
      {
        id: 4,
        instruction: "Extend to four or five items, all concrete, with no ascending abstraction.",
      },
      {
        id: 5,
        instruction: "Replace the list entirely with a sentence that just says what you mean.",
      },
    ],
    pce_directive: "Do NOT list three abstract nouns in sequence",
    tolerance_overrides: { marketing: 1.5 },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW LEXICAL PATTERNS (L-09 through L-19)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "auxiliary_verb_inflation",
    taxonomy_id: "L-09",
    name: "Auxiliary Verb Inflation",
    level: "lexical",
    heat_weight: 0.5,
    self_amplification: "med",
    detection_hint:
      'overuse of auxiliary verbs creating multi-word verb phrases — "is being implemented", "has been shown to be", "can be used to" — flag when AUX density feels elevated',
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Collapse multi-word verb phrases into simple active verbs. 'is being implemented' → 'we implemented.' 'has been shown to be effective' → 'works.'",
      },
      {
        id: 2,
        instruction:
          "Replace passive auxiliary chains with an agent performing an action. Name who did what.",
      },
      {
        id: 3,
        instruction:
          "Delete the auxiliary and restructure. 'The report can be used to inform decisions' → 'The report informs decisions.'",
      },
      {
        id: 4,
        instruction:
          "Convert progressive/perfect constructions to simple tense where temporal nuance isn't needed. 'was developing' → 'developed.'",
      },
    ],
    pce_directive:
      "Do NOT use multi-word auxiliary chains ('is being', 'has been shown to be', 'can be used to')",
    tolerance_overrides: { academic: 1.3, technical: 1.3, fiction: 0.7 },
  },
  {
    id: "personal_pronoun_skew",
    taxonomy_id: "L-10",
    name: "Personal Pronoun Distribution Skew",
    level: "lexical",
    heat_weight: 0.6,
    self_amplification: "high",
    detection_hint:
      'suppression of first-person pronouns (humans use "I" 25.7× more, Shalevska 2024) and overuse of impersonal "it"/"this"/"that" as sentence subjects — "It is important", "This suggests", "That being said". First-person pronouns at 0.3-0.5× human rate in essays (Desaire 2023, Mitrović 2023)',
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Replace 'It is believed that...' with 'I believe...' or 'Smith argues...' — anchor the claim in a specific person.",
      },
      {
        id: 2,
        instruction:
          "Replace 'We can see that...' with a direct statement. Who is 'we'? If it's the author, say 'I.' If it's the reader, address them directly.",
      },
      {
        id: 3,
        instruction:
          "Replace impersonal 'this' and 'it' subjects with the specific noun they refer to. 'This suggests...' → 'The 40% decline suggests...'",
      },
      {
        id: 4,
        instruction:
          "Write one sentence as a direct personal assertion: 'I think,' 'I noticed,' 'In my experience.' One is enough to humanize the register.",
      },
    ],
    pce_directive:
      "Do NOT use impersonal 'it is' or 'this suggests' as sentence subjects — name the agent or use 'I'",
    tolerance_overrides: { academic: 1.5, technical: 1.5, "literary-essay": 0.5, journalism: 0.7 },
  },
  {
    id: "downtoner_divergence",
    taxonomy_id: "L-11",
    name: "Downtoner Divergence",
    level: "lexical",
    heat_weight: 0.4,
    self_amplification: "med",
    detection_hint:
      'overuse OR underuse of downtoners — "barely", "nearly", "slightly", "somewhat", "hardly", "merely", "scarcely", "almost" — flag when notably more or fewer than expected',
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "If downtoner-heavy: delete every downtoner and read aloud. If the sentence works without qualification, leave it deleted. If genuine uncertainty exists, keep exactly one per claim.",
      },
      {
        id: 2,
        instruction:
          "If downtoner-sparse: scan for unqualified absolute claims. Where approximate, add a single precise qualifier: 'nearly 40%' or 'in most cases.'",
      },
      {
        id: 3,
        instruction:
          "Replace vague downtoners with precise quantities. 'Somewhat effective' → 'effective in 60% of cases.' 'Nearly impossible' → 'succeeded 3 times out of 200.'",
      },
    ],
    pce_directive:
      "Do NOT over-qualify with downtoners ('barely', 'merely', 'somewhat') — use precise quantities instead",
    tolerance_overrides: { academic: 1.3 },
  },
  {
    id: "content_function_ratio",
    taxonomy_id: "L-12",
    name: "Content-to-Function Word Ratio Imbalance",
    level: "lexical",
    heat_weight: 0.5,
    self_amplification: "med",
    detection_hint:
      "prose feels dense and heavy — too many nouns/verbs/adjectives, not enough pronouns/prepositions/conjunctions/contractions — connective tissue is missing",
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Add natural connective tissue. Insert pronouns, contractions, and informal conjunctions ('so', 'but', 'and then') between dense informational sentences.",
      },
      {
        id: 2,
        instruction:
          "Break noun-heavy sentences into two: one with the content, one with the implication.",
      },
      {
        id: 3,
        instruction:
          "Replace one content word per sentence with a pronoun referring to a prior sentence. Let the reader's memory do some work.",
      },
      {
        id: 4,
        instruction:
          "Read aloud. Where you run out of breath, the function words are missing. Add them.",
      },
    ],
    pce_directive:
      "Do NOT pack sentences with only content words — add connective function words (pronouns, conjunctions, prepositions)",
    tolerance_overrides: { academic: 1.3, technical: 1.3, "literary-essay": 0.7 },
  },
  {
    id: "temporal_sweeping_opener",
    taxonomy_id: "L-13",
    name: "Temporal Sweeping Openers",
    level: "lexical",
    heat_weight: 0.9,
    self_amplification: "high",
    tags: ["playbook-copy", "playbook-layer:phrase"],
    detection_hint:
      'paragraph/section opening with grandiose temporal phrase — "In today\'s fast-paced world" (107× human rate, GPTZero 3.3M-doc analysis), "Throughout history", "In the modern era", "In an increasingly interconnected", "In the ever-evolving landscape of", "In recent years", "As we stand at the crossroads"',
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Delete the temporal phrase entirely. Start with the specific claim, fact, or question that actually opens the argument.",
      },
      {
        id: 2,
        instruction:
          "Replace with a specific date, event, or data point. 'In today's rapidly evolving tech landscape...' → 'In March 2026, three major cloud providers shipped the same feature within a week.'",
      },
      {
        id: 3,
        instruction:
          "Replace with the most surprising or counterintuitive point in the paragraph. Open with the punchline.",
      },
      {
        id: 4,
        instruction:
          "Replace with a direct address to the reader's situation. Ground in experience, not epoch.",
      },
    ],
    pce_directive:
      "Do NOT open with temporal generalities ('In today's world', 'Throughout history', 'In the modern era')",
    tolerance_overrides: { marketing: 0.5, journalism: 0, fiction: 0, technical: 0 },
  },
  {
    id: "epistemic_stance_deficit",
    taxonomy_id: "L-14",
    name: "Epistemic Stance Marker Deficit",
    level: "lexical",
    heat_weight: 0.4,
    self_amplification: "low",
    detection_hint:
      'absence of genuine epistemic markers — no "perhaps", "I suspect", "in my view", "as far as I can tell" — claims presented as facts without personal stance or invited debate',
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Identify the three strongest claims. For each, ask: is this genuinely certain? If not, add a precise epistemic marker: 'I suspect,' 'the evidence suggests,' 'in most cases.'",
      },
      {
        id: 2,
        instruction:
          "Replace one institutional hedge ('it's worth noting') with a personal one ('I think this matters because...'). The institutional hedge hides the author; the personal one reveals them.",
      },
      {
        id: 3,
        instruction:
          "Add one sentence per section that acknowledges the limits of the author's knowledge. 'I haven't seen data on X, but...'",
      },
    ],
    pce_directive:
      "Do NOT present all claims as established facts — include genuine epistemic markers ('I suspect', 'the evidence suggests')",
    tolerance_overrides: { technical: 1.5, academic: 0.7 },
  },
  {
    id: "vocabulary_smoothing",
    taxonomy_id: "L-15",
    name: "Vocabulary Smoothing / Specificity Regression",
    level: "lexical",
    heat_weight: 0.7,
    self_amplification: "high",
    detection_hint:
      'specific/rare terms replaced with generic high-frequency alternatives — a technical term becomes "a complex process", a proper noun becomes "a leading company", measurements become "significant"',
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "For every abstract claim, demand a proper noun. 'Experts agree' → which experts? 'Studies show' → which study? 'A significant development' → what specifically happened?",
      },
      {
        id: 2,
        instruction:
          "Replace every 'various', 'multiple', 'several', 'numerous' with the actual number or a specific list.",
      },
      {
        id: 3,
        instruction:
          "Restore the technical term. If the text says 'a complex procedure', replace with the actual name. If you don't know it, that's a gap in the content, not a writing choice.",
      },
      {
        id: 4,
        instruction:
          "Add one hyper-specific detail per paragraph: a date, a measurement, a name, a location.",
      },
    ],
    pce_directive:
      "Do NOT replace specific terms with generic ones — use domain-specific vocabulary, proper nouns, exact numbers",
    tolerance_overrides: { marketing: 1.3 },
  },
  {
    id: "elegant_variation",
    taxonomy_id: "L-16",
    name: "Elegant Variation Compulsion",
    level: "lexical",
    heat_weight: 0.5,
    self_amplification: "low",
    detection_hint:
      'forced synonym rotation for the same referent — "the company" → "the firm" → "the organization" → "the enterprise" within one passage instead of consistent terminology',
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Pick the most precise term for the entity. Use it every time. 'The company' is fine five times in a paragraph.",
      },
      {
        id: 2,
        instruction:
          "Use pronouns instead of cycling synonyms. 'It' and 'they' exist for this purpose.",
      },
      {
        id: 3,
        instruction:
          "If you must vary, vary the framing not the noun. 'The company, which was founded in 2018,' adds information. 'The firm' adds confusion.",
      },
    ],
    pce_directive:
      "Do NOT cycle synonyms for the same referent — use consistent terminology or pronouns",
    tolerance_overrides: { technical: 0.5 },
  },
  {
    id: "contraction_fingerprint",
    taxonomy_id: "L-17",
    name: "Contraction Rate Fingerprint",
    level: "lexical",
    heat_weight: 0.3,
    self_amplification: "med",
    detection_hint:
      "contraction usage is unnaturally uniform — LLMs use contractions at 0.2-0.4× human rate in matched registers (Reinhart 2025). Either all contracted or all expanded with no contextual variation. Apostrophe frequency is a measurable proxy",
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "If contraction-sparse: add contractions where a human would speak them. 'It is not possible' → 'It's not possible.' But keep formal phrasing in the most important claims.",
      },
      {
        id: 2,
        instruction:
          "If contraction-heavy: remove contractions from the single most authoritative sentence per paragraph. The formality spike creates emphasis.",
      },
      {
        id: 3,
        instruction:
          "Vary deliberately: use contractions in examples and asides, formal phrasing in thesis statements. The shift between registers is what sounds human.",
      },
    ],
    pce_directive:
      "Do NOT maintain uniform contraction rate — vary contractions by context (casual in examples, formal in claims)",
    tolerance_overrides: { academic: 1.5, journalism: 0.7 },
  },
  {
    id: "intensifier_saturation",
    taxonomy_id: "L-18",
    name: "Intensifier Saturation",
    level: "lexical",
    heat_weight: 0.6,
    self_amplification: "med",
    tags: ["playbook-copy", "playbook-layer:lexical"],
    detection_hint:
      'weak intensifiers that add emphasis without information — "absolutely", "incredibly", "extremely", "definitely", "certainly", "truly", "remarkably", "very", "really"',
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Delete the intensifier. 'Absolutely crucial' → 'crucial.' If the word can't stand without its intensifier, the word is wrong — find a stronger one.",
      },
      {
        id: 2,
        instruction:
          "Replace the intensifier + adjective with a specific claim. 'Incredibly fast' → 'processes 10,000 requests per second.'",
      },
      {
        id: 3,
        instruction:
          "Move emphasis from the adverb to the sentence structure. Short sentences after long ones create emphasis without intensifiers.",
      },
    ],
    pce_directive:
      "Do NOT use empty intensifiers ('absolutely', 'incredibly', 'extremely', 'very') — use specific claims instead",
    tolerance_overrides: { marketing: 1.5, technical: 0, academic: 0 },
  },
  {
    id: "evasive_complexity",
    taxonomy_id: "L-19",
    name: "Evasive Complexity Acknowledgment",
    level: "lexical",
    heat_weight: 0.8,
    self_amplification: "med",
    detection_hint:
      'stating a topic is complex instead of demonstrating it — "This is a complex and nuanced topic", "While we have only scratched the surface", "The reality is more nuanced", "Acknowledging the multifaceted nature"',
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Delete the complexity acknowledgment entirely. Replace with the most definitive claim you can defend.",
      },
      {
        id: 2,
        instruction:
          "Replace 'This is nuanced' with the specific nuance: 'This works in cities over 500K but fails in rural settings because...'",
      },
      {
        id: 3,
        instruction:
          "If genuine complexity prevents a single answer, state the competing positions and which evidence supports each. Let the reader see the complexity instead of being told it exists.",
      },
    ],
    pce_directive:
      "Do NOT announce complexity ('this is nuanced', 'multifaceted issue') — demonstrate it through evidence and argument",
    tolerance_overrides: { fiction: 0, journalism: 0, marketing: 0 },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LEVEL 2: SENTENCE PATTERNS
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "binary_contrast",
    taxonomy_id: "S-01",
    name: "Binary Contrast Construction",
    level: "sentence",
    heat_weight: 0.8,
    self_amplification: "high",
    tags: ["playbook-copy", "playbook-layer:phrase"],
    detection_hint:
      'opposition frame — "while X, Y", "although X, Y", "X, but Y", "X; however, Y", "Not X — Y", "On one hand... on the other"',
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Remove the contrast. State the complex position directly without first presenting the simple one.",
      },
      {
        id: 2,
        instruction:
          "Replace with a spectrum or gradient: instead of X vs Y, present X→Y as a continuum with intermediate positions.",
      },
      {
        id: 3,
        instruction:
          "Replace with a concession-advance: 'While X is true as far as it goes, the problem is that...' — acknowledge without constructing an artificial opposition.",
      },
      {
        id: 4,
        instruction:
          "Replace with a narrative progression: 'The first attempt assumed X. The data came back showing Y.' Let the contrast emerge from events.",
      },
      {
        id: 5,
        instruction:
          "Replace with a question: 'Is it really about speed? When you look at the failure modes, every one traces to precision.' The contrast is implicit.",
      },
      {
        id: 6,
        instruction:
          "Collapse into a single sentence with a subordinate clause: 'Although X, Y' — reduces the rhetorical weight of the contrast.",
      },
    ],
    pce_directive:
      "Do NOT default to 'while X, Y' or 'X, but Y' opposition frames — vary how you relate competing ideas",
    tolerance_overrides: { marketing: 1.5 },
  },
  {
    id: "participial_cascade",
    taxonomy_id: "S-02",
    name: "Present Participial Cascade",
    level: "sentence",
    heat_weight: 1.0,
    self_amplification: "high",
    detection_hint:
      'multiple -ing participial phrases in sequence — "Drawing on experience, she entered the room, carrying herself with confidence, knowing the outcome depended on this" — flag ≥2 per sentence or ≥3 per 100 words. GPT-4o uses at 5.3× human rate.',
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Rewrite every participial clause as a finite verb clause. 'Drawing on her experience, she...' → 'She drew on her experience and...'",
      },
      {
        id: 2,
        instruction:
          "Break into sequential short sentences. Each -ing clause becomes its own sentence with subject-verb-object.",
      },
      {
        id: 3,
        instruction:
          "Replace the participial opener with a prepositional phrase or adverb: 'With years of experience behind her, she...'",
      },
      {
        id: 4,
        instruction:
          "Move the participial clause to the end: 'She entered the room, drawing on years of...' — end-weight changes the rhythm.",
      },
      {
        id: 5,
        instruction:
          "Delete the participial clause. Often it's scene-painting that the reader doesn't need.",
      },
    ],
    pce_directive: "Do NOT stack -ing participial phrases — use finite verbs instead",
    tolerance_overrides: {},
  },
  {
    id: "clause_symmetry",
    taxonomy_id: "S-03",
    name: "Balanced Clause Symmetry",
    level: "sentence",
    heat_weight: 0.8,
    self_amplification: "med",
    detection_hint:
      "coordinated clauses suspiciously similar in word count and POS sequence — both clauses: article-noun-verb-article-noun-adverb — flag when length difference <15%",
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Make the clauses asymmetric. Lengthen one and shorten the other. Add a parenthetical to one side only.",
      },
      {
        id: 2,
        instruction: "Break into two sentences of different lengths.",
      },
      {
        id: 3,
        instruction:
          "Subordinate one clause to the other: 'The system processes data efficiently, which lets the algorithm...' — create a hierarchy instead of a balance.",
      },
      {
        id: 4,
        instruction:
          "Replace coordination (and/but) with a causal or temporal link: 'because,' 'after,' 'once,' 'so that.'",
      },
      {
        id: 5,
        instruction: "Delete the weaker clause if it's redundant.",
      },
    ],
    pce_directive: "Do NOT make left/right clause lengths match — vary clause proportions",
    tolerance_overrides: { technical: 1.3 },
  },
  {
    id: "that_subject",
    taxonomy_id: "S-04",
    name: '"That"-Subject Constructions',
    level: "sentence",
    heat_weight: 0.5,
    self_amplification: "med",
    detection_hint:
      'heavy "that" as subject complementizer — "The fact that...", "The idea that...", "It is clear that...", "This ensures that...", "This means that..."',
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Remove the frame entirely. 'The fact that prices are rising...' → 'Prices are rising...'",
      },
      {
        id: 2,
        instruction:
          "Replace with a direct assertion. 'It is clear that the system works' → 'The system works.'",
      },
      {
        id: 3,
        instruction:
          "Replace with a question. 'What's interesting is that X' → 'Why does X happen?'",
      },
      {
        id: 4,
        instruction:
          "Replace the that-clause with an infinitive or gerund: 'The challenge of building...' instead of 'The fact that building...'",
      },
    ],
    pce_directive:
      "Do NOT use 'This ensures that', 'This means that', 'The fact that' openings — restructure with direct subjects",
    tolerance_overrides: {},
  },
  {
    id: "sentence_length_clustering",
    taxonomy_id: "S-05",
    name: "Sentence Length Clustering",
    level: "sentence",
    heat_weight: 0.9,
    self_amplification: "high",
    tags: ["playbook-copy", "playbook-layer:structural"],
    detection_hint:
      "this sentence is within ±5 words of its immediate neighbors — human prose has σ ≥ 6 words per 10-sentence window; AI clusters around 15-22 words",
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Split the longest sentence into two. Then merge the two shortest adjacent sentences. Repeat until variance increases.",
      },
      {
        id: 2,
        instruction:
          "Insert a fragment. After a long sentence, add 1-5 words. 'And that was it.' / 'Not quite.' / 'Always.'",
      },
      {
        id: 3,
        instruction:
          "Extend one sentence to 35+ words with a subordinate clause, a parenthetical, and an appositive. Follow it with one under 8 words.",
      },
      {
        id: 4,
        instruction:
          "Rewrite three consecutive sentences as: one long (25+), one short (5-8), one medium (12-18).",
      },
      {
        id: 5,
        instruction:
          "Replace one sentence with a rhetorical question (usually shorter) or a sentence starting with 'Or' or 'Because' (feels incomplete, adds rhythm).",
      },
    ],
    pce_directive:
      "Do NOT make adjacent sentences similar length — vary lengths deliberately (mix 5-word and 35-word sentences)",
    tolerance_overrides: {},
  },
  {
    id: "exhaustive_setup",
    taxonomy_id: "S-06",
    name: "The Exhaustive Setup Sentence",
    level: "sentence",
    heat_weight: 0.9,
    self_amplification: "high",
    detection_hint:
      'sentence previewing everything the paragraph covers — "There are three key factors: X, Y, Z", "This involves several components, including..." with subsequent dutiful coverage',
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Delete the preview sentence entirely. Start with the first factor directly. Let the reader discover the structure by reading it.",
      },
      {
        id: 2,
        instruction:
          "Replace with a question: 'So what actually drives this?' Then discuss the factors without enumeration.",
      },
      {
        id: 3,
        instruction:
          "Mention only the most surprising factor: 'The factor that matters most isn't what you'd expect.' Then discuss it first.",
      },
      {
        id: 4,
        instruction:
          "Replace with a narrative setup: 'When we looked at the data, three things jumped out.' — less clinical, more discovery-oriented.",
      },
      {
        id: 5,
        instruction:
          "Fold the preview into the first substantive point: 'Cost is the first thing everyone looks at — and it's actually the least important.'",
      },
    ],
    pce_directive:
      "Do NOT use exhaustive preview frames ('From X to Y', 'There are three key factors')",
    tolerance_overrides: { technical: 1.5 },
  },
  {
    id: "phrasal_coordination_chain",
    taxonomy_id: "S-07",
    name: "Phrasal Coordination Chains",
    level: "sentence",
    heat_weight: 0.6,
    self_amplification: "med",
    detection_hint:
      '3+ coordinated noun/adjective/gerund phrases — "a dynamic, innovative, and forward-thinking approach" / "enhancing, optimizing, and streamlining"',
    rewrite_menu: [
      {
        id: 1,
        instruction: "Pick the one adjective that matters most and delete the others.",
      },
      {
        id: 2,
        instruction:
          "Replace the chain with a specific comparison or example: instead of three generic adjectives, describe one concrete thing.",
      },
      {
        id: 3,
        instruction:
          "Break across multiple sentences, giving each element its own clause with different evidence.",
      },
      {
        id: 4,
        instruction:
          "Replace with a single unexpected descriptor that carries more information than three generic ones.",
      },
    ],
    pce_directive: "Do NOT chain 3+ coordinated abstract or gerund items — pick one or be specific",
    tolerance_overrides: {},
  },
  {
    id: "agentless_passive",
    taxonomy_id: "S-08",
    name: "Agentless Passive Voice",
    level: "sentence",
    heat_weight: 0.5,
    self_amplification: "med",
    detection_hint:
      'passive voice without identified agent — "The decision was made to...", "It was determined that...", "Steps were taken to address..."',
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Name the agent. 'The decision was made to...' → 'The board decided to...' If you can't name the agent, ask whether the sentence is hiding accountability.",
      },
      {
        id: 2,
        instruction: "Rewrite in active voice with 'we' or 'I' as appropriate.",
      },
      {
        id: 3,
        instruction:
          "Replace with a more specific verb that implies the actor: 'Steps were taken' → 'Engineering shipped a fix for...'",
      },
    ],
    pce_directive:
      "Do NOT use passives without agents ('was implemented', 'has been shown') — name who did what",
    tolerance_overrides: { academic: 1.5, technical: 1.3 },
  },
  {
    id: "imperative_opening",
    taxonomy_id: "S-09",
    name: 'The "Imagine/Consider/Picture This" Opening',
    level: "sentence",
    heat_weight: 0.6,
    self_amplification: "high",
    detection_hint:
      'paragraph/section opening with second-person imperative — "Imagine a world where...", "Consider the following...", "Picture this:", "Think about..."',
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Open with the scenario directly, in third person: 'A 35-year-old teacher in Nebraska opens her laptop at 6 a.m.' — no invitation to imagine.",
      },
      {
        id: 2,
        instruction: "Open with a specific fact or statistic that grounds the same point.",
      },
      {
        id: 3,
        instruction: "Open mid-action: 'The server crashed at 2 a.m. on a Tuesday.' No setup.",
      },
      {
        id: 4,
        instruction: "Open with a quotation from a real person.",
      },
      {
        id: 5,
        instruction:
          "Open with the conclusion the scenario was going to illustrate, then backfill.",
      },
    ],
    pce_directive:
      "Do NOT start with 'Consider', 'Imagine', 'Picture this', 'Note that' — enter through action or fact",
    tolerance_overrides: {},
  },
  {
    id: "definitional_opening",
    taxonomy_id: "S-10",
    name: "The Definitional Opening",
    level: "sentence",
    heat_weight: 0.8,
    self_amplification: "med",
    detection_hint:
      'paragraph/section opening with a definition — "X is defined as...", "X refers to...", "At its core, X is...", "X represents a Y that Z"',
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Open with what X does rather than what X is. 'Containerization packages an application...' rather than 'Containerization is the process of...'",
      },
      {
        id: 2,
        instruction:
          "Open with a problem that X solves. 'Every time you move code from dev to prod, something breaks.'",
      },
      {
        id: 3,
        instruction: "Skip the definition entirely. Use the term and let context define it.",
      },
      {
        id: 4,
        instruction:
          "Open with the distinction between X and what it's most commonly confused with.",
      },
    ],
    pce_directive:
      "Do NOT open with 'X is a Y that Z' definitions — enter through action or example instead",
    tolerance_overrides: { technical: 1.3 },
  },

  // ─── NEW SENTENCE PATTERNS (S-11 through S-20) ────────────────────────────

  {
    id: "subordinate_clause_inflation",
    taxonomy_id: "S-11",
    name: "Subordinate Clause Inflation",
    level: "sentence",
    heat_weight: 0.6,
    self_amplification: "med",
    detection_hint:
      "excess subordinate clauses (that, because, although, which, when, if, while) — sentence is wider than necessary, over-scaffolded with qualifications",
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Break the sentence at each subordinate clause boundary. Each subordination becomes its own sentence.",
      },
      {
        id: 2,
        instruction:
          "Promote the subordinate clause to an independent sentence and delete the conjunction. 'Because the data improved, the team continued' → 'The data improved. The team continued.'",
      },
      {
        id: 3,
        instruction:
          "Replace subordination with coordination. 'Although X, Y' → 'X, but Y' — less cognitive nesting.",
      },
      {
        id: 4,
        instruction:
          "Delete the weakest subordinate clause. If the sentence survives, it was padding.",
      },
    ],
    pce_directive:
      "Do NOT over-subordinate — break complex sentences into simpler independent ones",
    tolerance_overrides: { academic: 1.5, technical: 1.3 },
  },
  {
    id: "clausal_coordination_divergence",
    taxonomy_id: "S-12",
    name: "Clausal Coordination Divergence",
    level: "sentence",
    heat_weight: 0.5,
    self_amplification: "med",
    detection_hint:
      "either too few or too many coordinated independent clauses — GPT avoids clause coordination (choppy), Llama overuses it (run-on)",
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "If undercoordinated (choppy): merge 2-3 adjacent short sentences using 'and', 'but', or 'so.' Not every thought needs its own period.",
      },
      {
        id: 2,
        instruction:
          "If overcoordinated (run-on): break the longest coordinated sentence into separate sentences. Give the reader a period to breathe.",
      },
      {
        id: 3,
        instruction:
          "Alternate deliberately: follow a compound sentence with a simple one. The variation is the point.",
      },
    ],
    pce_directive: "Do NOT maintain uniform coordination style — mix compound and simple sentences",
    tolerance_overrides: {},
  },
  {
    id: "dependency_distance_deficit",
    taxonomy_id: "S-13",
    name: "Dependency Distance Optimization Deficit",
    level: "sentence",
    heat_weight: 0.5,
    self_amplification: "low",
    detection_hint:
      "subjects far from verbs, modifiers far from the words they modify — cognitive processing distance is unnaturally high",
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Move the subject closer to the verb. If more than 5 words separate them, restructure.",
      },
      {
        id: 2,
        instruction:
          "Move modifiers adjacent to the words they modify. 'The policy, which was implemented by the committee after extensive review, achieved results' → 'The committee's policy achieved results after extensive review.'",
      },
      {
        id: 3,
        instruction:
          "Front-load the main clause. Put subject-verb-object first, then attach modifiers after the core meaning is delivered.",
      },
      {
        id: 4,
        instruction:
          "If the sentence has a relative clause, a prepositional phrase, AND an adverbial clause, distribute them across two sentences.",
      },
    ],
    pce_directive:
      "Do NOT separate subjects from verbs or modifiers from the words they modify — keep grammatically connected words close",
    tolerance_overrides: { academic: 1.3 },
  },
  {
    id: "sentence_opener_repetition",
    taxonomy_id: "S-14",
    name: "Sentence Opener Diversity Reduction",
    level: "sentence",
    heat_weight: 0.7,
    self_amplification: "high",
    detection_hint:
      'consecutive sentences starting with the same word or POS pattern — multiple "The..." or "This..." or "It..." openers in a row',
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Highlight the first word of every sentence. If any word appears more than twice, rewrite at least one to start differently.",
      },
      {
        id: 2,
        instruction:
          "Start at least one sentence per paragraph with a subordinate clause, prepositional phrase, or adverb — anything other than the subject.",
      },
      {
        id: 3,
        instruction:
          "Start one sentence per page with a conjunction ('But', 'And', 'Or', 'So') — it breaks the pattern naturally.",
      },
      {
        id: 4,
        instruction:
          "Start one sentence with a question or a single-word fragment. Rhythm comes from variety.",
      },
    ],
    pce_directive:
      "Do NOT start consecutive sentences with the same word — vary sentence openers deliberately",
    tolerance_overrides: {},
  },
  {
    id: "punctuation_skew",
    taxonomy_id: "S-15",
    name: "Punctuation Distribution Skew",
    level: "sentence",
    heat_weight: 0.4,
    self_amplification: "low",
    detection_hint:
      "punctuation repertoire collapse — Shannon entropy of punctuation distribution ~1.5-2× lower than human text (Desaire 2023, Simon 2023). Semicolons rare, colons overused (before lists), parentheses rare, question marks absent in exposition. Commas+periods account for almost all punctuation",
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Replace one colon per page with a semicolon. The colon announces; the semicolon connects.",
      },
      {
        id: 2,
        instruction:
          "Add one parenthetical aside per 500 words. Parentheses create a secondary voice that AI almost never uses.",
      },
      {
        id: 3,
        instruction:
          "Convert one declarative sentence per section into a genuine question. Not rhetorical — one the text then answers.",
      },
      {
        id: 4,
        instruction: "Remove one colon-introduced list per page. Integrate the items into prose.",
      },
    ],
    pce_directive:
      "Do NOT rely exclusively on periods, commas, and colons — use semicolons, parentheses, and questions for variety",
    tolerance_overrides: { technical: 1.3, academic: 1.3 },
  },
  {
    id: "monolithic_tense",
    taxonomy_id: "S-16",
    name: "Monolithic Tense Anchoring",
    level: "sentence",
    heat_weight: 0.5,
    self_amplification: "high",
    detection_hint:
      "rigid adherence to one tense (usually simple present for exposition, simple past for narrative) — no past perfect for background, no progressive, no conditional",
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Add one past-perfect sentence per narrative paragraph: 'The team had already tried three approaches.' It creates temporal depth.",
      },
      {
        id: 2,
        instruction:
          "Shift to conditional tense for one counterfactual per section: 'Without that decision, the project would have stalled.'",
      },
      {
        id: 3,
        instruction:
          "In exposition, shift from present to past for a concrete example, then back. Temporal arcs mirror argumentative arcs.",
      },
      {
        id: 4,
        instruction: "End one section in a different tense than it started.",
      },
    ],
    pce_directive:
      "Do NOT anchor to one tense throughout — use past perfect, conditionals, and progressive for temporal depth",
    tolerance_overrides: { technical: 1.5 },
  },
  {
    id: "cataphoric_deficit",
    taxonomy_id: "S-17",
    name: "Cataphoric Reference Deficit",
    level: "sentence",
    heat_weight: 0.4,
    self_amplification: "high",
    detection_hint:
      'all pronoun references point backward (anaphora) — never forward (cataphora) — "When he woke up, John..." is cataphoric and absent from AI text',
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Invert one pronoun-antecedent pair per paragraph. 'John opened the door. He looked inside.' → 'When he opened the door, John saw nothing.'",
      },
      {
        id: 2,
        instruction:
          "Open one paragraph with a pronoun whose referent appears in the second or third sentence. 'It had been there for years — the crack in the foundation.'",
      },
      {
        id: 3,
        instruction:
          "Use 'this' or 'that' cataphorically: 'This is what they missed:' followed by the explanation.",
      },
    ],
    pce_directive:
      "Do NOT always resolve referents before pronouncing them — occasionally let a pronoun precede its antecedent for tension",
    tolerance_overrides: { technical: 2.0, fiction: 0.5 },
  },
  {
    id: "concessive_while",
    taxonomy_id: "S-18",
    name: 'Concessive "While X, Y" Overuse',
    level: "sentence",
    heat_weight: 0.6,
    self_amplification: "high",
    tags: ["playbook-copy", "playbook-layer:phrase"],
    detection_hint:
      'sentence-initial "While" used for concession (not temporal) — "While X is true, Y is also important" — LLMs produce 8-15 per 1000 words vs human 2-4 per 1000 words (~3-4× overuse, Muñoz-Ortiz 2024). Flag when combined with L-02 or S-01',
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Delete the while-clause. State the Y claim directly without conceding X first.",
      },
      {
        id: 2,
        instruction:
          "Split the contrast across sentences: 'Company visits help. But the foundation comes from the classroom.'",
      },
      {
        id: 3,
        instruction: "Replace with 'even though' or 'despite' for variety.",
      },
      {
        id: 4,
        instruction:
          "Reverse the order: lead with the writer's position, then acknowledge the concession.",
      },
    ],
    pce_directive: "Do NOT overuse concessive 'While X, Y' — vary how you handle balanced claims",
    tolerance_overrides: { academic: 1.3 },
  },
  {
    id: "weak_verb_padding",
    taxonomy_id: "S-19",
    name: "Weak Verb Padding",
    level: "sentence",
    heat_weight: 0.6,
    self_amplification: "med",
    detection_hint:
      'padded verb constructions — "helps with", "plays a role in", "is aimed at", "can be used to", "serves as", "works to", "is focused on", "contributes to"',
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Replace with the root verb. 'Plays a role in improving' → 'improves.' 'Helps with managing' → 'manages.'",
      },
      {
        id: 2,
        instruction:
          "Name the agent. 'The tool can be used to analyze data' → 'Engineers use the tool to analyze data.'",
      },
      {
        id: 3,
        instruction:
          "Delete the padding and test. If 'The initiative engages the community' says everything, the padding was waste.",
      },
    ],
    pce_directive:
      "Do NOT use padded verbs ('plays a role in', 'serves as', 'helps with') — use direct verbs",
    tolerance_overrides: { marketing: 0.5 },
  },
  {
    id: "additive_negative_parallelism",
    taxonomy_id: "S-20",
    name: 'Additive Negative Parallelism ("Not Just X, But Y")',
    level: "sentence",
    heat_weight: 0.5,
    self_amplification: "low",
    tags: ["playbook-copy", "playbook-layer:phrase"],
    detection_hint:
      '"Not just X, but also Y" / "Not only X, but Y" — additive structure used to fulfill comprehensive-answer expectations',
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "State both things directly without the frame. 'Not just efficient, but transformative' → 'efficient and transformative.' Or just 'transformative.'",
      },
      {
        id: 2,
        instruction:
          "Pick the stronger claim and delete the weaker. If the 'not just' clause doesn't earn its place, it's throat-clearing.",
      },
      {
        id: 3,
        instruction:
          "Replace with a specific comparison or progression: 'Efficiency was the starting point. Transformation was the result.'",
      },
    ],
    pce_directive: "Do NOT overuse 'not just X, but also Y' — state claims directly",
    tolerance_overrides: { marketing: 1.5 },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LEVEL 3: PARAGRAPH PATTERNS
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "general_specific_evaluative",
    taxonomy_id: "P-01",
    name: "General→Specific→Evaluative Arc Repetition",
    level: "paragraph",
    heat_weight: 0.8,
    self_amplification: "high",
    detection_hint:
      "paragraph opens with general claim, provides specific detail, closes with evaluation/summary — flag 3+ consecutive paragraphs with this arc",
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Invert: open with the specific case/example/data, then pull back to the general principle. Evidence first, claim second.",
      },
      {
        id: 2,
        instruction:
          "Remove the evaluative closing sentence entirely. End on the evidence. Let the reader evaluate.",
      },
      {
        id: 3,
        instruction:
          "Restructure as question-answer: open with a question, answer with specifics, no summary needed.",
      },
      {
        id: 4,
        instruction:
          "Restructure as problem-solution: open with what goes wrong, then explain the fix.",
      },
      {
        id: 5,
        instruction:
          "Restructure as chronological narrative: first X, then Y, then Z. No framing claim.",
      },
      {
        id: 6,
        instruction:
          "Restructure as contrast: spend the paragraph on two alternatives without resolving which is better.",
      },
      {
        id: 7,
        instruction:
          "Merge into the previous paragraph as additional evidence. Split the previous paragraph's evidence into a standalone.",
      },
    ],
    pce_directive:
      "Do NOT follow General→Specific→Evaluative arc in consecutive paragraphs — vary paragraph shapes",
    tolerance_overrides: {},
  },
  {
    id: "resolution_complete",
    taxonomy_id: "P-02",
    name: "Paragraph-Internal Resolution Compulsion",
    level: "paragraph",
    heat_weight: 0.5,
    self_amplification: "high",
    detection_hint:
      "every tension, question, or complication introduced is resolved within the same paragraph — human writing leaves threads open",
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "End the paragraph after introducing the problem. Delete the resolution. Return to it two paragraphs later.",
      },
      {
        id: 2,
        instruction:
          "Replace the resolution with a complication: 'But this creates a second problem...' and end there.",
      },
      {
        id: 3,
        instruction: "Replace the resolution with a question that the next section will address.",
      },
      {
        id: 4,
        instruction: "Move the resolution to the end of the section rather than the paragraph.",
      },
      {
        id: 5,
        instruction:
          "Replace with a partial, unsatisfying answer: 'The obvious fix is X. It doesn't work.' End paragraph.",
      },
    ],
    pce_directive:
      "Do NOT resolve all tension within the paragraph — leave some threads open for later",
    tolerance_overrides: { technical: 1.5 },
  },
  {
    id: "uniform_paragraph_length",
    taxonomy_id: "P-03",
    name: "Uniform Paragraph Length",
    level: "paragraph",
    heat_weight: 0.8,
    self_amplification: "high",
    tags: ["playbook-copy", "playbook-layer:structural"],
    detection_hint:
      "consecutive paragraphs within ±20% of the same word count — AI clusters around 80-120 words per paragraph",
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Split the longest paragraph at its natural break. Then merge two short adjacent paragraphs.",
      },
      {
        id: 2,
        instruction:
          "Condense one paragraph to under 50 words. Expand another to 200+ words with an extended example.",
      },
      {
        id: 3,
        instruction: "Replace one paragraph with a single-sentence paragraph for emphasis.",
      },
      {
        id: 4,
        instruction:
          "Add a very short transitional paragraph (1-2 sentences) between two long ones.",
      },
      {
        id: 5,
        instruction:
          "Extend one paragraph with a digression, anecdote, or aside that earns its length.",
      },
    ],
    pce_directive:
      "Do NOT make all paragraphs the same length — mix short (1-2 sentences) and long (200+ words)",
    tolerance_overrides: {},
  },
  {
    id: "topic_sentence_first",
    taxonomy_id: "P-04",
    name: "The Topic-Sentence-First Compulsion",
    level: "paragraph",
    heat_weight: 0.7,
    self_amplification: "high",
    detection_hint:
      "this is a theme-stating first sentence — the reader could know the paragraph's point from the first sentence alone",
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Move the topic sentence to the end. Open with evidence, detail, or anecdote that leads to the point.",
      },
      {
        id: 2,
        instruction: "Delete the topic sentence. Let the paragraph's point be implicit.",
      },
      {
        id: 3,
        instruction:
          "Open with a transitional link to the prior paragraph: 'That same logic applies to...'",
      },
      {
        id: 4,
        instruction:
          "Open mid-scene or mid-argument, as if the paragraph started two sentences in.",
      },
      {
        id: 5,
        instruction: "Open with a question that the paragraph answers.",
      },
    ],
    pce_directive:
      "Do NOT always put the topic sentence first — sometimes bury the lead or start with evidence",
    tolerance_overrides: { journalism: 1.3, technical: 1.3 },
  },
  {
    id: "concluding_summary",
    taxonomy_id: "P-05",
    name: "The Concluding-Summary Paragraph",
    level: "paragraph",
    heat_weight: 0.6,
    self_amplification: "high",
    tags: ["playbook-copy", "playbook-layer:structural"],
    detection_hint:
      'paragraph closes section by restating what was said — "In summary", "Overall", "Taken together", "In conclusion" — especially for sections only 3 paragraphs long',
    rewrite_menu: [
      {
        id: 1,
        instruction: "Delete the summary paragraph entirely.",
      },
      {
        id: 2,
        instruction:
          "Replace with a forward-looking paragraph: instead of summarizing, state what the reader should do with this information.",
      },
      {
        id: 3,
        instruction:
          "Replace with a complication or caveat that adds new information: 'This holds until...'",
      },
      {
        id: 4,
        instruction:
          "Replace with an anecdote or example that illustrates the section's point without restating it.",
      },
      {
        id: 5,
        instruction:
          "Use a single sentence that links backward and forward: 'With X established, the question becomes Y.'",
      },
    ],
    pce_directive:
      "Do NOT end paragraphs with summary sentences — end with forward momentum or questions",
    tolerance_overrides: {},
  },
  {
    id: "parallel_paragraph_structure",
    taxonomy_id: "P-06",
    name: "Parallel Paragraph Structure Across Points",
    level: "paragraph",
    heat_weight: 0.9,
    self_amplification: "high",
    detection_hint:
      "each enumerated point gets identically structured paragraph — same length, same opening construction, same internal arc, e.g. 'The first reason is... This means...' × 3",
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Give the first point a full paragraph, the second two sentences, the third its own subsection. Vary weight by importance.",
      },
      {
        id: 2,
        instruction:
          "Present one point as a story, one as data, and one as a contrast with a counterargument.",
      },
      {
        id: 3,
        instruction:
          "Merge two points into a single paragraph showing their relationship. Separate the third.",
      },
      {
        id: 4,
        instruction:
          "Present in decreasing order of surprise: lead with the unexpected one and give it the most space.",
      },
      {
        id: 5,
        instruction:
          "Drop the enumeration entirely. Weave the points into a continuous argument where they emerge organically.",
      },
    ],
    pce_directive:
      "Do NOT mirror paragraph structures across enumerated sections — vary internal organization",
    tolerance_overrides: { technical: 1.5 },
  },
  {
    id: "vignette_then_principle",
    taxonomy_id: "P-07",
    name: 'The "Vignette-Then-Principle" Opening',
    level: "paragraph",
    heat_weight: 0.7,
    self_amplification: "high",
    detection_hint:
      'section opens with mini-story (2-4 sentences, often constructed) followed by "This illustrates..." or pivot to abstract principle',
    rewrite_menu: [
      {
        id: 1,
        instruction: "Open with the principle directly. No scene-setting.",
      },
      {
        id: 2,
        instruction:
          "Open with a statistic or specific fact. '40% of new businesses fail within 18 months.'",
      },
      {
        id: 3,
        instruction:
          "Open mid-argument, as if the reader has already been thinking about this: 'The obvious objection is...'",
      },
      {
        id: 4,
        instruction:
          "Open with a direct address to the reader's current belief: 'You probably think X. The data says Y.'",
      },
      {
        id: 5,
        instruction: "Open with a real historical anecdote. Name, date, place.",
      },
      {
        id: 6,
        instruction: "Open with a question. One sentence. Then answer it.",
      },
      {
        id: 7,
        instruction: "Open with a quotation.",
      },
      {
        id: 8,
        instruction:
          "Open with the most counterintuitive conclusion, stated baldly. Then spend the section justifying it.",
      },
    ],
    pce_directive:
      "Do NOT always follow anecdote→principle pattern — vary the relationship between story and claim",
    tolerance_overrides: {},
  },

  // ─── NEW PARAGRAPH PATTERNS (P-08 through P-12) ───────────────────────────

  {
    id: "dense_but_disconnected",
    taxonomy_id: "P-08",
    name: "Dense but Disconnected (Metapragmatic Link Deficit)",
    level: "paragraph",
    heat_weight: 0.7,
    self_amplification: "med",
    detection_hint:
      "paragraph is locally coherent sentence-by-sentence but lacks explicit logical links between ideas — no 'because', 'which means', 'so' connecting the evidence to the claim",
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Between the two densest adjacent sentences, insert a sentence explaining why the second follows the first.",
      },
      {
        id: 2,
        instruction:
          "Add a 'because', 'which means', 'so', or 'the reason' to at least one sentence per paragraph. Let the reader see the logic chain.",
      },
      {
        id: 3,
        instruction:
          "Replace one information-bearing sentence with an inference sentence. Instead of another fact, tell the reader what the previous facts mean together.",
      },
      {
        id: 4,
        instruction:
          "Test: could these sentences be reordered without loss? If yes, the links are missing.",
      },
    ],
    pce_directive:
      "Do NOT stack facts without connecting them — make the logical relationship between sentences explicit",
    tolerance_overrides: { technical: 1.3 },
  },
  {
    id: "markdown_compulsion",
    taxonomy_id: "P-09",
    name: "Markdown/Formatting Compulsion in Prose",
    level: "paragraph",
    heat_weight: 0.6,
    self_amplification: "med",
    tags: ["playbook-copy", "playbook-layer:formatting"],
    detection_hint:
      "unnecessary bold, italics, bulleted/numbered lists, headers, or raw Markdown syntax in continuous prose contexts",
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Remove all bold, italic, and bullet points. Rewrite as continuous prose. If the structure survives, the formatting was unnecessary.",
      },
      {
        id: 2,
        instruction:
          "Replace inline-header lists ('**Point:** explanation') with topic sentences in separate paragraphs.",
      },
      {
        id: 3,
        instruction:
          "If a list is genuinely needed, earn it by discussing the points in order without numbering them. Let the reader feel the structure.",
      },
    ],
    pce_directive:
      "Do NOT insert Markdown formatting (bold, bullets, headers) into continuous prose — write paragraphs",
    tolerance_overrides: { technical: 2.0, code: 2.0 },
  },
  {
    id: "generic_specificity",
    taxonomy_id: "P-10",
    name: "Generic Specificity (Plausible but Empty Examples)",
    level: "paragraph",
    heat_weight: 0.7,
    self_amplification: "med",
    tags: ["playbook-copy", "playbook-layer:content"],
    detection_hint:
      'examples that feel specific but contain zero verifiable information — no proper nouns, no dates, no measurements — "A procurement policy that made sense for a manufacturing business..."',
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Name the company, person, city, or product. 'A manufacturing business' → 'a Toyota plant in Georgetown, Kentucky.'",
      },
      {
        id: 2,
        instruction:
          "Add a date or a number. 'A policy that didn't scale' → 'A 2019 policy that added 14 days to every order cycle.'",
      },
      {
        id: 3,
        instruction:
          "Replace the hypothetical with a real example. If none exists, state that explicitly rather than fabricating a generic one.",
      },
      {
        id: 4,
        instruction:
          "Ask: could this example appear in any essay on any topic with a different noun swapped in? If yes, it's not an example — it's a template.",
      },
    ],
    pce_directive:
      "Do NOT use generic examples without proper nouns — include names, dates, places, measurements",
    tolerance_overrides: {},
  },
  {
    id: "rst_discourse_skew",
    taxonomy_id: "P-11",
    name: "RST Discourse-Relation Skew",
    level: "paragraph",
    heat_weight: 0.5,
    self_amplification: "med",
    detection_hint:
      "paragraph is built from stacked Elaboration/Background relations — no Temporal sequencing, no Joint equal-weight coordination, no Contrast",
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Replace one Elaboration with a Temporal move. Instead of 'Furthermore, this approach...' → 'First, the team tried X. Then they discovered Y.'",
      },
      {
        id: 2,
        instruction:
          "Replace one Background relation with a Contrast. Instead of 'Given that X...' → 'X is the standard approach. But it fails when...'",
      },
      {
        id: 3,
        instruction:
          "Add one Joint relation: present two facts as equally important. 'The cost dropped. The quality held.' — neither serves the other.",
      },
      {
        id: 4,
        instruction:
          "Add one explicit Cause or Result. Make a 'because' or 'so' visible in the text.",
      },
    ],
    pce_directive:
      "Do NOT build paragraphs from stacked elaborations — mix temporal, contrastive, causal, and joint relations",
    tolerance_overrides: { technical: 1.3 },
  },
  {
    id: "inline_header_lists",
    taxonomy_id: "P-12",
    name: "Inline-Header Vertical Lists",
    level: "paragraph",
    heat_weight: 0.5,
    self_amplification: "high",
    detection_hint:
      'vertical lists with bold inline header + colon merging heading with content — "1. **Historical Context:** The world was changing..."',
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Convert each inline header to a proper section heading with content as a paragraph below it.",
      },
      {
        id: 2,
        instruction: "Remove the bold and colon; integrate into a proper paragraph opening.",
      },
      {
        id: 3,
        instruction:
          "Remove the list structure entirely and write as connected paragraphs with transitions.",
      },
    ],
    pce_directive:
      "Do NOT use bold inline headers in lists — use proper section headings or integrated prose",
    tolerance_overrides: { technical: 1.5 },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LEVEL 4: DOCUMENT PATTERNS
  // ═══════════════════════════════════════════════════════════════════════════

  // D-01 through D-06 are detected at the profile/window level, not per-sentence.
  // They don't appear in the classifier's per-sentence patterns; they're computed
  // in profile.ts from windowed aggregation. Including them here for completeness
  // of the rewrite menus and PCE directives.

  {
    id: "emotional_positivity_bias",
    taxonomy_id: "D-07",
    name: "Emotional Positivity Bias / Negative Affect Suppression",
    level: "document",
    heat_weight: 0.6,
    self_amplification: "high",
    tags: ["playbook-copy", "playbook-layer:tone"],
    detection_hint:
      "document shows systematically reduced negative emotions (fear, disgust, anger) and uniform positivity — even serious subjects get optimistic framing and positive conclusions",
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Identify the three most serious implications. For each, write one sentence that sits with the negative consequence. No 'however' pivot.",
      },
      {
        id: 2,
        instruction:
          "Ensure the conclusion is not more optimistic than the evidence warrants. If the data is mixed, the conclusion should be mixed.",
      },
      {
        id: 3,
        instruction:
          "Add one sentence of genuine concern, alarm, or criticism per section where the topic warrants it.",
      },
      {
        id: 4,
        instruction:
          "In narrative: allow one scene per 1,000 words to end badly. Not every paragraph needs resolution.",
      },
    ],
    pce_directive:
      "Do NOT resolve everything positively — allow negative consequences, unresolved problems, and genuine alarm where warranted",
    tolerance_overrides: { marketing: 1.5, fiction: 0.5 },
  },
  {
    id: "readability_uniformity",
    taxonomy_id: "D-08",
    name: "Vocabulary/Readability Uniformity",
    level: "document",
    heat_weight: 0.5,
    self_amplification: "high",
    detection_hint:
      "readability scores are flat across the entire document — same difficulty level start to finish — no complexity spikes or breathing room",
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Follow the most technical section with the simplest. Create deliberate readability contrast.",
      },
      {
        id: 2,
        instruction:
          "Add one passage per 1,000 words that is markedly simpler: a concrete example, an analogy, a one-line summary.",
      },
      {
        id: 3,
        instruction:
          "Add one passage per 1,000 words that is markedly denser: data-heavy, precise technical specification, complex conditional.",
      },
      {
        id: 4,
        instruction:
          "Vary sentence complexity within paragraphs. Follow a 30-word sentence with an 8-word sentence.",
      },
    ],
    pce_directive:
      "Do NOT maintain uniform readability — deliberately vary complexity (simple examples after dense arguments)",
    tolerance_overrides: { technical: 1.3 },
  },
  {
    id: "specificity_gradient_flat",
    taxonomy_id: "D-09",
    name: "Specificity Gradient Flattening",
    level: "document",
    heat_weight: 0.6,
    self_amplification: "high",
    detection_hint:
      "document lacks the 'long tail' of domain-specific vocabulary — all words are intermediate-frequency, no expert jargon, no hyper-specific terms",
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Identify the 5 most domain-specific terms that should appear but don't. Insert them with appropriate context.",
      },
      {
        id: 2,
        instruction:
          "Replace 3 generic nouns per section with domain-specific equivalents. 'Procedure' → 'sternotomy.' 'System' → 'event-driven message bus.'",
      },
      {
        id: 3,
        instruction:
          "Add one sentence per section using insider jargon, then immediately contextualize for non-experts. The jargon proves expertise; the context proves communication skill.",
      },
    ],
    pce_directive:
      "Do NOT stick to intermediate vocabulary — use domain-specific terms, proper nouns, and expert jargon with context",
    tolerance_overrides: { marketing: 1.5 },
  },
  {
    id: "cross_domain_rigidity",
    taxonomy_id: "D-10",
    name: "Cross-Domain Stylistic Rigidity",
    level: "document",
    heat_weight: 0.5,
    self_amplification: "high",
    detection_hint:
      "the text's syntactic structure (noun-to-verb ratio, coordination frequency, nominalization rate) matches the model's default 'helpful assistant' style regardless of the prompt genre",
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "For informal prompts: check nominalization rate, passive voice rate, and mean sentence length. If any are within 10% of the model's academic output, the informality is surface-only. Restructure.",
      },
      {
        id: 2,
        instruction:
          "For narrative prompts: check past-tense verb frequency and 3rd-person pronoun rate. If these don't exceed the model's expository baseline, the narrative is just exposition in past tense.",
      },
      {
        id: 3,
        instruction:
          "Regenerate from a fresh context without prior output visible. Convergence decay combined with stylistic rigidity means the model's second paragraph sounds like its hundredth.",
      },
    ],
    pce_directive:
      "Do NOT maintain the same syntactic structure regardless of genre — actually shift register, not just vocabulary",
    tolerance_overrides: {},
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION ROUND 2 — tropes.fyi, GPTZero, NYT, nostalgebraist, Jiang & Hyland
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── LEXICAL L-20 through L-25 ────────────────────────────────────────────

  {
    id: "idiom_avoidance",
    taxonomy_id: "L-20",
    name: "Idiom and Colloquialism Avoidance",
    level: "lexical",
    heat_weight: 0.5,
    self_amplification: "med",
    detection_hint:
      'natural idioms replaced with literal formal alternatives — "a whole different ball game" becomes "a fundamentally different situation"; colorful phrases absent; register is uniformly formal even where informal is expected',
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Identify one formal construction per paragraph that a human would say as an idiom. Replace it. 'A fundamentally different situation' → 'A whole different ball game.'",
      },
      {
        id: 2,
        instruction:
          "Add one colloquial phrase per 500 words in informal genres. Use it where the register calls for personality, not precision.",
      },
      {
        id: 3,
        instruction:
          "Replace one Latinate word per section with its Anglo-Saxon equivalent. 'Utilize' → 'use.' 'Commence' → 'start.' 'Demonstrate' → 'show.'",
      },
    ],
    pce_directive:
      "Do NOT replace idioms with formal paraphrases — use natural colloquial language where register permits",
    tolerance_overrides: { academic: 2.0, technical: 1.5, fiction: 0.5, journalism: 0.5 },
  },
  {
    id: "copula_substitution",
    taxonomy_id: "L-21",
    name: 'Copula Substitution ("Serves As" Dodge)',
    level: "lexical",
    heat_weight: 0.6,
    self_amplification: "high",
    detection_hint:
      'simple "is/are/was" replaced with inflated alternatives — "serves as", "stands as", "functions as", "acts as", "represents", "marks" — driven by repetition penalty avoiding "is"',
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Replace 'serves as' / 'stands as' / 'functions as' with 'is.' The sentence is stronger.",
      },
      {
        id: 2,
        instruction:
          "If 'is' has been used recently, restructure the sentence rather than substituting the copula. 'Gallery 825 serves as the exhibition space' → 'The exhibition space is Gallery 825' or 'Exhibitions happen at Gallery 825.'",
      },
      {
        id: 3,
        instruction:
          "Delete the copula substitute and restructure with an action verb. 'The building serves as a reminder' → 'The building reminds visitors...'",
      },
    ],
    pce_directive:
      "Do NOT substitute 'is/are' with 'serves as', 'stands as', 'functions as', 'represents' — use simple copulas or action verbs",
    tolerance_overrides: {},
  },
  {
    id: "marketing_register_leak",
    taxonomy_id: "L-22",
    name: "Marketing Action Verbs as Default Register",
    level: "lexical",
    heat_weight: 0.7,
    self_amplification: "high",
    tags: ["playbook-copy", "playbook-layer:lexical"],
    detection_hint:
      'advertising verbs in non-marketing contexts — "Unlock", "Empower", "Elevate", "Master", "Revolutionize", "Transform", "Harness", "Unleash", "Supercharge" — motivational-speaker tone leaking into academic, technical, or encyclopedic writing',
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Replace the marketing verb with a neutral one. 'Unlock your potential' → 'Improve your skills.' 'Revolutionize your workflow' → 'Change how you work.'",
      },
      {
        id: 2,
        instruction:
          "Delete the verb and the hype around it. State what actually happens. 'Harness the power of AI' → 'Use AI to...'",
      },
      {
        id: 3,
        instruction:
          "Check the register: is this marketing copy? If not, the verb doesn't belong. Technical docs don't 'unleash.' Research papers don't 'revolutionize.'",
      },
    ],
    pce_directive:
      "Do NOT use marketing verbs ('unlock', 'empower', 'elevate', 'harness', 'unleash') outside marketing contexts",
    tolerance_overrides: { marketing: 2.0, technical: 0, academic: 0 },
  },
  {
    id: "spectral_vocabulary_palette",
    taxonomy_id: "L-23",
    name: "Ghostly-Spectral Vocabulary Palette (Fiction)",
    level: "lexical",
    heat_weight: 0.8,
    self_amplification: "high",
    detection_hint:
      "convergent atmospheric word palette regardless of narrative context — ghosts, echoes, whispers, shadows, specters, void, heartbeat, pulse, humming, flickering, pulsing, buzzing, shimmering — ~20 instances per 1,200 words in LLM fiction vs ~2-4 in human literary fiction",
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Flag every word from the spectral palette. For each, ask: does this scene actually involve this sensation? If not, replace with a sensation specific to what's happening.",
      },
      {
        id: 2,
        instruction:
          "Replace atmospheric abstractions with concrete physical detail. 'Shadows flickered' → 'The overhead fluorescent buzzed and went dark for a half-second.'",
      },
      {
        id: 3,
        instruction:
          "Cut half the atmospheric words. If the scene has 10 sensory-atmosphere words, keep 5. Force yourself to earn each one with specificity.",
      },
    ],
    pce_directive:
      "Do NOT default to ghosts/echoes/whispers/shadows/void/pulse/humming atmosphere — use sensory details specific to the actual scene",
    tolerance_overrides: { fiction: 1.0, technical: 0, academic: 0, journalism: 0 },
  },
  {
    id: "character_name_convergence",
    taxonomy_id: "L-24",
    name: "Fictional Character Name Convergence",
    level: "lexical",
    heat_weight: 0.5,
    self_amplification: "med",
    detection_hint:
      'statistically rare names that appear with high frequency in LLM fiction — "Elara", "Aria", "Voss", "Kael", "Lena", "Kai", "Miriam", "Sarah Chen" — co-occurrence of 2+ is near-definitive AI signal',
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Check every character name against the LLM name convergence list. Replace any matches with names sourced from a real population (census data, phone book, yearbook).",
      },
      {
        id: 2,
        instruction:
          "Use names that are common in the setting's culture and era. A 1980s Midwestern story doesn't have characters named 'Kael' and 'Elara.'",
      },
    ],
    pce_directive:
      "Do NOT use converged LLM character names ('Elara', 'Aria', 'Kael', 'Voss', 'Kai', 'Sarah Chen') — choose names grounded in setting",
    tolerance_overrides: { fiction: 1.0, technical: 0, academic: 0 },
  },
  {
    id: "invented_concept_label",
    taxonomy_id: "L-25",
    name: "Invented Concept Labels",
    level: "lexical",
    heat_weight: 0.7,
    self_amplification: "med",
    detection_hint:
      'compound nouns presented as established terminology that don\'t actually exist — "supervision paradox", "acceleration trap", "workload creep", "attention entropy" — used with definitional confidence but not found in Google Scholar or reference works',
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Verify every compound-noun term against Google Scholar. If it has <5 hits, it's likely invented. Replace with a description: 'the supervision paradox' → 'the problem of oversight reducing autonomy.'",
      },
      {
        id: 2,
        instruction:
          "If you're coining a term, flag it as novel: 'what I'll call the acceleration trap' — human writers signal novelty; LLMs present inventions as established.",
      },
      {
        id: 3,
        instruction:
          "Delete the label and describe the concept in plain language. If the concept needs 3+ sentences to explain, it wasn't captured by the label anyway.",
      },
    ],
    pce_directive:
      "Do NOT present invented compound nouns as established terminology — verify terms exist in academic literature or flag them as novel",
    tolerance_overrides: { academic: 0.5 },
  },

  // ─── SENTENCE S-21 through S-26 ──────────────────────────────────────────

  {
    id: "negation_reframe",
    taxonomy_id: "S-21",
    name: "Negation-Reframe Construction (\"It's Not X — It's Y\")",
    level: "sentence",
    heat_weight: 1.0,
    self_amplification: "high",
    tags: ["playbook-copy", "playbook-layer:phrase"],
    detection_hint:
      'negation followed by dramatic restatement — "It\'s not about efficiency — it\'s about transformation", "The question isn\'t X. The question is Y", "Not X. Not Y. Just Z." — measured at ~1 per 200 words in AI text. The single most identified AI tell per tropes.fyi',
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Delete the negation. State the positive claim directly. 'It's not about speed — it's about precision' → 'Precision matters more than speed here.'",
      },
      {
        id: 2,
        instruction:
          "If the contrast is genuine, express it as a trade-off rather than a revelation. 'Speed and precision pull in opposite directions. In this case, precision wins.'",
      },
      {
        id: 3,
        instruction:
          "Replace with evidence. Instead of announcing what something 'really is,' show the reader through a specific example or data point.",
      },
      {
        id: 4,
        instruction:
          "Replace with a question. 'Is it really about speed? Every failure mode traces to precision.' — the reader reaches the conclusion themselves.",
      },
    ],
    pce_directive:
      "Do NOT use 'It's not X — it's Y' or 'The question isn't X' negation-reframe constructions — state the positive claim directly",
    tolerance_overrides: { marketing: 1.3 },
  },
  {
    id: "rhetorical_qa_cadence",
    taxonomy_id: "S-22",
    name: "Self-Posed Rhetorical Q&A Cadence",
    level: "sentence",
    heat_weight: 0.7,
    self_amplification: "high",
    detection_hint:
      'rhetorical question immediately followed by its own answer as rhythmic device — "The result? Devastating." / "What does this mean? It means adapting quickly." — cycles every 3-5 sentences, 3-5× per 500 words in AI text',
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Delete the rhetorical question and keep only the answer as a declarative statement.",
      },
      {
        id: 2,
        instruction:
          "If a question genuinely advances the argument, leave it — but answer it in a full paragraph, not one sentence. A question worth asking deserves more than a punchline.",
      },
      {
        id: 3,
        instruction:
          "Replace the Q&A with a conditional: 'If you're wondering about the result — it was devastating.' Less mechanical, same information.",
      },
    ],
    pce_directive:
      "Do NOT cycle through rhetorical question → one-sentence answer as a rhythmic device — state claims directly or develop questions fully",
    tolerance_overrides: { journalism: 1.3 },
  },
  {
    id: "svo_rigidity",
    taxonomy_id: "S-23",
    name: "SVO Word Order Rigidity",
    level: "sentence",
    heat_weight: 0.5,
    self_amplification: "med",
    detection_hint:
      "rigid adherence to Subject-Verb-Object order with no fronted objects, inversions, existential constructions, or cleft sentences — human text shows Shannon Index ~3.2 for syntactic constructions vs significantly lower for LLMs",
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Front the object or adverb in one sentence per paragraph. 'The team completed the project quickly' → 'Quickly, the team completed the project' or 'The project, the team completed in record time.'",
      },
      {
        id: 2,
        instruction:
          "Add one cleft or pseudo-cleft construction per section: 'What surprised us was...' or 'It was the timeline that broke first.'",
      },
      {
        id: 3,
        instruction:
          "Start one sentence with the complement or adverbial: 'Into this void stepped...' or 'From the wreckage of the first attempt came...'",
      },
    ],
    pce_directive:
      "Do NOT maintain rigid Subject-Verb-Object order in every sentence — use fronting, inversions, cleft sentences for variety",
    tolerance_overrides: { technical: 1.5, academic: 1.3 },
  },
  {
    id: "over_explanation",
    taxonomy_id: "S-24",
    name: "Over-Explanation and Parenthetical Definitions",
    level: "sentence",
    heat_weight: 0.6,
    self_amplification: "high",
    tags: ["playbook-copy", "playbook-layer:content"],
    detection_hint:
      'unnecessary definitions of well-known terms in specialized contexts — "An API (Application Programming Interface)" in a software engineering post; "stochastic (meaning random) processes" in a statistics paper — audience-expertise mismatch',
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Delete the parenthetical definition. Your audience knows what this term means. If they don't, they'll look it up.",
      },
      {
        id: 2,
        instruction:
          "If a term genuinely needs explaining, weave the explanation into the sentence rather than parenthesizing it: 'APIs — the interfaces that let programs talk to each other — are...'",
      },
      {
        id: 3,
        instruction:
          "Check the audience. If this is a technical blog, delete 100% of basic definitions. If it's a general-audience piece, keep them but use natural language, not acronym expansions.",
      },
    ],
    pce_directive:
      "Do NOT define well-known terms parenthetically — trust your audience's expertise or explain naturally in prose",
    tolerance_overrides: { technical: 0.5, academic: 0.5 },
  },
  {
    id: "forced_synesthesia",
    taxonomy_id: "S-25",
    name: "Forced Synesthesia / Abstract-Concrete Collision (Fiction)",
    level: "sentence",
    heat_weight: 0.8,
    self_amplification: "high",
    detection_hint:
      'compulsive fusion of abstract concepts with physical/sensory verbs — "Thursday tastes of almost-Friday", "sorrow tastes of metal", "grief is infinite recursion", "constraints humming like a server farm" — ~20 per 1,200 words in LLM fiction vs ~2-4 in human literary fiction, and each is abandoned after one sentence',
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Cut two-thirds of the synesthetic images. Keep only those that earn their place by being extended, explored, or returned to later.",
      },
      {
        id: 2,
        instruction:
          "If you use an abstract-concrete collision, develop it for at least 2-3 sentences. 'Grief is infinite recursion' means nothing if the next sentence moves on. Show the recursion.",
      },
      {
        id: 3,
        instruction:
          "Replace the abstract-concrete collision with a concrete-concrete image. Instead of 'sorrow tastes of metal,' try 'she bit the inside of her cheek until she tasted metal.' Ground the image in action.",
      },
    ],
    pce_directive:
      "Do NOT scatter one-off synesthetic images — either develop them across multiple sentences or use concrete-concrete imagery instead",
    tolerance_overrides: { fiction: 1.0, technical: 0, academic: 0 },
  },
  {
    id: "whether_universal_closer",
    taxonomy_id: "S-26",
    name: '"Whether" Universal Closer',
    level: "sentence",
    heat_weight: 0.7,
    self_amplification: "high",
    detection_hint:
      'paragraph/section ending with "Whether you\'re X, Y, or Z, [topic] has something for everyone" — attempts audience-inclusive closure that reads as a marketing template',
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Delete the 'whether' closer entirely. The section should end on its last substantive point.",
      },
      {
        id: 2,
        instruction:
          "Replace with a specific call to action for the actual target audience, not a catch-all. 'If you're a solo dev shipping on weekends, start with the free tier.'",
      },
      {
        id: 3,
        instruction:
          "Replace with a forward-looking statement that creates tension or curiosity rather than closure: 'The hard part isn't choosing a tool. It's knowing when the tool is choosing for you.'",
      },
    ],
    pce_directive:
      "Do NOT end sections with 'Whether you're X, Y, or Z, [topic] has something for everyone' — end on substance, not inclusive catch-all",
    tolerance_overrides: { marketing: 1.5 },
  },

  // ─── PARAGRAPH P-13 through P-15 ─────────────────────────────────────────

  {
    id: "blocky_scene_architecture",
    taxonomy_id: "P-13",
    name: "Blocky Scene Architecture (Fiction)",
    level: "paragraph",
    heat_weight: 0.6,
    self_amplification: "med",
    detection_hint:
      "fiction organized into clearly demarcated blocks — dialogue block, then exposition block, then narration block — with sharp boundaries. Human fiction weaves dialogue, action, interiority, and description within scenes",
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Interleave. Break a 5-sentence dialogue block by inserting a physical action between lines 2 and 3, and an interior thought between lines 4 and 5.",
      },
      {
        id: 2,
        instruction:
          "Delete the exposition block that follows dialogue. Instead, embed the exposition as subtext within the dialogue itself — let characters reveal information through what they say and don't say.",
      },
      {
        id: 3,
        instruction:
          "Start mid-action. Instead of narration-block → dialogue-block, start the scene in the middle of both: a character speaking while doing something, with the setting revealed through what they interact with.",
      },
    ],
    pce_directive:
      "Do NOT organize fiction into discrete dialogue/exposition/narration blocks — weave all modes together within scenes",
    tolerance_overrides: { fiction: 1.0 },
  },
  {
    id: "listicle_in_trenchcoat",
    taxonomy_id: "P-14",
    name: "Listicle in a Trench Coat",
    level: "paragraph",
    heat_weight: 0.7,
    self_amplification: "med",
    detection_hint:
      'numbered list disguised as continuous prose — "The first challenge is... The second consideration involves... The third factor relates to..." — ordinal markers wearing the costume of flowing paragraphs',
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Remove all ordinal markers. If the points still flow as prose, the structure was already there. If they don't, they're a list — format them as one honestly.",
      },
      {
        id: 2,
        instruction:
          "Weave the points into a continuous argument where they emerge from each other: 'Cost matters. But cost creates a secondary problem: teams cut testing to save money, which...' — each point causes the next.",
      },
      {
        id: 3,
        instruction:
          "Lead with the most important point and subordinate the others. Not all points deserve equal weight.",
      },
    ],
    pce_directive:
      "Do NOT disguise numbered lists as prose with ordinal markers ('The first... The second... The third...') — either use a real list or write a real argument",
    tolerance_overrides: { technical: 1.5 },
  },
  {
    id: "manufactured_fragments",
    taxonomy_id: "P-15",
    name: "Manufactured Single-Sentence Paragraphs",
    level: "paragraph",
    heat_weight: 0.5,
    self_amplification: "high",
    tags: ["playbook-copy", "playbook-layer:structural"],
    detection_hint:
      'isolated single-sentence paragraphs inserted for dramatic emphasis at predictable intervals — "That changes everything." / "This is where it gets interesting." — every 3-5 paragraphs vs rarely in human writing',
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Merge the fragment into the preceding or following paragraph. If the drama survives the merge, the fragment wasn't doing work.",
      },
      {
        id: 2,
        instruction:
          "Keep at most one single-sentence paragraph per 1,000 words. Make it earn its isolation by being genuinely surprising, not a generic intensifier.",
      },
      {
        id: 3,
        instruction:
          "Replace the generic fragment ('That changes everything.') with a specific one ('The CFO resigned the next morning.'). Specificity earns the dramatic weight that isolation provides.",
      },
    ],
    pce_directive:
      "Do NOT insert manufactured single-sentence paragraphs for emphasis at regular intervals — earn isolation with specificity",
    tolerance_overrides: { journalism: 1.3, fiction: 1.3 },
  },

  // ─── DOCUMENT D-11 through D-16 ──────────────────────────────────────────

  {
    id: "grammatical_perfection",
    taxonomy_id: "D-11",
    name: "Grammatical Perfection (Error Absence)",
    level: "document",
    heat_weight: 0.3,
    self_amplification: "low",
    detection_hint:
      "zero typographical errors, zero grammatical mistakes, zero informal spellings across 1000+ words — paradoxically suspicious in contexts where some errors are expected (student essays, Reddit posts, casual emails). Humans produce ~1-3 minor errors per 1000 words informally",
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "This is a diagnostic signal, not something to 'fix.' If generating text that should appear human-written in an informal context, consider: would this person really never mistype, never use a comma splice, never start a sentence with 'And'?",
      },
    ],
    pce_directive:
      "Do NOT produce flawless grammar in informal registers — natural writing has occasional comma splices, fragments, and colloquial constructions",
    tolerance_overrides: { academic: 2.0, technical: 2.0 },
  },
  {
    id: "digression_absence",
    taxonomy_id: "D-12",
    name: "Digression Absence (Relentless Linearity)",
    level: "document",
    heat_weight: 0.6,
    self_amplification: "high",
    detection_hint:
      "text is relentlessly linear and on-topic — never wanders on tangents, includes asides, starts threads it forgets to complete, or mentions something that just occurred to the author. Every sentence advances the argument in order. Humans meander, go off on tangents, and don't close every loop",
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Add one genuine digression per 1,000 words — a tangentially related thought, a personal aside, a 'speaking of which' that you don't fully develop before returning to the main thread.",
      },
      {
        id: 2,
        instruction:
          "Leave one thread open. Mention something in paragraph 2 that you don't return to until paragraph 8. Human writing has forgotten threads and delayed callbacks.",
      },
      {
        id: 3,
        instruction:
          "Insert one parenthetical aside per section that reveals the author's personality: an opinion, a memory, a preference. 'I've always thought X, though that may be the kind of thing only someone who grew up in Y would say.'",
      },
    ],
    pce_directive:
      "Do NOT maintain relentless linearity — include digressions, asides, tangents, and threads you return to later",
    tolerance_overrides: { technical: 1.5, academic: 1.3 },
  },
  {
    id: "vocabulary_collapse_over_length",
    taxonomy_id: "D-13",
    name: "Vocabulary Collapse Over Document Length",
    level: "document",
    heat_weight: 0.6,
    self_amplification: "high",
    detection_hint:
      "type-token ratio decreases over document length as the model recycles the same words and images — observable after ~5,000 words as declining MATTR. Human writers maintain or increase lexical novelty over document length",
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "In the second half of the document, deliberately introduce 5-10 words you haven't used in the first half. Fresh vocabulary in the late sections signals human authorship.",
      },
      {
        id: 2,
        instruction:
          "Break long documents at the 3,000-word mark and regenerate the second half in a fresh context with only the propositional outline (not the prose) from the first half.",
      },
    ],
    pce_directive:
      "Do NOT let vocabulary narrow over document length — introduce fresh language in later sections",
    tolerance_overrides: {},
  },
  {
    id: "sycophantic_closing",
    taxonomy_id: "D-14",
    name: "Sycophantic and Motivational Closings",
    level: "document",
    heat_weight: 0.8,
    self_amplification: "high",
    detection_hint:
      'HR-onboarding-style encouragement regardless of topic — "You\'ve got this!", "Start using these tips today!", "The journey starts now — embrace the possibilities!", "Unlock your full potential!" — Stanford sycophancy study: models validated problematic actions 47% of the time',
    rewrite_menu: [
      {
        id: 1,
        instruction: "Delete the motivational closer entirely. End on the last substantive point.",
      },
      {
        id: 2,
        instruction:
          "Replace with a complication, a caveat, or a question. End by making the reader think, not by making them feel good.",
      },
      {
        id: 3,
        instruction:
          "Replace with specific next steps tied to the content: 'Open your terminal. Run the benchmark. If latency drops below 200ms, ship it.' — concrete, not motivational.",
      },
    ],
    pce_directive:
      "Do NOT end with motivational encouragement ('You've got this!', 'embrace the possibilities') — end on substance, complication, or specific next steps",
    tolerance_overrides: { marketing: 1.5 },
  },
  {
    id: "interactional_metadiscourse_deficit",
    taxonomy_id: "D-15",
    name: "Reduced Interactional Metadiscourse",
    level: "document",
    heat_weight: 0.5,
    self_amplification: "high",
    detection_hint:
      "fewer boosters (clearly, obviously), attitude markers (surprisingly, fortunately), engagement markers (questions, personal asides), and self-mentions — text asserts without persuading. Jiang & Hyland 2025 confirmed across multiple studies: student essays are significantly richer in engagement features",
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "Add one booster per section where you're confident: 'This clearly matters' or 'The evidence is overwhelming.' Take a stance.",
      },
      {
        id: 2,
        instruction:
          "Add one attitude marker per section: 'Surprisingly,' 'Unfortunately,' 'Curiously.' Let the reader know how you feel about the evidence.",
      },
      {
        id: 3,
        instruction:
          "Add one engagement marker per 500 words: a direct question to the reader, a 'you might wonder,' or a 'consider this.' Pull the reader into the argument.",
      },
    ],
    pce_directive:
      "Do NOT strip interactional markers — include boosters, attitude markers, engagement markers, and self-mentions to create a persuasive voice",
    tolerance_overrides: { technical: 1.5, academic: 1.0 },
  },
  {
    id: "cross_model_consensus",
    taxonomy_id: "D-16",
    name: "Cross-Model Consensus Signature",
    level: "document",
    heat_weight: 0.4,
    self_amplification: "low",
    detection_hint:
      "text is equally probable under multiple different language models — human text shows more divergence between models. Binoculars: ratio of perplexity to cross-perplexity scores below ~0.73 for AI vs above ~0.901 for human text. Fundamental: AI text occupies the overlapping high-probability zone of all models",
    rewrite_menu: [
      {
        id: 1,
        instruction:
          "This is a statistical detection signature, not a prose pattern. It cannot be fixed by rewriting — it requires introducing genuine idiosyncrasy that only a specific human would produce: personal opinions, unusual word choices, domain-specific jargon, or structural violations.",
      },
    ],
    pce_directive:
      "Do NOT write text that would be equally predicted by all language models — introduce genuine idiosyncrasy",
    tolerance_overrides: {},
  },
];

// ─── Lookup helpers ─────────────────────────────────────────────────────────

const _byId = new Map<string, PatternEntry>();
const _byTaxonomyId = new Map<string, PatternEntry>();
for (const entry of PATTERN_REGISTRY) {
  _byId.set(entry.id, entry);
  _byTaxonomyId.set(entry.taxonomy_id, entry);
}

/** Look up a pattern by its code identifier (e.g., "binary_contrast") */
export function getPattern(id: string): PatternEntry | undefined {
  return _byId.get(id);
}

/** Look up a pattern by its taxonomy ID (e.g., "S-01") */
export function getPatternByTaxonomyId(taxonomyId: string): PatternEntry | undefined {
  return _byTaxonomyId.get(taxonomyId);
}

/** Get all patterns at a given level */
export function getPatternsByLevel(level: PatternLevel): PatternEntry[] {
  return PATTERN_REGISTRY.filter((p) => p.level === level);
}

/** Get all patterns matching a tag (e.g. "playbook-copy", "playbook-layer:lexical") */
export function getPatternsByTag(tag: string): PatternEntry[] {
  return PATTERN_REGISTRY.filter((p) => p.tags?.includes(tag));
}

export type { DensityThreshold, DensityThresholdUnit } from "./density-thresholds.ts";
export {
  getEffectiveMaxCount,
  isCountOverThreshold,
  PLAYBOOK_DENSITY_THRESHOLDS,
} from "./density-thresholds.ts";

import type { PatternType } from "../types.ts";
import type { DensityThreshold } from "./density-thresholds.ts";
import { PLAYBOOK_DENSITY_THRESHOLDS as _PLAYBOOK_THRESHOLDS } from "./density-thresholds.ts";

/** Resolve density threshold for a pattern (entry override, then playbook defaults). */
export function getDensityThreshold(id: string): DensityThreshold | undefined {
  const entry = _byId.get(id);
  if (entry?.density_threshold) return entry.density_threshold;
  return _PLAYBOOK_THRESHOLDS[id as PatternType];
}

/** Get heat weight for a pattern (used by computeHeat) */
export function getHeatWeight(id: string): number {
  return _byId.get(id)?.heat_weight ?? 0.5;
}

/** Get PCE directive for a pattern (used by buildNegativeConstraints) */
export function getPCEDirective(id: string): string {
  return _byId.get(id)?.pce_directive ?? `Avoid: ${id}`;
}

/** Get constraint directive for a pattern (used by generateConstraints) */
export function getConstraintDirective(id: string): string {
  const entry = _byId.get(id);
  if (!entry) return id;
  return `${entry.name} — ${entry.pce_directive.replace("Do NOT ", "avoid: ")}`;
}

/**
 * Select a rewrite option from the menu using dice-roll logic.
 * Excludes the lastUsedOptionId to prevent repetition.
 * Returns the selected option, or undefined if no menu exists.
 */
export function rollRewriteOption(
  patternId: string,
  lastUsedOptionId?: number,
): RewriteOption | undefined {
  const entry = _byId.get(patternId);
  if (!entry || entry.rewrite_menu.length === 0) return undefined;

  const candidates =
    lastUsedOptionId != null
      ? entry.rewrite_menu.filter((o) => o.id !== lastUsedOptionId)
      : entry.rewrite_menu;

  // If all were filtered (shouldn't happen with >1 option), fall back to full menu
  const pool = candidates.length > 0 ? candidates : entry.rewrite_menu;

  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Get the tolerance multiplier for a pattern in a given genre.
 * Returns 1.0 if no override is set.
 */
export function getTolerance(patternId: string, genre: StyleGenre): number {
  const entry = _byId.get(patternId);
  if (!entry) return 1.0;
  return entry.tolerance_overrides[genre] ?? 1.0;
}

/**
 * Get all pattern IDs as a Set (for validation in the classifier).
 */
export function getValidPatternIds(): Set<string> {
  return new Set(PATTERN_REGISTRY.map((p) => p.id));
}

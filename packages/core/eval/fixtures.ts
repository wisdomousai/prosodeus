/**
 * Eval Fixtures — Hand-crafted sentences with ground-truth pattern labels.
 *
 * Each fixture has:
 *   - id:               Stable identifier for reporting
 *   - text:             The sentence(s) to classify
 *   - expected:         Patterns that MUST be detected (recall testing)
 *   - absent:           Patterns that must NOT be detected (precision testing)
 *   - difficulty:       "obvious" | "subtle" | "decoy"
 *   - notes:            Why this is ground truth
 *
 * Fixtures are grouped by the PRIMARY pattern being tested.
 * Multi-pattern sentences test co-occurrence detection.
 *
 * RULES FOR WRITING FIXTURES:
 * - "obvious" = unambiguous, textbook instance. A human annotator would flag it 100%.
 * - "subtle" = present but mild. Reasonable people might disagree. Tests sensitivity.
 * - "decoy" = looks like the pattern but isn't. Tests specificity. expected=[], absent=[the pattern].
 * - Keep sentences to 1-2 sentences max (per-sentence classifier).
 * - For paragraph patterns (P-*), use 3-5 sentence passages.
 */

import type { PatternType } from "../src/types.ts";

export interface EvalFixture {
  id: string;
  text: string;
  expected: PatternType[];
  absent?: PatternType[];
  difficulty: "obvious" | "subtle" | "decoy";
  notes: string;
}

export const FIXTURES: EvalFixture[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // CLEAN SENTENCES (no patterns — precision baseline)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "clean-01",
    text: "The cat sat on the mat.",
    expected: [],
    difficulty: "obvious",
    notes: "Simple sentence, no patterns.",
  },
  {
    id: "clean-02",
    text: "She ran fast.",
    expected: [],
    difficulty: "obvious",
    notes: "Minimal sentence.",
  },
  {
    id: "clean-03",
    text: "The rain poured down. Streets flooded within minutes.",
    expected: [],
    difficulty: "obvious",
    notes: "Concrete, vivid writing.",
  },
  {
    id: "clean-04",
    text: "He walked to the store and bought milk.",
    expected: [],
    difficulty: "obvious",
    notes: "Simple compound sentence.",
  },
  {
    id: "clean-05",
    text: "I think we should try a different approach next quarter.",
    expected: [],
    difficulty: "obvious",
    notes: "First-person, direct, no AI tells.",
  },
  {
    id: "clean-06",
    text: "The server crashed at 2 a.m. on a Tuesday; nobody noticed until the morning standup.",
    expected: [],
    difficulty: "subtle",
    notes:
      "Semicolon usage, specific details — human-like writing that shouldn't trigger anything.",
  },
  {
    id: "clean-07",
    text: "Look, I've been doing this for fifteen years and the numbers don't lie.",
    expected: [],
    difficulty: "subtle",
    notes: "Informal, first-person, idiomatic — maximally human.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // L-01: IMPORTANCE-PUFFING PHRASES
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "L01-obvious-1",
    text: "This discovery stands as a testament to the remarkable ingenuity of modern science.",
    expected: ["importance_inflation"],
    difficulty: "obvious",
    notes: "'stands as a testament' + 'remarkable ingenuity' = classic puffing.",
  },
  {
    id: "L01-obvious-2",
    text: "The initiative represents a pivotal moment in the evolution of urban planning.",
    expected: ["importance_inflation"],
    difficulty: "obvious",
    notes: "'pivotal moment' + 'evolution of' = puffing + nominalization.",
  },
  {
    id: "L01-subtle-1",
    text: "The policy had a significant impact on regional housing markets.",
    expected: ["importance_inflation"],
    difficulty: "subtle",
    notes: "'significant impact' is mild puffing — tests sensitivity threshold.",
  },
  {
    id: "L01-decoy-1",
    text: "The bridge collapsed at 3:42 p.m., killing fourteen people.",
    expected: [],
    absent: ["importance_inflation"],
    difficulty: "decoy",
    notes: "Genuinely significant event stated factually — not puffing.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // L-02: RESUMPTIVE/META-TRANSITION PHRASES
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "L02-obvious-1",
    text: "In other words, the system processes data more efficiently than its predecessor.",
    expected: ["resumptive_phrase"],
    difficulty: "obvious",
    notes: "'In other words' is textbook resumptive.",
  },
  {
    id: "L02-obvious-2",
    text: "Put simply, the algorithm reduces computation time by half.",
    expected: ["resumptive_phrase"],
    difficulty: "obvious",
    notes: "'Put simply' restates what should already be clear.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // L-04: FILLER DISCOURSE MARKERS
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "L04-obvious-1",
    text: "Moreover, the integration of machine learning has further enhanced the platform's capabilities.",
    expected: ["transition_formulaic", "nominalization"],
    difficulty: "obvious",
    notes: "'Moreover' = formulaic transition; 'integration' = nominalization.",
  },
  {
    id: "L04-obvious-2",
    text: "Furthermore, recent studies have confirmed the hypothesis.",
    expected: ["transition_formulaic"],
    difficulty: "obvious",
    notes: "'Furthermore' sentence-initial filler.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // L-06: NOMINALIZATION OVERUSE
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "L06-obvious-1",
    text: "The utilization of advanced methodologies facilitated the optimization of resource allocation.",
    expected: ["nominalization"],
    difficulty: "obvious",
    notes:
      "Four nominalizations in one sentence: utilization, optimization, allocation + 'facilitated'.",
  },
  {
    id: "L06-decoy-1",
    text: "The nation's constitution guarantees freedom of expression.",
    expected: [],
    absent: ["nominalization"],
    difficulty: "decoy",
    notes:
      "'constitution', 'nation', 'expression' — these are established nouns, not verb-to-noun conversions in context.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // L-07: LLM FINGERPRINT WORDS
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "L07-obvious-1",
    text: "Let's delve into the multifaceted landscape of modern artificial intelligence.",
    expected: ["llm_fingerprint_word"],
    difficulty: "obvious",
    notes: "Triple fingerprint: 'delve', 'multifaceted', 'landscape'.",
  },
  {
    id: "L07-obvious-2",
    text: "This robust framework leverages cutting-edge technology to streamline operations.",
    expected: ["llm_fingerprint_word"],
    difficulty: "obvious",
    notes: "'robust', 'leverages', 'streamline' — all fingerprint words.",
  },
  {
    id: "L07-subtle-1",
    text: "The research underscores the importance of early intervention.",
    expected: ["llm_fingerprint_word"],
    difficulty: "subtle",
    notes: "'underscores' at +1182% overuse per Reinhart 2025. Single word, but high signal.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // L-08: TRICOLON WITH ABSTRACTING THIRD
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "L08-obvious-1",
    text: "The program promotes clarity, precision, and excellence.",
    expected: ["tricolon_abstract"],
    difficulty: "obvious",
    notes: "Third element ('excellence') is more abstract than first two.",
  },
  {
    id: "L08-decoy-1",
    text: "She packed a sandwich, an apple, and a thermos of coffee.",
    expected: [],
    absent: ["tricolon_abstract"],
    difficulty: "decoy",
    notes: "Three concrete items at the same specificity level.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // S-01: BINARY CONTRAST
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "S01-obvious-1",
    text: "While traditional methods rely on manual analysis, modern approaches leverage automation.",
    expected: ["binary_contrast"],
    difficulty: "obvious",
    notes: "'While X, Y' = textbook binary contrast.",
  },
  {
    id: "S01-obvious-2",
    text: "It seems simple. But the reality is far more complex.",
    expected: ["binary_contrast"],
    difficulty: "obvious",
    notes: "Simple-then-complex binary opposition.",
  },
  {
    id: "S01-decoy-1",
    text: "Although it rained, we still had a good time at the picnic.",
    expected: [],
    absent: ["binary_contrast"],
    difficulty: "decoy",
    notes: "Genuine concession, not artificial opposition. Real event, not rhetoric.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // S-02: PARTICIPIAL CASCADE
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "S02-obvious-1",
    text: "Drawing on decades of experience, leveraging cutting-edge tools, and building on prior research, the team delivered results.",
    expected: ["participial_cascade"],
    difficulty: "obvious",
    notes: "Three stacked participial phrases before the main clause.",
  },
  {
    id: "S02-subtle-1",
    text: "Working with the data, she identified three anomalies.",
    expected: ["participial_cascade"],
    difficulty: "subtle",
    notes: "Single participial opener — mild but detectable.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // S-05: SENTENCE LENGTH CLUSTERING
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "S05-obvious-1",
    text: "The system processes data efficiently. The algorithm optimizes resource usage. The platform handles concurrent requests. The framework ensures data integrity.",
    expected: ["sentence_length_clustering"],
    difficulty: "obvious",
    notes: "Four consecutive sentences at ~5-6 words each. Clear clustering.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // S-06: EXHAUSTIVE SETUP SENTENCE
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "S06-obvious-1",
    text: "There are three key factors to consider: cost, scalability, and security.",
    expected: ["exhaustive_setup"],
    difficulty: "obvious",
    notes: "Numeric preview + colon + list = exhaustive setup.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // S-08: AGENTLESS PASSIVE
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "S08-obvious-1",
    text: "The decision was made to terminate the project.",
    expected: ["agentless_passive"],
    difficulty: "obvious",
    notes: "Passive with no agent — who made the decision?",
  },
  {
    id: "S08-obvious-2",
    text: "It was determined that further investigation was needed.",
    expected: ["agentless_passive"],
    difficulty: "obvious",
    notes: "Double agentless passive.",
  },
  {
    id: "S08-decoy-1",
    text: "The report was written by the engineering team over three weeks.",
    expected: [],
    absent: ["agentless_passive"],
    difficulty: "decoy",
    notes: "Has a by-agent — this is fine.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // S-09: IMPERATIVE OPENING
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "S09-obvious-1",
    text: "Imagine a world where every child has access to quality education.",
    expected: ["imperative_opening"],
    difficulty: "obvious",
    notes: "'Imagine a world where...' = textbook imperative opening.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // S-10: DEFINITIONAL OPENING
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "S10-obvious-1",
    text: "Machine learning is a subset of artificial intelligence that enables systems to learn from data.",
    expected: ["definitional_opening"],
    difficulty: "obvious",
    notes: "'X is a Y that Z' = definitional opening.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW PATTERNS — EXPANSION ROUND 1
  // ═══════════════════════════════════════════════════════════════════════════

  // L-09: Auxiliary verb inflation
  {
    id: "L09-obvious-1",
    text: "The system is being implemented and has been shown to be effective in reducing latency.",
    expected: ["auxiliary_verb_inflation"],
    difficulty: "obvious",
    notes: "'is being implemented', 'has been shown to be' — multi-word auxiliary chains.",
  },

  // L-10: Personal pronoun skew
  {
    id: "L10-obvious-1",
    text: "It is important to consider that this approach has been widely adopted.",
    expected: ["personal_pronoun_skew"],
    difficulty: "obvious",
    notes: "Impersonal 'It is' where a human would write 'I think' or name who considers it.",
  },

  // L-13: Temporal sweeping opener
  {
    id: "L13-obvious-1",
    text: "In today's rapidly evolving digital landscape, organizations must adapt to survive.",
    expected: ["temporal_sweeping_opener", "llm_fingerprint_word"],
    difficulty: "obvious",
    notes:
      "'In today's rapidly evolving digital landscape' = temporal sweep + 'landscape' fingerprint.",
  },
  {
    id: "L13-obvious-2",
    text: "Throughout history, humans have sought to understand the natural world.",
    expected: ["temporal_sweeping_opener"],
    difficulty: "obvious",
    notes: "'Throughout history' = temporal sweep.",
  },

  // L-15: Vocabulary smoothing
  {
    id: "L15-obvious-1",
    text: "Experts argue that this revolutionary approach has the potential to transform the entire industry.",
    expected: ["vocabulary_smoothing"],
    difficulty: "obvious",
    notes: "'Experts' (who?), 'revolutionary' (how?), 'entire industry' (which?) — all generic.",
  },

  // L-16: Elegant variation
  {
    id: "L16-obvious-1",
    text: "Apple reported strong earnings. The tech giant attributed growth to services revenue. The Cupertino company expects continued momentum.",
    expected: ["elegant_variation"],
    difficulty: "obvious",
    notes: "Apple → 'the tech giant' → 'the Cupertino company' — forced synonym rotation.",
  },

  // L-18: Intensifier saturation
  {
    id: "L18-obvious-1",
    text: "This is absolutely crucial for achieving truly remarkable results.",
    expected: ["intensifier_saturation", "importance_inflation"],
    difficulty: "obvious",
    notes: "'absolutely' + 'truly' + 'remarkable' = intensifier stack + puffing.",
  },

  // L-19: Evasive complexity acknowledgment
  {
    id: "L19-obvious-1",
    text: "This is a complex and nuanced topic that defies simple explanations.",
    expected: ["evasive_complexity"],
    difficulty: "obvious",
    notes: "Stating complexity instead of demonstrating it.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW PATTERNS — EXPANSION ROUND 2
  // ═══════════════════════════════════════════════════════════════════════════

  // L-20: Idiom avoidance (hard to test per-sentence — it's an absence)

  // L-21: Copula substitution
  {
    id: "L21-obvious-1",
    text: "Gallery 825 serves as LAAA's primary exhibition space.",
    expected: ["copula_substitution"],
    difficulty: "obvious",
    notes: "'serves as' where 'is' would be natural — copula dodge.",
  },
  {
    id: "L21-obvious-2",
    text: "The building stands as a reminder of the city's industrial heritage.",
    expected: ["copula_substitution", "importance_inflation"],
    difficulty: "obvious",
    notes: "'stands as' = copula substitution; 'heritage' = mild puffing.",
  },

  // L-22: Marketing register leak
  {
    id: "L22-obvious-1",
    text: "Unlock your full potential and revolutionize your workflow with these five proven strategies.",
    expected: ["marketing_register_leak"],
    difficulty: "obvious",
    notes:
      "'Unlock', 'revolutionize', 'proven strategies' — marketing verbs in non-marketing context.",
  },
  {
    id: "L22-obvious-2",
    text: "Harness the power of AI to supercharge your productivity.",
    expected: ["marketing_register_leak"],
    difficulty: "obvious",
    notes: "'Harness', 'supercharge' — advertising register.",
  },

  // L-23: Spectral vocabulary (fiction)
  {
    id: "L23-obvious-1",
    text: "Shadows flickered across the walls as a faint humming echoed through the void, each whisper pulsing with an ancient rhythm.",
    expected: ["spectral_vocabulary_palette"],
    difficulty: "obvious",
    notes:
      "shadows, flickered, humming, echoed, void, whisper, pulsing — 7 spectral words in one sentence.",
  },

  // L-24: Character name convergence
  {
    id: "L24-obvious-1",
    text: "Elara traced the edge of the map while Kael paced behind her.",
    expected: ["character_name_convergence"],
    difficulty: "obvious",
    notes: "'Elara' + 'Kael' — two converged LLM names in one sentence.",
  },

  // L-25: Invented concept labels
  {
    id: "L25-obvious-1",
    text: "The supervision paradox — where increased oversight actually reduces team effectiveness — has been well documented.",
    expected: ["invented_concept_label"],
    difficulty: "obvious",
    notes: "'supervision paradox' doesn't exist in academic literature. Presented as established.",
  },

  // S-11: Subordinate clause inflation
  {
    id: "S11-obvious-1",
    text: "Although the research suggests that further investigation is needed, which could take several years, the preliminary findings indicate that the approach is viable.",
    expected: ["subordinate_clause_inflation"],
    difficulty: "obvious",
    notes: "Three nested subordinate clauses: although, that, which, that.",
  },

  // S-14: Sentence opener repetition
  {
    id: "S14-obvious-1",
    text: "The system handles requests efficiently. The algorithm processes data in real time. The platform scales horizontally. The framework ensures reliability.",
    expected: ["sentence_opener_repetition"],
    difficulty: "obvious",
    notes: "Four consecutive sentences starting with 'The' — no opener variety.",
  },

  // S-16: Monolithic tense
  {
    id: "S16-obvious-1",
    text: "The team develops the software. The manager reviews the code. The client approves the design. The project moves forward.",
    expected: ["monolithic_tense"],
    difficulty: "obvious",
    notes: "All simple present. No tense variation for temporal depth.",
  },

  // S-18: Concessive while
  {
    id: "S18-obvious-1",
    text: "While this approach has its limitations, it offers significant advantages over traditional methods.",
    expected: ["concessive_while", "binary_contrast"],
    difficulty: "obvious",
    notes: "Concessive 'While' + binary contrast. Classic double-tell.",
  },

  // S-19: Weak verb padding
  {
    id: "S19-obvious-1",
    text: "The initiative plays a role in helping with community engagement and works to contribute to social cohesion.",
    expected: ["weak_verb_padding"],
    difficulty: "obvious",
    notes: "'plays a role in helping with', 'works to contribute to' — double-padded.",
  },

  // S-21: Negation-reframe
  {
    id: "S21-obvious-1",
    text: "It's not about the technology — it's about the people.",
    expected: ["negation_reframe"],
    difficulty: "obvious",
    notes: "'It's not X — it's Y' = textbook negation-reframe. The #1 AI tell per tropes.fyi.",
  },
  {
    id: "S21-obvious-2",
    text: "The question isn't whether we can build it. The question is whether we should.",
    expected: ["negation_reframe"],
    difficulty: "obvious",
    notes: "Two-sentence negation-reframe variant.",
  },
  {
    id: "S21-decoy-1",
    text: "It wasn't the earthquake that killed people — it was the collapsed buildings.",
    expected: [],
    absent: ["negation_reframe"],
    difficulty: "decoy",
    notes: "Genuine factual correction, not rhetorical reframe.",
  },

  // S-22: Rhetorical Q&A cadence
  {
    id: "S22-obvious-1",
    text: "The result? Devastating.",
    expected: ["rhetorical_qa_cadence"],
    difficulty: "obvious",
    notes: "One-word question + one-word answer = Q&A cadence.",
  },
  {
    id: "S22-obvious-2",
    text: "What does this mean for small businesses? It means adapting quickly or falling behind.",
    expected: ["rhetorical_qa_cadence"],
    difficulty: "obvious",
    notes: "Self-posed question + immediate answer.",
  },

  // S-24: Over-explanation
  {
    id: "S24-obvious-1",
    text: "The team used an API (Application Programming Interface) to connect the microservices.",
    expected: ["over_explanation"],
    difficulty: "obvious",
    notes: "Parenthetical definition of a term any developer knows.",
  },
  {
    id: "S24-decoy-1",
    text: "The study used CRISPR (Clustered Regularly Interspaced Short Palindromic Repeats) to edit the gene.",
    expected: [],
    absent: ["over_explanation"],
    difficulty: "decoy",
    notes: "CRISPR expansion is standard in first mention, even in scientific papers.",
  },

  // S-25: Forced synesthesia (fiction)
  {
    id: "S25-obvious-1",
    text: "Thursday tasted of almost-Friday, and grief hummed like a server farm running hot.",
    expected: ["forced_synesthesia"],
    difficulty: "obvious",
    notes: "Two abstract-concrete collisions in one sentence, neither developed.",
  },

  // S-26: "Whether" universal closer
  {
    id: "S26-obvious-1",
    text: "Whether you're a seasoned professional or just starting out, this guide has something for everyone.",
    expected: ["whether_universal_closer"],
    difficulty: "obvious",
    notes: "'Whether you're X or Y, [topic] has something for everyone' — template.",
  },

  // P-08: Dense but disconnected
  {
    id: "P08-obvious-1",
    text: "The system uses 256-bit encryption. Response times average 12ms. The team consists of 14 engineers. Revenue grew 340% year-over-year. The API handles 50,000 requests per second.",
    expected: ["dense_but_disconnected"],
    difficulty: "obvious",
    notes: "Five data-heavy sentences with no logical connectors between them.",
  },

  // P-09: Markdown compulsion
  {
    id: "P09-obvious-1",
    text: "**Key Benefits:** The system offers several advantages. **Scalability:** It handles millions of requests. **Reliability:** Uptime exceeds 99.99%.",
    expected: ["markdown_compulsion", "inline_header_lists"],
    difficulty: "obvious",
    notes: "Bold inline headers + colon format in what should be prose.",
  },

  // P-10: Generic specificity
  {
    id: "P10-obvious-1",
    text: "Many organizations have found that implementing flexible work policies can significantly improve employee satisfaction and retention.",
    expected: ["generic_specificity"],
    difficulty: "obvious",
    notes:
      "'Many organizations' (which?), 'flexible work policies' (what kind?), 'significantly' (how much?) — all generic.",
  },

  // P-14: Listicle in a trench coat
  {
    id: "P14-obvious-1",
    text: "The first challenge is scalability. The second consideration involves data privacy. The third factor relates to user adoption. The fourth element concerns long-term maintenance.",
    expected: ["listicle_in_trenchcoat"],
    difficulty: "obvious",
    notes: "Ordinal markers disguising a list as prose paragraphs.",
  },

  // P-15: Manufactured fragments
  {
    id: "P15-obvious-1",
    text: "The team spent six months on the redesign. They tested every component. They validated every assumption. That changes everything.",
    expected: ["manufactured_fragments"],
    difficulty: "obvious",
    notes: "'That changes everything.' — generic dramatic fragment after mundane details.",
  },

  // D-14: Sycophantic closing
  {
    id: "D14-obvious-1",
    text: "Start implementing these strategies today and unlock your full potential! The journey to success begins now — embrace the possibilities!",
    expected: ["sycophantic_closing", "marketing_register_leak"],
    difficulty: "obvious",
    notes: "Motivational closer with 'unlock', 'journey', 'embrace the possibilities'.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPOUND PATTERNS (testing co-occurrence detection)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "compound-01",
    text: "Moreover, the utilization of this groundbreaking methodology has the potential to fundamentally reshape the entire landscape of modern healthcare.",
    expected: [
      "transition_formulaic",
      "nominalization",
      "importance_inflation",
      "llm_fingerprint_word",
      "intensifier_saturation",
    ],
    difficulty: "obvious",
    notes:
      "5+ patterns in one sentence: Moreover (L-04), utilization (L-06), groundbreaking (L-01), landscape (L-07), fundamentally (L-18).",
  },
  {
    id: "compound-02",
    text: "While traditional approaches focused on manual processes, the implementation of AI-driven solutions has enabled organizations to achieve unprecedented levels of operational efficiency.",
    expected: ["binary_contrast", "nominalization", "importance_inflation"],
    difficulty: "obvious",
    notes: "Binary contrast + nominalization + puffing in one sentence.",
  },
  {
    id: "compound-03",
    text: "In today's rapidly evolving world, it's not about working harder — it's about working smarter.",
    expected: ["temporal_sweeping_opener", "negation_reframe"],
    difficulty: "obvious",
    notes: "Temporal sweep opening + negation-reframe = double AI tell.",
  },
];

// ─── Fixture Statistics ─────────────────────────────────────────────────────

export function getFixtureStats() {
  const total = FIXTURES.length;
  const clean = FIXTURES.filter((f) => f.expected.length === 0).length;
  const patterns = new Set<string>();
  for (const f of FIXTURES) {
    for (const p of f.expected) patterns.add(p);
  }
  const byDifficulty = {
    obvious: FIXTURES.filter((f) => f.difficulty === "obvious").length,
    subtle: FIXTURES.filter((f) => f.difficulty === "subtle").length,
    decoy: FIXTURES.filter((f) => f.difficulty === "decoy").length,
  };
  return {
    total,
    clean,
    uniquePatterns: patterns.size,
    patterns: [...patterns].sort(),
    byDifficulty,
  };
}

# Prose Entropy Pattern Taxonomy
## Detection Heuristics & Rewrite Menus

Version 0.1 — Working Document
Inspired by and extending: Biber (1988) 66-feature MDA, Reinhart et al. (2025) PNAS, Muñoz-Ortiz et al. (2024), Wikipedia WikiProject AI Cleanup

---

## How to Read This Document

Each pattern entry contains:

- **ID** — Stable reference code (L = lexical, S = sentence, P = paragraph, D = document)
- **Pattern** — What to detect
- **Detection** — How to detect it (REGEX = string matching, PARSE = dependency/constituency parse, LLM = requires semantic judgment)
- **LLM Overuse Factor** — How much more frequently LLMs produce this vs. humans, where measured. "~" indicates estimate from observation rather than published measurement.
- **Self-Amplification** — How much worse this gets when the model reads its own prior output in context. HIGH/MED/LOW.
- **Acceptable Density** — Target frequency range per rolling window (calibrate per style guide)
- **Rewrite Menu** — Numbered alternatives, each expressed as a concrete instruction you can send to an LLM with the flagged passage. The system rolls a die and picks one. These are prompt templates with {CONTENT} as the slot for the original text.

---

## LEVEL 1: LEXICAL PATTERNS

These are surface-level word and phrase choices. Cheapest to detect, easiest to suppress, but also the least durable — LLM providers actively patch the most obvious tells. Still worth catching because they cluster and compound.

---

### L-01: Importance-Puffing Phrases

**Pattern:** Phrases that inflate significance without adding information. "stands as a testament to," "a pivotal moment in," "it's worth noting that," "a profound impact on," "a cornerstone of," "it cannot be overstated," "a watershed moment," "a rich tapestry of."

**Detection:** REGEX against curated phrase list. Maintain living list; these shift across model versions.

**LLM Overuse Factor:** ~3–8× depending on phrase. "Tapestry" is almost exclusively LLM at this point.

**Self-Amplification:** MED. The model sees one in context, probability of a second increases.

**Acceptable Density:** 0 per 1,000 words for most genres. Technical writing: 0. Fiction: 0. Marketing: ≤1 per 500 words.

**Rewrite Menu:**
1. "Delete the phrase entirely. If the sentence still works without it, leave it deleted. If it doesn't, the sentence was saying nothing."
2. "Replace with a specific, measurable claim. Instead of 'a profound impact on,' state what actually changed and by how much."
3. "Replace with understatement. If something is genuinely significant, let the evidence carry the weight. Rewrite the sentence so the significance is implied by the specifics, not asserted by the narrator."

---

### L-02: Resumptive/Meta-Transition Phrases

**Pattern:** "In other words," "Put simply," "Essentially," "That is to say," "To put it another way," "In essence," "Simply put," "At its core," "The bottom line is," "What this means is."

**Detection:** REGEX. High-confidence match.

**LLM Overuse Factor:** ~2–4×. LLMs summarize obsessively, often restating a point that was already clear.

**Self-Amplification:** HIGH. Each resumptive phrase signals to the model that restating is expected, increasing the probability of the next one.

**Acceptable Density:** ≤1 per 800 words. Many documents need zero.

**Rewrite Menu:**
1. "Delete the resumptive phrase and the sentence it introduces. The prior sentence already said this."
2. "If the restatement adds genuine clarity, keep only the restatement and delete the original phrasing. Don't say it twice."
3. "Replace the resumptive phrase with a forward-looking connector: 'Which means that...' or 'So when X happens...' — advance the argument instead of restating it."
4. "Replace with a concrete example that illustrates the point instead of rephrasing it abstractly."

---

### L-03: Hedging Stacks

**Pattern:** Multiple hedges in close proximity: "It's important to note that it might be somewhat..." / "This is arguably perhaps one of the more significant..." Includes: "arguably," "somewhat," "relatively," "fairly," "rather," "it's worth noting," "it should be noted," "one might argue," "to some extent."

**Detection:** REGEX count within a 30-word window. ≥2 hedges in 30 words = flag.

**LLM Overuse Factor:** ~2–3×. RLHF trains caution; hedging is the syntactic expression of that caution.

**Self-Amplification:** HIGH. Hedging begets hedging. A cautious prior paragraph makes the model more cautious in the next.

**Acceptable Density:** ≤1 hedge per 200 words. In assertive genres (opinion, argument): ≤1 per 400.

**Rewrite Menu:**
1. "Remove all hedges from this passage. Make every claim direct and unqualified. If a claim is genuinely uncertain, use a single precise hedge ('roughly 40%' or 'in most cases') rather than stacking qualifiers."
2. "Replace the hedged claim with its strongest defensible version. What's the most you can say that's still true? Say that."
3. "Replace with attribution: instead of 'it might be argued that X,' write 'Smith argues X' or 'The evidence suggests X' — anchor the uncertainty in a source, not in syntactic waffling."

---

### L-04: Filler Discourse Markers

**Pattern:** "Moreover," "Furthermore," "Additionally," "Indeed," "Notably," "Importantly," "Certainly," "Undoubtedly," "Interestingly," "Crucially." When used as sentence openers without earning their logical weight.

**Detection:** REGEX for sentence-initial position. Flag when ≥2 appear within 200 words.

**LLM Overuse Factor:** ~2–3×. "Moreover" and "Furthermore" are near-diagnostic in clusters.

**Self-Amplification:** MED.

**Acceptable Density:** ≤1 per 300 words. Many can be deleted with zero information loss.

**Rewrite Menu:**
1. "Delete the discourse marker. Start the sentence with its actual content. 'Moreover, the data shows...' → 'The data shows...'"
2. "If logical connection is genuinely needed, replace with a content-bearing connector that specifies the relationship: 'which compounds because...' or 'and the same pattern holds for...' or 'but this breaks down when...'"
3. "Replace the sentence opening with a callback to a specific prior point: 'The same 40% figure appears in...' rather than 'Additionally,...'"
4. "Merge this sentence into the previous one as a clause."

---

### L-05: Em-Dash Overuse

**Pattern:** Parenthetical em-dashes used more than once per 200 words. LLMs use em-dashes at notably higher rates than most human prose, particularly paired em-dashes for parenthetical asides.

**Detection:** REGEX for — (em-dash character) or -- (double hyphen). Count per window.

**LLM Overuse Factor:** ~2×. Varies by model; GPT-family particularly heavy.

**Self-Amplification:** MED.

**Acceptable Density:** ≤1 per 250 words for general prose. Journalistic: higher tolerance. Academic: lower.

**Rewrite Menu:**
1. "Replace the em-dash parenthetical with a separate sentence."
2. "Replace with a comma-set clause or parentheses."
3. "Remove the aside entirely — if the parenthetical is truly parenthetical, the sentence should survive without it."
4. "Move the parenthetical content to a footnote or to its own paragraph if it's substantive enough."

---

### L-06: Nominalization Overuse

**Pattern:** Verb or adjective concepts expressed as nouns: "the implementation of" instead of "implementing," "the utilization of" instead of "using," "provides an explanation" instead of "explains," "make a determination" instead of "determine."

**Detection:** PARSE. Identify noun phrases ending in -tion, -ment, -ness, -ity, -ence/-ance that have verb/adjective cognates. Flag when density exceeds threshold.

**LLM Overuse Factor:** 1.5–2× (Reinhart et al. 2025). One of the most robust Biber features for LLM detection.

**Self-Amplification:** HIGH. Nominalizations breed nominalizations. Once the register is established, the model locks into it.

**Acceptable Density:** ≤3 per 200 words for general prose. Technical/legal: higher tolerance. Narrative: very low.

**Rewrite Menu:**
1. "Rewrite using the verb form. '{CONTENT}' — find every nominalization and convert it back to its verb: 'the implementation of the system' → 'implementing the system' or 'we implemented the system.'"
2. "Rewrite with a human agent performing an action. Add a subject who does the thing: 'the evaluation was conducted' → 'the team evaluated.'"
3. "Rewrite the sentence starting with the action verb. No throat-clearing, no setup — open with what happens."

---

### L-07: LLM Lexical Fingerprint Words

**Pattern:** Words whose frequency in LLM output is measurably higher than in human text across genres. Current high-signal words: "delve," "nuanced," "multifaceted," "landscape," "underscores," "underpin," "realm," "facilitate," "leverage" (as verb), "utilize," "foster," "bolster," "pivotal," "myriad," "plethora," "whilst," "intricacies," "comprehensive," "streamline," "robust."

**Detection:** REGEX against curated word list. This list needs annual revision as models update.

**LLM Overuse Factor:** Varies. "Delve" is ~10×+ in some corpora. Most are ~2–5×.

**Self-Amplification:** LOW. These are individual token preferences, not structural patterns.

**Acceptable Density:** Flag any occurrence for review. Most have common-language replacements.

**Rewrite Menu:**
1. "Replace with a plain-language equivalent. 'Utilize' → 'use.' 'Facilitate' → 'help' or 'make possible.' 'Leverage' → 'use' or omit."
2. "Replace with a more specific word that says what you actually mean. 'Nuanced' → what kind of nuance? Describe it. 'Comprehensive' → how comprehensive? State the scope."
3. "Delete the word and see if the sentence improves. Many of these are padding."

---

### L-08: Tricolon with Abstracting Third Element

**Pattern:** Lists of three where the third item is more abstract than the first two: "clarity, precision, and elegance" / "data, analysis, and insight" / "planning, execution, and vision."

**Detection:** PARSE + semantic. Detect three-item coordinated lists. Flag when third item has higher abstraction score (fewer concrete referents) than first two.

**LLM Overuse Factor:** ~3×. This is one of the strongest "AI voice" markers in rhetoric.

**Self-Amplification:** HIGH. The model learns it's doing rhetorical prose and escalates.

**Acceptable Density:** ≤1 per 500 words. The construction itself is fine; it's the relentless recurrence that signals AI.

**Rewrite Menu:**
1. "Keep only two items. 'Clarity, precision, and elegance' → 'clarity and precision.' The third was padding."
2. "Make the third item as concrete as the first two. 'Planning, execution, and a post-mortem process that actually gets read.'"
3. "Replace the tricolon with a single precise noun and a clause: 'Clarity — the kind that makes a reader forget they're reading.'"
4. "Extend to four or five items, all concrete, with no ascending abstraction."
5. "Replace the list entirely with a sentence that just says what you mean."

---

## LEVEL 2: SENTENCE PATTERNS

These require parsing and sometimes semantic judgment. They're where most of the perceptible "AI sound" lives. Each pattern is individually fine; the problem is clustering and predictability.

---

### S-01: Binary Contrast Construction ("X. But Y." / "Not X — Y.")

**Pattern:** Two adjacent sentences or clauses that set up a simple binary opposition. "It seems simple. But the reality is more complex." / "This isn't about speed — it's about precision." / "On one hand... on the other hand..."

**Detection:** PARSE. Look for negation-affirmation pairs, adversative conjunctions (but, however, yet, nevertheless) connecting parallel clause structures, "not X, Y" patterns.

**LLM Overuse Factor:** ~3–4×. This is arguably the single most characteristic LLM rhetorical move.

**Self-Amplification:** VERY HIGH. Binary contrasts prime the model for more binary thinking.

**Acceptable Density:** ≤1 per 400 words. Never more than one per two paragraphs.

**Rewrite Menu:**
1. "Remove the contrast. State the complex position directly without first presenting the simple one. 'The reality is more complex than it appears' → just state the complex reality."
2. "Replace with a spectrum or gradient: instead of X vs Y, present X→Y as a continuum with intermediate positions."
3. "Replace with a concession-advance: 'While X is true as far as it goes, the problem is that...' — acknowledge without constructing an artificial opposition."
4. "Replace with a narrative progression: 'The first attempt assumed X. The data came back showing Y. The second attempt incorporated Z.' Let the contrast emerge from events, not from rhetoric."
5. "Replace with a question: 'Is it really about speed? When you look at the failure modes, every one traces to precision.' The contrast is implicit."
6. "Collapse into a single sentence with a subordinate clause: 'Although X, Y' — reduces the rhetorical weight of the contrast."

---

### S-02: Present Participial Cascade

**Pattern:** Multiple present participles (-ing forms) used as clause openers or in sequence: "Drawing on years of experience, she entered the room, carrying herself with confidence, knowing that the outcome depended on this moment."

**Detection:** PARSE. Count participial clauses within a sentence. Flag ≥2 per sentence, or ≥3 per 100 words.

**LLM Overuse Factor:** 2–5× (Reinhart et al. 2025). Among the highest measured overuse factors.

**Self-Amplification:** HIGH.

**Acceptable Density:** ≤2 participial clause openers per 300 words.

**Rewrite Menu:**
1. "Rewrite every participial clause as a finite verb clause. 'Drawing on her experience, she...' → 'She drew on her experience and...' or 'She had years of experience. She...'"
2. "Break into sequential short sentences. Each -ing clause becomes its own sentence with subject-verb-object."
3. "Replace the participial opener with a prepositional phrase or adverb: 'With years of experience behind her, she...' or 'Confidently, she...'"
4. "Move the participial clause to the end: 'She entered the room, drawing on years of...' — end-weight changes the rhythm."
5. "Delete the participial clause. Often it's scene-painting that the reader doesn't need."

---

### S-03: Balanced Clause Symmetry

**Pattern:** Clauses within a sentence that are suspiciously similar in word count and syntactic weight. "The system processes the data efficiently, and the algorithm optimizes the output precisely." Both clauses: article-noun-verb-article-noun-adverb.

**Detection:** PARSE. Compare clause lengths (word count) and POS-tag sequences across coordinated clauses. Flag when length difference is <15% and POS patterns match >60%.

**LLM Overuse Factor:** ~2× (estimated). LLMs produce more syntactically parallel coordinated clauses than humans.

**Self-Amplification:** MED.

**Acceptable Density:** ≤1 perfectly balanced coordination per 300 words. Deliberate parallelism (e.g., in speeches) is a different case.

**Rewrite Menu:**
1. "Make the clauses asymmetric. Lengthen one and shorten the other. Add a parenthetical to one side only."
2. "Break into two sentences of different lengths."
3. "Subordinate one clause to the other: 'The system processes the data efficiently, which lets the algorithm...' — create a hierarchy instead of a balance."
4. "Replace coordination (and/but) with a causal or temporal link: 'because,' 'after,' 'once,' 'so that.'"
5. "Delete the weaker clause if it's redundant."

---

### S-04: "That"-Subject Constructions

**Pattern:** Heavy use of "that" as a subject complementizer creating noun clauses: "The fact that..." / "The idea that..." / "It is clear that..." / "What's interesting is that..."

**Detection:** PARSE. Identify "that"-complement clauses in subject position. Count per window.

**LLM Overuse Factor:** 1.5–3× (Reinhart et al. 2025). Part of the informationally dense, nominal LLM register.

**Self-Amplification:** MED.

**Acceptable Density:** ≤2 per 300 words.

**Rewrite Menu:**
1. "Remove the frame entirely. 'The fact that prices are rising...' → 'Prices are rising...'"
2. "Replace with a direct assertion. 'It is clear that the system works' → 'The system works.'"
3. "Replace with a question. 'What's interesting is that X' → 'Why does X happen?'"
4. "Replace the that-clause with an infinitive or gerund: 'The challenge of building...' instead of 'The fact that building...'"

---

### S-05: Sentence Length Clustering

**Pattern:** Sentence lengths within a passage cluster within a narrow band (typically 15–22 words for LLMs). Human prose has much wider variance — sentences from 3 to 40+ words.

**Detection:** STATISTICAL. Compute sentence length standard deviation within a 10-sentence window. Flag when σ < 4 words.

**LLM Overuse Factor:** Measured across all studies. LLM sentence length distributions are tighter and more normal; human distributions are wider and more irregular.

**Self-Amplification:** HIGH. The model pattern-matches sentence length from context and reproduces it.

**Acceptable Density:** σ ≥ 6 words per 10-sentence window. Target range: mix of sentences from 5 to 35+ words.

**Rewrite Menu:**
1. "Split the longest sentence into two. Then merge the two shortest adjacent sentences into one. Repeat until the variance increases."
2. "Insert a fragment. After a long sentence, add a sentence of 1–5 words. 'And that was it.' / 'Not quite.' / 'Always.'"
3. "Extend one sentence with a subordinate clause, a parenthetical, and an appositive — make it 35+ words. Then follow it with one under 8 words."
4. "Rewrite three consecutive sentences as: one long (25+ words), one short (5–8 words), one medium (12–18 words)."
5. "Replace one sentence with a rhetorical question (usually shorter) or a sentence starting with 'Or' or 'Because' (feels incomplete, adds rhythm)."

---

### S-06: The Exhaustive Setup Sentence

**Pattern:** Sentences that preview everything the paragraph will cover: "There are three key factors to consider: X, Y, and Z." / "This involves several components, including..." The paragraph then dutifully covers each in order.

**Detection:** PARSE + LLM. Identify sentences containing numeric previews ("three factors," "several components") or list-previewing constructions followed by colons.

**LLM Overuse Factor:** ~3–4×. LLMs compulsively preview their own structure.

**Self-Amplification:** HIGH. The preview sentence locks the model into a rigid structure for the rest of the paragraph.

**Acceptable Density:** ≤1 per 600 words.

**Rewrite Menu:**
1. "Delete the preview sentence entirely. Start with the first factor directly. Let the reader discover the structure by reading it."
2. "Replace with a question: 'So what actually drives this?' Then discuss the factors without enumeration."
3. "Mention only the most surprising factor: 'The factor that matters most isn't what you'd expect.' Then discuss it first. Address the others without numbering them."
4. "Replace with a narrative setup: 'When we looked at the data, three things jumped out.' — less clinical, more discovery-oriented."
5. "Fold the preview into the first substantive point: 'Cost is the first thing everyone looks at — and it's actually the least important factor.'"

---

### S-07: Phrasal Coordination Chains

**Pattern:** Extended chains of coordinated noun phrases or adjective phrases: "a dynamic, innovative, and forward-thinking approach" / "the economic, social, and environmental implications."

**Detection:** PARSE. Identify coordinated phrases with ≥3 elements where all elements are the same POS.

**LLM Overuse Factor:** 1.5–2× (Reinhart et al. 2025). Part of the informationally dense register.

**Self-Amplification:** MED.

**Acceptable Density:** ≤2 chains of 3+ elements per 300 words.

**Rewrite Menu:**
1. "Pick the one adjective that matters most and delete the others."
2. "Replace the chain with a specific comparison or example: instead of 'dynamic, innovative, and forward-thinking,' describe one concrete thing that makes it those things."
3. "Break across multiple sentences, giving each element its own clause with different evidence."
4. "Replace with a single unexpected descriptor that carries more information than three generic ones."

---

### S-08: Agentless Passive Voice

**Pattern:** Passive constructions without an identified agent: "The decision was made to..." / "It was determined that..." / "Steps were taken to address..."

**Detection:** PARSE. Identify passive verb forms (be + past participle) without a by-phrase.

**LLM Overuse Factor:** Complex — Reinhart et al. 2025 found GPT-4o uses agentless passives at *half* the human rate in some genres, but other models overuse them. Model-dependent.

**Self-Amplification:** MED.

**Acceptable Density:** Genre-dependent. Technical: higher tolerance. Narrative: ≤1 per 200 words.

**Rewrite Menu:**
1. "Name the agent. 'The decision was made to...' → 'The board decided to...' If you can't name the agent, ask whether the sentence is hiding accountability."
2. "Rewrite in active voice with 'we' or 'I' as appropriate."
3. "Replace with a more specific verb that implies the actor: 'Steps were taken to address...' → 'The team patched...' / 'Engineering shipped a fix for...'"

---

### S-09: The "Imagine" / "Consider" / "Picture This" Imperative Opening

**Pattern:** Opening a section or paragraph with a second-person imperative that invites the reader into a hypothetical: "Imagine a world where..." / "Consider the following scenario..." / "Picture this:"

**Detection:** REGEX for sentence-initial imperatives from curated list.

**LLM Overuse Factor:** ~4–5×. One of the most common LLM paragraph-opening moves.

**Self-Amplification:** HIGH.

**Acceptable Density:** ≤1 per 2,000 words. And never twice in the same piece with the same verb.

**Rewrite Menu:**
1. "Open with the scenario directly, in third person: 'A 35-year-old teacher in Nebraska opens her laptop at 6 a.m.' — no invitation to imagine; just put the reader there."
2. "Open with a specific fact or statistic that grounds the same point."
3. "Open mid-action: 'The server crashed at 2 a.m. on a Tuesday.' No setup."
4. "Open with a quotation from a real person."
5. "Open with the conclusion the scenario was going to illustrate, then backfill: 'Most people get this wrong. Here's how it typically plays out.'"

---

### S-10: The Definitional Opening

**Pattern:** Starting a section or paragraph with a definition: "X is defined as..." / "X refers to the process of..." / "At its core, X is..."

**Detection:** REGEX + PARSE. Look for copular sentences with definitional predicates in paragraph-initial position.

**LLM Overuse Factor:** ~3×. LLMs default to definitions as the safest possible opening move.

**Self-Amplification:** MED.

**Acceptable Density:** ≤1 per 1,000 words. Reserve for genuinely unfamiliar terms.

**Rewrite Menu:**
1. "Open with what X *does* rather than what X *is*. 'Containerization packages an application and all its dependencies into...' rather than 'Containerization is the process of...'"
2. "Open with a problem that X solves. 'Every time you move code from dev to prod, something breaks. Containerization exists because...'"
3. "Skip the definition entirely. Use the term and let context define it."
4. "Open with the *distinction* between X and the thing it's most commonly confused with."

---

## LEVEL 3: PARAGRAPH PATTERNS

These require analyzing the internal structure and arc of paragraphs and their relationships to adjacent paragraphs. This is where the strongest AI signals live, and where intervention has the most impact on perceived quality.

---

### P-01: General → Specific → Evaluative Arc Repetition

**Pattern:** Paragraph structure: opens with a general claim, provides specific detail/evidence, closes with an evaluative or summarizing statement. This is *the* default LLM paragraph arc. Any individual paragraph with this shape is fine. Three or more consecutive paragraphs with this shape read as mechanical.

**Detection:** LLM. Send consecutive paragraphs for arc analysis: "Does this paragraph open with a general claim, provide evidence, and close with evaluation? Classify the arc shape."

**Self-Amplification:** VERY HIGH. This is the strongest self-reinforcing pattern. The model reads its own prior paragraph, detects the arc, and reproduces it.

**Acceptable Density:** Maximum 2 consecutive paragraphs with this arc before a different shape must appear.

**Rewrite Menu (applied to the 3rd+ consecutive paragraph with this arc):**
1. "Invert this paragraph: open with the specific case/example/data point, then pull back to the general principle. Evidence first, claim second."
2. "Remove the evaluative closing sentence entirely. End on the evidence. Let the reader evaluate."
3. "Restructure as question-answer: open with a question, answer it with specifics, no summary needed."
4. "Restructure as problem-solution: open with what goes wrong, then explain the fix."
5. "Restructure as chronological narrative: first X happened, then Y, then Z. No framing claim."
6. "Restructure as contrast: spend the whole paragraph on two alternatives without resolving which is better."
7. "Merge this paragraph into the previous one as additional evidence, and split the previous paragraph's evidence into a standalone paragraph."

---

### P-02: Paragraph-Internal Resolution Compulsion

**Pattern:** Every tension, question, or complication introduced in a paragraph is resolved within that same paragraph. Human writing frequently introduces tension in one paragraph and resolves it paragraphs or pages later. LLMs almost never leave a paragraph with unresolved tension.

**Detection:** LLM. "Does this paragraph introduce a question, problem, or tension? Is it resolved within the same paragraph?"

**Self-Amplification:** HIGH. The model's training optimizes for completeness within local context.

**Acceptable Density:** At least 1 unresolved tension per 500 words. Some genres (fiction, argument): much more.

**Rewrite Menu:**
1. "End this paragraph after introducing the problem. Delete the resolution. Begin the next paragraph with something else entirely. Return to the resolution two paragraphs later."
2. "Replace the resolution with a complication: 'But this creates a second problem...' and end the paragraph there."
3. "Replace the resolution with a question that the next section will address."
4. "Move the resolution to the end of the *section* rather than the end of the paragraph."
5. "Replace the resolution with a partial, unsatisfying answer: 'The obvious fix is X. It doesn't work.' End paragraph."

---

### P-03: Uniform Paragraph Length

**Pattern:** Consecutive paragraphs that are all within ±20% of the same word count. LLMs produce paragraphs that cluster around 80–120 words. Human paragraphs range from single sentences to 300+ words.

**Detection:** STATISTICAL. Compute paragraph length variance across a 5-paragraph window. Flag when coefficient of variation < 0.25.

**LLM Overuse Factor:** Well-documented across all studies. LLM paragraph length distributions are significantly tighter than human.

**Self-Amplification:** HIGH.

**Acceptable Density:** Coefficient of variation ≥ 0.35 across any 5-paragraph window.

**Rewrite Menu:**
1. "Split the longest paragraph into two at its natural break point. Then merge two short adjacent paragraphs."
2. "Condense one paragraph to 2–3 sentences (under 50 words). Expand another to 200+ words with additional detail or an extended example."
3. "Replace one paragraph with a single-sentence paragraph for emphasis."
4. "Add a very short transitional paragraph (1–2 sentences) between two long ones."
5. "Extend one paragraph with a digression, anecdote, or aside that earns its length."

---

### P-04: The Topic-Sentence-First Compulsion

**Pattern:** Every paragraph opens with a topic sentence that previews the paragraph's point. While this is taught in school as "good structure," real prose — including excellent nonfiction — frequently buries the point mid-paragraph or reveals it at the end.

**Detection:** LLM. "Does the first sentence of this paragraph state the paragraph's main claim? Could the reader know what the paragraph is about from the first sentence alone?"

**Self-Amplification:** HIGH. The model treats the topic sentence as a structural commitment and organizes everything around it.

**Acceptable Density:** At least 1 in 4 paragraphs should *not* open with a topic sentence.

**Rewrite Menu:**
1. "Move the topic sentence to the end. Open with the evidence, detail, or anecdote that leads to the point."
2. "Delete the topic sentence. Let the paragraph's point be implicit."
3. "Open with a transitional link to the prior paragraph instead: 'That same logic applies to...' or 'The exception proves the rule:'"
4. "Open mid-scene or mid-argument, as if the paragraph started two sentences in."
5. "Open with a question that the paragraph answers."

---

### P-05: The Concluding-Summary Paragraph

**Pattern:** Paragraphs that close a section by restating what was already said: "In summary," "Overall," "Taken together," "In conclusion." Especially pernicious at the end of subsections where no summary is needed because the section was only 3 paragraphs long.

**Detection:** REGEX for summary markers in paragraph-initial position + LLM judgment on whether the paragraph introduces new information.

**LLM Overuse Factor:** ~4–5×. LLMs summarize even 100-word sections.

**Self-Amplification:** HIGH.

**Acceptable Density:** In documents under 3,000 words: 0. In longer documents: ≤1 per 2,000 words.

**Rewrite Menu:**
1. "Delete the summary paragraph entirely."
2. "Replace with a forward-looking paragraph: instead of summarizing what was said, state what the reader should do with this information or what follows from it."
3. "Replace with a complication or caveat that adds new information: 'This holds until...'"
4. "Replace with an anecdote or example that illustrates the section's point without restating it."
5. "If a transition is genuinely needed, use a single sentence that links backward and forward: 'With X established, the question becomes Y.' Then move to the next section."

---

### P-06: Parallel Paragraph Structure Across Enumerated Points

**Pattern:** When covering multiple points (e.g., "three reasons," "four approaches"), each point gets an identically structured paragraph: same length, same opening construction, same internal arc. "The first reason is... [evidence]... This means..." / "The second reason is... [evidence]... This means..."

**Detection:** PARSE + STATISTICAL. Compare opening construction, length, and internal arc across consecutive paragraphs that form a list.

**LLM Overuse Factor:** ~4×. The model locks into a template and fills it three times.

**Self-Amplification:** VERY HIGH.

**Acceptable Density:** In a set of 3+ enumerated paragraphs, at least 2 must have visibly different structures.

**Rewrite Menu:**
1. "Give the first point a full paragraph, the second point two sentences, and the third point its own subsection. Vary the weight by importance, not symmetry."
2. "Present one point as a story, one as data, and one as a contrast with a counterargument."
3. "Merge two of the points into a single paragraph that shows their relationship. Separate the third."
4. "Present the points in decreasing order of surprise: lead with the unexpected one and give it the most space."
5. "Drop the enumeration entirely. Weave the points into a continuous argument where they emerge organically."

---

### P-07: The "Vignette-Then-Principle" Opening

**Pattern:** Section or piece opens with a mini-story or scenario (often constructed, 2–4 sentences) followed by "This illustrates..." or a pivot to the abstract principle. Especially diagnostic when the vignette features a contrast between two scenarios (see S-01).

**Detection:** LLM. Check first paragraph of sections: "Is this a constructed scenario followed by a generalizing pivot?"

**LLM Overuse Factor:** ~5×. This is *the* default LLM opening for explanatory/educational content.

**Self-Amplification:** VERY HIGH.

**Acceptable Density:** ≤1 per piece, and only if the vignette is genuinely surprising or specific.

**Rewrite Menu:**
1. "Open with the principle directly. No scene-setting."
2. "Open with a statistic or specific fact. '40% of new businesses fail within 18 months. The data on why is counterintuitive.'"
3. "Open mid-argument, as if the reader has already been thinking about this: 'The obvious objection is...'"
4. "Open with a direct address to the reader's current belief: 'You probably think X. The data says Y.'"
5. "Open with a historical anecdote that's *real*, not constructed. Name, date, place."
6. "Open with a question. One sentence. Then answer it."
7. "Open with a quotation."
8. "Open with the most counterintuitive conclusion in the piece, stated baldly. Then spend the rest of the section justifying it."

---

## LEVEL 4: DOCUMENT PATTERNS

These are global patterns that emerge across the full document. They're the hardest to detect and the hardest to fix, but they're what makes a reader sense "this was written by AI" without being able to point to a specific sentence.

---

### D-01: Convergence Decay (Entropy Narrowing Over Document Length)

**Pattern:** Structural variety is highest in the first few paragraphs and progressively narrows. The model's "vocabulary" of rhetorical moves shrinks as it generates more text and begins pattern-matching against its own output.

**Detection:** STATISTICAL. Compute rhetorical device entropy per rolling 500-word window. Plot over document position. Flag when entropy decreases monotonically over 3+ windows.

**Self-Amplification:** This IS the self-amplification mechanism.

**Intervention Strategy:** The neutralizing filter is the primary tool here. For manual intervention:
1. "Regenerate the second half of the document in a fresh context that contains only the document map (semantic content) and style guide, not the first half's prose."
2. "Identify the point where entropy begins declining. Rewrite forward from that point with explicit structural variation constraints."
3. "Insert the second half's content into the rewrite pipeline with a constraint set derived from the first half: 'the following constructions have been used; avoid them.'"

---

### D-02: Uniform Section Weight

**Pattern:** Every section or topic receives approximately the same word count and depth of treatment, regardless of its relative importance. A minor clarification gets the same 200 words as the central argument.

**Detection:** STATISTICAL + LLM. Compare section lengths. Flag when all sections are within ±25% of the mean. Use LLM to rank sections by importance; flag when importance ranking doesn't correlate with length ranking.

**LLM Overuse Factor:** ~3×. LLMs lack a sense of editorial proportion.

**Self-Amplification:** MED.

**Intervention Strategy:**
1. "Identify the two most important sections. Double their length with additional evidence, examples, or discussion. Halve the two least important sections."
2. "Convert one minor section to a parenthetical within another section."
3. "Expand the central argument into multiple subsections while collapsing peripheral points into a single paragraph."
4. "Rewrite with an explicit word budget per section, proportional to importance."

---

### D-03: Pacing Uniformity

**Pattern:** Every part of the document moves at the same pace. Dense sections are uniformly dense. No sprints, no slow passages, no breathing room. Human nonfiction varies pacing deliberately — some passages are dense with information, others slow down for examples, anecdotes, or reflection.

**Detection:** STATISTICAL. Measure information density (named entities + technical terms per sentence) across the document. Flag when density variance is low.

**Self-Amplification:** MED.

**Intervention Strategy:**
1. "After every dense passage (high information density for 300+ words), insert a low-density passage: an example, an anecdote, a historical parallel, or a moment of reflection."
2. "Identify the three densest paragraphs and follow each with a single-sentence paragraph or a question."
3. "Add a concrete extended example (100+ words) after every abstract argument (200+ words)."
4. "Vary sentence density: follow a paragraph of complex sentences with a paragraph of simple, short ones."

---

### D-04: Missing Structural Surprises

**Pattern:** The document never violates its own established structure. Every section follows the same format. No digressions, no asides, no rule-breaking. Human writing includes deliberate structural violations — a single-sentence paragraph for emphasis, a section that breaks format, a question left hanging, a callback to something mentioned pages earlier.

**Detection:** LLM. "Does this document contain any structural surprises — passages that deviate from the established format, break a pattern, or do something unexpected?"

**Self-Amplification:** HIGH. The model optimizes for consistency, which produces monotony.

**Intervention Strategy:**
1. "Insert one structurally anomalous passage per 1,000 words. A one-sentence paragraph. A paragraph that's just a list with no introduction. A section that opens with a tangent."
2. "Add one callback: refer back to something from the introduction, using the same phrasing, in a new context."
3. "Break the format once: if every section has subheadings, leave one without. If every section opens with context, open one mid-argument."
4. "Add a deliberate digression that earns its place by providing an unexpected perspective."

---

### D-05: Thesis-Evidence-Synthesis Repetition at Document Level

**Pattern:** The document follows a repetitive macro-structure where each major section is thesis → evidence → synthesis, mirroring the paragraph-level P-01 pattern at larger scale.

**Detection:** LLM. Analyze section-level arc patterns across the full document.

**Self-Amplification:** HIGH.

**Intervention Strategy:**
1. "Restructure one section as evidence → thesis (inductive rather than deductive)."
2. "Restructure one section as narrative (chronological account with the thesis emerging at the end)."
3. "Restructure one section as a dialogue or debate between two positions."
4. "Make one section entirely concrete — all examples, no abstraction — and let the reader synthesize."
5. "Open one section with the counterargument and spend the first half of the section strengthening it before pivoting."

---

### D-06: Register Flatness

**Pattern:** The document maintains the same register (level of formality, technicality, distance from the reader) throughout. Human writers shift register — becoming more conversational in examples, more formal in methodology, more urgent in conclusions.

**Detection:** STATISTICAL + LLM. Measure formality markers (contractions, first person, questions, imperatives) per section. Flag when distribution is uniform.

**LLM Overuse Factor:** ~2×. Models maintain a consistent register as a side effect of RLHF optimization.

**Self-Amplification:** HIGH.

**Intervention Strategy:**
1. "Lower the register for one passage: add a contraction, a first-person aside, or a direct address to the reader."
2. "Raise the register for the most important claim: state it with formal precision, no hedging, no softening."
3. "Alternate register across sections: technical detail in formal register, practical implications in conversational register."
4. "Add one passage written as if speaking to a friend."

---

## IMPLEMENTATION NOTES

### Priority Order for Initial Build

Start with these patterns — they account for the majority of perceptible "AI voice" and are most tractable with the dice-roll approach:

1. **P-01** (paragraph arc repetition) — highest impact per intervention
2. **S-01** (binary contrast) — most recognizable single pattern
3. **P-07** (vignette opening) — kills opening variety
4. **S-05** (sentence length clustering) — most measurable, easiest to fix
5. **L-02** (resumptive phrases) — easy to detect, easy to suppress
6. **S-02** (participial cascades) — well-documented overuse factor
7. **L-06** (nominalizations) — well-documented, high impact on voice
8. **P-02** (resolution compulsion) — hard to fix but high impact on texture
9. **D-01** (convergence decay) — requires neutralizing filter
10. **L-01** (puffing phrases) — easy win, low effort

### Dice Roll Implementation

```
For each flagged pattern:
  1. Count how many rewrite options exist for that pattern
  2. Exclude the option most recently used for the same pattern type
  3. Roll uniformly from remaining options
  4. Assemble prompt: [selected rewrite instruction] + [flagged passage] + [surrounding context for coherence]
  5. Send to rewrite agent
  6. Log which option was used (for exclusion in step 2)
```

### Density Calculation

All density thresholds assume a rolling window. The window sizes:
- Lexical patterns: 200-word window, 100-word stride
- Sentence patterns: 300-word window, 150-word stride
- Paragraph patterns: 3-paragraph window, 1-paragraph stride
- Document patterns: 1,000-word window, 500-word stride

A pattern exceeds threshold when its count within any single window exceeds the stated maximum.

### Style Guide Overrides

Every acceptable density threshold in this document is a default. Style guides override them:

| Genre | Higher Tolerance | Lower Tolerance |
|-------|-----------------|-----------------|
| Technical documentation | Parallel structure (S-03), Nominalizations (L-06), Enumeration (S-06) | Binary contrast (S-01), Vignettes (P-07), Register shifts (D-06) |
| Literary fiction | Unresolved tension (P-02), Fragments, Register variation (D-06) | All lexical patterns, Participial cascades (S-02) |
| Journalism | Short paragraphs (P-03), Topic-sentence-first (P-04) | Hedging (L-03), Exhaustive setups (S-06), Uniform weight (D-02) |
| Academic writing | Nominalizations (L-06), That-subjects (S-04), Hedging (L-03) | Importance-puffing (L-01), Vignettes (P-07), Conversational register |
| Marketing | Tricolons (L-08), Binary contrasts (S-01) | Hedging (L-03), Passive voice (S-08), Resumptive phrases (L-02) |
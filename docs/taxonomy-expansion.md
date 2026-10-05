# Prose Entropy Pattern Taxonomy — Expansion

## New Patterns from Cross-LLM Research Synthesis (April 2026)

This document extends the base taxonomy (28 patterns: L-01→L-08, S-01→S-10, P-01→P-07, D-01→D-06) with patterns synthesized from parallel research across Claude, GPT-4o, Gemini, and Perplexity, cross-referenced against peer-reviewed sources. Patterns that appeared in 3+ independent responses with quantitative backing are marked **[TIER 1]**. Patterns from 2+ responses or strong single sources are **[TIER 2]**. Genre-specific and statistical detection signatures are in their own sections.

### Key Sources (cited throughout)

| Shorthand | Full Reference |
|-----------|---------------|
| Reinhart 2025 | Reinhart et al. "Do LLMs write like humans? Variation in grammatical and rhetorical styles." *PNAS* 122(8): e2422455122. 66-feature Biber analysis on ~18K parallel texts. |
| Muñoz-Ortiz 2024 | Muñoz-Ortiz et al. "Contrasting Linguistic Patterns in Human and LLM-Generated News Text." *Artificial Intelligence Review*. POS/morphological/dependency analysis across 6 LLMs vs NYT corpus. |
| Milička 2025 | Milička, Marklová, Cvrček. "Benchmark of stylistic variation in LLM-generated texts." arXiv:2509.10179. Biber MDA on AI-Brown corpus, 16 models. |
| Tulchinskii 2024 | Tulchinskii et al. "Intrinsic Dimension Estimation for Robust Detection of AI-Generated Texts." NeurIPS 2023/2024. PHD-based detection. |
| Kim 2024 | Kim et al. "A Matter of Subtlety: Detecting Machine-Generated Texts Through Discourse Motifs." ACL 2024. RST graph analysis. |
| Markey 2024 | Markey et al. "Dense and Disconnected: Analyzing the Sedimented Style of ChatGPT-Generated Text at Scale." Lexical bundle analysis. |
| Gehrmann 2019 | Gehrmann, Strobelt, Rush. "GLTR: Statistical Detection and Visualization of Generated Text." Token probability rank analysis. |
| Mitchell 2023 | Mitchell et al. "DetectGPT: Zero-Shot Machine-Generated Text Detection using Probability Curvature." ICML 2023. |
| Shalevska 2024 | Shalevska. "A Comparative Analysis of First-Person Pronoun Use in AI-Generated and Human-Written Essays." |
| WikiProject | Wikipedia:Signs of AI writing (WikiProject AI Cleanup, 2025 field guide). |
| VERMILLION 2025 | "The Disappearing Author: Linguistic and Cognitive Markers of AI-Generated Communication." ResearchLeap. |
| Zamaraeva 2025 | Zamaraeva et al. "Comparing LLM-generated and human-authored news text using formal syntactic theory." ACL 2025. |
| Shaib 2024 | Shaib et al. "Syntactic templates in LLMs." *Computational Linguistics*. |
| Wang-Zhu 2023 | Wang & Zhu. Corpus-based analysis of verb tense usage patterns in LLM output. |
| ROCLING 2025 | "Stance and Cohesion: The Use of However and While in AI Argumentative Discourse." ROCLING 2025. |
| BEA-ACL 2025 | "Comparing human and LLM proofreading in L2 writing." BEA Workshop, ACL 2025. |

---

## LEVEL 1: LEXICAL PATTERNS (continued)

---

### L-09: Auxiliary Verb Inflation **[TIER 1]**

**Pattern:** Systematic overuse of auxiliary verbs (is, are, was, were, has, have, had, can, could, may, might, will, would, shall, should, do, does, did) creating multi-word verb constructions that add grammatical scaffolding without semantic weight. "The system **is being** implemented and **has been** shown to **be** effective" where a human writes "We implemented the system. It works."

**Detection:** PARSE (POS tagging for AUX category) + STATISTICAL (AUX frequency per 1,000 words against genre baseline).

**LLM Overuse Factor:** Human: 3.81% AUX tokens. LLMs: 5.41–6.02% across model families (+42% to +58%). Falcon 7B highest at 6.02%. Muñoz-Ortiz 2024.

**Self-Amplification:** MED. Auxiliary-heavy constructions establish an analytic, detached register that persists.

**Acceptable Density:** ≤4.5% AUX tokens per 1,000-word window. Higher tolerance in formal/legal. Lower in narrative.

**Rewrite Menu:**
1. "Collapse multi-word verb phrases into simple active verbs. 'is being implemented' → 'we implemented.' 'has been shown to be effective' → 'works.'"
2. "Replace passive auxiliary chains with an agent performing an action. Name who did what."
3. "Delete the auxiliary and restructure. 'The report can be used to inform decisions' → 'The report informs decisions.'"
4. "Convert progressive/perfect constructions to simple tense where temporal nuance isn't needed. 'was developing' → 'developed.'"

---

### L-10: Personal Pronoun Distribution Skew **[TIER 1]**

**Pattern:** Three co-occurring shifts: (1) dramatic suppression of first-person singular "I" (humans use it 25.7× more), (2) inflation of inclusive "we" as a substitute, (3) overuse of impersonal pronouns ("it," "this," "that") as sentence subjects instead of concrete nouns. The net effect is text that sounds authoritative but depersonalized — no individual voice, no specific agent.

**Detection:** STATISTICAL (token frequency of "I," "we," "you," "it," "this," "that" per 1,000 words) + PARSE (pronoun subclass ratios). Key metric: I-to-we ratio and impersonal-pronoun-to-noun ratio.

**LLM Overuse Factor:** "I" frequency: 0.051% in AI essays vs 1.311% in human essays (Shalevska 2024). "We" inflated ~2× in academic contexts (Frontiers in Education 2024). Overall PRON category elevated in LLMs (Muñoz-Ortiz 2024).

**Self-Amplification:** HIGH. Once a passage establishes impersonal register, the model continues avoiding personal pronouns.

**Acceptable Density:** Genre-dependent. Personal essays: "I" should appear ≥5× per 1,000 words. Academic: "we" acceptable but should co-occur with specific attributions. Technical: impersonal pronouns acceptable but flag when "it" or "this" appears as sentence subject ≥4× per 300 words without clear antecedent.

**Rewrite Menu:**
1. "Replace 'It is believed that...' with 'I believe...' or 'Smith argues...' — anchor the claim in a specific person."
2. "Replace 'We can see that...' with a direct statement. Who is 'we'? If it's the author, say 'I.' If it's the reader, address them directly."
3. "Replace impersonal 'this' and 'it' subjects with the specific noun they refer to. 'This suggests...' → 'The 40% decline suggests...'"
4. "Where appropriate, write one sentence per page as a direct personal assertion: 'I think,' 'I noticed,' 'In my experience.' One is enough to humanize the register."

---

### L-11: Downtoner Divergence (Model-Specific) **[TIER 1]**

**Pattern:** Downtoners are adverbs that reduce the force of another word: "barely," "nearly," "slightly," "somewhat," "hardly," "merely," "scarcely," "rather," "almost," "only just." GPT-4o family uses them at ~155% of human rate (over-qualifying). Llama 3 family uses them at ~57–73% of human rate (under-qualifying). This makes downtoner frequency a *model fingerprinting* feature, not just a human/AI discriminator.

**Detection:** REGEX (downtoner word list) + STATISTICAL (frequency per 1,000 words). Compare against both human baseline AND model-family baselines to identify source model.

**LLM Overuse Factor:** GPT-4o: ~155% of human. Llama 3 variants: ~57–73% of human. Cohen's d significant. Reinhart 2025, SI Tables S5–S6.

**Self-Amplification:** MED. Once a qualifying register is established, it tends to persist.

**Acceptable Density:** 1–3 downtoners per 1,000 words (human baseline). Flag deviation >50% in either direction.

**Rewrite Menu:**
1. "If downtoner-heavy (GPT pattern): delete every downtoner and read aloud. If the sentence works without qualification, leave it deleted. If genuine uncertainty exists, keep exactly one downtoner per claim."
2. "If downtoner-sparse (Llama pattern): scan for unqualified absolute claims. Where a claim is genuinely approximate, add a single precise qualifier: 'nearly 40%' or 'in most cases.'"
3. "Replace vague downtoners with precise quantities. 'Somewhat effective' → 'effective in 60% of cases.' 'Nearly impossible' → 'succeeded 3 times out of 200.'"

---

### L-12: Content-to-Function Word Ratio Imbalance **[TIER 1]**

**Pattern:** LLM text has a measurably higher ratio of content words (nouns, main verbs, adjectives, adverbs — words carrying semantic payload) to function words (pronouns, prepositions, conjunctions, determiners, auxiliaries — words providing grammatical scaffolding). Human ratio ≈0.98; AI ratio ≈1.37. This creates prose that feels "heavy" — dense with meaning-bearing words but lacking the connective tissue humans use to pace and link ideas.

**Detection:** PARSE (POS tagging) + STATISTICAL (content/function word ratio per 500-word window).

**LLM Overuse Factor:** AI content-to-function ratio 1.40× human baseline (1.37 vs 0.98). Multilingual.com 2025; corroborated by Schaaff 2024, Opara 2024.

**Self-Amplification:** MED. Dense content-word passages establish an informational register that reinforces itself.

**Acceptable Density:** Ratio ≤1.15 for general prose. Academic/technical: higher tolerance (≤1.25). Narrative: lower (≤1.05).

**Rewrite Menu:**
1. "Add natural connective tissue. Insert pronouns, contractions, and informal conjunctions ('so,' 'but,' 'and then') between dense informational sentences."
2. "Break noun-heavy sentences into two: one with the content, one with the implication. 'The implementation of strategic methodologies facilitates comprehensive understanding' → 'We use these strategies. They help us understand what's happening.'"
3. "Replace one content word per sentence with a pronoun referring to a prior sentence. Let the reader's memory do some work."
4. "Read aloud. Where you run out of breath, the function words are missing. Add them."

---

### L-13: Temporal Sweeping Openers **[TIER 1]**

**Pattern:** Initiating paragraphs, sections, or documents with grandiose temporal phrases that attempt to establish universal context: "In today's world," "Throughout history," "In the modern era," "Since the dawn of civilization," "In an increasingly interconnected world," "In recent years," "As we stand at the crossroads of..." These phrases add zero information and lock the paragraph into a deductive General→Specific arc.

**Detection:** REGEX for phrase list in first 15 words of paragraph/section. Maintain living list; these shift across model versions.

**LLM Overuse Factor:** ~4–6× depending on phrase. "In today's world" and "In an era where" are near-diagnostic in essay openings. WikiProject; multiple LLM responses.

**Self-Amplification:** HIGH. The sweeping opener forces deductive structure and primes the model for formal, generalized prose.

**Acceptable Density:** 0 per document for most genres. Marketing: ≤1 per 2,000 words if genuinely earning its place.

**Rewrite Menu:**
1. "Delete the temporal phrase entirely. Start with the specific claim, fact, or question that actually opens the argument."
2. "Replace with a specific date, event, or data point. 'In today's rapidly evolving tech landscape...' → 'In March 2026, three major cloud providers shipped the same feature within a week.'"
3. "Replace with the most surprising or counterintuitive point in the paragraph. Open with the punchline."
4. "Replace with a direct address to the reader's situation. 'If you've tried to deploy a model in production...' — ground in experience, not epoch."

---

### L-14: Epistemic Stance Marker Deficit **[TIER 2]**

**Pattern:** A measurable absence of genuine epistemic markers — words and phrases that express authentic authorial uncertainty, perspective, or invitation to debate: "perhaps," "it seems likely," "in my view," "I suspect," "to the best of my knowledge," "as far as I can tell." Distinct from L-03 (hedging stacks): LLMs overuse *institutional safety hedges* ("it's important to note") while simultaneously underusing *genuine epistemic markers* that establish a personal, intellectually honest voice. The result is text Markey 2024 describes as "dialogically closed."

**Detection:** STATISTICAL (epistemic marker lexicon frequency) contrasted with L-03 safety hedge frequency. The ratio of genuine-to-institutional hedges is diagnostic.

**LLM Overuse Factor:** This is an *underuse* pattern. Epistemic markers appear at 40–60% of human academic baseline. Markey 2024.

**Self-Amplification:** LOW as a generative cascade, but HIGH in cumulative effect: persistent absence creates a tone of artificial omniscience.

**Acceptable Density:** ≥2 genuine epistemic markers per 1,000 words in argumentative text. ≥1 per 1,000 in expository. 0 is a red flag in any genre involving judgment.

**Rewrite Menu:**
1. "Identify the three strongest claims in this passage. For each, ask: is this genuinely certain? If not, add a single precise epistemic marker: 'I suspect,' 'the evidence suggests,' 'in most cases.'"
2. "Replace one institutional hedge ('it's worth noting') with a personal one ('I think this matters because...'). The institutional hedge hides the author; the personal one reveals them."
3. "Add one sentence per section that explicitly acknowledges the limits of the author's knowledge. 'I haven't seen data on X, but...' or 'This is outside my direct experience, so...'"

---

### L-15: Vocabulary Smoothing / Specificity Regression **[TIER 2]**

**Pattern:** The systematic replacement of highly specific, domain-localized, or unusual terminology with generic, statistically probable alternatives. A historical title like "inventor of the first train-coupling device" becomes "a revolutionary titan of industry." A medical term like "sternotomy" becomes "major surgical procedure." The model actively flattens the specificity gradient, substituting edge-case vocabulary with tokens that have higher probability weights in its distribution.

**Detection:** LLM + STATISTICAL. Compare the ratio of concrete domain-specific nouns (proper nouns, technical terms, measurements) to abstract high-frequency nouns. Flag when specificity ratio drops below genre baseline.

**LLM Overuse Factor:** HIGH. WikiProject documents this extensively in encyclopedia contexts. Qualitative but consistent across multiple independent observations.

**Self-Amplification:** HIGH. Once a specific noun is abstracted, the model loses the semantic anchor needed to generate subsequent technical details, causing further smoothing.

**Acceptable Density:** Genre-dependent. Technical: concrete-to-abstract noun ratio ≥2:1. Journalistic: ≥1.5:1. Academic: ≥1.5:1.

**Rewrite Menu:**
1. "For every abstract claim, demand a proper noun. 'Experts agree' → which experts? 'Studies show' → which study? 'A significant development' → what specifically happened?"
2. "Replace every instance of 'various,' 'multiple,' 'several,' 'numerous' with the actual number or a specific list."
3. "Restore the technical term. If the text says 'a complex procedure,' replace with the actual name of the procedure. If you don't know it, that's a gap in the content, not a writing choice."
4. "Add one hyper-specific detail per paragraph: a date, a measurement, a name, a location. Specificity is the immune system against AI genericism."

---

### L-16: Elegant Variation Compulsion **[TIER 2]**

**Pattern:** The forced rotation of synonyms to refer to the same subject, driven by repetition-penalty parameters. Instead of using a clear pronoun or repeating the subject noun (which humans naturally do for clarity), the model cycles through a thesaurus: "the company" → "the firm" → "the organization" → "the enterprise" → "the corporation" within a single passage. This is the opposite of what technical and journalistic style guides recommend: pick a term and stick with it.

**Detection:** PARSE (coreference chain analysis) + STATISTICAL (count unique nominal substitutes per entity across the document). Flag when ≥4 different nouns refer to the same entity within 500 words.

**LLM Overuse Factor:** MED. Highly dependent on temperature and repetition penalty settings. Most visible in longer documents. WikiProject.

**Self-Amplification:** LOW. Contained within coreference chains of individual entities.

**Acceptable Density:** ≤2 distinct nominal references per entity per 500 words (excluding pronouns). Technical writing: 1 term per entity, period.

**Rewrite Menu:**
1. "Pick the most precise term for the entity. Use it every time. 'The company' is fine five times in a paragraph if that's what it is."
2. "Use pronouns instead of cycling synonyms. 'It' and 'they' exist for this purpose."
3. "If you must vary, vary the *framing* not the *noun*. 'The company, which was founded in 2018,' is variation that adds information. 'The firm' is variation that adds confusion."

---

### L-17: Contraction Rate Fingerprint (Model-Specific) **[TIER 2]**

**Pattern:** Contraction frequency ("don't," "can't," "it's," "they're") operates as a model-family fingerprint. Some models suppress contractions to ~60% of human rate (producing stiff formal prose in contexts that call for conversational tone). Others inflate to ~140% (over-correcting for informality). The key diagnostic is not the rate itself but the *uniformity* — human contraction usage varies by sentence, by paragraph, by context. AI contraction usage is flat.

**Detection:** REGEX (contraction lexicon) + STATISTICAL (frequency per 1,000 words AND variance across 200-word windows). Low variance is the tell.

**LLM Overuse Factor:** Range: 60–142% of human baseline depending on model family. Contraction variance within a document: AI ≈0.6× human. Reinhart 2025.

**Self-Amplification:** MED. Once a formal/informal register is established, contraction rate stays locked.

**Acceptable Density:** Genre-dependent, but variance matters more than rate. Standard deviation of contraction frequency across 200-word windows should be ≥40% of mean.

**Rewrite Menu:**
1. "If contraction-sparse: add contractions to every passage where a human would speak the sentence aloud with a contraction. 'It is not possible' → 'It's not possible.' But keep formal phrasing in the most important claims."
2. "If contraction-heavy: remove contractions from the single most authoritative sentence per paragraph. The formality spike creates emphasis."
3. "Vary deliberately: use contractions in examples and asides, formal phrasing in thesis statements and evidence. The *shift* between registers is what sounds human."

---

### L-18: Intensifier Saturation **[TIER 2]**

**Pattern:** Overuse of weak intensifiers that add emphasis without information: "absolutely," "incredibly," "extremely," "definitely," "certainly," "undoubtedly," "really," "very," "truly," "remarkably." Distinct from L-01 (importance-puffing phrases, which are multi-word constructions asserting significance) — intensifiers are single adverbs that amplify adjacent words while contributing nothing. "This is **absolutely** crucial" says no more than "This is crucial."

**Detection:** REGEX against curated intensifier list. Count per 500-word window.

**LLM Overuse Factor:** ~3–5× human rate. LobeHub 2025; editorial observations.

**Self-Amplification:** MED. Emphatic tone established by intensifiers invites more emphasis.

**Acceptable Density:** ≤1 per 500 words. Marketing: higher tolerance. Academic/technical: 0.

**Rewrite Menu:**
1. "Delete the intensifier. 'Absolutely crucial' → 'crucial.' If the word can't stand without its intensifier, the word is wrong — find a stronger one."
2. "Replace the intensifier + adjective with a specific claim. 'Incredibly fast' → 'processes 10,000 requests per second.'"
3. "Move emphasis from the adverb to the sentence structure. Short sentences after long ones create emphasis without intensifiers."

---

### L-19: Evasive Complexity Acknowledgment **[TIER 2]**

**Pattern:** A specific rhetorical move where the model states that the topic is complex instead of demonstrating complexity through argument: "This is a complex and nuanced topic," "While we have only scratched the surface," "Acknowledging the multifaceted nature of this issue," "The reality is more nuanced than it appears." Functions as an exit ramp from taking a position, and frequently triggers concluding sequences that prevent definitive stances.

**Detection:** REGEX for constructions combining "complex/nuanced/multifaceted" functioning as predicate adjective describing the current topic. Flag especially in concluding paragraphs.

**LLM Overuse Factor:** Appears in ~30% of zero-shot essays on controversial or theoretical topics. Claude and GPT-4o most prone due to harmlessness training. Editorial observations; WikiProject.

**Self-Amplification:** MED. The acknowledgment usually triggers a balanced summary rather than a committed argument.

**Acceptable Density:** 0 per document. If the topic is complex, show the complexity through evidence and argument. Don't announce it.

**Rewrite Menu:**
1. "Delete the complexity acknowledgment entirely. Replace with the most definitive claim you can defend."
2. "Replace 'This is nuanced' with the *specific* nuance: 'This works in cities over 500,000 population but fails in rural settings because...'"
3. "If genuine complexity prevents a single answer, state the two or three competing positions and which evidence supports each. Let the reader see the complexity instead of being told it exists."

---

## LEVEL 2: SENTENCE PATTERNS (continued)

---

### S-11: Subordinate Clause Inflation **[TIER 1]**

**Pattern:** LLMs embed more subordinate clauses (SBAR constructions: "that," "because," "although," "which," "when," "if," "while") per sentence than humans. This creates sentences that are *wider* (more subordinations) but not necessarily *deeper* (not more nesting levels). The effect is a carefully scaffolded, "everything-connects-to-everything" style that reads as over-reasoned.

**Detection:** PARSE (constituency parsing for SBAR nodes; dependency parsing for `mark`/`advcl`/`ccomp` relations) + STATISTICAL (SBAR count per sentence; SBAR frequency per 1,000 words).

**LLM Overuse Factor:** +12–19% (Muñoz-Ortiz 2024). Some studies report +40% (ResearchSquare 2024). Consistent across model families.

**Self-Amplification:** MED. Once the model starts framing claims with subordinate scaffolding, it tends to continue qualifying.

**Acceptable Density:** ≤2 subordinate clauses per sentence for general prose. ≤1.5 SBAR per 100 words across a passage.

**Rewrite Menu:**
1. "Break the sentence at each subordinate clause boundary. Each subordination becomes its own sentence. 'Although X, which caused Y, because Z...' → 'X happened. It caused Y. The reason was Z.'"
2. "Promote the subordinate clause to an independent sentence and delete the conjunction. 'Because the data showed improvement, the team continued' → 'The data showed improvement. The team continued.'"
3. "Replace subordination with coordination. 'Although X, Y' → 'X, but Y' — less cognitive nesting."
4. "Delete the weakest subordinate clause. If the sentence survives, it was padding."

---

### S-12: Clausal Coordination Divergence (Model-Specific) **[TIER 1]**

**Pattern:** A model-fingerprinting feature: GPT-4o *avoids* coordinating independent clauses (using "and"/"but"/"or" to join full clauses) at ~60% of human rate, preferring separate sentences. Llama 3 *overuses* it at ~140% of human rate, chaining clauses together. Human writing falls between these extremes.

**Detection:** PARSE (identify coordinating conjunctions joining clausal heads, not just phrases) + STATISTICAL (clausal coordination frequency per 1,000 words, compared to both human and model-family baselines).

**LLM Overuse Factor:** GPT-4o: ~59–63% of human rate. Llama 3 variants: ~116–141% of human rate. Reinhart 2025.

**Self-Amplification:** MED. Once a sentence-boundary style is established, it persists.

**Acceptable Density:** Clausal coordination should appear at 70–130% of human genre baseline. Below 70% reads as choppy/clinical. Above 130% reads as run-on.

**Rewrite Menu:**
1. "If undercoordinated (GPT pattern): merge 2–3 adjacent short sentences using 'and,' 'but,' or 'so.' Not every thought needs its own period."
2. "If overcoordinated (Llama pattern): break the longest coordinated sentence in each paragraph into separate sentences. Give the reader a period to breathe."
3. "Alternate deliberately: follow a compound sentence with a simple one. Follow two simple sentences with a compound. The variation is the point."

---

### S-13: Dependency Distance Optimization Deficit **[TIER 1]**

**Pattern:** Humans naturally arrange words to minimize the cognitive distance between grammatically connected words (e.g., keeping a subject close to its verb, an adjective close to the noun it modifies). This is a well-documented processing constraint. LLMs, unconstrained by working memory, arrange words less optimally — dependents are placed farther from their heads than human baselines, even after controlling for tree shape (measured via the Ω optimality metric).

**Detection:** PARSE (dependency parsing) + STATISTICAL (mean dependency distance per sentence; Ω optimality score using LAL library). Compare distributions against human baseline.

**LLM Overuse Factor:** Humans show "noticeably larger" Ω values (more optimized). All LLMs cluster together below human distribution. Muñoz-Ortiz 2024.

**Self-Amplification:** LOW. This is an underlying generation characteristic, not a local cascade.

**Acceptable Density:** Mean dependency distance ≤4.0 words for general prose (human average varies by genre). Flag sentences where mean dependency distance exceeds 6.0.

**Rewrite Menu:**
1. "Move the subject closer to the verb. If more than 5 words separate them, restructure."
2. "Move modifiers adjacent to the words they modify. 'The policy, which was implemented by the committee after extensive review, achieved results' → 'The committee's policy achieved results after extensive review.'"
3. "Front-load the main clause. Put the subject-verb-object first, then attach modifiers after the core meaning is delivered."
4. "If a sentence has a relative clause, a prepositional phrase, AND an adverbial clause, distribute them across two sentences."

---

### S-14: Sentence Opener Diversity Reduction **[TIER 1]**

**Pattern:** LLMs repeat sentence-initial POS patterns and specific words at significantly higher rates than humans. Where human writers use roughly twice as many different lexical entries for sentence openings, LLMs fall into repetitive templates: consecutive sentences starting with "The," "This," "It," or the same adverbial opener. This compounds with L-04 (filler discourse markers) but is broader — it includes all repetitive openers, not just markers.

**Detection:** STATISTICAL (count unique sentence-initial bigrams per 500-word window; compute POS sequence diversity for sentence openings). Flag when ≤60% of sentence openers are unique in a 10-sentence window.

**LLM Overuse Factor:** ~50% reduction in unique sentence openers per 1,000 words compared to human writing. Shaib 2024; Georgiou 2025; WikiProject.

**Self-Amplification:** HIGH. The model pattern-matches sentence beginnings from its own recent output.

**Acceptable Density:** ≥75% unique sentence-initial bigrams in any 10-sentence window. No three consecutive sentences should start with the same POS tag.

**Rewrite Menu:**
1. "Highlight the first word of every sentence in a paragraph. If any word appears more than twice, rewrite at least one of the duplicates to start differently."
2. "Start at least one sentence per paragraph with a subordinate clause, a prepositional phrase, or an adverb — anything other than the subject."
3. "Start one sentence per page with a conjunction ('But,' 'And,' 'Or,' 'So') — it breaks the pattern and reads naturally."
4. "Start one sentence per page with a question or a single-word fragment. Rhythm comes from variety, not from grammatical consistency."

---

### S-15: Punctuation Distribution Skew **[TIER 1]**

**Pattern:** LLMs produce measurably different punctuation distributions than humans: (1) semicolons at ~60–70% of human rate, (2) colons overused (particularly before lists and explanations), (3) question marks either inflated ~1.6× (in explanatory contexts) or suppressed (in narrative), (4) parentheses underused, (5) exclamation marks virtually absent. The net effect is punctuation that serves structure (colons for setup, periods for termination) but avoids the punctuation humans use for voice and rhythm (semicolons, dashes, parentheses, questions).

**Detection:** STATISTICAL (punctuation character frequency per 1,000 words; ratios between punctuation types). Key diagnostic: semicolon-to-colon ratio. Human ≈0.8:1; AI ≈0.3:1.

**LLM Overuse Factor:** Semicolons: 60–70% of human. Colons: 120–150% of human. Question marks: 160% in expository, 70% in narrative. Desaire 2023; Simon 2023; Reinhart 2025.

**Self-Amplification:** LOW. Punctuation choices are local.

**Acceptable Density:** Semicolons ≥1 per 500 words in academic/formal prose. Colon-to-semicolon ratio should not exceed 2:1. At least one question mark per 1,000 words in expository text.

**Rewrite Menu:**
1. "Replace one colon per page with a semicolon. The colon announces; the semicolon connects. 'There are three factors: X, Y, Z' → 'Three factors matter; the first is X.'"
2. "Add one parenthetical aside per 500 words. Parentheses create a secondary voice that AIs almost never use."
3. "Convert one declarative sentence per section into a genuine question. Not a rhetorical question — an actual question the text then answers."
4. "Remove one colon-introduced list per page. Integrate the items into prose: 'X matters, as does Y, though Z is the one that changes outcomes.'"

---

### S-16: Monolithic Tense Anchoring **[TIER 2]**

**Pattern:** LLMs anchor rigidly to one or two tenses (simple present for exposition, simple past for narrative) and rarely shift between tenses for temporal depth. Humans naturally weave past perfect for deep background ("had developed"), progressive for ongoing states ("was developing"), conditional for counterfactuals ("would have failed"), and shift tenses for rhetorical effect. LLMs over-rely on simple present (42.3%) and simple past (31.7%) even in contexts demanding temporal layering.

**Detection:** PARSE (tense/aspect tagging) + STATISTICAL (tense distribution variance per 500-word window). Flag when >80% of finite verbs are in the same tense within a window.

**LLM Overuse Factor:** Humans show wider tense distribution. LLMs score lower on Biber's narrativity dimension (past-tense + 3rd-person pronoun co-occurrence). Wang-Zhu 2023; Milička 2025; Reinhart 2025.

**Self-Amplification:** HIGH. Once a tense is established, the model heavily favors maintaining it.

**Acceptable Density:** No more than 70% of finite verbs in the same tense within a 300-word window. At least 2 tense shifts per 500 words in narrative text.

**Rewrite Menu:**
1. "Add one past-perfect sentence per narrative paragraph for background: 'The team had already tried three approaches before this one.' — it creates temporal depth."
2. "Shift to conditional tense for one counterfactual per section: 'Without that decision, the project would have stalled.' The conditional implies knowledge of alternatives."
3. "In exposition, shift from present to past for a concrete example, then back: 'The system handles errors gracefully. Last month, it caught a cascading failure that would have taken down production. That resilience matters.'"
4. "End one section in a different tense than it started. If it opened in present, end with a future or conditional. Temporal arcs mirror argumentative arcs."

---

### S-17: Cataphoric Reference Deficit **[TIER 2]**

**Pattern:** Near-total absence of cataphora (forward-pointing references) in favor of exclusive anaphora (backward-pointing references). Cataphora: "When **he** woke up, **John** was drenched in sweat" — the pronoun precedes its referent, creating momentary tension. Anaphora: "**John** woke up. **He** was drenched in sweat" — referent first, pronoun after. Humans use cataphora to create narrative tension, vary pacing, and avoid predictable sentence structure. LLMs default to anaphora because autoregressive left-to-right generation naturally resolves referents before pronouncing them.

**Detection:** PARSE (coreference resolution mapping) + STATISTICAL (ratio of cataphoric to anaphoric pronoun–antecedent pairs). Human baseline: ~10–15% cataphoric in narrative. AI: <2%.

**LLM Overuse Factor:** LLMs underuse cataphora by ~80–90% compared to human narrative. Tied to autoregressive architecture. Coreference resolution studies.

**Self-Amplification:** HIGH. Anaphoric-only text creates a linear "A then B" rhythm that self-reinforces.

**Acceptable Density:** ≥1 cataphoric construction per 500 words in narrative. ≥1 per 1,000 in exposition.

**Rewrite Menu:**
1. "Invert one pronoun-antecedent pair per paragraph. 'John opened the door. He looked inside.' → 'When he opened the door, John saw nothing.'"
2. "Open one paragraph per section with a pronoun whose referent doesn't appear until the second or third sentence. 'It had been there for years — the crack in the foundation that everyone ignored.'"
3. "Use 'this' or 'that' cataphorically: 'This is what they missed:' followed by the explanation."

---

### S-18: Concessive "While X, Y" Overuse **[TIER 2]**

**Pattern:** Sentence-initial "While" for concessive framing appears at elevated rates, with X typically being a content-oriented claim and Y being a writer-oriented evaluation. "While visiting companies can offer firsthand exposure, **it is important to note that** classroom education provides a foundation..." The construction combines S-18 with L-02 (resumptive phrases) and S-01 (binary contrast), creating a compound AI tell.

**Detection:** REGEX for sentence-initial "While" + PARSE (clause structure analysis: is the while-clause genuinely temporal or concessive?). Flag concessive "while" when frequency exceeds threshold.

**LLM Overuse Factor:** ~1.8× human rate. Sentence-initial "While" accounts for nearly half of all stance tokens in AI argumentative text. ROCLING 2025.

**Self-Amplification:** HIGH. The concessive frame invites further balancing and qualification.

**Acceptable Density:** ≤1 concessive "while" per 500 words. Never more than one per two paragraphs.

**Rewrite Menu:**
1. "Delete the while-clause. State the Y claim directly without conceding X first."
2. "Replace 'While' with a full-sentence acknowledgment: 'Company visits help. But the foundation comes from the classroom.' — split the contrast across sentences."
3. "Replace with 'even though' or 'despite' for variety: 'Despite the value of company visits...' — same logic, different rhythm."
4. "Reverse the order: lead with the writer's position, then acknowledge the concession. 'Classroom education provides the foundation — even when company visits offer direct exposure.'"

---

### S-19: Weak Verb Padding **[TIER 2]**

**Pattern:** Padded verb constructions that insert distance between agent and action: "helps with," "plays a role in," "is aimed at," "can be used to," "serves as," "works to," "is focused on," "contributes to." These constructions add words without adding meaning and strip agency from sentences. "The initiative **plays a role in helping with** community engagement" says exactly what "The initiative **engages** the community" says, in twice the words.

**Detection:** REGEX for curated padded-verb phrase list + PARSE (dependency analysis: flag when a main verb is "help," "play," "serve," "aim," "work," "contribute," "focus" and the semantic content is in a following infinitive or prepositional phrase).

**LLM Overuse Factor:** 4–6× more common than direct human constructions. Contently 2025.

**Self-Amplification:** MED. Padded verbs establish a detached, institutional register that reinforces itself.

**Acceptable Density:** ≤1 per 300 words. Marketing: 0 (direct verbs sell). Technical: ≤1 per 500.

**Rewrite Menu:**
1. "Replace the padded construction with its root verb. 'Plays a role in improving' → 'improves.' 'Helps with managing' → 'manages.' 'Is aimed at reducing' → 'reduces.'"
2. "Name the agent. 'The tool can be used to analyze data' → 'Engineers use the tool to analyze data.' If no agent exists, the sentence is hiding something."
3. "Delete the padding and test. If 'The initiative engages the community' says everything, the padding was waste."

---

### S-20: Additive Negative Parallelism **[TIER 2]**

**Pattern:** Excessive reliance on "Not just X, but also Y" / "Not only X, but Y" to link concepts. Unlike S-01 (binary contrast: "Not X, but Y"), this additive structure is used to fulfill comprehensive-answer expectations — ensuring no aspect goes unstated. "This product is **not just** about efficiency, **but about** transformation." The structure is grammatically fine; its overuse in AI text is the tell.

**Detection:** REGEX for `(not only|not just|not merely).*?(but also|but furthermore|but)` constructions. Count per 1,000 words.

**LLM Overuse Factor:** 5–8× in AI persuasive/explanatory text. WikiProject; ContentGrip 2025.

**Self-Amplification:** LOW. Localized rhetorical flourish.

**Acceptable Density:** ≤1 per 1,000 words. Never twice in the same section.

**Rewrite Menu:**
1. "State both things directly without the frame. 'Not just efficient, but transformative' → 'efficient and transformative.' Or better: just 'transformative.'"
2. "Pick the stronger claim and delete the weaker. If the 'not just' clause doesn't earn its place, it's throat-clearing."
3. "Replace with a specific comparison or progression: 'Efficiency was the starting point. Transformation was the result.'"

---

## LEVEL 3: PARAGRAPH PATTERNS (continued)

---

### P-08: Dense but Disconnected (Metapragmatic Link Deficit) **[TIER 1]**

**Pattern:** Paragraphs that are internally coherent sentence-by-sentence but lack the cohesive discourse markers and lexical bundles that *link ideas conceptually*. Each sentence adds information; no sentence explains the *relationship* between that information and the previous sentence. The text is locally dense and globally fragmented — what Markey 2024 calls "dense and disconnected." This is the inverse of L-04 (where discourse markers are overused as filler). Here, the connective tissue that would explain *why* one fact follows another is missing entirely.

**Detection:** STATISTICAL (frequency of cohesive lexical bundles: "which means that," "the reason is," "this connects to," "as a result of") + LLM (rate each sentence pair for explicitly marked logical relationship). Flag when <30% of sentence transitions have explicit conceptual links in a passage with >8 information-bearing sentences.

**LLM Overuse Factor:** ChatGPT demonstrates the "least frequently found lexical bundle function" relating to linking ideas. Markey 2024.

**Self-Amplification:** MED. Disconnected paragraphs force the model to rely on rigid structures (lists, parallel constructions) for coherence, which compounds other patterns.

**Acceptable Density:** ≥40% of sentence transitions in dense paragraphs should contain an explicit logical link (causal, contrastive, exemplificatory, or sequential).

**Rewrite Menu:**
1. "Between the two densest adjacent sentences, insert a sentence that explains *why* the second follows the first. 'The server crashed at 2 a.m. [WHY THIS MATTERS:] That timing meant no engineer was awake to catch it. The outage lasted four hours.'"
2. "Add a 'because,' 'which means,' 'so,' or 'the reason' to the start of at least one sentence per paragraph. Let the reader see the logic chain."
3. "Replace one information-bearing sentence per paragraph with an inference or implication sentence. Instead of adding another fact, tell the reader what the previous facts *mean together*."
4. "Read the paragraph and ask: could these sentences be reordered without loss? If yes, the links are missing."

---

### P-09: Markdown/Formatting Compulsion in Prose **[TIER 1]**

**Pattern:** Insertion of unnecessary bold text, italics, bulleted/numbered lists, headers, or raw Markdown syntax in contexts that call for continuous prose. Includes bold inline headers followed by colons in list items ("**Historical Context:** The world was changing..."), unparsed Markdown artifacts (**, ##, -), and the conversion of prose arguments into bullet points.

**Detection:** REGEX (detect Markdown syntax: **, ##, -, numbered lists, `code blocks` in non-code contexts). Flag when ≥2 formatting elements appear in a passage of continuous prose where the genre doesn't call for structured formatting.

**LLM Overuse Factor:** Common tell in Wikipedia drafts and prose contexts. WikiProject; multiple independent observations.

**Self-Amplification:** MED. Once formatting is introduced, subsequent paragraphs tend to mirror it.

**Acceptable Density:** 0 in continuous prose genres (essays, articles, fiction, correspondence). Acceptable in technical documentation, tutorials, reference materials.

**Rewrite Menu:**
1. "Remove all bold, italic, and bullet points. Rewrite as continuous prose. If the information structure survives as prose, the formatting was unnecessary."
2. "Replace inline-header lists ('**Point:** explanation') with proper topic sentences in separate paragraphs."
3. "If a numbered list is genuinely needed, earn it by introducing it without enumeration: discuss the points in order without numbering them. Let the reader feel the structure rather than see it scaffolded."

---

### P-10: Generic Specificity (Plausible but Empty Examples) **[TIER 2]**

**Pattern:** Examples that feel specific without being specific. "A procurement policy that made sense for a manufacturing business might not work for a software division" — plausible, illustrative, and completely empty. No policy named. No business named. No division named. The model generates examples that have the *shape* of specificity (particular-sounding nouns, conditional framing) while containing zero verifiable information.

**Detection:** LLM (classify examples as containing or lacking proper nouns, dates, measurements, named entities) + STATISTICAL (NER: count named entities per example sentence). Flag examples where generic nouns outnumber proper nouns >3:1.

**LLM Overuse Factor:** 70%+ of AI examples lack proper nouns; ~20% in human writing. Cherryleaf 2026; WikiProject.

**Self-Amplification:** MED. Generic examples reinforce vague authority and prevent the model from anchoring in specifics.

**Acceptable Density:** ≥50% of examples in a document should contain at least one proper noun, named entity, or specific measurement.

**Rewrite Menu:**
1. "Name the company, the person, the city, the product. 'A manufacturing business' → 'a Toyota plant in Georgetown, Kentucky.' If you can't name a real one, the example isn't grounded enough to use."
2. "Add a date or a number. 'A procurement policy that didn't scale' → 'A 2019 procurement policy that added 14 days to every order cycle.'"
3. "Replace the hypothetical example with a real one. If no real example exists, state that explicitly rather than fabricating a generic one."
4. "Ask: could this example appear in any essay on any topic with a different noun swapped in? If yes, it's not an example — it's a template."

---

### P-11: RST Discourse-Relation Skew **[TIER 2]**

**Pattern:** When modeled as Rhetorical Structure Theory (RST) graphs, machine paragraphs show different discourse relation profiles than human paragraphs. Machines overexpress certain relations (especially Background and Elaboration — adding context and detail) while humans show more Temporal relations (sequencing events), Joint relations (equal-weight coordination), and Contrast relations. The machine profile reflects a "stack evidence around a claim" approach; the human profile reflects "build an argument through varied logical moves."

**Detection:** PARSE (RST discourse parsing) + STATISTICAL (motif frequency distributions; MF-IDF scoring). Compare relation type distributions against human baseline per genre.

**LLM Overuse Factor:** Background motifs overrepresented; Temporal and Joint underrepresented. Effect sizes are domain-specific but consistent. Kim 2024 (ACL).

**Self-Amplification:** MED. Once a paragraph is built as a stack of elaborations, subsequent sentences attach as more elaborations rather than changing relation types.

**Acceptable Density:** No more than 50% of discourse relations within a paragraph should be the same type. At least 3 distinct relation types per 5-paragraph section.

**Rewrite Menu:**
1. "Replace one Elaboration (adding detail to a claim) with a Temporal move (narrating a sequence). Instead of 'Furthermore, this approach...' → 'First, the team tried X. Then they discovered Y.'"
2. "Replace one Background relation with a Contrast. Instead of 'Given that X is established...' → 'X is the standard approach. But it fails when...'"
3. "Add one Joint (equal-weight) relation per section: present two facts as equally important without one serving the other. 'The cost dropped. The quality held.' — not 'The cost dropped, which meant the quality...'"
4. "Add one Cause or Result relation where one is missing. Make an explicit 'because' or 'so' visible in the text."

---

### P-12: Inline-Header Vertical Lists **[TIER 2]**

**Pattern:** Vertical lists where bold text functions as an inline header, followed by a colon, merging what should be a section heading with the first sentence of content: "1. **Historical Context:** The world was rapidly changing..." / "- **Economic Impact:** The economy saw significant growth..." The model compresses hierarchy to save tokens, producing structures that are neither proper headers nor proper prose.

**Detection:** REGEX for pattern: list marker (number, bullet, dash) followed by bold/strong text followed by colon. Flag when ≥3 consecutive items follow this pattern.

**LLM Overuse Factor:** Common in AI-generated outlines and summaries. WikiProject.

**Self-Amplification:** HIGH. Once established in the first list item, every subsequent item replicates the format exactly.

**Acceptable Density:** 0 in prose. Acceptable in structured reference materials only if the formatting is consistent with the publication's style guide.

**Rewrite Menu:**
1. "Convert each inline header to a proper section heading with the content as a paragraph below it."
2. "Remove the bold and colon; integrate the header concept into the first sentence of a proper paragraph: '**Economic Impact:** The economy saw growth' → 'The economy saw significant growth in the period following the policy change.'"
3. "Remove the list structure entirely and write as connected paragraphs with transitions."

---

## LEVEL 4: DOCUMENT PATTERNS (continued)

---

### D-07: Emotional Positivity Bias / Negative Affect Suppression **[TIER 1]**

**Pattern:** Documents show systematically reduced negative emotions (fear, disgust, anger) and more uniform positivity/motivation compared to human writing. Even when analyzing serious subjects, AI prose skews toward positive framing, optimistic conclusions, and motivational arcs. RLHF/safety alignment penalizes negative emotional generation, creating a measurable affective fingerprint.

**Detection:** STATISTICAL (multi-dimensional emotion lexicons: LIWC, NRC; sentiment trajectory analysis). Key metric: fear+disgust frequency compared to joy+positive frequency across the document. Plot emotional arc and flag when negative emotions are <70% of human genre baseline.

**LLM Overuse Factor:** Fear: 10.77% (human) vs 8.34–9.2% (LLM). Disgust: 7.35% (human) vs 7.19–8.32% (LLM). Joy: 8.30% (human) vs 8.53–9.80% (LLM). Neutral: 52.16% (human) vs 53.65–56.55% (LLM). Muñoz-Ortiz 2024.

**Self-Amplification:** HIGH. Positive framing established early forces the model toward optimistic conclusions.

**Acceptable Density:** Emotional arc should vary across a document. No 500-word window should have sentiment polarity >0.3 SD above the human genre baseline unless the topic genuinely warrants it.

**Intervention Strategy:**
1. "Identify the three most serious implications of the argument. For each, write one sentence that sits with the negative consequence instead of pivoting to a positive. 'This means some patients will be misdiagnosed.' Period. No 'however' pivot."
2. "Ensure the conclusion is not more optimistic than the evidence warrants. If the data is mixed, the conclusion should be mixed."
3. "Add one sentence of genuine concern, alarm, or criticism per section where the topic warrants it. Allow the reader to feel the weight."
4. "In narrative: allow one scene per 1,000 words to end badly. Not every paragraph needs resolution; not every resolution needs to be positive."

---

### D-08: Vocabulary/Readability Uniformity **[TIER 2]**

**Pattern:** Two related uniformity signals: (1) CEFR-level uniformity — the vocabulary difficulty level stays flat across the entire document instead of varying as humans naturally do (complex academic words next to simple punchy idioms); (2) Readability-score uniformity — Flesch-Kincaid or similar metrics show AI text maintaining consistent scores (σ < 0.5) across sections while human text varies widely (σ > 2.0). Together, these create a document that reads at the same "difficulty" from start to finish.

**Detection:** STATISTICAL. Run sequential 200-word chunks through readability formulas (FK, Coleman-Liau, ARI). Compute standard deviation across chunks. Optionally run vocabulary through CEFR classifiers. Flag when readability SD < 1.0 or CEFR level variance < 0.5 across the document.

**LLM Overuse Factor:** AI readability SD <0.5; human >2.0. Wellows 2025. AI generates text at measurably more consistent CEFR level. Markey 2024.

**Self-Amplification:** HIGH. Consistent vocabulary level stabilizes generation temperature, preventing anomalous tokens.

**Acceptable Density:** Readability SD ≥1.5 across any document with 5+ sections. At least one section should be ≥2 FK grade levels above or below the document mean.

**Intervention Strategy:**
1. "Identify the most technical section. Follow it with the simplest section. Create deliberate readability contrast."
2. "Add one passage per 1,000 words that is markedly simpler than the rest: a concrete example, an analogy, a one-line summary. Readability dips are breathing room."
3. "Add one passage per 1,000 words that is markedly denser: a data-heavy paragraph, a precise technical specification, a complex conditional. Readability spikes are where the real work happens."
4. "Vary sentence complexity within paragraphs. Follow a 30-word sentence with an 8-word sentence. This alone shifts per-chunk readability scores."

---

### D-09: Specificity Gradient Flattening **[TIER 2]**

**Pattern:** The systematic absence of the "long tail" of highly specific, domain-localized vocabulary. In human professional writing, vocabulary distribution follows a skewed curve — heavy use of a few domain-expert terms (the "long tail"). AI text peaks in the intermediate/general zone, employing broad vocabulary but lacking the deep niche terminology that experts use naturally. The document feels comprehensive but lacks depth. Related to L-15 (vocabulary smoothing) but measured at document scale as a distributional property.

**Detection:** STATISTICAL (word frequency distribution analysis: compute skewness and kurtosis of vocabulary rarity against a large reference corpus). Flag when the long-tail (words appearing <1 per million in reference corpus) is <50% of genre baseline.

**LLM Overuse Factor:** HIGH. Universal across unfinetuned models. Conceptually strong, documented in NBER vocabulary research and AI writing analyses.

**Self-Amplification:** HIGH. Operating within intermediate vocabulary establishes a generalist register that prevents the model from accessing deep-niche token sequences.

**Acceptable Density:** At least 5% of content words should be domain-specific terms (appearing <10 per million in a general corpus). Technical writing: ≥8%.

**Intervention Strategy:**
1. "Identify the 5 most domain-specific terms that should appear in this document but don't. Insert them with appropriate context."
2. "Replace 3 generic nouns per section with their domain-specific equivalents. 'Procedure' → 'sternotomy.' 'System' → 'event-driven message bus.' 'Factor' → 'coefficient of thermal expansion.'"
3. "Add one sentence per section that uses insider jargon, then immediately contextualizes it for non-experts. The jargon proves expertise; the context proves communication skill."

---

### D-10: Cross-Domain Stylistic Rigidity (Prompt Convergence) **[TIER 2]**

**Pattern:** Instruction-tuned models produce structurally similar text regardless of prompt genre. Even when explicitly asked to write informally, conversationally, or in a specific genre's voice, the underlying syntactic structure (noun-to-verb ratio, coordination frequency, nominalization rate, clause embedding depth) reverts to the model's trained "helpful assistant" baseline. Surface lexical changes (adding slang, removing jargon) mask unchanged structural patterns. Related to D-06 (register flatness within a document) but distinct: D-06 is intra-document uniformity; D-10 is cross-prompt convergence — the model sounds the same across *different documents* on *different topics* in *different genres*.

**Detection:** STATISTICAL (Biber MDA dimension scoring across multiple documents from the same model with different genre prompts). Flag when dimension scores vary <15% across casual/formal/narrative/technical prompts. LLM (genre classifier: can a classifier identify the prompted genre from the output? If accuracy <60%, the model isn't actually changing genre).

**LLM Overuse Factor:** Instruction-tuned models deviate strongly from target register. Reinhart 2025 reports classifier accuracy of 93–98% for distinguishing AI text across genres — precisely because the structural style doesn't change. Milička 2025 shows base models sometimes better at register matching than tuned ones.

**Self-Amplification:** HIGH. The model's foundational weights act as gravitational pull toward structural formality.

**Acceptable Density:** Biber Dimension 1 (Involved vs. Informational) score should vary by ≥1.5 SD between a conversational prompt and an academic prompt from the same model. If it doesn't, the genre shift is cosmetic.

**Intervention Strategy:**
1. "For informal prompts: measure nominalization rate, passive voice rate, and mean sentence length. If any of these are within 10% of the same model's academic output, the informality is surface-only."
2. "For narrative prompts: measure past-tense verb frequency and 3rd-person pronoun rate. If these don't increase ≥30% over the model's expository baseline, the narrative is structural exposition in past tense."
3. "Generate the same content in the target genre from a fresh context without prior output visible. Convergence decay (D-01) combined with stylistic rigidity (D-10) means the model's second paragraph sounds like its hundredth."

---

## LEVEL 5: STATISTICAL DETECTION SIGNATURES

These are mathematical/computational features that distinguish LLM text at the signal level. They don't have rewrite menus because they describe properties of the *generation process*, not surface patterns a writer can fix. They're critical for the classifier layer of the diagnostic engine.

---

### X-01: Intrinsic Dimensionality Depression (PHD) **[TIER 1]**

**What it measures:** The intrinsic dimensionality (ID) of the embedding manifold underlying the text. When text is converted to contextual embeddings (e.g., via a transformer encoder), the resulting vectors occupy a manifold in high-dimensional space. Human text manifolds have higher intrinsic dimensionality (~9 for alphabetic languages, ~7 for Chinese) than AI text (~1.5 lower), reflecting greater variability in the underlying semantic-structural space.

**Source:** Tulchinskii 2024 (NeurIPS). Pedashenko 2025 confirms across genres.

**Quantitative Signal:** Human PHDim ≈ 9.0; AI PHDim ≈ 7.5. Gap is stable across domains, generator models, and human writer proficiency levels.

**Model Specificity:** Universal. Newer models narrow the gap slightly but don't close it.

**Implementation:** Embedding extraction (any transformer encoder) → Persistent Homology Dimension (PHD) estimator → compare against baseline per language family.

---

### X-02: Perplexity Depression **[TIER 1]**

**What it measures:** Average negative log-likelihood of the text under a reference language model. AI text is more "predictable" — each token is more likely given its context — producing lower perplexity scores. Human text makes more surprising choices.

**Source:** Mitchell 2023 (DetectGPT); Gehrmann 2019 (GLTR); Turnitin detection documentation.

**Quantitative Signal:** AI perplexity ≈ 38; human perplexity ≈ 57 (rough averages; vary by domain and reference LM). AI text shows 20–50% lower perplexity.

**Model Specificity:** Signal is strongest when reference LM matches generator family. Cross-family evaluation is weaker. Newer models show slightly higher perplexity (closer to human).

**Implementation:** Score text with reference LM (GPT-2 or similar open model) → compute mean per-token log probability → compare against human corpus baseline. Windowed perplexity (per 100-token chunks) connects to D-01 (convergence decay).

**Relationship to Prose Patterns:** Low perplexity is the *cause* behind many surface patterns: the model chooses high-probability tokens, which tend to be the same familiar words (L-07), standard constructions (S-03), and predictable arcs (P-01).

---

### X-03: Burstiness Reduction **[TIER 1]**

**What it measures:** Variation in sentence-level statistics (sentence length, per-sentence perplexity, information density) across the document. Human writing is "bursty" — long dense passages followed by short simple ones — while AI writing is more uniform.

**Source:** GPTZero documentation; Turnitin; VERMILLION 2025.

**Quantitative Signal:** Sentence length coefficient of variation: human ≈ 0.61; AI ≈ 0.38 (AI is 0.62× human burstiness).

**Model Specificity:** Universal. Diffusion models (e.g., LLaDA) show burstiness closer to human.

**Implementation:** Compute per-sentence statistics → calculate variance/CV → compare against baseline. Windowed burstiness connects to S-05 (sentence length clustering) and D-03 (pacing uniformity).

---

### X-04: Probability Rank Concentration (GLTR Top-k) **[TIER 1]**

**What it measures:** For each token, compute its rank in the language model's predicted distribution. Human text uses more tokens from low-probability ranks (>100); AI text clusters in high-probability ranks (top 10). This can be visualized as a histogram of rank buckets.

**Source:** Gehrmann 2019 (GLTR).

**Quantitative Signal:** Human: ~15% top-1, ~30% rank >100. AI: ~35% top-1, ~10% rank >100. AI shows 2.3× higher concentration in top-10 ranks.

**Model Specificity:** Depends on scoring LM and generation parameters (temperature, top-p). Higher temperature → more human-like rank distribution.

**Implementation:** Score text with reference LM → assign each token to rank bucket → compute histogram → compare against human baseline.

---

### X-05: Log-Probability Curvature (DetectGPT) **[TIER 1]**

**What it measures:** Machine-generated text occupies regions of probability space where small perturbations (paraphrastic rewording) produce characteristic changes in log probability — specifically, the text tends to sit at local maxima (negative curvature), meaning perturbations consistently decrease the probability. Human text doesn't show this pattern as strongly.

**Source:** Mitchell 2023 (DetectGPT, ICML). Fast-DetectGPT (Bao 2024, ICLR) optimizes this with conditional probability curvature.

**Quantitative Signal:** AI text shows 2.3× higher perturbation discrepancy. Detection rate depends on domain and reference model.

**Model Specificity:** Requires access to (or approximation of) the generator's probability distribution. Transfer varies by generator/domain.

**Implementation:** Truncate or perturb text → regenerate with reference LM → compute divergence between original and regenerated text → thresholded classifier. DNA-GPT (Yang 2024) extends this with n-gram divergence analysis.

---

### X-06: Biber MDA Composite Score **[TIER 1]**

**What it measures:** Biber's Multidimensional Analysis scores text on 6 functional dimensions derived from factor analysis of 67+ lexico-grammatical features. LLMs systematically shift toward: (Dim 1) more informational / less involved, (Dim 2) less narrative, (Dim 3) more explicit reference / less situation-dependent, (Dim 5) less abstract. The Euclidean distance of a text's dimension vector from the human baseline is a robust composite signal.

**Source:** Milička 2025 (primary benchmark; AI-Brown corpus, 16 models). Reinhart 2025 (66-feature confirmation).

**Quantitative Signal:** Human intra-text variability ≈ 1–2 units. LLM shifts ≈ 7–40+ units. Instruction-tuned models show larger shifts than base models.

**Model Specificity:** Universal. Base models sometimes closer to human register than tuned ones. The shift pattern is near-universal: {informational, explicit, non-narrative}.

**Implementation:** Run text through MAT tagger (BFSU) or equivalent → compute dimension scores → calculate Euclidean distance from human genre centroid. Windowed analysis (per 500-word chunk) connects to D-01 (convergence decay) and D-06 (register flatness).

**Relationship to Prose Patterns:** MDA captures *co-occurrence* of features your existing patterns measure individually: L-06 (nominalization) loads on Dim 1/5, S-08 (passive voice) loads on Dim 5, S-16 (tense anchoring) loads on Dim 2, D-06 (register flatness) is the document-level manifestation of rigid dimension scores.

---

## LEVEL 6: GENRE-SPECIFIC PATTERNS

These patterns are strongly diagnostic within their genre but may not generalize. Include in detection pipeline only when document genre is identified.

---

### G-01: Dialogue Tag Homogenization (Fiction)

**Pattern:** In creative writing, dialogue attribution defaults to minimal tags ("said," "asked") without varied speech verbs or action beats. Characters perform repetitive physical actions between dialogue: sighing, nodding, shifting weight, widening eyes. Action beats fail to reflect subtext, tension, or unique character voice.

**Detection:** STATISTICAL (lexical diversity within non-dialogue sentences adjacent to quotation marks) + LLM (classify action beats for uniqueness and character-specificity).

**LLM Overuse Factor:** 70–90% minimal attribution for most models. Beat-heavy dialogue rare (<5%). Mark Lawrence AI vs Authors study 2025; lechmazur/writing_styles 2025.

**Self-Amplification:** HIGH. Once a character's physical tic is established, the model repeats it.

**Rewrite Menu:**
1. "Replace 'said' with an action beat that reveals character. 'I disagree,' she said. → 'I disagree.' She set down her pen without looking up."
2. "Delete every 'sighed,' 'nodded,' and 'shifted' in the scene. Replace each with an action specific to this character's personality or the scene's tension."
3. "Remove dialogue tags entirely for 3–4 consecutive lines of rapid exchange. Let the reader track speakers by voice."

---

### G-02: Positive Ending Compulsion (Fiction)

**Pattern:** Without explicit prompting, LLMs resolve fiction toward optimistic or gently open finales. Negative, tragic, or unresolved endings are vanishingly rare (<5%). RLHF alignment explicitly penalizes content perceived as "harmful" or "depressing."

**Detection:** LLM + STATISTICAL (sentiment analysis of final 200 words). Flag when >85% of stories resolve positively across a corpus.

**LLM Overuse Factor:** >85% positive/resonant endings across all models. lechmazur/writing_styles 2025.

**Rewrite Menu:**
1. "End the story one paragraph earlier — before the resolution."
2. "Replace the final paragraph with an image rather than a statement. End on a detail, not a lesson."
3. "Rewrite the ending to leave the central question unanswered. Not every story needs closure."

---

### G-03: Visual Sensory Dominance (Fiction)

**Pattern:** Fiction overwhelmingly relies on visual description. Tactile, olfactory, auditory, and gustatory cues are minimal. The ratio of visual to non-visual sensory words exceeds 10:1 in most models.

**Detection:** STATISTICAL (sensory word frequency analysis by category: visual, auditory, tactile, olfactory, gustatory).

**LLM Overuse Factor:** Visual: 60–80% of sensory descriptions. Tactile: <5%. lechmazur/writing_styles 2025.

**Rewrite Menu:**
1. "For each scene, require one non-visual sensory detail: a texture, a sound, a smell. Ground the reader in a body, not a camera."
2. "Replace one visual description per scene with a tactile one. 'The room was dark' → 'The floorboards stuck to her bare feet.'"
3. "Remove the visual description of one character entirely. Describe them through how they sound, smell, or what they touch."

---

### G-04: Internal Conflict Default (Fiction)

**Pattern:** Fiction defaults to internal conflict (self-doubt, identity, moral dilemma) over interpersonal, societal, or environmental conflict. Internal conflict is "safer" for the model — it doesn't require depicting harm, antagonism, or social systems.

**Detection:** LLM (conflict type classification). Flag when >60% of stories feature primarily internal conflict across a corpus.

**LLM Overuse Factor:** Internal conflict dominates 60–75% of stories. lechmazur/writing_styles 2025.

**Rewrite Menu:**
1. "Replace the internal monologue with an interpersonal confrontation. Let the conflict happen *between* characters, not inside one."
2. "Add an external obstacle that the character's internal state cannot solve alone."
3. "Introduce a systemic or environmental force the character must navigate — bureaucracy, weather, economics, illness — that creates stakes independent of the character's feelings."

---

### G-05: Scene Aimlessness / Vacuous Progression (Fiction)

**Pattern:** Paragraphs or scenes that successfully mimic genre tropes, vocabulary, and grammar but lack discernible narrative purpose. The prose reads fluently; nothing actually happens. No plot advances, no character is changed, no information is revealed. Locally logical, globally aimless.

**Detection:** LLM (classify each paragraph for narrative function: advances plot, reveals character, establishes setting, creates tension, provides information, none). Flag when ≥3 consecutive paragraphs have no discernible narrative function.

**LLM Overuse Factor:** Detectable with >95% accuracy by MLP classifiers in blind tests (Barclay 2024), while human judges achieve only ~55%.

**Self-Amplification:** HIGH. Without a guiding thesis or plot direction, the model generates locally logical but globally aimless prose indefinitely.

**Rewrite Menu:**
1. "Delete the aimless paragraph entirely. If no information is lost, it was filler."
2. "Add a single event, decision, or revelation to the paragraph. Something must *change* between the first and last sentence."
3. "End the paragraph with a sentence that makes the reader ask a question. If the paragraph doesn't create any questions, it isn't doing work."

---

### G-06: Contextual Amnesia / Logical Persistence Failure (Fiction/Long-form)

**Pattern:** The model fails to maintain logical object permanence or spatial awareness over long documents. Grammar remains perfect, but entities behave impossibly: characters interact with objects never mentioned, perform actions inconsistent with previously established physical states, or reference information they shouldn't possess. "The invisible spirit handed the barista a silver coin" — grammatically flawless, logically absurd.

**Detection:** LLM (entity state tracking: map entity attributes and spatial positions across the document; flag contradictions). Requires semantic comprehension, not pattern matching.

**LLM Overuse Factor:** HIGH in unassisted long-form generation. Mark Lawrence AI vs Authors study 2025.

**Rewrite Menu:**
1. "Build an entity tracker: for each character and significant object, maintain a list of current attributes and location. Verify each new sentence against this state."
2. "After every scene transition, re-anchor the reader with a brief physical grounding: who is present, where they are, what they're holding."

---

### G-07: Syntax-First Documentation (Code)

**Pattern:** When generating code documentation, AI writes paragraphs that literally translate code syntax into English ("This function takes a string array and iterates through it using a for-loop to return a boolean"). Human engineers document business logic, constraints, and intent ("Checks user permissions against the legacy database schema to prevent unauthorized escalations").

**Detection:** LLM (classify documentation paragraphs as structural/syntactic vs. conceptual/intent). Flag when >70% of documentation describes *what* the code does rather than *why*.

**LLM Overuse Factor:** ~100% syntax-focused without explicit prompting. Enterprise AI integration studies.

**Rewrite Menu:**
1. "Replace every sentence that describes *what* the code does with one that describes *why* it exists or *when* to use it."
2. "Delete any comment that restates the code. If `return a + b` has a comment saying 'returns the sum of a and b,' delete the comment."
3. "Add one sentence per function describing the business constraint or edge case it handles."

---

### G-08: Over-Engineered Docstrings (Code)

**Pattern:** Excessively verbose docstrings for trivial functions, including formal parameter documentation, return type descriptions, and example usage for self-evident operations. LLM code has 61% higher cyclomatic complexity than human code (5.0 vs 3.1) and frequently includes unused parameters in function signatures.

**Detection:** STATISTICAL (ratio of docstring length to function complexity; cyclomatic complexity scoring; unused parameter detection via linters).

**LLM Overuse Factor:** 61% higher complexity. Docstrings 3–5× longer than human equivalents for equivalent functions. arXiv:2501.16857 (2025).

**Rewrite Menu:**
1. "Delete the docstring for any function whose name + parameters already explain its purpose."
2. "Replace parameter descriptions with a single sentence explaining the function's role in the system."
3. "Remove unused parameters from function signatures."

---

## UPDATES TO EXISTING PATTERNS

### L-07 Addendum: Extreme-Rate Lexical Items

Add to L-07's phrase list and overuse factor: Reinhart 2025 quantifies specific words at extreme overuse rates in instruction-tuned models:

| Word | Overuse Factor | Primary Model |
|------|---------------|---------------|
| delve | +2665% | GPT-4o |
| underscore | +1182% | GPT-4o |
| camaraderie | ~150× | GPT-4o |
| palpable | ~135× | GPT-4o/Llama |
| intricate | ~100× | GPT-4o/Llama |
| tapestry | 23% of GPT-4o outputs | GPT-4o |
| amidst | 27% of GPT-4o outputs | GPT-4o |

Note: "delve" was reportedly patched by OpenAI circa late 2024. The model migrated to semantically equivalent verbs ("explore," "examine," "investigate") — track the *semantic category* (investigation verbs), not the specific word.

### S-02 Addendum: Quantitative Refinement

Update overuse factor with Reinhart 2025 data: GPT-4o uses present participial clauses at 5.3× human rate (Cohen's d = 1.38). Llama 3 Instruct: 2.8×. Base models are closer to human rates. Instruction tuning dramatically amplifies this pattern.

### S-05 Addendum: Burstiness Connection

Add connection to X-03 (Burstiness Reduction): sentence length clustering is a specific manifestation of the broader burstiness reduction measurable via coefficient of variation. Human CV ≈ 0.61; AI CV ≈ 0.38. S-05's σ < 4 threshold maps to roughly the same signal.

### D-06 Addendum: Biber MDA Quantification

Add quantitative data from Milička 2025: LLMs shift 7–40+ units on normalized Biber dimensions compared to human text. The three primary attractors are: more informational (Dim 1 negative), more explicit reference (Dim 3 negative), less narrative (Dim 2 negative). Connect to X-06 (Biber MDA Composite Score) for implementation.

---

## UPDATED IMPLEMENTATION NOTES

### Expanded Priority Order

Integrate new patterns into existing priority ordering. Tiers reflect impact × tractability:

**Tier A — Highest Impact, Ready to Implement:**
1. P-01 (paragraph arc repetition) — highest impact per intervention
2. S-01 (binary contrast) — most recognizable single pattern
3. P-07 (vignette opening) — kills opening variety
4. S-05 + X-03 (sentence length clustering / burstiness) — most measurable
5. L-02 (resumptive phrases) — easy to detect, easy to suppress
6. **S-14 (sentence opener diversity)** — NEW. High signal, easy to measure.
7. **L-13 (temporal sweeping openers)** — NEW. REGEX-detectable, high impact on openings.
8. **P-08 (dense but disconnected)** — NEW. Explains why AI prose feels "off" despite local coherence.

**Tier B — High Impact, Moderate Implementation:**
9. S-02 (participial cascades) — well-documented overuse factor
10. L-06 (nominalizations) — well-documented, high impact on voice
11. P-02 (resolution compulsion) — hard to fix but high impact on texture
12. D-01 (convergence decay) — requires neutralizing filter
13. L-01 (puffing phrases) — easy win, low effort
14. **D-07 (emotional positivity bias)** — NEW. Requires sentiment analysis but high signal.
15. **L-10 (personal pronoun skew)** — NEW. Simple token counting, high diagnostic value.
16. **S-15 (punctuation distribution)** — NEW. Character-level counting, surprisingly diagnostic.

**Tier C — Valuable, Requires Infrastructure:**
17. **S-11 (subordinate clause inflation)** — Requires parsing.
18. **S-13 (dependency distance deficit)** — Requires dependency parsing + Ω calculation.
19. **L-12 (content-to-function ratio)** — Requires POS tagging.
20. **L-09 (auxiliary verb inflation)** — Requires POS tagging.
21. **X-06 (Biber MDA composite)** — Requires MAT tagger. Highest signal but highest implementation cost.
22. **P-11 (RST discourse skew)** — Requires discourse parsing. High robustness but specialized tooling.

**Tier D — Model Fingerprinting:**
23. **L-11 (downtoner divergence)** — Fingerprints GPT vs Llama.
24. **S-12 (clausal coordination divergence)** — Fingerprints GPT vs Llama.
25. **L-17 (contraction rate fingerprint)** — Model-family signature.

**Tier E — Statistical Detection Layer:**
26. **X-01 (intrinsic dimensionality)** — Highest mathematical signal. Requires embeddings.
27. **X-02 (perplexity depression)** — Fast, zero-shot. Core detection primitive.
28. **X-04 (probability rank concentration)** — Requires LM scoring. Visual diagnostic.
29. **X-05 (log-probability curvature)** — Most robust zero-shot method. Requires perturbation.

### Expanded Style Guide Overrides

| Genre | Higher Tolerance | Lower Tolerance |
|-------|-----------------|-----------------|
| Technical documentation | S-11 subordination, L-09 auxiliaries, P-12 inline headers | L-13 temporal openers, L-19 evasive complexity, P-10 generic specificity |
| Literary fiction | S-17 cataphora, G-01–G-06 all fiction patterns, D-07 emotional variation | L-09 auxiliaries, S-11 subordination, P-09 markdown |
| Journalism | S-14 opener diversity, S-15 punctuation variety, L-10 personal pronouns | L-18 intensifiers, S-18 concessive while, P-12 inline headers |
| Academic writing | L-09 auxiliaries, L-12 content-heavy ratio, S-11 subordination | L-13 temporal sweeping, L-19 evasive complexity, P-10 generic specificity, L-15 vocabulary smoothing |
| Marketing | L-18 intensifiers (moderate), S-20 additive parallelism | L-09 auxiliaries, S-19 weak verbs, L-16 elegant variation |
| Code documentation | G-07 syntax-first (when intentional), G-08 docstrings (when API docs) | P-09 markdown compulsion (in prose sections), L-15 vocabulary smoothing |
| Social media / short-form | Lower thresholds for all patterns (shorter windows) | S-11 subordination, L-09 auxiliaries, P-12 inline headers |

### Window Sizes (Expanded)

| Pattern Level | Window Size | Stride |
|--------------|-------------|--------|
| Lexical patterns (L-series) | 200 words | 100 words |
| Sentence patterns (S-series) | 300 words | 150 words |
| Paragraph patterns (P-series) | 3 paragraphs | 1 paragraph |
| Document patterns (D-series) | 1,000 words | 500 words |
| Statistical signatures (X-series) | Full document | N/A (single score) |
| Genre-specific (G-series) | 500 words | 250 words |

---

## SOURCES BIBLIOGRAPHY

### Peer-Reviewed / Conference Papers
1. Reinhart, A. et al. (2025). "Do LLMs write like humans? Variation in grammatical and rhetorical styles." *PNAS* 122(8): e2422455122.
2. Muñoz-Ortiz, A. et al. (2024). "Contrasting Linguistic Patterns in Human and LLM-Generated News Text." *Artificial Intelligence Review*.
3. Milička, J., Marklová, A., & Cvrček, V. (2025). "Benchmark of stylistic variation in LLM-generated texts." arXiv:2509.10179.
4. Tulchinskii, E. et al. (2023/2024). "Intrinsic Dimension Estimation for Robust Detection of AI-Generated Texts." NeurIPS.
5. Kim, S. et al. (2024). "A Matter of Subtlety: Detecting Machine-Generated Texts Through Discourse Motifs." ACL 2024.
6. Markey, A. et al. (2024). "Dense and Disconnected: Analyzing the Sedimented Style of ChatGPT-Generated Text at Scale."
7. Gehrmann, S., Strobelt, H., Rush, A. (2019). "GLTR: Statistical Detection and Visualization of Generated Text."
8. Mitchell, E. et al. (2023). "DetectGPT: Zero-Shot Machine-Generated Text Detection using Probability Curvature." ICML.
9. Bao, G. et al. (2024). "Fast-DetectGPT: Efficient Zero-Shot Detection via Conditional Probability Curvature." ICLR.
10. Yang, X. et al. (2024). "DNA-GPT: Divergent N-Gram Analysis for Training-Free Detection." ICLR.
11. Shalevska, E. (2024). "A Comparative Analysis of First-Person Pronoun Use in AI-Generated and Human-Written Essays."
12. Zamaraeva, O. et al. (2025). "Comparing LLM-generated and human-authored news text using formal syntactic theory." ACL 2025.
13. Shaib, C. et al. (2024). Syntactic templates in LLMs. *Computational Linguistics*.
14. Wang, L. & Zhu, H. (2023). Corpus-based analysis of verb tense usage patterns.
15. "Stance and Cohesion: The Use of However and While in AI Argumentative Discourse." ROCLING 2025.
16. "Comparing human and LLM proofreading in L2 writing." BEA Workshop, ACL 2025.
17. Desaire, H. et al. (2023). "Distinguishing academic science writing from ChatGPT." *Cell Reports Physical Science*.
18. Barclay, P. et al. (2024). "Using Machine Learning to Distinguish Human-written from Machine-generated Creative Fiction."
19. Pedashenko, N. et al. (2025). "Unveiling Intrinsic Dimension of Texts."
20. Biber, D. (1988). *Variation across Speech and Writing*. Cambridge University Press.

### Community / Editorial / Tool Documentation
21. Wikipedia:Signs of AI writing (WikiProject AI Cleanup, 2025 field guide).
22. VERMILLION Framework (2025). "The Disappearing Author." ResearchLeap.
23. Cherryleaf (2026). "Indicators that suggest something was written by AI."
24. Contently (2025). "How to edit the AI-isms out of your content."
25. lechmazur/writing_styles (2025). "Mapping LLM Style and Range in Flash Fiction." GitHub.
26. Mark Lawrence (2025). "AI vs Authors" blind study.
27. Turnitin AI Detection documentation (2024).
28. GPTZero documentation.
29. Frontiers in Education (2024). "Exploring the boundaries of authorship."

### Industry / Technical Reports
30. Multilingual.com (2025). "Detecting AI-Generated Content."
31. arXiv:2501.16857 (2025). "Comparing Human and LLM Generated Code."
32. arXiv:2508.21634 (2025). "Human-Written vs. AI-Generated Code: A Large-Scale Analysis."
33. LobeHub AI Text Humaniser documentation.

### Round 2 Sources (tropes.fyi, GPTZero, NYT, nostalgebraist, Jiang & Hyland)
34. GPTZero AI Vocabulary (Oct 2024). 3.3M-document analysis of phrase-level overuse rates. "Today's fast-paced world" at 107×.
35. Tropes.fyi (Ossama Chaib, 2025). 32-trope catalog of LLM writing patterns with structural analysis.
36. Sam Kriss. "Why Does A.I. Write Like … That?" *NYT Magazine*, Dec 3, 2025. 5,000-word analysis centering negation-reframe.
37. nostalgebraist. "Hydrogen Jukeboxes" (Tumblr/LessWrong, Feb/Mar 2025). Cross-model convergence in creative fiction vocabulary. GitHub: github.com/nostalgebraist/crammed-poetics.
38. Record Crash Substack (Nov 2025). "Rolodex of 20-30 generic images" in long-form LLM fiction.
39. Jiang, F. & Hyland, K. (2025). Three papers: *English for Specific Purposes* 79:17–29; *Applied Linguistics* 46(3):375–391; *Written Communication*. Interactional metadiscourse deficit in AI text.
40. Hans, A. et al. (2024). "Binoculars: Zero-Shot Detection of LLM-Generated Text." ICML 2024. Cross-perplexity ratio detection.
41. Stanford/Science (March 2026). Sycophancy study: chatbots sided with users ~80% of the time; endorsed user behavior 49% more than humans.
42. DivEye (arXiv 2509.18880, 2025). Higher-order surprisal statistics (variance, skewness, kurtosis) for AI text detection.
43. Mak, V. & Walasek, L. (2025). "Student writing sentiment post-ChatGPT." *Computers and Education: AI* 9:100507.
44. Simon, L. et al. (2023). AI text detection: punctuation, word order, idiom analysis.
45. Mitrović, S. et al. (2023). First-person pronoun reduction and informal language suppression in AI text.
46. Chong, C. et al. (2023). Proper noun frequency deficit in AI text.
47. Petukhova, V. et al. (2024). Named entity density in AI vs human writing.
48. Terçon & Dobrovoljc (2025). arXiv:2510.05136. Comprehensive survey of AI text linguistic characteristics.
49. AI Loc Think Tank (Pantcheva 2025). Negation-reframe frequency (~1 per 200 words).
50. Washington Post (2025). Analysis of 300,000+ ChatGPT messages showing vocabulary drift over model versions.
51. Scientific American (2025). Trigram analysis: within-model distributional distance 0.92 vs cross-model 1.49.

---

## EXPANSION ROUND 2: New Patterns (L-20 through D-16)

The following 21 patterns were identified from tropes.fyi, GPTZero's 3.3M-document analysis, Sam Kriss (NYT Magazine), nostalgebraist's cross-model fiction analysis, Jiang & Hyland's metadiscourse research, the Stanford sycophancy study, and Wikipedia's AI Cleanup project. Full registry entries with rewrite menus are in `packages/core/src/taxonomy/pattern-registry.ts`. Summary below.

### New Lexical Patterns

| ID | Name | Overuse Factor | Key Source |
|---|---|---|---|
| L-20 | Idiom and Colloquialism Avoidance | Consistently documented | Simon 2023, Mitrović 2023 |
| L-21 | Copula Substitution ("Serves As" Dodge) | Elevated "serves as"/"stands as" rates | tropes.fyi |
| L-22 | Marketing Action Verbs as Default Register | Strong in non-marketing contexts | tropes.fyi, Entrepreneur |
| L-23 | Ghostly-Spectral Vocabulary Palette (Fiction) | ~20 per 1,200 words vs ~2-4 human | nostalgebraist 2025, Kriss NYT 2025 |
| L-24 | Fictional Character Name Convergence | "Elara"/"Kael"/"Sarah Chen" co-occurrence diagnostic | nostalgebraist, writewithai |
| L-25 | Invented Concept Labels | Near-zero in human writing | tropes.fyi, WikiProject |

### New Sentence Patterns

| ID | Name | Overuse Factor | Key Source |
|---|---|---|---|
| S-21 | Negation-Reframe ("It's Not X — It's Y") | ~1 per 200 words; cited by 6+ sources | tropes.fyi, Kriss NYT, Pantcheva 2025 |
| S-22 | Self-Posed Rhetorical Q&A Cadence | 3-5× per 500 words | tropes.fyi, Pantcheva 2025 |
| S-23 | SVO Word Order Rigidity | Shannon Index ~3.2 human vs lower LLM | Simon 2023, HPSG study 2025 |
| S-24 | Over-Explanation and Parenthetical Definitions | Audience-expertise mismatch | WikiProject, tropes.fyi |
| S-25 | Forced Synesthesia (Fiction) | ~20 per 1,200 words | nostalgebraist, Kriss NYT |
| S-26 | "Whether" Universal Closer | Very high-confidence tell when present | Content professionals, tropes.fyi |

### New Paragraph Patterns

| ID | Name | Overuse Factor | Key Source |
|---|---|---|---|
| P-13 | Blocky Scene Architecture (Fiction) | 5+ sentence homogeneous runs | Record Crash, nostalgebraist |
| P-14 | Listicle in a Trench Coat | Consistently identified | tropes.fyi |
| P-15 | Manufactured Single-Sentence Paragraphs | Every 3-5 paragraphs vs rarely human | tropes.fyi |

### New Document Patterns

| ID | Name | Overuse Factor | Key Source |
|---|---|---|---|
| D-11 | Grammatical Perfection (Error Absence) | ~0 errors vs ~1-3/1000 words human | WikiProject, CNET |
| D-12 | Digression Absence (Relentless Linearity) | Consistently identified gestalt indicator | Multiple professional writers |
| D-13 | Vocabulary Collapse Over Document Length | Declining MATTR after ~5,000 words | Record Crash, nostalgebraist |
| D-14 | Sycophantic and Motivational Closings | Models validate problematic actions 47% | Stanford/Science 2026 |
| D-15 | Reduced Interactional Metadiscourse | Statistically significant across 3 studies | Jiang & Hyland 2025 |
| D-16 | Cross-Model Consensus Signature | Binoculars: >90% TPR at 0.01% FPR | Hans et al. ICML 2024 |

### RLHF-Specific Amplification Note

Three mechanisms create or amplify patterns above: (1) **Annotator bias toward apparent sophistication** — RLHF raters upvote contrast framing (S-21), concessive structures (S-18), and rhetorical Q&A (S-22). (2) **Helpfulness optimization** — produces over-explanation (S-24), deferential scaffolding (L-17 in base taxonomy), sycophantic closings (D-14). (3) **Safety training** — compresses emotional valence (D-07), suppresses idioms (L-20), inserts professional-consultation disclaimers. Base models (pre-RLHF) show significantly fewer of these patterns — Reinhart 2025 confirmed base models write more like humans than instruction-tuned models do.

### Pattern Evolution Note

Fingerprint vocabulary shifts over time but the phenomenon persists. Washington Post analysis of 300K+ ChatGPT messages: "delve" declined sharply 2023→2025, replaced by "core" and "modern." Scientific American: within-model distributional distance 0.92 vs cross-model 1.49 (~2× separation). Detection systems must maintain rolling databases of model-version-specific signatures rather than static word lists.

# Symmetrical sentence templates

> Predictable sentence and paragraph structures creating mechanical rhythm — contrastive negation, triadic lists, balanced formulas, and paragraph-level templates.

**Hit list:** [`hitlists/symmetrical-sentence-templates.json`](../hitlists/symmetrical-sentence-templates.json)  
**Signal strength (Symmetrical Sentence Templates):** Strong contextual for stacked patterns  
**False-positive risk (Symmetrical Sentence Templates):** Medium — some structures are legitimate rhetorical devices  
**Signal strength (Overbalanced Compare/Contrast):** Strong contextual  
**False-positive risk (Overbalanced Compare/Contrast):** Medium — contrastive structures are common in argumentation  

## Symmetrical Sentence Templates

**What it is.** Predictable sentence and paragraph structures creating mechanical rhythm — contrastive negation, triadic lists, balanced formulas, and paragraph-level templates.

**Why it reads as slop.** AI prose relies on symmetrical rhetorical structures emerging from training data biases and RLHF optimization rewarding complexity over depth. The *“It’s not X, it’s Y”* pattern increased 4x in Fortune 500 communications between 2023 and 2025. *Not only…but also* and rule-of-three lists rank among the strongest structural signals in detection research. No single template confirms AI authorship, but stacked symmetrical patterns constitute recognizable “AI Sentence DNA.”

**What it looks like.** *It’s not X, it’s Y* — the most distinctive AI sentence template per Bloomberry. *Not only X, but also Y* — appears at 3-5x human rate. *X, Y, and Z* triads — AI lists exactly three items in ~80% of multi-item lists. *While X may seem [adj], Y is actually [adj]* — concessive-while with predictable positive reframe. *The [noun] is not X. The [noun] is Y.* — period-separated declarations creating false punchiness.

## Overbalanced Compare/Contrast

**What it is.** Mechanical compare/contrast frames simulating analytical balance through predictable structural opposition at the paragraph level.

**Why it reads as slop.** This subcategory operates above the sentence level. Overbalanced compare/contrast creates the illusion of analysis by mechanically pitting two views against each other and resolving them with a pre-baked synthesis. *On the one hand…on the other hand* followed by *However, both perspectives have merit* looks balanced while requiring no engagement with either position. The resolution is always the same: a tepid both/and letting the writer avoid taking a position.

**What it looks like.** *On the one hand…on the other hand…both perspectives have merit* — mechanical synthesis avoiding position-taking. *X is dead. Y is the future* — sweeping declaration with no evidence. *It was never about X. It was always about Y* — retrospective reframing with “never…always” pair. *The common assumption is X. The truth is Y* — invents strawman assumptions.

## How to rewrite it

Apply these strategies from [strategies.md](strategies.md), in this order of preference:

- **Reframe**: rebuild the sentence around the actual claim instead of patching the filler.
- **Change cadence**: break symmetrical rhythm; vary sentence and paragraph length.
- **Specify**: replace abstraction with concrete nouns, dates, people and mechanisms: who did what, when, with what result.

Use the `replacement` field in the hit list as a starting point, not a drop-in. A replacement that does not carry a real fact is just a different filler phrase.

## When not to flag it

A single hit is a prompt to check the sentence, not a verdict. Flag a passage when markers cluster (two or more per 100 words is worth a look, five or more is a strong signal) and when the text could have said something more specific. Never treat a hit as evidence of who or what wrote the text. See [the editorial policy](../docs/editorial-policy.md).

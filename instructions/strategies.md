# Rewrite strategies

Eight moves that fix flagged prose, and two tests for deciding where to apply them. The category files in this folder point back here.

The antidote to slop is not better words. It is **specific claims**. A model can produce "the transformative power of AI in healthcare" fluently because the phrase needs no facts. It cannot produce "in March 2024 the FDA approved the first autonomous diagnostic AI for diabetic retinopathy screening in primary care" without a date, a regulator, a condition and a setting. Swapping one stock phrase for another stock phrase fixes nothing.

## The eight strategies

**1. Delete.** Remove the filler. Many markers are throat-clearing that does no work. If the sentence reads clearly without the phrase, cut it.
*Before:* "It is worth noting that the results were significant." *After:* "The results were significant."

**2. Specify.** Replace abstraction with concrete nouns, dates, people and mechanisms. This is the core strategy and applies to every category.
*Before:* "The AI landscape is evolving rapidly, presenting both challenges and opportunities." *After:* name who spent what, which rule takes effect when, and who says they cannot comply. Only use facts the author actually has.

**3. Reframe.** Rebuild the sentence around the real claim. Contrastive formulas ("It's not X, it's Y"), structural templates and complexity theater are built to hold filler; word swaps leave the structure intact.
*Before:* "It's not about the technology, it's about the people." *After:* state the causal story: what changed, for whom, by how much.

**4. De-hype.** Replace the amplifier with the measured effect.
*Before:* "The results were nothing short of amazing." *After:* "The new design cut checkout abandonment from 68% to 31%."

**5. Add friction.** Include tradeoffs, limits, uncertainty and counterexamples. Models tuned for agreeableness present clean solutions and consensus positions; real expertise includes what fails and who disagrees.

**6. Add authorship.** Insert lived observation, domain knowledge and a point of view only this writer has. Generic prose has no location, no history and no reason for existing beyond its prompt.

**7. Change cadence.** Break symmetrical rhythm: three parallel sentences, evenly sized paragraphs, a connector on every sentence. Vary length unpredictably; let one sentence be short.

**8. Replace transition.** Models default to "Moreover", "Furthermore" and "Additionally" regardless of the real relationship. Decide whether the next sentence adds, contrasts, causes or qualifies, and use the connector that says so, or none.

## Two tests

**The specificity test.** Can you replace every evaluative word with *who did what, when, with what result*? If yes, the rewrite will be stronger. Work to the deepest level of specificity the writer can honestly supply; do not invent detail.

**The density test.** Count flagged markers per paragraph of about 100 words. Two or more is worth an editorial look. Five or more usually means the paragraph should be restructured, not patched. No single marker proves anything: "moreover" is ordinary English and "delve" appeared in human writing before 2022. The signal is clustering. Use the test to decide where to spend effort, never to accuse the writer.

## Voice, in three parts

- **Friction.** Take positions, state preferences, admit what failed: "I was wrong about this."
- **Asymmetry.** Let the structure be irregular. Circle back. Give a point its own one-line paragraph.
- **Lived knowledge.** The strongest claims are ones only the author could make: the observation from a particular room, the pattern across a specific set of records.

## A prompt you can give your own LLM

Paste this with the passage, the diagnosis from `prosodeus constrain`, and the relevant category files:

```
Revise the passage below. Keep every factual claim and the author's meaning; do not add
facts that are not in the passage or that I did not supply. For each flagged sentence,
apply the strategies in the attached category files: prefer deleting filler, then
specifying, then reframing. Vary sentence length. Do not replace one stock phrase with
another. If a sentence cannot be made specific without new information, leave it and add
a bracketed note saying what information is missing.
```

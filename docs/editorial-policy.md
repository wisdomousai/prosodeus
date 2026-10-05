# Editorial policy: diagnose prose, never accuse people

Prosodeus finds structural and lexical uniformity in text and helps you fix it. It does not, and cannot, tell you who or what wrote something. Please use it that way.

## Why phrase-matching cannot prove authorship

Every phrase on a hit list has human precedent. Language models learned these patterns from people. A formulaic essay opening is the structure writing instructors have taught for decades, so flagging it says more about the prompt's blandness than about where the prose came from.

Detection tools have a poor record on exactly this question:

- OpenAI withdrew its own AI-text classifier in July 2023 for low accuracy. At launch it correctly identified 26% of AI-written text while wrongly labelling 9% of human-written text as AI-written.
- Liang et al. (*Patterns*, 2023) tested seven widely used GPT detectors on TOEFL essays written by non-native English speakers. On average the detectors misclassified 61.22% of them as AI-generated, while they were near-perfect on essays by US 8th graders.
- Weber-Wulff et al. (2023) tested a range of detection tools and concluded that they were neither accurate nor reliable.

Prosodeus uses lexical hits and density as editing signals, which is a weaker claim than "this was generated". A false positive costs you a few seconds. A false accusation can cost someone their standing.

## Who false positives land on

The patterns Prosodeus flags overlap with legitimate writing styles: non-native English writers, people writing formal academic or technical prose, writers who use grammar tools, and writers working in a genre with fixed conventions. Treat a hit on any of them as a style observation.

## What to do instead

- **Edit toward specificity.** Ask what specific claim a flagged sentence is hiding and supply it. That helps every writer, whatever produced the draft.
- **Use clusters, not single hits.** One marker means almost nothing. See the density test in [`instructions/strategies.md`](../instructions/strategies.md).
- **Keep humans in the decision.** Never base a penalty, rejection or accusation on this tool's output. If authorship is genuinely in doubt, look at process evidence such as drafts, revision history and a conversation with the author.
- **Do not use it to evade detectors.** Prosodeus is not a humanizer and makes no claim about any detector's verdict. Its goal is better prose.

## Sources

- Liang, Yuksekgonul, Mao, Wu, Zou. *GPT detectors are biased against non-native English writers.* Patterns, 2023.
- OpenAI. *New AI classifier for indicating AI-written text* (Jan 2023), and its July 2023 update noting the classifier was no longer available because of its low rate of accuracy.
- Weber-Wulff et al. *Testing of detection tools for AI-generated text.* International Journal for Educational Integrity, 2023.

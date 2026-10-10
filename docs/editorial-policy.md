# Editorial policy

Prosodeus finds repeated phrases and repetitive sentence structure in a text and helps you revise them. It cannot tell you who or what wrote the text. Please don't use it for that.

## Why phrase-matching cannot prove authorship

Models learned every phrase on the hit lists from human writing. Writing instructors have taught the formulaic essay opening for decades. When the tool flags one, it tells you the opening is bland, and nothing about where it came from.

Detection tools have done badly at telling human and machine text apart:

- OpenAI withdrew its own AI-text classifier in July 2023 for low accuracy. In its launch test it caught 26% of AI-written text and flagged 9% of human-written text by mistake.
- Liang et al. (*Patterns*, 2023) tested seven widely used GPT detectors on TOEFL essays written by non-native English speakers. On average the detectors misclassified 61.22% of them as AI-generated. On essays by US 8th graders they were close to perfect.
- Weber-Wulff et al. (2023) tested a range of detection tools and found them inaccurate and unreliable.

Prosodeus reports phrase hits and how densely they occur, as a guide to editing. That is a much smaller claim than "a model wrote this". A student accused on the strength of a flag can lose a grade over a phrase that plenty of people write.

## Whose writing gets flagged wrongly

The patterns overlap with several legitimate styles: writing by non-native English speakers, formal academic and technical prose, text that has been through a grammar checker, and genres with fixed conventions. A hit on any of these is a remark about style.

## What to do instead

For each flagged sentence, find the fact it leaves out and add it; the draft gets better whether a person or a model wrote it, and you never have to decide which. The density test in [`instructions/strategies.md`](../instructions/strategies.md) tells you which paragraphs to start with.

Do not base a penalty, rejection or accusation on this tool's output. If you need to know who wrote something, the drafts and revision history will tell you more, and so will the author.

Prosodeus has no model of how detectors score text, so it is no help in getting past one.

## Sources

- Liang, Yuksekgonul, Mao, Wu, Zou. *GPT detectors are biased against non-native English writers.* Patterns, 2023.
- OpenAI. *New AI classifier for indicating AI-written text* (Jan 2023), and its July 2023 update noting the classifier was no longer available because of its low rate of accuracy.
- Weber-Wulff et al. *Testing of detection tools for AI-generated text.* International Journal for Educational Integrity, 2023.

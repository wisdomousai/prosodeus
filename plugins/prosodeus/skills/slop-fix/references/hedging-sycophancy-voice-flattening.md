# Hedging, sycophancy and voice flattening

> Modal constructions, parenthetical hedges, sycophastic agreement patterns, and pseudo-empathy creating an aura of analytical caution without epistemic refinement.

**Hit list:** [`hitlists/hedging-sycophancy-voice-flattening.json`](../hitlists/hedging-sycophancy-voice-flattening.json)  
**Signal strength:** Moderate; strong for sycophastic openers  
**False-positive risk:** Medium — hedging is discipline-specific  

## Why it reads as slop

AI prose exhibits significantly higher hedging frequency (mean 11.0 vs. human 6.77) and near-zero booster usage. Impersonal constructions (*It is believed that, There is evidence to suggest*) strip agency from claims. Sycophastic preambles (*That’s a great question!*) agree before responding, creating unnecessary flattery. Pseudo-empathy (*I understand how frustrating this must be*) simulates emotional attunement without genuine affect. The result is prose that sounds careful but says less than careful prose should.

## What it looks like

*There is evidence to suggest* — triple-hedge diluting commitment to rhetorical vapor. *That’s a great question!* — nearly deterministic LLM signal; unearned and templated. *It is not uncommon* — double-negative hedge avoiding a direct claim. *I understand how frustrating this must be* — simulated empathy without affective grounding.

## How to rewrite it

Apply these strategies from [strategies.md](strategies.md), in this order of preference:

- **Reframe**: rebuild the sentence around the actual claim instead of patching the filler.
- **Add friction**: add tradeoffs, limits, uncertainty and counterexamples.
- **Delete**: remove the filler phrase; if the sentence reads clearly without it, it never needed it.

Use the `replacement` field in the hit list as a starting point, not a drop-in. A replacement that does not carry a real fact is just a different filler phrase.

## When not to flag it

A single hit is a prompt to check the sentence, not a verdict. Flag a passage when markers cluster (two or more per 100 words is worth a look, five or more is a strong signal) and when the text could have said something more specific. Never treat a hit as evidence of who or what wrote the text. See [the editorial policy](../docs/editorial-policy.md).

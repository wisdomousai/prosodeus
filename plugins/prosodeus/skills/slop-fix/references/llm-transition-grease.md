# LLM transition grease

> Smooth but bland connective tissue — mechanical discourse markers, filler transitions, and default connectors signaling RLHF-polished prose.

**Hit list:** [`hitlists/llm-transition-grease.json`](../hitlists/llm-transition-grease.json)  
**Signal strength:** Strong contextual  
**False-positive risk:** Medium — clustering rates exceed human baseline  

## Why it reads as slop

LLMs deploy additive transitions (*Moreover, Furthermore, Additionally*), emphasis transitions (*It is worth noting, Crucially*), hedged transitions (*One might argue*), and signposting filler (*In this context, Going forward*) at rates 3-5x above human baseline. The mechanical patterning creates a metronome-like cadence: every paragraph receives an explicit connector regardless of the actual logical relationship. Prose flows smoothly but never develops momentum.

## What it looks like

*Moreover* — stacks points without genuine progression. *It is worth noting* — pads prose without adding weight. *Additionally* — default connector when the model cannot determine a precise relationship. *One might argue* — introduces objections without committing to them. *Before we proceed* — meta-commentary creating an artificial shared journey.

## How to rewrite it

Apply these strategies from [strategies.md](strategies.md), in this order of preference:

- **Delete**: remove the filler phrase; if the sentence reads clearly without it, it never needed it.
- **Replace transition**: diagnose the logical relationship and use the connector that expresses it.
- **Change cadence**: break symmetrical rhythm; vary sentence and paragraph length.

Use the `replacement` field in the hit list as a starting point, not a drop-in. A replacement that does not carry a real fact is just a different filler phrase.

## When not to flag it

A single hit is a prompt to check the sentence, not a verdict. Flag a passage when markers cluster (two or more per 100 words is worth a look, five or more is a strong signal) and when the text could have said something more specific. Never treat a hit as evidence of who or what wrote the text. See [the editorial policy](../docs/editorial-policy.md).

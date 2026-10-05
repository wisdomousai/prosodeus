# Synthetic significance markers

> Phrases that artificially inflate importance without adding concrete information — hyperbolic adjectives, significance claims, superlatives, and impact verbs.

**Hit list:** [`hitlists/synthetic-significance-markers.json`](../hitlists/synthetic-significance-markers.json)  
**Signal strength:** Strong contextual  
**False-positive risk:** Medium  

## Why it reads as slop

This category works by stapling hyperbolic adjectives to generic nouns. The modifier (*groundbreaking, revolutionary, transformative*) demands evidentiary support the noun phrase never supplies. Peer-reviewed data confirms focal words at Z-scores >3.5 in PubMed abstracts.

## What it looks like

*Groundbreaking* — “This groundbreaking study reveals new insights” (no concrete discovery named). *Transformative* — “AI represents a transformative shift in education” (no transformation described). *The importance of X cannot be overstated* — a self-defeating figure signaling padding. *Unlock potential* — a locksmith metaphor applied to an unfalsifiable abstraction. *Ushers in a new era* — historical-period metaphor with no period boundaries.

## How to rewrite it

Apply these strategies from [strategies.md](strategies.md), in this order of preference:

- **Specify**: replace abstraction with concrete nouns, dates, people and mechanisms: who did what, when, with what result.
- **De-hype**: replace the amplifier with the measured effect.
- **Delete**: remove the filler phrase; if the sentence reads clearly without it, it never needed it.

Use the `replacement` field in the hit list as a starting point, not a drop-in. A replacement that does not carry a real fact is just a different filler phrase.

## When not to flag it

A single hit is a prompt to check the sentence, not a verdict. Flag a passage when markers cluster (two or more per 100 words is worth a look, five or more is a strong signal) and when the text could have said something more specific. Never treat a hit as evidence of who or what wrote the text. See [the editorial policy](../docs/editorial-policy.md).

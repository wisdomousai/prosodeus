# Motivational uplift residue

> Inspirational filler giving everything a TED-talk aftertaste — empowerment verbs, aspirational nouns, and self-help discourse that migrated into business and academic writing via LLMs.

**Hit list:** [`hitlists/motivational-uplift-residue.json`](../hitlists/motivational-uplift-residue.json)  
**Signal strength:** Moderate; strong for exact formulaic phrases  
**False-positive risk:** High — self-help register overlaps with genuine encouragement  

## Why it reads as slop

Vauhini Vara characterized LLM voice as “polite, predictable, inoffensive, upbeat.” This category captures that tonal residue. *Journey* transforms any process into a vague odyssey. *Unlock your potential* promises transformation without defining its form. The mechanism is emotional resonance without informational content — what inspires in a keynote sounds hollow in an analytical report.

## What it looks like

*Journey* — strips away timelines, deliverables, and measurable outcomes. *Unlock your potential* — potential is unmeasurable; “unlock” implies the vendor holds the key. *The power of [noun]* — mystifies a learnable skill as a latent force. *Best version of yourself* — implies a Platonic ideal self. *Everything happens for a reason* — post-hoc rationalization dressed as wisdom.

## How to rewrite it

Apply these strategies from [strategies.md](strategies.md), in this order of preference:

- **De-hype**: replace the amplifier with the measured effect.
- **Add friction**: add tradeoffs, limits, uncertainty and counterexamples.
- **Specify**: replace abstraction with concrete nouns, dates, people and mechanisms: who did what, when, with what result.

Use the `replacement` field in the hit list as a starting point, not a drop-in. A replacement that does not carry a real fact is just a different filler phrase.

## When not to flag it

A single hit is a prompt to check the sentence, not a verdict. Flag a passage when markers cluster (two or more per 100 words is worth a look, five or more is a strong signal) and when the text could have said something more specific. Never treat a hit as evidence of who or what wrote the text. See [the editorial policy](../docs/editorial-policy.md).

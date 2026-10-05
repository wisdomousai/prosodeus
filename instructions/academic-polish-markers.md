# Academic polish markers

> Terms overrepresented in LLM-assisted academic prose — formal verbs, erudite adjectives, excess nouns, and scholarly adverbs signaling RLHF-polished register.

**Hit list:** [`hitlists/academic-polish-markers.json`](../hitlists/academic-polish-markers.json)  
**Signal strength:** Strong contextual  
**False-positive risk:** Medium — some words are always fine in methodology sections  

## Why it reads as slop

This category, the strongest-evidenced in the dataset, captures words that spiked in peer-reviewed literature after LLM availability. *Delve* (28.0x pre-LLM baseline), *underscore* (13.8x), *showcasing* (10.7x), and *meticulous* (654% increase) all appeared at rates far exceeding pre-2023 norms. Kobak et al. (2025) estimated at least 13.5% of 2024 PubMed abstracts were LLM-assisted, rising to ~40% in some subcorpora.

## What it looks like

*Delve* — highest-known excess ratio (r=28.0); the single strongest LLM marker in academic writing. *Underscore* — 13.8x baseline; academics rarely “underscore” findings. *Showcase* — academic writing presents results, it does not “showcase” them. *Tapestry* — virtually absent from pre-2023 academic prose; near-certain LLM signal. *Realm* — LLM-favored spatial metaphor for fields of study.

## How to rewrite it

Apply these strategies from [strategies.md](strategies.md), in this order of preference:

- **Specify**: replace abstraction with concrete nouns, dates, people and mechanisms: who did what, when, with what result.
- **Delete**: remove the filler phrase; if the sentence reads clearly without it, it never needed it.

Use the `replacement` field in the hit list as a starting point, not a drop-in. A replacement that does not carry a real fact is just a different filler phrase.

## When not to flag it

A single hit is a prompt to check the sentence, not a verdict. Flag a passage when markers cluster (two or more per 100 words is worth a look, five or more is a strong signal) and when the text could have said something more specific. Never treat a hit as evidence of who or what wrote the text. See [the editorial policy](../docs/editorial-policy.md).

# Model-family specific markers

> Recognizable quirks tied to specific model families — statistical residue that can probabilistically attribute text to its likely source.

**Hit list:** [`hitlists/model-specific-markers.json`](../hitlists/model-specific-markers.json)  
**Signal strength:** Strong contextual  
**False-positive risk:** Medium — markers are probabilistic; outputs converge over time  

## Why it reads as slop

Each major LLM family develops lexical fingerprints through training data, RLHF methodology, and constitutional constraints. ChatGPT/GPT outputs feature 21 focal words (*delve, intricate, commendable, meticulous, tapestry, realm, navigate*) and default to intro-triplet-recap structure. Claude/Anthropic outputs favor hedging register (*It’s worth noting, Generally speaking*). Gemini/Google outputs show the highest Verbal Tic Index (0.590) and largest stylistic drift from human baseline. Stylometric classifiers achieve F1=0.9988.

## What it looks like

*Delve* — #1 ChatGPT focal word; 28x pre-LLM baseline. *It’s worth noting* — signature Claude hedging register. *Generally speaking* — Claude’s epistemic humility marker. *Bustling* — known GPT-crutch adjective for cities. *First…Second…Third…Finally* — RLHF-enumerated structure with mechanical regularity.

## How to rewrite it

Apply these strategies from [strategies.md](strategies.md), in this order of preference:

- **Delete**: remove the filler phrase; if the sentence reads clearly without it, it never needed it.
- **Specify**: replace abstraction with concrete nouns, dates, people and mechanisms: who did what, when, with what result.
- **Add authorship**: add lived observation, domain knowledge and a point of view only the writer has.

Use the `replacement` field in the hit list as a starting point, not a drop-in. A replacement that does not carry a real fact is just a different filler phrase.

## When not to flag it

A single hit is a prompt to check the sentence, not a verdict. Flag a passage when markers cluster (two or more per 100 words is worth a look, five or more is a strong signal) and when the text could have said something more specific. Never treat a hit as evidence of who or what wrote the text. See [the editorial policy](../docs/editorial-policy.md).

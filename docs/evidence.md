# Evidence and its limits

What the hit lists are based on and where that evidence is thin. Read this before you treat any marker as a strong signal.

## What is well supported

**Some vocabulary shifted after LLMs became common.** Kobak et al. (*Science Advances*, 2025) compared word frequencies across roughly 15 million PubMed abstracts from 2010 to 2024. Using a method modelled on excess-mortality estimates, they found 379 words whose use jumped in 2024. Most were style words like "delves". Few had anything to do with medicine. The vocabulary categories rely mainly on this study, in particular [academic polish](../instructions/academic-polish-markers.md) and [synthetic significance](../instructions/synthetic-significance-markers.md).

**Connector overuse has weaker support.** A study cited in the source material for [transition grease](../instructions/llm-transition-grease.md) found that ChatGPT essays use "Moreover" and "Furthermore" more often than essays by people. We have not checked that study ourselves, so use the category as an editing heuristic.

**Detectors are unreliable and biased.** See the [editorial policy](editorial-policy.md).

## What is weaker

**Nobody has checked the hit lists entry by entry.** The 1,000-phrase dataset and the regex families behind `hitlists/` and `core/src/taxonomy/llm-marker-*` were built with LLM-assisted research. Each entry records a `signal`, an `fp_risk` and an `evidence` label. The `evidence` field says where the claim came from. It does not mean the claim was confirmed.

**We only quote figures from the papers.** When we built this repo, one headline statistic in the source material disagreed with the primary paper: the count of "excess words" in the Kobak study. Every figure in these docs comes from a paper.

**The lists will go out of date.** Model updates change which words come out, and writers who learn that a word gets flagged stop using it. Sentences that make no checkable claim will last longer than any particular word, and the rewrite guidance is aimed at those. It asks for a specific fact before it suggests a different word.

**The model-specific category cannot identify a model.** Labs train their models in similar ways, especially at the preference-tuning stage, so a phrase seen mostly in one family often turns up in others. The [model-specific markers](../instructions/model-specific-markers.md) describe habits associated with a family. Several of those associations were marked provisional in the source material.

## How the tiers work

Each hit-list entry gets a tier from its `signal` and `fp_risk`:

| Tier | Rule | How to treat it |
|---|---|---|
| `strong` | strong contextual signal and low or medium false-positive risk | Can be flagged alone. More telling next to other hits |
| `moderate` | moderate signal, or strong signal with other caveats | Flag only alongside other hits |
| `watch` | weak signal or high false-positive risk | Common in ordinary writing. Never flag it alone |

Tiers are labels for human readers and for the prompts given to models. The analysis engine ignores them when it scores a document.

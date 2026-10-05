# Evidence and its limits

What backs the hit lists, and what does not. Read this before treating any marker as a strong signal.

## What is well supported

**Some vocabulary shifted after LLMs became common.** Kobak et al. (*Science Advances*, 2025) compared word frequencies across roughly 15 million PubMed abstracts from 2010 to 2024. Using an approach modelled on excess mortality, they found 379 words whose use jumped in 2024, overwhelmingly style words (verbs and adjectives such as "showcasing", "pivotal" and "delves") and not content words. This is the strongest basis for the lexical categories, especially [academic polish](../instructions/academic-polish-markers.md) and [synthetic significance](../instructions/synthetic-significance-markers.md).

**Connector overuse is plausible but less firmly established.** The source material for [transition grease](../instructions/llm-transition-grease.md) reports ChatGPT-written essays using discourse markers ("Moreover", "Furthermore", "Additionally") more often than human baselines. We have not re-verified that study or its multiples, so treat the category as an editing heuristic.

**Detectors are unreliable and biased.** See the [editorial policy](editorial-policy.md).

## What is weaker

**The hit lists are a heuristic snapshot.** The 1,000-phrase dataset and the regex families behind `hitlists/` and `core/src/taxonomy/llm-marker-*` came from LLM-assisted research runs and were not independently re-verified item by item. Each entry carries a `signal`, an `fp_risk` and an `evidence` label so you can weigh it; the `evidence` field records where the claim came from, not a guarantee.

**Individual numbers from those runs should not be quoted.** In building this repo we found at least one headline statistic in the source material that disagrees with the primary paper (the count of "excess words" in the Kobak study), so we cite the paper, not the summary.

**Word lists decay.** Model updates change output distributions, and writers who know a word is a tell stop using it. What endures is the principle behind the lists: generic language that needs no facts. That is why the rewrite guidance centres on specificity and not on swapping words.

**Model-family attribution is guesswork.** Shared training methods (preference tuning in particular) produce similar patterns across model families, so a phrase seen mostly in one family often appears in others. The [model-specific markers](../instructions/model-specific-markers.md) category is useful for understanding style, not for deciding which model wrote something, and several associations in the source material were marked provisional.

## How the tiers work

Each hit-list entry has a tier derived from its `signal` and `fp_risk`:

| Tier | Rule | How to treat it |
|---|---|---|
| `strong` | strong contextual signal and low or medium false-positive risk | Worth a look on its own; most diagnostic when it clusters with others |
| `moderate` | moderate signal, or strong signal with other caveats | Look only when it clusters |
| `watch` | weak signal or high false-positive risk | Never flag alone; common in ordinary human writing |

Tiers are advisory labels for people and for LLM instructions. They do not change how the analysis engine scores a document.

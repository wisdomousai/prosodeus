# Instructions

Plain-language guidance for turning a Prosodeus diagnosis into a better draft. These files are what you hand to your own LLM, and what the plugin skills load.

| File | Use it for |
|---|---|
| [`strategies.md`](strategies.md) | The eight rewrite strategies, the specificity and density tests, and a prompt template. Start here. |
| One file per category (below) | Why a pattern reads as slop, what it looks like, which strategies fix it, and when *not* to flag it. |

Each category file has a matching hit list in [`../hitlists/`](../hitlists/) with the individual phrases, their signal strength, false-positive risk and suggested replacements.

## Categories

- [Synthetic significance markers](synthetic-significance-markers.md)
- [Generic framing fog](generic-framing-fog.md)
- [LLM transition grease](llm-transition-grease.md)
- [False nuance and complexity theater](false-nuance-complexity-theater.md)
- [Corporate gloss and strategy vapor](corporate-gloss-strategy-vapor.md)
- [Academic polish markers](academic-polish-markers.md)
- [Motivational uplift residue](motivational-uplift-residue.md)
- [SEO slop and content-farm fragments](seo-slop-fragments.md)
- [Symmetrical sentence templates](symmetrical-sentence-templates.md)
- [Boilerplate, empty conclusions and persona flattening](boilerplate-conclusions-persona.md)
- [Hedging, sycophancy and voice flattening](hedging-sycophancy-voice-flattening.md)
- [Model-family specific markers](model-specific-markers.md)

## Using them

1. Run `prosodeus report essay.txt` to see where the heat is, and `prosodeus constrain essay.txt` for the structural diagnosis.
2. Give your LLM the passage, the diagnosis, `strategies.md`, and the category files for the patterns that fired.
3. Run `prosodeus compare original.txt revised.txt` to check that the revision actually moved the metrics.

These are heuristics for editing. They are not a way to decide who or what wrote a text; read the [editorial policy](../docs/editorial-policy.md).

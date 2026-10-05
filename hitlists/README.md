# Hit lists

1,000 phrases that tend to cluster in generic, model-written prose, split into 12 categories. Each file pairs with a guidance file in [`../instructions/`](../instructions/) that explains how to rewrite what the list finds.

These are editing aids. A phrase on a list has human precedent, so a hit is never proof of who wrote a text. Read [`../docs/editorial-policy.md`](../docs/editorial-policy.md) and [`../docs/evidence.md`](../docs/evidence.md) before using them for anything but editing.

## Files

`index.json` lists every category with its entry count and tier counts. `<category>.json` holds the entries:

```json
{
  "id": "D01-001",
  "phrase": "groundbreaking",
  "alternatives": ["groundbreaking"],
  "subcategory": "hyperbolic_adjective",
  "tier": "strong",
  "signal": "strong contextual",
  "fp_risk": "medium",
  "evidence": "peer-reviewed",
  "replacement": "first to demonstrate / that overturned prior assumptions",
  "genres": "tech marketing, academic abstracts"
}
```

| Field | Meaning |
|---|---|
| `phrase` | The phrase as written in the source dataset. |
| `alternatives` | The individual wordings inside `phrase` (it can hold several, separated by `/`). Quote marks and export damage are stripped. |
| `subcategory` | The matcher family in `packages/core/src/taxonomy/llm-marker-matchers.ts` that detects it. |
| `tier` | `strong`, `moderate` or `watch`. See below. |
| `signal`, `fp_risk` | The dataset's own labels for how diagnostic the phrase is and how often ordinary human writing uses it. |
| `evidence` | Where the claim came from. This is a provenance label, not a guarantee. |
| `replacement` | A direction for the rewrite, not a drop-in swap. Swapping a stock phrase for another stock phrase fixes nothing; see [`../instructions/strategies.md`](../instructions/strategies.md). |
| `genres` | Genres where the phrase is common. Useful for judging false positives. |

## Tiers

| Tier | Rule | Treat it as |
|---|---|---|
| `strong` | strong contextual signal, low or medium false-positive risk | worth a look on its own, most useful when it clusters |
| `moderate` | everything in between | look only when it clusters |
| `watch` | weak signal or high false-positive risk | never flag alone |

Tiers are advisory. They do not change how the analysis engine scores a document.

## Flags you may see

- `template: true`. The phrase is a pattern with a slot, such as `not only X but also Y`. It is listed for people and LLMs but is not turned into a matcher.
- `truncated: true`. The source export cut the phrase off at its column width. The surviving alternatives are kept, and the incomplete one is not matched.
- `replacement_truncated: true`. The same cut-off happened to the suggested replacement. Treat the text as a hint.

## Regenerating

The lists and the matchers come from the fixtures in `scripts/fixtures/llm-markers/` through one script:

```bash
python3 scripts/ingest-llm-markers.py
```

`packages/core/tests/hitlists.test.ts` and `llm-marker-matchers.test.ts` check that every usable phrase matches its own subcategory and that no matcher contains export damage. Run `bun run test` after regenerating.

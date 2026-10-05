# LLM marker taxonomy: source fixtures

The source data for the LLM marker taxonomy. `scripts/ingest-llm-markers.py` reads these files and generates both the engine's matchers and the public hit lists.

## Files

- `llm_marker_indicators.json`: one record per indicator (1,000 total), grouped into 62 subcategories. The source export is fixed-width, so some phrases and replacements are cut off at the column width, and some contain stray quote marks. The ingest script cleans these.
- `regex_pattern_families.slim.json`: 115 regex pattern families.
- `regex_mechanisms.slim.json`: 60 regex mechanisms.
- `README-oai-bundle.md`: the README that came with the regex bundle.

## Regenerate

```bash
python3 scripts/ingest-llm-markers.py
bun run test
```

This writes:

- `packages/core/src/taxonomy/llm-marker-patterns.ts`
- `packages/core/src/taxonomy/llm-marker-matchers.ts`
- `packages/core/src/taxonomy/llm-marker-enrichment.json`
- `hitlists/*.json` and `hitlists/index.json` (see [`hitlists/README.md`](../../../hitlists/README.md))

Truncated or templated phrases are kept in the hit lists but skipped for matching. Regexes that can never match, such as a start anchor after text, are dropped.

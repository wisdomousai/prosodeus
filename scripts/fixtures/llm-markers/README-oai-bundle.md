# AI-slop regex over-catch dataset

This package adds one or more regex matchers to every normalized mechanism, pattern family, and surface variant.

## Core rule
Regex is a recall layer, not a verdict layer. The matchers intentionally over-catch candidates; an LLM or human editor should assess each match in context.

## Files
- `ai_slop_regex_overcatch_matchers.csv` / `.jsonl`: one row per regex matcher.
- `ai_slop_regex_overcatch_pattern_families.csv` / `.json`: 115 pattern families with surface and over-catch regexes.
- `ai_slop_regex_overcatch_surface_variants.csv` / `.jsonl`: 3,004 surface variants with exact-ish regexes and inherited family matcher IDs.
- `ai_slop_regex_overcatch_mechanisms.csv` / `.json`: 60 mechanism records with coarse category/subcategory regex routers.
- `ai_slop_regex_overcatch_schema.json`: schema and intended use.
- `ai_slop_regex_overcatch_audit.json`: coverage, compile validation, duplicate checks, and spot checks.

## Matching behavior
- Case-insensitive via inline `(?i)`.
- Flexible spaces and non-breaking spaces.
- Straight and curly apostrophes are treated as equivalent.
- Hyphen/dash variants are tolerated.
- Placeholder templates like `X`, `Y`, and `Z` are converted to bounded wildcard spans.
- Regex patterns are not required to be unique; multiple entities may share a broad router.

## Recommended workflow
1. Run surface, family, or mechanism regexes over a text.
2. Deduplicate nearby hits by family and mechanism.
3. Send the matched span, paragraph context, genre, and family metadata to an LLM/human reviewer.
4. Classify the usage as acceptable, cliché, low-specificity, over-polished, or slop-like.
5. Suggest a concrete revision only when the phrase is not doing enough work.

## Safety note
Do not use this package as an AI detector. It is an editorial resource for finding generic, inflated, or over-smoothed prose. AI use can coexist with serious human work, and phrase matching alone cannot establish authorship.

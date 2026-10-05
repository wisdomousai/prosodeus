# Contributing

Thanks for helping. This is a small project; the checks below keep it that way.

## Setup

```bash
bun install
bun run ci        # typecheck, tests, lint, boundaries
```

You need Bun. The CLI and MCP run on Node 18+ once built, but development uses Bun.

## What to send

- **Bug fixes and small improvements** to the engine, CLI, MCP, app or worker. Include a test when behaviour changes.
- **Hit-list corrections.** The phrase data is generated; do not edit `hitlists/*.json` or `core/src/taxonomy/llm-marker-*` by hand. Change `scripts/fixtures/llm-markers/` or `scripts/ingest-llm-markers.py`, run `python3 scripts/ingest-llm-markers.py`, then `bun run test`. The tests check that every usable phrase matches its own subcategory.
- **Instructions.** `instructions/` is plain guidance for editors and LLMs. After changing it, copy the files to `plugins/prosodeus/skills/slop-fix/references/` (`cp instructions/*.md plugins/prosodeus/skills/slop-fix/references/`); a test fails if they drift.
- **Evidence.** If you add a statistic to the docs, cite the primary source and say what it measured. Prefer saying less.

For anything larger, open an issue first.

## Ground rules

- No new NLP libraries; classification goes through the LLM classifier.
- Keep `@prosodeus/core/browser` browser-safe and respect the boundaries in `docs/repo-structure.md`.
- Never commit keys, tokens, `.dev.vars`, `.env` files or local databases.
- The tool diagnoses prose. Do not add features or wording that present a hit as proof of authorship or that promise to defeat detectors. See `docs/editorial-policy.md`.

## Before you open a PR

```bash
bun run ci
```

Biome formats the code: `bunx biome check --write .`.

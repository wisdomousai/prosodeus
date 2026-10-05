# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project overview

Prosodeus finds generic, uniform, model-sounding prose and helps rewrite it. It measures the density, distribution and co-occurrence of patterns across a document, shows them as a heatmap, and produces structural constraints or a rewrite. It diagnoses prose; it makes no claim about who or what wrote a text and is not a detector-evasion tool. See `docs/editorial-policy.md`.

## Architecture

- **An LLM classifier replaces the NLP stack.** One small-model call per sentence returns structured tags (pattern detection, Biber dimension tags, metrics). No spaCy, PyBiber or Polars.
- **Sentence hashing.** Each sentence is hashed and its classification cached, so re-analysis after an edit only classifies changed sentences.
- **Constraints and rewrite.** The engine generates structural constraints for any LLM, and can also run the rewrite itself (`rewrite`, `rewrite_passage`) with the user's own model key.
- **Equilibrium engine.** Cheaper models simulate structural rewrites to find a document-level target before a stronger model rewrites once.
- **Prefix caching.** The stable system prompt goes first, the varying sentence last.
- **Paragraph purpose drives treatment.** Argues, narrates, analyzes and transitions get different structural targets.

## Tech stack

TypeScript on Bun (package manager and test runner) with Node 18+ support for the published CLI and MCP bundles. commander (CLI), native `fetch`, `@modelcontextprotocol/sdk` (MCP), Hono + Drizzle + Postgres + Durable Objects (worker), Vite + React + shadcn/ui (app), Electron (desktop).

## Commands

```bash
bun install
bun run build          # all workspaces, via Turborepo
bun run test
bun run typecheck
bun run lint           # biome check .
bun run ci             # typecheck + test + lint + boundaries
bun run check:boundaries

bun run dev            # app on :5173, dev API on :8788
bun run dev:desktop    # the same, plus the Electron shell

bun packages/cli/src/cli.ts analyze <file>
bun packages/cli/src/cli.ts report <file> --output report.html
```

## Project structure

```
packages/core/          @prosodeus/core: analysis engine, taxonomy, rewrite policy, model routing
  src/analysis/         document analysis, windows, profiles, hot sentences, style guides
  src/classification/   LLM classifiers, gate/medium tiers, classify pipeline
  src/models/           model routing, provider behavior, Codex/Moonshot adapters
  src/rewrite/          rewrite pipeline, suggestions, PCE, rewrite policy
  src/storage/          caches, document store, DB schema/adapters
  src/text/             splitting, text metrics, ProseMirror text extraction
  src/taxonomy/         pattern registry; llm-marker-* files are generated
packages/shared/        @prosodeus/shared: WSClient, ApiClient, transport payloads
packages/mcp/           @prosodeus/mcp: MCP server over the core engine
packages/cli/           @prosodeus/cli: command line over the core engine
apps/app/               Vite + React + shadcn/ui frontend
apps/desktop/           Electron shell wrapping the app build
apps/worker/            self-hostable API (Hono, Postgres, Durable Objects)
hitlists/               phrase lists with tiers, generated from scripts/fixtures/llm-markers
instructions/           rewrite guidance per hit-list category
plugins/prosodeus/      Claude Code and Codex plugin
```

Turborepo orchestrates workspace tasks, Biome lints and formats, and every workspace extends `tsconfig.base.json`. Internal packages are consumed as source (exports point at `src/*.ts`); only the CLI and MCP are bundled, with `bun build --target node`.

## Boundaries

- `packages/core` must not import `@prosodeus/shared`; shared may import and re-export core types.
- Apps import package entrypoints only (`@prosodeus/core/browser`, `/node`, `@prosodeus/shared/browser`), not package internals.
- `@prosodeus/core/browser` stays browser-safe: no storage, DB or child-process adapters.
- Run `bun run check:boundaries` after structural edits.

## Generated files

`packages/core/src/taxonomy/llm-marker-{patterns,matchers}.ts`, `llm-marker-enrichment.json` and `hitlists/*.json` come from `python3 scripts/ingest-llm-markers.py`. Edit the fixtures or the script, not the output. `plugins/prosodeus/skills/slop-fix/references/` is a copy of `instructions/`; a test fails if they drift.

## Docs

- `docs/repo-structure.md`: package boundaries and import rules
- `docs/taxonomy.md`, `docs/taxonomy-expansion.md`: pattern taxonomy
- `docs/editorial-policy.md`, `docs/evidence.md`: what the tool does and does not claim
- `docs/ui-redesign-spec.md`: editor UI spec
- `docs/deployment.md`: self-hosting the API

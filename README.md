# Prosodeus

Find generic, uniform, model-sounding prose, see where it clusters, and rewrite it.

Fluent model output tends to be fluent in the same way: the same connectors, the same balanced sentences, the same stock praise and hedges. One such phrase proves nothing. Dozens of them, evenly spread across a document, read as slop. Prosodeus measures that density and distribution, shows it as a heatmap, and helps you rewrite the hot spots.

It diagnoses prose. It does not tell you who or what wrote a text, and it is not built to evade AI detectors. Read the [editorial policy](docs/editorial-policy.md) before using a result about a person.

## What you get

- **See it.** A sentence-level heatmap and a list of hot sentences, from the CLI (`report`), the editor app, or an MCP tool.
- **Rewrite it.** Structural constraints you can give to your own LLM (`constrain`), or a rewrite with before and after metrics (`rewrite`). Rewrite strategies are in [`instructions/`](instructions/).
- **Check it.** `compare` and `verify_rewrite` show whether a revision actually moved the numbers.
- **Know what it looks for.** [`hitlists/`](hitlists/) holds 1,000 phrases in 12 categories, each with a signal strength, a false-positive risk and a suggested direction. [`docs/evidence.md`](docs/evidence.md) says what is well supported and what is not.

You bring your own model key. Nothing is sent anywhere except to the provider you choose.

## Quick start (CLI)

Needs Node 18 or newer and a key for one provider.

```bash
export GROQ_API_KEY=...            # or MISTRAL_API_KEY, DEEPINFRA_API_KEY; see Providers

npx @prosodeus/cli report draft.md --output report.html   # heatmap, open in a browser
npx @prosodeus/cli analyze draft.md                       # summary in the terminal
npx @prosodeus/cli constrain draft.md > constraints.txt   # paste into your own LLM
npx @prosodeus/cli rewrite draft.md --output draft.v2.md  # rewrite with the configured model
npx @prosodeus/cli compare draft.md draft.v2.md           # did it improve?
npx @prosodeus/cli opposition draft.md                    # fix "it's not X, it's Y" formulas only
```

`--passage 4:9` limits `constrain` and `rewrite` to a sentence range. `--style <name>` compares against a style guide (`styles` lists them). `--json` gives raw output on `analyze` and `opposition`.

To work from a clone instead: `bun install`, then `bun packages/cli/src/cli.ts <command>`.

Under Node the classification cache is off, because the cache uses `bun:sqlite`. Re-analysis still works; it just re-classifies every sentence. Run under Bun for the cache.

## Use it from Claude Code or Codex

The repo is a plugin marketplace for both. The plugin adds three skills, `slop-scan`, `slop-fix` and `slop-verify`, and starts the MCP server for them.

```bash
# Claude Code
/plugin marketplace add wisdomousai/prosodeus
/plugin install prosodeus@prosodeus

# Codex
codex plugin marketplace add wisdomousai/prosodeus
codex plugin add prosodeus@prosodeus
```

The MCP server needs a provider key in the environment of the host process (for example `GROQ_API_KEY`). Choose the provider with `PROSODEUS_PROVIDER`. You can also add the server on its own: `npx -y @prosodeus/mcp`. Its tools are `screen_text`, `generate_constraints`, `rewrite_passage`, `verify_rewrite`, `list_style_guides` and `get_style_guide`.

## The editor app

A local editor with the heatmap, an inspector and a rewrite panel.

```bash
bun install
bun run dev              # app on :5173, local API on :8788
bun run dev:desktop      # the same, inside the Electron shell
```

The desktop shell is the primary surface; it keeps documents in `~/.prosodeus` and reads your provider keys from its settings. To build a macOS app: `cd apps/desktop && bun run package`. Builds are unsigned and use the default Electron icon.

To run the API on Cloudflare with Postgres, see [`docs/deployment.md`](docs/deployment.md).

## Providers

| Provider | CLI `--provider` / MCP `PROSODEUS_PROVIDER` | Environment |
|---|---|---|
| Groq (default) | `groq` | `GROQ_API_KEY` |
| Mistral | `mistral` | `MISTRAL_API_KEY` |
| DeepInfra | `deepinfra` | `DEEPINFRA_API_KEY` |
| Cloudflare Workers AI | `workers-ai` | `AI_API_KEY`, `CLOUDFLARE_ACCOUNT_ID` |
| Claude (CLI only) | `claude` | a Claude Code login, via the Agent SDK |

`PROSODEUS_PROVIDER_KEY` works in place of the provider's own key variable, and `PROSODEUS_MODEL` overrides the model. OpenAI, Gemini and Moonshot models are available in the desktop app only.

The CLI and MCP packages depend on `@anthropic-ai/claude-agent-sdk` because the core engine imports it, even if you never use the `claude` provider.

## How it works

Each sentence is hashed and classified once by a small model, which returns structured tags for the patterns it contains. The engine aggregates those tags over rolling windows to find where uniformity concentrates, then derives constraints and rewrite targets from them. Only changed sentences are re-classified after an edit.

```
packages/core/     engine: analysis, classification, rewrite, taxonomy
packages/cli/      the command line
packages/mcp/      MCP server
packages/shared/   client and transport types for the app
apps/app/          editor UI (Vite, React)
apps/desktop/      Electron shell
apps/worker/       self-hostable API (Hono, Postgres, Durable Objects)
hitlists/          phrase lists with tiers
instructions/      how to rewrite what the lists find
plugins/prosodeus/ Claude Code and Codex plugin
```

More in [`docs/repo-structure.md`](docs/repo-structure.md) and [`docs/taxonomy.md`](docs/taxonomy.md).

## Hosted version

A hosted service exists for people who would rather not run anything. It is separate from this repository; this repo is the whole open-source product and runs without it.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Report security issues as described in [`SECURITY.md`](SECURITY.md).

## License

[MIT](LICENSE)

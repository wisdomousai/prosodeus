# Self-hosting the API

The editor app talks to a small API in `apps/worker`. You can run it two ways:

1. **Locally** with `dev.ts`, a Bun server. This is the simplest path and what `bun run dev` uses.
2. **On Cloudflare** as a Worker with Durable Objects, KV, and Postgres through Hyperdrive.

You do not need either to use the CLI, the MCP server or the plugin. The desktop app also works without the API.

## Authentication: read this first

**If neither `WORKOS_CLIENT_ID` nor `JWKS_URL` is set, the API has no authentication.** Every request is treated as one fixed local user. `PROSODEUS_DEV=true` has the same effect even when those variables are set.

That is right for `localhost`. It is not safe on a network. Before you expose an instance, set `JWKS_URL` to the JWKS endpoint of your identity provider (or `WORKOS_CLIENT_ID` for WorkOS). Requests must then carry a valid bearer token, and `/api/me` returns the token's user. The app sends the bearer token stored in the browser's `localStorage` under `prosodeus_token`. The open-source app has no sign-in screen, so wiring up your own identity provider and storing its token there is on you.

## Option 1: run it locally

```bash
bun install
cp apps/worker/.dev.vars.example apps/worker/.dev.vars   # if you want to keep keys in a file
bun run dev                                               # API on :8788, app on :5173
```

Provider keys are read from the environment or from `apps/worker/.dev.vars` (`GROQ_API_KEY`, `MISTRAL_API_KEY`, `GOOGLE_API_KEY`, `MOONSHOT_API_KEY`, `AI_API_KEY` with `CLOUDFLARE_ACCOUNT_ID`). If none is set, the classifier falls back to the Claude Agent SDK and warns.

Where data lives:

- Analysis state and the classification cache are SQLite files in `~/.prosodeus/worker`. Override with `PROSODEUS_DEV_DATA_DIR`.
- Business tables (documents, templates, versions) are in memory unless you set `DATABASE_URL` to a Postgres database. **Without it, they vanish when the server stops.** The server prints a warning.

To use Postgres:

```bash
export DATABASE_URL=postgres://user:pass@localhost:5432/prosodeus
bun run db:migrate        # applies apps/worker/drizzle/*.sql
bun run dev
```

Reset everything with `bun run dev:reset`.

What the local server does not implement: the share-link, template and sync routes exist only in the Cloudflare Worker.

## Option 2: Cloudflare

You need a Cloudflare account, Wrangler, and a Postgres database (any provider; Neon works well).

```bash
cd apps/worker
cp wrangler.toml.example wrangler.toml          # wrangler.toml is gitignored

npx wrangler login
npx wrangler hyperdrive create my-db --connection-string="postgres://user:pass@host/db"
npx wrangler kv namespace create CACHE
```

Put the ids those commands print into `wrangler.toml` (`REPLACE_ME`), and set `name` to your own worker name. Then:

```bash
# schema
DATABASE_URL="postgres://user:pass@host/db" bun run db:migrate

# secrets (set only the providers you use)
npx wrangler secret put GROQ_API_KEY
npx wrangler secret put MISTRAL_API_KEY
npx wrangler secret put GOOGLE_API_KEY
npx wrangler secret put MOONSHOT_API_KEY
npx wrangler secret put AI_API_KEY
npx wrangler secret put CLOUDFLARE_ACCOUNT_ID
npx wrangler secret put JWKS_URL                 # enables auth; see above

# deploy
npx wrangler deploy
```

### Configuration

| Name | Where | Purpose |
|---|---|---|
| `HYPERDRIVE` | binding | Postgres connection |
| `CACHE` | KV binding | Shared classification cache |
| `DOCUMENT` | Durable Object binding | Per-document working state |
| `ALLOWED_ORIGINS` | var | Comma-separated CORS origins. Set to your app's origin. Defaults to `http://localhost:5173`. Also used for share URLs. |
| `JWKS_URL` or `WORKOS_CLIENT_ID` | secret | Turns authentication on |
| `PROSODEUS_DEV` | var | `true` turns authentication off. Never set it in production. |
| Provider keys | secrets | Used by the server-side classifier and rewriter |
| `CLOUDFLARE_GATEWAY_ID` | var, optional | Route Workers AI calls through an AI Gateway |

To serve the API from your own domain, uncomment the `routes` block in `wrangler.toml`.

### The app

```bash
cd apps/app
VITE_API_URL=https://api.example.com bun run build     # output in apps/app/dist
```

Host `dist/` anywhere that serves a single-page app (every path falls back to `index.html`; `public/_redirects` does this on Cloudflare Pages). Edit `public/_headers` so `connect-src` includes your API origin over both `https://` and `wss://`, and set the Worker's `ALLOWED_ORIGINS` to the app's origin.

## Migrations

The schema is in `apps/worker/src/db/schema/`. Change it, then generate and apply a migration:

```bash
bun run --cwd apps/worker db:generate
DATABASE_URL=... bun run db:migrate
```

Commit the generated SQL in `apps/worker/drizzle/`.

## Checks

```bash
bun run --cwd apps/worker test
bun run --cwd apps/worker typecheck
curl http://localhost:8788/api/me     # {"id": ..., "email": ...}
```

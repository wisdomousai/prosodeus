import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Provider } from "./byok-store.ts";

const ENV_TO_PROVIDER: Record<string, Provider> = {
  GOOGLE_API_KEY: "google",
  GROQ_API_KEY: "groq",
  MISTRAL_API_KEY: "mistral",
  MOONSHOT_API_KEY: "moonshot",
  OPENAI_API_KEY: "openai",
};

/** Dev-only: load worker `.dev.vars` when running against the Vite dev server. */
export function isDevVarsEnabled(): boolean {
  return Boolean(process.env.PROSODEUS_DEV_URL || process.env.PROSODEUS_USE_DEV_VARS === "1");
}

function resolveDevVarsPath(): string | null {
  const override = process.env.PROSODEUS_DEV_VARS_PATH;
  if (override) return existsSync(override) ? override : null;

  // Bundled main lives at apps/desktop/dist/main.js → apps/worker/.dev.vars
  const here = dirname(fileURLToPath(import.meta.url));
  const candidate = join(here, "../../worker/.dev.vars");
  return existsSync(candidate) ? candidate : null;
}

let cachedVars: Record<string, string> | null | undefined;

export function loadDevVars(): Record<string, string> {
  if (cachedVars !== undefined) return cachedVars ?? {};
  cachedVars = null;

  if (!isDevVarsEnabled()) return {};

  const path = resolveDevVarsPath();
  if (!path) {
    console.warn("[dev-vars] Dev mode on but apps/worker/.dev.vars not found");
    return {};
  }

  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^(\w+)=(.+)$/);
    if (match) out[match[1]!] = match[2]!.trim();
  }

  cachedVars = out;
  // Hydrate process.env so model-builder can read MOONSHOT_BASE_URL etc.
  for (const [key, value] of Object.entries(out)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  const providers = listDevByokProviders();
  const cf = getDevCfCredentials();
  const moonshotKey = out.MOONSHOT_API_KEY;
  const moonshotHint = moonshotKey?.startsWith("sk-kimi-")
    ? " — Kimi Code key → api.kimi.com/coding/v1"
    : moonshotKey
      ? " — Moonshot developer key → api.moonshot.ai/v1"
      : "";
  console.log(
    `[dev-vars] Loaded from ${path}` +
      (providers.length ? ` — BYOK: ${providers.join(", ")}` : "") +
      moonshotHint +
      (cf ? " — Cloudflare Workers AI" : ""),
  );
  return out;
}

export function getDevByokKey(provider: Provider): string | null {
  if (!isDevVarsEnabled()) return null;
  const vars = loadDevVars();
  for (const [envKey, prov] of Object.entries(ENV_TO_PROVIDER)) {
    if (prov === provider && vars[envKey]) return vars[envKey]!;
  }
  return null;
}

export function listDevByokProviders(): Provider[] {
  if (!isDevVarsEnabled()) return [];
  const vars = loadDevVars();
  const out: Provider[] = [];
  for (const [envKey, prov] of Object.entries(ENV_TO_PROVIDER)) {
    if (vars[envKey]) out.push(prov);
  }
  return out;
}

export function getDevCfCredentials(): { accountId: string; apiToken: string } | null {
  if (!isDevVarsEnabled()) return null;
  const vars = loadDevVars();
  const accountId = vars.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = vars.AI_API_KEY;
  if (accountId && apiToken) return { accountId, apiToken };
  return null;
}

export function devVarsStatus(): {
  active: boolean;
  path: string | null;
  providers: Provider[];
  cfConfigured: boolean;
} {
  if (!isDevVarsEnabled()) {
    return { active: false, path: null, providers: [], cfConfigured: false };
  }
  const path = resolveDevVarsPath();
  const providers = listDevByokProviders();
  const cfConfigured = getDevCfCredentials() !== null;
  return {
    active: path !== null && (providers.length > 0 || cfConfigured),
    path,
    providers,
    cfConfigured,
  };
}

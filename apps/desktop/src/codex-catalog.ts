import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  type CodexCatalogModel,
  type CodexModelConfig,
  type CodexTaskDepth,
  type CodexTaskModelSelection,
  codexModelConfigFromCatalog,
  selectCodexTaskModel,
  visibleCodexModels,
} from "@prosodeus/core/node";
import { codexBinary } from "./codex-auth.ts";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PROSODEUS_DIR = join(homedir(), ".prosodeus");
const CACHE_PATH = join(PROSODEUS_DIR, "codex-model-catalog.json");

interface CodexCatalogCache {
  fetchedAt: string;
  models: CodexCatalogModel[];
}

let inMemory: CodexCatalogCache | null = null;
let refreshPromise: Promise<CodexCatalogModel[]> | null = null;

function isFresh(cache: CodexCatalogCache): boolean {
  const ts = Date.parse(cache.fetchedAt);
  return Number.isFinite(ts) && Date.now() - ts < CACHE_TTL_MS;
}

function readCache(allowStale: boolean): CodexCatalogCache | null {
  if (inMemory && (allowStale || isFresh(inMemory))) return inMemory;
  if (!existsSync(CACHE_PATH)) return null;
  try {
    const parsed = JSON.parse(readFileSync(CACHE_PATH, "utf8")) as CodexCatalogCache;
    if (!Array.isArray(parsed.models)) return null;
    if (!allowStale && !isFresh(parsed)) return null;
    inMemory = parsed;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(models: CodexCatalogModel[]): void {
  const cache: CodexCatalogCache = { fetchedAt: new Date().toISOString(), models };
  mkdirSync(PROSODEUS_DIR, { recursive: true });
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  inMemory = cache;
}

function normalizeRawCatalog(raw: unknown): CodexCatalogModel[] {
  const models = (raw as { models?: unknown[] })?.models;
  if (!Array.isArray(models)) return [];

  return models
    .map((entry): CodexCatalogModel | null => {
      if (!entry || typeof entry !== "object") return null;
      const m = entry as Record<string, unknown>;
      const slug = typeof m.slug === "string" ? m.slug : "";
      if (!slug) return null;
      const supported = Array.isArray(m.supported_reasoning_levels)
        ? m.supported_reasoning_levels
            .map((r) => (r && typeof r === "object" ? (r as { effort?: unknown }).effort : null))
            .filter((effort): effort is string => typeof effort === "string")
        : [];
      const speedTiers = Array.isArray(m.additional_speed_tiers)
        ? m.additional_speed_tiers.filter((tier): tier is string => typeof tier === "string")
        : [];
      return {
        slug,
        displayName: typeof m.display_name === "string" ? m.display_name : slug,
        description: typeof m.description === "string" ? m.description : undefined,
        visibility: typeof m.visibility === "string" ? m.visibility : undefined,
        defaultReasoningEffort:
          typeof m.default_reasoning_level === "string" ? m.default_reasoning_level : undefined,
        supportedReasoningEfforts: supported,
        priority: typeof m.priority === "number" ? m.priority : undefined,
        additionalSpeedTiers: speedTiers,
      };
    })
    .filter((m): m is CodexCatalogModel => m !== null);
}

function parseCatalogStdout(stdout: string): CodexCatalogModel[] {
  const line = stdout.split(/\r?\n/).find((l) => l.trim().startsWith("{"));
  if (!line) return [];
  return normalizeRawCatalog(JSON.parse(line));
}

function runCodexDebugModels(): Promise<CodexCatalogModel[]> {
  return new Promise((resolve, reject) => {
    const child = spawn(codexBinary(), ["debug", "models"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error("Codex model catalog timed out"));
    }, 10_000);

    child.stdout.on("data", (chunk) => {
      out += chunk;
    });
    child.stderr.on("data", (chunk) => {
      err += chunk;
    });
    child.on("error", (e) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(e);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`codex debug models exited with code ${code}: ${err.slice(0, 400)}`));
        return;
      }
      try {
        resolve(parseCatalogStdout(out));
      } catch (e) {
        reject(e);
      }
    });
  });
}

export function getCodexCatalogSnapshot(): CodexCatalogModel[] {
  return readCache(true)?.models ?? [];
}

export async function refreshCodexCatalog(): Promise<CodexCatalogModel[]> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = runCodexDebugModels()
    .then((models) => {
      if (models.length > 0) writeCache(models);
      return models;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

export async function getCodexCatalog(): Promise<CodexCatalogModel[]> {
  const fresh = readCache(false);
  if (fresh) return fresh.models;
  try {
    return await refreshCodexCatalog();
  } catch (err) {
    const stale = readCache(true);
    if (stale) return stale.models;
    console.warn("[codex-catalog] discovery failed:", err instanceof Error ? err.message : err);
    return [];
  }
}

export function primeCodexCatalog(): void {
  void getCodexCatalog().catch((err) => {
    console.warn(
      "[codex-catalog] startup discovery failed:",
      err instanceof Error ? err.message : err,
    );
  });
}

export async function listCodexModelConfigs(): Promise<CodexModelConfig[]> {
  const models = visibleCodexModels(await getCodexCatalog());
  return models.map((model, idx) => codexModelConfigFromCatalog(model, idx === 0));
}

export function selectCachedCodexTaskModel(
  task: CodexTaskDepth,
  preferredSpec?: string,
): CodexTaskModelSelection | null {
  return selectCodexTaskModel(getCodexCatalogSnapshot(), task, preferredSpec);
}

#!/usr/bin/env bun
/**
 * Fast Bun dev server for Prosodeus.
 * Same API as the Cloudflare Worker but using:
 *   - Drizzle + pg for business tables when DATABASE_URL is present
 *   - in-memory business tables when DATABASE_URL is absent
 *   - bun:sqlite for DO simulation tables (sentences, iterations, versions, cache)
 *
 * Usage: bun --hot apps/worker/dev.ts
 *
 * DATABASE_URL is optional in .dev.vars. Without it, documents/folders live in memory and
 * are lost on restart. Per-document state and the classification cache are always persisted
 * under PROSODEUS_DEV_DATA_DIR (default: ~/.prosodeus/worker).
 *
 * No auth: every request runs as "dev-user". Do not expose this server to untrusted networks.
 */
import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { EngineContext } from "@prosodeus/core";
import {
  AgentSDKClassifier,
  classifyText,
  createAgentSDKModel,
  engineAnalyze,
  engineEquilibrium,
  engineReverseGuide,
  engineRewrite,
  engineSuggest,
  LLMClassifier,
  LocalCache,
  listMoonshotModelOptions,
  listStyleGuides,
  moonshotKeyKind,
  PATTERN_REGISTRY,
  splitAndHash,
} from "@prosodeus/core";
import { generateText } from "ai";
// Drizzle for business DB (Postgres)
import { createDb } from "./src/db/index.ts";
import {
  createDocument as createDocumentPg,
  deleteDocument as deleteDocumentPg,
  getDocument as getDocumentPg,
  listDocuments as listDocumentsPg,
  updateDocument as updateDocumentPg,
} from "./src/db/queries/documents.ts";
import {
  createFolder as createFolderPg,
  deleteFolder as deleteFolderPg,
  listFolders as listFoldersPg,
  updateFolder as updateFolderPg,
} from "./src/db/queries/folders.ts";
import { upsertUser } from "./src/db/queries/users.ts";
import {
  createWorkspace as createWorkspacePg,
  deleteWorkspace as deleteWorkspacePg,
  getWorkspaceAnalytics as getWorkspaceAnalyticsPg,
  getMemberRole as getWorkspaceMemberRolePg,
  getWorkspaceTags as getWorkspaceTagsPg,
  isMember as isWorkspaceMemberPg,
  listWorkspaces as listWorkspacesPg,
  updateWorkspace as updateWorkspacePg,
} from "./src/db/queries/workspaces.ts";
import {
  buildCouncilModels,
  createClassifier,
  createGateClassifier,
  createMediumClassifier,
  resolveModel,
} from "./src/models.ts";

// ─── Load .dev.vars ─────────────────────────────────────────────────────────

const devVarsPath = join(import.meta.dir, ".dev.vars");
if (existsSync(devVarsPath)) {
  const vars = readFileSync(devVarsPath, "utf-8");
  for (const line of vars.split("\n")) {
    const match = line.match(/^(\w+)=(.+)$/);
    if (match) process.env[match[1]!] = match[2]!;
  }
}

const env = {
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  MISTRAL_API_KEY: process.env.MISTRAL_API_KEY,
  MOONSHOT_API_KEY: process.env.MOONSHOT_API_KEY,
  AI_API_KEY: process.env.AI_API_KEY,
  CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
};

const databaseUrl = process.env.DATABASE_URL;

// ─── Business DB (Postgres via Drizzle) ─────────────────────────────────────────

const db = databaseUrl ? createDb(databaseUrl) : null;
if (db) {
  console.log("Connected to Postgres");
} else {
  console.warn(
    "DATABASE_URL not set. Documents and folders are IN MEMORY and will be lost on restart; set DATABASE_URL (Postgres) in .dev.vars to persist them.",
  );
}

// Seed dev user
if (db) await upsertUser(db, "dev-user", "dev@localhost");

type DevDocument = {
  id: string;
  userId: string;
  title: string;
  word_count: number | null;
  sentence_count: number | null;
  mean_heat: number | null;
  status: string;
  folder_id: string | null;
  workspace_id: string | null;
  due_date: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
};

type DevFolder = {
  id: string;
  userId: string;
  name: string;
  parent_id: string | null;
  workspace_id: string | null;
  created_at: string;
  updated_at: string;
};

type DevWorkspace = {
  id: string;
  userId: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  settings: Record<string, unknown> | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

const devDocuments = new Map<string, DevDocument>();
const devFolders = new Map<string, DevFolder>();
const devWorkspaces = new Map<string, DevWorkspace>();

type DevStyle = {
  id: string;
  userId: string;
  name: string;
  description: string;
  policy: Record<string, unknown>;
  is_default: boolean;
  version: number;
  created_at: string;
  updated_at: string;
};

const devStyles = new Map<string, DevStyle>();

// Seed sample styles so Styles tab works on first load
{
  const seedTime = new Date().toISOString();
  const seeds: Array<Omit<DevStyle, "id">> = [
    {
      userId: "dev-user",
      name: "Academic evidence-first",
      description:
        "Lead with verifiable evidence and clear reasoning. Qualify claims, limit superlatives, prefer concrete over abstract.",
      policy: {
        statement_force: "measured",
        claim_certainty: "qualify",
        expression_budget: "one",
        superlative_ceiling: "one_per_section",
        binary_contrast: "sparingly",
        abstraction_level: "balanced",
        rhythm_policy: "vary_openings",
      },
      is_default: true,
      version: 1,
      created_at: seedTime,
      updated_at: seedTime,
    },
    {
      userId: "dev-user",
      name: "Editorial confident",
      description:
        "Direct, confident prose. Allow stronger claims when evidence earns them. Break mirrored rhythms.",
      policy: {
        statement_force: "firm",
        claim_certainty: "preserve",
        expression_budget: "few",
        superlative_ceiling: "preserve_if_evidence",
        binary_contrast: "preserve_if_central",
        abstraction_level: "balanced",
        rhythm_policy: "break_mirrored",
      },
      is_default: false,
      version: 1,
      created_at: seedTime,
      updated_at: seedTime,
    },
    {
      userId: "dev-user",
      name: "Technical precise",
      description:
        "Concrete, specific language. No superlatives, no binary rhetoric. Preserve cadence where deliberate.",
      policy: {
        statement_force: "measured",
        claim_certainty: "reduce",
        expression_budget: "none",
        superlative_ceiling: "none",
        binary_contrast: "avoid",
        abstraction_level: "concrete",
        rhythm_policy: "preserve_cadence",
      },
      is_default: false,
      version: 1,
      created_at: seedTime,
      updated_at: seedTime,
    },
  ];
  for (const s of seeds) {
    const id = crypto.randomUUID();
    devStyles.set(id, { id, ...s });
  }
}

// In-memory overrides for platform patterns (enable/disable)
const platformOverrides = new Map<string, { isEnabled: boolean }>();

// In-memory user-created patterns (platform patterns come from PATTERN_REGISTRY)
type DevUserPattern = {
  id: string;
  userId: string;
  patternId: string;
  taxonomyId: string;
  name: string;
  level: string;
  heatWeight: number;
  selfAmplification: string;
  severity: string;
  tags: string[];
  isEnabled: boolean;
  description: string;
  detectionHint: string;
  examples: unknown[];
  falsePositives: unknown[];
  substitutions: unknown[];
  falseSubstitutions: unknown[];
  rewriteMenu: unknown[];
  pceDirective: string;
  toleranceOverrides: Record<string, unknown>;
  relatedPatterns: string[];
  detectionNotes: string | null;
  researchSources: unknown[];
  forkedFrom: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};
const devUserPatterns = new Map<string, DevUserPattern>();

async function createBusinessDocument(params: {
  id: string;
  userId: string;
  title: string;
  folderId?: string | null;
  workspaceId?: string | null;
}) {
  if (db) return createDocumentPg(db, params);
  const now = new Date().toISOString();
  devDocuments.set(params.id, {
    id: params.id,
    userId: params.userId,
    title: params.title,
    word_count: null,
    sentence_count: null,
    mean_heat: null,
    status: "draft",
    folder_id: params.folderId ?? null,
    workspace_id: params.workspaceId ?? null,
    due_date: null,
    tags: [],
    created_at: now,
    updated_at: now,
  });
}

async function listBusinessDocuments(params: {
  userId: string;
  workspaceId?: string;
  sortCol?: string;
  order?: "asc" | "desc";
}) {
  if (db) return listDocumentsPg(db, params);
  const rows = [...devDocuments.values()].filter((doc) => {
    if (doc.userId !== params.userId) return false;
    if (params.workspaceId && doc.workspace_id !== params.workspaceId) return false;
    return true;
  });
  const key = params.sortCol ?? "updated_at";
  rows.sort((a, b) => {
    const av = sortableDocumentValue(a, key);
    const bv = sortableDocumentValue(b, key);
    if (av < bv) return params.order === "asc" ? -1 : 1;
    if (av > bv) return params.order === "asc" ? 1 : -1;
    return 0;
  });
  return rows.map(({ userId: _userId, ...doc }) => doc);
}

async function getBusinessDocument(docId: string, userId: string) {
  if (db) return getDocumentPg(db, docId, userId);
  const doc = devDocuments.get(docId);
  if (!doc || doc.userId !== userId) return null;
  const { userId: _userId, ...rest } = doc;
  return rest;
}

async function updateBusinessDocument(
  docId: string,
  userId: string,
  data: {
    title?: string;
    wordCount?: number;
    sentenceCount?: number;
    meanHeat?: number;
    folderId?: string | null;
    workspaceId?: string | null;
    status?: string;
    dueDate?: string | null;
  },
) {
  if (db) return updateDocumentPg(db, docId, userId, data);
  const doc = devDocuments.get(docId);
  if (!doc || doc.userId !== userId) return;
  if (data.title !== undefined) doc.title = data.title;
  if (data.wordCount !== undefined) doc.word_count = data.wordCount;
  if (data.sentenceCount !== undefined) doc.sentence_count = data.sentenceCount;
  if (data.meanHeat !== undefined) doc.mean_heat = data.meanHeat;
  if (data.folderId !== undefined) doc.folder_id = data.folderId;
  if (data.workspaceId !== undefined) doc.workspace_id = data.workspaceId;
  if (data.status !== undefined) doc.status = data.status;
  if (data.dueDate !== undefined) doc.due_date = data.dueDate;
  doc.updated_at = new Date().toISOString();
}

async function deleteBusinessDocument(docId: string, userId: string) {
  if (db) return deleteDocumentPg(db, docId, userId);
  const doc = devDocuments.get(docId);
  if (!doc || doc.userId !== userId) return false;
  return devDocuments.delete(docId);
}

async function createBusinessFolder(params: {
  id: string;
  userId: string;
  name: string;
  parentId?: string | null;
}) {
  if (db) return createFolderPg(db, params);
  const now = new Date().toISOString();
  devFolders.set(params.id, {
    id: params.id,
    userId: params.userId,
    name: params.name,
    parent_id: params.parentId ?? null,
    workspace_id: null,
    created_at: now,
    updated_at: now,
  });
}

async function listBusinessFolders(userId: string) {
  if (db) return listFoldersPg(db, userId);
  return [...devFolders.values()]
    .filter((folder) => folder.userId === userId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ userId: _userId, ...folder }) => folder);
}

async function updateBusinessFolder(
  folderId: string,
  userId: string,
  data: { name?: string; parentId?: string | null },
) {
  if (db) return updateFolderPg(db, folderId, userId, data);
  const folder = devFolders.get(folderId);
  if (!folder || folder.userId !== userId) return;
  if (data.name !== undefined) folder.name = data.name;
  if (data.parentId !== undefined) folder.parent_id = data.parentId;
  folder.updated_at = new Date().toISOString();
}

async function deleteBusinessFolder(folderId: string, userId: string) {
  if (db) return deleteFolderPg(db, folderId, userId);
  const folder = devFolders.get(folderId);
  if (!folder || folder.userId !== userId) return false;
  return devFolders.delete(folderId);
}

function sanitizeWorkspaceSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

function publicWorkspace(workspace: DevWorkspace) {
  const { userId: _userId, ...rest } = workspace;
  return rest;
}

async function createBusinessWorkspace(params: {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
}) {
  if (db) return createWorkspacePg(db, params);
  const now = new Date().toISOString();
  devWorkspaces.set(params.id, {
    id: params.id,
    userId: params.ownerId,
    name: params.name,
    slug: sanitizeWorkspaceSlug(params.slug),
    description: params.description ?? null,
    icon: params.icon ?? null,
    color: params.color ?? null,
    settings: null,
    archived: false,
    created_at: now,
    updated_at: now,
  });
}

async function listBusinessWorkspaces(userId: string) {
  if (db) return listWorkspacesPg(db, userId);
  return [...devWorkspaces.values()]
    .filter((workspace) => workspace.userId === userId && !workspace.archived)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(publicWorkspace);
}

async function updateBusinessWorkspace(
  workspaceId: string,
  userId: string,
  data: Record<string, unknown>,
) {
  if (db) {
    const role = await getWorkspaceMemberRolePg(db, workspaceId, userId);
    if (!role || (role !== "owner" && role !== "admin")) return "forbidden" as const;
    await updateWorkspacePg(db, workspaceId, data);
    return "ok" as const;
  }

  const workspace = devWorkspaces.get(workspaceId);
  if (!workspace || workspace.userId !== userId) return "forbidden" as const;
  if (data.name !== undefined) workspace.name = String(data.name).slice(0, 100);
  if (data.slug !== undefined) workspace.slug = sanitizeWorkspaceSlug(String(data.slug));
  if (data.description !== undefined)
    workspace.description = data.description ? String(data.description) : null;
  if (data.icon !== undefined) workspace.icon = data.icon ? String(data.icon) : null;
  if (data.color !== undefined) workspace.color = data.color ? String(data.color) : null;
  if (data.archived !== undefined) workspace.archived = !!data.archived;
  if (data.settings !== undefined) {
    workspace.settings =
      data.settings && typeof data.settings === "object"
        ? (data.settings as Record<string, unknown>)
        : null;
  }
  workspace.updated_at = new Date().toISOString();
  return "ok" as const;
}

async function deleteBusinessWorkspace(workspaceId: string, userId: string) {
  if (db) {
    const role = await getWorkspaceMemberRolePg(db, workspaceId, userId);
    if (role !== "owner") return "forbidden" as const;
    await deleteWorkspacePg(db, workspaceId);
    return "ok" as const;
  }

  const workspace = devWorkspaces.get(workspaceId);
  if (!workspace || workspace.userId !== userId) return "forbidden" as const;
  devWorkspaces.delete(workspaceId);
  return "ok" as const;
}

async function getBusinessWorkspaceAnalytics(workspaceId: string, userId: string) {
  if (db) {
    const member = await isWorkspaceMemberPg(db, workspaceId, userId);
    if (!member) return null;
    return getWorkspaceAnalyticsPg(db, workspaceId, userId);
  }

  const workspace = devWorkspaces.get(workspaceId);
  if (!workspace || workspace.userId !== userId) return null;
  const documents = [...devDocuments.values()].filter(
    (doc) => doc.userId === userId && doc.workspace_id === workspaceId,
  );
  const status_distribution: Record<string, number> = {};
  let totalWords = 0;
  let heatTotal = 0;
  let heatCount = 0;
  const heat_distribution = { cool: 0, warm: 0, hot: 0, unanalyzed: 0 };

  for (const doc of documents) {
    status_distribution[doc.status] = (status_distribution[doc.status] ?? 0) + 1;
    totalWords += doc.word_count ?? 0;
    if (doc.mean_heat == null) {
      heat_distribution.unanalyzed += 1;
      continue;
    }
    heatTotal += doc.mean_heat;
    heatCount += 1;
    if (doc.mean_heat < 3) heat_distribution.cool += 1;
    else if (doc.mean_heat < 6) heat_distribution.warm += 1;
    else heat_distribution.hot += 1;
  }

  return {
    document_count: documents.length,
    total_words: totalWords,
    avg_heat: heatCount > 0 ? heatTotal / heatCount : null,
    status_distribution,
    heat_distribution,
  };
}

async function getBusinessWorkspaceTags(workspaceId: string, userId: string) {
  if (db) return getWorkspaceTagsPg(db, workspaceId, userId);
  const workspace = devWorkspaces.get(workspaceId);
  if (!workspace || workspace.userId !== userId) return null;
  const tags = new Set<string>();
  for (const doc of devDocuments.values()) {
    if (doc.userId !== userId || doc.workspace_id !== workspaceId) continue;
    for (const tag of doc.tags) tags.add(tag);
  }
  return [...tags].sort((a, b) => a.localeCompare(b));
}

function sortableDocumentValue(doc: DevDocument, key: string): string | number {
  switch (key) {
    case "created_at":
      return doc.created_at;
    case "title":
      return doc.title.toLowerCase();
    case "mean_heat":
      return doc.mean_heat ?? -1;
    case "word_count":
      return doc.word_count ?? -1;
    case "due_date":
      return doc.due_date ?? "";
    case "updated_at":
    default:
      return doc.updated_at;
  }
}

// ─── DO simulation SQLite (per-document state) ─────────────────────────────

const dataDir = process.env.PROSODEUS_DEV_DATA_DIR ?? join(homedir(), ".prosodeus", "worker");
mkdirSync(dataDir, { recursive: true });

// Keep SQLite state outside the watched repo. `bun --hot` will reload on WAL
// writes if the files live under apps/worker, which can interrupt analysis with
// short-read SQLite I/O errors.
type DevGlobals = {
  __prosodeusDoDb?: Database;
  __prosodeusCache?: LocalCache;
  __prosodeusServer?: ReturnType<typeof Bun.serve>;
};
const g = globalThis as unknown as DevGlobals;

if (g.__prosodeusServer) {
  try {
    g.__prosodeusServer.stop(true);
  } catch {
    /* server already closed */
  }
  g.__prosodeusServer = undefined;
}
if (g.__prosodeusCache) {
  try {
    g.__prosodeusCache.close();
  } catch {
    /* cache already closed */
  }
  g.__prosodeusCache = undefined;
}
if (g.__prosodeusDoDb) {
  try {
    g.__prosodeusDoDb.close();
  } catch {
    /* doDb already closed */
  }
  g.__prosodeusDoDb = undefined;
}

const doDb = new Database(join(dataDir, "do-state.db"));
g.__prosodeusDoDb = doDb;
doDb.run("PRAGMA journal_mode = WAL");
doDb.run("PRAGMA foreign_keys = ON");

// DO-only tables (these simulate Durable Object SQLite)
doDb.run(`CREATE TABLE IF NOT EXISTS sentences (
  id INTEGER, document_id TEXT NOT NULL, text TEXT NOT NULL, hash TEXT NOT NULL,
  paragraph_id INTEGER, classification TEXT, heat REAL, iteration_id INTEGER DEFAULT 0,
  PRIMARY KEY (document_id, id)
)`);
doDb.run(
  `CREATE TABLE IF NOT EXISTS hash_cache (hash TEXT PRIMARY KEY, classification TEXT NOT NULL)`,
);
doDb.run(
  `CREATE TABLE IF NOT EXISTS gate_cache (hash TEXT PRIMARY KEY, classification TEXT NOT NULL)`,
);
doDb.run(`CREATE TABLE IF NOT EXISTS iterations (
  id INTEGER PRIMARY KEY AUTOINCREMENT, document_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')), source TEXT, profile TEXT
)`);
doDb.run(`CREATE TABLE IF NOT EXISTS versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, document_id TEXT NOT NULL,
  content TEXT NOT NULL, name TEXT, source TEXT NOT NULL DEFAULT 'auto',
  created_at TEXT DEFAULT (datetime('now')), word_count INTEGER, profile TEXT
)`);
doDb.run(`CREATE TABLE IF NOT EXISTS document_content (
  document_id TEXT PRIMARY KEY, content TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
)`);

// ─── Classification cache ───────────────────────────────────────────────────

const cache = new LocalCache(join(dataDir, "cache.sqlite"));
g.__prosodeusCache = cache;

// ─── Classifier ─────────────────────────────────────────────────────────────

let classifier: LLMClassifier | AgentSDKClassifier;
let usingAgentSDK = false;
// Prefer an API key from the environment. The Claude Agent SDK classifier is only used when no
// key is configured; it needs a local `claude login` at call time.
const defaultClassifierModel = env.GROQ_API_KEY
  ? "groq/llama-3.3-70b-versatile"
  : env.MISTRAL_API_KEY
    ? "mistral/mistral-small-latest"
    : env.GOOGLE_API_KEY
      ? "google/gemini-2.5-flash"
      : undefined;
if (defaultClassifierModel) {
  try {
    classifier = createClassifier(env, defaultClassifierModel);
    console.log(`Classifier ready (${defaultClassifierModel})`);
  } catch (e) {
    console.error("No classifier available:", (e as Error).message);
    process.exit(1);
  }
} else {
  classifier = new AgentSDKClassifier();
  usingAgentSDK = true;
  console.warn(
    "No GROQ_API_KEY / MISTRAL_API_KEY / GOOGLE_API_KEY found. Falling back to the Claude Agent SDK (Haiku 4.5), which requires `claude login`.",
  );
}

// ─── Models list ────────────────────────────────────────────────────────────

function getModels() {
  const models: Array<{ id: string; name: string; provider: string }> = [];
  if (usingAgentSDK) {
    models.push({ id: "claude/haiku-4.5", name: "Claude Haiku 4.5", provider: "Anthropic" });
  }
  if (env.GOOGLE_API_KEY) {
    models.push(
      { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "Google" },
      { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "Google" },
    );
  }
  if (env.GROQ_API_KEY) {
    models.push(
      { id: "groq/qwen/qwen3-32b", name: "Qwen 3 32B", provider: "Groq" },
      { id: "groq/llama-3.3-70b-versatile", name: "Llama 3.3 70B", provider: "Groq" },
    );
  }
  if (env.MISTRAL_API_KEY) {
    models.push({ id: "mistral/mistral-small-latest", name: "Mistral Small", provider: "Mistral" });
  }
  if (env.MOONSHOT_API_KEY) {
    for (const m of listMoonshotModelOptions(moonshotKeyKind(env.MOONSHOT_API_KEY))) {
      models.push({ id: `moonshot/${m.id}`, name: m.name, provider: "Moonshot" });
    }
  }
  return models;
}

// ─── Engine context builder ─────────────────────────────────────────────────

const MAX_TEXT = 250_000;

function getDisabledPatternSet(extra?: string[]): Set<string> {
  const s = new Set<string>(extra ?? []);
  for (const [patternId, override] of platformOverrides) {
    if (!override.isEnabled) s.add(patternId);
  }
  for (const p of devUserPatterns.values()) {
    if (!p.isEnabled) s.add(p.patternId);
  }
  return s;
}

function buildCtx(documentId: string, model?: string, disabledPatterns?: string[]): EngineContext {
  const cls = model
    ? model.startsWith("claude/")
      ? new AgentSDKClassifier({
          model: model.split("/").slice(1).join("/").replace("haiku-4.5", "claude-haiku-4-5"),
        })
      : (() => {
          try {
            return createClassifier(env, model);
          } catch {
            return classifier;
          }
        })()
    : classifier;
  const gate = createGateClassifier(env);
  const medium = createMediumClassifier(env, model);

  return {
    cache,
    suggestionCache: cache,
    classifier: cls,
    gateClassifier: gate ?? undefined,
    mediumClassifier: medium ?? undefined,
    resolveModel: (spec) => {
      if (spec === "default" || spec === "classifier") {
        return usingAgentSDK
          ? createAgentSDKModel("claude-haiku-4-5")
          : (resolveModel(env, "google", "gemini-2.5-flash") ??
              resolveModel(env, "groq", "llama-3.3-70b-versatile") ??
              resolveModel(env, "mistral", "mistral-small-latest"));
      }
      if (spec.startsWith("claude")) {
        return createAgentSDKModel(
          spec.replace("claude/", "").replace("haiku-4.5", "claude-haiku-4-5"),
        );
      }
      const [p, ...r] = spec.split("/");
      return resolveModel(env, p!, r.join("/"));
    },
    disabledPatterns: getDisabledPatternSet(disabledPatterns),
    persistIteration: (docId, profile, sentences) => {
      doDb.run("INSERT INTO iterations (document_id, source, profile) VALUES (?, ?, ?)", [
        docId,
        "websocket",
        JSON.stringify(profile),
      ]);
      for (const s of sentences) {
        doDb.run(
          "INSERT OR REPLACE INTO sentences (id, document_id, text, hash, paragraph_id, classification, heat) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [s.id, docId, s.text, s.hash, s.paragraph_id, JSON.stringify(s.classification), s.heat],
        );
      }
    },
    maybeSnapshot: (docId, text, profile) => {
      const lastRow = doDb
        .query(
          "SELECT content FROM versions WHERE document_id = ? ORDER BY created_at DESC LIMIT 1",
        )
        .get(docId) as { content: string } | null;
      if (!lastRow || lastRow.content !== text) {
        const wordCount = text.split(/\s+/).filter(Boolean).length;
        doDb.run(
          "INSERT INTO versions (document_id, content, source, word_count, profile) VALUES (?, ?, ?, ?, ?)",
          [docId, text, "auto", wordCount, JSON.stringify(profile)],
        );
      }
    },
  };
}

// ─── WebSocket message router ───────────────────────────────────────────────

async function handleWsMessage(ws: { send(msg: string): void }, documentId: string, raw: string) {
  const msg = JSON.parse(raw);
  switch (msg.type) {
    case "analyze": {
      const {
        text,
        style,
        model,
        disabled_patterns,
        top_suggestions,
        analyze_mode,
        changed_sentence_ids,
        suggest_mode,
        ai_slop_mode,
      } = msg;
      if (!text?.trim()) {
        ws.send(JSON.stringify({ type: "error", message: "Empty text" }));
        break;
      }
      if (text.length > MAX_TEXT) {
        ws.send(JSON.stringify({ type: "error", message: "Text too long" }));
        break;
      }

      try {
        const ctx = buildCtx(documentId, model, disabled_patterns);
        const incremental = analyze_mode === "incremental";
        const suggestMode = suggest_mode ?? (incremental ? "none" : "batch");
        const topSuggestions = top_suggestions ?? (suggestMode === "batch" ? 3 : 0);
        const result = await engineAnalyze(text, ctx, {
          documentId,
          style,
          onProgress: (p) => ws.send(JSON.stringify({ type: "progress", ...p })),
          onPartialProfile: (profile, done) => {
            ws.send(JSON.stringify({ type: "profile_partial", data: profile, done }));
          },
          changedSentenceIds: changed_sentence_ids,
          topSuggestions,
          suggestMode,
          aiSlopMode: ai_slop_mode,
        });
        ws.send(JSON.stringify({ type: "profile", data: result.profile }));
        if (result.suggestionsPromise) {
          const suggestions = await result.suggestionsPromise;
          ws.send(JSON.stringify({ type: "suggestions", data: suggestions }));
        }
      } catch (err) {
        ws.send(JSON.stringify({ type: "error", message: (err as Error).message }));
      }
      break;
    }
    case "save":
      doDb.run(
        "INSERT OR REPLACE INTO document_content (document_id, content, updated_at) VALUES (?, ?, datetime('now'))",
        [documentId, msg.content],
      );
      ws.send(JSON.stringify({ type: "saved" }));
      break;
    case "load_content": {
      const row = doDb
        .query("SELECT content FROM document_content WHERE document_id = ?")
        .get(documentId) as { content: string } | null;
      ws.send(JSON.stringify({ type: "content", data: row?.content ?? null }));
      break;
    }
    case "list_iterations": {
      const rows = doDb
        .query(
          "SELECT id, created_at, source, profile FROM iterations WHERE document_id = ? ORDER BY created_at DESC LIMIT 50",
        )
        .all(documentId) as any[];
      const iterations = rows.map((r: any) => {
        let p: any = {};
        try {
          p = JSON.parse(r.profile);
        } catch {}
        return {
          id: r.id,
          created_at: r.created_at,
          source: r.source,
          mean_heat: p.mean_heat ?? 0,
          sentence_count: p.sentence_count ?? 0,
          word_count: p.word_count ?? 0,
        };
      });
      ws.send(JSON.stringify({ type: "iterations", data: iterations }));
      break;
    }
    case "list_versions": {
      const rows = doDb
        .query(
          "SELECT id, name, source, created_at, word_count, profile FROM versions WHERE document_id = ? ORDER BY created_at DESC LIMIT 100",
        )
        .all(documentId) as any[];
      const versions = rows.map((r: any) => {
        let heat = 0;
        try {
          heat = JSON.parse(r.profile).mean_heat ?? 0;
        } catch {}
        return {
          id: r.id,
          name: r.name,
          source: r.source,
          created_at: r.created_at,
          word_count: r.word_count,
          mean_heat: heat,
        };
      });
      ws.send(JSON.stringify({ type: "versions", data: versions }));
      break;
    }
    case "create_version": {
      if (!msg.content?.trim()) {
        ws.send(JSON.stringify({ type: "error", message: "Empty content" }));
        break;
      }
      const ctx = buildCtx(documentId);
      const { profile } = await classifyText(msg.content, ctx);
      const wc = msg.content.split(/\s+/).filter(Boolean).length;
      doDb.run(
        "INSERT INTO versions (document_id, content, name, source, word_count, profile) VALUES (?, ?, ?, ?, ?, ?)",
        [documentId, msg.content, msg.name ?? null, "manual", wc, JSON.stringify(profile)],
      );
      const rows = doDb
        .query(
          "SELECT id, name, source, created_at, word_count, profile FROM versions WHERE document_id = ? ORDER BY created_at DESC LIMIT 100",
        )
        .all(documentId) as any[];
      const versions = rows.map((r: any) => {
        let heat = 0;
        try {
          heat = JSON.parse(r.profile).mean_heat ?? 0;
        } catch {}
        return {
          id: r.id,
          name: r.name,
          source: r.source,
          created_at: r.created_at,
          word_count: r.word_count,
          mean_heat: heat,
        };
      });
      ws.send(JSON.stringify({ type: "versions", data: versions }));
      break;
    }
    case "get_version": {
      const row = doDb
        .query("SELECT id, content, profile FROM versions WHERE id = ? AND document_id = ?")
        .get(msg.version_id, documentId) as any;
      if (!row) {
        ws.send(JSON.stringify({ type: "error", message: "Version not found" }));
        break;
      }
      let p = null;
      try {
        p = JSON.parse(row.profile);
      } catch {}
      ws.send(
        JSON.stringify({
          type: "version_content",
          data: { id: row.id, content: row.content, profile: p },
        }),
      );
      break;
    }
    case "compare_versions": {
      const a = doDb
        .query("SELECT id, content, profile FROM versions WHERE id = ?")
        .get(msg.version_a) as any;
      const b = doDb
        .query("SELECT id, content, profile FROM versions WHERE id = ?")
        .get(msg.version_b) as any;
      if (!a || !b) {
        ws.send(JSON.stringify({ type: "error", message: "Version not found" }));
        break;
      }
      let pa = null,
        pb = null;
      try {
        pa = JSON.parse(a.profile);
      } catch {}
      try {
        pb = JSON.parse(b.profile);
      } catch {}
      ws.send(
        JSON.stringify({
          type: "version_compare",
          data: {
            a: { id: a.id, content: a.content, profile: pa },
            b: { id: b.id, content: b.content, profile: pb },
          },
        }),
      );
      break;
    }
    case "rewrite": {
      const { text, style, model, passage_start, passage_end, use_pce, n, constraints } = msg;
      if (!text?.trim()) {
        ws.send(JSON.stringify({ type: "error", message: "Empty text" }));
        break;
      }
      if (text.length > MAX_TEXT) {
        ws.send(JSON.stringify({ type: "error", message: "Text too long" }));
        break;
      }

      try {
        const ctx = buildCtx(documentId, model);
        const result = await engineRewrite(text, ctx, {
          style,
          passageStart: passage_start,
          passageEnd: passage_end,
          usePCE: use_pce,
          n,
          constraints,
          onProgress: (step) => ws.send(JSON.stringify({ type: "rewrite_progress", step })),
        });
        if (result.kind === "single") {
          ws.send(JSON.stringify({ type: "rewrite_result", data: result.data }));
        } else {
          ws.send(JSON.stringify({ type: "rewrite_alternatives", data: result.data }));
        }
      } catch (err) {
        ws.send(JSON.stringify({ type: "error", message: (err as Error).message }));
      }
      break;
    }
    case "equilibrium": {
      const { text, style, model } = msg;
      if (!text?.trim()) {
        ws.send(JSON.stringify({ type: "error", message: "Empty text" }));
        break;
      }

      try {
        const ctx = buildCtx(documentId, model);
        const eqModel = ctx.resolveModel(model ?? "default");
        if (!eqModel) {
          ws.send(JSON.stringify({ type: "error", message: "No model available for equilibrium" }));
          break;
        }
        const eqClassifier = usingAgentSDK ? new AgentSDKClassifier() : new LLMClassifier(eqModel);
        const councilModels = buildCouncilModels(env) ?? [eqModel];

        const eqResult = await engineEquilibrium(text, ctx, {
          style,
          councilModels,
          classifier: eqClassifier,
          onProgress: (round) => ws.send(JSON.stringify({ type: "equilibrium_progress", round })),
        });
        ws.send(JSON.stringify({ type: "equilibrium_result", data: eqResult }));
      } catch (err) {
        ws.send(JSON.stringify({ type: "error", message: (err as Error).message }));
      }
      break;
    }
    case "reverse_guide": {
      const { text, name, description } = msg;
      if (!text?.trim()) {
        ws.send(JSON.stringify({ type: "error", message: "Empty text" }));
        break;
      }

      try {
        const ctx = buildCtx(documentId, msg.model);
        const guideResult = await engineReverseGuide(text, ctx, {
          name: name ?? "Custom Style",
          description: description ?? "",
        });
        ws.send(JSON.stringify({ type: "reverse_guide_result", data: guideResult }));
      } catch (err) {
        ws.send(JSON.stringify({ type: "error", message: (err as Error).message }));
      }
      break;
    }
    case "suggest_rewrites": {
      const { text, sentence_id, model, mode, level, num_alternatives, custom_instruction } = msg;
      if (!text?.trim()) {
        ws.send(JSON.stringify({ type: "error", message: "Empty text" }));
        break;
      }

      try {
        const ctx = buildCtx(documentId, model);
        const sugModel = ctx.resolveModel(model ?? "default");
        if (!sugModel) {
          ws.send(JSON.stringify({ type: "error", message: "No model available for suggestions" }));
          break;
        }

        const suggestions = await engineSuggest(text, ctx, {
          sentenceId: sentence_id,
          model: sugModel,
          level: level ?? "sentence",
          numAlternatives: num_alternatives ?? 3,
          customInstruction: custom_instruction,
          modelName: mode === "council" ? `${model ?? "default"}@single` : model,
        });
        ws.send(JSON.stringify({ type: "rewrite_suggestions", data: suggestions }));
      } catch (err) {
        ws.send(JSON.stringify({ type: "error", message: (err as Error).message }));
      }
      break;
    }
    default:
      ws.send(JSON.stringify({ type: "error", message: `Unknown message type: ${msg.type}` }));
  }
}

// ─── AI rule synthesis helper (shared by /api/patterns/suggest-from-sentence) ──

type SuggestResult =
  | { ok: true; payload: { pattern: Record<string, unknown>; signals: Record<string, unknown> } }
  | { ok: false; status: number; error: string };

async function suggestPatternFromSentence(sentence: string): Promise<SuggestResult> {
  let classification: Record<string, unknown> = {};
  let detectedPatternTypes: string[] = [];
  try {
    const cls = usingAgentSDK ? new AgentSDKClassifier() : createClassifier(env);
    const hashed = splitAndHash(sentence);
    const classified = await cls.classify(hashed.slice(0, 1));
    const first = classified[0]?.classification as Record<string, unknown> | undefined;
    if (first) {
      classification = first;
      const patterns = (first.patterns as Array<{ type?: string }> | undefined) ?? [];
      detectedPatternTypes = patterns.map((p) => p.type).filter((t): t is string => !!t);
    }
  } catch (err) {
    console.warn("[suggest] classifier failed, continuing:", err);
  }

  // Prefer Groq Llama for JSON synthesis: fast, generous free tier, decent JSON adherence.
  // Fall back to Mistral, then Gemini (which hits low quota on free tier).
  const model =
    resolveModel(env, "groq", "llama-3.3-70b-versatile") ??
    resolveModel(env, "mistral", "mistral-small-latest") ??
    resolveModel(env, "google", "gemini-2.5-flash");
  if (!model) {
    return { ok: false, status: 503, error: "No language model configured for suggestions" };
  }

  const knownPatternList = PATTERN_REGISTRY.slice(0, 24)
    .map((p) => `- ${p.id} (${p.level}): ${p.name}`)
    .join("\n");

  const prompt = `You will draft a structural-prose pattern rule for the Prosodeus diagnostic engine.

A reader felt this sentence was wrong:

"""${sentence}"""

Our classifier flagged these signals: ${detectedPatternTypes.length ? detectedPatternTypes.join(", ") : "(none specific)"}.

Produce ONE pattern that captures *why* this sentence feels off structurally, so the engine can detect similar sentences in future writing.

Known patterns for reference (do not duplicate):
${knownPatternList}

Return ONLY a JSON object with EXACTLY this shape — no prose, no markdown fences, no other keys:

{
  "name": "Short pattern name (3-6 words, Title Case)",
  "level": "sentence",
  "description": "One sentence describing what the pattern is",
  "detection_hint": "How a reader/classifier spots it",
  "pce_directive": "Imperative rewrite instruction the user can give an LLM",
  "severity": "medium",
  "self_amplification": "med",
  "heat_weight": 1.0,
  "tags": ["tag1", "tag2"],
  "examples": [
    { "text": ${JSON.stringify(sentence)}, "note": "why this matches" },
    { "text": "another example sentence", "note": "why this matches" }
  ],
  "false_positives": [
    { "text": "sentence that LOOKS similar but is fine", "note": "why this is OK" }
  ],
  "rewrite_menu": ["alt rewrite 1", "alt rewrite 2"]
}

The "level" field MUST be one of: lexical, sentence, paragraph, document.
The "severity" field MUST be one of: low, medium, high.
The "self_amplification" field MUST be one of: low, med, high.
The first "examples" item MUST be the exact source sentence.`;

  let parsed: Record<string, unknown>;
  try {
    const result = await generateText({
      model,
      prompt,
      maxOutputTokens: 4000,
    });
    const jsonText = extractJsonBlock(result.text);
    parsed = JSON.parse(jsonText) as Record<string, unknown>;
    console.log("[suggest] parsed raw JSON:", JSON.stringify(parsed).slice(0, 600));
  } catch (err) {
    console.error("[suggest] synthesizer failed:", err);
    return {
      ok: false,
      status: 502,
      error: `Synthesizer failed: ${(err as Error).message ?? "unknown"}`,
    };
  }

  const normalized = normalizeDraft(parsed, sentence);

  return {
    ok: true,
    payload: {
      pattern: normalized,
      signals: { detected_pattern_types: detectedPatternTypes, classification },
    },
  };
}

function extractJsonBlock(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced && fenced[1]) return fenced[1].trim();
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) return text.slice(firstBrace, lastBrace + 1);
  return text;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function pickArray(obj: Record<string, unknown>, keys: string[]): unknown[] {
  for (const k of keys) {
    const v = obj[k];
    if (Array.isArray(v)) return v;
  }
  return [];
}

function normalizeExamples(items: unknown[]): Array<{ text: string; note?: string }> {
  const out: Array<{ text: string; note?: string }> = [];
  for (const item of items) {
    if (typeof item === "string" && item.trim()) {
      out.push({ text: item.trim() });
      continue;
    }
    if (item && typeof item === "object") {
      const rec = item as Record<string, unknown>;
      const text = pickString(rec, ["text", "example", "sentence", "content", "snippet"]);
      const note = pickString(rec, ["note", "explanation", "reason", "why", "rationale"]);
      if (text) out.push(note ? { text, note } : { text });
    }
  }
  return out;
}

function clampEnum<T extends string>(val: unknown, allowed: readonly T[], fallback: T): T {
  return typeof val === "string" && (allowed as readonly string[]).includes(val)
    ? (val as T)
    : fallback;
}

function normalizeDraft(parsed: Record<string, unknown>, sentence: string) {
  const name =
    pickString(parsed, ["name", "title", "pattern_name", "rule_name"]) ?? "AI-suggested pattern";
  const description = pickString(parsed, ["description", "summary", "what", "definition"]) ?? "";
  const detection_hint =
    pickString(parsed, ["detection_hint", "detection", "how_to_spot", "spot"]) ??
    description ??
    "Detect sentences similar to the provided example.";
  const pce_directive =
    pickString(parsed, ["pce_directive", "directive", "rewrite_directive", "instruction"]) ?? "";

  const examplesRaw = pickArray(parsed, ["examples", "positive_examples", "cases"]);
  const falsePositivesRaw = pickArray(parsed, [
    "false_positives",
    "negative_examples",
    "exceptions",
  ]);
  const rewriteMenuRaw = pickArray(parsed, ["rewrite_menu", "rewrites", "alternatives", "fixes"]);

  const examples = ensureExampleFirst(normalizeExamples(examplesRaw), sentence);
  const false_positives = normalizeExamples(falsePositivesRaw);
  const rewrite_menu = rewriteMenuRaw
    .map((x) =>
      typeof x === "string"
        ? x
        : typeof x === "object" && x
          ? pickString(x as Record<string, unknown>, ["text", "rewrite", "suggestion"])
          : undefined,
    )
    .filter((s): s is string => !!s && !!s.trim());

  const explicitId = pickString(parsed, ["pattern_id", "id", "slug"]);
  const pattern_id = explicitId && /^[a-z0-9_]+$/.test(explicitId) ? explicitId : slugify(name);

  const tagsRaw = pickArray(parsed, ["tags", "labels"]);
  const tags = tagsRaw.filter((t): t is string => typeof t === "string");

  const heatWeightRaw = parsed.heat_weight ?? parsed.weight;

  return {
    pattern_id,
    name,
    level: clampEnum(
      parsed.level,
      ["lexical", "sentence", "paragraph", "document"] as const,
      "sentence",
    ),
    description,
    detection_hint,
    examples,
    false_positives,
    rewrite_menu,
    pce_directive,
    severity: clampEnum(parsed.severity, ["low", "medium", "high"] as const, "medium"),
    self_amplification: clampEnum(
      parsed.self_amplification ?? parsed.amplification,
      ["low", "med", "high"] as const,
      "med",
    ),
    heat_weight: typeof heatWeightRaw === "number" ? heatWeightRaw : 1.0,
    tags,
    substitutions: [],
    false_substitutions: [],
    related_patterns: [],
    research_sources: [],
    tolerance_overrides: {},
    detection_notes: null,
  };
}

function ensureExampleFirst(
  items: Array<{ text: string; note?: string }>,
  sentence: string,
): Array<{ text: string; note?: string }> {
  if (!items.some((e) => e.text.trim() === sentence.trim())) {
    return [{ text: sentence, note: "Source sentence flagged by the user" }, ...items];
  }
  return items;
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60) || "ai_suggested_pattern"
  );
}

// ─── Pattern helpers (dev server) ────────────────────────────────────────────

function patternToListItem(p: (typeof PATTERN_REGISTRY)[number]) {
  const override = platformOverrides.get(p.id);
  return {
    id: `platform:${p.id}`,
    pattern_id: p.id,
    taxonomy_id: p.taxonomy_id,
    name: p.name,
    level: p.level,
    scope: "platform" as const,
    heat_weight: p.heat_weight,
    self_amplification: p.self_amplification,
    severity: p.severity,
    tags: p.tags ?? [],
    is_enabled: override ? override.isEnabled : true,
    updated_at: new Date().toISOString(),
  };
}

function patternToDetail(p: (typeof PATTERN_REGISTRY)[number]) {
  return {
    ...patternToListItem(p),
    description: p.description ?? "",
    examples: p.examples ?? [],
    false_positives: p.false_positives ?? [],
    substitutions: p.substitutions ?? [],
    false_substitutions: p.false_substitutions ?? [],
    detection_hint: p.detection_hint,
    rewrite_menu: p.rewrite_menu,
    pce_directive: p.pce_directive,
    tolerance_overrides: p.tolerance_overrides,
    related_patterns: p.related_patterns ?? [],
    detection_notes: p.detection_notes,
    research_sources: p.research_sources ?? [],
    created_at: new Date().toISOString(),
    version: 1,
  };
}

function devPatternToListItem(p: DevUserPattern) {
  return {
    id: p.id,
    pattern_id: p.patternId,
    taxonomy_id: p.taxonomyId,
    name: p.name,
    level: p.level,
    scope: "user" as const,
    heat_weight: p.heatWeight,
    self_amplification: p.selfAmplification,
    severity: p.severity,
    tags: p.tags,
    is_enabled: p.isEnabled,
    forked_from: p.forkedFrom ?? undefined,
    updated_at: p.updatedAt,
  };
}

function devPatternToDetail(p: DevUserPattern) {
  return {
    ...devPatternToListItem(p),
    description: p.description,
    examples: p.examples,
    false_positives: p.falsePositives,
    substitutions: p.substitutions,
    false_substitutions: p.falseSubstitutions,
    detection_hint: p.detectionHint,
    rewrite_menu: p.rewriteMenu,
    pce_directive: p.pceDirective,
    tolerance_overrides: p.toleranceOverrides,
    related_patterns: p.relatedPatterns,
    detection_notes: p.detectionNotes,
    research_sources: p.researchSources,
    created_by: p.userId,
    created_at: p.createdAt,
    version: p.version,
  };
}

function createDevPattern(
  userId: string,
  body: Record<string, any>,
  forkedFrom?: string | null,
): DevUserPattern {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    userId,
    patternId: body.pattern_id,
    taxonomyId: body.taxonomy_id ?? "",
    name: body.name,
    level: body.level,
    heatWeight: body.heat_weight ?? 1.0,
    selfAmplification: body.self_amplification ?? "med",
    severity: body.severity ?? "medium",
    tags: body.tags ?? [],
    isEnabled: true,
    description: body.description ?? "",
    detectionHint: body.detection_hint,
    examples: body.examples ?? [],
    falsePositives: body.false_positives ?? [],
    substitutions: body.substitutions ?? [],
    falseSubstitutions: body.false_substitutions ?? [],
    rewriteMenu: body.rewrite_menu ?? [],
    pceDirective: body.pce_directive ?? "",
    toleranceOverrides: body.tolerance_overrides ?? {},
    relatedPatterns: body.related_patterns ?? [],
    detectionNotes: body.detection_notes ?? null,
    researchSources: body.research_sources ?? [],
    forkedFrom: forkedFrom ?? null,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

// ─── HTTP Server ────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT ?? 8788);

const server = Bun.serve({
  port: PORT,
  // Note: server is also tracked on globalThis above so hot reloads can
  // stop the previous instance before binding a fresh one.

  async fetch(req, server) {
    const url = new URL(req.url);
    const origin = req.headers.get("origin");
    const corsOrigin =
      origin === "http://localhost:5173" || origin === "http://127.0.0.1:5173"
        ? origin
        : "http://localhost:5173";

    // CORS
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": corsOrigin,
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    const corsHeaders = { "Access-Control-Allow-Origin": corsOrigin };

    // ── WebSocket upgrade ──
    const wsMatch = url.pathname.match(/^\/api\/documents\/([^/]+)\/ws$/);
    if (wsMatch && req.headers.get("upgrade") === "websocket") {
      const success = server.upgrade(req, { data: { documentId: wsMatch[1] } });
      return success ? undefined : new Response("WebSocket upgrade failed", { status: 500 });
    }

    // ── Public API routes ──
    if (url.pathname === "/api/style-guides")
      return Response.json(listStyleGuides(), { headers: corsHeaders });
    if (url.pathname === "/api/models") return Response.json(getModels(), { headers: corsHeaders });

    // ── All other API routes: auto dev-user ──
    const userId = "dev-user";

    // User profile
    if (url.pathname === "/api/me" && req.method === "GET") {
      return Response.json(
        {
          id: userId,
          email: "dev@localhost",
        },
        { headers: corsHeaders },
      );
    }

    // Workspaces (using Drizzle → Postgres when configured, in-memory otherwise)
    if (url.pathname === "/api/workspaces" && req.method === "POST") {
      let body: {
        name?: string;
        slug?: string;
        description?: string;
        icon?: string;
        color?: string;
      };
      try {
        body = await req.json();
      } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: corsHeaders });
      }
      const name = body.name?.trim();
      const slug = sanitizeWorkspaceSlug(body.slug ?? name ?? "");
      if (!name || !slug) {
        return Response.json(
          { error: "name and slug required" },
          { status: 400, headers: corsHeaders },
        );
      }
      const id = crypto.randomUUID();
      await createBusinessWorkspace({
        id,
        ownerId: userId,
        name: name.slice(0, 100),
        slug,
        description: body.description,
        icon: body.icon,
        color: body.color,
      });
      return Response.json({ id }, { status: 201, headers: corsHeaders });
    }
    if (url.pathname === "/api/workspaces" && req.method === "GET") {
      const results = await listBusinessWorkspaces(userId);
      return Response.json(results, { headers: corsHeaders });
    }

    const workspaceTagsMatch = url.pathname.match(/^\/api\/workspaces\/([^/]+)\/tags$/);
    if (workspaceTagsMatch && req.method === "GET") {
      const tags = await getBusinessWorkspaceTags(workspaceTagsMatch[1]!, userId);
      return tags
        ? Response.json(tags, { headers: corsHeaders })
        : Response.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
    }
    const workspaceAnalyticsMatch = url.pathname.match(/^\/api\/workspaces\/([^/]+)\/analytics$/);
    if (workspaceAnalyticsMatch && req.method === "GET") {
      const analytics = await getBusinessWorkspaceAnalytics(workspaceAnalyticsMatch[1]!, userId);
      return analytics
        ? Response.json(analytics, { headers: corsHeaders })
        : Response.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
    }
    const workspaceMatch = url.pathname.match(/^\/api\/workspaces\/([^/]+)$/);
    if (workspaceMatch) {
      const workspaceId = workspaceMatch[1]!;
      if (req.method === "PUT") {
        let body: Record<string, unknown>;
        try {
          body = await req.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders });
        }
        const hasFields = [
          "name",
          "slug",
          "description",
          "icon",
          "color",
          "archived",
          "settings",
        ].some((field) => body[field] !== undefined);
        if (!hasFields) {
          return Response.json(
            { error: "No fields to update" },
            { status: 400, headers: corsHeaders },
          );
        }
        const result = await updateBusinessWorkspace(workspaceId, userId, body);
        return result === "ok"
          ? Response.json({ ok: true }, { headers: corsHeaders })
          : Response.json({ error: "Not authorized" }, { status: 403, headers: corsHeaders });
      }
      if (req.method === "DELETE") {
        const result = await deleteBusinessWorkspace(workspaceId, userId);
        return result === "ok"
          ? Response.json({ ok: true }, { headers: corsHeaders })
          : Response.json(
              { error: "Only the owner can delete" },
              { status: 403, headers: corsHeaders },
            );
      }
    }

    // Documents (using Drizzle → Postgres)
    if (url.pathname === "/api/documents" && req.method === "POST") {
      const body = (await req.json()) as {
        title?: string;
        folder_id?: string;
        workspace_id?: string;
      };
      const id = crypto.randomUUID();
      await createBusinessDocument({
        id,
        userId,
        title: body.title ?? "Untitled",
        folderId: body.folder_id,
        workspaceId: body.workspace_id,
      });
      return Response.json({ id }, { status: 201, headers: corsHeaders });
    }
    if (url.pathname === "/api/documents" && req.method === "GET") {
      const results = await listBusinessDocuments({
        userId,
        workspaceId: url.searchParams.get("workspace_id") ?? undefined,
        sortCol: url.searchParams.get("sort") ?? "updated_at",
        order: url.searchParams.get("order") === "asc" ? "asc" : "desc",
      });
      return Response.json(results, { headers: corsHeaders });
    }

    const docMatch = url.pathname.match(/^\/api\/documents\/([^/]+)$/);
    if (docMatch) {
      const docId = docMatch[1]!;
      if (req.method === "GET") {
        const doc = await getBusinessDocument(docId, userId);
        return doc
          ? Response.json(doc, { headers: corsHeaders })
          : Response.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
      }
      if (req.method === "PUT") {
        const body = (await req.json()) as Record<string, unknown>;
        await updateBusinessDocument(docId, userId, {
          title: body.title as string | undefined,
          wordCount: body.word_count as number | undefined,
          sentenceCount: body.sentence_count as number | undefined,
          meanHeat: body.mean_heat as number | undefined,
          folderId: body.folder_id as string | null | undefined,
          workspaceId: body.workspace_id as string | null | undefined,
          status: body.status as string | undefined,
        });
        return Response.json({ ok: true }, { headers: corsHeaders });
      }
      if (req.method === "DELETE") {
        await deleteBusinessDocument(docId, userId);
        return Response.json({ ok: true }, { headers: corsHeaders });
      }
    }

    // Folders (using Drizzle → Postgres)
    if (url.pathname === "/api/folders" && req.method === "POST") {
      const body = (await req.json()) as { name: string; parent_id?: string };
      const id = crypto.randomUUID();
      await createBusinessFolder({ id, userId, name: body.name, parentId: body.parent_id });
      return Response.json({ id }, { status: 201, headers: corsHeaders });
    }
    if (url.pathname === "/api/folders" && req.method === "GET") {
      const results = await listBusinessFolders(userId);
      return Response.json(results, { headers: corsHeaders });
    }
    const folderMatch = url.pathname.match(/^\/api\/folders\/([^/]+)$/);
    if (folderMatch) {
      const fid = folderMatch[1]!;
      if (req.method === "PUT") {
        const body = (await req.json()) as { name?: string; parent_id?: string | null };
        await updateBusinessFolder(fid, userId, { name: body.name, parentId: body.parent_id });
        return Response.json({ ok: true }, { headers: corsHeaders });
      }
      if (req.method === "DELETE") {
        await deleteBusinessFolder(fid, userId);
        return Response.json({ ok: true }, { headers: corsHeaders });
      }
    }

    // Guides (return built-in list for dev)
    if (url.pathname === "/api/guides" && req.method === "GET") {
      return Response.json([], { headers: corsHeaders });
    }

    // ── User styles (in-memory CRUD for dev) ──
    if (url.pathname === "/api/styles" && req.method === "GET") {
      const items = [...devStyles.values()]
        .filter((s) => s.userId === userId)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(({ userId: _u, ...rest }) => rest);
      return Response.json({ styles: items }, { headers: corsHeaders });
    }
    if (url.pathname === "/api/styles" && req.method === "POST") {
      const body = (await req.json()) as {
        name?: string;
        description?: string;
        policy?: Record<string, unknown>;
        is_default?: boolean;
      };
      const name = (body.name ?? "").trim();
      if (!name)
        return Response.json({ error: "name is required" }, { status: 400, headers: corsHeaders });
      if (name.length > 80)
        return Response.json(
          { error: "name must be 80 characters or fewer" },
          { status: 400, headers: corsHeaders },
        );
      const dupe = [...devStyles.values()].some((s) => s.userId === userId && s.name === name);
      if (dupe)
        return Response.json(
          { error: "A style with this name already exists" },
          { status: 409, headers: corsHeaders },
        );
      if (body.is_default) {
        for (const s of devStyles.values()) if (s.userId === userId) s.is_default = false;
      }
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      devStyles.set(id, {
        id,
        userId,
        name,
        description: (body.description ?? "").slice(0, 1000),
        policy: body.policy ?? {},
        is_default: !!body.is_default,
        version: 1,
        created_at: now,
        updated_at: now,
      });
      return Response.json({ id }, { status: 201, headers: corsHeaders });
    }
    const styleMatch = url.pathname.match(/^\/api\/styles\/([^/]+)$/);
    if (styleMatch) {
      const sid = styleMatch[1]!;
      const style = devStyles.get(sid);
      if (!style || style.userId !== userId) {
        return Response.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
      }
      if (req.method === "GET") {
        const { userId: _u, ...rest } = style;
        return Response.json(rest, { headers: corsHeaders });
      }
      if (req.method === "PUT") {
        const body = (await req.json()) as {
          name?: string;
          description?: string;
          policy?: Record<string, unknown>;
          is_default?: boolean;
        };
        if (body.name !== undefined) {
          const next = body.name.trim();
          if (!next)
            return Response.json(
              { error: "name cannot be empty" },
              { status: 400, headers: corsHeaders },
            );
          if (next.length > 80)
            return Response.json(
              { error: "name must be 80 characters or fewer" },
              { status: 400, headers: corsHeaders },
            );
          if (
            next !== style.name &&
            [...devStyles.values()].some(
              (s) => s.userId === userId && s.name === next && s.id !== sid,
            )
          ) {
            return Response.json(
              { error: "A style with this name already exists" },
              { status: 409, headers: corsHeaders },
            );
          }
          style.name = next;
        }
        if (body.description !== undefined) style.description = body.description.slice(0, 1000);
        if (body.policy !== undefined) style.policy = body.policy;
        if (body.is_default !== undefined) {
          if (body.is_default) {
            for (const s of devStyles.values()) if (s.userId === userId) s.is_default = false;
          }
          style.is_default = !!body.is_default;
        }
        style.version += 1;
        style.updated_at = new Date().toISOString();
        return Response.json({ ok: true }, { headers: corsHeaders });
      }
      if (req.method === "DELETE") {
        devStyles.delete(sid);
        return Response.json({ ok: true }, { headers: corsHeaders });
      }
    }

    // ── Patterns CRUD (platform from registry + user in-memory) ──
    if (url.pathname === "/api/patterns" && req.method === "GET") {
      const levelFilter = url.searchParams.get("level");
      const scopeFilter = url.searchParams.get("scope");
      const search = url.searchParams.get("search")?.trim().toLowerCase();
      const sort = url.searchParams.get("sort") ?? "taxonomy_id";
      const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "200"), 500);
      const offset = parseInt(url.searchParams.get("offset") ?? "0");

      let items: ReturnType<typeof patternToListItem>[] = [];
      if (!scopeFilter || scopeFilter === "platform") {
        let platform = PATTERN_REGISTRY.map(patternToListItem);
        if (levelFilter) platform = platform.filter((p) => p.level === levelFilter);
        if (search)
          platform = platform.filter((p) =>
            [p.pattern_id, p.name, p.taxonomy_id].join(" ").toLowerCase().includes(search),
          );
        items.push(...platform);
      }
      if (!scopeFilter || scopeFilter === "user") {
        let user = [...devUserPatterns.values()]
          .filter((p) => p.userId === userId)
          .map(devPatternToListItem);
        if (levelFilter) user = user.filter((p) => p.level === levelFilter);
        if (search)
          user = user.filter((p) =>
            [p.pattern_id, p.name, p.taxonomy_id].join(" ").toLowerCase().includes(search!),
          );
        items.push(...(user as typeof items));
      }
      items.sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name);
        if (sort === "level")
          return a.level.localeCompare(b.level) || a.taxonomy_id.localeCompare(b.taxonomy_id);
        if (sort === "updated_at") return b.updated_at.localeCompare(a.updated_at);
        return a.taxonomy_id.localeCompare(b.taxonomy_id);
      });
      const total = items.length;
      items = items.slice(offset, offset + limit);
      return Response.json({ patterns: items, total, offset, limit }, { headers: corsHeaders });
    }

    if (url.pathname === "/api/patterns/export" && req.method === "GET") {
      const scopeFilter = url.searchParams.get("scope");
      const result: ReturnType<typeof patternToDetail>[] = [];
      if (!scopeFilter || scopeFilter === "platform")
        result.push(...PATTERN_REGISTRY.map(patternToDetail));
      if (!scopeFilter || scopeFilter === "user") {
        result.push(
          ...([...devUserPatterns.values()]
            .filter((p) => p.userId === userId)
            .map(devPatternToDetail) as typeof result),
        );
      }
      return Response.json(
        {
          version: 1,
          exported_at: new Date().toISOString(),
          source: "Prosodeus",
          patterns: result,
        },
        { headers: corsHeaders },
      );
    }

    if (url.pathname === "/api/patterns/import" && req.method === "POST") {
      const body = (await req.json()) as { patterns?: Record<string, any>[]; dry_run?: boolean };
      if (!Array.isArray(body.patterns) || body.patterns.length === 0) {
        return Response.json(
          { error: "patterns must be a non-empty array" },
          { status: 400, headers: corsHeaders },
        );
      }
      const existingIds = new Set(
        [...devUserPatterns.values()].filter((p) => p.userId === userId).map((p) => p.patternId),
      );
      const result = {
        valid: 0,
        invalid: 0,
        conflicts: [] as { pattern_id: string; reason: string }[],
        created_ids: [] as string[],
      };
      for (const p of body.patterns) {
        if (!p.pattern_id || !p.name || !p.level || !p.detection_hint) {
          result.invalid++;
          continue;
        }
        if (existingIds.has(p.pattern_id)) {
          result.conflicts.push({ pattern_id: p.pattern_id, reason: "Already exists" });
          continue;
        }
        result.valid++;
      }
      if (body.dry_run) return Response.json(result, { headers: corsHeaders });
      for (const p of body.patterns) {
        if (!p.pattern_id || !p.name || !p.level || !p.detection_hint) continue;
        if (existingIds.has(p.pattern_id)) continue;
        const created = createDevPattern(userId, p);
        devUserPatterns.set(created.id, created);
        result.created_ids.push(created.id);
        existingIds.add(p.pattern_id);
      }
      return Response.json(result, { status: 201, headers: corsHeaders });
    }

    if (url.pathname === "/api/patterns" && req.method === "POST") {
      const body = (await req.json()) as Record<string, any>;
      if (!body.pattern_id || !body.name || !body.level || !body.detection_hint) {
        return Response.json(
          { error: "pattern_id, name, level, and detection_hint are required" },
          { status: 400, headers: corsHeaders },
        );
      }
      const existingIds = new Set(
        [...devUserPatterns.values()].filter((p) => p.userId === userId).map((p) => p.patternId),
      );
      if (existingIds.has(body.pattern_id)) {
        return Response.json(
          { error: "A pattern with this ID already exists" },
          { status: 409, headers: corsHeaders },
        );
      }
      const created = createDevPattern(userId, body);
      devUserPatterns.set(created.id, created);
      return Response.json({ id: created.id }, { status: 201, headers: corsHeaders });
    }

    // Pattern sub-routes (must match before the :id catch-all)
    const patternToggleMatch = url.pathname.match(/^\/api\/patterns\/([^/]+)\/toggle$/);
    if (patternToggleMatch && req.method === "PATCH") {
      const tid = decodeURIComponent(patternToggleMatch[1]!);
      if (tid.startsWith("platform:")) {
        const patternId = tid.slice("platform:".length);
        const entry = PATTERN_REGISTRY.find((p) => p.id === patternId);
        if (!entry)
          return Response.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
        const current = platformOverrides.get(patternId);
        const next = !(current ? current.isEnabled : true);
        platformOverrides.set(patternId, { isEnabled: next });
        return Response.json({ is_enabled: next }, { headers: corsHeaders });
      }
      const p = devUserPatterns.get(tid);
      if (!p || p.userId !== userId)
        return Response.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
      p.isEnabled = !p.isEnabled;
      p.updatedAt = new Date().toISOString();
      return Response.json({ is_enabled: p.isEnabled }, { headers: corsHeaders });
    }

    const patternVersionsMatch = url.pathname.match(/^\/api\/patterns\/([^/]+)\/versions$/);
    if (patternVersionsMatch && req.method === "GET") {
      return Response.json({ versions: [] }, { headers: corsHeaders });
    }
    const patternRevertMatch = url.pathname.match(/^\/api\/patterns\/([^/]+)\/revert$/);
    if (patternRevertMatch && req.method === "POST") {
      return Response.json({ ok: true, version: 1 }, { headers: corsHeaders });
    }
    const patternForkMatch = url.pathname.match(/^\/api\/patterns\/([^/]+)\/fork$/);
    if (patternForkMatch && req.method === "POST") {
      const sourceId = decodeURIComponent(patternForkMatch[1]!);
      if (!sourceId.startsWith("platform:")) {
        return Response.json(
          { error: "Can only fork platform patterns" },
          { status: 400, headers: corsHeaders },
        );
      }
      const patternId = sourceId.slice("platform:".length);
      const source = PATTERN_REGISTRY.find((p) => p.id === patternId);
      if (!source)
        return Response.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
      const existingIds = new Set(
        [...devUserPatterns.values()].filter((p) => p.userId === userId).map((p) => p.patternId),
      );
      if (existingIds.has(patternId)) {
        return Response.json({ error: "Already forked" }, { status: 409, headers: corsHeaders });
      }
      const created = createDevPattern(
        userId,
        {
          pattern_id: patternId,
          taxonomy_id: source.taxonomy_id,
          name: source.name,
          level: source.level,
          heat_weight: source.heat_weight,
          self_amplification: source.self_amplification,
          severity: source.severity,
          tags: source.tags,
          description: source.description,
          detection_hint: source.detection_hint,
          examples: source.examples,
          false_positives: source.false_positives,
          substitutions: source.substitutions,
          false_substitutions: source.false_substitutions,
          rewrite_menu: source.rewrite_menu,
          pce_directive: source.pce_directive,
          tolerance_overrides: source.tolerance_overrides,
          related_patterns: source.related_patterns,
          detection_notes: source.detection_notes,
          research_sources: source.research_sources,
        },
        patternId,
      );
      devUserPatterns.set(created.id, created);
      return Response.json({ id: created.id }, { status: 201, headers: corsHeaders });
    }

    const patternMatch = url.pathname.match(/^\/api\/patterns\/([^/]+)$/);
    if (patternMatch) {
      const pid = decodeURIComponent(patternMatch[1]!);
      if (req.method === "GET") {
        if (pid.startsWith("platform:")) {
          const entry = PATTERN_REGISTRY.find((p) => p.id === pid.slice("platform:".length));
          return entry
            ? Response.json(patternToDetail(entry), { headers: corsHeaders })
            : Response.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
        }
        const p = devUserPatterns.get(pid);
        if (!p || p.userId !== userId)
          return Response.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
        return Response.json(devPatternToDetail(p), { headers: corsHeaders });
      }
      if (req.method === "PUT") {
        if (pid.startsWith("platform:"))
          return Response.json(
            { error: "Cannot edit platform patterns" },
            { status: 403, headers: corsHeaders },
          );
        const p = devUserPatterns.get(pid);
        if (!p || p.userId !== userId)
          return Response.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
        const body = (await req.json()) as Record<string, any>;
        if (body.name !== undefined) p.name = body.name;
        if (body.level !== undefined) p.level = body.level;
        if (body.heat_weight !== undefined) p.heatWeight = body.heat_weight;
        if (body.self_amplification !== undefined) p.selfAmplification = body.self_amplification;
        if (body.severity !== undefined) p.severity = body.severity;
        if (body.detection_hint !== undefined) p.detectionHint = body.detection_hint;
        if (body.description !== undefined) p.description = body.description;
        if (body.pce_directive !== undefined) p.pceDirective = body.pce_directive;
        if (body.examples !== undefined) p.examples = body.examples;
        if (body.false_positives !== undefined) p.falsePositives = body.false_positives;
        if (body.rewrite_menu !== undefined) p.rewriteMenu = body.rewrite_menu;
        if (body.tags !== undefined) p.tags = body.tags;
        if (body.tolerance_overrides !== undefined) p.toleranceOverrides = body.tolerance_overrides;
        if (body.related_patterns !== undefined) p.relatedPatterns = body.related_patterns;
        if (body.detection_notes !== undefined) p.detectionNotes = body.detection_notes;
        if (body.research_sources !== undefined) p.researchSources = body.research_sources;
        p.version += 1;
        p.updatedAt = new Date().toISOString();
        return Response.json({ ok: true }, { headers: corsHeaders });
      }
      if (req.method === "DELETE") {
        if (pid.startsWith("platform:"))
          return Response.json(
            { error: "Cannot delete platform patterns" },
            { status: 403, headers: corsHeaders },
          );
        const p = devUserPatterns.get(pid);
        if (!p || p.userId !== userId)
          return Response.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
        devUserPatterns.delete(pid);
        return Response.json({ ok: true }, { headers: corsHeaders });
      }
    }

    // ── AI rule synthesis from a sentence ──
    if (url.pathname === "/api/patterns/suggest-from-sentence" && req.method === "POST") {
      const body = (await req.json()) as { sentence?: string };
      const sentence = (body.sentence ?? "").trim();
      if (!sentence)
        return Response.json(
          { error: "sentence is required" },
          { status: 400, headers: corsHeaders },
        );
      if (sentence.length > 1500)
        return Response.json(
          { error: "sentence must be 1500 characters or fewer" },
          { status: 400, headers: corsHeaders },
        );

      const result = await suggestPatternFromSentence(sentence);
      if (!result.ok)
        return Response.json(
          { error: result.error },
          { status: result.status, headers: corsHeaders },
        );
      return Response.json(result.payload, { headers: corsHeaders });
    }

    return new Response("Not found", { status: 404, headers: corsHeaders });
  },

  websocket: {
    open(ws) {
      console.log("[ws] connected:", (ws.data as any)?.documentId);
    },
    async message(ws, message) {
      if (typeof message !== "string") return;
      const documentId = (ws.data as any)?.documentId;
      if (!documentId) return;
      try {
        await handleWsMessage(ws as any, documentId, message);
      } catch (err) {
        ws.send(JSON.stringify({ type: "error", message: (err as Error).message }));
      }
    },
    close() {
      console.log("[ws] disconnected");
    },
  },

  development: {
    hmr: true,
    console: true,
  },
});

g.__prosodeusServer = server;

console.log(`\n  Prosodeus API → http://localhost:${server.port}`);
console.log(`  Classifier: ${usingAgentSDK ? "Claude Agent SDK (Haiku 4.5)" : "AI SDK"}`);
console.log(
  `  Default model: ${usingAgentSDK ? "claude-haiku-4-5" : resolveModel(env, "google", "gemini-2.5-flash") ? "google/gemini-2.5-flash" : resolveModel(env, "groq", "llama-3.3-70b-versatile") ? "groq/llama-3.3-70b-versatile" : "mistral/mistral-small-latest"}`,
);
console.log(
  `  Business DB: ${
    databaseUrl
      ? `Postgres (${databaseUrl.split("@")[1]?.split("/")[0] ?? "configured"})`
      : "in-memory dev store"
  }`,
);
console.log(`  DO state: ${join(dataDir, "do-state.db")}\n`);

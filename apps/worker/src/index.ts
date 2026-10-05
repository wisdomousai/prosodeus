import {
  classifyText,
  listMoonshotModelOptions,
  listStyleGuides,
  moonshotKeyKind,
  NullCache,
} from "@prosodeus/core";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { authMiddleware } from "./auth.ts";
import { createDb } from "./db/index.ts";
import {
  createDocument,
  deleteDocument,
  getDocument,
  getDocumentPublic,
  listDocuments,
  updateDocument,
  verifyDocOwnership,
} from "./db/queries/documents.ts";
import { createFolder, deleteFolder, listFolders, updateFolder } from "./db/queries/folders.ts";
import { listPrompts, upsertPrompt } from "./db/queries/prompts.ts";
import {
  createShareLink,
  deleteShareLink,
  getShareLinkByToken,
  listShareLinks,
} from "./db/queries/share-links.ts";
import { createGuide, deleteGuide, listGuides } from "./db/queries/style-guides.ts";
import { addTags, removeTag } from "./db/queries/tags.ts";
import { createTemplate, deleteTemplate, listTemplates } from "./db/queries/templates.ts";
import { getUserById, isAdmin, upsertUser } from "./db/queries/users.ts";
import {
  createWorkspace,
  deleteWorkspace,
  getMemberRole,
  getWorkspaceAnalytics,
  getWorkspaceTags,
  isMember,
  listWorkspaces,
  updateWorkspace,
} from "./db/queries/workspaces.ts";
import { createClassifier, createGateClassifier, createMediumClassifier } from "./models.ts";
import { patternRoutes } from "./patterns.ts";
import { styleRoutes } from "./styles.ts";
import { validateWorkspaceSettings } from "./workspace-settings.ts";

const MAX_TEXT_LENGTH = 250_000; // ~50k words at 5 chars/word
const MAX_TITLE_LENGTH = 200;
const BATCH_ANALYZE_CONCURRENCY = 3;

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!, i);
    }
  }
  const workers = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

export { DocumentAnalyzer } from "./document.ts";

export interface Env {
  HYPERDRIVE: Hyperdrive;
  CACHE: KVNamespace;
  DOCUMENT: DurableObjectNamespace;
  AI_API_KEY: string;
  GOOGLE_API_KEY: string;
  GROQ_API_KEY: string;
  MISTRAL_API_KEY: string;
  MOONSHOT_API_KEY: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_GATEWAY_ID?: string;
  // Auth
  WORKOS_CLIENT_ID?: string;
  JWKS_URL?: string;
  PROSODEUS_DEV?: string;
  // Comma-separated CORS origins (defaults to the local Vite dev server)
  ALLOWED_ORIGINS?: string;
}

const app = new Hono<{ Bindings: Env }>();

const DEFAULT_ORIGIN = "http://localhost:5173";

function allowedOrigins(env: Env): string[] {
  const configured = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return configured.length > 0 ? configured : [DEFAULT_ORIGIN];
}

app.use("*", (c, next) =>
  cors({
    origin: allowedOrigins(c.env),
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })(c, next),
);

// Surface errors in response + logs (so you see them in Network tab and wrangler stdout)
app.onError((err, c) => {
  console.error("[worker] Unhandled error:", err);
  return c.json({ error: err.message, stack: err.stack }, 500, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": allowedOrigins(c.env)[0] ?? DEFAULT_ORIGIN,
  });
});

// Public: built-in style guides (read-only templates).
// User-defined styles live at /api/styles/* (auth-protected, full CRUD).
app.get("/api/style-guides", (c) => {
  return c.json(listStyleGuides());
});

// Public: available models (based on configured API keys)
app.get("/api/models", (c) => {
  const models: Array<{ id: string; name: string; provider: string }> = [];
  if (c.env.GOOGLE_API_KEY) {
    models.push(
      { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "Google" },
      { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "Google" },
    );
  }
  if (c.env.GROQ_API_KEY) {
    models.push(
      { id: "groq/qwen/qwen3-32b", name: "Qwen 3 32B", provider: "Groq" },
      { id: "groq/llama-3.3-70b-versatile", name: "Llama 3.3 70B", provider: "Groq" },
      { id: "groq/deepseek-r1-distill-llama-70b", name: "DeepSeek R1 70B", provider: "Groq" },
    );
  }
  if (c.env.MISTRAL_API_KEY) {
    models.push(
      { id: "mistral/mistral-small-2506", name: "Mistral Small 2506", provider: "Mistral" },
      { id: "mistral/mistral-medium-latest", name: "Mistral Medium", provider: "Mistral" },
    );
  }
  if (c.env.MOONSHOT_API_KEY) {
    for (const m of listMoonshotModelOptions(moonshotKeyKind(c.env.MOONSHOT_API_KEY))) {
      models.push({ id: `moonshot/${m.id}`, name: m.name, provider: "Moonshot" });
    }
  }
  if (c.env.AI_API_KEY) {
    models.push({
      id: "workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      name: "Llama 3.3 70B",
      provider: "Workers AI",
    });
  }
  return c.json(models);
});

// Auth-protected routes
app.use("/api/documents", authMiddleware);
app.use("/api/documents/*", authMiddleware);
app.use("/api/folders/*", authMiddleware);
app.use("/api/folders", authMiddleware);
app.use("/api/me", authMiddleware);
app.use("/api/patterns", authMiddleware);
app.use("/api/patterns/*", authMiddleware);
app.use("/api/styles", authMiddleware);
app.use("/api/styles/*", authMiddleware);
app.use("/api/sync", authMiddleware);
app.route("/api/patterns", patternRoutes);
app.route("/api/styles", styleRoutes);

// ─── Sync (desktop pull) ──────────────────────────────────────────────────
// MVP: pull-only. Desktop tracks last-synced timestamp; server returns every
// document modified after it. Push is intentionally deferred — write-back
// flows through the existing PUT/POST/DELETE endpoints to keep one source of
// truth for mutation logic.
app.post("/api/sync", async (c) => {
  const userId = c.get("userId" as never) as string;
  let body: { since?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const since = body.since ? new Date(body.since) : new Date(0);
  if (Number.isNaN(since.getTime())) {
    return c.json({ error: "Invalid 'since' timestamp" }, 400);
  }

  const db = createDb(c.env.HYPERDRIVE.connectionString);
  const { pullDocumentsSince } = await import("./db/queries/sync.ts");
  const pulled = await pullDocumentsSince(db, userId, since);

  return c.json({
    pulled,
    server_now: new Date().toISOString(),
  });
});

// ─── User Profile ─────────────────────────────────────────────────────────
app.get("/api/me", async (c) => {
  const userId = c.get("userId" as never) as string;
  const db = createDb(c.env.HYPERDRIVE.connectionString);
  const user = await getUserById(db, userId);
  return c.json({ id: userId, email: user?.email ?? "" });
});

// Create document
app.post("/api/documents", async (c) => {
  const userId = c.get("userId" as never) as string;
  let body: { title?: string; folder_id?: string; workspace_id?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (body.title && (typeof body.title !== "string" || body.title.length > MAX_TITLE_LENGTH)) {
    return c.json({ error: `Title must be a string under ${MAX_TITLE_LENGTH} characters` }, 400);
  }

  const id = crypto.randomUUID();
  const db = createDb(c.env.HYPERDRIVE.connectionString);
  await createDocument(db, {
    id,
    userId,
    title: (body.title || "Untitled").slice(0, MAX_TITLE_LENGTH),
    folderId: body.folder_id,
    workspaceId: body.workspace_id,
  });

  return c.json({ id }, 201);
});

// List documents (with optional filtering)
app.get("/api/documents", async (c) => {
  const userId = c.get("userId" as never) as string;
  const status = c.req.query("status");
  const heatMin = c.req.query("heat_min");
  const heatMax = c.req.query("heat_max");
  const hasDueDate = c.req.query("has_due_date");
  const sort = c.req.query("sort") || "updated_at";
  const order = c.req.query("order") === "asc" ? "asc" : "desc";

  const db = createDb(c.env.HYPERDRIVE.connectionString);
  const results = await listDocuments(db, {
    userId,
    workspaceId: c.req.query("workspace_id") ?? undefined,
    statuses: status ? status.split(",").map((s) => s.trim()) : undefined,
    heatMin: heatMin ? Number(heatMin) : undefined,
    heatMax: heatMax ? Number(heatMax) : undefined,
    hasDueDate: hasDueDate === "true",
    tagList: c.req.query("tags")
      ? c.req
          .query("tags")!
          .split(",")
          .map((t) => t.trim())
      : undefined,
    sortCol: sort,
    order,
  });

  return c.json(results);
});

// Get document metadata
app.get("/api/documents/:id", async (c) => {
  const userId = c.get("userId" as never) as string;
  const docId = c.req.param("id");
  const db = createDb(c.env.HYPERDRIVE.connectionString);
  const doc = await getDocument(db, docId, userId);
  if (!doc) return c.json({ error: "Not found" }, 404);
  return c.json(doc);
});

// Update document metadata (after analysis)
app.put("/api/documents/:id", async (c) => {
  const userId = c.get("userId" as never) as string;
  const docId = c.req.param("id");
  let body: {
    title?: string;
    word_count?: number;
    sentence_count?: number;
    mean_heat?: number;
    folder_id?: string | null;
    workspace_id?: string | null;
    status?: string;
    due_date?: string | null;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (
    body.title !== undefined &&
    (typeof body.title !== "string" || body.title.length > MAX_TITLE_LENGTH)
  ) {
    return c.json({ error: "Invalid title" }, 400);
  }
  if (
    body.word_count !== undefined &&
    (typeof body.word_count !== "number" || body.word_count < 0)
  ) {
    return c.json({ error: "Invalid word_count" }, 400);
  }
  if (
    body.mean_heat !== undefined &&
    (typeof body.mean_heat !== "number" || body.mean_heat < 0 || body.mean_heat > 10)
  ) {
    return c.json({ error: "Invalid mean_heat" }, 400);
  }
  const validStatuses = ["draft", "review", "final", "archived"];
  if (body.status !== undefined && !validStatuses.includes(body.status)) {
    return c.json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` }, 400);
  }

  // Check at least one field is being updated
  const hasUpdates = [
    body.title,
    body.word_count,
    body.sentence_count,
    body.mean_heat,
    body.folder_id,
    body.workspace_id,
    body.status,
    body.due_date,
  ].some((v) => v !== undefined);
  if (!hasUpdates) return c.json({ error: "No fields to update" }, 400);

  const db = createDb(c.env.HYPERDRIVE.connectionString);
  await updateDocument(db, docId, userId, {
    title: body.title,
    wordCount: body.word_count,
    sentenceCount: body.sentence_count,
    meanHeat: body.mean_heat,
    folderId: body.folder_id,
    workspaceId: body.workspace_id,
    status: body.status,
    dueDate: body.due_date,
  });

  return c.json({ ok: true });
});

// Delete document
app.delete("/api/documents/:id", async (c) => {
  const userId = c.get("userId" as never) as string;
  const docId = c.req.param("id");
  const db = createDb(c.env.HYPERDRIVE.connectionString);
  const deleted = await deleteDocument(db, docId, userId);
  if (!deleted) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

// ─── Folders ────────────────────────────────────────────────────────────────

app.post("/api/folders", async (c) => {
  const userId = c.get("userId" as never) as string;
  let body: { name: string; parent_id?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  if (!body.name || typeof body.name !== "string" || body.name.length > 100) {
    return c.json({ error: "Name required (max 100 chars)" }, 400);
  }
  const id = crypto.randomUUID();
  const db = createDb(c.env.HYPERDRIVE.connectionString);
  await createFolder(db, { id, userId, name: body.name.slice(0, 100), parentId: body.parent_id });
  return c.json({ id }, 201);
});

app.get("/api/folders", async (c) => {
  const userId = c.get("userId" as never) as string;
  const db = createDb(c.env.HYPERDRIVE.connectionString);
  const results = await listFolders(db, userId);
  return c.json(results);
});

app.put("/api/folders/:id", async (c) => {
  const userId = c.get("userId" as never) as string;
  const folderId = c.req.param("id");
  let body: { name?: string; parent_id?: string | null };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  if (body.name !== undefined && (typeof body.name !== "string" || body.name.length > 100)) {
    return c.json({ error: "Invalid name" }, 400);
  }
  if (body.name === undefined && body.parent_id === undefined) {
    return c.json({ error: "No fields to update" }, 400);
  }
  const db = createDb(c.env.HYPERDRIVE.connectionString);
  await updateFolder(db, folderId, userId, { name: body.name, parentId: body.parent_id });
  return c.json({ ok: true });
});

app.delete("/api/folders/:id", async (c) => {
  const userId = c.get("userId" as never) as string;
  const folderId = c.req.param("id");
  const db = createDb(c.env.HYPERDRIVE.connectionString);
  const deleted = await deleteFolder(db, folderId, userId);
  if (!deleted) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

// ─── Workspaces ────────────────────────────────────────────────────────────

app.post("/api/workspaces", async (c) => {
  const userId = c.get("userId" as never) as string;
  let body: { name: string; slug: string; description?: string; icon?: string; color?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  if (!body.name || !body.slug) return c.json({ error: "name and slug required" }, 400);
  const slug = body.slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .slice(0, 50);
  const id = crypto.randomUUID();
  const db = createDb(c.env.HYPERDRIVE.connectionString);
  await createWorkspace(db, {
    id,
    ownerId: userId,
    name: body.name.slice(0, 100),
    slug,
    description: body.description,
    icon: body.icon,
    color: body.color,
  });
  return c.json({ id }, 201);
});

app.get("/api/workspaces", async (c) => {
  const userId = c.get("userId" as never) as string;
  const db = createDb(c.env.HYPERDRIVE.connectionString);
  const results = await listWorkspaces(db, userId);
  return c.json(results);
});

app.put("/api/workspaces/:id", async (c) => {
  const userId = c.get("userId" as never) as string;
  const wsId = c.req.param("id");
  const db = createDb(c.env.HYPERDRIVE.connectionString);

  const role = await getMemberRole(db, wsId, userId);
  if (!role || (role !== "owner" && role !== "admin")) {
    return c.json({ error: "Not authorized" }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const hasFields = ["name", "slug", "description", "icon", "color", "archived", "settings"].some(
    (f) => body[f] !== undefined,
  );
  if (!hasFields) return c.json({ error: "No fields to update" }, 400);

  if (body.settings !== undefined) {
    const validated = validateWorkspaceSettings(body.settings);
    if (!validated.ok) return c.json({ error: validated.error }, 400);
    body.settings = validated.value;
  }

  await updateWorkspace(db, wsId, body);
  return c.json({ ok: true });
});

app.delete("/api/workspaces/:id", async (c) => {
  const userId = c.get("userId" as never) as string;
  const wsId = c.req.param("id");
  const db = createDb(c.env.HYPERDRIVE.connectionString);
  const role = await getMemberRole(db, wsId, userId);
  if (role !== "owner") return c.json({ error: "Only the owner can delete" }, 403);
  await deleteWorkspace(db, wsId);
  return c.json({ ok: true });
});

app.get("/api/workspaces/:id/analytics", async (c) => {
  const userId = c.get("userId" as never) as string;
  const wsId = c.req.param("id");
  const db = createDb(c.env.HYPERDRIVE.connectionString);

  if (!(await isMember(db, wsId, userId))) {
    return c.json({ error: "Not a member" }, 403);
  }

  const analytics = await getWorkspaceAnalytics(db, wsId, userId);
  return c.json(analytics);
});

app.get("/api/workspaces/:id/tags", async (c) => {
  const userId = c.get("userId" as never) as string;
  const wsId = c.req.param("id");
  const db = createDb(c.env.HYPERDRIVE.connectionString);
  const tags = await getWorkspaceTags(db, wsId, userId);
  return c.json(tags);
});

// ─── Document Tags ─────────────────────────────────────────────────────────

app.post("/api/documents/:id/tags", async (c) => {
  const userId = c.get("userId" as never) as string;
  const docId = c.req.param("id");
  const db = createDb(c.env.HYPERDRIVE.connectionString);

  if (!(await verifyDocOwnership(db, docId, userId))) {
    return c.json({ error: "Not found" }, 404);
  }

  let body: { tags: string[] };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  if (!Array.isArray(body.tags)) return c.json({ error: "tags must be an array" }, 400);

  const tags = body.tags
    .slice(0, 20)
    .map((t) => String(t).trim().slice(0, 50))
    .filter(Boolean);
  await addTags(db, docId, tags);
  return c.json({ ok: true });
});

app.delete("/api/documents/:id/tags/:tag", async (c) => {
  const userId = c.get("userId" as never) as string;
  const docId = c.req.param("id");
  const tag = decodeURIComponent(c.req.param("tag"));
  const db = createDb(c.env.HYPERDRIVE.connectionString);

  if (!(await verifyDocOwnership(db, docId, userId))) {
    return c.json({ error: "Not found" }, 404);
  }

  await removeTag(db, docId, tag);
  return c.json({ ok: true });
});

// ─── Templates ─────────────────────────────────────────────────────────────

app.post("/api/templates", async (c) => {
  const userId = c.get("userId" as never) as string;
  let body: {
    title: string;
    content: string;
    workspace_id?: string;
    description?: string;
    default_tags?: string[];
    default_style?: string;
    is_shared?: boolean;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  if (!body.title || !body.content) return c.json({ error: "title and content required" }, 400);
  const id = crypto.randomUUID();
  const db = createDb(c.env.HYPERDRIVE.connectionString);
  await createTemplate(db, {
    id,
    userId,
    title: body.title,
    content: body.content,
    workspaceId: body.workspace_id,
    description: body.description,
    defaultTags: body.default_tags,
    defaultStyle: body.default_style,
    isShared: body.is_shared,
  });
  return c.json({ id }, 201);
});

app.get("/api/templates", async (c) => {
  const userId = c.get("userId" as never) as string;
  const db = createDb(c.env.HYPERDRIVE.connectionString);
  const results = await listTemplates(db, userId, c.req.query("workspace_id") ?? undefined);
  return c.json(results);
});

app.delete("/api/templates/:id", async (c) => {
  const userId = c.get("userId" as never) as string;
  const tplId = c.req.param("id");
  const db = createDb(c.env.HYPERDRIVE.connectionString);
  const deleted = await deleteTemplate(db, tplId, userId);
  if (!deleted) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

// ─── Share Links ───────────────────────────────────────────────────────────

app.post("/api/documents/:id/share", async (c) => {
  const userId = c.get("userId" as never) as string;
  const docId = c.req.param("id");
  const db = createDb(c.env.HYPERDRIVE.connectionString);

  if (!(await verifyDocOwnership(db, docId, userId))) {
    return c.json({ error: "Not found" }, 404);
  }

  let body: { permission?: string; expires_in_days?: number };
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }

  const id = crypto.randomUUID();
  const token = Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const expiresAt = body.expires_in_days
    ? new Date(Date.now() + body.expires_in_days * 86400000).toISOString()
    : null;

  await createShareLink(db, {
    id,
    documentId: docId,
    createdBy: userId,
    permission: body.permission || "view",
    token,
    expiresAt,
  });

  return c.json(
    { id, token, url: `${allowedOrigins(c.env)[0] ?? DEFAULT_ORIGIN}/shared/${token}` },
    201,
  );
});

app.get("/api/documents/:id/shares", async (c) => {
  const userId = c.get("userId" as never) as string;
  const docId = c.req.param("id");
  const db = createDb(c.env.HYPERDRIVE.connectionString);
  const results = await listShareLinks(db, docId, userId);
  return c.json(results);
});

app.delete("/api/shares/:id", async (c) => {
  const userId = c.get("userId" as never) as string;
  const shareId = c.req.param("id");
  const db = createDb(c.env.HYPERDRIVE.connectionString);
  const deleted = await deleteShareLink(db, shareId, userId);
  if (!deleted) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

// Public shared document view (no auth required)
app.get("/api/shared/:token", async (c) => {
  const token = c.req.param("token");
  const db = createDb(c.env.HYPERDRIVE.connectionString);

  const link = await getShareLinkByToken(db, token);
  if (!link) return c.json({ error: "Invalid or expired link" }, 404);
  if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
    return c.json({ error: "Link has expired" }, 410);
  }

  const doc = await getDocumentPublic(db, link.documentId);
  if (!doc) return c.json({ error: "Document not found" }, 404);
  return c.json({ document: doc, permission: link.permission });
});

// ─── Prompts (admin only) ───────────────────────────────────────────────────

app.get("/api/prompts", authMiddleware, async (c) => {
  const userId = c.get("userId" as never) as string;
  const db = createDb(c.env.HYPERDRIVE.connectionString);
  if (!(await isAdmin(db, userId))) return c.json({ error: "Admin access required" }, 403);
  const results = await listPrompts(db);
  return c.json(results);
});

app.put("/api/prompts/:id", authMiddleware, async (c) => {
  const userId = c.get("userId" as never) as string;
  const promptId = c.req.param("id")!;
  const db = createDb(c.env.HYPERDRIVE.connectionString);
  if (!(await isAdmin(db, userId))) return c.json({ error: "Admin access required" }, 403);
  const body = await c.req.json<{ content: string }>();
  if (!body.content?.trim()) return c.json({ error: "Content required" }, 400);
  await upsertPrompt(db, promptId, body.content, userId);
  return c.json({ ok: true });
});

// ─── Style Guides (user-created) ────────────────────────────────────────────

app.get("/api/guides", authMiddleware, async (c) => {
  const userId = c.get("userId" as never) as string;
  const db = createDb(c.env.HYPERDRIVE.connectionString);
  const results = await listGuides(db, userId);
  return c.json(results);
});

app.post("/api/guides", authMiddleware, async (c) => {
  const userId = c.get("userId" as never) as string;
  const body = await c.req.json<{ name: string; description?: string; targets: string }>();
  if (!body.name?.trim()) return c.json({ error: "Name required" }, 400);
  const id = crypto.randomUUID();
  const db = createDb(c.env.HYPERDRIVE.connectionString);
  await createGuide(db, {
    id,
    name: body.name.trim(),
    description: body.description ?? "",
    targets: body.targets,
    userId,
  });
  return c.json({ id }, 201);
});

app.delete("/api/guides/:id", authMiddleware, async (c) => {
  const userId = c.get("userId" as never) as string;
  const guideId = c.req.param("id")!;
  const db = createDb(c.env.HYPERDRIVE.connectionString);
  const deleted = await deleteGuide(db, guideId, userId);
  if (!deleted) return c.json({ error: "Not found or not deletable" }, 404);
  return c.json({ ok: true });
});

// ─── Batch Analysis REST API ──────────────────────────────────────────────────

app.post("/api/analyze", authMiddleware, async (c) => {
  let body: { texts: string[]; style?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (!Array.isArray(body.texts) || body.texts.length === 0) {
    return c.json({ error: "texts must be a non-empty array" }, 400);
  }

  if (body.texts.length > 10) {
    return c.json({ error: "Maximum 10 texts per request" }, 400);
  }

  for (const text of body.texts) {
    if (typeof text !== "string" || text.length > MAX_TEXT_LENGTH) {
      return c.json(
        { error: `Each text must be a string under ${MAX_TEXT_LENGTH} characters` },
        400,
      );
    }
  }

  let classifier;
  try {
    classifier = createClassifier(c.env);
  } catch {
    return c.json({ error: "No API keys configured for classification" }, 500);
  }

  const gateClassifier = createGateClassifier(c.env);
  const mediumClassifier = createMediumClassifier(c.env);
  const ctx = {
    cache: new NullCache(),
    classifier,
    gateClassifier: gateClassifier ?? undefined,
    mediumClassifier: mediumClassifier ?? undefined,
  };

  const profiles = await mapPool(body.texts, BATCH_ANALYZE_CONCURRENCY, async (text) => {
    const { profile } = await classifyText(text, ctx, body.style);
    return profile;
  });

  return c.json({ profiles });
});

// Get document iterations (via DO)
app.get("/api/documents/:id/iterations", async (c) => {
  const docId = c.req.param("id");
  const doId = c.env.DOCUMENT.idFromName(docId);
  const stub = c.env.DOCUMENT.get(doId);

  const url = new URL(c.req.url);
  url.pathname = `/iterations`;
  const response = await stub.fetch(new Request(url.toString()));
  return response;
});

// WebSocket upgrade — routes to Durable Object
app.get("/api/documents/:id/ws", async (c) => {
  const docId = c.req.param("id");
  const userId = c.get("userId" as never) as string;
  const upgradeHeader = c.req.header("Upgrade");

  if (!upgradeHeader || upgradeHeader !== "websocket") {
    return c.json({ error: "Expected WebSocket upgrade" }, 426);
  }

  const doId = c.env.DOCUMENT.idFromName(docId);
  const stub = c.env.DOCUMENT.get(doId);

  // Forward the request to the DO, passing userId for rate limiting
  const url = new URL(c.req.url);
  url.pathname = `/ws`;
  url.searchParams.set("userId", userId);
  return stub.fetch(new Request(url.toString(), c.req.raw));
});

export default app;

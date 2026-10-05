import type { PatternEntry } from "@prosodeus/core";
import { PATTERN_REGISTRY, splitAndHash } from "@prosodeus/core";
import type {
  PatternCreateRequest,
  PatternDetail,
  PatternImportResult,
  PatternListItem,
  PatternVersion,
} from "@prosodeus/shared";
import { generateText } from "ai";
import { Hono } from "hono";
import { createDb } from "./db/index.ts";
import {
  createPatternVersion,
  deletePattern as deletePatternQuery,
  exportUserPatterns,
  getPattern,
  getPatternById,
  getPatternVersion,
  getUserPatternIds,
  insertPattern,
  listPatternVersions,
  listUserPatterns,
  patternIdExists,
  updatePattern as updatePatternQuery,
} from "./db/queries/patterns.ts";
import type { Env } from "./index.ts";
import { createClassifier, resolveModel } from "./models.ts";

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Convert a platform PatternEntry to the API list item shape */
function platformToListItem(p: PatternEntry): PatternListItem {
  return {
    id: `platform:${p.id}`,
    pattern_id: p.id,
    taxonomy_id: p.taxonomy_id,
    name: p.name,
    level: p.level,
    scope: "platform",
    heat_weight: p.heat_weight,
    self_amplification: p.self_amplification,
    severity: p.severity,
    tags: p.tags ?? [],
    is_enabled: true,
    updated_at: new Date().toISOString(),
  };
}

/** Convert a platform PatternEntry to the API detail shape */
function platformToDetail(p: PatternEntry): PatternDetail {
  return {
    ...platformToListItem(p),
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

/** Convert a Drizzle row to the API list item shape */
function rowToListItem(row: Record<string, any>): PatternListItem {
  return {
    id: row.id,
    pattern_id: row.patternId,
    taxonomy_id: row.taxonomyId ?? "",
    name: row.name,
    level: row.level,
    scope: "user",
    heat_weight: row.heatWeight,
    self_amplification: row.selfAmplification,
    severity: row.severity ?? "medium",
    tags: JSON.parse(row.tags || "[]"),
    is_enabled: row.isEnabled,
    forked_from: row.forkedFrom,
    updated_at: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  };
}

/** Convert a Drizzle row to the API detail shape */
function rowToDetail(row: Record<string, any>): PatternDetail {
  return {
    ...rowToListItem(row),
    description: row.description || "",
    examples: JSON.parse(row.examples || "[]"),
    false_positives: JSON.parse(row.falsePositives || "[]"),
    substitutions: JSON.parse(row.substitutions || "[]"),
    false_substitutions: JSON.parse(row.falseSubstitutions || "[]"),
    detection_hint: row.detectionHint,
    rewrite_menu: JSON.parse(row.rewriteMenu || "[]"),
    pce_directive: row.pceDirective || "",
    tolerance_overrides: JSON.parse(row.toleranceOverrides || "{}"),
    related_patterns: JSON.parse(row.relatedPatterns || "[]"),
    detection_notes: row.detectionNotes,
    research_sources: JSON.parse(row.researchSources || "[]"),
    created_by: row.userId,
    created_at: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    version: row.version,
  };
}

function matchesSearch(p: PatternListItem, search: string): boolean {
  const s = search.toLowerCase();
  return (
    p.pattern_id.toLowerCase().includes(s) ||
    p.name.toLowerCase().includes(s) ||
    p.taxonomy_id.toLowerCase().includes(s)
  );
}

// ─── Routes ────────────────────────────────────────────────────────────────

const patterns = new Hono<{ Bindings: Env }>();

// List all visible patterns (platform + user)
patterns.get("/", async (c) => {
  const userId = c.get("userId" as never) as string;
  const levelFilter = c.req.query("level");
  const scopeFilter = c.req.query("scope");
  const search = c.req.query("search")?.trim();
  const tagsFilter = c.req.query("tags");
  const sort = c.req.query("sort") ?? "taxonomy_id";
  const limit = Math.min(parseInt(c.req.query("limit") ?? "200"), 500);
  const offset = parseInt(c.req.query("offset") ?? "0");

  const levels = levelFilter ? levelFilter.split(",") : null;
  const scopes = scopeFilter ? scopeFilter.split(",") : null;
  const tags = tagsFilter ? tagsFilter.split(",") : null;

  // Platform patterns (from registry, filtered in-memory)
  let platformItems: PatternListItem[] = [];
  if (!scopes || scopes.includes("platform")) {
    platformItems = PATTERN_REGISTRY.map(platformToListItem).filter((p) => {
      if (levels && !levels.includes(p.level)) return false;
      if (search && !matchesSearch(p, search)) return false;
      if (tags && !tags.some((t) => p.tags.includes(t))) return false;
      return true;
    });
  }

  // User patterns (from Postgres)
  let userItems: PatternListItem[] = [];
  if (!scopes || scopes.includes("user")) {
    const db = createDb(c.env.HYPERDRIVE.connectionString);
    const rows = await listUserPatterns(db, userId, {
      levels: levels ?? undefined,
      search: search ?? undefined,
    });

    userItems = rows.map((r) => rowToListItem(r as Record<string, any>));

    // Tag filter in-memory (json_each isn't worth the complexity here)
    if (tags) {
      userItems = userItems.filter((p) => tags.some((t) => p.tags.includes(t)));
    }
  }

  // Merge and sort
  let merged = [...platformItems, ...userItems];

  merged.sort((a, b) => {
    switch (sort) {
      case "name":
        return a.name.localeCompare(b.name);
      case "level":
        return a.level.localeCompare(b.level) || a.taxonomy_id.localeCompare(b.taxonomy_id);
      case "updated_at":
        return b.updated_at.localeCompare(a.updated_at);
      default: // taxonomy_id
        return a.taxonomy_id.localeCompare(b.taxonomy_id);
    }
  });

  const total = merged.length;
  merged = merged.slice(offset, offset + limit);

  return c.json({ patterns: merged, total, offset, limit });
});

// Export patterns as JSON
patterns.get("/export", async (c) => {
  const userId = c.get("userId" as never) as string;
  const scopeFilter = c.req.query("scope");
  const levelFilter = c.req.query("level");
  const idsFilter = c.req.query("ids");

  const result: PatternDetail[] = [];

  // Platform patterns
  if (!scopeFilter || scopeFilter === "platform") {
    let items = PATTERN_REGISTRY;
    if (levelFilter) items = items.filter((p) => p.level === levelFilter);
    if (idsFilter) {
      const ids = idsFilter.split(",");
      items = items.filter((p) => ids.includes(`platform:${p.id}`));
    }
    result.push(...items.map(platformToDetail));
  }

  // User patterns
  if (!scopeFilter || scopeFilter === "user") {
    const db = createDb(c.env.HYPERDRIVE.connectionString);
    const rows = await exportUserPatterns(db, userId, levelFilter ?? undefined);
    let userDetails = rows.map((r) => rowToDetail(r as Record<string, any>));
    if (idsFilter) {
      const ids = new Set(idsFilter.split(","));
      userDetails = userDetails.filter((p) => ids.has(p.id));
    }
    result.push(...userDetails);
  }

  return c.json({
    version: 1,
    exported_at: new Date().toISOString(),
    source: "Prosodeus",
    patterns: result,
  });
});

// Import patterns
patterns.post("/import", async (c) => {
  const userId = c.get("userId" as never) as string;
  let body: { patterns: PatternCreateRequest[]; dry_run?: boolean };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (!Array.isArray(body.patterns) || body.patterns.length === 0) {
    return c.json({ error: "patterns must be a non-empty array" }, 400);
  }

  if (body.patterns.length > 100) {
    return c.json({ error: "Maximum 100 patterns per import" }, 400);
  }

  const db = createDb(c.env.HYPERDRIVE.connectionString);

  // Load existing user pattern_ids for conflict detection
  const existingIds = await getUserPatternIds(db, userId);
  const platformIds = new Set(PATTERN_REGISTRY.map((p) => p.id));

  const result: PatternImportResult = { valid: 0, invalid: 0, conflicts: [], created_ids: [] };

  for (const p of body.patterns) {
    if (!p.pattern_id || !p.name || !p.level || !p.detection_hint) {
      result.invalid++;
      continue;
    }
    if (!["lexical", "sentence", "paragraph", "document"].includes(p.level)) {
      result.invalid++;
      continue;
    }
    if (existingIds.has(p.pattern_id)) {
      result.conflicts.push({
        pattern_id: p.pattern_id,
        reason: "Already exists in your patterns",
      });
      continue;
    }
    result.valid++;
  }

  if (body.dry_run) {
    return c.json(result);
  }

  // Actually import valid patterns
  const createdIds: string[] = [];
  for (const p of body.patterns) {
    if (!p.pattern_id || !p.name || !p.level || !p.detection_hint) continue;
    if (!["lexical", "sentence", "paragraph", "document"].includes(p.level)) continue;
    if (existingIds.has(p.pattern_id)) continue;

    const id = crypto.randomUUID();
    const forkedFrom = platformIds.has(p.pattern_id) ? p.pattern_id : null;

    await insertPattern(db, {
      id,
      patternId: p.pattern_id,
      taxonomyId: p.taxonomy_id ?? null,
      name: p.name,
      level: p.level,
      userId,
      heatWeight: p.heat_weight ?? 1.0,
      selfAmplification: p.self_amplification ?? "med",
      detectionHint: p.detection_hint,
      rewriteMenu: JSON.stringify(p.rewrite_menu ?? []),
      pceDirective: p.pce_directive ?? "",
      toleranceOverrides: JSON.stringify(p.tolerance_overrides ?? {}),
      description: p.description ?? "",
      examples: JSON.stringify(p.examples ?? []),
      falsePositives: JSON.stringify(p.false_positives ?? []),
      substitutions: JSON.stringify(p.substitutions ?? []),
      falseSubstitutions: JSON.stringify(p.false_substitutions ?? []),
      tags: JSON.stringify(p.tags ?? []),
      severity: p.severity ?? "medium",
      relatedPatterns: JSON.stringify(p.related_patterns ?? []),
      detectionNotes: p.detection_notes ?? null,
      researchSources: JSON.stringify(p.research_sources ?? []),
      forkedFrom,
    });

    createdIds.push(id);
    existingIds.add(p.pattern_id);
  }

  result.created_ids = createdIds;
  return c.json(result, 201);
});

// Get single pattern
patterns.get("/:id", async (c) => {
  const userId = c.get("userId" as never) as string;
  const id = c.req.param("id");

  // Platform pattern?
  if (id.startsWith("platform:")) {
    const patternId = id.slice("platform:".length);
    const entry = PATTERN_REGISTRY.find((p) => p.id === patternId);
    if (!entry) return c.json({ error: "Not found" }, 404);
    return c.json(platformToDetail(entry));
  }

  const db = createDb(c.env.HYPERDRIVE.connectionString);
  const row = await getPattern(db, id, userId);
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(rowToDetail(row as Record<string, any>));
});

// Create user pattern
patterns.post("/", async (c) => {
  const userId = c.get("userId" as never) as string;
  let body: PatternCreateRequest;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (!body.pattern_id || !body.name || !body.level || !body.detection_hint) {
    return c.json({ error: "pattern_id, name, level, and detection_hint are required" }, 400);
  }

  if (!["lexical", "sentence", "paragraph", "document"].includes(body.level)) {
    return c.json({ error: "level must be lexical, sentence, paragraph, or document" }, 400);
  }

  if (body.pattern_id.length > 100 || !/^[a-z0-9_]+$/.test(body.pattern_id)) {
    return c.json(
      { error: "pattern_id must be lowercase alphanumeric with underscores, max 100 chars" },
      400,
    );
  }

  const db = createDb(c.env.HYPERDRIVE.connectionString);

  // Check uniqueness
  if (await patternIdExists(db, body.pattern_id, userId)) {
    return c.json({ error: "A pattern with this ID already exists" }, 409);
  }

  const id = crypto.randomUUID();

  await insertPattern(db, {
    id,
    patternId: body.pattern_id,
    taxonomyId: body.taxonomy_id ?? null,
    name: body.name,
    level: body.level,
    userId,
    heatWeight: body.heat_weight ?? 1.0,
    selfAmplification: body.self_amplification ?? "med",
    detectionHint: body.detection_hint,
    rewriteMenu: JSON.stringify(body.rewrite_menu ?? []),
    pceDirective: body.pce_directive ?? "",
    toleranceOverrides: JSON.stringify(body.tolerance_overrides ?? {}),
    description: body.description ?? "",
    examples: JSON.stringify(body.examples ?? []),
    falsePositives: JSON.stringify(body.false_positives ?? []),
    substitutions: JSON.stringify(body.substitutions ?? []),
    falseSubstitutions: JSON.stringify(body.false_substitutions ?? []),
    tags: JSON.stringify(body.tags ?? []),
    severity: body.severity ?? "medium",
    relatedPatterns: JSON.stringify(body.related_patterns ?? []),
    detectionNotes: body.detection_notes ?? null,
    researchSources: JSON.stringify(body.research_sources ?? []),
  });

  // Create initial version
  const detail = await getPatternById(db, id);
  await createPatternVersion(db, {
    patternId: id,
    versionNumber: 1,
    snapshot: JSON.stringify(detail),
    changedBy: userId,
  });

  return c.json({ id }, 201);
});

// Update user pattern
patterns.put("/:id", async (c) => {
  const userId = c.get("userId" as never) as string;
  const id = c.req.param("id");

  if (id.startsWith("platform:")) {
    return c.json({ error: "Cannot edit platform patterns. Fork it instead." }, 403);
  }

  const db = createDb(c.env.HYPERDRIVE.connectionString);

  const existing = await getPattern(db, id, userId);
  if (!existing) return c.json({ error: "Not found" }, 404);

  let body: Partial<PatternCreateRequest>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (body.pattern_id !== undefined && body.pattern_id !== existing.patternId) {
    return c.json({ error: "Cannot change pattern_id after creation" }, 400);
  }

  // Map snake_case request body to camelCase Drizzle fields
  const data: Record<string, any> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.level !== undefined) data.level = body.level;
  if (body.heat_weight !== undefined) data.heatWeight = body.heat_weight;
  if (body.self_amplification !== undefined) data.selfAmplification = body.self_amplification;
  if (body.detection_hint !== undefined) data.detectionHint = body.detection_hint;
  if (body.pce_directive !== undefined) data.pceDirective = body.pce_directive;
  if (body.description !== undefined) data.description = body.description;
  if (body.severity !== undefined) data.severity = body.severity;
  if (body.detection_notes !== undefined) data.detectionNotes = body.detection_notes;
  if (body.taxonomy_id !== undefined) data.taxonomyId = body.taxonomy_id;
  if (body.rewrite_menu !== undefined) data.rewriteMenu = body.rewrite_menu;
  if (body.tolerance_overrides !== undefined) data.toleranceOverrides = body.tolerance_overrides;
  if (body.examples !== undefined) data.examples = body.examples;
  if (body.false_positives !== undefined) data.falsePositives = body.false_positives;
  if (body.substitutions !== undefined) data.substitutions = body.substitutions;
  if (body.false_substitutions !== undefined) data.falseSubstitutions = body.false_substitutions;
  if (body.tags !== undefined) data.tags = body.tags;
  if (body.related_patterns !== undefined) data.relatedPatterns = body.related_patterns;
  if (body.research_sources !== undefined) data.researchSources = body.research_sources;

  if (Object.keys(data).length === 0) return c.json({ error: "No fields to update" }, 400);

  await updatePatternQuery(db, id, userId, data);

  // Snapshot for version history
  const updated = await getPatternById(db, id);
  const newVersion = updated!.version;

  const updatedFields = Object.keys(data).join(", ");
  await createPatternVersion(db, {
    patternId: id,
    versionNumber: newVersion,
    snapshot: JSON.stringify(updated),
    changeSummary: `Updated: ${updatedFields}`,
    changedBy: userId,
  });

  return c.json({ ok: true });
});

// Delete user pattern
patterns.delete("/:id", async (c) => {
  const userId = c.get("userId" as never) as string;
  const id = c.req.param("id");

  if (id.startsWith("platform:")) {
    return c.json({ error: "Cannot delete platform patterns" }, 403);
  }

  const db = createDb(c.env.HYPERDRIVE.connectionString);
  const deleted = await deletePatternQuery(db, id, userId);
  if (!deleted) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

// Fork a platform pattern into user scope
patterns.post("/:id/fork", async (c) => {
  const userId = c.get("userId" as never) as string;
  const id = c.req.param("id");

  if (!id.startsWith("platform:")) {
    return c.json({ error: "Can only fork platform patterns" }, 400);
  }

  const patternId = id.slice("platform:".length);
  const source = PATTERN_REGISTRY.find((p) => p.id === patternId);
  if (!source) return c.json({ error: "Platform pattern not found" }, 404);

  const db = createDb(c.env.HYPERDRIVE.connectionString);

  // Check if already forked
  if (await patternIdExists(db, patternId, userId)) {
    return c.json({ error: "You already have a fork of this pattern" }, 409);
  }

  let overrides: Partial<PatternCreateRequest> = {};
  try {
    const body = await c.req.json<{ overrides?: Partial<PatternCreateRequest> }>();
    overrides = body.overrides ?? {};
  } catch {
    // No body is fine — fork with defaults
  }

  const newId = crypto.randomUUID();

  await insertPattern(db, {
    id: newId,
    patternId,
    taxonomyId: source.taxonomy_id,
    name: overrides.name ?? source.name,
    level: overrides.level ?? source.level,
    userId,
    heatWeight: overrides.heat_weight ?? source.heat_weight,
    selfAmplification: overrides.self_amplification ?? source.self_amplification,
    detectionHint: overrides.detection_hint ?? source.detection_hint,
    rewriteMenu: JSON.stringify(overrides.rewrite_menu ?? source.rewrite_menu),
    pceDirective: overrides.pce_directive ?? source.pce_directive,
    toleranceOverrides: JSON.stringify(overrides.tolerance_overrides ?? source.tolerance_overrides),
    description: overrides.description ?? source.description ?? "",
    examples: JSON.stringify(overrides.examples ?? source.examples ?? []),
    falsePositives: JSON.stringify(overrides.false_positives ?? source.false_positives ?? []),
    substitutions: JSON.stringify(overrides.substitutions ?? source.substitutions ?? []),
    falseSubstitutions: JSON.stringify(
      overrides.false_substitutions ?? source.false_substitutions ?? [],
    ),
    tags: JSON.stringify(overrides.tags ?? source.tags ?? []),
    severity: overrides.severity ?? source.severity ?? "medium",
    relatedPatterns: JSON.stringify(overrides.related_patterns ?? source.related_patterns ?? []),
    detectionNotes: overrides.detection_notes ?? source.detection_notes ?? null,
    researchSources: JSON.stringify(overrides.research_sources ?? source.research_sources ?? []),
    forkedFrom: patternId,
  });

  // Create initial version
  const detail = await getPatternById(db, newId);
  await createPatternVersion(db, {
    patternId: newId,
    versionNumber: 1,
    snapshot: JSON.stringify(detail),
    changeSummary: `Forked from platform:${patternId}`,
    changedBy: userId,
  });

  return c.json({ id: newId }, 201);
});

// Get version history
patterns.get("/:id/versions", async (c) => {
  const userId = c.get("userId" as never) as string;
  const id = c.req.param("id");

  if (id.startsWith("platform:")) {
    return c.json({ versions: [] });
  }

  const db = createDb(c.env.HYPERDRIVE.connectionString);

  const exists = await getPattern(db, id, userId);
  if (!exists) return c.json({ error: "Not found" }, 404);

  const rows = await listPatternVersions(db, id);
  const versions: PatternVersion[] = rows.map((r) => ({
    version_number: r.versionNumber,
    snapshot: JSON.parse(r.snapshot),
    change_summary: r.changeSummary ?? undefined,
    changed_by: r.changedBy ?? undefined,
    created_at: r.createdAt instanceof Date ? r.createdAt.toISOString() : (r.createdAt ?? ""),
  }));

  return c.json({ versions });
});

// Revert to a specific version
patterns.post("/:id/revert", async (c) => {
  const userId = c.get("userId" as never) as string;
  const id = c.req.param("id");

  if (id.startsWith("platform:")) {
    return c.json({ error: "Cannot revert platform patterns" }, 403);
  }

  let body: { version: number };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (!body.version || typeof body.version !== "number") {
    return c.json({ error: "version number required" }, 400);
  }

  const db = createDb(c.env.HYPERDRIVE.connectionString);

  const existing = await getPattern(db, id, userId);
  if (!existing) return c.json({ error: "Not found" }, 404);

  const snapshotJson = await getPatternVersion(db, id, body.version);
  if (!snapshotJson) return c.json({ error: "Version not found" }, 404);

  const snapshot = JSON.parse(snapshotJson) as Record<string, any>;

  // Map snapshot fields to camelCase for update
  const data: Record<string, any> = {
    name: snapshot.name,
    level: snapshot.level,
    heatWeight: snapshot.heat_weight ?? snapshot.heatWeight,
    selfAmplification: snapshot.self_amplification ?? snapshot.selfAmplification,
    detectionHint: snapshot.detection_hint ?? snapshot.detectionHint,
    rewriteMenu: snapshot.rewrite_menu ?? snapshot.rewriteMenu,
    pceDirective: snapshot.pce_directive ?? snapshot.pceDirective,
    toleranceOverrides: snapshot.tolerance_overrides ?? snapshot.toleranceOverrides,
    description: snapshot.description,
    examples: snapshot.examples,
    falsePositives: snapshot.false_positives ?? snapshot.falsePositives,
    substitutions: snapshot.substitutions,
    falseSubstitutions: snapshot.false_substitutions ?? snapshot.falseSubstitutions,
    tags: snapshot.tags,
    severity: snapshot.severity,
    relatedPatterns: snapshot.related_patterns ?? snapshot.relatedPatterns,
    detectionNotes: snapshot.detection_notes ?? snapshot.detectionNotes,
    researchSources: snapshot.research_sources ?? snapshot.researchSources,
  };

  await updatePatternQuery(db, id, userId, data);

  // Create revert version entry
  const updated = await getPatternById(db, id);
  const newVersion = updated!.version;

  await createPatternVersion(db, {
    patternId: id,
    versionNumber: newVersion,
    snapshot: JSON.stringify(updated),
    changeSummary: `Reverted to version ${body.version}`,
    changedBy: userId,
  });

  return c.json({ ok: true, version: newVersion });
});

// AI rule synthesis from a pasted sentence.
// Classifies the sentence, then asks an LLM to draft a PatternDetail.
// Does NOT persist anything — caller decides whether to save the suggestion.
patterns.post("/suggest-from-sentence", async (c) => {
  let body: { sentence?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const sentence = (body.sentence ?? "").trim();
  if (!sentence) return c.json({ error: "sentence is required" }, 400);
  if (sentence.length > 1500) {
    return c.json({ error: "sentence must be 1500 characters or fewer" }, 400);
  }

  // 1) Run the existing classifier to detect known patterns + signals
  let classification: Record<string, unknown> = {};
  let detectedPatternTypes: string[] = [];
  try {
    const classifier = createClassifier(c.env);
    const hashed = splitAndHash(sentence);
    const classified = await classifier.classify(hashed.slice(0, 1));
    const first = classified[0]?.classification as Record<string, unknown> | undefined;
    if (first) {
      classification = first;
      const patterns = (first.patterns as Array<{ type?: string }> | undefined) ?? [];
      detectedPatternTypes = patterns.map((p) => p.type).filter((t): t is string => !!t);
    }
  } catch (err) {
    console.warn("[suggest] classifier failed, continuing with empty signals:", err);
  }

  // 2) Pick a model for the synthesizer.
  //    Prefer Groq Llama (generous free tier, decent JSON adherence), then Mistral,
  //    then Gemini Flash (limited free quota, easily exhausted).
  const synthesizer =
    resolveModel(c.env, "groq", "llama-3.3-70b-versatile") ??
    resolveModel(c.env, "mistral", "mistral-small-latest") ??
    resolveModel(c.env, "google", "gemini-2.5-flash");
  if (!synthesizer) {
    return c.json({ error: "No language model configured for suggestions" }, 503);
  }

  // 3) Synthesizer prompt
  const knownPatternList = PATTERN_REGISTRY.slice(0, 80)
    .map((p) => `- ${p.id} (${p.level}): ${p.name}`)
    .join("\n");

  const synthesizerPrompt = `You will draft a structural-prose pattern rule for the Prosodeus diagnostic engine.

A reader felt this sentence was wrong:

"""${sentence}"""

Our classifier flagged these signals: ${detectedPatternTypes.length ? detectedPatternTypes.join(", ") : "(none specific)"}.

Your job: produce ONE pattern that captures *why* this sentence feels off structurally, so the engine can detect similar sentences in future writing.

Some known patterns for reference (do not duplicate):
${knownPatternList}
...

Return ONLY a JSON object (no prose, no markdown fences) with this shape:
{
  "pattern_id": "short_snake_case",
  "name": "Human Readable Name",
  "level": "lexical|sentence|paragraph|document",
  "description": "1-2 sentence description of the structural problem",
  "detection_hint": "Exactly what to look for, in plain English. The classifier reads this.",
  "examples": [
    { "text": "An example sentence that would trigger this rule.", "note": "why this matches" }
  ],
  "false_positives": [
    { "text": "An example that LOOKS similar but is fine.", "note": "why this is acceptable" }
  ],
  "rewrite_menu": [
    "Specific rewrite directive 1",
    "Specific rewrite directive 2"
  ],
  "pce_directive": "One-line guidance for the rewriter when this pattern is detected.",
  "severity": "low|medium|high",
  "self_amplification": "low|med|high",
  "heat_weight": 1.0,
  "tags": ["rhythm", "clarity", ...]
}

The example sentence MUST appear as the first item in "examples". pattern_id must be lowercase alphanumeric with underscores.`;

  let raw: string;
  try {
    const result = await generateText({
      model: synthesizer,
      prompt: synthesizerPrompt,
      maxOutputTokens: 1200,
    });
    raw = result.text;
  } catch (err) {
    console.error("[suggest] synthesizer failed:", err);
    return c.json({ error: "Synthesizer failed" }, 502);
  }

  // 4) Extract JSON (model may wrap in ```json fences)
  const jsonText = extractJsonBlock(raw);
  let draft: Record<string, unknown>;
  try {
    draft = JSON.parse(jsonText);
  } catch (err) {
    console.error("[suggest] malformed JSON:", raw.slice(0, 500));
    return c.json({ error: "Synthesizer returned malformed JSON" }, 502);
  }

  // 5) Normalize to PatternCreateRequest shape with safe defaults
  const normalized: PatternCreateRequest = {
    pattern_id: stringOrDefault(
      draft.pattern_id,
      slugify(stringOrDefault(draft.name, "ai_suggested_pattern")),
    ),
    name: stringOrDefault(draft.name, "AI-suggested pattern"),
    level: levelOrDefault(draft.level),
    description: stringOrDefault(draft.description, ""),
    detection_hint: stringOrDefault(
      draft.detection_hint,
      "Detect sentences similar to the provided example.",
    ),
    examples: ensureExampleFirst(draft.examples, sentence),
    false_positives: arrayOrDefault(draft.false_positives, []),
    rewrite_menu: rewriteMenuOrDefault(draft.rewrite_menu),
    pce_directive: stringOrDefault(draft.pce_directive, ""),
    severity: severityOrDefault(draft.severity),
    self_amplification: amplificationOrDefault(draft.self_amplification),
    heat_weight: numberOrDefault(draft.heat_weight, 1.0),
    tags: stringArrayOrDefault(draft.tags, []),
    substitutions: [],
    false_substitutions: [],
    related_patterns: [],
    research_sources: [],
    tolerance_overrides: {},
    detection_notes: undefined,
  };

  return c.json({
    pattern: normalized,
    signals: {
      detected_pattern_types: detectedPatternTypes,
      classification,
    },
  });
});

// ─── Suggester helpers ─────────────────────────────────────────────────────

function extractJsonBlock(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced && fenced[1]) return fenced[1].trim();
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }
  return text;
}

function stringOrDefault(v: unknown, fallback: string): string {
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

function numberOrDefault(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function levelOrDefault(v: unknown): "lexical" | "sentence" | "paragraph" | "document" {
  return v === "lexical" || v === "sentence" || v === "paragraph" || v === "document"
    ? v
    : "sentence";
}

function severityOrDefault(v: unknown): "low" | "medium" | "high" | "critical" {
  return v === "low" || v === "medium" || v === "high" || v === "critical" ? v : "medium";
}

function amplificationOrDefault(v: unknown): "low" | "med" | "high" {
  return v === "low" || v === "med" || v === "high" ? v : "med";
}

function arrayOrDefault<T>(v: unknown, fallback: T[]): T[] {
  return Array.isArray(v) ? (v as T[]) : fallback;
}

function stringArrayOrDefault(v: unknown, fallback: string[]): string[] {
  return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : fallback;
}

function rewriteMenuOrDefault(v: unknown): Array<{ id: number; instruction: string }> {
  if (!Array.isArray(v)) return [];
  const items: Array<{ id: number; instruction: string }> = [];
  for (const raw of v) {
    if (typeof raw === "string" && raw.trim()) {
      items.push({ id: items.length + 1, instruction: raw.trim() });
      continue;
    }
    if (raw && typeof raw === "object") {
      const rec = raw as Record<string, unknown>;
      const instruction = pickAlias(rec, ["instruction", "text", "rewrite", "suggestion"]);
      if (instruction) items.push({ id: items.length + 1, instruction });
    }
  }
  return items;
}

function ensureExampleFirst(v: unknown, sentence: string): Array<{ text: string; note?: string }> {
  const items = Array.isArray(v) ? v : [];
  const normalized = items
    .map((item) => {
      if (typeof item === "string" && item.trim()) return { text: item.trim() };
      if (item && typeof item === "object") {
        const rec = item as Record<string, unknown>;
        const text = pickAlias(rec, ["text", "example", "sentence", "content", "snippet"]);
        const note = pickAlias(rec, ["note", "explanation", "reason", "why", "rationale"]);
        if (text) return note ? { text, note } : { text };
      }
      return null;
    })
    .filter((x): x is { text: string; note?: string } => !!x);

  if (!normalized.some((e) => e.text.trim() === sentence.trim())) {
    normalized.unshift({ text: sentence, note: "Source sentence flagged by the user" });
  }
  return normalized;
}

function pickAlias(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
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

export { patterns as patternRoutes };

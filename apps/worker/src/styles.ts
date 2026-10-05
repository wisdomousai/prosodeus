import { Hono } from "hono";
import { createDb } from "./db/index.ts";
import {
  clearDefaultStyles,
  createStyleVersion,
  deleteStyle as deleteStyleQuery,
  getStyle,
  getStyleById,
  insertStyle,
  listStyleVersions,
  listUserStyles,
  styleNameExists,
  updateStyle as updateStyleQuery,
} from "./db/queries/styles.ts";
import type { Env } from "./index.ts";

type StyleRow = {
  id: string;
  userId: string;
  name: string;
  description: string;
  policy: string;
  isDefault: boolean;
  version: number;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
};

type StyleDto = {
  id: string;
  name: string;
  description: string;
  policy: Record<string, unknown>;
  is_default: boolean;
  version: number;
  created_at: string;
  updated_at: string;
};

function rowToDto(row: StyleRow): StyleDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    policy: safeParse(row.policy),
    is_default: row.isDefault,
    version: row.version,
    created_at: row.createdAt instanceof Date ? row.createdAt.toISOString() : (row.createdAt ?? ""),
    updated_at: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : (row.updatedAt ?? ""),
  };
}

function safeParse(text: string | null | undefined): Record<string, unknown> {
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

const styles = new Hono<{ Bindings: Env }>();

// List all of the user's custom styles
styles.get("/", async (c) => {
  const userId = c.get("userId" as never) as string;
  const db = createDb(c.env.HYPERDRIVE.connectionString);
  const rows = await listUserStyles(db, userId);
  return c.json({ styles: rows.map((r) => rowToDto(r as StyleRow)) });
});

// Get a single style
styles.get("/:id", async (c) => {
  const userId = c.get("userId" as never) as string;
  const id = c.req.param("id");
  const db = createDb(c.env.HYPERDRIVE.connectionString);
  const row = await getStyle(db, id, userId);
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(rowToDto(row as StyleRow));
});

// Create a style
styles.post("/", async (c) => {
  const userId = c.get("userId" as never) as string;
  let body: {
    name?: string;
    description?: string;
    policy?: Record<string, unknown>;
    is_default?: boolean;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const name = (body.name ?? "").trim();
  if (!name) return c.json({ error: "name is required" }, 400);
  if (name.length > 80) return c.json({ error: "name must be 80 characters or fewer" }, 400);

  const db = createDb(c.env.HYPERDRIVE.connectionString);
  if (await styleNameExists(db, name, userId)) {
    return c.json({ error: "A style with this name already exists" }, 409);
  }

  if (body.is_default) await clearDefaultStyles(db, userId);

  const id = crypto.randomUUID();
  await insertStyle(db, {
    id,
    userId,
    name,
    description: (body.description ?? "").slice(0, 1000),
    policy: JSON.stringify(body.policy ?? {}),
    isDefault: !!body.is_default,
  });

  const detail = await getStyleById(db, id);
  await createStyleVersion(db, {
    styleId: id,
    versionNumber: 1,
    snapshot: JSON.stringify(detail),
    changedBy: userId,
  });

  return c.json({ id }, 201);
});

// Update a style
styles.put("/:id", async (c) => {
  const userId = c.get("userId" as never) as string;
  const id = c.req.param("id");
  const db = createDb(c.env.HYPERDRIVE.connectionString);

  const existing = await getStyle(db, id, userId);
  if (!existing) return c.json({ error: "Not found" }, 404);

  let body: {
    name?: string;
    description?: string;
    policy?: Record<string, unknown>;
    is_default?: boolean;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  // If renaming, ensure new name doesn't collide with another style
  if (body.name !== undefined) {
    const next = body.name.trim();
    if (!next) return c.json({ error: "name cannot be empty" }, 400);
    if (next.length > 80) return c.json({ error: "name must be 80 characters or fewer" }, 400);
    if (next !== (existing as StyleRow).name && (await styleNameExists(db, next, userId))) {
      return c.json({ error: "A style with this name already exists" }, 409);
    }
    body.name = next;
  }

  if (body.is_default === true) await clearDefaultStyles(db, userId);

  await updateStyleQuery(db, id, userId, {
    name: body.name,
    description: body.description?.slice(0, 1000),
    policy: body.policy,
    isDefault: body.is_default,
  });

  const updated = await getStyleById(db, id);
  const newVersion = (updated as StyleRow | null)?.version ?? 1;
  const updatedFields = Object.keys(body).join(", ");

  await createStyleVersion(db, {
    styleId: id,
    versionNumber: newVersion,
    snapshot: JSON.stringify(updated),
    changeSummary: `Updated: ${updatedFields}`,
    changedBy: userId,
  });

  return c.json({ ok: true });
});

// Delete a style
styles.delete("/:id", async (c) => {
  const userId = c.get("userId" as never) as string;
  const id = c.req.param("id");
  const db = createDb(c.env.HYPERDRIVE.connectionString);
  const deleted = await deleteStyleQuery(db, id, userId);
  if (!deleted) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

// Version history
styles.get("/:id/versions", async (c) => {
  const userId = c.get("userId" as never) as string;
  const id = c.req.param("id");
  const db = createDb(c.env.HYPERDRIVE.connectionString);
  const exists = await getStyle(db, id, userId);
  if (!exists) return c.json({ error: "Not found" }, 404);
  const rows = await listStyleVersions(db, id);
  const versions = rows.map((r) => ({
    version_number: r.versionNumber,
    snapshot: safeParse(r.snapshot),
    change_summary: r.changeSummary ?? undefined,
    changed_by: r.changedBy ?? undefined,
    created_at: r.createdAt instanceof Date ? r.createdAt.toISOString() : (r.createdAt ?? ""),
  }));
  return c.json({ versions });
});

export { styles as styleRoutes };

import { and, eq, sql } from "drizzle-orm";
import type { Database } from "../index.ts";
import { styles, styleVersions } from "../schema/styles.ts";

export async function listUserStyles(db: Database, userId: string) {
  return db.select().from(styles).where(eq(styles.userId, userId)).orderBy(styles.name);
}

export async function getStyle(db: Database, id: string, userId: string) {
  return db
    .select()
    .from(styles)
    .where(and(eq(styles.id, id), eq(styles.userId, userId)))
    .then((r) => r[0] ?? null);
}

export async function getStyleById(db: Database, id: string) {
  return db
    .select()
    .from(styles)
    .where(eq(styles.id, id))
    .then((r) => r[0] ?? null);
}

export async function styleNameExists(db: Database, name: string, userId: string) {
  const row = await db
    .select({ id: styles.id })
    .from(styles)
    .where(and(eq(styles.name, name), eq(styles.userId, userId)))
    .then((r) => r[0]);
  return !!row;
}

export async function insertStyle(db: Database, values: typeof styles.$inferInsert) {
  await db.insert(styles).values(values);
}

export async function updateStyle(
  db: Database,
  id: string,
  userId: string,
  data: {
    name?: string;
    description?: string;
    policy?: unknown;
    isDefault?: boolean;
  },
) {
  const set: Record<string, unknown> = {};
  if (data.name !== undefined) set.name = data.name;
  if (data.description !== undefined) set.description = data.description;
  if (data.policy !== undefined) set.policy = JSON.stringify(data.policy);
  if (data.isDefault !== undefined) set.isDefault = data.isDefault;

  set.version = sql`${styles.version} + 1`;
  set.updatedAt = new Date();

  await db
    .update(styles)
    .set(set)
    .where(and(eq(styles.id, id), eq(styles.userId, userId)));
}

export async function clearDefaultStyles(db: Database, userId: string) {
  await db
    .update(styles)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(eq(styles.userId, userId));
}

export async function deleteStyle(db: Database, id: string, userId: string) {
  const result = await db
    .delete(styles)
    .where(and(eq(styles.id, id), eq(styles.userId, userId)))
    .returning({ id: styles.id });
  return result.length > 0;
}

export async function createStyleVersion(
  db: Database,
  params: {
    styleId: string;
    versionNumber: number;
    snapshot: string;
    changeSummary?: string;
    changedBy: string;
  },
) {
  await db.insert(styleVersions).values({
    styleId: params.styleId,
    versionNumber: params.versionNumber,
    snapshot: params.snapshot,
    changeSummary: params.changeSummary,
    changedBy: params.changedBy,
  });
}

export async function listStyleVersions(db: Database, styleId: string) {
  return db
    .select({
      versionNumber: styleVersions.versionNumber,
      snapshot: styleVersions.snapshot,
      changeSummary: styleVersions.changeSummary,
      changedBy: styleVersions.changedBy,
      createdAt: styleVersions.createdAt,
    })
    .from(styleVersions)
    .where(eq(styleVersions.styleId, styleId))
    .orderBy(sql`${styleVersions.versionNumber} DESC`);
}

import { and, eq, inArray, like, or, sql } from "drizzle-orm";
import type { Database } from "../index.ts";
import { patterns, patternVersions } from "../schema/patterns.ts";

export async function listUserPatterns(
  db: Database,
  userId: string,
  opts?: {
    levels?: string[];
    search?: string;
  },
) {
  const conditions: any[] = [eq(patterns.userId, userId)];
  if (opts?.levels?.length) conditions.push(inArray(patterns.level, opts.levels));
  if (opts?.search) {
    const term = `%${opts.search}%`;
    conditions.push(
      or(
        like(patterns.patternId, term),
        like(patterns.name, term),
        like(patterns.detectionHint, term),
      ),
    );
  }

  return db
    .select()
    .from(patterns)
    .where(and(...conditions))
    .orderBy(patterns.updatedAt);
}

export async function getUserPatternIds(db: Database, userId: string) {
  const rows = await db
    .select({ patternId: patterns.patternId })
    .from(patterns)
    .where(eq(patterns.userId, userId));
  return new Set(rows.map((r) => r.patternId));
}

export async function getPattern(db: Database, id: string, userId: string) {
  return db
    .select()
    .from(patterns)
    .where(and(eq(patterns.id, id), eq(patterns.userId, userId)))
    .then((r) => r[0] ?? null);
}

export async function getPatternById(db: Database, id: string) {
  return db
    .select()
    .from(patterns)
    .where(eq(patterns.id, id))
    .then((r) => r[0] ?? null);
}

export async function patternIdExists(db: Database, patternId: string, userId: string) {
  const row = await db
    .select({ id: patterns.id })
    .from(patterns)
    .where(and(eq(patterns.patternId, patternId), eq(patterns.userId, userId)))
    .then((r) => r[0]);
  return !!row;
}

export async function insertPattern(db: Database, values: typeof patterns.$inferInsert) {
  await db.insert(patterns).values(values);
}

export async function updatePattern(
  db: Database,
  id: string,
  userId: string,
  data: Record<string, any>,
) {
  // Separate simple and JSON fields
  const set: Record<string, any> = {};

  const simpleFields = [
    "name",
    "level",
    "heatWeight",
    "selfAmplification",
    "detectionHint",
    "pceDirective",
    "description",
    "severity",
    "detectionNotes",
    "taxonomyId",
  ] as const;
  for (const field of simpleFields) {
    if (data[field] !== undefined) set[field] = data[field];
  }

  const jsonFields = [
    "rewriteMenu",
    "toleranceOverrides",
    "examples",
    "falsePositives",
    "substitutions",
    "falseSubstitutions",
    "tags",
    "relatedPatterns",
    "researchSources",
  ] as const;
  for (const field of jsonFields) {
    if (data[field] !== undefined) set[field] = JSON.stringify(data[field]);
  }

  set.version = sql`${patterns.version} + 1`;
  set.updatedAt = new Date();

  await db
    .update(patterns)
    .set(set)
    .where(and(eq(patterns.id, id), eq(patterns.userId, userId)));
}

export async function deletePattern(db: Database, id: string, userId: string) {
  const result = await db
    .delete(patterns)
    .where(and(eq(patterns.id, id), eq(patterns.userId, userId)))
    .returning({ id: patterns.id });
  return result.length > 0;
}

export async function createPatternVersion(
  db: Database,
  params: {
    patternId: string;
    versionNumber: number;
    snapshot: string;
    changeSummary?: string;
    changedBy: string;
  },
) {
  await db.insert(patternVersions).values({
    patternId: params.patternId,
    versionNumber: params.versionNumber,
    snapshot: params.snapshot,
    changeSummary: params.changeSummary,
    changedBy: params.changedBy,
  });
}

export async function listPatternVersions(db: Database, patternId: string) {
  return db
    .select({
      versionNumber: patternVersions.versionNumber,
      snapshot: patternVersions.snapshot,
      changeSummary: patternVersions.changeSummary,
      changedBy: patternVersions.changedBy,
      createdAt: patternVersions.createdAt,
    })
    .from(patternVersions)
    .where(eq(patternVersions.patternId, patternId))
    .orderBy(sql`${patternVersions.versionNumber} DESC`);
}

export async function getPatternVersion(db: Database, patternId: string, versionNumber: number) {
  return db
    .select({ snapshot: patternVersions.snapshot })
    .from(patternVersions)
    .where(
      and(
        eq(patternVersions.patternId, patternId),
        eq(patternVersions.versionNumber, versionNumber),
      ),
    )
    .then((r) => r[0]?.snapshot ?? null);
}

export async function exportUserPatterns(db: Database, userId: string, levelFilter?: string) {
  const conditions: any[] = [eq(patterns.userId, userId)];
  if (levelFilter) conditions.push(eq(patterns.level, levelFilter));
  return db
    .select()
    .from(patterns)
    .where(and(...conditions));
}

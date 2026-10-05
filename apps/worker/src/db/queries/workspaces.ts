import { and, avg, count, eq, sql, sum } from "drizzle-orm";
import type { Database } from "../index.ts";
import { documents, documentTags } from "../schema/documents.ts";
import { workspaceMembers, workspaces } from "../schema/workspaces.ts";

export async function createWorkspace(
  db: Database,
  params: {
    id: string;
    ownerId: string;
    name: string;
    slug: string;
    description?: string | null;
    icon?: string | null;
    color?: string | null;
  },
) {
  await db.insert(workspaces).values({
    id: params.id,
    ownerId: params.ownerId,
    name: params.name,
    slug: params.slug,
    description: params.description ?? null,
    icon: params.icon ?? null,
    color: params.color ?? null,
  });
  await db.insert(workspaceMembers).values({
    workspaceId: params.id,
    userId: params.ownerId,
    role: "owner",
  });
}

export async function listWorkspaces(db: Database, userId: string) {
  const rows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      description: workspaces.description,
      icon: workspaces.icon,
      color: workspaces.color,
      settings: workspaces.settings,
      archived: workspaces.archived,
      created_at: workspaces.createdAt,
      updated_at: workspaces.updatedAt,
    })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(and(eq(workspaceMembers.userId, userId), eq(workspaces.archived, false)))
    .orderBy(workspaces.name);

  return rows.map((ws) => ({
    ...ws,
    settings: ws.settings ? JSON.parse(ws.settings) : null,
  }));
}

export async function getMemberRole(db: Database, workspaceId: string, userId: string) {
  return db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .then((r) => r[0]?.role ?? null);
}

export async function isMember(db: Database, workspaceId: string, userId: string) {
  const row = await db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .then((r) => r[0]);
  return !!row;
}

export async function updateWorkspace(db: Database, wsId: string, data: Record<string, unknown>) {
  const set: Record<string, any> = { updatedAt: new Date() };
  if (data.name !== undefined) set.name = data.name;
  if (data.slug !== undefined)
    set.slug = String(data.slug)
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .slice(0, 50);
  if (data.description !== undefined) set.description = data.description;
  if (data.icon !== undefined) set.icon = data.icon;
  if (data.color !== undefined) set.color = data.color;
  if (data.archived !== undefined) set.archived = !!data.archived;
  if (data.settings !== undefined) set.settings = JSON.stringify(data.settings);
  await db.update(workspaces).set(set).where(eq(workspaces.id, wsId));
}

export async function deleteWorkspace(db: Database, wsId: string) {
  await db.delete(workspaces).where(eq(workspaces.id, wsId));
}

export async function getWorkspaceAnalytics(db: Database, wsId: string, userId: string) {
  const stats = await db
    .select({
      documentCount: count(documents.id),
      totalWords: sql<number>`COALESCE(SUM(${documents.wordCount}), 0)`,
      avgHeat: avg(documents.meanHeat),
    })
    .from(documents)
    .where(and(eq(documents.workspaceId, wsId), eq(documents.userId, userId)))
    .then((r) => r[0]!);

  const statusRows = await db
    .select({
      status: documents.status,
      cnt: count(),
    })
    .from(documents)
    .where(and(eq(documents.workspaceId, wsId), eq(documents.userId, userId)))
    .groupBy(documents.status);

  const statusDistribution: Record<string, number> = {};
  for (const row of statusRows) if (row.status) statusDistribution[row.status] = row.cnt;

  const heatRow = await db
    .select({
      unanalyzed: sql<number>`SUM(CASE WHEN ${documents.meanHeat} IS NULL THEN 1 ELSE 0 END)`,
      cool: sql<number>`SUM(CASE WHEN ${documents.meanHeat} < 3 THEN 1 ELSE 0 END)`,
      warm: sql<number>`SUM(CASE WHEN ${documents.meanHeat} >= 3 AND ${documents.meanHeat} < 6 THEN 1 ELSE 0 END)`,
      hot: sql<number>`SUM(CASE WHEN ${documents.meanHeat} >= 6 THEN 1 ELSE 0 END)`,
    })
    .from(documents)
    .where(and(eq(documents.workspaceId, wsId), eq(documents.userId, userId)))
    .then((r) => r[0] ?? { unanalyzed: 0, cool: 0, warm: 0, hot: 0 });

  return {
    document_count: stats.documentCount,
    total_words: Number(stats.totalWords),
    avg_heat: stats.avgHeat ? Number(stats.avgHeat) : null,
    status_distribution: statusDistribution,
    heat_distribution: {
      cool: heatRow.cool ?? 0,
      warm: heatRow.warm ?? 0,
      hot: heatRow.hot ?? 0,
      unanalyzed: heatRow.unanalyzed ?? 0,
    },
  };
}

export async function getWorkspaceTags(db: Database, wsId: string, userId: string) {
  const rows = await db
    .selectDistinct({ tag: documentTags.tag })
    .from(documentTags)
    .innerJoin(documents, eq(documentTags.documentId, documents.id))
    .where(and(eq(documents.workspaceId, wsId), eq(documents.userId, userId)))
    .orderBy(documentTags.tag);
  return rows.map((r) => r.tag);
}

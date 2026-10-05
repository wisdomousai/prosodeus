import { and, asc, desc, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import type { Database } from "../index.ts";
import { documents, documentTags } from "../schema/index.ts";

export async function createDocument(
  db: Database,
  params: {
    id: string;
    userId: string;
    title: string;
    folderId?: string | null;
    workspaceId?: string | null;
  },
) {
  await db.insert(documents).values({
    id: params.id,
    userId: params.userId,
    title: params.title,
    folderId: params.folderId ?? null,
    workspaceId: params.workspaceId ?? null,
    status: "draft",
  });
}

export async function listDocuments(
  db: Database,
  params: {
    userId: string;
    workspaceId?: string;
    statuses?: string[];
    heatMin?: number;
    heatMax?: number;
    hasDueDate?: boolean;
    tagList?: string[];
    sortCol?: string;
    order?: "asc" | "desc";
  },
) {
  const conditions = [eq(documents.userId, params.userId)];
  if (params.workspaceId) conditions.push(eq(documents.workspaceId, params.workspaceId));
  if (params.statuses?.length) conditions.push(inArray(documents.status, params.statuses));
  if (params.heatMin != null) conditions.push(gte(documents.meanHeat, params.heatMin));
  if (params.heatMax != null) conditions.push(lte(documents.meanHeat, params.heatMax));
  if (params.hasDueDate) conditions.push(isNotNull(documents.dueDate));
  if (params.tagList?.length) {
    conditions.push(
      inArray(
        documents.id,
        db
          .select({ id: documentTags.documentId })
          .from(documentTags)
          .where(inArray(documentTags.tag, params.tagList)),
      ),
    );
  }

  const sortMap: Record<string, any> = {
    updated_at: documents.updatedAt,
    created_at: documents.createdAt,
    title: documents.title,
    mean_heat: documents.meanHeat,
    word_count: documents.wordCount,
    due_date: documents.dueDate,
  };
  const sortField = sortMap[params.sortCol ?? "updated_at"] ?? documents.updatedAt;
  const orderFn = params.order === "asc" ? asc : desc;

  const rows = await db
    .select({
      id: documents.id,
      title: documents.title,
      word_count: documents.wordCount,
      sentence_count: documents.sentenceCount,
      mean_heat: documents.meanHeat,
      status: documents.status,
      folder_id: documents.folderId,
      workspace_id: documents.workspaceId,
      due_date: documents.dueDate,
      created_at: documents.createdAt,
      updated_at: documents.updatedAt,
    })
    .from(documents)
    .where(and(...conditions))
    .orderBy(orderFn(sortField));

  // Attach tags
  if (rows.length > 0) {
    const docIds = rows.map((r) => r.id);
    const tagRows = await db
      .select({
        documentId: documentTags.documentId,
        tag: documentTags.tag,
      })
      .from(documentTags)
      .where(inArray(documentTags.documentId, docIds));

    const tagMap = new Map<string, string[]>();
    for (const row of tagRows) {
      const arr = tagMap.get(row.documentId) ?? [];
      arr.push(row.tag);
      tagMap.set(row.documentId, arr);
    }
    return rows.map((doc) => ({ ...doc, tags: tagMap.get(doc.id) ?? [] }));
  }

  return rows.map((doc) => ({ ...doc, tags: [] as string[] }));
}

export async function getDocument(db: Database, docId: string, userId: string) {
  return db
    .select()
    .from(documents)
    .where(and(eq(documents.id, docId), eq(documents.userId, userId)))
    .then((r) => r[0] ?? null);
}

export async function updateDocument(
  db: Database,
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
  const set: Record<string, any> = { updatedAt: new Date() };
  if (data.title !== undefined) set.title = data.title;
  if (data.wordCount !== undefined) set.wordCount = data.wordCount;
  if (data.sentenceCount !== undefined) set.sentenceCount = data.sentenceCount;
  if (data.meanHeat !== undefined) set.meanHeat = data.meanHeat;
  if (data.folderId !== undefined) set.folderId = data.folderId;
  if (data.workspaceId !== undefined) set.workspaceId = data.workspaceId;
  if (data.dueDate !== undefined) set.dueDate = data.dueDate;
  if (data.status !== undefined) {
    set.status = data.status;
    set.statusChangedAt = new Date().toISOString();
    set.statusChangedBy = userId;
  }

  await db
    .update(documents)
    .set(set)
    .where(and(eq(documents.id, docId), eq(documents.userId, userId)));
}

export async function deleteDocument(db: Database, docId: string, userId: string) {
  const result = await db
    .delete(documents)
    .where(and(eq(documents.id, docId), eq(documents.userId, userId)))
    .returning({ id: documents.id });
  return result.length > 0;
}

/** Verify doc ownership — returns true if owned */
export async function verifyDocOwnership(db: Database, docId: string, userId: string) {
  const row = await db
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.id, docId), eq(documents.userId, userId)))
    .then((r) => r[0]);
  return !!row;
}

/** Get document by ID (no user check, for shared links) */
export async function getDocumentPublic(db: Database, docId: string) {
  return db
    .select({
      id: documents.id,
      title: documents.title,
      word_count: documents.wordCount,
      sentence_count: documents.sentenceCount,
      mean_heat: documents.meanHeat,
      status: documents.status,
      created_at: documents.createdAt,
      updated_at: documents.updatedAt,
    })
    .from(documents)
    .where(eq(documents.id, docId))
    .then((r) => r[0] ?? null);
}

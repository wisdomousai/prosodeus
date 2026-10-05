import { and, eq } from "drizzle-orm";
import type { Database } from "../index.ts";
import { folders } from "../schema/index.ts";

export async function createFolder(
  db: Database,
  params: {
    id: string;
    userId: string;
    name: string;
    parentId?: string | null;
  },
) {
  await db.insert(folders).values({
    id: params.id,
    userId: params.userId,
    name: params.name,
    parentId: params.parentId ?? null,
  });
}

export async function listFolders(db: Database, userId: string) {
  return db
    .select({
      id: folders.id,
      name: folders.name,
      parent_id: folders.parentId,
      created_at: folders.createdAt,
      updated_at: folders.updatedAt,
    })
    .from(folders)
    .where(eq(folders.userId, userId))
    .orderBy(folders.name);
}

export async function updateFolder(
  db: Database,
  folderId: string,
  userId: string,
  data: {
    name?: string;
    parentId?: string | null;
  },
) {
  const set: Record<string, any> = { updatedAt: new Date() };
  if (data.name !== undefined) set.name = data.name;
  if (data.parentId !== undefined) set.parentId = data.parentId;
  await db
    .update(folders)
    .set(set)
    .where(and(eq(folders.id, folderId), eq(folders.userId, userId)));
}

export async function deleteFolder(db: Database, folderId: string, userId: string) {
  const result = await db
    .delete(folders)
    .where(and(eq(folders.id, folderId), eq(folders.userId, userId)))
    .returning({ id: folders.id });
  return result.length > 0;
}

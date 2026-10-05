import { and, eq, gt } from "drizzle-orm";
import type { Database } from "../index.ts";
import { documents } from "../schema/index.ts";

/**
 * Pull every document the user owns that has been modified after `since`.
 *
 * Used by the desktop's sync loop to learn about cloud-side changes (made on
 * other devices, or via the web app). Server-side `updated_at` is the
 * canonical clock — clients track the latest server timestamp they've seen.
 */
export async function pullDocumentsSince(db: Database, userId: string, since: Date) {
  return await db
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
    .where(and(eq(documents.userId, userId), gt(documents.updatedAt, since)));
}

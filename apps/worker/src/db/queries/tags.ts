import { and, eq } from "drizzle-orm";
import type { Database } from "../index.ts";
import { documentTags } from "../schema/documents.ts";

export async function addTags(db: Database, documentId: string, tags: string[]) {
  for (const tag of tags) {
    await db.insert(documentTags).values({ documentId, tag }).onConflictDoNothing();
  }
}

export async function removeTag(db: Database, documentId: string, tag: string) {
  await db
    .delete(documentTags)
    .where(and(eq(documentTags.documentId, documentId), eq(documentTags.tag, tag)));
}

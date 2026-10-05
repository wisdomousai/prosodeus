import { and, eq } from "drizzle-orm";
import type { Database } from "../index.ts";
import { shareLinks } from "../schema/share-links.ts";

export async function createShareLink(
  db: Database,
  params: {
    id: string;
    documentId: string;
    createdBy: string;
    permission: string;
    token: string;
    expiresAt: string | null;
  },
) {
  await db.insert(shareLinks).values({
    id: params.id,
    documentId: params.documentId,
    createdBy: params.createdBy,
    permission: params.permission,
    token: params.token,
    expiresAt: params.expiresAt,
  });
}

export async function listShareLinks(db: Database, documentId: string, userId: string) {
  return db
    .select({
      id: shareLinks.id,
      permission: shareLinks.permission,
      token: shareLinks.token,
      expires_at: shareLinks.expiresAt,
      created_at: shareLinks.createdAt,
    })
    .from(shareLinks)
    .where(and(eq(shareLinks.documentId, documentId), eq(shareLinks.createdBy, userId)));
}

export async function deleteShareLink(db: Database, linkId: string, userId: string) {
  const result = await db
    .delete(shareLinks)
    .where(and(eq(shareLinks.id, linkId), eq(shareLinks.createdBy, userId)))
    .returning({ id: shareLinks.id });
  return result.length > 0;
}

export async function getShareLinkByToken(db: Database, token: string) {
  return db
    .select({
      documentId: shareLinks.documentId,
      permission: shareLinks.permission,
      expiresAt: shareLinks.expiresAt,
    })
    .from(shareLinks)
    .where(eq(shareLinks.token, token))
    .then((r) => r[0] ?? null);
}

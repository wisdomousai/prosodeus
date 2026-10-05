import { and, eq, or, sql } from "drizzle-orm";
import type { Database } from "../index.ts";
import { templates } from "../schema/templates.ts";

export async function createTemplate(
  db: Database,
  params: {
    id: string;
    userId: string;
    title: string;
    content: string;
    workspaceId?: string | null;
    description?: string | null;
    defaultTags?: string[] | null;
    defaultStyle?: string | null;
    isShared?: boolean;
  },
) {
  await db.insert(templates).values({
    id: params.id,
    userId: params.userId,
    title: params.title.slice(0, 200),
    content: params.content,
    workspaceId: params.workspaceId ?? null,
    description: params.description ?? null,
    defaultTags: params.defaultTags ? JSON.stringify(params.defaultTags) : null,
    defaultStyle: params.defaultStyle ?? null,
    isShared: params.isShared ?? false,
  });
}

export async function listTemplates(db: Database, userId: string, workspaceId?: string) {
  const conditions = [or(eq(templates.userId, userId), eq(templates.isShared, true))];
  if (workspaceId) {
    conditions.push(
      or(eq(templates.workspaceId, workspaceId), sql`${templates.workspaceId} IS NULL`),
    );
  }

  const rows = await db
    .select({
      id: templates.id,
      workspace_id: templates.workspaceId,
      title: templates.title,
      description: templates.description,
      content: templates.content,
      content_format: templates.contentFormat,
      default_tags: templates.defaultTags,
      default_style: templates.defaultStyle,
      is_shared: templates.isShared,
      created_at: templates.createdAt,
      updated_at: templates.updatedAt,
    })
    .from(templates)
    .where(and(...conditions))
    .orderBy(templates.title);

  return rows.map((t) => ({
    ...t,
    default_tags: t.default_tags ? JSON.parse(t.default_tags) : null,
  }));
}

export async function deleteTemplate(db: Database, templateId: string, userId: string) {
  const result = await db
    .delete(templates)
    .where(and(eq(templates.id, templateId), eq(templates.userId, userId)))
    .returning({ id: templates.id });
  return result.length > 0;
}

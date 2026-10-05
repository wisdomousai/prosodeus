import { eq, inArray, sql } from "drizzle-orm";
import type { Database } from "../index.ts";
import { systemPrompts } from "../schema/system-prompts.ts";

export async function listPrompts(db: Database) {
  return db
    .select({
      id: systemPrompts.id,
      name: systemPrompts.name,
      content: systemPrompts.content,
      version: systemPrompts.version,
      updated_at: systemPrompts.updatedAt,
    })
    .from(systemPrompts)
    .orderBy(systemPrompts.name);
}

export async function upsertPrompt(
  db: Database,
  promptId: string,
  content: string,
  userId: string,
) {
  await db
    .insert(systemPrompts)
    .values({
      id: promptId,
      name: promptId,
      content,
      updatedBy: userId,
    })
    .onConflictDoUpdate({
      target: systemPrompts.id,
      set: {
        content,
        version: sql`${systemPrompts.version} + 1`,
        updatedBy: userId,
        updatedAt: new Date(),
      },
    });
}

export async function getPromptsByName(db: Database, names: string[]) {
  return db
    .select({
      name: systemPrompts.name,
      content: systemPrompts.content,
    })
    .from(systemPrompts)
    .where(inArray(systemPrompts.name, names));
}

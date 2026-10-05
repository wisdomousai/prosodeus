import { and, eq, or } from "drizzle-orm";
import type { Database } from "../index.ts";
import { styleGuides } from "../schema/style-guides.ts";

export async function listGuides(db: Database, userId: string) {
  return db
    .select({
      id: styleGuides.id,
      name: styleGuides.name,
      description: styleGuides.description,
      targets: styleGuides.targets,
      is_builtin: styleGuides.isBuiltin,
      user_id: styleGuides.userId,
    })
    .from(styleGuides)
    .where(or(eq(styleGuides.isBuiltin, true), eq(styleGuides.userId, userId)))
    .orderBy(styleGuides.name);
}

export async function createGuide(
  db: Database,
  params: {
    id: string;
    name: string;
    description: string;
    targets: string;
    userId: string;
  },
) {
  await db.insert(styleGuides).values({
    id: params.id,
    name: params.name,
    description: params.description,
    targets: params.targets,
    userId: params.userId,
  });
}

export async function deleteGuide(db: Database, guideId: string, userId: string) {
  const result = await db
    .delete(styleGuides)
    .where(
      and(
        eq(styleGuides.id, guideId),
        eq(styleGuides.userId, userId),
        eq(styleGuides.isBuiltin, false),
      ),
    )
    .returning({ id: styleGuides.id });
  return result.length > 0;
}

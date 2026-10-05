import { eq } from "drizzle-orm";
import type { Database } from "../index.ts";
import { users } from "../schema/index.ts";

export async function upsertUser(db: Database, id: string, email: string) {
  await db.insert(users).values({ id, email }).onConflictDoNothing();
}

export async function getUserById(db: Database, id: string) {
  return db
    .select({
      id: users.id,
      email: users.email,
    })
    .from(users)
    .where(eq(users.id, id))
    .then((r) => r[0] ?? null);
}

export async function isAdmin(db: Database, userId: string) {
  const row = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .then((r) => r[0]);
  return row?.isAdmin === true;
}

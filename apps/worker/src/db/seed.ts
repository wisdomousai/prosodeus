#!/usr/bin/env bun
/**
 * Seed the Neon database with dev data.
 * Usage: DATABASE_URL=postgres://... bun run src/db/seed.ts
 */
import { createDb } from "./index.ts";
import { upsertUser } from "./queries/users.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL environment variable required");
  process.exit(1);
}

const db = createDb(url);

// Dev user
await upsertUser(db, "dev-user", "dev@localhost");
console.log("Seeded dev-user");

// Make dev user admin
import { eq } from "drizzle-orm";
import { users } from "./schema/users.ts";

await db.update(users).set({ isAdmin: true }).where(eq(users.id, "dev-user"));
console.log("Set dev-user as admin + pro plan");

console.log("Done.");
process.exit(0);

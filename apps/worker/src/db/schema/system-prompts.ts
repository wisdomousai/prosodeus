import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users.ts";

export const systemPrompts = pgTable("system_prompts", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  content: text("content").notNull(),
  version: integer("version").default(1),
  updatedBy: text("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

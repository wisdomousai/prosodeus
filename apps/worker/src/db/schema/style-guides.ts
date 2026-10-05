import { boolean, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users.ts";

export const styleGuides = pgTable(
  "style_guides",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    targets: text("targets").notNull(),
    isBuiltin: boolean("is_builtin").default(false),
    isPremium: boolean("is_premium").notNull().default(false),
    priceCents: integer("price_cents").notNull().default(0),
    author: text("author"),
    userId: text("user_id").references(() => users.id),
    workspaceId: text("workspace_id"),
    exemplarWordCount: integer("exemplar_word_count"),
    sourceDescription: text("source_description"),
  },
  (t) => [index("idx_style_guides_user").on(t.userId)],
);

import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./users.ts";

export const styles = pgTable(
  "styles",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    // JSON-stringified RewriteConstraints. Matches the pattern of `patterns` table.
    policy: text("policy").notNull().default("{}"),
    isDefault: boolean("is_default").notNull().default(false),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_styles_user").on(t.userId),
    uniqueIndex("idx_styles_user_name_unique").on(t.userId, t.name),
  ],
);

export const styleVersions = pgTable(
  "style_versions",
  {
    id: serial("id").primaryKey(),
    styleId: text("style_id")
      .notNull()
      .references(() => styles.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    snapshot: text("snapshot").notNull(),
    changeSummary: text("change_summary"),
    changedBy: text("changed_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("idx_style_versions").on(t.styleId, t.versionNumber)],
);

import { type AnyPgColumn, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users.ts";

export const folders = pgTable(
  "folders",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    parentId: text("parent_id").references((): AnyPgColumn => folders.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_folders_user").on(t.userId),
    index("idx_folders_parent").on(t.parentId),
    index("idx_folders_workspace").on(t.workspaceId),
  ],
);

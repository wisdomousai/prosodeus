import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users.ts";
import { workspaces } from "./workspaces.ts";

export const templates = pgTable(
  "templates",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    description: text("description"),
    content: text("content").notNull(),
    contentFormat: text("content_format").default("plaintext"),
    defaultTags: text("default_tags"), // JSON array
    defaultStyle: text("default_style"),
    isShared: boolean("is_shared").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_templates_workspace").on(t.workspaceId),
    index("idx_templates_user").on(t.userId),
  ],
);

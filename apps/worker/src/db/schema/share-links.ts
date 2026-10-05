import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { documents } from "./documents.ts";
import { users } from "./users.ts";
import { workspaces } from "./workspaces.ts";

export const shareLinks = pgTable(
  "share_links",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    permission: text("permission").notNull().default("view"),
    token: text("token").notNull().unique(),
    expiresAt: text("expires_at"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_share_links_token").on(t.token),
    index("idx_share_links_document").on(t.documentId),
  ],
);

export const savedSearches = pgTable(
  "saved_searches",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    query: text("query").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("idx_saved_searches_workspace").on(t.workspaceId)],
);

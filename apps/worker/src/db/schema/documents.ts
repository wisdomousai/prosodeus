import { index, integer, pgTable, primaryKey, real, text, timestamp } from "drizzle-orm/pg-core";
import { folders } from "./folders.ts";
import { users } from "./users.ts";
import { workspaces } from "./workspaces.ts";

export const documents = pgTable(
  "documents",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id),
    title: text("title"),
    wordCount: integer("word_count"),
    sentenceCount: integer("sentence_count"),
    meanHeat: real("mean_heat"),
    status: text("status").default("draft"),
    folderId: text("folder_id").references(() => folders.id, { onDelete: "set null" }),
    workspaceId: text("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
    dueDate: text("due_date"),
    statusChangedAt: text("status_changed_at"),
    statusChangedBy: text("status_changed_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_documents_user").on(t.userId),
    index("idx_documents_updated").on(t.updatedAt),
    index("idx_documents_folder").on(t.folderId),
    index("idx_documents_workspace").on(t.workspaceId),
  ],
);

export const documentTags = pgTable(
  "document_tags",
  {
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.documentId, t.tag] }), index("idx_document_tags_tag").on(t.tag)],
);

export const documentCustomFields = pgTable(
  "document_custom_fields",
  {
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    fieldId: text("field_id").notNull(),
    value: text("value").notNull(),
  },
  (t) => [primaryKey({ columns: [t.documentId, t.fieldId] })],
);

export const documentAnalysisSummary = pgTable("document_analysis_summary", {
  documentId: text("document_id")
    .primaryKey()
    .references(() => documents.id, { onDelete: "cascade" }),
  patternCounts: text("pattern_counts").notNull(),
  topPatterns: text("top_patterns").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

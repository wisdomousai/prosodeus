import {
  boolean,
  index,
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./users.ts";

export const patterns = pgTable(
  "patterns",
  {
    id: text("id").primaryKey(),
    patternId: text("pattern_id").notNull(),
    taxonomyId: text("taxonomy_id"),
    name: text("name").notNull(),
    level: text("level").notNull(), // 'lexical' | 'sentence' | 'paragraph' | 'document'
    scope: text("scope").notNull().default("user"), // 'user'
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    heatWeight: real("heat_weight").notNull().default(1.0),
    selfAmplification: text("self_amplification").notNull().default("med"), // 'high' | 'med' | 'low'
    detectionHint: text("detection_hint").notNull(),
    rewriteMenu: text("rewrite_menu").notNull().default("[]"),
    pceDirective: text("pce_directive").notNull().default(""),
    toleranceOverrides: text("tolerance_overrides").notNull().default("{}"),
    description: text("description").default(""),
    examples: text("examples").default("[]"),
    falsePositives: text("false_positives").default("[]"),
    substitutions: text("substitutions").default("[]"),
    falseSubstitutions: text("false_substitutions").default("[]"),
    tags: text("tags").default("[]"),
    severity: text("severity").default("medium"), // 'low' | 'medium' | 'high' | 'critical'
    relatedPatterns: text("related_patterns").default("[]"),
    detectionNotes: text("detection_notes"),
    researchSources: text("research_sources").default("[]"),
    forkedFrom: text("forked_from"),
    isEnabled: boolean("is_enabled").notNull().default(true),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_patterns_user").on(t.userId),
    index("idx_patterns_level").on(t.level),
    uniqueIndex("idx_patterns_unique").on(t.patternId, t.userId),
  ],
);

export const patternVersions = pgTable(
  "pattern_versions",
  {
    id: serial("id").primaryKey(),
    patternId: text("pattern_id")
      .notNull()
      .references(() => patterns.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    snapshot: text("snapshot").notNull(),
    changeSummary: text("change_summary"),
    changedBy: text("changed_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("idx_pattern_versions").on(t.patternId, t.versionNumber)],
);

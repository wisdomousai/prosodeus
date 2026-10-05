/**
 * Shared types for the Pattern Management API.
 *
 * These mirror the enriched PatternEntry from @prosodeus/core but are
 * structured for the REST API layer (list items, detail views, requests).
 */

import type {
  PatternExample,
  PatternFalsePositive,
  PatternFalseSubstitution,
  PatternLevel,
  PatternSeverity,
  PatternSubstitution,
  ResearchSource,
  RewriteOption,
  SelfAmplification,
  StyleGenre,
} from "@prosodeus/core";

export type PatternScope = "platform" | "user";

// ─── List view ─────────────────────────────────────────────────────────────

export interface PatternListItem {
  /** "platform:{pattern_id}" for core patterns, UUID for user patterns */
  id: string;
  /** Stable code identifier (e.g. "binary_contrast") */
  pattern_id: string;
  /** Human-readable taxonomy ref (e.g. "S-01", "U-01") */
  taxonomy_id: string;
  name: string;
  level: PatternLevel;
  scope: PatternScope;
  heat_weight: number;
  self_amplification: SelfAmplification;
  severity?: PatternSeverity;
  tags: string[];
  is_enabled: boolean;
  /** If forked from a platform pattern, its pattern_id */
  forked_from?: string;
  updated_at: string;
}

// ─── Detail view ───────────────────────────────────────────────────────────

export interface PatternDetail extends PatternListItem {
  description: string;
  examples: PatternExample[];
  false_positives: PatternFalsePositive[];
  substitutions: PatternSubstitution[];
  false_substitutions: PatternFalseSubstitution[];
  detection_hint: string;
  rewrite_menu: RewriteOption[];
  pce_directive: string;
  tolerance_overrides: Partial<Record<StyleGenre, number>>;
  related_patterns: string[];
  detection_notes?: string;
  research_sources: ResearchSource[];
  created_by?: string;
  created_at: string;
  version: number;
}

// ─── Create / Update ───────────────────────────────────────────────────────

export interface PatternCreateRequest {
  pattern_id: string;
  name: string;
  level: PatternLevel;
  detection_hint: string;
  taxonomy_id?: string;
  heat_weight?: number;
  self_amplification?: SelfAmplification;
  rewrite_menu?: RewriteOption[];
  pce_directive?: string;
  tolerance_overrides?: Partial<Record<StyleGenre, number>>;
  description?: string;
  examples?: PatternExample[];
  false_positives?: PatternFalsePositive[];
  substitutions?: PatternSubstitution[];
  false_substitutions?: PatternFalseSubstitution[];
  tags?: string[];
  severity?: PatternSeverity;
  related_patterns?: string[];
  detection_notes?: string;
  research_sources?: ResearchSource[];
}

export type PatternUpdateRequest = Partial<PatternCreateRequest>;

// ─── Fork ──────────────────────────────────────────────────────────────────

export interface PatternForkRequest {
  overrides?: PatternUpdateRequest;
}

// ─── Import / Export ───────────────────────────────────────────────────────

export interface PatternExportPayload {
  version: 1;
  exported_at: string;
  source: string;
  patterns: PatternDetail[];
}

export interface PatternImportRequest {
  patterns: PatternCreateRequest[];
  dry_run?: boolean;
}

export interface PatternImportResult {
  valid: number;
  invalid: number;
  conflicts: Array<{ pattern_id: string; reason: string }>;
  created_ids?: string[];
}

// ─── Versioning ────────────────────────────────────────────────────────────

export interface PatternVersion {
  version_number: number;
  snapshot: PatternDetail;
  change_summary?: string;
  changed_by?: string;
  created_at: string;
}

// ─── List response ─────────────────────────────────────────────────────────

export interface PatternListResponse {
  patterns: PatternListItem[];
  total: number;
  offset: number;
  limit: number;
}

// Re-export core types so API consumers don't need to import from @prosodeus/core
export type {
  PatternExample,
  PatternFalsePositive,
  PatternFalseSubstitution,
  PatternLevel,
  PatternSeverity,
  PatternSubstitution,
  ResearchSource,
  RewriteOption,
  SelfAmplification,
  StyleGenre,
};

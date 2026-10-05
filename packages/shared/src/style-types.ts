/**
 * Shared types for the user-defined Style API.
 *
 * Distinct from StyleInfo (built-in style guides loaded from @prosodeus/core).
 * UserStyle is fully CRUD-editable, persisted in Postgres per user.
 */

export interface UserStyle {
  id: string;
  name: string;
  description: string;
  /** Free-form policy object; shape is owned by the editor UI. */
  policy: Record<string, unknown>;
  is_default: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface UserStyleCreateRequest {
  name: string;
  description?: string;
  policy?: Record<string, unknown>;
  is_default?: boolean;
}

export interface UserStyleUpdateRequest {
  name?: string;
  description?: string;
  policy?: Record<string, unknown>;
  is_default?: boolean;
}

export interface UserStyleListResponse {
  styles: UserStyle[];
}

export interface UserStyleVersion {
  version_number: number;
  snapshot: Record<string, unknown>;
  change_summary?: string;
  changed_by?: string;
  created_at: string;
}

export interface UserStyleVersionListResponse {
  versions: UserStyleVersion[];
}

import type {
  PatternCreateRequest,
  PatternDetail,
  PatternExportPayload,
  PatternImportRequest,
  PatternImportResult,
  PatternListResponse,
  PatternUpdateRequest,
  PatternVersion,
} from "./pattern-types.ts";
import type {
  UserStyle,
  UserStyleCreateRequest,
  UserStyleListResponse,
  UserStyleUpdateRequest,
  UserStyleVersionListResponse,
} from "./style-types.ts";

/**
 * Platform-agnostic token storage interface.
 * Web: localStorage. iPad: expo-secure-store.
 */
export interface TokenStorage {
  getToken(): Promise<string | null>;
  setToken(token: string): Promise<void>;
  removeToken(): Promise<void>;
}

export interface DocumentMeta {
  id: string;
  title: string;
  word_count: number | null;
  sentence_count: number | null;
  mean_heat: number | null;
  status: string;
  folder_id: string | null;
  workspace_id: string | null;
  due_date: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface FolderMeta {
  id: string;
  name: string;
  parent_id: string | null;
  workspace_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMeta {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  settings: WorkspaceSettings | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceSettings {
  custom_statuses?: Array<{ id: string; label: string; color: string; position: number }>;
  default_style_guide_id?: string;
  custom_fields?: Array<{
    id: string;
    label: string;
    type: "text" | "date" | "select" | "number" | "url";
    options?: string[];
  }>;
  /** Free-text voice description for playbook constraint prompts */
  voice_dna?: string;
  /** Default platform preset for Anti-Slop Copy playbook */
  default_playbook_platform?: "linkedin" | "twitter" | "newsletter" | "ad_copy";
  /** User style guide derived from exemplar training */
  voice_style_guide_id?: string;
}

export interface TemplateMeta {
  id: string;
  workspace_id: string | null;
  title: string;
  description: string | null;
  content: string;
  content_format: string;
  default_tags: string[] | null;
  default_style: string | null;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceAnalytics {
  document_count: number;
  total_words: number;
  avg_heat: number | null;
  status_distribution: Record<string, number>;
  heat_distribution: { cool: number; warm: number; hot: number; unanalyzed: number };
}

export type DocumentStatus = "draft" | "review" | "final" | "archived";

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  mode?: "local-codex-host";
}

export interface UserProfile {
  id: string;
  email: string;
}

export interface StyleInfo {
  name: string;
  description: string;
}

// json() is Promise<any> under DOM types but Promise<unknown> under node/bun
// types; this package is typechecked under each consumer's globals.
function json<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

async function throwOnError(res: Response, fallback: string): Promise<never> {
  const body = await res.json().catch(() => ({}));
  const msg = (body as { error?: string })?.error ?? fallback;
  throw new Error(msg);
}

/**
 * Platform-agnostic REST API client.
 * Inject baseUrl and tokenStorage for each platform.
 */
export class ApiClient {
  private baseUrl: string;
  private tokenStorage: TokenStorage;

  constructor(baseUrl: string, tokenStorage: TokenStorage) {
    this.baseUrl = baseUrl;
    this.tokenStorage = tokenStorage;
  }

  private async getHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = await this.tokenStorage.getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }

  async createDocument(
    title?: string,
    folderId?: string,
    workspaceId?: string,
  ): Promise<{ id: string }> {
    const body: Record<string, unknown> = {};
    if (title) body.title = title;
    if (folderId) body.folder_id = folderId;
    if (workspaceId) body.workspace_id = workspaceId;
    const res = await fetch(`${this.baseUrl}/api/documents`, {
      method: "POST",
      headers: await this.getHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) await throwOnError(res, "Failed to create document");
    return json(res);
  }

  async listDocuments(params?: {
    workspace_id?: string;
    status?: string;
    tags?: string;
    heat_min?: number;
    heat_max?: number;
    has_due_date?: boolean;
    sort?: string;
    order?: "asc" | "desc";
  }): Promise<DocumentMeta[]> {
    const qs = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) qs.set(k, String(v));
      }
    }
    const url = `${this.baseUrl}/api/documents${qs.toString() ? `?${qs}` : ""}`;
    const res = await fetch(url, { headers: await this.getHeaders() });
    if (!res.ok) await throwOnError(res, "Failed to list documents");
    return json(res);
  }

  async getDocument(id: string): Promise<DocumentMeta> {
    const res = await fetch(`${this.baseUrl}/api/documents/${id}`, {
      headers: await this.getHeaders(),
    });
    if (!res.ok) await throwOnError(res, "Failed to get document");
    return json(res);
  }

  async updateDocument(
    id: string,
    data: Partial<
      Pick<
        DocumentMeta,
        | "title"
        | "word_count"
        | "sentence_count"
        | "mean_heat"
        | "folder_id"
        | "workspace_id"
        | "status"
        | "due_date"
      >
    >,
  ): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/documents/${id}`, {
      method: "PUT",
      headers: await this.getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) await throwOnError(res, "Failed to update document");
  }

  async deleteDocument(id: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/documents/${id}`, {
      method: "DELETE",
      headers: await this.getHeaders(),
    });
    if (!res.ok) await throwOnError(res, "Failed to delete document");
  }

  async createFolder(name: string, parentId?: string): Promise<{ id: string }> {
    const res = await fetch(`${this.baseUrl}/api/folders`, {
      method: "POST",
      headers: await this.getHeaders(),
      body: JSON.stringify({ name, parent_id: parentId }),
    });
    if (!res.ok) await throwOnError(res, "Failed to create folder");
    return json(res);
  }

  async listFolders(): Promise<FolderMeta[]> {
    const res = await fetch(`${this.baseUrl}/api/folders`, {
      headers: await this.getHeaders(),
    });
    if (!res.ok) await throwOnError(res, "Failed to list folders");
    return json(res);
  }

  async updateFolder(
    id: string,
    data: { name?: string; parent_id?: string | null },
  ): Promise<void> {
    const body: Record<string, unknown> = {};
    if (data.name !== undefined) body.name = data.name;
    if (data.parent_id !== undefined) body.parent_id = data.parent_id;
    if (Object.keys(body).length === 0) return;
    const res = await fetch(`${this.baseUrl}/api/folders/${id}`, {
      method: "PUT",
      headers: await this.getHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) await throwOnError(res, "Failed to update folder");
  }

  async renameFolder(id: string, name: string): Promise<void> {
    await this.updateFolder(id, { name });
  }

  async deleteFolder(id: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/folders/${id}`, {
      method: "DELETE",
      headers: await this.getHeaders(),
    });
    if (!res.ok) await throwOnError(res, "Failed to delete folder");
  }

  /** Built-in style guides bundled with @prosodeus/core. Read-only. */
  async fetchStyles(): Promise<StyleInfo[]> {
    const res = await fetch(`${this.baseUrl}/api/style-guides`);
    if (!res.ok) await throwOnError(res, "Failed to load style guides");
    return json(res);
  }

  // ─── User-defined styles (CRUD-editable, persisted per user) ──────────────

  async listUserStyles(): Promise<UserStyle[]> {
    const res = await fetch(`${this.baseUrl}/api/styles`, {
      headers: await this.getHeaders(),
    });
    if (!res.ok) await throwOnError(res, "Failed to list styles");
    const data = (await res.json()) as UserStyleListResponse;
    return data.styles ?? [];
  }

  async getUserStyle(id: string): Promise<UserStyle> {
    const res = await fetch(`${this.baseUrl}/api/styles/${id}`, {
      headers: await this.getHeaders(),
    });
    if (!res.ok) await throwOnError(res, "Failed to get style");
    return json(res);
  }

  async createUserStyle(data: UserStyleCreateRequest): Promise<{ id: string }> {
    const res = await fetch(`${this.baseUrl}/api/styles`, {
      method: "POST",
      headers: await this.getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) await throwOnError(res, "Failed to create style");
    return json(res);
  }

  async updateUserStyle(id: string, data: UserStyleUpdateRequest): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/styles/${id}`, {
      method: "PUT",
      headers: await this.getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) await throwOnError(res, "Failed to update style");
  }

  async deleteUserStyle(id: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/styles/${id}`, {
      method: "DELETE",
      headers: await this.getHeaders(),
    });
    if (!res.ok) await throwOnError(res, "Failed to delete style");
  }

  async listUserStyleVersions(id: string): Promise<UserStyleVersionListResponse["versions"]> {
    const res = await fetch(`${this.baseUrl}/api/styles/${id}/versions`, {
      headers: await this.getHeaders(),
    });
    if (!res.ok) await throwOnError(res, "Failed to list style versions");
    const data = (await res.json()) as UserStyleVersionListResponse;
    return data.versions ?? [];
  }

  // ─── AI rule synthesis ────────────────────────────────────────────────────

  /**
   * Asks the backend to classify a sentence and synthesize a draft pattern.
   * Returns a non-persisted PatternCreateRequest ready to seed the inline editor.
   */
  async suggestPatternFromSentence(sentence: string): Promise<{
    pattern: PatternCreateRequest;
    signals: { detected_pattern_types: string[]; classification: Record<string, unknown> };
  }> {
    const res = await fetch(`${this.baseUrl}/api/patterns/suggest-from-sentence`, {
      method: "POST",
      headers: await this.getHeaders(),
      body: JSON.stringify({ sentence }),
    });
    if (!res.ok) await throwOnError(res, "Failed to synthesize pattern");
    return json(res);
  }

  async fetchModels(): Promise<ModelInfo[]> {
    const res = await fetch(`${this.baseUrl}/api/models`);
    if (!res.ok) await throwOnError(res, "Failed to load models");
    return json(res);
  }

  async getMe(): Promise<UserProfile> {
    const res = await fetch(`${this.baseUrl}/api/me`, {
      headers: await this.getHeaders(),
    });
    if (!res.ok) await throwOnError(res, "Failed to get user profile");
    return json(res);
  }

  // ─── Workspaces ────────────────────────────────────────────────────────────

  async createWorkspace(data: {
    name: string;
    slug: string;
    description?: string;
    icon?: string;
    color?: string;
  }): Promise<{ id: string }> {
    const res = await fetch(`${this.baseUrl}/api/workspaces`, {
      method: "POST",
      headers: await this.getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) await throwOnError(res, "Failed to create workspace");
    return json(res);
  }

  async listWorkspaces(): Promise<WorkspaceMeta[]> {
    const res = await fetch(`${this.baseUrl}/api/workspaces`, {
      headers: await this.getHeaders(),
    });
    if (!res.ok) await throwOnError(res, "Failed to list workspaces");
    return json(res);
  }

  async updateWorkspace(
    id: string,
    data: Partial<
      Pick<WorkspaceMeta, "name" | "slug" | "description" | "icon" | "color" | "archived">
    > & { settings?: WorkspaceSettings },
  ): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/workspaces/${id}`, {
      method: "PUT",
      headers: await this.getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) await throwOnError(res, "Failed to update workspace");
  }

  async deleteWorkspace(id: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/workspaces/${id}`, {
      method: "DELETE",
      headers: await this.getHeaders(),
    });
    if (!res.ok) await throwOnError(res, "Failed to delete workspace");
  }

  async getWorkspaceAnalytics(id: string): Promise<WorkspaceAnalytics> {
    const res = await fetch(`${this.baseUrl}/api/workspaces/${id}/analytics`, {
      headers: await this.getHeaders(),
    });
    if (!res.ok) await throwOnError(res, "Failed to get workspace analytics");
    return json(res);
  }

  // ─── Tags ─────────────────────────────────────────────────────────────────

  async addDocumentTags(documentId: string, tags: string[]): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/documents/${documentId}/tags`, {
      method: "POST",
      headers: await this.getHeaders(),
      body: JSON.stringify({ tags }),
    });
    if (!res.ok) await throwOnError(res, "Failed to add tags");
  }

  async removeDocumentTag(documentId: string, tag: string): Promise<void> {
    const res = await fetch(
      `${this.baseUrl}/api/documents/${documentId}/tags/${encodeURIComponent(tag)}`,
      {
        method: "DELETE",
        headers: await this.getHeaders(),
      },
    );
    if (!res.ok) await throwOnError(res, "Failed to remove tag");
  }

  async listWorkspaceTags(workspaceId: string): Promise<string[]> {
    const res = await fetch(`${this.baseUrl}/api/workspaces/${workspaceId}/tags`, {
      headers: await this.getHeaders(),
    });
    if (!res.ok) await throwOnError(res, "Failed to list tags");
    return json(res);
  }

  // ─── Templates ────────────────────────────────────────────────────────────

  async createTemplate(data: {
    title: string;
    content: string;
    workspace_id?: string;
    description?: string;
    default_tags?: string[];
    default_style?: string;
    is_shared?: boolean;
  }): Promise<{ id: string }> {
    const res = await fetch(`${this.baseUrl}/api/templates`, {
      method: "POST",
      headers: await this.getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) await throwOnError(res, "Failed to create template");
    return json(res);
  }

  async listTemplates(workspaceId?: string): Promise<TemplateMeta[]> {
    const qs = workspaceId ? `?workspace_id=${workspaceId}` : "";
    const res = await fetch(`${this.baseUrl}/api/templates${qs}`, {
      headers: await this.getHeaders(),
    });
    if (!res.ok) await throwOnError(res, "Failed to list templates");
    return json(res);
  }

  async deleteTemplate(id: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/templates/${id}`, {
      method: "DELETE",
      headers: await this.getHeaders(),
    });
    if (!res.ok) await throwOnError(res, "Failed to delete template");
  }

  // ─── Share Links ──────────────────────────────────────────────────────────

  async createShareLink(
    documentId: string,
    options?: { permission?: string; expires_in_days?: number },
  ): Promise<{ id: string; token: string; url: string }> {
    const res = await fetch(`${this.baseUrl}/api/documents/${documentId}/share`, {
      method: "POST",
      headers: await this.getHeaders(),
      body: JSON.stringify(options ?? {}),
    });
    if (!res.ok) await throwOnError(res, "Failed to create share link");
    return json(res);
  }

  async listShareLinks(documentId: string): Promise<
    Array<{
      id: string;
      permission: string;
      token: string;
      expires_at: string | null;
      created_at: string;
    }>
  > {
    const res = await fetch(`${this.baseUrl}/api/documents/${documentId}/shares`, {
      headers: await this.getHeaders(),
    });
    if (!res.ok) await throwOnError(res, "Failed to list share links");
    return json(res);
  }

  async deleteShareLink(shareId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/shares/${shareId}`, {
      method: "DELETE",
      headers: await this.getHeaders(),
    });
    if (!res.ok) await throwOnError(res, "Failed to delete share link");
  }

  // ─── Patterns ──────────────────────────────────────────────────────────────

  async listPatterns(params?: {
    level?: string;
    scope?: string;
    search?: string;
    tags?: string;
    sort?: string;
    limit?: number;
    offset?: number;
  }): Promise<PatternListResponse> {
    const qs = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) qs.set(k, String(v));
      }
    }
    const url = `${this.baseUrl}/api/patterns${qs.toString() ? `?${qs}` : ""}`;
    const res = await fetch(url, { headers: await this.getHeaders() });
    if (!res.ok) await throwOnError(res, "Failed to list patterns");
    return json(res);
  }

  async getPattern(id: string): Promise<PatternDetail> {
    const res = await fetch(`${this.baseUrl}/api/patterns/${encodeURIComponent(id)}`, {
      headers: await this.getHeaders(),
    });
    if (!res.ok) await throwOnError(res, "Failed to get pattern");
    return json(res);
  }

  async createPattern(data: PatternCreateRequest): Promise<{ id: string }> {
    const res = await fetch(`${this.baseUrl}/api/patterns`, {
      method: "POST",
      headers: await this.getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) await throwOnError(res, "Failed to create pattern");
    return json(res);
  }

  async updatePattern(id: string, data: PatternUpdateRequest): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/patterns/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: await this.getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) await throwOnError(res, "Failed to update pattern");
  }

  async deletePattern(id: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/patterns/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: await this.getHeaders(),
    });
    if (!res.ok) await throwOnError(res, "Failed to delete pattern");
  }

  async togglePattern(id: string): Promise<{ is_enabled: boolean }> {
    const res = await fetch(`${this.baseUrl}/api/patterns/${encodeURIComponent(id)}/toggle`, {
      method: "PATCH",
      headers: await this.getHeaders(),
    });
    if (!res.ok) await throwOnError(res, "Failed to toggle pattern");
    return json(res);
  }

  async forkPattern(id: string, overrides?: PatternUpdateRequest): Promise<{ id: string }> {
    const res = await fetch(`${this.baseUrl}/api/patterns/${encodeURIComponent(id)}/fork`, {
      method: "POST",
      headers: await this.getHeaders(),
      body: JSON.stringify({ overrides }),
    });
    if (!res.ok) await throwOnError(res, "Failed to fork pattern");
    return json(res);
  }

  async exportPatterns(params?: {
    scope?: string;
    level?: string;
    ids?: string;
  }): Promise<PatternExportPayload> {
    const qs = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) qs.set(k, v);
      }
    }
    const url = `${this.baseUrl}/api/patterns/export${qs.toString() ? `?${qs}` : ""}`;
    const res = await fetch(url, { headers: await this.getHeaders() });
    if (!res.ok) await throwOnError(res, "Failed to export patterns");
    return json(res);
  }

  async importPatterns(data: PatternImportRequest): Promise<PatternImportResult> {
    const res = await fetch(`${this.baseUrl}/api/patterns/import`, {
      method: "POST",
      headers: await this.getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) await throwOnError(res, "Failed to import patterns");
    return json(res);
  }

  async getPatternVersions(id: string): Promise<{ versions: PatternVersion[] }> {
    const res = await fetch(`${this.baseUrl}/api/patterns/${encodeURIComponent(id)}/versions`, {
      headers: await this.getHeaders(),
    });
    if (!res.ok) await throwOnError(res, "Failed to get pattern versions");
    return json(res);
  }

  async revertPattern(id: string, version: number): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/patterns/${encodeURIComponent(id)}/revert`, {
      method: "POST",
      headers: await this.getHeaders(),
      body: JSON.stringify({ version }),
    });
    if (!res.ok) await throwOnError(res, "Failed to revert pattern");
  }

  /** Build WebSocket URL for a document */
  wsUrl(documentId: string): string {
    const wsBase = this.baseUrl.replace(/^http/, "ws");
    return `${wsBase}/api/documents/${documentId}/ws`;
  }
}

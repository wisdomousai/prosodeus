export const queryKeys = {
  documents: {
    all: ["documents"] as const,
    list: (filters?: { workspace_id?: string; status?: string }) =>
      ["documents", "list", filters ?? {}] as const,
    detail: (id: string) => ["documents", "detail", id] as const,
  },
  folders: {
    all: ["folders"] as const,
    list: () => ["folders", "list"] as const,
  },
  workspaces: {
    all: ["workspaces"] as const,
    list: () => ["workspaces", "list"] as const,
    analytics: (id: string) => ["workspaces", "analytics", id] as const,
  },
  patterns: {
    all: ["patterns"] as const,
    list: (filters?: { level?: string; scope?: string; search?: string }) =>
      ["patterns", "list", filters ?? {}] as const,
    detail: (id: string) => ["patterns", "detail", id] as const,
    versions: (id: string) => ["patterns", "versions", id] as const,
  },
  templates: {
    all: ["templates"] as const,
    list: (workspaceId?: string) => ["templates", "list", workspaceId] as const,
  },
  tags: {
    workspace: (workspaceId: string) => ["tags", "workspace", workspaceId] as const,
  },
  user: {
    me: () => ["user", "me"] as const,
  },
  models: () => ["models"] as const,
  styles: () => ["styles"] as const,
} as const;

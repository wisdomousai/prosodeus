import { contextBridge, ipcRenderer } from "electron";

/**
 * The renderer-visible API surface.
 *
 * Each method is a one-line wrapper around `ipcRenderer.invoke()` matching a
 * handler registered in `main.ts` via `ipcMain.handle`. Keep this list flat —
 * if it starts growing nested namespaces, that's a sign business logic is
 * leaking into the preload.
 */
const api = {
  documents: {
    list: (opts?: { workspaceId?: string; folderId?: string; limit?: number }) =>
      ipcRenderer.invoke("documents:list", opts ?? {}),
    get: (id: string) => ipcRenderer.invoke("documents:get", id),
    create: (input: {
      id: string;
      title?: string;
      content?: string;
      workspaceId?: string;
      folderId?: string;
    }) => ipcRenderer.invoke("documents:create", input),
    updateContent: (args: { id: string; content: string; contentFormat?: string }) =>
      ipcRenderer.invoke("documents:updateContent", args),
    rename: (args: { id: string; title: string }) => ipcRenderer.invoke("documents:rename", args),
    delete: (id: string) => ipcRenderer.invoke("documents:delete", id),
  },
  iterations: {
    list: (args: { documentId: string; limit?: number }) =>
      ipcRenderer.invoke("iterations:list", args),
  },
  versions: {
    list: (args: { documentId: string; limit?: number }) =>
      ipcRenderer.invoke("versions:list", args),
    get: (versionId: number) => ipcRenderer.invoke("versions:get", versionId),
    create: (input: { documentId: string; content: string; name?: string; source?: string }) =>
      ipcRenderer.invoke("versions:create", input),
    compare: (args: { versionA: number; versionB: number }) =>
      ipcRenderer.invoke("versions:compare", args),
  },
  analyze: (args: {
    documentId: string;
    text: string;
    style?: string;
    model?: string;
    topSuggestions?: number;
    analyzeMode?: "full" | "incremental";
    changedSentenceIds?: number[];
    suggestMode?: "batch" | "none";
    aiSlopMode?: "off" | "fast" | "tiered" | "exhaustive";
  }) => ipcRenderer.invoke("analyze:run", args),
  onAnalyzePartial: (
    cb: (payload: { documentId: string; profile: unknown; done: boolean }) => void,
  ) => {
    const handler = (
      _e: unknown,
      payload: { documentId: string; profile: unknown; done: boolean },
    ) => cb(payload);
    ipcRenderer.on("analyze:partial", handler);
    return () => ipcRenderer.off("analyze:partial", handler);
  },
  /** Suggestions for the last analyze arrive later on a heavier model; pushed from main. */
  onAnalyzeSuggestions: (cb: (payload: { documentId: string; suggestions: unknown[] }) => void) => {
    const handler = (_e: unknown, payload: { documentId: string; suggestions: unknown[] }) =>
      cb(payload);
    ipcRenderer.on("analyze:suggestions", handler);
    return () => ipcRenderer.off("analyze:suggestions", handler);
  },
  rewrite: (args: {
    text: string;
    style?: string;
    model?: string;
    passageStart?: number;
    passageEnd?: number;
    usePCE?: boolean;
  }) => ipcRenderer.invoke("rewrite:run", args),
  rewriteAlternatives: (args: {
    text: string;
    passageStart: number;
    passageEnd: number;
    constraints?: Record<string, unknown>;
    n: number;
    style?: string;
    model?: string;
  }) => ipcRenderer.invoke("rewrite:alternatives", args),
  runOpposition: (args: { text: string; style?: string; model?: string; maxPasses?: number }) =>
    ipcRenderer.invoke("opposition:run", args),
  onOppositionProgress: (cb: (payload: { step: string }) => void) => {
    const handler = (_e: unknown, payload: { step: string }) => cb(payload);
    ipcRenderer.on("opposition:progress", handler);
    return () => ipcRenderer.off("opposition:progress", handler);
  },
  equilibrium: (args: { text: string; style?: string; model?: string }) =>
    ipcRenderer.invoke("equilibrium:run", args),
  reverseGuide: (args: { text: string; name: string; description: string; model?: string }) =>
    ipcRenderer.invoke("reverse-guide:run", args),
  suggest: (args: {
    text: string;
    sentenceId: number;
    model?: string;
    models?: string[];
    mode?: "single" | "council";
    level?: string;
    numAlternatives?: number;
    customInstruction?: string;
    profileSentence?: {
      text: string;
      classification: import("@prosodeus/core/browser").SentenceClassification;
    };
  }) =>
    ipcRenderer.invoke("suggest:run", args) as Promise<{
      suggestions: import("@prosodeus/core/browser").RewriteSuggestion[];
      notice?: string;
    }>,
  fetchStyles: () =>
    ipcRenderer.invoke("styles:list") as Promise<Array<{ name: string; description: string }>>,
  fetchModels: () =>
    ipcRenderer.invoke("models:list") as Promise<
      Array<{
        id: string;
        name: string;
        provider: string;
        mode?: "local-codex-host";
      }>
    >,
  claude: {
    hasCredentials: () => ipcRenderer.invoke("claude:hasCredentials") as Promise<boolean>,
    login: () => ipcRenderer.invoke("claude:login") as Promise<{ ok: true }>,
    /** Subscribe to streaming login output. Returns an unsubscribe function. */
    onLoginOutput: (cb: (line: string) => void) => {
      const handler = (_e: unknown, line: string) => cb(line);
      ipcRenderer.on("claude:login:output", handler);
      return () => ipcRenderer.off("claude:login:output", handler);
    },
    onLoginDone: (cb: () => void) => {
      const handler = () => cb();
      ipcRenderer.on("claude:login:done", handler);
      return () => ipcRenderer.off("claude:login:done", handler);
    },
    onLoginError: (cb: (msg: string) => void) => {
      const handler = (_e: unknown, msg: string) => cb(msg);
      ipcRenderer.on("claude:login:error", handler);
      return () => ipcRenderer.off("claude:login:error", handler);
    },
  },
  codex: {
    hasCredentials: () => ipcRenderer.invoke("codex:hasCredentials") as Promise<boolean>,
    login: () => ipcRenderer.invoke("codex:login") as Promise<{ ok: true }>,
    /** Subscribe to streaming login output. Returns an unsubscribe function. */
    onLoginOutput: (cb: (line: string) => void) => {
      const handler = (_e: unknown, line: string) => cb(line);
      ipcRenderer.on("codex:login:output", handler);
      return () => ipcRenderer.off("codex:login:output", handler);
    },
    onLoginDone: (cb: () => void) => {
      const handler = () => cb();
      ipcRenderer.on("codex:login:done", handler);
      return () => ipcRenderer.off("codex:login:done", handler);
    },
    onLoginError: (cb: (msg: string) => void) => {
      const handler = (_e: unknown, msg: string) => cb(msg);
      ipcRenderer.on("codex:login:error", handler);
      return () => ipcRenderer.off("codex:login:error", handler);
    },
  },
  byok: {
    list: () => ipcRenderer.invoke("byok:list") as Promise<string[]>,
    set: (provider: string, apiKey: string) => ipcRenderer.invoke("byok:set", { provider, apiKey }),
    remove: (provider: string) => ipcRenderer.invoke("byok:remove", provider),
    devVarsStatus: () =>
      ipcRenderer.invoke("byok:devVarsStatus") as Promise<{
        active: boolean;
        path: string | null;
        providers: string[];
        cfConfigured: boolean;
      }>,
  },
  cf: {
    hasCredentials: () => ipcRenderer.invoke("cf:hasCredentials") as Promise<boolean>,
    set: (args: { accountId: string; apiToken: string }) => ipcRenderer.invoke("cf:set", args),
    remove: () => ipcRenderer.invoke("cf:remove") as Promise<{ ok: true }>,
  },
  usage: {
    list: () =>
      ipcRenderer.invoke("usage:list") as Promise<
        Array<{
          provider: string;
          count: number;
          limit: number | null;
          pct: number | null;
          nearLimit: boolean;
        }>
      >,
  },
  // Incoming protocol / file-open events from main
  onAnalyzeRequest: (cb: (payload: { text: string; title?: string }) => void) => {
    const handler = (_e: unknown, payload: { text: string; title?: string }) => cb(payload);
    ipcRenderer.on("prosodeus:analyze", handler);
    return () => ipcRenderer.off("prosodeus:analyze", handler);
  },
  onFileRequest: (cb: (payload: { path: string }) => void) => {
    const handler = (_e: unknown, payload: { path: string }) => cb(payload);
    ipcRenderer.on("prosodeus:file", handler);
    return () => ipcRenderer.off("prosodeus:file", handler);
  },
};

contextBridge.exposeInMainWorld("prosodeus", api);

export type ProsodeusApi = typeof api;
declare global {
  interface Window {
    prosodeus: ProsodeusApi;
  }
}

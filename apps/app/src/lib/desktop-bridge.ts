/**
 * Renderer-side bridge to the Electron main process.
 *
 * In the desktop build, `window.prosodeus` is populated by the preload script.
 * In the web build, it's `undefined` and code should
 * fall back to the existing Worker WebSocket / fetch flow.
 *
 * Use `isDesktop()` to branch, or `desktopApi()` to get the (typed) API
 * surface — it throws if called outside the desktop build, so wrap accordingly.
 */
import type {
  AiSlopMatcherMode,
  EquilibriumResult,
  RewriteResult,
  RewriteSuggestion,
  StyleGuide,
  StylometricProfile,
} from "@prosodeus/core/browser";
import type {
  ModelInfo,
  OppositionResultEvent,
  RewriteAlternative,
  RewriteConstraints,
} from "@prosodeus/shared/browser";

interface DesktopApi {
  documents: {
    list: (opts?: { workspaceId?: string; folderId?: string; limit?: number }) => Promise<unknown>;
    get: (id: string) => Promise<unknown>;
    create: (input: {
      id: string;
      title?: string;
      content?: string;
      workspaceId?: string;
      folderId?: string;
    }) => Promise<unknown>;
    updateContent: (args: {
      id: string;
      content: string;
      contentFormat?: string;
    }) => Promise<unknown>;
    rename: (args: { id: string; title: string }) => Promise<unknown>;
    delete: (id: string) => Promise<unknown>;
  };
  iterations: {
    list: (args: { documentId: string; limit?: number }) => Promise<unknown>;
  };
  versions: {
    list: (args: { documentId: string; limit?: number }) => Promise<unknown>;
    get: (versionId: number) => Promise<unknown>;
    create: (input: {
      documentId: string;
      content: string;
      name?: string;
      source?: string;
    }) => Promise<unknown>;
    compare: (args: { versionA: number; versionB: number }) => Promise<unknown>;
  };
  analyze: (args: {
    documentId: string;
    text: string;
    style?: string;
    model?: string;
    topSuggestions?: number;
    analyzeMode?: "full" | "incremental";
    changedSentenceIds?: number[];
    suggestMode?: "batch" | "none";
    aiSlopMode?: AiSlopMatcherMode;
  }) => Promise<{ profile: StylometricProfile }>;
  onAnalyzePartial?: (
    cb: (payload: { documentId: string; profile: StylometricProfile; done: boolean }) => void,
  ) => () => void;
  /** Suggestions for the last analyze arrive later on a heavier model; pushed from main. */
  onAnalyzeSuggestions: (
    cb: (payload: { documentId: string; suggestions: RewriteSuggestion[] }) => void,
  ) => () => void;
  rewrite: (args: {
    text: string;
    style?: string;
    model?: string;
    passageStart?: number;
    passageEnd?: number;
    usePCE?: boolean;
  }) => Promise<RewriteResult>;
  rewriteAlternatives: (args: {
    text: string;
    passageStart: number;
    passageEnd: number;
    constraints?: RewriteConstraints;
    n: number;
    style?: string;
    model?: string;
  }) => Promise<{
    original: string;
    constraints: RewriteConstraints | null;
    alternatives: RewriteAlternative[];
  }>;
  runOpposition: (args: {
    text: string;
    style?: string;
    model?: string;
    maxPasses?: number;
  }) => Promise<OppositionResultEvent["data"]>;
  onOppositionProgress: (cb: (payload: { step: string }) => void) => () => void;
  equilibrium: (args: {
    text: string;
    style?: string;
    model?: string;
  }) => Promise<EquilibriumResult>;
  reverseGuide: (args: {
    text: string;
    name: string;
    description: string;
    model?: string;
  }) => Promise<StyleGuide>;
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
  }) => Promise<{ suggestions: RewriteSuggestion[]; notice?: string }>;
  fetchStyles: () => Promise<Array<{ name: string; description: string }>>;
  fetchModels: () => Promise<ModelInfo[]>;
  /** BYOK key management (desktop only). */
  byok: {
    list: () => Promise<string[]>;
    set: (provider: string, apiKey: string) => Promise<{ ok: true }>;
    remove: (provider: string) => Promise<{ ok: true }>;
    devVarsStatus: () => Promise<{
      active: boolean;
      path: string | null;
      providers: string[];
      cfConfigured: boolean;
    }>;
  };
  /** Cloudflare Workers AI credentials (desktop only). */
  cf: {
    hasCredentials: () => Promise<boolean>;
    set: (args: { accountId: string; apiToken: string }) => Promise<{ ok: true }>;
    remove: () => Promise<{ ok: true }>;
  };
  /** Daily LLM request counters per provider. */
  usage: {
    list: () => Promise<
      Array<{
        provider: string;
        count: number;
        limit: number | null;
        pct: number | null;
        nearLimit: boolean;
      }>
    >;
  };
  /** Claude Code login (Agent SDK credentials). */
  claude: {
    hasCredentials: () => Promise<boolean>;
    login: () => Promise<{ ok: true }>;
    onLoginOutput: (cb: (line: string) => void) => () => void;
    onLoginDone: (cb: () => void) => () => void;
    onLoginError: (cb: (msg: string) => void) => () => void;
  };
  /** Codex CLI login (ChatGPT credentials). */
  codex: {
    hasCredentials: () => Promise<boolean>;
    login: () => Promise<{ ok: true }>;
    onLoginOutput: (cb: (line: string) => void) => () => void;
    onLoginDone: (cb: () => void) => () => void;
    onLoginError: (cb: (msg: string) => void) => () => void;
  };
  /** Subscribe to prosodeus://analyze requests from external apps / CLI. */
  onAnalyzeRequest: (cb: (payload: { text: string; title?: string }) => void) => () => void;
  /** Subscribe to prosodeus://file requests (file path to open). */
  onFileRequest: (cb: (payload: { path: string }) => void) => () => void;
}

declare global {
  interface Window {
    prosodeus?: DesktopApi;
  }
}

export function isDesktop(): boolean {
  return typeof window !== "undefined" && typeof window.prosodeus !== "undefined";
}

export function desktopApi(): DesktopApi {
  if (typeof window === "undefined" || !window.prosodeus) {
    throw new Error("desktopApi() called outside the desktop build — gate with isDesktop()");
  }
  return window.prosodeus;
}

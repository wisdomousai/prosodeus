import type { Env } from "../src/index.ts";

/**
 * Create a mock Env with no API keys configured (dev mode).
 * Override individual keys as needed in tests.
 */
export function mockEnv(overrides: Partial<Env> = {}): Env {
  return {
    HYPERDRIVE: mockHyperdrive(),
    CACHE: mockKV(),
    DOCUMENT: mockDurableObjectNamespace(),
    AI_API_KEY: "",
    GOOGLE_API_KEY: "",
    GROQ_API_KEY: "",
    MISTRAL_API_KEY: "",
    CLOUDFLARE_ACCOUNT_ID: "",
    ...overrides,
  } as Env;
}

export function mockHyperdrive(): Hyperdrive {
  return {
    connectionString: "postgres://mock:mock@localhost:5432/mock",
    host: "localhost",
    port: 5432,
    user: "mock",
    password: "mock",
    database: "mock",
  } as unknown as Hyperdrive;
}

export function mockKV(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value);
    },
    delete: async (key: string) => {
      store.delete(key);
    },
    list: async () => ({ keys: [], list_complete: true, caches: [] }),
    getWithMetadata: async (key: string) => ({ value: store.get(key) ?? null, metadata: null }),
  } as unknown as KVNamespace;
}

export function mockDurableObjectNamespace(): DurableObjectNamespace {
  return {
    idFromName: (_name: string) => ({ toString: () => "mock-do-id" }),
    get: (_id: unknown) => ({
      fetch: async (req: Request) => new Response("mock-do", { status: 200 }),
    }),
    newUniqueId: () => ({ toString: () => "mock-unique-id" }),
  } as unknown as DurableObjectNamespace;
}

export function mockWebSocket() {
  const sent: string[] = [];
  return {
    sent,
    send(msg: string) {
      sent.push(msg);
    },
    close(_code?: number, _reason?: string) {},
    accept() {},
    addEventListener() {},
    removeEventListener() {},
  } as unknown as WebSocket;
}

export function mockSql() {
  const tables = new Map<string, unknown[]>();
  return {
    exec: (query: string, ..._args: unknown[]) => {
      // Return an empty iterable for SELECT queries
      if (query.trim().toUpperCase().startsWith("SELECT")) {
        return [] as unknown[];
      }
      return [] as unknown[];
    },
  };
}

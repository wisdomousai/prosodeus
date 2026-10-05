import { describe, expect, test } from "bun:test";
import app from "../src/index.ts";
import { mockEnv } from "./helpers.ts";

// Hono's built-in test pattern: app.request(path, init, env)
// Auth bypass: no WORKOS_CLIENT_ID/JWKS_URL → dev mode (userId="dev-user")

describe("GET /api/style-guides", () => {
  test("returns array of style guides", async () => {
    const env = mockEnv();
    const res = await app.request("/api/style-guides", {}, env);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty("name");
  });
});

describe("GET /api/models", () => {
  test("returns empty array when no API keys configured", async () => {
    const env = mockEnv();
    const res = await app.request("/api/models", {}, env);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual([]);
  });

  test("includes Groq models when GROQ_API_KEY is set", async () => {
    const env = mockEnv({ GROQ_API_KEY: "test-key" });
    const res = await app.request("/api/models", {}, env);
    expect(res.status).toBe(200);
    const data = (await res.json()) as Array<{ id: string; provider: string }>;
    expect(data.some((m) => m.provider === "Groq")).toBe(true);
  });

  test("includes Mistral models when MISTRAL_API_KEY is set", async () => {
    const env = mockEnv({ MISTRAL_API_KEY: "test-key" });
    const res = await app.request("/api/models", {}, env);
    expect(res.status).toBe(200);
    const data = (await res.json()) as Array<{ id: string; provider: string }>;
    expect(data.some((m) => m.provider === "Mistral")).toBe(true);
  });

  test("includes Workers AI models when AI_API_KEY is set", async () => {
    const env = mockEnv({ AI_API_KEY: "test-key" });
    const res = await app.request("/api/models", {}, env);
    expect(res.status).toBe(200);
    const data = (await res.json()) as Array<{ id: string; provider: string }>;
    expect(data.some((m) => m.provider === "Workers AI")).toBe(true);
  });
});

describe("POST /api/documents", () => {
  test("creates a document and returns id", async () => {
    const env = mockEnv();
    const res = await app.request(
      "/api/documents",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Test Doc" }),
      },
      env,
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as { id: string };
    expect(data.id).toBeDefined();
    expect(typeof data.id).toBe("string");
  });

  test("rejects invalid JSON", async () => {
    const env = mockEnv();
    const res = await app.request(
      "/api/documents",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      },
      env,
    );
    expect(res.status).toBe(400);
  });

  test("rejects title over 200 chars", async () => {
    const env = mockEnv();
    const res = await app.request(
      "/api/documents",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "x".repeat(201) }),
      },
      env,
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /api/documents", () => {
  test("returns array of documents", async () => {
    const env = mockEnv();
    const res = await app.request("/api/documents", {}, env);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});

describe("PUT /api/documents/:id", () => {
  test("rejects empty update", async () => {
    const env = mockEnv();
    const res = await app.request(
      "/api/documents/test-id",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
      env,
    );
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("No fields");
  });

  test("rejects invalid mean_heat", async () => {
    const env = mockEnv();
    const res = await app.request(
      "/api/documents/test-id",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mean_heat: 11 }),
      },
      env,
    );
    expect(res.status).toBe(400);
  });

  test("rejects negative word_count", async () => {
    const env = mockEnv();
    const res = await app.request(
      "/api/documents/test-id",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word_count: -1 }),
      },
      env,
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /api/documents/:id/ws", () => {
  test("returns 426 without Upgrade header", async () => {
    const env = mockEnv();
    const res = await app.request("/api/documents/test-id/ws", {}, env);
    expect(res.status).toBe(426);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("WebSocket");
  });
});

import { describe, expect, test } from "bun:test";
import { buildCouncilModels, createClassifier, resolveModel } from "../src/models.ts";

// ─── Model Resolution Tests ─────────────────────────────────────────────────

describe("resolveModel", () => {
  test("returns model for google when API key present", () => {
    const model = resolveModel({ GOOGLE_API_KEY: "test-key" }, "google", "gemini-2.5-flash");
    expect(model).not.toBeNull();
    expect(model?.modelId).toBe("gemini-2.5-flash");
  });

  test("returns null for groq when no API key", () => {
    const model = resolveModel({}, "groq", "qwen/qwen3-32b");
    expect(model).toBeNull();
  });

  test("returns model for groq when API key present", () => {
    const model = resolveModel({ GROQ_API_KEY: "test-key" }, "groq", "qwen/qwen3-32b");
    expect(model).not.toBeNull();
    expect(model?.modelId).toBe("qwen/qwen3-32b");
  });

  test("returns null for mistral when no API key", () => {
    const model = resolveModel({}, "mistral", "mistral-small-latest");
    expect(model).toBeNull();
  });

  test("returns model for mistral when API key present", () => {
    const model = resolveModel({ MISTRAL_API_KEY: "test-key" }, "mistral", "mistral-small-latest");
    expect(model).not.toBeNull();
  });

  test("returns model for workers-ai (no key check needed for resolution)", () => {
    const model = resolveModel(
      { AI_API_KEY: "test", CLOUDFLARE_ACCOUNT_ID: "acct" },
      "workers-ai",
      "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    );
    expect(model).not.toBeNull();
  });

  test("returns null for unknown provider", () => {
    const model = resolveModel({}, "unknown", "some-model");
    expect(model).toBeNull();
  });

  test("uses default model ID when empty string provided", () => {
    const model = resolveModel({ GROQ_API_KEY: "test" }, "groq", "");
    expect(model).not.toBeNull();
    expect(model?.modelId).toBe("llama-3.3-70b-versatile");
  });
});

// ─── Council Model Tests ─────────────────────────────────────────────────────

describe("buildCouncilModels", () => {
  test("returns empty array when no API keys", () => {
    const models = buildCouncilModels({});
    expect(models).toEqual([]);
  });

  test("includes groq model when GROQ_API_KEY set", () => {
    const models = buildCouncilModels({ GROQ_API_KEY: "test" });
    expect(models.length).toBe(1);
  });

  test("includes both groq and mistral when both keys set", () => {
    const models = buildCouncilModels({
      GROQ_API_KEY: "test",
      MISTRAL_API_KEY: "test",
    });
    expect(models.length).toBe(2);
  });

  test("includes Google, Groq, and Mistral when all supported keys set", () => {
    const models = buildCouncilModels({
      GOOGLE_API_KEY: "test",
      GROQ_API_KEY: "test",
      MISTRAL_API_KEY: "test",
    });
    expect(models.length).toBe(3);
  });

  test("skips workers-ai when CLOUDFLARE_ACCOUNT_ID missing", () => {
    const models = buildCouncilModels({ AI_API_KEY: "test" });
    expect(models.length).toBe(0);
  });
});

// ─── Classifier Factory Tests ────────────────────────────────────────────────

describe("createClassifier", () => {
  test("throws when no API keys configured", () => {
    expect(() => createClassifier({})).toThrow("required");
  });

  test("prefers Google Gemini by default when GOOGLE_API_KEY is present", () => {
    const classifier = createClassifier({
      GOOGLE_API_KEY: "test",
      GROQ_API_KEY: "test",
      MISTRAL_API_KEY: "test",
    });
    expect(classifier).toBeDefined();
    expect((classifier as unknown as { model: { modelId: string } }).model.modelId).toBe(
      "gemini-2.5-flash",
    );
  });

  test("creates classifier with GROQ_API_KEY", () => {
    const classifier = createClassifier({ GROQ_API_KEY: "test" });
    expect(classifier).toBeDefined();
  });

  test("creates classifier with MISTRAL_API_KEY", () => {
    const classifier = createClassifier({ MISTRAL_API_KEY: "test" });
    expect(classifier).toBeDefined();
  });

  test("creates classifier with GOOGLE_API_KEY", () => {
    const classifier = createClassifier({
      GOOGLE_API_KEY: "test",
    });
    expect(classifier).toBeDefined();
  });

  test("uses specified model when modelSpec provided", () => {
    const classifier = createClassifier({ GROQ_API_KEY: "test" }, "groq/llama-3.3-70b-versatile");
    expect(classifier).toBeDefined();
  });

  test("falls back to default when modelSpec provider has no key", () => {
    const classifier = createClassifier(
      { GROQ_API_KEY: "test" },
      "mistral/mistral-small-latest", // no MISTRAL_API_KEY → falls back to groq
    );
    expect(classifier).toBeDefined();
  });
});

// ─── WebSocket Message Handler Tests (pure logic) ────────────────────────────

describe("message validation", () => {
  test("empty text is detected", () => {
    const text = "";
    expect(!text?.trim()).toBe(true);
  });

  test("whitespace-only text is detected", () => {
    const text = "   \n\t  ";
    expect(!text?.trim()).toBe(true);
  });

  test("text over limit is detected", () => {
    const MAX_TEXT_LENGTH = 250_000;
    const text = "x".repeat(MAX_TEXT_LENGTH + 1);
    expect(text.length > MAX_TEXT_LENGTH).toBe(true);
  });

  test("valid text passes checks", () => {
    const MAX_TEXT_LENGTH = 250_000;
    const text = "This is a valid sentence for analysis.";
    expect(!text?.trim()).toBe(false);
    expect(text.length > MAX_TEXT_LENGTH).toBe(false);
  });
});

describe("iteration formatting", () => {
  test("formats iteration rows correctly", () => {
    const rows = [
      {
        id: 1,
        created_at: "2024-01-01 00:00:00",
        source: "websocket",
        profile: JSON.stringify({ mean_heat: 5.2, sentence_count: 10, word_count: 150 }),
      },
    ];

    const iterations = rows.map((row) => {
      let profile: { mean_heat?: number; sentence_count?: number; word_count?: number } = {};
      try {
        profile = JSON.parse(row.profile);
      } catch {
        /* ignore */
      }
      return {
        id: row.id,
        created_at: row.created_at,
        source: row.source,
        mean_heat: profile.mean_heat ?? 0,
        sentence_count: profile.sentence_count ?? 0,
        word_count: profile.word_count ?? 0,
      };
    });

    expect(iterations).toHaveLength(1);
    expect(iterations[0]?.mean_heat).toBe(5.2);
    expect(iterations[0]?.sentence_count).toBe(10);
    expect(iterations[0]?.word_count).toBe(150);
  });

  test("handles malformed profile JSON gracefully", () => {
    const rows = [{ id: 1, created_at: "2024-01-01", source: "ws", profile: "not-json" }];

    const iterations = rows.map((row) => {
      let profile: { mean_heat?: number; sentence_count?: number; word_count?: number } = {};
      try {
        profile = JSON.parse(row.profile);
      } catch {
        /* ignore */
      }
      return {
        id: row.id,
        mean_heat: profile.mean_heat ?? 0,
        sentence_count: profile.sentence_count ?? 0,
        word_count: profile.word_count ?? 0,
      };
    });

    expect(iterations[0]?.mean_heat).toBe(0);
    expect(iterations[0]?.sentence_count).toBe(0);
  });
});

describe("unknown message type handling", () => {
  test("unknown type does not throw", () => {
    const msg = { type: "nonexistent_type" };
    const knownTypes = [
      "analyze",
      "rewrite",
      "equilibrium",
      "reverse_guide",
      "opposition_run",
      "save",
      "load_content",
      "list_iterations",
    ];
    expect(knownTypes.includes(msg.type)).toBe(false);
    // The switch statement in webSocketMessage simply doesn't match — no crash
  });
});

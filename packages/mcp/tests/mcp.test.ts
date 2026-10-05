import { describe, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { ClassifiedSentence, HashedSentence } from "@prosodeus/core";
import { LLMClassifier, NullCache } from "@prosodeus/core";
import type { LanguageModel } from "ai";
import { createServer } from "../src/mcp.ts";

// Dummy LanguageModel for MockClassifier constructors
const dummyModel = { modelId: "test", provider: "test" } as unknown as LanguageModel;

// ─── Mock classifier ────────────────────────────────────────────────────────

class MockClassifier extends LLMClassifier {
  constructor() {
    super(dummyModel);
  }

  override async classify(sentences: HashedSentence[]): Promise<ClassifiedSentence[]> {
    return sentences.map((s) => ({
      ...s,
      classification: {
        biber: {
          informational: 0.5,
          involved: 0.2,
          narrative: 0.1,
          persuasive: 0.1,
          abstract: 0.05,
          elaborative: 0.05,
        },
        patterns: [],
        metrics: {
          word_count: s.text.split(/\s+/).length,
          clause_count: 1,
          has_participial: false,
          has_relative_clause: false,
          clause_balance_ratio: 0.5,
          construction_type: "simple",
        },
        arc_role: "claim",
      },
      heat: 0,
    }));
  }
}

// ─── Mock classifier that returns patterns (for richer testing) ─────────────

class PatternMockClassifier extends LLMClassifier {
  constructor() {
    super(dummyModel);
  }

  override async classify(sentences: HashedSentence[]): Promise<ClassifiedSentence[]> {
    return sentences.map((s) => ({
      ...s,
      classification: {
        biber: {
          informational: 0.5,
          involved: 0.2,
          narrative: 0.1,
          persuasive: 0.1,
          abstract: 0.05,
          elaborative: 0.05,
        },
        patterns: [
          {
            type: "nominalization" as const,
            confidence: 0.9,
            evidence: "implementation",
          },
        ],
        metrics: {
          word_count: s.text.split(/\s+/).length,
          clause_count: 2,
          has_participial: false,
          has_relative_clause: false,
          clause_balance_ratio: 0.5,
          construction_type: "complex",
        },
        arc_role: "claim",
      },
      heat: 3,
    }));
  }
}

// ─── Helper: create connected client+server pair ─────────────────────────────

async function createTestPair(classifier?: LLMClassifier) {
  const server = createServer({
    analyzeOptions: {
      cache: new NullCache(),
      classifier: classifier ?? new MockClassifier(),
    },
  });

  const client = new Client({ name: "test-client", version: "1.0.0" });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  return { server, client };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("MCP Server", () => {
  describe("tools/list", () => {
    test("lists all 5 tools", async () => {
      const { client } = await createTestPair();
      const result = await client.listTools();

      const names = result.tools.map((t) => t.name);
      expect(names).toContain("screen_text");
      expect(names).toContain("generate_constraints");
      expect(names).toContain("verify_rewrite");
      expect(names).toContain("list_style_guides");
      expect(names).toContain("get_style_guide");
      expect(result.tools.length).toBe(5);
    });
  });

  describe("screen_text", () => {
    test("returns analysis with summary and profile JSON", async () => {
      const { client } = await createTestPair();
      const result = await client.callTool({
        name: "screen_text",
        arguments: { text: "First sentence here. Second sentence here." },
      });

      expect(result.content).toHaveLength(2);
      const [summary, json] = result.content as [
        { type: string; text: string },
        { type: string; text: string },
      ];
      expect(summary.text).toContain("Prosodeus Analysis");
      expect(summary.text).toContain("**Sentences:** 2");
      expect(json.text).toContain("sentence_count");
    });

    test("applies style guide when provided", async () => {
      const { client } = await createTestPair();
      const result = await client.callTool({
        name: "screen_text",
        arguments: {
          text: "Some text. More text.",
          style: "general",
        },
      });

      const [summary] = result.content as [{ type: string; text: string }];
      expect(summary.text).toContain("Style Guide: general");
    });
  });

  describe("generate_constraints", () => {
    test("returns diagnosis and rewrite instruction", async () => {
      const { client } = await createTestPair(new PatternMockClassifier());
      const result = await client.callTool({
        name: "generate_constraints",
        arguments: {
          text: "The implementation of the system is complex. Moreover it adds further complexity.",
        },
      });

      const [content] = result.content as [{ type: string; text: string }];
      expect(content.text).toContain("Diagnosis");
      expect(content.text).toContain("Rewrite Instruction");
      expect(content.text).toContain("Rewrite the following passage");
    });

    test("supports passage range", async () => {
      const { client } = await createTestPair();
      const result = await client.callTool({
        name: "generate_constraints",
        arguments: {
          text: "First. Second. Third. Fourth.",
          passage_start: 1,
          passage_end: 2,
        },
      });

      const [content] = result.content as [{ type: string; text: string }];
      expect(content.text).toContain("Rewrite Instruction");
    });
  });

  describe("verify_rewrite", () => {
    test("returns comparison report", async () => {
      const { client } = await createTestPair();
      const result = await client.callTool({
        name: "verify_rewrite",
        arguments: {
          original_text: "First sentence here. Second sentence here.",
          rewritten_text: "A different opening. The second thought rephrased entirely.",
        },
      });

      const [content] = result.content as [{ type: string; text: string }];
      expect(content.text).toContain("Rewrite Verification");
      expect(content.text).toContain("Before");
      expect(content.text).toContain("After");
      expect(content.text).toContain("Overall:");
    });
  });

  describe("list_style_guides", () => {
    test("returns all built-in guides", async () => {
      const { client } = await createTestPair();
      const result = await client.callTool({
        name: "list_style_guides",
        arguments: {},
      });

      const [content] = result.content as [{ type: string; text: string }];
      expect(content.text).toContain("general");
      expect(content.text).toContain("technical");
      expect(content.text).toContain("fiction");
      expect(content.text).toContain("journalism");
      expect(content.text).toContain("literary-essay");
    });
  });

  describe("get_style_guide", () => {
    test("returns full guide for valid name", async () => {
      const { client } = await createTestPair();
      const result = await client.callTool({
        name: "get_style_guide",
        arguments: { name: "general" },
      });

      const [content] = result.content as [{ type: string; text: string }];
      const guide = JSON.parse(content.text);
      expect(guide.name).toBe("general");
      expect(guide.targets).toBeDefined();
      expect(guide.continuity_parameter).toBeDefined();
    });

    test("returns error for unknown guide", async () => {
      const { client } = await createTestPair();
      const result = await client.callTool({
        name: "get_style_guide",
        arguments: { name: "nonexistent" },
      });

      expect(result.isError).toBe(true);
      const [content] = result.content as [{ type: string; text: string }];
      expect(content.text).toContain("not found");
    });
  });

  describe("resources", () => {
    test("lists resources including style guides", async () => {
      const { client } = await createTestPair();
      const result = await client.listResources();

      const uris = result.resources.map((r) => r.uri);
      expect(uris).toContain("prosodeus://style-guides");
    });

    test("reads style-guides resource", async () => {
      const { client } = await createTestPair();
      const result = await client.readResource({
        uri: "prosodeus://style-guides",
      });

      expect(result.contents).toHaveLength(1);
      const guides = JSON.parse((result.contents[0] as { text: string }).text);
      expect(Array.isArray(guides)).toBe(true);
      expect(guides.length).toBeGreaterThan(0);
      expect(guides[0].name).toBeDefined();
    });

    test("reads individual style guide resource", async () => {
      const { client } = await createTestPair();
      const result = await client.readResource({
        uri: "prosodeus://style-guide/general",
      });

      expect(result.contents).toHaveLength(1);
      const guide = JSON.parse((result.contents[0] as { text: string }).text);
      expect(guide.name).toBe("general");
    });

    test("lists resource templates", async () => {
      const { client } = await createTestPair();
      const result = await client.listResourceTemplates();

      const templates = result.resourceTemplates.map((t) => t.uriTemplate);
      expect(templates).toContain("prosodeus://style-guide/{name}");
    });
  });
});

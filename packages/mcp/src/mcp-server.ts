#!/usr/bin/env node
import { createGroq } from "@ai-sdk/groq";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { LLMClassifier, LocalCache, NullCache } from "@prosodeus/core";
import type { LanguageModel } from "ai";
import { createServer } from "./mcp.ts";

// ─── Configuration from env vars ─────────────────────────────────────────────

const providerName = process.env.PROSODEUS_PROVIDER ?? "groq";

function createModel(): LanguageModel {
  switch (providerName) {
    case "groq": {
      const apiKey = process.env.GROQ_API_KEY ?? process.env.PROSODEUS_PROVIDER_KEY;
      if (!apiKey)
        throw new Error("GROQ_API_KEY or PROSODEUS_PROVIDER_KEY required for groq provider");
      const groq = createGroq({ apiKey });
      return groq(process.env.PROSODEUS_MODEL ?? "qwen/qwen3-32b");
    }
    case "mistral": {
      const apiKey = process.env.MISTRAL_API_KEY ?? process.env.PROSODEUS_PROVIDER_KEY;
      if (!apiKey)
        throw new Error("MISTRAL_API_KEY or PROSODEUS_PROVIDER_KEY required for mistral provider");
      const mistral = createOpenAICompatible({
        name: "mistral",
        baseURL: "https://api.mistral.ai/v1",
        apiKey,
      });
      return mistral(process.env.PROSODEUS_MODEL ?? "mistral-small-latest");
    }
    case "workers-ai": {
      const apiKey = process.env.AI_API_KEY ?? process.env.PROSODEUS_PROVIDER_KEY;
      const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
      if (!apiKey || !accountId)
        throw new Error("AI_API_KEY + CLOUDFLARE_ACCOUNT_ID required for workers-ai");
      const cf = createOpenAICompatible({
        name: "workers-ai",
        baseURL: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`,
        apiKey,
      });
      return cf(process.env.PROSODEUS_MODEL ?? "@cf/meta/llama-3.3-70b-instruct-fp8-fast");
    }
    case "deepinfra": {
      const apiKey = process.env.DEEPINFRA_API_KEY ?? process.env.PROSODEUS_PROVIDER_KEY;
      if (!apiKey)
        throw new Error("DEEPINFRA_API_KEY or PROSODEUS_PROVIDER_KEY required for deepinfra");
      const di = createOpenAICompatible({
        name: "deepinfra",
        baseURL: "https://api.deepinfra.com/v1/openai",
        apiKey,
      });
      return di(process.env.PROSODEUS_MODEL ?? "google/gemma-3-1b-it");
    }
    default:
      throw new Error(
        `Unknown provider "${providerName}". Available: groq, mistral, workers-ai, deepinfra`,
      );
  }
}

let model: LanguageModel;
try {
  model = createModel();
} catch (e: any) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}

const noCache = process.env.PROSODEUS_NO_CACHE === "true";
const cachePath = process.env.PROSODEUS_CACHE_PATH;

// ─── Build dependencies ──────────────────────────────────────────────────────

const classifier = new LLMClassifier(model);
function openCache() {
  if (noCache) return new NullCache();
  try {
    return new LocalCache(cachePath);
  } catch {
    // bun:sqlite is unavailable on Node: run uncached rather than failing.
    console.error("Note: the classification cache needs the Bun runtime; running without a cache.");
    return new NullCache();
  }
}
const cache = openCache();

console.error(`Prosodeus MCP server starting (provider: ${providerName})`);

// ─── Start server ────────────────────────────────────────────────────────────

const server = createServer({ analyzeOptions: { cache, classifier }, rewriteModel: model });
const transport = new StdioServerTransport();
await server.connect(transport);

console.error("Prosodeus MCP server connected via stdio");

import { createGroq } from "@ai-sdk/groq";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { MOONSHOT_CN_BASE, resolveMoonshotClient } from "@prosodeus/core/node";
import type { LanguageModel } from "ai";
import type { Provider } from "./byok-store.ts";

export const CF_DEFAULT_GATE_MODEL = "@cf/meta/llama-3.2-3b-instruct";
export const CF_DEFAULT_FULL_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

/**
 * Build a Workers AI model via Cloudflare's OpenAI-compatible endpoint.
 */
export function buildCfModel(modelId: string, accountId: string, apiToken: string): LanguageModel {
  return createOpenAICompatible({
    name: "workers-ai",
    baseURL: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`,
    apiKey: apiToken,
  })(modelId);
}

/**
 * Build a Vercel-AI `LanguageModel` for a non-Claude provider, given the
 * user's BYOK key. Used by the analyze IPC handler when the user has
 * supplied their own API key for that provider.
 */
export function buildModel(provider: Provider, modelId: string, apiKey: string): LanguageModel {
  switch (provider) {
    case "groq": {
      return createGroq({ apiKey })(modelId);
    }
    case "mistral": {
      return createOpenAICompatible({
        name: "mistral",
        baseURL: "https://api.mistral.ai/v1",
        apiKey,
      })(modelId);
    }
    case "google": {
      return createOpenAICompatible({
        name: "google",
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
        apiKey,
      })(modelId);
    }
    case "openai": {
      return createOpenAICompatible({
        name: "openai",
        baseURL: "https://api.openai.com/v1",
        apiKey,
      })(modelId);
    }
    case "moonshot": {
      const baseOverride =
        process.env.MOONSHOT_BASE_URL ??
        (process.env.MOONSHOT_REGION === "cn" ? MOONSHOT_CN_BASE : undefined);
      const { baseURL, modelId: resolvedId } = resolveMoonshotClient(apiKey, {
        modelId,
        baseUrlOverride: baseOverride,
      });
      return createOpenAICompatible({ name: "moonshot", baseURL, apiKey })(resolvedId);
    }
    default: {
      throw new Error(`Unknown provider: ${provider satisfies never}`);
    }
  }
}

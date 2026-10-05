import { createGroq } from "@ai-sdk/groq";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  GateClassifier,
  LLMClassifier,
  MediumClassifier,
  MOONSHOT_CN_BASE,
  resolveMoonshotClient,
  resolveSpeedProfile,
} from "@prosodeus/core";
import type { LanguageModel } from "ai";

interface ModelEnv {
  GROQ_API_KEY?: string;
  GOOGLE_API_KEY?: string;
  MISTRAL_API_KEY?: string;
  MOONSHOT_API_KEY?: string;
  AI_API_KEY?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_GATEWAY_ID?: string;
}

function createGemini(apiKey: string) {
  return createOpenAICompatible({
    name: "google",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    apiKey,
  });
}

export function resolveModel(
  env: ModelEnv,
  provider: string,
  modelId: string,
): LanguageModel | null {
  switch (provider) {
    case "google": {
      if (!env.GOOGLE_API_KEY) return null;
      return createGemini(env.GOOGLE_API_KEY)(modelId || "gemini-2.5-flash");
    }
    case "groq": {
      if (!env.GROQ_API_KEY) return null;
      return createGroq({ apiKey: env.GROQ_API_KEY })(modelId || "llama-3.3-70b-versatile");
    }
    case "mistral": {
      if (!env.MISTRAL_API_KEY) return null;
      const m = createOpenAICompatible({
        name: "mistral",
        baseURL: "https://api.mistral.ai/v1",
        apiKey: env.MISTRAL_API_KEY,
      });
      return m(modelId || "mistral-small-2506");
    }
    case "moonshot": {
      if (!env.MOONSHOT_API_KEY) return null;
      const baseOverride =
        (env as ModelEnv & { MOONSHOT_BASE_URL?: string; MOONSHOT_REGION?: string })
          .MOONSHOT_BASE_URL ??
        ((env as ModelEnv & { MOONSHOT_REGION?: string }).MOONSHOT_REGION === "cn"
          ? MOONSHOT_CN_BASE
          : undefined);
      const { baseURL, modelId: resolvedId } = resolveMoonshotClient(env.MOONSHOT_API_KEY, {
        modelId,
        baseUrlOverride: baseOverride,
      });
      const m = createOpenAICompatible({ name: "moonshot", baseURL, apiKey: env.MOONSHOT_API_KEY });
      return m(resolvedId);
    }
    case "workers-ai": {
      const cf = createOpenAICompatible({
        name: "workers-ai",
        baseURL: `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/v1`,
        apiKey: env.AI_API_KEY ?? "",
      });
      return cf(modelId || "@cf/meta/llama-3.3-70b-instruct-fp8-fast");
    }
    default:
      return null;
  }
}

export function buildCouncilModels(env: ModelEnv): LanguageModel[] {
  const models: LanguageModel[] = [];

  if (env.GOOGLE_API_KEY) {
    models.push(createGemini(env.GOOGLE_API_KEY)("gemini-2.5-flash"));
  }

  if (env.GROQ_API_KEY) {
    const groq = createGroq({ apiKey: env.GROQ_API_KEY });
    models.push(groq("llama-3.3-70b-versatile"));
  }

  if (env.MISTRAL_API_KEY) {
    const mistral = createOpenAICompatible({
      name: "mistral",
      baseURL: "https://api.mistral.ai/v1",
      apiKey: env.MISTRAL_API_KEY,
    });
    models.push(mistral("mistral-small-2506"));
  }

  return models;
}

export function createClassifier(
  env: ModelEnv,
  modelSpec?: string,
  systemPrompt?: string,
): LLMClassifier {
  const provider =
    modelSpec?.split("/")[0] ??
    (env.GOOGLE_API_KEY ? "google" : env.GROQ_API_KEY ? "groq" : "mistral");
  const speed = resolveSpeedProfile(provider === "workers-ai" ? "cloudflare" : provider);

  if (modelSpec) {
    const [p, ...rest] = modelSpec.split("/");
    const modelId = rest.join("/");
    const model = resolveModel(env, p!, modelId);
    if (model) return new LLMClassifier(model, systemPrompt, speed.full);
  }

  if (env.GOOGLE_API_KEY) {
    return new LLMClassifier(
      createGemini(env.GOOGLE_API_KEY)("gemini-2.5-flash"),
      systemPrompt,
      speed.full,
    );
  }
  if (env.GROQ_API_KEY) {
    const groq = createGroq({ apiKey: env.GROQ_API_KEY });
    return new LLMClassifier(
      groq("llama-3.3-70b-versatile"),
      systemPrompt,
      resolveSpeedProfile("groq").full,
    );
  }
  if (env.MISTRAL_API_KEY) {
    const mistral = createOpenAICompatible({
      name: "mistral",
      baseURL: "https://api.mistral.ai/v1",
      apiKey: env.MISTRAL_API_KEY,
    });
    return new LLMClassifier(
      mistral("mistral-small-latest"),
      systemPrompt,
      resolveSpeedProfile("mistral").full,
    );
  }
  throw new Error("GOOGLE_API_KEY, GROQ_API_KEY, or MISTRAL_API_KEY required");
}

const GATE_MODEL_ID = "@cf/meta/llama-3.2-3b-instruct";

/** Cheap gate classifier for lazy escalation to full classify. */
export function createGateClassifier(env: ModelEnv): GateClassifier | null {
  if (env.CLOUDFLARE_ACCOUNT_ID && env.AI_API_KEY) {
    const baseURL = env.CLOUDFLARE_GATEWAY_ID
      ? `https://gateway.ai.cloudflare.com/v1/${env.CLOUDFLARE_ACCOUNT_ID}/${env.CLOUDFLARE_GATEWAY_ID}/workers-ai`
      : `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/v1`;
    const cf = createOpenAICompatible({
      name: env.CLOUDFLARE_GATEWAY_ID ? "cf-gateway" : "workers-ai",
      baseURL,
      apiKey: env.AI_API_KEY,
      ...(env.CLOUDFLARE_GATEWAY_ID ? { headers: { "cf-aig-cache-ttl": "86400" } } : {}),
    });
    const model = cf(GATE_MODEL_ID);
    if (model) return new GateClassifier(model, undefined, resolveSpeedProfile("cloudflare").gate);
  }
  if (env.GOOGLE_API_KEY) {
    return new GateClassifier(
      createGemini(env.GOOGLE_API_KEY)("gemini-2.5-flash"),
      undefined,
      resolveSpeedProfile("google").gate,
    );
  }
  return null;
}

/** Medium tier for gate positives in [0.4, 0.7). */
export function createMediumClassifier(env: ModelEnv, modelSpec?: string): MediumClassifier | null {
  const spec =
    modelSpec ??
    (env.GOOGLE_API_KEY
      ? "google/gemini-2.5-flash"
      : env.GROQ_API_KEY
        ? "groq/llama-3.3-70b-versatile"
        : null);
  if (!spec) return null;
  const provider = spec.split("/")[0]!;
  const model = resolveModel(env, provider, spec.split("/").slice(1).join("/"));
  if (!model) return null;
  return new MediumClassifier(model, undefined, resolveSpeedProfile(provider).medium);
}

const MODEL_DISPLAY_NAMES: Record<string, string> = {
  "google/gemini-2.5-flash": "Gemini 2.5 Flash",
  "google/gemini-2.5-pro": "Gemini 2.5 Pro",
  "groq/qwen/qwen3-32b": "Qwen 3 32B",
  "groq/llama-3.3-70b-versatile": "Llama 3.3 70B",
  "groq/deepseek-r1-distill-llama-70b": "DeepSeek R1 70B",
  "mistral/mistral-small-latest": "Mistral Small",
  "mistral/mistral-medium-latest": "Mistral Medium",
  "moonshot/kimi-k2-turbo-preview": "Kimi K2 Turbo",
  "moonshot/kimi-k2.6": "Kimi K2.6",
  "workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast": "Workers AI Llama 3.3",
};

export function getModelDisplayName(modelId: string): string {
  return MODEL_DISPLAY_NAMES[modelId] ?? modelId.split("/").pop() ?? modelId;
}

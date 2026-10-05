import { query } from "@anthropic-ai/claude-agent-sdk";
import type { LanguageModel } from "ai";

/**
 * Wrap the Agent SDK's `query()` as a Vercel AI SDK `LanguageModel`.
 *
 * This lets every core function (`rewritePassage`, `findEquilibrium`,
 * `suggestRewrites`, etc.) call Claude through the Agent SDK's auth
 * (Claude Code credentials / $20 SDK plan) without knowing or caring
 * that it isn't a regular provider model.
 *
 * Only `doGenerate` is implemented — streaming is not needed because
 * core functions use `generateText`, not `streamText`.
 */
export function createAgentSDKModel(modelSpec: string): any {
  // Return type is any to satisfy the exact v3 LanguageModelV3 shape required by AI SDK 5.
  // Only doGenerate is implemented; everything else is a stub.
  return {
    specificationVersion: "v3",
    provider: "agent-sdk",
    modelId: modelSpec,
    supportedUrls: {},

    async doGenerate(options: any) {
      let system = "";
      let userText = "";
      for (const msg of options.prompt) {
        if (msg.role === "system") {
          system =
            typeof msg.content === "string"
              ? msg.content
              : (msg.content as Array<{ type: string; text?: string }>)
                  .map((p) => p.text ?? "")
                  .join("");
        }
        if (msg.role === "user") {
          for (const part of msg.content) {
            if (part.type === "text") userText += part.text;
          }
        }
      }

      // Map friendly model ids to what the local Claude Code binary actually accepts.
      // The Agent SDK re-uses the user's `claude` CLI credentials; the CLI only knows
      // a handful of canonical model names (no date suffix, no "claude-" prefix for some).
      const modelForSdk =
        modelSpec === "claude-haiku-4-5"
          ? "haiku"
          : modelSpec === "claude-sonnet-4-6"
            ? "sonnet"
            : modelSpec;

      // Guard against a hanging query – the SDK can block forever on bad model names
      // or missing credentials. A 30 s timeout surfaces the real error to the caller.
      const TIMEOUT_MS = 30_000;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      let assistantText = "";
      try {
        for await (const message of query({
          prompt: userText,
          options: {
            systemPrompt: system,
            tools: [],
            allowedTools: [],
            settingSources: [],
            model: modelForSdk,
            persistSession: false,
            maxTurns: 1,
          },
        })) {
          if (message.type === "assistant") {
            for (const b of message.message?.content ?? []) {
              if (b.type === "text") assistantText += b.text;
            }
          }
        }
      } catch (err: any) {
        clearTimeout(timeout);
        // Re-throw a clearer message so the IPC layer surfaces it instead of timing out silently.
        throw new Error(
          `Agent SDK query failed for model "${modelForSdk}": ${err?.message ?? err}`,
        );
      } finally {
        clearTimeout(timeout);
      }

      return {
        content: [{ type: "text" as const, text: assistantText }],
        finishReason: "stop",
        usage: {
          totalTokens: 0,
          cachedInputTokens: undefined,
          inputTokens: {
            total: 0,
            noCache: undefined,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: {
            total: 0,
            noCache: undefined,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
        },
        warnings: [],
      };
    },

    async doStream() {
      throw new Error("Streaming not supported through Agent SDK model adapter");
    },
  };
}

import { spawn } from "node:child_process";
import { codexRawModelId } from "./codex-config.ts";

/**
 * Wrap the Codex CLI (`codex exec`) as a Vercel AI SDK `LanguageModel`.
 *
 * Mirrors `createAgentSDKModel`: this lets every core function call GPT
 * through the user's ChatGPT login (Codex CLI OAuth, ~/.codex/auth.json)
 * without knowing it isn't a regular provider model. No API key involved.
 *
 * Only `doGenerate` is implemented — streaming is not needed because
 * core functions use `generateText`, not `streamText`.
 *
 * Binary resolution: `PROSODEUS_CODEX_BIN` override, else `codex` on PATH.
 * TODO(bundling): package a codex binary under resources/ via extraResources
 * like `claude-bin` (see apps/desktop/package.json) once we ship it.
 */

export function codexModelId(modelSpec: string): string {
  // "codex-gpt-5.5" / "codex/gpt-5.5" -> "gpt-5.5"; bare "codex" -> default.
  return codexRawModelId(modelSpec);
}

export interface CodexExecOutput {
  text: string;
  error?: string;
}

export interface CodexModelOptions {
  reasoningEffort?: string;
}

/**
 * Parse `codex exec --json` JSONL output (verified against codex-cli 0.142.5).
 * Accumulates `item.completed`/`agent_message` text; surfaces top-level
 * `turn.failed`/`error` events. Error *items* (item.completed with an error
 * item type) are benign and ignored.
 */
export function parseCodexExecOutput(lines: string[]): CodexExecOutput {
  let text = "";
  let error: string | undefined;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;

    let event: any;
    try {
      event = JSON.parse(trimmed);
    } catch {
      continue;
    }

    if (event.type === "item.completed" && event.item?.type === "agent_message") {
      text += event.item.text ?? "";
    } else if (event.type === "turn.failed") {
      error = event.error?.message ?? "Codex turn failed";
    } else if (event.type === "error") {
      error = event.message ?? "Codex error";
    }
  }

  return error ? { text, error } : { text };
}

export function createCodexModel(modelSpec: string, options?: CodexModelOptions): any {
  // Return type is any to satisfy the exact v3 LanguageModelV3 shape required by AI SDK 5.
  // Only doGenerate is implemented; everything else is a stub.
  const model = codexModelId(modelSpec);
  const reasoningEffort = options?.reasoningEffort;

  return {
    specificationVersion: "v3",
    provider: "codex",
    modelId: reasoningEffort ? `${modelSpec}@${reasoningEffort}` : modelSpec,
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

      // Codex exec has no separate system-prompt channel — concatenate.
      // Codex's own base instructions form the stable prefix, so OpenAI
      // implicit prompt caching still applies.
      const fullPrompt = system ? `${system}\n\n${userText}` : userText;

      const bin = process.env.PROSODEUS_CODEX_BIN ?? "codex";
      const args = [
        "exec",
        "--json",
        "--ephemeral",
        "--skip-git-repo-check",
        "--ignore-user-config",
        "-s",
        "read-only",
        "--color",
        "never",
        ...(reasoningEffort
          ? ["-c", `model_reasoning_effort=${JSON.stringify(reasoningEffort)}`]
          : []),
        "-m",
        model,
        "-", // read prompt from stdin — avoids ARG_MAX limits on large documents
      ];

      // Classification of a large document is slower than Claude's 30 s budget;
      // Codex also pays ~15k tokens of fixed base instructions per call.
      const TIMEOUT_MS = 120_000;

      const stdout = await new Promise<string>((resolve, reject) => {
        const child = spawn(bin, args, { stdio: ["pipe", "pipe", "pipe"] });
        let out = "";
        let errOut = "";
        let settled = false;

        const timeout = setTimeout(() => {
          if (settled) return;
          settled = true;
          child.kill();
          reject(new Error(`Codex CLI timed out after ${TIMEOUT_MS / 1000}s`));
        }, TIMEOUT_MS);

        child.stdout.on("data", (chunk) => {
          out += chunk;
        });
        child.stderr.on("data", (chunk) => {
          errOut += chunk;
        });

        child.on("error", (err: NodeJS.ErrnoException) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          reject(
            err.code === "ENOENT"
              ? new Error("Codex CLI not found — install codex or set PROSODEUS_CODEX_BIN")
              : err,
          );
        });

        child.on("close", (code) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          if (code !== 0 && !out.trim()) {
            reject(new Error(`Codex CLI exited with code ${code}: ${errOut.slice(0, 500)}`));
            return;
          }
          resolve(out);
        });

        // The `-` arg makes codex read from stdin; it hangs until stdin closes.
        child.stdin.on("error", () => {
          /* EPIPE if codex exits early */
        });
        child.stdin.write(fullPrompt);
        child.stdin.end();
      });

      const parsed = parseCodexExecOutput(stdout.split("\n"));
      // A transient error event alongside a completed agent message is
      // recoverable — only fail when no text came back at all.
      if (parsed.error && !parsed.text.trim()) {
        throw new Error(`Codex exec failed for model "${model}": ${parsed.error}`);
      }

      return {
        content: [{ type: "text" as const, text: parsed.text }],
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
      throw new Error("Streaming not supported through Codex model adapter");
    },
  };
}

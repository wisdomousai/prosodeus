import { spawn, spawnSync } from "node:child_process";
import { existsSync, watch } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { shell, type WebContents } from "electron";

/**
 * ChatGPT login for the Codex CLI — mirror of claude-auth.ts.
 *
 * The Codex model adapter (`createCodexModel`) shells out to the `codex` CLI,
 * which authenticates via a ChatGPT OAuth login stored at `~/.codex/auth.json`.
 * Unlike Claude, we do not (yet) bundle the binary — it's resolved from PATH,
 * overridable with PROSODEUS_CODEX_BIN.
 *
 * TODO(bundling): package a codex binary under `resources/codex-bin/<platform>-<arch>`
 * via electron-builder extraResources like claude-bin, then mirror
 * `bundledClaudeBinary()` here.
 */

const AUTH_PATH = join(homedir(), ".codex", "auth.json");

export function hasCodexCredentials(): boolean {
  return existsSync(AUTH_PATH);
}

export function codexBinary(): string {
  return process.env.PROSODEUS_CODEX_BIN ?? "codex";
}

export function hasCodexBinary(): boolean {
  const result = spawnSync(codexBinary(), ["--version"], { stdio: "ignore" });
  return !result.error && result.status === 0;
}

export function hasCodexHost(): boolean {
  return hasCodexCredentials() && hasCodexBinary();
}

export interface CodexLoginEvents {
  /** Called with each line of CLI output — UI can scan for the OAuth URL. */
  onOutput: (line: string) => void;
  /** Called once the auth file appears on disk. */
  onSuccess: () => void;
  /** Called if the CLI exits non-zero before auth is written, or is missing. */
  onError: (err: Error) => void;
}

/** Spawn `codex login` (browser OAuth to ChatGPT). Returns a function to cancel. */
export function startCodexLogin(events: CodexLoginEvents): () => void {
  const child = spawn(codexBinary(), ["login"], { stdio: ["ignore", "pipe", "pipe"] });
  let resolved = false;

  child.on("error", (err: NodeJS.ErrnoException) => {
    if (resolved) return;
    resolved = true;
    events.onError(
      err.code === "ENOENT"
        ? new Error("Codex CLI not found — install codex or set PROSODEUS_CODEX_BIN")
        : err,
    );
  });

  const handleLine = (chunk: Buffer) => {
    for (const line of chunk.toString("utf-8").split("\n")) {
      if (line.trim()) events.onOutput(line);
      // The CLI prints an OAuth URL (and usually self-opens the browser);
      // opening it ourselves is a harmless belt-and-suspenders.
      const urlMatch = line.match(/https?:\/\/\S+/);
      if (urlMatch && /login|auth\.openai\.com|chatgpt\.com/i.test(line)) {
        void shell.openExternal(urlMatch[0]);
      }
    }
  };

  child.stdout.on("data", handleLine);
  child.stderr.on("data", handleLine);

  // Watch ~/.codex for auth.json; the dir may not exist before first login,
  // in which case the on-exit check below is the fallback.
  const codexDir = join(homedir(), ".codex");
  let watcher: ReturnType<typeof watch> | null = null;
  try {
    if (existsSync(codexDir)) {
      watcher = watch(codexDir, () => {
        if (!resolved && hasCodexCredentials()) {
          resolved = true;
          watcher?.close();
          events.onSuccess();
        }
      });
    }
  } catch {
    // FS watch unavailable on this platform — fall back to checking on exit.
  }

  child.on("exit", (code) => {
    watcher?.close();
    if (resolved) return;
    resolved = true;
    if (hasCodexCredentials()) {
      events.onSuccess();
    } else {
      events.onError(new Error(`Codex login exited with code ${code} before auth was written`));
    }
  });

  return () => {
    watcher?.close();
    if (!child.killed) child.kill();
  };
}

/** Convenience wrapper: stream login progress to a renderer's WebContents. */
export function codexLoginViaRenderer(webContents: WebContents): Promise<void> {
  return new Promise((resolve, reject) => {
    startCodexLogin({
      onOutput: (line) => webContents.send("codex:login:output", line),
      onSuccess: () => {
        webContents.send("codex:login:done");
        resolve();
      },
      onError: (err) => {
        webContents.send("codex:login:error", err.message);
        reject(err);
      },
    });
  });
}

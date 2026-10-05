import { spawn } from "node:child_process";
import { existsSync, watch } from "node:fs";
import { arch, homedir, platform } from "node:os";
import { join } from "node:path";
import { app, shell, type WebContents } from "electron";

/**
 * First-launch onboarding for Claude Pro credentials.
 *
 * The Claude Agent SDK relies on credentials managed by the Claude Code CLI.
 * We bundle that CLI per-platform under `resources/claude-bin/` so the user
 * doesn't need to install Claude Code separately. On first launch we:
 *
 *   1. Check for existing credentials at `~/.claude/credentials.json` (or
 *      `~/.claude/.credentials.json` on some installs).
 *   2. If missing, spawn the bundled binary's `login` subcommand.
 *   3. Stream stdout to the renderer so the UI can show the OAuth URL/code
 *      and open the system browser.
 *   4. Resolve when the credentials file appears.
 */

const CREDENTIAL_PATHS = [
  join(homedir(), ".claude", "credentials.json"),
  join(homedir(), ".claude", ".credentials.json"),
];

export function hasClaudeCredentials(): boolean {
  return CREDENTIAL_PATHS.some((p) => existsSync(p));
}

/** Resolve the bundled Claude binary path for the current platform. */
function bundledClaudeBinary(): string {
  // In production the binary lives next to the packaged app via electron-builder
  // `extraResources`. In dev it can be overridden with PROSODEUS_CLAUDE_BIN.
  const override = process.env.PROSODEUS_CLAUDE_BIN;
  if (override) return override;

  const exeName = platform() === "win32" ? "claude.exe" : "claude";
  const platformDir = `${platform()}-${arch()}`;
  if (app.isPackaged) {
    return join(process.resourcesPath, "claude-bin", platformDir, exeName);
  }
  return join(app.getAppPath(), "resources", "claude-bin", platformDir, exeName);
}

export interface ClaudeLoginEvents {
  /** Called with each line of binary output — UI can scan for the OAuth URL/code. */
  onOutput: (line: string) => void;
  /** Called once the credentials file appears on disk. */
  onSuccess: () => void;
  /** Called if the binary exits non-zero before credentials are written. */
  onError: (err: Error) => void;
}

/** Spawn the bundled Claude binary's `login` flow. Returns a function to cancel. */
export function startClaudeLogin(events: ClaudeLoginEvents): () => void {
  const bin = bundledClaudeBinary();
  if (!existsSync(bin)) {
    events.onError(
      new Error(
        `Bundled Claude binary not found at ${bin}. Install Claude Code, run \`claude login\`, or set PROSODEUS_CLAUDE_BIN.`,
      ),
    );
    return () => {};
  }

  const child = spawn(bin, ["login"], { stdio: ["ignore", "pipe", "pipe"] });
  let resolved = false;

  const handleLine = (chunk: Buffer) => {
    for (const line of chunk.toString("utf-8").split("\n")) {
      if (line.trim()) events.onOutput(line);
      // The binary prints an OAuth URL — open it in the system browser.
      const urlMatch = line.match(/https?:\/\/\S+/);
      if (urlMatch && line.toLowerCase().includes("login")) {
        void shell.openExternal(urlMatch[0]);
      }
    }
  };

  child.stdout.on("data", handleLine);
  child.stderr.on("data", handleLine);

  // Watch the credentials directory; resolve when one of the expected files appears.
  const claudeDir = join(homedir(), ".claude");
  let watcher: ReturnType<typeof watch> | null = null;
  try {
    if (existsSync(claudeDir)) {
      watcher = watch(claudeDir, () => {
        if (!resolved && hasClaudeCredentials()) {
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
    if (hasClaudeCredentials()) {
      events.onSuccess();
    } else {
      events.onError(
        new Error(`Claude login exited with code ${code} before credentials were written`),
      );
    }
  });

  return () => {
    watcher?.close();
    if (!child.killed) child.kill();
  };
}

/** Convenience wrapper: stream login progress to a renderer's WebContents. */
export function loginViaRenderer(webContents: WebContents): Promise<void> {
  return new Promise((resolve, reject) => {
    startClaudeLogin({
      onOutput: (line) => webContents.send("claude:login:output", line),
      onSuccess: () => {
        webContents.send("claude:login:done");
        resolve();
      },
      onError: (err) => {
        webContents.send("claude:login:error", err.message);
        reject(err);
      },
    });
  });
}

import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CLI = join(import.meta.dir, "..", "src", "cli.ts");

// Strip provider keys so tests never hit a network or depend on the developer's shell.
function cleanEnv(extra: Record<string, string> = {}): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined) continue;
    if (/(_API_KEY|_PROVIDER_KEY)$/.test(k)) continue;
    env[k] = v;
  }
  return { ...env, ...extra };
}

async function run(args: string[], extraEnv: Record<string, string> = {}) {
  const proc = Bun.spawn(["bun", CLI, ...args], {
    env: cleanEnv(extraEnv),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, code };
}

describe("prosodeus cli", () => {
  test("--help lists the core commands", async () => {
    const { stdout, code } = await run(["--help"]);
    expect(code).toBe(0);
    for (const cmd of ["analyze", "report", "constrain", "rewrite", "opposition", "compare"]) {
      expect(stdout).toContain(cmd);
    }
  });

  test("styles lists built-in style guides without any API key", async () => {
    const { stdout, code } = await run(["styles"]);
    expect(code).toBe(0);
    expect(stdout).toContain("general");
  });

  test("analyze fails clearly when no provider key is configured", async () => {
    const dir = mkdtempSync(join(tmpdir(), "prosodeus-cli-"));
    const file = join(dir, "sample.txt");
    writeFileSync(file, "It is important to note that this is a test.");
    const { stderr, code } = await run(["analyze", file, "--no-cache"]);
    expect(code).not.toBe(0);
    expect(stderr).toContain("GROQ_API_KEY");
    expect(stderr).toContain("PROSODEUS_PROVIDER_KEY");
  });

  test("an unknown provider is rejected", async () => {
    const dir = mkdtempSync(join(tmpdir(), "prosodeus-cli-"));
    const file = join(dir, "sample.txt");
    writeFileSync(file, "Some text.");
    const { stderr, code } = await run(["analyze", file, "--provider", "nope", "--no-cache"]);
    expect(code).not.toBe(0);
    expect(stderr).toContain('unknown provider "nope"');
  });
});

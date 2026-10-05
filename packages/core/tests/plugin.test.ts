import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..", "..");
const PLUGIN = join(ROOT, "plugins", "prosodeus");
const readJson = (p: string) => JSON.parse(readFileSync(p, "utf8"));

describe("plugin", () => {
  test("claude and codex manifests agree on name and version", () => {
    const claude = readJson(join(PLUGIN, ".claude-plugin", "plugin.json"));
    const codex = readJson(join(PLUGIN, ".codex-plugin", "plugin.json"));
    expect(claude.name).toBe(codex.name);
    expect(claude.version).toBe(codex.version);
  });

  test("both marketplaces point at the plugin directory", () => {
    const claude = readJson(join(ROOT, ".claude-plugin", "marketplace.json"));
    const codex = readJson(join(ROOT, ".agents", "plugins", "marketplace.json"));
    expect(claude.plugins[0].source).toBe("./plugins/prosodeus");
    expect(codex.plugins[0].source.path).toBe("./plugins/prosodeus");
    expect(existsSync(join(ROOT, "plugins", "prosodeus"))).toBe(true);
  });

  test("the codex manifest paths resolve", () => {
    const codex = readJson(join(PLUGIN, ".codex-plugin", "plugin.json"));
    expect(existsSync(join(PLUGIN, codex.skills))).toBe(true);
    expect(existsSync(join(PLUGIN, codex.mcpServers))).toBe(true);
  });

  test("every skill has frontmatter that names its directory", () => {
    for (const dir of readdirSync(join(PLUGIN, "skills"))) {
      const text = readFileSync(join(PLUGIN, "skills", dir, "SKILL.md"), "utf8");
      expect(text).toMatch(new RegExp(`^---\\nname: ${dir}\\ndescription: .+\\n---`));
    }
  });

  test("skills only call MCP tools the server exposes", () => {
    const tools = new Set([
      "screen_text",
      "generate_constraints",
      "rewrite_passage",
      "verify_rewrite",
      "list_style_guides",
      "get_style_guide",
    ]);
    const server = readFileSync(join(ROOT, "packages", "mcp", "src", "mcp.ts"), "utf8");
    for (const t of tools) expect(server).toContain(`"${t}"`);
    for (const dir of readdirSync(join(PLUGIN, "skills"))) {
      const text = readFileSync(join(PLUGIN, "skills", dir, "SKILL.md"), "utf8");
      for (const used of text.matchAll(/`([a-z]+_[a-z_]+)`/g)) {
        const name = used[1] as string;
        if (/^(passage_|use_|original_|rewritten_)/.test(name)) continue;
        expect(tools.has(name)).toBe(true);
      }
    }
  });

  test("the bundled references match instructions/", () => {
    const src = join(ROOT, "instructions");
    const copy = join(PLUGIN, "skills", "slop-fix", "references");
    expect(readdirSync(copy).sort()).toEqual(readdirSync(src).sort());
    for (const f of readdirSync(src)) {
      expect(readFileSync(join(copy, f), "utf8")).toBe(readFileSync(join(src, f), "utf8"));
    }
  });
});

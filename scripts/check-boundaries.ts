import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const failures: string[] = [];

function walk(dir: string, out: string[] = []): string[] {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if ([".git", "node_modules", "dist", ".dev-data"].includes(ent.name)) continue;
    const path = join(dir, ent.name);
    if (ent.isDirectory()) walk(path, out);
    else if (/\.(ts|tsx|mts|cts)$/.test(ent.name)) out.push(path);
  }
  return out;
}

function importSpecifiers(source: string): string[] {
  const specs: string[] = [];
  for (const match of source.matchAll(/(?:from\s+|import\(\s*)["']([^"']+)["']/g)) {
    specs.push(match[1]!);
  }
  return specs;
}

function display(path: string): string {
  return relative(root, path);
}

for (const file of walk(join(root, "packages/core/src"))) {
  const source = readFileSync(file, "utf8");
  for (const spec of importSpecifiers(source)) {
    if (spec === "@prosodeus/shared" || spec.startsWith("@prosodeus/shared/")) {
      failures.push(`${display(file)} imports ${spec}; core must not depend on shared`);
    }
  }
}

const allowedAppPackageSubpaths = new Set([
  "@prosodeus/core/browser",
  "@prosodeus/core/node",
  "@prosodeus/shared/browser",
]);

for (const file of walk(join(root, "apps"))) {
  const source = readFileSync(file, "utf8");
  for (const spec of importSpecifiers(source)) {
    if (/packages\/[^/]+\/src/.test(spec)) {
      failures.push(`${display(file)} deep-imports package source via ${spec}`);
    }
    if (spec.startsWith("@prosodeus/")) {
      const parts = spec.split("/");
      const packageRoot = parts.slice(0, 2).join("/");
      const hasSubpath = parts.length > 2;
      if (hasSubpath && !allowedAppPackageSubpaths.has(spec)) {
        failures.push(`${display(file)} imports ${spec}; apps should use package entrypoints`);
      }
      if (!packageRoot) {
        failures.push(`${display(file)} has malformed Prosodeus import ${spec}`);
      }
    }
  }
}

const browserEntry = readFileSync(join(root, "packages/core/src/browser.ts"), "utf8");
const forbiddenBrowserFragments = [
  "storage/",
  "storage\\",
  "document-store",
  "sync.ts",
  "db/",
  "db\\",
  "codex-model",
  "agent-sdk-model",
];
for (const fragment of forbiddenBrowserFragments) {
  if (browserEntry.includes(fragment)) {
    failures.push(`packages/core/src/browser.ts references node-only fragment ${fragment}`);
  }
}

if (failures.length > 0) {
  console.error("Boundary check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Boundary check passed");

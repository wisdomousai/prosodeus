import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { LLM_MARKER_MATCHERS } from "../src/taxonomy/llm-marker-matchers.ts";

const ROOT = join(import.meta.dir, "..", "..", "..");
const HITLISTS = join(ROOT, "hitlists");

interface Entry {
  id: string;
  phrase: string;
  alternatives: string[];
  subcategory: string;
  tier: "strong" | "moderate" | "watch";
  signal: string;
  fp_risk: string;
  replacement: string;
  template?: boolean;
  truncated?: boolean;
}
interface Hitlist {
  category: string;
  slug: string;
  instructions: string;
  tiers: { strong: number; moderate: number; watch: number };
  entries: Entry[];
}

const files = readdirSync(HITLISTS).filter((f) => f.endsWith(".json") && f !== "index.json");
const lists: Hitlist[] = files.map((f) => JSON.parse(readFileSync(join(HITLISTS, f), "utf8")));
const index: Array<{ slug: string; entries: number }> = JSON.parse(
  readFileSync(join(HITLISTS, "index.json"), "utf8"),
);

describe("hitlists", () => {
  test("index.json lists every hit list with its entry count", () => {
    expect(index.map((i) => i.slug).sort()).toEqual(lists.map((l) => l.slug).sort());
    for (const list of lists) {
      expect(index.find((i) => i.slug === list.slug)?.entries).toBe(list.entries.length);
    }
  });

  test("every hit list points at an existing instructions file", () => {
    for (const list of lists) {
      expect(existsSync(join(ROOT, list.instructions))).toBe(true);
      expect(list.instructions).toBe(`instructions/${list.slug}.md`);
    }
  });

  test("tier counts add up and tiers follow signal and false-positive risk", () => {
    for (const list of lists) {
      const counted = { strong: 0, moderate: 0, watch: 0 };
      for (const e of list.entries) {
        counted[e.tier]++;
        if (e.tier === "strong") {
          expect(e.signal.toLowerCase()).toContain("strong");
          expect(["low", "medium"]).toContain(e.fp_risk.toLowerCase());
        }
        if (e.signal.toLowerCase().includes("weak") || e.fp_risk.toLowerCase() === "high") {
          expect(e.tier).toBe("watch");
        }
      }
      expect(counted).toEqual(list.tiers);
    }
  });

  test("no entry carries export damage in its phrase alternatives", () => {
    for (const list of lists) {
      for (const e of list.entries) {
        for (const alt of e.alternatives) {
          expect(alt).not.toMatch(/["“”]/);
          expect(alt.split("[").length).toBe(alt.split("]").length);
        }
      }
    }
  });

  test("every usable phrase is matched by its own subcategory's matchers", () => {
    const misses: string[] = [];
    for (const list of lists) {
      for (const e of list.entries) {
        if (e.truncated || e.template) continue;
        const matchers = LLM_MARKER_MATCHERS[e.subcategory] ?? [];
        for (const alt of e.alternatives) {
          if (/\b[XYZ]\b/.test(alt) || alt.includes("[")) continue;
          if (!matchers.some((rx) => ((rx.lastIndex = 0), rx.test(alt)))) {
            misses.push(`${e.id} ${e.subcategory}: ${alt}`);
          }
        }
      }
    }
    expect(misses).toEqual([]);
  });
});

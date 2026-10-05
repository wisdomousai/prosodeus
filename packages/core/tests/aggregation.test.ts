import { describe, expect, test } from "bun:test";
import { computeConvergence, computeWindows } from "../src/analysis/aggregation.ts";
import { assembleProfile, detectHotRegions } from "../src/analysis/profile.ts";
import { computeDelta, listStyleGuides, loadStyleGuide } from "../src/analysis/style-guide.ts";
import type { ClassifiedSentence } from "../src/types.ts";

// Load fixture data
const fixtures: ClassifiedSentence[] = await Bun.file(
  new URL("./classifications.json", import.meta.url),
).json();

describe("computeWindows", () => {
  test("produces windows at multiple sizes", () => {
    const windows = computeWindows(fixtures);
    const sizes = new Set(windows.map((w) => w.size));
    // With only 8 sentences (~92 words), we should get at least narrow windows
    expect(sizes.has("narrow")).toBe(true);
  });

  test("window metrics have valid ranges", () => {
    const windows = computeWindows(fixtures);
    for (const w of windows) {
      expect(w.word_count).toBeGreaterThan(0);
      expect(w.biber_entropy).toBeGreaterThanOrEqual(0);
      expect(w.length_entropy).toBeGreaterThanOrEqual(0);
      expect(w.device_entropy).toBeGreaterThanOrEqual(0);
      expect(w.sentence_length_autocorrelation).toBeGreaterThanOrEqual(-1);
      expect(w.sentence_length_autocorrelation).toBeLessThanOrEqual(1);
    }
  });

  test("pattern density is computed per 100 words", () => {
    const windows = computeWindows(fixtures);
    const narrowWindow = windows.find((w) => w.size === "narrow");
    expect(narrowWindow).toBeDefined();
    // The fixture has patterns, so some density should be > 0
    const hasNonZeroDensity = Object.values(narrowWindow!.pattern_density).some((d) => d > 0);
    expect(hasNonZeroDensity).toBe(true);
  });
});

describe("computeConvergence", () => {
  test("returns 0 for insufficient data", () => {
    expect(computeConvergence([])).toBe(0);
  });

  test("returns a numeric slope", () => {
    const windows = computeWindows(fixtures);
    const slope = computeConvergence(windows);
    expect(typeof slope).toBe("number");
    expect(isNaN(slope)).toBe(false);
  });
});

describe("detectHotRegions", () => {
  test("detects regions with high heat", () => {
    const regions = detectHotRegions(fixtures);
    // Sentences 1-5 have heat >= 3, should form a hot region
    expect(regions.length).toBeGreaterThan(0);
  });

  test("hot regions have valid structure", () => {
    const regions = detectHotRegions(fixtures);
    for (const r of regions) {
      expect(r.start_sentence).toBeLessThanOrEqual(r.end_sentence);
      expect(r.heat).toBeGreaterThanOrEqual(0);
      expect(r.heat).toBeLessThanOrEqual(10);
      expect(r.primary_patterns.length).toBeGreaterThan(0);
      expect(r.description.length).toBeGreaterThan(0);
    }
  });

  test("cold sentences are not in hot regions", () => {
    const regions = detectHotRegions(fixtures);
    // Sentences 6 and 7 have heat 0, should not be in any hot region
    for (const r of regions) {
      expect(r.end_sentence).toBeLessThan(6);
    }
  });
});

describe("assembleProfile", () => {
  test("produces a complete profile", () => {
    const profile = assembleProfile(fixtures);
    expect(profile.sentence_count).toBe(fixtures.length);
    expect(profile.paragraph_count).toBe(3); // paragraphs 0, 1, 2
    expect(profile.word_count).toBeGreaterThan(0);
    expect(profile.sentences).toHaveLength(fixtures.length);
    expect(profile.windows.length).toBeGreaterThan(0);
    expect(typeof profile.convergence_slope).toBe("number");
    expect(typeof profile.global_biber_entropy).toBe("number");
    expect(typeof profile.global_device_entropy).toBe("number");
    expect(typeof profile.mean_heat).toBe("number");
  });

  test("mean_heat is average of sentence heats", () => {
    const profile = assembleProfile(fixtures);
    const expected = fixtures.reduce((sum, s) => sum + s.heat, 0) / fixtures.length;
    expect(profile.mean_heat).toBeCloseTo(expected, 1);
  });
});

describe("style guides", () => {
  test("lists all built-in guides", () => {
    const guides = listStyleGuides();
    expect(guides.length).toBe(5);
    const names = guides.map((g) => g.name);
    expect(names).toContain("general");
    expect(names).toContain("literary-essay");
    expect(names).toContain("technical");
    expect(names).toContain("journalism");
    expect(names).toContain("fiction");
  });

  test("loads a specific guide", () => {
    const guide = loadStyleGuide("literary-essay");
    expect(guide).toBeDefined();
    expect(guide!.name).toBe("literary-essay");
    expect(guide!.targets.device_entropy.min).toBe(2.8);
  });

  test("returns undefined for unknown guide", () => {
    expect(loadStyleGuide("nonexistent")).toBeUndefined();
  });

  test("computeDelta produces violations", () => {
    const guide = loadStyleGuide("fiction")!;
    const delta = computeDelta(fixtures, guide);
    expect(delta.guide).toBe("fiction");
    expect(delta.overall_distance).toBeGreaterThanOrEqual(0);
    expect(delta.overall_distance).toBeLessThanOrEqual(1);
    // The LLM-like fixture text should violate fiction guide targets
    expect(Array.isArray(delta.violations)).toBe(true);
  });
});

import { describe, expect, test } from "bun:test";
import {
  STANDARD_SUGGEST_OUTPUT,
  suggestOutputForSpec,
  THINKING_SUGGEST_OUTPUT,
} from "../src/models/model-capabilities.ts";
import { suggestMaxOutputTokens } from "../src/rewrite/suggest.ts";

describe("suggestMaxOutputTokens", () => {
  test("standard profile stays under 8k for single sentence", () => {
    expect(
      suggestMaxOutputTokens("sentence", STANDARD_SUGGEST_OUTPUT, { patternCount: 2 }),
    ).toBeLessThanOrEqual(8192);
  });

  test("thinking profile uses config cap", () => {
    expect(suggestMaxOutputTokens("sentence", THINKING_SUGGEST_OUTPUT)).toBe(65536);
    expect(suggestMaxOutputTokens("paragraph", THINKING_SUGGEST_OUTPUT)).toBe(65536);
  });
});

describe("suggestOutputForSpec", () => {
  test("kimi-for-coding uses thinking profile", () => {
    expect(suggestOutputForSpec("moonshot/kimi-for-coding")).toBe(THINKING_SUGGEST_OUTPUT);
  });

  test("coding key upgrades any moonshot spec", () => {
    expect(suggestOutputForSpec("moonshot/kimi-k2.6", "coding")).toBe(THINKING_SUGGEST_OUTPUT);
  });

  test("unknown spec falls back to standard", () => {
    expect(suggestOutputForSpec("some/new-model")).toBe(STANDARD_SUGGEST_OUTPUT);
  });
});

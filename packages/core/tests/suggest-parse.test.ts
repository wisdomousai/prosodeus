import { describe, expect, test } from "bun:test";
import { parseSuggestionsJson } from "../src/rewrite/suggest.ts";

describe("parseSuggestionsJson", () => {
  test("parses fenced JSON", () => {
    const raw = '```json\n{"suggestions":[{"text":"Hello there world","rationale":"ok"}]}\n```';
    expect(parseSuggestionsJson(raw)).toHaveLength(1);
  });

  test("accepts rewrite key and missing rationale", () => {
    const raw = '{"alternatives":[{"rewrite":"A longer rewrite sentence here","reason":"x"}]}';
    const out = parseSuggestionsJson(raw);
    expect(out).toHaveLength(1);
    expect(out[0]!.text).toContain("rewrite");
    expect(out[0]!.rationale).toBe("x");
  });

  test("salvages truncated JSON with complete text fields", () => {
    const raw = `\`\`\`json
{
  "suggestions": [
    {"text": "This marks a vital stage for comprehending abstract nouns in LLM prose.", "rationale": "Replaces crucial with vital and"},
    {"text": "Understanding how abstract nouns pile up in LLM writing starts here.", "rationale": "Restructures"
`;
    const out = parseSuggestionsJson(raw);
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out[0]!.text).toContain("vital stage");
  });
});

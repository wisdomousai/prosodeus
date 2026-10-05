import { describe, expect, test } from "bun:test";
import { formatLexiconSwaps, lexiconHits } from "../src/playbooks/copy-lexicon.ts";

describe("copy lexicon", () => {
  test("lexiconHits finds banned words with word boundaries", () => {
    const hits = lexiconHits("We will delve into the landscape.");
    const from = hits.map((h) => h.from);
    expect(from).toContain("delve");
    expect(from).toContain("landscape");
  });

  test("formatLexiconSwaps dedupes and formats swap lines", () => {
    const hits = lexiconHits("delve and delve again");
    const lines = formatLexiconSwaps(hits);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("→");
  });
});

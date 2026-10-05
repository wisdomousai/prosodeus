import { describe, expect, test } from "bun:test";
import { heuristicScreen } from "../src/classification/heuristic-screen.ts";
import type { HashedSentence } from "../src/types.ts";

function sentence(text: string): HashedSentence {
  return { id: 1, text, hash: "h1", paragraph_id: 1 };
}

describe("heuristicScreen", () => {
  test("returns certain_negative for plain prose", () => {
    const result = heuristicScreen(sentence("The cat sat on the mat."));
    expect(result.kind).toBe("certain_negative");
  });

  test("flags a strong LLM-marker phrase", () => {
    const result = heuristicScreen(
      sentence("In today's rapidly evolving business landscape, companies must adapt."),
    );
    expect(result.kind).toBe("certain_positive");
    if (result.kind === "certain_positive") {
      expect(result.classification.patterns.length).toBeGreaterThan(0);
      expect(result.classification.patterns[0]?.evidence.toLowerCase()).toContain("landscape");
    }
  });

  test("flags LLM fingerprint words", () => {
    const result = heuristicScreen(sentence("We will delve into the nuances of the problem."));
    expect(result.kind).toBe("certain_positive");
  });

  test("does not treat weaker broad static matches as heuristic positives", () => {
    const result = heuristicScreen(sentence("This is an important point."));
    expect(result.kind).toBe("certain_negative");
  });

  test("returns no match for empty input", () => {
    const result = heuristicScreen(sentence(""));
    expect(result.kind).toBe("certain_negative");
  });
});

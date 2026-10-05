import { describe, expect, test } from "bun:test";
import { styleDisplayName } from "./style-labels.ts";

describe("styleDisplayName", () => {
  test("maps known built-in style IDs", () => {
    expect(styleDisplayName("literary-essay")).toBe("Essay");
    expect(styleDisplayName("journalism")).toBe("Newsletter");
  });

  test("title-cases unknown IDs", () => {
    expect(styleDisplayName("custom-style")).toBe("Custom Style");
  });
});

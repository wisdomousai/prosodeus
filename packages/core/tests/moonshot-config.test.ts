import { describe, expect, test } from "bun:test";
import {
  KIMI_CODING_BASE,
  listMoonshotModelOptions,
  MOONSHOT_DEVELOPER_BASE,
  moonshotKeyKind,
  resolveMoonshotClient,
} from "../src/models/moonshot-config.ts";

describe("moonshotKeyKind", () => {
  test("sk-kimi prefix is coding", () => {
    expect(moonshotKeyKind("sk-kimi-abc")).toBe("coding");
  });

  test("other prefixes are developer", () => {
    expect(moonshotKeyKind("sk-abc")).toBe("developer");
  });
});

describe("resolveMoonshotClient", () => {
  test("coding key uses coding API and maps kimi-k2.6", () => {
    const cfg = resolveMoonshotClient("sk-kimi-test", { modelId: "kimi-k2.6" });
    expect(cfg.baseURL).toBe(KIMI_CODING_BASE);
    expect(cfg.modelId).toBe("kimi-for-coding");
    expect(cfg.kind).toBe("coding");
  });

  test("developer key uses moonshot.ai", () => {
    const cfg = resolveMoonshotClient("sk-dev-key", { modelId: "kimi-k2.6" });
    expect(cfg.baseURL).toBe(MOONSHOT_DEVELOPER_BASE);
    expect(cfg.modelId).toBe("kimi-k2.6");
    expect(cfg.kind).toBe("developer");
  });

  test("baseUrlOverride wins for developer keys", () => {
    const cfg = resolveMoonshotClient("sk-dev-key", {
      modelId: "kimi-k2.6",
      baseUrlOverride: "https://api.moonshot.cn/v1",
    });
    expect(cfg.baseURL).toBe("https://api.moonshot.cn/v1");
  });
});

describe("listMoonshotModelOptions", () => {
  test("coding lists kimi-for-coding", () => {
    expect(listMoonshotModelOptions("coding")[0]?.id).toBe("kimi-for-coding");
  });

  test("developer lists k2.6", () => {
    expect(listMoonshotModelOptions("developer").some((m) => m.id === "kimi-k2.6")).toBe(true);
  });
});

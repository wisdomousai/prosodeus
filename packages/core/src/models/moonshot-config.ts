/** Kimi developer API (platform.moonshot.ai / platform.moonshot.cn). */
export const MOONSHOT_DEVELOPER_BASE = "https://api.moonshot.ai/v1";
export const MOONSHOT_CN_BASE = "https://api.moonshot.cn/v1";

/** Kimi Code subscription keys (sk-kimi-*) — platform.kimi.com coding plan. */
export const KIMI_CODING_BASE = "https://api.kimi.com/coding/v1";

export type MoonshotKeyKind = "developer" | "coding";

/** Kimi Code keys use the `sk-kimi-` prefix and only auth against the coding API. */
export function moonshotKeyKind(apiKey: string): MoonshotKeyKind {
  return apiKey.trim().startsWith("sk-kimi-") ? "coding" : "developer";
}

const CODING_MODEL_ALIASES: Record<string, string> = {
  "kimi-k2.6": "kimi-for-coding",
  "kimi-k2.7-code": "kimi-for-coding",
  "kimi-k2-turbo-preview": "kimi-for-coding",
};

export interface MoonshotClientConfig {
  baseURL: string;
  modelId: string;
  kind: MoonshotKeyKind;
}

/**
 * Resolve base URL + API model id for a Moonshot/Kimi key.
 * Developer keys → api.moonshot.ai (or MOONSHOT_BASE_URL / .cn override).
 * Kimi Code keys (sk-kimi-*) → api.kimi.com/coding/v1 with kimi-for-coding.
 */
export function resolveMoonshotClient(
  apiKey: string,
  options?: { modelId?: string; baseUrlOverride?: string },
): MoonshotClientConfig {
  const requested = options?.modelId?.trim();

  if (options?.baseUrlOverride) {
    return {
      baseURL: options.baseUrlOverride,
      modelId: requested || "kimi-k2.6",
      kind: "developer",
    };
  }

  if (moonshotKeyKind(apiKey) === "coding") {
    const modelId =
      requested && requested in CODING_MODEL_ALIASES
        ? CODING_MODEL_ALIASES[requested]!
        : requested === "kimi-for-coding" || !requested
          ? "kimi-for-coding"
          : requested;
    return { baseURL: KIMI_CODING_BASE, modelId, kind: "coding" };
  }

  return {
    baseURL: MOONSHOT_DEVELOPER_BASE,
    modelId: requested || "kimi-k2.6",
    kind: "developer",
  };
}

export function listMoonshotModelOptions(
  kind: MoonshotKeyKind,
): Array<{ id: string; name: string }> {
  if (kind === "coding") {
    return [{ id: "kimi-for-coding", name: "Kimi K2.7 Code" }];
  }
  return [
    { id: "kimi-k2.6", name: "Kimi K2.6" },
    { id: "kimi-k2-turbo-preview", name: "Kimi K2 Turbo (legacy)" },
  ];
}

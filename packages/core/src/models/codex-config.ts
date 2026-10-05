export const CODEX_LOCAL_HOST_MODE = "local-codex-host" as const;

export type CodexModelMode = typeof CODEX_LOCAL_HOST_MODE;
export type CodexTaskDepth = "classifier" | "suggest" | "rewrite" | "council";

export interface CodexModelConfig {
  id: string;
  model: string;
  name: string;
  provider: "codex";
  mode: CodexModelMode;
  default?: boolean;
  defaultReasoningEffort?: string;
  supportedReasoningEfforts?: string[];
}

export interface CodexCatalogModel {
  slug: string;
  displayName: string;
  description?: string;
  visibility?: string;
  defaultReasoningEffort?: string;
  supportedReasoningEfforts: string[];
  priority?: number;
  additionalSpeedTiers?: string[];
}

export interface CodexTaskModelSelection {
  spec: string;
  model: string;
  name: string;
  reasoningEffort?: string;
}

/** Bare `codex` is legacy only; runtime routing should resolve a catalog slug. */
export const DEFAULT_CODEX_MODEL = "gpt-5.5";
export const CODEX_DEFAULT_MODEL_SPEC = "codex";

export function isCodexModelSpec(modelSpec: string): boolean {
  return modelSpec === "codex" || modelSpec.startsWith("codex-") || modelSpec.startsWith("codex/");
}

export function codexModelSpec(modelSlug: string): string {
  return `codex-${modelSlug}`;
}

export function codexRawModelId(modelSpec: string): string {
  if (!isCodexModelSpec(modelSpec)) return modelSpec;
  const stripped = modelSpec.replace(/^codex[-/]?/, "");
  return stripped || DEFAULT_CODEX_MODEL;
}

export function codexModelConfigFromCatalog(
  model: CodexCatalogModel,
  isDefault = false,
): CodexModelConfig {
  return {
    id: codexModelSpec(model.slug),
    model: model.slug,
    name: `${model.displayName || model.slug} (Codex)`,
    provider: "codex",
    mode: CODEX_LOCAL_HOST_MODE,
    default: isDefault || undefined,
    defaultReasoningEffort: model.defaultReasoningEffort,
    supportedReasoningEfforts: model.supportedReasoningEfforts,
  };
}

export function visibleCodexModels(models: readonly CodexCatalogModel[]): CodexCatalogModel[] {
  return models
    .filter((m) => m.slug && m.visibility !== "hide")
    .sort((a, b) => (a.priority ?? 9999) - (b.priority ?? 9999));
}

function taskReasoningPreference(task: CodexTaskDepth): string[] {
  if (task === "rewrite") return ["high", "medium", "low"];
  return ["low", "medium", "high"];
}

function chooseReasoning(model: CodexCatalogModel, task: CodexTaskDepth): string | undefined {
  const supported = model.supportedReasoningEfforts;
  if (supported.length === 0) return model.defaultReasoningEffort;
  for (const effort of taskReasoningPreference(task)) {
    if (supported.includes(effort)) return effort;
  }
  if (model.defaultReasoningEffort && supported.includes(model.defaultReasoningEffort)) {
    return model.defaultReasoningEffort;
  }
  return supported[0];
}

const LIGHT_MODEL_KEYWORDS = ["instant", "spark", "nano", "mini", "small", "flash"];

function lightModelRank(model: CodexCatalogModel): number {
  const label = `${model.slug} ${model.displayName}`.toLowerCase();
  const keywordRank = LIGHT_MODEL_KEYWORDS.findIndex((keyword) => label.includes(keyword));
  const tierRank = model.additionalSpeedTiers?.includes("fast") ? 1 : 2;
  const semanticRank = keywordRank >= 0 ? keywordRank : 99;
  return semanticRank * 1000 + tierRank * 100 + (model.priority ?? 9999);
}

function strongestModelRank(model: CodexCatalogModel): number {
  return model.priority ?? 9999;
}

function modelBySpec(
  models: readonly CodexCatalogModel[],
  spec?: string,
): CodexCatalogModel | undefined {
  if (!spec || !isCodexModelSpec(spec)) return undefined;
  const slug = codexRawModelId(spec);
  return models.find((m) => m.slug === slug);
}

function toSelection(model: CodexCatalogModel, task: CodexTaskDepth): CodexTaskModelSelection {
  return {
    spec: codexModelSpec(model.slug),
    model: model.slug,
    name: model.displayName || model.slug,
    reasoningEffort: chooseReasoning(model, task),
  };
}

export function selectCodexTaskModel(
  models: readonly CodexCatalogModel[],
  task: CodexTaskDepth,
  preferredSpec?: string,
): CodexTaskModelSelection | null {
  const visible = visibleCodexModels(models);
  if (visible.length === 0) return null;

  if (task === "rewrite" || task === "council") {
    const preferred = modelBySpec(visible, preferredSpec);
    return toSelection(
      preferred ?? visible.sort((a, b) => strongestModelRank(a) - strongestModelRank(b))[0]!,
      task,
    );
  }

  const ranked = [...visible].sort((a, b) => lightModelRank(a) - lightModelRank(b));
  return toSelection(ranked[0]!, task);
}

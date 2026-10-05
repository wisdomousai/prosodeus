/** Opt-in live heatmap refresh while typing (default off to preserve API quotas). */
export const AUTO_ANALYZE_PREF_KEY = "prosodeus_auto_analyze";

/** When auto-analyze is on: `viewport` re-classifies visible sentences only. */
export const AUTO_ANALYZE_SCOPE_PREF_KEY = "prosodeus_auto_analyze_scope";

/** Background rewrite batch after profile (default on; set `"0"` to opt out). */
export const BACKGROUND_SUGGEST_PREF_KEY = "prosodeus_background_suggest";

/** @deprecated Use BACKGROUND_SUGGEST_PREF_KEY */
export const BATCH_SUGGEST_PREF_KEY = "prosodeus_batch_suggest";

/** On-focus suggest when clicking a hot sentence not in batch: auto or manual. */
export const ON_FOCUS_SUGGEST_PREF_KEY = "prosodeus_on_focus_suggest";

export type OnFocusSuggestMode = "auto" | "manual";

export function isAutoAnalyzeEnabled(): boolean {
  try {
    return localStorage.getItem(AUTO_ANALYZE_PREF_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAutoAnalyzeEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(AUTO_ANALYZE_PREF_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function isAutoAnalyzeViewportScope(): boolean {
  try {
    const v = localStorage.getItem(AUTO_ANALYZE_SCOPE_PREF_KEY);
    return v !== "document";
  } catch {
    return true;
  }
}

/** User allows the post-profile background suggest batch (default on). */
export function isBackgroundSuggestEnabled(): boolean {
  try {
    const v = localStorage.getItem(BACKGROUND_SUGGEST_PREF_KEY);
    if (v === "0") return false;
    if (v === "1") return true;
    const legacy = localStorage.getItem(BATCH_SUGGEST_PREF_KEY);
    if (legacy === "0") return false;
    return true;
  } catch {
    return true;
  }
}

/** @deprecated Use isBackgroundSuggestEnabled */
export function isBatchSuggestEnabled(): boolean {
  return isBackgroundSuggestEnabled();
}

export function setBackgroundSuggestEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(BACKGROUND_SUGGEST_PREF_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function getOnFocusSuggestMode(): OnFocusSuggestMode {
  try {
    const v = localStorage.getItem(ON_FOCUS_SUGGEST_PREF_KEY);
    if (v === "auto" || v === "manual") return v;
    return isBackgroundSuggestEnabled() ? "auto" : "manual";
  } catch {
    return "auto";
  }
}

export function setOnFocusSuggestMode(mode: OnFocusSuggestMode): void {
  try {
    localStorage.setItem(ON_FOCUS_SUGGEST_PREF_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function isOnFocusSuggestAuto(): boolean {
  return getOnFocusSuggestMode() === "auto";
}

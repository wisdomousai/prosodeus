import type { WorkspaceSettings } from "@prosodeus/shared";

const PLAYBOOK_PLATFORMS = new Set(["linkedin", "twitter", "newsletter", "ad_copy"]);
const MAX_VOICE_DNA_LENGTH = 4000;
const MAX_STYLE_GUIDE_ID_LENGTH = 128;

export function validateWorkspaceSettings(
  settings: unknown,
): { ok: true; value: WorkspaceSettings } | { ok: false; error: string } {
  if (settings === undefined || settings === null) {
    return { ok: true, value: {} };
  }
  if (typeof settings !== "object" || Array.isArray(settings)) {
    return { ok: false, error: "settings must be an object" };
  }

  const raw = settings as Record<string, unknown>;
  const next: WorkspaceSettings = { ...(raw as WorkspaceSettings) };

  if (raw.voice_dna !== undefined) {
    if (typeof raw.voice_dna !== "string") {
      return { ok: false, error: "voice_dna must be a string" };
    }
    if (raw.voice_dna.length > MAX_VOICE_DNA_LENGTH) {
      return { ok: false, error: `voice_dna must be at most ${MAX_VOICE_DNA_LENGTH} characters` };
    }
    next.voice_dna = raw.voice_dna.trim() || undefined;
  }

  if (raw.default_playbook_platform !== undefined) {
    if (
      typeof raw.default_playbook_platform !== "string" ||
      !PLAYBOOK_PLATFORMS.has(raw.default_playbook_platform)
    ) {
      return { ok: false, error: "invalid default_playbook_platform" };
    }
    next.default_playbook_platform =
      raw.default_playbook_platform as WorkspaceSettings["default_playbook_platform"];
  }

  if (raw.voice_style_guide_id !== undefined) {
    if (typeof raw.voice_style_guide_id !== "string") {
      return { ok: false, error: "voice_style_guide_id must be a string" };
    }
    if (raw.voice_style_guide_id.length > MAX_STYLE_GUIDE_ID_LENGTH) {
      return { ok: false, error: "voice_style_guide_id too long" };
    }
    next.voice_style_guide_id = raw.voice_style_guide_id.trim() || undefined;
  }

  return { ok: true, value: next };
}

import type { PlaybookPlatform, StylometricProfile } from "@prosodeus/core/browser";
import {
  generateConstraints,
  getLexiconSwapLines,
  getPlatformPreset,
} from "@prosodeus/core/browser";
import type { RewriteConstraints } from "@prosodeus/shared/browser";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { InspectorTabId } from "@/components/shell/RightInspector";
import { getUserStyle } from "@/lib/api";

export interface UsePlaybookStateDeps {
  text: string;
  profile: StylometricProfile | null;
  constraints: RewriteConstraints;
  onApplyConstraints: (constraints: RewriteConstraints) => void;
  setActiveTab: (tab: InspectorTabId) => void;
  bumpMobileInspector: () => void;
  voiceDna?: string;
  defaultPlatform?: PlaybookPlatform | null;
  voiceStyleGuideId?: string;
}

export interface UsePlaybookStateReturn {
  platform: PlaybookPlatform | null;
  setPlatform: (platform: PlaybookPlatform | null) => void;
  useVoice: boolean;
  setUseVoice: (v: boolean) => void;
  useStyleGuide: boolean;
  setUseStyleGuide: (v: boolean) => void;
  applyPlatformToRewrite: () => void;
  applyPlaybookToRewrite: () => void;
  copyPlaybookPrompt: () => void;
  copyAuditFailures: (
    failedChecks: Array<{ label: string; detail?: string; hint?: string }>,
  ) => void;
  lexiconSwaps: string[];
}

export function usePlaybookState(deps: UsePlaybookStateDeps): UsePlaybookStateReturn {
  const {
    text,
    profile,
    constraints,
    onApplyConstraints,
    setActiveTab,
    bumpMobileInspector,
    voiceDna,
    defaultPlatform,
    voiceStyleGuideId,
  } = deps;

  const [platform, setPlatform] = useState<PlaybookPlatform | null>(defaultPlatform ?? null);
  const [useVoice, setUseVoice] = useState(Boolean(voiceDna?.trim()));
  const [useStyleGuide, setUseStyleGuide] = useState(Boolean(voiceStyleGuideId));
  const [styleGuidePolicy, setStyleGuidePolicy] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (defaultPlatform && platform === null) {
      setPlatform(defaultPlatform);
    }
  }, [defaultPlatform, platform]);

  useEffect(() => {
    if (!voiceStyleGuideId) {
      setStyleGuidePolicy(null);
      return;
    }
    getUserStyle(voiceStyleGuideId)
      .then((style) => setStyleGuidePolicy(style.policy))
      .catch(() => setStyleGuidePolicy(null));
  }, [voiceStyleGuideId]);

  const personalStyleTargets = useMemo(() => {
    if (!useStyleGuide || !styleGuidePolicy) return undefined;
    const targets = styleGuidePolicy.targets;
    if (!targets || typeof targets !== "object") return undefined;
    return [`Personal style targets: ${JSON.stringify(targets)}`];
  }, [useStyleGuide, styleGuidePolicy]);

  const lexiconSwaps = getLexiconSwapLines(profile?.sentences.map((s) => s.text).join(" ") ?? text);

  const buildConstraintDoc = useCallback(() => {
    if (!profile) return null;
    return generateConstraints(profile, undefined, {
      playbookId: "anti-slop-copy",
      platform: platform ?? undefined,
      voiceDna: useVoice ? voiceDna : undefined,
      rewriteConstraints: constraints,
      lexiconSwaps: lexiconSwaps.length > 0 ? lexiconSwaps : undefined,
      personalStyleTargets,
    });
  }, [profile, platform, useVoice, voiceDna, constraints, lexiconSwaps, personalStyleTargets]);

  const applyPlatformToRewrite = useCallback(() => {
    if (!platform) return;
    const preset = getPlatformPreset(platform);
    const notes = [
      preset.notes,
      useVoice && voiceDna?.trim() ? `Voice: ${voiceDna.trim()}` : undefined,
      voiceStyleGuideId ? `Style guide: ${voiceStyleGuideId}` : undefined,
    ]
      .filter(Boolean)
      .join(" ");
    onApplyConstraints({ ...constraints, ...preset, notes: notes || preset.notes });
    setActiveTab("rewrite");
    bumpMobileInspector();
  }, [
    platform,
    constraints,
    onApplyConstraints,
    setActiveTab,
    bumpMobileInspector,
    useVoice,
    voiceDna,
    voiceStyleGuideId,
  ]);

  const applyPlaybookToRewrite = useCallback(() => {
    const doc = buildConstraintDoc();
    if (!doc) return;
    const preset = platform ? getPlatformPreset(platform) : {};
    const notes = [
      preset.notes,
      doc.constraints.avoid.length > 0
        ? `Avoid: ${doc.constraints.avoid.slice(0, 6).join(" | ")}`
        : undefined,
      doc.constraints.target.length > 0
        ? `Target: ${doc.constraints.target.slice(0, 4).join(" | ")}`
        : undefined,
      doc.constraints.lexicon_swaps?.length
        ? `Lexicon: ${doc.constraints.lexicon_swaps.slice(0, 8).join(" | ")}`
        : undefined,
      useVoice && voiceDna?.trim() ? `Voice: ${voiceDna.trim()}` : undefined,
      voiceStyleGuideId ? `Style guide: ${voiceStyleGuideId}` : undefined,
    ]
      .filter(Boolean)
      .join("\n");
    onApplyConstraints({ ...constraints, ...preset, notes });
    setActiveTab("rewrite");
    bumpMobileInspector();
  }, [
    buildConstraintDoc,
    platform,
    constraints,
    onApplyConstraints,
    setActiveTab,
    bumpMobileInspector,
    useVoice,
    voiceDna,
    voiceStyleGuideId,
  ]);

  const copyPlaybookPrompt = useCallback(() => {
    const doc = buildConstraintDoc();
    if (!doc) return;
    void navigator.clipboard?.writeText(doc.instruction);
  }, [buildConstraintDoc]);

  const copyAuditFailures = useCallback(
    (failedChecks: Array<{ label: string; detail?: string; hint?: string }>) => {
      if (failedChecks.length === 0) return;
      const lines = failedChecks.map((check) => {
        const parts = [check.label];
        if (check.detail) parts.push(check.detail);
        if (check.hint) parts.push(`Hint: ${check.hint}`);
        return parts.join(" — ");
      });
      void navigator.clipboard?.writeText(lines.join("\n"));
    },
    [],
  );

  return {
    platform,
    setPlatform,
    useVoice,
    setUseVoice,
    useStyleGuide,
    setUseStyleGuide,
    applyPlatformToRewrite,
    applyPlaybookToRewrite,
    copyPlaybookPrompt,
    copyAuditFailures,
    lexiconSwaps,
  };
}

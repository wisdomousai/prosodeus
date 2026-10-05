import type { SuggestionConfig } from "@prosodeus/core/browser";
import { selectHotSentencesFromProfile } from "@prosodeus/core/browser";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applySentenceReplacement } from "@/hooks/doc/sentence-replacement";
import type { UseDocumentWorkflowReturn } from "@/hooks/doc/useDocumentWorkflow";
import type { UseAnalysisSessionReturn } from "@/hooks/useAnalysisSession";
import type { UseEditorStateReturn } from "@/hooks/useEditorState";
import { analysisTextEquals } from "@/lib/analysis-text";
import { isOnFocusSuggestAuto } from "@/lib/analyze-prefs";
import {
  resolveSentenceInspectState,
  type SentenceInspectContext,
} from "@/lib/sentence-inspect-state";

export interface UseSuggestionFlowDeps {
  analysis: UseAnalysisSessionReturn;
  workflow: UseDocumentWorkflowReturn;
  editor: UseEditorStateReturn;
  inspectCtx: SentenceInspectContext;
  visibleSentenceIds: Set<number>;
  modelOptions: Array<{ id: string; name: string }>;
  /** Fires after a suggestion is applied to the editor (e.g. auto-versioning). */
  onApplied?: () => void;
}

export interface UseSuggestionFlowReturn {
  suggestCouncil: boolean;
  setSuggestCouncil: (on: boolean) => void;
  orderedCouncilModelIds: string[];
  handleCouncilModelToggle: (id: string, selected: boolean) => void;
  handleCouncilSelectAll: () => void;
  handleCouncilClear: () => void;
  /** Model config for background/auto suggestions (single toolbar model). */
  suggestModelConfig: Partial<SuggestionConfig> | undefined;
  requestFocalSuggestions: () => void;
  applySuggestion: (sentenceId: number, newText: string) => boolean;
  dismissSuggestion: (sentenceId: number) => void;
}

/**
 * Owns the rewrite-suggestion lifecycle around the analysis session: council
 * model selection, on-focus auto-suggest, viewport prefetch, and applying an
 * inline suggestion back into the editor.
 */
export function useSuggestionFlow(deps: UseSuggestionFlowDeps): UseSuggestionFlowReturn {
  const { analysis, workflow, editor, inspectCtx, visibleSentenceIds, modelOptions, onApplied } =
    deps;
  const {
    profile,
    status,
    rewriteSuggestions,
    requestSuggestions,
    dismissSuggestions,
    patchProfileSentenceText,
  } = analysis;
  const { backgroundSuggest, staleSentenceIds, lastAnalyzedTextRef, modelId } = workflow;
  const { textRef, setEditorText, tiptapEditor, focalSentenceId } = editor;

  const [suggestCouncil, setSuggestCouncil] = useState(true);
  const [councilModelIds, setCouncilModelIds] = useState<string[]>([]);
  const councilSelectionTouchedRef = useRef(false);
  /** Prevent auto on-focus suggest from retrying the same sentence after failure. */
  const suggestAttemptedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const ids = modelOptions.map((m) => m.id);
    const available = new Set(ids);
    setCouncilModelIds((prev) =>
      councilSelectionTouchedRef.current ? prev.filter((id) => available.has(id)) : ids,
    );
  }, [modelOptions]);

  const orderedCouncilModelIds = useMemo(() => {
    const available = new Set(modelOptions.map((m) => m.id));
    const selected = councilModelIds.filter((id) => available.has(id));
    if (!modelId || !selected.includes(modelId)) return selected;
    return [modelId, ...selected.filter((id) => id !== modelId)];
  }, [councilModelIds, modelId, modelOptions]);

  const suggestModelConfig = useMemo(
    (): Partial<SuggestionConfig> | undefined =>
      modelId ? { models: [modelId], mode: "single" } : undefined,
    [modelId],
  );

  const onDemandSuggestModelConfig = useMemo((): Partial<SuggestionConfig> | undefined => {
    if (!modelId) return undefined;
    return {
      models: suggestCouncil ? orderedCouncilModelIds : [modelId],
      mode: suggestCouncil ? "council" : "single",
    };
  }, [modelId, orderedCouncilModelIds, suggestCouncil]);

  const handleCouncilModelToggle = useCallback((id: string, selected: boolean) => {
    councilSelectionTouchedRef.current = true;
    setCouncilModelIds((prev) => {
      if (selected) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((model) => model !== id);
    });
  }, []);

  const handleCouncilSelectAll = useCallback(() => {
    councilSelectionTouchedRef.current = true;
    setCouncilModelIds(modelOptions.map((m) => m.id));
  }, [modelOptions]);

  const handleCouncilClear = useCallback(() => {
    councilSelectionTouchedRef.current = true;
    setCouncilModelIds([]);
  }, []);

  // Reset per-sentence attempt tracking when a new profile arrives
  // biome-ignore lint/correctness/useExhaustiveDependencies: profile identity is the reset signal.
  useEffect(() => {
    suggestAttemptedRef.current.clear();
  }, [profile]);

  // On-focus suggest when auto mode and sentence is critique_ready (not queued in batch).
  useEffect(() => {
    if (focalSentenceId === null || !profile || !textRef.current) return;
    if (!backgroundSuggest) return;
    if (status !== "ready") return;
    if (!isOnFocusSuggestAuto()) return;
    if (suggestAttemptedRef.current.has(focalSentenceId)) return;
    if (!analysisTextEquals(textRef.current, lastAnalyzedTextRef.current)) return;
    if (staleSentenceIds.has(focalSentenceId)) return;

    const state = resolveSentenceInspectState(focalSentenceId, inspectCtx);
    if (state !== "critique_ready") return;

    const sentence = profile.sentences.find((s) => s.id === focalSentenceId);
    if (!sentence || sentence.classification.patterns.length === 0) return;

    suggestAttemptedRef.current.add(focalSentenceId);
    requestSuggestions(focalSentenceId, textRef.current, suggestModelConfig, {
      text: sentence.text,
      classification: sentence.classification,
    });
  }, [
    focalSentenceId,
    profile,
    inspectCtx,
    requestSuggestions,
    textRef,
    suggestModelConfig,
    staleSentenceIds,
    status,
    backgroundSuggest,
    lastAnalyzedTextRef,
  ]);

  const requestFocalSuggestions = useCallback(() => {
    if (focalSentenceId === null || !profile || !textRef.current || status !== "ready") return;
    const sentence = profile.sentences.find((s) => s.id === focalSentenceId);
    suggestAttemptedRef.current.delete(focalSentenceId);
    requestSuggestions(
      focalSentenceId,
      textRef.current,
      onDemandSuggestModelConfig,
      sentence ? { text: sentence.text, classification: sentence.classification } : undefined,
    );
  }, [focalSentenceId, profile, requestSuggestions, textRef, onDemandSuggestModelConfig, status]);

  // Automatic viewport prefetch follows the same rewrite-options switch.
  const lastPrefetchRef = useRef(0);
  useEffect(() => {
    if (!backgroundSuggest || !profile || visibleSentenceIds.size === 0) return;
    if (!analysisTextEquals(textRef.current, lastAnalyzedTextRef.current)) return;
    const hot = selectHotSentencesFromProfile(profile, 1, visibleSentenceIds)[0];
    if (!hot || rewriteSuggestions.has(hot.id)) return;
    if (staleSentenceIds.has(hot.id)) return;
    const now = Date.now();
    if (now - lastPrefetchRef.current < 2000) return;
    const idle =
      typeof requestIdleCallback === "function"
        ? requestIdleCallback
        : (cb: () => void) => window.setTimeout(cb, 100);
    idle(() => {
      if (rewriteSuggestions.has(hot.id) || !textRef.current) return;
      lastPrefetchRef.current = Date.now();
      requestSuggestions(hot.id, textRef.current, suggestModelConfig, {
        text: hot.text,
        classification: hot.classification,
      });
    });
  }, [
    profile,
    visibleSentenceIds,
    rewriteSuggestions,
    requestSuggestions,
    textRef,
    suggestModelConfig,
    staleSentenceIds,
    backgroundSuggest,
    lastAnalyzedTextRef,
  ]);

  // Apply an inline suggestion (replace sentence text, mark stale, re-analyze)
  const applySuggestion = useCallback(
    (sentenceId: number, newText: string) => {
      return applySentenceReplacement({
        tiptapEditor,
        profile,
        sentenceId,
        newText,
        textRef,
        setEditorText,
        suppressEditorSideEffectsRef: workflow.suppressEditorSideEffectsRef,
        markApplied: workflow.markApplied,
        patchProfileSentenceText,
        dismissSuggestions,
        onApplied,
      });
    },
    [
      tiptapEditor,
      profile,
      textRef,
      setEditorText,
      dismissSuggestions,
      patchProfileSentenceText,
      workflow,
      onApplied,
    ],
  );

  const dismissSuggestion = useCallback(
    (sentenceId: number) => {
      dismissSuggestions(sentenceId);
    },
    [dismissSuggestions],
  );

  return {
    suggestCouncil,
    setSuggestCouncil,
    orderedCouncilModelIds,
    handleCouncilModelToggle,
    handleCouncilSelectAll,
    handleCouncilClear,
    suggestModelConfig,
    requestFocalSuggestions,
    applySuggestion,
    dismissSuggestion,
  };
}

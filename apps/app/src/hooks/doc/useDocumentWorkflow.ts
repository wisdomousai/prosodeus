import { diffChangedSentenceIds } from "@prosodeus/core/browser";
import type { AiSlopMatcherMode, AnalyzeCallOptions } from "@prosodeus/shared/browser";
import { resolveBackgroundSuggestTopN } from "@prosodeus/shared/browser";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildSentencePositions } from "@/editor/extensions/sentence-tracker";
import type { UseAnalysisSessionReturn } from "@/hooks/useAnalysisSession";
import type { UseEditorStateReturn } from "@/hooks/useEditorState";
import { analysisTextEquals, hasAnalysisText } from "@/lib/analysis-text";
import {
  isAutoAnalyzeEnabled,
  isAutoAnalyzeViewportScope,
  isBackgroundSuggestEnabled,
  setBackgroundSuggestEnabled,
} from "@/lib/analyze-prefs";
import { listPatterns } from "@/lib/api";
import { desktopApi, isDesktop } from "@/lib/desktop-bridge";

/** Re-classify changed sentences only; skip batched suggestion LLM calls. */
export const INCREMENTAL_ANALYZE = (
  changedIds?: number[],
  scope?: "document" | "viewport",
  aiSlopMode: AiSlopMatcherMode = "tiered",
): AnalyzeCallOptions => ({
  analyzeMode: "incremental",
  topSuggestions: 0,
  suggestMode: "none",
  aiSlopMode,
  ...(changedIds?.length ? { changedSentenceIds: changedIds } : {}),
  ...(scope ? { scope } : {}),
});

export function fullAnalyzeOpts(
  text: string,
  backgroundSuggest: boolean,
  aiSlopMode: AiSlopMatcherMode,
): AnalyzeCallOptions {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  return {
    analyzeMode: "full",
    aiSlopMode,
    suggestMode: backgroundSuggest ? "batch" : "none",
    topSuggestions: backgroundSuggest ? resolveBackgroundSuggestTopN(wordCount) : 0,
  };
}

export interface UseDocumentWorkflowDeps {
  id: string;
  analysis: UseAnalysisSessionReturn;
  editor: UseEditorStateReturn;
  usingLocalSample: boolean;
  availableModels: Array<{ id: string; name: string }>;
  visibleSentenceIds: Set<number>;
  /** Called when the document id changes (e.g. close transient panels). */
  onDocumentChange?: () => void;
}

export interface UseDocumentWorkflowReturn {
  styleId: string | undefined;
  setStyleId: (id: string | undefined) => void;
  modelId: string | undefined;
  setModelId: (id: string | undefined) => void;
  aiSlopMode: AiSlopMatcherMode;
  setAiSlopMode: (mode: AiSlopMatcherMode) => void;
  backgroundSuggest: boolean;
  setBackgroundSuggest: (enabled: boolean) => void;
  staleSentenceIds: Set<number>;
  styleRef: React.MutableRefObject<string | undefined>;
  modelRef: React.MutableRefObject<string | undefined>;
  disabledPatternsRef: React.MutableRefObject<string[]>;
  lastAnalyzedTextRef: React.MutableRefObject<string>;
  /** Skip destructive editor-change side effects during controlled rewrite apply. */
  suppressEditorSideEffectsRef: React.MutableRefObject<boolean>;
  queueAnalyze: (
    text: string,
    style?: string,
    model?: string,
    disabledPatterns?: string[],
    opts?: AnalyzeCallOptions,
  ) => void;
  runFullAnalyze: () => void;
  handleEditorTextChange: (text: string) => void;
  reAnalyzeStale: (sentenceId: number) => void;
  /**
   * Shared post-apply bookkeeping: diff against the analyzed baseline, mark
   * stale sentences, and queue an incremental re-analyze. Returns the stale ids.
   */
  markApplied: (newText: string, fallbackStaleIds: number[]) => number[];
  saveState: string;
}

const PREFERRED_DEFAULT_MODEL_ID = "codex-gpt-5.5";

export function selectDefaultWorkflowModelId(
  availableModels: Array<{ id: string }>,
  currentModelId?: string,
): string | undefined {
  const ids = new Set(availableModels.map((model) => model.id));
  if (currentModelId && ids.has(currentModelId)) return currentModelId;
  return (
    availableModels.find((model) => model.id === PREFERRED_DEFAULT_MODEL_ID)?.id ??
    availableModels[0]?.id
  );
}

/**
 * Owns the load + analyze orchestration for one document: analyze options
 * (style, model, marker depth, background suggest), the analyzed-text
 * baseline, stale-sentence tracking, and the auto-analyze lifecycle.
 */
export function useDocumentWorkflow(deps: UseDocumentWorkflowDeps): UseDocumentWorkflowReturn {
  const { id, analysis, editor, usingLocalSample, availableModels, visibleSentenceIds } = deps;
  const {
    profile,
    progress,
    status,
    analyze,
    clearRewriteAlternatives,
    clearRewriteSuggestions,
    versionContent,
    lastSavedAt,
  } = analysis;
  const { textRef, editorText, setEditorText, setForcedEditorContent, tiptapEditor } = editor;

  const [styleId, setStyleId] = useState<string | undefined>(undefined);
  const [modelId, setModelId] = useState<string | undefined>(undefined);
  const [backgroundSuggest, setBackgroundSuggestState] = useState(() =>
    isBackgroundSuggestEnabled(),
  );
  const [aiSlopMode, setAiSlopMode] = useState<AiSlopMatcherMode>("tiered");
  const [staleSentenceIds, setStaleSentenceIds] = useState<Set<number>>(new Set());

  const localSampleAnalyzed = useRef(false);
  const disabledPatternsRef = useRef<string[]>([]);
  const lastAnalyzedTextRef = useRef<string>("");
  /** Text sent to the in-flight analyze call; committed to lastAnalyzedTextRef when ready. */
  const pendingAnalyzeTextRef = useRef<string | null>(null);
  const suppressEditorSideEffectsRef = useRef(false);

  const styleRef = useRef<string | undefined>(undefined);
  const modelRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    styleRef.current = styleId;
  }, [styleId]);
  useEffect(() => {
    modelRef.current = modelId;
  }, [modelId]);

  const setBackgroundSuggest = useCallback((enabled: boolean) => {
    setBackgroundSuggestState(enabled);
    setBackgroundSuggestEnabled(enabled);
  }, []);

  // Fetch disabled pattern IDs once on mount
  useEffect(() => {
    listPatterns({})
      .then((data) => {
        disabledPatternsRef.current = data.patterns
          .filter((p) => !p.is_enabled)
          .map((p) => p.pattern_id);
      })
      .catch(() => {
        /* offline — no filtering */
      });
  }, []);

  // Reset on doc change
  const onDocumentChangeRef = useRef(deps.onDocumentChange);
  onDocumentChangeRef.current = deps.onDocumentChange;
  useEffect(() => {
    setForcedEditorContent(null);
    localSampleAnalyzed.current = false;
    lastAnalyzedTextRef.current = "";
    onDocumentChangeRef.current?.();

    if (isDesktop() && id) {
      void desktopApi()
        .documents.get(id)
        .then((row) => {
          const r = row as { content?: string | null } | null;
          if (r?.content) {
            setForcedEditorContent({ rev: Date.now(), text: r.content });
          }
        })
        .catch(() => {});
    }
  }, [id, setForcedEditorContent]);

  // Sync version content into editor (canonical text arrives via onTextChange)
  useEffect(() => {
    if (versionContent?.content == null) return;
    const t = String(versionContent.content);
    setForcedEditorContent({ rev: versionContent.id as number, text: t });
  }, [versionContent, setForcedEditorContent]);

  const queueAnalyze = useCallback(
    (
      text: string,
      style?: string,
      model?: string,
      disabledPatterns?: string[],
      opts?: AnalyzeCallOptions,
    ) => {
      pendingAnalyzeTextRef.current = text;
      analyze(text, style, model, disabledPatterns, opts);
    },
    [analyze],
  );

  useEffect(() => {
    if (status === "ready" && pendingAnalyzeTextRef.current !== null) {
      lastAnalyzedTextRef.current = pendingAnalyzeTextRef.current;
      pendingAnalyzeTextRef.current = null;
    } else if (status === "error") {
      pendingAnalyzeTextRef.current = null;
    }
  }, [status]);

  const runFullAnalyze = useCallback(() => {
    const text = textRef.current.trim() ? textRef.current : editorText;
    if (!text.trim()) return;
    textRef.current = text;
    queueAnalyze(
      text,
      styleRef.current,
      modelRef.current,
      disabledPatternsRef.current,
      fullAnalyzeOpts(text, backgroundSuggest, aiSlopMode),
    );
  }, [queueAnalyze, textRef, editorText, backgroundSuggest, aiSlopMode]);

  // Local sample: analyze once on load
  useEffect(() => {
    if (!usingLocalSample || localSampleAnalyzed.current || !editorText.trim()) return;
    localSampleAnalyzed.current = true;
    queueAnalyze(
      editorText,
      styleRef.current,
      modelRef.current,
      disabledPatternsRef.current,
      fullAnalyzeOpts(editorText, backgroundSuggest, aiSlopMode),
    );
  }, [usingLocalSample, editorText, queueAnalyze, backgroundSuggest, aiSlopMode]);

  // Local sample: move cursor to the first pattern sentence once analyzed
  useEffect(() => {
    if (!usingLocalSample || !profile || editor.focalSentenceId !== null) return;
    const firstPatternSentence = profile.sentences.find(
      (sentence) => sentence.classification.patterns.length > 0,
    );
    const targetId = firstPatternSentence?.id ?? profile.sentences[0]?.id ?? null;
    if (targetId !== null && tiptapEditor) {
      const positions = buildSentencePositions(tiptapEditor.state.doc, profile.sentences);
      const sp = positions.find((p) => p.sentence.id === targetId);
      if (sp) {
        tiptapEditor.chain().setTextSelection(sp.from).run();
      }
    }
  }, [usingLocalSample, profile, editor.focalSentenceId, tiptapEditor]);

  const handleEditorTextChange = useCallback(
    (t: string) => {
      textRef.current = t;
      setEditorText(t);
      if (suppressEditorSideEffectsRef.current) {
        suppressEditorSideEffectsRef.current = false;
        return;
      }
      const baseline = lastAnalyzedTextRef.current;
      if (hasAnalysisText(baseline) && !analysisTextEquals(t, baseline)) {
        clearRewriteSuggestions();
        clearRewriteAlternatives();
        const changedIds = diffChangedSentenceIds(baseline, t);
        if (changedIds.length > 0) {
          setStaleSentenceIds((prev) => {
            const next = new Set(prev);
            for (const id of changedIds) next.add(id);
            return next;
          });
        }
      }
    },
    [textRef, setEditorText, clearRewriteSuggestions, clearRewriteAlternatives],
  );

  // Opt-in debounced auto-analyze (incremental)
  // biome-ignore lint/correctness/useExhaustiveDependencies: editorText is the debounce trigger; live text is read from textRef.current.
  useEffect(() => {
    if (!isAutoAnalyzeEnabled() || !profile || status === "analyzing") return;
    const timer = setTimeout(() => {
      const current = textRef.current;
      const baseline = lastAnalyzedTextRef.current;
      if (!current || analysisTextEquals(current, baseline)) return;

      const style = styleRef.current;
      const model = modelRef.current;
      const disabled = disabledPatternsRef.current;

      // No committed baseline yet — run a full pass instead of bailing on empty diff.
      if (!hasAnalysisText(baseline)) {
        queueAnalyze(
          current,
          style,
          model,
          disabled,
          fullAnalyzeOpts(current, backgroundSuggest, aiSlopMode),
        );
        return;
      }

      const viewportScope = isAutoAnalyzeViewportScope();
      const allChanged = diffChangedSentenceIds(baseline, current);
      const changedIds =
        viewportScope && visibleSentenceIds.size > 0
          ? allChanged.filter((id: number) => visibleSentenceIds.has(id))
          : allChanged;

      if (changedIds.length === 0) {
        // Text changed but sentence hashes didn't (normalization edge) — full pass.
        queueAnalyze(
          current,
          style,
          model,
          disabled,
          fullAnalyzeOpts(current, backgroundSuggest, aiSlopMode),
        );
        return;
      }

      queueAnalyze(
        current,
        style,
        model,
        disabled,
        INCREMENTAL_ANALYZE(changedIds, viewportScope ? "viewport" : "document", aiSlopMode),
      );
    }, 3000);
    return () => clearTimeout(timer);
  }, [
    editorText,
    profile,
    status,
    queueAnalyze,
    textRef,
    visibleSentenceIds,
    backgroundSuggest,
    aiSlopMode,
  ]);

  const reAnalyzeStale = useCallback(
    (sentenceId: number) => {
      if (!textRef.current) return;
      queueAnalyze(
        textRef.current,
        styleRef.current,
        modelRef.current,
        disabledPatternsRef.current,
        INCREMENTAL_ANALYZE([sentenceId], undefined, aiSlopMode),
      );
    },
    [queueAnalyze, textRef, aiSlopMode],
  );

  const markApplied = useCallback(
    (newText: string, fallbackStaleIds: number[]): number[] => {
      const changedIds = diffChangedSentenceIds(lastAnalyzedTextRef.current, newText);
      const staleIds = changedIds.length > 0 ? changedIds : fallbackStaleIds;
      setStaleSentenceIds(new Set(staleIds));
      queueAnalyze(
        newText,
        styleRef.current,
        modelRef.current,
        disabledPatternsRef.current,
        INCREMENTAL_ANALYZE(staleIds, undefined, aiSlopMode),
      );
      return staleIds;
    },
    [queueAnalyze, aiSlopMode],
  );

  // Clear stale markers when a new profile arrives
  // biome-ignore lint/correctness/useExhaustiveDependencies: profile is the reset signal; staleSentenceIds.size is only a guard.
  useEffect(() => {
    if (profile && staleSentenceIds.size > 0) {
      setStaleSentenceIds(new Set());
    }
  }, [profile]);

  // Pick a valid default model; preserve explicit user picks when they are still available.
  useEffect(() => {
    if (availableModels.length === 0) return;
    const nextModelId = selectDefaultWorkflowModelId(availableModels, modelId);
    if (nextModelId && nextModelId !== modelId) setModelId(nextModelId);
  }, [availableModels, modelId]);

  const saveState = useMemo(() => {
    if (usingLocalSample) {
      if (status === "analyzing") return "local analysis";
      return "local sample · API unavailable";
    }
    const parts: string[] = [];
    if (status === "analyzing") {
      parts.push(progress ? `analyzing ${progress.classifying}/${progress.total}` : "analyzing");
    } else if (status === "ready") {
      parts.push("ready");
    } else {
      parts.push(status);
    }
    if (lastSavedAt) parts.push(`saved ${formatSavedAgo(lastSavedAt)}`);
    return parts.join(" · ");
  }, [usingLocalSample, status, progress, lastSavedAt]);

  return {
    styleId,
    setStyleId,
    modelId,
    setModelId,
    aiSlopMode,
    setAiSlopMode,
    backgroundSuggest,
    setBackgroundSuggest,
    staleSentenceIds,
    styleRef,
    modelRef,
    disabledPatternsRef,
    lastAnalyzedTextRef,
    suppressEditorSideEffectsRef,
    queueAnalyze,
    runFullAnalyze,
    handleEditorTextChange,
    reAnalyzeStale,
    markApplied,
    saveState,
  };
}

function formatSavedAgo(ts: number): string {
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

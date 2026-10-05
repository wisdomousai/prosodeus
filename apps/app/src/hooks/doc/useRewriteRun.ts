import type { RewriteConstraints } from "@prosodeus/shared/browser";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { RewriteScope } from "@/components/inspector/RewriteSetupPanel";
import { DEFAULT_CONSTRAINTS } from "@/components/inspector/rewrite-constraints";
import { type PatternCluster, patternLabel } from "@/components/inspector/types";
import { buildSentencePositions } from "@/editor/extensions/sentence-tracker";
import type { UseDocumentWorkflowReturn } from "@/hooks/doc/useDocumentWorkflow";
import type { UseFragmentNavigationReturn } from "@/hooks/doc/useFragmentNavigation";
import type { UseAnalysisSessionReturn } from "@/hooks/useAnalysisSession";
import type { UseEditorStateReturn } from "@/hooks/useEditorState";
import type { UseInspectorStateReturn } from "@/hooks/useInspectorState";
import { exportEditorPlaintext, normalizeRewriteInsertText } from "@/lib/editor-plaintext";

export type RewriteTarget = { sentenceId: number } | { cluster: PatternCluster };

export interface UseRewriteRunDeps {
  analysis: UseAnalysisSessionReturn;
  workflow: UseDocumentWorkflowReturn;
  editor: UseEditorStateReturn;
  fragmentNav: Pick<UseFragmentNavigationReturn, "goTo" | "selectSentences">;
  inspector: Pick<UseInspectorStateReturn, "setActiveTab" | "bumpMobileInspector">;
  /** Fires after an alternative is applied to the editor (e.g. auto-versioning). */
  onApplied?: () => void;
}

export interface UseRewriteRunReturn {
  scope: RewriteScope;
  setScope: (scope: RewriteScope) => void;
  constraints: RewriteConstraints;
  setConstraint: <K extends keyof RewriteConstraints>(key: K, value: RewriteConstraints[K]) => void;
  replaceConstraints: (next: RewriteConstraints) => void;
  alternativesCount: number;
  setAlternativesCount: (n: number) => void;
  /** Sentence-id span the next run will rewrite, from selection + scope. */
  selectedSpan: { start: number; end: number } | null;
  /** Select the target in the editor and open the Rewrite tab in setup state. */
  openSetup: (target: RewriteTarget) => void;
  /** Explicitly generate alternatives for the current span and constraints. */
  run: () => void;
  apply: (rewrittenText: string, original: string) => void;
  copyAlternative: (text: string) => void;
  reject: () => void;
  copyConstraints: () => void;
  copyClusterConstraints: (cluster: PatternCluster) => void;
}

/**
 * Document-local rewrite workflow: pick a scope (sentence, passage, cluster),
 * adjust run-level constraints, explicitly generate alternatives, then apply
 * one back into the editor. Analysis stays in the Analyze tab; this hook owns
 * the setup → run → compare → apply sequence behind the Rewrite tab.
 */
export function useRewriteRun(deps: UseRewriteRunDeps): UseRewriteRunReturn {
  const { analysis, workflow, editor, fragmentNav, inspector, onApplied } = deps;
  const { profile, requestRewriteAlternatives, clearRewriteAlternatives } = analysis;
  const { textRef, setEditorText, tiptapEditor, selectionContext, focalSentenceId } = editor;

  const [scope, setScope] = useState<RewriteScope>("sentence");
  const [constraints, setConstraints] = useState<RewriteConstraints>(DEFAULT_CONSTRAINTS);
  const [alternativesCount, setAlternativesCount] = useState(3);

  const setConstraint = useCallback(
    <K extends keyof RewriteConstraints>(key: K, value: RewriteConstraints[K]) => {
      setConstraints((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const replaceConstraints = useCallback((next: RewriteConstraints) => {
    setConstraints(next);
  }, []);

  const focalSentence = useMemo(
    () =>
      profile && focalSentenceId !== null
        ? (profile.sentences.find((s) => s.id === focalSentenceId) ?? null)
        : null,
    [profile, focalSentenceId],
  );

  // Seed run-level constraints from the focal sentence's detected patterns.
  useEffect(() => {
    if (!focalSentence) return;
    const seeded: RewriteConstraints = { ...DEFAULT_CONSTRAINTS };
    for (const p of focalSentence.classification.patterns) {
      const t = p.type.toLowerCase();
      if (t.includes("parallel") || t.includes("tricolon") || t.includes("opening")) {
        seeded.rhythm_policy = "break_mirrored";
      }
      if (t.includes("intensifier") || t.includes("importance") || t.includes("superlative")) {
        seeded.expression_budget = "few";
      }
      if (t.includes("nominalization") || t.includes("hedging")) {
        seeded.statement_force = "firm";
      }
    }
    setConstraints(seeded);
  }, [focalSentence?.id]);

  // Drop generated alternatives when the focal sentence changes.
  useEffect(() => {
    clearRewriteAlternatives();
  }, [focalSentenceId, clearRewriteAlternatives]);

  const selectedSpan = useMemo(() => {
    if (!profile || !focalSentence) return null;
    if (selectionContext.isRange && selectionContext.sentenceIds.length > 1) {
      return {
        start: Math.min(...selectionContext.sentenceIds),
        end: Math.max(...selectionContext.sentenceIds),
      };
    }
    if (scope === "sentence") return { start: focalSentence.id, end: focalSentence.id };
    if (scope === "paragraph") {
      const paragraphSentences = profile.sentences.filter(
        (s) => s.paragraph_id === focalSentence.paragraph_id,
      );
      return {
        start: paragraphSentences[0]?.id ?? focalSentence.id,
        end: paragraphSentences.at(-1)?.id ?? focalSentence.id,
      };
    }
    const start = Math.max(0, focalSentence.id - 1);
    const end = Math.min(profile.sentences.at(-1)?.id ?? focalSentence.id, focalSentence.id + 2);
    return { start, end };
  }, [profile, focalSentence, selectionContext, scope]);

  const openSetup = useCallback(
    (target: RewriteTarget) => {
      if ("sentenceId" in target) {
        setScope("sentence");
        fragmentNav.goTo(target.sentenceId);
      } else {
        fragmentNav.selectSentences(target.cluster.sentences);
      }
      inspector.setActiveTab("rewrite");
      inspector.bumpMobileInspector();
    },
    [fragmentNav, inspector],
  );

  const run = useCallback(() => {
    if (!selectedSpan || !textRef.current) return;
    requestRewriteAlternatives(
      textRef.current,
      selectedSpan.start,
      selectedSpan.end,
      constraints,
      alternativesCount,
      workflow.styleRef.current,
      workflow.modelRef.current,
    );
  }, [selectedSpan, constraints, alternativesCount, requestRewriteAlternatives, textRef, workflow]);

  // Optimistic patch on apply — surgical, preserves focus.
  const apply = useCallback(
    (rewrittenText: string, _original: string) => {
      if (!tiptapEditor || !profile || !textRef.current) return;

      const positions = buildSentencePositions(tiptapEditor.state.doc, profile.sentences);
      const targetIds =
        selectionContext.sentenceIds.length > 0
          ? selectionContext.sentenceIds
          : focalSentenceId !== null
            ? [focalSentenceId]
            : [];
      const targetPositions = positions.filter((p) => targetIds.includes(p.sentence.id));
      if (targetPositions.length === 0) return;

      const from = Math.min(...targetPositions.map((p) => p.from));
      const to = Math.max(...targetPositions.map((p) => p.to));
      const normalized = normalizeRewriteInsertText(rewrittenText);

      workflow.suppressEditorSideEffectsRef.current = true;
      tiptapEditor.chain().insertContentAt({ from, to }, normalized).run();

      const newText = exportEditorPlaintext(tiptapEditor);
      textRef.current = newText;
      setEditorText(newText);

      if (targetIds.length === 1) {
        analysis.patchProfileSentenceText(targetIds[0]!, normalized);
      }

      const fallbackIds =
        targetIds.length > 0 ? targetIds : focalSentenceId !== null ? [focalSentenceId] : [];
      const staleIds = workflow.markApplied(newText, fallbackIds);

      for (const sid of staleIds) analysis.dismissSuggestions(sid);
      if (staleIds.length === 0 && focalSentenceId !== null) {
        analysis.dismissSuggestions(focalSentenceId);
      }
      clearRewriteAlternatives();
      onApplied?.();
    },
    [
      tiptapEditor,
      profile,
      textRef,
      setEditorText,
      selectionContext,
      focalSentenceId,
      analysis,
      workflow,
      clearRewriteAlternatives,
      onApplied,
    ],
  );

  const copyAlternative = useCallback((text: string) => {
    void navigator.clipboard?.writeText(text);
  }, []);

  const reject = useCallback(() => {
    clearRewriteAlternatives();
  }, [clearRewriteAlternatives]);

  const copyConstraints = useCallback(() => {
    if (!focalSentence) return;
    const lines = [
      `Sentence: "${focalSentence.text}"`,
      ...focalSentence.classification.patterns.map(
        (p) => `- avoid ${p.type.replace(/_/g, " ")} (evidence: "${p.evidence}")`,
      ),
    ];
    void navigator.clipboard?.writeText(lines.join("\n"));
  }, [focalSentence]);

  const copyClusterConstraints = useCallback(
    (cluster: PatternCluster) => {
      if (!profile) return;
      const lines: string[] = [
        `Pattern cluster: ${patternLabel(cluster.type)}`,
        `Occurrences: ${cluster.count}× · Density: ${(cluster.density * 100).toFixed(0)}% of sentences`,
        "",
      ];
      const sortedIds = [...new Set(cluster.sentences)].sort((a, b) => a - b);
      for (const sid of sortedIds) {
        const s = profile.sentences.find((x) => x.id === sid);
        if (!s) continue;
        const hits = s.classification.patterns.filter((p) => p.type === cluster.type);
        lines.push(`Sentence ${sid + 1}: "${s.text}"`);
        for (const p of hits) {
          lines.push(`  - ${patternLabel(p.type)}${p.evidence ? ` ("${p.evidence}")` : ""}`);
        }
        lines.push("");
      }
      void navigator.clipboard?.writeText(lines.join("\n").trim());
    },
    [profile],
  );

  return {
    scope,
    setScope,
    constraints,
    setConstraint,
    replaceConstraints,
    alternativesCount,
    setAlternativesCount,
    selectedSpan,
    openSetup,
    run,
    apply,
    copyAlternative,
    reject,
    copyConstraints,
    copyClusterConstraints,
  };
}

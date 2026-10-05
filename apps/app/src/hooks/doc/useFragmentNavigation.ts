import type { StylometricProfile } from "@prosodeus/core/browser";
import type { Editor } from "@tiptap/core";
import { useCallback, useEffect, useMemo } from "react";
import { buildSentencePositions } from "@/editor/extensions/sentence-tracker";
import { buildHotSentenceIds, listInspectableHotSentences } from "@/lib/sentence-inspect-state";

export interface UseFragmentNavigationReturn {
  /** Ids of hot fragments, for editor heat decorations. */
  hotSentenceIds: Set<number>;
  /** Move the editor cursor to a sentence and scroll it into view. */
  goTo: (sentenceId: number) => void;
  /** Set an explicit editor selection spanning the given sentences. */
  selectSentences: (sentenceIds: number[]) => void;
  goPrev: () => void;
  goNext: () => void;
}

/**
 * Single source of truth for iterating over hot fragments: one position-based
 * navigation implementation plus the global keyboard handler
 * (ArrowLeft/ArrowRight step through hot sentences, Escape collapses selection).
 */
export function useFragmentNavigation(
  profile: StylometricProfile | null,
  tiptapEditor: Editor | null,
  focalSentenceId: number | null,
): UseFragmentNavigationReturn {
  const hotSentenceIds = useMemo(() => buildHotSentenceIds(profile), [profile]);

  const goTo = useCallback(
    (sentenceId: number) => {
      if (!profile || !tiptapEditor) return;
      const positions = buildSentencePositions(tiptapEditor.state.doc, profile.sentences);
      const sp = positions.find((p) => p.sentence.id === sentenceId);
      if (sp) {
        tiptapEditor.chain().focus().setTextSelection(sp.from).scrollIntoView().run();
      }
    },
    [profile, tiptapEditor],
  );

  const selectSentences = useCallback(
    (sentenceIds: number[]) => {
      const ids = [...new Set(sentenceIds)];
      if (ids.length === 0 || !profile || !tiptapEditor) return;
      const positions = buildSentencePositions(tiptapEditor.state.doc, profile.sentences);
      const targetPositions = positions.filter((p) => ids.includes(p.sentence.id));
      if (targetPositions.length === 0) return;
      const from = Math.min(...targetPositions.map((p) => p.from));
      const to = Math.max(...targetPositions.map((p) => p.to));
      tiptapEditor.chain().focus().setTextSelection({ from, to }).scrollIntoView().run();
    },
    [profile, tiptapEditor],
  );

  const navigate = useCallback(
    (direction: "prev" | "next") => {
      if (!profile || !tiptapEditor || focalSentenceId === null) return;
      const hot = listInspectableHotSentences(profile);
      if (hot.length === 0) return;

      const currentIdx = hot.findIndex((s) => s.id === focalSentenceId);
      const nextIdx =
        currentIdx >= 0
          ? direction === "prev"
            ? Math.max(0, currentIdx - 1)
            : Math.min(hot.length - 1, currentIdx + 1)
          : direction === "prev"
            ? hot.length - 1
            : 0;

      const target = hot[nextIdx];
      if (!target) return;
      goTo(target.id);
    },
    [profile, tiptapEditor, focalSentenceId, goTo],
  );

  const goPrev = useCallback(() => navigate("prev"), [navigate]);
  const goNext = useCallback(() => navigate("next"), [navigate]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!profile) return;
      const target = e.target as HTMLElement;
      if (
        target.tagName === "TEXTAREA" ||
        target.tagName === "INPUT" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      )
        return;
      if (e.key === "Escape" && focalSentenceId !== null) {
        // Collapse selection in the editor
        if (tiptapEditor) {
          tiptapEditor.chain().setTextSelection(tiptapEditor.state.selection.from).run();
        }
        e.preventDefault();
      } else if (e.key === "ArrowLeft" && focalSentenceId !== null) {
        navigate("prev");
        e.preventDefault();
      } else if (e.key === "ArrowRight" && focalSentenceId !== null) {
        navigate("next");
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [profile, focalSentenceId, navigate, tiptapEditor]);

  return { hotSentenceIds, goTo, selectSentences, goPrev, goNext };
}

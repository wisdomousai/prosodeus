import type { PatternType } from "@prosodeus/core/browser";
import type { Editor } from "@tiptap/core";
import { useCallback, useRef, useState } from "react";
import {
  EMPTY_SELECTION_CONTEXT,
  type SelectionContext,
} from "@/editor/extensions/selection-bridge";

export type { SelectionContext };

export interface UseEditorStateReturn {
  textRef: React.MutableRefObject<string>;
  editorText: string;
  setEditorText: (text: string) => void;
  forcedEditorContent: { rev: number; text: string } | null;
  setForcedEditorContent: (v: { rev: number; text: string } | null) => void;
  tiptapEditor: Editor | null;
  setTiptapEditor: (editor: Editor | null) => void;
  selectionContext: SelectionContext;
  setSelectionContext: (ctx: SelectionContext) => void;
  /** Derived from selectionContext.focalSentenceId for backward compat. */
  focalSentenceId: number | null;
  highlightClusterType: PatternType | null;
  setHighlightClusterType: (type: PatternType | null) => void;
}

/**
 * Manages the Tiptap editor instance state, text content, selection context,
 * and cluster highlighting.
 */
export function useEditorState(): UseEditorStateReturn {
  const textRef = useRef<string>("");
  const [editorText, setEditorText] = useState("");
  const [forcedEditorContent, setForcedEditorContent] = useState<{
    rev: number;
    text: string;
  } | null>(null);
  const [tiptapEditor, setTiptapEditor] = useState<Editor | null>(null);
  const [selectionContext, setSelectionContext] =
    useState<SelectionContext>(EMPTY_SELECTION_CONTEXT);
  const [highlightClusterType, setHighlightClusterType] = useState<PatternType | null>(null);

  const focalSentenceId = selectionContext.focalSentenceId;

  return {
    textRef,
    editorText,
    setEditorText,
    forcedEditorContent,
    setForcedEditorContent,
    tiptapEditor,
    setTiptapEditor,
    selectionContext,
    setSelectionContext,
    focalSentenceId,
    highlightClusterType,
    setHighlightClusterType,
  };
}

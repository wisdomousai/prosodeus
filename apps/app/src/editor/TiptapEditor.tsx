import type { PatternType, RewriteSuggestion, StylometricProfile } from "@prosodeus/core/browser";
import type { Editor } from "@tiptap/core";
import CharacterCount from "@tiptap/extension-character-count";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { type MarginTick, MarginTicks } from "@/components/shell/MarginTicks";
import { analysisTextEquals } from "@/lib/analysis-text";
import { exportEditorPlaintext } from "@/lib/editor-plaintext";
import { LOCAL_SAMPLE_TEXT } from "@/lib/local-analysis";
import { heatDecorationKey } from "./extensions/heat-decoration";
import { HeatDecoration } from "./extensions/heat-extension";
import { SelectionBridge, type SelectionChangeCallback } from "./extensions/selection-bridge";
import { buildSentencePositions } from "./extensions/sentence-tracker";
import { PatternTooltip } from "./PatternTooltip";
import { SuggestionContextMenu } from "./SuggestionContextMenu";
import { EditorToolbar } from "./toolbar/EditorToolbar";
import { collectPatterns } from "./utils/pattern-styles";

interface Props {
  profile: StylometricProfile | null;
  selectedSentenceIds: number[];
  /** Anchor sentence for inspector + suggestion menu (from SelectionBridge). */
  focalSentenceId?: number | null;
  onSelectionChange: SelectionChangeCallback;
  onSave?: (content: string) => void;
  /** Fires when editor text changes (including initial sample content). */
  onTextChange?: (text: string) => void;
  /** Replace editor body when `rev` changes (e.g. loading a stored revision). */
  forcedContent?: { rev: number; text: string } | null;
  /** Notified when the TipTap instance is created or destroyed (for outline / shell integration). */
  onEditorReady?: (editor: Editor | null) => void;
  /** Navigate to a sentence (margin tick clicks route through the shared fragment navigation). */
  onNavigateToSentence?: (sentenceId: number) => void;
  /** When set, sentences containing this pattern type get a subtle cluster outline. */
  clusterHighlightPatternType?: PatternType | null;
  /** Sentence IDs currently stale (awaiting re-analysis after rewrite). */
  staleSentenceIds?: Set<number>;
  /** Eligible hot sentences for left-bar highlight. */
  hotSentenceIds?: Set<number>;
  /** Sentences with cached rewrite suggestions. */
  suggestionReadyIds?: Set<number>;
  /** Sentences queued in background suggest batch. */
  suggestQueuedIds?: Set<number>;
  /** Pre-computed rewrite suggestions map (sentence_id -> suggestions). */
  rewriteSuggestions?: Map<number, RewriteSuggestion[]>;
  /** Called when user accepts an inline suggestion. */
  onApplySuggestion?: (sentenceId: number, newText: string) => void;
  /** Called when user dismisses suggestions for a sentence. */
  onDismissSuggestion?: (sentenceId: number) => void;
}

export function TiptapEditor({
  profile,
  selectedSentenceIds,
  focalSentenceId: focalSentenceIdProp = null,
  onSelectionChange,
  onSave,
  onTextChange,
  forcedContent,
  onEditorReady,
  onNavigateToSentence,
  clusterHighlightPatternType = null,
  staleSentenceIds,
  hotSentenceIds,
  suggestionReadyIds,
  suggestQueuedIds,
  rewriteSuggestions,
  onApplySuggestion,
  onDismissSuggestion,
}: Props) {
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // Stable callback refs — parent often passes inline handlers that would
  // otherwise retrigger effects and cause update-depth loops.
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;
  const stableSelectionCallback = useCallback<SelectionChangeCallback>(
    (ctx) => onSelectionChangeRef.current(ctx),
    [],
  );

  const onTextChangeRef = useRef(onTextChange);
  onTextChangeRef.current = onTextChange;

  const onNavigateToSentenceRef = useRef(onNavigateToSentence);
  onNavigateToSentenceRef.current = onNavigateToSentence;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: "Paste or write your text here...",
      }),
      CharacterCount,
      Typography.configure({
        oneHalf: false,
        oneQuarter: false,
        threeQuarters: false,
      }),
      // Underline is already provided by Typography; explicit registration causes duplicate-extension warning.
      HeatDecoration,
      SelectionBridge.configure({
        onSelectionChange: stableSelectionCallback,
      }),
    ],
    editorProps: {
      attributes: {
        class: "outline-none font-serif text-[1.05rem] leading-[1.9] min-h-[400px]",
      },
    },
    content: `<p>${LOCAL_SAMPLE_TEXT.split("\n\n").join("</p><p>")}</p>`,
    onUpdate({ editor }) {
      onTextChangeRef.current?.(exportEditorPlaintext(editor));
    },
  });

  useEffect(() => {
    onEditorReady?.(editor ?? null);
    return () => onEditorReady?.(null);
  }, [editor, onEditorReady]);

  const focalSentenceId = focalSentenceIdProp ?? null;

  const marginTicks = useMemo((): MarginTick[] => {
    if (!profile?.sentences?.length) return [];
    const list = profile.sentences;
    const n = list.length;
    return list.map((s, idx) => {
      const h = s.heat;
      let level: MarginTick["level"] = "low";
      if (h >= 7) level = "high";
      else if (h >= 4) level = "medium";
      return {
        id: `tick-${s.id}`,
        position: (idx + 0.5) / n,
        magnitude: Math.min(1, h / 10),
        level,
        label: `Sentence ${idx + 1} · heat ${h.toFixed(1)}`,
        onClick: () => onNavigateToSentenceRef.current?.(s.id),
      };
    });
  }, [profile]);

  // Pattern count for the status row
  const patternCount = useMemo(() => (profile ? collectPatterns(profile).length : 0), [profile]);

  // Fire initial onTextChange once when the editor instance is ready.
  useEffect(() => {
    if (editor) {
      onTextChangeRef.current?.(exportEditorPlaintext(editor));
    }
  }, [editor]);

  const forcedContentText = forcedContent?.text ?? null;

  // Handle forced content (e.g. loading a version)
  useEffect(() => {
    if (!editor || forcedContentText === null) return;
    if (analysisTextEquals(exportEditorPlaintext(editor), forcedContentText)) return;
    // Convert plaintext to paragraph HTML
    const html = forcedContentText
      .split(/\n\s*\n/)
      .filter((p) => p.trim())
      .map((p) => `<p>${p.replace(/\n/g, " ").trim()}</p>`)
      .join("");
    editor.commands.setContent(html);
    onTextChangeRef.current?.(exportEditorPlaintext(editor));
  }, [editor, forcedContentText]);

  // Debounced auto-save (2 seconds after typing stops)
  useEffect(() => {
    if (!editor || !onSave) return;
    const handler = () => {
      const text = exportEditorPlaintext(editor);
      if (text.trim()) onSave(text);
    };
    const timer = setTimeout(handler, 2000);
    return () => clearTimeout(timer);
  }, [editor?.state.doc, onSave]);

  // Update decorations when profile, selection, or stale set changes
  useEffect(() => {
    if (!editor) return;
    const tr = editor.state.tr.setMeta(heatDecorationKey, {
      profile,
      selectedSentenceIds,
      clusterHighlightPatternType,
      staleSentenceIds: staleSentenceIds ?? new Set(),
      hotSentenceIds: hotSentenceIds ?? new Set(),
      suggestionReadyIds: suggestionReadyIds ?? new Set(),
      suggestQueuedIds: suggestQueuedIds ?? new Set(),
    });
    editor.view.dispatch(tr);
  }, [
    editor,
    profile,
    selectedSentenceIds,
    clusterHighlightPatternType,
    staleSentenceIds,
    hotSentenceIds,
    suggestionReadyIds,
    suggestQueuedIds,
  ]);

  // Scroll to focal sentence in the editor
  useEffect(() => {
    if (!editor || focalSentenceId === null || !profile) return;
    const positions = buildSentencePositions(editor.state.doc, profile.sentences);
    const sp = positions.find((p) => p.sentence.id === focalSentenceId);
    if (sp) {
      const domAtPos = editor.view.domAtPos(sp.from);
      const node =
        domAtPos.node instanceof HTMLElement ? domAtPos.node : domAtPos.node.parentElement;
      node?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [editor, focalSentenceId, profile]);

  const wordCount = editor?.storage.characterCount?.words?.() ?? 0;
  const showMarginStrip = marginTicks.length > 0;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-card px-5 py-2">
        <span className="font-mono text-[0.65rem] text-muted-foreground">
          {wordCount} words
          {patternCount > 0 ? ` · ${patternCount} patterns` : ""}
        </span>
      </div>

      <EditorToolbar editor={editor} />

      {showMarginStrip ? (
        <div
          ref={editorContainerRef}
          className="relative flex min-h-0 flex-1 flex-row items-stretch overflow-y-auto"
        >
          <div className="relative w-3 shrink-0 self-stretch border-r border-border/60 bg-muted/20">
            <MarginTicks ticks={marginTicks} className="absolute inset-0" />
          </div>
          <div className="relative min-h-0 min-w-0 flex-1 bg-[#f6f8fb]">
            <EditorContent editor={editor} className="h-full tiptap-document" />
            <PatternTooltip editor={editor} containerRef={editorContainerRef} />
            <SuggestionContextMenu
              editor={editor}
              profile={profile}
              suggestions={rewriteSuggestions}
              focalSentenceId={focalSentenceId}
              onApply={onApplySuggestion}
              onDismiss={onDismissSuggestion}
              containerRef={editorContainerRef}
            />
          </div>
        </div>
      ) : (
        <div
          ref={editorContainerRef}
          className="relative min-h-0 flex-1 overflow-y-auto bg-[#f6f8fb]"
        >
          <EditorContent editor={editor} className="h-full tiptap-document" />
          <PatternTooltip editor={editor} containerRef={editorContainerRef} />
          <SuggestionContextMenu
            editor={editor}
            profile={profile}
            suggestions={rewriteSuggestions}
            focalSentenceId={focalSentenceId}
            onApply={onApplySuggestion}
            onDismiss={onDismissSuggestion}
            containerRef={editorContainerRef}
          />
        </div>
      )}
    </div>
  );
}

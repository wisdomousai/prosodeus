/**
 * Sentence suggestion menu — appears only for the actively selected sentence.
 * Positioned below the sentence in the editor (click-to-show lifecycle).
 * Right-click still opens the same menu at the cursor.
 */

import type { RewriteSuggestion, StylometricProfile } from "@prosodeus/core/browser";
import { isValidRewriteSuggestion } from "@prosodeus/core/browser";
import type { Editor } from "@tiptap/react";
import { Check, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { buildSentencePositions } from "./extensions/sentence-tracker";
import { PATTERN_LABELS } from "./utils/pattern-styles";

interface Props {
  editor: Editor | null;
  profile: StylometricProfile | null;
  suggestions?: Map<number, RewriteSuggestion[]>;
  focalSentenceId?: number | null;
  onApply?: (sentenceId: number, newText: string) => void;
  onDismiss?: (sentenceId: number) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

interface MenuState {
  visible: boolean;
  x: number;
  y: number;
  sentenceId: number;
  sentenceText: string;
  items: Array<{ text: string; rationale: string; patternType: string }>;
}

const CLOSED: MenuState = {
  visible: false,
  x: 0,
  y: 0,
  sentenceId: -1,
  sentenceText: "",
  items: [],
};

function flattenSuggestions(
  sentenceSuggestions: RewriteSuggestion[],
  sentenceText: string,
): MenuState["items"] {
  const items: MenuState["items"] = [];
  for (const s of sentenceSuggestions) {
    for (const alt of s.alternatives) {
      if (!isValidRewriteSuggestion(sentenceText, alt.text)) continue;
      items.push({
        text: alt.text,
        rationale: alt.rationale,
        patternType: s.pattern_type,
      });
    }
  }

  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.text)) return false;
    seen.add(item.text);
    return true;
  });
}

function positionBelowSentence(
  editor: Editor,
  profile: StylometricProfile,
  sentenceId: number,
  container: HTMLElement,
): { x: number; y: number } | null {
  const positions = buildSentencePositions(editor.state.doc, profile.sentences);
  const sp = positions.find((p) => p.sentence.id === sentenceId);
  if (!sp) return null;

  const coords = editor.view.coordsAtPos(sp.to);
  const containerRect = container.getBoundingClientRect();
  return {
    x: 24,
    y: coords.bottom - containerRect.top + container.scrollTop + 6,
  };
}

export function SuggestionContextMenu({
  editor,
  profile,
  suggestions,
  focalSentenceId = null,
  onApply,
  onDismiss,
  containerRef,
}: Props) {
  const [menu, setMenu] = useState<MenuState>(CLOSED);
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());
  const menuRef = useRef<HTMLDivElement>(null);
  const lastFocalRef = useRef<number | null>(null);
  const suggestionsRevisionRef = useRef("");

  const editorRef = useRef(editor);
  const profileRef = useRef(profile);
  const suggestionsRef = useRef(suggestions);
  const dismissedIdsRef = useRef(dismissedIds);
  editorRef.current = editor;
  profileRef.current = profile;
  suggestionsRef.current = suggestions;
  dismissedIdsRef.current = dismissedIds;

  const openForSentence = useCallback(
    (sentenceId: number, at?: { x: number; y: number }) => {
      const ed = editorRef.current;
      const prof = profileRef.current;
      const sugsMap = suggestionsRef.current;
      if (!ed || !prof || !sugsMap || dismissedIdsRef.current.has(sentenceId)) {
        setMenu(CLOSED);
        return;
      }

      const sentenceSuggestions = sugsMap.get(sentenceId);
      if (!sentenceSuggestions?.length) {
        setMenu(CLOSED);
        return;
      }

      const sp = prof.sentences.find((s) => s.id === sentenceId);
      if (!sp) {
        setMenu(CLOSED);
        return;
      }

      const items = flattenSuggestions(sentenceSuggestions, sp.text);
      if (items.length === 0) {
        setMenu(CLOSED);
        return;
      }

      const container = containerRef.current;
      if (!container) return;

      const pos = at ?? positionBelowSentence(ed, prof, sentenceId, container) ?? { x: 24, y: 24 };

      setMenu({
        visible: true,
        x: pos.x,
        y: pos.y,
        sentenceId,
        sentenceText: sp.text,
        items,
      });
    },
    [containerRef],
  );

  // Open only when the user selects a sentence (click-to-show).
  useEffect(() => {
    if (focalSentenceId === null) {
      setMenu(CLOSED);
      lastFocalRef.current = null;
      return;
    }

    if (focalSentenceId === lastFocalRef.current) return;
    lastFocalRef.current = focalSentenceId;
    openForSentence(focalSentenceId);
  }, [focalSentenceId, openForSentence]);

  // Reset dismissed set when suggestion content changes (new analysis).
  const suggestionsRevision = suggestions
    ? [...suggestions.entries()]
        .map(([id, sugs]) => `${id}:${sugs.map((s) => s.original).join("|")}`)
        .join(";")
    : "";

  useEffect(() => {
    if (suggestionsRevision === suggestionsRevisionRef.current) return;
    suggestionsRevisionRef.current = suggestionsRevision;
    setDismissedIds(new Set());
    if (!suggestions || suggestions.size === 0) setMenu(CLOSED);
  }, [suggestionsRevision, suggestions]);

  const handleContextMenu = useCallback(
    (e: MouseEvent) => {
      if (!editor || !profile || !suggestions || suggestions.size === 0) return;

      const pos = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
      if (!pos) return;

      const positions = buildSentencePositions(editor.state.doc, profile.sentences);
      const sp = positions.find((p) => pos.pos >= p.from && pos.pos <= p.to);
      if (!sp) return;

      const sentenceSuggestions = suggestions.get(sp.sentence.id);
      if (!sentenceSuggestions?.length) return;

      e.preventDefault();

      const container = containerRef.current;
      const containerRect = container?.getBoundingClientRect();
      const x = containerRect ? e.clientX - containerRect.left : e.clientX;
      const y = containerRect ? e.clientY - containerRect.top : e.clientY;

      openForSentence(sp.sentence.id, { x, y });
    },
    [editor, profile, suggestions, containerRef, openForSentence],
  );

  useEffect(() => {
    const editorDom = editor?.view?.dom;
    if (!editorDom) return;
    editorDom.addEventListener("contextmenu", handleContextMenu);
    return () => editorDom.removeEventListener("contextmenu", handleContextMenu);
  }, [editor, handleContextMenu]);

  useEffect(() => {
    if (!menu.visible) return;

    const close = () => setMenu(CLOSED);

    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) close();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };

    window.addEventListener("click", handleClick, true);
    window.addEventListener("keydown", handleKey);
    containerRef.current?.addEventListener("scroll", close);
    return () => {
      window.removeEventListener("click", handleClick, true);
      window.removeEventListener("keydown", handleKey);
      containerRef.current?.removeEventListener("scroll", close);
    };
  }, [menu.visible, containerRef]);

  if (!menu.visible) return null;

  return (
    <div
      ref={menuRef}
      className="absolute z-50 w-[calc(100%-3rem)] max-w-[520px] overflow-hidden rounded-md border border-border bg-popover shadow-lg animate-in fade-in-0 zoom-in-95"
      style={{ left: menu.x, top: menu.y }}
    >
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-1.5">
        <span className="font-mono text-[0.6rem] uppercase tracking-wider text-muted-foreground">
          Rewrite suggestions
        </span>
        <button
          type="button"
          className="flex size-6 items-center justify-center rounded hover:bg-muted"
          title="Dismiss for this sentence"
          onClick={() => {
            setDismissedIds((prev) => new Set(prev).add(menu.sentenceId));
            onDismiss?.(menu.sentenceId);
            setMenu(CLOSED);
          }}
        >
          <X className="size-3.5 text-muted-foreground" />
        </button>
      </div>
      <div className="max-h-[280px] overflow-y-auto">
        {menu.items.map((item, i) => (
          <button
            key={i}
            type="button"
            className="group flex w-full cursor-pointer items-start gap-2 border-b border-border/30 px-3 py-2.5 text-left transition-colors last:border-0 hover:bg-accent"
            onClick={() => {
              onApply?.(menu.sentenceId, item.text);
              setMenu(CLOSED);
            }}
          >
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-border">
              <Check className="size-3 text-emerald-600 opacity-0 transition group-hover:opacity-100" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm leading-snug">{item.text}</span>
              <span className="mt-0.5 block font-mono text-[0.6rem] text-muted-foreground">
                {PATTERN_LABELS[item.patternType] ?? item.patternType}
                {item.rationale ? ` · ${item.rationale}` : ""}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

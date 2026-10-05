import type { StylometricProfile } from "@prosodeus/core/browser";
import type { Editor } from "@tiptap/core";
import * as React from "react";
import { InspectStatusIcon } from "@/components/inspector/HotSpotsNav";
import { heatLevel } from "@/components/inspector/types";
import {
  resolveSentenceInspectState,
  type SentenceInspectContext,
} from "@/lib/sentence-inspect-state";
import { cn } from "@/lib/utils";

type HeadingItem = { pos: number; level: number; text: string };

const HEAT_DOT: Record<string, string> = {
  none: "bg-muted-foreground/40",
  low: "bg-amber-500",
  medium: "bg-orange-500",
  high: "bg-red-500",
};

function extractHeadings(editor: Editor | null): HeadingItem[] {
  if (!editor) return [];
  const out: HeadingItem[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "heading") {
      const text = node.textContent.trim().slice(0, 120);
      if (text) out.push({ pos, level: Number(node.attrs.level) || 1, text });
    }
  });
  return out;
}

type DocumentOutlineNavProps = {
  editor: Editor | null;
  profile: StylometricProfile | null;
  focalSentenceId: number | null;
  inspectCtx: Omit<SentenceInspectContext, "profile">;
  /** Navigate to a sentence (shared fragment navigation). */
  onNavigateToSentence: (sentenceId: number) => void;
  onClose?: () => void;
};

export function DocumentOutlineNav({
  editor,
  profile,
  focalSentenceId,
  inspectCtx,
  onNavigateToSentence,
  onClose,
}: DocumentOutlineNavProps) {
  const headings = React.useMemo(() => extractHeadings(editor), [editor, editor?.state.doc]);

  const scrollToHeading = React.useCallback(
    (pos: number) => {
      if (!editor) return;
      editor.chain().focus().setTextSelection(pos).scrollIntoView().run();
    },
    [editor],
  );

  return (
    <div className="flex h-full w-56 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
          Outline
        </span>
        {onClose ? (
          <button
            type="button"
            className="text-[11px] text-muted-foreground hover:text-foreground"
            onClick={onClose}
          >
            Close
          </button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <p className="mb-2 px-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Headings
        </p>
        {headings.length === 0 ? (
          <p className="px-1 text-xs text-muted-foreground">
            No headings yet. Use H1–H3 in the editor.
          </p>
        ) : (
          <ul className="mb-4 flex flex-col gap-0.5">
            {headings.map((h) => (
              <li key={h.pos}>
                <button
                  type="button"
                  onClick={() => scrollToHeading(h.pos)}
                  className={cn(
                    "w-full rounded px-2 py-1 text-left text-xs leading-snug hover:bg-accent",
                    h.level === 1 && "pl-2 font-medium",
                    h.level === 2 && "pl-3",
                    h.level >= 3 && "pl-4 text-muted-foreground",
                  )}
                >
                  {h.text}
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="mb-2 px-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Sentences
        </p>
        {!profile ? (
          <p className="px-1 text-xs text-muted-foreground">Run Analyze to map sentences.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {profile.sentences.map((s) => {
              const active = focalSentenceId === s.id;
              const snippet = s.text.trim().slice(0, 72) + (s.text.length > 72 ? "…" : "");
              const hasPatterns = s.classification.patterns.length > 0;
              const inspectState = resolveSentenceInspectState(s.id, { profile, ...inspectCtx });
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onNavigateToSentence(s.id)}
                    className={cn(
                      "flex w-full items-start gap-1.5 rounded px-2 py-1 text-left font-mono text-[10px] leading-snug hover:bg-accent",
                      active && "bg-ink-soft text-foreground",
                      inspectState === "stale" && "opacity-50",
                    )}
                  >
                    {hasPatterns ? (
                      <span
                        className={cn(
                          "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                          HEAT_DOT[heatLevel(s.heat)],
                        )}
                      />
                    ) : (
                      <span className="mt-1 h-1.5 w-1.5 shrink-0" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="text-muted-foreground">{s.id + 1}. </span>
                      {snippet}
                    </span>
                    {hasPatterns ? (
                      <span className="mt-0.5 shrink-0">
                        <InspectStatusIcon state={inspectState} />
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

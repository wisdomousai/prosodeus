import type { StylometricProfile } from "@prosodeus/core/browser";
import { Check, Clock, Loader2, Sparkles } from "lucide-react";
import * as React from "react";
import { heatLevel } from "@/components/inspector/types";
import {
  listInspectableHotSentences,
  resolveSentenceInspectState,
  type SentenceInspectContext,
  type SentenceInspectState,
} from "@/lib/sentence-inspect-state";
import { cn } from "@/lib/utils";

const HEAT_DOT: Record<string, string> = {
  none: "bg-muted-foreground/40",
  low: "bg-amber-500",
  medium: "bg-orange-500",
  high: "bg-red-500",
};

export function InspectStatusIcon({ state }: { state: SentenceInspectState }) {
  switch (state) {
    case "suggest_ready":
      return <Check className="h-3 w-3 text-[var(--moss)]" />;
    case "suggest_loading":
      return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />;
    case "suggest_queued":
      return <Clock className="h-3 w-3 text-muted-foreground" />;
    case "analyze_pending":
      return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />;
    case "stale":
      return <Sparkles className="h-3 w-3 text-muted-foreground" />;
    default:
      return null;
  }
}

type HotSpotsNavProps = {
  profile: StylometricProfile | null;
  focalSentenceId: number | null;
  inspectCtx: Omit<SentenceInspectContext, "profile">;
  /** Navigate to a sentence (shared fragment navigation). */
  onNavigate: (sentenceId: number) => void;
  maxVisible?: number;
};

export function HotSpotsNav({
  profile,
  focalSentenceId,
  inspectCtx,
  onNavigate,
  maxVisible = 8,
}: HotSpotsNavProps) {
  const hotSentences = React.useMemo(() => listInspectableHotSentences(profile), [profile]);

  if (hotSentences.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        Hot spots
      </p>
      <div className="flex flex-wrap gap-1.5">
        {hotSentences.slice(0, maxVisible).map((s) => {
          const state = resolveSentenceInspectState(s.id, {
            profile,
            ...inspectCtx,
          });
          const active = focalSentenceId === s.id;
          const snippet = s.text.trim().slice(0, 36) + (s.text.length > 36 ? "…" : "");
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onNavigate(s.id)}
              className={cn(
                "inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-left text-[11px] transition-colors",
                active
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              <span
                className={cn("h-1.5 w-1.5 shrink-0 rounded-full", HEAT_DOT[heatLevel(s.heat)])}
              />
              <span className="truncate font-mono">{snippet}</span>
              <InspectStatusIcon state={state} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function inspectStateForSentence(
  sentenceId: number | null,
  ctx: SentenceInspectContext,
): SentenceInspectState {
  if (sentenceId === null) return "no_profile";
  return resolveSentenceInspectState(sentenceId, ctx);
}

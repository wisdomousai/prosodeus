import { SearchX } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { PatternListItem } from "@/lib/api";
import { cn } from "@/lib/utils";
import { PatternLevelBadge } from "./PatternLevelBadge";
import { PatternScopeBadge } from "./PatternScopeBadge";

interface Props {
  patterns: PatternListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
}

export function PatternList({ patterns, selectedId, onSelect, loading }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="size-5 border-2 border-gold/40 border-t-gold rounded-full animate-spin" />
      </div>
    );
  }

  if (patterns.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-5 py-10 text-center">
        <div className="mb-3 flex size-10 items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground">
          <SearchX className="size-5" strokeWidth={1.75} />
        </div>
        <p className="text-sm font-medium text-foreground">No patterns match</p>
        <p className="mt-1 max-w-48 text-xs leading-relaxed text-muted-foreground">
          Clear the search or loosen the filters to return to the rule list.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div>
        {patterns.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={cn(
              "group w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-accent/70",
              selectedId === p.id && "bg-ink-soft hover:bg-ink-soft",
              !p.is_enabled && "opacity-45",
            )}
          >
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="flex min-w-0 gap-2.5">
                <PatternLevelBadge level={p.level} />
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {p.taxonomy_id}
                    </span>
                    <span className="truncate font-display text-[16px] leading-snug text-foreground">
                      {p.name}
                    </span>
                  </div>
                  <div className="mt-1 flex min-w-0 items-center gap-1.5">
                    <SeverityPill severity={p.severity ?? "medium"} />
                    <span className="truncate font-mono text-[10px] text-muted-foreground">
                      {p.pattern_id}
                    </span>
                  </div>
                </div>
              </div>
              <PatternScopeBadge scope={p.scope} />
            </div>
            {p.tags?.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5 pl-7">
                {p.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}

function SeverityPill({ severity }: { severity: string }) {
  const className =
    severity === "critical" || severity === "high"
      ? "bg-blood/10 text-blood"
      : severity === "low"
        ? "bg-moss/10 text-moss"
        : "bg-amber/10 text-amber";
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider",
        className,
      )}
    >
      {severity}
    </span>
  );
}

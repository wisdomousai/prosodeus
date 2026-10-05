import { ChevronRight, SlidersHorizontal } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";

const PATTERN_INFLUENCES = [
  { letter: "R", name: "Repeated opening cluster", override: "Vary rhythm" },
  { letter: "B", name: "Binary contrast", override: "Sparingly" },
  { letter: "S", name: "Strong expression stack", override: "Limit to 1" },
  { letter: "N", name: "Nominalization density", override: "Balanced" },
  { letter: "A", name: "Abstract claim stack", override: "Add evidence" },
  { letter: "M", name: "Mirrored clause rhythm", override: "Break mirrored" },
];

export function PatternInfluenceStrip() {
  return (
    <section className="mx-5 mb-0 shrink-0 rounded-t-md border border-b-0 border-border bg-card px-5 py-2.5 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Pattern rule influence
          </p>
          <p className="text-xs text-muted-foreground">
            Pattern rules adjust style defaults only when a specific pattern is detected.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
          <SlidersHorizontal className="size-3.5" />
          Manage pattern overrides
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        {PATTERN_INFLUENCES.map((pattern) => (
          <button
            key={pattern.name}
            type="button"
            className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-left transition-colors hover:border-primary/30 hover:bg-muted/40"
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-ink-soft font-mono text-[11px] font-semibold text-primary">
              {pattern.letter}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-xs font-semibold leading-tight text-foreground">
                {pattern.name}
              </span>
              <span className="truncate text-[11px] leading-tight text-muted-foreground">
                {pattern.override}
              </span>
            </span>
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
          </button>
        ))}
      </div>
    </section>
  );
}

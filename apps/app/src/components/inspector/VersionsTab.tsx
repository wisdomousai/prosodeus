import { GitCompare, Pin, RotateCcw } from "lucide-react";
import * as React from "react";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/shell/Panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VersionsTabProps } from "./types";

export function VersionsTab({
  versions,
  currentText,
  onLoadVersions,
  onPinVersion,
  onLoadVersion,
  onCompareVersions,
}: VersionsTabProps) {
  const [selected, setSelected] = React.useState<number[]>([]);

  React.useEffect(() => {
    onLoadVersions();
    // Intentionally only on mount per tab open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleSelect(id: number) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) {
        const second = prev[1];
        return second !== undefined ? [second, id] : [id];
      }
      return [...prev, id];
    });
  }

  function deltaFor(idx: number): string | null {
    const v = versions[idx];
    const prev = versions[idx + 1];
    if (!v || !prev) return null;
    const d = v.mean_heat - prev.mean_heat;
    if (Math.abs(d) < 0.05) return "·";
    return `${d > 0 ? "+" : ""}${d.toFixed(1)}`;
  }

  return (
    <div className="flex flex-col gap-3">
      <Panel>
        <PanelHeader>
          <PanelTitle>Versions</PanelTitle>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="default"
              className="h-7 gap-1.5"
              onClick={() => onPinVersion(currentText)}
              disabled={!currentText}
            >
              <Pin className="h-3.5 w-3.5" />
              Pin current
            </Button>
          </div>
        </PanelHeader>
        <PanelBody className="p-0">
          {versions.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground">
              No saved versions yet. Pin the current document to start a history.
            </div>
          ) : (
            <ul className="flex flex-col">
              {versions.map((v, i) => {
                const isSelected = selected.includes(v.id);
                const delta = deltaFor(i);
                return (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => toggleSelect(v.id)}
                      className={cn(
                        "flex w-full flex-col gap-1 border-b border-border px-3 py-2 text-left text-sm hover:bg-accent",
                        isSelected && "bg-ink-soft",
                        i === versions.length - 1 && "border-b-0",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{v.name ?? `Version ${v.id}`}</span>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          {v.source}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
                        <span>{new Date(v.created_at).toLocaleString()}</span>
                        <span>·</span>
                        <span>{v.word_count}w</span>
                        <span>·</span>
                        <span>heat {v.mean_heat.toFixed(1)}</span>
                        {delta ? (
                          <>
                            <span>·</span>
                            <span>Δ {delta}</span>
                          </>
                        ) : null}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </PanelBody>
      </Panel>

      {versions.length > 0 ? (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5"
            disabled={selected.length !== 1}
            onClick={() => selected[0] != null && onLoadVersion(selected[0])}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restore
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5"
            disabled={selected.length !== 2}
            onClick={() => {
              const [a, b] = selected;
              if (a !== undefined && b !== undefined) onCompareVersions(a, b);
            }}
          >
            <GitCompare className="h-3.5 w-3.5" />
            Compare
          </Button>
          <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {selected.length === 0
              ? "Pick one to restore, two to compare"
              : `${selected.length} selected`}
          </span>
        </div>
      ) : null}
    </div>
  );
}

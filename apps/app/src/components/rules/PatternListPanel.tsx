import { PatternList } from "@/components/patterns/PatternList";
import type { PatternListItem } from "@/lib/api";

interface Props {
  patterns: PatternListItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  loading: boolean;
}

export function PatternListPanel({ patterns, selectedId, onSelect, loading }: Props) {
  return (
    <div className="w-80 border-r border-border flex flex-col shrink-0 bg-card/35">
      <PatternList
        patterns={patterns}
        selectedId={selectedId}
        onSelect={onSelect}
        loading={loading}
      />
      {!loading && (
        <div className="border-t border-border px-4 py-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {patterns.length} patterns
          </span>
        </div>
      )}
    </div>
  );
}

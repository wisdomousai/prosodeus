import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STATUS_CHIPS: Array<{ value: string; label: string; color: string }> = [
  { value: "draft", label: "Draft", color: "bg-muted-foreground" },
  { value: "review", label: "Review", color: "bg-gold" },
  { value: "final", label: "Final", color: "bg-emerald-500" },
  { value: "archived", label: "Archived", color: "bg-muted-foreground/50" },
];

const HEAT_CHIPS: Array<{ value: string; label: string; min?: number; max?: number }> = [
  { value: "cool", label: "Cool (<3)", max: 3 },
  { value: "warm", label: "Warm (3-6)", min: 3, max: 6 },
  { value: "hot", label: "Hot (>6)", min: 6 },
];

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "updated_at", label: "Last updated" },
  { value: "created_at", label: "Created" },
  { value: "title", label: "Title" },
  { value: "mean_heat", label: "Heat" },
  { value: "word_count", label: "Word count" },
  { value: "due_date", label: "Due date" },
];

export interface FilterState {
  statuses: string[];
  tags: string[];
  heat: string | null; // "cool" | "warm" | "hot"
  sort: string;
  order: "asc" | "desc";
}

interface Props {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  availableTags: string[];
}

export function LibraryFilters({ filters, onChange, availableTags }: Props) {
  const hasActiveFilters =
    filters.statuses.length > 0 || filters.tags.length > 0 || filters.heat !== null;

  const toggleStatus = (status: string) => {
    const next = filters.statuses.includes(status)
      ? filters.statuses.filter((s) => s !== status)
      : [...filters.statuses, status];
    onChange({ ...filters, statuses: next });
  };

  const toggleTag = (tag: string) => {
    const next = filters.tags.includes(tag)
      ? filters.tags.filter((t) => t !== tag)
      : [...filters.tags, tag];
    onChange({ ...filters, tags: next });
  };

  const toggleHeat = (heat: string) => {
    onChange({ ...filters, heat: filters.heat === heat ? null : heat });
  };

  const clearAll = () => {
    onChange({ ...filters, statuses: [], tags: [], heat: null });
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-1">
      {/* Status chips */}
      {STATUS_CHIPS.map((chip) => {
        const active = filters.statuses.includes(chip.value);
        return (
          <button
            key={chip.value}
            onClick={() => toggleStatus(chip.value)}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[0.6rem] transition-colors cursor-pointer border ${
              active
                ? "border-primary/40 bg-primary/10 text-foreground"
                : "border-border bg-transparent text-muted-foreground hover:bg-secondary"
            }`}
          >
            <span className={`size-1.5 rounded-full ${chip.color}`} />
            {chip.label}
          </button>
        );
      })}

      {/* Heat chips */}
      {HEAT_CHIPS.map((chip) => {
        const active = filters.heat === chip.value;
        return (
          <button
            key={chip.value}
            onClick={() => toggleHeat(chip.value)}
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[0.6rem] transition-colors cursor-pointer border ${
              active
                ? "border-primary/40 bg-primary/10 text-foreground"
                : "border-border bg-transparent text-muted-foreground hover:bg-secondary"
            }`}
          >
            {chip.label}
          </button>
        );
      })}

      {/* Tag chips (show first 8) */}
      {availableTags.slice(0, 8).map((tag) => {
        const active = filters.tags.includes(tag);
        return (
          <button
            key={tag}
            onClick={() => toggleTag(tag)}
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[0.6rem] transition-colors cursor-pointer border ${
              active
                ? "border-gold/40 bg-gold/10 text-foreground"
                : "border-border bg-transparent text-muted-foreground hover:bg-secondary"
            }`}
          >
            #{tag}
          </button>
        );
      })}

      {/* Sort */}
      <select
        value={`${filters.sort}:${filters.order}`}
        onChange={(e) => {
          const [sort, order] = e.target.value.split(":");
          onChange({ ...filters, sort: sort!, order: order as "asc" | "desc" });
        }}
        className="ml-auto rounded-md border border-border bg-transparent px-2 py-0.5 font-mono text-[0.6rem] text-muted-foreground outline-none cursor-pointer"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={`${opt.value}:desc`} value={`${opt.value}:desc`}>
            {opt.label} ↓
          </option>
        ))}
        {SORT_OPTIONS.map((opt) => (
          <option key={`${opt.value}:asc`} value={`${opt.value}:asc`}>
            {opt.label} ↑
          </option>
        ))}
      </select>

      {/* Clear all */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAll}
          className="h-5 px-1.5 font-mono text-[0.55rem] text-muted-foreground"
        >
          <X className="size-3 mr-0.5" />
          Clear
        </Button>
      )}
    </div>
  );
}

/** Convert FilterState to API query params */
export function filtersToParams(filters: FilterState): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.statuses.length > 0) params.status = filters.statuses.join(",");
  if (filters.tags.length > 0) params.tags = filters.tags.join(",");
  if (filters.heat) {
    const chip = HEAT_CHIPS.find((c) => c.value === filters.heat);
    if (chip?.min !== undefined) params.heat_min = String(chip.min);
    if (chip?.max !== undefined) params.heat_max = String(chip.max);
  }
  params.sort = filters.sort;
  params.order = filters.order;
  return params;
}

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PatternLevel, PatternScope } from "@/lib/api";

export interface PatternFilterState {
  search: string;
  level: PatternLevel | "all";
  scope: PatternScope | "all";
}

interface Props {
  filters: PatternFilterState;
  onFiltersChange: (filters: PatternFilterState) => void;
}

export function PatternFilters({ filters, onFiltersChange }: Props) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <div className="relative min-w-[220px] flex-1">
        <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search patterns"
          value={filters.search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          className="h-8 rounded-md border-border/70 bg-card pl-8 font-mono text-xs"
        />
      </div>
      <Select
        value={filters.level}
        onValueChange={(v) =>
          onFiltersChange({ ...filters, level: v as PatternFilterState["level"] })
        }
      >
        <SelectTrigger className="h-8 w-[116px] rounded-md bg-card font-mono text-[11px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" className="text-xs font-mono">
            All levels
          </SelectItem>
          <SelectItem value="lexical" className="text-xs font-mono">
            Lexical
          </SelectItem>
          <SelectItem value="sentence" className="text-xs font-mono">
            Sentence
          </SelectItem>
          <SelectItem value="paragraph" className="text-xs font-mono">
            Paragraph
          </SelectItem>
          <SelectItem value="document" className="text-xs font-mono">
            Document
          </SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={filters.scope}
        onValueChange={(v) =>
          onFiltersChange({ ...filters, scope: v as PatternFilterState["scope"] })
        }
      >
        <SelectTrigger className="h-8 w-[96px] rounded-md bg-card font-mono text-[11px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" className="text-xs font-mono">
            All
          </SelectItem>
          <SelectItem value="platform" className="text-xs font-mono">
            Core
          </SelectItem>
          <SelectItem value="user" className="text-xs font-mono">
            User
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

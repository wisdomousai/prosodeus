import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PatternScope } from "@/lib/api";
import { exportPatterns } from "@/lib/api";

interface Props {
  currentScope: PatternScope | "all";
}

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function PatternExportMenu({ currentScope }: Props) {
  const date = new Date().toISOString().slice(0, 10);

  const handleExport = async (scope?: string) => {
    const data = await exportPatterns(scope ? { scope } : undefined);
    const label = scope ?? "all";
    downloadJson(data, `prosodeus-patterns-${label}-${date}.json`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 font-mono text-[11px]">
          <Download className="size-3.5" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport()} className="text-xs font-mono">
          Export All
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("platform")} className="text-xs font-mono">
          Export Core Only
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("user")} className="text-xs font-mono">
          Export My Patterns
        </DropdownMenuItem>
        {currentScope !== "all" && (
          <DropdownMenuItem
            onClick={() => handleExport(currentScope)}
            className="text-xs font-mono"
          >
            Export Filtered
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

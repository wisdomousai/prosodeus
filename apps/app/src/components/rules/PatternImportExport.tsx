import { Plus, Upload } from "lucide-react";
import { PatternExportMenu } from "@/components/patterns/PatternExportMenu";
import { PatternImportDialog } from "@/components/patterns/PatternImportDialog";
import { PatternSuggestPopover } from "@/components/patterns/PatternSuggestPopover";
import { Button } from "@/components/ui/button";
import type { PatternCreateRequest, PatternScope } from "@/lib/api";

interface Props {
  importOpen: boolean;
  onImportOpenChange: (open: boolean) => void;
  onImported: () => void;
  currentScope: PatternScope | "all";
  onSuggested: (draft: PatternCreateRequest) => void;
  onCreate: () => void;
  usingSamples: boolean;
}

export function PatternImportExport({
  importOpen,
  onImportOpenChange,
  onImported,
  currentScope,
  onSuggested,
  onCreate,
  usingSamples,
}: Props) {
  return (
    <>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {usingSamples ? (
          <span className="rounded-md border border-amber/40 bg-amber/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-amber">
            Sample data — API unavailable
          </span>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onImportOpenChange(true)}
          disabled={usingSamples}
          className="h-8 gap-1.5 font-mono text-[11px]"
        >
          <Upload className="size-3.5" />
          Import
        </Button>
        <PatternExportMenu currentScope={currentScope} />
        {!usingSamples ? <PatternSuggestPopover onSuggested={onSuggested} /> : null}
        <Button
          size="sm"
          onClick={onCreate}
          disabled={usingSamples}
          className="h-8 gap-1.5 font-mono text-[11px]"
        >
          <Plus className="size-3.5" />
          New pattern
        </Button>
      </div>

      <PatternImportDialog
        open={importOpen}
        onOpenChange={onImportOpenChange}
        onImported={onImported}
      />
    </>
  );
}

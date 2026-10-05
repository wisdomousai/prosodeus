import { Download, Upload } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";

type StyleWorkbenchToolbarProps = {
  copied: boolean;
  onImport: () => void;
  onExport: () => void;
};

export function StyleWorkbenchToolbar({ copied, onImport, onExport }: StyleWorkbenchToolbarProps) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 gap-2"
        title="Paste imported style details into the draft form."
        onClick={onImport}
      >
        <Upload className="size-4" />
        Import
      </Button>
      <Button type="button" variant="outline" size="sm" className="h-9 gap-2" onClick={onExport}>
        <Download className="size-4" />
        {copied ? "Copied" : "Export"}
      </Button>
    </div>
  );
}

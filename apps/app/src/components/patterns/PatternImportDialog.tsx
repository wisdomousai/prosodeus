import { AlertTriangle, Check, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { PatternCreateRequest, PatternImportResult } from "@/lib/api";
import { importPatterns } from "@/lib/api";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

export function PatternImportDialog({ open, onOpenChange, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [patterns, setPatterns] = useState<PatternCreateRequest[]>([]);
  const [preview, setPreview] = useState<PatternImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"upload" | "preview">("upload");

  const reset = () => {
    setPatterns([]);
    setPreview(null);
    setError(null);
    setStep("upload");
  };

  const handleFile = async (file: File) => {
    setError(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const items: PatternCreateRequest[] = Array.isArray(data) ? data : (data.patterns ?? []);
      if (items.length === 0) {
        setError("No patterns found in file");
        return;
      }
      setPatterns(items);

      // Dry run
      setLoading(true);
      const result = await importPatterns({ patterns: items, dry_run: true });
      setPreview(result);
      setStep("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse file");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    setLoading(true);
    try {
      await importPatterns({ patterns });
      onImported();
      onOpenChange(false);
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm tracking-wider">Import Patterns</DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-3">
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) handleFile(file);
              }}
              className="border-2 border-dashed border-border/50 rounded-lg p-8 text-center cursor-pointer hover:border-gold/40 transition-colors"
            >
              <Upload className="size-6 mx-auto mb-2 text-muted-foreground" />
              <p className="text-xs font-mono text-muted-foreground">
                Drop .json file here or click to browse
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            {error && <p className="text-xs font-mono text-destructive">{error}</p>}
            {loading && (
              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                <div className="size-3 border-2 border-gold/40 border-t-gold rounded-full animate-spin" />
                Validating...
              </div>
            )}
          </div>
        )}

        {step === "preview" && preview && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-green-500/10 rounded px-3 py-2 text-center">
                <Check className="size-4 mx-auto text-green-500 mb-1" />
                <div className="text-lg font-mono text-green-500">{preview.valid}</div>
                <div className="text-[0.55rem] font-mono text-muted-foreground">Valid</div>
              </div>
              <div className="bg-yellow-500/10 rounded px-3 py-2 text-center">
                <AlertTriangle className="size-4 mx-auto text-yellow-500 mb-1" />
                <div className="text-lg font-mono text-yellow-500">{preview.conflicts.length}</div>
                <div className="text-[0.55rem] font-mono text-muted-foreground">Conflicts</div>
              </div>
              <div className="bg-destructive/10 rounded px-3 py-2 text-center">
                <X className="size-4 mx-auto text-destructive mb-1" />
                <div className="text-lg font-mono text-destructive">{preview.invalid}</div>
                <div className="text-[0.55rem] font-mono text-muted-foreground">Invalid</div>
              </div>
            </div>

            {preview.conflicts.length > 0 && (
              <ScrollArea className="max-h-32">
                <div className="space-y-1">
                  {preview.conflicts.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs font-mono">
                      <AlertTriangle className="size-3 text-yellow-500 shrink-0" />
                      <span className="text-card-foreground">{c.pattern_id}</span>
                      <span className="text-muted-foreground">— {c.reason}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {error && <p className="text-xs font-mono text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          {step === "preview" && (
            <>
              <Button variant="ghost" onClick={reset} className="font-mono text-xs">
                Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={loading || preview?.valid === 0}
                className="font-mono text-xs"
              >
                {loading ? "Importing..." : `Import ${preview?.valid ?? 0} Patterns`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

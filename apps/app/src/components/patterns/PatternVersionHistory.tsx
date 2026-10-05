import { History, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { PatternVersion } from "@/lib/api";
import { getPatternVersions, revertPattern } from "@/lib/api";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patternId: string;
  onReverted: () => void;
}

export function PatternVersionHistory({ open, onOpenChange, patternId, onReverted }: Props) {
  const [versions, setVersions] = useState<PatternVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [reverting, setReverting] = useState<number | null>(null);

  useEffect(() => {
    if (open && patternId && !patternId.startsWith("platform:")) {
      setLoading(true);
      getPatternVersions(patternId)
        .then((data) => setVersions(data.versions))
        .catch(() => setVersions([]))
        .finally(() => setLoading(false));
    }
  }, [open, patternId]);

  const handleRevert = async (versionNumber: number) => {
    setReverting(versionNumber);
    try {
      await revertPattern(patternId, versionNumber);
      onReverted();
      onOpenChange(false);
    } finally {
      setReverting(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-sm p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="font-mono text-sm tracking-wider flex items-center gap-2">
            <History className="size-4" />
            Version History
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 px-4 pb-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="size-5 border-2 border-gold/40 border-t-gold rounded-full animate-spin" />
            </div>
          ) : versions.length === 0 ? (
            <p className="text-xs font-mono text-muted-foreground py-8 text-center">
              No version history
            </p>
          ) : (
            <div className="space-y-0">
              {versions.map((v, i) => (
                <div
                  key={v.version_number}
                  className="relative pl-5 pb-4 border-l border-border/40 last:border-l-0"
                >
                  {/* Timeline dot */}
                  <div
                    className={`absolute left-[-3px] top-1 size-1.5 rounded-full ${i === 0 ? "bg-gold" : "bg-muted-foreground/40"}`}
                  />

                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono font-bold text-card-foreground">
                          v{v.version_number}
                        </span>
                        <span className="text-[0.55rem] font-mono text-muted-foreground">
                          {new Date(v.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {v.change_summary && (
                        <p className="text-[0.6rem] text-muted-foreground mt-0.5">
                          {v.change_summary}
                        </p>
                      )}
                    </div>
                    {i > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevert(v.version_number)}
                        disabled={reverting !== null}
                        className="h-5 px-1.5 text-[0.55rem] font-mono shrink-0"
                      >
                        <RotateCcw className="size-2.5 mr-0.5" />
                        {reverting === v.version_number ? "..." : "Revert"}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

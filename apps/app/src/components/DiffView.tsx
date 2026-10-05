import type { StylometricProfile } from "@prosodeus/core/browser";
import { X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { InlineDiff } from "./diff/InlineDiff";
import { ScoreDeltaDiff } from "./diff/ScoreDeltaDiff";
import { SideBySideDiff } from "./diff/SideBySideDiff";

type DiffMode = "side-by-side" | "inline" | "score";

interface Props {
  before: string;
  after: string;
  profileA?: StylometricProfile | null;
  profileB?: StylometricProfile | null;
  onClose: () => void;
}

export function DiffView({ before, after, profileA, profileB, onClose }: Props) {
  const [mode, setMode] = useState<DiffMode>("side-by-side");

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0">
        <p className="font-mono text-[0.7rem] text-muted-foreground uppercase tracking-wider">
          Version Diff
        </p>
        <div className="flex gap-1 ml-4">
          {(["side-by-side", "inline", "score"] as DiffMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-2 py-1 rounded font-mono text-[0.65rem] transition-colors ${
                mode === m ? "bg-gold/20 text-gold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "side-by-side" ? "Side by Side" : m === "inline" ? "Inline" : "Score + Diff"}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="ml-auto">
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {mode === "side-by-side" && <SideBySideDiff before={before} after={after} />}
        {mode === "inline" && <InlineDiff before={before} after={after} />}
        {mode === "score" && (
          <ScoreDeltaDiff
            before={before}
            after={after}
            profileA={profileA ?? null}
            profileB={profileB ?? null}
          />
        )}
      </div>
    </div>
  );
}

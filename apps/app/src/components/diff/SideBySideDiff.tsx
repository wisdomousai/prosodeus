import { computeLineDiff } from "@/lib/diff-utils";

interface Props {
  before: string;
  after: string;
}

export function SideBySideDiff({ before, after }: Props) {
  const segments = computeLineDiff(before, after);

  const leftLines: Array<{ text: string; type: "removed" | "unchanged" }> = [];
  const rightLines: Array<{ text: string; type: "added" | "unchanged" }> = [];

  for (const seg of segments) {
    const lines = seg.value.split("\n").filter((_, i, arr) => i < arr.length - 1 || _ !== "");
    if (seg.removed) {
      for (const line of lines) leftLines.push({ text: line, type: "removed" });
    } else if (seg.added) {
      for (const line of lines) rightLines.push({ text: line, type: "added" });
    } else {
      for (const line of lines) {
        leftLines.push({ text: line, type: "unchanged" });
        rightLines.push({ text: line, type: "unchanged" });
      }
    }
  }

  const maxLen = Math.max(leftLines.length, rightLines.length);

  return (
    <div className="grid grid-cols-2 gap-px bg-border">
      <div className="bg-background p-3">
        <p className="font-mono text-[0.6rem] text-muted-foreground uppercase tracking-widest mb-3">
          Before
        </p>
        <div className="font-serif text-sm leading-relaxed space-y-0.5">
          {leftLines.map((line, i) => (
            <div
              key={i}
              className={
                line.type === "removed" ? "bg-blood-dim text-blood-bright px-1 rounded" : "px-1"
              }
            >
              {line.text || "\u00A0"}
            </div>
          ))}
        </div>
      </div>
      <div className="bg-background p-3">
        <p className="font-mono text-[0.6rem] text-muted-foreground uppercase tracking-widest mb-3">
          After
        </p>
        <div className="font-serif text-sm leading-relaxed space-y-0.5">
          {rightLines.map((line, i) => (
            <div
              key={i}
              className={line.type === "added" ? "bg-olive-dim text-olive px-1 rounded" : "px-1"}
            >
              {line.text || "\u00A0"}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

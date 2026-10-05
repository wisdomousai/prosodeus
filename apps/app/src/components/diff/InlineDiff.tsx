import { computeWordDiff } from "@/lib/diff-utils";

interface Props {
  before: string;
  after: string;
}

export function InlineDiff({ before, after }: Props) {
  const segments = computeWordDiff(before, after);

  return (
    <div className="font-serif text-sm leading-relaxed whitespace-pre-wrap">
      {segments.map((seg, i) => {
        const value = needsVisualBoundary(segments, i) ? `${seg.value} ` : seg.value;
        if (seg.removed) {
          return (
            <span key={i} className="bg-blood-dim text-blood-bright line-through">
              {value}
            </span>
          );
        }
        if (seg.added) {
          return (
            <span
              key={i}
              className="underline decoration-olive decoration-2 underline-offset-2 text-foreground"
            >
              {value}
            </span>
          );
        }
        return <span key={i}>{value}</span>;
      })}
    </div>
  );
}

function needsVisualBoundary(
  segments: Array<{ value: string; added?: boolean; removed?: boolean }>,
  index: number,
): boolean {
  const current = segments[index];
  const next = segments[index + 1];
  if (!current || !next) return false;
  if (!(current.added || current.removed) || !(next.added || next.removed)) {
    return false;
  }
  if (/\s$/.test(current.value) || /^\s/.test(next.value)) return false;
  return true;
}

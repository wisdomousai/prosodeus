import type { StylometricProfile } from "@prosodeus/core/browser";
import { computeScoreDelta } from "@/lib/diff-utils";
import { InlineDiff } from "./InlineDiff";

interface Props {
  before: string;
  after: string;
  profileA: StylometricProfile | null;
  profileB: StylometricProfile | null;
}

export function ScoreDeltaDiff({ before, after, profileA, profileB }: Props) {
  const deltas = profileA && profileB ? computeScoreDelta(profileA, profileB) : [];

  return (
    <div className="space-y-6">
      {deltas.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {deltas.map((d) => (
            <div key={d.metric} className="border border-border rounded p-3">
              <p className="font-mono text-[0.6rem] text-muted-foreground uppercase tracking-wider mb-1">
                {d.metric}
              </p>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-lg text-card-foreground">
                  {d.after.toFixed(
                    d.metric === "Word Count" || d.metric === "Sentence Count" ? 0 : 2,
                  )}
                </span>
                <span
                  className={`font-mono text-xs ${d.improved ? "text-olive" : d.delta === 0 ? "text-muted-foreground" : "text-blood-bright"}`}
                >
                  {d.delta > 0 ? "+" : ""}
                  {d.delta.toFixed(2)}
                </span>
              </div>
              <p className="font-mono text-[0.55rem] text-muted-foreground mt-0.5">
                was{" "}
                {d.before.toFixed(
                  d.metric === "Word Count" || d.metric === "Sentence Count" ? 0 : 2,
                )}
              </p>
            </div>
          ))}
        </div>
      )}

      <div>
        <p className="font-mono text-[0.6rem] text-muted-foreground uppercase tracking-widest mb-3">
          Text Changes
        </p>
        <InlineDiff before={before} after={after} />
      </div>
    </div>
  );
}

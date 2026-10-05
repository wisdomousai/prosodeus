import type { PatternScope } from "@/lib/api";

export function PatternScopeBadge({ scope }: { scope: PatternScope }) {
  if (scope === "platform") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[0.5rem] font-mono uppercase tracking-wider bg-muted-foreground/10 text-muted-foreground">
        core
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[0.5rem] font-mono uppercase tracking-wider bg-gold/10 text-gold">
      user
    </span>
  );
}

import type { RewriteConstraints } from "@prosodeus/shared/browser";
import { BarChart3, CheckCircle2, Layers3, Repeat2, Shield, Sparkle, Target } from "lucide-react";
import type * as React from "react";
import { type EffectivePolicyRow, effectivePolicyRows } from "@/components/policy/rewrite-policy";

const ICONS = [Shield, Target, BarChart3, Sparkle, Repeat2, Layers3, CheckCircle2];

type StylePolicyPreviewProps = {
  policy: RewriteConstraints;
};

export function StylePolicyPreview({ policy }: StylePolicyPreviewProps) {
  const rows = effectivePolicyRows(policy, false);

  return (
    <aside className="w-[20rem] shrink-0 overflow-y-auto rounded-md border border-border bg-card px-5 py-5 shadow-sm">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        Policy preview
      </p>
      <div className="mt-5 space-y-4">
        {rows.map((row, index) => (
          <PreviewRow key={row.label} row={row} icon={ICONS[index] ?? CheckCircle2} />
        ))}
      </div>
      <div className="mt-8 rounded-md border border-border bg-background px-4 py-3">
        <p className="text-xs leading-relaxed text-muted-foreground">
          These are style defaults. Pattern overrides apply when detected, and rewrite run settings
          apply last.
        </p>
      </div>
    </aside>
  );
}

function PreviewRow({
  row,
  icon: Icon,
}: {
  row: EffectivePolicyRow;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-4">
      <span className="flex size-8 items-center justify-center rounded-md bg-muted text-primary">
        <Icon className="size-4" strokeWidth={1.8} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{row.label}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {row.value} — {row.description}
        </p>
      </div>
    </div>
  );
}

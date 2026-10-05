import type { PatternLevel } from "@/lib/api";

const LEVEL_STYLES: Record<PatternLevel, { bg: string; label: string }> = {
  lexical: { bg: "bg-gold/20 text-gold", label: "L" },
  sentence: { bg: "bg-[#7ec8e3]/20 text-[#7ec8e3]", label: "S" },
  paragraph: { bg: "bg-[#c084fc]/20 text-[#c084fc]", label: "P" },
  document: { bg: "bg-olive/20 text-olive", label: "D" },
};

export function PatternLevelBadge({ level }: { level: PatternLevel }) {
  const style = LEVEL_STYLES[level] ?? LEVEL_STYLES.lexical;
  return (
    <span
      className={`inline-flex items-center justify-center size-5 rounded text-[0.55rem] font-mono font-bold shrink-0 ${style.bg}`}
    >
      {style.label}
    </span>
  );
}

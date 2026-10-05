import type {
  ClassifiedSentence,
  DetectedPattern,
  PatternType,
  StylometricProfile,
} from "@prosodeus/core/browser";
import { getPattern } from "@prosodeus/core/browser";
import type { ProgressEvent, Version } from "@prosodeus/shared/browser";

export type HeatLevel = "none" | "low" | "medium" | "high";

export function heatLevel(score: number | undefined | null): HeatLevel {
  if (score === undefined || score === null || score < 1) return "none";
  if (score < 3) return "low";
  if (score < 6) return "medium";
  return "high";
}

export type AnalyzeTabProps = {
  profile: StylometricProfile | null;
  focalSentenceId: number | null;
  /** Name of the selected style guide, if any. */
  styleLabel?: string;
  onNavigate: (direction: "prev" | "next") => void;
  onRewriteSentence: (id: number) => void;
  onPinVersion: () => void;
  onCopyConstraints: () => void;
  selectedClusterType: PatternType | null;
  onSelectClusterType: (type: PatternType | null) => void;
  onRewriteCluster: (cluster: PatternCluster) => void;
  onCopyClusterConstraints: (cluster: PatternCluster) => void;
  isAnalyzing?: boolean;
  analysisProgress?: ProgressEvent | null;
  visibleSentenceIds?: Set<number>;
};

export type VersionsTabProps = {
  versions: Version[];
  currentText: string;
  onLoadVersions: () => void;
  onPinVersion: (content: string, name?: string) => void;
  onLoadVersion: (id: number) => void;
  onCompareVersions: (a: number, b: number) => void;
};

export type PatternCluster = {
  type: PatternType;
  count: number;
  density: number;
  sentences: number[];
};

export function buildPatternClusters(profile: StylometricProfile | null): PatternCluster[] {
  if (!profile) return [];
  const map = new Map<PatternType, PatternCluster>();
  for (const s of profile.sentences) {
    const patterns: DetectedPattern[] = s.classification.patterns ?? [];
    for (const p of patterns) {
      const existing = map.get(p.type);
      if (existing) {
        existing.count += 1;
        existing.sentences.push(s.id);
      } else {
        map.set(p.type, { type: p.type, count: 1, density: 0, sentences: [s.id] });
      }
    }
  }
  const total = profile.sentences.length || 1;
  for (const cluster of map.values()) {
    cluster.density = cluster.count / total;
  }
  return Array.from(map.values()).sort((a, b) => b.density - a.density);
}

export function selectedSentenceOf(
  profile: StylometricProfile | null,
  id: number | null,
): ClassifiedSentence | null {
  if (!profile || id === null) return null;
  return profile.sentences.find((s) => s.id === id) ?? null;
}

/** Human-readable label for a pattern type. */
export function patternLabel(type: PatternType): string {
  return getPattern(type)?.name ?? type.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

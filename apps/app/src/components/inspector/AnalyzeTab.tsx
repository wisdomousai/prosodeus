import {
  AnalysisEmptyState,
  AnalysisProgress,
  DensityOverviewCard,
  PatternClusterCard,
  PatternEvidenceCard,
  RewriteSetupPreviewCard,
  SelectedSentenceCard,
} from "./AnalyzePanels";
import { type AnalyzeTabProps, buildPatternClusters, selectedSentenceOf } from "./types";

export function AnalyzeTab({
  profile,
  focalSentenceId,
  styleLabel,
  onNavigate,
  onRewriteSentence,
  onPinVersion,
  onCopyConstraints,
  selectedClusterType,
  onSelectClusterType,
  onRewriteCluster,
  onCopyClusterConstraints,
  isAnalyzing = false,
  analysisProgress = null,
  visibleSentenceIds,
}: AnalyzeTabProps) {
  if (!profile) {
    return <AnalysisEmptyState isAnalyzing={isAnalyzing} progress={analysisProgress} />;
  }

  const sentence = selectedSentenceOf(profile, focalSentenceId);
  const clusters = buildPatternClusters(profile);

  return (
    <div className="flex flex-col gap-4">
      <AnalysisProgress isAnalyzing={isAnalyzing} progress={analysisProgress} />
      <SelectedSentenceCard number={1} sentence={sentence} onNavigate={onNavigate} />
      <PatternEvidenceCard number={2} sentence={sentence} />
      <RewriteSetupPreviewCard
        number={3}
        sentence={sentence}
        styleLabel={styleLabel}
        onRewriteSentence={onRewriteSentence}
        onCopyConstraints={onCopyConstraints}
        onPinVersion={onPinVersion}
      />
      <DensityOverviewCard number={4} profile={profile} visibleSentenceIds={visibleSentenceIds} />
      <PatternClusterCard
        number={5}
        clusters={clusters}
        selectedClusterType={selectedClusterType}
        onSelectClusterType={onSelectClusterType}
        onRewriteCluster={onRewriteCluster}
        onCopyClusterConstraints={onCopyClusterConstraints}
        visibleSentenceIds={visibleSentenceIds}
      />
    </div>
  );
}

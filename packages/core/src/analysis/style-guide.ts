import { computeAutocorrelation, computeDeviceEntropy, countWords } from "../text/math.ts";
import type { ClassifiedSentence, StyleGuide, StyleGuideDelta } from "../types.ts";

// ─── Built-in Style Guides ──────────────────────────────────────────────────

export const BUILT_IN_GUIDES: Record<string, StyleGuide> = {
  general: {
    name: "general",
    description: "Reduce LLM uniformity across all dimensions",
    targets: {
      sentence_length: { mean: 16, std_dev: 10, min: 3, max: 45 },
      nominalization_ratio: { max: 0.1 },
      participial_density: { max: 0.05 },
      clause_symmetry: { max_balance: 0.8 },
      paragraph_arc_diversity: { max_consecutive_same: 2 },
      resolution_completeness: { target: 0.7 },
      binary_contrast_frequency: { per_1000_words: { min: 1, max: 4 } },
      sentence_length_autocorrelation: { max_rho: 0.3 },
      device_entropy: { min: 2.5 },
      importance_inflation: { max: 0.02 },
      transition_formulaicness: { max_ratio: 0.15 },
    },
    continuity_parameter: 0.5,
  },

  "literary-essay": {
    name: "literary-essay",
    description: "Wide variance, high device entropy, tolerance for unresolved tension",
    targets: {
      sentence_length: { mean: 18, std_dev: 12, min: 3, max: 55 },
      nominalization_ratio: { max: 0.08 },
      participial_density: { max: 0.03 },
      clause_symmetry: { max_balance: 0.75 },
      paragraph_arc_diversity: { max_consecutive_same: 2 },
      resolution_completeness: { target: 0.6 },
      binary_contrast_frequency: { per_1000_words: { min: 1, max: 3 } },
      sentence_length_autocorrelation: { max_rho: 0.25 },
      device_entropy: { min: 2.8 },
      importance_inflation: { max: 0.02 },
      transition_formulaicness: { max_ratio: 0.1 },
    },
    continuity_parameter: 0.3,
  },

  technical: {
    name: "technical",
    description: "High continuity, parallel structure tolerated, low nominalization",
    targets: {
      sentence_length: { mean: 20, std_dev: 8, min: 5, max: 40 },
      nominalization_ratio: { max: 0.06 },
      participial_density: { max: 0.04 },
      clause_symmetry: { max_balance: 0.85 },
      paragraph_arc_diversity: { max_consecutive_same: 3 },
      resolution_completeness: { target: 0.8 },
      binary_contrast_frequency: { per_1000_words: { min: 0, max: 5 } },
      sentence_length_autocorrelation: { max_rho: 0.35 },
      device_entropy: { min: 2.0 },
      importance_inflation: { max: 0.01 },
      transition_formulaicness: { max_ratio: 0.2 },
    },
    continuity_parameter: 0.7,
  },

  journalism: {
    name: "journalism",
    description: "Short sentences, high rhythm variance, minimal hedging",
    targets: {
      sentence_length: { mean: 14, std_dev: 10, min: 2, max: 35 },
      nominalization_ratio: { max: 0.05 },
      participial_density: { max: 0.02 },
      clause_symmetry: { max_balance: 0.7 },
      paragraph_arc_diversity: { max_consecutive_same: 2 },
      resolution_completeness: { target: 0.5 },
      binary_contrast_frequency: { per_1000_words: { min: 1, max: 3 } },
      sentence_length_autocorrelation: { max_rho: 0.2 },
      device_entropy: { min: 2.5 },
      importance_inflation: { max: 0.01 },
      transition_formulaicness: { max_ratio: 0.05 },
    },
    continuity_parameter: 0.2,
  },

  fiction: {
    name: "fiction",
    description: "Maximum device entropy, lowest formulaicness, widest sentence length range",
    targets: {
      sentence_length: { mean: 15, std_dev: 14, min: 1, max: 60 },
      nominalization_ratio: { max: 0.04 },
      participial_density: { max: 0.03 },
      clause_symmetry: { max_balance: 0.65 },
      paragraph_arc_diversity: { max_consecutive_same: 1 },
      resolution_completeness: { target: 0.4 },
      binary_contrast_frequency: { per_1000_words: { min: 0, max: 2 } },
      sentence_length_autocorrelation: { max_rho: 0.15 },
      device_entropy: { min: 3.0 },
      importance_inflation: { max: 0.005 },
      transition_formulaicness: { max_ratio: 0.03 },
    },
    continuity_parameter: 0.1,
  },
};

/**
 * Get a style guide by name. Returns undefined if not found.
 */
export function loadStyleGuide(name: string): StyleGuide | undefined {
  return BUILT_IN_GUIDES[name];
}

/**
 * List all available style guide names.
 */
export function listStyleGuides(): Array<{ name: string; description: string }> {
  return Object.values(BUILT_IN_GUIDES).map((g) => ({
    name: g.name,
    description: g.description,
  }));
}

/**
 * Compute the delta between current document metrics and a style guide's targets.
 */
export function computeDelta(sentences: ClassifiedSentence[], guide: StyleGuide): StyleGuideDelta {
  const violations: StyleGuideDelta["violations"] = [];
  const totalWords = sentences.reduce(
    (sum, s) => sum + (s.classification.metrics.word_count || countWords(s.text)),
    0,
  );

  // Sentence length statistics
  const lengths = sentences.map((s) => s.classification.metrics.word_count || countWords(s.text));
  const meanLength = lengths.length > 0 ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0;
  const stdDev =
    lengths.length > 0
      ? Math.sqrt(lengths.reduce((sum, l) => sum + (l - meanLength) ** 2, 0) / lengths.length)
      : 0;

  // Check sentence length std_dev
  if (stdDev < guide.targets.sentence_length.std_dev * 0.6) {
    violations.push({
      dimension: "sentence_length_variance",
      current: Math.round(stdDev * 10) / 10,
      target: guide.targets.sentence_length.std_dev,
      severity: stdDev < guide.targets.sentence_length.std_dev * 0.3 ? "high" : "medium",
    });
  }

  // Nominalization ratio
  const nomCount = sentences.reduce(
    (sum, s) => sum + s.classification.patterns.filter((p) => p.type === "nominalization").length,
    0,
  );
  const nomRatio = totalWords > 0 ? nomCount / (totalWords / 100) : 0;
  if (nomRatio > guide.targets.nominalization_ratio.max * 100) {
    violations.push({
      dimension: "nominalization_ratio",
      current: Math.round(nomRatio * 100) / 100,
      target: guide.targets.nominalization_ratio.max * 100,
      severity: nomRatio > guide.targets.nominalization_ratio.max * 200 ? "high" : "medium",
    });
  }

  // Sentence length autocorrelation
  const autocorr = computeAutocorrelation(lengths);
  if (autocorr > guide.targets.sentence_length_autocorrelation.max_rho) {
    violations.push({
      dimension: "sentence_length_autocorrelation",
      current: autocorr,
      target: guide.targets.sentence_length_autocorrelation.max_rho,
      severity:
        autocorr > guide.targets.sentence_length_autocorrelation.max_rho * 1.5 ? "high" : "medium",
    });
  }

  // Device entropy
  const deviceEntropy = computeDeviceEntropy(sentences);
  if (deviceEntropy < guide.targets.device_entropy.min) {
    violations.push({
      dimension: "device_entropy",
      current: deviceEntropy,
      target: guide.targets.device_entropy.min,
      severity: deviceEntropy < guide.targets.device_entropy.min * 0.6 ? "high" : "medium",
    });
  }

  // Importance inflation
  const inflationCount = sentences.reduce(
    (sum, s) =>
      sum + s.classification.patterns.filter((p) => p.type === "importance_inflation").length,
    0,
  );
  const inflationRatio = totalWords > 0 ? inflationCount / (totalWords / 100) : 0;
  if (inflationRatio > guide.targets.importance_inflation.max * 100) {
    violations.push({
      dimension: "importance_inflation",
      current: Math.round(inflationRatio * 100) / 100,
      target: guide.targets.importance_inflation.max * 100,
      severity: "high",
    });
  }

  // Formulaic transitions
  const transCount = sentences.reduce(
    (sum, s) =>
      sum + s.classification.patterns.filter((p) => p.type === "transition_formulaic").length,
    0,
  );
  const transRatio = sentences.length > 0 ? transCount / sentences.length : 0;
  if (transRatio > guide.targets.transition_formulaicness.max_ratio) {
    violations.push({
      dimension: "transition_formulaicness",
      current: Math.round(transRatio * 100) / 100,
      target: guide.targets.transition_formulaicness.max_ratio,
      severity:
        transRatio > guide.targets.transition_formulaicness.max_ratio * 2 ? "high" : "medium",
    });
  }

  // Participial density (sentences with participial constructions / total sentences)
  const participialCount = sentences.filter((s) => s.classification.metrics.has_participial).length;
  const participialDensity = sentences.length > 0 ? participialCount / sentences.length : 0;
  if (participialDensity > guide.targets.participial_density.max) {
    violations.push({
      dimension: "participial_density",
      current: Math.round(participialDensity * 100) / 100,
      target: guide.targets.participial_density.max,
      severity: participialDensity > guide.targets.participial_density.max * 2 ? "high" : "medium",
    });
  }

  // Clause symmetry (mean balance ratio across multi-clause sentences)
  const multiClause = sentences.filter((s) => s.classification.metrics.clause_count >= 2);
  if (multiClause.length > 0) {
    const meanBalance =
      multiClause.reduce((sum, s) => sum + s.classification.metrics.clause_balance_ratio, 0) /
      multiClause.length;
    if (meanBalance > guide.targets.clause_symmetry.max_balance) {
      violations.push({
        dimension: "clause_symmetry",
        current: Math.round(meanBalance * 100) / 100,
        target: guide.targets.clause_symmetry.max_balance,
        severity: meanBalance > guide.targets.clause_symmetry.max_balance + 0.1 ? "high" : "medium",
      });
    }
  }

  // Paragraph arc diversity (max consecutive paragraphs with same dominant arc_role)
  const paragraphIds = [...new Set(sentences.map((s) => s.paragraph_id))].sort((a, b) => a - b);
  const paragraphDominantRoles = paragraphIds.map((pid) => {
    const paraSentences = sentences.filter((s) => s.paragraph_id === pid);
    const roleCounts: Record<string, number> = {};
    for (const s of paraSentences) {
      roleCounts[s.classification.arc_role] = (roleCounts[s.classification.arc_role] ?? 0) + 1;
    }
    return Object.entries(roleCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "claim";
  });
  let maxConsecutiveSame = 1;
  let currentRun = 1;
  for (let i = 1; i < paragraphDominantRoles.length; i++) {
    if (paragraphDominantRoles[i] === paragraphDominantRoles[i - 1]) {
      currentRun++;
      maxConsecutiveSame = Math.max(maxConsecutiveSame, currentRun);
    } else {
      currentRun = 1;
    }
  }
  if (maxConsecutiveSame > guide.targets.paragraph_arc_diversity.max_consecutive_same) {
    violations.push({
      dimension: "paragraph_arc_diversity",
      current: maxConsecutiveSame,
      target: guide.targets.paragraph_arc_diversity.max_consecutive_same,
      severity:
        maxConsecutiveSame > guide.targets.paragraph_arc_diversity.max_consecutive_same + 2
          ? "high"
          : "medium",
    });
  }

  // Resolution completeness (ratio of sentences with resolution_complete pattern)
  const resolutionCount = sentences.reduce(
    (sum, s) =>
      sum + s.classification.patterns.filter((p) => p.type === "resolution_complete").length,
    0,
  );
  const resolutionRatio = sentences.length > 0 ? resolutionCount / sentences.length : 0;
  const resTarget = guide.targets.resolution_completeness.target;
  // Too much resolution = over-resolved; distance from target in either direction
  if (Math.abs(resolutionRatio - resTarget) > 0.2) {
    violations.push({
      dimension: "resolution_completeness",
      current: Math.round(resolutionRatio * 100) / 100,
      target: resTarget,
      severity: Math.abs(resolutionRatio - resTarget) > 0.4 ? "high" : "medium",
    });
  }

  // Binary contrast frequency (per 1000 words)
  const binaryCount = sentences.reduce(
    (sum, s) => sum + s.classification.patterns.filter((p) => p.type === "binary_contrast").length,
    0,
  );
  const binaryPer1000 = totalWords > 0 ? (binaryCount / totalWords) * 1000 : 0;
  const { min: bcMin, max: bcMax } = guide.targets.binary_contrast_frequency.per_1000_words;
  if (binaryPer1000 < bcMin || binaryPer1000 > bcMax) {
    violations.push({
      dimension: "binary_contrast_frequency",
      current: Math.round(binaryPer1000 * 100) / 100,
      target: binaryPer1000 > bcMax ? bcMax : bcMin,
      severity: binaryPer1000 > bcMax * 1.5 || binaryPer1000 < bcMin * 0.5 ? "high" : "low",
    });
  }

  // Overall distance (normalized 0-1)
  const maxViolations = 11;
  const weightedDistance = violations.reduce((sum, v) => {
    const severityWeight = v.severity === "high" ? 1.0 : v.severity === "medium" ? 0.6 : 0.3;
    return sum + severityWeight;
  }, 0);
  const overallDistance = Math.min(1, weightedDistance / maxViolations);

  return {
    guide: guide.name,
    violations,
    overall_distance: Math.round(overallDistance * 100) / 100,
  };
}

/**
 * Reverse-engineer a style guide from exemplar text.
 * Analyze the text to extract its structural profile, then derive targets.
 */
export function reverseEngineerGuide(
  name: string,
  description: string,
  sentences: ClassifiedSentence[],
): StyleGuide {
  const totalWords = sentences.reduce(
    (sum, s) => sum + (s.classification.metrics.word_count || countWords(s.text)),
    0,
  );
  const lengths = sentences.map((s) => s.classification.metrics.word_count || countWords(s.text));
  const meanLength = lengths.length > 0 ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 16;
  const stdDev =
    lengths.length > 0
      ? Math.sqrt(lengths.reduce((sum, l) => sum + (l - meanLength) ** 2, 0) / lengths.length)
      : 8;

  const nomCount = sentences.reduce(
    (sum, s) => sum + s.classification.patterns.filter((p) => p.type === "nominalization").length,
    0,
  );
  const nomRatio = totalWords > 0 ? nomCount / (totalWords / 100) / 100 : 0.05;

  const participialCount = sentences.filter((s) => s.classification.metrics.has_participial).length;
  const participialDensity = sentences.length > 0 ? participialCount / sentences.length : 0.03;

  const multiClause = sentences.filter((s) => s.classification.metrics.clause_count >= 2);
  const meanBalance =
    multiClause.length > 0
      ? multiClause.reduce((sum, s) => sum + s.classification.metrics.clause_balance_ratio, 0) /
        multiClause.length
      : 0.75;

  const autocorr = computeAutocorrelation(lengths);
  const devEntropy = computeDeviceEntropy(sentences);

  const inflationCount = sentences.reduce(
    (sum, s) =>
      sum + s.classification.patterns.filter((p) => p.type === "importance_inflation").length,
    0,
  );
  const inflationRatio = totalWords > 0 ? inflationCount / (totalWords / 100) / 100 : 0.01;

  const transCount = sentences.reduce(
    (sum, s) =>
      sum + s.classification.patterns.filter((p) => p.type === "transition_formulaic").length,
    0,
  );
  const transRatio = sentences.length > 0 ? transCount / sentences.length : 0.1;

  const binaryCount = sentences.reduce(
    (sum, s) => sum + s.classification.patterns.filter((p) => p.type === "binary_contrast").length,
    0,
  );
  const binaryPer1000 = totalWords > 0 ? (binaryCount / totalWords) * 1000 : 2;

  const resolutionCount = sentences.reduce(
    (sum, s) =>
      sum + s.classification.patterns.filter((p) => p.type === "resolution_complete").length,
    0,
  );
  const resolutionRatio = sentences.length > 0 ? resolutionCount / sentences.length : 0.5;

  return {
    name,
    description,
    targets: {
      sentence_length: {
        mean: Math.round(meanLength),
        std_dev: Math.round(stdDev),
        min: Math.max(1, Math.round(meanLength - stdDev * 2)),
        max: Math.round(meanLength + stdDev * 2.5),
      },
      nominalization_ratio: { max: Math.round(nomRatio * 100) / 100 },
      participial_density: { max: Math.round(participialDensity * 100) / 100 },
      clause_symmetry: { max_balance: Math.round(meanBalance * 100) / 100 },
      paragraph_arc_diversity: { max_consecutive_same: 2 },
      resolution_completeness: { target: Math.round(resolutionRatio * 100) / 100 },
      binary_contrast_frequency: {
        per_1000_words: {
          min: Math.max(0, Math.round((binaryPer1000 - 1) * 10) / 10),
          max: Math.round((binaryPer1000 + 2) * 10) / 10,
        },
      },
      sentence_length_autocorrelation: {
        max_rho: Math.round(Math.max(autocorr + 0.05, 0.15) * 100) / 100,
      },
      device_entropy: { min: Math.round(Math.max(devEntropy - 0.3, 1.5) * 10) / 10 },
      importance_inflation: { max: Math.round(inflationRatio * 100) / 100 },
      transition_formulaicness: { max_ratio: Math.round(transRatio * 100) / 100 },
    },
    continuity_parameter: 0.5,
  };
}

// computeAutocorrelation, computeDeviceEntropy, countWords imported from math.ts

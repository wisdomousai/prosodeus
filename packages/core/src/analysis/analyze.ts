import { computeHeat } from "../classification/classifier.ts";
import type { ClassificationCache } from "../storage/cache.ts";
import { splitAndHash } from "../text/splitter.ts";
import type {
  ClassifiedSentence,
  HashedSentence,
  SentenceClassification,
  StylometricProfile,
} from "../types.ts";
import { assembleProfile } from "./profile.ts";
import { computeDelta, loadStyleGuide } from "./style-guide.ts";

export interface SentenceClassifier {
  classify(sentences: HashedSentence[]): Promise<ClassifiedSentence[]>;
}

export interface AnalyzeOptions {
  cache: ClassificationCache;
  classifier: SentenceClassifier;
  style?: string;
  onProgress?: (progress: AnalyzeProgress) => void;
}

export interface AnalyzeProgress {
  total: number;
  cached: number;
  classifying: number;
}

export async function analyze(text: string, options: AnalyzeOptions): Promise<StylometricProfile> {
  const hashed = splitAndHash(text);

  if (hashed.length === 0) {
    return assembleProfile([]);
  }

  // Check cache
  const cached = await options.cache.getMany(hashed.map((s) => s.hash));

  const uncached = hashed.filter((s) => !cached.has(s.hash));

  if (options.onProgress) {
    options.onProgress({
      total: hashed.length,
      cached: cached.size,
      classifying: uncached.length,
    });
  }

  // Classify uncached sentences
  let freshlyClassified: ClassifiedSentence[] = [];
  if (uncached.length > 0) {
    freshlyClassified = await options.classifier.classify(uncached);

    // Store in cache
    await options.cache.setMany(
      freshlyClassified.map((s) => ({
        hash: s.hash,
        classification: s.classification,
      })),
    );
  }

  // Build lookup for freshly classified
  const freshMap = new Map<string, SentenceClassification>();
  for (const s of freshlyClassified) {
    freshMap.set(s.hash, s.classification);
  }

  // Merge: reconstruct full classified sentence list in document order
  const allClassified: ClassifiedSentence[] = hashed.map((s) => {
    const classification = cached.get(s.hash) ?? freshMap.get(s.hash)!;
    return {
      ...s,
      classification,
      heat: computeHeat(classification),
    };
  });

  // Style guide delta
  let delta;
  if (options.style) {
    const guide = loadStyleGuide(options.style);
    if (guide) delta = computeDelta(allClassified, guide);
  }

  return assembleProfile(allClassified, delta);
}

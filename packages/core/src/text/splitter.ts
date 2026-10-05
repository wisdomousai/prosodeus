import type { HashedSentence } from "../types.ts";

/**
 * Split text into sentences using regex-based rules.
 * Handles abbreviations, decimal numbers, and common edge cases.
 */
export function splitSentences(text: string): string[] {
  // Normalize whitespace
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  // Split on sentence-ending punctuation followed by whitespace and a capital letter,
  // or by paragraph breaks. Handles:
  // - Standard periods, exclamation marks, question marks
  // - Ellipses followed by capital letter
  // - Paragraph breaks (double newline)
  const raw: string[] = [];
  let current = "";

  // Common abbreviations that shouldn't trigger splits
  const abbreviations = new Set([
    "mr",
    "mrs",
    "ms",
    "dr",
    "prof",
    "sr",
    "jr",
    "st",
    "vs",
    "etc",
    "inc",
    "ltd",
    "co",
    "corp",
    "jan",
    "feb",
    "mar",
    "apr",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
    "vol",
    "dept",
    "univ",
    "assn",
    "bros",
    "rep",
    "sen",
    "gov",
    "gen",
    "sgt",
    "cpl",
    "pvt",
    "capt",
    "lt",
    "col",
    "cmdr",
    "adm",
    "maj",
    "drs",
    "rev",
    "hon",
    "fig",
    "eq",
    "approx",
    "appt",
    "est",
    "i.e",
    "e.g",
    "cf",
    "al",
  ]);

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i]!;
    current += char;

    // Check for paragraph break (double newline)
    if (char === "\n" && normalized[i + 1] === "\n") {
      const trimmed = current.trim();
      if (trimmed) raw.push(trimmed);
      current = "";
      // Skip extra newlines
      while (i + 1 < normalized.length && normalized[i + 1] === "\n") i++;
      continue;
    }

    // Check for sentence-ending punctuation
    if (char === "." || char === "!" || char === "?") {
      // Handle ellipses (... or …)
      if (char === "." && normalized[i + 1] === "." && normalized[i + 2] === ".") {
        current += "..";
        i += 2;
        // Check if followed by whitespace + capital
        if (isEndOfSentence(normalized, i)) {
          const trimmed = current.trim();
          if (trimmed) raw.push(trimmed);
          current = "";
        }
        continue;
      }

      // Handle multiple punctuation (!! ?? !? etc.)
      while (
        i + 1 < normalized.length &&
        (normalized[i + 1] === "!" || normalized[i + 1] === "?")
      ) {
        current += normalized[i + 1];
        i++;
      }

      // Check for abbreviation
      if (char === ".") {
        const wordBefore = getWordBefore(current.slice(0, -1));
        if (abbreviations.has(wordBefore.toLowerCase())) continue;

        // Check for decimal numbers (e.g., 3.14)
        if (/\d$/.test(current.slice(0, -1)) && /^\d/.test(normalized.slice(i + 1))) continue;

        // Check for initials (e.g., "J. K. Rowling")
        if (wordBefore.length === 1 && /^[A-Z]$/.test(wordBefore)) continue;
      }

      // Handle closing quotes/parens after punctuation
      while (i + 1 < normalized.length && /['")\]\u201D\u2019]/.test(normalized[i + 1]!)) {
        current += normalized[i + 1];
        i++;
      }

      // If followed by whitespace + capital letter (or end of text), split
      if (isEndOfSentence(normalized, i)) {
        const trimmed = current.trim();
        if (trimmed) raw.push(trimmed);
        current = "";
      }
    }
  }

  // Push remaining text
  const trimmed = current.trim();
  if (trimmed) raw.push(trimmed);

  return raw;
}

function isEndOfSentence(text: string, pos: number): boolean {
  // End of text
  if (pos + 1 >= text.length) return true;

  // Look ahead: skip whitespace, check for capital letter or end
  let j = pos + 1;
  while (j < text.length && /[\s]/.test(text[j]!)) j++;

  if (j >= text.length) return true;

  // Capital letter, opening quote, em-dash, or number starts a new sentence
  return /[A-Z\u201C\u201E\u2018"(\u2014\u2013[]/.test(text[j]!);
}

function getWordBefore(text: string): string {
  const match = text.match(/(\S+)\s*$/);
  return match ? match[1]! : "";
}

/**
 * Split text into sentences, assign IDs, compute hashes, and track paragraphs.
 */
export function splitAndHash(text: string): HashedSentence[] {
  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .filter((p) => p.trim());

  const result: HashedSentence[] = [];
  let globalId = 0;

  for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
    const sentences = splitSentences(paragraphs[pIdx]!);
    for (const sentence of sentences) {
      result.push({
        id: globalId++,
        text: sentence,
        hash: hashSentence(sentence),
        paragraph_id: pIdx,
      });
    }
  }

  return result;
}

/**
 * Compute a short hash of a sentence for caching.
 * Uses Web Crypto API (available in Workers, Node 18+, Bun).
 * Synchronous via Bun.hash for speed.
 */
function hashSentence(text: string): string {
  // Bun has a fast built-in hash — use it for speed.
  // Falls back to a simple djb2 hash for portability.
  const normalized = text.trim().toLowerCase();
  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) + hash + normalized.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Given baseline and current document text, return sentence IDs (in the
 * current split) that need re-classification. Compares content hashes from
 * splitAndHash — not profile objects, which can drift after optimistic patches.
 */
export function diffChangedSentenceIds(baselineText: string, currentText: string): number[] {
  if (!baselineText.trim() || baselineText === currentText) return [];
  return diffSentences(splitAndHash(baselineText), splitAndHash(currentText));
}

/**
 * Given old and new hashed sentences, return IDs of sentences that changed.
 * Used for incremental re-classification after edits.
 */
export function diffSentences(old: HashedSentence[], next: HashedSentence[]): number[] {
  const oldHashes = new Set(old.map((s) => s.hash));
  return next.filter((s) => !oldHashes.has(s.hash)).map((s) => s.id);
}

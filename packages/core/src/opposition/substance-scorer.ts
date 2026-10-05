import { generateText, type LanguageModel } from "ai";
import { heuristicSubstanceVerdict } from "./heuristics.ts";
import type { OppositionSpan, SubstanceVerdict } from "./types.ts";

export interface SubstanceScoreResult {
  verdict: SubstanceVerdict;
  rationale: string;
}

export interface SubstanceScorerOptions {
  model: LanguageModel;
  maxOutputTokens?: number;
}

const SYSTEM_PROMPT = `You are an editorial judge that decides whether a binary/contrastive construction in prose is vacuous or earned.

A construction is **VACUOUS** when:
- The negated or contrasted pole is a strawman (no reader actually holds it).
- The two poles are trivially compatible or near-synonyms.
- Removing the opposition would not change the actionable conclusion.
- It uses generic templates like "It's not X, it's Y", "Most do X, the best do Y", "On the one hand... on the other hand" with abstract placeholders.

A construction is **EARNED** when:
- The negated/contrasted pole is a real position someone holds.
- The resolution changes what the reader should do or believe.
- The two poles are genuinely in tension and the author resolves that tension with evidence.

A construction is **UNCERTAIN** only when the sentence lacks a clear opposition template and the context is genuinely too thin to decide. Do not use UNCERTAIN for obvious not-X-but-Y templates.

Respond with ONLY valid JSON: {"verdict": "vacuous" | "earned" | "uncertain", "rationale": "one sentence explaining why"}.
Do not include markdown, commentary, or any other text.`;

const FEW_SHOT_EXAMPLES = `
EXAMPLE 1
Sentence: It's not about speed; it's about precision.
Evidence: not about speed; it's about precision
Verdict: vacuous
Rationale: Nobody claimed it was only about speed, and the two qualities are not mutually exclusive.

EXAMPLE 2
Sentence: The drug reduces symptoms, but it also raises liver enzymes.
Evidence: reduces symptoms, but it also raises liver enzymes
Verdict: earned
Rationale: This is a genuine clinical trade-off that changes prescribing decisions.

EXAMPLE 3
Sentence: Most companies focus on cutting costs. The best companies focus on creating value.
Evidence: Most companies focus on cutting costs. The best companies focus on creating value.
Verdict: vacuous
Rationale: The contrast is a generic strawman; cutting costs and creating value are compatible, and no specific companies are named.

EXAMPLE 4
Sentence: While the policy lowered unemployment, it also raised inflation.
Evidence: While the policy lowered unemployment, it also raised inflation
Verdict: earned
Rationale: The contrast is an empirical tension with measurable consequences.

EXAMPLE 5
Sentence: On the one hand, technology offers convenience. On the other hand, it creates challenges.
Evidence: On the one hand, technology offers convenience. On the other hand, it creates challenges.
Verdict: vacuous
Rationale: Both statements are vague and universally accepted; the contrast resolves nothing.

EXAMPLE 6
Sentence: Critics argued the treaty would deter investment; the data showed exports grew 12% in the first year.
Evidence: Critics argued the treaty would deter investment; the data showed exports grew 12% in the first year
Verdict: earned
Rationale: A specific opposing claim is contrasted with specific counter-evidence.
`;

function parseSubstanceResponse(raw: string): SubstanceScoreResult {
  const cleaned = raw
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/```(?:json)?\s*|```/gi, "")
    .trim();

  const start = cleaned.search(/[{[]/);
  if (start >= 0) {
    const jsonish = cleaned.slice(start).replace(/,\s*([}\]])/g, "$1");
    try {
      const parsed = JSON.parse(jsonish) as Record<string, unknown>;
      const verdict = parsed.verdict;
      const rationale = parsed.rationale;
      if (
        (verdict === "vacuous" || verdict === "earned" || verdict === "uncertain") &&
        typeof rationale === "string"
      ) {
        return { verdict, rationale: rationale.trim() };
      }
    } catch {
      // fall through to regex salvage
    }
  }

  // Salvage
  const verdictMatch = cleaned.match(/"verdict"\s*:\s*"(vacuous|earned|uncertain)"/i);
  const rationaleMatch = cleaned.match(/"rationale"\s*:\s*"((?:\\.|[^"\\])*?)"/i);
  if (verdictMatch) {
    return {
      verdict: (verdictMatch[1] ?? "").toLowerCase() as SubstanceVerdict,
      rationale: rationaleMatch?.[1]?.replace(/\\"/g, '"').trim() ?? "",
    };
  }

  // Conservative fallback
  return { verdict: "uncertain", rationale: "Could not parse model response." };
}

/**
 * Score whether a detected opposition is vacuous rhetorical scaffolding or an
 * earned contrast that should be preserved.
 */
export async function scoreSubstance(
  span: OppositionSpan,
  context: {
    sentence: string;
    before?: string;
    after?: string;
    paragraph?: string;
  },
  options: SubstanceScorerOptions,
): Promise<SubstanceScoreResult> {
  const heuristic = heuristicSubstanceVerdict(span, context.sentence);
  if (heuristic) return heuristic;

  const userPrompt = `${FEW_SHOT_EXAMPLES}

JUDGE THIS ONE
Sentence: ${context.sentence}
Evidence: ${span.evidence}
${context.before ? `Previous sentence: ${context.before}\n` : ""}${context.after ? `Next sentence: ${context.after}\n` : ""}${context.paragraph ? `Paragraph context: ${context.paragraph}\n` : ""}
Verdict and rationale (JSON only):`;

  const { text } = await generateText({
    model: options.model,
    system: SYSTEM_PROMPT,
    prompt: userPrompt,
    maxOutputTokens: options.maxOutputTokens ?? 256,
  });

  return parseSubstanceResponse(text);
}

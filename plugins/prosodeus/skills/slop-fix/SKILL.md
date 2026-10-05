---
name: slop-fix
description: Rewrite generic, uniform, model-sounding prose into specific, varied writing. Use when the user asks to fix, de-slop, tighten, or rewrite flagged text, or to apply the scan's diagnosis.
---

# Fix flagged prose

Turn a diagnosis into a better draft without inventing facts.

1. Get the text and diagnose it. Call `generate_constraints` with `text`; add `passage_start` and `passage_end` (0-based sentence indices) to limit the change to a passage. The result has a diagnosis, avoid and target lists, and a rewrite instruction.
2. Read `references/strategies.md`. For each pattern the diagnosis names, read the matching category file in `references/` (the index is `references/README.md`).
3. Rewrite. Keep every factual claim and the author's meaning. Prefer, in order: delete the filler, then specify, then reframe. Vary sentence length. Do not swap one stock phrase for another.
4. If a sentence cannot be made specific without information you do not have, leave it and add a bracketed note saying what is missing. Never invent dates, numbers, names or sources.
5. Show the user the rewrite, then run the `slop-verify` skill so they can see whether the metrics moved.

For a first pass you may instead call `rewrite_passage` (same arguments, plus `use_pce` for slower, higher-quality decomposition). It uses the model configured for the MCP server and returns the rewrite with before and after metrics. Treat its output as a draft and check it against the rules in step 3.

The references are guidance for editing, not a way to decide who wrote a text.

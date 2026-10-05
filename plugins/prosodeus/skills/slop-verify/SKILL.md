---
name: slop-verify
description: Check whether a rewrite actually improved the prose by comparing before and after metrics. Use after a rewrite, or when the user supplies an original and a revision.
---

# Verify a rewrite

1. Get the original and the revised text. Both are required.
2. Call the MCP tool `verify_rewrite` with `original_text` and `rewritten_text`; pass `style` if the scan used one.
3. Report each metric as improved, unchanged or regressed, and say plainly if the revision made things worse.
4. If a metric regressed or hot regions remain, point at the sentences that still carry the pattern and suggest another pass with `slop-fix`. Stop after two passes; past that, the remaining sentences usually need facts only the author has, so list what is missing.

Do not report the numbers as a verdict on authorship. They describe the prose, not the writer.

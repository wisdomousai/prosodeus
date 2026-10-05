---
name: slop-scan
description: Diagnose a piece of writing for generic, uniform, model-sounding prose. Use when the user asks whether text reads like AI slop, wants to know where it is weak, or asks for a scan before editing.
---

# Scan a text for slop

Run the Prosodeus diagnosis and report where the prose is uniform and what drives it.

1. Get the text. If the user names a file, read it. Do not scan text you were not given.
2. Call the MCP tool `screen_text` with `text`. Pass `style` only if the user names a style guide; `list_style_guides` shows the options.
3. Report, in this order:
   - the overall picture in one or two sentences (mean heat, how uniform the sentence lengths and devices are);
   - the hottest sentences or regions, quoted, with the pattern that fired;
   - which categories dominate, using the `slop-fix` references to name them.
4. Say what is *not* a problem. A single marker means little; clusters of two or more per paragraph are what matter. Read `references/strategies.md` in the `slop-fix` skill for the density test.

Rules:

- This diagnoses prose. It never says who or what wrote the text, and you must not claim it does. Hits also land on non-native writers and formal academic writing. Read `references/README.md` in the `slop-fix` skill and the repo's `docs/editorial-policy.md` if the user wants to use a result against a person, and decline that use.
- Offer `slop-fix` next. Do not rewrite unless asked.

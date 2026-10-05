# Prosodeus UI Redesign Spec

## Mockup References

The repo-local mockups live in [ui-redesign/](ui-redesign/README.md). The
current implementation references are:

- [Editor with rewrite inspector](ui-redesign/mockups/current/editor-rewrite-inspector.png)
- [Styles and expression policy workbench](ui-redesign/mockups/current/styles-expression-policy-workbench.png)
- [Rewrite comparison focus mode](ui-redesign/mockups/current/rewrite-comparison-focus.png)
- [Version comparison layout](ui-redesign/mockups/current/version-comparison-layout.png)

Earlier mockups were moved to
[ui-redesign/mockups/archive/](ui-redesign/mockups/archive/). They are retained
for provenance only and should not be implemented directly.

## Product Intent

Prosodeus should feel like an editorial instrument for structural prose work.
The core user is editing one document, diagnosing structural patterns, comparing
rewrite options, and maintaining the pattern/style rules that drive the system.

The primary diagnostic lens is not detector evasion. It is a craft tool for
writing leveled, controlled, and genuinely good prose. It should show where the
writing becomes statistically uniform: repeated strongest expressions,
superlatives, binary contrasts, mirrored sentence shapes, abstract claim stacks,
and recurring openings clustering too densely. If AI helps the writer reach a
better editorial standard faster, that is the point.

This is not an enterprise workflow dashboard. Avoid review queues, assignees,
team SLAs, generic analytics cards, and broad operations surfaces unless they
directly support editing or master-data maintenance.

## Primary Product Areas

### 1. Editing Surface

The editor is the product center of gravity.

Required capabilities:

- Write and edit one document in a calm central editor.
- Run structural analysis on the current text.
- See sentence-level heat without making the prose visually noisy.
- See density and repetition of overused structural moves across the document.
- Select a sentence or passage and inspect its diagnosis.
- Generate rewrite constraints.
- Compare rewrite alternatives without using a chat interface.
- Apply, reject, copy, or pin rewrite suggestions.
- Save and browse versions.
- Select style guide and model from the document toolbar.

The main editor screen should use a three-zone structure:

- Left rail: compact navigation and document-local tools.
- Center: dominant writing canvas.
- Right inspector: contextual analysis, rewrite, and versions.

The center editor must be visually calmer than the analysis tools. Heat should
appear as margin ticks, underlines, small badges, or subtle sentence highlights,
not as heavy colored blocks.

### 2. Master Data

Master data is where the user maintains the reasoning system behind Prosodeus.

Required capabilities:

- Browse platform and custom patterns.
- Fork or edit patterns.
- Maintain detection hints, descriptions, examples, false positives, rewrite
  menu items, PCE directives, and related patterns.
- Maintain pattern, style, and expression-control rules.
- Calibrate rewrite behavior through editorial constraints, not dashboard scores.
- Preview generated constraint prompts.
- Compare and revert pattern/style versions.

The master-data screen should feel like a structured configuration workbench,
not a settings page.

## Information Architecture

Primary navigation should be small and stable:

- Library
- Editor
- Density
- Rewrite
- Rules
- Settings

Library can exist, but it should stay lightweight. Its job is to open documents,
not become a workflow management product.

Rules may contain Patterns and Styles in implementation, but the UI should make
the distinction clear:

- Patterns define what the system detects.
- Styles define register, preferred rhetorical behavior, and expression ceilings.
- Density is the document-local craft lens: where repeated moves cluster.
- Rewrite is the document-local constraint and comparison workflow.

## Editing Screen Specification

### Top Toolbar

Persistent controls:

- Breadcrumb: Library / document group.
- Editable document title.
- Save state.
- Style guide selector.
- Model selector.
- Analyze button.
- Export/share icon controls.

Toolbar controls must be compact. They should not steal vertical space from the
editor.

### Left Rail

The left rail should be narrow by default and icon-led.

Required entries:

- Library
- Outline
- Density
- Rewrite
- Versions
- Rules
- Settings

When expanded or hovered, it may show labels. It should not become a large
sidebar on the main editor screen.

### Center Editor

Required behavior:

- Plain writing-first surface with readable line length.
- Paragraph spacing suitable for editorial prose.
- Inline structural annotations that do not interrupt writing.
- Selected sentence or passage can be highlighted.
- Margin heat ticks show local heat distribution.
- Optional mini-map for hot regions if it does not crowd the editor.

Avoid:

- Dense dashboard cards above the editor.
- Chat bubbles.
- Large colored heat backgrounds.
- Multiple nested panels around the writing surface.

### Right Inspector

The inspector should be contextual to the current selection.

Tabs:

- Analyze
- Rewrite
- Versions

Analyze tab:

- Selected sentence density.
- Detected pattern badges.
- Short structural diagnosis.
- Evidence snippets.
- Document-level density/repetition summary.
- Pattern cluster list by density, not generic score.
- Rewrite constraints checklist.
- Actions: Rewrite sentence, Copy constraints, Pin version.

Rewrite tab:

- Original selected passage.
- Constraints checklist.
- Statement force control: how strong the claim should be.
- Expression budget: how many high-intensity expressions are allowed.
- Device distribution limits: how often the same rhetorical device may repeat.
- Rewrite alternative comparison.
- Inline diff preview.
- Actions: Apply selected, Save as version, Reject, Copy.

Versions tab:

- Compact version list.
- Density/repetition delta per version.
- Word count and timestamp.
- Compare and restore actions.

## Rewrite Interaction Model

Rewriting should be controlled comparison, not chat.

The core purpose is to fix statistical AI writing: the tendency for many local
choices to cluster around maximum intensity, maximum certainty, superlatives,
binary contrasts, mirrored sentence shapes, and over-compressed abstract claims.
The UI should help users set expressive ceilings and distribution rules, not
pretend that prose quality is a dashboard score.

### Rewrite Sequence

The UI must keep analysis, rewrite planning, and generated alternatives as
separate states.

1. User writes, imports, or edits text.
2. User runs analysis, or a saved document is incrementally re-analyzed.
3. Analysis produces findings: density clusters, detected patterns, evidence,
   and recommended constraint ingredients.
4. User selects a sentence, passage, paragraph, or density cluster.
5. The Analyze tab explains the issue and can offer "Open rewrite setup" or
   "Copy constraints". It must not show generated rewrite alternatives.
6. The Rewrite tab opens a setup state for the selected scope. It shows the
   effective policy and lets the user adjust run-level controls.
7. User explicitly runs alternatives.
8. Alternatives generate and can then be compared, applied, copied, pinned, or
   rejected.

Do not show rewrite suggestions before a valid selection and scope exist. Do not
auto-generate alternatives from a document-level analysis. Pattern rewrite menus
are rule ingredients, not generated prose suggestions.

### Settings Source Hierarchy

Rewrite controls are not arbitrary settings. The UI should show where each
constraint comes from.

Source order:

1. **Platform pattern rules** define detection logic, evidence, false positives,
   rewrite menu items, and constraint ingredients.
2. **Style policy** defines register, statement-force defaults, expression
   budgets, device allowances, and evidence requirements.
3. **Document policy** is the selected style plus document-local overrides.
4. **Selection findings** are the patterns and density clusters found in the
   selected sentence, passage, paragraph, or cluster.
5. **Run overrides** are temporary changes made in the Rewrite tab for this
   rewrite run only.

The Rewrite tab should render an "Effective policy" or "Constraint sources"
section that labels constraints as:

- From style.
- From detected pattern.
- From density cluster.
- Document override.
- This run only.

Saving a local override must be explicit. The user should choose whether to keep
an override only for the current run, save it for the document, or promote it to
a style/pattern rule in Rules.

A rewrite request produces:

- The original selected sentence or passage.
- The active constraints.
- 2 to 4 alternatives.
- A structural change summary.
- A density/repetition change summary.
- Expression-budget impact.
- Meaning preservation notes.
- Tone/register fit notes.
- Length and emphasis changes.
- Diff preview.

The user can:

- Apply one alternative.
- Copy one alternative.
- Pin the current document as a version.
- Reject all alternatives.
- Adjust constraints and rerun.

Rewrite controls should use editorial language:

- Statement force: tentative, measured, firm, emphatic.
- Claim certainty: qualify, preserve, strengthen, reduce.
- Expression budget: allow none, allow one, allow a few, preserve existing.
- Superlative ceiling: no superlatives, one strongest expression per section,
  preserve only if evidence-bearing.
- Binary contrast allowance: avoid, allow sparingly, preserve if central.
- Abstraction level: concrete, balanced, conceptual.
- Rhythm policy: vary openings, break mirrored clauses, preserve cadence.

Avoid generic controls such as "intervention strength" or numeric quality
scores. The user should be choosing the rhetorical behavior of the rewrite.

## Master Data Screen Specification

### Layout

Use a three-column workbench:

- Left: pattern/style list and filters.
- Center: detail editor.
- Right: calibration, preview, and version history.

### Patterns

List row fields:

- Taxonomy ID.
- Pattern name.
- Level: lexical, sentence, paragraph, document.
- Severity.
- Source: platform or mine.
- Enabled state.

Detail sections:

- Detection hint.
- Description.
- Positive examples.
- False positives.
- Rewrite menu.
- PCE directive.
- Related patterns.
- Research/source notes when available.

Actions:

- Fork.
- Edit.
- Save.
- Export.
- Compare versions.
- Revert.

### Styles

Style guide fields:

- Name.
- Description.
- Target genre or context.
- Register notes.
- Statement-force policy.
- Expression-budget policy.
- Rhetorical-device distribution policy.
- Rewrite preference notes.
- Example source text or exemplar summary.

Expression controls:

- Default statement force.
- Maximum strongest expressions per paragraph or section.
- Superlative allowance.
- Binary contrast allowance.
- Abstract-claim allowance.
- Repeated opening allowance.
- Mirrored-clause allowance.
- Nominalization allowance.
- Evidence requirement for strong claims.

Preview:

- Example sentence or passage before/after.
- Expression budget report in plain language.
- Constraint prompt preview.
- Structural change summary.

## Visual Language

The UI should be serious, calm, and editorial.

Preferred palette:

- Warm off-white surfaces.
- Deep charcoal text.
- Muted ink blue controls.
- Moss green healthy states.
- Amber/gold medium heat.
- Restrained red high heat.

Avoid:

- Dominant purple.
- Bright gradients.
- Decorative orbs or blobs.
- Beige-only palettes.
- Marketing hero composition.
- Card grids as the default layout.

Typography:

- Editor text should be highly readable and prose-oriented.
- UI labels should be compact and scannable.
- Tables, inspectors, and controls need smaller, tighter headings.
- Do not use hero-scale type inside app panels.

## Component Patterns

Use familiar controls:

- Tabs for inspector modes.
- Segmented controls for views.
- Selects for model and style.
- Toggles for enabled states.
- Steppers or segmented controls for expression budgets.
- Checkboxes for explicit constraints.
- Sliders only when they map to a plain-language editorial decision.
- Badges for pattern level, severity, and source.
- Tables or list rows for dense data.
- Icon buttons for compact actions.
- Tooltips for unfamiliar icon controls.

Avoid cards inside cards. Use panels, separators, list rows, tables, and sheets.

## Implementation Packets

### Packet 1: Editing Shell

Replace the current document route with the three-zone editing shell:

- Slim left rail.
- Dominant editor.
- Right inspector with Analyze, Rewrite, Versions tabs.
- Top toolbar for title, style, model, analyze, export.

Acceptance:

- User can open a document and understand where to write.
- Density and repetition results are visible beside the text.
- The editor remains visually calm even with heat annotations.

### Packet 2: Rewrite Comparison

Replace one-shot rewrite output with a comparison workflow:

- Original passage.
- Constraint checklist.
- Statement force.
- Expression budget.
- Device distribution limits.
- Alternatives table.
- Diff preview.
- Apply/copy/pin/reject actions.

Acceptance:

- User can compare multiple rewrite options without chat.
- User can apply one suggestion and see the document update.
- Version can be pinned before or after applying a suggestion.
- User can control how forceful the rewrite is and how many strongest
  expressions are allowed.
- User can see whether the rewrite reduced density and repetition.

### Packet 3: Master Data Workbench

Rebuild Patterns and Styles as a structured workbench:

- Pattern/style list.
- Detail editor.
- Expression policy, preview, and version panel.

Acceptance:

- User can inspect platform patterns.
- User can fork and edit a pattern.
- User can define style-level expression policies.
- User can preview the resulting constraint prompt.
- User can define which repeated moves count as overused for the density lens.

## Non-Goals

- Review queues.
- Assignee workflows.
- Team SLA dashboards.
- Broad workspace analytics.
- Feed mechanics.
- Streaks or engagement loops.
- Chat-first rewrite UI.

## Mockup Directions To Explore

Generate prototypes for:

- Editor cockpit with narrow inspector.
- Rewrite comparison inspector.
- Full-screen rewrite focus mode.
- Pattern master-data workbench.
- Style and expression policy workbench.
- Version comparison inside the editor.

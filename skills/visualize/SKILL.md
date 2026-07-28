---
name: visualize
description: "[Deprecated] Open room diagrams in the browser (use /mos:dashboard --mermaid)"
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Generate visualizations of your room's graph (deprecated: use /mos:dashboard --mermaid)."
argument-hint: "[structure|graph|chart]"
body_shape: D (Document View)
hitl_shape: "F.1"
hitl_why: "A rendered view offers one next move on what to open next."
serves_jtbd: ["audit-room", "prepare-pitch"]
deprecated: true
deprecated_redirect: "dashboard --mermaid"
deprecated_removal: "v1.14.0"
teaching: "Deprecated alias. Use /mos:dashboard --mermaid to open the De Stijl knowledge-graph viewer with Mermaid output; visualize folds into the dashboard surface. Scheduled removal: v1.14.0."
ui_reference: skills/ui-system/SKILL.md
allowed-tools: Bash Read AskUserQuestion
# --- Phase 172-16 CIRS R1 exclude (Canon Part 11; deprecated-redirect, navigator-directed 2026-06-23) ---
connector:
  excluded: true
  reason: "Deprecated - redirects to /mos:dashboard --mermaid; scheduled removal v1.14.0. Retained only for compatibility, so it carries no problem-state trigger."
---

<!-- mos:firing-block v2 -->
At this command's Decision Gate, when the fork is genuinely unanswered and relevant to the
current conversation, fire the AskUserQuestion card natively rather than printing a bare
numbered menu or bullet list. Compose it with the SAME verb/option shape that
lib/hmi/shape-f1-renderer.cjs (renderShapeF1) produces and that lib/hmi/selector-dispatcher.cjs
(appendAskUserQuestionTrailer) fires, matching this command's declared hitl_shape. Do NOT fire
the card when the navigator already answered the question in plain text or the gate has no
connection to the current conversation: acknowledge the answer and proceed instead. Never
reproduce the selector as text and never hand-build a bespoke widget (SEED-021): when you do
fire, call the AskUserQuestion tool in this same response so the navigator picks a move instead
of re-typing a command. Any text list is preserved only as the non-interactive floor for
Desktop / Cowork / piped callers.
<!-- /mos:firing-block -->

# /mos:visualize

> Deprecated. /mos:visualize now redirects to /mos:dashboard --mermaid. Scheduled removal: v1.14.0. Use /mos:dashboard --mermaid going forward.

You are Larry. The user invoked /mos:visualize. Per D-09 + the Phase 121.5-08 planner decision (LOCKED 2026-05-16, Sub-plan J) /mos:visualize is a soft-alias stub for the v1.13.x window. The canonical surface is /mos:dashboard --mermaid.

## Steps

1. Emit the deprecation note above as a single cyan line (Larry voice; no em-dash; one sentence per skills/ui-system/SKILL.md Section 6).

2. Invoke /mos:dashboard --mermaid with the user's original arguments. Run:

```bash
node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/soft-alias-runner.cjs" --from visualize --to "dashboard --mermaid" --remaining-args $ARGUMENTS
```

The runner emits `{redirect, deprecation_note, args, ok}`. Use the redirect to confirm the target, then proceed with /mos:dashboard --mermaid behavior. The user sees ONE deprecation note + the dashboard render (browser open OR Mermaid code block fallback).

3. Pass through dashboard's output verbatim. The dashboard already renders the room as Cytoscape; the --mermaid flag adds the Mermaid code-block fallback that /mos:visualize used to provide.

## Why this is a soft-alias

Cluster 5 audit (2026-05-15) flagged that /mos:visualize and /mos:dashboard both rendered the room's graph. The dashboard already opens the Cytoscape viewer; visualize's Mermaid output is one render mode of the same underlying graph. Folding visualize into /mos:dashboard --mermaid collapses the surface area while preserving every render mode (room structure, knowledge graph, methodology chain, meeting timeline).

Per D-09 the old command stays as a soft-alias stub for v1.13.x; removal is scheduled v1.14.0. CHANGELOG announces the rename.

## Cross-references

- `commands/dashboard.md` -- the canonical target with --mermaid as a render flag.
- `scripts/soft-alias-runner.cjs` -- the shared runner.
- Canon Part 7 (Reuse Before Build) -- consolidation rationale.

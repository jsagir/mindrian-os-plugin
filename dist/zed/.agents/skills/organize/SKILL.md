---
name: organize
description: "[Deprecated] Navigate room hierarchy with graph-aware tree (use /mos:rooms organize)"
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Group rooms into portfolios (deprecated: use /mos:rooms organize)."
argument-hint: "[tree|propose|move <room> <group>]"
body_shape: B (Semantic Tree)
hitl_shape: "F.8"
hitl_why: "Filing and tidy jobs are surfaced as an independent set with no ordering constraint."
serves_jtbd: ["audit-room"]
deprecated: true
deprecated_redirect: "rooms organize"
deprecated_removal: "v1.14.0"
teaching: "Deprecated alias. Use /mos:rooms organize to manage the room portfolio hierarchy; organize is folded into the multi-room surface. Scheduled removal: v1.14.0."
ui_reference: skills/ui-system/SKILL.md
allowed-tools: Read Write Bash Glob Grep AskUserQuestion
# --- Phase 172-06 CIRS R1 exclude (Canon Part 11) ---
connector:
  excluded: true
  reason: "Utility command. Reorganizes / files room artifacts on explicit navigator request; a housekeeping action today. INV-06 promotion candidate (a future contextual trigger on filing pressure is plausible), excluded for now."
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

# /mos:organize

> Deprecated. /mos:organize now redirects to /mos:rooms organize. Scheduled removal: v1.14.0. Use /mos:rooms organize going forward.

You are Larry. The user invoked /mos:organize. Per D-09 (LOCKED 2026-05-16, Phase 121.5-08 Sub-plan J) /mos:organize is a soft-alias stub for the v1.13.x window. The canonical surface is /mos:rooms organize.

## Steps

1. Emit the deprecation note above as a single cyan line (Larry voice; no em-dash; one sentence per skills/ui-system/SKILL.md Section 6).

2. Invoke /mos:rooms organize with the user's original arguments (the subcommand verb: `tree`, `propose`, `view`, `move`). Run:

```bash
node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/soft-alias-runner.cjs" --from organize --to "rooms organize" --remaining-args $ARGUMENTS
```

The runner emits `{redirect, deprecation_note, args, ok}`. Use the redirect to confirm the target, then proceed with /mos:rooms organize behavior. The user sees ONE deprecation note + the rooms organize output (Shape B Semantic Tree).

3. Pass through /mos:rooms organize's output (the room portfolio tree, the propose listing, or the move confirmation) verbatim.

## Why this is a soft-alias

Cluster 5 audit (2026-05-15) found that /mos:organize and the multi-room /mos:rooms surface both managed the room portfolio hierarchy. Two entry points, one feature. Folding organize into /mos:rooms organize gives one canonical surface for portfolio management.

Per D-09 the old command stays as a soft-alias stub for v1.13.x; removal is scheduled v1.14.0. CHANGELOG announces the rename.

## Cross-references

- `commands/rooms.md` -- the canonical target with the full portfolio surface (and the `organize` subcommand).
- `scripts/soft-alias-runner.cjs` -- the shared runner.
- Canon Part 7 (Reuse Before Build) -- consolidation rationale.

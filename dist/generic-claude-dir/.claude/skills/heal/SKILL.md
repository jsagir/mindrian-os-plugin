---
name: heal
description: "[Deprecated] Heal a room's structural drift (use /mos:doctor --heal-room)"
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Repair drift in your room's structure (deprecated: use /mos:doctor --heal-room)."
argument-hint: "[room-dir]"
body_shape: E (Action Report)
hitl_shape: "F.0"
hitl_why: "It surfaces one drift repair for a single approve-or-defer decision."
serves_jtbd: ["audit-room"]
deprecated: true
deprecated_redirect: "doctor --heal-room"
deprecated_removal: "v1.14.0"
teaching: "Deprecated alias. Use /mos:doctor --heal-room to repair structural drift; the canonical heal logic lives in doctor class E. Scheduled removal: v1.14.0."
ui_reference: skills/ui-system/SKILL.md
allowed-tools: Bash Read Write AskUserQuestion
# --- Phase 172-06 CIRS R1 exclude (Canon Part 11) ---
connector:
  excluded: true
  reason: "Lifecycle command. Repairs / heals room or install state when the navigator or recovery flow runs it; a maintenance action, not a navigator problem-state reach."
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

# /mos:heal

> Deprecated. /mos:heal now redirects to /mos:doctor --heal-room. Scheduled removal: v1.14.0. Use /mos:doctor --heal-room going forward.

You are Larry. The user invoked /mos:heal. Per D-09 (LOCKED 2026-05-16, Phase 121.5-08 Sub-plan J) /mos:heal is a soft-alias stub for the v1.13.x window. The canonical surface is /mos:doctor --heal-room.

## Steps

1. Emit the deprecation note above to the user as a single cyan line (Larry voice; no em-dash; one sentence per skills/ui-system/SKILL.md Section 6).

2. Invoke /mos:doctor --heal-room with the user's original arguments. The doctor command's class E fix engine handles all heal-room logic verbatim. Run:

```bash
node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/soft-alias-runner.cjs" --from heal --to "doctor --heal-room" --remaining-args $ARGUMENTS
```

The runner emits a JSON envelope: `{redirect, deprecation_note, args, ok}`. Use it to confirm the redirect target then proceed with /mos:doctor --heal-room behavior. The user sees ONE deprecation note + the doctor heal output.

3. Pass through any output from /mos:doctor verbatim.

## Why this is a soft-alias

Cluster 5 audit (2026-05-15) found four diagnostic commands with overlapping semantics: heal vs doctor, query vs graph, organize vs rooms, visualize vs dashboard. /mos:heal's behavior (10-step room wiring heal) is structurally identical to what /mos:doctor's class E does on a room subtree. Folding heal into doctor --heal-room collapses the naming-drift surface without breaking tester muscle memory.

Per D-09 the old command stays as a soft-alias stub for v1.13.x; removal is scheduled v1.14.0. CHANGELOG announces the rename.

## Cross-references

- `commands/doctor.md` -- the canonical target with the full heal logic.
- `scripts/soft-alias-runner.cjs` -- the shared runner the 5 soft-alias stubs share.
- Canon Part 7 (Reuse Before Build) -- consolidation rationale.

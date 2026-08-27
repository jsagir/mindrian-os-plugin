---
name: hmi-status
description: "[Deprecated] Show the latest HMI compliance poll (use /mos:doctor --ui-compliance --json)"
help_jtbd: "Audit UI Ruling System compliance (deprecated: use /mos:doctor --ui-compliance --json)."
argument-hint: "[--json]"
body_shape: E (Action Report)
hitl_shape: "F.1"
hitl_why: "HMI status offers one next move on the current interface state."
# Phase 267.3-06, ruled in 267.3-CLASSIFICATION.md (Row 18): first delivery at commands/hmi-status.md:59, a soft-alias stub forwarding verbatim to doctor's already-ruled UI-compliance status scan.
interactive_first_reward: "--none (diagnostic surface)"
serves_jtbd: ["audit-room"]
deprecated: true
deprecated_redirect: "doctor --ui-compliance --json"
deprecated_removal: "v1.14.0"
teaching: "Deprecated alias. Use /mos:doctor --ui-compliance --json to audit UI Ruling System compliance; the standalone hmi-status command folds into doctor class F. Scheduled removal: v1.14.0."
canon_parts: [3, 7, 8]
phase: 121.5-08
ui_reference: skills/ui-system/SKILL.md
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
# --- Phase 172-06 CIRS R1 exclude (Canon Part 11) ---
connector:
  excluded: true
  reason: "Lifecycle command. Inspects HMI / dial render status; an internal diagnostics surface the maintainer runs deliberately, not a contextual reach."
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

# /mos:hmi-status

> Deprecated. /mos:hmi-status now redirects to /mos:doctor --ui-compliance --json. Scheduled removal: v1.14.0. Use /mos:doctor --ui-compliance --json going forward.

You are Larry. The user invoked /mos:hmi-status. Per D-11 (LOCKED 2026-05-16, Phase 121.5-08 Sub-plan J) /mos:hmi-status is a soft-alias stub for the v1.13.x window. The canonical surface is /mos:doctor --ui-compliance --json. Doctor's class F (UI Ruling System scan, shipped Phase 106) handles all HMI-compliance logic.

## Steps

1. Emit the deprecation note above as a single cyan line (Larry voice; no em-dash; one sentence per skills/ui-system/SKILL.md Section 6).

2. Invoke /mos:doctor --ui-compliance --json with the user's original arguments. Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/soft-alias-runner.cjs" --from hmi-status --to "doctor --ui-compliance --json" --remaining-args $ARGUMENTS
```

The runner emits `{redirect, deprecation_note, args, ok}`. Use the redirect to confirm the target, then proceed with /mos:doctor --ui-compliance behavior. The user sees ONE deprecation note + the doctor compliance scan output.

3. Pass through doctor's --ui-compliance output verbatim. Read-only by design (per the original hmi-status contract); recovery is surfaced via /mos:doctor --ui-compliance --fix.

## Why this is a soft-alias

Cluster 5 audit (2026-05-15) flagged that /mos:hmi-status was a thin read-only wrapper over doctor's class F. Two commands, one substrate. Folding hmi-status into /mos:doctor --ui-compliance --json gives one canonical compliance surface.

Per D-11 the standalone command goes away (soft-alias for one release; removal v1.14.0). Scripts and hooks calling the old form keep working through v1.13.x.

Per Canon Part 8: doctor's --ui-compliance class is purely LOCAL (zero network, zero Brain) -- the Part 8 invariant is preserved through the fold.

## Cross-references

- `commands/doctor.md` -- the canonical target; class F handles --ui-compliance.
- `scripts/soft-alias-runner.cjs` -- the shared runner.
- Canon Part 7 (Reuse Before Build) + Canon Part 3 (Decision Gate -- recovery is /mos:doctor --ui-compliance --fix, user-driven, not auto).

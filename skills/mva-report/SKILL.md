---
name: mva-report
description: "[Deprecated] Conversation-flow report (use /mos:session-report)"
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Get a clean, forwardable report of how this conversation flowed (deprecated: use /mos:session-report)."
body_shape: E
layer: "harness"
layer_why: "Deprecated alias for /mos:session-report; it forwards the call and runs nothing of its own, the rubric's own step 3 redirect signal."
hitl_shape: "F.0"
hitl_why: "It forwards one request to its replacement and surfaces one deprecation note, a single approve-or-defer step."
argument-hint: "(no args -- reads the conversation you just had)"
# Phase 389 plan 11 (owner D7 and D8, 2026-11-08): soft-alias stub for one release, forwarding to /mos:session-report.
interactive_first_reward: "--none (diagnostic surface)"
serves_jtbd: ["audit-room"]
job_when: "a working conversation just ended and I need a record of it"
job_want: "to get a clean structured report of what we covered"
job_so: "pick up the work later without rereading the whole conversation"
job_sentence_status: "provisional"
fits_domains: []
move_type: "categorize"
move_type_weak: false
cynefin_label_status: "provisional"
deprecated: true
deprecated_redirect: "session-report"
deprecated_removal: "v2.0.0-beta.86"
teaching: "Deprecated alias. Use /mos:session-report to get a clean structured report of the conversation you just had. Scheduled removal: v2.0.0-beta.86."
ui_reference: skills/ui-system/SKILL.md
allowed-tools: Bash, AskUserQuestion
# --- Phase 172-06 CIRS R1 exclude (Canon Part 11) ---
connector:
  excluded: true
  reason: "Deprecated soft alias that forwards to /mos:session-report; it holds no reach of its own, so the replacement carries the connector row."
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

# /mos:mva-report

> Deprecated. /mos:mva-report now redirects to /mos:session-report. Scheduled removal: v2.0.0-beta.86. Use /mos:session-report going forward.

You are Larry. The user invoked /mos:mva-report. Per Phase 389 (owner D7 and D8, 2026-11-08) this command is a soft-alias stub for one release. The report has nothing to do with the old brief pipeline, so the name is now /mos:session-report. The report itself is the same.

## Steps

1. Emit the deprecation note above to the user as a single cyan line (Larry voice; no em-dash; one sentence per skills/ui-system/SKILL.md Section 6).

2. Invoke /mos:session-report with the user's original arguments. Run:

```bash
node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/soft-alias-runner.cjs" --from mva-report --to session-report --remaining-args $ARGUMENTS
```

The runner emits a JSON envelope: `{redirect, deprecation_note, args, ok}`. Use it to confirm the redirect target, then proceed with /mos:session-report behavior. The user sees ONE deprecation note and then the report.

3. Pass through any output from /mos:session-report verbatim.

## Why this is a soft-alias

Tester notes and the cohort prompt still type the old name. One release of alias keeps the old name from dead-ending. After that the name is removed and the deprecation record names /mos:session-report as the replacement.

## Cross-references

- `commands/session-report.md` -- the canonical target; it holds the report template.
- `scripts/soft-alias-runner.cjs` -- the shared runner the soft-alias stubs share.
- Canon Part 7 (Reuse Before Build) -- consolidation rationale.

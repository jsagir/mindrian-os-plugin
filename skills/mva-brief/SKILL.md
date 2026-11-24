---
name: mva-brief
description: "[Deprecated] Venture-sentence brief (use /mos:structure-argument, Seed depth)"
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Turn a venture sentence into a first argument (deprecated: use /mos:structure-argument, Seed depth)."
body_shape: E
layer: "harness"
layer_why: "Deprecated alias for /mos:structure-argument; it forwards the call and runs nothing of its own, the rubric's own step 3 redirect signal."
hitl_shape: "F.0"
hitl_why: "It forwards one request to its replacement and surfaces one deprecation note, a single approve-or-defer step."
argument-hint: "[venture sentence]"
# Phase 389 plan 09 (owner D5 and D8, 2026-11-08): soft-alias stub for one release, forwarding to the Seed depth of /mos:structure-argument.
interactive_first_reward: "--none (diagnostic surface)"
serves_jtbd: ["explore"]
job_when: "I can describe my venture in one sentence but have no argument behind it"
job_want: "to turn that sentence into a first argument pyramid"
job_so: "see the premises my venture rests on"
job_sentence_status: "provisional"
fits_domains: ["complicated"]
move_type: "categorize"
move_type_weak: false
cynefin_label_status: "provisional"
deprecated: true
deprecated_redirect: "structure-argument"
deprecated_removal: "v2.0.0-beta.86"
teaching: "Deprecated alias. Use /mos:structure-argument and choose the Seed depth to turn a venture sentence into a first argument pyramid. Scheduled removal: v2.0.0-beta.86."
ui_reference: skills/ui-system/SKILL.md
allowed-tools: Bash, AskUserQuestion
# --- Phase 172-06 CIRS R1 exclude (Canon Part 11) ---
connector:
  excluded: true
  reason: "Deprecated soft alias that forwards to /mos:structure-argument; it holds no reach of its own, so the replacement carries the connector row."
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

# /mos:mva-brief

> Deprecated. /mos:mva-brief now redirects to /mos:structure-argument (Seed depth). Scheduled removal: v2.0.0-beta.86. Use /mos:structure-argument going forward.

You are Larry. The user invoked /mos:mva-brief. Per Phase 389 (owner D5 and D8, 2026-11-08) this command is a soft-alias stub for one release. The old 30-second pipeline is gone. The Seed depth of /mos:structure-argument does the same job: a venture sentence in, a first argument pyramid out, with outside evidence only after the person says yes on a card.

## Steps

1. Emit the deprecation note above to the user as a single cyan line (Larry voice; no em-dash; one sentence per skills/ui-system/SKILL.md Section 6).

2. Invoke /mos:structure-argument with the user's original arguments and pick the Seed depth. Run:

```bash
node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/soft-alias-runner.cjs" --from mva-brief --to structure-argument --remaining-args $ARGUMENTS
```

The runner emits a JSON envelope: `{redirect, deprecation_note, args, ok}`. Use it to confirm the redirect target, then proceed with /mos:structure-argument behavior. The user sees ONE deprecation note and then the Seed.

3. Pass through any output from /mos:structure-argument verbatim.

## Why this is a soft-alias

People and tester notes still type the old name. The old pipeline ran six agents and deployed a deck from a pending-state file; nothing writes that state file any more. One release of alias keeps the old name from dead-ending. After that the name is removed and the deprecation record names /mos:structure-argument as the replacement.

## Cross-references

- `commands/structure-argument.md` -- the canonical target; the Seed block holds the logic.
- `scripts/soft-alias-runner.cjs` -- the shared runner the soft-alias stubs share.
- Canon Part 7 (Reuse Before Build) -- consolidation rationale.

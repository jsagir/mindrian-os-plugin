---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
plan: 30
subsystem: ui-shell
tags: [journey, e2e, counter-metrics, human-verify, d-08, shell369-11, cm369-03]
requires: [369-28, 369-29]
provides:
  - tests/e2e-369/journey.cjs (the one recoverable journey on the built, shipped shell, plus a --navigator mode)
  - 369-COUNTER-METRICS.md section "Gate latency and recovery (CM369-03)"
  - 369-MANUAL-VERIFICATION.md (the navigator's click test, Canon v3 review and D-03 line, 2026-10-04)
affects: [369-31]
requirements: [SHELL369-11, CM369-03]
canon_parts: [3, 8, 9, 12]
key-files:
  created:
    - tests/e2e-369/journey.cjs
    - .planning/phases/369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-/369-MANUAL-VERIFICATION.md
  modified:
    - .planning/phases/369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-/369-COUNTER-METRICS.md
key-decisions:
  - "The restart re-answer wording is recorded as a fact, not faked: the browser shows 'This decision is no longer open' for an old gate id after a shell restart; the room itself replays (gate_answer ok:true, replayed:true, one node)."
  - "The navigator's verdict is recorded verbatim ('approved', 2026-10-04); host build numbers are marked 'not reported'; no observations were invented."
metrics:
  tasks: 3
  commits: 2
  completed: 2026-10-04
---

# Phase 369 Plan 30: The one recoverable journey, measured and signed off Summary

The built shell passes the automated recoverable journey (gate click to recorded 81 ms, restart catch-up 2857 ms, 0 lost writes) and the navigator approved the click test, the Canon v3 visual review and the Desktop and Cowork line on 2026-10-04, with two gate-hop gaps recorded for gap planning.

## Tasks

| Task | Name | Commit |
|------|------|--------|
| 1 | The one recoverable journey against the shipped shell, with the gate-latency counts | c5fef8527 |
| 2 | Navigator verification (checkpoint:human-verify): verdict "approved", 2026-10-04 | none (no file; recorded in Task 3) |
| 3 | Record the manual verification | 3b86421da |

## Counts (CM369-03, counts only)

gate_click_to_recorded_ms 81 (six runs: 66 to 108); restart_catch_up_ms 2857 (2846 to 2872); lost_writes 0 in every run. Detail in 369-COUNTER-METRICS.md.

## Navigator verification

Verdict "approved" through the orchestrator's AskUserQuestion card, no notes. Shown: the signed-in navigator-mode window on a throwaway fixture room, the 31 screenshots (with the two composition items from plan 29: the 390 px "Stay here" two-line wrap, and the Work screens collapsing 8+4 to one column), and the D-03 two sentences for Cowork and Desktop (ruling `Desktop delivery: room_list tool description`, no amendment). Real-room mtime check not applicable (fixture room). Host build numbers: not reported.

## Deviations from Plan

Task 1 (recorded from the checkpoint hand-off):

1. **[Rule 3 - Blocking] A `--navigator` mode was added to `journey.cjs`.** Task 2 needs a signed-in browser window on a fixture room with a gate ready to press; nothing in the shipped shell can raise one (see Gap 1), so the mode starts the shell with `MOS_PROPOSAL_SOURCE=adapter`, calls the `askClaude` action directly and keeps the window open until the navigator closes it.
2. **[Fact recorded, not faked] The restart re-answer wording.** After a shell restart the browser shows "This decision is no longer open... Nothing was saved. Ask Larry in Claude Code to raise it again." for an old gate id, not "This decision was already recorded." The journey asserts what the shell really does and records the difference as Gap 2 rather than shaping the test to the plan's expected wording.
3. **Bare HTML in a document is dropped by the display.** The hostile-markup document renders inert and the markup is not shown as text (it is removed, not echoed). T-369-30-03 holds (`window.__pwned` stays undefined); the plan's "renders as text" is met as "inert".

## Gaps for /gsd-plan-phase --gaps

Both are in 369-MANUAL-VERIFICATION.md:

1. The shipped shell has no browser control that raises a gate (`askClaude` exists, nothing in `ui/shell/client` calls it; a default `launch.cjs start` runs `MOS_PROPOSAL_SOURCE=fixed` and answers `no_proposal`). The ADAPTER-RULING hop "the shell raises the gate on the browser session" is not built.
2. After a shell restart an old gate id shows "no longer open" instead of "already recorded" (gate records are in memory; page-side `approveDecision` is refused `human_only` and writes nothing; the room replays correctly with one node).

## run-all-369 result

Second run: PASS=53 FAIL=1 SKIP=1. The one FAIL is the sharp payload ceiling, ruled into Phase 369.1 D-16 (not this plan's). The first run showed one extra FAIL, most likely the views arms 11-12 load flake; it was not captured, so the cause is a judgment, not a measurement.

## Known Stubs

None in this plan's files.

## Threat Flags

None. T-369-30-06 mitigated by using a throwaway fixture room (no real room touched).

## Self-Check: PASSED

- tests/e2e-369/journey.cjs present, commit c5fef8527 exists
- 369-MANUAL-VERIFICATION.md present, commit 3b86421da exists
- STATE.md and ROADMAP.md not modified by this plan

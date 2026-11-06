---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "30"
subsystem: egress-guard
tags: [part8, fail-closed, outage-log, e-fail]
requires: ["386-29", "386-04"]
provides:
  - Hook exit 2 with reason guard_unavailable when the guard cannot run
  - callTool and query() return egress_guard_unavailable with 0 network calls
  - lib/core/part8-outage-log.cjs, one count-only line per outage
affects: [386-27]
key-files:
  created:
    - lib/core/part8-outage-log.cjs
    - tests/test-386-guard-fails-closed.cjs
  modified:
    - scripts/part8-egress-guard-hook.cjs
    - lib/core/brain-client.cjs
    - tests/part8-egress-guard-hook.test.cjs
    - .planning/debug/part8-guard-fails-open-on-load-or-throw.md
key-decisions:
  - "Owner decision option A plus outage-count: yes (plan 386-29, 2026-11-06). The earlier A3 and T6 accepted risk is reversed."
  - "The hook fails closed only after a Brain-shaped tool input was read. Empty or unparsable stdin and a non-Brain tool name keep exit 0."
  - "A provably empty payload (plain object, no keys) proceeds in the hook and in callTool; the check does not depend on the guard."
requirements-completed: [E-FAIL]
duration: 50min
completed: 2026-11-06
---

# Phase 386 Plan 30: Guard fails closed Summary

The Part 8 guard now fails closed. A guard that cannot load or classify blocks every payload-carrying Brain call with a typed reason and writes one count-only outage line.

## What changed

- Hook: sanitizer load failure, guard load failure, classify throw, an invalid verdict and an uncaught error after the input was read all exit 2. The message is "Canon Part 8: the egress guard could not run (reason guard_unavailable). Nothing was sent." and carries no payload byte.
- callTool and query(): the belt catch returns `{ error: 'egress_guard_unavailable', tool }` with 0 fetch calls and no session init. An invalid verdict is treated as an outage. callTool lets a provably empty payload proceed.
- Outage line: `~/.mindrian/telemetry/part8-guard-outage.log`, format `<ISO timestamp ms Z> <brain|web|other> <mode>`. The module has Node built-ins only and loads lazily in the failure branch, so a healthy run loads nothing new.

## TDD record

- RED: c19a5ba36. 13 of 17 arms fail (FC1 to FC3, FC5, FC7, FC9 to FC14, FC16, FC17 partly); FC4, FC6, FC8, FC15 pass.
- GREEN: aeb2935e2. 17 of 17 arms pass.

## Verification (PROVEN)

- `node tests/test-386-guard-fails-closed.cjs`: ALL PASS.
- `node tests/part8-egress-guard-hook.test.cjs`: pass (garbage stdin assertion kept).
- `bash tests/run-all-196.sh`: 7 of 7 on the rerun. The first run had 1 red (test-260917-dgf LEG3-1, class room_check_unavailable); 3 solo reruns and a second full run were green. It matches the unexplained transient in the plan 386-29 RCA. Not shown to be caused by this change (UNVERIFIED).
- `node tests/test-3692-guard-survey-gate.cjs`: GATE: PASS before and after; every DELTA line equal to its baseline.
- `node tests/test-254-ambiguous-disclosure.cjs`, `node tests/test-239-query-egress-canary.cjs`: pass.
- `bash tests/run-all-386.sh`: PASS=25 FAIL=0 (baseline PASS=23, plus this test and a peer test).

## Deviations from Plan

None in behavior. Two small additions to the test beyond the listed arms: FC16 (invalid verdict and uncaught error) and FC17 (empty payload and garbage stdin keep exit 0). The hook test file needed only a header comment change; no assertion expected exit 0 for a guard failure.

## Not changed (for plan 386-27 and the next owner review)

The direct guard calls in brain-client.cjs outside callTool and query() (hatAwareRecommend, suggestValidationSteps, sendPacket, the typed freeform gate) keep their own catch behavior. They are out of this plan. Every one of them reaches callTool afterward, which now fails closed.

## Self-Check: PASSED

---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
plan: 31
subsystem: close-out
tags: [close-out, requirements, validation, compositing, phase-gate]
requires: [369-11, 369-12, 369-30]
provides:
  - 369-CLOSE-GATE.md (the gate run, core e2e legs, reds with owners, D-01..D-19 trace, gaps, open navigator items)
  - 369-VALIDATION.md signed off to measured status (76 rows, wave_0_complete true, nyquist_compliant false)
  - 58 of 59 Phase 369 requirement rows closed with Measured lines in .planning/REQUIREMENTS.md
  - research trail entry 2026-10-04-phase-369-ui-shell-close-out.md (mirror written; room copy blocked)
affects: [369.1-16]
requirements-completed: [TS369-01, TS369-02, TS369-03, TS369-04, TS369-05, TS369-06, TS369-07, CHG369-01, CHG369-02, CHG369-03, CHG369-04, CHG369-05, CHG369-06, FEED369-01, FEED369-02, FEED369-03, FEED369-04, FEED369-05, SESS369-01, SESS369-02, SESS369-03, SESS369-04, GREC369-01, GREC369-02, GREC369-03, GREC369-04, GREC369-05, HUM369-01, HUM369-02, HUM369-03, RXP369-01, RXP369-02, RXP369-03, CANON369-01, CANON369-02, CANON369-03, CANON369-04, CANON369-05, CANON369-06, CANON369-07, SHELL369-01, SHELL369-02, SHELL369-03, SHELL369-04, SHELL369-05, SHELL369-06, SHELL369-07, SHELL369-08, SHELL369-09, SHELL369-10, SHELL369-11, BAKE369-01, BAKE369-02, BAKE369-03, BAKE369-04, CM369-01, CM369-02, CM369-03]
requirements-open: [TS369-08]
canon_parts: [6, 7, 8, 9, 11]
key-files:
  created:
    - .planning/phases/369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-/369-CLOSE-GATE.md
    - /home/jsagi/MindrianOS/research/2026-10-04-phase-369-ui-shell-close-out.md
  modified:
    - .planning/phases/369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-/369-VALIDATION.md
    - .planning/REQUIREMENTS.md
metrics:
  tasks: 2
  commits: 3
  completed: 2026-10-04
---

# Phase 369 Plan 31: Phase close, gate run and requirement record Summary

Phase 369 is closed with named exceptions: the gate ran and the shell's core legs all passed, 58 of 59 requirement rows are closed with measured proof, and four items stay red or blocked and are named below rather than papered over.

## What ran

`bash tests/run-all-369.sh` PASS=54 FAIL=1 SKIP=1 (the FAIL is the sharp payload ceiling, the SKIP is the exact-floor install leg). The other eight gate commands: run-all-267 PASS=28 FAIL=3 SKIP=3, run-all-238 PASS=10 FAIL=0, run-all-198 15 passed 1 failed, connector registry, orchestration projection, render coverage and shape declaration all exit 0, `doctor --acceptance` 21 of 22. All five core e2e legs (replica, gate-button, egress-and-canon, journey, and HTTP arm 8 of the human-only test) RAN and passed in the close-gate run (exit 0, none 77). Every number and the D-01..D-19 trace are in `369-CLOSE-GATE.md`.

Beyond the aggregator, every one of the 76 per-task VALIDATION rows had its own automated command run in this session (70 swept, 4 e2e rows taken from their standalone runs, 2 are this plan's own), so each row carries a measured status, not an inherited one.

## Tasks

| Task | Name | Commit |
|------|------|--------|
| 1 | Phase gate run, close-gate record, D-01..D-19 trace, VALIDATION sign-off | 3e6009772 |
| 2 | Requirement rows closed with Measured lines; research trail (mirror filed, room copy blocked) | 1ef9084c2 (REQUIREMENTS.md); f9e76b85b in the home repo (`/home/jsagi`, mirror file only) |

## Files the next plan probes

369.1 plan 16 waits on this SUMMARY and on `369-CLOSE-GATE.md`: both exist at `.planning/phases/369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-/`. `git status --short -- .planning/REQUIREMENTS.md` prints nothing (committed), and `awk '/^### Phase 369 -/,/^### Phase 364/' .planning/REQUIREMENTS.md | grep -c "Measured:"` prints 58.

## Requirement rows

58 `[x]` with a dated Measured line, 1 `[ ]` with a stated reason: **TS369-08** (release-built dist, freshness gate and RULE wording are all proven, but its last clause "the payload ceiling still passes" is red on `sharp`, ruled into Phase 369.1 D-16 and D-16a "prune"). Judgment calls a reviewer may want to look at: TS369-03 is closed with the navigator's RULE 8 amendment named in its Measured line (next, react, react-dom are root dependencies); SHELL369-11 is closed with its limits stated (harness-raised gate, restart wording, 1 failing run in 10); SHELL369-09 and CANON369-06 are closed with their wording-only open items named.

## Deviations from Plan

**1. [Rule 3 - Blocking] The room copy of the research entry was not written.** The Write tool was refused by the mos `write-scope-check` hook: "write to rethinking-mindrianos denied. Active room is egain-des-liquid-conductor. To authorize, run: /mos:rooms switch rethinking-mindrianos". Switching the active room changes the user's room state and the authorization is the user's to give, so I did not switch, and I did not copy through Bash around the hook. Consequence: `cmp` of the two research copies cannot pass yet, and VALIDATION row 369-31-02 is recorded `red` for that reason. To finish: authorize the room write (or run the switch), then `cp /home/jsagi/MindrianOS/research/2026-10-04-phase-369-ui-shell-close-out.md /home/jsagi/MindrianRooms/rethinking-mindrianos/research/2026-10-04-phase-369-ui-shell-close-out.md`, `cmp` the two (must exit 0), and commit that one path in `/home/jsagi` the way commit `f9e76b85b` did for the mirror. Flip row 369-31-02 to green afterwards.

**2. [Plan text vs reality] Mirror path.** The orchestrator's brief named `/home/jsagi/dev/MindrianOS/research/`; that directory does not exist (that path is a separate checkout last touched in March 2026). The plan's path and the Phase 364 precedent commit both use `/home/jsagi/MindrianOS/research/`, so the mirror was written there and committed in the home repo with an explicit path.

**3. [Plan text vs reality] File name date.** The plan names `2026-10-02-phase-369-ui-shell-close-out.md`; the close happened on 2026-10-04, so both copies use `2026-10-04-phase-369-ui-shell-close-out.md` as the plan allows. Final names: `/home/jsagi/MindrianOS/research/2026-10-04-phase-369-ui-shell-close-out.md` (filed, committed `f9e76b85b`) and `/home/jsagi/MindrianRooms/rethinking-mindrianos/research/2026-10-04-phase-369-ui-shell-close-out.md` (not written, see deviation 1).

**4. [Plan text vs reality] `bash tests/run-all-369.sh` does not exit 0.** The acceptance criterion says the close stops and reports failing legs if FAIL is not 0. The one FAIL (sharp payload ceiling) is the navigator-ruled item the orchestrator told me to name rather than fix; I closed with it reported instead of stopping. A reviewer who reads the criterion strictly should treat this close as conditional.

**5. [Honest correction to the brief] Several reds were caused by 369, not pre-existing.** The brief grouped run-all-267's three fails with pre-existing or out-of-phase reds. Measured: the sharp ceiling and the lockfile lockstep come from plan 19's RULE 8 ruling (next, react, react-dom at the root), and the zod4 `room_list` description diff comes from plan 22's D-03 sentences; the pinned accepted set was not refreshed. They are named as phase-caused in `369-CLOSE-GATE.md`. Two have owners (sharp: 369.1 D-16) or none yet (lockstep, zod4).

**6. [Found by measurement] Stale `--built` assertion in the retired agent-native candidate.** `node tests/test-369-bakeoff-agent-native.cjs --built` exits 1 because it asserts a second approve of the same gate answers `answered:false`; since 369-26's idempotent replay it answers ok. The aggregator runs the static arms only, so it never showed. Not fixed (out of this plan's files); VALIDATION row 369-16-02 is red.

## Flakes found (counted)

- `tests/e2e-369/journey.cjs` step 6: 1 failure in 10 runs this session (60 s timeout waiting for the read copy to hold all 19 items); the other nine passed. Cause not established; load at the moment of failure was not captured.
- `tests/test-369-shell-actions.cjs`: one transient PASS=11 FAIL=6 inside a row sweep, not reproduced in four reruns.

## VALIDATION result

`wave_0_complete: true` (every Wave 0 row green; the exact-floor leg is an explained ENV GAP). `nyquist_compliant: false`: all five core e2e legs RAN and passed, but four rows are not green (369-13-03 zod4 `room_list`, 369-16-02 stale `--built` assertion, 369-28-02 sharp ceiling, 369-31-02 room copy). Close gaps are listed in the file.

## Gaps and open items (not closed here)

For `/gsd-plan-phase 369 --gaps`: the shell has no browser control that raises a gate; the restart re-answer wording ("no longer open" instead of "already recorded"); the journey step 6 intermittent timeout; the lockstep and zod4 reds. Open navigator items: the 404-page copy (369-20), the duplicate "Reconnect now" placement and the "Catching up" fallback wording (369-24), the `NOT_FOUND` copy, research A5 (Phase 289's, referenced). Out-of-phase reds named with owners in `369-CLOSE-GATE.md`: test-237, test-345-gate-ratify, test-363-mcp-tool M3, test-365-floor-gate, test-366 R6b, test-353 EVENT_TYPES (post-369 `/gsd-quick`); test-198-adapter-budget (scripts/on-stop 618 against 570, red since July); test-354 ledger beta.48 against beta.56.

## CHANGELOG hand-off (Phase 364 plan 13, follow-on A8)

`CHANGELOG.md` is clean in the tree and holds Phase 369's own `[Unreleased]` lines (plans 01 and 28). This plan did not edit it. From the commit of this SUMMARY, Phase 369 holds no claim on `CHANGELOG.md`, which is the gate 364-13 named (it asks the orchestrator to message jsagi-be and relay the reply; that decision is 364-13's).

## Known Stubs

None in this plan's files.

## Threat Flags

None. T-369-31-01 (no flip without a command): every Measured line names a command that ran this session, and TS369-08 stayed open. T-369-31-02 (skipped leg read as passed): the exact-floor leg and Phase 267's three ENV GAP legs are listed by name. T-369-31-03 (room content in the research entry): the entry carries architecture and counts only.

## Not touched, by instruction

STATE.md and ROADMAP.md, the Phase 369.1 files and DPI rows, the root package.json, any version, any release. No `gsd-tools state.*` or `roadmap` writer was run. The navigator-mode browser window from 369-30 was left open.

## Self-Check: PARTIAL

- FOUND: `369-CLOSE-GATE.md`, `369-VALIDATION.md` (commit 3e6009772), `.planning/REQUIREMENTS.md` (commit 1ef9084c2), `/home/jsagi/MindrianOS/research/2026-10-04-phase-369-ui-shell-close-out.md` (commit f9e76b85b in `/home/jsagi`).
- `git show --name-only` of 3e6009772 and 1ef9084c2 lists no STATE.md or ROADMAP.md (count 0).
- MISSING: `/home/jsagi/MindrianRooms/rethinking-mindrianos/research/2026-10-04-phase-369-ui-shell-close-out.md` (blocked by the write-scope hook, deviation 1); `cmp` of the two copies therefore not run.

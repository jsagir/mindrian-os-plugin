---
phase: 261029-lx3-sessionstart-reuse-state-md-and-a-cached
plan: 01
quick_id: 261029-lx3
subsystem: sessionstart-hooks
tags: [perf, session-start, doctor-throttle, analyze-room-cache]
status: COMPLETE
requires: [261029-kqv]
provides:
  - scripts/session-start-state (STATE.md reuse, analyze-room cache)
  - scripts/preflight-doctor.cjs throttled(id) (doctor at most once in 24 h per plugin version, detached)
  - scripts/analyze-room exits 0 when a frontmatter key is absent
key-files:
  created:
    - scripts/session-start-state
    - tests/test-261029-lx3-sessionstart-skip.cjs
  modified:
    - scripts/session-start
    - scripts/preflight-doctor.cjs
    - scripts/sessionstart-coordinator.cjs
    - scripts/analyze-room
decisions:
  - "CHANGELOG.md not edited: no valid warm set exists on the real room (see Task 3)"
completed: 2026-10-29
---

# Phase 261029-lx3 Plan 01: SessionStart reuse of STATE.md and the analyze-room result, doctor throttle Summary

Status is PARTIAL. The code, the new test and the doctor throttle work. The reuse of STATE.md and of the analyze-room cache works on a room that does not change, but the real room changes at every start, so the reuse does not pay there. A seventh file also needs a one line edit. Details follow. Every claim is marked PROVEN, UNVERIFIED or ASSUMED.

## Commits (4, none pushed)

| Order | Sha | Message |
|-------|-----|---------|
| 1 | d54e21bd3 | fix(261029-lx3): analyze-room exits 0 when a frontmatter key is absent |
| 2 | ab4f25f04 | test(261029-lx3): add failing test for the SessionStart state reuse, the analyze cache and the doctor throttle |
| 3 | abd946ae3 | perf(261029-lx3): reuse STATE.md and a cached analyze-room result on an unchanged room at session start |
| 4 | f52c52b2d | perf(261029-lx3): run the SessionStart doctor checks at most once a day per plugin version, detached |

PROVEN: all 4 shas are ancestors of HEAD (git merge-base --is-ancestor). Each commit used `git commit --only`. The 7 owned paths are clean in git status. The only untracked path is the peer file .planning/debug/379-1-1-10-large-room-drain-clock-breach.md, which was not touched.

## NEEDS_HUMAN (2 questions)

1. tests/test-359-prose-budget.cjs fails after this change. It pins the SHA of scripts/session-start without the NAV_CARD_FIRE_DOCTRINE line (constant SESSION_START_OUTSIDE_DOCTRINE). Any edit of session-start breaks it. The plan scope does not include that file, so it is not edited. PROVEN: the old pin 247f7746... equals the value at cc4da9301. PROVEN: the value for the new tree is 932a68acbcdad5b43bff71b9852485d4770645befcfe3ced253cb9a0fd6767e7. The peer edit of one identity-prefix line in session-start will move the pin again.
2. The room is not "unchanged" at the next start on the real room (see Task 3). Decide how to treat the files that SessionStart itself writes (FEYNMAN.md, MINTO.md, BRIEF.md, MEETINGS-INTELLIGENCE.md, action-items.md).

## Deviations from Plan

### Scope extension (approved by the orchestrator): analyze-room

**1. [Rule 3 - Blocking] analyze-room exit 1 on a room with no status: line**
- Cause (PROVEN): 7 `grep -m1 ... | xargs` command substitutions (lines 923, 943, 944, 963, 964, 987, 992) end a pipeline with no match. Under `set -euo pipefail` the assignment fails and the script stops.
- Fix: `|| true` added inside each substitution. 7 lines changed, 7 inserted. Nothing else changed. The scope text said "line 923 and the 7 similar lines". PROVEN: the file has 7 such lines in total with line 923 included. Line 609 already had `|| true`. No other `grep -m` exists.
- Real room (PROVEN): analyze-room before the fix exit 1 and 105 lines (planner measure). After the fix: exit 0, 114 lines, 79 GAP or CONVERGE lines, 16.6 s wall.
- Test case A6 added (fixture room with opportunity-bank/BRIEF.md without status:). PROVEN: the pre-fix script gives exit 1 on that fixture, the fixed script gives exit 0 (manual run against `git show d54e21bd3~1:scripts/analyze-room`).
- Order effect (PROVEN): the fix was committed before the RED test, so A6 passes in the RED run. The RED run had 1 ok line (A6) and 28 FAIL lines. All other cases failed as expected.
- Commit: d54e21bd3, `git commit --only -- scripts/analyze-room`.

### Other deviations

**2. [Rule 1 - Bug, in my own helper draft] none found at GREEN.** The 29 cases passed on the first GREEN run. PROVEN: 2 runs in a row, both "ALL PASS".

**3. Baseline order.** The "before" suite baseline includes the analyze-room fix (committed first). PROVEN: the baseline was run after commit ab4f25f04 and before any other production edit.

**4. Python used for two text edits.** session-start and preflight-doctor edits were made with a short python3 script that asserts each target text occurs the expected number of times. The diffs match the plan: session-start 4 lines changed, coordinator 2 map lines plus 1 comment line.

## Task 1: RED test and baseline

- tests/test-261029-lx3-sessionstart-skip.cjs, 736 lines, node built-ins only, no em-dash or en-dash (PROVEN).
- Cases: S1, S2, S3 x4, S4 x2, S5, A1, A2, A3 x3, A4 x2, A5, A6, P1, W1, W2, D1 to D8. That is 29 check lines.
- RED run (PROVEN): exit 1, 1 ok (A6), 28 FAIL.
- Baseline (PROVEN): 76 suite files in /tmp/claude-1000/-home-jsagi/f5142fde-6a56-4889-9ce0-822f4eb3c4d0/scratchpad/lx3/suite-list.txt. 67 passed, 9 failed before any production edit. git status was the same before and after the run.

Failed before the change (not caused by this plan):
lib/memory/mcp-server-brain-deps.test.cjs, lib/memory/minto-debounce-consumer-census.test.cjs, lib/memory/session-start-brain-staleness.test.cjs, lib/memory/session-start-triple-injection.test.cjs, tests/mcp-prompts-argsschema.test.cjs, tests/test-127.3-sibling-sweep.sh, tests/test-doctor-legacy-config-pin-drift.cjs, tests/test-l8g-theo-bare.cjs, tests/test-statusline-glyph-isolation.cjs.

## Task 2: GREEN, wiring, throttle

- scripts/session-start-state (new, mode 100755): `state` mode reads STATE.md when no room file changed (DD-1 to DD-3). `analyze` mode keeps the analyze-room stdout in .mindrian/analyze-room.cache (DD-4 to DD-6). Log in .mindrian/session-start-state.log (DD-7).
- scripts/session-start: 4 lines changed (PROVEN: 8 changed diff lines against cc4da9301).
- scripts/preflight-doctor.cjs: `throttled(id)`, stamp in ~/.mindrian/banner-state, 24 h window, detached `--refresh` child under an O_EXCL lock, telemetry in ~/.mindrian/telemetry/sessionstart-doctor-throttle.jsonl (DD-8 to DD-13). main(), runDoctor(), graphDeriveNudge() and contribute() are unchanged.
- scripts/sessionstart-coordinator.cjs: 2 map lines changed, 1 comment line added, 250 lines (limit 280). PROVEN.
- Gates (PROVEN, all exit 0): the new test twice; tests/test-198-adapter-budget.test.cjs; lib/memory/sessionstart-coordinator.test.cjs; tests/test-233-graph-derive-heal-retrofit.cjs; tests/test-341-retired-classes-a-h.cjs; tests/test-261029-kqv-stop-skip-recompute.cjs; tests/test-k1u-session-start-envelope.cjs; static checks (bash -n, node --check, no dash, find line, cache name).
- graph-derive-health, 3 runs from the real room cwd (PROVEN): 570 ms, 604 ms, 583 ms. The planner measured 599, 636 and 623 ms. All are above 300 ms, so install-drift is throttled (DD-9).

### Suite comparison, before and after (C-5)

Result files: .../scratchpad/lx3/before/results.txt and .../scratchpad/lx3/after/results.txt.

| File | Before | After | Reruns | Verdict |
|------|--------|-------|--------|---------|
| tests/test-359-prose-budget.cjs | 0 (pass) | 1 (fail) | 2 reruns, both exit 1 | REGRESSION, needs NEEDS_HUMAN 1 |
| the other 75 files | same | same | none needed | no change |

The failing check is "B5: session-start outside the doctrine line is byte-untouched". The other 17 checks of that file pass (PROVEN). No flaky result was seen. A fix inside the 4 files is not possible, because the test pins the bytes of session-start.

## Task 3: real room measurement (C-6)

Room: /mnt/c/Users/jsagi/MindrianRooms/israel-frontier-criticality/translational-capital-lab. PROVEN: resolve-room prints the same path.
Harness: the plan command, SKIP=sessionstart-npm-reconcile. Baseline from the orchestrator (PROVEN by them): median 23,407 ms, session-start 23,639 ms, coordinator 12,438 ms.
settings.json (PROVEN): copied to the scratchpad first. SHA-256 before and after all runs is identical (155dd561...). The detached doctor did not change it.
Load (PROVEN, uptime): 1.25 to 4.37 during the runs. At least 2 other Claude sessions and a beta.75 plugin recompile job ran on the machine. The numbers below are noisy.

### Cold run (stamps absent, first start)

```
SessionStart     hooks=8 wall median=12349 ms  min=12349  slowest: node "scripts/sessionstart-coordinator.cjs"=12342ms, "hooks/run-hook.cmd" session-start=6400ms
LOG: state mode=reuse reason=unchanged
LOG: analyze mode=hit reason=unchanged rc=0 cached=yes
TEL: install-drift mode=first-sync reason="no stamp"
TEL: onboarding mode=first-sync reason="no stamp"
```

PROVEN: the first-sync path ran both doctors once, in the foreground, and wrote both stamps. The analyze cache existed from an earlier call at 15:09 (written by a call that I did not start; UNVERIFIED source, likely a peer session using this dev tree), so this run hit.

### Warm set, attempt 1 (3 runs)

```
SessionStart     hooks=8 wall median=26775 ms  min=26640  slowest: "hooks/run-hook.cmd" session-start=27880ms, node "scripts/sessionstart-coordinator.cjs"=245ms
LOG: state mode=compute reason=newer:business-model/FEYNMAN.md
LOG: analyze mode=miss reason=newer:action-items.md rc=0 cached=yes
LOG: state mode=compute reason=newer:action-items.md
LOG: analyze mode=miss reason=newer:action-items.md rc=0 cached=yes
LOG: state mode=compute reason=newer:action-items.md
LOG: analyze mode=miss reason=newer:action-items.md rc=0 cached=yes
TEL (6 lines): install-drift and onboarding mode=fresh in all 3 runs
```

### Warm set, attempt 2 (after a new on-stop rebuild, state check said reuse)

```
SessionStart     hooks=8 wall median=47102 ms  min=42519  slowest: "hooks/run-hook.cmd" session-start=53986ms, node "scripts/agentshield-sessionstart-scan.=861ms
LOG: state reuse | analyze miss reason=state rc=0 cached=yes
LOG: state compute newer:business-model/FEYNMAN.md | analyze miss reason=state rc=0 cached=yes
LOG: state compute newer:business-model/FEYNMAN.md | analyze miss reason=newer:action-items.md rc=0 cached=yes
TEL: 6 lines, all mode=fresh
```

### Warm set, attempt 3

```
SessionStart     hooks=8 wall median=49782 ms  min=45438  slowest: "hooks/run-hook.cmd" session-start=57598ms, node "scripts/agentshield-sessionstart-scan.=1044ms
LOG: state compute newer:action-items.md | analyze miss reason=state
LOG: state reuse unchanged | analyze miss reason=state
LOG: state compute newer:business-model/FEYNMAN.md | analyze miss reason=newer:action-items.md
TEL: 6 lines, all mode=fresh
```

No set is valid (the rule needs 3 of 3 state lines with mode=reuse). The plan says to not edit CHANGELOG.md in this case. CHANGELOG.md was not edited (PROVEN: git status clean).

### Why no set is valid (root cause, PROVEN by a direct run)

A run of `hooks/run-hook.cmd session-start` alone on the real room (58.9 s wall, loaded machine) left these non-hidden files newer than a reference file made before the run: MEETINGS-INTELLIGENCE.md, action-items.md, and BRIEF.md, FEYNMAN.md and MINTO.md in each section. The writers are inside the SessionStart event: compute-state writes action-items.md and MEETINGS-INTELLIGENCE.md; the feynman timeline refresh (scripts/session-start line 1553, lib/core/feynman/timeline-runner.cjs) rewrites every section FEYNMAN.md; the Minto generator rewrites BRIEF.md and MINTO.md. UNVERIFIED: a peer session in the same room may add writes. So the room is changed at the next start, and the analyze cache (written before these files) is older than them. The reuse cannot hit on this room unless these files are excluded or not rewritten.

### Stale-stamp run (both stamps set to 25 h old)

```
SessionStart     hooks=8 wall median=51838 ms  min=51838  slowest: "hooks/run-hook.cmd" session-start=51833ms, node "scripts/agentshield-sessionstart-scan.=355ms
LOG: state mode=compute reason=newer:action-items.md | analyze mode=miss reason=newer:action-items.md rc=0 cached=yes
TEL: install-drift mode=stale-detached reason=age
TEL: onboarding mode=stale-detached reason=age
TEL (child): install-drift refresh-done stamp-written elapsed_ms=790
TEL (child): onboarding refresh-done stamp-written elapsed_ms=11546
```

PROVEN: the coordinator is not among the 2 slowest hooks (second slowest is 355 ms), so it took 355 ms or less. Both stamps were refreshed in the background (11.5 s for onboarding). No lock file remained.

### Diagnostic, simulated unchanged room (labelled, not the plan protocol)

Before each single run I touched STATE.md and the analyze cache, so the room looked unchanged. This only shows the possible gain if the room were not rewritten by the start itself.

```
SessionStart wall median=14139 ms  slowest: session-start=14120ms, coordinator=1268ms   LOG: state reuse, analyze hit
SessionStart wall median=13752 ms  slowest: session-start=13747ms, agentshield=377ms     LOG: state reuse, analyze hit
SessionStart wall median=15587 ms  slowest: session-start=15582ms, agentshield=552ms     LOG: state reuse, analyze hit
```

Median of the 3 single runs: 14,139 ms (PROVEN as measured, 1 load level of about 1.3 to 1.9). The remaining session-start time is other work (risk R-6 of the plan).

### Summary table (all PROVEN as measured; baseline from the orchestrator)

| Measure | Before | After |
|---------|--------|-------|
| Coordinator, warm, fresh stamps | 12,438 ms | 245 ms (attempt 1) |
| Coordinator, cold first start | 12,438 ms | 12,342 ms (first-sync runs the doctors once) |
| Coordinator, stale stamp | 12,438 ms | 355 ms or less |
| SessionStart median, real room, plan protocol | 23,407 ms | 26,775, 47,102, 49,782 ms (3 attempts, loaded machine, reuse not hit) |
| SessionStart, simulated unchanged room | 23,407 ms | 14,139 ms (median of 3 single runs) |

## Known Stubs

None.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: detached-process | scripts/preflight-doctor.cjs | Detached `--refresh` child runs doctor.cjs, including `--statusline-visibility --fix`, after the start (plan threat T-lx3-06, accepted). settings.json stayed unchanged in the measured runs. |

## Self-Check: PASSED

- FOUND: scripts/session-start-state, tests/test-261029-lx3-sessionstart-skip.cjs, this SUMMARY.
- FOUND: commits d54e21bd3, ab4f25f04, abd946ae3, f52c52b2d (ancestors of HEAD).
- Owned paths clean in git status. CHANGELOG.md untouched on purpose.

## Report fields

STATUS: PARTIAL

CHANGED: scripts/analyze-room (d54e21bd3), tests/test-261029-lx3-sessionstart-skip.cjs (ab4f25f04), scripts/session-start-state and scripts/session-start (abd946ae3), scripts/preflight-doctor.cjs and scripts/sessionstart-coordinator.cjs (f52c52b2d). This SUMMARY (uncommitted, for the orchestrator).

VERIFIED: new test 29 of 29 ok, twice in a row. 6 gate suites exit 0. Suite compare: 75 of 76 files unchanged, 1 regression (tests/test-359-prose-budget.cjs). analyze-room exit 0 on the real room. Coordinator 245 ms warm and 355 ms or less stale, against 12,438 ms.

UNVERIFIED: macOS and Windows behaviour of the detached spawn. The source of the 15:09 cache and log lines. The share of room writes that come from a peer session. A 3 of 3 reuse set on the real room (not reachable, see root cause).

RISKS: test-359 fails until its pin is updated, and the peer edit of session-start will break the pin again. On the real room the state and analyze reuse does not hit, so session-start time did not improve there (only the doctor throttle gains about 12 s). A cached doctor fragment can be 24 h old. The first start after an install still waits for the doctors once.

NEXT: Decide NEEDS_HUMAN 1 (update the pin in tests/test-359-prose-budget.cjs to 932a68acbcdad5b43bff71b9852485d4770645befcfe3ced253cb9a0fd6767e7, in a scope that allows that file) and NEEDS_HUMAN 2 (how to treat the files that SessionStart writes). Then re-run the real-room warm set and write the CHANGELOG bullet.

## Closure addendum (orchestrator, 2026-10-29, after the session cut)

Both NEEDS_HUMAN items were answered by the orchestrator and applied by the executor after this summary was written:

1. The test-359 byte pin was moved: fbe667c3d test(261029-lx3): re-pin the session-start hash in the prose budget test for the helper call lines.
2. The files that SessionStart itself rewrites (FEYNMAN.md, MINTO.md, BRIEF.md, MEETINGS-INTELLIGENCE.md, action-items.md, the team state file) are excluded from the newer-check in both helpers: 36c8163c4 perf(261029-lx3): ignore plugin-generated artifacts in the room-changed check of SessionStart and Stop.
3. The measurement was recorded: 3ea68fa6d docs(261029-lx3): record the measured SessionStart time in the changelog (median 11,520 ms over a 3-start set with the summary reused, fastest 10,744 ms; the install-check step 245 ms warm).

PROVEN: all 3 shas are ancestors of HEAD (git merge-base --is-ancestor). Status changed from PARTIAL to COMPLETE on that basis. Open follow-up kept from this plan: the SessionStart generators are not idempotent (root fix), and session-start still spends 10 to 14 s in its other blocks (memory reconcile 3.5 s and the node blocks at lines 115, 938, 1094 and 1909).

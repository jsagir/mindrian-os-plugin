---
phase: 367-newborn-room-graph-connected-no-repair
plan: 06
subsystem: hooks
tags: [on-stop, session-start, detached-spawn, ir-b2, ac1, ac8, pins]
requires:
  - "367-05 (scripts/graph-catchup.cjs, MOS_GRAPH_CATCHUP_HOLD_MS seam)"
provides:
  - "CLI Stop and SessionStart spawn the catch-up runner, detached from the hook pipes"
  - "on-stop HOOK_CWD and HOOK_SESSION from the Stop stdin"
affects:
  - "every CLI turn end and session start (G1 on the CLI)"
  - "plan 367-13 (re-bases the larry-extended and SKILL prose pins, still red)"
tech-stack:
  added: []
  patterns: ["( node ... || true ) </dev/null >/dev/null 2>&1 & (IR-B2 detached subshell)"]
key-files:
  created: []
  modified:
    - scripts/on-stop
    - scripts/session-start
    - lib/mcp/hook-adapter-audit.cjs
    - scripts/isolate-larry-voice.cjs
    - tests/test-359-prose-budget.cjs
    - tests/test-367-catchup-cli.cjs
    - tests/test-384-s1-session-start.cjs
decisions:
  - "MOS_NO_GRAPH_CATCHUP is declared as a switch in the isolation table (isolatedEnv refuses an undeclared switch name)."
  - "The 384 S1 test counts the runner's node start (ADDED_NODE_STARTS = 1) and runs with MOS_NO_GRAPH_CATCHUP=1 so its P3 parity stays about the reconcile blocks."
metrics:
  duration: "about 70 min (most of it regression runs)"
  completed: 2026-11-26
  tasks: 2
  files: 7
---

# Phase 367 Plan 06: CLI hook triggers Summary

Every CLI Stop (both branches) and every SessionStart now spawns the catch-up runner in a fully detached subshell, so a file written by the model, a shell or a subagent reaches room.db at the next turn end with no model tool call (AC1), and the hooks reach EOF while the runner still works (AC8 hook leg, IR-B2).

BASE = dadc5fdfd10fed813b237bb3da2a3519845fc9a3 (git rev-parse HEAD at the start of Task 1).

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | the Stop and SessionStart spawn lines (+ the on-stop line budget) | b243fd0dc | scripts/on-stop, scripts/session-start, lib/mcp/hook-adapter-audit.cjs, tests/test-367-catchup-cli.cjs |
| 2 | move the isolation and prose pins | 755392334 | scripts/isolate-larry-voice.cjs, tests/test-359-prose-budget.cjs |
| 2 (fix) | the 384 S1 node-start count and the runner switch | 9a21361d7 | tests/test-384-s1-session-start.cjs |

## The spawn lines

- scripts/on-stop, after the Part 8 drain line and before BEGIN-MCP-FIRST-STOP-THIN-ADAPTER: `( node "${SCRIPT_DIR}/graph-catchup.cjs" --cwd "${HOOK_CWD:-$PWD}" --session "${HOOK_SESSION:-}" --trigger stop || true ) </dev/null >/dev/null 2>&1 &`. HOOK_CWD and HOOK_SESSION are set to '' first, then read with `IFS= read -r` from the one node parse (transcript_path, cwd, session_id; \r and \n removed). The MINDRIAN_TRANSCRIPT_PATH export and its debug line are unchanged.
- scripts/session-start, after `# --- end 369.25 plan 13 heal net ---`: `( node "${SCRIPT_DIR}/graph-catchup.cjs" --cwd "$PWD" --room "${ROOM_DIR:-}" --trigger session_start || true ) </dev/null >/dev/null 2>&1 &`.

## Measurements (AC8 hook leg, this host)

- on-stop: exit 122-125 ms; stdout and stderr end at the exit time; the held runner (MOS_GRAPH_CATCHUP_HOLD_MS=5000) was alive and `running`.
- session-start (with MINDRIAN_DOGFOOD_DRAIN_SKIP, SCOUT_CADENCE_SKIP, BRAIN_STALENESS_SKIP, no Brain URL): exit 396-419 ms; pipes end 431-455 ms (within 36 ms of the exit); the held runner was alive and `running`.
- Both legs are under the 2000 ms bound; the 500 ms pipe-hold fallback was not needed.

## Pins moved

- lib/mcp/hook-adapter-audit.cjs: on-stop 679 -> 687 measured lines; budget 680 -> 710 by its own rule.
- scripts/isolate-larry-voice.cjs: the five session-start evidence lines re-pinned 413 -> 419, 1332 -> 1339, 1829 -> 1670, 1867 -> 1708, 1980 -> 1821, plus line 135 for the new spawn. `echo "$TODAY" > "$UPDATE_CACHE"` occurs twice (1689 and 1708); the old line 1867 named the background check-update write at dd0280841 (PROVEN by `git show dd0280841:scripts/session-start`), so 1708 is used. The derive-drain evidence line is re-pinned 956 -> 929 (367-05 moved two functions out of the drain). MOS_NO_GRAPH_CATCHUP is in HOOK_SWITCHES and declared in the isolation table.
- Stale evidence after the plan (one-off node -e over STARTUP_CONTAINMENT and evidenceHolds): only `scripts/check-pending-ambiguous.cjs 79` (out of scope; B5b stays red for it alone).
- tests/test-359-prose-budget.cjs: SESSION_START_OUTSIDE_DOCTRINE c7a69e82ab28...dbf4 -> c6f16559868c...afb0; the last session-start commit before BASE is 7f93a9ccf. The larry-extended and SKILL B5 arms stay red until plan 367-13.

## Regression runs (base-red rule)

List: every file of `grep -l "on-stop" tests/*.cjs` and `grep -l "session-start" tests/*.cjs`, deduplicated (77 files, the 367 catch-up test excluded), 4 in parallel with a serial recheck of each FAIL; plus 5 readers of isolate-larry-voice.cjs outside that list (all PASS at a BASE export and after). 62 files PASS at BASE and after. The 15 base-red files:

| File | BASE | After 9a21361d7 |
|------|------|-------|
| tests/test-236-engines-floor.cjs | FAIL | FAIL |
| tests/test-261029-qef-hook-timeouts.cjs | FAIL | FAIL |
| tests/test-341-session-start-tier.cjs | FAIL | FAIL |
| tests/test-346-catalogue-schema.cjs | FAIL | FAIL |
| tests/test-359-prose-budget.cjs | FAIL | FAIL |
| tests/test-341-version-of-record-source-version.cjs | FAIL | FAIL |
| tests/test-3696-isolation.cjs | FAIL | FAIL |
| tests/test-383-sourced-number.cjs | FAIL | FAIL |
| tests/test-386-room-db-unreadable-message.cjs | FAIL | FAIL |
| tests/test-384-perf-harness.cjs | FAIL | FAIL |
| tests/test-384-s1-session-start.cjs | FAIL | FAIL |
| tests/test-doctor-legacy-config-pin-drift.cjs | FAIL | FAIL |
| tests/test-hmi-compliance-e2e.cjs | FAIL | FAIL |
| tests/test-l8g-theo-bare.cjs | FAIL | FAIL |
| tests/test-statusline-glyph-isolation.cjs | FAIL | FAIL |

Arm-level compare of the 15 base-red files (FAIL and not-ok lines, times normalized): equal at BASE and after, except
- test-359-prose-budget: the session-start B5 arm left the failing set (re-based here);
- test-384-perf-harness B9: the commit count in its message grew (1329 -> 1331), the same phase-guard arm;
- test-384-s1-session-start: equal after the fix commit 9a21361d7 (before it, M1 counted 35 node starts and P3 listed the runner cache).

tests/test-36925-injection.cjs failed once in the after-run; it is a PRE-EXISTING flake (J6, about 2 of 4 runs fail at BASE and after; D-367-05).

## Verification

- `bash -n scripts/on-stop`, `bash -n scripts/session-start`: exit 0.
- `node tests/test-367-catchup-cli.cjs all`: 71 passed, 0 failed (unit, ac3, ac5, ac10, ac1, ac8hook, s1).
- `node tests/test-261030-8vd-onstop-wait.cjs`: ALL PASS. `node tests/test-198-adapter-budget.test.cjs`: 15 of 15.
- The Task 2 verify command (isolation table, switch, prose arm): exit 0. `node tests/test-3696-isolation.cjs`: PASS 69, FAIL 1 (B5b, the out-of-scope entry only).
- `node scripts/check-substrate.cjs --diff` before each commit: exit 0. No em-dash in any touched file.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The on-stop budget moved into the Task 1 commit**
- **Found during:** Task 1 verify
- **Issue:** the Task 1 verify runs tests/test-261030-8vd-onstop-wait.cjs, whose S2 arm reads the LINE_BUDGETS of hook-adapter-audit.cjs (Task 2 Step 1). 687 lines broke the 680 budget.
- **Fix:** Task 2 Step 1 ran in Task 1. **Commit:** b243fd0dc

**2. [Rule 1 - Bug] MOS_NO_GRAPH_CATCHUP had to be declared in the isolation table**
- **Found during:** Task 2 (test-3696-isolation B4e turned red)
- **Issue:** isolatedEnv throws `isolation_breach:<name>` for a switch name that ISOLATION_TABLE does not declare, so the session-start capture threw.
- **Fix:** one switch entry (defaultOn false, value 1). B4e passes again. **Commit:** 755392334

**3. [Rule 1 - Regression caused by 367-05] The derive-drain evidence line**
- **Issue:** 367-05 moved two functions out of scripts/gsd-graph-derive-drain.cjs, so the isolation evidence line 956 went stale (929). Its regression list did not hold test-3696-isolation.
- **Fix:** re-pinned here. **Commit:** 755392334

**4. [Rule 1 - Pin moved by the hook edit] tests/test-384-s1-session-start.cjs (not in the plan file list)**
- **Found during:** the arm-level compare of the after-run
- **Issue:** M1 "node starts at most 34" counted 35 (the runner spawn is one node start); P3 listed the runner cache as a new written file.
- **Fix:** ADDED_NODE_STARTS = 1 in the M1 limit, and MOS_NO_GRAPH_CATCHUP=1 in the run env (the runner exits at once and writes nothing). The arms equal BASE. **Commit:** 9a21361d7

## Notes

- AC1 used a room born by birthRoom under the temp MINDRIAN_ROOMS_HOME; leg 1 ran on-stop with process cwd os.tmpdir() and the Stop stdin cwd in the room; leg 2 ran with stdin {} and process cwd in the room. Both indexed the fs, shell and child-process files.
- The MCP-first Stop branch was not run by a test here (the spawn line sits before the branch; S1 proves the position).
- Agent runs: the same single gsd-executor run as 367-01. Tokens: not measurable from inside the agent.

## Known Stubs

None.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: test-side-effect | scripts/session-start | A test that runs the real session-start with the real HOME now spawns the runner on the real registry active room (D-367-04). |

## Self-Check: PASSED

- FOUND commits b243fd0dc, 755392334, 9a21361d7

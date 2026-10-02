---
phase: quick-261002-e9v
plan: 01
subsystem: mcp
tags: [research_run, session-binding, write-authority, resolveMcpWriteRoom, RCA]
requires:
  - phase: desktop-session-binding-fallback
    provides: resolveMcpWriteRoom and NO_BOUND_ROOM (commit 96804284d)
provides:
  - research_run refuses an unbound session with no_bound_room before any op runs
affects: [lib/mcp/tools/research.cjs]
tech-stack:
  added: []
  patterns: [one shared write-authority gate for every room-writing MCP tool]
key-files:
  created: [tests/test-research-run-session-binding.cjs]
  modified: [lib/mcp/tools/research.cjs, tests/test-desktop-stdio-session-binding.cjs, tests/run-all-248.sh]
key-decisions:
  - "Reuse resolveMcpWriteRoom (Canon Part 7); keep the stricter cwd refusal and the room_not_bound wanted check"
  - "Unbound reason string moves from no_room_bound to no_bound_room; zero consumers of the old string"
requirements-completed: [RCA-desktop-session-binding-fallback]
duration: 25min
completed: 2026-10-02
---

# Quick 261002-e9v: research_run resolves its room through resolveMcpWriteRoom

research_run now refuses a session that has an id but never bound a room, with no_bound_room and a message naming room_bind, instead of planning into the machine-wide registry room.

## Root cause

`resolveRoom` in `lib/mcp/tools/research.cjs` asked the read-side ladder for a room and accepted anything except `cwd` and `none`. For a session with an id and no binding, the ladder answers with the registry active room, which is a shared pointer another window or a manual `rooms open` can move. So an unbound Desktop or Cowork window could write `.mindrian/research-runs/` (and mint grants and gates) into someone else's room, and the flow only failed later at `gate_answer`. Every other room-writing tool already used `resolveMcpWriteRoom`; this one was missed.

## Commits

| Step | Commit | Content |
|------|--------|---------|
| RED | ad802bdbb | New in-process test, research_run added to Desktop e2e arm 2b, run-all-248 wiring, the PLAN.md |
| GREEN | c692bb5af | resolveRoom built on resolveMcpWriteRoom |

## RED legs on HEAD (before the fix)

Failing as expected: R1 (all five ops wrote or answered ok for an unbound session; room-a gained research-runs), R2 (naming the registry room authorized it), R6b (missing boot-fallback accepted and the directory was created), R6c (cwd floor answered no_room_bound, not no_bound_room), R7 (session-less carve-out left no stderr trace). Desktop e2e failed only arm 2b, at research_run. R3, R4, R5, R6a, R8 passed.

Fixture note: R3 and R5 "room-a has no research-runs" checks compare room-a before and after the leg rather than asserting absence, so the R1 bleed on HEAD does not cascade into legs that are green on HEAD.

## GREEN results

New test 40/40, Desktop e2e 18/18 (arm 2b included), test-363-mcp-tool 15/15 (M11 included), test-366-mcp-release-route 13/13, test-366-mcp-plan-only 6/6, test-366-mcp-perspective-ops 9/9, test-248-resolver-census exit 0, check-tool-honesty OK (0 high-risk), `bash tests/run-all-248.sh` exit 0 with the new leg PASSED and the em-dash sweep PASSED.

## Reason-string change

Unbound refusal: `no_room_bound` becomes `no_bound_room`, matching every other write tool and Desktop e2e arm 2b. Evidence of zero consumers: grep across lib/, tests/, scripts/, docs, skills and commands (.planning excluded) found no reader of `no_room_bound` other than research.cjs itself. `room_not_bound` is unchanged. research_run DESCRIPTION, inputSchema, OPS, annotations and `tests/fixtures/267/wire-snapshot-zod4.json` are untouched.

## Regression sweep

| Test | Result | Note |
|------|--------|------|
| test-366-offline-recall | PASS 12/0 | |
| test-seed103-eureka-perspective | PASS 39/0 | |
| test-seed104-grant-family-loop | PASS 19/0 | |
| test-363-part8-sweep | PASS 20/0 | |
| test-363-acceptance-whitespace | PASS 15/0 | |
| test-365-never-do-gate | 74 pass / 1 fail | PRE-EXISTING, see below |

test-365-never-do-gate: the single failure is `N12 lib/mcp/tools/gate.cjs is byte-identical to PLAN_BASE`. This plan did not touch gate.cjs (`git diff HEAD -- lib/mcp/tools/gate.cjs` is empty); it last changed in peer commit 96804284d (+25/-2 against PLAN_BASE ab5e1d16b). The research_run N12 checks (description and input schema identical to PLAN_BASE) pass. A git-archive baseline could not reproduce the failure because it carries no .git for the PLAN_BASE lookup, so classification rests on the diff evidence above. Owner: whoever re-pins the gate.cjs tripwire for 96804284d.

## Deviations from Plan

None in code. One process note: the plan said the orchestrator commits plan and summary; the invoking instruction asked the executor to commit both, so the PLAN.md went in the RED commit and this SUMMARY in its own commit. STATE.md and ROADMAP.md were not touched; `gsd-tools query commit` was not used.

## Tri-Polar note

- Claude Desktop and Cowork: an unbound window now refuses research_run at start, with a one-call remedy (room_list, then room_bind).
- Claude Code CLI: a session keyed by CLAUDE_CODE_SESSION_ID that never bound a room now gets no_bound_room instead of the registry room, the same as every other write tool since 96804284d. A CLAUDE_ACTIVE_ROOM operator pin, a session-less caller (with the MCP_FIRST_DEPRECATED_ACTIVE_WRITE trace) and an existing boot-fallback room still write.

## Known Stubs

None.

## Threat Flags

None. No new network, auth or schema surface; T-e9v-01 to T-e9v-04 mitigated as planned.

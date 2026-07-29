---
task: quick-260729-pnw
verified: 2026-07-29T00:00:00Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 0
---

# Quick Task 260729-pnw Verification Report

**Task Goal:** Fix swallow-to-null bug at graph-refine-loop.cjs:112 (Phase 236 GRAPHDB-02
follow-up) — apply the identical instanceof-narrowed re-throw pattern already shipped at
graph-derivation.cjs to the sibling call site in runGraphRefine, proven by an executed
mutation (revert -> RED with a named assertion, restore -> GREEN).

**Verified:** 2026-07-29
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `runGraphRefine` on a CONTENDED room throws `RoomDbBusyError` instead of returning a normal-looking result built on `db = null` | VERIFIED | `lib/core/graph-refine-loop.cjs:129-136` — instanceof-narrowed catch; `node tests/test-236-refine-loop-open-detected.cjs` scenario 1 passes (own run, exit 0) |
| 2 | `runGraphRefine` on a BROKEN room throws `RoomDbBrokenError`, distinguishable from busy | VERIFIED | scenario 6 passes in own run; both classes checked via `instanceof` |
| 3 | `runGraphRefine` on an ABSENT room proceeds normally, returns `{proposed, verified, written, rounds}`, absence is not a failure mode | VERIFIED | scenario 7 passes; `.mindrian/room.db` existence assertion is the load-bearing check and it passed in my own run |
| 4 | Every non-typed error still falls through to `db = null` exactly as before (instanceof-narrowed, never blanket) | VERIFIED | Read `lib/core/graph-refine-loop.cjs:133-136`: `if (e instanceof rdb.RoomDbBusyError \|\| e instanceof rdb.RoomDbBrokenError) throw e; db = null;` — narrow guard, no blanket rethrow |
| 5 | The re-throw is proven by an EXECUTED mutation: revert turns the new test RED by name, restore turns it GREEN | VERIFIED | I performed my own independent hand-revert (not trusting SUMMARY's captured output), reran the test: exit 1, `AssertionError [ERR_ASSERTION]` on scenario 1 (busy-throws), not a TypeError/crash. Restored via `git checkout --`, reran: exit 0, 8/8 green |
| 6 | `graph-refine-loop.cjs` still lazy-loads `room-db.cjs` through `_roomDb()`; no top-level require introduced | VERIFIED | Read source lines 27-45: `_roomDb()` lazy loader pattern preserved, extended to also cache `_RoomDbBusyError`/`_RoomDbBrokenError`; no top-level `require('./room-db.cjs')` present |
| 7 | No production file other than `lib/core/graph-refine-loop.cjs` changed | VERIFIED | `git diff --stat 6aab4362..HEAD` (merge-base with main, equivalent to the Phase 236 base) shows exactly two files: `lib/core/graph-refine-loop.cjs` and `tests/test-236-refine-loop-open-detected.cjs` |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/core/graph-refine-loop.cjs` | instanceof-narrowed re-throw of `RoomDbBusyError`/`RoomDbBrokenError` at the runGraphRefine open site | VERIFIED | Contains `e instanceof rdb.RoomDbBusyError` and `e instanceof rdb.RoomDbBrokenError`; catch is narrow, not blanket |
| `tests/test-236-refine-loop-open-detected.cjs` | call-site collapse gate against `runGraphRefine`: busy throws, broken throws, absent still works, uncontended control | VERIFIED | 391 lines, 8 scenarios, all pass in my own execution (exit 0) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `lib/core/graph-refine-loop.cjs` | `lib/core/room-db.cjs` | lazy `_roomDb()` helper caching `RoomDbBusyError`/`RoomDbBrokenError` | WIRED | Confirmed by reading source; the lazy loader is extended, cache key unchanged (`_openRoomDb`) |
| `tests/test-236-refine-loop-open-detected.cjs` | `tests/helpers/room-db-lock-holder-236.cjs` | `child_process.fork` of existing lock holder | WIRED | `grep -n "room-db-lock-holder-236"` matches at line 116, reused via `LOCK_HOLDER = path.join(__dirname, 'helpers', 'room-db-lock-holder-236.cjs')` |
| `tests/test-236-refine-loop-open-detected.cjs` | `runGraphRefine` | direct require, positional `roomDir` calls | WIRED | 4 call sites (`runGraphRefine(room, {...})`, `runGraphRefine(brokenRoom, {...})`, `runGraphRefine(absentRoom, {...})`) all pass `roomDir` positionally, never inside an opts object |
| `tests/run-all-236.sh` | `tests/test-236-refine-loop-open-detected.cjs` | glob discovery `tests/test-236-*.cjs` | WIRED | `bash tests/run-all-236.sh` reports `PASS=12 FAIL=0 SKIP=0` (11 legs from Phase 236 close + this new file) |

### Behavioral Spot-Checks / Mutation Proof (executed independently, not trusted from SUMMARY)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| New test passes before any mutation | `node tests/test-236-refine-loop-open-detected.cjs` | exit 0, 8/8 ok | PASS |
| Existing test-201 unaffected by lazy-load change | `node tests/test-201-graph-refine-loop.cjs` | exit 0, 5/5 ok | PASS |
| Phase 236 gate | `bash tests/run-all-236.sh` | `PASS=12 FAIL=0 SKIP=0` | PASS |
| Independent hand-revert to bare `catch (_e) { db = null; }` (dropped instanceof guard and `const rdb` hoist) | `node tests/test-236-refine-loop-open-detected.cjs` | exit 1, `AssertionError [ERR_ASSERTION]: 1. a CONTENDED room makes runGraphRefine throw RoomDbBusyError...` at test file line 150 | PASS — named assertion, not a TypeError/crash |
| `git checkout -- lib/core/graph-refine-loop.cjs` restore | `git status --porcelain -- lib tests` | clean | PASS |
| Re-run after restore | `node tests/test-236-refine-loop-open-detected.cjs` | exit 0, 8/8 ok | PASS |
| Orphaned lock-holder process check | `pgrep -af room-db-lock-holder-236` immediately after RED run | one process present (51s elapsed, from the RED run's aborted assertion path) | Self-terminated within the documented 60s `setTimeout(...).unref()` safety valve (T-PNW-02); confirmed gone 12s later. Not an unbounded leak — this is the designed fallback behavior, not a regression. |

### Scope Verification

| Check | Command | Result |
|-------|---------|--------|
| Files changed vs branch base | `git diff --stat 6aab4362..HEAD` (merge-base with `main`) | exactly `lib/core/graph-refine-loop.cjs` (30 lines) and `tests/test-236-refine-loop-open-detected.cjs` (391 lines, new file) |
| Out-of-scope files untouched | `git diff --quiet 6aab4362..HEAD -- lib/core/room-db.cjs lib/core/graph-derivation.cjs tests/run-all-236.sh tests/helpers tests/test-236-open-busy-detected.cjs .planning/ROADMAP.md .planning/REQUIREMENTS.md .planning/STATE.md` | exit 0 — no diff, confirmed untouched |
| Working tree clean after full verification pass | `git status --porcelain` | clean |
| Em-dashes | `grep -Pn "\x{2014}"` on both changed files | zero matches in either file |
| Debt markers | `grep -nE "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` on both changed files | zero matches |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| GRAPHDB-02 | 260729-pnw-PLAN.md | A busy or mid-migration room.db open reports its real state instead of collapsing into cold start | SATISFIED (already closed by Phase 236; this task hardens a second call site, does not reopen/re-close) | `.planning/REQUIREMENTS.md` line 22/79 shows GRAPHDB-02 Complete via Phase 236; this quick task correctly does not touch REQUIREMENTS.md/ROADMAP.md/STATE.md, consistent with its stated non-reopening scope |

### Anti-Patterns Found

None. Both changed files are free of debt markers, blanket catches, and em-dashes.

### Human Verification Required

None. All must-haves were independently verifiable via source reading, test execution, and an independently-reproduced mutation proof.

### Gaps Summary

No gaps found. Every must-have truth from the plan's frontmatter, plus every item in the verification checklist supplied by the orchestrator, was independently confirmed against the actual codebase state:

- Source code inspected directly (not summary claims) confirms the instanceof-narrowed guard and preserved lazy loader.
- The mutation proof was reproduced independently in this verification session (not just trusting SUMMARY.md's captured output): hand-reverted the catch block, confirmed a named `AssertionError` (not a crash) on the busy-throws scenario, restored via `git checkout --`, confirmed green again.
- Scope was confirmed against the actual merge-base with `main` (`6aab4362`, matching the plan's cited `6aab4362..HEAD` range): exactly two files changed, all named out-of-scope files (room-db.cjs, graph-derivation.cjs, run-all-236.sh, tests/helpers/, test-236-open-busy-detected.cjs, ROADMAP.md, REQUIREMENTS.md, STATE.md) untouched.
- Both the new gate test and the pre-existing regression test (test-201) pass; the Phase 236 aggregate gate reports PASS=12 FAIL=0 SKIP=0.
- Zero em-dashes, zero debt markers in either changed file.
- The one anomaly observed (an orphaned lock-holder process briefly surviving my own RED-mutation run) is explained by the documented 60-second `unref()` safety valve in the reused helper and self-resolved within that window; not a regression introduced by this task.

---

_Verified: 2026-07-29_
_Verifier: Claude (gsd-verifier)_

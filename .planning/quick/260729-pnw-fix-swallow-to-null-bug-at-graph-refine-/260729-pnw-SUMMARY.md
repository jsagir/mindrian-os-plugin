---
phase: quick-260729-pnw
plan: 01
subsystem: room-db
tags: [room-db, error-classification, graph-refine, mutation-proof, canon-part-8]
requires:
  - lib/core/room-db.cjs RoomDbBusyError / RoomDbBrokenError (Phase 236-03)
  - tests/helpers/room-db-lock-holder-236.cjs (Phase 236-03)
provides:
  - runGraphRefine propagates typed room-db open failures instead of cold-starting on db = null
  - tests/test-236-refine-loop-open-detected.cjs (call-site collapse gate, glob-discovered)
affects:
  - lib/core/graph-refine-loop.cjs
tech-stack:
  added: []
  patterns: [instanceof-narrowed re-throw, lazy module loader, forked write-lock contention fixture]
key-files:
  created:
    - tests/test-236-refine-loop-open-detected.cjs
  modified:
    - lib/core/graph-refine-loop.cjs
decisions:
  - The guard is instanceof-narrowed to exactly two classes, never a blanket throw, so a genuine cold start is still a cold start.
  - The lazy _roomDb() loader was preserved; no top-level require of room-db.cjs was introduced.
  - Absence is not treated as an open failure, because on this runtime an absent room.db opens successfully and is created.
metrics:
  duration: ~25 minutes
  completed: 2026-07-29
  tasks: 3
  commits: 3
---

# Quick Task 260729-pnw: Fix the swallow-to-null bug at the graph-refine open site

Closed the last Tier A swallow-to-null site from Phase 236's openRoomDb call-site census: `runGraphRefine` now re-throws `RoomDbBusyError` and `RoomDbBrokenError` instead of collapsing a locked room, a broken room and an absent room into one indistinguishable `db = null`.

## What Changed and Why

The pre-fix code at `lib/core/graph-refine-loop.cjs:112` was a bare `catch (_e) { db = null; }`. Phase 236 built the classifier in `room-db.cjs` and fixed the sibling site in `graph-derivation.cjs`, but this caller kept eating the classification. A classifier whose callers swallow the result is a classifier that changed nothing.

Concretely, before this fix, a refine run against a momentarily locked room walked a null neighborhood and returned a perfectly healthy-looking result. That is not a claim; it was captured under the executed mutation:

```
UNDER MUTATION, the CONTENDED room returned instead of throwing:
  {"proposed":[],"verified":[],"written":[],"rounds":1}
```

A room that was merely locked, reported as a room with no history. That is the exact false-success shape GRAPHDB-02 exists to eliminate.

Two edits, one production file:

1. `_roomDb()` now also caches and returns `RoomDbBusyError` and `RoomDbBrokenError`. The cache key stays `_openRoomDb`, so the require still fires exactly once.
2. The open site hoists `const rdb = _roomDb();` above the `try` and re-throws only those two classes. Everything else keeps the old `db = null`, so the guard is strictly narrower than the previous behavior, never wider.

## Mutation Proof (executed, not reasoned about)

| Run | Command | Exit | Result |
|-----|---------|------|--------|
| GREEN before | `node tests/test-236-refine-loop-open-detected.cjs` | 0 | `PASS (8/8)` |
| RED (mutated) | same | 1 | named AssertionError on scenario 1 |
| GREEN after | same | 0 | `PASS (8/8)` |

The mutation reverted ONLY the catch body back to `} catch (_e) { db = null; }`, leaving the `_roomDb()` loader extension in place, so the red is attributable to exactly the one line of behavior under test.

Verbatim RED assertion line from `/tmp/refine-red.txt`:

```
FAIL AssertionError [ERR_ASSERTION]: 1. a CONTENDED room makes runGraphRefine throw RoomDbBusyError instead of returning a normal-looking result built on db = null
    at check (/home/jsagi/dev/MindrianOS-Plugin/.claude/worktrees/agent-a3983dba4765853cb/tests/test-236-refine-loop-open-detected.cjs:135:10)
    at scenarios (/home/jsagi/dev/MindrianOS-Plugin/.claude/worktrees/agent-a3983dba4765853cb/tests/test-236-refine-loop-open-detected.cjs:274:3)
```

It is a named `AssertionError [ERR_ASSERTION]`, not a `TypeError`, not a fixture crash, not a timeout, which is what proves the test measures the thing it claims to measure.

Localization, checked rather than assumed. Scenario 0 printed `ok` in that same mutated run, so the chokepoint was untouched. The absent no-regression leg was re-run separately under the mutation and was unaffected:

```
UNDER MUTATION, scenario 7 (absent) leg:
  result keys: proposed,verified,written,rounds  rounds: 1
  room.db created: true
```

So the red belongs to this call site, not to the harness and not to `room-db.cjs`.

After restoring the fix, `git diff` of `lib/core/graph-refine-loop.cjs` against the Task 1 committed state was empty: zero mutation residue shipped.

## Phase Gate

```
======================================
Phase 236: PASS=12 FAIL=0 SKIP=0
======================================
```

12 is the expected number: the 11 legs recorded at Phase 236 close, plus this new file, discovered by the runner's existing `tests/test-236-*.cjs` glob with no runner edit.

## The New Gate

`tests/test-236-refine-loop-open-detected.cjs`, 8 scenarios, all driven through `runGraphRefine` (never `openRoomDb`, which is used only to build fixtures):

| # | Scenario |
|---|----------|
| 0 | precondition: `room-db.cjs` still exports both typed classes (so a classifier revert fails here by name, not as a bare instanceof TypeError) |
| 1 | a contended room throws `RoomDbBusyError` |
| 2 | that error is NOT a `RoomDbBrokenError`, and `err.name` is `RoomDbBusyError` |
| 3 | no `{proposed, verified, written, rounds}` object came back |
| 4 | Canon Part 8: the seeded room canary leaks into neither the message nor the meta |
| 5 | control: lock holder gone, the SAME room refines normally (so scenario 1 came from contention, not damage) |
| 6 | a mid-migration-broken room throws `RoomDbBrokenError`, not busy |
| 7 | no regression: an absent room does not throw, returns all four keys with `rounds >= 1`, and `.mindrian/room.db` exists afterwards |

Anti-vacuity was designed in on three independent legs: `makeMigrationPending` gives the second opener genuine write work (without it a WAL room opens fine under an exclusive lock and the busy leg would pass for the wrong reason), the uncontended control separates contention from damage, and the executed RED run proves the assertions actually bite. Scenario 7's `existsSync` leg is the load-bearing one there: it proves the open really ran and succeeded rather than being skipped.

The Phase 236 lock holder was reused verbatim by fork, never duplicated. No orphaned lock-holder process survived any run (checked with the interpreter-anchored `pgrep -af "^[^ ]*node .*room-db-lock-holder-236"` form; the naive `-f` form matches the invoking shell itself and reports a phantom PID).

## Lazy Loader Preserved

No top-level `require('./room-db.cjs')` was introduced. `graph-refine-loop.cjs` still lazy-loads through `_roomDb()`, which is deliberate: `tests/test-201-graph-refine-loop.cjs` calls `runGraphRefine(null, {...})` four times with an injected handle, and a top-level require would pull `node:sqlite` into every one of those runs. That test still passes untouched (5 assertions).

Verified by the comment-stripped source sweep: `grep -cE "^const .*require.*room-db"` returns 0, `instanceof rdb.RoomDbBusyError` returns 1, `instanceof rdb.RoomDbBrokenError` returns 1, `catch (_e) { db = null; }` returns 0.

## Still Out of Scope (deliberately)

This closes ONE Tier A entry. Four census entries at five sites remain open and were not touched:

| Site | Catch behavior |
|------|----------------|
| `lib/core/breakthrough/scanner.cjs:122` | `return { ..., reason: 'no_room_db' }` |
| `lib/core/navigation/spine-events.cjs:139` | `return { ok: false, reason: 'no_room_db' }` |
| `lib/core/navigation/spine-events.cjs:220` | `return { ok: false, reason: 'no_room_db' }` |
| `lib/core/navigation/lens-nodes.cjs:251` | `return { ok: false, reason: 'no_room_db' }` |
| `lib/core/navigation/room-birth.cjs:1093` | `reconDb = null` |

These report a busy or broken room as "no room db", the same class of confusion, and are the natural next follow-up. Tier B and Tier C were out of scope entirely.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | `ba1404d5` | `fix`: narrow the catch, extend the lazy loader |
| 2 | `e78316b3` | `test`: the call-site collapse gate, 8 scenarios |
| 3 | `0676d2c1` | `docs`: the executed mutation evidence, in the gate's own header |

Exactly two files changed across all three: `lib/core/graph-refine-loop.cjs` and `tests/test-236-refine-loop-open-detected.cjs`. Nothing out of scope moved (`lib/core/room-db.cjs`, `lib/core/graph-derivation.cjs`, `tests/run-all-236.sh`, `tests/helpers/`, `tests/test-236-open-busy-detected.cjs` all clean).

## Deviations from Plan

None. The plan executed exactly as written.

One judgment call worth recording: the plan's Task 3 asked to confirm that scenario 0 and the absent no-regression scenario stay green under the mutation. Scenario 0 is directly visible in the RED capture, but scenario 7 never runs there, because `assert` aborts the file at the first failure. Rather than reason about it, the absent leg was re-executed as a standalone run under the mutation and its output captured (`/tmp/refine-red-absent-leg.txt`). Same for the collapse shape (`/tmp/refine-red-collapse-shape.txt`), which turned scenario 3's "the pre-fix behavior was..." comment from an inherited claim into an observation.

## Requirements and Tracking

No `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md` or `.planning/STATE.md` write. GRAPHDB-02 was already closed at Phase 236; this quick task hardens a second call site and does not reopen or re-close any requirement row.

## Known Stubs

None.

## Threat Flags

None. No new network endpoint, auth path, file access pattern or schema change. The one security-relevant surface, an error object escaping into a caller's log, is covered by scenario 4's Canon Part 8 canary assertion, and this change adds no new meta fields.

## Self-Check: PASSED

- `lib/core/graph-refine-loop.cjs` FOUND
- `tests/test-236-refine-loop-open-detected.cjs` FOUND
- `.planning/quick/260729-pnw-fix-swallow-to-null-bug-at-graph-refine-/260729-pnw-SUMMARY.md` FOUND
- commits `ba1404d5`, `e78316b3`, `0676d2c1` all FOUND in `git log`
- working tree clean under `lib/`, `scripts/` and `tests/`
- zero em-dashes in both changed files and in this summary

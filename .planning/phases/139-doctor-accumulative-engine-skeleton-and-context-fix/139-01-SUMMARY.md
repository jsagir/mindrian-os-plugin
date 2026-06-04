---
phase: 139-doctor-accumulative-engine-skeleton-and-context-fix
plan: 01
subsystem: doctor / room-target-resolution
tags: [resolver, doctor, heal, obs-2, canon-part-8, cwd-misfire, single-resolver]
requires:
  - lib/core/resolve-active-room.cjs (the single-resolver precedent mirrored)
  - scripts/doctor.cjs::checkCascadeRoomsActive (the cwd-misfire call site)
  - scripts/heal-command.cjs::runHeal (the OBS-2 write-ordering surface)
provides:
  - lib/core/resolve-umbilical-target.cjs (the ONE umbilical/room target resolver)
  - resolveUmbilicalTarget(opts) -> { slug, abs_path, source } | null
affects:
  - scripts/doctor.cjs (cwd target now routes through the resolver, skips on null)
  - scripts/heal-command.cjs (OBS-2 write-ordering invariant documented)
tech-stack:
  added: []
  patterns:
    - single-resolver (one module, no second guesser)
    - env-aware HOME default (FLAG-3 landmine avoidance)
    - null-on-miss / never-throws graceful degradation
    - Canon Part 8 source-grep no-egress tripwire
key-files:
  created:
    - lib/core/resolve-umbilical-target.cjs
    - tests/test-resolve-umbilical-target.cjs
    - tests/test-heal-obs2-regression.cjs
  modified:
    - scripts/doctor.cjs
    - scripts/heal-command.cjs
decisions:
  - "doctor's cwd target resolves via resolveUmbilicalTarget() and SKIPS (status:skip) when null -- it never walks up from a raw cwd that is not a room"
  - "OBS-2 was already write-ordered correctly in runHeal (guards return buildErrorEnvelope before any step/.mindrian write); the fix is the regression test that locks the floor + an explicit invariant comment"
metrics:
  duration: ~25m
  completed: 2026-06-04
canon_parts: [8]
requirements: [S1]
---

# Phase 139 Plan 01: Doctor WHERE Fix + OBS-2 Closure Summary

The SINGLE umbilical/room target resolver (`lib/core/resolve-umbilical-target.cjs`, precedence `.umbilical` cord -> `.room-root` sentinel -> registry.active) now backs doctor's only cwd-derived target, and the heal OBS-2 zero-write floor from a non-room cwd is locked by regression test.

## What was built

### Task 1 -- the single resolver (commit 7623bfa5)
- `lib/core/resolve-umbilical-target.cjs` mirrors `lib/core/resolve-active-room.cjs` exactly in shape: env-aware HOME default (`MINDRIAN_ROOMS_HOME || HOME/USERPROFILE/os.homedir() + MindrianRooms`, the FLAG-3 landmine avoided), `opts {cwd?, home?}` test seams, NEVER throws (top-level try/catch -> null), CLI entry printing JSON with 0/1 exit codes.
- Returns `{ slug, abs_path, source }` where `source` is `'umbilical' | 'sentinel' | 'registry'`, or `null` on miss.
- Precedence (first hit wins): (1) `.umbilical` cord bounded upward walk (max 8 hops, stops at filesystem root or HOME), parses the marker's `room:` field (FIRST of one-or-many), resolves it against the registry -- falls through if the room: does not resolve to a real registered room (never fabricates, T-139-04); (2) `.room-root` sentinel bounded walk; (3) registry.active (`active` current / `active_room` legacy, Array|Object rooms, sealed/archived -> null, final `fs.existsSync` gate); (4) null.
- Canon Part 8: LOCAL files + env only, zero network surface. Header asserts the invariant; the source-grep tripwire in the test enforces it.
- `tests/test-resolve-umbilical-target.cjs`: 6 assertions (cord hit, sentinel hit, registry hit, null-on-miss-no-fabrication, unresolvable-cord-falls-through, no-egress source-grep). All green.

### Task 2 -- doctor reroute + OBS-2 closure (commit d98c0629)
- `scripts/doctor.cjs`: added the `resolveUmbilicalTarget` require (line 66). In `checkCascadeRoomsActive`, the `--simulate-write` branch is UNCHANGED (class-c test relies on it); the cwd branch now calls `resolveUmbilicalTarget()` and uses `resolved.abs_path` as `writeRoomDir` on a hit, or returns `{ status: 'skip', detail: 'no umbilical/sentinel/registry target from cwd', activeRoom, writeRoom: null }` on null. doctor no longer walks up from a raw cwd (T-139-01).
- `scripts/heal-command.cjs`: the OBS-2 write-ordering was already correct (guards `isContainerDir` + `assertIsRoom` at the top of `runHeal` `return buildErrorEnvelope(...)` -- an in-memory object, zero disk writes -- before any step runs or any `.mindrian/` mkdir / `.heal-backup/` / `heal-log.json` write). Added an explicit OBS-2 invariant comment marking the floor (T-139-02). The `parseCliArgs` registry-first-then-cwd fallback is intentionally LEFT in place per S1 (the fix is the write ordering, not the fallback) -- a cwd fallback that is not a room is now provably rejected with `error_not_a_room` and zero writes.
- `tests/test-heal-obs2-regression.cjs`: builds a non-room scratch dir (`.git/` + `package.json`, no `.room-root`/`ROOM.md`/`STATE.md`), runs `runHeal`, and asserts `error_not_a_room` + exit 2 + NO `.mindrian/` + NO `heal-log.json` + NO `.heal-backup/` + scratch dir contains ONLY the pre-existing entries. All green.

## Verification (all PASS)
- `node tests/test-resolve-umbilical-target.cjs` -> 6 assertions pass (precedence + null-on-miss + no-egress).
- `node tests/test-heal-obs2-regression.cjs` -> 5 assertions pass (zero room-artifact writes from non-room cwd).
- `grep -n "resolve-umbilical-target" scripts/doctor.cjs` + `grep "resolveUmbilicalTarget()"` -> require + call both wired (lines 66, 705).
- `node scripts/doctor.cjs --json` -> still emits valid JSON (no regression).
- `node tests/test-doctor-class-c.cjs` -> 3/3 pass (the unchanged --simulate-write branch is intact).

## Success criteria (met)
- Exactly ONE resolver module for doctor's cwd target; no second guesser introduced.
- Running heal from a non-room dir makes ZERO room-artifact writes there (OBS-2 closed, regression test).
- The resolver has zero network surface (Canon Part 8 LOCAL-only, source-grep enforced).

## Deviations from Plan
None of substance. One implementation detail: the resolver's own header originally contained the word "Brain" in prose ("no Brain client"), which tripped the plan's `/brain/i` no-egress source-grep tripwire. Reworded the header to "no methodology-graph client" so the module's source is clean of forbidden tokens while still asserting the Part 8 invariant. This is the intended behavior of the tripwire (the floor is on the module's own bytes), not a deviation from the plan's intent.

## Out of scope (deferred per LOCKED decisions)
- S2 accumulative engine skeleton (`data/doctor-modules.json` + watermark + semver selector) -- Plan 02.
- S3 Umbilical first module (`.umbilical` read + `AFFILIATED_WITH` edge projection + integrity check) -- Plan 03.
- S4 release wiring (version bump, release.sh Step 6.6, `doctor --acceptance`) -- later plan.

## Self-Check: PASSED

All created files exist on disk (resolve-umbilical-target.cjs, both test files, this SUMMARY). Both task commits (7623bfa5, d98c0629) present in git history.

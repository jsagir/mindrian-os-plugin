---
phase: 142
plan: 01
subsystem: test-scaffold
tags: [nyquist, wave-0, loop-fires, local-intelligence, tdd-red, fixture, part-8-gate]
requires:
  - Phase 141 (shipped getRoomContext / getNeighborhood / fileEvidenceWithReadback chokepoints)
provides:
  - tests/run-all-142.sh (Phase 142 scoped runner over 7 CJS loop-fires suites)
  - tests/fixtures/room-142-fixture.cjs (buildFixtureDb: richer in-memory room.db)
  - 7 RED loop-fires acceptance suites (one per requirement + a Part-8 gate)
affects:
  - Plans 142-02..04 turn these suites GREEN
  - Phase 146 ACPT-01..05 composes these suites for the milestone loop-fires gate
tech_stack:
  added: []
  patterns:
    - "node:sqlite DatabaseSync in-memory fixture (caller-owned handle, never opens a real room.db)"
    - "loop-fires assertion: assert THE LOOP FIRES (surfaced finding / navigated neighborhood / dispatched entry), not merely that code exists"
    - "RED-via-missing-wiring-entry-point (ensureSectionDerived / drainWithinSession / surfaceFileEvidenceResult) so the suite goes GREEN only when the Wave-2 wiring lands"
    - "Phase 90 5-tripwire forbidden-substring + forbidden-require Part-8 sweep, scoped to the CASC-02 touched files, pulled down to a plan gate"
    - "scoped hash-call sweep that excludes a pre-existing in-scope-exempt LOCAL correlation hash (SCOPE BOUNDARY discipline)"
key_files:
  created:
    - tests/run-all-142.sh
    - tests/fixtures/room-142-fixture.cjs
    - tests/test-cascade-surface-loop-fires.cjs
    - tests/test-spine-navigates-decide.cjs
    - tests/test-brain-md-tier-rise.cjs
    - tests/test-derivation-drain-fires.cjs
    - tests/test-post-compact-nav04-closure.cjs
    - tests/test-fileval-readback-surface.cjs
    - tests/test-decide-part8-invariant.cjs
  modified: []
decisions:
  - "Fixture cloned from room-141-fixture and seeded RICHER (room root + section + 2 contradicting claims + EvidenceClaim slot + 6-fragment session) so the spine-navigates + tier-rise neighborhood walks have real signal"
  - "CASC-02 suite asserts the Phase-144 fence: routing_source must NOT be 'engine' (CASC-02 navigates but does not flip routing_source)"
  - "NAV-02 measures the tier RISE against the shipped tier_0 floor (the absent-BRAIN.md case is GREEN today); the RED is the missing ensureSectionDerived auto-fire"
  - "FILEVAL-03 reuses the shipped FILEVAL-02 wrapper for the landed + did-not-land cases; the RED is the missing Larry-facing surfaceFileEvidenceResult"
  - "Part-8 hash-call sweep is scoped to the navigation-engine files only; intent-classifier's pre-existing LOCAL correlation-id createHash is out of scope and must not be flagged"
metrics:
  duration: ~14 minutes
  completed: 2026-06-05
  tasks: 2
  files: 9
  commits: 2
---

# Phase 142 Plan 01: Local-Intelligence-Wiring Loop-Fires Test Scaffold Summary

Stood up the Nyquist floor for Phase 142 (VERIFY-AND-CLOSE the local loop): a scoped aggregator mirroring `run-all-141.sh`, a richer caller-owned in-memory fixture room.db, and seven RED loop-fires acceptance suites - one named suite per requirement plus a Part-8 gate over the one genuine build (CASC-02). Every suite asserts THE LOOP FIRES (a surfaced finding, a navigated neighborhood, a dispatched queue entry, an observable tier rise, a surfaced honesty signal), not merely that code exists. All seven are RED now and go GREEN when Plans 02-04 land the wiring.

## What Was Built

| Artifact | Requirement | Loop-fires assertion | RED reason (current tree) |
|----------|-------------|----------------------|---------------------------|
| `tests/run-all-142.sh` | runner | aggregates 7 suites, runs to completion, exits non-zero while any is RED | 7/7 FAILED, 0 MISSING |
| `tests/fixtures/room-142-fixture.cjs` | fixture | `buildFixtureDb()` seeds 5 nodes (room + section + 2 contradicting claims + EvidenceClaim slot), 4 edges (CONTAINS + 2 INFORMS + 1 CONTRADICTS), 1 session, 6 fragments | n/a (GREEN helper) |
| `tests/test-cascade-surface-loop-fires.cjs` | CASC-01 | fires post-write against a tmp-room fixture, asserts `proactive_intelligence.newFindings` is NON-EMPTY (findings would surface) | cascade short-circuits; newFindings empty/absent until Wave-2 emits a finding from the neighborhood |
| `tests/test-spine-navigates-decide.cjs` | CASC-02 | `decide()` carries `trace.navigated_neighborhood.ranked` (non-empty) from getRoomContext; `routing_source` is NOT 'engine' (Phase-144 fence) | decision_trace has no navigated_neighborhood field until Plan 02 wires getRoomContext -> decide() |
| `tests/test-brain-md-tier-rise.cjs` | NAV-02 | absent BRAIN.md -> tier_0 (floor, GREEN); `ensureSectionDerived` auto-fires + writes BRAIN.md; tier rises above tier_0 | `brain-derivation.ensureSectionDerived` not exported until Plan 02/04 wires the auto-fire |
| `tests/test-derivation-drain-fires.cjs` | NAV-03 | enqueued matching-hash entry is DISPATCHED within `drain` (Brain forced available); `drainWithinSession` fires the session drain | `brain-derivation-queue.drainWithinSession` not exported until Plan 03/04 wires the session-level drain |
| `tests/test-post-compact-nav04-closure.cjs` | NAV-04 | `restore-post-compact-context.cjs` exists + WIRED in hooks.json SessionStart + 95.5-VERIFICATION status `passed` | the consumer is NOT referenced in the SessionStart block until Plan 04 wires it (exists + 95.5 passed are GREEN) |
| `tests/test-fileval-readback-surface.cjs` | FILEVAL-03 | landed -> ok:true; did-not-land -> `filing_did_not_land`; `surfaceFileEvidenceResult` renders the honesty signal | `navigation.surfaceFileEvidenceResult` not exported until Plan 04 wires the surfacing layer (a + b are GREEN) |
| `tests/test-decide-part8-invariant.cjs` | Part-8 gate (CASC-02) | zero new packet/brain-client requires + zero egress tokens + zero new hash calls in the wiring site; navigation-engine.cjs requires the navigation.cjs chokepoint | the chokepoint require is absent until Plan 02 wires getRoomContext through it (egress sweep is GREEN/clean) |

## How It Maps to the Phase

Per 142-CONTEXT.md this is a VERIFY-AND-CLOSE phase: 4 of 5 requirements are substantially shipped, CASC-02 is the one genuine build. The suites encode exactly that classification - the shipped halves (tier_0 floor, fileval landed/did-not-land, restore script presence, 95.5 passed, Part-8 egress cleanliness) already pass; the RED in each suite is precisely the Wave-2 wiring gap (getRoomContext -> decide(), the auto-fire, the session drain, the SessionStart consumer wire, the Larry-facing surfacing). When Plans 02-04 close those gaps, each suite flips GREEN without rework, and Phase 146 ACPT-* can compose them as-is.

## Verification

```
bash tests/run-all-142.sh   -> exit 1; Total 7, Passed 0, Failed 7, 0 MISSING
node --check on all 7 suites -> all valid CJS
em-dash (U+2014) sweep       -> NONE across all 9 created files
buildFixtureDb()             -> nodes=5 edges=4 fragments=6
```

Each suite is RED for its intended loop-fires reason (confirmed individually), not from a crash or a SKIP. The fixture is caller-owned and never opens a real room.db (Canon Part 8/9).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Scoped the Part-8 hash-call sweep away from a pre-existing LOCAL correlation hash**
- **Found during:** Task 2 (Part-8 gate suite)
- **Issue:** The cloned room-context sweep applied the `sha256`/`createHash` forbidden-call check to all three CASC-02 targets, but `scripts/intent-classifier.cjs` already has a pre-existing `createHash('sha256')` for a LOCAL correlation id (roomDir + date) that is not Brain egress and is unrelated to CASC-02. As written, the suite would have stayed RED forever on that pre-existing line rather than on the CASC-02 wiring gap (SCOPE BOUNDARY violation - flagging out-of-scope pre-existing code).
- **Fix:** Split the sweep - the egress-require + egress-token checks run across all three targets (the egress surface the wiring must not add), while the hash-call sweep is scoped to the navigation-engine decide() files only. Documented the carve-out inline.
- **Files modified:** tests/test-decide-part8-invariant.cjs
- **Commit:** 28db8874

## Known Stubs

None. Every suite is a real executable assertion against shipped surfaces; the RED is the genuine Wave-2 wiring gap, not a placeholder.

## Self-Check: PASSED

- All 9 created files exist on disk (verified via git show --stat on 541dc35d + 28db8874).
- Both commits exist: 541dc35d (fixture + aggregator), 28db8874 (7 suites).
- `bash tests/run-all-142.sh` runs to completion, exits non-zero, reports 7 FAILED / 0 MISSING.

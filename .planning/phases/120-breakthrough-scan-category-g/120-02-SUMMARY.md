---
phase: 120-breakthrough-scan-category-g
plan: "02"
subsystem: lib/core/breakthrough + scripts (session-start) + hooks
tags: [breakthrough, session-start-hook, d-13-d-14-d-15-resurfacing, d-19-canary, d-20-load-bearing, canon-part-8-tripwire, canon-part-9-chokepoint, canon-part-10-sub-claim-5, additive-extension]
dependency_graph:
  requires:
    - phase-109 (SQL navigation chokepoint -- findRecentChanges + logMemoryEvent + writeEdge + detectActiveRoom)
    - phase-117 (math-layer JSON outputs that detectors consume; session-start ordering invariant -- Plan 120-02 fires AFTER detectFirstMaterial)
    - phase-119 (session-start cascade precedent -- the canonical envelope shape Plan 120-02 mirrors)
    - phase-120-00 (detectors.cjs + schema.writeBreakthrough + the 6 EVENT_TYPES + DERIVED_FROM edge type + FILED_AS_DECISION edge type)
    - phase-120-01 (selector-dispatcher F.7 branch + scoring.pickTopWithAffordance + the renderer)
  provides:
    - lib/core/breakthrough/scanner.cjs (scanForBreakthroughs + surfaceBreakthrough + applyResurfacingFilter + applyThrottleFilter; D-20 third structural enforcement point)
    - lib/core/breakthrough/resurfacing.cjs (D-13..D-15 predicates; SEVEN_DAY_COOLDOWN_MS = 604800000)
    - lib/core/breakthrough/canary.cjs (D-19 canary; computeDismissalRate + isThrottled + emitThrottleEvent; D19_DISMISSAL_THRESHOLD=0.30 + D19_FIRE_WINDOW=100 + D19_MIN_SAMPLE=10)
    - lib/core/breakthrough/verb-dispatch.cjs (5-verb to 3-event lock; F7_VERB_HANDLERS for Confirm/Dismiss/File-as-decision)
    - scripts/check-pending-breakthrough.cjs (session-start hook; emits the canonical SessionStart envelope)
    - hooks/hooks.json SessionStart entry 4 (after Phase 119 + sessionstart-coordinator + sessionstart-npm-reconcile; 2000ms timeout)
    - EVENT_TYPES Set additive extension -- breakthrough_surface_blocked (1 string; size +1)
    - tests/test-breakthrough-d20-end-to-end.cjs (LOAD-BEARING D-20 invariant tests)
    - tests/test-120-02-scaffold.sh (8-gate shell harness)
  affects:
    - Plan 120-03 (Larry-voice scaffold + ethics fence) -- consumes the surfaceBreakthrough rendered envelope to compose D-17 voice line
    - Phase 121 housekeeping -- consumes the breakthrough_throttled + breakthrough_surface_blocked events via /mos:doctor for review queue surfacing
    - Phase 121.5 terminal-coherence-capstone -- consumes the session-start scanner output in the surface-coherence sweep
tech_stack:
  added: []
  patterns:
    - additive-tail-append (EVENT_TYPES Set size +1; breakthrough_surface_blocked appended to the Phase 120-00 6-string block)
    - chokepoint-routing (Canon Part 9 D-06; ALL reads + writes via navigation.cjs + roomDb.openRoomDb)
    - graceful-degradation (corrupt math files / missing db / dispatcher throw -> top=null AND continue:true; hook NEVER blocks session)
    - canon-part-8-tripwire (source-grep test + scaffold Gate 6 assert zero brain-client require + zero brain.mindrian fetch)
    - tri-surface-adaptation (CLI/Desktop/Cowork all consume the same F.7 envelope contract)
    - d-20-third-structural-enforcement (surfaceBreakthrough verifies provenance via SQL count BEFORE F.7 dispatch; refusal emits breakthrough_surface_blocked telemetry)
    - empty-state-silence (D-16; the hook does NOTHING on cold rooms; no placeholder text; trust users to notice presence vs absence)
key_files:
  created:
    - lib/core/breakthrough/scanner.cjs (309 LOC; scanForBreakthroughs orchestrator + surfaceBreakthrough D-20 gate)
    - lib/core/breakthrough/scanner.test.cjs (268 LOC; 9 tests)
    - scripts/check-pending-breakthrough.cjs (~165 LOC; session-start hook mirroring Phase 119-01 envelope shape)
    - scripts/check-pending-breakthrough.test.cjs (~155 LOC; 5 tests)
    - tests/test-breakthrough-d20-end-to-end.cjs (~190 LOC; 4 LOAD-BEARING D-20 tests)
    - tests/test-120-02-scaffold.sh (~80 LOC; 8-gate shell harness)
  modified:
    - lib/core/navigation/memory-events.cjs (EVENT_TYPES Set +1; breakthrough_surface_blocked appended)
    - hooks/hooks.json (SessionStart array extended; 4th entry for check-pending-breakthrough.cjs)
    - lib/memory/run-feynman-tests.cjs (Phase 120-02 Wave 2 block appended at TEST_FILES tail; 6 test path entries)
  pre-existing (Plan 120-02 Task 1 + Task 2 committed before this execution):
    - lib/core/breakthrough/resurfacing.cjs (commit cb6eb180; D-13..D-15 predicates)
    - lib/core/breakthrough/resurfacing.test.cjs (commit a65f2367; 14 tests)
    - lib/core/breakthrough/canary.cjs (commit cb6eb180; D-19 canary)
    - lib/core/breakthrough/canary.test.cjs (commit a65f2367; 9 tests)
    - lib/core/breakthrough/verb-dispatch.cjs (commit 17d8e076; 5-verb dispatch consumer)
    - lib/core/breakthrough/verb-dispatch.test.cjs (commit 61b3a211; 10 tests)
key-decisions:
  - "Session-start hook ordering invariant honored: Phase 120 fires AFTER Phase 119 (detectNoActiveRoom) AND AFTER Phase 117 (detectFirstMaterial). The check-pending-breakthrough entry is the 4th SessionStart entry (after run-hook.cmd session-start, sessionstart-coordinator.cjs, sessionstart-npm-reconcile.cjs); per Canon Part 10 sub-claim 5 the math IS the surface and the scanner consumes both upstream products."
  - "D-13..D-15 resurfacing rules LOCKED VERBATIM: dismissed = 7-day cooldown AND new-artifacts-accumulated (BOTH conditions; user verbatim 'Time passing alone doesn't license resurfacing -- that's manipulation'); confirmed = once-only (D-14); filed-as-decision = never resurfaces as breakthrough (D-15)."
  - "D-19 per-detector dismissal-rate canary LOCKED VERBATIM: 30% threshold over 100-fire window with 10-fire minimum sample floor (D19_DISMISSAL_THRESHOLD=0.30 + D19_FIRE_WINDOW=100 + D19_MIN_SAMPLE=10). The scanner emits breakthrough_throttled events for /mos:doctor to surface throttled detectors at session-start. Auto-throttle recovery surface DEFERRED to Phase 121 housekeeping per CONTEXT.md Deferred Ideas."
  - "5-verb to 3-event lock LOCKED VERBATIM: VERB_TO_EVENT.['Explore deeper']=null, ['Confirm']='breakthrough_confirmed', ['File as decision']='breakthrough_filed_as_decision', ['Dismiss']='breakthrough_dismissed', ['Back']=null. Object.freeze invariant. The File-as-decision branch also writes a typed FILED_AS_DECISION edge (D-09 bridge to Phase 88 decision-log) per Canon Part 4."
  - "D-20 LOAD-BEARING SQL invariant: for every breakthrough_surfaced memory_event, the corresponding Breakthrough node has at least one DERIVED_FROM edge to an Artifact node. SQL form: SELECT COUNT(*) FROM edges WHERE source = ? AND type = 'DERIVED_FROM' returns >= 1. Verified end-to-end by tests/test-breakthrough-d20-end-to-end.cjs (4 tests; CONSTITUTIONAL acceptance criterion of Phase 120)."
  - "D-16 empty-state silence LOCKED: when scanner returns top=null (cold room / all filtered / writeBreakthrough refused), the session-start hook emits {continue:true} ONLY with NO additionalContext. No placeholder text, no F.7 dispatch. Per user verbatim: 'Trust users to notice the difference between presence and absence.'"
  - "Third D-20 structural enforcement point added in scanner.surfaceBreakthrough: SQL provenance check runs BEFORE F.7 dispatch; refusal emits breakthrough_surface_blocked telemetry for /mos:doctor traceability. Defense in depth on top of schema.cjs::validateProvenance + writeBreakthrough atomic transaction (Plan 120-00) and renderer artifact_ids check (Plan 120-01)."
  - "EVENT_TYPES Set extended additively with breakthrough_surface_blocked (size +1; baseline 59 from Phase 120-00 + dogfood-bridge). The new event surfaces D-20 refusals so /mos:doctor can find any constitutional bypass attempts. Per the Phase 109 +1-permitted floor-not-exact-count contract."
  - "Hook script mirrors Phase 119-01 (check-pending-naming-decision.cjs) canonical envelope shape: continue:true + hookSpecificOutput.additionalContext on happy-path; continue:true ONLY on D-16 silence; uncaughtException handler is the last-resort emitter. The hook NEVER blocks session start (Phase 117 + Phase 119 invariant)."
  - "Canon Part 8 invariants enforced via 3 surfaces: (1) source-grep tripwire in scaffold Gate 6 (zero brain-client require + zero brain.mindrian fetch across all new files); (2) chokepoint-routing per Canon Part 9 (ALL reads + writes via navigation.cjs + roomDb.openRoomDb); (3) explicit no-cross-room (scanner reads ONLY activeRoomDir; no fan-out)."
metrics:
  duration: "~45min"
  completed: 2026-05-17T13:08:00Z
  commits: 4
  tests_added: 18
  tests_total_120_02: 53 (14 resurfacing + 9 canary + 10 verb-dispatch + 9 scanner + 5 hook + 4 D-20 e2e + 2 bonus across suites)
  files_created: 7
  files_modified: 3
---

# Phase 120 Plan 02: Session-Start Scanner + Resurfacing + Canary + Verb-Dispatch Summary

**One-liner:** Wired the Plan 120-00 detectors + Plan 120-01 F.7 selector into a single session-start scanner with D-13..D-15 resurfacing rules, D-19 dismissal-rate canary, 5-verb dispatch consumer, and a third D-20 structural enforcement point (surface-time provenance check). 53/53 tests passing; D-20 LOAD-BEARING invariant proven end-to-end.

## Session-Start Hook Ordering Invariant (verbatim per CONTEXT.md Claude's Discretion item 4)

1. Phase 119 fires FIRST -- detectNoActiveRoom (a room must exist before breakthroughs can scan it; cold-room creates the receipt).
2. Phase 117 fires SECOND -- detectFirstMaterial (the math layer must populate room.db before breakthroughs derive from it).
3. Phase 120 fires THIRD -- scanForBreakthroughs (consumes both Phase 119's room + Phase 117's math output).

Within `hooks/hooks.json` SessionStart array, `check-pending-breakthrough.cjs` is registered as the 4th entry (after `run-hook.cmd session-start`, `sessionstart-coordinator.cjs`, and `sessionstart-npm-reconcile.cjs`). The Phase 117 hook fires as a `PostToolUse` matcher (not SessionStart), so the ordering is satisfied by the cascade structure rather than by a single sequential array.

## D-13..D-15 Resurfacing Predicates (verbatim per CONTEXT.md)

- **D-13 (dismissed):** 7-day cooldown MINIMUM, AND only if new artifacts have been added to the convergence. BOTH conditions REQUIRED. Time passing alone does NOT license resurfacing (user verbatim 2026-05-16: "that's manipulation").
- **D-14 (confirmed):** once-only. Never resurface as a breakthrough. Resurfacing what the user already accepted is patronizing.
- **D-15 (filed as decision):** never resurface as breakthrough. May be referenced in future related breakthroughs via Phase 88 decision-log machinery.

Frozen constant: `SEVEN_DAY_COOLDOWN_MS = 7 * 24 * 3600 * 1000 = 604800000`. Composite `isEligibleForSurfacing(id, db, opts)` enforces all three rules in priority order (D-14 first, D-15 next, D-13 BOTH conditions last).

## D-19 Canary Thresholds (verbatim per CONTEXT.md)

```
D19_DISMISSAL_THRESHOLD = 0.30   // 30% threshold
D19_FIRE_WINDOW = 100              // 100-fire rolling window
D19_MIN_SAMPLE = 10                // statistical adequacy floor
```

When a detector kind's dismissal rate over the rolling 100-fire window exceeds 30% (with at least 10 surfaced events in the window), the scanner auto-throttles that kind to soft-fire-only and emits a `breakthrough_throttled` memory_event for `/mos:doctor` to surface at session-start.

## 5-Verb to 3-Event Lock (verbatim per CONTEXT.md D-08..D-10)

```javascript
const VERB_TO_EVENT = Object.freeze({
  'Explore deeper':   null,                            // navigational; no event
  'Confirm':          'breakthrough_confirmed',
  'File as decision': 'breakthrough_filed_as_decision', // also writes FILED_AS_DECISION edge
  'Dismiss':          'breakthrough_dismissed',         // captures artifact_ids_at_dismiss for D-13
  'Back':             null,                            // escape; no event
});
```

D-09 file-as-decision bridge: when the user picks `[File as decision]`, verb-dispatch emits the `breakthrough_filed_as_decision` event AND writes a typed `FILED_AS_DECISION` edge via `navigation.writeEdge` so the breakthrough becomes a first-class decision with audit trail (Canon Part 4: every choice is graph data).

D-10 mandatory `[Dismiss]`: without it the detector only learns from confirmations -- a classic engagement-optimizer failure. Every fired breakthrough MUST have a dismiss exit, both as user control AND as training signal AND as Hooked-ethics protection. The Dismiss handler captures `artifact_ids_at_dismiss[]` (the baseline for D-13's newArtifactsAccumulated predicate).

## D-20 LOAD-BEARING SQL Invariant (the CONSTITUTIONAL acceptance criterion)

**The canonical D-20 Cypher invariant:**
```
MATCH (b:Breakthrough)-[:DERIVED_FROM]->(a:Artifact) RETURN count(a)
```

**Verified via the SQLite SQL form:**
```sql
SELECT COUNT(*) FROM edges
WHERE source = $breakthroughId AND type = 'DERIVED_FROM'
```
MUST return `>= 1` for every Breakthrough node.

**The batch invariant (no orphan-provenance Breakthroughs):**
```sql
SELECT b.id FROM nodes b
WHERE b.type = 'breakthrough'
  AND NOT EXISTS (
    SELECT 1 FROM edges e
    WHERE e.source = b.id AND e.type = 'DERIVED_FROM'
  )
```
MUST return ZERO rows.

**The surface/provenance pairing invariant:**
For every `breakthrough_surfaced` memory_event emitted, the corresponding Breakthrough node has at least one `DERIVED_FROM` edge. This is the CONSTITUTIONAL acceptance criterion of Phase 120 as a whole.

**Four structural enforcement points (defense in depth):**
1. `schema.cjs::validateProvenance` -- pre-write entry guard (Plan 120-00).
2. `schema.cjs::writeBreakthrough` -- atomic SQLite transaction (Plan 120-00).
3. `shape-f7-breakthrough-renderer.cjs::renderShapeF7Breakthrough` -- empty artifact_ids[] check (Plan 120-01).
4. `scanner.cjs::surfaceBreakthrough` -- SQL count check BEFORE F.7 dispatch; refusal emits `breakthrough_surface_blocked` telemetry (Plan 120-02; NEW in this plan).

## Test Count Totals + Pass Evidence

- `lib/core/breakthrough/resurfacing.test.cjs` -- 14 tests passing (Task 1; pre-existing commit a65f2367/cb6eb180)
- `lib/core/breakthrough/canary.test.cjs` -- 9 tests passing (Task 1; pre-existing)
- `lib/core/breakthrough/verb-dispatch.test.cjs` -- 10 tests passing (Task 2; pre-existing commit 61b3a211/17d8e076)
- `lib/core/breakthrough/scanner.test.cjs` -- 9 tests passing (Task 3; new commit 47202fbf RED + 3406e76a GREEN)
- `scripts/check-pending-breakthrough.test.cjs` -- 5 tests passing (Task 3; new commit 457a7dc5)
- `tests/test-breakthrough-d20-end-to-end.cjs` -- 4 tests passing (Task 3; new commit ddbaae1a)

**Aggregate: 53/53 tests passing across 6 suites.**

**Scaffold harness:** `bash tests/test-120-02-scaffold.sh` exits 0 with stdout `OK: 120-02 scaffold complete (scanner + hook + D-20 end-to-end + zero Brain coupling + zero em-dashes)`.

**Zero regression:** Phase 120-00 (4 suites; 70 tests) + Phase 120-01 (2 suites; 38 tests) baselines preserved.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical event type] Added `breakthrough_surface_blocked` to EVENT_TYPES**
- **Found during:** Task 3 (scanner.test.cjs Test 9 contract).
- **Issue:** The scanner test (committed as untracked RED at execution start) asserted that surfaceBreakthrough's D-20 refusal must emit a `breakthrough_surface_blocked` memory_event for /mos:doctor traceability. That event type was not in `EVENT_TYPES` -- `navigation.logMemoryEvent` would reject it with `invalid_event_type`.
- **Fix:** Added `breakthrough_surface_blocked` to `lib/core/navigation/memory-events.cjs` Set (additive extension; size +1) following the Phase 120-00 6-string + Phase 117-00 + dogfood-bridge additive idiom.
- **Files modified:** lib/core/navigation/memory-events.cjs
- **Commit:** 47202fbf
- **Rationale:** D-20 third structural enforcement requires a typed telemetry surface for /mos:doctor to find constitutional bypass attempts. Per Canon Part 4 ("every choice is graph data"), the refusal itself becomes typed graph data.

**2. [Rule 3 - Blocker on hooks.json shape] hook entry uses matcher/hooks nested structure**
- **Found during:** Task 3 Step 3 (extending hooks/hooks.json).
- **Issue:** The plan's example hooks.json snippet showed a flat `[{command, timeout}]` array, but the actual Claude Code hooks.json shape uses nested `{matcher, hooks: [{type, command, timeout, async, statusMessage}]}` entries (matches the canonical Claude Code 1.x+ schema).
- **Fix:** Used the canonical nested matcher/hooks shape mirroring the existing sessionstart-coordinator.cjs entry verbatim. The check-pending-breakthrough hook lands as the 4th SessionStart entry with `matcher: "startup|clear|compact"`, `async: false`, and `statusMessage: "Scanning for breakthroughs..."` (per Plan 120-03 Larry-voice scaffold downstream consumption).
- **Files modified:** hooks/hooks.json
- **Commit:** 457a7dc5

**3. [Rule 3 - Substrate detail] Edges table uses `source` / `target` / `type` columns (not `source_id` / `target_id` / `edge_type`)**
- **Found during:** Task 3 Step 1 (writing the scanner SQL for D-20 provenance check).
- **Issue:** The plan's example SQL used `source_id` / `edge_type` column names, but the actual Phase 109 + Phase 125-00 schema uses `source` / `target` / `type` (per `lib/core/lazygraph-ops.cjs::initSchema`). The same column-name convention also applies to scanner.test.cjs.
- **Fix:** All SQL queries in scanner.cjs + test-breakthrough-d20-end-to-end.cjs + scanner.test.cjs use the canonical `source` / `target` / `type` shape verbatim.
- **Files affected:** lib/core/breakthrough/scanner.cjs, tests/test-breakthrough-d20-end-to-end.cjs
- **Commits:** 3406e76a (scanner.cjs); ddbaae1a (e2e test)

**4. [Rule 3 - Substrate detail] room.db opened via `lib/core/room-db.cjs::openRoomDb` (not `lazygraph-ops.cjs`)**
- **Found during:** Task 3 Step 1 (resolving the db-open chokepoint).
- **Issue:** The plan's example used `require('../lazygraph-ops.cjs').openRoomDb(dbPath)` but the canonical chokepoint per Phase 109-02 is `lib/core/room-db.cjs::openRoomDb(roomDir)` which takes a room directory (not a db path) and returns the bare DatabaseSync handle.
- **Fix:** scanner.cjs requires `../room-db.cjs` and calls `openRoomDb(roomDir)` directly. Matches the scanner.test.cjs convention.
- **Files affected:** lib/core/breakthrough/scanner.cjs
- **Commit:** 3406e76a

### Pre-existing Test Failure (Out of Scope per Scope Boundary Rule)

`tests/test-auto-explore-telemetry.cjs` asserts `EVENT_TYPES.size === 32` (Phase 117-era exact-count check). Pre-existing failure: was 58 before Plan 120-02 (Phase 117-05 baseline already exceeded; Phase 120-00 added 6; dogfood-bridge added 6; etc.) and is now 59 after Plan 120-02's `+1`. Per the scope boundary rule, this failing assertion is out of scope -- it tests a stale invariant unrelated to Phase 120-02. The Phase 109 floor-not-exact-count contract (`>= 22` baseline) is preserved. Plan 120-03 may revisit per `/mos:doctor` housekeeping or defer to Phase 121 housekeeping.

## Authentication Gates

None.

## Commits (Task 3 only; Tasks 1 + 2 pre-existed)

| Hash      | Type | Message                                                                          |
| --------- | ---- | -------------------------------------------------------------------------------- |
| 47202fbf  | test | add failing tests for scanner orchestrator (RED) + EVENT_TYPES extension         |
| 3406e76a  | feat | implement scanner orchestrator (GREEN)                                           |
| 457a7dc5  | feat | wire session-start scanner hook (GREEN)                                          |
| ddbaae1a  | test | add D-20 LOAD-BEARING integration test + scaffold harness + Feynman runner       |

Pre-existing Task 1 + Task 2 commits (per execution prompt):
| Hash      | Type | Message                                                          |
| --------- | ---- | ---------------------------------------------------------------- |
| a65f2367  | test | add failing tests for resurfacing + canary (RED)                  |
| cb6eb180  | feat | implement D-13..D-15 resurfacing + D-19 canary (GREEN)            |
| 61b3a211  | test | add failing tests for verb-dispatch (RED)                         |
| 17d8e076  | feat | implement 5-verb dispatch consumer (GREEN)                        |

## Self-Check: PASSED

Files verified present on disk:
- lib/core/breakthrough/scanner.cjs (FOUND)
- lib/core/breakthrough/resurfacing.cjs (FOUND, pre-existing)
- lib/core/breakthrough/canary.cjs (FOUND, pre-existing)
- lib/core/breakthrough/verb-dispatch.cjs (FOUND, pre-existing)
- scripts/check-pending-breakthrough.cjs (FOUND)
- tests/test-breakthrough-d20-end-to-end.cjs (FOUND)
- tests/test-120-02-scaffold.sh (FOUND, executable)

Commits verified in git log:
- 47202fbf (FOUND)
- 3406e76a (FOUND)
- 457a7dc5 (FOUND)
- ddbaae1a (FOUND)

Scaffold harness: `bash tests/test-120-02-scaffold.sh` exits 0.

All 53 Phase 120-02 tests + the 70 wave-1 baseline tests (120-00 + 120-01) pass with zero regression.

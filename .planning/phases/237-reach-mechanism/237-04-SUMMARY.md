---
phase: 237-reach-mechanism
plan: 04
subsystem: reach-mechanism
tags: [session-scoping, cross-session-isolation, insight-sensors, mcp, cowork, concurrency]

# Dependency graph
requires:
  - phase: 237-reach-mechanism (plan 01)
    provides: tests/run-all-237.sh aggregator with SKIP-safe REACH-03 legs already wired
provides:
  - "isMarkerOwnedByCaller(markerSessionId, callerSessionId): the shared fail-open ownership filter"
  - "deriveTurnSignals(ctx, sessionId): widened to thread the caller session id, second arg optional"
  - "sensorArtifactFiled scoped to the same ownership check as the second independent reader of last-cascade.json"
  - "a two-process fork() fence proving cross-session bleed is closed with real OS-level concurrency"
  - "19-assertion fail-open degrade suite proving the filter never silences a legitimate caller"
affects: [237-06 (post-write / auto-explore-fire session stamping), 237-mcp-first-milestone (v1.17.0, the room-binding leg this plan explicitly does not touch)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "content-stamped marker ownership (session_id inside the JSON payload) chosen over path-scoping, so the fixed last-cascade.json filename several other consumers read stays unchanged"
    - "filter, not gate: suppress ONLY on a positive session-id mismatch; every other state (legacy marker, unknown caller, matching ids) fires open"
    - "fork()-based two-process test fixtures for cross-session concurrency proofs (matches lib/memory/write-lock-atomic.test.cjs precedent)"

key-files:
  created:
    - tests/test-237-session-scope.cjs
    - tests/test-237-session-scope.worker.cjs
    - tests/test-237-session-scope-degrade.cjs
  modified:
    - lib/core/insight-sensors.cjs

key-decisions:
  - "SC3 numbering: built to ROADMAP.md's Success Criterion 3 wording (the stale-marker / turn-signal leg), which matches REQUIREMENTS.md REACH-03 and the routed-in RCA's Test 2. The RCA's Test 1 (room-binding / resolveWriteTargetDir collapse) is explicitly the v1.17.0 MCP-First milestone's scope and was not built here -- see room-bind-mcp-first-off-falls-back-to-stale-global-active-room.md's own next_action."
  - "Single ownership helper (isMarkerOwnedByCaller) instead of separate suppression logic per reader, so deriveTurnSignals and sensorArtifactFiled cannot drift out of agreement the way the module's own doctrine header (deliberate duplication 'so signal and sensor agree') requires."
  - "Caller session id sourced from what normalizeTurn already has in scope (turn.sessionId / ctx.sessionId), never resolveEffectiveSessionId and never process.env.CLAUDE_CODE_SESSION_ID -- avoids adding a fourth session-id resolver (Canon Part 7)."

patterns-established:
  - "Marker ownership filters fail OPEN: suppress only on a positive mismatch (both ids present and different). Exported so the four remaining unscoped markers can adopt the same helper without inventing a second mechanism."

requirements-completed: [REACH-03]

# Metrics
duration: ~20min
completed: 2026-07-28
---

# Phase 237 Plan 04: Session-Scope Turn-Signal Fence Summary

**Threaded a caller session id into `deriveTurnSignals`/`sensorArtifactFiled` and added `isMarkerOwnedByCaller`, a fail-open ownership filter, so a candidate reach in one Cowork session can no longer be driven by another session's stale `last-cascade.json` / `auto-explore-*.json` marker.**

## Performance

- **Duration:** ~20 min (commit span 23:44:50 to 23:52:03 local; reading/research preceded that)
- **Tasks:** 3
- **Files modified:** 4 (1 source, 3 new test files)

## Accomplishments

- Proved the cross-session bleed live with two real OS processes (`child_process.fork`), captured RED, then made it impossible.
- Added `isMarkerOwnedByCaller`, a single shared fail-open filter used by both independent readers of `last-cascade.json` (`deriveTurnSignals` and `sensorArtifactFiled`), so the module's own "signal and sensor agree" doctrine holds after the fix, not just before it.
- Widened `deriveTurnSignals(ctx, sessionId)` with the second argument optional -- every existing single-argument caller is byte-stable.
- Proved every degrade path (legacy unstamped marker, unknown caller, matching ids, non-string edges, one-argument backward compatibility) still fires, with 19 assertions and a live inverted-degrade-rule mutation that turns two of them red.
- Zero drift into `lib/mcp/tools/sensors.cjs` (empty diff) or the four out-of-scope sibling markers (empty diff).

## Task Commits

Each task was committed atomically:

1. **Task 1: Author the two-process session-scope fence and its worker, demonstrate the bleed RED** - `37b2aa66` (test)
2. **Task 2: Thread the caller session id into deriveTurnSignals and scope both readers of the marker** - `c191bb51` (fix)
3. **Task 3: Prove the filter fails open on every degrade path, including the second reader** - `8f24728f` (test)

No plan-metadata commit was created directly by this executor -- the orchestrator owns STATE.md/ROADMAP.md writes centrally per the objective's instruction, so there is no fourth "docs: complete plan" commit in this plan's own history.

## Files Created/Modified

- `lib/core/insight-sensors.cjs` - added `isMarkerOwnedByCaller` (exported), widened `deriveTurnSignals(ctx, sessionId)`, threaded the caller session id through `normalizeTurn`'s call site, scoped `sensorArtifactFiled`'s independent re-read of `last-cascade.json` to the same check.
- `tests/test-237-session-scope.cjs` - the fork()-based two-process fence: Leg 1 (bleed closed), Leg 2 (not silenced), Leg 3 (first_material parity), Leg 4 (mutation proof).
- `tests/test-237-session-scope.worker.cjs` - standalone forked worker seeding a session-stamped `last-cascade.json` or `auto-explore-*.json` marker (argv contract: roomDir, sessionId, kind; exit 0/3/4).
- `tests/test-237-session-scope-degrade.cjs` - 19-assertion fail-open degrade suite across three layers (the helper directly, `deriveTurnSignals` end to end, `sensorArtifactFiled` directly), with an assertion-count guard.

## Decisions Made

- **SC3 numbering** (recorded per the plan's own instruction): built to ROADMAP.md's Success Criterion 3 wording -- the stale-marker/turn-signal leg -- which matches REQUIREMENTS.md's REACH-03 and Test 2 in `.planning/debug/room-bind-mcp-first-off-falls-back-to-stale-global-active-room.md`. That RCA's Test 1 (the eight-copy room-resolution ladder / `room_bind` authority) is explicitly routed to the separate v1.17.0 "MCP-First" milestone and was intentionally not touched by this plan (per the executor's own scope boundary and the RCA's `next_action`).
- **Content-stamping over path-scoping**: the marker's own JSON payload carries `session_id`; the fixed `last-cascade.json` filename is unchanged, so the several other shipped consumers of that path (skills/room-proactive, memory-completion-detector, unknowns/orchestrator) are unaffected.
- **One shared helper, not two suppression implementations**: both `deriveTurnSignals` and `sensorArtifactFiled` call the exact same `isMarkerOwnedByCaller`, closing the specific one-sided-fix failure mode the module's doctrine header warns about.
- **No fourth session resolver**: the caller session id is threaded from `turn.sessionId`/`ctx.sessionId`, already in scope at `normalizeTurn` and `sensorArtifactFiled`'s call sites -- never `resolveEffectiveSessionId`, never `process.env.CLAUDE_CODE_SESSION_ID`.

## Deviations from Plan

None - plan executed exactly as written. All four `must_haves.truths` hold, all `must_haves.artifacts` exist at or above their `min_lines` floor, and both `key_links` patterns (`deriveTurnSignals(ctx,` and `isMarkerOwnedByCaller`) are present.

## Pre-Fix RED Capture (Task 1, before Task 2 landed)

```
LEG FAIL: Leg 1 (BLEED CLOSED) + Leg 2 (NOT SILENCED) -- artifact_filed -- LEG 1 (BLEED CLOSED): session B normalized signals must not contain artifact_filed from a marker seeded by session A
LEG FAIL: Leg 3 (FIRST_MATERIAL PARITY) -- first_material -- LEG 3 (FIRST_MATERIAL PARITY, bleed closed): session B normalized signals must not contain first_material from a marker seeded by session A
LEG FAIL: Leg 4 (MUTATION) -- neutralized ownership check reopens the bleed -- expected ownership-check needle not found in insight-sensors.cjs (Task 2 has not landed yet, or the source drifted)

========================================
  test-237-session-scope: 0/3 legs passed
========================================
FAILED LEGS:
  - Leg 1 (BLEED CLOSED) + Leg 2 (NOT SILENCED) -- artifact_filed: LEG 1 (BLEED CLOSED): session B normalized signals must not contain artifact_filed from a marker seeded by session A
  - Leg 3 (FIRST_MATERIAL PARITY) -- first_material: LEG 3 (FIRST_MATERIAL PARITY, bleed closed): session B normalized signals must not contain first_material from a marker seeded by session A
  - Leg 4 (MUTATION) -- neutralized ownership check reopens the bleed: expected ownership-check needle not found in insight-sensors.cjs (Task 2 has not landed yet, or the source drifted)
EXIT=1
```

This is the reproduction: with two real forked OS processes, session B's own `dispatchSensors` pull saw session A's `artifact_filed` and `first_material` markers as its own turn signals, exactly the T-237-04-01 threat.

## Post-Fix GREEN (after Task 2)

```
LEG PASS: Leg 1 (BLEED CLOSED) + Leg 2 (NOT SILENCED) -- artifact_filed
LEG PASS: Leg 3 (FIRST_MATERIAL PARITY) -- first_material
LEG PASS: Leg 4 (MUTATION) -- neutralized ownership check reopens the bleed

========================================
  test-237-session-scope: 3/3 legs passed
========================================
```

## Live Mutation Re-Check (Task 2 acceptance criteria -- working-tree mutation, distinct from Leg 4's tmp-copy mutation)

Neutralized `return markerSessionId === callerSessionId;` to `return true;` directly in the working-tree `lib/core/insight-sensors.cjs`, ran the fence, captured RED, reverted byte-identically, confirmed `git status --porcelain lib/core/insight-sensors.cjs` showed only the intended Task 2 diff (no residual mutation bytes).

**RED (mutated):**
```
LEG FAIL: Leg 1 (BLEED CLOSED) + Leg 2 (NOT SILENCED) -- artifact_filed -- LEG 1 (BLEED CLOSED): session B normalized signals must not contain artifact_filed from a marker seeded by session A
LEG FAIL: Leg 3 (FIRST_MATERIAL PARITY) -- first_material -- LEG 3 (FIRST_MATERIAL PARITY, bleed closed): session B normalized signals must not contain first_material from a marker seeded by session A
LEG FAIL: Leg 4 (MUTATION) -- neutralized ownership check reopens the bleed -- expected ownership-check needle not found in insight-sensors.cjs (Task 2 has not landed yet, or the source drifted)

test-237-session-scope: 0/3 legs passed
EXIT=1
```

**GREEN (restored):**
```
LEG PASS: Leg 1 (BLEED CLOSED) + Leg 2 (NOT SILENCED) -- artifact_filed
LEG PASS: Leg 3 (FIRST_MATERIAL PARITY) -- first_material
LEG PASS: Leg 4 (MUTATION) -- neutralized ownership check reopens the bleed

test-237-session-scope: 3/3 legs passed
EXIT=0
```

## Task 3 Degrade Suite (19/19 assertions)

```
test-237-session-scope-degrade
  ok - isMarkerOwnedByCaller: marker A / caller B -> false (the ONLY suppression: a positive mismatch)
  ok - isMarkerOwnedByCaller: marker absent / caller B -> true (legacy marker keeps firing)
  ok - isMarkerOwnedByCaller: marker A / caller null -> true (an unknown caller cannot prove ownership either way)
  ok - isMarkerOwnedByCaller: marker A / caller A -> true (matching ids)
  ok - isMarkerOwnedByCaller: marker "" (empty string) / caller B -> true (non-string edge)
  ok - isMarkerOwnedByCaller: marker undefined / caller B -> true (non-string edge)
  ok - isMarkerOwnedByCaller: marker 123 (number) / caller B -> true (non-string edge)
  ok - isMarkerOwnedByCaller: marker A / caller "" (empty string) -> true (non-string edge)
  ok - isMarkerOwnedByCaller: marker A / caller undefined -> true (non-string edge)
  ok - deriveTurnSignals: marker A / caller B -> artifact_filed suppressed (positive mismatch)
  ok - deriveTurnSignals: marker with NO session_id at all / caller B -> artifact_filed still fires (every existing room on disk today)
  ok - deriveTurnSignals: marker A / caller null -> artifact_filed still fires (unknown caller)
  ok - deriveTurnSignals: marker A / caller A -> artifact_filed still fires (matching ids)
  ok - deriveTurnSignals: legacy marker (no session_id) / caller with a real session id -> artifact_filed still fires
  ok - deriveTurnSignals(ctx): single-argument call against a session-stamped marker still fires artifact_filed
  ok - sensorArtifactFiled: marker A / caller B -> null (suppressed, second reader agrees with the derived signal)
  ok - sensorArtifactFiled: marker absent session_id / caller B -> fires (legacy marker, second reader agrees)
  ok - sensorArtifactFiled: marker A / caller null -> fires (unknown caller, second reader agrees)
  ok - sensorArtifactFiled: marker A / caller A -> fires (matching ids, second reader agrees)

19/19 assertions passed
EXIT=0
```

## Inverted-Degrade-Rule Mutation (Task 3 acceptance criteria -- demonstrated live, not shipped as code)

Built a tmp copy of `lib/core/insight-sensors.cjs` (relative requires pinned to absolute repo paths, same technique as Leg 4) with the degrade rule inverted: `if (!markerOk || !callerOk) return false;` instead of `return true;` -- i.e. suppress on an absent/unresolvable session id instead of firing open. Re-ran two representative legacy-marker rows from the degrade suite against the inverted module. Never touched the working tree; the harness file was written under `tests/.tmp-invert-degrade-mutation.cjs`, run, and deleted before this plan's final `git status` check.

```
EXPECTED FAIL (mutation bit): isMarkerOwnedByCaller: marker absent / caller B -> true (legacy marker keeps firing) -- Expected values to be strictly equal:

false !== true

EXPECTED FAIL (mutation bit): deriveTurnSignals: legacy marker (no session_id) / caller with a real session id -> artifact_filed still fires -- The expression evaluated to a falsy value:

  assert.ok(signals.indexOf('artifact_filed') !== -1)

Inverted-degrade-rule mutation: 2 of 2 representative legacy-marker rows now FAIL, as expected.
EXIT=1
```

This proves the degrade suite is not vacuously green: an over-suppressing implementation (the exact T-237-04-02 Denial-of-Service failure mode) is caught.

## Known-Unscoped Markers (recorded per plan instruction, not fixed here)

Four room-scoped freshness markers share the identical unscoped shape and are explicitly OUT of this plan's blast radius. `isMarkerOwnedByCaller` is exported so a future plan can adopt it without a second mechanism:

| Marker file | Reading sensor |
|---|---|
| `<roomDir>/.mindrian/last-eureka.json` | `lib/core/sensors/sensor-eureka.cjs` |
| `<roomDir>/.mindrian/last-opportunity-harvest.json` | `lib/core/sensors/sensor-opportunity-harvest.cjs` |
| `<roomDir>/.mindrian/url-ingest-ledger.json` | `lib/core/sensors/sensor-url-ingest.cjs` |
| `<roomDir>/.mindrian/` (diffusion marker scan) | `lib/core/sensors/sensor-diffusion-adoption.cjs` |

Confirmed zero diff on all four during this plan: `git diff --stat` over the four files is empty.

## Issues Encountered

- **Pre-existing, out-of-scope regression observed while running `bash tests/run-all-237.sh`:** the "REGRESSION act-command adapted decideFn still reaches decide()" leg (`tests/test-act-on-runchain.cjs`) fails. This is already documented in `.planning/phases/237-reach-mechanism/deferred-items.md` item 1, filed during Plan 237-01: a stale hardcoded baseline string predating the `FIRE-IF-FORK` block `lib/hmi/selector-dispatcher.cjs` now injects into every rendered gate card. Confirmed unrelated to this plan by require-graph inspection (`tests/test-act-on-runchain.cjs` requires only `scripts/act-command.cjs`, `lib/core/chain-executor.cjs`, `lib/core/recipe-maps.cjs` -- none of which this plan touched) and by `git diff --stat` showing zero changes to any of those three files in this plan's history. Not touched here per the SCOPE BOUNDARY rule; not re-fixed, not re-investigated.
- The plan's grep-based acceptance criterion `grep -c "Promise.all" tests/test-237-session-scope.cjs` returns 0 initially caught two harmless comment mentions of "Promise.all" in the file's own header documentation. Reworded both comments to avoid the literal substring so the criterion is satisfied on its exact literal wording, without weakening the underlying true-concurrency guarantee (the file still uses a real `new Promise` wrapper around `fork()`, just never `Promise.all`).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 1 of Phase 237 (Plans 01-04) is now complete on this branch.
- REACH-03's reader half is closed. Plan 06 (writer half: `scripts/post-write` and `scripts/auto-explore-fire.cjs` stamping `session_id`) is the natural next consumer of this plan's contract -- until Plan 06 lands, every marker on disk is the "legacy, no session_id" shape, which this plan's own degrade suite proves still fires correctly (no regression for any existing room).
- `bash tests/run-all-237.sh` reports both REACH-03 legs as `PASSED`; the aggregator's overall non-zero exit is due entirely to the pre-existing, already-documented `test-act-on-runchain.cjs` regression (Plan 237-01's territory) and 4 expected SKIPs for Waves 2-3 plans (05, 07, 08) not yet landed -- not a defect introduced by this plan.
- Zero touches to `.planning/phases/236-room-db-data-loss-fixes/`, `lib/core/lazygraph-ops.cjs`, `scripts/build-ecosystem-graph.cjs`, or `tests/test-236-*` (confirmed by file list of every Read/Edit/Write/Bash call this plan made).

---
*Phase: 237-reach-mechanism*
*Completed: 2026-07-28*

## Self-Check: PASSED

- FOUND: lib/core/insight-sensors.cjs
- FOUND: tests/test-237-session-scope.cjs
- FOUND: tests/test-237-session-scope.worker.cjs
- FOUND: tests/test-237-session-scope-degrade.cjs
- FOUND: .planning/phases/237-reach-mechanism/237-04-SUMMARY.md
- FOUND commit: 37b2aa66 (test(237-04): add two-process session-scope fence for turn signals)
- FOUND commit: c191bb51 (fix(237-04): scope turn-signal markers to the calling session, fail open on every degrade)
- FOUND commit: 8f24728f (test(237-04): assert the session filter fails open on every non-mismatch state)

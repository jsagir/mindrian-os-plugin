---
phase: 109-sql-context-memory-navigation-spine
plan: "10"
subsystem: testing
tags: [sqlite, navigation, fs-instrument, brain-packet, room-home, canon-part-9, acceptance-gate]

# Dependency graph
requires:
  - phase: 109-00
    provides: the test-navigation-acceptance.cjs Wave-0 stub + tests/helpers/fs-instrument.cjs + tests/fixtures/phase-109/sample-room/seed.sql
  - phase: 109-02
    provides: lib/core/navigation/focus.cjs (getActiveFocus / setFocus / _mocks seam) + the session_focus migration
  - phase: 109-03
    provides: lib/core/navigation/memory-events.cjs (findRecentChanges)
  - phase: 109-04
    provides: lib/core/navigation.cjs chokepoint + lib/core/navigation/neighborhood.cjs (getNeighborhood)
  - phase: 109-05
    provides: lib/core/navigation/insights.cjs (findContradictions / findRelevantOpportunities / ...)
  - phase: 109-07
    provides: lib/core/navigation/packet.cjs (buildBrainPacket)
  - phase: 109-09
    provides: lib/core/navigation/room-home.cjs (getRoomHomeView) + the makeRoom/cleanup/defaultMocks/run() test pattern this test mirrors
provides:
  - "tests/test-navigation-acceptance.cjs: the load-bearing instrumented acceptance test for Phase 109 (NAV-109-09) - a full navigation flow through the lib/core/navigation.cjs chokepoint run with the fs-instrument fs-proxy active, asserting zero non-SQLite filesystem reads plus shape/privacy/composition assertions"
  - "lib/core/navigation/neighborhood.cjs now returns the created_at provenance field on every neighbor (RESEARCH section 10.1 step 5 compliance)"
affects: [109-11, 109-12, 110-brain-context-packet-contract, navigation-engine]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Instrumented acceptance test: setup/teardown (openRoomDb + seed + setFocus + cleanup rmSync) happen with the fs proxy NOT installed; only the navigation flow runs under the proxy; calls().length === 0 is the release gate"
    - "Chokepoint-only exercise: every navigation call routes through lib/core/navigation.cjs; never requires lib/core/navigation/*.cjs submodules directly (proves the chokepoint is the only door per Canon Part 9)"
    - "_mocks seam mandatory on every opts-accepting call ({ jtbd: { getCurrent: () => ({ current: null }) }, operator: { getCurrent: () => ({ current: null }) } }) so the file-touching lib/hmi/jtbd-state.cjs / lib/conversation/operator.cjs requires never fire"
    - "Provenance assertion tolerant of camelCase OR snake_case keys via an alias map (a naming difference between modules is not treated as a gap)"

key-files:
  created: []
  modified:
    - "tests/test-navigation-acceptance.cjs (the 8-line Wave-0 process.exit(1) stub replaced with 213 lines of real instrumented assertions)"
    - "lib/core/navigation/neighborhood.cjs (NEIGHBORHOOD_SQL recursive CTE + outer SELECT + row mapper gain the created_at field)"

key-decisions:
  - "The provenance check accepts camelCase OR snake_case for each logical field; only an actually-absent field counts as a gap. getNeighborhood was genuinely missing created_at (not a naming difference) - fixed surgically in neighborhood.cjs."
  - "The test does not require findRecentChanges to return seeded memory_event rows (the seed timestamps are May 2024, far outside the 24h window). It requires >=1 row, which the setFocus focus_changed memory_event (created with Date.now() before the proxy install) reliably provides."
  - "setFocus is called BEFORE the fs proxy install so its focus_changed memory_event write does not count against the zero-reads gate (and getActiveFocus then resolves the focus during the flow)."

patterns-established:
  - "Phase 109 release gate pattern: a single instrumented test that proves a Canon claim (SQL is the local mind) by syscall-class instrumentation, not by promise."

requirements-completed: [NAV-109-09]

# Metrics
duration: 20min
completed: 2026-05-12
---

# Phase 109 Plan 10: Load-Bearing Acceptance Test Summary

**Filled tests/test-navigation-acceptance.cjs with the real instrumented navigation flow through the lib/core/navigation.cjs chokepoint under the fs-instrument fs-proxy, proving zero non-SQLite filesystem reads (Canon Part 9 release gate), plus shape/privacy/composition assertions; surfaced and surgically fixed the missing `created_at` provenance field on getNeighborhood entries.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-05-12 (this session)
- **Completed:** 2026-05-12
- **Tasks:** 2 (Task 1 fill the test; Task 2 conditional surgical fix - a real gap surfaced, so Task 2 was NOT a no-op)
- **Files modified:** 2 (tests/test-navigation-acceptance.cjs, lib/core/navigation/neighborhood.cjs)

## Accomplishments

- `tests/test-navigation-acceptance.cjs` is now 213 lines of real assertion code (was an 8-line `process.exit(1)` stub). The Wave-0 `MISSING - Wave 4 ...` stderr line is gone. `node tests/test-navigation-acceptance.cjs` exits 0.
- The test runs the full navigation flow via the chokepoint **only**: `getActiveFocus -> getNeighborhood -> findContradictions -> findRelevantOpportunities -> findRecentChanges -> buildBrainPacket -> getRoomHomeView`, every opts-accepting call carrying the `_mocks` seam `{ jtbd: { getCurrent: () => ({ current: null }) }, operator: { getCurrent: () => ({ current: null }) } }`.
- Setup (`openRoomDb(tmp)` runs the Plan 109-01 nodes-provenance migration + the Plan 109-02 session_focus migration + schema bootstrap; then `db.exec(fs.readFileSync(seed.sql))` applies the 500-node fixture; then `navigation.setFocus(db, 'sess-acceptance', 'decision:mcp-app-first', 'user')`) all happen **before** `fsInstrument.install({ throwOnViolation: false })`. Teardown (`fs.rmSync` recursive) happens in a `finally` block **after** `fsInstrument.uninstall()`.
- **LOAD-BEARING assertion passes:** `fsInstrument.calls().length === 0` after the flow - zero non-SQLite filesystem reads during the navigation flow. No leak was ever observed (the `_mocks` seam keeps `jtbd-state.cjs` / `operator.cjs` out of the require graph; everything else is `node:sqlite` against `.mindrian/room.db` which the proxy allow-lists). The assertion message lists `{ method, target }` for any leak so a future regression is immediately diagnosable.
- Shape assertions pass: getNeighborhood entries carry `edgePath` (array) + numeric `score` + the five provenance fields; `buildBrainPacket` output has `packet_version / job / active_context (with focus_node.id + .type) / local_graph_summary / constraints`; `getRoomHomeView` output has all 9 D-08 keys.
- Privacy assertions pass: the serialized `buildBrainPacket` is **631 estimated tokens** (2523 chars / 4) - well under the 1200-token budget; `local_graph_summary.banked_opportunities.items[]` entries carry only `id_hash` + generic `tags` + `hsi_band` + rounded `composite_score` - no `title`/`body`/`summary`/`text`/`claim`; and a belt-and-braces regex confirms no raw seeded opportunity title (`Opportunity 0XX`) appears in the serialized packet.
- Composition-not-duplication assertion passes: in `getRoomHomeView`, the id sets of `confirmedFacts` (30 entries) and `riskyAssumptions` (0 entries in this fixture) are disjoint.
- All 14 other Phase-109 test suites still pass (no regression): `test-navigation-{migration-idempotent,migration-backfill,migration-coexistence,migration-views,focus,memory-events,neighborhood,insights,chokepoint-hook,packet-builder,packet-part8-leak,perf-10k}.cjs` + `test-brain-ingestion-part-9-invariant.cjs` + `test-room-home-vs-brain-derivation-regression.cjs`. (`test-navigation-neighborhood.cjs` 8/8 after the created_at change; `test-navigation-packet-builder.cjs` 10/10; `test-navigation-packet-part8-leak.cjs` 8 tripwires; `test-navigation-perf-10k.cjs` cold=0.74ms warm_p95=0.63ms.)

## Navigation calls exercised (and their `_mocks` usage)

| Call (via lib/core/navigation.cjs) | opts passed | result observed in the fixture |
| --- | --- | --- |
| `getActiveFocus(db, 'sess-acceptance')` | none | resolves `decision:mcp-app-first` (set in setup) |
| `getNeighborhood(db, 'decision:mcp-app-first', { maxDepth: 2, topK: 20, _mocks })` | `_mocks` | 7 ranked entries, each with `edgePath`, numeric `score`, `createdBy/sourcePath/reviewStatus/createdAt/lastSeenAt` |
| `findContradictions(db, 'decision:mcp-app-first')` | n/a (no opts) | `[]` (no CONTRADICTS edge reachable from the focus in this fixture - the assertion only requires an array) |
| `findRelevantOpportunities(db, 'decision:mcp-app-first', { topK: 3, _mocks })` | `_mocks` | 3 entries (<= topK) |
| `findRecentChanges(db, Date.now() - 24h, { limit: 50 })` | `{ limit }` | 1 entry (the setFocus `focus_changed` memory_event; the 52 seeded memory_events are May-2024, outside the 24h window) |
| `buildBrainPacket(db, 'suggest_next_move', 'decision:mcp-app-first', { _mocks })` | `_mocks` | plain object, 2523 chars / ~631 tokens, no raw bodies |
| `getRoomHomeView(db, 'phase-109-fixture', { _mocks })` | `_mocks` | all 9 D-08 keys; confirmedFacts(30) / riskyAssumptions(0) disjoint |

## Task Commits

1. **Task 1: Replace the Wave-0 stub with the real instrumented navigation flow** - `3449f36` (test)
2. **Task 2: Surgical fix - getNeighborhood entries carry created_at provenance** - `cbf40a9` (fix)

**Plan metadata:** (this commit) `docs(109-10): complete acceptance-test plan`

_TDD note: Task 1 (`test(...)`) wrote the real test which immediately surfaced the gap (RED on `missing: ["created_at"]` with the zero-reads assertion already green); Task 2 (`fix(...)`) closed the gap (GREEN). No refactor commit was needed._

## Files Created/Modified

- `tests/test-navigation-acceptance.cjs` - replaced the 8-line `process.exit(1)` stub with the real instrumented acceptance test (213 lines): temp room setup + 500-node fixture seed + setFocus (pre-proxy), fs-instrument install, full chokepoint flow with the `_mocks` seam, fs-instrument uninstall, then the zero-non-SQLite-reads load-bearing assertion + shape + privacy + composition assertions, cleanup in `finally`.
- `lib/core/navigation/neighborhood.cjs` - added `created_at` to the `NEIGHBORHOOD_SQL` recursive CTE column list (base case + recursive arm), to the outer `SELECT`, and `createdAt` to the row mapper. No restructure of the query or the function.

## Decisions Made

- **Provenance check tolerance:** the `hasProvenance` helper accepts camelCase OR snake_case for each of the five logical fields (`created_by`, `review_status`, `created_at`, `last_seen_at`, `source_path`). A naming difference between modules is not a gap; only an actually-absent field is. `getNeighborhood` was genuinely missing `created_at` - so Task 2 fixed it rather than the test loosening the check.
- **findRecentChanges expectation:** the test requires `recentChanges.length > 0`, satisfied by the `setFocus` `focus_changed` memory_event (created with `Date.now()` before the proxy install). It does NOT require the 52 seeded memory_events (their timestamps are May 2024, outside the 24h window) - that would be a fixture-coupling that adds nothing to the gate.
- **setFocus ordering:** `setFocus` runs before the proxy install so its `focus_changed` memory_event DB write does not count against the zero-reads gate, and so `getActiveFocus` resolves the focus during the instrumented flow.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug / Plan Task 2 Case B] getNeighborhood entries missing the `created_at` provenance field**
- **Found during:** Task 1 (writing the real acceptance test) - the first run failed on `neighbor carries provenance fields; missing: ["created_at"]`. The Phase 109-04 `NEIGHBORHOOD_SQL` recursive CTE selected `last_seen_at` but not `created_at`, so the row mapper omitted `createdAt`.
- **Why it matters:** RESEARCH section 10.1 step 5 + CONTEXT specifics require every returned node to carry `created_by / source_path / review_status / created_at / last_seen_at`. This is the conditional gap that the plan's Task 2 ("Case B - it exits 1 with a FAIL that traces to a genuine shape bug") explicitly anticipates.
- **Fix:** Added `n.created_at` to both arms of the CTE column list and the outer `SELECT`; added `createdAt: r.created_at` to the row mapper. The smallest possible change - no restructure of the function.
- **Files modified:** `lib/core/navigation/neighborhood.cjs`
- **Verification:** `node tests/test-navigation-acceptance.cjs` now exits 0; `node tests/test-navigation-neighborhood.cjs` still 8/8; all 14 other Phase-109 suites still pass; no em-dashes or en-dashes introduced.
- **Committed in:** `cbf40a9` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug / Plan-anticipated Task-2 Case-B surgical fix).
**Impact on plan:** The fix is exactly the surgical patch Task 2 was scoped to ship; no scope creep; no other navigation submodule changed; no files owned by other 109-1x plans touched (`docs/MINDRIAN-CANON.md`, `docs/CANON-PHASE-MAP.md`, `tests/test-canon-part-9-ratification.cjs`, the SUMMARY files, `.planning/REQUIREMENTS.md` all untouched); the migrations and `lib/core/room-db.cjs` were not touched.

## Issues Encountered

- The concurrent install/npm/release session has uncommitted changes to `.planning/STATE.md`, `dashboard/graph.json`, `docs/testers/REGISTRY.md`, `scripts/session-start`, `scripts/statusline-mos`. These were left untouched; commits used `git add` on only the two files this plan owns, and `--no-verify` per the parallel-execution contract.

## Registry note (for Plan 109-12)

`lib/memory/run-feynman-tests.cjs` was **NOT** modified by this plan. Inspection shows that as of `main` HEAD only `tests/test-navigation-migration-views.cjs` is registered there from the Phase-109 family; `tests/test-navigation-acceptance.cjs` (and the other Phase-109 suites: focus, memory-events, neighborhood, insights, chokepoint-hook, packet-builder, packet-part8-leak, perf-10k, migration-{idempotent,backfill,coexistence}, brain-ingestion-part-9-invariant, room-home-vs-brain-derivation-regression) are **not** in the registry. Per the Plan 109-10 objective ("If the Plan 109-00 registration was incomplete, that is reconciled by Plan 109-12, not here"), **Plan 109-12 must reconcile the Feynman test registry** to include `tests/test-navigation-acceptance.cjs` and its sibling Phase-109 suites.

## Next Phase Readiness

- Wave 4 NAV-109-09 (the test half) is complete. `node tests/test-navigation-acceptance.cjs` exits 0; the load-bearing zero-non-SQLite-reads assertion passes; no regression in the other 14 Phase-109 suites.
- Plan 109-11 (Canon Part 9 ratification: merge `.planning/research/2026-05-03-canon-part-9-memory-locality-proposal.md` into `docs/MINDRIAN-CANON.md` as Part 9 + fill `tests/test-canon-part-9-ratification.cjs`) can proceed - it does not depend on any file this plan touched.
- Plan 109-12 owns the Feynman test registry reconciliation (see Registry note above).

## Self-Check: PASSED

- FOUND: tests/test-navigation-acceptance.cjs
- FOUND: lib/core/navigation/neighborhood.cjs
- FOUND: .planning/phases/109-sql-context-memory-navigation-spine/109-10-SUMMARY.md
- FOUND commit: 3449f36 (Task 1 - test)
- FOUND commit: cbf40a9 (Task 2 - fix)
- `node tests/test-navigation-acceptance.cjs` exits 0 (1/1 passed)
- 14 other Phase-109 suites pass (no regression)

---
*Phase: 109-sql-context-memory-navigation-spine*
*Completed: 2026-05-12*

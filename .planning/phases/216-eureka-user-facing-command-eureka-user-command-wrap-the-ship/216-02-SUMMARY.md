---
phase: 216-eureka-user-command
plan: 02
subsystem: eureka
tags: [eureka, runner, dispatcher, room-mode, fire-and-return, cjs]

# Dependency graph
requires:
  - phase: 216-01
    provides: "buildRoomNativeSubstrate(db, {canonicalId}) -> {meta, techMap, convergesPairs}: the room-native analog of loadGraph()"
  - phase: 215-eureka-portfolio-fusion
    provides: "scripts/eureka-portfolio-report.cjs composed runner (loadGraph, catalogId, the four Wave-1 modules, MIN_COHORT=30 tail floor); tests/test-215-portfolio-report.cjs"
provides:
  - "scripts/eureka-portfolio-report.cjs: additive --pairs room mode composing the adapter through the SAME four modules; graph/full paths byte-identical to Phase 215"
  - "Room-mode union pair rule: the room's own cited edges (always score, even same-type/same-root) UNION the full-mode cross-boundary enumeration, unordered-deduped edge-first"
  - "Room-mode provenance + honesty: growth_proxy 'created_at-recency (room-native)', graph row '(room-native: no idea-graph)', the directive phrase on sub-MIN_COHORT degrade, a room-native-axes note"
  - "scripts/eureka-command.cjs: the fire-and-return dispatcher (run|start|status|report|help) with anti-JHU-default substrate resolution and a status.json lifecycle contract"
affects: [216-03 command surface, eureka, room-native]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive substrate branch: hoist techMap/convergesPairs, fill from loadGraph BEFORE openRoomDb (graph/full, unchanged) or the adapter AFTER (room mode)"
    - "Union pair enumeration with edge-first unordered dedupe so cited shared_problems survive"
    - "Dispatcher as a thin in-process wrapper: require the runner and await main() (no execSync), the testable-seam pattern"
    - "Fire-and-return: detached spawn + unref + a status.json running->done/failed lifecycle (D-05)"

key-files:
  created:
    - scripts/eureka-command.cjs
    - tests/test-216-eureka-command.cjs
  modified:
    - scripts/eureka-portfolio-report.cjs

key-decisions:
  - "Room mode never reads graphPath (no loadGraph call in the room branch): a nonexistent --graph plus --pairs room still exits 0 (D-01 consequence, Test 2)"
  - "growth_proxy is overridden ONLY in the provenance object; lib/core/eureka/tail-quadrant.cjs axis math is untouched (Canon Part 7)"
  - "The dispatcher resolves substrate explicit --graph > room-local .mindrian/idea-graph.json > room-native, and NEVER falls through to the runner's DEFAULT_GRAPH (the JHU fixture anti-pattern)"
  - "Dispatcher is report-only (D-03): writes only under <ROOM_DIR>/.mindrian/eureka/ + the runner's derived eureka_* tables; zero nodes/edges/memory_event writes"

requirements-completed: [216-R2]

# Metrics
duration: 22min
completed: 2026-07-10
---

# Phase 216 Plan 02: Room Mode + Fire-and-Return Dispatcher Summary

**The shipped portfolio runner gains an ADDITIVE `--pairs room` mode that composes the Plan 01 adapter through the SAME four Wave-1 modules (graph/full behave byte-identically to Phase 215), and `scripts/eureka-command.cjs` wraps it as a fire-and-return dispatcher that resolves substrate per room (explicit graph > room-local idea-graph > room-native), never defaults to the JHU fixture, and drives a status.json lifecycle so a detached scan is observable.**

## Performance
- **Duration:** ~22 min
- **Started:** 2026-07-10 (this session)
- **Completed:** 2026-07-10
- **Tasks:** 2
- **Files modified:** 3 (2 new, 1 additively edited)

## Accomplishments
- After this plan a normal room with only `room.db` produces the SAME ranked, tail-flagged, Opportunity-Statement report the JHU acceptance run proved out in Phase 215, from ONE dispatcher call with no dev flags (D-01 delivered end to end).
- **`--pairs room` (Task 1):** the runner's argv normalization admits `room`; the adapter is required at the top; the substrate load is restructured so `techMap`/`convergesPairs`/`graph` are hoisted and filled from `loadGraph` BEFORE `openRoomDb` (graph/full, unchanged, same call order and values) or from `buildRoomNativeSubstrate(db, {canonicalId: catalogId})` AFTER the open (room mode). Room mode never reads `graphPath` (Test 2: a nonexistent `--graph` still exits 0).
- **Union pair rule:** room-mode `pairsToScore` is the UNION of (a) the room's own cited edges (`convergesPairs`, both endpoints indexed, pushed FIRST so their `shared_problems` survive dedupe) and (b) the full-mode cross-boundary enumeration, deduped on the unordered `a<b?a|b:b|a` key. The room's own typed edges always score even same-type/same-domain (Test 3: the `(N1,N2)` physics-physics cited edge scores exactly once); cross-boundary enumeration guarantees non-empty pairs on edge-sparse rooms.
- **Honest room-mode reporting:** provenance `growth_proxy` overridden to `created_at-recency (room-native)` (in the provenance object only, tail-quadrant.cjs untouched); the Graph provenance row reads `(room-native: no idea-graph)`; on a sub-MIN_COHORT cohort the tail section prints the navigator's exact phrase `Not enough entries for a tail read (...) The ranked pairs and Opportunity Statements above still stand.` plus a room-native-axes note (attention = node degree, growth = created_at recency, still UNCALIBRATED).
- **The dispatcher (Task 2):** `scripts/eureka-command.cjs` with `run|start|status|report|help`, `main(argv)` exported as the testable seam. Substrate resolution is the anti-JHU-default rule (explicit `--graph` must exist, else room-local `.mindrian/idea-graph.json`, else room-native with NO `--graph`) so `DEFAULT_GRAPH` is never reachable. `run` writes `status.json` `running`->`done`/`failed`; `start` (D-05) spawns the scan detached (`{detached:true, stdio:'ignore'}` + `unref()`), prints the report + status paths, and exits 0 immediately; `status` prints one JSON line (or `{"state":"none"}`); `report` streams the report JSON (or a 3-line What/Why/Fix error). Report-only (Part 9, D-03), zero egress (Part 8).
- **Zero shipped-module changes:** `git diff` touches only `scripts/eureka-portfolio-report.cjs` (additive) plus the two new files. `eureka-room-report.cjs`, `ahp-weights.cjs`, `portfolio-dimensions.cjs`, `tail-quadrant.cjs`, and `opportunity-statement.cjs` are unchanged (Canon Part 7: composed, not modified).

## Task Commits
Each task committed atomically (TDD RED -> GREEN, then the dispatcher):

1. **Task 1 (RED): failing e2e for `--pairs room` (behaviors 1-6)** - `5202e713` (test)
2. **Task 1 (GREEN): additive `--pairs room` mode composing the adapter** - `741c2446` (feat)
3. **Task 2: `eureka-command.cjs` fire-and-return dispatcher + behaviors 7-12** - `8a318b1d` (feat)

## Files Created/Modified
- `scripts/eureka-portfolio-report.cjs` (modified, additive) - the `room` argv value, the adapter require, the hoisted substrate load with a room branch, the room-mode union enumeration, the provenance `growth_proxy` + `graphRel` overrides, and the two `renderReport` honesty additions (both gated on `pairs_mode === 'room'`). Exports, scoring, tail thresholds, JSON shape keys, and DEFAULT_GRAPH all unchanged.
- `scripts/eureka-command.cjs` (new, 302 lines) - the dispatcher. Node built-ins only (`fs`, `path`, `child_process.spawn`), zero network, no INSERT into nodes/edges/memory_event, no reference to the JHU fixture.
- `tests/test-216-eureka-command.cjs` (new, 383 lines) - hermetic offline e2e, 44 assertions across behaviors 1-12: room-mode runner legs (1-5), the 215 no-regression shell (6), and the dispatcher legs (7-12, including the D-05 detached-child poll and the substrate-resolution matrix).

## Decisions Made
- **Room mode is truly graph-file-free:** the room branch is guarded so `loadGraph(graphPath)` is never called and `graphPath` (which still computes a path string) is never read from disk. This is the D-01 consequence the navigator named: the `loadGraph` hard-throw is resolved BY the adapter, not a separate guard.
- **Override the label, not the math:** `growth_proxy` is relabeled for room mode only in the provenance object. The tail axis (attention = degree percentile, growth = created_at-epoch recency percentile) flows through the SHIPPED `classifyTail` with zero changes to `tail-quadrant.cjs` (threshold changes are UNCALIBRATED 202-APO territory).
- **In-process, not execSync:** the dispatcher `require`s the runner and `await`s its exported `main()` (the runner's own testable-seam pattern), rather than shelling it like `whitespace-command.cjs` does for its Python pipelines. This keeps exit-code propagation exact and the test able to call `main()` directly.
- **Anti-JHU-default is enforced at resolution, not by a guard downstream:** the dispatcher only ever passes `--graph` when it holds a real, existing path (explicit or room-local); for a plain room it passes `--pairs room` with no `--graph`, so the runner's `DEFAULT_GRAPH` is structurally unreachable from the command path. Test 10 + the `jhtv` grep gate pin it.

## Deviations from Plan
None - plan executed exactly as written. The additive-only edits to the runner left graph/full semantically identical (proven by `test-215-portfolio-report.cjs` green without any edit to that test), and the adapter's existing defensive guards meant no hardening of `room-native-substrate.cjs` was needed (its `git diff` is empty, satisfying the Task 1 acceptance criterion that only that file "may show if hardening was needed").

## Issues Encountered
None.

## Known Stubs
None. Room mode fills the same JSON keys as graph/full; `primary_tier: undefined` is the intended room-native contract value (a normal room has no tier taxonomy), not a stub.

## Threat Flags
None. No new network surface, auth path, or schema change at a trust boundary. The dispatcher confines all writes to `<ROOM_DIR>/.mindrian/eureka/` (the T-216-06 tampering disposition), makes zero network calls (T-216-04), never passes the JHU fixture (T-216-05), and surfaces detached-child failure through `status.json` (T-216-07) - all mitigations in the plan's threat register are implemented.

## User Setup Required
None - local-only, zero egress (Canon Part 8). `--offline` proves the whole path with the deterministic stub encoder.

## Next Phase Readiness
- 216-R2 satisfied: `--pairs room` composes the adapter through the SAME modules; graph/full unchanged; the dispatcher exposes `run/start/status/report` with room-correct output paths and fire-and-return.
- Interface for Plan 03: `commands/eureka.md` resolves the active room (via `scripts/resolve-room`, SEED-034 one-door) and shells `node scripts/eureka-command.cjs <ROOM_DIR> start|report ...`; the report JSON at `<ROOM_DIR>/.mindrian/eureka/portfolio-report.json` is the machine-readable input for the 4-zone render + F.8 Decision Gate.
- No blockers.

## Verification
- `node tests/test-216-eureka-command.cjs` -> **44 assertions passed** (behaviors 1-12).
- `node tests/test-216-room-substrate.cjs` -> **33 assertions passed** (Plan 01 unregressed).
- `bash tests/run-all-215.sh` -> **Phase 215 PASS=8 FAIL=0**, Phase 211 no-regression **PASS=10 FAIL=0** (the runner edit did not regress the 215/JHU path; graph/full byte-identical).
- Task 1 acceptance greps: `pairs !== 'room'` = 2 (>=1), `room-native-substrate` = 2 (>=1), `Not enough entries for a tail read` = 1 (>=1); zero-change `git diff --stat` on the four modules + `eureka-room-report.cjs`.
- Task 2 acceptance greps: egress grep = 0, `jhtv-idea-graph` = 0, `INSERT INTO (nodes|edges|memory_event)` = 0; `node scripts/eureka-command.cjs --help` exits 0 and names all five subcommands.

## Self-Check: PASSED
- Files verified on disk: `scripts/eureka-command.cjs`, `scripts/eureka-portfolio-report.cjs`, `tests/test-216-eureka-command.cjs`, `216-02-SUMMARY.md`
- Commits verified in git log: `5202e713` (test RED), `741c2446` (feat room mode), `8a318b1d` (feat dispatcher)

---
*Phase: 216-eureka-user-command*
*Completed: 2026-07-10*

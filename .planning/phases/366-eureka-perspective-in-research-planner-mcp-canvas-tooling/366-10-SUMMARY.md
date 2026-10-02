---
phase: 366-eureka-perspective-in-research-planner-mcp-canvas-tooling
plan: 10
subsystem: canon-coverage
tags: [canon, doctor, backfill, integrity-organ, sens-19, counts-only, part8, part9]
requires:
  - 366-05 (navigation.linkThingToFramework, mintFrameworkNode, FRAMEWORK_NODE_ID, resolverCtxFor)
  - 366-08 (eureka-recall buildSubstrate: the one thing set and canon_handle)
provides:
  - things_with_canon_handle / things_without_canon_handle in graph-integrity-counts.cjs, doctor room-graph-integrity totals and detail
  - lib/core/doctor/canon-backfill-module.cjs (check, fix), registered in data/doctor-modules.json
affects:
  - 366-11 and later (rooms now carry USES_FRAMEWORK edges after one doctor --fix)
  - Phase 367 (also extends graph-integrity-counts.cjs; this plan's block is disjoint)
tech-stack:
  added: []
  patterns:
    - counts-only statement with null (never 0) when the schema cannot answer
    - doctor module that returns warn only when its fix has work, so a second --fix is a no-op
    - one transaction per thing, framework node before USES_FRAMEWORK edge
key-files:
  created:
    - lib/core/doctor/canon-backfill-module.cjs
    - tests/test-366-canon-coverage-count.cjs
    - tests/test-366-canon-backfill.cjs
  modified:
    - lib/core/navigation/graph-integrity-counts.cjs
    - lib/core/doctor/room-graph-integrity-module.cjs
    - lib/core/sensors/sensor-priority.cjs
    - data/doctor-modules.json
    - tests/test-353-doctor-section-ruling.cjs
decisions:
  - "A thing for the coverage count is the recall substrate's own set: every node type NOT in NON_THING_TYPES or ENTITY_TYPES, written out as one fixed SQL literal (the recall uses exclusion sets, not the expected ('Artifact','claim') literal; the recall wins per research A7)"
  - "canon-backfill reuses eureka-recall.buildSubstrate for the thing set and canon_handle instead of a second resolver loop; a thing needs backfill when it has a handle but no USES_FRAMEWORK edge to an existing framework node"
  - "check returns warn only when fix has work (the engine runs a fixer on warn or error); unmapped targets alone read ok, so the second run is clean"
  - "fix re-scans each room on its own write handle rather than trusting a stale check"
metrics:
  duration: ~45min
  completed: 2026-10-02
  tasks: 2
  files: 8
---

# Phase 366 Plan 10: Canon coverage count and doctor backfill Summary

Canon coverage is now a counts-only statement in the integrity organ (things with and without a canon handle, null on an unreadable schema), named by SENS-19's watched_by without touching its firing sum, and a new `canon-backfill` doctor module lets `/mos:doctor --fix` mint framework nodes then USES_FRAMEWORK edges across every registered room, idempotently.

## What was built

- **Coverage statement** (`graph-integrity-counts.cjs`): `SQL_THINGS_WITH_CANON_HANDLE` and `SQL_THINGS_WITHOUT_CANON_HANDLE` (plus one shared exclusion literal and a `countOrNull` helper) and two keys on the returned bag. A handle is a USES_FRAMEWORK edge to an existing node typed `framework`; an edge to a missing node row is not a handle. Computed only when the schema variant is not `unreadable`; a throw gives `null`, never `0`. The block is disjoint for Phase 367 (two constants, one helper, two keys; no other line of the statement bag changed).
- **Doctor organ** (`room-graph-integrity-module.cjs`): both names added to `INTEGER_FIELDS` (so they ride the totals with the existing null-excluded-from-sum rule) and one counts-only clause in `buildDetail`: "N thing(s) with a canon handle, M without".
- **SENS-19** (`sensor-priority.cjs`): `watched_by` now also names "the canon coverage count (things with and without a canon handle)". `optimizes` and the firing sum in `sensor-graph-integrity.cjs` are untouched; the sensor never reads the coverage keys (leg V5).
- **`canon-backfill-module.cjs`**: `check(ctx)` walks every registered room (the cascade flag does not narrow it) with a per-room try/catch, opens read-only, and reports `{room, resolvable_without_edge, edge_targets_without_node, unmapped_targets}`. `fix(ctx)` reads `ctx.check_result.rooms`, honors `dryRun`, re-scans on the write handle, then per thing runs BEGIN, `linkThingToFramework`, COMMIT (ROLLBACK on failure); then mints nodes for USES_FRAMEWORK edge targets that lack a node when the slug maps to exactly one canon name (else counted as unmapped and left alone). Returns per-room `{minted_nodes, written_edges, unmapped_targets}`. No raw node or edge SQL in the module (grep count 0).
- **Registry**: `canon-backfill` row after graph-derive-health: `cadence: always`, `flag: null`, `fix_supported: true`, `introduced_version` 2.0.0-beta.56 (from `lib/core/repo-version.cjs`). `scripts/doctor.cjs` needed no change: its always-pass already runs `fix` for any `fix_supported` module whose check is warn or error, which is why the check returns warn exactly when the fix has work. Confirmed end to end (scratch HOME and rooms home): first `doctor --fix --json` minted 1 node and 1 edge, second run reported ok and no recovery.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 RED | 1734347b9 | test(366-10): add failing canon coverage count legs V1-V5 |
| 1 GREEN | 04ff28849 | feat(366-10): canon coverage count in the integrity organ, named by SENS-19 watched_by |
| 2 RED | a03e2b057 | test(366-10): add failing canon backfill legs B1-B7 |
| 2 GREEN | 3d4c1fd83 | feat(366-10): canon-backfill doctor module, --fix mints framework nodes then edges per registered room |

## Verification

- `node tests/test-366-canon-coverage-count.cjs`: PASS 17 FAIL 0 (V1-V5)
- `node tests/test-366-canon-backfill.cjs`: PASS 25 FAIL 0 (B1-B7, zero network attempts)
- `node tests/test-doctor-module-contract-parity.cjs`: ALL PASS (27 registry modules pass the 9-rule contract)
- `node scripts/build-connector-registry.cjs --check`: OK (the regeneration changed no committed file)
- `LC_ALL=C bash tests/run-all-366.sh`: PASSED=49 FAILED=0 SKIPPED=19 KNOWN=1
- `bash tests/run-all-343.sh`: PASS=9 FAIL=2. Both reds are `git status --porcelain is empty` assertions tripped by peer-owned uncommitted files (lib/mcp/tools/graph.cjs, scripts/check-tool-honesty.cjs): `test-343-counter-metric-declaration.cjs` and `test-298-contract-parity.cjs`. Every other 343 leg passes, including the room-graph integrity module, SENS-19 registration and fence, sensor priority completeness and the em-dash guard. Logged in deferred-items.md; re-run on a clean tree.
- Acceptance greps: coverage keys in graph-integrity-counts.cjs at least 4, `things_without_canon_handle` in the doctor module at least 1, `"canon-backfill"` once in data/doctor-modules.json with `fix_supported: true`, raw-SQL grep on the new module 0.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] tests/test-353-doctor-section-ruling.cjs pinned the module count at 26**
- **Found during:** Task 2 (registry row added)
- **Issue:** `check('registry has 26 modules total', ... === 26)` fails the moment any module is registered. The file is not in the plan's files_modified list.
- **Fix:** Updated the pin to 27 (one line). The test now passes (PASS=24 FAIL=0).
- **Commit:** 3d4c1fd83

**2. [Plan note] The recall's thing set is an exclusion set, not the expected ('Artifact','claim') literal**
- The plan said the recall's set wins and the SUMMARY records it. `eureka-recall.cjs` defines things as every node type outside `NON_THING_TYPES` plus `ENTITY_TYPES` (plus scaffold, empty-text, system-source and structural-section filters that SQL cannot express). The coverage statement therefore uses `type NOT IN (<that union>)` as a fixed literal. It can read slightly higher than the substrate's own `things.length` because scaffold-named and text-less nodes stay in the SQL count. The backfill uses the substrate directly, so it acts on exactly the recall's things.

**3. [Design call] canon-backfill reuses `buildSubstrate` rather than looping with `resolveEndpoint` itself**
- Reuse before build: the substrate already runs the one resolver (`resolverCtxFor` plus `resolveEndpoint`) over the recall's thing set and computes `canon_handle`. A thing with a handle and no USES_FRAMEWORK edge to an existing framework node is exactly the backfill set. A legacy-schema room (no `source_path` column) makes `buildSubstrate` throw; that room soft-fails as `unreadable` and the sweep continues.

## Concerns for the orchestrator

- The orchestrator's later constraint (do not run suites that include `tests/test-section-nodes-birth-and-migration.cjs`, and run suites only with HOME and MINDRIAN_ROOMS_HOME in temp dirs) arrived after I had run `tests/run-all-343.sh` and `tests/run-all-366.sh` with the real HOME. Neither aggregator references that test file (grep confirmed). `~/MindrianRooms/.rooms/registry.json` has an mtime of 04:26:58, inside my verification window, but its contents hold 55 real rooms and no fixture or temp-path entries, and a peer session was active, so I cannot attribute the write to my runs. I did not touch the file. Every test I wrote isolates HOME, USERPROFILE and MINDRIAN_ROOMS_HOME to temp dirs before any repo require.

## Known Stubs

None.

## Threat Flags

None. The new module's only trust boundaries are the ones in the plan's register: registry paths (T-366-38, abs_path before path inside a per-room try/catch, leg B6), batch writes (T-366-39, one transaction per thing, node before edge, dryRun writes nothing, leg B5), SENS-19 (T-366-40, coverage never enters the firing sum, leg V5), per-room counts returned and printed (T-366-41) and no network (T-366-42).

## TDD Gate Compliance

Both tasks followed RED then GREEN: 1734347b9 then 04ff28849, a03e2b057 then 3d4c1fd83.

## Self-Check: PASSED

- FOUND: lib/core/doctor/canon-backfill-module.cjs, tests/test-366-canon-coverage-count.cjs, tests/test-366-canon-backfill.cjs
- FOUND commits: 1734347b9, 04ff28849, a03e2b057, 3d4c1fd83

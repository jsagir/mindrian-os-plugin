---
phase: 372
plan: "01"
subsystem: navigation / context_assemble
tags: [context-assemble, omitted, leg-failed, golden-snapshot, additive-meta, canon-part-8]
requires: []
provides:
  - "_meta.omitted on every getRoomContext result (always an array, always the last _meta key)"
  - "OMITTED_REASONS export (shared enum, D8)"
  - "golden snapshot, fixture helper and tie probe for plan 372-02"
affects: [lib/core/navigation/room-context.cjs]
key-files:
  created:
    - tests/helpers/fixture-room-372.cjs
    - tests/fixtures/372/golden-pre-change.json
    - .planning/phases/372-context-assemble-reports-what-it-omitted-meta-omitted-seed-1/372-TRYCATCH-AUDIT.md
  modified:
    - lib/core/navigation/room-context.cjs
key-decisions:
  - "D1 branch A: the tie probe is stable, top_k_cap ships"
  - "Estimate mode still runs all legs; estimate_only entries follow the leg entries"
requirements-completed: [OMIT372-01, OMIT372-02, OMIT372-03, OMIT372-04, OMIT372-05, OMIT372-06, OMIT372-07]
completed: 2026-10-19
---

# Phase 372 Plan 01: context_assemble reports what it omitted - Summary

getRoomContext now returns `_meta.omitted[]` (entries `{ leg, reason, count, detail }`) and reports a thrown leg as `leg_failed`, with every pre-existing field byte-identical to a golden captured before the code change.

## D1 branch: A

The tie probe ran on the unmodified source before any lib/ change. PROVEN results (Node v22.23.1, SQLite 3.51.3):

- maxDepth 2: 16 raw rows, tied boundaries at k = 9 to 15, unstable k list empty.
- maxDepth 1: 14 raw rows, tied boundaries at k = 7 to 13, unstable k list empty.
- The probe is non-vacuous (tied boundaries exist; topK 10 splits the tie group, ranks 9 to 16).
- Verdict: stable. BRANCH A. `top_k_cap` ships (topK + 1 probe row, one query, no tiebreak).
- After the change the golden compare still passes, including the topK sweep 1 to 18, so the probe row did not move any kept row.

SPEC lines to amend: NONE. Branch A keeps the SPEC as written (6-reason set including `top_k_cap`). In branch B the main session would have amended the header note, requirement 1 reason list, requirement 5 and the acceptance list. Not needed.

## Commit order

1. 907b0d504 `test(372-01)`: golden + helper. Captured with source blobs equal to the HEAD blobs: room-context.cjs 438e7febd47b9562cf7fb0838c949ca34b07e906, neighborhood.cjs 3af597e22c01d8d26403e913d8310f3c018bd0d2, mcp/tools/context.cjs 8f1b79594f10d84f88b82b0759d72d1a7668aab5. No lib/ change.
2. b156b8e4c `docs(372-01)`: try/catch audit.
3. 24745054f `feat(372-01)`: the room-context.cjs change.

The golden commit precedes the code commit in `git log` (D9).

## Golden proof

- 10 calls (default, caps_small, wide, depth1, estimate, seed_lane, no_seed, chain_focus, explicit_focus, room141_default) plus a topK sweep of 18 calls.
- `node tests/helpers/fixture-room-372.cjs --compare-golden` printed `GOLDEN COMPARE OK (10 calls)` in a second process before the change and after the change.
- Compared per call: projected pre-existing fields, `db.prepare` count, top-level key order, `_meta` key order (pre-existing keys, then exactly `omitted` last).
- prepare_count is equal for every call (default 16, seed_lane 14, no_seed 10, chain_focus 15, room141_default 16). The topK + 1 probe adds no statement.
- `--write-golden` refuses to overwrite and refuses if a guarded source differs from its HEAD blob (both seen).

## Audit result

- 10 catch sites in room-context.cjs, census equals the planning-time count. After the change the count is still 10.
- REPORT sites (7): legA, legB, filterRankedExclusions, legC, legD, Leg E inner, Leg E outer. All report `leg_failed` with the error class name only.
- SILENT sites (3): legD row parse fallback, resolveReferenceMs clock fallback, legBytes measurement helper.
- Full table and vocabulary: 372-TRYCATCH-AUDIT.md.

## Hand check (default golden call)

PROVEN output of `_meta.omitted`: legB window_cap 3 `fragment_window`; legB char_cap 1 `fragment_char_cap`; legC top_k_cap null `top_k`; legC type_excluded 3 `chain_state`. Estimate call adds four estimate_only entries (legA to legD) after those. A forced getNeighborhood TypeError gives legC leg_failed `TypeError` and an empty relevantNodes; the error message text did not appear. No fixture marker text appears in any detail.

## Verification

- `node tests/helpers/fixture-room-372.cjs --compare-golden`: OK.
- test-get-room-context, test-room-context-latency (16.6 ms vs 1200 ms), test-room-context-part8-invariant, test-347-context-focus, test-347-ranked-set-exclusion, test-353-turn-budget, test-legd-recency-golden: all pass unchanged.
- `node scripts/build-connector-registry.cjs --check`: OK.
- No em-dash or en-dash in any file written.

## Deviations from Plan

None in scope. One environment note, not a plan deviation: the repo `node_modules` has no `ajv`, so any test that loads `lib/core/navigation.cjs` or `lib/mcp/tools/context.cjs` fails with `Cannot find module 'ajv/dist/2020'` before the test runs. I did not install a package. I ran those tests with `NODE_PATH=/home/jsagi/Theo/node_modules` (ajv 8.20.0) as a read-only fallback. The failure is independent of this change (it is raised in brain-client.cjs, a file this plan does not touch).

## Known limits (recorded, not changed)

- room-home.cjs helpers (getCurrentThesis, safeShape, parse fallbacks) swallow their own errors, so legA reports `leg_failed` only when getRoomHomeView itself throws.
- lib/mcp/tools/context.cjs readinessFacts and the brief head swallow errors at the tool layer; they are not one of the four legs.
- top_k_cap false alarm edge: the probe row can be of an excluded type (chain_state), so top_k_cap can fire when only an excluded row lies beyond topK. Safe direction, accepted.
- Leg E inner and outer catch share one entry (one entry for each leg and reason).
- A room with no sessions table reports legB `leg_failed` (honest, accepted).
- legBytes (cost helper) swallow stays silent.
- The golden pins Node v22.23.1 and SQLite 3.51.3 ordering behavior for tied scores. The probe helper (`probeTieStability`) can be re-run on another runtime.

## Known Stubs

None.

## Threat Flags

None. No new require, no new SQL statement, no network call (part8 invariant test passes unchanged).

## Owed to the main session

- ROADMAP: add the plan list for phase 372 (372-01 done, 372-02 next). This plan did not edit ROADMAP.md, REQUIREMENTS.md, STATE.md or 372-SPEC.md (a peer session holds edits in some of them).
- Plan 372-02 inputs ready: `tests/helpers/fixture-room-372.cjs` exports the fixture, the call matrix, the probe and the constants.
- STATE.md and requirement checkbox updates were not run for the same reason.

## Self-Check: PASSED

- Files exist: tests/helpers/fixture-room-372.cjs, tests/fixtures/372/golden-pre-change.json, 372-TRYCATCH-AUDIT.md, lib/core/navigation/room-context.cjs.
- Commits 907b0d504, b156b8e4c, 24745054f exist on main.

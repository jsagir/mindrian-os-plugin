---
phase: 314-seed-055-broaden-sens-13-to-portfolio-movement-mos-eureka-portfolio-command
plan: 02
subsystem: eureka
tags: [eureka, portfolio, bounded-run, premise-correction, decision-resolved, composition]

requires:
  - phase: 314-01
    provides: validateSnapshot, scopeId, SLUG_RE, HANDLE_RE, BANDS, MAX_LABELS (closed snapshot schema)
  - phase: 215
    provides: ahp-weights, portfolio-dimensions, tail-quadrant (surviving scoring modules)
  - phase: 366
    provides: room-native-substrate, tri-modal index, candidate-exclusion, RS differential scorer
provides:
  - "lib/core/eureka/portfolio-run.cjs: runPortfolio(opts), the one bounded run that Door 1 (command) and Door 2 (movement store) call"
affects: [314-04, 314-07]

tech-stack:
  added: []
  patterns:
    - "pairs come from the room's typed edges only; no all-pairs enumeration exists in the file"
    - "hard gate: score only when this run freshly embedded (idx.embedded === true)"
    - "three result shapes: ok { snapshot, display }, degraded (qualitative only, no number), error { reason }"
    - "display.labelOf is an in-process closure, never stored"

key-files:
  created:
    - lib/core/eureka/portfolio-run.cjs
    - tests/test-314-run.cjs
  modified:
    - scripts/check-substrate.cjs

key-decisions:
  - "Engine path: option-a, bounded run library (navigator, 2026-10-28). See the next section."
  - "A node id that does not fit the closed handle pattern becomes 'h_' + 24 hex of its sha256, so the snapshot always passes its own schema and the handle is stable across runs."
  - "forceUnavailable withholds the injected encodeFn, because embedTexts lets an injected encoder bypass the unavailable hook."
  - "Any AHP load failure (inconsistent matrix, wrong shape, unreadable file) returns reason ahp_inconsistent, because the reason list in the plan is closed."

requirements-completed: [PM314-10, PM314-02, PM314-01]

duration: ~40min (ASSUMED, start time not recorded)
completed: 2026-10-28
---

# Phase 314 Plan 02: Bounded Portfolio Run Summary

**runPortfolio composes the surviving 215 and 366 modules over a room's own typed edges: no all-pairs loop, no runner file, honest qualitative degrade, closed-schema snapshot out.**

## Resolved engine-path decision

PROVEN (recorded from the plan and the orchestrator brief; the navigator chose it on a decision card).

- Date: 2026-10-28
- Question: "Phase 314: the old all-pairs portfolio runner was deleted in Phase 366 by your 'runner: retire' ruling. How should /mos:eureka-portfolio score?"
- Answer, verbatim: "Bounded run library (Recommended)"
- Meaning: option-a. Build a bounded library over the surviving modules. Do not restore scripts/eureka-portfolio-report.cjs or scripts/eureka-command.cjs. Do not add an all-pairs loop. Do not edit /mos:eureka.
- Boundary line kept: measured fitness numbers belong to the portfolio command only. /mos:eureka keeps its rule never to render a score. Nothing in this plan feeds a number into that path.

Task 1 wrote no file (record only). The retired-runner gate was green before and after: `node tests/test-366-runner-retired.cjs` gives 5 passed, 0 failed (PROVEN).

## Accomplishments

- `lib/core/eureka/portfolio-run.cjs` (581 lines) exports `runPortfolio(opts)` and a `_test` seam.
- opts: `roomDir` (absolute), `section` (slug), `topN` (1 to 100, default 25), `maxPairs` (default 20000), test seams `encodeFn`, `forceUnavailable`, `ahpConfigPath`, `now`.
- ok result: `{ status, snapshot, display }`. `snapshot` passes `validateSnapshot`. `display` holds `rows` (rank, a, b, a_label, b_label, score, band, dims, weak_a, weak_b, complementary, tail_flag), `tail`, `counts` and `labelOf`.
- degraded result: `{ status, degrade: 'qualitative-only', reason, qualitative: { counts, most_connected, tail } }`. Reasons: encoder_unavailable, no_pairs, too_few_things. It has no score, band or fitness key.
- error result: `{ status, reason }`. Reasons: no_room, room_unreadable, ahp_inconsistent, bad_section.
- A named section limits the cohort and the pairs to that section. The snapshot carries `scope: 'subset'` and the opaque `scopeId(slug)`; the readable name never enters the snapshot.
- Ported unchanged from the retired runner (read from git history only): the Phase 218 entity versus scaffold cohort split, the three pair exclusions (container, low-trust with the verified-entity guard, both-scaffold), the tail axes, the Part 8 figure-guard skip.

## Task Commits

| Task | Commit | Type |
|------|--------|------|
| 1 | none (record only) | decision recorded above |
| 2 RED | d98b84d09 | test(314-02): failing test, Cannot find module |
| 2 GREEN | 2602e32c5 | feat(314-02): portfolio-run.cjs, R13 leg, check-substrate allow-list |

## Verification (all PROVEN; temp HOME, USERPROFILE, MINDRIAN_ROOMS_HOME; UV_OFFLINE=1; offline preload)

- `NODE_OPTIONS="--require ./tests/eureka-offline-preload.cjs" node tests/test-314-run.cjs`: 13 passed, 0 failed. RED run failed first with "Cannot find module".
- Legs: R1 ok run and schema, R2 no_pairs and no all-pairs fallback, R3 pairs are a subset of typed-edge pairs, R4 section subset and opaque scope id, R5 encoder unavailable with no score/band/fitness key, R6 bad AHP matrix, R7 two runs identical (noise floor zero), R8 maxPairs cap deterministic, R9 structural things excluded and counted (3 hubs, 4 with the seeded scaffold thing), R10 nodes, edges and memory events unchanged, R11 no network or Brain client or dash, R12 labelOf, R13 odd node id handles.
- `node tests/test-366-runner-retired.cjs`: 5 passed, 0 failed.
- `node tests/test-314-snapshot.cjs`, `test-314-movement.cjs`, `test-314-part8-envelope.cjs`: 10, 11, 6 passed, 0 failed.
- Dash scan (em-dash and en-dash) on the module and the test: 0 hits. Non-comment lines with the letters "http": 0. `ls scripts/eureka-portfolio-report.cjs scripts/eureka-command.cjs`: both missing.
- `node scripts/build-connector-registry.cjs --check`: OK. `node scripts/check-render-coverage.cjs`: 0 gaps.

## Deviations from Plan

**1. [Rule 3 - Blocking] The pre-commit chokepoint check refused the new module**
- **Found during:** Task 2 GREEN commit (first attempt was blocked; nothing was committed).
- **Issue:** `scripts/check-substrate.cjs` refuses a new `require('../room-db.cjs')` in a non-allow-listed file.
- **Fix:** Added one allow-list entry with a comment for `lib/core/eureka/portfolio-run.cjs`, following the precedent for `scripts/rs-vector-bridge.cjs`. The module opens a caller-owned handle and writes no node, edge or memory event.
- **Files modified:** scripts/check-substrate.cjs. **Commit:** 2602e32c5.

**2. [Rule 2 - Missing critical functionality] Handle normalisation**
- **Issue:** A real room node id can hold characters outside the closed handle pattern (a slash, a space). The snapshot would fail `validateSnapshot` and the run would return an error for a valid room.
- **Fix:** `handleFor(id)` keeps a conforming id and otherwise returns `'h_'` plus 24 hex characters of its sha256. Covered by R13. Commit 2602e32c5.

**3. [Rule 1 - Bug, in my own seam use] forceUnavailable did not degrade**
- **Issue:** `embedTexts` lets an injected `encodeFn` bypass the unavailable hook, so R5 saw status ok.
- **Fix:** The run withholds `encodeFn` from `indexNodes` when `forceUnavailable` is true. Commit 2602e32c5.

**4. Fixture built in the test, not from the shared helpers**
- Neither `fixture-room-219.cjs` (8 entity things, hubs are structural) nor `fixture-366.cjs` (about 25 nodes, Sections are containers, Artifact pairs are scaffold) gives 30 or more non-structural things with typed edges. The test builds 36 entity things in 3 sections through `navigation.writeEntityNode` and `navigation.writeEdge` only, plus one `insertNode` call for the scaffold-basename case. No raw SQL insert.

## Known Stubs

None.

## Threat Flags

None. T-314-06 to T-314-10 are mitigated as planned: zero network (R11 and the offline preload), figure-guard skip counted in provenance, derived tables only (R10), typed-edge pairs plus maxPairs cap (R2, R3, R8), slug allow-list (R4).

## Notes for plans 314-04 and 314-07

- `display.labelOf(handle)` maps a stored handle (not the raw node id) to a label. Rows use handles in `a` and `b`. For a normal room these equal the node ids.
- `snapshot.labels` holds up to 200 labels (display rows first, then tail items). Handles outside that set have no stored label; the command prints the fixed fallback words.
- `provenance` keys include `ahp_weight_strategic_fit`, `ahp_weight_validated_demand`, `ahp_weight_tech_econ_feasibility`, `ahp_cr`, `section_scoped` (boolean, never the slug).
- `maxPairs` cuts the pair list by sorted pair key before scoring (deterministic, not quality-ranked). `provenance.pairs_capped` says when it happened.
- Any throw from `scoreMeasured` counts as `figure_guard_skipped`, as the retired runner did.
- UNVERIFIED: a run on a real room with the live encoder. Plan 314-07 owns the real-room calibration and was not run here.

## Self-Check: PASSED

- Files exist: lib/core/eureka/portfolio-run.cjs, tests/test-314-run.cjs, scripts/check-substrate.cjs entry (PROVEN by the test run and by the commit hook passing).
- Commits d98b84d09 and 2602e32c5 are in `git log` of branch feat/eureka-adapter-rebased.
- STATE.md, ROADMAP.md, REQUIREMENTS.md, CHANGELOG.md and docs/CANON-PHASE-MAP.md were not touched.

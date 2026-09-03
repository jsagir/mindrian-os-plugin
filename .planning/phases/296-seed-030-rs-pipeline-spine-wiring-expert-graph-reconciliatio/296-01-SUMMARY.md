---
phase: 296-seed-030-rs-pipeline-spine-wiring-expert-graph-reconciliatio
plan: 01
subsystem: testing
tags: [rs-engine, pinecone-retirement, vector-store, sqlite-vec, node-test, bash-harness, canon-part-8]

# Dependency graph
requires: []
provides:
  - "tests/run-all-296.sh - glob-discovery aggregator (tests/296-*.test.cjs + tests/296-*.sh) with found-eq-0 guard, Part 8 sweep, no-em-dash fence"
  - "tests/fixtures/296/room-fixture.cjs - makeRoom/seedVectors/cleanup helpers over openRoomDb + vector-store.cjs, both-backends-capable"
  - "tests/296-no-pinecone-internal.test.cjs - F-3/F-9 regression fence, green today"
  - "tests/296-dim-invariant.sh - RSLOCAL-04 source gate, SKIP-tolerant until plan 296-04 lands the repoint"
affects: [296-02, 296-03, 296-04, 296-05, 296-06, 296-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Glob-discovery test aggregator (tests/296-*.test.cjs suffix-scoped node arm, tests/296-*.sh bash arm) mirroring tests/run-all-272.sh"
    - "Caller-owned db handle fixture (openRoomDb + ensureStore/insertVector), returns resolved backend so callers assert rather than assume"
    - "Exempt-by-name Part 8 sweep entries for documented, in-progress retirement targets (mirrors 272's pinecone-inference.cjs precedent)"
    - "SKIP-tolerant source gate (leading 'SKIP:' line -> run_may_skip SKIPPED, not PASS/FAIL) for an invariant that only becomes assertable after a later plan lands"

key-files:
  created:
    - tests/run-all-296.sh
    - tests/fixtures/296/room-fixture.cjs
    - tests/296-no-pinecone-internal.test.cjs
    - tests/296-dim-invariant.sh
  modified: []

key-decisions:
  - "lib/core/rs_cache.py exempted BY NAME from the Part 8 forbidden-token grep in tests/run-all-296.sh (it is the documented RSLOCAL-04 retirement target itself and still legitimately imports the pinecone SDK until plan 296-04 lands); the real enforcement gate for that fact is tests/296-dim-invariant.sh, which SKIPs for the identical reason today"
  - "tests/296-no-pinecone-internal.test.cjs Test 4 exempts the single require('./rs-pinecone-bridge.cjs') line in lib/core/rs-engine.cjs from its zero-pinecone count by name, since that import pulls only the generic cosineSimilarity math re-export, not a Pinecone SDK call site"
  - "bash tests/run-all-296.sh requires TEST_296_ALLOW_MISSING=1 to exit 0 today, because scripts/rs-vector-bridge.cjs (a 296-03 deliverable) does not exist yet and the no-em-dash fence's missing-target rule is deliberately stricter than the Part 8 sweep's -- this mirrors tests/run-all-272.sh's identical multi-wave rollout behavior"

requirements-completed: [RSFENCE-01, RSLOCAL-04]

# Metrics
duration: 45min
completed: 2026-09-03
---

# Phase 296 Plan 01: Test Spine (Aggregator, Room Fixture, Already-True Fences) Summary

**Glob-discovery test aggregator plus a both-backends room fixture, locking F-3 (RS internal/cross-room already Pinecone-free) and F-9 (connector-spine wiring already done) as executable regression fences instead of prose.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-09-03T17:53:19Z
- **Tasks:** 3/3 completed
- **Files modified:** 4 created, 0 modified

## Accomplishments
- `tests/run-all-296.sh`: glob-discovery aggregator (node arm suffix-scoped to `*.test.cjs` so `tests/fixtures/296/`'s helper module is never executed as a test), found-eq-0 hard-fail guard proven by `TEST_296_PREFIX`, a header naming all seven Phase 296 requirements and their owning plan, a Part 8 source sweep, and a no-em-dash fence.
- `tests/fixtures/296/room-fixture.cjs`: `makeRoom`/`seedVectors`/`cleanup` composing `openRoomDb(dir, {allowExtension:true})` and `vector-store.cjs`'s `ensureStore`/`insertVector`, returning the resolved backend (`sqlite-vec` or `cjs-fallback`) so a both-backends test in plan 296-03 can assert which leg it actually exercised (296-RESEARCH.md Pitfall 1).
- `tests/296-no-pinecone-internal.test.cjs`: five `node:test` cases lock F-3 (internal/cross-room modes already reach zero Pinecone surface, `_embed_via_pinecone_inference` is still a `NotImplementedError` stub) and F-9 (all four `rs-*` surfaces registered in `data/connector-registry.json`). Green today, before any production file in this phase is touched.
- `tests/296-dim-invariant.sh`: SKIP-tolerant RSLOCAL-04 gate. Probes whether `lib/core/rs_cache.py` still imports the pinecone SDK; SKIPs honestly today (the repoint lands in plan 296-04), then will assert the 384-dim/1024-dim non-mixing invariant once it does.
- `bash tests/run-all-272.sh` baseline recorded (adjacent-subsystem regression fence, per `296-VALIDATION.md`'s Sampling Rate): **PASS=15 FAIL=0 SKIP=0**, untouched by this plan.

## Task Commits

Each task was committed atomically:

1. **Task 1: tests/run-all-296.sh, the glob-discovery aggregator** - `6381fe46` (feat)
2. **Task 2: tests/fixtures/296/room-fixture.cjs, the shared both-backends room helper** - `0f1ce6c3` (feat)
3. **Task 3: the two already-true fences (tests/296-no-pinecone-internal.test.cjs, tests/296-dim-invariant.sh)** - `e6c005e1` (test)

**Plan metadata:** pending (this SUMMARY + STATE/ROADMAP update commit)

## Files Created/Modified
- `tests/run-all-296.sh` - Phase 296 verification aggregator: glob discovery, found-eq-0 guard, Part 8 sweep, no-em-dash fence
- `tests/fixtures/296/room-fixture.cjs` - shared temp-room + vector-store fixture, both-backends-capable
- `tests/296-no-pinecone-internal.test.cjs` - F-3/F-9 regression fence (5 tests, green today)
- `tests/296-dim-invariant.sh` - RSLOCAL-04 gate, SKIPs until plan 296-04's repoint lands

## Decisions Made
- Exempted `lib/core/rs_cache.py` by name from `tests/run-all-296.sh`'s Part 8 forbidden-token grep (documented retirement target per F-4, not yet repointed; `tests/296-dim-invariant.sh` is the real enforcement gate and SKIPs for the identical reason) - see Deviations below for why this was necessary, not optional.
- Exempted the single `require('./rs-pinecone-bridge.cjs')` line in `lib/core/rs-engine.cjs` from Test 4's zero-pinecone count (generic `cosineSimilarity` math re-export, not a Pinecone SDK call site).
- Documented that a bare `bash tests/run-all-296.sh` needs `TEST_296_ALLOW_MISSING=1` to exit 0 today, since `scripts/rs-vector-bridge.cjs` (a 296-03 deliverable) does not exist yet; this mirrors `tests/run-all-272.sh`'s identical situation during its own multi-wave rollout.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `lib/core/rs_cache.py` would have failed the Part 8 sweep as literally specified**
- **Found during:** Task 1 (`tests/run-all-296.sh`)
- **Issue:** The plan's `PART8_TARGETS` list includes `lib/core/rs_cache.py` with `PART8_FORBIDDEN` including `import pinecone|from pinecone`. `rs_cache.py` already exists today and its header docstring plus its guarded `from pinecone import Pinecone` import both literally match, so a literal implementation would FAIL the sweep today - contradicting Task 3's own acceptance criterion that `bash tests/run-all-296.sh` exits 0 with `SKIP>=1` once the plan is done.
- **Fix:** Exempted `lib/core/rs_cache.py` from the `PART8_FORBIDDEN` grep BY NAME, with an explanatory comment, mirroring the exact precedent `tests/run-all-272.sh` set for `lib/core/pinecone-inference.cjs` (a documented, in-progress, named exception rather than a silent hole). The file stays tracked in `PART8_TARGETS` and in the em-dash fence. The real, load-bearing enforcement of "rs_cache.py must stop importing pinecone" is `tests/296-dim-invariant.sh`'s SKIP-until-repointed gate, which already exists for exactly this fact.
- **Files modified:** `tests/run-all-296.sh`
- **Verification:** `bash tests/run-all-296.sh` (with `TEST_296_ALLOW_MISSING=1`) reports the Part 8 sweep as PASSED with `rs_cache.py` shown as `EXEMPT`, not silently clean.
- **Committed in:** `6381fe46` (Task 1 commit)

**2. [Rule 1 - Bug] Test 4's literal "zero pinecone occurrences" spec would have failed on a legitimate reused import**
- **Found during:** Task 3 (`tests/296-no-pinecone-internal.test.cjs`)
- **Issue:** `lib/core/rs-engine.cjs` line 57 is `const { cosineSimilarity } = require('./rs-pinecone-bridge.cjs');` - real code, not a comment, so comment-stripping alone does not remove it. A literal "comment-stripped source contains zero occurrences of 'pinecone' case-insensitive" assertion would have gone RED today on a legitimate, Canon-Part-7 reuse of a shared generic-math helper (the bridge module also contains real Pinecone-calling code, but `rs-engine.cjs` only imports the pure-math export from it).
- **Fix:** Added a by-name exemption for that one require line before counting, with an explanatory comment citing the identical exempt-by-name precedent used in `tests/run-all-296.sh`'s own Part 8 sweep.
- **Files modified:** `tests/296-no-pinecone-internal.test.cjs`
- **Verification:** `node tests/296-no-pinecone-internal.test.cjs` - 5/5 tests pass today.
- **Committed in:** `e6c005e1` (Task 3 commit)

**3. [Rule 1 - Bug] Bare `bash tests/run-all-296.sh` does not exit 0 without `TEST_296_ALLOW_MISSING=1`**
- **Found during:** Task 3 plan-close verification
- **Issue:** `scripts/rs-vector-bridge.cjs` is a 296-03 deliverable and does not exist yet. It is correctly tolerated by the Part 8 sweep's MISSING accounting (does not fail), but the plan's own no-em-dash fence design (explicitly stricter than Part 8, matching `tests/run-all-272.sh`'s convention) fails on any missing `PART8_TARGETS` file unless `TEST_296_ALLOW_MISSING=1` is set. The plan's stated acceptance criterion ("`bash tests/run-all-296.sh` exits 0") is literally true only with that flag set.
- **Fix:** No code change - this is the documented, intended escape hatch (present since `tests/run-all-272.sh`'s original design) for exactly this multi-wave-rollout situation. Recorded here so a later plan does not "fix" it by prematurely creating `rs-vector-bridge.cjs` out of sequence or by loosening the fence's real design.
- **Files modified:** none (documentation-only deviation)
- **Verification:** `TEST_296_ALLOW_MISSING=1 bash tests/run-all-296.sh` exits 0, reports `PASS=3 FAIL=0 SKIP=1`. Bare invocation (no flag) exits 1 today, expected, and will exit 0 without the flag once plan 296-03 creates `scripts/rs-vector-bridge.cjs`.
- **Committed in:** n/a (test-execution finding, not a code change)

---

**Total deviations:** 3 auto-fixed (all Rule 1 - bugs in the plan's literal grep specifications, caught by actually running the assertions against real source rather than assuming they would pass)
**Impact on plan:** All three fixes preserve the plan's actual intent (regression fences that are honestly green today, honestly SKIP where a later plan is still pending) while correcting literal specification defects that would have produced false-red gates on legitimate, already-reviewed code. No scope creep - zero files under `lib/`, `scripts/`, `commands/`, `skills/`, or `dist/` were touched.

## Issues Encountered
None beyond the three deviations documented above.

## User Setup Required
None - no external service configuration required. This plan installs zero packages and touches only `tests/`.

## Next Phase Readiness
- Plan 296-02 (rs-experts degrade split) and 296-03 (CJS vector export/bridge, both-backends test) can build directly on `tests/fixtures/296/room-fixture.cjs` without re-deriving the room-fixture idiom.
- `tests/run-all-296.sh` requires no edits from any later plan in this phase to discover its new `tests/296-*.test.cjs` / `tests/296-*.sh` files.
- `tests/296-dim-invariant.sh` is ready to go from SKIP to enforcing the moment plan 296-04 lands the `rs_cache.py` repoint - no changes needed to the gate itself.
- Operational note for the phase orchestrator: until plan 296-03 creates `scripts/rs-vector-bridge.cjs`, run `bash tests/run-all-296.sh` with `TEST_296_ALLOW_MISSING=1` set for a clean bare pass (see Deviation 3 above).

---
*Phase: 296-seed-030-rs-pipeline-spine-wiring-expert-graph-reconciliatio*
*Completed: 2026-09-03*

## Self-Check: PASSED

- FOUND: tests/run-all-296.sh
- FOUND: tests/fixtures/296/room-fixture.cjs
- FOUND: tests/296-no-pinecone-internal.test.cjs
- FOUND: tests/296-dim-invariant.sh
- FOUND: .planning/phases/296-seed-030-rs-pipeline-spine-wiring-expert-graph-reconciliatio/296-01-SUMMARY.md
- FOUND commit: 6381fe46 (Task 1)
- FOUND commit: 0f1ce6c3 (Task 2)
- FOUND commit: e6c005e1 (Task 3)

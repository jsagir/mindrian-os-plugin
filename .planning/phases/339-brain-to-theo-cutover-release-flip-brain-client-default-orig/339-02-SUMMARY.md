---
phase: 339-brain-to-theo-cutover-release-flip-brain-client-default-orig
plan: 02
subsystem: testing
tags: [enrichment-queue, theo-dual-shape, update-path, schema-memo, wave-0-red]

# Dependency graph
requires: [339-01]
provides:
  - tests/test-339-enrichment-theo-shapes.cjs, the FLIP-03a/b/c fixture proof (six fixtures + a Part 8 no-detail-leak arm) that 339-05's two additive arms must satisfy
  - tests/test-339-update-path-single-source.cjs, the FLIP-04 drift proof (both directions) that 339-06's lib/core/update-path.cjs must satisfy
  - tests/test-339-schema-memo-origin-keyed.cjs, the FLIP-05 structural proof that 339-04's _schemaCacheOrigin must satisfy
affects: [339-04, 339-05, 339-06, 339-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "node:test for behavioral fixture-driven suites (test-339-enrichment-theo-shapes.cjs), hand-rolled record()/failed-counter harness for structural source-scan suites (the other two), matching this repo's existing split between the two idioms"
    - "A require() against a not-yet-created module is caught and re-thrown as a clean, named Error (no MODULE_NOT_FOUND stack) so a Wave-0 aggregator's red output stays readable"

key-files:
  created:
    - tests/test-339-enrichment-theo-shapes.cjs
    - tests/test-339-update-path-single-source.cjs
    - tests/test-339-schema-memo-origin-keyed.cjs
    - .planning/phases/339-brain-to-theo-cutover-release-flip-brain-client-default-orig/339-02-SUMMARY.md
  modified: []

key-decisions:
  - "Fixture success checks use captureReadinessMiss's ACTUAL return shape: a genuine capture forwards enqueue()'s own {queued, queue_size} object, never {captured:true} -- only the early not-a-miss/error returns use the captured key. Verified against tests/test-249-enrichment-queue.cjs Test 10's own r1.queued/r2.queued/r3.queued convention before writing the assertions, not assumed from the plan's prose alone."
  - "The _isCapturableResult private-helper observation (plan Task 1 action spec) is satisfied without requiring a helper that does not exist in current code: fixtures 3 and 4 assert their own payloads never carry an error key, and the Part 8 arm proves no detail string reaches disk regardless of which fixtures capture."
  - "Task 2's Arm 5 anti-drift scan reused test-339-origin-single-source.cjs's exact per-line, per-file-kind comment stripper (Reuse Before Build) rather than a naive # / // check, so scripts/self-update's heredoc'd help text is correctly treated as non-comment code -- which is what surfaced the pre-existing scripts/self-update:68 duplicate (see Deviations)."

patterns-established:
  - "A structural source-scan test (FLIP-05) copies test-254's extractBraceBlock/extractFunctionBody verbatim rather than importing a shared test-utils module, matching this repo's existing per-file duplication convention for small pure text-slicing helpers."

requirements-completed: []

# Metrics
duration: 40min
completed: 2026-09-03
---

# Phase 339 Plan 02: Wave 0 Test Infrastructure, Part 2 of 3 Summary

**Three new `.cjs` test files (FLIP-03a/b/c, FLIP-04, FLIP-05) land RED by design, each proving one PREP-cut adaptation before its implementation exists, and one of them (the update-path anti-drift scan) surfaces a genuine pre-existing triple-copy of the update-path string not named in 339-CONTEXT.md.**

## Performance

- **Duration:** ~40 min
- **Started:** approx 2026-09-03T20:46:00Z (per session context)
- **Completed:** 2026-09-03T20:26:08Z commit timestamp (local clock; session-relative duration above is the reliable figure)
- **Tasks:** 3 completed
- **Files modified:** 4 (3 created, plus this SUMMARY)

## Accomplishments

- `tests/test-339-enrichment-theo-shapes.cjs` drives six fixtures (two Theo RESOLVED shapes, two Theo REFUSAL shapes, two unchanged incumbent shapes) plus a Canon Part 8 no-detail-leak arm through the exported `captureReadinessMiss`. Verified live: **fixtures 1-4 FAIL with `invalid_probe_result`** (neither Theo shape is recognized by the current two incumbent-only arms), **fixtures 5 and 6 PASS unchanged**, and the **Part 8 arm PASSES** (nothing has been written to disk that could leak a detail string yet). `PASS=3 FAIL=4`, matching the plan's own stated wave-1 target exactly.
- `tests/test-339-update-path-single-source.cjs` proves the two-command update path lives in exactly one place, in both directions: extraction from `.claude/includes/release-process.md`'s fenced block (Arm 1, PASSES), byte-equality plus frozen-export checks against `lib/core/update-path.cjs` (Arms 2-3, FAIL with a clean named `lib/core/update-path.cjs not found` error, never a raw `MODULE_NOT_FOUND` stack), rendered `refusal-messaging.cjs` copy for both `unreachable` and `no_key` (Arm 4, FAILS because it depends on the not-yet-created module), and a repo-wide anti-drift scan of `lib/` and `scripts/` (Arm 5, FAILS -- see Deviations for what it found).
- `tests/test-339-schema-memo-origin-keyed.cjs` is a structural source scan (no test-only `BRAIN_URL` setter, per `339-RESEARCH.md`'s own "Don't Hand-Roll" guidance) proving `_schemaCacheOrigin` will be compared before the memo is served, assigned in the same guard block as `_schemaCacheAt`, and declared adjacent to it. Verified live: **Arms 1-4 FAIL** (`_schemaCacheOrigin` does not exist yet), **Arms 5-7 PASS today** (the 30-minute TTL regression check, the Phase 247-02 sentinel-guard regression check, and the negative `flushSchemaMemo` assertion with its D-13-corrected reason written directly in the test source).

## Task Commits

Each task was committed atomically:

1. **Task 1: Write tests/test-339-enrichment-theo-shapes.cjs (FLIP-03a/b/c)** - `0a9c0774` (test)
2. **Task 2: Write tests/test-339-update-path-single-source.cjs (FLIP-04)** - `be641e88` (test)
3. **Task 3: Write tests/test-339-schema-memo-origin-keyed.cjs (FLIP-05)** - `c45fe65f` (test)

**Plan metadata:** this commit (docs: complete plan) - recorded after this SUMMARY and STATE.md/ROADMAP.md updates land.

## Files Created/Modified

- `tests/test-339-enrichment-theo-shapes.cjs` - new FLIP-03a/b/c fixture proof (335 lines, 7 `test()` blocks)
- `tests/test-339-update-path-single-source.cjs` - new FLIP-04 drift proof (331 lines, 5 structural arms)
- `tests/test-339-schema-memo-origin-keyed.cjs` - new FLIP-05 structural proof (213 lines, 7 structural arms)

## Decisions Made

- Fixture success assertions target `captureReadinessMiss`'s real return shape (`result.queued === true` on a genuine capture, `result.captured === false` only on the early not-a-miss/error returns), confirmed against `tests/test-249-enrichment-queue.cjs` Test 10's existing convention before writing any assertion, rather than trusting the plan prose's word "captures" to imply a `captured:true` field that the current code does not actually produce on the success path. This was caught and fixed live (see Deviations, Rule 1).
- The `_isCapturableResult`-gate observation the plan's Task 1 action spec asks for is satisfied without inventing or requiring a private helper that does not exist in current code: fixtures 3 and 4 each assert their own payload never carries an `error` key (Theo's honest-empty contract, `orchestration-readiness.ts:437-450`), and the shared Part 8 arm proves no detail string ever reaches disk regardless of which fixtures actually capture.
- Task 2's Arm 5 anti-drift scan reuses `tests/test-339-origin-single-source.cjs`'s own per-line, per-file-kind comment-stripping functions verbatim (Canon Part 7, Reuse Before Build) rather than a naive `#`/`//`-prefix check. This is precisely what let the scan correctly treat a bash heredoc's non-comment body as code and surface a real, previously-unknown duplicate (see Deviations).
- Task 3 copies `tests/test-254-normalize-roundtrip-probe.cjs`'s `extractBraceBlock`/`extractFunctionBody` helpers verbatim into the new file rather than factoring them into a shared test-utils module, matching this repo's existing convention of per-file duplication for small, pure, text-slicing helpers (no shared test-utils module exists in this repo for this purpose).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixture success assertions used the wrong result-shape key (`captured` instead of `queued`)**
- **Found during:** Task 1, first live run of `tests/test-339-enrichment-theo-shapes.cjs`
- **Issue:** The plan's `<behavior>` prose uses the word "captures" for every successful fixture, which I initially wrote as `assert.strictEqual(result.captured, true, ...)`. Running the file against the real `lib/core/enrichment-queue.cjs` showed fixtures 5 and 6 (the two incumbent shapes, which already work today) FAILING with `actual: undefined` instead of the expected `PASS` the plan's own acceptance criteria requires ("PASSES fixtures 5 and 6"). Reading `captureReadinessMiss`'s source (`enrichment-queue.cjs:506`) showed the success path returns `enqueue(roomDir, entry)` directly, whose own return shape is `{queued: true, queue_size: N}` -- the `captured` key only appears on the early `not_a_miss`/error-return paths, never on a genuine capture. `tests/test-249-enrichment-queue.cjs` Test 10 independently confirms this exact convention (`r1.queued`, `r2.queued`, `r3.queued` for successes; `r4.captured`, `r5.captured` for non-misses).
- **Fix:** Changed every success-path assertion (fixtures 1, 3, 5, 6) from `result.captured` to `result.queued`. Left the failure-path assertions (fixture 2's `not_a_miss`, fixture 4's `layer_empty`) on `result.captured`/`result.reason`, which is correct for those early-return paths.
- **Files modified:** `tests/test-339-enrichment-theo-shapes.cjs` (before its first commit; the committed version already carries the fix)
- **Verification:** Re-ran `node tests/test-339-enrichment-theo-shapes.cjs`: fixtures 5, 6, and the Part 8 arm now PASS as required; fixtures 1-4 FAIL with `invalid_probe_result`/`AssertionError` as required. `PASS=3 FAIL=4`, matching the plan's stated wave-1 target exactly.
- **Committed in:** `0a9c0774` (Task 1 commit; the fix was made before committing, so no separate commit was needed)

### Genuine Findings (not fixed, out of scope for this test-only plan)

**2. [Discovery, not a deviation] `tests/test-339-update-path-single-source.cjs` Arm 5 surfaces a pre-existing triple-copy of the update-path literal not named in `339-CONTEXT.md`**
- **Found during:** Task 2, live run of the anti-drift scan (Arm 5)
- **Finding:** The literal string `claude plugin update mos@mindrian-marketplace` already exists on a non-comment line at `scripts/self-update:68`, inside a `cat >&2 <<'EOF' ... EOF` heredoc that prints upgrade instructions to a deprecated no-op stub script's stderr. This is a genuine third copy of the string (alongside the canonical `.claude/includes/release-process.md:25` and the not-yet-created `lib/core/update-path.cjs`), exactly the class of drift D-08 (`339-CONTEXT.md`) exists to prevent -- and it predates this phase; it was not introduced by this plan. Two other near-matches (`lib/core/check-plugin-enabled.cjs:7`, `scripts/post-update-activation.cjs:11`) are correctly excluded: both are inside `/* */` JS block comments, and `scripts/self-update:28` (the same string, but inside a `#`-prefixed bash comment block) is also correctly excluded. Only line 68's heredoc body -- genuine non-comment shell output -- trips the scan.
- **Why not fixed here:** This plan is Wave 0, test-only, explicitly RED-by-design; its own objective states "three new `.cjs` test files... Do NOT soften any of them to reach green," and its `files_modified` frontmatter names only the three new test files. Editing `scripts/self-update` (a production file, not named in this plan's scope) would be scope creep into a later plan's territory.
- **Consequence for downstream plans:** `339-06` (which creates `lib/core/update-path.cjs`) will find Arm 5 of this test STILL red even after `lib/core/update-path.cjs` exists, purely because of `scripts/self-update:68`. 339-06's executor needs to either (a) allowlist `scripts/self-update` in Arm 5 with a written reason (it is an explicitly deprecated no-op stub, not a live decision path), or (b) rewrite its heredoc to avoid the literal, or (c) leave it red and document why in that plan's own SUMMARY. This is exactly the same class of finding 339-01's own FLIP-01 scan surfaced for `scripts/session-start:1896` -- named here so 339-06's executor does not have to rediscover it.
- **Files modified:** none (informational only; Arm 5's assertion already reports it as a named failure line, `scripts/self-update:68`)
- **Verification:** `node tests/test-339-update-path-single-source.cjs` prints `1 occurrence(s) of the literal found: scripts/self-update:68` and fails Arm 5 with that exact file:line in the assertion message.

---

**Total deviations:** 1 auto-fixed (Rule 1, a test-shape-vs-actual-return-shape bug caught and fixed before its governing commit), 1 genuine pre-existing finding documented for a downstream plan (not a defect in this plan's own three new files).
**Impact on plan:** No scope creep. The Rule 1 fix corrects this plan's own new test file before its first commit. The Arm 5 finding is real production drift that predates this phase; documenting it (rather than fixing it here) keeps this plan's `files_modified` scope honest.

## Issues Encountered

None beyond the one auto-fixed issue and the one documented finding above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 339-02's three deliverables are the RED targets the three implementing plans must turn GREEN:

- **339-04** (schema memo, `_schemaCacheOrigin`) must satisfy `tests/test-339-schema-memo-origin-keyed.cjs` Arms 1-4. Arms 5-7 (regressions + the negative `flushSchemaMemo` assertion) must stay green throughout -- if 339-04 ever needs to touch `SCHEMA_CACHE_TTL_MS`, the `result.error` sentinel, or introduces a `flushSchemaMemo`, that is itself a signal to stop and reconsider (D-13 corrected already ruled a flush unnecessary).
- **339-05** (the two additive enrichment-queue arms) must satisfy `tests/test-339-enrichment-theo-shapes.cjs` fixtures 1-4 without regressing fixtures 5, 6, or the Part 8 arm. The exact target state to reach, verbatim from this plan's own live run: fixture 1 `result.queued === true` with `missing_dimensions` deepEqual `['techniques', 'flow']`; fixture 2 `result` deepEqual `{captured:false, reason:'not_a_miss'}`; fixture 3 `result.queued === true` with `probe_provenance` containing `FRAMEWORK_NOT_FOUND` and never the detail string; fixture 4 `result` deepEqual `{captured:false, reason:'layer_empty'}`.
- **339-06** (`lib/core/update-path.cjs`) must satisfy `tests/test-339-update-path-single-source.cjs` Arms 1-4 AND must additionally resolve the `scripts/self-update:68` finding above before Arm 5 can go green -- Arm 5 will otherwise stay red even after the module exists.

`bash tests/run-all-339.sh` discovers all three new files via glob (`PASS=4 FAIL=5 SKIP=0`: the four RED-by-design `.cjs` suites -- `test-339-origin-single-source.cjs` from 339-01 plus this plan's three -- plus the no-em-dash fence failing only on the two files this phase has not yet created, `lib/core/update-path.cjs` and `docs/339-NOTE-theo-desktop-connector-key.md`, both correctly reported as `MISSING (not yet created)` rather than a false violation). `node tests/test-254-normalize-roundtrip-probe.cjs` and `node tests/test-250-refusal-shapes.cjs` both still PASS, confirming this plan wrote no production code and regressed nothing.

No blockers.

---
*Phase: 339-brain-to-theo-cutover-release-flip-brain-client-default-orig*
*Completed: 2026-09-03*

## Self-Check: PENDING

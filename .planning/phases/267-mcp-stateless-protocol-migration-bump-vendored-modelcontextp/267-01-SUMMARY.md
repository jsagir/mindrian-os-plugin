---
phase: 267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp
plan: 01
subsystem: testing
tags: [mcp, sdk-v2, baseline, test-scaffolding, wave-0, jsonrpc-stdio]

# Dependency graph
requires: []
provides:
  - "tests/helpers/mcp-wire-267.cjs: SDK-independent stdio JSON-RPC helper (hermeticEnv, rpcOverStdio, wireSnapshot, normalizeSchema, compareToSnapshot, killTree, LOCAL_SERVER, BRAIN_SHIM)"
  - "tests/run-all-267.sh: Phase 267 aggregator with all 16 MCPV2 legs pre-declared plus 16 regression legs"
  - "tests/test-267-mcpv2-sdk-era.cjs: MCPV2-01 four-arm era falsification test with EXPECT_V2 migration ledger"
  - "tests/test-267-mcpv2-lockstep.cjs: MCPV2-19 manifest/lockfile/shrinkwrap lockstep test"
  - "tests/test-267-mcpv2-cirs-gates.cjs: MCPV2-08 per-commit CIRS gate (connector registry + shape-declaration drift + descriptor count)"
  - "267-BASELINE.md: PLAN_BASE, installed versions, wire counts, CONNECTOR_DESCRIPTORS=31, SHAPE_VIOLATIONS=53, full suite/test result table, zod-4 breaking-pattern scan"
  - "tests/fixtures/267/wire-snapshot-zod3.json, shape-violations-baseline.txt, zod-importers-baseline.txt"
affects: [267-02, 267-03, 267-04, 267-05, 267-06, 267-07, 267-08, 267-09, 267-10, 267-11, 267-12, 267-13, 267-14, 267-15, 267-16, 267-17, 267-18]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SDK-independent wire helper: newline-delimited JSON-RPC over stdio via child_process only, zero @modelcontextprotocol/* require -- survives the v1 removal wave unchanged"
    - "Migration ledger pattern (EXPECT_V2 array in test-267-mcpv2-sdk-era.cjs): each migrating plan appends its own file paths rather than the test hardcoding a file list"
    - "Baseline-diff CIRS gate: shape-declaration violations compared as a subset check against a recorded set, not an exact-match, so improvements (a surface no longer violating) are INFO not FAIL"

key-files:
  created:
    - tests/helpers/mcp-wire-267.cjs
    - tests/run-all-267.sh
    - tests/test-267-mcpv2-sdk-era.cjs
    - tests/test-267-mcpv2-lockstep.cjs
    - tests/test-267-mcpv2-cirs-gates.cjs
    - tests/fixtures/267/wire-snapshot-zod3.json
    - tests/fixtures/267/shape-violations-baseline.txt
    - tests/fixtures/267/zod-importers-baseline.txt
    - .planning/phases/267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp/267-BASELINE.md
    - .planning/phases/267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp/deferred-items.md
  modified: []

key-decisions:
  - "CONNECTOR_DESCRIPTORS baseline recorded as 31 (measured this run), not the plan's plan-time note of 29 -- the delta is peer-session tool additions between the 2026-09-23 research pass and 2026-09-24 execution, not a defect"
  - "Resource/template wire counts (10/3) recorded from a fresh synthetic hermetic room, not research's 61/3 from a populated production room -- documented as room-content-dependent so later plans diff schema/description fields, not raw resource counts, unless they also control the room fixture"
  - "REGRESSION LEGS section of run-all-267.sh wired only with individual test files that passed (16 legs), not whole-suite scripts like run-all-266.sh even though it was fully green -- kept strictly to Task 2 step 7's 'individual test files' wording"
  - "Two newly-discovered non-flaky pre-existing failures (test-257-brain-tool-egress-invariant.cjs Arm 2, test-257-shim-honest-refusal.cjs Arm 4) logged to deferred-items.md and NOT fixed -- they sit under lib/core/part8-egress-guard.cjs, which is on this phase's Never-Edit list, and this plan's own objective is measurement-only"

requirements-completed: [MCPV2-01, MCPV2-08, MCPV2-19]

# Metrics
duration: ~35min
completed: 2026-09-24
---

# Phase 267 Plan 01: Wave 0 Test Scaffolding and Baseline Summary

**SDK-independent stdio wire helper, Phase 267 aggregator, MCPV2-01/19/08 tests, and a full Wave-0 baseline (44/9/10/3 local server tools/prompts/resources/templates, 6 brain-shim tools, 53 shape-declaration violations, 31 connector descriptors) -- zero production files touched.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-09-24T07:32:00Z
- **Tasks:** 2
- **Files modified:** 11 (10 created + 1 later-edited: tests/run-all-267.sh, edited in Task 2 to fill its own REGRESSION LEGS placeholder)

## Accomplishments
- Built `tests/helpers/mcp-wire-267.cjs`, a hand-rolled newline-delimited JSON-RPC-over-stdio helper with zero `@modelcontextprotocol/*` dependency, so the exact same snapshot/compare code works before, during, and after the v1 -> v2 migration (verified live against both `bin/mindrian-mcp-server.cjs` and `bin/mindrian-brain-mcp-client.cjs`, and confirmed it leaks no child process -- `pgrep -f mindrian-mcp-server.cjs` count unchanged before/after).
- Wrote `tests/run-all-267.sh`, the Phase 267 aggregator with all 16 MCPV2 legs pre-declared (future plans only add test files, never edit this leg list) plus 16 regression legs and an em-dash guard; green today (`PASS=20 FAIL=0 SKIP=13`).
- Wrote `tests/test-267-mcpv2-sdk-era.cjs` (MCPV2-01): Arm A falsifies that the installed v1 SDK implements 2026-07-28 (all ten markers zero), Arm B checks v2 support when present, Arm C is a migration ledger (`EXPECT_V2`, empty today, each migrating plan appends its own entries), Arm D sweeps for remaining v1 requires once the dependency is removed.
- Wrote `tests/test-267-mcpv2-lockstep.cjs` (MCPV2-19): six checks -- manifest/lockfile/shrinkwrap dependency agreement, lockfile packages-map agreement (root version excluded), zero shrinkwrap dev entries, single zod/core instance, supply-chain allowlist coverage.
- Captured the full Wave 0 baseline in `267-BASELINE.md`: PLAN_BASE `211030b13`, installed versions, wire snapshot counts, `CONNECTOR_DESCRIPTORS=31`, `SHAPE_VIOLATIONS=53` (zero under `lib/mcp/`), a full suite/test result table (30+ commands run, every pre-existing FAIL named), and a zod-4 breaking-pattern scan (15 patterns, file:line detail).
- Wrote `tests/test-267-mcpv2-cirs-gates.cjs` (MCPV2-08), the one-command per-commit gate every registration-rewrite commit in 267-06..267-11 will run.

## Task Commits

Each task was committed atomically:

1. **Task 1: SDK-independent wire helper, the aggregator, the era test and the lockstep test** - `86132064f` (test)
2. **Task 2: Record the baseline and ship the per-commit CIRS gate** - `7a67b47c9` (test)

_No plan-metadata-only commit was made separately; this SUMMARY.md and STATE/ROADMAP updates land in the standard final metadata commit._

## Files Created/Modified
- `tests/helpers/mcp-wire-267.cjs` - SDK-independent stdio JSON-RPC helper (hermeticEnv, rpcOverStdio, wireSnapshot, normalizeSchema, compareToSnapshot, killTree)
- `tests/run-all-267.sh` - Phase 267 verification aggregator, all legs pre-declared, REGRESSION LEGS filled with 16 passing test files
- `tests/test-267-mcpv2-sdk-era.cjs` - MCPV2-01 era falsification test, four arms
- `tests/test-267-mcpv2-lockstep.cjs` - MCPV2-19 lockfile/manifest lockstep test, six checks
- `tests/test-267-mcpv2-cirs-gates.cjs` - MCPV2-08 per-commit CIRS gate, three checks
- `tests/fixtures/267/wire-snapshot-zod3.json` - captured local + brain shim wire snapshot
- `tests/fixtures/267/shape-violations-baseline.txt` - 53 shape-declaration violation surface paths
- `tests/fixtures/267/zod-importers-baseline.txt` - 27 non-test production files requiring zod
- `.planning/phases/267-.../267-BASELINE.md` - the phase's measurement floor every later plan diffs against
- `.planning/phases/267-.../deferred-items.md` - two new pre-existing test failures logged, not fixed

## Decisions Made
- `CONNECTOR_DESCRIPTORS` recorded at the measured value (31) rather than the plan's plan-time literal (29); the plan's own text explicitly instructs "record what THIS run measures, never a literal."
- Resource/template wire counts documented as room-content-dependent (10/3 on a fresh fixture room vs. research's 61/3 on a populated room) so later plans do not misread a resource-count delta as a migration regression.
- REGRESSION LEGS section kept to individual test files only (16 legs), excluding whole-suite `.sh` scripts even when fully green, per the plan's literal "individual test files" wording in Task 2 step 7.

## Deviations from Plan

### Auto-fixed Issues

None - plan executed exactly as written. No Rule 1/2/3 auto-fixes were needed; this plan's own objective was measurement and scaffolding, and every acceptance criterion passed on the first implementation without requiring a correction.

### Findings logged, not fixed (out of scope, Rule 2/3 explicitly excluded by the Never-Edit list)

**1. Two NEW pre-existing test failures under the Part 8 egress boundary**
- **Found during:** Task 2, step 5 (running the full baseline suite battery)
- **Issue:** `tests/test-257-brain-tool-egress-invariant.cjs` Arm 2 ("zero egress on a canary") and `tests/test-257-shim-honest-refusal.cjs` Arm 4 ("G3 egress_disclosure on the wire") both fail, reproduced twice, not flaky. Neither is named in 267-RESEARCH.md's known-pre-existing list (which names only `test-257-strict-input-shapes.cjs` Arms B/F and `test-198-contract-schema.test.cjs`).
- **Why not fixed:** both sit under `lib/core/part8-egress-guard.cjs`'s coverage, which is on this phase's explicit Never-Edit list (267-CONTEXT.md). This plan's own objective changes zero production files, so it could not have caused either regression, and root-causing them is out of scope for a scaffolding-only plan.
- **Action taken:** logged to `.planning/phases/267-.../deferred-items.md` with reproduction detail, and recorded in `267-BASELINE.md`'s "Pre-existing reds" list so later Phase 267 plans do not mistake either for a migration-caused regression when they re-run `test-257-*`.
- **Files modified:** none (documentation only)
- **Commit:** `7a67b47c9` (267-BASELINE.md and deferred-items.md)

---

**Total deviations:** 0 auto-fixed; 1 out-of-scope finding logged per the scope-boundary rule (2 test failures, 1 root cause class).
**Impact on plan:** None. No scope creep; the finding was logged for phase continuity, not acted on.

## Issues Encountered
- `scripts/check-release-payload-ceiling.cjs` requires an explicit `--check` flag (bare invocation exits 2 with a usage message); corrected the baseline command before recording the result. Not a plan deviation, just a CLI-usage discovery during baseline capture.
- `node scripts/doctor.cjs --acceptance` recorded 21/22 points passed, with the sole FAIL (`verify-release-clean-tree`, "tracked-file drift: 1 file(s)") caused by a peer session's live uncommitted edit to `evals/plurai/211-baseline.json` that was present throughout this measurement pass -- an artifact of the documented multi-session shared-tree reality, not a Phase 267 defect. Not logged to deferred-items.md (not a Phase 267-attributable finding; would resolve itself once the owning peer session commits).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 267-02, 267-03, 267-04 (the rest of Wave 0: zod 4 + SDK 1.30.1 bump, app-views.cjs schema fix, the three RCA docs) can now measure "unchanged" against a named baseline instead of guessing.
- `tests/helpers/mcp-wire-267.cjs` is ready for reuse by 267-03, 267-05, 267-06, 267-09, 267-10, 267-11, 267-15 per the plan's own artifact-consumption table.
- Two pre-existing Part 8 egress-boundary test failures are now visible in `deferred-items.md` for whichever session eventually root-causes them; no Phase 267 plan should attempt to fix them without an explicit navigator instruction, since the owning file (`lib/core/part8-egress-guard.cjs`) is out of this phase's scope.
- No blockers for 267-02.

---
*Phase: 267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp*
*Completed: 2026-09-24*

## Self-Check: PASSED

All 11 files created by this plan verified present on disk; both task commits (`86132064f`, `7a67b47c9`) verified present in `git log --oneline --all`. No missing items.

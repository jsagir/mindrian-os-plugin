---
phase: 354-system-integrity-and-theo-integration-independent-research-a
plan: 01
subsystem: testing
tags: [ledger, research-gate, test-infra, phase-354, mcp, theo, canon-part-8]

# Dependency graph
requires: []
provides:
  - "docs/reviews/phase-354-disposition-ledger.md: 13-ID disposition ledger (SYS-01..09, THEO-01..04) with re-run evidence, coverage map, root-cause groups, ownership map, decision records"
  - "tests/run-all-354.sh: Phase 354 aggregator (run/run_if, exit-77 SKIP handling, em-dash guard)"
  - "tests/helpers/fixture-room-354.cjs: makeScratchRoom, captureToolServer, SKIP_EXIT_CODE"
  - "tests/helpers/playwright-354.cjs: resolvePlaywright() resolver, no npm/npx calls"
affects: [354-02, 354-03, 354-04, 354-05, 354-06, 354-07, 354-08, 354-09, 354-10, 354-11, 354-12, 354-13, 354-14, 354-15, 354-16, 354-18]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "run/run_if aggregator shape (from tests/run-all-353.sh) reused for the Phase 354 test suite"
    - "captureToolServer() double-idiom stub (server.tool AND server.registerTool) so a fixture works against either real MCP registration convention present in this repo"

key-files:
  created:
    - docs/reviews/phase-354-disposition-ledger.md
    - tests/run-all-354.sh
    - tests/helpers/fixture-room-354.cjs
    - tests/helpers/playwright-354.cjs
  modified:
    - lib/mcp/resources.cjs

key-decisions:
  - "D-354-SYS05 restated with impact: extract_shallow stays honest-parsing-only; the fix (354-15) corrects the tool description and agents/larry-extended.md prose to match the connector's own already-honest hitl_why, rather than adding write behavior"
  - "D-354-EGR restated with impact: Brain free-form egress requires closed-vocabulary proof of the whole string; navigator-approved 2026-09-23, Plan 06 proceeds unchanged"
  - "THEO-04 row recorded as CONFIRMED / remediation pending Plan 354-18 (not closed) per the 2026-09-23 Addendum's navigator ruling: document + procedural discipline, not a code fix"

requirements-completed: [SYS-01, SYS-02, SYS-03, SYS-04, SYS-05, SYS-06, SYS-07, SYS-08, SYS-09, THEO-01, THEO-02, THEO-03, THEO-04]

# Metrics
duration: 26min
completed: 2026-09-23
---

# Phase 354 Plan 01: Disposition Ledger and Shared Test Infrastructure Summary

**Re-ran all five Phase 354 reproduction probes live against HEAD `42191a6`, confirmed every finding from the 2026-09-23 research reproduces unchanged, and published the 13-ID pre-implementation disposition ledger plus the shared `tests/run-all-354.sh` aggregator and its two helper modules -- no production repair code touched.**

## Performance

- **Duration:** 26 min
- **Started:** 2026-09-23T08:59:41Z (baseline probe timestamp)
- **Completed:** 2026-09-23T09:05:14Z (final commit)
- **Tasks:** 2
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments

- Re-ran `persistence.cjs`, `registration.cjs`, `resources.cjs`, `theo.cjs`, and `browser.cjs`
  (the last via the real Playwright install at `/home/jsagi/node_modules/playwright`) live against
  the current HEAD; every CONFIRMED finding from `docs/reviews/2026-09-23-deep-system-research.md`
  reproduced identically (gate-subject wrong-node confirmation, chain-resume step-identity loss,
  live-lock takeover, symlink artifact write, symlink resource disclosure, Theo classification
  round-trip loss, invalid executable-chain IDs, unconditional FEEDS_INTO provenance claim,
  false-safe free-form egress, chat-panel `innerHTML` execution, lossy save round trip,
  cross-origin browser write, silent partial tool registration).
- Published `docs/reviews/phase-354-disposition-ledger.md` with all 10 required sections:
  Baseline, 13-row disposition table, an "observed, not a defect" note on `gate-ledger.cjs`'s
  fail-closed single-use burn, corrected/bounded earlier findings, legacy localhost-review
  rechecks, a coverage map naming every production area, root-cause seam-pair groups, an
  ownership map against phases 273/345/350/351/352, both decision records with stated impact
  (D-354-SYS05, D-354-EGR), and the THEO-04 config-inspection row.
- Live-inspected `/home/jsagi/Theo` read-only for THEO-02: confirmed `ci.yml`,
  `theo-liveness.yml`, `theo-seam-audit.yml` exist and no `theo-resync` consumer workflow exists
  at Theo commit `4ae9843`; recorded BLOCKED/cross-repository, not fixed unilaterally.
- Live-inspected `~/.claude.json` and `lib/core/brain-client.cjs` for THEO-04: confirmed the raw
  `theo` MCP server is a separate global registration from this repo's `.mcp.json` `mindrian-brain`
  entry, and reported an honest re-run mismatch against the CONTEXT.md Addendum's literal
  "exactly one match" claim (a repo-wide, unscoped grep also matches
  `lib/core/doctor/class-m-brain-smoke.cjs` and ~25 doc/test files; the substantive claim --
  `part8-egress-guard.cjs` never gates the raw `theo` binary -- still holds).
- Built `tests/run-all-354.sh` (17 `run_if` legs, one per planned `tests/test-354-*.cjs` file,
  exit-77-as-SKIPPED handling, and an em-dash guard over every named Phase 354 production
  surface), `tests/helpers/fixture-room-354.cjs` (`makeScratchRoom`, `captureToolServer`,
  `SKIP_EXIT_CODE`), and `tests/helpers/playwright-354.cjs` (`resolvePlaywright`, no
  npm/npx calls, verified `grep -cE "npm |npx "` prints 0).
- Confirmed `bash tests/run-all-354.sh` exits 0 with every leg SKIPPED (no test file exists yet)
  right after this plan, per the plan's own `<verification>` requirement.

## Task Commits

1. **Task 1: Re-run the five probes and publish the disposition ledger** - `d0fe92ab0` (docs)
2. **Task 2: Shared Phase 354 test infrastructure (aggregator, scratch-room helper, Playwright resolver)** - `317ecef78` (feat)

**Plan metadata:** pending (this commit, docs: complete plan)

## Files Created/Modified

- `docs/reviews/phase-354-disposition-ledger.md` - 13-ID pre-implementation disposition ledger, coverage map, root-cause groups, ownership map, decision records
- `tests/run-all-354.sh` - Phase 354 test aggregator (run/run_if, exit-77 SKIP handling, em-dash guard), executable
- `tests/helpers/fixture-room-354.cjs` - shared scratch-room and captured-tool-server fixture for every Phase 354 test
- `tests/helpers/playwright-354.cjs` - shared Playwright resolver, never installs anything
- `lib/mcp/resources.cjs` - comment-only em-dash to hyphen fix (see Deviations)

## Decisions Made

- Recorded D-354-SYS05 and D-354-EGR in the ledger with their stated impact, exactly as locked
  in `354-CONTEXT.md`; no new decision made in this plan, only restated with impact per the
  plan's own Task 1 instruction.
- Recorded THEO-04's disposition as CONFIRMED with remediation explicitly pending Plan 354-18
  (not closed), per the navigator's 2026-09-23 Addendum ruling.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing em-dashes in `lib/mcp/resources.cjs` comments**
- **Found during:** Task 2 (building the em-dash guard leg of `tests/run-all-354.sh`)
- **Issue:** `lib/mcp/resources.cjs`'s header comment and seven inline section-marker comments
  used em-dashes, violating CLAUDE.md's hard "no em-dashes anywhere" rule. This file is named in
  the plan's own Task 1 `<read_first>` (SYS-01 evidence, `resources.cjs:260-263`) and is the
  explicit owner-plan target of 354-05, so it belongs in the em-dash guard's array of "files
  Phase 354 plans modify" per Task 2's own instruction. Running the newly built aggregator caught
  this pre-existing violation and correctly failed the em-dash guard leg, which blocks the plan's
  own required `<verification>` outcome ("`bash tests/run-all-354.sh` exits 0 with every leg
  SKIPPED").
- **Fix:** Replaced all 8 em-dash occurrences (1 header line, 7 inline section-marker comments)
  with hyphens. Comment-only change; zero behavior change.
- **Files modified:** `lib/mcp/resources.cjs`
- **Verification:** `node -e "require('./lib/mcp/resources.cjs')"` succeeds;
  `node docs/reviews/phase-354-probes/resources.cjs` re-run produces byte-identical JSON output
  before and after the fix; `grep -c $'\xe2\x80\x94' lib/mcp/resources.cjs` prints 0.
- **Committed in:** `317ecef78` (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug, pre-existing style-rule violation blocking a
required gate this plan itself builds).
**Impact on plan:** Comment-only fix necessary to make this plan's own required aggregator
green, as the plan's own `<verification>` requires. No behavior change, no scope creep into
SYS-01's actual containment-logic fix (owned by 354-05).

## Issues Encountered

- `tests/helpers/playwright-354.cjs`'s own header comment originally read "zero npm dependencies
  of its own," which self-matched the plan's own acceptance-criteria grep
  (`grep -cE "npm |npx " tests/helpers/playwright-354.cjs` must print 0, since the pattern
  `npm ` matches "npm dependencies"). Reworded to "no third-party dependencies of its own" before
  committing; re-verified the grep prints 0 and `resolvePlaywright()` still resolves correctly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 2 (354-02 gate subject promotion, 354-03 chain resume identity, 354-04 write-lock
  ownership) can begin: each has a named owner row in the ledger with exact file:line evidence,
  live re-run output, and the exact claim/step/lock-ownership contract the fix must satisfy.
- `tests/run-all-354.sh` is ready to pick up each later plan's `tests/test-354-*.cjs` file
  automatically via its existing `run_if` legs; no later plan needs to edit this aggregator.
- THEO-02 remains BLOCKED cross-repository (Phase 351's consumer workflow does not exist yet at
  Theo commit `4ae9843`); 354-12's plugin-side verification should re-check Phase 351's state
  before writing its own THEO-02 disposition closure.
- THEO-04's row stays open ("remediation pending Plan 354-18") through waves 2-6; 354-16's
  close-out plan should not mark it closed until 354-18 actually lands the CLAUDE.md rule and
  the doctor advisory check.

---
*Phase: 354-system-integrity-and-theo-integration-independent-research-a*
*Completed: 2026-09-23*

## Self-Check: PASSED

All created files verified present on disk (docs/reviews/phase-354-disposition-ledger.md,
tests/run-all-354.sh, tests/helpers/fixture-room-354.cjs, tests/helpers/playwright-354.cjs,
this SUMMARY.md). Both task commits (`d0fe92ab0`, `317ecef78`) verified present in
`git log --oneline --all`.

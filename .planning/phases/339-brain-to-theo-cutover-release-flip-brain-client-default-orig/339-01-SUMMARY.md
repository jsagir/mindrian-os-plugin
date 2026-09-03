---
phase: 339-brain-to-theo-cutover-release-flip-brain-client-default-orig
plan: 01
subsystem: testing
tags: [brain-client, theo, origin-literal-scan, test-aggregator, requirements]

# Dependency graph
requires: []
provides:
  - FLIP-01..FLIP-12 requirement family registered in .planning/REQUIREMENTS.md and cited in .planning/ROADMAP.md
  - tests/run-all-339.sh, the Phase 339 test aggregator (glob discovery, found-eq-0 guard, Wave-0-red header, two generated-artifact gates)
  - tests/test-339-origin-single-source.cjs, the FLIP-01 hermetic source scan (RED by design, names the wave-1 work list)
affects: [339-02, 339-03, 339-04, 339-05, 339-06, 339-07, 339-08, 339-09, 339-10, 339-11, 339-12, 339-13, 339-14]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-line comment-stripping (quote state resets at the start of every line) rather than a single whole-file state machine, to bound any parsing mistake to one line"
    - "A phase aggregator invokes a dedicated .cjs source-scan test as its sweep arm instead of reimplementing a grep-loop forbidden-token list, when the phase's own production targets legitimately contain the tokens a naive grep would forbid"

key-files:
  created:
    - tests/run-all-339.sh
    - tests/test-339-origin-single-source.cjs
    - .planning/phases/339-brain-to-theo-cutover-release-flip-brain-client-default-orig/339-01-SUMMARY.md
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md

key-decisions:
  - "FLIP-01..FLIP-12 minted at plan time per the Phase 254 D-05 precedent, registered as [ ] rows to be finalized with measured proof at phase close"
  - "The origin-literal sweep in run-all-339.sh is NOT a copied 276-style forbidden-token grep loop; it delegates to tests/test-339-origin-single-source.cjs because this phase's own production targets legitimately contain 'brain-client' and 'https://'"
  - "tests/test-339-origin-single-source.cjs is discovered once via the tests/test-339-* glob and is deliberately NOT also invoked as a second named arm, to avoid double-counting the same evidence under two labels"

patterns-established:
  - "Comment-stripping for a hermetic source scan resets quote-tracking state per line, not per file, so a stray unmatched quote in prose (contractions like \"doesn't\") cannot corrupt parsing for hundreds of subsequent lines"

requirements-completed: [FLIP-01]

# Metrics
duration: 55min
completed: 2026-09-03
---

# Phase 339 Plan 01: Wave 0 Test Infrastructure Summary

**FLIP-01..FLIP-12 requirement family minted, tests/run-all-339.sh ported from run-all-276.sh, and a hermetic FLIP-01 origin-literal source scan lands RED by design, naming six un-allowlisted violations (including one, scripts/session-start:1896, not in CONTEXT.md's own D-12 list) for plan 339-07.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-09-03T20:08:23Z (approx, per session context)
- **Completed:** 2026-09-03T21:03:00Z (approx)
- **Tasks:** 3 completed
- **Files modified:** 4 (2 modified, 2 created, plus this SUMMARY)

## Accomplishments
- `.planning/REQUIREMENTS.md` carries a new `### Phase 339` section with all twelve FLIP-01..FLIP-12 rows, and the Traceability count moved from 131 to 143 active requirements in both places it is stated; `.planning/ROADMAP.md`'s Phase 339 entry now names all twelve ids instead of `TBD`.
- `tests/run-all-339.sh` is the one command that runs everything this phase owns: glob discovery on `TEST_339_PREFIX`, a load-bearing `found -eq 0` guard (verified non-zero exit under a nonexistent prefix), a Wave-0-red-by-design header naming the three RED arms by filename, and the two generated-artifact gates (`build-skill-mirrors.cjs --check`, `build-dist-bundles.cjs --check-stale`) that no other gate in this repo runs.
- `tests/test-339-origin-single-source.cjs` mechanizes FLIP-01: a hermetic scan of every `.cjs`/`.js`/extensionless-executable file under `lib/`, `bin/`, `scripts/` for an `onrender.com` Brain origin literal outside a two-entry, reason-carrying `ALLOWLIST`. It is RED on this run and prints the exact work list.

## Task Commits

Each task was committed atomically:

1. **Task 1: Record the FLIP-01..FLIP-12 requirement family in .planning/REQUIREMENTS.md** - `a2a9ba28` (docs)
2. **Task 2: Port tests/run-all-339.sh from tests/run-all-276.sh** - `9178835c` (test)
3. **Task 3: Write tests/test-339-origin-single-source.cjs (FLIP-01)** - `bda3a165` (test)

**Follow-up fix (same plan, discovered while validating Task 3's interaction with Task 2's file):** `4e112492` (fix) - dropped a duplicate invocation of the origin-single-source test inside `run-all-339.sh` (see Deviations).

**Plan metadata:** this commit (docs: complete plan) - recorded after this SUMMARY and STATE.md/ROADMAP.md updates land.

## Files Created/Modified
- `.planning/REQUIREMENTS.md` - new Phase 339 section (twelve FLIP rows), Traceability count 131 -> 143, FLIP added to the standing minted-family caveat
- `.planning/ROADMAP.md` - Phase 339 `**Requirements**:` line changed from `TBD` to the twelve FLIP ids
- `tests/run-all-339.sh` - new Phase 339 test aggregator (executable)
- `tests/test-339-origin-single-source.cjs` - new FLIP-01 hermetic source scan

## Decisions Made
- Minted FLIP-01..FLIP-12 exactly as `339-RESEARCH.md`'s `<phase_requirements>` table proposes, following the Phase 254 D-05 precedent (plan-time minting, `- [ ]` rows finalized at phase close).
- The origin-literal sweep in `run-all-339.sh` is a dedicated section that invokes `tests/test-339-origin-single-source.cjs` rather than a copied 276-style forbidden-token grep loop, because this phase's own production targets (`brain-client.cjs`, every `https://` scheme) would trip a naive token list on sight.
- Comment-stripping in the FLIP-01 scan is implemented as two per-file-type strippers (`stripJsLikeComments` for `.cjs`/`.js`, `stripShellComments` for extensionless executables), both resetting quote-tracking state at the start of every line rather than carrying it across the whole file - see Deviations for why.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Whole-file comment-stripping state machine silently swallowed real shell comments**
- **Found during:** Task 3, while writing `tests/test-339-origin-single-source.cjs`
- **Issue:** The first implementation used one character-level state machine tracking quotes across the entire file to strip `//`, `/* */`, and `#` comments. Running it against the real `scripts/session-start` (107KB of bash mixing code, `#` comments containing English contractions like "doesn't", and embedded snippets) revealed that a stray unmatched quote somewhere upstream left the state machine stuck inside a fake string for hundreds of lines, so genuine `#`-comment lines at `:1878` and `:1889` were never recognized as comments at all and were falsely reported as violations - a false positive that would have sent 339-07's executor chasing a non-issue.
- **Fix:** Rewrote the stripper as two per-file-type functions (`stripJsLikeComments`, `stripShellComments`), each resetting quote-tracking state at the START of every line rather than carrying it across the whole file. JS string literals and shell single/double-quoted strings are conventionally single-line in this codebase, so per-line reset costs nothing in the common case and bounds any parsing mistake to at most one line. Verified with an expanded Arm 2 self-check that now exercises both strippers with real-shaped fixtures (a multi-line JS docblock, a shell comment block matching `session-start`'s actual three-line shape) plus positive controls proving a real code-line literal (including one with `'https://...'` INSIDE a string, the exact case naive `//`-truncation would falsely clear) survives stripping.
- **Files modified:** `tests/test-339-origin-single-source.cjs` (before its first commit; the committed version already carries the fix)
- **Verification:** `node tests/test-339-origin-single-source.cjs` no longer flags `scripts/session-start:1878` or `:1889` (genuine comments); it correctly still flags `scripts/session-start:1896` (a genuine code-line literal, matching `339-RESEARCH.md`'s own finding at that exact line).
- **Committed in:** `bda3a165` (Task 3 commit; the fix was made before committing, so no separate commit was needed for this one)

**2. [Rule 1 - Bug] Duplicate origin-sweep invocation double-counted the same test**
- **Found during:** Post-Task-3 verification, running `bash tests/run-all-339.sh` end to end
- **Issue:** `tests/run-all-339.sh` (Task 2's file) had a dedicated "origin-literal sweep" section that explicitly ran `node tests/test-339-origin-single-source.cjs` as a named arm. Once Task 3 created that file, it ALSO matched the runner's own `tests/test-339-*.cjs` glob-discovery pattern, so the aggregator ran the identical test twice under two different labels, double-counting one FAIL as two in the PASS/FAIL tally.
- **Fix:** Removed the redundant explicit invocation, keeping the explanatory comment (documenting why `test-339-origin-single-source.cjs` plays the sweep role and why the 276-style forbidden-token list is wrong here) so a future reader does not "restore" a duplicate call. The test still runs exactly once, via glob discovery.
- **Files modified:** `tests/run-all-339.sh`
- **Verification:** `bash tests/run-all-339.sh` now reports `PASS=4 FAIL=2 SKIP=0` (origin sweep RED + 254 Arms 4-5 RED, the two RED-by-design arms from the runner's own header, plus the no-em-dash fence FAILING only on two not-yet-created files with `TEST_339_ALLOW_MISSING` unset - all expected wave-1 state) instead of the prior double-counted `FAIL=3`.
- **Committed in:** `4e112492`

**3. [Rule 2 - not applied, documented instead] A cross-session commit race added an unrelated file into Task 1's commit**
- **Found during:** Post-Task-1 verification (`git show --stat HEAD`)
- **Issue:** This repo's working tree is shared with a concurrent Phase 276 session (per the sequential-execution note in this plan's own prompt). Between `git add -f .planning/REQUIREMENTS.md .planning/ROADMAP.md` and `git commit`, the other session's own `git add -f` on its own `276-08-SUMMARY.md` update landed in the shared index at the moment this plan's commit ran, so that file's diff appears inside commit `a2a9ba28` alongside this plan's two named files.
- **Fix:** None taken - amending is prohibited by this workflow's own protocol ("always create NEW commits rather than amending"), the included file is the other session's own legitimate, already-force-added planning artifact (not a secret, not destructive), and re-committing it separately would just duplicate the same bytes under a second commit. Documented here instead so the record is honest about what commit `a2a9ba28` actually contains.
- **Files modified:** none (informational only)
- **Verification:** `git log --oneline` shows `276-08-SUMMARY.md` was already tracked by an ancestor commit (`bd4d2972`, made by the other session before this plan's Task 1 commit); the content swept into `a2a9ba28` was that session's own subsequent append to the same file.
- **Committed in:** n/a (no new commit; the artifact of concern is inside `a2a9ba28`, not this plan's own scope)

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs, both found and fixed before or immediately after their governing task's commit), 1 documented-only (a benign cross-session git race, not a code or requirement defect).
**Impact on plan:** No scope creep - both fixes are corrections to this plan's own two new files, made before or as an immediate follow-up commit to the task that created them. The cross-session race is an environmental artifact of shared-working-tree execution, not a defect in this plan's work.

## Issues Encountered
None beyond the two auto-fixed issues above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness

Plan 339-01's three deliverables are the foundation every later 339 plan reports into:

- Plan 339-04 (the origin-keyed alias selector) will turn `tests/test-254-normalize-roundtrip-probe.cjs` Arms 4-5 green.
- Plan 339-06 (the shared update-path constant) will turn `tests/test-250-refusal-shapes.cjs`'s new pin green.
- **Plan 339-07's exact work list**, read directly from this plan's own scan output (verbatim, captured post-fix):

```
Phase 339-01 (FLIP-01) origin single-source scan -- HERMETIC
  ok  Arm 1: ALLOWLIST has exactly two entries, each with a reason >= 40 chars
  ok  Arm 2: a comment-only line carrying the literal is not a violation (self-check fixture)

  6 violation(s) found (this is the correct wave-1 state; plan 339-07 clears the remaining script literals):
    lib/core/doctor/class-m-brain-smoke.test.cjs:74
    lib/core/doctor/class-m-brain-smoke.test.cjs:333
    lib/core/doctor/class-m-brain-smoke.test.cjs:365
    scripts/build-brain-census.cjs:61
    scripts/probe-brain-contract.cjs:74
    scripts/session-start:1896
  FAIL Arm 3: zero un-allowlisted onrender.com origin literals under lib/, bin/, scripts/
    AssertionError [ERR_ASSERTION]: 6 un-allowlisted origin literal(s) found: lib/core/doctor/class-m-brain-smoke.test.cjs:74, lib/core/doctor/class-m-brain-smoke.test.cjs:333, lib/core/doctor/class-m-brain-smoke.test.cjs:365, scripts/build-brain-census.cjs:61, scripts/probe-brain-contract.cjs:74, scripts/session-start:1896

Phase 339-01 (FLIP-01) origin single-source scan: FAIL (1 failures)
```

Notably `scripts/session-start:1896` is a genuine finding NOT named in `339-CONTEXT.md`'s own D-12 list (`339-RESEARCH.md` line 215 independently confirms it and recommends dropping the host from the banner rather than deriving it live, since there is no CLI on `brain-client.cjs` to shell out to). `class-m-brain-smoke.test.cjs`'s three mock-literal lines are the expected paired-mock updates `339-PATTERNS.md` already names as riding the same commit as the doctor layer's own fix.

No blockers. `bash tests/run-all-339.sh` runs and discovers test files (`PASS=4 FAIL=2 SKIP=0`, both FAILs RED-by-design plus the expected em-dash-fence gap on two not-yet-created files); `grep -o 'FLIP-[0-9][0-9]' .planning/REQUIREMENTS.md | sort -u | wc -l` returns 12; `build-connector-registry.cjs --check`, `build-orchestration-projection.cjs --check`, `check-render-coverage.cjs`, and `check-shape-declaration.cjs --check` all still pass (the last is advisory WARN-only per Canon Part 11, pre-existing, unrelated to this plan).

---
*Phase: 339-brain-to-theo-cutover-release-flip-brain-client-default-orig*
*Completed: 2026-09-03*

## Self-Check: PASSED

- FOUND: tests/run-all-339.sh
- FOUND: tests/test-339-origin-single-source.cjs
- FOUND: .planning/phases/339-brain-to-theo-cutover-release-flip-brain-client-default-orig/339-01-SUMMARY.md
- FOUND: a2a9ba28 (Task 1 commit)
- FOUND: 9178835c (Task 2 commit)
- FOUND: bda3a165 (Task 3 commit)
- FOUND: 4e112492 (deviation follow-up fix commit)

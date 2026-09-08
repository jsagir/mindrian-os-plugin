---
phase: 298-seed-032-harness-as-code-declare-and-machine-enforce-the-min
plan: 01
subsystem: testing
tags: [test-harness, cjs, node-builtin, aggregator, anti-vacuous-pass, baseline]

requires: []
provides:
  - "298-TEST-BASELINE.md: verbatim pre-edit pass/fail record of 20 named commands (5 pre-existing red, 15 pre-existing green)"
  - "tests/run-all-298.sh: phase aggregator with 7 run_if-guarded legs, exits 0 today (PASS=6 FAIL=0 SKIP=1)"
  - "five tests/test-298-*.cjs stubs, each exiting 0 (SKIP) while its SUBJECT is absent and exiting 1 the moment its SUBJECT lands without implemented assertions"
affects: [298-02, 298-03, 298-04, 298-05, 298-06, 298-15]

tech-stack:
  added: []
  patterns:
    - "run_if <label> <guard-file> <cmd> aggregator idiom (copied verbatim from tests/run-all-201.sh)"
    - "three-state anti-vacuous-pass stub contract: SUBJECT absent -> SKIP exit 0; SUBJECT present + ASSERTIONS_IMPLEMENTED=false -> FAIL exit 1 with PENDING list; SUBJECT present + implemented -> real assertions"

key-files:
  created:
    - .planning/phases/298-seed-032-harness-as-code-declare-and-machine-enforce-the-min/298-TEST-BASELINE.md
    - tests/run-all-298.sh
    - tests/test-298-policies-schema.cjs
    - tests/test-298-runner-idempotent.cjs
    - tests/test-298-derive-health.cjs
    - tests/test-298-voice-log.cjs
    - tests/test-298-contract-parity.cjs
  modified:
    - .planning/phases/298-seed-032-harness-as-code-declare-and-machine-enforce-the-min/298-VALIDATION.md

key-decisions:
  - "Baseline captured before any other file in this phase was touched; narrowed the research-predicted six pre-existing red tests to five (test-205-elevation-doctrine-floor.cjs now passes; the pinned version regex and the canon header moved into agreement since the research pass)"
  - "run-all-298.sh keeps all 7 legs the plan specifies (5 stubs + manifest --check + runner fixture) even though the grep -c \"run_if\" acceptance criterion (expects 7) assumed the 5-leg run-all-201.sh arithmetic; documented as a plan-spec inconsistency rather than dropped legs"

requirements-completed: [R-11]

duration: 6min
completed: 2026-09-08
---

# Phase 298 Plan 01: Baseline, Aggregator, and Anti-Vacuous-Pass Stubs Summary

**Captured the pre-existing 5-red/15-green test baseline verbatim before any edit, then built the Phase 298 aggregator and five test stubs that can never pass vacuously once their subjects land.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-09-08T03:55:46Z
- **Completed:** 2026-09-08T04:01:34Z (approx)
- **Tasks:** 3/3 completed
- **Files modified:** 7 created, 1 modified (298-VALIDATION.md)

## Accomplishments

- Recorded a verbatim, reproducible pass/fail baseline for the 20 commands named in the plan (manifest cluster, persona cluster, gate cluster) BEFORE creating any other file in this phase, so R-11 ("existing tests stay green") is provable rather than asserted.
- Discovered and documented a divergence from research: `test-205-elevation-doctrine-floor.cjs` (predicted red) is now green at HEAD, narrowing the provable "no new failures" baseline from six named tests to five: `test-harness-manifest-precommit-wiring.cjs`, `test-harness-167-verdict.cjs`, `test-209-declared-implies-wired.cjs`, `test-connector-exhaustive-coverage.cjs`, `test-115-surfaces-grep.sh`.
- Built `tests/run-all-298.sh` from the `tests/run-all-201.sh` `run`/`run_if` idiom verbatim, with all 7 legs the plan specifies; it exits 0 today with `PASS=6 FAIL=0 SKIP=1` (only the runner-fixture leg skips, since `data/harness-manifest.json` already exists at HEAD).
- Built five `tests/test-298-*.cjs` stubs, each carrying the anti-vacuous-pass three-state contract (`T-233-04` false-success class): SKIP+exit 0 while its SUBJECT artifact is absent (true for all five today), FAIL+exit 1 the moment the subject lands without `ASSERTIONS_IMPLEMENTED = true`. `test-298-runner-idempotent.cjs`'s PENDING list already names the D-03a source grep (`openGraph|openRoomDbForCaller|room-db.cjs`) so the read-only-door rule cannot be forgotten by a later plan.
- Flipped `298-VALIDATION.md`'s `wave_0_complete` to `true` and ticked 7 of 8 Wave 0 boxes (fixture box stays unticked for 298-02).

## Task Commits

Each task was committed atomically:

1. **Task 1: Record the pre-edit test baseline verbatim** - no commit (writes to `.planning/`, which is gitignored in this repo; the plan explicitly says do not commit this file directly -- it lands in the metadata commit below via `git add -f`)
2. **Task 2: Create tests/run-all-298.sh from the run-all-201.sh idiom** - `385d4514` (feat)
3. **Task 3: Create the five test-298 stubs with an anti-vacuous-pass guard** - `46cb1d71` (feat)

**Plan metadata:** pending (this commit, made after this SUMMARY lands)

## Files Created/Modified

- `.planning/phases/298-seed-032-harness-as-code-declare-and-machine-enforce-the-min/298-TEST-BASELINE.md` - the 20-command baseline table, HEAD sha `0409faf6b550a37264d19e3f138442ac61ab8b90`, captured_at `2026-09-08T03:55:46Z`
- `tests/run-all-298.sh` - the phase aggregator, executable, 7 `run_if` legs
- `tests/test-298-policies-schema.cjs` - R-02/R-03 stub, SUBJECT `data/harness-policies/_schema.json`
- `tests/test-298-runner-idempotent.cjs` - R-04 stub, SUBJECT `scripts/run-harness.cjs`
- `tests/test-298-derive-health.cjs` - R-05 stub, SUBJECT `scripts/check-graph-derive-health.cjs`, guarded on `node:sqlite` availability
- `tests/test-298-voice-log.cjs` - R-08 stub, SUBJECT `scripts/check-voice-style.cjs`
- `tests/test-298-contract-parity.cjs` - R-06 stub, SUBJECT `data/harness-policies/contract-parity-larry.json`
- `.planning/phases/298-seed-032-harness-as-code-declare-and-machine-enforce-the-min/298-VALIDATION.md` - `wave_0_complete: false` -> `true`; 7 of 8 Wave 0 checkboxes ticked

## The Observed 20-Command Baseline (see 298-TEST-BASELINE.md for full detail)

| Command | Exit | Verdict |
|---|---|---|
| `node scripts/build-harness-manifest.cjs --check` | 0 | PASS |
| `node tests/test-harness-manifest-check.cjs` | 0 | PASS |
| `node tests/test-harness-manifest-part8-boundary.cjs` | 0 | PASS |
| `node tests/test-201-harness-manifest.cjs` | 0 | PASS |
| `node tests/test-harness-167-verdict.cjs` | 1 | FAIL (pre-existing) |
| `node tests/test-harness-manifest-precommit-wiring.cjs` | 1 | FAIL (pre-existing) |
| `node lib/mcp/no-instructions.test.cjs` | 0 | PASS |
| `node tests/test-143.2-doctrine-presence.cjs` | 0 | PASS |
| `node tests/test-larry-handoff-seam.cjs` | 0 | PASS |
| `node tests/test-canon-entry-38-sourced-claims-floor.cjs` | 0 | PASS |
| `node tests/test-gate-native-fire-w1.cjs` | 0 | PASS |
| `node tests/test-chain-executor-part8-leak.cjs` | 0 | PASS |
| `bash tests/test-115-persona-variants.sh` | 0 | PASS |
| `bash tests/test-114-substrate-preload.sh` | 0 | PASS |
| `node tests/test-205-elevation-doctrine-floor.cjs` | 0 | PASS (divergence from research; predicted FAIL) |
| `bash tests/test-115-surfaces-grep.sh` | 1 | FAIL (pre-existing) |
| `node scripts/check-hook-schema-compatibility.cjs` | 0 | PASS |
| `node tests/test-doctor-acceptance-self-coverage.cjs` | 0 | PASS |
| `node tests/test-209-declared-implies-wired.cjs` | 1 | FAIL (pre-existing) |
| `node tests/test-connector-exhaustive-coverage.cjs` | 1 | FAIL (pre-existing) |

## Decisions Made

- **Baseline first, no exceptions:** the baseline capture ran before `tests/run-all-298.sh` or any stub existed, confirming `git status --porcelain` carried only the orchestrator's pre-recorded `M .planning/STATE.md` line throughout Task 1.
- **Five pre-existing failures, not six:** research predicted six red tests at HEAD. Observed at this baseline capture, `test-205-elevation-doctrine-floor.cjs` passes (45/45 assertions, including the version/entry check, which now reads "v1.27 + entry 34"). Documented in `298-TEST-BASELINE.md`'s "Divergence from research" section rather than silently accepted or silently corrected -- the phase-close comparison will rerun the same 20 commands against this five-test set.
- **Kept all 7 aggregator legs despite a miscounted acceptance grep:** Task 2's acceptance criteria says `grep -c "run_if" tests/run-all-298.sh` should return 7, but the plan's own leg list (5 stubs + manifest-check + runner-fixture = 7 legs) plus the identical header-mention + function-definition structure used in `tests/run-all-201.sh` (which returns 7 for its 5 legs) arithmetically produces 9 for a 7-leg file, not 7. Rather than delete real legs the task action, `298-PATTERNS.md`, and `298-VALIDATION.md` all specify, the aggregator keeps all 7 legs and this mismatch is flagged below as a deviation.

## Deviations from Plan

### Auto-fixed Issues

None - no bugs, missing functionality, or blocking issues were found; no code needed a Rule 1/2/3 fix.

### Flagged Plan-Spec Inconsistencies (not auto-fixed, documented per Rule 4 caution)

**1. Task 2 acceptance criterion arithmetic does not match the plan's own 7-leg spec**
- **Found during:** Task 2 verification
- **Issue:** The acceptance criteria state `grep -c "run_if" tests/run-all-298.sh` should return 7. `tests/run-all-298.sh` has 7 `run_if` legs (as specified by the task action, `298-PATTERNS.md`, and `298-VALIDATION.md`'s Wave 0 Requirements), 1 function definition (`run_if() {`), and 1 header-comment mention of the word "run_if" -- the same three-part structure `tests/run-all-201.sh` uses, where `grep -c` returns 7 because that file has only 5 legs (5+1+1=7). For a 7-leg file the same arithmetic returns 9, not 7 (verified: `grep -c "run_if" tests/run-all-298.sh` actually returns 9).
- **Resolution:** Kept all 7 legs (matching the explicit leg list in the task action and the cross-file corroboration in `298-PATTERNS.md`/`298-VALIDATION.md`) rather than dropping legs to force the acceptance number to 7. This is a plan-authoring arithmetic slip (likely copied from the 5-leg 201 precedent without recomputing for 7 legs), not a functional defect -- the aggregator's actual behavior (`bash tests/run-all-298.sh` exits 0, `PASS=6 FAIL=0 SKIP=1`) matches every other acceptance criterion in Task 2.
- **Files affected:** `tests/run-all-298.sh` (no change needed; flagged for navigator awareness only)
- **Verification:** `grep -c "run_if" tests/run-all-298.sh` returns 9; all other Task 2 acceptance criteria (exit 0, executable, zero em/en-dashes, `Phase 298: PASS=... FAIL=0 SKIP=...` summary line) pass as specified.
- **Committed in:** `385d4514` (the file was correct on first write; this is a verification-time note, not a fix)

## Auth Gates Encountered

None.

## Known Stubs

The five `tests/test-298-*.cjs` files are intentional stubs by design (this is the entire point of the plan): each declares `const ASSERTIONS_IMPLEMENTED = false;` and a `PENDING` checklist, and exits 0 (SKIP) only because its SUBJECT artifact does not exist yet. This is not a gap to close in this plan -- later plans (298-02 through 298-06 per the `affects` list above) land each SUBJECT and flip `ASSERTIONS_IMPLEMENTED` to `true`, implementing the PENDING assertions. Listed here per the summary-creation stub-tracking instruction, not as an unresolved defect.

| File | SUBJECT (not yet created) | Owning future plan (per requirements) |
|---|---|---|
| `tests/test-298-policies-schema.cjs` | `data/harness-policies/_schema.json` | R-02/R-03 landing plan |
| `tests/test-298-runner-idempotent.cjs` | `scripts/run-harness.cjs` | R-04 landing plan |
| `tests/test-298-derive-health.cjs` | `scripts/check-graph-derive-health.cjs` | R-05 landing plan |
| `tests/test-298-voice-log.cjs` | `scripts/check-voice-style.cjs` | R-08 landing plan |
| `tests/test-298-contract-parity.cjs` | `data/harness-policies/contract-parity-larry.json` | R-06 landing plan |

## Threat Flags

None. This plan's threat register (T-298-05, T-298-06, T-298-02, T-298-SC) was fully addressed by construction: `run_if` guards every leg (T-298-05), the `ASSERTIONS_IMPLEMENTED` three-state contract makes a vacuous pass impossible (T-298-06), the baseline file carries no room content or secrets (T-298-02), and zero external packages were installed (T-298-SC). No new security-relevant surface was introduced beyond what the threat model already names.

## Self-Check: PASSED

- FOUND: `.planning/phases/298-seed-032-harness-as-code-declare-and-machine-enforce-the-min/298-TEST-BASELINE.md`
- FOUND: `tests/run-all-298.sh`
- FOUND: `tests/test-298-policies-schema.cjs`
- FOUND: `tests/test-298-runner-idempotent.cjs`
- FOUND: `tests/test-298-derive-health.cjs`
- FOUND: `tests/test-298-voice-log.cjs`
- FOUND: `tests/test-298-contract-parity.cjs`
- FOUND commit `385d4514` (feat(298-01): add tests/run-all-298.sh phase aggregator)
- FOUND commit `46cb1d71` (feat(298-01): add five anti-vacuous-pass stubs for tests/test-298-*.cjs)

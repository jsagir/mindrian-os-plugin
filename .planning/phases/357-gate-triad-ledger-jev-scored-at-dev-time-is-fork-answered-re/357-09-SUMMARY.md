R4: MET

---
phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re
plan: 09
subsystem: testing
tags: [bar-gate, baseline, parity, standing-gate, mutation, card-fire]

# Dependency graph
requires:
  - phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re (plan 02)
    provides: scripts/replay-card-fire.cjs (--code-root, --baseline write|compare)
  - phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re (plan 07)
    provides: the D-07 (turn-text.cjs, check-card-fire.cjs) and D-08a (gate-relevance.cjs) runtime fixes, commits a05ef931c and f6999ed53
  - phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re (plan 08)
    provides: the navigator-ratified corpus (60 entries, R-C known_false_block ruling)
provides:
  - tests/fixtures/card-fire-replay/baseline.json (pre-phase verdict per corpus id, meta.pre_phase_sha)
  - tests/test-357-replay.cjs --mutation (the real mutation leg, replacing the reserved SKIP)
  - tests/run-all-238.sh 357 replay standing-gate leg (additive, zero lines removed)
  - 357-VALIDATION.md sign-off (nyquist_compliant true, approved)
  - the measured, committed R4/R5 bar result on HEAD: MET
affects: [357-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mutation-leg code roots: a single git-archive(HEAD) base dir, copied fresh per mutant via fs.cpSync, with named runtime files overwritten from `git show <pre_phase_sha>:<path>` -- never edits the working tree, never reuses a mutant dir across legs, cleaned up in a finally"
    - "The mutation leg gates itself on the unmutated HEAD bar being green first: a red HEAD bar prints 'mutation leg: not provable, R4 NOT MET' and fails honestly rather than asserting anything about a mutant"

key-files:
  created:
    - tests/fixtures/card-fire-replay/baseline.json
  modified:
    - tests/test-357-replay.cjs
    - tests/run-all-238.sh
    - .planning/phases/357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re/357-VALIDATION.md

key-decisions:
  - "PLAN_BASE = 6b8eb03b91fe02d0df501cc95ad9753620f9ba7d (HEAD at plan start; git status --short showed no peer diff on any of the 4 target paths before editing)"
  - "Task 1 commit: 8f8de719e (test, baseline write + HEAD bar measured MET). Task 2 commit: 5b04f659b (test, mutation leg + run-all-238 leg + VALIDATION sign-off)"
  - "--mutation is a distinct invocation mode: when the flag is present and baseline.json exists, the file runs ONLY the 3 mutant checks (plus the HEAD-green precondition) and exits, rather than also running L1-L7; this matches run-all-238.sh's own separate `node tests/test-357-replay.cjs --mutation` invocation"
  - "Mutant base dir and per-mutant dirs share the replay-357-root-mutation-* prefix (not a distinct unrelated name) so the existing leftover check (`ls -d /tmp/replay-357-root-*`) is a real cleanup proof, not a trivially-green check against a differently-named directory"

requirements-completed: [GATE357-02, GATE357-04, GATE357-05, GATE357-06, GATE357-08]

# Metrics
duration: ~30min active
completed: 2026-09-23
---

# Phase 357 Plan 09: Baseline, R4/R5 bar, standing gate, mutation leg Summary

**Pre-phase baseline.json written against sha 973deb3296f60c8583fe2ba2eac1ba5d32d62024, the full 60-entry corpus replayed on HEAD both surfaces against it with R4 MET (0 false_blocks, 0 new_misses, 0 parity_mismatches, 0 errors, 0 unmarked_misses), the replay wired as an additive standing leg into tests/run-all-238.sh, and a real `--mutation` leg added to tests/test-357-replay.cjs proving that reverting D-07 and/or D-08a to their pre-phase bytes reproduces FALSE_BLOCK on the two live anchors.**

## Performance

- **Duration:** ~30 min active (Task 1 ~10 min: baseline write + bar measurement; Task 2 ~20 min: mutation leg implementation + full suite runs)
- **PLAN_BASE:** `6b8eb03b91fe02d0df501cc95ad9753620f9ba7d`
- **Tasks:** 2/2 complete
- **Files modified:** 4 (1 created: `baseline.json`; 3 modified: `test-357-replay.cjs`, `run-all-238.sh`, `357-VALIDATION.md`)

## R4 / R5 Bar (HEAD, both surfaces, --baseline compare)

```
entries=60 evaluated=60 false_blocks=0 missed_forks=0 known_misses=1
known_false_blocks=1 new_misses=0 excluded_partial=0 parity_mismatches=0
errors=0 unmarked_misses=0
bar-exit=0
```

**R4: MET** -- exit 0, all five gating counts (`false_blocks`, `new_misses`, `parity_mismatches`, `errors`, `unmarked_misses`) at 0.

**known_misses (1):**
- `debug-intern-w1-prose-fork` -- "text-dependent: prose fork with 0 extractable option labels and no structural gate signal; needs text understanding (SPEC R4, Deferred)"

**known_false_blocks (1, excluded from the bar per R-C / plan-08 ruling):**
- `dogfood-0f86dd63-092046` -- "single content-token overlap ('governance') on a short human continuity turn about a prior thread; engagement with the unrelated F.1 reach vs coincidental phrasing is text-dependent, not deterministically separable (R-C)"

The pre-phase write (`--code-root pre-phase --surface cli --baseline write`) itself reported `false_blocks=13` (the same 13 ids listed in 357-07-SUMMARY.md's class-change table plus the two live anchors), confirming `baseline.json` really captures the pre-fix world, not an already-fixed one.

## Mutation Leg (GATE357-08, R7, R-I, R-J)

`node tests/test-357-replay.cjs --mutation` -- **PASS 3/3, exit 0**:

| Mutant | Reverted files | Required outcome | Result |
|--------|-----------------|-------------------|--------|
| M1 | `lib/hmi/turn-text.cjs`, `scripts/check-card-fire.cjs` (reverts D-07) | `live-2026-09-23-01` FALSE_BLOCK, exit 1 | ok |
| M2 | `lib/core/gate-relevance.cjs` (reverts D-08a) | `live-2026-09-23-02` FALSE_BLOCK, exit 1 | ok |
| M3 | all three files (reverts both) | both live anchors FALSE_BLOCK, exit 1 | ok |

Each mutant is a fresh copy of a `git archive HEAD scripts lib data package.json .claude-plugin` base dir, with the named files overwritten from `git show 973deb3296f60c8583fe2ba2eac1ba5d32d62024:<path>` (never edits the working tree). The leg first requires the unmutated HEAD `--baseline compare` run to exit 0 (R4 MET) before building any mutant, so the leg is honestly red rather than asserting anything if the bar itself is broken. `ls -d /tmp/replay-357-root-* | wc -l` is 0 after the run (every mkdtemp removed in a finally).

## Standing Gate Wiring

- `tests/run-all-238.sh`: one additive `run_if "357 card-fire replay standing gate (GATE-04, R-J)" "tests/test-357-replay.cjs" node tests/test-357-replay.cjs` line after the 238-07/08 corpus leg. `git diff $PLAN_BASE -- tests/run-all-238.sh | grep '^-' | grep -v '^---' | wc -l` is 0 (zero lines removed).
- The leg already existed in `tests/run-all-357.sh` (written in 357-01) guarded on `baseline.json`'s existence; it now runs for real instead of SKIPping.

## Suite Runs

**`bash tests/run-all-357.sh`:** `PASS=16 FAIL=0 SKIP=0` (exit 0). All 8 phase-357 legs green (corpus loader, replay+parity, labeler refusal, harness source, F.1 chrome, dogfood strict, mutation, shared tripwires), all 6 regression legs green, vendor-string guard green, em-dash guard green.

**`bash tests/run-all-238.sh`:** `PASS=9 FAIL=1 SKIP=0`. The single FAILED leg is `238-03 gate_answer chosen validation (GATE-01 G-2)` -- the pre-existing, recorded-and-not-fixed red (R-J). The new `357 card-fire replay standing gate` leg **PASSED** (12/12 internal legs).

**`bash tests/run-all-179.sh`:** the pre-existing `179-08 ga4-card-fire-e2e` red (E2E-1, R-J) reproduced, unchanged. Every other leg green.

**`bash tests/run-all-209.sh`:** `PASS=8 FAIL=1 SKIP=0`. The single FAILED leg is `209-03 declared-implies-wired` (the pre-existing advisory-WARN pre-existing-set red, R-J). Every other leg green.

**Known pre-existing reds (R-J), recorded and NOT fixed in this plan:**
- `run-all-179` E2E-1 (`179-08 ga4-card-fire-e2e`)
- `run-all-209` `209-03` (`declared-implies-wired`)
- `run-all-238` `238-03` (`gate_answer chosen validation`)
- 5 legs of `tests/test-card-fire-relevance-gate.cjs` (not re-run individually this plan; unchanged from 357-07's measured 6 passed / 5 failed, since this plan touched no runtime file)

## Task Commits

1. **Task 1: Baseline on the pre-phase commit and the R4 / R5 bar on HEAD** - `8f8de719e` (test)
2. **Task 2: Standing gate (run-all-238 leg), the mutation leg, and VALIDATION sign-off** - `5b04f659b` (test)

**Plan metadata:** this commit (docs: complete plan) -- per the objective, STATE.md/ROADMAP.md/REQUIREMENTS.md were intentionally left untouched; the orchestrator applies `requirements-completed` from this file's frontmatter.

## Files Created/Modified

- `tests/fixtures/card-fire-replay/baseline.json` - new, pre-phase verdict per corpus id (60 entries), `meta.pre_phase_sha` = `973deb3296f60c8583fe2ba2eac1ba5d32d62024`
- `tests/test-357-replay.cjs` - `--mutation` implemented (was a reserved SKIP); `MUTATION_MODE` early-exit path; `buildMutantBase`/`makeMutant`/`runMutationLeg` helpers
- `tests/run-all-238.sh` - one additive `run_if` leg for the 357 replay
- `.planning/phases/.../357-VALIDATION.md` - `nyquist_compliant: true`, `wave_0_complete: true`, Wave 0 and sign-off checkboxes ticked, `**Approval:** approved 2026-09-23 (357-09 bar: MET)`

## Decisions Made

See `key-decisions` in the frontmatter. In addition:

- `git archive`/`git show`/`tar` are invoked via the file's existing `spawnSync` import (already present for the child-process `replay()` helper) rather than adding a second child-process API (`execFileSync`), keeping the file's process-spawning surface to one primitive.
- The mutation leg's own `ok()` checks report as 3 entries (M1/M2/M3) when the HEAD-green precondition passes silently (no extra printed line), and as a single failing HEAD-green check plus the "mutation leg: not provable, R4 NOT MET" line when it does not -- matching the plan's "print ... and fail (an honest red)" wording without adding a 4th always-printed passing assertion that the acceptance criteria did not ask for.

## Deviations from Plan

None (Rule 1-4 sense) -- plan executed as written for both tasks: R4 measured MET (no RCA path needed), the mutation leg implemented and proven, the standing gate wired additively, VALIDATION signed off.

One documentation-only note, not a deviation: the plan's Task 2 acceptance criterion `grep -c "nyquist_compliant: true" 357-VALIDATION.md` is 1 assumes a single match, but the file's own pre-existing sign-off checklist item text is the literal string `` `nyquist_compliant: true` set in frontmatter ``, so the grep now matches twice (the frontmatter field itself, plus that checklist line, which was already worded that way before this plan touched the file). The semantic requirement -- `nyquist_compliant: true` actually set in the YAML frontmatter -- is satisfied; this is a pre-existing template-wording artifact, not a functional gap, and was left as-is (D-08: not a runtime/behavior issue, no fix to improvise).

## Issues Encountered

None.

## Stub Tracking

No stubs. `baseline.json` is a real, fully-populated verdict map (60/60 ids); the mutation leg's mutant code roots are real archived+reverted source trees, never placeholder data; the VALIDATION sign-off reflects measured suite output, not an asserted claim.

## Threat Flags

None. Both threats this plan's own `<threat_model>` targets are directly addressed and verified: T-357-23 (a silent revert of the fix) is caught by the mutation leg itself (this plan's central deliverable); T-357-12 (mkdtemp mutants/archives never leak) is verified by the `ls -d /tmp/replay-357-root-*` empty check after the mutation run. No new trust boundary or surface was introduced; this plan changes zero runtime files (`lib/`, `hooks/`, `scripts/check-card-fire.cjs` all untouched, verified via `git diff --name-only $PLAN_BASE..HEAD -- lib hooks scripts` printing nothing).

## Verification Results

- `node scripts/replay-card-fire.cjs --code-root pre-phase --surface cli --baseline write` - `false_blocks=13` (pre-fix world confirmed), exit 1, baseline.json written
- `node -e` pre_phase_sha / entry-coverage check - exit 0
- `node -e` live-anchor pre-phase-blocked check - exit 0
- `node scripts/replay-card-fire.cjs --surface both --baseline compare` - `entries=60 false_blocks=0 new_misses=0 parity_mismatches=0 errors=0 unmarked_misses=0`, exit 0 (R4 MET)
- `node tests/test-357-replay.cjs --mutation` - PASS 3/3, exit 0
- `node tests/test-357-replay.cjs` (full L1-L7) - PASS 12/12, exit 0
- `bash tests/run-all-357.sh` - PASS=16 FAIL=0 SKIP=0, exit 0
- `bash tests/run-all-238.sh` - PASS=9 FAIL=1 (238-03, known, R-J) SKIP=0
- `bash tests/run-all-179.sh` - E2E-1 (179-08) failed as known (R-J), all else green
- `bash tests/run-all-209.sh` - PASS=8 FAIL=1 (209-03, known, R-J) SKIP=0
- `grep -v '^#' tests/run-all-238.sh | grep -c "test-357-replay"` - 2 (the `run_if` label comment string and the command line)
- `git diff $PLAN_BASE -- tests/run-all-238.sh | grep '^-' | grep -v '^---' | wc -l` - 0
- `ls -d /tmp/replay-357-root-* 2>/dev/null | wc -l` - 0 (after the mutation run)
- `grep -c "nyquist_compliant: true" 357-VALIDATION.md` - 2 (see Deviations note; frontmatter value itself is correctly `true`)
- `git diff --name-only $PLAN_BASE..HEAD -- lib hooks scripts` - empty (no runtime file touched)
- Em-dash guard (`grep -c $'\xe2\x80\x94'` on all 3 touched files) - 0/0/0
- Post-commit deletion check on both commits (`git diff --diff-filter=D --name-only`) - empty both times

## User Setup Required

None - no external service configuration, no secrets, no network egress (the replay harness's own D-13 fetch ban was exercised across every leg; `git archive`/`git show`/`tar` are local-only).

## Next Phase Readiness

- Plan 10 (Larry prose shrink, manifest regen, D-17 filing, requirement closure) is unblocked: this plan's own R4 result is **MET**, so per the plan's own objective ("This plan's R4 result gates plan 10's prose shrink, SPEC R6"), plan 10 proceeds with the metric-gated prose shrink rather than skipping it and recording a reason.
- The standing gate is now live in three places: `tests/run-all-357.sh` (357's own suite), `tests/run-all-238.sh` (the shared GATE-04 card-fire runner), and directly invocable as `node tests/test-357-replay.cjs --mutation`.
- Per this plan's own scope contract (orchestrator owns shared state), no `STATE.md` / `ROADMAP.md` / `REQUIREMENTS.md` write was made; `requirements-completed: [GATE357-02, GATE357-04, GATE357-05, GATE357-06, GATE357-08]` is recorded in this file's frontmatter for the orchestrator to apply.
- No blockers.

---
*Phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re*
*Plan: 09*
*Completed: 2026-09-23*

## Self-Check: PASSED

All 4 files created/modified this plan verified present on disk (`tests/fixtures/card-fire-replay/baseline.json`, `tests/test-357-replay.cjs`, `tests/run-all-238.sh`, `357-VALIDATION.md`). Both task commits (`8f8de719e`, `5b04f659b`) verified present in `git log --oneline --all`. No missing items.

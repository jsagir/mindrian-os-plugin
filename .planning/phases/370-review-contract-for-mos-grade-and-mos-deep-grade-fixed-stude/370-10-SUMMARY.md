---
phase: 370-review-contract-for-mos-grade-and-mos-deep-grade-fixed-stude
plan: 10
subsystem: review-contract
tags: [review-contract, doctor, release-gate, tdd]
requires: [370-07, 370-08, 370-09]
provides:
  - "scripts/check-review-contract.cjs --check: static mode (template lint, fixtures, contract load)"
  - "scripts/doctor.cjs coverage-gate gates[] entry review-contract (blocker by owner answer O6A)"
  - "tests/test-370-doctor-gate.cjs (arms G1 to G7)"
affects: [370-11]
key-files:
  created:
    - tests/test-370-doctor-gate.cjs
  modified:
    - scripts/check-review-contract.cjs
    - scripts/doctor.cjs
    - tests/test-370-wrapper.cjs
key-decisions:
  - "O6A BLOCKER: severity is read from enforcement.doctor_severity in data/review-contract.json (value blocker). Blocker exits 1 on any finding; advisory prints WARN lines to stderr and exits 0; --strict exits 1 either way; off or missing prints a disabled line and exits 0. An unreadable contract file fails closed (blocker)."
  - "The doctor point label, severity and applies_to are unchanged. One gates[] object and a comment were added."
  - "tests/ is not in the npm pack, so the fixtures leg prints an explicit SKIP line when tests/ is absent. tests/ present with a missing fixture is a FINDING."
requirements-completed: [REV370-11]
completed: 2026-11-08
---

# Phase 370 Plan 10: Doctor gate for the review contract

The release train now runs `node scripts/check-review-contract.cjs --check` inside the doctor coverage-gate point. It lints the shipped output templates, runs the pre-fix and post-fix fixtures, and loads the contract. A regression blocks the release (owner answer O6A = BLOCKER).

## Gate (PROVEN)

`node 370-gate.cjs gate-item 370-DECISION.md O6A`: exit 0, output `RESOLVED O6A=BLOCKER`. BASE = 31e37b03d4987aea8260cb982c2521d400631ed3. `git status --short scripts/doctor.cjs scripts/check-review-contract.cjs` was empty before the edits. The plan ran. It was not declined.

## Commits

| Commit | Files |
|--------|-------|
| 5bf600f52 | tests/test-370-doctor-gate.cjs, scripts/check-review-contract.cjs (RED test and the --check mode) |
| 09a69dc47 | scripts/doctor.cjs (GREEN for G6, the doctor entry) |
| 4eda427dc | tests/test-370-wrapper.cjs (arm W7 no longer pins the old stub) |

Not pushed. No tag, no version change, no dist regeneration.

## TDD record

RED, the test written first, run against the script that still had the reserved `--check` stub (exit 3):

```
FAIL G1 ... exit code on the real repo (got 3, want 0)
FAIL G2 ... blocker exit code (got 3, want 1)
FAIL G3 ... exit code (got 3, want 1)
FAIL G4 ... swapped exit code (got 3, want 1)
FAIL G5 ... blocker (got 3, want 1)
FAIL G6 ... the review-contract gate entry is not inside the coverage-gate point
FAIL G7 ... exit code (the seeded leaks must be found) (got 3, want 1)
PASS: 0 FAIL: 7
```

An earlier draft let G7 pass with no finding. A precondition (exit 1) was added so G7 cannot pass vacuously.

GREEN after the `--check` mode (5bf600f52): G1 to G5 and G7 pass, G6 fails (waits for the doctor entry). After the doctor entry (09a69dc47):

```
  ok   G1 ... G7
PASS: 7 FAIL: 0
```

## What the --check mode does

- Leg templates: every fenced block of references/methodology/grade.md and agents/grading.md is scanned for rules internal_name and em_dash. The block after "## Artifact Template" gets the full check. A block in commands/grade.md or commands/deep-grade.md directly under `<!-- review-template -->` gets the full check (none exists today; the guard is for the future).
- Leg fixtures: pre-fix.md must fail the check and post-fix.md must pass. `SKIP fixtures` line when tests/ is absent.
- Leg contract: loadContract must succeed.
- Output: LEG lines, one `FINDING <leg> <file> <rule> <class> line <n>` per problem, then `RESULT OK`, `RESULT FAIL <n>` or `RESULT WARN <n>`. Rule, class, file and line only; no block text (arm G7, plant string not echoed). Offline, no Brain call.

## Verification (PROVEN, run in this session)

| Command | Result |
|---------|--------|
| node scripts/check-review-contract.cjs --check | LEG templates OK, LEG fixtures OK, LEG contract OK, RESULT OK |
| node tests/test-370-doctor-gate.cjs | PASS: 7 FAIL: 0 |
| bash tests/run-all-370.sh | PASS=12 FAIL=0 SKIP=0 |
| node scripts/doctor.cjs --acceptance --only=coverage-gate, before edit | PASS 1/1 (1632 ms) |
| node scripts/doctor.cjs --acceptance --only=coverage-gate, after edit | PASS 1/1 (1734 ms), not worse than baseline |
| node tests/test-cirs-adversarial-verify.cjs | exit 0 |
| run-all-188 | exit 0 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] tests/test-370-wrapper.cjs arm W7 pinned the reserved --check stub**
- **Found during:** run-all-370 after Task 2 (PASS=11 FAIL=1)
- **Issue:** W7 (plan 370-08) asserted that `--check` exits 3 with "not available yet". Plan 370-10 replaces that stub, so W7 failed by design.
- **Fix:** W7 now asserts that `--check --nope` (a bad flag) exits 3 with a usage line. All other W7 checks unchanged.
- **Files modified:** tests/test-370-wrapper.cjs
- **Commit:** 4eda427dc

## Baseline failures (not caused by this plan)

- tests/test-render-gate-wiring.cjs and tests/test-skill-mirrors-tripwire.cjs fail with and without the doctor edit. Cause: scripts/install-pre-commit.sh lacks the guard text the tests grep for. PROVEN by running both with scripts/doctor.cjs restored from HEAD: same failures. The plan lists these two as wiring tests; they were already red.
- run-all-178 fails (render-registry entry count 15, plus the install-pre-commit.sh arms). Same cause family, not the doctor.
- run-all-223 fails in the desensitize and 222-08 reach-rank arms; its nested run-all-224 call fails on the 222 gate. Not related to the doctor.

## Deferred (not fixed, out of scope)

The baseline failures above. They belong to the pre-commit installer and to Phases 222 and 223.

## Unverified

- run-all-224 and run-all-355 standalone did not finish inside the tool limit (224 timed out at 100 s in its doctor acceptance step; 355 not run). The doctor entry only adds one gates[] object inside the coverage-gate point, and the point passes.
- `node scripts/doctor.cjs --acceptance` (full) was not run; Part 11 gates.
- Cowork: no surface here; the gate is release-time only.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, no network, no file written outside tests and the two scripts.

## Self-Check

- tests/test-370-doctor-gate.cjs, scripts/check-review-contract.cjs, scripts/doctor.cjs present and committed.
- Commits 5bf600f52, 09a69dc47, 4eda427dc exist on main.
- No U+2013 or U+2014 in the touched files.
- STATE.md, ROADMAP.md and REQUIREMENTS.md not touched.

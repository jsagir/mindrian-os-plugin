---
phase: 400-job-sentences-with-three-stored-slots-on-every-capability-a-
plan: 02
subsystem: job-sentences
tags: [job-sentence, frontmatter, command-registry, skill-mirrors, run-step]

requires:
  - phase: 400-01
    provides: lib/core/job-sentence.cjs, scripts/apply-job-sentences.cjs, registry field job_sentence, tests/run-all-400.sh
provides:
  - provisional three-slot job sentences on all 73 run-step commands (frontmatter, registry, mirrors)
  - tests/test-400-job-sentences.cjs legs S0 to S4 (plans 03 and 04 grow it)
  - run-all-400 drift checks build-command-registry --check and build-skill-mirrors --check
affects: [400-03, 400-04, 400-15]

tech-stack:
  added: []
  patterns:
    - "Batch input files live in os.tmpdir() only; one apply per batch; delete after apply"
    - "A pin test that hashes or byte-compares frontmatter drops named later-phase keys before the compare"

key-files:
  created:
    - tests/test-400-job-sentences.cjs
  modified:
    - commands/*.md (73 run-step commands, 4 lines each)
    - skills/*/SKILL.md (72 generated mirrors)
    - data/command-registry.json
    - data/harness-manifest.json
    - tests/run-all-400.sh
    - tests/test-400-job-sentence-lib.cjs
    - tests/test-370-commands.cjs
    - tests/test-363-runner-contract.cjs

key-decisions:
  - "S3 excludes the skip-listed hand-authored skill skills/trending-to-absurd/SKILL.md (SKIP_LIST of build-skill-mirrors.cjs); the writer refuses it and the generator never writes it, so it carries no job lines"
  - "test-370-commands C1 and test-363-runner-contract K6 drop the 4 job keys before their compare; the original pins stay unchanged"

patterns-established:
  - "Later plans that add frontmatter keys extend LATER_PHASE_KEYS in tests/test-370-commands.cjs and the key regex in tests/test-363-runner-contract.cjs K6, beside LATER_PHASE_KEYS in tests/test-361-command-contract.cjs"

requirements-completed: [JS-02]

duration: 75min
completed: 2026-11-24
---

# Phase 400 Plan 02: Run-step job sentences Summary

**73 of 73 run-step commands carry one provisional three-slot job sentence (job_when, job_want, job_so, job_sentence_status) in frontmatter, in data/command-registry.json and in the generated skill mirrors; organize, mva-brief and mva-report are labelled (O-12).**

## Performance

- **Duration:** about 75 min
- **Started:** 2026-11-24T08:20Z (approximate)
- **Completed:** 2026-11-24T09:39Z
- **Tasks:** 2 of 2
- **Files modified:** 155 (73 commands, 72 mirrors, 2 data files, 5 tests, 1 runner, plus 1 new test)

## Accomplishments

- Batch A (37) and batch B (36) sentences written fresh from repo text (registry teaching and serves_jtbd lines, O-14), applied only through `node scripts/apply-job-sentences.cjs --input <os.tmpdir() file>`. The input files were deleted after each apply. No frontmatter was edited by hand.
- `git diff --numstat c1e496ae8 -- commands/` lists exactly 73 files, each 4 insertions and 0 deletions. No description field changed (test-400-description-budget green).
- `node scripts/apply-job-sentences.cjs --check` prints "commands 73/113, skills 0/12, agents 0/17". The registry holds 73 non-null job_sentence rows; the other 40 are null.
- tests/test-400-job-sentences.cjs: S0 (73 names resolve, validate-proposition maps to commands/value-proposition.md), S1 (4 keys, provisional, slotErrors []), S2 (registry equals frontmatter, others null), S3 (mirrors carry the same 4 lines), S4 (unique sentences, at most 40 words, no product name, command name, digit or quote; O-12 names labelled). RED before batch B (4 legs failed), GREEN after.
- tests/run-all-400.sh: test loop gains test-400-job-sentences.cjs; drift loop gains build-command-registry.cjs --check and build-skill-mirrors.cjs --check.

## Task Commits

1. **Task 1: batch A** - 4e0e42cab (feat)
2. **Task 2: coverage test and batch B** - f4e07fbef (test, RED), eb1ce5e3a (feat)
3. **Fixes found by the regression sweep** - 941f861ee (fix: lib test fixtures), 308fd75b1 (fix: 370 and 363 pins)
4. **Wording fix** - dafe502b9 (fix: 4 sentences repeated "I want" or "so" inside a slot; S4 caught one over 40 words during the rework)

## The 73 provisional sentences (for 400-LABEL-REVIEW.md, plan 15)

The full text is in the command frontmatter and in data/command-registry.json (job_sentence). Render with `node -e` over the registry and `renderJob`. Every sentence carries status provisional. Sentences of the three deprecated aliases describe the job of their successor surface (mva-brief: first argument pyramid from a venture sentence; mva-report: structured report of the last conversation; organize: room hierarchy), so the advisor can still route to them until a later efficiency phase removes them.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] test-400-job-sentence-lib W1 and W2 assumed commands/validate.md holds no job keys**
- **Found during:** Task 2 (run-all-400)
- **Issue:** the writer legs copied the live commands/validate.md into a scratch root and compared against it as a key-free original. Plan 02 labels validate, so W1 and W2 failed.
- **Fix:** the scratch copies strip the job lines first; the legs test the writer from a clean state, independent of labelling progress.
- **Files modified:** tests/test-400-job-sentence-lib.cjs
- **Commit:** 941f861ee

**2. [Rule 3 - Blocking] test-370-commands C1 pins a sha256 of the full frontmatter of grade.md and deep-grade.md**
- **Found during:** regression sweep after Task 2 (passed at c545130e5, failed after)
- **Issue:** the additive job lines moved the hash.
- **Fix:** C1 drops the named later-phase keys (LATER_PHASE_KEYS) before the hash. The 370 pin values are unchanged, so every 370 line stays pinned.
- **Files modified:** tests/test-370-commands.cjs
- **Commit:** 308fd75b1

**3. [Rule 3 - Blocking] test-363-runner-contract K6 byte-compares scout.md against its pre-363 base**
- **Found during:** regression sweep
- **Issue:** K6 failed before this plan on scheduled-tasks.md (pre-existing); after this plan it also failed on scout.md because of the job lines.
- **Fix:** K6 drops the 4 job lines of scout.md before the compare. K6 and K8 now fail exactly as at c545130e5.
- **Files modified:** tests/test-363-runner-contract.cjs
- **Commit:** 308fd75b1

**4. [Rule 1 - Quality] 4 sentences repeated the formula words inside a slot**
- grade, explain-decision and futures said "I want" in the when slot; mos-reason doubled "so". Reworded through the writer. Commit dafe502b9.

## Interpretations

- S3 and trending-to-absurd: skills/trending-to-absurd/SKILL.md is hand-authored and on the SKIP_LIST of scripts/build-skill-mirrors.cjs. The generator never writes it and apply-job-sentences refuses it as a mirrored skill. S3 skips SKIP_LIST names and asserts that trending-to-absurd is the only skipped run-step name. The command file and the registry row carry the sentence. Writing the 4 lines into the hand-authored skill needs a ruling (see Deferred Issues).

## Regression sweep

- 286 tests under tests/ that read the registry, commands/ or skills/ files ran in parallel; 47 exited non-zero. The same 47 ran at c545130e5 in a temporary detached worktree (removed after). 42 also fail at base. Of the 5 that pass at base: test-370-commands was a real regression (fixed above); test-298-contract-parity, test-command-registration-check, test-connector-coverage-ledger and test-connector-tripwire exit 0 when run serially (load timeouts).
- For the 42 that fail at both, the FAIL lines were compared. Differences: test-363-runner-contract K6 (fixed above), and test-389-retire-brief Test 6 and test-389-session-report Test 5, whose pre-existing "no tracked file names mva-brief / mva-report" lists gain tests/test-400-job-sentences.cjs. That leg already lists 399 and 400-01 files; O-12 keeps the names alive. Not changed.
- 28 lib and scripts *.test.cjs files that read commands or the registry: 12 non-zero now, all 12 non-zero at base except lib/memory/connector-registry.test.cjs, which exits 0 serially. No FAIL line is new.

## Deferred Issues

- skills/trending-to-absurd/SKILL.md carries no job lines (hand-authored, skip-listed). A ruling is needed: leave it (the command and the registry hold the sentence) or allow the writer to label skip-listed skills.
- test-389-retire-brief Test 6 and test-389-session-report Test 5 stay red (pre-existing; list grows by one file).

## Known Stubs

None. 40 registry rows keep job_sentence null by design; they are not run-step commands. Plans 400-03 and 400-04 label skills and agents.

## Threat Flags

None. T-400-04 holds: every frontmatter write went through scripts/apply-job-sentences.cjs with slotErrors, and run-all-400 runs its --check. T-400-05: sentences are generic capability text with no room or user content.

## Gates (final, at dafe502b9)

- node tests/test-400-job-sentences.cjs: 5 passed, 0 failed.
- node tests/test-400-description-budget.cjs: 255 files, 3 passed, 0 failed.
- node tests/test-400-job-sentence-lib.cjs: 13 passed, 0 failed.
- bash tests/run-all-400.sh: exit 0, last line ">>> 400: run-all-399: PASSED".
- bash tests/run-all-399.sh: exit 0.
- node scripts/build-skill-mirrors.cjs --check: OK (112 mirrors; skip-list verified: trending-to-absurd).
- node scripts/build-command-registry.cjs --check: OK. node scripts/build-harness-manifest.cjs --check: OK.
- test-370-commands, test-361-command-contract, test-harness-manifest-check, test-341-registry-drift, test-341-slim-install-honest-degrade, test-364-registry-gates: exit 0.
- Acceptance one-liner: 73 registry rows with job_sentence (exit 0).
- No en dash or em dash in any file this plan changed.

## Self-Check: PASSED

- tests/test-400-job-sentences.cjs found on disk.
- Commits found: 4e0e42cab, f4e07fbef, eb1ce5e3a, 941f861ee, 308fd75b1, dafe502b9.
- No en dash or em dash in the SUMMARY.

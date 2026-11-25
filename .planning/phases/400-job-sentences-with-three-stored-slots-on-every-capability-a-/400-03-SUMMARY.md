---
phase: 400-job-sentences-with-three-stored-slots-on-every-capability-a-
plan: 03
subsystem: job-sentences
tags: [job-sentence, frontmatter, command-registry, skill-mirrors, agents, standalone-skills]

requires:
  - phase: 400-02
    provides: 73 run-step sentences, tests/test-400-job-sentences.cjs legs S0 to S4
provides:
  - provisional three-slot job sentences on all 113 commands, the 12 standalone skills and the 17 agents
  - tests/test-400-job-sentences.cjs legs S5 to S7 (S2 now covers 113 rows)
  - scripts/backfill-layer.cjs keeps the layer block before a trailing job-key run
affects: [400-04, 400-15, 401]

tech-stack:
  added: []
  patterns:
    - "A byte pin on a labelled file drops the 4 job lines before the compare; every other byte stays pinned"
    - "A generator that places its own block at the end of frontmatter places it before a trailing job-key run"

key-files:
  created:
    - .planning/phases/400-job-sentences-with-three-stored-slots-on-every-capability-a-/deferred-items.md
  modified:
    - commands/*.md (40 non-run-step commands, 4 lines each)
    - skills/*/SKILL.md (40 generated mirrors, 12 standalone skills, 4 lines each)
    - agents/*.md (17 agents, 4 lines each)
    - data/command-registry.json
    - data/harness-manifest.json
    - scripts/backfill-layer.cjs
    - tests/test-400-job-sentences.cjs
    - tests/test-400-job-sentence-lib.cjs
    - tests/test-363-runner-contract.cjs
    - tests/test-348-doctrine-present.cjs
    - tests/test-3696-skill-budget.cjs
    - tests/test-389-session-report.cjs

key-decisions:
  - "skills/trending-to-absurd/SKILL.md stays without job lines (coordinator ruling); S3 still asserts it is the only skipped run-step name"
  - "backfill-layer gets a placement fix instead of a regeneration: a regeneration moves layer lines in 14 files and breaks the 4-insertions-only rule for agents (T-400-06)"
  - "Sentences for operator and plumbing commands name the situation of the operator or maintainer in plain words"

patterns-established:
  - "Later phases that add frontmatter lines must check scripts/backfill-layer.cjs --check (end-of-frontmatter placement)"

requirements-completed: [JS-03]

duration: about 15 min of apply and test work after context load
completed: 2026-11-24
---

# Phase 400 Plan 03: Job sentences on every command, standalone skill and agent Summary

**All 113 commands, the 12 standalone skills and the 17 agents carry one provisional three-slot job sentence in their own frontmatter keys; the registry holds 113 non-null job_sentence rows; no description changed and every agent differs from c1e496ae8 by exactly the 4 job lines.**

## Performance

- **Completed:** 2026-11-24T09:53Z
- **Tasks:** 2 of 2
- **Files modified:** 135 (40 commands, 40 mirrors, 12 standalone skills, 17 agents, 2 data files, 1 script, 6 tests, plus deferred-items.md)

## Accomplishments

- Task 1: 40 command sentences written from the registry teaching and serves_jtbd lines (O-14), applied in one batch through `node scripts/apply-job-sentences.cjs --input`. Registry, mirrors and harness manifest regenerated. The input file was in os.tmpdir() and was deleted after the apply.
- Task 2: 12 skill and 17 agent sentences, grounded on each description and the first body lines, applied in one batch. No sentence names Larry, Theo or MindrianOS, also for larry-personality, larry-extended, brain-connector and brain-query.
- `node scripts/apply-job-sentences.cjs --check` prints "commands 113/113, skills 12/12, agents 17/17".
- `git diff c1e496ae8 --numstat -- agents/` gives 4 insertions and 0 deletions for each of the 17 files.
- tests/test-400-job-sentences.cjs: S2 now compares all 113 registry rows with the frontmatter. S5 (113 commands), S6 (12 standalone skills, enumerated from disk), S7 (17 agents, each equal to `git show c1e496ae8:<file>` after the 4 job lines are dropped). A shared style check runs in S5 to S7: at most 40 words, no product name, command name, digit or quote, no sentence equal to another across all 142 capabilities. RED at cb39e9fbf (S6 and S7 failed), GREEN at 4b1b9bab1.

## Task Commits

1. **Task 1: the 40 other commands** - c7effaad4 (feat)
2. **Task 2: legs S5 to S7** - cb39e9fbf (test, RED)
3. **Task 2: the 12 standalone skills and the 17 agents, pin and generator fixes** - 4b1b9bab1 (feat)

## The 69 provisional sentences (for 400-LABEL-REVIEW.md, plan 15)

The full text is in the frontmatter (job_when, job_want, job_so) of each file and, for commands, in data/command-registry.json (job_sentence). Every sentence carries status provisional. Deprecated aliases (heal, hmi-status, visualize, mos-deck-engine) describe the job of the surface they redirect to.

## Generator runs (Task 2 action)

- build-connector-registry --check: OK, no drift.
- build-orchestration-projection --check: OK, no drift.
- check-shape-declaration --check: exit 0, 55 advisory violations, the same count as the pre-commit hook printed at the Task 1 commit. All 55 are hitl_shape plus connector.excluded conflicts; the job keys do not take part in that rule.
- build-harness-manifest --check: STALE after Task 2, caused only by the new keys (digests of skills/larry-personality/SKILL.md and agents/larry-extended.md). Regenerated with the normal mode; data/harness-manifest.json is in commit 4b1b9bab1.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] scripts/backfill-layer.cjs --check reported 14 new drifted surfaces**
- **Found during:** Task 2 regression sweep (test-344-layer-backfill)
- **Issue:** with no body_shape: line, the generator puts the layer block at the end of the frontmatter. The job lines now sit before the closing ---, so --check wanted to move the layer lines in 12 agents and 4 skills. A regeneration would change agent files beyond the 4 lines and break S7 and the numstat acceptance.
- **Fix:** patchSurface places the layer block before a trailing run of job-key lines. --check is back to its 4 pre-existing surfaces (agents/larry-extended.md, commands/file-meeting.md, commands/setup.md, skills/file-meeting/SKILL.md).
- **Files modified:** scripts/backfill-layer.cjs
- **Commit:** 4b1b9bab1

**2. [Rule 3 - Blocking] 4 byte pins compared labelled files with their pre-400 bytes**
- test-348-doctrine-present (larry-personality frontmatter snapshot), test-3696-skill-budget S3 (same frontmatter), test-389-session-report Test 1 and Test 2 (session-report.md equals the old blob; the cited line). Each now drops the 4 job lines before the compare. Commit 4b1b9bab1.
- test-363-runner-contract K6: scheduled-tasks.md now also drops its job lines. K6 still fails for its pre-existing reason, as at 42d268d13. Commit c7effaad4.

**3. [Rule 1 - Bug] test-400-job-sentence-lib W5 asserted that the real repo is below its totals**
- That held only in plan 01. W5 now asserts that the real repo passes --require-all and prints the full counts. Commit 4b1b9bab1.

**4. Temporary input files**
- The plan names os.tmpdir(). The files were /tmp/batch-400-03-c.json and /tmp/batch-400-03-sa.json (os.tmpdir() is /tmp here). Both were deleted after the apply.

## Regression sweep

- 236 tests under tests/ and lib/ that name agents/, a standalone skill, the registry or the harness manifest ran in parallel; 47 exited non-zero. The same 47 ran at 42d268d13 (pre-plan) in a temporary detached worktree, removed after.
- 6 passed at base only. test-348, test-3696-skill-budget and test-400-job-sentence-lib W5 were real (fixed above). test-298-contract-parity, test-36925-naming N6 and test-3696-rubric-eval failed only on the uncommitted working tree; all 3 exit 0 after the commit.
- For the 41 that fail at both, the FAIL lines were compared. Differences: test-344-layer-backfill (fixed above), test-389-session-report Test 1 and Test 2 (fixed above), test-3696-isolation B5f and test-mux-card-before-answer H7 (parallel load only; serial runs equal base).

## Deferred Issues

See deferred-items.md in this phase directory.
- 65 command frontmatter comments carry `first delivery at commands/<name>.md:<line>` pointers. The job lines of plans 02 and 03 shift each cited line by 4. Not fixed here.
- Host frontmatter end (400.1 F1, Phase 401): in 27 of the 29 Task 2 files, the job lines sit after a `# ---` comment line inside frontmatter. No new `---` line was added.
- Pre-existing and unchanged: test-363 K6 and K8, test-344 (4 surfaces), test-389-retire-brief Test 6 and test-389-session-report Test 5 (the old-name lists).

## Known Stubs

None.

## Threat Flags

None. T-400-06 holds: S7 proves each agent changed by exactly the 4 lines; model, tools and description are byte-identical. T-400-07 holds: test-400-description-budget is green in run-all-400.

## Gates (final, at 4b1b9bab1)

- node tests/test-400-job-sentences.cjs: 8 passed, 0 failed (S0 to S7).
- node tests/test-400-job-sentence-lib.cjs: exit 0. node tests/test-400-description-budget.cjs: 255 files, 3 passed, 0 failed.
- bash tests/run-all-400.sh: exit 0, last line ">>> 400: run-all-399: PASSED".
- bash tests/run-all-399.sh: exit 0.
- node scripts/build-skill-mirrors.cjs --check: OK (112 mirrors; skip-list verified: trending-to-absurd).
- node scripts/build-command-registry.cjs --check, build-connector-registry --check, build-orchestration-projection --check, build-harness-manifest --check: OK.
- Acceptance one-liner: every registry row has job_sentence (exit 0).
- No en dash or em dash in any file this plan changed.

## Self-Check: PASSED

- Files found on disk: tests/test-400-job-sentences.cjs, scripts/backfill-layer.cjs, deferred-items.md, this SUMMARY.
- Commits found: c7effaad4, cb39e9fbf, 4b1b9bab1.

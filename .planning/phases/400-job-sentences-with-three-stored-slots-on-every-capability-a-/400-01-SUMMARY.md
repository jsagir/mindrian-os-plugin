---
phase: 400-job-sentences-with-three-stored-slots-on-every-capability-a-
plan: 01
subsystem: job-sentences
tags: [job-sentence, frontmatter, command-registry, description-budget, test-runner]

requires:
  - phase: 399
    provides: data/job-vocabulary.json (20 ids), scripts/apply-job-labels.cjs writer precedent, tests/run-all-399.sh
provides:
  - lib/core/job-sentence.cjs (SLOT_KEYS, FRONTMATTER_KEYS, SENTENCE_STATUSES, renderJob, parseJob, slotErrors, slotsFromFrontmatter, frameworkSlots, frameworkSentences)
  - scripts/apply-job-sentences.cjs (--input, --check, --check --require-all; seam MINDRIAN_APPLY_ROOT)
  - registry field job_sentence on every data/command-registry.json row (null in this plan)
  - 20 provisional three-slot vocabulary sentences
  - description budget guard pinned at base c1e496ae8 (255 files, 22655 bytes)
  - tests/run-all-400.sh phase aggregator
affects: [400-02, 400-03, 400-04, 400-15]

tech-stack:
  added: []
  patterns:
    - "Slots are the stored truth; the sentence is a pure render (Pattern 1)"
    - "Anchored parse on the first ', I want ' and the last ', so I can '"
    - "One validated batch writer; one bad entry refuses the whole batch before any write"

key-files:
  created:
    - lib/core/job-sentence.cjs
    - scripts/apply-job-sentences.cjs
    - tests/test-400-job-sentence-lib.cjs
    - tests/test-400-description-budget.cjs
    - tests/test-400-job-vocabulary-sentences.cjs
    - tests/fixtures/400/description-bytes-baseline.json
    - tests/run-all-400.sh
  modified:
    - data/job-vocabulary.json
    - scripts/build-command-registry.cjs
    - data/command-registry.json
    - data/harness-manifest.json
    - tests/test-361-command-contract.cjs

key-decisions:
  - "slotErrors reads 'begins with so' and 'begins with when' as whole words (/^so\\b/i, /^when\\b/i), so a so slot such as 'solve the problem' stays valid"
  - "slotErrors also refuses a slot with leading or trailing space, so the frontmatter round trip stays exact"
  - "The registry prints the stderr warning only when a command has some job key but a partial or invalid set; a command with no job key gets null silently"
  - "apply-job-sentences accepts an optional status (provisional or ruled), default provisional, and refuses a name with a path character"

patterns-established:
  - "Later plans append to the test loop and the drift-check loop of tests/run-all-400.sh only"
  - "Do not run test-400-description-budget.cjs --write-baseline again"

requirements-completed: [JS-01, JS-05, JS-06, PG-01]

duration: 25min
completed: 2026-11-24
---

# Phase 400 Plan 01: Job-sentence foundation Summary

**One pure three-slot job-sentence module (validator, O-01 render, anchored parse, 184-statement framework view), one validated frontmatter writer with a drift check, a null job_sentence field on all 113 registry rows, 20 provisional vocabulary sentences, a description byte budget pinned at c1e496ae8, and the phase-400 runner.**

## Performance

- **Duration:** about 25 min
- **Started:** 2026-11-24T07:25Z (approximate)
- **Completed:** 2026-11-24T07:55Z
- **Tasks:** 3 of 3
- **Files modified:** 12

## Accomplishments

- lib/core/job-sentence.cjs: pure CJS (node:fs, node:path only; no env read, no network). renderJob, parseJob, slotErrors, slotsFromFrontmatter, frameworkSlots, frameworkSentences. frameworkSentences returns 184 of 184 ruled main statements of data/framework-jobs.json with three non-empty slots; the file is read, not edited.
- data/job-vocabulary.json: each of the 20 jobs gains sentence, slots and sentence_status "provisional" after origins; top-level _sentence_note after _note. summary, summary_source, origins, ids, schema and _note stay byte-identical to c1e496ae8 (J3, J4). The sentences are fresh from repo text (O-14); the research drafts were not opened.
- scripts/apply-job-sentences.cjs: writes job_when, job_want, job_so, job_sentence_status as double-quoted lines right after a single serves_jtbd: line, else before the closing ---. A second apply replaces the lines in place. Mirrored skills are refused ("mirrored skill: write the command"). --check prints "apply-job-sentences --check: commands 0/113, skills 0/12, agents 0/17".
- scripts/build-command-registry.cjs: job_sentence after jtbd_summary; data/command-registry.json regenerated; every row is null.
- tests/test-400-description-budget.cjs and its fixture: 255 files (113 commands, 125 skills, 17 agents), total 22655 bytes at c1e496ae8. B2 finds no ", I want " or "so I can" in any description.
- tests/run-all-400.sh: 3 tests, 1 drift check (apply-job-sentences.cjs --check), then bash tests/run-all-399.sh.

## Task Commits

1. **Task 1: module, budget guard, runner** - ddf34f84d (test, RED), 97fe3b704 (feat), 35afa6d58 (fix: dash characters as escapes)
2. **Task 2: vocabulary sentences** - 104200f66 (test, RED), 6ba9d4952 (feat)
3. **Task 3: writer and registry field** - a8b7eea08 (test, RED), 488c954fd (feat)

## The 20 provisional sentences (for 400-LABEL-REVIEW.md, plan 15)

All 20 carry sentence_status provisional. The four section-only jobs (design-solution, model-business, model-finances, protect-assets) and the three ids with no research draft (build, navigate, temporal-correction) got sentences like every other id. The full text is in data/job-vocabulary.json.

## Registry-reading tests, before and after the regeneration (Task 3 action)

`grep -l "command-registry.json" tests/*.cjs` lists 88 tests.

- Before the regeneration: 71 exit 0, 17 exit 1. The 17: test-237-autonomy-parity, test-344-layer-backfill, test-356-answer-key, test-356-ledger-build, test-363-command-contract, test-363-runner-contract, test-365-never-do-gate, test-369.26-palette-sync, test-369.26-registry-sync, test-36925-next-move, test-389-retire-brief, test-389-retire-option, test-389-session-report, test-395-job-orders, test-395-job-shown, test-btm-theo-is-the-brain, and test-400-job-sentence-lib (RED by design).
- After the regeneration, before the fixes: 5 tests went from 0 to 1 (test-341-registry-drift, test-341-slim-install-honest-degrade, test-361-command-contract, test-364-registry-gates, test-harness-manifest-check). Root causes and fixes are in Deviations.
- After the fixes and the commit: 72 exit 0, 16 exit non-zero. Every test that passed before passes after. test-400-job-sentence-lib went from 1 to 0. The 16 non-zero tests are the 16 pre-existing failures above; 4 of them (test-356-ledger-build, test-369.26-palette-sync, test-389-retire-brief, test-389-session-report) hit a 200 s timeout under machine load in the final pass instead of exit 1. 5 tests that also hit the timeout (test-399-adapter, test-395-offer-is-primary, test-395-truth-and-cost, test-36925-brief, test-36925-room-read) were run again without load and exit 0.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] data/harness-manifest.json holds a digest of data/command-registry.json**
- **Found during:** Task 3
- **Issue:** the registry regeneration moved the registry sha256; the committed harness manifest went STALE. test-341-registry-drift arms 5 and 6, test-364-registry-gates G1 and test-harness-manifest-check tests 2 and 5 failed.
- **Fix:** regenerated with `node scripts/build-harness-manifest.cjs` (one digest line changed).
- **Files modified:** data/harness-manifest.json
- **Commit:** 488c954fd

**2. [Rule 3 - Blocking] tests/test-361-command-contract.cjs pins the full registry row key set**
- **Found during:** Task 3
- **Issue:** leg 19 compared the /mos:dominant-designs row keys to the Phase 361 pre-phase fixture; the additive job_sentence key broke it.
- **Fix:** the leg now ignores a named list of later-phase additive keys (LATER_PHASE_KEYS = ['job_sentence']); every Phase 361 key stays pinned. The fixture is unchanged.
- **Files modified:** tests/test-361-command-contract.cjs
- **Commit:** 488c954fd

**3. [Rule 1 - Bug] Literal dash characters in the validator and its test**
- **Found during:** Task 1 (post-commit dash scan)
- **Issue:** the tool wrote the U+2013 and U+2014 characters literally inside the regex and the test strings; the phase rule forbids them in any file.
- **Fix:** replaced with JavaScript unicode escapes for code points 2013 and 2014; behavior unchanged (L3 passes).
- **Commit:** 35afa6d58

Note: test-341-slim-install-honest-degrade failed only while data/command-registry.json had an uncommitted diff (it requires zero diff from HEAD); it passes after commit 488c954fd.

## Interpretations

- L3 "a so slot that begins with so": implemented as the whole word "so" (/^so\b/i). A prefix rule would refuse the verbs "solve" and "sort". Same rule for "when" and "I can".
- R1: the test leg is forward-compatible (a non-null job_sentence must have keys when, want, so, status and valid slots). The "every entry is null in this plan" condition is the acceptance one-liner, which passes.

## Known Stubs

None. job_sentence is null on every row by design in this plan; plans 400-02 to 400-04 fill the frontmatter keys.

## Threat Flags

None. The writer reads only a local JSON input file and writes only files under commands/, skills/ and agents/ of the root; names with path characters are refused (T-400-01).

## Next Phase Readiness

- Plans 400-02 to 400-04 write slots only through `node scripts/apply-job-sentences.cjs --input <file>`, then regenerate the registry and the skill mirrors, then run `node scripts/build-harness-manifest.cjs` because the registry digest moves again.
- A later plan that adds a registry row key must also extend LATER_PHASE_KEYS in tests/test-361-command-contract.cjs.

## Gates (final)

- node tests/test-400-job-sentence-lib.cjs: 13 passed, 0 failed.
- node tests/test-400-description-budget.cjs: 255 files, 3 passed, 0 failed.
- node tests/test-400-job-vocabulary-sentences.cjs: 5 passed, 0 failed.
- bash tests/run-all-399.sh: exit 0.
- bash tests/run-all-400.sh: exit 0, last line ">>> 400: run-all-399: PASSED".
- node scripts/build-skill-mirrors.cjs --check: OK (112 mirrors).
- node scripts/build-orchestration-projection.cjs --check: OK. node scripts/build-command-registry.cjs --check: OK.
- Acceptance one-liners: every registry row has job_sentence null (exit 0); every vocabulary job is provisional (exit 0); job-sentence.cjs holds 0 env or http reads.

## Self-Check: PASSED

- 7 created files found on disk.
- Commits found: ddf34f84d, 97fe3b704, 35afa6d58, 104200f66, 6ba9d4952, a8b7eea08, 488c954fd.
- No en dash or em dash in any file of this plan.

---
phase: 385
plan: 15
subsystem: cleanup
tags: [pinecone, dead-module, R6-step-1]
requirements-completed: [CLEAN385-05]
key-files:
  deleted: [lib/core/pinecone-inference.cjs, tests/272-pinecone-inference.test.cjs]
  modified: [tests/run-all-272.sh, tests/run-all-296.sh, tests/296-pinecone-residue.sh, lib/core/rs_cache.py]
  created: [tests/test-385-pinecone-inference-removed.cjs]
completed: 2026-11-06
---

# Phase 385 Plan 15: Remove lib/core/pinecone-inference.cjs (R6 step 1 only) Summary

The dead Phase 272 module, its test, its runner exemption and its two pinned assertions are removed. Owner statement of 2026-11-06 (we are not using pinecone in the mos build) overrides Phase 296 D-06 for this module only. Steps 2 and 3 of R6 are untouched.

## Commit

- 6abdba40c chore(385-15): remove dead module lib/core/pinecone-inference.cjs (owner ruling R6 step 1) (7 paths). Revert: `git revert 6abdba40c`.

## Caller proof (re-run at HEAD ead460715)

No production file requires or names the module. Remaining names were: rs_cache.py line 16 (docstring), the 272 test, run-all-272.sh, run-all-296.sh (comment), 296-pinecone-residue.sh. Same as the planner result. No new caller.

## RED

Three behaviours failed before the change (removal, production names, test references). The characterization, bridge and step 3 behaviours passed. All six pass after.

## Baselines and results

- run-all-272: PASS=14 FAIL=1 before (leg 272-cache-probe); PASS=13 FAIL=1 after (same leg; the pinecone test leg is gone).
- run-all-296 PASS=9 FAIL=0 before and after. 296-pinecone-residue PASS. 296-no-pinecone-internal rc 0. test-211-embedding-spine 5 passed. test-rs-pinecone-bridge 4/4. test-rs-differential-scorer 10/10. Generators --check OK.
- rs_cache.py: `ast.dump` equal before and after with the module docstring removed from both (True).
- Never-touch grep on the commit paths prints 0. `git grep pinecone-inference` over lib, scripts, bin, hooks, commands, skills, agents, pipelines, data prints nothing.
- doctor --acceptance: not run. UNVERIFIED.

## Judgement call for the owner

Phase 296 D-06 called the module load-bearing. At run time it had 0 callers. P3 and P5 pinned a file nothing used. A revert restores it in one step.

## Deviations

None.

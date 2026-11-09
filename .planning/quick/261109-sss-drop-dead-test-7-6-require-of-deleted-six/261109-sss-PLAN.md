---
quick_id: 261109-sss
date: 2026-11-09
status: planned
---

# Quick 261109-sss Plan

Goal: make leg "366 semantic index integrity" green again (I3, check-require-integrity exit 0).

Cause to confirm: `scripts/check-require-integrity.cjs` reports 1 unresolved reference of 8867: `tests/test-389-seed-structure.cjs -> lib/agents/mva/six-hats-red-black.cjs`. Plan 389-10 (commit e44e97b37) deleted that file. Test 7.6 still holds `require(oldCell)` behind `fs.existsSync`, where `oldCell = path.join(ROOT, ...)`. The checker rule R2 counts that static path as a reference. It does not treat `existsSync` as a guard.

Tasks:
1. Run the checker and the 366 test (RED).
2. Remove the Test 7.6 block. Keep the numbering. Leave one comment line that says plan 389-10 deleted the old cell file and tests 7.4 and 7.5 pin the text.
3. Run the checker, the 366 test, the 389 structure test and `run-all-389` (GREEN).

Choice: remove 7.6 with its check line. The block was skipped on every run since 389-10, so the pass count does not change (91). No check line claims coverage that does not run.

Limits: no push, tag, bump or release. No change to STATE.md, ROADMAP.md, REQUIREMENTS.md, CHANGELOG.md. Do not run `run-all-366.sh`.

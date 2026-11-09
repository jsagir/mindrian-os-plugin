---
quick_id: 261109-sss
date: 2026-11-09
status: done
---

# Quick 261109-sss Summary

Test 7.6 of `tests/test-389-seed-structure.cjs` is removed. The reference-integrity checker is green again, and leg "366 semantic index integrity" passes 12 of 12.

## Confirmed root cause

PROVEN. `scripts/check-require-integrity.cjs` rule R2 counts `require(NAME)` where `const NAME = path.join(BASE, '<seg>', ...)` and BASE is `__dirname`-relative. Test 7.6 had `const oldCell = path.join(ROOT, 'lib/agents/mva/six-hats-red-black.cjs')` and `require(oldCell)` inside `if (fs.existsSync(oldCell))`. The checker header exempts a path.join used only to read, write or test for a file, but not a path that also feeds `require`. Plan 389-10 (commit e44e97b37) deleted the target, so the one reference failed (1 unresolved of 8867). The mention on line 31 is a comment; the checker masks comments and does not count it.

## Change

- `tests/test-389-seed-structure.cjs`: the Test 7.6 block (6 lines) replaced by 1 comment line. Numbering kept (7.5 then 7.7).
- Choice: remove 7.6 with its check line. The block had been skipped on every run since 389-10, so the pass count stays 91. Tests 7.4 and 7.5 pin the prompt headings and the twelve red and twelve black lines in the reference list.

## Results (env -u MINDRIAN_EUREKA_ROOT, scratch HOME, MINDRIAN_BRAIN_URL=http://127.0.0.1:9)

- RED, before: checker exit 1 (1 unresolved: the path above). `test-366-semantic-index-integrity.cjs` PASS: 11 FAIL: 1.
- GREEN, after: checker exit 0 (3437 files, 8866 references resolve, 466 unchecked dynamic). `test-366-semantic-index-integrity.cjs` PASS: 12 FAIL: 0. `test-389-seed-structure.cjs` 91 passed, 0 failed (same as before). `run-all-389.sh` PASS=16 FAIL=0 SKIPPED=0.
- `run-all-366.sh` was not run (the main session runs it).
- ASCII check on added lines: no non-ASCII character.

## Deviations

None.

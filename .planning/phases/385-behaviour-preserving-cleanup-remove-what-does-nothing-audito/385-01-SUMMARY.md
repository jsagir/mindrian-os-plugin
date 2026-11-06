---
phase: 385
plan: 01
subsystem: packaging
tags: [cleanup, bytecode, untrack]
requirements-completed: [CLEAN385-03]
key-files:
  created: [tests/test-385-no-tracked-bytecode.cjs]
  deleted: [scripts/__pycache__/compute-hsi.cpython-312.pyc, scripts/__pycache__/detect-reverse-salients.cpython-312.pyc]
completed: 2026-11-06
---

# Phase 385 Plan 01: Untrack committed Python bytecode Summary

Two tracked .pyc build files left git; the Python sources stay tracked and unchanged.

## Commit

- 4ad4beb6b chore(385-01): untrack committed python bytecode (3 paths: the 2 .pyc files and the new test).
- Revert note: `git revert 4ad4beb6b` restores both files. Python rebuilds the cache on demand, so a revert is harmless.

## Caller proof (re-run at HEAD 34dcb57d0)

- `git ls-files | grep -E '__pycache__|\.pyc$'` printed exactly the 2 files.
- `.gitignore:85:__pycache__/` exists; tracked files bypass it.
- Remaining hits for `__pycache__` or `.pyc` are skip lists (check-worktree-hygiene.cjs, test-341 tests), one grep filter (scripts/verify-release:590) and one old backlog note (docs/BACKEND-MAP.md:330). No file reads a tracked .pyc.

## RED evidence

```
FAIL no tracked path under __pycache__ or ending .pyc/.pyo: 2 tracked bytecode path(s): scripts/__pycache__/compute-hsi.cpython-312.pyc, scripts/__pycache__/detect-reverse-salients.cpython-312.pyc
ok   python sources stay tracked
exit 1
```

## Baselines (recorded before the change)

- test-341-install-sh-retired: PASS=7 FAIL=0. test-341-update-collapsed: PASS=8 FAIL=0. tests/296-pinecone-residue.sh: PASS.
- `bash tests/run-all-341.sh`: PASS=31 FAIL=4 (pre-existing: 310 leg 3 tripwire, run-all-310.sh, retired-classes-a-h, retired-topology-halves, release.sh step-block tripwire).
- `node scripts/doctor.cjs --acceptance`: 24/25, only `verify-release-clean-tree` failing (peer paths in the shared tree).

## Verify after the change

- New test: exit 0 (both legs ok).
- The 3 related baseline checks: unchanged (7, 8, PASS).
- `git ls-files | grep -Ec '__pycache__|\.pyc$'`: 0.
- `connector-registry: OK`, `orchestration-projection: OK`.
- Never-touch guard on HEAD: 0 matches.
- run-all-341 and doctor re-run: deferred to one run at the end of Wave 1 (coordinator ruling: long suites run once).

## Deviations

None. The first attempt was blocked by peer-staged paths in the shared index (guard fail, NEEDS_HUMAN returned); the commit landed after the index cleared.

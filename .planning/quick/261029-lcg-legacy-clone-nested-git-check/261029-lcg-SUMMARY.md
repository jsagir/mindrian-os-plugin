---
quick_id: 261029-lcg
slug: legacy-clone-nested-git-check
status: complete
branch: fix/legacy-clone-nested-git-check
requires: [341-07]
---

# Quick 261029-lcg: legacy clone check uses the directory's own git root

Claim marks: PROVEN = seen in a command result in this run.

## Result

- `legacyDirtyOrUnpushed` now returns `{dirty:false, reason:null}` when the legacy directory has no git root of its own. New helper `hasOwnGitRoot(dir)` in lib/core/doctor/shared.cjs: true when `dir/.git` exists, or `git rev-parse --show-toplevel` resolves (realpath) to `dir`. `isLegacyDevClone` is unchanged.
- A real clone that is dirty, unpushed or has no upstream is still refused. PROVEN by test arms B, C, C2, E2.
- The migrator gains `repointLegacySymlinks` (exported). Dry run lists `symlinks.planned`. Apply writes the manifest first, then repoints or removes, after the verified backup and removal. A symlink error does not undo the removal; it is reported in the detail.
- PROVEN: a dry run of the migrator on the real HOME now reports `dry-run` (exit 0) with 70 planned symlink changes (68 repoint to cache 2.0.0-beta.75, 2 remove: commands/mos/query.md and commands/mos/reason.md). Nothing was changed on the real HOME.

## Tests

- tests/test-261029-lcg-legacy-clone-nested-git.cjs: 17 arms. Before the fix 10 failed (A1, A2, A3, D, E1, F1-F5). After the fix 17 pass.
- tests/run-all-261029-lcg.sh: new test, 341 teardown, install-state migration, dash fence.

## Deviations

None. Extra arms beyond the plan: A3 (outer repo clean, only an unpushed commit), C2 (no upstream), F3-F5.

## Open

- `~/.claude/skills` links that point into the legacy directory: none exist today. The scan covers them but no arm uses a skills link with a directory target.
- `isLegacyDevClone` still runs `git remote get-url origin` through a walk-up. It was out of scope and returned false on the real HOME.

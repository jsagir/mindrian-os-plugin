---
quick_id: 261029-lcg
slug: legacy-clone-nested-git-check
status: executed
branch: fix/legacy-clone-nested-git-check
base: origin/main 8860d72ef
---

# Quick 261029-lcg: the legacy install check borrows the HOME repo state

## Root cause (PROVEN)

`legacyDirtyOrUnpushed` in lib/core/doctor/shared.cjs runs `git -C <legacyDir> status --porcelain` and `git -C <legacyDir> log @{u}..HEAD`. It never checks that the legacy directory owns a git root. `~/.claude/plugins/mindrian-os` has no `.git`. Git walks up to the HOME repository (`/home/jsagi`, 65 unpushed commits). The install-state doctor point (lib/core/doctor/install-state-module.cjs) and the migrator (scripts/migrate-legacy-install-location.cjs) then refuse for a reason that is not about the legacy directory.

## Tasks

1. Write the failing tests first: tests/test-261029-lcg-legacy-clone-nested-git.cjs and tests/run-all-261029-lcg.sh. Confirm they fail before the fix.
2. shared.cjs: add `hasOwnGitRoot(dir)`. `legacyDirtyOrUnpushed` returns `{dirty:false, reason:null}` first when it is false. `isLegacyDevClone` is unchanged. A real clone that is dirty or unpushed is still refused.
3. Migrator: add `repointLegacySymlinks(root, legacyDir, cacheRoot, apply)`. Scan top-level symlinks in `~/.claude/agents`, `~/.claude/commands/mos`, `~/.claude/skills`. Match on the readlink target inside the legacy directory (no realpath). Repoint when the same relative file exists in the active cache install, else remove. Dry run reports `symlinks.planned` only. Apply writes `~/.mindrian/legacy-symlink-manifest-<ISO>.json` before any change and runs after the verified backup and removal.
4. Run the existing teardown, install-state, doc-parity and contract-parity tests plus the new run-all.

## Limits

No migrator `--apply` and no `doctor --fix` against the real `~/.claude`. No push. No release.

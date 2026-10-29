---
quick_id: 261024-vdz
slug: anchor-rs-experts-script-path
date: 2026-10-24
tree: /home/jsagi/dev/MindrianOS-Plugin-release
---

# Quick 261024-vdz: anchor the rs-experts script path

## Goal

Release gate `scripts/verify-release` step 10f fails. One plugin-relative `scripts/` invocation is not anchored.
The checker `node scripts/check-plugin-path-anchoring.cjs --check-scripts --json` reports `commands/rs-experts.md` line 85, token `scripts/rs-experts-command.cjs`, anchored false, allowlisted false.
The line arrived with squash commit 6bc8cfc55 (Eureka and RS).

## Tasks

1. Prefix the script path in `commands/rs-experts.md` with `${CLAUDE_PLUGIN_ROOT}/`, in the quoted form that `commands/eureka.md` uses.
2. Do not use the ALLOWLIST.
3. Run `node scripts/build-skill-mirrors.cjs`, then `--check`. Commit the changed mirror.
4. Run the checker (exit 0 required) and `bash scripts/verify-release` (0 failed required).
5. Run the rs-experts tests that finish in under 60 seconds.
6. Commit with `git commit --only` on explicit paths.

## Limits

No push. No tag. No release.sh. No stash. No state.* handlers.

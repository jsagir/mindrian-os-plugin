---
quick_id: 261001-rdv
status: complete
date: 2026-10-01
---

# Quick Task 261001-rdv: rebuild out-of-date dist bundles - Summary

## Decision

Rebuilding at dev time is correct. dist/ is tracked, release.sh never regenerates it, and
--check-stale compares against the live plugin.json placeholder version (2.0.0-beta.52), so
the stamp is supposed to carry the placeholder. Same pattern as 48675a655 (beta.34 placeholder).

## Done

- `node scripts/build-dist-bundles.cjs`: 126 skills to dist/generic-claude-dir and dist/zed,
  stamp 2.0.0-beta.36 -> 2.0.0-beta.52, catalog 13240 -> 13357 bytes (26% of Zed budget).
- 239 tracked dist files changed (skill content drift since beta.36), no new or untracked files,
  no absolute home path in any tracked output (.mcp.json stays gitignored).

## Verification

- `node scripts/build-dist-bundles.cjs --check-stale`: stale=false.
- `bash tests/run-all-339.sh`: PASS=16 FAIL=0 (was PASS=15 FAIL=1).
- `node scripts/build-skill-mirrors.cjs --check`: exit 0.
- `bash tests/run-all-234.sh`: PASS=9 FAIL=2; test-234-dist-bundle PASSED. The two reds
  (free-core-network-scan on lib/mcp/tools/identity.cjs + sensors.cjs; plugin-root-migrated
  mirror-equality assertion) reproduce identically on a clean HEAD worktree: pre-existing,
  unrelated to dist.

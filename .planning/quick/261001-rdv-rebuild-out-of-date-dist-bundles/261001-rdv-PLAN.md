---
quick_id: 261001-rdv
type: quick
autonomous: true
files_modified:
  - dist/**
---

# Quick Task 261001-rdv: rebuild out-of-date dist bundles

## Why

`bash tests/run-all-339.sh` carries one red: `build-dist-bundles.cjs --check-stale` reports the
bundle stamp at 2.0.0-beta.36 while `.claude-plugin/plugin.json` reads 2.0.0-beta.52.

## Is rebuilding now correct? (decided before any edit)

- dist/ is tracked in git (everything except the gitignored dist/generic-claude-dir/.mcp.json).
- `scripts/release.sh` never calls build-dist-bundles.cjs, and docs/RELEASE-CEREMONY-RULING-SYSTEM.md
  names no dist step. run-all-339.sh says outright that it is the ONLY gate that runs --check-stale.
  So the rebuild is not owned by the release ceremony; a dev-time rebuild is the only path.
- `--check-stale` compares against the live plugin.json version (the post-release placeholder,
  beta.52), not the last tag (beta.51). Stamping beta.52 is what the check demands.
- Precedent: 48675a655 "regenerate bundles for the 2.0.0-beta.34 placeholder", plus 941c44f3d,
  b4c45bd4e, 0604ae7bb: dev-time regenerations to the placeholder version are the established pattern.

## Task 1

- action: `node scripts/build-dist-bundles.cjs`
- verify: `node scripts/build-dist-bundles.cjs --check-stale` exits 0; `bash tests/run-all-339.sh`
  PASS=16 FAIL=0; `git status --short` shows only dist/ outputs changed by this task.
- done: commit only dist/ outputs + this quick dir, via `git commit --only`.

---
quick: 261109-fnm
type: chore
---

# Quick 261109-fnm: commit the refreshed data/framework-names.json snapshot

## Task 1 (chore)

The release ceremony Theo bridge ran for 2.0.0-beta.84 at HEAD aa9a38f13. The verify line printed exit 0 and "canon reads command-registry@2.0.0-beta.84". Run `node scripts/refresh-framework-names.cjs --live`. Then sync the workspace-mod asset copy with `node ui/mindrian-workspace-mod/scripts/sync-assets.cjs`. Commit the two changed files.

Limits: change no other tracked file. Do not touch STATE.md, ROADMAP.md, REQUIREMENTS.md or CHANGELOG.md. No push, tag, version bump or release. No em-dashes.

Verify: the diff touches only data/framework-names.json and ui/mindrian-workspace-mod/assets/framework-names.json. The diff changes only snapshot_date and the theo_stamp fields. `refresh-framework-names.cjs --check` passes. `sync-assets.cjs --check` reports all equal. The snapshot tests pass.

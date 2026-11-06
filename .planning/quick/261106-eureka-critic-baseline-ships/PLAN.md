---
quick_id: 261106-eureka-critic-baseline-ships
type: quick
files_modified:
  - package.json
  - tests/test-quick-261106-critic-baseline-ships.cjs
  - tests/test-387-eureka-installed-layout.cjs
---

# Quick 261106: ship the eureka_critic baseline file

## Goal

Make the MCP tool eureka_critic work on an installed copy. It needs no engine, but it reads
evals/eureka/212-critic-baseline.json at call time (lib/core/eureka-critic.cjs, BASELINE_PATH).
package.json "files" had no entry for that file, so every installed copy failed with ENOENT.
Source: plan 387-01 observations and .planning/debug/eureka-engine-unreachable-on-normal-install.md.

## Tasks

1. RED: add tests/test-quick-261106-critic-baseline-ships.cjs. It runs `npm pack --dry-run --json`
   (offline) and asserts the payload holds the baseline file and no other file under evals/.
   It must fail before the change.
2. Fix: add that one file to package.json "files". No version or dependency change.
3. Narrow the 387-01 installed-layout pin so eureka_critic must answer a ruling (not ENOENT).
4. Run the pack-related suites before and after.

## Limits

- One file only, not the evals folder.
- No edit to STATE.md, ROADMAP.md, REQUIREMENTS.md, CHANGELOG.md. No push.
- Synthetic input only (Canon Part 8).

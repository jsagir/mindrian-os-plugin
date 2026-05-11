---
quick_id: 260511-wdm
slug: beta10-pkg-rename
date: 2026-05-11
type: quick
---

# Quick Task 260511-wdm: Cut v1.13.0-beta.10 with npm package rename

## Why

The `@mindrian` npm scope does not exist (`{"error":"Scope not found"}`), so `@mindrian/os` (the name beta.1..beta.9 carried) can never be published. The maintainer created the `@mindrian_os` org on npm on 2026-05-11. beta.10 = a re-cut of the beta.9 content under the corrected package name `@mindrian_os/cli`.

## Tasks

1. **Rename + bump.** `package.json` `name` -> `@mindrian_os/cli`, `version` -> `1.13.0-beta.10`; `.claude-plugin/plugin.json` `version` -> `1.13.0-beta.10`. Forward-looking `@mindrian/os` references swapped to `@mindrian_os/cli` in `scripts/release.sh`, `docs/install/PACKAGING-PATHS.md`, `tests/manual/95.6-windows-cold-install-acceptance.md`, `tests/test-release-npm-gate.sh`. Historical records (autopsy narrative, FEEDBACK.md, the UI-UX-CONVERGENCE doc, the `[1.13.0-beta.9]` CHANGELOG entry) left as-is. Atomic commit. (`bin` field `{"mindrian-os":"bin/cli.js"}` unchanged -- that is the CLI command name, not the package name.)
2. **CHANGELOG `[1.13.0-beta.10]` entry** at the top: Changed (the rename) + Notes (re-cut of beta.9 content; Windows cold-install gate still waived; install paths live). No em-dashes. Atomic commit.
3. **Tag `v1.13.0-beta.10`.** No push, no npm publish here -- the orchestrator handles `git push origin main --tags`, the `~/mindrian-marketplace` ref pin, and `npm publish --access public --tag next` afterward.

## Gate

`bash tests/run-all-956.sh` -> 8/8 green (verified before and after).

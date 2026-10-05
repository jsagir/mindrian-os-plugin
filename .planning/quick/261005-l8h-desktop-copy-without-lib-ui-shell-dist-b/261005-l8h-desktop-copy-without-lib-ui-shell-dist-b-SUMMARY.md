---
phase: quick
plan: 261005-l8h
subsystem: release-lockstep
tags: [desktop-copy, marketplace, lib-ui-shell-dist, bad-path-chars, J1]
requires: [261005-kvv]
provides:
  - "Desktop copy built without lib/ui-shell/dist; payload gate refuses ui-shell-dist and bad-path-char"
  - "mindrian-marketplace beta.57 catalog hotfixed (2a9f217), pushed"
key-files:
  modified:
    - scripts/release-lib/build-desktop-artifact.cjs
    - scripts/release-lib/desktop-copy-gate.sh
    - scripts/release.sh
    - lib/ui-shell/launch.cjs
    - tests/test-369.1-desktop-artifact.cjs
    - docs/RELEASE-CEREMONY-RULING-SYSTEM.md
    - CHANGELOG.md
key-decisions:
  - "DESKTOP_DROPS = [bin, lib/ui-shell/dist] drives both the build and the docs; the gate force-add is replaced by an inverse guard"
  - "Launcher keeps exit 1 and its pinned leading sentence (tests/test-369-launch-surface.cjs arm 1i); the plan's exit 2 was not taken"
duration: ~1h
completed: 2026-10-05
---

# Quick 261005-l8h: the Desktop copy without the workspace build

The Desktop copy no longer carries `lib/ui-shell/dist`, the payload gate refuses that path and any path segment outside `[A-Za-z0-9._-]`, and the marketplace beta.57 catalog is hotfixed and pushed.

## Commits

Plugin repo (all in `/home/jsagi/dev/MindrianOS-Plugin`):

- `4cf8b61a6` test: RED legs D1-D6 (D1-D5 red on HEAD, D6 dash guard green by design; measured 3 PASS 5 FAIL including two safety lines)
- `f01173a32` fix: GREEN (builder, gate, release.sh, launcher, docs, CHANGELOG, the equality arm updated to "minus the Desktop drops")

Marketplace repo (`/home/jsagi/dev/mindrian-marketplace`, master):

- HEAD before: `f58ec49` (tree clean, origin/master equal). HEAD after: `2a9f217`, pushed (`f58ec49..2a9f217  master -> master`), origin/master confirmed `2a9f217`.

## Measured numbers

| Measure | Before | After |
|---|---|---|
| Desktop copy bad paths (outside `[A-Za-z0-9._/-]`) | 53 | 0 |
| Desktop copy paths (`find`) | 2567 | 2253 (314 dist paths removed) |
| Tracked files under `plugins/mos-desktop` | 2259 | 1988 (271 dist files removed) |
| Fresh builder output (beta.58 source) | n/a | 1998 files, 33,122,400 bytes, maxRatio 18.2 |

- `claude plugin validate .` on the hotfixed marketplace (claude 2.1.289): last line `Validation passed with warnings` (one warning: no marketplace description; pre-existing), exit 0.
- `checkPayload` run on the hotfixed `plugins/mos-desktop`: 0 violations.
- Plugin-repo tracked bad names outside the dist: 5 (ui/shell and ui/bakeoff sources, not shipped; unchanged from J1).

## D arms (tests/test-369.1-desktop-artifact.cjs --arm drops)

D1 ui-shell-dist, D2 bad-path-char (two paths named), D3 built tree has no dist, no bad entry, no bin/, D4 no force-add line, D5 launcher line and non-zero exit with no stack, D6 dash guard: all PASS. Full file: PASS=26 FAIL=0.

## Gates

- `node tests/test-369.1-desktop-artifact.cjs`: 26/26.
- `node tests/test-369-launch-surface.cjs`: 30 passed, 0 failed (arm 1i still green).
- `node scripts/release-lib/build-desktop-artifact.cjs --check`: exit 0 (1998 files).
- `build-connector-registry.cjs --check`, `build-orchestration-projection.cjs --check`, `check-render-coverage.cjs`: all exit 0.
- `node scripts/build-ui-shell.cjs --check`: dist fresh (the CLI payload keeps it; not rebuilt).
- `bash tests/run-all-369.1.sh`: PASSED=36 FAILED=4 SKIPPED=2 KNOWN=4. The four FAILED legs are not from this change: `command registry --check` (STALE; a peer executor's command edits in the shared tree), and three `hygiene ... git status changed during the run` legs (DPI-06 offline, DPI-06 live, DPI-07), which compare repo status before and after and trip on the two peer executors committing in the same tree. The release lockstep, marketplace-shape and artifact legs pass. The four KNOWN reds matched their signatures (bump algebra 3 failed, 234 dist bundle, agentshield, 234 plugin root).
- `node scripts/doctor.cjs --acceptance`: 22/23; the one failure is `verify-release-clean-tree` (the shared tree is dirty with the peers' uncommitted work; not a defect of this change).
- Dash guard: 0 long dashes added in any touched file.

## Deviations from Plan

1. **[Rule 1 - consistency] Launcher exit code.** The plan said exit 2 on a missing `manifest.json`; `tests/test-369-launch-surface.cjs` arm 1i (not in files_modified) pins exit 1 and the leading sentence "The workspace is not built in this install." Kept both; the message is now one line: "The workspace is not built in this install. This copy carries no workspace build (the Desktop copy never does); the workspace runs from Claude Code: /mos:dashboard shell". D5 checks non-zero, the phrase, the route and no stack.
2. **[Rule 1] The `equality` arm** of the artifact test pinned "npm pack minus bin/" and failed once the dist was dropped; updated to skip `lib/ui-shell/dist/` (same test file).
3. **D5 uses `start --dist`**, not `status --dist`: `status` never reads the manifest, `start` does so before touching any daemon (HOME pointed at a temp dir).
4. The marketplace hotfix only removes the dist; the leftover `plugins/mos-desktop/lib/ui-shell/launch.cjs` in the catalog copy is the beta.57 launcher (old wording) and is replaced by the next release build.

## Shared-tree incident to know about

Between my RED and GREEN commits a peer ran `git checkout HEAD~0` (reflog `moving from main to HEAD~0`), so the plugin repo HEAD is DETACHED. `f01173a32` (and this SUMMARY commit) sit on the detached HEAD on top of `main` (`19fb0a720`); `main` itself has NOT advanced past the peers' RED commits. I did not move `main` or re-attach (not mine to touch). Re-attach with `git branch -f main <HEAD>` then `git checkout main` only after confirming the peers are done; main is an ancestor of HEAD, so it is a pure fast-forward.

## Owed by the navigator

1. Desktop verification: on Mac and Windows, Claude Desktop > Customize > Plugins > Add marketplace `jsagir/mindrian-marketplace`, confirm the sync no longer says "Marketplace sync failed" or "Zip file contains path with invalid characters", and that `mos-desktop` installs. (Only payload and path measurements plus `claude plugin validate` were possible here.)
2. Ship the build-side fix in the next beta cut (RULE 6: release-infra change rides a beta first); until then the marketplace hotfix is the only thing live for Desktop, and the next `release.sh` Step 6.8 rebuilds the copy through the fixed builder.

## Known Stubs

None.

## Self-Check: PASSED

Commits `4cf8b61a6`, `f01173a32` exist in the plugin repo; `2a9f217` is on origin/master of the marketplace repo; all seven touched files exist.

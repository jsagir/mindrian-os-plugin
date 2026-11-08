---
status: fixing
kind: qa-sweep
trigger: "beta-81-install-test-sweep"
issue_id: ""
severity: medium
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: [6, 7, 8]
created: 2026-11-08T08:57:00Z
updated: 2026-11-08T08:57:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** the install cache of plugin 2.0.0-beta.81 (no .git, no tests/, no scripts/release.sh). `scripts/mos-status.cjs` in the install is byte-identical to `origin/main` (PROVEN by diff). The fixes live on branch `quick/261108-status-active-room` at commit 9ff220f25 (task 2) on top of a4076ca10 (task 1).
- **WIRE claims probe against:** `theo-mcp.onrender.com` on 2026-11-08, sha eaaa6dd0, handshake `mindrian-brain` v2.0.0-beta.81.
- **Date of audit:** 2026-11-08
- **Re-verification rule:** a source-code claim in this file was read against the branch above. Re-verify it against `origin/main` HEAD after the branch merges. Until then a code claim is provisional.

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: the 3 NEW FAILURE rows (R1 to R3) are fixed on the branch and need an install of beta.82 to close.
test: install beta.82, then run the 3 install checks below.
expecting: R1 names the active room from any folder; R2 and R3 print SKIP rows and exit 0 from the install.
next_action: after the beta.82 cut is installed, run `/mos:status` from `$HOME`, `doctor --dogfood-acceptance` and `doctor --acceptance --light-npx` from the install. Then set status resolved and move this file to `.planning/debug/resolved/`.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin (the fix was made in the worktree /home/jsagi/gsd-workspaces/status-active-room/MindrianOS-Plugin)
- Plugin version: 2.0.0-beta.81 tested; fixes in 2.0.0-beta.82 (in progress)
- Reported by: owner install test (main session)
- Date first observed: 2026-11-08
- Related debug sessions: none. Related seed: `.planning/seeds/SEED-145-theo-store-identity-floor-vs-live-node-count.md`

## Problem Statement

A full install test of 2.0.0-beta.81 found 3 defects: `/mos:status` ignores the active room, and 2 doctor gates fail from an install because they need a repo checkout. All other findings are classified below.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: `/mos:status` names the registry active room from any folder. `doctor --dogfood-acceptance` and `doctor --acceptance` do not fail checks that an install cannot run.
actual (R1): from `/home/jsagi` it prints "room: room" (the legacy folder `/home/jsagi/room`) with "(no MINTO yet)" rows. From the plugin folder it prints "room: 2.0.0-beta.81, 1 section, 0 filled". From inside the room it prints "room: translational-capital-lab, 15 sections, 15 filled, 5 stale".
actual (R2): `node scripts/doctor.cjs --dogfood-acceptance` from the install printed FAIL for ACPT-01 to ACPT-06, each "driver missing: test-acpt-0N-<slug>.cjs", then "0/6 ACPT points passed", exit 1.
actual (R3): `node scripts/doctor.cjs --acceptance --light-npx` from the install gave 21/25.
errors:
  - FAIL version-of-record-published: "git tag v2.0.0-beta.81 not found"
  - FAIL verify-release-clean-tree: "git status failed (exit 128)"
  - FAIL release-dry-run-output: "release.sh --dry-run exited 127"
  - FAIL cross-connection-honesty: "calibrate-citation-check.cjs --check exited 1", root: ENOENT `tests/fixtures/355-citation-pairs.items.json`
reproduction:
  1. Install plugin 2.0.0-beta.81 from the marketplace.
  2. `cd $HOME && node <install>/scripts/mos-status.cjs | head -1`
  3. `node <install>/scripts/doctor.cjs --dogfood-acceptance; echo $?`
  4. `node <install>/scripts/doctor.cjs --acceptance --light-npx`
started: R1 since `resolveRoomRoot` was written (cwd-only guess). R2 and R3 since the dogfood gate and the 4 points were written; the release has never shipped tests/, .git or scripts/release.sh.

## Scope and Impact

- Affected surfaces: cli (the status script and doctor run in the CLI). Desktop and Cowork reach the active room by other paths (the MCP room tools); only the CLI script guessed from cwd.
- Affected commands: `/mos:status`, `/mos:doctor --dogfood-acceptance`, `/mos:doctor --acceptance`
- Affected users: every install (no repo checkout); R1 also affects any user whose cwd is not a room
- Version range: all versions up to and including 2.0.0-beta.81
- Severity: medium (wrong room shown; false FAIL rows; no data loss)
- Blast radius: the 4 repo-only acceptance points and the 6 dogfood points. A repo checkout was never affected.

## Results

Environment: Linux WSL2, Node 22.23.1, plugin install 2.0.0-beta.81 (marketplace cache), registry active room `translational-capital-lab`. Surface: CLI only. Desktop and Cowork not exercised.

| Test | Component | Result | Class |
|------|-----------|--------|-------|
| R1 | /mos:status active room | Wrong room from `$HOME` and from the plugin folder. Fixed by quick 261108-ekl task 1 (commit a4076ca10). | NEW FAILURE (fixed on branch) |
| R2 | doctor --dogfood-acceptance from the install: 0/6, exit 1 | Fixed by quick 261108-ekl task 2 (commit 9ff220f25). | NEW FAILURE (fixed on branch) |
| R3 | doctor --acceptance --light-npx from the install: 21/25, 4 repo-only FAILs | Fixed by quick 261108-ekl task 2 (commit 9ff220f25). | NEW FAILURE (fixed on branch) |
| R4 | doctor --all | Completed: 21 healthy, 8 drift, 0 warnings, 32 classes | WORKING |
| R5 | doctor class mcp-surface | About 21918 tokens against the 8000 budget (a measurement warning). No tracker found in .planning/seeds or .planning/debug. | known (no tracker found) |
| R6 | doctor class mcp-write-path | OFF because MINDRIAN_MCP_FIRST is unset. The unset state is the designed default. See `.planning/debug/resolved/mcp-write-path-disabled-on-cli-host.md`. | ENV GAP |
| R7 | doctor class ui-compliance | 183 violations. Tracked by `.planning/debug/doctor-auto-heal-qa-sweep-2026-09-16.md` (F8, the violation count). | known |
| R8 | doctor class deprecated-usage | 6 commands used in 7 days, `/mos:query` 988 times. This counts local usage history on this machine. | ENV GAP |
| R9 | doctor class room-md | 46 dirs lack ROOM.md or MINTO.md. This is room content on this machine. A related earlier cause (dot-directories counted as rooms) is fixed, see `.planning/debug/2026-09-14-install-health-check-beta37-qa-sweep.md` findings 4.1 and 4.2. | ENV GAP |
| R10 | doctor class graph-derive-health | The semantic encoder is not installed (2 of 58 rooms). The encoder is an optional dependency. Related: `.planning/debug/2026-09-14-install-health-check-beta37-qa-sweep.md`. | ENV GAP |
| R11 | doctor class room-map | 8 drift findings. Not broken down by room in this run. No tracker found. | known (no tracker found) |
| R12 | doctor class section-ruling | 410 drift findings. Not broken down by room in this run. No tracker found. | known (no tracker found) |
| R13 | brain-smoke L0 to L5 | PASS (origin theo-mcp.onrender.com, mode ok, sha eaaa6dd0, handshake mindrian-brain v2.0.0-beta.81) | WORKING |
| R14 | brain-smoke L6 | FAIL: node_count 22436 is below the floor 27000, GraphRagMeta refreshed 2026-10-16. Tracked by `.planning/seeds/SEED-145-theo-store-identity-floor-vs-live-node-count.md`. | known |
| R15 | ICM walk on translational-capital-lab | 28 nests, 11 of 11 core sections, identity 7 of 7 keys, 0 nests with every face, 25 of 35 face files without an edit-surface marker, duplications 0 of 3. These face counts are room content state, not a plugin defect. | WORKING |
| R16 | bind-check | Advisory "session not bound". Expected from a plain shell. | WORKING |
| R17 | resolve-room | Answers correctly | WORKING |
| R18 | help-renderer | Answers correctly | WORKING |
| R19 | room-question | Answers correctly | WORKING |
| R20 | claim-checks | Answers correctly | WORKING |

Verdict: the plugin install works. The 3 NEW FAILURE rows are code defects with a fix on the branch. The 8 drift rows are 4 ENV GAP, 1 known with a tracker, and 3 with no tracker (see Non-Code Follow-ups).

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: the install ships a stale `scripts/mos-status.cjs`
  evidence: the file is byte-identical to `origin/main` (PROVEN by diff). The defect is in the current code.
  timestamp: 2026-11-08T08:00:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-11-08T08:00:00Z
  checked: `resolveRoomRoot(cwd)` in `scripts/mos-status.cjs` at HEAD 7fc10a417, lines 119 to 185
  found: it walks up 6 levels from `process.cwd()` for a `.room-root` file, a ROOM.md with a ROOM.md subdir, or a `room/` subdir. Pass 2 returns cwd when any subdir has ROOM.md. It never reads the active-room registry.
  implication: from a folder that is not a room, the script guesses a wrong room or none. PROVEN.
- timestamp: 2026-11-08T08:00:00Z
  checked: `scripts/resolve-room` from the same shells
  found: it returned `/mnt/c/Users/jsagi/MindrianRooms/israel-frontier-criticality/translational-capital-lab` every time. `commands/status.md` runs `node "${CLAUDE_PLUGIN_ROOT}/scripts/mos-status.cjs" $ARGUMENTS` with no room argument.
  implication: the registry holds the right answer; `mos-status.cjs` did not ask it. PROVEN.
- timestamp: 2026-11-08T08:00:00Z
  checked: `node scripts/doctor.cjs --dogfood-acceptance` and `--acceptance --light-npx` from the install
  found: the 6 ACPT drivers live under `tests/`, and the 4 repo-only points need `.git`, `scripts/release.sh` or `tests/fixtures/`. The release ships none of them.
  implication: these points can only pass in a repo checkout. PROVEN.
- timestamp: 2026-11-08T08:57:00Z
  checked: after the fix, the 2 doctor commands in the repo checkout against the saved baseline
  found: both outputs are identical to the baseline (6/6 dogfood, 4/4 acceptance, no SKIP row), exit 0.
  implication: the repo layout behavior did not change. PROVEN.

## Technical Root Cause

R1:
- Site: `scripts/mos-status.cjs`:119-185 function `resolveRoomRoot`
- Cause: the function used the working folder only and had no registry leg. The legacy `room/` check sat in the same walk as the strict markers, so it beat any later source.
- Why it surfaces now: the beta.81 install test ran `/mos:status` from `$HOME` and from the plugin folder.

R2:
- Site: `scripts/doctor.cjs`:2494 function `runDogfoodAcceptance` (the `driverPath` existence check)
- Cause: a missing driver was a FAIL. The release does not ship `tests/`, so an install always failed.
- Why it surfaces now: the first run of the gate from an install.

R3:
- Site: `scripts/doctor.cjs`:826 function `buildAcceptanceChecklist`, the points `version-of-record-published` (line 1002), `verify-release-clean-tree` (line 1374), `release-dry-run-output` (line 1471), `cross-connection-honesty` (line 2201)
- Cause: each point spawns git, bash `scripts/release.sh` or a `tests/fixtures` reader. An install has none of them, so each point failed.
- Why it surfaces now: the first run of `--acceptance` from an install.

## Required Code Changes
<!-- Explicit, imperative, one block per change. All done on the branch. -->

- Change 1 (done, commit a4076ca10):
  - Location: `scripts/mos-status.cjs`, function `resolveRoomRoot`
  - Current behavior: cwd-only guess.
  - Required behavior: order is (1) explicit marker walk (`.room-root`, 2-level ROOM.md layout), (2) registry active room through `resolveActiveRoom()` from `lib/core/resolve-active-room.cjs`, (3) legacy `room/` walk, (4) fixture cwd pass. The two `navigation.detectActiveRoom()` fallbacks in `main()` are removed.
- Change 2 (done, commit 9ff220f25):
  - Location: `lib/core/doctor/shared.cjs` (new `detectPluginLayout`, reuses `hasOwnGitRoot`) and `scripts/doctor.cjs` (`runDogfoodAcceptance`, `buildAcceptanceChecklist`, `runAcceptance`, both printers, exports)
  - Required behavior: in an install layout (`tests/`, `.git` or `scripts/release.sh` missing), the dogfood pass and the 4 repo-only points return `detail.skipped` with a reason. Both printers show SKIP and a skipped count. A repo checkout runs every point as before.

## Tests to Add or Update

- Test 1:
  - Type: integration
  - Location: `tests/test-261108-ekl-status-active-room.cjs`
  - Given: a temp rooms home with a registry, and fixture rooms
  - When: `mos-status.cjs` runs from a non-room folder, a legacy folder, a `.room-root` room, a fixture folder, and with every `CLAUDE_*` env var removed
  - Then: 13 checks pass (legs S1 to S7)
  - Runner registration: `tests/run-all-261108-ekl.sh`
- Test 2:
  - Type: integration
  - Location: `tests/test-261108-ekl-doctor-install-layout.cjs`
  - Given: a stub install, the repo, and a stub repo
  - When: `detectPluginLayout`, `runDogfoodAcceptance` and `runAcceptance` run on each
  - Then: 22 checks pass (legs D1 to D6)
  - Runner registration: `tests/run-all-261108-ekl.sh`
- Update: `lib/memory/mos-status-renderer.test.cjs` now isolates the registry (an empty `MINDRIAN_ROOMS_HOME`), because its fixtures resolve through the cwd pass.
- Aggregator: `tests/run-all-261108-ekl.sh`

## Non-Code Follow-ups

- CHANGELOG.md: 2 Fixed lines under beta.82 are done.
- Release lockstep: applies at the next cut (beta.82). The fixes are not live until beta.82 is released and installed.
- README refresh: the README rule applies after the version ships.
- Re-run the 3 install checks (R1 to R3) on the beta.82 install.
- Seed candidates (no tracker found): mcp-surface token budget (R5), room-map drift (R11), section-ruling drift (R12). No seed was created.
- Pre-existing, not caused by this work: `tests/test-doctor-acceptance-preflight-checks.cjs` Test 7 fails on this machine ("version-of-record divergence IP=2.0.0-beta.81 vs PB=2.0.0-beta.75"). The failure is in the baseline before any edit. The aggregator runs this test as advisory.

## MindrianOS gates

- Canon Part 8: no Brain wire touched. No network call added.
- Tri-Polar: the status fix reads the registry file, not a CLI-only env var (test leg S6). Doctor runs where scripts run. Desktop and Cowork use the MCP room tools. UNVERIFIED on Desktop and Cowork.
- Cross-platform: `path.join` and `fs` only. The Windows drive mapping comes from `resolve-active-room.cjs`. Verified on Linux (WSL) only. Windows and Mac results are by construction (UNVERIFIED).
- Release lockstep: applies at the next cut.
- No em-dashes: checked on the diff and on this file.
- Reuse before build: `resolve-active-room.cjs`, `hasOwnGitRoot` and the existing `detail.skipped` form are reused. No surface was added.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: R1 `resolveRoomRoot` had no registry leg. R2 and R3 gate points assumed a repo checkout and failed in an install.
fix: registry leg in `resolveRoomRoot`; `detectPluginLayout` plus layout SKIP for the dogfood pass and the 4 repo-only points.
verification:
  - `node tests/test-261108-ekl-status-active-room.cjs` : 13 passed, 0 failed (before the fix: S1, S2, S6, S7 failed)
  - `node tests/test-261108-ekl-doctor-install-layout.cjs` : 22 passed, 0 failed (before the fix: threw, detectPluginLayout absent)
  - `node scripts/mos-status.cjs` from a new temp dir and from `$HOME` : "/mos:status -- room: translational-capital-lab"
  - doctor in a copy of the repo without tests/, .git and scripts/release.sh : dogfood 6 SKIP, "0/6 ACPT points passed, 6 skipped", exit 0; acceptance 4 SKIP, "0/4 points passed, 4 skipped", exit 0
  - doctor in the repo : output identical to the baseline, no SKIP row, exit 0
files_changed:
  - scripts/mos-status.cjs (registry leg in resolveRoomRoot)
  - lib/memory/mos-status-renderer.test.cjs (registry isolation)
  - lib/core/doctor/shared.cjs (detectPluginLayout)
  - scripts/doctor.cjs (layout SKIP, SKIP tag, skipped count, exports)
  - tests/test-261108-ekl-status-active-room.cjs (new)
  - tests/test-261108-ekl-doctor-install-layout.cjs (new)
  - tests/run-all-261108-ekl.sh (new)
  - CHANGELOG.md (2 Fixed lines)
commits: a4076ca10 (task 1), 9ff220f25 (task 2)

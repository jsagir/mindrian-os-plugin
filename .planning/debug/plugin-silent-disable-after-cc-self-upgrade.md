---
status: fixing
kind: rca
trigger: "plugin-silent-disable-after-cc-self-upgrade"
issue_id: ""
severity: high
surfaces: [cli]
brain_mode: full-loop
canon_parts: [6]
created: 2026-06-11T12:00:00Z
updated: 2026-06-11T12:00:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** origin/main HEAD @ dev workspace ~/dev/MindrianOS-Plugin, v1.13.1-beta.15 (NOT yet re-verified against the tester's installed build)
- **WIRE claims probe against:** n/a (install lifecycle, no Brain wire involved)
- **Date of audit:** 2026-06-11
- **Re-verification rule:** the tester-side evidence is a room artifact relay; every claim below is provisional and tagged needs-source-reverify until reproduced on a dev box.

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

DETECTION SHIPPED (2026-06-11). The disabled-state detector now exists and is reachable from outside the plugin's hook surface -- which is the only place it can run, because a DISABLED plugin's own SessionStart hooks never fire. `scripts/doctor.cjs` class N (plugin-enabled-state, backed by `lib/core/check-plugin-enabled.cjs`) reads `~/.claude/settings.json` `enabledPlugins[<key>]` + `installed_plugins.json` and flags `installed && enabled===false` as CRITICAL with the `claude plugin enable <key>` fix text. It runs on a BARE `doctor` run (and under `--all`), NOT behind a class flag, so a silently-disabled user who runs `mindrian-os doctor` (the `npx @mindrian_os/cli doctor` entry, which resolves the plugin from the on-disk install cache regardless of the enabled flag) gets a non-zero exit + an actionable row. The flag is read-only; doctor NEVER writes settings.json.

still pending (not in this scope):
- REPRODUCTION of the root-cause collision (trigger `claude plugin update` while a CC self-upgrade is pending; capture the enabled-flag flip on a dev box). The detector was validated against a SYNTHESIZED disabled-state fixture, not a live race.
- SELF-HEAL / auto-re-enable is DEFERRED pending reproduction (we do not yet know whether re-writing `enabledPlugins[<key>]=true` is safe mid-collision, or whether CC exposes a sanctioned re-enable path beyond the `claude plugin enable` CLI). The HARD RULE that this check never writes settings.json stands until reproduction informs the heal design.

next_action: reproduce the collision on a dev box; then design the heal (loud SessionStart banner once re-enabled, or a doctor --fix that shells `claude plugin enable`).

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin (workspace moved from /home/jsagi/MindrianOS-Plugin; older docs cite the old path)
- Plugin version: tester was on a June-7-era build (post v1.13.1-beta.14 train); Claude Code 2.1.163 -> 2.1.168
- Reported by: remote beta tester (CLI, Brain key active); evidence relayed via room artifact
- Date first observed: 2026-06-08 (update event fired 2026-06-07 20:39)
- Related debug sessions: install-cache failure family (see docs/install-cache-family-premortem.md; this is candidate case 7 -- the premortem predicted next failure modes in this family)
- Room-side evidence (via umbilical): ~/MindrianRooms/mindrianOS/sub-rooms/feedback/testers/ (2026-06-08 bug artifact; do not copy tester PII into this repo)

## Problem Statement

After a marketplace plugin update collided with a Claude Code self-upgrade, the MindrianOS plugin became silently disabled on a remote tester's machine and never self-corrected. The user loses the entire product without any signal.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: plugin update completes; plugin remains enabled; next session starts with Larry active (or a loud, actionable error if the update failed).
actual: plugin silently disabled after `claude plugin update mos@mindrian-marketplace` ran while Claude Code self-upgraded 2.1.163 -> 2.1.168; subsequent sessions start with NO MindrianOS surfaces and no warning; state persists until manual intervention.
errors: none surfaced to the user (that is the bug); tester-relayed logs ground the collision timeline.
reproduction (provisional, not yet dev-reproduced):
  1. Be on Claude Code 2.1.163 with a pending self-upgrade to 2.1.168
  2. Run `claude plugin update mos@mindrian-marketplace` during/around the self-upgrade window
  3. Start a new session; observe plugin absent, no error
started: observed 2026-06-07 20:39 on tester machine; unknown whether older CC versions exhibit it.

## Scope and Impact

- Affected surfaces: cli (desktop/cowork unknown; marketplace update path is CLI)
- Affected commands: ALL /mos:* surfaces (plugin entirely disabled)
- Blast radius: every remote tester/user who updates near a CC self-upgrade window; silent total-loss failure mode; worst possible churn shape for the Hooked loop (external trigger removed without trace)
- Install-cache family: candidate case 7; the family premortem (docs/install-cache-family-premortem.md) calls for a revisit when a new case lands

## Required Code Changes (hypothesized, pending reproduction)

1. Detection: scripts/doctor.cjs gains a plugin-enabled-state check (read the CC plugin registry/settings for mos enabled flag); wire into --all and the SessionStart preflight (scripts/preflight-doctor.cjs).
2. Self-heal or loud-fail: if disabled state detected with an intact install cache, either re-enable (if CC exposes it) or emit the statusline/session-start banner with the exact recovery command.
3. Release-side: add the collision case to docs/install-cache-family-premortem.md table.

## Tests

- tests/test-doctor-plugin-disabled-state.cjs: fixture a disabled-state registry; assert doctor flags it and exits non-zero on --acceptance.
- Manual: reproduce the race on a dev box (or simulate the post-state) and verify SessionStart surfaces the warning.

## Non-Code Follow-ups

- Notify the reporting tester when fixed (room-side comms, not from this file).
- Tester round 2 protocol (see .planning/research/2026-06-11-human-gate-harvest-and-tester-round-2.md) should include an update-path check on every cohort machine before the round starts.

## Evidence (append-only)

### 2026-06-11 -- DETECTION shipped (DRIFT-12, Phase 150.6 deviation extension)

- **Commit `078c1b3c`** `fix(150.6): DRIFT-12 add class N plugin-enabled-state silent-disable detector`
  - `lib/core/check-plugin-enabled.cjs` -- pure, sync, read-only probe. `checkPluginEnabled(opts) -> {installed, enabled, key, settings_path}`. Reads `enabledPlugins` from settings.json + `installed_plugins.json`; test seams for both paths via `opts.settingsPath` / `opts.installedPluginsPath`. `enabled=null` when the key is absent (older Claude Code) -- treated as "unknown, not an error". Never throws (every fs read wrapped). Defensive on BOTH key shapes (`mos@mindrian-marketplace` and `mindrian-os@mindrian-marketplace`). NEVER writes settings.json.
  - `scripts/doctor.cjs` -- class N wired following the existing class-roster idiom. Runs under `flags.all || flags.fix || !classFlagsActive` (the accumulative-engine trigger), so it fires on a BARE `doctor` run -- the load-bearing requirement, because a disabled plugin's SessionStart hooks cannot run. `installed && enabled===false` -> CRITICAL (`status:'warn'`, red) with detail "this state is the silent-disable failure (install-cache family case 7)" + fix `claude plugin enable <key>` (or /plugin in the TUI). `enabled===true`/`null` -> OK. Bare run exits 1 on CRITICAL; `--all` preserves the graceful-degradation exit-0 invariant (the `--acceptance` "doctor --all exits 0" self-test stays green).
  - `tests/test-doctor-plugin-disabled-state.cjs` -- 7 module unit tests (false / true / absent / settings-missing / malformed / alt-key-shape / not-installed) + 3 e2e bare-`doctor` runs (CRITICAL + non-zero exit / clean / unknown). 10/10 green.
- **Load-bearing surface verified**: `node bin/cli.js doctor` (the `npx @mindrian_os/cli doctor` entry) resolves the active plugin root from `installed_plugins.json` and spawns `scripts/doctor.cjs` -- reaching class N AND propagating the non-zero exit -- while `enabledPlugins["mos@mindrian-marketplace"]=false`. The install cache + npm package exist on disk regardless of the enabled flag, so this path works precisely when the plugin is DISABLED.
- **Fences green**: `bash tests/run-all-148.sh` 18/18; `node tests/test-doctor-plugin-disabled-state.cjs` 10/10. No regressions in `test-doctor-class-i/j`, `test-doctor-acceptance`, `test-doctor-class-a-topology-drift`.
- **HARD RULES honored**: zero em-dashes in shipped strings (hyphens only); no new dependencies (node built-ins only); settings.json read-only (never written).
- **Still open**: live reproduction of the update-vs-self-upgrade collision; self-heal / re-enable design (deferred pending reproduction).

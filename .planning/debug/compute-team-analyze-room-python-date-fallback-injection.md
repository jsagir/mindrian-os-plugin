---
status: investigating        # root cause CONFIRMED by a scratch reproduction on 2026-10-29; fix specified below, not yet started
kind: rca
trigger: "compute-team-analyze-room-python-date-fallback-injection"
issue_id: ""
severity: high
surfaces: [cli, cowork]
brain_mode: full-loop
canon_parts: [6, 8]
created: 2026-10-29T17:45:00Z
updated: 2026-10-29T17:45:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** branch `release/beta.77-changelog-panel` @ 6022aaa8c (dev tree, repo version 2.0.0-beta.76 in progress); ALSO confirmed present in the install cache `~/.claude/plugins/cache/mindrian-marketplace/mos/2.0.0-beta.75/scripts/{compute-team,analyze-room}` (one `python3 -c` site each).
- **WIRE claims probe against:** none; this defect is local script execution, no Brain or network leg.
- **Date of audit:** 2026-10-29
- **Re-verification rule:** re-read the two `portable_date_to_epoch` sites against HEAD before patching; Phase 381 rewrites both scripts and the line numbers will move.

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: A frontmatter date value from a room file is pasted into python source by `portable_date_to_epoch` when GNU `date -d` and BSD `date -j` both fail, so a crafted value runs arbitrary python on every Stop hook and every SessionStart that recomputes the room state. CONFIRMED.
test: scratch room with a crafted `last_active:` value, run `scripts/compute-team` on the copy, check for the side-effect file.
expecting: the side-effect file exists after one run (it did).
next_action: patch the two bash sites with a strict date-shape guard and an argv-passed python fallback (quick task after quick D lands), then let Phase 381 remove the bash bodies.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 2.0.0-beta.76 (dev tree); released 2.0.0-beta.75 carries the same code
- Reported by: the Phase 381 research pass (gsd-phase-researcher, 2026-10-29), reproduced in the session scratchpad on a copy, never on a real room
- Date first observed: 2026-10-29
- Related debug sessions: none; related phase .planning/phases/381-room-scan-once-render-three-times-node-renderers-behind-comp/ (ruling 2 in 381-CONTEXT.md names this file)

## Problem Statement

Any file in a Data Room can run arbitrary python on the user's machine through two bash scripts the plugin runs automatically at turn end and at session start, by carrying a crafted date value in its frontmatter.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: a frontmatter date that is not a valid `YYYY-MM-DD` yields epoch `0` and nothing else happens.
actual: when `date -d "$datestr"` fails (GNU date rejects the string) and `date -j -f` fails (not macOS), the third fallback runs `python3 -c "... strptime('$datestr','%Y-%m-%d') ..."` with `$datestr` interpolated into the python source; a value that closes the string literal runs its own statements. In the scratch reproduction the crafted `last_active:` value created a file. Exit code of the script stays 0 because the fallback's own error goes to `/dev/null` and the chain ends in `echo "0"`.
errors: none printed; silent.
reproduction:
  1. Copy any fixture room to the scratchpad (never a real room).
  2. In `team/<person>/PROFILE.md` set `last_active: 2026-01-01'); import os; os.system('touch /tmp/mos-rce-proof'); print('0` (one line).
  3. Run `bash scripts/compute-team <copy>` (or trigger it through `scripts/compute-state`, which the Stop hook and SessionStart call).
  4. Observe `/tmp/mos-rce-proof` exists; the script exit code is 0.
started: present since the `portable_date_to_epoch` helper was added for macOS portability (git blame the two sites for the commit); present in released 2.0.0-beta.75.

## Scope and Impact

- Affected surfaces: cli (hooks run the scripts on every Stop and SessionStart); cowork (shared rooms, so another member's file reaches your machine); desktop is not affected (no hooks run these scripts there).
- Affected commands: `scripts/compute-team` (via `scripts/compute-state`, `scripts/on-stop-state`, `scripts/session-start-state`, `scripts/state-write.cjs`), `scripts/analyze-room` (SessionStart, `/mos:reanalyze`, `/mos:status`).
- Affected users: every install with `python3` on PATH whose room contains a file they did not write themselves (shared Cowork rooms, vault imports, pasted meeting transcripts, cloned sample rooms). On GNU/Linux and WSL the python branch runs ONLY for strings `date -d` rejects, which is exactly the crafted case.
- Version range: at least 2.0.0-beta.75 (install cache checked) to the current dev tree.
- Severity: high (arbitrary code execution from room content; needs a malicious or compromised room file; no network leg).
- Blast radius: the same helper is duplicated in `scripts/compute-team:517-522` and `scripts/analyze-room:516-521`. Sibling pattern to check (ASSUMED, not reproduced): `scripts/analyze-room:802` and `:817` interpolate section names into `node -e` source; `scripts/compute-state:298`, `:305`, `:366` interpolate values into `node -e` (believed numeric; verify).

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: GNU `date -d` sanitises the value, so the python branch is unreachable on Linux.
  evidence: `date -d` REJECTS the crafted string, which is what makes the chain fall through to python. The guard is inverted: the more hostile the value, the more certain the python branch runs.
  timestamp: 2026-10-29T17:40:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-10-29T17:30:00Z
  checked: `scripts/compute-team:517-522` and `scripts/analyze-room:516-521` (function `portable_date_to_epoch`), callers `scripts/compute-team:780` (`la_epoch=$(portable_date_to_epoch "$last_active")`) and `scripts/analyze-room:994` (`last_epoch=$(portable_date_to_epoch "$last_updated")`).
  found: `$datestr` is interpolated unquoted into the python program text inside single quotes; the value comes straight from the frontmatter line extraction.
  implication: a value containing `')` escapes the literal and the rest is python.
- timestamp: 2026-10-29T17:35:00Z
  checked: scratch run of `scripts/compute-team` on a fixture copy with a crafted `last_active:`.
  found: the side-effect file was created; exit 0.
  implication: root cause confirmed; not theoretical.
- timestamp: 2026-10-29T17:42:00Z
  checked: `~/.claude/plugins/cache/mindrian-marketplace/mos/2.0.0-beta.75/scripts/{compute-team,analyze-room}` with grep.
  found: one `python3 -c` site in each; the released code is the same.
  implication: users on beta.75 are exposed today.

## Technical Root Cause

- Site: `scripts/compute-team:517-522` and `scripts/analyze-room:516-521`, function `portable_date_to_epoch`
- Cause: string interpolation of untrusted room data into interpreter source (`python3 -c "... strptime('$datestr', ...)"`). No shape check on `$datestr` before any fallback.
- Why it surfaces now: the Phase 381 research traced every byte-affecting path of the three scripts and tested the fallback branches on a scratch copy; the hostile case had never been exercised by a test (fixtures carry only valid dates).

## Required Code Changes
<!-- Explicit, imperative, one block per change -->

- Change 1:
  - Location: `scripts/compute-team:517-522`, function `portable_date_to_epoch`
  - Current behavior: three fallbacks; the third interpolates `$datestr` into python source.
  - Required behavior: first line of the function: `[[ "$datestr" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || { echo "0"; return; }`. Then pass the value as an ARGUMENT, never as source: `python3 -c 'import sys; from datetime import datetime; print(int(datetime.strptime(sys.argv[1], "%Y-%m-%d").timestamp()))' "$datestr" 2>/dev/null`.
  - Short-term patch: the two lines above (parity-neutral: valid dates unchanged; invalid dates already yield `0` today).
  - Long-term fix: Phase 381 replaces the bash body with a node renderer that never spawns an interpreter with room data (PERF381-05 pins this as a named divergence test).
- Change 2:
  - Location: `scripts/analyze-room:516-521`, function `portable_date_to_epoch`
  - Current behavior: identical copy of the helper.
  - Required behavior: identical fix to Change 1.
- Change 3 (verify, then fix if confirmed):
  - Location: `scripts/analyze-room:802`, `:817`; `scripts/compute-state:298`, `:305`, `:366` (`node -e` with interpolated values)
  - Current behavior: values from the room (section names, counts) are interpolated into `node -e` program text.
  - Required behavior: pass values through `process.argv` or environment variables; or confirm the interpolated values are numeric-only and guarded.

## Tests to Add or Update

- Test 1:
  - Type: integration
  - Location: `tests/test-381-known-divergence.cjs` (Phase 381) and, for the short-term patch, a new leg in `tests/test-363.1-compute-state.cjs` or a new `tests/test-compute-team-date-guard.cjs`
  - Given: a scratch room whose `team/x/PROFILE.md` has a crafted `last_active:` value and whose artifact has a crafted `last_updated:` value
  - When: `scripts/compute-team` and `scripts/analyze-room` run on it
  - Then: no side-effect file is created, the epoch resolves to `0`, stdout bytes equal the run with `last_active: not-a-date`
  - Runner registration: `tests/run-all-363.1.sh` (patch) and `tests/run-all-381.sh` (phase)

## Non-Code Follow-ups
<!-- The release and canon obligations a code fix alone does not satisfy -->

- CHANGELOG.md: add a Fixed entry under Unreleased (plain words: "a room file could run code on your machine through a date field; it no longer can").
- Release lockstep: ship in the next cut (beta.77); the patch is two bash lines per script and parity-neutral.
- Canon: Part 6 (the plugin's own room is exposed too); Part 8 untouched (no egress). No CANON-PHASE-MAP change needed for the patch; Phase 381 declares its canon_parts.
- knowledge-base.md: on resolve, add the summary block.
- Process note: the fixtures never carried a hostile frontmatter value; the Phase 381 edge room (`tests/fixtures/room-381/build-fixture.cjs`) must include one.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: confirmed as stated in Technical Root Cause.
fix: pending (quick task after quick D lands; Phase 381 is the structural fix).
verification: pending.
files_changed: none yet.
commits: none yet.

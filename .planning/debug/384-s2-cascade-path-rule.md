---
status: investigating
kind: rca
trigger: "384-s2-cascade-path-rule"
issue_id: "PERF384-F09"
severity: medium
surfaces: [cli]
brain_mode: full-loop
canon_parts: [3, 8, 9]
created: 2026-11-07T00:00:00Z
updated: 2026-11-07T00:00:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** main HEAD at START_SHA 933ec50df06b75f2c129b3de429e428a3cde277d
- **WIRE claims probe against:** none (no network call; the probe runs the local scripts/mindrian-tools.cjs on synthetic folders)
- **Date of audit:** 2026-11-07
- **Re-verification rule:** each code claim below was read in the working tree at START_SHA. The files scripts/post-write and lib/core/intelligence-cascade.cjs had no uncommitted change at the start.

## Current Focus

hypothesis: scripts/post-write starts a node process for the cascade on every file that has a STATE.md ancestor, but the cascade itself skips every path that does not hold /room/ or /rooms/. On the default rooms home layout the cascade can therefore never run, and the node start is paid for nothing.
test: read the path rule and the post-write block; run a probe on 7 synthetic layouts (bench/s2-path-rule-probe.cjs) and compare the cascade skip reason with the bash glob that post-write already uses.
expecting: the default rooms home layout (L3) has path_rule_passed false; the bash glob agrees with the cascade rule on all 7 layouts.
next_action: owner decision on option-a, option-b, option-c or option-d (Task 2 of plan 384-20). No product file changes before the answer.

## Meta

- Plugin: MindrianOS-Plugin, branch main
- Reported by: plan 384-20 (S2, Write path), after plan 384-11 measured the Write rows
- Date first observed: 2026-11-06 (plan 384-10, T04)
- Related debug sessions: none

## Problem Statement

A PostToolUse Write on a file that has a STATE.md ancestor starts a node process that runs the cascade. On a path without /room/ or /rooms/ the cascade does nothing, but the process start and the module load are still paid.

## Symptoms
<!-- IMMUTABLE after the investigation starts -->

expected: a Write on a file that the cascade will skip costs no more than the bash part of the hook.
actual: the skipped case starts one node process that loads about 565 modules and costs 59.4 and 59.3 ms above a bare node start (measurements/t02-t05-costs.md, T04; PROVEN). The case that runs the cascade costs a median of 3,553 ms wall and 5,015 ms summed hook CPU (measurements/q7-q8-costs.md, table Q7-1; PROVEN).
errors: none. This is a cost finding, not a failure.
reproduction:
  1. Run bench/s2-path-rule-probe.cjs (synthetic folders only).
  2. Read the skip reason of each layout in measurements/fix-s2-path-rule.json.
started: not dated. The path rule (isRoomFile) and the bash block predate this phase.

## Scope and Impact

- Affected surfaces: cli (post-write is a CLI hook). Desktop and Cowork reach the cascade through MCP tools, not through this script. Only the Linux CLI path is measured.
- Affected users: any install that writes a file below a folder with a STATE.md.
- Severity: medium (a small fixed cost per Write, or a dormant feature, depending on the owner answer).

## Eliminated
<!-- APPEND only -->

- hypothesis: the bash room check and the cascade rule differ, so a room path could be skipped by mistake if bash decided early.
  evidence: the probe table below shows agreement on all 7 layouts (7 of 7 rows, agree true). Both rules are "the path contains /room/ or /rooms/". The cascade uses String.includes('/room/') or includes('/rooms/'); post-write uses the glob */room/* or */rooms/*. A relative path with no leading slash fails both.
  timestamp: 2026-11-07T00:00:00Z
- hypothesis: a skipped call writes a side-channel record that says the cascade is complete and an envelope that says work was queued.
  evidence: this was the assumption in the plan. It is false at START_SHA. scripts/post-write (function cascade_status_of, Phase 386-15 B7) reads `skipped true` from the node output and returns the word `skipped`. The envelope text is then `post-write: cascade skipped for <file>` and the side-channel field cascade_status is `skipped`. Read from the code, not run on a real room (PROVEN as code reading).
  timestamp: 2026-11-07T00:00:00Z

## Evidence
<!-- APPEND only -->

### E1. The path rule (read from the code)

- lib/core/intelligence-cascade.cjs, function `isRoomFile`: returns true only when the path contains `/room/` or `/rooms/`.
- Function `runCascade`, guard order: (1) no filePath, skip; (2) `!isRoomFile(filePath)`, skip with reason `filePath not inside a room directory`; (3) roomDir not found; (4) basename STATE.md or ROOM.md, skip. Then binary routing, then the cascade steps.
- scripts/mindrian-tools.cjs, case `cascade`: calls `runCascade(roomDir, { trigger: 'cli-hook', filePath })` and prints the JSON.

### E2. The post-write block (read from the code)

- Marker `# -- Delegate intelligence cascade to shared module`. The block runs when `room_dir` is not empty. `room_dir` is the nearest STATE.md ancestor of the written file (a walk up the folders).
- Inside the block: `CASCADE_OUTPUT=$(node scripts/mindrian-tools.cjs cascade "$room_dir" "$FILE_PATH" --raw ...)`. The node process starts before the path rule is checked.
- CASCADE_OUTPUT is used by `cascade_status_of` and by `write_cascade_side_channel`. The side-channel function reads only four fields: classification, gitCommit, graphIndex, proactiveIntelligence. All four are null for a skipped call.
- Skipped case, outputs: envelope text `post-write: cascade skipped for <basename>`; side-channel file last-cascade.json with `cascade_status` `skipped` and four null fields (timestamp, file path, section, session id are kept).
- The same script already tests `[[ "$FILE_PATH" == */room/* ]] || [[ "$FILE_PATH" == */rooms/* ]]` earlier (the artifact tracking step). That is the glob the probe compares.

### E3. Default rooms home constant (read from the code)

- lib/core/session-binding.cjs, function `resolveHome`: environment variable MINDRIAN_ROOMS_HOME or MINDRIAN_ROOMS_ROOT, else the home folder joined with `MindrianRooms`. The same constant is in lib/core/resolve-umbilical-target.cjs and lib/core/platform.cjs (platform.cjs also reads MINDRIAN_ROOMS_HOME).
- A room at `<home>/MindrianRooms/<name>/` has neither /room/ nor /rooms/ in its path, unless a folder is named so, or the person sets MINDRIAN_ROOMS_HOME to a path that holds such a folder.

### E4. Probe on synthetic layouts (measurements/fix-s2-path-rule.json, schema mos.path-rule-384/1)

The probe ran `scripts/mindrian-tools.cjs cascade` on the section ROOM.md of one small room per layout, with a sandbox HOME, under taskset 0-3. The skip reason shows which guard stopped the call. The bash glob was evaluated on the same path. No real room was read.

| Layout | Shape | Path rule passed | Bash glob matches | Agree |
|--------|-------|------------------|-------------------|-------|
| L1 | base/room/n | yes | yes | yes |
| L2 | base/rooms/n | yes | yes | yes |
| L3 | base/MindrianRooms/n (default rooms home) | no | no | yes |
| L4 | base/proj/.planning/phases/x | no | no | yes |
| L5 | base/Rooms/n | no | no | yes |
| L6 | base/my-room/n | no | no | yes |
| L7 | base/team-rooms/n | no | no | yes |

The rule is case sensitive and needs the whole segment: Rooms, my-room and team-rooms do not pass.

### E5. Costs (PROVEN unless marked DERIVED)

- Cascade runs (harness layout, path holds /rooms/): median 3,553.4 ms wall and 5,015 ms summed hook CPU per artifact Write (n of 15, two sets; measurements/q7-write-cascade-s1.json, q7-write-cascade-s2.json; table Q7-1 of measurements/q7-q8-costs.md).
- Cascade skipped (default layout): the node start costs 59.4 and 59.3 ms above a bare node start, about 565 modules (measurements/t02-t05-costs.md, T04). The default-layout artifact Write wall was 210.0 and 414.9 ms, spread 65.6 percent, two groups of rounds (q7-q8-costs.md; PROVEN, cause UNVERIFIED).
- The identity file ROOM.md skips the cascade (3 of 3 repeats; q7-write-cascade-counts.json).
- Frequency (194 development sessions, measurements/frequency-all-projects.json, plan 384-11): Write or Edit calls per session: median 0, mean 4.41, p95 20. PROVEN as a count, labelled development sessions, not plugin users.

### E6. Derived cost per session (DERIVED, parts shown)

| Case | Per Write | x mean 4.41 | x p95 20 |
|------|-----------|-------------|----------|
| Skip (node start, wall above bare node) | 59.4 ms | 59.4 x 4.41 = 261.95, about 262 ms | 59.4 x 20 = 1,188 ms |
| Cascade runs, wall | 3,553.4 ms | 3,553.4 x 4.41 = 15,670 ms | 3,553.4 x 20 = 71,067 ms |
| Cascade runs, summed hook CPU | 5,015 ms | 5,015 x 4.41 = 22,116 ms | 5,015 x 20 = 100,300 ms |

The plan text gave 71,060 for the cascade at p95; the product of the measured median and 20 is 71,067 (table Q7 of the cost file prints 71,067.17).

## Technical Root Cause

PATH-RULE-VERDICT: NEVER-RUNS-ON-DEFAULT-ROOMS-HOME

- Site: scripts/post-write, the cascade block after the marker `# -- Delegate intelligence cascade to shared module`; lib/core/intelligence-cascade.cjs, `isRoomFile` and `runCascade`.
- Cause: two rules in two places. post-write starts the cascade for every file with a STATE.md ancestor. The cascade then skips every path that has no /room/ or /rooms/ segment. For a room at the default location (a folder named MindrianRooms under the home folder, with the room name below it) the path has neither segment (probe layout L3: path rule passed no). The cascade therefore does not run there, and the node process start is paid for a result that is always `skipped`.
- Scope of the verdict: it holds for the default location with the default folder names. A person who sets MINDRIAN_ROOMS_HOME to a path with a room or rooms folder, or names a folder so, gets the cascade (layouts L1 and L2).
- UNVERIFIED: whether any real room has a folder named room or rooms in its path. No real room was read (Canon Part 8).
- UNVERIFIED: the cause of the two groups of rounds (about 200 ms and 700 to 1050 ms) in the default-layout Write timing. The per-hook medians show the higher group in memory-artifact-graph-hook.cjs and auto-explore-fingerprint.cjs in set 1, which are other hooks, not the cascade.
- UNVERIFIED: whether the cascade was meant to run on the default rooms home. That is a design intent question for the owner.

## Required Code Changes
<!-- Not applied. Waits for the owner answer. -->

- Option-a (keep): none.
- Option-b (change the path rule so the cascade runs where intended): product behavior change. It turns on HSI, compute-state, build-graph, a double analyze-room and a git commit inside a hook with a 5 s limit, at about 3,553 ms wall and 5,015 ms CPU per artifact Write. It needs an owner ruling and its own phase. Not implemented in plan 384-20.
- Option-c (skip in bash before the node start when the path is not a room file): in scripts/post-write, replace the one line that sets CASCADE_OUTPUT with a conditional on the existing glob. When the glob does not match, set CASCADE_OUTPUT to `{"skipped":true,"skipReason":"filePath not inside a room directory"}`. The envelope text and the side-channel record stay equal (E2). Expected saving about 59 ms per skipped Write; the floor is 50 ms and the default-layout timing is noisy, so the keep rule may revert it.
- Option-d (separate cost plan for the cascade steps): only when the cascade can run. The verdict is NEVER-RUNS on the default rooms home, so this option applies only to layouts L1 and L2.

## Tests to Add or Update

- Under option-c: tests/test-384-s2-post-write-skip.cjs with a parity group (envelope bytes, exit code, side-channel content, files written) and a mechanism group (no cascade node start on a non-room path; rule equivalence table). See Task 3 of the plan.

## Non-Code Follow-ups

- CHANGELOG, release lockstep: not touched here (no release in this phase).
- Canon Part 3: the choice is a behavior question; it goes to the owner as a gate card through the main session.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: see Technical Root Cause (verdict NEVER-RUNS-ON-DEFAULT-ROOMS-HOME).
fix: none yet. Waits for the owner decision.
verification: probe selftest exit 0; probe exit 0 with 7 of 7 rows agreeing (measurements/fix-s2-path-rule.json).
files_changed:
  - none (product code unchanged)
commits: see the docs(384-20) commit of this task

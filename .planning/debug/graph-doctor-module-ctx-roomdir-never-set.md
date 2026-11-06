---
status: fixing
kind: rca
trigger: "graph-doctor-module-ctx-roomdir-never-set"
issue_id: "B16"
severity: low
surfaces: [cli]
brain_mode: full-loop
canon_parts: [9]
created: 2026-11-06T00:00:00Z
updated: 2026-11-06T00:00:00Z
---

## Current Focus

target: PRESENT

hypothesis: The doctor engine builds the ctx for always-cadence modules without a roomDir field, so a module that reads ctx.roomDir never sees the room given by --room.
test: Run the doctor with --room set to a fixture room that holds a queue, and read the graph-doctor row.
expecting: A skip row that names the working directory instead of the fixture room.
next_action: Fix at the engine (2 modules read ctx.roomDir), by adding roomDir to the ctx object, taken from flags.roomDir (null when absent).

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin-release (worktree of the dev workspace)
- Plugin version: 2.0.0 beta line, worktree HEAD at plan start 33af7ee46
- Reported by: auditor finding B16 (AUDITOR-FINDINGS-source.md section B)
- Date first observed: 2026-11-06
- Related debug sessions: none

## Source-of-Truth Preamble

- CODE claims read against: branch main of the release worktree @ 33af7ee46
- WIRE claims probe against: none (local read only, fixture room, HOME set to a temporary directory)
- Date of audit: 2026-11-06
- Re-verification rule: all code claims were read from the working tree at the sha above.

Target check: lib/core/doctor/graph-doctor-module.cjs exists and still reads `ctx.roomDir || ctx.room || process.cwd()`. The registry row (id graph-doctor, cadence always, flag null, runner lib/core/doctor/graph-doctor-module.cjs) exists in data/doctor-modules.json. Phase 384 and Phase 385 did not remove or narrow either.

## Problem Statement

The registered graph-doctor doctor module reads ctx.roomDir. The doctor engine never sets it. The module therefore checks the process working directory, whatever room the user passes with --room.

## Symptoms

expected: `doctor --room=<room>` reports the graph-doctor queue of that room.
actual: The row reports the queue of the working directory: skip with the text "no graph-doctor queue yet; run: node scripts/graph-doctor.cjs <cwd>".
errors: none
reproduction:
  1. Make a fixture room with a graph-doctor queue (3 synthetic nodes, 1 synthetic edge, node scripts/graph-doctor.cjs run on it through runGraphDoctor).
  2. Run `node scripts/doctor.cjs --dry-run --json --room=<fixture>` from the repository directory with HOME set to a temporary directory.
  3. Read the graph-doctor row.
started: quick 261009-4h4 (module registration)

## Scope and Impact

- Affected surfaces: cli
- Affected commands: node scripts/doctor.cjs (bare, --all and --fix runs, where always modules run) with --room
- Affected users: any user who runs the doctor from outside the room
- Version range: 2.0.0-beta.65 onward
- Severity: low
- Blast radius: research-providers also reads ctx.roomDir (see the table). The engine fix changes that row when --room is given.

## Eliminated

- hypothesis: The --room flag is not parsed.
  evidence: parseArgs sets flags.roomDir from `--room=<dir>` (and from the space form when --icm-walk is on). The flag reaches ctx.flags, but the module does not read ctx.flags.
  timestamp: 2026-11-06T00:00:00Z

## Evidence

- timestamp: 2026-11-06T00:00:00Z
  checked: scripts/doctor.cjs function runAccumulativeEngine, always-pass ctx construction
  found: `const ctx = { home, running, dryRun, fix: wantFix, flags: callerFlags, checks: alwaysChecks };` There is no roomDir or room field.
  implication: PROVEN. ctx.roomDir is undefined for every always module.
- timestamp: 2026-11-06T00:00:00Z
  checked: Readers of ctx.roomDir among the 31 runner files of data/doctor-modules.json
  found: see the table below.
  implication: 2 modules read ctx.roomDir, so the fix belongs in the engine.
- timestamp: 2026-11-06T00:00:00Z
  checked: Run A, `--room=<fixture>` with cwd = repository
  found: graph-doctor row is {status: skip, detail: "no graph-doctor queue yet; run: node scripts/graph-doctor.cjs <repository dir>"}.
  implication: PROVEN. The module checks cwd and ignores --room.
- timestamp: 2026-11-06T00:00:00Z
  checked: Run B, cwd = fixture, no --room
  found: graph-doctor row is {status: warn, detail: "last run: 3 nodes, 1 edges; 1 proposal(s) pending gate at <fixture>/.mindrian/graph-doctor/graph-doctor-proposals.json"}.
  implication: PROVEN. The module works only through the cwd fallback.

### ctx.roomDir readers among the doctor runner modules

| Module (id) | Reads | Today | After the engine fix |
|---|---|---|---|
| graph-doctor | ctx.roomDir, then ctx.room, then cwd | silently checks cwd, ignores --room | checks the --room room; cwd when no flag (same as today) |
| research-providers | ctx.roomDir (passes it to loadEgressPolicy) | always loads the default policy (roomDir undefined becomes empty string) | loads the egress policy of the --room room when the flag is given; same as today with no flag |
| umbilical, graph-derive-health, graph-derive-heal-retrofit, canon-backfill | a local variable named roomDir (registry walk, not ctx) | unchanged | unchanged |
| all other runners | none | unchanged | unchanged |

## Technical Root Cause

- Site: scripts/doctor.cjs function `runAccumulativeEngine`, the `const ctx = { home, running, dryRun, fix, flags, checks }` line in the always-module loop.
- Cause: the engine passes the parsed CLI flags in ctx.flags but gives no top-level roomDir. Two modules were written against a ctx.roomDir contract that the engine never provided.
- Why it surfaces now: the auditor traced the ctx fields against the module code.

Fix origin decision: engine. More than one module reads ctx.roomDir (2), so the engine sets `roomDir` from `flags.roomDir` (null when absent). Behavior that changes: graph-doctor and research-providers, only when --room is given. With no flag, every row is the same as today.

## Required Code Changes

- Change 1:
  - Location: scripts/doctor.cjs, function `runAccumulativeEngine`, the always-pass ctx object
  - Current behavior: ctx has no roomDir.
  - Required behavior: add `roomDir` taken from callerFlags.roomDir when it is a non-empty string, else null. Change no other line.
  - Short-term patch: same.
  - Long-term fix: none needed.

## Tests to Add or Update

- Test 1:
  - Type: integration
  - Location: tests/test-386-graph-doctor-room-ctx.cjs
  - Given: a fixture room with a graph-doctor queue and a temporary HOME
  - When: the doctor runs as a child process with --room=<fixture> from another working directory
  - Then: the graph-doctor row is a real status (warn, 1 proposal), not a skip (G1). With no --room and a cwd without a queue the row is skip (G2). The test reads the row from the doctor JSON output, so it uses the engine's real ctx (G3).
  - Runner registration: register in tests/run-all-386.sh if that file exists

## Non-Code Follow-ups

- CHANGELOG.md and knowledge-base.md are owned by plan 386-21.

## Resolution

root_cause: The always-pass ctx in scripts/doctor.cjs has no roomDir field, so modules that read ctx.roomDir fall back to the working directory.
fix: pending
verification: pending
files_changed:
  - pending
commits: pending

---
status: resolved
kind: rca
trigger: "folder-memory-eager-timeline-runner-widens-guard-dependencies"
issue_id: ""
severity: low
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: [8, 9]
created: 2026-11-06T12:00:00Z
updated: 2026-11-06T12:00:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** branch `main` @ 900c1e2b0 in the dev workspace copy /home/jsagi/dev/MindrianOS-Plugin-release (Phase 386 plan 35). Peers edit lib/core/part8-egress-guard.cjs and scripts/part8-egress-guard-hook.cjs in the same tree at run time, so the guard and hook counts below are read from the working tree at the time of the run.
- **WIRE claims probe against:** none; no network; fixture room built by tests/helpers/synthetic-room-db.cjs in a temporary folder; temporary HOME
- **Date of audit:** 2026-11-06
- **Re-verification rule:** a source claim is re-verified against `main` HEAD before it lands as a finding.

## Current Focus

hypothesis: lib/core/folder-memory.cjs and lib/core/folder-memory-async.cjs require ./feynman/timeline-runner.cjs at module load although only extractFeynmanBody (and its async twin) uses it. The require pulls navigation and many modules into the guard, the hook and the statusline processes.
test: Count modules in fresh processes for the 3 entry points before and after moving the require into the function, and check require.cache for navigation and the runner.
expecting: Fewer modules in the guard and statusline processes; navigation and the runner absent from require.cache at startup; the same FEYNMAN body for every fixture variant.
next_action: Pin the lazy-load test with an equivalence check (RED), then move the require.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 2.0.0-beta.x on main (read with node lib/core/repo-version.cjs)
- Reported by: PRD of Phase 386, section Accepted hardening and measurement status; Phase 384 task T03 (prior scratch measurement)
- Date first observed: 2026-11-05
- Related debug sessions: none

## Problem Statement

The Part 8 guard reaches navigation through rs-egress-prompts.cjs, cross-room-aggregator.cjs, folder-memory.cjs and feynman/timeline-runner.cjs. A load failure anywhere in that chain makes the guard and callTool fail open today. The chain is longer than it needs to be.

## Symptoms

expected: A process that only needs the guard (or the statusline) does not load the timeline runner and navigation until FEYNMAN parsing runs.
actual: Loading folder-memory.cjs or folder-memory-async.cjs loads feynman/timeline-runner.cjs and its dependencies at once.
errors: none; the cost is a long eager dependency chain
reproduction:
  1. Run a fresh node process with NODE_OPTIONS="--require tools/perf/count-modules-preload.cjs" and MOS_PERF_COUNT_LOG set.
  2. Require lib/core/part8-egress-guard.cjs.
  3. Read the count from the log and check require.cache for lib/core/navigation.cjs and lib/core/feynman/timeline-runner.cjs.
started: since the readQuintuple read-back was added (Phase 150 and Phase 88 line)

## Scope and Impact

- Affected surfaces: cli, desktop, cowork (the guard is one function on all three; the statusline is CLI)
- Affected commands: the PreToolUse guard hook, the in-process belt in brain-client callTool, scripts/context-monitor, any process that loads folder-memory
- Affected users: all installs
- Version range: all versions with readQuintuple
- Severity: low (Part 8 hardening; the statusline gain is below the 50 ms per-event floor, so this is not a speed item and no time gain is claimed)
- Blast radius: any caller of readQuintuple and readSextuple (both twins)

## Skip rule check

target: PRESENT

lib/core/folder-memory.cjs and lib/core/folder-memory-async.cjs both still carry a top-level `const timelineRunner = require('./feynman/timeline-runner.cjs');`. Phase 384 did not move them in this tree (its T03 edit was made only in a scratch copy).

## Eliminated

- hypothesis: the hook process does not load the runner
  evidence: the hook count run with a flags preload shows the runner in require.cache (see hook_loads_timeline_runner)
  timestamp: 2026-11-06T12:05:00Z

## Evidence

- timestamp: 2026-11-06T12:05:00Z
  checked: fresh-process module counts, 3 repeats per target, with NODE_OPTIONS="--require tools/perf/count-modules-preload.cjs" and a log in a temporary folder. Guard: node -e with require of lib/core/part8-egress-guard.cjs. Hook: scripts/part8-egress-guard-hook.cjs with a synthetic PreToolUse JSON for mcp__plugin_mos_mindrian-brain__brain_ask with the question "explain dominant design", PART8_FORCE_BRAIN_AVAILABLE=0, temporary HOME, fixture room as cwd. Statusline: scripts/context-monitor with a synthetic statusline JSON (workspace.current_dir is the fixture room).
  found: guard 172, 172, 172. hook 175, 175, 175. statusline 182, 182, 182 (equal in all 3 repeats).
  implication: the counts are stable; they match the audit figure for the guard (172) and the Phase 384 scratch figure for the statusline (182)
- timestamp: 2026-11-06T12:06:00Z
  checked: a second fresh run per target with a scratch preload (in the session scratchpad, not committed) that records at exit whether lib/core/navigation.cjs and lib/core/feynman/timeline-runner.cjs are in require.cache
  found: all 3 entry points hold both modules in require.cache
  implication: navigation arrives through the runner chain today for the guard, the hook and the statusline

Prior figures (labelled, not results of this plan):

- audit target: statusline 181 to 17, guard 172 to 10 (target, from the auditor simulation)
- Phase 384 T03 prior scratch result: statusline 182 to 18 (scratch copy of a pinned export, not this tree)

Counts (anchored lines, read by the test):

modules_guard_before: 172
modules_hook_before: 175
modules_statusline_before: 182
navigation_in_cache_guard_before: yes
navigation_in_cache_statusline_before: yes
hook_loads_timeline_runner: yes

After the change (same method, fresh processes, 3 repeats each, equal in all 3, measured at HEAD with the fix in the working tree):

modules_guard_after: 10
modules_hook_after: 173
modules_statusline_after: 18
navigation_in_cache_guard_after: no
navigation_in_cache_statusline_after: no

The guard (172 to 10) and the statusline (182 to 18) reproduce the audit target for the guard (172 to 10) and match the Phase 384 scratch figure for the statusline (182 to 18); the audit statusline target was 181 to 17, so the measured figures are one higher at both ends. The hook count falls from 175 to 173 and the runner is out of its require.cache (hook_loads_timeline_runner was yes before, no after). Navigation is still loaded in the hook process: navigation_loaded_by_hook: scripts/part8-egress-guard-hook.cjs (the hook requires lib/core/navigation.cjs itself at run time; PROVEN with a Module._load probe). This plan does not change the hook. This is hardening and no time gain is claimed.

Equivalence fixture set (FEYNMAN.md variants in a synthetic section folder): absent, empty file, body only, frontmatter plus body, with the sentinel-bounded Timeline (auto) block excised, CRLF line ends.

Tests that cover folder-memory today (found by grep): lib/memory/folder-memory-quadruple.test.cjs (17 of 17), tests/test-150-feynman-readback.cjs, tests/test-195-drift-kind.cjs, tests/test-195-xroom-relevance.cjs, tests/test-232-room-home.cjs, tests/test-245-drain-budget.cjs, tests/test-241-guardian-tripolar-parity.cjs, tests/test-386-dial-memory-stale.cjs and others. extractFeynmanBody is not exported, so the new test reaches it through readQuintuple for the sync and the async twin.

## Technical Root Cause

- Site: lib/core/folder-memory.cjs, top-level `const timelineRunner = require('./feynman/timeline-runner.cjs')` before function `extractFeynmanBody`; lib/core/folder-memory-async.cjs, the same require before function `extractFeynmanBodyAsync`
- Cause: the runner is required at module load although only extractFeynmanBody and its async twin use it, and its load pulls navigation and its dependencies.
- Why it surfaces now: the owner asked for fewer eager dependencies in the Part 8 guard chain (PRD, Accepted hardening); plan 386-30 removes the fail-open exits and works better on a shorter chain.

## Required Code Changes

- Change 1:
  - Location: lib/core/folder-memory.cjs, function `extractFeynmanBody`
  - Current behavior: the runner loads when the module loads
  - Required behavior: delete the top-level require; put the require as the first statement of the existing try block, so a load failure takes the existing fallback to the trimmed raw buffer
  - Short-term patch: none
  - Long-term fix: none
- Change 2:
  - Location: lib/core/folder-memory-async.cjs, function `extractFeynmanBodyAsync`
  - Current behavior: the same
  - Required behavior: the same move, inside the existing try
  - Short-term patch: none
  - Long-term fix: none

## Tests to Add or Update

- Test 1:
  - Type: unit and fresh-process
  - Location: tests/test-386-folder-memory-lazy-timeline.cjs
  - Given: a synthetic section folder with the 6 FEYNMAN.md variants; fresh child processes
  - When: folder-memory, folder-memory-async and the guard are loaded; the statusline runs; a Module._load double makes the runner load throw
  - Then: arms LZ1 to LZ6 pass (lazy load, equivalence with 0 mismatches, fallback, fewer modules, navigation and runner absent at startup)
  - Runner registration: picked up by tests/run-all-386.sh by glob

## Non-Code Follow-ups

- CHANGELOG.md, STATE.md, ROADMAP.md and knowledge-base.md: owned by plan 386-21.
- Canon Part 8: a lazy require; no verdict changes; no Brain wire touched. Canon Part 9: FEYNMAN reading stays a local read.
- Tri-Polar: the module is plain CJS used on all three surfaces; the statusline count is CLI only; verified on Linux, correct by construction elsewhere.
- Cross-platform: no path or process change; Linux verified only.

## Resolution

root_cause: The timeline runner is required at module load in both folder-memory twins although only extractFeynmanBody uses it, and its load pulls navigation and many modules into the guard, hook and statusline processes.
fix: the require of ./feynman/timeline-runner.cjs moved from the top of lib/core/folder-memory.cjs and lib/core/folder-memory-async.cjs to the first statement of the existing try block in extractFeynmanBody and extractFeynmanBodyAsync. A load failure takes the existing raw-buffer fallback. Nothing else changed.
verification: node tests/test-386-folder-memory-lazy-timeline.cjs passes LZ1 to LZ6 (RED before: LZ1, LZ2, LZ4, LZ5 and LZ6 failed, LZ3 passed). Equivalence: 0 mismatches over 6 variants, sync and async. Fresh-process counts: guard 172 to 10, hook 175 to 173, statusline 182 to 18; navigation and the runner are out of require.cache for the guard and the statusline. lib/memory/folder-memory-quadruple.test.cjs 17 of 17; test-150-feynman-readback, test-195-drift-kind, test-195-xroom-relevance, test-232-room-home, test-241-guardian-tripolar-parity, test-245-drain-budget, test-386-dial-memory-stale, test-reverse-salient-agent and the two lib/memory brain-derivation tests exit 0. bash tests/run-all-196.sh 7 passed, 0 failed. node tests/test-3692-guard-survey-gate.cjs GATE PASS, MEASURED_SHA256 1b2fc844...dd00 (unchanged). bash tests/run-all-386.sh all PASSED. Known reds not caused by this plan: test-252-guard-census census.1 and census.5b (same as before the change).
files_changed:
  - lib/core/folder-memory.cjs (require moved into extractFeynmanBody)
  - lib/core/folder-memory-async.cjs (require moved into extractFeynmanBodyAsync)
  - tests/test-386-folder-memory-lazy-timeline.cjs (new)
  - .planning/debug/folder-memory-eager-timeline-runner-widens-guard-dependencies.md (new)
commits: see git log for 386-35 (RCA, RED, fix)

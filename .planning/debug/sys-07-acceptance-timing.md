---
status: resolved
kind: rca
trigger: "sys-07-acceptance-timing"
issue_id: "SYS-07"
severity: medium
surfaces: [cli]
brain_mode: full-loop
canon_parts: []
created: 2026-09-23T14:52:22Z
updated: 2026-09-23T14:52:22Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** `origin/main` (dev workspace) HEAD @ `e0047e69a` (this repo's own
  HEAD at the moment of the clean rerun; `d3da69ec3` = this plan's own instrumentation commit,
  landed as the immediate parent before 4 unrelated peer commits from concurrent sessions landed
  on top -- confirmed via `git log --oneline -8`, no file this plan touches was modified by those
  peer commits).
- **WIRE claims probe against:** live deployed Brain `theo-mcp.onrender.com` (the
  `activation-reached-the-wire` point's own L6 store-identity check hit it directly, see Evidence),
  live `registry.npmjs.org` (the `version-of-record-published` and `npx-roundtrip` points' `npm
  view` / `npm install` calls).
- **Date of audit:** 2026-09-23
- **Re-verification rule:** re-run `bash tests/run-all-354.sh` (leg "354: acceptance diagnostics
  (SYS-07)") against a fresh `origin/main` HEAD before citing this file's specific point durations
  as still current; the WORKING classification itself (structural: every point reports, every
  child is bounded) is not time-sensitive, but exact millisecond figures will drift release to
  release.

## Current Focus

hypothesis: N/A -- investigation closed. SYS-07 is now instrumented (354-13 Tasks 1-2) and this
clean rerun classifies the original F-07 finding.
test: N/A
expecting: N/A
next_action: None. Closed.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 2.0.0-beta.48 (per `version-of-record-published`/`activation-reached-the-wire`
  point output during this rerun)
- Node version: v22.23.1
- HEAD at rerun: `e0047e69a` (instrumentation commit `d3da69ec3` is an ancestor; no file this plan
  touches changed between the two)
- Reported by: gsd-executor, Phase 354 Plan 13 (SYS-07), executing the locked repair-sequence
  Tier 5 item from `354-CONTEXT.md`
- Date first observed: 2026-09-20 (`docs/reviews/2026-09-20-full-system-code-review.md` F-07: "the
  acceptance gate did not terminate in the review environment")
- Related debug sessions: none (`.planning/debug/` had no prior `sys-07-*` file; this is the first)
- Execution environment note: run from inside this session's Bash tool (not a separate terminal
  outside Claude Code's own execution harness -- there is no such surface available to this
  executor). What "outside the sandbox" concretely means for this rerun, verified rather than
  assumed: a live `curl` to `registry.npmjs.org` returned HTTP 200 immediately before the timed
  runs, and both timed runs below completed real network round-trips (an `npm install` from the
  live registry, a live `npm view`, and a live HTTPS call to `theo-mcp.onrender.com` that returned
  real graph data) with none of the earlier review's symptoms (no progress, still running at
  ~90s). This is the closest verifiable proxy to "outside the mock-server-restricted environment"
  available to this executor, and it directly contradicts the "sandbox mock-server restrictions"
  explanation as the ongoing cause: this session's environment has neither a mock server nor a
  network restriction in the path these points exercise.

## Problem Statement

`node scripts/doctor.cjs --acceptance` produced no progress output and was still running after
~90 seconds in the 2026-09-20 code review (F-07); a subsequent non-sandbox rerun (referenced in
`354-CONTEXT.md`'s "Corrected/bounded findings") did not produce a trustworthy completion signal
before being stopped. Neither run resolved to a classification. This RCA instruments the runner
(354-13 Tasks 1-2: per-point `duration_ms`, `[acceptance] <id> start/done` stderr progress,
`runBoundedChild` on every spawn) and reruns clean to classify SYS-07 for the first time from
measured data.

## Symptoms

expected: `doctor --acceptance` prints visible per-point progress, every point finishes within a
bounded time or fails naming the exact child that hung, and the process exits promptly (0 = all
points passed, 1 = any point failed) with no live child process left behind.
actual (BEFORE 354-13 Task 2, per F-07): zero progress output during the run; a bounded `timeout
20s` retry exited 124 (SIGTERM-then-125/124 from `timeout`, i.e. still running past 20s) with no
indication of which of the (at the time) fewer points was responsible.
actual (AFTER 354-13 Task 2, this rerun): full visible `[acceptance] <id> start`/`done <ok|FAIL>
<ms>ms` progress on stderr for every point; both timed runs below completed well inside their
bound with a clean process exit and zero orphaned children.
errors: none in this rerun. The single point failure recorded (`verify-release-clean-tree`) is a
real, actionable, correctly-classified point failure, not a hang or a runner defect (see Evidence
and Technical Root Cause below).
reproduction:
  1. `timeout 900 node scripts/doctor.cjs --acceptance --pre-tag --json > pretag.json 2>
     pretag.err; echo $?`
  2. `timeout 1800 node scripts/doctor.cjs --acceptance --json > full.json 2> full.err; echo $?`
  3. Inspect `pretag.json`/`full.json` for `points[].duration_ms`, `summary.duration_ms`,
     `summary.slowest`; inspect `*.err` for `[acceptance]` progress lines.
  4. `ps -eo pid,ppid,etimes,cmd | grep -E "doctor.cjs|mos-acceptance|release.sh|npm (view|install)" | grep -v grep`
     immediately after each run, to check for orphans.
started: F-07 first observed 2026-09-20; SYS-07 stayed UNRESOLVED (not confirmed either way) per
the 2026-09-23 deep-system-research's own "Corrected/bounded findings" entry, pending this
plan's instrumentation.

## Scope and Impact

- Affected surfaces: cli (this is a release-tooling gate; no Desktop/Cowork surface calls
  `doctor --acceptance`).
- Affected commands: `doctor --acceptance`, `doctor --acceptance --pre-tag`, `doctor --acceptance
  --pre-flight`; transitively `scripts/release.sh` Steps 2.5, 6.6, 9.8.
- Affected users: release operators only (this repo's own release process), not end-user installs.
- Version range: F-07 observed at whatever commit was current 2026-09-20; this rerun is at
  `e0047e69a` (plugin version 2.0.0-beta.48).
- Severity: medium (per the disposition ledger's own SYS-07 row rating: "MEDIUM (explicitly
  flagged undecided by the research, not a research gap)"). Now closed WORKING; no code defect.
- Blast radius: none beyond `scripts/doctor.cjs`'s own `--acceptance` path (354-13's scope
  boundary: `runAcceptance`, `buildAcceptanceChecklist`'s child spawns, and the new
  `runBoundedChild` helper; Phase 352 continues to own `doctor --all` rendering).

## Eliminated

- hypothesis: A real child-process hang exists in `doctor --acceptance` independent of the
  sandbox, and the 2026-09-20 F-07 observation (still running at ~90s under a 20s bounded retry)
  reflects an actual defect in the runner.
  evidence: With every acceptance-point child now routed through `runBoundedChild` (bounded,
  SIGKILL-enforced) and per-point `duration_ms` recorded, both a `--pre-tag` rerun (18/18 points,
  83.4s wall clock) and a `--full` rerun (20/21 points, 101.4s wall clock, one real point failure)
  completed cleanly with no point ever approaching its bound and zero orphaned processes
  afterward. If a genuine hang existed in any of the 20-plus points this checklist now runs, it
  would have shown as a `timed_out: true` detail or an outer-bound kill; neither occurred.
  timestamp: 2026-09-23T14:52:22Z
- hypothesis: The `verify-release-clean-tree` failure in the `full` rerun is itself evidence of an
  acceptance-runner defect (e.g. a race or a stale-state read).
  evidence: The point's own `detail` (`tracked-file drift: 6 file(s)`) is a correct, real read of
  `git status --porcelain --untracked-files=no` against a repo actively being edited by
  approximately 5 concurrent peer Claude Code sessions (confirmed via `git log --oneline -8`
  showing 4 unrelated commits from other sessions landing between this plan's own commits during
  the same working period). The point did its job: it correctly detected a dirty tracked tree at
  the moment it ran. This is expected behavior under concurrent development, not a runner defect.
  timestamp: 2026-09-23T14:52:22Z

## Evidence

- timestamp: 2026-09-23T14:47:00Z
  checked: live network reachability immediately before the timed runs (`curl -sS -o /dev/null -w
  '%{http_code}' https://registry.npmjs.org/@mindrian_os%2Fcli`)
  found: HTTP 200
  implication: this execution environment has unrestricted network egress to the npm registry,
  unlike the "sandbox mock-server restrictions" the 2026-09-23 research names as affecting the
  earlier failing runs.
- timestamp: 2026-09-23T14:48-14:50Z
  checked: `timeout 900 node scripts/doctor.cjs --acceptance --pre-tag --json`, wrapped in
  `/usr/bin/time -v`
  found: exit 0; 18/18 points passed; wall clock 1:23.60 (83.60s); `summary.duration_ms: 83435`;
  `summary.slowest: {"id":"doctor-all","duration_ms":35168}`; per-point durations recorded from
  7ms (`install-state`) to 35168ms (`doctor-all`, itself a bounded self-spawn of `doctor --all`);
  stderr carried a `[acceptance] <id> start`/`done` pair for every one of the 18 points.
  implication: the `--pre-tag` tier (zero network per its own Canon Part 8 comment) completes
  well within any reasonable operator-facing bound, with full visibility into which point is
  running at any moment.
- timestamp: 2026-09-23T14:50-14:52Z
  checked: `timeout 1800 node scripts/doctor.cjs --acceptance --json`, wrapped in `/usr/bin/time
  -v`
  found: exit 1; 20/21 points passed; wall clock 1:41.42 (101.42s); `summary.duration_ms: 101178`;
  `summary.slowest: {"id":"doctor-all","duration_ms":33664}`; the ONE failure was
  `verify-release-clean-tree` (`tracked-file drift: 6 file(s)`, `duration_ms: 24`) -- a real,
  fast, correctly-detected point failure, not a hang. The three network-touching points all
  completed normally: `version-of-record-published` (`npm view`, 1177ms, npmVer matched expected
  `2.0.0-beta.47`), `npx-roundtrip` (real `npm install` round-trip, 20706ms, `present/parses/
  linked` all true, its own routed `runBoundedChild` child completed in 100ms with `timed_out:
  false`), and `activation-reached-the-wire` (10028ms, its L6 store-identity sub-check reached
  `https://theo-mcp.onrender.com` live and got back `node_count=27951` >= floor `27000`).
  implication: the `full` tier, including every network-touching point, also completes well
  within bound with zero timeouts.
- timestamp: 2026-09-23T14:52:22Z
  checked: `ps -eo pid,ppid,etimes,cmd | grep -E "doctor.cjs|mos-acceptance|release.sh|npm
  (view|install)" | grep -v grep` immediately after each of the two runs above
  found: empty output both times (no matching processes)
  implication: no orphan processes were left behind by either run -- recorded per this task's own
  required-evidence contract as "no orphan processes".
- timestamp: 2026-09-23 (354-13 Task 2, prior commit `d3da69ec3`)
  checked: `grep -c "runBoundedChild(" scripts/doctor.cjs`; manual count of `cp.spawnSync(` calls
  remaining inside `buildAcceptanceChecklist` (function body spans lines 870-2128 at that commit)
  and how many carry an explicit `timeout`
  found: 8 total occurrences of `runBoundedChild(` (1 comment reference, 1 function definition, 6
  real call sites: `verify-release`, the two git probes in `version-of-record-published`, the git
  probe in `npx-roundtrip`, the `node --check` in `npx-roundtrip`, and the `DOCTOR_TEST_HANG_POINT`
  injection inside `runAcceptance`); 13 real (non-comment) `cp.spawnSync(` calls remain inside
  `buildAcceptanceChecklist`, and every one of the 13 carries an explicit `timeout` option (11
  inline on the same source line, 2 -- the `--brain-smoke` and `--eureka-smoke` self-spawns --
  with `timeout` on the following line of the same call).
  implication: satisfies 354-13-PLAN.md Task 2's acceptance criteria verbatim ("no cp.spawnSync(
  call remains without a timeout" and "grep -c runBoundedChild( >= 6").

## Technical Root Cause

There was no code defect to root-cause. The 2026-09-20 F-07 symptom (no progress, still running
past a 20s bounded retry) was a visibility gap, not a hang: `doctor --acceptance` had no per-point
stderr progress and 4 child spawns (the two `git` probes in `version-of-record-published` at the
then-current `scripts/doctor.cjs:963,:973`, the `git` probe in `npx-roundtrip` at `:1015`, and the
`node --check` at `:1054`) had no explicit timeout, meaning a genuinely stuck child in any of those
4 spots COULD have hung the whole run silently with zero diagnostic signal -- an operator watching
a silent terminal for 90+ seconds cannot distinguish "the pre-tag/coverage-gate/doctor-all points
are just slow" (which they measurably are: `doctor-all` alone takes ~33-35s) from "a child process
is stuck." That is the seam 354-13 closes: not a hang that existed, but the ABSENCE of the
instrumentation needed to tell a hang from ordinary slowness.

- Site: `scripts/doctor.cjs`, `buildAcceptanceChecklist` (pre-354-13 state, before commit
  `d3da69ec3`)
- Cause: no per-point timing, no stderr progress, 4 child spawns without a bounded timeout
- Why it surfaced now: the 2026-09-20 code review ran the full (at the time, slower/fewer-instrumented)
  checklist under a 20s external `timeout` wrapper with no visibility into which point was still
  running, and could not distinguish ordinary multi-point cumulative runtime (which this rerun
  measures at 83-101s total, well over 20s) from an actual stuck child.

## Required Code Changes

None as a result of THIS task (Task 3). The instrumentation Task 3 depends on already landed in
Task 1 (failing regression, commit `63a1fbecb`) and Task 2 (`runBoundedChild` + `runAcceptance`
timing/progress/test hooks, commit `d3da69ec3`), both committed earlier in this same plan
(354-13). This task is the rerun-and-classify step; per 354-13-PLAN.md Task 3's own action text,
"a gap-closure plan owns any fix; this task does not patch production code" -- and no NEW FAILURE
was found that would require one.

## Tests to Add or Update

- Test 1 (already added, Task 1 of this plan):
  - Type: unit/integration (hermetic, child-process based)
  - Location: `tests/test-354-acceptance-diagnostics.cjs`
  - Given: `DOCTOR_TEST_MODE=1`, `DOCTOR_TEST_ONLY_POINTS=install-state,version-of-record-repo`,
    `DOCTOR_TEST_HANG_POINT=version-of-record-repo`, `DOCTOR_ACCEPTANCE_CHILD_TIMEOUT_MS=800`
  - When: `node scripts/doctor.cjs --acceptance --pre-tag --json` runs
  - Then: exits 1, JSON carries `duration_ms`/`summary.slowest`, the hung point reports
    `detail.child.timed_out === true` with a finding containing "timed out", stderr carries
    `[acceptance] <id> start/done` lines, and the hung child pid is not signalable after exit (no
    orphan)
  - Runner registration: `tests/run-all-354.sh` line 82 (already present, guard file
    `tests/test-354-acceptance-diagnostics.cjs`)

No further tests are needed from this rerun: it produced no NEW FAILURE, only a confirmation that
the existing test suite (`tests/test-354-acceptance-diagnostics.cjs` plus all 3
`tests/test-doctor-acceptance*.cjs` siblings, all green per Task 2's own verification) already
covers the instrumented behavior.

## Non-Code Follow-ups

- CHANGELOG.md: not required for this rerun (no user-facing or release-contract behavior change
  beyond what Task 2's own commit already covers; that commit's own Non-Code Follow-ups apply, not
  a second entry for this RCA).
- Release lockstep: N/A, no version-bump-relevant change in this task.
- Canon: N/A, no Canon-relevant surface touched.
- knowledge-base.md: adding a summary block below is deferred to phase close-out (354-18 or the
  phase's own closing plan), matching the pattern other 354-NN deferred-items entries use; this
  file itself is the durable record in the interim.
- Docs / monitoring / process notes: none required. `verify-release-clean-tree`'s dirty-tree
  finding during the `full` rerun is expected, not actionable, under the stated concurrent-session
  operating conditions of this repo (5 peer Claude Code sessions sharing one working tree per the
  executor's own operating instructions for this plan) and is not evidence of a defect in
  `doctor --acceptance` itself.

## Resolution

root_cause: There was no hang. F-07 (2026-09-20) was a visibility gap (no per-point progress, 4
unbounded child spawns) that made ordinary multi-point cumulative runtime (measured here at
83-101s across 18-21 points) indistinguishable from a genuine stuck child under a naive 20s
external timeout wrapper.

fix: 354-13 Tasks 1-2 instrumented `runAcceptance`/`buildAcceptanceChecklist` with per-point
`duration_ms`, `summary.duration_ms`/`summary.slowest`, `[acceptance] <id> start/done` stderr
progress, and `runBoundedChild` (SIGKILL-bounded) on every acceptance-point child spawn. This task
(Task 3) reran clean outside the earlier sandbox-restricted conditions and classified the result.

verification: `timeout 900 node scripts/doctor.cjs --acceptance --pre-tag --json` -> exit 0,
18/18 points, 83.60s wall clock, no orphan processes. `timeout 1800 node scripts/doctor.cjs
--acceptance --json` -> exit 1 (one real, correctly-classified point failure:
`verify-release-clean-tree`, expected under concurrent peer-session tracked-file drift), 20/21
points, 101.42s wall clock, no orphan processes. All 3 network-touching points
(`version-of-record-published`, `npx-roundtrip`, `activation-reached-the-wire`) completed
normally with real network round-trips. Zero `timed_out: true` children in either run.

**Classification: WORKING.** Both runs finished within their bound with every point reporting,
and the only failure across both runs was a real point finding with actionable text (dirty
tracked tree under concurrent development), not a runner defect, hang, or orphan.

files_changed:
  - `.planning/debug/sys-07-acceptance-timing.md` (this file, new)
commits: (staged in this task's own commit; see 354-13-SUMMARY.md for the hash)

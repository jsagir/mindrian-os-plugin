---
phase: 261029-qef-hook-timeouts-in-seconds-with-measured-b
plan: 01
quick_id: 261029-qef
subsystem: hooks
tags: [perf, hooks, timeouts, part8, fail-closed]
status: COMPLETE
requires: [261029-kqv, 261029-lx3]
provides:
  - hooks/hooks.json budgets in seconds (46 command hooks), onFailure block on the Part 8 egress guard
  - scripts/measure-hook-cold-start.cjs reads seconds, isNetworkCapable(entry)
  - scripts/check-session-start-verification.cjs HOOK_BUDGET_S = 12
  - tests/test-261029-qef-hook-timeouts.cjs (arms A1..A9)
key-files:
  created:
    - tests/test-261029-qef-hook-timeouts.cjs
  modified:
    - hooks/hooks.json
    - scripts/measure-hook-cold-start.cjs
    - scripts/check-session-start-verification.cjs
    - tests/test-mux-card-before-answer.cjs
    - CHANGELOG.md
decisions:
  - "post-compact budget raised from 8 s to 74 s by the DD-1 raise rule (real-room worst 24,342 ms), then set to 120 s by the orchestrator ruling of 2026-10-29 (3 x 38,881 ms; the 100 s cap lifted for this hook)"
  - "CHANGELOG numbers come from the quiet-host set only; the two earlier after sets are not used"
completed: 2026-10-29
---

# Phase 261029-qef Plan 01: hook timeouts in seconds with measured budgets Summary

STATUS is COMPLETE. All 3 tasks ran. 5 commits exist (3 plan commits and 2 commits that apply the orchestrator ruling). The ruling set the post-compact budget to 120 s (3 x 38,881 ms, rounded up); the 100 s cap of the DD-1 raise rule is lifted for that one hook. Every gate is green.

## Commits (5, none pushed)

| Order | Sha | Message |
|-------|-----|---------|
| 1 | 6022aaa8c | test(261029-qef): add failing test for hook timeouts in seconds and the fail-closed Part 8 guard |
| 2 | 683a6b83c | fix(261029-qef): hook timeouts in seconds with measured budgets, and the Part 8 guard blocks on failure |
| 3 | f36bdc352 | docs(261029-qef): record the hook time limits in seconds and the measured times in the changelog |
| 4 | 950b5794c | fix(261029-qef): post-compact hook budget 120 s, 3x the measured worst case |
| 5 | 93b3cdb78 | docs(261029-qef): post-compact limit 2 minutes and the slow post-compact finding in the changelog |

PROVEN: all 5 shas are ancestors of HEAD (git merge-base --is-ancestor; the first 3 after commit 3, the last 2 after commit 5). Each commit used `git commit --only` with explicit paths. The 6 owned paths are clean in git status. PROVEN: no file was deleted by any commit. Nothing is pushed.

## Orchestrator ruling applied (2026-10-29)

The orchestrator ruled: the post-compact budget is 120 s (3 x 38,881 ms = 116.6 s, rounded up). The 100 s cap of the DD-1 raise rule is lifted for this one hook. The hook is not fixed in this quick. The slow post-compact hook (24 to 39 s against its own 2 s target) is finding 5 for the perf chain.

Applied (PROVEN): hooks/hooks.json post-compact timeout 74 to 120 (only that line changed); test arm A3 now expects exactly three hooks above 100 s (npm reconcile 150, session-start 180, post-compact 120); the A4 table has 120; A2 stays at 1 to 180; the CHANGELOG bullet says 2 minutes and holds the sentence about the 24 to 39 second measurement; the PLAN.md DD-1 row 11 says 120 with the basis "orchestrator ruling, 3 x 38,881 ms" (PLAN.md is not committed by me). Gates after the change (PROVEN): test-261029-qef ALL PASS; check-session-start-verification --json ok true, 0 violations; claude plugin validate exit 0; hooks.json parses; hooks.json diff against a13ab61f1 still 46 added lines.

Note: the "3 times the slowest run" sentence in the CHANGELOG is now also true for post-compact against the 38,881 ms worst case.

## Deviations from Plan

**1. [DD-1 raise rule applied, then orchestrator ruling] post-compact 8 s becomes 74 s, then 120 s.**
- Found during: Task 1 step 3.
- Measure (PROVEN): the real-room leg gave post-compact max 24,342 ms (first of 3 runs; median 7,112 ms; min 505 ms). needed = ceil(3 x 24.342) = 74. 74 is not above 100, so no stop at that point.
- First used in commits 6022aaa8c, 683a6b83c and f36bdc352 (74). The orchestrator ruling then set 120 (commits 950b5794c and 93b3cdb78). The final value everywhere is 120.
- Extra evidence (PROVEN): two reruns of the post-compact leg gave max 7,448 ms and 7,302 ms (before-change code and values, uptime 1.28 and 1.66). The 24 s spike did not repeat there, and did repeat after the change (38,881 ms and 31,196 ms). Cause of the spike: UNVERIFIED.

**2. [Expected result differs] tests/test-3551-tri-polar.cjs fails at a different assertion.**
- Plan said: it fails at the same assertion after the change.
- Fact (PROVEN): before, it failed at "hooks.json[PreToolUse] must be unchanged from BASE_3551". After, it fails at "hooks.json[SessionStart] must be unchanged from BASE_3551". The test loops the events of BASE_3551 and stops at the first difference. SessionStart equalled the base before (same old timeouts) and now differs by the new timeouts. The test failed before, and it still fails. I did not edit it (plan rule).
- Consequence (PROVEN by reading lines 343-349): the later assertion on ambient-stop (async true, timeout 5) is no longer reached. Arm A6 of the new test pins the same facts.
- The test pins a hooks.json shape from commit 2f5109bef, so any change of timeouts trips it. It needs a re-base. Not done here.

**3. [Flake] tests/e2e-369/gate-button.cjs failed once inside bash tests/run-all-369.sh.**
- After run: "route.fulfill: Route is already handled!" at tests/e2e-369/gate-button.cjs line 735, after arm 12 passed. Host load average was about 12 at that time (peer ffmpeg).
- PROVEN: a standalone rerun at load 4.47 (1 min) passed all 18 arms (exit 0). The test does not read hooks.json (grep count 0). Verdict: flake, not a regression.

**4. [Harness variant] the per-hook variant skips async hooks.**
- The variant hook-bench-perhook.cjs skips hooks with async true (ambient-stop). The restored harness does not skip them. So the Stop leg of the variant has 7 hooks and the restored harness has 8. The plan said to keep everything else; the async skip is mine. Reason: an async hook does not hold the event, and the Stop median must measure what blocks.

**5. [Extra runs] 3 extra after sets and a noise series.**
- Reason: the host was loaded by a peer ffmpeg job. See "Task 3 comparison". All sets are listed. Only the quiet set feeds the CHANGELOG.

**6. [Note] commit attribution.** The orchestrator named "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"; it is on all 3 commits.

## Task 1: baseline measurement, DD-1 table, RED test

Method (PROVEN): scratch variant `/tmp/claude-1000/-home-jsagi/b995db30-926f-45da-bd5e-9bff0d895704/scratchpad/qef/hook-bench-perhook.cjs`, a copy of the restored harness (the audit copy at /home/jsagi/.mindrian/perf-audit-2026-10-29/hook-bench-parallel.cjs is byte-identical to the recover/bench copy; diff printed "same"). Changes: per-hook max lines, PreCompact, PostCompact and SessionStart payloads, env TOOL, TOOL_INPUT, TRANSCRIPT and SKIP, async hooks skipped. Room: the real room named in the plan (cwd), SCRATCH = the scratch dir. Stop prep ran before every Stop leg (lock absent each time).

### Before, restored harness (step 2b)

```
UserPromptSubmit hooks=8 wall median=862 ms  min=796  slowest: "hooks/run-hook.cmd" intent-classifier=902ms, node "scripts/first-install-router.cjs"=162ms
PreToolUse       hooks=0 wall median=0 ms  min=0  slowest: 
PostToolUse      hooks=2 wall median=462 ms  min=459  slowest: node "scripts/query-efficiency-telemetry.cjs=495ms, node "scripts/operator-update.cjs"=76ms
Stop             hooks=8 wall median=5351 ms  min=5339  slowest: "hooks/run-hook.cmd" on-stop=5435ms, node "scripts/hmi-compliance-poll.cjs" --hoo=275ms
```

Uptime for that command: 19:21:26 load 1.59 / 1.99 / 4.08 (before), 19:21:47 load 1.61 / 1.97 / 4.03 (after). The PreToolUse payload (tool Bash) matches no PreToolUse matcher, so it prints hooks=0 (as the plan expected). The first line of the harness `Stop hooks=8` includes the async ambient-stop.

### Before, variant, real-room leg (step 2c)

```
== BEFORE 2c UserPromptSubmit
 19:21:54 up 40 min,  1 user,  load average: 1.56, 1.95, 4.02
UserPromptSubmit tool=undefined hooks=8 wall median=837 ms  min=831  slowest: "hooks/run-hook.cmd" intent-classifier=847ms, node "scripts/first-install-router.cjs"=148ms
  hook "hooks/run-hook.cmd" intent-classifier max=847 ms
  hook node "scripts/first-install-router.cjs" max=148 ms
  hook node "scripts/brain-derivation-drain.cjs" max=100 ms
  hook node "scripts/auto-explore-drain.cjs" max=96 ms
  hook node "scripts/jtbd-update.cjs" userprompt max=90 ms
  hook node "scripts/mva-detect.cjs" max=89 ms
  hook node "scripts/operator-update.cjs" max=69 ms
  hook node "scripts/admin-command-gate.cjs" max=65 ms
== BEFORE 2c PostToolUse
 19:21:57 up 40 min,  1 user,  load average: 1.60, 1.95, 4.01
PostToolUse      tool=Read hooks=2 wall median=465 ms  min=445  slowest: node "scripts/query-efficiency-telemetry.cjs=524ms, node "scripts/operator-update.cjs"=45ms
  hook node "scripts/query-efficiency-telemetry.cjs" max=524 ms
  hook node "scripts/operator-update.cjs" max=45 ms
== BEFORE 2c Stop
 19:22:01 up 41 min,  1 user,  load average: 1.60, 1.95, 4.01
lock absent
 19:22:07 up 41 min,  1 user,  load average: 2.91, 2.22, 4.08
Stop             tool=undefined hooks=7 wall median=5309 ms  min=5293  slowest: "hooks/run-hook.cmd" on-stop=5355ms, node "scripts/hmi-compliance-poll.cjs" --hoo=291ms
  hook "hooks/run-hook.cmd" on-stop max=5355 ms
  hook node "scripts/hmi-compliance-poll.cjs" --hook max=291 ms
  hook node "scripts/check-card-fire.cjs" max=92 ms
  hook node "scripts/operator-update.cjs" max=91 ms
  hook node "scripts/jtbd-update.cjs" stop max=91 ms
  hook node "scripts/check-voice-style.cjs" max=90 ms
  hook node "scripts/gsd-graph-derive-sweep.cjs" max=86 ms
== BEFORE 2c PreCompact
 19:22:23 up 41 min,  1 user,  load average: 2.43, 2.16, 4.02
PreCompact       tool=undefined hooks=1 wall median=992 ms  min=986  slowest: "hooks/run-hook.cmd" pre-compact=1139ms
  hook "hooks/run-hook.cmd" pre-compact max=1139 ms
== BEFORE 2c PostCompact
 19:22:26 up 41 min,  1 user,  load average: 2.43, 2.16, 4.02
PostCompact      tool=undefined hooks=1 wall median=7112 ms  min=505  slowest: "hooks/run-hook.cmd" post-compact=24342ms
  hook "hooks/run-hook.cmd" post-compact max=24342 ms
== BEFORE 2c PreToolUse Write
 19:23:01 up 41 min,  1 user,  load average: 1.94, 2.06, 3.92
PreToolUse       tool=Write hooks=1 wall median=56 ms  min=52  slowest: "hooks/run-hook.cmd" write-scope-check=57ms
  hook "hooks/run-hook.cmd" write-scope-check max=57 ms
== BEFORE 2c PreToolUse brain_query
 19:23:01 up 41 min,  1 user,  load average: 1.94, 2.06, 3.92
PreToolUse       tool=mcp__plugin_mos_mindrian-brain__brain_query hooks=1 wall median=374 ms  min=359  slowest: node "scripts/part8-egress-guard-hook.cjs"=409ms
  hook node "scripts/part8-egress-guard-hook.cjs" max=409 ms
== BEFORE 2c PreToolUse gate_answer
 19:23:02 up 41 min,  1 user,  load average: 1.94, 2.06, 3.92
PreToolUse       tool=mcp__plugin_mos_mindrian-os__gate_answer hooks=1 wall median=39 ms  min=39  slowest: node "scripts/card-before-answer-hook.cjs"=41ms
  hook node "scripts/card-before-answer-hook.cjs" max=41 ms
 19:23:03 up 41 min,  1 user,  load average: 1.94, 2.06, 3.92
```

### Extra before data: post-compact rerun (not in the plan)

```
== BEFORE extra PostCompact rerun 1
 19:23:31 up 42 min,  1 user,  load average: 1.28, 1.89, 3.81
PostCompact      tool=undefined hooks=1 wall median=7157 ms  min=7055  slowest: "hooks/run-hook.cmd" post-compact=7448ms
  hook "hooks/run-hook.cmd" post-compact max=7448 ms
== BEFORE extra PostCompact rerun 2
 19:23:55 up 42 min,  1 user,  load average: 1.66, 1.93, 3.78
PostCompact      tool=undefined hooks=1 wall median=7208 ms  min=7152  slowest: "hooks/run-hook.cmd" post-compact=7302ms
  hook "hooks/run-hook.cmd" post-compact max=7302 ms
```

### Before, variant, 50 MB transcript leg (step 2d)

PROVEN: the transcript file `qef-transcript-50mb.jsonl` is 52,675,000 bytes (50.2 MiB), built from the H7 filler line. The leg ran with cwd in an empty scratch dir and MINDRIAN_ROOMS_HOME on an empty scratch dir (T-qef-07), so no synthetic turn reached a real room.

```
== BEFORE 2d Stop
 19:23:21 up 42 min,  1 user,  load average: 1.51, 1.96, 3.85
Stop             tool=undefined hooks=7 wall median=163 ms  min=159  slowest: "hooks/run-hook.cmd" on-stop=183ms, node "scripts/check-card-fire.cjs"=93ms
  hook "hooks/run-hook.cmd" on-stop max=183 ms
  hook node "scripts/check-card-fire.cjs" max=93 ms
  hook node "scripts/hmi-compliance-poll.cjs" --hook max=79 ms
  hook node "scripts/jtbd-update.cjs" stop max=75 ms
  hook node "scripts/operator-update.cjs" max=71 ms
  hook node "scripts/check-voice-style.cjs" max=69 ms
  hook node "scripts/gsd-graph-derive-sweep.cjs" max=59 ms
== BEFORE 2d UserPromptSubmit
 19:23:22 up 42 min,  1 user,  load average: 1.51, 1.96, 3.85
UserPromptSubmit tool=undefined hooks=8 wall median=114 ms  min=110  slowest: node "scripts/first-install-router.cjs"=110ms, "hooks/run-hook.cmd" intent-classifier=80ms
  hook node "scripts/first-install-router.cjs" max=110 ms
  hook "hooks/run-hook.cmd" intent-classifier max=80 ms
  hook node "scripts/operator-update.cjs" max=65 ms
  hook node "scripts/mva-detect.cjs" max=65 ms
  hook node "scripts/auto-explore-drain.cjs" max=61 ms
  hook node "scripts/jtbd-update.cjs" userprompt max=58 ms
  hook node "scripts/brain-derivation-drain.cjs" max=54 ms
  hook node "scripts/admin-command-gate.cjs" max=51 ms
== BEFORE 2d PreToolUse gate_answer
 19:23:22 up 42 min,  1 user,  load average: 1.51, 1.96, 3.85
PreToolUse       tool=mcp__plugin_mos_mindrian-os__gate_answer hooks=1 wall median=39 ms  min=39  slowest: node "scripts/card-before-answer-hook.cjs"=40ms
  hook node "scripts/card-before-answer-hook.cjs" max=40 ms
 19:23:22 up 42 min,  1 user,  load average: 1.51, 1.96, 3.85
```

### Step 2e, the 3 last on-stop-state lines of the real room (before)

```
2026-10-29T17:22:08Z on-stop-state mode=skip reason=unchanged
2026-10-29T17:22:13Z on-stop-state mode=skip reason=unchanged
2026-10-29T17:22:18Z on-stop-state mode=skip reason=unchanged
```

### Final DD-1 table (seconds)

Only row 11 was raised (by the measurement to 74, then by the orchestrator ruling to 120). Rows 1, 3, 4 and 12 are fixed by C-1 and were not raised; their headroom is in the headroom table.

| # | Event | Hook | Planned (s) | Final (s) | Raised by measurement |
|---|-------|------|-------------|-----------|-----------------------|
| 1 | SessionStart | sessionstart-npm-reconcile.cjs | 150 | 150 | no (C-1 fixed) |
| 2 | SessionStart | sessionstart-post-update-preflight.cjs | 12 | 12 | no |
| 3 | SessionStart | run-hook.cmd session-start | 180 | 180 | no (C-1 fixed) |
| 4 | SessionStart | sessionstart-coordinator.cjs | 40 | 40 | no (C-1 fixed) |
| 5 | SessionStart | sessionstart-reference-now-seed.cjs | 5 | 5 | no |
| 6 | SessionStart | check-pending-breakthrough.cjs | 3 | 3 | no |
| 7 | SessionStart | check-pending-ambiguous.cjs | 3 | 3 | no |
| 8 | SessionStart | gsd-graph-derive-drain.cjs | 5 | 5 | no |
| 9 | SessionStart | agentshield-sessionstart-scan.cjs | 8 | 8 | no |
| 10 | PreCompact | run-hook.cmd pre-compact | 6 | 6 | no (needed 4) |
| 11 | PostCompact | run-hook.cmd post-compact | 8 | 120 | yes (needed 74 by the rule; 120 by the orchestrator ruling, 3 x 38,881 ms) |
| 12 | Stop | run-hook.cmd on-stop | 20 | 20 | no (C-1 fixed) |
| 13 | Stop | operator-update.cjs | 5 | 5 | no |
| 14 | Stop | jtbd-update.cjs stop | 5 | 5 | no |
| 15 | Stop | hmi-compliance-poll.cjs --hook | 5 | 5 | no |
| 16 | Stop | gsd-graph-derive-sweep.cjs | 5 | 5 | no |
| 17 | Stop | check-card-fire.cjs | 5 | 5 | no |
| 18 | Stop | check-voice-style.cjs | 5 | 5 | no |
| 19 | Stop | ambient-stop.cjs --stop | 5 | 5 | no (C-3) |
| 20 | SessionEnd | session-end-presence.cjs | 3 | 3 | no |
| 21 | PreToolUse | run-hook.cmd write-scope-check | 3 | 3 | no |
| 22 | PreToolUse | part8-egress-guard-hook.cjs | 5 | 5 (+ onFailure block) | no |
| 23 | PreToolUse | card-before-answer-hook.cjs | 3 | 3 | no |
| 24 | PostToolUse | run-hook.cmd post-write | 5 | 5 | no |
| 25 | PostToolUse | frontmatter-schema-validator.cjs | 5 | 5 | no |
| 26 | PostToolUse | async-artifact-auto-commit.cjs | 5 | 5 | no |
| 27 | PostToolUse | memory-completion-detector.cjs | 5 | 5 | no |
| 28 | PostToolUse | auto-explore-fingerprint.cjs | 5 | 5 | no |
| 29 | PostToolUse | gsd-artifact-graph-hook.cjs | 5 | 5 | no |
| 30 | PostToolUse | memory-artifact-graph-hook.cjs | 5 | 5 | no |
| 31 | PostToolUse | query-efficiency-telemetry.cjs | 3 | 3 | no (needed 2 from 524 ms) |
| 32 | PostToolUse | operator-update.cjs | 5 | 5 | no |
| 33 | PostToolUse | brain-response-sanitize-hook.cjs | 5 | 5 | no |
| 34 | PostToolUse | telemetry-command-invocation.cjs | 5 | 5 | no |
| 35 | UserPromptSubmit | admin-command-gate.cjs | 3 | 3 | no |
| 36 | UserPromptSubmit | run-hook.cmd intent-classifier | 5 | 5 | no (needed 3 from 847 + 80 ms) |
| 37 | UserPromptSubmit | mva-detect.cjs | 3 | 3 | no |
| 38 | UserPromptSubmit | first-install-router.cjs | 3 | 3 | no |
| 39 | UserPromptSubmit | brain-derivation-drain.cjs | 3 | 3 | no |
| 40 | UserPromptSubmit | operator-update.cjs | 3 | 3 | no |
| 41 | UserPromptSubmit | jtbd-update.cjs userprompt | 3 | 3 | no |
| 42 | UserPromptSubmit | auto-explore-drain.cjs | 3 | 3 | no |
| 43 | FileChanged | run-hook.cmd on-file-changed | 3 | 3 | no |
| 44 | CwdChanged | run-hook.cmd on-cwd-changed | 45 | 45 | no (not measured, R-5) |
| 45 | SubagentStop | run-hook.cmd on-agent-complete | 45 | 45 | no (not measured, R-5) |
| 46 | TaskCompleted | run-hook.cmd on-task-complete | 45 | 45 | no (not measured, R-5) |

RED run (PROVEN, exit 1 on the unchanged tree): ok A1, ok A6; FAIL A2, A3, A4, A5, A7, A8, A9. This is the set the plan expected. The test file has 251 lines, runs in 0.114 s, and holds no em-dash and no en-dash (grep printed nothing).

## Task 2: GREEN

### Test table, before and after the change (all run with node, same order)

| Test | Before exit | After exit | Failure lines |
|------|-------------|------------|---------------|
| tests/test-369-hook-require-graph.cjs | 0 | 0 | none |
| tests/test-369-installed-layout.cjs | 0 | 0 | none |
| tests/test-mux-card-before-answer.cjs | 1 | 1 | S3 only, both runs (PASS=18 FAIL=1); H7 passes in both; H7 label changed |
| tests/test-3551-tri-polar.cjs | 1 | 1 | PreToolUse before, SessionStart after (deviation 2) |
| tests/test-198-adapter-budget.test.cjs | 0 | 0 | none |
| tests/test-quick-260911-juq-hooks-json-top-level.cjs | 0 | 0 | none |
| tests/test-341-session-start-tier.cjs | 0 | 0 | none |
| tests/test-341-update-collapsed.cjs | 0 | 0 | none |
| lib/memory/sessionstart-coordinator.test.cjs | 0 | 0 | none |
| tests/test-239-brain-tool-liveness.cjs | 0 | 0 | none |
| tests/test-260906-gr1-brain-shaped-tool-gate.cjs | 0 | 0 | none |
| tests/test-346-catalogue-schema.cjs | 1 | 1 | FAIL 12 (hook mechanism partition), identical lines before and after |
| tests/test-359-devonly-tripwire.cjs | 0 | 0 | none |
| tests/test-355-part8-egress.cjs | 0 | 0 | none |
| tests/test-r1-posttooluse-interceptor-spike.cjs | 0 | 0 | none |
| tests/test-btm-theo-is-the-brain.cjs | 0 | 0 | none |
| bash tests/run-all-369.sh | 1 (PASS=54 FAIL=9 SKIP=1) | 1 (PASS=53 FAIL=10 SKIP=1) | the extra failure is the gate-button flake (deviation 3); the 9 baseline failures are the same suites |
| tests/test-261029-qef-hook-timeouts.cjs | 1 (RED) | 0 (ALL PASS), also after the 120 s ruling | none |

The 9 baseline failures of run-all-369 (both runs): erasable gate (TS369-03), infra helpers (TS369-07), launch surface (SHELL369-08, SHELL369-09), shared core (SHELL369-01, RXP369-01, HUM369-01), writer inventory coverage (CHG369-04), regression 267 CIRS gates, regression 267 registration API, regression 267 zod4 contract (MCPV2-03), regression 276 tool honesty findings closed. None reads the hook timeouts (UNVERIFIED for each; the failure sets are identical before and after, which is the PROVEN part).

### Other Task 2 gates

- PROVEN: hooks.json parses. `git diff -U0 a13ab61f1 -- hooks/hooks.json` holds 46 added lines (45 timeout lines and 1 onFailure line) and no other changed line. The guard entry is `"timeout": 5,` then `"onFailure": "block"`. The file keeps its final newline.
- PROVEN: `CHECK_SESSION_START_ROOT=$PWD node scripts/check-session-start-verification.cjs --check` prints "OK (0 violations)".
- PROVEN: `node scripts/measure-hook-cold-start.cjs --n 3 --json --out ... --tree-check report` exit 0, 46 entries, 45 measured, only the npm reconcile hook has not_measured ("network-capable (may run npm install)"), 0 timeout_breaches, session-start measured with timeout_ms 180000 (sandbox p50 2,114 ms, max 2,369 ms), tree_unchanged true. Host load average at start 11.50 / 12.90 / 12.52 (peer ffmpeg). This is a sandbox measure, not the real room.
- PROVEN: `claude plugin validate /home/jsagi/dev/MindrianOS-Plugin` exit 0, "Validation passed with warnings"; 0 lines with "Invalid command hook". The warnings are about hooks/mos-face.json and the mos-face register.js (not part of this change).
- PROVEN: the verify one-liner of Task 2 printed GATES-GREEN. No em-dash or en-dash in the added lines of the 4 files.
- measure-hook-cold-start: `--include-heavy` now includes only the npm reconcile hook. The fixture tests/fixtures/369/hook-cold-start-baseline.json is not regenerated (DD-5); its timeout_ms values still show the old budgets. Follow-up item.

## Task 3: after measurement, comparison, headroom

Expectation stated before the run: no change within noise, because the harness does not apply the hooks.json timeout (PROVEN: the harness has 0 uses of "timeout" and the hook code did not change).

### After, set 1 (load rising, loaded host)

```
== AFTER 2a
 19:59:35 up  1:15,  1 user,  load average: 2.33, 8.51, 11.00
lock absent
== AFTER 2b restored harness
 19:59:43 up  1:15,  1 user,  load average: 2.78, 8.50, 10.99
UserPromptSubmit hooks=8 wall median=1290 ms  min=1219  slowest: "hooks/run-hook.cmd" intent-classifier=4555ms, node "scripts/first-install-router.cjs"=207ms
PreToolUse       hooks=0 wall median=0 ms  min=0  slowest: 
PostToolUse      hooks=2 wall median=972 ms  min=914  slowest: node "scripts/query-efficiency-telemetry.cjs=1013ms, node "scripts/operator-update.cjs"=56ms
Stop             hooks=8 wall median=6662 ms  min=6210  slowest: "hooks/run-hook.cmd" on-stop=7139ms, node "scripts/ambient-stop.cjs" --stop=335ms
 20:00:16 up  1:16,  1 user,  load average: 2.76, 7.96, 10.73
== AFTER 2c UserPromptSubmit
 20:00:16 up  1:16,  1 user,  load average: 2.76, 7.96, 10.73
UserPromptSubmit tool=undefined hooks=8 wall median=1217 ms  min=1093  slowest: "hooks/run-hook.cmd" intent-classifier=1254ms, node "scripts/first-install-router.cjs"=164ms
  hook "hooks/run-hook.cmd" intent-classifier max=1254 ms
  hook node "scripts/first-install-router.cjs" max=164 ms
  hook node "scripts/auto-explore-drain.cjs" max=128 ms
  hook node "scripts/operator-update.cjs" max=119 ms
  hook node "scripts/jtbd-update.cjs" userprompt max=114 ms
  hook node "scripts/mva-detect.cjs" max=112 ms
  hook node "scripts/brain-derivation-drain.cjs" max=95 ms
  hook node "scripts/admin-command-gate.cjs" max=66 ms
== AFTER 2c PostToolUse
 20:00:19 up  1:16,  1 user,  load average: 2.70, 7.86, 10.68
PostToolUse      tool=Read hooks=2 wall median=561 ms  min=546  slowest: node "scripts/query-efficiency-telemetry.cjs=854ms, node "scripts/operator-update.cjs"=53ms
  hook node "scripts/query-efficiency-telemetry.cjs" max=854 ms
  hook node "scripts/operator-update.cjs" max=53 ms
== AFTER 2c Stop
 20:00:21 up  1:16,  1 user,  load average: 2.64, 7.76, 10.63
lock absent
 20:00:28 up  1:16,  1 user,  load average: 2.75, 7.70, 10.60
Stop             tool=undefined hooks=7 wall median=6429 ms  min=6268  slowest: "hooks/run-hook.cmd" on-stop=6629ms, node "scripts/hmi-compliance-poll.cjs" --hoo=289ms
  hook "hooks/run-hook.cmd" on-stop max=6629 ms
  hook node "scripts/hmi-compliance-poll.cjs" --hook max=289 ms
  hook node "scripts/gsd-graph-derive-sweep.cjs" max=91 ms
  hook node "scripts/operator-update.cjs" max=83 ms
  hook node "scripts/jtbd-update.cjs" stop max=83 ms
  hook node "scripts/check-card-fire.cjs" max=80 ms
  hook node "scripts/check-voice-style.cjs" max=75 ms
== AFTER 2c PreCompact
 20:00:50 up  1:16,  1 user,  load average: 2.59, 7.34, 10.42
PreCompact       tool=undefined hooks=1 wall median=1392 ms  min=1329  slowest: "hooks/run-hook.cmd" pre-compact=1403ms
  hook "hooks/run-hook.cmd" pre-compact max=1403 ms
== AFTER 2c PostCompact
 20:00:54 up  1:16,  1 user,  load average: 2.86, 7.32, 10.39
PostCompact      tool=undefined hooks=1 wall median=12746 ms  min=664  slowest: "hooks/run-hook.cmd" post-compact=38881ms
  hook "hooks/run-hook.cmd" post-compact max=38881 ms
== AFTER 2c PreToolUse Write
 20:01:49 up  1:17,  1 user,  load average: 2.31, 6.51, 9.96
PreToolUse       tool=Write hooks=1 wall median=85 ms  min=67  slowest: "hooks/run-hook.cmd" write-scope-check=102ms
  hook "hooks/run-hook.cmd" write-scope-check max=102 ms
== AFTER 2c PreToolUse brain_query
 20:01:50 up  1:17,  1 user,  load average: 2.31, 6.51, 9.96
PreToolUse       tool=mcp__plugin_mos_mindrian-brain__brain_query hooks=1 wall median=808 ms  min=484  slowest: node "scripts/part8-egress-guard-hook.cjs"=834ms
  hook node "scripts/part8-egress-guard-hook.cjs" max=834 ms
== AFTER 2c PreToolUse gate_answer
 20:01:55 up  1:17,  1 user,  load average: 2.21, 6.42, 9.91
PreToolUse       tool=mcp__plugin_mos_mindrian-os__gate_answer hooks=1 wall median=102 ms  min=96  slowest: node "scripts/card-before-answer-hook.cjs"=109ms
  hook node "scripts/card-before-answer-hook.cjs" max=109 ms
 20:01:55 up  1:17,  1 user,  load average: 2.21, 6.42, 9.91
== AFTER 2e
2026-10-29T18:00:28Z on-stop-state mode=skip reason=unchanged
2026-10-29T18:00:35Z on-stop-state mode=skip reason=unchanged
2026-10-29T18:00:44Z on-stop-state mode=skip reason=unchanged
```

### After, set 2 (rerun after load fell, plus a repeat and a 5-run noise series)

```
== AFTER-RERUN 2a
 20:02:50 up  1:18,  1 user,  load average: 1.45, 5.59, 9.44
lock absent
== AFTER-RERUN 2b restored harness
 20:02:58 up  1:18,  1 user,  load average: 1.46, 5.45, 9.36
UserPromptSubmit hooks=8 wall median=1413 ms  min=1183  slowest: "hooks/run-hook.cmd" intent-classifier=1523ms, node "scripts/first-install-router.cjs"=231ms
PreToolUse       hooks=0 wall median=0 ms  min=0  slowest: 
PostToolUse      hooks=2 wall median=543 ms  min=520  slowest: node "scripts/query-efficiency-telemetry.cjs=570ms, node "scripts/operator-update.cjs"=58ms
Stop             hooks=8 wall median=5922 ms  min=5793  slowest: "hooks/run-hook.cmd" on-stop=6242ms, node "scripts/hmi-compliance-poll.cjs" --hoo=289ms
 20:03:25 up  1:18,  1 user,  load average: 2.05, 5.33, 9.23
== AFTER-RERUN 2b again
 20:03:25 up  1:18,  1 user,  load average: 2.05, 5.33, 9.23
UserPromptSubmit hooks=8 wall median=1312 ms  min=1135  slowest: "hooks/run-hook.cmd" intent-classifier=1313ms, node "scripts/first-install-router.cjs"=215ms
PostToolUse      hooks=2 wall median=684 ms  min=664  slowest: node "scripts/query-efficiency-telemetry.cjs=708ms, node "scripts/operator-update.cjs"=63ms
Stop             hooks=8 wall median=6148 ms  min=6104  slowest: "hooks/run-hook.cmd" on-stop=6158ms, node "scripts/ambient-stop.cjs" --stop=358ms
 20:03:52 up  1:19,  1 user,  load average: 2.11, 5.07, 9.04
```
```
 20:04:08 up  1:19,  1 user,  load average: 1.79, 4.86, 8.91
UserPromptSubmit hooks=8 wall median=1281 ms  min=1214  slowest: "hooks/run-hook.cmd" intent-classifier=1409ms
PostToolUse      hooks=2 wall median=658 ms  min=624  slowest: node "scripts/query-efficiency-telemetry.cjs=66
 20:04:17 up  1:19,  1 user,  load average: 1.75, 4.75, 8.83
UserPromptSubmit hooks=8 wall median=1547 ms  min=1376  slowest: "hooks/run-hook.cmd" intent-classifier=1789ms
PostToolUse      hooks=2 wall median=647 ms  min=616  slowest: node "scripts/query-efficiency-telemetry.cjs=64
 20:04:23 up  1:19,  1 user,  load average: 1.77, 4.70, 8.79
UserPromptSubmit hooks=8 wall median=1554 ms  min=988  slowest: "hooks/run-hook.cmd" intent-classifier=1622ms,
PostToolUse      hooks=2 wall median=789 ms  min=708  slowest: node "scripts/query-efficiency-telemetry.cjs=84
 20:04:30 up  1:19,  1 user,  load average: 1.70, 4.64, 8.75
UserPromptSubmit hooks=8 wall median=1426 ms  min=1417  slowest: "hooks/run-hook.cmd" intent-classifier=1615ms
PostToolUse      hooks=2 wall median=830 ms  min=695  slowest: node "scripts/query-efficiency-telemetry.cjs=87
 20:04:37 up  1:20,  1 user,  load average: 1.60, 4.52, 8.67
UserPromptSubmit hooks=8 wall median=1281 ms  min=1236  slowest: "hooks/run-hook.cmd" intent-classifier=1286ms
PostToolUse      hooks=2 wall median=771 ms  min=660  slowest: node "scripts/query-efficiency-telemetry.cjs=80
 20:04:43 up  1:20,  1 user,  load average: 1.55, 4.46, 8.62
```

### After, set 3 (quiet host, the set used for the CHANGELOG)

```
== AFTER-QUIET 2a
 20:12:50 up  1:27,  1 user,  load average: 0.55, 2.21, 5.99
lock absent
== AFTER-QUIET 2b restored harness
 20:12:56 up  1:27,  1 user,  load average: 0.59, 2.19, 5.97
UserPromptSubmit hooks=8 wall median=951 ms  min=841  slowest: "hooks/run-hook.cmd" intent-classifier=1122ms, node "scripts/first-install-router.cjs"=158ms
PreToolUse       hooks=0 wall median=0 ms  min=0  slowest: 
PostToolUse      hooks=2 wall median=517 ms  min=495  slowest: node "scripts/query-efficiency-telemetry.cjs=528ms, node "scripts/operator-update.cjs"=54ms
Stop             hooks=8 wall median=5952 ms  min=5708  slowest: "hooks/run-hook.cmd" on-stop=6023ms, node "scripts/hmi-compliance-poll.cjs" --hoo=283ms
 20:13:21 up  1:28,  1 user,  load average: 0.80, 2.11, 5.84
== AFTER-QUIET 2c UserPromptSubmit
 20:13:21 up  1:28,  1 user,  load average: 0.80, 2.11, 5.84
UserPromptSubmit tool=undefined hooks=8 wall median=1001 ms  min=983  slowest: "hooks/run-hook.cmd" intent-classifier=1097ms, node "scripts/first-install-router.cjs"=179ms
  hook "hooks/run-hook.cmd" intent-classifier max=1097 ms
  hook node "scripts/first-install-router.cjs" max=179 ms
  hook node "scripts/operator-update.cjs" max=124 ms
  hook node "scripts/brain-derivation-drain.cjs" max=121 ms
  hook node "scripts/mva-detect.cjs" max=118 ms
  hook node "scripts/jtbd-update.cjs" userprompt max=116 ms
  hook node "scripts/auto-explore-drain.cjs" max=101 ms
  hook node "scripts/admin-command-gate.cjs" max=79 ms
== AFTER-QUIET 2c PostToolUse
 20:13:24 up  1:28,  1 user,  load average: 0.80, 2.11, 5.84
PostToolUse      tool=Read hooks=2 wall median=554 ms  min=522  slowest: node "scripts/query-efficiency-telemetry.cjs=616ms, node "scripts/operator-update.cjs"=65ms
  hook node "scripts/query-efficiency-telemetry.cjs" max=616 ms
  hook node "scripts/operator-update.cjs" max=65 ms
== AFTER-QUIET 2c Stop
 20:13:26 up  1:28,  1 user,  load average: 0.82, 2.09, 5.81
lock absent
 20:13:32 up  1:28,  1 user,  load average: 0.91, 2.09, 5.79
Stop             tool=undefined hooks=7 wall median=6014 ms  min=5978  slowest: "hooks/run-hook.cmd" on-stop=6151ms, node "scripts/hmi-compliance-poll.cjs" --hoo=278ms
  hook "hooks/run-hook.cmd" on-stop max=6151 ms
  hook node "scripts/hmi-compliance-poll.cjs" --hook max=278 ms
  hook node "scripts/gsd-graph-derive-sweep.cjs" max=88 ms
  hook node "scripts/check-card-fire.cjs" max=84 ms
  hook node "scripts/operator-update.cjs" max=81 ms
  hook node "scripts/jtbd-update.cjs" stop max=79 ms
  hook node "scripts/check-voice-style.cjs" max=67 ms
== AFTER-QUIET 2c PreCompact
 20:13:53 up  1:28,  1 user,  load average: 2.06, 2.27, 5.79
PreCompact       tool=undefined hooks=1 wall median=1153 ms  min=1091  slowest: "hooks/run-hook.cmd" pre-compact=1275ms
  hook "hooks/run-hook.cmd" pre-compact max=1275 ms
== AFTER-QUIET 2c PostCompact
 20:13:57 up  1:28,  1 user,  load average: 2.05, 2.26, 5.77
PostCompact      tool=undefined hooks=1 wall median=8574 ms  min=542  slowest: "hooks/run-hook.cmd" post-compact=31196ms
  hook "hooks/run-hook.cmd" post-compact max=31196 ms
== AFTER-QUIET 2c PreToolUse Write
 20:14:40 up  1:29,  1 user,  load average: 2.04, 2.23, 5.61
PreToolUse       tool=Write hooks=1 wall median=70 ms  min=58  slowest: "hooks/run-hook.cmd" write-scope-check=79ms
  hook "hooks/run-hook.cmd" write-scope-check max=79 ms
== AFTER-QUIET 2c PreToolUse brain_query
 20:14:40 up  1:29,  1 user,  load average: 2.04, 2.23, 5.61
PreToolUse       tool=mcp__plugin_mos_mindrian-brain__brain_query hooks=1 wall median=476 ms  min=432  slowest: node "scripts/part8-egress-guard-hook.cjs"=506ms
  hook node "scripts/part8-egress-guard-hook.cjs" max=506 ms
== AFTER-QUIET 2c PreToolUse gate_answer
 20:14:42 up  1:29,  1 user,  load average: 2.04, 2.23, 5.61
PreToolUse       tool=mcp__plugin_mos_mindrian-os__gate_answer hooks=1 wall median=46 ms  min=42  slowest: node "scripts/card-before-answer-hook.cjs"=50ms
  hook node "scripts/card-before-answer-hook.cjs" max=50 ms
 20:14:42 up  1:29,  1 user,  load average: 2.04, 2.23, 5.61
== AFTER-QUIET 2e
2026-10-29T18:13:33Z on-stop-state mode=skip reason=unchanged
2026-10-29T18:13:42Z on-stop-state mode=skip reason=unchanged
2026-10-29T18:13:48Z on-stop-state mode=skip reason=unchanged
```

### After, SessionStart once (npm reconcile skipped, 1 run)

```
== AFTER SessionStart (SKIP npm reconcile, 1 run)
 20:15:02 up  1:29,  1 user,  load average: 1.81, 2.16, 5.52
SessionStart     tool=startup hooks=8 wall median=9471 ms  min=9471  slowest: "hooks/run-hook.cmd" session-start=9464ms, node "scripts/agentshield-sessionstart-scan.=413ms
  hook "hooks/run-hook.cmd" session-start max=9464 ms
  hook node "scripts/agentshield-sessionstart-scan.cjs" max=413 ms
  hook node "scripts/sessionstart-coordinator.cjs" max=411 ms
  hook node "scripts/sessionstart-reference-now-seed.cjs" max=208 ms
  hook node "scripts/gsd-graph-derive-drain.cjs" max=195 ms
  hook node "scripts/sessionstart-post-update-preflight.cjs" max=98 ms
  hook node "scripts/check-pending-breakthrough.cjs" max=83 ms
  hook node "scripts/check-pending-ambiguous.cjs" max=82 ms
 20:15:12 up  1:29,  1 user,  load average: 2.31, 2.26, 5.51
```

Compare with quick lx3 (PROVEN from that SUMMARY): 11,520 ms median when the summary is reused, 41,682 ms for the first start after a rebuild, 58.9 s on a loaded host. This run: 9,471 ms median (session-start 9,464 ms, coordinator 411 ms), load 1.81 at the start. The run was on the reuse path (ASSUMED; the room was warm after the measurement runs above and I did not read the session-start log). It is 1 run; it shows no timeout pressure on the 180 s budget (ratio 0.053).

### Comparison table (restored harness, step 2b, median of 3 runs, 1-minute load at the start of each command)

| Event | Before median (ms) | After median (ms) | Before load | After load | Verdict |
|-------|--------------------|-------------------|-------------|------------|---------|
| UserPromptSubmit | 862 | 951 (set 3) | 1.59 | 0.59 | no change within noise (+10 percent) |
| PostToolUse (Read) | 462 | 517 (set 3) | 1.59 | 0.59 | no change within noise (+12 percent) |
| Stop | 5,351 | 5,952 (set 3) | 1.59 | 0.59 | no change within noise (+11 percent) |
| UserPromptSubmit | 862 | 1,290 (set 1) | 1.59 | 2.78 | inconclusive (load; difference 1.19 is above 1.0) |
| PostToolUse (Read) | 462 | 972 (set 1) | 1.59 | 2.78 | inconclusive (load) |
| Stop | 5,351 | 6,662 (set 1) | 1.59 | 2.78 | inconclusive (load) |
| UserPromptSubmit | 862 | 1,413 then 1,312 (set 2) | 1.59 | 1.46 then 2.05 | differs by 64 and 52 percent at a similar 1-minute load; see below |
| PostToolUse (Read) | 462 | 543 then 684 (set 2) | 1.59 | 1.46 then 2.05 | +18 percent, then +48 percent |
| Stop | 5,351 | 5,922 then 6,148 (set 2) | 1.59 | 1.46 then 2.05 | +11 percent, then +15 percent |

Set 2 differed in UserPromptSubmit although the 1-minute load matched. The plan says to run the event once more (done: "2b again", then 5 more runs in the noise series, prompt submit 1,281 to 1,554 ms at load 1.55 to 1.79) and then to report it as an open finding. Cause (ASSUMED): the 5-minute and 15-minute load averages were high (set 2 start: 5.45 and 9.36; before set: 1.99 and 4.08) because of a peer ffmpeg job, which the 1-minute value does not show. Set 3 was taken after the 5-minute load fell to 2.19 (15-minute 5.97) and it reads within 12 percent of the before set. Per the plan I did not revert anything: the timeouts cannot change the time of a hook that finishes under its budget. The prompt-submit gap of set 2 stays an open finding, resolved only by set 3 and the ASSUMED cause. The before and the set 3 loads differ by exactly 1.00 (1.59 against 0.59), which is not more than 1.0, so set 3 is valid by the plan rule.

The two sets 1 and 2 are not used in the CHANGELOG.

### Headroom table (worst ms = max over all after runs including set 1 and set 3, plus the 50 MB transcript-leg max where the hook ran there)

Pass means ratio 0.33 or less.

| Event | Hook | Worst ms | Budget s | Ratio | Result |
|-------|------|----------|----------|-------|--------|
| PostCompact | post-compact | 38,881 | 120 | 0.324 | PASS (ruling); the hook itself is finding 5 |
| UserPromptSubmit | intent-classifier | 4,635 (4,555 in set 1 harness line, plus 80 transcript leg) | 5 | 0.927 | FINDING (one loaded run; other runs 847 to 1,523 ms) |
| Stop | on-stop | 7,139 (set 1 harness line); 6,812 per-hook lines | 20 | 0.357 | C-1 fixed |
| SessionStart | session-start | 9,464 | 180 | 0.053 | C-1 fixed, PASS |
| SessionStart | sessionstart-coordinator | 411 | 40 | 0.010 | C-1 fixed, PASS (warm start only; the cold 12.3 s start was not re-measured) |
| SessionStart | npm-reconcile | not measured | 150 | n/a | C-1 fixed, network-capable |
| PostToolUse | query-efficiency-telemetry | 1,013 (set 1 harness line) | 3 | 0.338 | FINDING (slightly above 0.33, one loaded run; quiet set 616 ms = 0.205) |
| PreCompact | pre-compact | 1,403 | 6 | 0.234 | PASS |
| PreToolUse | part8-egress-guard-hook | 834 | 5 | 0.167 | PASS |
| PreToolUse | card-before-answer-hook | 149 (109 real room + 40 transcript) | 3 | 0.050 | PASS |
| PreToolUse | write-scope-check | 102 | 3 | 0.034 | PASS |
| UserPromptSubmit | first-install-router | 289 | 3 | 0.096 | PASS |
| UserPromptSubmit | other 6 hooks | at most 189 | 3 | at most 0.063 | PASS |
| Stop | hmi-compliance-poll | 368 | 5 | 0.074 | PASS |
| Stop | other 5 hooks | at most 177 | 5 | at most 0.035 | PASS |
| PostToolUse | operator-update | 65 | 5 | 0.013 | PASS |
| SessionStart | agentshield-sessionstart-scan | 413 | 8 | 0.052 | PASS |
| SessionStart | other 5 hooks | at most 208 | 3 or 5 or 12 | at most 0.042 | PASS |

Not measured on the real room (by plan): the write-path PostToolUse hooks (R-4), on-cwd-changed, on-agent-complete, on-task-complete (R-5), session-end-presence, on-file-changed, brain-response-sanitize-hook, telemetry-command-invocation, ambient-stop (async), npm reconcile. Their budgets rest on the C-1 rule and sandbox numbers.

on-stop note (PROVEN): 7,139 ms in the harness line of set 1 is 0.357 of 20 s. The per-hook lines of the quiet set gave 6,151 ms. The row is C-1 fixed and it is not raised.

### CHANGELOG (PROVEN)

One bullet, one line, added at the end of "### Changed" under [Unreleased]. It carries "50 minutes", "33 hours", the budgets in words (the post-compact hook is 2 minutes after the ruling; the first commit said 74 seconds), the set 3 medians (862 to 951 ms, 462 to 517 ms, 5,351 to 5,952 ms), load 1.6 before and 0.6 after, the privacy guard sentence with "Claude Code v2.1.295 or later", the Claude Code only sentence, and "Not live until a release carries it." No em-dash and no en-dash. The line "Each limit is at least 3 times the slowest run we measured when we set it" is true for the Task 1 measurement. It is also true for post-compact after the ruling (3 x 38.9 s is 116.6 s, limit 120 s). The bullet also holds one sentence that the post-compact hook measured 24 to 39 seconds against its own 2-second target and is not fixed here.

## Known Stubs

None.

## Threat Flags

None new. T-qef-01 mitigated (onFailure block pinned by arm A5). T-qef-02 mitigated (all 46 budgets in seconds). T-qef-03 mitigated (45 s for the compute-state hooks; not measured, R-5). T-qef-04 accepted: the guard max was 834 ms against a 5 s budget (0.167). T-qef-06 accepted: the benchmark rewrote room files as the baseline did. T-qef-07 mitigated: the transcript leg ran in a scratch dir with an empty rooms home. T-qef-08 mitigated by the 150 s against 120 s order (not re-measured).

## Self-Check: PASSED

- FOUND: tests/test-261029-qef-hook-timeouts.cjs, hooks/hooks.json, scripts/measure-hook-cold-start.cjs, scripts/check-session-start-verification.cjs, tests/test-mux-card-before-answer.cjs, CHANGELOG.md.
- FOUND: commits 6022aaa8c, 683a6b83c, f36bdc352, 950b5794c, 93b3cdb78; all ancestors of HEAD.
- Peer files untouched: .planning/ROADMAP.md (peer "### Phase 381" section), .planning/phases/381-*, .planning/debug/379-1-1-10-large-room-drain-clock-breach.md, and a second untracked peer file that appeared during the run: .planning/debug/compute-team-analyze-room-python-date-fallback-injection.md.

## Report fields

STATUS: DONE (3 of 3 tasks done; the orchestrator ruling on post-compact is applied; no open NEEDS_HUMAN)

CHANGED: tests/test-261029-qef-hook-timeouts.cjs (new, 6022aaa8c; A3 and A4 updated in 950b5794c); hooks/hooks.json, scripts/measure-hook-cold-start.cjs, scripts/check-session-start-verification.cjs, tests/test-mux-card-before-answer.cjs (683a6b83c; hooks.json post-compact 74 to 120 in 950b5794c); CHANGELOG.md (f36bdc352, then 93b3cdb78). .planning/quick/261029-qef-.../261029-qef-PLAN.md has the DD-1 row 11 at 120 (not committed by me). This SUMMARY is not committed.

VERIFIED: node tests/test-261029-qef-hook-timeouts.cjs gives ALL PASS (9 arms) after the ruling; hooks.json diff against a13ab61f1 is 45 timeout lines plus 1 onFailure line; check-session-start-verification --json gives 0 violations; measure-hook-cold-start gives 45 of 46 measured, 0 breaches, only npm reconcile skipped (run before the ruling; the ruling changes one timeout number and the harness does not apply timeouts); claude plugin validate exit 0 (run again after the ruling); baseline and after test table shows no new failure except deviation 2 (message moved) and deviation 3 (flake, rerun passes); real-room medians in the quiet set 862 to 951 ms, 462 to 517 ms, 5,351 to 5,952 ms (no change within noise); all 5 shas are ancestors of HEAD.

UNVERIFIED: effect of onFailure on Claude Code older than v2.1.295 (ASSUMED ignored); whether Claude Code waits for the background subshell of on-agent-complete (ASSUMED); the cause of the post-compact spikes; the cause of the set 2 prompt-submit gap (ASSUMED peer load); the 9 run-all-369 baseline failures and the S3 failure (same before and after, causes not read); budgets of hooks not measured on the real room (write-path PostToolUse hooks, cwd, agent and task hooks at 45 s, session-end, npm reconcile never run); measure-hook-cold-start and plugin validate were not re-run for the full 46-entry harness after the 120 s ruling beyond validate (exit 0).

RISKS: (1) intent-classifier had one 4,555 ms run against a 5 s budget under heavy host load (ratio 0.93); a cancel loses that prompt's hook output. (2) query-efficiency-telemetry reached 1,013 ms in a loaded run (0.338 of 3 s); quiet set 616 ms. (3) on-stop reached 7,139 ms against 20 s (0.357; C-1 fixed). (4) The Part 8 guard blocks on a timeout; worst measured 834 ms against 5 s. (5) tests/test-3551-tri-polar.cjs pins hooks.json to 2f5109bef and needs a re-base. (6) tests/fixtures/369/hook-cold-start-baseline.json shows old budgets (DD-5). (7) post-compact at 120 s means a hung post-compact can hold the session for up to 2 minutes. (8) The variant harness skips async hooks; the restored harness does not.

NEXT: (1) Finding 5 for the perf chain: the post-compact hook takes 24 to 39 s on the real room (first of 3 runs spikes; median 7 to 12 s) against its own 2 s target; fix or profile it. (2) Commit this SUMMARY, PLAN.md and STATE.md. (3) Review the 5 commits ahead of origin before any push. (4) Re-base tests/test-3551-tri-polar.cjs and regenerate or annotate the hook-cold-start-baseline fixture in a later quick.

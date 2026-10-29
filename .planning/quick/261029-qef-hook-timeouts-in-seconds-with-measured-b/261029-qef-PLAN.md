---
phase: 261029-qef-hook-timeouts-in-seconds-with-measured-b
plan: 01
quick_id: 261029-qef
slug: hook-timeouts-in-seconds-with-measured-b
date: 2026-10-29
type: execute
wave: 1
depends_on: []
files_modified:
  - tests/test-261029-qef-hook-timeouts.cjs
  - hooks/hooks.json
  - scripts/measure-hook-cold-start.cjs
  - scripts/check-session-start-verification.cjs
  - tests/test-mux-card-before-answer.cjs
  - CHANGELOG.md
autonomous: true
requirements:
  - 261029-qef
canon_parts: [8]
objective: "Perf change B: every hooks.json timeout becomes a measured budget in seconds (DD-1), the Part 8 egress guard blocks the Brain call when it fails or times out (DD-2), and the two repo readers of hook timeouts read seconds (DD-3, DD-4)."

must_haves:
  truths:
    - "Every command hook timeout in hooks/hooks.json is an integer number of seconds from 1 to 180, and it equals the DD-1 value (after the DD-1 raise rule)"
    - "Only three hooks have a timeout above 100: sessionstart-npm-reconcile.cjs at 150, run-hook.cmd session-start at 180 and run-hook.cmd post-compact at 120 (orchestrator ruling 2026-10-29)"
    - "The Part 8 egress guard hook entry carries \"onFailure\": \"block\"; no other hook entry has an onFailure key (DD-2)"
    - "The JSON shape, the hook order, the matchers, the commands, async and statusMessage are identical to a13ab61f1; only timeout values changed and one onFailure line was added"
    - "scripts/measure-hook-cold-start.cjs reads every hooks.json timeout as seconds, and it skips only the npm reconcile hook as network-capable (DD-3)"
    - "scripts/check-session-start-verification.cjs reads the preflight budget as 12 seconds (DD-4)"
    - "claude plugin validate accepts the plugin after the change"
    - "The real-room event medians before and after, the host load of each run, and the per-hook headroom are recorded; every measured hook max stays at or below one third of its budget, or the SUMMARY names the hook"
    - "CHANGELOG.md [Unreleased] / ### Changed has one bullet that names 50 minutes, 33 hours, the new budgets in words, the measured medians, and ends with \"Not live until a release carries it.\""
  artifacts:
    - path: "hooks/hooks.json"
      provides: "Hook budgets in seconds; fail-closed Part 8 guard"
      contains: "\"onFailure\": \"block\""
    - path: "tests/test-261029-qef-hook-timeouts.cjs"
      provides: "Regression test, arms A1..A9"
      min_lines: 150
    - path: "scripts/measure-hook-cold-start.cjs"
      provides: "Seconds unit rule and a command-based network-capable rule"
      exports: ["isNetworkCapable", "parseHookCommands"]
    - path: "scripts/check-session-start-verification.cjs"
      provides: "Preflight budget check in seconds"
      contains: "HOOK_BUDGET_S"
    - path: "CHANGELOG.md"
      provides: "One measured bullet under [Unreleased] / ### Changed"
      contains: "33 hours"
  key_links:
    - from: "tests/test-261029-qef-hook-timeouts.cjs"
      to: "scripts/measure-hook-cold-start.cjs"
      via: "require, then parseHookCommands(HOOKS_JSON) and isNetworkCapable(entry)"
      pattern: "isNetworkCapable"
    - from: "tests/test-261029-qef-hook-timeouts.cjs"
      to: "scripts/check-session-start-verification.cjs"
      via: "spawn with CHECK_SESSION_START_ROOT and --json, read the violation ids"
      pattern: "CHECK_SESSION_START_ROOT"
    - from: "tests/test-mux-card-before-answer.cjs H7"
      to: "hooks/hooks.json card-before-answer entry"
      via: "parseHookCommands timeout_ms === 3000"
      pattern: "DECLARED_BUDGET_MS"
    - from: "hooks/hooks.json part8-egress-guard-hook entry"
      to: "Claude Code PreToolUse failure handling"
      via: "onFailure block (Claude Code v2.1.295 or later)"
      pattern: "\"onFailure\": \"block\""
---

# Quick 261029-qef: hook timeouts in seconds with measured budgets (perf change B)

<objective>
Give every plugin hook a real time limit.

Claude Code reads the hooks.json `timeout` field in SECONDS (PROVEN, https://code.claude.com/docs/en/hooks, "Seconds before canceling", read 2026-10-29). The plugin writes millisecond-scale values. Claude Code therefore reads 3000 as 50 minutes and 120000 as 33 hours. No slow hook is ever cancelled, and a hung hook can stall the session for that long.

After this plan:
1. Each of the 46 command hooks has a budget in seconds from the DD-1 table. The rule: at least 3 times the measured worst case, minimum 3 seconds, or the value the orchestrator fixed.
2. The Part 8 egress guard (scripts/part8-egress-guard-hook.cjs) carries `"onFailure": "block"`. A cancelled or crashed guard then blocks the Brain call (DD-2).
3. scripts/measure-hook-cold-start.cjs and scripts/check-session-start-verification.cjs read the timeout as seconds (DD-3, DD-4).
4. A new test pins the table, the guard setting, the shape and the two readers.
5. The real-room medians before and after are recorded. The expected result is "no change within noise". The gain is a bounded stall time, not speed.

Output: tests/test-261029-qef-hook-timeouts.cjs (new), hooks/hooks.json, scripts/measure-hook-cold-start.cjs, scripts/check-session-start-verification.cjs, tests/test-mux-card-before-answer.cjs (H7 pin), CHANGELOG.md (one bullet).
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@hooks/hooks.json
@scripts/measure-hook-cold-start.cjs
@scripts/check-session-start-verification.cjs

The agent interaction protocol applies: /home/jsagi/.claude/protocols/agent-interaction-protocol.md. Write STE-style English in the SUMMARY. Do not address the human. Do not call AskUserQuestion. End with STATUS, CHANGED, VERIFIED, UNVERIFIED, RISKS, NEXT.

Tri-Polar: hooks.json is a Claude Code CLI artifact only. Desktop and Cowork do not run these hooks, so they are unaffected. Project skills (.claude/skills: claude-md-optimizer, spike-findings-MindrianOS-Plugin, mindrian-mcp-app) do not cover hooks.json; none applies.

## Locked constraints from the orchestrator (C-1..C-8)

- C-1: Budget rule. Each budget in seconds is at least 3 times the measured worst case of that hook, minimum 3. Fixed values (orchestrator ruling 2026-10-29, 3x rule applied to the measured worst case, rounded up to a round number): session-start 180 (58.9 s loaded host x 3 = 177), sessionstart-npm-reconcile 150 (its internal npm timeout of 120 s must fire first), sessionstart-coordinator 40 (12.3 s x 3 = 37), on-stop 20 (5.8 s x 3 = 17.4), intent-classifier 5, query-efficiency-telemetry 3. Every other hook: 5 for Stop and PostToolUse, 3 for UserPromptSubmit and PreToolUse, unless a measured number says otherwise. Do not divide by 1000 mechanically.
- C-2: Part 8 fail-closed decision for the guard, write-scope-check and card-before-answer-hook (DD-2).
- C-3: ambient-stop keeps 5 (seconds).
- C-4: Keep the JSON shape. Change only the timeout numbers and add the one onFailure line of DD-2. Do not reorder hooks. Validate with JSON.parse.
- C-5: Measure before and after on the real room /mnt/c/Users/jsagi/MindrianRooms/israel-frontier-criticality/translational-capital-lab with the restored harness, 3 runs, with `uptime` per run. SessionStart is measured once after the change, only if npm-reconcile can be skipped.
- C-6: One CHANGELOG bullet, plain English, Feynman style, hyphens only, real numbers only, ends with "Not live until a release carries it."
- C-7: Commits use git commit --only per file group, repo style (test(261029-qef): ..., fix(261029-qef): ..., docs(261029-qef): ...), each ending with the line "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>". Do not push. Do not commit PLAN.md, SUMMARY.md or STATE.md.
- C-8: Peer rule. Before the first edit of a file, run git status --porcelain on it. A change that this executor did not make means: stop, return NEEDS_HUMAN with the path. Never touch /home/jsagi/gsd-workspaces/phase-369-6 (peer session jsagi-bc). No new dependency. Hooks stay .cjs. No em-dash and no en-dash in any file you write.

## Facts found in planning (PROVEN unless marked)

- PROVEN (docs): `onFailure` exists for command hooks, values "continue" or "block", Claude Code v2.1.295 or later. With "block", these count as a failure and act like exit 2: the hook cannot start, exits with a code other than 0 or 2, reaches its timeout, or prints JSON that fails to parse. On PreToolUse, a timed-out hook without onFailure does not block the call. onFailure has no effect on Stop, SubagentStop, TaskCompleted and async hooks. SessionEnd hooks share a 1.5 s budget, raised to the largest per-hook timeout, up to 60 s.
- PROVEN: local Claude Code is 2.1.312. `claude plugin validate <dir>` on 2.1.312 accepts `"onFailure": "block"`, accepts an unknown handler key, and REJECTS an invalid onFailure value with "Invalid command hook ... nothing it sits in is applied". A typo in the value therefore disables the guard; the test pins the exact string.
- PROVEN: scripts/part8-egress-guard-hook.cjs writes nothing to stdout, exits 2 only on a block, and exits 0 on any internal error (try/catch plus an uncaughtException handler, lines 368-378, accepted risk A3). With onFailure block, only a timeout, a start failure or a hard kill becomes a block. The internal fail-open on a parse error is unchanged.
- PROVEN: hooks/hooks.json was last changed by a13ab61f1. 46 command hooks. Values today: 3000 x23, 2000 x11, 5000 x3, 1500 x3, 10000 x2, 120000, 12000, 8000, 5 (ambient-stop, async).
- PROVEN: scripts/sessionstart-npm-reconcile.cjs has no skip env var (it reads only CLAUDE_PLUGIN_ROOT and MINDRIAN_OS_ROOT). Its npm call has an internal timeout of 120000 ms (lines 113 and 123; lib/core/mcp-dep-heal.cjs DEFAULT_INSTALL_TIMEOUT_MS = 120000).
- PROVEN: three hooks run compute-state, which takes 8.4 to 13.4 s on the real room (perf-audit-baseline.md section 3): on-cwd-changed (synchronous, scripts/on-cwd-changed line 108), on-task-complete (synchronous, line 51), on-agent-complete (background subshell `sleep 1` plus compute-state plus state-write, lines 147-152). ASSUMED: Claude Code waits until the hook's stdout pipe closes, so the background subshell of on-agent-complete counts toward its time.
- PROVEN: scripts/pre-compact has an internal cap MAX_MS=1800 (lines 143-145). scripts/post-compact documents a 2500 ms wall-clock test (lines 218-221).
- PROVEN (run 2026-10-29, load 2.03): tests/test-mux-card-before-answer.cjs H7 measured the card-before-answer hook on a 5 MB transcript: median 42.3 ms, max 46.0 ms. The same run has 1 failure, S3 ("every gateLedger.mintGate( call site stores a renderer"), unrelated to this plan.
- PROVEN (run 2026-10-29): tests/test-3551-tri-polar.cjs exits 1 today at "hooks.json[PreToolUse] must be unchanged from BASE_3551" (2f5109bef). This is a pre-existing failure. After this plan it fails at the same assertion. Name it in the SUMMARY; do not edit it.
- PROVEN: `CHECK_SESSION_START_ROOT=$PWD node scripts/check-session-start-verification.cjs --check` prints "OK (0 violations)" today.
- Readers of hook timeouts, from a grep of tests/, lib/, scripts/ and bin/ for hooks.json readers that touch `.timeout` or `timeout_ms`:
  - tests/test-mux-card-before-answer.cjs line 179-180: `const BUDGET_MS = 2000; if (entry.timeout_ms !== BUDGET_MS) return 'declared budget ...'`. BREAKS after the change. Task 2 updates it.
  - tests/test-3551-tri-polar.cjs line 343: `assert.strictEqual(newHook.timeout, 5, ...)` on ambient-stop. Holds (C-3). Line 327 already fails (see above).
  - tests/test-369-hook-require-graph.cjs arm 3 (line 258-284): reads only tests/fixtures/369/hook-cold-start-baseline.json, p95_ms < timeout_ms inside the fixture. Holds. The fixture is not regenerated (DD-5).
  - tests/test-369-installed-layout.cjs arm 7 (line 288-296): parseHookCommands on the installed hooks.json, r.ms > e.timeout_ms. Holds with larger budgets.
  - scripts/check-session-start-verification.cjs line 57 and 113-122: HOOK_BUDGET_MS = 12000 compared to the raw timeout. After the change 12 would pass but 12000 seconds would pass too. Task 2 fixes it (DD-4).
  - scripts/measure-hook-cold-start.cjs line 45, 66-70, 306: the unit rule (declared < 100 means seconds) and the heavy rule (timeout_ms > 30000 means not measured). After the change, 150 and 180 are read as 150 ms and 180 ms, so the harness would SPAWN the npm reconcile hook in measureAll. Task 2 fixes it (DD-3).
  - Checked, no timeout pin: the orchestrator list test-225-zero-score-gate, test-233-graph-derive-health, test-226-session-binding-key-alignment, test-225-answer-narrowing, test-225-gate-degrade, test-237-post-write-session-stamp, test-240.1-ctxl-eval-gate, test-245-trigger-negative, test-245-reward-guard-staged (their `timeout: 30000` is a spawnSync limit); test-198-adapter-budget (on-stop dispatch form only); test-239-brain-tool-liveness, test-251-skeleton-split, test-quick-260911-juq-hooks-json-top-level, test-341-update-collapsed (SessionStart count 9), lib/memory/sessionstart-coordinator.test.cjs Test 14, lib/mcp/hook-adapter-audit.cjs (line budgets, not timeouts). No test pins a SHA of hooks.json.

## Interfaces (verbatim at HEAD 986793361)

scripts/measure-hook-cold-start.cjs lines 66-71 (the unit rule) and 306-309 (the heavy rule):

```js
        const declared = typeof h.timeout === 'number' ? h.timeout : null;
        let timeoutMs = declared;
        let note = null;
        if (declared !== null && declared < 100) {
          timeoutMs = declared * 1000;
          note = 'declared ' + declared + ' read as seconds';
        }
...
      if (e.timeout_ms > HEAVY_TIMEOUT_MS && !opts.includeHeavy) {
        rec.not_measured = 'budget over 30 s, network-capable';
        results.push(rec);
        continue;
      }
```

Line 474: `module.exports = { payloadFor, parseHookCommands, makeSandbox, hookEnv, spawnHook, percentile, statsOf, HOOKS_JSON, REPO_ROOT };`

scripts/check-session-start-verification.cjs line 57 and 113-122:

```js
const HOOK_BUDGET_MS = 12000;
...
    const timeout = inner && inner.timeout;
    if (typeof timeout !== 'number') {
      out.push(violation('preflight-timeout-present', 'the preflight hook entry carries no numeric timeout',
        'set "timeout": ' + HOOK_BUDGET_MS + ' on the preflight entry in hooks/hooks.json'));
    } else if (timeout > HOOK_BUDGET_MS) {
      out.push(violation('preflight-timeout-budget', 'the preflight hook timeout is ' + timeout + ' ms (budget ' + HOOK_BUDGET_MS + ' ms)',
        'lower the preflight timeout to at most ' + HOOK_BUDGET_MS + ' ms; do not raise the hook budget'));
    }
```

The CLI accepts --check and --json; --json prints `{ ok, violations: [{ id, message, remedy }] }`. Seams: CHECK_SESSION_START_ROOT (repo root to inspect), MOS_SESSION_VERIFY_HOME (state root).

## Design decisions made in planning (DD-1..DD-6)

- DD-1: The budget table below. "Today" is the declared value, which Claude Code reads as seconds. "Sandbox" is the p95 from tests/fixtures/369/hook-cold-start-baseline.json (2026-10-02, no room in cwd). Real-room numbers come from perf-audit-baseline.md, quick 261029-kqv and quick 261029-lx3.

| # | Event | Hook | Today | New (s) | Basis |
|---|-------|------|-------|---------|-------|
| 1 | SessionStart | sessionstart-npm-reconcile.cjs | 120000 | 150 | Fixed by C-1. Unmeasured; may run npm install; internal npm timeout 120 s fires first, so the hook cancel never holds the npm lock (R-2 closed) |
| 2 | SessionStart | sessionstart-post-update-preflight.cjs | 12000 | 12 | D-07a (b) 12 s budget, checked by check-session-start-verification; sandbox 29.6 ms |
| 3 | SessionStart | run-hook.cmd session-start | 10000 | 180 | Fixed by C-1. Real room 41,682 ms first start after a rebuild, 58.9 s on a loaded host (3.1x) |
| 4 | SessionStart | sessionstart-coordinator.cjs | 10000 | 40 | Fixed by C-1. Cold first start 12,342 ms (3.2x); warm 245 ms |
| 5 | SessionStart | sessionstart-reference-now-seed.cjs | 5000 | 5 | Sandbox 91.9 ms |
| 6 | SessionStart | check-pending-breakthrough.cjs | 2000 | 3 | Minimum; sandbox 29.6 ms |
| 7 | SessionStart | check-pending-ambiguous.cjs | 2000 | 3 | Minimum; sandbox 29.4 ms |
| 8 | SessionStart | gsd-graph-derive-drain.cjs | 5000 | 5 | Sandbox 92.7 ms |
| 9 | SessionStart | agentshield-sessionstart-scan.cjs | 8000 | 8 | Real room 355 to 1,044 ms on a loaded host (lx3); 3x = 3.2 s |
| 10 | PreCompact | run-hook.cmd pre-compact | 2000 | 6 | Internal cap 1,800 ms plus process start, about 2 s; 3x = 6 |
| 11 | PostCompact | run-hook.cmd post-compact | 3000 | 120 | Orchestrator ruling 2026-10-29, 3 x 38,881 ms (worst measured after the change; the 100 s cap of the raise rule is lifted for this hook). Documented 2,500 ms wall clock; sandbox 781 ms |
| 12 | Stop | run-hook.cmd on-stop | 3000 | 20 | Fixed by C-1. 4,810 ms after change A; one Phase 88 step 5,846 ms (3.4x) |
| 13 | Stop | operator-update.cjs | 3000 | 5 | C-1 Stop rule; sandbox 33.7 ms |
| 14 | Stop | jtbd-update.cjs stop | 3000 | 5 | C-1 Stop rule; sandbox 31.6 ms |
| 15 | Stop | hmi-compliance-poll.cjs --hook | 3000 | 5 | C-1 Stop rule; sandbox 36.5 ms |
| 16 | Stop | gsd-graph-derive-sweep.cjs | 3000 | 5 | C-1 Stop rule; sandbox 22.8 ms |
| 17 | Stop | check-card-fire.cjs | 3000 | 5 | C-1 Stop rule; sandbox 38.2 ms; reads the transcript |
| 18 | Stop | check-voice-style.cjs | 3000 | 5 | C-1 Stop rule; sandbox 28.5 ms; reads the transcript |
| 19 | Stop | ambient-stop.cjs --stop | 5 | 5 | C-3; async, so Claude Code does not enforce it |
| 20 | SessionEnd | session-end-presence.cjs | 3000 | 3 | Minimum; sandbox 22.7 ms; local only. The shared SessionEnd budget becomes 3 s (today capped at 60 s) |
| 21 | PreToolUse | run-hook.cmd write-scope-check | 2000 | 3 | C-1 PreToolUse rule; sandbox 36.4 ms |
| 22 | PreToolUse | part8-egress-guard-hook.cjs | 2000 | 5 | DD-2: a timeout now blocks, so the budget has more margin; sandbox 90.2 ms |
| 23 | PreToolUse | card-before-answer-hook.cjs | 2000 | 3 | C-1 PreToolUse rule; 5 MB transcript max 46.0 ms (H7, 2026-10-29) |
| 24 | PostToolUse | run-hook.cmd post-write | 3000 | 5 | C-1 PostToolUse rule; sandbox 33.2 ms |
| 25 | PostToolUse | frontmatter-schema-validator.cjs | 2000 | 5 | C-1 PostToolUse rule; sandbox 21.1 ms |
| 26 | PostToolUse | async-artifact-auto-commit.cjs | 3000 | 5 | C-1 PostToolUse rule; sandbox 31.1 ms; the commit runs in a detached worker |
| 27 | PostToolUse | memory-completion-detector.cjs | 3000 | 5 | C-1 PostToolUse rule; sandbox 24.8 ms |
| 28 | PostToolUse | auto-explore-fingerprint.cjs | 3000 | 5 | C-1 PostToolUse rule; sandbox 34 ms |
| 29 | PostToolUse | gsd-artifact-graph-hook.cjs | 3000 | 5 | C-1 PostToolUse rule; sandbox 23.5 ms |
| 30 | PostToolUse | memory-artifact-graph-hook.cjs | 3000 | 5 | C-1 PostToolUse rule; sandbox 23.5 ms |
| 31 | PostToolUse | query-efficiency-telemetry.cjs | 1500 | 3 | Fixed by C-1. Real room 622 ms |
| 32 | PostToolUse | operator-update.cjs | 3000 | 5 | C-1 PostToolUse rule; sandbox 33.3 ms |
| 33 | PostToolUse | brain-response-sanitize-hook.cjs | 3000 | 5 | C-1 PostToolUse rule; sandbox 33.5 ms |
| 34 | PostToolUse | telemetry-command-invocation.cjs | 5000 | 5 | C-1 PostToolUse rule; sandbox 30.7 ms |
| 35 | UserPromptSubmit | admin-command-gate.cjs | 2000 | 3 | C-1 UPS rule; sandbox 21.9 ms |
| 36 | UserPromptSubmit | run-hook.cmd intent-classifier | 2000 | 5 | Fixed by C-1. Real room 1,031 ms |
| 37 | UserPromptSubmit | mva-detect.cjs | 1500 | 3 | C-1 UPS rule; sandbox 33.7 ms |
| 38 | UserPromptSubmit | first-install-router.cjs | 1500 | 3 | C-1 UPS rule; sandbox 40.8 ms |
| 39 | UserPromptSubmit | brain-derivation-drain.cjs | 2000 | 3 | C-1 UPS rule; PARENT_BUDGET_MS 100, work runs in detached children |
| 40 | UserPromptSubmit | operator-update.cjs | 3000 | 3 | C-1 UPS rule; sandbox 33.6 ms |
| 41 | UserPromptSubmit | jtbd-update.cjs userprompt | 3000 | 3 | C-1 UPS rule; sandbox 33.2 ms |
| 42 | UserPromptSubmit | auto-explore-drain.cjs | 3000 | 3 | C-1 UPS rule; sandbox 34.8 ms |
| 43 | FileChanged | run-hook.cmd on-file-changed | 3000 | 3 | Minimum; the work runs in a background subshell with output on /dev/null; sandbox 10.6 ms |
| 44 | CwdChanged | run-hook.cmd on-cwd-changed | 2000 | 45 | Runs compute-state synchronously: 13.4 s worst on the real room; 3x = 40.2 |
| 45 | SubagentStop | run-hook.cmd on-agent-complete | 3000 | 45 | Background sleep 1 plus compute-state holds the pipe (ASSUMED): 14.4 s; 3x = 43.2 |
| 46 | TaskCompleted | run-hook.cmd on-task-complete | 3000 | 45 | Runs compute-state synchronously: 13.4 s; 3x = 40.2 |

  DD-1 raise rule (applies after the Task 1 measurement): for each measured hook, compute needed = ceil(3 x worst_ms / 1000), where worst_ms is the real-room per-hook max plus, for a hook that also ran in the transcript leg, the transcript-leg max (the sum, because one call can pay both). When needed is larger than the table value, use needed. Do not raise rows 1, 3, 4 and 12 (fixed by C-1); record their measured headroom in the SUMMARY instead. If needed is larger than 100 for any hook, stop and return NEEDS_HUMAN with the hook name and the number. Write the final table into the SUMMARY with a column "raised by measurement: yes/no".

- DD-2: Part 8 fail-closed decision.
  - part8-egress-guard-hook.cjs: ADD `"onFailure": "block"`, on the line directly after its "timeout" line. Reason: the field exists for command hooks (PROVEN, docs and the 2.1.312 validator). Without it, a cancelled guard lets the Brain call continue; the direct connector `mcp__pws-brain-mcp__*` has no second classification behind the hook (header of the guard, quick 260917-ild). The hook writes no stdout, so an invalid-output failure cannot occur. Its internal fail-open on a parse error stays (A3). Budget 5 s, more than 50x its sandbox cost, because a timeout is now a false block.
  - write-scope-check: NO onFailure. Reason: it fires on every Write, Edit and MultiEdit in every project, and it is fail-open by design (the guard header says "matches write-scope-check"). With block, a start failure (for example a broken install or a missing bash) would block every file write.
  - card-before-answer-hook.cjs: NO onFailure. Reason: it is degrade-open by design (arms H4 and H5 allow with a stderr degrade note). A timeout is the same degrade. The MCP gate ledger (card_pending, unknown_gate, arms S1 to S4) stays a second check. Its 5 MB cost is 46 ms, so 3 s is 65x.
  - admin-command-gate.cjs (UserPromptSubmit): NO onFailure. Reason: fail-open by design with a prose backstop; with block, a failure would drop every prompt.
  - brain-response-sanitize-hook.cjs (PostToolUse): NO onFailure. Reason: on PostToolUse the tool already ran, so block cannot stop the call.
  - On Claude Code older than v2.1.295 the effect of the key is UNVERIFIED. The 2.1.312 validator accepts unknown handler keys (PROVEN), so an older version most likely ignores the key (ASSUMED). Record this in the SUMMARY as UNVERIFIED.
- DD-3: scripts/measure-hook-cold-start.cjs. (a) A declared value below 1000 is seconds: timeout_ms = declared x 1000, note "declared N read as seconds". A value of 1000 or more is a legacy millisecond value: timeout_ms = declared, note "declared N read as legacy milliseconds". Every entry with a numeric timeout now has a note. Keep the field names (declared_timeout, timeout_ms, timeout_unit_note), because tests read them. (b) Replace the budget-based heavy rule with an exported function isNetworkCapable(entry) that returns true only when entry.command matches /sessionstart-npm-reconcile\.cjs/. Reason: after the change session-start has 180 s, and it is not network-capable; with the old rule it would stop being measured. The not_measured reason becomes "network-capable (may run npm install)". Remove HEAVY_TIMEOUT_MS. (c) Rewrite the header "Units note" to say: Claude Code reads the timeout in seconds (docs URL), quick 261029-qef converted hooks.json, the legacy branch exists for old fixtures. Update the --include-heavy usage text to say it includes the network-capable npm reconcile hook.
- DD-4: scripts/check-session-start-verification.cjs. Rename the constant to HOOK_BUDGET_S = 12. The violation fires when timeout > HOOK_BUDGET_S. Message: "the preflight hook timeout is N s (budget 12 s)". Remedies: 'set "timeout": 12 (seconds)' and "lower the preflight timeout to at most 12 seconds; do not raise the hook budget". Update header item 2 to "at most 12 seconds (Claude Code reads the hooks.json timeout in seconds)". The violation ids stay the same. A legacy 12000 is now a violation, which is correct (12000 seconds).
- DD-5: Do not regenerate tests/fixtures/369/hook-cold-start-baseline.json. It is a dated measurement record (measured_at 2026-10-02). Arm 3 checks only its internal p95 < timeout_ms. Name it as a follow-up in the SUMMARY: its timeout_ms values show the old budgets.
- DD-6: tests/test-mux-card-before-answer.cjs H7. Split the one constant into two. DECLARED_BUDGET_MS = 3000 is the hooks.json budget of 3 s as parseHookCommands reads it. SPIKE_003_COLD_START_MS = 2000 is the spike 003 PreToolUse cold-start target. The declared check uses the first; the slowest-run check keeps 2000. Reason: the performance bar must not get weaker when the budget gets larger.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Measure the real room before the change, apply the DD-1 raise rule, and write the failing test (RED)</name>
  <files>tests/test-261029-qef-hook-timeouts.cjs</files>
  <read_first>
    - /tmp/claude-1000/-home-jsagi/b995db30-926f-45da-bd5e-9bff0d895704/scratchpad/recover/bench/hook-bench-parallel.cjs (whole file, 29 lines; "slowest" is the MAX over the runs)
    - /tmp/claude-1000/-home-jsagi/b995db30-926f-45da-bd5e-9bff0d895704/scratchpad/recover/bench/perf-audit-baseline.md (section 2 method, section 4 limits)
    - tests/test-mux-card-before-answer.cjs lines 170-205 (the H7 filler line shape)
    - tests/test-compute-state-persists.cjs (check helpers, summary line, exit code style)
    - scripts/measure-hook-cold-start.cjs lines 1-80 and 470-474
  </read_first>
  <behavior>
    - A1 shape: hooks.json parses. After deleting every "timeout" and "onFailure" key on both sides, JSON.stringify of the current file equals JSON.stringify of `git show a13ab61f1:hooks/hooks.json`. When git is unavailable, print "SKIP A1: git unavailable" and do not count a failure.
    - A2: every command hook timeout is an integer from 1 to 180.
    - A3: exactly three hooks have a timeout above 100: sessionstart-npm-reconcile.cjs at 150, run-hook.cmd session-start at 180 and run-hook.cmd post-compact at 120.
    - A4: the DD-1 table (final values after the raise rule) as an array of [event, command substring, seconds]. Every hooks.json entry matches exactly one row and every row matches exactly one entry (46).
    - A5: the entry whose command contains part8-egress-guard-hook.cjs has onFailure === "block" (exact string); no other entry has an onFailure key.
    - A6: ambient-stop.cjs has timeout 5 and async true.
    - A7: parseHookCommands(HOOKS_JSON): for every entry, timeout_ms === declared_timeout x 1000 and timeout_unit_note contains "read as seconds". Synthetic inputs through parseHookCommands with an object: 120 gives 120000; 999 gives 999000; 1000 gives 1000 with a note that contains "legacy milliseconds"; 3000 gives 3000.
    - A8: isNetworkCapable is a function; it returns true for the npm reconcile entry and false for every other hooks.json entry, including session-start.
    - A9: spawn node scripts/check-session-start-verification.cjs --json with CHECK_SESSION_START_ROOT set to a temp root that holds only hooks/hooks.json, and MOS_SESSION_VERIFY_HOME set to an empty temp dir. Parse stdout JSON (ignore the exit code; other checks fail in a temp root). With a copy of the real hooks.json there is no "preflight-timeout-budget" violation. With the preflight timeout set to 13 there is one. With 12000 there is one.
  </behavior>
  <action>
Step 0. Run git status --porcelain on tests/test-261029-qef-hook-timeouts.cjs, hooks/hooks.json, scripts/measure-hook-cold-start.cjs, scripts/check-session-start-verification.cjs, tests/test-mux-card-before-answer.cjs and CHANGELOG.md. Any output means a peer change: stop and return NEEDS_HUMAN with the path (C-8). Run git log -1 --format=%h -- hooks/hooks.json. If it is not a13ab61f1, stop and return NEEDS_HUMAN.

Step 1, the measurement variant. Let XS be your own scratchpad directory. Let BENCH be /tmp/claude-1000/-home-jsagi/b995db30-926f-45da-bd5e-9bff0d895704/scratchpad/recover/bench. Do not edit files in BENCH. Copy BENCH/hook-bench-parallel.cjs to XS/hook-bench-perhook.cjs and change only the copy. (a) After the median line, print one line for EVERY hook of the event, "  hook <command key, 60 chars> max=<ms> ms". (b) Add payloads: PreCompact (hook_event_name PreCompact, trigger manual, custom_instructions empty), PostCompact (hook_event_name PostCompact, trigger manual), SessionStart (hook_event_name SessionStart, source startup). (c) Env TOOL and TOOL_INPUT (JSON text) replace tool_name and tool_input of the PreToolUse payload. (d) Env TRANSCRIPT replaces transcript_path. (e) Env SKIP is a regex; drop each hook whose command matches it. (f) Matching: SessionStart matches the group matcher against "startup"; UserPromptSubmit, Stop, PreCompact and PostCompact take every group; tool events match against the tool name. Keep everything else: parallel start, bash -lc, stdin JSON, median of the runs.

Step 2, the before run. Let ROOM be /mnt/c/Users/jsagi/MindrianRooms/israel-frontier-criticality/translational-capital-lab. Record `uptime` before each harness command. Use SCRATCH="XS" on every command.
  2a. Stop prep (from quick kqv): with cwd ROOM and CLAUDE_PLUGIN_ROOT=/home/jsagi/dev/MindrianOS-Plugin, run bash scripts/on-stop once with stdin from /dev/null. Poll up to 60 s until ROOM/.mindrian/state-recompute.lock is absent.
  2b. The restored harness, unchanged: node BENCH/hook-bench-parallel.cjs /home/jsagi/dev/MindrianOS-Plugin "$ROOM" 3 UserPromptSubmit PreToolUse PostToolUse Stop. Save the 4 lines. The restored PreToolUse payload (tool Bash) matches no PreToolUse matcher, so it prints hooks=0. Record that as it is.
  2c. The variant, real-room leg, 3 runs each: UserPromptSubmit; PostToolUse; Stop (repeat 2a first); PreCompact; PostCompact; PreToolUse three times, with TOOL=Write and TOOL_INPUT {"file_path":"XS/qef-probe.md","content":"probe"}, then TOOL=mcp__plugin_mos_mindrian-brain__brain_query and TOOL_INPUT {"query":"Jobs to be Done"}, then TOOL=mcp__plugin_mos_mindrian-os__gate_answer and TOOL_INPUT {"gate_id":"qef-bench","answer":"approve"}. The guard makes no network call (PROVEN, header D-01).
  2d. The variant, transcript leg, 3 runs each. Build XS/qef-transcript-50mb.jsonl: repeat the H7 filler line (an assistant message whose text is 900 "x" characters) until the file is at least 50 MB. Real transcripts on this machine reach 72.6 MB (PROVEN), median of those over 5 MB is 8.7 MB. Create the empty directories XS/qef-noroom and XS/qef-rooms-empty. Run Stop, UserPromptSubmit and PreToolUse (the gate_answer payload) with cwd XS/qef-noroom, MINDRIAN_ROOMS_HOME=XS/qef-rooms-empty and TRANSCRIPT=XS/qef-transcript-50mb.jsonl. This leg must not reach the real room, because synthetic turn text must not be filed there (T-qef-07).
  2e. Read the last 3 "on-stop-state mode=" lines of ROOM/.mindrian/session-close.log and record them.

Step 3, the raise rule. Apply the DD-1 raise rule to every measured hook. Write the final table. If a value changes, use the new value in Task 1 (test), Task 2 (hooks.json) and the SUMMARY.

Step 4, the test. Create tests/test-261029-qef-hook-timeouts.cjs with node built-ins only (node:fs, node:os, node:path, node:child_process). CJS, 'use strict', no framework. Copy the check helper and the summary style of tests/test-compute-state-persists.cjs. Implement arms A1 to A9 exactly as the behavior block states. Print "hook-timeouts: ALL PASS" or "hook-timeouts: N FAILED", and exit 0 or 1. The header comment names quick 261029-qef, the docs fact (seconds), the DD-1 rule, DD-2 and the base commit a13ab61f1. Remove every temp directory in a finally block. No em-dash and no en-dash in the file.

Step 5, RED check. Run the test against the unchanged tree. Expected: exit 1, ok for A1 and A6, FAIL for A2, A3, A4, A5, A7, A8 and A9. If the set is different, fix the test until it matches. Do not edit any other file in this task.

Step 6, commit. git add the one path, then git commit --only tests/test-261029-qef-hook-timeouts.cjs with message "test(261029-qef): add failing test for hook timeouts in seconds and the fail-closed Part 8 guard", ending with the line "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>".
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && node tests/test-261029-qef-hook-timeouts.cjs > "${TMPDIR:-/tmp}/qef-red.txt" 2>&1; echo "exit=$?"; grep -E '(ok|FAIL|SKIP) ' "${TMPDIR:-/tmp}/qef-red.txt"; ! LC_ALL=C grep -qE $'\xe2\x80[\x93\x94]' tests/test-261029-qef-hook-timeouts.cjs && echo no-dash</automated>
  </verify>
  <done>The SUMMARY holds every before line (restored harness and variant), the uptime of each run, the 3 mode lines, the 50 MB file size, and the final DD-1 table with the "raised by measurement" column. The test file exists (150 lines or more), runs in under 60 s, and exits 1 with ok for A1 and A6 and FAIL for A2, A3, A4, A5, A7, A8 and A9. It holds no em-dash and no en-dash. It is committed alone.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Write the budgets into hooks.json, add the guard onFailure, and make the two readers read seconds (GREEN, DD-1..DD-6)</name>
  <files>hooks/hooks.json, scripts/measure-hook-cold-start.cjs, scripts/check-session-start-verification.cjs, tests/test-mux-card-before-answer.cjs</files>
  <read_first>
    - hooks/hooks.json (whole file)
    - scripts/measure-hook-cold-start.cjs lines 1-80, 285-320, 425-474
    - scripts/check-session-start-verification.cjs lines 1-60 and 99-125
    - tests/test-mux-card-before-answer.cjs lines 18-30 and 170-205
    - tests/test-261029-qef-hook-timeouts.cjs (the contract from Task 1)
  </read_first>
  <behavior>
    - All 9 arms of tests/test-261029-qef-hook-timeouts.cjs pass.
    - The diff of hooks/hooks.json against a13ab61f1 has exactly 45 changed timeout lines and 1 added onFailure line, and no other change.
    - tests/test-mux-card-before-answer.cjs H7 passes; its failure set equals the step 0 baseline (S3 only).
  </behavior>
  <action>
Step 0, baseline. Repeat the C-8 status check on the 4 files of this task. Then run each of these with node, with a 600 s limit, and record the exit code and every FAIL line: tests/test-369-hook-require-graph.cjs, tests/test-369-installed-layout.cjs, tests/test-mux-card-before-answer.cjs, tests/test-3551-tri-polar.cjs, tests/test-198-adapter-budget.test.cjs, tests/test-quick-260911-juq-hooks-json-top-level.cjs, tests/test-341-session-start-tier.cjs, tests/test-341-update-collapsed.cjs, lib/memory/sessionstart-coordinator.test.cjs, tests/test-239-brain-tool-liveness.cjs, tests/test-260906-gr1-brain-shaped-tool-gate.cjs, tests/test-346-catalogue-schema.cjs, tests/test-359-devonly-tripwire.cjs, tests/test-355-part8-egress.cjs, tests/test-r1-posttooluse-interceptor-spike.cjs, tests/test-btm-theo-is-the-brain.cjs. Also run bash tests/run-all-369.sh. A test that fails in this baseline is not a regression of this task. Name it in the SUMMARY. Known before the change: test-3551-tri-polar fails at the PreToolUse BASE_3551 assertion, and test-mux-card-before-answer fails S3.

Step 1, hooks/hooks.json (DD-1, DD-2, C-4). Edit with targeted text replacements, one per hook. Do not rewrite the file through JSON.stringify. For each of the 45 hooks other than ambient-stop, replace only the number on its "timeout" line with the final DD-1 value from Task 1. Keep the trailing comma where it is. For the part8-egress-guard-hook.cjs entry, put a comma after its timeout value and add the line "onFailure": "block" directly after it, with the same indentation. Do not reorder anything. Then run node -e with JSON.parse on the file.

Step 2, scripts/measure-hook-cold-start.cjs (DD-3). Change the unit rule in parseHookCommands to the DD-3 (a) rule. Add the function isNetworkCapable(entry) next to it, with a short comment that cites quick 261029-qef. In measureAll, replace the HEAVY_TIMEOUT_MS condition with isNetworkCapable(e) and the new not_measured text. Delete the HEAVY_TIMEOUT_MS constant. Add isNetworkCapable to module.exports. Rewrite the header "Units note" and the --include-heavy usage text per DD-3 (c). Keep every field name. Hyphens only: tests/run-all-369.sh scans this file for em-dashes.

Step 3, scripts/check-session-start-verification.cjs (DD-4). Rename HOOK_BUDGET_MS to HOOK_BUDGET_S with the value 12, and change the comparison, the message, the two remedies and the header item 2 as DD-4 states. Keep the violation ids.

Step 4, tests/test-mux-card-before-answer.cjs (DD-6). In arm H7, replace BUDGET_MS with DECLARED_BUDGET_MS = 3000 and SPIKE_003_COLD_START_MS = 2000. The declared check compares entry.timeout_ms with DECLARED_BUDGET_MS, and its message says "is not the 3 s hooks.json budget (quick 261029-qef)". The slowest-run check and the printed line use SPIKE_003_COLD_START_MS. Change the arm label to "H7 cold start on a 5 MB transcript stays under the spike 003 cold-start target (2000 ms); the hooks.json budget is 3 s". Update header line H7 to the same meaning. Do not touch any other arm.

Step 5, gates. Run the commands in verify. Then run the step 0 list again. Every test that passed in the baseline must pass now. A test that failed in the baseline must fail with the same message. Run node scripts/measure-hook-cold-start.cjs --n 3 --json --out XS/qef-cold.json --tree-check report. Check with node -e that the npm reconcile entry has not_measured, that the session-start entry is measured with timeout_ms 180000, and that every measured entry has timeout_breaches 0. Record any breach in the SUMMARY. Run claude plugin validate /home/jsagi/dev/MindrianOS-Plugin and confirm exit 0 and no "Invalid command hook" line.

Step 6, commit. git commit --only hooks/hooks.json scripts/measure-hook-cold-start.cjs scripts/check-session-start-verification.cjs tests/test-mux-card-before-answer.cjs with message "fix(261029-qef): hook timeouts in seconds with measured budgets, and the Part 8 guard blocks on failure", ending with the line "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>". These 4 files go in one commit, because each half alone leaves a test red.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && node -e 'JSON.parse(require("fs").readFileSync("hooks/hooks.json","utf8"))' && test "$(git diff -U0 a13ab61f1 -- hooks/hooks.json | grep -E '^[+-][^+-]' | grep -vcE '"timeout": [0-9]+,?$|"onFailure": "block"$')" = "0" && test "$(git diff -U0 a13ab61f1 -- hooks/hooks.json | grep -cE '^\+[^+]')" = "46" && node tests/test-261029-qef-hook-timeouts.cjs && node tests/test-369-hook-require-graph.cjs && node tests/test-quick-260911-juq-hooks-json-top-level.cjs && CHECK_SESSION_START_ROOT="$PWD" node scripts/check-session-start-verification.cjs --check && node tests/test-mux-card-before-answer.cjs 2>&1 | grep -q 'PASS H7' && ! git diff a13ab61f1 -- hooks/hooks.json scripts/measure-hook-cold-start.cjs scripts/check-session-start-verification.cjs tests/test-mux-card-before-answer.cjs | grep '^+' | LC_ALL=C grep -qE $'\xe2\x80[\x93\x94]' && claude plugin validate /home/jsagi/dev/MindrianOS-Plugin >/dev/null 2>&1 && echo GATES-GREEN</automated>
  </verify>
  <done>GATES-GREEN prints. The new test prints "hook-timeouts: ALL PASS". The hooks.json diff holds only timeout lines and one onFailure line. Every test that passed in the step 0 baseline still passes; each baseline failure fails with the same message. measure-hook-cold-start reports 0 breaches and skips only the npm reconcile hook. claude plugin validate exits 0. The 4 files are in one commit, made with git commit --only.</done>
</task>

<task type="auto">
  <name>Task 3: Measure the real room after the change, check the headroom, and record the result in CHANGELOG.md</name>
  <files>CHANGELOG.md</files>
  <read_first>
    - The Task 1 section of your SUMMARY draft (the before lines and the final DD-1 table)
    - CHANGELOG.md lines 1-40 (the [Unreleased] section and its ### Changed list)
  </read_first>
  <action>
Expectation, stated before the run: the harness starts the hooks and waits for them. It does not apply the hooks.json timeout. The hook code did not change. So the medians must show no change within noise. The value of this run is the headroom check: every measured hook max must be at or below one third of its new budget.

Step 1, the after run. Repeat Task 1 step 2a, 2b, 2c and 2e with the same commands, the same ROOM and the same SCRATCH. Record uptime per command. Do not repeat the transcript leg 2d; the code did not change.

Step 2, SessionStart once. scripts/sessionstart-npm-reconcile.cjs has no skip env var (PROVEN), so use the variant: SKIP=sessionstart-npm-reconcile, event SessionStart, 1 run, cwd ROOM. Record the median line, every hook line and uptime. Compare with the quick lx3 numbers: 11,520 ms when the summary is reused, 41,682 ms on the first start after a rebuild, 58.9 s on a loaded host.

Step 3, the comparison. Write a table into the SUMMARY: event, before median, after median, before load, after load, verdict. The verdict is "no change within noise" when the medians differ by less than 25 percent. It is "inconclusive (load)" when the two 1-minute load values differ by more than 1.0. Otherwise run that event once more; if it still differs, report the numbers and mark it as an open finding. Do not revert for a median difference, because the timeout values cannot change the time of a hook that does not reach its budget.

Step 4, the headroom table. For each measured hook (after run, plus the Task 1 transcript-leg max for the hooks in that leg), write: hook, worst ms, budget s, ratio worst/budget. Mark PASS when the ratio is 0.33 or less. Rows 1, 3, 4 and 12 of DD-1 are fixed by C-1; mark them "C-1 fixed" with the ratio. Any other hook above 0.33 is a finding in RISKS; do not change hooks.json in this task.

Step 5, CHANGELOG.md. First run git status --porcelain CHANGELOG.md. A change you did not make means: stop and return NEEDS_HUMAN. Add one bullet at the end of the existing "### Changed" list under "## [Unreleased]". Do not touch the heading or the other bullets. House style: one single line, a bold lead sentence, then plain English, Feynman style, hyphens only. Content, in this order:
- Lead: hooks now have real time limits, in seconds.
- Why: Claude Code reads a hook's time limit in seconds. The plugin wrote numbers meant as milliseconds, so it read 3000 as 50 minutes and the dependency check's 120000 as 33 hours. A stuck hook could hold your session for that long.
- Now, in words: most hooks get 3 or 5 seconds; the turn-end hook 20 seconds; the room context coordinator 40 seconds; the three hooks that rebuild the room summary 45 seconds; the session-start room load 3 minutes; the dependency check 2 and a half minutes. Each limit is at least 3 times the slowest run we measured. Say that the dependency check was not measured, because it can run npm install, and that its limit sits above its own internal 2-minute npm timeout on purpose. Use the final DD-1 values; if Task 1 raised a value, the words must match it.
- Privacy: the Brain privacy guard now blocks the Brain call if it cannot finish in time, instead of letting the call through unchecked. This needs Claude Code v2.1.295 or later.
- Numbers: the measured before and after medians of the prompt submit, file read and turn end events on a real room on a Windows drive under WSL, median of 3 runs, exactly as measured. Say plainly that the times did not change, because no hook came near its limit; the gain is the worst case, a stuck hook now costs at most its limit. Do not name the navigator or the room slug.
- Surface: Claude Code only; Desktop and Cowork do not run these hooks.
- End with the sentence "Not live until a release carries it."
If Task 1 or Step 1 produced no valid median for an event, leave that event out of the bullet and say so in the SUMMARY.

Step 6, commit. git commit --only CHANGELOG.md with message "docs(261029-qef): record the hook time limits in seconds and the measured times in the changelog", ending with the line "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>". Then verify that the 3 commit shas of this plan are ancestors of HEAD (git merge-base --is-ancestor). Do not push.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && awk '/^## \[Unreleased\]/{f=1;next} /^## \[/{f=0} f' CHANGELOG.md | grep -F '50 minutes' | grep -F '33 hours' | grep -qF 'Not live until a release carries it.' && ! git diff a13ab61f1 -- CHANGELOG.md | grep '^+' | LC_ALL=C grep -qE $'\xe2\x80[\x93\x94]' && test -z "$(git status --porcelain -- hooks/hooks.json scripts/measure-hook-cold-start.cjs scripts/check-session-start-verification.cjs tests/test-mux-card-before-answer.cjs tests/test-261029-qef-hook-timeouts.cjs CHANGELOG.md)" && node tests/test-261029-qef-hook-timeouts.cjs && echo CHANGELOG-OK</automated>
  </verify>
  <done>CHANGELOG-OK prints. The SUMMARY holds the after lines, the uptime per run, the SessionStart line with its lx3 comparison, the comparison table with a verdict per event, and the headroom table. The CHANGELOG bullet is one line with 50 minutes, 33 hours, the budgets in words, the measured medians and the closing sentence, and it holds no em-dash and no en-dash. The 6 owned files are clean in git status. The 3 commits are ancestors of HEAD. Nothing is pushed.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Claude Code -> plugin hooks | Claude Code cancels a hook at its timeout and discards its output |
| PreToolUse guard -> Brain MCP call | The Part 8 guard decides if user-room bytes may leave the machine |
| benchmark -> real data | The benchmark runs real hooks in the navigator's real room |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-qef-01 | Information disclosure (Canon Part 8) | part8-egress-guard-hook.cjs | mitigate | "onFailure": "block" on the guard (DD-2): a timeout, a start failure or a hard kill now blocks the Brain call; test arm A5 pins the exact value, because an invalid value disables the hook (PROVEN, validator) |
| T-qef-02 | Denial of service | every hook | mitigate | Budgets in seconds (DD-1); a hung hook now costs at most its budget, not 50 minutes or 33 hours |
| T-qef-03 | Denial of service (cut mid-work) | hooks that run compute-state, session-start, coordinator | mitigate | Budgets at least 3x the measured worst case, 45 s for the compute-state hooks; STATE.md writes are atomic (persistState tmp plus rename), so a cancel leaves the old file |
| T-qef-04 | Denial of service (false block) | Part 8 guard on a loaded host | accept | 5 s is more than 50x the sandbox cost; a false block gives an honest refusal and a retry, which is better than an unchecked egress |
| T-qef-05 | Tampering (config compatibility) | onFailure on Claude Code older than v2.1.295 | accept | 2.1.312 accepts unknown handler keys (PROVEN); the old-version effect is UNVERIFIED and recorded |
| T-qef-06 | Tampering | benchmark rewrites STATE.md and snapshots in the real room | accept | Instructed by the orchestrator; same method as the baseline (perf-audit-baseline.md section 4) |
| T-qef-07 | Tampering (Part 9 locality) | synthetic 50 MB transcript leg | mitigate | That leg runs with cwd in the scratchpad and MINDRIAN_ROOMS_HOME on an empty scratch dir, so no synthetic turn is filed in a real room |
| T-qef-08 | Denial of service | npm reconcile cut at 150 s | mitigate | The internal npm timeout is 120 s and fires first, so the npm install lock is released by the script itself before Claude Code can cancel the hook (R-2 closed) |
</threat_model>

<verification>
- node tests/test-261029-qef-hook-timeouts.cjs prints "hook-timeouts: ALL PASS".
- node -e JSON.parse on hooks/hooks.json succeeds. The diff against a13ab61f1 holds 45 changed timeout lines and 1 added onFailure line, nothing else.
- The step 0 baseline suites: no new failure; each baseline failure (test-3551-tri-polar PreToolUse BASE_3551, test-mux S3, any other found) fails with the same message.
- CHECK_SESSION_START_ROOT=$PWD node scripts/check-session-start-verification.cjs --check prints OK.
- node scripts/measure-hook-cold-start.cjs --n 3 reports 0 breaches, measures session-start and skips only the npm reconcile hook.
- claude plugin validate /home/jsagi/dev/MindrianOS-Plugin exits 0.
- Tri-Polar: the change is in hooks.json (Claude Code CLI only) and two dev-side readers. Desktop and Cowork are unaffected.
- Canon Part 8: the guard is now fail-closed on timeout; no network call is added anywhere.
</verification>

<success_criteria>
- 46 hooks carry the final DD-1 budgets in seconds; session-start at 180 and npm-reconcile at 150; ambient-stop at 5.
- The Part 8 guard carries "onFailure": "block"; no other hook does.
- The harness and the session-start check read seconds; the harness still skips only the npm reconcile hook.
- Before and after medians, host load, the SessionStart line and the headroom table are in the SUMMARY.
- One CHANGELOG bullet with real numbers and "Not live until a release carries it."
- 3 commits (test, fix, docs), each made with git commit --only; none pushed.
</success_criteria>

<risks>
- R-1: Closed by the orchestrator ruling of 2026-10-29: every fixed C-1 value is at least 3x its measured worst case (session-start 180 s against 58.9 s, sessionstart-coordinator 40 s against 12.3 s, on-stop 20 s against 5.8 s). The remaining risk is on-stop's rare synchronous rebuild path (missing STATE.md: compute-state 8.4 to 13.4 s plus the rest), which can reach 20 s on a loaded host. Then Claude Code cancels the hook and discards its output. STATE.md writes are atomic, so no file is left half-written.
- R-2: Closed by the orchestrator ruling of 2026-10-29: sessionstart-npm-reconcile has 150 s, and its own npm timeout is 120 s, so the internal timeout fires first and the script releases the npm install lock itself; the hook cancel never holds the lock.
- R-3: The effect of onFailure on Claude Code older than v2.1.295 is UNVERIFIED.
- R-4: Write-path PostToolUse hooks (post-write, auto-commit and the graph hooks) are not measured on the real room, because a Write payload would create commits in the room's git repo. Their budgets rest on the C-1 rule and the sandbox numbers.
- R-5: on-cwd-changed and SubagentStop/TaskCompleted hooks are not measured on the real room (on-cwd-changed rewrites the rooms registry). Their 45 s rests on the audit's compute-state time.
- R-6: tests/fixtures/369/hook-cold-start-baseline.json keeps the old budget values (DD-5).
</risks>

<output>
Create `.planning/quick/261029-qef-hook-timeouts-in-seconds-with-measured-b/261029-qef-SUMMARY.md` when done. Include: the Task 1 before lines and uptime, the final DD-1 table with the "raised by measurement" column, the Task 2 baseline and after test table, the measure-hook-cold-start result, the claude plugin validate result, the Task 3 after lines, the comparison and headroom tables, the 3 commit shas, and the protocol report fields (STATUS, CHANGED, VERIFIED, UNVERIFIED, RISKS, NEXT). Do not commit the SUMMARY; the orchestrator does.
</output>

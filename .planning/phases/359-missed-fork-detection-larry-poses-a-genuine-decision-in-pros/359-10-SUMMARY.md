SMOKE: PASSED mode=probe

Caveat on line 1: the instrument is verified and the mode is probe, but the pre-arm run ended above the per-run cap (USD 0.4227 against 0.40, subtype error_max_budget_usd). The acceptance check "every row cost_usd at most 0.40" FAILED for that row. The projection at the measured maximum is above the USD 60 ceiling. See "Cost and projection" and "Open decision for plan 359-11".

# Phase 359 Plan 10: Forward smoke run Summary

Plan 359-10 re-run after the shadowed agent link was renamed. The preflight passed. Two paid runs happened (1 pre, 1 post, scenario fwd-fork-01). The parser did not match the observed stream shape and was corrected. The offline harness test is green (38/38).

## Navigator ruling (smoke)

The human typed this in the main session on 2026-10-28. The main session reads it as the plan option `approve-smoke`. Verbatim text:

> dont stop in 10 for mony yes. here it is ! YES !

Status: PROVEN (text relayed by the main session in the task prompt). The approval covers only the smoke: at most 2 runs, one per arm, at most USD 0.40 per run, at most USD 0.80 in total, model claude-sonnet-5 only. It does not cover plan 359-11 or the full batch.

## Task results

| Task | Result | Evidence |
|------|--------|----------|
| 1 Preflight and dry run | DONE, exit 0 | PROVEN: two command lines printed, both with `--model claude-sonnet-5`, `--max-budget-usd 0.4`, `--agent mos:larry-extended`, `--no-session-persistence`, no `--bare`. The cap prints as `0.4`, not `0.40`; same value. |
| 2 Navigator approval | Recorded above | PROVEN |
| 3 Smoke run | DONE, 2 runs | PROVEN: `~/.cache/mindrian-dev/359-forward/smoke.jsonl` has 2 rows |

Preconditions (PROVEN): `git show --stat 656cd8a3` lists only the 6 R8 paths; claude 2.1.312; `bash tests/run-all-359.sh` PASS=26 FAIL=0 after the fix (it was PASS=25 FAIL=1 in the first attempt; the 6 failing harness cases now pass because the link is renamed).

## Run results (outcome counts are NOT part of the R9 result)

Command: `node scripts/forward-fork-scenarios-359.cjs --r8-sha 656cd8a3410d7f396c25b612a98b49eff846b1f2 --arm both --smoke --results ~/.cache/mindrian-dev/359-forward/smoke.jsonl`

| Arm | sha | status | cost_usd | session duration (sum of 3 result events) | result subtypes |
|-----|-----|--------|----------|-------------------------------------------|-----------------|
| pre | 656cd8a3^ | error_budget | 0.4226918 | 37.5 s | success, success, error_max_budget_usd |
| post | 656cd8a3 | ok | 0.245283 | 55.3 s | success, success, success |

Total spend: USD 0.668 (limit 0.80). Runs: 2 (limit 2). No retry.

The pre run hit the budget cap in turn 3, the measured turn, after turn 3 had begun. The harness records it as an error row, never a miss (Finding 12). The post run reached the measured turn. A card (AskUserQuestion with 3 options, the third a what-if option) was attempted in the measured turn and the probe host denied it as designed (tool_result is_error true). Reply text is not recorded here.

## Assumption table (RESEARCH A1 to A9)

| # | Assumption | Result | Evidence (event types and field names only) |
|---|------------|--------|---------------------------------------------|
| A1 | Probe host works, AskUserQuestion offered | VERIFIED | system/init.tools contains AskUserQuestion (both arms); mcp_servers lists fork359probe as connected; the post arm produced an assistant tool_use named AskUserQuestion with input key `questions` and a user tool_result with is_error true; a probe log file (probe.jsonl, 171 bytes) exists in the post hermetic dir and does not exist in the pre dir (no card attempted there) |
| A2 | Exactly one `mos` plugin at the arm tree path, user plugins and user agent absent | VERIFIED | system/init.plugins = one `mos` (source mos@inline, path equals the arm tree, pre tree path ends with `_` as built) plus 3 builtin cc-plugin-* entries; system/init.agents has `mos:larry-extended` and no bare `larry-extended` |
| A3 | Stop hook events appear with --include-hook-events and split attempt 1 | VERIFIED with a shape correction | Stop events are system events with subtype hook_started / hook_progress / hook_response and field `hook_event` (not `hook_event_name`, not subtype `hook_event`). They precede the result of each turn. One Stop group per turn (3 per run). Parser corrected, see below. No Stop hook_response carried a block decision in either run, so the re-prompt event order is still ASSUMED |
| A4 | Per-call context cost | MEASURED | Turn 1 cumulative cost: pre 0.362, post 0.158 (system/init lists 325 tools in pre, 340 in post, 17 mcp_servers each) |
| A5 | Larry gets all 4 preloaded skills | UNVERIFIED | Not visible in event field names |
| A6 | Wall time 30 to 90 s per run | VERIFIED | 37.5 s and 55.3 s |
| A7 | Stop stdin has `last_assistant_message` | UNVERIFIED | Not visible in the stream. Stop hook_response outputs were `{continue, suppressOutput}` JSON or a 340-character text with no card/fork/declaration token; intercept_log_declared was 0 in both rows; the post card path (not the declaration path) fired |
| A8 | Multi-turn stream-json input processed turn by turn | VERIFIED | 3 system/init, 3 result events (num_turns 1, 1, 1 for pre; 1, 1, 2 for post, the 2 is the card tool round trip), in order, one Stop group per turn. The `user` input turns are not echoed in the output stream |
| A9 | Scratch room binds, no `No room detected` | VERIFIED | `No room detected` count 0 and `MODE_ROUTING` count 0 in both streams; the largest SessionStart hook_response output (5.7 KB) names the scratch room `scratch-359`; init cwd is inside the hermetic temp dir |
| - | Agent is mos:larry-extended | UNVERIFIED from init | system/init has NO `agent` field. Indirect only: the Larry header string appears in 3 (pre) and 4 (post) assistant text blocks. See Risks |
| - | MINDRIAN_HOME stayed inside the temp dir | VERIFIED | `~/.mindrian/card-fire-retries.json` mtime 1793213569 (2026-10-28 20:52:49) identical before the run, after the run and after the full test suite |

## Parser and fixture correction (committed 086519f93)

Observed shape differed from the canned fixtures in four ways:
1. Hook events: subtype `hook_started|hook_progress|hook_response` and field `hook_event`. The old parser looked for subtype `hook_event` and field `hook_event_name`, so it never saw a hook event. Effects: split was always `no-hook-events` and the SessionStart `No room detected` check was dead.
2. Stop hooks precede the turn's `result`; the old fixtures put them after it.
3. A multi-turn run has one Stop per turn. The old split at the first Stop would have cut at the end of turn 1 and scanned a warm-up turn; with no hook events it scanned all three turns, so a card in a warm-up turn would have counted as a caught fork. The parser now measures only the last scenario turn: the slice after the previous result and before the first Stop in that slice.
4. system/init repeats once per turn and has no `agent` field; `total_cost_usd` is cumulative.

Changes: `scripts/forward-fork-scenarios-359.cjs` (new `isHookEvent`, SessionStart check over hook events, measured-turn window, header SHAPE NOTE), canned fixtures a to h rewritten to the observed structure (placeholder text only), new fixture `j-card-in-warmup-only.jsonl`, two new legs (j, k) in `tests/test-359-forward-harness.cjs`. Re-parsing the two raw streams with the corrected parser gives post: split `stop-hook`, card true; pre: error_budget. Raw streams stay in `~/.cache`, not in git.

## Mode decision

`probe`. A1 and A3 are VERIFIED, A2 and A9 are VERIFIED, so no N-4 text fallback is needed.

## Cost and projection

`--project --cost-per-run 0.4226918` (max measured): the harness REFUSES, projected total USD 76.08 (144 runs x 0.4226918 x 1.25) exceeds the USD 60 cap.
`--project --cost-per-run 0.245283` (post run only): USD 44.15, within the cap.
The plan rule is "max measured cost", so the batch projection is USD 76.08 and above the ceiling. The plan 359-11 checkpoint must decide.

## Open decision for plan 359-11

- The per-run cap of 0.40 is cumulative over a 3-turn session. Pre turn 1 alone cost 0.362. The pre run overshot the cap by 0.0227 on turn 3. If pre runs behave like this, most pre-arm runs will end as error_budget rows and the vacuity floor cannot be reached.
- Likely cost drivers (ASSUMED): 325 to 340 tool schemas and 17 MCP servers per call. `--setting-sources project,local` did not drop the user-level claude.ai connector servers. Options for the navigator: raise the per-run cap, cut the MCP surface for the batch, or reduce runs. This executor changed none of them.

## Deviations from Plan

**1. [Rule 1 - Bug] Parser did not match the observed stream**
- **Found during:** Task 3 step 2
- **Fix:** see "Parser and fixture correction"
- **Files modified:** scripts/forward-fork-scenarios-359.cjs, tests/fixtures/forward-fork-stream-359/*, tests/test-359-forward-harness.cjs
- **Commit:** 086519f93

The plan acceptance item `git ls-files | grep -c "359-forward"` is 1, not 0. The single match is `tests/test-359-forward-harness.cjs` (its file name). No raw stream or results file is tracked (PROVEN: the match list has one entry).

## Deferred Issues

- Cost cap and batch projection (above). Owner: plan 359-11 checkpoint.
- Agent identity is not provable from system/init; consider a harness check on a stronger signal (A-agent row above).

## Known Stubs

None.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: spend-overshoot | scripts/forward-fork-scenarios-359.cjs | `--max-budget-usd` is enforced after the turn, so a run can end above the cap (0.4227 vs 0.40). Total smoke spend stayed under 0.80 |
| threat_flag: user-connectors-loaded | scripts/forward-fork-scenarios-359.cjs | claude.ai connector MCP servers (Gmail, Drive, Notion and others) were connected in the hermetic runs; they add cost and a data surface |

## Self-Check

- SUMMARY exists at this path: PASSED.
- Commit 086519f93 exists on feat/eureka-adapter-rebased: PASSED.
- `node tests/test-359-forward-harness.cjs`: 38/38. `bash tests/run-all-359.sh`: PASS=26 FAIL=0.
- smoke.jsonl has 2 rows; one row exceeds 0.40 (0.4227): acceptance item FAILED, reported above.
- No change under lib, hooks, agents, skills, scripts/session-start, scripts/check-card-fire.cjs by this plan (the 373 commits in the range belong to another executor).

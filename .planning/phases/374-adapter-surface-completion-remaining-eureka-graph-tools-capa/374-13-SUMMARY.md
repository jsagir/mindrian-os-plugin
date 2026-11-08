---
phase: 374-adapter-surface-completion-remaining-eureka-graph-tools-capa
plan: 13
subsystem: mcp
tags: [eureka, forget-tool, tool-descriptions, pins, tool-budget, part-8, part-11]
requires: ["374-06", "374-08", "374-09", "374-10", "374-11", "374-12"]
provides:
  - "eureka_capability_job_forget inside eureka-capability-jobs.cjs (confirm true, finished run only, 75 to 76 tools, no new file)"
  - "forgetJob, lookupRecord and connectChild helpers in the jobs file; recover now uses the same two helpers"
  - "honest descriptions for start, status, result, cancel, run and the scout (pinned by tests/test-374-descriptions.cjs)"
  - "every pin moved once: 384 golden, 267 snapshot and deltas, test-270 AFTER, B9 of test-374-engine-busy, the two 387 pins"
affects: [374-14]
key-files:
  created:
    - tests/test-374-forget.cjs
    - tests/test-374-descriptions.cjs
  modified:
    - lib/mcp/tools/eureka-capability-jobs.cjs
    - lib/mcp/tools/eureka-capability-run.cjs
    - lib/mcp/tools/eureka-graph-opportunity-scout.cjs
    - lib/mcp/eureka-tool-contract.cjs
    - commands/eureka.md
    - skills/eureka/SKILL.md
    - data/mcp-tool-connectors.json
    - tests/fixtures/384-s7-tools-list-golden.json
    - tests/fixtures/267/wire-snapshot-zod4.json
    - tests/fixtures/267/zod4-accepted-deltas.json
    - tests/test-270-tool-schema-budget.cjs
    - tests/test-374-engine-busy.cjs
    - tests/test-374-screen-command.cjs
    - tests/test-384-s7-mcp-start.cjs
    - tests/test-387-eureka-engine-states.cjs
    - tests/test-387-eureka-installed-layout.cjs
    - tests/helpers/eureka-installed-layout-387.cjs
key-decisions:
  - "Gate lines read: ACT OD-2 ADD-FORGET-TOOL go, READ OD-3 TOPK-200, OD-4 USER-DIR, OD-5A F6, OD-5B SCREEN, OD-6 ENGINE-BUSY-GUARD, OD-7 PAGE-ARG, PLAN-GO 374-13, exit 0. BASE = 1acb2f39c. Every behaviour sentence applies; no arm is skipped."
  - "The forget tool is a job lifecycle tool (JOB_LIFECYCLE_TOOLS), like status: no engine gate before the handler. A live session uses its retained client. A recovered job runs engineRefusal and the busy guard itself, then opens ONE child."
  - "The engine status is read first. The engine deletes only a finished row, and a person must cancel a running run first, so a run that has not ended is refused with job_not_finished."
  - "Order of deletion: engine row first, then the plugin pointer record, then the cached result pages, then the session. An engine error keeps everything and says so."
requirements-completed: [PLG374-10, ADAPT374-02]
canon_parts: [7, 8, 11]
---

# Phase 374 Plan 13: forget tool, honest descriptions, and the one pin move

A person can now ask Larry to forget a finished pair-screen run. The Eureka job tool descriptions say what plans 374-08 to 374-12 built. Every pin of the phase moved once, here.

## Gate

`node 374-gate.cjs plan 374-13` printed `ACT OD-2 ADD-FORGET-TOOL go`, `READ OD-3 TOPK-200`, `READ OD-4 USER-DIR`, `READ OD-5A F6`, `READ OD-5B SCREEN`, `READ OD-6 ENGINE-BUSY-GUARD`, `READ OD-7 PAGE-ARG`, `PLAN-GO 374-13`, exit 0. BASE = 1acb2f39c. All seven behaviours exist, so the descriptions name all of them.

## Task 1: the forget tool

RED (`node tests/test-374-forget.cjs`, tool absent):

```
FAIL - F1 ... :: eureka_capability_job_forget is not registered
FAIL - F2 .. F6 ... :: jobs.forgetJob is not a function
```

GREEN:

```
ok - F1 the forget tool is registered, strict, destructive, confirm is the literal true
ok - F2 without confirm true nothing is deleted
ok - F3 a finished job with a live session is forgotten: engine row, session, record and cached page
ok - F4 a job that has not finished is refused: cancel it first
ok - F5 a recovered job: engine check and busy guard first, one child, delete, record removed, child closed
ok - F6 wrong room refused with no engine call; an engine error keeps the record; status after forget is not found
```

6 ok, 0 skip (the record module and the busy guard exist, so F5 did not skip).

What it does:

- Input `{ job_id, confirm }`, strict, `confirm` is `z.literal(true)`. Annotations: destructive true, read-only false, idempotent true. Connector row: shape F.0 (the confirm flag is the person's yes on one item).
- Defense in depth: `forgetJob` refuses with `confirm_required` even if the schema were bypassed.
- Live session: the retained client calls `scout_status`, then `scout_delete_job` once. Then the pointer record, the cached result pages (`dropCachedResult`) and the session go. No extra child.
- Recovered job (record only): record lookup by room (another room gives `job_session_wrong_owner` with no engine call), then `engineRefusal`, then `engineBusyRefusal`, then ONE child, status, delete, cleanup, child closed in a `finally` block.
- Answers use fixed sentences. They say the run "cannot be recovered". No engine text and no path reach the answer (F3 and F6 plant markers).
- EXT-02 consequence in the answer: after a restart the answer carries `engine_note`: "To forget this run after a host restart, MindrianOS opened one Eureka engine process. If another MindrianOS process was running a Eureka job at that time, the engine may have marked that job failed with server_restarted." The live-session path opens no child, so it carries no such note.
- Refactor (no behaviour change): `lookupRecord` and `connectChild` were pulled out of `recover` and are used by both `recover` and `forgetJob`. `tests/test-374-recovery.cjs` K1 to K10 stay green.

## Task 2: descriptions

RED (`node tests/test-374-descriptions.cjs`, tool registered with a one-line placeholder description):

```
FAIL - D1 ... :: start lacks: opportunity.run_pair_screen
FAIL - D2 ... :: status still holds: is unknown to this host session
FAIL - D3 ... :: eureka_capability_start lacks: engine_busy
FAIL - D4 ... :: run lacks: opportunity.run_pair_screen
FAIL - D5 ... :: scout lacks: top_k
FAIL - D6 ... :: forget lacks: confirm true
ok   - D7 (a guard arm: it passes in RED by design)
```

GREEN: `ok - D1` to `ok - D7`, 7 ok, 0 skip.

Sentences now true: the pair-screen first call only plans and returns `awaiting_approval` with a card, and the run starts only after the person answers; 30 day record; local meaning model; a finished job reads again after a host restart; a job running at the restart may read as failed (`server_restarted`) and does not resume; cancel after a restart gives `cancel_unavailable_after_restart`; the `page` argument, 256 KiB rule, 30 minute page cache, `job_result_page_expired`, `page_out_of_range`; `engine_busy` and the one-host-process limit; the scout `top_k` is 1 to 200; the sync run tool refuses the pair screen (`capability_requires_approval`) and points to `eureka_capability_start`. The old sentences "Jobs cannot resume after ..." and "is unknown to this host session" are gone from all descriptions. No input schema changed in this task. The connector `hitl_why` strings of status and result were updated to match.

The not-found answer text of the job tools ("Jobs cannot resume after the MindrianOS host process restarts; start a new job.") is a runtime answer, not a description. It is pinned by test-387-eureka-installed-layout and is still true when no record exists. It was left as is.

commands/eureka.md, step 8 of "Subcommand: screen": the condition on the forget tool is gone. It now says to call `eureka_capability_job_forget` with the `job_id` and `confirm` true only when the person asks, that it cannot be undone, that a run that has not finished must be cancelled first, and the EXT-02 consequence after a restart. Arm S6 of `tests/test-374-screen-command.cjs` pins the new text and the absence of the old condition. The run section is untouched (S5 green, sha256 unchanged). `skills/eureka/SKILL.md` was regenerated by `build-skill-mirrors` (1 overwritten, `--check` OK).

## Task 3: the pins, moved once

Before: `budget: 75 tools, 36269 desc bytes, 47586 schema bytes, 83855 total, ~20964 approx tokens (router 9 / atomic 66)`.
After: `budget: 76 tools, 37764 desc bytes, 47835 schema bytes, 85599 total, ~21400 approx tokens (router 9 / atomic 67)`.

| Measure | Value |
|---------|-------|
| Net growth in this plan (test-270 measure) | +1,744 bytes (+1,495 desc, +249 schema), +2.08 percent; +436 approx tokens. Plan limit was 3,000 bytes. |
| Against the recorded uqs AFTER (83,522) | +2.49 percent, inside the 10 percent tolerance (not relaxed) |
| Eureka family on the S7 stdio wire (24 to 25 tools) | 24,707 to 26,506 bytes, +1,799 (+1,495 desc, +304 schema) |
| S7 stdio tools/list total (72 to 73 tools) | 82,600 to 84,399 bytes, +1,799 |

Always-loaded cost for Phase 392 (alwaysLoad): the local tool list grows by about 436 approx tokens (20,964 to 21,400 on the test-270 measure). The doctor mcp-surface read 81 tools at about 21,853 tokens before this plan. ASSUMED, not measured: it will read 82 tools at about 22,289 tokens now. The doctor budget was NOT touched; Phase 392 owns it.

The golden and snapshot diffs were read. Only these tools differ: `eureka_capability_job_cancel`, `_job_result`, `_job_status`, `eureka_capability_run`, `eureka_capability_start`, `eureka_graph_opportunity_scout` (descriptions; result also got `page`, the scout `top_k` max 100 to 200) and the new `eureka_capability_job_forget`.

| Pin | Change |
|-----|--------|
| `tests/fixtures/384-s7-tools-list-golden.json` | regenerated with `SPEED384_WRITE_GOLDEN=1 node tests/test-384-s7-mcp-start.cjs parity`; count 72 to 73; the 6 tools above changed, forget added |
| `tests/test-384-s7-mcp-start.cjs` | the literal count 72 became 73 in arm P1 (a hard-coded count in the test) |
| `tests/fixtures/267/wire-snapshot-zod4.json` | 6 Eureka entries replaced from the live wire (`tests/helpers/mcp-wire-267.cjs` capture, hermetic env), forget inserted after job_cancel; `refreshed_by` gained one sentence. The two apostrophe escapes (unicode 2019 sequences) of the original file were kept. No other tool entry changed. |
| `tests/fixtures/267/wire-snapshot-zod3.json` | NOT changed (the Eureka tools are not in the zod 3 snapshot; membership deltas, the 374-01 precedent) |
| `tests/fixtures/267/zod4-accepted-deltas.json` | one `tool:eureka_capability_job_forget:membership` entry in `zod4_other` |
| `tests/test-270-tool-schema-budget.cjs` | AFTER: 76 tools, 37764, 47835, 85599, 21400, router 9, atomic 67, plan `374-13`, with a dated comment block |
| `tests/test-374-engine-busy.cjs` | `BASELINE_BUDGET_LINE` moved to the new line. B9 also pinned the job tool fingerprint and a count of 4 tools: count now 5, fingerprint `73360231...aa03f`. B9 label reworded. |
| `data/mcp-tool-connectors.json` | regenerated: forget row plus the two updated `hitl_why` strings |

`data/connector-registry.json` and `data/harness-manifest.json` also changed, see Deviations item 3.

## Deviations from Plan

**1. [Rule 1 - pin owned by this change] Existing tests outside files_modified had to move with the new tool.**
- `tests/test-387-eureka-installed-layout.cjs` and `tests/helpers/eureka-installed-layout-387.cjs`: the probe lists every runtime Eureka tool and needs synthetic arguments for each. Added forget to `SYNTHETIC_ARGS`, to the job tool list, to the 24 tool name list (now 25), `distinct_total` 75 to 76, `eureka_count` 24 to 25, and the job_session_not_found count 3 to 4.
- `tests/test-387-eureka-engine-states.cjs` arm G9: `BASELINE_NAMES` gained forget; `BASELINE_DESC_BYTES` moved 9096 to 10850 with a dated comment (the +300 allowance is the same).
- `tests/test-384-s7-mcp-start.cjs`: literal count (see the table).
- `tests/test-374-screen-command.cjs` arm S6 was in the task list (new forget text).
- No assertion was weakened. Each one counts the tools or bytes this plan changed on purpose.

**2. [Rule 1 - B9 fingerprint] The plan text names only `BASELINE_BUDGET_LINE` in `test-374-engine-busy.cjs`.** B9 also pins a fingerprint of the job tool descriptions and schemas and the number 4. Both moved with the description rewrite and the new tool (see table).

**3. [Peer interleave, Rule 3] `data/connector-registry.json` and `data/harness-manifest.json` landed in the commit of the other executor, not in mine.** The other executor (Phase 389 plan 09) held uncommitted edits in both generated files. I ran `node scripts/build-connector-registry.cjs` and `node scripts/build-harness-manifest.cjs` on the shared tree. The output was the peer's state plus my forget row and my two `hitl_why` edits (checked with a diff against a copy of the peer's files). The peer then committed its tree as `35922a28b` (389-09), and that commit holds my forget row and the manifest digests. After that commit all `--check` runs are green and only `data/mcp-tool-connectors.json` was left for my commit. No peer file was edited or reverted by hand.

**4. [Process error, reported] I ran live tests by accident.** A shell glob `tests/test-eureka-*.cjs` in a verification loop also matched `test-eureka-live-*.cjs`. `MINDRIAN_EUREKA_ROOT` was set in the shell, so those tests started the real engine (decision D-02 says no live engine in this plan). Effects: `tests/test-eureka-live-capability-run.cjs` exited 1 (a live assertion; not analysed, not caused by this plan as far as I can tell: UNVERIFIED); the others exited 0. The live capability jobs test wrote two plugin record files under `~/.mindrian/eureka-jobs/3a9d17e1-6488-4946-a71f-a0645a8fd674/` (about 800 bytes each, time 20:25 on 2026-11-08). That folder did not exist before. I tried to remove it and the permission system denied the delete, so it is still there. No engine process stays alive (checked with `ps`). `~/.local/share/mindrian-eureka/jobs.sqlite3` has its old modification time (2026-10-19), so the live tests did not use that store. The two record files are test leftovers and are harmless; the main session may delete the folder. They expire after 30 days by themselves.

**5. [Interpretation] `JOB_LIFECYCLE_TOOLS` gained the forget tool** (the plan said to decide by reading how status is treated). Status skips the engine gate and answers from the session table or the record. Forget does the same, and its recovery path runs the engine check and the busy guard itself. Pinned by F1 and F5.

## Verification (PROVEN, run in this tree after the last edit)

- `node tests/test-374-forget.cjs`: 6 ok. `node tests/test-374-descriptions.cjs`: 7 ok.
- `bash tests/run-all-374.sh`: PASS=19 FAIL=0 SKIPPED=1 (the skip is T12, owner-run live restart test).
- `bash tests/run-all-374.sh --neighbors`: PASS=47 FAIL=0 SKIPPED=1. This includes the 384 parity test (ALL PASS) and the 267 dual-era arms that plan 374-12 left red; both are green now.
- `node tests/test-270-tool-schema-budget.cjs`: 5 passed, 0 failed.
- Sixteen `tests/test-267-mcpv2-*.cjs` files: all exit 0 except `cirs-gates` (exit 1) and `cli-probe` (exit 77). Both were red before this plan (plans 374-10, 11 and 12 recorded them: Check (c) expected 35 connector descriptors, got 62; the probe cannot run here). Not caused here.
- `node scripts/build-connector-registry.cjs --check`, `build-orchestration-projection.cjs --check`, `build-harness-manifest.cjs --check`, `build-skill-mirrors.cjs --check`: OK. `node scripts/check-render-coverage.cjs`: 17 covered, 0 gap, md-keyspace 193 wired, 2 excluded, 0 unwired.
- `tests/test-276-tool-honesty-findings-closed.cjs`: 5 failing lines before and 5 after (its fixture was not touched).
- Non-ASCII grep over every new or edited code and test file: clean (commands/eureka.md has one older symbol-vocabulary line with box glyphs; it is not mine). This SUMMARY is plain ASCII.
- Nothing pushed, tagged, released, or regenerated under dist/. STATE.md, ROADMAP.md and REQUIREMENTS.md untouched.

## UNVERIFIED

- No live engine run for the forget tool. `scout_delete_job` was exercised only through in-process fakes. Its real answer shape `{ job_id, deleted }` is taken from reading mcp_server.py (line 432) and jobs.py `delete()`.
- When the engine has no row for a recorded job, `scout_status` may fail; then the forget answers `engine_forget_error` and keeps the record (it would expire after 30 days). Not seen live.
- The doctor token figure after this plan (about 22,289) is an estimate.
- Claude Desktop and Cowork rendering of the destructive-tool confirmation was not checked.

## What plan 374-14 must carry

- Tool count 76 (test-270), 73 on the S7 stdio list; 25 Eureka tools on the S7 wire.
- test-270 line: `76 tools, 37764 desc bytes, 47835 schema bytes, 85599 total, ~21400 approx tokens (router 9 / atomic 67)`; net +1,744 bytes and +436 tokens in this plan; always-loaded cost for Phase 392 as above.
- Forget tool contract: needs `confirm: true`, finished runs only, engine row first then record then pages; EXT-02 note after a restart.
- ADAPT374-06 (live restart proof) is still open; T12 is owner-run.
- The accidental live run and the two leftover record files (Deviation 4).

## Known Stubs

None.

## Threat Flags

None. The forget tool adds a destructive path, covered by T-374-58 (confirm literal, finished only, destructive annotation, description says call only after the person asks), T-374-59 (descriptions pinned) and T-374-60 (engine row, record and cached pages all removed).

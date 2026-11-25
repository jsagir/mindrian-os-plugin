---
phase: 399-decision-model-advisor-keyed-on-the-job-to-be-done-one-job-v
plan: 08
subsystem: decision-advisor-workflow
tags: [composeWorkflow, command-ranking, opt-in, tie-abstention, one-door, fence, mutation-control]
requires: [399-06, 399-07]
provides:
  - composeWorkflow(frameworkChain, opts) with additive step keys command_basis and ranked_commands (only with opts.jobId and the advisor on)
  - framework_run (MCP) and act --chain (CLI) pass { jobId, definitionLevel } when a selection job is known
  - tests/test-399-workflow-advisor.cjs (W1-W6, G1-G4)
  - tests/test-399-one-selector-fence.cjs (O1-O5)
affects: [399-09, 399-10]
tech-stack:
  added: []
  patterns: [one door, opt-in lazy require, abstain on tie, names-only output, mutation-controlled fence]
key-files:
  created:
    - tests/test-399-workflow-advisor.cjs
    - tests/test-399-one-selector-fence.cjs
  modified:
    - lib/workflow/command-resolver.cjs
    - lib/mcp/tools/sensors.cjs
    - scripts/act-command.cjs
    - tests/run-all-399.sh
decisions:
  - "Opt-in guard. composeWorkflow reads the advisor only when opts carries a non-empty jobId AND shortlist.advisorEnabled() is true (MINDRIAN_DECISION_ADVISOR=on). Otherwise no step gains a key: output is byte-identical to base (G1 proves it for unset, off and any other value, with a job and a table present)."
  - "Tie rule (399-07 guard). The advisor abstains when lookupShortlist top_tie is greater than 1 for the job key. Inside a framework, ranked_commands sorts non-weak commands by calibrated value descending with a stable sort, so equal values keep registry order. A command moves ahead of another only on a strictly greater value."
  - "ranked_commands lists commands with a non-weak value first, then the rest in registry order. command is ranked[0]. command_basis is 'advisor' when ranked[0] differs from the first registry command, else 'registry_order'. A framework with 0 commands is unchanged; one with 1 command gets 'registry_order' (advisor on and job known only)."
  - "No number leaves composeWorkflow: only command names and a basis word (G3)."
  - "Callers resolve the job with resolveSelectionJob(roomDir, null) and the level with readRoomAxes(roomDir), both in try/catch. They call composeWorkflow(chain, opts) only when a job id exists, else composeWorkflow(chain) with one argument."
  - "Fence O1 allows exactly 4 readers of shortlist.cjs under lib/, hooks/ and bin/: next-move.cjs, command-resolver.cjs, present.cjs and selection-log.cjs (plan 09, allowed in advance). Today 3 of the 4 exist."
metrics:
  tasks: 2
  completed: 2026-11-24
---

# Phase 399 Plan 08: Advisor ranks a framework's commands inside the one door, and the one-selector fence Summary

Inside composeWorkflow the decision advisor now picks among a framework's up-to-five commands for the room's known job (opt-in, strictly greater value only, no move on a tie), the two room-aware callers pass the job and level, and a fence test with a mutation control pins that no second selection authority exists.

## Tasks

| Task | Name | Commit |
|------|------|--------|
| 1 | composeWorkflow ranks a framework's commands by the advisor (W1-W6, G1-G4) | b682112b2 |
| 2 | One-selector fence with mutation control (O1-O5) | 955a58c64 |

## What was built

- command-resolver.cjs: `_advisorContext(opts)` lazy-requires shortlist.cjs only when opts has a job id and the advisor is on, reads the table meta once and computes the abstain flag (top_tie above 1). `_rankCommands` orders the framework's commands. The header comment states the opt-in, the tie rule and the names-only output. The no-Brain rule is unchanged (the new require is local data).
- sensors.cjs framework_run and scripts/act-command.cjs: build `advisorOpts` from the room job and level; one-argument call otherwise. Other callers (chain-recommender, eureka-offer, futures orchestrator, explore-chain, chain.cjs, suggest-next-command, pipeline-command) pass no options and are untouched.
- test-399-workflow-advisor.cjs: fixture tables only (the shipped table is not read), on the Six Thinking Hats framework (4 commands).
- test-399-one-selector-fence.cjs: O1 scans lib/, hooks/ and bin/ (comment-stripped, resolved require paths) with positive controls; O2 forbids 9 selector-input and authority modules in the advisor files; O3 forbids decision-verb export names; O4 compares 6 selector inputs with and without a job, advisor off against an absent table; O5 injects a ranker require into a scratch copy of present.cjs (under os.tmpdir, removed in finally) and shows the scan catches it, a comment mention does not, and the O1 scan catches a scratch reader.

## Verification

- `node tests/test-399-workflow-advisor.cjs`: 14 passed, 0 failed. RED shown first (10 failed on the base before the resolver edit).
- `node tests/test-399-one-selector-fence.cjs`: 5 passed, 0 failed.
- `bash tests/run-all-399.sh`: exit 0, 13 PASSED lines.
- W6 behavior: act-command is run as a spawned process on scratch rooms (`--chain --from-framework "Six Thinking Hats" --room <scratch>`). Advisor unset with a goal job: output equals the no-job room. Advisor on with a goal job: the picked command shows. Advisor on without a job: unchanged. The framework_run handler is driven through the registered handler (fake server seam, as in test-386) with the same three cases.
- Base exit codes recorded before editing, same after: command-resolver.test.cjs 1 (pre-existing "Red Teaming must remain command-less", not mine), test-347-routing-floor 0, test-254-one-chain-source 0, test-213-eureka-offer 0, test-386-framework-run-halt-gate-minted 0, test-237-one-authority-fence 0, test-346-no-second-brain 0, test-recipe-maps-authority 0, test-3696-one-next-move 0, test-148-frozen-contracts 0.
- run-all-36925: PASSED=54 FAILED=3, the same 3 as base.
- Non-comment lines of command-resolver.cjs hold no brain-client, fetch( or node:http(s) text.
- 0 em or en dashes in the files this plan touched.
- No SQL table, index or column was added; the schema guard needed no entry.

## Deviations from Plan

### Plan text not followed

**1. [Orchestrator guard over plan W3] Advisor off gives no new keys, not registry_order**
- Plan W3 said MINDRIAN_DECISION_ADVISOR=off still yields command_basis 'registry_order' and ranked_commands. The orchestrator guard (advisor opt-in, default byte-identical) takes precedence. With the advisor not on, no step gains a key. The plan's W3 cases "no non-weak command", "no row for the job" and "missing table" still give registry_order and ranked equals the registry list, but only when the advisor is on.

**2. [Orchestrator guard] Tie at the top abstains**
- The plan did not name the tie rule. Added from 399-07: top_tie above 1 gives registry order, command_basis registry_order (leg G2).

**3. [Plan text] Acceptance "13 PASSED lines" and "base codes"**
- Held as written. The plan's command-resolver.test.cjs acceptance holds at base code 1 (pre-existing failure); the file stops at its first failed assertion, so its later legs do not run at base either.

### Auto-fixed Issues

None.

## Risks and open items

- With the shipped v0 job-only table and the advisor on, framework_run and act --chain can run a different command than registry order for a framework in a room with a goal job. The table calibration is circular (399-06), so this is reachable only by explicit opt-in.
- The O1 allow-list names selection-log.cjs, which plan 09 creates. If plan 09 puts the logger elsewhere, update the list in the same commit.
- The task commit hook printed advisory tool-honesty WARN lines (room_list, room_search); they are not from this plan and did not block.
- TDD note: the W legs were written and shown failing on the base before the resolver change. The fence legs O1-O4 passed on first run because the fence pins the current state; O5 is its mutation control.

## Known Stubs

None.

## Self-Check: PASSED

- Files found: tests/test-399-workflow-advisor.cjs, tests/test-399-one-selector-fence.cjs, lib/workflow/command-resolver.cjs, lib/mcp/tools/sensors.cjs, scripts/act-command.cjs, tests/run-all-399.sh.
- Commits found: b682112b2, 955a58c64.

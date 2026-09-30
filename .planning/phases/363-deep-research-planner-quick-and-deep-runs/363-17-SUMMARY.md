---
phase: 363-deep-research-planner-quick-and-deep-runs
plan: 17
subsystem: mcp-tool
tags: [mcp-tool, research_run, desktop, cowork, gate-render, gate-ledger, material_step, born-wired, tri-polar, d-04, d-14]

requires:
  - phase: 363-15
    provides: planner facade (planner.cjs) and the CLI contract this tool mirrors
  - phase: 363-12
    provides: runQuick (quick runs execute in the MCP server process)
  - phase: 363-14
    provides: buildBasket, basketCard, fileRun (filing on an approved selection)
provides:
  - lib/mcp/tools/research.cjs - the research_run MCP tool (register, connectors)
  - tests/test-363-mcp-tool.cjs - 15 checks (M1-M12, dash guard, net guard, fetch restore)
  - regenerated connector registry, coverage ledger, mcp-tool projection and harness manifest
  - test-270 AFTER re-baselined to 45 tools
affects: [363-18, 363-19, 363-20, 363-21, 363-22]

tech-stack:
  added: []
  patterns:
    - "An approval is a single-use material_step gate in gate-ledger whose resumeFn calls the facade; the navigator answers through the existing gate_answer tool, so there is one governed gate path"
    - "The resumeFn persists the grant and the decision node before it returns, because a gate id lives in one server process (Pitfall 13)"
    - "Filing authority is a process-local, session-scoped, single-use record written by the basket gate's resumeFn; the file op reads it and never a flag in the input"

key-files:
  created:
    - lib/mcp/tools/research.cjs
    - tests/test-363-mcp-tool.cjs
  modified:
    - tests/test-270-tool-schema-budget.cjs
    - data/mcp-tool-connectors.json
    - data/connector-registry.json
    - data/connector-coverage-ledger.json
    - data/harness-manifest.json

key-decisions:
  - "Ten ops (planners, plan, grant_request, grant_status, grant_revoke, run_quick, deep_plan, basket, file, pending) all route through planner.cjs, quick.cjs, grants.cjs or structure.cjs; the tool holds no engine logic."
  - "Gate options reuse the option ids of the facade card (F.0: approve_standing, approve_run, not_now; F.6: run, edit, stop; basket: one id per item plus file_nothing). A gate_answer verdict of approve only executes when chosen names an approving option; otherwise the resumeFn answers chosen_not_approving and writes nothing."
  - "run_quick with no covering grant returns the F.0 card AND a grant gate in the same response, so one gate_answer plus one repeat call finishes the job. Zero fetches happen before the grant."
  - "deep_plan returns the F.6 gate and a deep_execution line: the deep run itself executes in Claude Code, the plan is saved under .mindrian/research-runs/<run_id>/, and the approval lasts about the plan's time budget (20 minutes) before Claude Code asks again."
  - "The room is the session-bound room (resolveMcpSessionRoom). An unbound session (source cwd or none) gets no_room_bound; an optional room input must match the bound room or the call is refused without echoing it."
  - "An inline elicitation answer (CLI) is consumed from the ledger at once and run through the same resumeFn, so an answered card cannot be replayed."
  - "The enum errorMap says only 'unknown op', so schema errors never echo the input (M10)."

patterns-established:
  - "MCP door uses the same facade, the same gate ledger and the same gate_answer as every other gated tool; a new door adds a tool, never a gate path"

requirements-completed: []
requirements-progressed: [DRP363-14, DRP363-04]

duration: ~75min
completed: 2026-09-30
---

# Phase 363 Plan 17: research_run MCP tool for Desktop and Cowork Summary

**One MCP tool now lets Desktop and Cowork plan, ask for a grant, run quick research, review a deep plan and file findings through the same facade the CLI drives, with every approval a single-use gate answered through gate_answer and persisted to the room before it returns.**

## PLAN_BASE

`e72eea033101e821c3a0a60c3afcc3ae70f7bd2d` (HEAD at the first edit).

## Task commits

| Task | Commit | Files |
|------|--------|-------|
| 1 RED | 09e587528 | tests/test-363-mcp-tool.cjs (12 legs failing, tool missing; 3 guard checks passing) |
| 2 + 3 GREEN | 12ca953a0 | lib/mcp/tools/research.cjs, data/mcp-tool-connectors.json, data/connector-registry.json, data/connector-coverage-ledger.json, data/harness-manifest.json, tests/test-270-tool-schema-budget.cjs, tests/test-363-mcp-tool.cjs (M6 fixture) |

Both are ancestors of HEAD (`git merge-base --is-ancestor`). The plan asks for Tasks 2 and 3 in one commit; that is what 12ca953a0 is.

## Tests

`node tests/test-363-mcp-tool.cjs`: PASS 15, FAIL 0 (M1-M12, dash guard, net guard with zero real attempts, global fetch restored). Beside it: test-270 5/5, test-234 192/192 (coverage 45/45 tools), test-265-mcp-description-hygiene 208/208, test-235-seam-liveness-mcp-coverage PASS, test-248-resolver-census 4/4, test-363-cli 17, test-363-filing 51, test-363-grants 13, test-198-gate-renderers PASS, test-265-mcp-surface-organ 16, test-276-meeting-gate-wiring 14, test-354-concurrency-surfaces 25.

Generator gates, all exit 0: `build-connector-registry --check`, `build-orchestration-projection --check`, `build-harness-manifest --check`, `build-command-registry --check`, `check-render-coverage` (17 covered, 0 gap; md-keyspace 202 wired, 0 unwired), `check-layer-declaration` (291 surfaces, 254 declared, 37 exempt), `check-cirs-declaration --check` on this plan. `check-shape-declaration --check` ends advisory WARN with the same 53 violations as before, none naming research_run or any mcp-tool.

Real-server check (scratch, not committed): the SDK's McpServer plus InMemoryTransport lists research_run with the enum schema, answers op planners, and rejects an unknown op and a string question_set with a -32602 that does not echo the input.

## What the tool does (for 363-18 and 363-19)

Input: `{op, room?, question_set?, run_id?, grant_id?, gate_id?, mode?, terms?}`. Every response carries `pending_cards` (room-started cards, each shown once, then marked surfaced).

| op | Effect | Gate |
|----|--------|------|
| planners | `structure.plannersForRoom` for the bound room | none |
| plan | `buildPlan` then `cardFor`; returns run_id, status, next, card, new_terms | none |
| grant_request | with run_id: the F.0 card and proposal from `cardFor`; without: `proposeGrant(terms)` | F.0 material_step gate; approve_standing writes the standing grant, approve_run writes the run grant (`approvePlanReview`), both with `approvedVia:'mcp'`, decision node minted, before return |
| grant_status | `planner.grantStatus` | none |
| grant_revoke | `grants.revokeGrant` (only reduces authority, so no gate, like the CLI) | none |
| run_quick | `quick.runQuick` in the server process with native fetch; `done` returns verdict, answer_line, evidence card, escalation_offer; `reask` returns the F.0 card plus a grant gate, zero fetches | grant gate on reask |
| deep_plan | `buildPlan(mode deep)` or an existing run_id, then the F.6 review gate and a `deep_execution` line; approving writes the run grant, nothing is fetched, no deep state is started | F.6 material_step gate (run / edit / stop) |
| basket | `basketFor`; one multi-select gate option per item plus file_nothing | F.8-shaped material_step gate |
| file | `fileFromState` with the items the navigator chose; needs the basket gate id, answered through gate_answer, same session, same room, used once | none of its own (the basket gate is the authority) |
| pending | `pendingCards`, marked surfaced | none |

How a Desktop turn goes: call the op, show `card.body_md` and the gate, the navigator answers, call `gate_answer {gate_id, chosen, verdict}`, read `chain_result`. For file, call `research_run {op:'file', gate_id}` after the basket gate was approved.

## Test-270 AFTER (tool budget)

Measured live before and after this tool in the same tree: 44 tools, 47345 total bytes (19395 desc, 27950 schema) before; 45 tools, 48712 total bytes (19892 desc, 28820 schema), about 12178 approx tokens after (router 9, atomic 36). research_run costs +1 tool, +497 desc bytes, +870 schema bytes, +1367 total bytes: **+2.89 percent** (`pctChange(47345, 48712)`). Against the previous recorded AFTER (358-10, 48321) it is +0.81 percent; that old constant sat 976 bytes above what the tree measured just before this tool, so the gap is earlier unrelated drift, recorded in the constant's comment instead of absorbed. New AFTER: plan `363-17`, measuredAt `2026-09-30`, toolCount 45, totalDescBytes 19892, totalSchemaBytes 28820, totalBytes 48712, approxTokens 12178, routerCount 9, atomicCount 36. The commit message names the +2.89 percent.

## test-198-contract-schema (known red at PLAN_BASE)

Signature unchanged. It fails at `contract_version registers (flag off)` (line 134) because its stub server implements only `server.tool`, not `server.registerTool`, so every 267-era tool module (chain, claim, claim-verify, gate, and now research) reports "server.registerTool is not a function" on stderr. My tool adds one more such stderr line (`research.cjs (register)`) and changes nothing about the assertion that fails first. The test does not enumerate tools by name, so it was not edited. Repairing its stub is outside this plan.

## Open Question 5 (check-shape-declaration and MCP descriptors)

`check-shape-declaration --check` enumerates the 32 mcp-tool connectors (now including research_run) without any finding about them; its 53 advisory WARNs are all skill/command class and unchanged. The registry projection for an MCP tool (`build-connector-registry.cjs`, the `mcp:<tool>` entry) has no `hitl_stages` slot at all, only `hitl_shape`, `hitl_why`, `layer`, `layer_why`. So an MCP descriptor cannot carry `hitl_stages` today, and declaring `hitl_shape: 'F.6'` (D-14) is the only valid form; it validates clean.

## Regenerated files

`data/connector-registry.json` (+1 connector: mcp:research_run), `data/mcp-tool-connectors.json` (+1), `data/connector-coverage-ledger.json` (the mcp_tool_file:lib/mcp/tools/research.cjs surface, wired 199 to 200; not in the plan's file list, but the same generator writes it and `--check` fails without it), `data/harness-manifest.json` (only the connector-registry digest and source_count 213 to 214 moved, computed with `buildManifest`/`serializeManifest` into a scratch file and diffed before applying). `build-orchestration-projection --check` needed no regeneration. All hunks were about research_run; no peer drift.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The coverage ledger is a fourth generated file**
- **Found during:** Task 3
- **Issue:** the plan lists three data files, but `build-connector-registry` also writes `data/connector-coverage-ledger.json`, and `--check` stays stale without it.
- **Fix:** regenerated and committed it with the others (one hunk: `wired` 199 to 200).
- **Commit:** 12ca953a0

**2. [Rule 1 - Bug] M6 used a fixture that cannot reach the F.6 review gate**
- **Found during:** Task 2
- **Issue:** `map-unknowns` in deep mode carries no search text, so `cardFor` answers `revise / no_search_terms`, not the review card. 363-15's own C10 leg uses `scientific-roadmapping` for the deep loop.
- **Fix:** M6 now plans from `scientific-roadmapping`; the not-ready leg still uses `restated-only`. Test-only change, committed with the tool.

### Interpretations

- Pre-state gate: `build-connector-registry --check` was stale before any regeneration, only because this plan's new tool file existed; the diff after regeneration contained research_run hunks and nothing else, and `git status --short -- data/ lib/mcp/ ...` was clean of peer files.
- The plan's M3 says approval is recorded with `approved_via {surface:'mcp', decision_node_id}`. The facade builds that object itself from `{approvedVia:'mcp'}`, minting its own decision node; gate_answer also writes its usual `decision:gate` node, so an approval leaves two decision nodes (the gate's, and the grant's). Both are proposed/confirmed through the shipped chokepoints.
- The plan lists `room?: string`. It is accepted only as a check against the bound room (slug or directory name); it never selects a different room.

No auth gates.

## Notes for 363-18 (the /mos:research runner)

- A run grant expires `time_budget_ms` after approval (deep 20 minutes). deep_plan says so in `deep_execution`; a Claude Code session that starts a deep run from a Desktop-approved plan more than that later gets `no_grant` from `deep-next` and must call `review approve --approved-via cli` again.
- `deep_execution` names the `/mos:research` command as the way to run a saved plan; 363-18 must accept a run id of a plan already saved in `.mindrian/research-runs/<run_id>/`.
- The Desktop door has no revise op: a not-ready plan is fixed by calling `plan` again with an amended question set (new run id).
- Approved baskets live in process memory only (single use, 30 minute TTL, session-scoped): after a server restart the navigator asks for the basket again.
- `pending` is normally unnecessary because every response already carries `pending_cards`; it exists to fetch them explicitly.

## Requirements

DRP363-14 (one governed runner) and DRP363-04 (grants) progress: the MCP door, persisted grants and gated filing are in. Neither is ticked here; DRP363-14 still needs 363-18 (the /mos:research runner), and 363-04 closes with the runner's grant and filing path, as 363-15 recorded.

## Known Stubs

None. Every op calls live engine code; the only in-memory state is the intentionally process-local approved-basket table.

## Threat Flags

None new. The tool adds no network surface of its own: the only outbound strings are quick-run searches after `validateExecutedQuery`, exactly as in the CLI. M11 audits the tool source (no remote-brain or Theo reference), the registered tool list, every replay URL, the audit ledger, the grants file and the response for the planted marker. Threat register: T-363-08 (forged approval or replayed gate id) mitigated by M3 and M7 (single use, session scope, unanswered or made-up ids refused); T-363-46 (approvals lost on restart) by M4; T-363-02 by M11; T-363-12 by the pre-state gate and per-hunk inspection; T-363-47 by the deliberate test-270 re-baseline.

## Deferred Issues

None from this plan.

## Self-Check: PASSED

Found: lib/mcp/tools/research.cjs, tests/test-363-mcp-tool.cjs, data/mcp-tool-connectors.json (contains research_run), data/connector-registry.json, data/connector-coverage-ledger.json, data/harness-manifest.json, tests/test-270-tool-schema-budget.cjs. Commits 09e587528 and 12ca953a0 are ancestors of HEAD. No em-dash or en-dash in any written file.

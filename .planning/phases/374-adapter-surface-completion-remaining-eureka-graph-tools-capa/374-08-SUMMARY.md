---
phase: 374-adapter-surface-completion-remaining-eureka-graph-tools-capa
plan: 08
subsystem: mcp
tags: [eureka, pair-screen, approval-gate, plan-then-start, part-8, part-11]
requires: ["374-02", "374-03", "374-06", "374-07"]
provides:
  - "opportunity.run_pair_screen through eureka_capability_start: plan, one material_step gate (F.6 card), start inside resolve only, verified result"
  - "PLAN_ROUTES, the PAIR_SCREEN_IDS needs branch, ASYNC route, sync refusal capability_requires_approval"
  - "lib/mcp/eureka-pair-screen.cjs: checkStartInput, buildPairScreenRequest, planPairScreen, REFUSALS (15 codes), planSummary, cardBody"
affects: [374-10, 374-12, 374-13]
key-files:
  created:
    - tests/test-374-routes.cjs
    - tests/test-374-route-needs.cjs
    - tests/test-374-plan-gate.cjs
    - tests/test-374-pair-screen-egress.cjs
    - tests/test-374-result-wiring.cjs
  modified:
    - lib/mcp/tools/eureka-capability-run.cjs
    - lib/mcp/tools/eureka-capability-jobs.cjs
    - lib/mcp/eureka-pair-screen.cjs
    - lib/core/eureka/eureka-engine-requirements.cjs
    - data/mcp-tool-connectors.json
    - data/connector-registry.json
    - data/harness-manifest.json
key-decisions:
  - "Gate lines read: ACT OD-5A F6 go (card shape F.6), READ OD-2 ADD-FORGET-TOOL (delete-path wording: To forget this run later, ask Larry to forget it.). PLAN-GO 374-08."
  - "The pair screen is intercepted by capability id inside startCapability before the generic lineage guard, because scope_id and snapshot_id come from the room projection, not from the caller."
  - "eureka-tool-contract.cjs was not changed: the Pitfall 7 assertion (N3) passed as it stands."
requirements-completed: [PLG374-05, ADAPT374-02, ADAPT374-04]
canon_parts: [3, 7, 8, 11]
---

# Phase 374 Plan 08: Pair screen route, plan then approval gate then start, verified result

A person selects nodes, Larry calls eureka_capability_start with opportunity.run_pair_screen, the plugin builds the bundle only through prepare() and project(), plans on one short-lived child, and mints one material_step gate with a card that holds counts and fixed sentences. Only an approve on that gate starts the run, with the planned request byte-equal plus approval { plan_digest, approval_ref = gate id }. The result passes verifyPairScreenResult before the model sees it. No tool was added (75 tools), no description and no input schema changed.

## Gate

`node 374-gate.cjs plan 374-08` printed `ACT OD-5A F6 go`, `READ OD-2 ADD-FORGET-TOOL`, `PLAN-GO 374-08`, exit 0. BASE = ca10a1cd1b0eb06746b3944f464750cf3d65781b (a peer commit moved HEAD from 58d494d9d to ca10a1cd1 between my first read and the gate run; BASE is the HEAD at the gate run).

## RED output (before the code)

Task 1 (R, N and E written first):

```
FAIL - R1 ... :: ALLOWED_MCP_ROUTES lacks the start route
FAIL - R2 ... FAIL - R3 ... FAIL - R4 ...
FAIL - N1 ... :: eureka_capability_start extras ["mcp-server"]
FAIL - N2 ... :: no refusal for the absent group
FAIL - N3 ... :: PAIR_SCREEN_IDS is not defined
FAIL - E1 ... (the start answered lineage_required: the pair-screen branch does not exist)
FAIL - E2 ... E6   (plan calls: 0, start calls: 0, scout_capabilities calls: 0)
test-374-pair-screen-egress: 0 passed, 6 failed
```

Task 2: `FAIL - P1` to `FAIL - P7` (P1, P4, P7 on lineage_required; P2 on TOP_K_MAX; P3 on the missing REFUSALS table; P5 on executed; P6 on the message).

Task 3: `FAIL - J1` (no verification in jobResult), `FAIL - J2` (hitl_shape was none).

## GREEN output

```
ok - R1 .. R4          (4 ok)
ok - N1 .. N3          (3 ok)
ok - P1 .. P7          (7 ok)
ok - J1, J2            (2 ok)
ok - E1 .. E6          (6 ok)   test-374-pair-screen-egress: 6 passed, 0 failed
```

The E file was RED in Task 1 and went GREEN with the Task 2 code (the plan, gate and start path), before the Task 3 verifier wiring; the verifier wiring is covered by J1.

Mutation check: removing the pair_screen branch line from startCapability (the `if (args.capability_id === pairScreen.PAIR_SCREEN_CAPABILITY_ID) return startPairScreen(...)` line) made E1, E2, E3, E4, E5 and E6 all fail; the line was restored (cmp equal) and E1 to E6 pass again.

## What changed

- eureka-capability-run.cjs: `scout_start_pair_screen` in ALLOWED_MCP_ROUTES; exported `PLAN_ROUTES`; `resolveCapability` keeps `plan_tool` and refuses a plan_tool outside PLAN_ROUTES; `invokeCapabilityWithClient` returns capability_requires_approval for that route before any tool call (the sync tool refuses the capability). The plan route literal appears in lib only in the PLAN_ROUTES definition.
- eureka-engine-requirements.cjs: `PAIR_SCREEN_IDS` branch (mcp-server plus encoder extra, model yes, node no). PAIR_IDS is unchanged.
- eureka-capability-jobs.cjs: `startCapability` split into a public function plus `launchJob(params, deps)` (the old connect, catalog, contract, start and session code, answers unchanged) plus `startPairScreen`. Start route is in ASYNC_ROUTES. The pair-screen start route is reached only through launchJob with the approval block; a catalog entry of another capability id that points at that route is refused with capability_requires_approval (extra guard, T-374-30, pinned in P2). `register` passes `{ ctx, server }`. `jobResult` runs `verifyPairScreenResult` for this capability and returns label, counts, caps_hit, warnings, the verified summary and engine_result; a failure returns its fixed refusal (the session is already closed). Connector row of the start tool: hitl_shape F.6.
- eureka-pair-screen.cjs: TOP_K_MAX (100), checkStartInput, buildPairScreenRequest (closed artifact key copy, deep frozen), planPairScreen (one child, plan route read from the catalog), the refusal table, planSummary (allow-list), planWarnings (untrusted), cardBody. It still requires only node:crypto at load; the plan call requires the run helpers inside the function.
- Generated: data/mcp-tool-connectors.json and data/connector-registry.json changed in the start row only (4 lines each). The coverage ledger did not change. The pre-commit hook found data/harness-manifest.json stale (it digests connector-registry.json); `node scripts/build-harness-manifest.cjs` regenerated it, only the wiring digest changed, and it is part of this commit.

## Behaviour notes

- Start input (before any child or room read): request keys limited to node_ids, objective, top_k. artifacts gives pair_screen_requires_node_ids; approval gives pair_screen_approval_not_accepted; MINDRIAN_EUREKA_ALLOW_NETWORK=1 gives network_opt_in_active; node_ids 2 to 2,500 (node_ids cap unchanged), unique; objective non-empty up to 5,000; top_k integer 1 to 100 (top_k NOT changed, plan 374-12 owns that). A caller idempotency_key is ignored; the key is sha256(plan_digest + ':' + gate id).
- Egress: only the selected node projections cross (text capped at 4,096 characters by project(), guarded again in the request builder). Result text and plan text go nowhere but the model that called the tool. The card and the awaiting_approval answer hold counts, engine names and fixed sentences only. Plan warnings are returned as `plan_warnings { untrusted: true, items }` and never shown on the card.
- Restart between plan and answer: the gate ledger is in memory, so the answer finds no gate. The awaiting note says: plan again with eureka_capability_start.

## Fixed refusal sentences (reason code to sentence)

| Code | Sentence |
|------|----------|
| bad_request | The engine did not accept this request. Check the objective and the selected notes, then plan again. |
| too_many_artifacts | More than 3,000 notes were sent. Select 3,000 notes or fewer, then plan again. |
| bundle_too_large | The selected notes hold too much text. Select fewer or shorter notes, then plan again. |
| duplicate_artifact_id | Two selected notes share one id. Select each note once, then plan again. |
| id_collision | Two note ids look the same after cleaning. Rename one note, then plan again. |
| artifact_hash_mismatch | A note changed after it was selected. Select the notes again, then plan again. |
| external_corpus_refused | The engine accepts room notes only. Select notes from this room, then plan again. |
| approval_missing | The start had no approval. Plan again, then ask for approval. |
| approval_bad_reference | The approval did not follow the expected form. Plan again, then ask for approval. |
| plan_unknown | The engine has no record of this plan. Plan again, then ask for approval. |
| plan_expired | The plan is older than 24 hours. Plan again, then ask for approval. |
| plan_consumed | This plan was used already. Plan again, then ask for a new approval. |
| plan_mismatch | The request differs from the approved plan. Plan again, then ask for approval. |
| local_model_unavailable | The engine found no local meaning model. Install a local model, then plan again. The engine does not download one. |
| too_few_usable_records | Too few notes have usable text. Select more notes with longer text, then plan again. |
| (any other code) reason pair_screen_refused | The engine refused this run. Plan again later or select different notes. |

## Existing tests edited

None. No existing test pinned the id sets, and no assertion changed.

## Verification (PROVEN, run in this tree)

- `bash tests/run-all-374.sh`: PASS=11 FAIL=0 (includes routes, route-needs, plan-gate, pair-screen-egress, result-wiring, and the dash fence).
- `bash tests/run-all-374.sh --neighbors`: PASS=39 FAIL=0 SKIPPED=0.
- test-341-eureka-no-brain-reach (PASS=24), test-387-eureka-egress (22/22), test-387-eureka-route-needs, test-387-eureka-engine-requirements, test-387-eureka-engine-states, test-387-eureka-installed-layout, test-eureka-capability-run, test-289-review-fixes: all exit 0.
- test-270-tool-schema-budget: 5 passed, 0 failed, 75 tools (no tool added). `node tests/test-384-s7-mcp-start.cjs parity`: ALL PASS. 267 mcpv2 files: all pass except two noted below.
- build-connector-registry --check OK; build-orchestration-projection --check OK; check-render-coverage 0 gap; check-shape-declaration --check is advisory (51 WARN, all on skills and commands, none on the Eureka tools).
- Pins: the 384 golden, the 267 snapshots and the test-270 constants did not change and none turned red. No description or input schema changed, so plan 374-13 has nothing to refresh from this plan.

## Deviations from Plan

**1. [Rule 2 - extra guard] launchJob refuses the pair-screen start route unless the capability id is the pair screen and the request carries the approval block.**
- Why: without it, a catalog entry of another id pointing at that route would start without a gate through the generic path.
- Pinned in P2 (other_pair_route). No plan arm count changed.

**2. [Rule 3 - tooling] The Write tool turned the escape sequences for en and em dash in the first draft of test-374-plan-gate.cjs into literal characters.** The dash fence of run-all-374 caught it; fixed back to the escape form. All written files grep clean for non-ASCII bytes.

No other deviation. No package was added. package.json is unchanged.

## Pre-existing failures seen (not caused by this plan)

- tests/test-267-mcpv2-cirs-gates.cjs Check (c): "expected 35 connector descriptors, got 62". The count in data/mcp-tool-connectors.json is 62 at HEAD and 62 now (this plan only changed one row). Not in the plan's named set.
- tests/test-267-mcpv2-cli-probe.cjs exits 77 (environment gap).

## Known Stubs

None. The `deps.callEurekaWorkflow` stand-in in the E file is test-only.

## UNVERIFIED

- The real engine's plan and result shapes (no live run, no local model, D-02); the fake copies the contract text. A real engine that returns extra plan keys is tolerated; a real engine that omits counts or engines is refused as engine_invalid_response.
- Whether the real engine accepts an artifact built from the projection with only the keys id, source_ref, title, text, corpus, media_type, sha256 that the bundle step returns; the request builder copies only those keys.
- Windows (the E file exits 77 on win32), multi-host behavior (Claude Desktop, Cowork), and the inline elicitation path of the card with a real client (covered only by plan 374-03 arm A5 for the minter itself).
- The delete-path sentence names a forget tool that plan 374-13 creates. Until that plan lands the card promises a delete path the product does not yet have.
- Result size: the verified engine_result passes inline file content to the model; the 256 KiB warning of response() applies and no paging is added here (ADAPT374-03 is another plan).

## Threat Flags

None. No new endpoint or auth path. The new file read of the room goes only through prepare() and project().

## Self-Check

Files present and commit list: see the hand-off report (commit hash recorded there).

---
phase: 374-adapter-surface-completion-remaining-eureka-graph-tools-capa
plan: 01
subsystem: testing
tags: [mcp, wire-pins, 267, eureka]
requires: []
provides:
  - green 267 suite on the live 75-tool surface
  - registration-api attribution that skips forwarding wrappers
affects: [374-02, 374-03, 374-04, 374-05]
tech-stack:
  added: []
  patterns: [membership delta for tools added after the zod 3 snapshot]
key-files:
  created: []
  modified:
    - tests/test-267-mcpv2-registration-api.cjs
    - tests/fixtures/267/wire-snapshot-zod4.json
    - tests/fixtures/267/zod4-accepted-deltas.json
key-decisions:
  - "Skip two forwarding frames in attributedFile: the registerEurekaTool wrapper file and the registerForCapability helper function"
  - "Leave wire-snapshot-zod3.json and 3696-known-failures.json byte-equal"
requirements-completed: [PLG374-01]
duration: 1 session
completed: 2026-11-08
---

# Phase 374 Plan 01: Refresh the stale 267 wire pins Summary

The 267 suite is green on the live 75-tool surface: the registration-api attribution now skips forwarding frames, and the zod4 snapshot plus 25 membership deltas cover the 25 Eureka and RS tools added by 6bc8cfc55.

## Commits

- b51bb25b9: test(374-01): attribute registerEurekaTool calls to the calling tool file (Task 1, tests/test-267-mcpv2-registration-api.cjs only)
- 6aaa7496e: test(374-01): move the 267 wire pins for the 25 Eureka and RS tools (50 to 75) (Task 2; this SUMMARY is in the same commit)

## RED evidence (before the plan, HEAD e98c1a292)

| File | Exit | Result |
|------|------|--------|
| test-267-mcpv2-dual-era.cjs | 1 | PASS=3 FAIL=2 (era 2025, era 2026: "tools and prompts must equal the zod4 snapshot plus only the accepted deltas", 25 extra `tool:<name>:membership` keys) |
| test-267-mcpv2-zod4-contract.cjs | 1 | PASS=3 FAIL=1 (Check b, extras = the 25 names, missing = []) |
| test-267-mcpv2-clients.cjs | 1 | 4 passed, 1 failed ("tools/list count must equal snapshot count 50", 75 !== 50) |
| test-267-mcpv2-registration-api.cjs | 1 | PASS=74 FAIL=17 (16 "zero calls attributed to this file" plus "live tools/list count (75) != ... (50)") |
| test-267-mcpv2-lockstep.cjs | 0 | PASS=6 FAIL=0 |

The 16 "zero calls attributed" files: eureka-capability-jobs, eureka-capability-run, eureka-graph-analyze, -backtest, -compare-topics, -discovery-signals, -genesis-plan, -map, -opportunity-scout, -package-relationships, -prepare-artifacts, -projection, -propose, -rank-paths, -score-surprise, eureka-hsi-interpret-whitespace (all under lib/mcp/tools/).

Task 1 intermediate run (after the first skip only): PASS=96 FAIL=2, one file still at zero calls (eureka-graph-propose.cjs).

## GREEN evidence (after the plan)

| File | Exit | Result |
|------|------|--------|
| test-267-mcpv2-dual-era.cjs | 0 | PASS=5 FAIL=0 |
| test-267-mcpv2-zod4-contract.cjs | 0 | PASS=4 FAIL=0 |
| test-267-mcpv2-clients.cjs | 0 | 5 passed, 0 failed |
| test-267-mcpv2-registration-api.cjs | 0 | PASS=98 FAIL=0 (0 lines with "zero calls attributed") |
| test-267-mcpv2-lockstep.cjs | 0 | PASS=6 FAIL=0 |
| test-270-tool-schema-budget.cjs | 0 | 5 passed, 0 failed; "budget: 75 tools" |
| test-384-s7-mcp-start.cjs parity | 0 | exit 0 |
| test-3696-known-set.cjs | 0 | PASS: 26 FAIL: 0 |
| test-276-tool-honesty-findings-closed.cjs | 1 | 5 failing lines before and after (unchanged, unrelated; fixture untouched) |

## The 25 added tools (names, in live order)

eureka_capability_job_cancel, eureka_capability_job_result, eureka_capability_job_status, eureka_capability_run, eureka_capability_start, eureka_graph_analyze, eureka_graph_assess_category_edge_patterns, eureka_graph_backtest, eureka_graph_compare_topics, eureka_graph_find_community_bridge_pairs, eureka_graph_find_network_holes, eureka_graph_find_shared_neighbor_gaps, eureka_graph_find_similar_unlinked_items, eureka_graph_genesis_plan, eureka_graph_map_neighbourhoods, eureka_graph_opportunity_scout, eureka_graph_package_relationships, eureka_graph_prepare_artifacts, eureka_graph_project, eureka_graph_propose_relationships, eureka_graph_rank_paths, eureka_graph_score_surprise, eureka_hsi_interpret_whitespace, rs_experts_find, rs_thesis_read.

These equal the Check b extras byte for byte (T-374-01). All 50 old tool entries are unchanged (checked by object equality after the merge). No pinned description moved. The non-tool parts of the zod4 file (protocol, instructions, prompts, resources, templates) are unchanged. The new entries come from a live capture (hermetic env, helper tests/helpers/mcp-wire-267.cjs) with the live key set name, title, description, inputSchema. Entries sit in live order, as the old entries do.

## Files

- wire-snapshot-zod4.json: 50 to 75 tools; refreshed_by gained one sentence naming 374-01.
- zod4-accepted-deltas.json: 25 `membership` entries appended to `zod4_other` (7 to 32 entries), format of the gate_list and room_create entries.
- wire-snapshot-zod3.json: NOT changed. No description of an existing tool differs, and the new tools are membership deltas (3379e406c precedent).
- 3696-known-failures.json: NOT changed. test-3696-known-set.cjs passes 26 of 26 with the dual-era and registration-api entries still recorded; the note there says a green run of a recorded entry counts as healed. The two entries are now stale but harmless; a later cleanup may remove them.

## Deviations from Plan

**1. [Rule 1 - Bug] Second skip in attributedFile (registerForCapability)**
- Found during: Task 1.
- Issue: after the wrapper skip, eureka-graph-propose.cjs still had zero calls. Its register function calls registerForCapability, a shared helper exported by eureka-graph-analyze.cjs. The call was attributed to eureka-graph-analyze.cjs, so analyze got two calls and propose got none. The tool is real and on the wire (eureka_graph_propose_relationships), so this is an attribution defect, not a missing registration (T-374-02: read and reported, not hidden).
- Fix: skip a stack frame whose function name is `registerForCapability`, with a comment. No file name is skipped. Every other leg is unchanged. PASS rose 74 to 98 in total with the pin refresh; each tool file now has its own call.
- Files modified: tests/test-267-mcpv2-registration-api.cjs
- Commit: b51bb25b9

**2. Git safety assertion note.** The tree is a linked git worktree whose HEAD is branch main (not a worktree-agent-* branch). The caller set this on purpose (main, no worktree isolation, commit --only). Commits went to main in this tree. Nothing was pushed.

## Known Stubs

None.

## Threat Flags

None. No product file changed. The diff 62e2a4ec9..HEAD under lib shows only lib/core/review-contract.cjs, from the peer Phase 370 executor (commit e98c1a292), not from this plan.

## Self-Check: PASSED

Checked: the three modified fixture and test files exist; commit b51bb25b9 exists; the five 267 files exit 0.

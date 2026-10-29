---
quick_id: 261024-uqs
slug: tool-budget-rebaseline
date: 2026-10-24
status: complete
commit: 06b4de866
tree: /home/jsagi/dev/MindrianOS-Plugin-release
key-files:
  modified:
    - tests/test-270-tool-schema-budget.cjs
---

# Quick 261024-uqs Summary: tool-schema budget re-baselined to 75 tools

## One-liner

The AFTER record of `tests/test-270-tool-schema-budget.cjs` moved from 50 tools / 59020 bytes to 75 tools / 83522 bytes, with the 25 Eureka and Reverse Salient tools named in the comment.

## Measured (the test's own output)

- 75 tools, 36010 desc bytes, 47512 schema bytes, 83522 total bytes, ~20881 approx tokens.
- Router 9, atomic 66.
- Against the k22 record (59020 bytes, ~14755 approx tokens): +41.51 percent bytes, +6126 approx tokens.

## The 25 new tools (PROVEN by name diff)

Live tools/list at HEAD (75 names) checked against `lib/mcp` and `bin` at dbb9a3efd. 25 names had no earlier registration. All 25 come from the squash commit 6bc8cfc55.

- Eureka capability run and job tools (5): eureka_capability_run, eureka_capability_start, eureka_capability_job_status, eureka_capability_job_result, eureka_capability_job_cancel.
- Eureka graph tools (17): eureka_graph_analyze, _assess_category_edge_patterns, _backtest, _compare_topics, _find_community_bridge_pairs, _find_network_holes, _find_shared_neighbor_gaps, _find_similar_unlinked_items, _genesis_plan, _map_neighbourhoods, _opportunity_scout, _package_relationships, _prepare_artifacts, _project, _propose_relationships, _rank_paths, _score_surprise.
- Eureka HSI (1): eureka_hsi_interpret_whitespace.
- Reverse Salient reads (2): rs_experts_find, rs_thesis_read.

## Change

One file, one commit: `06b4de866` in the release tree. A new dated comment block (form of the k22 block) and a new AFTER constant (plan `quick-261024-uqs`). `DRIFT_TOLERANCE_PCT` stays 10. No other rule changed. No sibling test pins the 50-tool count (grep of tests/ and scripts/ found none).

## Verification

- `node tests/test-270-tool-schema-budget.cjs`: 5 passed, 0 failed.
- `LC_ALL=C bash tests/run-all-366.sh` (load average 5.92 at start): the 270 step printed PASSED. The run hit the 580 second timeout inside the 380 installed-layout stage. The 380 engine test step (`claude plugin test`) failed with spawnSync ETIMEDOUT under machine load. That step is out of scope for this task.

## Deviations from plan

- The first commit carried the id `tbr` (my own guess). The id from `gsd-sdk query init.quick` is `uqs`. I amended the local, unpushed commit (d6b25231f -> 06b4de866) and the comment block so the id matches this directory.
- `gsd-tools` is not on PATH. I used `gsd-sdk query init.quick`.
- The Write tool hook blocked this directory (worktree path guard). I wrote these two files with a shell redirect, as the task allowed.

## Skipped

- `gsd-tools state.*` handlers (by instruction).
- Push, tag, release script (by instruction).

## Self-Check: PASSED

- Commit 06b4de866 exists in the release tree; the working tree was clean after it.

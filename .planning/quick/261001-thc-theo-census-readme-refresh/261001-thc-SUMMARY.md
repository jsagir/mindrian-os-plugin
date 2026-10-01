---
quick_id: 261001-thc
status: complete
date: 2026-10-01
---

# Quick 261001-thc: Theo census + README refresh

Census regenerated live against https://theo-mcp.onrender.com (read-only tools only),
`--lane-a` then `--lane-b`. Outputs: docs/BRAIN-GRAPH-CENSUS.generated.md,
data/brain-census.generated.json.

| Metric | 2026-09-11 | 2026-10-01 |
| ------ | ---------- | ---------- |
| nodes (brain_stats) | 27,951 | 28,131 |
| relationships (brain_stats) | 39,732 | 53,313 |
| labels | 15 | 21 |
| Framework nodes (C1) | 452 | 457 |
| methodology frameworks probed / gaps (Lane A) | 28 / 28 | 29 / 29 |

README: lines 37, 83, 104, 109 updated (nodes, relationships added, frameworks, census date).

Checks: tests/run-all-246.sh PASS=2 FAIL=1. The failing test-246-census-guard
(C1 Cypher classifies `ambiguous` under part8-egress-guard) does not read any edited file;
pre-existing, not caused by this task. tests/test-262 (4 fails, loopback fixtures, no edited
file read) also pre-existing. tests/test-249 passes.

STATE.md not updated: peer session executing Phase 365 owns it.

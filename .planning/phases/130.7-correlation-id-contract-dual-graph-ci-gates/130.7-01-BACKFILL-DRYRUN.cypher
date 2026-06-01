=== DRY RUN: correlation_id backfill (NO Brain write) ===
Read set source: LOCAL fixture/built-in

--- MERGE/SET Cypher (per-node, $-bound on --execute) ---
// node: Beautiful Question Framework :Framework
MATCH (n {name: $name}) WHERE $label IN labels(n) SET n.correlation_id = $cid, n.correlation_backfill_version = $version, n.correlation_backfilled_at = $ts
// $params = {"name":"Beautiful Question Framework","label":"Framework","cid":"c1:e769412dae3aabe113c62197c2c6b1a987646e84af89e2f3d0eed0888f9f6954","version":1,"ts":"2026-06-01T07:46:00.909Z"}

// node: Jobs-to-be-Done :Framework
MATCH (n {name: $name}) WHERE $label IN labels(n) SET n.correlation_id = $cid, n.correlation_backfill_version = $version, n.correlation_backfilled_at = $ts
// $params = {"name":"Jobs-to-be-Done","label":"Framework","cid":"c1:11f5ca65366f80d5138cc7db9d32fbc59bdd8e37d275b5688d21385b1df243da","version":1,"ts":"2026-06-01T07:46:00.909Z"}

// node: Jobs-to-be-Done :Concept
MATCH (n {name: $name}) WHERE $label IN labels(n) SET n.correlation_id = $cid, n.correlation_backfill_version = $version, n.correlation_backfilled_at = $ts
// $params = {"name":"Jobs-to-be-Done","label":"Concept","cid":"c1:0f79d3782e47d9f620b21715d27cbf6f783048337df9ad1b6ca844e642ff92f8","version":1,"ts":"2026-06-01T07:46:00.909Z"}

// node: HEART Framework :Framework
MATCH (n {name: $name}) WHERE $label IN labels(n) SET n.correlation_id = $cid, n.correlation_backfill_version = $version, n.correlation_backfilled_at = $ts
// $params = {"name":"HEART Framework","label":"Framework","cid":"c1:d2e2344ee6ecb49af068f63526d61b411efca75a51517b6d183e795eb20bbd09","version":1,"ts":"2026-06-01T07:46:00.909Z"}

// node: HEART Framework :Product
MATCH (n {name: $name}) WHERE $label IN labels(n) SET n.correlation_id = $cid, n.correlation_backfill_version = $version, n.correlation_backfilled_at = $ts
// $params = {"name":"HEART Framework","label":"Product","cid":"c1:7814929ca52bf4626f21214b8f6bd3c4effff73e3d598576fd16223d733097b0","version":1,"ts":"2026-06-01T07:46:00.909Z"}

// node: Six Thinking Hats :Framework
MATCH (n {name: $name}) WHERE $label IN labels(n) SET n.correlation_id = $cid, n.correlation_backfill_version = $version, n.correlation_backfilled_at = $ts
// $params = {"name":"Six Thinking Hats","label":"Framework","cid":"c1:74bee1a933439a49d757244975c74bd4c1e22240fbab33bb05837acaaa5aeb8b","version":1,"ts":"2026-06-01T07:46:00.909Z"}

// node: SWOT Analysis :Framework
MATCH (n {name: $name}) WHERE $label IN labels(n) SET n.correlation_id = $cid, n.correlation_backfill_version = $version, n.correlation_backfilled_at = $ts
// $params = {"name":"SWOT Analysis","label":"Framework","cid":"c1:d98acece212701ffa499441360720f396e50422335847ccdb7092512c8fef33d","version":1,"ts":"2026-06-01T07:46:00.909Z"}

// node: Porter Five Forces :Framework
MATCH (n {name: $name}) WHERE $label IN labels(n) SET n.correlation_id = $cid, n.correlation_backfill_version = $version, n.correlation_backfilled_at = $ts
// $params = {"name":"Porter Five Forces","label":"Framework","cid":"c1:20a9be4ad17d8aa4f53f691b0c26ffc498e5bc0a6b23e9c352d103ade0410d1a","version":1,"ts":"2026-06-01T07:46:00.909Z"}

// node: Blue Ocean Strategy :Framework
MATCH (n {name: $name}) WHERE $label IN labels(n) SET n.correlation_id = $cid, n.correlation_backfill_version = $version, n.correlation_backfilled_at = $ts
// $params = {"name":"Blue Ocean Strategy","label":"Framework","cid":"c1:c7089b392450ab3740d8c8f65a6ef18c59a611a36b2e9f2f03de2640242add8b","version":1,"ts":"2026-06-01T07:46:00.909Z"}

// node: Lean Canvas :Framework
MATCH (n {name: $name}) WHERE $label IN labels(n) SET n.correlation_id = $cid, n.correlation_backfill_version = $version, n.correlation_backfilled_at = $ts
// $params = {"name":"Lean Canvas","label":"Framework","cid":"c1:3ed451b9d0c8507ed3634a6f8bef0879847089c7a72c55dc1882eafd6ad238dc","version":1,"ts":"2026-06-01T07:46:00.909Z"}

--- correlation_labels index (LOCAL artifact; never egresses) ---
Beautiful Question Framework | Framework | 11
Blue Ocean Strategy | Framework | 6
HEART Framework | Framework | 8
HEART Framework | Product | 2
Jobs-to-be-Done | Concept | 3
Jobs-to-be-Done | Framework | 14
Lean Canvas | Framework | 10
Porter Five Forces | Framework | 7
SWOT Analysis | Framework | 9
Six Thinking Hats | Framework | 12

--- Summary ---
nodes scanned:    10
ids computed:     10
writes emitted:   10 (dry-run; none executed)
index rows:       10
correlation_version: 1

Run with --execute (ADMIN ONLY, write-capable MINDRIAN_BRAIN_KEY) to apply.

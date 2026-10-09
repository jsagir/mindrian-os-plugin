# Graph Relationship Agent

Finds missing, mistaken and cross-domain relationships in a Neo4j graph. Built for the Mindrian methodology graph; configurable by label and relationship type. Standard library only (numpy, ripser and the neo4j driver are optional).

## Layout
| Path | What |
|---|---|
| agents/graph-relationship-agent.md | The agent: pipeline, gates, write rules |
| commands/find-relations.md | Slash command |
| lib/common.py | Read-only Cypher guard, snapshot graph model |
| lib/gaps.py | Open triads: shared neighbours, no link (Adamic-Adar, z against a random null) |
| lib/holes.py | Induced 4-cycles as holes, rewiring null, optional ripser summary |
| lib/bridging.py | Communities, betweenness, participation, bridge pairs |
| lib/atypicality.py | Uzzi-style category-pair z-scores against a degree-preserving null |
| lib/textsim.py | TF-IDF semantic gaps, bidirectional topic match (BTM-lite) |
| lib/sme_bridge.py | Structure-map two neighbourhoods with ../sme-agent |
| lib/surprise.py | Bayesian surprise from collected probabilities, with an ignorance flag |
| lib/proposals.py | Merge, rank, drop existing edges, flag duplicate and suspect names |
| lib/backtest.py | Temporal backtest against baselines |
| scripts/ | Command-line entry points (below) |
| cypher/ | Read-only queries: snapshot, date coverage, evidence chunks, exists check |
| tests/ | 19 tests on synthetic graphs with planted structure |

## Scripts
    snapshot_from_rows.py NODES.json EDGES.json snap.json
    export_snapshot.py snap.json            (needs neo4j driver and NEO4J_* env vars; read only)
    backtest_run.py snap.json [--cutoff ISO]
    run_pipeline.py snap.json OUTDIR [--text-label Framework] [--top 100]
    sme_pairs.py snap.json "Node A" "Node B"
    surprise_score.py BELIEFS.json OUT.json | --prompt CLAIM [--evidence ...]
    approve_write.py proposals.json approved.txt out.cypher

Run tests: `PYTHONDONTWRITEBYTECODE=1 python3 -B -m unittest discover -s tests`

## First run on the live graph (2026-10-09, read only)
- Snapshot: 2,443 nodes, 978 semantic relationships; 1,623 nodes have none. 112 relationships are dated.
- Pipeline: 2 seconds. 40 ranked proposals plus 51 name issues in `runs/2026-10-09/`.
- Holes: 150 induced 4-cycles against 76 on average in degree-preserving rewirings (z about 6). Earlier trial runs with a different null size gave a lower z, so treat it as "more holes than chance", not an exact figure.
- Name issues: duplicate-looking nodes such as "Trend Detection Framework" and "trend_detection_framework", "PEST Analysis" and "PEST", "Reverse Salient Analysis" and "Reverse Salient", and one-letter node names. These are cleanup items, not relationships.
- Backtest: cutoff 2026-10-06, 944 earlier relationships, 30 later ones. Every method, including the baseline, found none of the 30 in its top 200. The dated sample is too small and mostly bulk-loaded on a few days, so no method is validated on this graph.

## Limits
- Proposals are unevidenced until the agent adds source quotes. Suggested type is a prior from node labels; direction is undetermined.
- Most Concept nodes are isolated in the semantic graph, so only text similarity can reach them.
- The SME bridge was tested on a toy chain, not on real neighbourhoods.
- Theo context was not available as a tool in the session that built this; the Theo step in the agent is specified, not exercised.

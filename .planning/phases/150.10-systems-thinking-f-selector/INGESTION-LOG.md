# Piece A Ingestion Log - IRIS 2026 Session 2

**Executed:** 2026-06-14
**By:** Larry (direct Neo4j write, navigator-owned DB, navigator-authorized)
**Brain:** production Neo4j (27,805 nodes pre-ingest), neo4j+s://5b8df33f.databases.neo4j.io
**Invariant:** ADDITIVE + DEDUPED + CONNECTED, ZERO ORPHANS. **Orphan-scan gate: PASSED (0 orphans / 11 nodes).**
**Part 8:** every node is generic PWS methodology (frameworks, examples, move-definitions). ZERO venture/room/personal content.

## Dedup decisions (read-only pass first)

A 23-keyword existence sweep confirmed almost all Session 2 frameworks ALREADY exist - MERGED (connected via TEACHES edges), never duplicated:

| Concept | Decision | Existing node |
|---|---|---|
| Systems Thinking | MERGE | `Concept/__Entity__:systems thinking` |
| Causal Loop Diagrams | MERGE | `Technique:Causal Loop Diagramming` |
| Leverage Points | MERGE | `__Entity__:Leverage Points` (+ Meadows ProcessStep) |
| Wicked Problems | exists | `Concept:Wicked Problems` (+ N04 doc) |
| Cynefin | MERGE | `Framework:Cynefin Framework` (Snowden) |
| Dominant Design | MERGE | `Concept/__Entity__:Dominant Design` |
| Futures Wheel | MERGE | `Concept/__Entity__:Futures Wheel` |
| Mullins | MERGE | `Person:John Mullins`, `Technique:Mullins Model Validation` |
| Authors | exist | `Person:` Meadows, Snowden, Rittel, Webber, Anderson, Tushman |
| Fishery CLD | exists | `Concept:Fishery Causal Loop Diagram` |

## New nodes created (11, each wired on creation - 0 orphans)

| Node | Label | source_doc | wired via |
|---|---|---|---|
| IRIS 2026 Session 2 | Lecture | iris-2026-session-2 | TEACHES -> 5 moves + 7 existing frameworks; MENTIONED_IN backstop for examples + tta |
| ST Move M1 - Boundary Framing | Method | iris-2026-session-2 | PREREQUISITE -> M2; TEACHES from Lecture |
| ST Move M2 - Causal Loop | Method | iris-2026-session-2 | PREREQUISITE -> M3 |
| ST Move M3 - Archetype | Method | iris-2026-session-2 | PREREQUISITE -> M4 |
| ST Move M4 - Leverage Point | Method | iris-2026-session-2 | PREREQUISITE -> M5; FEEDS_INTO -> M5 |
| ST Move M5 - Stage-Aware Validation | Method | iris-2026-session-2 | terminal (name-and-stop) |
| USS Nautilus - nested-system innovation | Example | iris-2026-session-2 | ILLUSTRATES systems thinking; MENTIONED_IN Lecture |
| Eugene Ely 1910 carrier takeoff | Example | iris-2026-session-2 | ILLUSTRATES Dominant Design; MENTIONED_IN Lecture |
| Benz 1885 first automobile | Example | iris-2026-session-2 | ILLUSTRATES Dominant Design; MENTIONED_IN Lecture |
| Breakfast frustration causal loop | Example | iris-2026-session-2 | ILLUSTRATES Causal Loop Diagramming; MENTIONED_IN Lecture |
| Trending to Absurd - S-curve re-entry | Technique | iris-2026-session-2 | MENTIONED_IN Lecture; RELATED_TO Dominant Design (cross-chain, NOT a 6th move) |

## Move-edge ledger (the graph-native flow Piece B traverses)

- PREREQUISITE chain: M1 -> M2 -> M3 -> M4 -> M5 (verified traversable end-to-end)
- FEEDS_INTO: M4 -> M5 (the leverage-point -> validation handoff)

## Write summary

- Write 1: 6 nodes (Lecture + M1-M5), 10 edges (4 PREREQUISITE + 1 FEEDS_INTO + 5 TEACHES)
- Write 2: 4 Example nodes, 8 edges (4 MENTIONED_IN + 4 ILLUSTRATES)
- Write 3: 1 Technique node, 9 edges (1 MENTIONED_IN + 7 Lecture TEACHES existing frameworks + 1 RELATED_TO)
- Total: 11 nodes, 27 edges. All MERGE-based (idempotent / re-runnable).

## Orphan-scan gate (acceptance)

```
MATCH (n {source_doc:'iris-2026-session-2'}) WHERE NOT (n)--() RETURN count(n)
-> 0   PASSED
```

## Deferred to leverage-scan follow-up (navigator directive 2026-06-14)

The "Leverage Point Local-Graph Excavation" Method node (Meadows level -> local-graph signature scan_pattern) + the local scanner over room.db is the NEXT focused step, per navigator decision "write the base manifest now, leverage-scan next."

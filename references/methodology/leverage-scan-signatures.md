# Leverage-Scan Signatures -- Meadows Level to room.db Structural Signature

*Loaded on demand by `lib/core/leverage-scan.cjs` (the M4 leverage-point scanner).*

This is the LOCAL, Tier-0 source of truth for the leverage-point excavation
scan. It mirrors the canonical teaching copy held in the Brain Method node
"Leverage Point Local-Graph Excavation" (generic methodology). The scanner reads
THIS file's mapping locally so it runs with Brain offline (Canon Part 1: Larry
teaches with or without Brain). Brain holds the canonical teaching copy; this
file is the resilient local mirror (Canon Part 8: only the generic mapping
crosses Brain to local, never local room content to Brain).

## What this maps

Each of Donella Meadows' 12 leverage levels (Meadows 1999, "Leverage Points:
Places to Intervene in a System") maps to a STRUCTURAL signature that any room
graph (`room/.mindrian/room.db`) can be scanned for. Leverage descends with the
level number: level 12 is the weakest place to intervene (parameters), level 1
is the strongest (the power to transcend paradigms). The scanner scores
higher-leverage (lower-number) hits higher, so candidates are returned ranked
highest-leverage-first.

The scanner reads room.db ONLY through the `lib/core/navigation.cjs` chokepoint
(Canon Part 9: navigation IS the local mind; no direct sqlite open, no folder
scan). room.db node types referenced below: `claim`, `assumption`, `decision`,
`opportunity`, `CausalClaim`, `governing_thought`. room.db edge types
referenced below: `INFORMS`, `CONTRADICTS`, `CONVERGES`, `INVALIDATES`,
`ENABLES`, `REFINES`, `ROOT_CAUSES`, `FEEDS_INTO`, `DEFERRED`, plus the
`REVERSE_SALIENT` edge written by the shipped rs-engine (`scripts/rs-engine.py`).

## The 12-level mapping (the scan_pattern)

| Meadows level | Local-graph signature (what the scanner queries room.db for) | room.db node / edge types used |
|---|---|---|
| 12 Parameters / constants | leaf claim nodes with scalar / numeric evidence and no outgoing edges (the weakest intervention: a number you can tune) | nodes type IN (`claim`, `CausalClaim`); zero outgoing edges |
| 11 Buffers | high evidence-count accumulation nodes (claims that have soaked up many supporting edges -- the stabilizing stocks) | nodes with high count of incoming `INFORMS` / `ENABLES` / `CONVERGES` edges |
| 10 Stock-and-flow structure | nodes with high (in + out) degree -- the structural hubs the flows route through | nodes ranked by total degree across all edge types |
| 9 Delays | `DEFERRED` edges plus claims carrying a `valid_from` / `valid_until` lag (the system's reaction lag) | `DEFERRED` edges; nodes whose properties carry `valid_from` / `valid_until` |
| 8 Balancing loops | cycles dominated by `CONTRADICTS` / `INVALIDATES` polarity (the loops that resist change); read from the rs-engine `REVERSE_SALIENT` edges where present | `CONTRADICTS` / `INVALIDATES` edges; `REVERSE_SALIENT` edges (signed_diff) |
| 7 Reinforcing loops | cycles dominated by `CONVERGES` / `ENABLES` polarity (the loops that amplify -- success breeds success) | `CONVERGES` / `ENABLES` edges forming a cycle |
| 6 Information flows | high-betweenness / bridge nodes -- the cross-section connectors carrying signal between subsystems; read from the rs-engine `REVERSE_SALIENT` edges (the lagging connector IS the information-flow leverage point) | bridge nodes; `REVERSE_SALIENT` edges (signed_diff = lag = leverage signal) |
| 5 Rules | `assumption`-typed nodes -- the assumption registry IS the room's rule set | nodes type = `assumption` |
| 4 Self-organization | `ROOT_CAUSES` fan-out sub-graphs -- the generative nodes that spawn structure | nodes with high outgoing `ROOT_CAUSES` degree |
| 3 Goals | the governing-thought / STATE objective node -- what the whole system is steering toward | node type = `governing_thought` |
| 2 Paradigm | the root problem-formulation node (ICM Layer 0) -- the mindset the system arises from | the room's root problem-formulation node |
| 1 Transcending | the systems-thinking meta-lens itself (M4) -- the power to step outside any single framing | the M4 lens; not a single room node -- surfaced as the meta-handle |

## Levels 6 to 8: reverse-salient reuse (ST-17)

A reverse salient (Hughes 1983 -- the lagging component in an expanding system)
IS a leverage point (Meadows -- a small push for a large change). They share the
same room.db graph. The shipped rs-engine (`scripts/rs-engine.py` plus the
`lib/core/rs_*.py` helpers) already writes typed `REVERSE_SALIENT` edges into
room.db carrying `properties.source = 'rs-engine'` and a `signed_diff` value (the
lag magnitude = the leverage signal).

So the mid-leverage band (Meadows levels 6 to 8: information flows, reinforcing
loops, balancing loops) REUSES the rs-engine output instead of reimplementing
bottleneck detection:

- The level-6-to-8 signature = "nodes carrying a `REVERSE_SALIENT` edge
  (source = rs-engine), ranked by `abs(signed_diff)`".
- The scanner does NOT recompute reverse salients or bottlenecks. It READS the
  existing edges (Canon Part 7: consume the shipped engine, do not rebuild it).
- M4 offers a Decision-Gate chain handoff to `/mos:find-bottlenecks` (the
  rs-engine command) for deep reverse-salient analysis.

## How the scanner uses this (contract)

- Read room.db ONLY via `lib/core/navigation.cjs` (the chokepoint; no direct
  sqlite open, no fs scan).
- Run the 12 signature queries above, tag each hit with its Meadows level.
- Rank candidates lower-Meadows-number-first (highest leverage first).
- Return `{ nodeId, label, meadows_level, signature, score }` per candidate.
- Room candidates stay LOCAL. They are NEVER sent to Brain (Canon Part 8). The
  scanner carries zero network surface.

## Citations

- Meadows, D. (1999). Leverage Points: Places to Intervene in a System.
- Hughes, T. P. (1983). Networks of Power (reverse salients).
- Canon Part 8 (the graph boundary), Part 9 (memory locality), Part 7 (reuse
  before build). See `docs/MINDRIAN-CANON.md`.

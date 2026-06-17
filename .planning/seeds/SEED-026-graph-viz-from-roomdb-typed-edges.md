---
kind: seed
status: open
created: 2026-06-16
canon_parts: [6, 9]
severity: high
proving_case: ~/MindrianRooms/aion-eureka-synergy (present/hub/graph.html vs exports/presentation/graph.html)
source: dogfood (AION C08 demo build)
---

# SEED: Graph viz must build from room.db typed edges, not wikilink cross-refs

## Defect (observed)
`scripts/generate-presentation.cjs` builds the Graph view from artifact `[[wikilink]]`
cross-references. Real rooms have sparse inter-artifact wikilinks, so the rendered
graph is a field of ORPHAN nodes with no connections. It looks broken and explains nothing.

## What already exists and is being ignored
The room's actual knowledge graph lives in `room.db` (Canon Part 9, `lib/core/navigation.cjs`):
typed nodes (claim/knowledge_type, decision, opportunity, memory_event...) and typed edges
from the frozen `ALLOWED_EDGE_TYPES` set (INFORMS, SUPPORTS, INSTANTIATES, CONTRADICTS,
DERIVED_FROM, REFINES, ROOT_CAUSES, ...). This graph is rich and connected.

Proving numbers (AION room, 2026-06-16): canonical `/room/graph.html` = orphan soup;
the room.db graph = 84 nodes / 82 edges, two clear hubs (thesis deg 69, architecture deg 13),
exactly 1 true orphan (the venture root). A hand-built viz from room.db
(`present/hub/graph.html`) is fully connected and explanatory.

## Required capability (acceptance)
1. Graph viz SOURCES nodes + edges from room.db via the navigation chokepoint
   (a `getGraphExport()` / neighborhood walk), NOT a wikilink scan.
2. Renders CONNECTED relationships; hub-and-spoke structure is visible; degree-0 nodes
   are either connected via real edges or explicitly flagged (no silent floating dots).
3. EXPLAINS on interaction: tap a node -> its knowledge_type, review_status, and
   neighborhood; tap an edge -> the typed relationship + a plain-English gloss of the
   edge type (INFORMS = "evidence that shapes the claim", SUPPORTS, INSTANTIATES, ...).
4. Colors by knowledge_type; sizes by degree so hubs read at a glance.

## Why it matters (canon)
- Part 9: SQL/room.db is the local mind; the graph viz is the primary way a navigator
  SEES that mind. Reading wikilinks instead of the graph violates the spirit of Part 9.
- Part 6 (dogfooding): the plugin must honor its own graph. Shipping an orphan-producing
  viz over a connected typed graph is the plugin contradicting its own Part-4/9 substrate.

## Suggested approach (reuse-first, Part 7)
Add a `getGraphExport(roomDir)` to `lib/core/navigation.cjs` (nodes+edges+degree), then
repoint the `generate-presentation.cjs` graph builder + `dashboard/index.html` Cytoscape
feed at it. Edge-type gloss table is small and static. Reference implementation +
gloss table: `~/MindrianRooms/aion-eureka-synergy/present/hub/graph.html`.

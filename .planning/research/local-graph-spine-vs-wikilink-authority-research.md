# Phase Research: The local graph as single authority - graph spine vs wikilink dual-graph, and the viz fix

> GSD research artifact. Created in-session 2026-06-17 while scoping SEED-026 (graph-viz-from-roomdb-typed-edges).
> Source-of-truth note: the dogfood session that surfaced the defect ran on install-cache beta.30; this repo
> is origin/main beta.31. Reconciliation done where load-bearing (see Section 9). No em-dashes (project rule).

---

## Frontmatter

- kind: research
- status: open
- created: 2026-06-17
- canon_parts: [4, 7, 8, 9]
- informs_seeds: [SEED-026 (viz fix, critical path), SEED-029 (embedding layer), SEED-030 (RS spine)]
- informs_phases: [161 (embedding-layer-and-rs-reconciliation)]
- qa_ref: .planning/debug/aion-eureka-demo-build-qa-session.md (F1)
- proving_case: ~/MindrianRooms/aion-eureka-synergy/present/hub/graph.html (connected room.db-sourced viz)
- workflow_provenance:
  - external Tavily research (5 angles + schema-bound synthesis): run wf_1e85cc7a-7e0
  - hats inner-code inquiry (6 hats reading live code): run wf_96c61ec8-f30

---

## 1. Purpose and scope

The canonical graph visualization builds ORPHAN nodes. The naive read is "repoint the viz at room.db" (SEED-026).
This research goes one level deeper, at the navigator's prompting: do the wikilinks CONFLICT with the local
typed graph, do we need wikilinks at all, and what IS the local graph actually for. The answer reframes the
fix from a rendering patch into an architecture decision about a single authoritative navigable substrate.

In scope: the viz defect and its root cause; the graph spine; the two meanings of "dual graph"; what the
local graph is for; the wikilink retirement decision; the cross-file concept-node decision; the embedding
(lazygraph) substrate direction. Out of scope: implementing the fix (that follows this research).

---

## 2. The defect and its root-cause mechanism (code evidence)

The viz produces "a whole lot of orphan nodes no connections" (navigator verbatim, AION demo build). Mechanism:
TWO node-identity spaces stitched at the edge layer.

- `scripts/generate-presentation.cjs` `collectGraph()` (~466-483) runs `scripts/build-graph` for the NODE set.
- `scripts/build-graph` (bash) discovers nodes from the filesystem + wikilink scan. Node IDs are derived from
  file paths / section names / wikilink-concept keys (section-group ~165, artifact ~197, meeting ~254,
  speaker ~288, "Phase 2b wikilink concept nodes" ~456-516 that mint concept nodes for terms in 2+ files +
  REFERENCES edges). Identity space A = file/heading/concept slugs. No knowledge_type, no degree.
- `collectGraphData()` (~485-555) reads room.db via `lib/core/lazygraph-ops.cjs`
  (`SELECT source, target, type FROM edges`) and merges ONLY EDGES, never nodes (~522-531). Those edge
  endpoints are room.db node IDs. Identity space B = room.db IDs.
- Injection ~682-689. Both `generate-presentation.cjs` graph.html and `dashboard/index.html` render via
  Cytoscape.js (dashboard line 22 CDN). Single renderer; the feed is the thing to repoint.

Result: room.db edges (space B) reference node IDs that the node-builder (space A) never created, so they
silently drop or spawn phantoms, while space-A artifact nodes with no wikilinks float as orphans. This is an
architecture defect (two authorities over the same data), not a rendering bug. The viz BYPASSES the spine.

room.db schema (lib/core/lazygraph-ops.cjs): `nodes(id TEXT PK, type TEXT, properties TEXT JSON with
knowledge_type/review_status/label/evidence_tier)`; `edges(source, target, type, properties,
PK(source,target,type), FK to nodes)`. `lib/core/navigation/edges.cjs` holds the frozen ALLOWED_EDGE_TYPES
(Canon Part 4 closed vocabulary: INFORMS, SUPPORTS, CONTRADICTS, CONVERGES, ENABLES, INVALIDATES, REFINES,
ROOT_CAUSES, INSTANTIATES, REVERSE_SALIENT, DERIVED_FROM, ...). `getGraphExport` does NOT yet exist (net-new).

---

## 3. The architecture framing (navigator-directed)

### 3a. The graph spine
`lib/core/navigation.cjs` is the Phase 109 single chokepoint over room.db (Canon Part 9: "files preserve
meaning; SQL remembers and navigates"). Principle: anything that draws or navigates the graph must source
THROUGH the spine, never run its own scanner. The wikilink viz path violates this.

### 3b. Two meanings of "dual graph" (do not conflate)
1. INTENDED dual graph (PRESERVE): LOCAL room.db correlated with REMOTE Brain by correlation-id
   (`lib/core/correlation.cjs`, Phase 130.7/132), never merged, held apart by Canon Part 8. Two graphs over
   DIFFERENT data, correlated by design.
2. BAD "dual graph" (KILL): wikilink-DERIVED graph competing with room.db as a second authority over the
   SAME data, stitched by mismatched IDs. This is the orphan generator.

### 3c. The embedding (lazygraph) substrate
Phase 161 adds a vector/embedding layer OVER room.db node IDs. The navigable substrate becomes typed nodes +
typed edges + embeddings over the SAME identity space (the GraphRAG shape). Wikilinks are not part of it.

### 3d. Blast radius of total wikilink removal
~40 scripts consume wikilinks (vault-wikilink-injector, vault-content-reformatter, recompile-room-references,
analyze-room, meeting intelligence). Wikilinks power the Obsidian meaning layer (CLAUDE.md decision 16).
Therefore: demote wikilinks from authority, do NOT delete them repo-wide.

---

## 4. External research synthesis (Tavily, 5 angles, run wf_1e85cc7a-7e0)

Verdict: as an AUTHORITY over the same data, the wikilink graph is redundant and actively harmful.
- Untyped: `[[Alice]] likes [[Apple]]` and `[[Bob]] hates [[Apple]]` render identical (Logseq forum). SUPPORTS
  and CONTRADICTS would collapse into one meaningless link - fatal loss of the meaning room.db exists to hold.
- Co-occurrence only: it cannot surface implicitly related, non-co-occurring nodes; typed graph + embeddings
  can (GraphRAG, Weaviate/Memgraph). That is the main job of a navigable substrate.
- Degrades to a hairball past ~200 nodes; the LOCAL/egocentric view stays useful at any scale (Code Culture).
- The orphans are the textbook signature of two identity-spaces force-merged: an edge whose endpoint ID is
  absent from the node set silently drops (Tilores, ODSC/Senzing). Resolve identity BEFORE load.

The "files preserve meaning / SQL navigates" split is a RECOGNIZED, sound pattern: CQRS + materialized view.
room.db = write-model single source of truth; viz + embeddings + wiki = disposable read-model PROJECTIONS,
rebuildable from the source, never a second authority (Azure Materialized View + CQRS patterns; event-driven.io).
The INTENDED local-vs-remote correlation must NOT be collapsed - SSOT/CQRS endorses correlating distinct
sources, not fusing them.

### Key sources
- Logseq forum, "Relationship types (predicates)": wikilinks are untyped (SUPPORTS/CONTRADICTS collapse).
  https://discuss.logseq.com/t/relationship-types-predicates-colored-graph/13044
- Azure Materialized View pattern: a derived view is disposable, rebuilt from source, never updated directly.
  https://learn.microsoft.com/en-us/azure/architecture/patterns/materialized-view
- Azure CQRS pattern: write-model SSOT + regenerable read-model projections.
  https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs
- Tilores, "Why Graph Databases Fail at Entity Resolution": resolve identity before loading (the orphan bug).
  https://medium.com/tilo-tech/why-graph-databases-fail-at-entity-resolution-and-what-to-use-instead-9845280f7645
- Weaviate, "RAG and GraphRAG": typed entities + embeddings surface implicit, non-co-occurring links.
  https://weaviate.io/blog/graph-rag
- yWorks yFiles guide: render from the authoritative store, single stable ID space, color by type, label
  edges, size by centrality, orphans as signal.
  https://www.yfiles.com/resources/how-to/guide-to-visualizing-knowledge-graphs
- Cambridge Intelligence, "Fixing data hairballs": design backward from the user's job; local views, not the
  whole graph. https://cambridge-intelligence.com/how-to-fix-hairballs/
- zettelkasten.de, "Backlinking Is Not Very Useful": value lives in intentional typed structure; demote raw
  backlinks to a candidate-edge feed. https://zettelkasten.de/posts/backlinks-are-bad-links/

### Strongest counterargument (and why it does not move the call)
Files-first camp (IWE; "Your File System Is Already a Graph Database"; Ambler "One Truth" anti-pattern):
wikilinks are human-authored, zero-extraction-error, git-auditable, deterministic; a vector layer reintroduces
opaque non-deterministic retrieval; over-pursuing one truth gives negative value. Rebuttal: (1) we DEMOTE the
meaning layer, not delete it - every files-first win is kept (prose + wikilinks remain canonical meaning +
serendipity; they just stop minting graph nodes). (2) Determinism is satisfied by provenance: projected/embedded
results stay traceable to file+node IDs; unresolved wikilinks are surfaced, not silently dropped. (3)
"One truth for IDENTITY" is exactly the bounded SSOT Ambler endorses. The counterargument targets only the BAD
same-data dual graph, never the intended local-vs-remote correlation.

---

## 5. What the local graph is FOR (the definition this research lands on)

The local graph is the room's NAVIGATION and REASONING substrate: the single authoritative typed property
graph in room.db (typed nodes + typed edges) with embeddings over the SAME node IDs. Its job is the
relationship questions prose cannot answer: what CONTRADICTS this hypothesis, trace the ROOT_CAUSES chain,
which decisions INFORM this opportunity, has the governing_thought drifted. One node-identity space, three uses
(visualize, navigate, retrieve), all sourced through the spine. The markdown/wikilink layer is the human
meaning-and-authoring surface that FEEDS this graph, not a parallel one.

---

## 6. Recommendations for the fix

- VIZ SOURCE: source BOTH nodes and edges from the spine over room.db (one ID space). Build the node set from
  room.db node IDs first, then attach room.db edges - dangling edges and orphans become structurally
  impossible. Kill the standalone wikilink text-scanner in the viz path. Visual grammar (from the proving
  impl + yFiles): color by the 9 node types, gloss typed edges with a legend, size by degree (governing_thought
  weighted), show human titles not IDs, prefer LOCAL/egocentric views over the global hairball.
- WIKILINK RETIREMENT: from VIZ and NAVIGATION/IDENTITY only, not entirely. Wikilinks remain the human
  authoring + meaning layer. At ingest, resolve each `[[wikilink]]` to a room.db node ID through the spine:
  resolved + relational -> promote to a typed edge (or weak MENTIONS/REFERENCES pending promotion); resolved
  only -> provenance metadata; unresolved -> a visible "pending/candidate edge" overlay, never a phantom node.
  Wikilinks become a one-way candidate-edge feed into the spine.
- CONCEPT NODES (the cross-file 2+-file signal): HARD-WRITE into the spine as first-class typed nodes at
  ingest (entity-resolution-before-load) with typed edges (INSTANTIATES/REFINES/MENTIONS) to the referencing
  claims, embedded on the same node ID. Re-derive only the cheap projection on file-change; the concept node
  itself is durable spine state, not a render-time artifact.
- DEFER: global graph traversal / community-detection summaries; multi-granularity embeddings (ship node-level
  first); LLM-discriminator auto-merge for ambiguous wikilink resolution (start exact-match + similarity +
  fail-loud). Do NOT touch the intended local-vs-remote correlation-id boundary.

### Critical-path carve-out (SEED-026, ships on the v1.13.x beta train now)
The minimal shippable slice: add `getGraphExport(roomDir)` to the navigation spine (nodes + edges + degree
from room.db), repoint `generate-presentation.cjs` + `dashboard/index.html` Cytoscape feed at it, color by
knowledge_type, gloss edge types, no orphan-producing wikilink fallthrough. Tri-Polar: CLI + Desktop + Cowork
read the same export. The wikilink-as-candidate-edge-feed and concept-node hard-write are the larger Phase-161
adjacent work, not required for the beta viz fix.

---

## 7. Hats inner-code inquiry (run wf_96c61ec8-f30, completed 2026-06-17)

Six hats read the live code. They CONFIRM the external verdict (Section 4) against the actual source and add
several load-bearing facts the external research could not see.

### 7a. White hat - the exact mechanism (decisive, new precision)
- build-graph artifact ID = `<section>/<rel_clean>` where `rel_clean` FLATTENS nested subfolders to hyphens
  (`scripts/build-graph:189-190`). room.db artifact ID = full nested relative path with slashes PRESERVED
  (`lib/core/lazygraph-ops.cjs:238-241 getArtifactId`). Per CLAUDE.md decision 16 every artifact lives in a
  nested subfolder, so the two ID strings ALWAYS differ on real rooms; they coincide only for a bare
  top-level `section/foo.md`. This is the precise orphan mechanism.
- The orphan site is `generate-presentation.cjs:518-538`: `collectGraphData` reads ONLY edges
  (`SELECT source,target,type FROM edges`, line 497) in room.db's ID space and appends them to a node set
  built in build-graph's ID space, deduping by src-tgt-type, never by node identity. room.db edges carry an
  FK to nodes(id) (`lazygraph-ops.cjs:45-46`) so they are internally sound and only break on lift-out.
- knowledge_type and degree are NOT columns; knowledge_type lives in the node `properties` JSON bag, degree
  must be DERIVED at export time from edge incidence.

### 7b. Black hat - the risks the seeds/phase MUST know (the load-bearing half)
- COLD-START REGRESSION (HIGH): the always-on 8-section scaffold is a build-graph feature
  (`build-graph:162-169`, styled `dashboard/index.html:598`). A room.db-only export renders a BLANK canvas on
  a Tier-0 first room. getGraphExport must emit section anchors even at zero artifact rows.
- NO WHOLE-GRAPH READ PRIMITIVE / NO BUDGET (HIGH): getNeighborhood is neighborhood-scoped. A net-new
  unbounded `SELECT *` + JSON.parse-per-row on the hot /mos:present + dashboard-refresh path needs an explicit
  row cap + timeout (mirror the existing 10s child-process timeouts).
- PART 8 LEAK VECTOR (HIGH): a whole-graph export is a BROAD READ that can pull correlation-id / Brain-
  correlated bytes into a deployable present/ HTML artifact (export publish/snapshot). getGraphExport must be
  brain-boundary-scanned, assert zero correlation-id/Brain bytes by construction, carry an adversarial leak
  test (Phase 90 / 110 tripwire pattern), and go through Canon Custodian review.
- MIS-POINTED WIKILINK-DERIVED EDGES IN room.db ITSELF (MEDIUM, NEW DEFECT): room.db mints INFORMS/CONTRADICTS
  edges from [[wikilinks]] via a LOSSY section-name join (`lazygraph-ops.cjs:367-390`, line 379) that targets
  whole SECTIONS not artifacts. So "authoritative room.db" replaces orphans with mis-targeted edges. Leave
  ingestion untouched in the viz fix but FILE THE DEBT (candidate SEED-031).
- INCOMPLETE NODE-TYPE -> CLASS MAP (MEDIUM): build-graph hand-codes 5 classes; room.db holds Artifact,
  Section, CausalClaim, decision, opportunity, Breakthrough, HatState, EvidenceClaim, memory_event and more
  across schema phases 108-160. The map must cover ALL live types and FAIL LOUD on an unmapped type, with a
  golden-room CI snapshot.
- DASHBOARD CLUSTER-HACK COLLISION (MEDIUM): the dashboard already synthesizes `cluster-` edges and deletes
  the parent field when totalNodes>30 (`dashboard/index.html:869-897`). Repoint in LOCKSTEP or large rooms
  lose grouping.
- CLOSED-13-FUNCTION DRIFT (LOW): navigation.cjs is already 40+ exports past its stated "closed 13-function"
  count; adding getGraphExport needs a canon note or the Part 6 dog-fooding scan flags a CONTRADICTS.

### 7c. Green hat - the option menu (compose, do not pick one)
1 single-source getGraphExport (the clean kill); 2 migrate co-occurrence into room.db as a typed
CO_OCCURS/REFERENCES edge via writeEdge; 3 two-clock migration (one-time backfill through the migrate-*
chokepoint + on-write hook); 4 Phase 161 embeddings supersede literal co-occurrence with semantic clustering
on the SAME node IDs; 5 optional non-authoritative source_type-tagged "meaning overlay" toggle, never
persisted; 6 DESCRIBES/DERIVED_FROM provenance edges file->node; 7 cheap de-risk: make the current merge
SELF-HEAL by minting any missing endpoint FROM room.db instead of dangling it.

### 7d. Blue hat - integrated decision + sequenced plan
- viz sources BOTH nodes and edges from room.db through ONE new spine function `navigation.getGraphExport`
  (sibling of getNeighborhood/getRoomContext); build-graph node-discovery retired from the viz; dashboard +
  generate-presentation repoint onto the same export. knowledge_type/degree derived at export time.
- wikilink retirement is SURGICAL: kill only wikilink-derived nodes as a second node-AUTHORITY in the VIZ.
  Wikilinks stay in .md (decision 16), keep feeding the ~40 consumers, and keep feeding room.db edge ingestion.
- cross-file co-occurrence signal RE-HOMED into room.db as a typed edge BEFORE build-graph emission is retired
  (reuse REFERENCES/DESCRIBES if semantics fit to avoid a Part 4 amendment; mint CO_OCCURS only if reuse fails).
- INTENDED local-vs-Brain dual graph untouched; getGraphExport boundary-scanned.
- Sequenced plan: STEP 0 self-heal merge (cheap de-risk) -> STEP 1 getGraphExport (cap + timeout + fail-loud
  type map + cold-start anchors) -> STEP 2 Part 8 gate + canon note -> STEP 3 re-home co-occurrence (two-clock
  migration) BEFORE retiring -> STEP 4 repoint generate-presentation + dashboard in lockstep + golden snapshot,
  then delete build-graph node path -> STEP 5 file the lossy-join debt -> STEP 6 Phase 161 embedding on-ramp.

### 7e. Reconciliation external (Sec 4) vs hats (Sec 7)
Full agreement on the destination (single room.db authority, sourced through the spine; wikilinks demoted to a
meaning/candidate-edge feed; CQRS/materialized-view shape). The hats add what the literature could not: the
exact ID-divergence mechanism (7a) and the four NEW must-mitigate risks the fix introduces (7b) - cold-start,
read-budget, Part 8 broad-read, and the pre-existing lossy room.db wikilink-to-section join.

---

## 8. Open decisions for the navigator

- D1: confirm wikilink retirement scope = viz + navigation/identity only (recommended), not repo-wide.
- D2: confirm concept-node hard-write into the spine at ingest (recommended) vs keep re-deriving for now.
- D3: confirm SEED-026 ships as the carved-out beta-train fix independent of the larger ingest changes.
- D4: confirm the wikilink-to-typed-edge resolution + pending-edge overlay belongs to Phase 161, not the hotfix.

---

## 9. Canon gates and beta reconciliation

- Canon Part 8: external research carried only generic technical queries (SIGNAL -> LOCAL, allowed); zero room
  or user bytes egressed to Tavily or Brain. The intended local-vs-Brain boundary is explicitly preserved.
- Canon Part 9: the fix routes graph drawing through the single navigation spine over room.db.
- Canon Part 7: getGraphExport extends the spine; the viz repoints an existing renderer; near-zero net-new.
- Beta reconciliation: plugin.json origin/main HEAD = 1.13.1-beta.31 (session ran on beta.30). getGraphExport
  confirmed ABSENT on beta.31. The collectGraph/collectGraphData two-identity-space mechanism confirmed present
  on the current tree. No stale-claim risk on the load-bearing root cause.

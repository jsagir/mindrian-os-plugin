---
phase: 162
slug: graph-spine-single-authority-viz
milestone: v1.14.0          # W1-W3 (SEED-026) ship on the v1.13.x beta train; W4-W7 land v1.14.0
status: context-gathering
canon_parts: [4, 7, 8, 9]
depends_on: [109, 141]      # 109 SQL navigation spine (chokepoint); 141 getRoomContext substrate
relates: [161, 144.1]       # 161 embedding on-ramp (W7); 144.1 connector sweep (RS reach)
seeds: [SEED-026, SEED-031, SEED-029]
research: .planning/research/local-graph-spine-vs-wikilink-authority-research.md
provenance:
  external_research: workflow wf_1e85cc7a-7e0 (5 Tavily angles + schema-bound synthesis)
  inner_code_hats: workflow wf_96c61ec8-f30 (6 hats reading live code; Blue sequenced plan)
source_of_truth: install-cache beta.30 ran the dogfood session; this repo is origin/main beta.31. getGraphExport confirmed ABSENT on beta.31; the two-id-space mechanism confirmed present. Reconcile before any new source claim becomes load-bearing.
---

# Phase 162 - The local graph as single authority (spine-sourced viz + wikilink demotion)

## Goal (goal-backward, one sentence)
Every graph the navigator draws or navigates is sourced through the single navigation spine over
room.db in ONE node-identity space, so orphans are structurally impossible; the wikilink graph is
demoted from a competing node-authority to a human meaning + candidate-edge feed, and the cross-file
concept signal is hard-written into the typed store rather than re-derived each render.

## The three principles (the spine of this phase)
1. KILL the bad same-data dual graph: the wikilink-DERIVED graph competing with room.db as a second
   authority over the same data (the orphan generator).
2. PRESERVE the intended dual graph: LOCAL room.db correlated with REMOTE Brain by correlation-id,
   never merged, held apart by Canon Part 8. This phase touches neither correlation.cjs nor any Brain wire.
3. ROUTE every graph draw/navigate through the single spine (navigation.cjs / room.db), with
   getGraphExport as the one viz feed.

## Why now (motivating defects)
- F1 / SEED-026: the canonical graph viz built nodes from a wikilink/filesystem scan (build-graph,
  flattened ids) and bolted room.db edges on top (slash-preserving ids); per CLAUDE.md decision 16
  every artifact is nested, so the two id spaces ALWAYS diverge -> orphan soup.
- SEED-031 (new this session): room.db ITSELF mints INFORMS/CONTRADICTS from [[wikilinks]] via a lossy
  section-name join (lazygraph-ops.cjs:379) that targets whole sections, not artifacts.
- The cross-file "concept" signal (build-graph Phase-2b, terms in 2+ files) is trapped in the meaning
  layer and re-derived each render instead of living as typed graph memory.

## Architecture grounding (research-backed)
The "files preserve meaning / SQL navigates" split is the CQRS + materialized-view pattern: room.db is
the write-model single source of truth; the viz, embeddings, and wiki are disposable read-model
projections rebuilt from it (Azure Materialized View + CQRS; Tilores entity-resolution-before-load;
Weaviate GraphRAG; zettelkasten.de "backlinks demoted to candidate edges"). Full citations + the hats
inner-code findings are in the research file.

## Requirements
| # | Requirement | Wave | Seed |
|---|-------------|------|------|
| R1 | `navigation.getGraphExport(roomDir)` - whole-graph spine read, one id space, no-orphan invariant, cold-start anchors, bookkeeping exclusion, fail-loud-but-graceful unknown types, derived degree, knowledge_type color, Canon Part 8 whitelist payload, node cap | W1 | SEED-026 |
| R2 | Repoint `generate-presentation.cjs` (canvas-graph) off the two-authority path onto getGraphExport | W1 | SEED-026 |
| R3 | Tests: no-orphan invariant, cold-start, unknown-type, Part 8 whitelist, real-room integration | W1 | SEED-026 |
| R4 | Repoint `dashboard/index.html` Cytoscape feed + its graph.json writer onto getGraphExport; style by knowledge_type color + degree size; edge-type gloss on tap; preserve the >30-node cluster path | W2 | SEED-026 |
| R5 | Part 8 hardening: brain-boundary-scan over the export payload + adversarial leak test; golden-room snapshot test (asserts unmapped_types empty); node-type map completeness gate in CI | W3 | SEED-026 |
| R6 | Ship SEED-026 on the v1.13.x beta train (release lockstep: CHANGELOG + plugin.json + tag + marketplace ref) | W3 | SEED-026 |
| R7 | SEED-031: fix the lossy wikilink-to-section edge join (resolve [[link]] to the artifact node, not the whole section); fail-loud on unresolved | W4 | SEED-031 |
| R8 | Re-home cross-file co-occurrence into room.db as typed edges (reuse REFERENCES/DESCRIBES, or mint CO_OCCURS via navigator-gated Part 4 amendment); two-clock migration (one-time backfill through migrate-* chokepoint + on-write hook) | W5 | SEED-026 |
| R9 | Retire build-graph's node-discovery path AFTER R8 proves the signal survives (net surface reduction, Part 7) | W6 | SEED-026 |
| R10 | Phase 161 embedding on-ramp: semantic clustering over the SAME room.db node ids supersedes literal co-occurrence; optional non-authoritative source_type-tagged meaning overlay | W7 | SEED-029 |
| R11 | D-B: `birthRoom` writes empty Section nodes into room.db at room creation; a migration backfills Section nodes for existing rooms; getGraphExport export-time anchors demote to a Tier-0 fallback | W2 | SEED-026 |

## Plan waves (the pipeline)
1. **W1 - Spine primitive + presentation repoint [SHIPPED this session on `fix/seed-026-graph-export-spine`].**
   getGraphExport + navigation re-export (canon surface-growth note) + generate-presentation repoint +
   5/5 tests. Verified: AION room 93 nodes / 81 edges, zero dangling, colored by knowledge_type,
   degree-sized, unmapped_types=[]; intelligence smoke 6/0; navigation acceptance 1/1; chokepoint 7/7.
2. **W2 - Dashboard Tri-Polar second surface + D-B birth Section nodes.** Repoint the Cytoscape feed +
   graph.json writer; add knowledge_type color + degree size + edge gloss; preserve the >30 cluster
   grouping path. Plus D-B (R11): `birthRoom` writes empty Section nodes + a migration backfills
   existing rooms; export-time anchors demote to a Tier-0 fallback.
3. **W3 - Part 8 gate + CI golden + ship SEED-026.** Boundary-scan + leak test + golden snapshot +
   node-type completeness gate; then the v1.13.x beta release lockstep (no push without navigator go).
4. **W4 - SEED-031 lossy-join fix.** Resolve wikilink edges to artifacts, not sections; fail loud.
5. **W5 - Co-occurrence re-home (two-clock migration).** Signal becomes typed graph memory BEFORE any
   build-graph retirement (never lose the signal mid-flight).
6. **W6 - Retire build-graph node path.** Only after W5; delete the ~700-line scan; net surface down.
7. **W7 - Phase 161 embedding on-ramp.** Semantic clustering supersedes literal co-occurrence on the
   same node ids; hands off to Phase 161.

## LOCKED decisions (ratified by navigator 2026-06-17 via Decision Gate)
- D-A (R8): **LOCKED - reuse REFERENCES/DESCRIBES** for the co-occurrence edge. No Canon Part 4
  amendment; mint a new type only if the semantics genuinely fail to fit at plan time.
- D-B (R1/R11): **LOCKED - real Section nodes written at room birth + a migration** for existing rooms
  (NOT export-time-only). room.db becomes genuinely complete. `birthRoom` writes empty Section nodes;
  a migration backfills existing rooms. The export-time section anchors shipped in W1 DEMOTE to a Tier-0
  fallback (un-migrated rooms / no room.db). getGraphExport already renders real `Section` nodes, so the
  read side is ready; the birth-write + migration is the added work (folded into W2/W3, ships on beta).
- D-C (R6): **LOCKED - decouple, ship SEED-026 (W1-W3) on the v1.13.x beta train now**; W4-W7 land v1.14.0.
- D-D (R7): **LOCKED - fix SEED-031 now in W4** (resolve wikilink edges to the artifact, not the section),
  so "authoritative room.db" is fully true before the viz is called spine-sourced.

## Scope
- IN: R1-R10 (the spine viz, the dashboard, Part 8 gate, SEED-031, co-occurrence re-home, build-graph
  node-path retirement, the embedding on-ramp handoff).
- OUT: the embedding/vector substrate itself (Phase 161 R1-R8); RS spine-wiring (SEED-030 / Phase 144.1);
  deleting wikilinks from the ~40 meaning-layer consumers (wikilinks stay as the Obsidian meaning layer);
  the intended local-vs-Brain correlation (untouched).

## Dependencies and relationships
- depends_on 109 (the SQL navigation spine chokepoint) and 141 (getRoomContext substrate).
- relates 161 (W7 embedding on-ramp lands there) and 144.1 (RS reach wiring).
- SEED-031 is spawned by this phase (the lossy-join debt the hats surfaced).

## Success criteria
- Every viz surface (presentation canvas + dashboard Cytoscape) sources from getGraphExport; zero
  phantom/dangling orphans on any real room.
- A new room never renders blank (cold-start anchors); memory_event never swamps the viz.
- The cross-file concept signal survives as typed room.db edges, not a render-time scan.
- room.db wikilink edges target artifacts, not sections (SEED-031 closed).
- Canon Part 8: the export payload carries zero correlation-id/Brain bytes (boundary-scan + leak test green).
- D-A / D-B / D-C / D-D ratified as LOCKED with tradeoffs recorded.

## Next action
`/gsd:plan-phase 162` to expand W2-W7 into executable plans (W1 is shipped and verified on
`fix/seed-026-graph-export-spine`). Ratify D-A..D-D at plan time.

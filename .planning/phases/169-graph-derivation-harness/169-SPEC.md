---
kind: spec
phase: 169
slug: graph-derivation-harness
title: Graph Derivation Harness -- make the typed-edge moat self-wiring (incl. sub-rooms)
milestone: v1.14.0
status: scoped
created: 2026-06-19
canon_parts: [3, 4, 6, 8, 9]
severity: CRITICAL
sequence: "before Phase 164 (revised order ...167 -> 168 -> 169 -> 164 -> 165), navigator-LOCKED 2026-06-18"
realizes_seed: SEED-034 (graph-derivation-harness)
absorbs: SEED-033 L2 (self-improving graph)
depends_on: [166, 167, 168]
---

# Phase 169: Graph Derivation Harness

The moat IS the typed edges (INFORMS / CONTRADICTS / CONVERGES / INVALIDATES / ENABLES / REFINES /
ROOT_CAUSES). A live field incident (b2-journey, 23 .md + 9 .docx) proved they are never auto-generated:
35 artifact nodes, 35 BELONGS_TO, every typed edge 0. This phase makes the moat self-wiring. It RIDES
the substrate shipped 2026-06-18 (runChain 166, manifest + fable-mode + generator 167, the reconciled
edge set 168), so it is mostly composition.

## The four verified root causes (SEED-034)
1. TWO room resolvers disagree: the auto-graph hook (`gsd-artifact-graph-hook.cjs:77-95`) resolves by
   the REGISTRY ACTIVE room; the rebuild tool resolves by `.room-root`. Sub-room writes index into the
   wrong db.
2. No sub-room rollup in rebuild (`lazygraph-ops.cjs:457` walks sections only, no sub-room recursion).
3. The indexer is .md-ONLY (`lazygraph-ops.cjs:488`); .docx/.html content is invisible.
4. The typed-edge derivation is MANUAL-only (brain-derive / findings-wirer / reanalyze / mos-reason),
   never in the write pipe; rooms sit at BELONGS_TO-only.

## Requirements
- **GDH-01 (one resolver):** the auto-graph hook resolves the target room by the file's `.room-root`
  (walk up to the nearest sentinel), NOT the registry active room. Unify with the rebuild tool's
  resolution. A write into a sub-room indexes into THAT sub-room's db regardless of the active room.
- **GDH-02 (derivation in the loop):** the auto-graph pipe runs a typed-edge DERIVATION pass, not just
  structural `indexArtifact`. (Trigger model locked in CONTEXT.)
- **GDH-03 (sub-room rollup):** the rebuild + the hook sweep sub-room artifacts into the graph
  (per-sub-room db + a parent rollup; correct `.room-root` resolution).
- **GDH-04 (non-.md reach):** .docx / .html content becomes reachable to the indexer + derivation (a
  reader/extractor or a conversion; decided in CONTEXT) so the dense moat content is not invisible.
- **GDH-05 (typed-edge derivation):** a runChain-driven pass that derives + writes the five cascade
  edges (+ REFINES / ROOT_CAUSES) via `navigation.cjs.writeEdge` (the Part 9 chokepoint; the frozen set
  is complete after Phase 168), fable-mode-critiqued (167 self-critique so a bad CONTRADICTS does not
  land), each derived edge landing `review_status: proposed` for human confirm (Part 4/9).
- **GDH-06 (backfill):** a command (`/mos:graph --derive` or extend `/mos:reanalyze`) that wires an
  EXISTING room incl. its sub-rooms in one pass. Acceptance fixture: the b2-journey room, typed-edge
  count 0 -> N.
- **GDH-07 (idempotent):** re-running the derivation on a wired room is a no-op (Ralph idempotence;
  proposed edges are not re-proposed; confirmed edges are untouched).

## Canon alignment
- Part 8: derivation is LOCAL (room.db); Brain is generic-methodology read-only; zero user-content
  egress; a boundary scan over any Brain-touching deriver. Part 9: all writes via `navigation.cjs`;
  derived edges land `proposed`; human confirms at a Decision Gate (Part 3), "why-not" captured (Part 4).
- Part 6 (dog-fooding): the plugin's OWN rooms (incl. the mindrianOS room sitting at Tier 0) must be
  wireable by this harness. Part 4: edges drawn only from the frozen set (now complete via 168).

## Reuse-before-build (Part 7)
Build on: `lazygraph-ops.cjs` (indexArtifact + rebuild -- extend for sub-rooms + the resolver fix),
`gsd-artifact-graph-hook.cjs` (the resolver to fix), `navigation.cjs` writeEdge chokepoint, the
existing derivers (`scripts/brain-derive-command.cjs` Phase 90, `lib/core/findings-wirer.cjs`,
`proactive-intelligence.cjs`, `cross-room-detect.cjs`), `lib/core/chain-executor.cjs` runChain +
fable-mode seam (the derivation loop), the vault reformatter (for .docx if conversion is chosen),
`/mos:reanalyze` + `/mos:graph` (the backfill entry). Net-new is the composition + the resolver unify +
the sub-room rollup + the non-.md reach + wiring the derivation into the pipe.

## Out of scope / deferred
- Per-keystroke derivation (cost); the trigger is debounced/sweep/backfill per CONTEXT.
- Cross-room typed edges (stays Part-8-gated, Phase 83 territory).
- The lazygraph two-vocabulary unification (SEED-034 note; separate from this phase).

## Acceptance
- The b2-journey fixture: after `/mos:graph --derive` (or the backfill), typed-edge count goes 0 -> N
  (CONTRADICTS / CONVERGES across the value-chain + canon artifacts), edges land `proposed`.
- A sub-room write indexes into the sub-room's own db with the active room set to the parent (GDH-01).
- A .docx artifact's content is reachable to the derivation (GDH-04).
- Re-run is a no-op (GDH-07). Part 8 leak scan clean. No em-dashes. Adversarial verify wave.

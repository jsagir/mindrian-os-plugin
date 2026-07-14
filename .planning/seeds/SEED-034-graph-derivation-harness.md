---
kind: seed
status: open
created: 2026-06-18
updated: 2026-07-14
canon_parts: [3, 4, 6, 8, 9]
severity: CRITICAL
related: [Phase 166 (runChain), Phase 167 (harness manifest + fable-mode), Phase 168 (edge reconciliation), Phase 90 (brain-derivation), Phase 16 (REASONING.md), SEED-033 (Ralph lessons -- this is L2 made urgent), SEED-058 (Eureka reasoning-mode fallback -- complementary, covers the degrade-path once this harness exists)]
proving_case: ~/MindrianRooms/jonathan-contractor-motj/sub-rooms/.../b2-journey (21 dense cross-referencing files sat completely unwired)
proving_case_2: intern QA session 2026-07-14 ("David", david-innovation-studio room) -- 30 markdown files filed via normal conversational writes, `/mos:eureka` found 0 nodes / 0 typed edges in room.db. Independently reconfirms broken pipes #1 and #4 below, from a different room and a different workflow, three and a half weeks later. Full incident: `.planning/debug/interns-round-eureka-david-session-2026-07-14.md`.
source: navigator field incident 2026-06-18 (the moat is empty)
absorbs: SEED-033 L2 (self-improving graph)
---

# SEED: Graph Derivation Harness -- the sqlgraph bot needs a harness (CRITICAL)

## The blunt diagnosis (the moat is empty)
The local graph's VALUABLE layer -- the typed cross-domain edges (INFORMS / CONTRADICTS / CONVERGES /
INVALIDATES / ENABLES / REFINES / ROOT_CAUSES) that ARE the moat -- is never generated automatically.
A real room (b2-journey, 21 dense files) showed: 35 artifact nodes, 35 BELONGS_TO edges, and EVERY
typed edge 0. The structural graph (filing cabinet) exists; the semantic graph (intelligence) does not.

## Four broken pipes (verified against code + the live b2-journey incident 2026-06-18)
The proving case: `motj-ecosystem/sub-rooms/jonathan-contractor-motj/b2-journey` -- which DOES have its
own `.room-root` + `.mindrian/room.db` (the "missing sentinel" hypothesis was DISPROVEN). The real bugs:

1. **TWO ROOM RESOLVERS that disagree (the core bug).** The auto-graph HOOK
   `scripts/gsd-artifact-graph-hook.cjs:77-95` `resolveRoomDir()` resolves by the env room ELSE the
   REGISTRY ACTIVE room -- it does NOT read the file's `.room-root`. The REBUILD TOOL resolves by
   `.room-root`. So a live write into a sub-room while the active room is the PARENT indexes into the
   PARENT's room.db (or nowhere useful), not the sub-room's own db. The sentinel exists; the live hook
   ignores it. This is the room-guard friction observed in the field.
2. **No sub-room rollup in rebuild.** `lib/core/lazygraph-ops.cjs:457` "walks all sections, indexes
   every .md file" -- NO sub-room recursion. A parent rebuild never sees sub-room artifacts; only a
   rebuild RUN INSIDE the sub-room populates its db (the manual workaround used in the field).
3. **The indexer is .md-ONLY.** `lazygraph-ops.cjs:488` `f.endsWith('.md')`. The b2-journey folder is
   9 .docx + 2 .html + 5 .py + 23 .md; the DENSE B2 content (Dossier, Values-Mirror, Lexicon,
   GuideScript) is .docx, which the graph CANNOT see at all. The moat content is in a skipped format.
4. **The typed-edge DERIVATION pass is MANUAL, never automatic.** The machinery EXISTS but is scattered
   across hand-run commands: `scripts/brain-derive-command.cjs` (Phase 90 BRAIN.md), `findings-wirer.cjs`,
   `proactive-intelligence.cjs`, `cross-room-detect.cjs`, commands brain-derive / mos-reason / reanalyze /
   graph. None is in the write pipe. So typed edges are NEVER auto-derived; rooms sit at BELONGS_TO-only
   (consistent with "BRAIN.md absent / Tier 0 fallback on every turn"). Note the auto-commit pipe
   (`async-artifact-auto-commit.cjs`) DID fire every write; the graph pipe is the disconnected one.

**Reconfirmed 2026-07-14 (proving_case_2).** A completely unrelated room (`david-innovation-studio`,
an intern QA session, not MOTJ) reproduced the same shape: 30 markdown files filed through normal
conversational writes, `resolve-room` returned `EXIT:1` for the entire session (pipe #1, still broken),
and `/mos:eureka` read 0 nodes / 0 typed edges from room.db despite the 30 files on disk (pipe #4, still
broken -- confirmed this time by grepping `scripts/post-write`'s freshness triple directly: it enqueues
MINTO regen + recompiles ROOM.md references + stamps a timestamp, and calls `navigation.cjs` in none of
the three steps). Two independent incidents, three and a half weeks apart, different rooms, different
workflows, same two broken pipes. This is not an edge case.

## The harness to build (this is the fix)
A GRAPH DERIVATION HARNESS that makes the moat self-wiring -- and it rides EXACTLY the substrate shipped
2026-06-18, so it is mostly composition, not net-new runtime:
- **CONNECT the second pipe:** the write hook (or a debounced post-write sweep) must run a DERIVATION
  pass, not just structural indexArtifact + commit. Wire the typed-edge derivation into the automatic
  loop (or a Stop/SessionEnd-triggered sweep) so it is never hand-run.
- **SWEEP sub-rooms:** walk sub-rooms into the parent graph (or per-sub-room graph + a parent rollup),
  resolving the right room.db. Close the active-room-resolution gap.
- **RUN the typed-edge derivation (the cross-relationship scan that WRITES edges):** for each artifact
  (incl. sub-rooms), derive INFORMS / CONTRADICTS / CONVERGES / INVALIDATES / ENABLES / REFINES /
  ROOT_CAUSES via navigation.cjs.writeEdge (the Part 9 chokepoint). The edge set is now COMPLETE in the
  frozen vocabulary (Phase 168 just added CONVERGES/INVALIDATES/ENABLES). e.g. wire CONTRADICTS between
  Amit's "meet, do not transform" and Yoni's "we create change"; CONVERGES across the value-chain artifacts.

## Why now (the substrate is ready)
- **runChain (166)** is the loop: scan -> derive -> write -> verify -> loop (a Ralph loop, SEED-033 L2).
- **Phase 168** completed the typed-edge frozen set, so the derivation can write all five cascade edges.
- **fable-mode (167)** self-critiques each derived edge before it commits (a bad CONTRADICTS does not land).
- **The harness manifest (167)** declares the derivation as a governed pipeline step.
- **navigation.cjs (Part 9)** is the single write chokepoint; **proposed -> human-confirm** (Part 4/9) so
  derived edges are proposals the navigator ratifies at a Decision Gate (Part 3), not silent truth.

## Canon alignment
Part 8: derivation is LOCAL (room.db); Brain is generic-methodology read-only; zero user-content egress.
Part 9: writes via navigation.cjs; derived edges land `proposed`; human confirms (Part 4 "why not" captured).
Part 6: the plugin's own rooms must be wired by this harness too (dog-fooding -- the mindrianOS room itself
sits at Tier 0). The cross-relationship proactive loop (CLAUDE.md) is the doctrine; this seed MAKES IT RUN.

## Required capability (exploration acceptance -- this is a seed, not a plan)
1. **ONE room resolver.** The auto-graph hook must resolve the target room by the file's `.room-root`
   (walk up to the nearest sentinel), NOT the registry active room -- so a write into a sub-room indexes
   into THAT sub-room's db regardless of which room is active. Unify the hook resolver with the rebuild
   tool's `.room-root` resolution (kill the two-resolver split).
2. The auto-graph pipe runs a DERIVATION pass (not just structural index) on write or on a debounced sweep.
3. Sub-room artifacts are swept into the graph (correct room.db resolution; parent rollup + per-sub-room db).
4. **Non-.md content is reachable.** The indexer is .md-only today; the dense moat content is often .docx
   (and .html). Either convert .docx -> .md on file (reuse the vault reformatter) or add a .docx/.html
   reader to the indexer, so that content is not invisible to the graph.
5. A runChain-driven typed-edge derivation that writes the five cascade edges (+ REFINES/ROOT_CAUSES)
   via navigation.cjs, fable-mode-critiqued, landing `proposed` for human confirm.
6. A backfill command (`/mos:graph --derive` or extend `reanalyze`) that wires an EXISTING room incl.
   sub-rooms in one pass (the b2-journey room is the acceptance fixture: typed-edge count goes 0 -> N).
7. Idempotent re-run (Ralph: re-running a wired room is a no-op).

## Open questions for the phase that picks this up
- Trigger: per-write (debounced) vs Stop/SessionEnd sweep vs explicit backfill command vs all three.
- Sub-room model: one graph per room with a parent rollup, vs a single graph spanning sub-rooms.
- Derivation cost control (the 166 token budget + fable-mode posture-scoping apply -- derive on material artifacts first).
- Relationship to Phase 90 brain-derivation + Phase 16 REASONING.md (reuse those derivers, do not fork).

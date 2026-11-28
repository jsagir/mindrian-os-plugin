---
phase: 367
title: "The graph writes itself: one catch-up runner for files and answered cards, on every surface"
canon_parts: [3, 8, 9, 11]
status: design in EGM review (367-DESIGN.md r4); plan after convergence
date: 2026-11-26
method: GSD frame with EGM design step (project CLAUDE.md, owner ruling 2026-11-25)
---

# Phase 367 CONTEXT

## Owner need (verbatim, 2026-11-26)

"I want you to use the EGM full cycle to audit the reasons and the potential adjustment needs to be
made to make sure the local graph is always being written as a rule, because I find myself many
times asking for local graph writing and MindrianOS reminded that it's what it needs to do. This
needs to be an automated process!"

## Owner rulings (LOCKED: a reviewer may say a design fails one, never that it is wrong)

- OR-1 (card 2026-11-26): "A CLI card answer is the human's approve: it lands as a confirmed
  decision." This changes the HITL rule (Canon Part 9: only a human confirms a truth-claim node)
  for one input: an AskUserQuestion card the navigator answered in the terminal. A canon change-log
  entry in docs/MINDRIAN-CANON.md Appendix D must cite this ruling.
- OR-2 (2026-11-26): "Run it end to end: apply the fix, then register it as a GSD phase, but do the
  full Goldfish work."
- OR-3 (2026-11-26): home is Phase 367 (absorbs SEED-101 and the record half of Phase 280).

## Standing rules that bind the design

- room.db (SQLite at `<room>/.mindrian/room.db`) is the local graph; typed edges and memory_event
  nodes are written through lib/core/navigation.cjs (existing exceptions listed in the design).
- An extracted claim lands `proposed`; only a human confirms (OR-1 is the one ruled exception).
- Canon Part 8: no room content to the remote Brain.
- Three surfaces: CLI (hooks), Desktop and Cowork (MCP only, no hooks).
- Reuse before build (Part 7); born wired with a declared HITL shape (Part 11).

## Research trail

- Audit: scratchpad graph-write-map.md (every write path), graph-history.md (history; the symptom
  recurred 3 times; quick 260612-t29 fixed it with prose only).
- Solution lenses: neo4j agent-memory and modeling skills (record vs claim), SQLite write path
  (graph is its own watermark, BEGIN IMMEDIATE, errcode 517 probe), icm-architect (room.db is a
  generated index the model keeps by hand).
- Goldfish: 367-GOLDFISH-REPORT-R1.md, -R2.md (and R3 when done).
- To mirror into ~/MindrianRooms/rethinking-mindrianos/research/ (dev-research compositing rule).

## Coordination

- Phase 400.3 (session jsagi-d0): owns artifact_file inline index, the .room-root marker module,
  busy/lock primitives. Not executed (waits for an owner go). 367 uses three stand-ins and swaps
  them when 400.3-01/02 land. d0 accepted the ownership table; lazygraph-ops.cjs is shared, so the
  second to land rebases.
- Phase 400.2.1 (jsagi-53) and 400.4 (jsagi-85) edit other files.

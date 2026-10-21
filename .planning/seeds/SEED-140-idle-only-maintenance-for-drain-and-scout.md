---
id: SEED-140
title: "Idle-only maintenance: run the drain and the scout only when no prompt is in flight"
status: open
priority: low
filed: 2026-10-21
planted_during: "Phase 379.1 plan 06 (graph derive drain and scout runaway CPU)"
origin: "Phase 379.1, decision D-379.1-16"
trigger_when: "a hook seam exists that marks a prompt in flight, or a user still reports a slow editor while the background workers run"
scope: medium
surfaces: [MindrianOS-Plugin]
promotes_to: "a quick that adds an in-flight check before the drain and the scout runner start work"
---

# SEED-140: Idle-only maintenance

## The problem

Phase 379.1 bounds the drain and the scout by time, pairs, threads and priority. The workers still start when a hook fires, whether or not a prompt is in flight. A bound worker is a small cost; an idle-only worker is no cost to a live prompt.

## Evidence

- D-379.1-16 borrows three ideas from RxDB: resume from a checkpoint (the cursor), invalidate by hash and model (the vector cache), and run maintenance when idle. The third was conditional: "if the existing hook seams allow it cheaply; otherwise defer".
- No hook seam marks a prompt in flight today. The ambient ledger's `in_flight` flag (lib/core/ambient-run.cjs) belongs to the ambient run and does not mean a prompt is in flight.
- The research on idle patterns found no authoritative source for VS Code or Obsidian indexer scheduling (379.1-BREAKTHROUGH-RESEARCH.md, Q5, UNVERIFIED, not cited).

## Proposed next step

Add one small, written seam: a hook that stamps "prompt started" and "prompt ended" in a room-local file with a heartbeat, and a `promptInFlight(room)` reader. The drain and the scout runner call it before work and exit when a prompt is in flight. Define the stale case (a heartbeat older than a bound reads as idle). Do not reuse the ambient ledger flag.

## Trigger

The seam exists, or a field report of a slow prompt during a drain that the existing bounds do not explain.

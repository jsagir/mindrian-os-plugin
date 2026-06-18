---
kind: seed
status: open
created: 2026-06-18
canon_parts: [3, 6, 7, 9]
related: [Phase 166 (gated-chain-executor), Phase 167 (harness-as-code), the GSD orchestration loop]
source: navigator research request 2026-06-18 (Ralph loop / Geoffrey Huntley agentic-coding technique)
sources:
  - https://ghuntley.com/ralph/
  - https://linearb.io/blog/dex-horthy-humanlayer-rpi-methodology-ralph-loop
  - https://github.com/snarktank/ralph
  - https://www.deeplearning.ai/courses/agentic-knowledge-graph-construction
---

# SEED: Ralph-loop lessons for MindrianOS

## The finding
The Ralph loop (Huntley, 2025) is a brute-force agentic-coding pattern: run an agent in a loop on the
SAME prompt, FRESH context each iteration, the FILESYSTEM (not the chat) as memory, loop UNTIL the task
actually succeeds. MindrianOS already IS a Ralph loop, but a GATED, verified one: GSD waves spawn
fresh executors, state lives on disk + room.db, PLAN files are the PRD, run-all-NNN.sh is the verify.
runChain (166) is a Ralph loop in code. Ralph independently validates Canon Part 9 (SQL is the mind,
not the chat) and the fresh-context-subagent pattern.

## Two lessons worth adopting (net-new)

### L1: bounded auto-retry inside autonomous_safe steps (fable-mode upgrade)
Ralph loops-until-pass; MindrianOS deliberately HALTS at material gates (166 B3, canon human-gate).
The synthesis: for `autonomous_safe` steps ONLY, run a BOUNDED Ralph-style verify -> feedback ->
retry-until-pass loop INSIDE the step before it can reach a gate. This is exactly where fable-mode
(167 HARN-02) lives: today a failed self-critique HALTS; the Ralph lesson says it could RETRY the safe
step a capped number of times first, then halt. Ralph inside the safe steps, gates at the material
ones. Cap via the EXEC-06 token budget; never unbounded (B3 stays intact for material steps).

### L2: the self-improving graph (Neo4j agentic-graph-construction loop)
Neo4j's "agentic knowledge graph construction" is a propose -> fact-check -> refine loop of agents that
build/refine the graph SCHEMA with provenance-tracked writes. MindrianOS CONSUMES its dual graph (157
projection) + the local room graph but has no agents that ITERATIVELY IMPROVE them. A Ralph-style
propose-refine-factcheck loop over the orchestration projection (or local room.db enrichment) would
make the graph self-correcting -- the moat deepening itself. All LOCAL + navigation.cjs chokepoint
(Part 8/9); Brain stays generic-methodology read-only.

## Required capability (exploration acceptance -- this is a seed, not a plan)
- L1: a bounded retry-on-failed-self-critique for autonomous_safe steps in runChain + framework-runner,
  capped by the EXEC-06 budget, material steps still halt (B3 preserved). Likely a fast-follow on 167.
- L2: a propose -> factcheck -> refine agent loop that writes graph improvements via navigation.cjs,
  with human-confirm at promotion (Part 9 role 5). Likely its own phase.

## Why deferred
Both are upgrades on shipped surfaces (166/167), not blockers. L1 is a fable-mode refinement; L2 is a
new self-improving-graph phase. Capture now, prioritize later.

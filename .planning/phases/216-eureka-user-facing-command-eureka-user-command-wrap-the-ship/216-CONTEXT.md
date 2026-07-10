# Phase 216 - Eureka User-Facing Command - CONTEXT

Source: ROADMAP Phase 216 scope + 216-RESEARCH.md + navigator directive (2026-07-10, via AskUserQuestion at
the /gsd-plan-phase 216 gate). This CONTEXT is the planning input for /gsd-plan-phase 216. The planner MUST
honor the navigator directive below; it is not optional flavor.

## What the phase delivers

Wraps the already-shipped Eureka Portfolio-Scale engine (Phases 211-215: tri-modal retrieval spine, AHP
criterion-weight module, 3-dim scoring + weak-signal tail classifier, Opportunity Statement emitter, the
composed batch runner `scripts/eureka-portfolio-report.cjs`) as a real user-invocable `/mos:eureka` command.
Today it is a CLI script a developer runs by hand with `--db/--pairs/--top/--out/--json` flags; nobody
outside a dev shell can invoke it. This phase makes it a normal command: resolve the navigator's active
room, run the engine against it, render the result through the standard 4-zone UI, close on an F.8
Decision Gate. Zero new engine (Canon Part 7) - composition + a thin room-native adapter (below) + governed
command wiring (Canon Part 11).

## NAVIGATOR DIRECTIVE - room-native substrate adapter, NOT delegate to the plain 211 report (2026-07-10)

216-RESEARCH.md surfaced the one load-bearing open question (its "A5", the substrate decision): the
runner's default `--pairs graph` mode only works because the JHU room has a pre-built idea-graph.json with
cited CONVERGES pairs. A normal MindrianOS room has no such file - out of the box the command would return
an empty report.

Two paths were presented at the Decision Gate. **The navigator chose: build a thin room-native substrate
adapter.** Pairs are sourced directly from `room.db` entries/edges (not a CSV-derived idea-graph); attention
= node degree, growth = `created_at` recency (the analog of the JHU C-number recency proxy). This is STILL
composition (Canon Part 7 - zero new scoring/tail/statement engine), but it is real, non-trivial work: the
adapter must feed the SAME `ahp-weights` / `portfolio-dimensions` / `tail-quadrant` / `opportunity-statement`
modules the shipped runner already composes, just with a different pair-and-signal source than the
CSV-derived idea-graph path.

**Explicitly REJECTED:** delegating to the simpler, already-shipped `eureka-room-report.cjs` (the plain
211-era report). That path has no AHP scoring, no tail classifier, no Opportunity Statement emitter - it
would ship a bare similarity list, not "Eureka." The whole point of this phase is that the command produces
the SAME kind of ranked, tail-flagged, Opportunity-Statement output the JHU acceptance run proved out in
Phase 215, just against the navigator's own room.

**Consequence for the plan:** `loadGraph()`'s hard-throw on a missing `--graph` file is resolved BY the
adapter, not by a separate guard - when no idea-graph.json is supplied/found, the command path builds pairs
from room.db directly rather than erroring. The `MIN_COHORT=30` tail-classifier floor from 216-RESEARCH.md
must degrade gracefully (report says "not enough entries for a tail read" rather than crashing) on the
tens-of-entries rooms typical of most navigators - do not assume JHU-scale (2117 nodes) cohorts.

## Other locked decisions (small, not worth a separate gate - planner: treat as decided)

- **Command name:** `/mos:eureka` (per 216-RESEARCH.md's proposal; collision-free, verified against
  `data/command-registry.json`).
- **v1 scope: report-only, no banking.** Opportunity Statements render in the report; they are NOT written
  as graph nodes via `lib/core/navigation.cjs` in this phase (Canon Part 9 - banking is a later phase's
  governed wiring, matching the posture the shipped runner itself already takes). Critic state renders
  honestly as `pending` per the existing Pitfall-4 invariant (never banked on pending).
- **HITL shape:** F.8 (matches all four analog discovery commands - `find-connections`, `whitespace`,
  `find-analogies`, `opportunities`). Close on an AskUserQuestion offering the standard discovery-command
  next-steps.
- **Runtime/UX shape (per the 2026-07-10 web-pattern check, folded in from the rethinking-mindrianos
  compositing pass):** fire-and-return, not block-and-wait. The command kicks off the scan, confirms it is
  running, and returns the rendered report as the durable artifact (the existing `.md`/`.json` report-file
  pattern already IS "document as dashboard") - it must not hold the conversation hostage for a multi-minute
  run on a large room. Small rooms (tens of entries) should complete fast enough not to need this, but the
  command must not assume room size.

## Canon

Part 7 (reuse before build - zero new scoring/tail/statement engine, the adapter composes the SAME four
Wave-1 modules 215 already wired), Part 8 (Graph Boundary - zero network calls, inherited from the shipped
runner; the one-time model-weight fetch by model id is the only network touch, unchanged from 211-215),
Part 9 (Memory Locality - report-only v1, no banking, no memory_event writes), Part 11 (CIRS - born wired,
connector registration, HITL shape declaration - all six gates enumerated in 216-RESEARCH.md). No em-dashes
anywhere.

## Grounding references (read these at plan time)

- `.planning/phases/216-eureka-user-facing-command-eureka-user-command-wrap-the-ship/216-RESEARCH.md` - the
  full research trail: exact frontmatter distilled from `commands/whitespace.md` /
  `commands/find-connections.md` / `commands/find-analogies.md` / `commands/opportunities.md`; the six gates
  a new command must clear; the substrate mechanism in detail.
- `.planning/phases/215-eureka-portfolio-scale-fusion-eureka-portfolio-fusion/215-05-SUMMARY.md` - what
  shipped, the DG-1 (Burt-on-212.5) and DG-2 (graph-canonical) navigator calls this phase's adapter must not
  contradict for the JHU/idea-graph path (the adapter is an ADDITIONAL substrate for rooms without an
  idea-graph, not a replacement of the existing graph/full modes).
- `scripts/eureka-portfolio-report.cjs`, `lib/core/eureka/*.cjs` - the modules the adapter composes.
- `commands/whitespace.md`, `commands/find-connections.md`, `commands/find-analogies.md`,
  `commands/opportunities.md` - the four command-authoring analogs.
- `~/MindrianRooms/rethinking-mindrianos/research/2026-07-06-eureka-213-215-prior-art-validation/` - the
  room's independent validation of the 213-215 arc (Dev-Research Compositing per project CLAUDE.md);
  confirms the DG-1/DG-2 read this phase's adapter must stay consistent with.
- Depends on shipped: Phases 211-215 (all complete).

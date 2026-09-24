---
created: 2026-09-08T00:00:00.000Z
title: Audit autonomous_safe posture against the reversibility x consequence grid
area: harness-audit
files:
  - lib/core/recipe-maps.cjs
  - lib/core/chain-executor.cjs
  - lib/mcp/tools/gate.cjs
---

## Problem

Phase 299 (SEED-033: Apply Ralph-Loop Lessons to MindrianOS Autonomous Execution) has no
goal or requirements yet ("[To be planned]" in ROADMAP.md as of 2026-09-08). A
navigator-supplied and then navigator-revised reference on modern AI-systems techniques
(filed in full at
`~/MindrianRooms/rethinking-mindrianos/research/2026-09-08-techniques-modern-ai-systems-revised-capture.md`,
mirrored to `~/MindrianOS/research/`) contains two pieces of design guidance that read as
direct inputs to autonomous-execution scoping, reviewed and grounded during Phase 298 wave
1-2 execution the same day.

**1. The 9b runtime-HITL four-requirement contract.** Durable state (checkpointed, resumable
minutes or days later, not a blocked thread), legible surfacing (the human sees what is
proposed, why, evidence, reversibility, not an opaque handle), the decision re-enters state
(not logged beside the run, but part of what the resumed execution reasons over), and a
defined default on timeout (proceed, abort, or escalate - explicitly named as the thing
undefined-default systems get wrong in production). MindrianOS already has the first three in
structural form: `lib/core/chain-executor.cjs`'s halt-and-resume via `gate_answer`
(pipeline-state as the durable checkpoint), the F.8 basket rows made readable in Phase 298
plan 04 (legible surfacing), and the approve verdict writing a typed decision node with
SOURCED_FROM edges (decision re-enters state). The fourth - a declared timeout default per
material step, distinct from the halt itself - is not visibly declared anywhere in
`lib/core/chain-executor.cjs` or the harness manifest's routing policy as of this writing.
Whether Phase 299 should add one, and what "escalate" even means for a headless autonomous
run, is a discuss-phase question, not something to guess here.

**2. The reversibility x consequence gate-placement grid.** Only "hard to reverse AND high
consequence" justifies a blocking gate; the other three quadrants are a notification, an
after-the-fact log review, or nothing. The source names the failure mode of over-gating
explicitly: "teams that gate everything train their reviewers to rubber-stamp, which is worse
than no gate at all - it manufactures the appearance of oversight while removing its
substance." This reads directly onto the `autonomous_safe` posture map
(`lib/core/recipe-maps.cjs` postureForCommand) that already decides which chain steps run
unattended versus halt: is that map currently drawn along a reversibility axis, a consequence
axis, both, or neither? Worth checking before Phase 299 adds more autonomous-safe surface
area, since the Ralph-loop lessons phase is precisely about widening what runs unattended.

## Proposed Approach

Not a code task. When `/gsd-discuss-phase 299` runs, read the filed research entry's "What
MindrianOS takes from it" section (items 1 and 2) as one of the discussion inputs, alongside
whatever the Ralph-loop source material itself says. Two concrete questions worth putting to
the navigator at that checkpoint: (a) should `autonomous_safe` posture be re-derived against
the reversibility x consequence grid rather than whatever criteria set it today, and (b) does
chain-executor need an explicit per-step timeout default, or is "halt forever until a human
answers the gate" the intended and sufficient default already.

Sibling seed carrying the knowledge-injection-axis half of the same source (graph-native
query routing, not a Phase 299 input): `.planning/seeds/SEED-094-knowledge-layer-query-router-graph-traversal-vs-community-summary-vs-hybrid.md`.


## Update 2026-09-08 (Phase 299 closed as absorbed by Phase 201)

Phase 299 (SEED-033) closed as ABSORBED BY PHASE 201 during this session's discuss-phase pass:
SEED-033's own two required-capability asks (L1 bounded retry, L2 graph-refine loop) were both
already shipped in Phase 201 (COMPLETE 2026-07-02), two weeks after the seed itself was filed.
This todo's actual content - the 9b runtime-HITL four-requirement contract and the reversibility
x consequence gate-placement grid, both from the navigator-supplied AI-systems reference - has
no phase to land in anymore. Retargeted as a standing audit item, not phase-gated: is
`lib/core/recipe-maps.cjs`'s `postureForCommand` derived along a reversibility axis, a consequence
axis, both, or neither? Surface it whenever a future phase next touches `autonomous_safe` posture
or widens what runs unattended (a natural moment: SEED-033's own L1 already runs bounded retries
inside autonomous_safe steps per Phase 201-02 - does ITS retry cap reflect a reversibility
judgment, or was it picked for another reason?).

## Data point: Phase 355 verification stamp

Recorded by Phase 355 (Hidden in Plain Sight: Jev-through-Theo cross-connection
engines) Plan 21, 2026-09-24, commit-adjacent to `355-21`'s own task 1 commit.
A second, concrete data point for the standing audit above: `lib/core/verification-stamp.cjs`
(the module `find-bottlenecks`, `find-connections`, `whitespace`, `hsi-to-graph` and `eureka` all
call to attach a cross-connection stamp) makes exactly one read-only Theo `find_connections`
call per distinct framework pair, writes nothing of its own (any node/edge write happens through
the caller's own pre-existing writer, e.g. `addWhitespaceZone`, never a second writer this module
opens), and sends only canon Framework names, never room or user content (D-10, D-48).

Plotted against the reversibility x consequence grid: reversibility is `n/a (read-only)` (there is
nothing to reverse), consequence is `low` (a stamp changes what is rendered, never what is filed
or acted on); that places it squarely in the grid's no-gate quadrant, matching the module's own
declared `POSTURE`:

```
POSTURE = { autonomous_safe: true, reversibility: 'n/a (read-only)', consequence: 'low', writes: 'none' }
```

It is not a chain step: `lib/core/chain-executor.cjs` never references `verification-stamp.cjs`
or `stamp-connections.cjs` (a stamp is never treated as a material step a chain run could halt
on), coordinated with Phase 356's own Jev-seat policy so the two phases' autonomous-safe surfaces
do not collide. Machine-checked by `tests/test-355-cirs-wiring.cjs` (355-21).

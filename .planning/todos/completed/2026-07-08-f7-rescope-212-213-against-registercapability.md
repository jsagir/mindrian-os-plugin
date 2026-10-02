---
created: 2026-07-08
title: "F7 rescope: re-plan Phases 212/213 against registerCapability before execution"
area: planning
source: rethinking-mindrianos Wave-2 room track, 00-FORK-DECISIONS.md (F7, ratified 2026-07-08)
urgency: high - closing window (212/213 not yet executed)
status: completed
resolution: "Closed by plan 366-24 (2026-10-02): moot for the eureka producer. After 366-07 the eureka producer never files and never writes last-eureka.json; rs, hsi, whitespace and find-connections still feed SENS-13 through the relocated filer; the standalone runner (and its offer wiring) retired in 366-22."
---

# F7 rescope: Phases 212/213 vs registerCapability

Ratified fork F7 (Wave-2 room track, 2026-07-08): cancel 213-04's freestanding
eureka-offer.cjs and re-plan Phases 212/213 against the registerCapability
propose-critique-integrate kernel interface (capability-registration pack)
BEFORE either phase executes.

Why now: the synthesis flagged this as the one time-sensitive ruling - once
213-04 builds its own offer wiring, the kernel interface arrives too late and
the Eureka pair becomes the next hand-built triad the kernel was designed to
absorb.

Refs:
- ~/MindrianRooms/rethinking-mindrianos/research/2026-07-08-fable-wave2-room-rethink/00-FORK-DECISIONS.md
- .../capability-registration/capability-registration.md
- .../00-ROOM-TRACK-SYNTHESIS.md (section 4, F7; build order section 3)

## Finding (2026-10-02, plan 366-24, Phase 366 close-out)

SENS-13 reads `<room>/.mindrian/last-eureka.json`, written by `writeStampedSideChannel` in
ambient-run.cjs after a producer's finding is filed. After plan 366-07 the eureka producer
never files: it hands its top candidates to `research-planner/ambient.cjs` as a plan-only offer
(no judge, no Theo stamp, no fetch, no filing), so it never writes that side channel. The rs,
hsi, whitespace and find-connections producers still file through the relocated
`fileStampedOpportunity` (now in the research planner, 366-02) and still feed SENS-13.

The F7 worry was that 213-04's freestanding offer wiring would make the Eureka pair a
hand-built triad the registerCapability kernel arrives too late to absorb. Phase 366 removed
that triad instead: Eureka is one perspective module of the research planner (366-08), the
standalone runner is deleted (366-22), and the perspective path (recall, Stage A, plan, grant,
run, F.8 filing) is the only door. The 212/213 re-plan against registerCapability is therefore
moot for the eureka producer. Whether the remaining producers later move onto the kernel
interface is a kernel question, not this todo.

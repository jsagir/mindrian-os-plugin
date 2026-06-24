---
kind: pedagogy-spec
slug: exploration-pedagogy-four-gate-flow
title: "The conversational exploration flow -- four automatic gates, tools invisible"
created: 2026-06-24
source: "Navigator (Jonathan), relaying tester Test 4 A/B (v1.13.1 Run 1 vs v1.14.0-beta.9 Run 2)"
canon_parts: [3, 10]
related: ignite-frontdoor-bypassed-methodology-overfire (RCA), 177-larry-behavioral-channel
status: spec-captured (awaiting navigator confirm before encoding into Larry's contract)
---

# The Exploration Flow: four automatic gates, tools invisible

## The meta-lesson (the acceptance criterion)

v1.14.0 added real capability. The risk: the capabilities became the INTERFACE instead of
the INFRASTRUCTURE. The student must never see a methodology selector, a persona/path gate,
or a time-horizon menu. The student sees Larry asking good questions; behind the scenes
Larry reaches for the right tool at the right moment. Part 10: conversation is the surface,
commands are internals. Run 1 (v1.13.1) honored it; Run 2 (v1.14.0) violated it by making
the command the surface.

The build worth shipping = Run 1's conversational depth + Run 2's analytical tools and
visual deliverables, with the tools INVISIBLE.

## The gate sequence (depth mode) -- all four AUTOMATIC

```
Seed material (article, briefing, experience)
  -> Breadth check:  which problem has the biggest crack?        [Decision Gate; student picks]
  -> Student picks
  -> Decompose (as many levels as needed)                        [conversation; their questions build the hierarchy]
  -> Depth gate:     is this an invention or a process?          [Decision Gate]
  -> Altitude gate:  what does this invention's output enable at the next level?  [Decision Gate]
  -> Breadth return: a second opportunity from a different problem?              [Decision Gate]
```

Classification:
- Every gate is a Part 3 F.1 Decision Gate at a GENUINE judgment point -- the student
  decides. None is a configuration menu.
- The decomposition BETWEEN gates is conversational: the student's own questions become the
  hierarchy (their moves are the structure, not Larry's rails). Levels go as deep as needed.
- The methodologies (decomposition, trending-to-absurd, scenario, etc.) are reached for
  SILENTLY to power the decomposition / extrapolation. They never present a menu, a persona
  gate, or a horizon selector to the student.

## Test 4 gap (what Run 2 broke)

- Ran only the DEPTH gate -- and only because the student FORCED it.
- MISSED: the breadth check, the altitude gate, the breadth return.
- ADDED overhead the flow forbids: a persona/path gate + a three-horizon menu + an opening
  compliment ("five rounds of dismissals").

All four gates must fire automatically; the menus must not appear at all.

## What this means for the fix (merges two debts)

- DI-177-MENUS-AS-SURFACE: delete the persona/path/horizon MENUS from the methodology
  orchestrators (trending-to-absurd first; audit futures / scenario / others). They run on
  Larry-inferred or sensible defaults and surface only genuine judgment points -- never a
  config form.
- INSTALL the four-gate exploration flow in Larry's conversational contract
  (skills/conversation-mode + skills/larry-personality + the parked pedagogy spec) as the
  AUTOMATIC behavior on seed material: breadth check -> decompose -> depth -> altitude ->
  breadth return. The behavioral channel (Phase 177) is the engine substrate that lets Larry
  reach for tools without surfacing them; this spec is the conversational soul it serves.

## Open / to confirm with navigator

- Is the depth gate's question fixed ("invention or a process?") or one of a family?
- Does the breadth return loop (offer a 3rd, 4th problem) or fire once?
- Is there a non-depth ("breadth-only") mode, or is this the single canonical flow?
- Encode into Larry's contract now, or wait for the full pedagogy (more gates / modes) to be specified?

---
decision_id: phase-95-sequencing
filed: 2026-04-29
session: 2026-04-29 post-v1.11.2 ship
verdict: SHIP_95_TIGHT_AMEND_882_SEPARATELY
canon_parts:
  - "Part 6 -- Product-as-Venture (Dog-Fooding Mandate)"
  - "Part 7 -- Reuse Before Build"
status: confirmed
applies_to:
  - Phase 95 (bash-hook-envelope-and-cascade-side-channel) -- IMMEDIATE NEXT
  - Phase 88.2 (uiux-selector-block) -- spec amendment to add F.0 + F.6
sequencing:
  - "now: append F.0 + F.6 spec amendment to .planning/phases/88.2-uiux-selector-block/88.2-CONTEXT.md (small commit, spec-only)"
  - "next: /gsd:plan-phase 95 against the existing filed CONTEXT (no scope expansion)"
  - "after 95 ships: /gsd:plan-phase 88.2 picks up the F-shape rollout with F.0 + F.6 in scope from day one"
---

# Decision -- Phase 95 Sequencing

## Question

Phase 95 is filed as IMMEDIATE NEXT (bash hook envelope + room-proactive cascade side-channel). The Phase 88.2 spec needs amendment to add F.0 (Mini Decision Gate) and F.6 (Plan Review Round) -- two new shapes surfaced by the UI/UX moat survey. Should the spec amendment land INSIDE Phase 95, or as a separate commit before /gsd:plan-phase 95 runs?

## Verdict

**Ship Phase 95 tight per its filed CONTEXT. Append F.0 / F.6 spec amendment to Phase 88.2's CONTEXT separately and immediately. Two commits, two clean surfaces, zero scope expansion.**

The F-shape spec amendment is NOT new scope on Phase 95. It is a doc update against Phase 88.2's CONTEXT.md. Phase 95 fixes the cascade pipe (envelope hygiene + side-channel + room-proactive contract update). Phase 88.2 builds the F-shape rollout. Mixing them inflates Phase 95's surface and risks the same scope-creep that Phase 94 explicitly avoided when v1.11.2 deferred the bash hook to Phase 95 in the first place.

## Four-voice consultation

```
voice              what it said
---------------    --------------------------------------------------------------
ROOM (mindrianos-  Blue Hat persona explicit: "schedule has no slack. Every
venture)           workstream is on the critical path." Argues for tight,
                   scoped phases. Anything bigger than the documented Phase
                   95 scope is timeline risk against IRIS launch (May 20).

USER FOLDER        project_academy_v22_decomposition.md pattern: ship
                   architecturally-load-bearing-fix first, then features
                   second. Repeating precedent across milestones. The user's
                   sequencing instinct is conservative on scope, aggressive
                   on cadence.

BRAIN (teaching    Not in domain (methodology graph, not project sequencing).
graph)             Adjacent: PWS Phase Gate methodology -- never combine a
                   bug-fix gate with a feature-spec gate; they have different
                   exit criteria. The Brain would bless the separation on
                   pure methodology grounds.

LARRY (synthesis)  This precedent is from THIS very session: A1-only with B
                   explicitly deferred to keep v1.11.2 tight. Same logic
                   applies one level up: Phase 95 ships its filed scope; the
                   F-shape spec amendment is a separate small surface against
                   Phase 88.2's CONTEXT. Two commits, both tight, neither
                   bloated.
```

## Implementation contract

Three actions, in order:

1. **Now (this session):** append the F.0 / F.6 spec amendment to `/home/jsagi/MindrianOS-Plugin/.planning/phases/88.2-uiux-selector-block/88.2-CONTEXT.md`. Reference both decision files (decoy-ethics, cowork-round-locking) so future readers have the full audit trail. Single commit, spec-only, no phase work.

2. **Next (this session):** invoke `/gsd:plan-phase 95` against the existing 95-CONTEXT.md. The phase planner produces 4-6 plans. Phase 95 ships per its filed scope. No scope expansion. No coupling to F-shape rollout.

3. **Later (after Phase 95 ships):** invoke `/gsd:plan-phase 88.2`. The Phase 88.2 planner now has F.0 + F.6 in scope from day one. The F-shape rollout includes mini-gates (F.0) and plan review rounds (F.6) as first-class shapes alongside the existing F.1-F.5.

## Out of scope (explicitly NOT decided here)

- Phase 88.2 plan ordering (which F-shape ships first) -- decided when /gsd:plan-phase 88.2 runs.
- Phase 96-99 sequencing (browser capture pack, selector roundtrip, cascade decision gate, BRAIN.md decision card view) -- post-Phase-88.2 sequencing decision.
- Whether to bundle Phase 95 + Phase 88.2 into a single milestone (v1.12.0) -- ROADMAP-level decision, deferred to milestone planning.

## Provenance

Same session as decision-cowork-round-locking.md and decision-decoy-ethics.md. The four-voice consultation pattern was instituted by the user mid-session as a Tri-Context Decision Gate dogfood applied to product decisions about MindrianOS itself.

## Cool-UI/UX expression

Sequencing decisions are themselves a UX surface. The dog-food room's `decisions/` folder, populated with self-teaching artifacts like this one, becomes browseable via /mos:wiki and /mos:dashboard graph view. The cool surface is the precedent trail visible on hover -- you click a phase node, you see the four-voice consultation that decided its scope. That is the moat: not just edges produced, but the reasoning that produced them, navigable.

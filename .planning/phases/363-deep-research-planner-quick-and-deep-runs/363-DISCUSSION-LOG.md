# Phase 363: Deep Research Planner - quick and deep research runs - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-09-29
**Phase:** 363-deep-research-planner-quick-and-deep-runs
**Areas discussed:** Learn from open source, PWS as the planner's brain, Quick vs deep line, Plan review and approval
**Mode:** advisor (calibration minimal_decisive, plain-language framing); four parallel research agents, notes in `research/`

---

## Framing (before discuss)

At promotion the navigator restated the intent: "the initial intent of it was building it as a deep research planner. deep and quick runs." SEED-097 had drifted to a "research designer" centered on approval mode and MOS-CANVAS perspectives. At discuss start: "use opensource projects that claim to do similar, learn from them on how to build research and apply learning to what I want to achieve using the strategic PWS methodologies."

## Learn from open source

| Option | Description | Selected |
|--------|-------------|----------|
| Learn, rebuild natively | Borrow patterns, MIT/Apache prompts and open data with attribution; no runtime dependency | ✓ |
| Wrap one as a sidecar | gpt-researcher or local-deep-research via MCP; faster demo, bypasses Part 8 and approval | |

**User's choice:** "we need just to learn, the hats, reverse salient, scenario analysis, trending to the absurd are better ways to push research. and need to be context dependent. theo can assist. and the relevant command can transition to build a research plan. knows unknowns 5 whys etc..."
**Notes:** This also answered the PWS area and reshaped the phase (D-02).

## PWS as the planner's brain

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, lock it | PWS commands hand off to one shared plan-builder; Theo picks method and sequence | |
| Yes, and PWS can start it | Same, plus the planner picks which PWS command to run first | |
| Not quite | Correction | ✓ (refinement) |

**User's choice:** "according to relevance the commands become research planners for the user. it's a new way to use them."
**Notes:** Locked as D-02: the commands themselves gain a research-planner mode (not an end-of-command handoff); one shared engine underneath; relevance plus Theo (anchored reads, handles only) chooses which commands are offered. Research showed Theo holds problem-type -> framework edges and FEEDS_INTO order reliably, but process steps only for Scientific Roadmapping and Scenario Planning, so commands supply local templates.

## Quick vs deep line

| Option | Description | Selected |
|--------|-------------|----------|
| Split by loop + trigger | Quick one pass + evidence card, room may start under a standing policy; deep loops with counterevidence, report + ledger, navigator only; quick escalates | ✓ |
| One engine, two settings | Same pipeline, quick = depth 1, navigator-only | |

**User's choice:** Split by loop + trigger (recommended).

## Plan review and approval

| Option | Description | Selected |
|--------|-------------|----------|
| Research grant, 2 lifetimes | Deep: F.6 editable plan per run, F.3 extend/stop; Quick: F.0 standing scoped expiring grant; grant never authorizes filing | ✓ |
| Exact string, every query | Today's find-analogies / dominant-designs pattern for both modes | |

**User's choice:** Research grant, 2 lifetimes (recommended).

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, grant = the ask | A scoped, visible, revocable grant satisfies the ask-before-web-research rule; outside it asks again | ✓ |
| No, always ask | Ambient quick becomes plan-only | |

**User's choice:** Yes, grant = the ask (recommended). Recorded as D-05.

## Navigator additions during write-up

- "remember mindrian pushes users to ask questions he doesn't know to ask. the frameworks do this in structured ways and we need to operate them in accordance and appropriateness to the problem type context and gates [and] user needs we understand. frameworks are basically asking questions as an agentic system." -> D-00 governing principle.
- "also such research might scoop opportunities to be filed." -> D-07.

## Claude's Discretion

Plan schema and module placement; which ledger patterns land beyond the required ones; first-wave command set beyond the D-06 minimum; journal-quality/retraction flags timing; Jev vs BM25 passage filtering.

## Deferred Ideas

Theo-side step authoring (Theo SEED-015 companion); SEED-098; remaining SEED-097 perspectives as research-mode fixtures; optional portfolio synthesis; wrapped OSS agent as offline benchmark.

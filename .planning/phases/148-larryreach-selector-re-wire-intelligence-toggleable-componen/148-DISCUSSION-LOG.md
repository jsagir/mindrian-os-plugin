# Phase 148: LarryReach Selector Re-wire (Intelligence + Toggleable Components) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-06-08
**Phase:** 148-larryreach-selector-re-wire-intelligence-toggleable-components
**Areas discussed:** Component-to-reach mapping, Brain review behavior, File these findings behavior, Hats go-deep handling, Help entry ("what can I help you with")

---

## Component-to-reach mapping

| Option | Description | Selected |
|--------|-------------|----------|
| Select one, fire it | Pick ONE engine, run now; compose-a-chain separate (ordered-checkbox) | |
| Multi-select / queue | Check several engines, run as a batch | ✓ |
| You decide (per archetype) | Map each reach to its archetype per research Section 10 | |

**User's choice:** Multi-select / queue
**Notes:** The navigator's mental model is "check several, act on the batch." Compose-a-chain stays available on demand via the ordered-checkbox.

---

## Brain review behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-review current findings | Surfaces contradictions + suggests next framework chain, no prompt | ✓ |
| Ask 'review what?' first | Brain asks scope before reviewing | |

**User's choice:** Auto-review current findings
**Notes:** Brain is the outside review (Canon Part 9 external cortex); typed packet only, zero egress.

---

## File these findings behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Last output, quick confirm | File most recent output with a y/n confirm | |
| Pick which findings, then file | Multi-select which findings, then write | ✓ |
| File silently, report | File immediately, no confirm | |

**User's choice:** Pick which findings, then file
**Notes:** Consistent with the multi-select model; the multi-select submit is the confirm.

---

## Hats go-deep handling

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm first, flagged heavy | Quick confirm + "go deep" row marker; personas cached per room | ✓ |
| Just fire, flagged heavy | No confirm, marked heavy | |
| Depth sub-selector | Ask shallow/deep first | |

**User's choice:** Confirm first, flagged heavy
**Notes:** Hats is a research spin (~1 min); confirm copy + "go deep" marker make the heaviness visible.

---

## Help entry ("what can I help you with")

| Option | Description | Selected |
|--------|-------------|----------|
| Cold-room / no-signal render | Leads the tier_0 render; intelligence reaches lead once there is signal | ✓ |
| Standing option, always | Always present alongside File / Brain / Free-Text | |
| Both | Leads cold-room AND a standing option | |

**User's choice (surface point):** Cold-room / no-signal render

| Option | Description | Selected |
|--------|-------------|----------|
| Type intent, matched reaches | Navigator types intent; matched via command-resolver + JTBD rank | ✓ |
| Grouped lane menu | Browsable command groups (Phase 152 territory) | |

**User's choice (matching):** Type intent, matched reaches
**Notes:** Added by the user mid-discussion. Thin entry-point version is in 148 scope (reuses the Phase 122 resolver); the full grouped help-page redesign stays Phase 152.

---

## Claude's Discretion

- Cold-room tier_0 base set keeps the canon fallback (Run Methodology / Reformulate / Free-Text) beneath the "what can I help you with" lead.
- The standing trio (File + Brain review + Free-Text-last) renders at every selector render regardless of mode/tier.
- The "go deep" marker uses the existing 12-glyph UI-ruling vocabulary (no new glyph); final glyph is the planner's pick.
- Multi-select batch submit uses the AskUserQuestion multiSelect primitive; no bespoke widget.
- recommended-marker (0.70/0.15 gate) coexists with multi-select: recommended reach pre-highlighted, navigator can still check others.

## Deferred Ideas

- Full /mos:help page redesign + grouped lane menu - Phase 152.
- Path A standalone keyboard cockpit (Ink + clack + ordered-checkbox) - Phase 154.
- De Stijl color-block painting - Phase 151/152.
- Hebrew / RTL bundle - Phase 153.
- Ask-Tell keyboard slider - Phase 154.
- interaction_archetype rollout across ~80 commands - Phase 152.

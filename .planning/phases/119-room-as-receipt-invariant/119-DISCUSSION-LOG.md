# Phase 119: room-as-receipt-invariant -- Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 119-CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-05-16
**Phase:** 119-room-as-receipt-invariant
**Areas discussed:** Trigger condition, Inferred name strategy, Failure / ambiguity handling, Post-creation correction path
**Discuss-phase trigger:** /gsd:discuss-phase 119 invoked on the 2026-05-05 stub after the 2026-05-16 dual-graph review verdict execution closed (commit 21d0ad26) and v1.13.0-beta.17 shipped state was confirmed

---

## Area 1 -- Trigger condition

### Q1: When exactly should the auto-create fire?

| Option | Description | Selected |
|---|---|---|
| On Phase 117's first-material detector only | Reuse Phase 117's existing trigger. Cleanest reuse. Does NOT auto-create from venture-shaped prompts that have no upload. | ✓ |
| Hybrid -- 117's detector + dual-path 'venture-shaped prompt' detector | Auto-create fires on EITHER first material upload OR first venture-shaped prompt. Two trigger sources, one downstream action. (RECOMMENDED in question; user picked option 1 instead.) | |
| Only on venture-shaped prompts | Material uploads stay with 117 alone. Auto-create fires only on prompts. Cleaner separation but loses the upload pathway. | |

**User's choice:** "Phase 117 detector only" (D-01)
**Notes:** User picked option 1 over the recommended hybrid. Signals preference for sharp scope boundaries. Implication: no new detector code; pure sibling-side-effect hook on Phase 117's existing trigger. Estimated effort drops accordingly.

### Q2: If user types a venture prompt with no upload, what's the experience?

| Option | Description | Selected |
|---|---|---|
| Silent -- conversation continues, no nudge, no room | Pre-119 behavior preserved. Pure "rooms are receipts" framing. | |
| Gentle nudge -- Larry suggests an upload or /mos:new-project | After ~3-5 venture-shaped turns, Larry surfaces F.1 selector. | ✓ |
| Auto-create on Nth venture-shaped turn even without upload | Auto-create after N turns. Contradicts D-01 unless treated as a synthetic material event. | |

**User's choice:** "Gentle nudge" (D-02)
**Notes:** Adds a small surface area on top of the D-01 strict-trigger decision. The nudge respects D-01 (doesn't auto-create from prompt alone) but gives the user an explicit on-ramp. N defaults to 3, configurable. Reuses Phase 115's dual-path "venture-shaped" signal.

---

## Area 2 -- Inferred name strategy

### Q3: How does the auto-create name the project at creation time?

| Option | Description | Selected |
|---|---|---|
| LLM call on first material text | ~3-5 word descriptive name. Richer + slower + ~$0.001/call. | |
| Filename-derived with fallback to timestamp | Use filename for uploads; fallback to 'venture-{TS}' otherwise. Deterministic, fast. (RECOMMENDED in question; user picked option 4 instead.) | |
| Always template-based 'venture-{YYYY-MM-DD-HHMM}' | Never try to be clever. Cleanest, ugliest. | |
| Ask user retroactively after first round completes | Auto-create with placeholder; surface F.1 selector after MVA pipeline completes. Defers the naming decision. | ✓ |

**User's choice:** "Ask user retroactively after first round completes" (D-03)
**Notes:** User picked the deferred-decision option over the deterministic-fast option I recommended. This reframes the room as appearing CHEAPLY (placeholder + skeleton) and the NAMING as a high-context decision after the user has seen value. Aligns with "rooms are receipts not entry points" -- the receipt appears immediately; the receipt's title is decided after the user knows what they're naming.

### Q4: What's the placeholder name pattern at auto-create time?

| Option | Description | Selected |
|---|---|---|
| 'untitled-{YYYY-MM-DD-HHMM}' | Timestamped placeholder. Unambiguous, never collides. (RECOMMENDED in question; user agreed.) | ✓ |
| 'untitled-{N}' where N is auto-incremented | Sequential. Simpler to read but requires checking existing room names. | |
| Use a UUID or short hash | Guaranteed unique but cryptic. | |

**User's choice:** "'untitled-{YYYY-MM-DD-HHMM}'" (D-04)
**Notes:** Aligned with the recommendation. Directory becomes `rooms/untitled-2026-05-16-1845/`.

---

## Area 3 -- Failure / ambiguity handling

### Q5: If Phase 117's auto-explore returns nothing useful (thin material), does Phase 119 still create the room?

| Option | Description | Selected |
|---|---|---|
| Create the placeholder room anyway with skeleton scaffolding | Phase 119's job is to make the user's first action durable. Larry acknowledges thinness honestly. (RECOMMENDED in question; user agreed.) | ✓ |
| Defer room creation until material accumulates | Cleaner -- no empty rooms -- but breaks the "room as receipt" invariant for thin-material sessions. | |
| Surface F.1 selector: create room, keep talking, or skip | User-respectful but adds friction that contradicts the "auto-create as side effect" invariant. | |

**User's choice:** "Create the placeholder room anyway with skeleton scaffolding" (D-05)
**Notes:** Honors the invariant ruthlessly. Even thin material produces a receipt; Larry's voice does the honesty work ("I made a room around this -- mostly empty until we have more"). Skeleton = minimal STATE.md + MINTO.md + empty section folders with ROOM.md identity files (Canon decision 15).

---

## Area 4 -- Post-creation correction path

### Q6: Should the first F.1 selector after MVA completes include an 'undo / discard room' option?

| Option | Description | Selected |
|---|---|---|
| Yes -- include 'discard room' as one F.1 option | Surfaces undo at the moment user has most context. Cascade rollback: room.db + STATE.md + MINTO.md + section folders. (RECOMMENDED in question; user agreed.) | ✓ |
| No -- rename/keep only at first F.1; user discards later via /mos:rooms archive | Simpler first-touch UI but adds friction for immediate-discard cases. | |
| No first F.1 -- room creation is silent | Maximum "side effect" framing but user may not realise the room was created. | |

**User's choice:** "Yes -- include 'discard room'" (D-06)
**Notes:** Full F.1 selector set is: [name with LLM-suggested] / [type your own] / [keep as untitled] / [discard room]. Post-first-F.1, the existing `/mos:rooms rename` and `/mos:rooms archive` commands handle later edits.

---

## Closing decision

| Option | Description | Selected |
|---|---|---|
| Ready for context | Write 119-CONTEXT.md + DISCUSSION-LOG.md with the six decisions, then commit. Plan-phase next. (RECOMMENDED in question; user agreed.) | ✓ |
| Explore more gray areas | Surface additional implementation questions before writing CONTEXT.md. | |

**User's choice:** "Ready for context"

---

## Claude's Discretion (passed to planner)

- Exact value of N in D-02 (venture-shaped-turn nudge threshold) -- defaults to 3, planner picks in 2-5 range based on telemetry if available
- Phase 117 sibling-hook implementation pattern (event subscription vs direct call vs shared dispatcher) -- researcher investigates `lib/core/navigation/` for matching pattern
- F.1 selector layout across CLI / Desktop / Cowork -- inherits standard tri-surface adaptation from Phase 88.2
- LLM-suggested-name source model -- planner picks Haiku 4.5 or similar fast model (~$0.0005/call)

## Deferred Ideas (captured for future phases)

- Sub-room auto-budding (SEED-001; defers to v1.14.0)
- Auto-create from prompts-without-material directly (D-01 explicitly rejects for v1.13.0; revisit in v1.14.0 if user demand grows)
- LLM-suggested name AT creation time (D-03 chose retroactive; revisit if retroactive UX feels too slow)
- Cross-room "you said something similar in Room X" -- never builds; Canon Part 8 forbids cross-room aggregation

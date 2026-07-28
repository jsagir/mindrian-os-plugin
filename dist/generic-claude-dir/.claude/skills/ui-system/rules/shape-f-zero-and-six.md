---
name: shape-f-zero-and-six
description: >
  Shape F.0 (Mini Decision Gate) and Shape F.6 (Plan Review Round) sub-shape
  documentation. Both shipped in Phase 88.2. Surface them at queryable
  granularity so the skill auto-loader can pull this rule independently of
  the full SKILL.md when only F.0 or F.6 is in scope. Part of the current
  Shape F catalog as of Phase 121.5 (additive expansion reserved for future
  lens-aware variants).
---

# Shape F.0 + Shape F.6 -- Sub-shape Documentation

This rule documents the two Shape F sub-shapes that landed in Phase 88.2 and are
shipped but were missing from `skills/ui-system/SKILL.md` until the Phase 121.5
reconciliation pass. The five original sub-shapes (F.1 through F.5) are
documented in SKILL.md §2 and remain unchanged. F.0 is the lightweight
binary-or-trinary gate that fires BEFORE the larger Shape F slate; F.6 is the
Plan Mode wrap that closes a planning round (and, per Phase 101-01, is also the
JTBD-aware variant of Shape F selected by the dispatcher when a JTBD signal is
set).

The Shape F catalog as of Phase 121.5 carries seven sub-shapes (F.0 / F.1 / F.2
/ F.3 / F.4 / F.5 / F.6). This is the current catalog; future v1.14.0+ work may
add lens-aware variants (the dual-graph proposal under review 2026-05-16 may
introduce ASSOCIATION_LENS / TRANSITION_LENS lens-class variants).

---

## Shape F.0 -- Mini Decision Gate

**Shipped:** Phase 88.2 (Plan 88.2-05 / UISEL-88.2-07).

**Implementation:** `lib/hmi/shape-f0-renderer.cjs` (pure CJS, node built-ins
only, zero new runtime deps).

**Purpose.** Tiny binary or trinary decision gate. Lighter than F.1 (which
carries 3-5 options). F.0 is the minimum-viable gate when the navigator only
needs a yes / no / defer call before the larger selector slate fires.

**When to use.** A surface needs a confirmation BEFORE producing the larger F.1
selector. Most common pairing: F.0 (accept this recommendation?) -> F.1 (now
choose next move). Used for binary commits that need an explicit edge produced
even when the navigator wants to keep moving.

**Verb set.** EXACTLY 3 verbs (closed vocabulary, shipped value):

  - Approve  -- cascade now (collapses to Run Methodology or whatever the
                recommendation called for)
  - Reject   -- capture reason -> REJECTED_BECAUSE typed edge (graph data, no
                silent dismiss path -- Canon Part 4)
  - Defer    -- queue for milestone audit (Defer verb)

**No Free-Text slot.** F.0 omits Free-Text by design. The Reject path captures
the reason as a REJECTED_BECAUSE edge property, which preserves free-form intent
without expanding the verb vocabulary. F.0 ALWAYS produces a typed edge; there
is no silent dismiss path.

**Header format.**

```
[filled-square] [CONTEXT] - MINI GATE             - decision gate
[right-triangle-filled] {short binary or trinary question}
```

Single-line ASCII border (the visual sub-decision cue). Persona-agnostic
visually (D-AMEND-04 from Phase 88.2 CONTEXT.md).

**Keyboard.** Standard F-family keyboard. up-arrow / down-arrow (or J / K) to
navigate, Enter to select, `?` to inspect, Esc to cancel.

**No RECOMMENDED marker.** F.0 is itself the recommendation surface. Marking
one of the three options would double-cue. RECOMMENDED markers are an F.1
through F.5 concept.

**State-update hook.** Append to STATE.md Decisions section with the chosen
verb + a tiny one-line context snapshot (F.0 gates are lightweight; do NOT
bloat Decisions with full context). Typed edge `(navigator) -[CHOSE_MINI
{verb}]-> (recommendation-node)` lands in the local graph. Reject additionally
writes REJECTED_BECAUSE with `{reason, rejected_at, parent_decision_id,
actor_id?, confidence_self_report?}` via Phase 109 `logEvent` (eventType
`selector_rejection_captured`).

**Canon refs.** Part 3 (the gate), Part 4 (rejection is data), Part 8 (reason
text is graph-local; never egresses to Brain).

---

## Shape F.6 -- Plan Review Round

**Shipped:** Phase 88.2 (Plan 88.2-06 plan-review variant) + Phase 101-01
(JTBD-aware Next Move variant).

**Implementation:** Two co-existing renderers at collision-safe paths:
  - `lib/hmi/shape-f6-plan-review-renderer.cjs` -- Plan Review Round variant
    (Phase 88.2-06; double-line border for structural distinction from F.0).
  - `lib/hmi/shape-f6-renderer.cjs` -- JTBD-aware Next Move variant (Phase
    101-01; falls through to F.1 if JTBD taxonomy entry missing).

The umbrella `F` branch in `lib/hmi/selector-dispatcher.cjs` (`F_SUBSHAPES =
['F.0', 'F.1', 'F.2', 'F.3', 'F.4', 'F.5', 'F.6']`) routes to the Phase 101-01
JTBD-aware module when `jtbd` is non-null; explicit `requestedShape: 'F.6'`
(string) routes to the plan-review renderer.

**Purpose.** Plan Mode wrap. When the navigator has been in a planning surface
(e.g. after a methodology session that produced a plan), F.6 closes the round
with an explicit Review verb selection BEFORE returning to Plan vs Build mode.
The JTBD-aware variant produces a JTBD-anchored Next Move slate sourced from
`lib/hmi/jtbd-taxonomy.json` `next_move_verbs`.

**When to use.**
  - End of a plan-producing methodology session (Plan Review variant).
  - Any Shape F surface where a non-null JTBD is in play and the renderer
    should produce a JTBD-aware Next Move slate (JTBD-aware variant).

**Verb set.** 3-5 verbs. Plan-review typical slate:

  - Approve plan        -> Synthesize (plan becomes confirmed artifact;
                            review_status proposed -> confirmed, Canon Part 9)
  - Revise plan         -> Reformulate (re-runs the planning verb with edits)
  - Replan from scratch -> Reformulate from a fresh seed
  - Defer review        -> Defer (milestone-audit TodoWrite row)
  - Free-Text           -> Free-Text routes to interpretation

JTBD-aware variant draws verbs from the taxonomy entry's `next_move_verbs`.

**Header format.**

```
[filled-square] [CONTEXT] - PLAN REVIEW           - decision gate
[down-triangle] LOCAL   / BRAIN   / SIGNAL
[right-triangle-filled] Review this plan:
```

Double-line border on the Plan Review variant (parent shape -- structural
distinction from F.0's single-line border).

**Keyboard.** Standard F-family keyboard (inherits from F.1 per Phase 101-01
D-01).

**State-update hook.**
  - On Approve, plan is promoted `review_status: proposed -> confirmed` (Canon
    Part 9 truth-state machine).
  - On Revise/Replan, original plan stays `proposed` and a new revision edge is
    created.
  - On Defer, a milestone-audit TodoWrite row queues the review.
  - Plan-review variant additionally writes REVIEWED typed edges per question
    position with `{round_id, position, latency_ms, was_decoy, response,
    confidence_self_report}` via Phase 109 `logEvent` (eventType
    `selector_response`). Round close emits a `f6_round_completed` event.

**Decoy ethics.** The Plan Review variant runs decoys (interleaved per
position) with a debrief Shape A action report at round-end that discloses
which questions were decoys (round-state `room/decisions/decision-decoy-
ethics.md`).

**Canon refs.** Part 3 (the gate), Part 9 (truth states), Part 4 (every
response is a typed edge), Part 8 (response text is graph-local).

---

## Sub-shape catalog notes

The Shape F catalog as shipped through Phase 88.2 carries seven sub-shapes
(F.0 / F.1 / F.2 / F.3 / F.4 / F.5 / F.6). This is the current catalog as of
Phase 121.5. The catalog is expandable, not foreclosed: lens-aware variants
(e.g. the dual-graph ASSOCIATION_LENS / TRANSITION_LENS work under review
2026-05-16) may add future Shape F sub-shapes in v1.14.0+. SKILL.md treats
today's seven sub-shapes as the shipped vocabulary, not a terminal set.

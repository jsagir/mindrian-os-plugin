---
phase: 187
slug: statusline-navigator-cockpit
milestone: v1.15.0 "Cure Under-Invocation"
status: in-progress
canon_parts: [3, 5, 9, 10, 12]
cirs_relationship:
  surfaces_touched: [modified]
  detail: "Modifies the statusline renderer (scripts/statusline-*). Adds no invocable surface; mints no reach/edge/node; opens no Brain wire. The room-health tier reuses the existing /mos:doctor health signal (LOCAL cache), it does not call doctor on the hot path."
  spine_consumed: none
  gate_impact: "The statusline becomes a one-glance trigger surface (the Hooked trigger phase) governed by the anti-Dealer invariant."
navigator_locked: 2026-06-28
---

# Phase 187 - Statusline navigator cockpit

## Why this phase exists

Co-designed with the navigator (Jonathan Sagir, 2026-06-28) under the Phase 121.5 statusline
co-design rule (no solo pick). The existing statusline shows a room name + a context percent as a
vague progress bar serving the OPERATOR. The navigator directed it be rebuilt to serve the
NAVIGATOR, analyzed through JTBD + the Hooked model (Facilitator posture, per canon entry 31 which
retired the Hooked gate but KEPT the Manipulation Matrix).

## The locked contract

The full spec is `docs/STATUSLINE-CONTRACT.md` (LOCKED 2026-06-28). Summary:

- FOUR TIERS (hierarchy, not a pile): (1) Identity/trust metadata - Mindrian glyph + Voice
  Signature glyph + Brain glyph (passive, NOT a hook); (2) Orientation/integrity - room + health
  emoji (trigger only when degraded); (3) Action - "Next: <move>" (the core JTBD / MVA cue);
  (4) Risk trigger - "Ctx <n>%" (fires at the cliff).
- EMOJI color (host-independent; same finding as Phase 182.1: this host strips ANSI). Thresholds:
  green <50, orange 50-79, red >=80.
- REORDER-AT-CLIFF: at >=80% the line promotes "file this insight to the room before it compacts"
  to the hero slot (Part 10 rooms-are-receipts; the cliff is the moment to convert volatile insight
  to durable memory).
- ROOM-HEALTH + doctor corrective trigger: warn/broken health renders "-> run /mos:doctor --fix",
  escalated POST-UPDATE (the highest-drift moment: install-cache / scaffold / statusline-visibility
  incident family).

## The anti-Dealer product invariant (NORMATIVE)

INV-SL-1..5 in the contract. The load-bearing ones:
- INV-SL-2: primary success metric = % of statusline exposures that lead to a REAL ADVANCING ACTION
  within the session. Time-on-line / glance-count / interaction-rate are FORBIDDEN optimization
  targets (Gauge 2 transfer-per-invocation pointed at the line; entry-31 welded two-gauge).
- INV-SL-4: "a glance that leads to no move is the line failing." Every non-healthy state MUST carry
  its adjacent one-tap fix, or it is a contract violation.

## Scope (plans)

- 187-01: read the current statusline script + its stdin session-data shape; map real signals to
  tiers (context %, room, health). Honestly name any signal the host does not expose.
- 187-02: implement the four-tier renderer + four states + reorder-at-cliff + emoji thresholds.
- 187-03: wire room-health from the existing doctor/health LOCAL cache (reuse, no hot-path call);
  the post-update escalation.
- 187-04: bind the Tier-1 Voice Signature glyph to the current move (depends on Phase 182.1 detector).
- 187-05: the LOCAL, Part-8-clean measurement hook for INV-SL-2 (exposures -> advancing action).

## Canon

No amendment required: this is an APPLICATION of Parts 3/5/9/10/12 (decision gate, evidence-by-
context, memory locality, conversation-as-product, Voice Signature). Does not touch the entry-31
self-binding clause. Part 8 clean (LOCAL only). No em-dashes.

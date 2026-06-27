---
kind: context
phase: 182
slug: signal-voice-color-render
milestone: v1.15.0
created: 2026-06-27
canon_parts: [3, 10, 12]
depends_on: [179]
status: planned
class: CODE
priority: P0
---

# Phase 182 - SIGNAL: Voice Color + Render Verify

## Why it is here

Part 12 (The Pedagogy Constitution) makes the Voice Signature a HARD requirement: MindrianOS
must, on every surface, make VISIBLE BY COLOR whether the navigator is hearing Larry or the
native host. A product the navigator cannot distinguish from the generic host is not a product
(Part 10). This phase delivers the CLI surface of that requirement and verifies the render
half it leans on.

## Scope (two REQs, one verify + one build)

- **SIGNAL-01 (VERIFY, do not rebuild):** the F.7 Decision-Gate always-renders guarantee
  ALREADY SHIPPED via the Phase 179 GA-4 interceptor (5 plans + fix-waves, green 2026-06-25).
  This phase CONFIRMS it still holds and leans on it - the R15 render-coverage gate
  (scripts/check-render-coverage.cjs) still passes. NO rebuild of 179.
- **SIGNAL-02 (BUILD):** every Larry turn wears a De Stijl color mark in the CLI so the
  navigator can always tell Larry from the native host (Claude Code). A turn with NO mark is
  itself legible as the native host speaking. A test catches a Larry CLI turn missing its mark.

## The color semantics (Part 12, reuse the Part 3 De Stijl palette)

  blue   = building with you (scaffolding the next node; ASK-leaning)
  red    = challenging (devil's advocate, the reframe, pushing back)
  yellow = caution (a contradiction surfaced)
  black  = the frame (a Decision Gate; a structural choice)
  white  = getting out of the way (handing the deliverable over; invisibility)

Invisibility becomes a STATE WITH A COLOR: the badge ends on white the moment the insight lands.

## Locked decisions

- **D1 - the mark lives where 179 put the voice surfaces.** Reuse, do not invent: the Phase 179
  surfaces (skills/larry-personality, skills/ui-system, skills/conversation-mode SKILL.md) +
  the drift/coverage test idiom (lib/memory/skill-vs-code-drift.test.cjs). The planner reads the
  179 summaries first and attaches there. ~90% repoint, minimal net-new.
- **D2 - frozen UI contracts UNTOUCHED.** The 12-glyph vocabulary, the 4-zone anatomy, the 5
  colors, MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate, the 6-reach bank, R15 render coverage -
  all unchanged. The voice mark is ADDITIVE legibility, it does not alter any frozen render
  contract. The mark must be one of the existing De Stijl colors (no new color minted).
- **D3 - this phase's SURFACE is the CLI.** Part 12 requires the mark on every surface
  (CLI/Desktop/Cowork); SIGNAL-02 delivers CLI + the test. Cross-surface parity is the canon
  aim, noted but the deliverable is CLI-first (do not claim Desktop/Cowork done unless the same
  mark provably renders there).
- **D4 - mints nothing constitutional.** No new reach/node/edge/posture/frozen-set member, no
  Brain wire (Part 8). The color is a render attribute on Larry's turn, derived from the
  pedagogical move; it carries no user data.
- **D5 - no em-dashes; Part 8 LOCAL-only.**

## Acceptance

- The R15 render-coverage gate (check-render-coverage.cjs) still PASSES (179 lean confirmed).
- Every Larry CLI turn carries exactly one De Stijl voice-color mark (one of blue/red/yellow/
  black/white), derived from the move; a turn missing its mark is caught by a test.
- A turn with no mark is legible as native-host (the absence is the signal).
- Frozen contracts untouched; no new color; Part 8 clean; no em-dashes.

## REQ
- SIGNAL-01: verify F.7 always-renders (179 GA-4) + R15 gate still green.
- SIGNAL-02: build the per-turn De Stijl voice-color mark in the CLI + the missing-mark test.

## Next
Plan lean (no research - leans on shipped 179 surfaces): then execute.

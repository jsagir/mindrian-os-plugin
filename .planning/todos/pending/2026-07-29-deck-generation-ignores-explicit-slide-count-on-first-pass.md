---
created: 2026-07-29T00:00:00.000Z
title: Deck generation does not honor an explicit slide-count request on the first pass
area: deck-generation
files:
  - skills/mos-deck-engine
  - skills/deck
  - scripts/generate-deck.cjs
  - commands/deck.md
  - data/mva-deck-template.html
---

## Problem

Live intern QA (2026-07-28 check-in call, filed in
`~/MindrianRooms/jonathan-sagir/team/2026-07-05-interns-homework-tracker.md`): David explicitly
asked Mindry for a 3-slide presentation (an IND-class worksheet exercise, explicit constraint
stated up front). The first generation pass produced 7 slides instead. It was only corrected
after David told it, and the correction rebuilt the deck as a new copy rather than editing the
existing one in place.

This is a confirmed bug, not a preference mismatch: the user stated an unambiguous numeric
constraint ("three slides") and the first-pass output ignored it. Whatever governs slide count
in `skills/mos-deck-engine` / `scripts/generate-deck.cjs` / `data/mva-deck-template.html` is
likely defaulting to a template length rather than reading the explicit count out of the
request, though this has not yet been traced to the exact site - not investigated this session,
only reproduced by the live report.

## Solution

1. Trace where slide count is actually decided: `skills/mos-deck-engine`'s prompt/rubric,
   `scripts/generate-deck.cjs`'s generation call, and `data/mva-deck-template.html`'s fixed
   section count are the three candidate sites (not yet narrowed to one).
2. Confirm whether an explicit numeric constraint in the user's request is even passed through
   to the generation prompt today, or silently dropped/overridden by a default template length.
3. Fix so an explicit slide-count constraint is honored on the FIRST pass, not just correctable
   after the fact.
4. Add a regression test (`tests/test-deck-*.cjs` already exists as a pattern to extend) asserting
   a requested slide count produces exactly that many slides on a single generation call.

Not yet scoped into a phase - this is a narrow, single-behavior fix, lower severity than the
onboarding-bottleneck cluster (see SEED-078), but a real, live-reported, first-pass instruction-
following miss worth fixing independently of any larger deck-engine work.

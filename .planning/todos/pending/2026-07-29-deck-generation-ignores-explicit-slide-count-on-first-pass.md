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
status: deferred
resolution: "Re-deferred by plan 366-24 (2026-10-02): the fix needs at least two sites (the mos-deck-engine slide architecture prompt and the deck command door that passes the request, plus the fixed 10-slide renderer), outside 366-24's one-site rule."
---

## Problem

Live intern QA (2026-07-28 check-in call, filed in
the navigator's team room (interns homework tracker, 2026-07-05)): An intern explicitly
asked Mindry for a 3-slide presentation (an IND-class worksheet exercise, explicit constraint
stated up front). The first generation pass produced 7 slides instead. It was only corrected
after the intern told it, and the correction rebuilt the deck as a new copy rather than editing the
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

## Re-deferred (2026-10-02, plan 366-24, Phase 366 close-out)

Traced the three candidate sites:

- `scripts/generate-deck.cjs` renders a fixed 10-slide deck (hard-coded slide blocks, the
  closing log line says `Slides: 10`); it takes only a room path and `--output`, so it has no
  slide-count input at all.
- `skills/mos-deck-engine/SKILL.md` "Slide Architecture (10-12 slides)" gives the model a fixed
  eleven-row slide list and no instruction that an explicit count in the request overrides it.
- `data/mva-deck-template.html` is a template; it does not decide the count.

The reported first pass (7 slides for a 3-slide request) matches neither the renderer (10) nor
the architecture (10 to 12), so it came from the model path: the deck command door
(`commands/deck.md` / `skills/deck/SKILL.md`) does not carry a requested count into the engine
prompt, and the engine prompt has no override rule. An honest fix touches at least two sites
(the engine's slide architecture, the deck door that passes the request through, and, for the
scripted render, a `--slides N` option on generate-deck.cjs), and the model path cannot be
proven by a deterministic single-call test. That is outside this plan's one-site rule, so the
todo stays pending for a small deck phase or a /gsd-quick that owns the door, the engine prompt
and the renderer together.

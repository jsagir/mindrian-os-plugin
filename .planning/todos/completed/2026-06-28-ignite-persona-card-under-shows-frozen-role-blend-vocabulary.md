---
created: 2026-06-28T11:04:09.717Z
title: ignite persona card under-shows frozen role_blend vocabulary
area: ignite
version_found: v1.15.0-beta.9
files:
  - commands/ignite.md (Gate B1 -- Door 1 persona pick)
  - lib/core/persona-override.cjs (ROLE_BLEND_KEYS frozen vocabulary)
---

## Problem

Found while live-testing `/mos:ignite` in v1.15.0-beta.9. Three related defects in
the Gate B1 arrival card (Door 1 persona pick):

1. **Mentor is dropped.** The B1 doctrine lists SIX personas (researcher, student,
   founder/business, operator, investor, domain_expert) but the frozen vocabulary
   `ROLE_BLEND_KEYS` in `lib/core/persona-override.cjs` holds SEVEN keys -- it
   includes `mentor`. The ignite Door 1 card has no mentor option, so a navigator
   can never select a frozen-legal role. The card under-shows the frozen set by one.

2. **4-option cap forces silent truncation.** `AskUserQuestion` renders at most 4
   options per card. Even the 6 documented personas cannot fit in ONE card, so they
   get collapsed behind the "Other" row. This is exactly the silent-degrade the
   render-coverage gate (Canon Part 11 R15 / SEED-021 "no card, no picture") is
   meant to kill -- the card fires, but the persona vocabulary is truncated. Surfaced
   in the test when the navigator asked "why don't I see the student?". Required a
   second card to expose the remaining personas.

3. **Portfolio Manager requested as a new persona.** Navigator asked for a
   "Portfolio Manager" door. No matching frozen `role_blend` key exists; closest
   alias is `investor`. Logged as a vocabulary-EXTENSION candidate for Canon review,
   NOT an inline mint (role_blend is a frozen single-axis vocabulary that threads
   into USER.md, persona-variant greetings, and blueprint-family routing -- a new
   key must be ratified by the Canon owner, not improvised by Larry).

## Solution

TBD -- candidate directions:
- Add the missing `mentor` option so the card matches the 7 frozen keys.
- Resolve the 4-option cap: paginate the persona pick (a "more personas..." row
  that fires a second card), or split into a two-step door selector, so ALL frozen
  personas are reachable without relying on free-text "Other".
- For Portfolio Manager: decide alias-to-investor vs. extend `ROLE_BLEND_KEYS`
  (Canon vocabulary decision). If extended, propagate to persona-override.cjs,
  USER.md role_blend schema, persona variants, and blueprint-family mapping.
- Add a coverage test asserting the B1 card options are a subset/superset-consistent
  with `ROLE_BLEND_KEYS` so the card and the frozen vocabulary can't drift again.

## Closed by Phase 267.2 Plan 04

Folded into Phase 267.2 (W1's router hands some outcomes into `/mos:ignite`, and Door 1 is the
first card a routed user hits). Closed 2026-09-03. All three defects answered:

1. **Mentor dropped -- FIXED.** `mentor` is now reachable at Door 1: `commands/ignite.md`'s
   persona pick fires as a TWO-STEP `AskUserQuestion` sequence (decision D-I), and the
   `Backing or guiding someone` branch of step 2 offers `Mentor` with
   `role_blend={mentor:1.0}`, `blueprintFamily=exploration` (decision D-H -- a mentor guides
   someone ELSE's work rather than owning a venture of their own, the same reason
   `domain_expert` already sits in exploration).

2. **4-option cap forced silent truncation -- FIXED.** Door 1 no longer renders all personas in
   one card. Step 1 ("Who are you arriving as?") offers exactly 4 arrival buckets; step 2,
   narrowed by the step-1 pick, offers at most 3 role options per branch. Both steps stay
   inside `AskUserQuestion`'s 4-option render cap (decision D-I), so all 7 frozen
   `ROLE_BLEND_KEYS` are reachable without relying on free-text "Other". The Tri-Polar
   card-incapable fallback line was extended in lockstep (same PR) to list all 7 personas plus
   CV and hypothesis, so the card path and the card-incapable path stay in agreement
   (PATTERNS.md A9: "fix both or they drift"). Guarded going forward by
   `tests/test-267-2-ignite-persona-coverage.cjs`, which parses both Door 1 steps and the
   Tri-Polar line and compares them against the live `ROLE_BLEND_KEYS` array at run time --
   never an inline restatement of the 7 names, so this cannot silently re-drift.

3. **Portfolio Manager -- NOT minted, carried forward as an open Canon question (decision
   D-J).** Extending `ROLE_BLEND_KEYS` is a five-file order-sensitive change
   (`lib/workflow/f-selector-ranker.cjs`'s per-key ASK/TELL seeds with a declaration-order
   tie-break, `lib/core/shallow-doc-parser.cjs`, `lib/core/session-register.cjs`'s
   index-parallel array lookup, `lib/core/user-md-ops.cjs`'s `axes` array,
   `lib/core/persona-override.cjs` itself) plus a Canon ratification -- out of this plan's
   scope. `investor` remains the closest existing alias. Registered in
   `.planning/phases/267.2-first-install-hooked-loop-repair-reward-investment-inserted/267.2-DECISIONS.md`
   (D-J) as a carried-forward item at phase close; `commands/ignite.md` itself now carries an
   inline "Do NOT mint" doctrine note citing D-J so a future editor does not improvise the mint.

Closing artifacts: `commands/ignite.md` (Door 1 two-step restructure + Tri-Polar fallback),
`skills/ignite/SKILL.md` (regenerated mirror), `tests/test-267-2-ignite-persona-coverage.cjs`
(drift pin, 13 assertions). Plan:
`.planning/phases/267.2-first-install-hooked-loop-repair-reward-investment-inserted/267.2-04-PLAN.md`.

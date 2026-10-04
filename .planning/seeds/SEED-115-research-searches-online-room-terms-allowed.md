---
id: SEED-115
title: "Research searches online for real: room-derived terms leave on the search lines under the run's grant; the per-term block from 355 / 355.1 / 366 / SEED-104 is reversed"
status: promoted (Phase 369.2, inserted 2026-10-04; surgical quick 261004-v16 same day)
priority: critical
filed: 2026-10-04
source: navigator ruling 2026-10-04, verbatim: "seed critical next. blocking room infor from search queries in 355.1 355 was a wrong thing to do. it needs to fully be abel to search onlne !"
promotes_to: the next integer phase after the beta.57 cut (critical; plan it before Theo Phase 26 lands or after, it does not depend on Theo)
depends_on: Phase 363 (the one research planner), Phase 366 (egress policy file, audit ledger, F.8 per-term release), SEED-104 (room-check tokens)
reverses: Phase 355 D-10 as applied to web search; Phase 366 D-13 (the per-term navigator_released allow as the ONLY way a room term leaves); SEED-104's room-check refusal; the beta.55 "room text can no longer leave as a search term" rule
keeps: Canon Part 8 (no room content to the Brain / Theo, absolute and unchanged); the one grant per research run; the audit ledger; the room-level off switch in .mindrian/egress-policy.json
---

# SEED-115: Research must be able to search online, fully

## The ruling

The navigator ruled on 2026-10-04 that blocking room information from search queries (Phase 355,
Phase 355.1, carried into Phase 366 and SEED-104) was the wrong thing to do. The research planner
must be able to search online for real: with the terms, names and phrases the room actually holds.

## What the block is today (so the next phase removes the right thing)

- `lib/core/research-planner/quick.cjs` `localRoomCheck(roomDir, terms)`: reads the room, flags a
  planned term that appears verbatim in a room artifact, or whose content tokens appear in strict
  majority (quick 261002-cud, SEED-104 residual). A flagged term does not leave.
- `lib/core/research-planner/deep.cjs` line ~1259 runs the same check on the deep plan's terms.
- The beta.55 term rule: a term that is a sentence, carries markdown or a list is refused.
- `lib/core/part8-egress-guard.cjs` classifies room content; Phase 366 D-13 added the ONE exception,
  a term released on an F.8 card is `allow` with reason `navigator_released`, logged with the gate id.
- `data/egress-policy.json` (Phase 366 ADR-E16) lists every line the planner can send on; the audit
  ledger (`lib/core/research-planner/audit-ledger.cjs`) refuses a record for a line that is off.

The effect on a real room: the planner produces queries stripped of the very words that make the
question specific, or holds the whole run behind a per-term card, and on a thin room answers
"not enough context". That is the failure the navigator named.

## The boundary that stays, stated precisely

Canon Part 8 is about the Brain (Theo): no room content crosses to the teaching graph, ever. It was
never about the open web. The web search lines (Tavily, WebSearch fallback) are a different
boundary, governed by the navigator's consent, not by Part 8. This seed does not touch Part 8 and
every Part 8 test stays as it is.

## Direction for the phase (to be planned, not decided here)

1. Room-derived terms are ALLOWED on the search lines by default, under the run's one grant. The
   grant card shows the exact query strings that will be sent, as sent, before anything leaves; the
   navigator approves the run once, not term by term. The F.8 per-term release of 366 D-13 becomes
   unnecessary for web search and is retired on those lines (it may stay for any Theo-side use).
2. `localRoomCheck` keeps its honest job and loses its blocking one: it may still tell the evidence
   card "the room already holds this" (the 363 D-03 falsifier), it no longer removes a term from the
   run.
3. The sentence / markdown refusal becomes query shaping: a sentence is turned into a searchable
   query (named entities, key phrases, year) and sent; nothing is refused for being specific.
4. The audit ledger logs every string sent, per line, with the grant id. The room-level
   `.mindrian/egress-policy.json` can still turn a line off for a room that must stay offline.
5. Measured bar for the phase: on the three Phase 355 fixture rooms, a quick run sends non-empty
   queries that contain the room's own named terms, returns evidence rows with sources, and the
   `not_enough_context` answer disappears for rooms that have claims.

## Tests that will move (name them in the plan, not in prose)

`tests/test-seed104-room-check-tokens.cjs`, `tests/test-seed104-grant-family-loop.cjs`,
`tests/test-366-egress-policy.cjs`, the 363 run-quick legs that assert a flagged term is withheld,
and any 355 / 355.1 leg that treats a room term on a search line as a Part 8 violation. Part 8 tests
that concern Theo (`test-355-part8-egress.cjs`, `test-3551-part8-egress.cjs`, the brain egress
suites) do not move.

## Why this is critical

Research is the plugin's main promise on beta.57 (planned, granted, sourced). A planner that cannot
use the room's own words cannot research the room. Testers on beta.57 are told to use it today.

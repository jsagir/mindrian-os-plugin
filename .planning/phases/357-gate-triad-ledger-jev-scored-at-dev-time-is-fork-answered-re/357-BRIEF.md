# Phase 357 BRIEF - Gate-triad ledger (Jev scored at dev time, shipped as data)

Status: DRAFT, navigator-approved direction 2026-09-23 ("Gate-triad ledger (Recommended)").
Next GSD step: /gsd-phase add -> /gsd-spec-phase 357.

## Problem
The Stop-hook gate judgment (scripts/check-card-fire.cjs classifyCardFire + lib/core/gate-relevance.cjs)
guesses three semantic questions with regex + token overlap:
  1. is-fork      - does this turn pose a genuine structural choice?
  2. answered     - did the navigator already answer it last turn?
  3. relevant     - does the gate's subject connect to the current conversation?
7 resolved debug files trace to this seat (card-fire-over-enforcement, stale-f1-reach-forces-block,
option-shaped-prose-sentence, benign-list-defeats-relevance, answered-gate-refires-within-ttl,
intern-w1-card-discipline-decay, reach-gate-stale-turn-input). Live 8th observation 2026-09-23:
a "-> Next:" footer with no fork was force-blocked. A block regenerates the whole turn - the most
expensive token failure Larry has.

## Rulings that bound this phase (2026-09-17, unchanged)
- Canon Part 8: zero user text / room content / artifact ids to Jev.
- Jev never runs in a hook on a user's machine; users carry no Jev key.
- Finite input spaces are scored once at dev time and shipped as data.
- Jev is never the egress guard.

## Shape (teacher/student)
1. LOCAL feature extractor (pure code, no network) quantizes a turn into a closed, finite feature
   vector. Candidate features (spec-phase to finalize, keep the cartesian product small):
   gate_shape enum (F.0-F.8, binding, none), turns_since_gate bucket, prior-turn-answer-match enum,
   topical-overlap bucket, output-ends-in-question bool, output-has-option-list enum
   (none / prose-inline / numbered / ascii-box), card-already-fired-this-session bool.
2. DEV-TIME builder `scripts/build-gate-triad-ledger.cjs` (sibling of build-section-command-ledger.cjs):
   enumerates the feature space, asks Jev 3 Noul per cell WITH the policy written into the question
   (spike 004 lesson: 64/64 with rule stated, 40/64 without), assertEgressCeiling on every fetch,
   writes `data/gate-triad-ledger.json`.
3. RUNTIME: check-card-fire.cjs looks up the cell; no network. Missing/bad ledger -> current
   heuristics byte-identical (353 fallback contract).
4. Regression set: the 7 resolved debug cases + the 2026-09-23 footer case, as fixtures.
5. Prose shrink (measured): larry-extended "Decision Gates" (~1.7KB) and the SKILL gate rules collapse
   to "obey the injected gate verdict". Measure bytes before/after.

## Non-goals
No live Jev call. No change to glyph/dial/problem-type (candidate follow-on phases, same pattern).
No edits to 354 files in flight.

## Acceptance
- 8/8 regression fixtures pass with the ledger; current behavior unchanged when ledger absent.
- tests/test-353-tripwires.cjs still green (no api.typesafe.ai under lib/, builder not in hooks/).
- Byte delta on always-loaded Larry prompt reported.
- Tri-Polar: Desktop/Cowork (no Stop hook) - stop_gate_check MCP tool uses the same ledger.

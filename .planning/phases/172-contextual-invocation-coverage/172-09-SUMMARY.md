---
phase: 172-contextual-invocation-coverage
plan: 09
subsystem: invocation-spine
tags: [cirs, canon-part-11, r3, inv-19, d-172-j, act, dial, standing-suggestion, jtbd-blurb, non-egress-render]

# Dependency graph
requires:
  - phase: 172-08
    provides: act is spine-governed (CIRS R4 connector + F.1 gate + intent calibration); this plan adds the ALWAYS-ON pinned standing suggestion ON TOP
  - phase: 148-larryreach-selector-re-wire
    provides: the frozen 6-reach bank + DIAL_REACH_K=6 + the dial-label-composer hats non-egress render family precedent the act family mirrors
  - phase: 100-jtbd-inference-engine
    provides: lib/hmi/jtbd-state.cjs getCurrent (the active-JTBD LOCAL read) + jtbd-taxonomy.json one_line source
  - phase: 122-workflow-layer
    provides: lib/brain/chain-recommender.cjs recommendFrameworkChain (framework names + problem-type enums only, the "how" line)
provides:
  - "lib/core/act-jtbd-blurb.cjs buildActBlurb({jtbd,state,minto,roomState?}) -> {what,helps_with,how}: the LOCAL JTBD-blurb generator (enum/scalar + local-derived text only; zero Brain egress; Tier-0 resilient)."
  - "lib/hmi/dial-reach-orchestrator.cjs buildReachList now returns a SEPARATE pinned_suggestion field (always-on /mos:act row) that does NOT count against offered_count/total_count and mints no 7th reach."
  - "lib/hmi/dial-label-composer.cjs gains the render-only NON-EGRESS act template family ({what}/{how} LOCAL handles, no {framework} egress slot, mirroring hats)."
  - "tests/test-act-standing-suggestion.cjs (4 behaviors) registered in tests/run-all-172.sh (now 15/15)."
affects: [dial/suggest-next host (renders the pinned act row), 172-13 (hard-FAIL gate flip - act is now a wired standing suggestion)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "the act standing suggestion is a SEPARATE pinned_suggestion field on the ReachList, computed AFTER total_count/offered_count, so the MAX_K=3 ranked reaches are byte-identical with or without it (no displacement, no 7th reach)"
    - "the act blurb is composed LOCALLY (active JTBD one_line + STATE.md scalars + MINTO.md scalars + recommendFrameworkChain framework names); zero Brain/network call (no fetch/http/brain-client/await), proven by a source-grep tripwire"
    - "the act render family is render-only + non-egress (no {framework} slot), mirroring the Phase-148 hats family; composing the act label never moves the Part-8 egress audit counter (asserted by Test 4 + the extended bank-drift render-only proof)"
    - "Tier-0 resilience: buildActBlurb never throws; with null/absent JTBD/STATE/MINTO it degrades the what/helps_with to the generic blurb and the how to a default-seed framework name (enum-only)"

key-files:
  created:
    - lib/core/act-jtbd-blurb.cjs
    - tests/test-act-standing-suggestion.cjs
  modified:
    - lib/hmi/dial-reach-orchestrator.cjs
    - lib/hmi/dial-label-composer.cjs
    - tests/test-dial-label-bank-drift.cjs
    - tests/run-all-172.sh

key-decisions:
  - "pinned_suggestion is a SEPARATE field (not appended to reaches[]) and carries reach_id:null + pinned:true + command:'/mos:act' + position:'last'. It is built AFTER offered_count/total_count are computed on the survivors, so it can NEVER affect either - the structural guarantee that act does not displace the MAX_K=3 ranked reaches and is not a 7th reach."
  - "the act blurb is rendered through a NEW non-egress composer family 'act' rather than reusing an existing reach family, because act is NOT a reach (the 6 reach families stay frozen) and the blurb is {what}/{how} text, not a mechanism-verb alias. The bank-drift test was updated to assert the 6 frozen reach families PLUS the 1 sanctioned non-reach act render family, so a stray 7th REACH family still trips."
  - "buildActBlurb's 'how' line names a framework + problem-type enum via recommendFrameworkChain (which itself degrades to DEFAULT_SEED locally, never the Brain). Even the null-input case yields a framework NAME (Beautiful Question Framework) - this is enum/local-only, not user content, and satisfies the Tier-0 + zero-egress contract."
  - "the orchestrator lazy-requires the blurb generator (guarded), keeping it pure/sync/LOCAL; a generator-load failure degrades the pinned row to a hardcoded generic blurb rather than throwing."

patterns-established:
  - "act is the FIRST always-on PINNED standing suggestion on the dial host - additive, separate-field, never a reach, never displacing the ranked set. The render-only non-egress family count grows from four (context_block/contradiction/cross_room/hats) to five (+act)."

requirements-completed: [INV-19]

# Metrics
duration: 35min
completed: 2026-06-23
---

# Phase 172 Plan 09: Act Always-On Pinned Standing Suggestion Summary

Implemented INV-19 / D-172-j: /mos:act is now an ALWAYS-ON, JTBD-self-explaining PINNED standing suggestion on the dial host - a separate `pinned_suggestion` field on the ReachList that NEVER displaces the MAX_K=3 ranked context-reaches and is NOT a 7th reach (DIAL_REACH_K stays 6). The JTBD-contextualized blurb (what /mos:act would do, what it helps with, how/which framework+why) is composed LOCALLY from the active JTBD + STATE.md + MINTO.md scalars + framework-name enums, with zero Brain egress.

## What shipped

- **Task 1 (commit 57b75e1b).** New `lib/core/act-jtbd-blurb.cjs` exporting `buildActBlurb({jtbd,state,minto,roomState?})` returning `{what, helps_with, how}`. It resolves the active JTBD (enum id + one_line), STATE.md scalars (stage / problem_type / weakest_section), and MINTO.md scalars (governing-thought presence + open-tension count) LOCALLY, and composes the "how" line from `recommendFrameworkChain` (framework names + problem-type enum only, Part 8). Zero Brain/network egress (no fetch/http/brain-client/await - source-grep clean). Tier-0 resilient: null/absent inputs degrade to a generic blurb; never throws.
- **Task 2 (RED 03597446 / GREEN da051078, TDD).** Pinned the additive act row on the dial host. `dial-reach-orchestrator.cjs` `buildReachList` now returns a SEPARATE `pinned_suggestion` field (always-on /mos:act row, `reach_id:null`, `pinned:true`, `position:'last'`) built from the LOCAL blurb and computed AFTER `total_count`/`offered_count` - so it never consumes an offered slot and the ranked reaches are byte-identical with or without it. `dial-label-composer.cjs` gains the render-only NON-EGRESS `act` template family (`{what}`/`{how}` LOCAL handles, no `{framework}` egress slot, mirroring `hats`); composing the act label never invokes the Part-8 egress audit. New `tests/test-act-standing-suggestion.cjs` asserts all four mandated behaviors. The bank-drift test (`test-dial-label-bank-drift.cjs`) was updated to assert the 6 frozen reach families + the 1 sanctioned non-reach act render family and to extend the render-only proof to `hats` + `act`.

## TDD Gate Compliance

Task 2 carries `tdd="true"`. RED gate: commit `03597446` added `tests/test-act-standing-suggestion.cjs` with Tests 1/2/4 FAILING (pinned row + act composer family not yet built) and Test 3 PASSING (the frozen reach bank was already correct - a legitimate pre-existing invariant, not a missing feature). GREEN gate: commit `da051078` shipped the orchestrator `pinned_suggestion` field + the composer `act` family; all 4 tests pass. No REFACTOR commit (the GREEN implementation was already clean). Both gate commits present in `git log`. Task 1 is a pure new-file generator with its own automated verify (not gated as TDD in the plan).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stale frozen-bank assertion in test-dial-label-bank-drift.cjs**
- **Found during:** Task 2 (running the composer drift fence after adding the act family).
- **Issue:** The drift test asserted the composer's `TEMPLATE_FAMILIES` cover EXACTLY the 6 canonical reach ids. Adding the sanctioned INV-19 `act` render family (a NON-reach family) tripped that exact-6 assertion.
- **Fix:** Updated the test to assert the 6 frozen REACH families PLUS the 1 sanctioned non-reach `act` render family (`EXPECTED_FAMILY_IDS = CANONICAL_REACH_IDS + ['act']`), still tripping on any stray 7th REACH family and asserting the act family is non-egress; extended the render-only proof to `hats` + `act`. In-scope: the act family is THIS plan's change and the drift fence guards exactly this surface.
- **Files modified:** tests/test-dial-label-bank-drift.cjs
- **Commit:** da051078

## Out-of-scope (logged, not fixed)

- **DI-172-09-01: orchestration-projection STALE (pre-existing, from Plan 172-12).** `node scripts/build-orchestration-projection.cjs --check` reports the projection + command-ledger STALE. The ONLY delta is `/mos:ingest-methodology` flipping `excluded` -> `ranked`, introduced by Plan 172-12 commits `dc76f26a`/`b9525a0a` (command-surface changes) that were never regenerated in lockstep. Plan 172-09 touches no projection inputs (the generator scans `commands/*.md` + `skills/<dir>/SKILL.md` + `agents/*.md`; my files are `lib/hmi/*` + `lib/core/act-jtbd-blurb.cjs` + tests). Regenerating would fold 172-12's intended change into a 172-09 commit, violating the per-task scope boundary, so the regen was reverted and the condition logged to `deferred-items.md`. `tests/run-all-172.sh` runs the connector-registry `--check` (green) but NOT the projection `--check`, so the phase aggregator stays green (15/15). Resolution: a later 172 plan / the Plan 172-13 hard-FAIL gate flip regenerates the projection.

## Frozen-Invariant Compliance

- DIAL_REACH_K === 6, REACH_IDS length 6, REACH_DEFS untouched: NO 7th reach minted (Test 3 + the carried `test-reach-ids-drift` exactly-6 ran green).
- MAX_K=3, the 0.70/0.15 RECOMMENDED gate, the F.1 keyboard contract, the 6-reach / 3-posture banks: unchanged (act is rendered alongside them, never edits them; `run-all-148.sh` 18/18, `run-all-172.sh` 15/15).
- The act standing suggestion is a SEPARATE pinned_suggestion field that does NOT count against offered_count/total_count (Test 2 asserts the ranked reaches are byte-identical with vs without it) - it is NOT a 7th reach.
- The blurb is composed from LOCAL state ONLY (active JTBD + STATE + MINTO + framework-name enums); zero Brain egress (no fetch/http/brain-client/await - asserted by source-grep + Test 4's non-egress audit-count proof). No new edge type, no new node type, no new reach, no new Brain wire.

## Known Stubs

None. The blurb generator, the pinned act row, and the non-egress render family are all live (test-fenced: `test-act-standing-suggestion` 4/4, `test-dial-label-bank-drift` all groups pass, `test-dial-end-to-end-states` 11/11, `run-all-172.sh` 15/15).

## Threat Flags

None. This plan adds no new network endpoint, auth path, file-access pattern, or trust-boundary schema change beyond the plan's threat model (T-172-18 act JTBD blurb mitigated: render-only non-egress family + buildActBlurb composes LOCALLY with zero Brain call; T-172-19 frozen reach contract mitigated: Test 3 asserts DIAL_REACH_K===6 + REACH_IDS length 6, the pinned act row is a separate field; T-172-SC no package installs).

## Self-Check: PASSED
- FOUND: lib/core/act-jtbd-blurb.cjs (buildActBlurb -> {what,helps_with,how}; zero Brain egress; Tier-0 resilient)
- FOUND: tests/test-act-standing-suggestion.cjs (4/4)
- FOUND: lib/hmi/dial-reach-orchestrator.cjs (pinned_suggestion field; DIAL_REACH_K=6 unchanged)
- FOUND: lib/hmi/dial-label-composer.cjs (act non-egress render family, no {framework} slot)
- FOUND: commits 57b75e1b, 03597446, da051078 (all in git log)
- VERIFY: node tests/test-act-standing-suggestion.cjs -> 4 passed, 0 failed
- VERIFY: bash tests/run-all-172.sh -> 15/15 PASSED
- VERIFY: bash tests/run-all-148.sh -> 18/18 PASSED (frozen contracts intact)
- VERIFY: node tests/test-dial-label-bank-drift.cjs -> all assertion groups PASSED
- VERIFY: node scripts/build-connector-registry.cjs --check -> OK
- VERIFY: node scripts/build-harness-manifest.cjs --check -> OK

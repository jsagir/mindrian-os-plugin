---
phase: 354-system-integrity-and-theo-integration-independent-research-a
plan: 09
subsystem: brain-integration
tags: [theo, brain-router, brain-client, tool-router, contract, provenance, tier-3, mcp]

# Dependency graph
requires:
  - phase: 354-system-integrity-and-theo-integration-independent-research-a
    provides: "354-05/06/07/08 (SYS-01/02/03/06 fixes this plan's wave depends on; THEO-03 typed-question gate from 354-06 that ask()'s gate call still sits behind)"
provides:
  - "brain-router.cjs::_rungFromClassification(definition, complexity) -- structural rung derivation, no text round trip"
  - "brain-client.cjs::ask(question, opts) with opts.problem_type threaded structurally into _composeTheoAsk's opts.rung"
  - "brain-client.cjs::THEO_RUNG_SET -- the closed four-value rung enum, exported"
  - "brain-router.cjs recommendations: frameworks[], rejected_candidates[], provenance{provider,method,rung,rung_source,feeds_into_verified}, chain_type:'ranked_candidates'"
  - "brain-router.cjs::KNOWN_METHODOLOGIES exported as a live reference (354-17 dependency)"
  - "tool-router.cjs act/act-chain/act-swarm: validateChain before pipelineState.initChain, '## Framework Recommendation (not executable)' response on rejection"
  - "tests/test-354-theo-router-contract.cjs -- router -> composer -> captured Theo arguments regression"
affects: [354-17]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Typed enum crossing an internal module boundary structurally (opts.problem_type -> opts.rung), never re-derived from generated prose on the far side"
    - "Two separate candidate pools (command slugs vs framework labels) so a label can never enter an executable chain"
    - "Honest provenance: state what the provider actually computed (ranked candidates), never a derivation claim it never made (FEEDS_INTO)"
    - "Consumer-side validate-before-initialize: tool-router computes validateChain once and never starts pipeline state from a chain it rejects"

key-files:
  created:
    - tests/test-354-theo-router-contract.cjs
  modified:
    - lib/core/brain-client.cjs
    - lib/mcp/brain-router.cjs
    - lib/mcp/tool-router.cjs
    - docs/reviews/phase-354-probes/theo.cjs

key-decisions:
  - "Chain filtering is EXACT KNOWN_METHODOLOGIES match only (no substring fuzzy match) -- safety over recall, by design, so 354-17's Jev-scored recall layer has a genuinely safe floor to build on"
  - "Provenance states chain_type: 'ranked_candidates' with feeds_into_verified: false rather than the prior unconditional chain_type: 'feeds_into' claim"
  - "Test's C1-C4 classification-round-trip assertions point MINDRIAN_BRAIN_URL at the real Theo origin string while stubbing global.fetch (mirroring the seed probe), because recommendChain's origin-specific alias table selection is explicitly out of this plan's scope and a loopback URL would be read as incumbent-shaped"

patterns-established:
  - "brainRoute() sets _lastBrainRouteMissNote before every null return (brain_unreachable, brain_timeout, brain_error_response, brain_invalid_response, brain_chain_not_executable), all reaching the caller through the pre-existing additive brain_router_note disclosure"

requirements-completed: [THEO-01]

# Metrics
duration: 45min
completed: 2026-09-23
---

# Phase 354 Plan 09: Theo Router Contract Safety Summary

**Classification round trip carries the rung structurally (ask(question, {problem_type})) instead of re-deriving it from generated prose; brain-router's chain filter is now exact-registry-slug-only with framework labels and rejected candidates split out; Brain-sourced recommendations state honest ranked-candidate provenance instead of an unverified FEEDS_INTO derivation claim; act/act-chain/act-swarm validate the chain before initializing pipeline state.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-09-23
- **Tasks:** 3 (all `type="auto"`, test-first: Task 1 red, Tasks 2-3 green)
- **Files modified:** 4 (1 created, 3 modified, plus 1 test-fixture probe correction)

## Accomplishments

- Fixed the classification round trip (CTX-THEO-CLASS): `lib/mcp/brain-router.cjs::_rungFromClassification` computes the room's rung structurally and hands it to `brainClient.ask(question, { problem_type })`; `_composeTheoAsk` prefers this typed value (validated against a new `THEO_RUNG_SET`) over its own `_inferRungFromQuestion` text heuristic, which previously never saw any of its own markers in the router's generated sentence and defaulted every case to `IllDefined` regardless of the room's real classification. The `brain_ask` wire shape is unchanged (`{ question }` only); the rung only reaches the already-closed-enum `recommend_chain` call one hop downstream.
- Fixed executable-chain validation (CTX-THEO-CHAIN, T-354-19): `brainRoute` now builds two separate candidate pools -- command slugs (the only things that can become `chain` elements, filtered to an EXACT `KNOWN_METHODOLOGIES` match, no more substring fuzzy matching that let a framework label normalize into an invalid id like `designthinking` or `build-mvp`) and framework labels (`frameworks[]`, display-only). Non-matching candidates land in `rejected_candidates[]` (capped at 10). An empty or `validateChain`-rejected chain never becomes a `'brain'`-sourced recommendation; it returns `null` with `brain_router_note: 'brain_chain_not_executable'` so `recommend()` serves the local fallback instead.
- Fixed provenance (CTX-THEO-PROV, T-354-20): a valid Brain-sourced recommendation now states `chain_type: 'ranked_candidates'` and `provenance: { provider, method, rung, rung_source, feeds_into_verified: false }` instead of the prior unconditional `chain_type: 'feeds_into'` and a "Chain derived from brain_ask FEEDS_INTO recommendations" claim Theo's ranking never actually computed.
- Widened degradation visibility to every distinguishable Tier-3 miss cause: `brain_unreachable`, `brain_timeout`, `brain_error_response`, `brain_invalid_response`, `brain_chain_not_executable` (alongside the pre-existing `answered_no_next_gate`), all reaching `recommend()`'s existing additive `brain_router_note` disclosure without widening that block's own code.
- `lib/mcp/tool-router.cjs`'s `act`/`act-chain`/`act-dry-run`/`act-swarm` branches now compute `validateChain(roomDir, rec.chain)` once, immediately after `recommend()`, before any `pipelineState.initChain` or `loadReference(rec.chain[0])` call. A rejected chain returns a `'## Framework Recommendation (not executable)'` response (chain, source, reason, frameworks considered, and a Suggested Next pointing at `act-dry-run`) instead of starting pipeline state from a chain the registry cannot run. `act-dry-run` reuses the same validation object. A valid response now also renders a `'**Provenance:**'` line.
- Exported `KNOWN_METHODOLOGIES` from `brain-router.cjs` as a live reference (not a copy) for 354-17's Jev-scored recall layer.
- New regression `tests/test-354-theo-router-contract.cjs` (36 assertions) drives the real wire path against the shared SSE capture server (never an in-process `ask()` stub): C1-C4 (classification round trip), V1 (registry-only chain), P1 (honest provenance), A1 (act-chain never initializes pipeline state from a non-registry chain), D1 (every distinguishable Tier-3 miss cause discloses).

## Task Commits

1. **Task 1: Failing regression - captured Theo arguments, registry-valid chain, act-chain state, honest provenance** - `48ad67aad` (test)
2. **Task 2: Carry the rung structurally, keep chain to registry slugs, state ranked-candidate provenance** - `91da73441` (feat)
3. **Task 3: Validate the final chain before act, act-chain and act-swarm initialize pipeline state** - `257996f88` (feat)

## Files Created/Modified

- `tests/test-354-theo-router-contract.cjs` - New regression: C1-C4/V1/P1/A1/D1, real wire path against the SSE capture server
- `lib/core/brain-client.cjs` - `ask(question, opts)`, `THEO_RUNG_SET`, `_composeTheoAsk(payload, question, deps, opts)` with `rung_source`
- `lib/mcp/brain-router.cjs` - `_rungFromClassification`, exact-registry chain filtering, `frameworks`/`rejected_candidates`/`provenance`, widened miss-note disclosure, `KNOWN_METHODOLOGIES` export
- `lib/mcp/tool-router.cjs` - `validateChain` before `pipelineState.initChain` in the `act`/`act-chain`/`act-dry-run`/`act-swarm` branch, `renderNotExecutable`/`renderProvenanceLine` helpers
- `docs/reviews/phase-354-probes/theo.cjs` - Probe-fixture correction (deviation, see below)

## Decisions Made

- Chain filtering stays exact-registry-slug-only (no fuzzy substring match) even though this rejects real Brain candidates the fuzzy match would previously have accepted -- safety-first per the downstream note: 354-17 (wave 5, not yet executed) adds a Jev-scored recall layer on top of this exact-slug floor specifically because that recall cost is the correct trade, not a gap to "fix" here.
- `KNOWN_METHODOLOGIES` is exported by shorthand property (`{ ..., KNOWN_METHODOLOGIES, ... }`), which is the same array reference `validateChain`/`brainRoute` check against internally -- a live reference, not a snapshot, per 354-17's stated dependency.
- Provenance additions (`frameworks`, `rejected_candidates`, `provenance`, `rung_source`) are all additive fields; no existing consumer destructuring `{chain, confidence, source, reasoning, target_sections}` is affected.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test's own literal reasoning-string wording would have self-contradicted its own P1 assertion**
- **Found during:** Task 2, while implementing `brainRoute`'s new `reasoning` field
- **Issue:** The plan's literal reasoning text ("...not a verified FEEDS_INTO dependency.") contains the substring `FEEDS_INTO`, which would fail Task 1's own P1 assertion ("`rec.reasoning does not contain 'FEEDS_INTO'`") that this same plan specifies.
- **Fix:** Worded the reasoning string to convey the identical meaning (ranked candidates, no verified derivation) without the literal `FEEDS_INTO` substring: "commands follow candidate rank, not a verified dependency-graph derivation."
- **Files modified:** `lib/mcp/brain-router.cjs`
- **Commit:** `91da73441`

**2. [Rule 1 - Bug] `tests/test-354-theo-router-contract.cjs`'s C1-C4 block needed the real Theo origin, not the loopback capture server**
- **Found during:** Task 2 verification (running the new regression against the fix for the first time)
- **Issue:** `lib/core/brain-client.cjs::_normalizeBrainProblemType` selects its alias table by origin (`THEO_ORIGINS`); a loopback capture-server URL is read as incumbent-shaped, so the `'UnDefined'` rung's lowercased form collided with the incumbent table's own `'undefined'` key (mapping to `'Undefined Problem'`) for exactly one of the four cases. `recommendChain`'s origin-specific normalization is explicitly out of this plan's scope and unchanged.
- **Fix:** The C1-C4 block points `MINDRIAN_BRAIN_URL` at the real Theo origin string while stubbing `global.fetch` directly (mirroring `docs/reviews/phase-354-probes/theo.cjs`'s own established technique), so the origin selector picks the Theo alias table exactly as production does. A1 and D1 keep using the shared loopback capture server, where origin selection does not participate.
- **Files modified:** `tests/test-354-theo-router-contract.cjs`
- **Commit:** `91da73441`

**3. [Rule 1/3 - Bug / Blocking] `docs/reviews/phase-354-probes/theo.cjs`'s `ask` stub silently dropped the new `opts` argument**
- **Found during:** Task 3 verification -- the plan's own acceptance criteria names the probe's `observed` rung (`WellDefined`/`UnDefined`/`Wicked`) as a required outcome, which was unreachable without this fix.
- **Issue:** The probe's `brain.ask = async text => ...` stub predates this plan's `ask(question, opts)` signature; calling it with a second argument silently ignores that argument (JS does not error on extra call-site arguments), so `_composeTheoAsk` always fell back to `_inferRungFromQuestion`'s inference regardless of the fix, leaving the probe's characterization stuck on the pre-fix `IllDefined` output.
- **Fix:** Two-line change: the stub now accepts `(text, opts)` and forwards `{ rung: opts && opts.problem_type }` into `_composeTheoAsk`'s fourth parameter, mirroring the exact translation the real `ask()` performs.
- **Files modified:** `docs/reviews/phase-354-probes/theo.cjs`
- **Verification:** `node docs/reviews/phase-354-probes/theo.cjs` now shows `observed.rung` matching `expectedRung` for all three cases and `validation.valid: true`.
- **Commit:** `257996f88`
- **Scope note:** This is a probe-fixture correction only (a characterization script under `docs/reviews/`), not a change to any production file this plan owns, and makes no write to `/home/jsagi/Theo` (CTX-THEO-READONLY holds).

---

**Total deviations:** 3 auto-fixed (2 Rule 1, 1 Rule 1/3)
**Impact on plan:** All three are test/fixture corrections needed to make the plan's own stated acceptance criteria observable; zero production-behavior scope creep beyond what Tasks 2-3 already specified.

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- THEO-01's classification/chain/provenance seams (CTX-THEO-CLASS, CTX-THEO-CHAIN, CTX-THEO-PROV) are closed. THEO-01 as a whole is NOT complete: 354-10 (taxonomy casing) and 354-12 (Theo journey) still own the remaining sub-findings and have not landed yet. `REQUIREMENTS.md`'s THEO-01 row stays open until all three plans land.
- `KNOWN_METHODOLOGIES` is exported live from `lib/mcp/brain-router.cjs` and ready for 354-17's Jev-scored recall layer to read directly.
- No blockers for 354-10 through 354-18 from this plan's changes; `tests/run-all-354.sh` reports 10 passed / 0 failed / 8 skipped (the 8 skips are sibling plans' not-yet-landed test files, unrelated to this plan).

---
*Phase: 354-system-integrity-and-theo-integration-independent-research-a*
*Completed: 2026-09-23*

## Self-Check: PASSED

All created/modified files confirmed present on disk (tests/test-354-theo-router-contract.cjs,
lib/core/brain-client.cjs, lib/mcp/brain-router.cjs, lib/mcp/tool-router.cjs,
docs/reviews/phase-354-probes/theo.cjs, this SUMMARY.md). All three task commits
(48ad67aad, 91da73441, 257996f88) confirmed present in git log.

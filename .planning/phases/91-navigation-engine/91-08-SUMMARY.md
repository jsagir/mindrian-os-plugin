---
phase: 91-navigation-engine
plan: "08"
subsystem: framework-chain-composition
tags: [navigation-engine, framework-chains, feeds-into, composable-methodology, canon-part-2-engine-1, canon-part-3, canon-part-4, canon-part-7, canon-part-8, recommended-gate, tdd]

# Dependency graph
requires:
  - phase: 91-navigation-engine
    plan: "00"
    provides: decide(turn, ctx) decision shell + 8-field decision_trace + chosen_rationale composition + emptyDecision + applyStalenessMultiplier + resolveTierMode (mode_a/mode_b/tier_0)
  - phase: 91-navigation-engine
    plan: "02"
    provides: scripts/intent-classifier.cjs runNavigationEngine wiring with brainAvailable feed (Plan 91-07 upgraded to real isAvailable() scalar)
  - phase: 91-navigation-engine
    plan: "04"
    provides: offer-presenter.cjs presentOffer + recordOfferOutcome + readOfferHistory + classifyTurnOutcome -- presenter respects engine's brain_md_recommended_marker_rendered flag without re-evaluating Section 6 gate
  - phase: 91-navigation-engine
    plan: "07"
    provides: problem-type-router.cjs lazy-require pattern + 60-LOC integration block in decide() -- Plan 91-08 adopts the exact same lazy-require + try/catch pattern for chain composition
  - phase: 90-brain-derivation-layer
    plan: "01"
    provides: BRAIN.md framework_chain_predictions section bodies authored by deriveSection (FEEDS_INTO edges with confidence + phase indicators -- Brain pre-derivation ran inside buildBrainQueryContext chokepoint hours before engine reads)
provides:
  - "lib/core/framework-chain-composer.cjs pure module (parseFrameworkChainSection + detectCompletedFramework + proposeNextFramework + KNOWN_FRAMEWORKS + FRAMEWORK_TO_COMMAND_SLUG + NOISE_FLOOR + RECOMMENDED_FLOOR + RECENT_WRITE_WINDOW_MS + FALLBACK_COMMAND_SLUG)"
  - "Engine integration: decide() lazy-requires framework-chain-composer after problem-type routing; chain proposal becomes engine.offer_next_step when none higher-priority signal has populated it"
  - "User override capture: turn-2 different /mos: command vs ctx.lastTurnOffer triggers REJECTED chain suggestion in chosen_rationale + chain_override_recorded:true flag in trace (Canon Part 4: every choice is graph data)"
  - "RECOMMENDED marker promotion: chain_recommended_eligible flag in trace; engine promotes brain_md_recommended_marker_rendered to true when Mode A + chain conf >= 0.7 AND no prior marker fired"
  - "18-test fixture suite (lib/memory/framework-chain-composer.test.cjs): 15 pure-module tests + 3 decide() integration tests"
affects:
  - 91-09-nav-invariants-validator (validator can scan engine output for chain rationale presence + RECOMMENDED gate consistency between pattern_matches and chain proposals)
  - 91-10-v1.11.0-release-gate (NAV-CHAIN-01..04 requirements complete; v1.11.0-beta.2 release-gate ready)
  - Future Plan 91-* / 92-* (chain-composition signal becomes one of five engine signals; downstream plans may layer Brain-derived chain context expansion)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure composer module: parser + completion detection + proposal in one CJS file with minimal fs touches (only mtime fallback uses fs.readdir + fs.stat, both wrapped in try/catch). Mirrors Plan 91-07 problem-type-router purity contract."
    - "Engine biasing layer: lazy-require + try/catch wrapper around composer call so a missing/faulty composer never blocks the decision (chain composition biases offer_next_step, never overwrites a higher-priority signal). Same pattern Plans 91-03 + 91-04 + 91-07 use."
    - "User override detection at engine layer: ctx.lastTurnOffer + t.userText -> REJECTED chain suggestion captured as graph data per Canon Part 4. The override check runs BEFORE we set offer_next_step so the user's intent (in userText) gets recorded against the prior offer."
    - "RECOMMENDED marker dual-source: pattern_matches verb resolution OR chain proposal can promote brain_md_recommended_marker_rendered. The engine takes the maximum of pattern-match confidence and chain confidence so /mos:explain-decision shows the strongest signal."

key-files:
  created:
    - lib/core/framework-chain-composer.cjs (411 LOC; BSL 1.1; zero deps; pure with minimal fs read fallback)
    - lib/memory/framework-chain-composer.test.cjs (533 LOC; 18 tests covering parser, completion detection, proposal, gating, RECOMMENDED eligibility, integration, user override)
  modified:
    - lib/core/navigation-engine.cjs (added 104-LOC integration block in decide() after problem-type routing)
    - lib/memory/run-feynman-tests.cjs (registered new test file)

key-decisions:
  - "Chain composition biases, never forces. offer_next_step is set ONLY when no higher-priority signal has populated it. Per locked decision D-02, chain is one signal among five (ICM + SQL + Feynman-MINTO + BRAIN + intent/persona)."
  - "Confidence gating: < 0.5 -> null (noise floor; suppress proposal); >= 0.5 -> proposal returned; >= 0.7 -> recommended_eligible:true. The 0.5 floor matches problem-type-router.LOW_CONFIDENCE_FLOOR. The 0.7 floor matches Plan 91-00 RECOMMENDED_CONFIDENCE_FLOOR."
  - "Null confidence is suppressed by the noise gate. Bare FEEDS_INTO edges (no parenthetical) parse to edge.confidence:null per Test 4 -- the structural relationship survives -- but proposeNextFramework treats null as below the noise floor because we cannot certify a confidenceless edge."
  - "Completion detection cascade: governing_thought primary; mtime fallback. Primary path scans MINTO governing_thought for KNOWN_FRAMEWORKS substring (case-insensitive). Fallback scans section dir for files with mtime within 5 minutes whose basename slug matches a framework slug. Both paths return the canonical framework name from KNOWN_FRAMEWORKS."
  - "Command mapping: best-effort table FRAMEWORK_TO_COMMAND_SLUG. Unknown frameworks fall back to /mos:beautiful-question (the universal guide command). Today only 'lean canvas' and 'mullins' have dedicated commands; the table is intentionally conservative and extensible."
  - "User override is graph data per Canon Part 4. Engine matches /mos:[a-z][a-z0-9-]* in userText; if it differs from lastTurnOffer.command, chosen_rationale gets 'REJECTED chain suggestion: user invoked X instead of Y' and trace.chain_override_recorded becomes true. Plan 91-04 offer-presenter consumes this on the same turn to record outcome=ignored in offer-history.json."
  - "RECOMMENDED marker promotion: when Mode A holds + chain proposal recommended_eligible:true + no prior marker fired (i.e. pattern_matches did not already promote), the engine promotes brain_md_recommended_marker_rendered to true. The recommended_confidence field takes the MAX of any prior pattern-match confidence and the chain confidence so /mos:explain-decision sees the strongest signal."
  - "Canon Part 8 boundary: composer reads ONLY the LOCAL section body via quadruple.brain.sections.framework_chain_predictions. Zero Brain queries at engine time. Pre-derivation ran in Phase 90-01 inside buildBrainQueryContext chokepoint hours before this code runs. grep -cE 'brain-client\\.(query|search|smartSearch)|fetch\\(|curl ' returns 0 across composer + engine."

patterns-established:
  - "FEEDS_INTO parser tolerates two body formats: 'A FEEDS_INTO B (confidence: x, phase: y)' AND 'A -> B (confidence: x)'. Bare FEEDS_INTO without parenthetical preserves the edge with null confidence. Forward-compat: unrecognized lines silently skip."
  - "Frozen KNOWN_FRAMEWORKS Object.freeze list and FRAMEWORK_TO_COMMAND_SLUG mapping. Future plans extending the list cannot accidentally mutate the frozen tables without an explicit canon-aware change."
  - "lastTurnOffer context contract: caller (UserPromptSubmit hook in Plan 91-02) populates ctx.lastTurnOffer = {command, reason} from the prior turn's decision_trace. Engine reads it at chain-composer integration to detect override. Future plans may extend the contract to all signals (not just chain)."

requirements-completed:
  - NAV-CHAIN-01
  - NAV-CHAIN-02
  - NAV-CHAIN-03
  - NAV-CHAIN-04

# Metrics
duration: 7min
completed: 2026-04-28
---

# Phase 91 Plan 08: Framework Chain Composition Summary

**Brain-flagged Composable Methodology becomes real -- when the user just completed framework A, the engine pre-loads framework B from BRAIN.md FEEDS_INTO edges with grounding-rule reason and Canon Part 3 RECOMMENDED gate respected; user override captured as graph data.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-04-27T20:52:23Z
- **Completed:** 2026-04-28T00:00:00Z (date rolled during execution)
- **Tasks:** 2 / 2
- **Files modified:** 4 (2 created, 2 modified -- composer + test + nav-engine + run-feynman-tests)

## Accomplishments

- New pure module `lib/core/framework-chain-composer.cjs` ships with three exports: `parseFrameworkChainSection` (tolerant FEEDS_INTO + arrow regex), `detectCompletedFramework` (governing_thought primary + mtime fallback), `proposeNextFramework` (confidence gating + tie-breaking + grounding rule + RECOMMENDED eligibility flag + /mos: command mapping).
- Navigation engine `decide()` lazy-requires the composer and sets `offer_next_step` when BRAIN.md `framework_chain_predictions` is non-null + completed framework detected + proposal confidence >= 0.5. Higher-priority signals retain precedence (chain biases, never overwrites).
- User override capture wired: `ctx.lastTurnOffer` + `t.userText` /mos: command match -> REJECTED chain suggestion in `chosen_rationale` + `chain_override_recorded:true` in trace (Canon Part 4: every choice is graph data).
- RECOMMENDED marker promotion: Mode A + chain conf >= 0.7 + no prior marker -> engine promotes `brain_md_recommended_marker_rendered` to true so offer-presenter renders the marker. The `chain_recommended_eligible` flag is also surfaced as a dedicated trace field.
- 18/18 fixture tests green (15 pure-module + 3 decide() integration). Zero regressions across the 8 prior Phase 91 test files (33+22+12+17+17+14+24+17 = 156 tests still pass).
- Canon Part 8 boundary scan: zero forbidden brain-client/fetch/curl patterns across composer + engine. All Brain reads remain LOCAL via readQuadruple.

## Task Commits

1. **Task 1 (RED):** `test(91-08): add failing tests for framework-chain-composer` -- `4e51627`
2. **Task 1 (GREEN):** `feat(91-08): implement framework-chain-composer.cjs` -- `695d88e`
3. **Task 2:** `feat(91-08): integrate framework-chain-composer into navigation-engine` -- `ad00f30`

## Files Created/Modified

- **Created** `lib/core/framework-chain-composer.cjs` (411 LOC) -- pure module exporting parser, completion detection, chain proposal, KNOWN_FRAMEWORKS frozen 18-entry list, FRAMEWORK_TO_COMMAND_SLUG mapping, and constants NOISE_FLOOR (0.5) + RECOMMENDED_FLOOR (0.7) + RECENT_WRITE_WINDOW_MS (5 min) + FALLBACK_COMMAND_SLUG ('beautiful-question'). Zero deps, BSL 1.1.
- **Created** `lib/memory/framework-chain-composer.test.cjs` (533 LOC) -- 18 fixture tests covering Tasks 1 + 2.
- **Modified** `lib/core/navigation-engine.cjs` -- 104 LOC integration block at end of `decide()` after problem-type routing. Lazy-require + try/catch keeps degradation graceful.
- **Modified** `lib/memory/run-feynman-tests.cjs` -- registered the new test file.

## Decisions Made

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Chain composition biases, never forces | Per locked decision D-02, chain is one signal among five. `offer_next_step` is set ONLY when no higher-priority signal has populated it. |
| 2 | Confidence gating: 0.5 floor / 0.7 RECOMMENDED | 0.5 matches problem-type-router LOW_CONFIDENCE_FLOOR; 0.7 matches Plan 91-00 RECOMMENDED_CONFIDENCE_FLOOR. Null confidence is suppressed because we cannot certify a confidenceless edge. |
| 3 | Completion detection cascade | governing_thought primary (immediate signal from MINTO); mtime fallback (5-min window) covers cases where the user is still mid-write. Both paths return canonical framework names from KNOWN_FRAMEWORKS. |
| 4 | User override is graph data | Canon Part 4 says "every choice is graph data". Turn-2 different /mos: command vs lastTurnOffer.command -> REJECTED chain suggestion captured in trace. Plan 91-04 offer-presenter consumes the same trace on the same turn to record outcome=ignored. |
| 5 | RECOMMENDED marker promotion | When chain proposal qualifies (Mode A + conf >= 0.7) and pattern_matches has not already promoted the marker, the engine promotes it from the chain side. The recommended_confidence takes MAX of prior + chain so /mos:explain-decision sees the strongest signal. |
| 6 | Command mapping is best-effort | FRAMEWORK_TO_COMMAND_SLUG is conservative -- only frameworks with dedicated /mos: commands map to them; everything else falls back to /mos:beautiful-question (the universal guide). Future plans may extend the table. |

## Deviations from Plan

None -- plan executed exactly as written. Both tasks landed in order with TDD red/green for Task 1 and atomic per-task commits.

## Canon Part 8 Boundary Scan

`grep -cE "brain-client\.(query|search|smartSearch)|fetch\(|curl "` across plan-touched files returns **0** matches:
- `lib/core/framework-chain-composer.cjs` -- 0
- `lib/core/navigation-engine.cjs` -- 0

The composer does NOT touch brain-client at all. All Brain reads remain LOCAL via the section body passed in via `quadruple.brain.sections.framework_chain_predictions`. The pre-derivation that produced those FEEDS_INTO edges ran in Phase 90-01 inside the `buildBrainQueryContext` chokepoint, hours before the engine reads them.

## Five-Signal Triangulation Interplay

Framework chain composition is one signal among five (per locked decision D-02). Precedence in `decide()`:

1. **Wicked escalation** (Canon Appendix E rule R4) takes top precedence -- `resolveFireSkill` returns 'soft-systems' when `wicked_score >= 8`.
2. **Pattern matches** (Mode A + parseable verb) sets `fire_skill` via `verbToSkillFamily`.
3. **Problem-type routing** (Plan 91-07) biases `fire_skill` when no higher-priority signal has set it AND confidence >= 0.5 (or wicked_override).
4. **Chain composition** (this plan) sets `offer_next_step` when no higher-priority signal has populated it. Surfaces `chain_recommended_eligible` in trace; promotes `brain_md_recommended_marker_rendered` when Mode A + conf >= 0.7.
5. **chosen_rationale** ALWAYS records the chain contribution as `Framework chain: <A> FEEDS_INTO <B> (Brain confidence X.YY).` so /mos:explain-decision (Plan 91-05) can surface the bias path.

Tier 0 (no BRAIN.md) path: composer is never invoked; engine falls through to its pre-91-08 fallback. No regression.

Mode B (brain_offline) path: BRAIN.md is locally readable so chain composition STILL contributes from the cached predictions; only RECOMMENDED marker is suppressed (per Plan 91-00 Section 6 contract).

## Three-Surface Compatibility

- **CLI:** Hooks invoke `scripts/intent-classifier.cjs` -> `decide()` -> composer. Full path exercised.
- **Desktop:** Same file path is dispatched from the MCP wrapper that imports `lib/core/navigation-engine.cjs` (per Phase 91 plan).
- **Cowork:** FEEDS_INTO edges are surface-agnostic. Cross-room chain proposals work identically across all three surfaces -- no surface-specific code path.

## KNOWN_FRAMEWORKS Bootstrap List (18 entries)

| Framework | /mos: command (current) |
|-----------|-------------------------|
| SWOT Analysis | /mos:beautiful-question (no dedicated cmd today) |
| Porter Five Forces | /mos:beautiful-question |
| Value Chain Analysis | /mos:beautiful-question |
| Business Model Canvas | /mos:beautiful-question |
| Lean Canvas | /mos:lean-canvas |
| Jobs-to-be-Done | /mos:beautiful-question |
| Value Proposition Canvas | /mos:beautiful-question |
| 5 Whys | /mos:beautiful-question |
| First Principles | /mos:beautiful-question |
| Design Thinking | /mos:beautiful-question |
| Blue Ocean Strategy | /mos:beautiful-question |
| Innovator's Dilemma | /mos:beautiful-question |
| 7 S Framework | /mos:beautiful-question |
| Balanced Scorecard | /mos:beautiful-question |
| Mullins | /mos:mullins |
| Beautiful Question | /mos:beautiful-question |
| Soft Systems | /mos:beautiful-question |
| Rich Pictures | /mos:beautiful-question |

The list is intentionally conservative and extensible. Brain-derived FEEDS_INTO edges may reference frameworks outside this set (in which case completion detection falls through to the mtime slug fallback, and command mapping falls through to /mos:beautiful-question).

## Tyler / Adam Meeting Transcript Trace

The Composable Methodology Adapters opportunity surfaced in two meeting transcripts (Tyler 2026-Q1 and Adam 2026-Q1) where users explicitly stated they wanted frameworks to chain rather than discover the next one manually:

> Tyler: "After we ran SWOT I wanted Porter Five Forces but Larry didn't suggest it -- I had to remember it myself."
>
> Adam: "I finished my Lean Canvas and just sat there. The graph clearly shows what comes next but the bot doesn't say it."

Phase 90-01 wrote FEEDS_INTO edges into BRAIN.md per section. This plan converts those edges into a user-facing capability: when Phase 91-02's UserPromptSubmit hook invokes `decide()`, the chain composer detects "user just finished SWOT" (governing_thought signal), reads BRAIN.md framework_chain_predictions, finds `SWOT Analysis FEEDS_INTO Porter Five Forces (confidence: 0.85)`, and surfaces `Offer (RECOMMENDED): Because SWOT Analysis FEEDS_INTO Porter Five Forces (Brain confidence 0.85). Continuing the chain keeps pedagogical flow., try /mos:beautiful-question.` (or `/mos:porter-five-forces` once a dedicated command ships in a future plan).

The Tyler/Adam unfilled opportunity is now fulfilled at the engine layer. The presenter wires (Plan 91-04) and explainability surface (Plan 91-05) were already in place; this plan was the missing producer.

## Verification Snapshot

- 18/18 framework-chain-composer tests pass (`node lib/memory/framework-chain-composer.test.cjs`)
- 33/33 navigation-engine-core baseline tests still pass
- 22/22 user-md-persona tests still pass
- 12/12 userpromptsubmit-integration tests still pass
- 17/17 skill-activation-router tests still pass
- 17/17 offer-presenter tests still pass
- 14/14 explain-decision-command tests still pass
- 24/24 problem-type-router tests still pass
- 17/17 nav-dial tests still pass
- **Total Phase 91 test suite: 174/174 passed (156 prior + 18 new)**
- BSL 1.1 header in lib/core/framework-chain-composer.cjs first 20 lines
- Zero em/en dashes across plan-touched files (`grep -cE '[–—]'` returns 0)
- Canon Part 8 grep guard: 0 forbidden brain-client/fetch/curl patterns across composer + engine
- `grep -c "FEEDS_INTO" lib/core/framework-chain-composer.cjs` returns 15
- `grep -c "framework-chain-composer" lib/core/navigation-engine.cjs` returns 2

## Self-Check: PASSED

All claimed files, commits, and tests verified to exist:
- `lib/core/framework-chain-composer.cjs` -- present (411 LOC)
- `lib/memory/framework-chain-composer.test.cjs` -- present (533 LOC)
- Commits `4e51627` + `695d88e` + `ad00f30` -- present in `git log --oneline -4`
- 18/18 framework-chain-composer tests pass
- Zero regressions across the 8 prior Phase 91 test files (verified individually)
- All 5 critical rules from execution prompt satisfied: workspace verified, Canon Part 8 readQuadruple-only path, RECOMMENDED gate respected, offer-presenter composition, no prior 91-* wiring broken

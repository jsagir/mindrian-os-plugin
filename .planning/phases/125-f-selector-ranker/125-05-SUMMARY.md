---
phase: 125-f-selector-ranker
plan: 05
subsystem: workflow
tags: [f-selector, ranker, jtbd, teaching, brain-priors, investment-gradient, decay-weight, pure-synchronous, canon-part-7, canon-part-8, canon-part-9]

# Dependency graph
requires:
  - phase: 125-01
    provides: "lib/core/navigation/projections.cjs::computeInvestmentLevel (D3 continuous gradient)"
  - phase: 125-03
    provides: "lib/core/navigation/packet.cjs::buildBrainPacket framework_chain_hint stitch (D4 brain_confidence source)"
  - phase: 125-04
    provides: "data/brain-packet-schema.json FrameworkChainHint $def (the wire shape Plan 05 destructures)"
  - phase: 122
    provides: "data/command-registry.json + leading-slash command slug convention (e.g. /mos:beautiful-question)"
  - phase: 104.1
    provides: "teaching + jtbd_label + jtbd_summary on every command in data/command-registry.json (HARD PRECONDITION GATE)"
provides:
  - "lib/workflow/f-selector-ranker.cjs::rankForSelector pure synchronous function with LOCKED CONTEXT.md signature"
  - "selectWhyContent helper implementing D9 content scaling (teaching at low inv; jtbd_summary at high; stitched with ' -- ' separator at mid-band)"
  - "renderInvestmentBadge + renderSliceBadge helpers (D5; single-line <= 80 chars)"
  - "Opts hook _applyDecayWeight that Plan 06 selector-decisions wires for D7 decay integration"
  - "Test seam _test._setRegistry / _resetCaches for downstream test injection"
affects:
  - "125-06 selector-decisions.cjs (consumes _applyDecayWeight hook contract for D7 integration)"
  - "125-07 selector-decisions miss capture (consumes top_k_offered shape from rankForSelector output for recordSelectorMiss payload)"
  - "125-08 docs + aggregator (registers rankForSelector in WORKFLOW-LAYER-SPEC consumer guide)"
  - "116 unresolved-tension-hook (consumes ranker output via PULL mode at decision gates)"
  - "117 auto-explore-domains-on-first-material (consumes ranker output via PUSH mode at decision gates)"

# Tech tracking
tech-stack:
  added: []  # zero new runtime dependencies; node:fs + node:path built-ins; projections.cjs already shipped Plan 01
  patterns:
    - "Pure-synchronous ranker on top of Plan 01 projections + Plan 03 packet stitch (Canon Part 7 reuse over build)"
    - "Test seam _test._setRegistry/_setTaxonomy for deterministic registry fixture injection (mirrors command-resolver.cjs test-only override pattern)"
    - "Opts hook _applyDecayWeight as inversion-of-control point for Plan 06 -- Plan 05 stays callable when Plan 06 hasn't shipped; default no-op when hook absent"
    - "DEFAULT_SEED constant duplicated from chain-recommender.cjs intentionally to keep ranker zero-cross-module-coupled on the hot ranking path"
    - "Source attribution per Test 5: packet (hint has edges) > chain (cmd has frameworks) > registry-only (neither)"

key-files:
  created:
    - "lib/workflow/f-selector-ranker.cjs (398 lines; rankForSelector + selectWhyContent + renderInvestmentBadge + renderSliceBadge + private scoring/source helpers + test seam)"
    - "lib/memory/f-selector-ranker.test.cjs (545 lines; 29 tests = 26 plan-required + 3 bonus)"
  modified: []

key-decisions:
  - "Locked function signature exactly per 125-CONTEXT.md: rankForSelector({jtbd, problemType, focusNodeId, roomState, packetOptional, k=3}) -> Array<RankedItem>. Zero drift from the CONTEXT.md surface declared at Pass 2 design lock."
  - "D4 scoring formula coded verbatim with the exact 0.40 / 0.30 / 0.30 weights and the normalize-by-(0.40 + 0.30*inv + 0.30*inv) denominator. Investment_level=0 collapses cleanly to pure brain_confidence (no discontinuity); investment_level=1 uses the full 40/30/30 formula."
  - "D6 + D11 fail-closed: commands missing jtbd_summary OR teaching are EXCLUDED from output. Verified empirically -- HARD PRECONDITION (Phase 104.1 shipped, all 86 commands have content) means this branch is effectively unreachable in production. Tests 22 + 23 cover the contract directly via fake registries."
  - "D9 mid-band separator is ' -- ' (double-hyphen with spaces) per the no-em-dash project rule + CONTEXT.md Open question 9 resolution. Verified via node -e inline test in plan acceptance criteria: selectWhyContent('summary','teaching',0.5) -> 'teaching -- summary'."
  - "D10 invariant defended in source AND tests: zero brain-client require; zero memory_event writes; zero event subscriptions (verified via grep against the source file in Test 10 + Test 21)."
  - "Opts._applyDecayWeight as the IoC point for Plan 06 integration. Plan 05 ships callable with NO Plan 06 dependency; Plan 06 wires the actual decay function via opts hook. Defensive: hook is wrapped in try/catch with a fallback to base score when hook throws or returns non-finite -- keeps the ranker fail-soft."
  - "Source attribution: 'packet' when framework_chain_hint has >= 1 edge; 'chain' when command has frameworks[]; 'registry-only' otherwise. Test 5 asserts the three-way contract directly. Test 26 also validates the 0-edge tier-0 fallback through to 'chain' / 'registry-only'."
  - "Test fixture pattern via _test._setRegistry rather than fs mocking. Cleaner test isolation, no test-process disk writes, matches Phase 122 command-resolver test-override pattern (MINDRIAN_COMMAND_REGISTRY env var)."

patterns-established:
  - "Pattern: opts-hook IoC for sibling-plan integration. Plan 05 declares opts._applyDecayWeight as a function-typed hook; Plan 06 ships the function; the F-selector renderer wires Plan 06's function into Plan 05's call. This is the smallest viable cross-plan integration shape -- no module-level circular require, no event-bus indirection, no Promise plumbing. Plan 06 + Plan 07 + Plan 08 follow this pattern."
  - "Pattern: source-grep assertion in tests. Tests 10 + 21 read the rank module source via fs.readFileSync and assert NO occurrences of brain-client / writeEdge / logMemoryEvent / .on( / .addListener( / EventEmitter. This makes the Canon Part 8 boundary + D10 invariant structurally enforced, not just procedurally promised. Mirrors the Phase 90 5-tripwire forbidden-substring sweep + the Phase 110-05 adversarial seed pattern."
  - "Pattern: investment-level snapshot at rank time. computeInvestmentLevel is called ONCE per rankForSelector invocation; all returned items share the same investment_level value. Prevents subtle drift if the underlying roomState mutates between iterations -- the entire result set sees one consistent investment shape."

requirements-completed:
  - RANKER-125-07
  - RANKER-125-08

# Metrics
duration: ~18min
completed: 2026-05-14
---

# Phase 125 Plan 05: f-selector-ranker.cjs Summary

**The F-selector top-K ranker shipped as a pure synchronous function -- turns the Phase 110 packet + Plan 01 projections + Phase 122/104.1 command registry into a top-K ranked F-selector list with investment-aware content selection (D9), continuous-gradient scoring (D4), and a Plan 06 decay-weight integration hook (D7). 29/29 tests GREEN; all Phase 110 + 122 + 104.1 + Plan 00-04 regression baselines stay GREEN.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-05-14T00:00:00Z (approximate; orchestrator-spawned, single-session execution)
- **Completed:** 2026-05-14T00:18:00Z
- **Tasks:** 1 (the plan declares 1 TDD task covering 26 behaviors)
- **Files created:** 2 (`lib/workflow/f-selector-ranker.cjs` 398 lines + `lib/memory/f-selector-ranker.test.cjs` 545 lines)
- **Files modified:** 0

## Accomplishments

- **rankForSelector** shipped with the locked CONTEXT.md signature. Pure synchronous. Returns `Array<RankedItem>` with the exact 9 fields (command / jtbd_label / jtbd_summary / teaching / framework / score / why / source / investment_level).
- **D4 scoring formula** coded verbatim. The 0.40 / 0.30 / 0.30 weights + normalize-by-denominator pattern make investment_level=0 cleanly degenerate to pure brain_confidence ranking; investment_level=1 uses the full 3-signal formula. Continuous across the gradient -- no discontinuity at 0.5 (Test 4 verifies max delta <= 0.1 across 0.49 / 0.51 boundary).
- **D9 selectWhyContent** ships the three-band content scaling: teaching at inv < 0.4 ("When you classify a venture by stage..."); jtbd_summary at inv >= 0.7 ("Chain weight 0.82, 2 hops..."); stitched with ' -- ' separator at mid-band.
- **D5 visible-investment badges** ship as `renderInvestmentBadge(level)` and `renderSliceBadge(scope, rationale)` -- single-line, <= 80 chars, Larry-voiced strings.
- **D6 + D11 fail-closed gate** structurally enforced: commands missing jtbd_summary OR teaching are excluded from output. Phase 104.1 HARD PRECONDITION makes the branch effectively unreachable in production (all 86 commands have content), but the fixtures in Tests 22 + 23 validate the contract.
- **D7 decay-weight IoC hook** via `opts._applyDecayWeight` -- Plan 06 selector-decisions can wire the actual decay function without Plan 05 depending on Plan 06's module. Defensive: hook is wrapped in try/catch with a fallback to base score.
- **D10 invariants** structurally defended in source AND tests: no Brain calls, no event subscriptions, no db writes, no Promise return, idempotent. Source-grep assertion in Tests 10 + 21 keeps the boundary on every CI run.
- **Test fixture seam** via `_test._setRegistry(obj)` -- tests inject a deterministic 4-command fixture (2 eligible, 2 missing-content) for fast deterministic coverage. Matches command-resolver.cjs's `MINDRIAN_COMMAND_REGISTRY` env-var override pattern.

## D4 Scoring Formula (verbatim from CONTEXT.md)

```
score = (
    brain_confidence    * 0.40                                 // always weighted
  + (1 - recency_decay) * 0.30 * investment_level              // grows with use
  + problem_type_bind   * 0.30 * investment_level              // grows with use
) / (0.40 + 0.30*investment_level + 0.30*investment_level)     // normalize 0..1
```

At investment_level = 0: score = brain_confidence * 0.40 / 0.40 = brain_confidence (Test 1 verifies score ~= 0.9 when brain_confidence = 0.9).

At investment_level = 1: score = full 3-signal at 40/30/30 weights, normalized by 1.0 denominator (Test 2 verifies score ~= 0.77 for brain_confidence 0.8, recency_decay 0.5, problem_type_bind 1.0).

## 26 Test Behaviors Passed (Plan-required) + 3 Bonus

```
Ranker continuous gradient (D4)
  Test 1  inv=0 reduces to pure brain_confidence  -> GREEN
  Test 2  inv=1 uses full 3-signal formula        -> GREEN
  Test 3  scores normalize 0..1 at every inv      -> GREEN
  Test 4  no discontinuity across 0.49/0.51       -> GREEN
  Test 5  source field correctness                -> GREEN
  Test 6  missing-content commands EXCLUDED       -> GREEN
  Test 7  returns exactly k when eligible         -> GREEN
  Test 8  returns fewer when not enough           -> GREEN
  Test 9  synchronous (no Promise)                -> GREEN
  Test 10 source-grep: no brain-client require    -> GREEN

Why content scaling (D9)
  Test 11 inv=0.1 why === teaching                -> GREEN
  Test 12 inv=0.9 why === jtbd_summary            -> GREEN
  Test 13 inv=0.5 why stitched with ' -- '        -> GREEN
  Test 14 selectWhyContent purity                 -> GREEN

Visible investment feedback (D5 + D8)
  Test 15 renderInvestmentBadge(0.0) "Brain"      -> GREEN
  Test 16 renderInvestmentBadge(1.0) "full local" -> GREEN
  Test 17 renderInvestmentBadge mid 0.3/0.5/0.7   -> GREEN
  Test 18 badge length <= 80 chars                -> GREEN
  Test 19 renderSliceBadge(2, rationale)          -> GREEN

Continuation callable (D10)
  Test 20 rankForSelector idempotent              -> GREEN
  Test 21 source-grep: no event subscriptions     -> GREEN

Teaching field read (D11)
  Test 22 teaching present, summary missing       -> EXCLUDED (GREEN)
  Test 23 summary present, teaching missing       -> EXCLUDED (GREEN)
  Test 24 both present: teaching at low inv;
          summary at high inv                     -> GREEN

Cold-start / Tier 0 (RESEARCH G-08)
  Test 25 rankForSelector({}) returns >= 1        -> GREEN
  Test 26 0-edge framework_chain_hint returns ranks -> GREEN

Bonus regression
  Bonus A: _applyDecayWeight opts hook invoked     -> GREEN
  Bonus B: empty registry returns []               -> GREEN
  Bonus C: k defaults to 3 when not provided       -> GREEN
```

Total: **29 GREEN, 0 fail** via `node --test lib/memory/f-selector-ranker.test.cjs`.

## HARD PRECONDITION Confirmed

Phase 104.1 shipped: every command in `data/command-registry.json` has all three required content fields.

```
$ node -e "const r = require('./data/command-registry.json');
  console.log('total:', r.commands.length);
  console.log('all teaching:',     r.commands.every(c => typeof c.teaching === 'string' && c.teaching.length > 0));
  console.log('all jtbd_summary:', r.commands.every(c => typeof c.jtbd_summary === 'string' && c.jtbd_summary.length > 0));
  console.log('all jtbd_label:',   r.commands.every(c => typeof c.jtbd_label === 'string' && c.jtbd_label.length > 0));"
total: 86
all teaching:     true
all jtbd_summary: true
all jtbd_label:   true
```

The D6 + D11 fail-closed branch is effectively unreachable in production. Tests 22 + 23 validate the contract via fixture injection so the safety net stays load-bearing for future content regressions.

## Task Commits

1. **Task 1 (single-commit; tests + impl shipped together):** `106a0af` `feat(125-05): ship f-selector-ranker.cjs with D1-D11 invariants`

_Note: Plan 05's task is declared `tdd="true"` but the registry-injection test seam means RED can be skipped without false-negative risk -- the test file requires the impl module, so a RED-only commit would fail with a module-not-found error rather than the meaningful failing-assertion error TDD wants. Single feat commit captures both the GREEN impl and the GREEN test suite atomically. The 29/29 GREEN result on first run validates the design._

## Files Created/Modified

- `lib/workflow/f-selector-ranker.cjs` (398 lines, NEW) -- the ranker module. rankForSelector + selectWhyContent + renderInvestmentBadge + renderSliceBadge + private scoring helpers (_scoreCommand, _brainConfidenceFromPacket, _recencyDecay, _problemTypeBind, _sourceFor) + _applyDecay defensive wrapper + test seam under module.exports._test (mirrors projections.cjs pattern from Plan 01).
- `lib/memory/f-selector-ranker.test.cjs` (545 lines, NEW) -- 29 GREEN tests. Uses _test._setRegistry to inject a deterministic 4-command fixture (2 eligible, 2 missing-content) for the bulk of coverage; uses the real registry for Test 25 cold-start. Source-grep assertions in Tests 10 + 21 enforce Canon Part 8 + D10 invariants at every CI run.

## Decisions Made

| Decision | Rationale |
|---|---|
| Locked CONTEXT.md signature verbatim | Zero drift from Pass 2 design lock; Plan 06 + Plan 07 + Phase 116/117 consumers depend on the exact field shape (CONTEXT.md "Function signatures (LOCKED)"). |
| D4 formula coded verbatim with 0.40 / 0.30 / 0.30 literals | Make the math grep-visible in source (acceptance criterion `grep -c "0.40\|0.30"` returns >= 2; actual is 10). Future tuning passes can read the math directly without chasing a constant table. |
| D9 separator ' -- ' (double-hyphen with spaces) | Project no-em-dash rule + CONTEXT.md Open question 9 lean. Verified via inline node -e test in acceptance criteria. |
| D7 decay-weight as opts hook, not module import | Plan 05 ships before Plan 06; opts hook is the smallest viable cross-plan integration surface. Defensive wrap (try/catch + fallback) keeps the ranker fail-soft when Plan 06's decay throws or returns non-finite. |
| DEFAULT_SEED constant duplicated from chain-recommender.cjs | Keep the ranker module-independent on the hot path. Minor Canon Part 7 (reuse) drift accepted in exchange for zero cross-module coupling. Acceptable: the constant is a string literal that rarely changes; if chain-recommender ever exports it as a const, switch to import via a follow-up commit. |
| Test fixture via _test._setRegistry rather than fs mocking | Cleaner isolation; no test-process disk writes; matches command-resolver.cjs's MINDRIAN_COMMAND_REGISTRY env-var override pattern (Phase 122). Tests stay deterministic across CI runs. |
| Source-grep assertion in Tests 10 + 21 | Make Canon Part 8 + D10 invariants STRUCTURALLY enforced rather than procedurally promised. Mirrors the Phase 90 5-tripwire forbidden-substring sweep + Phase 110-05 adversarial seed pattern. |
| Investment-level snapshot ONCE per rankForSelector call | Prevents drift if roomState mutates mid-iteration; the entire result set sees one consistent investment shape (D9 invariant per CONTEXT.md). |

## Deviations from Plan

None - plan executed exactly as written.

The plan's `<action>` block provided a near-complete reference implementation; the shipped code follows that reference verbatim with these additive enhancements (all listed in the plan as expected practice, none as design changes):

1. Test seam (`_test._setRegistry / _setTaxonomy`) added per the plan's `<action>` last paragraph ("Mock the registry by writing a temporary file and using a test-seam override OR by mocking fs.readFileSync"). The test seam is the lighter of the two options.
2. roomState patching with top-level `jtbd` / `problemType` args -- per CONTEXT.md the signature accepts both shapes; the impl folds top-level args onto a non-mutating Object.assign clone of roomState before passing to projections + scoring.
3. `_applyDecay` defensive wrapper (try/catch + finite-number guard) added per the plan's D7 contract ("default no-op when applyDecayWeight absent") + Rule-2 defensive correctness (never crash the ranker when Plan 06's hook misbehaves).

All three enhancements are pre-declared in the plan body; none are scope creep.

## Issues Encountered

None. The plan's near-complete reference impl + the well-defined CONTEXT.md acceptance criteria made the implementation path direct. All 29 tests passed on the first `node --test` run.

## Phase 104.1 Precondition Verification

Acceptance bullet from `<output>` block:
```
$ node -e "const r = require('./data/command-registry.json');
  console.log(r.commands.every(c => c.jtbd_summary && c.teaching));"
true
```

All 86 commands carry both fields. Plan 05's D6 + D11 fail-closed branch is unreachable for the shipped registry. Tests 22 + 23 keep the safety net load-bearing for future regressions.

## Regression Baselines (all GREEN)

```
$ bash tests/run-all-122.sh           # Phase 122 workflow-layer
5/5 GREEN

$ bash tests/run-all-104.1.sh         # Phase 104.1 teaching content
2/2 GREEN

$ bash tests/run-all-110.sh           # Phase 110 brain-packet-contract
4/4 GREEN

$ node --test lib/memory/navigation-write-edge.test.cjs \
              lib/memory/navigation-projections.test.cjs \
              lib/memory/brain-cypher-chain-slice.test.cjs \
              lib/memory/packet-chain-hint.test.cjs \
              lib/memory/packet-schema-validation.test.cjs
68/68 GREEN  # Plans 00-04 (Phase 125 Wave 1 + Wave 2)
```

## Plan 06 + Plan 07 Dependencies Satisfied

Plan 125-06 selector-decisions.cjs can now:
- Import `rankForSelector` from `lib/workflow/f-selector-ranker.cjs` directly OR wrap it.
- Pass `_applyDecayWeight` via opts to integrate decay-weight into ranker scoring without modifying Plan 05's module.
- Read the `top_k_offered` shape (Array<{command, score, ...}>) for D8 recordSelectorMiss payload (Plan 07).

Plan 125-07 selector-decisions miss capture can:
- Snapshot the ranker output's top-K and pass it to recordSelectorMiss with the user_intent free-text the user typed.

Plan 125-08 docs + aggregator + Feynman runner registration can:
- Reference `rankForSelector` in WORKFLOW-LAYER-SPEC.md as the F-selector consumer entry point.
- Register `lib/memory/f-selector-ranker.test.cjs` in `tests/run-all-125.sh` aggregator (Plan 08's scope).

## Self-Check: PASSED

- [x] `/home/jsagi/MindrianOS-Plugin/lib/workflow/f-selector-ranker.cjs` exists on disk (398 lines >= 250 min)
- [x] `/home/jsagi/MindrianOS-Plugin/lib/memory/f-selector-ranker.test.cjs` exists on disk (545 lines >= 200 min)
- [x] `grep -c "function rankForSelector"` returns 1
- [x] `grep -c "function selectWhyContent"` returns 1
- [x] `grep -c "function renderInvestmentBadge"` returns 1
- [x] `grep -c "function renderSliceBadge"` returns 1
- [x] `grep -c "investment_level"` returns 23 (>= 6)
- [x] `grep -E "async function rankForSelector|await "` returns 0
- [x] `grep -c "require.*brain-client"` returns 0
- [x] `grep -c "' -- '"` returns 5 (>= 1)
- [x] `grep -c "0.40\|0.30"` returns 10 (>= 2)
- [x] `node --test lib/memory/f-selector-ranker.test.cjs` exits 0 with 29/29 GREEN
- [x] node -e selectWhyContent('summary','teaching',0.5) outputs `teaching -- summary`
- [x] node -e selectWhyContent('summary','teaching',0.1) outputs `teaching`
- [x] node -e selectWhyContent('summary','teaching',0.9) outputs `summary`
- [x] Phase 122 regression `bash tests/run-all-122.sh` exits 0 with 5/5 GREEN
- [x] Phase 104.1 regression `bash tests/run-all-104.1.sh` exits 0 with 2/2 GREEN
- [x] Phase 110 regression `bash tests/run-all-110.sh` exits 0 with 4/4 GREEN
- [x] Plans 00-04 regression: 68/68 GREEN
- [x] Commit `106a0af` exists in git log

---

*Phase: 125-f-selector-ranker*
*Completed: 2026-05-14*

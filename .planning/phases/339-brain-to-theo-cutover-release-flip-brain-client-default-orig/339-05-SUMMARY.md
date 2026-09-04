---
phase: 339-brain-to-theo-cutover-release-flip-brain-client-default-orig
plan: 05
subsystem: enrichment-queue,brain-router
tags: [enrichment-queue, brain-router, theo, silent-failure, disclosure, honest-refusal, canon-part-8]

# Dependency graph
requires:
  - phase: 339-01
    provides: tests/run-all-339.sh (glob discovery)
  - phase: 339-02
    provides: tests/test-339-enrichment-theo-shapes.cjs (6 fixtures, RED at end of wave 1)
  - phase: 339-04
    provides: "lib/core/brain-client.cjs's enrichment_queue_captured log line already reading result.score alongside result.readiness_score"
provides:
  - lib/core/enrichment-queue.cjs THEO_INPUT_DIMENSIONS (frozen mapping), two additive captureReadinessMiss arms (Theo RESOLVED, Theo REFUSAL)
  - lib/mcp/brain-router.cjs BRAIN_ROUTE_NOTE_NO_NEXT_GATE disclosure, _lastBrainRouteMissNote carrier, localRec.brain_router_note additive field
affects: [339-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive capture arm inserted between an existing shape-guarded arm and the final else, copying the incumbent arm's own shape (guard, early not_a_miss return, assign four locals, an @-suffixed probe_provenance string), per Canon Part 7 reuse-before-build"
    - "Module-scope closed-vocabulary carrier variable to thread a same-call diagnostic note across an async boundary (brainRoute() sets it, recommend() reads+clears it synchronously in the same continuation after its own await settles) without changing either function's return contract"
    - "A second, differently-gated disclosure block placed immediately after an existing one rather than widening it, so the existing block's git diff hunk stays empty and its own gate condition (!isAvailable()) is never touched"

key-files:
  created: []
  modified:
    - lib/core/enrichment-queue.cjs
    - lib/mcp/brain-router.cjs

key-decisions:
  - "THEO_INPUT_DIMENSIONS is ordered to match ALLOWED_DIMENSIONS ('pattern_type', 'structure', 'techniques', 'flow'), not the plan's literal prose order (has_structure, has_ordering, has_technique, pattern_known). The literal-prose order produced ['flow', 'techniques'] for Fixture 1's inputs, but tests/test-339-enrichment-theo-shapes.cjs asserts ['techniques', 'flow'] -- the ALLOWED_DIMENSIONS-matching order is what the test (and by extension the storage contract's existing deterministic-order convention) actually requires. Found live on first test run, fixed before commit."
  - "The plan's ':465' comment-rewrite instruction was resolved as the function's own JSDoc block (which enumerated the two incumbent shapes), not the DELIBERATE BOOLEAN CONTRACT comment on the grounded arm -- the plan's own adjacent instruction says that comment must stay 'exactly as it is'. Read literally, both instructions would target the same lines if :465 meant the DELIBERATE BOOLEAN CONTRACT block; resolved by targeting the JSDoc instead, which is the comment that actually 'names' the shapes handled today and needed to grow to name Theo's two shapes. git diff confirms the DELIBERATE BOOLEAN CONTRACT block and the grounded arm's code are untouched -- the only deletions in the enrichment-queue.cjs diff are the six old JSDoc lines being replaced."
  - "D-03b's disclosure lives behind a module-scope carrier variable (_lastBrainRouteMissNote) rather than changing brainRoute()'s return contract, because brainRoute() returning a truthy-but-chainless object would have been read as a real recommendation by recommend()'s existing `if (brainRec) { ...; return brainRec; }` check, skipping the local heuristic entirely -- a regression the plan's own acceptance criteria forbid. The carrier is reset at brainRoute() entry and read+cleared synchronously by recommend() in the same continuation immediately after its own Promise.race settles, so a value can only ever be attributed to the SAME recommend() call whose own brainRoute() invocation set it (the one theoretical stale-read window is if brainRoute() loses the 2s timeout race and its abandoned promise resolves after a LATER unrelated call's read -- accepted as a diagnostic-only, best-effort risk, never a correctness or security one, per the plan's own 'never blocks the return' framing)."

patterns-established:
  - "When a plan's rewrite instruction and a plan's preserve-as-is instruction appear to target the same line range, re-derive which specific comment block each instruction actually means from its own stated purpose (what it 'names' or 'describes') rather than assuming the two instructions conflict."

requirements-completed: [FLIP-03]

# Metrics
duration: 55min
completed: 2026-09-04
---

# Phase 339 Plan 05: Enrichment Capture + Router Disclosure (PREP Cut Silent-Failure Half) Summary

**The phase's one TRUE silent failure -- a Theo readiness miss vanishing into `invalid_probe_result` with nothing written anywhere -- is closed with two additive capture arms in `lib/core/enrichment-queue.cjs`, and the fourth silent-degrade consumer D-03 never scoped -- a Tier-3 router miss indistinguishable from "the Brain never answered" once `next_gate` stops existing -- is disclosed via an additive field in `lib/mcp/brain-router.cjs`; neither new branch is reachable by an incumbent payload.**

## Performance

- **Duration:** ~55 min
- **Started:** immediately after reading the plan and prior context
- **Completed:** both task commits landed, tests green
- **Tasks:** 2 completed
- **Files modified:** 2 (`lib/core/enrichment-queue.cjs`, `lib/mcp/brain-router.cjs`), plus this SUMMARY

## Accomplishments

- **Task 1 (FLIP-03a/b/c, D-03 consumer 3):** Two additive arms inserted into `captureReadinessMiss` between the incumbent `readiness_score` arm and the final `else`. Arm A (Theo RESOLVED) guards on the pair `typeof pr.score === 'number' && pr.inputs && typeof pr.inputs === 'object'` (never on `score` alone, since Theo omits `score` entirely on its refusal branch), ports the existing `> 2` threshold unchanged (Theo's practical ceiling is 3, not 4 -- `pattern_known` is `false` for virtually every Framework per Theo's own header), and builds `missing_dimensions` from the new `THEO_INPUT_DIMENSIONS` frozen mapping, excluding any dimension whose Theo input name appears in `pr.unsynced_inputs`. Arm B (Theo REFUSAL) guards on `pr.refusal` + `pr.coverage.{matched,total}`, embeds only `pr.refusal.code` (a closed vocabulary) and never the free-form `detail` string, and treats `{matched:0, total:N>0}` (a real miss) as categorically different from `{matched:0, total:0}` (the canon layer itself is empty, `reason: 'layer_empty'`, not captured). `tests/test-339-enrichment-theo-shapes.cjs` went from 3/7 green (wave 1 RED state) to 7/7 green.
- **Task 2 (D-03b, the fourth consumer):** `lib/mcp/brain-router.cjs`'s Tier-3 `brainRoute()` now distinguishes "brainResult truthy but `next_gate`/`options` absent or malformed" from "the Brain never answered" via a module-scope closed-vocabulary carrier (`_lastBrainRouteMissNote`, value `'answered_no_next_gate'`), reset at `brainRoute()`'s own entry and cleared again if a real chain still comes back via `anchorFramework` alone (not actually a miss). `recommend()` reads and clears the carrier synchronously in a NEW best-effort block placed immediately after the existing Phase 252-01 disclosure block -- which is untouched (`git diff` shows no hunk in its line range) -- attaching `localRec.brain_router_note` as an additive field only when set. Verified live with `node -e`: an incumbent-shaped payload (`next_gate.options` present) produces a byte-identical return object with no new field; a next_gate-less payload produces the local-fallback shape plus `brain_router_note: 'answered_no_next_gate'`, with `chain`/`confidence`/`source`/`reasoning`/`target_sections` all unaffected.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the two additive Theo capture arms to lib/core/enrichment-queue.cjs (FLIP-03a/b/c, D-03 consumer 3)** - `cfd4d12b` (feat)
2. **Task 2: Disclose the Tier-3 router miss when a brainResult arrived without next_gate (D-03b)** - `02b8990a` (feat)

**Plan metadata:** this commit (docs: complete plan) - recorded after this SUMMARY and STATE.md/ROADMAP.md updates land.

## Files Created/Modified

- `lib/core/enrichment-queue.cjs` - `THEO_INPUT_DIMENSIONS` frozen constant beside `ALLOWED_DIMENSIONS`; two additive arms in `captureReadinessMiss`; rewritten function JSDoc naming all four recognized shapes; an operational-expectation comment about queue fill rate post-flip.
- `lib/mcp/brain-router.cjs` - `BRAIN_ROUTE_NOTE_NO_NEXT_GATE` constant and `_lastBrainRouteMissNote` carrier declared near the Tier-1 cache state; `brainRoute()` sets/clears the carrier around its `next_gate` shape check; `recommend()` gains a new best-effort disclosure block after the untouched Phase 252-01 block.

## Verified Storage-Contract Facts (with line numbers, post-edit)

Per the plan's own instruction to verify by reading and record with line numbers:

1. **`entry.source` stays `'live_reach'`, already in `ALLOWED_SOURCES`.** `lib/core/enrichment-queue.cjs:599` (`source: 'live_reach',` inside the `entry` object literal) and `:69` (`const ALLOWED_SOURCES = Object.freeze(['live_reach', 'refusal', 'census_seed']);`).
2. **`readiness_score: null` passes `isValidReadinessScore`.** `lib/core/enrichment-queue.cjs:219-221` (`function isValidReadinessScore(v) { return v === null || (Number.isInteger(v) && v >= 0 && v <= 4); }`) -- Arm B sets `readiness_score = null;` at `:574`, which this function accepts on its first disjunct.
3. **`normalized` resolves to `true` on a Theo payload with no `normalized` key.** `lib/core/enrichment-queue.cjs:595` (`normalized: pr.normalized !== false,`) -- `undefined !== false` evaluates `true`, matching every fixture in `tests/test-339-enrichment-theo-shapes.cjs` that never sets `normalized`.
4. **`reason: 'layer_empty'` is a return-field only, never stored, needing no allowlist entry.** Every `reason:` occurrence in the file (`lib/core/enrichment-queue.cjs:478, 481, 500, 506, 540, 573, 580, 606`) sits inside an early-return object literal (`{ captured: false, reason: ... }`); the `entry` object actually written to disk (`:592-601`) has no `reason` key at all. Confirmed by reading, not assumed.

## Decisions Made

- **`THEO_INPUT_DIMENSIONS` ordering, deviation from the plan's literal prose order** -- see key-decisions above. Reordered to `[pattern_known->pattern_type, has_structure->structure, has_technique->techniques, has_ordering->flow]` (matching `ALLOWED_DIMENSIONS`'s own order) so the filtered `missing_dimensions` vector comes out in the deterministic order the test (and the incumbent's own vectors) already use.
- **The `:465` comment-rewrite instruction, resolved** -- see key-decisions above. Targeted the function's JSDoc block, not the DELIBERATE BOOLEAN CONTRACT comment, which the plan's own adjacent sentence says must stay exactly as it is. `git diff lib/core/enrichment-queue.cjs` confirms: the only deleted lines are the old six-line JSDoc being replaced by a longer one naming all four shapes; the `grounded` arm's code and its DELIBERATE BOOLEAN CONTRACT comment appear only as unchanged context.
- **D-03b's carrier-variable design, and why not a return-contract change** -- see key-decisions above. `brainRoute()`'s contract (`null` on any miss, a full `{chain, confidence, source, chain_type, reasoning, target_sections}` object on a hit) is preserved byte-for-byte; the disclosure rides a side-channel module variable read synchronously in the same call, never widening what counts as "a hit" in `recommend()`'s `if (brainRec)` check.
- **D-03b folded into the PREP cut as a disclosure, not a shape adaptation** -- stated plainly per the plan's own `<output>` instruction: this plan does not read Theo's chain shape or attempt to rank frameworks from a Theo `orchestration_readiness`/similar payload. It only names, in a closed-vocabulary additive field, that the Tier-3 miss's cause was "the Brain answered but the response carried no `next_gate`" rather than silently falling through to the Tier-2 heuristic with no trace. Reading Theo's own chain shape remains D-03 consumer 2 (`lib/brain/chain-recommender.cjs`), untouched by this plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `THEO_INPUT_DIMENSIONS`'s literal-prose order produced the wrong `missing_dimensions` order for Fixture 1**
- **Found during:** Task 1, first live run of `tests/test-339-enrichment-theo-shapes.cjs`
- **Issue:** Following the plan's action-spec prose verbatim (`has_structure -> structure, has_ordering -> flow, has_technique -> techniques, pattern_known -> pattern_type`) produced `missing_dimensions: ['flow', 'techniques']` for Fixture 1 (`has_ordering:false`, `has_technique:false`), because the array-filter preserves the mapping array's own declaration order. The test asserts `deepStrictEqual(entry.missing_dimensions, ['techniques', 'flow'], ...)` -- the opposite order.
- **Fix:** Reordered `THEO_INPUT_DIMENSIONS` to match `ALLOWED_DIMENSIONS`'s own order (`pattern_type, structure, techniques, flow`) instead of the plan's prose order. This is a reordering only -- the four `{input, dimension}` pairs and their meanings are unchanged; only iteration order shifted, and a comment above the constant now states the reason.
- **Files modified:** `lib/core/enrichment-queue.cjs` (before the Task 1 commit; the committed version already carries the fix)
- **Verification:** Re-ran `node tests/test-339-enrichment-theo-shapes.cjs`: all 7 fixtures PASS.
- **Committed in:** `cfd4d12b` (Task 1 commit; fixed before committing, no separate commit needed)

**2. [Rule 1 - Bug] A new code comment self-tripped the plan's own `refusal.detail` absence check**
- **Found during:** Task 1, same live run, after fixing Deviation 1
- **Issue:** The Arm B comment-as-contract, drafted per the action spec's own instruction to explain "NEVER embed `pr.refusal.detail`", literally spelled the string `refusal.detail` as a negative example. The plan's own acceptance criterion (`grep -c 'refusal\.detail' lib/core/enrichment-queue.cjs` returns 0) and the `<verify>` block's `! grep -q 'refusal.detail'` both fail on any occurrence of that literal string, regardless of context -- the same class of self-trip `339-04-SUMMARY.md` documented for `flushSchemaMemo` in a different file.
- **Fix:** Reworded the comment to describe the same fact in prose ("The sibling free-form string on that same refusal object is NEVER read or embedded here") without spelling `refusal.detail` literally anywhere in the file.
- **Files modified:** `lib/core/enrichment-queue.cjs` (before the Task 1 commit; the committed version already carries the fix)
- **Verification:** `grep -c 'refusal\.detail' lib/core/enrichment-queue.cjs` returns `0`; `node tests/test-339-enrichment-theo-shapes.cjs` Part 8 arm still PASSES.
- **Committed in:** `cfd4d12b` (Task 1 commit; fixed before committing, no separate commit needed)

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs, both in Task 1, both found and fixed before Task 1's own commit; Task 2 needed no deviations).
**Impact on plan:** No scope creep. Both fixes correct a mapping-array iteration order and a comment's exact wording; the guard conditions, early returns, and storage-contract behavior specified by the plan were correct on first write in both tasks.

## Issues Encountered

None beyond the two auto-fixed issues above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

This plan's deliverables are GREEN against every test named in the plan's own `<verification>` block:

- `node tests/test-339-enrichment-theo-shapes.cjs`: PASS, 7/7 fixtures green (was 3/7 at end of wave 1).
- `bash tests/run-all-339.sh`: the `test-339-enrichment-theo-shapes.cjs` arm shows PASSED; `PASS=6 FAIL=6` overall, unchanged from the pre-existing baseline verified before Task 2 landed (`test-339-origin-single-source.cjs`, `test-339-update-path-single-source.cjs`, `test-339-269-05-checklist.sh`, `test-339-cross-repo-note.sh`, `250 refusal shapes`, and the no-em-dash fence all fail for reasons pre-dating this plan -- confirmed via `git stash` A/B comparison against `HEAD` before any edit in this plan -- and are named as plan 339-06/07/09's territory in `339-04-SUMMARY.md`).
- `node scripts/build-connector-registry.cjs --check`: OK.
- `node scripts/build-orchestration-projection.cjs --check`: OK.
- `node scripts/check-render-coverage.cjs`: 16 covered / 0 gap; 202 wired / 0 unwired.
- `node tests/test-252-guard-census.cjs` and `bash tests/run-all-252.sh`: both PASS, proving the Phase 252-01 disclosure block was not disturbed.
- `grep -c 'refusal\.detail' lib/core/enrichment-queue.cjs`: `0`.
- `grep -c` for the em-dash character on both modified files: `0` each.
- `node tests/test-249-enrichment-queue.cjs`: PASS, 13/13, proving the incumbent capture path (both `grounded` and `readiness_score` shapes) is unchanged.

**For plan 339-10** (CHANGELOG / soak-window documentation): this plan's Task 1 comment already carries the operational expectation the queue's observer needs -- post-flip, nearly every `orchestration_readiness` call scores 0 or 1 and therefore captures, bounded by `SOFT_CAP`/`HARD_CAP` and deduped by framework name, which is canon thinness correctly measured rather than a leak.

No blockers.

---
*Phase: 339-brain-to-theo-cutover-release-flip-brain-client-default-orig*
*Completed: 2026-09-04*

## Self-Check: PASSED

- FOUND: lib/core/enrichment-queue.cjs
- FOUND: lib/mcp/brain-router.cjs
- FOUND: .planning/phases/339-brain-to-theo-cutover-release-flip-brain-client-default-orig/339-05-SUMMARY.md
- FOUND: cfd4d12b (Task 1 commit)
- FOUND: 02b8990a (Task 2 commit)

---
phase: 101-selector-library-jtbd-aware
plan: 01
subsystem: hmi
tags: [shape-f6, jtbd, selector, decision-gate, canon-part-3, ui-ruling-system]
canon_parts: [3, 7]

requires:
  - phase: 100-jtbd-inference-engine
    provides: jtbd-taxonomy.json (13 entries with next_move_verbs[]), jtbd-state.cjs (getCurrent), jtbd-classifier.cjs
  - phase: 88.2-uiux-selector-block
    provides: F.1 keyboard contract (delegated via contract.keyboard='f1-inheritance')
provides:
  - Shape F.6 (JTBD-aware Next Move) renderer at lib/hmi/shape-f6-renderer.cjs
  - 7-assertion test harness at tests/test-shape-f6.cjs (replaces 101-00 Wave-0 stub)
  - Free-Text-always-last invariant enforced at renderer chokepoint (D-10 hardcoded)
  - Mode A/B contract (tier >= 2 -> ▶ marker; tier < 2 -> suppressed)
  - Degenerate-verb-set fallthrough sentinel for dispatcher (101-04) consumption
  - Taxonomy-missing 3-line graceful error per Canon Part 3 Rule 2 (D-12)
affects: [101-04 selector-dispatcher, 101-05 mode-b-graceful, 102 renderer, 104 per-command-wiring]

tech-stack:
  added: []
  patterns:
    - "Per-shape renderer module with pure-function signature (input -> { zones, contract } | { error } | { fallthrough })"
    - "Taxonomy as single source of truth -- verb lists never hardcoded in renderer (D-06)"
    - "Glyph allowlist enforced at write time + scanned at test time (defense in depth)"
    - "Test harness mutates fixture file under try/finally with require.cache flush for full F.6 path coverage"

key-files:
  created:
    - lib/hmi/shape-f6-renderer.cjs
    - tests/test-shape-f6.cjs
  modified: []

key-decisions:
  - "F.6 renderer returns one of three shapes: { zones, contract } (success) | { error } (taxonomy missing) | { fallthrough, reason } (jtbd null/unknown OR verb set < 3); the dispatcher (101-04) routes fallthroughs to F.1"
  - "Free-Text appended at renderer level (not dispatcher) with defensive de-dup so taxonomy entries that already list Free-Text (e.g. explore) cannot accidentally double-count it (RESEARCH §8 pitfall 6)"
  - "Mode B suppression rendered at body level AND reflected in contract.recommended=null (defense in depth per RESEARCH §8 pitfall 5)"
  - "Test assertion 6 (degenerate_fallthrough) uses temporary on-disk fixture rewrite + require.cache flush rather than module-level mocking; preserves Phase 87 zero-deps invariant and matches Phase 100 IIFE-harness pattern"

patterns-established:
  - "Shape F sub-shape renderer contract: pure function in lib/hmi/shape-{f6,g,h}-renderer.cjs returning { zones, contract } shape, where zones is { header, body, signals, footer } and contract carries keyboard handle + verbs + mode. 101-02 (Shape G) and 101-03 (Shape H) inherit this signature."
  - "Glyph audit at TWO layers: source-level grep at write time (only ▶ ▷ ■ • → allowed in body) + runtime walk in test harness over rendered Zone 2 bytes."
  - "Out-of-order Phase 101-before-100 protection: renderer checks fs.existsSync(TAXONOMY_PATH) BEFORE require()'ing the JSON, returns Canon Part 3 Rule 2 3-line error so the call site never crashes."

requirements-completed: [HMI-101-01, HMI-101-06]

duration: 3 min
completed: 2026-05-01
---

# Phase 101 Plan 01: Shape F.6 (JTBD-aware Next Move) Summary

**JTBD-aware Next Move selector renderer drawing verbs from `jtbd-taxonomy.json` `next_move_verbs[]`, with Free-Text-always-last invariant, Mode A/B suppression contract, and degenerate-verb-set fallthrough -- 144-line pure-CJS module, zero deps, 7-assertion test harness exits 0.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-01T14:01:02Z
- **Completed:** 2026-05-01T14:03:37Z
- **Tasks:** 2
- **Files created:** 2
- **Files modified:** 0
- **Lines of production code:** 144 (under 150-line cap)
- **Lines of test code:** 250 (7 assertions)

## Accomplishments

- Shape F.6 ships per RESEARCH §2 contract: verbs sourced from taxonomy, Free-Text appended last, Mode A renders `▶` recommended marker on confidence >= 0.7 (Mode A) and suppresses in Mode B
- Out-of-order Phase 101-before-Phase-100 protection: renderer returns 3-line graceful error instead of crashing if `lib/hmi/jtbd-taxonomy.json` is absent (D-12)
- Degenerate-verb-set fallthrough exposes a clean sentinel (`{ fallthrough: true, reason: 'degenerate_verb_set' }`) so the dispatcher in 101-04 routes seamlessly to F.1
- 12-glyph compliance verified at TWO layers: source-level box-char grep returns 0; runtime test harness walks every rendered Zone 2 codepoint and rejects anything outside the `▶ ▷ ■ • →` + ASCII allowlist
- Test harness uses on-disk fixture rewrite under try/finally + require.cache flush, exercising the full degenerate-verb-set path without module mocks (preserves Phase 87 zero-deps invariant)

## Task Commits

1. **Task 1: Author lib/hmi/shape-f6-renderer.cjs** -- `d15c56b` (feat)
2. **Task 2: Fill in tests/test-shape-f6.cjs** -- `1717a0a` (test)

## Files Created/Modified

- `lib/hmi/shape-f6-renderer.cjs` (new, 144 lines) -- F.6 renderer module exposing `renderShapeF6({ jtbd, tier, recommendedVerb, header? }) -> { zones, contract } | { error } | { fallthrough }`. Pure CJS, node built-ins only.
- `tests/test-shape-f6.cjs` (new, 250 lines) -- IIFE harness, 7 assertions, exits 0 on full pass. Replaces the Wave-0 stub authored by plan 101-00.

## Decisions Made

- **Three-shape return value:** F.6 returns success `{ zones, contract }`, taxonomy-missing `{ error }`, or fallthrough `{ fallthrough, reason }`. The dispatcher (101-04) discriminates and routes fallthroughs to F.1. Cleaner than throwing or returning empty objects, matches RESEARCH §2 fallback table.
- **Free-Text de-dup:** Defensive filter `entry.next_move_verbs.filter(v => v !== 'Free-Text')` before appending Free-Text, so taxonomy entries that already list Free-Text (e.g. `explore` JTBD) cannot double-count it. Matches RESEARCH §8 pitfall 6 mitigation.
- **Mode B contract field:** `contract.recommended` is set to `null` in Mode B even though the body never carries `▶`. Two independent surfaces enforce suppression -- defense in depth per RESEARCH §8 pitfall 5.
- **Test fixture strategy:** Assertion 6 (degenerate_fallthrough) writes a synthetic 2-verb taxonomy to disk, flushes require.cache, runs the assertion, then restores the original bytes in `finally`. Faithful to the actual taxonomy load path; no module mocking needed.

## Deviations from Plan

None - plan executed exactly as written.

The plan's <action> for Task 1 step 2 said "If < 3 entries". I interpreted this against the RAW taxonomy verbs (before Free-Text appending). After Free-Text dedup, the explore JTBD has 2 unique non-Free-Text verbs, but its raw `next_move_verbs[]` is 3, so it does NOT trigger fallthrough at the raw check. This matches the must_haves truth "Falls through to F.1 if jtbd null OR taxonomy verb set has fewer than 3 entries" verbatim.

## Authentication Gates

None - no external services were involved.

## Issues Encountered

None during execution. The plan was self-contained and the Phase 100 substrate was available (staged into the worktree from main repo since Wave-0 plans 101-00 + Phase 100 were not yet committed to the worktree branch -- read-only references for runtime support, not committed by 101-01).

## Verification Results

| Check | Expected | Actual |
|-------|----------|--------|
| `node tests/test-shape-f6.cjs` exit code | 0 | 0 (7/7 passed) |
| Box-char audit (`grep -E '[╭╮╰╯┌┐└┘━┃┏┓┗┛]'`) | 0 lines | 0 lines |
| `wc -l lib/hmi/shape-f6-renderer.cjs` | < 150 | 144 |
| Smoke test (find-bottleneck, tier=1) | 4 verbs + Free-Text last, len=5 | "F.6 OK 5" |

## Known Stubs

None. F.6 renderer is fully wired against the canonical taxonomy. The dispatcher (101-04) and Mode B Brain-unreachable Zone 1 prefix (101-05) are out of this plan's scope per the wave-2 boundary.

## Next Phase Readiness

- Ready for **101-04 selector-dispatcher**: F.6 sentinels (`{ fallthrough, reason }`) match the dispatcher's expected delegation contract from D-07
- Ready for **101-05 Mode B graceful**: F.6 already suppresses `▶` in tier < 2; 101-05 layers the Brain-unreachable Zone 1 prefix at dispatcher entry
- Ready for **102 renderer + 104 per-command wiring**: contract surface (zones + keyboard + verbs + mode + recommended) is stable and 12-glyph-compliant

## Self-Check

Verifying claims before handoff to orchestrator.

**Files exist on disk:**
- `lib/hmi/shape-f6-renderer.cjs` -- present (144 lines, 4.7K)
- `tests/test-shape-f6.cjs` -- present (250 lines, 9.6K)

**Commits exist in git log:**
- `d15c56b` -- feat(101-01): add Shape F.6 JTBD-aware Next Move renderer
- `1717a0a` -- test(101-01): add Shape F.6 7-assertion test harness

**Test exit code:** 0 (7/7 assertions passed, taxonomy file restored intact post-test)

## Self-Check: PASSED

---
*Phase: 101-selector-library-jtbd-aware*
*Plan: 01 -- Shape F.6 JTBD-aware Next Move*
*Completed: 2026-05-01*

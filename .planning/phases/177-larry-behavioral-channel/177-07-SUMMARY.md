---
phase: 177-larry-behavioral-channel
plan: 07
subsystem: render
tags: [bch-12, posture-badge, render-v2, statusline, invisibility-by-absence, shadow-only]
requires:
  - "177-01 (frozen postures: sensor-types.cjs POSTURE_IDS)"
provides:
  - "render-v2 posture arg + POSTURE_CLI_COLOR (3 postures -> 5-color CLI set) driving the Zone 1 badge from the COMPOSED posture"
  - "two-row-renderer renderRow2 posture badge slot (composed-posture-driven, cols-gated)"
  - "test-bch-12-color-register GREEN (no praise/grade key; painted at composition)"
affects:
  - "lib/render/render-v2.cjs (the single color seam at the Zone 1 badge)"
  - "lib/statusline/two-row-renderer.cjs (renderRow2 second surface)"
tech-stack:
  added: []
  patterns:
    - "invisibility by absence: the color map structurally has no praise/grade key, so the channel cannot flatter"
    - "painted at composition: the badge color is driven from the engine-composed posture, never a model emit, so it cannot lie"
    - "posture-first with jtbd fallback at the single render-v2 color seam"
key-files:
  created:
    - ".planning/phases/177-larry-behavioral-channel/177-07-SUMMARY.md"
  modified:
    - "lib/render/render-v2.cjs"
    - "lib/statusline/two-row-renderer.cjs"
    - "tests/test-bch-12-color-register.cjs"
decisions:
  - "push_forward maps to green (RESEARCH allowed green OR cyan; green chosen and kept)"
  - "statusline posture badge uses the ⟐ glyph (NOT a governed D-02 glyph) so it does not trip the glyph-isolation carve-out"
  - "posture NOT added to the _provenance envelope -- the 6-field byte-stability fence (test-render-v2-provenance) takes precedence"
metrics:
  duration: "~12 min"
  completed: "2026-06-24"
  tasks: 3
  files: 3
---

# Phase 177 Plan 07: The De Stijl Per-Turn Posture Color Badge (BCH-12) Summary

A posture-driven per-turn color badge, painted AT composition so it cannot lie, with a color map that structurally cannot flatter (no praise/grade key -- invisibility by absence).

## What Shipped

- **`lib/render/render-v2.cjs`**: added `POSTURE_CLI_COLOR = Object.freeze({ pull_back:'red', hold:'yellow', push_forward:'green' })` near `JTBD_CLI_COLOR`; added a `posture` arg to `render()`; changed the SINGLE Zone 1 color seam so posture wins when present and jtbd is the fallback (`POSTURE_CLI_COLOR[posture] || JTBD_CLI_COLOR[jtbd]`); exported `POSTURE_CLI_COLOR`. The TTY-gating + the ■-in-both-modes strip-ANSI invariant are unchanged -- only the color-name source changed.
- **`lib/statusline/two-row-renderer.cjs`**: `renderRow2` appends a composed-posture badge segment (`⟐ <POSTURE>`) alongside the operator slot, with the same `cols >= 80` drop discipline and the existing re-measure/truncate policy. The no-posture path is byte-identical to today; `renderRow1` untouched; statusline text stays plain (no raw ANSI from the badge).
- **`tests/test-bch-12-color-register.cjs`**: the RED scaffold stub replaced with real pure-node asserts (the `ok()` + failed-counter idiom from test-bch-14). The headline assert: `POSTURE_CLI_COLOR` has NO praise key and NO grade key. Also asserts exact-3-keys, every value in the 5-color set, the map is frozen, two postures yield two different colored headers (painted at composition, forced under isTTY), no-posture/no-jtbd is a byte-stable no-op, jtbd remains the fallback, and renderRow2 carries the badge.

## Deviations from Plan

**1. [Rule 1 - Regression avoidance] posture NOT folded into the `_provenance` envelope.**
- **Found during:** Task 1.
- **Issue:** I initially added `posture` to the frozen `_provenance` object. `tests/test-render-v2-provenance.cjs` asserts `_provenance` has EXACTLY 6 canonical fields; a 7th broke it.
- **Fix:** reverted the provenance addition. `posture` is used at the color seam (genuinely consumed, no `void` needed). The 6-field byte-stability fence stays green.
- **Files modified:** lib/render/render-v2.cjs
- **Commit:** 44fda244

## Deferred Issues

- **test-statusline-glyph-isolation.cjs PRE-EXISTING FAIL** (confirmed RED at baseline before 177-07 touched anything, via a HEAD~1 file swap). It flags `scripts/coherence-smoke-test.cjs` carrying the governed D-02 glyphs 📊/🎯 outside the SKILL.md:202 carve-out -- NOT caused by 177-07 (the new statusline posture badge uses `⟐`, not a governed glyph). Out of scope per the executor SCOPE BOUNDARY rule; logged to `deferred-items.md` in the phase dir.

## Known Stubs

None introduced by 177-07. The remaining 4 RED suites in run-all-177 (bch-15 W3, bch-07/bch-08 W4, bch-09 W5) are scaffold stubs owned by later waves, not this plan.

## Self-Check: PASSED

- lib/render/render-v2.cjs FOUND, modified, POSTURE_CLI_COLOR exported.
- lib/statusline/two-row-renderer.cjs FOUND, renderRow2 badge present.
- tests/test-bch-12-color-register.cjs FOUND, exits 0.
- Commits 44fda244, de533a37, cb1b1f1c all present in git log.
- run-all-177 delta: 11 pass / 5 fail -> 12 pass / 4 fail (bch-12 GREEN).
- Render-v2 regression suite (5 suites) all green; statusline d02-broadcast + banner-suppression green; carried frozen-set fences (reach-ids-drift, posture-ids-drift) + bch-01/bch-04/bch-14 all green.

## EXECUTION COMPLETE

All three tasks landed atomically as 177-07-prefixed commits (44fda244 render-v2 posture arg + POSTURE_CLI_COLOR; de533a37 the renderRow2 statusline badge slot; cb1b1f1c the real test-bch-12 asserts), touching exactly the three owned files plus the phase deferred-items log. The render-v2 regression suite (color-overlay, compaction, jtbd-zone4, provenance, signature) stayed fully green -- the existing JTBD accent and the 4-zone compose are intact, with only the color-name SOURCE changed to be posture-first with jtbd fallback. `bash tests/run-all-177.sh` moved 11 pass / 5 fail -> 12 pass / 4 fail: bch-12 flipped GREEN while the carried frozen-set drift fences (reach-ids 6, posture-ids 3) and the Wave-2 + cross-cutting suites (bch-01, bch-04, bch-14 Part-8 zero-egress) all held green; the remaining 4 fails are W3/W4/W5 scaffold stubs owned by later plans. The no-praise-key confirmation is the headline of the suite and holds: POSTURE_CLI_COLOR has exactly {pull_back,hold,push_forward}, is Object.freeze-d, and has neither a praise nor a grade key -- the channel structurally cannot flatter (invisibility by absence), and the badge is painted from the engine-composed posture so it cannot lie. SHADOW-ONLY held: deterministic on the composed posture, no reach minted, no Brain wire, routing_source stays legacy. One deviation (posture kept OUT of the 6-field _provenance envelope to preserve the byte-stability fence) and one pre-existing out-of-scope failure (glyph-isolation flagging coherence-smoke-test.cjs) are documented above.

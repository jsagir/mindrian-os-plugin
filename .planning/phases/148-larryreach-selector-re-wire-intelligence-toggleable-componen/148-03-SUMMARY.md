---
phase: 148-larryreach-selector-re-wire-intelligence-toggleable-components
plan: 03
subsystem: ui
tags: [reach-component-map, selector-dispatcher, toggleable-components, standing-trio, shape-f1, archetype-routing]

# Dependency graph
requires:
  - phase: 148-01
    provides: "hats minted as the 6th machine reach_id; DIAL_REACH_K=6; the frozen-6 drift suite; MAX_K=3 + 0.70/0.15 gate byte-unchanged"
provides:
  - "lib/hmi/reach-component-map.json -- the NET-NEW reach_id/sub_mode/standing-option -> archetype data file (registry-is-the-table)"
  - "selector-dispatcher.resolveArchetype() reads the map and routes the archetype into the AskUserQuestion mode the dispatcher constructs (SEED-020 single door)"
  - "shape-f1-renderer standing-options slot: File + Brain review render OUTSIDE the MAX_K=3 cap, Free-Text always last, independent of ranking (IRW-03)"
  - "tests/test-148-component-map.cjs (IRW-04) + tests/test-148-standing-options.cjs (IRW-03)"
  - "tests/run-all-148.sh -- the IRW-01..08 phase-gate aggregator cloning run-all-1433.sh structure"
affects: [148-04, 148-05, wave-3]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Registry-is-the-table for component routing: the dispatcher reads reach-component-map.json (flattened across reaches/sub_modes/standing_options namespaces), never a hardcoded switch; a new reach joins by adding a JSON row"
    - "Standing options ride outside the cap: File + Brain review are appended by the render host AFTER the ranked+capped chooser set, never ranker candidates, so they can never rank out"
    - "Aggregator forward-listing: run-all-148.sh lists plan-04/05 suites that do not exist yet and gates a missing file to a FAIL line (not a crash) so the phase gate flags incompleteness"

key-files:
  created:
    - lib/hmi/reach-component-map.json
    - tests/test-148-component-map.cjs
    - tests/test-148-standing-options.cjs
    - tests/run-all-148.sh
  modified:
    - lib/hmi/selector-dispatcher.cjs
    - lib/hmi/shape-f1-renderer.cjs

key-decisions:
  - "reach-component-map.json is hand-maintained (precedent: dispatch-framework-map.json), keyed across three namespaces {reaches, sub_modes, standing_options} folded to a flat lookup by the loader"
  - "engine sub_modes (reverse-salient, whitespace, cross-domain-analogy, cross-domain-connect, dominant-design) -> multiSelect (D-01); _file -> multiSelect (D-05); _brain_review -> auto (D-04); _compose -> ordered (D-02); hats/six-hats/deep_research -> confirm (D-06); base frozen reaches -> select (default)"
  - "vocabulary_meaning restructured from object to array so the Part-8 free-text-body-field grep sweep does not false-positive on the text archetype enum name; loader reads only the three routing namespaces, never _doc"
  - "the standing-options test (test-148-standing-options.cjs, owned by this plan's Task 3) was committed in Task 2 because Task 2's verify gate runs it; the renderer change and the test that exercises it are one logical unit"

requirements-completed: [IRW-03, IRW-04]

# Metrics
duration: 18min
completed: 2026-06-09
---

# Phase 148 Plan 03: Reach-Component-Map + Toggleable Component Routing + the Standing Trio Summary

**Built the one genuine net-new artifact of Phase 148 (lib/hmi/reach-component-map.json) and wired per-option toggleable-component routing across the selector surface: the dispatcher resolves each reach/sub_mode/standing-option to its archetype via the map (registry-is-the-table, SEED-020 single door), the F.1 render host appends File + Brain review as always-open standing options OUTSIDE the MAX_K=3 cap with Free-Text always-last (independent of ranking), plus the IRW-03/IRW-04 falsifiable tests and the run-all-148.sh phase-gate aggregator.**

## Performance

- **Duration:** ~18 min
- **Completed:** 2026-06-09
- **Tasks:** 3 (all plan tasks, no deviations beyond one in-scope Part-8-sweep fix)
- **Files:** 4 created + 2 modified

## Accomplishments
- `lib/hmi/reach-component-map.json` is the NET-NEW data file (the one genuine build of Phase 148): reach_id / sub_mode / standing-option -> archetype, with a `_doc` block naming the archetype vocabulary {select, multiSelect, ordered, group, confirm, auto, text} and stating every archetype resolves through the dispatcher (SEED-020).
- `selector-dispatcher.resolveArchetype()` reads the map (flattened across the three namespaces, default `select` on miss); `archetypeToContractHints` + `applyArchetypeRouting` fold the AskUserQuestion-mode hints onto the rendered F.* contract. `pickShape({payload.reachKey})` routes the archetype into the mode the dispatcher constructs -- the ONLY construction site (no bespoke AskUserQuestion payload anywhere else).
- D-03 archetype assignments live in the map: engine sub_modes -> multiSelect (D-01 batch), `_file` -> multiSelect (D-05), `_brain_review` -> auto (D-04 no pick), `_compose` -> ordered (D-02), `hats`/`six-hats`/`deep_research` -> confirm (D-06 confirm-gated / plan-gated), base frozen reaches -> select (default). 5 distinct archetypes emit across the render set (>= 3 required).
- `shape-f1-renderer.normalizeVerbs` gained a `standingOptions` slot: File + Brain review append AFTER the ranked+capped chooser set, BEFORE the trailing Free-Text. They ride OUTSIDE USER_VERB_CAP / MAX_K -- never ranker candidates, never able to rank out (the exact bug IRW-03 forbids). Presence is independent of reachScores / mode / tier; the renderer stays a pure label-composer.
- `tests/test-148-component-map.cjs` (IRW-04) and `tests/test-148-standing-options.cjs` (IRW-03) are green.
- `tests/run-all-148.sh` clones run-all-1433.sh: the connector `--check` tripwire + the IRW-01..08 CJS suites (plan-04/05 suites gated to FAIL-missing, not crash) + the carried drift fences expecting 6 (posture stays 3) + a standalone Part-8 grep sweep over the new artifacts. It parses (`bash -n`), runs to completion even with missing suites, and exits 1 on any failure.

## Task Commits

1. **Task 1: reach-component-map.json + dispatcher archetype routing (IRW-04, D-03)** - `147a2ee6` (feat)
2. **Task 2: File + Brain review standing trio outside the MAX_K cap, Free-Text last (IRW-03)** - `ec0633c0` (feat)
3. **Task 3: IRW-04 component-map test + run-all-148.sh aggregator** - `71059012` (test)

## Files Created/Modified
- `lib/hmi/reach-component-map.json` - NEW. The reach/sub_mode/standing-option -> archetype map + `_doc` vocabulary block.
- `lib/hmi/selector-dispatcher.cjs` - added `_loadReachComponentMap` (flattens the three namespaces), `resolveArchetype` (exported), `archetypeToContractHints`, `applyArchetypeRouting`; wired the routing into `pickShape` (after the brain-suggestion overlay, before the AskUserQuestion trailer); exported `resolveArchetype` + `_internal` helpers.
- `lib/hmi/shape-f1-renderer.cjs` - `normalizeVerbs(rawVerbs, standingOptions)` gains the standing-trio slot; `renderShapeF1` threads `standingOptions`; `contract.standingOptions` surfaced; exported `normalizeVerbs` + `STANDING_FILE`/`STANDING_BRAIN_REVIEW`/`STANDING_TRIO`/`FREE_TEXT`.
- `tests/test-148-component-map.cjs` - NEW IRW-04 suite.
- `tests/test-148-standing-options.cjs` - NEW IRW-03 suite.
- `tests/run-all-148.sh` - NEW IRW-01..08 aggregator.

## Decisions Made
- Hand-maintained map (precedent: dispatch-framework-map.json), three namespaces folded to a flat lookup by the loader.
- Kept the renderer a pure function: the standing trio is composed in `normalizeVerbs` via the `standingOptions` flag; archetype resolution stays in the dispatcher.
- Listed the plan-04/05 suites in the aggregator now (forward-listing) so the phase gate is one command; a missing file gates to FAIL, never a crash, surfacing incompleteness honestly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Part-8 grep sweep false-positive on the `text` archetype enum**
- **Found during:** Task 3 (first full run of run-all-148.sh).
- **Issue:** The standalone Part-8 free-text-body-field sweep (`"(summary|content|body|text|note|description)"\s*:`, mirrored verbatim from run-all-1433.sh step d) matched the `"text": "free-text capture"` line inside the map's `_doc.vocabulary_meaning` object. `text` there is an archetype enum NAME, not a free-text body channel heading to Brain -- a false positive. Weakening the constitutional sweep was the wrong fix.
- **Fix:** Restructured `vocabulary_meaning` from an object keyed by archetype name into an array of `{archetype, meaning}` entries, so no `"text":` JSON key remains. The strict sweep stays byte-identical to the 1433 precedent; the loader reads only the three routing namespaces (never `_doc`), so resolution is unaffected.
- **Files modified:** lib/hmi/reach-component-map.json (committed in Task 3 with the aggregator that surfaced it).
- **Verification:** Part-8 grep sweep PASSED; component-map + standing-options tests still green; resolveArchetype unchanged.
- **Committed in:** `71059012`

**Total deviations:** 1 auto-fixed (an in-scope bug in a Task-3 artifact, caught and fixed within Task 3).
**Impact on plan:** None. No scope change; the map's routing data is byte-identical, only the documentation block's shape changed to keep the constitutional sweep strict.

## Issues Encountered
- **Per-commit pre-commit hook:** ran normally (no `--no-verify`); all three commits passed clean. The documented `check-sendpacket` false-positive on `lib/core/mindrian-brain-shim.test.cjs` did NOT trip (that file was untouched).
- **No `check-brain-boundary.cjs` script exists** in the repo -- the Part-8 PR gate shipped as a PostToolUse hook on `mcp__brain_*` (per CANON-PHASE-MAP Phase 117-04). The aggregator therefore enforces Part-8 via the standalone grep sweep (the run-all-1433.sh precedent), not via a nonexistent script. The IRW-08 brain-review-egress suite (Plan 05) carries the adversarial assertion; it is forward-listed and gated to FAIL-missing until Plan 05 ships it.

## Known Stubs
None in this plan's code. The aggregator intentionally lists 5 suites that plans 04/05 will create (test-148-engine-reaches, test-148-unified-host, test-148-real-invocation, test-148-frozen-contracts, test-148-brain-review-egress); these are FAIL-missing by design until their owning plans land -- this is the documented forward-listing pattern, not a stub in the rendered surface. The two suites THIS plan owns (component-map, standing-options) are green.

## Threat Flags
None - no new network endpoints, auth paths, file-access patterns, or schema changes at a trust boundary. The component map holds only reach_id/sub_mode -> archetype enum scalars (no user content, no Brain egress); the Part-8 grep sweep over the new artifacts is green. The standing trio is a render-host concern with zero egress. Matches the plan's threat register: T-148-03-01 (bespoke construction) mitigated -- all construction stays in the dispatcher; T-148-03-02 (standing options into the ranker) mitigated -- the trio is appended independent of reachScores and the IRW-03 test zeroes scores and asserts survival; T-148-03-03 (map content) accept -- enum scalars only, sweep-covered.

## Self-Check: PASSED

- FOUND: lib/hmi/reach-component-map.json
- FOUND: lib/hmi/selector-dispatcher.cjs (resolveArchetype exported)
- FOUND: lib/hmi/shape-f1-renderer.cjs (normalizeVerbs + standing trio exported)
- FOUND: tests/test-148-component-map.cjs
- FOUND: tests/test-148-standing-options.cjs
- FOUND: tests/run-all-148.sh
- FOUND commits: 147a2ee6, ec0633c0, 71059012
- No em-dashes in any new/edited file (grep -P "\xE2\x80\x94|\xE2\x80\x93" returns empty)

---
*Phase: 148-larryreach-selector-re-wire-intelligence-toggleable-components*
*Completed: 2026-06-09*

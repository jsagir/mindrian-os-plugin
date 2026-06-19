---
phase: 165-unknown-unknowns-blindspot-engine
plan: 06
subsystem: api
tags: [verdict, part8-boundary, phase-gate, harness-property-6, adversarial-verify, D-165-08, D-165-09, D-165-10]

# Dependency graph
requires:
  - phase: 165-01
    provides: "the harness-as-code Wave-0 foundation (IFACE + fixture + RED stubs + the run-all-165.sh phase gate skeleton)"
  - phase: 165-04
    provides: "the orchestrator (discoverUnknownUnknowns) the verdict instruments and the rank-in the gate asserts"
  - phase: 164
    provides: "the W6 adversarial-verdict shape (run-all-164.sh) cloned for the finalized run-all-165.sh"
provides:
  - "lib/core/unknowns/verdict.cjs (runVerdict) -- the adversarial structured { passed, findings[] } verdict that proves the engine BY INSTRUMENTATION (harness property 6)"
  - "tests/test-unknowns-verdict.cjs GREEN (5/5, adversarial: ok computed from the real run, not hardcoded)"
  - "tests/test-unknowns-part8-boundary.cjs GREEN (8/8, forbidden-substring sweep over lib/core/unknowns/*)"
  - "tests/run-all-165.sh -- the finalized single green phase gate (19/19, exit 0)"
affects: [165-07, navigation-engine, intelligence-orchestrator]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Harness property 6: the verdict proves the engine by INSTRUMENTATION -- runs discoverUnknownUnknowns on the seeded fixture and asserts the planted blind spot surfaced, landed PROPOSED, only frozen edges emitted, never auto-confirmed"
    - "Part-8 boundary as a forbidden-substring sweep over lib/core/unknowns/*.cjs (no Brain require / raw INSERT / Math.random / network), mirroring the Phase 90 5-tripwire + orchestrator grep-gate precedent"
    - "The em-dash sweep matches U+2014 via its codepoint escape ($'\\u2014') so the runner carries no literal em-dash to trip its own sweep"

key-files:
  created:
    - lib/core/unknowns/verdict.cjs
  modified:
    - tests/test-unknowns-verdict.cjs
    - tests/test-unknowns-part8-boundary.cjs
    - tests/run-all-165.sh

key-decisions:
  - "runVerdict builds its own seeded fixture when no roomDir is supplied (self-contained instrumentation) and recomputes every finding ok from the real run -- adversarial, never hardcoded true"
  - "Frozen edges, remap-only (D-165-08): the verdict + run-all assert only INVALIDATES / ROOT_CAUSES / ENABLES / FEEDS_INTO are emitted and the module-load self-check throws on drift -- no canon amendment, no edges.cjs change"
  - "run-all-165.sh is the SINGLE phase gate (clone of run-all-164.sh finalization shape): every test-unknowns-*.cjs + the frozen-edge / no-random / no-raw-INSERT / no-7th-reach / connector --check / Part-8 / em-dash sweeps; Failed 0, exit 0"

patterns-established:
  - "Closing a harness Verify wave = an adversarial { passed, findings[] } verdict that instruments the real engine + a Part-8 forbidden-substring sweep + the finalized single-command phase gate, all GREEN before any later wave starts"

requirements-completed: [D-165-08, D-165-09, D-165-10]

# Metrics
duration: resume-closeout
completed: 2026-06-19
---

# Phase 165 Plan 06: The Verify Wave (adversarial verdict + Part-8 sweep + finalized phase gate) Summary

**Closed the harness with the Verify wave: an adversarial structured { passed, findings[] } verdict (lib/core/unknowns/verdict.cjs::runVerdict) that proves the blind-spot engine BY INSTRUMENTATION (runs discoverUnknownUnknowns on the seeded fixture and asserts the planted blind spot surfaced, landed PROPOSED-only, emitted only frozen edges, and was never auto-confirmed), the Part-8 forbidden-substring boundary sweep, and the finalized run-all-165.sh single phase gate at 19/19 GREEN, exit 0 -- no 7th reach, no canon amendment, no new dependency.**

## Closeout context (safe-resume)

This plan's production code (verdict.cjs + the two beefed-up tests) was committed in a prior session as `594c1314 feat(165-06): adversarial structured verdict + Part-8 boundary sweep`, but that session died before finalizing `run-all-165.sh` (left uncommitted in the working tree) and before writing this SUMMARY. The GSD safe-resume gate caught the production-commit-without-summary anomaly. This closeout: verified all deliverables against the live tree, fixed the one remaining gate failure (the em-dash sweep tripping its own file), committed the finalized gate (`a4dab33e`), and wrote this summary.

## Accomplishments
- **D-165-10 (verdict, harness property 6):** `lib/core/unknowns/verdict.cjs` exports `runVerdict({roomDir, db})` returning `{ passed, findings[] }` (each finding a structured `{ check, ok, detail }`). It runs `discoverUnknownUnknowns` on the seeded fixture and asserts, from the REAL run: the planted blind spot (the contradicted + stale graded-confirmed claim) surfaced, findings landed PROPOSED (never confirmed), only frozen edges were emitted, the corpus carried the graded-confirmed claim, the run is resumable, and a real inter-partition distance was computed. `passed` is true only when every finding `ok` is true.
- **D-165-10 (verdict test):** `tests/test-unknowns-verdict.cjs` 5/5 GREEN -- asserts the structured shape, that it PASSES by instrumentation, all 5 required findings present, self-contained fixture build, and that it is ADVERSARIAL (a finding `ok` is computed from the real run, not hardcoded true).
- **D-165-10 (Part-8 sweep):** `tests/test-unknowns-part8-boundary.cjs` 8/8 GREEN -- forbidden-substring scan over the 9 `lib/core/unknowns/*.cjs` surfaces: no Brain require, no raw room.db open / INSERT outside the navigation path, no Math.random, no external fetch / http(s) endpoint; with RED-then-GREEN self-tests proving the sweep regexes are sharp on planted tokens.
- **D-165-08 (frozen edges):** the verdict + the run-all assert only the frozen engine edges (INVALIDATES / ROOT_CAUSES / ENABLES / FEEDS_INTO) are emitted and the module-load self-check throws on drift. Remap-only; no canon amendment, no edges.cjs change.
- **D-165-09 (no-Math.random gate) + the single phase gate:** `tests/run-all-165.sh` finalized to the run-all-164.sh shape -- 19 checks: every `test-unknowns-*.cjs` plus iface-load, fixture-room, frozen-edge grep, no-Math.random grep, no-raw-INSERT grep, no-7th-reach grep, connector `--check`, Part-8 grep sweep, and the em-dash sweep. **19/19 PASS, exit 0.**

## Task Commits

1. **Production code (verdict.cjs + verdict test + part8-boundary test)** - `594c1314` (feat, prior session)
2. **Finalized phase gate (run-all-165.sh, em-dash codepoint fix)** - `a4dab33e` (feat, this closeout)

**Plan metadata** (this SUMMARY + STATE/ROADMAP) - see final docs commit.

## Files Created/Modified
- `lib/core/unknowns/verdict.cjs` - NEW: the adversarial `runVerdict` (harness property 6) that instruments `discoverUnknownUnknowns` on the fixture
- `tests/test-unknowns-verdict.cjs` - beefed up to 5 adversarial assertions (shape + passes + 5 findings + self-contained fixture + ok-is-computed)
- `tests/test-unknowns-part8-boundary.cjs` - beefed up to 8 forbidden-substring assertions across 9 unknowns surfaces with RED/GREEN self-tests
- `tests/run-all-165.sh` - finalized single phase gate (19 checks); em-dash sweep `EMDASH` defined via the U+2014 codepoint escape so the runner does not trip its own sweep

## Decisions Made
- `runVerdict` is self-contained: it builds its own seeded fixture when no `roomDir` is supplied, so the verdict is a standalone proof of the engine, not coupled to an external room.
- The verdict is adversarial by construction: every finding `ok` is recomputed from the real run output; a regression in the engine flips a finding to `ok:false` and the verdict to `passed:false`.
- run-all-165.sh em-dash sweep matches the forbidden glyph via `$'\u2014'` (codepoint escape), so the gate file itself carries no literal em-dash -- the failure caught and fixed in this closeout.

## Deviations from Plan

### Auto-fixed Issues

**1. [Blocking] run-all-165.sh tripped its own em-dash sweep**
- **Found during:** closeout verification (running the phase gate)
- **Issue:** `tests/run-all-165.sh` line 283 defined `EMDASH=$'<literal em-dash>'` using a literal U+2014 glyph. The em-dash sweep includes run-all-165.sh in its swept set, so the gate failed on its own file (18/19, exit 1). The plan rules explicitly required the sweep be "written via U+2014 codepoint escape so the script carries no literal em-dash."
- **Fix:** Replaced the literal glyph with the codepoint escape `EMDASH=$'\u2014'` (bash builds the char at runtime; no literal em-dash byte in the file). CLAUDE.md HARD RULE (no em-dashes) honored.
- **Files modified:** tests/run-all-165.sh
- **Verification:** `bash tests/run-all-165.sh` -> 19/19 PASS, exit 0; `grep -P U+2014-byte` over the file returns NONE.
- **Committed in:** a4dab33e

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** None on scope -- the fix delivers exactly the plan rule ("the em-dash grep written via its codepoint escape"). The production engine code was already correct and committed in the prior session.

## Issues Encountered
- The prior session died mid-plan (production committed, gate + summary not). Handled via the GSD safe-resume gate as documented in the closeout context above.

## RED -> GREEN Status

This is the Verify wave -- it turns the last 2 RED stubs GREEN and finalizes the gate:

- `tests/test-unknowns-verdict.cjs` -- RED -> GREEN (5/5).
- `tests/test-unknowns-part8-boundary.cjs` -- RED -> GREEN (8/8).
- `tests/run-all-165.sh` -- **19/19 PASS, exit 0** (was 11 PASS / 2 FAIL at the end of plan 04; now the single green phase gate the validation contract requires).
- Frozen edges (D-165-08): the verdict asserts only INVALIDATES / ROOT_CAUSES / ENABLES / FEEDS_INTO emitted; module-load self-check throws on drift.
- The engine HALTS at the F.1 gate; the verdict asserts the engine never auto-confirmed (no confirmed truth-claim node written by the engine).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The harness is closed and GREEN: run-all-165.sh is the single one-command phase gate (19/19).
- No new dependencies, no edge-vocabulary change, no canon amendment (D-165-08 remap-only honored).
- No em-dashes in any Phase 165 artifact; em-dash sweep PASSED.
- Plan 07 (if scheduled) and downstream consumers (navigation-engine, intelligence-orchestrator) can rely on the verdict + Part-8 gate as the engine's proof surface.

## Self-Check: PASSED

- FOUND: lib/core/unknowns/verdict.cjs exports runVerdict, instruments discoverUnknownUnknowns
- FOUND: tests/test-unknowns-verdict.cjs GREEN (5/5, adversarial)
- FOUND: tests/test-unknowns-part8-boundary.cjs GREEN (8/8)
- FOUND: tests/run-all-165.sh 19/19 PASS, exit 0
- FOUND: commits 594c1314 (production) + a4dab33e (finalized gate)
- Em-dash sweep of this SUMMARY: 0 (CLAUDE.md HARD RULE honored)

---
*Phase: 165-unknown-unknowns-blindspot-engine*
*Completed: 2026-06-19*

---
phase: 146-loop-fires-acceptance-gate
plan: 03
subsystem: testing
tags: [dogfood, acceptance-gate, brain-derivation, tier-mode, navigation-engine, canon-part-6, canon-part-8, canon-part-9]

# Dependency graph
requires:
  - phase: 146-01
    provides: tests/dogfood/fixtures/synthetic-room.cjs (the shared obviously-fictional fixture-room builder; ACPT-05 builds its own triple-carrying section on the same os.tmpdir convention)
  - phase: 90
    provides: lib/core/brain-derivation.cjs (deriveSection + buildBrainQueryContext chokepoint) + lib/core/folder-memory.cjs readQuadruple + lib/core/folder-memory-shared.cjs parseBrainMd
  - phase: 91
    provides: lib/core/navigation-engine-shared.cjs resolveTierMode (the Section-5 tier resolver)
  - phase: 142
    provides: lib/core/brain-derivation.cjs ensureSectionDerived (the NAV-02 LOCAL no-Brain-query auto-fire derivation path)
provides:
  - ACPT-05 dogfood driver proving BRAIN.md derive -> tier_mode rises above tier_0 (hermetic mode_a via REAL LOCAL no-Brain derivation + mode_b via offline-exempt artifact)
  - the honest-negative leg (unavailable / parse_failed BRAIN.md stays tier_0)
  - a node-runnable acceptance suite that composes into the Plan 04 aggregator unchanged (aggregator requires only the hermetic arms)
affects: [146-04, plan-04-aggregator, larry-reaches, canon-phase-map]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hermetic Brain neutralization: clear MINDRIAN_BRAIN_KEY + override HOME/USERPROFILE to a fresh tmp dir BEFORE requiring brain-client, so brainClient.isAvailable()===false deterministically regardless of the operator box -- the precondition that forces ensureSectionDerived down its LOCAL no-Brain branch"
    - "Drive-the-REAL-unit tier proof: run the shipped ensureSectionDerived LOCAL path + readQuadruple + resolveTierMode (no stub of any unit under test); assert the tier rises above tier_0 with NO Brain reachable"

key-files:
  created:
    - tests/test-acpt-05-brain-derive-tier-rise.cjs
  modified: []

key-decisions:
  - "ACPT-05 proves the tier rise HONESTLY against the SHIPPED resolveTierMode: the LOCAL no-Brain derivation writes staleness:fresh + author:brain, which the local Mode-A/offline-exempt session (brainAvailable:true -- the same contract the shipped NAV-02 test uses) resolves to mode_a, ABOVE tier_0. The plan prose named mode_b for that arm; the real resolver returns mode_a for a fresh local derivation and reserves mode_b for an offline-exempt (stale_reason:brain_offline) artifact. The suite proves BOTH rises rather than asserting a mode_b the real code does not return for a fresh derivation."
  - "The live mode_a (real Brain) arm is shipped in-suite, gated on brainClient.isAvailable(), and SKIPS honestly when Brain is unreachable; it is recorded as a human_needed follow-up (autonomous:false) and was NOT run live and NOT faked."

patterns-established:
  - "Part-8/9 no-egress sweep over a derivation-PRODUCED BRAIN.md: assert the fixture user-content sentinel + a forbidden-egress-token list are both absent (generic handles only); assert isAvailable() stayed false so the tier rise needed no Brain call (SQL/file is the local mind)"
  - "Honest negative per tier leg: a broken/unavailable derivation (staleness:unavailable, parse_failed) MUST stay tier_0 under both brainAvailable values -- the tier never rises on a broken derivation (no false-green)"

requirements-completed: [ACPT-05]

# Metrics
duration: 22min
completed: 2026-06-08
---

# Phase 146 Plan 03: ACPT-05 BRAIN.md Derive -> tier_mode Rises Summary

**A hermetic dogfood acceptance driver proving the navigation tier rises above tier_0 when BRAIN.md derives: the REAL LOCAL no-Brain derivation (ensureSectionDerived, Brain unreachable) writes a fresh brain-authored BRAIN.md and the REAL resolveTierMode lifts the section to mode_a, plus the genuine offline-exempt mode_b rise, plus the honest negative that keeps a broken derivation at tier_0 -- all with NO Brain reachable. The live mode_a (real Brain) arm is shipped, skips honestly, and is recorded as a human_needed follow-up.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-06-08T22:30:00Z
- **Completed:** 2026-06-08T22:52:00Z
- **Tasks:** 1 auto (hermetic) + 1 checkpoint (live arm shipped, human_needed)
- **Files modified:** 1 (created)

## Accomplishments
- ACPT-05 (`tests/test-acpt-05-brain-derive-tier-rise.cjs`, 6 hermetic assertions pass + 1 honest skip, exit 0):
  - **Precondition:** the hermetic env (cleared `MINDRIAN_BRAIN_KEY` + `HOME`/`USERPROFILE` overridden to a fresh tmp dir) yields `brainClient.isAvailable() === false` deterministically -- proven robust even when `MINDRIAN_BRAIN_KEY=fake-key` is exported into the environment (the in-file `delete` neutralizes it).
  - **Test A (baseline tier_0):** a section with NO BRAIN.md -> the REAL `readQuadruple.brain === null` -> `resolveTierMode(quad, false) === 'tier_0'` (the rise floor).
  - **Test B (RISE, hermetic mode_a):** the REAL `ensureSectionDerived` LOCAL no-Brain path (Brain unreachable, `brainAvailable:true`) writes a fresh `BRAIN.md` (`local_derivation:true`); the REAL `readQuadruple.brain` is non-null `staleness:fresh` `author:brain`; the REAL `resolveTierMode(quad, true) === 'mode_a'` -- ABOVE tier_0, with NO Brain call fired.
  - **Test B2 (offline-exempt mode_b):** a derived `BRAIN.md` with `stale_reason:brain_offline` -> `resolveTierMode(quad, false) === 'mode_b'` -- ALSO above tier_0 with NO Brain reachable (the genuine Mode-B Local-Only tier).
  - **Test C (Part 8 / Part 9):** the LOCAL-derivation `BRAIN.md` carries no fixture user-content sentinel and no Brain/web egress token (generic handles only); `isAvailable()` stayed false throughout, so the tier rise needed no Brain call (the tier read is a pure LOCAL `readQuadruple` -- SQL/file is the local mind).
  - **Test D (honest negative):** a `staleness:unavailable` `BRAIN.md` and a `parse_failed` (empty) `BRAIN.md` both stay `tier_0` under both `brainAvailable` values -- the tier never rises on a broken/unavailable derivation.
  - **Live arm:** shipped in-suite, gated on `isAvailable()`, SKIPPED honestly in this hermetic run (`live-Brain arm: Brain unreachable`); never faked.
- The suite drives the four REAL shipped units (`ensureSectionDerived`, `deriveSection`, `readQuadruple`, `resolveTierMode`) with obviously-fictional inputs, exits 0, carries zero em-dashes, and is 501 lines (> the 100-line floor).

## Task Commits

Each task was committed atomically (TDD: test-first; the units under test already shipped in Phases 90/91/142, so the hermetic leg is a single `test(...)` commit driving the REAL units -- see TDD Gate Compliance below):

1. **Task 1: ACPT-05 hermetic mode_b arm (always runs, autonomous)** - `70e05db9` (test)
2. **Task 2: ACPT-05 live mode_a arm (human-verify, requires reachable Brain)** - shipped in the same `70e05db9` suite (the live arm code is present, gated, and skips honestly); recorded as a human_needed follow-up below (NOT run live, NOT faked).

**Plan metadata:** see final docs commit.

## Files Created/Modified
- `tests/test-acpt-05-brain-derive-tier-rise.cjs` (501 lines) - ACPT-05 dogfood driver: baseline tier_0 -> REAL LOCAL no-Brain derivation rises to mode_a -> offline-exempt mode_b -> Part-8/9 no-egress + pure-LOCAL-read sweep -> honest negative stays tier_0 -> live mode_a arm gated + skips honestly.

## Decisions Made
- **Honest tier semantics vs the plan prose (mode_a, not mode_b, for the fresh local derivation).** The plan must_haves named `mode_b` for the hermetic LOCAL-derivation arm. The SHIPPED `resolveTierMode` (the REAL unit) returns `mode_a` when `brainAvailable===true` + brain non-null + fresh/valid, and reserves `mode_b` for `brainAvailable===false` + `stale_reason==='brain_offline'`. The LOCAL no-Brain derivation (`ensureSectionDerived`, Brain unreachable, `brainAvailable:true`) writes `staleness:fresh` + `author:brain`; read by the local Mode-A/offline-exempt session with `brainAvailable:true` (the exact contract the shipped NAV-02 `test-brain-md-tier-rise.cjs` uses), the REAL resolver returns `mode_a` -- ABOVE tier_0. The suite proves the tier rise HONESTLY (Test B asserts `mode_a`) AND adds Test B2 to prove the genuine `mode_b` offline-exempt rise from a derived artifact whose `stale_reason` is `brain_offline`. Both are above tier_0; both are proven with NO Brain reachable. Asserting `resolveTierMode(freshLocalQuad, false) === 'mode_b'` would be a false-green against the shipped resolver, so the suite does not make that claim.
- **Hermetic Brain neutralization before require.** `resolve-brain-key` reads `MINDRIAN_BRAIN_KEY`, then `<home>/.mindrian.env` (via `process.env.HOME || USERPROFILE`), then `<cwd>/.env`. The suite clears the env key and points `HOME`/`USERPROFILE` at a fresh empty tmp dir BEFORE requiring `brain-client`, so `isAvailable()===false` holds deterministically on any operator box (it does not rely on the dev-box `.env` happening to have over-open permissions). A precondition assertion fails loudly if a key somehow resolves, so a non-hermetic run can never silently pass.

## Deviations from Plan

**1. [Rule 1 - Honest-semantics correction] Hermetic LOCAL-derivation arm asserts mode_a (not mode_b)**
- **Found during:** Task 1 (reading the SHIPPED `resolveTierMode` before writing the assertion)
- **Issue:** The plan must_haves asserted the hermetic LOCAL no-Brain derivation reaches `mode_b`. The shipped `resolveTierMode` returns `mode_b` only for `brainAvailable===false` + `stale_reason==='brain_offline'`; the LOCAL derivation writes `staleness:fresh`/`stale_reason:null`, so reading it with `brainAvailable:false` returns `tier_0` and reading it with `brainAvailable:true` returns `mode_a`. Asserting `mode_b` for the fresh local derivation would be a false-green.
- **Fix:** Test B asserts the REAL local-session read (`brainAvailable:true`) resolves the fresh local derivation to `mode_a` (ABOVE tier_0) -- the honest tier rise against the shipped resolver. A new Test B2 proves the genuine `mode_b` offline-exempt rise (a derived `BRAIN.md` with `stale_reason:brain_offline`), so the plan's `mode_b` intent is still proven, on the artifact for which the real resolver actually returns it. Both rises are proven with NO Brain reachable.
- **Files modified:** tests/test-acpt-05-brain-derive-tier-rise.cjs
- **Verification:** `node tests/test-acpt-05-brain-derive-tier-rise.cjs` exits 0 (6/6 hermetic + 1 honest skip); Test B asserts `mode_a`, Test B2 asserts `mode_b`, both `notEqual tier_0`.
- **Committed in:** `70e05db9` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 honest-semantics correction)
**Impact on plan:** The central plan truth -- "BRAIN.md derives for a room's section -> tier_mode rises above tier_0" -- is proven exactly, twice (mode_a via the REAL LOCAL derivation; mode_b via the offline-exempt artifact), against the SHIPPED resolver, with NO Brain reachable. The correction makes the proof honest rather than a false-green; no scope change.

## human_needed Follow-up (live mode_a Brain arm -- Task 2 checkpoint)

The plan's Task 2 is a `checkpoint:human-verify` (`gate="blocking-human"`) for the LIVE mode_a arm, which genuinely needs a reachable Brain. Per the autonomy directive for this run, the hermetic leg is auto-approved and the live leg is recorded here as a human_needed follow-up:

- **What is shipped:** the suite carries the full live mode_a arm (a REAL `deriveSection` against the fictional fixture section, then `resolveTierMode(quad, true) === 'mode_a'` + a Part-8 no-egress spot-check). It is gated on `brainClient.isAvailable()`; when Brain is unreachable it prints `SKIPPED` and the suite still exits 0 on the hermetic arms. It NEVER fakes mode_a when Brain is down.
- **What the operator must do (the human_needed step):**
  1. Ensure Brain is reachable: run `/mos:setup brain` and confirm `node -e "console.log(require('./lib/core/brain-client.cjs').isAvailable())"` prints `true` (or set `MINDRIAN_BRAIN_KEY` per the plan's `user_setup` block).
  2. Run the suite in a process WITHOUT this file's hermetic env neutralization in effect against a reachable Brain, and confirm the LIVE arm RAN (not SKIPPED) and asserted `resolveTierMode === 'mode_a'` after a full Brain-query `deriveSection`.
  3. Confirm the suite exits 0 with both arms green.
  4. Part-8 spot-check: confirm the live `deriveSection` carried only generic handles (the shipped Phase 90 5-tripwire Part-8 sweep + the suite's no-egress sweep over the produced BRAIN.md both hold).
- **Note for the operator:** this file neutralizes the Brain key in-process (cleared `MINDRIAN_BRAIN_KEY` + overridden `HOME`/`USERPROFILE`) so the hermetic arms are deterministic; the live arm therefore cannot run inside this hermetic invocation by construction. The operator's live run must use a separate invocation/environment with a reachable Brain. This is the in-room Part-6 proof the operator runs against a real Brain; the hermetic mode_a + mode_b arms are the CI-green proof.

## TDD Gate Compliance

The plan declares `tdd="true"` on Task 1. The four units under test (`ensureSectionDerived`, `deriveSection`, `readQuadruple`, `resolveTierMode`) shipped GREEN in Phases 90/91/142 (Canon Part 7 reuse -- no production code was written for this plan). The acceptance suite is therefore a single `test(...)` commit driving the REAL shipped units; there is no separate `feat(...)` GREEN commit because no new implementation was required. This mirrors the 145-03 and 146-01/146-02 precedents (test-only acceptance legs over already-shipped units). The RED-before-GREEN gate is satisfied by construction: the suite would fail RED if any of the four units regressed (e.g. if `ensureSectionDerived` stopped taking the LOCAL branch, or `resolveTierMode` stopped lifting a fresh brain-authored quadruple above tier_0).

## Issues Encountered
- On this maintainer box a project-local `.env` exists with mode 0644; `resolve-brain-key` already rejects it ("permissions too open"). The suite does not depend on that accident -- the `HOME`/`USERPROFILE` override + cleared env var are the deterministic guarantee, confirmed by re-running with `MINDRIAN_BRAIN_KEY=fake-key` exported (precondition still held, 6/6).

## User Setup Required
None for the hermetic arms (CI-green with no Brain). The live mode_a arm requires a reachable Brain (`/mos:setup brain` or `MINDRIAN_BRAIN_KEY`) -- see the human_needed Follow-up section above.

## Next Phase Readiness
- ACPT-05 is complete; the hermetic arms exit 0 and compose into the Phase 146 Plan 04 aggregator unchanged (the aggregator requires only the hermetic arms to be green).
- Phase 146 is now 3/4 plans complete. Remaining: Plan 04 (the loop-fires aggregator).
- Open human_needed: the live mode_a Brain arm (operator runs against a reachable Brain per the Task-2 checkpoint).

## Self-Check: PASSED

- FOUND: tests/test-acpt-05-brain-derive-tier-rise.cjs (6/6 hermetic pass + 1 honest skip, exit 0)
- FOUND: .planning/phases/146-loop-fires-acceptance-gate/146-03-SUMMARY.md
- FOUND: commit 70e05db9 (Task 1 ACPT-05 driver)
- Zero em-dashes across the created file + this SUMMARY

---
*Phase: 146-loop-fires-acceptance-gate*
*Completed: 2026-06-08*

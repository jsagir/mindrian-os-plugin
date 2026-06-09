---
phase: 148-larryreach-selector-re-wire-intelligence-toggleable-components
plan: 01
subsystem: ui
tags: [reach-spine, capability-dial, connector-registry, drift-tests, six-hats, sensor-types]

# Dependency graph
requires:
  - phase: 141-local-retrieval-spine-capability-dial
    provides: REACH_IDS frozen bank, DIAL_REACH_K, the exactly-5 drift discipline
  - phase: 143.1-dial-tui
    provides: dial-reach-orchestrator, dial-label-composer, dial-presenter (the 5-reach render path)
  - phase: 143.3-connector-spine-and-intelligence-orchestrator
    provides: connector-registry generator + --check tripwire, intelligence-orchestrator SKILL fence
provides:
  - "hats minted as the REAL 6th machine reach_id in sensor-types.REACH_IDS (frozen, length 6)"
  - "DIAL_REACH_K raised 5 -> 6; MAX_K stays 3; 0.70/0.15 gate byte-unchanged"
  - "think-hats connector repointed brain_consult -> hats; connector-registry regenerated"
  - "every carried drift fence rewritten to assert 6 (and green); posture fence stays 3"
  - "both SKILL doctrine fences amended (no-6th -> no-7th); ui-system + dial-memory-refresh aligned"
  - "tests/test-148-hats-sixth-reach.cjs (IRW-02 falsifiable test) with a Plan-05-gated persona-cache stub"
affects: [148-02, 148-03, 148-04, 148-05, wave-2, wave-3, persona-cache, hats-confirm-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Constitutional lockstep: a frozen-bank count change moves the constant + every drift fence + both SKILL fences + the generated registry in ONE wave so CI never goes RED mid-phase"
    - "Render-only reach family: hats carries no {framework} egress slot, staying in the non-egress family class (Part 8)"
    - "Wave-dependency test stub: a sub-assertion gated behind require.resolve presence-check that hardens automatically when the downstream plan ships its module"

key-files:
  created:
    - tests/test-148-hats-sixth-reach.cjs
  modified:
    - lib/core/sensors/sensor-types.cjs
    - lib/hmi/dial-reach-orchestrator.cjs
    - lib/hmi/dial-label-composer.cjs
    - lib/hmi/dial-presenter.cjs
    - lib/core/feynman/dial-memory-renderer.cjs
    - commands/think-hats.md
    - commands/dial-memory-refresh.md
    - data/connector-registry.json
    - scripts/build-connector-registry.cjs
    - scripts/hooks/pre-commit
    - skills/larry-personality/SKILL.md
    - skills/intelligence-orchestrator/SKILL.md
    - skills/ui-system/SKILL.md
    - tests/test-reach-ids-drift.cjs
    - tests/test-dial-label-bank-drift.cjs
    - tests/test-dial-graph-relationship-layer.cjs
    - tests/test-sensor-spine-dispatch.cjs
    - tests/test-orchestrator-doctrine-presence.cjs
    - tests/test-dial-reach-orchestrator.cjs
    - tests/test-dial-end-to-end-states.cjs
    - tests/test-dial-render-states.cjs
    - tests/test-connector-tripwire.cjs
    - tests/test-dial-memory-renderer.cjs
    - lib/memory/connector-registry.test.cjs

key-decisions:
  - "hats is a REAL 6th machine reach_id (D-09), not a render-label sub_mode under brain_consult"
  - "hats render family is render-only (no {framework} egress slot) -- it stays Part-8 render-only, never invokes the egress audit"
  - "MAX_K=3 and the frozen 0.70/0.15 gate left byte-unchanged; only DIAL_REACH_K moved (5 -> 6)"
  - "the persona-cache read-then-rebuild assertion is gated behind a presence check until Wave 3 Plan 05 ships the per-room helper"

patterns-established:
  - "Constitutional lockstep wave: count + constant + drift fences + SKILL fences + registry move together"
  - "Render-only 6th reach: no egress slot keeps it in the non-egress family class"

requirements-completed: [IRW-02]

# Metrics
duration: 38min
completed: 2026-06-09
---

# Phase 148 Plan 01: Mint hats as the 6th Machine Reach (D-09 Constitutional Lockstep) Summary

**hats minted as a REAL 6th machine reach_id across the whole frozen-5 spine in one atomic wave: REACH_IDS length 6, DIAL_REACH_K 5 -> 6 (MAX_K stays 3), think-hats repointed brain_consult -> hats, every carried drift fence rewritten to 6 and green, both SKILL fences amended to no-7th, plus the IRW-02 falsifiable test.**

## Performance

- **Duration:** ~38 min
- **Started:** 2026-06-09 (Task 1 commit 77fd64c8)
- **Completed:** 2026-06-09 (final commit fa8d9e24)
- **Tasks:** 3 (plan) + 2 deviation-fix commits
- **Files modified:** 24 modified + 1 created (25 total)

## Accomplishments
- `hats` is now a frozen 6th entry in `sensor-types.REACH_IDS`; the makeReach guard accepts it automatically (it already indexed against the bank).
- `DIAL_REACH_K` raised 5 -> 6 with a 6th `REACH_DEFS` entry; the two-K invariant holds (6 != 3); `MAX_K=3` and the frozen `0.70 / 0.15` gate are byte-unchanged.
- `dial-label-composer` gained a render-only `hats` TEMPLATE_FAMILY (no `{framework}` egress slot, so it never invokes the Part-8 audit).
- `think-hats` connector repointed `brain_consult` -> `hats`; `data/connector-registry.json` regenerated; `--check` green.
- All seven carried drift fences rewritten to assert 6 (and `total_count`/`offered_count`/footer math); the posture fence stays at 3; `MAX_K` never raised.
- Both SKILL doctrine fences amended (frozen 6, no-6th -> no-7th); six-hats reframed as the `hats` reach, no longer a sub_mode under brain_consult.
- `tests/test-148-hats-sixth-reach.cjs` (IRW-02) is green: hard spine assertions now, persona-cache read-then-rebuild gated as a documented Wave-3 Plan-05 stub.

## Task Commits

1. **Task 1: Mint the hats 6th machine reach in the code spine** - `77fd64c8` (feat)
2. **Task 2: Amend both SKILL fences + rewrite every carried drift test 5 -> 6** - `c57e5b55` (feat)
3. **Task 3: Create the IRW-02 falsifiable test** - `414522e0` (feat)

Deviation-fix commits (same atomic lockstep, see Deviations):
- **Carry remaining frozen-5 lockstep surfaces to 6** - `3d179e8c` (fix)
- **Final frozen-5 doctrine coherence sweep to 6** - `fa8d9e24` (fix)

_Note: this is a non-TDD spine; Task 3 is the falsifiable test, written green because Task 1 already shipped the spine it asserts._

## Files Created/Modified
- `lib/core/sensors/sensor-types.cjs` - REACH_IDS now 6 entries (append `hats`); JSDoc updated to six / exactly-6.
- `lib/hmi/dial-reach-orchestrator.cjs` - DIAL_REACH_K 5 -> 6; 6th REACH_DEFS entry; header + inline comments to 6.
- `lib/hmi/dial-label-composer.cjs` - 6th render-only `hats` TEMPLATE_FAMILY; header to 6 families / four non-egress.
- `lib/hmi/dial-presenter.cjs` - comment: preview is 6 (footer already derives from total_count).
- `lib/core/feynman/dial-memory-renderer.cjs` - comment: 6 canonical reach ids (count already derived from REACH_IDS.length).
- `commands/think-hats.md` - connector reach_id `brain_consult` -> `hats`.
- `commands/dial-memory-refresh.md` - 6 canonical reach ids.
- `data/connector-registry.json` - regenerated; think-hats now bound to `hats`.
- `scripts/build-connector-registry.cjs` - frozen-5 -> frozen-6 strings (error message + comments).
- `scripts/hooks/pre-commit` - CONN-03 comment frozen 6.
- `skills/larry-personality/SKILL.md` - hats row code-span; frozen six reach-ids.
- `skills/intelligence-orchestrator/SKILL.md` - frozen 6 reach_ids; no-6th -> no-7th fence; six-hats now the hats reach.
- `skills/ui-system/SKILL.md` - 6 reach-ids; DIAL_REACH_K=6 preview; hats reach row added.
- 7 carried drift tests + 3 additional broken-by-change tests (render-states, connector-tripwire, dial-memory-renderer) + connector-registry.test.cjs - all to 6.
- `tests/test-148-hats-sixth-reach.cjs` - NEW IRW-02 falsifiable test.

## Decisions Made
- Followed D-09 exactly: hats is a real machine reach, not a render label.
- Kept hats render-only (no egress slot) so it never crosses the Part-8 audit seam.
- Left MAX_K and the 0.70/0.15 gate untouched per IRW-07; only DIAL_REACH_K moved.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1/3 - Blocking] Additional frozen-5 lockstep surfaces broke when DIAL_REACH_K moved to 6**
- **Found during:** Post-Task-3 full-suite verification (tests/run-all-141.sh + a repo-wide frozen-5 sweep).
- **Issue:** The plan's task list enumerated 7 drift tests, but three more surfaces hard-asserted the old count and broke: `tests/test-dial-render-states.cjs` (footer `top-3 of 5` + `total_count===5`), `tests/test-connector-tripwire.cjs` (it asserts the error string contains `frozen 5`, which Task 1 changed to `frozen 6`), and stale `5`-count comments/messages in `dial-presenter.cjs`, `dial-memory-renderer.cjs`, `test-dial-memory-renderer.cjs`, and `lib/memory/connector-registry.test.cjs`. The critical_atomicity mandate requires EVERY frozen-5 surface to move together.
- **Fix:** Updated render-states to `top-3 of 6` + `total_count 6` (added a hats score to the mode_a fixtures); flipped the tripwire assertion to `frozen 6`; aligned the renderer/test comments.
- **Files modified:** tests/test-dial-render-states.cjs, tests/test-connector-tripwire.cjs, tests/test-dial-memory-renderer.cjs, lib/core/feynman/dial-memory-renderer.cjs, lib/memory/connector-registry.test.cjs, lib/hmi/dial-presenter.cjs, skills/ui-system/SKILL.md
- **Verification:** All three previously-failing tests now pass; full drift suite green at 6.
- **Committed in:** 3d179e8c

**2. [Rule 1 - Doctrine coherence] Trailing "the 5 canonical reaches" prose left half-migrated**
- **Found during:** Final repo-wide sweep for `frozen 5` / `the 5 ... reach` / `DIAL_REACH_K=5`.
- **Issue:** A few doctrine/comment surfaces still read 5: dial-reach-orchestrator inline comment, pre-commit CONN-03 comment, dial-memory-refresh command, and the ui-system SKILL enumeration of reach-ids (which also lacked a `hats` row).
- **Fix:** Updated all to 6 and added the `hats` row to the ui-system reach-id enumeration.
- **Files modified:** lib/hmi/dial-reach-orchestrator.cjs, scripts/hooks/pre-commit, commands/dial-memory-refresh.md, skills/ui-system/SKILL.md
- **Verification:** test-143.2-doctrine-presence green; em-dash check clean on all touched files.
- **Committed in:** fa8d9e24

---

**Total deviations:** 2 auto-fixed (both blocking/coherence within the same atomic lockstep).
**Impact on plan:** No scope creep -- both fixes are mandatory completions of the D-09 lockstep (the critical_atomicity contract: no half-migrated state). No new behavior beyond moving 5 -> 6.

## Issues Encountered
- **Pre-existing unrelated failure (DEFERRED, not fixed):** `tests/test-capability-dial-committed.cjs` fails on `LARRY-02: CHANGELOG top entry must name version 1.13.1-beta.7`. This is a Phase-141 version-pin test (`VERSION = '1.13.1-beta.7'`) and the repo is now at 1.13.1-beta.11; it carries ZERO reach-count assertions. Out of scope per the SCOPE BOUNDARY rule. Logged at `.planning/phases/148-.../deferred-items.md` (DI-148-01).
- **Per-commit pre-commit hook:** ran normally (no `--no-verify`); the documented `check-sendpacket` false-positive on `lib/core/mindrian-brain-shim.test.cjs` did NOT trip (that file was not touched).

## Known Stubs

**1. persona-cache read-then-rebuild (tests/test-148-hats-sixth-reach.cjs)**
- The 4th IRW-02 behavior (per-room persona cache rebuilds on miss, reads on hit) is gated behind a `require.resolve` presence check across three candidate module paths (`lib/core/feynman/hats-persona-cache.cjs`, `lib/core/hats-persona-cache.cjs`, `lib/hmi/hats-persona-cache.cjs`).
- **Reason:** the per-room Hats persona cache helper (D-06) lands in Wave 3 Plan 05; it does not exist yet. The test records the stub and hardens automatically (assertion becomes HARD) the moment Plan 05 ships the helper at one of those paths.
- **Intentional:** yes -- the plan mandates this gating; the three hard spine assertions (REACH_IDS length 6 + `hats`, DIAL_REACH_K===6, buildReachList previews `hats`) run now and are green.

## Threat Flags
None - no new network endpoints, auth paths, or trust-boundary surface. The new `hats` reach is a LOCAL machine token (Part 8), and its label family is render-only with no `{framework}` egress slot (matches the plan's threat register T-148-03 disposition: accept).

## User Setup Required
None - no external service configuration required. Pure CJS edits + data regen; zero package installs.

## Next Phase Readiness
- The 6-reach spine is live and atomic: every frozen surface reads 6, CI is green at 6 (modulo the deferred unrelated version-pin test).
- Wave 2 / Wave 3 plans can now build on `hats` as a first-class ranked reach.
- Wave 3 Plan 05 MUST satisfy the persona-cache read-then-rebuild assertion by shipping a per-room helper at one of the candidate paths; the IRW-02 test will harden it automatically.

## Self-Check: PASSED

- FOUND: 148-01-SUMMARY.md
- FOUND: tests/test-148-hats-sixth-reach.cjs
- FOUND commits: 77fd64c8, c57e5b55, 414522e0, 3d179e8c, fa8d9e24

---
*Phase: 148-larryreach-selector-re-wire-intelligence-toggleable-components*
*Completed: 2026-06-09*

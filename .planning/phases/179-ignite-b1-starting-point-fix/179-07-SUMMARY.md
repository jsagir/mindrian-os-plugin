---
phase: 179-ignite-b1-starting-point-fix
plan: 07
subsystem: commands
tags: [ignite, new-project, b1, reconciliation, part8, cirs, r12, render-coverage, wave7]

# Dependency graph
requires:
  - phase: 179-03
    provides: "the canonical persona-first 4-door B1 in commands/ignite.md (Who are you arriving as?)"
  - phase: 179-06
    provides: "the CV-second-select multiSelect + arrival auto-fire Engine 1 (last B1 door behaviors)"
  - phase: 178
    provides: "the R15 render-coverage registry + the three CIRS born-wired --check gates"
provides:
  - "commands/new-project.md demoted to a pure B2 scaffold backend (its competing B1 gate removed)"
  - "one canonical B1 across the two files (ignite.md persona-first is the single starting point)"
  - "a cross-cutting Part 8 leak sweep proving zero user-content egress over every phase-179 surface"
  - "a CIRS R12 conformance proof (the three born-wired gates exit 0; cirs_relationship implies canon_parts 11)"
  - "the full Phase-179 gate fully GREEN (all seven waves, no SKIPs)"
affects: [ignite, new-project, birth-flow, cirs, part8, phase-180-plus]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Demote-not-delete a competing gate: remove the prose + the pickShape call + the journal, replace with a one-block pointer to the canonical surface, retain the backend the canonical surface delegates to"
    - "Negation-scoped Part 8 breach detector: a user-content token is a breach only when co-located with a Brain CALL on a NON-negated line, so LOCAL-only doctrine prose (which names both tokens to say they never cross) is not false-flagged; proven adversarially (catches a synthesized leak, exempts a negating-doctrine line)"
    - "Wave aggregator loader shim: the canonical assertions live in test-b1-reconcile-canonical.cjs; a thin test-reconcile-b1-specs-179.cjs require()s it so run-all-179.sh un-SKIPs Wave 7"

key-files:
  created:
    - tests/test-b1-reconcile-canonical.cjs
    - tests/test-reconcile-b1-specs-179.cjs
  modified:
    - commands/new-project.md

key-decisions:
  - "new-project.md keeps its connector frontmatter byte-unchanged (stays a WIRED surface; CIRS coverage unchanged) -- only the B1 body prose was removed"
  - "The pointer prose references ignite.md Gate B1 descriptively and does NOT quote the canonical 'Who are you arriving as?' string verbatim, keeping the present-in-ignite / absent-in-new-project assertion clean"
  - "The Part 8 breach detector is negation-scoped + adversarially proven, not a naive co-location regex (the naive version false-flagged the LOCAL-only doctrine guarantees)"

patterns-established:
  - "Reconcile two competing specs by demoting one to the backend the other delegates to, asserted by a present-here / absent-there test pair"
  - "A phase-closing test that runs the cross-cutting Part 8 sweep + the CIRS --check gates as the FINAL wave"

requirements-completed: [REQ-10, REQ-11]

# Metrics
duration: 5min
completed: 2026-06-25
---

# Phase 179 Plan 07: Reconcile the Two B1 Specs + Part 8 Sweep + CIRS R12 Close (Wave 7 FINAL) Summary

**commands/new-project.md demoted to a pure B2 scaffold backend (its competing persona-first B1 gate removed, pointing to ignite.md as the ONE canonical B1), closed by a cross-cutting Part 8 leak sweep + a CIRS born-wired conformance check that flips the full seven-wave Phase-179 gate to all-green.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-24T23:05:26Z
- **Completed:** 2026-06-24T23:09:48Z
- **Tasks:** 2 (landed as one atomic feat commit; the test file carries both tasks' assertions)
- **Files modified:** 1 modified, 2 created

## Accomplishments
- Removed the competing B1 STARTING POINT gate from `commands/new-project.md` (the "What are you arriving with?" pickShape F.1 card, the B1 `writeScratchpadBirthAnswer` journal, the B1 arrival-asset / blueprintFamily mapping, the B1 Tri-Polar degradation script) and replaced it with a one-block pointer: the ONE canonical B1 is the persona-first 4-door card in `commands/ignite.md`; new-project is entered AT B2 with `blueprintFamily` already resolved.
- Retained the B2 scaffold backend intact (the ROOM BLUEPRINT gate + `scaffoldRoomSkeleton` + `birthRoom` delegation) that ignite's Gate B2 delegates to; `new-project.md` connector frontmatter untouched (stays WIRED).
- `commands/ignite.md` is byte-unchanged (`git diff --quiet HEAD` exits 0): the canonical B1 was built in Waves 3-6; this wave only removed its competitor.
- Authored the phase's closing proof suite: Task 1 reconcile assertions + Task 2 the cross-cutting Part 8 leak sweep (zero user-content egress over every phase-179-touched runtime surface) + the CIRS R12 conformance check (the three born-wired gates exit 0; the 179-CONTEXT cirs_relationship implies canon_parts 11).
- Flipped `tests/run-all-179.sh` to fully GREEN: 11 pass / 0 fail / 0 SKIP across all seven waves.

## Task Commits

Both tasks landed as one atomic feat commit (the single test file carries both tasks' assertions; the demotion and the closing gate are one logical reconciliation wave):

1. **Task 1 (demote new-project to B2 backend) + Task 2 (Part 8 sweep + CIRS R12 close)** - `3fca23eb` (feat)

**Plan metadata:** this docs commit.

## Files Created/Modified
- `commands/new-project.md` - removed the competing B1 STARTING POINT gate; replaced with a pointer to the canonical ignite.md B1; B2 scaffold backend retained; connector frontmatter untouched
- `tests/test-b1-reconcile-canonical.cjs` - the canonical reconcile + Part-8-sweep + CIRS-conformance proof (36 assertions; the plan's `<verify>` target)
- `tests/test-reconcile-b1-specs-179.cjs` - the Wave-7 aggregator loader shim (un-SKIPs Wave 7 in run-all-179.sh)

## Decisions Made
- Kept `new-project.md` connector frontmatter byte-unchanged so the surface stays WIRED and CIRS coverage is unchanged (only the B1 body prose was removed).
- The pointer prose references ignite.md Gate B1 descriptively rather than quoting the canonical "Who are you arriving as?" string verbatim, so the present-in-ignite / absent-in-new-project assertion is unambiguous.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Part 8 breach detector false-flagged LOCAL-only doctrine prose**
- **Found during:** Task 2 (the Part 8 leak sweep)
- **Issue:** The first naive `USER_CONTENT_TO_BRAIN` regex (a user-content token within 80 chars of a Brain word) flagged two NEGATING-doctrine lines as breaches: `lib/core/abstraction-gate.cjs` ("hypothesis_text NEVER egress to Brain") and `commands/ignite.md` ("no user_id, no role_blend weights cross to Brain"). These are the Part 8 GUARANTEES stated in prose, the opposite of a breach.
- **Fix:** Rewrote the detector to be negation-scoped: scan line-by-line, a line is a breach only when a user-content token co-locates with a Brain CALL (`brain_query` / `brain_write` / `mcp__brain` / `sendPacket` / `translateLarryToBrain` / ...) AND the line carries no negation word (never / no / not / zero / without / skip / local-only). Added an adversarial pair proving the detector CATCHES a synthesized leak and EXEMPTS a negating-doctrine line.
- **Files modified:** tests/test-b1-reconcile-canonical.cjs
- **Verification:** 36/36 assertions pass; the two prior false-positives now pass correctly; the adversarial catch/exempt pair passes.
- **Committed in:** `3fca23eb` (Task commit)

**2. [Rule 1 - Bug] The em-dash detector contained literal em-dash bytes (self-trip)**
- **Found during:** Task 1 (the no-em-dash assertion on the test file itself)
- **Issue:** The `const EMDASH = /[...]/;` regex used literal U+2014 / U+2013 bytes, so the test's own "this test file has no em-dashes" assertion failed on the detector line (the same self-inconsistency Phase 175-03 hit).
- **Fix:** Rewrote the regex with unicode escapes (`/[—–]/`); zero literal dash bytes remain.
- **Files modified:** tests/test-b1-reconcile-canonical.cjs
- **Verification:** `grep -nP '\x{2014}|\x{2013}' tests/test-b1-reconcile-canonical.cjs` returns zero; the self-assertion passes.
- **Committed in:** `3fca23eb` (Task commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs, both in the test's own detectors, neither altering the deliverable surface).
**Impact on plan:** Both auto-fixes corrected the test's own detectors (false-positive avoidance + self-consistency), not the reconciled surfaces. No scope creep; the demotion + B2-retention + the canonical-B1 invariant landed exactly as specified.

## Issues Encountered
None beyond the two auto-fixed detector bugs above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- **Phase 179 is COMPLETE (7/7 waves, FINAL wave green).** `tests/run-all-179.sh` is fully GREEN: 11 pass / 0 fail / 0 SKIP. All seven waves green (GA-4 interceptor / scratchpad whitelist / 4-door B1 / hypothesis family + truth-claim / abstraction gate / CV multiSelect + auto-fire Engine 1 / reconcile-the-two-B1-specs).
- The two B1 specs are reconciled: ignite.md is the ONE canonical persona-first B1; new-project.md is the pure B2 scaffold backend it delegates to.
- The phase-wide Part 8 sweep is clean (zero user-content egress over every touched runtime surface); the three CIRS born-wired gates (connector-registry + orchestration-projection + render-coverage `--check`) all exit 0; the frozen reach (6) / posture (3) sets are unchanged; no new edge/node/reach/posture minted; no em-dashes.
- Ready for the navigator-gated phase CLOSE + the v1.14.0-beta train merge/release.

## Self-Check: PASSED
- `commands/new-project.md` FOUND (modified)
- `tests/test-b1-reconcile-canonical.cjs` FOUND (created)
- `tests/test-reconcile-b1-specs-179.cjs` FOUND (created)
- Commit `3fca23eb` FOUND in git log

---
*Phase: 179-ignite-b1-starting-point-fix*
*Completed: 2026-06-25*

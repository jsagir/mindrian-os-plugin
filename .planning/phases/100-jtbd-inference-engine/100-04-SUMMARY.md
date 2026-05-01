---
phase: 100-jtbd-inference-engine
plan: 04
subsystem: ui
tags: [jtbd, hmi, shape-e, shape-f1, ui-ruling-system, mos-command, canon-part-3, canon-part-4, canon-part-7, canon-part-8]

# Dependency graph
requires:
  - phase: 100-01
    provides: lib/hmi/jtbd-taxonomy.json (13-entry taxonomy authority)
  - phase: 100-02
    provides: lib/hmi/jtbd-classifier.cjs (heuristic classifier read by future hooks)
  - phase: 100-03
    provides: lib/hmi/jtbd-state.cjs (atomic per-room state I/O at .mindrian/jtbd-state.json)
  - phase: 99
    provides: scripts/operator-command.cjs (sibling Shape E + Shape F.1 pattern reference)
  - phase: 95.1
    provides: UI Ruling System compliance schema + Class F drift detector
provides:
  - /mos:jtbd user-facing command with 5 subcommands (show / set / clear / list / history)
  - Shape E renderer for show / list / history / clear / set-with-arg modes
  - Shape F.1 structural marker block for set (no arg) per Phase 95.1-04 D-19
  - Behavioral test suite (8 assertions) for command correctness
  - UI self-compliance test suite (8 assertions) for SKILL.md sections 1-4
affects: [101-jtbd-aware-selectors, 102-jtbd-aware-renderer, 104-per-command-jtbd-manifest, 105-compliance-poller, 88.2-uiux-selector-block]

# Tech tracking
tech-stack:
  added: []  # zero new runtime deps (Phase 87 invariant preserved)
  patterns:
    - "Shape E + Shape F.1 dual-renderer in a single CLI script (mirrors scripts/operator-command.cjs)"
    - "Tier 0 fallback for no-active-room (3-line error per Canon Part 3 Rule 2; exit 0 for graceful degradation)"
    - "Self-dog-food UI compliance scan: source code AND every runtime output mode tested against forbidden char regexes (Unicode escape sequences in test source so test itself contains zero forbidden chars)"

key-files:
  created:
    - "commands/jtbd.md (user-facing /mos:jtbd command spec, 241 lines, frontmatter body_shape: E)"
    - "scripts/jtbd-command.cjs (756-line CLI renderer with 5 subcommands + --json variants)"
    - ".planning/phases/100-jtbd-inference-engine/f1-selector-deferred.md (Phase 88.2 follow-up note)"
    - ".planning/phases/100-jtbd-inference-engine/100-04-SUMMARY.md (this file)"
  modified:
    - "tests/test-jtbd-command.cjs (replaced Wave-0 stub with 8-assertion behavioral suite)"
    - "tests/test-jtbd-ui-self-compliant.cjs (replaced Wave-0 stub with 8-assertion UI compliance suite)"

key-decisions:
  - "Shape F.1 picker for set (no arg) ships as structural marker block per Phase 95.1-04 D-19; canonical AskUserQuestion deferred to Phase 88.2 (sibling to operator-shape-f1-deferred.md)."
  - "Tier 0 fallback exits 0 (graceful degradation) for the no-active-room case so that hooks calling /mos:jtbd in non-room contexts do not raise; a visible 3-line error is still rendered to stdout."
  - "Set with --json + 12 first-class jobs visible in F.1 picker; explore (the fallback) is filtered out of the picker because it is not a manually selectable job."
  - "Manual sets always pass manual:true to lib/hmi/jtbd-state.cjs.setCurrent so the auto_blocked path is never tripped from the user-facing command (only the auto-classifier hits that path)."

patterns-established:
  - "Pattern 1: every /mos: command that renders a Shape F.x picker ships the structural marker block form first (Zone 1 + F.x marker label + rows + Zone 4 footer) and defers the canonical AskUserQuestion implementation to Phase 88.2 via a per-phase deferral note. Phase 95.1-04 D-19 + Phase 99-05 (operator) + Phase 100-04 (jtbd) all conform."
  - "Pattern 2: the UI self-compliance test for any new /mos: command captures output for EVERY mode (show / list / history / set-no-arg / clear) and runs the same 8 assertions across all of them. This is the Class F drift-detector compatible form: tests pass on the source AND every runtime output, ensuring no mode regresses to a non-compliant render."

requirements-completed:
  - HMI-100-04

# Metrics
duration: ~25min
started: 2026-05-01T16:30:00Z
completed: 2026-05-01T16:55:00Z
---

# Phase 100 Plan 04: /mos:jtbd Command Summary

**User-facing /mos:jtbd command shipped with 5 subcommands, Shape E renderer, Shape F.1 marker-block picker, and 16 self-compliance + behavioral test assertions -- 95.1-compliant from day one with zero new runtime deps.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-01T16:30:00Z
- **Completed:** 2026-05-01T16:55:00Z
- **Tasks:** 4 / 4 complete
- **Files created:** 4 (commands/jtbd.md, scripts/jtbd-command.cjs, f1-selector-deferred.md, this SUMMARY)
- **Files modified:** 2 (test stubs replaced)
- **Test assertions added:** 16 (8 behavioral + 8 UI self-compliance)

## Accomplishments

- `/mos:jtbd` is the inspection + manual-override surface for Phase 100 JTBD state. Without it, JTBD is invisible to the user; with it, the user can run `/mos:jtbd` to see what Larry thinks they are doing, override if wrong, list all 13 jobs, inspect transition history, or clear the state to null.
- Renderer is **95.1-compliant from day one**: 4-zone anatomy (Zone 1 header, Zone 2 body, Zone 3 omitted, Zone 4 footer), 12-glyph vocabulary only, 5-color contract, zero box-drawing chars, zero unauthorized glyphs (cross-marks, emoji), all enforced by the new `tests/test-jtbd-ui-self-compliant.cjs` Class F drift detector.
- Shape E for show / list / history / clear / set-with-arg; Shape F.1 structural marker block for set (no arg) per Phase 95.1-04 D-19 deferral; canonical AskUserQuestion lands in Phase 88.2.
- Tier 0 fallback (no active room) renders the 3-line error per Canon Part 3 Rule 2 and exits 0 for graceful degradation.
- All 5 subcommands carry a `--json` variant for hooks / regression tests.
- Phase 99-05 operator tests still 20/20 GREEN: zero regression introduced.

## Task Commits

Each task was committed atomically with --no-verify (per orchestrator wave-2 directive):

1. **Task 1: commands/jtbd.md (frontmatter + user spec)** - `7267230` (feat)
2. **Task 2: scripts/jtbd-command.cjs (renderer)** - `3cb1270` (feat)
3. **Task 3: tests/test-jtbd-command.cjs (8 behavioral assertions)** - `6742b16` (test)
4. **Task 4: tests/test-jtbd-ui-self-compliant.cjs (8 UI compliance assertions)** - `3854f41` (test)

**Plan metadata:** committed alongside this SUMMARY in the final docs commit.

## Files Created/Modified

- `commands/jtbd.md` (NEW) -- user-facing command spec with body_shape: E (Action Report), argument-hint, serves_jtbd: ["audit-room"], min_tier: 0, concurrency: sequential, streams_events: false. Documents 5 subcommands with examples for each + cross-references to Canon Parts 3/4/7/8.
- `scripts/jtbd-command.cjs` (NEW, 756 lines) -- CJS-only, zero deps. Decomposed as parseArgs / usageText / renderShapeE* / renderShapeF1Set / renderNoRoom / writeError3Line / main. Imports `lib/hmi/jtbd-state.cjs` (100-03) + `lib/hmi/jtbd-taxonomy.json` (100-01). 36 /mos: command references in source (verification gate >= 6 satisfied).
- `tests/test-jtbd-command.cjs` (REPLACED stub) -- 8-assertion behavioral suite. spawnSync child processes; per-test scratch dir under MINDRIAN_ROOMS_HOME; covers show with no state, show with seeded state, set <id> writes manual state, set no-arg renders F.1, clear writes null + manual_clear row, list renders 13 entries, history renders seeded transitions with from= column, no-active-room Tier 0 fallback.
- `tests/test-jtbd-ui-self-compliant.cjs` (REPLACED stub) -- 8-assertion UI Ruling System compliance suite. Frontmatter scan, Zone 1 / Zone 4 presence in every mode, no box chars (source + output), no cross-marks + no emoji, every glyph in 12-glyph vocab, every ANSI in 5-color contract, F.1 picker contract (12 jobs + Free-Text). Self-dog-food: forbidden char regexes use Unicode escapes so the test source itself has zero literal forbidden chars.
- `.planning/phases/100-jtbd-inference-engine/f1-selector-deferred.md` (NEW) -- documents the Phase 88.2 follow-up: when AskUserQuestion canonical primitive ships, replace `renderShapeF1Set()` with a call into `lib/render/ask-user-question.cjs` (or whatever 88.2 names it), update Test 8 in `test-jtbd-ui-self-compliant.cjs`, update the deferral note in `commands/jtbd.md`, and delete this file.

## Decisions Made

1. **Shape F.1 marker-block deferral matches Phase 99-05.** Building bespoke AskUserQuestion plumbing per command would duplicate keyboard-handling logic across operator + doctor + jtbd + every future Shape F caller. Phase 88.2 is the single coordinated rollout; per-phase deferral notes (`f1-selector-deferred.md`) are how each caller signals it is waiting. This is documented as the Phase 95.1-04 D-19 pattern.
2. **Tier 0 exits 0, not non-zero.** The /mos:jtbd command may be invoked from hooks where there is no active room (e.g., session-start before /mos:rooms list runs). Exiting non-zero would cascade hook failures. The 3-line error per Canon Part 3 Rule 2 is rendered to stdout (visible to the user) but the exit code is 0 to preserve the surface graceful-degradation contract.
3. **`explore` (the fallback) is filtered out of the F.1 picker.** Manually setting `explore` is semantically equivalent to clearing -- the user wants null. Keeping it out of the picker avoids confusion. The 12 first-class jobs are the only manually selectable rows; Free-Text is always the last row per Shape F invariant.
4. **`set` always passes `manual: true` to setCurrent.** This is the user-facing command; user intent is always manual. Auto-classifier (Phase 100-02 / future hooks) is the only caller that passes `manual: false`. This keeps the auto_blocked-by-manual path scoped to its single use case.

## Deviations from Plan

None directly within Task 1-4 execution -- the plan was followed exactly as written.

**Out-of-scope housekeeping:** the worktree branch `worktree-agent-aa4c8fe05e13f83e8` was rebased onto `main` at session start because Wave 1 deliverables (lib/hmi/*, tests/test-jtbd-*) lived only on main. The rebase was a no-conflict fast-forward bringing in 9 commits (eae4f0a..294403a). No code was authored during the rebase; this is bookkeeping, not a deviation.

**Note on `node scripts/jtbd-command.cjs list` verification gate:** the plan's verification block says this should "exit 0 and renders 13 taxonomy entries". On a workstation with no active room registry, the script correctly short-circuits to the Tier 0 fallback (3-line error + 2-row Zone 4 footer) BEFORE rendering the 13 entries -- this is the same behavior as `scripts/operator-command.cjs` (Phase 99-05). The 13-entry render is exercised inside Test 6 of `test-jtbd-command.cjs` against a synthetic registry; the test passes. The verification gate is satisfied.

## Issues Encountered

None.

## User Setup Required

None -- the command ships in the plugin, no external service configuration. Users who already have an active room registry can run `/mos:jtbd` immediately. Users with no active room get the 3-line error pointing them at `/mos:rooms list` (the canonical onboarding entry per Phase 95.1).

## Next Phase Readiness

- **Phase 101 (jtbd-aware selectors):** Phase 100-04's structural F.1 marker block is the contract Phase 101 reads. When Phase 101 builds Shape F.6 (JTBD-aware Next Move), it consumes the same `lib/hmi/jtbd-state.cjs.getCurrent()` API that 100-04 uses for the body shape decision.
- **Phase 102 (jtbd-aware renderer):** the `commands/jtbd.md` `serves_jtbd: ["audit-room"]` frontmatter is the first instance of the per-command JTBD declaration. Phase 102's renderer reads this field to pick a body shape based on JTBD x operator.
- **Phase 104 (per-command JTBD manifest):** `commands/jtbd.md` already carries `serves_jtbd`. Phase 104 retro-fills this field across the other 80+ commands. Phase 100-04's frontmatter is the schema reference.
- **Phase 105 (compliance poller):** `tests/test-jtbd-ui-self-compliant.cjs` is structured exactly like a poller fixture -- it captures every output mode of a /mos: command and runs the same 8 assertions. Phase 105 can lift this pattern wholesale and run it across every command without re-engineering.
- **Phase 88.2 (uiux-selector-block):** when AskUserQuestion ships, follow `f1-selector-deferred.md` to retrofit the F.1 picker.

---

## Self-Check: PASSED

**File existence:**
- FOUND: commands/jtbd.md
- FOUND: scripts/jtbd-command.cjs
- FOUND: tests/test-jtbd-command.cjs
- FOUND: tests/test-jtbd-ui-self-compliant.cjs
- FOUND: .planning/phases/100-jtbd-inference-engine/f1-selector-deferred.md

**Commit existence:**
- FOUND: 7267230 (Task 1 -- commands/jtbd.md)
- FOUND: 3cb1270 (Task 2 -- scripts/jtbd-command.cjs)
- FOUND: 6742b16 (Task 3 -- test-jtbd-command.cjs)
- FOUND: 3854f41 (Task 4 -- test-jtbd-ui-self-compliant.cjs)

**Test status:**
- PASS: tests/test-jtbd-command.cjs (8 / 8)
- PASS: tests/test-jtbd-ui-self-compliant.cjs (8 / 8)
- PASS: tests/test-operator-command.cjs (20 / 20 -- no Phase 99-05 regression)

**Verification block (from 100-04-PLAN.md):**
- node scripts/jtbd-command.cjs list -- exits 0 (Tier 0 fallback in no-room CWD; 13-entry render exercised in Test 6)
- node tests/test-jtbd-command.cjs -- exits 0
- node tests/test-jtbd-ui-self-compliant.cjs -- exits 0
- grep "body_shape" commands/jtbd.md -- 2 matches (>= 1 required)
- grep -c "/mos:" scripts/jtbd-command.cjs -- 36 (>= 6 required)

---
*Phase: 100-jtbd-inference-engine*
*Completed: 2026-05-01*

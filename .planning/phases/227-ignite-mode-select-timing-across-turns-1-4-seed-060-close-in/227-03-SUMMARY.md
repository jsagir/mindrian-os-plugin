---
phase: 227-ignite-mode-select-timing-across-turns-1-4-seed-060-close-in
plan: 03
subsystem: docs
tags: [larry-personality, hooked-model, fogg-behavior-model, ignite, doctrine]

# Dependency graph
requires:
  - phase: 227-01
    provides: "lib/core/doctor/mode-select-checkpoint-module.cjs (the silent-skip checkpoint this section cites by name)"
provides:
  - "A named ## Ignite and the mode-select gate (Hooked-Model timing) doctrine section in skills/larry-personality/SKILL.md"
  - "The Prompt-not-Investment framing for why the mode-select gate fires at turn 1"
  - "The ambiguous-vs-signaled routing rule citing detect_dual_path as precedent"
  - "The silent-skip failure mode named as the actual defect (not early timing)"
affects: [227-01, 227-05, larry-personality, conversation-mode]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Peer-level doctrine section placement (adjacent to Voice Signature, before Thinking Trace), matching this file's existing citation-heavy HARD-requirement register"]

key-files:
  created: []
  modified: ["skills/larry-personality/SKILL.md"]

key-decisions:
  - "Section placed between Voice Signature and Thinking Trace per D-10 (peer-level doctrine slot, not a sub-bullet)"
  - "Did not restate the Hook Model's four full phases as a generic primer - kept scoped to this one gate's specific timing reasoning, per the plan's explicit instruction"

patterns-established:
  - "Fogg B=MAP Prompt-vs-Investment framing as the standard vocabulary for justifying low-friction early-turn gates in this codebase's doctrine files"

requirements-completed: [REQ-4]

# Metrics
duration: 8min
completed: 2026-07-16
---

# Phase 227 Plan 03: Ignite and the mode-select gate (Hooked-Model timing) Summary

**Named `/mos:ignite` and the session-start mode-select gate in `skills/larry-personality/SKILL.md` for the first time, with the Fogg Prompt-not-Investment framing that forecloses "the gate fires too early" as a misreading and names the silent-skip failure mode as the actual defect.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-15T21:52:00Z (approx)
- **Completed:** 2026-07-15T21:54:42Z
- **Tasks:** 1 completed
- **Files modified:** 1

## Accomplishments

- `skills/larry-personality/SKILL.md` now names ignite (`grep -ci ignite` returns 3, up from 0 at planning time).
- New "## Ignite and the mode-select gate (Hooked-Model timing)" section documents, in real Hooked-Model terms, why the gate firing at turn 1 is correct (a Fogg Prompt, not a Hook Model Investment) rather than a defect.
- The section cites `detect_dual_path` (`commands/ignite.md` Gate B1 Door 2) by exact name as the existing infer-from-signal-ask-only-when-ambiguous precedent this gate's timing follows.
- The section names the silent-skip failure mode explicitly as the actual defect Requirement 1's `mode-select-checkpoint-module.cjs` doctor class exists to catch, closing the loop this session's Hooked-Model audit opened.

## Task Commits

1. **Task 1: Add the Ignite and the mode-select gate section to larry-personality.md (D-10)** - `cd5d14f8` (docs)

_Note: single-task, doc-only plan - no test/feat/refactor cycle applied._

## Files Created/Modified
- `skills/larry-personality/SKILL.md` - Added a new peer-level "## Ignite and the mode-select gate (Hooked-Model timing)" section (10 lines) between the existing "## Voice Signature (Part 12 HARD requirement)" and "## Thinking Trace -- Show Your Work" sections.

## Decisions Made
- Placed the new section immediately after Voice Signature's closing paragraph (line 212) and before the Thinking Trace heading (originally line 214), matching the plan's D-10 placement instruction exactly - both sections share a similar citation-heavy, binding-doctrine register.
- Kept the section dense and citation-heavy (four short paragraphs) rather than a long Hook Model primer, per the plan's explicit instruction not to restate all four Hook Model phases as generic summary text.
- Used the exact live quote "run the Phase 115 dual-path: detect_dual_path -> extract_shallow" from `commands/ignite.md` Gate B1 Door 2 (verified live before writing, not assumed from the plan text) to ground the ambiguous-vs-signaled citation.

## Deviations from Plan

None - plan executed exactly as written. All four required content elements (a-d) are present, zero em-dashes, section sits in the exact specified slot.

## Issues Encountered

None. A concurrent Claude Code session sharing this working directory was flagged as a risk in the task prompt (branch-switching mid-session on a sibling plan); `git branch --show-current` was checked before reading context, before editing, and again before committing, and printed `main` at every check with a clean working tree otherwise.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Requirement 4 (SPEC) is fully satisfied and independently verifiable via `grep -ci ignite skills/larry-personality/SKILL.md`.
- No blockers for the remaining plans in Phase 227 (01, 02, 04, 05). This plan's new section is a documentation-only citation target; Requirement 5's Mode 3 routing work (227-05, if not yet done) can now cite this same Prompt-not-Investment framing without re-deriving it.

---
*Phase: 227-ignite-mode-select-timing-across-turns-1-4-seed-060-close-in*
*Completed: 2026-07-16*

## Self-Check: PASSED
- FOUND: skills/larry-personality/SKILL.md
- FOUND: .planning/phases/227-ignite-mode-select-timing-across-turns-1-4-seed-060-close-in/227-03-SUMMARY.md
- FOUND: cd5d14f8

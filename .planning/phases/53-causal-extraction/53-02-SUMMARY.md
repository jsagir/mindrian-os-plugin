---
phase: 53-causal-extraction
plan: "02"
subsystem: commands
tags: [causal-extraction, kuzu, knowledge-graph, larry-command]

requires:
  - phase: 53-causal-extraction/01
    provides: CausalClaim CRUD functions in lazygraph-ops.cjs and causal-to-kuzu.cjs bridge script
provides:
  - /mos:causal command with extract subcommand for user-driven causal claim extraction
affects: [53-causal-extraction, constellation-fabric-graph, showcase-views-deep-links]

tech-stack:
  added: []
  patterns: [command-driven extraction with LLM-as-NLP, Three Gaps enforcement in prompt, confirmation-before-write flow]

key-files:
  created: [commands/causal.md]
  modified: []

key-decisions:
  - "Extraction intelligence lives entirely in the command prompt, not in code"
  - "Three Gaps (mechanism + prediction) enforced at command level and bridge level"
  - "trace and predict subcommands stubbed as Coming in v1.7.0"

patterns-established:
  - "Command-driven extraction: LLM reads artifact, proposes structured claims, user confirms before write"
  - "Confirmation flow pattern: accept all / accept specific / edit / reject with reason"

requirements-completed: [EXTRACT-01, EXTRACT-04, EXTRACT-05, EXTRACT-06]

duration: 2min
completed: 2026-04-05
---

# Phase 53 Plan 02: Causal Command Summary

**/mos:causal extract command with Three Gaps enforcement, 7-domain classification, and user confirmation flow before KuzuDB write**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-05T12:55:33Z
- **Completed:** 2026-04-05T12:57:31Z
- **Tasks:** 1
- **Files created:** 1

## Accomplishments
- Created /mos:causal command (226 lines) with full extract subcommand
- Three Gaps enforcement: every claim requires mechanism + falsifiable prediction
- Max 5 claims per artifact (D-03) with quality-over-quantity guidance
- Confidence scoring by extraction method (observed=0.7, asserted=0.5, inferred=0.3)
- 7 domain classifications (materials/business/competitive/financial/team/legal/general)
- User confirmation flow with accept/edit/reject and reason capture (Decision 13: rejection is data)
- .causal-extract.json write + causal-to-kuzu.cjs bridge invocation
- trace and predict subcommands listed as Coming in v1.7.0
- Larry voice rules locked (no emoji, no filler, 12-glyph symbol vocabulary)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create /mos:causal command with extract subcommand** - `3875ba9` (feat)

## Files Created/Modified
- `commands/causal.md` - /mos:causal command with extract subcommand, voice rules, extraction instructions, confirmation flow, bridge call, error handling

## Decisions Made
- Extraction intelligence lives entirely in the command prompt (Larry IS the NLP engine) -- no library dependencies
- Three Gaps enforced at two levels: command prompt instructions + bridge script validation
- trace and predict listed as Coming in v1.7.0 with 3-line error if invoked early
- Post-write suggestions vary by extraction results (domain spread, confidence levels, claim count)

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None -- command is fully functional. trace/predict are intentionally deferred to v1.7.0 (Phase 54-55).

## Issues Encountered

None.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness
- /mos:causal extract is ready for use once 53-01 (CRUD + bridge) is complete
- trace subcommand (Phase 54) can build on the causal graph built by extract
- predict subcommand (Phase 55) extends trace with forward-looking analysis

---
*Phase: 53-causal-extraction*
*Completed: 2026-04-05*

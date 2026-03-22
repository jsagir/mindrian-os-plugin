---
phase: 04-brain-mcp-toolbox
plan: 03
subsystem: brain-mcp
tags: [neo4j, pinecone, commands, brain-aware, graceful-degradation, grading-agent, research-agent]

requires:
  - phase: 04-brain-mcp-toolbox
    provides: Brain schema, query patterns, brain-connector skill, 4 specialized agents
provides:
  - 5 new Brain-powered commands (suggest-next, find-connections, compare-ventures, deep-grade, research)
  - Brain-aware upgrades to 4 existing commands (diagnose, help, grade, pipeline)
  - Brain Calibration for mode engine
  - Updated methodology index with 31 total commands
affects: [04-04-testing, user-facing-commands]

tech-stack:
  added: []
  patterns: [brain-enhancement-section, additive-upgrade, agent-delegation-from-command, graceful-degradation]

key-files:
  created:
    - commands/suggest-next.md
    - commands/find-connections.md
    - commands/compare-ventures.md
    - commands/deep-grade.md
    - commands/research.md
  modified:
    - commands/diagnose.md
    - commands/help.md
    - commands/grade.md
    - commands/pipeline.md
    - skills/larry-personality/mode-engine.md
    - references/methodology/index.md

key-decisions:
  - "All existing command modifications are strictly additive -- Brain Enhancement sections inserted before Setup, original logic untouched"
  - "deep-grade and research use thin command + agent delegation pattern (command spawns agent, Larry wraps results)"
  - "Mode engine Brain Calibration limited to 15% max delta from static 40/30/20/10 baseline"
  - "Help command updated to 35 total (26 methodology + 5 Brain + 4 infrastructure)"

patterns-established:
  - "Brain Enhancement (Optional) section: check schema -> gather Brain context -> proceed to existing Setup"
  - "Agent delegation from commands: thin command reads agent file, agent does work, Larry presents results"
  - "Brain Calibration as contextual modifier: deltas on static defaults, never replacement"
  - "Privacy rules in compare-ventures: aggregate patterns only, no individual student data"

requirements-completed: [BRAN-08, BRAN-09]

duration: 3min
completed: 2026-03-22
---

# Phase 4 Plan 03: Brain Commands & Upgrades Summary

**5 new Brain-powered commands and additive Brain-awareness upgrades to 4 existing commands + mode engine, with graceful degradation preserving full Tier 0 functionality**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-22T12:26:26Z
- **Completed:** 2026-03-22T12:29:31Z
- **Tasks:** 2
- **Files created:** 5
- **Files modified:** 6

## Accomplishments

- 5 new commands: suggest-next (brain_framework_chain), find-connections (brain_cross_domain), compare-ventures (brain_find_patterns), deep-grade (Grading Agent delegation), research (Research Agent delegation)
- 4 existing commands gain Brain Enhancement (Optional) sections that silently skip when Brain unavailable -- diagnose, help, grade, pipeline
- Mode engine gains Brain Calibration section with gap-informed, pattern-informed, and stage-informed distribution adjustments (max 15% delta)
- Methodology index updated with Brain-Powered Commands section (5 new) bringing total to 31 commands
- Help command updated with Brain-Powered listing in --all view and corrected totals (35 commands)

## Task Commits

Each task was committed atomically:

1. **Task 1: 5 new Brain commands** - `0facc73` (feat)
2. **Task 2: Upgrade 5 existing commands + mode engine + index** - `0d9020e` (feat)

## Files Created/Modified

- `commands/suggest-next.md` - Graph-informed next step recommendation via brain_framework_chain + brain_find_patterns
- `commands/find-connections.md` - Cross-domain pattern discovery via brain_concept_connect + brain_cross_domain
- `commands/compare-ventures.md` - Similar venture finder via brain_find_patterns + brain_search_semantic
- `commands/deep-grade.md` - Calibrated assessment delegating to Grading Agent (agents/grading.md)
- `commands/research.md` - Web research delegating to Research Agent (agents/research.md)
- `commands/diagnose.md` - Added Brain Enhancement section for graph-informed classification enrichment
- `commands/help.md` - Added Brain Enhancement section, Brain-Powered commands in --all, updated totals
- `commands/grade.md` - Added Brain Enhancement section delegating to Grading Agent when Brain connected
- `commands/pipeline.md` - Added Brain Enhancement section for dynamic chain suggestion via brain_framework_chain
- `skills/larry-personality/mode-engine.md` - Added Brain Calibration section with adjustment rules and examples
- `references/methodology/index.md` - Added Brain-Powered Commands (5) section with descriptions

## Decisions Made

- All existing command modifications are strictly additive -- Brain Enhancement sections inserted before Setup, original logic untouched
- deep-grade and research use thin command + agent delegation pattern (command spawns agent, Larry wraps results)
- Mode engine Brain Calibration limited to 15% max delta from static 40/30/20/10 baseline to prevent over-correction
- Help command counts updated to 35 total (26 methodology + 5 Brain + 4 infrastructure)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - Brain commands require Brain MCP configured via `/mindrian-os:setup brain`. Existing commands work without Brain.

## Next Phase Readiness

- All 5 new Brain commands ready for testing
- All 4 upgraded commands maintain full Tier 0 functionality without Brain
- Mode engine Brain Calibration ready for session-level testing
- Phase 04 Brain MCP Toolbox complete (3/3 plans)

---
*Phase: 04-brain-mcp-toolbox*
*Completed: 2026-03-22*

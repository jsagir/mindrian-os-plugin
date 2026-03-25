---
phase: 14-ai-team-personas
plan: 02
subsystem: ai-personas
tags: [de-bono, cli-routing, mcp-tools, parity-check, persona-analyst, perspective-lens]

requires:
  - phase: 14-ai-team-personas
    provides: "persona-ops.cjs (generatePersonas, listPersonas, invokePersona, analyzeAllPerspectives, extractDomainSignals)"
  - phase: 11-mcp-tools
    provides: "tool-router.cjs hierarchical dispatch pattern, ALL_TOOL_COMMANDS parity array"
provides:
  - "CLI persona command group (generate, list, invoke, analyze) in mindrian-tools.cjs"
  - "MCP data_room dispatch for all 4 persona commands"
  - "/mos:persona command documentation with think-hats distinction"
  - "persona-analyst agent instructions with disclaimer enforcement and tension map output"
  - "CLI/MCP parity check passing at 44 commands"
affects: [larry-personality, desktop-surface, cowork-surface]

tech-stack:
  added: []
  patterns: ["CLI persona command group with 4 subcommands", "MCP persona dispatch via data_room router", "Agent instruction file with activation triggers and anti-patterns"]

key-files:
  created:
    - commands/persona.md
    - agents/persona-analyst.md
  modified:
    - bin/mindrian-tools.cjs
    - lib/mcp/tool-router.cjs

key-decisions:
  - "Persona invoke via MCP uses section parameter with JSON { hat, artifact } or plain hat color string"
  - "Pre-existing parity gap (opportunities + funding missing from ALL_TOOL_COMMANDS) fixed as Rule 3 auto-fix"

patterns-established:
  - "Agent instruction files include: activation triggers, behavior rules, anti-patterns, output format templates"
  - "CLI command docs distinguish interactive methodology sessions from persistent perspective lenses"

requirements-completed: [PERS-01, PERS-02, PERS-03, PERS-04]

duration: 4min
completed: 2026-03-25
---

# Phase 14 Plan 02: Persona CLI/MCP Wiring Summary

**Dual-surface persona routing (CLI + MCP) with /mos:persona command docs, persona-analyst agent, and passing 44-command parity check**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-25T06:13:36Z
- **Completed:** 2026-03-25T06:17:48Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- All 4 persona subcommands work via CLI: generate, list, invoke, analyze
- All 4 persona commands dispatched via MCP data_room tool: generate-personas, list-personas, invoke-persona, analyze-perspectives
- CLI/MCP parity check passes at 44 commands (up from 41, fixing pre-existing gap)
- /mos:persona command docs clearly distinguish from think-hats interactive sessions
- persona-analyst agent enforces mandatory disclaimer on every output with tension map for multi-hat analysis
- Full test suite green: 127 assertions across 7 suites, 0 regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: CLI routing + command docs + agent instructions** - `5cb5e69` (feat)
2. **Task 2: MCP tool router integration + parity check** - `4f5c800` (feat)

## Files Created/Modified

- `bin/mindrian-tools.cjs` - Added persona command group (generate, list, invoke, analyze) + personaOps require
- `commands/persona.md` - /mos:persona command documentation with think-hats distinction, subcommand reference, examples
- `agents/persona-analyst.md` - Larry persona invocation instructions: triggers, behavior rules, anti-patterns, output format
- `lib/mcp/tool-router.cjs` - 4 persona commands in DATA_ROOM_COMMANDS, case handlers, persona in ALL_TOOL_COMMANDS, parity fix

## Decisions Made

- **MCP invoke parameter parsing:** invoke-persona accepts either JSON `{ "hat": "black", "artifact": "path" }` in the section parameter, or a plain hat color string. Gracefully handles both formats.
- **Pre-existing parity gap fixed:** `opportunities` and `funding` CLI commands were missing from ALL_TOOL_COMMANDS (pre-existing from Phase 13). Fixed as Rule 3 auto-fix since it blocked parity check completion.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pre-existing parity gap: opportunities + funding missing from ALL_TOOL_COMMANDS**
- **Found during:** Task 2 (parity check verification)
- **Issue:** Parity check failed with 2 CLI commands (opportunities, funding) missing from MCP ALL_TOOL_COMMANDS. This was pre-existing from Phase 13, not caused by this plan.
- **Fix:** Added 'opportunities' and 'funding' to ALL_TOOL_COMMANDS array in tool-router.cjs
- **Files modified:** lib/mcp/tool-router.cjs
- **Verification:** `node lib/parity/check-parity.cjs` passes: 44 CLI commands = 44 MCP tool commands
- **Committed in:** 4f5c800 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Fix necessary for parity check to pass. No scope creep.

## Issues Encountered

None beyond the auto-fixed deviation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 14 complete: all 4 PERS requirements satisfied
- Persona system fully operational on all surfaces (CLI, MCP/Desktop, Cowork via agents/)
- Ready for v3.0 milestone completion

---
*Phase: 14-ai-team-personas*
*Completed: 2026-03-25*

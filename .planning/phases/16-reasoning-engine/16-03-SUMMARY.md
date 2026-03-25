---
phase: 16-reasoning-engine
plan: 03
subsystem: reasoning
tags: [mcp-resources, mcp-prompts, minto, mece, reasoning-engine, command-docs, schema-reference]

requires:
  - phase: 16-reasoning-engine-01
    provides: "reasoning-ops.cjs core module (getReasoning, listReasoning exports)"
  - phase: 11-mcp-layer
    provides: "registerResources/registerPrompts patterns, ResourceTemplate, buildPromptResponse"
provides:
  - "reasoning://state and reasoning://section/{name} MCP resources"
  - "reason-section MCP prompt with Minto/MECE template injection"
  - "/mos:reason command documentation with all 6 subcommands"
  - "Reasoning frontmatter schema reference for Larry and developers"
affects: [16-lazygraph-integration]

tech-stack:
  added: []
  patterns: [reasoning-uri-scheme, dual-purpose-schema-reference]

key-files:
  created:
    - commands/reason.md
    - references/reasoning/reasoning-schema.md
  modified:
    - lib/mcp/resources.cjs
    - lib/mcp/prompts.cjs

key-decisions:
  - "reason-section prompt inlines system message + user message in single user role (MCP prompt spec only supports user messages)"
  - "Schema reference serves dual purpose: developer documentation AND Larry generation context (same pattern as lazygraph-schema.md)"
  - "Section artifacts truncated at 2000 chars in reason-section prompt to keep token budget manageable"

patterns-established:
  - "reasoning:// URI scheme for MCP Resources (parallels room:// scheme)"
  - "Dual-purpose schema docs: developer reference + AI generation prompt context"

requirements-completed: [REASON-04, REASON-01]

duration: 3min
completed: 2026-03-25
---

# Phase 16 Plan 03: MCP Resources, Prompts & Command Docs Summary

**reasoning:// MCP resources, reason-section prompt with Minto/MECE template, /mos:reason command docs, and frontmatter schema reference completing tri-surface delivery**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-25T13:18:27Z
- **Completed:** 2026-03-25T13:21:37Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- reasoning://state and reasoning://section/{name} MCP resources for Desktop browsing of reasoning artifacts
- reason-section prompt that loads venture context, section artifacts, existing reasoning, and the Minto/MECE template for Larry
- /mos:reason command doc with all 6 subcommands, examples, and tri-surface delivery matrix
- Frontmatter schema reference documenting all fields, LazyGraph edge types, and programmatic access

## Task Commits

Each task was committed atomically:

1. **Task 1: MCP resources and prompt for reasoning** - `d4ab2c2` (feat)
2. **Task 2: Command documentation and schema reference** - `e9dda26` (feat)

## Files Created/Modified
- `lib/mcp/resources.cjs` - Added reasoning-state and reasoning-section resources (reasoning:// URI scheme)
- `lib/mcp/prompts.cjs` - Added reason-section prompt with section context and Minto/MECE template
- `commands/reason.md` - /mos:reason command documentation with 6 subcommands and examples
- `references/reasoning/reasoning-schema.md` - Frontmatter schema reference for Larry and developers

## Decisions Made
- reason-section prompt uses single user-role message (system message content + user content combined) since MCP prompt spec delivers to user role
- Section artifacts truncated at 2000 chars in the prompt to prevent token budget blowout on large sections
- Schema reference follows lazygraph-schema.md pattern: dual-purpose doc for both developers and Larry's Cypher/frontmatter generation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Phase 16 plans complete (01: core ops, 02: CLI/MCP wiring, 03: resources/prompts/docs)
- Tri-surface delivery verified: CLI (/mos:reason), Desktop (MCP tools + resources + prompts), Cowork (shared .reasoning/)
- 9/9 tests passing in test suite

---
*Phase: 16-reasoning-engine*
*Completed: 2026-03-25*

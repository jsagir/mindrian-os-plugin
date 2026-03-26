---
phase: 21-cli-ui-ruling-system
plan: 02
subsystem: ui
tags: [cli, terminal-ux, body-shapes, mondrian-board, semantic-tree, room-card, tldr-help, 4-zone-anatomy]

requires:
  - phase: 21-cli-ui-ruling-system/01
    provides: skills/ui-system/SKILL.md ruling system with 4-zone anatomy, 5 body shapes, 12 glyphs
provides:
  - commands/status.md retrofitted to Body Shape A (Mondrian Board)
  - commands/room.md retrofitted to Body Shape B (Semantic Tree) + C (Room Card)
  - commands/help.md retrofitted to tldr-style grouped flow format
affects: [all-commands, ui-consistency, larry-personality]

tech-stack:
  added: []
  patterns: [4-zone-output-anatomy, body-shape-declaration-in-frontmatter, 3-line-error-format, dual-context-reading]

key-files:
  created: []
  modified:
    - commands/status.md
    - commands/room.md
    - commands/help.md

key-decisions:
  - "Commands declare body shape in YAML frontmatter (body_shape, ui_reference fields)"
  - "Room command uses two shapes: Shape B for overview, Shape C for section detail"
  - "Help groups commands by flow (Getting Started, Working, Reviewing, Brain, Admin) not venture stage"
  - "Per-command help is zoneless inline format (1 line + 3 examples)"

patterns-established:
  - "body_shape frontmatter: every command declares its shape in YAML frontmatter"
  - "ui_reference frontmatter: every command references skills/ui-system/SKILL.md"
  - "dual-shape commands: commands with subcommands can declare different shapes per subcommand"
  - "3-line error format: all error cases use ✗/Why/Fix pattern"

requirements-completed: [UI-02, UI-03]

duration: 23min
completed: 2026-03-26
---

# Phase 21 Plan 02: Command Retrofit Summary

**Retrofitted status, room, and help commands to follow 4-zone anatomy with declared body shapes (Mondrian Board, Semantic Tree, Room Card, tldr-help)**

## Performance

- **Duration:** 23 min
- **Started:** 2026-03-26T10:49:56Z
- **Completed:** 2026-03-26T11:13:14Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- /mos:status now renders as Mondrian Board (Shape A) with progress bars per section, MINTO health Reasoning column, and dual context reading
- /mos:room overview uses Semantic Tree (Shape B) with expand/collapse symbols; /mos:room [section] uses Room Card (Shape C) with graph relationships and governing thought
- /mos:help uses tldr-style grouped flow format with per-command inline help (1 line + 3 examples)
- All three commands follow strict 4-zone anatomy with Zone 4 action footer never omitted
- All error cases use 3-line format (per D-24)
- Banned phrases referenced per D-23

## Task Commits

Each task was committed atomically:

1. **Task 1: Retrofit commands/status.md to Body Shape A (Mondrian Board)** - `919cdb2` (feat)
2. **Task 2: Retrofit commands/room.md and commands/help.md** - `a78e704` (feat)

## Files Created/Modified
- `commands/status.md` - Retrofitted to Body Shape A (Mondrian Board) with 4-zone anatomy, progress bars, MINTO health column
- `commands/room.md` - Retrofitted to Body Shape B (Semantic Tree) for overview, Shape C (Room Card) for section detail
- `commands/help.md` - Retrofitted to tldr-style grouped flow format with per-command inline help

## Decisions Made
- Commands declare body shape in YAML frontmatter (`body_shape`, `ui_reference` fields) for machine readability
- Room command uses two shapes: `body_shape_overview: B (Semantic Tree)` and `body_shape_section: C (Room Card)`
- Help groups commands by flow (Getting Started, Working, Reviewing, Brain + Intelligence, Export + Admin) rather than venture stage
- Per-command help (`/mos:help [cmd]`) renders as zoneless inline format -- no header panel, no footer, just the tldr card
- Integration status in /mos:status compressed to single compact line instead of full table

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all commands are fully wired to their body shapes and reference the UI ruling system.

## Next Phase Readiness
- All three core display commands follow the ruling system
- Pattern established for retrofitting remaining commands (body_shape in frontmatter, ui_reference, 4-zone anatomy)
- Other commands (/mos:diagnose, /mos:grade, methodology commands) can follow the same retrofit pattern

## Self-Check: PASSED

---
*Phase: 21-cli-ui-ruling-system*
*Completed: 2026-03-26*

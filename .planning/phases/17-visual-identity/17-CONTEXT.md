# Phase 17: Visual Identity — De Stijl CLI - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning
**Source:** Discussion with Jonathan + two research reports (CLI-VISUAL-IDENTITY.md, GRAPHICAL-CLI-CAPABILITIES.md)

<domain>
## Phase Boundary

Phase 17 makes MindrianOS visually distinctive in the CLI. Every output should feel like MindrianOS — not generic AI. De Stijl design principles (sharp geometry, primary colors, grid structure) adapted for terminal.

Three rendering tiers:
1. Unicode/markdown (works in Claude Code text output — universal)
2. ANSI colors (works in statusline + Bash output)
3. Browser (Mermaid diagrams, rich HTML opened from CLI)

</domain>

<decisions>
## Implementation Decisions

### Symbol System (locked)
- ⬡ = MindrianOS brand (hexagon)
- Venture stages: ◌ Pre-Opportunity, ◎ Discovery, ◉ Validation, ◆ Design, ★ Investment Ready
- Edge types: → INFORMS, ⊗ CONTRADICTS, ⊕ CONVERGES, ▶ ENABLES, ⊘ INVALIDATES
- Larry modes: ? Investigative, ⇌ Blend, ! Insight
- Section health: ■ populated, □ empty/gap, ▪ partial
- All symbols stored in references/visual/symbol-system.md as single source of truth

### Room Structure Diagram (Unicode box)
```
┌─problem-definition──┐  ┌─market-analysis──────┐
│ ■ 3 artifacts        │→│ ■ 5 artifacts         │
│ ◎ Discovery          │  │ ⊗ 1 contradiction     │
└──────────────────────┘  └───────────────────────┘
         ↓ INFORMS                  ↓ ENABLES
┌─solution-design──────┐  ┌─competitive-analysis─┐
│ □ EMPTY — GAP        │  │ ■ 2 artifacts         │
│                      │  │ ⊕ converges with 3    │
└──────────────────────┘  └───────────────────────┘
```

### ASCII Charts (asciichart npm)
- Section completeness sparkline in compute-state output
- Meeting frequency over time in analyze-room
- Venture progress as a simple bar with stage markers

### Mermaid in Artifacts
- Room REASONING.md files get Mermaid dependency graphs
- Meeting summaries get sequence diagrams (speaker flow)
- Framework chains get flowchart diagrams
- These render automatically in GitHub/Obsidian — zero extra tooling

### /mos:visualize Command
- Generates HTML with Mermaid.js and opens in default browser
- Sub-commands: room (flowchart), graph (knowledge graph), chain (framework), timeline (meetings)
- Reuses serve-dashboard pattern (temporary localhost)
- Falls back to ASCII if browser unavailable

### npm Dependencies
- asciichart (zero deps, sparklines + line charts)
- beautiful-mermaid (optional, ASCII Mermaid in terminal)
- No heavy dependencies. LaTeX skipped (audience mismatch).

### Statusline Enhanced
- Current: ⬡ Project │ section │ stage │ gaps │ context%
- Enhanced: uses color-coded stage symbol, colored gap count, De Stijl accent colors

### De Stijl ANSI Color Palette (for statusline + Bash)
- Mondrian Blue: \x1b[38;5;33m (#2160c4)
- Mondrian Red: \x1b[38;5;196m (#c12b1a)
- Mondrian Yellow: \x1b[38;5;220m (#f0c832)
- Cream text: \x1b[38;5;230m
- Muted: \x1b[38;5;245m

### Claude's Discretion
- Exact box diagram layout algorithm (fixed width vs adaptive)
- Mermaid diagram styling (theme, direction)
- Chart scale and label formatting
- Which room artifacts get embedded Mermaid vs plain markdown

</decisions>

<deferred>
## Deferred Ideas

- Sixel/Kitty inline image protocol (Claude Code doesn't support)
- blessed/ink interactive TUI dashboards (too heavy)
- LaTeX rendering (audience mismatch)
- Real-time terminal animations
- Figlet/ASCII art logo on session start

</deferred>

---

*Phase: 17-visual-identity*
*Context gathered: 2026-03-26 via research synthesis*

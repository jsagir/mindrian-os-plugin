# MindrianOS Symbol System Reference

> Single source of truth for all visual symbols used across CLI, Desktop, and Cowork surfaces.
> Import from: `lib/core/visual-ops.cjs`

---

## Brand

| Symbol | Unicode | Name | Usage |
|--------|---------|------|-------|
| ⬡ | U+2B21 | Hexagon | MindrianOS brand mark. Prefix for project name in statusline. |

---

## Venture Stages

The five stages of the Innovation Certainty Model (ICM). Each stage has a symbol reflecting increasing solidity — from open circle to filled star.

| Symbol | Unicode | Stage | Description |
|--------|---------|-------|-------------|
| ◌ | U+25CC | Pre-Opportunity | Dotted circle — idea is forming, nothing solid yet |
| ◎ | U+25CE | Discovery | Bullseye — actively exploring, finding signal |
| ◉ | U+25C9 | Validation | Fisheye — testing assumptions, narrowing focus |
| ◆ | U+25C6 | Design | Filled diamond — shaping the solution |
| ★ | U+2605 | Investment Ready | Filled star — venture is ready for commitment |

**Usage:** `stageSymbol('discovery')` returns `◎`

Accepted inputs: kebab-case (`pre-opportunity`), camelCase (`preOpportunity`), lowercase (`discovery`).

---

## Edge Types (Cross-Relationships)

Edges represent structural relationships between room sections. Each edge type has a semantic color from the De Stijl palette.

| Symbol | Unicode | Edge Type | Color | Meaning |
|--------|---------|-----------|-------|---------|
| → | U+2192 | INFORMS | Blue (#1E3A6E) | This section provides input to another |
| ⊗ | U+2297 | CONTRADICTS | Red (#A63D2F) | This section conflicts with another |
| ⊕ | U+2295 | CONVERGES | Yellow (#C8A43C) | Themes appear across 3+ sections |
| ▶ | U+25B6 | ENABLES | Green (#2D6B4A) | This section unblocks another |
| ⊘ | U+2298 | INVALIDATES | Sienna (#B5602A) | This section makes another stale |

**Usage:** `edgeSymbol('INFORMS')` returns `→`

**Formatted:** `formatEdge('problem-definition', 'market-analysis', 'INFORMS')`
produces: `problem-definition →INFORMS→ market-analysis` (with blue coloring in terminal)

---

## Larry Modes

The three conversation modes that shape Larry's behavior.

| Symbol | Unicode | Mode | Description |
|--------|---------|------|-------------|
| ? | ASCII | Investigative | Asking questions, probing assumptions |
| ⇌ | U+21CC | Blend | Balanced mix of questioning and insight |
| ! | ASCII | Insight | Delivering synthesized understanding |

---

## Section Health

Health symbols indicate the state of a room section's content.

| Symbol | Unicode | State | Condition |
|--------|---------|-------|-----------|
| ■ | U+25A0 | Populated | Section has 1+ artifacts |
| □ | U+25A1 | Empty | Section has 0 artifacts (gap) |
| ▪ | U+25AA | Partial | Explicitly flagged as incomplete |

**Usage:** `healthSymbol(3)` returns `■`, `healthSymbol(0)` returns `□`

**Formatted:** `formatSectionHeader('problem-definition', 3, 'discovery')`
produces: `◎ problem-definition ■ 3 artifacts`

---

## Box Drawing Characters

Used for room structure diagrams (Unicode box art).

| Symbol | Unicode | Name | Position |
|--------|---------|------|----------|
| ┌ | U+250C | Top-left | Corner |
| ┐ | U+2510 | Top-right | Corner |
| └ | U+2514 | Bottom-left | Corner |
| ┘ | U+2518 | Bottom-right | Corner |
| ─ | U+2500 | Horizontal | Edge |
| │ | U+2502 | Vertical | Edge |
| ├ | U+251C | Left-tee | Junction |
| ┤ | U+2524 | Right-tee | Junction |
| ┬ | U+252C | Top-tee | Junction |
| ┴ | U+2534 | Bottom-tee | Junction |
| ┼ | U+253C | Cross | Junction |

**Example — Room Structure Diagram:**
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

---

## De Stijl ANSI Color Palette

24-bit true color codes for terminal output (statusline, Bash scripts).

| Name | Hex | ANSI Code | Usage |
|------|-----|-----------|-------|
| Red | #A63D2F | `\x1b[38;2;166;61;47m` | CONTRADICTS edges, error states |
| Blue | #1E3A6E | `\x1b[38;2;30;58;110m` | INFORMS edges, informational |
| Yellow | #C8A43C | `\x1b[38;2;200;164;60m` | CONVERGES edges, warnings |
| Green | #2D6B4A | `\x1b[38;2;45;107;74m` | ENABLES edges, healthy state |
| Sienna | #B5602A | `\x1b[38;2;181;96;42m` | INVALIDATES edges, alerts |
| Amethyst | #6B4E8B | `\x1b[38;2;107;78;139m` | Persona/mode indicators |
| Teal | #2A6B5E | `\x1b[38;2;42;107;94m` | Brand accent |
| Cream | #F5F0E8 | `\x1b[38;2;245;240;232m` | Primary text |
| Muted | #A09A90 | `\x1b[38;2;160;154;144m` | Secondary text, separators |

16-color fallbacks available via `ANSI_BASIC` for terminals without true color support.

---

## Statusline Format

```
⬡ ProjectName │ ◎ Discovery │ ■ 5 sections │ □ 2 gaps │ ████░░ 40%
```

Components:
- `⬡` brand mark in teal
- Stage symbol + name in stage-appropriate color
- Section count with health symbol
- Gap count (red if > 0, green if 0)
- Context window usage bar with threshold colors

---

*Reference: .planning/phases/17-visual-identity/17-CONTEXT.md*
*Module: lib/core/visual-ops.cjs*

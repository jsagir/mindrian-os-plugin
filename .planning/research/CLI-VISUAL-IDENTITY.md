# CLI Visual Identity Research: MindrianOS

**Domain:** CLI information visualization for innovation thinking partner
**Researched:** 2026-03-26
**Overall confidence:** HIGH

---

## Table of Contents

1. [Rendering Contexts -- What Works Where](#1-rendering-contexts)
2. [De Stijl Color Palette to Terminal Mapping](#2-de-stijl-color-mapping)
3. [Unicode Character Reference](#3-unicode-character-reference)
4. [Symbol System -- MindrianOS Iconography](#4-symbol-system)
5. [Diagram Patterns for MindrianOS](#5-diagram-patterns)
6. [Statusline Design](#6-statusline-design)
7. [Thinking Trace Visual System](#7-thinking-trace-visual-system)
8. [How Premium CLIs Create Visual Identity](#8-premium-cli-patterns)
9. [Cross-Platform Compatibility](#9-cross-platform-compatibility)
10. [Anti-Patterns to Avoid](#10-anti-patterns)
11. [Implementation Reference](#11-implementation-reference)

---

## 1. Rendering Contexts -- What Works Where

MindrianOS content appears in THREE rendering contexts with DIFFERENT capabilities.

### Context A: Statusline (context-monitor script)

**Capabilities:** Full ANSI escape codes, 256-color, 24-bit color, Unicode, blinking text.
**Already proven:** The existing context-monitor uses `\x1b[1;36m` (bold cyan), `\x1b[35m` (magenta), `\x1b[33m` (yellow), `\x1b[32m`/`\x1b[31m` (green/red for context bar), and block characters for the usage bar.
**Constraint:** Single line. Must be concise. No multi-line output.

### Context B: Bash Tool Output (scripts, hooks)

**Capabilities:** Full ANSI escape codes work. Color, bold, underline, dim, inverse all render.
**Use for:** Diagrams, colored graph output, room structure visualization via scripts.
**Constraint:** User sees raw terminal output. Must handle terminal width.

### Context C: Claude's Direct Text Responses (the main conversation)

**Capabilities -- CONFIRMED WORKING:**
- Bold (`**text**`)
- Italic (`*text*`)
- Bold-italic (`***text***`)
- Code spans (`` `code` ``)
- Fenced code blocks with syntax highlighting
- Diff blocks (```diff)
- Tables (standard markdown)
- Bulleted and numbered lists
- Single-level blockquotes (`> text`)
- Unicode characters (all of them -- box drawing, block elements, symbols)

**CONFIRMED BROKEN (do NOT use):**
- ~~Strikethrough~~ -- renders as literal tildes
- Headers h2-h6 -- ALL render as identical bold text, no visual hierarchy
- Nested blockquotes (`> > >`) -- nesting levels look identical
- Task lists (`- [x]`) -- render as plain bullets, state lost
- HTML entities (`&amp;`) -- render as raw text
- Link labels -- raw URL shown, label discarded
- ANSI escape codes -- NOT rendered, appear as garbage text

**Source:** [GitHub Issue #26390](https://github.com/anthropics/claude-code/issues/26390) -- confirmed ~40% of GFM features broken.

### The Rule

| Element | Statusline | Bash Output | Text Response |
|---------|-----------|-------------|---------------|
| ANSI colors | YES | YES | NO |
| Bold/italic | N/A | N/A | YES |
| Unicode symbols | YES | YES | YES |
| Box drawing chars | YES | YES | YES |
| Block elements | YES | YES | YES |
| Tables | N/A | N/A | YES |
| Code blocks | N/A | N/A | YES |
| Blockquotes (1 level) | N/A | N/A | YES |
| Emoji | USE SPARINGLY | YES | YES (but width varies) |

**Design principle:** Use Unicode characters as the universal visual layer. They work EVERYWHERE. Add ANSI color only in statusline and Bash output. Use markdown formatting only in text responses.

---

## 2. De Stijl Color Mapping

### Dashboard Palette (from index.html CSS variables)

```
--ds-bg:        #0D0D0D    (near-black background)
--ds-surface:   #1A1A1A    (panel background)
--ds-elevated:  #2A2A2A    (raised surfaces)
--ds-cream:     #F5F0E8    (primary text)
--ds-muted:     #A09A90    (secondary text)
--ds-border:    #2A2A2A    (dividers)
--ds-red:       #A63D2F    (Mondrian red)
--ds-blue:      #1E3A6E    (Mondrian blue)
--ds-yellow:    #C8A43C    (Mondrian gold)
--ds-green:     #2D6B4A    (growth/convergence)
--ds-sienna:    #B5602A    (warmth/alerts)
--ds-gray:      #5C5A56    (neutral)
--ds-amethyst:  #6B4E8B    (creative/synthesis)
--ds-teal:      #2A6B5E    (connection/flow)
```

### Terminal ANSI Mapping

Map the De Stijl palette to ANSI codes that approximate the mood, since exact hex matching is impossible in basic ANSI (but possible in 256-color/24-bit for statusline).

**Basic ANSI (16-color, text responses via Bash scripts):**

| De Stijl Color | Meaning | ANSI Code | Escape |
|---------------|---------|-----------|--------|
| Red (#A63D2F) | CONTRADICTS, warning, tension | Red (31) | `\x1b[31m` |
| Blue (#1E3A6E) | INFORMS, structure, depth | Blue (34) | `\x1b[34m` |
| Yellow (#C8A43C) | CONVERGES, gold, insight | Yellow (33) | `\x1b[33m` |
| Green (#2D6B4A) | ENABLES, growth, progress | Green (32) | `\x1b[32m` |
| Sienna (#B5602A) | INVALIDATES, alert, change | 208 (256-color) | `\x1b[38;5;208m` |
| Cream (#F5F0E8) | Primary text | White (37) | `\x1b[37m` |
| Muted (#A09A90) | Secondary, dim | Dim white | `\x1b[2m` |
| Gray (#5C5A56) | Neutral, structure | Dark gray (90) | `\x1b[90m` |
| Amethyst (#6B4E8B) | Synthesis, creative | Magenta (35) | `\x1b[35m` |
| Cyan/Teal (#2A6B5E) | Brand, MindrianOS | Cyan (36) | `\x1b[36m` |

**256-color (statusline only, for precision):**

| De Stijl Color | 256-Color Code | Escape |
|---------------|----------------|--------|
| #A63D2F (red) | 124 | `\x1b[38;5;124m` |
| #1E3A6E (blue) | 24 | `\x1b[38;5;24m` |
| #C8A43C (yellow) | 178 | `\x1b[38;5;178m` |
| #2D6B4A (green) | 29 | `\x1b[38;5;29m` |
| #B5602A (sienna) | 166 | `\x1b[38;5;166m` |
| #6B4E8B (amethyst) | 97 | `\x1b[38;5;97m` |
| #F5F0E8 (cream) | 255 | `\x1b[38;5;255m` |
| #A09A90 (muted) | 247 | `\x1b[38;5;247m` |

**24-bit true color (statusline, Bash -- for exact De Stijl):**

```
\x1b[38;2;166;61;47m     # exact ds-red
\x1b[38;2;30;58;110m     # exact ds-blue
\x1b[38;2;200;164;60m    # exact ds-yellow
\x1b[38;2;45;107;74m     # exact ds-green
\x1b[38;2;181;96;42m     # exact ds-sienna
\x1b[38;2;107;78;139m    # exact ds-amethyst
\x1b[38;2;245;240;232m   # exact ds-cream
```

### Semantic Color System

Colors in MindrianOS are NEVER decorative. Every color carries meaning:

| Color | Meaning | When Used |
|-------|---------|-----------|
| **Red** | Contradiction, tension, conflict | CONTRADICTS edges, conflicting claims, assumption violations |
| **Blue** | Information flow, depth, structure | INFORMS edges, references, structural relationships |
| **Yellow/Gold** | Convergence, insight, earned knowledge | CONVERGES edges, insight moments, gold-standard content |
| **Green** | Progress, growth, enablement | ENABLES edges, stage advancement, healthy sections |
| **Sienna/Orange** | Invalidation, staleness, attention needed | INVALIDATES edges, stale assumptions, needs revision |
| **Cyan** | MindrianOS brand, system messages | Brand mark, system-level output |
| **Magenta/Amethyst** | Synthesis, creative connections | Cross-domain connections, framework chaining |
| **Dim/Gray** | Context, secondary info, structure | Borders, separators, metadata |

---

## 3. Unicode Character Reference

### Box Drawing -- Cross-Platform Safe

All characters in U+2500-257F render correctly on Windows Terminal, macOS Terminal, iTerm2, and WSL2.

**Light (for content borders, secondary structure):**
```
┌──────────────────┐
│  Light box        │
├──────────────────┤
│  With divider     │
└──────────────────┘
```
Characters: `─ │ ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼`

**Heavy (for primary structure, emphasis):**
```
┏━━━━━━━━━━━━━━━━━━┓
┃  Heavy box        ┃
┣━━━━━━━━━━━━━━━━━━┫
┃  With divider     ┃
┗━━━━━━━━━━━━━━━━━━┛
```
Characters: `━ ┃ ┏ ┓ ┗ ┛ ┣ ┫ ┳ ┻ ╋`

**Double (for emphasis, GSD-style checkpoints):**
```
╔══════════════════╗
║  Double box      ║
╠══════════════════╣
║  With divider    ║
╚══════════════════╝
```
Characters: `═ ║ ╔ ╗ ╚ ╝ ╠ ╣ ╦ ╩ ╬`

**Rounded (AVOID -- inconsistent rendering across terminals):**
Characters: `╭ ╮ ╯ ╰` -- These can look broken on some fonts. Since De Stijl is sharp-cornered anyway, avoid these.

### Block Elements -- For Progress Bars and Gauges

```
Full blocks:    ░ ▒ ▓ █
Sparkline set:  ▁ ▂ ▃ ▄ ▅ ▆ ▇ █
Upper half:     ▀
Lower half:     ▄
```

**Progress bar styles:**
```
Standard:    ████████░░░░ 67%
Fine-grain:  ▓▓▓▓▓▓▓▓░░░░ 67%
Sparkline:   ▁▂▃▅▇█▇▅▃▂▁  (for trends)
```

### Arrows and Connectors

```
Arrows:     → ← ↑ ↓ ↔ ↕ ⟶ ⟵ ⟷
Fat arrows: ► ◄ ▲ ▼
Triangles:  ▸ ◂ ▴ ▾ (small)
Pointers:   ➤ ❯ ❮ ⊳ ⊲
```

### Geometric Shapes

```
Circles:   ● ○ ◉ ◌ ◍ ◎ ⬤
Squares:   ■ □ ◼ ◻ ▪ ▫ ⬛ ⬜
Diamonds:  ◆ ◇ ◈ ♦
Triangles: ▲ △ ▶ ▷ ▼ ▽ ◀ ◁
Hexagons:  ⬡ ⬢ (THE MindrianOS brand mark)
Stars:     ★ ☆
```

---

## 4. Symbol System -- MindrianOS Iconography

### Brand Mark

```
⬡  MindrianOS hexagon (U+2B21)
```
Already used in the statusline (`\x1b[1;36m\u2B21`). This is the brand. Use it consistently.

### Edge Type Symbols

Each of the 5 knowledge graph edge types gets a dedicated symbol + color:

| Edge Type | Symbol | Unicode | Color | Visual Meaning |
|-----------|--------|---------|-------|----------------|
| INFORMS | `→` | U+2192 | Blue | One-directional flow |
| CONTRADICTS | `⊗` | U+2297 | Red | Crossed circle = conflict |
| CONVERGES | `⊕` | U+2295 | Yellow | Circle with plus = combining |
| ENABLES | `▶` | U+25B6 | Green | Play/forward = unblocking |
| INVALIDATES | `⊘` | U+2298 | Sienna | Circle with slash = negation |

**In text responses (no color), use the symbol alone:**
```
→ market-analysis INFORMS financial-model
⊗ team-execution CONTRADICTS financial-model
⊕ problem-definition CONVERGES market-analysis
▶ solution-design ENABLES business-model
⊘ competitive-analysis INVALIDATES business-model
```

**In Bash/statusline (with color), prefix with ANSI:**
```
\x1b[34m→\x1b[0m INFORMS
\x1b[31m⊗\x1b[0m CONTRADICTS
\x1b[33m⊕\x1b[0m CONVERGES
\x1b[32m▶\x1b[0m ENABLES
\x1b[38;5;208m⊘\x1b[0m INVALIDATES
```

### Venture Stage Symbols

Each stage gets a symbol that represents its character:

| Stage | Symbol | Unicode | Meaning |
|-------|--------|---------|---------|
| Pre-Opportunity | `◌` | U+25CC | Dotted circle = forming, not yet solid |
| Discovery | `◎` | U+25CE | Bullseye = targeting, finding |
| Validation | `◉` | U+25C9 | Fisheye = focusing, testing |
| Design | `◆` | U+25C6 | Solid diamond = crystallizing |
| Investment | `★` | U+2605 | Star = ready to shine |

**Venture progress bar:**
```
◌ ─── ◎ ─── ◉ ─── ◆ ─── ★
Pre   Disc  Valid Design Invest

Current stage highlighted:
◌ ━━━ ◎ ━━━ ◉ ─── ◆ ─── ★
                ^
            Validation
```

### Larry Mode Symbols

| Mode | Symbol | Unicode | Meaning |
|------|--------|---------|---------|
| Investigative (Ask) | `?` | U+003F | Question = Socratic mode |
| Blend | `⇌` | U+21CC | Reversible arrows = balance |
| Insight (Tell) | `!` | U+0021 | Exclamation = delivering insight |

**Dial visualization:**
```
Ask ├────────┼────────┤ Tell
    ?        ⇌        !
         ▲
       [0.55]
```

### Room Section Symbols

| Section | Symbol | Reasoning |
|---------|--------|-----------|
| problem-definition | `◇` | Open diamond = defining the shape |
| market-analysis | `◫` | Half-filled square = data gathering |
| solution-design | `◈` | Diamond with dot = designing within constraints |
| business-model | `▣` | Gridded square = structured model |
| competitive-analysis | `◪` | Diagonal square = comparison |
| team-execution | `◉` | Bullseye = people-focused |
| legal-ip | `▧` | Hatched = protected/guarded |
| financial-model | `▤` | Horizontal lines = ledger |
| meetings | `◆` | Solid diamond = gold (already in dashboard) |
| assumptions | `△` | Triangle = hypothesis (points up = unproven) |

### Status Symbols (consistent with GSD)

```
Done/valid:      ✓
Failed/invalid:  ✗
In progress:     ◆
Pending:         ○
Warning:         ⚠
Brain connected: ◈
Brain offline:   ◇
```

---

## 5. Diagram Patterns for MindrianOS

### Pattern 1: Room Structure Overview

Shows all sections, their health, and gaps. Used by `/mos:room status`.

**In code block (text response):**
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  ⬡ ROOM: Venture Name                       ┃
┃  Stage: ◉ Validation  │  8 sections  │ 2 gaps ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                               ┃
┃  ◇ problem-definition    ███░  3 artifacts    ┃
┃  ◫ market-analysis       ████  5 artifacts    ┃
┃  ◈ solution-design       ██░░  2 artifacts    ┃
┃  ▣ business-model        ░░░░  EMPTY (gap)    ┃
┃  ◪ competitive-analysis  █░░░  1 artifact     ┃
┃  ◉ team-execution        ██░░  2 artifacts    ┃
┃  ▧ legal-ip              ░░░░  EMPTY (gap)    ┃
┃  ▤ financial-model       █░░░  1 artifact     ┃
┃                                               ┃
┃  ◆ 3 meetings filed  │  △ 7 assumptions      ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

### Pattern 2: Mini Knowledge Graph (Recent Edges)

Shows the last 3-5 edges discovered. Used after filing or cross-reference scan.

**In code block (text response):**
```
Recent Connections
──────────────────────────────────────────

  problem-definition ─→─ market-analysis
                     INFORMS

  team-execution ─⊗─ financial-model
               CONTRADICTS
  "Hiring timeline conflicts with runway"

  market-analysis ─⊕─ solution-design
               ─⊕─ competitive-analysis
              CONVERGES (3 sections)
  "Market timing theme across 3 sections"

──────────────────────────────────────────
  5 edges total  │  1 contradiction  │  1 convergence
```

### Pattern 3: Edge Discovery Notification

When a cross-reference is found after filing:

```
> **2 connections discovered**
>
> → problem-definition INFORMS market-analysis
> ⊗ team-execution CONTRADICTS financial-model
>   *"Hiring plan assumes Q3 revenue that financial model doesn't project"*
>
> Review? `/mos:edge review` or APPROVE / REJECT / DEFER
```

### Pattern 4: Venture Progress Bar

Used in room status and session greeting:

```
Venture Progress
◌ ━━━ ◎ ━━━ ◉ ─── ◆ ─── ★
Pre   Disc  Valid Design Invest
            ▲

Sections: ████████░░ 75% covered
Claims:   14 active  │  2 contradicted  │  7 assumptions
```

### Pattern 5: Framework Chain Visualization

When Larry shows a methodology chain:

```
> **Larry's Thinking**
> Problem -- wicked (8/10 characteristics)
> Chain -- De Bono Six Hats → Minto Pyramid → Business Model Canvas
>
>   ┌─────────┐    ┌──────────┐    ┌───────────┐
>   │ Six Hats │ →  │  Minto   │ →  │    BMC    │
>   │ explore  │    │ structure│    │  validate │
>   └─────────┘    └──────────┘    └───────────┘
>
> Filing -- problem-definition/ → solution-design/ → business-model/
```

### Pattern 6: Meeting Timeline

Chronological view of meetings filed:

```
Meetings
─────────────────────────────────────

  ◆ 2026-03-12  Investor Call (3 segments)
  │   → 2 INFORMS, 1 CONTRADICTS
  │
  ◆ 2026-03-18  Team Standup (5 segments)
  │   → 3 INFORMS, 1 CONVERGES
  │
  ◆ 2026-03-24  Advisory Board (4 segments)
      → 1 INFORMS, 2 ENABLES, 1 INVALIDATES

─────────────────────────────────────
  12 segments  │  3 meetings  │  10 edges
```

### Pattern 7: Six Thinking Hats Visualization

For the Bono Six Hats methodology session:

```
Six Thinking Hats -- Round 3 of 6

  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐
  │ W │ │ R │ │ B │ │ Y │ │ G │ │ B │
  │ ✓ │ │ ✓ │ │ ◆ │ │ ○ │ │ ○ │ │ ○ │
  └───┘ └───┘ └───┘ └───┘ └───┘ └───┘
  White  Red   Black  Yel   Green Blue
  facts  feel  risk   value creat proc

  Currently: Black Hat (risk/caution)
```

### Pattern 8: Assumption Validity Gauge

```
Assumption Health
─────────────────────────────────────

  ✓ Valid (5)       █████████████░░░  71%
  ? Untested (3)    ████░░░░░░░░░░░░  21%
  ⊗ Contradicted (1) █░░░░░░░░░░░░░░░   7%

  Stalest: "Series A at 40x ARR" (42 days, no test)
```

### Pattern 9: Sparkline for Section Activity

```
Section Activity (last 30 days)
─────────────────────────────────────

  problem-definition  ▃▅▇▅▃▁▁▁▃▂  (front-loaded)
  market-analysis     ▁▂▃▃▅▅▇▇▅▃  (growing)
  solution-design     ▁▁▁▂▃▃▅▇▇█  (accelerating)
  financial-model     ▁▁▁▁▁▁▁▁▁▁  (dormant)
```

---

## 6. Statusline Design

### Current Statusline (context-monitor)

```
⬡ ProjectName │ current-section │ Stage │ 8§ │ 2gaps │ Claude │ ████████░░ 67%
```

Already uses:
- `⬡` hexagon brand in bold cyan
- Section name in dim
- Stage in magenta
- Section count with `§` symbol
- Gap count in yellow
- Context bar with block characters and color-coded percentage

### Recommended Enhancement

Add Larry mode and edge count to the existing format:

```
⬡ VentureName │ market-analysis │ ◉ Valid │ 8§ 2gaps │ ?Ask │ 14 edges │ ████░░ 42%
```

New elements:
- Stage with stage symbol (`◉`) instead of text
- Larry mode indicator (`?Ask` / `⇌Blend` / `!Tell`)
- Edge count showing graph density

**Implementation note:** The context-monitor already reads STATE.md. Extend it to read edge count from the graph and Larry's current mode from session state.

---

## 7. Thinking Trace Visual System

### Already Established (from SKILL.md)

The thinking trace uses blockquotes, which are confirmed working in Claude Code:

```
> **Larry's Thinking**
> Problem -- wicked (8/10)
> Stage -- Validation
> Method -- Minto Pyramid *structured argument*
> Chain -- Minto → BMC → Financial Model
> Filing -- solution-design/
> *3 Brain connections . 2 cross-references*
```

### Enhancement: Add Symbols

```
> **Larry's Thinking**
> ◉ Stage -- Validation
> ◇ Problem -- wicked (8/10 characteristics)
> ⇌ Mode -- Blend (0.55)
> Method -- Minto Pyramid *structured argument*
> Chain -- Minto → BMC → Financial Model
> Filing -- solution-design/
> *◈ 3 Brain connections . 2 cross-references*
```

### Visual Confirmation With Edge Symbols

```
> **Done**
> Filed to problem-definition/ -- "Market entry barriers in MENA"
> → INFORMS market-analysis
> ⊗ CONTRADICTS financial-model
>   *"New barrier data conflicts with projected market entry cost"*
> ◉ Room stage unchanged -- Validation
```

### Starting a Methodology Session

```
> **Starting** De Bono Six Thinking Hats
> This will explore your problem from 6 perspectives
> Output files to -- problem-definition/
> Estimated -- 6 rounds, ~10 minutes
>
> ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐
> │ W │ │ R │ │ B │ │ Y │ │ G │ │ B │
> └───┘ └───┘ └───┘ └───┘ └───┘ └───┘
```

---

## 8. How Premium CLIs Create Visual Identity

### Lessons from GSD (Get Shit Done)

GSD uses a consistent visual system documented in `references/ui-brand.md`:

| Element | GSD Pattern | MindrianOS Equivalent |
|---------|------------|----------------------|
| Stage banners | `━━━ GSD > STAGE NAME ━━━` | `━━━ ⬡ MOS > ROOM STATUS ━━━` |
| Checkpoint boxes | Double-line `╔══╗` | Same pattern for edge review prompts |
| Status symbols | `✓ ✗ ◆ ○ ⚡ ⚠` | Same set + edge symbols |
| Progress bars | `████████░░ 80%` | Same for section coverage |
| Spawning indicators | `◆ Spawning...` | `◆ Scanning for connections...` |
| Next Up blocks | `▶ Next Up` with separator | Same for suggested next action |

**Key GSD principles to adopt:**
1. Consistent banner width (62 characters in GSD)
2. `PREFIX >` in all banners (GSD uses `GSD >`, MindrianOS should use `⬡ MOS >`)
3. Double-line boxes for user action required
4. Standard status symbols across all output
5. Always end major operations with "Next Up" suggestion

### What Makes a CLI Feel Premium

Based on analysis of Vercel CLI, Railway CLI, and Stripe CLI patterns:

1. **Consistent prefix/brand mark** -- Every output starts with a recognizable mark. Vercel uses `>`, Stripe uses `>`. MindrianOS uses `⬡`.
2. **Semantic color** -- Colors mean things. Green = success. Red = error. Yellow = warning. Never random color for decoration.
3. **Progressive disclosure** -- Show summary first, details on request. Room status shows gaps, `/mos:room expand` shows detail.
4. **Whitespace as structure** -- Empty lines separate logical groups. Monospace alignment creates visual order.
5. **Consistent table formatting** -- All data in aligned columns. No jagged edges.
6. **Animation restraint** -- Spinners for async operations only. No gratuitous animation. The statusline blink at 80% context usage is the right level.

### MindrianOS Brand Banner

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ⬡ MOS > ROOM STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ⬡ MOS > EDGE DISCOVERY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

```
╔══════════════════════════════════════════════════════════════╗
║  ⬡ REVIEW: Contradiction Found                             ║
╚══════════════════════════════════════════════════════════════╝

  ⊗ team-execution CONTRADICTS financial-model
  "Hiring plan assumes Q3 revenue that model doesn't project"

  This changes your financial model assumptions. Review?

──────────────────────────────────────────────────────────────
→ APPROVE (cascade changes) / REJECT (explain why) / DEFER
──────────────────────────────────────────────────────────────
```

---

## 9. Cross-Platform Compatibility

### Tested Character Sets

| Character Set | Windows Terminal | macOS Terminal | iTerm2 | WSL2 |
|--------------|-----------------|----------------|--------|------|
| Box drawing (light) | YES | YES | YES | YES |
| Box drawing (heavy) | YES | YES | YES | YES |
| Box drawing (double) | YES | YES | YES | YES |
| Box drawing (rounded) | MOSTLY | YES | YES | MOSTLY |
| Block elements | YES | YES | YES | YES |
| Sparkline chars | YES | YES | YES | YES |
| Geometric shapes (basic) | YES | YES | YES | YES |
| Hexagon (U+2B21) | YES | YES | YES | YES |
| Common arrows | YES | YES | YES | YES |
| Math symbols (plus/times in circle) | YES | YES | YES | YES |
| Emoji | VARIES (width) | YES | YES | VARIES |
| Braille patterns | VARIES | YES | YES | VARIES |

### Safe Characters (use freely)

All of U+2500-257F (box drawing), U+2580-259F (block elements), U+25A0-25FF (geometric shapes), U+2190-21FF (arrows), U+2200-22FF (math operators).

### Avoid

- Braille patterns (U+2800-28FF) -- inconsistent width on Windows
- CJK-width characters -- unpredictable alignment
- Rare Unicode symbols above U+FFFF -- font coverage drops
- Emoji for structural elements -- width varies (1 or 2 columns) breaking alignment
- Rounded box corners (╭╮╯╰) -- De Stijl is sharp-cornered anyway

### Minimum Terminal Width

Design all diagrams for 62-character width (matching GSD convention). This fits comfortably in 80-column terminals and doesn't break on narrower mobile terminal emulators.

---

## 10. Anti-Patterns to Avoid

### 1. Color-Only Information
Never rely on color alone to convey meaning. Always pair with a symbol.
- BAD: Red text for contradictions (invisible to colorblind users, invisible in text responses)
- GOOD: `⊗` symbol + red color when available

### 2. Headers for Hierarchy in Text Responses
Claude Code renders all h2-h6 as identical bold text. Don't use headers for visual hierarchy.
- BAD: `## Section` / `### Detail` (both look the same)
- GOOD: **Bold text** for sections, regular text for details, or code blocks with box drawing

### 3. Nested Blockquotes
Claude Code flattens all nesting levels. Don't use `> > >`.
- BAD: `> > > deeply nested`
- GOOD: Single-level blockquotes with indentation via spaces

### 4. Emoji as Structural Elements
Emoji width varies across terminals, breaking alignment in tables and diagrams.
- BAD: Emoji in table columns, diagram labels, or status indicators
- GOOD: Unicode geometric shapes (fixed-width, predictable rendering)
- EXCEPTION: Emoji in prose text where alignment doesn't matter is fine

### 5. Over-Complex ASCII Art
Intricate ASCII art is fragile and hard to maintain. Keep diagrams simple and purposeful.
- BAD: 20-line ASCII art logo that adds no information
- GOOD: 5-line room structure diagram that shows gaps at a glance

### 6. Gratuitous Visual Elements
Every visual element must serve the wicked problem navigation purpose.
- BAD: Decorative borders around every response
- GOOD: Borders only for actionable content (edge reviews, checkpoints, room status)

### 7. Inconsistent Symbol Usage
Once a symbol is assigned meaning, it keeps that meaning everywhere.
- BAD: `→` sometimes means INFORMS, sometimes means "next step"
- GOOD: `→` ALWAYS means INFORMS edge. Use `▶` for "next step" or "play"

---

## 11. Implementation Reference

### Quick Copy-Paste Symbol Sets

**Edge types:**
```
→ INFORMS    ⊗ CONTRADICTS    ⊕ CONVERGES    ▶ ENABLES    ⊘ INVALIDATES
```

**Venture stages:**
```
◌ Pre-Opportunity    ◎ Discovery    ◉ Validation    ◆ Design    ★ Investment
```

**Status:**
```
✓ Done    ✗ Failed    ◆ In Progress    ○ Pending    ⚠ Warning
```

**Larry modes:**
```
? Ask    ⇌ Blend    ! Tell
```

**Progress:**
```
░ empty    ▒ partial    ▓ mostly    █ full
```

**Box drawing essentials:**
```
Light:  ─ │ ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼
Heavy:  ━ ┃ ┏ ┓ ┗ ┛ ┣ ┫ ┳ ┻ ╋
Double: ═ ║ ╔ ╗ ╚ ╝ ╠ ╣ ╦ ╩ ╬
```

**Separators:**
```
Light:  ──────────────────────────────────────────────────────────────
Heavy:  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Double: ══════════════════════════════════════════════════════════════
```

**MindrianOS brand:**
```
⬡ MOS    (hexagon + prefix for all banners)
```

### ANSI Color Quick Reference (Bash/statusline only)

```bash
RED='\x1b[31m'       # CONTRADICTS
BLUE='\x1b[34m'      # INFORMS
YELLOW='\x1b[33m'    # CONVERGES
GREEN='\x1b[32m'     # ENABLES
ORANGE='\x1b[38;5;208m'  # INVALIDATES
CYAN='\x1b[1;36m'    # Brand
DIM='\x1b[2m'        # Secondary
RESET='\x1b[0m'
```

### Markdown-Safe Patterns (text responses only)

Since ANSI doesn't work in text responses, use these markdown patterns:

**For emphasis:** `**bold**` for primary, `*italic*` for secondary
**For structure:** Code blocks with box-drawing characters
**For data:** Markdown tables
**For traces:** Single-level blockquotes
**For symbols:** Unicode characters directly in text

---

## Sources

- [Claude Code Statusline Docs](https://code.claude.com/docs/en/statusline)
- [GitHub Issue #26390 -- GFM Feature Support](https://github.com/anthropics/claude-code/issues/26390) -- confirmed markdown renderer limitations
- [GitHub Issue #6466 -- Statusline Color Rendering](https://github.com/anthropics/claude-code/issues/6466)
- [GitHub Issue #6635 -- ANSI + Unicode in Statusline](https://github.com/anthropics/claude-code/issues/6635)
- [GitHub Issue #25346 -- ANSI Leak on Windows Terminal](https://github.com/anthropics/claude-code/issues/25346)
- [text-to-dashboard catalog](https://github.com/nerveband/text-to-dashboard) -- comprehensive Unicode visualization patterns
- [Unicode Progress Bars](https://changaco.oy.lc/unicode-progress-bars/) -- bar styles and character references
- [Rosetta Code -- Unicode Sparklines](https://rosettacode.org/wiki/Sparkline_in_unicode)
- [ccstatusline](https://github.com/sirmalloc/ccstatusline) -- third-party Claude Code statusline with color support
- [GSD ui-brand.md](~/.claude/get-shit-done/references/ui-brand.md) -- GSD visual patterns reference
- MindrianOS dashboard/index.html -- De Stijl color variables and edge styling
- MindrianOS scripts/context-monitor -- existing statusline implementation
- MindrianOS skills/larry-personality/SKILL.md -- thinking trace format

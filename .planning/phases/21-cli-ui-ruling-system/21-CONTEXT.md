# Phase 21: CLI UI Ruling System - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Create `skills/ui-system/SKILL.md` — a comprehensive ruling system that governs ALL terminal output from MindrianOS commands. Covers 4-zone output anatomy, 5 body shapes, symbol vocabulary, color contract, session start contract, cross-surface adaptation, and dual context per folder (STATE.md + MINTO.md). Then retrofit existing commands to follow these rules.

</domain>

<decisions>
## Implementation Decisions

### Skill Structure
- **D-01:** The ruling system lives as `skills/ui-system/SKILL.md` — auto-loaded on every session alongside existing skills (larry-personality, room-passive, room-proactive, context-engine, brain-connector).
- **D-02:** The skill is added to `settings.json` auto-load list so Larry enforces it automatically on every response.
- [auto] Selected recommended: single SKILL.md file with all rules, not split across multiple files.

### Four-Zone Output Anatomy
- **D-03:** Every command output has exactly 4 zones in fixed order: (1) Header Panel — context, (2) Content Body — varies by command, (3) Intelligence Strip — inline signals, (4) Action Footer — 2-3 grounded next steps.
- **D-04:** Zone 4 (Action Footer) is NEVER omitted. Larry never leaves the user stranded.
- **D-05:** Zone 3 (Intelligence Strip) appears only when room-proactive detects HIGH/MEDIUM signals. Max 3 signals per screen.
- [auto] Selected recommended: strict zone ordering with no exceptions.

### Five Body Shapes
- **D-06:** Body Shape A: Mondrian Board (`/mos:status`) — progress bars per section, 10-char wide, `■` fill.
- **D-07:** Body Shape B: Semantic Tree (`/mos:tree`, `/mos:room overview`) — folder tree with meaning, `▼▶▷├─└─` symbols.
- **D-08:** Body Shape C: Room Card (`/mos:room [section]`) — wiki-style with graph relationships, floating signal badge.
- **D-09:** Body Shape D: Document View (`/mos:open [artifact]`) — content + LazyGraph edges (INFORMS, CONTRADICTS, CONVERGES, FILED_FROM).
- **D-10:** Body Shape E: Action Report (`/mos:act`, `/mos:file-meeting`) — before/after delta with `[N→N]` change indicators.
- [auto] Selected recommended: all 5 shapes as specified.

### Symbol Vocabulary
- **D-11:** Exactly 12 glyphs, one meaning each, no overloading: `■` (progress fill), `▼` (expanded), `▶` (collapsed+content / next action), `▷` (collapsed+empty / alt action), `├─` (not-last item), `└─` (last item), `✓` (complete), `•` (draft), `⚠` (warning), `⚡` (convergence), `⬜` (gap), `→` (inline suggestion).
- **D-12:** No emoji. No `🚀✨💫🧠`. Ever.
- [auto] Selected recommended: strict vocabulary, no extensions.

### Color Contract
- **D-13:** Exactly 5 ANSI colors with semantic meaning: Green (success/active), Cyan (commands/paths), Yellow (warnings), Red (errors), Gray (meta). Default/White for primary content. Bold for emphasis.
- **D-14:** Color is NEVER decoration — only meaning. When in doubt, use default.
- [auto] Selected recommended: 5-color discipline as specified.

### Session Start Contract
- **D-15:** Three variants: Cold (no room), Warm (room exists, no signals), Warm+Signals (room with active signals).
- **D-16:** Max 2 signals in greeting. Never show same signal two sessions in a row unless something changed.
- **D-17:** Always includes Larry's "Reading the Room" thinking trace in blockquote format.
- [auto] Selected recommended: 3-variant contract as specified.

### Cross-Surface Adaptation
- **D-18:** CLI is master template. Desktop degrades to bold markdown headers + sentence summaries + blockquote callouts. Cowork uses same box chars as CLI.
- **D-19:** 80-column default, 62 content chars. Narrow (<60 cols) compresses headers, collapses trees, limits signals to 1. Wide (>100 cols) does NOT expand.
- [auto] Selected recommended: CLI-first with graceful degradation.

### Dual Context Per Folder
- **D-20:** Every room section folder gets both STATE.md (quantitative: artifact count, completeness, gaps) and MINTO.md (qualitative: reasoning pyramid, governing thought, supporting arguments, evidence, MECE check).
- **D-21:** Commands read BOTH before routing. A section with broken MINTO is worse than a sparse section with solid reasoning. The "Reasoning" column in status output comes from MINTO health.
- [auto] Selected recommended: dual context as specified, generate MINTO.md template when sections are created.

### Command-to-Shape Mapping
- **D-22:** Fixed mapping table — every `/mos:` command has a declared body shape. No command invents its own format. The mapping is in the SKILL.md file itself as a reference table.
- [auto] Selected recommended: mapping table in SKILL.md.

### Larry Voice in CLI
- **D-23:** CLI Larry is terse, structural, confident, action-oriented. Banned phrases: "Great question!", "I'd be happy to help", "It's important to note", "Let me explain", sentences starting with "I".
- [auto] Selected recommended: voice rules as specified.

### Error Handling
- **D-24:** Strict three-line pattern: `✗ [What failed]` / `  Why: [reason]` / `  Fix: /mos:command`. Never show stack traces.
- [auto] Selected recommended: three-line errors.

### Help System
- **D-25:** `/mos:help` shows grouped commands by flow (Getting started, Working, Reviewing, Brain, Admin). `/mos:help <command>` shows 4-line description + 3 examples max. tldr-style, not man-page.
- [auto] Selected recommended: tldr-style help.

### Density Adaptation
- **D-26:** If output exceeds 30 lines, compress Zone 1 to one line, show only top 2 signals in Zone 3. Keep Zone 4 at exactly 3 always. Short output (<10 lines) is fine — don't pad.
- [auto] Selected recommended: adaptive density as specified.

### Claude's Discretion
- Exact ASCII card widths and padding
- How to detect narrow terminals
- Internal helper functions for rendering cards/bars
- Whether to add a `scripts/ui-render` helper or keep rendering inline in skills

### Folded Todos
None.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design System
- `~/.claude/projects/-home-jsagi/memory/feedback_terminal_ux_patterns.md` — Full terminal UX vision with 13 rules
- `~/.claude/projects/-home-jsagi/memory/project_mos_ui_ruling_system.md` — Complete UI ruling system summary
- `~/.claude/projects/-home-jsagi/memory/feedback_room_dashboard_structure.md` — Room dashboard Mondrian grid structure

### Existing Skills (patterns to follow)
- `skills/larry-personality/SKILL.md` — Larry voice DNA, mode engine, interaction patterns
- `skills/room-passive/SKILL.md` — Room awareness, STATE.md reading patterns
- `skills/room-proactive/SKILL.md` — Intelligence signals (gaps, contradictions, convergence)

### Existing Commands (to retrofit)
- `commands/status.md` — Needs Body Shape A (Mondrian Board)
- `commands/room.md` — Needs Body Shape B (Semantic Tree) and C (Room Card)
- `commands/help.md` — Needs tldr-style grouped help
- `commands/diagnose.md` — Needs compact header + recommendation list

### Plugin Config
- `.claude-plugin/plugin.json` — Plugin manifest, skill auto-load list
- `settings.json` — Default settings including skill activation

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `skills/room-proactive/SKILL.md`: Already detects gaps, contradictions, convergence — Zone 3 signals come from here.
- `skills/room-passive/SKILL.md`: Already reads STATE.md per folder — dual context (MINTO.md) extends this.
- `skills/larry-personality/SKILL.md`: Voice DNA already defined — CLI voice rules extend this for terminal context.
- `scripts/compute-state`: Generates STATE.md — needs extension to also generate MINTO.md scaffolds.

### Established Patterns
- Skills auto-load via `settings.json` referencing the skill path.
- Skills use YAML frontmatter (name, description) + markdown body.
- Session-start hook already fires on startup/clear/compact — greeting contract hooks into this.
- Commands use markdown with YAML frontmatter for name, description, allowed-tools.

### Integration Points
- `settings.json` — add ui-system to auto-load skill list.
- `hooks/hooks.json` — session-start already exists, greeting contract integrates here.
- Every `commands/*.md` — needs retrofit to follow 4-zone anatomy.
- `scripts/compute-state` — extend for MINTO.md generation.

</code_context>

<specifics>
## Specific Ideas

- The SKILL.md must be comprehensive enough that Larry can render correct output without any additional code — the skill IS the rendering engine via prompt engineering.
- The command-to-body-shape mapping table is the enforcement mechanism — if a command's shape isn't in the table, it's not allowed to produce output.
- The MINTO.md template should be minimal — governing thought + 3 supporting arguments + evidence slots. Auto-generated as empty scaffold when a section is created.
- The session start greeting should read existing room-proactive intelligence and format it into the warm+signals variant automatically.

</specifics>

<deferred>
## Deferred Ideas

- `scripts/ui-render` helper script for programmatic card rendering — keep inline in SKILL.md first, extract if patterns stabilize.
- Terminal width detection via `tput cols` — start with 80-col assumption, add detection later.
- Automated UI linting that checks command output against the ruling system — future enhancement.

</deferred>

---

*Phase: 21-cli-ui-ruling-system*
*Context gathered: 2026-03-26*

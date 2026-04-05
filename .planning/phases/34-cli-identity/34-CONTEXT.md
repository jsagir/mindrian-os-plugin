# Phase 34: CLI Identity - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Mondrian banner fires reliably on every meaningful session boundary -- cold start, plugin update, and on-demand via /mos:splash. This is the MindrianOS visual identity in the CLI. No new visual design work -- the banner already exists at scripts/banner with full De Stijl Mondrian grid.

</domain>

<decisions>
## Implementation Decisions

### Update Detection
- **D-01:** Version comparison approach. Compare plugin.json version vs cached version in ~/.mindrian-last-version. On mismatch, treat as update. Banner shows "v1.4.0 -> v1.5.1" in the bottom bar.
- **D-02:** After banner fires on update, write current version to ~/.mindrian-last-version to prevent re-triggering.

### Banner Rendering
- **D-03:** Dual-path rendering. Try stderr first (current approach: bash banner >&2), then fall back to additionalContext injection if stderr output fails or is suppressed by the hook runtime.
- **D-04:** Detection method: check if stderr is a TTY (test -t 2). If TTY, render directly. If not TTY, inject ANSI banner text into Larry's additionalContext so Larry displays it.

### Terminal Width
- **D-05:** Responsive banner with 3 tiers. Detect width via tput cols (or COLUMNS env var as fallback).
  - 100+ columns: Full banner (current 78-char design, centered)
  - 80-99 columns: Compact banner (abbreviated block letters, same Mondrian colors)
  - <80 columns: Minimal banner (single line: "MINDRIANOS v1.5.1 | Wicked problems. Navigated.")
- **D-06:** Width detection happens once at banner invocation, not per-line.

### /mos:splash Command
- **D-07:** Simple markdown command file in commands/splash.md. Tells Larry to run scripts/banner with current version. No arguments needed.

### Claude's Discretion
- Compact banner layout (80-99 col) -- Claude designs the abbreviated block letters
- Error handling for missing tput/COLUMNS -- safe fallback to full banner (assume 100+)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Banner Implementation
- `scripts/banner` -- Existing 66-line Mondrian banner with 24-bit ANSI, 4 color zones, block letters
- `scripts/session-start` -- Hook handler, line 139-142 is the cold start banner call

### Design System
- `skills/ui-system/SKILL.md` -- CLI UI Ruling System (4 zones, 5 body shapes, 12 glyphs, color contract)
- `assets/banner-showcase.html` -- Reference HTML implementation of the banner (visual spec)
- `assets/logo.svg` -- SVG logo with Mondrian grid mark + wordmark

### Prior Phase Context
- `.planning/phases/17-visual-identity/17-CONTEXT.md` -- De Stijl palette, symbol system decisions
- `.planning/phases/21-cli-ui-ruling-system/21-CONTEXT.md` -- 4-zone anatomy, no emoji rule

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/banner` -- Full working banner, just needs wiring fixes and width handling
- `scripts/check-update` -- Already does daily GitHub CHANGELOG check, returns update info
- `scripts/session-start` -- Hook entry point, has both cold/warm start branches

### Established Patterns
- Hook scripts output via `>&2` for stderr visual output + JSON stdout for additionalContext
- Version read from plugin.json via python3 one-liner (established in banner and session-start)
- Marker file pattern: ~/.mindrian-onboarded (Phase 33 spec), ~/.mindrian-last-version (new)

### Integration Points
- session-start line 139-142: cold start branch calls banner
- session-start update check (lines 179-210): already caches in /tmp/mindrian-update-check
- commands/ directory: add splash.md for /mos:splash

</code_context>

<specifics>
## Specific Ideas

- Banner bottom bar should show version transition on update: "v1.4.0 -> v1.5.1" not just current version
- Responsive design: user explicitly stated terminal size is adjustable, so banner must adapt

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 34-cli-identity*
*Context gathered: 2026-03-31*

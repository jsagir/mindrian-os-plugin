---
id: SEED-112
status: dormant
priority: MEDIUM
planted: 2026-10-02
planted_during: Phase 369 plan 09 (D-02)
trigger_when: the plugin-wide design reconciliation phase, or the first time an MCP App view is rebuilt on the shell's components
scope: small to medium (three HTML files)
related: .planning/research/2026-10-02-UI-UX-PRIOR-ART-INVENTORY.md section 5 (C10, C11, C12), skills/ui-system/SKILL.md:22,26, lib/mcp/app-html/, Phase 369 D-01 and D-02
---

# SEED-112: The shipped MCP App HTML loads outside hosts and defaults to dark

## Impact in plain words

The three MCP App views the plugin ships to Claude Desktop and Cowork (dashboard, wiki, graph) still reach out to
other people's servers for fonts and scripts, and they paint on a near-black ground. Two house rules say otherwise:
`skills/ui-system/SKILL.md` line 22 ("no external hosts") and line 26 ("never a CDN"), plus Canon Part 8 (nothing
the user sees should quietly call out), and the v1.1 default of "warm cream ground, never black". The prior-art
inventory recorded both as open conflicts: C10 (no-CDN rule against shipped HTML) and C11 (dark against cream).

Phase 369 did not fix this on purpose. D-01 scopes Design Canon v3 to the new UI shell only; D-02 keeps the three
apps exactly as they are as the Desktop and Cowork face, and parks the orphan `mindrian-platform.html`. The
plugin-wide reconciliation is a later phase. This seed keeps the debt on record until then.

## Measured debt (2026-10-02, grep of lib/mcp/app-html/)

Outside-host references (C10), each one a network call the user did not ask for:

- `lib/mcp/app-html/dashboard.html:7` preconnect to `https://fonts.googleapis.com`
- `lib/mcp/app-html/dashboard.html:8` Google Fonts stylesheet (Bebas Neue, Inter, JetBrains Mono)
- `lib/mcp/app-html/dashboard.html:203` script from `cdn.jsdelivr.net` (`@modelcontextprotocol/ext-apps` app-with-deps)
- `lib/mcp/app-html/graph.html:7` preconnect to `https://fonts.googleapis.com`
- `lib/mcp/app-html/graph.html:8` Google Fonts stylesheet (same three families)
- `lib/mcp/app-html/graph.html:194` script from `cdnjs.cloudflare.com` (Cytoscape 3.28.1)
- `lib/mcp/app-html/graph.html:195` script from `cdn.jsdelivr.net` (ext-apps app-with-deps)
- `lib/mcp/app-html/wiki.html:7` preconnect to `https://fonts.googleapis.com`
- `lib/mcp/app-html/wiki.html:8` Google Fonts stylesheet (same three families)
- `lib/mcp/app-html/wiki.html:230` script from `cdn.jsdelivr.net` (ext-apps app-with-deps)

The parked `lib/mcp/app-html/mindrian-platform.html` (lines 8 and 10) also loads Google Fonts; it is loaded by
nothing, so it is not live debt.

Dark defaults (C11), each page sets `--ds-bg: #1a1a1a` and paints `body` with it:

- `lib/mcp/app-html/dashboard.html:12` (token) and `:41` (body background)
- `lib/mcp/app-html/wiki.html:11` (token) and `:39` (body background)
- `lib/mcp/app-html/graph.html:11` (token) and `:38` (body background)

All three also carry the older Bebas Neue / Inter display and body fonts rather than the v1.1 set.

## What a fix looks like

- Vendor or inline every font and script so the page contacts no outside host. The ext-apps client and Cytoscape are
  the only two scripts; both can be inlined or shipped beside the HTML. Cytoscape is the heavy one, so check the host
  frame's size limits first (`docs/research/MCP-APPS-STRATEGIC-RESEARCH.md` section 1.6).
- Flip the ground to the warm cream default (light theme first, dark as an explicit option), and move the palette to
  whichever system the reconciliation phase rules the winner.
- Smoke on a real Desktop and Cowork host (MCPV2-13 is still owed) before calling it done.

## Why it is not done in Phase 369

D-01 limits v3 to the shell and leaves every shipped v1.1 generator untouched. D-02 keeps the three apps as they are
until the shell is proven in production, then shares components into them. Restyling them now would be a plugin-wide
change the phase explicitly deferred.

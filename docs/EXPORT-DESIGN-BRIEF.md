# MindrianOS Export -- Design Brief for Dev Team

**Date:** 2026-03-31
**From:** Jonathan Sagir
**For:** MindrianOS development team
**Status:** Ready to build

---

## What We're Building

**Snapshot** -- a unified `/mos:export snapshot` command that generates a **single self-contained HTML hub** from any Data Room. It's a point-in-time overview of all work done in the CLI, rendered as a visual page. One file, works offline, deployable to Vercel, instantly recognizable as MindrianOS.

The name is intentional: every time you run `/mos:export snapshot`, you capture the room's current state. Run it again after more work -- you get a new snapshot reflecting the new state. The room evolves; snapshots capture moments.

We demoed it today with a pancreatic cancer research room. The demo produced 4 separate HTML files (wiki, dashboard, intelligence map, index). The goal is ONE unified generator that produces ONE Snapshot file containing all views.

**Live reference:** https://pws-website-wiki.vercel.app
**Demo room:** `~/demo-cancer-room/room/`
**Demo outputs:** `~/demo-cancer-room/room/index.html` (hub), `full-intelligence-map.html` (graph)

---

## THE LOGO -- Must Fix

The current index.html uses colored bars as a placeholder. The real MindrianOS logo is a **Mondrian grid mark** -- an asymmetric rectangle composition with black grid lines separating colored blocks. It is NOT colored bars side by side.

### Logo Source

**Canonical URL:** https://mindrianos-jsagirs-projects.vercel.app/logo_dark.svg

**SVG source:**
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 48">
  <!-- Mondrian grid mark -- 5 rectangles -->
  <rect x="0" y="0" width="20" height="48" fill="#1E3A6E"/>
  <rect x="22" y="0" width="12" height="22" fill="#A63D2F"/>
  <rect x="22" y="24" width="12" height="24" fill="#C8A43C"/>
  <rect x="36" y="0" width="8" height="48" fill="#F5F0E8"/>
  <rect x="46" y="0" width="4" height="32" fill="#2D6B4A"/>
  <!-- Wordmark -->
  <text x="60" y="35" font-size="32" fill="#F5F0E8"
        font-family="'Bebas Neue', sans-serif"
        font-weight="400" letter-spacing="0.04em">MINDRIAN</text>
</svg>
```

**Anatomy:**
```
  [Blue 20x48] 2px gap [Red 12x22 / Yellow 12x24] 2px gap [Cream 8x48] 2px gap [Green 4x32]
       |                    stacked vertically                  |               |
   tall navy           red top / gold bottom              thin cream bar    tiny green
   column              (split at y:22)                    (full height)     (top 2/3)
```

The mark is 5 rectangles with 2px gaps (background shows through). No grid lines needed -- the dark background (#0D0D0D) IS the grid. The "MINDRIAN" wordmark sits at x:60 in Bebas Neue.

**Sizes for export:**
- Header (top-left): height="40" -- full logo with wordmark
- Footer (bottom-left): height="24" -- full logo with wordmark, smaller

**Rules:**
- Always use the canonical SVG. Never recreate or approximate.
- Bebas Neue MUST be loaded (Google Fonts CDN) or the wordmark renders as fallback sans-serif.
- On dark backgrounds (#0D0D0D), the gaps between rectangles disappear -- this is correct.
- Zero border-radius. No rounding. Ever.

### Logo Placement

- **Header (top-left):** Full logo (icon + "MINDRIAN" wordmark), medium size
- **Footer (bottom-left):** Icon only (square mark), small size + "Built with MindrianOS" text

---

## Style Guide: Use the MindrianOS Website

**CRITICAL RULE:** The Snapshot view MUST use the same design system as the MindrianOS website. The canonical source files are in `~/mindrian-website/website/src/`. Do NOT fetch the deployed site -- read the actual codebase.

### Source Files (MUST READ)

```
STYLE GUIDE SOURCE OF TRUTH:
  ~/mindrian-website/website/src/app/globals.css          -- All CSS variables, animations, reduced-motion
  ~/mindrian-website/website/src/components/shared/Card.tsx       -- Card component (accent, hover, lifted)
  ~/mindrian-website/website/src/components/shared/Button.tsx     -- Button variants (primary, secondary, ghost, danger)
  ~/mindrian-website/website/src/components/shared/Tag.tsx        -- Tag/label component (uppercase, tracking)
  ~/mindrian-website/website/src/components/shared/SectionHeader.tsx -- Section headers (Bebas Neue, accent bar)
  ~/mindrian-website/website/src/components/layout/Nav.tsx        -- Navigation (fixed, h-16, logo, links)
  ~/mindrian-website/website/src/components/layout/Footer.tsx     -- Footer (CTA, newsletter, link groups, copyright)
  ~/mindrian-website/website/src/components/shared/ScrollReveal.tsx -- Scroll animations
  ~/mindrian-website/website/src/components/home/MondrianHero.tsx  -- Hero section pattern
  ~/mindrian-website/website/src/components/home/StatsSection.tsx  -- Stats display pattern
  ~/mindrian-website/website/src/components/home/DeStijlVisuals.tsx -- De Stijl visual elements
  ~/mindrian-website/website/src/lib/agents.ts                    -- Section color maps + border colors

  SVGs AND ASSETS:
  ~/mindrian-website/website/public/logo_dark.svg          -- Logo (canonical)
  ~/mindrian-website/website/public/                       -- All public assets
```

The Snapshot is a product of MindrianOS -- it must LOOK like the MindrianOS website. Same globals.css tokens, same Card/Button/Tag/SectionHeader patterns, same Nav height, same Footer structure. Translate the React components into static HTML that matches pixel-for-pixel.

### Design Tokens (from globals.css -- EXACT values)

```css
/* ── Backgrounds ── */
--ds-bg: #1a1a1a;             /* page background */
--ds-surface: #2d2d2d;        /* cards, containers */
--ds-elevated: #3a3a3a;       /* hover states */

/* ── Text ── */
--ds-cream: #f5f1e8;          /* primary text */
--ds-muted: #a8a39f;          /* secondary text, labels */

/* ── Borders ── */
--ds-border: #404040;         /* structural dividers */

/* ── Section Colors (fill) ── */
--ds-red: #A63D2F;            /* Problem Definition */
--ds-blue: #1E3A6E;           /* Questions / Intelligence */
--ds-yellow: #C8A43C;         /* Future / Literature */
--ds-green: #2D6B4A;          /* Customer / Validated */
--ds-sienna: #B5602A;         /* Challenge / Competition */
--ds-gray: #5C5A56;           /* Systems / Solution */
--ds-amethyst: #6B4E8B;       /* Evidence / Clinical */
--ds-teal: #2A6B5E;           /* Timing / Funding */

/* ── Section Colors (accessible text variants) ── */
--ds-red-text: #C95A4A;
--ds-blue-text: #4A7BC8;
--ds-yellow-text: #C8A43C;
--ds-green-text: #4A9B72;
--ds-sienna-text: #D4804A;
--ds-gray-text: #8A8780;
--ds-amethyst-text: #9B7EB5;
--ds-teal-text: #4A9B8E;

/* ── Shadows ── */
--ds-shadow-flat: 0 0 0 1px var(--ds-border);
--ds-shadow-lifted: 4px 4px 0 #0a0a0f;

/* ── Motion ── */
--ds-transition: 150ms ease;
--ds-transition-slow: 200ms ease-out;
```

### Typography (from the website)

```css
--ds-font-display: 'Bebas Neue', sans-serif;   /* headings, uppercase only */
--ds-font-body: 'Inter', system-ui, sans-serif; /* body text */
--ds-font-mono: 'JetBrains Mono', monospace;    /* stats, data, code */
```

Google Fonts CDN (include all):
```
Bebas+Neue | Inter:wght@300;400;500;600;700 | JetBrains+Mono:wght@400;500;600;700
```

**Type scale (from the website):**

| Level | Font | Size | Weight | Tracking | Usage |
|-------|------|------|--------|----------|-------|
| Display | Bebas Neue | 48-72px | 400 | 0.04em | Hero, splash |
| H1 | Bebas Neue | 32px | 400 | 0.04em | Page/section titles |
| H2 | Bebas Neue | 24px | 400 | 0.03em | Subsection titles |
| H3 | Inter | 20px | 600 | 0.01em | Card titles |
| Body | Inter | 14-16px | 400 | 0 | Default text |
| Small | Inter | 12px | 400 | 0 | Secondary info |
| Caption | Inter | 10px | 500 | 0.15em | Labels, tags (uppercase) |
| Mono | JetBrains Mono | 13px | 400 | 0 | Stats, data, code |

### Layout (from the website)

| Property | Value |
|----------|-------|
| Max content width | 1200px (centered) |
| Section padding | py: 96px (desktop), px: 32px |
| Section separation | `border-t border-ds-border` between sections |
| Card padding | 16-24px |
| Card border | `1px solid var(--ds-border)` |
| Card hover | `hover:border-ds-[color]` + `hover:brightness-125` |
| Grid gaps | 8-16px |
| Accent borders | 3px left border in section color |
| Button style | `px-6 py-3`, uppercase, tracking-wide, `hover:brightness-125 hover:shadow-ds-lifted` |
| Press feedback | `active:scale-[0.98]` |

### Critical Rules (from De Stijl design system)

1. **Border radius: 0. Everywhere. No exceptions.**
2. **Shadows: only 2 recipes.** Flat (`0 0 0 1px`) or lifted (`4px 4px 0`).
3. **Max 2 section colors per panel.** Max 3 chromatic hues per screen.
4. **Never italic.** Use weight (semibold) for emphasis.
5. **Motion: x/y axis only.** No rotation, no diagonal, no bounce, no spring.
6. **Transitions: 150ms ease** for interactions, **200ms ease-out** for layout.
7. **Header height: ~64px.** Sticky positioning.
8. **Alternating section backgrounds:** Alternate between `--ds-bg` and `--ds-surface`.
9. **Hover = brightness-125 + shadow-ds-lifted.** Consistent across all interactive elements.
10. **Uppercase labels: 10px, tracking 0.15em, Inter medium.** Architectural label style.

### Snapshot Versioning

Each Snapshot is timestamped. The header shows the exact date and time of export.

**Version history sidebar (collapsible, right edge):**
- Lists all previous snapshots as clickable entries
- Each entry shows: date, time, section count, article count
- Clicking loads that snapshot (if file exists in `room/exports/`)
- Current snapshot highlighted
- Collapsed by default, expands on click/hover

File naming convention: `room/exports/{YYYY-MM-DD-HHmm}-snapshot.html`

Example:
```
room/exports/
  2026-03-31-1430-snapshot.html   <-- current
  2026-03-28-0915-snapshot.html   <-- 3 days ago
  2026-03-25-1100-snapshot.html   <-- 6 days ago
```

The sidebar renders from a manifest (`room/exports/manifest.json`) that lists all snapshots with metadata. The generator appends to this manifest on each export.

### Reference Files

| What | Where |
|------|-------|
| Website (canonical style source) | https://mindrianos-jsagirs-projects.vercel.app |
| Logo SVG | https://mindrianos-jsagirs-projects.vercel.app/logo_dark.svg |
| De Stijl design system (full spec) | `MindrianV2/.claude/rules/figma-design-system.md` |
| Logo React component | `MindrianV2/frontend/src/components/ui/mindrian-logo.tsx` |

---

## Page Structure

Matching the PWS website pattern (https://pws-website-wiki.vercel.app):

```
+=========================================================================+
| [Mondrian Logo]  {Room Name}                    [{Venture Stage}]       |
| {subtitle -- one-line room description}                                 |
+=========================================================================+
| [red][blue][yellow][green][orange]  <-- 5-color accent bar              |
+=========================================================================+
|    {N}      |     {N}       |     {N}        |    {N}     |    {N}      |
|  Sections   |   Articles    |  Connections   |   Gaps     |  Grants     |
+=========================================================================+
|                                                                         |
|  VIEWS (3-column grid, conditional)                                     |
|  +------------------+  +------------------+  +------------------+       |
|  | [tag] Wiki       |  | [tag] Intelli-   |  | [tag] Dashboard  |       |
|  | title            |  | gence Map        |  | title            |       |
|  | description      |  | description      |  | description      |       |
|  | Open >           |  | Open >           |  | Open >           |       |
|  +------------------+  +------------------+  +------------------+       |
|                                                                         |
|  ROOM SECTIONS (4-column grid)                                          |
|  [colored bar]  [colored bar]  [colored bar]  [dashed empty]            |
|  Problem Def    Literature     Solution       Market Analysis           |
|  4 articles     2 articles     1 article      -- EMPTY --               |
|                                                                         |
|  KEY INSIGHTS (3-column, quote cards)                                   |
|  [CRITICAL]     [CRITICAL]     [VALIDATED]                              |
|  "GPC1 contra-  "Window claim  "Multi-omics                            |
|   diction..."    is false..."   validated..."                           |
|                                                                         |
|  RED TEAM (4 severity boxes: red/orange/yellow/green)                   |
|  | 4 CRITICAL | 5 HIGH | 4 MEDIUM | 2 LOW |                            |
|                                                                         |
|  TOP OPPORTUNITIES (scored list)                                        |
|  [97] NCI PCDC U01 .............. $4.5M   Jul 1, 2026                  |
|  [92] DOD PCARP ................. $1.1M   TBD 2026                     |
|  [91] Mark/AACR/Lustgarten ...... $2M     Next cycle                   |
|                                                                         |
|  BREAKTHROUGH ANGLES (3-column cards, blue accents)                     |
|  Microbiome     Protease        Two-Tier Triage                        |
|  cmDNA          PAC-MANN        $50 screen + $400 confirm              |
|                                                                         |
|  FEATURED QUOTE (full-width, centered)                                  |
|  "There is no affordable, non-invasive screening tool..."              |
|  -- problem-definition/the-detection-gap.md                            |
|                                                                         |
+=========================================================================+
| [red][blue][yellow][green][orange]  <-- accent bar                      |
+=========================================================================+
| [Logo Icon]  Built with MindrianOS          2026-03-31 | 36n, 39e      |
+=========================================================================+
```

---

## Files to Read

### MUST READ (architecture + current code)
```
MindrianOS-Plugin/docs/EXPORT-VISION-BRIEF.md      Full vision, three tiers, examples
MindrianOS-Plugin/docs/EXPORT-BUILD-PROMPT.md       Build prompt with every file path
MindrianOS-Plugin/CLAUDE.md                         Master architecture
MindrianOS-Plugin/scripts/generate-export.cjs       Current generator (extend this)
MindrianOS-Plugin/dashboard/export-template.html    Current template (evolve this)
MindrianOS-Plugin/assets/logo.svg                   Logo SVG
MindrianV2/.claude/rules/figma-design-system.md     Full De Stijl design system
MindrianV2/frontend/src/components/ui/mindrian-logo.tsx  Logo component (React reference)
```

### MUST TEST AGAINST
```
demo-cancer-room/room/                              Complex demo room (36 nodes, 39 edges)
demo-cancer-room/room/index.html                    Current hub (replace with better version)
demo-cancer-room/room/full-intelligence-map.html    Intelligence map (integrate as primary graph)
```

### LIVE REFERENCE
```
https://pws-website-wiki.vercel.app                 Visual quality target
```

---

## Always-Visible Sections (Top of Snapshot)

These sections appear ABOVE the views grid, immediately after the stats bar. They are the first things a viewer sees because they represent the most actionable intelligence.

### 1. Breakthrough Angles (ADJACENT_POSSIBLE)
- Pulled from graph.json nodes where `layer === "breakthrough"`
- Render as blue-accented cards (3-column grid)
- Each card: Tag ("Cross-Domain" / "Functional" / "Architecture" / "AI" / "Transfer"), title, description
- If no breakthrough nodes exist in graph, this section is hidden

### 2. Bank of Opportunities
- Pulled from `funding-strategy/` or `opportunity-bank/` articles
- Render as scored list: relevance badge (0-100), funder, program, amount, deadline
- Sorted by relevance descending
- Always exported if opportunities exist -- this is a core Snapshot deliverable
- If no opportunities exist, show a CTA: "Run /mos:opportunities scan to discover grants"

**These two sections are the "what's next" of the Snapshot.** Breakthroughs = where to innovate. Opportunities = how to fund it. They go first because they're forward-looking. The room sections, insights, and graph below are backward-looking (what's been done).

---

## Current State vs Target State

This is what `/mos:export` does NOW versus what it needs to do after this build.

### What EXISTS today (5 separate scripts, fragmented output)

```
CURRENT STATE
│
├── generate-export.cjs (477 lines)
│   ├── Reads room/ and graph.json
│   ├── Injects into export-template.html
│   ├── Produces: Mondrian grid dashboard with 4 tabs
│   ├── Has: section cards, basic Cytoscape graph, doc viewer
│   ├── MISSING: no intelligence map, no methodology cards, no insights,
│   │   no opportunities, no breakthroughs, no version history
│   └── Output: room/exports/{date}-{name}.html
│
├── generate-standalone-dashboard.py (626 lines)
│   ├── Separate Python script
│   ├── Produces: standalone Cytoscape.js graph page
│   ├── Has: graph visualization, node colors, basic edges
│   ├── MISSING: no layer toggles, no edge filters, no click-to-inspect,
│   │   no semantic edge types (only CONVERGES)
│   └── Output: room/dashboard.html
│
├── generate-wiki.py (447 lines)
│   ├── Separate Python script
│   ├── Produces: Wikipedia-style article browser
│   ├── Has: sidebar nav, article rendering, search
│   ├── MISSING: not embedded in main export, requires separate server
│   └── Output: room/wiki.html (needs http server to work)
│
├── generate-dochub.py (464 lines)
│   ├── Separate Python script
│   ├── Produces: browsable document reader
│   ├── MISSING: redundant with wiki, not integrated
│   └── Output: separate HTML
│
└── build-room-graph.py (169 lines)
    ├── Reads room files, computes keyword overlap
    ├── Produces: graph.json with CONVERGES edges only
    ├── MISSING: no semantic edges (CONTRADICTS, VALIDATES, etc.),
    │   no concept/competitor/breakthrough/gap nodes,
    │   no intelligence layer
    └── Output: room/graph.json

PROBLEMS WITH CURRENT STATE:
  1. Five separate scripts in two languages (Node.js + Python)
  2. Five separate HTML files that don't link to each other
  3. No unified hub page -- user must know which file to open
  4. Graph only has keyword-overlap edges (CONVERGES), no semantic relationships
  5. No methodology artifact detection or rendering
  6. No opportunity/grant display
  7. No breakthrough angle visualization
  8. No key insights extraction
  9. No version history or timestamping
  10. Logo is wrong (colored bars, not Mondrian mark)
  11. Design system doesn't match the MindrianOS website
  12. No snapshot naming convention
  13. Wiki requires a running HTTP server (not standalone)
```

### What we BUILT today in the demo session (proof of concept)

During today's pancreatic cancer research demo, we manually assembled what the Snapshot should be:

```
DEMO SESSION OUTPUT (manual assembly)
│
├── index.html ........................ Hub page matching PWS website structure
│   ├── Real Mindrian logo (SVG from website)
│   ├── Stats bar (sections, articles, connections, gaps, grants)
│   ├── Views grid (6 cards linking to sub-views)
│   ├── Section cards (4 populated + 4 gap indicators)
│   ├── Key insights (3 cards: 2 CRITICAL, 1 VALIDATED)
│   ├── Red team severity bars (4C/5H/4M/2L)
│   ├── Top 5 grant opportunities (scored, with deadlines)
│   ├── Breakthrough angles (5 blue-accented cards)
│   ├── Featured quote
│   └── MindrianOS branded footer
│
├── full-intelligence-map.html ........ NEW: Full graph with ALL layers
│   ├── 36 nodes across 7 layers
│   ├── 39 edges across 10 relationship types
│   ├── Layer toggle buttons (show/hide structure/concept/external/etc.)
│   ├── Edge type filter checkboxes
│   ├── Click-to-inspect with connection details
│   ├── Hover edges to see labels
│   └── De Stijl dark theme with colored nodes
│
├── dashboard.html .................... Basic Cytoscape graph (existing)
├── wiki.html ......................... Wikipedia article browser (existing)
└── exports/pdac-full-export.html ..... Mondrian grid export (existing)

WHAT THE DEMO PROVED:
  1. The hub page structure works -- matches PWS website quality
  2. Intelligence map is the superior graph view (replaces dashboard)
  3. Breakthroughs and opportunities should be front-and-center
  4. Key insights (CONTRADICTS + CRITICAL) are high-value
  5. Gap indicators (dashed, muted) are useful for showing blind spots
  6. Red team severity bars are visually powerful
  7. Section cards with article counts give quick overview
  8. Everything CAN be in one page -- just needs one unified generator
```

### What we NEED (target state -- the Snapshot)

```
TARGET STATE: /mos:export snapshot
│
│  ONE command. ONE generator. ONE output file. ALL intelligence.
│
├── Single unified generator (generate-snapshot.cjs)
│   ├── Node.js, zero npm dependencies
│   ├── Replaces all 5 current scripts
│   ├── Reads room/ at export time, discovers everything
│   ├── Runs build-room-graph inline (no separate step)
│   ├── Generates semantic edges (CONTRADICTS, VALIDATES, etc.) not just CONVERGES
│   ├── Detects methodology artifacts from frontmatter
│   ├── Extracts key insights from graph edges + red team
│   ├── Computes stats automatically
│   └── Writes single .html to room/exports/{YYYY-MM-DD-HHmm}-snapshot.html
│
├── Single output HTML (the Snapshot)
│   ├── MindrianOS website design system (from ~/mindrian-website/website/src/)
│   ├── Real Mindrian logo (SVG from website public/)
│   ├── Snapshot timestamp + version history sidebar
│   │
│   ├── ABOVE THE FOLD (first things viewer sees):
│   │   ├── Header: logo + room name + stage badge + date/time
│   │   ├── Stats bar: sections, articles, connections, gaps, grants
│   │   ├── Breakthrough angles (blue cards from ADJACENT_POSSIBLE nodes)
│   │   └── Bank of Opportunities (scored grant list)
│   │
│   ├── VIEWS (tabbed or scrollable):
│   │   ├── Intelligence Map (primary graph -- 7 layers, toggles, filters)
│   │   ├── Wiki (article browser with sidebar and search)
│   │   ├── Doc Hub (scrollable reader)
│   │   ├── Deck (auto-generated slides, if 3+ sections populated)
│   │   └── Disabled views shown as grayed cards with reason
│   │
│   ├── ROOM STATE:
│   │   ├── Section cards (populated + gap indicators)
│   │   ├── Methodology artifact cards (diagnosis, red team, personas, etc.)
│   │   ├── Key insights (max 5, from CONTRADICTS/CRITICAL/governing thoughts)
│   │   ├── Red team severity summary (if red team exists)
│   │   └── Featured quote (strongest statement from room)
│   │
│   ├── TEAM/PARTNERS (if team-execution/ has content)
│   │
│   └── FOOTER: MindrianOS branding + timestamp + version
│
└── Version manifest (room/exports/manifest.json)
    ├── Lists all snapshots with metadata (date, sections, articles, edges)
    ├── Enables version history sidebar in each snapshot
    └── Clickable rollback to any previous snapshot
```

### Gap Summary

| Feature | Current | Demo | Target |
|---------|---------|------|--------|
| Unified generator | 5 scripts, 2 languages | Manual assembly | 1 script (Node.js) |
| Output files | 5 separate HTMLs | 5 separate HTMLs | 1 Snapshot HTML |
| Logo | Wrong (colored bars) | Fixed (real SVG) | Correct (from website public/) |
| Design system | Custom/inconsistent | Partially matched | Exact match to website codebase |
| Intelligence map | None | Built (36n/39e/7 layers) | Embedded in Snapshot |
| Semantic edges | CONVERGES only | Manually enriched | Auto-generated |
| Methodology cards | None | None | Auto-detected from frontmatter |
| Key insights | None | 3 manual cards | Auto-extracted (max 5) |
| Opportunities | None | 5 manual entries | Auto-from funding-strategy/ |
| Breakthroughs | None | 5 manual cards | Auto-from ADJACENT_POSSIBLE |
| Red team summary | None | Manual severity bars | Auto-from RED-TEAM-REPORT.md |
| Version history | None | None | manifest.json + sidebar |
| Snapshot timestamp | None | Static in footer | Header + versioned filename |
| Gap indicators | None | Dashed cards | Auto for empty sections |
| Offline support | Partial (wiki needs server) | Partial | Full (single file, file://) |
| Mobile responsive | Partial | Yes (CSS grid) | Full (375-1440px) |

---

## What Needs Doing (Priority Order)

| # | Task | Details |
|---|------|---------|
| 1 | **Fix the logo** | Replace colored bars with real Mondrian grid mark (SVG spec above). Header = full logo + wordmark. Footer = icon only + text. |
| 2 | **Unify the generators** | Merge 5 scripts into one `generate-export.cjs`. Node.js, zero deps. |
| 3 | **Intelligence Map as primary graph** | The `full-intelligence-map.html` pattern (36 nodes, layer toggles, edge filters, click-to-inspect) replaces the simpler dashboard graph. |
| 4 | **Conditional view rendering** | Views grid only shows cards for views with content. Empty = grayed out with reason. |
| 5 | **Section gap indicators** | Empty sections render with dashed border, muted opacity, starter questions. |
| 6 | **Methodology artifact cards** | Detect `methodology:` in frontmatter, render with badge (diagnose, red-team, etc.) |
| 7 | **Key insights extraction** | Auto-pull from CONTRADICTS edges, CRITICAL red team findings, governing thoughts. Max 5. |
| 8 | **Opportunity table** | Scored list from funding-strategy/. Relevance score, funder, amount, deadline. |
| 9 | **Breakthrough angles** | Render ADJACENT_POSSIBLE nodes from graph as blue-accented cards. |
| 10 | **Responsive** | Mobile-first. 375px / 768px / 1024px / 1440px breakpoints. |
| 11 | **Single file output** | Everything inline. Cytoscape.js via CDN (only external dep). Graph data as inline JS. |

---

## Quality Bar

- [ ] Logo is the real Mondrian grid mark, not colored bars
- [ ] Visually matches pws-website-wiki.vercel.app quality
- [ ] Border radius is 0 everywhere
- [ ] Works offline (file:// protocol)
- [ ] Deploys to Vercel with `npx vercel`
- [ ] Responsive (375px to 1440px)
- [ ] Loads in under 2 seconds
- [ ] Single .html file
- [ ] Intelligence map with layer toggles + edge filters
- [ ] Empty sections shown as gaps
- [ ] No hardcoded project content
- [ ] WCAG AA contrast (4.5:1 minimum for text)
- [ ] No em-dashes (use -- instead)
- [ ] "Built with MindrianOS" in footer

---

## Architectural Decisions (from dev team Q&A 2026-03-31)

### AD-1: Hub + co-located files, not single monolithic HTML
Output is a FOLDER per snapshot, not one file. The hub (index.html) links to co-located view files (intelligence-map.html, wiki.html, dochub.html, deck.html). Zip the folder to share. Deploy the folder to Vercel. Relative links only.

```
room/exports/2026-03-31-1430/
  index.html, intelligence-map.html, wiki.html, dochub.html, deck.html, manifest.json
```

### AD-2: Read existing graph.json, fallback to keyword-only
If KuzuDB enriched the graph (check `"enriched": true` in graph.json metadata), read it as-is. If not enriched, fall back to CONVERGES-only keyword overlap. Never re-compute what KuzuDB already computed.

### AD-3: Keep existing scripts, deprecate after Snapshot stable
Mark 5 existing scripts with `# DEPRECATED` comment. Don't delete until Snapshot tested on 3+ rooms. serve-wiki stays for local live-editing (different use case).

### AD-4: Hardcode design tokens in the Snapshot template
Extract from globals.css once, embed in template. Generator must work standalone (ships with plugin, not website repo). Update on website token changes.

### AD-5: CDN default, --offline flag inlines Cytoscape.js
`node generate-snapshot.cjs ./room` = CDN. `node generate-snapshot.cjs ./room --offline` = inline 500KB Cytoscape.

### AD-6: Insight priority order
1. CRITICAL red team findings, 2. CONTRADICTS edges, 3. VALIDATES edges, 4. MINTO.md governing thoughts, 5. CONVERGES 3+ sections. Always include at least 1 positive. Max 5.

### AD-7: Red team scan order
Check `room/RED-TEAM-REPORT.md` first, then scan for `methodology: red-team` in any frontmatter. MINTO.md always at `room/{section}/MINTO.md`.

### AD-8: Breakthroughs silently skip if none exist
No gap indicator, no CTA. Only appears when ADJACENT_POSSIBLE nodes exist in graph.

### AD-9: Rich manifest with full stats per snapshot
Enables version comparison sidebar ("3 days ago: 5 articles, now 8").

### AD-10: Same deploy pipeline as /mos:publish
Snapshot folder is another deployable artifact. No separate pipeline.

### AD-11: This is v5.2 (minor version, not rewrite)
Room structure, filing pipeline, graph schema unchanged. New export format unifying existing outputs.

### AD-13: ALL views must follow the MindrianOS website design system -- EXCEPT the Intelligence Map
Every HTML file in the Snapshot folder (index.html, wiki.html, dochub.html, deck.html) MUST use the website's design tokens, component patterns, typography, and layout rules. The Intelligence Map (intelligence-map.html) is the ONLY exception -- it keeps its current dark Cytoscape.js-focused design with layer toggles and edge filters. It already looks great. Don't touch it.

Concretely:
- wiki.html: Rebuild to match website Card/SectionHeader/Tag patterns. Articles render as Cards with accent borders. Section headers use Bebas Neue. Navigation sidebar uses website Nav patterns.
- dochub.html: Same as wiki but scrollable single-page reader. Cards, Tags, section colors from website.
- deck.html: Slides use website SectionHeader for titles, Card for content blocks, Button for CTAs.
- index.html (hub): Already specified to match website. This is confirmed.
- intelligence-map.html: KEEP AS-IS. The dark theme with Cytoscape.js, layer toggles, edge filters, and click-to-inspect is the target quality. Do not restyle to match website -- it's a specialized data visualization that works better with its own dense layout.

### AD-14: ALL content must be hyperlinked via KuzuDB graph relationships
Every mention of a section, article, concept, or entity that exists as a node in graph.json MUST be a clickable hyperlink to the corresponding page/anchor in the Snapshot. This is what makes the Snapshot a knowledge graph explorer, not just a static document.

**How it works:**

1. The generator reads graph.json and builds a lookup table: `node_id -> page_url#anchor`
2. When rendering any article's markdown content, scan for terms that match node labels in the graph
3. Wrap matched terms in `<a href="wiki.html#node-id">` links
4. When rendering section cards, link section names to their wiki pages
5. When rendering insight cards, link source attributions to the originating article
6. When rendering opportunity items, link funder names to competitive-analysis if edges exist
7. In wiki.html, each article page shows a "See Also" footer with all connected nodes (from graph edges)
8. In dochub.html, inline links within article text point to other articles in the same dochub

**Edge types become navigation patterns:**

| Edge Type | Navigation Behavior |
|-----------|-------------------|
| CONVERGES | "Related" links in See Also footer |
| CONTRADICTS | "Contradicted by" warning links (red accent) |
| VALIDATES | "Supported by" confirmation links (green accent) |
| INFORMS | "See also" directional links |
| ENABLES | "Enabled by" links |
| REQUIRES | "Requires" links to empty sections (link to gap indicator) |
| ADJACENT_POSSIBLE | "Breakthrough angle" links to breakthrough cards |
| BLOCKED_BY | "Blocked by" warning links to gap nodes |

**Graph-driven See Also example (bottom of each wiki article):**
```
See Also
  INFORMS  --> Market Analysis (2 edges)
  CONTRADICTS --> Solution Design: GPC1 not replicated
  CONVERGES --> Literature: Key Papers (shared: exosome, screening)
```

Each line is a clickable link. The edge type is color-coded (red for CONTRADICTS, green for VALIDATES, gray for CONVERGES). This turns every article into a node in a navigable knowledge web -- exactly what KuzuDB was built for.

**Fallback:** If no graph.json exists or a room wasn't built through MindrianOS (no KuzuDB edges), hyperlinks degrade gracefully to section-level links only (no inline term matching, just section card links).

### AD-12: Test matrix
| Room | Purpose |
|------|---------|
| `~/demo-cancer-room/room/` | Complex case (red team, grants, breakthroughs, semantic edges) |
| `~/rooms/align-x-milken/room/` | Stress test (30 pages, 295 edges) |
| Empty room (STATE.md only) | Graceful degradation (all gaps, no crash) |

---

## The Core Principle

The room IS the content. The export reads whatever exists at export time and renders it. MindrianOS frames it (logo, header, footer, design system). The project fills it (articles, graphs, insights, grants, breakthroughs). Every export is a snapshot. Every room gets a different export. The structure adapts. The brand stays constant.

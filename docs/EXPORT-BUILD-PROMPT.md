# MindrianOS Export Builder -- Full Context Prompt

**Copy this entire document into a new Claude Code session (or Cursor/Copilot) to build the unified export generator.**

---

## TASK

Build a unified MindrianOS Data Room export generator that produces a single self-contained HTML hub from any `room/` directory. The output is a standalone `.html` file that:
- Works when double-clicked from a file explorer (`file://` protocol)
- Deploys to Vercel with `npx vercel` (zero config, no build step)
- Contains the complete project intelligence at time of export
- Is instantly recognizable as a MindrianOS product

The generator replaces 5 separate scripts with one unified pipeline.

---

## DESIGN REFERENCE (MANDATORY -- fetch and study before coding)

**Live reference:** https://pws-website-wiki.vercel.app

This is a real Data Room export for the PWS (Problems Worth Solving) project. Study:
- The views grid (7 card layout with tags, descriptions, "Open" arrows)
- The stats bar (4-5 metric boxes)
- The visual assets grid (4-column, categorized)
- The opportunity table (scored, with deadlines)
- The quote cards (Da Vinci aesthetic -- large serif text, image beside)
- The framework deep-dive cards (image + title + subtitle)
- The footer ("Built with MindrianOS")
- The dark color system and typography choices

Your output must match this visual quality. The structural pattern adapts per project.

---

## ARCHITECTURE: THE THREE TIERS

Every export has exactly three tiers. The team MUST understand this hierarchy:

### Tier 1: MindrianOS Frame (FIXED -- identical on every export, every project)

```
TOP OF PAGE
+---------------------------------------------------------------------------+
| [MindrianOS Logo]   {Room Name}   [{Venture Stage}]   {YYYY-MM-DD}       |
| =========================================================================|
| [red] [blue] [yellow] [green] [orange]  <-- De Stijl 5-color accent bar  |
+---------------------------------------------------------------------------+
| Sections: {N}  |  Articles: {N}  |  Connections: {N}  |  Gaps: {N}       |
+---------------------------------------------------------------------------+

                    ... dynamic content (Tier 2 + 3) ...

+---------------------------------------------------------------------------+
| [red] [blue] [yellow] [green] [orange]  <-- De Stijl segment divider     |
| Built with MindrianOS   |   {export timestamp}   |   {room version hash} |
+---------------------------------------------------------------------------+
BOTTOM OF PAGE
```

**Specs:**
- Logo: MindrianOS SVG or PNG, top-left, always present, links to https://mindrian.ai
- Room name: Read from `room/STATE.md` frontmatter `room_name` field
- Venture stage: Read from `room/STATE.md` frontmatter `venture_stage` field. Render as uppercase monospace badge.
- Accent bar: 5 adjacent color blocks, no gaps: #CC0000, #0066CC, #C8A43C, #2D6B4A, #B5602A
- Stats: Auto-computed by scanning `room/`. Count sections (directories), articles (`.md` files excluding ROOM.md/STATE.md/MINTO.md), edges (from `graph.json`), gaps (sections with 0 articles), opportunities (files in `opportunity-bank/` or `funding-strategy/`)
- Footer: Always present. "Built with MindrianOS" + timestamp + colored divider.

**Design tokens:**
```css
--bg-primary: #0D0D0D;
--bg-surface: #1A1A1A;
--bg-elevated: #2A2A2A;
--text-primary: #F5F0E8;     /* cream */
--text-muted: #A09A90;
--accent-red: #CC0000;
--accent-blue: #0066CC;
--accent-yellow: #C8A43C;
--accent-green: #2D6B4A;
--accent-orange: #B5602A;
--font-headline: 'DM Serif Display', serif;
--font-body: 'Source Sans 3', sans-serif;
--font-mono: 'JetBrains Mono', monospace;
--font-quote: 'Caveat', cursive;
--border-mondrian: 2px solid #333;
--border-accent: 3px solid;   /* color varies */
```

### Tier 2: Universal Structure (same skeleton, data varies per room)

These sections ALWAYS appear in the export. Their content is pulled from the room.

**2a. Views Grid**
- Card grid (2-3 columns responsive) showing available views
- Each card: colored tag, title, description, "Open" link
- **Conditional rendering**: Only show a view card if the room has enough content for it

| View | Condition to show | What it renders |
|------|------------------|-----------------|
| Wiki | 1+ articles in room | Wikipedia-style article pages with sidebar, search, TOC |
| Doc Hub | 1+ articles | Scrollable document reader, all articles |
| Deck | 3+ populated sections | Auto-generated slide deck from section content |
| Diagrams | graph.json has 5+ edges | Architecture diagrams, relationship maps |
| Intelligence Map | graph.json has semantic edges (non-CONVERGES) | Full Cytoscape.js with layer toggles, edge filters, click-to-inspect |
| Visual | Room has methodology outputs | Scenario matrices, heatmaps, funnels |
| Components | Room has interactive elements | Standalone interactive components |

**2b. Section Cards**
- One card per section directory in `room/`
- Section color from `SECTION_COLORS` mapping (problem-definition=#A63D2F, market-analysis=#C8A43C, etc.)
- Populated section card: section name, article count, governing thought (from `MINTO.md` if exists), latest article date
- Empty section card: section name, "EMPTY" badge, dashed border, muted opacity, starter questions from `ROOM.md`
- Sort: populated sections first, then empty sections

**2c. Knowledge Graph**
- Cytoscape.js interactive visualization
- Load graph data from `room/graph.json` (embedded inline as JS variable)
- Node styling by `layer` field: structure (rounded rect), content (small rounded rect), intelligence (diamond), concept (circle), external (pentagon), breakthrough (star), gap (triangle)
- Edge styling by `type` field: CONTRADICTS (red dashed), VALIDATES (green solid), INVALIDATES (red solid), ENABLES (green dashed), CHALLENGES (orange thick dashed), REQUIRES (red dotted), BLOCKED_BY (red thick solid), ADJACENT_POSSIBLE (blue dashed), CONVERGES (gray dotted), INFORMS (gray solid), CREATES_RISK (orange dashed)
- Layer toggle buttons (show/hide by layer)
- Edge type filter checkboxes
- Click node to see detail panel with connected edges
- Hover edge to see label

**2d. Doc Hub**
- Render every `.md` article as HTML (parse markdown frontmatter + body)
- Sidebar navigation grouped by section
- Article view: title, frontmatter metadata (status, depth, date), rendered body

### Tier 3: Project-Specific Content (unique per room -- auto-discovered)

The generator discovers these by scanning the room. They appear ONLY if relevant content exists.

**3a. Methodology Artifacts**
- Scan all articles for `methodology:` in frontmatter
- Render as special cards with methodology badge (e.g., "diagnose", "red-team", "challenge-assumptions")
- Red team reports get severity summary badge (e.g., "4C/5H/4M/2L")

**3b. Key Insights**
- Extract from graph.json: all CONTRADICTS edges (show as conflict cards), all VALIDATES edges (show as confirmation cards)
- Extract from red team reports: all CRITICAL findings
- Extract from MINTO.md files: governing thoughts
- Render as quote-style cards with source attribution and severity indicator
- Max 5 insights. Prioritize CRITICAL > CONTRADICTS > governing thoughts.

**3c. Opportunities**
- If `funding-strategy/` or `opportunity-bank/` has content, parse opportunity articles
- Render as scored table: rank, funder, program, amount, deadline, relevance score
- Sort by relevance score descending

**3d. Visual Assets**
- Scan room for image files (.png, .jpg, .svg)
- Render as grid (4-column), categorized by directory
- For served version: use relative paths. For standalone: base64 encode (with --inline flag)

**3e. Featured Quote**
- Pull the single strongest statement from: (1) build-thesis governing thought, (2) problem-definition MINTO.md, (3) first complete article's core problem statement
- Render as large Da Vinci-style card: serif font, prominent display

**3f. Team/Partners**
- If `team-execution/` or `team/` has content, render team member cards
- If partner logos exist, render logo row

---

## FILE MANIFEST

Read ALL of these files before writing any code. They contain the current implementation, design system, and test data.

### Source Code (the codebase you're extending)

```
MUST READ -- Current generators:
  ~/MindrianOS-Plugin/scripts/generate-export.cjs        (477 lines, Node.js, EXTEND THIS)
  ~/MindrianOS-Plugin/dashboard/export-template.html      (1956 lines, HTML template, EVOLVE THIS)

MUST READ -- Generators to merge in:
  ~/scripts/generate-standalone-dashboard.py              (626 lines, graph rendering)
  ~/scripts/generate-wiki.py                              (447 lines, article rendering)
  ~/scripts/generate-dochub.py                            (464 lines, doc hub)
  ~/scripts/build-room-graph.py                           (169 lines, graph builder)

MUST READ -- Design + brand:
  ~/MindrianOS-Plugin/skills/ui-system/SKILL.md           (UI ruling system)
  ~/MindrianOS-Plugin/skills/room-passive/SKILL.md        (room structure awareness)
  ~/MindrianOS-Plugin/skills/room-proactive/SKILL.md      (intelligence: gaps, contradictions)
  ~/MindrianOS-Plugin/commands/export.md                  (export command definition)
  ~/MindrianOS-Plugin/dashboard/index.html                (dashboard HTML, live version)
  ~/MindrianOS-Plugin/dashboard/graph.json                (sample graph structure)
```

### Architecture + Vision (read for context)

```
MUST READ:
  ~/MindrianOS-Plugin/docs/EXPORT-VISION-BRIEF.md         (full vision brief, three tiers, examples)
  ~/MindrianOS-Plugin/CLAUDE.md                            (master architecture, tri-polar design)
```

### Demo Room (test against this)

```
TEST DATA -- Pancreatic cancer research room (complex case, 36 nodes):
  ~/demo-cancer-room/room/STATE.md                        (room state)
  ~/demo-cancer-room/room/graph.json                      (36 nodes, 39 edges, 7 layers)
  ~/demo-cancer-room/room/problem-definition/ROOM.md      (section identity)
  ~/demo-cancer-room/room/problem-definition/the-detection-gap.md
  ~/demo-cancer-room/room/problem-definition/patient-journey.md
  ~/demo-cancer-room/room/problem-definition/why-now.md
  ~/demo-cancer-room/room/problem-definition/DIAGNOSIS.md  (methodology artifact)
  ~/demo-cancer-room/room/literature/ROOM.md
  ~/demo-cancer-room/room/literature/key-papers.md
  ~/demo-cancer-room/room/literature/failed-approaches.md
  ~/demo-cancer-room/room/solution-design/ROOM.md
  ~/demo-cancer-room/room/solution-design/exosome-platform-concept.md
  ~/demo-cancer-room/room/funding-strategy/ROOM.md
  ~/demo-cancer-room/room/funding-strategy/opportunity-scan.md
  ~/demo-cancer-room/room/RED-TEAM-REPORT.md               (severity-rated red team)
  ~/demo-cancer-room/room/market-analysis/ROOM.md           (empty section)
  ~/demo-cancer-room/room/competitive-analysis/ROOM.md      (empty section)
  ~/demo-cancer-room/room/team-execution/ROOM.md            (empty section)
  ~/demo-cancer-room/room/clinical-pathway/ROOM.md          (empty section)

REFERENCE OUTPUTS (what the current generators produce -- improve on these):
  ~/demo-cancer-room/room/full-intelligence-map.html       (TARGET quality for graph view)
  ~/demo-cancer-room/room/dashboard.html                   (current dashboard)
  ~/demo-cancer-room/room/exports/pdac-full-export.html    (current export -- REPLACE)
  ~/demo-cancer-room/room/wiki.html                        (current wiki)
```

### Live Reference (fetch and study)

```
https://pws-website-wiki.vercel.app    (gold standard for visual quality)
```

---

## IMPLEMENTATION STEPS

### Step 1: Read everything
Read all files in the manifest. Understand the current architecture.

### Step 2: Extend generate-export.cjs
Keep it Node.js, zero npm dependencies. Add:
- Section discovery + classification
- Methodology artifact detection (check frontmatter for `methodology:`)
- Opportunity parsing
- Image discovery
- Key insight extraction from graph edges
- Conditional view availability computation
- Markdown-to-HTML rendering (simple: headers, bold, lists, links, code blocks)

### Step 3: Build the new template
Evolve export-template.html. Use the PWS website as visual reference. Include:
- MindrianOS frame (Tier 1)
- Tabbed/scrollable views (Tier 2): views grid, section cards, graph, doc hub
- Dynamic sections (Tier 3): methodology cards, insights, opportunities, visuals, quotes, team
- Intelligence map with full Cytoscape.js (match full-intelligence-map.html quality)

### Step 4: Test on three rooms
1. `~/demo-cancer-room/room/` -- complex room, 36 nodes, red team, grants, breakthroughs
2. `~/room/` -- existing production room, whatever state it's in
3. Empty room (create `mkdir -p /tmp/empty-room/room && echo "---\nroom_name: Test\nventure_stage: Unknown\n---" > /tmp/empty-room/room/STATE.md`) -- should produce minimal export with all gap indicators

### Step 5: Verify quality bar
- [ ] Looks as good as pws-website-wiki.vercel.app
- [ ] Works offline (open with file:// protocol)
- [ ] Deploys to Vercel with `npx vercel`
- [ ] Responsive (readable on mobile)
- [ ] Loads in under 2 seconds
- [ ] Single .html file, under 500KB (excluding base64 images)
- [ ] MindrianOS logo top-left, "Built with MindrianOS" footer
- [ ] Empty sections shown as gaps (dashed border, muted)
- [ ] Graph is interactive (drag, zoom, click, toggle layers)
- [ ] No hardcoded project-specific content

---

## CONSTRAINTS

- **Zero npm dependencies.** Node.js built-ins only (fs, path, child_process).
- **Single file output.** One .html file. No CSS files, no JS files, no asset folders.
- **Dark theme only.** #0D0D0D background. This is the MindrianOS brand signature.
- **Room is the schema.** Never hardcode section names, article titles, or project content. Discover everything from the room directory.
- **Gaps are information.** Empty sections render as gap cards (dashed border, muted, with starter questions). Never hide them.
- **Brand frame is mandatory.** MindrianOS logo + header + footer on every export, every project.
- **Cytoscape.js via CDN.** `https://unpkg.com/cytoscape@3.28.1/dist/cytoscape.min.js` -- the only external dependency. Consider bundling inline for --offline flag.
- **Google Fonts via CDN.** DM Serif Display, Source Sans 3, JetBrains Mono, Caveat. Degrade gracefully if offline.
- **No em-dashes.** Use `--` instead. Hard rule across all output.

---

## OUTPUT

The unified generator should be invoked as:

```bash
# Basic export (uses room/ in current directory)
node scripts/generate-export.cjs ./room

# Export with custom output path
node scripts/generate-export.cjs ./room ./output/my-export.html

# Export with images inlined as base64
node scripts/generate-export.cjs ./room --inline-images

# Export with Cytoscape bundled for offline use
node scripts/generate-export.cjs ./room --offline
```

Default output path: `room/exports/{YYYY-MM-DD}-{room-name-slugified}.html`

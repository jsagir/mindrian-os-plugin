# MindrianOS Export Vision Brief
## For UI/UX Designers + Dev Team

**Date:** 2026-03-31
**From:** Jonathan Sagir, Product
**To:** UI/UX Design + Frontend Engineering
**Reference:** Live demo at pws-website-wiki.vercel.app (PWS Data Room export)
**Demo room:** ~/demo-cancer-room/room/ (pancreatic cancer research -- full session with red team, grants, breakthrough angles, intelligence map)

---

## The One-Liner

`/mos:export` generates a **self-contained, deployable HTML hub** from ANY MindrianOS Data Room at ANY point in time. The structure adapts to what's in the room. MindrianOS branding frames it. The project's content fills it.

---

## What Stays Fixed (MindrianOS Frame)

These elements appear on EVERY export, regardless of project:

```
FIXED FRAME
│
├── TOP LEFT: MindrianOS logo (always present, links to mindrian.ai)
│
├── HEADER BAR
│   ├── Logo (left)
│   ├── Room Name + Venture Stage badge (center)
│   ├── Export date + version (right)
│   └── De Stijl accent bar (5-color strip: red, blue, yellow, green, orange)
│
├── STATS BAR (auto-computed from room state)
│   ├── Sections: {N}
│   ├── Articles: {N}
│   ├── Connections: {N} (graph edges)
│   ├── Gaps: {N} (empty sections)
│   └── Opportunities: {N} (if opportunity-bank exists)
│
├── FOOTER
│   ├── "Built with MindrianOS" + logo
│   ├── "From 0 to full Data Room in one session"
│   ├── De Stijl colored segment divider
│   └── Export timestamp + room version hash
│
└── DESIGN SYSTEM (inherited from MindrianOS brand)
    ├── Dark theme: #0D0D0D bg, #1A1A1A surfaces, #2A2A2A elevated
    ├── Typography: DM Serif Display (headlines), Source Sans 3 (body), JetBrains Mono (data)
    ├── De Stijl color vocabulary: Red (#CC0000), Blue (#0066CC), Yellow (#C8A43C), Green (#2D6B4A), Orange (#B5602A)
    └── Mondrian grid principles: asymmetric, bold borders, primary color blocks
```

---

## What Adapts Per Project (Dynamic Content)

Everything between the header and footer is **generated from the room's current state**. The export reads `room/`, `room/STATE.md`, `room/graph.json`, and every section/artifact at export time. Nothing is hardcoded.

### The Adaptive Structure

```
DYNAMIC CONTENT (adapts to room state)
│
├── VIEWS GRID (cards for each available view)
│   │
│   │  RULE: Only show views that have content to render.
│   │  An empty room gets fewer cards. A full room gets all of them.
│   │
│   ├── Wiki ................. IF room has 1+ articles
│   │   └── Wikipedia-style pages, sidebar nav, search, TOC
│   │
│   ├── Deck ................. IF room has 3+ populated sections
│   │   └── Auto-generated slide deck from section content
│   │
│   ├── Visual ............... IF room has methodology outputs (diagnose, hats, etc.)
│   │   └── Scenario matrices, heatmaps, funnels from methodology artifacts
│   │
│   ├── Diagrams ............. IF graph.json has 5+ edges
│   │   └── Architecture diagrams, taxonomy trees, relationship maps
│   │
│   ├── Intelligence Map ..... IF room has semantic edges (CONTRADICTS, VALIDATES, etc.)
│   │   └── Full Cytoscape.js graph with ALL layers: room + concepts +
│   │       competitors + breakthroughs + gaps + red team
│   │
│   ├── Doc Hub .............. ALWAYS (even 1 article is enough)
│   │   └── Browsable document reader for all room articles
│   │
│   └── Components ........... IF room has interactive elements (quizzes, calculators)
│       └── Standalone interactive components
│
├── SECTION CARDS (one per populated room section)
│   │
│   │  RULE: Each populated section gets a summary card.
│   │  Empty sections show as "gap" indicators (dashed border, muted).
│   │  Cards are colored by section (problem=red, market=gold, etc.)
│   │
│   ├── Problem Definition .... {N} articles, governing thought from MINTO.md
│   ├── Market Analysis ....... {N} articles, or "EMPTY -- gap"
│   ├── Solution Design ....... {N} articles, or "EMPTY -- gap"
│   ├── Competitive Analysis .. {N} articles, or "EMPTY -- gap"
│   ├── Team & Execution ...... {N} articles, or "EMPTY -- gap"
│   ├── Business Model ........ {N} articles, or "EMPTY -- gap"
│   ├── Funding Strategy ...... {N} articles, or "EMPTY -- gap"
│   ├── [Custom sections] ..... Any user-created sections appear here
│   └── ...
│
├── METHODOLOGY ARTIFACTS (if any methodology has been run)
│   │
│   │  RULE: Show cards for each methodology output filed in the room.
│   │  These are the "Larry touched this" artifacts.
│   │
│   ├── Diagnosis ............. /mos:diagnose output (problem classification)
│   ├── Red Team Report ....... /mos:challenge-assumptions or investor review
│   ├── Assumption Map ........ /mos:challenge-assumptions output
│   ├── System Map ............ /mos:analyze-systems output
│   ├── Competitive Landscape . /mos:dominant-designs output
│   ├── Personas .............. /mos:think-hats output (Six Hats perspectives)
│   ├── Thesis ................ /mos:build-thesis output
│   └── [Any other methodology artifact]
│
├── VISUAL ASSETS (if room has images, diagrams, or generated visuals)
│   │
│   │  RULE: Grid of all visual files in the room.
│   │  Categorized by type: illustrations, diagrams, brand assets.
│   │
│   ├── NanoBanana generated images
│   ├── Mermaid/SVG diagrams
│   ├── Screenshots
│   └── Brand assets
│
├── KEY INSIGHTS (auto-extracted from intelligence layer)
│   │
│   │  RULE: Pull the top 3-5 insights from:
│   │  - CONTRADICTS edges (things that conflict)
│   │  - CONVERGES themes (things appearing in 3+ sections)
│   │  - Red team CRITICAL findings
│   │  - Methodology governing thoughts
│   │
│   ├── Quote card style (Da Vinci aesthetic)
│   ├── Source attribution (which section/artifact)
│   └── Severity indicator (if from red team)
│
├── KNOWLEDGE GRAPH (interactive Cytoscape.js)
│   │
│   │  RULE: Always render from graph.json.
│   │  Show ALL layers present in the graph:
│   │
│   ├── Room sections + articles (core)
│   ├── Concepts (validated/critical)
│   ├── Competitors (if competitive analysis ran)
│   ├── Breakthrough angles (if cross-domain scan ran)
│   ├── Gaps (empty sections, missing data)
│   ├── Red team findings (if red team ran)
│   └── Layer toggles + edge filters (interactive)
│
├── OPPORTUNITIES (if opportunity-bank or funding-strategy has content)
│   │
│   │  RULE: Show scored grant/funding opportunities.
│   │  Sorted by relevance score.
│   │
│   ├── Score badge (0-100)
│   ├── Funder + Program name
│   ├── Amount + Deadline
│   ├── Relevance reasoning
│   └── Status (open/closed/urgent)
│
├── FEATURED QUOTE (if room has a governing thought or thesis statement)
│   │
│   │  RULE: Pull the single strongest statement from:
│   │  1. build-thesis governing thought
│   │  2. problem-definition MINTO.md governing thought
│   │  3. First complete article's core statement
│   │
│   └── Large display quote, Da Vinci card style
│
└── PARTNER/TEAM SECTION (if team-execution has content)
    ├── Team member cards (headshots, roles)
    ├── Advisor grid
    └── Partner logos
```

---

## How It Works Technically

### Export is a SNAPSHOT

```
/mos:export dashboard
         │
         ▼
    READ room/ at this moment
         │
         ├── STATE.md (room name, stage, section health)
         ├── graph.json (all nodes + edges)
         ├── Every section's ROOM.md + articles
         ├── Every methodology artifact
         ├── Every image/asset file
         └── opportunity-bank/ (if exists)
         │
         ▼
    GENERATE self-contained HTML
         │
         ├── Embed ALL content inline (no external deps except Cytoscape CDN)
         ├── Embed graph data as inline JSON
         ├── Embed images as base64 (or reference relative paths for served version)
         ├── Apply MindrianOS frame (logo, header, footer, design system)
         └── Conditionally render sections based on what exists
         │
         ▼
    OUTPUT single .html file
         │
         ├── Opens in any browser (file:// or http://)
         ├── Deployable to Vercel/Render (zero config)
         ├── Shareable as email attachment
         └── Works offline
```

### The Conditional Rendering Rule

```
IF section has content     --> render full card with articles
IF section is empty        --> render gap indicator (dashed, muted)
IF methodology was run     --> render methodology artifact card
IF graph has semantic edges --> render intelligence map view
IF opportunities exist     --> render opportunity table
IF images exist            --> render visual assets grid
IF team exists             --> render team/partner section
```

**Nothing appears that doesn't have data behind it.**
**Everything that has data appears automatically.**

---

## Comparison: PWS Website vs Generic Room Export

| Element | PWS Website (reference) | Generic Room Export |
|---------|------------------------|-------------------|
| Logo | PWS logo | **MindrianOS logo** (always) |
| Room name | "Problems Worth Solving" | **{room_name} from STATE.md** |
| Views grid | 7 fixed views | **N views, conditional on content** |
| Stats bar | Hardcoded counts | **Auto-computed from room state** |
| Visual assets | NanoBanana illustrations | **Whatever images are in the room** |
| Frameworks | 8 PWS frameworks | **Whatever methodologies were run** |
| Quotes | Aronhime quotes | **Governing thoughts from MINTO.md** |
| Opportunities | 8 NSF/BIRD grants | **Whatever /mos:opportunities found** |
| Partners | Innovation Authority, etc | **Whatever's in team-execution/** |
| Website mockup | 7-page PWS site plan | **NOT included (room-specific)** |
| Intelligence map | Not in PWS version | **NEW: full graph with all layers** |
| Red team | Not in PWS version | **NEW: severity-rated findings** |
| Footer | "Built with MindrianOS" | **"Built with MindrianOS" (always)** |

---

## The Cancer Research Demo as Example

Here's what `/mos:export` would generate for the PDAC room we just built:

```
PDAC EARLY DETECTION EXPORT
│
├── [MindrianOS logo]  Pancreatic Cancer Early Detection  [Problem Exploration]
├── Stats: 8 sections | 8 articles | 39 edges | 5 gaps | 12 grants
│
├── VIEWS (5 of 7 active)
│   ├── Wiki (8 articles)
│   ├── Doc Hub (all articles browsable)
│   ├── Diagrams (graph has 39 edges)
│   ├── Intelligence Map (semantic edges present)
│   └── [Deck grayed out -- needs 3+ populated sections]
│
├── SECTION CARDS
│   ├── Problem Definition .... 4 articles (strong)
│   ├── Literature ............ 2 articles (growing)
│   ├── Solution Design ....... 1 article (early)
│   ├── Funding Strategy ...... 1 article (opportunity scan)
│   ├── Market Analysis ....... EMPTY -- gap
│   ├── Competitive Analysis .. EMPTY -- gap
│   ├── Team & Execution ...... EMPTY -- gap
│   └── Clinical Pathway ...... EMPTY -- gap
│
├── METHODOLOGY ARTIFACTS
│   ├── Problem Diagnosis (from /mos:diagnose)
│   └── Red Team Report (4C/5H/4M/2L)
│
├── KEY INSIGHTS
│   ├── "GPC1 not replicated but used as capture target" (CRITICAL)
│   ├── "Competitive window claim is false -- 6+ active competitors" (CRITICAL)
│   └── "Multi-omics validated by 3 landmark papers" (VALIDATED)
│
├── KNOWLEDGE GRAPH (36 nodes, 39 edges, 7 layers)
│   ├── Room sections + articles
│   ├── Concepts: GPC1 (critical), Multi-Omics (validated), Diabetes Trigger
│   ├── Competitors: Grail, Biological Dynamics, PharisDx, Exact, InterVenn, ClearNote
│   ├── Breakthroughs: Microbiome, PAC-MANN, Two-Tier, Anomaly Detection, CRC Transfer
│   └── Gaps: No Preliminary Data, No Prospective, Confounders
│
├── OPPORTUNITIES (12 grants, scored)
│   ├── NCI PCDC U01 ......... 0.97, ~$4.5M/5yr, Jul 1 2026
│   ├── DOD PCARP Research .... 0.92, $1.1M/3yr, TBD
│   ├── Mark/AACR/Lustgarten . 0.91, $2M/team, Next cycle
│   └── ... (9 more)
│
├── FEATURED QUOTE
│   └── "There is no affordable, non-invasive screening tool that can
│        detect pancreatic cancer at Stage I. This gap kills ~47,000
│        Americans per year."
│        -- problem-definition/the-detection-gap.md
│
├── [No team section -- empty]
│
└── Built with MindrianOS | 2026-03-31 | De Stijl Intelligence
```

---

## Design Principles for the Team

1. **The room IS the content.** Export never invents data. It renders what exists.

2. **Empty is information.** Gap indicators (dashed borders, muted colors) tell the viewer where the blind spots are. Don't hide empty sections -- show them as intentional gaps.

3. **MindrianOS frames, project fills.** The logo, header, footer, design system, and stats bar are MindrianOS. Everything between them belongs to the project.

4. **Progressive disclosure.** View cards are the entry point. Each opens a full sub-view. The intelligence map is the deepest layer -- only power users need it.

5. **One file, zero dependencies.** The export must be a single .html file that works when double-clicked from a file explorer. Cytoscape.js CDN is the only external dependency (with a fallback for offline).

6. **Deployable in one command.** `cd exports && npx vercel` should work. No build step. No config files. Static HTML.

7. **Every export is a snapshot.** Running `/mos:export` twice produces two files reflecting two different room states. The room evolves; exports capture moments.

8. **De Stijl is the signature.** The Mondrian grid, primary color blocks, asymmetric layout, and bold borders are what make a MindrianOS export instantly recognizable. This is our brand fingerprint.

---

## Files to Reference

| What | Where |
|------|-------|
| Live PWS export (reference implementation) | https://pws-website-wiki.vercel.app |
| Cancer research demo room | ~/demo-cancer-room/room/ |
| Full intelligence map (new pattern) | ~/demo-cancer-room/room/full-intelligence-map.html |
| Current export generator | MindrianOS-Plugin/scripts/generate-export.cjs |
| Export template | MindrianOS-Plugin/dashboard/export-template.html |
| Dashboard generator | ~/scripts/generate-standalone-dashboard.py |
| Wiki generator | ~/scripts/generate-wiki.py |
| Graph builder | ~/scripts/build-room-graph.py |
| De Stijl design system spec | MindrianOS-Plugin/skills/design-system/SKILL.md |
| UI ruling system | MindrianOS-Plugin/skills/ui-system/SKILL.md |

---

## The Three Content Tiers

Every export has three tiers of content. The team MUST understand this distinction:

```
TIER 1: MINDRIANOS FRAME (identical on every export)
│   Logo, header, footer, stats bar, design system, "Built with MindrianOS"
│   This is the BRAND. Never changes. Never project-specific.
│
TIER 2: UNIVERSAL STRUCTURE (present on every export, content varies)
│   Views grid, section cards, knowledge graph, doc hub, gap indicators
│   The STRUCTURE is the same. The DATA inside comes from the room.
│   Every project has sections, articles, and a graph. The export
│   renders whatever is there.
│
TIER 3: PROJECT-SPECIFIC CONTENT (unique to each room, cannot be predicted)
│   This is where every project is different. Examples:
│
│   PWS Website room had:
│   ├── Framework deep-dives (8 Da Vinci cards) -- UNIQUE to PWS
│   ├── Website mockup pages (7 planned pages) -- UNIQUE to PWS
│   ├── Partner logos (Innovation Authority, Technion) -- UNIQUE to PWS
│   ├── Prof. Aronhime quotes -- UNIQUE to PWS
│   └── NanoBanana illustrations -- UNIQUE to PWS
│
│   Cancer Research room had:
│   ├── Red Team Report (4C/5H/4M/2L) -- UNIQUE to this project
│   ├── Competitor nodes (Grail, PharisDx, etc.) -- UNIQUE to this project
│   ├── Breakthrough angles (microbiome, PAC-MANN) -- UNIQUE to this project
│   ├── Grant opportunities (PCDC U01, PCARP) -- UNIQUE to this project
│   └── Key papers (Melo 2015, CancerSEEK) -- UNIQUE to this project
│
│   A SaaS startup room might have:
│   ├── Pricing model analysis -- UNIQUE
│   ├── User interview transcripts -- UNIQUE
│   ├── Competitor feature matrix -- UNIQUE
│   └── Cap table structure -- UNIQUE
```

**The key design challenge:** Tier 3 content is UNPREDICTABLE. The export generator cannot know in advance what a project will contain. It must:

1. **Discover** what's in the room (read all files, check all sections)
2. **Classify** each artifact (methodology output? image? custom content? meeting notes?)
3. **Render** using the appropriate card/view template
4. **Skip** anything it can't classify (graceful degradation, never crash)

Think of it like a CMS that has no schema. The room IS the schema. The export reads the room and figures out how to display it.

---

## What Needs Building

| Priority | What | Current State | Target |
|----------|------|---------------|--------|
| 1 | Unified export generator | 3 separate scripts (dashboard, wiki, export) | Single generator that produces the full hub |
| 2 | Conditional view rendering | Views are hardcoded | Views appear/hide based on room content |
| 3 | Intelligence map integration | Standalone HTML (new) | Embedded as a view in the main export |
| 4 | Methodology artifact cards | Not in export | Show all Larry-generated artifacts |
| 5 | Key insights extraction | Not in export | Auto-pull from CONTRADICTS, CONVERGES, red team |
| 6 | Opportunity table | Not in export | Render scored opportunities from funding-strategy/ |
| 7 | Image embedding | Relative paths | Base64 inline for single-file portability |
| 8 | Offline Cytoscape fallback | CDN only | Bundle Cytoscape.min.js inline if --offline flag |
| 9 | Export versioning | No versioning | Hash-based version in footer, diff between exports |

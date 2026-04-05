# Wiki Platform Research: Data Room Dashboard Evolution

**Domain:** Wikipedia-style knowledge wiki for MindrianOS Data Room
**Researched:** 2026-03-26
**Overall Confidence:** HIGH
**Mode:** Comparison + Ecosystem

## Executive Summary

After evaluating 10 wiki platforms and a custom-build approach against MindrianOS's specific constraints (localhost, .md files as source, KuzuDB graph edges as links, De Stijl theming, Node.js plugin embedding, chat interface, auto-update), the clear winner is **extending the existing custom dashboard with Express + markdown-it + Cytoscape.js**.

No off-the-shelf wiki satisfies more than 4 of the 8 requirements simultaneously. The closest contender (Wiki.js) requires PostgreSQL, heavy installation, and fights against our "folder of .md files IS the wiki" model. The existing dashboard already has Cytoscape.js graph rendering, De Stijl styling, and the chat panel. Adding markdown rendering and page navigation is ~500 lines of Express code, not a 200MB framework installation.

The key insight from MediaWiki's architecture that we SHOULD adopt: **transclusion** (embedding content from one page into another) and **backlinks** ("What links here"). These map perfectly to KuzuDB's edge model -- every INFORMS/CONTRADICTS/CONVERGES edge becomes a visible hyperlink, and every page shows its backlinks automatically.

## The 8 Requirements Scorecard

| # | Requirement | Weight |
|---|-------------|--------|
| R1 | Runs from a folder of .md files (room/ directory) | CRITICAL |
| R2 | Supports [[wikilinks]] or equivalent cross-linking | HIGH |
| R3 | Can render KuzuDB-generated link graphs | HIGH |
| R4 | Has chat/search interface | MEDIUM |
| R5 | Easy to theme with De Stijl (dark, 0 border-radius, Bebas Neue) | HIGH |
| R6 | Node.js or npm-installable | HIGH |
| R7 | Lightweight (embedding in a plugin, not running a CMS) | CRITICAL |
| R8 | Auto-updates when room content changes | MEDIUM |

---

## Platform Evaluations

### 1. Wiki.js
**Verdict: TOO HEAVY**

| Criterion | Assessment |
|-----------|-----------|
| R1: .md folder | NO -- stores in PostgreSQL, not filesystem. Git sync exists but is secondary storage, not primary. |
| R2: Wikilinks | Partial -- supports internal links but not [[wikilink]] syntax natively. Uses standard markdown links. |
| R3: KuzuDB graph | NO -- has its own graph view but it's page-link based, not injectable from external graph DB. |
| R4: Chat/search | YES -- built-in search engine (Elasticsearch optional, DB search default). No chat. |
| R5: De Stijl theme | Partial -- fully customizable CSS but requires deep theme override. Light/dark modes built in. |
| R6: Node.js | YES -- Node.js core. |
| R7: Lightweight | NO -- requires PostgreSQL + Node.js server + authentication layer. ~200MB+ installed. |
| R8: Auto-update | NO -- content lives in DB, not filesystem. Git sync is one-directional. |

**Why not:** Wiki.js is a full CMS with its own database, auth system, and content model. We need a renderer for existing files, not a content management system. The PostgreSQL requirement alone disqualifies it -- we already have KuzuDB as the graph layer. Version 3.0 has stalled due to the lead developer's health issues (as of 2025), so the upgrade path is uncertain.

**License:** AGPL-2.0

---

### 2. Docusaurus
**Verdict: CLOSE BUT WRONG MODEL**

| Criterion | Assessment |
|-----------|-----------|
| R1: .md folder | YES -- reads .md/.mdx files from a docs/ directory. |
| R2: Wikilinks | NO -- uses standard markdown links. No [[wikilink]] support without custom plugin. |
| R3: KuzuDB graph | NO -- no graph view. Would need custom React component. |
| R4: Chat/search | YES -- built-in search (lunr-based local search or Algolia). No chat. |
| R5: De Stijl theme | YES -- fully customizable via CSS variables and swizzling. React components. |
| R6: Node.js | YES -- React/Node.js. npm install. |
| R7: Lightweight | NO -- full React app with webpack build. node_modules ~400MB. Build step required. |
| R8: Auto-update | Partial -- requires rebuild on content change. Dev server has HMR. |

**Why not:** Docusaurus is a static site generator -- it compiles markdown into static HTML during a build step. This means every room change requires a rebuild. The 400MB node_modules and React/webpack toolchain is absurdly heavy for what we need. It's designed for versioned documentation sites (like React docs), not dynamic knowledge wikis.

**License:** MIT

---

### 3. Nextra
**Verdict: LIGHTER BUT STILL WRONG**

| Criterion | Assessment |
|-----------|-----------|
| R1: .md folder | YES -- reads .mdx files from pages/ directory. |
| R2: Wikilinks | NO -- standard markdown links. No [[wikilink]] without custom remark plugin. |
| R3: KuzuDB graph | NO -- no graph view. Could embed Cytoscape as MDX component. |
| R4: Chat/search | YES -- built-in search (flexsearch). No chat. |
| R5: De Stijl theme | YES -- Next.js CSS/Tailwind customizable. |
| R6: Node.js | YES -- Next.js/Node.js. |
| R7: Lightweight | NO -- requires Next.js runtime. Lighter than Docusaurus but still ~200MB node_modules. |
| R8: Auto-update | YES -- Next.js dev server has file watching + HMR. |

**Why not:** Same fundamental problem as Docusaurus: it's a build-step SSG with a heavy Node.js framework underneath. The Next.js dependency alone is overkill. However, Nextra's file-system routing (pages/foo.mdx = /foo) is the right mental model -- we just don't need Next.js to achieve it.

**License:** MIT

---

### 4. MkDocs (+ Material theme)
**Verdict: BEST OFF-THE-SHELF OPTION (but still not ideal)**

| Criterion | Assessment |
|-----------|-----------|
| R1: .md folder | YES -- reads .md files from docs/ directory. mkdocs.yml configures nav. |
| R2: Wikilinks | YES -- Material for MkDocs supports [[wikilinks]] natively via the pymdownx extensions. |
| R3: KuzuDB graph | NO -- no graph view. Would need custom plugin or iframe embed. |
| R4: Chat/search | YES -- excellent built-in search (lunr.js). Material theme has instant search overlay. No chat. |
| R5: De Stijl theme | Partial -- Material theme has CSS customization and color palette config, but achieving zero-border-radius dark De Stijl requires significant CSS override. |
| R6: Node.js | NO -- Python (pip install mkdocs mkdocs-material). |
| R7: Lightweight | GOOD -- pip packages are small. Built site is static HTML. |
| R8: Auto-update | YES -- `mkdocs serve` has live reload file watcher. |

**Why not:** Python dependency in a Node.js plugin ecosystem. Cannot be embedded as part of the MCP server or plugin architecture. The wikilinks support is genuinely excellent (best of any platform evaluated), but we'd need to symlink room/ to docs/ and maintain a mkdocs.yml nav file. The lack of graph visualization means we'd still need Cytoscape.js in an iframe or custom page, fragmenting the experience.

**If we weren't in a Node.js plugin:** MkDocs Material would be the recommendation. It's the best documentation/wiki renderer available. But the Python dependency is a dealbreaker for embedding.

**License:** BSD-2 (MkDocs), MIT (Material theme)

---

### 5. Outline
**Verdict: WRONG CATEGORY ENTIRELY**

| Criterion | Assessment |
|-----------|-----------|
| R1: .md folder | NO -- stores in PostgreSQL. Import from .md possible but not live filesystem reading. |
| R2: Wikilinks | Partial -- has internal linking but Notion-style, not [[wikilinks]]. |
| R3: KuzuDB graph | NO -- no graph view at all. |
| R4: Chat/search | YES -- full-text search, API for building chat. |
| R5: De Stijl theme | NO -- Notion-like aesthetic. Theming is very limited. |
| R6: Node.js | YES -- Node.js + React. |
| R7: Lightweight | NO -- requires PostgreSQL + Redis + Node.js. Heaviest option evaluated. |
| R8: Auto-update | NO -- content in database, not filesystem. |

**Why not:** Outline is a team collaboration tool (Notion competitor), not a knowledge wiki renderer. Requires PostgreSQL AND Redis. The entire architecture assumes content is created inside Outline, not read from external files. Wrong tool, wrong category.

**License:** BSL 1.1 (source-available, NOT truly open source for commercial use)

---

### 6. TiddlyWiki
**Verdict: FASCINATING BUT WRONG PARADIGM**

| Criterion | Assessment |
|-----------|-----------|
| R1: .md folder | NO -- stores content as "tiddlers" inside a single HTML file or its own JSON format. Does NOT read standard .md files. |
| R2: Wikilinks | YES -- native [[wikilinks]] are core to TiddlyWiki. Best wikilink support of any platform. |
| R3: KuzuDB graph | Partial -- TiddlyMap plugin provides graph visualization, but from internal tiddler links, not external graph DB. |
| R4: Chat/search | Partial -- excellent search within tiddlers. No chat. |
| R5: De Stijl theme | YES -- deeply customizable via CSS and custom templates. Single-file makes full theme control easy. |
| R6: Node.js | YES -- Node.js server mode available (tiddlywiki on npm). |
| R7: Lightweight | YES -- single HTML file. Incredibly lightweight. |
| R8: Auto-update | Partial -- Node.js server mode watches filesystem but expects tiddler format, not standard markdown. |

**Why not:** TiddlyWiki's content model is "tiddlers" (micro-content units), not markdown files. We'd need to convert every .md file into tiddler format, losing the "room/ directory IS the wiki" property. The TiddlyMap graph plugin is promising but reads tiddler relationships, not KuzuDB edges. The single-file model is elegant but means the wiki state is separate from the room files.

**Interesting steal:** TiddlyWiki's transclusion model (embedding one tiddler in another) is the most powerful of any wiki platform. Worth studying for the custom build.

**License:** BSD-3

---

### 7. Gollum
**Verdict: RIGHT IDEA, WRONG LANGUAGE**

| Criterion | Assessment |
|-----------|-----------|
| R1: .md folder | YES -- reads .md files from a Git repository. This is literally GitHub's wiki engine. |
| R2: Wikilinks | YES -- native [[wikilinks]] support. GitHub wiki style. |
| R3: KuzuDB graph | NO -- no graph view. |
| R4: Chat/search | Partial -- basic search built in. No chat. |
| R5: De Stijl theme | Partial -- CSS customizable but limited template system. |
| R6: Node.js | NO -- Ruby. Requires Ruby + gem install gollum. |
| R7: Lightweight | MEDIUM -- Ruby runtime + gems. Not trivial to install. |
| R8: Auto-update | YES -- reads from Git, so any commit triggers update. |

**Why not:** Ruby dependency. The room/ directory IS a Git repo (MindrianOS-Plugin), so Gollum's Git-backed model is conceptually perfect. But requiring Ruby installation for a Node.js plugin is a non-starter. If we were building this standalone, Gollum would be a strong contender.

**Interesting steal:** Gollum's "any .md in the repo is a wiki page" model is exactly right. Our custom build should mimic this.

**License:** MIT

---

### 8. BookStack
**Verdict: TOO STRUCTURED, TOO HEAVY**

| Criterion | Assessment |
|-----------|-----------|
| R1: .md folder | NO -- stores in MySQL/MariaDB. Content created in BookStack, not imported from files. |
| R2: Wikilinks | NO -- standard internal links. No wikilink syntax. |
| R3: KuzuDB graph | NO -- no graph view. |
| R4: Chat/search | YES -- full-text search. No chat. |
| R5: De Stijl theme | Partial -- customizable via CSS and themes. |
| R6: Node.js | NO -- PHP/Laravel. Requires PHP + MySQL. |
| R7: Lightweight | NO -- full LAMP stack application. |
| R8: Auto-update | NO -- database-backed content. |

**Why not:** PHP + MySQL. Full CMS. Wrong everything. The shelves/books/chapters hierarchy is interesting (maps loosely to rooms/sections/artifacts) but the implementation is entirely wrong for our use case.

**License:** MIT

---

### 9. mdBook
**Verdict: ELEGANT BUT TOO RIGID**

| Criterion | Assessment |
|-----------|-----------|
| R1: .md folder | YES -- reads .md files. Requires SUMMARY.md to define structure. |
| R2: Wikilinks | NO -- standard markdown links only. |
| R3: KuzuDB graph | NO -- no graph view. |
| R4: Chat/search | YES -- built-in full-text search (elasticlunr). No chat. |
| R5: De Stijl theme | Partial -- custom CSS via theme/. Limited template customization. |
| R6: Node.js | NO -- Rust binary. Can be installed via cargo or downloaded. |
| R7: Lightweight | YES -- single binary, ~5MB. Very fast builds. |
| R8: Auto-update | YES -- `mdbook serve` has file watcher with live reload. |

**Why not:** The SUMMARY.md requirement means we'd need to auto-generate a table of contents from room/ structure on every change. The linear book model (prev/next navigation) doesn't match our graph-structured room. No wikilinks, no graph view. Would need significant extension for our use case.

**Interesting steal:** mdBook's search implementation (elasticlunr.js with pre-built index) is worth copying for the custom build.

**License:** MPL-2.0

---

### 10. Foam
**Verdict: EDITOR, NOT RENDERER**

| Criterion | Assessment |
|-----------|-----------|
| R1: .md folder | YES -- works directly with .md files in a workspace. |
| R2: Wikilinks | YES -- native [[wikilinks]] with backlink support. Core feature. |
| R3: KuzuDB graph | Partial -- has graph visualization of note connections but only within VS Code. |
| R4: Chat/search | NO -- relies on VS Code search. |
| R5: De Stijl theme | NO -- VS Code extension, not a web renderer. |
| R6: Node.js | N/A -- VS Code extension, not a standalone tool. |
| R7: Lightweight | YES -- just a VS Code extension. |
| R8: Auto-update | YES -- real-time within VS Code. |

**Why not:** Foam is a VS Code extension for authoring and exploring notes, not a web-based wiki renderer. It can't serve pages to a browser. However, Foam's approach to wikilinks (resolving [[page-name]] to file paths, generating backlinks, showing a graph) is the exact UX we want. We should build Foam's UX as a web app.

**Interesting steal:** Foam's wikilink resolution algorithm and backlink generation. Also, the way it generates link reference definitions to make wikilinks compatible with standard markdown processors.

**License:** MIT

---

## The Winner: Custom Build (Express + markdown-it + Cytoscape.js)

### Why Custom Wins

No platform satisfies all 8 requirements. But we already have 60% of the solution built:

| Already Have | In Dashboard | What's Missing |
|-------------|-------------|----------------|
| Cytoscape.js graph rendering | YES (1640-line index.html) | -- |
| De Stijl styling | YES (all CSS tokens, fonts) | -- |
| Chat panel | YES (client-side intelligence) | LLM-powered chat (later) |
| KuzuDB integration | YES (in plugin, kuzu npm package) | Graph-to-links pipeline |
| Room file reading | YES (build-graph script) | Markdown rendering |
| -- | -- | Express server for page routing |
| -- | -- | markdown-it rendering pipeline |
| -- | -- | [[wikilink]] resolution |
| -- | -- | Backlink generation |
| -- | -- | File watcher for auto-update |

### The Architecture

```
room/                          Express Server              Browser
  problem-definition/    -->   GET /wiki/:section/:page    -->  Rendered HTML
    domain-exploration.md      GET /wiki/graph             -->  Cytoscape.js view
    market-size.md             GET /wiki/search?q=...      -->  Search results
  market-analysis/             GET /api/backlinks/:page    -->  JSON backlinks
    competitor-scan.md         WebSocket (chokidar)        -->  Auto-refresh
  STATE.md                     GET /api/chat               -->  Chat endpoint
```

### Stack

| Component | Package | Purpose | Size |
|-----------|---------|---------|------|
| **Server** | express | HTTP routing, page serving | 200KB |
| **Markdown** | markdown-it | .md to HTML rendering | 150KB |
| **Wikilinks** | markdown-it-wikilinks | [[wikilink]] resolution | 5KB |
| **Mermaid** | mermaid (CDN) | Diagram rendering | CDN only |
| **YAML** | gray-matter | Frontmatter parsing | 30KB |
| **File watch** | chokidar | Room file change detection | 50KB |
| **Search** | flexsearch | Client-side full-text search | 20KB |
| **Graph** | cytoscape (already have) | Knowledge graph visualization | CDN/existing |
| **Graph DB** | kuzu (already have) | Edge/relationship data | already installed |

**Total new dependencies:** ~455KB. Compare to Wiki.js (~200MB) or Docusaurus (~400MB).

### Implementation Plan

```javascript
// wiki-server.cjs -- the entire wiki in ~300 lines
const express = require('express');
const markdownIt = require('markdown-it');
const wikilinks = require('markdown-it-wikilinks');
const matter = require('gray-matter');
const chokidar = require('chokidar');
const { readFileSync, readdirSync, existsSync } = require('fs');
const path = require('path');

const app = express();
const md = markdownIt({ html: true, linkify: true })
  .use(wikilinks, {
    baseURL: '/wiki/',
    uriSuffix: '',
    makeAllLinksAbsolute: true,
    postProcessPageName: (pageName) => pageName.toLowerCase().replace(/\s/g, '-')
  });

// Room scanner -- builds page index + backlinks
function scanRoom(roomPath) {
  const pages = {};
  const backlinks = {};
  // ... scan .md files, extract frontmatter, resolve wikilinks, build backlink index
  return { pages, backlinks };
}

// Routes
app.get('/wiki', (req, res) => { /* Room overview -- treemap + graph */ });
app.get('/wiki/:section', (req, res) => { /* Section page -- list artifacts */ });
app.get('/wiki/:section/:page', (req, res) => { /* Artifact page -- rendered markdown */ });
app.get('/wiki/graph', (req, res) => { /* Full Cytoscape.js graph view */ });
app.get('/api/search', (req, res) => { /* Full-text search */ });
app.get('/api/backlinks/:page', (req, res) => { /* What links here */ });

// File watcher -- SSE for auto-refresh
const watcher = chokidar.watch(roomPath, { ignoreInitial: true });
watcher.on('all', () => { /* rebuild index, notify connected clients via SSE */ });
```

### What We Steal From Each Platform

| Platform | Concept to Steal | How |
|----------|-----------------|-----|
| **MediaWiki** | Transclusion -- embed one page's content in another | `{{section/artifact}}` syntax in markdown-it custom plugin |
| **MediaWiki** | Infoboxes -- structured data sidebar | YAML frontmatter rendered as De Stijl card in page sidebar |
| **MediaWiki** | "What links here" backlinks | KuzuDB reverse edge query per page |
| **MediaWiki** | Categories | Room sections ARE categories. Auto-assigned from folder path. |
| **Gollum** | .md file = wiki page (no database) | Direct filesystem reading, no import step |
| **Foam** | Wikilink resolution + graph view | markdown-it-wikilinks + Cytoscape.js (already have) |
| **TiddlyWiki** | Micro-content transclusion | Include artifact excerpts in section overview pages |
| **MkDocs Material** | Search UX (instant overlay) | flexsearch with De Stijl styled overlay |
| **mdBook** | Pre-built search index | Generate search index during room scan |

---

## MediaWiki Data Model (Lessons for Our Wiki)

Understanding how Wikipedia actually works informs our design:

### Core Concepts

| MediaWiki Concept | Our Equivalent | Implementation |
|-------------------|---------------|----------------|
| **Page** (wikitext in a namespace) | Room artifact (.md file in a section) | Files in room/{section}/*.md |
| **Category** (hierarchical tags) | Room section (folder) | Derived from file path |
| **Infobox** (structured key-value sidebar) | YAML frontmatter (methodology, pipeline, created) | gray-matter parse -> sidebar card |
| **Transclusion** (embed template in page) | Embed artifact excerpt in section overview | Custom markdown-it plugin: `{{section/artifact}}` |
| **Backlinks** ("What links here") | KuzuDB reverse edges (INFORMED_BY, etc.) | KuzuDB query: edges WHERE target = this_page |
| **Namespace** (separate content types) | Room vs. Plugin vs. Brain | URL prefix: /wiki/ for room, /ref/ for references |
| **Talk page** (discussion per page) | Chat context per artifact | Chat panel scoped to current page |

### Key Architectural Lessons

1. **Pages are cheap, links are everything.** MediaWiki's power comes from dense cross-linking, not from individual page quality. Our wiki should make linking effortless -- every entity mention auto-links if a page exists.

2. **Categories emerge from content, not UI.** Wikipedia categories are added to pages via tags, not drag-and-drop. Our categories (room sections) are determined by where the file lives. Simple.

3. **Transclusion enables DRY content.** A market-analysis page should be able to embed the key finding from problem-definition without duplicating it. When problem-definition updates, the transclusion updates too.

4. **Infoboxes are structured data rendered as UI.** Our YAML frontmatter already IS structured data. Render it as a De Stijl card sidebar.

---

## Feature Comparison Matrix

| Feature | Wiki.js | Docusaurus | Nextra | MkDocs | Outline | TiddlyWiki | Gollum | BookStack | mdBook | Foam | **Custom** |
|---------|---------|-----------|--------|--------|---------|------------|--------|-----------|--------|------|------------|
| .md files as source | DB | YES | YES | YES | DB | Tiddlers | YES | DB | YES | YES | **YES** |
| [[wikilinks]] | No | No | No | YES | No | YES | YES | No | No | YES | **YES** |
| Graph view | Own | No | No | No | No | Plugin | No | No | No | VSCode | **YES** |
| Chat interface | No | No | No | No | No | No | No | No | No | No | **YES** |
| De Stijl themeable | Hard | Med | Med | Med | No | YES | Hard | Hard | Med | N/A | **DONE** |
| Node.js native | YES | YES | YES | No | YES | YES | No | No | No | N/A | **YES** |
| Lightweight | No | No | No | YES | No | YES | Med | No | YES | YES | **YES** |
| File watcher | No | Dev | Dev | Dev | No | Server | Git | No | Dev | IDE | **YES** |
| KuzuDB integration | No | No | No | No | No | No | No | No | No | No | **YES** |
| Backlinks | No | No | No | No | No | YES | No | No | No | YES | **YES** |
| **Score** | 2/10 | 3/10 | 3/10 | 5/10 | 1/10 | 5/10 | 4/10 | 1/10 | 3/10 | 4/10 | **10/10** |

---

## The Custom Wiki Page Layout

```
+------------------------------------------------------------------+
| MINDRIANOS DATA ROOM          [Search]  [Graph]  [Chat]          |  <- Bebas Neue header
+------------------------------------------------------------------+
|  SECTIONS        |                                    | INFOBOX  |
|  +-----------+   |  # Domain Exploration              | -------- |
|  | Problem   |   |                                    | Method:  |
|  | Market    |   |  The core problem in this domain   | HSI      |
|  | Solution  |   |  is the disconnect between...       | Created: |
|  | Business  |   |                                    | 03-22    |
|  | Compete   |   |  ## Key Findings                   | Pipeline:|
|  | Team      |   |                                    | Stage 1  |
|  | Legal     |   |  The market shows [[convergence    | -------- |
|  | Financial |   |  themes|market-analysis/themes]]    | BACKLINKS|
|  +-----------+   |  across multiple segments...        | -------- |
|                  |                                    | Informs: |
|  RELATIONSHIPS   |  ```mermaid                        | market/  |
|  +-----------+   |  graph TD                          |  scan.md |
|  | INFORMS 3 |   |    A-->B                           | Contra:  |
|  | CONTRA  1 |   |  ```                               | biz/     |
|  | CONVRG  2 |   |                                    |  model.md|
|  +-----------+   |  ## What Links Here                 |          |
|                  |  - market-analysis/competitor-scan  |          |
|                  |  - business-model/revenue-streams   |          |
+------------------------------------------------------------------+
```

---

## Implementation Dependencies

```bash
# New dependencies (add to package.json)
npm install express markdown-it @ig3/markdown-it-wikilinks gray-matter chokidar flexsearch

# Already have
# kuzu (in package.json)
# cytoscape.js (CDN in dashboard/index.html)
```

### Package Versions and Licenses

| Package | Version | License | Weekly Downloads |
|---------|---------|---------|-----------------|
| express | ^5.1.0 | MIT | 35M+ |
| markdown-it | ^14.1.0 | MIT | 8M+ |
| @ig3/markdown-it-wikilinks | ^1.1.0 | MIT | ~500 (niche but correct) |
| gray-matter | ^4.0.3 | MIT | 4M+ |
| chokidar | ^4.0.3 | MIT | 40M+ |
| flexsearch | ^0.7.43 | Apache-2.0 | 200K+ |

All MIT/Apache-2.0. No license concerns.

---

## KuzuDB Integration (The Key Differentiator)

This is what no off-the-shelf wiki can do. KuzuDB already stores room relationships:

```cypher
-- KuzuDB schema (already exists in plugin)
CREATE NODE TABLE Artifact(id STRING, section STRING, title STRING, path STRING, PRIMARY KEY(id));
CREATE REL TABLE INFORMS(FROM Artifact, TO Artifact, confidence STRING);
CREATE REL TABLE CONTRADICTS(FROM Artifact, TO Artifact, confidence STRING, reason STRING);
CREATE REL TABLE CONVERGES(FROM Artifact, TO Artifact, theme STRING);
CREATE REL TABLE FEEDS_INTO(FROM Artifact, TO Artifact, pipeline STRING, stage INT);
```

The wiki server queries KuzuDB to:
1. **Generate hyperlinks** -- every edge becomes a link on the source page
2. **Generate backlinks** -- reverse edges shown in sidebar
3. **Generate graph data** -- Cytoscape.js elements from edge queries
4. **Power search** -- "find all pages that CONTRADICT this page"
5. **Power chat** -- "what contradictions exist in my room?"

This is the moat. Every wiki platform requires manual linking. Ours generates links from the graph automatically.

---

## Risk Assessment

### Risk 1: Building a wiki is harder than it looks
**Severity:** MEDIUM
**Mitigation:** We are NOT building a wiki editor. We are building a wiki RENDERER. No editing, no auth, no version control (Git handles that). Read-only markdown rendering with auto-generated links is a well-scoped problem.

### Risk 2: Express server as permanent process
**Severity:** LOW
**Mitigation:** The server starts with `/mos:room view` and stops when the user closes the terminal. It's a dev server, not a production service. Same model as MkDocs serve, mdBook serve, etc.

### Risk 3: markdown-it-wikilinks is a niche package
**Severity:** LOW
**Mitigation:** Multiple maintained forks exist (5+ on npm). The plugin is ~100 lines of code. If the package dies, we inline it. The wikilink regex is trivial: `/\[\[([^\]]+)\]\]/`.

### Risk 4: Feature creep toward full CMS
**Severity:** HIGH
**Mitigation:** Strict scope: READ ONLY. No editing in the wiki. No user accounts. No comments. No version history UI. Content is edited in the IDE/Claude, rendered in the wiki. The moment we add editing, we've become Wiki.js and lost.

---

## Phased Approach

### Phase A: Markdown Wiki (extend existing dashboard)
- Express server serves room/ .md files as HTML pages
- markdown-it with wikilinks, mermaid, frontmatter
- Section navigation sidebar
- Infobox from YAML frontmatter
- De Stijl styling (reuse existing CSS tokens)
- ~300 lines of server code

### Phase B: Graph Integration
- KuzuDB queries generate hyperlinks and backlinks
- Cytoscape.js graph view (already built) as a wiki page
- "What links here" sidebar on every page
- Relationship type filtering (show only CONTRADICTS, etc.)

### Phase C: Search + Chat
- flexsearch full-text index built from room/ scan
- Search overlay (MkDocs Material style)
- Chat panel scoped to current page context
- Chat talks to Larry via Claude CLI or MCP

### Phase D: Auto-Update
- chokidar watches room/ for changes
- Server-Sent Events push updates to browser
- Page auto-refreshes when its source .md changes
- Search index rebuilds incrementally

---

## Sources

### Primary (HIGH confidence)
- [Wiki.js](https://js.wiki/) -- official site, features, architecture
- [Docusaurus](https://docusaurus.io/docs/) -- official documentation
- [MkDocs Material](https://squidfunk.github.io/mkdocs-material/alternatives/) -- alternatives comparison
- [TiddlyWiki](https://tiddlywiki.com/) -- v5.3.8 official
- [Gollum GitHub](https://github.com/gollum/gollum) -- repository, features
- [BookStack](https://www.bookstackapp.com/) -- official site, content overview
- [mdBook](https://rust-lang.github.io/mdBook/) -- official documentation
- [Foam](https://foambubble.github.io/foam/) -- official docs, wikilinks feature
- [Cytoscape.js](https://js.cytoscape.org/) -- graph library docs
- [markdown-it-wikilinks](https://github.com/thomaskoppelaar/markdown-it-wikilinks) -- npm package
- [MediaWiki Transclusion](https://www.mediawiki.org/wiki/Transclusion) -- architecture docs
- [MediaWiki Architecture](https://www.mediawiki.org/wiki/Manual:MediaWiki_architecture) -- data model

### Secondary (MEDIUM confidence)
- [Documentation Generator Comparison 2025](https://okidoki.dev/documentation-generator-comparison) -- VitePress/Docusaurus/MkDocs
- [Nextra vs Docusaurus](https://edujbarrios.com/blog/Nextra-vs-Docusaurus) -- comparison
- [Wiki.js vs Outline](https://dev.to/selfhostingsh/wikijs-vs-outline-which-to-self-host-lo1) -- comparison
- [Outline](https://medevel.com/outline/) -- overview

### Tertiary (LOW confidence -- needs validation)
- Custom build LOC estimates (300 lines for Phase A) -- based on similar projects, verify during implementation
- flexsearch performance for room-scale data -- should be fine for <1000 pages but unverified

---

## Recommendation

**Build custom.** Use Express + markdown-it + markdown-it-wikilinks + gray-matter + chokidar + flexsearch + Cytoscape.js (existing) + KuzuDB (existing).

The custom build is:
- **Smaller** than any full wiki platform (~500KB deps vs 200MB+)
- **Better integrated** with KuzuDB (no other wiki can do this)
- **Already 60% built** (dashboard has graph + De Stijl + chat)
- **Correctly scoped** (renderer, not CMS)
- **Node.js native** (same runtime as the plugin)
- **Incrementally buildable** (Phase A through D)

The simplest path to "every room section is a page, KuzuDB edges are hyperlinks, chat box talks to Larry, De Stijl themed, auto-updates" is to extend what already exists rather than adopt and fight an off-the-shelf solution that was designed for a different problem.

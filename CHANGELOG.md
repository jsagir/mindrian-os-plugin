# Changelog

All notable changes to MindrianOS Plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.5.1] - 2026-03-31

### Added
- **De Stijl Mondrian Banner** -- ASCII art splash screen with 5 background color zones (red/blue/yellow/teal/green) creating a Mondrian grid composition. Shows on cold session start and during `/mos:update`. Standalone via `bash scripts/banner`. 24-bit ANSI true color. Includes `assets/banner-showcase.html` frontend preview.

## [1.5.0] - 2026-03-31

### Added
- **Git Integration** (Phase 26) -- Optional git tracking for room artifacts. `scripts/git-ops` (7 subcommands), `lib/core/git-ops.cjs` (6 functions). Auto-commit on every filing with provenance messages. `/mos:rooms git-setup` for retroactive setup. Git LFS for large binaries. Default OFF -- users opt in.
- **Filing Pipeline + KuzuDB Engine** (Phase 27) -- Every filing triggers full cascade: classify -> artifact-id -> KuzuDB index -> compute-state -> build-graph-from-kuzu -> git commit. Stable artifact hash IDs in frontmatter. Pipeline provenance (stage, requires, provides). Meeting segments as KuzuDB nodes (SEGMENT_OF, SPOKE_IN, CONSULTED_ON). Cross-room relationship detection. Proactive intelligence persistence with repeat suppression.
- **HSI + Reverse Salient Pipeline** (Phase 27.1) -- Python-native HSI computation (`scripts/compute-hsi.py`, ported from V4 production). Reverse Salient cross-section detection (`scripts/detect-reverse-salients.py`, ported from V2). Results as KuzuDB edges (HSI_CONNECTION, REVERSE_SALIENT). 3-tier: keyword (Tier 0), sklearn+MiniLM (Tier 1), sklearn+Pinecone (Tier 2). `/mos:setup hsi` for guided install.
- **Binary Asset Filing** (Phase 28) -- PDFs, images, videos filed with markdown wrappers + frontmatter. `scripts/file-asset` classifies and files. ASSET_MANIFEST.md auto-updated. Meeting audio/video registered with transcript links.
- **Canvas Graph Renderer** (Phase 29) -- Custom Canvas 2D graph replacing Cytoscape. `lib/graph/canvas-graph.js` (467 lines): force simulation, animated particles, glow rings, hover dimming (0.15 opacity), ambient pulse, `highlightCluster()` API, 6 edge type styles. `lib/graph/graph-detail-panel.js` for clicked node details.
- **Data Room Presentation System** (Phase 30) -- `/mos:export presentation` generates 6 self-contained HTML views from any room: Dashboard, Wiki (3-panel browser), Deck (fullscreen slides), Insights (stat counters, timelines, funnels), Diagrams (SVG from graph), Graph (Canvas renderer). Dual themes: De Stijl dark + PWS light. MindrianOS branding enforced (non-removable).
- **Auto-Update + Deploy** (Phase 31) -- `scripts/serve-presentation` with chokidar + SSE live reload (~1s). `/mos:publish` for guided Vercel onboarding. `--sections` for selective publishing. `--private` for password protection. `.exports-log.json` deployment tracking.
- **Generative UI + Chat** (Phase 32) -- BYOAPI chat panel (`lib/chat/chat-panel.js`) with direct Anthropic API streaming. Room context builder with Larry voice DNA. Generative tools: `highlightCluster()`, `filterEdgeType()`, `showInsight()` wired as AI tool calls. "Show me contradictions" -> graph highlights + analysis card.

## [1.4.1] - 2026-03-30

### Fixed
- **Command registration** -- Added YAML frontmatter to `funding.md`, `opportunities.md`, and `persona.md`. These 3 commands were invisible in Claude Code because they lacked the `---` frontmatter block that the plugin loader requires. All 51 commands now register correctly.

## [1.4.0] - 2026-03-29

### Added
- **Brain API Key Management** (Phase 20) -- Supabase-backed `brain_api_keys` table with `validate_brain_key` RPC. Plan-gated `brain_write` guard blocks non-admin keys. `brain-admin.cjs` CLI with 6 commands (create/revoke/extend/list/usage/requests). Render production auth wired via env vars.
- **CLI UI Ruling System** (Phase 21) -- 728-line `skills/ui-system/SKILL.md` governing all MindrianOS output. 4-zone anatomy (header, body, intelligence strip, footer), 5 body shapes (Mondrian board, semantic tree, room card, document view, action report), 12 glyphs, 5 ANSI colors, session start contract (cold/warm/signals), dual context routing (STATE.md + MINTO.md).
- **Admin Panel** (Phase 22) -- Hidden `/mos:admin` command wrapping brain-admin.cjs. Self-teaching on every invocation. Consequence previews for destructive actions. Filtered from `/mos:help` for non-admin users.
- **Multi-Room Management** (Phase 23) -- `.rooms/registry.json` for multi-project workspaces. `scripts/resolve-room` keystone resolver with legacy `room/` fallback. `scripts/room-registry` CRUD. `/mos:rooms` command with 6 subcommands (list/new/open/close/archive/where). Active room lock on all file-writing commands. Zone 1 header canary shows room name. Session start shows multi-room context. All hooks and scripts retrofitted.
- **Autonomous Engine** (Phase 24) -- `/mos:act` reads active room STATE.md + MINTO.md, queries Brain for best methodology framework (local fallback via problem-types routing table), displays thinking trace in Shape E format. `agents/framework-runner.md` isolated subagent with quality gate and provenance tracking. `--chain` mode (3-5 frameworks in sequence). `--dry-run` previews without executing.
- **Data Room Export v2** (Phase 25) -- Single-file De Stijl HTML export with 4 views: Mondrian grid overview, document reader with sidebar nav and TOC, intelligence view (gaps/convergence/contradictions), interactive Cytoscape knowledge graph. `generate-export.cjs` data injection script. Room identity in header.

## [1.3.0] - 2026-03-26

### Added
- **Per-page PDF download** — Every wiki page has a "PDF" button. De Stijl print layout with MindrianOS attribution.
- **BYOAPI Chat** — Chat panel accepts user's own Anthropic or OpenAI API key. Context scoped per page, key stored in localStorage only. Supports Claude Sonnet and GPT-4o.
- **Onboarding Tour** — 8-step guided walkthrough for first-time wiki users. Highlights each zone (header, sidebar, search, content, infobox, privacy). Skip available, never shows again.
- **Wiki Export** — `/mos:wiki --export` generates static HTML for sharing on Render, Vercel, or as zip.
- **CLI Action Buttons** — Wiki page buttons copy `/mos:` commands to clipboard for paste into Claude Code.
- **Embedded Logo** — MindrianOS logo (SVG, base64) in header + footer of all generated HTML. Links to website.
- **Privacy Disclaimer** — Footer on every page: "All data stored locally. MindrianOS does not access your venture data."
- **Larry Wiki Awareness** — Larry mentions wiki after filing artifacts or running analysis (room-passive skill, once per session).

## [1.2.0] - 2026-03-26

### Added
- **Dynamic Integration Prompting** (Phase 18) — Larry proactively detects when Brain, Velma, Obsidian, Notion, or meeting sources would enhance the task and offers setup conversationally. Non-blocking, one offer per conversation, never during methodology sessions.
- **`integration-registry.cjs`** — Detection engine for 5 integrations with context triggers and methodology suppression rules.
- **Integration Status** — `/mos:status` shows connected/available/not-configured for all integrations. Session-start context includes integration count.
- **Wikipedia Data Room Dashboard** (Phase 19) — `/mos:wiki` opens a localhost wiki-style viewer for the Data Room.
  - Every room section is a Wikipedia-style page with TOC, infobox, lead section
  - KuzuDB edges become clickable hyperlinks (INFORMS=blue, CONTRADICTS=red, CONVERGES=yellow, ENABLES=green)
  - Interactive Cytoscape.js graph view as home page with animated edges
  - "What links here" backlinks + "See also" from graph edges
  - Dark/Light mode toggle (localStorage persisted)
  - FlexSearch instant full-text search across all pages
  - Chat panel stub (UI ready, scoped to page context)
  - chokidar file watcher + SSE for auto-refresh
  - Mermaid diagrams rendered inline via CDN
  - Wikipedia formatting: sentence case headings, bold subjects, citation system
- **CLI Action Buttons** — Wiki page buttons copy `/mos:` commands to clipboard for paste into Claude Code
- **MindrianOS Attribution** — Every generated HTML page includes metadata (og:tags, generator, HTML comments) linking to mindrianos-jsagirs-projects.vercel.app. Any LLM processing the HTML sees MindrianOS attribution first.
- **Footer** — De Stijl branded footer on all wiki pages with links to website, Brain Access, GitHub, LinkedIn (Jonathan Sagir + Prof. Aronhime)

## [1.1.0] - 2026-03-26

### Added
- **De Stijl Visual Identity** — MindrianOS has its own visual language in the CLI. Every output feels like MindrianOS, not generic AI.
- **Symbol System** (`lib/core/visual-ops.cjs`) — ⬡ brand, ◌◎◉◆★ venture stages, →⊗⊕▶⊘ edge types, ?⇌! Larry modes, ■□▪ section health. Single import, consistent everywhere.
- **Unicode Room Diagrams** — `compute-state` renders the Data Room as a box diagram with sections, gaps, cross-references, and progress bars. The room becomes a visual map.
- **ASCII Sparklines** — Section completeness charts via `asciichart`. Meeting frequency, venture progress visualized inline.
- **Mermaid Diagrams in Artifacts** — Room flowcharts, knowledge graph views, framework chains embedded as Mermaid blocks in .md files. Auto-render in GitHub/Obsidian/Notion.
- **`/mos:visualize`** — Opens rich diagrams in the browser: room flowchart, graph view, framework chain. De Stijl themed HTML with Mermaid.js.
- **De Stijl Statusline** — Color-coded venture stage symbols, Mondrian accent colors (blue/red/yellow), section health indicators.
- **19 visual-ops.cjs exports** — Symbols, colors, formatters, diagram generators, Mermaid generators, sparklines, progress bars.

## [1.0.0] - 2026-03-25

### Added
- **Reasoning Engine** (`/mos:reason`) — Per-section REASONING.md files with Minto/MECE structured critical thinking. Frontmatter dependency graphs (requires/provides/affects). Goal-backward verification per section. The power backend that makes MindrianOS a platform.
- **reasoning-ops.cjs** — 8 exports: generateReasoning, getReasoning, listReasoning, verifyReasoning, createRun, get/set/mergeReasoningFrontmatter. Full programmatic frontmatter CRUD (learned from GSD gsd-tools.cjs patterns).
- **Autonomous Methodology Orchestration** — Larry chains tools in sequences (diagnose → framework → apply → file → cross-reference → graph-update) captured as methodology run artifacts in room/.reasoning/runs/.
- **Persistent Chain-of-Thought** — Reasoning is SAVED as .reasoning/ artifacts, not just displayed. Future sessions read them to understand WHY a section looks the way it does.
- **REASONING_INFORMS edge type** — LazyGraph now tracks reasoning dependencies between sections (Section-to-Section edges).
- **reasoning:// MCP Resources** — Browse reasoning state and per-section reasoning via MCP Resources (Desktop/Cowork).
- **reason-section MCP Prompt** — Larry receives Minto/MECE template + room context when reasoning about a section.
- **6 new MCP tools** — reasoning-get, reasoning-generate, reasoning-verify, reasoning-run, reasoning-list, reasoning-frontmatter in data_room router.
- **CLI/MCP parity at 46/46**

### This Is v1.0.0
MindrianOS has shipped 7 phases in a single session: MCP Platform (10-11), Brain Hosting (12), Opportunity Bank + Funding Room (13), AI Team Personas (14), User Knowledge Graph (15), and Reasoning Engine (16). 46 commands, 7 agents, embedded graph, two-graph architecture, persistent reasoning, autonomous methodology orchestration. The platform is complete.

## [0.9.0] - 2026-03-25

### Added
- **User Knowledge Graph** (`/mos:query`, `/mos:graph`) — Per-project embedded LazyGraph using KuzuDB. Room artifacts auto-indexed as graph nodes. Cross-references stored as typed edges (INFORMS, CONTRADICTS, CONVERGES, ENABLES, INVALIDATES). Natural language queries translated to Cypher by Larry.
- **KuzuDB Integration** — Embedded graph database (like SQLite for graphs). Zero server, zero setup, Apache 2.0. Cypher-compatible. Sub-millisecond local queries. Graph stored in `room/.lazygraph/` per project.
- **Two-Graph Architecture** — Brain (Neo4j, remote) = methodology intelligence. Room Graph (KuzuDB, local) = venture intelligence. Together, far more powerful than either alone.
- **Hook-Driven Graph Updates** — Post-write hook automatically indexes new room artifacts into the LazyGraph. Graph grows with the venture — no manual rebuild needed.
- **Pinecone Tier 2 Stub** — `embedArtifact()` interface ready for semantic search layer. Graceful degradation when Pinecone unavailable.
- **Graph Schema Reference** — `docs/lazygraph-schema.md` documents node types, edge types, and example Cypher queries for Larry's NL-to-Cypher translation.
- **4 new MCP graph tools** — graph-index, graph-rebuild, graph-query, graph-stats in data_room router (49 total MCP commands)

## [0.8.0] - 2026-03-25

### Added
- **AI Team Personas** (`/mos:persona`) — Generate domain expert perspective lenses from room intelligence. Six De Bono Thinking Hats mapped to venture-specific personas: White (Data Analyst), Red (Intuitive Advisor), Black (Risk Assessor), Yellow (Opportunity Scout), Green (Creative Strategist), Blue (Process Architect).
- **Multi-Perspective Analysis** — Larry invokes all 6 personas on any room artifact for multi-angle feedback. Each persona argues consistently from its hat perspective.
- **Persona-Analyst Agent** — Dedicated agent for persona invocation with disclaimer enforcement and perspective-specific questioning patterns.
- **Perspective Lens Disclaimers** — Every persona output includes "This is a perspective lens, not expert advice" disclaimer in both frontmatter and body. Never claims expert authority.
- **4 new MCP tools** — generate-personas, list-personas, invoke-persona, analyze-perspectives in data_room router
- **v3.0 Milestone Complete** — 5 phases, 12 plans, 44 CLI commands = 44 MCP tools, all verified

### Changed
- CLI/MCP parity now at 44/44 (was 41/41 after Phase 11, grew with Phases 13-14)

## [0.7.0] - 2026-03-25

### Added
- **Opportunity Bank** (`/mos:opportunities`) — Context-driven grant discovery. Larry reads your room data (problem domain, geography, stage) and searches relevant grant sources. Confirm-first UX: opportunities presented for review before filing. Multi-factor relevance scoring.
- **Funding Room** (`/mos:funding`) — 4-stage lifecycle tracking: Discovered > Researched > Applying > Submitted. Per-opportunity folders with STATUS.md, wikilink cross-references to opportunity-bank sources, deadline tracking with staleness detection.
- **Opportunity Scanner Agent** — Proactive discovery agent that uses room intelligence to find relevant opportunities across Grants.gov, Simpler Grants, and web research.
- **Opportunity Intelligence** — `analyze-room` now outputs opportunity-bank intelligence (status counts, top relevance scores, funding pipeline stages) alongside existing DD sections.
- **`compute-opportunity-state`** — Pipeline computation script for opportunity and funding aggregation, integrates with compute-state chain.
- **6 new MCP tools** — scan-opportunities, list-opportunities, file-opportunity, list-funding, create-funding, update-funding-stage. All registered in data_room hierarchical router.
- **32 new test assertions** (105 total across full suite)

## [0.6.0] - 2026-03-25

### Changed
- **Plugin renamed: `mindrian-os` -> `mos`** — All commands now use `/mos:` prefix (e.g., `/mos:diagnose`, `/mos:room`, `/mos:help`). 9 characters shorter per command. The old `/mindrian-os:` prefix no longer works after update.
- **Thinking Trace** — Larry now shows his reasoning visually when applying methodology. Blockquote-based traces show problem type, chosen framework, chain logic, Brain connections, and cross-references. Mode-adaptive: hidden in Ask mode, brief in Blend, full in Tell mode.
- **Visual Confirmations** — Larry confirms actions with structured feedback: what was filed, where, cross-references added, stage changes. Starting a methodology session shows estimated duration and output location.

### Added
- Thinking trace format in `skills/larry-personality/SKILL.md` — 4 trace types: routing, room analysis, Brain enrichment, action confirmation
- Visual confirmation patterns for methodology sessions and room filing

## [0.5.0] - 2026-03-25

### Added
- **MCP Server** — Full MindrianOS accessible from Claude Desktop and Cowork via stdio MCP. One line in `claude_desktop_config.json` unlocks all 41 commands
- **Hierarchical Tool Router** — 6 MCP tools (data_room, methodology, analysis, intelligence, meeting, export) routing all 41 CLI commands. 85-93% context reduction vs flat tool surface
- **MCP Resources** — 5 read-only resources for room browsing (room://) without tool calls: room-state, room-sections, section content, meetings, intelligence
- **MCP Prompts** — 5 methodology workflow prompts with Larry personality injection: file-meeting, analyze-room, grade-venture, run-methodology, suggest-next
- **Brain MCP Server** — Standalone `mcp-server-brain/` service wrapping Neo4j + Pinecone behind API key auth. Deploy to Render with one-click `render.yaml`
- **Brain API Key Gating** — `Authorization: Bearer <key>` middleware. Paid-tier users get API key, connect Brain from any surface
- **Shared Core Library** — `bin/mindrian-tools.cjs` single Node.js entry point + `lib/core/` modules (room-ops, state-ops, meeting-ops, graph-ops, section-registry). Both CLI and MCP call the same internals
- **Dynamic Section Discovery** — `analyze-room` and `build-graph` auto-discover new room sections. No more hardcoded arrays. Adding `opportunity-bank/` to room/ just works
- **CLI/MCP Parity Check** — `lib/parity/check-parity.cjs` validates all CLI commands have MCP counterparts. CI-ready gate (exits non-zero on drift)
- **Enhanced Status Line** — Shows project name, active room section, venture stage, gap count, and color-coded context window bar
- **Brain Namespace Search** — `brain_search` now supports namespace targeting (core, reference, tools, materials, graphrag) for the consolidated `pws-brain` index

### Changed
- Pinecone index default changed from `neo4j-knowledge-base` to `pws-brain` (consolidated index with 5 namespaces, 12K+ records, single embedding model)
- `scripts/context-monitor` rewritten in Node.js with room-aware status line

## [0.4.0] - 2026-03-24

### Added
- **Cross-Meeting Intelligence** — Convergence detection (same topic across 3+ meetings), severity-based contradiction flagging (high-impact = immediate, low-impact = summary), action item tracking across meetings (aggregated room/action-items.md with pre-filing triage), team contribution patterns (recurring concerns, influence shifts, role-gap analysis)
- **MEETINGS-INTELLIGENCE.md** — New computed intelligence file: convergence signals, active contradictions, action item aggregation, team-level cross-meeting patterns. Separate from TEAM-STATE.md (per-person vs cross-meeting focus)
- **Read AI MCP Integration** — `/mos:setup meetings` connects Read AI, Vexa, or Recall.ai MCP servers. `/mos:file-meeting --latest` auto-fetches most recent transcript without paste
- **Three-Layer Knowledge Graph** — build-graph now produces Structure (room sections), Content (meetings, speakers, artifacts), Intelligence (concepts from [[wikilinks]], convergence/contradiction edges). Every node has `layer` field, every edge has `source_type`
- **[[Wikilink]] Support** — Larry auto-inserts `[[concept-name]]` links when filing artifacts. build-graph parses all `[[...]]` patterns into concept nodes and REFERENCES edges. Lazy graph: relationships first, metadata on demand
- **Dashboard Timeline Mode** — Integrated in graph (not separate view). Meeting nodes arranged chronologically on X-axis, sections on Y-axis. REINFORCES edges pulse green, CONTRADICTS edges pulse red
- **Dashboard Layer Toggles & Presets** — Toggle buttons per layer (Structure/Content/Intelligence). Four preset views: Room Overview, Meeting Map, Team Network, Intelligence Map. Position persistence in localStorage
- **Meeting-Report PDF Export** — Minto pyramid structure: executive summary → logical claim → critical backbone → evidence & questions → full analysis by meeting. Speaker attribution with role-colored badges and section-colored filing indicators
- **Simon's Architecture of Complexity** — Basis theorem now embedded in CLAUDE.md and Larry's voice-dna. MindrianOS IS Simon's theory operationalized: near-decomposable hierarchical systems applied to venture innovation

### Changed
- `compute-state` now calls `compute-meetings-intelligence` as sub-step (layered computation: compute-state → compute-team → compute-meetings-intelligence)
- `compute-team` extended with Recurring Concerns and Influence Distribution sections in TEAM-STATE.md
- `dashboard/index.html` expanded from 911 to 1640 lines with three-layer visualization
- `commands/file-meeting.md` now a 7-step pipeline (added Step 0 action item triage, enhanced Step 4 cross-reference, enhanced Step 6 cross-meeting scan)

### Fixed
- SessionStart now reads actual version from plugin.json (was letting Larry guess from docs)

## [0.3.0] - 2026-03-23

### Added
- **Meeting Filing Command** (`/mos:file-meeting`) — Full 6-step pipeline: paste transcript, provide file path, or provide audio. Explicit flags (`--file`, `--audio`). Speaker identification with smart hybrid table (auto-matches from team/ directory). Priority-first segment classification with reasoning. Confirm-then-file UX with structured rejection reasons. Narrative + structured meeting summary with dual storage.
- **Velma Audio Transcription** (`scripts/transcribe-audio`) — Modulate Velma REST API wrapper (3¢/hour) with native speaker diarization and 20+ emotion signals. Setup via `/mos:setup transcription` or auto-prompt on first `--audio` use.
- **Speaker Profile System** — ICM nested folder profiles auto-created for every new speaker (team/{role}/{name}/ with insights/, advice/, connections/, concerns/). Extended PROFILE.md schema with roles list, primary_role, status lifecycle (active/inactive/alumni/potential), and last_active tracking.
- **Proactive Person Research** (`scripts/research-speaker`) — Web research on new speakers in context of the project/room. Builds Data Room-specific profile. `--apply` flag for user confirmation before writing.
- **Cross-Relationship Discovery** — 5 edge types (INFORMS, CONTRADICTS, CONVERGES, INVALIDATES, ENABLES) with Tier 0 keyword heuristics. Batch scan after all filing complete. Patterns reference at `references/meeting/cross-relationship-patterns.md`.
- **Meeting Reference Library** — 8 reference files: transcript-patterns (6 formats), segment-classification (6 types), section-mapping (12 roles × 8 rooms routing matrix), artifact-template (wicked-problem-aware frontmatter), summary-template, speaker-profile-template, live-join-interface spec, cross-relationship-patterns.
- **Team Room Structure** — Dynamic team/ directory (folders created on demand, not pre-populated). Multiple roles per person. Full attribution block in artifact frontmatter (speaker, role, profile_path, meeting_date, meeting_id). Topic primary + computed backlinks pattern (no file duplication).
- **Full Meeting Archive** — Self-contained meeting package in room/meetings/YYYY-MM-DD-{name}/: transcript.md, summary.md, speakers.md, decisions.md, action-items.md, metadata.yaml, plus audio copy. Past meeting lookup via metadata.yaml frontmatter search.
- **Team Intelligence** (`scripts/compute-team`) — Knowledge landscape context tool producing TEAM-STATE.md: expertise distribution, knowledge gaps, missing perspectives, role distribution, activity patterns. Layered computation: compute-state → compute-team. Structured markdown tables (lean, context-safe).
- **Room Intelligence Updates** — room-passive skill, compute-state, and analyze-room all meeting-aware. Status command shows meeting count and team intelligence.
- **Test Infrastructure** — 5 test scripts with 63+ assertions for meeting domain (segment classification, frontmatter provenance, summary structure, speaker identification, Velma diarization). `tests/run-all.sh` runner.

### Fixed
- SessionStart now reads actual version from plugin.json (was letting Larry guess from docs, sometimes reporting v0.1.0)

## [0.2.0] - 2026-03-23

### Added
- **Auto Update Notification** — SessionStart checks GitHub for new versions once per day (cached, async, non-blocking). Users see "[Update Available]" in Larry's greeting
- **Meeting Transcript Filing** — Design spec for `/mos:file-meeting`: paste transcript, identify speakers + roles, classify segments, file to Data Room sections with confirmation. Meeting summary artifact with cross-references, contradictions, action items
- **Release Process Rule** — CLAUDE.md now mandates: CHANGELOG update, version bump, tag, push with tags for every release
- **Analytics & Learning System** — Local usage tracking + behavioral learning that adapts Larry's suggestions
- **Tyler Josephson Case Study** — Full mockup with HSI cross-domain scoring and Reverse Salient bottleneck analysis
- **Dr. Vasquez Case Study** — 10-session CeraShield space reentry venture simulation with 33-page thesis PDF

### Fixed
- build-graph grep exit code under strict bash mode (all 10/10 scripts pass)
- render-pdf font resolution (base_url for WeasyPrint @font-face)
- analyze-room integer comparison in method_count
- Plugin.json now registers all 40 commands (was 14)
- Removed empty connector-awareness skill directory
- Fixed check-update GitHub URL (jsagir/mindrian-os-plugin)

## [0.1.0] - 2026-03-22

### Added
- **Larry Personality** -- Full teaching voice with mode engine calibration (40:30:20:10 distribution), signature openers, and tri-surface awareness (CLI, Desktop, Cowork)
- **26 Methodology Commands** -- Complete PWS framework toolkit: beautiful-question, explore-domains, explore-trends, map-unknowns, diagnose, analyze-needs, build-knowledge, structure-argument, challenge-assumptions, root-cause, macro-trends, user-needs, validate, find-bottlenecks, analyze-timing, dominant-designs, think-hats, scenario-plan, analyze-systems, systems-thinking, lean-canvas, leadership, explore-futures, grade, build-thesis, score-innovation
- **Pipeline Chaining** -- ICM stage contracts connect methodologies in intelligent sequences: Discovery pipeline (explore-domains -> think-hats -> analyze-needs), Thesis pipeline (structure-argument -> challenge-assumptions -> build-thesis)
- **Proactive Intelligence** -- Two-layer system: bash structural detection + Claude semantic interpretation with noise gate (max 2 HIGH-confidence findings per session)
- **Data Room Dashboard** -- De Stijl-styled localhost viewer with knowledge graph visualization, room chat, and CoSE/grid layout engine
- **Document Generation** -- PDF export for thesis, report, profile, and brief types with WeasyPrint rendering and TOC bookmarks
- **Brain MCP Integration** -- Optional Neo4j Brain connection with 5 Brain-powered commands: suggest-next, find-connections, compare-ventures, deep-grade, research
- **Self-Update System** -- Version check, changelog display, modification backup/reapply flow via `/mos:update`
- **Infrastructure Commands** -- new-project, help, status, room, setup, update
- **Passive Room Filing** -- PostToolUse hook auto-classifies and files insights to room sub-rooms
- **Graceful Degradation** -- Full functionality at Tier 0 (no dependencies), enhanced with optional Neo4j and Brain

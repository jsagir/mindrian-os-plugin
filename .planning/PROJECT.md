# MindrianOS Plugin

## What This Is

A commercial Claude Code + Cowork plugin that delivers Mindrian's PWS (Personal Wisdom System) methodology as installable skills, commands, agents, and hooks. Users install with one command and immediately get Larry (the AI teaching personality) plus a structured Data Room that passively captures insights and proactively surfaces gaps, contradictions, and convergence signals. The plugin leverages Claude's native capabilities while optionally connecting to the Brain (Neo4j knowledge graph with 21K+ nodes of teaching intelligence) for enriched guidance.

## Core Value

Users can run the full PWS methodology — 25 specialized methodology bots, structured pipelines, and an intelligent Data Room — inside Claude Code with zero infrastructure, where Larry guides them through venture innovation using the same teaching intelligence that powers the classroom experience.

## Current State

**Shipped:** v1.9.0 Model Data Room + Self-Analysis (2026-04-08)

v1.0 through v1.9.0 = 52 commands, 8 agents, 49 MCP tools. 6-view Data Room Presentation System (Dashboard, Wiki, Deck, Insights, Diagrams, Graph). Canvas knowledge graph with particles and glow. BYOAPI chat with Larry. Git integration (optional), KuzuDB automatic backbone, HSI pipeline, binary asset filing, Vercel one-click deploy. Dual themes (De Stijl dark + PWS light). MindrianOS branding enforced. Google Drive API integration. Model Data Room: 168 artifacts across 10 sections from real evidence. Self-analysis: HSI found 20 innovation pairs, Investment Thesis gate 7/10, reverse salient in business-model.

**Milestones shipped:**
- v1.0 MVP (2026-03-22) -- 5 phases, 20 plans
- v2.0 Meeting Intelligence (2026-03-24) -- 4 phases, 13 plans
- v3.0 MCP Platform (2026-03-25) -- 10 phases, 26 plans
- v4.0 Brain API & CLI UI (2026-03-29) -- 6 phases, 12 plans
- v5.0 Presentation System (2026-03-31) -- 8 phases, 17 plans
- v5.1 User Outlets (2026-03-31) -- 5 phases, 7 plans
- v1.6.0 Powerhouse (2026-03-31) -- 8 phases, parallel execution, spectral OM-HMM, DbA, model routing
- v6.2 RoomHub + SnapshotHub (2026-04-01) -- 5 phases, adaptive room detection, 7 showcase views, SnapshotHub export
- v1.8.6 MindrianRooms (2026-04-06) -- 6 phases, 35 requirements, centralized rooms, wicked hierarchy navigator
- v1.8.8 Brain Graph Optimization (2026-04-07) -- causal discovery, lazy graph bridge, fragmentation cleanup, teaching wiring, dummy-proof install
- v1.9.0 Model Data Room (2026-04-08) -- Google Drive integration, 168-artifact model room, HSI self-analysis, Investment Thesis, knowledge graph (179 nodes/383 edges)

## Current Milestone: v2.0 Mindrian Platform -- SQLite + MCP Server

**Goal:** Replace the dead KuzuDB with SQLite (graph + memory system), then ship MindrianOS intelligence as a 23-tool MCP server with interactive UI (MCP Apps) that any LLM host can use.

**Target features:**

Workstream A -- SQLite Migration + Memory System:
- Replace KuzuDB with SQLite + better-sqlite3 (same API, concurrent access via WAL)
- Graph tables: nodes, edges, concepts (replaces .lazygraph/)
- Memory tables: identity (L0), facts with temporal validity (L1), sessions (L2), fragments (L3)
- Assumption tracking with validity lifecycle (untested/supported/contradicted/stale)
- Natural language graph queries (Larry translates to SQL, no Cypher exposure)
- Migrate all 24+ files touching KuzuDB (lazygraph-ops.cjs is the single replacement point)

Workstream B -- Mindrian MCP Server (23 tools):
- Tier 1: Brain intelligence (6 tools -- brain_ask, brain_query, brain_search, brain_grade, brain_route, brain_chain)
- Tier 2: Room intelligence (11 tools -- room_analyze, room_state, room_file, hsi_score, reverse_salients, whitespace_detect, blindspot_coverage, surprise_score, novelty_rank, disruption_index, meeting_extract)
- Tier 3: Graph + Export (6 tools -- graph_query, graph_index, visualize, export_snapshot, persona_generate, opportunity_scan)
- Larry Lite system prompt (200 lines teaching methodology instinct, not personality)
- Co-development rule: every new capability ships as both plugin command AND MCP tool

Workstream C -- MCP Apps (Interactive UI):
- MCP Apps integration (SEP-1865, production-ready Jan 2026, Anthropic + OpenAI co-developed)
- De Stijl dashboards render in-chat via ui:// scheme
- Knowledge graph visualization as MCP App
- Wiki view as MCP App
- Works in Claude, VS Code, ChatGPT, any MCP Apps-compatible client

**Key context:**
- KuzuDB abandoned Oct 2025 (archived on GitHub, no maintenance)
- SQLite WAL mode solves MCP/plugin concurrent access (the blocker for co-development)
- lib/core/*.cjs is already the shared core -- MCP tools wrap existing functions
- room.db at room/.mindrian/room.db replaces .lazygraph/ directory
- 24+ files touch KuzuDB but 90% route through lazygraph-ops.cjs (single replacement point)
- MCP Apps SDK: @modelcontextprotocol/ext-apps

## Previous Milestone: v1.9.0 Model Data Room + Self-Analysis (SHIPPED 2026-04-08)

**Goal:** Prove MindrianOS capabilities by building a comprehensive Data Room about itself -- pulling from Google Drive meetings, Gmail, GSD artifacts, Claude memory, and plugin repo. Then run HSI, Investment Thesis, and knowledge graph analysis on the result.

**Delivered:**
- 168 artifacts across 10 sections (meetings, research, methodology, solution-design, competitive, problem-definition, market, business-model, team, team-execution)
- Google Drive API integration (45 meeting transcripts + 4 whitepapers downloaded via OAuth)
- Knowledge graph: 179 nodes, 383 edges, 198 cross-references
- HSI Tier 1: 20 innovation pairs, reverse salient in business-model (OM-HMM 33.6)
- Investment Thesis gate: 7/10 (weak on momentum, funding justification, valuation)
- 19 people mapped across 45 meetings with roles and attendance

## Previous Milestone: v1.8.8 Brain Graph Optimization + Dummy-Proof Install (SHIPPED 2026-04-07)

**Goal:** Execute the Brain normalization scripts (already written in v1.8.2 roadmap), enriching the Neo4j teaching graph with framework chains, prerequisite edges, stage mappings, and wiring orphaned nodes. Simultaneously, test and polish the install experience with screenshots, error handling, and onboarding flow verification.

**Target features:**

Workstream A -- Brain Graph Optimization (phases 52-55 from v1.8.2):
- FEEDS_INTO enrichment (4 -> 35+ Framework chains including full PWS spine)
- PREREQUISITE edges (0 -> 14, enables "do X before Y" warnings)
- TYPICAL_AT stage mapping (4 -> 30+, powers /mos:suggest-next and /mos:act)
- ProblemType consolidation (150+ nodes -> 4 canonical + ALIAS_OF + SUBTYPE_OF)
- DataRoomSection + CaseStudy + FrameworkAgent wiring
- Book dedup and label normalization

Workstream B -- Dummy-Proof Install Experience:
- Test install guide page on fresh Mac + Windows environments
- Generate screenshots for every install step
- Improve error messages in scripts (human-readable, not stack traces)
- Test /mos:onboard flow end-to-end
- Verify email template system works for new user onboarding
- Document common failure modes with fixes

**Previous milestone (v1.8.6 MindrianRooms):**
Shipped 2026-04-06. 6 phases, 35 requirements. Centralized rooms, wicked hierarchy navigator, dual-graph layer.

**Target features:**
- ICM Root Structure: ~/MindrianRooms/ with Layer 0 (CLAUDE.md) and Layer 1 (INDEX.md) auto-generated on first room creation
- resolve-room script update: default path resolution from ~/room/ and ~/rooms/ to ~/MindrianRooms/
- room-registry script update: new rooms created under ~/MindrianRooms/[slug]/
- new-project command update: room creation targets MindrianRooms, generates ICM files if missing
- rooms command update: display paths, creation paths, and registry point to MindrianRooms
- Skill activation update: room-passive and room-proactive detect rooms in new location
- Migration script: detect legacy ~/room/ and ~/rooms/ layouts, offer guided migration with symlink option
- INDEX.md auto-refresh: updates when rooms are created, archived, or stage changes
- Old path cleanup guidance after confirmed migration

**Previous milestone (v1.8.2 Brain Graph Optimization):**
Defined and roadmapped Brain graph enrichment (4 phases, 27 requirements). Normalization scripts written. Ready to execute separately.

**Research basis:**
- Live graph audit (2026-04-06): 32,612 nodes, 170,791 rels, 828 labels, 1,633 rel types
- 5-layer architecture documented: L1 Curated (281), L2 Document (1,454), L3 Entity (5,316), L4 Lazy (8,425), L5 Taxonomy (970)
- Critical finding: L1 Curated and L4 Lazy have ZERO direct edges. Bridge is 3-hop through Chunks
- FEEDS_INTO: only 4 real Framework->Framework edges for 86 frameworks
- TYPICAL_AT: 4 edges total. PREREQUISITE: 0 edges.
- ProblemType fragmented across 150+ nodes (LazyGraphConcept "Well-Defined Problem" has 348 rels vs canonical 83)
- 7/10 FrameworkAgents orphaned, 19/30 CaseStudies orphaned, 0 grading calibration data
- Scripts already written: brain-normalize-final.cypher, brain-normalize-supplement.cypher, brain-normalize-problemtype.cypher
- Architecture reference: references/brain/graph-architecture.md with 10 Cypher patterns

**Target features:**

Causal Discovery Optimization:
- FEEDS_INTO enrichment (4 -> 35+ Framework chains including full PWS spine)
- PREREQUISITE edges (0 -> 14, enables "do X before Y" warnings)
- TYPICAL_AT stage mapping (4 -> 30+, powers /mos:suggest-next and /mos:act)
- ADDRESSES_PROBLEM_TYPE cleanup (remove __Entity__ noise, add effectiveness scores)
- 2D ProblemType matrix wiring (Definition x Complexity with Framework recommendations)
- Full provenance chain: Book -> GROUNDS_FRAMEWORK -> Framework -> ADDRESSES_PROBLEM_TYPE -> ProblemType

Lazy Graph Optimization:
- ALIAS_OF bridge from high-rel LazyGraphConcepts to canonical nodes (1,900+ orphaned rels become findable)
- Promote valuable LazyGraphConcepts (3+ Framework CO_OCCURS) to Concept
- Clean 511 orphan LazyGraphConcepts
- CO_OCCURS weight-based query patterns for semantic discovery (weight >= 2 filter)
- 3-hop bridge pattern: LazyGraph -> Chunk -> Entity -> Framework

Fragmentation Cleanup:
- ProblemType consolidation (150+ nodes -> 4 canonical + ALIAS_OF + SUBTYPE_OF)
- Book dedup (88 null-title + 6x duplicates) + INTRODUCES_FRAMEWORK mislanding fix
- Opportunity Bank (21 nodes -> 1 canonical with full wiring)
- DictionaryTerm dedup (8x copies per problem type)
- Label normalization (lowercase->PascalCase, base/UNKNOWN removal)

Agent + Teaching Layer Wiring:
- FrameworkAgents 10/10 wired (DERIVED_FROM + APPLIES_TO + IMPLEMENTED_BY)
- CaseStudies 26+/30 wired (Challenger, NASA, Marconi, Naval Aviation + student projects)
- Mullins Model Validation: Technique -> ValidationTool, full pipeline gateway
- Workshop->TEACHES->Framework (0 -> 16+ edges)
- Bot->IMPLEMENTS->Framework (0 -> 15+ edges)
- CorePrinciple->GOVERNS (0 -> 20+ edges)
- Grading calibration gap flagged as SystemGap node (0 Example nodes with rubric scores)

**Architecture:**
- All normalization uses APOC (2026.03.0 confirmed on Aura): mergeNodes for dedup, periodic.iterate for batch ops
- Write operations via Neo4j Aura console or write MCP tool
- Verification via read MCP (mcp__my-neo4j__read_neo4j_cypher)
- Curly apostrophe (U+2019) in "Devil's" handled via STARTS WITH prefix matching
- ALIAS_OF preserves LazyGraph CO_OCCURS fabric while making canonical nodes discoverable

**Previous milestone (v1.7.0 Causal Reasoning Layer):**
Defined causal engine architecture. This milestone executes the Brain graph enrichment that v1.7.0 designed but never ran.

## Notion Template Gap Close (Captured 2026-04-14)

Compared against a third-party Notion "Problem Worth Solving" template the user shared on 2026-04-14. The Notion template has six structural features MindrianOS does not, all of which are cheap to adopt and complement the dynamic-intelligence wins MindrianOS already owns. Captured as a focused backlog so they do not get lost between Phase 81 (v1.10.2, landed) and the v1.11.0 release-pipeline work.

1. **Per-section one-liner STATEMENT (HIGH value).** Notion forces a single-sentence callout at the top of Problem, Solution, Business Model, Market Analysis. MindrianOS has ROOM.md + STATE.md + (v1.10.2) MINTO.md essence field, but none surface as "this is THE sentence for this section, always visible." Phase 81 solves the same psychology at the artifact level; this would do it at the section level. Implementation: promote an `essence` or `statement` frontmatter field in ROOM.md rendering, or add a `STATEMENT.md` per section. Candidate for v1.10.8 or v1.11.0 scope. (Shifted v1.10.3 -> v1.10.4 -> v1.10.5 -> v1.10.6 -> v1.10.7 -> v1.10.8 on 2026-04-14 because the v1.10.3 and v1.10.4 slots were taken by statusline upgrade releases, v1.10.5 was taken by the Lawrence wiki artifact injection fix (Phase 82), and v1.10.7 was taken by the cross-session scope injection + write interception + intent classifier + honesty layer release (Phase 83). Sixth shift. Smart-notebook work remains the next feature milestone after v1.10.7.)

2. **Latest Deck persistent slot (HIGH value).** A top-level always-visible slot for the current pitch deck. MindrianOS has `exports/` but no concept of "the current canonical deck." When an investor opens the room they should not have to hunt. Implementation: `room/deck/` section with a `LATEST.md` that `/mos:export thesis` updates on each run, or a pinned slot in ROOM.md.

3. **Marketing and Sales split from Market Analysis (MEDIUM value).** Notion treats these as distinct sections. MindrianOS conflates them in `market-analysis/`. Different JTBD: market-analysis answers "is there a market," marketing-sales answers "how do we reach and convert." Simon's near-decomposability argument applies. Implementation: add `marketing-sales/` as a new room section, update session-start room map, update classifier in vault import.

4. **Funding Options as a room section (MEDIUM value).** MindrianOS has `/mos:funding` and the opportunity-bank skill but no `funding/` room section. A section would make grants and investors a first-class subsystem visible in the graph, not just command output. Small structural lift, big visibility win.

5. **Value Proposition as a top-level section (LOW-MEDIUM value).** Notion treats VP as a peer section between Problem and Business Model. MindrianOS folds it into one or the other. Arguably VP IS the hinge and deserves its own room. Lower priority because `/mos:value-proposition` skill already exists.

6. **Self-guiding room (MEDIUM value).** Notion embeds its own usage instructions INSIDE the page. A stranger can open a Notion template without a CLI, without Larry, and know what to do. MindrianOS equivalents (`/mos:onboard`, session-start nudges) only work through the CLI. The Dror-activates-alone success criterion from user context lives here. Implementation: enhance ROOM.md bootstrapping so the room is self-explanatory in Obsidian and on GitHub too, not just via Larry. Candidate companion for items 1 and 2.

**Honest summary.** The Notion template wins on static user-facing clarity (one-liners, latest-deck slot, self-guiding, finer-grained sections). MindrianOS wins on dynamic intelligence (graph, MINTO reasoning, meetings, proactive surfacing, now Feynman-MINTO). The Notion wins are all cheap structural additions, not new architecture. Items 1, 2, 4 are the priority set because they are small lifts with high visibility impact and they align with the Dror-activates-alone forcing function from the user context file.

**What NOT to steal from Notion.** The template has no relationship graph, no MINTO reasoning, no meeting intelligence, no proactive discovery, no filing cascade, no Brain enrichment, and no methodology commands. MindrianOS keeps all of that. The gap close is additive.

---

## v3.0 Backlog (Captured Ideas)

### FIRST-CLASS v3.0 SCOPE ITEM: MCP Sampling migration for Feynman-MINTO (bridge from Phase 81)

**Context.** Phase 81 (v1.10.2 Feynman-MINTO Hybrid) ships the tier-1 LLM path via direct Anthropic Messages API using native `fetch` and the `ANTHROPIC_API_KEY` env var (see `.planning/phases/81-feynman-minto-hybrid/81-RESEARCH.md` Q(b) resolution). This was the correct choice for v1.10.2 because the v3.x MCP server with sampling support is not built yet, and inverting dependency order to build an MCP server as a prerequisite for Phase 81 would have blocked the bridge release indefinitely.

**The tradeoff Phase 81 accepts.** Users must set `ANTHROPIC_API_KEY` to get tier-1 Feynman-MINTO. This partially bends CLAUDE.md Decision #1 (one-command install). Tier-0 fallback (pre-81 deterministic MINTO + AAAK footer) preserves zero-config for users without a key, so the plugin still works with one command. But the ideal end state is that the user's existing Claude Code / Desktop / Cowork session provides the LLM, with no second API key and no second billing relationship.

**The v3.0 migration.** MCP Sampling (`sampling/createMessage` in the MCP spec) is the mechanism. Once the MindrianOS MCP server is built:
1. The MCP server registers sampling capability in its initialization handshake
2. `lib/memory/llm-call.cjs` gains a second code path that, when running inside an MCP server context, calls `server.createMessage(...)` instead of shelling out to Anthropic via fetch
3. The host (Claude Code / Desktop / Cowork) serves the completion from the user's existing session, billed to the user's existing plan
4. `ANTHROPIC_API_KEY` becomes optional rather than required for tier-1
5. CLAUDE.md Decision #1 is fully restored for tier-1 Feynman-MINTO

**Non-blocking for Phase 81.** Ship Phase 81 as-is with the direct-fetch path. The v3.0 MCP sampling migration is an additive enhancement, not a rewrite. The `llm-call.cjs` abstraction in 81-01 is specifically designed so the sampling path can be added later without touching `feynman-stages.cjs` or the generator.

**v3.0 milestone scope must include:**
- MCP Sampling capability on the MindrianOS MCP server (`@modelcontextprotocol/sdk` 1.27.1+ supports this)
- Dual-path `llm-call.cjs` (detect MCP context, prefer sampling, fall back to direct fetch, then tier-0)
- CHANGELOG entry retiring the `ANTHROPIC_API_KEY` requirement for tier-1 when in MCP context
- Regression test that Feynman-MINTO works identically via sampling and via direct fetch (same fixtures, same structural assertions)
- Docs update: "one-command install" fully restored for Desktop/Cowork tier-1 users

**References.**
- `.planning/phases/81-feynman-minto-hybrid/81-CONTEXT.md` D-7 (LLM path abstraction was designed for this migration)
- `.planning/phases/81-feynman-minto-hybrid/81-RESEARCH.md` Q(b) (why direct fetch now, why MCP sampling later)
- MCP spec: https://modelcontextprotocol.io/docs/concepts/sampling
- `@modelcontextprotocol/sdk` `server.createMessage(...)` API

---

### Other v3.0 Backlog Items

- Opportunity Bank (room section + proactive grant discovery agents)
- Funding Room (non-dilutive/dilutive/grants sub-rooms, GSD-style process per grant)
- AI Team Member Personas (domain experts generated from intelligence + Bono perspectives)
- Wiki-style Data Room Dashboard (hosted Render/Vercel, nodes = pages, edges = hyperlinks)
- Obsidian Plugin (room/ as Obsidian vault with graph view)
- Obsidian-compatible rooms (ship .obsidian/ config template with room creation -- near-zero effort)
- Chrome Plugin (meeting join + room access)
- Room as Remote MCP (collaborative team access from local/remote)
- MindrianOS CLI tools layer (mindrian-tools.cjs like gsd-tools.cjs)
- Data Room level status bar (CLI nested room/section context)
- Cursor + Antigravity/Windsurf compatibility (ICM = universal interface)
- Risk vs Uncertainty blog post (adapted for MindrianOS)
- Site style guide + generated images per article
- Nanobot multi-channel Larry (wrap MCP server in Nanobot agent -- Larry on Telegram, Discord, WhatsApp, Slack, Email via github.com/HKUDS/nanobot. MCP-native, full MCP-UI rendering, 15+ messaging channels. v3.0+ multi-channel distribution.)
- OpenClaw skill (Larry as always-on daemon -- 24/7 proactive intelligence, scheduled tasks, meeting capture from any channel)

## Requirements

### Validated

v1.0 shipped (2026-03-22):
- ✓ One-command install, Larry active immediately (v1.0, Phase 1)
- ✓ 26 methodology commands + 5 Brain commands + 7 infrastructure commands (v1.0, Phases 2-4)
- ✓ Data Room with 8 sections, proactive intelligence, pipeline chaining (v1.0, Phases 2-3)
- ✓ De Stijl dashboard with knowledge graph + chat (v1.0, Phase 3.1)
- ✓ PDF export (thesis, summary, report, profile) (v1.0, Phase 3.2)
- ✓ Brain MCP integration with 4 agents (v1.0, Phase 4)
- ✓ Self-update, context awareness, capability radar (v1.0, Phase 5)
- ✓ Analytics + learning system (v0.2.0)
- ✓ Auto-update notification at SessionStart (v0.2.0)

v2.0 shipped (2026-03-24):
- ✓ Meeting filing pipeline with 3 input modes (paste/file/audio) + Velma transcription (v2.0, Phase 6)
- ✓ Speaker identification with 12 roles, ICM nested folder profiles, proactive web research (v2.0, Phase 6)
- ✓ Team room structure with dynamic folders, multiple roles, status lifecycle (v2.0, Phase 7)
- ✓ Full meeting archive packages (7 files per meeting + audio copy) (v2.0, Phase 7)
- ✓ Cross-meeting intelligence: convergence, contradictions, action items, team patterns (v2.0, Phase 8)
- ✓ Read AI / Vexa / Recall.ai MCP integration + --latest auto-fetch (v2.0, Phase 8)
- ✓ Three-layer knowledge graph with [[wikilinks]] and lazy graph pattern (v2.0, Phase 9)
- ✓ Dashboard timeline mode with layer toggles, preset views, edge animations (v2.0, Phase 9)
- ✓ Minto pyramid meeting-report PDF export with speaker attribution (v2.0, Phase 9)
- ✓ Simon's Architecture of Complexity as basis theorem (v2.0, architecture)

v4.0 shipped (2026-03-29):
- Brain API key management with Supabase, approve/revoke/extend, plan-gated brain_write guard (v4.0, Phase 20)
- CLI UI Ruling System: 4-zone anatomy, 5 body shapes, 12 glyphs, session start contract (v4.0, Phase 21)
- Self-teaching admin panel (/mos:admin) with help visibility filtering (v4.0, Phase 22)
- Multi-room management: registry, /mos:rooms (6 subcommands), room lock, header canary (v4.0, Phase 23)
- Autonomous engine: /mos:act with Brain-driven framework selection, chain mode, dry-run (v4.0, Phase 24)
- De Stijl HTML export: Mondrian grid, document reader, intelligence view, Cytoscape graph (v4.0, Phase 25)

### Active

Deferred from v3.0:
- [ ] Room as Remote MCP (collaborative team access)
- [ ] Opportunity Bank (room section + proactive discovery agents)
- [ ] Funding Room (non-dilutive/dilutive/grants sub-rooms)
- [ ] AI Team Member Personas (domain experts + Bono perspectives)

### Out of Scope

- Full-stack web UI (V2 approach) — plugin replaces the need for Next.js/FastAPI/CopilotKit
- Mobile app — Claude surfaces handle this
- Real-time collaboration features — Cowork handles this natively
- Brain graph editing by users — users get intelligence, never see or modify the graph
- Custom LLM integration — Claude-native only
- Payment processing in plugin — handled externally via Anthropic marketplace / Stripe

## Context

**Source material ready to port:**
- MindrianV2: 25 methodology prompts (Python), Larry personality (8 .md files), mode engine, router, 18 skills
- MindrianOS: 16 Claude Desktop project specs with full methodology definitions, 5 design docs, grading rubrics
- Brain: Neo4j Aura with 21K nodes, 65K relationships, 1,427 Pinecone embeddings — deployed as MCP server at brain.mindrian.ai
- ICM paper (2603.16021v2): Interpretable Context Methodology — folder structure as orchestration
- GSD patterns from ~/.claude/get-shit-done/ for state management

**Architecture decisions:**
- ICM-native: no framework code, folder structure IS orchestration
- "Configure the factory, not the product" — Layer 3 (reference/factory) is the IP, Layer 4 (working artifacts) is user's work
- Every output is an edit surface; plain text as universal interface
- Fresh subagent contexts prevent context rot (GSD pattern)

**Distribution:**
- Anthropic marketplace — anyone with Claude can install
- Break-even on Brain tier: 5-17 subscribers at $9/month

## Constraints

- **Plugin format**: Must conform to Claude Code plugin structure (commands/, skills/, agents/, hooks/, .mcp.json, settings.json, plugin.json)
- **No server infrastructure**: Plugin runs entirely in Claude's environment — no backend services except optional Brain MCP
- **Brain IP protection**: The 21K-node teaching graph, grading intelligence, and mode engine calibration are proprietary — never distributed, only served via MCP
- **Neo4j Aura Free limits**: LazyGraph must work within 50K node limit
- **Three surfaces**: All features must work across CLI, Desktop, and Cowork without surface-specific code
- **Existing assets**: Must port from V2/OS, not rebuild from scratch — 25 prompts, Larry personality, mode engine already exist

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| ICM-native architecture | Folder structure as orchestration eliminates framework code; paper-backed methodology | — Pending |
| GSD state management | STATE.md per room with master aggregation; proven pattern from GSD | — Pending |
| Brain as remote MCP | IP stays on server; users get intelligence not data; MCP is Claude-native | — Pending |
| LazyGraph optional | Enhances but never required; graceful degradation; Neo4j Aura Free is zero cost | — Pending |
| Tier 0 fully functional | Free tier works completely; Brain adds enrichment not gatekeeping | — Pending |
| Pipeline chaining through Room | Week 7 pattern; output becomes structured input; Room drives routing | — Pending |
| Larry as default agent | Immediate personality; zero-config experience; mode engine differentiates | — Pending |
| Three-surface compatibility | Same plugin, same workspace, same CLAUDE.md; Cowork gets 00_Context/ | — Pending |
| One-command install | Zero config required; Larry talks immediately; optional enhancements later | — Pending |
| Factory/Product separation | Layer 3 = IP (factory), Layer 4 = user work (product); clean ownership boundary | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-06 after Phase 95.2 (install-cache-atomic-recovery-sessionstart-preflight) complete -- v1.13.0-beta.6 hotfix shipped LOCAL with empirical dogfood signal (Canon Part 6 D-13 mandate honored). Three-phase same-day shipping cluster: 89-07 ReverseSalientAgent (beta.4) + 116 unresolved-tension-hook (beta.5) + 95.2 install-cache hotfix (beta.6).*

# Requirements: MindrianOS Plugin

**Defined:** 2026-03-19
**Core Value:** Users can run the full PWS methodology inside Claude Code with zero infrastructure -- Larry guides them through venture innovation with a persistent Data Room and optional Brain enrichment.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Plugin Foundation

- [ ] **PLGN-01**: User can install plugin with one command (`claude plugin install mindrian-os`) and Larry responds immediately with zero configuration
- [ ] **PLGN-02**: Plugin manifest (plugin.json) declares all commands, skills, agents, hooks, and MCP configuration
- [x] **PLGN-03**: User can run `/mindrian-os:help` to see all available commands with descriptions and suggested starting points
- [x] **PLGN-04**: User can run `/mindrian-os:status` to see current Room state, active tier, and available integrations
- [ ] **PLGN-05**: Plugin context budget stays under 2% of context window with all auto-loaded skills combined (methodology commands use `disable-model-invocation: true`)

### Larry Personality

- [ ] **LARY-01**: Larry is the default agent -- all conversations flow through Larry's teaching personality without user configuration
- [ ] **LARY-02**: Larry mode engine distributes responses across 4 modes: conceptual (40%), storytelling (30%), problem-solving (20%), assessment (10%)
- [ ] **LARY-03**: Larry adapts voice based on conversation context -- encourages exploration early, challenges assumptions later, pushes toward synthesis at the end
- [ ] **LARY-04**: Larry personality is informed by the 8 Larry skill files ported from V2 and redesigned for Claude Code

### Data Room

- [x] **ROOM-01**: User's workspace initializes with 8 Data Room sections: problem-definition, market-analysis, solution-design, business-model, competitive-analysis, team-execution, legal-ip, financial-model
- [x] **ROOM-02**: STATE.md is computed from filesystem truth (directory contents, file metadata) via hook scripts, not maintained incrementally by Claude
- [x] **ROOM-03**: SessionStart hook loads current Room state and context so user can resume work across sessions
- [x] **ROOM-04**: Stop hook persists session state before exit
- [x] **ROOM-05**: User can run `/mindrian-os:room` to view Data Room overview with section completeness and recent activity

### Methodology Commands

- [x] **METH-01**: User can invoke Domain Explorer methodology via slash command to map opportunity sub-domains
- [x] **METH-02**: User can invoke Minto Pyramid methodology via slash command to structure logical arguments
- [x] **METH-03**: User can invoke Bono Six Hats methodology via slash command to explore perspectives
- [x] **METH-04**: User can invoke JTBD (Jobs to Be Done) methodology via slash command to identify customer needs
- [ ] **METH-05**: User can invoke Devil's Advocate methodology via slash command to challenge assumptions
- [x] **METH-06**: User can invoke HSI (Holistic Scoring Index) methodology via slash command to evaluate ventures
- [x] **METH-07**: User can invoke Investment Thesis methodology via slash command to build investment cases
- [ ] **METH-08**: User can invoke Lean Canvas methodology via slash command to map business models
- [x] **METH-09**: Each methodology command produces structured markdown artifacts filed to the appropriate Data Room section
- [x] **METH-10**: Each methodology has a thin skill file (under 300 tokens) with on-demand reference loading from references/ directory

### Passive Room Intelligence

- [ ] **PASS-01**: PostToolUse hook auto-classifies insights from conversation into correct Data Room sections without user action
- [ ] **PASS-02**: Room passive skill detects when methodology output should be filed and triggers filing automatically
- [ ] **PASS-03**: Every filed insight includes provenance metadata (source methodology, timestamp, session)

### Pipeline Chaining

- [x] **PIPE-01**: Pipeline stage contracts (numbered markdown files) define multi-step methodology workflows
- [x] **PIPE-02**: Output of one pipeline becomes structured input to the next (Week 7 chaining pattern) -- e.g., Domain Explorer sub-domains feed into Bono hat perspectives
- [x] **PIPE-03**: User can run at least 2-3 key pipeline sequences end-to-end (Domain Explorer to Bono to JTBD, Minto to Devil's Advocate to Investment Thesis)
- [x] **PIPE-04**: Pipeline execution produces inspectable artifacts at each stage filed to Room sections

### Proactive Room Intelligence

- [x] **PROA-01**: Room proactive skill detects gaps in Data Room sections ("no competitive analysis yet") and surfaces suggestions
- [x] **PROA-02**: Room proactive skill detects contradictions between Room sections and alerts user
- [x] **PROA-03**: Room proactive skill detects convergence signals (multiple frameworks pointing to same insight) and highlights them
- [x] **PROA-04**: Proactive suggestions include confidence scores and are gated to prevent noise

### Data Room Dashboard (INSERTED)

- [x] **DASH-01**: User can run `/mindrian-os:room view` to launch a localhost server that opens a De Stijl dashboard in their browser
- [x] **DASH-02**: Dashboard displays Data Room as an interactive Cytoscape.js knowledge graph with nodes colored by 8 semantic section colors, zoomable, pannable, draggable
- [x] **DASH-03**: Graph edges show relationships between artifacts (INFORMS, CONTRADICTS, CONVERGES, FEEDS_INTO) extracted from provenance metadata and pipeline chains
- [x] **DASH-04**: Chat box at the bottom allows natural language queries about the room and returns natural language answers from Larry
- [x] **DASH-05**: Graph data auto-generated from room/ directory contents — no manual graph building, updates on refresh

### Document Generation

- [x] **DOCS-01**: User can run `/mindrian-os:export` to generate professional De Stijl PDFs from Data Room content (thesis, summary, report, profile, deck, brief)
- [x] **DOCS-02**: PDF rendering uses WeasyPrint + Jinja2 templates with shared De Stijl CSS — zero additional dependencies
- [x] **DOCS-03**: Each document type maps room sections to document sections with correct accent colors and structure
- [x] **DOCS-04**: Exported PDFs include running headers/footers, page numbers, TOC (for multi-section docs), and bundled Bebas Neue font
- [x] **DOCS-05**: PWS Profile generation creates structured profiles from room data and methodology outputs (Bono, Domain Explorer, JTBD persona)

### Brain MCP Integration

- [x] **BRAN-01**: User can connect Brain MCP via `/mindrian-os:setup brain` — adds Neo4j + Pinecone to .mcp.json (not in default config, zero startup cost)
- [x] **BRAN-02**: 8 Brain MCP tools defined and callable (framework_chain, grade_calibrate, find_patterns, concept_connect, cross_domain, contradiction_check, gap_assess, search_semantic)
- [x] **BRAN-03**: brain-connector skill provides passive enrichment (Larry responses informed by graph) and proactive surfacing (contradictions, gaps detected via Brain tools, gated by confidence)
- [x] **BRAN-04**: Brain Agent sub-agent handles complex multi-hop graph queries, builds GraphRAG context across conversation turns
- [x] **BRAN-05**: Grading Agent provides calibrated 5-component assessment from 100+ real projects via brain_grade_calibrate
- [x] **BRAN-06**: Research Agent performs external web search via Tavily MCP, cross-references with Brain semantic index, files findings to room
- [x] **BRAN-07**: Investor Agent stress-tests venture from investor POV using Brain pattern data, produces structured concerns artifact
- [x] **BRAN-08**: 5 new commands: suggest-next, find-connections, compare-ventures, deep-grade, research
- [x] **BRAN-09**: Existing commands upgraded — diagnose (graph-informed), help (personalized), grade (routes to Grading Agent), pipeline (dynamic chains), mode engine (calibrated)
- [x] **BRAN-10**: Brain schema reference and query pattern templates in references/brain/

### Graceful Degradation

- [x] **DEGS-01**: Plugin is fully functional with zero external dependencies (Tier 0)
- [x] **DEGS-02**: references/ directory provides embedded framework definitions, static chain suggestions, and rubric as fallback for Brain
- [x] **DEGS-03**: All features that depend on optional services (Brain, LazyGraph) have local fallbacks that still provide value

### Cross-Surface Compatibility

- [x] **SURF-01**: Plugin works identically on Claude Code CLI, Desktop, and Cowork
- [x] **SURF-02**: Cowork surface gets 00_Context/ directory for shared project state

### All 25 Methodologies

- [x] **ALLM-01**: All 25 methodology bots from V2 are available as slash commands (remaining 17 beyond the core 8)
- [x] **ALLM-02**: Each additional methodology follows the same thin skill + reference + pipeline pattern established in core 8

### Plugin Self-Update

- [ ] **UPDT-01**: User can run `/mindrian-os:update` to check for and install plugin updates with changelog display
- [ ] **UPDT-02**: Update process backs up user modifications and offers reapply after clean install

### Context Window Awareness

- [x] **CTXW-01**: Plugin monitors context window consumption and adapts loading strategy (compress references, defer skills)
- [x] **CTXW-02**: Plugin warns user when approaching context limits and suggests `/clear` or reference unloading

### Claude Capability Radar

- [x] **RADR-01**: Plugin tracks official Anthropic releases (Newsroom, Blog, Claude Code changelog) and surfaces new capabilities relevant to MindrianOS
- [x] **RADR-02**: Capability updates tagged by domain (models, code, desktop_cowork, plugins_mcp, visualization) with daily digest

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### LazyGraph

- **LAZY-01**: User can connect personal Neo4j Aura Free via `/mindrian-os:setup graph`
- **LAZY-02**: Room entries automatically create nodes in user's graph
- **LAZY-03**: Concept mentions create relationship edges in user's graph
- **LAZY-04**: User can query their knowledge graph for cross-project patterns

### Methodology Extensibility

- **EXTD-01**: User can create Level A custom methodology (conversation bot, one .md file)
- **EXTD-02**: User can create Level B custom methodology (full pipeline, folder structure)
- **EXTD-03**: User can create Level C custom methodology (Brain graph integration)

### Room Hierarchy

- **HIER-01**: User can create sub-rooms for distinct opportunity spaces
- **HIER-02**: State flows bottom-up from sub-rooms to master STATE.md
- **HIER-03**: Context flows top-down from master room to sub-rooms

### Connector Awareness

- **CONN-01**: Plugin detects available MCPs on SessionStart and adapts behavior
- **CONN-02**: Research skills use Tavily/ArXiv when available, graceful fallback when not

## Out of Scope

| Feature | Reason |
|---------|--------|
| Web UI / dashboard | Plugin replaces the need for full-stack web app; Claude surfaces ARE the UI |
| Custom LLM support | Claude-native only; skills optimized for Claude's strengths |
| Real-time collaboration | Cowork handles this natively |
| Brain graph editing by users | IP protection; users get intelligence, never raw data |
| Payment processing in plugin | Handled by Anthropic marketplace / Stripe externally |
| Mobile app | Claude mobile app runs the same plugin |
| Embedded vector store | Brain has Pinecone; Room file search suffices for Tier 0 |
| Complex onboarding wizard | Larry greets and starts working; first conversation IS onboarding |
| Framework content behind paywall | All 25 methodologies are free; Brain adds when/how/sequence intelligence |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLGN-01 | Phase 1 | Pending |
| PLGN-02 | Phase 1 | Pending |
| PLGN-03 | Phase 1 | Complete |
| PLGN-04 | Phase 1 | Complete |
| PLGN-05 | Phase 1 | Pending |
| LARY-01 | Phase 1 | Pending |
| LARY-02 | Phase 1 | Pending |
| LARY-03 | Phase 1 | Pending |
| LARY-04 | Phase 1 | Pending |
| ROOM-01 | Phase 1 | Complete |
| ROOM-02 | Phase 1 | Complete |
| ROOM-03 | Phase 1 | Complete |
| ROOM-04 | Phase 1 | Complete |
| ROOM-05 | Phase 1 | Complete |
| DEGS-01 | Phase 1 | Complete |
| DEGS-02 | Phase 1 | Complete |
| DEGS-03 | Phase 1 | Complete |
| SURF-01 | Phase 1 | Complete |
| SURF-02 | Phase 1 | Complete |
| METH-01 | Phase 2 | Complete |
| METH-02 | Phase 2 | Complete |
| METH-03 | Phase 2 | Complete |
| METH-04 | Phase 2 | Complete |
| METH-05 | Phase 2 | Complete |
| METH-06 | Phase 2 | Complete |
| METH-07 | Phase 2 | Complete |
| METH-08 | Phase 2 | Complete |
| METH-09 | Phase 2 | Complete |
| METH-10 | Phase 2 | Complete |
| PASS-01 | Phase 2 | Complete |
| PASS-02 | Phase 2 | Complete |
| PASS-03 | Phase 2 | Complete |
| PIPE-01 | Phase 3 | Complete |
| PIPE-02 | Phase 3 | Complete |
| PIPE-03 | Phase 3 | Complete |
| PIPE-04 | Phase 3 | Complete |
| PROA-01 | Phase 3 | Complete |
| PROA-02 | Phase 3 | Complete |
| PROA-03 | Phase 3 | Complete |
| PROA-04 | Phase 3 | Complete |
| DASH-01 | Phase 3.1 | Complete |
| DASH-02 | Phase 3.1 | Complete |
| DASH-03 | Phase 3.1 | Complete |
| DASH-04 | Phase 3.1 | Complete |
| DASH-05 | Phase 3.1 | Complete |
| DOCS-01 | Phase 3.2 | Complete |
| DOCS-02 | Phase 3.2 | Complete |
| DOCS-03 | Phase 3.2 | Complete |
| DOCS-04 | Phase 3.2 | Complete |
| DOCS-05 | Phase 3.2 | Complete |
| BRAN-01 | Phase 4 | Complete |
| BRAN-02 | Phase 4 | Complete |
| BRAN-03 | Phase 4 | Complete |
| BRAN-04 | Phase 4 | Complete |
| BRAN-05 | Phase 4 | Complete |
| BRAN-06 | Phase 4 | Complete |
| BRAN-07 | Phase 4 | Complete |
| BRAN-08 | Phase 4 | Complete |
| BRAN-09 | Phase 4 | Complete |
| BRAN-10 | Phase 4 | Complete |
| ALLM-01 | Phase 2 | Complete |
| ALLM-02 | Phase 2 | Complete |
| UPDT-01 | Phase 5 | Pending |
| UPDT-02 | Phase 5 | Pending |
| CTXW-01 | Phase 5 | Complete |
| CTXW-02 | Phase 5 | Complete |
| RADR-01 | Phase 5 | Complete |
| RADR-02 | Phase 5 | Complete |

**Coverage:**
- v1 requirements: 53 total
- Mapped to phases: 53
- Unmapped: 0

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-20 after adding Phase 5 (self-update, context awareness, capability radar)*

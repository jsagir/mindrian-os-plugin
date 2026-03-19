# Requirements: MindrianOS Plugin

**Defined:** 2026-03-19
**Core Value:** Users can run the full PWS methodology inside Claude Code with zero infrastructure — Larry guides them through venture innovation with a persistent Data Room and optional Brain enrichment.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Plugin Foundation

- [ ] **PLGN-01**: User can install plugin with one command (`claude plugin install mindrian-os`) and Larry responds immediately with zero configuration
- [ ] **PLGN-02**: Plugin manifest (plugin.json) declares all commands, skills, agents, hooks, and MCP configuration
- [ ] **PLGN-03**: User can run `/mindrian-os:help` to see all available commands with descriptions and suggested starting points
- [ ] **PLGN-04**: User can run `/mindrian-os:status` to see current Room state, active tier, and available integrations
- [ ] **PLGN-05**: Plugin context budget stays under 2% of context window with all auto-loaded skills combined (methodology commands use `disable-model-invocation: true`)

### Larry Personality

- [ ] **LARY-01**: Larry is the default agent — all conversations flow through Larry's teaching personality without user configuration
- [ ] **LARY-02**: Larry mode engine distributes responses across 4 modes: conceptual (40%), storytelling (30%), problem-solving (20%), assessment (10%)
- [ ] **LARY-03**: Larry adapts voice based on conversation context — encourages exploration early, challenges assumptions later, pushes toward synthesis at the end
- [ ] **LARY-04**: Larry personality is informed by the 8 Larry skill files ported from V2 and redesigned for Claude Code

### Data Room

- [ ] **ROOM-01**: User's workspace initializes with 8 Data Room sections: problem-definition, market-analysis, solution-design, business-model, competitive-analysis, team-execution, legal-ip, financial-model
- [ ] **ROOM-02**: STATE.md is computed from filesystem truth (directory contents, file metadata) via hook scripts, not maintained incrementally by Claude
- [ ] **ROOM-03**: SessionStart hook loads current Room state and context so user can resume work across sessions
- [ ] **ROOM-04**: Stop hook persists session state before exit
- [ ] **ROOM-05**: User can run `/mindrian-os:room` to view Data Room overview with section completeness and recent activity

### Methodology Commands

- [ ] **METH-01**: User can invoke Domain Explorer methodology via slash command to map opportunity sub-domains
- [ ] **METH-02**: User can invoke Minto Pyramid methodology via slash command to structure logical arguments
- [ ] **METH-03**: User can invoke Bono Six Hats methodology via slash command to explore perspectives
- [ ] **METH-04**: User can invoke JTBD (Jobs to Be Done) methodology via slash command to identify customer needs
- [ ] **METH-05**: User can invoke Devil's Advocate methodology via slash command to challenge assumptions
- [ ] **METH-06**: User can invoke HSI (Holistic Scoring Index) methodology via slash command to evaluate ventures
- [ ] **METH-07**: User can invoke Investment Thesis methodology via slash command to build investment cases
- [ ] **METH-08**: User can invoke Lean Canvas methodology via slash command to map business models
- [ ] **METH-09**: Each methodology command produces structured markdown artifacts filed to the appropriate Data Room section
- [ ] **METH-10**: Each methodology has a thin skill file (under 300 tokens) with on-demand reference loading from references/ directory

### Passive Room Intelligence

- [ ] **PASS-01**: PostToolUse hook auto-classifies insights from conversation into correct Data Room sections without user action
- [ ] **PASS-02**: Room passive skill detects when methodology output should be filed and triggers filing automatically
- [ ] **PASS-03**: Every filed insight includes provenance metadata (source methodology, timestamp, session)

### Pipeline Chaining

- [ ] **PIPE-01**: Pipeline stage contracts (numbered markdown files) define multi-step methodology workflows
- [ ] **PIPE-02**: Output of one pipeline becomes structured input to the next (Week 7 chaining pattern) — e.g., Domain Explorer sub-domains feed into Bono hat perspectives
- [ ] **PIPE-03**: User can run at least 2-3 key pipeline sequences end-to-end (Domain Explorer → Bono → JTBD, Minto → Devil's Advocate → Investment Thesis)
- [ ] **PIPE-04**: Pipeline execution produces inspectable artifacts at each stage filed to Room sections

### Proactive Room Intelligence

- [ ] **PROA-01**: Room proactive skill detects gaps in Data Room sections ("no competitive analysis yet") and surfaces suggestions
- [ ] **PROA-02**: Room proactive skill detects contradictions between Room sections and alerts user
- [ ] **PROA-03**: Room proactive skill detects convergence signals (multiple frameworks pointing to same insight) and highlights them
- [ ] **PROA-04**: Proactive suggestions include confidence scores and are gated to prevent noise

### Brain MCP Integration

- [ ] **BRAN-01**: User can connect Brain MCP via `/mindrian-os:setup brain` (not in default config — zero startup cost)
- [ ] **BRAN-02**: Brain provides framework chain recommendations based on room state and problem classification
- [ ] **BRAN-03**: Brain provides calibrated grading via 5-component rubric (100+ real project calibration)
- [ ] **BRAN-04**: Brain provides mode engine calibration data for enhanced Larry personality
- [ ] **BRAN-05**: All Brain features gracefully degrade to Tier 0 static equivalents when Brain is unavailable

### Graceful Degradation

- [ ] **DEGS-01**: Plugin is fully functional with zero external dependencies (Tier 0)
- [ ] **DEGS-02**: references/ directory provides embedded framework definitions, static chain suggestions, and rubric as fallback for Brain
- [ ] **DEGS-03**: All features that depend on optional services (Brain, LazyGraph) have local fallbacks that still provide value

### Cross-Surface Compatibility

- [ ] **SURF-01**: Plugin works identically on Claude Code CLI, Desktop, and Cowork
- [ ] **SURF-02**: Cowork surface gets 00_Context/ directory for shared project state

### All 25 Methodologies

- [ ] **ALLM-01**: All 25 methodology bots from V2 are available as slash commands (remaining 17 beyond the core 8)
- [ ] **ALLM-02**: Each additional methodology follows the same thin skill + reference + pipeline pattern established in core 8

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
| (Populated during roadmap creation) | | |

**Coverage:**
- v1 requirements: 42 total
- Mapped to phases: 0
- Unmapped: 42 ⚠️

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-19 after initial definition*

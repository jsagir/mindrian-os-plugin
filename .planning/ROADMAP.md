# Roadmap: MindrianOS Plugin

## Overview

This roadmap delivers the MindrianOS Plugin in 5 phases following strict dependency order. Phase 1 creates the zero-config install experience where Larry talks immediately and the Data Room persists across sessions. Phase 2 builds ALL 25+ methodology commands with structured artifact output, passive Room intelligence, and problem type classification routing. Phase 3 activates the "OS" experience through pipeline chaining and proactive intelligence. Phase 4 connects the Brain MCP moat for enriched routing and calibrated grading. Phase 5 adds plugin self-update, context window awareness, and capability radar — the infrastructure that keeps MindrianOS alive and evolving. Every phase delivers a coherent, independently verifiable capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Install and Larry Talks** - Plugin skeleton, Larry personality, Data Room with state system, hooks, graceful degradation, cross-surface compatibility (completed 2026-03-20)
- [x] **Phase 2: Core Methodologies** - ALL 25+ methodology commands with structured artifact output, passive Room intelligence, and problem type classification routing (completed 2026-03-22)
- [ ] **Phase 3: Pipeline Chaining and Proactive Intelligence** - Multi-step methodology workflows where output becomes input, plus gap/contradiction/convergence detection
- [ ] **Phase 4: Brain MCP Integration** - Brain enrichment integration for enhanced routing, calibrated grading, and mode engine
- [ ] **Phase 5: Plugin Intelligence Infrastructure** - Self-update system, context window awareness, Claude capability radar — keeps MindrianOS alive and evolving

## Phase Details

### Phase 1: Install and Larry Talks
**Goal**: Users install with one command and immediately have Larry guiding them through a persistent, structured Data Room that survives across sessions -- with zero configuration and zero external dependencies
**Depends on**: Nothing (first phase)
**Requirements**: PLGN-01, PLGN-02, PLGN-03, PLGN-04, PLGN-05, LARY-01, LARY-02, LARY-03, LARY-04, ROOM-01, ROOM-02, ROOM-03, ROOM-04, ROOM-05, DEGS-01, DEGS-02, DEGS-03, SURF-01, SURF-02
**Success Criteria** (what must be TRUE):
  1. User runs `claude plugin install mindrian-os` and Larry responds to their first message with his teaching personality -- no setup steps, no configuration prompts
  2. User can run `/mindrian-os:help` and `/mindrian-os:status` to discover commands and see current Room state
  3. User's workspace has 8 Data Room sections and STATE.md is computed from filesystem truth via hooks (not maintained by Claude)
  4. User closes Claude, reopens later, and SessionStart hook restores their full Room context -- work persists across sessions
  5. Plugin auto-loaded skills consume under 2% of context window; all features work identically on CLI, Desktop, and Cowork
**Plans:** 3/3 plans complete

Plans:
- [x] 01-01-PLAN.md -- Larry agent with V2-ported personality, auto-loaded skills, reference files, plugin manifest
- [x] 01-02-PLAN.md -- Data Room initialization (new-project command), hook scripts, state computation system
- [x] 01-03-PLAN.md -- Help/status/room commands, graceful degradation verification, cross-surface readiness

### Phase 2: Core Methodologies
**Goal**: ALL 25+ methodology commands built with structured artifact output, passive Room intelligence, and problem type classification routing -- the full methodology teaching experience
**Depends on**: Phase 1
**Requirements**: METH-01, METH-02, METH-03, METH-04, METH-05, METH-06, METH-07, METH-08, METH-09, METH-10, PASS-01, PASS-02, PASS-03, ALLM-01, ALLM-02
**Success Criteria** (what must be TRUE):
  1. User can invoke ALL 25+ methodologies via action-oriented slash commands and receive adaptive, Larry-guided sessions with user-controlled depth
  2. Each methodology produces framework-specific markdown artifacts in Larry's voice, filed to the appropriate Data Room section with provenance metadata
  3. PostToolUse hook auto-classifies insights via hybrid pattern (hook keyword match + room-passive skill for uncertain cases), user confirms before filing
  4. Each methodology uses thin skill + on-demand reference loading pattern, with problem type classification (un/ill/well-defined + wicked) driving routing
  5. PWS Grading command provides basic assessment using static rubric from references/
**Plans:** 5/5 plans complete

Plans:
- [x] 02-01-PLAN.md -- Pattern foundation: problem-types reference, updated routing index, Tier 1-2 batch (7 simplest commands)
- [x] 02-02-PLAN.md -- Tier 3 batch: 8 framework workshop commands (Domain Explorer, Minto, Bono, JTBD, Reverse Salient, TTA, S-Curve, Ackoff)
- [x] 02-03-PLAN.md -- Tier 4 batch: 7 complex workshop commands (Scenario Planning, Validation, Futures, Root Cause, Macro Trends, Dominant Designs, User Needs)
- [x] 02-04-PLAN.md -- Tier 5 specials: 4 commands with custom logic (Grade, Investment Thesis, HSI, Diagnose)
- [x] 02-05-PLAN.md -- Passive Room intelligence: PostToolUse hook, classification script, room-passive filing, help command update

### Phase 3: Pipeline Chaining and Proactive Intelligence
**Goal**: Users can run multi-step methodology sequences where each framework's output feeds the next, and the Room actively detects gaps, contradictions, and convergence across their work
**Depends on**: Phase 2
**Requirements**: PIPE-01, PIPE-02, PIPE-03, PIPE-04, PROA-01, PROA-02, PROA-03, PROA-04
**Success Criteria** (what must be TRUE):
  1. User can execute at least 2 pipeline sequences end-to-end (Domain Explorer to Bono to JTBD; Minto to Devil's Advocate to Investment Thesis) with each stage's output becoming structured input to the next
  2. Pipeline execution produces inspectable artifacts at each stage, all filed to Room sections with clear provenance chain
  3. Room proactive skill surfaces gap suggestions ("no competitive analysis yet"), contradiction alerts, and convergence signals with confidence scores
  4. Proactive suggestions are gated to prevent noise -- user is not overwhelmed by low-confidence alerts
**Plans:** 2 plans

Plans:
- [ ] 03-01-PLAN.md -- Pipeline stage contracts (Discovery + Thesis chains), pipeline command, chains-index reference
- [ ] 03-02-PLAN.md -- Proactive Room intelligence: analyze-room script, room-proactive skill, session-start hook integration

### Phase 3.1: Data Room Dashboard (INSERTED)
**Goal**: Users can run `/mindrian-os:room view` to launch a localhost De Stijl dashboard showing their Data Room as an interactive knowledge graph with a chat box for natural language querying — the visual front door to their venture work
**Depends on**: Phase 3
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05
**Success Criteria** (what must be TRUE):
  1. User runs `/mindrian-os:room view` and a localhost server opens in their browser showing the Data Room as an interactive Cytoscape.js knowledge graph in full De Stijl aesthetic (dark bg, Bebas Neue, 0 border-radius, 8 semantic section colors)
  2. Graph nodes represent insights/artifacts colored by room section, edges show INFORMS/CONTRADICTS/CONVERGES/FEEDS_INTO relationships, and user can zoom, pan, drag, click to expand
  3. Chat box at the bottom allows natural language queries about the room ("what gaps do I have?", "show contradictions") and returns natural language answers
  4. Dashboard auto-generates graph data from room/ directory contents and provenance metadata — no manual graph building required
  5. Everything runs locally on localhost — zero cloud dependency, fully private
**Plans:** 2 plans

Plans:
- [ ] 03.1-01-PLAN.md — Graph data pipeline (build-graph + serve-dashboard scripts) and De Stijl Cytoscape.js dashboard HTML
- [ ] 03.1-02-PLAN.md — Chat intelligence panel and room view command wiring

### Phase 3.2: Document Generation (INSERTED)
**Goal**: Users can run `/mindrian-os:export` to generate professional De Stijl PDFs from their Data Room — investment thesis, executive summary, due diligence report, PWS profiles, pitch deck, venture brief — all with zero additional dependencies using WeasyPrint + Jinja2
**Depends on**: Phase 3.1
**Requirements**: DOCS-01, DOCS-02, DOCS-03, DOCS-04, DOCS-05
**Success Criteria** (what must be TRUE):
  1. User runs `/mindrian-os:export thesis` and gets a multi-page De Stijl PDF with room sections mapped to document sections, running headers/footers, and bundled Bebas Neue font
  2. At least 4 document types work: thesis, summary, report, profile — each with a Jinja2 template and shared CSS
  3. PWS Profile generation creates structured profiles from methodology outputs (Bono perspectives, Domain Explorer domains, JTBD personas)
  4. No additional dependencies — WeasyPrint, markdown2, Jinja2, PyMuPDF already installed
  5. Exports land in room/exports/ with clear filenames and open automatically
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 3.2 to break down)

### Phase 4: Brain MCP Integration
**Goal**: Users who connect Brain get enriched framework chaining, calibrated grading, enhanced Larry mode engine, and contextual problem-type routing -- the moat activates
**Depends on**: Phase 3
**Requirements**: BRAN-01, BRAN-02, BRAN-03, BRAN-04, BRAN-05
**Success Criteria** (what must be TRUE):
  1. User runs `/mindrian-os:setup brain` to connect Brain MCP -- it is NOT in default config and adds zero startup cost for Tier 0 users
  2. Brain-connected users get enriched framework chain recommendations, calibrated 5-component grading (from 100+ real projects), and enhanced Larry mode engine -- all gracefully degrade to Tier 0 static equivalents when Brain is unavailable
  3. Brain's ADDRESSES_PROBLEM_TYPE and CO_OCCURS relationships enhance methodology routing beyond static references
**Plans**: TBD

Plans:
- [ ] 04-01: Brain MCP integration, setup command, and graceful degradation

### Phase 5: Plugin Intelligence Infrastructure
**Goal**: MindrianOS can update itself, manage its own context budget intelligently, and automatically discover new Claude capabilities that amplify the plugin — the infrastructure that keeps the OS alive and evolving
**Depends on**: Phase 1 (uses hooks, commands, skills patterns established there)
**Requirements**: UPDT-01, UPDT-02, CTXW-01, CTXW-02, RADR-01, RADR-02
**Success Criteria** (what must be TRUE):
  1. User runs `/mindrian-os:update` and gets version check, changelog display, clean install with user modification backup, and post-update reapply — modeled on GSD's proven update workflow
  2. Plugin actively monitors context window consumption and adapts loading strategy — compresses references, defers skill loading, warns user when approaching limits, works on both 200K (Sonnet) and 1M (Opus) contexts
  3. Plugin tracks official Anthropic releases (Newsroom, Blog, Claude Code changelog, Releasebot feeds) and surfaces new capabilities relevant to MindrianOS, tagged by domain (models, code, desktop_cowork, plugins_mcp, visualization)
  4. Context awareness differentiates behavior by model context size — Sonnet users get aggressive reference compression, Opus users get richer inline context
**Plans**: TBD

Plans:
- [ ] 05-01: Self-update system (version detection, changelog, clean install, modification backup/reapply)
- [ ] 05-02: Context window awareness (consumption monitoring, adaptive loading, model-aware strategy)
- [ ] 05-03: Claude capability radar (official feed ingestion, domain tagging, daily digest, opportunity surfacing)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 3.1 → 3.2 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Install and Larry Talks | 3/3 | Complete   | 2026-03-20 |
| 2. Core Methodologies | 5/5 | Complete   | 2026-03-22 |
| 3. Pipeline Chaining and Proactive Intelligence | 2/2 | Complete   | 2026-03-22 |
| 3.1 Data Room Dashboard (INSERTED) | 2/2 | Complete   | 2026-03-22 |
| 3.2 Document Generation (INSERTED) | 0/? | Not started | - |
| 4. Brain MCP Integration | 0/1 | Not started | - |
| 5. Plugin Intelligence Infrastructure | 0/3 | Not started | - |

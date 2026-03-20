# Roadmap: MindrianOS Plugin

## Overview

This roadmap delivers the MindrianOS Plugin in 5 phases following strict dependency order. Phase 1 creates the zero-config install experience where Larry talks immediately and the Data Room persists across sessions. Phase 2 ports the 8 core methodology commands with passive Room intelligence. Phase 3 activates the "OS" experience through pipeline chaining and proactive intelligence. Phase 4 connects the Brain MCP moat and expands to all 25 methodologies. Phase 5 adds plugin self-update, context window awareness, and capability radar — the infrastructure that keeps MindrianOS alive and evolving. Every phase delivers a coherent, independently verifiable capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Install and Larry Talks** - Plugin skeleton, Larry personality, Data Room with state system, hooks, graceful degradation, cross-surface compatibility (completed 2026-03-20)
- [ ] **Phase 2: Core Methodologies** - 8 methodology commands with structured artifact output and passive Room intelligence (auto-classify, auto-file)
- [ ] **Phase 3: Pipeline Chaining and Proactive Intelligence** - Multi-step methodology workflows where output becomes input, plus gap/contradiction/convergence detection
- [ ] **Phase 4: Brain MCP and Full Methodology Suite** - Brain enrichment integration and remaining 17 methodology commands
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
- [ ] 01-01-PLAN.md -- Larry agent with V2-ported personality, auto-loaded skills, reference files, plugin manifest
- [ ] 01-02-PLAN.md -- Data Room initialization (new-project command), hook scripts, state computation system
- [ ] 01-03-PLAN.md -- Help/status/room commands, graceful degradation verification, cross-surface readiness

### Phase 2: Core Methodologies
**Goal**: Users can invoke 8 core methodology commands that produce structured artifacts automatically filed to the correct Data Room sections -- the methodology teaching experience comes alive
**Depends on**: Phase 1
**Requirements**: METH-01, METH-02, METH-03, METH-04, METH-05, METH-06, METH-07, METH-08, METH-09, METH-10, PASS-01, PASS-02, PASS-03
**Success Criteria** (what must be TRUE):
  1. User can invoke each of the 8 core methodologies (Domain Explorer, Minto, Bono, JTBD, Devil's Advocate, HSI, Investment Thesis, Lean Canvas) via slash commands and receive structured guided sessions
  2. Each methodology produces markdown artifacts filed to the appropriate Data Room section with provenance metadata (source, timestamp, session)
  3. PostToolUse hook auto-classifies insights from methodology conversations into correct Room sections without user action
  4. Each methodology skill file is under 300 tokens with on-demand reference loading from references/ directory
**Plans**: TBD

Plans:
- [ ] 02-01: Thin skill pattern, references, and first 4 methodologies (Domain Explorer, Minto, Bono, JTBD)
- [ ] 02-02: Remaining 4 methodologies (Devil's Advocate, HSI, Investment Thesis, Lean Canvas) and passive Room intelligence hooks

### Phase 3: Pipeline Chaining and Proactive Intelligence
**Goal**: Users can run multi-step methodology sequences where each framework's output feeds the next, and the Room actively detects gaps, contradictions, and convergence across their work
**Depends on**: Phase 2
**Requirements**: PIPE-01, PIPE-02, PIPE-03, PIPE-04, PROA-01, PROA-02, PROA-03, PROA-04
**Success Criteria** (what must be TRUE):
  1. User can execute at least 2 pipeline sequences end-to-end (Domain Explorer to Bono to JTBD; Minto to Devil's Advocate to Investment Thesis) with each stage's output becoming structured input to the next
  2. Pipeline execution produces inspectable artifacts at each stage, all filed to Room sections with clear provenance chain
  3. Room proactive skill surfaces gap suggestions ("no competitive analysis yet"), contradiction alerts, and convergence signals with confidence scores
  4. Proactive suggestions are gated to prevent noise -- user is not overwhelmed by low-confidence alerts
**Plans**: TBD

Plans:
- [ ] 03-01: Pipeline stage contracts and chaining engine
- [ ] 03-02: Proactive Room intelligence (gaps, contradictions, convergence)

### Phase 4: Brain MCP and Full Methodology Suite
**Goal**: Users who connect Brain get enriched framework chaining, calibrated grading, and enhanced Larry personality, while all 25 methodologies are available as commands
**Depends on**: Phase 3
**Requirements**: BRAN-01, BRAN-02, BRAN-03, BRAN-04, BRAN-05, ALLM-01, ALLM-02
**Success Criteria** (what must be TRUE):
  1. User runs `/mindrian-os:setup brain` to connect Brain MCP -- it is NOT in default config and adds zero startup cost for Tier 0 users
  2. Brain-connected users get enriched framework chain recommendations, calibrated 5-component grading (from 100+ real projects), and enhanced Larry mode engine -- all gracefully degrade to Tier 0 static equivalents when Brain is unavailable
  3. All 25 methodology bots from V2 are available as slash commands, each following the same thin skill + reference + pipeline pattern established in Phase 2
**Plans**: TBD

Plans:
- [ ] 04-01: Brain MCP integration and graceful degradation
- [ ] 04-02: Remaining 17 methodology commands

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
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Install and Larry Talks | 3/3 | Complete   | 2026-03-20 |
| 2. Core Methodologies | 0/2 | Not started | - |
| 3. Pipeline Chaining and Proactive Intelligence | 0/2 | Not started | - |
| 4. Brain MCP and Full Methodology Suite | 0/2 | Not started | - |
| 5. Plugin Intelligence Infrastructure | 0/3 | Not started | - |

# Requirements - v1.6.0 Powerhouse

**Defined:** 2026-03-31
**Core Value:** Users can run the full PWS methodology inside Claude Code with zero infrastructure, where Larry guides them through venture innovation
**Moat:** Every requirement deepens the MWP moat (7 layers + 9 edge types + Brain IP + teaching calibration)

---

## v1.6.0 Requirements

### Hook Expansion

- [ ] **HOOK-01**: PreCompact hook saves room STATE.md, methodology progress, last 5 artifacts, and MINTO confidence levels to temp file before autocompact
- [ ] **HOOK-02**: PostCompact hook restores saved room context as additionalContext after autocompact, including venture stage and pending verifications
- [ ] **HOOK-03**: FileChanged hook detects external modifications to room files and re-runs post-write cascade (classify, KuzuDB index, build-graph, compute-state)
- [ ] **HOOK-04**: CwdChanged hook auto-switches active room when user changes directory to a registered room path
- [ ] **HOOK-05**: SubagentStop hook auto-routes framework-runner/grading/research/opportunity-scanner/persona-analyst output through post-write cascade
- [ ] **HOOK-06**: TaskCompleted hook updates pipeline progress in STATE.md, checks REASONING.md staleness, and surfaces next-stage readiness

### Model Routing

- [x] **MODEL-01**: lib/core/model-profiles.cjs with MODEL_PROFILES table mapping 8 agents to 4 profile tiers (quality/balanced/budget/inherit)
- [x] **MODEL-02**: Venture-stage adaptive hints that auto-select model tier based on STATE.md venture stage (Pre-Opportunity=cheap, Investment=opus)
- [ ] **MODEL-03**: /mos:models command for viewing current profile, switching profiles, and overriding specific agents
- [x] **MODEL-04**: Per-room configuration stored in room/.config.json with model_profile and model_overrides fields
- [x] **MODEL-05**: Cascade step model routing: haiku for classify, sonnet for edge detection and proactive analysis
- [x] **MODEL-06**: 5-step model resolution: override > stage-hint > runtime > profile > default

### Parallel Agent Patterns

- [ ] **PARA-01**: /mos:act --swarm dispatches 3 framework-runners in parallel across highest-gap sections with per-agent model resolution
- [ ] **PARA-02**: /mos:persona --parallel dispatches 6 persona-analyst agents (one per De Bono hat) simultaneously
- [ ] **PARA-03**: /mos:grade --full dispatches 8 grading agents (one per section) in parallel with REASONING.md verification
- [ ] **PARA-04**: /mos:research --broad dispatches 3 research agents (academic, market, competitor) in parallel
- [ ] **PARA-05**: Cross-cascade emergent discovery: parallel filings trigger HSI recomputation finding cross-agent innovation connections

### Spectral OM-HMM (DONE)

- [x] **SPEC-01**: Markov chain thinking-mode transition analysis with 5 modes (analytical, integrative, descriptive, evaluative, creative)
- [x] **SPEC-02**: Spectral gap scoring (eigenvalue decomposition) replaces keyword-density proxy in compute-hsi.py
- [x] **SPEC-03**: Per-artifact spectral profiles in .hsi-results.json (omhmm_score, spectral_gap, dominant_mode, mode_entropy, absorbing_score)
- [x] **SPEC-04**: 15% spectral bonus in reverse salient breakthrough scoring (detect-reverse-salients.py)

### Sentinel Mode

- [ ] **SENT-01**: Weekly room health check comparing STATE.md against previous week snapshot
- [ ] **SENT-02**: Daily grant deadline monitor scanning room/funding/ and room/opportunity-bank/
- [ ] **SENT-03**: Weekly competitor watch researching tracked competitors with contradiction flagging
- [ ] **SENT-04**: Weekly HSI recomputation updating HSI_CONNECTION and REVERSE_SALIENT edges
- [ ] **SENT-05**: /mos:scout command as manual fallback running all sentinel tasks
- [ ] **SENT-06**: room/.intelligence/ directory for cron-generated alerts and digests
- [ ] **SENT-07**: room/.snapshots/ directory with weekly STATE.md copies for comparison

### Design-by-Analogy Pipeline

- [ ] **DBA-01**: pipelines/analogy/CHAIN.md with 5 stages: Decompose, Abstract, Search, Transfer, Validate
- [ ] **DBA-02**: Stage 1 DECOMPOSE extracts SAPPhIRE function-behavior-structure triples from room artifacts
- [ ] **DBA-03**: Stage 2 ABSTRACT strips domain language, maps to TRIZ parameter space, produces functional keywords
- [ ] **DBA-04**: Stage 3 SEARCH runs dual-mode: internal (KuzuDB + Brain) and external (Tavily MCP for AskNature, patents, academic)
- [ ] **DBA-05**: Stage 4 TRANSFER builds correspondence tables mapping source domain solutions to venture domain
- [ ] **DBA-06**: Stage 5 VALIDATE stress-tests structural mappings via challenge-assumptions
- [ ] **DBA-07**: /mos:find-analogies command with --brain and --external modes
- [ ] **DBA-08**: 3 new KuzuDB edge types: ANALOGOUS_TO, STRUCTURALLY_ISOMORPHIC, RESOLVES_VIA
- [ ] **DBA-09**: TRIZ contradiction classification on CONTRADICTS edges with triz_improving_param, triz_worsening_param, triz_principles
- [ ] **DBA-10**: references/methodology/triz-matrix.json and triz-principles.md static reference files
- [ ] **DBA-11**: references/methodology/sapphire-encoding.md guide for SAPPhIRE extraction
- [ ] **DBA-12**: brain_analogy_search Cypher query pattern for cross-domain framework retrieval

### Platform Optimization

- [ ] **PLAT-01**: Session-start restructured for prompt cache hits: stable sections separated from dynamic room context
- [ ] **PLAT-02**: CLAUDE.md split into modular sections using @include directive
- [ ] **PLAT-03**: Deep link protocol (claude-cli://open) for room navigation and dashboard handoff
- [ ] **PLAT-04**: AUTOCOMPACT_PCT_OVERRIDE tuned for room-aware thresholds
- [ ] **PLAT-05**: MAX_THINKING_TOKENS override for grading and methodology depth
- [ ] **PLAT-06**: CLAUDE_CODE_MAX_CONTEXT_TOKENS for deep sessions

### Future-Proofing

- [ ] **FUTURE-01**: room/.context/ directory with KAIROS-compatible session files
- [ ] **FUTURE-02**: Enhanced Stop hook writing session log to room/.context/last-session.md
- [ ] **FUTURE-03**: .claude/teams/mindrian.json Coordinator Mode team manifest
- [ ] **FUTURE-04**: docs/MWP-SPECIFICATION.md formal protocol specification

### Moat Documentation

- [ ] **MOAT-01**: Internal dev team mandate document for moat-first review
- [ ] **MOAT-02**: CLAUDE.md moat section for contributor awareness
- [ ] **MOAT-03**: Phase review template with moat deepening assessment field

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MODEL-01 | Phase 39 | Complete |
| MODEL-02 | Phase 39 | Complete |
| MODEL-03 | Phase 39 | Pending |
| MODEL-04 | Phase 39 | Complete |
| MODEL-05 | Phase 39 | Complete |
| MODEL-06 | Phase 39 | Complete |
| HOOK-01 | Phase 40 | Pending |
| HOOK-02 | Phase 40 | Pending |
| HOOK-03 | Phase 40 | Pending |
| HOOK-04 | Phase 40 | Pending |
| HOOK-05 | Phase 40 | Pending |
| HOOK-06 | Phase 40 | Pending |
| PARA-01 | Phase 41 | Pending |
| PARA-02 | Phase 41 | Pending |
| PARA-03 | Phase 41 | Pending |
| PARA-04 | Phase 41 | Pending |
| PARA-05 | Phase 41 | Pending |
| SPEC-01 | Pre-roadmap | Done |
| SPEC-02 | Pre-roadmap | Done |
| SPEC-03 | Pre-roadmap | Done |
| SPEC-04 | Pre-roadmap | Done |
| PLAT-01 | Phase 42 | Pending |
| PLAT-02 | Phase 42 | Pending |
| PLAT-03 | Phase 42 | Pending |
| PLAT-04 | Phase 42 | Pending |
| PLAT-05 | Phase 42 | Pending |
| PLAT-06 | Phase 42 | Pending |
| SENT-01 | Phase 43 | Pending |
| SENT-02 | Phase 43 | Pending |
| SENT-03 | Phase 43 | Pending |
| SENT-04 | Phase 43 | Pending |
| SENT-05 | Phase 43 | Pending |
| SENT-06 | Phase 43 | Pending |
| SENT-07 | Phase 43 | Pending |
| DBA-08 | Phase 44 | Pending |
| DBA-09 | Phase 44 | Pending |
| DBA-10 | Phase 44 | Pending |
| DBA-11 | Phase 44 | Pending |
| DBA-12 | Phase 44 | Pending |
| DBA-01 | Phase 45 | Pending |
| DBA-02 | Phase 45 | Pending |
| DBA-03 | Phase 45 | Pending |
| DBA-04 | Phase 45 | Pending |
| DBA-05 | Phase 45 | Pending |
| DBA-06 | Phase 45 | Pending |
| DBA-07 | Phase 45 | Pending |
| FUTURE-01 | Phase 46 | Pending |
| FUTURE-02 | Phase 46 | Pending |
| FUTURE-03 | Phase 46 | Pending |
| FUTURE-04 | Phase 46 | Pending |
| MOAT-01 | Phase 46 | Pending |
| MOAT-02 | Phase 46 | Pending |
| MOAT-03 | Phase 46 | Pending |

---

## Future Requirements (Deferred)

- Daemon wrappers -- blocked by DAEMON build flag
- UDS IPC protocol -- blocked by UDS_INBOX build flag
- Bridge API endpoints -- blocked by BRIDGE_MODE build flag
- UltraPlan wrapper -- blocked by tengu_ultraplan_model gate
- Buddy Larry skin -- blocked by BUDDY build flag
- Scratchpad integration -- blocked by tengu_scratch gate
- Random walk innovation pathways -- post-1.6.0 research
- NLP thinking-mode classifier -- post-1.6.0 research
- PageRank cascade prediction -- post-1.6.0 research

## Out of Scope

- Full NLP classifier for thinking modes -- regex is fast, dependency-free, meaningful
- Rewriting existing cascade pipeline -- additive only
- New room sections -- adds edges and metadata, not sections
- Payment/billing -- marketplace handles externally
- Mobile/web UI -- Claude surfaces handle natively

---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: completed
stopped_at: Completed 05-01-PLAN.md
last_updated: "2026-03-22T13:47:29.441Z"
last_activity: 2026-03-22 -- Completed 05-03 Capability Radar (2 tasks, 4 files)
progress:
  total_phases: 7
  completed_phases: 7
  total_plans: 20
  completed_plans: 20
  percent: 95
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-19)

**Core value:** Users can run the full PWS methodology inside Claude Code with zero infrastructure -- Larry guides them through venture innovation with a persistent Data Room and optional Brain enrichment.
**Current focus:** Phase 5: Plugin Intelligence Infrastructure -- context awareness, self-update, capability radar

## Current Position

Phase: 5 of 7 (Plugin Intelligence Infrastructure) -- COMPLETE
Plan: 3 of 3 in current phase (05-03 complete)
Status: Phase 5 Complete
Last activity: 2026-03-22 -- Completed 05-03 Capability Radar (2 tasks, 4 files)

Progress: [██████████] 95%

## Performance Metrics

**Velocity:**
- Total plans completed: 1
- Average duration: 3min
- Total execution time: 0.05 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-install-and-larry-talks | 1/3 | 3min | 3min |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 01-03 P03 | 4min | 3 tasks | 4 files |
| Phase 02 P03 | 7min | 2 tasks | 14 files |
| Phase 02 P02 | 7min | 2 tasks | 16 files |
| Phase 02 P04 | 5min | 2 tasks | 8 files |
| Phase 03 P02 | 2min | 2 tasks | 4 files |
| Phase 03 P01 | 3min | 2 tasks | 10 files |
| Phase 03.1 P01 | 3min | 2 tasks | 4 files |
| Phase 03.1 P02 | 2min | 3 tasks | 2 files |
| Phase 03.2 P01 | 12min | 2 tasks | 13 files |
| Phase 03.2 P02 | 4min | 2 tasks | 2 files |
| Phase 04 P01 | 3min | 2 tasks | 4 files |
| Phase 04 P02 | 2min | 2 tasks | 4 files |
| Phase 04 P03 | 3min | 2 tasks | 11 files |
| Phase 05 P03 | 2min | 2 tasks | 4 files |
| Phase 05 P02 | 2min | 2 tasks | 4 files |
| Phase 05 P01 | 4min | 2 tasks | 7 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Coarse granularity -- 4 phases combining aggressively by dependency order
- [Roadmap]: Phase 1 bundles plugin skeleton + Larry + Room + hooks + degradation + surfaces (19 reqs) because they are all part of the "install and it works" experience
- [Roadmap]: Passive intelligence grouped with core methodologies (Phase 2) since auto-filing requires methodology output to exist
- [Roadmap]: Brain MCP and remaining 17 methodologies combined in Phase 4 -- both are expansion, not core
- [01-02]: STATE.md always computed by compute-state script, never written directly by Claude
- [01-02]: Platform detection via CURSOR_PLUGIN_ROOT vs CLAUDE_PLUGIN_ROOT env vars
- [01-02]: Venture stage inferred progressively from which room sections have entries
- [01-02]: run-hook.cmd routes to scripts/ directory, keeping hook wrapper separate from implementations
- [Phase 01-03]: help --all shows full command list grouped by venture stage with coming soon markers
- [Phase 01-03]: status shows Brain connection as one-line indicator, not promotional
- [Phase 01-03]: room export strips all internal metadata for clean investor output
- [02-01]: Three-file methodology pattern validated: thin command + thick reference + routing index entry
- [02-01]: All 26 commands listed as Phase 2 in routing index (no Phase 4 split)
- [02-01]: lean-canvas built from scratch with Larry voice (no V2 source)
- [02-01]: V2 porting: strip File Search, JSON, temperature; keep phases, voice, anti-patterns
- [Phase 02]: root-cause uses 4 DACE phases (not 6) matching V2 source -- 5 methods within Phase 2 provide equivalent depth
- [Phase 02]: explore-futures synthesizes TTA + Scenario + S-Curve as layered lenses, not three separate workshops
- [Phase 02-02]: All 8 V2 prompts ported with strip/keep rules: removed File Search, JSON, temperature; kept phases, voice, anti-patterns, homework
- [Phase 02-02]: Ackoff supports climb up/down directions; S-Curve has 6 phases; Reverse Salient includes honest failure protocol
- [Phase 02-04]: Gate threshold 6/10 for Investment Thesis (V2 used 8/10 -- lowered for educational context)
- [Phase 02-04]: HSI is conversational only for Tier 0 -- Brain MCP upgrade path documented for quantitative BERT/LSA
- [Phase 02-04]: Diagnose never announces classification labels -- describes problem type in plain language
- [Phase 02-05]: Passive Room intelligence complete -- PostToolUse hook, classify-insight script, room-passive filing, help updated with all 26 commands
- [Phase 03]: Larry IS the engine -- no state machine or orchestration code. Stage contracts are markdown that tell Larry what to extract/inject
- [Phase 03]: Two concrete pipelines: Discovery (explore-domains -> think-hats -> analyze-needs) and Thesis (structure-argument -> challenge-assumptions -> build-thesis)
- [Phase 03]: Proactive noise gate: max 2 HIGH-confidence findings in session greeting. Venture stage filters irrelevant alerts
- [Phase 03]: Two-layer proactive: bash script (structural detection) + Claude skill (semantic interpretation)
- [Phase 03]: Two-layer proactive: bash structural detection + Claude semantic interpretation
- [Phase 03]: Noise gate: max 2 HIGH-confidence findings in SessionStart greeting, venture stage filtering
- [Phase 03-01]: Stage contracts wrap methodologies with input/output context -- never modify methodology commands
- [Phase 03.1-01]: CoSE layout for 13+ nodes, grid for fewer -- prevents node overlap with small graphs
- [Phase 03.1-01]: graph.json served separately via fetch -- allows refresh without regenerating HTML
- [Phase 03.1-01]: Intelligence stored in window.__roomIntelligence for Plan 02 chat consumption
- [Phase 03.1]: Client-side regex matching over pre-computed intelligence -- zero API dependencies
- [Phase 03.1]: Text-based overview remains default room command; explicit 'view' launches browser dashboard
- [Phase 03.2]: Fonts sourced from fontsource CDN and dharmatype GitHub for reliable TTF downloads
- [Phase 03.2]: Profile template filters entries by metadata.source for methodology-output grid mapping
- [Phase 03.2]: base_url=PLUGIN_DIR for WeasyPrint font resolution; DOC_TYPES limited to 4 types with existing templates
- [Phase 03.2]: TOC bookmarks only for thesis/report; WSL detection via /proc/version matching serve-dashboard pattern
- [Phase 04-01]: MCP tool names derived from .mcp.json server names (neo4j-brain -> mcp__neo4j-brain__read_neo4j_cypher)
- [Phase 04-01]: brain-connector replaces room-proactive bash analysis for Brain users (brain_gap_assess is superset)
- [Phase 04-01]: All Cypher lives in query-patterns.md only -- skills and agents reference, never embed
- [Phase 04-02]: Each agent explicitly declares NOT Larry voice rules to prevent personality bleed
- [Phase 04-02]: All agents reference query-patterns.md on demand -- zero inline Cypher in agent files
- [Phase 04-02]: Investor Agent is genuinely adversarial with VC-specific language, not softened Larry
- [Phase 04-02]: Research Agent requires user confirmation before filing to room -- no silent writes
- [Phase 04]: All existing command modifications strictly additive -- Brain Enhancement sections before Setup, original logic untouched
- [Phase 04]: deep-grade and research use thin command + agent delegation pattern
- [Phase 04]: Mode engine Brain Calibration limited to 15% max delta from static 40/30/20/10 baseline
- [Phase 05]: Radar is on-demand only -- no SessionStart network calls, no daily digest
- [Phase 05]: 5 domain tags: models, code, desktop_cowork, plugins_mcp, visualization
- [Phase 05]: WebFetch pulls GitHub raw CHANGELOG.md with focused extraction prompt
- [Phase 05]: Bridge file uses KEY=VALUE format for bash-native parsing (no jq dependency for consumers)
- [Phase 05]: Conservative defaults (200K, 50% usage) when bridge missing or stale -- never crash
- [Phase 05-01]: python3 for JSON parsing instead of jq (environment compatibility)
- [Phase 05-01]: Scripts output structured status codes for reliable command parsing
- [Phase 05-01]: reapply-modifications lists but does not auto-copy (plugin dir may be read-only)

### Roadmap Evolution

- Phase 3.1 inserted after Phase 3: Data Room Dashboard — localhost De Stijl viewer with knowledge graph and chat (URGENT — critical path, visual front door to the project)

### Pending Todos

- **Self-update system**: MindrianOS needs its own `/mindrian-os:update` command (like GSD's update workflow) — version detection, changelog display, clean install, cache clearing. Essential for marketplace distribution.
- **Context window awareness**: Plugin should be aware of current context consumption and adapt behavior — compress references, defer loading, warn when approaching limits. Critical for users on Sonnet (200K) vs Opus (1M).
- **Claude capability radar**: Auto-track official Anthropic releases (Newsroom, Claude Blog, Claude Code changelog, Releasebot feeds) to discover new features that amplify MindrianOS — tag by domain (models, code, desktop_cowork, plugins_mcp, visualization_svg), generate daily digest, surface opportunities to enhance the plugin.

### Blockers/Concerns

- Context budget (2% target) must be validated empirically in Phase 1 -- research estimates 30-50K tokens for full overhead
- V2 prompt porting trap: each methodology must be redesigned for Claude Code, not naively copied from Gemini/Python prompts
- Three-surface behavior differences not fully enumerated -- needs hands-on testing from Phase 1

## Session Continuity

Last session: 2026-03-22T13:47:29.437Z
Stopped at: Completed 05-01-PLAN.md
Resume file: None

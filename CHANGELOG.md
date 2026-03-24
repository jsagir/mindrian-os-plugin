# Changelog

All notable changes to MindrianOS Plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0] - 2026-03-24

### Added
- **Cross-Meeting Intelligence** — Convergence detection (same topic across 3+ meetings), severity-based contradiction flagging (high-impact = immediate, low-impact = summary), action item tracking across meetings (aggregated room/action-items.md with pre-filing triage), team contribution patterns (recurring concerns, influence shifts, role-gap analysis)
- **MEETINGS-INTELLIGENCE.md** — New computed intelligence file: convergence signals, active contradictions, action item aggregation, team-level cross-meeting patterns. Separate from TEAM-STATE.md (per-person vs cross-meeting focus)
- **Read AI MCP Integration** — `/mindrian-os:setup meetings` connects Read AI, Vexa, or Recall.ai MCP servers. `/mindrian-os:file-meeting --latest` auto-fetches most recent transcript without paste
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
- **Meeting Filing Command** (`/mindrian-os:file-meeting`) — Full 6-step pipeline: paste transcript, provide file path, or provide audio. Explicit flags (`--file`, `--audio`). Speaker identification with smart hybrid table (auto-matches from team/ directory). Priority-first segment classification with reasoning. Confirm-then-file UX with structured rejection reasons. Narrative + structured meeting summary with dual storage.
- **Velma Audio Transcription** (`scripts/transcribe-audio`) — Modulate Velma REST API wrapper (3¢/hour) with native speaker diarization and 20+ emotion signals. Setup via `/mindrian-os:setup transcription` or auto-prompt on first `--audio` use.
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
- **Meeting Transcript Filing** — Design spec for `/mindrian-os:file-meeting`: paste transcript, identify speakers + roles, classify segments, file to Data Room sections with confirmation. Meeting summary artifact with cross-references, contradictions, action items
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
- **Self-Update System** -- Version check, changelog display, modification backup/reapply flow via `/mindrian-os:update`
- **Infrastructure Commands** -- new-project, help, status, room, setup, update
- **Passive Room Filing** -- PostToolUse hook auto-classifies and files insights to room sub-rooms
- **Graceful Degradation** -- Full functionality at Tier 0 (no dependencies), enhanced with optional Neo4j and Brain

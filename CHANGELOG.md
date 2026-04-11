# Changelog

All notable changes to MindrianOS Plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- Onboarding Registry: Each version entry can include `onboarding: true/false` and `onboard_steps:` -->
<!-- When onboarding: true, the onboard_steps list is shown to returning users in the What's New flow -->
<!-- This allows new releases to automatically surface relevant guidance without code changes -->

## [1.9.6] - 2026-04-11

onboarding: true
onboard_steps:
  - "BREAKING: KuzuDB replaced with SQLite. Your Data Room graph now lives at room/.mindrian/room.db with WAL mode for concurrent access. Run /mos:room rebuild-graph to migrate."
  - "NEW: Memory system -- Larry remembers who you are (L0), what facts are current (L1), session history (L2), and conversation fragments (L3). Assumptions tracked with validity lifecycle."
  - "NEW: Natural language graph queries -- ask Larry about your room's connections in plain English. 10 built-in query patterns."
  - "NEW: Brain normalization -- 280 duplicate concepts merged, 73 contamination nodes removed, 20 new framework chains added."
  - "NEW: 4 intelligence algorithms -- blindspot coverage, Bayesian surprise, element novelty, disruption index."

### Changed
- **SQLite replaces KuzuDB** -- lazygraph-ops.cjs fully rewritten from KuzuDB/Cypher to better-sqlite3/SQL (762 lines, 21 exports, 52 tests). Dead dependency removed. Room graph at room/.mindrian/room.db with WAL mode for concurrent plugin + MCP access.
- **Intelligence cascade updated** -- checks .mindrian/room.db instead of .lazygraph/. Script references updated (hsi-to-graph.cjs, causal-to-graph.cjs, whitespace-to-graph.cjs).
- **28+ files migrated** -- all scripts, CLI, MCP tools, wiki, presentation generators updated from KuzuDB to SQLite.

### Added
- **Memory system** (memory-ops.cjs) -- 13 exports: identity (L0), facts with temporal validity (L1), sessions (L2), fragments (L3), assumption tracking with validity lifecycle (untested/supported/contradicted/stale). 35 tests.
- **NL graph queries** (nl-graph-queries.cjs) -- 10 natural language query templates: contradictions, neighbors, paths, stats, section artifacts, HSI connections, reverse salients, causal claims, whitespace zones, convergence.
- **Migration tool** (migrate-lazygraph.cjs) -- rebuild-from-artifacts approach with --dry-run, --force, --help.
- **Brain normalization** -- 280 "The X" prefix dupes merged, 73 file path nodes removed, 20 FEEDS_INTO edges added (leadership -> PWS methodology chains). Brain: 7,931 -> 7,578 concepts, 147 -> 167 FEEDS_INTO.
- **Wave 1 algorithms** -- compute-blindspot-mass.py (Good-Turing coverage), compute-bayesian-surprise.py (leave-one-out cosine shift), compute-element-novelty.py (per-artifact novelty), compute-disruption-index.py (CD index).
- **Larry server instructions** -- 114-line full personality for MCP server (voice, Ask-Tell dial, mode engine, framework delivery, tool usage patterns). Zero reduction from plugin personality.

### Removed
- **kuzu** npm dependency removed from package.json
- Deleted orphaned scripts: hsi-to-lazygraph.cjs, causal-to-lazygraph.cjs, whitespace-to-lazygraph.cjs, build-graph-from-kuzu.cjs

## [1.9.4] - 2026-04-09

onboarding: true
onboard_steps:
  - "NEW: Three ways to start. Explore (just think), Explore+Capture (room builds as you talk), or Build Then Work. MindrianOS detects whether you're a TTO, researcher, or business person and adapts."
  - "Every framework Larry runs now banks opportunities automatically. Your Opportunity Bank grows with every interaction -- well-defined problems paired with mirror solutions, scored by confidence."
  - "Returning users see their strongest banked opportunities in the greeting. The scratchpad persists across sessions so you never lose a thought."

### Added
- **Opportunity Extraction Engine** -- universal schema (problem + mirror solution + domain + evidence + knight_position + confidence). Every methodology command banks opportunities as a side effect via intelligence cascade Step 11.
- **Opportunity Graph** -- banked opportunities become KuzuDB nodes with ADDRESSES and IN_DOMAIN edges. Filter by domain, knight position, or confidence threshold.
- **Brain Validation Steps** -- Brain-connected users get suggested next frameworks from 100 frameworks x 131 FEEDS_INTO chains for each banked opportunity.
- **Conversation Mode Routing** -- sessions without a room present 3 modes with JTBD statements. Mode 2 (Explore+Capture) detects persona (TTO/Researcher/Business) and selects the right Brain framework chain.
- **getFrameworkChain(persona)** -- Brain queries FEEDS_INTO chains per persona with Tier 0 hardcoded fallback in persona-chains.md.
- **conversation-mode skill** -- new skill with persona detection signals, Mode 2 banking instructions, and framework chain guidance.
- **bank-opportunity CLI subcommand** -- Larry banks opportunities during conversation via `node bin/mindrian-tools.cjs bank-opportunity`.
- **scratchpad-ops.cjs** -- pre-room persistence at ~/.mindrian/scratchpad.json. Conversations persist across sessions without a room existing.
- **Room seeding from Opportunity Bank** -- new Step 6.1 in /mos:new-project migrates scratchpad opportunities into pre-loaded room sections.
- **Onboarding redesign** -- mode-first structure: Step 1 (Three Ways to Work), Step 2 (Opportunity Bank), Step 3 (Knight uncertainty/risk framing with persona examples).
- **Returning user opportunity greeting** -- session-start surfaces banked opportunity count and strongest opportunity for returning users.

## [1.9.3] - 2026-04-09

onboarding: true
onboard_steps:
  - "NEW: The intelligence loop is real. File an artifact and Larry will surface cross-subsystem impacts -- 'This changes your financial model assumption [0.82]'. Respond APPROVE, REJECT (with reason), or DEFER. Your decisions become graph data that makes the next scan smarter."
  - "Filing now produces a complete audit trail: automatic git commit, classification metadata in frontmatter, and cascade status visible to Larry."
  - "All scripts work on macOS now. No more GNU-only stat/find/date/readlink calls breaking on Darwin."

### Added
- **APPROVE/REJECT/DEFER workflow** -- after filing an artifact, Larry surfaces up to 2 cross-subsystem impacts with confidence scores. User responds APPROVE (cascade), REJECT (reason captured as graph data), or DEFER (parked). Decisions persist to .proactive-intelligence.json and become KuzuDB edges (CONFIRMS, INVALIDATES, DEFERRED).
- **Mid-session intelligence** -- new findings surface in Larry's next response after filing, not just at session start. Repeat suppression prevents noise (3+ showings auto-suppressed). New evidence resets suppression.
- **record-decision CLI subcommand** -- `node bin/mindrian-tools.cjs record-decision` wires decisions from skill instructions through to persistence and graph edges
- **getNewFindings()** -- compares current analysis vs last-persisted, returns only NEW or CHANGED findings with suppression filtering
- **recordDecision()** -- persists user APPROVE/REJECT/DEFER with timestamp, reason, and KuzuDB edge creation
- **CONFIRMS/DEFERRED/INVALIDATES edge types** -- new KuzuDB schema for decision tracking
- **Automatic git commit on artifact filing** -- structured message format "file(section): artifact title"
- **Classification in frontmatter** -- classify-insight result stored as `classification:` field in artifact YAML
- **Cascade status reporting** -- post-write hook echoes completion status to stdout for Larry's context

### Fixed
- **macOS portability** -- replaced all GNU-only `stat -c %Y`, `find -printf`, `readlink -f`, `date -d` calls with portable helpers across 13 scripts
- **/mos:radar registered in plugin.json** -- command was implemented but unreachable
- **VERIFICATION.md staleness** -- phases 39, 60, 62 checkboxes updated to match implementations
- **Brain fallback guards** -- leadership.md and hat-briefing.md now gracefully degrade without Brain
- **datetime.utcnow() deprecation** -- replaced with datetime.now(datetime.UTC) in 4 scripts
- **zod missing from package.json** -- MCP server peer dependency was not declared
- **classify-insight fire-and-forget** -- now synchronous, result consumed by cascade

## [1.9.2] - 2026-04-09

onboarding: true
onboard_steps:
  - "CRITICAL FIX: The filing cascade now actually fires. Every artifact you write triggers KuzuDB indexing, HSI scoring, state recomputation, graph rebuilding, and proactive intelligence persistence. Before this fix, the entire pipeline was silently dead."
  - "13 wiring fixes from a full 8-audit plugin scan: post-write hook, MCP routes, allowed-tools, hook timeouts, env detection."
  - "Desktop/Cowork users can now access /mos:whitespace and /mos:organize -- they had zero MCP routing before."

### Fixed
- **Post-write hook was dead** -- Claude Code passes file paths via stdin JSON, not positional args. The entire filing cascade (KuzuDB index, HSI, reverse salients, presentation regen) silently did nothing after every artifact write. Now reads from stdin with backward-compatible fallbacks.
- **Intelligence cascade missing 4 steps** -- artifact-id injection, compute-state, build-graph, and proactive intelligence persistence were never called. The loop from "artifact filed" to "Larry surfaces a finding" now actually works.
- **act-swarm phantom MCP route** -- registered in z.enum but handler fell through to dead-end "reference not found" message
- **SessionStart hook had no timeout** -- the heaviest hook could hang indefinitely. Now has 10s timeout.
- **consolidate-pinecone.py crashed on import** -- bare `from pinecone import Pinecone` with no try/except
- **Velma env var mismatch** -- integration-registry checked MODULATE_API_KEY but transcribe-audio used VELMA_API_KEY. Now checks both.
- **deep-grade and research commands blocked by own allowed-tools** -- declared only Read but needed Bash, Agent, WebSearch
- **6 commands missing allowed-tools entirely** -- funding, opportunities, persona, splash, reason, snapshot
- **visualize and wiki YAML scalar format** -- `allowed-tools: Bash` parsed as string not list
- **help.md missing Bash** -- admin identity check could not run
- **reason.md missing name: field** -- used command: instead of name:
- **post-write missing set -euo pipefail** -- only hook script without strict error handling

### Added
- **whitespace MCP route** -- Desktop/Cowork users can now access /mos:whitespace
- **organize MCP route** -- Desktop/Cowork users can now access /mos:organize
- **act-swarm MCP handler** -- full Brain-driven swarm execution via MCP
- **Array env detection** -- integration-registry now supports checking multiple env var names per integration

## [1.9.1] - 2026-04-08

onboarding: true
onboard_steps:
  - "NEW: /mos:validate-proposition -- score your value proposition through 3 gates: Is it Real? Can you Win? Is it Worth it? Mathematical VPS composite with 15 weighted dimensions."
  - "PWS Value Proposition Framework from Prof. Aronhime -- the Samsonite Test for every venture. A proposition is not good or bad, it is strong or weak."
  - "Value Canvas + BTC statement + B2B value drivers -- full quantitative assessment from problem case to business case."

### Added
- **PWS Value Proposition Framework** -- Lawrence Aronhime's 3-gate scoring system codified as /mos:validate-proposition
- **Three Sequential Gates** -- Is It Real? (R>=6.0), Can We Win? (W>=5.5), Is It Worth It? (V>=5.0) -- each must pass before the next
- **15 Weighted Scoring Dimensions** -- 5 per gate, each scored 0-10 with evidence, weighted by importance
- **VPS Composite Formula** -- Value Proposition Strength = R*0.35 + W*0.35 + V*0.30, rated STRONG/MODERATE/WEAK/FAILING
- **Gate Kill Logic** -- any single gate failure kills the proposition regardless of other scores
- **Value Canvas Integration** -- Jobs/Gains/Pains mapping with Fit Score formula (jobs x gains x pains ratio)
- **BTC Statement Generator** -- For/Who/Our/That/Unlike/Our product template populated from gate evidence
- **B2B Value Drivers** -- 8 quantitative drivers (revenue, cost, responsiveness, productivity, cycle time, satisfaction, quality, employee)
- **Brain Integration** -- PWS Value Proposition framework node wired to JTBD, Hedgehog Concept, Golden Circle, all 5 venture stages
- **Samsonite Test** -- signature reframe: "durability at fair price beats premium quality every time"

## [1.9.0] - 2026-04-08

onboarding: true
onboard_steps:
  - "NEW: /mos:whitespace -- find what's MISSING in your venture. Maps gaps using embedding-space density analysis, based on Huan He's SemNovel research (Yale)."
  - "MindrianOS now has a Model Data Room -- 168 artifacts across 10 sections, built from 45 meeting transcripts, 43 research papers, 35 PWS frameworks."
  - "HSI Spectral Analysis on real evidence -- 20 cross-domain innovation pairs discovered, reverse salients identified."

### Added
- **Whitespace Mapping Engine** -- SemNovel-inspired embedding-space gap detection
- **/mos:whitespace command** -- 7 subcommands: map, analyze, hypothesis, tree, score, external, discover
- **Novelty Scoring** -- every filed artifact gets an embedding-distance novelty score
- **Discovery Cycle** -- HSI -> Whitespace -> RS -> Analogy chained in sequence
- **Model Data Room** -- 168 artifacts across 10 sections built from real project evidence
- **Google Drive API Integration** -- OAuth token, batch download 45+ documents
- **HSI Spectral Analysis** -- 20 innovation pairs, OM-HMM structural scoring
- **Investment Thesis Gate** -- 7/10 pass on MindrianOS's own evidence
- **People Mapping** -- 19 unique people across 45 meetings
- **Cross-Source Intelligence** -- Gmail + Calendar + Drive + Notion + Claude memory

## [1.8.8] - 2026-04-07

onboarding: true
onboard_steps:
  - "The Brain just got 10x smarter. Framework chaining (125 FEEDS_INTO edges), stage-aware recommendations (129 TYPICAL_AT), and 444 semantic bridges from LazyGraph to curated knowledge."
  - "Error messages are now human-readable. Every script follows: What happened / Why / How to fix."
  - "Install guide at mindrian.ai/docs/install -- three paths (no Claude Code / has Claude Code / update), platform-specific steps."

### Added
- **Brain: Causal Discovery** -- FEEDS_INTO 4->125, PREREQUISITE 0->15, TYPICAL_AT 4->129, ADDRESSES_PROBLEM_TYPE cleaned to 152
- **Brain: Lazy Graph Bridge** -- 444 ALIAS_OF bridges connecting LazyGraph (245K CO_OCCURS) to canonical nodes, 235 concepts promoted
- **Brain: Fragmentation Cleanup** -- 12 lowercase labels fixed, 75 null-title Books removed, noise CaseStudies cleaned
- **Brain: Teaching Wiring** -- 29/29 CaseStudies wired, 406 TEACHES edges, 23 IMPLEMENTS, 7 leadership books codified
- **Brain: Venture Stage Mapping** -- 30 TYPICAL_AT edges across 5 stages with effectiveness scores and source book provenance
- **Dummy-Proof Install** -- human-readable error messages (What/Why/Fix pattern) across resolve-room, room-registry, session-start, check-update, self-update
- **Install test checklist** (scripts/test-fresh-install.md) for Mac and Windows manual verification
- **Top 10 troubleshooting items** added to website install page

### Changed
- All script errors now follow `[MindrianOS] What / Why: reason / Fix: command` pattern
- Website install page expanded with troubleshooting section

## [1.8.7] - 2026-04-07

### Added
- Leadership coaching intelligence integrated into team-execution room section
- V2 leadership knowledge ported: 7 domains, ABET integration, signature reframes
- Team-execution proactive signals: team gaps, solo founder detection, assessment staleness
- Team-execution contradiction detection: capacity mismatch, stage mismatch
- Brain leadership framework chains: 4 coaching pipelines (assessment, building, strategic, conflict)
- Team-context-aware coaching: adapts opening based on team size and composition
- Brain-enriched framework suggestions after coaching sessions
- Neo4j Brain: 7 KnowledgeDomain nodes, 6 leadership ProblemTypes, ~57 edges

## [1.8.6] - 2026-04-06

onboarding: true
onboard_steps:
  - "Your rooms now live in ~/MindrianRooms/ -- one place for every project. Tell Larry 'go to [room name]' to switch."
  - "/mos:organize navigates your room hierarchy as a wicked problem -- multiple views, graph-informed proposals, human confirmation for every move."
  - "Room hierarchy syncs to KuzuDB (local) and Neo4j Brain (remote) as an additive intelligence layer. Graph failure degrades gracefully."
  - "/mos:setup rooms migrates legacy ~/room/ and ~/rooms/ layouts to MindrianRooms with guided confirmation."

### Added
- **MindrianRooms centralized directory** -- all Data Rooms under ~/MindrianRooms/ with ICM Layer 0 (CLAUDE.md) and Layer 1 (INDEX.md) auto-generated
- **resolve-room 4-strategy cascade** -- central registry, directory scan, workspace registry, legacy fallback with deprecation notice
- **MINDRIAN_ROOMS_HOME env var** -- override ~/MindrianRooms location for power users
- **ICM templates** -- templates/icm/CLAUDE.md (Layer 0 identity) and INDEX.md (Layer 1 routing) auto-generated on first room creation
- **update-icm-index script** -- idempotent INDEX.md regeneration from registry, called on create/archive/stage change
- **/mos:organize command** -- wicked hierarchy navigator with 4 subcommands (tree/propose/view/move), 4-tier graceful degradation (Brain+KuzuDB -> Brain -> KuzuDB -> metadata), human confirmation for every move
- **GROUP-CLAUDE.md template** -- ICM Layer 0 for grouping directories, generated from graph context
- **Virtual room projections** -- /mos:organize view [by-stage|by-client|by-domain|by-activity] shows groupings WITHOUT moving files
- **Decision memory** -- user GROUP/SEPARATE/DEFER choices stored locally and promoted to graph edges when Brain available
- **migrate-rooms script** -- detects 5 legacy room patterns, per-room confirmed migration with registry integration and optional symlinks
- **/mos:setup rooms** -- guided migration option for legacy layouts
- **Dual-graph room hierarchy** -- KuzuDB local graph (Room/RoomGroup/CONTAINS/AT_STAGE) + Neo4j Brain remote (adds USES_FRAMEWORK/SHARES_THEME/HAS_SECTION)
- **sync-rooms-graph script** -- KuzuDB sync from registry, fire-and-forget, idempotent
- **sync-rooms-brain script** -- Neo4j Brain sync with AT_STAGE, USES_FRAMEWORK, SHARES_THEME edges, wires 13 orphaned DataRoomSection nodes
- **Room hierarchy schema reference** -- references/brain/room-hierarchy-schema.md with Cypher patterns and KuzuDB DDL

### Changed
- room-passive and room-proactive skills now detect rooms via resolve-room (not dir_exists:room)
- /mos:rooms list shows ~/MindrianRooms/ paths from central registry
- /mos:room overview header shows simplified ~/MindrianRooms/[name]/ path
- /mos:new-project creates rooms under ~/MindrianRooms/[slug]/
- /mos:rooms create targets ~/MindrianRooms/[slug]/ with ICM auto-generation
- room-registry writes to central ~/MindrianRooms/.rooms/registry.json
- Session greeting references MindrianRooms location when room detected
- room-registry create/archive triggers fire-and-forget graph sync

## [1.8.4] - 2026-04-06

### Added
- Dashboard detail panel: plain English relationship descriptions ("supports", "conflicts with", "shares themes with")
- Edge hover tooltip shows full sentence: "Market Analysis supports Pricing Model" instead of raw INFORMS
- Clickable relationship items in panel navigate to connected nodes
- 12 edge types translated: INFORMS, CONTRADICTS, CONVERGES, FEEDS_INTO, REINFORCES, INVALIDATES, ENABLES, CAUSES, FILED_TO, SPOKE_IN, ATTENDED, REFERENCES
- Artifact summary preview in detail panel when available
- Relationships color-coded by type (red=conflict, blue=support, yellow=convergence, green=reinforces)

### Changed
- Graph visualization standard: vis-network (vis.js) replaces Cytoscape.js for all exports
- SnapshotHub constellation rebuilt with ForceAtlas2 physics, interactive nodes, edge filtering
- Readable labels with dark outline, section color-coding, diamond/dot node shapes
- Detail panel on node click, sidebar filters, controls bar (Fit/Zoom/Physics/Stabilize)
- Detail panel widened to 360px for relationship readability
- Design standard codified at references/design/graph-visualization-standard.md

## [1.8.3] - 2026-04-06
### Changed
- `/mos:help` completely redesigned with De Stijl color-coded job categories
- Every command description rewritten as JTBD outcomes ("what you get" not "what it does")
- 6 Mondrian colors mapped to thinking jobs: RED=Problem, BLUE=Reasoning, AMETHYST=Perspective, YELLOW=Intelligence, GREEN=Output, TEAL=Infrastructure
- Commands regrouped by job category instead of alphabetical
- Color legend rendered with actual ANSI terminal colors matching the website/dashboard palette
- Command-to-color mapping reference table for consistent rendering

### Fixed
- Brain v1.8.2 graph cleanup: reversed backwards GOVERNS edge on Red Teaming
- Merged 32 DictionaryTerm duplicate sets (35 nodes removed)
- Wired 2 under-wired FrameworkAgents (JobsToBeDone, SystemThinking)
- Connected 5 min-wired CorePrinciples to semantically matched frameworks
- Linked 6 near-orphan CaseStudies to VentureStages

## [1.8.1] - 2026-04-05
### Added
- Live Hub interactive dashboard with Command API -- click section cards to trigger MindrianOS CLI commands
- Contextual action buttons per section with JTBD rationale (Problem Definition gets Root Cause/Challenge/Validate, Market gets Trends/Timing/User Needs, etc.)
- Proper Mondrian grid mark + MINDRIAN wordmark logo linking to mindrianos website
- Content-proportional card sizing -- sections with more artifacts get larger grid cells
- Gap cells for empty/missing sections with dashed borders and contextual action buttons
- Opportunity Bank gets special treatment -- yellow border highlight with "Scan for Opportunities" CTA
- Color legend strip at bottom of grid showing all sections with artifact counts
- Command panel (slide-in from right) with copy-to-clipboard CLI command and section preview
- Full keyboard navigation -- Tab through cards, Enter/Space to activate, focus-visible rings
- ARIA labels and roles on all interactive elements
- prefers-reduced-motion support -- animations disabled for motion-sensitive users
- Mobile responsive grid -- 2-column at 1024px, single-column at 640px with reset grid positions

### Fixed
- Remove dead code in room_graph router (unreachable cases from merge artifact)
- Add hat-briefing and scheduled-tasks to MCP routers (were missing from command coverage)
- Sanitize Cypher query input in brain-router.cjs to prevent injection from malformed STATE.md
- Add shutdown handler double-fire guard in session-catchup.cjs
- Wire both MCP servers (mindrian-os local + mindrian-brain remote) into plugin .mcp.json
- ALL_TOOL_COMMANDS now correctly reports 64 routed commands
- Raw markdown no longer leaks into grid card summaries (tables, bold markers, metadata lines stripped)
- Summary extraction skips frontmatter-like lines (Filed:, Source:, Category:)
- Section label font size increased from 10px to 12px for readability
- Contrast improved on dark-bg cell labels (0.7 to 0.8 opacity)
- Touch target sizes on action buttons meet 44px minimum width

## [1.8.0] - 2026-04-05
onboarding: true
onboard_steps:
  - "MindrianOS now works across all three surfaces: CLI, Desktop, and Cowork. Same commands, same intelligence, same room."
  - "MCP Apps render your Data Room inline: dashboard, wiki, and knowledge graph views right in the conversation."
  - "Smart context loading: Larry detects your archetype (student/venturist/researcher) and loads only what you need -- half the token cost."

### Added
- **MCP Foundation**: All 64 plugin commands exposed as MCP tools via 9 hierarchical routers with intelligence-cascade.cjs shared module
- **Surface Detection**: Auto-detect CLI/Desktop/Cowork at startup; dual transport (stdio + Streamable HTTP) on same McpServer instance
- **Write Safety**: KuzuDB write-gateway with promise-chain serialization, file-based write lock with PID/timestamp/stale cleanup
- **Token Optimization**: Native-first skills compressed from 74K to 26K bytes; progressive loading (Layer 0 always, Layer 1 on-demand, Layer 2 Brain); per-turn cost halved from ~20.5K to ~10K tokens
- **Hook Optimization**: HSI debounce (30s), analyze-room caching (5-min TTL), write batching, per-room bridge file isolation, framework recommendation cache (10-min TTL)
- **Context Intelligence**: User archetype detection (venturist/researcher/student), tiered context loading (500/2K/5K tokens), 6 MCP session profiles, autocompact tuning per archetype, returning user detection, student progress tracking
- **Pipeline Chaining**: Room-file-based state enables LLM-orchestrated tool sequences; Brain chain ordering via CO_OCCURS and FEEDS_INTO relationships
- **Agent Dispatch Optimization**: Dynamic swarm sizing, cost estimation before dispatch, chain checkpoints, budget-aware model routing (opus -> sonnet -> haiku), Coordinator-compatible output
- **Scheduled Intelligence**: Session catch-up on Cowork, daily briefings, competitor/grant/news scanning, scout sentinel tasks, all results filed as room artifacts with provenance
- **MCP Apps Data Room Views**: Dashboard (De Stijl Mondrian grid), wiki (browsable room sections), knowledge graph (Cytoscape.js) rendered inline via ext-apps; bidirectional postMessage communication
- **Session State Writer**: Structured last-session.md with active_methodology, open_questions, next_suggested_action, confidence_level, artifacts_created, session_duration (KAIROS-ready)
- **KAIROS Detection**: context-engine reads KAIROS daily log instead of cold-start context rebuild when tengu_kairos activates
- **UDS Listener Stubs**: room-passive ready for cross-instance room state sharing when tengu_harbor ships
- **Platform Gate Monitor**: checkGates() monitors tengu_kairos, tengu_harbor, tengu_scratch, tengu_portal_quail via env vars with local override support

### Changed
- SDK upgraded from 1.27.1 to ^1.29.0 for Streamable HTTP transport and ext-apps peer dependency
- Router groups capped at 15 commands (data_room split into room_state/content/graph sub-routers)
- Skills teach domain-specific rules only -- no redundant tool instructions for native Claude capabilities

## [1.7.1] - 2026-04-05

### Added
- generate-hub.cjs rebuilt to Synteris quality -- full De Stijl component library with venture cards, grade circles, badge system, smart content detection (bug/wish/decision cards), Data Room Views button row, scroll-highlight navigation
- /mos:snapshot and /mos:export now produce single-file tabbed hub by default (D20)
- Recursive scanning in all visualization scripts (build-graph, generate-snapshot, generate-presentation)

### Fixed
- build-graph recursive scanning for nested directories (12 nodes to 73)
- Cytoscape node IDs with slashes breaking CSS selectors
- generate-standalone JS injection leaving orphaned .then/.catch blocks
- generate-snapshot.cjs and generate-presentation.cjs depth-1 scanning
- Cytoscape compound layout collapsing for 30+ node rooms
- Banner on every cold start, not just first install
- Status line: wrong JSON key, literal $PLUGIN_ROOT, room-only gate
- Brain key global fallback to ~/.mindrian.env
- /mos:onboard reset for replaying welcome sequence
- Post-room creation shows OS-native open folder command
- Brain setup two-stage health check (wake before verify)
- disable-model-invocation removed from 29 methodology commands

## [1.7.0] - 2026-04-05
onboarding: true
onboard_steps:
  - "When you want to know WHY something is true in your Room (not just WHAT), /mos:causal extract traces cause-effect chains with mechanisms and falsifiable predictions"
  - "When assumptions stack 3-deep and you need to know which to validate FIRST, /mos:causal trace cascade shows what breaks if each assumption fails"
  - "When you have a causal claim worth testing, /mos:causal predict turns it into a trackable prediction with a deadline -- Larry reminds you when it's time to check"

### Added
- **Causal Reasoning Layer**: CausalClaim nodes in KuzuDB with 12 properties (cause, mechanism, effect, confidence, domain, falsifiable_prediction, novelty_score, extraction_method, evidence, source_artifact, created)
- **Causal Edge Types**: CAUSES + ROOT_CAUSE_OF (Artifact->Artifact), CASCADES_TO (CausalClaim->CausalClaim), EXTRACTED_FROM (CausalClaim->Artifact)
- `/mos:causal` command with 3 subcommands: extract (Larry extracts cause/mechanism/effect triples with Three Gaps enforcement), predict (generate and track falsifiable predictions), examples (research-backed examples via Brain + Tavily)
- **Causal Graph Engine** (compute-causal.py): 5 NetworkX algorithms -- chain traversal (all_simple_paths, cutoff=6), cascade simulation (descendants with multiplicative confidence decay), bottleneck detection (betweenness centrality), contradiction detection (cycle finding), inversion protocol (node removal + path diff)
- **Cross-Reference Queries**: Cypher joins linking CausalClaims to HSI_CONNECTION, REVERSE_SALIENT, and ANALOGOUS_TO edges -- discovers where causal explanations connect to existing intelligence
- **Prediction Registry** (prediction-registry.cjs): 5 subcommands (add/resolve/list/overdue/archive), REGISTRY.json lifecycle (pending->confirmed/refuted/expired), opportunity typing (business/research/funding/competitive/technical), confidence propagation from outcomes
- **Post-Write Causal Flagging**: Lightweight regex heuristic flags causal candidates after HSI+RS in post-write cascade, writes .causal-candidates.json
- **Research-Backed Examples** (ENGINE-09): Analogy engine generates structural search queries from causal graph topology -- Brain/Pinecone for PWS teaching examples + Tavily for chronologically recent real-world examples
- **Brain Enrichment**: Theory of Change Framework node, Causal Reasoning parent Concept, FEEDS_INTO chains (Root Cause -> Systems Thinking -> CLD -> Scenario Analysis), CO_OCCURS edges, TYPICAL_AT venture stage mappings, Falsifiability + Logic Trees linked
- **Brain Query Patterns 11-13**: causal_framework_select, causal_pattern_match, causal_contradiction_resolve
- **Brain Causal Directives**: Three Gaps framework (Abstraction, Reasoning, Reality) -- every claim needs mechanism + falsifiable prediction
- **Larry JTBD Suggestions**: 5 signal-to-suggestion mappings for causal commands in larry-personality skill
- **Room-Proactive Causal Discovery**: 5 convergence patterns surfacing discoveries when causal + HSI + RS + analogy edges converge (threshold: 5+ claims, 3+ cascades)
- **Session-Start Prediction Check**: Larry proactively prompts for overdue prediction resolution

### Architecture
- **Larry EXTRACTS** causal claims (semantic, LLM with Three Gaps enforcement)
- **Python COMPUTES** graph algorithms (NetworkX -- chains, cascades, bottlenecks, contradictions, inversions)
- **KuzuDB STORES** causal data (CausalClaim nodes, CASCADES_TO/EXTRACTED_FROM edges)
- **Brain DIRECTS** causal reasoning (read-only directives, query patterns 11-13)
- **Brain never receives user causal data** -- clean IP boundary maintained
- Follows existing HSI pipeline pattern: Python extracts -> JSON intermediate -> CJS writes to KuzuDB
- Discovery emerges from graph structure: Cypher walks Causal -> HSI -> RS -> Analogy edges in one query

## [1.6.3] - 2026-04-03

### Fixed
- Remove disable-model-invocation from all 29 methodology commands -- was blocking LLM responses entirely, making every /mos: methodology command unusable

### Added
- Brain Proactive Command Engine: Command nodes as first-class Neo4j entities with TRIGGERED_BY_SIGNAL, FOLLOWS_FRAMEWORK, RELEVANT_AT_STAGE relationships
- Multi-hop command suggestion queries (Pattern 10a-d): frameworks -> commands -> triggers -> JTBD
- JTBD-powered contextual command discovery: Larry suggests commands every 3-7 turns using "When/want/so" formula
- Fabric-driven surprise suggestions: Larry queries KuzuDB Tensions, Bottlenecks, Surprises for command triggers
- Onboarding invitation on any "how to use" question with /mos:onboard
- v6.2 RoomHub: adaptive Room type detection, 7 Showcase views, Constellation graph, Generative Fabric Chat
- /mos:snapshot for 7-view SnapshotHub HTML export
- Analogy engine wired into /mos:help and pws-methodology skill
- Parallel Power group in help tree (--swarm, --parallel, --full, --broad)
- Update flow uses JTBD formula for every new capability

## [1.6.1] - 2026-03-31
onboarding: true
onboard_steps:
  - "When you are burning through tokens on routine work, /mos:models set balanced keeps Opus for teaching but uses Haiku for scanning -- 66% less cost, same quality where it matters"
  - "When 3 Sections have gaps and you only have 30 minutes, /mos:act --swarm fills all 3 in parallel -- 5 minutes instead of 45"
  - "When you want 6 expert perspectives but hate waiting, /mos:persona --parallel generates all De Bono hats simultaneously -- 2 minutes"
  - "When you are stuck on a problem that feels unique to your domain, /mos:find-analogies discovers how other industries solved the exact same structural conflict"
  - "When your Room has not been health-checked and you have deadlines approaching, /mos:scout runs a full scan -- health, grants, competitors, innovation connections"
  - "When you want to share your Room's intelligence as a living hub, /mos:snapshot generates a 7-view interactive HTML export with graph, chat, and deep links"

### Added
- /mos:models command for model profile management (quality/balanced/budget/inherit)
- /mos:scout for sentinel intelligence (health check, grant deadlines, competitor watch)
- /mos:find-analogies for Design-by-Analogy discovery (--brain, --external modes)
- /mos:snapshot for RoomHub export (7 views, adaptive, generative chat)
- 6 new hooks: PreCompact, PostCompact, FileChanged, CwdChanged, SubagentStop, TaskCompleted
- Parallel flags: --swarm (act), --parallel (persona), --full (grade), --broad (research)
- Spectral OM-HMM: Markov chain thinking-mode analysis in HSI pipeline
- 3 new KuzuDB edge types: ANALOGOUS_TO, STRUCTURALLY_ISOMORPHIC, RESOLVES_VIA
- Design-by-Analogy pipeline (5 stages) with TRIZ matrix and SAPPhIRE encoding
- Adaptive Room type detection (venture/website/research/general)
- Constellation graph with 12 Thread types and De Stijl colors
- Generative Fabric Chat querying KuzuDB via natural language
- MWP specification, moat mandate, KAIROS prep, Coordinator Mode manifest
- JTBD-powered contextual command discovery every 3-7 turns
- Onboarding invitation on any "how to use" question

## [1.6.0] - 2026-03-31
onboarding: true
onboard_steps:
  - "MindrianOS now has a visual identity -- Mondrian banner on every cold start and after updates"
  - "First-time users get a guided onboarding -- tell Larry about yourself and everything gets smarter"
  - "5 new commands connect you to your room's power: /mos:present, /mos:dashboard, /mos:speakers, /mos:reanalyze, /mos:graph"
  - "Larry's greeting now tells you what's in it for YOU based on your room state -- not feature lists"

### Added
- **Interactive Onboarding System** (Phase 35) -- 7-step Larry-voiced walkthrough on first install. Deep context building (USER.md) with 3 input approaches (Q&A, document paste, web research). Update path shows What's New from CHANGELOG. Manual re-run via /mos:onboard. Version-aware onboarding registry in CHANGELOG.md. Natural-language-first: teaches users to talk, not type commands.
- **Command Wiring** (Phase 36) -- 5 new /mos: commands connecting users to existing infrastructure: /mos:present (6-view presentation + browser), /mos:dashboard (interactive graph + chat), /mos:speakers (meeting speaker profiles), /mos:reanalyze (re-run meeting intelligence), /mos:graph (KuzuDB natural language exploration).
- **JTBD Warm Start** (Phase 37) -- Larry's session greeting identifies your current job and frames suggestions as "You have [state]. [action] [outcome that matters]." Dynamic 6-command menu adapts to what you haven't tried yet. Max 2-3 nudges per session.
- **CLI Identity** (Phase 34) -- Responsive Mondrian banner with 3 terminal width tiers (full 100+, compact 80-99, minimal <80). Update detection via version marker. /mos:splash for on-demand banner. Dual-path rendering (stderr + additionalContext fallback).
- **End-to-End Validation** (Phase 38) -- 24/24 checkpoints passing across syntax validation, template verification, presentation generation, and branding contract.

## [1.5.1] - 2026-03-31
onboarding: true
onboard_steps:
  - "Larry now builds a deep profile about you on first install -- everything gets smarter after onboarding"
  - "Returning users see what changed since their last session, framed as capabilities"
  - "Type /mos:onboard anytime to re-run the walkthrough or /mos:onboard whats-new for changelog"

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

# Roadmap: Memory Triple + Navigation Engine v1.11.0

## Active Milestone: v1.11.0 Memory Triple + Navigation Engine

Current in-progress milestone covering Phases 88, 88.6, 88.1, 89, 90, 91. Releases (consolidated 2026-04-23): v1.10.13 Phase 88 SHIPPED, v1.10.14 Phase 88.6 URGENT bug fix, v1.10.15 Phase 88.1 polish, v1.10.16 Phase 89 reverse-salient, v1.10.17 Phase 90 Brain derivation, v1.11.0 Phase 91 destination. See `## Milestones`, `## Phases`, and `## Planned Pipeline` below for detail.

## Overview

Four-phase build that turns any Data Room into a fully-branded Obsidian vault. First the wikilink engine and branded footers (the core Node.js CJS transformation scripts proven on align-ecosystem and hebrew-university-yissum), then the Obsidian kit and welcome doc (static CSS/JSON assets plus markdown generation), then the user-facing /mos:vault command that orchestrates everything into a one-command export, and finally native wikilink injection at filing time so future artifacts arrive pre-linked.

## Milestones

<details>
<summary>v1.8.6 MindrianRooms (Phases 56-59.2) - SHIPPED 2026-04-06</summary>

6 phases, 35 requirements. See .planning/milestones/v1.8.6-ROADMAP.md

</details>

<details>
<summary>v1.8.8 Brain Graph Optimization + Dummy-Proof Install (Phases 60-64) - SHIPPED 2026-04-07</summary>

5 phases, 27 requirements. Causal discovery, lazy graph bridge, fragmentation cleanup, agent wiring, install experience.

</details>

<details>
<summary>v1.9.0 Model Data Room + Self-Analysis (Phases 65-66) - SHIPPED 2026-04-08</summary>

Google Drive integration, 168-artifact model room, HSI self-analysis, Investment Thesis gate.
v1.9.1: VPS scoring. v1.9.2: 13 wiring fixes + intelligence cascade wired end-to-end.

</details>

<details>
<summary>v1.9.3 Wiring Integrity + Intelligence Loop (Phases 67-70) - SHIPPED 2026-04-09</summary>

4 phases. APPROVE/REJECT/DEFER cascade, mid-session intelligence, filing completeness, macOS portability.

</details>

<details>
<summary>v1.9.4 Opportunity Engine + Conversation-First Entry (Phases 71-75) - SHIPPED 2026-04-09</summary>

5 phases. Universal opportunity extraction, KuzuDB graph + Brain enrichment, conversation mode routing, capture + room seeding, onboarding redesign.

</details>

- **v1.9.8 Obsidian Vault Export** - Phases 76-80 (SHIPPED as v1.10.0 on 2026-04-13)
- **v1.10.2 Feynman-MINTO Hybrid** - Phase 81 (SHIPPED 2026-04-14)
- **v1.10.5 Wiki Artifact Injection Fix** - Phase 82 (SHIPPED 2026-04-14)
- **v1.10.7 Cross-Session Scope Injection + Wrapper Fix** - Phase 83 (SHIPPED 2026-04-14)
- **v1.10.8 Smart Notebook (Memory Promotion)** - Phase 84 (SHIPPED 2026-04-15)
- **v1.10.9 Windows Hotfix Cross-Platform Parity** - Phase 85 (SHIPPED 2026-04-15)
- **v1.10.11 + v1.10.12 Security Hardening + Cascade + Dashboard** - Phase 87 (SHIPPED 2026-04-19)
- **v1.11.0 Memory Triple + Navigation Engine** - Phases 88, 88.1, 89, 90, 91 (IN PROGRESS)

## Phases

- [x] **Phase 76: Wikilink Engine + Branded Footers** - Node.js CJS scripts for wikilink injection (team, filed-to, meetings, sections, sub-rooms) and MindrianOS branded footers on every artifact (completed 2026-04-12)
- [x] **Phase 77: Obsidian Kit + Welcome Doc** - Static .obsidian/ config (De Stijl CSS, graph colors, appearance) and Welcome doc generator (completed 2026-04-12)
- [x] **Phase 78: /mos:vault Command + /mos:room linkify** - User-facing commands that orchestrate vault export and retroactive wikilink injection (completed 2026-04-12)
- [x] **Phase 79: Native Filing Wikilinks** - Modify existing filing pathways to inject wikilinks at creation time (completed 2026-04-13)
- [x] **Phase 80: Vault Import -- Obsidian to Data Room** - Convert any Obsidian vault or Markdown folder into a MindrianOS Data Room (completed 2026-04-13)
- [x] **Phase 81: Feynman-MINTO Hybrid** - MINTO.md files born compressed via Feynman engine stages 1, 2, 4, 5. Tier-1 default (slash-command orchestrator inside Claude session, no API key, no budget), tier-0 fallback (deterministic MINTO + AAAK footer). Shipped as v1.10.2 on 2026-04-14.
- [x] **Phase 82: Wiki Artifact Injection Fix** - Populate sec.artifacts in scripts/generate-presentation.cjs collectSections so the wiki template has content to render. Added per-artifact 20 KB cap and per-room 2 MB cap to prevent HTML bloat. Upgraded sec.summary to read MINTO.md governing_thought when present (free leverage of v1.10.2 Feynman-MINTO infrastructure). Reported by Lawrence Aronhime 2026-04-13 23:23, bug sat unfixed across 8 releases. Shipped as v1.10.5 on 2026-04-14.
- [x] **Phase 83: Cross-Session Scope Injection + Wrapper Fix** - Inject ACTIVE ROOM context block into Claude's session-start prompt so cross-session memory is bounded by room scope and Claude refuses to leak content from other rooms without explicit user acknowledgment. Surface every room with a GUARDRAIL.md as a sealed-room with its hard rules quoted. Bundle the parked statusline wrapper fix (settings.json no longer hardcodes legacy plugin path; wrapper resolves latest cache version). Triggered by witnessed cross-session leak where Claude pulled rashut-hadshanut-ai content into an align-x-milken scoped session and drafted a Hebrew intro line that belonged to the sealed room. Shipped as v1.10.7 on 2026-04-14.
- [x] **Phase 84: Smart Notebook (Co-Pilot reshape)** - v1.10.8 ships the notebook writing surface (Mullins 20-section scaffold) AND the co-pilot inject channel (graph-to-proactive-intelligence bridge + UserPromptSubmit hook) in one hybrid release. Plans 84-01/02/03 done, 84-04 through 84-10 done. Shipped as v1.10.8 on 2026-04-15.
- [x] **Phase 85: Windows Hotfix v1.10.9 Cross-Platform Parity** - Restore full v1.10.8 feature parity on Windows via node:sqlite migration (better-sqlite3 replacement), hooks/run-hook.cmd exit-code propagation, vault-export .mindrian inclusion, python3-to-platform-dispatch helper, session-start version banner fix. Node 22.5+ engine floor. Shipped as v1.10.9 on 2026-04-15.
- [x] **Phase 87: Security Hardening + Cascade Refactor + Localhost Dashboard** - Stream A (v1.10.11): Cypher sanitization + API key permissions + HSI timeout + write-lock atomic + ROOM.md+MINTO.md pre-commit hook + localhost live dashboard at :3131. Stream B (v1.10.12): cascade dedup + sync/async entry-point split + MCP input validation + indexArtifact transaction + Brain session cache with LRU eviction + BYO API chat panel with Bearer auth. Shipped 2026-04-19.
- [x] **Phase 88: Per-Folder Memory Triple Wiring** - Wire ROOM.md + STATE.md + Feynman-MINTO.md as a coordinated cross-session memory triple via five lifecycle wires (post-write freshness, on-stop snapshot, session-start TRIPLE_CONTEXT injection, pre/post-compact resilience, decision_log persistence) + unified read contract `lib/core/folder-memory.cjs` + invariants module + guardian. 8/16 plans shipped (88-00-B, 88-00, 88-01, 88-02, 88-03, 88-04-B, 88-04, 88-05). Releases as v1.10.13. (completed 2026-04-23)
- [x] **Phase 88.6: Python Algorithm Wiring (URGENT)** - Close orphan-value gap between 15 verified Python algorithms and user-facing /mos:* commands. Fix silent production bug (baseline not auto-fired in discover-* pipelines), expose 4 orphan Wave-1 algorithms (surprise, disruption, novelty, blindspot) via new /mos:diagnostics command, wrap two-step external whitespace flow behind single command with rate-limit graceful degradation. Evidence: 2026-04-23 smoke test on ~/MindrianRooms/mindrianOS/ (207 artifacts, 77 Brain frameworks, CD = -0.7092, coverage = 0.667). Orchestration-only phase, zero new algorithms. Releases as v1.10.14. (completed 2026-04-23)
- [x] **Phase 88.1: UI/UX Polish + MINTO Surface Plumbing** - Close gap between 71 shipped commands and the Claude Code 2.1.x polish bar. Four workstreams: MINTO surface plumbing (statusline + /mos:status + SessionStart banner consume governing_thought), description-driven UX sweep across 71 commands plus README permissions block, hook output primitives (systemMessage retrofit on 9 hooks plus two new hooks for schema validation and async artifact auto-commit), README as 7th surface. CONTEXT filed 2026-04-20. Releases as v1.10.15 (version bumped 2026-04-23 to avoid conflict with 88.6 bug fix). (completed 2026-04-23)
- [x] **Phase 89: Reverse-Salient Engine** - Hughes 1983 reverse-salient detection for lagging components in an expanding venture. Computes embedding-distance lag signal per section, optional consumer of Phase 88 reasoning_health_score. 8 plans on disk, zero summaries (checkbox corrected 2026-04-23 after false-complete mark detected in audit). Ships independently as v1.10.16. (completed 2026-04-24)
- [x] **Phase 89.1a: Brain Methodology Substrate Loader** - Pull 1,427 methodology embeddings from Brain Pinecone via canon-compliant chokepoint. 4 plans, 7/7 SCs PASS. Bundled into v1.11.0. (completed 2026-04-25)
- [x] **Phase 89.1: Domain Analysis + Query Generation Matrix** - rs-domain-analyzer.cjs (Sequential-Thinking 7-field decomposition) + rs-query-matrix.cjs (60-query 4-category matrix) + brain-client shape adapter resolving 89.1a deferred item + USES_TECHNIQUE Brain canonization edge (the ONE Brain-write of v1.11.0). 5 plans, 7/7 SCs PASS, Phase Gate 13/13 PASS. Bundled into v1.11.0. (completed 2026-04-26)
- [x] **Phase 89.2: External Research Fetching (EXPANDED) + Preprocessing + Scoring + Thesis + Experts** - Phase 1.5 + 2 + 3 + 4 of canonical reverse-salient framework per kickoff §5. Consumes 89.1's 60-query matrix; ships 4 fetchers (academic / patents / industry / experts) + preprocessor + differential scorer + innovation classifier + breakthrough scorer + thesis generator. Every fetcher inherits Canon Part 8 5-tripwire pattern (chokepoint + ExternalEgressViolation + auditQuery + drop-in validator + adversarial fixtures). Per-source rate-limit graceful degradation per Phase 88.6-03. Bundled into v1.11.0 final ship at Phase 91.x. (completed 2026-04-26)
- [x] **Phase 89.3: 5-branch Mind Map + Full Neo4j Schema Deployment** - Output Layer of canonical RS framework per kickoff §5. Ships rs-neo4j-writer.cjs (Aura Cypher: RSDiscovery / ReverseSalient / Innovation / Paper / Author / Institution + DISCOVERED / DERIVED_FROM / ENABLES / AUTHORED_BY / AFFILIATED_WITH edges) + rs-sqlite-mirror.cjs (Tier 0 fallback when Aura absent) + rs-mind-map.cjs (5-branch Cytoscape: Direct Intersections / Structural Transfer / Semantic Implementation / Discovered RS / Innovation Ecosystem) + rs-expert-mapper.cjs (Cypher MATCH against user's Aura: authors + institutions + citations) + bridge-writer enhancement (thesis + breakthrough score on existing v1.10.16 module). Bundled into v1.11.0 final ship at Phase 91.x. (completed 2026-04-27)
- [x] **Phase 89.4: Chain Wiring Upstream + Downstream** - Chain Mechanism per kickoff §6 (USER LOAD-BEARING INTENT 7). Upstream awareness: rs-discovery-engine queries Brain for chain context (problem_type x stage) before running; pauses for systems-thinking / hsi_semantic_surprise_analysis / Cynefin completion when needed. Downstream emission: every ReverseSalient output carries chain metadata (canonical Part 3 verb suggestion + FEEDS_INTO downstream framework + skill spawn rule per §6.4). Ships rs-chain-feeder.cjs (codifies engine choreography across HSI / Navigation Engine / future Scenario+Opportunity+Team-Assembly engines via Brain FEEDS_INTO topology) + Canon Part 3 10-verb vocabulary enforcement (validateVerb) + skill-spawn rule table (high breakthrough + structural_transfer -> /mos:find-analogies; high breakthrough + market signal -> /mos:lean-canvas; cross-methodology discovery -> /mos:pipeline; expert network dense -> /mos:persona; low breakthrough + Cynefin complex -> /mos:think-hats). Bundled into v1.11.0 final ship at Phase 91.x. (completed 2026-04-27)
- [x] **Phase 89.5: Engine Top-Level Orchestrator + Bidirectional NL-Graph Surface** - The capstone of the RS framework per kickoff §5 + §7. Ships scripts/rs-discovery-engine.cjs (top-level orchestrator chaining all RS phases: Domain Analysis -> Query Matrix -> Fetchers -> Preprocessor -> Differential Scorer -> Classifier -> Breakthrough Scorer -> Thesis -> Output Layer -> Chain Feeder) + rs-commercial-assessor.cjs (market size + value prop + partnership targets) + Bidirectional NL-Graph Surface: (a) Text->Query (NL -> Cypher/SQL -> 3-graph triangulation across room.db + LazyGraph Aura + Brain methodology with Canon Part 8 chokepoint preserving NEVER-user-data-to-Brain invariant), (b) Query->Text (raw graph results -> Larry-voiced NL explanation with pedagogical framing + venture context + cross-ref enrichment). Together = bidirectional loop: user types question -> system queries graph -> raw results -> system explains in plain language. Raw data becomes insight. Ships user-facing CLI commands (/mos:rs-fetch, /mos:rs-thesis, /mos:rs-experts, /mos:rs-explain). Bundled into v1.11.0 final ship at Phase 91.x. **Closed 2026-04-27 with 9/9 SCs verified; Phase Gate CONDITIONAL PASS; v1.11.0-beta.1 readiness gate cleared.**
- [x] **Phase 89.6: v1.11.0-beta.1 Release Gate (RS Framework Beta)** - Ship the RS framework (89.1a + 89.1 + 89.2 + 89.3 + 89.4 + 89.5) as v1.11.0-beta.1 to opt-in testers (Justin/Aryeh). 5-gate release with -beta.1 suffix: CHANGELOG entry + plugin.json version + package.json version + git tag v1.11.0-beta.1 + marketplace ref pin. Stable users (v1.10.19) NOT auto-updated. Testers opt in via `claude plugin update mos@mindrian-marketplace --version 1.11.0-beta.1`. Per release-process.md beta-gating mandate: release infrastructure + new product surface ALWAYS ship as beta first; tester sign-off promotes to stable. (completed 2026-05-01)
- [x] **Phase 90: Brain Derivation Layer** - Lets the Brain excavate the local triple (Phase 88) and produce a persistent authored BRAIN.md per section with pattern matches, cross-domain analogies, wicked indicators, unfilled opportunity matches, framework chain predictions, cross-room contradiction flags. Extends triple to quadruple. Graceful degradation when Brain offline. CONTEXT filed. Releases as v1.10.17. (completed 2026-04-24)
- [x] **Phase 91: Navigation Engine** - L5 Decision layer reading the L3 Navigation substrate (SQL + quadruple memory) to decide which skill/command/framework fires each turn. Five-signal triangulation (ICM + SQL + Feynman-MINTO + BRAIN + intent/persona). Persona durability via USER.md. Visible dial in statusline. /mos:explain-decision command. CONTEXT filed. Destination phase. Releases as v1.11.0-beta.2 (full milestone complete; Justin/Aryeh + wider tester opt-in via `--version 1.11.0-beta.2`; release gate at Plan 91-10 relabeled from v1.11.0 to v1.11.0-beta.2). (completed 2026-04-28)
- [x] **Phase 91.5: v1.11.0 Stable Promotion** - After Phase 91 ships v1.11.0-beta.2 AND testers confirm no regressions (~3-5 day soak), promote beta.2 to stable v1.11.0. Tiny phase but real: re-release without -beta suffix. 5-gate: CHANGELOG entry promoting beta.2 to stable + plugin.json 1.11.0 + package.json 1.11.0 + git tag v1.11.0 + marketplace ref pin to v1.11.0. Auto-update channel users get v1.11.0 silently; users on `--version 1.11.0-beta.2` are equivalent (no breaking changes between beta.2 and stable; only the suffix is removed). (completed 2026-05-01)
- [x] **Phase 94: v1.11.2 Tester-Driven Fixer (QA-Rescoped 2026-04-28T19:50Z)** - Hotfix release addressing 4 P0 ship-blockers caught by automated QA harness (rs-fetch broken pipeline + Brain unreachable from /mos:* commands + bundled mcp-server-brain missing deps + WebSearch fallback chain missing) plus Lawrence's loudest UX bugs (94-01 statusline DONE on main; 94-06 room classifier strict-mode pending) plus 3 P1 quick wins (em-dashes wiki.md, U+2717 cross-mark, /mos:explain-decision footer). 10 plans total. Original 13-plan scope archived at .archive-pre-qa-rescope/; deferred items routed to v1.11.3 (P1 polish: body_shape sweep, migration disambig, macOS path audit, FEEDS_INTO schema, verification docs, upstream bug report) and v1.12.0 (new feature surface: 5 methodology commands, persona-aware Pre-Mortem, find-analogies script, tester nudge, multi-room canonical doc). Target: 12-20 hour sprint, 1-2 days. 5-gate release as v1.11.2 with CHANGELOG narrative: "v1.11.2 fixes pipeline-level ship-blockers caught within hours of v1.11.0 launch by an automated QA harness running against the shipped binary." (completed 2026-04-29)

## Phase Details

### Phase 76: Wikilink Engine + Branded Footers
**Goal**: Any room's markdown files can be transformed with cross-linked wikilinks and branded footers via standalone Node.js CJS scripts
**Depends on**: Nothing (first phase -- scripts operate on any room folder)
**Requirements**: WIKI-01, WIKI-02, WIKI-03, WIKI-04, WIKI-05, WIKI-06, WIKI-07, BRAND-01, BRAND-02, BRAND-03, BRAND-04, ARCH-01, ARCH-04, ARCH-05, ARCH-06, RULES-03, RULES-04, RULES-05, RULES-07, RULES-09
**Success Criteria** (what must be TRUE):
  1. Running the wikilink injector on a room with team profiles converts first-occurrence team member names into [[team/member-name/PROFILE.md|Name]] links across all content files, skipping YAML frontmatter and self-references
  2. Filed-to stub files gain wikilinks to both the target artifact and the source meeting, and meeting summaries gain a "Filed Artifacts" index linking to all filed content
  3. STATE.md and ROOM.md section references become navigable [[section/ROOM.md|name]] wikilinks, and sub-room ROOM.md files gain parent + sibling navigation links
  4. Every content artifact (not system files like ROOM.md, STATE.md, CLAUDE.md) receives a MindrianOS branded footer with section, date, and room path, varying by file type
  5. Both the wikilink injector and footer injector are idempotent -- running twice produces identical output with no duplicate links or footers
  6. Artifact note titles are exported as claim sentences (ARCH-01), frontmatter includes vault-aware properties: related, parent-moc, sources, status (ARCH-04)
  7. Two link types enforced: serendipity links inline (xref, cross-domain) vs structural links in frontmatter/footer (hierarchy) (ARCH-05), with quality filter -- every link explainable in one sentence (ARCH-06)
**Plans**: 3 plans
Plans:
- [ ] 76-01-PLAN.md -- Shared room scanner + wikilink injection engine (WIKI-01 to WIKI-07, ARCH-05, ARCH-06)
- [ ] 76-02-PLAN.md -- Frontmatter schema enrichment + branded footer injector (BRAND-01 to BRAND-04, RULES-09, ARCH-04)
- [ ] 76-03-PLAN.md -- Content reformatter: callouts, claim titles, nested folders, terminal cleanup (ARCH-01, RULES-03 to RULES-05, RULES-07)

### Phase 77: Obsidian Kit + Welcome Doc
**Goal**: A complete .obsidian/ configuration preset and a generated Welcome landing page make any room instantly usable in Obsidian with De Stijl branding
**Depends on**: Phase 76 (wikilinks must exist for the Welcome doc to link to them, and CSS must style wikilink-rich content)
**Requirements**: KIT-01, KIT-02, KIT-03, KIT-04, KIT-05, WELCOME-01, WELCOME-02, WELCOME-03, WELCOME-04, ARCH-02, ARCH-03, ARCH-07, SECTION-01, SECTION-02, SECTION-03, SECTION-04, SECTION-05, SECTION-06, SECTION-07, RULES-01, RULES-02, RULES-06, RULES-08, RULES-10
**Success Criteria** (what must be TRUE):
  1. Opening a vault folder in Obsidian shows De Stijl dark theme with Mondrian color-bar headers, gold wikilinks, colored sidebar, Mondrian hr dividers, and styled tables
  2. Obsidian's graph view renders with section-colored nodes (problem=red, business=blue, financial=gold, competitive=cyan, solution=green, team=purple, meetings=gray), hidden orphans, arrows, and tuned force layout
  3. A "Welcome to MindrianOS.md" file serves as the Home Note (tier-0 MOC) linking to section MOCs (tier-1), which link to permanent notes (tier-2) -- following 3-tier hierarchy (ARCH-07)
  4. Section ROOM.md files serve as MOC hubs linking only to entry-point artifacts, not every sub-note (ARCH-02). Welcome doc is the top-level Home Note (ARCH-03)
  5. The Welcome doc adapts to room contents -- sections without relevant data are omitted, and Obsidian callouts provide rich formatting
  6. Every section folder has the trifecta: ROOM.md (identity) + STATE.md (status with artifact count, completeness, gap status, wikilinks to artifacts) + MINTO.md (Minto/MECE reasoning over section artifacts with wikilinks to sources and cross-refs)
  7. Section STATE.md and MINTO.md generated recursively through all nested sub-rooms. MINTO.md skipped for empty sections (nothing to reason over). STATE.md generated even for empty sections (showing gap status)
**Plans**: 4 plans
**UI hint**: yes
Plans:
- [ ] 77-01-PLAN.md -- Static Obsidian kit: De Stijl CSS, graph.json, appearance.json, note templates (KIT-01..05, RULES-08)
- [ ] 77-02-PLAN.md -- Welcome doc generator (WELCOME-01..04, ARCH-03, ARCH-07)
- [ ] 77-03-PLAN.md -- Per-section STATE.md + MINTO.md generators, recursive (SECTION-01..07, ARCH-02)
- [ ] 77-04-PLAN.md -- VAULT-RULES.md design system doc generator (RULES-01, RULES-02, RULES-06, RULES-10)

### Phase 78: /mos:vault Command + /mos:room linkify
**Goal**: Users can export any room as an Obsidian vault with one command, or retroactively inject wikilinks into an existing room in-place
**Depends on**: Phase 77 (vault export orchestrates wikilinks + footers + kit + welcome doc -- all must exist)
**Requirements**: VAULT-01, VAULT-02, VAULT-03, VAULT-04, VAULT-05, VAULT-06, WIKI-08
**Success Criteria** (what must be TRUE):
  1. User runs `/mos:vault` and gets a complete Obsidian-ready folder with all wikilinks injected, branded footers applied, .obsidian/ config dropped, and Welcome doc generated
  2. Vault export resolves symlinked sub-rooms into real folder copies (no broken links in Obsidian), skips binary caches (.lazygraph, .context, .mindrian, node_modules, .git), and includes Snapshot view folder
  3. User can specify a target path (`/mos:vault --path ~/Downloads`) or accept sensible default, and can export any room (active, named, or path)
  4. User runs `/mos:room linkify` to retroactively inject wikilinks and footers into the active room in-place (modifying files directly, not exporting)
**Plans**: 2 plans
Plans:
- [ ] 78-01-PLAN.md -- vault-export-orchestrator.cjs master pipeline (VAULT-01..06)
- [ ] 78-02-PLAN.md -- /mos:vault + /mos:room linkify slash commands and CLI routing (WIKI-08)

### Phase 79: Native Filing Wikilinks
**Goal**: New artifacts created through existing filing pathways arrive pre-linked with wikilinks, eliminating the need for retroactive injection
**Depends on**: Phase 76 (wikilink engine functions must exist to be called from filing code)
**Requirements**: NATIVE-01, NATIVE-02, NATIVE-03, NATIVE-04
**Success Criteria** (what must be TRUE):
  1. When a meeting is filed via file-meeting, newly created artifacts (summaries, filed-to stubs, action items) contain wikilinks to team members and section references
  2. Room-passive filing skill adds wikilinks when filing new entries to any room section
  3. Cross-reference generation includes wikilinks to source and target files, and team profile creation includes a wikilinked contribution table
**Plans**: TBD

### Phase 80: Vault Import -- Obsidian to Data Room
**Goal**: Any Obsidian vault or folder of Markdown files can be converted into a fully-structured MindrianOS Data Room with one command, immediately usable with all /mos: commands
**Depends on**: Phase 78 (uses the same wikilink engine, footer injector, and room structure generators in reverse)
**Requirements**: IMPORT-01, IMPORT-02, IMPORT-03, IMPORT-04, IMPORT-05, IMPORT-06, IMPORT-07, IMPORT-08, IMPORT-09, IMPORT-10, IMPORT-11, IMPORT-12
**Success Criteria** (what must be TRUE):
  1. User runs `/mos:vault import --path ~/my-vault` and gets a complete Data Room with classified artifacts in the correct sections, ROOM.md at every level, STATE.md + MINTO.md per section
  2. Content classifier correctly routes notes to room sections based on content analysis (problem keywords -> problem-definition, financial data -> financial-model, etc.) with confidence scores
  3. Person names detected and team/ profiles auto-generated with wikilinked contribution tables. Meeting notes detected by date/attendee patterns and filed to meetings/
  4. Classification report generated showing where each note landed, confidence, and unclassified notes in inbox/ for manual routing
  5. After import, `/mos:status`, `/mos:grade`, `/mos:diagnose` and all other commands work immediately on the imported room
  6. Works on any folder of .md files -- Obsidian-specific features (wikilinks, frontmatter, .obsidian/) are bonuses, not requirements
**Plans**: TBD

### Phase 81: Feynman-MINTO Hybrid (REVISION 2)
**Goal**: Every MINTO.md is born compressed via Feynman reasoning. /mos:reason is a slash command orchestrator: Claude (the host session) reads the prompt, runs Feynman stages 1/2/4/5 natively in its own context, and hands structured narrative JSON to a deterministic CJS helper that merges narrative with structural parts and writes the final MINTO.md. Zero external API calls, zero ANTHROPIC_API_KEY, zero per-run cost budget - the cost is whatever the user's existing Claude session already costs. Tier-0 fallback (pre-81 deterministic MINTO + AAAK footer) activates only when the generator is invoked from a bare shell or cron with no Claude in the loop. Ships as v1.10.2 (semver deviation from user directive, documented in CHANGELOG).
**Depends on**: Phase 80 (vault-section-minto-generator.cjs is the generator being split into plan and write subcommands) + committed AAAK library at lib/memory/aaak-compress.cjs (tier-0 fallback primitive, 21/21 tests green, not modified)
**Requirements**: FEYNMINTO-01, FEYNMINTO-02, FEYNMINTO-03, FEYNMINTO-04, FEYNMINTO-07, FEYNMINTO-08, FEYNMINTO-09, FEYNMINTO-10 (FEYNMINTO-05 and FEYNMINTO-06 retired, no meter)
**Success Criteria** (what must be TRUE):
  1. /mos:reason produces MINTO files under 1500 tokens when narrative JSON is provided (FEYNMINTO-01)
  2. Structural parts of MINTO (frontmatter, MECE tree, cross-refs, sources, navigation) remain deterministic and free, produced by the --plan and --write subcommands of vault-section-minto-generator.cjs with zero external calls (FEYNMINTO-02)
  3. commands/mos-reason.md is a slash command orchestrator that tells Claude to run Feynman stages 1/2/4/5 in-session and produce narrative JSON conforming to the R-3 schema (FEYNMINTO-03)
  4. Stages 3 (expose confusion) and 6 (teach it back) are intentionally skipped in automated generation because they require human review gates
  5. Tier-0 fallback activates when vault-section-minto-generator.cjs is invoked without a --narrative flag (no Claude session in the loop), producing deterministic MINTO plus AAAK footer (FEYNMINTO-04, FEYNMINTO-08)
  6. lib/memory/feynman-prompts.cjs holds the four Feynman stage prompts as string constants, the single source of truth for both the slash command orchestrator and the future v3.0 MCP Sampling tool (FEYNMINTO-09)
  7. /mos:reason --regenerate-all migrates pre-81 MINTOs to post-81 format with a backup to .migration-backup/YYYY-MM-DD/ first, and emits a report of old-size vs new-size and tier used per section (FEYNMINTO-07)
  8. Slash command orchestrator works natively on CLI, Desktop, and Cowork because all three run slash commands in the same Claude session model; no llm-call.cjs, no API key, no surface-specific code (FEYNMINTO-10)
  9. Pre-81 deterministic MINTO generator code path is preserved byte-equivalent as tier-0 fallback, validated by a frozen expected-tier0-baseline.md snapshot regression test
  10. CHANGELOG [1.10.2] entry documents: why v1.10.1 was skipped, slash-command-as-orchestrator architecture, why there is no API key or cost budget (Claude IS the LLM), migration path, the semver deviation, and a forward pointer to v3.0 MCP Sampling for headless tool invocations
**Plans**: 4 plans expected (81-01 foundation with plan/write subcommands + prompts + schema, 81-02 slash command orchestrator + fixture narratives, 81-03 generator rewrite + tier-0 fallback, 81-04 migration + release)
**Authority**: .planning/phases/81-feynman-minto-hybrid/81-CONTEXT.md (REVISION 2 at top supersedes Revision 1; Revision 1 preserved in _superseded/ subfolder for historical trace of the architectural mistake that was caught 2026-04-14)

### Phase 82: Wiki Artifact Injection Fix (Lawrence bug)
**Goal**: Fix the long-standing bug in scripts/generate-presentation.cjs where collectSections never populated an artifacts array, leaving the wiki template (templates/presentation/wiki.html) with empty article panes when users clicked any section in the sidebar. Populate sec.artifacts with {filename, title, content, excerpt, date} per file. Add per-artifact 20 KB cap and per-room 2 MB cap so single-file HTML wiki exports never bloat past the 5 MB break point. Upgrade sec.summary to read MINTO.md governing_thought frontmatter when a per-section MINTO is present, leveraging v1.10.2 Feynman-MINTO infrastructure for free. Preserve graceful fallback for pre-81 rooms that have not been regenerated to Feynman-MINTO format. Reported by Lawrence Aronhime on 2026-04-13 23:23 after he workarounded on his own machine; bug had been sitting since v1.9.6 across 8 subsequent releases.
**Depends on**: Nothing structural. Touches scripts/generate-presentation.cjs only. Optional leverage of per-section MINTO.md files produced by v1.10.2 Phase 81 Feynman-MINTO Hybrid.
**Requirements**: WIKI-FIX-01, WIKI-FIX-02, WIKI-FIX-03, WIKI-FIX-04, WIKI-FIX-05, WIKI-FIX-06, WIKI-FIX-07
**Success Criteria** (what must be TRUE):
  1. collectSections in scripts/generate-presentation.cjs populates sec.artifacts as an array of {filename, title, content, excerpt, date} objects matching the wiki.html template contract verified at lines 236-355 of templates/presentation/wiki.html (WIKI-FIX-01)
  2. Per-artifact size cap of 20 KB enforced; over-cap artifacts get truncated content with an explicit truncation banner appended to the content string (WIKI-FIX-02)
  3. Per-room total injected markdown cap of 2 MB enforced; over-cap rooms get a generator warning logged to stderr and an in-wiki banner rendered at the top of the sidebar so users know some artifacts were truncated for file size (WIKI-FIX-03)
  4. SKIP_FILES in collectSections aligned with SYSTEM_FILES in lib/vault/room-scanner.cjs so ROOM.md, STATE.md, MINTO.md, frozen tier-0 baselines, .migration-backup, _superseded, and .mos files are never injected as artifacts (WIKI-FIX-04)
  5. New helper collectSectionMinto reads sectionDir MINTO.md frontmatter governing_thought field and uses it as the section summary when present; falls back to current title-extraction summary when MINTO.md is absent (WIKI-FIX-05)
  6. Backwards compatibility preserved for pre-81 rooms that have not been regenerated to Feynman-MINTO format; the existing dashboard generator path that calls collectMinto at the room level is not modified or broken (WIKI-FIX-06)
  7. Test fixtures asserting the populated artifacts shape, the cap behavior, the SYSTEM_FILES exclusion, the summary upgrade with MINTO present, and the summary fallback with MINTO absent. Tests run via existing test runner pattern. CHANGELOG [1.10.5] entry credits Lawrence Aronhime by name with the 2026-04-13 23:23 report timestamp and notes the v1.10.2 Feynman-MINTO leverage (WIKI-FIX-07)
**Plans**: 5 plans expected (82-01 wire artifacts + per-artifact cap + SKIP_FILES alignment, 82-02 per-room cap + warning + in-wiki banner, 82-03 collectSectionMinto helper + summary upgrade, 82-04 fixture-based tests, 82-05 CHANGELOG + version bump + 5-gate release)
**Authority**: .planning/research/wiki-artifact-injection-bloat-analysis.md (798 lines, full template contract verification, real fixture size measurements, bloat budget math, MINTO-as-primary hunch tested and partially falsified, 3-tier loading model deferred, naive-with-caps recommended, CHANGELOG draft included). Authored 2026-04-14 in response to the Lawrence bug report.

### Phase 83: Cross-Session Scope Injection + Wrapper Fix
**Goal**: Stop Claude from leaking content across rooms in cross-session memory. Inject an ACTIVE ROOM CONTEXT block into the session-start prompt so Claude knows which room is scoped and refuses to draft artifacts about other rooms without explicit user acknowledgment. Surface every room with a GUARDRAIL.md as a sealed-room with its hard rules quoted in the system prompt. Bundle the parked statusline wrapper fix so settings.json statusLine no longer hardcodes a stale legacy plugin path. Triggered by a witnessed failure on 2026-04-14 where Claude pulled content from a sealed rashut-hadshanut-ai room into an align-x-milken scoped session, drafted a Hebrew warm-intro line for an Israel Innovation Authority meeting that belonged to the sealed room, and only got caught when Jonathan looked at the statusline and noticed the room mismatch. Research at .planning/research/cross-session-memory-and-room-intent.md identified four critical findings: (1) MindrianOS has no real cross-session memory today (Phase 78 SQLite memory layer is on disk but unwired), (2) the active room is a global mutable singleton across all concurrent terminals, (3) the system prompt has no scope clause so Claude has nothing to collide with topic recognition, (4) GUARDRAIL.md is unenforced documentation with zero codebase references. Ships as v1.10.7 (Tier 1 read-time scope injection only; real persistent memory deferred to v1.10.8 smart-notebook with memory promoted to load-bearing).
**Depends on**: Nothing structural. Touches scripts/session-start, scripts/statusline-mos (new), settings.json template if any. The smart-notebook v1.10.8 milestone now has a load-bearing memory dependency that flows from this phase but does not block it.
**Requirements**: SCOPE-INJ-01, SCOPE-INJ-02, SCOPE-INJ-03, SCOPE-INJ-04, SCOPE-INJ-05, SCOPE-INJ-06, SCOPE-INJ-07
**Success Criteria** (what must be TRUE):
  1. scripts/session-start injects an ACTIVE ROOM CONTEXT block into the conversation context that names the active room from .rooms/registry.json, the active room path, and the section focus from the statusline tracking (SCOPE-INJ-01)
  2. session-start walks ~/MindrianRooms/ for any subdirectory containing a GUARDRAIL.md and surfaces them as sealed rooms in the system prompt with the first 3 lines of GUARDRAIL.md quoted as hard rules. Sealed rooms include rooms NOT registered in .rooms/registry.json (the rashut-hadshanut-ai pattern) (SCOPE-INJ-02)
  3. The injected context block contains an explicit Cross-Room Policy clause instructing Claude to acknowledge mismatch, ask before switching rooms, and refuse to draft artifacts that belong to a different room without explicit user confirmation (SCOPE-INJ-03)
  4. scripts/statusline-mos is shipped AS PART OF the plugin (not just on Jonathan machine) and resolves the latest installed cache version under ~/.claude/plugins/cache/mindrian-marketplace/mos/ via semver sort (SCOPE-INJ-04)
  5. session-start auto-configure block at lines 446-468 is patched to install scripts/statusline-mos to ~/.claude/statusline-mos and write the wrapper path into settings.json statusLine instead of the hardcoded $PLUGIN_ROOT/scripts/context-monitor path. Self-healing for both new and legacy-install users on every session start (SCOPE-INJ-05)
  6. Backwards compatibility: existing rooms with no GUARDRAIL.md are untouched. Existing settings.json statusLine paths that already point at a wrapper or correct cache path are not clobbered. Sessions that cannot resolve an active room (no .rooms/registry.json or empty active field) skip the scope injection block entirely with no error (SCOPE-INJ-06)
  7. Tests assert: scope injection block present in session-start output for a fixture room, sealed room detection finds GUARDRAIL.md rooms outside the registry, wrapper resolves to the highest semver cache version, settings.json migration is idempotent. CHANGELOG [1.10.7] entry credits Jonathan for the witnessed failure on 2026-04-14 and notes the connection to v1.10.8 smart-notebook memory promotion (SCOPE-INJ-07)
**Plans**: 5 plans expected (83-01 scripts/statusline-mos shipped as plugin file + session-start auto-configure patched to install + write wrapper path, 83-02 active room scope injection block in session-start with cross-room policy clause, 83-03 sealed room walker that scans ~/MindrianRooms/ for GUARDRAIL.md and quotes hard rules, 83-04 fixture-based tests + idempotency tests + backwards-compat tests, 83-05 CHANGELOG + version bump + 5-gate release with smart-notebook v1.10.8 milestone marker shifted in PROJECT.md/TODO.md/ROADMAP.md)
**Authority**: .planning/research/cross-session-memory-and-room-intent.md (606 lines, all 10 sections populated, four critical findings documented, four-tier fix model proposed, Path A recommended). Authored 2026-04-14 in response to the witnessed cross-session leak.

### Phase 85: Windows Hotfix v1.10.9 -- Cross-Platform Parity
**Goal**: Restore full v1.10.8 Phase 84 feature parity on Windows and bring all cross-platform-sensitive UI/context-invocation paths under an explicit OS-dispatch rule. Triggered by Windows QA on 2026-04-15 in the mindrianos-venture room where 5 of 24 scenarios failed from three root causes: (E-P0) better-sqlite3 has no compiled bindings on win32 arm64 killing the entire Phase 84 SQLite layer, (F-P0 security-adjacent) hooks/run-hook.cmd swallowed bash exit codes so PreToolUse write-scope-check was silently inert leaving the sealed-room guard inactive on Windows, (G-P2) vault-export-orchestrator excludes .mindrian/ from rsync so room transplants arrive with empty memory directories. Folded in during scoping: (B-P1) session-start reads plugin.json via python3 which is a Microsoft Store alias stub on Windows producing the "vunknown" banner, (H-P1) generalized rule that every script invoking python3 or any OS-sensitive binary must route through a platform-dispatch helper. Migration from better-sqlite3 to node:sqlite builtin (Node >=22.5.0) eliminates the Windows native-binding failure class permanently; the Node version floor is a documented BREAKING change justified by v1.10.8 being days old and node:sqlite being stable since exactly 22.5.0.
**Depends on**: Nothing structural. Touches hooks/run-hook.cmd, lib/core/*.cjs SQLite wrappers, scripts/session-start, scripts/vault-export-orchestrator.cjs, lib/core/platform.cjs (new). F already landed on main (working tree) prior to phase creation -- 85-04 verifies the diff and adds regression fixture.
**Requirements**: WIN-FIX-E-01, WIN-FIX-E-02, WIN-FIX-E-03, WIN-FIX-E-04, WIN-FIX-E-05, WIN-FIX-F-01, WIN-FIX-F-02, WIN-FIX-F-03, WIN-FIX-G-01, WIN-FIX-G-02, WIN-FIX-B-01, WIN-FIX-B-02, WIN-FIX-H-01, WIN-FIX-H-02, WIN-FIX-H-03, WIN-FIX-R-01 through R-06
**Success Criteria** (what must be TRUE):
  1. Fresh `claude plugin install mos@mindrian-marketplace` on Windows Node 22.5+ produces a working install: banner shows correct version, first session-start creates .mindrian/room.db, first PostToolUse after a Write produces a voice_log row on session stop
  2. Cross-room Write attempt on Windows is BLOCKED by write-scope-check with exit code 2 and an explicit block message, verified by fixture test
  3. All 13 feynman test files green after node:sqlite migration, zero SKIP additions
  4. scripts/session-start banner shows correct plugin version on Windows, Linux, and macOS -- no "vunknown"
  5. Room exported with --mode=transplant arrives at destination with populated .mindrian/room.db preserved
  6. Five-gate release ships (CHANGELOG, plugin.json, package.json, git tag, marketplace.json ref pin) with Node 22.5.0 upgrade warning in release notes
  7. No regressions on Linux or macOS; existing Ubuntu test suite passes unchanged
**Plans**: 7 plans expected (85-01 platform.cjs helper + python3-to-node migration, 85-02 node:sqlite migration across 12 call sites, 85-03 dependency removal + engine bump + full feynman test run, 85-04 run-hook.cmd regression fixture, 85-05 vault export dual-mode + docs, 85-06 session-start banner cross-platform rendering, 85-07 5-gate release)
**Authority**: .planning/phases/85-windows-hotfix-v1.10.9/85-CONTEXT.md (Windows QA report from 2026-04-15 mindrianos-venture room session with 24-scenario breakdown, root cause analysis, and risk register)

**Late-scope note (2026-04-15)**: Plan 85-10 added late-scope 2026-04-15: MOSDeckEngine skill drop-in from user-scope to plugin-scope (shipping invariant), Mac stat -c portable fallback in 4 scripts (LAWRENCE-001), whitespace pipeline Python ML dep auto-install via shared scripts/lib/ensure_ml_deps.py bootstrap helper. Does not modify prior plan scope.

### Phase 87: Security Hardening + Cascade Refactor + Localhost Dashboard (v1.10.11)
**Goal**: Three converging workstreams into one milestone: (A) Security -- fix confirmed Cypher injection + API key permissions + HSI timeout + write-lock atomic. (B) Architecture -- cascade deduplication, async MCP I/O, input validation, transaction safety, Brain session caching, LRU eviction. (C) Product -- localhost live dashboard at :3131 with SQLite graph + wikilink navigation + SSE live-reload + BYO API chat panel (57x token cost reduction via targeted graph queries). Driven by external code review validation on 2026-04-16 (1 confirmed P0, 8 confirmed P1s, 3 false positives debunked) plus the UI/UX pathways architecture from solution-design/ui-ux-pathways/.
**Depends on**: v1.10.10 shipped, Node 22.5+ floor, room.db populated, templates/ with De Stijl CSS, lib/core/platform.cjs
**Requirements**: SEC-01 through SEC-04, CASCADE-01 through CASCADE-06, DASH-01 through DASH-06
**Success Criteria**:
  1. Zero Cypher interpolation in brain-client.cjs
  2. /mos:dashboard live opens browser within 2 seconds showing typed edges from room.db
  3. Filing artifact in terminal updates browser within 1 second via SSE
  4. BYO API chat returns Larry response in under 5K tokens context
  5. Cascade duplication eliminated (shared _runCascadeSteps function)
  6. Feynman tests green throughout (22+ test files expected)
  7. ROOM.md + MINTO.md invariant enforced on every folder
  8. 5-gate release: CHANGELOG, plugin.json 1.10.11, package.json 1.10.11, tag v1.10.11, marketplace pin
**Plans**: 13 plans across 6 waves (milestone split: Stream A v1.10.11 + Stream B v1.10.12)

Plans:
- [x] 87-00-PLAN.md -- Cascade e2e integration test fixture (wave 0, gates 87-03; CASCADE-01, CASCADE-02)
- [x] 87-01-PLAN.md -- Cypher sanitization + API key permissions + HSI timeout (wave 1, Stream A; SEC-01, SEC-02, SEC-03)
- [x] 87-01a-PLAN.md -- ROOM.md + MINTO.md git pre-commit hook installer (wave 1, Stream A; SEC-04)
- [x] 87-02-PLAN.md -- Write lock atomic creation via openSync 'wx' (wave 1, Stream A; SEC-04, CASCADE-04)
- [x] 87-08-PLAN.md -- Localhost live dashboard at :3131 with SSE + 127.0.0.1 bind guard (wave 1, Stream A; DASH-01..06)
- [x] 87-10-PLAN.md -- v1.10.11 release gate (wave 5, Stream A; 5-gate release)
- [x] 87-03-PLAN.md -- Cascade deduplication via _runCascadeSteps (wave 2, Stream B, gated by 87-00; CASCADE-01, CASCADE-02)
- [x] 87-05-PLAN.md -- MCP input validation (Zod regex + path traversal guard + opportunity schema) (wave 2, Stream B; CASCADE-03, CASCADE-05)
- [x] 87-06-PLAN.md -- indexArtifact BEGIN/COMMIT transaction + write-lock outer guard (wave 2, Stream B; CASCADE-04)
- [x] 87-04-PLAN.md -- Sync/async two-entry-point split (room-ops-sync + async + shared) (wave 3, Stream B; CASCADE-06)
- [x] 87-07-PLAN.md -- Brain session cache (5-min TTL) + LRU eviction (cap 100) (wave 3, Stream B; CASCADE-06)
- [x] 87-09-PLAN.md -- BYO API chat panel with Bearer token auth (folds 87-09a plumbing + 87-09b stakeholders verification) (wave 4, Stream B; DASH-04)
- [x] 87-10-v2-PLAN.md -- v1.10.12 release gate (wave 5, Stream B; 5-gate release)
**Authority**: .planning/phases/87-security-hardening-cascade-refactor/87-CONTEXT.md

### Phase 88: Per-Folder Memory Triple Wiring
**Goal**: Wire the per-folder memory triple (ROOM.md + STATE.md + Feynman-MINTO.md) through the session lifecycle so it functions as true cross-session memory. STATE.md is already wired on-stop. ROOM.md is partially wired (created, not re-compiled as references change). Feynman-MINTO is unwired (zero skills read it, no hook regenerates it). This phase closes both gaps via five wires + unified read contract + invariants + guardian.
**Depends on**: Phase 87 v1.10.11 (security + 87-01a pre-commit hook + 87-02 atomic write-lock), Phase 81 (Feynman-MINTO file type), Phase 84 (room.db), CLAUDE.md decision #15 (ROOM.md per folder)
**Requirements**: Five wires (post-write freshness, on-stop snapshot, session-start TRIPLE_CONTEXT injection, pre/post-compact resilience, decision_log persistence) + `lib/core/folder-memory.cjs` read contract + `lib/core/feynman-minto-invariants.cjs` + `scripts/feynman-minto-guardian.cjs`
**Success Criteria** (what must be TRUE):
  1. Feynman-MINTO.md files auto-regenerate within 30s of room section artifact writes
  2. ROOM.md references auto-recompile within 200ms of artifact writes, machine-managed region delimited, manual content preserved
  3. STATE.md on-stop contract unchanged and green
  4. `lib/core/folder-memory.cjs` exposes unified readTriple(); at least one skill consumes it by Wave 4
  5. session-start injects TRIPLE_CONTEXT block for active sections under 20% of session-start budget
  6. Triple signal survives compaction (pre/post-compact wires functional)
  7. decision_log persists APPROVE/REJECT/DEFER across sessions; Session B Larry references Session A decisions
  8. Cross-session acceptance test passes (file weak-TAM artifact + defer in Session A; open Session B; Larry references prior flag)
  9. Feynman tests stay green (17/17 at phase start, 38/38 at 88-05 ship point) throughout
  10. 5-gate release: CHANGELOG 1.10.13, plugin.json 1.10.13, package.json 1.10.13, git tag v1.10.13, marketplace pin
**Plans**: 16 plans across 6 waves
Plans:
- [x] 88-00-B-PLAN.md -- Feynman-MINTO Invariants Module (existence, schema, freshness, coherence, atomicity categories; critical/error/warning/info severity)
- [x] 88-00-PLAN.md -- Feynman-MINTO frontmatter schema extension (last_generated_at, last_artifact_write_seen_at, reasoning_health_score, flagged_weaknesses, decision_log)
- [x] 88-01-PLAN.md -- `lib/core/folder-memory.cjs` read contract (readTriple returns unified ROOM + STATE + reasoning signal)
- [x] 88-02-PLAN.md -- `scripts/minto-debouncer.cjs` queue with 10s coalescing window (atomic writes, self-healing reader, Atomics.wait sync sleep)
- [x] 88-03-PLAN.md -- ROOM.md references recompiler (deterministic, atomic, machine-managed region, mtime conflict detection)
- [x] 88-04-B-PLAN.md -- Atomic write contract for Feynman-MINTO generator (tmpfile + fsync + invariants gate + atomic rename)
- [x] 88-04-PLAN.md -- post-write hook triple-fire (stamp + recompile + debouncer enqueue; Write/Edit/MultiEdit parity)
- [x] 88-05-PLAN.md -- UserPromptSubmit drain background regen runner (30s staleness threshold, detached child spawn, pending-tier1-regen bridge)
- [x] 88-06-PLAN.md -- on-stop close-out snapshot (drain debouncer 5s timeout, recompile ROOM refs, write session-snapshot.json)
- [x] 88-07-PLAN.md -- session-start TRIPLE_CONTEXT injection block with budget cap
- [x] 88-08-PLAN.md -- pre-compact triple snapshot (atomic write, 2s hook timeout)
- [x] 88-09-PLAN.md -- post-compact TRIPLE_CONTEXT re-injection with lazy-read fallback
- [x] 88-10-PLAN.md -- decision-capture helper writes to decision_log with 20-entry cap + monthly archive
- [x] 88-11-PLAN.md -- APPROVE/REJECT/DEFER cascade dual-write to graph + decision_log
- [x] 88-12-PLAN.md -- v1.10.13 5-gate release
- [x] 88-13-PLAN.md -- Feynman-MINTO Guardian boundary enforcement (session-start validate, on-stop verify, pre-commit extend)
**Authority**: .planning/phases/88-feynman-minto-memory-layer/88-CONTEXT.md

### Phase 88.7: power-demo-multipage-export (INSERTED)

**Goal:** [Urgent work - to be planned]
**Requirements**: TBD
**Depends on:** Phase 88
**Plans:** 1/1 plans complete

Plans:
- [x] TBD (run /gsd:plan-phase 88.7 to break down) (completed 2026-04-24)

### Phase 88.6: Python Algorithm Wiring (v1.10.14)
**Goal**: Close the orphan-value gap between the Python algorithm layer (15 verified scripts) and the user-facing product surface (/mos:* commands). Fix one silent production bug (discover-* pipelines silently return 0 zones when brain-baseline.json missing), expose four orphan Wave-1 algorithms (Funk and Owen-Smith Disruption Index, Good-Turing Blindspot Mass, Centroid-Distance Element Novelty, Leave-One-Out Bayesian Surprise) via new /mos:diagnostics command, wrap two-step external whitespace flow behind single command surface with rate-limit graceful degradation. Orchestration-only phase, zero new algorithms. Triggered by mid-milestone discovery during Rubos meeting (John Shorter, Ryan Lewis) where Ryan's technical questions prompted an audit that surfaced the orphan-value gap.
**Depends on**: Phase 88 v1.10.13 (shipped), Node 22.5+, existing Python scripts (scripts/compute-*.py, scripts/discover-*.py, scripts/fetch-brain-baseline.cjs, scripts/query-semantic-scholar.cjs, scripts/compute-external-whitespace.py)
**Requirements**: WIRING-88.6-01-baseline-auto-fire, WIRING-88.6-01-graceful-offline, WIRING-88.6-02-diagnostics-surface, WIRING-88.6-02-wave1-algorithms-exposed, WIRING-88.6-02-interpretation-strings, WIRING-88.6-03-external-orchestration, WIRING-88.6-03-rate-limit-graceful, WIRING-88.6-04-release-gate
**Success Criteria** (what must be TRUE):
  1. Running /mos:whitespace map, /mos:whitespace discover, /mos:whitespace external, or node scripts/discovery-cycle.cjs on a room without .mindrian/brain-baseline.json auto-fetches the baseline OR prints explicit 'baseline unavailable, Brain offline' message -- never silent zero
  2. /mos:diagnostics runs all four Wave-1 scripts and renders a 4-row Shape E (Action Report) output with interpretation strings per metric; discoverable via /mos:help
  3. /mos:whitespace external orchestrates Semantic Scholar query then compute-external-whitespace as a single command; reports 'N of M queries rate-limited' when partial; fails explicitly with 'Semantic Scholar unavailable' only when entire corpus unreachable
  4. Canon Part 7 (Reuse Before Build) honored: /mos:diagnostics justification documented (orthogonal to /mos:grade pedagogical rubric); /mos:whitespace external extends existing surface
  5. Canon Part 8 (Graph Boundary) honored: no user-specific strings egress to Brain in any of the three pipelines; external papers are SIGNAL (public data), flow LOCAL only
  6. Empirical smoke test on ~/MindrianRooms/mindrianOS/: 4 Wave-1 metrics render with plausible values matching CONTEXT.md baseline (CD ~= -0.71, coverage ~= 0.667, novelty mean ~= 0.08)
  7. 5-gate release: CHANGELOG 1.10.14, plugin.json 1.10.14, package.json 1.10.14, git tag v1.10.14, marketplace pin (Gates 1-3 autonomous; Gates 4-5 user-action checkpoint per v1.10.13 protocol)
**Plans**: 4 plans across 3 waves
Plans:
- [x] 88.6-01-baseline-auto-fire-PLAN.md -- Shared scripts/ensure-brain-baseline.cjs helper + wire into discovery-cycle.cjs and whitespace-command.cjs (Wave 1)
- [~] 88.6-02-diagnostics-command-PLAN.md -- /mos:diagnostics command + scripts/diagnostics-command.cjs dispatcher + /mos:help listing update (Wave 1). **Partial**: dispatcher shipped (commit c2e02ca, 345 lines). SUMMARY backfilled 2026-04-23 with 3 Known Gaps to resolve in 88.6-04: commands/diagnostics.md untracked, commands/help.md not updated, human-verify checkpoint unrecorded.
- [x] 88.6-03-external-whitespace-orchestration-PLAN.md -- query-semantic-scholar.cjs per-query telemetry (Task 0, commit b297acf) + rate-limit-aware cmdExternal (Task 1, commit 674a3ce) + whitespace.md external subcommand doc (Task 2, commit 3d550ad). Wave 2, depended on 88.6-01. Live smoke-tested: Semantic Scholar 429 captured and surfaced end-to-end via status:'rate_limited' telemetry. Feynman suite 46/46 passing.
- [x] 88.6-04-release-gates-PLAN.md -- CHANGELOG/plugin.json/package.json v1.10.14 bump (surgical Edit, preserve 10 deps) + CANON-PHASE-MAP update + Workspace Guard + 5-gate release checkpoint (Wave 3, depends on 88.6-01, 88.6-02, 88.6-03) + MUST resolve the 3 Known Gaps from 88.6-02 before CHANGELOG can claim /mos:diagnostics as a user-facing command
**Authority**: .planning/phases/88.6-python-algorithm-wiring/CONTEXT.md (filed 2026-04-23, empirical evidence from 2026-04-23 smoke test on ~/MindrianRooms/mindrianOS/)

### Phase 88.1: UI/UX Polish + MINTO Surface Plumbing
**Goal**: Close the gap between MindrianOS shipped surface (71 commands, 9 skills, 8 agents, 10+ hooks) and the Claude Code 2.1.x polish bar for a moat-depth plugin. Four workstreams: MINTO surface plumbing wired to Phase 88 governing_thought, description-driven UX sweep, hook output primitive retrofit, README as 7th surface. Boring hygiene that raises the trust floor before Phase 88.2 adds interactive Selector Block primitives on top.
**Depends on**: Phase 88 v1.10.13 (triple wired, governing_thought stable across sessions)
**Requirements**: Workstream A (statusline MINTO segment, /mos:status MINTO summaries, SessionStart MINTO banner) + Workstream B (71 command description hygiene sweep, README permissions block, agent PROACTIVELY audit) + Workstream C (systemMessage retrofit on 9 hooks, schema validation hook, async artifact auto-commit hook) + Workstream D (README 3-paragraph user-expectation setter)
**Success Criteria** (what must be TRUE):
  1. Statusline reads active section governing_thought via folder-memory.cjs within 300ms render budget
  2. /mos:status replaces raw artifact counts with 1-line governing_thought per filled section
  3. SessionStart banner shows top-3 most-recently-modified sections' governing_thoughts
  4. 71 command descriptions under 60 chars, verb-first, user vocabulary, under-promise pattern
  5. README ships permissions.allow block matching real no-prompt usage
  6. All 9 existing hooks produce systemMessage output (no silent hooks)
  7. Feynman tests stay green (currently 28/28 at v1.10.12 HEAD)
  8. MWP moat deepened (every plan connects to a moat layer)
  9. 5-gate release: CHANGELOG 1.10.14, plugin.json 1.10.14, package.json 1.10.14, git tag v1.10.14, marketplace pin
**Plans**: 10 plans across 4 waves (not yet filed)
**Authority**: .planning/phases/88.1-uiux-polish/88.1-CONTEXT.md

### Phase 89: Reverse-Salient Engine
**Goal**: Formalize Hughes 1983 reverse-salient detection as a standalone engine that identifies the lagging component in an expanding venture. Computes per-section embedding-distance lag signals and attack vectors. Optional consumer of Phase 88 reasoning_health_score. Ships independently of Phase 88/90/91; not blocking other phases.
**Depends on**: Existing Python HSI pipeline (sentence-transformers + LSA), existing Pinecone 1,427 methodology embeddings; no hard blockers
**Requirements**: Reverse-salient algorithm extraction, per-section lag computation, attack-vector generation, CLI integration (/mos:find-bottlenecks wraps engine), Brain signal consumption path
**Success Criteria** (what must be TRUE):
  1. Reverse-salient algorithm computes lag signal per room section deterministically
  2. /mos:find-bottlenecks surfaces top-N lagging components with attack vectors
  3. Graceful degradation when embeddings absent (tier-0 fallback to structural signal)
  4. Feynman tests stay green throughout
  5. Optional integration path with Phase 88 reasoning_health_score exercised in fixture
**Plans**: 7 plans on disk (89-01 through 89-07), 6 SUMMARYs shipped (89-01, 89-02, 89-03, 89-04, 89-05, 89-06)
Plans:
- [x] 89-01-PLAN.md -- rs-engine Mode A internal single-room (shipped 2026-04-23; 89-01-SUMMARY.md)
- [x] 89-02-PLAN.md -- rs_corpus external fetcher + Mode B dispatch (shipped 2026-04-23; 89-02-SUMMARY.md)
- [x] 89-03-PLAN.md -- rs_cache Pinecone warm/cold/bypass (shipped 2026-04-24; 89-03-SUMMARY.md)
- [x] 89-04-PLAN.md -- cross-room Mode A multi-room (shipped 2026-04-20; 89-04-SUMMARY.md)
- [x] 89-05-PLAN.md -- Mode C hybrid room x external unified matrix (shipped 2026-04-24; 89-05-SUMMARY.md)
- [x] 89-06-PLAN.md -- Obsidian bridge artifact writer (shipped 2026-04-23; 89-06-SUMMARY.md)
- [ ] 89-07-PLAN.md -- (remaining: ReverseSalientAgent + release wiring)
**Authority**: .planning/phases/89-reverse-salient-engine/89-CONTEXT.md (plus ALGORITHM-SOURCE.md, PLAN-CHECK.md, PLAN.md, RESEARCH.md)

### Phase 89.1a: Brain Methodology Substrate Loader
**Goal**: Build the Brain-to-Local methodology substrate pipeline that is the prerequisite to the v1.11.0 reverse-salient rewiring. Pull the 1,427 canonical methodology embeddings from the Brain Pinecone index into a local substrate cache, via a generic-handle query builder that enforces Canon Part 8 on every outbound query (no user data ever reaches Brain). Local cache persists with TTL and atomic write-then-rename to .mindrian/brain-substrate-cache.json. Adversarial fixture tests inherit the Phase 90 5-tripwire pattern.
**Depends on**: Phase 90 Brain Derivation Layer (Canon Part 8 5-tripwire pattern shipped in v1.10.18), existing brain-client.cjs chokepoint, existing Pinecone methodology index (pws-brain namespaces), Phase 89 v1.10.16 primitives (rs_math.py Kwan LSA + rs_cache.py Pinecone e5-large — keep, do not replace)
**Requirements**:
- `lib/core/rs-brain-substrate.cjs` that pulls 1,427 Brain methodology embeddings via generic-handle queries and hydrates a local substrate usable by the RS algorithm
- Generic-handle query builder (single chokepoint) enforcing Canon Part 8 allow-list on every outbound Brain query (framework IDs, phase IDs, problem types, enum scalars only — NEVER artifact bodies, venture names, meeting content, proprietary numbers)
- Local substrate cache at `.mindrian/brain-substrate-cache.json` with TTL-driven invalidation and atomic persistence (write-to-tmp then rename)
- Fixture test suite with adversarial payloads (leaked user section bytes, leaked venture names, malformed payload injection) verifying zero user-content bytes reach Brain — inherits Phase 90 5-tripwire pattern (schema doc + prompt-builder allow-list + invariants validator + aggregator sanitize+audit + graceful-degradation sweep)
- Graceful degradation: Brain offline → cached substrate served if fresh, stale-cache served with warning if past TTL but present, tier-0 empty-substrate mode if no cache and no Brain
- Three-surface compatibility (CLI + Desktop MCP + Cowork)
- Zero new runtime dependencies (native fetch + existing brain-client.cjs + existing fs.promises)
- BSL 1.1 header on all new source (CJS + tests)
- Zero em-dashes (hyphens only)
- `canon_parts:` frontmatter declaring Part 7 (Reuse Before Build — extends Phase 90 tripwire pattern, reuses brain-client.cjs) and Part 8 (Graph Boundary — the core invariant this phase defends)
**Success Criteria** (what must be TRUE):
  1. `lib/core/rs-brain-substrate.cjs` exports `loadSubstrate({forceRefresh})` returning the 1,427-embedding methodology substrate from cache or fresh Brain pull
  2. Every outbound Brain query passes through the single generic-handle query builder chokepoint; no other code path may call brain-client directly for methodology embeddings
  3. Adversarial fixture suite (≥6 scenarios covering leaked artifact bytes, leaked venture names, leaked meeting transcript fragments, leaked proprietary numbers, malformed payload injection, oversized payload) all FAIL the query before bytes leave the process
  4. Local substrate cache persists to `.mindrian/brain-substrate-cache.json` with TTL metadata (default 30d per kickoff §15) and atomic write-then-rename (tmp file + rename)
  5. Graceful degradation verified: Brain offline → fresh cache returns substrate, stale cache returns with warning, no cache returns tier-0 empty substrate without crash
  6. Feynman test suite stays green + new `lib/memory/test-rs-brain-substrate.cjs` registers with `lib/memory/run-feynman-tests.cjs`
  7. NO release gate — bundled into v1.11.0 final ship at Phase 91.x per milestone §7 (no mid-milestone releases per user Intent 3)
**Plans**: 4 plans across 3 waves (filed 2026-04-24)
Plans:
- [x] 89.1a-01-PLAN.md -- Substrate loader core + generic-handle query builder chokepoint + preSendAudit tripwire (Wave 1; SC-01, SC-02, SC-05)
- [x] 89.1a-02-PLAN.md -- Local cache + atomic persistence + drop-in invariants validator (Wave 2; SC-04, SC-05)
- [x] 89.1a-03-PLAN.md -- 14-scenario adversarial fixture suite + A1/A2 cross-scenario sweeps + Feynman registration (Wave 3; SC-03, SC-05, SC-06)
- [x] 89.1a-04-PLAN.md -- Phase gate transcript + live Brain smoke test + human-verify phase close (Wave 3; SC-07)
**Authority**: .planning/milestones/v1.11.0-KICKOFF.md §5 (Engine Architecture), §4 (Architecture - Canon Part 8 Compliant), §8 (Canon Compliance Plan), §9 (Implementation Guidance); .planning/milestones/v1.12.0-LIVE-VALIDATION-2026-04-24.md §4 (bidirectional NL-graph architecture context)

### Phase 89.1: Domain Analysis + Query Generation Matrix
**Goal**: Add Domain Analysis as the missing FIRST step of the reverse-salient framework (closing the user Intent 1 gap from v1.11.0 kickoff). Ship `lib/core/rs-domain-analyzer.cjs` running Sequential-Thinking-style decomposition (concepts + terminology + methods + breakthroughs) per topic, and `lib/core/rs-query-matrix.cjs` generating the 15-query x 4-category matrix (A intersect B, A leads to B, B leads to A, adjacent) that drives downstream external research fetching in 89.2. Consume the Brain methodology substrate shipped by Phase 89.1a. RESOLVE the deferred brain-client search response shape mismatch (filed at .planning/phases/89.1a-brain-methodology-substrate-loader/deferred-items.md item 1) so loadSubstrate Mode A3 actually returns embedding-bearing methodology vectors under live Brain. File the ONE legitimate Brain-write of v1.11.0: USES_TECHNIQUE edge from rss-phase-1 to tech-domain-analysis (methodology canon evolution, NOT user data).
**Depends on**: Phase 89.1a (Brain Methodology Substrate Loader -- shipped 2026-04-24); existing brain-client.cjs; existing rs-brain-substrate.cjs + rs-brain-substrate-prompts.cjs; /mos:admin admin path for the canon Brain-write
**Requirements**:
- `lib/core/rs-domain-analyzer.cjs` -- per-topic domain analysis producing structured output {primary_domain, concepts[], terminology[], methods[], breakthroughs[], boundary_flag, adjacent_domains[]}; uses Sequential Thinking style decomposition; consumes Brain methodology substrate for canonical concept seeding
- `lib/core/rs-query-matrix.cjs` -- generates 60 queries (15 per category x 4 categories: A intersect B, A leads to B, B leads to A, adjacent) from a Domain Analysis output; query strings are external-fetcher ready (no semantic noise, single-concept anchors)
- Resolve brain-client shape mismatch: implement chosen remediation (shape adapter inside pullFromBrain OR new searchWithVectors method per deferred-items.md options 1/2). Either path must preserve Canon Part 8 chokepoint + allow-list + preSendAudit
- File USES_TECHNIQUE edge: `MATCH (p:ProcessStep {id: "rss-phase-1"}), (t:Technique {id: "tech-domain-analysis"}) MERGE (p)-[:USES_TECHNIQUE]->(t)` via /mos:admin brain-write path; this is the ONE allowed Brain-write of v1.11.0; rollback Cypher captured in SUMMARY
- Live A3 mode verification: re-run the 89.1a-LIVE-BRAIN-SMOKE.md test post-fix; cache must populate with non-empty embeddings and Mode A3 reported, not Mode B3
- Adversarial fixture coverage extension: domain analyzer + query matrix outputs MUST pass the same FORBIDDEN_PATTERNS scan that 89.1a applies to Brain queries (so leaked user content cannot enter the query matrix that gets sent to external fetchers in 89.2)
- Three-surface compatibility (CLI + Desktop MCP + Cowork)
- Zero new runtime dependencies; CJS only; BSL 1.1 header on all new source; zero em-dashes
- `canon_parts:` frontmatter declaring Part 7 (Reuse: extends 89.1a + brain-client without forking) and Part 8 (the Brain-write is methodology canon evolution, NOT user data; chokepoint preserved)
**Success Criteria** (what must be TRUE):
  1. `rs-domain-analyzer.cjs` exports `analyzeDomain(topic, opts)` returning the structured 7-field output
  2. `rs-query-matrix.cjs` exports `generateQueryMatrix(domain_analysis, opts)` returning 60 queries (15 per category x 4 categories)
  3. brain-client shape mismatch resolved: `loadSubstrate({forceRefresh: true})` returns Mode A3 with `embedding_count > 0` against live Brain (replaces Mode B3 fallback observed in 89.1a smoke)
  4. USES_TECHNIQUE edge filed in Brain via /mos:admin; SUMMARY captures Cypher used + rollback Cypher; /mos:admin audit log records the single write
  5. Domain analyzer + query matrix outputs pass FORBIDDEN_PATTERNS scan (no user content reachable to downstream fetchers)
  6. Feynman test suite stays green + new test files registered (test-rs-domain-analyzer.cjs + test-rs-query-matrix.cjs minimum)
  7. NO release gate -- bundled into v1.11.0 final ship at Phase 91.x per milestone §7
**Plans**: 5 plans across 3 waves (filed 2026-04-25)
Plans:
- [x] 89.1-01-PLAN.md -- brain-client shape adapter inside pullFromBrain (Option 1 locked) + validator Check E embedding-or-score relaxation + adversarial shape suite (Wave 1; SC-03)
- [x] 89.1-02-PLAN.md -- rs-domain-analyzer.cjs deterministic 7-field decomposition + Canon Part 8 output audit + 11-scenario fixture suite (Wave 2; SC-01, partial SC-05)
- [x] 89.1-03-PLAN.md -- rs-query-matrix.cjs 60-query 4-category fixed-order template + Canon Part 8 per-query audit + 11-scenario fixture suite (Wave 2; SC-02, partial SC-05)
- [x] 89.1-04-PLAN.md -- USES_TECHNIQUE Brain-write canonization via /mos:admin brain-write + admin-brain-write.cjs one-shot wrapper + canon-write evidence doc (Wave 3; SC-04)
- [x] 89.1-05-PLAN.md -- Phase Gate transcript + Feynman registration (baseline 63 -> 65) + live A3 re-verification + canon edge live read (Wave 3; SC-06, SC-07)
**Authority**: .planning/milestones/v1.11.0-KICKOFF.md §5 (Phase 1 Topic + Domain Analysis), §3 (Audit findings -- "Domain analysis prerequisite half-canonized"), §8 (Canon Canonization ONE Brain Write); .planning/phases/89.1a-brain-methodology-substrate-loader/deferred-items.md (brain-client shape mismatch to resolve); .planning/phases/89.1a-brain-methodology-substrate-loader/89.1a-LIVE-BRAIN-SMOKE.md (live Brain evidence + observed-vs-expected diff)

### Phase 89.2: External Research Fetching (EXPANDED) + Preprocessing + Scoring + Thesis + Experts
**Goal**: Ship Phase 1.5 + Phase 2 + Phase 3 + Phase 4 of the canonical Reverse Salient framework (per kickoff §5 engine architecture). Consume the 60-query matrix produced by Phase 89.1's `rs-query-matrix.cjs::generateQueryMatrix` and run it through 4 new external fetchers (academic / patents / industry / experts), 1 preprocessor, 1 differential scorer, 1 innovation classifier, 1 breakthrough scorer, and 1 thesis generator. Every fetcher introduces a NEW external-egress surface and MUST inherit Canon Part 8's 5-tripwire pattern (chokepoint + ExternalEgressViolation + auditQuery + drop-in validator + ≥4 adversarial fixtures per source) so leaked user content cannot reach public APIs. Per-source rate-limit graceful degradation per Phase 88.6-03 pattern. Bundled into v1.11.0 final ship at Phase 91.x.
**Depends on**: Phase 89.1a (Brain methodology substrate loader -- shipped 2026-04-25); Phase 89.1 (domain analyzer + 60-query matrix + ExternalEgressViolation pattern -- shipped 2026-04-26); existing v1.10.16 primitives `lib/core/rs_corpus.py` + `rs_cache.py` + `rs_math.py` (extend, do not fork per Canon Part 7)
**Requirements**:
- `lib/core/rs-fetcher-academic.cjs` -- extend v1.10.16 OpenAlex+arXiv baseline; ADD Scopus + PubMed + IEEE + Nature/Science via native `fetch`; consume queries from rs-query-matrix output; per-source rate-limit + graceful degradation
- `lib/core/rs-fetcher-patents.cjs` -- NEW: Google Patents + USPTO via native `fetch`; same per-source budget + telemetry pattern
- `lib/core/rs-fetcher-industry.cjs` -- NEW: Crunchbase + corporate R&D + startup trackers via Tavily-orchestrated calls (Tavily MCP already in stack); fall back to graceful degradation if Tavily unavailable
- `lib/core/rs-fetcher-experts.cjs` -- NEW: extract authors + institutions + ORCID from academic fetcher results; output feeds 89.5 expert network mapping; public author emails from OpenAlex allowed per kickoff §15 open-question-4 (anything behind login: skip)
- `lib/core/rs-preprocessor.cjs` -- NEW: Phase 2 of canonical framework; produces per-document `{technical_terms[], concepts[], methods[], relevance, boundary_flag}` from raw fetcher output; deterministic (no runtime LLM call from CLI surface)
- `lib/core/rs-differential-scorer.cjs` -- NEW: Phase 3 detection; dual-floor filters per kickoff §5 (`diff > 0.3 AND LSA > 0.2 AND BERT > 0.2`); consumes existing `rs_math.py` (Kwan LSA) + `rs_cache.py` (Pinecone e5-large BERT) primitives
- `lib/core/rs-innovation-classifier.cjs` -- NEW: Phase 3 classification; outputs one of `structural_transfer | semantic_implementation | hybrid` per scored pair; deterministic rule-based on the differential scorer output
- `lib/core/rs-breakthrough-scorer.cjs` -- NEW: Phase 3 scoring; 0-10 rubric across 5 dimensions (feasibility + market + magnitude + advantage + impact); deterministic weighted sum from substrate metadata + classifier output
- `lib/core/rs-thesis-generator.cjs` -- NEW: Phase 4 synthesis; emits "By applying [X] to [Y], achieve [Z] because [mechanism]" template from classifier + breakthrough scorer outputs; pure template fill, no runtime LLM
- Canon Part 8 enforcement on EVERY new egress surface: each fetcher inherits T1-T5 (schema doc + chokepoint allow-list + drop-in invariants validator + pre-send `JSON.stringify` audit + cross-scenario adversarial sweep ≥4 scenarios per fetcher)
- `ExternalEgressViolation` (89.1's sibling class) is the throw point on every fetcher's pre-egress audit; user content never crosses outbound boundary
- Per-source rate-limit + graceful degradation per Phase 88.6-03 pattern; per-source budget persisted in `external-papers.json queries[]` (mirror existing 88.6-03 telemetry)
- Strict 1024-dim cosine over local substrate (filed forward from 89.1) -- 89.2's preprocessor + differential scorer use vector form for dual-similarity; vector pull via `rs_cache.py` Pinecone direct (`include_values=true`); confirm in planning whether Phase 89.2 needs vectors now or 89.3 can defer
- Three-surface compatibility (CLI + Desktop MCP + Cowork)
- Zero new runtime dependencies (native `fetch` + existing `rs_corpus.py` + Tavily MCP already in stack); CJS only for new JS; Python only if extending existing `rs_*.py` primitives (preferred CJS for new modules per kickoff §9)
- BSL 1.1 header on every new source file (CJS + Python); zero em-dashes; hyphens only
- `canon_parts: [part-7, part-8]` + `bundled_release: true` frontmatter on every plan
- TDD discipline: every plan ships RED -> GREEN atomic commits; test files under `lib/memory/`; register every new test in `lib/memory/run-feynman-tests.cjs` (current Feynman baseline 65 after 89.1)
- Phase Gate transcript at end of phase mirroring 89.1-PHASE-GATE.md format (G1-G9 + N E asserts where N = fetcher count)
**Success Criteria** (what must be TRUE):
  1. `rs-fetcher-academic.cjs` exports `fetchAcademic(queries, opts)`; under live conditions returns deduped paper objects from at least OpenAlex + arXiv with telemetry persisted; Scopus / PubMed / IEEE / Nature degrade gracefully if API key absent
  2. `rs-fetcher-patents.cjs` exports `fetchPatents(queries, opts)`; returns Google Patents + USPTO results or graceful empty with telemetry note
  3. `rs-fetcher-industry.cjs` exports `fetchIndustry(queries, opts)`; uses Tavily orchestration; degrades to empty if Tavily unavailable
  4. `rs-fetcher-experts.cjs` exports `mapExperts(papers, opts)`; produces author + institution + ORCID structured output from academic fetcher results
  5. `rs-preprocessor.cjs` exports `preprocess(documents, opts)`; produces structured per-document output (5 fields) deterministically (same input -> same output)
  6. `rs-differential-scorer.cjs` exports `score(query_concept, doc_concept, opts)`; dual-floor filter applied; returns `{diff, lsa, bert, passes}` per pair
  7. `rs-innovation-classifier.cjs` exports `classify(scored_pair, opts)`; returns one of `structural_transfer | semantic_implementation | hybrid` deterministically
  8. `rs-breakthrough-scorer.cjs` exports `scoreBreakthrough(classified_pair, opts)`; returns `{score: 0-10, breakdown: {feasibility, market, magnitude, advantage, impact}}`
  9. `rs-thesis-generator.cjs` exports `generateThesis(classified_pair, breakthrough, opts)`; returns thesis string matching template
  10. Every fetcher passes Canon Part 8 adversarial fixture suite (≥4 scenarios each); FORBIDDEN_PATTERNS scan throws `ExternalEgressViolation` before egress on any leaked user content
  11. Per-source rate-limit graceful degradation verified (mock 429 response + verify telemetry capture + verify graceful empty result)
  12. Feynman test suite stays green + new test files registered (8 new test files minimum: one per new module + one per fetcher integration smoke); baseline 65 -> 73+
  13. NO release gate -- bundled into v1.11.0 final ship at Phase 91.x per milestone §7
**Plans**: 8 plans across 4 waves
Plans:
- [x] 89.2-01-egress-primitives-PLAN.md -- shared ExternalEgressViolation + FORBIDDEN_PATTERNS re-export + per-source telemetry primitive (Wave 1; SC-10, SC-11)
- [x] 89.2-02-fetcher-academic-PLAN.md -- 6-source academic fetcher (OpenAlex+arXiv+Scopus+PubMed+IEEE+Nature) + chokepoint + drop-in validator + 12+6 fixture suite (Wave 2; SC-01, SC-10, SC-11)
- [x] 89.2-03-fetcher-patents-PLAN.md -- Google Patents + USPTO fetcher + chokepoint + drop-in validator + 11+6 fixture suite (Wave 2; SC-02, SC-10, SC-11)
- [x] 89.2-04-fetcher-industry-PLAN.md -- Tavily-orchestrated industry fetcher with two-layer audit + chokepoint + drop-in validator + 10+6 fixture suite (Wave 2; SC-03, SC-10, SC-11)
- [x] 89.2-05-fetcher-experts-PLAN.md -- experts post-processor (no egress; auditQueryObject defense in depth) + 11 fixture suite (Wave 2; SC-04, SC-10)
- [x] 89.2-06-preprocessor-and-differential-scorer-PLAN.md -- rs-pinecone-bridge + rs-preprocessor (Phase 2 deterministic 5-field) + rs-differential-scorer (Phase 3 dual-floor 0.3/0.2/0.2) + strict 1024-dim cosine via existing rs_cache.py + 24 fixture scenarios (Wave 3; SC-05, SC-06)
- [x] 89.2-07-classifier-breakthrough-thesis-PLAN.md -- innovation classifier (3 enum) + breakthrough scorer (5-dimension 0-10) + thesis generator (template fill) + 27 fixture scenarios (Wave 3; SC-07, SC-08, SC-09)
- [x] 89.2-08-feynman-registration-and-phase-gate-PLAN.md -- Feynman registration sweep (66 -> 76) + Phase Gate transcript (9G + 5E asserts) + VERIFICATION.md (13 SCs) (Wave 4; SC-12, SC-13)
**Authority**: .planning/milestones/v1.11.0-RESUME-89.2.md (cross-session handoff doc); .planning/milestones/v1.11.0-KICKOFF.md §5 (Phase 1.5 + Phase 2 + Phase 3 + Phase 4 of canonical framework), §6 (chain mechanism downstream context), §7 (bundled milestone), §8 (Canon Part 8 + Part 7), §9 (implementation guidance + graceful degradation), §15 (open questions for planner to resolve); .planning/phases/89.1a-brain-methodology-substrate-loader/ (substrate loader contract); .planning/phases/89.1-domain-analysis-and-query-matrix/ (60-query matrix + ExternalEgressViolation pattern + Phase Gate template)

### Phase 89.3: 5-branch Mind Map + Full Neo4j Schema Deployment
**Goal**: Ship the Output Layer of the canonical Reverse Salient framework per kickoff §5. Take the classified + scored + thesis-bearing pairs produced by 89.2 (Phase 1.5 + 2 + 3 + 4 modules) and persist them into the user's graph store (Aura when connected, SQLite room.db when not -- Tier 0 / Tier 1 graceful degradation per Canon Decision 6) plus surface a 5-branch Cytoscape mind map for navigation. Resolve fetched authors against the user's Aura via Cypher MATCH so expert networks are queryable. Enhance the existing v1.10.16 bridge-writer with thesis + breakthrough score so existing artifact pipelines pick up the new richness. Bundled into v1.11.0 final ship at Phase 91.x.
**Depends on**: Phase 89.2 (all 8 modules shipped 2026-04-26 -- output of classifier + scorer + thesis is the input to this phase); existing lib/core/lazygraph-ops.cjs (SQLite room.db + Aura dual-backend graph ops -- EXTEND EDGE_TYPES, do not fork per Canon Part 7); existing scripts/rs-engine.py / lib/core/bridge-writer.cjs (v1.10.16 baselines to enhance with breakthrough metadata)
**Requirements**:
- `lib/core/rs-neo4j-writer.cjs` -- Aura Cypher writer for full RS schema: nodes RSDiscovery + ReverseSalient + Innovation + Paper + Author + Institution; edges DISCOVERED + DERIVED_FROM + ENABLES + AUTHORED_BY + AFFILIATED_WITH; idempotent MERGE pattern; per-write rollback Cypher captured
- `lib/core/rs-sqlite-mirror.cjs` -- Tier 0 fallback when Aura unavailable; mirrors RS schema in room.db; same MERGE-equivalent semantics; INSERT OR REPLACE pattern
- `lib/core/rs-mind-map.cjs` -- 5-branch Cytoscape.js generator: Direct Intersections / Structural Transfer / Semantic Implementation / Discovered RS / Innovation Ecosystem; reads from Aura OR room.db; emits HTML+JSON for /mos:dashboard rendering
- `lib/core/rs-expert-mapper.cjs` -- Cypher MATCH against user's Aura for resolved authors + institutions + citations; consumes 89.2-05 mapExperts output; outputs author-network graph slice
- Enhance `lib/core/bridge-writer.cjs` (existing v1.10.16) -- inject thesis + breakthrough_score fields into bridge artifact frontmatter; preserve byte-for-byte compatibility with existing bridge consumers
- Tier 0 / Tier 1 dispatch: if Aura connected (per existing lazygraph-ops.cjs detection), use rs-neo4j-writer; else use rs-sqlite-mirror; user message states which tier is active
- Canon Part 7: extend EDGE_TYPES in lazygraph-ops.cjs with the 5 new edge types (DISCOVERED / DERIVED_FROM / ENABLES / AUTHORED_BY / AFFILIATED_WITH); do NOT fork lazygraph-ops
- Canon Part 8: NO new external egress (writer is local-only -- writes to user's own Aura/SQLite); auditQueryObject defense-in-depth on Cypher parameters before write to catch any leaked patterns; ExternalEgressViolation thrown if forbidden patterns found in node properties
- Three-surface compatibility (CLI + Desktop MCP + Cowork)
- Zero new runtime dependencies (Cytoscape via existing CDN dashboard pattern; Aura via existing lazygraph-ops); CJS only for new JS; BSL 1.1 header on all new source; zero em-dashes
- `canon_parts: [part-7, part-8]` + `bundled_release: true` frontmatter on every plan
- TDD discipline: every plan ships RED -> GREEN atomic commits; test files under lib/memory/; register every new test in lib/memory/run-feynman-tests.cjs (current Feynman baseline 77 post-89.2 -> ~82+ post-89.3)
**Success Criteria** (what must be TRUE):
  1. `rs-neo4j-writer.cjs` exports `writeDiscovery(scored_classified_pair, opts)` -- idempotent MERGE pattern; rollback Cypher captured
  2. `rs-sqlite-mirror.cjs` exports same `writeDiscovery` API surface against room.db; Tier 0 fallback proven
  3. `rs-mind-map.cjs` exports `renderMindMap(query_filter, opts)` -- 5-branch Cytoscape JSON; HTML wrapper for browser
  4. `rs-expert-mapper.cjs` exports `mapAuthorsToAura(experts, opts)` -- Cypher MATCH; returns resolved author-network graph slice
  5. `bridge-writer.cjs` enhanced -- thesis + breakthrough_score in artifact frontmatter; existing consumers unaffected (regression test)
  6. Tier 0 / Tier 1 dispatch verified -- mocked no-Aura scenario uses sqlite-mirror; mocked Aura-connected uses neo4j-writer
  7. lazygraph-ops.cjs EDGE_TYPES extended without forking; Canon Part 7 verified
  8. Feynman test suite stays green + new tests registered (baseline 77 -> 82+)
  9. NO release gate -- bundled into v1.11.0 final ship at Phase 91.x per milestone §7
**Plans**: 5 plans
- [x] 89.3-01-rs-neo4j-writer-PLAN.md -- Aura Cypher writer for canonical RS schema (RSDiscovery / ReverseSalient / Innovation / Paper / Author / Institution + 5 edges); idempotent MERGE + rollback Cypher capture; extends lazygraph-ops EDGE_TYPES in place (Canon Part 7); auditQueryObject defense-in-depth pre-write (Canon Part 8)
- [x] 89.3-02-rs-sqlite-mirror-PLAN.md -- Tier 0 SQLite writer with same writeDiscovery API surface as 89.3-01; INSERT OR REPLACE for idempotency; deterministic ids (sha256 of stable identity); rollback SQL capture; reuses lazygraph.openGraph
- [x] 89.3-03-rs-mind-map-PLAN.md -- 5-branch Cytoscape generator (Direct Intersections / Structural Transfer / Semantic Implementation / Discovered RS / Innovation Ecosystem); Tier 0/1 read paths; HTML wrapper using existing dashboard cytoscape@3.33.1 CDN (zero new deps)
- [x] 89.3-04-rs-expert-mapper-PLAN.md -- Cypher MATCH+MERGE resolver for 89.2-05 mapExperts output; Tier 1 full resolution; Tier 0 graceful degradation with friendly note (resolution_quality flag); 2-seam Canon Part 8 audit (pre-Cypher + pre-return)
- [x] 89.3-05-bridge-writer-and-phase-gate-PLAN.md -- bridge-writer enhancement (thesis + breakthrough_score frontmatter; backward-compat regression test) + Feynman registration sweep (5 new tests; baseline 77 -> 82) + Phase Gate transcript (9 G + 5 E asserts) + VERIFICATION.md (9 SCs)
**Authority**: .planning/milestones/v1.11.0-KICKOFF.md §5 (Output Layer module enumeration: rs-neo4j-writer + rs-sqlite-mirror + rs-mind-map + rs-expert-mapper); §9 (graceful degradation Tier 0 / Tier 1); .planning/phases/89.2-external-research-fetching/89.2-VERIFICATION.md (predecessor delivers the input pairs this phase persists)

### Phase 89.4: Chain Wiring (Upstream + Downstream)
**Goal**: Implement Chain Mechanism per kickoff §6 (USER's LOAD-BEARING INTENT 7). The RS Discovery Engine must be CHAIN-AWARE: it reads upstream framework outputs (systems-thinking / hsi_semantic_surprise_analysis / Cynefin) before running and emits downstream chain metadata (which canonical Part 3 verb the user can invoke next + which downstream framework FEEDS_INTO accepts the output + which skill gets spawned based on RS type + breakthrough score). Ships rs-chain-feeder.cjs that codifies engine choreography across the broader MindrianOS engine ecosystem (HSI Semantic Surprise / Navigation Engine 91 / future Scenario / Opportunity / Team-Assembly engines) by consulting Brain's FEEDS_INTO topology at each step. Enforces Canon Part 3 10-verb closed vocabulary on every recommended next-step action. Bundled into v1.11.0 final ship at Phase 91.x.
**Depends on**: Phase 89.2 (Phase 4 thesis output; chain emission), Phase 89.3 (Output Layer; chain metadata is persisted to graph alongside discovery); existing skills/bono-innovation + commands/think-hats.md (Engine 2 BONO Orchestration produces inputs to chain wiring); existing brain-client.cjs (queries Brain FEEDS_INTO topology); .planning/research/navigation-engine-brain-interface.md (frozen v1 contract from Phase 90 -- 89.4 chain emission must conform)
**Requirements**:
- `lib/core/rs-chain-feeder.cjs` -- engine-choreography codification module; reads Brain FEEDS_INTO topology via brain-client.queryTopology (or equivalent); recommends next legitimate engine hop based on RS type + breakthrough score + active context
- Upstream awareness: rs-discovery-engine consults `rs-chain-feeder.lookupUpstream(problem_type, stage)` BEFORE running; if upstream framework (systems-thinking / hsi_semantic_surprise_analysis / Cynefin) has fresh output -> consume it as pre-filter; if not fresh AND required -> pause + suggest user run upstream first via Canon Part 3 "Run Methodology" verb
- Downstream emission: every ReverseSalient output carries chain metadata block: `{recommended_verb (Canon Part 3 10-verb vocabulary), feeds_into (PWS VP / JTBD / Causal Loop / Navigation Engine), spawn_skill (per §6.4 rule table)}`
- Canon Part 3 10-verb closed vocabulary enforcement: rs-chain-feeder exports `validateVerb(verb_string)` that throws if not one of {Run Methodology / Reformulate / Spawn Sub-Agent / Navigate Graph / Devil's Advocate / Scenario Plan / Synthesize / Bank Opportunity / Defer / Free-Text}; new verbs require canon amendment
- Skill-spawn rule table per kickoff §6.4: high breakthrough + structural_transfer -> `/mos:find-analogies`; high breakthrough + market signal -> `/mos:lean-canvas`; cross-methodology discovery -> `/mos:pipeline`; expert network dense -> `/mos:persona`; low breakthrough + Cynefin complex -> `/mos:think-hats`. Skill spawning RECOMMENDED not forced; user always decides per Canon Part 3 Tri-Context Decision Gate
- Canon Part 8: NO new external egress (chain feeder is local; Brain queries via existing chokepoint pattern from 89.1a brain-substrate); auditQueryObject defense-in-depth on chain metadata before persistence
- Canon Part 7: REUSE existing brain-client.cjs query path (89.1a chokepoint); do NOT add new Brain query patterns
- Three-surface compatibility (CLI + Desktop MCP + Cowork)
- Zero new runtime dependencies; CJS only; BSL 1.1; zero em-dashes
- `canon_parts: [part-3, part-7, part-8]` + `bundled_release: true` frontmatter on every plan (Part 3 newly load-bearing here)
- TDD: RED -> GREEN; Feynman baseline ~82 (post-89.3) -> ~85+ post-89.4
**Success Criteria** (what must be TRUE):
  1. `rs-chain-feeder.cjs` exports `lookupUpstream(problem_type, stage)` -- returns required upstream frameworks with freshness check
  2. `rs-chain-feeder.cjs` exports `emitChainMetadata(rs_type, breakthrough_score, active_context)` -- returns canonical verb + feeds_into + spawn_skill block
  3. `rs-chain-feeder.cjs` exports `validateVerb(verb_string)` -- throws on unknown verb (Canon Part 3 closed vocabulary)
  4. Skill-spawn rule table from kickoff §6.4 implemented and tested -- 5 rules covered with at least one fixture per rule
  5. Brain FEEDS_INTO topology queries pass through existing brain-client chokepoint (no new Brain query surface; Canon Part 7 verified)
  6. Canon Part 8 audit: chain metadata never carries user content (auditQueryObject scan before any persistence)
  7. Feynman test suite stays green + new tests registered (~82 -> ~85+)
  8. NO release gate -- bundled into v1.11.0 final ship at Phase 91.x per milestone §7
**Plans**: 3-4 plans (to be filed by /gsd:plan-phase 89.4)
**Authority**: .planning/milestones/v1.11.0-KICKOFF.md §6 (Chain Mechanism Requirement -- USER LOAD-BEARING INTENT 7); §6.1 (Upstream Chain Awareness); §6.2 (Downstream Chain Emission); §6.3 (Context-Aware Engine Orchestration); §6.4 (Skill Spawning rule table); .planning/research/navigation-engine-brain-interface.md (frozen v1 contract from Phase 90 -- chain emission conforms to this); docs/MINDRIAN-CANON.md Part 3 (10-verb closed vocabulary)

### Phase 89.5: Engine Top-Level Orchestrator + Bidirectional NL-Graph Surface
**Goal**: The capstone of the Reverse Salient framework per kickoff §5 + §7. Ship `scripts/rs-discovery-engine.cjs` -- the top-level orchestrator that chains every RS phase end-to-end (Domain Analysis 89.1 -> Query Matrix 89.1 -> Fetchers 89.2 -> Preprocessor 89.2 -> Differential Scorer 89.2 -> Classifier 89.2 -> Breakthrough Scorer 89.2 -> Thesis Generator 89.2 -> Output Layer 89.3 -> Chain Feeder 89.4). Add the Bidirectional NL-Graph Surface: (a) Text->Query (NL -> Cypher/SQL -> 3-graph triangulation across room.db + LazyGraph Aura + Brain methodology with Canon Part 8 chokepoint preserving NEVER-user-data-to-Brain invariant), (b) Query->Text (raw graph results -> Larry-voiced NL explanation with pedagogical framing + venture context + cross-ref enrichment). Together this closes the bidirectional loop: user types question -> system queries graph -> raw results -> system explains in plain language. Raw data becomes insight. Ships user-facing CLI commands (/mos:rs-fetch, /mos:rs-thesis, /mos:rs-experts, /mos:rs-explain) that wrap the orchestrator. Bundled into v1.11.0 final ship at Phase 91.x.
**Depends on**: Phase 89.1 + 89.1a + 89.2 + 89.3 + 89.4 (orchestrator chains all of them); existing brain-client.cjs (Brain methodology queries via existing chokepoint); existing lazygraph-ops.cjs (room.db + Aura dual-backend); .planning/research/navigation-engine-brain-interface.md (frozen v1 contract from Phase 90)
**Requirements**:
- `scripts/rs-discovery-engine.cjs` -- top-level orchestrator; takes a topic + opts; chains all RS phases sequentially (or async-parallel where dependencies permit); emits final RSDiscovery output bundle with chain metadata (from 89.4) and persisted graph nodes (from 89.3); end-to-end smoke test under live conditions
- `lib/core/rs-commercial-assessor.cjs` (deferred from kickoff §5 Phase 4 to here per RESUME §What 89.2 Must Ship Deferred Items) -- market size + value prop + partnership targets; deterministic from breakthrough scorer + chain feeder outputs; NO runtime LLM
- Bidirectional NL-Graph Surface (a) Text->Query: `lib/core/rs-nl-to-query.cjs` -- NL -> Cypher/SQL translator; 3-graph triangulation (room.db local SQL + LazyGraph Aura local Cypher + Brain methodology read-only); Canon Part 8 chokepoint: ALL three graph queries pass through audit (Brain queries strip to allow-list scalars; room.db + Aura queries audit user-content patterns before execution to catch SQL/Cypher injection AND data exfiltration attempts)
- Bidirectional NL-Graph Surface (b) Query->Text: `lib/core/rs-query-to-text.cjs` -- raw graph results -> Larry-voiced NL explanation; consumes pedagogical framing patterns from skills/larry-personality + venture context from active room ROOM.md + cross-ref enrichment from per-folder memory quadruple (Phase 88 + Phase 90 BRAIN.md when present)
- User-facing CLI commands: `/mos:rs-fetch <topic>` (runs full pipeline) + `/mos:rs-thesis <discovery_id>` (gets thesis for prior discovery) + `/mos:rs-experts <topic>` (expert network query) + `/mos:rs-explain <NL_query>` (bidirectional NL-Graph entry point)
- Canon Part 8: Brain queries ALWAYS chokepoint-audited; user content NEVER reaches Brain in NL-to-Query translation; ExternalEgressViolation throws on any leak
- Canon Part 7: REUSE existing brain-client + lazygraph-ops + folder-memory + larry-personality patterns; do NOT fork
- Three-surface compatibility (CLI + Desktop MCP + Cowork) -- /mos:rs-* commands must work across all three surfaces
- Zero new runtime dependencies; CJS only; BSL 1.1; zero em-dashes
- `canon_parts: [part-3, part-7, part-8]` + `bundled_release: true` frontmatter on every plan
- TDD: RED -> GREEN; Feynman baseline ~85 (post-89.4) -> ~90+ post-89.5
**Success Criteria** (what must be TRUE):
  1. `scripts/rs-discovery-engine.cjs` exports `runDiscovery(topic, opts)` -- end-to-end pipeline; returns full RSDiscovery bundle
  2. `rs-commercial-assessor.cjs` exports `assess(rs_discovery, opts)` -- deterministic market + value-prop + partnership output
  3. `rs-nl-to-query.cjs` exports `translate(nl_query, opts)` -- returns {cypher, sql, brain_query} triangulated query bundle; Canon Part 8 audit on all 3 surfaces
  4. `rs-query-to-text.cjs` exports `explain(query_results, opts)` -- returns Larry-voiced NL explanation with pedagogical framing
  5. /mos:rs-fetch + /mos:rs-thesis + /mos:rs-experts + /mos:rs-explain commands shipped and three-surface compatible
  6. End-to-end smoke test under live conditions (Brain reachable + Aura optionally connected) -- full pipeline runs without error
  7. Canon Part 8 verified: Brain query audit on every Brain call from NL-to-Query; user content never crosses outbound boundary
  8. Feynman test suite stays green + new tests registered (~85 -> ~90+)
  9. NO release gate -- bundled into v1.11.0 final ship at Phase 91.x per milestone §7
**Plans**: 5 plans across 3 waves
  - [x] 89.5-01-PLAN.md -- rs-commercial-assessor.cjs (deterministic 3-field commercial layer; deferred from kickoff §5 Phase 4)
  - [x] 89.5-02-PLAN.md -- rs-nl-to-query.cjs (Bidirectional NL-Graph Text->Query; HARDEST Canon Part 8 surface in v1.11.0; >=6 adversarial fixtures)
  - [x] 89.5-03-PLAN.md -- rs-query-to-text.cjs (Bidirectional NL-Graph Query->Text; Larry-voiced explanation with frozen voice templates)
  - [x] 89.5-04-PLAN.md -- scripts/rs-discovery-engine.cjs (top-level orchestrator chaining all 89.1-89.5 modules; Tier 0/Mode B graceful)
  - [x] 89.5-05-PLAN.md -- 4 CLI commands (/mos:rs-fetch, /mos:rs-thesis, /mos:rs-experts, /mos:rs-explain) + Feynman registration (baseline 85 -> 90) + Phase Gate (9G + 5E asserts; CONDITIONAL PASS) + VERIFICATION (9/9 SCs passed)
**Authority**: .planning/milestones/v1.11.0-KICKOFF.md §5 (Engine Architecture top-level orchestrator); §7 (89.5 4-5 plans bundled with Bidirectional NL-Graph Surface load-bearing description); .planning/milestones/v1.12.0-LIVE-VALIDATION-2026-04-24.md §4 (bidirectional NL-graph context forward reference); .planning/research/navigation-engine-brain-interface.md (frozen v1 contract for Brain query shape consumption)

### Phase 89.6: v1.11.0-beta.1 Release Gate (RS Framework Beta)
**Goal**: Ship the complete v1.11.0 RS framework (89.1a + 89.1 + 89.2 + 89.3 + 89.4 + 89.5) as v1.11.0-beta.1 to opt-in testers. The RS framework is functionally complete after 89.5; this phase wraps it for tester consumption WITHOUT promoting to the stable channel. Per release-process.md beta-gating mandate, new product surface always ships as beta first; tester sign-off promotes to stable in Phase 91.5. Stable users (currently v1.10.19) NOT auto-updated -- they must explicitly opt in via `claude plugin update mos@mindrian-marketplace --version 1.11.0-beta.1`. Justin and Aryeh are the named first testers; their feedback shapes any patches before Phase 91 ships beta.2.
**Depends on**: Phase 89.5 (RS framework code-complete with 9/9 SCs verified; Phase Gate CONDITIONAL PASS); existing scripts/release.sh (or equivalent release tooling); existing marketplace.json
**Requirements**:
- 5-gate beta release with explicit -beta.1 suffix:
  1. CHANGELOG.md entry under `## [1.11.0-beta.1] - YYYY-MM-DD` documenting the RS framework feature set (89.1a substrate + 89.1 domain analysis + 89.2 fetchers/preprocessor/scoring/thesis + 89.3 Aura schema + 89.4 chain wiring + 89.5 NL-graph)
  2. plugin.json `"version": "1.11.0-beta.1"`
  3. package.json `"version": "1.11.0-beta.1"`
  4. Git tag `v1.11.0-beta.1` annotated with release notes pointing to CHANGELOG
  5. Marketplace `~/mindrian-marketplace/.claude-plugin/marketplace.json` `source.ref` updated to `v1.11.0-beta.1`
- Tester invitation document at .planning/release/v1.11.0-beta.1-TESTER-NOTES.md describing: opt-in command, 4 new CLI commands (/mos:rs-fetch, /mos:rs-thesis, /mos:rs-experts, /mos:rs-explain), known limitations (Navigation Engine not yet wired -- coming in beta.2), feedback channel
- Pre-release smoke test against the tagged commit: clone fresh into temp dir, install plugin from marketplace ref `v1.11.0-beta.1`, run /mos:rs-fetch on a sample topic in a sample room, verify Phase Gate-style transcript renders, verify zero release artifact regressions
- Stable channel preserved: any user NOT explicitly opting in stays on v1.10.19. Marketplace source.ref points at v1.11.0-beta.1 BUT the marketplace UI MUST show beta versions as opt-in only (per Claude Code marketplace beta-gating semantics)
- Three-surface compatibility (CLI + Desktop MCP + Cowork) -- the 4 new CLI commands MUST work uniformly
- `canon_parts: [part-7, part-8]` + `bundled_release: false` (this IS the release; not bundled)
**Success Criteria** (what must be TRUE):
  1. CHANGELOG.md has `## [1.11.0-beta.1] - YYYY-MM-DD` entry with RS framework summary
  2. plugin.json + package.json both at exactly `1.11.0-beta.1`
  3. Git tag `v1.11.0-beta.1` exists and points at the release commit
  4. Marketplace source.ref pinned to `v1.11.0-beta.1`
  5. Pre-release smoke test passes: fresh install via opt-in command resolves to v1.11.0-beta.1; /mos:rs-fetch runs end-to-end; Phase Gate transcript renders
  6. Stable users on v1.10.19 confirmed NOT auto-updated (auto-update channel test)
  7. TESTER-NOTES.md filed with opt-in command + feature summary + known limitations
**Plans**: 1 plan (release-gate-PLAN.md)
**Authority**: .planning/milestones/v1.11.0-KICKOFF.md §7 (bundled milestone); .claude/includes/release-process.md (5-gate release + beta-gating mandate); user release strategy filed 2026-04-27 in conversation transcript (after 89.5 -> beta.1; after 91 -> beta.2; after tester sign-off -> stable v1.11.0)

### Phase 90: Brain Derivation Layer
**Goal**: Let the Brain excavate the per-folder memory triple (Phase 88) and produce a persistent authored layer on top. Each section carries an optional BRAIN.md with Brain-authored pattern matches, cross-domain analogies, wicked indicators, unfilled opportunity matches, framework chain predictions, and cross-room contradiction flags. Derivation is persistent (git-trackable), versioned (governing_thought_hash invalidation), staleness-aware, offline-tolerant, query-optimized. Triple becomes quadruple. Moat becomes visible.
**Depends on**: Phase 88 (triple foundation), existing brain-connector skill (ambient enrichment to be extended not replaced), existing brain-client.cjs
**Requirements**: BRAIN.md schema with governing_thought_hash invalidation, derivation pipeline, `folder-memory.cjs` readQuadruple extension, /mos:brain-derive command, graceful offline degradation, room-scope respect (never cross GUARDRAIL.md boundaries)
**Success Criteria** (what must be TRUE):
  1. BRAIN.md per section is optional; absence is valid when Brain offline or irrelevant
  2. governing_thought_hash invalidates derivations automatically when MINTO changes
  3. Graceful degradation: Brain unavailable does not block session or crash system
  4. Brain derivations respect active room scope
  5. `folder-memory.cjs readQuadruple()` extends readTriple() additively; consumers can migrate incrementally
  6. Feynman tests stay green + new brain-derivation tests
  7. 5-gate release: CHANGELOG 1.10.15, plugin.json 1.10.15, package.json 1.10.15, git tag v1.10.15, marketplace pin
**Plans**: 10 plans across 5 waves (not yet filed)
**Authority**: .planning/phases/90-brain-derivation-layer/90-CONTEXT.md

### Phase 91: Navigation Engine
**Goal**: Ship the L5 Decision layer that picks which skill, command, or framework fires based on triangulated signals across ICM + SQL + Feynman-MINTO + BRAIN + live intent/persona. Today skill activation is primitive (file-state and env only). The engine makes activation context-aware, brain-aware, and reasoning-aware. Visible dial position, persistent Larry persona, and skill discoverability emerge as properties of correct engine selection rather than separate features. This is where the product thesis "speed up the eureka moment" becomes operational.
**Depends on**: Phase 88 (triple foundation + invariants), Phase 90 (Brain-authored layer), existing UserPromptSubmit hook, existing USER.md persona detection
**Requirements**: Five-signal triangulation function, decision_trace emitter, persona durability via USER.md (Explicit/Implicit schema aligned to Brain), /mos:explain-decision command, visible dial surface, problem-type-aware routing, framework chain composition feed
**Success Criteria** (what must be TRUE):
  1. Engine reads via folder-memory.cjs readQuadruple (never parses files directly)
  2. Every engine decision includes a trace of which signals contributed
  3. Engine respects active room scope (never fires skills from other rooms)
  4. Engine completes within UserPromptSubmit timeout (2s); never blocks user turn
  5. Graceful degradation: Brain layer absent falls back to triple-only decisions
  6. Persona durability: USER.md first-class; one taxonomy matched to Brain 2-persona schema
  7. /mos:explain-decision surfaces trace for any prior turn
  8. All prior phases' tests stay green
  9. 5-gate release: CHANGELOG 1.11.0, plugin.json 1.11.0, package.json 1.11.0, git tag v1.11.0, marketplace pin (MINOR version bump opens v1.11.x milestone line)
**Plans**: 11 plans across 5 waves
Plans:
- [x] 91-00-navigation-engine-core-PLAN.md -- lib/core/navigation-engine.cjs L5 Decision core with decide() + structured 5-signal triangulation + Section 4 staleness multipliers + Section 5 tier modes + Section 6 RECOMMENDED gate + Section 8 8-field trace contract (NAV-CORE-01..05)
- [x] 91-01-user-md-persona-durability-PLAN.md -- lib/core/user-md-ops.cjs + persona-taxonomy.cjs promoting persona to first-class USER.md artifact; Larry 3-persona -> Brain 2-persona translation; atomic write + update threshold (NAV-PERSONA-01..04)
- [x] 91-02-userpromptsubmit-integration-PLAN.md -- scripts/intent-classifier.cjs calls engine per turn with 1200ms hard timeout; decision_trace persistence to .mindrian/decision-traces/<session>.json with 50-entry rotation (NAV-INTEGRATION-01..03)
- [x] 91-03-skill-activation-routing-PLAN.md -- lib/core/skill-activation-router.cjs precedence layer; Canon Part 3 10-verb vocabulary enforced; engine precedence when opinionated, legacy fallback when silent (NAV-ROUTING-01..03)
- [x] 91-04-next-step-offer-presentation-PLAN.md -- lib/core/offer-presenter.cjs with grounding rule + Section 6 RECOMMENDED marker respected + max-1-per-turn + 2-ignore suppression + offer-history persistence (NAV-OFFER-01..03)
- [x] 91-05-mos-explain-decision-command-PLAN.md -- commands/explain-decision.md + scripts/explain-decision-command.cjs rendering full trace per turn; --last N + --session flags; graceful fallback (NAV-EXPLAIN-01..03)
- [x] 91-06-statusline-dial-PLAN.md -- lib/core/nav-dial.cjs + scripts/context-monitor segment; Larry dial Investigate | Blend | Insight driven by engine state; Plan 88.1-04 cache pattern reused (NAV-DIAL-01..03)
- [x] 91-07-problem-type-routing-PLAN.md -- lib/core/problem-type-router.cjs UDP/IDP/WDP/Wicked routing from BRAIN.md problemtype_classification; Canon Appendix E R4 wicked escalation; brain-client.isAvailable() scalar upgrade (NAV-PROBLEM-TYPE-01..04)
- [x] 91-08-framework-chain-composition-PLAN.md -- lib/core/framework-chain-composer.cjs FEEDS_INTO chain proposal from BRAIN.md framework_chain_predictions; user override recorded as graph data (NAV-CHAIN-01..04)
- [x] 91-09-nav-invariants-validator-PLAN.md -- lib/memory/validators/navigation-invariants.cjs drop-in registry validator; 5 invariants (trace completeness, RECOMMENDED mode gate, weight clamp, malformed trace, unknown verb); scope=room (NAV-INVARIANTS-01..03)
- [ ] 91-10-v1.11.0-beta.2-release-gate-PLAN.md -- 5-gate beta release (CHANGELOG entry with -beta.2 suffix + plugin.json 1.11.0-beta.2 + package.json 1.11.0-beta.2 + git tag v1.11.0-beta.2 + marketplace ref pin to v1.11.0-beta.2); per beta-gating mandate stable users on v1.10.19 NOT auto-updated; testers opt-in via `--version 1.11.0-beta.2`; promotion to stable v1.11.0 happens in Phase 91.5 after tester sign-off (NAV-RELEASE-01, NAV-RELEASE-GATES-01)
**Authority**: .planning/phases/91-navigation-engine/91-CONTEXT.md

### Phase 91.5: v1.11.0 Stable Promotion
**Goal**: After Phase 91 ships v1.11.0-beta.2 AND testers (Justin/Aryeh + wider opt-in pool) confirm zero regressions through a 3-5 day soak period, promote v1.11.0-beta.2 to stable v1.11.0. Tiny phase but real -- it requires its own commit + tag + marketplace re-pin so the auto-update channel users get the stable release, and so users currently on `--version 1.11.0-beta.2` continue to work without changes (no breaking diff between beta.2 and stable; only the suffix is removed). Per release-process.md "Pre-release versions for beta testing" + "How Users Actually Receive Updates", this is the canonical promote-to-stable workflow.
**Depends on**: Phase 91 (v1.11.0-beta.2 shipped at Plan 91-10); tester sign-off (3-5 day soak documented in TESTER-NOTES); zero regressions reported by testers
**Requirements**:
- Pre-promotion check: read tester feedback channel (Slack / Discord / GitHub issues channel per TESTER-NOTES); document any issues raised + resolutions in PROMOTE-NOTES.md
- 5-gate stable release with NO beta suffix:
  1. CHANGELOG.md entry under `## [1.11.0] - YYYY-MM-DD` consolidating beta.1 + beta.2 entries; note "Promoted from v1.11.0-beta.2 after tester sign-off (3-5 day soak; zero regressions)"
  2. plugin.json `"version": "1.11.0"` (drops -beta.2 suffix)
  3. package.json `"version": "1.11.0"` (drops -beta.2 suffix)
  4. Git tag `v1.11.0` annotated with release notes
  5. Marketplace `source.ref` updated from `v1.11.0-beta.2` to `v1.11.0`
- Verify NO breaking diff between beta.2 and stable: code at v1.11.0 stable should be byte-identical to v1.11.0-beta.2 except for the version-suffix changes in CHANGELOG/plugin.json/package.json
- Auto-update channel test: users on stable channel should now see v1.11.0 available; users on `--version 1.11.0-beta.2` should continue working (the marketplace shouldn't disrupt explicit version pins)
- `canon_parts: [part-7]` (reuse-only; no new code) + `bundled_release: false` (this IS the stable release)
**Success Criteria** (what must be TRUE):
  1. CHANGELOG.md has `## [1.11.0] - YYYY-MM-DD` consolidating both betas
  2. plugin.json + package.json at exactly `1.11.0` (no suffix)
  3. Git tag `v1.11.0` exists at the promotion commit
  4. Marketplace source.ref pinned to `v1.11.0`
  5. PROMOTE-NOTES.md documents tester feedback resolution + soak duration
  6. Auto-update channel users confirmed receiving v1.11.0 (smoke test on a fresh install)
  7. Existing beta.2 testers confirmed unaffected (their `--version 1.11.0-beta.2` pin still resolves)
**Plans**: 1 plan (stable-promotion-PLAN.md)
**Authority**: .claude/includes/release-process.md (5-gate release + beta promotion section); user release strategy filed 2026-04-27 (after 91 -> beta.2; after tester sign-off -> stable v1.11.0); .planning/release/v1.11.0-beta.1-TESTER-NOTES.md (Phase 89.6 deliverable; informs feedback channel for this promotion)

## Planned Pipeline (post v1.10.11) -- organized 2026-04-19

Source: `.planning/research/ui-ux-pathways/` (migrated 2026-04-18) + 2026-04-19 architecture conversation (five-layer stack + per-folder memory quadruple).

### Five-Layer Architecture (authoritative)

```
L1 Identity  : ROOM.md per folder (ICM Layer 0)
L2 Memory    : Per-folder quadruple + room.db SQL edges
                - ROOM.md       (identity + compiled references)
                - STATE.md      (quantitative state)
                - Feynman-MINTO (compressed logical flow, <1500 tokens/section)
                - BRAIN.md      (Brain-authored derivation layer on top)
L3 Navigation: SQL edges + Feynman-MINTO + BRAIN patterns = pathfinding substrate
L4 Assets    : wiki, dashboard, deck, exports (rendered views of L3)
L5 Decision  : Navigation Engine reads L3 to pick skill/command/framework
```

### Phase Sequence (locked 2026-04-19)

| Phase | Name | Release | Layer | Status |
|---|---|---|---|---|
| **87** | Security + Cascade Refactor + Localhost Dashboard | v1.10.11 + v1.10.12 | infra + L4 | SHIPPED 2026-04-19 |
| **88** | Per-Folder Memory Triple Wiring | v1.10.13 | L2 foundation | EXECUTING (8/16 plans; 88-00-B, 88-00, 88-01, 88-02, 88-03, 88-04-B, 88-04, 88-05 shipped) |
| **88.6** | Python Algorithm Wiring (URGENT) | v1.10.14 | orchestration | 4 plans filed 2026-04-23 |
| **88.1** | UI/UX Polish + MINTO Surface Plumbing | v1.10.14 | L4 surfaces + hygiene | CONTEXT filed 2026-04-20 |
| **89** | Reverse-Salient Engine | v1.10.x | L5 support (local) | 7 plans existing |
| **90** | Brain Derivation Layer | v1.10.17 | L2 Brain-on-top | EXECUTING (3/11 plans; 90-00, 90-01, 90-02 shipped) |
| **91** | Navigation Engine | v1.11.0 | L5 Decision | CONTEXT filed |
| **92** | Discord/Zulip multi-surface (candidate) | v1.11.x | L4 surface | research only |
| **93** | Goose extension (candidate) | v1.11.x | L4 surface | research only |

### Dependency Graph

```
                +- Phase 87 (security + dashboard) ---+
                |                                     |
                +-> Phase 88 (memory triple) ---------+
                                      |                |
                                      +-> Phase 88.6 (python wiring, orchestration-only)
                                      |                |
                                      +-> Phase 89 (reverse-salient, optional consumer)
                                      |                |
                                      +-> Phase 90 (Brain derivation) --+
                                                                        |
                                                                        +-> Phase 91 (Navigation Engine)
                                                                                      |
                                                                                      +-> Phase 92/93 (multi-surface)
```

Phase 91 is the destination. Phases 87, 88, 90 are prerequisites. Phase 88.6 is orchestration-only and ships as v1.10.14 between Phase 88 and Phase 88.1. Phase 89 is parallel (can ship before, during, or after Brain layer).

### Phase Summaries

**Phase 87 -- Security + Cascade Refactor + Localhost Dashboard** (v1.10.11 + v1.10.12)
Stream A security (Cypher sanitization, API key perms, HSI timeout, write-lock atomic) + Stream C localhost dashboard ship as v1.10.11 (investor-safe demo-ready). Stream B refactor (cascade dedup, async split via two entry points, MCP validation, transactions, Brain cache, LRU) + BYO API chat panel with Bearer token auth ship as v1.10.12. Audit R1-R7 folded, split locked. See 87-CONTEXT.md.

**Phase 88 -- Per-Folder Memory Triple Wiring** (v1.10.13)
Wires ROOM.md + STATE.md + Feynman-MINTO.md as a coordinated cross-session memory triple. Five wires (post-write freshness, on-stop snapshot, session-start injection, pre/post-compact resilience, decision_log persistence) + unified read contract `lib/core/folder-memory.cjs` + invariants module (`lib/core/feynman-minto-invariants.cjs`) + guardian for lifecycle enforcement. 16 plans across 6 waves. EXECUTING -- 8/16 plans shipped (88-00-B, 88-00, 88-01, 88-02, 88-03, 88-04-B, 88-04, 88-05); 8 remaining. Prerequisite for Brain Derivation Layer and Navigation Engine. See 88-CONTEXT.md.

**Phase 88.6 -- Python Algorithm Wiring** (v1.10.14)
Orchestration-only phase closing the orphan-value gap surfaced by the 2026-04-23 Rubos meeting audit. Plan 01: shared baseline auto-fire helper fixing the silent-zero bug in discover-* pipelines. Plan 02: /mos:diagnostics command exposing 4 Wave-1 algorithms (Funk and Owen-Smith Disruption Index, Good-Turing Blindspot Mass Coverage, Element Novelty, Bayesian Surprise) with interpretation strings. Plan 03: rate-limit-aware external whitespace orchestration + v1.10.14 5-gate release. Zero new algorithms; every change is wiring, graceful degradation, or interpretation strings. Empirical basis: CD = -0.7092, coverage = 0.667, novelty mean = 0.083 on mindrianOS room. See 88.6-CONTEXT.md.

**Phase 88.1 -- UI/UX Polish + MINTO Surface Plumbing** (v1.10.14)
Closes the gap between what ships (66 commands, 8 agents, 20+ skills, 9 hooks, 1 statusline) and the Claude Code 2.1.x UX reference bar. Three workstreams: (A) MINTO surface plumbing -- statusline segment, /mos:status summaries, SessionStart banner all consume Phase 88's wired memory triple via governing_thought. (B) Description-driven UX -- slash command frontmatter hygiene sweep across 66 commands, README permissions.allow block, subagent PROACTIVELY audit. (C) Hook output primitives -- systemMessage retrofit on 9 existing hooks plus two new hooks borrowed from arscontexta (frontmatter schema validation, async artifact auto-commit inside .room-root subtrees). 10 plans across 4 waves, ~3-4 days. Wave 1+2 can ship as v1.10.13.1 hotfix if Phase 88 slips. Deferred: output styles (GSD-skip rationale), conversational onboarding redesign (milestone-sized), meta-ask skill (standalone feature), monitors/OSC progress bars (niche). See 88.1-CONTEXT.md.

**Phase 89 -- Reverse-Salient Engine** (v1.10.x)
7 plans on disk (pre-existing). Hughes 1983 reverse-salient detection for the lagging component in an expanding venture. Can optionally consume reasoning_health_score from Phase 88 folder-memory signal. Ships independently; not blocking other phases.

**Phase 90 -- Brain Derivation Layer** (v1.10.14)
Lets the Brain excavate the local triple (Phase 88) and produce a persistent authored layer on top: BRAIN.md per section containing pattern matches, cross-domain analogies, wicked indicators, unfilled opportunity matches, framework chain predictions, ProblemType classification, cross-room contradiction flags. Extends memory triple to quadruple. Graceful degradation when Brain offline. 10 plans across 5 waves. Prerequisite for Navigation Engine. See 90-CONTEXT.md.

**Phase 91 -- Navigation Engine** (v1.11.0, minor version bump)
Reads L3 Navigation substrate (SQL + quadruple memory) to decide which skill, command, or framework fires each turn. Five-signal triangulation: ICM + SQL + Feynman-MINTO + BRAIN + intent/persona. Persona durability (USER.md first-class). Visible dial in statusline. /mos:explain-decision command. Problem-type-aware routing. FEEDS_INTO framework chain composition. 10 plans across 5 waves. See 91-CONTEXT.md.

**Phase 92 -- Discord/Zulip multi-surface** (candidate, v1.11.x)
Same localhost API (Phase 87-08) surfaces the plugin to chat platforms. Teams collaborate where they already work. See `byo-api-and-surfaces.md`.

**Phase 93 -- Goose extension** (candidate, v1.11.x)
MindrianOS MCP server plugs into Block's Goose as an extension. Goose provides the visual conversation shell; MindrianOS provides the methodology intelligence. See `goose-extension-path.md`.

### Supporting Research (research-only, not phase-bound)

- `.planning/research/ui-ux-pathways/architecture-vision.md` -- bidirectional control surface
- `.planning/research/ui-ux-pathways/alternatives-considered.md` -- Quarto/Electron/Chrome ext/Tauri/PWA ranked
- `.planning/research/ui-ux-pathways/lazygraph-chat-architecture.md` -- 57x SQL-targeted chat pattern
- `.planning/research/ui-ux-pathways/token-economics.md` -- zero-token rendering math
- `.planning/research/ui-ux-pathways/ttfv-reverse-salient.md` -- "verbal fails, live demos convert"
- `.planning/research/ui-ux-pathways/byo-api-and-surfaces.md` -- API surface design
- `.planning/research/navigation-engine-brain-interface.md` (to be filed by Phase 90-09)

## Progress

**Execution Order:**
Phases execute in numeric order: 76 -> 77 -> 78 -> 79 -> 80

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 76. Wikilink Engine + Branded Footers | 0/3 | Complete    | 2026-04-12 |
| 77. Obsidian Kit + Welcome Doc | 0/TBD | Complete    | 2026-04-12 |
| 78. /mos:vault Command + /mos:room linkify | 0/2 | Complete    | 2026-04-12 |
| 79. Native Filing Wikilinks | 2/2 | Complete    | 2026-04-13 |
| 80. Vault Import -- Obsidian to Data Room | 6/6 | Complete   | 2026-04-13 |

### Phase 92: Refactor constitution and trust layer -- formalizes audit-driven refactor work (Constitution v1.1, Directive 1 validation, Directive 2 consolidation, Directive 3 unidirectional flow + Trust Layer)

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 91
**Plans:** 1/1 plans complete

Plans:
- [ ] TBD (run /gsd:plan-phase 92 to break down)

### Phase 93: v1.11.1 Hotfix: Install Cache Drift Recovery + Brain Telemetry Visibility

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 92
**Plans:** 1/1 plans complete

Plans:
- [x] TBD (run /gsd:plan-phase 93 to break down) (completed 2026-05-01)

### Phase 94: v1.11.2 Tester-Driven Fixer (QA-Rescoped 2026-04-28T19:50Z)

**Goal:** Ship v1.11.2 as a true hotfix release addressing 4 P0 ship-blockers caught by the automated QA harness running against shipped v1.11.0, plus Lawrence's loudest UX bugs, plus 3 P1 quick wins. Source-of-truth bug list at `~/mos-qa-quantum-v1.11.0/V1.11.2-HOTFIX-HANDOFF.md` (625 lines, 29 KB). Original 13-plan scope archived at `.archive-pre-qa-rescope/`.

**Requirements**:
- 10 plans (1 SHIPPED, 6 P0, 3 P1, 1 release gate)
- 4 P0 ship-blockers: rs-fetch thesis-merge handoff bug; Brain MCP-server name resolution; bundled mcp-server-brain missing deps; MCP-stack WebSearch fallback chain
- 1 P0 Lawrence UX: room classifier strict-mode (statusline already shipped via 94-01)
- 3 P1 quick wins: em-dashes in commands/wiki.md; U+2717 cross-mark in commands/admin.md + help.md; /mos:explain-decision missing action footer
- 5-gate release with CHANGELOG narrative leading with "ship-blockers caught by automated QA harness"
- Verification step pattern added to release docs: `jq -r .version ~/.claude/plugins/mindrian-os/.claude-plugin/plugin.json` expected `1.11.2`
- Canon Part 8 boundary preserved (no Brain query surface change; only MCP server-name standardization)
- Three-surface compatibility (CLI + Desktop MCP + Cowork)

**Depends on:** Phase 91 (Navigation Engine shipped); Phase 89.5 (rs-discovery-engine producer-side); Phase 89.2 (4 fetcher modules); existing brain-client.cjs chokepoint; existing 5-gate release pipeline; QA handoff brief.

**Source signals:**
- QA handoff brief 2026-04-28T19:35Z (~/mos-qa-quantum-v1.11.0/V1.11.2-HOTFIX-HANDOFF.md) -- FIX-1, FIX-2, FIX-3, FIX-4, FIX-5, FIX-7, FIX-8 (also FIX-9, 10, 11 deferred to v1.11.3)
- Lawrence Aronhime live test transcript 2026-04-28 -- statusline (94-01 DONE), classifier (94-06 pending)
- Jonathan install-cache drift incident -- routed to v1.11.3 /mos:doctor scope (extended from prior phase work)

**Plans (target, 10 total):**
- [x] 94-01-statusline-active-room-fix (P0 Lawrence UX) -- SHIPPED on main: commits 567fea8 RED, 93f1cfa GREEN, 906fb18 wire, 18e1751 async parity
- [x] 94-02-rs-fetch-thesis-merge-fix (P0 ship-blocker, was FIX-1)
- [x] 94-03-brain-mcp-server-resolution (P0 ship-blocker, was FIX-2)
- [x] 94-04-mcp-server-brain-deps (P0 ship-blocker, was FIX-3)
- [x] 94-05-mcp-stack-fallback-chain (P0 ship-blocker, was FIX-4)
- [x] 94-06-room-classifier-strict-mode (P0 Lawrence UX)
- [x] 94-07-em-dashes-wiki-md (P1 quick win, was FIX-5)
- [x] 94-08-u2717-cross-mark-replacement (P1 quick win, was FIX-7)
- [x] 94-09-explain-decision-action-footer (P1 quick win, was FIX-8)
- [ ] 94-10-v1.11.2-release-gate (release)

**Deferred to v1.11.3:** body_shape compliance sweep (FIX-6); chain-feeder Mode A guard (FIX-9); NL-to-query intent broaden (FIX-10); migration script disambiguation; macOS hardcoded path audit; FEEDS_INTO vs IS_PART_OF schema; verification docs; Anthropic upstream bug report.

**Deferred to v1.12.0:** 5 new methodology commands (white-space-mapping, market-positioning, innovation-of-meaning, leveraging-resources, four-actions-framework); persona-aware Pre-Mortem; find-analogies script entry point (FIX-11); tester follow-up nudge automation; multi-room canonical context pattern doc.

### Phase 94.1: v1-11-1-mos-heal-command (SHIPPED)

**Goal:** Ship /mos:heal slash command + scripts/heal-command.cjs orchestrator wrapping the 10-step room wiring heal recipe (dog-fooded on mindrianOS room 2026-04-29)
**Requirements**: None (closing artifact for v1.11.1 GA)
**Depends on:** Phase 94
**Plans:** 1/1 plans complete

Plans:
- [x] 94.1-01 mos-heal-command (commits 9585db4 RED, 3934198 GREEN orchestrator, c2d2c97 slash command, d22dc6a install doc, SUMMARY)

**Outcome:** /mos:heal ships as v1.11.1 GA closing artifact. 10-step orchestrator wraps 4 shipped scripts (migrate-lazygraph, vault-section-state-generator, vault-section-minto-generator, compute-state) per Canon Part 7 reuse-before-build. heal-log.json envelope captures cascade as graph data per Canon Part 4. LOCAL-only operation per Canon Part 8 (brain-derivation-queue read-only; drain deferred to v1.12). 6/6 fixture tests green; Feynman runner advanced 106 -> 107. Three v1.12 candidates filed in deferred-items.md with explicit re-trigger conditions (BUG-1 FEYNMINTO budget; BUG-2 brain-queue drain; BUG-5 auto-section-scaffold).

### Phase 95: Bash Hook Envelope Hygiene + Cascade Side-Channel (PLANNED 2026-04-29)

**Goal:** Fix bash `scripts/post-write` PostToolUse envelope to be schema-valid; relocate cascade payload to a LOCAL side-channel file at `<roomDir>/.mindrian/last-cascade.json`; restore the silently-broken-since-Phase-88.1-03 mid-session intelligence injection feature in `skills/room-proactive/SKILL.md`; audit and fix the 6 other schema-violating bash hooks (pre-compact, post-compact, on-file-changed, on-cwd-changed, on-agent-complete, on-task-complete) found by the 95-01 audit; extend `tests/test-hook-envelope-shape.cjs` to fence all bash hook stdout shapes per lifecycle event; ship as v1.12.0 (the SKILL.md restoration is a Changed feature, not just Fixed).

**Requirements:** [BASH-95-01, BASH-95-02, BASH-95-03, BASH-95-04, BASH-95-05, BASH-95-06, BASH-95-07]

**Depends on:** Phase 94 (v1.11.2 release - shipped 2026-04-29; Phase 95 is the FIRST work after v1.11.2 lands per decision-phase-95-sequencing.md).

**Source signals:**
- Original symptom: `PostToolUse:Write hook error - Hook JSON output validation failed - (root): Invalid input` reported 2026-04-29.
- Investigation: `.planning/debug/post-write-hook-envelope-invalid-input.md`.
- v1.11.2 patched the two `.cjs` PostToolUse hooks (Phase 94). The bash hook + cascade side-channel were intentionally deferred to keep that release tight.
- 95-RESEARCH.md Section 4 audit pre-found 6 additional schema-violating bash hooks beyond `post-write`.

**Plans (target, 5 total):**
- [x] 95-01-bash-hook-envelope-audit-report (audit; produces 95-01-AUDIT.md)
- [x] 95-02-post-write-side-channel-writer (post-write fix + atomic side-channel writer)
- [x] 95-03-room-proactive-skill-cascade-restoration (SKILL.md contract update; cool-UI cascade render)
- [x] 95-04-bash-hooks-envelope-fix-batch (apply audit findings to 6 schema-violating hooks; spot-audit 2 .cjs wrappers; extend regression test)
- [x] 95-05-regression-test-extension-and-release-gate (full suite + 5-gate release v1.12.0)

**Acceptance criteria** (from 95-CONTEXT.md):
- A1: Bash post-write emits schema-valid envelope.
- A2: `<roomDir>/.mindrian/last-cascade.json` written atomically on every cascade.
- A3: SKILL.md reads side-channel; mid-session intelligence injection observable.
- A4: All 9 other bash hooks audited; envelope bugs fixed in this phase (no split to 95.2).
- A5: Regression test fences all bash hook stdout shapes per-event.
- A6: CHANGELOG entries (Fixed for envelope hygiene + Changed for restored room-proactive feature).
- A7: Version bump 1.11.2 -> 1.12.0.

**Outcome:** Phase 95 ships as v1.12.0 (2026-04-29). 7 bash hooks envelope-clean against Claude Code 2.x schema. `<roomDir>/.mindrian/last-cascade.json` and `<roomDir>/.mindrian/last-post-compact.md` side-channel files installed (LOCAL only per Canon Part 8). `room-proactive` skill restored to functional state for the first time since Phase 88.1-03 shipped (Plan 95-03). Three regression tests fence the bash hook envelope shapes + side-channel atomic write + SKILL.md contract (27/27 envelope scenarios GREEN: 16 + 5 + 6). Cursor-branch divergence intentionally preserved per `.planning/phases/95-bash-hook-envelope-and-cascade-side-channel/95-01-AUDIT.md`. PostCompact context-preservation half-wired (writer landed; consumer queued for Phase 95.5/96 per release-process.md transparency).


### Phase 95.1: mos:doctor drift detection and self-heal (INSERTED)

**Goal:** Extend Phase 93's `/mos:doctor` (currently class A only) with detectors for 5 silent-failure drift classes (B/C/D/E/F) surfaced by v1.12.0 fresh-session smoke. Build the missing `scripts/generate-section-intelligence.cjs` generator. Retrofit `/mos:doctor` itself for UI Ruling System compliance. Use the dogfood `room/` subtree as integration test fixture. Ship as v1.12.1-beta.1.
**Requirements**: DOCTOR-95.1-01, DOCTOR-95.1-02, DOCTOR-95.1-03, DOCTOR-95.1-04, DOCTOR-95.1-05, DOCTOR-95.1-06, DOCTOR-95.1-07, DOCTOR-95.1-08
**Depends on:** Phase 95
**Plans:** 9/9 plans complete

Plans:
- [x] 95.1-00-PLAN.md — Add DOCTOR-95.1-01..08 requirements to REQUIREMENTS.md (Wave 0 foundation)
- [x] 95.1-01-PLAN.md — Seed test/fixtures/cascade-surface-e2e/ sibling fixture (Wave 0 fixture)
- [x] 95.1-02-PLAN.md — Write 7 RED test skeletons + register in run-feynman-tests.cjs (Wave 0 tests)
- [x] 95.1-03-PLAN.md — Build scripts/generate-section-intelligence.cjs (Wave 1 generator)
- [x] 95.1-04-PLAN.md — Retrofit scripts/doctor.cjs renderHumanReport + commands/doctor.md to Shape E + 12-glyph compliance (Wave 1 renderer; runs BEFORE class F detector per Pitfall 3)
- [x] 95.1-05-PLAN.md — Implement class B/C cascade-rooms detector + class E room-md detector + class D stub (Wave 1 detectors)
- [x] 95.1-06-PLAN.md — Implement class F UI compliance detector (Wave 1 — runs AFTER renderer retrofit)
- [x] 95.1-07-PLAN.md — Dogfood room cleanup + .room-root + generator run (atomic) + class D stub upgrade to live runner (Wave 2 integration)
- [ ] 95.1-08-PLAN.md — v1.12.1-beta.1 release: CHANGELOG + plugin.json + package.json + git tag + Anthropic upstream bug report draft (Wave 2 release)


### Phase 104: Per-Command JTBD Declarations

**Goal:** Sweep edit across all 84 files in `commands/*.md` adding `serves_jtbd:` to YAML frontmatter so the Phase 101-04 selector-dispatcher (already shipped, already reading JTBD) gets a real signal from every command file. Phase 104 is mostly a declaration sweep + verification harness, not new code: NO new commands ship, NO dispatcher logic changes, NO taxonomy changes. Backward compat invariant: commands without `serves_jtbd:` continue to work (selector falls through to F.1). Plan 104-01 encodes the verbatim JTBD-to-command mapping table; Plan 104-02 ships the every-command-declares + every-JTBD-has-1-command verification tests; Plan 104-03 ships the backward-compat regression fence and updates CHANGELOG for v1.12.4.

**Requirements**: JTBDCONS-104-01, JTBDCONS-104-02, JTBDCONS-104-03, JTBDCONS-104-04, JTBDCONS-104-05

**Depends on:** Phase 100 (jtbd-taxonomy.json - 13 canonical JTBD ids; declarations must match these) + Phase 101 (selector-dispatcher.cjs - already routes by JTBD; Phase 104 just feeds it).

**Plans:** 3/4 plans complete

Plans:
- [ ] 104-00-PLAN.md - Add JTBDCONS-104-01..05 requirements + Wave-0 test stubs (Wave 0 foundation)
- [ ] 104-01-PLAN.md - Sweep edit: add `serves_jtbd:` to all 84 commands per the verbatim mapping table (Wave 1)
- [ ] 104-02-PLAN.md - Verification harness: every-command-declares + every-JTBD-has-1-command tests (Wave 2 - depends on 104-01)
- [ ] 104-03-PLAN.md - Backward-compat regression fence + CHANGELOG v1.12.4 entry (Wave 2 - depends on 104-01)


### Phase 106: Statusline Visibility + Context-Window Broadcast

**Goal:** Make the MindrianOS statusline the persistent visibility surface testers can rely on. Self-heal `settings.json` `statusLine` path drift on session start (D-01); broadcast token-budget percent + active operator + active JTBD into the rendered statusline (D-02); detect when the statusline is silently invisible and surface a one-time repair banner via `/mos:doctor` drift class G (D-03); fall back to a Larry-rendered prose state echo when the statusline primitive cannot fire -- Desktop, Cowork, or post-detect repair window (D-04); validate visibility at first session post-install through tester onboarding (D-05); and route per-surface (CLI rich line / Desktop response footer / Cowork shared widget -- Cowork details deferred) (D-06). Ship as v1.12.5. Backward compat invariant: existing v1.12.x statusline behavior preserved when token-broadcast feature flag is off; auto-heal is additive and never overwrites a hand-edited `settings.json` without confirmation.

**Requirements**: STATUS-106-01, STATUS-106-02, STATUS-106-03, STATUS-106-04, STATUS-106-05, STATUS-106-06

**Depends on:** Phase 95.1 (`/mos:doctor` drift detector framework -- D-03 extends it with class G). Reuses already-shipped substrate from Phase 83 (`scripts/statusline-mos`), Phase 99 (`lib/conversation/operator.cjs`), Phase 100 (`lib/hmi/jtbd-state.cjs`), and the `lib/hmi/tier-check.cjs` module (Mode A/B/Tier 0 -- for color-threshold gating per UI Ruling System 5-color contract).

**Canon parts:** Part 3 (statusline is a LOCAL-context surface for the Decision Gate), Part 6 (dog-fooding -- testers reported 2026-05-02 they can't see MindrianOS while it eats their context), Part 8 (telemetry must stay LOCAL: JSONL with sha256-hashed room slug, never raw content).

**Plans:** 6/6 plans complete — Phase 106 SHIPPED as v1.12.5 (2026-05-03)

Plans:
- [x] 106-00-PLAN.md — Wave 0 scaffold (REQ IDs + test stubs + fixture directories + ROADMAP plans list)
- [x] 106-01-PLAN.md — D-01 self-healing settings via SessionStart hook (productionize migrate-stale-user-settings.cjs)
- [x] 106-02-PLAN.md — D-02 context-monitor token-budget + operator + JTBD broadcast glyphs
- [x] 106-03-PLAN.md — D-03 doctor.cjs class G invisibility detection + one-time banner + --fix dispatch
- [x] 106-04-PLAN.md — D-04 fallback echo + D-06 surface-detect helper (CLI / Desktop / Cowork heuristics)
- [x] 106-05-PLAN.md — D-05 tester onboarding gate + v1.12.5 release gate (CHANGELOG + plugin.json + package.json + git tag + marketplace ref) ✓ SHIPPED


### Phases 108–113: Graph Memory Cluster — Cross-Cutting Note

**Opportunity Bank is the key reference point across all five phases** (per user directive 2026-05-03). The Bank (Canon Part 2 Engine 1; `lib/core/opportunity-ops.cjs` + `opportunity-extractor.cjs`; HSI-scored, domain-tagged, REACT/REFLECT/ADD interactions, always-ambient, LOCAL-only per Canon Part 8) threads through every phase: 108 formalizes `opportunity` as a first-class node + `BANKED_BY` / `RANKS_OPPORTUNITY` / `ANSWERS_OPPORTUNITY` edges; 109 ships `findRelevantOpportunities` as a navigation primitive AND surfaces `banked_opportunities` in every Brain Packet; 110 includes `opportunity_react` / `opportunity_reflect` / `opportunity_rank` Brain jobs and treats banked opportunities as ambient context in every packet; 112 boosts opportunity nodes in PPR + RRF when JTBD matches their domain tags + treats opportunity coherence as a Room Budding signal; 113 ports the Bank for free with the SQLite-WASM port and makes Canon Part 2 "always ambient" + Canon Part 8 "LOCAL-only" *trivially* true in the browser.

The cluster's governing constraint (Codex 2026-05-03): **"Mindrian should remain a venture reasoning graph, not a generic document graph."** Pinned forever at the top of Phase 112.

---

### Phase 108: Graph Memory Schema Reconciliation (REGISTERED 2026-05-03)

**Goal:** Prevent schema drift before Phase 109 ships the SQL navigation spine. Reconcile the Codex-proposed claim/assumption/evidence/decision/open-question taxonomy against existing Mindrian edge/node reality — including the FULL 23-edge production set in `lib/core/lazygraph-ops.cjs:25` (NOT just the Phase 87/89 subset; the alias guardrail must include all 23 or it false-positives shipped edges as drift) — and formalize `opportunity` as a first-class node type alongside the new claim/assumption/evidence taxonomy. Ship six document-first deliverables: RECONCILIATION.md (nodes + edges), PROVENANCE.md (contract spec), TRUTH-STATES.md (8-state taxonomy + status_aliases), aliases.yml (machine-readable resolution table), `scripts/check-schema-aliases.cjs` + `scripts/install-pre-commit.sh` (opt-in pre-commit guardrail; `.git/hooks/pre-commit` itself is NOT tracked — contributors run the installer once after cloning), and PART-9-PROPOSAL.md (Canon Part 9 cross-reference checklist + ratification path). Embed the Canon Part 9 (Memory Locality and Interpretation) amendment proposal as a deliverable; ratification deferred to Phase 109 release gate. **No runtime schema migration in this phase by design** — Phase 108 specifies contracts; Phase 109 implements them. The discipline is reconcile first, migrate second.

**Requirements**: RECONCILE-108-01, RECONCILE-108-02, RECONCILE-108-03, RECONCILE-108-04, RECONCILE-108-05, RECONCILE-108-06

**Depends on:** Read-only dependency on Phase 87 (cascade refactor — INFORMS / CONTRADICTS / CONVERGES / INVALIDATES / ENABLES), Phase 88 (Feynman-MINTO triple), Phase 89 (REVERSE_SALIENT edge), Phase 90 (BRAIN.md derivation + proposed-vs-confirmed pattern), Phase 99 (smart-notebook + across-session memory). No code changes to those phases; Phase 108 documents and reconciles only.

**Canon parts:** Part 4 (Every Choice Is Graph Data), Part 7 (Reuse Before Build — must justify any NEW node/edge type per the alias table), Part 9 (Memory Locality and Interpretation — proposed amendment ratified at Phase 109 release gate).

**Plans:** 3/7 plans executed

- [x] 108-00-PLAN.md - Wave 0: REQ-IDs + ROADMAP entry + 7 test stub registration
- [x] 108-01-PLAN.md - Wave 1: RECONCILIATION.md (D-01 nodes + D-02 edges; all 23 EDGE_TYPES + 14 Codex nodes + corrections from RESEARCH 2.4)
- [x] 108-02-PLAN.md - Wave 1: PROVENANCE.md (D-02 contract spec only, no SQL migration)
- [ ] 108-03-PLAN.md - Wave 2: TRUTH-STATES.md (D-03 closed-set + status_aliases + transition table + auto-stale rule)
- [ ] 108-04-PLAN.md - Wave 2: aliases.yml (D-04 machine-readable resolution table + status_aliases section)
- [ ] 108-05-PLAN.md - Wave 3: scripts/check-schema-aliases.cjs pre-commit hook (D-05) + 5 fixture tests + .git/hooks/pre-commit installer
- [ ] 108-06-PLAN.md - Wave 3: PART-9-PROPOSAL.md cross-reference checklist (D-06) + CANON-PHASE-MAP.md "Part 9 (proposed)" row addition

**Authority**: `.planning/phases/108-graph-memory-schema-reconciliation/108-CONTEXT.md`. Research provenance: `.planning/research/2026-05-03-codex-graph-memory-proposal.md` and `.planning/research/2026-05-03-canon-part-9-memory-locality-proposal.md`.


### Phase 109: SQL Context-Memory Navigation Spine (REGISTERED 2026-05-03 — LOAD-BEARING)

**Goal:** Make `room.db` the primary local context, memory, and insight navigation engine for Larry. Ship eight navigation-behavior deliverables: focus node model (every session has one current focus), typed neighborhood retrieval (ranked nodes by edge type + depth + recency + confidence + section relevance), memory event log (events not just latest state), six insight query primitives (`find_contradictions`, `find_unsupported_claims`, `find_blocking_assumptions`, `find_stale_decisions`, `find_open_questions`, `find_recent_changes`), navigation API (`lib/core/navigation.cjs` — single chokepoint; pre-commit hook fails any direct `room.db` access elsewhere), Brain Packet Builder (`buildBrainPacket(job, focusNodeId)` — schema lives in Phase 110), Brain Result Ingestion (Brain writes always land as `review_status: proposed`), Room Home Driver (replaces ad-hoc folder scans). **Acceptance test:** given a focus node, Mindrian retrieves+ranks+explains+packets WITHOUT scanning the whole Room (instrumented: zero file reads beyond SQLite WAL during the flow). **Canon Part 9 ratified at this release gate** (merged from `.planning/research/2026-05-03-canon-part-9-memory-locality-proposal.md` into `docs/MINDRIAN-CANON.md`).

**Requirements**: NAV-109-01, NAV-109-02, NAV-109-03, NAV-109-04, NAV-109-05, NAV-109-06, NAV-109-07, NAV-109-08, NAV-109-09

**Depends on:** Phase 108 (HARD prerequisite — schema reconciliation must ship first; Phase 109 cannot start while taxonomy is unfrozen). Reuses Phase 99 operator state, Phase 100 JTBD state, Phase 106 statusline (extends to surface active focus), Phase 90 BRAIN.md derivation pattern (proposed-vs-confirmed precedent).

**Canon parts:** Part 1 (Wicked Navigator — working memory made legible), Part 3 (Tri-Context Decision Gate — consumes navigation output as the LOCAL context), Part 4 (Every Choice Is Graph Data — every state change is a memory_event), Part 8 (Graph Boundary — D-06 + D-07 honor it; Phase 110 hardens via wire schema), Part 9 (Memory Locality and Interpretation — RATIFIED here).

**Plans:** TBD by `/gsd:plan-phase 109` — heuristic estimate 9-12 plans across 4 waves

**Authority**: `.planning/phases/109-sql-context-memory-navigation-spine/109-CONTEXT.md`. The phase guardrail (Codex via Jonathan, 2026-05-03): "Do not let Phase 109 become 'more SQL tables.' It must define navigation behavior."


### Phase 110: Brain Context Packet Contract (REGISTERED 2026-05-03 — STUB)

**Goal:** Turn Canon Part 8 from "we audit for leaks" into "the wire format makes leaks structurally harder." Ship a typed JSON Schema for Brain Context Packets, per-job allowed input/output shapes for the closed-vocabulary Brain jobs (`select_methodology`, `suggest_next_move`, `detect_contradiction`, `summarize_neighborhood`, `classify_room_budding`, `rank_assumptions`, `generate_feynman_explanation`, `strengthen_minto`, `prepare_investor_brief`), privacy modes with explicit user opt-in, schema validator middleware in `lib/core/brain-client.cjs` (invalid packets refuse to send, invalid responses refuse to ingest), test suite proving Canon Part 8 invariants hold for every shipped job type, dual-path rollout (legacy free-form + typed packet) deprecating to typed-only.

**Requirements**: TBD (PACKET-110-01..NN — defined when CONTEXT.md is expanded post Phase 109)

**Depends on:** Phase 109 (uses `buildBrainPacket` and `storeBrainSuggestions` APIs from the navigation spine).

**Canon parts:** Part 8 (Graph Boundary — hardened from procedural to architectural), Part 9 (Memory Locality — Brain reasons over packets, never raw memory).

**Plans:** TBD — phase is stubbed; full CONTEXT to be expanded after Phase 109 navigation API is reviewed.

**Authority**: `.planning/phases/110-brain-context-packet-contract/110-CONTEXT.md` (stub).


### Phase 112: GraphRAG-Informed Room Retrieval + Room Budding (REGISTERED 2026-05-03 — STUB)

**Goal:** Bring lessons from `automataIA/graphrag-rs` into Mindrian's typed-edge spine WITHOUT flattening the venture-reasoning ontology. Add to Phase 109's navigation API: dual-level retrieval (low-level entity/claim/artifact + high-level folder/community), RRF fusion at k=60, personalized PageRank rooted at the active focus node (not global), semantic dedup pre-pass at ~0.85 cosine, local embedding cache in `room.db` with backend chain (Ollama → ONNX-WASM → hash fallback), optional Leiden communities over typed edges. Visible product feature: **Room Budding** — when Phase 106 context-window pressure + topic drift cross threshold, Larry surfaces "This thread has become Anthropic partnership strategy. Create a linked Room?" — APPROVE writes BUDDED_FROM + SHARES_ASSUMPTION_WITH edges (names reserved in Phase 108).

**Requirements**: TBD (RETRIEVE-112-01..NN — defined when CONTEXT.md is expanded post Phase 106 + Phase 109)

**Depends on:** Phase 106 (statusline + context-window broadcast — Room Budding triggers off context pressure) AND Phase 109 (SQL navigation spine — retrieval algorithms run over the navigation API). HARD on both.

**Canon parts:** Part 1 (Wicked Navigator — Room Budding is the hero's-journey sub-quest), Part 4 (Every Choice Is Graph Data — BUDDED_FROM edges), Part 9 (Memory Locality — retrieval over SQL spine, never raw scan).

**Plans:** TBD — phase is stubbed; full CONTEXT to be expanded after Phase 106 ships AND Phase 109 navigation API is reviewed.

**Operating constraint** (Codex's strongest line, applies above all other phases here): "Do not let GraphRAG flatten Mindrian's richer ontology. Mindrian should remain a venture reasoning graph, not a generic document graph."

**Authority**: `.planning/phases/112-graphrag-retrieval-room-budding/112-CONTEXT.md` (stub). Note: Phase 111 is taken (`cascade-decomposition`) — that is why this phase is 112, not 111.


### Phase 113: WASM Everywhere Spike (REGISTERED 2026-05-03 — STRATEGIC SPIKE, DEFERRED)

**Goal:** Strategic spike, NOT a feature phase. graphrag-rs proved the full GraphRAG pipeline runs 100% in the browser (sql.js + WebLLM + ONNX-WASM + IndexedDB). This spike asks: can MindrianOS do the same, and if yes, does it REPLACE the hosted v3.0 "Everywhere" thesis (Arc 6 per `MILESTONES-NAMING.md`), COEXIST with it as a privacy-first variant, or get REJECTED on quality/scale limits? Spike output: working browser demo (single-user, single-room, no server) + decision memo at `docs/strategy/2027-v3-wasm-vs-hosted-decision.md`. If REPLACE or COEXIST, `MILESTONES-NAMING.md` Arc 6 thesis gets rewritten in the same release.

**Requirements**: TBD — spike-grade; small team, time-boxed, output is memo + demo not a product release.

**Depends on:** Phase 112 (proven retrieval stack to port) AND a v3.0 strategy decision (Arc 6 "Everywhere" recalibration must be on the table — not yet on the calendar). Both HARD.

**Canon parts:** Part 1 (Wicked Navigator — distribution beyond CLI), Part 8 (Graph Boundary — strengthened: no server means no leakage surface), Part 9 (Memory Locality — IndexedDB IS the local mind in the browser).

**Plans:** TBD — likely 1-2 plans only (this is research, not implementation).

**Authority**: `.planning/phases/113-wasm-everywhere-spike/113-CONTEXT.md` (stub). The thesis question this spike answers: *"Does Mindrian's intelligence survive without infrastructure?"*


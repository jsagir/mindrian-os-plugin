# Roadmap: The Closed Loop v1.13.0

## Active Milestone: v1.13.0 "The Closed Loop" (renamed Arc 4 -- was "Every Hirer")

**Status:** v1.13.0-beta.1 SHIPPED 2026-05-05 (plugin commit afcea5f, marketplace a37b073). Phase 108 + Phase 109 substrate landed. beta.2 next.

**Thesis:** Turn MindrianOS from "the back half of a hook" into a closed habit loop with first-15-minute imprint. Larry leads. SQL graph remembers. Brain reasons as a constant. Conversation IS the front door. Commands are internals.

**Hooked Model audit:** baseline 27/70 (2026-04-12), target 58/70 by v1.13.0 final. Per-axis movement projection in canonical roadmap.

**Beta progression:**
- v1.13.0-beta.1 SHIPPED -- Substrate (Phase 108 + 109)
- v1.13.0-beta.2 -- "Larry leads" (Phase 88.2 finish + 89-07 finish + 114 + 115 + SEED-003 A1+A4)
- v1.13.0-beta.3 -- "Loop closes + reward fires" (Phase 116 + 117 + SEED-003 A3)
- v1.13.0 final -- "Full closed loop" (Phase 118 + 119 + 120 + Phase 121.5 terminal-coherence capstone + SEED-003 A2) -- Phase 121.5 is the LAST phase before the FINAL RELEASE GATE

**Canonical plan:** `.planning/milestones/v1.13.0-CLOSED-LOOP-ROADMAP.md`
**Resume entry point:** `.planning/SESSION-HANDOFF.md`
**Constitutional thesis:** `docs/CANON-PART-10-PROPOSAL-conversation-as-product.md` (ratifies at v1.13.0 final release gate, parallel to Part 9 at Phase 109 release gate)

**Provenance:** Synthesized 2026-05-05 in 4-hour deep-dive session combining /mos:think-hats + /mos:beautiful-question + recovery of 2026-04-12 dormant Hooked Model 4-fix audit + capabilities radar pass on Claude Code 2.1.x adoption + foundation audit of phases 88-109. The "Every Hirer" thesis was deemed still command-centric; "The Closed Loop" reframes around conversation-first golden path.

**Phase 114 (larry-default-activation) -- 3 plans planned:**
- [x] 114-00-PLAN.md -- Skill activation policy (subagent skill preload + agent frontmatter + settings.json cleanup + paths scoping + SessionStart JTBD refactor) [requirements: AC-114-01, AC-114-02]
- [x] 114-01-PLAN.md -- .mcp.json alwaysLoad on mindrian-os local server (SEED-003 A1) [requirements: AC-114-03]
- [x] 114-02-PLAN.md -- Wave 0 verification + Phase 91 non-regression + v1.13.0-beta.2 release plumbing [requirements: AC-114-04]

---

## Previous Active Milestone: v1.11.0 Memory Triple + Navigation Engine -- SHIPPED 2026-05-01

Phases 88, 88.6, 88.1, 89, 90, 91. Releases: v1.10.13 Phase 88 SHIPPED, v1.10.14 Phase 88.6 URGENT bug fix, v1.10.15 Phase 88.1 polish, v1.10.16 Phase 89 reverse-salient, v1.10.17 Phase 90 Brain derivation, v1.11.0 Phase 91 destination, v1.11.0 stable promotion via Phase 91.5. v1.11.2 hotfix (Phase 94) shipped 2026-04-29. v1.12.x point releases (1.12.0 -> 1.12.5.1) consumed by Phase 95.1 doctor work + Phase 106 statusline visibility.

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
- [x] **Phase 89.6: v1.11.0-beta.1 Release Gate (RS Framework Beta)** - Ship the RS framework (89.1a + 89.1 + 89.2 + 89.3 + 89.4 + 89.5) as v1.11.0-beta.1 to opt-in testers (the Wave-1 testers). 5-gate release with -beta.1 suffix: CHANGELOG entry + plugin.json version + package.json version + git tag v1.11.0-beta.1 + marketplace ref pin. Stable users (v1.10.19) NOT auto-updated. Testers opt in via `claude plugin update mos@mindrian-marketplace --version 1.11.0-beta.1`. Per release-process.md beta-gating mandate: release infrastructure + new product surface ALWAYS ship as beta first; tester sign-off promotes to stable. (completed 2026-05-01)
- [x] **Phase 90: Brain Derivation Layer** - Lets the Brain excavate the local triple (Phase 88) and produce a persistent authored BRAIN.md per section with pattern matches, cross-domain analogies, wicked indicators, unfilled opportunity matches, framework chain predictions, cross-room contradiction flags. Extends triple to quadruple. Graceful degradation when Brain offline. CONTEXT filed. Releases as v1.10.17. (completed 2026-04-24)
- [x] **Phase 91: Navigation Engine** - L5 Decision layer reading the L3 Navigation substrate (SQL + quadruple memory) to decide which skill/command/framework fires each turn. Five-signal triangulation (ICM + SQL + Feynman-MINTO + BRAIN + intent/persona). Persona durability via USER.md. Visible dial in statusline. /mos:explain-decision command. CONTEXT filed. Destination phase. Releases as v1.11.0-beta.2 (full milestone complete; the Wave-1 testers + wider tester opt-in via `--version 1.11.0-beta.2`; release gate at Plan 91-10 relabeled from v1.11.0 to v1.11.0-beta.2). (completed 2026-04-28)
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

### Phase 88.7: power-demo-multipage-export (INSERTED, INCOMPLETE)

**Goal:** Multipage export demo surface for power users. Originally inserted 2026-04-24 as urgent work; never broken down via /gsd:plan-phase.
**Requirements**: TBD
**Depends on:** Phase 88
**Status:** Deferred. Truth-told 2026-05-16 by Phase 121.5 Sub-plan G housekeeping pass.
**Plans:** 0/1 plans complete (NOT 1/1 -- prior status was inaccurate)
**Actually shipped:** `scripts/power-demo-prompt.md` (single prompt doc, untracked-but-present, 2026-04-24).
**NOT shipped:** `commands/power-demo.md` does not exist; no `.planning/phases/88.7-*` directory exists; no SUMMARY.md; 5 sub-plans never authored.

Plans:
- [ ] TBD (run /gsd:plan-phase 88.7 to break down, OR formally retire) -- deferred indefinitely; reconsider at v1.14.0 backlog grooming.

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
**Goal**: Ship the complete v1.11.0 RS framework (89.1a + 89.1 + 89.2 + 89.3 + 89.4 + 89.5) as v1.11.0-beta.1 to opt-in testers. The RS framework is functionally complete after 89.5; this phase wraps it for tester consumption WITHOUT promoting to the stable channel. Per release-process.md beta-gating mandate, new product surface always ships as beta first; tester sign-off promotes to stable in Phase 91.5. Stable users (currently v1.10.19) NOT auto-updated -- they must explicitly opt in via `claude plugin update mos@mindrian-marketplace --version 1.11.0-beta.1`. the Wave-1 testers are the named first testers; their feedback shapes any patches before Phase 91 ships beta.2.
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
**Goal**: After Phase 91 ships v1.11.0-beta.2 AND testers (the Wave-1 testers + wider opt-in pool) confirm zero regressions through a 3-5 day soak period, promote v1.11.0-beta.2 to stable v1.11.0. Tiny phase but real -- it requires its own commit + tag + marketplace re-pin so the auto-update channel users get the stable release, and so users currently on `--version 1.11.0-beta.2` continue to work without changes (no breaking diff between beta.2 and stable; only the suffix is removed). Per release-process.md "Pre-release versions for beta testing" + "How Users Actually Receive Updates", this is the canonical promote-to-stable workflow.
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
**Plans:** 10/11 plans complete

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


### Phase 95.6: install-cache-windows-hardening-and-skill-loop-resilience (INSERTED)

**Goal:** Harden the canonical Windows install path (git clone + bash install.sh) against the four failure modes that broke a real Wave-2 tester install on 2026-05-08/09 (the Wave-2 tester, Surface Pro 7), and close the gap between "the install site advertises a path" and "the path actually works on a fresh Windows machine." Tier 1 (gates the NATO Defense College Rome 2026-06-01 deadline; ships as v1.13.0-beta.9): D-02 rename the 189-char phase-92 dir, D-03 install.sh skill-loop hardening + SKILL.md backfill, D-01 Windows long-path preflight + stale-clone cleanup, D-09 statusline registered first + /mos:doctor class H + install receipt + first-session auto-doctor, D-05a release.sh Step 9.5 npm publish gate. Tier 2 (defer to beta.10 if NATO pressure): D-05b/c/d marketplace npm source + bin/cli.js + SessionStart npm-reconcile hook, D-10 subagent capability parity, D-11 reserved-names gate + Deferred Tool Loading note, D-05e/f ZIP/URL + CI pre-bake docs. Tier 3 (defer freely): D-04 README Manual Recovery, D-06 BSL-1.1 source-available sweep, D-07 SEED-007 scanner pattern 3. Plus the case #4 install-failure autopsy.
**Requirements**: D-01, D-02, D-03, D-04, D-05a, D-05b, D-05c, D-05d, D-05e, D-05f, D-06, D-07, D-08, D-09, D-10, D-11
**Depends on:** Phase 95.2 (install-cache-atomic-recovery-sessionstart-preflight)
**Plans:** 10/10 plans complete

Plans:
- [x] 95.6-01-PLAN.md -- D-02: rename .planning/phases/92-... (189-char leaf) to 92-trust-layer-refactor/ [Tier 1, Wave 1]
- [x] 95.6-02-PLAN.md -- Wave 0: create the 7 missing test files + backfill skills/mullins-scaffold/SKILL.md + the Windows cold-install manual gate + wire tests/run-all.sh [Tier 1, Wave 0]
- [x] 95.6-03-PLAN.md -- D-03: install.sh skill-loop pre-filter + WARN-and-continue + README permission-prompt note [Tier 1, Wave 1]
- [x] 95.6-04-PLAN.md -- D-01: install.sh Windows long-path preflight (core.longpaths) + OS detection + stale-partial-clone cleanup [Tier 1, Wave 1]
- [x] 95.6-05-PLAN.md -- D-09: register_statusline() first in install.sh + .install-receipt.json + /mos:doctor class H + first-session auto-doctor [Tier 1, Wave 1]
- [x] 95.6-06-PLAN.md -- D-05a: scripts/release.sh Step 9.5 npm publish gate + case #4 autopsy + CHANGELOG npm-gap note [Tier 1, Wave 1]
- [x] 95.6-07-PLAN.md -- D-05b/c + D-11a: bin/cli.js (install/doctor/update) + package.json bin field + reserved-marketplace-names release gate + D-05b npm-source target documented [Tier 2, Wave 2, defer to beta.10 if NATO pressure]
- [x] 95.6-08-PLAN.md -- D-05d/e/f + D-10 + D-11b: SessionStart npm-reconcile hook + subagent mcpServers/skills frontmatter parity + Deferred Tool Loading note + four-distribution-paths doc [Tier 2, Wave 2, defer to beta.10 if NATO pressure]
- [x] 95.6-09-PLAN.md -- D-04/06/07: README ## Manual Recovery section + BSL-1.1 source-available sweep + first-touch-drift scanner pattern 3 + SEED-007 scope-notes update [Tier 3, Wave 2, defer freely]
- [~] 95.6-10-PLAN.md -- D-08 (release gate): v1.13.0-beta.9 SHIPPED to GitHub + marketplace 2026-05-11 -- Task 1 CHANGELOG [1.13.0-beta.9] (577a668) + Task 2 Windows cold-install checkpoint WAIVED by maintainer + Task 3 version bumps + release commit (9ed8280) + tag v1.13.0-beta.9 + `git push origin main --tags` + ~/mindrian-marketplace ref pin (a41964f, mos 1.13.0-beta.9 / ref v1.13.0-beta.9). PENDING: `npm publish --tag next` (ENEEDAUTH -- maintainer must `npm login`), then `gsd-tools phase complete 95.6`, then update ~/mindrianos-install-site/. [Tier 1, Wave 3, last]

### Phase 95.2: Install Cache Atomic Recovery + SessionStart Preflight (INSERTED)

**Goal:** Harden the install-cache recovery path in `scripts/doctor.cjs` after a third occurrence of the install-cache failure family on the dogfood machine (2026-05-06; live install dir missing while two stale backups sit alongside). Three deliverables: D1 atomic-swap recovery (eliminate half-done state), D2 class A `--fix` eligibility for `install.status === "missing"` (currently only fires on `drift.detected: true`), D3 SessionStart preflight class-A check + warning surface. Ships as v1.13.0-beta.6 hotfix between beta.4 (in-flight) and the beta.2 thesis work. Forward-protective only -- machines already in missing-install state get the patch via `--fix` from cache, which already works.
**Requirements**: DOCTOR-95.2-01, DOCTOR-95.2-02, DOCTOR-95.2-03, DOCTOR-95.2-04, DOCTOR-95.2-05, DOCTOR-95.2-06, DOCTOR-95.2-07, DOCTOR-95.2-08, DOCTOR-95.2-09
**Depends on:** Phase 95.1 (extends `scripts/doctor.cjs`; no parallel surface)
**Plans:** 3/3 plans complete

Plans:
- [x] 95.2-00-PLAN.md -- Atomic-swap performRecovery + missing-state class-A eligibility + MINDRIAN_PLUGIN_HOME env override + tests/test-doctor-atomic-swap.cjs (Wave 0; parallel with 95.2-01)
- [x] 95.2-01-PLAN.md -- SessionStart preflight via scripts/preflight-doctor.cjs (8th hooks.json entry) + scripts/doctor-preflight-format.cjs helper + 2 new test files (Wave 0; parallel with 95.2-00)
- [ ] 95.2-02-PLAN.md -- Autopsy 2026-05-06 + dogfood self-test + 5-gate v1.13.0-beta.6 release (Gate 5 marketplace ref-pin DEFERRED) + canon-phase-map update (Wave 1; depends on 95.2-00 + 95.2-01)

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

**Plans:** 4/4 plans complete

Plans:
- [x] 104-00-PLAN.md - Add JTBDCONS-104-01..05 requirements + Wave-0 test stubs (Wave 0 foundation)
- [x] 104-01-PLAN.md - Sweep edit: add `serves_jtbd:` to all 84 commands per the verbatim mapping table (Wave 1)
- [x] 104-02-PLAN.md - Verification harness: every-command-declares + every-JTBD-has-1-command tests (Wave 2 - depends on 104-01)
- [x] 104-03-PLAN.md - Backward-compat regression fence + CHANGELOG v1.12.4 entry (Wave 2 - depends on 104-01)

### Phase 104.1: Per-Command JTBD Content Layer (REGISTERED 2026-05-13 -- HARD DEPENDENCY for Phase 125)

**Goal:** Phase 104 closed without shipping `teaching` + `jtbd_label` + `jtbd_summary` fields that Phase 125 D9 + D11 depend on. Phase 104.1 ships these as a content-only follow-on to Phase 104: per-command frontmatter gains 3 fields (`jtbd_label` = short user-facing handle; `jtbd_summary` = terse 1-line rationale for high-investment users; `teaching` = Larry-voice 1-2 sentence explanation for low-investment users). Phase 125's f-selector-ranker reads these fields and selects content shape by investment_level. NO new commands, NO new logic, NO taxonomy changes -- purely content authoring + the same sweep-edit harness pattern proven in Phase 104.

**Requirements**: [CONTENT-104.1-01..NN -- defined in plan-phase]

**Depends on:** Phase 104 (per-command serves_jtbd declarations, SHIPPED v1.12.4) + Phase 100 (jtbd-taxonomy.json, SHIPPED)

**Dependents:** Phase 125 (F-Selector Ranker; HARD GATE -- Phase 125 execute-phase cannot start until Phase 104.1 ships)

**Target band:** v1.13.0-beta.14 (ships ahead of Phase 125 in the same beta cut OR as a content-only commit immediately before; ~3-4 days of content authoring)

**Canon parts:** Part 3 (F-shape adaptive surface -- content scales with investment level); Part 7 (Reuse over build -- extends Phase 104's content layer pattern)

**Plans:** 2/2 plans complete

Plans:
- [x] TBD (run /gsd:plan-phase 104.1 to break down) (completed 2026-05-13)

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

**Plans:** 7/7 plans complete

- [x] 108-00-PLAN.md - Wave 0: REQ-IDs + ROADMAP entry + 7 test stub registration
- [x] 108-01-PLAN.md - Wave 1: RECONCILIATION.md (D-01 nodes + D-02 edges; all 23 EDGE_TYPES + 14 Codex nodes + corrections from RESEARCH 2.4)
- [x] 108-02-PLAN.md - Wave 1: PROVENANCE.md (D-02 contract spec only, no SQL migration)
- [x] 108-03-PLAN.md - Wave 2: TRUTH-STATES.md (D-03 closed-set + status_aliases + transition table + auto-stale rule)
- [x] 108-04-PLAN.md - Wave 2: aliases.yml (D-04 machine-readable resolution table + status_aliases section)
- [x] 108-05-PLAN.md - Wave 3: scripts/check-schema-aliases.cjs pre-commit hook (D-05) + 5 fixture tests + .git/hooks/pre-commit installer
- [x] 108-06-PLAN.md - Wave 3: PART-9-PROPOSAL.md cross-reference checklist (D-06) + CANON-PHASE-MAP.md "Part 9 (proposed)" row addition

**Authority**: `.planning/phases/108-graph-memory-schema-reconciliation/108-CONTEXT.md`. Research provenance: `.planning/research/2026-05-03-codex-graph-memory-proposal.md` and `.planning/research/2026-05-03-canon-part-9-memory-locality-proposal.md`.


### Phase 109: SQL Context-Memory Navigation Spine (REGISTERED 2026-05-03 — LOAD-BEARING)

**Goal:** Make `room.db` the primary local context, memory, and insight navigation engine for Larry. Ship eight navigation-behavior deliverables: focus node model (every session has one current focus), typed neighborhood retrieval (ranked nodes by edge type + depth + recency + confidence + section relevance), memory event log (events not just latest state), six insight query primitives (`find_contradictions`, `find_unsupported_claims`, `find_blocking_assumptions`, `find_stale_decisions`, `find_open_questions`, `find_recent_changes`), navigation API (`lib/core/navigation.cjs` — single chokepoint; pre-commit hook fails any direct `room.db` access elsewhere), Brain Packet Builder (`buildBrainPacket(job, focusNodeId)` — schema lives in Phase 110), Brain Result Ingestion (Brain writes always land as `review_status: proposed`), Room Home Driver (replaces ad-hoc folder scans). **Acceptance test:** given a focus node, Mindrian retrieves+ranks+explains+packets WITHOUT scanning the whole Room (instrumented: zero file reads beyond SQLite WAL during the flow). **Canon Part 9 ratified at this release gate** (merged from `.planning/research/2026-05-03-canon-part-9-memory-locality-proposal.md` into `docs/MINDRIAN-CANON.md`).

**Requirements**: NAV-109-01, NAV-109-02, NAV-109-03, NAV-109-04, NAV-109-05, NAV-109-06, NAV-109-07, NAV-109-08, NAV-109-09

**Depends on:** Phase 108 (HARD prerequisite — schema reconciliation must ship first; Phase 109 cannot start while taxonomy is unfrozen). Reuses Phase 99 operator state, Phase 100 JTBD state, Phase 106 statusline (extends to surface active focus), Phase 90 BRAIN.md derivation pattern (proposed-vs-confirmed precedent).

**Canon parts:** Part 1 (Wicked Navigator — working memory made legible), Part 3 (Tri-Context Decision Gate — consumes navigation output as the LOCAL context), Part 4 (Every Choice Is Graph Data — every state change is a memory_event), Part 8 (Graph Boundary — D-06 + D-07 honor it; Phase 110 hardens via wire schema), Part 9 (Memory Locality and Interpretation — RATIFIED here).

**Plans:** 13/13 plans complete

Plans:
- [x] 109-00-PLAN.md -- Wave 0 substrate: 9 NAV-109 requirement IDs + 16 test stubs + fs-instrument helper + 500-node fixture
- [x] 109-01-PLAN.md -- nodes-provenance migration (closed-5 created_by + closed-8 review_status + 9 provenance columns); follow-up fix 7d87ed5 (the phase-109-migration-view-drop-collision bug: the table rebuild now drops+recreates every dependent view/trigger via the canonical SQLite 12-step recipe; debug archive 2601229)
- [x] 109-02-PLAN.md -- session_focus migration + focus.cjs (getActiveFocus / setFocus; auto-focus cascade) [NAV-109-01]
- [x] 109-03-PLAN.md -- memory-events.cjs (logEvent + 15-event closed set + findRecentChanges) [NAV-109-03]
- [x] 109-04-PLAN.md -- neighborhood.cjs recursive-CTE ranking + navigation.cjs chokepoint + transitions.cjs promoteNodeStatus [NAV-109-02]
- [x] 109-05-PLAN.md -- insights.cjs: 6 insight query primitives + findRelevantOpportunities + templated explanations [NAV-109-04]
- [x] 109-06-PLAN.md -- check-schema-aliases.cjs chokepoint sub-check (no direct room-db.cjs imports outside allow-list) [NAV-109-05]
- [x] 109-07-PLAN.md -- packet.cjs buildBrainPacket per D-06 + 5 Part 8 leak tripwires [NAV-109-06]
- [x] 109-08-PLAN.md -- ingestion.cjs storeBrainSuggestions (always review_status proposed; Part 9 invariant) [NAV-109-07]
- [x] 109-09-PLAN.md -- room-home.cjs getRoomHomeView per D-08 + Phase 90 regression fence; closed 13-function surface complete [NAV-109-08]
- [x] 109-10-PLAN.md -- Wave 4: fill the load-bearing acceptance test (full navigation flow via the chokepoint, fs-instrument active, zero non-SQLite reads) [NAV-109-09]
- [x] 109-11-PLAN.md -- Wave 4: Canon Part 9 ratification (merge into MINDRIAN-CANON.md before Appendix A; flip CANON-PHASE-MAP rows to shipped; v1.4 bump; Appendix D entry 12; fill the ratification test) [NAV-109-09]
- [x] 109-12-PLAN.md -- Wave 4: recreate the 4 missing SUMMARYs (109-00/01/07/09); flip NAV-109-06/07/08 to Complete in REQUIREMENTS.md; re-register the 15 Phase-109 test suites in lib/memory/run-feynman-tests.cjs (bookkeeping recovery / phase-ledger reconciliation)

**Phase 109 ledger note (2026-05-12):** all 13 plans executed; all 9 NAV-109-XX requirements Complete; all 16 Phase-109 test suites pass (run directly + via the Feynman runner). Canon Part 9 (Memory Locality and Interpretation) ratified at the release gate (docs/MINDRIAN-CANON.md v1.3 -> v1.4; Appendix D entry 12; CANON-PHASE-MAP Part 9 rows shipped for 108 + 109). The release commit (CHANGELOG / plugin.json / package.json version bump to whatever version Phase 109 ships in, per the CLAUDE.md 5-gate release process) is the remaining step, OUT OF SCOPE for the phase plans.

**Authority**: `.planning/phases/109-sql-context-memory-navigation-spine/109-CONTEXT.md`. The phase guardrail (Codex via Jonathan, 2026-05-03): "Do not let Phase 109 become 'more SQL tables.' It must define navigation behavior."


### Phase 110: Brain Context Packet Contract (REGISTERED 2026-05-03; CONTEXT + RESEARCH done 2026-05-12; PLANNED 2026-05-12)

**Goal:** Turn Canon Part 8 from "we audit for leaks" into "the wire format makes leaks structurally harder." Ship a typed JSON Schema for Brain Context Packets, per-job allowed input/output shapes for the closed-vocabulary Brain jobs (`select_methodology`, `suggest_next_move`, `detect_contradiction`, `summarize_neighborhood`, `classify_room_budding`, `rank_assumptions`, `generate_feynman_explanation`, `strengthen_minto`, `prepare_investor_brief`, `opportunity_react`, `opportunity_reflect`, `opportunity_rank`), privacy modes with explicit user opt-in, schema validator middleware in `lib/core/brain-client.cjs` (invalid packets refuse to send, invalid responses refuse to ingest), test suite proving Canon Part 8 invariants hold for every shipped job type, dual-path rollout (legacy free-form + typed packet) deprecating to typed-only.

**Requirements**: PACKET-110-01..09 (registered 2026-05-12 -- see `.planning/REQUIREMENTS.md` "## Brain Context Packet Contract (PACKET-110)"; the `110-00` Wave-0 substrate plan writes the block + the Status rows at execution time)

**Depends on:** Phase 109 (uses `buildBrainPacket` and `storeBrainSuggestions` APIs from the navigation spine).

**Canon parts:** Part 8 (Graph Boundary -- hardened from procedural to architectural), Part 9 (Memory Locality -- Brain reasons over packets, never raw memory).

**Plans:** 6/6 plans complete

Plans:
- [x] 110-00-PLAN.md - Wave 0 substrate (register PACKET-110-01..09 in REQUIREMENTS.md + ROADMAP; 4 RED test stubs; tests/run-all-110.sh; Feynman-runner registration; 12-job-vocabulary correction)
- [x] 110-01-PLAN.md - Wave 1 schema artifact + generator + --check tripwire (data/brain-packet-schema.json + scripts/build-brain-packet-schema.cjs; data/ROOM.md row; fill test-brain-packet-schema-check.cjs)
- [x] 110-02-PLAN.md - Wave 1 origin field + EVENT_TYPES extension + privacy-mode resolver (packet.cjs origin/privacy_mode + resolvePrivacyMode; memory-events.cjs +3; regression touches)
- [x] 110-03-PLAN.md - Wave 2 sendPacket() validator middleware + response-degrade gate + dual-path warn (brain-client.cjs sendPacket; navigation.cjs logMemoryEvent re-export; reject-hard-degrade-soft)
- [x] 110-04-PLAN.md - Wave 3 D-08 layer-2 + pre-commit hook wiring (check-schema-aliases.cjs --check-sendpacket; both hook blocks; setup-hooks re-run; fill test-brain-packet-precommit-hook.cjs)
- [x] 110-05-PLAN.md - Wave 3 the D-11 validation suite (fill test-brain-packet-validation-per-job.cjs + test-brain-packet-part8-invariant-per-job.cjs: 12-job in/out + privacy + dual-path + round-trip + adversarial Part-8 sweep)

**Authority**: `.planning/phases/110-brain-context-packet-contract/110-CONTEXT.md` (locked decisions D-00..D-11) + `.planning/phases/110-brain-context-packet-contract/110-RESEARCH.md` (implementation approach + validation architecture) + `.planning/phases/110-brain-context-packet-contract/110-VALIDATION.md` (per-task verification map).


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


### Phase 95.5: Post-Compact Memory Pipeline -- Consumer Wiring (REGISTERED 2026-05-06 -- READY FOR DISCUSSION)

**Goal**: Close the half-wired post-compact memory pipeline. Phase 95-04 ships the WRITE side: scripts/post-compact saves the full restored TRIPLE_CONTEXT (per-section memory triple: Feynman + MINTO + Brain) to `<roomDir>/.mindrian/last-post-compact.md` as a side-channel file because Claude Code 2.x PostCompact schema does NOT accept hookSpecificOutput. Phase 95.5 ships the READ side: a session-start consumer that reads the side-channel file and re-injects the TRIPLE_CONTEXT block into the next session as additionalContext, so memory survives auto-compact boundaries inside a single session (not just across full session restarts). Also updates the now-stale `lib/memory/post-compact-reinjection.test.cjs` (7/9 failing today) to assert the new contract: side-channel file presence + content + freshness, not the deprecated stdout TRIPLE_CONTEXT shape.

**Requirements**: POSTCOMPACT-95.5-01 (consumer reads side-channel file at session-start), POSTCOMPACT-95.5-02 (re-injects via additionalContext on the SessionStart envelope), POSTCOMPACT-95.5-03 (cleanup after consume to prevent stale re-injection on a later truly-fresh session), POSTCOMPACT-95.5-04 (test suite asserts new contract; old stdout assertions retired), POSTCOMPACT-95.5-05 (byte-identity invariant: post-compact write + session-start read produce the same TRIPLE_CONTEXT block as pure session-start emit, given identical inputs)

**Depends on**: Phase 95-04 (write-side side-channel writer -- shipped) + Phase 88-08 (pre-compact-snapshot.json producer -- shipped) + Phase 88-07 (triple-context-formatter.cjs single source of truth -- shipped)

**Canon parts**: Part 9 (Memory Locality and Interpretation -- the entire pipeline keeps user content LOCAL throughout; no Brain egress at any point) + Part 7 (Reuse Before Build -- session-start consumer extends existing scripts/session-start hook, does not fork)

**Plans**: 6 plans (planned 2026-05-06 via /gsd:plan-phase 95.5)
- [ ] 95.5-00-PLAN.md -- Wave 0 scaffold: 9 RED test stubs (D-05 contract) + consumer stub at scripts/restore-post-compact-context.cjs + tests/test-95.5-00-scaffold.sh + Feynman runner registration confirmation
- [ ] 95.5-01-PLAN.md -- Back-port scripts/post-compact write side: D-04 YAML frontmatter stamp (source_room_path + source_room_slug + written_at + schema_version: 1) at lines 58-72; atomic mktemp + mv -f preserved
- [ ] 95.5-02-PLAN.md -- Build consumer scripts/restore-post-compact-context.cjs: 8 helper functions + main, mirrors preflight-doctor.cjs template, implements D-01..D-04 + D-04b + D-07
- [ ] 95.5-03-PLAN.md -- Wire hooks/hooks.json SessionStart entry #9 (length 8 -> 9): idempotent Node JSON.stringify re-serialization (95.2 B4 fix precedent), matcher startup|clear|compact, timeout 3000ms
- [ ] 95.5-04-PLAN.md -- Test suite GREEN flip: 9/9 tests pass against shipped scripts/post-compact stamp + scripts/restore-post-compact-context.cjs consumer; Phase 91 Feynman HARD STOP gate clean
- [ ] 95.5-05-PLAN.md -- Release plumbing: 5-gate version sync (CHANGELOG + plugin.json + package.json + LOCAL git tag v1.13.0-beta.7); marketplace ref-pin DEFERRED per 95.2 precedent

**Success Criteria** (what must be TRUE):
1. After auto-compact in a session with an active room: the next user turn renders with TRIPLE_CONTEXT visible in Claude's working context (verifiable by asserting Larry references section-specific MINTO content the user filed pre-compact)
2. session-start consumer reads `<roomDir>/.mindrian/last-post-compact.md` if present + fresh (< 10 min old, mirroring post-compact's pre-compact-state.json staleness contract)
3. Stale or absent side-channel file -> session-start falls back to its existing live readTriple walk (no regression)
4. After successful consumption, the side-channel file is removed (or marked consumed) so the NEXT genuinely-fresh session does not re-inject stale post-compact context
5. `lib/memory/post-compact-reinjection.test.cjs` updated: 9/9 pass against new contract (side-channel file shape + freshness + byte-identity invariant); old stdout assertions retired
6. Phase 91 Feynman runner: zero NEW failures referencing post-compact / reinjection / triple-context

**Authority**: `.planning/phases/95.5-post-compact-memory-pipeline-consumer/95.5-CONTEXT.md` (TBD via /gsd:discuss-phase 95.5). Source spec: scripts/post-compact comment block lines 23-37 ("CONSUMER ... NOT YET WIRED in Phase 95 - deferred to Phase 95.5 or 96"); memory project_post_compact_memory_pipeline.md.


### Phase 116: Unresolved Tension Hook (PLANNED 2026-05-06 -- READY FOR EXECUTION)

**Goal**: Persistent tension surfacing -- every state transition registers a `pending_tension` that re-surfaces via `SessionStart` hook in Larry's voice using F.1 Next Move selector. Closes the habit loop (Eyal/Hooked) so MindrianOS becomes "tool that calls you back" not "tool you summon." Load-bearing LOOP-CLOSURE fix from the dormant 2026-04-12 Hooked audit (both audits scored Loop Closure at exactly 3/10). Implements Canon Part 10 sub-claim 3 (persistent conversation across sessions).

**Requirements**: TENSION-116-DETECT, TENSION-116-SURFACE, TENSION-116-DECAY, TENSION-116-TELEMETRY, TENSION-116-F1, TENSION-116-PERSIST -- plus 5 Wave-0 substrate IDs (TENSION-116-01-EVENT-TYPES-EXTEND, TENSION-116-02-WAVE-0-TEST-STUBS, TENSION-116-03-FEYNMAN-RUNNER-REGISTER, TENSION-116-04-CYPHER-PATCH-DRAFT, TENSION-116-05-OFFLINE-SNAPSHOT) refined during planning per CONTEXT.md D-01..D-10. Distribution: 116-00 holds all 5 Wave-0 IDs; 116-01 holds DETECT + PERSIST; 116-02 holds SURFACE + F1; 116-03 holds DECAY; 116-04 holds TELEMETRY.

**Depends on**: Phase 88.2 finish (F.1 selector -- shipped beta.4), Phase 109 (navigation.cjs -- shipped v1.11.0), Phase 90 (BRAIN.md quadruple -- shipped v1.10.18). NOT dependent on Phase 89-07 (89-07 -> Phase 117).

**Canon parts**: Part 4 (Every Choice Is Graph Data), Part 8 (Graph Boundary), Part 10 sub-claim 3 (persistent conversation). Beta target: **v1.13.0-beta.5** (between in-flight beta.4 (89-07) and pending beta.6 (Phase 95.2 hotfix)).

**Plans**: 5 plans
- [x] 116-00-PLAN.md -- EVENT_TYPES extension (Set 21 -> 26) + 5 Wave-0 RED test stubs + scaffold harness + cypher patch + offline snapshot (9 deliverables; mirrors 89-07-00)
- [ ] 116-01-PLAN.md -- Detection substrate: lib/memory/pending-tension-store.cjs (10 exports) + lib/core/navigation/insights.cjs findSurfaceableTensions + scripts/preflight-tension-surface.cjs SessionStart hook entry #7
- [ ] 116-02-PLAN.md -- F.1 surface: lib/agents/tension-hook-agent.cjs (4 exports incl. surfaceFinding + handleUserResponse + buildResolvedViaEdge) + RESOLVES_VIA cascade edge
- [ ] 116-03-PLAN.md -- Decay state machine: evaluateAndDecay + getDecayCandidates + 3-strikes rule + cross-session JSONL replay + boundary case
- [ ] 116-04-PLAN.md -- Telemetry + release: 5 emit helpers (emitDetected/Surfaced/Resolved/Decayed/Skipped) + Canon Part 8 substring audit + AGENTIC-SURFACING-PATTERN.md update + R1 byte-equal regression assertion + 5-gate v1.13.0-beta.5 release plumbing

**Success Criteria**:
1. File a contradiction across two artifacts; navigation `findContradictions` returns it.
2. Close session, reopen; tension surfaces in Larry's voice via F.1.
3. User selects "resolve" / "later" / "skip" via F.1 -- all three paths emit correct memory_event + JSONL state transition.
4. Resolved tension never re-surfaces; ignored tension re-queues with surfacing_count++.
5. After 3 surfacings of same tension without resolution, state → `dropped`; `tension_decayed` event fires.
6. Hooked audit Loop Closure axis: 3/10 → 8/10 measured at beta.3 release gate.
7. Canon Part 8 audit: zero user-content strings in any memory_event payload (sha256-only).
8. Three-surface smoke: CLI + Desktop + Cowork all surface the same F.1 render given same JSONL state.

**Authority**: `.planning/phases/116-unresolved-tension-hook/116-CONTEXT.md` (D-01..D-10 locked 2026-05-06 via /gsd:discuss-phase). Source spec: `~/MindrianRooms/mindrian/mindrian-ecosystem/sub-rooms/website/mindrianos-conversion-fix/solution-design/unresolved-tension-hook-spec.md`.


### Phase 117: Auto-Explore-Domains on First Material (SHIPPED v1.13.0-beta.8 2026-05-07)

**Goal:** When material lands in the room (CV uploaded, transcript filed, conversation paragraph typed), auto-invoke `/mos:explore-domains` as a background job, trigger HSI scoring + reverse salient + cross-domain match in parallel, and surface findings as a single Decision Gate option ("I scanned your CV; here's what I found. Want to explore?") via the F.1 Next Move selector. The user never has to remember to invoke the math layer. Implements Canon Part 10 sub-claim 5 (triple-filter math runs automatically). SEED-003 A3 `updatedToolOutput` sanitizer pairs here for Part 8 hardening.

**Requirements**: AUTOEXPLORE-117-01 through AUTOEXPLORE-117-18 (18 IDs):
- AUTOEXPLORE-117-01..12 from RESEARCH Section 5 Validation Architecture (PostToolUse fingerprint, JSONL ledger, detached fire, atomic write, drain UserPromptSubmit, F.1 surface, sanitizer hook, telemetry events, rate-limit, Canon Part 8 audit, REQ-117-12 rescore, hybrid-mode degradation)
- AUTOEXPLORE-117-13..18 from RESEARCH Section 8 Brain Substrate enrichment (canonical chain order, cross-domain formula, HSIAnalysis schema, BQ-anchored Larry voice, LOCAL-only routing, brain-canon-drift event)

**Depends on:** Phase 89-07 finish (ReverseSalientAgent -- shipped v1.13.0-beta.4) AND Phase 109 (SQL navigation spine -- shipped v1.11.0). HARD on both. Phase 110 (Brain Context Packet Contract -- promoted to beta.3 via Path C 2026-05-05) recommended before any Brain-touching wire is hardened in 117.

**Canon parts:** Part 2 Engine 1 (Act 1 intelligence surface -- auto-fires the triple filter), Part 3 (Tri-Context Decision Gate -- F.1 surface), Part 4 (Every Choice Is Graph Data -- INFORMS cascade on EXPLORE), Part 6 (Product-as-Venture -- dog-fooded on plugin room), Part 8 (Graph Boundary -- 6th tripwire via SEED-003 A3), Part 10 sub-claim 5 (triple-filter math runs automatically). Beta target: **v1.13.0-beta.8** standalone (Phase 95.5 took beta.7 first; Phase 117 promotes to beta.8 per plan contingency).

**Plans:** 6 plans (SHIPPED v1.13.0-beta.8 2026-05-07):
- [x] 117-00-PLAN.md -- Wave 0 substrate (EVENT_TYPES + 11 test stubs + scaffold + cypher + snapshot)
- [x] 117-01-PLAN.md -- Detection substrate (explored-materials-store + fingerprint hook + agent skeleton)
- [x] 117-02-PLAN.md -- Triple-filter composition (canonical chain order + cross-domain formula + auto-fire detached child)
- [x] 117-03-PLAN.md -- Decision Gate F.1 surface (UserPromptSubmit drain + HSIAnalysis schema + BQ-anchored Larry voice)
- [x] 117-04-PLAN.md -- SEED-003 A3 sanitizer + LOCAL-only routing audit (Canon Part 8 6th tripwire)
- [x] 117-05-PLAN.md -- Telemetry + brain-canon drift + v1.13.0-beta.8 release plumbing

**Authority**: `.planning/phases/117-auto-explore-domains-on-first-material/117-CONTEXT.md`. Source spec: `docs/CANON-PART-10-PROPOSAL-conversation-as-product.md` (sub-claim 5).


### Phase 118: 30-Second MVA + Reward-Before-Investment Rule (REGISTERED 2026-05-05 — STUB)

**Goal:** Build a 45-second-budget pipeline (UserPromptSubmit prompt-hook + 6-parallel-agent dispatch + Feynman deck auto-generation + Vercel ephemeral deploy) that delivers tangible reward BEFORE the user has invested any setup ceremony. The MVA output IS the room scaffold — the room emerges as a side effect of receiving the MVA, not as a precondition. Hooked Fix 2 from the dormant 2026-04-12 audit. Action axis (B=MAP) target: 3/10 → 8/10 (largest single Action move).

**Requirements**: TBD (MVA-118-01..NN — defined when CONTEXT.md is expanded; current stub captures scope + acceptance criteria + 45-second budget enforcement)

**Depends on:** Phase 114 (Larry default activation), Phase 115 (owned-emotion dual-path first-touch), Phase 116 (unresolved tension hook), Phase 117 (auto-explore wires the math layer). HARD on all four.

**Canon parts:** Part 2 (Team Around Navigator — 6-agent parallel dispatch), Part 4 (Every Choice Is Graph Data — MVA findings cascade), Part 5 (Evidence Is Graded By Context — MVA outputs carry tier markers), Part 10 sub-claim 3 (room generates as receipt, not entry point). Beta target: **v1.13.0 final**.

**Plans:** 7/7 plans complete

- [x] 118-00-PLAN.md -- UserPromptSubmit detection + classifier
- [x] 118-01-PLAN.md -- Dispatch architecture (AsyncIterable + AgentResult contract)
- [x] 118-02-PLAN.md -- Six MVA agents (3 Brain + Tavily + Six-Hats + Dashboard)
- [x] 118-03-PLAN.md -- Progressive streaming + orchestrator + telemetry
- [x] 118-04-PLAN.md -- Feynman deck + Vercel REST API direct deploy + side-file for option-2 (commits 97205606 + 592a36fa + f9d864cb + 138b2799 + a669a49d + cfd2e375)
- [ ] 118-05-PLAN.md -- Footer routing (option 1/2/3) reads side-file + state.json
- [x] 118-06-PLAN.md -- Dror harness + linter + rule integration

**Authority**: `.planning/phases/118-30-second-mva-reward-before-investment/118-CONTEXT.md`. Source specs: `~/MindrianRooms/mindrian/mindrian-ecosystem/sub-rooms/website/mindrianos-conversion-fix/solution-design/the-30-second-mva.md` + `reward-before-investment-rule.md`.


### Phase 119: Room-as-Receipt Invariant (REGISTERED 2026-05-05 — STUB)

**Goal:** Auto-`/mos:new-project` wrapper — when a first conversation or material upload happens with no active room, the room scaffold generates as a side effect of analysis. The user never explicitly creates a room. Architecture remains visible and useful; framing flips from "create a room first" to "receive a room as the receipt of conversation." Implements Canon Part 10 sub-claim 3 (rooms are receipts, not entry points).

**Requirements**: TBD (ROOMRECEIPT-119-01..NN — defined when CONTEXT.md is expanded; current stub captures scope + acceptance criteria)

**Depends on:** Phase 114 (Larry default activation), Phase 115 (owned-emotion dual-path first-touch), Phase 117 (auto-explore wires the analysis), Phase 118 (MVA delivers reward before invest). HARD on all four.

**Canon parts:** Part 2 (Team Around Navigator — team spawns into the auto-created room), Part 6 (Product-as-Venture — the dog-fooding mandate enforces this on the plugin's own room too), Part 10 sub-claim 3 (rooms are receipts). Beta target: **v1.13.0 final**.

**Plans:** 3/3 plans complete

**Authority**: `.planning/phases/119-room-as-receipt-invariant/119-CONTEXT.md` (stub). Source: `~/MindrianRooms/mindrian/mindrianOS/problem-definition/2026-05-05-beautiful-question-first-turn.md` (synthesis source).


### Phase 120: Breakthrough Scan / Category G (PLANS REGISTERED 2026-05-16)

**Goal:** Session-start scanner reads existing room content, detects 4 breakthrough pattern types (convergence, contradiction-resolved, cross-domain analogy, reverse-salient closed), renders them in Larry-voice with positive-framing rules (D-17 4-rule scaffold) via a NEW F.7 Breakthrough Surface selector with 5 verbs ([Explore deeper] / [Confirm] / [File as decision] / [Dismiss] / [Back]). Hooked Fix 3 from the dormant 2026-04-12 audit. The "highest-nutrition variable reward" type -- the user's own breakthroughs surfaced back at them, making investment directly reload reward. Variable Reward axis target: 7/10 (post Phase 117) -> 9/10 + Trigger Internal +3.

**Requirements:** BREAKTHROUGH-120-01 (4 detectors), BREAKTHROUGH-120-02 (two-tier soft/hard firing), BREAKTHROUGH-120-03 (F.7 selector + 5 verbs), BREAKTHROUGH-120-04 (session-start scanner via chokepoint), BREAKTHROUGH-120-05 (4-rule voice scaffold + audit), BREAKTHROUGH-120-06 (4-tier ethics fence), BREAKTHROUGH-120-07 (D-19 per-detector dismissal-rate canary), BREAKTHROUGH-120-08 (D-13..D-15 resurfacing rules), BREAKTHROUGH-120-09 (5-component scoring formula + top-1 + "More breakthroughs (N)" affordance).

**Depends on:** Phase 109 (SQL navigation spine -- reads room.db + Memory Event Log) AND Phase 117 (auto-explore wires the math layer that feeds breakthrough patterns) AND Phase 88.2 (F-shape selector primitive that F.7 extends) AND Phase 119 (session-start hook ordering -- Phase 120 fires THIRD after detectNoActiveRoom + detectFirstMaterial). HARD on all four.

**Canon parts:** Part 2 Engine 1 (Act 1 intelligence -- pattern detection over local graph), Part 3 (F.7 selector is a tri-context Decision Gate primitive instance), Part 4 ("File as decision" makes breakthroughs first-class decisions), Part 5 (D-17 evidence requirement + D-18 confidence bands map to the four evidence tiers), Part 8 (D-20 Cypher-provable principle is structural enforcement), Part 9 (memory locality -- all reads + writes via navigation.cjs), Part 10 sub-claim 5 (variable reward fires automatically). Beta target: **v1.13.0 final**.

**Plans:** 4/4 plans complete
- [x] 120-00-PLAN.md -- 4 pattern detectors + Breakthrough graph schema + EVENT_TYPES (+6) + ALLOWED_EDGE_TYPES (+DERIVED_FROM) [requirements: BREAKTHROUGH-120-01, BREAKTHROUGH-120-02, BREAKTHROUGH-120-06; Wave 1]
- [x] 120-01-PLAN.md -- F.7 Breakthrough Surface selector + 5-verb dispatcher + 5-component scoring formula + "More breakthroughs (N)" affordance [requirements: BREAKTHROUGH-120-03, BREAKTHROUGH-120-09; Wave 1]
- [x] 120-02-PLAN.md -- session-start scanner + resurfacing rules (D-13..D-15) + D-19 canary + verb-dispatch consumer + D-20 end-to-end test [requirements: BREAKTHROUGH-120-04, BREAKTHROUGH-120-07, BREAKTHROUGH-120-08; Wave 2; depends on 120-00 + 120-01]
- [x] 120-03-PLAN.md -- D-17 4-rule voice scaffold + auditor + D-18 4-tier ethics fence + .rooms/breakthrough-review-queue.db + Larry skill update [requirements: BREAKTHROUGH-120-05, BREAKTHROUGH-120-06 (full enforcement); Wave 2; depends on 120-00 + 120-01 + 120-02]

**Authority**: `.planning/phases/120-breakthrough-scan-category-g/120-CONTEXT.md` (twenty decisions D-01..D-20 locked 2026-05-16 via /gsd:discuss-phase).


### Phase 121: Trajectory Telemetry (REGISTERED 2026-05-05 — STUB, INSTRUMENTATION-ONLY)

**Goal:** Capture structured trajectory data across the v1.13.0 beta progression so SEED-002 (agent-lightning lab loop) has a corpus when its activation triggers fire post-v1.13.0. INSTRUMENTATION ONLY — no processing pipeline, no training loop, no model interaction. JSONL writer appends to `~/.mindrian/telemetry/v1.13/*.jsonl` with date/size rotation. Hook integration points: PostToolUse for `/mos:*` invocations, empathy audit harness, Hooked audit re-score, Phase 116 tension engagement, Phase 117 auto-explore acceptance. Pre-commit Part 8 guard validates every telemetry write for forbidden content patterns. Captured data persists locally; future SEED-002 consumption is on Jonathan's lab machine ONLY — never user machines, never a server, never a Brain endpoint.

**Requirements**: TBD (TELEMETRY-121-01..NN — defined when CONTEXT.md is expanded; current stub captures schema sketch + 6 event types + Part 8 compliance plan)

**Depends on:** Phase 109 (SQL navigation spine — shipped beta.1; Memory Event Log is the substrate). Capture points 121-03 / 121-04 depend on Phase 116 / Phase 117 respectively. Stable runtime ordering: scaffolding ships beta.1 (or beta.1.5 housekeeping); capture begins beta.2; runs through final.

**Canon parts:** Part 8 (Graph Boundary — telemetry is LOCAL-ONLY by constitutional requirement; no payload may include Brain query content, room artifact content, or user-specific bytes). Beta target: scaffolding in **beta.1 / beta.1.5**, capture from **beta.2**, runs through **final**.

**Plans:** 5/5 plans complete

**Authority**: `.planning/phases/121-trajectory-telemetry/121-CONTEXT.md` (stub). Related seed: `.planning/seeds/SEED-002-agent-lightning-lab-loop.md`. Future consumption pattern: arXiv 2508.03680 (agent-lightning paper).


### Phase 121.5: Terminal Coherence Capstone (INSERTED — REGISTERED 2026-05-10, STUB, LAST PHASE BEFORE v1.13.0 FINAL RELEASE GATE)

**Goal:** Take everything v1.13.0 already built — Larry-by-default (114), the owned emotion (115), the tension hook (116), the auto-explore reward (117), the selector library (88.2), the context-aware renderer (102), the statusline broadcast (106), the JTBD engine (100/104), the MINTO surface plumbing (88.1) — and make the **Claude Code terminal** express it as ONE coherent product instead of N independently-shipped surfaces. Acknowledge first, plan second, ship third, then the gate. Eight sub-plans: (A) SessionStart Coordinator — single script, precedence ladder, hard token budget, ends the ~11-injector turn-1 flood that causes Larry's occasional session-start incoherence; (B) `body_shape:` frontmatter sweep across the ~47 undeclared commands + ship `output-styles/destijl.md` with `force-for-plugin: true` (system-prompt-level 4-zone enforcement, verified-real CC feature); (C) SKILL.md v2 reconciliation — add Shape F.0/F.6, fold in Phase 102's dual palette, resolve the `🎯` overload + "JTBD" word collision; (D) two-row statusline (identity row + situation row) + `references/visual/palette.json` as canonical De Stijl palette source-of-truth + wire `statusline-mos` as the canonical `settings.json` path; (E) render-v2 disposition decision + close Phase 102 with a VERIFICATION.md; (F) version-of-record stamp on every first-touch surface (SEED-007 absorption) + stale-copy scanner; (G) truth-telling + housekeeping — delete the stray empty `.planning/phases/40-hook-expansion/` dir, fix the Phase 88.7 ROADMAP "1/1 complete" lie, audit `context-monitor`'s active-phase mtime scan; (H) the coherence smoke test — fresh-install walk where a human reads the terminal at every step and can answer who/job/runway/next. This phase introduces NO new product surface — consolidation only (Canon Part 7). It is the precondition for the Canon Part 10 ratification at the final gate: if the terminal is incoherent, "conversation as the product" isn't demonstrated.

**Requirements**: TBD (COHERENCE-121.5-01..NN — defined when CONTEXT.md is expanded; five Open Design Decisions must be resolved with Jonathan before `/gsd:plan-phase 121.5`: the SessionStart precedence ladder, the combined token budget, palette keep-vs-rebrand, `🎯`/"JTBD" disambiguate-vs-document, render-v2 wire-vs-freeze).

**Depends on:** Phases 88.1, 88.2, 102, 104, 105, 106 (shipped); 114, 115, 116 (human-needed gates pending); 117 (shipped); 119 (final wave); 121 (spans beta.1→final). **Dependents:** the v1.13.0 FINAL RELEASE GATE (this is the last substantive work before it); Canon Part 10 ratification. Runtime ordering: runs AFTER 118/119/120/121, immediately BEFORE the FINAL RELEASE GATE.

**Canon parts:** Part 3 (UI Ruling System enforcement pass), Part 4 (coordinator decisions + compliance signals mirror to telemetry; no side-channel printing), Part 7 (consolidation only — any NEW file must REPLACE/reconcile N existing things), Part 8 (coordinator telemetry is local-only, scalar/enum/hash payloads only), Part 10 (the terminal must coherently express "conversation as the product" — precondition for ratification). Beta target: **v1.13.0 final** (last phase before the FINAL RELEASE GATE).

**Plans:** 10/10 plans complete

**Reference doc (TREAT AS REFERENCE, NOT SPEC):** `.planning/phases/121.5-terminal-coherence-capstone/121.5-REFERENCE-destijl-guide-annotated.md` — an external "De Stijl Full UI/UX Implementation Guide" verified against Claude Code docs 2026-05-10. ~1/3 buildable (output-style `force-for-plugin`, two-row statusline, the semantic vocabulary), ~1/3 regression (env-var-room-state via UserPromptSubmit hooks — the bridge file already exists for exactly this reason; skill-frontmatter SessionStart hooks), ~1/3 fabricated (custom theme JSON files, `statusLine.refreshInterval`). The annotated copy carries the verdicts inline.

**Authority**: `.planning/phases/121.5-terminal-coherence-capstone/121.5-CONTEXT.md` (stub, scaffolded 2026-05-10). Related seed: `.planning/seeds/SEED-007-version-dynamic-first-touch-greeting.md` (absorbed as sub-plan F). Audit provenance: three UI/UX audits + the parallel-research SessionStart-flood note, all 2026-05-10.


### Phase 122: Workflow Layer -- framework <-> command registry + reliable invocation (v1.13.0 beta.10 CAPSTONE, REGISTERED 2026-05-11)

**Goal:** Larry can read the Brain's methodology chains (`Framework -[:FEEDS_INTO]-> Framework`) but cannot reliably turn "the methodology suggests framework X" into "run `/mos:x`" -- the framework<->command mapping is not 1:1, some frameworks have no command, some commands run no single framework, and today Larry names commands from memory (and sometimes names one that doesn't exist, e.g. `/mos:jtbd` -- the real command is `/mos:analyze-needs`). Fix: the truth lives in ONE place (each command file's own `frameworks:` frontmatter), `data/command-registry.json` is generated from it + CI-checked (stale-registry OR unresolvable-framework fails the build), `lib/workflow/command-resolver.cjs` is the SOLE path from framework to command (Larry never emits a `/mos:` he didn't get back from the resolver -- kills the hallucinated-command failure mode), and the navigation engine (engine v1 `UserPromptSubmit` hook) gains a workflow-suggestion step (detect methodology intent -> `recommendFrameworkChain` via Brain `FEEDS_INTO` traversal -> `composeWorkflow` via the resolver -> surface the command sequence as `offer_next_step`). Degrade-don't-fabricate: framework with no command -> "run it manually"; no Brain -> registry still gives framework<->command; no registry -> framework-only advice. The Brain stays methodology-pure -- commands never enter it (Canon Part 8). 5 build sub-phases: (1) frontmatter contract + retrofit (the algorithmic command cohort -- HSI / whitespace / explore-domains / research+think-hats / rs-pipeline / find-* / diagnostics / scoring / systems / argument-structure -- retrofitted FIRST); (2) registry + generator + CI tripwire (mirror the Brain Phase-6 CI-01 pattern); (3) resolver + chain recommender; (4) wire `/mos:suggest-next` + `/mos:pipeline` + `/mos:act` + the `pws-methodology` / `brain-connector` skills + the navigation hook; (5) skill cleanup + `docs/COMMAND-FRONTMATTER.md` + `docs/WORKFLOWS.md` + end-to-end. The "what it leverages" section of the spec is a HARD requirement: build it knowing what all of v1.13.0 delivers (navigation engine, larry-default-activation, operator state machine, SQL graph + memory triple, persona, cascade hooks) so it makes maximal use of each.
**Requirements**: WORKFLOW-122-01, WORKFLOW-122-02, WORKFLOW-122-03, WORKFLOW-122-04, WORKFLOW-122-05, WORKFLOW-122-06, WORKFLOW-122-07, WORKFLOW-122-08, WORKFLOW-122-09, WORKFLOW-122-10, WORKFLOW-122-11 (derived 2026-05-12 from `.planning/WORKFLOW-LAYER-SPEC.md` acceptance criteria + the 5 reliability rules; see `.planning/REQUIREMENTS.md` -> `## Workflow Layer (WORKFLOW-122)`).
**Depends on:** Phase 121 (sequential placement) + the v1.13.0 surfaces it leverages (91/91.6 navigation engine, 114 larry-default-activation, 99 conversation-operator, 108/109 SQL graph + memory triple, 115 persona, 116/117 cascade hooks). **HARD DEP: brain-cleanup Phase 5** (enrichCausalEdges -> FEEDS_INTO rewrite, in the separate `~/gsd-workspaces/brain-cleanup/` workspace) -- needed for sub-phase 3 (resolver + chain recommender) ONLY; brain-cleanup Phase 4 is DONE; sub-phases 1, 2, 4-partial, 5-docs can start immediately.
**Authority:** `.planning/WORKFLOW-LAYER-SPEC.md` (spec-locked 2026-05-11). Target band: v1.13.0-beta.10 (the capstone, not a beta.2 bolt-on). brain-impact: NONE (100% plugin-side). Phase directory: `.planning/phases/122-workflow-layer/` (short leaf -- the full descriptive name lives here, not in the path, per the Phase 95.6 D-02 / REC-11 lesson about MAX_PATH).
**Plans:** 5/5 plans complete

Plans:
- [x] 122-01-PLAN.md -- Frontmatter contract + retrofit (algorithmic cohort first) + docs/COMMAND-FRONTMATTER.md + Wave-0 test scaffold (wave 1)
- [x] 122-02-PLAN.md -- Registry generator (scripts/build-command-registry.cjs) + data/command-registry.json + data/framework-names.json + the --check pre-commit drift tripwire (wave 2)
- [x] 122-03-PLAN.md -- lib/workflow/command-resolver.cjs (the only door) + lib/brain/chain-recommender.cjs (FEEDS_INTO traversal, reuse framework-chain-composer) (wave 3)
- [x] 122-04-PLAN.md -- Wire the navigation engine (the surgical edit) + /mos:suggest-next + /mos:pipeline --from-problem-type/--from-framework + /mos:act --chain + pws-methodology/brain-connector skill prose (wave 4)
- [x] 122-05-PLAN.md -- Prune the 3 hand-maintained maps + delete brain-connector Command-node prose + docs/WORKFLOWS.md + end-to-end test + Canon Part 8 grep sweep + CHANGELOG beta.10 finalization (wave 5)

### Phase 123: install-lifecycle harness

**Goal:** One install-state truth source so no actor improvises "what version is active, where it's installed, is the install consistent" -- the disease behind the 2026-05-12 Windows-test bug family (doctor crash, stale statusline, byte-stale deployed wrapper, `~/.mindrian-last-version` unknown, the version-number treadmill, hand-rolled releases). Five pieces: (1) `~/.mindrian/install-state.json` written by session-start, read by everyone (statusline / banner / `~/.mindrian-last-version` / `bin/cli.js` / doctor); (2) a deployment-surface manifest (the statusline shim, the `settings.json` statusLine block, the dev-clone pre-commit hook, the `~/.mindrian/*` state files) that session-start reconciles and doctor flags; (3) doctor as the contract checker with an exhaustive drift-class enumeration + `--fix`s + test fixtures -- absorbs **Bug 7** (treat marketplace-cache-only as a healthy topology, not drift); (4) `mindrian-os doctor --acceptance` as the scripted release gate (replaces the hand-run 5-test suite), wired into `release.sh`; (5) `release.sh` owning ALL version bumps incl. pre-releases (`beta.N -> beta.N+1`; it currently mangles pre-release versions, which is why beta.10-13 were hand-rolled), refusing on a dirty repo / pushing only the release commit (a Phase 109 docs commit hitchhiked into the beta.12 push), and fixing Step 9.5's stale `@mindrian_os/cli` name. Also absorbs cache pruning on update and the `@mindrian_os/cli` -> `@mindrian_os/install` doc/test sweep (`docs/install/PACKAGING-PATHS.md`, `tests/manual/95.6-windows-cold-install-acceptance.md`, `tests/test-release-npm-gate.sh`). Builds on what already shipped in v1.13.0-beta.12: `lib/core/active-plugin-root.cjs` (the one resolver) + `scripts/statusline-mos-dispatch` + the `scripts/session-start` Step A migration (the dumb dispatcher shim -- the deployment surface carries zero logic, a wrapper fix in vN+1 reaches users next session with no re-stamp). Spec: `docs/INSTALL-LIFECYCLE-HARNESS.md`. canon_parts: [5, 6] -- Canon Part 6 (dog-fooding: the plugin's install lifecycle must honor the plugin's canon) biting back, with Part 5's evidence-graded gate at the release boundary. Same *shape* as Part 9's memory constitution: a closed set of allowed mutations + a single enforcement chokepoint + human/CI confirmation.
**Requirements**: [HARNESS-123-01, HARNESS-123-02, HARNESS-123-03, HARNESS-123-04, HARNESS-123-05, HARNESS-123-06, HARNESS-123-07, HARNESS-123-08, HARNESS-123-09, HARNESS-123-10, HARNESS-123-11, HARNESS-123-12, HARNESS-123-13, HARNESS-123-14, HARNESS-123-15, HARNESS-123-16, HARNESS-123-17]
**Depends on:** Phase 122
**Plans:** 7/7 plans complete

Plans:
- [x] 123-01-PLAN.md -- scripts/release.sh overhaul: semver devDep + --prerelease/--finalize/--start-prerelease bump algebra + two-commit form + dirty-repo guard + Step 9.5 @mindrian_os/install rename (wave 1)
- [x] 123-02-PLAN.md -- install-state record (~/.mindrian/install-state.json, single writer in session-start) + data/deployment-surfaces.json manifest + lib/core/active-plugin-root.cjs topology extension (wave 2)
- [x] 123-03-PLAN.md -- doctor classes I + J + --install-state flag + aggressive --fix (legacy migration, installed_plugins.json repair) + Bug 7 fix + INSTALL_DIR repoint + per-class test fixtures (wave 3)
- [x] 123-04-PLAN.md -- mindrian-os doctor --acceptance (5-point + --pre-tag sub-mode, checklist runner, CALLS verify-release, mktemp npx sandbox) + release.sh Step 6.6 + Step 9.6 hard-abort gates + retire scripts/release-beta-smoke.sh (wave 4)
- [x] 123-05-PLAN.md -- lib/core/cache-prune.cjs (keep active + N=2, never the active, skip if installed_plugins.json unreadable) wired into session-start (on version change) + doctor --fix (unconditional) + the @mindrian_os/cli sweep + commands/setup.md:145 URL fix (wave 5)
- [x] 123-07-PLAN.md -- lib/core/resolve-brain-key.cjs (env -> ~/.mindrian.env -> CWD .env -> not-found; SEC-02 POSIX permission check) + 3 consumer rewirings (brain-client.cjs::getApiKey, session-start Brain status line, brain-connector SKILL.md step 0) + chmod 600 + Bearer-only docs (wave 6)
- [ ] 123-06-PLAN.md -- cut v1.13.0-beta.13 via the fixed release.sh + docs/CANON-PHASE-MAP.md Part 6 + Part 7 rows + Windows operator manual --acceptance checkpoint gating promotion to clean 1.13.0 (wave 7)

### Phase 124: FEYNMAN.md temporal awareness (REGISTERED 2026-05-13 - STUB)

**Goal:** Make `FEYNMAN.md` aware of when its insights were captured, last touched, and whether they've gone stale -- by appending a hook-regenerated `## Timeline (auto)` section to each `FEYNMAN.md` that reads from the Phase 109 `memory_event` log (`navigation.findRecentChanges` + `navigation.findStaleDecisions` + a "first-captured / last-touched" projection per insight). The human-authored body of `FEYNMAN.md` stays text-pure; the appended section is the machine view -- regenerated on file write, never hand-edited. Canon Part 9 alignment: "Files preserve meaning. SQL remembers and navigates. Brain reasons. Larry explains." -- this is the Larry-explains face of `memory_event`. Out of scope: per-insight inline timestamps in the body (Option A); a sibling TIMELINE.md file (Option D); back-dating SQL events from existing FEYNMAN.md body parse. Discussion 2026-05-13 picked Option B (auto-section); A/D considered and rejected.
**Requirements**: TEMPORAL-124-01..10 (registered 2026-05-13 -- see .planning/REQUIREMENTS.md "## FEYNMAN.md Temporal Awareness (TEMPORAL-124)")
**Depends on:** Phase 88 (memory triple: ROOM.md / MINTO.md / FEYNMAN.md), Phase 90 (BRAIN.md quadruple), Phase 109 (memory_event log + findRecentChanges + findStaleDecisions + navigation.cjs chokepoint)
**Target band:** v1.13.0-final or v1.14.0 (decide in plan-phase based on whether the auto-section format is judged backwards-compatible with existing FEYNMAN.md consumers)
**Canon parts:** Part 9 (Memory Locality -- the Larry-explains face), Part 5 (Evidence is graded by context -- "stale" surfaces as a context signal alongside the existing tier)
**Plans:** 5/5 plans complete

Plans:
- [x] 124-00-PLAN.md - Wave 0 substrate (register TEMPORAL-124-01..10 in REQUIREMENTS.md + ROADMAP; 4 RED test stubs; tests/run-all-124.sh; Feynman-runner registration; lib/core/feynman/ROOM.md)
- [x] 124-01-PLAN.md - Wave 1 renderer (lib/core/feynman/timeline-renderer.cjs pure function; D-05 template literal; D-06 thresholds; D-08 section scoping via navigation.cjs; firstCapturedLastTouchedBySection primitive; fill test-feynman-timeline-renderer.cjs + test-feynman-timeline-empty-state.cjs)
- [x] 124-02-PLAN.md - Wave 1 runner (lib/core/feynman/timeline-runner.cjs refreshAll + refreshSection; sentinel-bounded merge; body byte-preserved; timeline_last_rendered watermark; EVENT_TYPES +2 in memory-events.cjs; fill test-feynman-timeline-runner.cjs)
- [x] 124-03-PLAN.md - Wave 2 wiring (session-start cascade slot after cache-prune; commands/feynman-timeline-refresh.md per Phase 122 + Phase 104 frontmatter contract; scripts/feynman-timeline-refresh-command.cjs argv parser; data/command-registry.json regenerated; pre-commit hook passes)
- [x] 124-04-PLAN.md - Wave 3 Canon Part 9 invariant + docs (fill test-feynman-timeline-canon-part-9-invariant.cjs; docs/CANON-PHASE-MAP.md Part 9 row shipped for Phase 124; docs/MINDRIAN-CANON.md Part 9 implementing-phase cross-reference)

### Phase 125: F-Selector Ranker (DESIGN-LOCKED 2026-05-13 + adaptive-questioning lens pass 2)

**Goal:** Ship the ranker that turns the existing framework chain (Brain) + command registry (Phase 122) + JTBD content (Phase 104) + packet enrichment (Phase 110) into a top-K ranked next-move list for F-shape selector consumption. Plus the Phase 110 packet extension carrying the framework chain slice. Plus a continuous-gradient cold-start that does NOT abandon new users. Plus the interaction-loop semantics (D7 reject/defer-as-typed-edge + decay-weight, D8 none-fit affordance + ranker-miss capture, D9 investment-aware 'why' content, D10 callable/trigger split, D11 Phase 104 ships teaching field) that make the F-selector the user-facing adaptive-questioning analogue of /gsd:discuss-phase.
**Requirements**: [RANKER-125-01..NN -- defined in plan-phase]
**Depends on:** Phase 122 (command-registry + command-resolver, shipped v1.13.0-beta.11); Phase 122-03 (chain-recommender, shipped); Phase 110 (Brain Context Packet, shipped); Phase 109 (memory_event log + navigation.cjs chokepoint, shipped); Phase 88 + 90 (BRAIN.md / MINTO.md / FEYNMAN.md memory triple/quadruple, shipped); Phase 104 (per-command JTBD content layer + new `teaching` field, IN FLIGHT)
**Dependents:** Phase 116 (tension hook surfacing -- consumes ranker output for findings PULL mode); Phase 117 (auto-explore -- consumes ranker for PUSH mode at decision gates)
**Target band:** v1.13.0-beta.14 (per Path E reordering 2026-05-13: Phase 125 ships beta.14 BEFORE Phase 126 install-lifecycle-harness-gaps beta.15, because Step 0 tag-push was already at origin so install hardening is no longer a blocker for testers; ranker's "intelligent Brain-using" payoff lands 1 week sooner)
**Canon parts:** Part 3 (F-shape selector contract -- F.0 accept / F.1 defer / F.2 reject triad + none-fit affordance); Part 4 (every choice is graph data -- reject/defer emit typed cascade edges); Part 7 (Reuse over build -- ranker sits above shipped resolver, recommender, packet); Part 9 (SQL navigates via local graph + Brain packets as structured context surface; writes route through navigation.cjs chokepoint)
**Brain impact:** READ-ONLY (1-3 hop FEEDS_INTO Cypher slice; no Brain writes)
**Requirements:** RANKER-125-00, RANKER-125-01, RANKER-125-02, RANKER-125-03, RANKER-125-04, RANKER-125-05, RANKER-125-06, RANKER-125-07, RANKER-125-08, RANKER-125-09, RANKER-125-10, RANKER-125-11, RANKER-125-12
**Plans:** 9/9 plans complete

Plans:
- [x] 125-00-PLAN.md -- navigation.cjs writeEdge primitive (15th re-export; Pass 3 GAP-2 resolution; precedent: Phase 110-03 logMemoryEvent additive) [D7 extension] [wave 0]
- [x] 125-01-PLAN.md -- navigation.resolveActiveFrameworks + resolveHopDepth + computeInvestmentLevel projection helpers + framework_invoked EVENT_TYPES extension [D1, D2, D3] [wave 1]
- [x] 125-02-PLAN.md -- Brain Cypher slice query (parameterized 1-3 hop FEEDS_INTO, LIMIT 50, sanitized) via lib/brain/framework-chain-slice.cjs [D2 + Canon Part 8] [wave 1]
- [x] 125-03-PLAN.md -- buildBrainPacket extension: framework_chain_hint in local_graph_summary (conditional on active set non-empty) [D4] [wave 2]
- [x] 125-04-PLAN.md -- Schema superset + ajv validator integration (additionalProperties:false preserved; 12-job D-02 untouched) [D4 + schema invariant] [wave 1]
- [x] 125-05-PLAN.md -- f-selector-ranker.cjs: rankForSelector + selectWhyContent + render badges (D4 continuous-gradient scoring + D9 investment-aware why + D7 decay integration via opts injection) [D4, D6, D9, D10] [wave 3]
- [ ] 125-06-PLAN.md -- selector-decisions.cjs: recordSelectorDecision + applyDecayWeight + shouldExclude + f_selector_decision event_type (REJECTED/DEFERRED edge writes via Plan 00 writeEdge chokepoint) [D7] [wave 3]
- [ ] 125-07-PLAN.md -- D8 none-fit: recordSelectorMiss + renderNoneFitAffordance + f_selector_miss event_type (memory_event-only; no edge; user_intent LOCAL-only per Canon Part 8) [D8] [wave 3]
- [ ] 125-08-PLAN.md -- Documentation: F-SELECTOR-CONSUMER-GUIDE.md + WORKFLOW-LAYER-SPEC + docs/WORKFLOWS update + tests/run-all-125.sh aggregator + Feynman runner registration [D7-D11 + RANKER-125-12] [wave 4]

### Phase 126: install-lifecycle-harness-gaps

**Goal:** Close the install-lifecycle gaps that surfaced via the 2026-05-13 Windows dogfood after Phase 123 shipped its harness in v1.13.0-beta.13. Closes 4 concrete dogfood findings + adds acceptance-gate self-coverage + release.sh release-pipeline hardening (Step 5.5 tag-push verification + HARD install-minisite lockstep + Step 9.7 npx-publish self-test) + install-state.json schema v1 -> v2 migration + 1-page install-cache family pre-mortem doc. Ships as v1.13.0-beta.15 (Path E).
**Requirements**: (none mapped at the requirement-ID layer; plans trace to CONTEXT.md Step 0 + Plans 01-07 + Doc deliverables + the 9-item Nyquist UAT acceptance criteria block)
**Depends on:** Phase 125 (F-Selector Ranker, shipped v1.13.0-beta.14); Phase 123 (install-lifecycle-harness substrate, shipped v1.13.0-beta.13); Phase 95.2 (atomic-swap contract, shipped); Phase 95.1 (doctor command surface, shipped)
**Dependents:** Phase 127 (Brain MCP stdio shim, scope-locked 2026-05-14) -- ships AS v1.13.1-beta.1 after v1.13.0 final; Phase 121.5 terminal-coherence capstone -- final v1.13.0 beta
**Plans:** 8/7 plans complete

Plans:
- [x] 126-01-fix-renderer-contract-PLAN.md -- --fix renderer contract test + fix (wave 1)
- [x] 126-02-marketplace-cache-prerelease-semver-PLAN.md -- marketplace-cache prerelease semver-pick fix using semver@^7.7.4 (wave 1)
- [x] 126-03-acceptance-gate-self-coverage-PLAN.md -- 5-fixture acceptance-gate self-coverage; wires last_acceptance_run write into install-state v2 (wave 2, depends on Plan 07)
- [x] 126-04-release-pipeline-hardening-PLAN.md -- release.sh Step 5.5 tag-push verify + HARD Step 9.6 install-minisite lockstep + Step 9.7 npx-publish self-test + Step 9.8 (renamed from old 9.6 doctor --acceptance full) + --no-minisite opt-out + docs/install-cache-family-premortem.md (wave 3, depends on Plans 03 + 05) -- closed deferred-items.md acc.5 entry
- [x] 126-05-release-flight-preflight-in-acceptance-PLAN.md -- absorb 5 Phase 123 cut hot-patches as doctor --acceptance checklist entries (wave 2, depends on Plan 03)
- [x] 126-06-cache-prune-extension-PLAN.md -- stale-backup prune extension (30-day window via MOS_CACHE_PRUNE_AGE_DAYS) (wave 1)
- [x] 126-07-install-state-schema-v2-migration-PLAN.md -- install-state.json schema v2 + additive migration + future-version detection (wave 2 head)
- [x] 126-STEP-0-MANUAL-RECOVERY.md -- doc: reproducible manual recovery commands (tag verify + optional retroactive npm publish); v1.13.0-beta.13 git tag already verified at origin 2026-05-13

### Phase 126.1: Windows Installer PATH Check (spawn shell:true hotfix) (INSERTED 2026-05-24, residual case #7 in the install-cache family; sibling to Phase 127.3 -- both ride v1.13.0-beta.33)

**Goal:** Patch the one-line bug in `bin/cli.js:82` that makes `npx @mindrian_os/install` falsely report "Claude Code is not installed" on native Windows PowerShell + cmd.exe even when `claude` IS installed and works in the same shell. Root cause: `child_process.spawnSync('claude', ['--version'], { stdio: 'ignore' })` without `{ shell: true }` does NOT consult Windows's `PATHEXT` env var, so Node fails to find `claude.cmd` (the npm-installed Windows shim) while the shell DOES find it -- two interpretations of the same PATH disagreeing. PRIMARY: add `shell: true` to the spawn call (one option flag, zero new deps; the npm `which` package and platform-branching alternatives were considered and rejected on parsimony grounds per CONTEXT.md D-01). SECONDARY: add `tests/test-require-claude-cli.cjs` that asserts the call site passes `shell: true` (mock + real-spawn assertions on a known-good binary) -- structural prevention so a future refactor that removes the flag fails CI before shipping. TERTIARY (best-effort): add `windows-latest` matrix entry to `.github/workflows/ci.yml`; defers to Phase 126.2 if it surfaces unrelated test failures (per CONTEXT.md D-02). TERTIARY+ (soft): update `~/mindrianos-install-site/` Windows section to set accurate expectations as a one-line minisite update during the beta.33 release ceremony.

**Requirements**: (none mapped at the requirement-ID layer; plans trace to CONTEXT.md acceptance criteria 1-5 + the 4-fix scope + the 4 non-code follow-ups in the RCA)

**Depends on:** Phase 123 install-lifecycle-harness (shipped v1.13.0-beta.13 -- introduced the `requireClaudeCli()` function this hotfix patches); Phase 126 install-lifecycle-harness-gaps (shipped v1.13.0-beta.15 -- closed 4 other Windows dogfood findings but did NOT touch the PATH check; this is the residual)

**Dependents:** Future Windows tester onboarding (every tester on native PowerShell hits this gate today); install minisite Windows track (deferred Fix 3+; sets accurate expectations on the page until CI runner lands)

**Target band:** v1.13.0-beta.33 -- ships alongside Phase 127.3 (jtbd-auto-anchor-fix) per Jonathan's 2026-05-24 "needs to ship next beta with memory fix" decision. Two independent P0 hotfixes ride the same beta cut because (a) both are silent-failure regressions affecting real testers in different surfaces (memory layer vs install path) and (b) they touch disjoint files (`scripts/jtbd-update.cjs` vs `bin/cli.js`) with zero merge risk. The 7-place release lockstep (CHANGELOG, plugin.json, root package.json, packages/npm-installer/package.json, git tag, marketplace.json source.ref, install minisite version strings per `feedback_install_minisite_lockstep.md`) runs once for the combined cut.

**Canon parts:** Part 6 (dog-fooding mandate -- a Wave-2 Windows tester surfaced this 2026-05-17 and re-pinged 2026-05-24 before discovery; CI has no Windows runner so it slipped past Phase 123 + 126 ship gates; the install path IS part of the venture surface); Part 7 (reuse-before-build -- fix is one option flag on an existing `spawnSync` call; zero new abstractions; zero new dependencies).

**Brain impact:** NONE (zero Brain reads, zero Brain writes; `bin/cli.js` is LOCAL-only per Canon Part 8).

**Status:** Scoped -- ready for `/gsd:plan-phase 126.1` to expand the skeleton in `126.1-CONTEXT.md` into per-sub-plan PLAN files. Expected ~3 plan files (126.1-01 bin/cli.js shell:true patch, 126.1-02 test coverage + grep-sweep of other spawn call sites, 126.1-03 windows-latest CI matrix best-effort).

**Plans:** 0/3 executed (skeleton only)
- [ ] **Plan 126.1-01 (Wave 0)** -- One-line patch to `bin/cli.js:82` adding `{ shell: true }` to the spawnSync call; reproduction commands + before/after smoke test on Linux runner
- [ ] **Plan 126.1-02 (Wave 1, parallel to 03)** -- NEW `tests/test-require-claude-cli.cjs` with mock + real-spawn assertions; `git grep` audit of every other `spawnSync`/`spawn`/`exec*` call site for the same bug class (file any new finding under Phase 126.2)
- [ ] **Plan 126.1-03 (Wave 1, parallel to 02, BEST-EFFORT)** -- Add `windows-latest` matrix entry to `.github/workflows/ci.yml`; defers to Phase 126.2 if it surfaces unrelated Windows-CI test failures; also update `docs/install-cache-family-premortem.md` with case #7 row + "cross-platform PATH resolution disagreement between shell and Node" pattern entry

**Authority:** `.planning/phases/126.1-windows-installer-path-check/126.1-CONTEXT.md` (scoped 2026-05-24) + `.planning/debug/windows-installer-spawn-shell-false.md` (RCA, source of truth for fix content + reproduction protocol) + `docs/testers/outbox/2026-05-24-rea-native-windows-fix.md` (Wave-2 tester archive: screenshot transcription + email drafts v1-v4 + calendar holds; gitignored).

### Phase 127: Brain MCP Local Stdio Shim + Auto-Migration (PROMOTED 2026-05-19 from v1.13.1-beta.1 INTO v1.13.0-beta.20 -- ARCHITECTURAL ANCHOR)

**Goal:** Ship `bin/mindrian-brain-mcp-client.cjs` -- a local stdio MCP server bundled with the plugin -- and add it to the plugin's `.mcp.json` so every new install gets `mindrian-brain` auto-loaded with ZERO user wiring beyond providing `MINDRIAN_BRAIN_KEY` in env / `~/.mindrian.env`. The shim proxies tool calls to the cloud Brain (the methodology director) and consumes the new `DirectiveEnvelope` typed packet (default mode: GUIDED). Includes auto-migration that detects existing testers' user-scope HTTP-transport registrations and replaces them with the bundled stdio version on next plugin update. Closes 7 of 20 Brain-wiring failure-mode taxonomy rows. Architectural anchor of v1.13.1: every Part 10 phase after this point ASSUMES Brain works.

**Requirements**: BRAIN-MCP-127-01 (stdio shim 6-tool wrapper), 127-02 (.mcp.json ${CLAUDE_PLUGIN_ROOT} pattern), 127-03 (DirectiveEnvelope GUIDED-default 6-signal selector), 127-04 (auto-migration script + --dry-run SG-3), 127-05 (SG-1 HARD INVARIANT no ~/.claude.json writes), 127-06 (SG-2 pre-migration snapshot 0o600), 127-07 (SG-4 sha256 idempotency log), 127-08 (Doctor Class M 5-layer Brain smoke), 127-09 (Tier-0 messaging chokepoint), 127-10 (acceptance harness + Part 8 adversarial audit + capability map + BRAIN-SETUP rewrite). See `.planning/REQUIREMENTS.md` "Brain MCP Local Stdio Shim + Auto-Migration (BRAIN-MCP-127)" section for full descriptions.

**Depends on:** Phase 110 (Brain Context Packet contract -- the typed-packet wire this shim's tool calls travel through, shipped); Phase 123 (install-lifecycle-harness -- the resolver chain + key resolver this shim consumes, shipped); Phase 126 (install-lifecycle-harness-gaps -- the parallel hotfix track for residual install + doctor gaps, shipped v1.13.0-beta.16); v1.13.0-beta.19 bundle shipped (118+119+120+121+121.5-fix + promotion bookkeeping).

**Dependents:** Phase 127.1 (Brain GraphRAG Collapse: Pinecone -> Neo4j HNSW -- server-side substrate swap riding immediately after this beta cut, v1.13.0-beta.21); Phase 128 (substrate-contract-adr -- now v1.13.1-beta.1); Phase 129 (spine-repair-memory-event -- now v1.13.1-beta.1); every subsequent v1.13.1 phase that assumes Brain reachability.

**Target band:** v1.13.0-beta.20 (PROMOTED 2026-05-19; v1.13.0 redefined from "The Closed Loop" to "The Closed Loop + Brain Goes Native"; ships immediately after v1.13.0-beta.19 bundle of phases 118+119+120+121+121.5-fix + promotion bookkeeping)

**Canon parts:** Part 6 (dog-fooding mandate -- Brain wiring failures caught by real tester transcripts, not synthetic tests); Part 7 (reuse-before-build -- ~85% reuse of `lib/core/brain-client.cjs` HTTPS path; the new shim is a thin stdio wrapper around shipped HTTPS code); Part 8 (graph boundary -- the local shim does NOT change LOCAL-to-BRAIN; the shim still proxies via the typed-packet contract; user-data egress remains forbidden).

**Brain impact:** NONE-NEW (the shim's tool surface is identical to what the remote MCP server already exposes; no new Brain reads, no new Brain writes)

**Plans:** 3/4 plans executed
- [ ] **Plan 127-00 (Wave 1)** -- stdio shim + DirectiveEnvelope + .mcp.json (covers BRAIN-MCP-127-01, 02, 03)
- [ ] **Plan 127-01 (Wave 2)** -- auto-migration + 4 safety guards SG-1..SG-4 (covers BRAIN-MCP-127-04, 05, 06, 07)
- [ ] **Plan 127-02 (Wave 3, parallel)** -- Doctor Class M Brain smoke + Tier-0 chokepoint (covers BRAIN-MCP-127-08, 09)
- [ ] **Plan 127-03 (Wave 3, parallel)** -- acceptance harness + Canon Part 8 adversarial audit + capability map + BRAIN-SETUP rewrite (covers BRAIN-MCP-127-10)

Notable rename: CONTEXT "Class K" -> "Class M" because K is taken by `--stale-first-touch`.

**Authority:** `.planning/phases/127-brain-mcp-local-stdio-shim/127-CONTEXT.md` (scoped 2026-05-14; design-locked) + `.planning/v1.13.1-EXECUTION-PLAN.md` "WAVE 2 (CRITICAL -- the Brain MCP architectural shift; architectural unlock)" block (wave-2 architectural anchor; ships v1.13.1-beta.1; deduplicated 2026-05-16 per ultrareview bug_001 + bug_019)

### Phase 127.2: Brain warmup ping -- hide MCP cold-start latency inside Larry's first-question render window (sibling to Phase 127 stdio shim, v1.13.1-beta.2 own gate) (INSERTED)

**Goal:** [Urgent work - to be planned]
**Requirements**: TBD
**Depends on:** Phase 127
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 127.2 to break down)

### Phase 127.3: JTBD Auto-Anchor Silent-Failure Fix (registry-shape contract drift + chokepoint extraction + room bootstrap + first-touch nudge) (INSERTED 2026-05-24, hotfix sibling to Phase 127.2)

**Goal:** Land a three-defect fix for the JTBD memory pipeline that has been silently dead in every plugin release since v1.11.x (commit fcbbcf9a, 2026-04-26). PRIMARY: patch `scripts/jtbd-update.cjs:65-79` `resolveActiveRoom()` to tolerate both registry shapes (legacy `active_room` + Array `rooms` AND current `active` + Object `rooms`). SECONDARY: extract `lib/core/resolve-active-room.cjs` as the Canon-Part-7 shared chokepoint that three sibling scripts (jtbd-update, intent-classifier, across-session-memory) consolidate against -- sets up Phase 129 to absorb the other 6 spine scripts onto the same helper. TERTIARY: bootstrap fix in `scripts/room-registry create` to seed USER.md / STATE.md / ROOM.md / `.mindrian/` directory (without seeding state files -- absent-file is correctly handled and writing empties would mask legitimate first-write events). TERTIARY+: first-touch JTBD nudge for empty-state rooms < 7 days old, closing the resumption-only gap in memory-resume-nudge.cjs.

**Requirements**: JTBD-AUTO-ANCHOR-127.3-01 (chokepoint extraction `lib/core/resolve-active-room.cjs`), -02 (jtbd-update.cjs refactor), -03 (intent-classifier.cjs reroute through chokepoint), -04 (sibling-sweep tripwire + any sibling patches found), -05 (room-registry create bootstrap fix: USER.md / STATE.md / ROOM.md / `.mindrian/`), -06 (first-touch JTBD nudge), -07 (empirical reproduction test suite per RCA), -08 (RCA closeout to `.planning/debug/resolved/` + knowledge-base entry + CHANGELOG bullets).

**Depends on:** Phase 109 sql-context-memory-navigation-spine (shipped -- the chokepoint pattern this fix's helper extracts toward); Phase 100 jtbd-inference-engine (shipped -- the classifier this unblocks; classifier itself is correct, just never gets called because resolveActiveRoom() returns null).

**Dependents:** Phase 116 unresolved-tension-hook (consumer of in_flight JTBD evidence); Phase 118 30-second-mva (reads JTBD context for MVA framing); Phase 129 spine-repair-memory-event (canonical home for the chokepoint helper -- 129 absorbs the OTHER 6 spine scripts onto the SAME `lib/core/resolve-active-room.cjs` helper after this lands).

**Target band:** v1.13.0-beta.33 (the in-progress beta with no other plans committed; CHANGELOG `## [Unreleased]` header is empty). Hotfix sibling to Phase 127.2 cluster in the v1.13.0 endgame. Per `.planning/v1.13.1-EXECUTION-PLAN.md` Wave 4 Stream F, Phase 129 spine-repair is the canonical long-term venue -- but 129 ships v1.13.1-beta.3 (weeks out) and this bug has been silent for 7 months. 127.3 lands the load-bearing slice + the shared helper NOW; Phase 129 absorbs the remaining 6 spine scripts onto the helper later. NO conflict with EXECUTION-PLAN -- this hotfix lands the infrastructure Phase 129 reuses.

**Canon parts:** Part 4 (every choice is graph data -- JTBD transitions ARE choices the broken pipeline has been silently discarding); Part 7 (reuse-before-build -- the bug IS a Canon Part 7 violation; three sibling scripts each implement their own registry-resolution); Part 9 (memory locality and interpretation -- JTBD evidence is load-bearing local memory; jtbd-update.cjs IS a navigation-spine script that bypasses navigation.cjs).

**Brain impact:** NONE (LOCAL-only fix; zero Brain calls added; the JTBD pipeline is pure LOCAL per Canon Part 8).

**Status:** Scoped -- ready for `/gsd:plan-phase 127.3` to expand the skeleton in `127.3-PLAN.md` into per-sub-plan PLAN files following the 127.2-04-PLAN.md pattern.

**Plans:** 4/8 plans executed
- [ ] **Plan 127.3-00 (Wave 0)** -- Extract `lib/core/resolve-active-room.cjs` chokepoint + unit tests against both registry shapes
- [ ] **Plan 127.3-01 (Wave 1)** -- Refactor jtbd-update.cjs to use the chokepoint; reroute intent-classifier.cjs through canonical-single-source
- [ ] **Plan 127.3-02 (Wave 1, parallel)** -- Sibling sweep + `tests/test-no-broken-registry-resolution.sh` CI tripwire
- [ ] **Plan 127.3-03 (Wave 1, parallel)** -- Room bootstrap fix in `scripts/room-registry create` (seed USER.md / STATE.md / ROOM.md / `.mindrian/`)
- [ ] **Plan 127.3-04 (Wave 2)** -- First-touch JTBD nudge for empty-state rooms < 7 days
- [ ] **Plan 127.3-05 (Wave 2, parallel)** -- Verification test suite per RCA's 6-step reproduction protocol + `tests/run-all-127.3.sh` aggregator
- [ ] **Plan 127.3-06 (Wave 3)** -- RCA closeout (move to `.planning/debug/resolved/`); knowledge-base.md entry; CHANGELOG; optional `scripts/doctor.cjs --check-jtbd` probe (defers to Phase 129 if scope pressure)

**Authority:** `.planning/phases/127.3-jtbd-auto-anchor-fix/127.3-CONTEXT.md` (scoped 2026-05-24) + `.planning/debug/jtbd-auto-anchor-silent-failure/jtbd-auto-anchor-silent-failure.md` (RCA, the source of truth for fix content) + `.planning/v1.13.1-EXECUTION-PLAN.md` (hotfix slot reasoning: Wave 2/3 v1.13.0 endgame).

### Phase 127.1: Brain GraphRAG Collapse: Pinecone -> Neo4j HNSW (server-side substrate swap) (PROMOTED 2026-05-19 from v1.13.1-beta.2 INTO v1.13.0-beta.21)

**Goal:** Collapse the dual-substrate Brain GraphRAG (Neo4j 21K nodes + Pinecone 1,427 embeddings) into Neo4j-only by migrating embeddings to a native Neo4j 5.11+ HNSW vector index. The audit at `.planning/research/navigation-engine-brain-interface.md` Section 3.2 confirmed Pattern B (graph-first-then-vector-rerank) and Pinecone is NOT load-bearing -- Pattern #8 fuzzy-match is the only Pinecone-dispatched query in the 14-pattern brain-query taxonomy. Removing Pinecone deletes a vestigial substrate, eliminates ~3 hrs/quarter onboarding overhead, removes one failure-mode row from the gsd-debugger taxonomy, and unifies the methodology graph under one substrate. Server-side only (the `mindrian-brain` Render service); zero client-side surface change -- testers continue calling `brain_search_semantic` and the 14 Cypher patterns by identical tool names.

**The four-lock non-demotion protocol (all required, harness blocks cutover):**
1. **Byte-identical embeddings.** Export all 1,427 float arrays from Pinecone with node IDs; load as vector property on the corresponding Neo4j nodes. Do NOT re-embed.
2. **Same embedding model going forward.** Lock `multilingual-e5-large` (1024 dims) in mindrian-brain server config; any new node embedded with the same model.
3. **Same similarity metric.** Explicit cosine on Neo4j vector index: `CREATE VECTOR INDEX ... OPTIONS { indexConfig: { 'vector.similarity_function': 'cosine' }}`. A silent default to Euclidean would re-rank everything.
4. **Non-regression harness (BLOCKING SUB-TASK).** 20 representative fuzzy queries run pre-cutover against both engines. Top-5 overlap >= 80% required to flip. Below 80% -> tune HNSW params (`m`, `ef_construction`) before flipping.

**Requirements**: GRAPHRAG-COLLAPSE-127.1-01 (Surface 1 harness), 127.1-02 (Surface 2 harness), 127.1-03 (Surface 3 harness BLOCKING), 127.1-04 (20-query corpus), 127.1-05 (run-all-127.sh extended), 127.1-06 (Pinecone export script byte-identical), 127.1-07 (embedding manifest fixture GREEN), 127.1-08 (Lock 1 + Lock 2 enforcement), 127.1-09 (Neo4j vector index dim=1024 + cosine), 127.1-10 (1,427 vectors loaded round-trip verified), 127.1-11 (brain-vector-search.cjs server-side library), 127.1-12 (Surface 2 harness GREEN), 127.1-13 (Surface 3 BLOCKING cutover gate), 127.1-14 (server-side router flip with USE_NEO4J_VECTOR), 127.1-15 (feature flag reversible without redeploy), 127.1-16 (brain_search API boundary unchanged), 127.1-17 (divergence log captured), 127.1-18 (divergence-log review confirms zero anomalies), 127.1-19 (Pinecone vector-storage retired from mcp-server-brain), 127.1-20 (PINECONE_INDEX + USE_NEO4J_VECTOR env vars removed), 127.1-21 (server-facing docs stripped), 127.1-22 (7 gsd-debugger failure modes closed). See per-plan PLAN.md files in `.planning/phases/127.1-brain-graphrag-collapse-pinecone-neo4j-hnsw-server-side-substrate-swap/` for descriptions.

**Depends on:** Phase 127 brain-mcp-local-stdio-shim (ships v1.13.0-beta.20 immediately before this phase's beta.21 cut; client-side stdio shim and server-side substrate swap are orthogonal surfaces sharing the v1.13.0 architectural-shift window). v1.13.0-beta.19 bundle (phases 118+119+120+121+121.5-fix + promotion bookkeeping) is the predecessor beta cut.

**Dependents:** v1.14.0 phases that assume the methodology graph is single-substrate (deferred lens-engine work P9/P10/P11/P13-remainder; GraphRAG retrieval phases; deferred Pinecone-Tier-0.5-offline candidates which are now obviated by Neo4j-only architecture).

**Target band:** v1.13.1-beta.2 (rides immediately after Phase 127 = beta.1; before Phase 128 substrate-contract-adr = beta.3)

**Canon parts:** Part 7 (reuse-before-build -- Neo4j 5.11+ already ships HNSW; building Pinecone wiring around it is the orphaned substrate this phase deletes); Part 8 (graph boundary -- the substrate swap is internal to the Brain side; LOCAL-to-BRAIN egress contract unchanged; no new user-content surface); Part 9 (memory locality + interpretation -- Brain reasons over structured packets; this phase changes the vector substrate Brain reasons OVER, not the contract Brain reasons UNDER).

**Brain impact:** SERVER-SIDE SUBSTRATE SWAP (removes Pinecone client + API key from `mindrian-brain` Render env vars; adds Neo4j vector index + load script; tool surface `brain_search_semantic` + 14 Cypher patterns unchanged at API boundary)

**Plans:** 4/5 plans executed

**Authority:** `.planning/phases/127.1-brain-graphrag-collapse-pinecone-neo4j-hnsw-server-side-substrate-swap/127.1-CONTEXT.md` (scoped 2026-05-16 from this conversation) + `.planning/research/navigation-engine-brain-interface.md` Section 3.2 (Pattern B audit confirming Pinecone is not load-bearing) + `.planning/v1.13.1-EXECUTION-PLAN.md` "WAVE 2" block (wave-2 v1.13.1-beta.1 anchor; this rides at beta.2 between 127 and 128)

Plans:
- [x] 127.1-00-PLAN.md (Wave 0) -- Scaffold 4 Validation Architecture surfaces: 3 harness .test.cjs files + 20-query corpus JSON + run-all-127.sh aggregator extension + Feynman runner registration (covers 127.1-01..05)
- [x] 127.1-01-PLAN.md (Wave 1, parallel) -- Pinecone export script + 1,427-vector byte-identical NDJSON dump + SHA256 manifest fixture; Surface 1 GREEN; mcp-server-brain/CLAUDE.md operator note (covers 127.1-06..08)
- [x] 127.1-02-PLAN.md (Wave 1, parallel) -- Neo4j vector-index DDL (mindrian_methodology_vec, dim=1024, cosine) + loader script + brain-vector-search.cjs server-side library + Surface 2 GREEN + round-trip integrity verification (covers 127.1-09..12)
- [x] 127.1-03-PLAN.md (Wave 2, CUTOVER, has checkpoint) -- Surface 3 BLOCKING harness GREEN (top-5 overlap >= 0.80) gates the server-side router flip from Pinecone to Neo4j HNSW; USE_NEO4J_VECTOR feature flag; shadow-mode divergence log; Pinecone fallback retained for one beta cycle per RESEARCH X2 (covers 127.1-13..17)
- [ ] 127.1-04-PLAN.md (Wave 3, CLEANUP, has checkpoint) -- Divergence-log review + Pinecone vector-storage removal + Render env-var cleanup + server-facing doc strip + 7 gsd-debugger failure modes closed (covers 127.1-18..22)
- [x] 127.1-05-PLAN.md (Wave 1, SOAK-INDEPENDENT, scope addition 2026-05-20) -- Brain-query moat guard: D-MOAT-1 brain_query admin gate + D-MOAT-2 Cypher execution safeguards (EXPLAIN estimated-row reject / row cap / byte cap / read timeout), both SHIPPED v1.13.0-beta.21; D-MOAT-4 Aura tier confirmed (Aura Free); D-MOAT-3 scoped neo4j_reader credential DEFERRED (Aura Free has no RBAC -- needs Aura Professional or a parameterized-query surface) (covers GRAPHRAG-COLLAPSE-127.1-23..27)

---

## v1.13.1 phases (registered as directories + scoped in v1.13.1-EXECUTION-PLAN.md; synced into ROADMAP.md 2026-05-20)

> These five phases were scoped as phase directories with CONTEXT.md files on 2026-05-16 / 2026-05-17 (the "Synthesis-Plan Absorption" + the 2026-05-17 dogfooding-curation session) but were never written into ROADMAP.md as headings. The canonical sequence and wave assignment live in `.planning/v1.13.1-EXECUTION-PLAN.md`. This block syncs ROADMAP.md to disk so the phase sequence is navigable from one file.

### Phase 128: Substrate Contract ADR + CI Guards (v1.13.1 — SCOPED 2026-05-16)

**Goal:** Codify the four-substrate split (Local SQLite via navigation.cjs / Aura Neo4j / Brain MCP / Pinecone) as a binding architectural decision record at `docs/architecture/SUBSTRATE-CONTRACT.md`, and ship CI guards (`scripts/check-substrate.cjs`) that enforce the contract structurally. After this phase, any new code that bypasses navigation.cjs to read/write room.db fails pre-commit.

**Depends on:** Phase 109 sql-context-memory-navigation-spine (shipped — the navigation.cjs chokepoint this ADR codifies); Phase 110 brain-context-packet-contract (shipped — the Brain wire contract this ADR references).

**Dependents:** Phase 129 spine-repair-memory-event; Phase 130 lens-engine-skeleton; Phase 131 research-as-graph-aware-workflow-step; every future phase touching room.db.

**Target band:** v1.13.1-beta.3 — Wave 4 Stream E (parallel). Estimated ~2 days.

**Canon parts:** Part 6 (dog-fooding — the plugin honors its own substrate contract via CI guards); Part 8 (graph boundary — the ADR codifies LOCAL/BRAIN/AURA/PINECONE separation); Part 9 (memory locality — navigation.cjs as the single chokepoint for room.db).

**Brain impact:** NONE (LOCAL-only ADR + CI guards).

**Status:** COMPLETE -- 3/3 plans executed (Wave 1 + Wave 2 + Wave 3 shipped 2026-05-30). The guard is wired into the live pre-commit hook + the installer; CONTEXT finding H1 closed (navigation.cjs is now the structurally-enforced only door -- net-new bypass hard-rejected at commit time). The 195 pre-existing violations are ledgered as known debt owned by Phases 129/129.5/130/v1.14.0.

**Plans:** 3/3 plans executed
- [x] 128-01-PLAN.md -- Substrate Contract ADR + reuse-vs-build decision + M11 export allow-list pin (Wave 1)
- [x] 128-02-PLAN.md -- check-substrate.cjs guard (strict superset of --check-chokepoint) + 5-case test suite (Wave 2) [commits 65f60569 RED, a6baa645 GREEN]
- [x] 128-03-PLAN.md -- pre-commit hook wiring + installer template + baseline violation report (Wave 3) [commits 1aba10d0 wire, 1f44b42d baseline]

**Authority:** `.planning/phases/128-substrate-contract-adr/128-CONTEXT.md` (scoped 2026-05-16) + `.planning/v1.13.1-EXECUTION-PLAN.md` "Synthesis-Plan Absorption (2026-05-16)" section.

### Phase 128.1: Session isolation -- session-scoped active-room binding (INSERTED)

**Goal:** Make concurrent Claude sessions on different rooms stop colliding on the room registry's single global `active` field. Re-key the active-room binding to be session-scoped (keyed by Claude Code session id inside the same `registry.json`, `version` 2 -> 3, legacy `active` retained as a mirror), reconcile the 3 session-id mechanisms into one canonical resolver, repoint both caller classes, guard registry mutation with a lockfile, migrate legacy installs with zero breakage, and ship a warn-once non-blocking tripwire (F.0 acknowledge gate) when a session detects its binding changed underneath it.

**Requirements**: SESSION-ISO-128.1-01 through SESSION-ISO-128.1-11

**Depends on:** Phase 128

**Milestone:** v1.13.1. Phase 128.1 is a v1.13.1 phase. It was partially executed on `main` during the v1.13.0 endgame, then PULLED to branch `phase-128.1` on 2026-05-20 (navigator decision) so v1.13.0 finalizes clean. None of the 128.1 work is on `main`. Resume 128.1 from branch `phase-128.1` for v1.13.1.

**Plans:** 3 of 6 closed + 1 WIP -- all parked on branch `phase-128.1` (tip 407c060f), none on `main`:
- [x] 128.1-01-PLAN.md -- Wave 1: caller-inventory grep sweep + RED test scaffolds + VALIDATION.md verify (SESSION-ISO-128.1-05, 11) [on branch phase-128.1]
- [x] 128.1-02-PLAN.md -- Wave 2: session-binding.cjs canonical resolver + v2->v3 migration + mkdirSync lockfile + tripwire detection (SESSION-ISO-128.1-01, 02, 03, 06, 07) [on branch phase-128.1]
- [x] 128.1-03a-PLAN.md -- Wave 3: re-key resolve-room + room-registry + CJS active writers + context-monitor canonical resolver + Desktop/Cowork check (SESSION-ISO-128.1-04, 06, 09) [on branch phase-128.1]
- [ ] 128.1-03b-PLAN.md -- Wave 4: repoint every Class B reader through session-binding.resolveActiveRoom (SESSION-ISO-128.1-05) -- WIP: lib/ readers done (8d23afcd), scripts/ readers committed but unclosed (407c060f), no SUMMARY yet
- [ ] 128.1-05-PLAN.md -- Wave 4: tripwire F.0 warn-once surface + session_binding_drift event + concurrent-race regression test (SESSION-ISO-128.1-08, 11)
- [ ] 128.1-06-PLAN.md -- Wave 5: Canon Part 1 amendment (v1.5) + aggregator + Feynman-runner registration + REQUIREMENTS.md back-registration (SESSION-ISO-128.1-10)

### Phase 129: Spine Repair — Route 6 Silent Spine Scripts Through navigation.cjs (v1.13.1 — SCOPED 2026-05-16)

**Goal:** Refactor the 6 spine scripts that currently bypass `lib/core/navigation.cjs` to read via the chokepoint and emit `memory_event` on every state transition. After this phase, the proactive loop has a real backward arc — every action via `/mos:act`, `/mos:suggest-next`, `/mos:operator`, `/mos:jtbd`, `/mos:memory` is journaled to the canonical event log and visible to the next `/mos:status` / `/mos:suggest-next` invocation. Adds `FOLLOWS_FROM` as the 8th cascade edge type.

**Depends on:** Phase 109 sql-context-memory-navigation-spine (shipped — the chokepoint these scripts route through); Phase 122 workflow-layer (shipped beta.11 — command-resolver + chain-recommender that act/suggest-next consume).

**Dependents:** Phase 116 unresolved-tension-hook; Phase 117 auto-explore-domains; Phase 121 trajectory-telemetry; Phase 130 lens-engine-skeleton; Phase 131 research-as-graph-aware-workflow-step.

**Target band:** v1.13.1-beta.3 — Wave 4 Stream F (parallel). Estimated ~3-4 days.

**Canon parts:** Part 3 (Tri-Context Decision Gate — every gate transition becomes a memory_event); Part 4 (every choice is graph data — the spine's transitions ARE choices); Part 9 (memory locality — the spine reads + writes via navigation.cjs).

**Brain impact:** NONE (LOCAL-only spine refactor).

**Status:** COMPLETE -- 5/5 plans executed across 3 waves (shipped 2026-05-30..2026-05-31). All 6 spine scripts journal their surface through navigation.cjs (Waves 1+2); the Wave 3 instrumented proactive-loop acceptance test proves the backward arc is closed and leak-free (zero non-SQLite reads outside the two cache files, exact event count + dedupe, FOLLOWS_FROM linkage, next render reads the just-emitted events). Phase 109 acceptance still 1/1 (zero regression on the owned surface).

**Plans:** 5 plans

Plans:
- [x] 129-01-PLAN.md -- Wave 1: shared substrate (5 net-new spine event types + FOLLOWS_FROM 8th cascade edge + 60s idempotency + spine-events.cjs roomDir helpers + getCurrentJTBD/getCurrentOperator) -- DONE 2026-05-30 (67250de1 RED, bce99900 Task 1, e5b83304 Task 2; 15/15 GREEN; 109 acceptance still 1/1)
- [x] 129-02-PLAN.md -- Wave 2: read surfaces (mos-status + memory-command emit spine_read; suggest-next emits suggestion_surfaced) -- DONE 2026-05-30 (dc280f30 RED, c23300c6 Task 1, 286b53a4 Task 2; 7/7 GREEN; 129-01 substrate still 15/15; substrate guard clean)
- [x] 129-03-PLAN.md -- Wave 2: state transitions (jtbd + operator emit transitions; retire the operator.cjs node:sqlite bypass through navigation.cjs) -- DONE 2026-05-30 (e2e5b90c RED, 4f7eb97b Task 1, a6ca075a Task 2; 13/13 GREEN; operator-state 12/12 + 129-01 substrate 15/15; substrate guard clean; operator.cjs baselined-violation closed)
- [x] 129-04-PLAN.md -- Wave 2: workflow execution (act + pipeline emit workflow_stage with FOLLOWS_FROM chaining) -- DONE 2026-05-30 (e18bf137 RED, b3360d35 Task 1 act, 5957e634 Task 2 pipeline; 10/10 GREEN; 129-01 substrate still 15/15; substrate guard clean; zero direct room.db access)
- [x] 129-05-PLAN.md -- Wave 3: instrumented proactive-loop acceptance test + aggregator + Feynman registration + zero-regression gate -- DONE 2026-05-31 (10ca89fc acceptance test + seed, 6b516bca aggregator + Feynman registration, 480e27e8 deferred-items; run-all-129.sh 5/5 GREEN; 109 acceptance still 1/1; pre-existing Phase 122 e2e failure logged DI-129-05-01)

**Authority:** `.planning/phases/129-spine-repair-memory-event/129-CONTEXT.md` (scoped 2026-05-16) + `.planning/v1.13.1-EXECUTION-PLAN.md` "Synthesis-Plan Absorption (2026-05-16)" section.

### Phase 129.5: Truth-Machine Activation — Wire the Human-Confirms-Truth Lever (v1.13.1 — SCOPED 2026-05-30)

**Goal:** Make Canon Part 9's constitutional link real in running code. A human APPROVE at a Decision Gate promotes a `proposed` truth-claim node to `confirmed` via a single `confirmNode` chokepoint calling `promoteNodeStatus` with USER.md navigator attribution; no agent (Larry, Brain, hooks, sub-agents) can write a `confirmed` truth-claim node. After this phase, `confirmedFacts` returns real human-confirmed memory in a live room, and every promotion emits a `memory_event`.

**Depends on:** Phase 109 sql-context-memory-navigation-spine (shipped — `promoteNodeStatus` + `transitions.cjs` live here); Phase 128 substrate-contract-adr (shipped — the provenance floor + live net-new-aware guard); Phase 129 spine-repair-memory-event (shipped — the `memory_event` spine the promotion event rides on).

**Dependents:** Phase 130 lens-engine-skeleton (accept-on-lens-rotation should promote via `confirmNode`, not just emit); Phase 116 unresolved-tension-hook; any future Decision Gate surface (125 ranker accept).

**Target band:** v1.13.1-beta.4 — Wave 4.5 Stream F+ (after 129, parallel to 130). Estimated ~2-3 days.

**Canon parts:** Part 3 (Tri-Context Decision Gate — APPROVE is the promotion trigger); Part 4 (a confirmation is a typed status transition + memory_event); Part 9 (memory locality — "the human confirms truth", the ONLY path to trusted memory; amended v1.5 with the audit-node carve-out).

**Brain impact:** NONE (LOCAL-only truth-state promotion).

**Locked decisions (D-01/D-02/D-03):** single `confirmNode(db, id, byUser)` chokepoint owns APPROVE->promote; `byUser` = USER.md navigator identity (rejects larry/brain/system/assistant); Canon Part 9 carve-out exempts memory_event/audit/system-bookkeeping nodes from the human-confirm rule. Locked via AskUserQuestion 2026-05-30; not reopened by the --auto chain.

**Status:** COMPLETE — 3/3 plans shipped 2026-05-31. Canon v1.5 carve-out (Plan 01); confirmNode chokepoint + human-attribution guard + resolveByUser (Plan 02); Decision Gate APPROVE path wired into confirmNode + getConfirmedFacts contract + instrumented acceptance test (Plan 03). The human-confirms-truth lever is live end-to-end: a human APPROVE at a gate is the ONLY path to a confirmed truth-claim node, confirmedFacts returns real human-confirmed memory, an agent-initiated confirm is rejected, and every promotion emits a memory_event.

**Plans:** 3 plans

Plans:
- [x] 129.5-01-PLAN.md — Wave 1: Canon Part 9 audit-node carve-out (D-03) amendment + CANON-PHASE-MAP row + focus.cjs:63 justification (shipped 2026-05-31; canon v1.4 -> v1.5)
- [x] 129.5-02-PLAN.md — Wave 1: confirmNode chokepoint (D-01) + human-attribution guard (D-02) + resolveByUser USER.md identity + navigation.cjs re-export + SUBSTRATE-CONTRACT M11 amendment (shipped 2026-05-31; 19/19 TDD green; AGENT_IDENTITIES REJECT on confirm/validate of truth-claim nodes; promoteNodeStatus now has exactly one production caller)
- [x] 129.5-03-PLAN.md — Wave 2: Decision Gate APPROVE path wiring (selector dispatcher accept branch -> navigation.confirmNode with USER.md byUser) + getConfirmedFacts contract widening (IN ('confirmed','validated') over the truth-claim type set; getRiskyAssumptions narrowed to needs_evidence-only, disjointness preserved) + instrumented acceptance test (4 load-bearing assertions) + run-all-129.5 aggregator + Feynman registration (shipped 2026-05-31; 12/12 TDD green; zero raw SQL in selector-decisions.cjs; zero 109/129 regression). **PHASE 129.5 COMPLETE.**

**Authority:** `.planning/phases/129.5-truth-machine-activation/129.5-CONTEXT.md` (scoped 2026-05-30, 3 LOCKED decisions) + 2026-05-30 memory-system dog-food review finding C1.

### Phase 130: Lens-Engine Skeleton + Cognitive-Family Migration (v1.13.1 — SCOPED 2026-05-16)

**Goal:** Ship `lib/core/lens-engine.cjs` — the single architectural substrate that absorbs the duplicate lens-rotation logic scattered across 18+ commands. The engine ships in v1.13.1 with one populated lens family (cognitive); the other four families (domain / source / framework / trend) get registry slots and stay empty until their v1.14.0 migrations. The cognitive-family migration moves `think-hats / persona / hat-briefing / challenge-assumptions` from filesystem-mediated state to room.db typed nodes via `navigation.cjs`.

**Depends on:** Phase 109 sql-context-memory-navigation-spine (shipped); Phase 128 substrate-contract-adr (the contract this engine honors); Phase 129 spine-repair-memory-event (memory_event emission patterns the engine adopts); Phase 88.2 uiux-selector-block (shipped — the F-shape selector substrate).

**Dependents:** Phase 131 research-as-graph-aware-workflow-step; v1.14.0 framework-lens, trend-lens, source-lens fan-out, and domain-lens migrations.

**Target band:** v1.13.1-beta.5b — Wave 6.5 (pre-capstone). Estimated ~4-5 days.

**Canon parts:** Part 2 (Engine 2 BONO Orchestration — the lens-engine IS the substrate Part 2 calls for); Part 3 (every lens rotation surfaces findings via F-shape selector); Part 4 (typed cascade edges on accept; REJECTED_BECAUSE on reject); Part 9 (mandatory memory_event emission per rotation).

**Brain impact:** NONE (the engine writes LOCAL-only; Brain calls within rotations go through the Phase 110 packet contract).

**Status:** COMPLETE — 4/4 plans executed (Waves 1-4 shipped 2026-05-31). The single architectural lens-engine + cognitive-family room.db migration is live, proven end-to-end by the 8 instrumented E2E tests (the phase release gate). This phase COMPLETES the v1.13.1 memory cluster (109/128/129/129.5/130).

**Plans:** 4 plans

Plans:
- [x] 130-01-PLAN.md - Shared substrate: INFORMS + REJECTED_BECAUSE edge types (closes H2) + lens-nodes.cjs HatState/lens-finding node chokepoint via navigation.cjs
- [x] 130-02-PLAN.md - lens-engine.cjs rotate() + 5-family registry + serial/parallel/single modes + 3 synthesizers (tension-map/comparison-matrix/convergence-map) + 5 lens memory_event types
- [x] 130-03-PLAN.md - Cognitive-family migration: hat-persistence room.db rewrite + one-shot backfill + 4 thin command clients + tension-map dedup
- [x] 130-04-PLAN.md - 8 E2E tests (6 cognitive serial/parallel/single/consume + 2 engine-contract: rejection-as-data + persona-aware framing) + Feynman registration

**Authority:** `.planning/phases/130-lens-engine-skeleton/130-CONTEXT.md` (scoped 2026-05-16) + `.planning/v1.13.1-EXECUTION-PLAN.md` "Synthesis-Plan Absorption (2026-05-16)" section.

### Phase 130.5: Shared Corpus-Cache + CJS Fetcher Substrate (v1.13.1 - NEW 2026-06-01, from the 131/132 re-baseline)

**Goal:** Build ONE CJS-native external-corpus module (`lib/core/research-corpus.cjs` + `research-cache.cjs`) - the shared fetcher + cache over OpenAlex / arXiv / PubMed / Tavily that every research surface uses. Native `fetch`, zero Python, zero new deps. Closes the duplicate-fetcher / duplicate-API-quota drift the 2026-05-15 audit flagged, and is the substrate Phase 131 CONSUMES and Phase 134 REUSES (so the fetcher is built once, not three times).

**Depends on:** Phase 109 (shipped); Phase 110 (shipped).
**Dependents:** Phase 131 (Stage-4 fetcher + cache); Phase 134 (reuses; deletes rs_corpus.py); rs-discovery-engine (migrates onto it).
**Target band:** v1.13.1 - lands BEFORE Phase 131. Estimated ~2-3 days.
**Canon parts:** Part 7 (one corpus module, not three); Part 8 (shared pre-egress audit hook); Part 9.
**Brain impact:** NONE (LOCAL fetch + cache; Brain only via the Phase 110 packet for semantic dedup).
**Status:** COMPLETE - 3/3 plans shipped (2 waves). Substrate guard clean on every commit; no --no-verify.
**Plans:** 3 plans
Plans:
- [x] 130.5-01-PLAN.md - research-corpus.cjs unified fetchCorpus + 5-source adapters + disabled Sci-Bot + Part 8 fail-closed audit (wave 1)
- [x] 130.5-02-PLAN.md - research-cache.cjs shared TTL + source-keyed atomic on-disk cache (wave 1)
- [x] 130.5-03-PLAN.md - rs-discovery-engine migrated onto fetchCorpus + cache; byte-identical fixture regression + cache-hit-on-repeat + Canon Part 8 preserved; run-all-130.5.sh aggregator + Feynman registration (wave 2)
**Authority:** `.planning/phases/130.5-shared-corpus-cache-cjs-fetcher-substrate/130.5-CONTEXT.md` + `.planning/phases/131-research-as-graph-aware-workflow/131-REVIEW-4.8.md`.

### Phase 130.7: Correlation-ID Contract + Dual-Graph CI Gates (v1.13.1 - NEW 2026-06-01, the "132A" split, pulled early)

**Goal:** Ship the small, load-bearing dual-graph primitive the rest of the v1.14.0 render-spine chain stands on: a stable `correlation_id` on every teaching-graph node (name-based hash, embedding-INDEPENDENT), `chain-recommender.cjs` returning one canonical `{correlation_id, canonical_name, primary_label}` per query (no fork), navigation.cjs memory_event references carrying correlation_id, and the 4-metric dual-graph CI health gate + the three `/mos:brain-derive` curation surfaces. Extracted from the old Phase 132 (sub-plans 132-01 + 132-05) and pulled BEFORE Phase 131 so 131's cascade edges land on canonical targets, not cross-label duplicates.

**Depends on:** Phase 122 (shipped); Phase 127 (shipped); Phase 128; Phase 129.
**Dependents:** Phase 131 (canonical-target cascade edges); Phase 132 (the reformat writes against this contract); Phase 136 (the LazyGraph slot consumes "one canonical target, no fork").
**Target band:** v1.13.1 - lands BEFORE Phase 131. Estimated ~2-3 days.
**Canon parts:** Part 4; Part 8 (enum projection only; brain-boundary-scan); Part 9; Part 10.
**Brain impact:** MEDIUM (correlation_id backfill + chain-recommender return-shape; the heavy reformat is Phase 132).
**Status:** COMPLETE - 3 plans, 3 waves (closed 2026-06-01).
**Plans:** 3/3 plans executed
Plans:
- [x] 130.7-01-PLAN.md - correlation.cjs embedding-independent hashing chokepoint + one-time idempotent Cypher backfill + key-invariant asserting test (wave 1)
- [x] 130.7-02-PLAN.md - chain-recommender one-canonical-target-per-query (no fork) + bin/local-chain-recommender.cjs aggregate-by-correlation_id + navigation memory_event references carry correlation_id (wave 2)
- [x] 130.7-03-PLAN.md - report-only/baseline dual-graph CI gate (fail-on-regression, fail-closed-on-inconclusive) + the three /mos:brain-derive curation surfaces + Part 8 phase-wide boundary sweep (wave 3)
**Authority:** `.planning/phases/130.7-correlation-id-contract-dual-graph-ci-gates/130.7-CONTEXT.md` + `.planning/phases/132-dual-graph-correlation-hypergraph-reformat/132-REVIEW-4.8.md`.

### Phase 131: Research as Graph-Aware Workflow Step (Source-Lens Pilot) (v1.13.1 — COMPLETE 2026-06-02)

> **Re-baselined 2026-06-01** (see 131-REVIEW-4.8.md): now depends on Phase 130.5 (shared corpus-cache, no fetcher of its own) + Phase 130.7 (canonical correlation_ids land first); ships ZERO Python (HSI-scoring of findings deferred to the v1.14.0 fan-out behind Phase 134's CJS HSI); EvidenceClaim + cascade-edge + F.1-selector contracts LOCKED for Phase 136.

**Goal:** Transform `/mos:research` from a standalone topic-string-to-prose command into the canonical workflow step other methodologies can dispatch. After this phase: research invocation extracts context from the room (via navigation.cjs), understands WHY it was called, surfaces findings with computed candidate target sections (F.1 selector per Part 3), and wires accepted findings as typed `EvidenceClaim` nodes with cascade edges (INFORMS / CONTRADICTS / SUPERSEDES / REJECTED_BECAUSE). This is the source-lens family's pilot — the other 13 research surfaces follow in v1.14.0 with this pilot as the template.

**Depends on:** Phase 109 sql-context-memory-navigation-spine (shipped); Phase 110 brain-context-packet-contract (shipped); Phase 127 brain-mcp-local-stdio-shim; Phase 128 substrate-contract-adr; Phase 129 spine-repair-memory-event; Phase 130 lens-engine-skeleton; **Phase 130.5 shared-corpus-cache (NEW); Phase 130.7 correlation-id-contract (NEW - lands first)**.

**Dependents:** v1.14.0 source-lens fan-out (13 remaining research surfaces); v1.14.0 P9 framework-lens migration (same lens-engine + cascade-edge pattern proven here).

**Target band:** v1.13.1-beta.5c — Wave 6.7 (between Phase 130 and Phase 121.5 capstone). Estimated ~5-7 days.

**Canon parts:** Part 2 Engine 1 (research becomes a graph-aware Act 1 surface); Part 3 (F.1 filing selector for every finding); Part 4 (typed EvidenceClaim nodes + cascade edges); Part 5 (findings carry evidence_tier; thresholds shift by stage); Part 8 (pre-egress audit on every external fetch; provenance preserved); Part 9 (all reads + writes through navigation.cjs; mandatory memory_event).

**Brain impact:** NONE-NEW (uses existing brain_ask via the Phase 110 packet; no new Brain endpoints).

**Status:** COMPLETE -- 6/6 plans shipped (131-01 substrate + 131-02 context-extractor, 2026-06-01; 131-03 source-lens-driver + 131-04 findings-wirer + F.1 selector + 131-05 commands/research.md 7-stage rewrite + check-research-isomorphism CI guard + 131-06 5 E2E release gate + Feynman registration + RESEARCH-AS-WORKFLOW-STEP.md fan-out template, 2026-06-02). Phase release gate GREEN: run-all-131.sh 6/6; zero regression on 130/130.7/navigation; ZERO live Brain writes; ZERO new deps; substrate guard + brain-boundary-scan + isomorphism guard all pass.

**Plans:**
- [x] 131-01-PLAN.md -- substrate: EvidenceClaim writer (locked 136 schema) + CONTRADICTS/SUPERSEDES edges + 3 research events + getResearchPreflight + aggregator (wave 1)
- [x] 131-02-PLAN.md -- research-context-extractor: Stage 1+2+3 pre-flight + Body Shape A summary + weighted lens set (wave 2)
- [x] 131-03-PLAN.md -- source-lens-driver: Stage 4 over the 130.5 shared corpus, zero Python, dedup + tier/relevance rank; activates the lens-engine source family (wave 2)
- [x] 131-04-PLAN.md -- findings-wirer + F.1 filing selector: cascade edges (local-node-id for local targets, correlation_id for teaching-graph), gate-as-write-node forward contract for 136 (wave 3)
- [x] 131-05-PLAN.md -- commands/research.md 7-stage rewrite (both invocation modes) + check-research-isomorphism.cjs CI guard (wave 4)
- [x] 131-06-PLAN.md -- 5 E2E tests (the release gate) + Feynman registration + docs/RESEARCH-AS-WORKFLOW-STEP.md (wave 5)

**Authority:** `.planning/phases/131-research-as-graph-aware-workflow/131-CONTEXT.md` (scoped 2026-05-16) + `.planning/v1.13.1-EXECUTION-PLAN.md` "Synthesis-Plan Absorption (2026-05-16)" section.

### Phase 132: Hypergraph Teaching-Graph Reformat + Cross-Label Dedup + Content Cleanup (v1.13.1 — SCOPED 2026-05-17; SPLIT 2026-06-01)

> **Split 2026-06-01** (see 132-REVIEW-4.8.md): the correlation_id contract + dual-graph CI gates (the load-bearing primitive) were EXTRACTED to Phase 130.7 and pulled BEFORE Phase 131. This phase is now the heavy reformat only - it writes AGAINST the 130.7 contract and the 130.7 CI gates measure it. De-risks the whole v1.14.0 chain.

**Goal:** Finish the teaching-graph REFORMAT half of v1.13.1's "Coherent Brain-Wired Product" claim. Ships: (1) a hypergraph reformat - 4-5 reified event-node types (Authorship/Illustration/Contradiction/Motivation/Evolution) capturing n-ary relationships on Neo4j's binary-edge substrate; (2) cross-label dedup - collapse the ~50 same-name-different-label groups into one canonical correlation_id per cluster with facets; (3) content cleanup - the ~278-node wire-it work from the 2026-05-17 dogfooding session + Ackoff-class fragmentation + pseudonymize the 6 internal-team `:Person` nodes (Brain MCP now ships to testers tier). correlation_id is embedding-independent, so this is safe under any Phase 134 / 127.1 substrate swap.

**Depends on:** Phase 127 brain-mcp-local-stdio-shim; Phase 128 substrate-contract-adr; Phase 129 spine-repair-memory-event; **Phase 130.7 correlation-id-contract (NEW - the contract this reformat writes against)**; Phase 131 research-as-graph-aware-workflow-step.

**Dependents:** Phase 121.5 terminal-coherence-capstone (truth-telling pillar); v1.14.0 P9 framework-lens migration; v1.14.0 P13 source-lens fan-out remainder.

**Target band:** v1.13.1-beta.6 — Wave 7 (between Phase 131 and Phase 121.5). Estimated ~7-10 days.

**Canon parts:** Part 4 (makes graph data correlatable across the LOCAL/TEACHING split); Part 8 (correlation contract is enum projection only; no user content leaks to Brain); Part 9 (local memory_event aggregates resolve to canonical teaching-graph correlation_ids); Part 10 (Larry's chain-recommender output coherence depends on this phase landing).

**Brain impact:** HIGH (this IS the Brain teaching-graph reformat phase — correlation_id rollout across all teaching-graph nodes; hypergraph event-node reification; cross-label dedup).

**Status:** Scoped — ready for `/gsd:discuss-phase 132`.

**Plans:** 3/5 plans executed

Plans:
- [x] 132-01-PLAN.md - curation-batch runner + frozen 5-event-type hypergraph schema substrate (Wave 1) [SHIPPED 2026-06-02: lib/brain/curation-batch.cjs (makeBatch chokepoint -- created_by stamping + rollback pairing required + write-time 130.7-contract guard + scanBatchForUserContent Part 8 scan) + lib/brain/hypergraph-event-schema.cjs (frozen 5 event types + additive buildReifyCypher + EVENT_INSTANCE_MIN=20); 6/6 + 5/5 fixture tests; run-all-132.sh 2/2; ZERO live Brain writes; ZERO new deps; zero regression on 130/130.7/131/nav; commits 43b06b4c, 8a6b31d5, ff79b111]
- [ ] 132-02-PLAN.md - hypergraph reify: 5 reified event-node types, >=20 instances each, additive (Wave 2)
- [x] 132-03-PLAN.md - cross-label dedup-collapse + held-name-rename machinery (Wave 3) [SHIPPED 2026-06-02, RE-BASELINED: the as-written ~50-group / 22-REVIEW_REQUIRED targets are STALE (live graph already clean off the Phase 131 close-out packet -- 721 backfilled cids, 0 collisions); the REAL live worklist is 1 dedup pair (6831/22816 'The Other Way Round'|Technique) + 14 held name>80 nodes (10 :Method + 4 :Framework). Built GENERIC machinery: scripts/curation-132-03-dedup-held-rename.cjs -- pickCanonical (most-edged + 130.7 LABEL_PRIORITY tiebreak), buildDedupCollapsePass (keeper correlation_id via computeCorrelationId no-re-hash + migrate-incoming-edges + :Archived/REPLACED_BY reversible-delete + snapshotRequired=true with documented SNAPSHOT_PRECONDITION), buildHeldRenamePass (recompute cid + 3-property curated-v1 backfill + clear held marker, fully created_by-reversible). Both route through the 132-01 makeBatch runner. 13/13 fixture tests; run-all-132 3/3; ZERO live Brain writes; ZERO new deps; zero regression on 130/130.7/131/nav; live --execute is orchestrator-run snapshot-first. commits 50abe4d9, 0225062f, c9de6391]
- [ ] 132-04-PLAN.md - content wire-it: ~278-node backlog (A/C/D/E/F/G) + shattered-author consolidation (Wave 4)
- [x] 132-05-PLAN.md - pseudonymize 6 internal :Person nodes + 130.7 CI health gate as the phase release gate (Wave 5)

**Authority:** `.planning/phases/132-dual-graph-correlation-hypergraph-reformat/132-CONTEXT.md` (scoped 2026-05-17 from the dogfooding-curation session) + `~/MindrianRooms/mindrian/mindrianOS/methodology/2026-05-17-brain-curation-audit.md`.

### Phase 134: CJS port of Python analyzers via transformers.js (eliminate Windows install-fragility class) [v1.14.0]

> **Re-baselined 2026-06-01** (see 134-CONTEXT.md "Re-baseline corrections"): the package is `@huggingface/transformers` (Transformers.js v3+), NOT `@xenova/transformers` (deprecated; Tavily-validated). REUSES Phase 130.5's shared CJS fetcher (deletes rs_corpus.py, does not re-port). Owns the CJS HSI that Phase 131 deferred. Re-vectorization de-risked by Phase 130.7's embedding-independent correlation_id.

**Goal:** Replace `scripts/rs-engine.py` + `lib/core/rs_*.py` + `scripts/hsi-*.py` with in-process CJS via `@huggingface/transformers` (ONNX `Xenova/multilingual-e5-large`, 1024-dim), removing Python from the user-machine surface entirely. Eliminates the install-fragility class that broke the Windows tester (the `ModuleNotFoundError: requests` RCA).
**Requirements**: CJS-134-VENDOR, CJS-134-SVD, CJS-134-WSMATH, CJS-134-MODEL-UNIFY, CJS-134-BYTECOMPAT, CJS-134-MODELUX, CJS-134-MATH, CJS-134-EMBED, CJS-134-RS-PORT, CJS-134-ENGINE, CJS-134-REUSE-130.5, CJS-134-DELETE-CORPUS, CJS-134-HSI, CJS-134-RS-DETECT, CJS-134-DISCOVER-WS, CJS-134-HSI-PARITY, CJS-134-WS-PORT, CJS-134-WS-PARITY, CJS-134-FOREST, CJS-134-FINGERPRINT, CJS-134-FP-PARITY, CJS-134-MIGRATE, CJS-134-CASCADE, CJS-134-ENVFLAG, CJS-134-WINREPLAY, CJS-134-RETIRE-PREFLIGHT (see 134-SOURCE-AUDIT.md)
**Depends on:** Phase 130.5 shared-corpus-cache (reuses its fetcher; deletes rs_corpus.py); Phase 110 brain-context-packet-contract (wire schema, consumed transitively via 130.5).
**Status:** Planned — 9 plans across 5 waves (planned 2026-06-01; EXPANDED to the FULL user-machine analyzer surface after the 4.8 plan-check found the original 6 plans covered only ~half). Wave 0 de-risks BOTH math families (vendoring audit + checkpoint, SVD spike, UMAP/KDE/HDBSCAN whitespace-math spike, 768/1024 model-unify spike, byte-compat, model-UX). Milestone v1.14.0-beta.1 (both-paths env-flag).
**Scope note (goal honesty):** "remove Python from the user machine ENTIRELY" is operationalized as "remove the ML-dependency / install-fragility ANALYZER class entirely" (rs + HSI + whitespace + topic-forest + diagnostics/fingerprint + brain-baseline + the post-write auto-fire). Non-analyzer gated-stdlib python3 one-liners (build-graph, analyze-room, room-registry, etc. — never trigger pip) are explicitly DEFERRED to a future utility-de-pythonization phase and enumerated in 134-SOURCE-AUDIT.md. The acceptance grep proves ZERO analyzer python3 spawn on the cjs path.
**Plans:** 9 plans

Plans:
- [ ] 134-01-PLAN.md — Wave 0: vendoring re-audit + blocking-human checkpoint before committing @huggingface/transformers (+ any whitespace-math helper); SVD-port spike; UMAP/KDE/HDBSCAN whitespace-math spike; 768/1024 model-unify spike; byte-compat + model-UX spikes; commit golden parity fixtures; env-flag lock -> 134-SPIKE.md (wave 0)
- [ ] 134-02-PLAN.md — rs-math.cjs: pure-JS cosine + classify_direction + the TF-IDF/truncated-SVD LSA + an EXPORTED power-iteration eigen primitive (reused by HSI spectral-gap + whitespace PCA); parity vs committed rs_math.py fixtures (wave 1)
- [ ] 134-03-PLAN.md — rs-embed.cjs: the SINGLE in-process e5-large embedder (1024-dim) replacing ALL Python embedding paths (rs Pinecone + rs MiniLM + Family-B BAAI + brain-baseline) per the model-unify disposition; first-run download UX + warm-up off the auto-fire hot path (wave 1)
- [ ] 134-04a-PLAN.md — rs-rooms/rs-cache/rs-hybrid.cjs (rs-cache absorbs the rs-pinecone-bridge python3 -c, Part 8 audit preserved); DELETE rs_corpus.py + REUSE 130.5 fetchCorpus; 130.5-missing pre-flight blocker (wave 2)
- [ ] 134-04b-PLAN.md — rs-engine.cjs 3-mode orchestrator; byte-preserved .rs-engine-results.json; internal-mode parity vs committed rs-engine.py fixture (file-disjoint from 04a, same wave) (wave 2)
- [ ] 134-05-PLAN.md — hsi-compute.cjs (incl. OM-HMM spectral-gap) + reverse-salients.cjs (detect-reverse-salients.py port — the auto-fire RCA surface) + hsi-whitespace.cjs (discover-* trio) + the HSI PARITY GATE against committed fixtures (wave 2)
- [ ] 134-06-PLAN.md — whitespace-math.cjs (compute-whitespace-embeddings/gaps/external via Wave-0 UMAP/KDE) + brain-baseline.cjs (fetch-brain-baseline.py port); whitespace parity gate vs committed fixtures (wave 3)
- [ ] 134-07-PLAN.md — topic-forest.cjs (compute_topic_forest.py / HDBSCAN strategy) + fingerprint-math.cjs (the 4 /mos:fingerprint diagnostics: CD-index + Good-Turing + element-novelty + Bayesian-surprise); fingerprint parity gate vs committed fixtures (file-disjoint from 06, same wave) (wave 3)
- [ ] 134-08-PLAN.md — FULL cutover behind MINDRIAN_RS_ENGINE (cjs default): rewire intelligence-cascade auto-fire (BLOCKER-1) + reverse-salient-agent + rs-differential-scorer + discovery-cycle + auto-explore-fire + whitespace-command + diagnostics-command + ensure-brain-baseline + doctor; retire --check-rs-engine + check-hsi-deps; full-surface Windows-tester-replay acceptance (wave 4)

### Phase 135: Offer Resolver and Reliable Next-Move Closer (v1.13.0 — lead of the Felt-Moat Engine arc)

**Goal:** Complete the navigation engine's offer-presentation layer so Larry fires exactly ONE calibrated next-move offer through the already-shipped F.1 selector at the right moment, and stays silent otherwise. Fills the `resolveOfferNextStep` stub (Plan 91-04's deferred scope, which today ships `null`) with an abstention-gated resolver that is SQL-local aware, Brain-aware, wikilink-aware, and MD-aware. The trunk of the offer loop: renders through the native AskUserQuestion primitive (zero TUI, zero third-party OSS dependency).

**Success criteria (goal-backward):**
1. `resolveOfferNextStep` returns one offer `{command, framework, jtbd, confidence, reason, scope}` or `null` — no longer always `null`.
2. SQL-local aware: reads `room.db` EXCLUSIVELY via `lib/core/navigation.cjs` (Canon Part 9 chokepoint); zero non-SQLite folder scans; consumes local graph neighborhood + `memory_event` tail for relevance/confidence.
3. Brain-aware: Mode A enriches via `buildBrainPacket` typed packet (Canon Part 8 — enum/handle/phase identifiers only, zero user content); Mode B degrades to local heuristics (no RECOMMENDED marker); tier_0 falls to the hardcoded minimal verb set. No crash across all three.
4. MD-aware: reads the memory quadruple (ROOM.md / STATE.md / REASONING.md / BRAIN.md) + FEYNMAN.md temporal + MINTO.md governing thought via the navigation read contract; intent leg (USER.md role_blend, active JTBD, operator) from turn context.
5. Wikilink-aware: offer reason cites artifacts/sections as `[[wikilinks]]` (reuse Phase 76 engine); decision edge carries wikilink provenance; an accepted offer that files an artifact injects wikilinks idempotently.
6. Abstention gate: operator-state x confidence-margin x rejection-backoff. `null` in JUST_TALK; offers at decision moments; backs off a rejected offer for N turns (remembered via `memory_event` / FEYNMAN).
7. Reliable closer: when the resolver returns an offer, the F.1 Next-Move selector fires via AskUserQuestion (Phase 88.2) with a Free-Text escape; the pick records a typed decision edge via `recordSelectorDecision` (Canon Part 4); max 1 offer/turn (already enforced).
8. Cross-surface: renders through AskUserQuestion on CLI / Desktop / Cowork; zero TUI dependency.
9. Canon Part 8 clean: no user bytes reach the Brain; `brain-boundary-scan` passes.

**Canon parts:** Part 2 (navigation), Part 3 (tri-context Decision Gate, Shape F.1), Part 4 (every choice is graph data), Part 8 (graph boundary), Part 9 (memory locality).

**Depends on (hard, all shipped):** Phase 91 navigation-engine; Phase 88.2 uiux-selector-block (F.1 selector); Phase 109 sql-context-memory-navigation-spine; Phase 110 brain-context-packet-contract; Phase 90 brain-derivation-layer (BRAIN.md quadruple). **Soft (sequence behind if available):** Phase 129 spine-repair-memory-event (freshness eventing); Phase 127/127.1 (Brain-native transport, for Mode A).

**Reuse (Part 7):** extends `lib/core/navigation-engine.cjs::resolveOfferNextStep`; reuses `rankForSelector` + `recordSelectorDecision` (125), AskUserQuestion (88.2), `navigation.cjs` chokepoint (109), `buildBrainPacket` (110), `readQuadruple` (90), the wikilink injector (76), the operator state machine. NET-NEW: abstention triple, resolver body, reliable-closer wiring.

**Plans:** 3 plans

Plans:
- [ ] 135-01-PLAN.md -- Wave 0 test scaffolds (resolver/closer/fs-leak suites + run-all-135) + operator-state call-site wiring into the engine context (SC6 prerequisite)
- [ ] 135-02-PLAN.md -- Resolver body + abstention triple (operator x margin x backoff, MARGIN_THRESHOLD=0.15 / N=5) filling the resolveOfferNextStep stub; local-only sync, wikilink-grounded reason (SC1/SC2/SC3/SC5/SC6/SC9)
- [ ] 135-03-PLAN.md -- Reliable F.1 closer wiring (pickShape + Free-Text escape -> recordSelectorDecision/Miss) + idempotent wikilink-on-accept + Feynman registration + Part 8 brain-boundary gate (SC5/SC7/SC8/SC9)

### Phase 136: The Liquid State - One Render Spine (M5 render-spine layer) [v1.14.0 ANCHOR]

**Goal:** Build M5's render-spine layer - ONE event-subscribing render engine where shape and delivery are flags, not commands. Collapse the 7 divergent HTML commands (dashboard / wiki / present / publish / export / visualize / snapshot) into that single engine, then build the `mos tui` full-screen ARROW-KEY navigator - a separate lazygit-style process: keyboard-driven fractal ICM tree + swappable views [deck / mermaid / wiki / grid] + a multi-select / free-text Decision-Gate selector + LazyGraph suggestion slot - that live-subscribes to room.db events and never rebuilds on a timer. Larry's in-conversation 4-zone render remains the zero-process fallback. Web = live-wiki twin; Desktop/Cowork = AskUserQuestion baseline. Write the single De Stijl token + component source (the design contract / token core the 2026-05-10 UI/UX convergence session named as the "rendering reverse salient: the token core does not exist"). The truth layer (room.db graph + resolver + offer_next_step + event stream, Phase 135) is the already-shipped foundation this renders - render is never the moat; the truth layer is.

> **ROUND-4 SEAMLESS-FIRST (2026-05-31, see 136-SPEC):** the universal DEFAULT is inline (in-conversation 4-zone + native AskUserQuestion gate) + a one-command web twin - both zero-setup and identical on Windows/Mac/Linux. **`mos tui` is OPT-IN**, hosted by a detect-and-adapt launcher (tmux-scripted on Mac/Linux, WezTerm/mprocs on native Windows, web fallback) and GENERATED from the room graph (session=room/window=section/pane=surface; tmux hooks emit `focus_changed` events). All surfaces are thin clients of one headless core (navigation.cjs single writer + thin SSE read API). Cross-platform CONFIRMED: room.db = node:sqlite (no native binding), pure-JS vendored tree, Node 22+ floor. The gate is the write node (each toggle a typed edge, open-text a FREE_TEXT edge). Validated via CC feasibility review + Tavily best-practices + alternatives research. Reference build: mindrian-tui-achievable.vercel.app.

**Authority:** `~/MindrianRooms/mindrianOS/product-evolution/architectural-mandates/M5-liquid-state-fractal-sos.md` (the product-theory spine, captured 2026-05-31 from a 20+ turn design conversation; status SEED, to be promoted to ADR by this phase). This phase IS the render-spine sibling M5 names as the un-written "TUI enhancement-layer map (CLI render)." Sibling thread already shipped: the Offer-Resolver / truth layer (Phase 135).

**Success criteria (goal-backward):**
1. ONE render engine exists; `shape` (deck/mermaid/wiki/grid/dashboard/snapshot) and `delivery` (cli/web/file) are flags, not 7 separate commands. The 7 legacy HTML commands route through it or are retired.
2. CLI persistent-navigator TUI renders the fractal ICM tree (room -> section -> sub-section -> MD) as a stable sidebar; the LazyGraph surfaces in a suggestion slot that OVERLAYS and never reorders the tree (M5 hard rule 1). FRACTAL (Req 12): arbitrary depth; ZOOM re-roots the navigator at any node as a complete ICM at its own scale; BUD promotes a section into its own room (SEED-001 sub-room contract); cross-wall edges surface in the graph/slot, never by reordering the tree.
3. The render subscribes to `room.db` `memory_event` stream and updates on event, not on a timer (M5 hard rule 3); reads exclusively via `lib/core/navigation.cjs` (Canon Part 9 chokepoint).
4. Intent gates, temporal ranks (M5 hard rule 2): the suggestion slot speaks only when something recently changed (temporal) that serves the active JTBD/operator (intent); human-declared intent is sovereign, agent-proposed intent is advisory and never overrides.
5. ONE De Stijl token + component source (the design contract) extends Phase 121.5 `palette.json` into a surface-agnostic token graph every renderer obeys; a CI linter enforces the glyph/palette/token vocabulary (no renderer invents its own values).
6. Dual render: the engine emits BOTH graph (see the relation) and natural language (understand it) for graph-native truths.
7. Cross-surface law (M5 three-layer turn-one rule): CLI = persistent navigator; web = live-wiki twin; Desktop/Cowork = AskUserQuestion baseline. Every surface renders the same brain, never a second brain (M5 hard rule 5).
8. Canon Part 8 clean: no user bytes reach the Brain; `brain-boundary-scan` passes.

**Canon parts:** Part 7 (consolidation - 7 commands become 1 render spine + 1 token source), Part 8 (graph boundary), Part 9 (memory locality - navigation.cjs chokepoint), Part 10 (render is the surface).

**Depends on (hard, shipped):** Phase 135 (offer resolver / truth layer), Phase 109 (sql-context-memory-navigation-spine), Phase 130 (lens-engine), Phase 121.5 (UI Ruling System + `palette.json` token seed). **Soft (sequence behind if available):** Phase 131 (research-as-workflow-step), Phase 132 (dual-graph correlation).

**Reuse (Part 7):** extend Phase 121.5 `palette.json` into the token core (do not invent a new token system); reuse the `navigation.cjs` chokepoint, the existing `dashboard/` `wiki/` `present/` HTML templates as the seed views the engine consolidates, and the De Stijl design system. NET-NEW: the render-engine flag dispatch, the CLI persistent-navigator TUI process, the event-subscribe loop, the token-graph contract + CI linter.

**Open questions (resolve in SPEC, from M5):**
- RESOLVED (Round 3, see 136-SPEC): the navigator is a real `mos tui` full-screen ARROW-KEY binary that coexists with Claude Code as a SEPARATE process in its own terminal (the lazygit model), NOT rendered inside the conversation pane. First justified break of the prior "zero TUI dependency" precedent (needs a TUI lib: ink/blessed). Selector gains multi-select (space-toggle) + always-present free-text escape; each pick is its own edge (Part 3 additive extension). New residual how-questions deferred to discuss-phase: which TUI lib, and the concurrent-room.db-access model.
- Wikilink authorship: founder-only (authentic, slower) vs Larry-proposes-founder-approves (HITL gate, same as the resolver thread).
- Does intent FILTER the temporal stream or RE-RANK the whole graph as the primary axis?
- Sidebar "next" highlight in-place (keeps it a map you roam) vs a separate slot (risks rebuilding the linear march).

**GTM sequencing risk (recorded, not resolved):** the 2026-05-28 cross-tester GTM findings name the deal-blockers as multi-user/team collaboration + Brain-API-key onboarding, NOT a navigator. No current tester is pulling for this surface - Phase 136 is architecture-led, not demand-led. Decide at plan-phase whether it anchors v1.14.0 or sequences behind the multi-user + onboarding work the pipeline deals are stuck on.

**Scope note:** milestone-scale. Will likely decompose into a cluster (136 anchor + sub-phases: render-engine core / token contract / CLI navigator / surface twins) during plan-phase.

**Plans:** 8 plans in 6 waves

Plans:
- [ ] 136-01-PLAN.md (Wave 0) - test harness + seeded 4+-level fixture + ink-absent guard + confirm BUD callable + release.sh native-addon assertion
- [ ] 136-02-PLAN.md (Wave 1) - headless core: read-only room.db handle + thin SSE read-API on the existing express server
- [ ] 136-03-PLAN.md (Wave 1) - token core: palette.json semantic pairs + 4 TUI glyphs + SKILL.md ruling extension + check-tokens.cjs linter
- [ ] 136-04-PLAN.md (Wave 2) - one engine + seamless default: render-v2 shape x delivery + 7 commands to flag-aliases + LazyGraph slot + dual render
- [ ] 136-05-PLAN.md (Wave 3) - opt-in mos tui ink app (checkpoint: ink install) + fractal nav (zoom/bud/cross-wall)
- [ ] 136-06-PLAN.md (Wave 3) - the gate as write node: DECISION/FREE_TEXT edges + multi-select + free-text widget
- [ ] 136-07-PLAN.md (Wave 4) - detect-and-adapt launcher: host probe + graph workspace + tmux focus hooks
- [ ] 136-08-PLAN.md (Wave 5) - canon/gates capstone: Part 8/9 boundary + cross-platform + full suite green + M5 SEED -> ADR

### Phase 139: Doctor — Accumulative Engine Skeleton + Context Fix (hotfix) (INSERTED 2026-06-04, same-day P0)

**Goal:** Stop `/mos:doctor` from scaffolding room artifacts in the wrong directory, and convert its frozen Phase-95 check roster into a version-accumulative engine SKELETON — so every new Mindrian version can register its own health/migration module and any user on any prior version is healed forward, idempotently, any time they run doctor. Prove the pattern end-to-end by shipping Umbilical Cord as the first registered module, which doubles as the map that fixes doctor's broken context model. The 2026-04-13 drift-discipline incident applied to doctor itself.

**Priority:** P0 — doctor mis-scaffolds room artifacts in NON-room dirs (cwd-misfire, exposed by the 2026-06-04 home-dir reorg) AND is blind to every organ added since Phase 95.

**Requirements:** [S1, S2, S3, S4]

**Canon parts:** Part 8 (graph boundary — cords + health checks are LOCAL only; no raw cross-room edges; zero Brain egress), Part 7 (reuse before build — generalize the shipped `install-state.cjs::migrateIfNeeded` semver dispatch + `data/deployment-surfaces.json` manifest patterns), Part 6 (dog-fooding drift discipline — the plugin self-heals forward across versions the same way it sells), Part 4 (every choice is graph data — the cord projects as an AFFILIATED_WITH edge).

**Depends on (hard, shipped):** Phase 95.1 (doctor classes A-M baseline), Phase 95.2 (on-version-change branch + preflight-doctor), Phase 108/109 (navigation/edges.cjs writeEdge + ALLOWED_EDGE_TYPES + room.db), Phase 123 (`install-state.cjs::migrateIfNeeded` + `deployment-surfaces.json` manifest + `release.sh` Step 6.6 acceptance gate), `resolve-active-room.cjs` (single-resolver precedent).

**Version:** ships 1.13.1-beta.4 (NOT 1.13.0.1 — a hotfix cannot carry a lower semver than the current 1.13.1-beta.3; release.sh --prerelease advances beta.3 -> beta.4; release infra ships as a beta first).

**Scope (IN):** S1 WHERE fix (single resolver + close OBS-2), S2 accumulative engine skeleton (registry + watermark + selector), S3 Umbilical as module #1 (minimal: marker read + edge projection + integrity), S4 release wiring. **Scope (OUT):** the 15 remaining SCOUT-2 organ modules (backfill v1.13.1+), bidirectional ROOM.md cords section + global umbilical.json view, `/mos:umbilical` command + retroactive orphan sweep.

**Reuse (Part 7):** generalize `install-state.cjs::migrateIfNeeded` (semver dispatch + future-version-DEFER + additive idempotency) into the selector; mirror `data/deployment-surfaces.json` for `data/doctor-modules.json`; extend `lib/core/migration-snapshot.cjs` for the watermark ledger; one-line additive add of AFFILIATED_WITH to the existing `ALLOWED_EDGE_TYPES` Set; mirror `resolve-active-room.cjs` for the new resolver. NET-NEW: `lib/core/resolve-umbilical-target.cjs`, `data/doctor-modules.json`, `lib/core/doctor/umbilical-module.cjs`, the selector loop, the watermark helpers.

**Plans:** 3/4 plans executed

Plans:
- [x] 139-01-PLAN.md (Wave 1) — S1 WHERE fix: single resolver `resolve-umbilical-target.cjs` + route doctor cwd probe + close OBS-2 (zero room-artifact writes from non-room cwd)
- [x] 139-02-PLAN.md (Wave 2) — S2 engine skeleton: `data/doctor-modules.json` registry + `~/.mindrian/doctor-applied.json` watermark + semver selector (idempotent, future-version-DEFER)
- [x] 139-03-PLAN.md (Wave 3) — S3 Umbilical module #1: AFFILIATED_WITH additive + marker read + edge projection into room.db + integrity check + register in registry
- [ ] 139-04-PLAN.md (Wave 4) — S4 release wiring: 1.13.1-beta.4 bump + release.sh Step 6.6 module verification + doctor --acceptance + phase acceptance test (checkpoint: cut release)

---

## Milestone: v1.13.1 "Larry Reaches" -- Close the Local Loop + Intelligence-Layer Activation (LARRYREACH)

> ROADMAPPED 2026-06-04. Origin: Decision Gate Option A (temporal-graph + smart-context-assembly fan-out, 8 agents / 7 MECE slices, `~/MindrianRooms/mindrianOS/product-evolution/v1.13.0-memory-system-review/DESIGN-BRIEF-temporal-graph-context-assembly.md`) folded with the full SEED-008 intelligence-layer-activation bundle (`.planning/seeds/SEED-008-*.md`).

**Goal:** Close the per-turn retrieval loop so Larry's evidence-reach is real -- "do you remember X" actually retrieves X-relevant nodes -- and activate the intelligence layer that today runs in compute-and-store mode (every turn emits `routing_source: legacy` / `tier_mode: tier_0`). Ship the "When to Reach" capability-dial policy out of working-tree limbo into a tracked, version-bumped release. The gate blocker (SEED-008): the loop must FIRE, not merely exist -- if the 5-criterion dogfood acceptance does not pass, the milestone is renamed.

**Numbering note:** These are NEW LARRYREACH phases. The highest pre-existing phase is 139 (umbilical-engine, in the prior v1.13.1 chain), so LARRYREACH starts at Phase 140. Phases 130-139 belong to the earlier v1.13.1 memory/research cluster and are NOT re-derived here.

**Granularity:** fine (config.json). Coverage: 32/32 LARRYREACH requirements mapped, no orphans, no duplicates.

**Dependency spine (the hard ordering):**
- Phase 140 (HARD-01..05 sentinel hardening) is a HARD PREREQUISITE for Phase 145 (SCHED-01/02) -- never auto-fire a buggy scout on a schedule.
- Phase 141 (RETR fusion + capability dial + BUG-01) is the retrieval spine; the dial commits in the SAME phase/PR as the RETR work per Option A, and the line-53 fix is a tag-along.
- Phase 144 (NAV-01 legacy->engine flip) depends on Phase 142 (NAV-02 BRAIN.md derivation raising tier_mode + CASC-02 Phase 109 spine navigating) and on Phase 143 (the trigger-map sensors decide() reads).
- Phase 146 (ACPT-01..05) is the loop-fires acceptance gate; it depends on every feature phase and is the milestone gate blocker.

### Phases

- [x] **Phase 140: Sentinel & Instrumentation Hardening** - Fix the 5 scout-surfaced bugs so a scheduled scout never broadcasts noise (HARD prerequisite for scheduled sensors) [COMPLETE -- v1.13.1-beta.6, HARD-01..05 closed]
- [ ] **Phase 141: Local Retrieval Spine + Capability Dial** - `getRoomContext()` 3-leg local fusion seeds the per-turn loop; commit + version-bump the "When to Reach" dial; fix the line-53 ReferenceError
- [ ] **Phase 142: Local Intelligence Wiring (compute-store-and-ACT)** - Cascade findings surface mid-session; BRAIN.md derives so tier_mode rises; queue auto-drains; post-compact re-injection consumes; Phase 109 spine navigates
- [ ] **Phase 143: Insight Sensors (the 7-row trigger map)** - Event-driven sensors auto-fire the right reach on the right signal, hat-scoped and Part-8-constrained on the Brain/web path
- [ ] **Phase 144: Navigation Engine legacy->engine Flip** - `decide()` reads {local graph + BRAIN.md + trigger map} instead of file-presence; `routing_source: engine` appears in a trace
- [ ] **Phase 145: Scheduled Sensor Activation** - The scout suite + whitespace/reverse-salient/opportunity/competitor sensors fire on a cadence (gated on Phase 140 hardening)
- [ ] **Phase 146: Loop-Fires Acceptance Gate** - The scripted dogfood session in the mindrianOS room shows all 5 acceptance criteria; the milestone gate clears

### Phase Details

### Phase 140: Sentinel & Instrumentation Hardening
**Goal**: A scheduled scout can fire without broadcasting noise -- the 5 bugs the 2026-05-10 scout run surfaced in the sentinel + instrumentation layer are fixed before any auto-fire is wired.
**Depends on**: Nothing (first LARRYREACH phase; HARD prerequisite for Phase 145)
**Requirements**: HARD-01, HARD-02, HARD-03, HARD-04, HARD-05
**Canon parts**: Part 4 (HSI edges become graph data once they reach room.db), Part 8 (HSI-to-graph + telemetry stay LOCAL; zero Brain egress)
**Success Criteria** (what must be TRUE):
  1. `sentinel-health-check` runs to completion without the line-132 arithmetic syntax error
  2. Running HSI lands its edges in room.db (no `NOT NULL constraint failed: nodes.source_path`); the graph holds HSI signal after a scout
  3. A reverse-salient / HSI scan reports zero `.heal-backup/` duplicates -- backup dirs no longer pollute the result set
  4. After a session running a dozen `/mos:*` commands, the query-efficiency telemetry hook shows non-zero captured events (the 57x-claim gate has real data)
  5. The deadline monitor reports the phase deadlines in `.planning/STATE.md`, not just `funding/` + `opportunity-bank/` (a near deadline shows as DUE, not CLEAR)
**Plans**: 4 plans
- [x] 140-01-PLAN.md -- HARD-02: shared NOT-NULL-safe node insert helper (4 sites) + both-schema safety + unmask scout swallow (D-02/D-02a/D-03)
- [x] 140-02-PLAN.md -- HARD-01 arithmetic guard in sentinel-health-check + HARD-03 .heal-backup excluded from both SKIP_DIRS sets (D-04)
- [x] 140-03-PLAN.md -- HARD-04 relax telemetry gate to all turns + 57x reconciliation (D-01/D-01a) + HARD-05 deadline monitor reads .planning/STATE.md
- [x] 140-04-PLAN.md -- cut v1.13.1-beta.6 (local): CHANGELOG HARD-01..05 entry + plugin.json/package.json bump + commit ca5c580e + tag v1.13.1-beta.6 (external push/marketplace/npm human-gated)

### Phase 141: Local Retrieval Spine + Capability Dial
**Goal**: The per-turn loop stops forwarding `userText:null` -- `getRoomContext()` fuses local room memory into a query-time seed, the "When to Reach" capability dial ships tracked, and the line-53 crash is gone. This is the spine of Option A: maximally rich, entirely local, zero Part-8 cost.
**Depends on**: Nothing structural (parallel-safe with Phase 140)
**Requirements**: RETR-01, RETR-02, RETR-03, RETR-04, LARRY-01, LARRY-02, LARRY-03, BUG-01, DRSCH-01, DRSCH-02, DRSCH-03, DRSCH-04
**Canon parts**: Part 9 (SQL is the local mind -- fusion reads room.db via the navigation chokepoint), Part 8 (raw prose stays local; explicitly NOT the packet.cjs projectText/hashText egress path; deep-research queries carry generic handles only), Part 3 (the dial governs reach at the Decision Gate; deep research is plan-gated), Part 2 (the team's reach affordances honor the dial; deep research is hat-scoped EXTERNAL WEB), Part 4 (research results file as typed graph evidence), Part 7 (deep research REUSES /mos:research + deep-research skill + Phase 131)
**Note (2026-06-05)**: DRSCH-01..04 (framework-led deep research -- the fifth capability-dial reach) folded into this phase. The reach is already drafted in the working-tree SKILL.md dial; Phase 141 commits + GSD-researches the plan-builder mechanism (local+remote brain build a framework-shaped, hat-scoped, plan-gated research plan).
**Success Criteria** (what must be TRUE):
  1. `getRoomContext()` returns a fused context from all three legs (home-view RAW summaries + windowed session-history fragments + getNeighborhood graph-ranking), seeded by the last ~2 turns
  2. A "do you remember X" turn retrieves X-relevant nodes -- the per-turn loop carries a real seed, not `userText:null`
  3. The fusion path imports nothing from `packet.cjs` (no projectText/hashText) -- a code scan confirms raw prose never touches the egress path
  4. Per-turn assembly completes under the 1200ms NAV timeout on a populated room.db (benchmarked; graph-ranking-first)
  5. The "When to Reach -- The Capability Dial" SKILL.md section is committed to HEAD with `canon_parts` frontmatter + a CHANGELOG entry, and the version is bumped with the dial as a release-noted change; the line-53 `build-graph-from-sqlite.cjs` ReferenceError no longer crashes (a graph is emitted)
**Plans**: 6 plans
- [x] 141-01-PLAN.md -- Wave 0 test scaffold: run-all-141.sh runner + fixture room.db + all 9 CJS suites (Nyquist floor)
- [x] 141-02-PLAN.md -- commit the dial FIRST (D-06): SKILL.md canon_parts + 5 reach ids + LARRY-04 Navigator (3 posture ids + Reach rule 7) + DRSCH doctrine + beta.7 bump
- [x] 141-03-PLAN.md -- getRoomContext 3-leg fusion (RETR-01/03/04) + navigation.cjs re-exports + 1200ms benchmark
- [x] 141-04-PLAN.md -- FILEVAL-02 read-back wrapper over shipped writeEvidenceClaim + artifact_path additive field (fixture-first)
- [x] 141-05-PLAN.md -- BUG-01 one-token lazygraphPath -> roomDbPath fix + no-room-db exit-0 regression
- [x] 141-06-PLAN.md -- RETR-02 hot-path seed flip (un-null userText to the LOCAL lane only; D-03a Part-8 fence)

### Phase 142: Local Intelligence Wiring (compute-store-and-ACT)
**Goal**: The local intelligence systems stop computing-and-storing and start computing-store-and-ACTING -- filing surfaces findings mid-session, BRAIN.md derivation lifts the room out of `tier_0`, the derivation queue drains, memory survives an auto-compact boundary, and the Phase 109 spine actually navigates the graph for routing. The cheapest, highest-leverage sub-loop; touches zero Brain code.
**Depends on**: Phase 141 (the retrieval seed the spine navigates against)
**Requirements**: CASC-01, CASC-02, NAV-02, NAV-03, NAV-04
**Canon parts**: Part 9 (the Phase 109 spine NAVIGATES, not merely stores -- SQL is the local mind), Part 4 (cascade findings are graph edges surfaced to Larry), Part 2 (BRAIN.md derivation enriches the team), Part 8 (BRAIN.md derivation preserves the LOCAL-to-BRAIN boundary -- generic handles only)
**Success Criteria** (what must be TRUE):
  1. Filing an artifact surfaces the cross-relationship cascade findings to Larry mid-session (the room-proactive skill reads the envelope where the bash hook writes it)
  2. The Phase 109 navigation spine reads the local graph to route a decision -- routing reflects graph neighborhood, not just stored edges
  3. BRAIN.md derives for a room's sections so `tier_mode` rises above `tier_0` for those sections
  4. The brain-derivation queue auto-drains -- enqueued entries are processed within a session, not left sitting for days
  5. After an auto-compact boundary, the post-compact re-injection consumer restores memory context -- the session does not degrade across the compact
**Plans**: 4 plans
- [ ] 142-01-PLAN.md -- Wave 0 test scaffold: run-all-142.sh aggregator + 7 RED loop-fires suites (one per requirement + Part-8 gate) + room-142 fixture (Nyquist floor)
- [ ] 142-02-PLAN.md -- CASC-02 (the one BUILD): wire getRoomContext neighborhood into decide() via the navigation.cjs chokepoint on the caller-owned handle; routing_source UNCHANGED (Phase 144 fence)
- [ ] 142-03-PLAN.md -- CASC-01 + NAV-03 VERIFY: loop-fires acceptance tests lock the shipped Phase 95 cascade side-channel surfacing + the UserPromptSubmit drain auto-fire (no re-implementation)
- [ ] 142-04-PLAN.md -- NAV-02 verify (BRAIN.md present -> tier_mode rises above tier_0) + NAV-04 close-by-reference (Phase 95.5 passed) + FILEVAL-03 honesty-rule verify (filing-did-not-land surfaced)

### Phase 143: Insight Sensors (the 7-row trigger map)
**Goal**: The "insight sensors" the Brain's own beautiful-question node asked for fire automatically -- the right reach on the right conversational/state signal, hat-scoped per Canon Part 2, with the Brain/web path constrained to generic handles only. Heuristic sensors first (the cheap v1), feeding the navigation engine.
**Depends on**: Phase 142 (BRAIN.md derivation + cascade plumbing the sensors consume); Phase 141 (the local seed + the committed 5-reach dial doctrine with stable reach ids per LARRY-03)
**Requirements**: SENS-01, SENS-02, SENS-03, SENS-04, SENS-05, SENS-06, SENS-07, DIALTUI-01, DIALTUI-02, DIALTUI-03, DIALTUI-04, DIALTUI-05, DIALTUI-06, DIALTUI-07, DIALTUI-08, DIALTUI-09, DIALTUI-10, DIALTUI-11, FILEVAL-01, MEMDIAL-01, MEMDIAL-02, MEMDIAL-03
**Note (2026-06-05)**: the DIAL-TUI SELECTOR (DIALTUI-01..11) is built here per the placement Decision Gate (hybrid: 141 ships doctrine, 143 renders it). 143 is the only UI-hint phase and the one that decides WHEN to surface a reach, so the selector belongs here. Hard constraint: NOT a scrollable widget -- render AS Shape F.1 Brain-variant; the "dial" is the confidence column + filled/empty-triangle hierarchy. This phase REQUIRES a UI-SPEC (run gsd-ui-phase -- DIALTUI-11). Design brief: ~/MindrianRooms/mindrianOS/product-evolution/v1.13.0-memory-system-review/DIAL-TUI-DESIGN-BRIEF.md.
**Canon parts**: Part 2 (team affordances + web hat-scoping: White=data/arxiv, Green=patents, Black=failure-cases), Part 2 Engine 1 (explore-domains / whitespace / reverse-salient as Act-1 reaches), Part 3 (sensors surface options at the Decision Gate), Part 4 (sensor-driven findings become graph edges), Part 8 (SENS-01/03/04 carry only generic handles to Brain/web -- never user content)
**Success Criteria** (what must be TRUE):
  1. First material in a session auto-fires `/mos:explore-domains` + `/mos:whitespace` + `brain_framework_chain($problem_type)` (generic handle only) -- the room is non-empty by turn 2
  2. A "the bottleneck is..." / lagging-component turn auto-fires `/mos:find-bottlenecks` / the reverse-salient engine
  3. A methodology-decision point auto-fires `brain_framework_chain` (CHAINS_TO next framework); an external-fact reference auto-fires WebSearch, hat-scoped per Canon Part 2
  4. A JTBD set/change re-weights the selector menus + Brain queries via `ADDRESSES_PROBLEM_TYPE`; filing an artifact triggers the cross-relationship cascade scan as a sensor
  5. A gate/milestone approach auto-fires the breakthrough scan (Category G) + investor-objection surface; a Brain/web scan of the sensor code confirms zero user-content egress
**Plans**: TBD
**UI hint**: yes

### Phase 144: Navigation Engine legacy->engine Flip
**Goal**: The single change that flips `routing_source: legacy -> engine`: the shipped Phase 91 navigation engine `decide()` reads `{local graph + BRAIN.md + trigger map}` instead of file-presence. The unifier wires the heuristic sensors and the derived tier into the engine's decision.
**Depends on**: Phase 142 (NAV-02 BRAIN.md derivation raising tier_mode + CASC-02 Phase 109 spine navigating), Phase 143 (the trigger map the engine reads)
**Requirements**: NAV-01
**Canon parts**: Part 3 (Option generation tier-awareness -- Mode A/B/Tier 0 routing), Part 2 (the engine selects the team's next verbs), Part 9 (the engine navigates SQL, not folders), Part 8 (Brain reach from the engine carries generic handles only)
**Success Criteria** (what must be TRUE):
  1. `decide()` reads the local graph + BRAIN.md + the trigger map -- a code path exists from each input into the decision
  2. A turn that should trigger a Brain call produces `routing_source: engine` (not `legacy`) in the decision trace when Brain is reachable
  3. The engine emits at least one `routing_source: engine` trace per session in a populated room -- the legacy-on-every-turn behavior is gone
**Plans**: TBD

### Phase 145: Scheduled Sensor Activation
**Goal**: The scout suite and its sub-sensors move off the manual `/mos:scout` trigger onto a cadence (session-start-throttled or cron), now that the sentinel layer is hardened and safe to auto-fire.
**Depends on**: Phase 140 (HARD-01..05 -- the scout is safe to auto-fire only after the 5 bugs are fixed), Phase 143 (the sensors that compose the suite)
**Requirements**: SCHED-01, SCHED-02
**Canon parts**: Part 2 Engine 1 (whitespace + reverse-salient + opportunity scan as scheduled Act-1 reaches), Part 8 (competitor watch is hat-scoped web SIGNAL; HSI-recompute stays LOCAL; zero Brain egress), Part 4 (scheduled findings become graph data)
**Success Criteria** (what must be TRUE):
  1. The scout suite (snapshot + health-check + deadline-monitor + competitor-watch + HSI-recompute + opportunity-scan) fires on a cadence without manual invocation
  2. The whitespace recompute, reverse-salient detection, opportunity-bank scan, and competitor watch each fire on the scheduled cadence
  3. A scheduled run produces signal without errors -- the Phase 140 hardening holds under auto-fire (no health-check crash, no NULL source_path, no backup pollution)
**Plans**: TBD

### Phase 146: Loop-Fires Acceptance Gate
**Goal**: Prove the loop FIRES, not merely exists. A scripted dogfood session in the mindrianOS room demonstrates all 5 SEED-008 gate-blocker criteria. If this gate does not pass, the milestone is renamed -- it does not ship as "Larry Reaches".
**Depends on**: Phase 141, Phase 142, Phase 143, Phase 144, Phase 145 (every feature phase)
**Requirements**: ACPT-01, ACPT-02, ACPT-03, ACPT-04, ACPT-05
**Canon parts**: Part 6 (dog-fooding mandate -- the proof runs in the mindrianOS room), Part 3 (the trace is the Decision Gate output), Part 2 (web hat-scoping in the external-fact criterion), Part 8 (the WebSearch + Brain reaches in the dogfood carry no user content), Part 9 (tier_mode rise proves SQL+Brain navigation), Part 10 (conversation-as-product ratifies at this gate)
**Success Criteria** (what must be TRUE):
  1. The dogfood session produces `routing_source: engine` (not `legacy`) in a decision trace (ACPT-01)
  2. A turn referencing external facts triggers WebSearch, hat-scoped per Canon Part 2 (ACPT-02)
  3. First material in the session triggers `/mos:explore-domains` -> the room is non-empty (domain tree + whitespace map + candidate Opportunity Bank entries) by turn 2 (ACPT-03)
  4. Filing an artifact surfaces the cross-relationship cascade findings to Larry mid-session (ACPT-04)
  5. BRAIN.md derives for the room's sections -> `tier_mode` rises above `tier_0` (ACPT-05)
**Plans**: TBD

### LARRYREACH Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 140. Sentinel & Instrumentation Hardening | 4/4 | Complete | v1.13.1-beta.6 |
| 141. Local Retrieval Spine + Capability Dial | 4/6 | In Progress|  |
| 142. Local Intelligence Wiring | 0/4 | Planned | - |
| 143. Insight Sensors | 0/0 | Not started | - |
| 144. Navigation Engine legacy->engine Flip | 0/0 | Not started | - |
| 145. Scheduled Sensor Activation | 0/0 | Not started | - |
| 146. Loop-Fires Acceptance Gate | 0/0 | Not started | - |

### LARRYREACH Coverage Map (32/32 requirements, no orphans, no duplicates)

| Requirement | Phase |
|-------------|-------|
| HARD-01 | Phase 140 |
| HARD-02 | Phase 140 |
| HARD-03 | Phase 140 |
| HARD-04 | Phase 140 |
| HARD-05 | Phase 140 |
| RETR-01 | Phase 141 |
| RETR-02 | Phase 141 |
| RETR-03 | Phase 141 |
| RETR-04 | Phase 141 |
| LARRY-01 | Phase 141 |
| LARRY-02 | Phase 141 |
| BUG-01 | Phase 141 |
| CASC-01 | Phase 142 |
| CASC-02 | Phase 142 |
| NAV-02 | Phase 142 |
| NAV-03 | Phase 142 |
| NAV-04 | Phase 142 |
| SENS-01 | Phase 143 |
| SENS-02 | Phase 143 |
| SENS-03 | Phase 143 |
| SENS-04 | Phase 143 |
| SENS-05 | Phase 143 |
| SENS-06 | Phase 143 |
| SENS-07 | Phase 143 |
| NAV-01 | Phase 144 |
| SCHED-01 | Phase 145 |
| SCHED-02 | Phase 145 |
| ACPT-01 | Phase 146 |
| ACPT-02 | Phase 146 |
| ACPT-03 | Phase 146 |
| ACPT-04 | Phase 146 |
| ACPT-05 | Phase 146 |

---

## Backlog (parking lot — unscheduled, not phase-bound)

### Testers Feedback Hub (Canny-style) — REGISTERED 2026-05-06

**Goal:** Build a public testers feedback / changelog / voting hub for MindrianOS, modeled exactly on https://timeosai.canny.io/. Use to (a) ship update posts the testers can read + comment on, (b) collect feature requests with upvotes, (c) surface a public roadmap with status tracking (Under Review / Planned / In Progress / Complete).

**Why now:** Current tester cohort (Lawrence, Adam, Aryeh, Justin) has no canonical channel for asynchronous feedback or visibility into what's shipped vs in-flight. Email + 1:1 doesn't scale past 5 testers. Canny.io pattern is the proven shape.

**Reference:** https://timeosai.canny.io/

**Open questions:**
- Self-host (Canny is paid) or use Canny directly?
- Public, or auth-gated to invited testers only?
- Sync with `docs/testers/<name>/` directories or replace them?
- Tie to a domain (e.g. feedback.mindrian.dev) or live under main marketing site?

**Status:** Unscheduled — promote to a numbered phase when current tester onboarding stabilizes.

### v1.14.0 scoped-backlog phases — REGISTERED 2026-06-01

Two phases scoped + parked to v1.14.0 (NOT in the frozen v1.13.1 chain). CONTEXT files on disk; promote via `/gsd:discuss-phase` / `/gsd:plan-phase` after v1.13.1 ships.

- **Phase 137 — Brain<->MindrianOS sync + compatibility harness.** Operationalizes the 130.7 dual-graph contract into a standing PR compat gate + weekly read-only sync drift report (GitHub Actions). `.planning/phases/137-*/137-CONTEXT.md`. (committed c15a7c86)
- **Phase 138 — Capability radar absorption + routing.** Turns `/mos:radar` from a reader into a router: a living capability ledger (Claude Code 2.1.148-159 findings), retrofit backlog (Opus 4.8 model floor, `CLAUDE_CODE_SESSION_ID` Brain scoping, SessionStart session-title, reloadSkills, defaultEnabled, disallowed-tools), and a `radar_findings:` forward-awareness contract so future phases incorporate findings before they are planned. Supersedes the dormant SEED-003. **Sequence FIRST in v1.14.0** (before consumer phases 133/134/135/136). Folds Bucket-C items here because Phase 121.5 already shipped. `.planning/phases/138-*/138-CONTEXT.md`.

**Status:** Scoped-backlog — both build after v1.13.1 ships.

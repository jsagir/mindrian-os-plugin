# MindrianOS Plugin

## What This Is

A commercial Claude Code + Cowork plugin delivering Mindrian's PWS (Personal Wisdom System) methodology as installable skills, commands, agents, and hooks. One-command install gives the user Larry (the AI teaching personality) plus a structured Data Room that captures insights and surfaces gaps, contradictions, and convergence; it runs on Claude's native capabilities and optionally connects to the remote Brain for enrichment.

## Core Value

Run the full PWS methodology (25 methodology bots, structured pipelines, and an intelligent Data Room) inside Claude Code with zero infrastructure, guided by the same teaching intelligence that powers the classroom.

## Current State

**Shipped:** v2.0.0 "Build the Loop" (closed 2026-08-13); latest verified release v2.0.0-beta.5 (npm latest=next, tag, marketplace pin, install cache, npx doctor 6/6). The loop is live: room.db context -> Brain query -> Larry joins -> HITL ratifies -> context updates, with honest refusal everywhere (Decisions #1/#8 amendment ratified on a released build), silent per-install Brain identity, CONTRACT-05 bounded read tier, hourly out-of-band availability probe, and the alias-collapse surgery executed and verified on the production graph (2026-08-11 admin sitting). Carried open by ruling: SWEEP-02 (enrichment-gated floor), CACHE-03 (live hit-rate session), AVAIL-03 (operator legs). Between milestones - next phase numbering starts at 253. Phase 264 (roadmap-type-selector-challenge-driven-act-chain-orchestrati, independent of the v2.1.0 milestone) shipped 2026-08-23: a silent classifier resolves a navigator's stated research goal to one of six scientific-roadmapping output shapes and the matching framework chain via the existing chain_resolve seam, and find-bottlenecks proves challenge-driven execution end to end via the already-shipped ralph_verify seam with a new synchronous adversarial critic (salient-governance.cjs) -- without touching chain-executor.cjs's B3/Canon Part 3 stop-condition contract (verified live via mutation test, not asserted). The live chain_resolve/chain_run flow does not yet inherit ralph_verify's benefit (chain_run's async path doesn't wire it) -- an explicitly named, navigator-approved follow-on, not a gap. Phase 257 (Part 8 enforcement locus, host-independent egress guard, v2.1.0) shipped 2026-09-03: the already-shipped Part 8 guard's verdict is now VISIBLE and CORRECTLY CLASSIFIED at the model-facing MCP shim -- a Part 8 block renders as a typed egress_blocked refusal instead of a well-formed empty envelope, Phase 254's egress_disclosure/refusal fields survive wrapDirective() instead of being silently dropped, all six Brain tool registrations migrated to strict z.strictObject input schemas (closes an undeclared-key smuggling gap Theo's measurement surfaced), and a wire-level invariant test locks zero-byte egress across every advertised tool. Coverage is stated per path, not glossed: P1 (client CLI stdio shim) and P2 (mindrian-os handlers) COVERED; P3 (client CLI direct HTTP + Desktop + Cowork) and P4 (Theo post-cutover) NOT COVERED, by explicit navigator ruling (D-01 far-side guard rejected on principle, D-02 direct-HTTP gap accepted-and-documented). Canon Custodian sign-off given in-conversation 2026-09-03. Code review (advisory gate) and the orchestrator's own cross-phase regression sweep each caught one real regression in a PRIOR phase's test (Phase 250-01's and Phase 127-00's regression locks both encoded a literal source-text pattern that broke under this phase's legitimate refactors) -- both root-caused and fixed as test-only repairs, verified with live mutation testing, no scope creep into production code the sign-off covered. Phase 267.2 (First-Install Hooked Loop Repair, Reward + Investment) shipped 2026-09-03: the FIRST_INSTALL surface's Reward and Investment legs (scored 2/10 and 1/10 by the 267.1 audit) are now wired, not just promised in prose. A UserPromptSubmit hook (scripts/first-install-router.cjs) classifies the first user sentence locally (lib/core/greeting-intent-detector.cjs, zero network calls) and fires the 30-Second MVA Instant Brief via detached spawn as a real reward, strictly before the investment ask, which now writes through the already-shipped identity_write/writeUserMdAtomic path with no second writer introduced (REQUIREMENTS.md MEMOP-08 held). A live 2/10-scored latent bug (identity_write's bare write, which would have clobbered the router's own seeded data the moment a real user reached it) was found by post-approval code review and fixed with a regression test, following the identical review-then-fix pattern Phase 257 used earlier the same day. One collision case (the investment ask landing mid-way through an in-flight /mos:ignite birth flow) was partially closed and the harder residual honestly deferred (267.2-CR-02-DEFERRED.md), not silently dropped. The folded ignite Door 1 persona-card gap (missing mentor among 7 frozen ROLE_BLEND_KEYS) closed too. Canon Custodian sign-off given in-conversation 2026-09-03 via a real AskUserQuestion card (a Stop-hook, check-card-fire.cjs, rejected an initial ASCII-box presentation and required it).

v1.0 through v1.9.0 = 52 commands, 8 agents, 49 MCP tools. 6-view Data Room Presentation System (Dashboard, Wiki, Deck, Insights, Diagrams, Graph). Canvas knowledge graph with particles and glow. BYOAPI chat with Larry. Git integration (optional), KuzuDB automatic backbone, HSI pipeline, binary asset filing, Vercel one-click deploy. Dual themes (De Stijl dark + PWS light). MindrianOS branding enforced. Google Drive API integration. Model Data Room: 168 artifacts across 10 sections from real evidence. Self-analysis: HSI found 20 innovation pairs, Investment Thesis gate 7/10, reverse salient in business-model.

**Milestones shipped:**
- v1.0 MVP (2026-03-22) -- 5 phases, 20 plans
- v2.0 Meeting Intelligence (2026-03-24) -- 4 phases, 13 plans
- v3.0 MCP Platform (2026-03-25) -- 10 phases, 26 plans
- v4.0 Brain API & CLI UI (2026-03-29) -- 6 phases, 12 plans
- v5.0 Presentation System (2026-03-31) -- 8 phases, 17 plans
- v5.1 User Outlets (2026-03-31) -- 5 phases, 7 plans
- v1.6.0 Powerhouse (2026-03-31) -- 8 phases, parallel execution, spectral OM-HMM, DbA, model routing
- v6.2 RoomHub + SnapshotHub (2026-04-01) -- 5 phases, adaptive room detection, 7 showcase views, SnapshotHub export
- v1.8.6 MindrianRooms (2026-04-06) -- 6 phases, 35 requirements, centralized rooms, wicked hierarchy navigator
- v1.8.8 Brain Graph Optimization (2026-04-07) -- causal discovery, lazy graph bridge, fragmentation cleanup, teaching wiring, dummy-proof install
- v1.9.0 Model Data Room (2026-04-08) -- Google Drive integration, 168-artifact model room, HSI self-analysis, Investment Thesis, knowledge graph (179 nodes/383 edges)
- v1.16.0 Infrastructure Remediation (2026-08-10) -- 12 phases (235-245), 67 plans: CIRS commit gate + seam-liveness, room.db data-loss fixes, reach + Decision Gates rewiring, Brain-access surface, memory Layer 2, Feynman-MINTO, Moat hardening, voice-glyph, semantic triggers, reach-brain-signal loop closed (v1.10-v1.15 shipped in place across the beta trains; see MILESTONES.md)
- v2.0.0 "Build the Loop" (2026-08-13) -- 7 phases (246-252), 19 plans: the complete-product loop live with honest refusal, constitution amendment ratified + shipped in lockstep with the guard sweep, silent Brain identity, bounded read tier, graph census + alias-collapse surgery executed on production, availability probe. Archives: milestones/v2.0.0-*.md

## Current Milestone: v2.1.0 "Green the Floor"

**Goal:** Every framework a methodology command invokes is READY when Larry reaches for it -
the flagship floor goes green on a pipeline that no longer damages what it ingests, SWEEP-02
lands, and the v2.0.0 ledger closes fully.

**Target features:**
- Ingest pipeline fixes, cross-repo (brain repo): live-node prop drop (false-success),
  dedup self-loop minting, normalizeName alias-aware direct-match branch
- Tier A batch: the 20 frameworks at 3/4 reach 4/4 via classified pattern_type rulings
  (carded batch, guarded SETs until the prop-drop fix lands)
- Flagship gap closure: 18 readiness misses authored through the proven payload template,
  PEST Analysis absence resolved (ingest or de-list ruling), Scenario Planning match-leg
  exception ruled (fix normalizeName or record the documented exception in the floor gate)
- Floor green (check-flagship-floor.cjs exit 0) then SWEEP-02's fixture inversion lands
- Demand-ranked enrichment machinery for the 90-framework long tail (queue-driven, never bulk)
- v2.0.0 carry-fold: CACHE-03 live hit-rate measurement, AVAIL-03 operator legs, the
  Bolt-capable checkpoint queue (7 index DROPs + Nested Hierarchies self-loop)
- Seeds in scope: SEED-framework-coverage-live-population (re-source the UN-WIRED gate from
  the live :Framework population), SEED-075 (grading checks framework grounding first)

**Key context:** Floor at kickoff measured 8/28 (2026-08-13 live run). Graph: 146 canonical
frameworks - 5 at 4/4, 20 at 3/4, 22 at 2/4, 9 at 1/4, 90 at 0/4. An untracked enrichment
wave (2026-08-11/12, second machine) lifted Red Teaming, S-Curve, JTBD - reconcile its
records first. Navigator directive: Fable model on this milestone's planning + research legs.

## Previous Milestone: v2.0.0 "Build the Loop" (completed 2026-08-13)

**Goal:** Make the loop real: local context triggers -> methodology-graph query -> Larry
operates the join -> human ratifies the insight -> context updates. Honesty before
hard-require: Larry never serves methodology the graph did not give, without saying so.
THE MOST CRITICAL MILESTONE TO DATE (navigator, 2026-08-10): the step that makes MindrianOS
closest to a complete product.

**Grounding:** docs/2026-08-10-HANDOFF-build-the-loop-milestone.md (navigator-approved at a
live Decision Gate; supersedes the tier0-removal handoff's sequencing). Same-day primary-source
probes of BOTH graphs (the Memgraph Brain via its own tools; the langtalks corpus for
context-engineering doctrine). Phase 245 is the direct ancestor. Seeds folded in:
SEED-045 (Brain Orchestration Advisor), SEED-008 (Close the intelligence loop),
SEED-011 (Brain Silent Identity), SEED-014 (Brain repo as deployment unit).

**Target features:**
- Live-verify the beta.13 Brain path in a fresh session, then run the Cypher census
- Contract the Brain tool surface to the loop-serving tools (cross-repo with
  jsagir/brain_ProblemsWorthSolving; retire or sidecar the LLM-dependent tools)
- Context-driven framework enrichment prioritized by live readiness misses -- never bulk
- Honesty rail + doctrine amendment (Decisions #1 and #8 rewritten together, one unit)
- Cache-aware trigger/hook redesign (stable prefixes; per-turn injection measured first)
- MCP-First FOLDED IN (navigator 2026-08-10, absorbing the registered v1.17.0 slot): one
  shared room-resolution ladder replacing the eight gate-then-fallthrough copies,
  room_bind authoritative for its session -- the local-context half of the loop
- Guard sweep last (101 guards, 82 tests; tier-0-no-key fixture repurposed to refusal)
## Platform Vision: v2.0 Mindrian Platform -- SQLite + MCP Server (aspirational, partially shipped)

**Goal:** Replace the dead KuzuDB with SQLite (graph + memory system), then ship MindrianOS intelligence as a 23-tool MCP server with interactive UI (MCP Apps) that any LLM host can use.

**Target features:**

Workstream A -- SQLite Migration + Memory System:
- Replace KuzuDB with SQLite + better-sqlite3 (same API, concurrent access via WAL)
- Graph tables: nodes, edges, concepts (replaces .lazygraph/)
- Memory tables: identity (L0), facts with temporal validity (L1), sessions (L2), fragments (L3)
- Assumption tracking with validity lifecycle (untested/supported/contradicted/stale)
- Natural language graph queries (Larry translates to SQL, no Cypher exposure)
- Migrate all 24+ files touching KuzuDB (lazygraph-ops.cjs is the single replacement point)

Workstream B -- Mindrian MCP Server (23 tools):
- Tier 1: Brain intelligence (6 tools -- brain_ask, brain_query, brain_search, brain_grade, brain_route, brain_chain)
- Tier 2: Room intelligence (11 tools -- room_analyze, room_state, room_file, hsi_score, reverse_salients, whitespace_detect, blindspot_coverage, surprise_score, novelty_rank, disruption_index, meeting_extract)
- Tier 3: Graph + Export (6 tools -- graph_query, graph_index, visualize, export_snapshot, persona_generate, opportunity_scan)
- Larry Lite system prompt (200 lines teaching methodology instinct, not personality)
- Co-development rule: every new capability ships as both plugin command AND MCP tool

Workstream C -- MCP Apps (Interactive UI):
- MCP Apps integration (SEP-1865, production-ready Jan 2026, Anthropic + OpenAI co-developed)
- De Stijl dashboards render in-chat via ui:// scheme
- Knowledge graph visualization as MCP App
- Wiki view as MCP App
- Works in Claude, VS Code, ChatGPT, any MCP Apps-compatible client

**Key context:**
- KuzuDB abandoned Oct 2025 (archived on GitHub, no maintenance)
- SQLite WAL mode solves MCP/plugin concurrent access (the blocker for co-development)
- lib/core/*.cjs is already the shared core -- MCP tools wrap existing functions
- room.db at room/.mindrian/room.db replaces .lazygraph/ directory
- 24+ files touch KuzuDB but 90% route through lazygraph-ops.cjs (single replacement point)
- MCP Apps SDK: @modelcontextprotocol/ext-apps

## Previous Milestone: v1.9.0 Model Data Room + Self-Analysis (SHIPPED 2026-04-08)

**Goal:** Prove MindrianOS capabilities by building a comprehensive Data Room about itself -- pulling from Google Drive meetings, Gmail, GSD artifacts, Claude memory, and plugin repo. Then run HSI, Investment Thesis, and knowledge graph analysis on the result.

**Delivered:**
- 168 artifacts across 10 sections (meetings, research, methodology, solution-design, competitive, problem-definition, market, business-model, team, team-execution)
- Google Drive API integration (45 meeting transcripts + 4 whitepapers downloaded via OAuth)
- Knowledge graph: 179 nodes, 383 edges, 198 cross-references
- HSI Tier 1: 20 innovation pairs, reverse salient in business-model (OM-HMM 33.6)
- Investment Thesis gate: 7/10 (weak on momentum, funding justification, valuation)
- 19 people mapped across 45 meetings with roles and attendance

## Previous Milestone: v1.8.8 Brain Graph Optimization + Dummy-Proof Install (SHIPPED 2026-04-07)

**Goal:** Execute the Brain normalization scripts (already written in v1.8.2 roadmap), enriching the Neo4j teaching graph with framework chains, prerequisite edges, stage mappings, and wiring orphaned nodes. Simultaneously, test and polish the install experience with screenshots, error handling, and onboarding flow verification.

**Target features:**

Workstream A -- Brain Graph Optimization (phases 52-55 from v1.8.2):
- FEEDS_INTO enrichment (4 -> 35+ Framework chains including full PWS spine)
- PREREQUISITE edges (0 -> 14, enables "do X before Y" warnings)
- TYPICAL_AT stage mapping (4 -> 30+, powers /mos:suggest-next and /mos:act)
- ProblemType consolidation (150+ nodes -> 4 canonical + ALIAS_OF + SUBTYPE_OF)
- DataRoomSection + CaseStudy + FrameworkAgent wiring
- Book dedup and label normalization

Workstream B -- Dummy-Proof Install Experience:
- Test install guide page on fresh Mac + Windows environments
- Generate screenshots for every install step
- Improve error messages in scripts (human-readable, not stack traces)
- Test /mos:onboard flow end-to-end
- Verify email template system works for new user onboarding
- Document common failure modes with fixes

**Previous milestone (v1.8.6 MindrianRooms):**
Shipped 2026-04-06. 6 phases, 35 requirements. Centralized rooms, wicked hierarchy navigator, dual-graph layer.

**Target features:**
- ICM Root Structure: ~/MindrianRooms/ with Layer 0 (CLAUDE.md) and Layer 1 (INDEX.md) auto-generated on first room creation
- resolve-room script update: default path resolution from ~/room/ and ~/rooms/ to ~/MindrianRooms/
- room-registry script update: new rooms created under ~/MindrianRooms/[slug]/
- new-project command update: room creation targets MindrianRooms, generates ICM files if missing
- rooms command update: display paths, creation paths, and registry point to MindrianRooms
- Skill activation update: room-passive and room-proactive detect rooms in new location
- Migration script: detect legacy ~/room/ and ~/rooms/ layouts, offer guided migration with symlink option
- INDEX.md auto-refresh: updates when rooms are created, archived, or stage changes
- Old path cleanup guidance after confirmed migration

**Previous milestone (v1.8.2 Brain Graph Optimization):**
Defined and roadmapped Brain graph enrichment (4 phases, 27 requirements). Normalization scripts written. Ready to execute separately.

**Research basis:**
- Live graph audit (2026-04-06): 32,612 nodes, 170,791 rels, 828 labels, 1,633 rel types
- 5-layer architecture documented: L1 Curated (281), L2 Document (1,454), L3 Entity (5,316), L4 Lazy (8,425), L5 Taxonomy (970)
- Critical finding: L1 Curated and L4 Lazy have ZERO direct edges. Bridge is 3-hop through Chunks
- FEEDS_INTO: only 4 real Framework->Framework edges for 86 frameworks
- TYPICAL_AT: 4 edges total. PREREQUISITE: 0 edges.
- ProblemType fragmented across 150+ nodes (LazyGraphConcept "Well-Defined Problem" has 348 rels vs canonical 83)
- 7/10 FrameworkAgents orphaned, 19/30 CaseStudies orphaned, 0 grading calibration data
- Scripts already written: brain-normalize-final.cypher, brain-normalize-supplement.cypher, brain-normalize-problemtype.cypher
- Architecture reference: references/brain/graph-architecture.md with 10 Cypher patterns

**Target features:**

Causal Discovery Optimization:
- FEEDS_INTO enrichment (4 -> 35+ Framework chains including full PWS spine)
- PREREQUISITE edges (0 -> 14, enables "do X before Y" warnings)
- TYPICAL_AT stage mapping (4 -> 30+, powers /mos:suggest-next and /mos:act)
- ADDRESSES_PROBLEM_TYPE cleanup (remove __Entity__ noise, add effectiveness scores)
- 2D ProblemType matrix wiring (Definition x Complexity with Framework recommendations)
- Full provenance chain: Book -> GROUNDS_FRAMEWORK -> Framework -> ADDRESSES_PROBLEM_TYPE -> ProblemType

Lazy Graph Optimization:
- ALIAS_OF bridge from high-rel LazyGraphConcepts to canonical nodes (1,900+ orphaned rels become findable)
- Promote valuable LazyGraphConcepts (3+ Framework CO_OCCURS) to Concept
- Clean 511 orphan LazyGraphConcepts
- CO_OCCURS weight-based query patterns for semantic discovery (weight >= 2 filter)
- 3-hop bridge pattern: LazyGraph -> Chunk -> Entity -> Framework

Fragmentation Cleanup:
- ProblemType consolidation (150+ nodes -> 4 canonical + ALIAS_OF + SUBTYPE_OF)
- Book dedup (88 null-title + 6x duplicates) + INTRODUCES_FRAMEWORK mislanding fix
- Opportunity Bank (21 nodes -> 1 canonical with full wiring)
- DictionaryTerm dedup (8x copies per problem type)
- Label normalization (lowercase->PascalCase, base/UNKNOWN removal)

Agent + Teaching Layer Wiring:
- FrameworkAgents 10/10 wired (DERIVED_FROM + APPLIES_TO + IMPLEMENTED_BY)
- CaseStudies 26+/30 wired (Challenger, NASA, Marconi, Naval Aviation + student projects)
- Mullins Model Validation: Technique -> ValidationTool, full pipeline gateway
- Workshop->TEACHES->Framework (0 -> 16+ edges)
- Bot->IMPLEMENTS->Framework (0 -> 15+ edges)
- CorePrinciple->GOVERNS (0 -> 20+ edges)
- Grading calibration gap flagged as SystemGap node (0 Example nodes with rubric scores)

**Architecture:**
- All normalization uses APOC (2026.03.0 confirmed on Aura): mergeNodes for dedup, periodic.iterate for batch ops
- Write operations via Neo4j Aura console or write MCP tool
- Verification via read MCP (mcp__my-neo4j__read_neo4j_cypher)
- Curly apostrophe (U+2019) in "Devil's" handled via STARTS WITH prefix matching
- ALIAS_OF preserves LazyGraph CO_OCCURS fabric while making canonical nodes discoverable

**Previous milestone (v1.7.0 Causal Reasoning Layer):**
Defined causal engine architecture. This milestone executes the Brain graph enrichment that v1.7.0 designed but never ran.

## Notion Template Gap Close (Captured 2026-04-14)

Compared against a third-party Notion "Problem Worth Solving" template the user shared on 2026-04-14. The Notion template has six structural features MindrianOS does not, all of which are cheap to adopt and complement the dynamic-intelligence wins MindrianOS already owns. Captured as a focused backlog so they do not get lost between Phase 81 (v1.10.2, landed) and the v1.11.0 release-pipeline work.

1. **Per-section one-liner STATEMENT (HIGH value).** Notion forces a single-sentence callout at the top of Problem, Solution, Business Model, Market Analysis. MindrianOS has ROOM.md + STATE.md + (v1.10.2) MINTO.md essence field, but none surface as "this is THE sentence for this section, always visible." Phase 81 solves the same psychology at the artifact level; this would do it at the section level. Implementation: promote an `essence` or `statement` frontmatter field in ROOM.md rendering, or add a `STATEMENT.md` per section. Candidate for v1.10.8 or v1.11.0 scope. (Shifted v1.10.3 -> v1.10.4 -> v1.10.5 -> v1.10.6 -> v1.10.7 -> v1.10.8 on 2026-04-14 because the v1.10.3 and v1.10.4 slots were taken by statusline upgrade releases, v1.10.5 was taken by the Lawrence wiki artifact injection fix (Phase 82), and v1.10.7 was taken by the cross-session scope injection + write interception + intent classifier + honesty layer release (Phase 83). Sixth shift. Smart-notebook work remains the next feature milestone after v1.10.7.)

2. **Latest Deck persistent slot (HIGH value).** A top-level always-visible slot for the current pitch deck. MindrianOS has `exports/` but no concept of "the current canonical deck." When an investor opens the room they should not have to hunt. Implementation: `room/deck/` section with a `LATEST.md` that `/mos:export thesis` updates on each run, or a pinned slot in ROOM.md.

3. **Marketing and Sales split from Market Analysis (MEDIUM value).** Notion treats these as distinct sections. MindrianOS conflates them in `market-analysis/`. Different JTBD: market-analysis answers "is there a market," marketing-sales answers "how do we reach and convert." Simon's near-decomposability argument applies. Implementation: add `marketing-sales/` as a new room section, update session-start room map, update classifier in vault import.

4. **Funding Options as a room section (MEDIUM value).** MindrianOS has `/mos:funding` and the opportunity-bank skill but no `funding/` room section. A section would make grants and investors a first-class subsystem visible in the graph, not just command output. Small structural lift, big visibility win.

5. **Value Proposition as a top-level section (LOW-MEDIUM value).** Notion treats VP as a peer section between Problem and Business Model. MindrianOS folds it into one or the other. Arguably VP IS the hinge and deserves its own room. Lower priority because `/mos:value-proposition` skill already exists.

6. **Self-guiding room (MEDIUM value).** Notion embeds its own usage instructions INSIDE the page. A stranger can open a Notion template without a CLI, without Larry, and know what to do. MindrianOS equivalents (`/mos:onboard`, session-start nudges) only work through the CLI. The Dror-activates-alone success criterion from user context lives here. Implementation: enhance ROOM.md bootstrapping so the room is self-explanatory in Obsidian and on GitHub too, not just via Larry. Candidate companion for items 1 and 2.

**Honest summary.** The Notion template wins on static user-facing clarity (one-liners, latest-deck slot, self-guiding, finer-grained sections). MindrianOS wins on dynamic intelligence (graph, MINTO reasoning, meetings, proactive surfacing, now Feynman-MINTO). The Notion wins are all cheap structural additions, not new architecture. Items 1, 2, 4 are the priority set because they are small lifts with high visibility impact and they align with the Dror-activates-alone forcing function from the user context file.

**What NOT to steal from Notion.** The template has no relationship graph, no MINTO reasoning, no meeting intelligence, no proactive discovery, no filing cascade, no Brain enrichment, and no methodology commands. MindrianOS keeps all of that. The gap close is additive.

---

## v1.14.0 - "The Visible Room" (Captured 2026-05-07)

The next named arc after v1.13.0 "The Closed Loop." Claims the v1.14.0 slot
explicitly with thesis, methodology spine, and hard release gate.

**Thesis (updated 2026-05-07 evening with SnapshotHub fusion):** "Make the invisible visible - inside and outside the room. Wiki for the navigator (internal); SnapshotHub for everyone else (external). One rendering pipeline, two surfaces, same DNA."

**Why fuse SnapshotHub into v1.14.0:** Wiki and SnapshotHub share renderer DNA - both consume the same markdown source-of-truth, use the same `lib/wiki/page-renderer.cjs` + `@ig3/markdown-it-wikilinks` plugin + `lib/wiki/graph-links.cjs`, render with the same De Stijl tokens, and `dashboard/export-template.html` (2462 lines, shipped) already proves one pipeline serves both audiences. SnapshotHub IS the wiki "going public" - same artifact, packaged for external sharing. Splitting them would mean maintaining two renderer pipelines that should be one.

**Scope (Phase 126 NEW per-room-wiki-completeness, 5 sub-plans, ~8 working days, PLUS Phase 104 finish 104-00 Wave 0; Phase 104 3/4 plans already shipped in v1.13.0):**
- 126-01: wire `scripts/resolve-room` into serve-wiki / serve-dashboard / serve-presentation; ANSI strip; diagnostic empty-state. Closes Lawrence's P1 blocker open since 2026-03-31.
- 126-02: graph as wiki homepage + auto-create on `/mos:new-project` (Phase 19 mandates from March 2026, never shipped).
- 126-03: Wikipedia zones (infobox + backlinks + see-also + red-link) + section-to-section `[[wikilink]]` hyperlink wiring + cross-room link resolution.
- 126-04: click-red-wikilink-to-research + Phase 32-02 chat tool-call wiring (Larry-in-the-wiki).
- 126-05: 9-tier freshness frontmatter + content gap dashboard + multi-layout Cytoscape with clustering + neighborhood highlighting.

**Plus deferred from Closed Loop / fused into v1.14.0:** Phase 124 (JTBD Inference Engine, was Phase 100), Phase 125 (Selector library JTBD-aware, was Phase 101), Phase 112 (GraphRAG retrieval + Room Budding), **Phase 123 (SnapshotHub MVP, FUSED 2026-05-07 - same renderer pipeline as wiki, consumes SEED-003 A5)**, SEED-001 (sub-room atomic wiring), SEED-004 (write-scope-check nested-room bug). **Splits to v1.14.5:** Phase 122 (Researcher Wedge /mos:gate, was Phase 107) - different thesis (opportunity-gating, not visibility).

**Methodology spine (Brain-validated 2026-05-07):** Design Thinking → JTBD (prereq) → User Journey Mapping (PRIMARY METHOD, TYPICAL_AT VentureStage "Opportunity Identified", REVEALS "Making the Invisible Visible") → Process Mapping → Reverse Salient Analysis (already shipped Phase 89). The four `HAS_PROCESS_STEP` nodes Brain returned for User Journey Mapping (Cast a Wide Net / Track Multiple Dimensions / Find Hidden Problems / Follow Workarounds) map 1:1 onto the four user-facing wiki sprint deliverables.

**HARD release gate:** Lawrence Aronhime tester preview on a multi-room install confirming all 6 user-facing behaviors (room resolution, graph homepage, auto-create, section hyperlinks, cross-room links, red-link rendering). Without his sign-off, v1.14.0 ships only beta - not final. Per Canon Part 6 Dog-Fooding Mandate.

**Trigger to expand into Phase 126 CONTEXT:** Path C closes (Phase 110 + Phase 114 both merged to main) AND user explicitly says "expand the wiki sprint memo into Phase 126 CONTEXT."

**Provenance:** triggered by user reaction to LLM-Wiki repo (github.com/Oshayr/LLM-Wiki) on 2026-05-06 - "I tried such a wiki with /mos:wiki and wikilinks but this one looks better." 13/13 claim validation against current code 2026-05-07. Brand discipline + JTBD orientation is the moat, not feature parity.

**4-layer protection lock (planted 2026-05-07):**
1. SEED-006: `.planning/seeds/SEED-006-mindrian-wiki-sprint-the-visible-room.md` (auto-surfaces during /gsd:new-milestone v1.14.0)
2. MILESTONES-NAMING.md Arc 4.5 "The Visible Room" claimed (this slot now belongs to the wiki sprint; cannot be claimed by another feature)
3. Lawrence-gate baked into both seed and arc as HARD release condition
4. This PROJECT.md row + companion action item in `~/MindrianRooms/mindrian/mindrianOS/team-execution/`

**Memo:** `.planning/phases/_backlog/v1.14-mindrian-wiki-sprint.md`

---

## v3.0 Backlog (Captured Ideas)

### FIRST-CLASS v3.0 SCOPE ITEM: MCP Sampling migration for Feynman-MINTO (bridge from Phase 81)

**Context.** Phase 81 (v1.10.2 Feynman-MINTO Hybrid) ships the tier-1 LLM path via direct Anthropic Messages API using native `fetch` and the `ANTHROPIC_API_KEY` env var (see `.planning/phases/81-feynman-minto-hybrid/81-RESEARCH.md` Q(b) resolution). This was the correct choice for v1.10.2 because the v3.x MCP server with sampling support is not built yet, and inverting dependency order to build an MCP server as a prerequisite for Phase 81 would have blocked the bridge release indefinitely.

**The tradeoff Phase 81 accepts.** Users must set `ANTHROPIC_API_KEY` to get tier-1 Feynman-MINTO. This partially bends CLAUDE.md Decision #1 (one-command install). Tier-0 fallback (pre-81 deterministic MINTO + AAAK footer) preserves zero-config for users without a key, so the plugin still works with one command. But the ideal end state is that the user's existing Claude Code / Desktop / Cowork session provides the LLM, with no second API key and no second billing relationship.

**The v3.0 migration.** MCP Sampling (`sampling/createMessage` in the MCP spec) is the mechanism. Once the MindrianOS MCP server is built:
1. The MCP server registers sampling capability in its initialization handshake
2. `lib/memory/llm-call.cjs` gains a second code path that, when running inside an MCP server context, calls `server.createMessage(...)` instead of shelling out to Anthropic via fetch
3. The host (Claude Code / Desktop / Cowork) serves the completion from the user's existing session, billed to the user's existing plan
4. `ANTHROPIC_API_KEY` becomes optional rather than required for tier-1
5. CLAUDE.md Decision #1 is fully restored for tier-1 Feynman-MINTO

**Non-blocking for Phase 81.** Ship Phase 81 as-is with the direct-fetch path. The v3.0 MCP sampling migration is an additive enhancement, not a rewrite. The `llm-call.cjs` abstraction in 81-01 is specifically designed so the sampling path can be added later without touching `feynman-stages.cjs` or the generator.

**v3.0 milestone scope must include:**
- MCP Sampling capability on the MindrianOS MCP server (`@modelcontextprotocol/sdk` 1.27.1+ supports this)
- Dual-path `llm-call.cjs` (detect MCP context, prefer sampling, fall back to direct fetch, then tier-0)
- CHANGELOG entry retiring the `ANTHROPIC_API_KEY` requirement for tier-1 when in MCP context
- Regression test that Feynman-MINTO works identically via sampling and via direct fetch (same fixtures, same structural assertions)
- Docs update: "one-command install" fully restored for Desktop/Cowork tier-1 users

**References.**
- `.planning/phases/81-feynman-minto-hybrid/81-CONTEXT.md` D-7 (LLM path abstraction was designed for this migration)
- `.planning/phases/81-feynman-minto-hybrid/81-RESEARCH.md` Q(b) (why direct fetch now, why MCP sampling later)
- MCP spec: https://modelcontextprotocol.io/docs/concepts/sampling
- `@modelcontextprotocol/sdk` `server.createMessage(...)` API

---

### Other v3.0 Backlog Items

- Opportunity Bank (room section + proactive grant discovery agents)
- Funding Room (non-dilutive/dilutive/grants sub-rooms, GSD-style process per grant)
- AI Team Member Personas (domain experts generated from intelligence + Bono perspectives)
- Wiki-style Data Room Dashboard (hosted Render/Vercel, nodes = pages, edges = hyperlinks)
- Obsidian Plugin (room/ as Obsidian vault with graph view)
- Obsidian-compatible rooms (ship .obsidian/ config template with room creation -- near-zero effort)
- Chrome Plugin (meeting join + room access)
- Room as Remote MCP (collaborative team access from local/remote)
- MindrianOS CLI tools layer (mindrian-tools.cjs like gsd-tools.cjs)
- Data Room level status bar (CLI nested room/section context)
- Cursor + Antigravity/Windsurf compatibility (ICM = universal interface)
- Risk vs Uncertainty blog post (adapted for MindrianOS)
- Site style guide + generated images per article
- Nanobot multi-channel Larry (wrap MCP server in Nanobot agent -- Larry on Telegram, Discord, WhatsApp, Slack, Email via github.com/HKUDS/nanobot. MCP-native, full MCP-UI rendering, 15+ messaging channels. v3.0+ multi-channel distribution.)
- OpenClaw skill (Larry as always-on daemon -- 24/7 proactive intelligence, scheduled tasks, meeting capture from any channel)

## Requirements

### Validated

v1.0 shipped (2026-03-22):
- ✓ One-command install, Larry active immediately (v1.0, Phase 1)
- ✓ 26 methodology commands + 5 Brain commands + 7 infrastructure commands (v1.0, Phases 2-4)
- ✓ Data Room with 8 sections, proactive intelligence, pipeline chaining (v1.0, Phases 2-3)
- ✓ De Stijl dashboard with knowledge graph + chat (v1.0, Phase 3.1)
- ✓ PDF export (thesis, summary, report, profile) (v1.0, Phase 3.2)
- ✓ Brain MCP integration with 4 agents (v1.0, Phase 4)
- ✓ Self-update, context awareness, capability radar (v1.0, Phase 5)
- ✓ Analytics + learning system (v0.2.0)
- ✓ Auto-update notification at SessionStart (v0.2.0)

v2.0 shipped (2026-03-24):
- ✓ Meeting filing pipeline with 3 input modes (paste/file/audio) + Velma transcription (v2.0, Phase 6)
- ✓ Speaker identification with 12 roles, ICM nested folder profiles, proactive web research (v2.0, Phase 6)
- ✓ Team room structure with dynamic folders, multiple roles, status lifecycle (v2.0, Phase 7)
- ✓ Full meeting archive packages (7 files per meeting + audio copy) (v2.0, Phase 7)
- ✓ Cross-meeting intelligence: convergence, contradictions, action items, team patterns (v2.0, Phase 8)
- ✓ Read AI / Vexa / Recall.ai MCP integration + --latest auto-fetch (v2.0, Phase 8)
- ✓ Three-layer knowledge graph with [[wikilinks]] and lazy graph pattern (v2.0, Phase 9)
- ✓ Dashboard timeline mode with layer toggles, preset views, edge animations (v2.0, Phase 9)
- ✓ Minto pyramid meeting-report PDF export with speaker attribution (v2.0, Phase 9)
- ✓ Simon's Architecture of Complexity as basis theorem (v2.0, architecture)

v4.0 shipped (2026-03-29):
- Brain API key management with Supabase, approve/revoke/extend, plan-gated brain_write guard (v4.0, Phase 20)
- CLI UI Ruling System: 4-zone anatomy, 5 body shapes, 12 glyphs, session start contract (v4.0, Phase 21)
- Self-teaching admin panel (/mos:admin) with help visibility filtering (v4.0, Phase 22)
- Multi-room management: registry, /mos:rooms (6 subcommands), room lock, header canary (v4.0, Phase 23)
- Autonomous engine: /mos:act with Brain-driven framework selection, chain mode, dry-run (v4.0, Phase 24)
- De Stijl HTML export: Mondrian grid, document reader, intelligence view, Cytoscape graph (v4.0, Phase 25)

### Active

Deferred from v3.0:
- [ ] Room as Remote MCP (collaborative team access)
- [ ] Opportunity Bank (room section + proactive discovery agents)
- [ ] Funding Room (non-dilutive/dilutive/grants sub-rooms)
- [ ] AI Team Member Personas (domain experts + Bono perspectives)

### Out of Scope

- Full-stack web UI (V2 approach) - plugin replaces the need for Next.js/FastAPI/CopilotKit
- Mobile app - Claude surfaces handle this
- Real-time collaboration features - Cowork handles this natively
- Brain graph editing by users - users get intelligence, never see or modify the graph
- Custom LLM integration - Claude-native only
- Payment processing in plugin - handled externally via Anthropic marketplace / Stripe

## Context

**Source material ready to port:**
- MindrianV2: 25 methodology prompts (Python), Larry personality (8 .md files), mode engine, router, 18 skills
- MindrianOS: 16 Claude Desktop project specs with full methodology definitions, 5 design docs, grading rubrics
- Brain: Neo4j Aura with 27,904 nodes, 19,987 relationships, 12,485 Pinecone embeddings -- deployed as MCP server at brain.mindrian.ai
- ICM paper (2603.16021v2): Interpretable Context Methodology - folder structure as orchestration
- GSD patterns from ~/.claude/get-shit-done/ for state management

**Architecture decisions:**
- ICM-native: no framework code, folder structure IS orchestration
- "Configure the factory, not the product" - Layer 3 (reference/factory) is the IP, Layer 4 (working artifacts) is user's work
- Every output is an edit surface; plain text as universal interface
- Fresh subagent contexts prevent context rot (GSD pattern)

**Distribution:**
- Anthropic marketplace - anyone with Claude can install
- Break-even on Brain tier: 5-17 subscribers at $9/month

## Constraints

- **Plugin format**: conform to Claude Code plugin structure (commands/, skills/, agents/, hooks/, .mcp.json, settings.json, plugin.json).
- **No server infrastructure**: runs entirely in Claude's environment; only the optional Brain MCP is remote.
- **Brain IP protection**: the teaching graph, grading intelligence, and mode-engine calibration are proprietary, served via MCP, never distributed.
- **Three surfaces**: every feature works across CLI, Desktop, and Cowork without surface-specific code.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| ICM-native architecture | Folder structure as orchestration eliminates framework code; paper-backed methodology | - Pending |
| GSD state management | STATE.md per room with master aggregation; proven pattern from GSD | - Pending |
| Brain as remote MCP | IP stays on server; users get intelligence not data; MCP is Claude-native | - Pending |
| LazyGraph optional | Enhances but never required; graceful degradation; Neo4j Aura Free is zero cost | - Pending |
| Tier 0 fully functional | Free tier works completely; Brain adds enrichment not gatekeeping | - Pending |
| Pipeline chaining through Room | Week 7 pattern; output becomes structured input; Room drives routing | - Pending |
| Larry as default agent | Immediate personality; zero-config experience; mode engine differentiates | - Pending |
| Three-surface compatibility | Same plugin, same workspace, same CLAUDE.md; Cowork gets 00_Context/ | - Pending |
| One-command install | Zero config required; Larry talks immediately; optional enhancements later | - Pending |
| Factory/Product separation | Layer 3 = IP (factory), Layer 4 = user work (product); clean ownership boundary | - Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check - still the right priority?
3. Audit Out of Scope - reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-03 after Phase 267.2 (first-install-hooked-loop-repair-reward-investment-inserted, v2.1.0) completed. 10 plans across 7 waves: 267.2-01 recorded the pre-change baseline AND empirically measured the reward architecture decision (the 30-Second MVA Instant Brief pipeline takes up to 5.3s, over the 3s UserPromptSubmit hook ceiling, confirming detached-spawn-and-drain rather than an inline call); 267.2-02 shipped the shared test aggregator and isolated-HOME fixture helper; 267.2-03 performed the navigator-ordered W0 revert and repaired the 267.1 audit test's GAP I-1 leg in the same wave (a shared-file collision the research flagged in advance); 267.2-04 closed the folded ignite Door 1 persona-card gap (missing `mentor` among 7 frozen `ROLE_BLEND_KEYS`) with a two-step pick inside the 4-option card cap; 267.2-05 shipped the local, LLM-free, Part-8-clean greeting classifier (`lib/core/greeting-intent-detector.cjs`) and its routing table; 267.2-06 shipped the deterministic `scripts/first-install-router.cjs` hook plus scalar-only telemetry; 267.2-07 wired the Instant Brief reward's actual delivery via detached spawn; 267.2-08 rewrote the FIRST_INSTALL prose to hand off to the router and updated `data/first-reward-surfaces.json` truthfully; 267.2-09 wired the investment trigger through the already-shipped `identity_write`/`writeUserMdAtomic` path (no second writer, `REQUIREMENTS.md` MEMOP-08 held) and fixed a real pre-existing reader bug (`user-archetype.cjs` misclassified every new user as a student); 267.2-10 registered `HOOK-01..HOOK-12`, reconciled the validation contract, and closed behind a blocking Canon Custodian checkpoint the navigator (Jonathan Sagir) approved in-conversation 2026-09-03 -- via a real `AskUserQuestion` card, after a Stop-hook (`check-card-fire.cjs`) correctly rejected an initial ASCII-box presentation of the same checkpoint. Post-approval code review (advisory gate, `267.2-REVIEW.md`) found 2 real BLOCKERs the checkpoint approval did not cover: `identity_write`'s bare write would have clobbered the router's own seeded identity data the moment a real user reached the investment step (fixed with a regression test, commit `d873c4b9`), and the investment ask had no coordination with an in-flight `/mos:ignite` birth flow (partially fixed for the common case, harder residual case honestly named and deferred in `267.2-CR-02-DEFERRED.md`, not silently dropped). 4 warnings and 1 info item also fixed. Phase verification: 12/12 must-haves passed, independently re-checked against the live codebase including three clean repeats of the full regression sweep; one pre-existing, unrelated test failure (`run-all-179.sh`'s GA-4 card-fire check, touched by zero 267.2 commits) confirmed out of scope. Backend-only, no release commit needed.*

*Prior: 2026-09-03 after Phase 257 (part-8-enforcement-locus-host-independent-egress-guard, v2.1.0) completed. 9 plans across 5 waves: LOCUS-01/02 fixed the honesty defects at the chokepoint and the envelope (`lib/core/refusal-messaging.cjs`, `lib/core/directive-envelope.cjs`, 257-01/02); LOCUS-04/05/06/08/09 corrected the record, filed the D-01/D-02 rulings and the Theo forward-compat note, and captured a pre-change baseline (257-03/04/05); LOCUS-01/02 wired live at the shim (`bin/mindrian-brain-mcp-client.cjs`'s `honestRefusal()` helper, 257-06); LOCUS-03 locked a wire-level invariant spawning the real shim (257-07); LOCUS-07 migrated all six Brain tool registrations to `z.strictObject`, closing an undeclared-key smuggling gap Theo's measurement surfaced (257-08); LOCUS-10 discharged the Canon Part 8 PR gate -- the real automated leg (`doctor.cjs --acceptance` Class O), the suites against their recorded baseline, and a blocking Canon Custodian checkpoint the navigator (Jonathan Sagir) approved in-conversation 2026-09-03 (257-09). Coverage stated per path, not glossed: P1 (client CLI stdio shim) and P2 (`mindrian-os` handlers, Phase 254) COVERED; P3 (client CLI direct HTTP, Desktop, Cowork) and P4 (Theo post-cutover) NOT COVERED by explicit ruling -- a far-side guard can prevent USE but never RECEIPT (D-01), and the direct-HTTP deprecation question is deferred to a larger phase (D-02). The phase's own premise (the 2026-08-20 handoff's H3) was disproven by research before planning locked: the stdio shim was already fail-closed; what was broken was honesty at the return path. Code review (advisory gate, `257-REVIEW.md`) and the orchestrator's own cross-phase regression sweep each caught one real regression in a PRIOR phase's own test (Phase 250-01's `test-250-refusal-shapes.cjs` Test 7 and Phase 127-00's `mindrian-brain-shim.test.cjs` Test 2 both counted literal source-text occurrences of an API call that this phase's legitimate refactors -- a shared `honestRefusal()` helper, an SDK `registerTool` migration -- changed without changing behavior). Both root-caused, fixed as test-only repairs (commits `f2665848`, `1559556c`), verified with live mutation testing on both. Phase verification: 10/10 must-haves passed, independently re-checked against the live codebase, both post-approval fixes confirmed in-scope with no production-code scope creep beyond the Custodian's sign-off. All 10 LOCUS-01..10 requirements registered in `.planning/REQUIREMENTS.md`. Backend-only, no release commit needed.*

*Prior: 2026-08-23 after Phase 264 (roadmap-type-selector-challenge-driven-act-chain-orchestrati) completed - independent of the v2.1.0 milestone, filed as the next open phase number per this document's own continuous-numbering convention. Origin: rethinking-mindrianos research trail (`2026-08-23-scientific-roadmapping-orchestrator`), a navigator-shared synthesis of Convergent Research's "Scientific Roadmapping" essay and Leibo et al.'s multi-agent-intelligence manifesto. 5 plans shipped across 3 waves: `data/roadmap-type-chains.json` (six live-verified framework-name chains) + a five-arm drift validator + `tests/run-all-264.sh` phase aggregator (264-01); `lib/core/salient-governance.cjs`, a pure synchronous two-pass adversarial critic for Reverse Salient findings, reusing `eureka-critic.cjs`'s already-ruled 2-judge-unanimous pattern rather than a panel (264-02); SENS-18 `sensor-roadmap-type.cjs`, a deterministic additive-score classifier (the sync seam contract makes this the only viable mechanism, not a preference) registered across the 3-array sensor lockstep (264-03); the flagship proof that `find-bottlenecks` runs challenge-driven via a direct `chainExecutor.runChain()` call (mirroring an existing `debate-composition.cjs` precedent) plus a scoped sha256 pin over `chain-executor.cjs`'s six gate/stop-condition symbols (264-04); and the `dispatchSensors -> chain_resolve` integration proof plus the phase-closing gate (264-05). All 5 SPEC.md requirements (R1-R5) + the C-01 em-dash constraint verified; code review clean (0 blocker, 2 warning, 2 info); phase verification passed 5/5 must-haves including a live mutation proof that flipped `_isMaterialStep` and confirmed the B3 pin actually reddens. Honest, disclosed scope boundary (D-11): the live `chain_resolve`/`chain_run` MCP path does not yet honor `ralph_verify` (its async execution branch never calls the retry seam, and never passes a `selfCritiqueFn` at all) -- the flagship proof runs via a direct `runChain()` call instead, and wiring the live path is named as a follow-on phase, not implemented here. `chain-executor.cjs` remains byte-identical to its pre-phase state throughout (Canon Part 3 / B3 untouched, verified not asserted). No release commit needed (backend-only, no version-facing surface).*

*Prior: 2026-05-14 after Phase 126 (install-lifecycle-harness-gaps) completed - Wave 1 of `.planning/v1.13.1-EXECUTION-PLAN.md`. 7/7 plans shipped: renderer contract (Plan 01), marketplace-cache semver-prerelease ordering (Plan 02), acceptance-gate self-coverage (Plan 03), release-pipeline hardening with install-minisite HARD lockstep Step 9.6 + tag-push verify Step 5.5 + npx self-test Step 9.7 + Step 9.6→9.8 rename (Plan 04, the capstone), release-flight preflight absorbed into doctor --acceptance (Plan 05, caught + cleaned 2 orphan .bak files in the dev workspace during its own cut - Canon Part 6 dog-fooding in action), stale-backup cache prune with 30-day default (Plan 06), and install-state.json v1→v2 additive migration with future-version-warn-not-downgrade invariant (Plan 07). Pre-existing acc.5 ordering failure RESOLVED via Plan 04 rename. Family pre-mortem doc shipped at `docs/install-cache-family-premortem.md` (6-case history + 5 predicted next failure modes including Prediction E that retires the hardcoded minisite line-numbers via `NEXT_PUBLIC_MINDRIAN_VERSION` env var in v1.14.0+). Memory rule `feedback_install_minisite_lockstep.md` promoted from Soft to HARD tier. Verifier: 9/9 must-haves passed; status: human_needed (3 items in 126-HUMAN-UAT.md require live beta.15 release-cut observation - Step 9.6 end-to-end, tester upgrade path, Vercel live-deploy). Ships AS v1.13.0-beta.15 once `release.sh --prerelease` cuts; minisite repo `~/mindrianos-install-site/` needs one-time `git remote add origin <url> && git push -u origin main` bootstrap on first cut per Open Question 7 settlement. Next per v1.13.1-EXECUTION-PLAN.md: Wave 2 = Phase 118 (30-second-MVA, Part 10 sub-claim 3) → Phase 121 (trajectory-telemetry, parallel) → Phase 119 (room-as-receipt-invariant, depends on 118) → Phase 120 (breakthrough-scan-Category-G, parallel; depends only on 117 which shipped). v1.13.0 final closes with Wave 3 Phase 121.5 (terminal-coherence capstone, CONSOLIDATION ONLY per Canon Part 7). v1.13.1-beta.1 = Phase 127 (Brain MCP local stdio shim - the architectural anchor; design-locked 2026-05-14).*

*Prior: 2026-05-13 after Phase 124 (FEYNMAN.md temporal awareness) completed -- the **Larry-explains face of `memory_event`** is now live. Each `FEYNMAN.md` (per-folder Phase-88 memory triple member) gains a sentinel-bounded `## Timeline (auto)` section regenerated from the Phase 109 `memory_event` log via the navigation chokepoint (the new `lib/core/navigation/insights.cjs::firstCapturedLastTouchedBySection` + `findRecentChanges` + `findStaleDecisions`); body BYTE-PRESERVED across regen (hard invariant). `lib/core/feynman/timeline-renderer.cjs` is the pure renderer (no fs, no Brain calls); `lib/core/feynman/timeline-runner.cjs` is the orchestrator with sentinel-bounded merge + atomic write + watermark check + idempotent re-run + `memory_event` log on success/failure. Hybrid hook trigger: `scripts/session-start` cascade slot (best-effort `|| true`, mirrors cache-prune) + manual `/mos:feynman-timeline-refresh [--all | --section <slug>]` command (Phase 122 frontmatter + Phase 104 `serves_jtbd: ["validate-idea", "audit-room"]`). `EVENT_TYPES` += `feynman_timeline_refreshed` / `feynman_timeline_refresh_failed` (additive +2; Phase 116-00 pattern). Canon Part 9 invariant test enforces: renderer + runner + dispatcher source has NO `brain-client` require / NO `fetch`/`http`/`https`; fs-instrument adversarial verified the runner reads only `FEYNMAN.md`/`room.db`-shaped paths. `docs/CANON-PHASE-MAP.md` Part 9 + version history rows added; `docs/MINDRIAN-CANON.md` Part 9 "Implementing phase" cross-references Phase 124 alongside Phase 109. Verification: 10/10 must-haves passed; `bash tests/run-all-124.sh` 4/4 green (20 assertions); `phase complete 124` ran with zero warnings. Ships in v1.13.0-beta.14 naturally (no version bump needed -- additive Larry-explains surface).

Prior: 2026-05-13 after Phase 123 (install-lifecycle-harness) completed -- the v1.13.0-beta.13 shipping infrastructure. `~/.mindrian/install-state.json` is now the single-writer install-state truth (written by `scripts/session-start`, read by everyone -- statusline / banner / doctor / cli). `data/deployment-surfaces.json` is the hand-maintained manifest of 6 owned surfaces that doctor reconciles. `scripts/doctor.cjs` gains drift classes I (install-state record + topology classification + 6-way version-of-record consistency) and J (deployment-surface manifest reconciliation) under `--install-state` / `--all`; Bug 7 dies (a marketplace-cache-only install is a healthy topology, not drift); aggressive `--fix` with guardrails. `mindrian-os doctor --acceptance` is the 7-point scripted release gate (`--pre-tag` sub-mode for the 5 pre-release-knowable points), wired into `scripts/release.sh` at Step 6.6 + 9.6 as hard aborts. `scripts/release.sh` owns ALL version bumps via `semver.inc` (`--prerelease` / `--finalize` / `--start-prerelease`) -- two-commit form (commit A = bump + tag; commit B = next-prerelease + Unreleased reset; `main` HEAD lands on B); dirty-repo + ahead-of-origin guard; Step 9.5 renamed `@mindrian_os/cli` -> `@mindrian_os/install`. `lib/core/cache-prune.cjs` keeps active + N=2 marketplace-cache dirs; wired into session-start (on version change) + doctor `--fix`. `lib/core/resolve-brain-key.cjs` collapses 3 independent Brain-key lookups into one resolver with the canonical D-31 precedence (env -> `~/.mindrian.env` -> CWD `.env` -> not-found); SEC-02 POSIX `0o077` rejection; brain-client / session-start / brain-connector skill all delegate. `.git/hooks/pre-commit` now invokes 4 checks (Phase 122 command-registry + Phase 110 brain-packet-schema + Phase 110 D-08 layer-2 check-sendpacket + Phase 88-13 room-minto guard). **v1.13.0-beta.13 SHIPPED** to GitHub (tag `09ee5a4`) + npm (`@mindrian_os/install@1.13.0-beta.13` with `next` dist-tag, the prior `@mindrian_os` token blocker resolved during the cut) + marketplace (ref pinned). The cut found + fixed a real bash possessive-in-`node -e -'...'` bug in `scripts/session-start` (silently swallowed install-state writes). Phase 123 verification: 5/5 must-haves passed, status human_needed; the single non-blocking item is the **T5 Windows-operator `mindrian-os doctor --acceptance` gate** for promotion to clean v1.13.0 (Lawrence runs it on a fresh marketplace install). Cosmetic follow-up: `verify-release` Step 9.6 false-positives (post-commit-B `plugin.json` read; release artifact internally consistent).

Prior: 2026-05-13 after Phase 104 (per-command-jtbd-declarations) completed -- additive frontmatter sweep that adds `serves_jtbd:` to every `commands/*.md` (85/85 declared, drawing from the 13 canonical JTBDs in `lib/hmi/jtbd-taxonomy.json` from Phase 100-01); ships a verification harness (`tests/test-command-jtbd-declarations.cjs` -- every command declares), a coverage test (`tests/test-command-jtbd-coverage.cjs` -- every JTBD served by >=1 command; `explore` now served by 23 commands), and a backward-compat fence (`tests/test-command-jtbd-backward-compat.cjs` -- F.1 fall-through invariant pinned, 8/8). No selector-dispatcher logic changes, no JTBD taxonomy changes -- this just feeds JTBD intel into the dispatcher already shipped by Phase 101-04. Recovery work this session: wrote the retroactive 104-00-SUMMARY.md (the substrate was shipped on `main` via commits `451deb8`/`37545ec`/`a7f4950` but the docs commit lived only on archived worktree branches) AND fixed a real regression: `commands/auto-explore.md` (added by Phase 117-03 commit `8c86a8f` AFTER 104-01's mass sweep) was missing the required `serves_jtbd:` field -- declarations test was failing; `serves_jtbd: [explore]` added. Verification: 5/5 must-haves passed; `phase complete 104` ran with zero warnings; STATE advanced. No release commit needed.

Prior: 2026-05-13 after Phase 110 (brain-context-packet-contract) completed -- the v1.13.0-beta.3 wire-level hardening of Canon Part 8. Turned "we audit for leaks" into "the wire format makes leaks structurally hard": `data/brain-packet-schema.json` is the single source of truth (12-job vocab from D-02, $defs per job for in+out, additionalProperties:false everywhere, origin/privacy_mode/packet_version consts); `scripts/build-brain-packet-schema.cjs --check` is the drift tripwire wired into the installed pre-commit hook (alongside Phase 109's chokepoint check + Phase 122's command-registry check). `lib/core/brain-client.cjs::sendPacket()` is the SOLE typed-packet wire path with the ajv2020 (draft 2020-12, bundled transitively via @modelcontextprotocol/sdk, never a direct dep) validator middleware: D-08 layer-3 origin allowlist + unknown-job guard + in-validate-reject-hard + reuse callTool transport (degrades soft on unknown-tool / transport error) + out-validate-reject-hard-degrade-soft (no throw, no partial ingest). D-08 layer 2: `scripts/check-schema-aliases.cjs --check-sendpacket` blocks any commit introducing a bare `sendPacket(` not preceded by `buildBrainPacket(`. D-09 privacy: `local_summary_only` default; `allow_filenames` via `.config.json preferences.brain_privacy_mode` / per-call; `allow_excerpts` via config flag AND a one-time Part-3 Decision Gate; config caps, never raises. D-10 dual-path: `_warnLegacyOnce` ships as a forward-looking contract (no current legacy call site; `query()`/`write()`/`search()`/`schema()`/`callTool()` raw-Cypher methodology lookups are PERMANENT, not legacy); the legacy job path is deleted in v1.14.0. `lib/core/navigation.cjs` gains a 14th re-export `logMemoryEvent`. `lib/core/navigation/memory-events.cjs::EVENT_TYPES` grew by 3 (`brain_packet_rejected` / `brain_response_rejected` / `brain_legacy_path_used`; size 32 -> 35; same additive pattern as Phase 116-00). Verification: 9/9 must-haves passed; `bash tests/run-all-110.sh` 4/4 GREEN (285 assertions); `phase complete 110` ran with zero warnings; STATE advanced. Remaining out-of-scope: the v1.13.0-beta.3 release commit + the Brain-side `brain_packet` MCP tool (separate Brain repo). Also seeded Phase 124 (FEYNMAN.md temporal awareness, Option B) and Phase 123 (install-lifecycle harness, by a concurrent session of mine) -- both staged on the v1.13.0 roadmap.

Prior: 2026-05-12 after Phase 109 (sql-context-memory-navigation-spine) completed -- the v1.13.0 LOAD-BEARING navigation spine. `room.db` is now the primary local context/memory/insight engine: `lib/core/navigation.cjs` is the single navigation chokepoint (focus node model + typed neighborhood retrieval via a recursive CTE + memory event log + 7 insight query primitives + Brain Packet Builder + Brain Result Ingestion + Room Home Driver); a pre-commit guard fails any direct `room.db` access outside the chokepoint; `memory_event` is a first-class node type. The instrumented acceptance test (`tests/test-navigation-acceptance.cjs`) proves by fs-proxy instrumentation -- not by promise -- that the full navigation flow does ZERO non-SQLite filesystem reads (neighborhood perf warm_p95 0.24ms vs 50ms budget). Canon Part 9 ("Memory Locality and Interpretation": files preserve meaning / SQL remembers and navigates / Brain reasons over typed packets / Larry explains and acts / the human confirms truth) ratified into `docs/MINDRIAN-CANON.md` v1.4. A latent migration bug (the `phase-109-nodes-provenance` rebuild colliding with the `rs_discoveries` view) was found and fixed in this session (commit `7d87ed5`; debug archived at `.planning/debug/resolved/phase-109-migration-view-drop-collision.md`). Verification: 9/9 must-haves passed; all 16 Phase-109 test suites green; `phase complete 109` ran with zero warnings; STATE advanced to Phase 110. Remaining out-of-scope: the Phase 109 release commit (CHANGELOG / plugin.json / package.json bump + the `CANON-PHASE-MAP.md` v1.4 Version-history commit-hash fill).

Prior: 2026-05-12 after Phase 122 (workflow-layer) completed -- the v1.13.0-beta.11 capstone. Framework-to-command registry: each `commands/*.md` `frameworks:` frontmatter is the single source of truth; `data/command-registry.json` is generated by `scripts/build-command-registry.cjs` and CI-checked (stale-registry OR unresolvable-framework fails via the pre-commit `--check` tripwire); `lib/workflow/command-resolver.cjs` is the SOLE framework-to-command path (never touches the Brain); `lib/brain/chain-recommender.cjs` does FEEDS_INTO traversal (framework names + enums only); the navigation engine + `/mos:suggest-next` + `/mos:pipeline --from-problem-type/--from-framework` + `/mos:act --chain` + the `pws-methodology` / `brain-connector` skills all route through the resolver; the 3 hand-maintained framework-to-command maps pruned; dead "Brain has Command nodes" prose deleted (Canon Part 8). `docs/COMMAND-FRONTMATTER.md` + `docs/WORKFLOWS.md` document it. Verification: 11/11 must-haves passed. Maintainer-gated follow-ups (still pending): the v1.13.0-beta.11 git tag + marketplace pin + `npm publish` of `@mindrian_os/install`.

Prior: 2026-05-07 after Phase 95.5 (post-compact-memory-pipeline-consumer) shipped as v1.13.0-beta.7. Closes the half-wired Phase 95-04 pipeline; READ-side consumer + D-04 YAML stamp + hooks.json wiring + 9/9 D-05 GREEN tests + Canon Part 8 audit clean. Ships substrate that v1.14.0 "The Visible Room" Plan 126-05 will reuse for the content gap dashboard.*

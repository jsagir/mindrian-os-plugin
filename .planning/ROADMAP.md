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
- [x] **Phase 90: Brain Derivation Layer** - Lets the Brain excavate the local triple (Phase 88) and produce a persistent authored BRAIN.md per section with pattern matches, cross-domain analogies, wicked indicators, unfilled opportunity matches, framework chain predictions, cross-room contradiction flags. Extends triple to quadruple. Graceful degradation when Brain offline. CONTEXT filed. Releases as v1.10.17. (completed 2026-04-24)
- [ ] **Phase 91: Navigation Engine** - L5 Decision layer reading the L3 Navigation substrate (SQL + quadruple memory) to decide which skill/command/framework fires each turn. Five-signal triangulation (ICM + SQL + Feynman-MINTO + BRAIN + intent/persona). Persona durability via USER.md. Visible dial in statusline. /mos:explain-decision command. CONTEXT filed. Destination phase. Releases as v1.11.0.

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
- [ ] 89.1-01-PLAN.md -- brain-client shape adapter inside pullFromBrain (Option 1 locked) + validator Check E embedding-or-score relaxation + adversarial shape suite (Wave 1; SC-03)
- [ ] 89.1-02-PLAN.md -- rs-domain-analyzer.cjs deterministic 7-field decomposition + Canon Part 8 output audit + 11-scenario fixture suite (Wave 2; SC-01, partial SC-05)
- [ ] 89.1-03-PLAN.md -- rs-query-matrix.cjs 60-query 4-category fixed-order template + Canon Part 8 per-query audit + 11-scenario fixture suite (Wave 2; SC-02, partial SC-05)
- [ ] 89.1-04-PLAN.md -- USES_TECHNIQUE Brain-write canonization via /mos:admin brain-write + admin-brain-write.cjs one-shot wrapper + canon-write evidence doc (Wave 3; SC-04)
- [ ] 89.1-05-PLAN.md -- Phase Gate transcript + Feynman registration (baseline 63 -> 65) + live A3 re-verification + canon edge live read (Wave 3; SC-06, SC-07)
**Authority**: .planning/milestones/v1.11.0-KICKOFF.md §5 (Phase 1 Topic + Domain Analysis), §3 (Audit findings -- "Domain analysis prerequisite half-canonized"), §8 (Canon Canonization ONE Brain Write); .planning/phases/89.1a-brain-methodology-substrate-loader/deferred-items.md (brain-client shape mismatch to resolve); .planning/phases/89.1a-brain-methodology-substrate-loader/89.1a-LIVE-BRAIN-SMOKE.md (live Brain evidence + observed-vs-expected diff)

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
- [ ] 91-00-navigation-engine-core-PLAN.md -- lib/core/navigation-engine.cjs L5 Decision core with decide() + structured 5-signal triangulation + Section 4 staleness multipliers + Section 5 tier modes + Section 6 RECOMMENDED gate + Section 8 8-field trace contract (NAV-CORE-01..05)
- [ ] 91-01-user-md-persona-durability-PLAN.md -- lib/core/user-md-ops.cjs + persona-taxonomy.cjs promoting persona to first-class USER.md artifact; Larry 3-persona -> Brain 2-persona translation; atomic write + update threshold (NAV-PERSONA-01..04)
- [ ] 91-02-userpromptsubmit-integration-PLAN.md -- scripts/intent-classifier.cjs calls engine per turn with 1200ms hard timeout; decision_trace persistence to .mindrian/decision-traces/<session>.json with 50-entry rotation (NAV-INTEGRATION-01..03)
- [ ] 91-03-skill-activation-routing-PLAN.md -- lib/core/skill-activation-router.cjs precedence layer; Canon Part 3 10-verb vocabulary enforced; engine precedence when opinionated, legacy fallback when silent (NAV-ROUTING-01..03)
- [ ] 91-04-next-step-offer-presentation-PLAN.md -- lib/core/offer-presenter.cjs with grounding rule + Section 6 RECOMMENDED marker respected + max-1-per-turn + 2-ignore suppression + offer-history persistence (NAV-OFFER-01..03)
- [ ] 91-05-mos-explain-decision-command-PLAN.md -- commands/explain-decision.md + scripts/explain-decision-command.cjs rendering full trace per turn; --last N + --session flags; graceful fallback (NAV-EXPLAIN-01..03)
- [ ] 91-06-statusline-dial-PLAN.md -- lib/core/nav-dial.cjs + scripts/context-monitor segment; Larry dial Investigate | Blend | Insight driven by engine state; Plan 88.1-04 cache pattern reused (NAV-DIAL-01..03)
- [ ] 91-07-problem-type-routing-PLAN.md -- lib/core/problem-type-router.cjs UDP/IDP/WDP/Wicked routing from BRAIN.md problemtype_classification; Canon Appendix E R4 wicked escalation; brain-client.isAvailable() scalar upgrade (NAV-PROBLEM-TYPE-01..04)
- [ ] 91-08-framework-chain-composition-PLAN.md -- lib/core/framework-chain-composer.cjs FEEDS_INTO chain proposal from BRAIN.md framework_chain_predictions; user override recorded as graph data (NAV-CHAIN-01..04)
- [ ] 91-09-nav-invariants-validator-PLAN.md -- lib/memory/validators/navigation-invariants.cjs drop-in registry validator; 5 invariants (trace completeness, RECOMMENDED mode gate, weight clamp, malformed trace, unknown verb); scope=room (NAV-INVARIANTS-01..03)
- [ ] 91-10-v1.11.0-release-gate-PLAN.md -- 5-gate release (CHANGELOG, plugin.json, package.json, git tag v1.11.0, marketplace ref pin); minor version bump per D-06 architectural shift (NAV-RELEASE-01, NAV-RELEASE-GATES-01)
**Authority**: .planning/phases/91-navigation-engine/91-CONTEXT.md

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

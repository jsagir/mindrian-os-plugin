# Roadmap: Obsidian Vault Export v1.9.8

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
- **v1.10.2 Feynman-MINTO Hybrid** - Phase 81 (in progress)

## Phases

- [x] **Phase 76: Wikilink Engine + Branded Footers** - Node.js CJS scripts for wikilink injection (team, filed-to, meetings, sections, sub-rooms) and MindrianOS branded footers on every artifact (completed 2026-04-12)
- [x] **Phase 77: Obsidian Kit + Welcome Doc** - Static .obsidian/ config (De Stijl CSS, graph colors, appearance) and Welcome doc generator (completed 2026-04-12)
- [x] **Phase 78: /mos:vault Command + /mos:room linkify** - User-facing commands that orchestrate vault export and retroactive wikilink injection (completed 2026-04-12)
- [x] **Phase 79: Native Filing Wikilinks** - Modify existing filing pathways to inject wikilinks at creation time (completed 2026-04-13)
- [x] **Phase 80: Vault Import -- Obsidian to Data Room** - Convert any Obsidian vault or Markdown folder into a MindrianOS Data Room (completed 2026-04-13)
- [ ] **Phase 81: Feynman-MINTO Hybrid** - MINTO.md files born compressed via Feynman engine stages 1, 2, 4, 5. Tier-1 default (LLM-backed, ~4 calls, ~$0.05-0.10/run), tier-0 fallback (deterministic MINTO + AAAK footer). Ships as v1.10.2.

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

### Phase 81: Feynman-MINTO Hybrid
**Goal**: Every MINTO.md is born compressed. /mos:reason produces narrative content (essence, mental model, governing thought, key claims, argument structure) via the Feynman engine while keeping structural parts (MECE tree, cross-refs, navigation, sources) deterministic and free. Tier-1 default uses ~4 LLM calls at ~$0.05-0.10 per run. Tier-0 fallback produces deterministic MINTO + AAAK footer when LLM unavailable or budget exceeded. Ships as v1.10.2 (semver deviation from user directive, documented in CHANGELOG).
**Depends on**: Phase 80 (vault-section-minto-generator.cjs is the generator being rewritten) + committed AAAK library at lib/memory/aaak-compress.cjs (tier-0 fallback primitive, 21/21 tests green)
**Requirements**: FEYNMINTO-01, FEYNMINTO-02, FEYNMINTO-03, FEYNMINTO-04, FEYNMINTO-05, FEYNMINTO-06, FEYNMINTO-07, FEYNMINTO-08, FEYNMINTO-09, FEYNMINTO-10
**Success Criteria** (what must be TRUE):
  1. /mos:reason produces MINTO files under 1500 tokens when LLM is available (FEYNMINTO-01)
  2. Structural parts of MINTO (frontmatter, MECE tree, cross-refs, sources, navigation) remain deterministic and free, generated with zero LLM calls (FEYNMINTO-02)
  3. Tier-1 path uses Feynman stages 1 (essence), 2 (plain language), 4 (mental model), and 5 (sweet spot) via library functions in lib/memory/feynman-stages.cjs (FEYNMINTO-03, FEYNMINTO-09)
  4. Stages 3 (expose confusion) and 6 (teach it back) are intentionally skipped in automated generation because they require human review gates
  5. Tier-0 fallback activates cleanly when LLM is unreachable, API errors, or cost budget trips, producing deterministic MINTO + AAAK footer instead (FEYNMINTO-04, FEYNMINTO-08)
  6. Per-run cost budget enforced at $0.15 default, configurable, with per-user monthly cap of $10 default (FEYNMINTO-05, FEYNMINTO-06)
  7. /mos:reason --regenerate-all migrates pre-81 MINTOs to post-81 format with a backup to .migration-backup/YYYY-MM-DD/ first (FEYNMINTO-07)
  8. LLM invocation is abstracted via lib/memory/llm-call.cjs so the same code path works across CLI (Claude Code plugin context), Desktop (MCP tool invocation), and Cowork surfaces (FEYNMINTO-10)
  9. Pre-81 deterministic MINTO generator is preserved as the tier-0 fallback path, not deleted or modified beyond fallback wiring
  10. CHANGELOG [1.10.2] entry documents: why v1.10.1 was skipped, tier-1/tier-0 architecture, cost model, migration path, and the semver deviation
**Plans**: 5 plans expected (81-01 foundation, 81-02 Feynman stages 1+2, 81-03 Feynman stages 4+5, 81-04 generator rewrite + tier fallback, 81-05 commands + migration + release)
**Authority**: .planning/phases/81-feynman-minto-hybrid/81-CONTEXT.md (full architectural decisions D-1 through D-8, open questions, non-goals)

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

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
- **v1.10.2 Feynman-MINTO Hybrid** - Phase 81 (SHIPPED 2026-04-14)
- **v1.10.5 Wiki Artifact Injection Fix** - Phase 82 (SHIPPED 2026-04-14)
- **v1.10.7 Cross-Session Scope Injection + Wrapper Fix** - Phase 83 (SHIPPED 2026-04-14)
- **v1.10.8 Smart Notebook (Memory Promotion)** - Phase 84 (in progress)

## Phases

- [x] **Phase 76: Wikilink Engine + Branded Footers** - Node.js CJS scripts for wikilink injection (team, filed-to, meetings, sections, sub-rooms) and MindrianOS branded footers on every artifact (completed 2026-04-12)
- [x] **Phase 77: Obsidian Kit + Welcome Doc** - Static .obsidian/ config (De Stijl CSS, graph colors, appearance) and Welcome doc generator (completed 2026-04-12)
- [x] **Phase 78: /mos:vault Command + /mos:room linkify** - User-facing commands that orchestrate vault export and retroactive wikilink injection (completed 2026-04-12)
- [x] **Phase 79: Native Filing Wikilinks** - Modify existing filing pathways to inject wikilinks at creation time (completed 2026-04-13)
- [x] **Phase 80: Vault Import -- Obsidian to Data Room** - Convert any Obsidian vault or Markdown folder into a MindrianOS Data Room (completed 2026-04-13)
- [x] **Phase 81: Feynman-MINTO Hybrid** - MINTO.md files born compressed via Feynman engine stages 1, 2, 4, 5. Tier-1 default (slash-command orchestrator inside Claude session, no API key, no budget), tier-0 fallback (deterministic MINTO + AAAK footer). Shipped as v1.10.2 on 2026-04-14.
- [x] **Phase 82: Wiki Artifact Injection Fix** - Populate sec.artifacts in scripts/generate-presentation.cjs collectSections so the wiki template has content to render. Added per-artifact 20 KB cap and per-room 2 MB cap to prevent HTML bloat. Upgraded sec.summary to read MINTO.md governing_thought when present (free leverage of v1.10.2 Feynman-MINTO infrastructure). Reported by Lawrence Aronhime 2026-04-13 23:23, bug sat unfixed across 8 releases. Shipped as v1.10.5 on 2026-04-14.
- [x] **Phase 83: Cross-Session Scope Injection + Wrapper Fix** - Inject ACTIVE ROOM context block into Claude's session-start prompt so cross-session memory is bounded by room scope and Claude refuses to leak content from other rooms without explicit user acknowledgment. Surface every room with a GUARDRAIL.md as a sealed-room with its hard rules quoted. Bundle the parked statusline wrapper fix (settings.json no longer hardcodes legacy plugin path; wrapper resolves latest cache version). Triggered by witnessed cross-session leak where Claude pulled rashut-hadshanut-ai content into an align-x-milken scoped session and drafted a Hebrew intro line that belonged to the sealed room. Shipped as v1.10.7 on 2026-04-14.
- [ ] **Phase 84: Smart Notebook (Co-Pilot reshape)** - v1.10.8 ships the notebook writing surface (Mullins 20-section scaffold) AND the co-pilot inject channel (graph-to-proactive-intelligence bridge + UserPromptSubmit hook) in one hybrid release. Plans 84-01/02/03 are DONE (memory-ops schema extended with 4 event-log tables, room-db.cjs composition module, memory-lifecycle.cjs wired into session-start + stop + pre/post-compact hooks). Plans 84-04 through 84-10 remain: Mullins scaffold loader, Stakeholder node type + bridge function, UserPromptSubmit graph-findings injection (env-gated, default ON, top-3 cap), voice-log writer + reader, fixture tests, self-update script rewrite for versioned-cache model (triggered by witnessed failure 2026-04-14), honesty layer sibling section + 5-gate release. **Spec authority**: `docs/superpowers/specs/2026-04-14-phase-84-smart-notebook-co-pilot-design.md` (committed at `eb89500`). Research authority: `docs/research/2026-04-14-stakeholder-graph-deep-research.md` and `docs/research/2026-04-14-feynman-minto-scn-benchmark.md` (v1.11.x Stakeholder Intelligence milestone brief). Direct to v1.10.8 stable.

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
| **87** | Security + Cascade Refactor + Localhost Dashboard | v1.10.11 + v1.10.12 | infra + L4 | CONTEXT ready |
| **88** | Per-Folder Memory Triple Wiring | v1.10.13 | L2 foundation | CONTEXT filed |
| **89** | Reverse-Salient Engine | v1.10.x | L5 support (local) | 7 plans existing |
| **90** | Brain Derivation Layer | v1.10.14 | L2 Brain-on-top | CONTEXT filed |
| **91** | Navigation Engine | v1.11.0 | L5 Decision | CONTEXT filed |
| **92** | Discord/Zulip multi-surface (candidate) | v1.11.x | L4 surface | research only |
| **93** | Goose extension (candidate) | v1.11.x | L4 surface | research only |

### Dependency Graph

```
                ┌─ Phase 87 (security + dashboard) ───┐
                │                                     │
                └─> Phase 88 (memory triple) ─────────┤
                                      │                │
                                      ├─> Phase 89 (reverse-salient, optional consumer)
                                      │                │
                                      └─> Phase 90 (Brain derivation) ─┐
                                                                        │
                                                                        └─> Phase 91 (Navigation Engine)
                                                                                      │
                                                                                      └─> Phase 92/93 (multi-surface)
```

Phase 91 is the destination. Phases 87, 88, 90 are prerequisites. Phase 89 is parallel (can ship before, during, or after Brain layer).

### Phase Summaries

**Phase 87 -- Security + Cascade Refactor + Localhost Dashboard** (v1.10.11 + v1.10.12)
Stream A security (Cypher sanitization, API key perms, HSI timeout, write-lock atomic) + Stream C localhost dashboard ship as v1.10.11 (investor-safe demo-ready). Stream B refactor (cascade dedup, async split via two entry points, MCP validation, transactions, Brain cache, LRU) + BYO API chat panel with Bearer token auth ship as v1.10.12. Audit R1-R7 folded, split locked. See 87-CONTEXT.md.

**Phase 88 -- Per-Folder Memory Triple Wiring** (v1.10.13)
Wires ROOM.md + STATE.md + Feynman-MINTO.md as a coordinated cross-session memory triple. Five wires (post-write freshness, on-stop snapshot, session-start injection, pre/post-compact resilience, decision_log persistence) + unified read contract `lib/core/folder-memory.cjs` + invariants module (`lib/core/feynman-minto-invariants.cjs`) + guardian for lifecycle enforcement. 13+ plans across 6 waves. Prerequisite for Brain Derivation Layer and Navigation Engine. See 88-CONTEXT.md.

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

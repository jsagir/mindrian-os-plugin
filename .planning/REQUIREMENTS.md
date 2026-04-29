# Requirements: Obsidian Vault Export v1.9.8

**Defined:** 2026-04-12
**Core Value:** Any Data Room becomes a fully-branded Obsidian vault with one command -- Obsidian as the third visual surface of MindrianOS

## Vault Command (VAULT)

- [ ] **VAULT-01**: User can run `/mos:vault` to export the active room as an Obsidian-ready vault folder
- [ ] **VAULT-02**: User can specify a target path (`/mos:vault --path ~/Downloads`) or get a sensible default
- [ ] **VAULT-03**: Vault export resolves symlinked sub-rooms into real folder copies
- [ ] **VAULT-04**: Vault export skips binary caches (.lazygraph, .context, .mindrian, node_modules, .git)
- [ ] **VAULT-05**: Vault export includes Snapshot view folder (exports/, dashboard HTML files)
- [ ] **VAULT-06**: Vault export works on any room (active room, named room, or path to room folder)

## Wikilink Engine (WIKI)

- [x] **WIKI-01**: Wikilink injector links team member names to their PROFILE.md (first occurrence per file, skip self-links, skip YAML frontmatter)
- [x] **WIKI-02**: Wikilink injector links filed-to stubs to target artifacts and source meetings
- [x] **WIKI-03**: Wikilink injector adds "Filed Artifacts" section to meeting summaries with links to filed-to contents
- [x] **WIKI-04**: Wikilink injector converts section names in STATE.md and ROOM.md to [[section/ROOM.md|name]] links
- [x] **WIKI-05**: Wikilink injector adds sub-room navigation (parent + sibling links) to sub-room ROOM.md files
- [x] **WIKI-06**: Wikilink injector handles rooms with zero team profiles gracefully (skip team linking)
- [x] **WIKI-07**: Wikilink injector is idempotent (running twice produces same result, no duplicate links)
- [ ] **WIKI-08**: User can run `/mos:room linkify` to retroactively inject wikilinks into the active room in-place

## Obsidian Kit (KIT)

- [ ] **KIT-01**: Vault export drops a .obsidian/ folder with De Stijl CSS snippet (mindrian-destijl.css)
- [ ] **KIT-02**: CSS theme includes: Mondrian color-bar headers, gold wikilinks, dark mode, colored sidebar, Mondrian hr dividers, table styling
- [ ] **KIT-03**: Vault export drops graph.json with section-colored node groups (problem=red, business=blue, financial=gold, competitive=cyan, solution=green, team=purple, meetings=gray)
- [ ] **KIT-04**: Vault export drops appearance.json enabling De Stijl snippet and dark mode
- [ ] **KIT-05**: Graph config hides orphans, shows arrows, and uses De Stijl-tuned force layout

## Branded Footers (BRAND)

- [ ] **BRAND-01**: Every content artifact gets a MindrianOS branded footer (section, date, room path)
- [ ] **BRAND-02**: Footer format varies by file type: content, team profile, meeting, persona, xref, filed-to
- [ ] **BRAND-03**: Footer injection skips system files (ROOM.md, STATE.md, TEAM-STATE.md, CLAUDE.md, TODOS.md, etc.)
- [ ] **BRAND-04**: Footer injection is idempotent (skip files that already have a MindrianOS footer)

## Welcome Doc (WELCOME)

- [ ] **WELCOME-01**: Vault export generates a "Welcome to MindrianOS.md" landing page wired to all room files
- [ ] **WELCOME-02**: Welcome doc uses Obsidian callouts ([!tip], [!warning], [!quote], [!info], [!example]) for rich formatting
- [ ] **WELCOME-03**: Welcome doc includes: room overview, section table with artifact links, gap warnings, sub-room architecture, team roster, meeting intelligence, cross-references, graph color legend, command reference
- [ ] **WELCOME-04**: Welcome doc adapts to room contents (skip sections that don't apply)

## Section Intelligence Files (SECTION)

- [ ] **SECTION-01**: Vault export generates a STATE.md for every section folder that lacks one -- artifact count, completeness percentage, last updated date, gap status, contributor list
- [ ] **SECTION-02**: Vault export generates a MINTO.md (Minto/MECE structured reasoning) for every section folder that has 1+ artifacts -- argument structure, what we know, key claims, evidence gaps, MECE issue tree
- [ ] **SECTION-03**: Per-section STATE.md includes wikilinks to all artifacts in the section and to the parent room STATE.md
- [ ] **SECTION-04**: Per-section MINTO.md includes wikilinks to the artifacts it reasons over, to related sections (cross-references), and to the section's ROOM.md (parent MOC)
- [ ] **SECTION-05**: Section STATE.md and MINTO.md are generated for sub-room sections too (recursive through all nested sub-rooms)
- [ ] **SECTION-06**: The trifecta (ROOM.md + STATE.md + MINTO.md) at each section folder forms the MOC tier-1 anchor -- ROOM.md is identity, STATE.md is status, MINTO.md is reasoning
- [ ] **SECTION-07**: Generation skips sections with zero artifacts (STATE.md still generated showing empty status, MINTO.md skipped -- nothing to reason over)

## Vault Architecture Rulings (ARCH)

- [x] **ARCH-01**: Artifact note titles are claim sentences, not labels (e.g. "ALIGN is a smart lobby system" not "Core Problem Reframe") -- applied during vault export rename
- [ ] **ARCH-02**: Section ROOM.md files serve as MOC (Map of Content) hubs linking only to entry-point artifacts, not every sub-note
- [ ] **ARCH-03**: Welcome doc is the Home Note (tier-0 MOC) linking to section MOCs (tier-1), which link to permanent notes (tier-2)
- [ ] **ARCH-04**: Every artifact frontmatter includes vault-aware properties: `related` (serendipity links), `parent-moc` (structural hierarchy), `sources` (meeting/methodology), `status` (active/validated/stale)
- [x] **ARCH-05**: Two link types enforced: serendipity links inline in body text (cross-domain connections, xref insights) vs structural links in frontmatter + footer (hierarchy, parent-moc, filed-to)
- [x] **ARCH-06**: Link quality filter -- every injected wikilink must be explainable in one sentence; dense meaningful links beat maximum links
- [ ] **ARCH-07**: Vault structure follows 3-tier hierarchy: Home Note (Welcome) -> MOC hubs (section ROOM.md) -> Permanent notes (artifacts)

## Vault Ruling System (RULES)

- [ ] **RULES-01**: Every vault ships with a `VAULT-RULES.md` design system doc at root -- De Stijl token definitions, color meanings, typography hierarchy, symbol vocabulary, callout mapping, formatting rules per file type
- [ ] **RULES-02**: De Stijl color token mapping documented and enforced: red=#C83D2F (problem/critical), blue=#2B5BA5 (business/structural), yellow/gold=#E8A838 (financial/action), cyan=#4A9EAF (competitive/info), green=#4A8C5C (solution/success), purple=#8B5CF6 (team), gray=#6B6B6B (meetings/muted)
- [x] **RULES-03**: Obsidian callout type mapping enforced across ALL content files (not just Welcome): `[!warning]`=gap/blocker, `[!tip]`=action/recommendation, `[!quote]`=meeting source/attribution, `[!info]`=methodology/explanation, `[!example]`=case/architecture, `[!success]`=convergence/validated, `[!abstract]`=summary/overview, `[!important]`=decision/commitment
- [x] **RULES-04**: Every content artifact reformatted with rich Obsidian-native elements: callouts for key insights, blockquotes for direct quotes with speaker attribution wikilinks, tables for structured data, horizontal rules as Mondrian dividers between sections
- [x] **RULES-05**: Decision 16 nested folder structure enforced: every artifact sits in its own named folder (`section/artifact-name/artifact-name.md`) enabling per-artifact attachments, sub-findings, and clean graph nodes
- [ ] **RULES-06**: Typography hierarchy enforced: H1=document title (red underbar), H2=major section (blue left bar), H3=subsection (gold text), H4=detail level (cyan uppercase). Consistent across all files.
- [x] **RULES-07**: Symbol vocabulary adapted for Obsidian from CLI UI system: use Obsidian-native callouts instead of ANSI glyphs, Markdown tables instead of box-drawing, wikilinks instead of file paths. No raw terminal symbols in vault files.
- [ ] **RULES-08**: Every vault ships with a `.obsidian/templates/` folder containing MindrianOS note templates: new-artifact, new-meeting-note, new-team-profile, new-xref -- each with correct frontmatter schema and callout structure pre-filled
- [ ] **RULES-09**: Frontmatter schema contract: every artifact MUST have `type`, `section`, `created`, `room`. Content artifacts add `methodology`, `sources`, `related`, `parent-moc`, `status`. Meeting artifacts add `speakers`, `filed-to`. Team profiles add `role`, `expertise`, `contributions`.
- [ ] **RULES-10**: Graph view ruling: nodes sized by connection count (hub files larger), edges colored by relationship type (gold=serendipity/xref, white=structural/hierarchy, red=contradiction), labels visible at zoom level

## Vault Import -- Obsidian to Data Room (IMPORT)

- [x] **IMPORT-01**: User can run `/mos:vault import --path ~/my-vault` to convert an existing Obsidian vault into a MindrianOS Data Room
- [x] **IMPORT-02**: Import scans all .md files and classifies them into room sections (problem-definition, business-model, market-analysis, competitive-analysis, solution-design, financial-model, legal-ip, team-execution, team, meetings) using content analysis + frontmatter hints
- [x] **IMPORT-03**: Import creates the room/ folder structure with ROOM.md identity files at every level (ICM Layer 0)
- [x] **IMPORT-04**: Import generates STATE.md at room level and per-section level from the classified content
- [x] **IMPORT-05**: Import generates MINTO.md (structured reasoning) for each section that received 1+ classified artifacts
- [x] **IMPORT-06**: Import detects person names in content and generates team/ profiles with wikilinked contributions
- [x] **IMPORT-07**: Import detects meeting notes (date patterns, attendee lists, action items) and files them into meetings/ with proper metadata
- [x] **IMPORT-08**: Import preserves existing Obsidian wikilinks and converts them to room-relative paths
- [x] **IMPORT-09**: Import generates a classification report showing where each source note was filed, confidence score, and any notes that couldn't be classified (placed in an inbox/ folder for manual routing)
- [x] **IMPORT-10**: Import adds MindrianOS branded footers, De Stijl frontmatter schema, and callout formatting to all imported artifacts
- [x] **IMPORT-11**: After import, the room is immediately usable with all /mos: commands -- Larry can grade it, diagnose it, run methodologies on it
- [x] **IMPORT-12**: Import works on non-Obsidian Markdown folders too (any folder of .md files) -- Obsidian-specific features (wikilinks, frontmatter) are bonuses, not requirements

## Native Filing Wikilinks (NATIVE)

- [x] **NATIVE-01**: file-meeting filing adds wikilinks to newly created artifacts (team names, section refs)
- [x] **NATIVE-02**: Room-passive filing skill adds wikilinks when filing new entries
- [x] **NATIVE-03**: xref generation includes wikilinks to source and target files
- [x] **NATIVE-04**: Team profile creation includes wikilinked contribution table

## Smart Notebook / Memory Promotion (SMART)

- [x] **SMART-84-01**: Extend initMemorySchema with 4 additive tables (scaffold_log, voice_log, held_contradictions, decisions_index) and indexes, CREATE IF NOT EXISTS, existing tables byte-identical
- [x] **SMART-84-02**: Compose memory-ops.initMemorySchema with lazygraph-ops.openGraph behind new lib/core/room-db.cjs openRoomDb entry point
- [x] **SMART-84-03**: Session lifecycle wiring at SessionStart (startSession, getSessionHistory), Stop/PostCompact (addFragment), PreCompact (endSession), scoped to active room from registry
- [x] **SMART-84-04**: RECENT SESSIONS block injection into session-start context, additive to Phase 83 ACTIVE ROOM CONTEXT block
- [ ] **SMART-84-05**: Mullins 20-section canonical scaffold shipped as JSON data (lib/scaffold/tier-0-mullins.json) + loader, 3 seed Tier 0 sections materializable by default (stakeholder-analysis, decisions, assumptions)
- [ ] **SMART-84-06**: /mos:organize gains --materialize-section and --show-scaffold subcommands, logs each materialization to scaffold_log
- [ ] **SMART-84-07**: lib/core/voice-retrieval.cjs scopedRead primitive refuses cross-room reads and sealed rooms at query time
- [ ] **SMART-84-08**: Voice-log markdown writer at .mos/voice-log/<date>-<slug>.md per room, plus voice_log table index, stub writer called from PostCompact and Stop
- [ ] **SMART-84-09**: Intent classifier memory augmentation behind MINDRIAN_INTENT_CLASSIFIER_USE_MEMORY=1 env var, reads recent fragments via scopedRead, default off, preserves 83-07 fixture behavior
- [ ] **SMART-84-10**: Fixture-based test suite covering memory wiring, scaffold loader, scopedRead guards, classifier augmentation, voice-log writer
- [ ] **SMART-84-11**: Honesty layer sibling section in skills/larry-personality/SKILL.md ("When memory is real") added directly after existing 83-08 "No fake recall" sub-section, existing content byte-identical
- [ ] **SMART-84-12**: v1.10.8 5-gate release (CHANGELOG, plugin.json, package.json, git tag, marketplace.json ref pin) per release-process.md Version Consistency Rule

## Bash Hook Envelope Hygiene + Cascade Side-Channel (BASH-95)

- [x] **BASH-95-01**: Bash `scripts/post-write` emits a Claude Code 2.x schema-valid PostToolUse envelope - top-level keys subset of `{decision, reason, continue, stopReason, suppressOutput, systemMessage, hookSpecificOutput}`; `additionalContext` lives ONLY inside `hookSpecificOutput`.
- [x] **BASH-95-02**: `<roomDir>/.mindrian/last-cascade.json` is written atomically on every successful cascade; payload contains 7 documented keys (timestamp, file_path, section, cascade_status, classification, git_commit, graph_index, proactive_intelligence); LOCAL-only per Canon Part 8.
- [x] **BASH-95-03**: `skills/room-proactive/SKILL.md` OLD cascade detection contract (current lines 80-113, including the `## Mid-Session Intelligence` block AND the `## After Filing: Decision Capture` introduction + `### When to Present` block which carry OLD `cascade_status.proactive_intelligence` framing) replaced with side-channel reader contract; the prose APPROVE/REJECT/DEFER renderer (`### How to Present` heading through `Do NOT follow up...` line - current lines 114-160) preserved BYTE-IDENTICAL via anchored-diff verification; mid-session intelligence injection (Phase 88.1-03 feature) functions in production for the first time since shipped.
- [x] **BASH-95-04**: All 9 other bash hooks (session-start, pre-compact, post-compact, on-stop, write-scope-check, intent-classifier, on-file-changed, on-cwd-changed, on-agent-complete, on-task-complete) audited per lifecycle event; envelope violations fixed.
- [x] **BASH-95-05**: `tests/test-hook-envelope-shape.cjs` extended to fence ALL bash hook stdout shapes by lifecycle event (per-event allowed-key sets enforced).
- [x] **BASH-95-06**: CHANGELOG.md `[1.12.0]` entry contains BOTH `### Fixed` (envelope hygiene) AND `### Changed` (room-proactive cascade restoration) sections.
- [x] **BASH-95-07**: Version bump 1.11.2 -> 1.12.0 across all 5 release gates (CHANGELOG.md, .claude-plugin/plugin.json, package.json, git tag v1.12.0, ~/mindrian-marketplace/.claude-plugin/marketplace.json ref pin).

## Future Requirements (v2)

- Obsidian plugin (sidebar for Larry, command palette, auto-complete wikilinks)
- Live sync between CLI room and Obsidian vault (file watcher)
- Canvas view generation (.canvas files)
- Obsidian Dataview queries for room intelligence

## Out of Scope

- Terminal plugin installation -- plugin ecosystem unreliable (polyipseity archived)
- Obsidian community plugin marketplace publishing -- premature
- Two-way sync (Obsidian edits back to CLI room) -- unidirectional export is safer for v1
- Custom Obsidian plugin development -- defer to v2

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| VAULT-01 | Phase 78 | Pending |
| VAULT-02 | Phase 78 | Pending |
| VAULT-03 | Phase 78 | Pending |
| VAULT-04 | Phase 78 | Pending |
| VAULT-05 | Phase 78 | Pending |
| VAULT-06 | Phase 78 | Pending |
| WIKI-01 | Phase 76 | Complete |
| WIKI-02 | Phase 76 | Complete |
| WIKI-03 | Phase 76 | Complete |
| WIKI-04 | Phase 76 | Complete |
| WIKI-05 | Phase 76 | Complete |
| WIKI-06 | Phase 76 | Complete |
| WIKI-07 | Phase 76 | Complete |
| WIKI-08 | Phase 78 | Pending |
| KIT-01 | Phase 77 | Pending |
| KIT-02 | Phase 77 | Pending |
| KIT-03 | Phase 77 | Pending |
| KIT-04 | Phase 77 | Pending |
| KIT-05 | Phase 77 | Pending |
| BRAND-01 | Phase 76 | Pending |
| BRAND-02 | Phase 76 | Pending |
| BRAND-03 | Phase 76 | Pending |
| BRAND-04 | Phase 76 | Pending |
| WELCOME-01 | Phase 77 | Pending |
| WELCOME-02 | Phase 77 | Pending |
| WELCOME-03 | Phase 77 | Pending |
| WELCOME-04 | Phase 77 | Pending |
| NATIVE-01 | Phase 79 | Complete |
| NATIVE-02 | Phase 79 | Complete |
| NATIVE-03 | Phase 79 | Complete |
| NATIVE-04 | Phase 79 | Complete |
| SMART-84-01 | Phase 84 | Complete |
| SMART-84-02 | Phase 84 | Complete |
| SMART-84-03 | Phase 84 | Complete |
| SMART-84-04 | Phase 84 | Complete |
| SMART-84-05 | Phase 84 | Pending |
| SMART-84-06 | Phase 84 | Pending |
| SMART-84-07 | Phase 84 | Pending |
| SMART-84-08 | Phase 84 | Pending |
| SMART-84-09 | Phase 84 | Pending |
| SMART-84-10 | Phase 84 | Pending |
| SMART-84-11 | Phase 84 | Pending |
| SMART-84-12 | Phase 84 | Pending |
| ARCH-01 | Phase 76 | Complete |
| ARCH-02 | Phase 77 | Pending |
| ARCH-03 | Phase 77 | Pending |
| ARCH-04 | Phase 76 | Pending |
| ARCH-05 | Phase 76 | Complete |
| ARCH-06 | Phase 76 | Complete |
| ARCH-07 | Phase 77 | Pending |
| SECTION-01 | Phase 77 | Pending |
| SECTION-02 | Phase 77 | Pending |
| SECTION-03 | Phase 77 | Pending |
| SECTION-04 | Phase 77 | Pending |
| SECTION-05 | Phase 77 | Pending |
| SECTION-06 | Phase 77 | Pending |
| SECTION-07 | Phase 77 | Pending |
| RULES-01 | Phase 77 | Pending |
| RULES-02 | Phase 77 | Pending |
| RULES-03 | Phase 76 | Complete |
| RULES-04 | Phase 76 | Complete |
| RULES-05 | Phase 76 | Complete |
| RULES-06 | Phase 77 | Pending |
| RULES-07 | Phase 76 | Complete |
| RULES-08 | Phase 77 | Pending |
| RULES-09 | Phase 76 | Pending |
| RULES-10 | Phase 77 | Pending |
| IMPORT-01 | Phase 80 | Complete |
| IMPORT-02 | Phase 80 | Complete |
| IMPORT-03 | Phase 80 | Complete |
| IMPORT-04 | Phase 80 | Complete |
| IMPORT-05 | Phase 80 | Complete |
| IMPORT-06 | Phase 80 | Complete |
| IMPORT-07 | Phase 80 | Complete |
| IMPORT-08 | Phase 80 | Complete |
| IMPORT-09 | Phase 80 | Complete |
| IMPORT-10 | Phase 80 | Complete |
| IMPORT-11 | Phase 80 | Complete |
| IMPORT-12 | Phase 80 | Complete |
| BASH-95-01 | Phase 95 | Complete |
| BASH-95-02 | Phase 95 | Complete |
| BASH-95-03 | Phase 95 | Complete |
| BASH-95-04 | Phase 95 | Complete |
| BASH-95-05 | Phase 95 | Complete |
| BASH-95-06 | Phase 95 | Complete |
| BASH-95-07 | Phase 95 | Complete |

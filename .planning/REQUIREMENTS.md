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

- [ ] **IMPORT-01**: User can run `/mos:vault import --path ~/my-vault` to convert an existing Obsidian vault into a MindrianOS Data Room
- [ ] **IMPORT-02**: Import scans all .md files and classifies them into room sections (problem-definition, business-model, market-analysis, competitive-analysis, solution-design, financial-model, legal-ip, team-execution, team, meetings) using content analysis + frontmatter hints
- [ ] **IMPORT-03**: Import creates the room/ folder structure with ROOM.md identity files at every level (ICM Layer 0)
- [ ] **IMPORT-04**: Import generates STATE.md at room level and per-section level from the classified content
- [ ] **IMPORT-05**: Import generates MINTO.md (structured reasoning) for each section that received 1+ classified artifacts
- [ ] **IMPORT-06**: Import detects person names in content and generates team/ profiles with wikilinked contributions
- [ ] **IMPORT-07**: Import detects meeting notes (date patterns, attendee lists, action items) and files them into meetings/ with proper metadata
- [ ] **IMPORT-08**: Import preserves existing Obsidian wikilinks and converts them to room-relative paths
- [ ] **IMPORT-09**: Import generates a classification report showing where each source note was filed, confidence score, and any notes that couldn't be classified (placed in an inbox/ folder for manual routing)
- [ ] **IMPORT-10**: Import adds MindrianOS branded footers, De Stijl frontmatter schema, and callout formatting to all imported artifacts
- [ ] **IMPORT-11**: After import, the room is immediately usable with all /mos: commands -- Larry can grade it, diagnose it, run methodologies on it
- [ ] **IMPORT-12**: Import works on non-Obsidian Markdown folders too (any folder of .md files) -- Obsidian-specific features (wikilinks, frontmatter) are bonuses, not requirements

## Native Filing Wikilinks (NATIVE)

- [x] **NATIVE-01**: file-meeting filing adds wikilinks to newly created artifacts (team names, section refs)
- [x] **NATIVE-02**: Room-passive filing skill adds wikilinks when filing new entries
- [x] **NATIVE-03**: xref generation includes wikilinks to source and target files
- [x] **NATIVE-04**: Team profile creation includes wikilinked contribution table

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
| IMPORT-01 | Phase 80 | Pending |
| IMPORT-02 | Phase 80 | Pending |
| IMPORT-03 | Phase 80 | Pending |
| IMPORT-04 | Phase 80 | Pending |
| IMPORT-05 | Phase 80 | Pending |
| IMPORT-06 | Phase 80 | Pending |
| IMPORT-07 | Phase 80 | Pending |
| IMPORT-08 | Phase 80 | Pending |
| IMPORT-09 | Phase 80 | Pending |
| IMPORT-10 | Phase 80 | Pending |
| IMPORT-11 | Phase 80 | Pending |
| IMPORT-12 | Phase 80 | Pending |

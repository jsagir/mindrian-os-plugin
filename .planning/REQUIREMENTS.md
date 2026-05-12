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

## Plugin Self-Healing Diagnostics (DOCTOR-95.1)

- [x] **DOCTOR-95.1-01**: `/mos:doctor --cascade-rooms` flag detects (a) rooms missing the `.room-root` sentinel (drift class B) by reading `~/MindrianRooms/.rooms/registry.json` and walking each registered room's filesystem AND (b) the active-room guard silence at `scripts/post-write` lines 207-217 where non-active-room writes exit 0 before `write_cascade_side_channel` runs (drift class C). Detection only; class C `--fix` is deferred per CONTEXT Deferred Ideas.
- [x] **DOCTOR-95.1-02**: `/mos:doctor --verify-surface` flag executes a live cascade end-to-end against `test/fixtures/cascade-surface-e2e/` via `spawnSync('bash', [POST_WRITE], { env: { MINDRIAN_ROOMS_HOME: <fixture> } })`, then asserts `<fixtureRoom>/.mindrian/last-cascade.json` exists and contains all 8 root keys (timestamp, file_path, section, cascade_status, classification, git_commit, graph_index, proactive_intelligence) per D-04, D-05, D-06.
- [x] **DOCTOR-95.1-03**: `/mos:doctor --room-md` flag detects directories under `.room-root` subtrees missing ROOM.md or MINTO.md (drift class E); `--fix --room-md` invokes `scripts/generate-section-intelligence.cjs` with `--recursive` per D-09.
- [x] **DOCTOR-95.1-04**: `/mos:doctor --ui-compliance` flag detects (a) `commands/*.md` frontmatter missing `body_shape:`, (b) `scripts/*.cjs` and renderers using unauthorized box chars (╭ ╮ ╰ ╯ ┌ ┐ └ ┘ │ ─ ━) or unauthorized glyphs (✗ ✘ ✕ ❌ ❓ ❗ ⚠️ or any emoji other than the `scripts/context-monitor` carve-out), (c) command output renderers missing the Zone 1 header pattern `-- {room} -- {command} --` and missing Zone 4 action footer pattern (drift class F per D-13). Reports per-file violations with line numbers. `--fix` is detect-only in 95.1.
- [x] **DOCTOR-95.1-05**: `scripts/generate-section-intelligence.cjs` exists. CLI: `node scripts/generate-section-intelligence.cjs <dir> [--recursive] [--force]`. Default scope = ONE directory. With `--recursive`, walks the whole subtree from the anchor. Idempotent: skip if ROOM.md or MINTO.md exists; `--force` overrides per D-01, D-02, D-03. Hand-rolled minimal frontmatter per D-03 (NOT imported from `vault-section-{state,minto}-generator.cjs`). Atomic write via mktemp + rename(2) on same filesystem.
- [x] **DOCTOR-95.1-06**: `/mos:doctor` itself complies with UI Ruling System §1-§4: (a) `commands/doctor.md` frontmatter contains `body_shape: E (Action Report)` (canonical form per 33/80 shipped commands incl. heal.md and act.md); (b) `scripts/doctor.cjs renderHumanReport` emits a Zone 1 header `-- MindrianOS -- doctor -- {stage} --` and a Zone 4 action footer with 2-3 grounded `/mos:` commands; (c) `scripts/doctor.cjs` contains zero unauthorized box chars (╭ ╮ ╰ ╯) and zero unauthorized glyphs (✗); (d) only the 12 approved glyphs from SKILL.md §3 are used (■ ▼ ▶ ▷ ├─ └─ ✓ • ⚠ ⚡ ⬜ →) per D-10..D-13.
- [x] **DOCTOR-95.1-07**: `/mos:doctor` (no `--fix`) renders an F.1 Next Move selector when drift is detected, BEFORE the Zone 4 action footer, with options: "Run /mos:doctor --fix" / "Defer" / "Free-Text" per D-18. Implementation strategy: until Phase 88.2 ships AskUserQuestion for Shape F, render the selector as a non-interactive structural marker block in the report; Larry handles the conversational selection per D-19. Mark the AskUserQuestion canonical implementation as a deferred 88.2 follow-up file `f1-selector-deferred.md` in the phase directory.
- [x] **DOCTOR-95.1-08**: `test/fixtures/cascade-surface-e2e/` exists as a SIBLING of `test/fixtures/cascade-e2e/seed-room/` (NOT a subdirectory) per D-04 and per <specifics>. Layout: `.room-root` + STATE.md + ROOM.md + MINTO.md + `.rooms/registry.json` + `problem-definition/ROOM.md` + `problem-definition/MINTO.md` + `problem-definition/seed-artifact/seed-artifact.md` (Decision #16 nested). Includes `cascade-surface-e2e/README.md` documenting the contrast with `cascade-e2e/seed-room/` (pipeline-level vs surface-level).

## Plugin Install Cache Atomic Recovery + SessionStart Preflight (DOCTOR-95.2)

- [x] **DOCTOR-95.2-01**: `scripts/doctor.cjs` `--fix` recovery uses atomic-swap pattern: copy marketplace cache to `~/.claude/plugins/mindrian-os.new` via `cp -aT cache install.new`, version-verify by reading `install.new/.claude-plugin/plugin.json` and asserting `version` field equals expected, THEN execute two-step rename `mv install install.stale-{version}-{timestamp}` followed by `mv install.new install`. If `cp` or version-verify fails, live `install` is left untouched and `install.new` is left for inspection. Eliminates the half-done state observed in 2026-05-06 incident per D-01, D-02.
- [x] **DOCTOR-95.2-02**: `scripts/doctor.cjs` class A `--fix` triggers when `install.status === "missing"` OR `drift.detected === true` (currently only the second triggers). Recovery path is identical: copy from `cache.latest` to `install.new`, verify, two-step rename. Gating predicate widens; recovery body unchanged. Per D-05.
- [x] **DOCTOR-95.2-03**: `scripts/doctor.cjs` recovery rollback on post-rename failure: if any step after `mv install install.stale-X` fails, restore from `install.stale-X` via `mv install.stale-X install` to return to pre-recovery state. Exit code 4 (new code, distinct from existing 0/1/2/3) signals "recovery attempted but rolled back to backup state." Surface message: "recovery failed -- live install restored from backup; investigate manually." Per D-03.
- [x] **DOCTOR-95.2-04**: `scripts/doctor.cjs` JSON output additions: `install.recoverable` boolean field (true when script can auto-recover, i.e., `cache.versions[]` non-empty AND latest version parseable). `drift.detected === true` when `install.status === "missing"` (currently only when `install < latest`). Existing fields `install.status`, `install.detail`, `cache.versions`, `cache.latest`, `dev.pluginJson`, `dev.packageJson`, `fixRequested`, `classARecovered`, `recoveryError`, `checks`, `recovered` remain byte-stable. Per D-06, D-07.
- [x] **DOCTOR-95.2-05**: `scripts/doctor.cjs` human renderer surfaces F.1 Next Move selector (`▶ Run /mos:doctor --fix` / `▷ Defer` / `▷ Free-Text`) when `install.status === "missing"` (currently only on `drift.detected: true`). Summary line counts a missing install as 1 drift (currently counts as 1 warning + 0 drift), so the renderer's `drift > 0 ?` branch fires correctly. Per D-06.
- [x] **DOCTOR-95.2-06**: `hooks/session-start.cjs` invokes `node scripts/doctor.cjs --json` at session start, parses the result, surfaces a one-line ANSI-yellow warning above the v1.13.0-beta.6 banner ONLY IF `drift.detected === true` OR `install.status === "missing"`. Warning copy: `⚠ MindrianOS install dir {missing|drifted}; run /mos:doctor --fix to recover. Backup: {path}.` Backup path appears only when a `.stale-*` directory exists alongside. Color stripped if `MOS_NO_COLOR=1` env var set. Suppressed (zero output) on healthy installs. Per D-08, D-09.
- [ ] **DOCTOR-95.2-07**: `docs/autopsies/2026-05-06-install-dir-missing-incident.md` exists, captures the dogfood `/mos:doctor --all --json` output (install.status === "missing", two stale backups present), names the root cause (non-atomic recovery in 95.1's `--fix`), cross-references the prior two autopsies (2026-04-13 + 2026-04-28), and includes a "lessons applied" section documenting why D-01 atomic-swap closes this failure family. Per D-12.
- [x] **DOCTOR-95.2-08**: `test/test-doctor-atomic-swap.cjs` regression test exists. Hermetic via new `MINDRIAN_PLUGIN_HOME` env override (introduced by this phase if not already present in `scripts/doctor.cjs`). Two scenarios: (a) simulate `cp` failure mid-recovery via wrapper that fails the second invocation; assert `install.stale-X` preserved AND live `install` not corrupted AND script returns exit 4; (b) simulate version-verify failure by writing wrong-version `plugin.json` to `install.new`; assert `install` untouched AND `install.new` left for inspection AND script returns exit 1 with structured error. Per D-14.
- [ ] **DOCTOR-95.2-09**: Pre-merge self-test on dogfood machine: run patched `scripts/doctor.cjs --fix` against jsagir's actual missing-install state at `~/.claude/plugins/mindrian-os/`, verify install dir is restored AND new `install.stale-1.13.0-beta.{N}-{timestamp}` backup is created AND script exits 2 (recovered). Self-test results filed in phase directory as `95.2-DOGFOOD-VERIFICATION.md`. Canon Part 6 dog-fooding mandate. Per D-13.

## Context-Aware Rendering (RENDER-102)

- [ ] **RENDER-102-01**: `lib/render/render-v2.cjs` exposes a stable `render(zones, mode, operator, tier)` import surface (5-arg variant `render(zones, mode, operator, tier, jtbd?)` permitted as additive 5th positional) that supersedes the Phase 99-03 pass-through stub without breaking the existing 8-scenario `lib/render/render-v2.test.cjs` contract regression fence (Phase 99-03 envelope shape -- exactly 6 keys `{zones, mode, operator, tier, rendered, _stub}` -- preserved when `_stub: 'phase-99-03'`; Phase 102 mode emits `rendered: true` with the same 6-key envelope plus payload extensions).
- [ ] **RENDER-102-02**: Operator-aware compaction is enforced output-side per Canon Part 3 § The 3-layer loop and Phase 99 CONTEXT.md D-16: `JUST_TALK` -> prose-only (no zones, no Shape rendering); `EXPLORE_CAPTURE` -> prose with Shape E only on crystallization signal; `BUILD_ROOM` -> full 4-zone anatomy (Zone 1 header + Zone 2 body + Zone 3 detail + Zone 4 footer); `METHODOLOGY` -> no shape mid-session, Shape E at gate; `DECISION_GATE` -> Shape F.x selector (one of F.1/F.2/F.3/F.4/F.5) with keyboard-only options. Renderer rejects any zone payload that violates the operator's compaction contract with a structured error carrying `code: 'render_v2_compaction_violation'`.
- [ ] **RENDER-102-03**: Zone 4 (action footer) is JTBD-aware: when called with the 5th `jtbd` arg, the renderer maps the JTBD handle through `lib/render/JTBD-PALETTES.md` to a deterministic palette + verb-suggestion vocabulary drawn ONLY from the 10 MindrianOS-native verbs (Canon Part 3 § The 10 verbs); when `jtbd` is absent or unmapped, Zone 4 falls back to the Tier 0 minimal verb set (Run Methodology / Reformulate / Free-Text). Renderer NEVER invents a verb outside the 10-verb closed vocabulary (Canon amendment required for additions).
- [ ] **RENDER-102-04**: Provenance envelope: every Phase 102 render result carries `_provenance: { renderer: 'render-v2', version: '102', operator, tier, mode, jtbd?: string|null }` (non-enumerable hint or plain field both acceptable; tests assert on `_provenance.renderer === 'render-v2'` AND `_provenance.version === '102'` AND operator passthrough). Provenance is LOCAL-only per Canon Part 8: zero Brain queries during render, zero network IO, zero filesystem reads outside of `lib/render/JTBD-PALETTES.md`.
- [ ] **RENDER-102-05**: Color overlay: Zone 1 header and Zone 4 footer accept a JTBD-derived palette overlay (5-color De Stijl token set per UI Ruling System §1) applied via terminal SGR sequences in `mode === 'cli'` (no overlay applied in `mode === 'desktop'` or `mode === 'cowork'` -- those surfaces own their own theming). Overlay is purely cosmetic; the canonical text content of every zone is byte-identical with overlay disabled (regression fence test asserts strip-ANSI equality between `MOS_NO_COLOR=1` render and default render).
- [ ] **RENDER-102-06**: Phase 99-03 import-surface invariant: the 5-canonical-operator `OPERATORS` frozen export (Object.freeze of `['JUST_TALK', 'EXPLORE_CAPTURE', 'BUILD_ROOM', 'METHODOLOGY', 'DECISION_GATE']`) and the `module.exports = { render, OPERATORS }` shape from `lib/render/render-v2.cjs` are byte-stable across the 99-03 -> 102 swap; the 8 IIFE scenarios in `lib/render/render-v2.test.cjs` continue to pass unchanged as a Phase 99-03 -> 102 contract regression fence (per `lib/memory/run-feynman-tests.cjs` registration comment lines 944-955).

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

## JTBD Inference Engine (HMI-100)

- [ ] **HMI-100-01**: `lib/hmi/jtbd-taxonomy.json` exists. Contains 13 entries (12 first-class jobs from KICKOFF + `explore` fallback). Each entry has: `id`, `one_line`, `cues[]`, `methodology_hooks[]`, `next_move_verbs[]` (4-6 verbs drawn from Canon Part 3 vocabulary), `completion_shape`, `operator_affinity[]`, `persona_affinity[]`. Schema validated by `tests/test-jtbd-taxonomy.cjs`. Per CONTEXT D-02, D-13, D-14.
- [ ] **HMI-100-02**: `lib/hmi/jtbd-classifier.cjs` exists. Exports `classify({ userMessage, room, operator, decisionsRecency }) -> { jtbd, confidence, evidence[] }`. Heuristic only (no LLM round-trip). 3 input strata weighted 0.5/0.3/0.2. JUST_TALK guard raises threshold to 0.8. Below 0.6 (or 0.8 for JUST_TALK), returns `{ jtbd: null, ... }`. Latency < 5ms warm. Per CONTEXT D-03, D-04, D-05; RESEARCH §3 algorithm.
- [ ] **HMI-100-03**: `lib/hmi/jtbd-state.cjs` exists. Exports `getCurrent(roomDir)`, `setCurrent(roomDir, jtbd, confidence, evidence, trigger)`, `clear(roomDir)`, `history(roomDir, n=20)`. State file at `<roomDir>/.mindrian/jtbd-state.json` per D-06. Atomic write via mktemp + rename. History bounded at 50 entries (oldest spill to a future Phase 103 cross-session store). 24h staleness rule per D-07 + RESEARCH §7 pitfall 4.
- [ ] **HMI-100-04**: `commands/jtbd.md` + `scripts/jtbd-command.cjs` exist. `/mos:jtbd` shows current state (Shape E). `/mos:jtbd set [<jtbd>]` (no arg → F.1 picker, with arg → manual override with trigger `manual`). `/mos:jtbd clear` returns null. `/mos:jtbd list` shows 13 entries. `/mos:jtbd history` shows last 20 transitions. Frontmatter: `body_shape: E (Action Report)`. Renderer 95.1-compliant: 4-zone anatomy, 12-glyph vocabulary, 5-color contract. Per CONTEXT D-09, D-10.
- [ ] **HMI-100-05**: `hooks/hooks.json` registers `UserPromptSubmit` and `Stop` hooks calling `node scripts/jtbd-update.cjs <event>`. The script: reads operator + active room + user message + STATE.md decisions recency, calls classifier, writes state if a transition occurs (current.jtbd changes OR confidence shifts > 0.15). Graceful degradation per RESEARCH §7 pitfall 5: try/catch wrap; classifier-error logs but never fails Larry's turn. Per CONTEXT D-11, D-12.
- [ ] **HMI-100-06**: `lib/hmi/ROOM.md` exists per CLAUDE.md Decision #15. Identifies the lib/hmi/ subtree as the home for HMI primitives (Phase 100 ships taxonomy + classifier + state; Phases 101-105 add selectors, renderer extensions, manifest schema, polling extensions). MINTO.md per Decision #15 not required at lib level (the .room-root cascade scope is room/, not lib/). ROOM.md frontmatter declares Phase 100 as the founding phase.
- [ ] **HMI-100-07**: `test/fixtures/jtbd-inference/seed-room/` exists as a sibling of `test/fixtures/cascade-e2e/seed-room/` (NOT a subdirectory) per the Phase 95.1 D-04 sibling-not-subdir pattern. Layout: `.room-root` + STATE.md (with seeded Decisions section recency for stratum-3 testing) + 30 seed user messages in `seed-messages.json` (5 per top-7 JTBD + 5 ambiguous + JUST_TALK + no-room edge cases) per RESEARCH §5 test stubs. Fixture is hermetic via `MINDRIAN_ROOMS_HOME` env override per Phase 95.1 D-05.

## Selector Library (HMI-101)

- [ ] **HMI-101-01**: `lib/hmi/shape-f6-renderer.cjs` exists. Implements Shape F.6 (JTBD-aware Next Move). Inherits keyboard contract from Phase 88.2 F.1. Verb list drawn from `lib/hmi/jtbd-taxonomy.json` `entries[i].next_move_verbs[]`. Free-Text always last (D-10 hardcoded). Mode B suppresses RECOMMENDED marker (D-05). Falls through to F.1 if jtbd null or verb set degenerate.
- [ ] **HMI-101-02**: `lib/hmi/shape-g-renderer.cjs` exists. Implements Shape G (Comparison Matrix). Render-only in v1. Inputs: options (>= 3), criteria (>= 2), cells. Cell text clamped to 12 chars + ellipsis; criterion clamped to 10 chars. Falls through to Shape E if dimensions degenerate. 12-glyph vocabulary enforced; column separator `|` allowed.
- [ ] **HMI-101-03**: `lib/hmi/shape-h-renderer.cjs` exists. Implements Shape H (Timeline / Roadmap). Render-only in v1. Inputs: start, end (ISO dates), milestones[] (>= 1), title?, width? (default 60, max 80). Markers `■`. Crowded milestones (< 3 cols apart) stack labels vertically. Empty milestones → 3-line error.
- [ ] **HMI-101-04**: `lib/hmi/selector-dispatcher.cjs` exists. Single integration point for Phase 102 renderer + Phase 104 per-command code. Logic: F + jtbd-non-null → F.6; F + jtbd-null → F.1 (delegate to 88.2); G → G; H → H; else → passthrough sentinel (caller renders A-E per skills/ui-system/SKILL.md).
- [ ] **HMI-101-05**: Mode B graceful per Canon Part 3 Rule 2. Tier check at dispatcher entry (defense in depth). Brain-unreachable Zone 1 prefix `Brain unreachable; running on local graph only.` rendered before any F.6 / G / H output. RECOMMENDED markers suppressed.
- [ ] **HMI-101-06**: Phase 88.2 (uiux-selector-block) deliverables for F.1-F.5 are referenced by F.6 inheritance. If 88.2 has not yet shipped at Phase 101 execution time, F.6 ships its own keyboard-contract layer using the AskUserQuestion structural marker pattern from Phase 95.1 D-18, deferred to 88.2 follow-up.

## Memory Continuity Layer (HMI-103)

- [ ] **HMI-103-01**: `lib/hmi/across-session-memory.cjs` exists. Reads/writes `~/MindrianRooms/.memory/jtbd-history.json` per CONTEXT D-02 schema (D-05). Concurrent-safe across multi-process sessions via lockfile (O_EXCL+O_CREAT, 2s TTL, 200ms retry budget) + atomic rename. Promotion gate honored (D-06: >=3 turns OR manual `/mos:jtbd set`). Parked detection (D-07: replaced for >=5 turns AND completion_shape NOT achieved). Completed detection (D-08: completion_pattern match via cascade side-channel). Honors global opt-out sentinel `~/MindrianRooms/.memory/.opt-out` (D-16) and per-room opt-out `<roomDir>/.mindrian/.memory-opt-out` (D-17). Every write appends a one-line audit entry to `~/MindrianRooms/.memory/audit.log` bounded at 10000 lines via FIFO truncation (D-18). Schema version 1 in every write. Per-room arrays bounded at 100 entries; spillover archives to `jtbd-history.archive.json`. NEVER writes to `<roomDir>/.mindrian/jtbd-state.json` (D-01: Phase 100 owns within-session). Per CONTEXT D-01..D-08, D-16..D-18; RESEARCH §2.2 atomicity + §7 retention.

- [ ] **HMI-103-02**: `lib/hmi/cross-room-memory.cjs` exists. Brain query path produces a generic-handle-only payload per CONTEXT D-03 — reuses Phase 90 `buildBrainQueryContext` allow-list (sha256 hashes + frozen enums + safe slug + clamped floats). Mode A enriches with Brain pattern hints ("rooms that ran X next ran Y, conf 0.71"). Mode B falls back to LOCAL synthesis via filesystem scan of `~/MindrianRooms/*/.mindrian/jtbd-state.json` per D-04 + D-14. Read-only Brain failure degrades cleanly per D-15 (single warning row in Zone 3, never blocks turn). Canon Part 8: zero LOCAL bytes leave the room. 5-tripwire defense (Phase 90 pattern, RESEARCH §3.3): (1) schema-leak heuristic scan (forbidden substrings: room_name, artifact_body, meeting_text, ISO timestamp regex outside allow-list), (2) buildBrainQueryContext single-chokepoint contract (only one brainClient.query call site), (3) brain-md-invariants body-text scan reuse, (4) sanitizeDetailScalar + JSON.stringify output audit, (5) cross-scenario sweep across 8+ graceful-degradation fixtures. Per CONTEXT D-03..D-04, D-14..D-15; RESEARCH §3.

- [ ] **HMI-103-03**: `commands/memory.md` + `scripts/memory-command.cjs` exist. 6 subcommands per CONTEXT D-10: `/mos:memory` (overview, Shape E), `/mos:memory query <jtbd>` (Shape G Comparison Matrix from Phase 101), `/mos:memory cross-room` (Shape G Mode A or Shape E Mode B), `/mos:memory resume` (Shape F.1 if no JTBD active, Shape F.6 if JTBD active), `/mos:memory park <jtbd>` (Shape E with before→after row), `/mos:memory complete <jtbd>` (Shape E with completion_shape row). Frontmatter: `body_shape: E (Action Report)` (default; subcommands declare shape-shifts inline). Renderer 95.1-compliant: 4-zone anatomy, 12-glyph vocabulary, 5-color contract per skills/ui-system/SKILL.md §1-§4. Honors opt-out sentinels (D-16, D-17): shows "Across-session memory disabled (opt-out sentinel present)" Zone 3 line + suppresses write paths. Cowork detected (presence of `00_Context/`) emits Zone 3 line "Cowork detected. Memory layer is per-USER, not team-shared." per RESEARCH §8 Pitfall 8. Graceful fallback if Phase 101 selectors not yet shipped at execution time: degrades Shape G to Shape E with note "Shape G renders after Phase 101 ships." Per CONTEXT D-09, D-10, D-16, D-17.

- [ ] **HMI-103-04**: `hooks/hooks.json` registers SessionStart resume nudge hook (D-11), extends Stop hook to call across-session persistence (D-12), registers PostToolUse completion-detector hook for Write|Edit|MultiEdit matchers (D-13). New script `scripts/memory-completion-detector.cjs` reads `<roomDir>/.mindrian/last-cascade.json` (Phase 95 side-channel 8-key payload) and matches `cascade.file_path` + `cascade.classification.edges_added` + `cascade.classification.state_md_section` against `completion_pattern.{artifact_glob, cascade_edge, state_md_key}` field added to `jtbd-taxonomy.json` per HMI-103-05. New script `scripts/memory-resume-nudge.cjs` calls `acrossSessionMemory.listInFlight(7)` and renders one-of-three recency variants per RESEARCH §6 (today / 1-3d / 4-7d). Existing Phase 100 `scripts/jtbd-update.cjs` Stop hook extended to call `promoteIfEligible` after write. Graceful degradation per CONTEXT D-14, D-15: classifier-error rows never crash a turn; try/catch wraps every script. Hook latency budget < 250ms total per RESEARCH §2.2. SessionStart nudge text matches `references/personality/voice-dna.md` cadence (terse, declarative, no "I", no apology). Per CONTEXT D-11..D-13, D-14..D-15; RESEARCH §6.

- [ ] **HMI-103-05**: `lib/hmi/jtbd-taxonomy.json` extended additively with `completion_pattern` field per JTBD entry (object: `{ artifact_glob, cascade_edge, state_md_key }`; null for `explore`). Schema version remains 1 (additive change only); existing 100-01 schema test must still pass after extension. `tests/test-jtbd-taxonomy.cjs` gains assertion: every non-`explore` entry has a `completion_pattern` block with at least one of the three sub-fields populated. Patterns dictionary per RESEARCH §4.3: decide-pursue → `{cascade_edge: 'decision_edge:APPROVE|decision_edge:REJECT', state_md_key: 'Decisions'}`, find-bottleneck → `{artifact_glob: '**/rs-thesis*.md', cascade_edge: 'REVERSE_SALIENT'}`, prepare-pitch → `{artifact_glob: '**/exports/*.html|**/dashboard*.html', state_md_key: 'MEETING-PREP'}`, etc. (12 entries; explore has null). Per CONTEXT D-08; RESEARCH §4.

- [ ] **HMI-103-06**: `test/fixtures/memory-continuity/` exists as a SIBLING of `test/fixtures/jtbd-inference/seed-room/` (NOT a subdirectory) per Phase 95.1 D-04 sibling-not-subdir pattern. Layout: `room-a/.room-root` + `room-a/.mindrian/jtbd-state.json` (seeded with current=prepare-pitch confidence=0.78) + `room-b/.room-root` + `room-b/.mindrian/jtbd-state.json` (seeded with current=find-bottleneck confidence=0.62) + `.rooms/registry.json` (both rooms registered, `active: room-a`) + `.memory/jtbd-history.json` (seeded with synthetic in_flight/parked/completed rows for both rooms). Hermetic via `MINDRIAN_ROOMS_HOME` env override per Phase 95.1 D-05. The runtime production-side `~/MindrianRooms/.memory/ROOM.md` per CLAUDE.md Decision #15 is created by Plan 103-02's `ensureDir` helper on first promote write (deferred from Wave 0; Wave 0 ships only the test fixture). Per CONTEXT D-02; RESEARCH §10 Wave 0 fixture seeding.

## HMI Compliance Polling (HMI-105)

- [ ] **HMI-105-01**: `lib/hmi/compliance-poller.cjs` exists. Exports `pollCommand(commandPath)` returning `{ command, body_shape, zones_observed[], glyph_violations[], color_violations[], jtbd_manifest, status: 'pass'|'warn'|'fail', evidence[] }`. Heuristic only (no LLM round-trip). Reads `commands/*.md` frontmatter for `body_shape` + `serves_jtbd` declarations and reads any rendered output captured under `.mindrian/poller-cache/<cmd>/` to score 4-zone anatomy + 12-glyph vocabulary + 5-color contract per skills/ui-system/SKILL.md §1-§4. Latency budget < 50ms warm per command. Aggregator `pollAll({ commandsDir, jtbdTaxonomy })` returns `{ totals: {pass, warn, fail}, perCommand[], coverage: {body_shape, serves_jtbd} }`. Per Canon Part 7 Reuse Before Build: re-uses `tests/test-jtbd-ui-self-compliant.cjs` regex assertions wholesale (Phase 100-04 patterns-established Pattern 2).

- [ ] **HMI-105-02**: `lib/hmi/command-coverage-scanner.cjs` exists. Exports `scanCommands({ commandsDir, taxonomyPath })` walking the full `commands/*.md` tree (currently 80+ commands per Phase 88.1 description-discipline sweep) and returning `{ scanned, missing_body_shape[], missing_serves_jtbd[], orphan_jtbd[], coverage_pct }`. The `orphan_jtbd[]` list flags every `serves_jtbd:` handle that does NOT resolve to a Phase 100 `lib/hmi/jtbd-taxonomy.json` entry id (Canon Part 3 closed-vocabulary enforcement). Skips system commands (e.g. `commands/_internal-*.md`) per a hardcoded prefix list. Latency budget < 250ms warm for the full 80+ command sweep. Surfaces results in Shape E renderer-friendly form for Plan 105-03's CLI.

- [ ] **HMI-105-03**: `commands/compliance-poll.md` + `scripts/compliance-poll-command.cjs` exist. `/mos:compliance-poll` shows aggregated poll results (Shape E Action Report, default mode). `/mos:compliance-poll <command>` polls one command and renders per-command detail (Shape E with evidence rows). `/mos:compliance-poll --coverage` renders the coverage scan from HMI-105-02 (Shape E). `/mos:compliance-poll --json` emits machine-readable output for hooks/CI. Frontmatter: `body_shape: E (Action Report)`, `serves_jtbd: ["audit-room"]`. Renderer 95.1-compliant: 4-zone anatomy (Zone 1 header `-- {room} -- compliance-poll -- {stage} --`, Zone 2 body, Zone 3 detail rows, Zone 4 action footer with 2-3 grounded `/mos:` commands), 12-glyph vocabulary, 5-color contract. Tier 0 fallback (no active room) renders the 3-line error per Canon Part 3 Rule 2 and exits 0 for graceful degradation, mirroring Phase 100-04's `/mos:jtbd` pattern.

- [ ] **HMI-105-04**: `hooks/hooks.json` registers a `PostToolUse` matcher for `Edit|Write|MultiEdit` events on `commands/*.md` calling `node scripts/compliance-poll-update.cjs <event>`. The script: reads the affected command file, calls `pollCommand()` from HMI-105-01, persists a single-row delta to `<roomDir>/.mindrian/compliance-state.json` (atomic mktemp + rename per Phase 100-03 D-06 pattern). Graceful degradation per Phase 100-05 D-14: try/catch wrap; classifier-error logs to stderr but never fails Larry's turn. Hook latency < 100ms total. Envelope schema strict per Phase 95 BASH-95-01 (top-level allowlist; additionalContext only inside hookSpecificOutput). Canon Part 8: zero Brain queries, zero network IO.

- [ ] **HMI-105-05**: `lib/hmi/jtbd-taxonomy.json` extended additively with `compliance_pattern` field per JTBD entry (object: `{ required_body_shape, required_zones[], forbidden_glyphs[] }`; defaults applied if absent). Schema version remains 1 (additive change only); existing 100-01 schema test must still pass after extension. `tests/test-jtbd-taxonomy.cjs` gains assertion: every entry that has at least one `methodology_hooks[]` populates a `compliance_pattern.required_body_shape` value drawn from the canonical body-shape set `{A, B, C, D, E, F, G, H}` (the eight shapes registered across Phase 88.2 + Phase 101). Patterns dictionary per Phase 105 RESEARCH §5: decide-pursue → `{required_body_shape: 'F.1', forbidden_glyphs: ['✗', '❌']}`, find-bottleneck → `{required_body_shape: 'E', required_zones: ['header', 'body', 'footer']}`, prepare-pitch → `{required_body_shape: 'H', required_zones: ['header', 'timeline', 'footer']}`, etc. Plan 105-04 owns the body-text fill. Per Canon Part 3 § The 10 verbs (closed vocabulary).

- [ ] **HMI-105-06**: `test/fixtures/hmi-compliance-polling/` exists as a SIBLING of `test/fixtures/memory-continuity/` (NOT a subdirectory) per Phase 95.1 D-04 sibling-not-subdir pattern. Layout: `.room-root` + `commands/sample-pass.md` (frontmatter compliant: body_shape: E, serves_jtbd: ["audit-room"]) + `commands/sample-warn.md` (missing serves_jtbd) + `commands/sample-fail.md` (unauthorized box chars in fixture rendered output) + `.rooms/registry.json` + `.mindrian/compliance-state.json` (seeded with synthetic per-command rows). Hermetic via `MINDRIAN_ROOMS_HOME` env override per Phase 95.1 D-05. The fixture exists for Wave 1 plans (105-01..05) to load before Plan 105-00 (this Wave-0 plan) sets up the requirement IDs + test stubs.

## Selector Block Rollout (UISEL-88.2)

- [ ] **UISEL-88.2-01**: `lib/hmi/shape-f1-renderer.cjs` exists. Implements Shape F.1 (Next Move) canonical renderer per skills/ui-system/SKILL.md §2 Shape F.1. 3-5 options drawn from canonical 10-verb vocabulary (Canon Part 3); Free-Text always last (hardcoded). RECOMMENDED marker (`▶`) only when Mode A AND Brain confidence >= 0.7 (Phase 88.2 invariant); Mode B suppresses marker. Keyboard contract: up-arrow / down-arrow (or J/K) to navigate, Enter to select, `?` to inspect, Esc to cancel. Glyph vocabulary: only `▶ ▷ ■ • →` allowed in body. Replaces lib/hmi/shape-f1-fallback.cjs as the dispatcher's preferred F.1 module (fallback retained for back-compat per CONTEXT.md "no breaking changes" invariant).
- [ ] **UISEL-88.2-02**: `lib/hmi/shape-f2-renderer.cjs` exists. Implements Shape F.2 (Path Control) per SKILL.md §2 Shape F.2. 3-5 options drawn from {Run Methodology, Reformulate, Scenario Plan, Defer, Free-Text}; Free-Text always last. State-update hook updates STATE.md `Current Position.Plan` field. Mode A/B render contract identical to F.1. Used by `/mos:act` plan-mode collapse + `/mos:diagnose` replan branch.
- [x] **UISEL-88.2-03**: `lib/hmi/shape-f3-renderer.cjs` exists. Implements Shape F.3 (Rabbit-Hole Depth) per SKILL.md §2 Shape F.3. EXACTLY 5 fixed options: Shallow / Medium / Deep / Extreme / Back. NOT drawn from canonical verb vocabulary; depth is a closed scalar axis. NO Free-Text slot (closed). State-update hook creates a TodoWrite row tagged `depth:{shallow|medium|deep|extreme}`. Used by `/mos:grade` and `/mos:deep-grade` rubric-dimension drilling and `/mos:pipeline` rabbit-hole entry.
- [x] **UISEL-88.2-04**: `lib/hmi/shape-f4-renderer.cjs` exists. Implements Shape F.4 (Insight Extraction) per SKILL.md §2 Shape F.4. EXACTLY 5 fixed options: Key insights / + contradictions / + actions / Create artifact draft / Back. NOT Free-Text-bearing (closed ladder). Wraps the canonical Synthesize verb. State-update hook appends to STATE.md `Accumulated Context`; "Create artifact draft" additionally creates a TodoWrite drafting row. Used by `/mos:analyze-needs` discuss-chunk close-out.
- [x] **UISEL-88.2-05**: `lib/hmi/shape-f5-renderer.cjs` exists. Implements Shape F.5 (Branch Resolution) per SKILL.md §2 Shape F.5. 3-5 options drawn from {Continue, Merge, Compare, Park, Drop, Free-Text}; Free-Text always last when present. Branch-resolution semantics: Continue -> Run Methodology on chosen branch; Merge -> Synthesize across branches; Compare -> Scenario Plan in compare mode; Park -> Defer; Drop -> Reject-with-reason terminal path. State-update hook appends Decisions row + writes typed edge `(branch-root) -[RESOLVED {verb}]-> (target)`. Used by `/mos:file-meeting` section routing and `/mos:find-analogies` cross-domain branch resolution.
- [ ] **UISEL-88.2-06**: `lib/hmi/selector-telemetry.cjs` + operator-aware integration in `lib/hmi/selector-dispatcher.cjs`. Telemetry: every selector presentation AND every response writes a one-line JSONL record to `~/.mindrian/telemetry/selector.jsonl` per CONTEXT invariant. Record schema: `{ts, room_slug_sha256, sub_shape, mode, options_count, recommended_present, response_index, response_was_free_text, latency_ms}`. LOCAL only per Canon Part 8 (no Brain egress; sha256-hashed room slug, NEVER user content). Bounded at 10000 lines via FIFO truncation (Phase 100-03 D-06 pattern). Operator-aware integration: `pickShape()` reads `lib/conversation/operator.cjs` `getCurrent(roomDir)` and gates which sub-shapes are admissible per Canon Part 3 § The 3-layer loop / Phase 102 RENDER-102-02 (DECISION_GATE -> F.x admissible; JUST_TALK -> dispatcher refuses with `code: 'render_v2_compaction_violation'` style error; other operators map per CONTEXT.md authority docs). Backward compatible: operator absent / state-file-missing degrades to permissive (current Phase 101 behavior preserved).
- [x] **UISEL-88.2-07**: `lib/hmi/shape-f0-renderer.cjs` exists. Implements Shape F.0 (Mini Decision Gate) per CONTEXT.md amendment 2026-04-29. EXACTLY 3 options: Approve / Reject (with reason capture) / Defer. NO Free-Text slot (the reason field on Reject IS the free-text path). Single-line ASCII border (visual sub-decision cue, distinct from F.1-F.5 double-line parent shapes). Reject-with-reason path produces a `REJECTED_BECAUSE` typed edge via Phase 109 `lib/core/navigation.cjs` memory_event API with property schema `{ reason: string, rejected_at: ISO timestamp, parent_decision_id: string, actor_id?: string, confidence_self_report?: number 1-5 }` per RESEARCH.md DISCRETION-AMEND-03. Persona-AGNOSTIC visually (D-AMEND-04). Composable inside F.4 + cascade flows + session-start banner consolidation.
- [x] **UISEL-88.2-08**: `lib/hmi/shape-f6-plan-review-renderer.cjs` (NOTE: collision-safe path -- NOT `shape-f6-renderer.cjs` which is Phase 101-01 JTBD-aware Next Move) + `lib/hmi/decoy-tier.cjs` + round-state graph node. Implements Shape F.6 (Plan Review Round) per CONTEXT.md amendment 2026-04-29. 15-30 questions per round (default 20), 4:1 real:decoy ratio, calibration decoys NOT disclosed during round, debrief Shape A action report at round end. Each response writes one `REVIEWED` typed edge with properties `{round_id, position, latency_ms, was_decoy, response, confidence_self_report}`. decoy-tier.cjs API: `selectDecoys({ artifactPath, roundSize, realCount, profile, roleBlend, brainAvailable, tierOverride })` returning `{ decoys, tier, tier_reason, distribution_seed }` per RESEARCH.md DISCRETION-AMEND-02. Tier 0 algorithmic (5 perturbation axes: wrong_owner, wrong_dependency, wrong_metric, wrong_scope, wrong_invariant), Tier 1 Brain-driven, Tier 2 persona-aware (rounds_total >= 100 + topic_coverage backstop). Comprehension profile at `<roomDir>/.mindrian/comprehension-profile-<sha256(user_id):16>.json`.
- [x] **UISEL-88.2-09**: `lib/hmi/selector-telemetry.cjs` DUAL-SURFACE extension. Primary surface unchanged: LOCAL JSONL append at `~/.mindrian/telemetry/selector-events.jsonl` per existing pattern. Mirror surface ADDED: `recordSelectorMirror(roomDir, eventType, payload)` invokes `lib/core/navigation.cjs` chokepoint to write a `memory_event` row in room.db with `event_type` matching one of 4 new EVENT_TYPES strings (`selector_presentation`, `selector_response`, `selector_rejection_captured`, `f6_round_completed`). Resilience: if Phase 109 spine unavailable, JSONL still emits. BOTH surfaces are LOCAL per Canon Part 8 (zero LOCAL->BRAIN egress).
## Per-Command JTBD Declarations (JTBDCONS-104)

- [ ] **JTBDCONS-104-01**: Every file in `commands/*.md` (currently 84 files per `ls commands/*.md | wc -l`) declares a `serves_jtbd:` field in YAML frontmatter. Value MUST be a JSON-style array of one or more JTBD ids drawn from `lib/hmi/jtbd-taxonomy.json` `entries[i].id` (13 canonical ids: decide-pursue, find-problem, understand-market, find-bottleneck, prepare-pitch, validate-idea, compare-options, connect-domains, surface-contradiction, plan-execution, file-meeting, audit-room, explore). Sweep is mechanical via the verbatim mapping table embedded in Plan 104-01. The 3 commands that already declare (commands/jtbd.md, commands/memory.md, commands/hmi-status.md per Phase 100-04 / 103-03 / 105-02 shipped work) MUST be left BYTE-IDENTICAL by Plan 104-01 (re-declaration is a no-op). Plan 104-01 owns the sweep mechanics. NO new commands ship; NO selector-dispatcher changes.
- [ ] **JTBDCONS-104-02**: `tests/test-command-jtbd-declarations.cjs` exists. Walks `commands/*.md` (sync glob via `fs.readdirSync` + filter; node built-ins only, zero deps per Phase 87 invariant), parses YAML frontmatter (in-house parser per Phase 88-00 pattern; do NOT add `js-yaml` dependency), and asserts: (a) every command file has a `serves_jtbd:` field, (b) the field is an array of strings, (c) every string in the array resolves to a `lib/hmi/jtbd-taxonomy.json` `entries[i].id` (closed-vocabulary enforcement per Canon Part 3 ten-verb principle applied to JTBDs). Failure mode: list every offending file with line number. Latency budget < 500ms warm. Exit 0 = PASS; exit 1 = FAIL; exit 77 (degraded env) reserved for missing-taxonomy edge cases. Plan 104-02 owns the implementation; Plan 104-00 owns only the Wave-0 stub.
- [ ] **JTBDCONS-104-03**: `tests/test-command-jtbd-coverage.cjs` exists. Reverse coverage scan: walks all 13 JTBD ids in `lib/hmi/jtbd-taxonomy.json` `entries[]` and asserts each id appears in at least one `commands/*.md` `serves_jtbd:` declaration. The `explore` fallback id MUST also be served by at least one command (reasonable candidates: `/mos:operator`, `/mos:status`, `/mos:help`, `/mos:splash`). Failure mode: list every orphan JTBD id (taxonomy entry that NO command serves). Latency budget < 500ms warm. Exit 0 = PASS; exit 1 = FAIL. Plan 104-02 owns the implementation; Plan 104-00 owns only the Wave-0 stub.
- [ ] **JTBDCONS-104-04**: `tests/test-command-jtbd-backward-compat.cjs` exists. Backward-compat regression fence: asserts that the selector-dispatcher (`lib/hmi/selector-dispatcher.cjs`, Phase 101-04, already shipped) handles a synthetic command WITHOUT `serves_jtbd:` declared by falling through to F.1 (NOT crashing, NOT throwing, NOT entering F.6). The test constructs a fixture with a fake command file that omits the field, calls `pickShape({ requestedShape: 'F', roomDir: <fixture>, payload: {} })`, and asserts the result is shape F.1 (NOT F.6) with no error. This pins the canonical invariant from CONTEXT.md "Backward compat: commands without serves_jtbd continue to work (selector falls through to F.1)." Plan 104-03 owns the implementation; Plan 104-00 owns only the Wave-0 stub.
- [ ] **JTBDCONS-104-05**: Wave-0 test substrate registered in `lib/memory/run-feynman-tests.cjs`. 3 stubs at `tests/test-command-jtbd-declarations.cjs`, `tests/test-command-jtbd-coverage.cjs`, `tests/test-command-jtbd-backward-compat.cjs`. Each stub exits 0 with the canonical "Phase 104 Wave 0 stub - to be implemented by plan 104-NN" line (HYPHEN, NOT em-dash, per project hard rule). Plans 104-02..104-03 swap implementations into these stubs WITHOUT changing the registered paths. Canon Part 8: zero Brain queries in any of the 3 test files (or their fills). Canon Part 7: tests reuse Phase 100-00 stub-pattern verbatim, no new test scaffolding invented.

## Graph Memory Schema Reconciliation (RECONCILE-108)

- [x] **RECONCILE-108-01**: Canonical node taxonomy ships as `RECONCILIATION.md` resolving every Codex-proposed node type (`room`, `folder`, `artifact`, `claim`, `assumption`, `evidence`, `decision`, `open_question`, `entity`, `meeting`, `opportunity`, `brain_insight`, `memory_event`, `human_review`) AND every existing node type (`Artifact`, `Section`, `CausalClaim`, `Stakeholder`) to one of EXISTS / EXTEND / NEW / RESERVED with Canon Part justification. Per CONTEXT D-01 + RESEARCH §2.2 + §2.3 + §2.4 corrections (`opportunity` graph node is NEW not EXISTS; `assumption` is EXTEND not NEW; `Stakeholder` row added for completeness).

- [x] **RECONCILE-108-02**: Canonical edge taxonomy ships as part of `RECONCILIATION.md` reconciling every Codex-proposed edge (`CONTAINS`, `STATES`, `SUPPORTS`, `CONTRADICTS`, `INFORMS`, `DEPENDS_ON`, `EVIDENCES`, `ASSUMES`, `DECIDES`, `RAISES_QUESTION`, `REPLACES`, `MENTIONS_ENTITY`, `BUDDED_FROM`, `SHARES_ASSUMPTION_WITH`, `BANKED_BY`, `RANKS_OPPORTUNITY`, `ANSWERS_OPPORTUNITY`) against the actual 23-edge `EDGE_TYPES` array in `lib/core/lazygraph-ops.cjs:25` (all 23: INFORMS, CONTRADICTS, CONVERGES, ENABLES, INVALIDATES, BELONGS_TO, REASONING_INFORMS, HSI_CONNECTION, REVERSE_SALIENT, ANALOGOUS_TO, STRUCTURALLY_ISOMORPHIC, RESOLVES_VIA, CAUSES, ROOT_CAUSE_OF, CASCADES_TO, EXTRACTED_FROM, WHITESPACE_DETECTED, WHITESPACE_NEAR, DISCOVERY_CYCLE_SOURCE, DISCOVERED, DERIVED_FROM, AUTHORED_BY, AFFILIATED_WITH). Every entry in `EDGE_TYPES` MUST appear in `RECONCILIATION.md` with `EXISTS` resolution (per RESEARCH §2.1 + §2.4 correction; otherwise pre-commit hook D-05 false-positives on legitimate code).

- [x] **RECONCILE-108-03**: `PROVENANCE.md` documents the required + optional fields every node MUST carry once Phase 109 migrates: required fields `source_path TEXT NOT NULL`, `created_by TEXT NOT NULL CHECK(created_by IN ('user','larry','import','brain','system'))`, `confidence REAL` (nullable), `review_status TEXT NOT NULL DEFAULT 'proposed'`, `created_at INTEGER NOT NULL`, `last_seen_at INTEGER NOT NULL`; optional `source_section TEXT`, `confirmed_by TEXT`, `confirmed_at INTEGER`. Plus index strategy (mandatory `idx_nodes_review_status`; partial `idx_nodes_confirmed_by WHERE confirmed_by IS NOT NULL`). Plus the canonical Part 9 invariant SQL query: `SELECT id, type, source_path, created_by, confirmed_by FROM nodes WHERE review_status = 'confirmed' AND (confirmed_by IS NULL OR confirmed_by != 'user');`. Per CONTEXT D-02 + RESEARCH §3. **CONTRACT specification only - Phase 108 ships zero migration code; Phase 109 implements the columns and indices.** Per RESEARCH §3 "JSON blob vs first-class columns" tradeoff: documents the two-step migration (add NULL columns, backfill from JSON via `json_extract`, alter to NOT NULL) for Phase 109.

- [x] **RECONCILE-108-04**: `TRUTH-STATES.md` documents the closed 8-state taxonomy (`proposed | confirmed | rejected | stale | superseded | needs_evidence | validated | invalidated`) plus the full transition table (8 documented transitions: proposed -> confirmed; proposed -> needs_evidence; needs_evidence -> validated; confirmed -> validated; validated -> invalidated; proposed -> rejected; confirmed -> superseded; confirmed -> stale) with trigger and required-evidence per Canon Part 5 columns; plus the `status_aliases` mapping reconciling existing `assumptions.validity` enum at `lib/core/memory-ops.cjs:64-74` (`untested -> proposed`, `supported -> validated`, `contradicted -> invalidated`, `stale -> stale`); plus the `status_stale` auto-marker rule (90-day default + `confirmed`/`validated` only + edges-not-touched + staleable node types `claim`/`assumption`/`decision`/`opportunity`). Per CONTEXT D-03 + RESEARCH §4.

- [x] **RECONCILE-108-05**: `aliases.yml` ships at `.planning/phases/108-graph-memory-schema-reconciliation/aliases.yml` with `schema_version: 1`, `phase: 108`, `canon_part: 9`, `edge_aliases:` array (every Codex-proposed edge + every existing 23 EDGE_TYPES entry), `node_aliases:` array (every Codex-proposed node + every existing node type), `status_aliases:` map (4 entries from D-03). Each alias entry has `codex_term`, `resolution` (one of EXISTS|EXTEND|NEW|RESERVED), `canonical_name`, `canon_parts` (non-empty list), and conditional fields (`direction`, `deferred_to_phase`, `source_phase`, `related_existing*`). Pre-commit hook script ships at `scripts/check-schema-aliases.cjs` (CJS, zero new deps, in-house YAML parser per RESEARCH §6 + Phase 88-00 pattern); fails commits introducing CREATE TABLE statements with table names not in the alias resolution column. Per CONTEXT D-04 + D-05 + RESEARCH §5 + §6.

- [x] **RECONCILE-108-06**: `PART-9-PROPOSAL.md` ships at `.planning/phases/108-graph-memory-schema-reconciliation/PART-9-PROPOSAL.md` as a cross-reference checklist binding every reconciliation decision to Canon Parts 1, 4, 5, 7, 8, 9 (proposed). The file does NOT duplicate the Part 9 text (which lives at `.planning/research/2026-05-03-canon-part-9-memory-locality-proposal.md`); it references that file and walks the traceability matrix from RESEARCH §7. `docs/CANON-PHASE-MAP.md` gains a "Part 9 (proposed)" row pointing at Phases 108 (proposal), 109 (implementation + ratification at release gate), 110 (Brain wire enforcement). Phase 108 explicitly does NOT edit `docs/MINDRIAN-CANON.md` (Phase 109 release gate ratifies; per CONTEXT D-06 + RESEARCH Anti-Pattern #2).

## SQL Context-Memory Navigation Spine (NAV-109)

- [x] **NAV-109-01**: Focus Node Model. `lib/core/navigation.cjs` exports `getActiveFocus(sessionId)` and `setFocus(sessionId, nodeId, setBy)`. Focus is persistent in `room.db` via `session_focus` table (PRIMARY KEY session_id; foreign key to nodes.id; set_by closed-enum CHECK constraint with values user/larry/auto-from-jtbd/auto-from-operator/auto-from-state). Switching focus writes a `memory_event` of type `focus_changed`. Auto-focus cascade per CONTEXT D-01: rule 1 active JTBD anchor; rule 2 most recent unconfirmed decision when operator is DECISION_GATE; rule 3 room root node `room:<roomId>`. Statusline glyph 🎯 surfaces active focus per Phase 106-02 fence amendment. Per CONTEXT D-01 + RESEARCH section 4.

- [x] **NAV-109-02**: Typed Neighborhood Retrieval. `lib/core/navigation.cjs` exports `getNeighborhood(focusNodeId, { maxDepth = 2, topK = 20 })`. Single recursive CTE returns ranked typed neighbors with `edge_path` (JSON array of node ids), `depth`, `edge_type_in`, plus the 9 provenance fields. Frozen edge weights per CONTEXT D-02 (CONTRADICTS / INVALIDATES = 1.0; DEPENDS_ON / ASSUMES = 0.9; SUPPORTS / EVIDENCES = 0.8; INFORMS / ENABLES = 0.6; CONVERGES / MENTIONS_ENTITY = 0.4). Composite score per RESEARCH section 2.1: edge_type_weight times 0.4 plus recency times 0.2 plus confidence times 0.2 plus section_relevance times 0.2. Performance: <50ms warm p95 on 10K-node room. Zero LLM calls. Zero Brain calls. Per CONTEXT D-02 + RESEARCH section 2.1.

- [x] **NAV-109-03**: Memory Event Log. `memory_event` is a first-class node type per Phase 108 RECONCILIATION.md L104; rows live in the unified `nodes` table (NOT a separate `memory_events` table). 15 closed-set event types (14 from CONTEXT D-03 plus `state_alias_migration` per Phase 108 TRUTH-STATES.md L68). JS validation rejects event_type values outside the closed enum. `findRecentChanges(sinceEpochMs)` is a single SELECT against `WHERE type = 'memory_event' AND created_at > :since` driven by the new `idx_nodes_type` plus `idx_nodes_created_at` indices. Per CONTEXT D-03 + RESEARCH section 2.4.

- [x] **NAV-109-04**: Insight Query Primitives. `lib/core/navigation.cjs` exports the 7 closed-vocabulary functions per CONTEXT D-04: `findContradictions`, `findUnsupportedClaims`, `findBlockingAssumptions`, `findStaleDecisions`, `findOpenQuestions`, `findRecentChanges`, `findRelevantOpportunities`. Each returns a typed result plus templated explanation string using the typed edge labels per RESEARCH section 2.5 (zero LLM in the loop). `findRelevantOpportunities` ranks via the formula `weightHsi (0.5) times normalize(hsiScore) plus weightDistance (0.3) times graphDistanceScore plus weightJtbd (0.2) times jtbdMatchScore` per RESEARCH section 5.

- [x] **NAV-109-05**: Navigation API surface. `lib/core/navigation.cjs` exports exactly 13 functions per CONTEXT D-05 (closed surface). Pre-commit hook extends `scripts/check-schema-aliases.cjs` (Plan 108-05 substrate) with the chokepoint check: any new `require('lib/core/room-db.cjs')` outside the allow-list (navigation.cjs, navigation/*.cjs, room-db.cjs self, lazygraph-ops.cjs co-module, memory-ops.cjs co-module, opportunity-ops.cjs legacy, tests/, scripts/migrate-) fails the commit. Same script per RESEARCH section 3.2 (single mega-script per Open Question 11.7); installer (scripts/install-pre-commit.sh) does NOT change. Per CONTEXT D-05 + RESEARCH section 3.

- [x] **NAV-109-06**: Brain Packet Builder. `lib/core/navigation.cjs` exports `buildBrainPacket(job, focusNodeId)` returning a plain JS object per the shape in CONTEXT D-06. `banked_opportunities` field carries top-3 by HSI plus distance plus JTBD with sha256-hashed ids, generic domain tags only, HSI bands (high `>=70` / medium `>=40` / low), composite scores rounded to 2 decimals. NEVER raw bodies. Inherits the Phase 90 buildBrainQueryContext 5-tripwire pattern. Per CONTEXT D-06 + RESEARCH section 7. Phase 109 ships the BUILDER; Phase 110 ships the schema validation.

- [x] **NAV-109-07**: Brain Result Ingestion. `lib/core/navigation.cjs` exports `storeBrainSuggestions(packetResult, sessionId)` writing each suggestion as a `brain_insight` node with `created_by = 'brain'`, `review_status = 'proposed'`, `confirmed_by IS NULL`, `source_path` starting with `brain:job:`. Logs ONE `memory_event` of type `brain_suggestion_received` per ingestion (not one per insight). Edge proposals from Brain land with `properties.review_status = 'proposed'`. Phase 108 invariant SQL query (PROVENANCE.md L79-89) returns 0 rows post-ingestion. Per CONTEXT D-07 + RESEARCH section 8.

- [x] **NAV-109-08**: Room Home Driver. `lib/core/navigation.cjs` exports `getRoomHomeView(roomId)` composing the navigation primitives into the shape per CONTEXT D-08 (currentThesis / confirmedFacts / riskyAssumptions / evidence / contradictions / openQuestions / recentChanges / bankedOpportunities / nextMove). Composition not duplication: id-set comparison test asserts no payload field re-derives data already in another field. Phase 90 BRAIN.md derivation 4-release deprecation cycle per RESEARCH section 6.2 (alias in v1.14.0 keeps byte-identical output; default flips in v1.15.0; folder path removed v1.16.0). Per CONTEXT D-08 + RESEARCH section 6.

- [x] **NAV-109-09**: Canon Part 9 ratification at release gate. The Phase 109 release commit merges proposed Part 9 text from `.planning/research/2026-05-03-canon-part-9-memory-locality-proposal.md` into `docs/MINDRIAN-CANON.md` immediately before `## Appendix A - Relationship to MWP`. `docs/CANON-PHASE-MAP.md` Part 9 (proposed) row updates from `proposed`/`planned` to `shipped` for Phases 108 and 109 (Phase 110 stays `planned`). Appendix D Canonization Provenance gains entry 12 attributing Codex external research input. NO other Phase 109 plan touches the canon files. Per CONTEXT D-09 + RESEARCH section 9.

## Workflow Layer (WORKFLOW-122)

- [x] **WORKFLOW-122-01**: Single source of truth. Every `commands/*.md` file declares the Phase 122 frontmatter contract -- `kind: methodology|utility|meta`, `frameworks: ["<exact Brain :Framework name>", ...]` ([] for utility/meta), `produces: "<room artifact glob>"|null`, `inputs: ["<expected room state>", ...]` ([] valid), `autonomous_safe: true|false` -- documented in `docs/COMMAND-FRONTMATTER.md`. `frameworks:` is the ONLY place the framework-to-command mapping is declared; no skill, no doc, no hardcoded map may assert it. The algorithmic command cohort (HSI / whitespace / explore-domains / research+think-hats / rs-* / find-* / diagnostics / scoring / systems / argument-structure) is retrofitted FIRST; utility/meta get `frameworks: []`. Per spec reliability rule 1; Canon Part 7. Plan 122-01.
- [x] **WORKFLOW-122-02**: Generated registry. `data/command-registry.json` (`{ ontology_ref, generated_note, commands[], framework_index, curated_chains[] }`) is built from `commands/*.md` frontmatter by `scripts/build-command-registry.cjs` (CJS, node builtins only, hand-rolled frontmatter parse + hand-rolled shape validation, zero new deps). `data/framework-names.json` is the committed snapshot of the FEEDS_INTO-linked Brain `:Framework` subset (~105 names, NOT all 748), refreshed via a build-time-only read-only `brain.query` (`--refresh-names`). The resolver and the generator never need the Brain at runtime. Per spec reliability rule 2; Canon Part 7 + Part 8. Plan 122-02.
- [x] **WORKFLOW-122-03**: CI drift tripwire. `node scripts/build-command-registry.cjs --check` regenerates in memory and exits non-zero on (a) a stale on-disk registry OR (b) a `frameworks:` entry not in `data/framework-names.json`, printing a recovery command; wired into `.git/hooks/pre-commit` (and `scripts/hooks/pre-commit`) when any `commands/*.md`, `data/command-registry.json`, or `data/framework-names.json` is staged; `lib/memory/command-registry.test.cjs` (registered in `lib/memory/run-feynman-tests.cjs` TEST_FILES[] and `tests/run-all-122.sh`) asserts non-stale registry + inverse-map round-trip + algorithmic-cohort registered as methodology + the Canon Part 8 grep guard. Mirrors the DESIGN of the brain-cleanup Phase-6 CI-01 tripwire (that file does not exist; mirror the pattern). Per spec reliability rule 2; Canon Part 7. Plans 122-01 (test stub) + 122-02 (real).
- [x] **WORKFLOW-122-04**: The resolver is the only door. `lib/workflow/command-resolver.cjs` exposes `commandsForFramework(name)`, `frameworksForCommand(cmd)`, `composeWorkflow(frameworkChain) -> [{step, framework, command|null, optional}]`, `validateChainAutonomy(workflow) -> {runnable, blockers}`; reads only `data/command-registry.json` (cached per process); contains NO `require('brain-client')` and nothing network; degrades to empty results on a missing/empty registry. Every `/mos:` string any orchestrator emits came back from `composeWorkflow` -- Larry never names a command from memory. Per spec reliability rule 3; Canon Part 3 (feeds `offer_next_step`) + Part 8 (zero Brain). Plan 122-03.
- [x] **WORKFLOW-122-05**: Chain recommender. `lib/brain/chain-recommender.cjs` exposes `recommendFrameworkChain({problemType?, currentFramework?, roomState?}) -> [frameworkName]` via a Brain `FEEDS_INTO` traversal that REUSES `lib/core/framework-chain-composer.cjs` (the FEEDS_INTO parse/propose) + `lib/core/problem-type-router.cjs` (the seed picker) + `lib/core/brain-client.cjs` (the chokepoint) -- it does not hand-roll graph traversal; degrades to `[seed]` cleanly; its Cypher carries framework names + problem-type/phase enums ONLY (no `/mos:` literal, no user content). Returns framework names only (the resolver attaches commands). Hard dep: brain-cleanup Phase 5 (`enrichCausalEdges` -> `FEEDS_INTO`), DONE. Per spec reliability rule 4 (the chain source); Canon Part 8. Plan 122-03.
- [x] **WORKFLOW-122-06**: The trigger is the hook, not the model. `lib/core/framework-chain-composer.cjs proposeNextFramework()` resolves the next-framework command via `command-resolver.commandsForFramework()` (degrading to `command: null` when there is none) instead of `mapFrameworkToCommandSlug`, and gains a `composeWorkflow` multi-step `workflow` field so a multi-hop `FEEDS_INTO` chain surfaces as `offer_next_step.workflow`, flowing UNCHANGED into `offer-presenter.cjs` / `shape-f1-renderer.cjs`. No new hook; intent classification (`scripts/intent-classifier.cjs` on `UserPromptSubmit`) is NOT re-implemented; the operator-gating (`offer_next_step` quiet under JUST_TALK) and the presenter's consecutive-ignore suppression are preserved; no command suggestion is emitted outside the engine's gated `offer_next_step` pipeline (the Peddler line). Per spec reliability rule 4; Canon Part 4 (deterministic graph+registry, not model recall). Plan 122-04.
- [x] **WORKFLOW-122-07**: Orchestrators wired. `/mos:suggest-next` in a room with a known `ProblemType` returns a resolver-composed COMMAND SEQUENCE (not just a framework list); `/mos:pipeline` gains `--from-problem-type <x>` / `--from-framework <x>` (recommender -> resolver -> run in sequence; Brain-derived command chain); `/mos:act --chain` runs the composed workflow but calls `validateChainAutonomy` first and stops at the first non-`autonomous_safe` (or `command:null`) step with a "needs you here" gate; the `pws-methodology` and `brain-connector` skill prose route framework-to-command through the resolver (no skill names a `/mos:` from memory; `brain-connector` cites the Canon Part 8 boundary). All render via the command's declared `body_shape` per `skills/ui-system/SKILL.md`. Per spec reliability rule 3 + the acceptance criteria; Canon Part 3 (the `--chain` gates are "human confirms" made literal) + Part 7. Plan 122-04.
- [x] **WORKFLOW-122-08**: Degrade, do not fabricate. Framework with no command -> the consumer prints "run [framework] manually -- there is no /mos: for it" (never a made-up command); no Brain -> the registry still gives framework-to-command; no registry -> the resolver degrades to empty and Larry falls back to framework-only advice. `composeWorkflow` returns explicit `command: null, optional: true` markers wherever a framework has no command. Each layer fails to a TRUE statement. Per spec reliability rule 5. Plans 122-03 + 122-04.
- [x] **WORKFLOW-122-09**: Skill + doc cleanup. `lib/core/framework-chain-composer.cjs:FRAMEWORK_TO_COMMAND_SLUG` is pruned to an empty pass-through (export preserved); `lib/hmi/jtbd-taxonomy.json:methodology_hooks` is regenerated from `data/command-registry.json` `framework_index` OR marked informational-only (and the live `value-proposition` -> `validate-proposition` slug mismatch fixed; `tests/test-jtbd-taxonomy.cjs` still passes); `references/methodology/index.md` no longer hand-maintains a command-routing table (regenerated from the registry OR replaced by a pointer to `docs/COMMAND-FRONTMATTER.md` + `docs/WORKFLOWS.md`); the `skills/brain-connector/SKILL.md` "Brain-Powered Command Suggestions" prose ("Brain has Command nodes / `brain_proactive_command` / `FOLLOWS_FRAMEWORK -> Command -> TRIGGERED_BY_SIGNAL`") is DELETED (the live Brain has no `Command` label -- a latent Canon Part 8 breach in prose); `docs/WORKFLOWS.md` (the Brain<->registry<->Larry join + the Canon Part 8 boundary + the 5 reliability rules + the surfaces + the Canon 3/4/7/8/9/10 citations) ships and `docs/THE-BRAIN.md` + `docs/CANON-PHASE-MAP.md` (Part 7, Part 8, and the v1.13.0 milestone table) + `docs/COMMAND-FRONTMATTER.md` point at it. Per spec reliability rule 1 (made total) + the spec's Phase 5; Canon Part 7 + Part 8. Plan 122-05 (with the pws-methodology + brain-connector resolver pointers seeded in 122-04).
- [x] **WORKFLOW-122-10**: Canon Part 8 -- zero Brain mutation. No `Command` node anywhere; `FEEDS_INTO` / `IMPLEMENTED_AS` untouched; `BRAIN-SCHEMA.md` sha unchanged (the strong 27-label/28-rel-type claim is brain-cleanup's concern, not Phase 122's -- per 122-RESEARCH.md the live endpoint reports 84 labels/32 rel types; Phase 122's Brain-impact assertions are: no `Command` label, `FEEDS_INTO` count not decreased, `IMPLEMENTED_AS` untouched, `BRAIN-SCHEMA.md` sha unchanged); `lib/workflow/command-resolver.cjs` has no `require(...brain-client...)`; `scripts/build-command-registry.cjs` has no write-Cypher (`/CREATE |MERGE |SET |DELETE /i`) and queries the Brain only read-only at build time (`--refresh-names`); the `chain-recommender` Cypher carries names + enums only (no `/mos:` literal, no user content); no `/mos:` literal appears within ~80 chars of a `brain`/`query`/`fetch`/`http` token in `lib/workflow/` or `lib/brain/`; `grep -rE "Brain has Command|brain_proactive_command|FOLLOWS_FRAMEWORK.*Command|:Command" skills/ agents/ references/` returns 0. Enforced by the `lib/memory/command-registry.test.cjs` grep guard + the `lib/memory/workflow-layer-e2e.test.cjs` grep sweep. Per the spec's "zero Brain mutation" acceptance criterion; Canon Part 8. All plans (assertion seeded in 122-01, enforced in 122-02 + 122-03 + 122-05).
- [x] **WORKFLOW-122-11**: End-to-end. `lib/memory/workflow-layer-e2e.test.cjs` (registered in `lib/memory/run-feynman-tests.cjs` + `tests/run-all-122.sh`) walks the full chain: `scripts/build-command-registry.cjs --check` exits 0 (frontmatter -> registry consistent) -> `command-resolver.composeWorkflow(["Beautiful Question Framework","Domain Selection","Jobs to Be Done (JTBD)"])` returns a 3-step workflow with `command` filled for all three and each `command` registered in `data/command-registry.json` (the spec's acceptance example) -> `composeWorkflow(["Red Teaming"])` (or any command-less framework) returns `[{step:1, framework:..., command:null, optional:true}]` (degrade, not fabricate) -> `validateChainAutonomy` flags a workflow containing a non-`autonomous_safe` command (e.g. `/mos:hat-briefing`) as `runnable: false` (the `/mos:act --chain` stop-point) -> the Canon Part 8 grep sweep (WORKFLOW-122-10) passes. The CHANGELOG `[Unreleased] -- v1.13.0-beta.10` block is finalized for Phase 122 with the maintainer-gated release steps (tag / `marketplace.json` `source.ref` pin / `npm publish @mindrian/os` with the `@next` dist-tag) flagged as NOT performed in this phase (per CLAUDE.md release process + the feedback_release_lockstep_npm rule); no version bump (already at beta.10); no `git tag`; no `npm publish`. Per the spec's acceptance criteria. Plan 122-05.

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
| DOCTOR-95.1-01 | Phase 95.1 | Complete |
| DOCTOR-95.1-02 | Phase 95.1 | Complete |
| DOCTOR-95.1-03 | Phase 95.1 | Complete |
| DOCTOR-95.1-04 | Phase 95.1 | Complete |
| DOCTOR-95.1-05 | Phase 95.1 | Complete |
| DOCTOR-95.1-06 | Phase 95.1 | Complete |
| DOCTOR-95.1-07 | Phase 95.1 | Complete |
| DOCTOR-95.1-08 | Phase 95.1 | Complete |
| HMI-100-01 | Phase 100 | Pending |
| HMI-100-02 | Phase 100 | Pending |
| HMI-100-03 | Phase 100 | Pending |
| HMI-100-04 | Phase 100 | Pending |
| HMI-100-05 | Phase 100 | Pending |
| HMI-100-06 | Phase 100 | Pending |
| HMI-100-07 | Phase 100 | Pending |
| HMI-101-01 | Phase 101 | Pending |
| HMI-101-02 | Phase 101 | Pending |
| HMI-101-03 | Phase 101 | Pending |
| HMI-101-04 | Phase 101 | Pending |
| HMI-101-05 | Phase 101 | Pending |
| HMI-101-06 | Phase 101 | Pending |
| RENDER-102-01 | Phase 102 | Pending |
| RENDER-102-02 | Phase 102 | Pending |
| RENDER-102-03 | Phase 102 | Pending |
| RENDER-102-04 | Phase 102 | Pending |
| RENDER-102-05 | Phase 102 | Pending |
| RENDER-102-06 | Phase 102 | Pending |
| HMI-103-01 | Phase 103 | Pending |
| HMI-103-02 | Phase 103 | Pending |
| HMI-103-03 | Phase 103 | Pending |
| HMI-103-04 | Phase 103 | Pending |
| HMI-103-05 | Phase 103 | Pending |
| HMI-103-06 | Phase 103 | Pending |
| HMI-105-01 | Phase 105 | Pending |
| HMI-105-02 | Phase 105 | Pending |
| HMI-105-03 | Phase 105 | Pending |
| HMI-105-04 | Phase 105 | Pending |
| HMI-105-05 | Phase 105 | Pending |
| HMI-105-06 | Phase 105 | Pending |
| UISEL-88.2-01 | Phase 88.2 | Pending |
| UISEL-88.2-02 | Phase 88.2 | Pending |
| UISEL-88.2-03 | Phase 88.2 | Complete |
| UISEL-88.2-04 | Phase 88.2 | Complete |
| UISEL-88.2-05 | Phase 88.2 | Complete |
| UISEL-88.2-06 | Phase 88.2 | Pending |
| UISEL-88.2-07 | Phase 88.2 | Complete |
| UISEL-88.2-08 | Phase 88.2 | Complete |
| UISEL-88.2-09 | Phase 88.2 | Complete |
| JTBDCONS-104-01 | Phase 104 | Pending |
| JTBDCONS-104-02 | Phase 104 | Pending |
| JTBDCONS-104-03 | Phase 104 | Pending |
| JTBDCONS-104-04 | Phase 104 | Pending |
| JTBDCONS-104-05 | Phase 104 | Pending |
| STATUS-106-01 | Phase 106 | Complete |
| STATUS-106-02 | Phase 106 | Complete |
| STATUS-106-03 | Phase 106 | Complete |
| STATUS-106-04 | Phase 106 | Complete |
| STATUS-106-05 | Phase 106 | Complete |
| STATUS-106-06 | Phase 106 | Complete |
| RECONCILE-108-01 | Phase 108 | Complete |
| RECONCILE-108-02 | Phase 108 | Complete |
| RECONCILE-108-03 | Phase 108 | Complete |
| RECONCILE-108-04 | Phase 108 | Complete |
| RECONCILE-108-05 | Phase 108 | Complete |
| RECONCILE-108-06 | Phase 108 | Complete |
| NAV-109-01 | Phase 109 | Complete |
| NAV-109-02 | Phase 109 | Complete |
| NAV-109-03 | Phase 109 | Complete |
| NAV-109-04 | Phase 109 | Complete |
| NAV-109-05 | Phase 109 | Complete |
| NAV-109-06 | Phase 109 | Complete |
| NAV-109-07 | Phase 109 | Complete |
| NAV-109-08 | Phase 109 | Complete |
| NAV-109-09 | Phase 109 | Complete |
| DOCTOR-95.2-01 | Phase 95.2 | Complete |
| DOCTOR-95.2-02 | Phase 95.2 | Complete |
| DOCTOR-95.2-03 | Phase 95.2 | Complete |
| DOCTOR-95.2-04 | Phase 95.2 | Complete |
| DOCTOR-95.2-05 | Phase 95.2 | Complete |
| DOCTOR-95.2-06 | Phase 95.2 | Complete |
| DOCTOR-95.2-07 | Phase 95.2 | Pending |
| DOCTOR-95.2-08 | Phase 95.2 | Complete |
| WORKFLOW-122-01 | Phase 122 | Complete |
| WORKFLOW-122-02 | Phase 122 | Complete |
| WORKFLOW-122-03 | Phase 122 | Complete |
| WORKFLOW-122-04 | Phase 122 | Complete |
| WORKFLOW-122-05 | Phase 122 | Complete |
| WORKFLOW-122-06 | Phase 122 | Complete |
| WORKFLOW-122-07 | Phase 122 | Complete |
| WORKFLOW-122-08 | Phase 122 | Complete |
| WORKFLOW-122-09 | Phase 122 | Complete |
| WORKFLOW-122-10 | Phase 122 | Complete |
| WORKFLOW-122-11 | Phase 122 | Complete |
| DOCTOR-95.2-09 | Phase 95.2 | Pending |

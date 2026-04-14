# Phase 82: Wiki Artifact Injection Fix - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning
**Source:** PRD Express Path (.planning/research/wiki-artifact-injection-bloat-analysis.md)
**Trigger:** Lawrence Aronhime bug report 2026-04-13 23:23
**Target release:** v1.10.5

<domain>
## Phase Boundary

This phase delivers a focused fix for a single bug: `scripts/generate-presentation.cjs` `collectSections` function (lines 155-191) never populates an `artifacts` array, so the wiki template (`templates/presentation/wiki.html`) shows empty article panes when users click any section in the sidebar. The bug has been sitting since v1.9.6 (2026-04-11) across 8 subsequent releases. Lawrence Aronhime reported it on 2026-04-13 23:23 after building a workaround on his own machine by injecting artifact content directly into `ROOM_DATA`. Every other beta tester still hits the empty-wiki bug.

The phase populates the `artifacts` array, adds size caps to prevent HTML bloat, leverages v1.10.2 Feynman-MINTO infrastructure for free section-summary upgrades, preserves backwards compatibility for pre-81 rooms, and ships as v1.10.5 direct to stable (not beta). Smart-notebook milestone shifts from v1.10.5 to v1.10.6.

What this phase does NOT deliver:
- MINTO-as-primary section home view (the wiki template has no section-home render path today; building one is 50+ lines of new template JS, deferred to smart-notebook milestone)
- 3-tier loading model (Tier 1 MINTO + Tier 2 summary + Tier 3 lazy-loaded full content; deferred until rooms approach the bloat threshold)
- Compression layer (real fixture math shows compression is unnecessary for current beta cohort)
- Any change to the dashboard, graph, or other generator paths beyond the wiki injection

</domain>

<decisions>
## Implementation Decisions

### Generator data model

- **collectSections must populate `sec.artifacts`.** The wiki template at `templates/presentation/wiki.html` lines 236-243 (index build), 265-267 (sidebar render), 328-355 (article render), 345 (`art.content`), and 355 (`marked.parse`) expects `sec.artifacts` to be an array of objects with at minimum `filename`, `title`, and `content` fields. The template already bundles `marked.js` for client-side markdown parsing - no new library needed.
- **Per-artifact JSON shape.** Each artifact entry is `{filename: string, title: string, content: string, excerpt: string, date: string}`. Filename is the basename, title is extracted from the markdown (first h1 or frontmatter title field), content is the raw markdown the template will pass to `marked.parse`, excerpt is the first ~200 characters for the sidebar preview, date is the file mtime in YYYY-MM-DD format.
- **System file exclusion.** `SKIP_FILES` in `collectSections` (line 58) must be aligned with `SYSTEM_FILES` in `lib/vault/room-scanner.cjs` (lines 22-39) so ROOM.md, STATE.md, MINTO.md, frozen tier-0 baselines (`*-tier0-baseline.md`), files under `.migration-backup/`, files under `_superseded/`, and files under `.mos/` are never injected as wiki artifacts. Source of truth is the room-scanner constant; collect-sections imports or mirrors it.

### Bloat caps

- **Per-artifact size cap: 20 KB.** Over-cap artifacts get truncated content with an explicit truncation banner appended: `\n\n---\n\n**Note:** This article was truncated at 20 KB for file size. Open the source file at <relative-path> to read the full content.`
- **Per-room total injected markdown cap: 2 MB.** Over-cap rooms get a generator warning logged to stderr (`WARN: room exceeded 2 MB injected-markdown cap, X artifacts truncated, Y artifacts dropped`) AND an in-wiki banner rendered at the top of the sidebar so users know some artifacts were truncated for file size. The banner reads: `Some articles were truncated or omitted to keep this snapshot under 5 MB. Open the source files for full content.`
- **Bloat budget rationale.** 5 MB total HTML is the break point (GitHub/Vercel first-paint budget, iOS Safari parse cliff beyond). 2 MB injected markdown leaves 3 MB headroom for template, marked.js, styles, and any tier-1 MINTO content. No current beta tester is anywhere near this. Real fixture artifacts measure 600-800 bytes average. Caps are defensive, not active constraints today.

### Free leverage of v1.10.2 Feynman-MINTO infrastructure

- **New helper `collectSectionMinto(sectionPath)`.** Reads `<sectionDir>/MINTO.md` if present, parses frontmatter, returns the `governing_thought` field (or null if absent or empty).
- **`sec.summary` upgrade.** When `collectSectionMinto` returns a non-null governing thought, use it as the section summary. When it returns null, fall back to the current title-extraction summary from the first artifact's first h1.
- **Backwards compatibility for pre-81 rooms.** Rooms that have not been regenerated to Feynman-MINTO format do not have per-section MINTO.md files. The fallback path produces the same summary they get today. No breaking change.
- **The existing room-level `collectMinto` at line 193 stays unchanged.** That function reads `<roomDir>/MINTO.md` for the dashboard generator path. The new section-level helper is a sibling, not a replacement.

### Test strategy

- **Fixture-based tests against `test-fixtures/feynman/sections/fixture-{small,medium,large}/`.** These fixtures are already populated from Phase 81 work and have known artifact content.
- **Assertions per fixture:** (a) `collectSections` returns an array with the expected number of sections; (b) each section has a non-empty `artifacts` array matching the fixture file count minus SYSTEM_FILES; (c) each artifact has the required JSON shape (filename, title, content, excerpt, date); (d) total injected markdown is under the per-room cap; (e) when a per-section MINTO.md is added to the fixture, the section summary picks up the governing_thought.
- **Cap behavior tests:** synthetic fixture with a 25 KB artifact - assert it gets truncated to 20 KB plus the truncation banner. Synthetic fixture with 250 small artifacts averaging 10 KB each - assert the per-room cap fires, the warning is logged to stderr, and the in-wiki banner is rendered.
- **SYSTEM_FILES exclusion test:** fixture with one ROOM.md, one STATE.md, one MINTO.md, one regular artifact - assert only the regular artifact appears in `sec.artifacts`.
- **Test runner:** add a new test file `scripts/generate-presentation.test.cjs` and register it with whatever central test runner already exists for presentation-related tests. If none exists, add it to the smoke test suite.

### Release as v1.10.5

- **Direct to stable, not beta.** This is a user-facing bug fix, not release infrastructure. Beta gating is reserved for release-pipeline changes per `.claude/includes/release-process.md`.
- **5-gate release.** CHANGELOG [1.10.5] entry + `.claude-plugin/plugin.json` version bump to 1.10.5 + `package.json` version bump to 1.10.5 + git tag `v1.10.5` + `~/mindrian-marketplace/.claude-plugin/marketplace.json` source.ref pinned to v1.10.5.
- **Smart-notebook milestone shifts from v1.10.5 to v1.10.6.** Update `.planning/PROJECT.md` Notion Template Gap Close section to reflect the slot move. Fourth shift in this session (v1.10.3 -> v1.10.4 -> v1.10.5 -> v1.10.6). Pattern noted but not blocking.
- **CHANGELOG entry must credit Lawrence Aronhime by name** with the 2026-04-13 23:23 report timestamp, and must explicitly note that the fix leverages v1.10.2 Feynman-MINTO infrastructure for free summary upgrades.

### Claude's Discretion

- **Title extraction strategy.** The current `collectSections` extracts a title from the first artifact for the section summary. The new artifacts array needs a per-artifact title. Reasonable strategy: prefer frontmatter `title:` field if present, fall back to first h1, fall back to filename without extension. Pick one and document in the helper.
- **Excerpt extraction strategy.** First ~200 characters of the markdown body, stripped of frontmatter and the first h1 line, stripped of leading whitespace. Truncate at the nearest word boundary if possible. Append "..." if truncated.
- **Date extraction strategy.** Prefer frontmatter `date:` field if present, fall back to file mtime via `fs.statSync(path).mtimeMs`. Format as YYYY-MM-DD.
- **Truncation point for the 20 KB cap.** Cut at byte 20480 (exactly 20 KB), then back up to the nearest paragraph break to avoid mid-sentence cuts. Append the truncation banner.
- **Order of artifacts within a section.** By date descending (newest first), with files lacking a date sorted to the bottom by filename ascending. Documented in the helper.
- **Warning verbosity.** The 2 MB cap warning to stderr should include section name, original artifact count, truncated count, dropped count, total bytes attempted, and total bytes after cap. One-line format for log scrapability.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Bug location
- `scripts/generate-presentation.cjs` lines 155-191 - the `collectSections` function being modified
- `scripts/generate-presentation.cjs` line 58 - the `SKIP_FILES` constant being aligned with SYSTEM_FILES
- `scripts/generate-presentation.cjs` line 193 - the existing `collectMinto` function that stays unchanged (reads room-level MINTO.md, not section-level)

### Template contract (the consumer of the data model)
- `templates/presentation/wiki.html` lines 236-243 - index build that walks `sec.artifacts`
- `templates/presentation/wiki.html` lines 265-267 - sidebar render that iterates each artifact
- `templates/presentation/wiki.html` lines 328-355 - article render that uses `art.content` (line 345) and passes to `marked.parse` (line 355)

### SYSTEM_FILES source of truth
- `lib/vault/room-scanner.cjs` lines 22-39 - the canonical exclusion set that `SKIP_FILES` must mirror

### Feynman-MINTO infrastructure (free leverage)
- `.planning/phases/81-feynman-minto-hybrid/81-CONTEXT.md` REVISION 2 section - the Feynman-MINTO architecture shipped in v1.10.2
- `scripts/vault-section-minto-generator.cjs` - the generator that produces per-section `MINTO.md` files with `governing_thought` frontmatter

### Test fixtures
- `test-fixtures/feynman/sections/fixture-small/` - small fixture room
- `test-fixtures/feynman/sections/fixture-medium/` - medium fixture room
- `test-fixtures/feynman/sections/fixture-large/` - large fixture room
- `test-fixtures/feynman/expected-tier0-baseline/fixture-small-tier0.md` (3657 bytes), `fixture-medium-tier0.md` (3794 bytes), `fixture-large-tier0.md` (5509 bytes) - real measured MINTO sizes that drove the bloat math

### Research authority
- `.planning/research/wiki-artifact-injection-bloat-analysis.md` - 798 lines, all 8 research questions answered, includes CHANGELOG [1.10.5] draft in section 9, includes top 3 risks, includes shippability verdict (3 hours 40 minutes, 5 phases, ships as v1.10.5)

### Release process
- `.claude/includes/release-process.md` - the 5-gate version consistency rule (CHANGELOG + plugin.json + package.json + git tag + marketplace.json source.ref)

### Repo-wide rules
- `CLAUDE.md` Decisions 1, 8, 15, 16 - one-command install, tier 0 fully functional, ROOM.md everywhere, nested artifact folders
- `CLAUDE.md` no em-dashes hard rule - applies to all CHANGELOG prose, code comments, test fixtures
- `skills/ui-system/SKILL.md` - no emoji rule with statusline carve-out (does not apply here, this is generator output)

</canonical_refs>

<specifics>
## Specific Ideas

### Phase plan decomposition (5 plans expected per the research)

The research recommends 5 plans matching the v1.10.5 ship checklist. Each plan is small and atomic:

- **82-01 Wire artifacts + per-artifact cap + SKIP_FILES alignment.** Modify `collectSections` to populate `sec.artifacts`. Add the per-artifact 20 KB cap with truncation banner. Align `SKIP_FILES` with `lib/vault/room-scanner.cjs` SYSTEM_FILES (import or mirror). Phase budget: ~45 minutes.

- **82-02 Per-room cap + warning + in-wiki banner.** Add the 2 MB total injected markdown cap to `collectSections`. Log the warning to stderr in the documented format. Add a new field to the section data model (e.g., `sec.bloatBanner` or top-level `roomData.bloatBanner`) that the wiki template can render at the top of the sidebar when the cap fires. Phase budget: ~30 minutes.

- **82-03 collectSectionMinto helper + summary upgrade.** New helper function that reads `<sectionDir>/MINTO.md`, parses frontmatter, returns `governing_thought` or null. Wire it into `collectSections` so `sec.summary` upgrades when present. Preserve fallback to current title-extraction summary. Phase budget: ~30 minutes.

- **82-04 Fixture-based tests.** New test file `scripts/generate-presentation.test.cjs` with assertions for: artifacts shape, per-artifact cap behavior, per-room cap behavior, SYSTEM_FILES exclusion, summary upgrade with MINTO present, summary fallback with MINTO absent. Run via existing test runner. Phase budget: ~60 minutes.

- **82-05 CHANGELOG + version bump + 5-gate release.** Write CHANGELOG [1.10.5] entry crediting Lawrence by name and noting v1.10.2 Feynman-MINTO leverage. Bump plugin.json and package.json to 1.10.5. Commit, tag v1.10.5, push origin main with tags. Update `~/mindrian-marketplace/.claude-plugin/marketplace.json` source.ref to v1.10.5, commit, push. Update `.planning/PROJECT.md` to shift smart-notebook milestone from v1.10.5 to v1.10.6. Phase budget: ~35 minutes.

**Total: 3 hours 40 minutes** matching the research estimate. Pattern matches v1.10.3 and v1.10.4 (single-day tactical patches).

### Hard constraints

- **CJS only**, no ESM, no TypeScript, no new runtime dependencies. The repo is pure CommonJS Node.js.
- **No em-dashes anywhere.** Use hyphens. Hard repo rule. Grep before commit.
- **Tests use node built-in assert.** No jest, vitest, mocha, or other test framework dependencies.
- **AAAK library and Feynman engine skill are not modified.** Phase 82 only touches the presentation generator and adds tests.
- **Pre-81 deterministic MINTO generator code path is not modified.** Phase 82 reads MINTO.md frontmatter only when present, never writes or modifies it.
- **No emoji in any generator output, code, or CHANGELOG entry.** The statusline emoji carve-out from v1.10.4 does not apply here.
- **5-gate release pipeline mandatory.** Skipping any gate is a release-process violation per `.claude/includes/release-process.md`.

### Tri-polar surface check

- **CLI**: scripts/generate-presentation.cjs is invoked by `/mos:export hub`, `/mos:snapshot`, and other presentation commands. Fix lands here directly.
- **Desktop**: Larry runs `/mos:export hub` via slash command, same path. Fix is automatic on update.
- **Cowork**: shared room state, same generator. Fix is automatic on update. No cross-user state changes.

</specifics>

<deferred>
## Deferred Ideas

### Deferred to v1.10.6 smart-notebook milestone

- **MINTO-as-primary section home view.** The wiki template has no section-home render path today. Building one is 50+ lines of new template JavaScript plus new JSON fields plus new routing. Defer until smart-notebook ships and the template grows a section-home view as part of the broader scaffold work.
- **3-tier loading model.** Tier 1 (MINTO eager) + Tier 2 (artifact summaries eager) + Tier 3 (full artifact content lazy-loaded via embedded JS or compressed blob). Not needed yet because real fixture math shows the naive-with-caps approach handles 700+ artifacts comfortably under the 2 MB room cap. Revisit when the first beta tester hits the cap.

### Deferred indefinitely

- **Compression layer (LZ-string, CompressionStream, brotli).** Real artifact sizes do not justify compression overhead. Adding compression also adds a client-side decompression library to the HTML, which costs more than it saves at current scale.
- **Companion file model.** `index.html + articles/*.json` would break the single-file shareable promise. Not aligned with the SnapshotHub design intent.
- **External fetch on render.** Breaks offline use, breaks file:// protocol, requires a live server. Not aligned with Decision 8 (tier 0 fully functional, no dependencies).

### Deferred to a future Brain enrichment wave (tracked in PROJECT.md)

- **Wikilink graceful handling for SYSTEM_FILES targets.** A wikilink in artifact text that points to an excluded file (ROOM.md, STATE.md, MINTO.md) currently renders as a muted dead span. Pre-existing issue, not new with this fix, but worth tracking. Could be fixed by post-processing the rendered markdown to either link to the source file URL or strip the wikilink syntax.

</deferred>

---

*Phase: 82-wiki-artifact-injection-fix*
*Context gathered: 2026-04-14 via PRD Express Path*
*PRD source: .planning/research/wiki-artifact-injection-bloat-analysis.md*
*Trigger: Lawrence Aronhime bug report 2026-04-13 23:23*

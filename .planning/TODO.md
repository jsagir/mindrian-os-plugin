---
created: 2026-04-14
status: active
owner: jsagi
purpose: Short-horizon queued work that is ready to execute but not yet started. Items here are pre-scoped, pre-researched, and waiting on user go. When an item ships, move it to CHANGELOG and delete from this file. When an item is killed, move it to `.planning/TODO-ARCHIVE.md` with a one-line reason.
---

# TODO Queue

## NEXT UP

### [NEXT] v1.10.5 - Wiki artifact injection fix (Lawrence bug)

**Trigger.** Lawrence Aronhime reported on 2026-04-13 23:23 that `scripts/generate-presentation.cjs` `collectSections` function never populates an `artifacts` array. The wiki template (`templates/presentation/wiki.html`) expects `sec.artifacts` to be an array of `{filename, title, content}` objects but the generator only emits `{id, label, color, entryCount, summary}`. Every wiki sidebar click shows an empty article pane. Lawrence workarounded on his own machine by injecting content directly into `ROOM_DATA`. Every other beta tester still hits the empty-wiki bug. The bug has been sitting since v1.9.6 (4/11). Eight subsequent releases never touched the file.

**Research.** Complete and parked at `.planning/research/wiki-artifact-injection-bloat-analysis.md` (798 lines, zero em-dashes, all 8 research questions answered). Key findings:

1. **The MINTO-as-primary hunch is partially wrong.** Real MINTO.md files measure 3.6-5.5 KB per section, not the 1.5 KB I was guessing, AND the wiki template has no section-home render path today. Teaching it one is 50+ lines of new template JS. Defer MINTO-as-primary to a later release (probably the smart-notebook milestone).
2. **The math does not require compression.** Fixture artifacts average 600-800 bytes. A 2 MB cap comfortably holds 700+ mature artifacts. No current beta tester is close. Naive inline fix just works with sensible caps.
3. **Free leverage of v1.10.2 Feynman-MINTO:** when a section has a `MINTO.md` file, upgrade `sec.summary` to read its `governing_thought` frontmatter field as a more meaningful one-liner than the current title extraction. Pre-81 rooms still work via fallback.

**Bloat budget.** 5 MB total HTML = break point (GitHub/Vercel first-paint, iOS Safari parse cliff). 2 MB injected markdown = generator hard cap (leaves 3 MB for template + marked.js + styles). 20 KB per artifact = per-file cap (truncate + banner).

**The fix.** Exact changes to `scripts/generate-presentation.cjs`:

- **Lines 155-191 (`collectSections`):** populate `artifacts: [{filename, title, content, excerpt, date}]` inside the existing loop
- **Line 58 (`SKIP_FILES`):** align with `lib/vault/room-scanner.cjs` `SYSTEM_FILES` constant so ROOM.md, STATE.md, MINTO.md, baselines, migration-backups, _superseded/, .mos/ are excluded
- **Line 193 (`collectMinto`):** stays room-level for dashboard path. NEW helper `collectSectionMinto(sectionPath)` for per-section summary upgrade.
- **Per-artifact size cap:** 20 KB. Over cap: truncate and append "... content truncated, open source file for rest."
- **Per-room total cap:** 2 MB injected markdown. Over cap: hard stop with warning logged + in-wiki banner "Some articles truncated for file size."
- **`sec.summary` upgrade:** if `<sectionDir>/MINTO.md` exists, read its `governing_thought` frontmatter. Fallback to current title extraction.

**Template contract (verified in research).** The wiki template at `templates/presentation/wiki.html` already expects this shape:
```
{
  "artifacts": [
    { "filename": "...", "title": "...", "content": "<raw markdown>" }
  ]
}
```
Key template lines: 236-243 (index build), 265-267 (sidebar), 328-355 (article render), 345 (`art.content`), 355 (`marked.parse`). Template already bundles `marked.js`. No new library needed. Nothing to escape.

**Phases (3h40m total).**

- **A (45 min)** - wire the artifacts array, add per-artifact 20 KB cap, add SYSTEM_FILES exclusion alignment
- **B (30 min)** - add per-room 2 MB cap with warning + in-wiki banner
- **C (30 min)** - per-section MINTO `governing_thought` upgrade for `sec.summary`
- **D (60 min)** - fixture-based tests against `test-fixtures/feynman/sections/fixture-{small,medium,large}/` asserting artifacts populated, shape matches template contract, cap triggers, summary upgrade works when MINTO present
- **E (35 min)** - CHANGELOG entry, version bump, 5-gate release (CHANGELOG + plugin.json + package.json + git tag v1.10.5 + marketplace.json source.ref), marketplace push

**Top 3 risks.**

1. Silent truncation at 2 MB cap. Mitigation: warning log + in-wiki banner.
2. Wikilinks to SYSTEM_FILES render as muted dead spans. Pre-existing issue, not new with this fix.
3. Large meeting transcripts outside `meetings/` could push a section over the room cap. Mitigation: per-artifact 20 KB cap catches this first.

**Ships as v1.10.5 direct to stable (not beta).** Feature bug fix, not release infrastructure. Same tactical same-day pattern as v1.10.3 and v1.10.4. Smart-notebook milestone shifts v1.10.5 -> v1.10.6.

**CHANGELOG [1.10.5] draft text is in the research doc section 9.** Credits Lawrence by name, references the 2026-04-13 23:23 report, explicitly notes the fix leverages v1.10.2 Feynman-MINTO infrastructure for summary upgrades.

**Authority to execute.** Waiting on user go. Say "ship v1.10.5" and execute all 5 phases + release pipeline + marketplace update.

---

## QUEUED (behind NEXT)

### Beta-tester announcement email

Currently sitting as two Gmail drafts. Both go to the same 10-person BCC list of Brain API key holders including Dror Barak (dror@align-gp.com).

- **Draft 1 (OLD, delete manually):** `MindrianOS v1.9.6 → v1.10.4: eight releases, explained in plain English` - editorial product-release tone. Draft ID `r-411751932222959846`. Delete in Gmail drafts pane.
- **Draft 2 (CURRENT, Feynman voice):** `Larry remembers now. And seven other things that changed in MindrianOS.` - plain-English Feynman-style walkthrough of every release v1.9.6 through v1.10.4, with v1.10.1-never-shipped explained honestly, v1.10.2 highlighted as the architectural release with Jonathan's reframe quote verbatim. Draft ID `r-8269278748347017631`. URL: https://mail.google.com/mail/u/0/#drafts?compose=19d895971cb50c50

**Decision pending:** send as-is now, OR hold until v1.10.5 ships and add a v1.10.5 section crediting Lawrence so beta testers get one consolidated announcement. User's earlier lean was (a) = hold and consolidate. Confirm on ship.

### Smart-notebook-as-cofounder milestone (now v1.10.6)

Research complete across two passes:
- `.planning/research/smart-notebook-cofounder.md` (978 lines, pass 1 - taxonomy, coverage matrix, default scaffold, synthesis layer)
- `.planning/research/smart-notebook-cofounder-appendix.md` (821 lines, pass 2 - v1.10.5 scope cut [now v1.10.6], framework x section matrix, Brain coverage from live Neo4j queries, PWS curriculum cross-reference, MINTO+Feynman+memory wiring)

**Path 1 cut locked:** ships 3 new Tier 0 sections only - `stakeholder-analysis/`, `decisions/`, `assumptions/`. `KNOWN_SECTIONS` expands from 11 to 14. No collection layer, no trigger framework, no synthesis voice (stub only). 2 phases, ~2 weeks. SQLite schema reservations for `scaffold_log`, `voice_log`, `decisions`, `held_contradictions`, `assumptions`. Mullins 7-domain framework confirmed in Brain and is the scaffold authority.

**Mullins 7-domain finding:** Lawrence + Jonathan's "PWS Value Proposition Model" is both a Framework node and a Book node in the Brain. DataRoomSection label already has 13 entries in Neo4j - a superset of the current 11 KNOWN_SECTIONS. Brain already anticipated scaffold expansion before the plugin caught up.

**Top 3 Brain enrichment gaps (for a later Brain wave, not v1.10.6):** stakeholder-analysis-as-method, trust graphs, pricing + unit economics + TAM/SAM/SOM + runway + fundraising playbooks. PWS curriculum and Brain have the same gaps - a consistency signal that the missing areas are genuinely missing from Mindrian's teaching corpus.

**Waiting on user:** synthesis memo at `.planning/phases/_backlog/v1.10.6-smart-notebook.md` distilling both research files into a plan-phase-ready CONTEXT document (~150 lines, handoff-ready for `/gsd:new-milestone v1.10.6` or `/gsd:add-phase`). When user says "write the memo," generate it from both research files.

---

## DECISIONS RESOLVED THIS SESSION (archive when cleaning up)

- v1.10.3 statusline upgrade (LARRY marker + section breadcrumb + exploration label + active phase) - SHIPPED 2026-04-14
- v1.10.4 statusline redesign (room name + MindrianOS brand + version + Brain status + thematic emojis + ui-system carve-out) - SHIPPED 2026-04-14
- v1.10.2 Feynman-MINTO Hybrid (slash-command orchestrator, no API key, per-section MINTO compression) - SHIPPED 2026-04-14
- v1.10.0 Obsidian vault import + workspace guard + release pipeline mandate - SHIPPED 2026-04-13
- v3.0 MCP Sampling migration captured as first-class scope item in PROJECT.md v3.0 Backlog
- Notion template gap close parked in PROJECT.md (6 items, priority trio: per-section STATEMENT, Latest Deck slot, Funding Options section)
- ui-system skill no-emoji rule gains carve-out: statusline surface only, every other surface still forbids emojis
- Dev workspace vs plugin cache path separation confirmed (marketplace cache is the canonical install, legacy `~/.claude/plugins/mindrian-os/` is inert)

---

## NOTES FOR THE NEXT CLAUDE SESSION

- Working directory is `/home/jsagi/MindrianOS-Plugin/`. Never work from `~/.claude/plugins/*`. The workspace guard in `scripts/session-start` enforces this but the habit has to be in the session too.
- `.planning/` is gitignored but tracked files in it commit normally via `git commit <path>` or `git add -Af`. Do not use `git add -A` broadly.
- v1.11.0 slot is RESERVED for release pipeline hardening (see `docs/NEXT-RELEASE-v1.11.0-beta.1.md`). Do not ship feature work as v1.11.0.
- The user prefers aggressive same-day patch releases (pattern set by v1.10.3 and v1.10.4). When in doubt, ship small and fast rather than bundle.
- Every commit in this session was signed by `Claude Opus 4.6 (1M context)`. Maintain the pattern unless the user asks otherwise.
- The user is the author of the no-emoji rule in `skills/ui-system/SKILL.md`. Exception is statusline only. Do not add emojis to any other surface without explicit instruction.
- Lawrence Aronhime is the oldest admin API key holder (2026-03-26). Treat his bug reports as canaries.

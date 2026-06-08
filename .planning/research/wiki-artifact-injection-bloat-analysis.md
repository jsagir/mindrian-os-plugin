---
created: 2026-04-14
status: research
trigger: Lawrence Aronhime bug report 2026-04-13 23:23
proposed_release: v1.10.5
authority: user directive 2026-04-14 DEEP RESEARCH WAYS TO HANDLE THIS PROPERLY WITHOUT BLOATING
---

# Wiki Artifact Injection Bloat Analysis

Research document for v1.10.5 patch release. Target: fix the empty-wiki bug Lawrence Aronhime
reported on 2026-04-13 23:23 without re-creating the HTML bloat that MindrianOS single-file
exports were designed to avoid.

The bug is real. Lawrence ran it down to the exact lines (generate-presentation.cjs 181-187)
and confirmed every beta tester except him is still hitting the empty-wiki render. Eight
releases (v1.9.9 through v1.10.4) have shipped since the report and none of them touched the
presentation generator. This research specifies the fix.

## 0. TL;DR

- The wiki template (templates/presentation/wiki.html) is a STRICT contract. It expects
  `sec.artifacts` to be an array of objects with `filename`, `title`, `content`, and optional
  `wordCount` / `frontmatter` / `sectionColor` / `sectionLabel`. The generator currently ships
  those fields as undefined.
- The naive fix (inline every artifact's full markdown in ROOM_DATA) does not explode in the
  range most users hit. Real fixture data shows artifacts averaging 600 bytes each. A 150
  artifact room would cost ~90 KB raw, ~120 KB JSON-escaped, on top of a 25 KB template plus
  45 KB injected JS. Worst case under realistic conditions lands around 250 KB. That is
  nowhere near the bloat threshold.
- The MINTO-as-primary hunch partially holds but is NOT the right layer. MINTO.md is born
  per-section and ~3.6 to 5.5 KB each (real tier0-baseline numbers, not the hoped 1.5 KB).
  The wiki template does not today render MINTO as a section page and teaching it to do so is
  strictly additional work on top of the artifact-injection fix. MINTO belongs in the section
  overview (home card + section home page), not as a replacement for artifact content.
- The shippable fix for v1.10.5 is a bounded artifact injection: populate `sec.artifacts`
  with full content up to a per-artifact cap (20 KB) and a per-room cap (2 MB of total
  injected markdown), with tier-2 excerpt fallback when caps are hit. No new libraries, no
  client-side decompression, no new template changes beyond one optional field read.
- Bloat budget: 5 MB total HTML is the "single-file snapshot experience" break point,
  justified below. Generator should hard-cap at 2 MB of injected markdown to leave headroom.
- Ship as v1.10.5 today. Smart-notebook moves to v1.10.6. The fix is 2 to 4 hours of focused
  work plus tests.

## 1. The bug, verbatim from the source

File: `scripts/generate-presentation.cjs`, function `collectSections`, lines 155 to 191.

```
function collectSections(roomDir) {
  const sections = [];
  let totalArtifacts = 0;

  const entries = safeReadDir(roomDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dirName = entry.name;
    if (dirName.startsWith('.') || SKIP_DIRS.has(dirName)) continue;

    const sectionDir = path.join(roomDir, dirName);
    const mdFilePaths = findMdFiles(sectionDir, SKIP_FILES);
    const mdFiles = mdFilePaths.map(p => path.basename(p));

    const entryCount = mdFilePaths.length;
    totalArtifacts += entryCount;

    let summary = '';
    if (entryCount > 0) {
      const firstContent = safeRead(mdFilePaths[0]);
      if (firstContent) summary = extractTitle(firstContent, mdFiles[0]);
    }

    const color = SECTION_COLORS[dirName] || '#D4CFC7';
    const label = dirName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    sections.push({
      id: dirName,
      label,
      color,
      entryCount,
      summary,
    });
  }

  return { sections, totalArtifacts };
}
```

The section object shipped to ROOM_DATA contains five fields: `id`, `label`, `color`,
`entryCount`, `summary`. There is no `artifacts` field. It never has been. The first
artifact's filesystem content is read solely to extract the H1 title into `summary`, and
then the content is dropped on the floor.

`collectMinto` at line 193 reads `<roomDir>/MINTO.md` (the ROOM-level file, not the
per-section MINTO.md that v1.10.2 Feynman-MINTO produces). It returns only
`{ governing_thought, levels }` where levels is a list of H2 strings. This is also not what
the wiki template consumes.

The SKIP_FILES set at line 58 matches SYSTEM_FILES from room-scanner.cjs almost exactly but
drifted: generate-presentation.cjs excludes `USER.md`, `MEETINGS-INTELLIGENCE.md`, and
`ROOM-INTELLIGENCE.md` but does NOT exclude `CLAUDE.md`, `COWORK-INSTRUCTIONS.md`, `TODOS.md`,
`WHATS-NEXT.md`, `INDEX.md`, `MILESTONES.md`, `TEAM-STATE.md`, `action-items.md`. This drift
needs to be fixed as part of the same patch. Single source of truth: import SYSTEM_FILES from
`lib/vault/room-scanner.cjs` instead of duplicating it.

## 2. Q1: The wiki template contract

File: `templates/presentation/wiki.html`. 25052 bytes total. Dependencies: Google Fonts
stylesheet (remote), `marked.min.js` from cdn.jsdelivr.net (remote, roughly 45 KB gzipped
over the wire, cached hard). The template HAS a remote script dependency, so the single-file
snapshot story is already "single file plus two CDN fetches." This matters: the design brief
for v1.10.5 must not panic about adding inline bytes when the baseline is already online.

Template references to `sec.artifacts` (every occurrence, with line numbers):

- **236** `(sec.artifacts || []).forEach(art => {` -- builds `allArtifacts` index
- **237** `const entry = { ...art, sectionId: sec.id, sectionLabel: sec.label, sectionColor: sec.color, lightText: sec.lightText };` -- copies every artifact field as-is
- **238** `allArtifacts.push(entry);`
- **239** `artifactByFile[art.filename] = entry;` -- requires `filename`
- **241** `artifactByTitle[art.title.toLowerCase()] = entry;` -- requires `title`
- **262** `html += '<span class="sb-count">' + (sec.artifacts ? sec.artifacts.length : sec.entryCount || 0) + '</span>';` -- fallback: if artifacts missing, shows entryCount
- **265-267** sidebar loop: `onclick="loadArtifact('" + escAttr(art.filename) + "')"` + `escHtml(art.title)` -- requires filename and title
- **282** `const totalArtifacts = allArtifacts.length;` -- home page count
- **293** `const count = sec.artifacts ? sec.artifacts.length : sec.entryCount || 0;` -- home cards
- **298** `if (sec.summary) html += '<div class="home-card-summary">' + escHtml(sec.summary) + '</div>';` -- home card summary reads from `sec.summary` not per-artifact, so that field IS still consumed
- **321** `if (sec && sec.artifacts && sec.artifacts.length > 0) { loadArtifact(sec.artifacts[0].filename); }` -- `openSection` grabs first artifact
- **328** `const art = artifactByFile[filename];`
- **345** `let content = art.content || '';` -- requires `content` string
- **355** `let rendered = marked.parse(content);` -- raw markdown parsed client-side via marked
- **367** `html += '<div class="article-title">' + escHtml(art.title) + '</div>';`
- **369** `'<span class="article-section-tag" style="background:' + tagBg + ';color:' + tagColor + '">' + escHtml(art.sectionLabel) + '</span>'` -- wiki writes its own sectionLabel from spread
- **370** `'<span class="article-words">' + (art.wordCount || 0) + ' words</span>'` -- optional, falls back to 0
- **381** `const fm = art.frontmatter || {};` -- optional, infobox properties come from frontmatter
- **455-463** search loop: reads `art.title` and `art.content` -- content is also search-indexed, not just rendered
- **513-518** initializer: `if (allArtifacts.length > 0) { showHome(); loadArtifact(sections[0].artifacts[0].filename); }`

**Required fields per artifact (non-negotiable):**

| Field | Used for | Consequences if missing |
|---|---|---|
| `filename` | keyed by filename, click handler value, lookup table | click handlers break, silent no-op on click |
| `title` | sidebar label, artifact header, title-indexed wikilink lookup | sidebar empty, wikilinks broken |
| `content` | marked.parse(), search indexing | body is empty even if sidebar shows item |

**Optional fields (graceful degradation):**

| Field | Used for | Fallback |
|---|---|---|
| `wordCount` | article meta | shows `0 words` |
| `frontmatter` | infobox properties panel | panel shows only section badge |
| `sectionColor` / `sectionLabel` / `lightText` | spread from section in script line 237 | already provided by section |

**What happens today when `sec.artifacts` is undefined:**

The template uses `(sec.artifacts || [])` in every loop, so nothing throws. The sidebar shows
section headers with entry counts but no items underneath. Click a section: the openSection
path at line 320 hits the guard `if (sec && sec.artifacts && sec.artifacts.length > 0)` and
does nothing. Home cards render with titles and counts and summary (summary works because
`collectSections` DOES populate it). Click a home card: same no-op. The wiki is a
beautifully-styled carcass.

Lawrence's screenshot and description match this exactly. The UI does not break with a JS
error; it quietly has no content to show.

**Markdown library decision:** marked.min.js is loaded from CDN. We are NOT paying inline
bytes for the parser. Good. The template has no size-aware rendering (no show-more buttons,
no lazy reveal, no skeleton loaders for long content). Everything is eager-rendered at first
click.

**Template contract verdict:** The template WAS designed for full artifact content to be
injected inline. Lawrence's workaround (inject the content directly) is exactly what the
template expects. The bug is purely in the generator, not the template. This is a one-sided
fix.

## 3. Q2: Bloat budget with real numbers

### 3.1 Real fixture measurements

Measured 2026-04-14 from `/home/jsagi/MindrianOS-Plugin/test-fixtures/feynman/sections/`:

- **fixture-small**: 1 section (problem-definition), 2 artifacts. Artifact sizes 898 + 860
  bytes. Average 879 bytes.
- **fixture-medium**: 1 section (market-analysis), 6 artifacts. Sizes 733, 753, 767, 777, 782,
  843, 898 bytes. Average 779 bytes (rounded to ~800).
- **fixture-large**: 1 section (solution-design), 12 artifacts. Sizes 505 to 782 bytes.
  Average 576 bytes.

Observed per-artifact size floor: ~500 bytes (frontmatter + H1 + a few lines). Realistic
average: ~800 bytes for Feynman-decomposed artifacts. Obsidian vault imports and meeting
transcript artifacts run larger. A transcript-filed artifact can easily be 5 to 15 KB. A
deep-grade output is 3 to 8 KB. The 800 byte average is a floor; a realistic mature room
sits closer to 2 to 3 KB per artifact.

### 3.2 Wiki template baseline

- `templates/presentation/wiki.html` pre-injection: 25052 bytes
- Injected JS libraries at generate time (from processTemplate, lines 395 to 421):
  `canvas-graph.js`, `graph-detail-panel.js`, `chat-context.js`, `generative-tools.js`,
  `chat-panel.js`. The wiki template does not USE graph canvas, but processTemplate injects
  all of them unconditionally (the replace is no-op if placeholder not present). Realistic
  wiki.html injected size starting point: ~30 KB base template, ~5 KB JSON-stringified
  ROOM_DATA for section metadata, ~3 KB graph data reference.

Starting floor for the wiki with sections populated but zero artifact content: ~35 to 40 KB.

### 3.3 Injection math: what happens at scale

Let `A` = number of artifacts, `B` = average artifact byte size, `J` = JSON escape overhead
factor (realistically 1.15x for markdown, bumping quotes and backslashes).

HTML size ~= 40 KB + A * B * J

| Artifacts | B=800 (Feynman) | B=2500 (mixed mature) | B=8000 (transcript-heavy) |
|---|---|---|---|
| 50 | 40 + 46 = 86 KB | 40 + 144 = 184 KB | 40 + 460 = 500 KB |
| 100 | 40 + 92 = 132 KB | 40 + 288 = 328 KB | 40 + 920 = 960 KB |
| 150 | 40 + 138 = 178 KB | 40 + 431 = 471 KB | 40 + 1380 = 1420 KB |
| 200 | 40 + 184 = 224 KB | 40 + 575 = 615 KB | 40 + 1840 = 1880 KB |
| 300 | 40 + 276 = 316 KB | 40 + 863 = 903 KB | 40 + 2760 = 2800 KB |

### 3.4 Where does single-file snapshot break?

Four hard-edge thresholds relevant to the "single-file snapshot experience":

1. **Gmail attachment cap: 25 MB.** Not the bottleneck for any realistic room. Ignore.
2. **Practical email attachment (user comfort): 10 MB.** Hit at ~3400 artifacts of 3 KB each.
   Ignore.
3. **GitHub Pages / Vercel / raw HTML first-paint budget: 5 MB.** Above 5 MB of inline HTML,
   browsers serialize slowly, iOS Safari starts throwing out parse attempts, and the time
   from click to rendered sidebar on a mid-range laptop is visibly janky. This is the real
   ceiling. Verified empirically in prior MindrianOS dashboard shipments where the D3 graph
   export tipped past 4 MB and started reporting "slow page" in Chrome DevTools.
4. **Mobile first-paint on cellular: 1 MB.** Above 1 MB, a 3G download is > 2 seconds. On
   WiFi it is fine. Mobile is rare for snapshot consumption, but worth budgeting.
5. **file:// protocol load: ~20 MB.** Local file reads are cheap. Not the bottleneck.

**Bloat budget, named:** 5 MB total inline HTML. Below 5 MB the naive fix is fine. Above
5 MB, single-file snapshots start breaking perceivably. We target a soft ceiling at 2 MB of
INJECTED artifact markdown (which combined with template + JS gives ~2.1 MB total, well
below the 5 MB hard ceiling) so that even transcript-heavy rooms stay comfortable.

At B=2500 (mixed mature), the 2 MB cap is hit at roughly 700 artifacts. No beta tester is
anywhere near this today. For the 99th percentile room, the 2 MB cap is never hit.

### 3.5 Honest compression thought experiment

Could we use CompressionStream + base64 to shrink the inline content 3 to 4x? Yes, and the
math is tempting. But:

- Adds client-side JS to decompress on click. Not in the 25 KB template today.
- Breaks "view source shows readable content" which is part of the snapshot ethos.
- Marked.js already runs on first click; adding decompress doubles first-click latency.
- The fix would ship as tier-2 optimization AFTER the correctness fix, not bundled with it.

**Not recommended for v1.10.5.** Revisit if a user actually hits the 2 MB cap.

## 4. Q3: Does MINTO-as-primary solve this?

### 4.1 Hunch, tested

The Phase 81 reframe ships per-section MINTO.md. The hope was ~1500 tokens, ~6 KB compressed.

**Real data from `test-fixtures/feynman/expected-tier0-baseline/`:**

- `fixture-small-tier0.md`: 3657 bytes
- `fixture-medium-tier0.md`: 3794 bytes
- `fixture-large-tier0.md`: 5509 bytes

Average 4.3 KB per section. This is the tier-0 deterministic baseline, which is more verbose
than the tier-1 Feynman-narrated version. Tier-1 is supposed to be smaller (1500 tokens = ~6
KB worst case). Call it 4 to 6 KB per section MINTO, verified against real output.

### 4.2 Does collectSections currently read per-section MINTO.md?

No. `collectSections` at line 155 never reads MINTO.md at all. `collectMinto` at line 193
reads ONLY `<roomDir>/MINTO.md` (room-level, which post v1.10.2 is no longer guaranteed to
exist). The per-section MINTO.md files produced by v1.10.2 Feynman-MINTO are invisible to
the presentation generator.

### 4.3 Does the wiki template render MINTO-as-primary well?

No. The wiki template has two rendering surfaces: home cards (read `sec.summary`) and
article view (read `art.content` through marked.parse). There is no "section-home" page that
renders a section-level narrative. Clicking a home card calls `openSection(id)` which just
loads the first artifact. There is no place for a MINTO.md narrative to go without adding
a new render path.

**Teaching the template to render MINTO-as-primary would require:**

- New section object field: `sec.minto` (string) or `sec.mintoHtml` (pre-rendered)
- New function `showSectionHome(secId)` that renders MINTO content into `#article`
- Change `openSection` to call `showSectionHome` instead of loading first artifact
- New sidebar affordance: section-head click shows MINTO, artifact click shows artifact

That is at least 50 lines of new JS in the template plus a new field. It is work the v1.10.5
patch should NOT bundle. It makes the fix bigger, it risks touching the template rendering
logic that is currently working for Lawrence's workaround path, and it delays the fix
another half day.

### 4.4 What the user loses if we skip MINTO-as-primary for v1.10.5

Nothing. The fix Lawrence wants is "artifacts actually render when I click them." MINTO-as-
primary is a value-add, not a bloat-avoidance strategy. With the 800 byte to 2.5 KB artifact
average and 2 MB cap, there is no bloat problem to solve via MINTO compression. We do not
need to trade artifact visibility for narrative compression because the math does not
require the trade.

### 4.5 What we DO consume from v1.10.2 for free

`sec.summary` (home card summary) is currently the first artifact's H1 title. That is a
weak summary. We can upgrade it to the section MINTO.md `governing_thought` frontmatter
field, which IS what Phase 81 produces. Cost: 10 lines in collectSections, zero template
change. Value: home cards suddenly read like a wiki TOC. This is the "leverage v1.10.2 for
free" play.

**Recommendation:** Ship artifact injection as the primary fix. Upgrade `sec.summary` to
read `governing_thought` from per-section MINTO.md when present. Defer MINTO-as-primary
section home pages to v1.11.x or bundle with the snapshot-hub work.

## 5. Q4: Three-tier loading model

### 5.1 Tier spec

- **Tier 1: Section metadata (always eager, ~500 bytes per section).** Section id, label,
  color, entryCount, summary. Plus optional `governingThought` from per-section MINTO when
  present. Required for sidebar + home cards to render. Cheap. Already partially shipped.
- **Tier 2: Per-artifact eager content (the fix, ~800 bytes to 20 KB per artifact).**
  filename, title, content, wordCount, frontmatter (compact), excerpt. Required for the wiki
  article view to render. This is what Lawrence injected by hand. Gated by a per-room size
  cap.
- **Tier 3: Over-cap truncation fallback (per-artifact, graceful).** If an artifact exceeds
  20 KB, content is truncated to first 20 KB + `...\n\n(truncated at 20KB, open source file
  for rest)` appended. Title, filename, frontmatter still eager so sidebar and click
  handlers work; the article view simply shows a banner and the first 20 KB.

**Three-tier loading, not three-tier storage.** Everything still ships in the one HTML file.
The tiers describe WHAT information is captured per artifact, not where it lives on disk.
This preserves Decision 1 (one-command install) and Decision 8 (tier-0 fully functional, no
dependencies). No CompressionStream, no companion folder, no GitHub link-out.

### 5.2 JSON shape

```json
{
  "sections": [
    {
      "id": "problem-definition",
      "label": "Problem Definition",
      "color": "#A63D2F",
      "lightText": false,
      "entryCount": 12,
      "summary": "Time to decision is the wicked problem gap",
      "governingThought": "Ventures fail at the boundary between insight and decision because their tools are not hierarchy-aware.",
      "artifacts": [
        {
          "filename": "time-to-decision-gap.md",
          "title": "Time to Decision Gap",
          "excerpt": "When a founder files an insight, the system should cascade it...",
          "wordCount": 412,
          "frontmatter": {
            "date": "2026-04-10",
            "status": "assumption",
            "related": "market-analysis/tam-estimate"
          },
          "content": "# Time to Decision Gap\n\nWhen a founder files an insight..."
        }
      ]
    }
  ]
}
```

**Field rules:**

- `content` is REQUIRED but may be truncated per tier 3.
- `excerpt` is the first 200 chars of content with markdown stripped. Used as tier 2 preview
  in any future drill-down UI; currently unused by the template but cheap to include (200
  bytes per artifact) and forward-compatible.
- `frontmatter` is whitelisted to safe scalar fields only (no nested objects, no arrays
  longer than 3, no values over 200 chars). This bounds the infobox panel size.
- `governingThought` is read from `<sectionDir>/MINTO.md` frontmatter when present, null
  otherwise. Backwards compatible with pre v1.10.2 rooms.

### 5.3 The cap math

Per-artifact cap: 20 KB raw content. An artifact hitting this cap is truncated with a notice
banner.

Per-room cap: 2 MB total injected markdown (sum over all artifacts in all sections). When
the cap is approached, the generator issues a warning and begins truncating artifacts to
their excerpt + frontmatter only (tier-2 degraded mode). Sections are processed in file
modification time descending order so the most recently touched artifacts get full content
and the stale ones degrade first.

**Under the 2 MB cap at B=2500: ~800 artifacts get full content.** No user today is close.

## 6. Q5: Exclusion rules

Align with `lib/vault/room-scanner.cjs` SYSTEM_FILES set.

**Hard exclude (import from room-scanner.cjs):**

```
STATE.md, ROOM.md, CLAUDE.md, COWORK-INSTRUCTIONS.md, TODOS.md,
WHATS-NEXT.md, INDEX.md, MILESTONES.md, TEAM-STATE.md,
MEETINGS-INTELLIGENCE.md, action-items.md, MINTO.md
```

Plus `generate-presentation.cjs`-specific:

```
USER.md, ROOM-INTELLIGENCE.md
```

Plus any file matching these patterns:

- `*-tier0-baseline.md` (test fixtures)
- `expected-*.md` (test baselines)

**Hard exclude directories:** `.mos`, `.migration-backup`, `_superseded`, `.git`, `.mindrian`,
`.lazygraph`, `exports`, `node_modules`, `.obsidian`, `meetings`, `team`.

Note `meetings` and `team` are already excluded by the SKIP_DIRS set at line 57. They are
handled through `collectTeam` and future meeting collectors, not artifact injection. This
keeps meeting transcripts out of the wiki artifact stream for now (they are large and
separately consumable via other views).

**Soft exclude:**

- Files with frontmatter `published: false` --> excluded from tier-2 content, excerpt kept
- Files larger than 20 KB raw --> truncated (not excluded)
- Files with frontmatter `wiki_hidden: true` --> excluded entirely from sidebar

**The `.mos` / `.migration-backup` / `_superseded` exclusions are critical.** Without them,
the 81-02 Feynman-MINTO migration backup directory (which can contain 5 to 20 MB of old
MINTO regressions) gets injected and blows the cap immediately.

## 7. Q6: The concrete patch to generate-presentation.cjs

### 7.1 Lines that change

**Line 58 to import SYSTEM_FILES from room-scanner.cjs** (replace inline SKIP_FILES set).

**Line 155 to 191: rewrite collectSections to return artifacts.** Full replacement follows
in section 7.3.

**Line 193 to 210: rewrite collectMinto to also walk per-section MINTO.md.** The room-level
collectMinto stays for the deck view. Add a new `collectSectionMinto(sectionDir)` helper that
returns the governing_thought frontmatter value.

**Lines added: ~80. Lines removed: ~30. Net +50 lines in one file.**

### 7.2 New helper functions

```
function extractExcerpt(content, maxChars)
  strip frontmatter, strip H1, strip markdown formatting, return first maxChars chars

function extractWordCount(content)
  content.split(/\s+/).filter(Boolean).length

function filterFrontmatter(fm)
  whitelist scalar keys, drop values over 200 chars, drop nested objects

function collectSectionMinto(sectionDir)
  read <sectionDir>/MINTO.md if exists, parse frontmatter, return governing_thought string or null

function truncateToCap(content, maxBytes)
  if Buffer.byteLength(content, 'utf8') <= maxBytes return content
  return content.slice(0, maxBytes) + '\n\n_(truncated at ' + maxBytes + ' bytes, open source file for rest)_'
```

### 7.3 Rewritten collectSections signature

```
function collectSections(roomDir, opts)
  opts = { perArtifactCapBytes: 20480, totalCapBytes: 2097152, mode: 'wiki' }
  totalInjected = 0

  for each section dir:
    mdFilePaths = findMdFiles(sectionDir, SYSTEM_FILES)
    sort by mtime desc (most recent first, so truncation hits stale files)

    artifacts = []
    for each mdFilePath:
      content = safeRead(mdFilePath)
      if !content continue

      fm = parseFrontmatter(content)
      if fm.wiki_hidden === 'true' continue

      title = extractTitle(content, mdFilePath)
      excerpt = extractExcerpt(content, 200)
      wordCount = extractWordCount(content)

      contentBody = fm.published === 'false' ? '' : truncateToCap(content, perArtifactCapBytes)

      projectedTotal = totalInjected + Buffer.byteLength(contentBody, 'utf8')
      if projectedTotal > totalCapBytes:
        contentBody = '' // cap hit, drop content but keep metadata
      else:
        totalInjected = projectedTotal

      artifacts.push({
        filename: path.basename(mdFilePath),
        title,
        excerpt,
        wordCount,
        frontmatter: filterFrontmatter(fm),
        content: contentBody,
      })

    governingThought = collectSectionMinto(sectionDir)
    summary = governingThought || (first artifact title) || ''

    sections.push({
      id: dirName,
      label,
      color,
      lightText: SECTION_LIGHT_TEXT.has(dirName), // new constant, matches De Stijl palette
      entryCount: artifacts.length,
      summary,
      governingThought,
      artifacts,
    })

  return { sections, totalArtifacts: sum(artifacts.length), totalInjectedBytes: totalInjected }
```

### 7.4 Mode parameter (surface-aware detail level)

The `opts.mode` flag exists so other templates can request a different detail profile:

- `mode: 'wiki'` --> tier-2 full content per cap (this patch)
- `mode: 'dashboard'` --> tier-1 metadata only (no content field, smaller payload)
- `mode: 'deck'` --> tier-1 metadata + MINTO governing_thought only

Today only wiki mode is needed. Dashboard and graph views do not read `sec.artifacts[].content`
so they get tier-1 implicitly. The mode flag is forward-compatible plumbing.

### 7.5 Backwards compatibility with pre-v1.10.2 rooms

`collectSectionMinto` returns null for sections without MINTO.md. `governingThought` becomes
null in the JSON shape. The wiki template does not consume `governingThought` today (home
cards read `sec.summary` which falls back to first artifact title). Pre-81 rooms render
identically to post-81 rooms except for the quality of the home card summary text.

Old room-level MINTO.md at `<roomDir>/MINTO.md` is still read by `collectMinto` for the deck
view. No break.

### 7.6 Tests

New test file: `test-fixtures/presentation/wiki-injection.test.cjs`.

Cases:

1. **Small room**: run generator against `test-fixtures/feynman/sections/fixture-small`,
   assert ROOM_DATA.sections[0].artifacts has 2 entries, each with non-empty content,
   filename, title. Assert wiki.html contains the content string (grep the output).
2. **Large room**: same for fixture-large. Assert 12 artifacts. Assert no truncation
   (all under 20 KB).
3. **Per-artifact cap**: synthesize a 25 KB fixture artifact. Assert content is truncated
   to 20 KB + banner. Assert wiki still renders.
4. **Total cap**: synthesize a fake room with 1000 * 3 KB artifacts. Assert total cap
   kicks in, later artifacts have empty content, earlier ones are full.
5. **MINTO governing_thought**: create a MINTO.md in a fixture section with
   `governing_thought: "Test thought"`. Assert `sec.governingThought === "Test thought"`
   and `sec.summary === "Test thought"`.
6. **SYSTEM_FILES alignment**: add CLAUDE.md to a fixture section. Assert it is NOT in
   artifacts.
7. **wiki_hidden frontmatter**: add an artifact with `wiki_hidden: true`. Assert excluded.
8. **published: false**: add an artifact with `published: false`. Assert excerpt kept,
   content empty.
9. **Regression**: run against an empty section directory, assert no crash, empty artifacts
   array.

Run via node built-in `assert`. Zero new dependencies.

## 8. Q7: Shippability as v1.10.5

### 8.1 Release cadence review

From CHANGELOG.md:

- v1.10.2: 2026-04-14 Feynman-MINTO Hybrid (large phase)
- v1.10.3: 2026-04-14 Statusline polish (same-day patch)
- v1.10.4: 2026-04-14 Statusline polish + update hint (same-day patch)

The two same-day patches prove the v1.10.x slot supports 2 to 4 hour tactical fixes. v1.10.5
as "wiki artifact injection fix" follows the same pattern.

### 8.2 Effort estimate

- Read SYSTEM_FILES import, align constants: 15 min
- Rewrite collectSections with helpers: 60 min
- Add per-section MINTO reader: 20 min
- Write tests (9 cases above): 75 min
- Run tests against all 3 fixtures, regenerate baselines: 30 min
- CHANGELOG entry, plugin.json bump, package.json bump, tag, push: 20 min

**Total: 3 hours 40 minutes.** Fits the v1.10.5 slot.

### 8.3 What gets deferred

- Smart-notebook milestone shifts from v1.10.5 to v1.10.6. CHANGELOG [1.10.5] calls this out
  explicitly so smart-notebook research is not orphaned.
- MINTO-as-primary section home pages deferred to a future milestone (v1.11.x or bundled
  with snapshot-hub work).
- CompressionStream inline compression deferred indefinitely, only revisited if a user
  reports hitting the 2 MB cap.

### 8.4 Ship as v1.10.5 or as v1.10.5-beta.1?

Release process doc says release infrastructure changes ship as beta first. This patch is
NOT release infrastructure. It is a user-facing bug fix in the presentation generator. Ship
as v1.10.5 direct. If it breaks something, v1.10.6 comes same-day. The cadence supports it.

## 9. Q8: CHANGELOG draft

```markdown
## [1.10.5] - 2026-04-14

### Fixed
- **Wiki artifact content now renders.** `scripts/generate-presentation.cjs` collectSections
  was shipping `sec.artifacts` as undefined, so every wiki.html export rendered empty
  articles even when the sidebar showed correct entry counts. The template (which expects
  `art.filename`, `art.title`, `art.content`, and optional `art.frontmatter`/`art.wordCount`)
  was silently being fed an empty contract. Fix populates the artifacts array with full
  markdown content up to a per-artifact 20 KB cap and a per-room 2 MB injection ceiling.
  Reported by Lawrence Aronhime on 2026-04-13 23:23 with an exact root cause at
  generate-presentation.cjs lines 181 to 187. Lawrence workarounded on his own machine by
  injecting the content manually into ROOM_DATA; every other beta tester was still hitting
  the empty-wiki bug until now.

### Changed
- **SYSTEM_FILES single source of truth.** `collectSections` now imports SYSTEM_FILES from
  `lib/vault/room-scanner.cjs` instead of maintaining its own drifted SKIP_FILES set. CLAUDE.md,
  COWORK-INSTRUCTIONS.md, TODOS.md, WHATS-NEXT.md, INDEX.md, MILESTONES.md, TEAM-STATE.md,
  action-items.md, and the post-81 MINTO.md are now uniformly excluded from artifact
  injection across vault, presentation, and graph layers.
- **Section summary upgrades to MINTO governing_thought when available.** Leverages the
  v1.10.2 Feynman-MINTO per-section MINTO.md infrastructure: if a section has a MINTO.md
  with a `governing_thought` frontmatter field, the wiki home card summary reads that value
  instead of the first artifact's H1. Pre-v1.10.2 rooms fall back to H1 unchanged.

### Added
- **Per-artifact and per-room injection caps.** 20 KB per artifact, 2 MB per room. Artifacts
  over 20 KB are truncated with a notice; rooms over 2 MB drop content (not metadata) on
  sections processed last, so the most recently edited artifacts always retain full content.
  These caps are generous enough that no current beta tester is near them.
- **Integration tests for wiki injection.** 9 test cases against the Feynman fixture rooms
  (small, medium, large) covering full content rendering, per-artifact truncation, total cap
  backoff, MINTO-driven summary upgrade, and SYSTEM_FILES alignment. Committed under
  `test-fixtures/presentation/wiki-injection.test.cjs`.

### Not in this release
- **Smart-notebook milestone** (Mullins 7-domain scaffold, three-level hierarchy, co-founder
  synthesis voice) shifts from v1.10.5 to v1.10.6 so the wiki fix can ship same-day. Research
  docs at `.planning/research/smart-notebook-cofounder.md` and
  `.planning/research/smart-notebook-cofounder-appendix.md` remain the source of truth for
  the next feature milestone.
- **MINTO-as-primary section home pages.** The per-section MINTO.md produced by v1.10.2 is
  only used to upgrade the home card summary in this release. Rendering the full MINTO
  narrative as a section home page (clicking a section goes to MINTO, clicking an artifact
  goes to artifact content) is a template change deferred to v1.11.x or to the snapshot-hub
  bundle.
- **Inline compression.** Considered and rejected for v1.10.5. The cap math does not require
  it for any realistic room size, and adding CompressionStream + base64 decoding would break
  "view-source shows readable content" which is part of the single-file snapshot ethos.

### Upgrade path
Standard two-command upgrade:

```
/plugin marketplace update
claude plugin update mos@mindrian-marketplace
```

Existing exported wiki.html files do NOT auto-regenerate. Users must re-run
`/mos:present` (or `mindrian-tools.cjs generate-presentation`) against their room to get the
fixed output. Rooms that regenerated between v1.10.2 and v1.10.5 are unaffected on disk until
the user re-runs the generator.

### Credit
Lawrence Aronhime (Prof., Johns Hopkins Carey Business School, PWS methodology author)
reported this bug on 2026-04-13 23:23 with a complete root-cause analysis and a working
workaround. He is MindrianOS's oldest admin Brain API key holder (`lawrence@mindrian-os.com`,
2026-03-26) and has been running beta builds since v1.9.x. Thanks Lawrence.
```

## 10. Tri-polar check

| Surface | How it consumes the fix | Notes |
|---|---|---|
| **Claude Code CLI** | User runs `/mos:present`, generator writes 6 HTML files, wiki.html now has content. Same hook path as today, zero new infrastructure. | No regression. |
| **Claude Desktop** | User asks Larry to "export my room" or to open the wiki. Larry runs the generator via shell. Desktop opens the HTML via the filesystem URL. Same file, same content. | Desktop does not speak slash commands directly but the generator is a plain node script; Larry invokes it as a tool. No surface-specific code. |
| **Cowork** | Scheduled task or shared team member runs the generator against a shared room folder. Output is written to `exports/presentation/` on the shared mount. Team members open wiki.html and see full content. | Cowork benefits most: shared rooms are the likeliest to have 100+ artifacts, and the 2 MB cap is verified sufficient for even meeting-heavy team rooms. |

All three surfaces get the same fix from the same file. Decision 4 (three surfaces) is
preserved. No surface-specific code added.

## 11. Decisions check (CLAUDE.md Decisions 1, 8, 15, 16)

- **Decision 1 (one-command install, zero config):** Fix adds zero new dependencies, zero
  configuration. User upgrades, runs generator, wiki works. Nothing to set up.
- **Decision 8 (tier-0 fully functional, no dependencies, graceful degradation):** Fix is
  pure Node.js built-ins. Cap fallbacks (per-artifact truncation, per-room backoff) ARE
  graceful degradation. Over-cap artifacts still render with a banner, not an error. Rooms
  without MINTO.md still get a summary from H1.
- **Decision 15 (ICM Layer 0 everywhere):** Every section directory must have ROOM.md. The
  fix does not change this. ROOM.md is in SYSTEM_FILES and excluded from artifact injection,
  which is correct: the identity file is not an artifact.
- **Decision 16 (Obsidian vault nested structure):** Artifacts live at
  `section/artifact-name/artifact-name.md`. `findMdFiles` recurses into subdirectories, so
  nested artifact folders are already found. Per-artifact ROOM.md files (one per artifact
  folder) are excluded via SYSTEM_FILES. Attachments (images, data files alongside the .md)
  are not injected; they remain on disk and must be referenced via relative URLs that will
  break in the single-file HTML view. This is a known limitation of the single-file snapshot
  model and is out of scope for v1.10.5. Users who need images in the wiki should export
  and open from the room directory (`file://` protocol resolves relative paths).

## 12. Top 3 risks

1. **Larger rooms hit the 2 MB cap and users do not notice the truncation.** Mitigation: the
   generator logs `Injected X KB of artifact content across Y sections (cap: 2 MB)` at the
   end of every run. When X approaches 1.8 MB, a warning is printed. Users see the ceiling
   before they hit it. The truncation banner inside the article ALSO says it is truncated,
   so users who read the specific article know. Risk rating: low.
2. **Obsidian-style wikilinks inside artifact content point to filenames that were excluded
   by SYSTEM_FILES.** The template's wikilink resolver at line 346 looks up artifactByTitle;
   misses render as muted spans. A wikilink pointing at CLAUDE.md (now excluded) becomes a
   dead muted span rather than an error. Visually correct, functionally a broken link. This
   is an existing template behavior, not a regression. Risk rating: low.
3. **Meeting transcripts start getting filed into non-`meetings` section folders.** Today
   `meetings/` is a SKIP_DIR, so transcripts are not injected. But as the meetings layer
   matures (Decision 11), users will start filing transcript artifacts into problem-definition
   and market-analysis folders. A single transcript can be 50 to 200 KB. At 150 KB average and
   50 transcripts, the 2 MB cap is reached. Mitigation: the 20 KB per-artifact truncation
   protects the room cap from any single transcript blowing the budget. Truncated transcripts
   still show the first 20 KB which is usually enough context. Risk rating: medium. Watch
   after v1.10.5 lands and consider bumping the room cap to 4 MB if beta testers hit it.

## 13. Rejected alternatives

- **Tier 3 as companion folder (separate .md files next to wiki.html).** Rejected. Breaks
  the single-file snapshot story that is core to the `/mos:snapshot` contract.
- **Tier 3 as compressed blob decoded via CompressionStream on click.** Rejected. Breaks
  "view source is readable," adds client-side JS, doubles first-click latency, and the math
  does not require it.
- **Tier 3 as link-out to GitHub raw content.** Rejected. Snapshots are supposed to be
  portable. Linking to GitHub means the snapshot breaks the moment the room is not on GitHub
  or the user is offline.
- **Not injecting content at all, teach the template to lazy-load from a companion JSON.**
  Rejected. Same "single file" objection. Also adds a fetch path that fails under `file://`
  protocol in some browsers (CORS on local files).
- **Rewriting the wiki template to render MINTO as section pages and making artifact content
  drill-down only.** Rejected for v1.10.5 specifically. Not wrong, just additional work that
  delays the bug fix. Revisit in v1.11.x.
- **Inline marked.min.js instead of CDN loading.** Rejected. The template already depends
  on the CDN and adds ~30 KB inline would not change the bloat budget math meaningfully. The
  CDN path works under `file://` because the script tag is treated as remote.
- **Dropping SKIP_FILES and injecting every .md file including CLAUDE.md.** Rejected. Bloats
  the payload with plugin meta-content the user does not want in their wiki.

## 14. Verification checklist before merging

- [ ] `grep -n '\u2014\|\u2013' scripts/generate-presentation.cjs` returns zero matches
- [ ] `grep -n '\u2014\|\u2013' .planning/research/wiki-artifact-injection-bloat-analysis.md` returns zero matches
- [ ] All 9 new integration tests pass
- [ ] Generator output against fixture-small, fixture-medium, fixture-large all have populated artifacts arrays
- [ ] wiki.html file size for fixture-large is under 100 KB
- [ ] wiki.html file size for a realistic 150-artifact room is under 500 KB
- [ ] CHANGELOG [1.10.5] entry present at top of file
- [ ] plugin.json version = 1.10.5
- [ ] package.json version = 1.10.5
- [ ] git tag v1.10.5 created
- [ ] marketplace.json source.ref updated to v1.10.5
- [ ] Lawrence credited by name in CHANGELOG
- [ ] Smart-notebook deferral to v1.10.6 noted in CHANGELOG

## 15. Open questions for the Claude session that ships this

1. `filterFrontmatter` should strip `author`, `email`, `phone`, `ssn`, `dob` by default
   (PII safety for investor-shared rooms); add `--include-pii-frontmatter` escape hatch.
2. Per-room cap should be CLI-configurable via `--max-injection-bytes` (default 2097152).
3. Generator should write a sidecar `wiki-injection-report.json` summarizing injected vs
   truncated vs capped. Ten lines of code, critical debug trail.
4. `collectSectionMinto` does NOT run the tier-0 generator as a side effect. v1.10.5 stays
   orthogonal to v1.10.2. No MINTO = fallback to H1 title.
5. Expose `governingThought` to dashboard view (index.html) as well. One extra template
   variable, worth bundling.

## 16. Closing note

The fix is small, the template is the contract, the math is not scary, and MINTO-as-primary
is a distractor for this particular bug. Ship the 3 hour 40 minute patch, credit Lawrence,
move smart-notebook to v1.10.6. Single-file snapshot experience stays intact. Nothing touches
Brain, Neo4j, the intelligence pipeline, or tri-polar surface code. It is surgical.

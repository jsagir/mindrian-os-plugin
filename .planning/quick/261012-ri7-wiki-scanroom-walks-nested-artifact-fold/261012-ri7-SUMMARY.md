---
phase: quick-261012-ri7
plan: "01"
status: complete
commits:
  red: 97285972f
  green: cb1c5bf47
requirements: [QUICK-WIKI-NESTED-SCAN]
page_count_before: 61
page_count_after: 418
frontmatter_failures: 3
completed: 2026-10-12
---

# Quick 261012-ri7: wiki scanRoom walks nested artifact folders

The wiki, the static export and MCP `view_compile` "wiki" now see every room page, including decision-16 nested artifacts. They read the same `scanRoom`. On `rethinking-mindrianos` the page count went from 61 to 418 (PROVEN, measure script and the one-line `node -e`).

## Commits

| Task | Sha | Message |
|------|-----|---------|
| 1 RED | 97285972f | test(quick-261012-ri7): add failing nested wiki scan test |
| 2 GREEN | cb1c5bf47 | fix(quick-261012-ri7): wiki scanRoom walks nested decision-16 artifacts ... (includes CHANGELOG.md) |
| 3 | none | Measure script and this SUMMARY are in the quick folder. The orchestrator commits them. |

The last line of every commit message is `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` after a blank line (ruling 3). Both commits used `git commit --only` with explicit paths. Both shas are ancestors of HEAD (PROVEN).

## Page count before and after

| | Before | After |
|---|---|---|
| Pages | 61 | 418 |
| funding | n/a | 3 |
| opportunity-bank | n/a | 5 |
| research | n/a | 358 |
| solution-design | n/a | 52 |
| Id segments (2/3/4/5/6) | 61 at 2 | 61 / 260 / 88 / 7 / 2 |

Census (independent plain walk, run at measure time): 418 .md files after exclusions. Files under a team or references folder below depth 1: 0. Target 418. The live room matched the plan (418), so there is no second number to report.
Preserved ids: 61 of 61 old ids exist (PROVEN).
Scan time 70.7 ms for the full walk.

## Frontmatter failures: 3

All 3 are `frontmatter_parse_failed` scan warnings. Each page keeps its body and gets empty properties:
- research/2026-07-07-fable-max-pack/opportunity-harvest-formula/opportunity-harvest-formula.md
- research/2026-08-05-tnufa-graphrag-grant-grader/2026-08-05-tnufa-graphrag-grant-grader.md
- research/2026-08-26-trial-install-testimonial/2026-08-26-trial-install-testimonial.md

The server prints one `[wiki]` warning line at startup with the count and the first 3 paths.

## Id shape decision

id = room-relative path without `.md`, forward slashes. Root files keep their basename. Examples: `research/name`, `research/name/name`, `research/other/name` are 3 distinct pages. This matches the room.db artifact node id convention.

## Wikilink resolution rule (buildPageIndex, deterministic)

Pages are ordered by id segment count (fewer first), then by id in codepoint order.
1. Pass 1 sets every full id (lowercased). The first page in order wins a case-insensitive tie.
2. Pass 2, in the same order, sets the lowercased title, the lowercased basename, and for a decision-16 artifact (3 or more segments, last 2 equal) the lowercased folder path. Each key is set only when not set yet.

So `[[name]]` goes to the page whose full id is `name`; if none, to the first page whose title, basename or folder path is `name`. `[[research/solo]]` goes to `research/solo/solo`. An unresolved name keeps the old fallback.

## Walker choice (D1 confirmed)

`walkSectionTree` calls `listMarkdownFiles` (one readdirSync per folder, no recursion) and `discoverSections(dir).all` for child folders, then calls itself. No function in `page-renderer.cjs` both reads a directory and calls itself. `isRealpathContained` checks every file. `isSkippedDir` applies the skip rules at every depth. `tests/test-270-no-second-walker.cjs` is unchanged and passes.

## Verify results (quoted)

Baselines are the plan's list.

| Command | Result | Baseline |
|---|---|---|
| node tests/test-visible-room-nested-scan.cjs | `test-visible-room-nested-scan: 14/14 passed` (3 runs, stable) | RED 1/14 |
| test-232-briefing | `5/5 passed` | 5/5 |
| test-232-export | `5/5 passed` | 5/5 |
| test-232-room-home | `6/6 passed` | 6/6 |
| test-232-transforms | `6/6 passed` | 6/6 |
| test-232-wiki-server | `8/8 passed` | 8/8 |
| bash tests/run-all-232.sh | `Phase 232: PASS=5 FAIL=0` | PASS=5 |
| test-visible-room-leak | `14/14 passed` | 14/14 |
| bash tests/run-all-visible-room.sh | `Visible Room: PASS=2 FAIL=0` | PASS=2 |
| test-270-no-second-walker | `PASS test-270-no-second-walker (4 rules run, 6 operator files declared, 0 skipped as not-yet-created)` | 4 rules, 6 files |
| git diff --quiet -- tests/test-270-no-second-walker.cjs | unchanged | unchanged |

Measure script (`261012-ri7-measure.cjs`, read-only on the real room), exit 0, `RESULT: OK`:
- `scan.target: OK pages 418 vs target 418`
- `preserved: OK 61 of 61 flat ids present`
- search marker check: `server.search: OK marker "abandoning" returns nested id research/2026-07-08-gtm-strategy-pack/01-market-research (status 200)`
- `server.page: OK GET /wiki/research/2026-07-08-gtm-strategy-pack/01-market-research -> 200`
- `server.pages: OK /api/pages keys 418 vs scan 418`
- `server.timing: median 56.6 ms for a page view (min 40.0, max 62.5)`
- `fingerprint.after: unchanged cedf25a5b13ba45e6160ee587cda2d48e3ff3b2e84c7736ca8bb15b29baad999` (424 files, same hash before and after)
- `node -e` scanRoom pages.size prints `418`, equal to the scan leg.

The marker is "abandoning", not the plan's "transparentchoice". The script picks the first qualifying word in codepoint order, so a different word is expected; the plan's rule is met.

## Deviations from Plan

**1. [Rule 1 - Bug] gray-matter cache hides a parse failure after the first scan.** gray-matter stores a file in its content cache before it parses it. After one throw, the next `matter(raw)` with the same text returns the half-parsed entry with no throw and no warning. The server rescans on every view, so the warning and the stripped body would exist only on the first scan. Fix: `parsePage` calls `matter(raw, {})`; an options object bypasses the cache. The test precondition also uses `{}` so it does not prime the cache.

**2. [Rule 2 - Missing safety] Title coerced to string.** A frontmatter title can parse as a number or a date. `buildPageIndex` and the search index call string methods on it. `parsePage` now uses `String(frontmatter.title)`.

**3. Test change after the RED commit (in the GREEN commit).** The save check wrote `research/name/name.md`, and the export check later needed its wikilinks. The save check now restores the fixture text after it reads it back. This is a test-ordering fix, not a change of decision.

**4. Measure script copy filter.** The plan says reject every entry whose basename starts with a dot. The script keeps `.room-root`, so a sub-room at depth 1 stays a sub-room in the copy. The room has none at depth 1, so the result is the same.

**5. CHANGELOG (orchestrator ruling 2).** One Fixed bullet added under the existing `### Fixed` heading of `## [Unreleased] -- v2.0.0-beta.66`, in the GREEN commit. The plan owed it to the next cut.

**6. Em-dash note.** My added lines contain no em-dash or en-dash (PROVEN by grep). `lib/wiki/wiki-server.cjs` has 4 em-dashes that exist at HEAD before this task (lines 643, 646, 706, 708 of the new file; in the PDF template and the chat stub). I did not touch them.

## Known limits

- `.md` only. `.html` pages are not in the wiki.
- A folder named `team`, `references` or `meetings` below the first level is not walked (discoverSections skips STRUCTURAL_DIRS). Fleet check at planning: 40 files under `team`.
- A folder that has no direct `.md` and holds artifacts only 2 or more levels down does not qualify in discoverSections. The census equals the scan on this room (0 gap), so no loss is measured here (PROVEN for this room, ASSUMED for others).

## Follow-ups (one line each)

- .html pages in the wiki.
- The wikilink pattern rejects dot targets such as `[[section/ROOM.md|label]]` (62 of 114 wikilinks in the measured room; 18 match).
- The section page lists every page flat (research has 358 cards); group by artifact folder.
- Nested ROOM.md and MINTO.md pages fall back to the titles ROOM and MINTO (78 and 77 files).
- Root pages (section `_root`) have no reachable route and no export file (pre-existing).
- `/wiki/:section/pdf` is shadowed by the article route (pre-existing).
- Ids enter href attributes unescaped in section cards and client search (pre-existing; loopback-only server).
- `view_compile` rendered links point at `/wiki/` server URLs that do not exist on Desktop or Cowork (pre-existing).
- The `/api/save` route still calls `matter(raw)` with the cache; same cache hazard, out of scope here.
- Item 7a (repoint `/api/search` to the room_search engine) can now ship.

## Surfaces and canon

- Tri-Polar: CLI wiki server, CLI static export and MCP `view_compile` (Desktop, Cowork) all read the same `scanRoom`. No surface-specific code.
- Canon Part 7: reuse of `discoverSections`, `isRealpathContained`, `isPrivateRoomPath`. No new walker module, no new dependency.
- Canon Part 8: local files only. No network, no Brain client.

## Threat model

T-ri7-01 to T-ri7-07 and T-ri7-09 are mitigated and covered by the fixture test (private files, hidden folders, sub-rooms, node_modules, export, symlinks, traversal on page and save routes, bad frontmatter, signature skip, export path guard). T-ri7-08 and T-ri7-10 are accepted as in the plan.

## Not done by design

No push, no release, no version bump, no network, no room edit. `lib/mcp/tools/room.cjs`, `lib/wiki/wiki-search.cjs`, `lib/mcp/tools/views.cjs` and `tests/test-270-no-second-walker.cjs` are untouched. Nothing under `.planning/` is staged. The quick folder `261012-c6n` was not touched.

## Self-Check: PASSED

- tests/test-visible-room-nested-scan.cjs, lib/wiki/page-renderer.cjs, lib/wiki/wiki-server.cjs, lib/wiki/wiki-export.cjs, CHANGELOG.md: present and committed.
- 97285972f and cb1c5bf47 are ancestors of HEAD.
- `git status --short -- lib tests CHANGELOG.md` is empty.

# Cluster C evidence: items 5 and 7 (search-surface-qa-sweep-20261012)

Code read at: branch main @ 63b25583d. Local only. No Brain call, no network. No code, test, or room file was changed.
Claim tags: PROVEN (I ran it or read the line), UNVERIFIED (not run), ASSUMED.
Room used for counts: ~/MindrianRooms/rethinking-mindrianos (read only). Only paths and counts are quoted.

## ITEM 5: wiki scan is one level deep

### Evidence

- timestamp: 2026-10-12
  checked: ran scanRoom (lib/wiki/page-renderer.cjs) on rethinking-mindrianos and counted walkable .md with find (dot paths excluded)
  found: scanRoom returned 61 pages and 4 sections [funding, opportunity-bank, research, solution-design]. find returned 424 .md and 0 .html. 61 of 424 = 14.4 percent seen; 363 = 85.6 percent not seen.
  implication: PROVEN. Matches spike 010 (61 of 424). The wiki index (flexsearch) is built from these same 61 pages, so search sees the same 61.

- timestamp: 2026-10-12
  checked: scanRoom code, lib/wiki/page-renderer.cjs lines 80-152
  found: Line 80-84 doc comment: "Scan room/ directory, one level deep, for .md files (NOT recursive: a section's own subdirectories are never walked)". Line 94-113: root level takes only real *.md files, not dot-files, not SKIP_FILES, not PRIVATE_ROOT_FILES. Line 120-125: a directory is skipped if it is in SKIP_DIRS, starts with ".", is export/exports, or holds .room-root. Line 135-146: inside a section, `readdirSync(sectionDir)` then `if (!se.isFile() || !se.name.endsWith('.md')) continue;` so a sub-directory entry is dropped at line 138. Page id is `${section}/${basename}` (parsePage, line 161).
  implication: PROVEN. Included: root/*.md (non-private), <section>/*.md. Skipped: <section>/<name>/<name>.md (decision 16 nested layout) and everything deeper. The skip is `!se.isFile()`, not a depth counter.

- timestamp: 2026-10-12
  checked: file counts by depth class in the room (find -mindepth/-maxdepth, plus a count script that printed counts only)
  found: depth 1 (root) 4; depth 2 (section/file.md, flat) 63; depth 3 (section/name/x.md) 260, of which 90 are name/name.md (decision 16 layout) and 170 are name/other.md; depth 4 88; depth 5 7; depth 6 2. Deeper than depth 3: 97. Sum 4+63+260+97 = 424. Not seen = 4 root identity files (MINTO, ROOM, STATE, USER; PRIVATE_ROOT_FILES) + 2 flat STATE.md (funding, opportunity-bank; SKIP_FILES) + 90 + 170 + 97 = 363.
  implication: PROVEN. The 61 seen files are all flat section files. Every nested artifact (90 in decision 16 layout, 170 siblings, 97 deeper) is invisible.

- timestamp: 2026-10-12
  checked: git archaeology on lib/wiki/page-renderer.cjs (3 commits total)
  found: 51c0c13bc 2026-03-26 feat(19-01) created the file. Its header said "recursively" but its section loop (line 72-73) said "one level deep" and used one readdirSync. cbd6241fb 2026-09-23 quick 260923-lu5 (SEED-006 Q0.1/Q0.2) changed the comment to "one level deep ... NOT recursive" and did not change the depth. `git log -S"NOT recursive"` returns only cbd6241fb.
  implication: PROVEN. The code was never recursive. Phase 19-01 PLAN line 125 specified "walks room/ directory recursively"; the implementation did not match its plan.

- timestamp: 2026-10-12
  checked: decision 16 date (git log -S in .claude/includes/decisions.md and CLAUDE.md)
  found: commit 9d5b9b054 2026-04-12 "rule: v1.9.7 Obsidian vault nested structure mandate"; CHANGELOG [1.9.7] 2026-04-12. The wiki scan (2026-03-26) is 17 days older than decision 16.
  implication: PROVEN. The one-level scan predates the nested layout. It was written for flat section/file.md rooms.

- timestamp: 2026-10-12
  checked: recorded decisions. .planning/quick/260923-lu5-*/260923-lu5-PLAN.md line 176 and SUMMARY line 37; .planning/phases/19-wiki-dashboard/; .planning/phases/232-*; room pack file research/2026-07-07-fable-max-pack/seed-visible-room-wiki/seed-visible-room-wiki.md
  found: (a) lu5 PLAN line 176: "Fix the scanRoom doc comment: it scans one level deep, not recursively (F3 honesty; the recursive walker is Wave 1, not this task)". (b) The pack, section 3.2 line 80, lists "F3. The fractal ICM is invisible" as a defect (66.8 percent of artifacts in 37 rooms; 349 of 396 in this room on 2026-09-23). Section 3.4 line 103 lists "Recursive, policy-filtered, id-canonical walker for render" as DOES NOT EXIST. (c) Phase 19 and Phase 232 files contain no decision to keep the scan shallow. grep for "recursive", "one level", "nested" in 19-01-SUMMARY and 19-CONTEXT found no such decision. (d) SEED-006 (.planning/seeds/SEED-006-mindrian-wiki-sprint-the-visible-room.md, INDEX line 211) names Phase 126 as the implementing phase. .planning/phases/126-install-lifecycle-harness-gaps is a different phase. tests/ holds only test-visible-room-leak.cjs and run-all-visible-room.sh (Wave 0). No match for "Visible Room", "Phase 126" or "wiki sprint" in .planning/ROADMAP.md.
  implication: PROVEN. No record chooses the shallow scan as a design. Two records call it a defect and defer the fix to a Wave 1 walker. Wave 1 has no phase, no plan, no test. The tracking is orphaned.

- timestamp: 2026-10-12
  checked: consumers of scanRoom (grep lib/)
  found: lib/wiki/wiki-server.cjs lines 39 and 47 (live wiki and search index), lib/wiki/wiki-export.cjs (static export), lib/mcp/tools/views.cjs line 408 (MCP view_compile 'wiki', Desktop and Cowork). Other scanners exist: lib/vault/room-scanner.cjs, lib/mcp/app-views.cjs scanRoomData, scripts/generate-snapshot.cjs.
  implication: PROVEN by reading. One shallow scanner feeds three published surfaces. The fix would need to respect tests/test-270-no-second-walker.cjs (a census that rejects a new hand-rolled recursive walker) and reuse lib/core/section-registry.cjs discoverSections or the reconcile-memory-runner walker (pack line 96). Not verified by running.

### What the wiki user loses today

In the measured room the wiki shows and searches 61 of 424 files (14.4 percent); the other 363 files, including all 90 decision 16 nested artifacts, have no page and no search hit.

### Classification

ITEM 5: known tracked bug - SEED-006 pack finding F3 (research/2026-07-07-fable-max-pack/seed-visible-room-wiki/seed-visible-room-wiki.md section 3.2), deferral recorded in quick 260923-lu5 PLAN line 176. Not a design decision: no record chooses the shallow scan. No .planning/debug slug exists. The owner is orphaned (SEED-006 names Phase 126, now a different phase), so the navigator should reassign it.

## ITEM 7: search doors and Canon Part 7

### Doors confirmed at HEAD (file and function)

| # | Door | Where |
|---|------|-------|
| D1 | MCP room_search | lib/mcp/tools/room.cjs, register line 612, searchRoomDetailed line 521 |
| D2 | Wiki flexsearch (/mos:wiki search, GET /api/search) | lib/wiki/wiki-search.cjs buildSearchIndex line 18, search line 55; lib/wiki/wiki-server.cjs lines 43, 131, 188 |
| D3 | MCP graph_query | lib/mcp/tools/graph.cjs graphQuery line 118, register line 187 |
| D4 | MCP room_graph command graph-query (SQL) | lib/mcp/tool-router.cjs line 1212 to 1238; lib/core/graph-ops.cjs queryGraph line 109 |
| D5 | MCP context_assemble (neighborhood leg) | lib/mcp/tools/context.cjs line 87, calls navigation.getRoomContext line 136 |
| D6 | /mos:graph (natural language to SQL by Larry) | commands/graph.md line 50, 101 |
| D7 | /mos:query | commands/query.md: deprecated alias, redirects to /mos:graph via scripts/soft-alias-runner.cjs; frontmatter says removal v1.14.0; plugin is 2.0.0-beta.66 |

Dropped (exist, but not a "find X in this room" door): MCP room_artifact (lib/mcp/tools/artifact-read.cjs: reads one .md by exact relative path), MCP whitespace_scan (lib/mcp/tools/sensors.cjs line 385: gap scan, findOpenQuestions and findUnsupportedClaims), /mos:show (commands/show.md: router to view commands). Internal, not a door: lib/core/semantic-index/tri-modal-index.cjs (FTS5 + BM25 projection table eureka_fts over room.db nodes, consumed by Eureka, navigation-engine, lazygraph-ops, research; no MCP tool or command exposes it as search; UNVERIFIED whether it is populated in any real room).

### Door matrix

| Cell | D1 room_search | D2 wiki flexsearch | D3 graph_query | D4 room_graph graph-query | D5 context_assemble |
|------|----------------|--------------------|----------------|---------------------------|---------------------|
| Input | literal phrase (whole query, lowercase substring), else query words (stopwords and tokens under 3 chars dropped), optional section (room.cjs 521-531, 413-420) | words, forward-prefix tokens (wiki-search.cjs 19, resolution 9) | node id, or session focus node (graph.cjs 118-136) | raw SQL string (tool-router 1214, 1237) | none or focus_node_id plus budget numbers (context.cjs 91-115) |
| Index | none; walks the disk on every call; word tier walks again on zero phrase hits (room.cjs 273, 523, 528) | in-memory FlexSearch Index, built at server start and on each /wiki home visit and rebuild (wiki-server 43, 49); not persisted | room.db nodes and edges via navigation.openRoomDbForCaller | room.db via lazygraph.openGraph (graph-ops 110); no FTS in this route, caller writes LIKE or json_extract | room.db via navigation.getRoomContext |
| Coverage | .md, .htm, .html (SEARCH_EXT line 113); recursive; dot-entries and symlinks skipped; file cap SEARCH_MAX_FILES=500 (lines 84, 277, 289; cap behaviour belongs to cluster A); html de-tagged; root identity files (STATE.md, MINTO.md, ROOM.md, USER.md) are searchable | .md only; scanRoom pages only: root non-private + section/*.md; 61 of 424 in the measured room; no html; root identity files excluded | graph nodes only; measured room.db holds 28 Artifact nodes (27 of 28 ids have 3 path segments) against 424 .md files; also 3,444 claim, 159 memory_artifact nodes | graph nodes and edges only; same store as D3 | graph legs only; description: "Never returns raw file contents" |
| Ranking | phrase tier: log1p(match count) x 0.7 + recency x 0.3 (room.cjs 373-378); word tier: BM25 with idf_share floor 0.55 and min(2, words) distinct words (510-512) | FlexSearch internal score; limit 20; no recency, no floor | getNeighborhood topK (default 20), depth max 5; exact scoring UNVERIFIED | none; SQL order | ranked neighborhood, topK default 10 |
| Result shape | {file, line, snippet, match_count, words_matched, extracted?}; at most 50 rows; carries tier, words, reason_code, reason when empty (room.cjs 633-638) | {id, title, section, excerpt with mark tags}; empty list has no reason | {focus_node_id, results}; with no focus: empty list plus a note | {success, rows, count} | state, fragments, neighborhood, cortex nodes, brief |
| Consumers | MCP tool, one server. Registered in code (PROVEN); reach on CLI, Desktop and Cowork ASSUMED from the one-server design | CLI only (local Express server). Desktop and Cowork get only the view_compile page summary, no search (views.cjs 408-419) | MCP | MCP; D6 and D7 reach the same store from CLI | MCP |
| Part 8 posture | local only; 0 Brain-client references in room.cjs (PROVEN by grep) | local only; 0 references in wiki-search.cjs | local only; 0 references | local only; 0 references in graph-ops.cjs | local only; description says zero Brain calls; 0 references |

Other facts:
- PROVEN by grep over lib, scripts, hooks, bin, commands, skills, agents: no code outside room.cjs calls searchRoom or searchRoomDetailed. The other files that contain "room_search" hold comments or skill text only. context_assemble does not call room_search. The sweep file Scope line 84 ("context_assemble ... inherit items 2 and 3") is wrong at HEAD. Items 2 and 3 reach users only through the room_search tool call.
- searchRoomDetailed is exported only under `_internal` (room.cjs line 682-685), not as a public module export.
- room_search was added 2026-07-09 (commit 8a21c44c5, Phase 198-04), 3.5 months after the wiki flexsearch (2026-03-26). grep of .planning/phases/198-* for "flexsearch" or "wiki-search" found no file: no recorded reason why a second lexical door was needed. The 261012-kfn plan cites Canon Part 7 only for reusing the walker guards (PLAN line 130).
- The 261012-kfn word tier copied its stopword list from the spike prototype (PLAN line 209). lib/core/semantic-index/lexical-overlap.cjs holds a separate frozen, versioned STOPWORDS list (jaccard-v1) for a different job. The word tier also hand-rolls BM25 while tri-modal-index.cjs holds FTS5 BM25 over nodes. Both are small Part 7 notes, not defects. Repointing the list would change the version tag, so it is not a free swap (UNVERIFIED by test).

### Overlap matrix (same question, different coverage)

| Pair | Same question | Concrete divergence |
|------|---------------|---------------------|
| D1 vs D2 | find text in a room | PROVEN: a file at section/name/name.md is returned by D1 and has no page and no hit in D2 (363 of 424 files in the measured room). html: D1 reads it, D2 never (mindrianOS holds 40 html and motj-ecosystem 35 per the sweep evidence; D2 reads .md only, scanRoom line 138). Root identity files: D1 returns them, D2 excludes them (PRIVATE_ROOT_FILES): two different skip lists, correct for a published surface, but not stated anywhere for D1. |
| D1 vs D2 | natural-language question | Spike 010: flexsearch top-5 1 of 10; room_search top-5 0 of 10 before 32fcb604b and 10 of 10 after. The spike calls the flexsearch number "a coverage result, not a ranking result". |
| D1 vs D3 | find the thing called X | A nested artifact is a file path for D1 and a graph node for D3, but only 28 Artifact nodes exist against 424 files in the measured room. A file with no node is invisible to D3. A claim node (3,444) has no file line D1 can return. Three id spaces exist: D1 room-relative file path, D2 page id section/basename (page-renderer line 161), D3 node id (pack F3 line 80 says room.db keeps full nested paths). |
| D1 vs D4 | find by text | D4 has no text index; a user must hand-write LIKE over json properties. It answers relation questions, not recall. |
| D2 vs D1 empty result | answer nothing | D1 returns a reason (no_match, below_relevance_floor, no_search_words). D2 returns an empty list with no reason. |
| D4 vs D6 vs D7 | ask the graph | Same store. D7 is a deprecated alias of D6; D6 turns words into SQL for D4's store. Removal date v1.14.0 has passed. |

### Canon Part 7 verdict (RECOMMENDATION for the navigator, not a decision)

1. Keep D1 room_search as the one lexical search: it is the only door that recurses, reads html, ranks, explains an empty answer, and reaches Desktop and Cowork.
2. Keep D3, D4, D5, D6 as they are: they answer relation questions over room.db (ids and edges), a different job from text recall.
3. Treat D2 (wiki flexsearch) as the duplicate. Reuse means: the wiki /api/search calls searchRoomDetailed(roomDir, q) and maps each result file to a page id; wiki-search.cjs and the flexsearch dependency can then retire (pack F11: flexsearch has no other requirer).
4. Cost of that repoint (UNVERIFIED): a disk walk of 56 to 170 ms at 424 files replaces a 0.1 ms in-memory lookup; searchRoomDetailed would need a public export or a move into lib/core so lib/wiki does not reach into lib/mcp/tools internals.
5. The repoint fixes search coverage only. A nested hit still has no wiki page until item 5 (the recursive walker) lands, so the two fixes should be ordered: item 5 walker first or together.
6. Retire D7 /mos:query now (its own frontmatter set removal at v1.14.0, which is past).
7. Do not reuse tri-modal FTS5 for room_search without a new measurement: it indexes nodes, not files (UNVERIFIED in a real room).

### Classification

ITEM 7: DESIGN DECISION pending navigator - no door contradicts a recorded canon rule. Canon Part 7 (docs/MINDRIAN-CANON.md line 256 and 258) is a build gate: "Before building a new command, skill, agent, or hook, the builder must search the methodology surface first ... Most features are existing features repointed", and the plan must answer "which existing surface does this replace or extend, and why is repointing insufficient?". The enumerated surface is commands, agents, pipelines, skills; wiki flexsearch is lib code, outside that list. The justification for a second lexical door (room_search, 2026-07-09) is not recorded, and no rule requires the older one to go, so the choice (repoint the wiki, or keep two doors on purpose) belongs to the navigator.

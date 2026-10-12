---
phase: quick-261012-rxc
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/mcp/tools/room.cjs
  - tests/test-room-search-walk-bound.cjs
  - tests/test-room-search-natural-language.cjs
  - tests/run-all-198.sh
  - CHANGELOG.md
  - .planning/quick/261012-rxc-room-search-walks-every-room-file-with-a/261012-rxc-verify-rooms.cjs
  - .planning/quick/261012-rxc-room-search-walks-every-room-file-with-a/261012-rxc-verify-results.json
autonomous: true
requirements: [QUICK-261012-RXC]
canon_parts: [7, 8]
tags: [room_search, walk-bound, truncated, single-walk, search-surface-qa-sweep-20261012, item-2, item-3]
user_setup: []
must_haves:
  truths:
    - "room_search reads every walkable file of a room up to a safety bound of 5,000 files (navigator shape (a), G1). On mindrianOS (1,121 walkable) and motj-ecosystem (833 walkable) the 10 cluster A beyond-cap probe terms return their file (cluster A: 0 of 10)."
    - "When a room holds more walkable files than the bound, the detailed result and the tool envelope carry truncated true, scanned equal to the bound and walkable equal to the full count, and an empty reply's reason starts with 'The search stopped at <scanned> of <walkable> files' (G1, G3)."
    - "When the walk is not truncated, the three empty-reply reason texts are byte-identical to the texts at HEAD (G3)."
    - "One room_search call reads each file once: a sentence query that falls through to the word tier calls fs.readFileSync once per walked file, not twice (G2, sweep item 3)."
    - "Every tier (phrase, words, none) and every scope (whole room, one section) returns scanned, walkable and truncated in the detailed result and in the tool envelope (G3, G4)."
    - "On rethinking-mindrianos the 261012-kfn measure still passes with equal numbers: nl top-5 10 of 10, kw top-5 9 of 10, 3 negatives empty with below_relevance_floor, median results tokens 394 and 458."
    - "A sentence query on mindrianOS (all 1,121 files) has a median under 2,000 ms over 5 runs, reported against cluster A's extrapolation of about 350 ms."
    - "The room_search description, the inputSchema describe text and the connectors export do not change; the 267 wire pins and build-connector-registry --check pass (G5). No network call, no Brain call, no npm package (Canon Part 8)."
  artifacts:
    - path: "lib/mcp/tools/room.cjs"
      provides: "5,000-file safety bound, walkable count past the bound, one scan that feeds both tiers, scanned/walkable/truncated in searchRoomDetailed and in the room_search envelope, honest truncated reason texts"
      exports: ["register", "connectors", "_internal"]
      contains: "SEARCH_MAX_FILES = 5000"
    - path: "tests/test-room-search-walk-bound.cjs"
      provides: "Fixture-room test: injected bound, term in the last file, truncated flag, exact reason texts, section scope, one read per file, envelope fields"
      min_lines: 150
    - path: "tests/test-room-search-natural-language.cjs"
      provides: "The two checks that pinned the 500-file cap now assert that file 501 is found"
      contains: "f-500.md"
    - path: "tests/run-all-198.sh"
      provides: "run_if leg for the new test next to the three room_search legs"
      contains: "test-room-search-walk-bound.cjs"
    - path: "CHANGELOG.md"
      provides: "One Fixed bullet under the Unreleased beta.66 heading"
      contains: "walkable"
  key_links:
    - from: "room_search handler in lib/mcp/tools/room.cjs"
      to: "searchRoomDetailed"
      via: "the payload copies found.scanned, found.walkable and found.truncated; the handler passes no options, so the bound is always SEARCH_MAX_FILES"
      pattern: "payload\\.truncated"
    - from: "searchRoomDetailed"
      to: "scanSearchScope"
      via: "exactly one scan per call feeds the phrase tier and the word tier"
      pattern: "scanSearchScope\\("
    - from: "scanSearchScope, collectMatches, collectWordStats"
      to: "walkSearchFiles"
      via: "one shared walker keeps the sort, dot skip, WR-19 symlink skip, isRealpathContained, the html pass and the bound"
      pattern: "walkSearchFiles\\("
    - from: ".planning/spikes/010-leviathan-search-vs-room-search/run.cjs and 261012-kfn-measure.cjs"
      to: "_internal.searchRoom, _internal.scoreWordTier"
      via: "unchanged signatures and return shapes"
      pattern: "scoreWordTier\\(scopeDir, roomDir, words\\)"
---

<objective>
room_search reads every file of a large room, reads each file once, and says so when a safety bound stops it.

Today the walk stops after 500 files in sorted name order. On mindrianOS it never opens 621 of 1,121 files, and on motj-ecosystem 333 of 833. A term that lives only in those files comes back with the false reason "No file contains this exact text or any of its search words." (sweep item 2, cluster A: 10 of 10 false negatives). A sentence query also walks and reads the room twice (sweep item 3).

The navigator chose shape (a) on 2026-10-12. The goal items are:
- G1. Walk every walkable file. Replace the 500 cap with a 5,000-file safety bound that sets truncated when it is hit.
- G2. One walk feeds both tiers. Read each file once. Keep the per-file phrase lines and word stats from that read.
- G3. The detailed result and the tool envelope gain scanned, walkable and truncated. When truncated, the empty-reply reasons say where the walk stopped. When not truncated, the texts stay byte-for-byte.
- G4. Section scope keeps the same behavior with the same fields.
- G5. Do not change the tool description, the inputSchema or the connectors export (owned by quick 261012-rew, already committed as e54d85ec2).
- G6. One Fixed bullet in CHANGELOG.md under the Unreleased heading.

Purpose: Larry gets a true answer from a big room, or an honest statement that the search stopped early. Never a confident false "no file contains this".
Output: changed lib/mcp/tools/room.cjs, new tests/test-room-search-walk-bound.cjs and its run_if leg, two changed checks in tests/test-room-search-natural-language.cjs, one CHANGELOG bullet, and a read-only real-room verification record in this quick folder.

Order: this plan runs after quick 261012-rew (done) and quick 261012-rey (hook budget, does not touch room.cjs). Quick 261012-ri7 runs after this plan.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@lib/mcp/tools/room.cjs
@tests/test-room-search-natural-language.cjs
@.planning/debug/search-surface-qa-sweep-20261012/cluster-a/common.cjs

Read only these line ranges (do not read the whole files):
- .planning/debug/search-surface-qa-sweep-20261012.md: the Items rows 2 and 3, "Technical Root Cause / Item 2", "Required Code Changes / Item 2".
- .planning/debug/search-surface-qa-sweep-20261012/cluster-a/item2-cap.cjs lines 12-20 (realHandlerFor) and lines 59-90 (the seeded probe pick).
- .planning/debug/search-surface-qa-sweep-20261012/cluster-a/item3-latency.cjs lines 10-31 (time, countIO) and lines 39-68 (query derivation).
- tests/run-all-198.sh lines 97-118 (the three room_search run_if legs).
- CHANGELOG.md lines 1-10 (the Unreleased heading and its Fixed list).
- tests/test-369-read-surfaces.cjs lines 262-302 (WR-19, the handler call shape).

Do NOT read .planning/debug/search-surface-qa-sweep-20261012/cluster-a/private/. It holds room paths and probe terms from venture rooms. The verification re-derives the probes in memory with the same seeded method.

## State at planning time (re-check at execution time)
- HEAD 656d986bd. room.cjs is 687 lines. Quick 261012-rew changed the description (about line 616) and the query describe text (about line 619). Do not edit these lines. Do not edit the connectors array (about lines 649-677). Line numbers below are from HEAD and can move.
- SEARCH_MAX_FILES = 500 at line 84. walkSearchFiles at lines 273-336, with `if (scanned >= SEARCH_MAX_FILES) return;` at lines 277 and 289. collectMatches at 340. collectWordStats at 431. scoreWordTier at 472. emptyResult at 515. searchRoomDetailed at 521. The handler payload at 633-638. SEARCH_REASONS at 148-152.
- tests/test-room-search-natural-language.cjs lines 165-167 pin the 500 cap: "word in file 501 is not found" and "word in file 501: no_match". Its header line 10 says "never reads past the 500-file walk bound". Its envelope checks test presence of keys, not the key set, so new envelope keys do not break it.
- tests/test-room-search-rank-before-cap.cjs (61 files) and tests/test-room-search-html-blindness.cjs (rooms of a few files) do not depend on the 500 bound. They must pass with no edit.
- The 267 snapshot tests pin tools/list only. tests/test-267-mcpv2-zod4-contract.cjs compares tests/fixtures/267/wire-snapshot-zod3.json; tests/test-267-mcpv2-dual-era.cjs calls listTools and calls only gate_render. A new envelope field does not move any snapshot (PROVEN by reading both tests).
- CHANGELOG.md line 1 is `## [Unreleased] -- v2.0.0-beta.66 (in progress)`. A `### Fixed` list exists under it (the 261012-rew bullet). Quick 261012-rey can add a bullet before this plan runs.
- After 261012-rey, its plan expects `bash tests/run-all-198.sh` to report Passed 17, Failed 0. Read .planning/quick/261012-rey-on-stop-adapter-line-budget-re-based-to-/261012-rey-SUMMARY.md at execution time to confirm.

## Decisions made in planning (binding for the executor)

### P1: the safety bound is 5,000 files (G1)
- SEARCH_MAX_FILES = 5000.
- Reason, from cluster A (item 3 fit over 33 points, R2 0.908): the most costly call today is a two-walk miss at 0.45 ms + 0.312 ms per file. At 5,000 files that is about 1,560 ms, under the 2,000 ms hook reference line. The single scan of P4 is cheaper per file, so the margin is larger. 5,000 is 4.5 times the largest room on this machine (1,121 walkable files).
- room_search is in no hook. The bound protects a long-lived MCP server from a room that is bound to a very large tree.

### P2: walkable is counted past the bound, without a read (G1, G3)
- walkSearchFiles keeps one walk. Remove the two early returns at the bound. Keep listing directories after the bound.
- For each entry, keep today's filter order: dot skip, symlink skip, directory recursion, the SEARCH_EXT allowlist, isRealpathContained. A file that passes every filter adds 1 to walkable.
- When scanned is below the bound, add 1 to scanned and read the file as today (readFileSync, statSync, split, html pass, onFile with the same object shape). When scanned has reached the bound, do not read, do not stat and do not call onFile.
- Return { scanned, walkable, truncated }, with truncated = walkable > scanned. A room with exactly 5,000 walkable files is not truncated.
- scanned keeps today's meaning: files counted against the bound, which is files read. A file that throws on read still counts, as it does today.
- Cost past the bound: one readdirSync per directory and one realpath check per candidate file. No read. This cost exists only in a room above 5,000 walkable files. The count uses the same filters, so walkable equals the number of files a lifted bound would read.

### P3: the bound is injectable through an options argument, not an env var and not a setter
- New optional last parameter: walkSearchFiles(scopeDir, roomDir, onFile, options) and searchRoomDetailed(roomDir, query, section, options). options.maxFiles overrides SEARCH_MAX_FILES when it is an integer of 1 or more (Number.isInteger). Any other value (0, negative, fraction, string, NaN, null, missing) uses SEARCH_MAX_FILES.
- Why not an env var: it would be a new knob on all three surfaces. Desktop and Cowork users cannot easily set server env. It needs a docs/ENV-TUNING.md entry, which is outside this task's file limit. A shared environment could raise it and remove the safety bound.
- Why not an exported setter: it is process-global mutable state in a long-lived MCP server that serves several sessions. A test that forgets to reset it leaks into later checks.
- The options argument is per call, pure, and not reachable from MCP input. The inputSchema is pinned (G5) and the handler passes no options. No caller can raise the bound. The test passes { maxFiles: 10 }.

### P4: one scan feeds both tiers (G2)
- New function scanSearchScope(scopeDir, roomDir, needle, words, options). It calls walkSearchFiles once. For each delivered file it runs one loop over searchLines. Per line it computes the lower-cased line once and uses it for both passes.
- Phrase pass (only when needle is a non-empty string): the existing collectMatches per-line logic, unchanged: includes(needle), matchCount, the seen set, SEARCH_MAX_MATCHES_PER_FILE, snippet trim then slice(0, 200), the record { file, mtimeMs, matchCount, matches } and extracted: true for html only.
- Word pass (only when words is an array): the existing collectWordStats per-line logic, unchanged: tokens by SEARCH_WORD_RE on the lower-cased line, dl, the tf Map, lineHits, the best-line rule, docCount += 1 per delivered file, totalLen += dl.
- Short-circuit: when needle is given and a file has a phrase hit, the word tier can never run (D1 of 261012-kfn: words only on zero phrase hits). From that point, set the word stats to null and do not tokenize any later file. The output is unchanged, because the word stats are only read when the phrase tier is empty. This keeps a keyword phrase-hit query close to today's cost.
- Return { phrasePerFile, wordStats, scanned, walkable, truncated }. wordStats is { docCount, totalLen, perFile }, or null when words was null or a phrase hit happened.
- Thin wrappers keep their signatures and outputs:
  - collectMatches(scopeDir, roomDir, needle) returns scanSearchScope(scopeDir, roomDir, needle, null).phrasePerFile.
  - collectWordStats(scopeDir, roomDir, words) returns scanSearchScope(scopeDir, roomDir, null, words).wordStats.
  - Move the BM25 body of scoreWordTier into a pure function scoreWordStats(stats, words). scoreWordTier(scopeDir, roomDir, words) returns scoreWordStats(collectWordStats(scopeDir, roomDir, words), words). The kfn measure script and tests/test-room-search-natural-language.cjs call scoreWordTier directly.
- searchRoomDetailed(roomDir, query, section, options): resolve scopeDir as today. Compute words = queryWords(query) first. Call scanSearchScope once with needle query.toLowerCase() and words (pass null when words is empty, so no line is tokenized). Then apply today's tier logic on the scan output: phrase = rankMatches(phrasePerFile); words empty gives no_search_words; scoreWordStats(wordStats, words) empty gives no_match; the floor gives below_relevance_floor; else the word rows as today.
- Keep every BM25 and floor constant. Keep rankMatches unchanged. On a room under the bound the results must be identical to HEAD (the kfn measure proves it on rethinking-mindrianos, 424 files).

### P5: result shape and exact reason texts (G3, G4)
- searchRoomDetailed returns { tier, words, results, scanned, walkable, truncated }, plus reason_code and reason when results is empty. This holds for the phrase, words and none tiers, and with or without a section.
- emptyResult(words, code, walk): reason is SEARCH_REASONS[code] when walk.truncated is false (byte-identical to HEAD). When walk.truncated is true, reason is the prefix plus the truncated sentence for the code.
- The prefix: "The search stopped at S of W files, so K files were not read. " where S is scanned, W is walkable and K is W minus S, written as plain digits. When K is 1, the middle reads "so 1 file was not read. ".
- New frozen object SEARCH_REASONS_TRUNCATED, exact text:
  - no_search_words: "None of the files it read contains this exact text, and the question has no words left to search for once common words and very short words are set aside."
  - no_match: "None of the files it read contains this exact text or any of its search words."
  - below_relevance_floor: "Some files it read share a few words with the question, but none matches enough of it to be an answer."
- Full example with S 10, W 13, code no_match: "The search stopped at 10 of 13 files, so 3 files were not read. None of the files it read contains this exact text or any of its search words."
- Planner discretion, stated: the navigator named no_match and below_relevance_floor. no_search_words also says "No file contains this exact text", which is equally unproven on a truncated walk, so it gets the same treatment. The main session can strike the no_search_words entry without touching the rest.
- A truncated reply with results carries the three fields and no reason text, as today for non-empty results.
- The room_search envelope: { room_dir, query, tier, results }, then words when tier is not 'phrase', then scanned, walkable, truncated on every reply, then reason_code and reason when results is empty. The error path is unchanged. The handler calls searchRoomDetailed with 3 arguments only.
- Envelope cost: the three fields add about 60 characters (about 15 tokens, chars/4) to each reply. Report the measured figure in the SUMMARY.

### P6: the one pinned assertion that changes in an existing test
- tests/test-room-search-natural-language.cjs lines 165-167 assert that the word in file 501 of a 501-file room is NOT found and gives no_match. That pins the 500 cap, which is the defect (sweep item 2). With the 5,000 bound the file is found.
- Replace the two checks, keeping the check count at 50:
  - "word in file 501 is found (quick 261012-rxc reads every file up to 5,000)": pastb.results includes a row with file 'f-500.md'.
  - "501-file room: scanned 501, walkable 501, truncated false": pastb.scanned is 501, pastb.walkable is 501, pastb.truncated is false.
- Change header line 10 from "never reads past the 500-file walk bound" to "reads every file of a 501-file room (5,000-file bound, quick 261012-rxc)". The truncation behavior moves to the new test with an injected bound.
- Do not edit tests/test-room-search-rank-before-cap.cjs or tests/test-room-search-html-blindness.cjs.

### P7: memory bound (G2)
- One file's text is in memory at a time, as today. Per call, the kept data is: one phrase record per file with a phrase hit, at most SEARCH_MAX_MATCHES_PER_FILE (200) lines of at most 200 characters; and, until the first phrase hit, one word record per file that holds a query word, a tf Map of at most the query word count (a 500-character query gives at most 125 words) and SEARCH_WORDS_LINES_PER_FILE (1) line of at most 200 characters.
- Bound in files x lines kept: scanned x (200 + 1) lines of at most 200 characters, with scanned at most 5,000. Each kept line is a distinct line of a file read, so the kept text never exceeds the text of the files read (about 8.0 MB for the 1,121 files of mindrianOS). The per-file caps do not change; only the file count can grow, from 500 to 5,000.

### Surfaces and canon
- Tri-Polar: room_search is one read-only MCP tool. It behaves the same on Claude Code CLI, Claude Desktop and Cowork. No hook, no surface-specific code. The tools/list description is the only carrier of tool guidance (sweep cluster D), and it does not change here.
- Canon Part 8: local files only. No Brain call, no network call, no npm package. tests/test-198-local-only.test.cjs forbids these tokens in room.cjs: mindrian-brain, onrender, brain-router.cjs, brain-client.cjs, axios. Do not write them, also not in comments.
- Canon Part 7: reuse the one walker (walkSearchFiles), htmlLinesToText, isRealpathContained, safeResolveSection. Do not add a second walker. The verification reuses cluster A's common.cjs.
- Dev-research compositing: the navigator constraint "Do not edit any room" applies. This plan files nothing in rethinking-mindrianos. Record that in the SUMMARY.

## Baselines (cluster A, 2026-10-12, read-only, before this change)
- Walkable files: mindrianOS 1,121, motj-ecosystem 833, rethinking-mindrianos 424. The walker visited 500, 500 and 424.
- Beyond-cap probes: 0 of 10 found (5 per big room, seeded pick, mulberry32 seed 42). In-cap controls: 9 of 9 found.
- Unreachable by any query or section scope: 43 (mindrianOS) and 236 (motj-ecosystem) files.
- Reads per sentence query: 2 per file (1,000 reads for 500 files).
- Latency medians (500 files walked, two walks): mindrianOS keyword phrase-hit 54.5 ms, sentence word tier 197.7 ms, below floor 197.0 ms. Extrapolation for all 1,121 files, two walks: about 350 ms (UNVERIFIED in cluster A). Public sources: cluster-a/item2-results.json and cluster-a/item3-results.json.
- 261012-kfn measure on rethinking-mindrianos: nl top1 9, top5 10, zero-hit 0, median 394 tokens; kw top1 5, top5 9, zero-hit 0, median 458 tokens; negatives 0.15, 0.28, 0.35, all below_relevance_floor.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Write the failing walk-bound fixture test and register it (RED)</name>
  <files>tests/test-room-search-walk-bound.cjs, tests/run-all-198.sh</files>
  <behavior>
    - Guard: _internal.SEARCH_MAX_FILES is 5000 and _internal.scanSearchScope is a function. Otherwise print "FAIL: test-room-search-walk-bound -- walk bound not exported" and exit 1 (the RED state).
    - Fixture room T: ROOM.md, research/r-00.md to research/r-11.md, so 13 walkable files in walk order ROOM.md, r-00, ..., r-11. The term zzlastterm is only in research/r-11.md, the last file.
    - Excluded entries that must not count in walkable: research/notes.txt (extension), .mindrian/hidden.md (dot directory), research/zz-link.md (a symlink to a file in an outside temp dir O).
    - Bound in place: searchRoomDetailed(T, 'zzlastterm', null, { maxFiles: 10 }) gives tier 'none', results [], reason_code 'no_match', scanned 10, walkable 13, truncated true, and reason exactly "The search stopped at 10 of 13 files, so 3 files were not read. None of the files it read contains this exact text or any of its search words."
    - Bound lifted: searchRoomDetailed(T, 'zzlastterm', null) gives tier 'phrase', a row with file research/r-11.md, scanned 13, walkable 13, truncated false, and no reason_code key.
    - Bound equal to the room: { maxFiles: 13 } gives truncated false, scanned 13, walkable 13. { maxFiles: 12 } on the no_match query gives a reason that starts with "The search stopped at 12 of 13 files, so 1 file was not read. ".
    - Invalid bound values 0, -1, 2.5, '10', NaN and null each fall back to the default: truncated false and r-11 found.
    - below_relevance_floor: the question 'What is the quarterly revenue forecast for the bakery franchise?' gives below_relevance_floor. Without a bound, reason equals the HEAD text byte-for-byte. With { maxFiles: 10 }, reason equals "The search stopped at 10 of 13 files, so 3 files were not read. Some files it read share a few words with the question, but none matches enough of it to be an answer."
    - no_match without a bound: query 'zzunknownword qqmissingterm' gives reason equal to the HEAD text "No file contains this exact text or any of its search words." byte-for-byte.
    - no_search_words: query 'What is it about, and why?' gives the HEAD text without a bound, and with { maxFiles: 10 } gives "The search stopped at 10 of 13 files, so 3 files were not read. None of the files it read contains this exact text, and the question has no words left to search for once common words and very short words are set aside."
    - Truncated with results: query 'plain filler text' with { maxFiles: 10 } gives tier 'phrase', non-empty results, truncated true, scanned 10, walkable 13, and no reason_code key.
    - Section scope: searchRoomDetailed(T, 'zzlastterm', 'research', { maxFiles: 10 }) gives scanned 10, walkable 12, truncated true and reason "The search stopped at 10 of 12 files, so 2 files were not read. None of the files it read contains this exact text or any of its search words." Without a bound it finds research/r-11.md with scanned 12, walkable 12, truncated false.
    - Walker: walkSearchFiles(T, T, cb, { maxFiles: 10 }) calls cb 10 times and returns { scanned: 10, walkable: 13, truncated: true }. walkSearchFiles(T, T, cb) calls cb 13 times and returns { scanned: 13, walkable: 13, truncated: false }.
    - One read per file: with fs.readFileSync wrapped, the sentence query 'Which file holds the zzlastterm marker?' gives tier 'words' with research/r-11.md first, and reads 13 distinct fixture files exactly once each. With { maxFiles: 10 } it reads 10 distinct files once each and never reads r-09, r-10 or r-11. No read path is under O.
    - Tool envelope (handler from register, CLAUDE_ACTIVE_ROOM = T): query 'zzlastterm' gives room_dir T, tier 'phrase', scanned 13, walkable 13, truncated false. The bakery question gives tier 'none', truncated false, reason_code 'below_relevance_floor' and the HEAD reason text. The sentence query gives tier 'words' with the three fields.
    - Static: the test file holds no em-dash (U+2014) and no en-dash (U+2013).
  </behavior>
  <action>
Create tests/test-room-search-walk-bound.cjs. Copy the structure of tests/test-room-search-natural-language.cjs: 'use strict', node:assert, node:fs, node:os, node:path only, a check(label, cond) helper that counts passes, an async main() that exits 1 on a thrown assertion with the failed label, and the last line "PASS: test-room-search-walk-bound -- N checks". Write no em-dash and no en-dash.

Set the hermetic environment first, before any require of repo code, the same as the natural-language test lines 25-31: a temp HOME from fs.mkdtempSync(path.join(os.tmpdir(), 'mos-room-walk-home-')), then HOME, USERPROFILE, MINDRIAN_ROOMS_HOME (HOME/rooms), delete CLAUDE_CODE_SESSION_ID and CLAUDE_ACTIVE_ROOM.

Require ../lib/mcp/tools/room.cjs. If the require throws, print a SKIP line and exit 0, as the neighbor tests do. Then apply the guard from the behavior block (FAIL and exit 1, never SKIP, when the export is missing or SEARCH_MAX_FILES is not 5000).

Build T with fs.mkdtempSync(path.join(os.tmpdir(), 'mos-room-walk-')) and O with fs.mkdtempSync(path.join(os.tmpdir(), 'mos-room-walk-out-')). Write exactly (a backslash-n means a newline):
- T/ROOM.md: "# Walk bound fixture\nA room for the walk bound test.\n"
- T/research/r-00.md: "# Budget note\nThe forecast for next year is flat.\n"
- T/research/r-01.md to T/research/r-10.md (two-digit, zero-padded): "# Filler i\nplain filler text\n"
- T/research/r-11.md: "# Last file\nThis file holds the zzlastterm marker.\n"
- T/research/notes.txt: "zzlastterm in a text file\n"
- T/.mindrian/hidden.md: "zzlastterm in a dot folder\n"
- O/outside.md: "zzlastterm outside the room\n", then fs.symlinkSync(path.join(O, 'outside.md'), path.join(T, 'research', 'zz-link.md')).

Use path.join('research', 'r-11.md') for expected file values, so the test holds on Windows separators.

Copy the three HEAD reason strings from room.cjs SEARCH_REASONS (lines 148-152) into the test as literals. Write the six truncated strings exactly as the behavior block gives them. Compare reasons with strict equality, not includes (the 1-file case checks startsWith on the prefix).

Count reads: save the original fs.readFileSync, replace it on the fs module object with a wrapper that records each string path that contains path.basename(T) or path.basename(O), and restore it in a finally block. Match on the basename, not the full prefix, because a temp dir can resolve through a symlink on macOS. room.cjs calls fs.readFileSync through the same module object, so the wrapper sees its reads.

For the envelope, capture the room_search handler with the fake-server pattern of the natural-language test lines 185-190 (registerTool stores name to handler; room.register(fakeServer, {})). Set CLAUDE_ACTIVE_ROOM to T before you call the handler. Check room_dir equals T first, and put the resolved value in the label when it differs.

At the end, remove T, O and the temp HOME with fs.rmSync(..., { recursive: true, force: true }) in try blocks.

Register the test in tests/run-all-198.sh. Re-read lines 97-120 first. Add one run_if block directly after the "SPEC-2 room_search natural-language word tier" block. Gate it on lib/mcp/tools/room.cjs. Label: "SPEC-2 room_search walks every file up to 5,000 and reports truncation (quick 261012-rxc)". Command: node tests/test-room-search-walk-bound.cjs. Add a 3-line comment above it in the style of the neighbor blocks. Use hyphens only.

Run the test. It must exit 1 with the FAIL guard line (RED).

Commit (RED). Run git add -- tests/test-room-search-walk-bound.cjs (one explicit path; the new file must be known to git). Then run git commit --only with three -m paragraphs: subject "test(quick-261012-rxc): add failing room_search walk-bound test (truncated signal, one read per file)", a body line "RED: room.cjs does not export the 5,000 bound or the single scan yet.", and the trailer "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" as the last paragraph. Pass the paths after --: tests/test-room-search-walk-bound.cjs tests/run-all-198.sh. Do not use git add -A or git commit -a. Then run git merge-base --is-ancestor on the new sha and HEAD (peer-session guard).
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && out="$(node tests/test-room-search-walk-bound.cjs 2>&1)"; rc=$?; test "$rc" -eq 1 && printf '%s\n' "$out" | grep -q "FAIL: test-room-search-walk-bound -- walk bound not exported" && grep -c "test-room-search-walk-bound.cjs" tests/run-all-198.sh && ! grep -nP "[\x{2013}\x{2014}]" tests/test-room-search-walk-bound.cjs tests/run-all-198.sh && git show --stat --format=%s HEAD | grep -E "test-room-search-walk-bound|run-all-198" && git log -1 --format=%B | tail -1 | grep -qx "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"</automated>
  </verify>
  <done>The new test exits 1 with "FAIL: test-room-search-walk-bound -- walk bound not exported" on the unchanged room.cjs. tests/run-all-198.sh holds exactly 1 new run_if leg for it. The RED commit holds only these 2 paths and ends with the Sonnet 5.5 trailer. Neither file holds an em-dash or an en-dash.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Lift the cap to a 5,000-file bound, scan once for both tiers, add scanned/walkable/truncated (GREEN)</name>
  <files>lib/mcp/tools/room.cjs, tests/test-room-search-natural-language.cjs, CHANGELOG.md</files>
  <behavior>
    - tests/test-room-search-walk-bound.cjs passes (GREEN).
    - tests/test-room-search-natural-language.cjs passes with only the P6 change (50 checks).
    - tests/test-room-search-rank-before-cap.cjs and tests/test-room-search-html-blindness.cjs pass with no edit.
    - tests/test-369-read-surfaces.cjs (WR-19a/b/c), tests/test-198-contract-schema.test.cjs, tests/test-198-local-only.test.cjs, tests/test-267-mcpv2-zod4-contract.cjs, tests/test-267-mcpv2-dual-era.cjs and tests/test-234-tool-description-floor.cjs pass. node scripts/build-connector-registry.cjs --check passes.
    - The diff of room.cjs touches no description string, no describe() text and no connectors field.
  </behavior>
  <action>
Re-read lib/mcp/tools/room.cjs at HEAD before you edit it. Quick 261012-rew changed lines near 616 and 619. Do not edit the room_search description, the query or section describe text, or the connectors array.

Step 1, the bound (per P1, G1). Set SEARCH_MAX_FILES to 5000. Replace its trailing comment with a 3 to 5 line comment that states the number and the reason from P1 (cluster A slope 0.312 ms per file for the two-walk miss, about 1,560 ms at 5,000, under the 2,000 ms reference line; 4.5 times the largest room measured, 1,121 files). Update the RANK-THEN-CAP comment block (lines 62-83) where it says the walk scans "up to the SEARCH_MAX_FILES cost bound": say that the walk reads every file up to the safety bound, counts the rest, and reports scanned, walkable and truncated. Keep it short.

Step 2, the walker (per P2, P3). In walkSearchFiles(scopeDir, roomDir, onFile, options): resolve the bound once (options.maxFiles when Number.isInteger and at least 1, else SEARCH_MAX_FILES). Add a walkable counter. Remove the two early returns at the bound. After the isRealpathContained check, add 1 to walkable. If scanned has reached the bound, continue to the next entry without a read, a stat or an onFile call. Otherwise keep today's code path unchanged (scanned += 1, read with its catch, stat with its catch, split, html pass with its catch-and-skip, onFile with the same object). Return { scanned, walkable, truncated: walkable > scanned }. Keep the sort, the dot skip, the WR-19 symlink skip and its comment. Update the comment above the function to say what it returns and that it counts past the bound without a read.

Step 3, the single scan (per P4, G2). Add scanSearchScope(scopeDir, roomDir, needle, words, options) exactly as P4 describes, with the short-circuit on the first phrase hit. Lower-case each line once and use it for both passes. Keep the phrase record and the word record rules byte-for-byte equal to collectMatches and collectWordStats at HEAD. Rewrite collectMatches and collectWordStats as the thin wrappers of P4. Split scoreWordTier into the pure scoreWordStats(stats, words) plus the wrapper. scoreWordStats returns [] when stats is null, docCount is 0 or perFile is empty. Update the comment above collectWordStats: one scan, one file's lines in memory at a time, and the P7 memory bound in 2 to 3 lines.

Step 4, the result shape and reasons (per P5, G3, G4). Add SEARCH_REASONS_TRUNCATED next to SEARCH_REASONS with the three exact strings from P5. Do not change any SEARCH_REASONS string. Change emptyResult to emptyResult(words, code, walk) and build the reason as P5 says (prefix with the 1-file singular case). Rewrite searchRoomDetailed(roomDir, query, section, options) as P4 describes: one scanSearchScope call, the walk fields on every return, the tier logic and the word rows unchanged. searchRoom(roomDir, query, section) keeps its 3 parameters and its array return.

Step 5, the handler (per P5). After the existing words line, set payload.scanned, payload.walkable and payload.truncated from found. Keep the reason fields after them, only when results is empty. Keep the call as searchRoomDetailed(roomDir, query, section || null) with 3 arguments. Keep the error path.

Step 6, exports. Add SEARCH_MAX_FILES, scanSearchScope and scoreWordStats to _internal. Keep every existing _internal key.

Step 7, the natural-language test (per P6). Re-read lines 160-170 and line 10. Replace the two checks at lines 166-167 with the two checks of P6, and change the header line 10 as P6 says. Change nothing else in that file.

Step 8, CHANGELOG (G6). Re-read CHANGELOG.md lines 1-15. Add one bullet at the end of the `### Fixed` list under `## [Unreleased] -- v2.0.0-beta.66 (in progress)`. If that heading has no Fixed list, add `### Fixed` after its last subsection and before `## [2.0.0-beta.65]`. Text: "- **`room_search` now searches every file in a large room, and says so when it cannot.** It used to stop after the first 500 files in name order, so in a room of 1,121 files more than half was never opened (whole late folders such as `sub-rooms`), and a word that lived only there came back as \"No file contains this exact text\". It now reads every file up to a safety bound of 5,000, reads each file once for both the exact-text pass and the word pass (a sentence query used to read the room twice), and every reply carries `scanned`, `walkable` and `truncated`. When a room holds more than 5,000 files, an empty reply says how many files the search read and how many it did not (quick 261012-rxc)." Write the quotes as plain double quotes. No em-dash, no en-dash.

Step 9, checks before the commit. Run the verify command below without the two git show parts. Run git diff -- lib/mcp/tools/room.cjs and confirm that no changed line holds description:, .describe(, hitl_why or layer_why. If a test fails because of a port defect, fix room.cjs. Do not change BM25_K1, BM25_B, SEARCH_FLOOR_*, SEARCH_WORDS_*, SEARCH_MAX_RESULTS, SEARCH_MAX_PER_FILE or SEARCH_MAX_MATCHES_PER_FILE. Do not edit the two untouched room_search tests to make them pass; stop and report instead.

Commit (GREEN). Run git commit --only with three -m paragraphs: subject "fix(quick-261012-rxc): room_search reads every room file up to a 5,000-file bound, once per file, and reports scanned, walkable and truncated", a body "Sweep search-surface-qa-sweep-20261012 items 2 and 3, navigator shape (a). Tri-Polar: one MCP tool on CLI, Desktop and Cowork; tools/list description and connectors unchanged.", and the trailer "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" as the last paragraph. Paths after --: lib/mcp/tools/room.cjs tests/test-room-search-natural-language.cjs CHANGELOG.md. Do not use git add -A or git commit -a. Then run git merge-base --is-ancestor on the RED sha and on the new sha against HEAD.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && node tests/test-room-search-walk-bound.cjs && node tests/test-room-search-natural-language.cjs && node tests/test-room-search-rank-before-cap.cjs && node tests/test-room-search-html-blindness.cjs && node tests/test-369-read-surfaces.cjs && node tests/test-198-contract-schema.test.cjs && node tests/test-198-local-only.test.cjs && node tests/test-267-mcpv2-zod4-contract.cjs && node tests/test-267-mcpv2-dual-era.cjs && node tests/test-234-tool-description-floor.cjs && node scripts/build-connector-registry.cjs --check && ! grep -nP "[\x{2013}\x{2014}]" lib/mcp/tools/room.cjs tests/test-room-search-walk-bound.cjs tests/test-room-search-natural-language.cjs && ! git show HEAD -- CHANGELOG.md | grep "^+" | grep -qP "[\x{2013}\x{2014}]" && ! git show HEAD -- lib/mcp/tools/room.cjs | grep -E "^[-+]" | grep -qE "description:|\.describe\(|hitl_why|layer_why" && git diff --quiet HEAD -- tests/test-room-search-rank-before-cap.cjs tests/test-room-search-html-blindness.cjs && grep -q "SEARCH_MAX_FILES = 5000" lib/mcp/tools/room.cjs && bash tests/run-all-198.sh 2>&1 | tail -4</automated>
  </verify>
  <done>Every listed test passes. tests/run-all-198.sh reports Failed 0 with the new leg PASSED (expected Passed 18, Failed 0, Skipped 0 once 261012-rey has landed; if 261012-rey has not landed, the only failed leg is "SPEC-5 hooks/ adapter-only budget", recorded as not this task's). The two untouched room_search tests have no diff. The room.cjs diff holds no description, describe, hitl_why or layer_why line. The GREEN commit holds exactly room.cjs, the natural-language test and CHANGELOG.md, and ends with the Sonnet 5.5 trailer.</done>
</task>

<task type="auto">
  <name>Task 3: Verify on the real rooms, read-only (probes, latency, one read per file, kfn numbers, no room write)</name>
  <files>.planning/quick/261012-rxc-room-search-walks-every-room-file-with-a/261012-rxc-verify-rooms.cjs, .planning/quick/261012-rxc-room-search-walks-every-room-file-with-a/261012-rxc-verify-results.json</files>
  <action>
Warning: room files and probe terms are private (venture rooms, real names). Do not print a room file path, a probe term or a derived query to stdout, the results JSON or the SUMMARY. Report room slugs, counts, walk indices and timings only. Do not read .planning/debug/search-surface-qa-sweep-20261012/cluster-a/private/. Do not run cluster-a/item2-cap.cjs or cluster-a/item3-latency.cjs, because they write into the cluster-a folder.

Let Q be .planning/quick/261012-rxc-room-search-walks-every-room-file-with-a. Write Q/261012-rxc-verify-rooms.cjs (CJS, Node built-ins only, no em-dash or en-dash). Set REPO = path.resolve(__dirname, '../../..'). Require the cluster A helper by absolute path: path.join(REPO, '.planning/debug/search-surface-qa-sweep-20261012/cluster-a/common.cjs'), for ROOMS, CAP (500, the old boundary, used only to choose probe terms beyond it), walkAll, searchText, rng, med, sha8, I and roomMod. It loads room.cjs from the repo, so it runs the new code. Every write of the script goes to Q/261012-rxc-verify-results.json (public: room slugs, counts, booleans, walk indices, timings) or Q/private/261012-rxc-verify-private.json (paths, terms, queries). No other write.

Part A, the walker on each room (mindrianOS, motj-ecosystem, rethinking-mindrianos). Call I.walkSearchFiles(room, room, cb) and collect the rel paths. Gate: the list equals walkAll(room).files in order, and the return is { scanned: N, walkable: N, truncated: false } with N = walkAll(room).files.length. Record N per room.

Part B, the beyond-cap probes and the controls. For each room, copy item2-cap.cjs lines 59-90 verbatim (the df map over searchText, the 7-14 letter token filter, isBeyondOnly, isInsideUnique, rng(42) with shuffled and pick, 5 beyond probes then 3 controls). The same seed and the same call order re-derive cluster A's probes when the room has not changed. Read the public file cluster-a/item2-results.json and count how many re-derived beyond probes match a cluster A beyond-boundary row on walk_index (1-based) and on sha8(term). Report that count of 10 (identity check, not a gate; a live room can change). For each probe call I.searchRoomDetailed(room, term, null). Gates: 10 of 10 beyond probes return a row whose file equals the probe file, with truncated false and scanned equal to N; 9 of 9 controls still return their file; for every beyond probe whose top-level directory name matches [a-z0-9-]+ (cluster A: all 10), a call scoped to that section returns the file. Also run the natural-language form (nlTerms joined by spaces) and report its tier and whether the file is in the results (informational, the floor can reject it).

Part C, the real handler, one call per big room. Copy realHandlerFor from item2-cap.cjs lines 12-20. Run the rooms one after the other with a distinct sessionId per call (cluster A correction). Query: the first beyond probe term of that room. Gates: room_dir equals the room, the envelope has scanned, walkable and truncated, truncated is false, scanned equals N. Record the envelope key list and the character length that the three new fields add to the JSON text.

Part D, latency and reads. For each room, copy item3-latency.cjs lines 10-31 (time, countIO) and lines 39-68 (derive the keyword, sentence and below-floor queries with rng(7) over the first CAP walked files, as cluster A did). If no sentence query is found, fail the gate with a clear message. Time I.searchRoomDetailed with 1 untimed warm-up and 5 timed runs per query; record median, min, max and tier. Run countIO once per query. Gates on mindrianOS: the sentence query median is under 2,000 ms, and for the sentence query total_reads equals distinct_files_read equals N (each file read once). Read the public file cluster-a/item3-results.json and print each median beside cluster A's median (500 files, two walks) and beside the extrapolation predicted_total_ms_if_all_walked_by_files (350 for mindrianOS, 260 for motj-ecosystem).

Exit 1 when a gate fails. Print a masked summary on stdout.

Note: node:sqlite prints an ExperimentalWarning on stderr, and it can print after the last stdout line. Grep stdout for the PASS line; do not rely on tail.

Run order:
1. Create the marker: create Q/private, then touch Q/private/rxc-marker. Never add Q/private to git.
2. Run node Q/261012-rxc-verify-rooms.cjs from the repo root.
3. Run node .planning/quick/261012-kfn-natural-language-room-search-word-split-/261012-kfn-measure.cjs. Expected: "PASS: 261012-kfn targets met (engine=room.cjs)" with nl top1 9, top5 10, zero_hit 0, median_tokens 394 and kw top1 5, top5 9, zero_hit 0, median_tokens 458, and negatives at 0.15, 0.28, 0.35. rethinking-mindrianos has 424 files, under both bounds, so every number must be equal. A different number is a port defect in Task 2: fix room.cjs in a new commit (git commit --only -- lib/mcp/tools/room.cjs, same trailer), rerun the Task 2 verify, then rerun this task.
4. Run find on the three rooms with -newer Q/private/rxc-marker -type f. Expected: no output. If it prints only .mindrian/room.db-shm or .mindrian/room.db-wal, record the line, confirm that room.db mtime did not move, and mark the cause ASSUMED another process (cluster A precedent). Any other path is a failure: list it and check whether this run wrote it (the script and room.cjs hold no write aimed at a room).

Do not commit in this task. The quick workflow commits the PLAN, the SUMMARY, the script and 261012-rxc-verify-results.json with git add -f on explicit paths. It never adds Q/private.

The SUMMARY holds: the before-and-after table (walker visits, probes found, unreachable files, reads per sentence query, latency medians against cluster A and the 350 ms extrapolation, the keyword phrase-hit median), the kfn numbers, the envelope token delta, the P1 bound reason, the P3 injection choice and why, the P5 note on no_search_words, the P7 memory bound, the no-room-write result, the Tri-Polar line, and the note that no room filing was done (navigator constraint). It names no room file path and no probe term.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && Q=.planning/quick/261012-rxc-room-search-walks-every-room-file-with-a && mkdir -p $Q/private && touch $Q/private/rxc-marker && node $Q/261012-rxc-verify-rooms.cjs && node .planning/quick/261012-kfn-natural-language-room-search-word-split-/261012-kfn-measure.cjs 2>/dev/null | grep -q "PASS: 261012-kfn targets met (engine=room.cjs)" && test -z "$(find $HOME/MindrianRooms/mindrianOS $HOME/MindrianRooms/motj-ecosystem $HOME/MindrianRooms/rethinking-mindrianos -newer $Q/private/rxc-marker -type f -not -path '*/.mindrian/room.db-shm' -not -path '*/.mindrian/room.db-wal')" && test -f $Q/261012-rxc-verify-results.json && ! grep -nP "[\x{2013}\x{2014}]" $Q/261012-rxc-verify-rooms.cjs</automated>
  </verify>
  <done>The verify script exits 0: the walker visits 1,121, 833 and 424 files (or the live counts) with truncated false; 10 of 10 beyond-cap probes and 9 of 9 controls return their file; every scoped call returns its file; the handler envelope carries the three fields on both big rooms; the mindrianOS sentence query median is under 2,000 ms and reads each file once. The kfn measure prints PASS with equal numbers. find shows no room write outside the known SQLite side files. The public results JSON holds no room file path and no probe term.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| MCP caller to room_search | The query and section are untrusted input. zod caps the query at 1 to 500 characters; SECTION_RE limits the section. The inputSchema does not change. |
| Room folder to room_search | A shared or cloned room can hold hostile symlinks, a very large tree, huge files or malformed HTML. |
| Room content to the tool result | Snippets and counts leave the process to the calling model. They must come only from files inside the room. |
| Venture rooms to planning evidence | Real-room probe terms and paths must not reach a tracked file. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-rxc-01 | Denial of service | walkSearchFiles, scanSearchScope | mitigate | The 5,000-file bound (P1) caps reads and tokenization; past the bound only readdirSync and one realpath check per file run (P2). One file's text is in memory at a time; kept lines are capped per file (P7). Task 3 measures the 1,121-file room under 2,000 ms. |
| T-rxc-02 | Information disclosure | walkable count past the bound | mitigate | The count uses the same dot skip, WR-19 symlink skip, extension allowlist and isRealpathContained as the read path. Task 1 proves a symlink to an outside file, a dot folder and a .txt file are not counted and that no path under the outside dir is read. tests/test-369-read-surfaces.cjs WR-19a/b/c still pass. |
| T-rxc-03 | Elevation of privilege | options.maxFiles | mitigate | The bound override is a function argument only (P3). The handler passes 3 arguments and the inputSchema is pinned, so no MCP caller can raise or remove the bound. Invalid values fall back to 5,000 (Task 1). |
| T-rxc-04 | Spoofing (false grounding) | empty-reply reasons | mitigate | A truncated walk never says "No file contains"; the reason states where the search stopped (P5). Untruncated texts stay byte-identical (Task 1 strict equality). |
| T-rxc-05 | Information disclosure (Canon Part 8) | room.cjs | mitigate | No network, no Brain call, no npm package. tests/test-198-local-only.test.cjs scans room.cjs for the forbidden egress tokens. |
| T-rxc-06 | Information disclosure | Task 3 evidence | mitigate | Probe terms and paths stay in memory and in Q/private (gitignored, never force-added). Public JSON and SUMMARY hold slugs, counts, walk indices and timings only. cluster-a/private is never read. |
| T-rxc-07 | Tampering | git history | mitigate | git commit --only with explicit paths after --; no git add -A or commit -a; git merge-base --is-ancestor after each commit (peer sessions share the tree). |
</threat_model>

<verification>
- node tests/test-room-search-walk-bound.cjs passes (RED first in Task 1, GREEN in Task 2).
- node tests/test-room-search-natural-language.cjs passes with only the P6 change; node tests/test-room-search-rank-before-cap.cjs and node tests/test-room-search-html-blindness.cjs pass with no edit.
- node tests/test-369-read-surfaces.cjs, tests/test-198-contract-schema.test.cjs, tests/test-198-local-only.test.cjs, tests/test-267-mcpv2-zod4-contract.cjs, tests/test-267-mcpv2-dual-era.cjs and tests/test-234-tool-description-floor.cjs pass. node scripts/build-connector-registry.cjs --check passes.
- bash tests/run-all-198.sh: Failed 0 with the new leg PASSED (or only the SPEC-5 leg failed when 261012-rey has not landed).
- Real rooms, read-only: 10 of 10 beyond-cap probes found, 9 of 9 controls found, every scoped call found, walker visits every walkable file with truncated false, handler envelope carries the three fields.
- mindrianOS sentence query: median under 2,000 ms, each file read once; reported beside cluster A's 197.7 ms (500 files, two walks) and the 350 ms extrapolation.
- 261012-kfn-measure.cjs prints PASS with equal numbers.
- find -newer the marker shows no room write (except the known SQLite side files, if any, recorded as ASSUMED other process).
- No em-dash or en-dash in the changed files or in the new CHANGELOG lines.
</verification>

<success_criteria>
- room_search opens every walkable file of rooms up to 5,000 files; the 279 files that cluster A found unreachable by any call (43 plus 236) are now reachable.
- A room above the bound reports truncated true with scanned and walkable, and an empty reply says where the search stopped.
- Untruncated reason texts are byte-identical to HEAD.
- One read per file per call.
- Description, inputSchema and connectors unchanged; 267 pins green.
- Only lib/mcp/tools/room.cjs, tests/test-room-search-walk-bound.cjs, tests/test-room-search-natural-language.cjs (2 checks and 1 comment line), tests/run-all-198.sh and CHANGELOG.md change in source. No push, no release, no version bump, no room edit.
</success_criteria>

<output>
Create .planning/quick/261012-rxc-room-search-walks-every-room-file-with-a/261012-rxc-SUMMARY.md when done.
</output>

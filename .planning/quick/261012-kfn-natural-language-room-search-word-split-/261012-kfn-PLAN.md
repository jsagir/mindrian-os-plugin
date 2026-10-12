---
phase: quick-261012-kfn
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/mcp/tools/room.cjs
  - tests/test-room-search-natural-language.cjs
  - tests/run-all-198.sh
autonomous: true
requirements: [QUICK-ROOM-SEARCH-NL]
canon_parts: [7, 8]
user_setup: []
must_haves:
  truths:
    - "A natural-language question to room_search returns the right file in the top 5 for at least 8 of the 10 spike-010 cases (planning measurement with the prototype: 10 of 10)."
    - "A 1-2 keyword query keeps the phrase-tier result when the exact phrase exists; keyword top-5 stays at 7 or more of 10 (planning measurement: 9 of 10)."
    - "The 3 spike-010 negative-control questions return an empty result with reason_code below_relevance_floor."
    - "The median results payload (chars/4, the spike-010 harness method) is 460 tokens or fewer for each form (planning measurement: nl 394, kw 458)."
    - "Every query with an exact-phrase hit returns the same results as before this change; the two existing room_search tests pass with no edit."
    - "The word tier never reads a symlink, never reads a file whose real path leaves the room, never reads past the 500-file walk bound, and reads .html files as de-tagged text."
    - "room_search makes no network call, no Brain call, and loads no new npm package (Canon Part 8)."
  artifacts:
    - path: "lib/mcp/tools/room.cjs"
      provides: "Shared file walker, word tier (BM25), relevance floor, searchRoomDetailed, tool envelope with tier/words/reason"
      exports: ["register", "connectors", "_internal"]
      contains: "searchRoomDetailed"
    - path: "tests/test-room-search-natural-language.cjs"
      provides: "Fixture-room test of the word tier, the floor, the reasons, the guards, the html pass and the tool envelope"
      min_lines: 150
    - path: "tests/run-all-198.sh"
      provides: "Registration of the new test next to the two existing room_search legs"
      contains: "test-room-search-natural-language.cjs"
  key_links:
    - from: "lib/mcp/tools/room.cjs searchRoom"
      to: "searchRoomDetailed"
      via: "searchRoom returns searchRoomDetailed(...).results (array, same signature)"
      pattern: "searchRoomDetailed\\(roomDir, query, section"
    - from: "lib/mcp/tools/room.cjs collectMatches and collectWordStats"
      to: "walkSearchFiles"
      via: "one shared walker carries the symlink skip, isRealpathContained, SEARCH_MAX_FILES and htmlLinesToText"
      pattern: "walkSearchFiles\\("
    - from: "room_search handler"
      to: "searchRoomDetailed"
      via: "handler builds { room_dir, query, tier, results } plus words and reason fields"
      pattern: "searchRoomDetailed\\("
    - from: ".planning/spikes/010-leviathan-search-vs-room-search/run.cjs"
      to: "_internal.searchRoom(ROOM, q)"
      via: "unchanged signature, array result"
      pattern: "_internal\\.searchRoom"
---

<objective>
Give room_search a natural-language tier with no new dependency.

Today room_search matches the whole lower-cased query as one literal phrase. Spike 010 measured 0 of 10 sentence questions with the right file in the top 5. This plan keeps the phrase tier exactly as it is. It adds a word tier (BM25 over the query words) that runs only when the phrase tier finds nothing. A relevance floor makes an unanswerable question return an empty result with a reason.

Purpose: Larry can ask the room a question in plain words and get the right file, and an unanswerable question gets an honest empty answer, not weak matches.
Output: changed lib/mcp/tools/room.cjs, new tests/test-room-search-natural-language.cjs, one new leg in tests/run-all-198.sh, and a measured verification record in the SUMMARY.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@lib/mcp/tools/room.cjs
@tests/test-room-search-rank-before-cap.cjs
@tests/test-room-search-html-blindness.cjs
@.planning/quick/261012-kfn-natural-language-room-search-word-split-/261012-kfn-bm25-prototype.cjs
@.planning/quick/261012-kfn-natural-language-room-search-word-split-/261012-kfn-measure.cjs
@.planning/spikes/010-leviathan-search-vs-room-search/README.md

Read only these line ranges (do not read the whole files):
- tests/test-369-read-surfaces.cjs lines 25-80 (hermetic env, fake server that captures registerTool handlers, parse helper) and lines 262-305 (WR-19 symlink checks).
- tests/run-all-198.sh lines 97-111 (the two room_search run_if legs).

## Decisions made in planning (measured, binding for the executor)

### D1: the word tier runs ONLY when the phrase tier returns zero hits
Measured on ~/MindrianRooms/rethinking-mindrianos (424 files), keyword form, with the planning prototype:
- Option A (word tier only on zero phrase hits): keyword top-5 = 9 of 10, median results tokens = 458. The 7 phrase wins are untouched. Cases 3 and 7 (zero phrase hits today) move to rank 2 and rank 1.
- Option B (append word-tier files after phrase hits): keyword top-5 = 10 of 10, but median results tokens = 492 (above the 460 target). It also mixes two tiers in one list, which needs a per-row tier marker (more tokens).
- Option A also keeps every existing test byte-identical: every existing positive assertion has a phrase hit, and every existing zero-hit assertion uses a token that the word tier cannot match either (markup-only tokens, script/style interiors, 'foobar', 'quokka' behind a symlinked directory).
Choice: Option A. Case 9 keyword ('stateless critic') stays a miss because its one phrase hit is the wrong file. Record this in the SUMMARY as a known limit.

### D2: the relevance floor (per file, applied before the top-5 cut)
A file stays in the word-tier result only when BOTH hold:
1. words_matched >= min(2, number of query words). words_matched = distinct query words found in the file.
2. idf_share >= 0.55. idf_share = (sum of IDF of the matched query words) / (sum of IDF of all query words). A query word that no file contains gets the maximum IDF, so a question about things the room never mentions loses most of its weight.
If no file passes, the result is empty with reason_code below_relevance_floor.

Measured basis (prototype on the real room):

| Query | Unfloored files | Best file words matched | Best file idf_share |
|---|--:|--:|--:|
| NEG quarterly revenue forecast for the bakery franchise | 7 | 1 of 5 | 0.15 |
| NEG how do I configure Kubernetes autoscaling | 4 | 1 of 3 | 0.28 |
| NEG what is the capital of Mongolia | 10 | 1 of 2 | 0.35 |

| Positive target through the word tier | Target words matched | Target idf_share |
|---|--:|--:|
| 10 natural-language cases | 4 of 5 to 9 of 10 (min 4) | 0.72 to 1.00 (min 0.72, case 1) |
| keyword cases 3 and 7 | 2 of 2 | 1.00 |

- The negatives top out at 1 matched word and idf_share 0.35. The positive targets start at 2 matched words and idf_share 0.72.
- 0.55 is the midpoint of the gap (0.35 to 0.72 gives 0.535), rounded up to 0.55.
- Extra probes (informational, not targets): "best pizza recipe with mozzarella" 2 of 4, 0.29, empty. "explain quantum entanglement to a child" 2 of 4, 0.50, empty at 0.55. "what is the weather in Paris today" 3 of 3, 1.00, returns the semantic-trigger research file because that file uses those words as an example. A lexical floor cannot reject a true word match. Record this as a known limit.

### D3: output budget of the word tier
At most 5 files (SEARCH_WORDS_MAX_FILES = 5), 1 line per file (SEARCH_WORDS_LINES_PER_FILE = 1). Measured: 5 files x 1 line gives a natural-language median of 394 tokens; 5 files x 2 lines gives 555 to 866 tokens per query (over budget). Both values stay inside the kept caps SEARCH_MAX_PER_FILE (5) and SEARCH_MAX_RESULTS (50).

### D4: signature and result shape
- searchRoom(roomDir, query, section) keeps its signature and still returns an ARRAY. The spike harness (.planning/spikes/010-leviathan-search-vs-room-search/run.cjs calls _internal.searchRoom(ROOM, q)) needs no change. Do not edit any spike-010 file.
- New searchRoomDetailed(roomDir, query, section) returns { tier, words, results } plus reason_code and reason when results is empty. tier is 'phrase', 'words' or 'none'.
- Phrase-tier rows are unchanged: file, line, snippet, match_count, and extracted:true for html.
- Word-tier rows: file, line (the best line), snippet (that line, trimmed, first 200 chars), match_count (number of lines in the file that hold at least one query word), words_matched (integer), and extracted:true for html.
- Tool envelope: { room_dir, query, tier, results }, plus words when tier is not 'phrase', plus reason_code and reason when results is empty.

### D5: what this task does NOT change, and why
- Do not change the room_search description, the inputSchema describe text, or the connectors export text. tests/fixtures/267/wire-snapshot-zod3.json pins every tool description byte for byte (tests/test-267-mcpv2-zod4-contract.cjs check (a)). data/connector-registry.json is generated from the connectors export (scripts/build-connector-registry.cjs --check). Both are outside this task's file limit. The description still says "substring". That wording is incomplete, not false. Record a follow-up in the SUMMARY.
- Do not add stemming. The measurement reached 10 of 10 without it.

### Surfaces and canon
- Tri-Polar: room_search is a read-only MCP tool. It works the same on Claude Code CLI, Claude Desktop and Cowork. There is no surface-specific code and no hook.
- Canon Part 8: local files only. No Brain call, no network call, no npm package. The query words never leave the process.
- Canon Part 7: reuse the shipped walker guards, htmlLinesToText, isRealpathContained and safeResolveSection. Do not write a second walker.
- Cost: a sentence query walks the files twice (phrase pass, then word pass). Measured about 170 ms on 424 files, against 40 to 58 ms for the phrase pass alone. A phrase hit costs the same as today.

## Baselines recorded in planning
- Spike harness rerun on today's code (output in 261012-kfn-spike010-baseline.json): nl/room_search top1 0, top5 0, zero-hit 10, median tokens 1. kw/room_search top1 4, top5 7, zero-hit 2, median tokens 458.
- .planning/spikes/010-leviathan-search-vs-room-search/results.json md5 = 3db87e158c3bf77d253a700ad10700e0. It must stay this value.
- bash tests/run-all-198.sh: Passed 15, Failed 1, Skipped 0. The 1 failure is the pre-existing leg "SPEC-5 hooks/ adapter-only budget (import audit + line-count)". It is not related to this task.
- node tests/test-267-mcpv2-zod4-contract.cjs: PASS=4 FAIL=0.
- Expected numbers after this task (prototype, same room): nl top1 9, top5 10, zero-hit 0, median 394. kw top1 5, top5 9, zero-hit 0, median 458. 3 negatives empty with below_relevance_floor.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Write the failing fixture test for the word tier and register it</name>
  <files>tests/test-room-search-natural-language.cjs, tests/run-all-198.sh</files>
  <behavior>
    - Sentence query "Which ledger records the heron and pelican migration?" gives tier 'words' and results[0].file 'research/pelican-ledger.md', and each word-tier row has numeric line, match_count and words_matched.
    - Query "otter dam survey" gives tier 'phrase' and results[0].file 'research/otter-notes.md', and no row from 'research/otter-scatter.md'. A control call scoreWordTier(room, room, ['otter','dam','survey']) ranks 'research/otter-scatter.md' first. This proves the phrase hit wins over a stronger word-only file.
    - The phrase-tier rows are deep-equal to searchRoom(room, 'otter dam survey', null). The .md row key set is exactly file, line, match_count, snippet.
    - Query "What is it about, and why?" and query "a b c d" give tier 'none', results [], reason_code 'no_search_words', and a non-empty reason string.
    - Query "What is the quarterly revenue forecast for the bakery franchise?" gives results [] and reason_code 'below_relevance_floor'. Query "zzunknownword qqmissingterm" gives results [] and reason_code 'no_match'.
    - Symlinks and containment: "Where is the walrus ledger kept?" finds 'research/walrus-real.md', never 'research/walrus-link.md', and the JSON of the output does not contain 'north vault'. "Which sheet lists the quokka burrow census?" returns no file under 'linked-dir', also before the floor (scoreWordTier). scoreWordTier(outsideDir, roomDir, ['walrus','ledger','kept']) returns [] although outsideDir holds a real matching file.
    - Walk bound: in a second room of 501 files f-000.md to f-500.md, the words in f-499.md are found and the words in f-500.md give results [] with reason_code 'no_match'.
    - HTML: "Which census counted kestrel nests near the quarry?" returns 'meetings/brief.html' with extracted true, the true 1-based line (computed from the fixture lines), and a snippet with no '<' or '>'. Query "zzattrtok zzscripttok zzstyletok?" (attribute, script and style tokens only) returns [] with reason_code 'no_match'.
    - Section scope: the pelican sentence with section 'meetings' returns [].
    - Tool envelope: with the handler from register(), a sentence query returns room_dir equal to the fixture room, tier 'words', a words array and non-empty results. The bakery question returns tier 'none', results [], reason_code and reason. The phrase query returns tier 'phrase' and no words key.
    - Static: the test file contains no em-dash (U+2014) and no en-dash (U+2013).
  </behavior>
  <action>
Create tests/test-room-search-natural-language.cjs. Follow the style of tests/test-room-search-rank-before-cap.cjs: 'use strict', node:assert, a check(label, cond) helper that counts passes, and the final line "PASS: test-room-search-natural-language -- N checks". Use Node built-ins only. Write no em-dash and no en-dash.

Set the hermetic environment at the top, before any require of repo code. Copy the pattern of tests/test-369-read-surfaces.cjs lines 25-35: create a temp HOME with fs.mkdtempSync(path.join(os.tmpdir(), 'mos-room-nl-home-')). Set HOME, USERPROFILE and MINDRIAN_ROOMS_HOME (HOME/rooms). Delete CLAUDE_CODE_SESSION_ID. Set CLAUDE_ACTIVE_ROOM to the fixture room after you build it. A planning probe proved that the room_search handler resolves room_dir from CLAUDE_ACTIVE_ROOM under this setup and writes nothing under HOME.

Load lib/mcp/tools/room.cjs. If the require throws, print "SKIP: ... room.cjs not present" and exit 0 (same as the existing tests). If _internal.searchRoomDetailed, _internal.scoreWordTier or _internal.queryWords is not a function, print "FAIL: test-room-search-natural-language -- word tier not exported" and exit 1. Do not SKIP in that case. This is the RED state.

Build fixture room R with fs.mkdtempSync(path.join(os.tmpdir(), 'mos-room-nl-')). Build a sibling outside dir O with fs.mkdtempSync(path.join(os.tmpdir(), 'mos-room-nl-out-')). Write these files with exactly this text (a backslash-n below means a newline):
- R/ROOM.md: "# Fixture room\nA small room for the room search word tier test.\n"
- R/research/pelican-ledger.md: "# Pelican migration ledger\nThe ledger records every heron and pelican sighting along the estuary.\nEach migration window is logged with the observer name.\n"
- R/research/otter-notes.md: "# Otter notes\nThe otter dam survey ran in spring.\n"
- R/research/otter-scatter.md: "# Field log\nOtter tracks near the dam.\nA survey of the otter population.\nThe dam held. Another otter survey later.\nDam, otter, survey, dam, otter, survey.\n"
- R/research/walrus-real.md: "# Walrus\nThe walrus ledger is kept in the south archive.\n"
- R/meetings/budget.md: "# Budget review\nThe forecast for next year is flat.\n"
- R/meetings/brief.html: a lines array joined with "\n". Line 1: an html/head line with a style element that holds ".zzstyletok { color: red; }" and a script element that holds "var zzscripttok = 1;", then the body open tag. Line 2: an h1 with attribute data-x="zzattrtok" and text "Field brief". Line 3: a p element with text "The census counted forty kestrel nests near the quarry." Line 4: the body and html close tags. Compute the expected line with findIndex on the array plus 1. Do not hardcode it.
- O/walrus-ledger.md: "The walrus ledger is kept in the north vault.\n". Then fs.symlinkSync(O/walrus-ledger.md, R/research/walrus-link.md).
- O/dir/deep.md: "The quokka census sheet lists every burrow.\n". Then fs.symlinkSync(O/dir, R/linked-dir).

Build a second room B (mkdtemp 'mos-room-nl-bound-') with 501 files f-000.md to f-500.md (zero-padded to 3 digits). Each file holds "# Filler i\nplain filler text\n". Append "zzinbound zzinother here\n" to f-499.md only and "zzpastbound zzpastother here\n" to f-500.md only. Query "Where is zzinbound with zzinother?" must return f-499.md. Query "Where is zzpastbound with zzpastother?" must return [] with reason_code 'no_match'.

Write one check for each item in the behavior block. Call _internal.searchRoomDetailed(R, query, null) for the detailed checks. Call _internal.searchRoom(R, 'otter dam survey', null) for the deep-equal check with assert.deepStrictEqual inside a try. For the tool envelope checks, capture the room_search handler with the fake-server pattern of tests/test-369-read-surfaces.cjs lines 64-80 (registerTool stores name to handler, then room.register(fakeServer, {})). Await handler({ query }, {}). Parse result.content[0].text with JSON.parse. Check room_dir equal to R first. If it differs, fail with the resolved value in the label. Do not weaken the assertion.

At the end, remove R, O, B and the temp HOME with fs.rmSync(..., { recursive: true, force: true }) in try blocks. Then print the PASS line and exit 0. Wrap the async part in an async main() that exits 1 on any thrown assertion and prints the failed label.

All fixture outcomes above were proven against the planning prototype (same math) before this plan was written.

Register the test in tests/run-all-198.sh. Add one run_if block directly after the "SPEC-2 room_search finds .html content, rejects markup-only false positives" block (around line 110). Gate it on lib/mcp/tools/room.cjs. Use the label "SPEC-2 room_search natural-language word tier (BM25 + relevance floor, quick 261012-kfn)" and the command node tests/test-room-search-natural-language.cjs. Add a 3-line comment above it in the same style as the two neighbor blocks. Use hyphens only.

Commit (RED). Run git add tests/test-room-search-natural-language.cjs. Then run git commit --only tests/test-room-search-natural-language.cjs tests/run-all-198.sh with the message "test(quick-261012-kfn): add failing natural-language room_search test". Do not use git add -A or git commit -a. A peer session can hold other changes in the tree.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && node tests/test-room-search-natural-language.cjs; test $? -eq 1 && grep -c "test-room-search-natural-language.cjs" tests/run-all-198.sh && ! grep -nP "[\x{2013}\x{2014}]" tests/test-room-search-natural-language.cjs tests/run-all-198.sh && git show --stat --format=%s HEAD | grep -E "test-room-search-natural-language|run-all-198"</automated>
  </verify>
  <done>The new test exits 1 with "FAIL: test-room-search-natural-language -- word tier not exported" on the unchanged room.cjs. tests/run-all-198.sh holds exactly 1 new run_if leg for it. The RED commit holds only these 2 paths. Neither file holds an em-dash or an en-dash.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement the shared walker, the BM25 word tier, the relevance floor and the tool envelope in room.cjs</name>
  <files>lib/mcp/tools/room.cjs</files>
  <behavior>
    - Task 1 test passes (GREEN).
    - tests/test-room-search-rank-before-cap.cjs and tests/test-room-search-html-blindness.cjs pass with no edit.
    - tests/test-369-read-surfaces.cjs (WR-19a/b/c), tests/test-198-contract-schema.test.cjs, tests/test-198-local-only.test.cjs and tests/test-267-mcpv2-zod4-contract.cjs still pass.
  </behavior>
  <action>
Edit lib/mcp/tools/room.cjs only. Port the logic of .planning/quick/261012-kfn-natural-language-room-search-word-split-/261012-kfn-bm25-prototype.cjs into it. Keep the math identical so the measured numbers reproduce (D1, D2, D3).

Step 1, the shared walker (Canon Part 7). Extract the directory walk from collectMatches into a new function walkSearchFiles(scopeDir, roomDir, onFile). Move the code without a change in behavior or order: the SEARCH_MAX_FILES bound (the scanned counter is checked before each entry and incremented after the containment check), the name sort, the dot-entry skip, the WR-19 symlink skip with its comment, the directory recursion, the SEARCH_EXT allowlist, isRealpathContained, the readFileSync catch, the statSync mtime catch, the line split, and the htmlLinesToText pass with its catch-and-skip. The walker calls onFile with an object { full, rel, mtimeMs, isHtml, searchLines }, where rel is path.relative(roomDir, full). Rewrite collectMatches(scopeDir, roomDir, needle) to call walkSearchFiles and to run the existing per-line phrase loop in the callback. Keep its signature and its output records exactly the same, including the rule that only html records get extracted: true.

Step 2, constants. Add these next to the SEARCH_* constants, with a comment block that states the measured basis from D1, D2 and D3 (quick 261012-kfn, the room, the numbers):
- SEARCH_STOPWORDS: a frozen Set. Copy the STOPWORDS word list verbatim from the prototype file.
- SEARCH_WORD_RE: the regex /[\p{L}\p{N}]+/gu. Use it only with String.prototype.match. Do not use it with exec or test, because a shared global regex carries lastIndex state.
- SEARCH_WORD_MIN_LEN = 3, BM25_K1 = 1.2, BM25_B = 0.75.
- SEARCH_WORDS_MAX_FILES = 5, SEARCH_WORDS_LINES_PER_FILE = 1.
- SEARCH_FLOOR_MIN_WORDS = 2, SEARCH_FLOOR_MIN_IDF_SHARE = 0.55.
- SEARCH_REASONS: a frozen object that maps each reason_code to one plain-English sentence. no_search_words: "No file contains this exact text, and the question has no words left to search for once common words and very short words are set aside." no_match: "No file contains this exact text or any of its search words." below_relevance_floor: "Some files share a few words with the question, but none matches enough of it to be an answer." Do not use stack terms (BM25, IDF) in these sentences, because Larry can relay them to the person.

Step 3, the word tier functions (same math as the prototype):
- wordTokens(text): lower-case, then match SEARCH_WORD_RE, else [].
- queryWords(query): wordTokens, drop tokens shorter than SEARCH_WORD_MIN_LEN, drop SEARCH_STOPWORDS, dedupe and keep the first-seen order.
- collectWordStats(scopeDir, roomDir, words): use walkSearchFiles. For each file, count every token of every search line into dl (the document length), count each query word as a whole token into a tf Map, count lineHits (lines with at least 1 query word), and keep the best line. The best line is the line with the most distinct query words; the earliest line wins a tie. Its snippet is searchLines[i].trim().slice(0, 200), the same rule as the phrase tier. Count docCount for every file the walker delivers and add every dl to totalLen. Keep a perFile record only for a file with at least 1 query word. Hold one file's lines in memory at a time.
- scoreWordTier(scopeDir, roomDir, words): BM25 over collectWordStats. N = docCount. df = the number of perFile records that hold the word. idf = Math.log(1 + (N - df + 0.5) / (df + 0.5)). avgdl = totalLen / docCount. The term score is idf * tf * (BM25_K1 + 1) / (tf + BM25_K1 * (1 - BM25_B + BM25_B * dl / avgdl)). idf_share = the matched idf sum divided by the idf sum of all query words. Sort by score descending, then by file path ascending. Return an array of { file, score, words_matched, idf_share, line, snippet, match_count, isHtml } before the floor. Return [] when docCount is 0.
- passesWordFloor(entry, wordCount): true when entry.words_matched >= Math.min(SEARCH_FLOOR_MIN_WORDS, wordCount) and entry.idf_share >= SEARCH_FLOOR_MIN_IDF_SHARE (per D2).

Step 4, searchRoomDetailed(roomDir, query, section):
- scopeDir = safeResolveSection(roomDir, section || null). A bad section still throws, as today.
- phrase = rankMatches(collectMatches(scopeDir, roomDir, query.toLowerCase())). words = queryWords(query).
- When phrase is not empty, return { tier: 'phrase', words, results: phrase } (per D1).
- When words is empty, return tier 'none', results [], reason_code 'no_search_words' and its reason.
- Run scoreWordTier(scopeDir, roomDir, words). When it is empty, return tier 'none' with reason_code 'no_match'.
- Filter with passesWordFloor. When nothing is left, return tier 'none' with reason_code 'below_relevance_floor'.
- Otherwise take the first SEARCH_WORDS_MAX_FILES entries. Build one row per file: { file, line, snippet, match_count, words_matched }, and add extracted: true only for html (per D4). Bound the row count by SEARCH_MAX_RESULTS and the rows per file by SEARCH_MAX_PER_FILE. Return { tier: 'words', words, results }.
- Do not put score or idf_share in the rows (payload budget, D3).

Step 5, searchRoom(roomDir, query, section) returns searchRoomDetailed(roomDir, query, section).results. Keep the name, the parameters and the array return (per D4).

Step 6, the room_search handler. Call searchRoomDetailed in the same try/catch. Build the payload { room_dir: roomDir, query, tier, results }. Add words when tier is not 'phrase'. Add reason_code and reason when results is empty. Keep the error path unchanged. Do NOT change the description string, the inputSchema describe text, or the connectors array (per D5).

Step 7, exports. Add searchRoomDetailed, queryWords, scoreWordTier, walkSearchFiles, collectWordStats, SEARCH_FLOOR_MIN_WORDS and SEARCH_FLOOR_MIN_IDF_SHARE to _internal. Keep every existing _internal key.

Step 8, the comment above the SEARCH_* constants. Update it to describe the two tiers in 3 to 6 lines. Write no em-dash and no en-dash. Do not write the tokens that tests/test-198-local-only.test.cjs forbids in this file: mindrian-brain, onrender, brain-router.cjs, brain-client.cjs, axios.

If a measured target in Task 3 misses after a faithful port, look for a port defect first (tokenizer, df source, avgdl, tie order, floor). Do not change BM25_K1, BM25_B, SEARCH_FLOOR_* or SEARCH_WORDS_* to make a target pass. A change to a measured constant needs a new measurement table and is out of scope. Stop and report it.

Commit (GREEN). Run git commit --only lib/mcp/tools/room.cjs with the message "feat(quick-261012-kfn): room_search word tier (BM25) with relevance floor when the exact phrase finds nothing". Then run git merge-base --is-ancestor on the new sha and HEAD to confirm the commit is in the history (collision guard).
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && node tests/test-room-search-natural-language.cjs && node tests/test-room-search-rank-before-cap.cjs && node tests/test-room-search-html-blindness.cjs && node tests/test-369-read-surfaces.cjs && node tests/test-198-contract-schema.test.cjs && node tests/test-198-local-only.test.cjs && node tests/test-267-mcpv2-zod4-contract.cjs && node scripts/build-connector-registry.cjs --check && ! grep -nP "[\x{2013}\x{2014}]" lib/mcp/tools/room.cjs && git diff --quiet HEAD -- tests/test-room-search-rank-before-cap.cjs tests/test-room-search-html-blindness.cjs && bash tests/run-all-198.sh 2>&1 | tail -3</automated>
  </verify>
  <done>Every listed test passes. tests/run-all-198.sh reports Passed 16, Failed 1, Skipped 0, and the 1 failure is the pre-existing "SPEC-5 hooks/ adapter-only budget" leg. The two existing room_search tests have no diff. room.cjs holds no em-dash or en-dash. The GREEN commit holds only lib/mcp/tools/room.cjs.</done>
</task>

<task type="auto">
  <name>Task 3: Measure the change on the real room (read-only) and record the evidence</name>
  <files>.planning/quick/261012-kfn-natural-language-room-search-word-split-/261012-kfn-spike010-rerun.json</files>
  <action>
Do not write to ~/MindrianRooms/rethinking-mindrianos. Do not edit any file in .planning/spikes/010-leviathan-search-vs-room-search/.

Step 1. Create a marker file in the session scratchpad. Use it with find -newer after the runs to show that no room file changed.

Step 2. Run node .planning/quick/261012-kfn-natural-language-room-search-word-split-/261012-kfn-measure.cjs from the repo root (engine = room.cjs). It runs the 10 cases in both forms and the 3 negative controls. It prints the floor inputs and exits 1 on a missed target. Expected values (the prototype measurement, same math): nl top1 9, top5 10, zero-hit 0, median_tokens 394. kw top1 5, top5 9, zero-hit 0, median_tokens 458. All 3 negatives give results 0 and reason_code below_relevance_floor, with best files at 1 of 5 / 0.15, 1 of 3 / 0.28 and 1 of 2 / 0.35. A value that differs from the prototype is a port defect in Task 2. Fix room.cjs, not the constants. Rerun the Task 2 verify. Do not amend a commit. Make a new fix commit with git commit --only lib/mcp/tools/room.cjs.

Step 3. Run the unmodified spike harness through the write-redirect preload. From the repo root, run node -r ./.planning/quick/261012-kfn-natural-language-room-search-word-split-/261012-kfn-redirect-results.cjs .planning/spikes/010-leviathan-search-vs-room-search/run.cjs. The preload sends the harness output to 261012-kfn-spike010-rerun.json in the quick folder, so the tracked spike results.json stays unchanged. Read the room_search rows of its summary table: nl/room_search top5 must be 8 or more, kw/room_search top5 must be 7 or more, and both medTokens must be 460 or fewer. The leviathan and flexsearch rows must match the baseline file 261012-kfn-spike010-baseline.json (control).

Step 4. Confirm that md5sum of .planning/spikes/010-leviathan-search-vs-room-search/results.json is 3db87e158c3bf77d253a700ad10700e0. Confirm that git status --short for that folder is empty. Confirm that find ~/MindrianRooms/rethinking-mindrianos -newer MARKER -type f prints nothing. If it prints a file, list it and check that this task did not write it (room_search only calls fs.readFileSync and fs.statSync).

Step 5. Write the SUMMARY with: a before-and-after table (baseline numbers from planning, after numbers from Steps 2 and 3), the median tool-envelope tokens that the measure script prints, the negative-control table, the floor rule with its measured basis (D2), the D1 choice with the option B numbers, and the latency note (D5 cost line). Add these known limits: keyword case 9 is still a miss (the one phrase hit is the wrong file); a lexical floor passes a true word match such as the weather-in-Paris probe; the room_search description still says "substring". Add one follow-up: a separate quick task updates the room_search description and the inputSchema describe text, moves the 267 wire pins (tests/fixtures/267/wire-snapshot-zod3.json and wire-snapshot-zod4.json), and checks tests/test-234-tool-description-floor.cjs. The quick workflow commits the SUMMARY and the quick-folder evidence files with git add -f on explicit paths.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && node .planning/quick/261012-kfn-natural-language-room-search-word-split-/261012-kfn-measure.cjs 2>&1 | grep -v -i experimental | tail -8 && node -r ./.planning/quick/261012-kfn-natural-language-room-search-word-split-/261012-kfn-redirect-results.cjs .planning/spikes/010-leviathan-search-vs-room-search/run.cjs 2>&1 | grep room_search && test "$(md5sum .planning/spikes/010-leviathan-search-vs-room-search/results.json | cut -d' ' -f1)" = 3db87e158c3bf77d253a700ad10700e0 && test -z "$(git status --short .planning/spikes/010-leviathan-search-vs-room-search/)"</automated>
  </verify>
  <done>The measure script prints "PASS: 261012-kfn targets met (engine=room.cjs)". The harness rerun shows nl/room_search top5 of 8 or more, kw/room_search top5 of 7 or more, and medTokens of 460 or fewer for both forms. The spike folder is byte-identical. No room file changed. The SUMMARY holds the before-and-after table, the floor evidence, the D1 reason, the known limits and the description follow-up.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| MCP caller to room_search | The query string is untrusted input (zod caps it at 1 to 500 characters). |
| Room folder to room_search | A shared or cloned room can hold hostile symlinks, huge files or malformed HTML. |
| Room content to the tool result | Snippets leave the process to the calling model; they must come only from files inside the room. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-kfn-01 | Information disclosure | word tier walk | mitigate | One shared walkSearchFiles keeps the WR-19 symlink skip and isRealpathContained for both tiers; Task 1 tests a symlinked file, a symlinked directory and an outside scopeDir. |
| T-kfn-02 | Denial of service | collectWordStats, SEARCH_WORD_RE | mitigate | The 500-file walk bound applies to the word pass (Task 1 tests file 501). The regex is a single character class with no backtracking. One file is in memory at a time. The query is capped at 500 characters and its words are deduped. |
| T-kfn-03 | Information disclosure (Canon Part 8) | room.cjs | mitigate | No network, no Brain call, no npm package. tests/test-198-local-only.test.cjs still scans room.cjs for the forbidden egress tokens. |
| T-kfn-04 | Spoofing (false grounding) | relevance floor | mitigate | The per-file floor (min(2, word count) words and idf_share 0.55) returns an empty result with a reason for an unanswerable question; measured on the 3 spike negative controls. |
| T-kfn-05 | Information disclosure | html snippets | mitigate | The word pass reuses htmlLinesToText; script, style, comment and attribute text never count or appear (Task 1 html checks). |
| T-kfn-06 | Tampering | git history | mitigate | git commit --only with explicit paths; no git add -A or commit -a; git merge-base --is-ancestor check after each commit (peer session in the same tree). |
</threat_model>

<verification>
- node tests/test-room-search-natural-language.cjs passes.
- node tests/test-room-search-rank-before-cap.cjs and node tests/test-room-search-html-blindness.cjs pass with no edit to either file.
- node tests/test-369-read-surfaces.cjs, node tests/test-198-contract-schema.test.cjs, node tests/test-198-local-only.test.cjs and node tests/test-267-mcpv2-zod4-contract.cjs pass.
- node scripts/build-connector-registry.cjs --check passes (connectors unchanged).
- bash tests/run-all-198.sh: Passed 16, Failed 1 (pre-existing SPEC-5 leg only), Skipped 0.
- The measure script prints PASS on the real room. The spike harness rerun (redirected) meets nl top5 of 8 or more, kw top5 of 7 or more, median tokens of 460 or fewer.
- The spike results.json md5 is unchanged. No room file changed.
- No em-dash or en-dash in the 3 changed files.
</verification>

<success_criteria>
- Natural-language form: the right file in the top 5 for at least 8 of 10 cases (expected 10).
- Keyword form: the right file in the top 5 for at least 7 of 10 cases (expected 9).
- The 3 negative-control questions return an empty result with reason_code below_relevance_floor.
- Median results payload of 460 tokens or fewer (chars/4) per form (expected 394 and 458).
- searchRoom(roomDir, query, section) keeps its signature and array return; the spike harness runs unmodified.
- Only lib/mcp/tools/room.cjs, tests/test-room-search-natural-language.cjs and tests/run-all-198.sh change in source. No push, no release, no version bump.
</success_criteria>

<output>
Create .planning/quick/261012-kfn-natural-language-room-search-word-split-/261012-kfn-SUMMARY.md when done.
</output>

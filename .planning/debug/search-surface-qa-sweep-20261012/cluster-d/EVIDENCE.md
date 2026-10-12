# Cluster D - item 1: room_search description says "substring"

Sweep: search-surface-qa-sweep-20261012. Mode: diagnose only. No code file was edited. No commit.

## Source-of-Truth Preamble

- CODE claims read against: branch main @ 63b25583d, /home/jsagi/dev/MindrianOS-Plugin.
- WIRE claims: none. No network call. No Brain call.
- Claim marks: PROVEN = I saw it in a file or a command output. UNVERIFIED = I did not run it. ASSUMED = I infer it.

## Current Focus

hypothesis: The room_search description (lib/mcp/tools/room.cjs line 616) was true before 32fcb604b. It is now incomplete, and one clause steers the model away from the working path. The description bytes are pinned in two hand-edited snapshots. A fix touches 4 files.
test: Quote the text, find every copy, read the two tests that compare it, draft a replacement, check the replacement against both tests.
expecting: One source string, two snapshot copies, no generated copy, no system-prompt copy.
next_action: Hand the Required Code Changes below to one /gsd-quick executor.

## Evidence

- timestamp: 2026-10-12T13:00:00Z
  checked: lib/mcp/tools/room.cjs lines 612-623 (the room_search registerTool call)
  found: PROVEN. Verbatim text, with line numbers:
    - line 613: `'room_search',`
    - line 615: `title: 'Room Search',`
    - line 616: `description: "Search the markdown and HTML entries of this session's bound room by case-insensitive substring, optionally scoped to a single section. Read-only, no side effects. It answers literal-recall questions well: a project name, a person, a funder, any term you expect to appear verbatim in the text. It does NOT do semantic or fuzzy matching, so for a conceptual or relational question reach for room_graph and run a graph query instead of guessing at keywords.",`  (455 bytes)
    - line 618-619: `query: z.string().min(1).max(500)` then `.describe('Search text (case-insensitive substring match).'),`
    - line 620-621: `section: sectionOptional` then `.describe('Optional section slug to scope the search to.'),`
  implication: The description makes three claims. (1) "by case-insensitive substring" is only the phrase tier now. (2) "It answers literal-recall questions well" omits the sentence use. (3) "reach for room_graph ... instead of guessing at keywords" tells the model to leave room_search for a conceptual question, which the word tier now answers.

- timestamp: 2026-10-12T13:00:00Z
  checked: lib/mcp/tools/room.cjs lines 521-549 and 633-639 (searchRoomDetailed and the handler envelope)
  found: PROVEN. The handler returns { room_dir, query, tier, results }. tier is 'phrase', 'words' or 'none'. words is added when tier is not 'phrase'. reason_code and reason are added when results is empty. reason_code values: no_search_words, no_match, below_relevance_floor (reason text at lines 148-152). The word tier matches whole lower-cased word tokens (wordTokens, line 409). There is no stemming (grep for stem returns nothing). Words shorter than 3 characters and 160 stop words are dropped (lines 136, 140, 415-426). The word tier runs only when the phrase tier has zero hits (line 525). Section scope applies to both tiers (scopeDir, line 522).
  implication: "literal" is the true word for the word tier: exact word tokens, no meaning match. A new description must say it is literal and must not say "semantic".

- timestamp: 2026-10-12T13:00:00Z
  checked: .planning/quick/261012-kfn-natural-language-room-search-word-split-/261012-kfn-PLAN.md D5 (line 124) and SUMMARY lines 105 and 109-111
  found: PROVEN. D5: do not change the description, the inputSchema describe text or the connectors text, because tests/fixtures/267/wire-snapshot-zod3.json pins every tool description byte for byte (test-267 check (a)) and data/connector-registry.json is generated from the connectors export. D5 calls the description "incomplete, not false". The SUMMARY follow-up says: update the description and the inputSchema describe text, move the two 267 wire pins, check test-234, regenerate data/connector-registry.json only if the connectors text changes.
  implication: The plan already named this task. It left the text alone on purpose, as a file-limit choice, not a design choice.

- timestamp: 2026-10-12T13:00:00Z
  checked: grep -rn "substring" over tests/fixtures/267/, test-234, test-267*.cjs, data/connector-registry.json, docs/, commands/, skills/, agents/, references/, lib/mcp/, scripts/. Then grep -rn "semantic or fuzzy" over the whole repo (node_modules, .git, worktrees excluded). Then grep for "case-insensitive substring", "literal-recall", "Search text" over tests/ lib/ scripts/ commands/ skills/ agents/ references/ docs/ ui/ bin/ hooks/ data/ pipelines/.
  found: PROVEN. The hits that concern room_search are listed in the pin table below. Every other "substring" hit in those trees is unrelated (test helper prose, zod-importer scans, other tools). "semantic or fuzzy" has 3 room_search hits (room.cjs:616, zod3 snapshot:1378, zod4 snapshot:1618) and one unrelated hit (scripts/skillopt-funnel.cjs:321). No copy of the description exists in docs/, commands/, skills/, agents/, references/, dist/, ui/ or .planning/.
  implication: One source string and two byte-pinned copies. Nothing else carries the description bytes.

- timestamp: 2026-10-12T13:00:00Z
  checked: lib/mcp/runtime-instructions.cjs, scripts/mindrian-mcp-server.cjs lines 228-240, and the instructions field of both snapshots
  found: PROVEN. The server composes its handshake instructions from RUNTIME_INSTRUCTIONS (lib/mcp/runtime-instructions.cjs), passed at scripts/mindrian-mcp-server.cjs:240. grep for "search" in runtime-instructions.cjs returns nothing. The snapshot instructions field contains neither "room_search" nor "substring" (python check, both False). The server instructions I was given in this session (the Larry block) also have no room_search text.
  implication: The Desktop and Cowork system prompt does NOT repeat the room_search description. The sweep Non-Code Follow-up that says "system-prompt text that describes room_search as substring-only must follow item 1" has no target. Only the tools/list description carries the text. Desktop and Cowork receive it from tools/list, the same as the CLI.

- timestamp: 2026-10-12T13:00:00Z
  checked: grep -rn "wire-snapshot" scripts/ tests/ package.json; tests/helpers/mcp-wire-267.cjs; git log and git show for e87ce10ba
  found: PROVEN. No script rewrites the snapshots. The only writeFileSync in tests/helpers/mcp-wire-267.cjs (line 70) writes a hermetic env file. wireSnapshot() (line 217) only reads a live server and returns an object. Precedent commit e87ce10ba (2026-10-06) moved the suggest_next pin by editing one JSON line in each file: "the suggest_next description replaced as a single string, as the live wire reads it". The zod4 file carries a free-text refreshed_by note that earlier edits extended.
  implication: Both pins are hand-edited. The regeneration path is a string replace of the old description line and the old query describe line in each file.

- timestamp: 2026-10-12T13:00:00Z
  checked: tests/test-267-mcpv2-zod4-contract.cjs lines 128-206 and tests/helpers/mcp-wire-267.cjs lines 287-340
  found: PROVEN. Check (a) spawns the real server, takes the live tools/list, and compares each tool description to the zod3 snapshot with strict string inequality (`snapTool.description !== liveTool.description`, helper line 322). Any one-byte difference is a failure, whole text, no hash, no key-presence shortcut. inputSchema is compared by JSON of the normalized schema (helper line 331). In check (b) the room_search inputSchema diff is already in the pinned zod4 delta set (zod4-accepted-deltas.json line 287) and check (b) matches on kind+name+field only, so a changed query describe text does not change that key set.
  implication: The new description must match the zod3 snapshot bytes exactly. The query describe text is not byte-checked by this test (ASSUMED from reading: I did not run a changed text).

- timestamp: 2026-10-12T13:00:00Z
  checked: tests/test-267-mcpv2-dual-era.cjs lines 52-65 and 160-175
  found: PROVEN. This test also compares live tools/list to the zod4 snapshot with compareToSnapshot. Its ACCEPTED list includes the room_search inputSchema key, so description diffs fail and inputSchema diffs for room_search are masked. It asserts diffs equal [].
  implication: The zod4 snapshot description must match the live bytes exactly too. Both snapshots need the edit. Also node_modules/zod is 4.6.5 here (PROVEN), so check (b) runs in its zod 4 branch.

- timestamp: 2026-10-12T13:00:00Z
  checked: other readers of the snapshots (grep): test-267-mcpv2-registration-api.cjs (tool count only), test-267-mcpv2-clients.cjs, test-267-mcpv2-brain-shim.cjs, test-267-mcpv2-http-flag-off.cjs, test-366-mcp-plan-only.cjs (line 150, one named tool), test-369-shared-core.cjs (line 376), test-257-strict-input-shapes.cjs
  found: PROVEN by grep that they read the zod4 snapshot. UNVERIFIED whether any of them reads the room_search entry; the grep shows description reads only for test-366 (a different tool) and the compare helper. I did not run them.
  implication: Run the whole tests/run-all-267.sh after the edit to catch a reader I did not trace.

- timestamp: 2026-10-12T13:00:00Z
  checked: tests/test-234-tool-description-floor.cjs (full read) and a live run
  found: PROVEN. The rules, applied to every tool in the live tools/list: (1) length >= 120 characters; (2) starts with a capital letter; (3) ends with . ! or ? (a closing bracket or quote may follow); (4) <= 2048 bytes (UTF-8); (5) no em-dash and no en-dash. There is no required word, no forbidden word, and no ceiling below 2048. room_search must stay registered (presence pin, line 132). Live run: `node tests/test-234-tool-description-floor.cjs` printed "204 passed, 0 failed (prose-shape coverage: 48/48)" in 1.5 s.
  implication: The floor is loose. The binding constraint is the byte-exact snapshot match, not test-234.

- timestamp: 2026-10-12T13:00:00Z
  checked: live runs, no file changed: test-267-mcpv2-zod4-contract.cjs, test-267-mcpv2-dual-era.cjs, scripts/build-connector-registry.cjs --check
  found: PROVEN. zod4-contract: PASS=4 FAIL=0 in 2 s. dual-era: PASS=5 FAIL=0 in 6 s. connector-registry --check: "connector-registry: OK".
  implication: The baseline is green. Any red after the edit comes from the edit.

- timestamp: 2026-10-12T13:00:00Z
  checked: the connectors export (room.cjs lines 668-676) and its generated copies
  found: PROVEN. The connectors entry for room_search has hitl_why "Pure read: bounded substring search over the session-bound room, no fork." and layer_why "Bounded substring search over the session-bound room's own content; a room-context reader." Generated copies: data/connector-registry.json lines 3475 and 3477, data/mcp-tool-connectors.json lines 551 and 553. The generator (scripts/build-connector-registry.cjs lines 1359-1372) writes three files: data/connector-registry.json, data/connector-coverage-ledger.json, data/mcp-tool-connectors.json. Run `node scripts/build-connector-registry.cjs` to write, `--check` to verify. The hitl_why and layer_why text is gate metadata. The model does not receive it in tools/list (ASSUMED: the snapshot tool entries carry only name, title, description and inputSchema, PROVEN from wireSnapshot lines 232-237).
  implication: The connectors text is still true for the phrase tier ("bounded substring search"). It is not model-facing. Keep it. A change would add 2 to 3 generated files for no model-visible gain.

- timestamp: 2026-10-12T13:00:00Z
  checked: every site that steers the model to room_graph or tells it room_search is substring-only (grep room_search and room_graph over code, docs, skills, commands, agents, references, data, ui, dist)
  found: PROVEN. Only one site tells the model to prefer room_graph for a conceptual question because room_search is substring-only: the room_search description itself (room.cjs:616 and its two snapshot copies). Other room_search mentions: lib/mcp/tools/feed.cjs:7 and lib/mcp/tools/artifact-read.cjs:6 (code comments in a Part 7 justification: "room_search returns substring matches"); skills/room-proactive/SKILL.md:233 (and two dist copies) names room_search only as a source of node ids; lib/core/brain-response-sanitize.cjs:112 (name list); data/capability-ledger.json (prose, not a description); ui/shared/src/generated/mcp-adapter.ts (argument types only). The room_graph description (lib/mcp/tool-router.cjs line 1186) does not mention room_search and needs no change.
  implication: The same edit that fixes the description also removes the only steering text. The two code comments are not model-facing. Decision: leave them (they stay true for the phrase tier; a comment-only edit adds files for no wire effect).

## Pin table

| # | File:line | Kind | Text pinned | Action |
|---|-----------|------|-------------|--------|
| 1 | lib/mcp/tools/room.cjs:616 | (a) source | description | edit |
| 2 | lib/mcp/tools/room.cjs:619 | (a) source | query describe | edit |
| 3 | lib/mcp/tools/room.cjs:673, 675 | (a) source, connectors export | hitl_why, layer_why ("bounded substring search") | keep |
| 4 | tests/fixtures/267/wire-snapshot-zod3.json:1378 | (b) byte-pinned snapshot | description | edit (hand) |
| 5 | tests/fixtures/267/wire-snapshot-zod3.json:1386 | (b) byte-pinned snapshot | query describe | edit (hand) |
| 6 | tests/fixtures/267/wire-snapshot-zod4.json:1618 | (b) byte-pinned snapshot | description | edit (hand) |
| 7 | tests/fixtures/267/wire-snapshot-zod4.json:1627 | (b) byte-pinned snapshot | query describe | edit (hand) |
| 8 | data/connector-registry.json:3475, 3477 | (c) generated | hitl_why, layer_why | keep (regenerates only if row 3 changes) |
| 9 | data/mcp-tool-connectors.json:551, 553 | (c) generated | hitl_why, layer_why | keep (same) |
| 10 | lib/mcp/tools/feed.cjs:7, lib/mcp/tools/artifact-read.cjs:6 | (d) code comment | "room_search returns substring matches" | keep |
| 11 | skills/room-proactive/SKILL.md:233 | (d) skill prose | names room_search as an id source; no substring claim | keep |
| 12 | lib/mcp/runtime-instructions.cjs | (d) system-prompt source | no room_search text | none needed |
| 13 | tests/fixtures/267/zod4-accepted-deltas.json:287 | (b) pin, key only | room_search inputSchema key, no text | keep |

## Regeneration path

- No script exists. PROVEN: grep "wire-snapshot" in scripts/, tests/ and package.json finds only readers.
- Pin test for the zod3 file: tests/test-267-mcpv2-zod4-contract.cjs check (a). Pin test for the zod4 file: tests/test-267-mcpv2-dual-era.cjs.
- Hand edit method (precedent e87ce10ba): in each snapshot, replace the one old description line and the one old query describe line with the new strings. The old strings occur once per file. The description has no double quote and no backslash, so the JSON text equals the string text.

## Floor rule and the new text

Floor rule (test-234): >= 120 characters, starts with a capital letter, ends with a sentence terminator, <= 2048 bytes, no em-dash or en-dash. The snapshot rule (test-267): the live description must equal the snapshot description byte for byte, in both files.

Draft description (one paragraph, 799 characters, 799 bytes, no em-dash, no en-dash; I ran the test-234 checks on it in a scratch script and all pass):

```
Search the markdown and HTML entries of this session's bound room, optionally scoped to a single section. Read-only, no side effects, and local to this machine. Send a plain question, a full sentence, or a single term. The tool first looks for your exact text, ignoring case. When no file holds that exact text, the tool ranks the files by the meaningful words in your question. It returns the best line from each of the top files. The reply names the tier that answered, phrase or words. An empty reply carries a reason and means the room has no answer to this question, so tell the person that. Matching is literal, with no semantic or fuzzy search, so a file that uses other words than yours is not found. For a question about how things in the room connect, use room_graph and run a graph query.
```

Draft query describe text (128 characters):

```
A plain question, a full sentence, or a single term. Case-insensitive. The exact text is tried first, then its meaningful words.
```

Check of the draft:
- First sentence says WHAT the tool does. PROVEN by reading.
- Order of the content: exact phrase first, then word-ranked when no phrase hit, sentence works, empty plus reason means no answer, literal and no semantic search, local-only. All six are present.
- The draft is 799 bytes. The host cap is 2048 bytes. The old text was 455 bytes.
- The longest sentence is 21 words.
- Whether the new text changes model behavior: UNVERIFIED. I ran no model. The claim "the model keeps sending keywords" comes from the task brief, not from my observation.
- Accuracy risk, one sentence: "means the room has no answer to this question". For reason_code no_search_words (the question has only stop words or very short words) the cause is the query, not the room. The reason text itself says this. The sentence is still correct for the two common codes (no_match, below_relevance_floor). The main session may choose "means the room holds no answer for this wording" instead. Either wording is within the floor.
- "local to this machine": PROVEN for the code (room.cjs header line 18: zero Brain or network tokens; file reads only).

## Technical Root Cause

Commit 32fcb604b added a second search tier and a new response envelope (tier, words, reason_code, reason) to room_search. The commit left the tool description unchanged on purpose (quick 261012-kfn plan D5) because two hand-edited byte pins and a generated file sit outside that task's file limit. The description is the only model-facing guidance. Its wording ("by case-insensitive substring", "literal-recall questions", "instead of guessing at keywords", "for a conceptual or relational question reach for room_graph") tells the model to send keywords and to leave room_search for conceptual questions. The new tier and its honest empty answer are invisible to the model. PROVEN for the text and the missing mention; UNVERIFIED for the model behavior.

## Required Code Changes (for one /gsd-quick executor)

Work in /home/jsagi/dev/MindrianOS-Plugin on main. Use `git add -f` on explicit paths. Do not use `git add -A`. Commit with `--only` on the named files. No em-dash or en-dash in any edit. Canon Part 8: no Brain wire is touched. Tri-Polar: room_search is one MCP tool served by tools/list to CLI, Desktop and Cowork, so one edit covers all three surfaces (verified by construction; not run on Desktop or Cowork).

1. File: lib/mcp/tools/room.cjs
   - Location: line 616 (description) and line 619 (query describe), inside `server.registerTool('room_search', ...)`.
   - Current behavior: description is the 455-byte text quoted in Evidence entry 1. Query describe is `'Search text (case-insensitive substring match).'`.
   - Required behavior: replace the description string with the draft description above (keep the double-quoted JS string; the text has an apostrophe in "session's" and no double quote). Replace the query describe with the draft query describe above. Do NOT change the title, the section describe, the handler, the connectors export (lines 668-676) or any constant.
   - Verify: `node tests/test-234-tool-description-floor.cjs` ends "0 failed".

2. File: tests/fixtures/267/wire-snapshot-zod3.json
   - Location: line 1378 (room_search description) and line 1386 (query description).
   - Current behavior: both lines hold the old text.
   - Required behavior: replace the two strings with the exact new strings from step 1, with the Edit tool, one occurrence each. Keep every other byte. Do not reformat the file.
   - Verify: `node tests/test-267-mcpv2-zod4-contract.cjs` prints "RESULT: PASS=4 FAIL=0".

3. File: tests/fixtures/267/wire-snapshot-zod4.json
   - Location: line 1618 (description) and line 1627 (query description).
   - Current behavior: both lines hold the old text.
   - Required behavior: same two replacements as step 2. Append one clause to the `refreshed_by` free-text note, for example "quick <id> 2026-10-12: room_search description and query describe reworded for the word tier (261012-kfn); no other tool changed", in the same style as the earlier entries.
   - Verify: `node tests/test-267-mcpv2-dual-era.cjs` prints "RESULT: PASS=5 FAIL=0".

4. File: CHANGELOG.md
   - Location: the top unreleased section, under Fixed or Changed (follow the file's current top block).
   - Current behavior: no entry for the description.
   - Required behavior: one plain-English entry: the room_search tool description now says a plain question works, that the exact phrase is tried first and the meaningful words second, and that an empty answer carries a reason. No em-dash.
   - Verify: `git diff -U0 CHANGELOG.md | grep -c -P '\x{2014}|\x{2013}'` prints 0 (the added lines hold no em-dash and no en-dash).

No regeneration command is needed because the connectors text is kept (step list above keeps data/connector-registry.json, data/mcp-tool-connectors.json and data/connector-coverage-ledger.json untouched). If the executor chooses to also reword hitl_why and layer_why at room.cjs lines 673 and 675, then run `node scripts/build-connector-registry.cjs` and commit the 2 to 3 changed files under data/. That option is not recommended.

Tests to run after the edits, in this order (the first four took 1.5 s, 2 s, 6 s and under 5 s in my baseline runs):
1. `node tests/test-234-tool-description-floor.cjs`
2. `node tests/test-267-mcpv2-zod4-contract.cjs`
3. `node tests/test-267-mcpv2-dual-era.cjs`
4. `node scripts/build-connector-registry.cjs --check`
5. `node tests/test-room-search-natural-language.cjs` (the word-tier behavior test; it does not read the description, PROVEN by grep)
6. `bash tests/run-all-267.sh` (catches any reader of the zod4 snapshot that I did not trace; not run by me)

Size: 4 files (1 source, 2 byte-pinned fixtures, 1 CHANGELOG). Optional extra: 3 generated data files, not recommended.

Tests to add: none required. The two existing byte pins already guard the text. A new test that asserts the description names the word tier would be a second pin on the same bytes; skip it.

## Non-Code Follow-ups

- Release lockstep applies when this ships (docs/RELEASE-CEREMONY-RULING-SYSTEM.md RULE 5). 32fcb604b is not on origin/main yet (sweep preamble), so fix the description in the same release as the word tier. If the word tier ships first, the model sees the old text for one release.
- The sweep line "Desktop and Cowork system-prompt text that describes room_search as substring-only must follow item 1" has no target: the handshake instructions carry no room_search text (Evidence entry 5). Strike or reword that line.
- Optional, not blocking: wire a real-model check (a Desktop or CLI session that asks a sentence question and shows the tool call input). I did not run one.
- knowledge-base.md: add one block on resolve.

## Classification

ITEM 1: NEW FAILURE (severity low, a wire-contract drift and not a code defect) - the description became incomplete when 32fcb604b added the word tier, and its clause "reach for room_graph ... instead of guessing at keywords" now steers the model away from the working sentence path. The code is correct. A fix touches 4 files (room.cjs, wire-snapshot-zod3.json, wire-snapshot-zod4.json, CHANGELOG.md) and needs no generated-file regeneration.

Honest alternative reading: WORKING with a documentation debt. The plan D5 chose this reading ("incomplete, not false"). I do not pick it because the description is the only guidance a foreign host model receives (test-234 header), and one of its three claims now points the wrong way. The main session decides if that justifies the NEW FAILURE label.

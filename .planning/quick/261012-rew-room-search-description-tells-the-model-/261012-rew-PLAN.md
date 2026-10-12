---
phase: quick-261012-rew
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/mcp/tools/room.cjs
  - tests/fixtures/267/wire-snapshot-zod3.json
  - tests/fixtures/267/wire-snapshot-zod4.json
  - CHANGELOG.md
autonomous: true
requirements: [QUICK-ROOM-SEARCH-DESC]
canon_parts: [7, 8]
user_setup: []
must_haves:
  truths:
    - "A host model that reads tools/list on the CLI, Desktop or Cowork sees a room_search description that says a plain question, a full sentence or a single term works."
    - "The description says, in this order: the exact text is tried first (case ignored); when no file holds it, files are ranked by the meaningful words; an empty reply carries a reason and means the room holds no answer for this wording; matching is literal, with no semantic or fuzzy search; the tool is read-only and local to this machine."
    - "The live room_search description is 801 bytes with sha256 419628b488c706978874978f9733210ed8121bf7ade0e9378e871cdf4e69c5ba, and the live query describe text is 128 bytes with sha256 59b4f04ccceae4e20ece06dd33ce25d5de8802e9aebb64b1659625cc80920912."
    - "Both wire snapshots (zod3 and zod4) hold the same two strings, byte for byte, and every other byte of each snapshot is unchanged (git numstat 2 2 per snapshot)."
    - "test-234 ends 0 failed; zod4-contract PASS=4 FAIL=0; dual-era PASS=5 FAIL=0; connector-registry OK; natural-language test PASS; run-all-267 PASS=33 FAIL=0 SKIP=1 (the baseline)."
    - "The change makes no network call and touches no Brain path (Canon Part 8)."
  artifacts:
    - path: "lib/mcp/tools/room.cjs"
      provides: "room_search description (String D) and query describe text (String Q)"
      contains: "Send a plain question, a full sentence, or a single term."
    - path: "tests/fixtures/267/wire-snapshot-zod3.json"
      provides: "zod 3 era wire pin of the room_search description and query describe text"
      contains: "means the room holds no answer for this wording"
    - path: "tests/fixtures/267/wire-snapshot-zod4.json"
      provides: "zod 4 era wire pin of the room_search description and query describe text"
      contains: "means the room holds no answer for this wording"
    - path: "CHANGELOG.md"
      provides: "One Fixed entry under the Unreleased v2.0.0-beta.66 block"
      contains: "### Fixed"
  key_links:
    - from: "lib/mcp/tools/room.cjs server.registerTool('room_search')"
      to: "tests/fixtures/267/wire-snapshot-zod3.json"
      via: "tests/test-267-mcpv2-zod4-contract.cjs check (a), strict string equality of the live tools/list description"
      pattern: "Send a plain question, a full sentence, or a single term\\."
    - from: "lib/mcp/tools/room.cjs server.registerTool('room_search')"
      to: "tests/fixtures/267/wire-snapshot-zod4.json"
      via: "tests/test-267-mcpv2-dual-era.cjs compareToSnapshot, description diffs not accepted"
      pattern: "Send a plain question, a full sentence, or a single term\\."
    - from: "query describe text in room.cjs"
      to: "both snapshots, properties.query.description"
      via: "the pin-check command PC in Task 1 (the 267 tests mask room_search inputSchema diffs, so no test guards this string)"
      pattern: "The exact text is tried first, then its meaningful words\\."
---

<objective>
Rewrite the room_search tool description and its query describe text so a host model learns that the tool takes a full sentence. Move the two byte-pinned wire snapshots in the same commit. Add one CHANGELOG Fixed line.

Purpose: commit 32fcb604b (quick 261012-kfn) added a second search tier. When the exact phrase has no hit, the tool ranks files by the meaningful words of the question. The description still says "case-insensitive substring" and sends conceptual questions to room_graph. The description is the only guidance that a host model receives. Source: .planning/debug/search-surface-qa-sweep-20261012/cluster-d/EVIDENCE.md (diagnosis, PROVEN pin table).

Tri-Polar: room_search is one MCP tool. One tools/list description serves the CLI, Claude Desktop and Cowork. lib/mcp/runtime-instructions.cjs carries no room_search text (PROVEN in cluster-d Evidence entry 5). One edit covers all 3 surfaces. No surface-specific code is necessary.

Canon Part 8: the change is text only. No network call, no Brain call, no new package. All tests in this plan run hermetic (hermeticEnv).

Canon Part 7: no new surface. The plan edits the existing tool text only.

Output: 4 changed files, 1 commit `fix(quick-261012-rew): ...`, and 261012-rew-SUMMARY.md.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@.planning/debug/search-surface-qa-sweep-20261012/cluster-d/EVIDENCE.md
@lib/mcp/tools/room.cjs (lines 612-641 only: the room_search registerTool call; lines 148-152: SEARCH_REASONS)
@tests/helpers/mcp-wire-267.cjs (lines 287-340: compareToSnapshot)

## Facts the executor needs (PROVEN by the planner on main @ 63b25583d, 2026-10-12)

- Old text occurs exactly 1 time in each of the 3 files. A repo grep (node_modules, .git, worktrees, .claude excluded) finds the old strings only in room.cjs, the 2 snapshots and 2 debug files. No generated copy exists. No script regenerates the snapshots.
- Pin sites: room.cjs line 616 (description) and line 619 (query describe). wire-snapshot-zod3.json line 1378 (description) and line 1386 (query description). wire-snapshot-zod4.json line 1618 (description) and line 1627 (query description).
- test-267-mcpv2-zod4-contract.cjs check (a) compares every live tool description to the zod3 snapshot with strict string equality. test-267-mcpv2-dual-era.cjs does the same against the zod4 snapshot.
- Both tests mask room_search inputSchema diffs (zod4-accepted-deltas.json line 287 holds the key room_search:inputSchema). Thus no existing test guards the query describe text in the snapshots. The pin-check command PC (Task 1 verify) closes this gap.
- Precedent commit e87ce10ba moved the suggest_next pin by a one-line edit in each snapshot. It did not edit the zod4 `refreshed_by` note. This plan follows that precedent: 2 lines per snapshot, no `refreshed_by` edit. (cluster-d step 3 suggested a `refreshed_by` clause. The orchestrator brief limits each snapshot to 2 lines. The brief wins.)
- Baselines, measured by the planner on the unchanged tree: test-234 "204 passed, 0 failed (prose-shape coverage: 48/48 registered tools)"; zod4-contract "RESULT: PASS=4 FAIL=0"; dual-era "RESULT: PASS=5 FAIL=0"; connector-registry "connector-registry: OK"; natural-language "PASS: test-room-search-natural-language -- 50 checks"; run-all-267 "Phase 267: PASS=33 FAIL=0 SKIP=1" (the 1 SKIP is the opt-in CLI live wire probe, ENV GAP). PC before the edit prints "LIVE TEXT MISMATCH a095ba4b4836 912085407728" and exits 1.
- CHANGELOG.md line 1 is `## [Unreleased] -- v2.0.0-beta.66 (in progress)`. Its block has `### Added` with 1 bullet and no `### Fixed`. The next heading is `## [2.0.0-beta.65] - 2026-10-06`. node lib/core/repo-version.cjs prints 2.0.0-beta.66. Do not invent a version.

## Exact strings (copy these bytes; do not retype them)

String D, the new description (801 bytes, ASCII only, 1 apostrophe in "session's", no double quote, no backslash, no em-dash, no en-dash; sha256 419628b488c706978874978f9733210ed8121bf7ade0e9378e871cdf4e69c5ba):

```
Search the markdown and HTML entries of this session's bound room, optionally scoped to a single section. Read-only, no side effects, and local to this machine. Send a plain question, a full sentence, or a single term. The tool first looks for your exact text, ignoring case. When no file holds that exact text, the tool ranks the files by the meaningful words in your question. It returns the best line from each of the top files. The reply names the tier that answered, phrase or words. An empty reply carries a reason and means the room holds no answer for this wording, so tell the person that. Matching is literal, with no semantic or fuzzy search, so a file that uses other words than yours is not found. For a question about how things in the room connect, use room_graph and run a graph query.
```

String Q, the new query describe text (128 bytes, ASCII only, no apostrophe, no double quote; sha256 59b4f04ccceae4e20ece06dd33ce25d5de8802e9aebb64b1659625cc80920912):

```
A plain question, a full sentence, or a single term. Case-insensitive. The exact text is tried first, then its meaningful words.
```

One word change from the cluster-d draft, with the check that forced it: the draft said "means the room has no answer to this question". For reason_code no_search_words, the reason text at room.cjs line 149 says the cause is the wording of the question ("the question has no words left to search for"), not the room content. Thus the draft sentence is false for that code. String D says "means the room holds no answer for this wording". That clause is true for all 3 reason codes (no_match, below_relevance_floor, no_search_words). cluster-d named this exact alternative. All other words of String D and String Q equal the cluster-d draft.

Old description (current bytes in all 3 files, 455 bytes):

```
Search the markdown and HTML entries of this session's bound room by case-insensitive substring, optionally scoped to a single section. Read-only, no side effects. It answers literal-recall questions well: a project name, a person, a funder, any term you expect to appear verbatim in the text. It does NOT do semantic or fuzzy matching, so for a conceptual or relational question reach for room_graph and run a graph query instead of guessing at keywords.
```

Old query describe text (current bytes in all 3 files, 47 bytes):

```
Search text (case-insensitive substring match).
```

CHANGELOG bullet, String C (no em-dash, no en-dash):

```
- **`room_search` now tells the host model that a plain question works.** The tool description and the query field say that the exact text is tried first and the meaningful words second, that an empty answer carries a reason and means the room holds no answer for that wording, and that the match is literal and stays on this machine. The search gained its word pass in quick 261012-kfn, but the old description still said substring only and sent conceptual questions to `room_graph`.
```
</context>

<tasks>

<task type="auto">
  <name>Task 1: Record the baseline, then replace the room_search description and query describe text in room.cjs and in both wire snapshots</name>
  <files>lib/mcp/tools/room.cjs, tests/fixtures/267/wire-snapshot-zod3.json, tests/fixtures/267/wire-snapshot-zod4.json</files>
  <action>
Warning: a peer session can hold changes in this working tree. Do not revert, stash or overwrite a change that this plan did not make.

Step 1 (guard). Run git status --porcelain on the 4 files of this plan: lib/mcp/tools/room.cjs, tests/fixtures/267/wire-snapshot-zod3.json, tests/fixtures/267/wire-snapshot-zod4.json, CHANGELOG.md. The output must be empty. If a line prints, stop and report STATUS BLOCKED with the path. Run git merge-base --is-ancestor 32fcb604b HEAD. It must exit 0, because String D describes the word tier of that commit. If it exits 1, stop and report BLOCKED.

Step 2 (baseline). Run bash tests/run-all-267.sh before any edit. Record the last summary line in the SUMMARY. The planner measured "Phase 267: PASS=33 FAIL=0 SKIP=1". If your count differs, your count is the baseline. Record both values and the difference.

Step 3 (source). In lib/mcp/tools/room.cjs, inside server.registerTool('room_search', ...), use the Edit tool. Replace the old description text on line 616 with String D. Keep the double quotes of the JavaScript string, because String D holds an apostrophe. Replace the old query describe text on line 619 with String Q. Keep the single quotes, because String Q holds no apostrophe. Do not change the title, the section describe text ('Optional section slug to scope the search to.'), the handler, SEARCH_REASONS or any constant. Do not change the connectors export (hitl_why and layer_why at lines 673 and 675 stay "bounded substring search"; they are gate metadata that the model does not receive, and a change there regenerates data/*.json files that this plan must not touch).

Step 4 (zod3 snapshot). In tests/fixtures/267/wire-snapshot-zod3.json, use the Edit tool. Replace the old description text on line 1378 with String D. Replace the old query description text on line 1386 with String Q. Each old string occurs 1 time in the file. String D and String Q hold no double quote and no backslash, so the JSON text equals the string text. Do not run a formatter, jq or a JSON.stringify rewrite on the file. Do not edit any other line.

Step 5 (zod4 snapshot). In tests/fixtures/267/wire-snapshot-zod4.json, do the same 2 replacements on line 1618 (description) and line 1627 (query description). Do not edit the refreshed_by note (precedent e87ce10ba; the orchestrator brief limits this file to 2 lines). Do not edit any other line.

Step 6 (verify). Run the 3 commands of the verify block. Then run the pin-check command PC (the last command of the verify block). PC spawns the real server through tests/helpers/mcp-wire-267.cjs, reads the live room_search strings, checks their sha256 against String D and String Q, and checks that both snapshots hold the same bytes. Then run git diff --numstat on the 3 files. Each line must read "2 2". Do not commit in this task. Task 2 makes the only commit.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && set -o pipefail && node tests/test-234-tool-description-floor.cjs 2>&1 | tail -1 && node tests/test-267-mcpv2-zod4-contract.cjs 2>&1 | tail -1 && node tests/test-267-mcpv2-dual-era.cjs 2>&1 | tail -1 && git diff --numstat -- lib/mcp/tools/room.cjs tests/fixtures/267/wire-snapshot-zod3.json tests/fixtures/267/wire-snapshot-zod4.json</automated>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && node -e "const h=require('./tests/helpers/mcp-wire-267.cjs');const fs=require('fs');const c=require('crypto');const HD='419628b488c706978874978f9733210ed8121bf7ade0e9378e871cdf4e69c5ba',HQ='59b4f04ccceae4e20ece06dd33ce25d5de8802e9aebb64b1659625cc80920912';(async()=>{const e=h.hermeticEnv({});let live;try{live=await h.wireSnapshot(h.LOCAL_SERVER,{env:e.env,timeoutMs:30000});}finally{e.cleanup();}const pick=s=>{const t=s.tools.find(x=>x.name==='room_search');return [t.description,t.inputSchema.properties.query.description];};const H=x=>c.createHash('sha256').update(x,'utf8').digest('hex');const L=pick(live);if(H(L[0])!==HD||H(L[1])!==HQ){console.error('LIVE TEXT MISMATCH',H(L[0]).slice(0,12),H(L[1]).slice(0,12));process.exit(1);}for(const f of ['zod3','zod4']){const S=pick(JSON.parse(fs.readFileSync('tests/fixtures/267/wire-snapshot-'+f+'.json','utf8')).local);if(S[0]!==L[0]||S[1]!==L[1]){console.error('PIN MISMATCH '+f);process.exit(1);}}console.log('PINS OK',Buffer.byteLength(L[0]),Buffer.byteLength(L[1]));})().catch(err=>{console.error(err);process.exit(1);});"</automated>
  </verify>
  <done>
test-234 prints "204 passed, 0 failed (prose-shape coverage: 48/48 registered tools)". zod4-contract prints "RESULT: PASS=4 FAIL=0". dual-era prints "RESULT: PASS=5 FAIL=0". git diff --numstat prints "2 2" for each of the 3 files. PC prints "PINS OK 801 128" and exits 0. The baseline run-all-267 line is recorded. No commit exists yet.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add the CHANGELOG Fixed line, run the full verify list, and make the one commit</name>
  <files>CHANGELOG.md</files>
  <action>
Step 1 (CHANGELOG). Run git status --porcelain CHANGELOG.md. If it prints a line, a peer changed the file after Task 1. Stop and report BLOCKED. Do not commit a peer hunk. Else, open CHANGELOG.md. In the block under line 1 (`## [Unreleased] -- v2.0.0-beta.66 (in progress)`), find the `### Added` bullet and the blank line before `## [2.0.0-beta.65] - 2026-10-06`. Insert, after the `### Added` bullet, 1 blank line, the heading `### Fixed`, and String C. Keep the existing blank line before the beta.65 heading. If a `### Fixed` heading already exists in the Unreleased block, add String C as the last bullet under it and do not add a second heading. Do not change a version, a heading or another entry. This follows the file convention: beta.65 lists `### Added` before `### Fixed`.

Step 2 (full verify list). Run every command in the verify block, in the order given. Every command must pass. run-all-267 must print the same PASS, FAIL and SKIP counts as the Task 1 baseline (planner value: PASS=33 FAIL=0 SKIP=1). If a command fails, find the root cause and fix it inside the 4 files of this plan only. Do not edit a test or a fixture other than the 2 snapshots to make a check pass. If the fix needs another file, stop and report NEEDS_HUMAN with one question.

Step 3 (commit). Run git commit --only with explicit paths. Do not run git add -A. Do not run git commit -a. All 4 files are tracked, so no git add -f is necessary. The command is: git commit --only -m "MSG" -- lib/mcp/tools/room.cjs tests/fixtures/267/wire-snapshot-zod3.json tests/fixtures/267/wire-snapshot-zod4.json CHANGELOG.md. MSG has a subject line, a blank line, a body and a trailer. Subject: fix(quick-261012-rew): room_search description says a full sentence works (phrase first, then words; empty means no answer for this wording). Body, 3 lines: the 2 wire snapshots moved by hand, 2 lines each, precedent e87ce10ba; the connectors text and data/*.json are not changed; Tri-Polar: one tools/list description serves CLI, Desktop and Cowork. After the body, add 1 blank line, then the trailer line. The orchestrator brief names the trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Use that line only if Claude Fable 5.1 is the model that runs this executor. Else use the Co-Authored-By line from the commit attribution reminder of your own session, and record the difference in the SUMMARY.

Step 4 (collision guard). Run git merge-base --is-ancestor on the new commit sha and HEAD. It must exit 0. Run git show --stat on the new sha. It must list exactly the 4 files. Do not push. Do not release. Do not bump a version. Do not commit the SUMMARY or STATE.md; the orchestrator commits the planning documents.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && set -o pipefail && node tests/test-234-tool-description-floor.cjs 2>&1 | tail -1 && node tests/test-267-mcpv2-zod4-contract.cjs 2>&1 | tail -1 && node tests/test-267-mcpv2-dual-era.cjs 2>&1 | tail -1 && node scripts/build-connector-registry.cjs --check 2>&1 | grep -x "connector-registry: OK" && node tests/test-room-search-natural-language.cjs 2>&1 | tail -1 && bash tests/run-all-267.sh 2>&1 | grep "^Phase 267:"</automated>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && git diff -U0 HEAD~1 HEAD -- CHANGELOG.md lib/mcp/tools/room.cjs tests/fixtures/267/wire-snapshot-zod3.json tests/fixtures/267/wire-snapshot-zod4.json | grep '^+' | grep -c -P '\x{2014}|\x{2013}'; git show --stat --format='%h %s' HEAD | head -8; git diff --numstat HEAD~1 HEAD</automated>
  </verify>
  <done>
CHANGELOG.md has a `### Fixed` heading in the Unreleased v2.0.0-beta.66 block with String C as its bullet (numstat "3 0", or "1 0" if the heading already existed). All 6 verify commands pass: test-234 "0 failed", zod4-contract "PASS=4 FAIL=0", dual-era "PASS=5 FAIL=0", "connector-registry: OK", the natural-language test PASS, run-all-267 equal to the Task 1 baseline (planner value "Phase 267: PASS=33 FAIL=0 SKIP=1"). The dash count on added lines prints 0. One commit `fix(quick-261012-rew): ...` holds exactly the 4 files, is an ancestor of HEAD, and is not pushed.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| MCP server -> host model (tools/list) | The description is the only room_search guidance that a host model on the CLI, Desktop or Cowork receives. A false claim there steers tool use. |
| working tree -> git history | A peer session can hold uncommitted changes in the same tree. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-rew-01 | Spoofing (misleading capability claim) | room_search description | mitigate | String D says "literal, with no semantic or fuzzy search" and says the tool is local; the empty-reply clause says "for this wording", which is true for all 3 reason codes (room.cjs lines 148-152). |
| T-rew-02 | Tampering | wire snapshots | mitigate | Edit tool replaces 1 string per site; no formatter; git numstat must read 2 2 per snapshot; PC checks sha256 of live text and byte equality of both pins, including the query text that the 267 tests mask. |
| T-rew-03 | Tampering | git history | mitigate | git commit --only with 4 explicit paths; no git add -A or commit -a; porcelain guard before edits and before the CHANGELOG edit; merge-base --is-ancestor after the commit. |
| T-rew-04 | Information disclosure | Brain boundary (Canon Part 8) | accept | Text-only change; no network call, no Brain call, no room content leaves the machine; tests run under hermeticEnv. |
</threat_model>

<verification>
1. node tests/test-234-tool-description-floor.cjs: "204 passed, 0 failed".
2. node tests/test-267-mcpv2-zod4-contract.cjs: "RESULT: PASS=4 FAIL=0".
3. node tests/test-267-mcpv2-dual-era.cjs: "RESULT: PASS=5 FAIL=0".
4. node scripts/build-connector-registry.cjs --check: "connector-registry: OK".
5. node tests/test-room-search-natural-language.cjs: "PASS: test-room-search-natural-language -- 50 checks".
6. bash tests/run-all-267.sh: the same counts as the Task 1 baseline (planner value PASS=33 FAIL=0 SKIP=1).
7. PC (Task 1 verify, second command): "PINS OK 801 128".
8. No em-dash and no en-dash on any added line; the commit holds exactly 4 files.
</verification>

<success_criteria>
- The live room_search description equals String D and the live query describe text equals String Q (sha256 match through PC).
- Both snapshots hold the same 2 strings; 2 lines changed per snapshot; the refreshed_by note is unchanged.
- The connectors text (hitl_why, layer_why) and data/*.json are unchanged; connector-registry --check is OK.
- One CHANGELOG Fixed bullet in the Unreleased v2.0.0-beta.66 block; no version change.
- One local commit; not pushed; not released.
</success_criteria>

<output>
Create `.planning/quick/261012-rew-room-search-description-tells-the-model-/261012-rew-SUMMARY.md` when done. Record: the baseline run-all-267 line, every verify result as PROVEN, the PC output, the commit sha, the trailer that was used, and this statement: "Whether the new text changes host-model behavior is UNVERIFIED; no real-model session was run." Do not commit the SUMMARY.
</output>

---
phase: quick-261012-sbz
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified:
  - tests/test-3692-lexicon-generic-entries.cjs
  - tests/run-all-3692.sh
  - lib/core/part8-room-lexicon.cjs
  - CHANGELOG.md
autonomous: true
requirements: [QUICK-261012-SBZ]
canon_parts: [7, 8]
severity: blocker
user_setup: []
must_haves:
  truths:
    - "With the SYNTHETIC fixture room bound, classify({question}, {toolName:'brain_ask', roomDir}) returns allow for all 26 positives (the 6 named questions and the 20 derived questions of the debug corpus). With no room bound, the same 26 return allow."
    - "With the fixture bound, the retention set still blocks with class room_content and the right token_class: person full name -> person, two-word company -> room_term, venture_name from ROOM.md -> venture_name, claim sentence -> claim, one-word institution -> room_term."
    - "The V1f sentence 'How should I validate the solar cold locker with resellers?' still blocks room_content/room_term with the fixture bound (S1 keeps the entry because none of solar, cold, locker is in the generic union) and allows with no room bound. tests/test-3692-theo-verdict.cjs is byte-unchanged and green."
    - "The 10 negatives block with the fixture bound and with no room bound: X1, X3, X5, X8, X9 class content_set; X2, X7, X10 room_content/private_context; X4, X6 room_content/identifier."
    - "loadRoomLexicon on the fixture keeps no room_file entry titled with a CORE_SECTIONS slug and no room_term entry made only of generic-union tokens; it keeps person 1, venture_name 1, claim 1, room_name 1 and room_term 3 (the two-word company, the one-word institution, the V1f term). _genericTokenSet() equals the union of the five sources (per D-S1)."
    - "The CLI PreToolUse hook (scripts/part8-egress-guard-hook.cjs) with CLAUDE_ACTIVE_ROOM set to the fixture lets N1 and N5 proceed (exit 0) and blocks the person question and X2 (exit 2): the hook and in-process classify agree."
    - "bash tests/run-all-3692.sh: the only change in its '>>> ' status lines against the pre-change baseline is one added line for the new leg, reading PASSED; FAILED count is unchanged."
    - "lib/core/part8-egress-guard.cjs, lib/core/brain-client.cjs, lib/core/refusal-messaging.cjs and scripts/part8-egress-guard-hook.cjs are byte-unchanged; the matchLexicon function text in lib/core/part8-room-lexicon.cjs is byte-identical to the pre-change text."
    - "If the 34 scratch room copies exist: the 26-set room-induced false positives go from 30 to 6 of 884 (1 room, room_term 6), retention lost is 205 of 9135 (room_file 71, room_term 134; claim, person, venture_name, room_name 0), and 0 negatives leak. Only counts land in the quick folder."
  artifacts:
    - path: "tests/test-3692-lexicon-generic-entries.cjs"
      provides: "RED-then-GREEN test: synthetic fixture room.db, 26 positives, retention set, V1f term, 10 negatives, lexicon build, CLI hook leg, net guard"
      contains: "_genericTokenSet"
    - path: "tests/run-all-3692.sh"
      provides: "One run_if leg for the new test, next to the theo-verdict leg"
      contains: "tests/test-3692-lexicon-generic-entries.cjs"
    - path: "lib/core/part8-room-lexicon.cjs"
      provides: "S1: makeEntry drops room_term and room_file entries made only of generic-union tokens; lazy _genericTokenSet seam"
      exports: ["loadRoomLexicon", "matchLexicon", "resolveLexiconRoom", "_resetLexiconCache", "_genericTokenSet", "KINDS"]
    - path: "CHANGELOG.md"
      provides: "One Fixed bullet under ## [Unreleased] -- v2.0.0-beta.66 (in progress)"
      contains: "261012-sbz"
  key_links:
    - from: "lib/core/part8-room-lexicon.cjs makeEntry"
      to: "lib/core/part8-egress-guard.cjs exports (CANONICAL_PHRASES, COMMAND_SLUG_SET, METHODOLOGY_TOKEN_SET, QUESTION_FUNCTION_WORDS)"
      via: "the g argument that loadRoomLexicon passes from the lazy _guardSets(); no new require of the guard"
      pattern: "_genericTokenSet\\(g\\)"
    - from: "lib/core/part8-room-lexicon.cjs _genericTokenSet"
      to: "lib/core/section-registry.cjs CORE_SECTIONS"
      via: "lazy require inside the function body (pure module, no cycle)"
      pattern: "require\\('./section-registry.cjs'\\)"
    - from: "lib/core/part8-egress-guard.cjs theoVerdict (step 3, matchLexicon)"
      to: "lib/core/part8-room-lexicon.cjs loadRoomLexicon"
      via: "unchanged call; one classify function serves the CLI hook and the brain-client belt used on Desktop and Cowork"
      pattern: "loadRoomLexicon\\(roomDir\\)"
---

<objective>
Fix the Part 8 room lexicon false positive with shape S1, the shape the navigator chose on 2026-10-12 (debug session part8-egress-guard-room-lexicon-false-positive-blocks-theo, section Required Code Changes, decision 1). In this plan, D-S1 names that decision.

D-S1: at lexicon build time, drop a room_term or room_file entry when every one of its tokens is in the union of: tokens of CANONICAL_PHRASES, COMMAND_SLUG_SET, METHODOLOGY_TOKEN_SET, QUESTION_FUNCTION_WORDS, and the tokenized CORE_SECTIONS slugs and labels. Claim, person, venture_name and room_name entries are untouched. matchLexicon is untouched. The guard's refusal text is untouched (companion A is a later quick).

Purpose: Larry must reach Theo with a generic methodology question ("which framework tests a business model's riskiest assumption first") when the bound room has an artifact titled business-model or a fallback-extracted company named Design. Today the lexicon keeps such entries and refuses the question (30 of 884 evaluations over 34 local rooms, 9 rooms). Canon Part 8 stays absolute: real room content (names, claims, the venture name, numbers, ids, private phrases) must still block.

Output: a RED test, the S1 change in lib/core/part8-room-lexicon.cjs, one run_if leg, one CHANGELOG bullet, and counts-only verification files in the quick folder.

Out of scope (do not do): the survey harness gate (test 5, quick 261012-sc0); companion A (refusal names the entry kind); GAP1 and GAP2 (their own debug session); any edit to lib/core/part8-egress-guard.cjs, lib/core/brain-client.cjs, lib/core/refusal-messaging.cjs or scripts/part8-egress-guard-hook.cjs; any room edit; push, release, version bump.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@.planning/STATE.md
@.planning/debug/part8-egress-guard-room-lexicon-false-positive-blocks-theo.md
@lib/core/part8-room-lexicon.cjs
@.planning/debug/part8-egress-guard-room-lexicon-false-positive-blocks-theo/scripts/build-protos.cjs
@.planning/debug/part8-egress-guard-room-lexicon-false-positive-blocks-theo/scripts/corpus.cjs

Do not read or copy anything under .planning/debug/part8-egress-guard-room-lexicon-false-positive-blocks-theo/private/. It holds real room text.

<interfaces>
Facts the planner proved on main at 1553e3b43 or later (PROVEN by a scratch probe on a synthetic room; no repo file was changed):

lib/core/part8-room-lexicon.cjs (254 lines):
- `tokenize(s)`: lowercase, split on `/[^\p{L}\p{N}]+/u`, drop empty.
- `_guardSets()` (60-64): lazy `require('./part8-egress-guard.cjs')`. The guard requires the lexicon at load time (guard line 903, inside try/catch), so a top-level require of the guard from the lexicon is a cycle. loadRoomLexicon calls `_guardSets()` once and passes the module as `g` to `makeEntry(kind, text, g)`.
- `makeEntry` (87-119): the S1 insertion point is directly after the line `  if (generic) return null;` (line 101), before `const tokens = tokenize(clean);`. This is the same anchor build-protos.cjs (ANCHOR_GENERIC) uses.
- `matchLexicon` (226-246): do not touch.
- module.exports (248-254): loadRoomLexicon, matchLexicon, resolveLexiconRoom, _resetLexiconCache, KINDS.

lib/core/part8-egress-guard.cjs exports used: QUESTION_FUNCTION_WORDS (Set), METHODOLOGY_TOKEN_SET (Set, some entries hold a space or hyphen, so tokenize each), COMMAND_SLUG_SET (Set of slugs such as hyphenated names, tokenize each), CANONICAL_PHRASES (frozen Array of lowercased framework names, tokenize each). The guard is NOT edited.

lib/core/section-registry.cjs: `CORE_SECTIONS` is an object of 11 slugs, each with a `label` (for example 'team-execution' -> 'TEAM & EXECUTION', 'legal-ip' -> 'LEGAL & IP'). The module requires only fs and path at load time (its command-registry read is lazy). Today every CORE_SECTIONS token is already in the other four sources (PROVEN), so the section source is a stability guard against a framework-names refresh; it is still required by D-S1.

Union size at HEAD: 844 tokens (canonical phrases 415, command slugs 114). PROVEN.

Fixture writers (test only):
- `require('lib/core/room-db.cjs').openRoomDb(roomDir, { allowExtension: true })` and `.closeRoomDb(db)` create and migrate `<roomDir>/.mindrian/room.db`.
- `require('lib/core/navigation.cjs').writeEntityNode(db, { entityType, name, sessionId, evidenceTier })`: entityType is one of company, technology, market; returns `{ ok: true }`.
- `require('lib/core/navigation.cjs').writeClaimNode(db, { knowledge_type: 'fact', text, sessionId, sourceSegment })`: returns `{ ok: true }`; the node type is claim.
- `require('lib/core/node-insert.cjs').insertNode(db, id, type, propsJson, { epistemic_type })`: use it for type 'Artifact' (props `{ title, section }`, epistemic_type 'observation', the lazygraph-ops.cjs shape), type 'person' and type 'organization' (props `{ name }`, epistemic_type 'extracted_fact'). No navigation writer exists for those three types.
- The lexicon reads `SELECT type, properties FROM nodes WHERE type IN (...)`: entity/company/technology/market/product/organization -> room_term from props.name; person -> person; claim/CausalClaim -> claim from props.text; artifact/Artifact -> room_file from props.title. ROOM.md frontmatter `venture_name:` -> venture_name. The room dir basename -> room_name.

Test harness pattern to copy (tests/test-3692-theo-verdict.cjs): isolation block at lines 41-55 (TMP via mkdtemp, HOME, USERPROFILE, MINDRIAN_ROOMS_HOME, delete CLAUDE_ACTIVE_ROOM and vendor keys), `leg(name, fn)` and `ok(cond, msg)` at 128-145 (PASS:/FAIL: lines, final `PASS: n FAIL: m`, exit 0 or 1), `spawnHook` at 165-186 (stdin JSON with tool_name `mcp__plugin_mos_mindrian-brain__brain_ask`, tool_input `{ question }`, env CLAUDE_ACTIVE_ROOM; exit 2 = blocked, exit 0 = proceed).

Runner: tests/run-all-3692.sh line 85 is the theo-verdict run_if leg. Add the new leg on the next line. No test pins the number of legs (PROVEN by grep).

Other tests that expect a lexicon room_term block (test-246, test-245, test-260906, test-260917, part8-egress-guard-hook.test.cjs, test-3692-theo-verdict V1f) all use the term 'solar cold locker'. S1 keeps it. test-3692-closure D11 expects its room_term probe to block with token_class name (a content rule after the lexicon); S1 only removes lexicon matches, so D11 is not affected.

Planner probe results on a synthetic fixture (the fixture specified in Task 1), current code vs the debug S1 prototype:
- current code, fixture bound: 11 of 26 positives block (N1, D3 room_file; N2, N5, N6, D1, D9, D13, D15, D17, D19 room_term); X4 blocks as room_term instead of identifier; the hook blocks N1 with exit 2. This is the RED state.
- S1 prototype, fixture bound: 0 of 26 block; the 10 negatives match the table; the full retention set blocks with the right token_class; V1f still blocks room_term; lexicon kinds person 1, venture_name 1, claim 1, room_name 1, room_term 3, room_file 0.
- Known S1 residual: the token 'segment' is in none of the five sources. An entity named 'Customer Segment' or 'Segment' stays in the lexicon and still blocks N6. Do not put a name with 'segment' in the generic fixture. Record this residual in the SUMMARY; the gate quick 261012-sc0 owns it.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED - synthetic fixture test for generic-only lexicon entries, plus the runner leg</name>
  <files>tests/test-3692-lexicon-generic-entries.cjs, tests/run-all-3692.sh</files>
  <behavior>
    - L0 fixture validity: every token of every generic fixture name is in the union U that the test computes itself from the guard exports and CORE_SECTIONS; each retention name ('Tamsin Rourke', 'Quillfern Labs', 'Veldmark', 'solar cold locker') has at least 1 token outside U; data/framework-names.json framework_names has 391 or more entries. Passes before and after the fix.
    - L1 lexicon build: loadRoomLexicon(fixture).ok is true; no room_file entry text equals a CORE_SECTIONS slug; no room_term entry text equals a generic fixture name; kind counts are person 1, venture_name 1, claim 1, room_name 1, room_term 3, room_file 0; `_genericTokenSet` is an exported function and its Set has the same size and members as U. Fails before the fix.
    - L2 the 26 positives with the fixture bound: all allow. Fails before the fix (11 block).
    - L3 the 26 positives with no room bound: all allow. Passes before and after.
    - L4 retention with the fixture bound: 'which framework fits Tamsin Rourke' -> room_content/person; 'which framework fits Quillfern Labs' -> room_content/room_term; 'which framework fits Brightmoor Kiln' -> room_content/venture_name; the claim sentence verbatim -> room_content/claim; 'which framework fits Veldmark' -> room_content/room_term.
    - L5 V1f: 'How should I validate the solar cold locker with resellers?' -> room_content/room_term with the fixture bound; allow with no room bound.
    - L6 negatives: X1, X3, X5, X8, X9 -> block, class content_set; X2, X7, X10 -> block, room_content/private_context; X4, X6 -> block, room_content/identifier. Run with the fixture bound and with no room bound. Fails before the fix (X4 gives room_term with the fixture bound).
    - L7 CLI hook: with CLAUDE_ACTIVE_ROOM = fixture, N1 and N5 exit 0; the L4 person question and X2 exit 2. Fails before the fix (N1 exits 2).
    - L8 net guard: the replaced fetch was called 0 times.
  </behavior>
  <action>
Start with a pre-flight. Record the pre-change commit: write the output of `git rev-parse HEAD` to `.planning/quick/261012-sbz-part-8-room-lexicon-drops-entries-made-o/261012-sbz-pre-sha.txt`. Task 3 uses this sha. Run `git status --short -- lib/core/part8-room-lexicon.cjs tests/run-all-3692.sh tests/test-3692-lexicon-generic-entries.cjs CHANGELOG.md`. If any of these paths shows a change that this quick did not make, stop and report BLOCKED. Do not revert a change you do not own. Then run `bash tests/run-all-3692.sh` and save the full output to `261012-sbz-3692-baseline.txt` in the quick folder. This is the baseline for Task 3. The runner takes about 6 minutes (the planner measured 5 min 49 s), so use the 600000 ms Bash timeout or run it in the background. At planning time the runner reported `Phase 369.2: PASSED=70 FAILED=0 SKIPPED=0 KNOWN=0` (PROVEN); use your own run as the baseline.

Create tests/test-3692-lexicon-generic-entries.cjs. Use CommonJS, `'use strict'`, built-in modules only, zero npm deps. Add a header comment with these items: the quick id 261012-sbz; the debug session slug; decision D-S1 in one sentence; the leg list L0 to L8; the Tri-Polar statement (one classify function, lib/core/part8-egress-guard.cjs, serves the CLI PreToolUse hook and the in-process brain-client belt that the MCP server uses on Desktop and Cowork; L2 to L6 call that function in-process and L7 spawns the hook); the statement that every string in the file is synthetic and no real room is opened; and exit codes 0 pass, 1 fail, 77 ENV GAP. Do not use an em-dash or an en-dash anywhere in the file.

Isolation, before any require of plugin code. Copy the block from tests/test-3692-theo-verdict.cjs lines 41-55: TMP from `fs.mkdtempSync(path.join(os.tmpdir(), 'mos3692-lexgen-'))`, HOME, USERPROFILE and MINDRIAN_ROOMS_HOME inside TMP, delete CLAUDE_ACTIVE_ROOM, TAVILY_API_KEY and OPENALEX_API_KEY. Replace globalThis.fetch with a function that increments a counter and throws (Canon Part 8: no network in this test). If `require('node:sqlite')` throws, print `SKIP: node:sqlite unavailable (ENV GAP)` and exit 77.

Generate the 26 positives with a copy of the corpus.cjs generator, so they equal the debug corpus at this data version. NAMED is the 6 literal strings from corpus.cjs. The derived 20 use index 10 + k*20 for k = 0 to 19 into framework_names of data/framework-names.json (read through path.join(ROOT, 'data', 'framework-names.json')), with the 4 templates in the corpus.cjs order. Copy the 10 NEGATIVES literally with their ids X1 to X10 and the expected class per id. Do not require anything from .planning/ at run time.

Build the fixture room in TMP/rooms/fixture-room (basename fixed, so the room_name entry is 'fixture room'). Write ROOM.md with the frontmatter line `venture_name: Brightmoor Kiln`. Open room.db with openRoomDb(roomDir, { allowExtension: true }) and close it in a finally block with closeRoomDb. Seed these nodes:
(a) one Artifact node per key of `require(ROOT + '/lib/core/section-registry.cjs').CORE_SECTIONS` (iterate the object, do not hard-code the 11 slugs) through insertNode with id 'artifact:sbz:' + slug, type 'Artifact', props { title: slug, section: slug }, epistemic_type 'observation';
(b) company entities through writeEntityNode with evidenceTier 'fallback', named Design, Value, Customer, Canvas, Strategy, Innovation, Model, Market, Lean, Business, Proposition, Dominant, Loop, Diagrams, Theory, Solution, Options, Trends;
(c) technology entities through writeEntityNode with evidenceTier 'fallback', named Value Proposition, Business Model, Innovation Management, Real Options, Three Horizons, Stock Flow, Technology Adoption, Decision Pods, Search Gradient, Problem Taxonomy, Design Strategy, Customer Value;
(d) the retention set: person 'Tamsin Rourke' through insertNode (type 'person', props { name }, epistemic_type 'extracted_fact'); company 'Quillfern Labs' through writeEntityNode; organization 'Veldmark' through insertNode (type 'organization', props { name }, epistemic_type 'extracted_fact'); one claim through writeClaimNode with knowledge_type 'fact', text 'Larkspur depots cut chiller downtime by forty percent after the retrofit', sessionId 'sbz', sourceSegment 'seg-sbz-1'; technology 'solar cold locker' through writeEntityNode (the V1f term).
Do not add a name that contains the word segment (the known S1 residual). Check each writer result and throw on `ok !== true`.

Compute U in the test itself: tokenize (same regex as the lexicon) every entry of guard.CANONICAL_PHRASES, guard.COMMAND_SLUG_SET, guard.METHODOLOGY_TOKEN_SET and guard.QUESTION_FUNCTION_WORDS, and every CORE_SECTIONS slug and label. Call `lexMod._resetLexiconCache()` before every bound leg. Call `guard.classify({ question: q }, { toolName: 'brain_ask', roomDir })` with roomDir set to the fixture path or null. For L7, copy spawnHook from tests/test-3692-theo-verdict.cjs (ask verb only, timeout 8000 ms, env with CLAUDE_ACTIVE_ROOM). Implement L0 to L8 as the behavior block states. Start each leg name with its id and a colon, for example `L2: the 26 positives allow with the fixture bound`, so that the verify grep finds it. Each failure message names the question id and the verdict, class and token_class. A failure message may name a fixture string, because every fixture string is synthetic. End with `PASS: n FAIL: m`, remove TMP, and exit 0 or 1.

In tests/run-all-3692.sh, add one line directly after line 85 (the theo-verdict run_if line), in the same column layout: `run_if "3692: lexicon drops generic-only room names (quick 261012-sbz)"  tests/test-3692-lexicon-generic-entries.cjs  node tests/test-3692-lexicon-generic-entries.cjs`. The runner header says only plan 34 edits the file. This leg is the one that debug test 1 names for this runner, so add it anyway. Do not change any other line.

Run the new test and save the output to `261012-sbz-red.txt` in the quick folder. The expected RED state: L1, L2, L6 and L7 fail; L0, L3, L4, L5 and L8 pass; exit code 1. If L0, L3, L4, L5 or L8 fails, the fixture or the harness is wrong. Fix the test before you commit. Do not commit a test that is red for the wrong reason.

Commit RED. Run `git add -- tests/test-3692-lexicon-generic-entries.cjs` (a new file must be known to git before `commit --only`). Then run `git commit --only -m "test(quick-261012-sbz): RED, room lexicon keeps names made only of methodology words" -m "Synthetic fixture room.db: CORE_SECTIONS artifact titles and generic TitleCase entities block 11 of the 26 methodology questions; retention set, V1f term and 10 negatives pinned. Leg added to tests/run-all-3692.sh." -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" -- tests/test-3692-lexicon-generic-entries.cjs tests/run-all-3692.sh`. Do not use `git add -A` or `git commit -a`. After the commit, run `git merge-base --is-ancestor <sha> HEAD` to prove the commit is in HEAD.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && Q=.planning/quick/261012-sbz-part-8-room-lexicon-drops-entries-made-o && cat $Q/261012-sbz-pre-sha.txt && tail -n 3 $Q/261012-sbz-3692-baseline.txt; node tests/test-3692-lexicon-generic-entries.cjs > $Q/261012-sbz-red.txt 2>&1; echo "test exit=$? (expect 1)"; grep -E '^(PASS|FAIL): L[0-9]' $Q/261012-sbz-red.txt | cut -c1-160; tail -n 1 $Q/261012-sbz-red.txt; grep -c 'test-3692-lexicon-generic-entries.cjs' tests/run-all-3692.sh; git log -1 --stat --format=%s | head -4; LC_ALL=C grep -cP '\xE2\x80\x94|\xE2\x80\x93' tests/test-3692-lexicon-generic-entries.cjs tests/run-all-3692.sh</automated>
  </verify>
  <done>The test exists, exits 1, and fails exactly L1, L2, L6 and L7 for the reasons in the behavior block. The runner has 1 new run_if line after the theo-verdict line. The RED commit is in HEAD and holds only these 2 files. The dash count is 0 in both files. The baseline runner output and the pre-change sha are in the quick folder.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: GREEN - S1 in makeEntry with a lazy generic token set (per D-S1)</name>
  <files>lib/core/part8-room-lexicon.cjs</files>
  <behavior>
    - The new test exits 0 with L0 to L8 PASS.
    - A room_term or room_file entry whose every token is in the union is dropped. An entry with 1 or more tokens outside the union is kept (the V1f term, 'Quillfern Labs', 'Veldmark').
    - claim, person, venture_name and room_name entries are built exactly as before.
    - matchLexicon is byte-identical. The guard is not edited.
  </behavior>
  <action>
Edit lib/core/part8-room-lexicon.cjs only, to implement D-S1. Use .planning/debug/part8-egress-guard-room-lexicon-false-positive-blocks-theo/scripts/build-protos.cjs (shape S1) as the reference implementation, but change two things. First, require section-registry with a relative path ('./section-registry.cjs'), never with REPO_ROOT. Second, do not read repo prose (that is S2, which the navigator rejected).

Add 2 module-level variables near `_cache`: `_genericTokens` (null) and `_genericTokensFor` (null). Add a function `_genericTokenSet(g)`. If g is not given, it uses `_guardSets()`. It returns the cached Set when `_genericTokensFor === g`. Otherwise it builds a new Set: tokenize every entry of g.CANONICAL_PHRASES (an Array; use `|| []`), g.COMMAND_SLUG_SET, g.METHODOLOGY_TOKEN_SET and g.QUESTION_FUNCTION_WORDS (Sets; skip a source that is not iterable), and every slug and every label of `require('./section-registry.cjs').CORE_SECTIONS`. The require is inside the function body, so it is lazy. section-registry.cjs is a pure module that requires only fs and path at load time, so there is no cycle. The function then stores the Set and g, and returns the Set. Do not add a top-level require of the guard or of section-registry. The guard requires this module at load time, and the hook cold start must not grow.

In makeEntry, directly after the line `  if (generic) return null;`, add the S1 rule. When kind is 'room_term' or 'room_file' and every token of `tokenize(clean)` is in `_genericTokenSet(g)`, return null. Do not change any other line of makeEntry. Rewrite the comment above makeEntry (lines 82-86) in plain words and with no em-dash. The comment states that the closed-list rule still applies to every kind. It states that room terms and artifact titles made only of framework-name words, command-name words, methodology words, question words or core section names are dropped (navigator decision 2026-10-12, shape S1). It states that one word outside that union keeps the entry. It states that claim, person, venture_name and room_name entries never pass this rule. It names the known residual: a word such as segment is in none of the five sources, so such a name still blocks. Extend the header note at lines 31-33 to say that the section registry is also required lazily.

Fail closed: makeEntry runs inside the try block of loadRoomLexicon. A throw from `_genericTokenSet` therefore gives `{ ok:false, reason:'room_check_unavailable' }`, and the guard blocks. This direction only blocks more and never leaks. An empty guard set (a data-load failure) makes the union smaller, so fewer entries drop. That direction is also safe.

Add `_genericTokenSet: _genericTokenSet` to module.exports, after `_resetLexiconCache`. Do not change matchLexicon, loadRoomLexicon, _readDbEntries, _readFrontmatterNames, NAME_TYPES, KINDS or any constant. Do not use an em-dash or an en-dash.

Run the new test and save the output to `261012-sbz-green.txt` in the quick folder. Expect exit 0 with L0 to L8 PASS. Then run `node tests/test-3692-theo-verdict.cjs` and `node lib/core/part8-egress-guard.test.cjs` (both must exit 0).

Prove that matchLexicon is unchanged: extract the text from `function matchLexicon` to `module.exports` from `git show $(cat .planning/quick/261012-sbz-part-8-room-lexicon-drops-entries-made-o/261012-sbz-pre-sha.txt):lib/core/part8-room-lexicon.cjs` and from the working file, and compare the two with node. Then commit GREEN with `git commit --only -m "fix(quick-261012-sbz): room lexicon drops names made only of methodology vocabulary (S1)" -m "makeEntry drops room_term and room_file entries whose every token is in the union of framework-name, command-slug, methodology and question-word tokens and the CORE_SECTIONS slugs and labels. Claims, people, venture and room names unchanged; matchLexicon and the guard unchanged. Lazy _genericTokenSet seam, no require cycle." -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" -- lib/core/part8-room-lexicon.cjs`. Prove the sha is in HEAD with `git merge-base --is-ancestor`.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && Q=.planning/quick/261012-sbz-part-8-room-lexicon-drops-entries-made-o && PRE=$(cat $Q/261012-sbz-pre-sha.txt) && node tests/test-3692-lexicon-generic-entries.cjs > $Q/261012-sbz-green.txt 2>&1; echo "test exit=$? (expect 0)"; tail -n 1 $Q/261012-sbz-green.txt; node tests/test-3692-theo-verdict.cjs > /dev/null 2>&1; echo "theo-verdict exit=$? (expect 0)"; node lib/core/part8-egress-guard.test.cjs > /dev/null 2>&1; echo "guard self-test exit=$? (expect 0)"; node -e 'const cp=require("child_process"),fs=require("fs");const cut=s=>s.slice(s.indexOf("function matchLexicon"),s.indexOf("module.exports"));const a=cut(cp.execSync("git show '"$PRE"':lib/core/part8-room-lexicon.cjs").toString());const b=cut(fs.readFileSync("lib/core/part8-room-lexicon.cjs","utf8"));console.log("matchLexicon identical:",a===b&&a.length>0)'; git diff --quiet $PRE -- lib/core/part8-egress-guard.cjs lib/core/brain-client.cjs lib/core/refusal-messaging.cjs scripts/part8-egress-guard-hook.cjs tests/test-3692-theo-verdict.cjs && echo "guard, client, refusal, hook, V1f test unchanged"; grep -c "require('./section-registry.cjs')" lib/core/part8-room-lexicon.cjs; git log -1 --stat --format=%s | head -3; LC_ALL=C grep -cP '\xE2\x80\x94|\xE2\x80\x93' lib/core/part8-room-lexicon.cjs</automated>
  </verify>
  <done>The new test exits 0 (L0 to L8 PASS). test-3692-theo-verdict.cjs and part8-egress-guard.test.cjs exit 0. matchLexicon is identical to the pre-change text. The guard, brain-client, refusal-messaging, the hook and the V1f test file are unchanged. The GREEN commit holds only lib/core/part8-room-lexicon.cjs and is in HEAD. The dash count is 0.</done>
</task>

<task type="auto">
  <name>Task 3: Verify - runner delta, real-room measurement (counts only), CHANGELOG bullet</name>
  <files>CHANGELOG.md</files>
  <action>
Runner. Run `bash tests/run-all-3692.sh` and save the output to `261012-sbz-3692-final.txt` in the quick folder. Compare `grep '^>>> '` of the baseline file with the same lines of the final file. The only allowed difference is 1 added line, `>>> 3692: lexicon drops generic-only room names (quick 261012-sbz): PASSED`. The final PASS count is the baseline PASS count + 1 (expected `PASSED=71 FAILED=0` if the baseline is 70 and 0), and the FAIL count is unchanged. Use the 600000 ms Bash timeout or run it in the background. If a peer commit changed another leg between the two runs, record the leg label and the commit in the SUMMARY. Do not fix a peer leg.

Measurement. Do this only if the scratch room copies exist. Set SCR=/tmp/claude-1000/-home-jsagi/3e20bba4-0c06-41e6-9f41-6b286d463640/scratchpad, DBG=.planning/debug/part8-egress-guard-room-lexicon-false-positive-blocks-theo/scripts and PRE to the sha in 261012-sbz-pre-sha.txt. The condition: `$SCR/survey` holds 34 directories, and each has `.mindrian/room.db`. If the copies are gone, write `measurement UNVERIFIED: scratch room copies absent` to `261012-sbz-measure.txt` and rely on the fixture test.

WARNING: the survey directory names and the private retention output hold real room names and room text. Write every raw output under `$SCR/sbz-measure/` only. Never write them to the repo or the quick folder. Never print the second stdout line of survey-delta.cjs.

If the copies exist, do these 6 steps.
(1) Build a pre-change snapshot at B=$SCR/sbz-measure/base with the build-protos.cjs layout. Make the directory `$B/lib/core`. For every entry of lib/core except part8-room-lexicon.cjs and part8-egress-guard.cjs, make a symlink to the repo path. Write `git show $PRE:lib/core/part8-room-lexicon.cjs` to `$B/lib/core/part8-room-lexicon.cjs`. Copy lib/core/part8-egress-guard.cjs to the same directory as a real file. Make symlinks `$B/data` to the repo data and `$B/lib/hmi` to the repo lib/hmi.
(2) Run `node $DBG/survey-delta.cjs $SCR/survey <repo>/lib/core/part8-egress-guard.cjs base $SCR/sbz-measure/delta-base-after.json > /dev/null`.
(3) Run the same command with the guard path `$B/lib/core/part8-egress-guard.cjs` and the output `delta-base-before.json`. This is the sanity baseline. Expect 30 of 884.
(4) Run `node $DBG/retention.cjs $SCR/survey $B/lib/core/part8-egress-guard.cjs <repo>/lib/core/part8-egress-guard.cjs $SCR/sbz-measure/retention.json $SCR/sbz-measure/retention-PRIVATE.json > /dev/null`.
(5) Run the extended corpus: survey-delta with `ext` and the repo guard, output `delta-ext-after.json`. Expect 50 of 16490.
(6) Use a node one-liner that reads the 4 JSON files (not the PRIVATE one) and writes counts only to `261012-sbz-measure.txt` in the quick folder. For each delta file, write corpus, positives, positives_blocked_without_room, rooms, rooms_with_induced_fp, induced_fp_total, evaluations, by_class, the length of negatives_leaked_when_room_bound_vs_no_room, and the length of negatives_allowed_no_room. For retention, write entries, base_refused and lost per kind, and the totals. Write no room slug and no entry text.
Expected values: after = 6 of 884, 1 room, by_class room_content:room_term 6, leaks 0, negatives allowed with no room 0. Before = 30 of 884, 9 rooms. Retention lost = 205 of 9135 (room_file 71, room_term 134; claim, person, venture_name, room_name 0). Ext after = 50 of 16490. A different number is a finding. Record it in the SUMMARY with the actual counts, and do not tune the code to hit a number.

CHANGELOG. Run `git status --short -- CHANGELOG.md` first. It must be clean. If another session has an uncommitted hunk in CHANGELOG.md, do not edit or revert it. Skip this step, and report the bullet as owed in the SUMMARY. If the file is clean, append one bullet as the last item of the `### Fixed` list under `## [Unreleased] -- v2.0.0-beta.66 (in progress)`, before the blank line that precedes `## [2.0.0-beta.65]`. Use the house style of the sibling bullets: a bold lead sentence, then plain prose, hyphens only, no em-dash or en-dash, and no person or room name. The content: Theo now gets a methodology question even when the bound room uses the same plain words. The Part 8 room lexicon kept room terms and artifact titles made only of methodology words (an artifact titled business-model, a company entity named Design). So a question such as "which framework tests a business model's riskiest assumption first" was refused in some rooms. The lexicon now drops such an entry when every word is a framework-name, command-name, methodology, question or core-section word. People, venture names, claims and the room name are unchanged, and a name with one room-specific word still blocks. Then give the measured counts: 30 to 6 of 884 on the 34-room copy survey; 10 of 10 private-content probes still refused. If the measurement is UNVERIFIED, write "the debug prototype measured 30 to 6 of 884". End with "(quick 261012-sbz)". Before the commit, `git diff --numstat -- CHANGELOG.md` must show 1 added line and 0 removed lines. Commit with `git commit --only -m "docs(quick-261012-sbz): CHANGELOG Fixed bullet for the room lexicon S1 fix" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" -- CHANGELOG.md`. Prove the sha is in HEAD with `git merge-base --is-ancestor`.

Do not push. Do not release. Do not bump a version. Do not edit a room. Do not edit the debug session file. The main session updates its Resolution after the gate quick 261012-sc0.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && Q=.planning/quick/261012-sbz-part-8-room-lexicon-drops-entries-made-o && diff <(grep '^>>> ' $Q/261012-sbz-3692-baseline.txt) <(grep '^>>> ' $Q/261012-sbz-3692-final.txt); tail -n 6 $Q/261012-sbz-3692-baseline.txt | grep -iE 'pass|fail|skip|known'; tail -n 6 $Q/261012-sbz-3692-final.txt | grep -iE 'pass|fail|skip|known'; cat $Q/261012-sbz-measure.txt; ls /tmp/claude-1000/-home-jsagi/3e20bba4-0c06-41e6-9f41-6b286d463640/scratchpad/survey | grep -c . ; grep -c '261012-sbz' CHANGELOG.md; sed -n 1,12p CHANGELOG.md | cut -c1-140; LC_ALL=C grep -cP '\xE2\x80\x94|\xE2\x80\x93' CHANGELOG.md; git log --oneline -4; git status --short -- lib/core/part8-room-lexicon.cjs tests/test-3692-lexicon-generic-entries.cjs tests/run-all-3692.sh CHANGELOG.md</automated>
  </verify>
  <done>The runner '>>> ' lines differ from the baseline only by the new PASSED leg. 261012-sbz-measure.txt holds counts only: either the 4 measured blocks (expected 6 of 884, retention lost 205 = 71 + 134, 0 leaks, ext 50 of 16490), or the UNVERIFIED line. CHANGELOG.md has 1 new Fixed bullet that ends with "(quick 261012-sbz)" under the unreleased beta.66 heading, and its dash count is 0 (or the SUMMARY reports the bullet as owed). The 4 owned files are clean in git status. There are 3 commits (RED, GREEN, docs) in HEAD. Nothing is pushed.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| bound room (room.db, ROOM.md) -> Theo (brain_ask, brain_search, brain_query) | Canon Part 8: room content must never cross. The lexicon is the only provenance layer for room content that has no pattern shape (a name, a claim). |
| scratch room copies -> repo | The measurement reads copies of real rooms. Their names and text must never enter a tracked file. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-sbz-01 | Information disclosure | makeEntry S1 rule (lib/core/part8-room-lexicon.cjs) | mitigate | The rule applies only to kinds room_term and room_file. One token outside the union keeps the entry. claim, person, venture_name and room_name are untouched. The content rules (content_set, private_context, identifier, name) still run after the lexicon. L4 (retention), L5 (V1f) and L6 (10 negatives, fixture and no room) pin this, and the retention measurement shows 0 lost for claim, person, venture_name and room_name. |
| T-sbz-02 | Information disclosure | a real company whose whole name is methodology words (for example 'Design Matrix') | accept | The navigator accepted this cost with S1 on 2026-10-12 (Part 8 risk low to medium; 205 of 9135 entries lose protection, and the debug hand sample was plain words, PWS terms and plugin names). venture_name from ROOM.md and the content rules still cover the room's own name. |
| T-sbz-03 | Denial of service | _genericTokenSet build | mitigate | The set is built once per process and per guard module, at about 1.5 ms (planner probe). It runs inside the try block of loadRoomLexicon, so a throw fails closed as room_check_unavailable. The hook budget leg V6 in test-3692-theo-verdict (p95 under 400 ms) stays green. |
| T-sbz-04 | Tampering | require graph (guard requires lexicon at load) | mitigate | The guard sets come from the g argument. section-registry is required inside the function. There is no new top-level require, so there is no cycle and no partial module object. |
| T-sbz-05 | Information disclosure | measurement outputs (survey slugs, retention-PRIVATE) | mitigate | Raw outputs stay under the session scratchpad. The quick folder gets a node-filtered counts file only. The second stdout line of survey-delta.cjs is never printed. The no-real-names rule and Part 8 both apply. |
| T-sbz-06 | Information disclosure | test fixture and test output | accept | Every fixture string is invented. The test opens no real room and makes 0 network calls (L8). The refusal no-echo rule (V5) is unchanged because the refusal text is not edited. |
| T-sbz-SC | Tampering | package installs | accept | The plan installs no package. It uses zero npm deps and built-in modules only. |
</threat_model>

<verification>
- node tests/test-3692-lexicon-generic-entries.cjs: exit 1 at the RED commit (L1, L2, L6, L7 fail), exit 0 at the GREEN commit.
- node tests/test-3692-theo-verdict.cjs: exit 0, and the file is byte-unchanged.
- node lib/core/part8-egress-guard.test.cjs: exit 0.
- bash tests/run-all-3692.sh: the '>>> ' lines equal the baseline plus 1 PASSED leg; the FAILED count is unchanged.
- Measurement (if the scratch copies exist): 26 set 30 -> 6 of 884; retention lost 205 (room_file 71, room_term 134); 0 negatives leak; ext 50 of 16490. Counts only in the quick folder.
- Tri-Polar: one classify function serves the CLI hook (L7 spawns it) and the in-process brain-client belt and gate that the MCP server uses on Desktop and Cowork (L2 to L6 call it). No surface-specific code was added.
- Canon Part 8: no network (fetch replaced, 0 calls), no Brain call, no real room in the repo, the guard and the refusal text unchanged.
- House rules: no em-dash or en-dash in any changed file; CJS; zero npm deps; `git commit --only` with explicit paths; nothing pushed.
</verification>

<success_criteria>
- D-S1 is implemented exactly. Kinds room_term and room_file are dropped when every token is in the 5-source union. Every other kind and matchLexicon are untouched.
- A generic methodology question passes the guard in a room that holds scaffold artifact titles and generic TitleCase entities. Real room names, the venture name, claims and the 10 negatives still block with the same classes.
- 3 commits in HEAD (RED test and runner leg, GREEN lexicon, CHANGELOG bullet). Each commit has the Sonnet 5.5 trailer and touches only its own paths.
- The SUMMARY records: the RED and GREEN leg results, the runner delta, the measurement counts or the UNVERIFIED line, the 'segment' residual for quick 261012-sc0, and the fact that the debug session Resolution is left for the main session.
</success_criteria>

<output>
Create `.planning/quick/261012-sbz-part-8-room-lexicon-drops-entries-made-o/261012-sbz-SUMMARY.md` when done.
</output>

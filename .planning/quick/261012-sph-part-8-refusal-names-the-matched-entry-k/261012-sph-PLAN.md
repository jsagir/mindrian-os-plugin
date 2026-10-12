---
phase: quick-261012-sph
plan: "01"
type: execute
wave: 1
depends_on: [quick-261012-sbz, quick-261012-sc0]
files_modified:
  - tests/test-3692-theo-verdict.cjs
  - lib/core/part8-room-lexicon.cjs
  - lib/core/part8-egress-guard.cjs
  - lib/core/brain-client.cjs
  - scripts/part8-egress-guard-hook.cjs
  - lib/core/refusal-messaging.cjs
  - scripts/mindrian-brain-mcp-client.cjs
  - lib/core/feyminto/theo-ask.cjs
  - CHANGELOG.md
autonomous: true
requirements: [QUICK-261012-SPH]
canon_parts: [8, 12]
severity: major
user_setup: []
must_haves:
  truths:
    - "Per D-A: with a bound room whose lexicon holds 'solar cold locker', theoVerdict on 'How should I validate the solar cold locker with resellers?' returns exactly the keys verdict, class, token_class, reason, matched_kind, matched_token_count, matched_count with values block, room_content, room_term, the unchanged reason, room_term, 3, 1. A block that is not a lexicon match (the CANARY7F3A2B cypher, identifier) and every allow keep exactly the 4 old keys."
    - "Per D-A: matched_count is the number of lexicon entries the string hits, counted up to THEO_MATCH_COUNT_CAP = 5. A claim hit reports matched_token_count = the number of the claim's content words the string carries. No field carries entry text or a token of the entry."
    - "Per D-A: brain.ask, brain.search and brain.query on a lexicon match return the egress_blocked sentinel with the 3 fields and the reason 'The question matched one term this room uses, 2 words long, so it was not sent to Theo. Reword without that phrase.'; zero requests reach the wire (Desktop and Cowork in-process text)."
    - "Per D-A: the CLI PreToolUse hook exits 2 on a lexicon match with stderr 'Canon Part 8: blocked (room_content, room_term). The question matched one term this room uses, 2 words long, so it was not sent to Theo. Reword without that phrase.'; every other block keeps its old text byte for byte (CLI hook text)."
    - "Per D-A and D-NM: refusalResponse('egress_blocked', ctx) carries the coerced fields, keeps '(class: room_content)' in the reason and adds the size sentence; renderRefusal adds the size sentence as its own line; a lexicon-match refusal has next_moves ['reword_without_matched_phrase', 'rephrase_generically', 'continue_without']; every other egress refusal keeps ['rephrase_generically', 'continue_without']. The brain shim forwards the fields on brain_ask and on every honestRefusal tool."
    - "Per D-A: lib/core/feyminto/theo-ask.cjs records matched_kind, matched_token_count and matched_count on each egress refusal record and on the all-refused not-asked result when the sentinel carries them; NOT_ASKED_LINES.egress_blocked stays 'not asked: the question named something from this room'."
    - "Per D-A: no refusal string, sentinel, refusal object, record or hook stderr carries any token of a canary lexicon entry (V8g); leg V5 of tests/test-3692-theo-verdict.cjs is byte-identical to the pre-change text and passes."
    - "Suites green: tests/test-3692-theo-verdict.cjs (old legs plus V8a to V8g), lib/core/part8-egress-guard.test.cjs, tests/part8-egress-guard-hook.test.cjs, tests/test-257-refusal-egress-kind.cjs, lib/core/refusal-messaging.test.cjs, tests/test-250-refusal-shapes.cjs, tests/test-257-envelope-passthrough.cjs, tests/test-257-shim-honest-refusal.cjs, tests/test-36925-theo-ask.cjs, tests/test-36925-theo-wiring.cjs, tests/test-36925-theo-face.cjs, the 261012-sbz and 261012-sc0 test files; bash tests/run-all-3692.sh '>>> ' status lines equal the pre-change baseline."
  artifacts:
    - path: "lib/core/part8-room-lexicon.cjs"
      provides: "matchLexicon hit carries token_count and at (the one allowed 3-line touch, after 261012-sbz)"
      contains: "token_count: e.tokens.length, at: i"
    - path: "lib/core/part8-egress-guard.cjs"
      provides: "theoVerdict carries matched_kind, matched_token_count, matched_count on a lexicon block"
      contains: "THEO_MATCH_COUNT_CAP"
    - path: "lib/core/brain-client.cjs"
      provides: "one validator and one sentence builder for the matched entry; the sentinel and the in-process reason use them"
      exports: ["_lexiconMatchFields", "_describeLexiconMatch"]
    - path: "scripts/part8-egress-guard-hook.cjs"
      provides: "CLI hook stderr names the matched kind and size"
      contains: "_describeLexiconMatch"
    - path: "lib/core/refusal-messaging.cjs"
      provides: "coerced fields on the refusal, size sentence in REASONS and RENDER_COPY, the third next move"
      contains: "reword_without_matched_phrase"
    - path: "scripts/mindrian-brain-mcp-client.cjs"
      provides: "honestRefusal forwards the fields; the brain_ask branch calls honestRefusal"
      contains: "honestRefusal(raw, 'brain_ask')"
    - path: "lib/core/feyminto/theo-ask.cjs"
      provides: "the refusal record and the not-asked result carry the fields"
      contains: "matched_token_count"
    - path: "tests/test-3692-theo-verdict.cjs"
      provides: "legs V8a to V8g; V5 unchanged"
      contains: "V8g"
    - path: "CHANGELOG.md"
      provides: "one Fixed bullet under ## [Unreleased]"
      contains: "261012-sph"
  key_links:
    - from: "lib/core/part8-egress-guard.cjs theoVerdict"
      to: "lib/core/part8-room-lexicon.cjs matchLexicon"
      via: "hit.token_count and hit.at; extra calls on lex.entries.slice(from) count further hits up to the cap"
      pattern: "hit\\.token_count"
    - from: "lib/core/brain-client.cjs _egressBlockedSentinel and _egressRefusalReason"
      to: "lib/core/brain-client.cjs _lexiconMatchFields and _describeLexiconMatch"
      via: "direct call in the same module"
      pattern: "_describeLexiconMatch\\(verdict\\)"
    - from: "scripts/part8-egress-guard-hook.cjs room_content block branch"
      to: "lib/core/brain-client.cjs _describeLexiconMatch"
      via: "lazy require(BRAIN_CLIENT_PATH) inside try/catch, block path only"
      pattern: "require\\(BRAIN_CLIENT_PATH\\)\\._describeLexiconMatch"
    - from: "lib/core/refusal-messaging.cjs refusalResponse, REASONS.egress_blocked, RENDER_COPY.egress_blocked"
      to: "lib/core/brain-client.cjs _lexiconMatchFields and _describeLexiconMatch"
      via: "the existing top-level brainClient require"
      pattern: "brainClient\\._lexiconMatchFields"
    - from: "scripts/mindrian-brain-mcp-client.cjs brain_ask handler"
      to: "honestRefusal -> refusalResponse('egress_blocked', {..., matched_kind, matched_token_count, matched_count})"
      via: "the shim is the mindrian-brain MCP server on every surface (.mcp.json line 10)"
      pattern: "honestRefusal\\(raw, 'brain_ask'\\)"
---

<objective>
Companion A of debug session part8-egress-guard-room-lexicon-false-positive-blocks-theo (Required Code Changes, decision 3, navigator 2026-10-12). In this plan the decisions have these ids:

D-A: when the room lexicon refuses a question, the refusal tells Larry and the user WHAT KIND of entry matched and HOW LONG it is, never the entry text or any of its tokens, so the question can be reworded. The verdict gains `matched_kind` (the lexicon entry kind), `matched_token_count` (an integer) and, when known, `matched_count` (how many entries hit). The hook text, the in-process text, the chokepoint copy and the theo-ask record use the new fields. Test V5 (no echo) stays byte-unchanged and green. A new leg proves that no new field and no refusal carries a token of the matched entry.

D-NM: next_moves gains `reword_without_matched_phrase` only if refusal-messaging has a closed set that tests pin and the addition breaks no pin; otherwise keep the two moves and put the guidance in the text. RULING FOR THIS PLAN: ADD. NEXT_MOVES (lib/core/refusal-messaging.cjs:255-277) is a frozen closed map. Tests pin it with includes checks only (tests/test-250-refusal-shapes.cjs:209-211, unreachable). No test pins the egress_blocked list (grep of tests/ for rephrase_generically: 0 hits). No code reads a handle by name (retry_after_wait, use_partial and check_tier occur only in refusal-messaging.cjs). So the addition breaks no pin. This plan adds the pin (V8e, deepStrictEqual on both lists). The third move applies only to a lexicon-match refusal. The guidance is also in the text.

Purpose: today Larry sees only "a term this room uses" or the class slug, so it guessed which words to drop ("probably because words like business model"). With the kind and the word count, Larry can reword the one phrase and keep the question.

Output: 7 RED legs, the field plumbing across 8 source files, 1 CHANGELOG bullet, and counts-only verification files in the quick folder.

Out of scope (do not do): any lexicon change other than the 3 lines in Task 2; S1 or any makeEntry change (quick 261012-sbz); the survey gate (quick 261012-sc0); GAP1 and GAP2 (debug session part8-egress-guard-under-blocks-key-shape-and-spelled-money); a change to NOT_ASKED_LINES (pinned by tests/test-36925-theo-wiring.cjs:219); a change to larryRefusalLine; telemetry fields; push, release, version bump.

Tri-Polar: the in-process text (brain-client sentinel reason) serves Desktop and Cowork; the hook text serves the CLI; the chokepoint copy reaches the model on every surface through the mindrian-brain shim (.mcp.json line 10 runs scripts/mindrian-brain-mcp-client.cjs). All three change in this plan from one sentence builder, so the three surfaces say the same thing.

Scope note (file outside the navigator list, required by D-A): scripts/mindrian-brain-mcp-client.cjs. Its brain_ask branch (line 217) passes only `tool` and `egress_class` to refusalResponse, and honestRefusal (line 119) passes no matched field. Without this edit the chokepoint copy never sees the fields on the MCP path.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@.planning/STATE.md
@.planning/debug/part8-egress-guard-room-lexicon-false-positive-blocks-theo.md

Read only these ranges (they are enough): lib/core/part8-egress-guard.cjs 1026-1093 (_theoBlock, theoVerdict) and 1169-1173 (classify returns theoVerdict as is); lib/core/part8-room-lexicon.cjs from `function makeEntry` to the end (entry shape and matchLexicon; line numbers move after 261012-sbz, so find by text); lib/core/brain-client.cjs 847-930; scripts/part8-egress-guard-hook.cjs 270-290; lib/core/refusal-messaging.cjs 176-314 and 382-395; scripts/mindrian-brain-mcp-client.cjs 110-125 and 200-224; lib/core/feyminto/theo-ask.cjs 48-64 and 216-311; tests/test-3692-theo-verdict.cjs 1-310 (harness, fixture, V1), 381-430 (V2c to V2e) and 479-537 (V5 to the end); tests/test-257-shim-honest-refusal.cjs 216-242 (the honestRefusal extraction idiom).

<interfaces>
Facts the planner proved on main at 0defa8336 (PROVEN by read or grep; no repo file was changed):

Lexicon entry shape (makeEntry): `{ kind, text, tokens, needle }`, needle = ' ' + tokens.join(' ') + ' '; a claim adds `content` (deduped content tokens) and `need` (integer). KINDS = ['room_term', 'claim', 'person', 'venture_name', 'room_name', 'room_file']. ROW_CAP 5000. tokenize lowercases and splits on `/[^\p{L}\p{N}]+/u`. matchLexicon(str, lexicon) accepts an array or `{ entries }`, returns on the FIRST hit `{ token_class: e.kind }` (name, at the needle test) or `{ token_class: 'claim' }` (coverage `got >= e.need`), else null. Its only caller is theoVerdict (grep). 261012-sbz keeps matchLexicon byte-identical.

The one allowed lexicon touch (3 lines, after 261012-sbz lands; find by text, not by line number):
- L-a doc line ` * matchLexicon(str, lexicon) -> { token_class } | null` becomes ` * matchLexicon(str, lexicon) -> { token_class, token_count, at } | null`
- L-b `    if (padded.indexOf(e.needle) !== -1) return { token_class: e.kind };` becomes `    if (padded.indexOf(e.needle) !== -1) return { token_class: e.kind, token_count: e.tokens.length, at: i };`
- L-c `      if (got >= e.need) return { token_class: 'claim' };` becomes `      if (got >= e.need) return { token_class: 'claim', token_count: got, at: i };`
`at` is the index of the hit inside the array that was passed in. It is an integer, never text, and it never leaves theoVerdict.

theoVerdict (guard 1041-1093): the lexicon hit returns `_theoBlock('room_content', hit.token_class, 'the string names something the bound room recorded')`; _theoBlock builds `{ verdict, class, token_class, reason }`. classify returns the theoVerdict object as is (1172), so the hook, the callTool belt (brain-client 449-457), query (735-749) and _typedFreeformGate (913-929) all see the same object. `lex` is the memoized loadRoomLexicon result or the test seam `opts.lexicon` (array or `{ entries }`). Do not mutate it.

brain-client: `_EGRESS_TOKEN_LABELS` (854-865) holds the labels: room_term 'term this room uses', claim 'claim recorded in this room', person 'person', venture_name 'venture name', room_name 'room name', room_file 'room artifact title'. `_egressRefusalReason(verdict)` (867-875) and `_egressBlockedSentinel(toolName, verdict)` (877-885) serve every in-process Theo block. The callTool belt for a non-free-form tool (461-465) returns `{ error, tool, egress_class }` only; the four theo-ask reads take that path, so in production theo-ask never sees the new fields today (the debug Evidence 21:05 shows handle reads never reach the lexicon). Loading brain-client takes 52 to 72 ms (measured 3 times).

Hook: `BRAIN_CLIENT_PATH` exists (line 105); brainAvailable() already requires it lazily. The room_content branch is lines 279-286. tests/part8-egress-guard-hook.test.cjs pins only /part 8/i and no echo of the term; no test pins the words 'outbound Theo payload' or 'Blocked.' (grep).

refusal-messaging: requires brain-client at top level (line 47); brain-client never requires refusal-messaging (no cycle). test-257-refusal-egress-kind pins: '(class: room_content)' and the other classes inside the reason (Arm 7a); no echo of a caller string (Arms 3, 7b); no 'unreachable' and no word 'down' in the rendered egress copy (Arm 6). tests/test-127-03-acceptance-gates.sh:67 pins the key set of the UNREACHABLE refusal only.

Shim: honestRefusal is extracted by text in tests/test-257-shim-honest-refusal.cjs (marker 'function honestRefusal(result, toolName) {', evaluated with only refusalResponse in scope). Keep the signature line byte-identical and keep the body free of any other module-level name.

theo-ask: the refusal record is `{ tool, kind }` (line 278); theo-face reads only tool and kind (theo-face.cjs:210). The not-asked result is built by notAsked(reason, queriesSent, now) with keys asked, not_asked, not_asked_line, queries_sent, asked_at. tests/test-36925-theo-ask.cjs Q3 checks refusals[0].tool and .kind with ===, not deepEqual.

COPY DECK (exact strings; {n} and {c} are integers; 'word' when {n} is 1, else 'words'):
- C1 one name entry: `The question matched one {label}, {n} words long, so it was not sent to Theo. Reword without that phrase.`
- C2 one claim: `The question shares {n} words with one claim recorded in this room, so it was not sent to Theo. Reword it with fewer of those words.`
- C3 several entries: `The question matched {c} entries from this room (the first: {first}), so it was not sent to Theo. Reword without those phrases.` {c} is the integer, or the words `5 or more` when matched_count is 5. {first} is `a {label}, {n} words long`, or for a claim `a claim recorded in this room, {n} shared words`.
- I1 in-process reason on a lexicon match: C1, C2 or C3. I0 otherwise: today's text, unchanged.
- H1 hook stderr on a lexicon match: `Canon Part 8: blocked ({class}, {token_class}). ` followed by C1, C2 or C3. H0 otherwise: today's text, byte-identical.
- R1 REASONS.egress_blocked on a lexicon match: `The Brain boundary refused {tool} (class: {eclass}). ` + C + ` This is a constitutional refusal, not an outage. Otherwise rephrase in generic methodology terms, or continue without the Brain for this turn.` R0 otherwise: today's text.
- RC1 RENDER_COPY.egress_blocked on a lexicon match: 3 lines: today's line 1, then C, then today's line 2. RC0 otherwise: today's 2 lines.
- CHANGELOG bullet: see Task 3.
Examples: 'solar cold locker' gives `The question matched one term this room uses, 3 words long, so it was not sent to Theo. Reword without that phrase.` A room_file of 2 words gives `The question matched one room artifact title, 2 words long, so it was not sent to Theo. Reword without that phrase.`

Validator contract `_lexiconMatchFields(v)` (brain-client, exported): returns null unless v is an object, v.matched_kind is one of the 6 lexicon kinds (a frozen local list `_LEXICON_MATCH_KINDS`; V8b pins parity with the lexicon KINDS) and v.matched_token_count is an integer from 1 to 300. Otherwise returns `{ matched_kind, matched_token_count }` plus `matched_count` only when v.matched_count is an integer from 1 to 5. Builder contract `_describeLexiconMatch(v)` (exported): null when the validator returns null; otherwise C1, C2 or C3, with count 1 when matched_count is absent. Both interpolate only a label from the frozen label map and integers. They never read text, needle, tokens, question, message, cypher or reason.

Test fixtures for the new legs (test only):
- canary room: a second `buildRoom363({})`; write 2 technology entities with `nav.writeEntityNode(db, { entityType: 'technology', name, sessionId: 's3692sph' })`: CANARY_TERM_A 'zephyrquill vantrobe' (2 tokens) first, then CANARY_TERM_B 'korvath lumenstile drimbo' (3 tokens). Open with `roomDbMod.openRoomDb(dir, { allowExtension: true })`, close in finally, throw on `ok !== true` (the V1f setup pattern, test lines 219-227).
- CANARY_Q1 'Which framework fits the zephyrquill vantrobe?'; CANARY_Q2 'Which framework fits the zephyrquill vantrobe and the korvath lumenstile drimbo?'
- seam lexicons (passed as `opts.lexicon` to theoVerdict through the existing tv helper pattern): room_file entry text 'quorvex plinth' with question 'Which framework fits the quorvex plinth?'; claim entry text 'drovak misslen teyvar oskelt', content ['drovak','misslen','teyvar','oskelt'], need 3, with question 'Which framework fits teyvar, drovak and misslen?' (word order breaks the needle, coverage is 3); cap: 6 room_term entries 'vexa zorbel' to 'vexf zorbel' with question 'Which framework fits vexa zorbel, vexb zorbel, vexc zorbel, vexd zorbel, vexe zorbel and vexf zorbel?'
- CANARY_TOKENS for V8g: zephyrquill, vantrobe, korvath, lumenstile, drimbo, quorvex, plinth, drovak, misslen, teyvar, oskelt, zorbel, vexa, vexf, solar, locker.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED - legs V8a to V8g for the matched kind and size (per D-A, D-NM)</name>
  <files>tests/test-3692-theo-verdict.cjs</files>
  <read_first>tests/test-3692-theo-verdict.cjs (1-310, 381-430, 479-537), tests/test-257-shim-honest-refusal.cjs (216-242)</read_first>
  <behavior>
    - V8a: lexicon block key set is exactly class, matched_count, matched_kind, matched_token_count, reason, token_class, verdict; LEX_SENTENCE in `room` gives room_term, 3, 1; CANARY_Q1 in the canary room gives room_term, 2, 1; the CANARY_CYPHER block (no room) and the PB803_GENERIC allow keep exactly class, reason, token_class, verdict.
    - V8b: CANARY_Q2 gives matched_count 2 and matched_token_count 2 or 3; seam room_file gives room_file, 2, 1 and `brain._describeLexiconMatch(v)` equals the room_file example; seam claim gives claim, 3, 1 and the C2 text; seam cap gives matched_count 5 and a sentence that starts 'The question matched 5 or more entries from this room (the first: a term this room uses, 2 words long)'; the CANARY_Q2 sentence contains 'matched 2 entries from this room' and ends 'Reword without those phrases.'; _describeLexiconMatch returns null for null, kind 'identifier', kind 'CANARY7F3A2B', token count '2' (string), 0 and 2.5; every member of lexMod.KINDS with count 2 gives a non-null sentence.
    - V8c: canary room bound, ask, search and query on CANARY_Q1 each have wire 0 and a sentinel with error egress_blocked, egress_class room_content, token_class room_term, matched_kind room_term, matched_token_count 2, matched_count 1, reason equal to C1 for 'term this room uses' and 2; LEX_SENTENCE in `room` on ask has a reason that contains '3 words long'.
    - V8d: spawnHook('ask', CANARY_Q1, canaryRoom.roomDir) exits 2 and its stderr, trimmed of the trailing newline, equals H1 with C1 (2 words); spawnHook('ask', PRIVATE_CORPUS[2].text, null) exits 2 and stderr does not contain 'words long' (fallback unchanged).
    - V8e: honestRefusal extracted from the shim source and applied to the V8c ask sentinel gives kind egress_blocked, token_class room_term, the 3 fields, a reason that matches /class: room_content/ and contains 'one term this room uses, 2 words long', next_moves deepStrictEqual ['reword_without_matched_phrase', 'rephrase_generically', 'continue_without']; renderRefusal with the same ctx contains the C1 line and no /unreachable/i and no /\bdown\b/i; refusalResponse with egress_class content_set and no matched field has next_moves deepStrictEqual ['rephrase_generically', 'continue_without'] and no matched key; a forged ctx (matched_kind 'CANARY7F3A2B zephyrquill', matched_token_count '2') has no matched key, two moves, and its JSON has neither forged string; a ctx with valid kind and count but matched_count 9 drops only matched_count; the shim source contains "honestRefusal(raw, 'brain_ask')".
    - V8f: askTheoForNest({ problem_type: 'IllDefined', frameworks: [] }, { callTool, now, origin: 'https://theo.invalid' }) with every read answering the lexicon sentinel gives asked false, not_asked 'egress_blocked', not_asked_line 'not asked: the question named something from this room', and matched_kind room_term, matched_token_count 2, matched_count 1; with find_frameworks_for_problem_type answering `{ rows: [{ chapters: [] }] }` and the 2 other reads refused, asked is true and each of the 2 refusal records carries matched_kind room_term and matched_token_count 2; a sentinel with matched_kind 'CANARY7F3A2B' gives a record with no matched_kind key.
    - V8g: at least 12 outputs were collected by V8a to V8f (verdicts, sentinels, hook stderr, refusals, rendered copy, theo-ask results); the lowercased joined text contains no CANARY_TOKENS member; in every collected object, matched_kind is a member of lexMod.KINDS and each count is an integer; at least 1 verdict, 1 sentinel, 1 refusal and 1 theo-ask result carry matched_token_count.
  </behavior>
  <action>
Pre-flight. Do not continue until both of these hold. (1) `git log --oneline -30` shows a fix commit for quick-261012-sbz and a commit for quick-261012-sc0. (2) `git status --short -- tests/test-3692-theo-verdict.cjs lib/core/part8-room-lexicon.cjs lib/core/part8-egress-guard.cjs lib/core/brain-client.cjs scripts/part8-egress-guard-hook.cjs lib/core/refusal-messaging.cjs scripts/mindrian-brain-mcp-client.cjs lib/core/feyminto/theo-ask.cjs CHANGELOG.md` prints nothing. If a condition fails, stop and report BLOCKED with the output. Do not revert or edit a file that another session changed.

Write `git rev-parse HEAD` to `261012-sph-pre-sha.txt` in the quick folder. Start `bash tests/run-all-3692.sh > <quick folder>/261012-sph-3692-baseline.txt 2>&1` in the background (about 6 minutes). Do not run tests/test-3692-theo-verdict.cjs while the baseline runs, because the V6 hook budget leg is time-sensitive.

Edit tests/test-3692-theo-verdict.cjs. Add the quick id 261012-sph and the line `V8  matched kind and size: the refusal names the entry kind and word count, never the words (D-A)` to the header leg list. Add the constants CANARY_TERM_A, CANARY_TERM_B, CANARY_Q1, CANARY_Q2 and CANARY_TOKENS from the interfaces block after LEX_TERM. In main, after the brain and guard requires, require lib/core/refusal-messaging.cjs as refusalMod and lib/core/feyminto/theo-ask.cjs as theoAsk (require them after line 207, so they bind to the brain-client instance that sees the capture URL). In the rooms block, after the corrupt room, build canaryRoom with buildRoom363({}) and write the 2 canary entities as the interfaces block says. Add `try { canaryRoom.cleanup(); } catch (_e) { /* best-effort */ }` next to room.cleanup() in the teardown.

Insert the 7 legs V8a to V8g directly after the V5 leg and before the `// V6: hook budget` comment block, so V7 (net guard) still covers them. Use the existing leg, ok, tv, bind, driveVerb and spawnHook helpers. Name each leg 'V8a: ...' to 'V8g: ...' with the behavior in plain words. Implement each leg exactly as the behavior block says. Collect outputs in a new array matchOutputs of `{ src, obj, text }` entries, with src one of verdict, sentinel, hook, refusal, render, theo_ask. Keep the V8c ask sentinel in a variable for V8e. For V8e, copy the extraction idiom of tests/test-257-shim-honest-refusal.cjs lines 223-242 (slice by brace depth from the marker, then `new Function('refusalResponse', src + '\nreturn honestRefusal;')(refusalMod.refusalResponse)`). Do not require the shim, because it starts an MCP server. For V8f, inject callTool as an async function, now as a function that returns '2026-10-12T00:00:00.000Z', and origin as 'https://theo.invalid', so theo-ask loads no wire module. V8g compares lowercased text with indexOf. Do not change V1 to V7, the V2 rows, the refusals array or the V5 leg. Do not use an em-dash or an en-dash.

When the baseline is done, run the test and save the output to `261012-sph-red.txt`. The RED state: exactly V8a to V8g fail, every older leg passes, exit 1. A leg that fails with a TypeError because `brain._describeLexiconMatch` is not defined is a correct RED reason. If an older leg fails, or a V8 leg fails because of the fixture (for example, CANARY_Q1 allows, or a canary token is refused by content_set), fix the test before the commit.

Commit RED: `git commit --only -m "test(quick-261012-sph): RED, Part 8 refusal must name the matched entry kind and size, never its words" -m "Legs V8a to V8g: verdict fields, count cap, claim and artifact sizes, in-process sentinel, CLI hook stderr, chokepoint and shim, theo-ask record, canary no-echo sweep. V5 unchanged." -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" -- tests/test-3692-theo-verdict.cjs`. Then prove the sha is in HEAD with `git merge-base --is-ancestor <sha> HEAD`.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && Q=.planning/quick/261012-sph-part-8-refusal-names-the-matched-entry-k && PRE=$(cat $Q/261012-sph-pre-sha.txt) && grep '^Phase 369.2: PASSED' $Q/261012-sph-3692-baseline.txt; P0=$(awk '/^--- 3692: Theo verdict/{f=1} f&&/^PASS: V/{n++} /^>>> 3692: Theo verdict/{f=0} END{print n+0}' $Q/261012-sph-3692-baseline.txt); echo "P0=$P0 (expect 19)"; node tests/test-3692-theo-verdict.cjs > $Q/261012-sph-red.txt 2>&1; echo "exit=$? (expect 1)"; tail -n 1 $Q/261012-sph-red.txt; echo "V8 fails: $(grep -c '^FAIL: V8' $Q/261012-sph-red.txt) (expect 7)"; echo "other fails: $(grep '^FAIL:' $Q/261012-sph-red.txt | grep -vc '^FAIL: V8') (expect 0)"; node -e 'const cp=require("child_process"),fs=require("fs");const cut=s=>{const a=s.indexOf("await leg(\x27V5:");const b=s.indexOf("\n  });\n",a);return a<0||b<0?"":s.slice(a,b)};const A=cut(cp.execSync("git show "+process.argv[1]+":tests/test-3692-theo-verdict.cjs").toString());const B=cut(fs.readFileSync("tests/test-3692-theo-verdict.cjs","utf8"));console.log("V5 identical:",A.length>0&&A===B)' "$PRE"; LC_ALL=C grep -cP '\xE2\x80\x94|\xE2\x80\x93' tests/test-3692-theo-verdict.cjs; git log -1 --stat --format=%s | head -3</automated>
  </verify>
  <done>The baseline file ends with a 'Phase 369.2: PASSED=... FAILED=...' line. The test exits 1 with exactly 7 FAIL lines (V8a to V8g) and P0 PASS lines (19 expected). V5 is identical to the pre-change text. The dash count is 0. The RED commit holds only tests/test-3692-theo-verdict.cjs and is in HEAD.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: GREEN core - lexicon hit size, verdict fields, in-process sentence and CLI hook text (per D-A)</name>
  <files>lib/core/part8-room-lexicon.cjs, lib/core/part8-egress-guard.cjs, lib/core/brain-client.cjs, scripts/part8-egress-guard-hook.cjs</files>
  <read_first>lib/core/part8-room-lexicon.cjs (matchLexicon), lib/core/part8-egress-guard.cjs (1026-1093), lib/core/brain-client.cjs (847-930 and the module.exports block near 2551), scripts/part8-egress-guard-hook.cjs (270-290)</read_first>
  <behavior>
    - V8a, V8b, V8c and V8d pass; V1 to V7 still pass; V8e, V8f and V8g still fail (their surfaces change in Task 3).
  </behavior>
  <action>
Lexicon, the one allowed touch (per D-A). In lib/core/part8-room-lexicon.cjs change exactly the 3 lines L-a, L-b and L-c of the interfaces block. Find them by text, because 261012-sbz moved the line numbers. Change no other byte. The doc sentence "Never returns the matched text." stays true and stays.

Guard, theoVerdict only (per D-A). Add `const THEO_MATCH_COUNT_CAP = 5;` directly above the theoVerdict docblock, with a one-line comment: the refusal counts lexicon hits up to this cap, so a long string with many hits costs at most 5 extra matchLexicon calls, on the block path only. Do not export it. Replace the single line `if (hit) return _theoBlock('room_content', hit.token_class, ...)` with a block that: builds the same _theoBlock object (same class, token_class and reason); sets matched_kind to hit.token_class; sets matched_token_count to hit.token_count when it is a positive integer; and when hit.at is an integer, counts further hits. To count, take the entries array (lex itself when lex is an array, else lex.entries), start at hit.at + 1, call matchLexicon on entries.slice(start) while the count is below THEO_MATCH_COUNT_CAP, add 1 per hit and advance start by more.at + 1, and stop on null or a missing at. Set matched_count to the count. Do not mutate lex or its entries. Do not copy `at` or any text into the verdict. Extend the theoVerdict docblock with 2 or 3 sentences that name the 3 fields, the cap and the rule that no field carries entry text. Change nothing else in the guard.

brain-client (per D-A). Directly after _EGRESS_TOKEN_LABELS add, with a short comment that cites quick 261012-sph and Canon Part 8 (a closed kind and integers only): a frozen `_LEXICON_MATCH_KINDS` with the 6 lexicon kinds, `_lexiconMatchFields(v)` and `_describeLexiconMatch(v)` exactly as the validator and builder contracts and the copy deck (C1, C2, C3) in the interfaces block say. In _egressRefusalReason, when the class is room_content and _describeLexiconMatch(verdict) returns a string, return that string (I1); keep every other branch byte-identical (I0). In _egressBlockedSentinel, after the 5 existing keys, copy the result of _lexiconMatchFields(verdict) onto the sentinel when it is not null. Add `_lexiconMatchFields` and `_describeLexiconMatch` to module.exports.

Hook (per D-A, CLI surface). In the `klass === 'room_content' || klass === 'room_check_unavailable'` branch, when klass is room_content, get the sentence with `require(BRAIN_CLIENT_PATH)._describeLexiconMatch(verdictObj)` inside a try/catch that gives null on any throw. When the sentence is a string, call block with H1. Otherwise call block with H0, byte-identical to today, so a failed require still blocks (exit 2) and never allows. Update the branch comment: it names the kind and the word count, never the token; the require runs on the block path only (about 50 to 70 ms, inside the 2000 ms hook budget; V6 measures the allow path and is not affected).

No em-dash or en-dash in any edited line. Run the verify. Then commit GREEN 1: `git commit --only -m "fix(quick-261012-sph): the Part 8 verdict, the in-process refusal and the CLI hook name the matched entry kind and size, never its words" -m "matchLexicon hit carries token_count and at (3 lines); theoVerdict adds matched_kind, matched_token_count and matched_count (cap 5); brain-client has one validator and one sentence builder used by the sentinel and the in-process reason; the hook uses the same builder and keeps its old text as the fallback." -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" -- lib/core/part8-room-lexicon.cjs lib/core/part8-egress-guard.cjs lib/core/brain-client.cjs scripts/part8-egress-guard-hook.cjs`. Prove the sha is in HEAD with `git merge-base --is-ancestor`.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && Q=.planning/quick/261012-sph-part-8-refusal-names-the-matched-entry-k && PRE=$(cat $Q/261012-sph-pre-sha.txt) && node tests/test-3692-theo-verdict.cjs > $Q/261012-sph-green1.txt 2>&1; echo "exit=$? (expect 1)"; tail -n 1 $Q/261012-sph-green1.txt; grep '^FAIL:' $Q/261012-sph-green1.txt | cut -c1-12; for t in lib/core/part8-egress-guard.test.cjs tests/part8-egress-guard-hook.test.cjs tests/test-3692-lexicon-generic-entries.cjs tests/test-246-census-guard.cjs tests/test-245-egress-contentless.cjs tests/test-260906-fda-known-tool-shapes.cjs tests/test-260917-dgf-part8-hook-disposition.cjs; do node $t > /dev/null 2>&1; echo "$t exit=$? (expect 0)"; done; git diff --stat $PRE -- lib/core/part8-room-lexicon.cjs | tail -n 1; git diff $PRE -- lib/core/part8-room-lexicon.cjs | grep -c '^[-+] '; for f in lib/core/part8-room-lexicon.cjs lib/core/part8-egress-guard.cjs lib/core/brain-client.cjs scripts/part8-egress-guard-hook.cjs; do echo "$f dashes=$(LC_ALL=C grep -cP '\xE2\x80\x94|\xE2\x80\x93' $f)"; done; git log -1 --stat --format=%s | head -6</automated>
  </verify>
  <done>The theo-verdict test exits 1 with exactly 3 FAIL lines: V8e, V8f and V8g. V1 to V8d pass. The guard self-test, the hook test, the sbz test and the 4 room_term tests exit 0. The lexicon diff against the pre-sha is 3 insertions and 3 deletions (6 changed lines). Dash count 0 in the 4 files. The GREEN 1 commit holds only these 4 files and is in HEAD.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: GREEN surfaces - chokepoint copy and next move, shim forwarding, theo-ask record, CHANGELOG (per D-A, D-NM)</name>
  <files>lib/core/refusal-messaging.cjs, scripts/mindrian-brain-mcp-client.cjs, lib/core/feyminto/theo-ask.cjs, CHANGELOG.md</files>
  <read_first>lib/core/refusal-messaging.cjs (176-314, 382-395), scripts/mindrian-brain-mcp-client.cjs (110-125, 200-224), lib/core/feyminto/theo-ask.cjs (48-64, 216-311), CHANGELOG.md (lines 1-12)</read_first>
  <behavior>
    - V8e, V8f and V8g pass; all older legs and V8a to V8d still pass; the test exits 0.
  </behavior>
  <action>
refusal-messaging (per D-A, D-NM). Add a frozen `EGRESS_MATCH_NEXT_MOVES = ['reword_without_matched_phrase', 'rephrase_generically', 'continue_without']` directly after NEXT_MOVES. Its comment records the D-NM ruling: the closed map, the includes-only pins, 0 pins on the egress list, 0 consumers by name, the new V8e pin, Shape F MAX_K 3 holds, and the third move applies only when the refusal carries a lexicon match. Leave NEXT_MOVES.egress_blocked unchanged. In refusalResponse, inside the existing egress_blocked block, call `brainClient._lexiconMatchFields(c)`. When the result is not null, copy it onto out and set out.next_moves to a copy of EGRESS_MATCH_NEXT_MOVES. The validator is the coercion, so a caller string can never ride the refusal. In REASONS.egress_blocked, when `brainClient._describeLexiconMatch(c)` returns a string, return R1; otherwise return today's text (R0). In RENDER_COPY.egress_blocked, when the sentence exists, return RC1; otherwise RC0. Extend the V5-rule comments above REASONS and at REASONS.egress_blocked: a refusal may also interpolate a closed-set kind label and integers from the validator. Do not change larryRefusalLine, REFUSAL_KINDS, KIND_STATUS, TOKEN_CLASS_SET or EGRESS_CLASS_SET.

Shim (per D-A; the file is outside the navigator list, see the scope note). In honestRefusal keep the signature line byte-identical. Pass to refusalResponse the existing tool, egress_class and token_class, plus matched_kind, matched_token_count and matched_count read from result. Use no other module-level name in the body (the test-257 extraction runs it with only refusalResponse in scope). In the brain_ask handler, replace `refusalResponse('egress_blocked', { tool: 'brain_ask', egress_class: raw.egress_class })` with `honestRefusal(raw, 'brain_ask')`. This also carries token_class, which the branch dropped before. Update the comment above it: tool, egress_class, token_class and the 3 matched fields (a closed kind and integers) cross into refusalResponse, never the question.

theo-ask (per D-A). Add a helper that reads the 3 fields from a sentinel and returns only valid ones: matched_kind must be a member of the lexicon KINDS, read by a lazy `require(path.join(ROOT, 'lib', 'core', 'part8-room-lexicon.cjs')).KINDS` inside a try/catch that gives an empty list; matched_token_count must be an integer from 1 to 300; matched_count must be an integer from 1 to 5. Do not require brain-client (the module header forbids a load of the wire module for a constant). In the refusal branch, when kind is egress_blocked, add the valid fields to the record. In the answered === 0 branch, when every read was egress-refused, copy the fields of the first record that has matched_kind onto the not-asked result. Leave NOT_ASKED, NOT_ASKED_LINES, notAsked and the reader line unchanged (pinned by tests/test-36925-theo-wiring.cjs:219). Add one sentence to the header: under the current guard the 4 handle reads never reach the lexicon, so the fields appear only when a sentinel carries them.

CHANGELOG (per D-A). Append one bullet as the last bullet of the first `### Fixed` list under `## [Unreleased]` (after any 261012-sbz bullet): `- **A Part 8 refusal now says what kind of room entry the question matched and how long it is, never the words.** When a question to Theo matched something the bound room recorded, Larry heard only "a term this room uses" and had to guess which words to drop. The refusal now says, for example, that the question matched one room artifact title, 2 words long, and to reword without that phrase, and it says how many entries matched. The CLI hook, the in-process refusal and the refusal copy all say it the same way, the words never appear in any of them, and a refusal of this kind offers a third next move, reword without the matched phrase. (quick 261012-sph)`

No em-dash or en-dash. Run the verify. Then commit GREEN 2: `git commit --only -m "fix(quick-261012-sph): the refusal chokepoint, the brain shim and theo-ask carry the matched entry kind and size" -m "refusalResponse carries the validated fields, REASONS and RENDER_COPY add the size sentence, and a lexicon-match refusal gains the next move reword_without_matched_phrase (D-NM: closed frozen map, no pin broken, pin added in V8e). honestRefusal forwards the fields and the brain_ask branch now uses it. theo-ask records the fields; its reader line is unchanged. CHANGELOG Fixed bullet." -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" -- lib/core/refusal-messaging.cjs scripts/mindrian-brain-mcp-client.cjs lib/core/feyminto/theo-ask.cjs CHANGELOG.md`. Prove the sha is in HEAD.

Final gate: run `bash tests/run-all-3692.sh > <quick folder>/261012-sph-3692-after.txt 2>&1` in the background (about 6 minutes). When it ends, compare its '>>> ' lines with the baseline. run-all-3692 counts test files, not legs. This quick adds no run line (the new legs live in the existing theo-verdict leg at run-all-3692.sh line 85), so the expected result is the same '>>> ' lines and the same PASSED count as the baseline, with FAILED=0. Then run every test file that the 261012-sc0 commit added under tests/ (list it with `git show --stat --format= $(git log --format=%H -1 --grep=quick-261012-sc0)`).
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && Q=.planning/quick/261012-sph-part-8-refusal-names-the-matched-entry-k && node tests/test-3692-theo-verdict.cjs > $Q/261012-sph-green2.txt 2>&1; echo "theo-verdict exit=$? (expect 0)"; tail -n 1 $Q/261012-sph-green2.txt; for t in tests/test-257-refusal-egress-kind.cjs lib/core/refusal-messaging.test.cjs tests/test-250-refusal-shapes.cjs tests/test-257-envelope-passthrough.cjs tests/test-257-shim-honest-refusal.cjs tests/test-36925-theo-ask.cjs tests/test-36925-theo-wiring.cjs tests/test-36925-theo-face.cjs lib/core/part8-egress-guard.test.cjs tests/part8-egress-guard-hook.test.cjs tests/test-3692-lexicon-generic-entries.cjs; do node $t > /dev/null 2>&1; echo "$t exit=$? (expect 0)"; done; grep -c "honestRefusal(raw, 'brain_ask')" scripts/mindrian-brain-mcp-client.cjs; grep -c "not asked: the question named something from this room" lib/core/feyminto/theo-ask.cjs; for f in lib/core/refusal-messaging.cjs scripts/mindrian-brain-mcp-client.cjs lib/core/feyminto/theo-ask.cjs CHANGELOG.md; do echo "$f dashes=$(LC_ALL=C grep -cP '\xE2\x80\x94|\xE2\x80\x93' $f)"; done; grep -c "261012-sph" CHANGELOG.md; git log -1 --stat --format=%s | head -6</automated>
  </verify>
  <done>The theo-verdict test exits 0 with P0 + 7 PASS lines (26 expected) and 0 FAIL. The 11 listed suites exit 0. The shim brain_ask branch calls honestRefusal. The theo-ask reader line is unchanged. Dash count 0 in the 4 files; the CHANGELOG has 1 bullet with 261012-sph. The GREEN 2 commit holds only the 4 files and is in HEAD. The run-all-3692 '>>> ' lines equal the baseline and FAILED=0; the sc0 test files exit 0.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| local guard -> Theo wire | Part 8 boundary. A lexicon block stops the call before the wire; this plan changes only what the refusal says locally. |
| refusal -> model (Larry) | The refusal text and fields reach the host model through the hook stderr, the in-process sentinel and the shim. Room text must not ride them. |
| sentinel -> refusalResponse | The shim and theo-ask accept sentinel fields; a forged or malformed sentinel must not carry a caller string into a refusal. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-sph-01 | Information disclosure | theoVerdict fields, brain-client sentence, hook stderr, refusal copy | mitigate | The fields come from entry metadata only (kind, tokens.length, coverage count, array index); theoVerdict never copies text, needle or at into the verdict. _lexiconMatchFields admits only the 6 lexicon kinds and bounded integers; the builder interpolates only a frozen label and integers. V5 stays byte-identical; V8g sweeps every new output for 16 canary tokens. |
| T-sph-02 | Tampering | honestRefusal, refusalResponse, theo-ask record | mitigate | Every consumer validates through the closed kind list and integer bounds; V8e and V8f prove a forged kind string, a string count, 2.5 and an out-of-range count are dropped and never echoed. |
| T-sph-03 | Information disclosure | kind and size as a probe of the room lexicon | accept | The refusal is local; the asker is the room owner's own session, which already holds the room; nothing in the refusal leaves the machine (Part 8 governs egress to the Brain). |
| T-sph-04 | Denial of service | the hit-count loop in theoVerdict | mitigate | THEO_MATCH_COUNT_CAP = 5 bounds the extra matchLexicon calls to 5, on the block path only; the allow path is unchanged (V6 p95 under 400 ms). |
| T-sph-05 | Elevation of privilege | lazy require of brain-client in the hook | mitigate | The require sits in a try/catch that falls back to the old text and still exits 2; a failed require can never turn a block into an allow. |
</threat_model>

<verification>
- tests/test-3692-theo-verdict.cjs: RED after Task 1 (7 V8 fails), 3 fails after Task 2 (V8e, V8f, V8g), 0 fails after Task 3; V5 byte-identical to the pre-sha.
- The lexicon diff against the pre-sha is exactly 3 changed lines.
- Every refusal surface: in-process reason (I1), hook stderr (H1), REASONS (R1), RENDER_COPY (RC1), next_moves (D-NM), theo-ask record, each pinned by a V8 leg; the old text stays for every non-lexicon block.
- The 11 neighbour suites exit 0; run-all-3692 '>>> ' lines equal the baseline, FAILED=0; the sc0 test files exit 0.
- Dash count 0 in the 9 edited files. No network (V7 net guard; the refusal path adds no socket).
</verification>

<success_criteria>
- A lexicon refusal names the entry kind and its word count (and the number of entries hit, up to 5) on the CLI hook, the in-process sentinel and the chokepoint copy, from one builder.
- No refusal, field or record carries a token of the matched entry (V5 and V8g).
- A lexicon-match refusal offers 3 next moves; every other egress refusal keeps 2.
- 3 commits (RED, GREEN 1, GREEN 2) with explicit paths via `git commit --only`, each in HEAD; no push, no release, no version bump.
</success_criteria>

<output>
Create `.planning/quick/261012-sph-part-8-refusal-names-the-matched-entry-k/261012-sph-SUMMARY.md` when done. Record: the 3 commit shas; P0 and the final leg count; the D-NM ruling (added, with the grep facts); the scope note for scripts/mindrian-brain-mcp-client.cjs; the fact that theo-ask fields stay absent in production under the current guard (handle reads never reach the lexicon); the measured block-path cost of the hook require; the run-all-3692 baseline and after lines.
</output>

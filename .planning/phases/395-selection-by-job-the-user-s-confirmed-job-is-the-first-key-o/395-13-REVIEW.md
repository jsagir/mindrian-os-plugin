---
phase: 395-selection-by-job-the-user-s-confirmed-job-is-the-first-key-o
plan: 395-13
reviewed: 2026-11-16T04:16:53Z
depth: deep
scope: commits b76fcc06d (test) and 80208f14f (feat); HEAD 2b160c71a has no later change in lib/ or scripts/
files_reviewed: 5
files_reviewed_list:
  - lib/core/part8-sprout-shape.cjs
  - lib/core/part8-egress-guard.cjs
  - lib/core/brain-client.cjs
  - scripts/part8-egress-guard-hook.cjs
  - tests/test-395-egress-body.cjs
findings:
  critical: 6
  warning: 7
  info: 4
  total: 17
status: issues_found
probes: /tmp/claude-1000/-home-jsagi/ed9f3b90-f4bf-4117-b6b6-f138961b043c/scratchpad/r13/
---

# Plan 395-13: Code Review Report (adversarial, Part 8 egress)

**Reviewed:** 2026-11-16T04:16:53Z
**Depth:** deep (guard, shape module, shim client, PreToolUse hook, MCP shim routes)
**Files Reviewed:** 5
**Status:** issues_found

## Summary

The test suite `tests/test-395-egress-body.cjs` passes (18 passed, 0 failed, PROVEN). The suite does not prove the boundary. Six probes put user text on the wire that the old guard (tree b76fcc06d) blocked. Each regression is PROVEN by an old-against-new run and by a stubbed `fetch` that records the `tools/call` arguments of `brain-client.ask()`. No socket was opened.

There are 2 root causes:
1. After ruling 35, the sentence count is the only body gate. The 40-word arm and the 2-newline arm no longer back it up. Any undercount is now a leak (CR-01, CR-05, CR-06).
2. The paste cut is not a parser. It uses `indexOf` for fences and a flat regex for quote pairs. When it cuts the wrong span, the cut text goes to Theo. The disclosure then says "Pasted text ... stayed on this machine", and that is false (CR-02, CR-03). The typed-question fast path also runs before the paste rule (CR-04).

The probe harness is `lib.cjs` and `run.sh` in the probe folder. `run.sh` sets `env -i`, a `mktemp` HOME, `MINDRIAN_BRAIN_URL=http://127.0.0.1:9`, no key, and `< /dev/null`. `old/` holds `git archive b76fcc06d lib`, and the comparison probes use it as the old guard.

Run a probe with:
`/tmp/claude-1000/-home-jsagi/ed9f3b90-f4bf-4117-b6b6-f138961b043c/scratchpad/r13/run.sh <probe>.cjs`

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: The paste cut joins the lines around the note, so a body of line-sentences becomes 1 sentence and goes to Theo

**File:** `lib/core/part8-sprout-shape.cjs:161-176` (cutBlockQuotes join), `:145` (cutFences puts the note on its own line), `lib/core/part8-egress-guard.cjs:1440` (pasted_text is answered before body_shape), `:1762-1764` (the rest is decided on the joined text)
**Issue:** A line break ends a sentence (ruling 35, the new rule). `cutBlockQuotes` joins each line next to a note line with a space. The rule was meant to stop the note from counting as a sentence (plan D11). It also joins the real sentences on each side of the note. Step 6 answers `pasted_text` before `body_shape`, so a 6-sentence body that holds one block quote, fence or quoted line is not refused as a body. It is cut, joined into 1 line, and allowed.
**Probe:** `p01-line-merge.cjs` (control with no paste: `block/body_shape`; with `> see note`, a fence or a `"one two three four"` line between the facts: `allow/generic_question`, the 3 private lines are on the wire). `p03-old-vs-new.cjs` row `blockquoteMerge`: OLD block, NEW allow. `p06-hook.cjs`: the shim route gets exit 0. The direct route gets exit 2 with an instruction to resend the joined body.
**Fix:** Decide the body rule on the rest with the line structure kept. Each cut span must stay a sentence boundary:
```js
// classifyAndCut, before the second classify():
const restForShape = cut.text; // build a second string in cutPastedText where each span -> '\n'
const shapeRest = _sproutShape.classifyShape(cutWithBreaks);
if (shapeRest.kind === 'body') return { verdict: _sproutsRequired('body_shape'), payload: payload, cut: 0 };
```
A simpler fix also works: in `_theoShapedVerdict`, test `kind === 'body'` before `shape.quoted`. Then compute the rest's sentences with every cut span counted as a line break.

### CR-02: The fence cut does not match the fence length or nesting, so pasted code goes to Theo with a "kept local" disclosure

**File:** `lib/core/part8-sprout-shape.cjs:134-150` (cutFences), `lib/core/part8-egress-guard.cjs:1762` (the fail-closed re-check sees no fence left)
**Issue:** `cutFences` opens at the first 3 marks and closes at the next 3 marks of the same character. An opening fence of 6 backticks closes on its own marks 4 to 6. The code is then outside the cut, and the closing fence is cut as a second empty span. A CommonMark nested fence (an outer fence of 4 backticks around an inner fence of 3) closes on the inner opener. The re-check `classifyShape(cut.text).quoted` finds no fence left, so the code inside is sent.
**Probe:** `p04-fence.cjs`. `sixTickOneLine` and `nested4` show `SECRET_ON_WIRE=true`. `p06-hook.cjs` row `theo fence6`: for an ordinary multi-line 6-backtick block on `mcp__theo__brain_ask`, the hook exit-2 message tells the model to resend `explain with a framework [pasted text kept local] boardPlan fireFounderAfterAudit investorExit [pasted text kept local]`. The resend then passes.
**Fix:** Parse fences by run length: at an opener, count the run `n` (3 or more) of the same mark. Close only at a run of the same mark with length `n` or more, at the start of a line. If no close is found, cut to the end. After the cut, fail closed (keep the block, cut 0) when the rest holds any run of 3 or more backticks or tildes, or any single backtick pair that spans a line. A test must cover 4-mark, 5-mark and 6-mark fences and a nested fence.

### CR-03: A stray or nested straight quote makes the quote-pair cut remove the wrong span; the paste is sent word for word

**File:** `lib/core/part8-sprout-shape.cjs:64` (QUOTE_PAIRS), `:152-159` (cutQuotePairs), `lib/core/part8-egress-guard.cjs:1762`
**Issue:** `QUOTE_PAIRS` pairs straight quotes left to right. An inch mark (`5"`) or an inner quote (`"he said "no deal" then ..."`) moves the pairing. The cut then removes the prose between the stray quote and the paste, and the paste stays. The fail-closed re-check passes because 1 unpaired `"` is not a quoted span.
**Probe:** `p07-quote-variants.cjs` row `strayInch`: OLD `block/body_shape`, NEW `allow`. The sent text is `for a 5[pasted text kept local]the board plans to fire the founder after the audit and the investor exits" with which framework?`. The paste is whole on the wire, and the prose before it is gone. Rows `nestedInner` and `nestedFrag` leak paste fragments. `p11-hook-direct.cjs` row `strayInch`: the hook tells the model to resend that text.
**Fix:** Fail closed when the pairing is not clean. If the input holds an odd number of `"`, or the cut text still holds any `"`, `\u201C` or `\u201D`, return `{ verdict: first, cut: 0 }` (the pasted_text block stays). Do not try to repair the pairing.

### CR-04: The typed-question fast path runs before the paste rule, and any non-Latin string proves "closed vocabulary", so a Hebrew or Cyrillic paste is sent whole

**File:** `lib/core/part8-egress-guard.cjs:1405` (step 2 skips only `kind === 'body'`), `:1100-1108` (`_proveTypedQuestion` splits on `[^a-z0-9_-]+`. Hebrew, Cyrillic and CJK give 0 tokens, so the loop returns true)
**Issue:** Before this plan, a quoted span made a body, and step 2 skipped bodies. Now a quoted span is an edge. For a single-line string of 240 characters or fewer with no ASCII word outside the closed vocabulary, step 2 answers `typed_question` before step 6 can see the paste. Hebrew is the owner's working language.
**Probe:** `p10-nonlatin.cjs` rows `hebrewPaste` and `cyrillicPaste`: OLD `block/sprouts_required`, NEW `allow/typed_question`, cut 0, `pasteOnWire=true`. `p11-hook-direct.cjs` row `hebrewPaste`: exit 0 on `mcp__pws-brain-mcp__brain_ask`.
**Fix:**
```js
if (kind !== 'body' && shape.quoted !== true && !proseHit && _proveTypedQuestion(str)) { ... }
// and in _proveTypedQuestion:
if (tokens.length === 0 || /[^\x00-\x7F]/.test(str.replace(/[\u2018\u2019\u201C\u201D]/g, ''))) return false;
```
The second line closes the pre-existing hole (row `cjk3`: a 4-sentence CJK body is a sprout and `typed_question`). See WR-01.

### CR-05: The new abbreviation and initial rule erases real sentence ends ("no.", "etc.", "U.S.", "option B."), so a 4-sentence body counts as 1 or 2

**File:** `lib/core/part8-sprout-shape.cjs:57-59` (DOTTED_ABBREVIATION, INITIAL, ABBREVIATIONS), `:75-78` (isAbbreviation), `:91-92` (the skip in countSentences)
**Issue:** A sentence that ends with a word of the list, a dotted abbreviation or any single letter followed by a full stop does not end. Words such as `no.`, `etc.`, `U.S.`, `Plan B.` and `vitamin D.` often end a sentence. This is new code (plan D6), and it moves text from body to edge.
**Probe:** `p03-old-vs-new.cjs` rows `abbrevEnd` and `initialEnd`: OLD `block/body_shape`, NEW `allow`. `p02-sentence-evasion.cjs`: `onWire=true`. `p11-hook-direct.cjs`: exit 0 on the direct connector.
**Fix:** Err toward over-count, because an over-count only refuses a question and an under-count leaks. Skip a break after an abbreviation only when the next token starts with a lower-case letter and the text is not all lower case. Remove `no.` and the single-letter `INITIAL` rule, or apply `INITIAL` only when the next token is TitleCase and the token before the initial is TitleCase (a name such as `J. Smith`).

### CR-06: The sentence count misses common sentence ends, and the 40-word and 2-newline arms that caught them are gone

**File:** `lib/core/part8-sprout-shape.cjs:54-55` (LINE_BREAK has no U+2028, U+2029 or U+0085; SENTENCE_BREAK needs white space after the mark and a letter after the space), `:100-106` (countNewlines counts only `\n`), `:208` (body = sentences only)
**Issue:** These forms count as 1 or 2 sentences: no space after the full stop (`audit.the investor`), a sentence that starts with a digit (`. 40 staff were let go`), the ideographic and full-width marks (U+3002, U+FF0E, U+FF1F, U+FF01) and U+2026, and the U+2028 or U+0085 line separators. `cutBlockQuotes` (`LINE_SPLIT`, line 131) treats U+2028 as a line break, but `countSentences` (`LINE_BREAK`) does not. Before ruling 35, the arms `words >= 40` and `lines >= 2` blocked long text in these forms.
**Probe:** `p12-long-undercount.cjs`: 4 rows of 4-sentence bodies (`noSpace40`, `digitStart40`, `lineSep40`, `fullwidth40`) give OLD `block/body_shape` and NEW `allow`. `p02-sentence-evasion.cjs` shows the short forms on the wire.
**Fix:** Split sentences on `[.!?\u3002\uFF0E\uFF01\uFF1F\u2026\u203C\u2047-\u2049\u061F\u0964]` followed by optional closers. White space after the mark is optional, but the next character must be a letter or a digit. Do not split inside a decimal number (digit, dot, digit). Use one line-break set for count, cut and `countNewlines`: `/\r\n|[\n\r\u0085\u2028\u2029]/`. Add these forms to E5 of the test.

## Warnings

### WR-01: Pre-existing: non-Latin text skips most edge rules

**File:** `lib/core/part8-egress-guard.cjs:1080-1108, 1199-1238, 1180`
**Issue:** `_proveTypedQuestion`, `_hasUnknownProperName` (`[A-Za-z]` only) and `PRIVATE_POSSESSIVE` (English only) do not read Hebrew, Arabic, Cyrillic or CJK text. Before ruling 35, the 40-word arm limited the damage. Now a 2-sentence Hebrew paragraph of any length is allowed. A CJK body of 4 sentences is a sprout (row `cjk3` of `p10-nonlatin.cjs`: OLD and NEW both allow, so this is pre-existing).
**Fix:** Treat a string with letters outside ASCII as "cannot prove". Do not allow it by the fast path, and apply the private-marker rule to it as a long edge. CR-04 holds the fast-path half of this fix.

### WR-02: The cut removes the long-edge private-marker rule (plan D3) for pasted text

**File:** `lib/core/part8-egress-guard.cjs:1440` (pasted_text answered before line 1453), `:1762-1764`
**Issue:** D3 says a quoted span makes a long edge, and a long edge keeps `_hasPrivateMarker`. Step 6 answers `pasted_text` first. The rest after the cut has no quote and usually fewer than 40 words, so the rest is a short edge, and `proprietary`, `secret`, `our onboarding` and similar markers pass.
**Probe:** `p08-longedge-lost.cjs` rows `ourQuote` and `proprietaryQuote`: on the wire. The control `ourNoQuoteLong` is blocked as `private_marker`.
**Fix:** In `classifyAndCut`, carry `longEdge` from the first shape. Refuse the rest when `_hasPrivateMarker(rest, shapeRest)` is true. Another way: run the long-edge marker test before the `shape.quoted` return.

### WR-03: The new SENTENCE_BREAK is quadratic; the "linear time" claim is false

**File:** `lib/core/part8-sprout-shape.cjs:55` (look-behind `(?<=[.!?]["'\u201D\u2019)\]]*)`), comment `:128-129`
**Issue:** A run of closing quotes or brackets after a full stop makes each split position scan back over the run. Time per input: 80,000 straight quotes take 9.7 s, 160,000 characters take 13.6 s, and 40,000 quotes take 2.4 s (the old module takes 2 ms). The hook timeout is 5 s (`hooks/hooks.json:213`, `"onFailure": "block"`). On Desktop and Cowork, the shim runs the same code inside the single-threaded MCP server, and each call stalls it.
**Probe:** `p05-redos.cjs 80000` and `p05b-redos-old-new.cjs 40000`.
**Fix:** Refuse a free-form string above a length cap before shaping (the old path has `THEO_STRING_CEILING = 4000`, `part8-egress-guard.cjs:1182`; the shaped path has none). Replace the look-behind with a manual scan: at each run of white space, scan back over closers once. UNVERIFIED: that Claude Code honors `onFailure: block` on a timeout. If it does not, a timeout fails open on the direct connector.

### WR-04: The shaped path has no size ceiling; a 2-sentence text of any length goes to Theo

**File:** `lib/core/part8-sprout-shape.cjs:207-213`, `lib/core/part8-egress-guard.cjs:1396-1455`
**Issue:** Ruling 35 says that fewer than 3 sentences may go. The code allows a 2-sentence run-on of any length. Commas, `and`, semicolons and `so` join many claims into 1 grammatical sentence. Probe `p03-old-vs-new.cjs` row `longTwoSentence` (75 words of private facts): OLD block, NEW allow. Row `semicolons` of `p02` (5 clauses): 1 sentence.
**Fix:** Apply `THEO_STRING_CEILING` (or a word cap of about 80 words) on the shaped path. The owner must confirm the number. See NEEDS_HUMAN in the report.

### WR-05: The paste detector misses common quote and code forms, so these pastes go word for word

**File:** `lib/core/part8-sprout-shape.cjs:64, 108-118`
**Issue:** These forms are not detected: `'...'`, `\u2018...\u2019`, `\u201E...\u201C`, guillemets, full-width `\uFF02`, inline backticks, `<pre>`/`<code>`, and indented code of 1 or 2 lines. Ruling 37 promises that a pasted quote or code block is replaced. A missed paste is decided only by the sentence count. The gap is pre-existing (OLD also allowed these short forms).
**Probe:** `p03-old-vs-new.cjs` rows `singleQuote`, `guillemet`, `lowQuote`, `singleSmart`, `inlineCode`, `htmlPre`: NEW allow, cut 0.
**Fix:** Add the pairs `\u2018\u2019`, `\u201E\u201C`, `\u00AB\u00BB`, `\uFF02\uFF02` and single straight quotes with 4 or more words inside (on a word boundary, so `don't` does not open a pair). Add inline backtick spans of 4 or more words, `<pre>` and `<code>` elements, and runs of 4-space-indented lines to `hasQuotedSpan` and the cut. Each form must fail closed on an unclosed opener.

### WR-06: The hook trusts the server name alone and now passes the raw paste to it

**File:** `scripts/part8-egress-guard-hook.cjs:384-391`, `lib/core/brain-response-sanitize.cjs:237-258`
**Issue:** On a name that matches `mcp__(plugin_*_)?mindrian-brain__*`, the hook exits 0 with the original input, paste included, and relies on the shim to cut. Before this plan, a quoted span was a body and got exit 2 on every scope. The project memory records that a user-level `mindrian-brain` MCP entry has shadowed the plugin shim. A server with that name that is not `bin/mindrian-brain-mcp-client.cjs` now gets the raw paste. UNVERIFIED: that such an entry exists on a user machine now.
**Fix:** Do not proceed with the uncut input on any route. Give every route the resend-cut message (exit 2), the same as the non-shim route. Another way: check the registered server command before trusting the name.

### WR-07: Pre-existing, outside the 2 commits: a second free-form key on the direct connector is not shaped

**File:** `lib/core/part8-egress-guard.cjs:1643-1646, 1686-1690`
**Issue:** `classify` shapes only the first FREEFORM_KEYS string. Other keys get only `scanForContent`. On `mcp__pws-brain-mcp__brain_ask` (no zod strictObject in front of it), `{question: <generic>, context: <3-sentence body>}` exits 0.
**Probe:** `p09-second-key.cjs` (exit 0 for `question+context` and `question+ask`), `p09b-second-key-old.cjs` (the old guard also allows, so this is pre-existing).
**Fix:** On a free-form tool, shape every string value at any depth, or refuse unknown keys.

## Info

### IN-01: The hook exit-2 message echoes the cut input

**File:** `scripts/part8-egress-guard-hook.cjs:201-205, 392`
**Issue:** `JSON.stringify(planned.payload)` writes every key of the cut input to stderr. Claude Code gives this text to the model and keeps it in the local session transcript. The raw `tool_input` is already in that transcript, so there is no new Brain egress (ASSUMED from the harness design, not run in the harness). When CR-01, CR-02 or CR-03 apply, this message tells the model to resend the leaking text.
**Fix:** Echo only the cut free-form string, not the other keys. Fix CR-01 to CR-03 first.

### IN-02: The telemetry records a block for a call that then proceeds

**File:** `scripts/part8-egress-guard-hook.cjs:368` against `:391`
**Issue:** `bestEffortRecord` records the first verdict (`block`, `sprouts_required`) before the pasted_text branch. That branch can then exit 0 on the shim route.
**Fix:** Record after the pasted_text branch, with the final disposition.

### IN-03: The disclosure states a fact the code does not check

**File:** `lib/core/brain-client.cjs:1099, 1117-1127`
**Issue:** `PASTE_CUT_REASON` says that the pasted text stayed on the machine. In the CR-02 and CR-03 cases, it did not.
**Fix:** Fix CR-02 and CR-03. Then add a test that asserts that no byte of a pasted span is a substring of the sent text.

### IN-04: smartSearch cuts twice and attaches the disclosure once

**File:** `lib/core/brain-client.cjs:1165-1167` and `search()` at `:1135-1137`
**Issue:** `smartSearch` cuts the text, and then `search()` runs `_cutPasteForTheo` again on the cut text. The second cut finds nothing, so the result is correct. The second cut costs 1 more classify per call.
**Fix:** Add an internal `search` entry that takes text that is already cut.

---

_Reviewed: 2026-11-16T04:16:53Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

---

## Fix record

**Fixed:** 2026-11-16 (gsd-code-fixer), branch `work/395-selection-by-job`, worktree `MindrianOS-Plugin-rebuild`, against 80208f14f.
**Rulings applied:** (35) a body is 3 sentences or more; (37) cut the paste, send the rest; owner ruling 2026-11-16 (WR-04): a text of 1 or 2 sentences longer than 4000 characters is a body.
**Test first:** `tests/test-395-egress-leaks.cjs` (added to `tests/run-all-395.sh`) turns each probe of p01 to p12 and each OLD-block / NEW-allow row of p03 into an arm. The wire is a stubbed `fetch` (the probe `lib.cjs` stub); no socket. RED at c9ecd2dc6: 9 passed, 68 failed. GREEN at the last commit: 81 passed, 0 failed.

### Commits

| Finding | Commit | Change |
|---------|--------|--------|
| test | c9ecd2dc6 | RED arms for every probe; run-all-395.sh runs the new test |
| WR-03 | b25b2c7f9 | manual left-to-right sentence scan; no look-behind |
| CR-06 | 3de4d29bf | one line-break set (CR LF, LF, CR, U+0085, U+2028, U+2029) for count, cut and countNewlines; U+3002, U+FF0E, U+FF01, U+FF1F, U+2026 and other script marks end a sentence with or without a space; no space after . ! ? before a word or a digit ends a sentence (not a decimal, not in a link); a digit starts a sentence; a semicolon and a run of 2 or more tabs end a sentence |
| CR-05 | 3d08a368f | abbreviations keep a sentence open only before a lower-case word in a sentence-case text; an initial only in a name; "no." removed |
| CR-01 | 5899caafd, then f91b213c9 | see the note under the table |
| CR-02 | 6958a684b | fences close at a run of the same mark at least as long as the opener; unclosed fence cut to the end |
| CR-03 | 9345ef932 | quote parser by flanking, with a stack for nested quotes; a gershayim (letter " letter) is not a quote; a closer with no opener, an unclosed opener or a lone mark is ambiguous, and classifyAndCut fails closed |
| WR-05 | 4995e9e8d | low, reversed and full-width double quotes, guillemets, CJK brackets, single quotes (apostrophe, elision and plural possessive excluded), inline code (4 or more words or code-like), HTML pre and code, 4-space or tab indented lines; an unclosed form fails closed |
| CR-04 | bd679f644 | `_proveTypedQuestion` proves no string with 0 tokens or a non-ASCII character (typographic quotes excepted); step 2 skips a string with a quoted span |
| WR-02 | 153434185 | a text that holds the paste note is a long edge, so the private-claim marker rule holds after the cut and on a resend |
| WR-04 | d0ee11502 | `BODY_MAX_CHARS = 4000`: a longer text is a body |
| test | f6728d7bc | the `mcp__theo__search` row of p06 is out of the hook scope (see RISKS) |
| WR-06 | 2f9fdcb0e | `ownPluginShimRoute`: the paste branch lets the uncut input go on only for the plugin scope of this plugin (plugin.json name), when `.mcp.json` registers `mindrian-brain` with the shim script and the script exists; every other route gets exit 2 with the cut input |
| test | af2d6dc61 | L16 reads the call sites of bestEffortRecord, not the definition |
| IN-02 | 51bc865a3 | the hook records the final disposition after the paste branch |
| IN-03 | 792a27ddb | cutPastedText returns the cut spans; classifyAndCut fails closed when a span of 40 or more characters stands in the text to send; arm L19 |
| test | 5fa377a8b | RED arm: a mid-sentence quote plus 1 sentence is cut and sent; the cut keeps lines |
| test | 34622726c | RED arms from the coordinator fuzz: `Alpha!Beta!Gamma!CANARY_0062` |
| CR-06 | d443de92a | no-space ! and ? (and a full stop before a capital) break every time; the 1-per-token cap holds only for a full stop before a lower-case word |
| CR-06 | d1b032fee | over-block repair found by PG33 and the survey gate: a known file extension or domain ending is not a sentence end (SKILL.md); a semicolon break counts for the body rule only, not for the sprout rule |

**CR-01 note.** 5899caafd made each note a sentence boundary. That over-counted a quote inside a sentence ("What does NOTE mean? How is it used?" counted 3 sentences). f91b213c9 replaced it: the cut never joins lines. A pasted line or block becomes a line that holds only the note, and the words of the note do not count. The rest keeps its true line structure, on the shim cut and on a hook resend. The "safe default" (a body before the cut stays a body) was not adopted: each ruling-37 example (a 2-line question around a pasted block) is a body by line count before the cut, so that default refuses every such question. `tests/test-395-egress-body.cjs` changes 5 expected cut strings from the joined form to the line form (P1, P2). No verdict arm of that test changes.

**WR-06 choice.** The repo has a name predicate only (`isShimBackedBrainTool`). The fix keeps that predicate unchanged (the ambiguous branch still uses it) and adds an identity check for the paste branch only. The project or user scope name `mcp__mindrian-brain__*` now gets exit 2 with the cut input on the paste branch.

### Probe re-run (r13/run.sh, isolated env)

- p01: blockquote, fence and quoteLine: `block/sprouts_required/body_shape` (were allow, facts on the wire).
- p02: all 13 rows `kind=body`, `onWire=false` (noSpace, digitStart, abbrevEnd, initialEnd, semicolons, cjk, fullwidth, ellipsisChar, lineSep, nel, tabsAsBreaks, hebrew, control).
- p03: blockquoteMerge, noSpace, digitStart, abbrevEnd, initialEnd, fullwidth, lineSep, cjk: `block/body_shape`. singleQuote, guillemet, lowQuote, singleSmart, inlineCode, htmlPre, indentedCode, sixTickFence, nestedFence4: allow with the paste cut. quoteHasNote: cut 2, no paste on the wire.
- p04: sixTick, sixTickOneLine, nested4, nested4ml, tildeInBacktick: `SECRET_ON_WIRE=false`.
- p05 at 80000: every row under 70 ms (was 9.7 s); p05b at 40000: new 4 to 10 ms.
- p06: shim merge exit 2, direct merge exit 2, theo fence6 exit 2 with a resend input that holds no secret, slow input exit 2 in 99 ms, pws typed search exit 2.
- p07: strayInch `block/pasted_text cut=0` (nothing sent); nestedInner, nestedFrag, mixedSmartStraight: the whole span cut.
- p08: ourQuote and proprietaryQuote `block/private_marker`, `onWire=null`.
- p10: hebrewPaste and cyrillicPaste cut 1, `pasteOnWire=false`; cjk3 `block/body_shape`.
- p11: abbrevEnd, initialEnd, hebrewPaste, strayInch: exit 2 on the direct connector; no paste in stderr.
- p12: all 4 rows `block/body_shape`.
- Coordinator fuzz (fuzz13, 2000 cases, ask() and 2 hook names): `leak records=0` in every category (fuzz13/after.txt).

### Not fixed (RISKS)

- WR-01 (pre-existing): a non-Latin edge of 1 or 2 sentences is decided by English-only edge rules. p10 `hebrew2long` (2 sentences) is still allowed and goes on the wire. CR-04 closes only the fast-path half.
- WR-07 (pre-existing): a second free-form key on the direct connector is not shaped. p09 `question+context` and `question+ask` still exit 0.
- p03 `longTwoSentence` (2 sentences, 75 words, about 330 characters) is allowed: rulings 35 and WR-04 (4000 characters) allow it.
- p07 `threeShortPairs`: a quote of fewer than 4 words is not pasted text (pre-existing), so 3 short quoted fragments go on the wire.
- p06 `mcp__theo__search` is not Brain-shaped, so the hook does not inspect it (pre-existing, THEO-04).
- Fail-closed choices that can refuse a generic question: a semicolon and 2 or more tabs end a sentence for the body rule; a no-space full stop in a word that is not a known file or domain ending counts as an end; a stray inch mark or an unclosed quote, guillemet, backtick or single-quote opener refuses the whole call.
- IN-01 (cut input echoed in the hook message) and IN-04 (double cut in smartSearch) are not changed.
- The L05 timing bound (200 ms) depends on the machine. UNVERIFIED: that Claude Code honors `onFailure: block` on a hook timeout.

_Fixed: 2026-11-16_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

## Re-verify (round 2, tree fe022ea35, gsd-code-reviewer)

All r13 probes p01 to p12 re-run: the original CR-01 to CR-06, WR-02, WR-03 and WR-05 rows are closed (PROVEN). The 4000-character cap holds at 4000/4001 (v2c-cap.cjs). ownPluginShimRoute: no bypass found by reading; a second installed plugin with the same plugin.json name is UNVERIFIED. New findings (probes v2-fix-attack.cjs, v2b-fix-attack.cjs in the r13 folder):

- **NEW-BL-01 (BLOCKER)** `lib/core/part8-egress-guard.cjs` classifyAndCut + `part8-sprout-shape.cjs` cutQuotePairs: the end marks of a body sit inside its quotes (US punctuation: `said "we will cut the budget by half." The lead investor wrote "..." ...`). The original is 3 sentences; the cut removes the 3 full stops, the rest counts 1 sentence and goes on the wire (row endInsideQuote: shim onWire=true; direct route exit 2 with a resend of the 3 private clauses). Fix: decide body_shape on the text before the cut (a body before the cut stays a body), or let each cut span keep the end marks that close it.
- **NEW-BL-02 (BLOCKER)** `part8-sprout-shape.cjs` cutQuotePairs: "the cut never joins lines" is false for a quote span that holds a line break. 3 line-sentences joined by 2 multi-line quotes become 1 line and go on the wire (row multilineQuote; control without quotes is body_shape). Fix: a quote span that crosses a line break is ambiguous (fail closed), or put a line break in place of the span.
- **NEW-WR-01 (WARNING)** `part8-sprout-shape.cjs:128-141` (INITIAL with prev in NAME_BRIDGES): `the head of B. Revenue fell ... lack of D. Regulators ...` counts 2 of 4 sentences and goes on the wire (row initialAfterBridge, hook exit 0 on the direct connector).
- **NEW-WR-02 (WARNING)** `part8-sprout-shape.cjs:90-94, 209-211` (NAME_ENDINGS, d1b032fee): a no-space full stop before a capitalised word in the list (`In`, `Go`, `Me`, `Us`, `App`, `Log` ...) is not a break: `audit.In short ... out.In short ...` counts 1 of 3 sentences, on the wire (row nameEndingInShort, hook exit 0). Fix: apply nameEnding only when the ending starts lower-case.
- **NEW-WR-03 (WARNING)** `part8-sprout-shape.cjs` cutFences: a longer backtick run inside a 3-backtick span closes it, and the code after the run is sent (row fenceInnerRun, `boardPlan fireFounderAfterAudit investorExit` on the wire with the "kept local" disclosure). This matches CommonMark only when the run is on its own line. Fix: close only at a run at the start of a line for a multi-line fence; mid-line, fail closed when a later run of the same mark follows.

## Fix record round 2

**Fixed:** 2026-11-16 (gsd-code-fixer), on top of fe022ea35. The semicolon and 2-tab rule is not changed: owner ruling 2026-11-16 keeps it for this cut (fail closed); calibration is a follow-up.
**Test first:** 2b7d0ecbb adds the round 2 RED arms to `tests/test-395-egress-leaks.cjs`: L20 (the 5 rows of v2-fix-attack.cjs and v2b-fix-attack.cjs, plus a multi-line fence with an inner run), L21 (a seeded property over the fuzz categories, 600 cases: sentences(cut text) >= sentences(text with each span replaced by 1 word, end marks kept), and the cut never lowers the line count), L22 (classifyAndCut asserts the line count). RED: 81 passed, 8 failed. GREEN at 20b22edfb: 89 passed, 0 failed.

| Finding | Commit | Change |
|---------|--------|--------|
| test | 2b7d0ecbb | round 2 RED arms L20, L21, L22 |
| NEW-BL-02 | be06e6f57 | each cut span becomes the note plus the same number of line breaks; a run of pasted lines is 1 note line plus 1 empty line for each further line; no line is trimmed away; classifyAndCut fails closed when `countNewlines(cut.text) < countNewlines(input)` (countNewlines exported) |
| NEW-BL-01 | eb5ec7397 | the note keeps the end marks that close the span content (`said [note]. The lead`), so the cut text keeps the sentence ends that the quotes held |
| NEW-WR-01 | 0eb84ddb1 | a single initial ends a sentence; only a run of initials (J. R. R. Tolkien) stays open; NAME_BRIDGES removed |
| NEW-WR-02 | 2695f4e51 | a name ending counts only when it starts lower-case and matches the list exactly (SKILL.md, example.com); `audit.In short` ends a sentence |
| NEW-WR-03 | 20b22edfb | a fence that opens at a line start closes only at a run of the same mark, at least as long, alone on its line; a run that opens inside a line closes only at a run of exactly the same length; no close cuts to the end |

**Test changes outside the new test.** `tests/test-395-egress-body.cjs`: 3 expected cut strings gain the kept empty lines (be06e6f57: Q_BLOCK_CUT, Q_CODE_CUT, the unclosed tilde fence). E5 counts "How does the model of J. Doe work? What does it add?" as 3 sentences (was 2) and adds a run-of-initials row with 2 sentences (0eb84ddb1). No verdict arm changes.

**Re-run (isolated env: mktemp HOME, MINDRIAN_BRAIN_URL=http://127.0.0.1:9, no key, stdin /dev/null).**
- v2-fix-attack: endInsideQuote and multilineQuote `block/body_shape`, onWire=null. initialAfterTitle, nameEndingIn and linkToken `block/body_shape`. fenceInnerRun: cut 1, sent `explain with a framework [pasted text kept local] end` (no secret). titleSkip: `block/edge_rule` (sentence count 2, see RISKS).
- v2b-fix-attack: initialAfterBridge, nameEndingInShort, endInsideQuote, multilineQuote: `block/body_shape`, onWire=false, hook exit 2 on the direct connector. capBoundary (3949 characters, 2 sentences): allow under the 4000-character ruling.
- v2c-cap: 3999 and 4000 allow, 4001 `block/body_shape`.
- r13 p01 to p12: the same results as the first fix record (every leak row blocks or cuts). p05 at 80000: every row under 100 ms.
- fuzz13 (2000 cases): `leak records=0`, 0 leaks in each of the 18 categories (fuzz13/after-round2.txt).
- Suites at 20b22edfb: `bash tests/run-all-395.sh` 15 of 15 PASSED. Sweep of the 69 tests that load the guard modules: 66 pass, test-364-live-smoke skips (opt-in), test-205-grill-engine and test-252-guard-census fail with the same messages as on 07282e4ec (pre-existing).

**Not fixed (RISKS).** titleSkip: a title (Dr., Prof.) before a capital word that is not a common opener keeps the sentence open, so "hired the Dr. Investors left" undercounts by 1 for each title. It is kept because methodology questions name Dr. Deming and Prof. Christensen. The probe is blocked by the name rule. The wire text now holds empty lines where pasted lines were. A second installed plugin with the same plugin.json name stays UNVERIFIED for ownPluginShimRoute. The RISKS of the first fix record still apply.

_Fixed (round 2): 2026-11-16_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_

## Re-verify (round 3, tree 20b22edfb, gsd-code-reviewer)

r13 p01-p12, v2-fix-attack.cjs and v2b-fix-attack.cjs re-run: NEW-BL-01, NEW-BL-02, NEW-WR-01, NEW-WR-02 and NEW-WR-03 rows are closed (PROVEN). The line-count assertion in classifyAndCut holds by construction (noteFor adds the breaks of each span; LINE_BREAK_ALL and countNewlines count the same characters). Probe: v3-round3.cjs in the r13 folder.

- **R3-WR-01 (WARNING, titleSkip residual is a real path)** `part8-sprout-shape.cjs` isAbbreviation, TITLES arm: a lower-case title before a capital keeps the sentence open. `...hired a dr. Investors left ... under a prof. Regulators were not told ...` and `...on the main st. Investors left ... a new mr. Regulators ...` are 4 sentences, count 2, and go on the wire (hook exit 0 on the direct connector; shim onWire=true). The TitleCase form (`Dr.`, `Prof.`) is blocked only by the proper-name rule. Fail-closed fix: remove the TITLES suppression (a title always ends a sentence for the body rule). Cost: a question needs 2 titles and 1 more sentence to reach 3; the name rule already decides `Dr. Smith`.
- **R3-WR-02 (WARNING, low)** endMarksOf keeps only the trailing end marks of a span. End marks in the middle of a quote are lost: `founder "per the memo. Then the" lead investor ... "per his note. Then the" clinic pilot failed ...` counts 3 before the cut and 1 after, and the rest is sent (shim onWire=true; the direct route gets exit 2 with a resend of the rest). The form is unnatural. Fix: give the note one end mark when the span holds any end mark followed by a letter.
- No new BLOCKER. `noMarkQuote` (3 clauses with no end mark) counts 1 before the cut too, so it is the old no-punctuation case, not a cut merge.

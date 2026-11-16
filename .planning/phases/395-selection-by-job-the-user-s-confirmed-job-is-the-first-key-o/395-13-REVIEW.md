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

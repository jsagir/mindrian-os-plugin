---
phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re
reviewed: 2026-09-23T19:59:15Z
depth: deep
files_reviewed: 15
files_reviewed_list:
  - lib/hmi/turn-text.cjs
  - scripts/check-card-fire.cjs
  - lib/core/gate-relevance.cjs
  - scripts/replay-card-fire.cjs
  - scripts/card-fire-replay-corpus.cjs
  - scripts/label-card-fire-replay.cjs
  - scripts/extract-dogfood-stop-events.cjs
  - scripts/jev-devtime-client.cjs
  - agents/larry-extended.md
  - skills/larry-personality/SKILL.md
  - tests/test-357-corpus-loader.cjs
  - tests/test-357-f1-chrome.cjs
  - tests/test-357-harness-source.cjs
  - tests/test-357-labeler-refusal.cjs
  - tests/test-357-replay.cjs
findings:
  critical: 1
  warning: 2
  info: 1
  total: 4
status: issues_found
---

# Phase 357: Code Review Report

**Reviewed:** 2026-09-23T19:59:15Z
**Depth:** deep
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Scoped to the 20 commits under `973deb329..HEAD` whose subject matches `(357-`, isolating each
focus file's diff from interleaved peer commits (confirmed via `git log --grep='(357-' -- <file>`
per file; the `skills/larry-personality/SKILL.md` "Dominant Design" block that shows up in a raw
`git diff 973deb329..HEAD` is from an unrelated peer commit, `5fffa21d6`, not from 357, and is
excluded from this review).

The phase delivers what SPEC.md asked for: `node scripts/replay-card-fire.cjs --surface both`
reports `false_blocks=0 new_misses=0` (60 entries, 1 `KNOWN_MISS`, 1 `KNOWN_FALSE_BLOCK`, 0 parity
mismatches, 0 errors) against the live corpus; all five `test-357-*.cjs` files pass; the
tripwire suite (`test-353-tripwires.cjs`) is green and correctly lists `label-card-fire-replay` in
`HOOKS_BANNED_LEDGER_SCRIPTS`; the Larry prose shrink hits the >=50% bar on the two real spans and
leaves the SKILL :244 Voice Signature residual untouched, matching R-B; no em-dashes were found in
any of the 15 reviewed files or the three fixture JSON files; the dogfood fixture was grepped for
emails, `/home/`, `MindrianRooms`, and the navigator's name/handle -- clean. Part 8 egress in
`scripts/label-card-fire-replay.cjs` is structurally sound: `assertLabelable` is the first
statement of `buildRequestBody`, dogfood is excluded twice (once in `selectLabelable`'s source
filter, once again in `assertLabelable`), and the `card_fire_replay` egress profile's
`state_keys`/`must_equal_file`/`question_strings_from_file_key` match D-10/D-12/R-G.

One real logic bug was found in the D-07/R-A harness-classification carve-out
(`lib/hmi/turn-text.cjs`), reproduced directly against the shipped code, that silently converts a
"stay conservative" case into an auto-bypass case for a content shape the function's own contract
says should never reach that branch. Two further issues concern the dev-only dogfood-extraction
tooling's review-sheet fidelity and validation coverage; neither affects the committed fixtures
(already independently verified clean) but both degrade the tooling's usefulness on a future rerun.

## Critical Issues

### CR-01: `classifyPrecedingUserContentSource` rule 1 does not require the base class to be `'typed'`, so an `isMeta:true` record with no real text is silently promoted to `'harness'` instead of staying `'none'`

**File:** `lib/hmi/turn-text.cjs:176-197` (rule 1 at line 184; consumed by `scripts/check-card-fire.cjs:683`)

**Issue:** The function's own docstring (lines 150-164) defines the four return classes as a
strict hierarchy: `'harness'` requires the record to carry a REAL text block ("so the base class
would be `'typed'`"), and `'none'` ("no content at all... an unexplained absence") is documented
to "stay conservative." The implementation does not enforce that precondition:

```js
function classifyPrecedingUserContentSource(content, rec) {
  try {
    const base = classifyPrecedingUserContentSourceBase(content);
    if (!rec || typeof rec !== 'object') return base;
    const isMeta = rec.isMeta === true;
    ...
    // Rule 1: isMeta AND the previous user record was not itself human-upstream.
    if (isMeta && !prevHumanUpstream) return 'harness';   // <-- fires regardless of `base`
    ...
```

Reproduced directly against the shipped module:

```
$ node -e "
const tt = require('./lib/hmi/turn-text.cjs');
console.log(tt.classifyPrecedingUserContentSource('', {isMeta:true, prevHumanUpstream:false}));
console.log(tt.classifyPrecedingUserContentSource(null, {isMeta:true, prevHumanUpstream:false}));
console.log(tt.classifyPrecedingUserContentSource([], {isMeta:true, prevHumanUpstream:false}));
"
harness
harness
harness
```

All three inputs have `base === 'none'` (empty string, null, empty array all resolve to `'none'`
in `classifyPrecedingUserContentSourceBase`), yet the 2-arg call returns `'harness'`.

Downstream, `scripts/check-card-fire.cjs:683` treats `'harness'` and `'tool_result'` identically
-- both immediately return `{ intercept: false, reason: 'preceding-turn-synthetic-no-user-engagement' }`,
bypassing the block outright. `'none'` is explicitly NOT included in that check and instead falls
through to the relevance heuristics below it (the documented "stays conservative" floor), which for
a fresh gate with no user signal defaults toward forcing the card. So this bug flips a
"conservative, likely force" outcome into an unconditional pass for any transcript record shaped
`{ role: 'user', isMeta: true, content: null|''|[] }` -- exactly the class of record this phase's
own bar (0 new missed forks) exists to protect against. No test in `tests/test-357-harness-source.cjs`
or elsewhere exercises `isMeta:true` combined with empty/absent content, so this is currently
unguarded in both directions (no red test today, no regression coverage going forward).

**Fix:** Gate rule 1 on the base classification, matching the documented contract:

```js
// Rule 1: isMeta on a record that DOES carry real text (base 'typed'), and the
// previous user record was not itself human-upstream.
if (isMeta && base === 'typed' && !prevHumanUpstream) return 'harness';
```

With this change, `isMeta:true` + empty/absent content still returns `base` (`'none'` or
`'tool_result'` as appropriate), preserving the documented invariant and the existing
`'tool_result'` bypass semantics untouched.

## Warnings

### WR-01: `runWriteReviewSheet`'s "live outcome" and "pre-phase verdict" columns are populated from the same value, so the D-06 human checkpoint never actually shows the real production Stop verdict

**File:** `scripts/extract-dogfood-stop-events.cjs:883-897`

**Issue:** `357-DOGFOOD-LABELS.md` (the phase's single human checkpoint, D-06) is rendered with a
header claiming two distinct columns:

```js
const headerCols = withHeadVerdicts
  ? '| id | gist | live outcome | pre-phase verdict | HEAD verdict | proposed | why |'
  : '| id | gist | live outcome | pre-phase verdict | proposed | why |';
...
const liveOutcome = rawVerdictById[entry.id] || entry.expected_verdict_class;
const cells = [
  entry.id,
  gist.replace(/\|/g, '/'),
  liveOutcome,
  liveOutcome,   // <-- same value pushed twice
];
```

`rawVerdictById` is sourced only from `sanitize-report.json`'s `raw_verdict.class` (the pre-phase
*replay* verdict on the original candidate, written by `runApplySanitized`/`runScan`) -- it never
reads `candidates.json`'s `live_outcome` field, which is the actual outcome the real Stop hook
produced live in the navigator's session. Both table columns therefore always render the identical
pre-phase-replay value; the navigator reviewing the sheet has no way to see whether the live
production verdict and the pre-phase replay verdict actually agreed, which is precisely the
`envelope_partial`/`disagrees` distinction `runScan` computes and then discards before it reaches
the sheet.

**Fix:** Thread the real `live_outcome` through (e.g. persist it alongside `raw_verdict` in
`sanitize-report.json`, or read it back from `candidates.json`/`selected.json` by id) and populate
the two columns from their own distinct sources:

```js
cells.push(entry.id, gist.replace(/\|/g, '/'), realLiveOutcomeById[entry.id] || 'unknown', liveOutcome);
```

### WR-02: `classifyStopOutcome`'s pass/degrade classification relies on undocumented magic stdout byte-lengths with no shared constant or cross-check against `check-card-fire.cjs`'s actual output

**File:** `scripts/extract-dogfood-stop-events.cjs:242-261`

**Issue:**

```js
if (stdout.length === 39) return 'pass';
if (stdout.length === 71) return 'degrade';
return null;
```

These two literals are the entire discriminator between a live "pass" and a live "degrade" Stop
outcome when reconstructing dogfood candidates from raw session transcripts. They are not derived
from a shared constant, a regex against the known hook-output shape, or a reference to
`scripts/check-card-fire.cjs`'s own output-building code -- a future change to the hook's stdout
string (even a whitespace or wording change well outside this phase's scope) would silently start
returning `null` here (treated as "not a check-card-fire Stop attachment at all," per the function's
own contract), quietly dropping candidates from a future `--scan` rerun rather than failing loudly.
No test in the reviewed suite exercises this function against real `check-card-fire.cjs` output.

**Fix:** Either derive the expected lengths from `check-card-fire.cjs`'s own known-output builder
at require-time (so a drift breaks loudly), or add a narrow anchor test that runs `main()`'s output
path and asserts these two literals still match its real stdout length.

## Info

### IN-01: The replay corpus's em-dash guard only scans `entry`, never the file-level `meta` block (e.g. `sanitization_statement`)

**File:** `scripts/card-fire-replay-corpus.cjs:206-306` (guard at line 301: `if (containsEmDash(entry))`)

**Issue:** `validateEntry(entry, fileMeta)` deep-scans `entry` for U+2014 but never scans
`fileMeta` (the `meta` object each fixture file carries, including `sanitization_statement`,
`extracted_from`, etc.). The three committed fixture files were manually grepped clean for this
review, so there is no live leak today, but a future edit to a file's `meta` block that introduces
an em-dash would pass the loader's validation silently, contrary to the CLAUDE.md house rule the
rest of this guard enforces.

**Fix:** Extend the guard to also scan `fileMeta`: `if (containsEmDash(entry) || containsEmDash(fileMeta)) { ... }`.

---

_Reviewed: 2026-09-23T19:59:15Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

---
phase: 360-room-bind-picker-fires-on-harness-turns-userpromptsubmit-f-8
reviewed: 2026-09-24T12:11:35Z
depth: deep
files_reviewed: 8
files_reviewed_list:
  - scripts/intent-classifier.cjs
  - lib/core/room-bind-picker-policy.cjs
  - lib/core/session-binding.cjs
  - lib/hmi/turn-text.cjs
  - tests/test-360-harness-picker.cjs
  - tests/test-360-leads.cjs
  - tests/test-360-picker-policy.cjs
  - tests/fixtures/ups-harness-360/spawn-kit.cjs
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 360: Code Review Report

**Reviewed:** 2026-09-24T12:11:35Z
**Depth:** deep
**Files Reviewed:** 8 (scope limited to commits matching `(360-`, per instructions)
**Status:** issues_found (all findings are WARNING/INFO; no BLOCKER found)

## Summary

Reviewed every commit matching `(360-` against `scripts/intent-classifier.cjs`, `lib/core/room-bind-picker-policy.cjs`, `lib/core/session-binding.cjs`, `lib/hmi/turn-text.cjs`, and the six `test-360-*` suites plus their fixtures. All six phase-360 test files and `tests/run-all-360.sh` pass locally (45 + 26 + 34 + 18 + replay + 11 checks). The full diff for the four in-scope non-test files was pulled directly (`git diff <first 360 commit>~1..<last 360 commit>`) and matches what is reviewed below line-for-line.

No BLOCKER-level defect was found: every new guard (`harnessVerdict`, `unboundPickerSuppressed`, `cwdRoomsHomeVerdict`, `unboundPickerSuppression`) is wrapped in try/catch and fails toward today's picker on any fault, exactly as the R6/PSB-06 contract requires, and this is independently exercised by dedicated fault-injection legs (`r6-throwing-*`, `r6-missing-*`, `fault-throwing-picker-policy`) that all pass. Symlink, ancestor, relative-path, and missing-cwd edge cases are each covered by a passing unit test in `tests/test-360-picker-policy.cjs`. Session-memory scoping (`N-2`) is verified not to leak across `session_id`s (`r11-typed-remembered`'s "different session_id must still fire" leg). No em-dashes, no hardcoded secrets, no fixture leaks (confirmed independently with `grep` for real names/paths and by re-running the `r8d` tripwire leg).

Two WARNING-level findings concern residual correctness risk that the phase's own tests do not fully pin down: (1) a reproducible human-message false positive in the widened `HARNESS_LEADS` peer-stem, and (2) an untested state combination in `unboundPickerSuppression`'s "no-room-remembered" branch. A third WARNING flags redundant per-turn I/O introduced by the new early guard. Two INFO items note a pre-existing sentinel-literal duplication this phase could have cleaned up, and a documented-but-visible scope gap in the sibling F.1 dial consumer.

## Warnings

### WR-01: Widened `HARNESS_LEADS` peer-stem misclassifies a plausible human sentence as harness

**File:** `lib/hmi/turn-text.cjs:119-125` (consumed via `classifyUserPromptText:250-257`, gated into the hook at `scripts/intent-classifier.cjs:437-444, 550`)

**Issue:** 360-06 replaced the 40-char peer LCP (`'Another Claude session sent a message:\n<'`) with the 37-char stem `'Another Claude session sent a message'` (no colon, no newline, no tag-open bracket required). This is a `startsWith` test with no other discriminator on the UserPromptSubmit path (`LEAD_ONLY_REC.originKind` is always `undefined`, so rule 2 always evaluates). Repro:

```
node -e "console.log(require('./lib/hmi/turn-text.cjs').classifyUserPromptText('Another Claude session sent a message that confused me, what should I do about it?'))"
# -> harness
```

A real human, in a product that surfaces cross-session peer messages to the user by name, has a plausible reason to *open a prompt* with exactly that phrase (e.g. asking Larry about a notification they just saw). When that happens, `TURN_IS_HARNESS` is true and the entire D-07/D-08 early-guard family fires: no strict-mode override, no zero-score gate, no F.8 binding gate, and the consumer skips checking for a pending binding answer — for that one turn.

This is a *known, documented* tradeoff (SPEC R5, "accepted limit... 0 of 2,154 human prompts"), and the impact is transient (the picker/advisory will still fire on the session's next turn, not permanently lost), so this is not classified BLOCKER. But the 2,154-prompt census that justified dropping the colon/bracket suffix was measured against *historical* prompts, not against the specific new false-positive shape this change opens up (a human prompt *about* the peer-message feature itself) — a shape that becomes more likely precisely because this plugin is the one surfacing peer messages to users.

**Fix:** Consider re-adding a narrow secondary discriminator for this one entry only (e.g. still require the following character to be `:` or whitespace+`while`, which covers both known binary framing variants without opening a bare-prefix match on natural sentences), or add a lightweight counter/log when this specific lead fires so a future census can confirm the 0-observed assumption still holds after the widening ships.

### WR-02: `unboundPickerSuppression`'s "no-room-remembered" branch is untested for the sentinel-plus-real-room combination

**File:** `lib/core/room-bind-picker-policy.cjs:137-140`

**Issue:**
```javascript
if (!realPrimary) {
  const sentinelRemembered = rawPrimary === NO_ROOM_SLUG || rawBound.indexOf(NO_ROOM_SLUG) !== -1;
  if (sentinelRemembered) return 'no-room-remembered';
  ...
```
This branch suppresses the picker permanently for the session whenever `NO_ROOM_SLUG` is anywhere in `binding.bound`, *regardless of whether `binding.bound` also contains a real room slug*. `lib/workflow/session-binding-consumer.cjs:consumeSessionBinding` writes `bound: picks` directly from the F.8 card's confirmed multi-select toggle set, with `primary: primaryPick` chosen independently — so a user who checks both a real room's box *and* "dev repo / no room" in the same F.8 answer, without also picking a primary, produces exactly `{ bound: ['some-room', '__no_room__'], primary: null }`. Per this code, that session is now permanently treated as "chose no room" for cwd/N-1 purposes, even though it also has a real room in `bound`.

`tests/test-360-picker-policy.cjs` covers only the sentinel-alone case (`unit-suppress-sentinel-bound-null-primary`, `bound: [NO_ROOM_SLUG]`) and the real-primary case (`unit-suppress-real-primary-with-sentinel-also-bound`, which has a non-null `primary`). Neither test exercises `bound` holding both a real slug and the sentinel with `primary: null`.

**Fix:** Add a unit leg for `{ bound: ['tin-orchard', NO_ROOM_SLUG], primary: null }` and confirm the intended verdict deliberately (either document why "no-room-remembered" is still correct here, matching P-2's stated wording, or scope the sentinel check to the case where `realBound.length === 0` as the `cwd-outside-unbound` branch already does two lines below it).

### WR-03: The new early guard reads the session-binding file redundantly on every non-harness turn

**File:** `scripts/intent-classifier.cjs:463-472` (`unboundPickerSuppressed`), compare `:698` and `:766`

**Issue:** `unboundPickerSuppressed(root)` calls `sb.readSessionBinding(sessionId, { home: root })` unconditionally on every turn that reaches it (i.e. every non-empty, non-harness UserPromptSubmit invocation). For a session that proceeds into the zero-score gate (`:696-698`) or the F.8 gate (`:764-766`), the *same* session's binding file is read again later in the same `main()` call — up to 3 reads of one small JSON file per hook invocation where there used to be 1-2. None of these calls receive or check the existing `deadline`/`BUDGET_MS` value the rest of `main()` uses for its other I/O-bound loops (e.g. `discoverSealedRooms(root, deadline)`).

Given the explicit review focus on hook latency (this hook fires on literally every user prompt), this is worth tightening even though the absolute cost of one extra small JSON read is unlikely to blow the 200ms budget on a healthy filesystem.

**Fix:** Thread a single `readSessionBinding` result into `unboundPickerSuppressed` and reuse it at `:698`/`:766` instead of re-reading, or accept `deadline` into `unboundPickerSuppressed` so a slow/hung rooms-home mount degrades the same way the rest of `main()` does.

## Info

### IN-01: `NO_ROOM_SLUG` is still a re-typed literal in `scripts/intent-classifier.cjs`

**File:** `scripts/intent-classifier.cjs:199`
**Issue:** `const NO_ROOM_SLUG = '__no_room__';` pre-dates Phase 360 (2026-07-01, `03806baf0c`) and is not part of this phase's diff, so it is not a regression here. But Phase 360-07 added a hygiene test (`unit-no-sentinel-literal-in-policy-module`) that enforces "never re-type the reserved sentinel as a quoted literal" *only* for `lib/core/room-bind-picker-policy.cjs`, and 360-07 also exported the canonical `NO_ROOM_SLUG` from `lib/core/session-binding.cjs` specifically so consumers could stop re-typing it (per that file's own new comment at `session-binding.cjs:208-209`). The oldest, largest consumer of the sentinel in this codebase (`intent-classifier.cjs`) was left out of that cleanup, so the hygiene guarantee this phase introduced does not actually cover the file most likely to drift.
**Fix:** Not required for this phase to ship, but worth a follow-on: `const { NO_ROOM_SLUG } = require('../lib/core/session-binding.cjs')` in `intent-classifier.cjs`, removing the local literal at line 199.

### IN-02: `consumePriorF1Pick` (the Next-Move dial answer consumer) has no harness guard, unlike `consumePriorBindingAnswer`

**File:** `scripts/intent-classifier.cjs:3650-3655` (compare the `if (!TURN_IS_HARNESS)` guard at `:3666`)
**Issue:** D-08 wraps `consumePriorBindingAnswer` in `if (!TURN_IS_HARNESS)` so a peer/subagent turn can never be misread as the user's answer to the room-bind card (SPEC R2). `consumePriorF1Pick`, the sibling consumer for the F.1 Next-Move dial card three lines above it, has no equivalent guard — a harness turn's text can still be read as `selectedOption`/`text` for a pending dial pick. This is explicitly named as a deferred follow-on in `360-08-PLAN.md` ("the harness-turn behavior of consumePriorF1Pick... D-09 deferred"), so it is a known, deliberate scope decision, not an oversight this review is surfacing for the first time — flagged here only so it stays visible outside the planning archive.
**Fix:** None required this phase; tracked as a stated follow-on candidate already.

---

## Fix Status (gsd-code-fixer, 2026-09-24)

All three WARNING findings were fixed and committed on `main`, one commit per finding, in the
shared dev tree (`/home/jsagi/dev/MindrianOS-Plugin`), with peer files (`lib/core/fork-declaration.cjs`,
`lib/core/gate-relevance.cjs`, the four deliberately-uncommitted files) untouched.

### WR-01: fixed

**Commit:** `5aea10f1f`
**Files:** `lib/hmi/turn-text.cjs`, `tests/test-360-leads.cjs`

The bare 37-char peer stem in `HARNESS_LEADS` is no longer a plain `startsWith` match. A new
`leadMatchesHarnessTag(lead, tag)` requires the stem to be immediately followed by the actual
harness framing continuation (`:` or ` while you were working:`, then optional inline whitespace
and a line break) before it counts as a match; the other four `HARNESS_LEADS` entries are
unaffected and stay plain `startsWith`. Two RED-then-GREEN legs were added to
`tests/test-360-leads.cjs` pinning the review's exact repro and a same-line-colon variant.

Verified: `node tests/test-360-leads.cjs` (28/28, RED confirmed before the fix, GREEN after),
`node tests/test-360-snapshot-replay.cjs` (harness 33->0, human 2->2, unchanged), `bash
tests/run-all-357.sh` (PASS=16 FAIL=0), `node scripts/replay-card-fire.cjs --surface both
--baseline compare` (new_misses=0, parity_mismatches=0, errors=0, unchanged per-entry).

### WR-02: fixed

**Commit:** `ee605e1a2`
**Files:** `lib/core/room-bind-picker-policy.cjs`, `tests/test-360-picker-policy.cjs`

`unboundPickerSuppression`'s no-room-remembered branch now only fires when the `NO_ROOM_SLUG`
sentinel is the SOLE entry in `bound` (no real room slug riding alongside it) or is the EXPLICIT
`primary`. A binding shaped `{ bound: ['some-room', NO_ROOM_SLUG], primary: null }` (a navigator
who checked both a real room's box and "dev repo / no room" without picking a primary) now falls
through to today's picker behavior (`null`) instead of permanently suppressing. Two unit legs
were added to `tests/test-360-picker-policy.cjs`, pinning both the non-suppressing ambiguous
shape and the still-suppressing explicit-primary-plus-real-room shape.

Verified: `node tests/test-360-picker-policy.cjs` (36/36, including both new legs).

### WR-03: fixed

**Commit:** `0e55561dd`
**Files:** `scripts/intent-classifier.cjs`

Added `getCachedSessionBinding(sessionId, root)`, a memoized reader keyed on
`sessionId + root`, threaded into `unboundPickerSuppressed`, the zero-score gate, and the F.8
binding gate, replacing their three independent `readSessionBinding` calls. A read fault is
cached and re-thrown on every subsequent call for that key, so each call site's own pre-existing
try/catch fail-open behavior is unchanged; only the redundant filesystem read is eliminated. The
fix was contained to `scripts/intent-classifier.cjs`; `consumePriorBindingAnswer`'s own separate,
rarely-triggered `readSessionBinding` call was left untouched (out of this finding's cited scope,
`:463-472` vs `:698`/`:766`).

Verified: `node tests/test-360-harness-picker.cjs --only r3` (6/6), `node
tests/test-360-r3-suites.cjs` (18/18, byte-identical human-turn output confirmed), `bash
tests/run-all-360.sh` (PASS=8 FAIL=0).

### IN-01, IN-02: documented only, no change

Both are explicitly marked "not required this phase" / "tracked as a stated follow-on candidate
already" in the original review, and the fix instructions for this pass named them
document-only. No source change made.

---

_Fixed: 2026-09-24_
_Fixer: Claude (gsd-code-fixer)_

---

_Reviewed: 2026-09-24T12:11:35Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

---
phase: 396-part-8-problem-shape-packet-measure-close-the-six-bypasses-s
plan: 03
subsystem: part8-egress-guard
tags: [part8, bypass-1, unicode, nfkc, format-characters, wave1, tourniquet]
requires: ["392-01", "392-02"]
provides:
  - "lib/core/part8-normalize.cjs: normalizeForGuard (NFKC then strip every \\p{Cf}), FORMAT_CHAR_RE"
  - "part8-egress-guard.cjs _proveTypedQuestion: Unicode-aware tokenizer, empty proof is false, a non-vocabulary character fails the proof"
  - "part8-egress-guard.cjs: a letter outside the Latin script blocks room_content/identifier at step 4 of both verdict paths"
  - "classify and theoVerdict normalise every string leaf before any rule; auditQueryString and auditQueryObject scan the normalised text"
affects: [392-05, 392-09, 392-11]
tech-stack:
  added: []
  patterns: ["lazy dependency with an ASCII fast path (the 386-35 pattern) so the hook module budget holds", "RED proof on the current tree before GREEN", "isolated HEAD export to attribute a count change in a shared working tree"]
key-files:
  created:
    - lib/core/part8-normalize.cjs
    - tests/test-396-bypass-1-unicode-tokens.cjs
    - tests/test-396-nfkc-format-strip.cjs
  modified:
    - lib/core/part8-egress-guard.cjs
    - lib/core/rs-egress-prompts.cjs
decisions:
  - "A non-Latin letter blocks as room_content with the existing token class identifier (TOKEN_CLASSES is pinned at 9 entries by tests/test-3692-theo-verdict.cjs, outside this plan); the reason text names the rule in plain words."
  - "The normaliser loads lazily on the first string with a character above 0x7F; NFKC and the Cf strip are identities on ASCII, so the hook's fresh-process module count stays at 174 (LZ5 before line 175)."
  - "auditQueryString and auditQueryObject return the caller's input and keep the raw sample; only the scan reads the normalised text."
  - "Test U4 uses 'recommend a framework for a wicked problem' (354 template 1); the plan's 'what is jobs to be done' already returned false on beta.81."
metrics:
  duration: "20 min (2026-11-08 17:44Z to 18:04Z)"
  tasks: 2
  files: 5
  completed: 2026-11-08
---

# Phase 392 Plan 03: Bypass 1 (Unicode tokens) and the NFKC normaliser Summary

A Hebrew or CJK sentence no longer passes `_proveTypedQuestion` with zero tokens: the tokenizer splits on `/[^\p{L}\p{N}_-]+/u` after NFKC, an empty token list is no proof, a token with a character outside `[a-z0-9_-]` fails the proof, and a letter outside the Latin script blocks `room_content/identifier` in both verdict paths. A shared normaliser (NFKC, then strip every `\p{Cf}`) runs at both guard entries and in rs-egress-prompts, so a fullwidth or zero-width-joined key or address is judged in its plain form. Replay after the change: extended_blocked 8 of 535 (baseline 8), must_refuse_blocked 10 of 10.

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 RED | failing test for bypass 1 | 791abacf7 | tests/test-396-bypass-1-unicode-tokens.cjs |
| 1 GREEN | Unicode-aware typed proof, non-Latin token fails closed | 2d10fc084 | lib/core/part8-egress-guard.cjs, tests/test-396-bypass-1-unicode-tokens.cjs (U4 question) |
| 2 RED | failing test for NFKC and format characters | 9ebd3323a | tests/test-396-nfkc-format-strip.cjs |
| 2 GREEN | shared normaliser at both guard entries and in rs-egress-prompts | 1749268be | lib/core/part8-normalize.cjs, lib/core/part8-egress-guard.cjs, lib/core/rs-egress-prompts.cjs |

## RED failure lines

Task 1, `node tests/test-396-bypass-1-unicode-tokens.cjs` on the tree before the guard change (exit 1, 2 passed, 4 failed):

```
FAIL - U1 Hebrew sentence is not allowed as typed_question
  Hebrew sentence allowed as typed_question: {"verdict":"allow","class":"typed_question","token_class":null,"reason":"closed-vocabulary methodology question"}
FAIL - U2 CJK sentence is not allowed as typed_question
  CJK sentence allowed as typed_question: {"verdict":"allow","class":"typed_question", ...}
FAIL - U3 one Latin methodology word plus Hebrew prose is not allowed as typed_question
  mixed sentence allowed as typed_question: {"verdict":"allow","class":"typed_question", ...}
FAIL - U4 _proveTypedQuestion: Hebrew false, canonical true, zero-token string false
  Hebrew sentence proved as a typed question
```

Reason, PROVEN by a probe: the split `/[^a-z0-9_-]+/` yields no token for a string with no ASCII letter, the loop body never runs, and the proof returns true. `_proveTypedQuestion("?? !! ... --")` also returned true on that tree.

Task 2, `node tests/test-396-nfkc-format-strip.cjs` after Task 1 GREEN and before the normaliser existed (exit 1, 2 passed, 6 failed), identical on the isolated HEAD export:

```
FAIL - N1 ... Cannot find module '.../lib/core/part8-normalize.cjs'   (same for N2, N3)
FAIL - N4 a fullwidth credential-shaped question blocks
  fullwidth key shape not blocked: {"verdict":"allow","class":"generic_question", ...}
FAIL - N5 a credential-shaped question with a zero width space between every character blocks
  zero width space key shape not blocked: {"verdict":"allow","class":"generic_question", ...}
FAIL - N6 auditQueryString reports the same hit for a fullwidth email-shaped string as for the plain one
  fullwidth email shape did not hit auditQueryString
```

In the shared repo tree N5 read `sprouts_required/body_shape` at that moment (the in-flight 392-04 cap caught the joined string as a body); the isolated export shows the beta.81 line, `allow generic_question`. After the normaliser both trees answer `content_set`.

## What changed in the guard

- `_proveTypedQuestion` (docblock updated): `TYPED_TOKEN_SPLIT = /[^\p{L}\p{N}_-]+/u` on the normalised, lowercased string; `tokens.length === 0` returns false; `TYPED_TOKEN_NON_VOCAB = /[^a-z0-9_-]/` on a token returns false.
- `NON_LATIN_LETTER = /(?!\p{Script=Latin})\p{L}/u` and `_hasNonLatinLetter`: step 4 of `_theoShapedVerdict` and of `theoVerdict`, after the lexicon (a bound room's own word still reports the lexicon hit) and before the identifier rule. Verdict `block`, class `room_content`, token class `identifier`, reason "the string carries a token outside the Latin methodology vocabulary; no methodology handle matches it".
- `classify` step 0 and `theoVerdict` entry: `_normalizePayloadLeaves` (strings normalised, arrays and plain objects walked, depth cap 32) or `_normalizeForGuard` for a bare string. The guard returns no field that carries string bytes or a byte length, so no raw copy is kept.
- `_normalizeForGuard`: ASCII fast path (`/^[\x00-\x7f]*$/`), lazy `require('./part8-normalize.cjs')` on the first non-ASCII string. FREEFORM_KEYS and `_extractFreeFormString` untouched (plan 392-05).

rs-egress-prompts.cjs: the same lazy helper; `auditQueryString` tests the patterns on `normalizeForGuard(s)` and returns `s`; `auditQueryObject` tests on `normalizeForGuard(JSON.stringify(obj))`.

## Timing

`classify` on a 4,000 character payload with soft hyphens, zero width spaces and fullwidth letters mixed in, mean of 5 runs after a warm-up: 0.33 ms in the repo tree, 0.29 ms and 1.45 ms on the export (two runs). Plan target 50 ms, assertion 200 ms.

## Replay matrix after this plan (scratch, not committed)

`node tests/helpers/part8-overblock-replay.cjs --record <scratch> --guard-head 1749268be`, network_calls 0.

| Number | beta.81 baseline | after 392-03 |
|--------|------------------|--------------|
| extended_blocked | 8 of 535 | 8 of 535 |
| must_refuse_blocked | 10 of 10 | 10 of 10 |
| set P / ADV / C (allow, ambiguous, block) | 5,0,10 / 4,0,19 / 606,0,50 | 5,0,10 / 4,0,19 / 606,0,50 |
| set R real calls, 126 local rows | 115, 2, 9 | 115, 2, 9 |
| total 820 rows | 730, 2, 88 | 730, 2, 88 |

By class (block, fixtures only, 694 rows): sprouts_required 44, content_set 20, room_content 13, write_blocked 2. By token class (block): edge_rule 27, private_marker 17, none 22, room_term 4, claim 3, identifier 2, private_context 1, person 1, venture_name 1, room_file 1. By tool: brain_ask 612 allow / 75 block, brain_write 3 block, brain_query 1 block, brain_search 1 allow, normalize_framework_name 1 allow, brain_stats 1 allow. The fixture corpus has no non-ASCII case, so the non-Latin rule and the normaliser change no replay row; the new tests carry the coverage.

## Verification

- `node tests/test-396-bypass-1-unicode-tokens.cjs`: 6 passed (U1 to U6), extended allow 527 block 8, must_refuse 10 of 10.
- `node tests/test-396-nfkc-format-strip.cjs`: 8 passed (N1 to N8), same counts, timing above.
- `node tests/test-354-egress-typed-question.cjs`: 50 passed, 0 failed.
- `node tests/test-355-part8-egress.cjs`: PASS 34, FAIL 0.
- `bash tests/run-all-386.sh`: PASS=37 FAIL=0 SKIP=0 (final tree). LZ5 line: guard 172 to 11; hook 175 to 174; statusline 182 to 18.
- `bash tests/run-all-396.sh`: PASS=9 FAIL=0 SKIP=0 (9 files: this plan's 2, plus replay-harness, vocabulary-drift, theo-route-matrix, eureka-deadline, bypass-4-glued-paragraph, email-regex-linear, shape-packet).
- `node tests/test-369-hook-require-graph.cjs`: 5 passed, 0 failed.
- `node tests/test-3692-theo-verdict.cjs` and `tests/test-257-refusal-egress-kind.cjs` (TOKEN_CLASSES pins): pass.
- tests/test-389-seed-egress.cjs is absent on this branch (rebase pending, D-07); not run.
- The same checks on a `git archive HEAD` export with only this plan's five files copied in: bypass-1 6 of 6, nfkc 8 of 8, 354 pass, 355 pass, 386 PASS=36 with the one failure test-386-guard-test-mutation-proof.cjs, which runs `git show HEAD:...` and the export has no `.git` (environment artifact; it passes in the repo tree).
- Dash check on the five files: 0 em dash, 0 en dash.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] A Hebrew sentence fell through to allow generic_question**
- **Found during:** Task 1 GREEN
- **Issue:** with the proof fixed, the sentence took the step 4 content rules, which are ASCII-based, and ended as `allow generic_question`; the plan's first truth requires a refusal.
- **Fix:** `_hasNonLatinLetter` at step 4 of both verdict paths (block room_content/identifier). No new token class: TOKEN_CLASSES is pinned at 9 by test-3692, outside this plan's files.
- **Files modified:** lib/core/part8-egress-guard.cjs
- **Commit:** 2d10fc084

**2. [Rule 1 - Bug in the test spec] The plan's canonical question did not prove on beta.81**
- **Found during:** Task 1 GREEN
- **Issue:** `_proveTypedQuestion("what is jobs to be done")` was false on the HEAD guard before any change (jobs and done are not methodology tokens; the phrase is canonical only inside longer phrases).
- **Fix:** U4 uses "recommend a framework for a wicked problem" (354 generic corpus, template 1), which proves before and after.
- **Files modified:** tests/test-396-bypass-1-unicode-tokens.cjs
- **Commit:** 2d10fc084

**3. [Rule 3 - Blocking] The new module lifted the hook's module count to the LZ5 before line**
- **Found during:** Task 2 verify (`bash tests/run-all-386.sh`: "LZ5: hook count 175 is not lower than 175"); the coordinator's note from 392-04 named the same failure.
- **Issue:** test-386-folder-memory-lazy-timeline LZ5 runs the hook in a fresh process on an ASCII brain_ask probe and requires strictly fewer than 175 modules; the eager `require('./part8-normalize.cjs')` in the guard and in rs-egress-prompts was the +1 from 174.
- **Fix:** lazy require inside the function with an ASCII fast path in both files (NFKC and the Cf strip are identities on ASCII). Every string leaf still passes through the function. LZ5 reads hook 175 to 174 again. Fixed before the GREEN commit, so no follow-up commit was needed.
- **Files modified:** lib/core/part8-egress-guard.cjs, lib/core/rs-egress-prompts.cjs
- **Commit:** 1749268be

### Shared-tree note (no change by this plan)
During Task 1 GREEN the repo tree showed extended allow 526 block 8 plus C81 as `sprouts_required/edge_rule`, and test-386-audit-probe-gate PG33 failed on C81. A faithful `git archive HEAD` export with only this plan's guard showed 527/8 and PG33 green, so the cause was the uncommitted 392-04 change to lib/core/part8-sprout-shape.cjs in the same tree at that moment. Per the collision rule that diff was not touched. The final tree (392-04 committed) reads 527/8 and 386 PASS=37.

## Deferred to 392-05 (carried from 392-04, which could not touch the guard)

1. The sprout `reason` of part8-sprout-shape.cjs (`word_too_long` | `string_too_long`) should surface as a typed token class in `_theoShapedVerdict` instead of the generic `body_shape`.
2. The plain-word email form in lib/core/cross-room-aggregator.cjs now matches a gap of 1 to 3 whitespace characters only; wider gaps rely on this plan's normalisation (format characters are stripped, but a run of ordinary spaces is not collapsed).

## TDD Gate Compliance

Task 1: RED 791abacf7 (test), GREEN 2d10fc084 (feat). Task 2: RED 9ebd3323a (test), GREEN 1749268be (feat). No refactor commit.

## Known Stubs

None.

## Threat Flags

None. No new network endpoint, auth path, file access pattern or schema. T-392-07, T-392-08 and T-392-09 of the plan's register are mitigated by the tests above (U1 to U4, N4 to N6, N8).

## Self-Check: PASSED

Files: lib/core/part8-normalize.cjs, lib/core/part8-egress-guard.cjs, lib/core/rs-egress-prompts.cjs, tests/test-396-bypass-1-unicode-tokens.cjs, tests/test-396-nfkc-format-strip.cjs exist. Commits 791abacf7, 2d10fc084, 9ebd3323a, 1749268be exist in `git log`.

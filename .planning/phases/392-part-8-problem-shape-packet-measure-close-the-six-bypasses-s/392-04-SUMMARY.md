---
phase: 392-part-8-problem-shape-packet-measure-close-the-six-bypasses-s
plan: 04
subsystem: part8-egress-guard
tags: [part8, bypass-4, sprout-shape, redos, linear-regex, wave2]
requires: ["392-01", "392-02"]
provides:
  - "lib/core/part8-sprout-shape.cjs: WORD_MAX_CHARS 80, STRING_MAX_CHARS 240, joiner-aware word count, result.reason (word_too_long | string_too_long | null)"
  - "lib/core/cross-room-aggregator.cjs: _P_EMAIL_OBFUSCATED in linear time, same exported collections"
  - "tests/test-392-bypass-4-glued-paragraph.cjs: G1 to G7"
  - "tests/test-392-email-regex-linear.cjs: E1 to E5 (timing, linearity, positives, negatives, exports, hook wall time)"
affects: [392-05, 392-09]
tech-stack:
  added: []
  patterns: ["bounded quantifiers plus a start lookbehind for a linear scan", "shape result carries a typed reason", "RED test records the measured time"]
key-files:
  created:
    - tests/test-392-bypass-4-glued-paragraph.cjs
    - tests/test-392-email-regex-linear.cjs
  modified:
    - lib/core/part8-sprout-shape.cjs
    - lib/core/cross-room-aggregator.cjs
decisions:
  - "A single-dash compound (room-scoped) stays one word; a token with 2 or more dashes splits at every dash. The literal split on every hyphen refused C:extended:C81 (a legitimate 12-word question) and lifted extended_blocked to 9."
  - "A cap case is kind body (not edge), so the guard answers sprouts_required today; the typed reason reaches the guard outcome in plan 392-05."
  - "The adversarial string is a run of local-part characters with dots; the plan's 'aaaa at' and 'dot' fragments ran in 1 to 10 ms on this machine and do not reproduce the hole."
metrics:
  duration: "15 min (2026-11-08 17:41Z to 17:57Z, commit clock)"
  tasks: 2
  files: 4
  completed: 2026-11-08
---

# Phase 392 Plan 04: Bypass 4 caps and the linear email pattern Summary

A glued paragraph (hyphen chain, underscore or U+200B joins) now counts its true words and any token over 80 or string over 240 characters is a body with a typed reason; the obfuscated-email pattern scans 40,000 characters in 3 ms (8.102 s before) and the hook ends in 106 ms on that payload.

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 RED | failing glued-paragraph test | 838d80ce6 | tests/test-392-bypass-4-glued-paragraph.cjs |
| 1 GREEN | caps, reason field, joiner-aware word count | 22cc1d5e3 | lib/core/part8-sprout-shape.cjs |
| 2 RED | failing timing test | d6690591b | tests/test-392-email-regex-linear.cjs |
| 2 GREEN | linear obfuscated-email pattern | 8e7f5c50a | lib/core/cross-room-aggregator.cjs |

## RED results on the unchanged code

Task 1, `node tests/test-392-bypass-4-glued-paragraph.cjs` (exit 1, 6 arms failed):

```
FAIL - G1: glued paragraph counted as one word (hyphen join, 319 characters, words=1, kind=sprout)
FAIL - G2: glued paragraph counted as one word (underscore join, 319 characters, words=1, kind=sprout)
FAIL - G3: glued paragraph counted as one word (U+200B join, 319 characters, words=1, kind=sprout)
FAIL - G4: an 81 character token is a sprout; 81 character token reason is undefined, expected word_too_long; ...
FAIL - G5: 12 words of 241 characters are a sprout; 241 character string reason is undefined, expected string_too_long
FAIL - G6: WORD_MAX_CHARS is undefined, expected 80; STRING_MAX_CHARS is undefined, expected 240 to 320
ok - G7 test-386-sprout-body-shape.cjs exit 0
```

Task 2, `node tests/test-392-email-regex-linear.cjs` (exit 1, 3 arms failed):

```
FAIL - E1: 40,000 characters took 8.102 s (8102 ms), budget 1000 ms: super-linear email pattern
FAIL - E2: not run: the 40,000 character scan is already over budget (quadratic growth would take minutes)
ok - E3 8 positives hit, 7 negatives miss
ok - E4 ALWAYS 20, PROSE 9, FORBIDDEN 29 patterns; rs-egress-prompts re-exports the same arrays
FAIL - E5: hook wall time 8.356 s (8356 ms), budget 2000 ms, exit 2
```

RED timing: 8.102 s for the pattern set over 40,000 characters; 8.356 s hook wall time (the hook blocked, exit 2, but 3.4 s past the 5 s hook budget's half). A scratch measurement of the email pattern alone on a pure "a." run gave 16.4 s; the committed fixture ends with the plan's fragments and measured 8.1 s.

## GREEN results

Task 1: G1 to G7 ok. G1 to G3 report `body (words=40, reason=string_too_long)`; G4: 81 characters not sprout (word_too_long), 79 and 80 characters sprout; G5: 241 characters not sprout (string_too_long), 239 and 240 characters sprout; G6: WORD_MAX_CHARS 80, STRING_MAX_CHARS 240, SPROUT_MAX_WORDS 12.

Task 2: E1 40,000 characters in 3 ms, 0 hits; E2 400,000 characters in 9 ms (limit 400 ms, linear); E3 8 positives hit, 7 negatives miss; E4 exports unchanged; E5 hook wall time 106 ms, exit 2.

## Cap values and the word rule

| Constant | Value | Effect |
|----------|-------|--------|
| WORD_MAX_CHARS | 80 | a longer token makes the string a body, reason word_too_long |
| STRING_MAX_CHARS | 240 | a longer trimmed string is a body, reason string_too_long (no extended question is longer; the cap stayed at 240) |
| SPROUT_MAX_WORDS | 12 | unchanged |

Word rule: a word ends at whitespace, an underscore or a format character (`\p{Cf}`: U+200B, U+200C, U+200D, the soft hyphen, U+FEFF). A token with one dash is an ordinary compound and stays one word; a token with 2 or more dashes (`\p{Pd}`) splits at every dash. Reason for the compound exception: see deviation 1.

## Root cause of the slow email pattern

Both alternatives of the beta.81 pattern opened with an unanchored local part (`[A-Za-z0-9._%+-]+`; the second after a `\b`, which sits at every letter next to a dot). Inside a long run of local-part characters every position started a match that ate the rest of the run and backtracked: O(n^2). Fix: a lookbehind `(?<![A-Za-z0-9._%+-])` so only the first character of a run can start a match, local part bounded to 64 and labels to 63 characters, whitespace runs bounded to 3, and the plain-word form never takes the word "dot" as a label. The pattern stays inside ALWAYS_PATTERNS and FORBIDDEN_PATTERNS at the same positions; lib/core/rs-egress-prompts.cjs needed no change (E4 proves the same array objects).

Limit of the bounded form: an obfuscated address with 4 or more whitespace characters between its tokens no longer matches the plain-word form (`\s{1,3}`); the beta.81 form matched any run. Plan 392-03's NFKC and whitespace normalisation runs before the guard's pattern scan and narrows this gap; the residual is noted for 392-05.

## Replay matrix (scratch, not committed)

Recorded with `node tests/helpers/part8-overblock-replay.cjs --record <scratch> --force` after each task. Both runs: 694 fixture rows, network_calls 0.

| Number | Baseline beta.81 | After task 1 (literal hyphen split) | After task 1 (compound rule) | After task 2 |
|--------|------------------|--------------------------------------|-------------------------------|--------------|
| extended_blocked | 8 of 535 | 9 of 535 | 8 of 535 | 8 of 535 |
| must_refuse_blocked | 10 of 10 | 10 of 10 | 10 of 10 | 10 of 10 |
| fixture blocks (P + ADV + C) | 79 | not recorded | not recorded | 79 |

The final run's recorded_head (a568221e7) is a parallel plan's commit: plans 392-03 and 392-08 commit in the same tree, and the working tree held 392-03's uncommitted guard edit during every run here. The gate numbers (8 and 10) are the ones this plan is held to.

## Verification

- `node tests/test-392-bypass-4-glued-paragraph.cjs`: exit 0 (G1 to G7).
- `node tests/test-392-email-regex-linear.cjs`: exit 0 (E1 to E5).
- `node tests/test-386-sprout-body-shape.cjs`, `test-386-sprout-split-route.cjs`, `test-386-sprouts-required-outcome.cjs`: exit 0.
- `node tests/test-386-web-credential-hook.cjs`, `test-386-key-shapes-and-money.cjs`, `test-386-identifier-forms.cjs`: exit 0.
- `node tests/test-386-audit-probe-gate.cjs`: PG33 8 answered sprouts_required (the listed stays_split_edges), exit 0 after the compound rule (it failed with C81 under the literal split).
- `bash tests/run-all-386.sh` after task 1: PASS=37 FAIL=0 SKIP=0. After task 2: PASS=36 FAIL=1; the failing file is test-386-folder-memory-lazy-timeline.cjs LZ5 "hook count 175 is not lower than 175". Cause: the uncommitted 392-03 edits add `require('./part8-normalize.cjs')` to lib/core/part8-egress-guard.cjs and lib/core/rs-egress-prompts.cjs, which lifts the hook's fresh-process module count to the RCA before line. This plan's diff adds no require (`git diff lib/core/cross-room-aggregator.cjs | grep require` is empty). Owner: plan 392-03.
- `bash tests/run-all-392.sh`: PASS=9 FAIL=0 SKIP=0, 9 files discovered (this plan's 2, plus the files of plans 392-01, 392-02, 392-03, 392-07 and 392-08 present in the tree at 2026-11-08 18:00Z).
- tests/test-389-seed-egress.cjs is absent on this branch (the rebase onto the release session's commits is pending, D-07); it could not run.
- Dash check: none of the four files holds an en dash or em dash.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The literal hyphen split refused a legitimate question**
- **Found during:** Task 1, the replay matrix (extended_blocked 9 of 535) and test-386-audit-probe-gate PG33
- **Issue:** splitting on every hyphen turned `C:extended:C81` ("... into a room-scoped SKILL.md", 12 words) into 13 words, an edge; the name rule then answered sprouts_required. The plan's own gate says extended_blocked must not rise above 8.
- **Fix:** a token with one dash stays one word; a token with 2 or more dashes splits at every dash; underscore and format characters always split. A 40-term hyphen chain still counts 40 words. Residual: "w1-w2" pairs count as one word each, bounded by the 240 character cap (the same budget a normal 12-word sprout has).
- **Files modified:** lib/core/part8-sprout-shape.cjs
- **Commit:** 22cc1d5e3

**2. [Rule 1 - Bug] The plan's adversarial fragments do not reproduce the hole**
- **Found during:** Task 2 RED
- **Issue:** repeats of "aaaa at " and "dot " ran in 1 to 10 ms on this machine (both the pattern alone and the whole ALWAYS plus PROSE set). The super-linear case is a run of local-part characters with dots (an obfuscated local part that never reaches its at marker): 16.4 s for the pattern alone.
- **Fix:** the RED fixture is that run, ending with the plan's fragments; the measured RED time is 8.102 s.
- **Files modified:** tests/test-392-email-regex-linear.cjs
- **Commit:** d6690591b

### Deferred to plan 392-05 (the guard is 392-03's file this wave)

- The guard still answers a cap case as `sprouts_required` with token class `body_shape` (SR_REASONS). The shape result now carries `reason: word_too_long | string_too_long`; the typed guard outcome should surface it (a token class `word_too_long` or `string_too_long` in lib/core/part8-egress-guard.cjs `_theoShapedVerdict`, step 6). Recorded here, not edited.
- The 4-whitespace gap in the plain-word email form (see the limit above).

## TDD Gate Compliance

Task 1: RED 838d80ce6 (test), GREEN 22cc1d5e3 (feat). Task 2: RED d6690591b (test), GREEN 8e7f5c50a (feat). No refactor commit.

## Known Stubs

None.

## Threat Flags

None. No new network endpoint, auth path, file access pattern or schema. T-392-10 mitigated (caps and word rule), T-392-11 mitigated (linear scan, timing on 40,000 and 400,000 characters, hook wall time asserted).

## Self-Check: PASSED

Files: lib/core/part8-sprout-shape.cjs, lib/core/cross-room-aggregator.cjs, tests/test-392-bypass-4-glued-paragraph.cjs, tests/test-392-email-regex-linear.cjs exist. Commits 838d80ce6, 22cc1d5e3, d6690591b, 8e7f5c50a exist in `git log`. No dash character in this file.

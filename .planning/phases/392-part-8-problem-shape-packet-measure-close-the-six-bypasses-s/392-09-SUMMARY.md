---
phase: 392-part-8-problem-shape-packet-measure-close-the-six-bypasses-s
plan: 09
subsystem: part8-egress-guard
tags: [part8, typed-shape-arm, shape-packet, closed-enum, over-blocking, wave5, p3, d-07]
requires: ["392-06", "392-08", "392-01"]
provides:
  - "part8-egress-guard.cjs classify step 1d: the typed shape arm for brain_ask {question, shape}, brain_search {query, shape, topK?} and classify_problem_type {statement, shape}; validateShapePacket by exact enum membership first (lazy require), block shape_invalid with the field, never a repair; any other key blocks unexpected_key; the free-text key under a 240 character cap (question_too_long) then theoVerdict; shape_validated true on every verdict after validation"
  - "part8-egress-guard.cjs: the non-Latin script rule is skipped under the typed arm only (opts.typedArm); the bare path keeps the 392-03 block"
  - "tests/test-392-typed-shape-arm.cjs (A0 to A14, 18 checks) including the Phase 389 Seed form through the shipped brain-client and the capture server"
  - "tests/fixtures/392-part8-replay/matrix-after-arm.json: extended_blocked 8 of 535, must_refuse_blocked 10 of 10, guard e3c1afedf"
  - "tests/fixtures/392-part8-replay/README.md: the Three matrices section; tests/test-392-replay-harness.cjs RH7 hygiene on every matrix file"
  - "cross-room-aggregator.cjs _P_EMAIL_OBFUSCATED: whitespace runs bounded to 8 (carried item), still linear"
affects: [392-11, 392-12, 392-13, 392-15]
tech-stack:
  added: []
  patterns: ["validate the closed shape first, then exact keys, then the free text: the validated subtree never enters the free-text walk", "lazy require behind a payload-shape test so the hook's fresh-process module count stays flat (LZ5)", "RED proof on the current tree before GREEN; the committed matrix is recorded against the GREEN guard sha and a live replay must agree with it"]
key-files:
  created:
    - tests/test-392-typed-shape-arm.cjs
    - tests/fixtures/392-part8-replay/matrix-after-arm.json
  modified:
    - lib/core/part8-egress-guard.cjs
    - tests/fixtures/392-part8-replay/README.md
    - tests/test-392-replay-harness.cjs
    - lib/core/cross-room-aggregator.cjs
    - tests/test-392-email-regex-linear.cjs
decisions:
  - "Key names: each tool keeps its own free-text key (question, query, statement) beside shape; renaming a wire key is Theo's contract (the plan's reading, recorded for the owner to overrule in Theo Phase 48)."
  - "Declared non-text parameters are allowed keys beside the pair (D-07 constraint from the release session): brain_search topK as an integer 1..50; a key with the value undefined is absent (brain-client sends namespace: undefined); a string namespace blocks as free text outside the free-text key."
  - "Non-Latin script: under the typed arm a non-Latin question is not blocked for its script; it takes the lexicon, sprout, credential and body rules and the 240 cap. The bare (unshaped) path keeps the 392-03 block, so no U arm of test-392-bypass-1-unicode-tokens.cjs needed a change."
  - "The shape arm sits at classify step 1d, after the step 1 default-deny scan (the T-245-11 invariant: the scan runs first on every call) and after 1c (brain_write), before step 2 (the free-form walk). 'Before any other rule' is read as 'before any free-text rule'."
  - "The email gap bound is 8 for both the plain-word and the marker form (both runs stay bounded, so the scan stays linear); shape_reason stays a separate field as 392-05 landed it."
  - "validateSprouts lives in lib/core/part8-split-route.cjs (untouched by this plan); the plan's Task 1 verify command named the guard module, which never exported it. The release caller (pyramid-seed-cells.cjs) requires it from part8-split-route."
metrics:
  duration: "about 22 min of execution (2026-11-09 20:30Z to 20:52Z); the D-07 notice was sent earlier the same day by the main session"
  tasks: 3
  files: 7
  completed: 2026-11-09
---

# Phase 392 Plan 09: The typed shape arm (P3) Summary

brain_ask, brain_search and classify_problem_type now accept their free-text key plus an optional closed-vocabulary `shape`: the shape is checked by exact enum membership through validateShapePacket before any free-text rule (a bad shape is a typed `shape_invalid` block with the field, never a repair), every other key blocks, the free-text key is decided by theoVerdict under a 240 character cap with the sprout, edge and body belt still on it, and brain_write stays blocked. The after-arm matrix is 8 of 535 extended questions refused (the beta.81 baseline is 8, the audit's 37 is beaten) and 10 of 10 must_refuse cases refused; no rule was loosened.

## Task 1: the D-07 notice (checkpoint, done by the main session)

The main session sent the D-07 notice to the plugin release session jsagi-17 on 2026-11-09, before any edit to lib/core/part8-egress-guard.cjs in this plan, and asked two questions (tests/test-389-seed-egress.cjs and the rebase target). jsagi-17 answered with one constraint, applied in Task 2 and recorded below: the brain_search arm must keep passing the Phase 389 Seed's current argument form.

`validateSprouts` check: the plan's verify command reads it from the guard (`require('./lib/core/part8-egress-guard.cjs').validateSprouts`), which has never exported it (the same command fails on beta.81). The function lives in lib/core/part8-split-route.cjs (:226, exported :422), and the release checkout's caller lib/core/pyramid-seed-cells.cjs:86 requires it from there (`split.validateSprouts(texts, {classify, roomDir})`). PROVEN on the final tree: `typeof require('./lib/core/part8-split-route.cjs').validateSprouts === 'function'`; `git diff 93868e7e0..HEAD -- lib/core/part8-split-route.cjs` is empty (untouched by this plan).

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | D-07 notice to jsagi-17 (checkpoint, main session) | none | none |
| 2 RED | failing test for the typed shape arm | 717c50903 | tests/test-392-typed-shape-arm.cjs |
| 2 GREEN | the arm in the guard; Seed arms A13 and A14 added to the test | e3c1afedf | lib/core/part8-egress-guard.cjs, tests/test-392-typed-shape-arm.cjs |
| 2 matrix | the after-arm matrix recorded against e3c1afedf | 9ebce24e0 | tests/fixtures/392-part8-replay/matrix-after-arm.json |
| 3 | fixture README (Three matrices) and RH7 | a06546267 | tests/fixtures/392-part8-replay/README.md, tests/test-392-replay-harness.cjs |
| carried RED | failing E3 positives for a 4 to 8 whitespace gap | 05ac00c08 | tests/test-392-email-regex-linear.cjs |
| carried GREEN | email gap bound 8 | 332b5ee4c | lib/core/cross-room-aggregator.cjs |

Every file touched by this plan: lib/core/part8-egress-guard.cjs, tests/test-392-typed-shape-arm.cjs, tests/fixtures/392-part8-replay/matrix-after-arm.json, tests/fixtures/392-part8-replay/README.md (the plan's four), tests/test-392-replay-harness.cjs (the plan's Task 3 action: "extend the loop if it loads only the baseline"), lib/core/cross-room-aggregator.cjs and tests/test-392-email-regex-linear.cjs (the carried email item), and this SUMMARY. STATE.md, ROADMAP.md, REQUIREMENTS.md and 392-WAVES.md were not edited (the orchestrator owns them on this branch; the foreign uncommitted ROADMAP.md and STATE.md edits were never staged).

## RED failure lines

Task 2, `node tests/test-392-typed-shape-arm.cjs` on the tree at 93868e7e0 (exit 1, 3 passed, 10 failed; A0, A5, A7 passed):

```
FAIL - A1 brain_ask {question, shape} allows and carries shape_validated true
  shape_validated missing: {"verdict":"allow","class":"generic_question","token_class":null,"reason":"plain methodology question with no room-local token"}
FAIL - A2 shape.problem_type wicked (wrong case) blocks shape_invalid with the field
  bad shape not blocked: {"verdict":"allow","class":"generic_question", ...}
FAIL - A3 ... a short sibling leaf beside a shaped question was allowed: {"verdict":"allow","class":"generic_question", ...}
FAIL - A4 ... reason the string is a body of text; split it into claims and send only sprouts  (expected question_too_long)
FAIL - A6 brain_search {query, shape} and classify_problem_type {statement, shape} allow   (shape_validated undefined)
FAIL - A8 ... bad shape beside a body: {"verdict":"block","class":"sprouts_required","token_class":"body_shape", ...}  (expected shape_invalid)
FAIL - A9 ... shape_validated undefined
FAIL - A10 ... shaped Hebrew question blocked: {"verdict":"block","class":"room_content","token_class":"identifier","reason":"the string carries a token outside the Latin methodology vocabulary; ..."}
FAIL - A11 ... clean Hebrew question blocked under the bound room: (the same verdict)
FAIL - A12 ... missing tests/fixtures/392-part8-replay/matrix-after-arm.json
```

The RED class for the plan's anchor payload (A1): `allow / generic_question` with no `shape_validated`. The shape's members (WellDefined, Phase3, investor, finance, regulatory, capital) passed the 392-05 walker as plain generic strings, so a wrong-case member (`wicked`) was also allowed: the walker has no enum, which is what the arm adds. The RED was not the "key is unexpected" branch the plan named as the alternative.

Carried item, `node tests/test-392-email-regex-linear.cjs` after the three E3 positives were added and before the regex change (exit 1): `FAIL - E3: positive wide_gap_words missed; positive wide_gap_marker missed; positive tab_gap_words missed`.

## What changed in the guard (lib/core/part8-egress-guard.cjs)

- After `_proveTypedReadShape`: a section comment (why, key names, declared non-text parameters, non-Latin script, lazy load), `SHAPED_ARM_TOOLS` (brain_ask: question; brain_search: query, params topK 1..50; classify_problem_type: statement), `SHAPED_QUESTION_CAP = 240`, `SAFE_KEY_PATH`, `_loadShapePacket` (lazy require of ./brain-shape-packet.cjs; null on failure), `_shapedArmRow`, `_hasShapeKey`, `_shapedArmVerdict`.
- `_shapedArmVerdict(payload, row, opts)`: (1) validator unavailable -> block `guard_unavailable`; `validateShapePacket(payload.shape)` not ok -> block `shape_invalid`, `field` (the validator's field when it is a safe short key, else `shape`), `members` as a count; (2) any key other than the free-text key, `shape` and the declared parameters -> block `content_set`, reason `unexpected_key`, `leaf_path`; a key whose value is undefined is absent; a declared parameter out of its integer range -> reason `param_out_of_range`; (3) free-text key missing or empty -> block `unknown`; longer than 240 -> block `content_set`, reason `question_too_long`, `cap` 240; (4) `theoVerdict(str, {toolName, roomDir, lexicon, typedArm: true})` on the string alone. Every verdict after step 1 carries `shape_validated: true`. No field carries the text, a shape member or a byte of either.
- `classify` step 1d (new): after step 1 (the default-deny scan ran on the shape and every other key with the free-text key blanked, so a credential hidden in a shape member is still `content_set`) and after 1c (brain_write), before step 2. `_shapedFreeformEntry` returns the arm's free-text key for a shaped payload, so the string is scanned inside theoVerdict by shape (the same as a bare brain_ask question) and step 1 scans the rest.
- `_theoShapedVerdict` step 4 and `_theoStringVerdict` step 4: `opts.typedArm !== true && _hasNonLatinLetter(str)`. The bare path is byte-unchanged in behaviour.
- The classify docblock (step 1d) and the theoVerdict order comment (step 4, the shaped-payload note) name the arm and this plan. Exports added: `_shapedArmVerdict`, `SHAPED_ARM_TOOLS`, `SHAPED_QUESTION_CAP`.

## Key-name reading (for the owner, Theo Phase 48)

392-CONTEXT names exact keys `{question, shape}`. brain_search carries `query` (shim scripts/mindrian-brain-mcp-client.cjs `z.strictObject({query, namespace?, topK?})`; brain-client.cjs search() sends `{query, namespace, topK}`) and classify_problem_type carries `statement` (TYPED_READ_TOOLS). Renaming a wire key is Theo's contract, not this repo's, so the arm uses each tool's existing free-text key plus `shape`; for brain_ask that is exactly `{question, shape}`. The owner can overrule this in Theo Phase 48.

## The D-07 constraint from jsagi-17 and the answer

Constraint (received during Task 2): the brain_search arm must keep passing the Phase 389 pyramid Seed's current form, through the shipped brain-client and the guard path, with `shape` optional; declared non-text parameters are allowed keys; "any other string leaf blocks" applies to undeclared keys and to free text outside the free-text key.

Read on the release checkout (read only): lib/core/pyramid-seed-cells.cjs:156 `brain.search(phrase, {topK: row.topK})` with topK 3, 3, 2 by cell; the phrases pass `split.validateSprouts` first (:86). brain-client.cjs search() (identical on this branch at :1139 and in the release checkout at :1094) sends `callTool('brain_search', {query, namespace: options.namespace || undefined, topK: options.topK || 5})`. tests/test-389-seed-egress.cjs (release checkout :186-189) asserts exactly 3 captured calls, every name brain_search, every `arguments.query` an approved phrase.

Answer for jsagi-17: **the Seed call shape needs no change.** PROVEN by tests/test-392-typed-shape-arm.cjs on this tree: A13a `classify({query, namespace: undefined, topK: 3})` allows with and without a shape (`namespace: undefined` is absent; JSON drops it on the wire); A13b `brain-client.search(phrase, {topK: 3})` reaches the capture server as one brain_search call with arguments exactly `{query, topK}`; A13c the same form plus a shape passes the callTool belt and reaches the capture server with arguments unchanged; A14a/b an extra free-text sibling key beside a shape blocks (`unexpected_key`, leaf_path `notes`, no text) and the belt sends nothing. Also: topK 51 blocks `param_out_of_range`; a string `namespace` beside a shape blocks (leaf_path `namespace`) because namespace is text outside the free-text key. The Seed never sends a namespace. After the rebase, tests/test-389-seed-egress.cjs must be run (D-07); it is absent on this branch.

## Carried items (decisions applied)

| Item | Decision | Before | After | Where |
|------|----------|--------|-------|-------|
| Non-Latin letters (392-03 deviation 1) | Under the typed arm a non-Latin question is not blocked for its script; it fails the typed-question proof and takes the lexicon (Unicode-aware tokenizer, part8-room-lexicon.cjs:72), the sprout rule, the credential and body patterns and the 240 cap. The bare path keeps the block (fail closed where there is no shape). | Shaped and bare Hebrew question both `block room_content/identifier` (RED A10, A11) | Shaped Hebrew methodology question with no room word: `allow generic_question`, shape_validated true (A10), also under a bound synthetic room (A11); shaped Hebrew sentence carrying the room's venture name (invented "Brightmoor Kiln"), bound: `block room_content` with no text in the verdict (A11); bare Hebrew question: still `block` (A10, and U1 to U3 of test-392-bypass-1-unicode-tokens.cjs unchanged and green) | e3c1afedf |
| Email 4-plus whitespace gap (392-04, 392-05) | Bounded run `\s{1,8}` in the plain-word form and `\s{0,8}` in the marker form (both bounded, linear); the normaliser never collapses spaces, so the bound itself must reach | 40,000 characters 3 ms; a 6-space plain-word address and a 5-space marker address missed | E1 40,000 characters 2 ms (budget 1,000 ms); E2 400,000 characters 9 ms, limit 400 ms (linear); E3 11 positives hit (wide_gap_words, wide_gap_marker, tab_gap_words new), 7 negatives miss; E5 hook wall time 95 ms on the 40,000 character payload | 05ac00c08, 332b5ee4c |
| shape_reason (392-05) | Stays a separate field on the sprouts_required verdict, as 392-05 landed it; no change | field | field | none |

The test-392-bypass-1-unicode-tokens.cjs U arms pin the BARE path (`{question: <Hebrew>}` with no shape), which this plan keeps; no U arm needed an adjustment. The shaped Hebrew coverage is A10 and A11 of the new test.

## The after-arm matrix (tests/fixtures/392-part8-replay/matrix-after-arm.json)

`node tests/helpers/part8-overblock-replay.cjs --record tests/fixtures/392-part8-replay/matrix-after-arm.json --real-calls $HOME/.mindrian/part8-replay/real-calls.jsonl --guard-head e3c1afedf`, 820 rows (694 fixture, 126 local real-call), recorded_head e3c1afedf, network_calls 0. Both baselines untouched (`git log` shows no change to baseline-beta81.json or tests/fixtures/386-audit-probes/baseline-before.json).

| Number | audit f0df97036 | beta.81 baseline 8455416a5 | after the arm e3c1afedf |
|--------|-----------------|----------------------------|-------------------------|
| extended_blocked (of 535) | 37 | 8 | 8 (not above the baseline; the plan's "below 37" met) |
| must_refuse_blocked (of 10) | 10 | 10 | 10 |
| by_verdict total 820 (allow, ambiguous, block) | n/a | 730, 2, 88 | 730, 2, 88 |
| set P / ADV / C / R | n/a | 5,0,10 / 4,0,19 / 606,0,50 / 115,2,9 | equal (by_group byte-equal) |
| by_class (block) | | write_blocked 2, content_set 20, room_content 14, sprouts_required 52 | equal |
| by_class (allow) | | generic_question 670, typed_question 49, empty_payload 10, typed_read_shape 1 | generic_question 671, typed_question 48, empty_payload 10, typed_read_shape 1 |
| by_token_class (block) | | edge_rule 29, private_marker 17, none 22, body_shape 6, room_term 4, claim 3, identifier 2, private_context 1, person 1, venture_name 1, room_file 1, name 1 | equal |
| by_tool | | brain_ask 668 / 2 / 83; brain_query 43 / 0 / 2; brain_search 8 / 0 / 0; brain_write 0 / 0 / 3; brain_schema 6; brain_stats 4; normalize_framework_name 1 | equal, tool by tool |

The one by_class move (a set R real-call row, typed_question to generic_question, both allow) predates this plan: 392-06 recorded the same split and attributed it to the 392-03 tokenizer. Every replay case is a bare question with no `shape` key, so the arm is not exercised by the corpus and changes no row; the live replay inside A12 (527 allow, 8 block; 10 of 10) agrees with the committed file on the final tree, after the email widening too, so the wider gap bound also moved no row. No rule was loosened to reach a number.

## Verification (final tree 332b5ee4c, PROVEN unless marked)

- `node tests/test-392-typed-shape-arm.cjs`: 18 passed, 0 failed (A0 to A14).
- `bash tests/run-all-392.sh`: discovered 15, PASS=15 FAIL=0 SKIP=0.
- `bash tests/run-all-386.sh`: PASS=37 FAIL=0 SKIP=0; LZ5 line: guard 172 to 11; hook 175 to 174; statusline 182 to 18 (the lazy shape-packet require adds nothing to the hook's fresh-process count).
- `node tests/test-369-hook-require-graph.cjs`: 5 passed, 0 failed.
- `node tests/test-387-eureka-egress.cjs`: 22 passed, 0 failed.
- `node tests/test-260906-gr1-brain-shaped-tool-gate.cjs`: pass 13, fail 0.
- `node tests/test-386-b2-brain-write-blocked.cjs`: all B2 arms passed. `node tests/test-386-typed-theo-allow-arms.cjs`: ALL PASS. `node tests/test-354-egress-typed-question.cjs`: 50 passed. `node tests/test-355-part8-egress.cjs`: PASS 34 FAIL 0. `node tests/test-3692-theo-verdict.cjs`: PASS 26 FAIL 0 (TOKEN_CLASSES still 9). `node tests/test-257-refusal-egress-kind.cjs`, `tests/test-339-theo-ask-compose.cjs`: exit 0. `node tests/test-386-identifier-forms.cjs`, `tests/test-386-web-credential-hook.cjs`: all arms passed.
- `node tests/test-392-replay-harness.cjs`: RH1 to RH7 ok (RH7: baseline-beta81.json and matrix-after-arm.json, both extended_blocked 8). `grep -c matrix-after-arm tests/fixtures/392-part8-replay/README.md`: 4.
- `node tests/test-392-email-regex-linear.cjs`: E1 2 ms, E2 9 ms (linear), E3 11 positives / 7 negatives, E4 ALWAYS 20 PROSE 9 FORBIDDEN 29 (rs-egress-prompts re-exports the same arrays), E5 95 ms.
- tests/test-389-seed-egress.cjs: ABSENT on this branch (rebase onto the release session's commits pending, D-07); not run. The Seed's call form was proven through A13 instead (above).
- `node scripts/doctor.cjs --acceptance`: NOT RUN (UNVERIFIED). Its `version-of-record-published` point runs `npm view` (one registry read); this plan ran under a no-network rule. 392-06 recorded 24 of 25 with the one FAIL being the foreign uncommitted ROADMAP.md and STATE.md edits, which are still present and untouched.
- Dash check (em dash, en dash) on the seven code, test and fixture files: 0. The verdicts and the matrix carry no text: A3, A5, A11, A14 assert `noText`; assertMatrixHygiene and assertDocumentHygiene ran before the write and in RH7 and A12.
- `git status --short` after the last commit: only the foreign ` M .planning/ROADMAP.md`, ` M .planning/STATE.md` and the untracked `.planning/debug/379-1-1-10-large-room-drain-clock-breach.md` (never staged, never reverted); no litter from the test runs. Post-commit deletion check on every commit: no deletions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Declared non-text parameters beside the shape (D-07 constraint)**
- **Found during:** Task 2 GREEN (the release session's constraint arrived through the orchestrator)
- **Issue:** the plan's literal "exact keys = free-text key plus shape" would have blocked the Phase 389 Seed's `{query, namespace: undefined, topK}` once brain-client attaches the shape (392-12), breaking tests/test-389-seed-egress.cjs after the rebase.
- **Fix:** `SHAPED_ARM_TOOLS[tool].params` (brain_search topK 1..50, the shim's bound); a key with the value undefined is absent; a declared parameter out of range blocks `param_out_of_range`; a string namespace still blocks. Arms A13 and A14 pin it, with the capture server.
- **Files modified:** lib/core/part8-egress-guard.cjs, tests/test-392-typed-shape-arm.cjs
- **Commit:** e3c1afedf

**2. [Rule 1 - Plan text] The Task 1 verify command reads validateSprouts from the wrong module**
- **Found during:** Task 1 recording
- **Issue:** `require('./lib/core/part8-egress-guard.cjs').validateSprouts` is undefined on beta.81 and on this tree; the function is exported by lib/core/part8-split-route.cjs and that is what the release caller requires.
- **Fix:** no code change (a re-export would add surface no caller needs); the correct check was run and recorded above.
- **Files modified:** none

**3. [Scope, plan-directed] tests/test-392-replay-harness.cjs edited (not in files_modified)**
- The plan's Task 3 action says "extend the loop if it loads only the baseline, and say so in the SUMMARY". RH6 loaded only baseline-beta81.json; RH7 was added to load every refusal matrix in the folder. Commit a06546267.

**4. [Ordering] Three commits for the TDD task instead of two**
- The matrix must carry `guard_head` of the guard that produced it, so the GREEN guard was committed first (e3c1afedf), the matrix recorded against that sha and committed next (9ebce24e0). Between those two commits the test's A12 arm failed on the missing file by design; every other arm was green at e3c1afedf. The RED gate (717c50903) precedes both.

**5. [Reading] "Refused before any other rule runs"**
- The arm sits after the step 1 default-deny scan, which the guard's T-245-11 invariant keeps first on every call. A credential hidden in a shape member therefore reports `content_set` (step 1), not `shape_invalid`; every other bad shape reports `shape_invalid` before any free-text rule (A8: a bad shape beside a body paragraph answers `shape_invalid`, not `sprouts_required`).

## TDD Gate Compliance

Task 2: RED 717c50903 (test), GREEN e3c1afedf (feat), matrix 9ebce24e0 (test). Carried email item: RED 05ac00c08 (test), GREEN 332b5ee4c (fix). Task 3 is a docs and test-hygiene task (a06546267). No refactor commit.

## Known Stubs

None. The arm is wired end to end for a payload that carries a shape; brain-client does not attach a shape yet (plan 392-12), so today only a caller that passes `shape` itself (the belt test A13c does) exercises the arm on the wire.

## Threat Flags

None new. T-392-24 mitigated (exact membership before the walk; a refused shape never reaches it; the validated subtree is excluded by construction because only the free-text string is passed to theoVerdict). T-392-25 mitigated (A3, A14: a sibling key blocks typed, no text). T-392-26 mitigated (the matrix equals the baseline; no rule loosened; the numbers and their files are in the README). T-392-27 mitigated (notice sent before the change; validateSprouts untouched in part8-split-route.cjs; the Seed form proven to pass). The relaxation of the non-Latin rule under the arm is a deliberate narrowing of a 392-03 fail-closed block: it applies only when a validated shape is present, and the Unicode-aware lexicon, the sprout rule, the credential patterns and the 240 cap still run (A10, A11).

## Self-Check: PASSED

Files exist: lib/core/part8-egress-guard.cjs, tests/test-392-typed-shape-arm.cjs, tests/fixtures/392-part8-replay/matrix-after-arm.json, tests/fixtures/392-part8-replay/README.md, tests/test-392-replay-harness.cjs, lib/core/cross-room-aggregator.cjs, tests/test-392-email-regex-linear.cjs. Commits 717c50903, e3c1afedf, 9ebce24e0, a06546267, 05ac00c08, 332b5ee4c exist on work/part8-shape-packet. This SUMMARY is under `.planning/*` (force-tracked), added with `git add -f`.

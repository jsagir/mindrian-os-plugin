---
phase: 396-part-8-problem-shape-packet-measure-close-the-six-bypasses-s
plan: 05
subsystem: part8-egress-guard
tags: [part8, bypass-2, bypass-3, bypass-6, string-leaf-walker, fail-closed, wave3]
requires: ["392-03", "392-04"]
provides:
  - "part8-egress-guard.cjs _collectStringLeaves(payload): every string leaf with its key path, bounded (depth 8, 2,000 nodes, seen set), typed over_budget past a cap"
  - "part8-egress-guard.cjs theoVerdict: the primary FREEFORM_KEYS key keeps its rules; every other leaf (sibling key, array item, nested value, brain_query params value) is decided by the same content rules; strictest verdict wins; a sibling block carries leaf_path"
  - "part8-egress-guard.cjs: an over-budget payload blocks content_set with the reason over_budget before any leaf is read"
  - "part8-split-route.cjs carriesEdgeOrBody: {over_budget: true, reason: depth | nodes} past the caps instead of false; OVER_BUDGET, OVER_BUDGET_REASON, WALK_MAX_DEPTH, WALK_MAX_NODES exported"
  - "brain-client.cjs: _edgeOrBodyOutcome, _carriesEdgeOrBody (boolean, exported test seam), _overBudgetVerdict; the belt refuses an over-budget payload with sprouts_required, token_class over_budget; _egressRefusalReason names it"
  - "part8-egress-guard.cjs and brain-client.cjs: shape_reason (word_too_long | string_too_long) on a cap-made body (carried from 392-04)"
affects: [392-09, 392-11]
tech-stack:
  added: []
  patterns: ["one bounded walker over every string leaf, strictest verdict wins", "typed over-budget outcome that every consumer treats as carries (fail closed)", "RED proof on the current tree before GREEN", "lazy normaliser with an ASCII fast path (386-35 pattern) in the split route"]
key-files:
  created:
    - tests/test-396-bypass-2-sibling-key.cjs
    - tests/test-396-bypass-3-query-params.cjs
    - tests/test-396-bypass-6-depth-fails-closed.cjs
  modified:
    - lib/core/part8-egress-guard.cjs
    - lib/core/part8-split-route.cjs
    - lib/core/brain-client.cjs
decisions:
  - "A non-primary leaf is decided as a bare string by _theoStringVerdict (the body of the old theoVerdict), so a sibling gets the credential shapes, the lexicon, the non-Latin and identifier rules, the sprout shape and the typed proof; the primary key path is byte-unchanged."
  - "The guard's over-budget refusal is content_set with reason over_budget (the payload was not read, so it is treated as content); the split-route path answers sprouts_required with token_class over_budget; both send nothing."
  - "The sprout cap reason travels in a separate field shape_reason, not as a tenth TOKEN_CLASSES entry (pinned at 9 by tests/test-3692-theo-verdict.cjs) and not as a fifth sprouts_required token class."
  - "The belt test for bypass 6 uses brain_stats (the ambiguous path): after task 1 a brain_ask deep payload is refused by the walker before the belt reaches the shape test."
metrics:
  duration: "16 min (2026-11-08 18:06Z to 18:22Z, commit clock)"
  tasks: 2
  files: 6
  completed: 2026-11-08
---

# Phase 392 Plan 05: Bypasses 2, 3 and 6 (every string leaf, fail-closed caps) Summary

One bounded walker (`_collectStringLeaves`) now decides every string leaf of a free-form Brain payload, so a room paragraph under a sibling key (`context`), an array item, a nested value or a `brain_query.params` value is refused by the same rules as the question, with the key path named and never the text; past depth 8 or 2,000 nodes both the guard and `carriesEdgeOrBody` refuse the payload unread instead of letting it through. Replay after the change: extended_blocked 8 of 535 (baseline 8), must_refuse 10 of 10.

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 RED | failing tests for bypasses 2 and 3 | 17b2057bc | tests/test-396-bypass-2-sibling-key.cjs, tests/test-396-bypass-3-query-params.cjs |
| 1 GREEN | string-leaf walker, strictest verdict wins, over_budget refusal, shape_reason | 86f78288a | lib/core/part8-egress-guard.cjs |
| 2 RED | failing test for bypass 6 | 7fd31b71c | tests/test-396-bypass-6-depth-fails-closed.cjs |
| 2 GREEN | typed over-budget outcome in both modules, nothing sent | b7b592bfe | lib/core/part8-split-route.cjs, lib/core/brain-client.cjs |

## RED failure lines (on the tree at e22f01f14, before any guard change)

Task 1, `node tests/test-396-bypass-2-sibling-key.cjs` (exit 1, 3 passed, 5 failed):

```
FAIL - S1 a sibling key (context) beside a generic question is scanned and blocks
  sibling key not scanned: {"verdict":"allow","class":"generic_question","token_class":null,"reason":"plain methodology question with no room-local token"}
FAIL - S2 an array leaf (notes[0]) beside a generic question is scanned and blocks
  array leaf not scanned: {"verdict":"allow","class":"generic_question", ...}
FAIL - S3 a nested leaf (meta.deep.text) beside a generic question is scanned and blocks
  nested leaf not scanned: {"verdict":"allow","class":"generic_question", ...}
FAIL - S5 a sibling block names the key path and never the text
  leaf_path for the sibling: {"verdict":"allow", ...}  (undefined !== 'context')
FAIL - S6 _collectStringLeaves: ...  _collectStringLeaves is not exported
```

Task 1, `node tests/test-396-bypass-3-query-params.cjs` (exit 1, 3 passed, 4 failed):

```
FAIL - P1 a params value that is a room paragraph blocks
  params value not scanned: {"verdict":"allow","class":"generic_question", ...}
FAIL - P2 a params value that is a room word blocks room_content
  params value not scanned: {"verdict":"allow","class":"generic_question", ...}
FAIL - P5 the params block names leaf_path params.name and never the text  (undefined !== 'params.name')
FAIL - P6 brain-client.query with a body under params sends nothing
  the wire received 1 call(s): ["brain_query"]
```

Reason, PROVEN by a probe before the tests were written: `_extractFreeFormString` returns the first FREEFORM_KEYS string only; the paragraph alone under `question` blocked `room_content/venture_name` in the same synthetic room, and beside a generic question it passed. Step 1 (the default-deny scan) saw the sibling but a paragraph with no forbidden pattern clears it. A first probe paragraph that named "Acme Robotics" was blocked by step 1's company-suffix pattern and did not reproduce the hole; the fixture paragraph names only the synthetic room's venture.

Task 2, `node tests/test-396-bypass-6-depth-fails-closed.cjs` after task 1 GREEN and before the split-route change (exit 1, 1 passed, 5 failed):

```
FAIL - D1 carriesEdgeOrBody on a body 10 levels deep is a refusing outcome
  deep body not seen: carriesEdgeOrBody returned false
FAIL - D2 carriesEdgeOrBody on a body after 2,100 short leaves is a refusing outcome
  wide body not seen: carriesEdgeOrBody returned false
FAIL - D3 the two outcomes are typed over_budget with the cap that tripped
  deep outcome not typed: false
FAIL - D5 brain-client._carriesEdgeOrBody is true for both payloads
  _carriesEdgeOrBody is not exported as a test seam
FAIL - D6 the belt sends nothing for the two payloads; outcome sprouts_required, reason over_budget
  deep: the wire received 1 call(s)
```

The same probe on e22f01f14 (before task 1) printed `B6 deep false`, `B6 wide false`. D4 (the normal path, including a zero-width-space-joined body) passed before the change: `classifyShape` already ends a word at a format character (plan 392-04), so the normaliser call added by this plan is a second line, not the first.

## What changed

### lib/core/part8-egress-guard.cjs (anchors after this plan)

- `:110` FREEFORM_KEYS unchanged; `:255` `_extractFreeFormString` unchanged; `_primaryFreeFormKey` beside it (the key name in the same order).
- `:296` `_collectStringLeaves(payload)` -> `[{path, value}]` or `{over_budget: true, reason: 'depth' | 'nodes'}`. Caps `LEAF_WALK_MAX_DEPTH = 8` (top-level values at depth 1, the same count as the split route) and `LEAF_WALK_MAX_NODES = 2000`, a seen set, never throws. Exported with the two caps.
- `:330` `_overBudgetBlock(reason)` -> `{verdict: 'block', class: 'content_set', token_class: null, reason: 'over_budget', over_budget: 'depth' | 'nodes'}`.
- `:1658` `theoVerdict`: a bare string goes to `_theoStringVerdict` as before. An object payload: walk; over budget blocks first; the primary key (FREEFORM_KEYS order) is decided byte-unchanged by `_theoStringVerdict(str, payload, opts)`; if it blocks, that verdict returns; else every other non-empty leaf is decided by `_theoStringVerdict(leaf, null, leafOpts)` (the room resolved once for the payload) and the first block returns with `leaf_path`; else the primary verdict returns. `classify` step 2 is unchanged and inherits the walk; the typed-tool table, the packet arm and the `sprouts_required` outcome of plan 386-27 are untouched; `validateSprouts` is untouched (D-07).
- `:1711` `_theoStringVerdict(str, payload, opts)`: the former body of `theoVerdict` from the shape test onward, unchanged in rules.
- `:1538` `_theoShapedVerdict` step 6: a body whose `shape.reason` is `word_too_long` or `string_too_long` carries `shape_reason` beside `token_class: 'body_shape'` (carried item 1).

### lib/core/part8-split-route.cjs

- `:76-80` `WALK_MAX_DEPTH = 8`, `WALK_MAX_NODES = 2000`, `OVER_BUDGET = 'over_budget'`, `OVER_BUDGET_REASON` (a constant sentence, no input byte).
- `:121` `carriesEdgeOrBody`: the walk sets `over` at the cap and stops; returns `true` when an edge or a body was seen before the cap, `{over_budget: true, reason}` when the cap tripped with nothing seen, `false` otherwise (byte-compatible normal path). Each string passes `_normalizeForShape` (lazy `require('./part8-normalize.cjs')` behind an ASCII fast path, the 386-35 pattern) before `classifyShape`. The docblock (plan's :77-87) records the fail-open history and the consumer contract. The top-level `cypher` key of brain_query is still not read.

### lib/core/brain-client.cjs

- `:531` the belt: `const edgeOrBody = _edgeOrBodyOutcome(toolName, args); if (edgeOrBody !== false) return _sproutsRequiredSentinel(toolName, _overBudgetVerdict(edgeOrBody));`.
- `:1043` `_edgeOrBodyOutcome` (raw outcome, a throw is `true`); `:1057` `_carriesEdgeOrBody` = `_edgeOrBodyOutcome(...) !== false` (boolean contract kept; exported as a test seam); `:1064` `_overBudgetVerdict` -> `{token_class: 'over_budget', reason: OVER_BUDGET_REASON, over_budget: 'depth' | 'nodes'}` or undefined for a plain edge or body (the sentinel then carries no token_class, as before).
- `:1016` `_sproutsRequiredSentinel` copies `shape_reason` and `over_budget` when they hold their closed values.
- `:993` `_egressRefusalReason`: a verdict with `reason === 'over_budget'` gets its own sentence (not "names something from this room").
- `scripts/part8-egress-guard-hook.cjs:195` already tests `!== false`, so the hook treats the typed object as carries without a change (the file is outside this plan).

## Carried items (from 392-03 and 392-04)

| Item | Status | Where |
|------|--------|-------|
| 1. Surface the sprout `reason` (`word_too_long` / `string_too_long`) in the typed guard outcome | DONE as a separate field `shape_reason` on the `sprouts_required` verdict (guard step 6) and on the brain-client sentinel. No tenth TOKEN_CLASSES entry: the pin at 9 (test-3692) stays; the four `sprouts_required` token classes (SR_REASONS) stay. Probe: an 81-character token under `question` answers `sprouts_required / body_shape / shape_reason word_too_long`. | 86f78288a, b7b592bfe |
| 2. The plain-word email form relies on the normaliser for format characters; does the walker change that? | NO CHANGE by the walker. `_normalizePayloadLeaves` (392-03) runs before the walk, so every leaf, sibling leaves included, is judged in NFKC form with every `\p{Cf}` stripped, and each leaf now gets the ALWAYS patterns (the email forms) through `_theoStringVerdict`. The residual is unchanged: a plain-word address with 4 or more ordinary whitespace characters between its tokens does not match `_P_EMAIL_OBFUSCATED` (`\s{1,3}`), because the normaliser strips format characters and does not collapse spaces. DEFERRED to 392-09: lib/core/cross-room-aggregator.cjs is outside this plan's files, and the decision (collapse whitespace runs before the scan, or widen the bound with a timing test) belongs with the typed arm. | none |

## Replay matrix (scratch, not committed)

`node tests/helpers/part8-overblock-replay.cjs --record <scratch>/matrix-392-05.json --force`, recorded_head 7fd31b71c (the working tree held the task 2 split-route and brain-client edits, which do not enter `classify`), network_calls 0, 694 fixture rows.

| Number | beta.81 baseline | after 392-05 |
|--------|------------------|--------------|
| extended_blocked | 8 of 535 | 8 of 535 |
| must_refuse_blocked | 10 of 10 | 10 of 10 |
| set P / ADV / C (allow, ambiguous, block) | 5,0,10 / 4,0,19 / 606,0,50 | 5,0,10 / 4,0,19 / 606,0,50 |
| fixture blocks by class | sprouts_required 44, content_set 20, room_content 13, write_blocked 2 (after 392-03) | sprouts_required 44, content_set 20, room_content 13, write_blocked 2 |

No fixture row changed: the corpus carries no sibling free-text key, no params value with room text and no payload past the caps, so the three new tests carry the coverage. The two tests that embed the replay (S7 here, U5 and U6 of 392-03) print extended allow 527 block 8 and must_refuse 10 of 10.

## Verification

- `node tests/test-396-bypass-2-sibling-key.cjs`: 8 passed (S0 to S7).
- `node tests/test-396-bypass-3-query-params.cjs`: 7 passed (P0 to P6; P6 on the capture server, 0 tools/call).
- `node tests/test-396-bypass-6-depth-fails-closed.cjs`: 6 passed (D1 to D6; D6 0 tools/call for the deep and the wide payload); `grep -c carriesEdgeOrBody` on the file: 26 (zero references under tests/ before, F6).
- `node tests/test-386-job-key-shortcut.cjs`: ALL PASS. `node tests/test-386-typed-theo-allow-arms.cjs`: ALL PASS. `node tests/test-386-sprout-split-route.cjs`: ALL PASS. `node tests/test-386-sprouts-required-outcome.cjs`: pass.
- `bash tests/run-all-386.sh`: PASS=37 FAIL=0 SKIP=0, after task 1 and again after task 2. LZ5 line: guard 172 to 11; hook 175 to 174; statusline 182 to 18 (no new eager require reached the hook; the split route's normaliser is lazy behind an ASCII fast path).
- `bash tests/run-all-396.sh`: PASS=12 FAIL=0 SKIP=0 (12 files discovered).
- `node tests/test-369-hook-require-graph.cjs`: 5 passed, 0 failed.
- `node tests/test-387-eureka-egress.cjs`: 22 passed, 0 failed.
- `node tests/test-355-part8-egress.cjs`: PASS 34 FAIL 0. `node tests/test-354-egress-typed-question.cjs`: 50 passed. `node tests/test-3692-theo-verdict.cjs`, `tests/test-257-refusal-egress-kind.cjs` (TOKEN_CLASSES pins), `tests/test-339-theo-ask-compose.cjs`, `tests/test-239-query-egress-canary.cjs`, `tests/test-245-brain-envelope-shape.cjs`: exit 0.
- tests/test-389-seed-egress.cjs is absent on this branch (rebase onto the release session's commits pending, D-07); not run.
- Dash check on the six files: 0 em dash, 0 en dash.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `_carriesEdgeOrBody` was not reachable from a test**
- **Found during:** Task 2 RED (D5)
- **Issue:** the plan asserts `brain-client._carriesEdgeOrBody` returns true for the two payloads, and the function was module-private.
- **Fix:** exported as a test seam (first entry of module.exports, with a comment naming this plan). Behaviour unchanged.
- **Files modified:** lib/core/brain-client.cjs
- **Commit:** b7b592bfe

**2. [Rule 2 - Missing critical functionality] The sentinel could not carry the reason over_budget through a boolean**
- **Found during:** Task 2 GREEN
- **Issue:** the plan keeps `_carriesEdgeOrBody` as `result !== false` (boolean) and also requires the refusal to carry the reason over_budget; a boolean cannot carry the cap that tripped.
- **Fix:** `_edgeOrBodyOutcome` returns the raw outcome; `_carriesEdgeOrBody` stays boolean on top of it; the belt reads the raw outcome and passes `_overBudgetVerdict` to the sentinel (`token_class: 'over_budget'`, the constant sentence, `over_budget: depth | nodes`).
- **Files modified:** lib/core/brain-client.cjs
- **Commit:** b7b592bfe

### Test-design notes (no behaviour deviation)

- D6 calls the belt with `brain_stats` (the ambiguous path, as tests/test-386-sprouts-required-outcome.cjs SP1 does), not `brain_ask`: after task 1 a `brain_ask` deep payload is refused by the walker (`content_set / over_budget`) before the belt reaches `carriesEdgeOrBody`, so a `brain_ask` arm would pass without the task 2 change.
- The bypass-2 and bypass-3 tests bind the synthetic `gate-lexgen` room of tests/helpers/synthetic-room-db.cjs through `makeRooms` (venture name "Brightmoor Kiln", invented) with HOME and MINDRIAN_ROOMS_HOME isolated, the replay helper's pattern.

## TDD Gate Compliance

Task 1: RED 17b2057bc (test), GREEN 86f78288a (feat). Task 2: RED 7fd31b71c (test), GREEN b7b592bfe (feat). No refactor commit.

## Known Stubs

None.

## Threat Flags

None. No new network endpoint, auth path, file access pattern or schema. T-392-12 mitigated (S1 to S5, P1 to P6: every leaf decided, leaf_path named, no text in a verdict); T-392-13 mitigated (D1 to D6: over_budget is a refusal in both modules, 0 tools/call); T-392-14 mitigated (depth 8, 2,000 nodes, seen set; the walk stops at the cap; the hook wall-time arm E5 of tests/test-396-email-regex-linear.cjs passed in the 392 runner).

## Self-Check: PASSED

Files: lib/core/part8-egress-guard.cjs, lib/core/part8-split-route.cjs, lib/core/brain-client.cjs, tests/test-396-bypass-2-sibling-key.cjs, tests/test-396-bypass-3-query-params.cjs, tests/test-396-bypass-6-depth-fails-closed.cjs exist. Commits 17b2057bc, 86f78288a, 7fd31b71c, b7b592bfe exist in `git log`.

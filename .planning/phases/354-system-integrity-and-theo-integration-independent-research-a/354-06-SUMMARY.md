---
phase: 354-system-integrity-and-theo-integration-independent-research-a
plan: 06
subsystem: brain-boundary
tags: [canon-part-8, egress, brain-boundary, tier-2, theo-03, d-354-egr]

# Dependency graph
requires:
  - phase: 354-02
    provides: "gate subject promotion (unrelated file surface, sequencing only)"
  - phase: 354-03
    provides: "chain resume identity (unrelated file surface, sequencing only)"
  - phase: 354-04
    provides: "write-lock ownership (unrelated file surface, sequencing only)"
provides:
  - "lib/core/part8-egress-guard.cjs: _proveTypedQuestion(str), the closed-vocabulary structural proof for a free-form brain_ask/brain_query/brain_search string -- QUESTION_FUNCTION_WORDS, METHODOLOGY_TOKEN_SET, COMMAND_SLUG_SET, CANONICAL_PHRASES, all exported test seams"
  - "classify() new classes: typed_question (allow), freeform_unproven (ambiguous)"
  - "lib/core/brain-client.cjs::_typedFreeformGate(toolName, text): the pre-wire enforcement point for ask(), search() and smartSearch()"
  - "lib/core/refusal-messaging.cjs::EGRESS_CLASS_SET gains typed_question, freeform_unproven, guard_unavailable"
  - "scripts/part8-egress-guard-hook.cjs::SHIM_BACKED_AMBIGUOUS_ALLOW_CLASSES gains freeform_unproven"
  - "tests/test-354-egress-typed-question.cjs: 46-check transport-captured regression (cases A-F)"
affects: [354-12, 354-18]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Structural closed-vocabulary proof over keyword-presence: a free-form question is 'generic' only when every token comes from a closed set (function words, methodology tokens, canonical framework-name phrases stripped whole-phrase-longest-first, command slugs, or a 1-2 digit number), never merely because one methodology word appears anywhere in the string"
    - "Pre-wire caller-side gate as a second, stricter enforcement point layered on top of callTool()'s existing disclose-and-proceed belt: _typedFreeformGate refuses ambiguous outright for the two natural-language channels (ask/search/smartSearch) while callTool's own belt keeps Phase 254 D-02 Option A (disclose-and-proceed) unchanged for every other wrapper"

key-files:
  created:
    - tests/test-354-egress-typed-question.cjs
  modified:
    - lib/core/part8-egress-guard.cjs
    - lib/core/brain-client.cjs
    - scripts/part8-egress-guard-hook.cjs
    - lib/core/refusal-messaging.cjs
    - tests/test-223-part8-egress.cjs (verified unaffected, not edited)
    - tests/test-245-egress-contentless.cjs
    - tests/test-339-theo-ask-compose.cjs
    - tests/part8-egress-e2e-smoke.test.cjs (verified unaffected, not edited)
    - tests/part8-egress-guard-hook.test.cjs (verified unaffected, not edited)
    - tests/test-260906-fda-known-tool-shapes.cjs
    - tests/test-239-query-egress-canary.cjs
    - tests/test-257-brain-tool-egress-invariant.cjs

key-decisions:
  - "Added 'i' and 'analysis' to QUESTION_FUNCTION_WORDS beyond the plan's literal enumeration -- two pre-existing, unowned regression fixtures (test-239-query-egress-canary.cjs LEG 6, test-257-brain-tool-egress-invariant.cjs Arm 5) needed them; re-verified the PRIVATE and 'lean startup methodology' block/ambiguous fixtures are unaffected"
  - "_typedFreeformGate refuses an ambiguous verdict outright for ask()/search()/smartSearch(), diverging from callTool's own Phase 254 D-02 disclose-and-proceed policy for those two channels specifically -- exactly as the plan's own objective states the impact ('refused... instead of being forwarded with a disclosure')"
  - "Did not run requirements mark-complete THEO-03 -- REQUIREMENTS.md's THEO-03 row names both Plan 354-06 and Plan 354-12 as owning plans; this plan closes only the free-form-channel closed-vocabulary half, not the full teaching-to-action-loop proof 354-12 owns"

requirements-completed: []

# Metrics
duration: ~55min
completed: 2026-09-23
---

# Phase 354 Plan 06: Egress Typed-Question Closed-Vocabulary Proof Summary

**Closed the P1 free-form Brain egress gap (THEO-03, D-354-EGR): "generic" now means every token of a brain_ask/brain_search question is structurally proven closed-vocabulary, not merely that one methodology keyword appears anywhere in an otherwise-arbitrary sentence -- a private sentence that happens to mention SWOT no longer opens any Brain wire, on any surface.**

## Performance

- **Duration:** approx. 55 min
- **Completed:** 2026-09-23
- **Tasks:** 3
- **Files modified:** 12 (1 created, 11 modified; 2 of the 11 were touched only to confirm they still pass, not edited)

## Accomplishments

- Wrote `tests/test-354-egress-typed-question.cjs` (RED-first, commit
  `c92488c95`): 46 checks across six cases (A-F) driven through the real
  `tests/helpers/brain-capture-server.cjs` transport capture and, for case F,
  a real `@modelcontextprotocol/sdk` `StdioClientTransport` spawn of
  `bin/mindrian-brain-mcp-client.cjs`. Case D's private corpus carries 10
  sentences (each one methodology word next to a unique proper-noun marker);
  case E's generic corpus carries 31 questions built only from canonical
  vocabulary, including every internal question template the plan named
  (`lib/mcp/brain-router.cjs`'s `brainRoute`, `lib/core/rs-chain-feeder.cjs`'s
  unexported `_buildUpstreamQuestion` reproduced verbatim, and
  `scripts/rs-explain-command.cjs`'s two FEEDS_INTO/methodology-chain
  templates) instantiated with real canonical inputs from
  `data/framework-names.json` and `data/command-registry.json`. Run against
  the pre-fix code (confirmed by temporarily overwriting the three source
  files with their pre-354-06 committed content, then restoring): 44 of 46
  checks failed, naming cases A and F exactly as the plan's acceptance
  criteria require.
- Added the closed-vocabulary proof to `lib/core/part8-egress-guard.cjs`
  (commit `8f87980e5`): `QUESTION_FUNCTION_WORDS` (a frozen Set of generic
  function/relation words), `METHODOLOGY_TOKEN_SET` (the `METHODOLOGY_VOCAB`
  regex alternatives lowercased, `problem[- ]type`/`edge[- ]type` split into
  both forms, plus the Theo rung ids), `COMMAND_SLUG_SET` (built from
  `data/command-registry.json`'s command list, `/mos:` prefix stripped),
  `CANONICAL_PHRASES` (from `data/framework-names.json`'s `framework_names`
  + `curated_extras`, lowercased, sorted longest-first). `_proveTypedQuestion(str)`
  lowercases the string, strips `/mos:` prefixes, replaces every canonical
  phrase occurrence with a space, tokenizes on `[^a-z0-9_-]+`, and requires
  every remaining token to be a function word, methodology token, command
  slug, or a bare 1-2 digit number -- true only then. `classify()` step 3 now
  allows (`class: 'typed_question'`) only via that proof; a methodology
  keyword present without proof is `ambiguous`/`freeform_unproven` (new); no
  vocabulary hit at all keeps the pre-existing `freeform_unmatched` ambiguous
  verdict byte-unchanged. Both data files load via `fs.readFileSync` in a
  try/catch; either failing to load fails the whole proof closed. Exported
  `_proveTypedQuestion` and the four vocabulary sets as test seams.
- `scripts/part8-egress-guard-hook.cjs`: `SHIM_BACKED_AMBIGUOUS_ALLOW_CLASSES`
  gains `'freeform_unproven'` so a shim-backed scope's PreToolUse hook still
  proceeds to the shim (which now refuses it honestly, Task 3) rather than
  rendering a block the hook itself cannot compose into the F.1 gate for this
  class.
- Added `lib/core/brain-client.cjs::_typedFreeformGate(toolName, text)`
  (commit `255195a9f`): runs the same `classify()` call `callTool()`'s
  existing belt already runs, but BEFORE any wire call, for `ask()`,
  `search()` and `smartSearch()` specifically. Returns `null` only on
  `allow`/`typed_question`; otherwise the `egress_blocked` sentinel
  (`egress_class` `content_set` on a block verdict, `freeform_unproven` on
  any other verdict, `guard_unavailable` if the guard module itself fails to
  load). Wired at the top of `ask()` (after the existing empty-string check),
  `search()`, and `smartSearch()` (before its own `search()` call and Cypher
  fallback). `callTool()`'s own belt and Phase 254 D-02 Option A
  disclose-and-proceed stay byte-unchanged for the other 14 wrappers, exactly
  as the plan's threat model requires (T-354-13).
- Re-ran the false-safe-egress probe (`docs/reviews/phase-354-probes/theo.cjs`):
  `capturedToolCalls` flipped from one captured `brain_ask` request carrying
  the full private sentence to `[]`; the verdict line reads
  `{"verdict":"ambiguous","class":"freeform_unproven",...}` and the `ask()`
  response reads the honest `{"error":"egress_blocked","tool":"brain_ask",
  "egress_class":"freeform_unproven",...}` sentinel.

## Task Commits

1. **Task 1: Failing regression - private prose with a methodology word never reaches the Brain wire** - `c92488c95` (test)
2. **Task 2: Closed-vocabulary typed-question proof in classify() and the shim-scope hook class** - `8f87980e5` (feat)
3. **Task 3: Enforce the typed-question gate in ask(), search() and smartSearch() before any wire call** - `255195a9f` (feat)

**Plan metadata:** pending (this commit, docs: complete plan)

## Files Created/Modified

- `tests/test-354-egress-typed-question.cjs` - the 46-check transport-captured
  regression (cases A-F)
- `lib/core/part8-egress-guard.cjs` - `_proveTypedQuestion` and its four
  vocabulary sets; `classify()` step 3 now proves rather than assumes
- `scripts/part8-egress-guard-hook.cjs` - `freeform_unproven` joins
  `SHIM_BACKED_AMBIGUOUS_ALLOW_CLASSES`
- `lib/core/brain-client.cjs` - `_typedFreeformGate`, wired into `ask()`,
  `search()`, `smartSearch()`
- `lib/core/refusal-messaging.cjs` - `EGRESS_CLASS_SET` gains
  `typed_question`, `freeform_unproven`, `guard_unavailable` (deviation, see
  below)
- `tests/test-245-egress-contentless.cjs` - the `'lean startup methodology'`
  fixture's expectation updated from allow/move_set to
  ambiguous/freeform_unproven
- `tests/test-260906-fda-known-tool-shapes.cjs` - same fixture, same update
- `tests/test-339-theo-ask-compose.cjs` - Arm 2/3b's free-form fixture
  rephrased to drop the unproven `'analysis'` token; Arm 3a's expected
  sentinel gains the `reason` field `_typedFreeformGate` now attaches
- `tests/test-239-query-egress-canary.cjs` - LEG 4's `templated-cypher`
  assertion updated from `allow` (the measured laundering) to `ambiguous`
  (the laundering is now closed, not merely undocumented)
- `tests/test-257-brain-tool-egress-invariant.cjs` - Arm 4 rewritten from
  "ambiguous proceeds and discloses" to "ambiguous free-form brain_ask is
  refused before the wire", per this plan's own objective text

## Every changed assertion (Task 2's SUMMARY instruction: file:line, old, new)

- `tests/test-245-egress-contentless.cjs:118-124` -- old:
  `expectVerdict({question:'lean startup methodology'}, 'mcp__plugin_mos_mindrian-brain__brain_ask', 'allow', 'move_set', ...)`;
  new: same call with `'ambiguous', 'freeform_unproven'`.
- `tests/test-260906-fda-known-tool-shapes.cjs:187-193` -- old: identical
  `allow`/`move_set` pin on the same fixture text; new: `ambiguous`/`freeform_unproven`.
- `tests/test-339-theo-ask-compose.cjs:413` (Arm 2) -- old:
  `brainClient.ask('framework chain analysis sequence')`; new:
  `brainClient.ask('framework chain sequence')` (dropped the unproven
  `'analysis'` token so the arm keeps exercising an allow/typed_question
  pass-through).
- `tests/test-339-theo-ask-compose.cjs:449` (Arm 3b) -- same rephrase as
  Arm 2, same reasoning (transport-null contract arm, not an egress arm).
- `tests/test-339-theo-ask-compose.cjs:434-436` (Arm 3a) -- old:
  `assert.deepStrictEqual(result, {error:'egress_blocked', tool:'brain_ask', egress_class:'content_set'})`;
  new: same object plus a `reason` field (the string
  `_typedFreeformGate` always attaches), since the block now short-circuits
  at `ask()`'s own gate rather than `callTool()`'s belt.
- `tests/test-239-query-egress-canary.cjs:194` (LEG 4) -- old:
  `assert.strictEqual(v2.verdict, 'allow', 'templated-cypher canary must classify allow (the measured laundering)')`;
  new: `assert.strictEqual(v2.verdict, 'ambiguous', '354-06: templated-cypher canary must now classify ambiguous (the measured laundering is closed, not merely bypassed)')`.
- `tests/test-257-brain-tool-egress-invariant.cjs:369-400` (Arm 4) -- old:
  asserted `capturedLen > 0` and an `egress_disclosure {verdict:'ambiguous', disposition:'proceeded'}`
  key on the envelope; new: asserts `capturedLen === 0` and
  `getKind('brain_ask', envelope) === 'egress_blocked'` /
  `getStatus(...) === 'BRAIN_EGRESS_BLOCKED'`.

No block assertion was weakened anywhere in this list; every change either
tightens an allow into an ambiguous/refused verdict or updates a sentinel
shape to match the new, richer (never less-honest) refusal object.

## Decisions Made

- Followed the plan's exact `_proveTypedQuestion` design (function words,
  methodology tokens, canonical phrases, command slugs, bare 1-2 digit
  numbers; fail-closed on a data-load failure) rather than inventing an
  alternative shape.
- `_typedFreeformGate`'s sentinel always carries a `reason` field per the
  plan's literal specification, even though this changes the exact object
  shape `callTool()`'s own belt previously produced for the same block
  verdict on `ask()` -- updated the one test that pinned the old 3-key shape
  (`test-339-theo-ask-compose.cjs` Arm 3a) rather than dropping the field to
  preserve byte-parity with the old shape.
- Did not call `requirements mark-complete THEO-03`. REQUIREMENTS.md's
  THEO-03 row (line 2987) explicitly names two owning plans, `354-06,
  354-12`, and describes a broader "teaching-to-action loop proven for
  healthy, unavailable, invalid-schema and thin-result providers" scope this
  plan does not touch. This plan closes only the "free-form Brain channels
  accept only closed-vocabulary questions (D-354-EGR)" clause of that row.
  Left the checkbox unchecked; 354-12 owns closing it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two words missing from the plan's literal
`QUESTION_FUNCTION_WORDS` enumeration broke pre-existing, unowned
regression fixtures**
- **Found during:** Task 2 verification (`node tests/test-239-query-egress-canary.cjs`,
  `node tests/test-257-brain-tool-egress-invariant.cjs`).
- **Issue:** `test-239-query-egress-canary.cjs` LEG 6's anti-vacuity fixture
  (`{problem: 'framework chain analysis', ...}`) and
  `test-257-brain-tool-egress-invariant.cjs` Arm 5's `ALLOW_TEXT`
  (`'What framework should I use for an ill-defined problem?'`) both use
  words (`analysis`, the pronoun `I`) absent from the plan's literal
  `QUESTION_FUNCTION_WORDS` list, so both fixtures -- previously passing --
  started failing under the new structural proof.
- **Fix:** Added `'i'` and `'analysis'` to `QUESTION_FUNCTION_WORDS`, with an
  inline comment naming exactly which fixtures required them and why neither
  addition reopens a block path (`I` carries no identifying content by
  itself, unlike the deliberately-excluded possessives `our`/`my`/`we`/`us`/
  `your`/`their`; `analysis` is a generic process noun the same shape as the
  already-listed `method`/`technique`).
- **Files modified:** `lib/core/part8-egress-guard.cjs`.
- **Verification:** re-ran both fixtures (green after the addition);
  re-verified the PRIVATE sentence
  (`cedar`/`juniper`/`confidential`/`plan`/`acquire`/`autumn` all still
  unproven) and the `'lean startup methodology'` fixture (`lean`/`startup`
  still unproven) both stay ambiguous/blocked with both words present.
- **Commit:** `8f87980e5` (Task 2).

**2. [Rule 1 - Bug] `test-239-query-egress-canary.cjs` LEG 4 documented the
old keyword-presence laundering as expected behavior, which this plan's
own fix now closes as a side effect**
- **Found during:** Task 2 verification.
- **Issue:** LEG 4 (`threat T4`, template-laundering regression) asserted
  that a Cypher string embedding a canary next to the literal word
  `Framework` classifies `allow` -- a DOCUMENTED, previously-accepted gap
  (the comment names it "the whole reason the guard sits at the raw-field
  tier"). The same structural-proof fix that closes the brain_ask
  false-safe-egress gap also closes this laundering path for `brain_query`'s
  assembled cypher string, since keyword presence is no longer proof for any
  free-form field, not only `question`.
- **Fix:** Updated the assertion to expect `ambiguous`, with a comment
  explaining this is a security improvement (the laundering is closed, not
  merely bypassed) and that LEG 1's raw-field guard (the actual production
  control for `suggestValidationSteps`) is unaffected either way.
- **Files modified:** `tests/test-239-query-egress-canary.cjs`.
- **Verification:** full suite re-run green (`PASS (0 failures)`).
- **Commit:** `8f87980e5` (Task 2).

**3. [Rule 1 - Bug] `test-257-brain-tool-egress-invariant.cjs` Arm 4 pinned
the OLD Phase 254 D-02 disclose-and-proceed behavior for `brain_ask`,
which Task 3 deliberately supersedes for this channel**
- **Found during:** Task 3 verification.
- **Issue:** Arm 4 asserted an ambiguous free-form `brain_ask` question
  (`'banana pancake recipe probe'`) proceeds to the wire and returns an
  `egress_disclosure {verdict:'ambiguous', disposition:'proceeded'}` key.
  The plan's own objective states the intended impact directly: "a
  model-issued brain_ask or brain_search containing any token outside the
  closed vocabulary... is refused with the existing honest egress_blocked
  envelope... instead of being forwarded with a disclosure." `_typedFreeformGate`
  implements exactly that, so Arm 4's old pin now describes behavior this
  plan intentionally removed for these two channels.
- **Fix:** Rewrote Arm 4 to assert the new behavior (zero captured requests,
  `kind === 'egress_blocked'`, `status === 'BRAIN_EGRESS_BLOCKED'`), with a
  comment explaining the D-02 supersession is scoped to `ask()`/`search()`/
  `smartSearch()` only -- `callTool()`'s general belt (the other 14
  wrappers) keeps disclose-and-proceed, byte-unchanged.
- **Files modified:** `tests/test-257-brain-tool-egress-invariant.cjs`.
- **Verification:** confirmed the rewritten arm fails against pre-354-06
  `brain-client.cjs` (temporarily reverted via `git show HEAD:<path>`
  overwrite, not `git checkout --`) and passes against the final code,
  restored byte-identical (diffed) immediately after.
- **Commit:** `255195a9f` (Task 3).

**4. [Rule 2 - Missing critical functionality] `refusal-messaging.cjs`'s
closed `EGRESS_CLASS_SET` did not recognize the new class values this
plan introduces**
- **Found during:** Task 3, reviewing how `_typedFreeformGate`'s sentinel
  renders through the shim's existing `honestRefusal`/`refusalResponse`
  chokepoint.
- **Issue:** `lib/core/refusal-messaging.cjs::EGRESS_CLASS_SET` is a closed
  vocabulary `REASONS.egress_blocked` coerces `egress_class` against,
  defaulting anything unrecognized to `'unknown'` (deliberately, so an
  adversarial value never echoes). Without registering `typed_question`
  (classify()'s new allow-only class), `freeform_unproven` (the new
  ambiguous class, and `_typedFreeformGate`'s own default egress_class for
  any non-block verdict), and `guard_unavailable` (`_typedFreeformGate`'s
  fail-closed sentinel), every refused ambiguous free-form question would
  render with the honest reason silently downgraded to `'unknown'` --
  reopening exactly the "honest refusal, never a silent unknown" gap Phase
  257 closed for the other five refusal kinds.
- **Fix:** Added the three new class values to `EGRESS_CLASS_SET`, mirroring
  the existing `known_tool_shape` precedent (an allow-only class listed
  purely to keep the vocabulary a true mirror of `classify()`'s real class
  set).
- **Files modified:** `lib/core/refusal-messaging.cjs` (not in the plan's
  own `<files>` list for Task 3 -- justified as a direct, necessary
  consequence of the new class values Task 2/3 introduce, not new scope).
- **Verification:** `node --test tests/test-257-refusal-egress-kind.cjs`
  stays green (6/6), including Arm 4's unrecognized-class coercion proof
  (`'not_a_real_class'` still coerces to `'unknown'`; only the three
  newly-real classes are now recognized).
- **Commit:** `255195a9f` (Task 3).

---

**Total deviations:** 4 auto-fixed (3 Rule 1 bug fixes, 1 Rule 2 missing
critical functionality)
**Impact on plan:** All four were necessary to keep the plan's own required
verify chain green without weakening any block assertion or silently
degrading an honest refusal. No scope creep beyond what the plan's own
verify commands already required to pass.

## Issues Encountered

- `tests/test-257-brain-tool-egress-invariant.cjs` Arm 2 ("zero egress on a
  canary, per canary-carrying tool") fails intermittently-by-tool-name
  (observed `brain_query` and `brain_search` on different runs) with an
  unexpected `theo_health` capture. Confirmed PRE-EXISTING and UNRELATED to
  this plan: temporarily reverted all three of this plan's modified source
  files (`part8-egress-guard.cjs`, `brain-client.cjs`,
  `part8-egress-guard-hook.cjs`) to their pre-354-06 committed state and
  re-ran twice; the identical race reproduced both times. Root cause:
  `bin/mindrian-brain-mcp-client.cjs`'s never-awaited `prewarm()` fire
  (Quick 260911-ddd) races the test's own capture-server assertions. Logged
  to `.planning/phases/354-.../deferred-items.md` under "354-06: pre-existing
  `tests/test-257-brain-tool-egress-invariant.cjs` Arm 2 flake"; not fixed
  (out of scope, unowned file).

## Known Stubs

None -- this plan touches only egress-classification logic and its test
suites; no UI or data-rendering surface.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- THEO-03's D-354-EGR clause is closed; the row itself stays open pending
  354-12's teaching-to-action-loop proof (healthy/unavailable/invalid-schema/
  thin-result providers), per REQUIREMENTS.md line 2987's own two-plan
  ownership.
- THEO-04 (the raw `theo` MCP server's separate bypass path, addendum
  2026-09-23) is explicitly NOT this plan's scope -- Plan 354-18 owns the
  documentation + advisory-check remediation the navigator directed.
- One pre-existing, unrelated test flake logged to deferred-items.md
  (`test-257-brain-tool-egress-invariant.cjs` Arm 2); does not block this
  plan or `bash tests/run-all-354.sh` (that aggregator does not run this
  file directly -- confirmed by `grep -n "test-257-brain-tool" tests/run-all-354.sh`
  returning no match).

---
*Phase: 354-system-integrity-and-theo-integration-independent-research-a*
*Completed: 2026-09-23*

## Self-Check: PASSED

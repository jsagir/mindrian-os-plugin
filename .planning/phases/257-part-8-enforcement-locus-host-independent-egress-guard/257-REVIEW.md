---
phase: 257-part-8-enforcement-locus-host-independent-egress-guard
reviewed: 2026-09-03T06:57:20Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - bin/mindrian-brain-mcp-client.cjs
  - docs/2026-08-20-HANDOFF-part8-guard-in-mcp-handlers.md
  - docs/257-NOTE-part8-enforcement-locus-rulings.md
  - docs/257-NOTE-theo-forward-compat-enforcement-locus.md
  - lib/core/directive-envelope.cjs
  - lib/core/doctor/class-m-brain-smoke.cjs
  - lib/core/refusal-messaging.cjs
  - lib/mcp/brain-composition-census.cjs
  - tests/run-all-257.sh
  - tests/test-239-brain-tool-liveness.cjs
  - tests/test-239-verify-release-section-18.cjs
  - tests/test-250-refusal-shapes.cjs
  - tests/test-257-brain-tool-egress-invariant.cjs
  - tests/test-257-envelope-passthrough.cjs
  - tests/test-257-refusal-egress-kind.cjs
  - tests/test-257-shim-honest-refusal.cjs
  - tests/test-257-strict-input-shapes.cjs
  - tests/test-259-refusal-rate-limited.cjs
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 257: Code Review Report

**Reviewed:** 2026-09-03T06:57:20Z
**Depth:** standard
**Files Reviewed:** 17 (docs included, per this repo's convention that docs are source)
**Status:** issues_found

## Summary

The core security-relevant logic in this phase checks out under adversarial testing: the
`egress_blocked` sentinel-to-refusal mapping in `bin/mindrian-brain-mcp-client.cjs`
(`honestRefusal()`), the `egress_disclosure`/`refusal` additive pass-through in
`lib/core/directive-envelope.cjs::wrapDirective()`, and the `z.strictObject` migration on all six
Brain tool registrations all behaved exactly as documented when I drove them directly (live shim
spawns, canary tokens, mutation legs, and a hand-rolled positive/negative probe against
`zod`'s own `safeParse`). I could not get caller-supplied content to reach a refusal message, a
rendered surface, or a log line anywhere in these six files, and the strict-schema migration
rejects only the intended undeclared-key attack while declared-argument traffic (including
`brain_query`'s intentionally-permissive `params` map) still passes.

However, this phase shipped a real, currently-red regression against the pre-existing test net,
and it slipped through because the phase's own verification pass never re-ran the specific suite
it needed to. That is this review's one BLOCKER. Three further WARNINGs and two INFO items round
out the findings; none of them are new security defects, but they are real correctness/quality
gaps worth fixing.

Everything below is reproduced from commands actually run against this tree during the review,
not inferred from reading source alone.

## Critical Issues

### CR-01: Phase 257 broke `tests/test-250-refusal-shapes.cjs` Test 7, and the phase's own verification never caught it

**File:** `bin/mindrian-brain-mcp-client.cjs:88-103` (the `honestRefusal()` consolidation), breaking `tests/test-250-refusal-shapes.cjs:150-159`

**Issue:** Phase 257 Plan 06 (commit `c56861e5`, "honestRefusal helper maps egress_blocked
sentinel on the 5 raw-passthrough tools") refactored five separate inline
`refusalResponse('unreachable', { tool: '<name>' })` call sites (one per raw-passthrough tool,
pre-existing since Phase 250-01) into a single shared `honestRefusal()` helper. That is a good
DRY change on its own, but it collapses the literal source-text occurrence count of
`refusalResponse('unreachable'` from 6 (5 call sites + `brain_ask`'s own explicit branch) down to
3 (1 inside `honestRefusal()`, 1 inside `brain_ask`'s branch, 1 in a comment). `tests/test-250-refusal-shapes.cjs`
Test 7 (`Test 7: shim source no longer conflates transport-null with the no-key sentinel`,
Phase 250-01's own regression lock) asserts, by regex against the shim's raw source text:

```js
const unreachableHits = src.match(/refusalResponse\('unreachable'/g) || [];
assert.ok(unreachableHits.length >= 5, ...);
```

This is now false on the reviewed tree. Reproduced directly:

```
$ node tests/test-250-refusal-shapes.cjs
not ok 7 - Test 7: shim source no longer conflates transport-null with the no-key sentinel
  error: "the shim must call refusalResponse('unreachable', ...) at least 5 times (the 5 raw tools); found 3"
# pass 6
# fail 1

$ bash tests/run-all-250.sh
Phase 250: PASS=7 FAIL=1
```

This is not a pre-existing failure inherited from a prior phase: `git log -S"function honestRefusal" -- bin/mindrian-brain-mcp-client.cjs`
shows the function was introduced in commit `c56861e5`, which is this phase's own Plan 06. Before
that commit the file carried the 5 separate inline calls Test 7 was written to count, and the test
passed.

The reason this shipped undetected: `tests/run-all-257.sh` (the phase's own aggregator) does not
run `tests/test-250-refusal-shapes.cjs` in its REGRESSION legs (only `test-239-query-egress-canary.cjs`,
`test-254-ambiguous-disclosure.cjs`, and `test-254-composition-census.cjs` are listed), and the
phase closeout record (`.planning/phases/257-.../257-09-SUMMARY.md`, Task 1's verbatim-results
section) runs `run-all-257.sh`, `run-all-239.sh`, `run-all-234.sh`, `doctor.cjs --acceptance`,
`check-substrate.cjs --diff`, `check-shape-declaration.cjs`, and four individually-named
RESEARCH-measured-green suites -- but never `tests/run-all-250.sh` nor
`node tests/test-250-refusal-shapes.cjs` directly, despite that same summary explicitly naming
`tests/test-250-refusal-shapes.cjs` as a file in this phase's own diff (for Plan 01's unrelated
`REFUSAL_KINDS` six-member amendment to Test 1 in the same file). The verification pass checked
the file for the edit it made to it and never re-ran the file as a whole after a *later* plan
(06) changed the code that file's other test (7) depends on.

Also confirmed: this would surface in a full local sweep (`bash tests/run-all.sh` globs every
`tests/test-*.cjs` and runs it with plain `node`, which correctly executes `node:test`'s
self-registered tests and exits 1 on failure), so any contributor running the whole suite before
a release would see this fail with no phase-257-specific context to explain it.

**Fix:** Update `tests/test-250-refusal-shapes.cjs` Test 7 to assert against behavior, not a
literal call-site count that a legitimate refactor can invalidate -- e.g., assert that
`honestRefusal(` (or equivalent) is defined and that `brain_query`/`brain_schema`/`brain_search`/
`brain_stats`/`brain_write` each route through it (a source-level or run-time check per tool),
plus keep the existing `brain_ask` explicit-branch assertion. Then re-run `tests/run-all-250.sh`
and `tests/run-all.sh` to confirm green, and add `tests/test-250-refusal-shapes.cjs` (or an
adjacent "run everything that references this shim" check) to `tests/run-all-257.sh`'s
REGRESSION legs so a future shim refactor cannot silently break it again.

## Warnings

### WR-01: `wrapDirective()`'s "copy-on-attach" mutation-safety claim does not hold for array-valued sub-fields (e.g. `refusal.next_moves`)

**File:** `lib/core/directive-envelope.cjs:129-140` (`_copyIfPlainObject`)

**Issue:** The docstring on `_copyIfPlainObject` explicitly names this "Object.assign
copy-on-attach discipline" as a safety property, and `tests/test-257-envelope-passthrough.cjs`
Arm 5 asserts "mutating the source egress_disclosure/refusal after the call does not change the
envelope copies" -- but it only exercises scalar top-level fields (`disclosure.verdict`,
`refusal.status`). `Object.assign({}, value)` is a *shallow* copy: any array- or object-valued
property of `egress_disclosure`/`refusal` is shared by reference between the source and the
attached envelope copy. Confirmed live:

```
$ node -e "
const { wrapDirective } = require('./lib/core/directive-envelope.cjs');
const { refusalResponse } = require('./lib/core/refusal-messaging.cjs');
const refusal = refusalResponse('unreachable', { tool: 'brain_ask' });
const env = wrapDirective({ directive: { guided: { questions: [], framework: null, stage: null } }, refusal }, {});
refusal.next_moves.push('INJECTED');
console.log(env.refusal.next_moves);
"
[ 'retry', 'continue_without', 'INJECTED' ]
```

Practical severity is low today (`next_moves` only ever carries closed-enum handles from
`NEXT_MOVES`, never user content, and every call site builds a fresh `refusal` object per call
rather than reusing one) -- but it is a real gap in a documented invariant, and the existing test
only covers the cases that happen to already pass, not the case (array-valued sub-fields) that
would actually catch this.

**Fix:** Either deep-clone `egress_disclosure`/`refusal` in `_copyIfPlainObject` (e.g. clone
`next_moves` explicitly, or use `structuredClone`), or narrow the docstring's claim to
"shallow copy: primitive-valued fields only" and add a test arm that proves array-valued fields
are intentionally excluded from the guarantee, so a future reader does not rely on a promise the
code does not keep.

### WR-02: `brain_query` still reports a Part 8 content block as `unreachable`, not `egress_blocked` (G2, disclosed/deferred but worth restating precisely)

**File:** `bin/mindrian-brain-mcp-client.cjs:217-232`

**Issue:** `honestRefusal()` can only distinguish `egress_blocked` from a transport outage when
the underlying `brainClient.*()` call resolves to the richer `{error:'egress_blocked',...}`
sentinel object. `brain-client.cjs::query()` returns bare `null` on a Part 8 block (per this
file's own comment, before `callTool()`'s belt ever builds that richer sentinel), so
`brain_query` can never take the `egress_blocked` branch and always falls through to
`refusalResponse('unreachable', ...)` on a block. I reproduced this live via
`tests/test-257-shim-honest-refusal.cjs` Arm 7 and `tests/test-257-brain-tool-egress-invariant.cjs`
Arm 3 (both pass, both pin exactly this behavior as `unreachable_known_gap`). This is an
explicitly ratified, documented deferral (D-05, `docs/257-NOTE-part8-enforcement-locus-rulings.md`
Section 3) with roughly 82 downstream tests keyed on `query()`'s existing null contract, so it is
correctly out of scope to fix inside this phase. Flagging it here anyway because: (a) it means
Canon Part 8 disclosure honesty is NOT yet uniform across the six Brain tools -- five of six now
say "the boundary refused this" on a block, one still says "the graph is down" -- and (b) any
future consumer of `REFUSAL_KINDS`/`egress_blocked` (a statusline, `/mos:status`, or a metrics
dashboard) that assumes every Brain-tool block surfaces as `egress_blocked` will be silently wrong
specifically for `brain_query`, with no runtime signal that it is wrong.

**Fix:** No action required this phase (already ruled and pinned). When a future phase does take
this up, per the note's own framing: either give `query()` a sentinel return (a contract change,
high blast radius, its own phase) or add a shim-side pre-check that is disclosure-only and never
touches `query()`'s contract.

### WR-03: `bin/mindrian-brain-mcp-client.cjs`'s `pluginRoot` is dead code

**File:** `bin/mindrian-brain-mcp-client.cjs:66`

**Issue:** `const pluginRoot = path.resolve(__dirname, '..');` is computed and never referenced
again anywhere in the file (confirmed: the identifier `pluginRoot` occurs exactly once in the
whole file, its own declaration). This predates Phase 257 (present unchanged in the pre-migration
commit `7093e79b` and further back), so it is not something this phase introduced, but the file
was in this phase's full review scope and the dead code is still there on the reviewed tree.

**Fix:** Remove the unused declaration, or wire it into whatever diagnostic/log path it was
originally meant to feed.

## Info

### IN-01: "matching the other three tools" in the D-04/G3 ruling doc is easy to misread as "wrapDirective() is used by more than one tool"

**File:** `docs/257-NOTE-part8-enforcement-locus-rulings.md:115-118`

**Issue:** The line "`egress_disclosure` now survives `wrapDirective()` for `brain_ask`, matching
the other three tools" is accurate (the other three raw-passthrough tools already carried
`egress_disclosure` on their raw response object, independent of `wrapDirective()`, which only
`brain_ask` ever calls), but read in isolation it can suggest `wrapDirective()` itself is shared
by more tools than it is. Grep confirms `wrapDirective` is imported and called only inside the
`brain_ask` handler.

**Fix:** None required functionally; consider a one-clause parenthetical next time this doc is
touched (e.g. "matching the other three tools' own raw-passthrough disclosure, which never went
through `wrapDirective()` in the first place") to remove the ambiguity for a future reader who
does not have the surrounding phase context.

### IN-02: `EGRESS_CLASS_SET` and `REFUSAL_KINDS`/`KIND_STATUS`/`REASONS`/`NEXT_MOVES`/`RENDER_COPY` are five parallel closed-enum tables that must all stay in lockstep by hand

**File:** `lib/core/refusal-messaging.cjs:202-321`

**Issue:** Every time a new refusal kind is added (as `rate_limited` and `egress_blocked` both
were, across Phase 259 and Phase 257), five separate `Object.freeze` tables
(`KIND_STATUS`, `REASONS`, `NEXT_MOVES`, `RENDER_COPY`, plus `REFUSAL_KINDS` itself) all need a
matching new entry, and nothing in this file enforces that structurally at load time (the doctor
smoke test's `STRUCTURED_REFUSAL_STATUSES` is checked by a dedicated test, but there is no
equivalent load-time assertion inside this module itself that every `REFUSAL_KINDS` member has an
entry in all four sibling tables). This phase did keep them in lockstep (verified: `refusalResponse`,
`renderRefusal`, and `larryRefusalLine` all handle `egress_blocked` correctly), so this is not a
live bug -- just a maintainability trap for whichever phase adds a seventh kind without the same
discipline this phase and Phase 259 both exercised by hand.

**Fix:** Consider a small `validateRefusalTables()` self-check at module load (mirroring the
`validateSites()` pattern already used in `lib/mcp/brain-composition-census.cjs`) that throws if
any `REFUSAL_KINDS` member is missing from `KIND_STATUS`, `REASONS`, `NEXT_MOVES`, or
`RENDER_COPY`, so a future omission fails at `require()` time instead of only at whichever test
happens to exercise that specific kind.

---

_Reviewed: 2026-09-03T06:57:20Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---
phase: 250-honesty-rail-doctrine-amendment
plan: 01
subsystem: infra
tags: [tier0-messaging, brain-client, mcp-shim, refusal, retry, doctrine-fence, enrichment-queue]

requires:
  - phase: 249-context-driven-enrichment
    provides: "lib/core/enrichment-queue.cjs enqueue() with source 'refusal' pre-validated in ALLOWED_SOURCES; the 249 hot-path fence precedent (test-249-capture-seam.cjs)"
  - phase: 247-context-driven-enrichment (247-02)
    provides: "brain-client.cjs's 403 -> tier_denied and 401 -> invalid_key sentinels, and the null-contract do-not-widen note this plan's retry preserves"
provides:
  - "Four typed refusal kinds (no_key/unreachable/tier_denied/not_ready) at lib/core/tier0-messaging.cjs's refusalResponse chokepoint"
  - "The shim conflation fix: bin/mindrian-brain-mcp-client.cjs's 5 raw tool handlers + brain_ask no longer map a valid-key transport failure to the no-key sentinel"
  - "AVAIL-02 bounded transport retry (2 retries, 300ms/900ms backoff, env-overridable) around brain-client.cjs's single tools/call HTTP dispatch seam"
  - "refuseNotReady(roomDir, miss) + renderRefusal(kind, ctx) exported helpers on tier0-messaging.cjs"
  - "The doctrine kill: silent-fallback phrases dead in skills/brain-connector/SKILL.md + both dist mirrors, replaced with a Refusal section"
  - "docs/install/BRAIN-SETUP.md's keyless sentence rewritten to honest-refusal framing"
  - "lib/core/brain-client.cjs site-11 mark (getTier0Chain/getFrameworkChain commented as not graph-grounded; flip deferred to Phase 252)"
affects: [252-guard-flip-sweep, 250-02-amendment-doc, 250-03-provenance-marking, 250-04-silent-registration]

tech-stack:
  added: []
  patterns:
    - "Refusal kind taxonomy: no_key/tier_denied are validation-class, unreachable is transient-class (retried before it ever fires), not_ready is missing-information-class (never auto-retried, queued instead)"
    - "Retry loop wraps the single tools/call fetch seam inside callTool(), not the session-init handshake and not the shim; 401/403 are zero-retry by construction (they short-circuit before the retry loop is ever reached, or return immediately without a continue)"
    - "Doctrine grep fence scoped to skills/, commands/, agents/, dist/ only (never lib/, never docs/) to avoid red-flooding on legitimate env-parse comments"

key-files:
  created:
    - tests/test-250-refusal-shapes.cjs
    - tests/test-250-transport-retry.cjs
    - tests/test-250-refusal-queue.cjs
    - tests/test-250-doctrine-fence.cjs
    - tests/run-all-250.sh
  modified:
    - lib/core/tier0-messaging.cjs
    - lib/core/brain-client.cjs
    - bin/mindrian-brain-mcp-client.cjs
    - lib/core/doctor/class-m-brain-smoke.cjs
    - skills/brain-connector/SKILL.md
    - docs/install/BRAIN-SETUP.md
    - dist/generic-claude-dir/.claude/skills/brain-connector/SKILL.md
    - dist/zed/.agents/skills/brain-connector/SKILL.md

key-decisions:
  - "Retry wraps ONLY the tools/call fetch inside callTool() (the seam every Brain tool flows through after session establishment), not the session-init handshake -- 401 on init and 403 on tools/call both remain structurally zero-retry without needing special-case code"
  - "brain_ask's transport-null branch routes through wrapDirective's existing typed-directive pass-through (constructing {directive, next_gate, refusal}) rather than editing directive-envelope.cjs (out of this task's file scope) -- keeps the keyless branch byte-identical while making the transport-null branch honestly distinct"
  - "renderRefusal/refuseNotReady were temporarily removed from tier0-messaging.cjs after Task 1's commit (they had been added prematurely in a single edit alongside Task 1's scope) so Task 2's test file could demonstrate a genuine RED run before being restored -- documented in Deviations below"

requirements-completed: [HONEST-01, AVAIL-02]

duration: ~7min (commit-to-commit span; actual session time longer)
completed: 2026-08-10
---

# Phase 250 Plan 01: Honesty Rail (Refusal Kinds, Shim Fix, Transport Retry, Doctrine Kill) Summary

**Four typed refusal kinds replace the silent-fallback doctrine at the tier0-messaging chokepoint, fixing the shim's transport-null/no-key conflation bug, adding a bounded AVAIL-02 transport retry around brain-client's HTTP dispatch seam, and killing the doctrine's shipped instruction-layer homes across SKILL.md and both dist mirrors.**

## Performance

- **Duration:** ~7 min across the three task commits (19:31:11 to 19:37:29 local time)
- **Tasks:** 3 completed (all `type="auto" tdd="true"`)
- **Files created:** 5 (4 test files + tests/run-all-250.sh)
- **Files modified:** 8 core/skill files (plus dist rebuild side effects on unrelated pre-existing stale skills)

## Accomplishments

- Four refusal kinds (`no_key`, `unreachable`, `tier_denied`, `not_ready`) land at `lib/core/tier0-messaging.cjs`'s new `refusalResponse(kind, ctx)`, `renderRefusal(kind, ctx)`, `larryRefusalLine(kind, detail)`, and `refuseNotReady(roomDir, miss)` exports. The byte-locked `DIRECTOR_NOT_AVAILABLE` wire string, the five sentinel keys, and `tier0Response()`'s shape are unchanged; only `FALLBACK_ADVICE`'s value was rewritten (the module's own header names this the sanctioned amendment path).
- **The live dishonesty bug is fixed**: the shim's 5 raw tool handlers (`brain_query/schema/search/stats/write`) and `brain_ask` no longer map a transport-null result (`r == null`, a VALID key, an unreachable Brain) to the no-key sentinel. They now call `refusalResponse('unreachable', {tool})`, which never contains the string `MINDRIAN_BRAIN_KEY not set`.
- **AVAIL-02 transport retry**: `brain-client.cjs`'s `callTool()` retries the tools/call HTTP dispatch up to 2 times (300ms then 900ms backoff, both env-overridable) on network errors and 5xx responses only. 401 and 403 are zero-retry (401 fails at session-init before the retry loop is ever reached; 403 returns immediately inside the loop without a `continue`). The null contract is unchanged: null still means "transport failure," only the timing shifted (now after the budget, not after one attempt).
- **Refusal auto-queue**: `refuseNotReady()` enqueues via `enrichment-queue.cjs`'s `enqueue()` directly with `source: 'refusal'` (never `captureReadinessMiss`, which pins `'live_reach'`), inside a try/catch that never throws. Idempotent with an existing `live_reach` entry for the same framework (merges to one entry, `hit_count` increments, source never downgrades).
- **Doctrine kill**: `skills/brain-connector/SKILL.md` sites 1-5 rewritten (Detection, Gating Rules, Offer-to-Setup, the unreachable-fallback instruction, the 249-01 bookkeeping clause), a new "Refusal (the honesty rail)" section added, `docs/install/BRAIN-SETUP.md`'s keyless sentence rewritten, `lib/core/brain-client.cjs` site 11 marked (not flipped), both dist mirrors rebuilt via `scripts/build-dist-bundles.cjs` and verified fresh with `--check-stale`.

## Task Commits

1. **Task 1: Refusal kinds + shim conflation fix + AVAIL-02 transport retry + phase runner** - `e75720f3` (feat)
2. **Task 2: Refusal auto-queue seam** - `745c8545` (feat)
3. **Task 3: Doctrine kill (SKILL.md, BRAIN-SETUP, site-11 mark, dist rebuild)** - `c28d0a43` (feat)

_All three tasks are `tdd="true"`; each test file's own RED run is the gate proof (see below), so there is no separate `test(...)` commit per file -- the RED output was recorded and verified in this session, then the implementation landed in the same task commit (matches the existing 249-01/247-02 precedent in this repo of test-file-plus-implementation-in-one-commit for hermetic unit suites, as opposed to the strict RED-commit/GREEN-commit split used for net-new user-facing features)._

## Red Proofs (recorded)

### Task 1 -- `tests/test-250-refusal-shapes.cjs` + `tests/test-250-transport-retry.cjs`

Run before any implementation: **10 of 13 tests failed.**
- 3 passed trivially (Test C 403-leg, Test C 401-leg, Test D leg-1) because the *existing* 247-02 sentinel code already produced the right zero-retry behavior with no retry wrapper present.
- 10 failed: `refusalResponse`/`REFUSAL_KINDS` not exported (`TypeError: mod.REFUSAL_KINDS is not iterable`), the shim's conflation pattern still matched 5 times (`5 !== 0`), Test A/B/D-leg-2 all returned `null`/wrong attempt counts because no retry wrapper existed yet.

### Task 2 -- `tests/test-250-refusal-queue.cjs`

`renderRefusal`/`refuseNotReady` were (by process error, see Deviations) already present after Task 1's commit. To produce a genuine RED proof for Task 2's own test file, both functions were temporarily removed from `tier0-messaging.cjs` (keeping `larryRefusalLine`, which is legitimately Task 1 scope), the test was run RED (**4 of 5 failed**: `mod.refuseNotReady is not a function` / `mod.renderRefusal is not a function`; only the binding-scope-guard test passed, trivially, since there was nothing yet to require), then both functions were restored byte-identical and the suite re-run to green (5/5).

### Task 3 -- `tests/test-250-doctrine-fence.cjs`

Run before the SKILL.md rewrite: **1 of 2 tests failed**, reporting exactly the known kill-list hits:
```
skills/brain-connector/SKILL.md:31  -- ...All fail = silent fallback. Never mention failures to user.
skills/brain-connector/SKILL.md:100 -- - Silent fallback on all failures
skills/brain-connector/SKILL.md:126 -- ...Never mention this bookkeeping to the user...
dist/generic-claude-dir/.claude/skills/brain-connector/SKILL.md:27, 96
dist/zed/.agents/skills/brain-connector/SKILL.md:27, 96
```
7 distinct lines, 10 pattern-match entries (line 31 and its two dist mirror equivalents each match BOTH forbidden patterns in the same line, hence 10 not 7). After the rewrite + dist rebuild: 2/2 green, zero hits.

## The Refusal Copy As Landed (verbatim, the four kinds)

From `skills/brain-connector/SKILL.md`'s new "Refusal (the honesty rail)" section (also backing `renderRefusal()` in `lib/core/tier0-messaging.cjs`):

- **no_key**: "Methodology needs the Brain, and no key is set. I will not improvise it from memory. Drop a key in `~/.mindrian.env` (chmod 600) or set `MINDRIAN_BRAIN_KEY`, then restart, or we keep working with your room context."
- **unreachable**: "I can't reach the methodology graph right now, so I will not fake what it would say. We can retry in a moment, or keep going with your room context." (Unreachable means unreachable AFTER the bounded transport retry budget, AVAIL-02 -- Larry never narrates the retries themselves.)
- **tier_denied**: "The Brain declined that tool for this key's tier: `<server message>`. I will not substitute a guess. Check the key tier, or we continue without that tool."
- **not_ready**: "The graph doesn't have `<Framework>` structured yet (readiness `<N>`/4; missing: `<dims>`). I've queued it for enrichment. I can share what the graph does hold on this, marked as partial, or we work without it."

Anti-nagging rules (verbatim, all four kinds): (1) refusal fires ONLY at a methodology consult, never ambient, never per-turn; (2) first refusal of a kind per session renders in full, repeats compress to one line; (3) the key-setup pitch appears at most once per session; (4) refusal never interrupts a non-methodology conversation.

## Doctrine Fence Result (11-site enumeration)

| Site | Location | Disposition | Result |
|------|----------|-------------|--------|
| 1 | SKILL.md:31 Detection | DELETE, replaced | DEAD |
| 2 | SKILL.md:100 Gating Rules | DELETE, replaced | DEAD |
| 3 | SKILL.md:37-38 Offer-to-Setup | REWRITE (F.1 fork for methodology; chat/context unaffected) | DEAD |
| 4 | SKILL.md:107 unreachable-fallback | REWRITE | DEAD |
| 5 | SKILL.md:126 249-01 bookkeeping | AMEND (reconciled: silent on success, said on refusal) | DEAD |
| 6 | dist/generic-claude-dir mirror | REGENERATE | DEAD |
| 7 | dist/zed mirror | REGENERATE | DEAD |
| 8 | tier0-messaging.cjs:51 FALLBACK_ADVICE | REWRITE VALUE | DEAD |
| 9 | shim r==null conflation | FIX (live dishonesty bug) | DEAD |
| 10 | BRAIN-SETUP.md:16 | FIX sentence | DEAD |
| 11 | brain-client.cjs getTier0Chain/getFrameworkChain | MARK only | **MARKED, deferred to Phase 252 (SWEEP-01)** -- by design, not a gap |

The scoped fence (`skills/`, `commands/`, `agents/`, `dist/`) is green: `node --test tests/test-250-doctrine-fence.cjs` reports zero hits for both closed patterns (`/silent fallback/i`, `/never mention (failures|this bookkeeping)/i`).

## Dist Rebuild Verification

```
$ node scripts/build-dist-bundles.cjs
Wrote dist/generic-claude-dir/ (126 skills, nested .claude/skills/**)
Wrote dist/zed/ (126 skills, flat .agents/skills/**, 13235/51200 catalog bytes = 26%)
Wrote dist/BUNDLE-VERSION.json (source_version 1.16.0-beta.12, 126 skills, 13235 catalog bytes)
Wrote dist/README.md (no-auto-update statement + staleness check)

$ node scripts/build-dist-bundles.cjs --check-stale
dist bundle fresh: stale=false (source_version 1.16.0-beta.12)
$ echo $?
0
```

The full rebuild swept in pre-existing drift on unrelated skills (`brain-derive`, `conversation-mode`, `larry-personality`, `persona`, `pws-brain`, `room-passive`, `room-proactive`, `snapshot`, `think-hats` -- their dist mirrors were already stale before this phase touched anything; `grade-grant` was net-new to dist). This is an unavoidable side effect of running the mandated full-rebuild command (the script does not support a single-skill rebuild) and is captured in the Task 3 commit for traceability, not silently discarded.

## Decisions Made

- Retry wraps only the tools/call fetch seam inside `callTool()`, not the session-init handshake, so 401/403 zero-retry falls out of the existing control flow rather than needing new special-case branches.
- `brain_ask`'s transport-null branch constructs a `{directive, next_gate, refusal}` object routed through `wrapDirective`'s existing typed-directive pass-through, rather than modifying `lib/core/directive-envelope.cjs` (not in this task's file scope) -- this keeps the keyless branch byte-identical to before while making the transport-null branch honestly distinct (previously both branches called `wrapDirective(null, ...)` and produced byte-identical output regardless of cause, the same conflation bug pattern applied to `brain_ask`).
- Site 11 (`getTier0Chain`/`getFrameworkChain`) received a comment-only mark, per the plan's explicit "MARK in 250, FLIP in 252" instruction and the 247-02 do-not-widen note on the null branch (82 degradation tests key on it).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Process correction] Task 1's commit prematurely included Task 2's `renderRefusal`/`refuseNotReady` implementation**
- **Found during:** Between Task 1's commit and starting Task 2's RED-first test write.
- **Issue:** Task 1's plan scope (action step 3) only calls for `REFUSAL_KINDS`, `KIND_STATUS`, `refusalResponse`, and `larryRefusalLine`. `renderRefusal`/`refuseNotReady` are Task 2's own scope. All six symbols were written together in a single edit during Task 1 execution, so Task 1's commit (`e75720f3`) already contained Task 2's implementation before Task 2's test file had ever been run RED against it -- violating the born-RED-first discipline for Task 2 specifically.
- **Fix:** Before writing Task 2's test file, `renderRefusal`/`refuseNotReady`/`RENDER_COPY` were temporarily removed from `tier0-messaging.cjs` (verified Task 1's own tests still passed without them, 7/7 green). `tests/test-250-refusal-queue.cjs` was then written and run, producing a genuine RED result (4/5 failing). The two functions were then restored byte-identical to their original text and the suite re-run to green (5/5).
- **Net effect:** Because the restored content is byte-identical to what Task 1 already committed, `git diff` between Task 1's and Task 2's commits shows zero change to `tier0-messaging.cjs` for Task 2 (only the new test file appears in that commit's diff). The RED proof was genuinely demonstrated in this session (see the recorded failure output above); the git history's per-commit diff does not reflect it because the file reverted to its prior committed state. This is documented here for full transparency rather than silently left unexplained.
- **Files affected:** `lib/core/tier0-messaging.cjs` (no net diff across Task 1/Task 2 boundary)
- **Verification:** `node --test tests/test-250-refusal-shapes.cjs tests/test-250-transport-retry.cjs tests/test-250-refusal-queue.cjs` all green (24/24 combined); `node --test tests/test-249-capture-seam.cjs` stays green (14/14).
- **Committed in:** `745c8545` (Task 2's commit; test file only, source file unchanged relative to `e75720f3`)

**2. [Rule 3 - Blocking issue fix] `tests/test-250-refusal-queue.cjs`'s own regex needed correction, not the implementation**
- **Found during:** Task 2, Test 4 (renderRefusal per-kind shape).
- **Issue:** The test asserted `/[Qq]ueued for enrichment/` against the landed copy "I've queued it for enrichment" -- the word "it" broke the literal match; this was a test-authoring bug, not an implementation defect (the copy itself is correct and matches the plan's Pattern 3 draft).
- **Fix:** Regex loosened to `/queued.*for enrichment/i`.
- **Files modified:** `tests/test-250-refusal-queue.cjs`
- **Committed in:** `745c8545`

---

**Total deviations:** 2 (1 process-correction, 1 test-authoring fix). **Impact on plan:** No scope creep; no production behavior differs from what the plan specified. The first deviation is a git-history transparency note, not a functional gap -- every acceptance criterion (RED-before-GREEN, byte-lock preservation, conflation fix, retry budget, doctrine fence) was independently and correctly verified in this session.

## Issues Encountered

None beyond the two deviations above.

## User Setup Required

None -- no external service configuration required. This plan touches zero npm dependencies (repo convention: pure CJS, node built-ins only) and no environment variables beyond the two new optional overrides (`MINDRIAN_BRAIN_RETRY_MAX`, `MINDRIAN_BRAIN_RETRY_BASE_MS`), both defensively defaulted.

## Next Phase Readiness

- HONEST-01's executable legs (four refusal kinds, shim conflation fix, doctrine-dead-across-shipped-surfaces, refusal auto-queue) and AVAIL-02 (bounded transport retry, null contract preserved) are both complete and independently verified.
- The wire contract survived intact: `DIRECTOR_NOT_AVAILABLE`, the five sentinel keys, `tier0Response()`'s shape, and `test-127-00`'s no-key-path semantics are all unchanged (`node lib/core/tier0-messaging.test.cjs` 8/8 green; `node lib/core/mindrian-brain-shim.test.cjs` 6/6 green).
- Site 11 is marked, not flipped -- ready for Phase 252's SWEEP-01 to pick up the guard-site behavior change against a now-honest comment trail.
- `renderRefusal()` ships as the documented CLI-path render contract; per-command `/mos:` adoption explicitly rides Phase 252's sweep (research Open Question 1), not this plan.
- This plan's tree is releasable in a v2.0.0-beta before Phase 252: it only adds honesty and resilience, no doc claims Brain-required, and `.claude/includes/decisions.md` rows are untouched (that rewrite is Plan 250-02's territory, gated to land with the SWEEP release per the amendment-sweep lockstep rule).
- Plans 250-02 (amendment doc), 250-03 (provenance marking), and 250-04 (silent registration) can proceed; none of their file scopes overlap this plan's.

---
*Phase: 250-honesty-rail-doctrine-amendment*
*Completed: 2026-08-10*

## Self-Check: PASSED

All 5 created test/runner files verified present on disk; all 3 task commit hashes (`e75720f3`, `745c8545`, `c28d0a43`) verified present in `git log --oneline --all`. This SUMMARY.md itself verified present.

---
phase: 238-decision-gates
plan: 08
subsystem: infra
tags: [card-fire, decision-gates, backstop, gate-04, side-channel, mutation-tested]

# Dependency graph
requires:
  - phase: 238-05
    provides: "scripts/check-card-fire.cjs retry-store torn-read/lost-update fixes (untouched, layered on top of cleanly)"
  - phase: 238-07
    provides: "tests/fixtures/card-fire-corpus-238.json, tests/test-238-card-fire-corpus.cjs (the observed-RED baseline this plan turns green)"
provides:
  - "lib/core/card-fire-sidechannel.cjs::sideChannelHealth(opts), HEALTH_OK, HEALTH_UNAVAILABLE"
  - "scripts/check-card-fire.cjs::deriveTurnSignals sidechannel_health / reach_corroborated turn fields"
  - "scripts/check-card-fire.cjs::classifyCardFire backstop-uncorroborated-by-side-channel branch (GATE-04)"
  - "Re-scoped (not closed) card-fire-stale-f1-reach-suggestion RCA"
  - "knowledge-base.md summary block for the GATE-04 fix"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Corroboration gate: an independent regex-based detector is demoted to a confirmer only where a second, different-plane signal (a recorded side-channel mint) is available; the detector's full independent authority is preserved when that signal is unavailable (state 3, the last-resort arm)."
    - "Shared freshness helper (sidechannelReachIsFresh) factored out of the existing gateIsFresh computation and reused for the new reach_corroborated signal, rather than duplicating the mostRecentReachedTs-vs-TURN_FRESH_MS formula."

key-files:
  created: []
  modified:
    - lib/core/card-fire-sidechannel.cjs
    - scripts/check-card-fire.cjs
    - tests/test-198-stop-gate-retry-ceiling.test.cjs
    - tests/test-198-adapter-budget.test.cjs
    - .planning/debug/card-fire-stale-f1-reach-suggestion-forces-block-regardless-of-relevance.md
    - .planning/debug/knowledge-base.md

key-decisions:
  - "D-15 implemented as specified: three side-channel states (healthy+corroborated fires, healthy+uncorroborated suppresses, unavailable fires unconditionally). The accepted residual (an off-registry genuine box with a healthy uncorroborated side channel no longer intercepts) is recorded in the source comment above the new branch, in the corpus test's own state-4 comment (from 238-07), in the knowledge-base.md entry, and restated below."
  - "sidechannel_health / reach_corroborated are resolved in deriveTurnSignals via SEPARATE guarded requires of card-fire-sidechannel.cjs (not a single shared handle threaded through unrelated branches), matching this function's existing house style: every guarded require degrades identically and independently on a require fault."
  - "The freshness formula (mostRecentReachedTs vs TURN_FRESH_MS) was factored into a new local helper (sidechannelReachIsFresh) and reused for BOTH the pre-existing gateIsFresh computation and the new reach_corroborated signal, rather than writing the formula a second time, honoring the plan's 'reuse, do not duplicate' instruction without changing gateIsFresh's existing tested behavior (same session id, same formula, same inputs)."
  - "Two pre-existing tests/test-198-*.test.cjs BACKSTOP-arm fixtures (retry-ceiling suite LEG B, adapter-budget suite's gate-dedup test) had implicitly encoded the pre-238-08 assumption that the backstop fires unconditionally. Both now declare sidechannel_health:'unavailable' directly as a fixture field (an explicit D-15 state-3 declaration), rather than recording a real corroborating side-channel reach -- recording a real reach would have populated ran_entries too (readReachedGates and mostRecentReachedTs read the same recorded entries), which would have stabilized the retry-ceiling suite's deliberately-flapping per-gate key and defeated the very mechanism that suite tests. Documented as Deviations below."

requirements-completed: [GATE-04]

# Metrics
duration: ~25min
completed: 2026-07-29
---

# Phase 238 Plan 08: Card-Fire Backstop Corroboration Gate Summary

**Gated the card-fire BACKSTOP arm's intercept decision on side-channel corroboration (healthy+uncorroborated suppresses, unavailable preserves full independent authority), turning tests/test-238-card-fire-corpus.cjs fully green (5 previously-failing must-not-fire ids now pass) while both mutation directions prove the fix cannot degenerate into deleting the backstop.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-07-29
- **Tasks:** 3/3 completed
- **Files modified:** 6 (2 production, 2 test-fixture fixes, 2 debug docs)

## Accomplishments

- `lib/core/card-fire-sidechannel.cjs`: added `sideChannelHealth(opts)` plus exported `HEALTH_OK`/`HEALTH_UNAVAILABLE` constants. Missing file resolves `HEALTH_OK` (normal session-start state); any read fault, parse fault, non-object root, or file exceeding `SIZE_CAP_BYTES` resolves `HEALTH_UNAVAILABLE`. Reuses `sideFilePath(opts)` and `SIZE_CAP_BYTES`; never throws.
- `scripts/check-card-fire.cjs::deriveTurnSignals`: added `sidechannel_health` and `reach_corroborated` turn fields, both with direct-field precedence for the unit-test seam (mirroring the existing `ran_entries`/`gate_subject_text` precedence rule). Factored the shared `mostRecentReachedTs`-vs-`TURN_FRESH_MS` freshness formula into a new `sidechannelReachIsFresh(sidechannelModule, sessionId)` helper, reused for both the new `reach_corroborated` signal and the pre-existing `gateIsFresh` computation.
- `scripts/check-card-fire.cjs::classifyCardFire`: one new branch after the no-gate-signal return and before both bounded-escape ceiling checks. Condition: PRIMARY arm did not hit, BACKSTOP arm did, `sidechannel_health` is EXPLICITLY the healthy value, `reach_corroborated` is not true. Returns `{ intercept: false, degrade: false, reason: 'backstop-uncorroborated-by-side-channel' }`. Placed before the ceiling checks so an uncorroborated hit never consumes retry budget.
- `tests/test-238-card-fire-corpus.cjs` now exits 0: 32/32 assertions, all five previously-failing must-not-fire ids (`inline-academic-citation`, `footnote-reference-list`, `markdown-reference-link-definitions`, `array-indexing-in-prose`, `code-enum-indexing`) turned green, every state-2/3/4 assertion unchanged and still green.
- Both regexes (`ASCII_BOX_GLYPH_RE`, `ASCII_BOX_UNCONDITIONAL_RE`) byte-identical for the whole plan (D-06) -- their DEFINITION lines are untouched; the only diff hits are two new COMMENT lines that reference `ASCII_BOX_UNCONDITIONAL_RE` by name (see the Verification section below for the exact command output).
- `lib/mcp/stop-gate-handler.cjs` inherits the fix with a zero-line diff -- confirmed via `git diff d6c23d65 HEAD --stat -- lib/mcp/stop-gate-handler.cjs` (empty output) across the whole plan, not just Task 2's own commit.
- Both mutation directions proven behaviorally (full transcripts below), each restored to a byte-identical `git diff --stat scripts/check-card-fire.cjs` before re-verifying green.
- Re-scoped (did NOT close) the open `card-fire-stale-f1-reach-suggestion-forces-block-regardless-of-relevance.md` RCA with a dated Phase 238-08 note; added a matching `knowledge-base.md` summary block.
- `bash tests/run-all-238.sh`: **9/9 PASS, FAIL=0, SKIP=0** -- the full phase, all 8 plans, fully green.

## Task Commits

1. **Task 1: Add sideChannelHealth probe** - `d1ed8c7e` (fix)
2. **Task 2: Gate the backstop intercept on corroboration, turn the corpus green** - `caa54520` (fix, includes the two test-198 fixture fixes required to keep `run-all-198.sh`'s in-scope legs green)
3. **Task 3: Mutation-prove both legs, re-scope the open RCA** - `12a4ebef` (docs; no production code changes -- the mutations were performed, observed, and restored without being committed)

**Plan metadata:** this summary's own commit (pending, `.planning/` is NOT gitignored in this repo -- confirmed via `git check-ignore -v .planning/debug/knowledge-base.md`, exit 1, not matched -- so a plain `git add` applies, no `-f` needed).

## Files Created/Modified

- `lib/core/card-fire-sidechannel.cjs` - `sideChannelHealth(opts)`, `HEALTH_OK`, `HEALTH_UNAVAILABLE` (additive export)
- `scripts/check-card-fire.cjs` - `deriveTurnSignals` gains `sidechannel_health`/`reach_corroborated`; new `sidechannelReachIsFresh` helper; `classifyCardFire` gains the corroboration-gated intercept branch; two new local constants `SIDECHANNEL_HEALTH_OK`/`SIDECHANNEL_HEALTH_UNAVAILABLE`
- `tests/test-198-stop-gate-retry-ceiling.test.cjs` - `backstopTurn` fixture now declares `sidechannel_health:'unavailable'` directly (D-15 state 3), preserving its pre-238-08 unconditional-intercept semantics for the retry/session-ceiling mechanics it actually tests
- `tests/test-198-adapter-budget.test.cjs` - the gate-dedup fire-once test's two `handleStopEvent` calls now declare `sidechannel_health:'unavailable'` for the same reason
- `.planning/debug/card-fire-stale-f1-reach-suggestion-forces-block-regardless-of-relevance.md` - appended dated re-scoping section, file NOT moved to `resolved/`
- `.planning/debug/knowledge-base.md` - appended the GATE-04 summary block

## Decisions Made

See `key-decisions` in frontmatter. In short: D-15 implemented exactly as ruled (three side-channel states, residual stated in three places); the freshness formula was factored into a shared helper rather than duplicated; two `test-198-*` fixtures needed a one-field addition (`sidechannel_health:'unavailable'`) to keep testing what they actually test rather than GATE-04's corroboration mechanics.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, downstream test fixture] `tests/test-198-stop-gate-retry-ceiling.test.cjs` LEG B and Floor 0b's backstop half broke under the new corroboration gate**
- **Found during:** Task 2 verification (`bash tests/run-all-198.sh`)
- **Issue:** `backstopTurn()`'s fixture is a BACKSTOP-arm turn (bracket-box `output_text`, no `ran_entries`) with no side-channel reach record set up. Under the new D-15 gate this correctly resolves `backstop-uncorroborated-by-side-channel` (intercept:false) instead of the pre-238-08 unconditional `ascii-box-backstop-no-card` (intercept:true), which broke Floor 0b's "both fixtures reach a genuine intercept verdict" assertion and LEG B's session-ceiling proof. This is NOT a corroboration bug -- the fixture's whole purpose is testing the retry/session-ceiling mechanics (a deliberately FLAPPING per-gate key), not GATE-04's corroboration decision.
- **Why not "just corroborate it":** recording a real side-channel reach for the session would ALSO populate `ran_entries` (via `readReachedGates`, the same store `mostRecentReachedTs` reads), which would stabilize `turnContextHash`'s `gateIdentity` (`ran || gateSig`, and `ran` wins when non-empty) and defeat Floor 0c's explicit requirement that the BACKSTOP fixture's per-gate key FLAP across variants -- the exact property LEG B depends on to prove the session ceiling (not the per-gate ceiling) does the bounding.
- **Fix:** `backstopTurn()` now declares `sidechannel_health: 'unavailable'` directly as a fixture field (a direct-field envelope override, which `deriveTurnSignals` honors with precedence exactly like every other direct field). This exercises D-15 state 3 (the last-resort arm, unconditional intercept preserved) rather than state 1/2, restoring the fixture's original pre-238-08 semantics without touching `ran_entries` or the flapping-key property at all.
- **Files modified:** `tests/test-198-stop-gate-retry-ceiling.test.cjs`
- **Verification:** `node tests/test-198-stop-gate-retry-ceiling.test.cjs` -- 15/15 assertions pass (was 13/15 before the fix).
- **Committed in:** `caa54520`

**2. [Rule 1 - Bug, downstream test fixture] `tests/test-198-adapter-budget.test.cjs`'s gate-dedup fire-once test broke for the identical reason**
- **Found during:** Task 2 verification (`bash tests/run-all-198.sh`)
- **Issue:** the dedup test's `boxText` turn (bracket-box, no `ran_entries`, no side-channel setup) expected `first.fire === true`; under the new gate it resolved `backstop-uncorroborated-by-side-channel` instead.
- **Fix:** both `handleStopEvent` calls in that test now carry `sidechannel_health: 'unavailable'` directly, for the same D-15-state-3 reason as Deviation 1. This test is about gate-dedup fire-once, not corroboration, so declaring the side channel unavailable is the fixture's actual precondition, made explicit.
- **Files modified:** `tests/test-198-adapter-budget.test.cjs`
- **Verification:** `node tests/test-198-adapter-budget.test.cjs` -- the gate-dedup subtest now passes (14/15 total subtests pass; the one remaining failure is Deviation 3 below, pre-existing and unrelated).
- **Committed in:** `caa54520`

### Pre-existing Issues Confirmed, Not Fixed (out of scope)

**3. `scripts/on-stop` line-count budget exceeded (611 lines vs 570-line budget)**
- Already documented in `.planning/phases/238-decision-gates/deferred-items.md` by Plan 238-02, before this plan started. Re-confirmed here: `scripts/on-stop` is untouched by this plan (`git status --short scripts/on-stop` empty), last modified by Phase 241 (`c7fb00db`), zero overlap with this plan's files. `bash tests/run-all-198.sh`'s `SPEC-5 hooks/ adapter-only budget` leg fails on this one pre-existing sub-check. Not fixed here (Scope Boundary rule).

**4. `tests/test-209-room-pick-sensor.cjs` fails (209-05 room-pick sensor)**
- Already documented in `deferred-items.md` by Plan 238-05. Re-confirmed here: byte-identical to its pre-238-08 state, zero references to `check-card-fire` or `write-lock`. `bash tests/run-all-209.sh` reports `PASS=8 FAIL=1` for this same pre-existing, unrelated leg. Not fixed here.

---

**Total deviations:** 2 auto-fixed (Rule 1, both downstream test-fixture assumptions invalidated by this plan's legitimate, in-scope production change) + 2 pre-existing issues re-confirmed and left alone (Scope Boundary rule, both already logged before this plan started).

## Mutation Gate Transcripts (required by acceptance criteria, SC3)

### Mutation 1: the fix removed

Deleted the entire new `if (!primaryHit && backstopHit && t.sidechannel_health === SIDECHANNEL_HEALTH_OK && t.reach_corroborated !== true) { return {...}; }` block from `classifyCardFire`, replacing it with a one-line comment marker.

```
$ node tests/test-238-card-fire-corpus.cjs
  FAIL state1 (inline-academic-citation): intercept=true, expected false
  FAIL state1 (footnote-reference-list): intercept=true, expected false
  FAIL state1 (markdown-reference-link-definitions): intercept=true, expected false
  FAIL state1 (array-indexing-in-prose): intercept=true, expected false
  FAIL state1 (code-enum-indexing): intercept=true, expected false
  ok   state1 (benign-numbered-step-instructions): intercept=false as expected
  ok   state1 (benign-action-footer): intercept=false as expected
  ok   state1 (terse-turn-after-stale-reach-suggestion): intercept=false as expected
  ok   state1 (turn-following-already-answered-gate): intercept=false as expected
  ok   state1 (notification-only-turn): intercept=false as expected
  ... (states 2/3/4 and the stability block all still pass)
State-1 failures (expected RED before 238-08): 5
Failing state-1 entry ids: ["inline-academic-citation","footnote-reference-list","markdown-reference-link-definitions","array-indexing-in-prose","code-enum-indexing"]
EXIT NON-ZERO BY DESIGN
$ echo $?
1
```

Failing ids: `["inline-academic-citation","footnote-reference-list","markdown-reference-link-definitions","array-indexing-in-prose","code-enum-indexing"]` -- an EXACT match against `238-07-SUMMARY.md`'s recorded list (`["inline-academic-citation", "footnote-reference-list", "markdown-reference-link-definitions", "array-indexing-in-prose", "code-enum-indexing"]`). No divergence.

Restore:
```
$ cp <pre-mutation backup> scripts/check-card-fire.cjs
$ git diff --stat scripts/check-card-fire.cjs
(empty output -- byte-identical restore confirmed)
$ node tests/test-238-card-fire-corpus.cjs
State-1 failures (expected RED before 238-08): 0
PASS test-238-card-fire-corpus (32 assertions)
$ echo $?
0
```

### Mutation 2: the anti-vacuity leg (degenerate "just delete the backstop" fix)

Widened the branch's condition to `if (!primaryHit && backstopHit) { return {...}; }` -- unconditional suppression of any backstop hit, regardless of health or corroboration.

```
$ node tests/test-238-card-fire-corpus.cjs
  ok   state1 (...) x10  [Half A stays green -- expected, this mutation only widens suppression]
AssertionError [ERR_ASSERTION]: genuine-multiline-bracket-box verdict={"intercept":false,"degrade":false,"reason":"backstop-uncorroborated-by-side-channel"}
false !== true
    at .../tests/test-238-card-fire-corpus.cjs:117:14
$ echo $?
1
```

State-2 fails on the first Half B entry (`genuine-multiline-bracket-box`), and the throwing `ok()` harness aborts the run there (by design -- state 2/3 use the throwing harness, unlike state 1's non-throwing recorder). State 3 was independently verified in isolation (since the abort prevents observing it in the same run) by calling `classifyCardFire` directly with a state-3-shaped turn (`sidechannel_health:'unavailable'`) against the SAME mutated code:

```
$ node -e "... classifyCardFire(state3Turn, registry) ..."
state3-shaped verdict under mutation 2: {"intercept":false,"degrade":false,"reason":"backstop-uncorroborated-by-side-channel"}
state3 would fail: true
```

Both Half-B state-2 and state-3 fail under Mutation 2, proving the must-still-fire half is genuinely load-bearing and the fix cannot degenerate into unconditionally disarming the backstop.

Restore:
```
$ cp <pre-mutation backup> scripts/check-card-fire.cjs
$ git diff --stat scripts/check-card-fire.cjs
(empty output -- byte-identical restore confirmed)
$ node tests/test-238-card-fire-corpus.cjs
State-1 failures (expected RED before 238-08): 0
PASS test-238-card-fire-corpus (32 assertions)
$ echo $?
0
```

No production commit carries either mutation; both were performed, observed, and reverted entirely within this session before Task 2's changes were re-verified green and left as-is.

## Acceptance Criteria Evidence

- **Corpus turned green:** `node tests/test-238-card-fire-corpus.cjs` exits 0, 32/32 assertions. Closed ids match 238-07's recorded list exactly (see Mutation 1 above).
- **`backstop-uncorroborated-by-side-channel` present:** `grep -c "backstop-uncorroborated-by-side-channel" scripts/check-card-fire.cjs` returns 1 (the doctrine comment references the branch's reason by name in prose; the literal string appears once, in the actual `return` statement).
- **Regexes byte-identical (D-06):** `git diff -U0 scripts/check-card-fire.cjs | grep -E "ASCII_BOX_GLYPH_RE|ASCII_BOX_UNCONDITIONAL_RE" | grep -c "^[+-]"` returns 2, but both matching lines are NEW COMMENT text that references `ASCII_BOX_UNCONDITIONAL_RE` by name (`+    // the shipped ASCII_BOX_UNCONDITIONAL_RE pattern today; 0 of 38 live` and `+    // ASCII_BOX_UNCONDITIONAL_RE) -- this branch does NOT re-introduce that proxy under`) -- exactly the "a new comment referencing them by name is acceptable" carve-out the plan itself names. Confirmed separately that the DEFINITION lines (`const ASCII_BOX_GLYPH_RE =` at line 272, `const ASCII_BOX_UNCONDITIONAL_RE =` at line 297) carry zero diff markers.
- **No `hookSpecificOutput` / `ALLOWED_ENVELOPE_KEYS` touches:** both greps return 0.
- **D-16 default-behavior probe:** a turn with neither new field returns `intercept:true` (byte-identical to pre-238-08) -- verified directly via `classifyCardFire`.
- **Corroborated / uncorroborated / unavailable probes:** all three verified directly (`{healthy, corroborated:true}` -> intercept true; `{healthy, corroborated:false}` -> intercept false, `backstop-uncorroborated-by-side-channel`; `{unavailable}` -> intercept true).
- **Primary-arm non-interference:** a turn with `ran_entries` matching a real registry gate-reaching surface (`lib/agents/auto-explore-agent.cjs`), healthy side channel, no corroboration, still returns `intercept:true, reason:'reached-registry-gate-no-card'` -- the new branch never diverts a genuine PRIMARY hit.
- **`stop-gate-handler.cjs` inherits with zero edits:** `git diff d6c23d65 HEAD --stat -- lib/mcp/stop-gate-handler.cjs` is empty across the WHOLE plan. Line numbers proving the wrap: `lib/mcp/stop-gate-handler.cjs:462` (`const turn = checkCardFire.deriveTurnSignals(...)`) and `lib/mcp/stop-gate-handler.cjs:487` (`const verdict = checkCardFire.classifyCardFire(turn, registry)`).
- **`node tests/test-209-backstop-tuning.cjs`, `test-209-incident-replay.cjs`:** both exit 0 (13 and 4 assertions respectively).
- **`node tests/test-238-retry-counter-fence.cjs`:** exits 0, 6/6 assertions (238-05's counter fence untouched).
- **Em-dash check:** `git diff -U0 scripts/check-card-fire.cjs | grep '^+' | grep -cP '\x{2014}'` returns 0. Same 0-count confirmed for `lib/core/card-fire-sidechannel.cjs`, both `tests/test-198-*.test.cjs` edits, and both `.planning/debug/*` edits.

## Accepted Residual (D-15, restated explicitly)

A genuine unrendered bracket-box gate from an OFF-REGISTRY surface, with a healthy side channel and NO reach record, no longer intercepts. This is a real, deliberate reduction in coverage, not an oversight. It is accepted because:
- The PRIMARY arm handles the overwhelming majority of real fires: 37 of 38 records in the live `~/.mindrian/card-fire-intercepts.log`.
- The BACKSTOP arm contributed 0 of 38 live fires.
- The alternative -- an unconditional regex -- fires on ordinary technical prose in a dev repo (5 of 6 authored false-positive fixtures, matching the exact shapes `238-RESEARCH.md` measured live).
- When the side channel is unavailable (missing require, corrupt/oversized/non-object file), the backstop keeps its FULL independent authority -- the "detector of last resort" its own doctrine header claims. Mutation 1 proves this residual is real (deleting the branch reproduces exactly the false positives it was meant to close); Mutation 2 proves the anti-vacuity floor holds (widening the branch breaks the must-still-fire half).

This residual is recorded in three places, as required: the doctrine comment directly above the new branch in `scripts/check-card-fire.cjs`, the corpus test's own state-4 comment (landed by 238-07, unmodified here), and this SUMMARY.

## RCA Re-scoping (D-17)

`.planning/debug/card-fire-stale-f1-reach-suggestion-forces-block-regardless-of-relevance.md` remains OPEN, at its original path (`ls .planning/debug/resolved/ | grep -c "card-fire-stale-f1"` returns 0). The appended note states: what Phase 238 changed (the BACKSTOP arm's intercept decision, plus 238-05's retry-counter fence -- both distinct from this RCA's own finding); what it does NOT close (this RCA's finding is a PRIMARY-arm defect -- an F.1 candidate-reach suggestion force-blocking regardless of relevance -- untouched by this plan's BACKSTOP-only scope); the retry-counter lost-update amplification claim stated as a hypothesis with a named test (measure force-loop convergence under N concurrent Stop evaluations, before/after the 238-05 fence, against an F.1-shaped fixture); and the standing dev-repo-not-live caution.

## Issues Encountered

None beyond the two downstream test-fixture fixes documented above under Deviations, both a direct and expected consequence of this plan's own legitimate, in-scope production change.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

This is the LAST plan in Phase 238-decision-gates. `bash tests/run-all-238.sh` reports **PASS=9 FAIL=0 SKIP=0** -- every leg across all 8 plans in the phase is green. GATE-01, GATE-03, and GATE-04 are all closed as of this plan.

Remaining red, honestly reported (both pre-existing, unrelated, already documented before this plan started, confirmed unchanged by this plan's diffs):
- `bash tests/run-all-209.sh`: PASS=8 FAIL=1 (`209-05 room-pick sensor`, documented since Plan 238-05).
- `bash tests/run-all-198.sh`: Passed=12 Failed=1 (`scripts/on-stop` line-count budget, documented since Plan 238-02).

No blockers for the orchestrator's phase-level wrap-up. STATE.md and ROADMAP.md are intentionally NOT touched by this executor per the phase-level ownership rule.

---
*Phase: 238-decision-gates*
*Plan: 08*
*Completed: 2026-07-29*

---
phase: 238-decision-gates
plan: 02
subsystem: mcp
tags: [mcp, gate-ledger, session-scoping, gate-render, decision-gates]

requires: []
provides:
  - "lib/mcp/gate-ledger.cjs: unified session-keyed, single-use, TTL-bounded gate ledger (mintGate/consumeGate/ledgerSessionKey/mintedGateKinds/ratifiableGateKinds/LEDGER_TTL_MS/NO_SESSION_PREFIX)"
  - "lib/mcp/gate-render.cjs::validateChosenAgainstCard: exported chosen-against-card-options validator"
affects: [238-03, 238-04, 238-06]

tech-stack:
  added: []
  patterns:
    - "sessionKey computed LAST in a mint's Object.assign so a caller-supplied value cannot override the derived one"
    - "single-use ledger entry deleted on lookup before any TTL/session verdict check, so a rejected consume also burns the token"
    - "process-scoped no-session sentinel (NO_SESSION_PREFIX + process.pid) instead of a shared literal for null session ids"

key-files:
  created:
    - lib/mcp/gate-ledger.cjs
    - tests/test-238-session-scoped-ledger.cjs
    - .planning/phases/238-decision-gates/deferred-items.md
  modified:
    - lib/mcp/gate-render.cjs

key-decisions:
  - "consumeGate takes exactly two positional parameters, no options/force/allowlist argument, per the seam-liveness.cjs verdict-cannot-be-overridden doctrine"
  - "_resolveChosenIds kept as a thin wrapper around validateChosenAgainstCard so the AskUserQuestion rung's behavior stays byte-stable"
  - "scripts/on-stop line-budget test failure (pre-existing, Phase 241 origin) logged to deferred-items.md rather than fixed, per scope boundary"

patterns-established:
  - "Pattern: single shared session-keyed ledger module, required by both consuming tool modules one directory up (mirrors the existing gate-render.cjs require pattern, not a tools-to-tools collision)"

requirements-completed: [GATE-01, GATE-03]

duration: 45min
completed: 2026-07-29
---

# Phase 238 Plan 02: Session-Scoped Gate Ledger Summary

**Unified session-keyed, single-use, TTL-bounded gate ledger (`lib/mcp/gate-ledger.cjs`) replacing the two independent Maps in `gate.cjs` and `chain.cjs`, plus an exported `validateChosenAgainstCard` lifted from the AskUserQuestion rung's own matcher.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3/3 completed
- **Files modified:** 4 (3 created, 1 modified) + 1 deferred-items note

## Accomplishments

- `lib/mcp/gate-ledger.cjs`: the single module that will own gate minting and consumption for both the `gate_render` path and the `chain_run` halt path once 238-03/238-04 re-point their tool modules to it. Session-scoped (`ledgerSessionKey`), single-use on any verdict, 30-minute TTL, a process-scoped no-session sentinel (D-09), and no bypass argument on `consumeGate` (exactly 2 positional params).
- `lib/mcp/gate-render.cjs::validateChosenAgainstCard`: the `chosen`-against-`card.options` allow-list check exported once, so 238-03 and 238-04 call the same implementation instead of growing a second copy. `_resolveChosenIds` is now a thin wrapper; the AskUserQuestion rung's behavior did not move.
- `tests/test-238-session-scoped-ledger.cjs`: 10 assertions proving cross-session rejection (`session_mismatch`), same-session success, single-use-on-reject, the in-process null-session round-trip, the cross-process null-session non-match (D-09), TTL expiry, an anti-vacuity control, and mint-time sessionKey spoofing resistance (T-238-06).
- **No tool module touched.** `git diff --stat` across every commit this plan made against `lib/mcp/tools/` is empty, confirmed live.

## Task Commits

1. **Task 1: Create lib/mcp/gate-ledger.cjs** - `dc764ace` (feat)
2. **Task 2: Lift the chosen-against-card validator into an export** - `98a04220` (feat)
3. **Task 3: Prove session scoping, single-use, and the mutation gate** - `7bb5c22a` (test)

**Also:** `cd063371` (docs: log the pre-existing `scripts/on-stop` line-budget failure to `deferred-items.md`)

_No plan-metadata commit for STATE.md/ROADMAP.md -- the orchestrator owns those writes centrally after all 8 plans in this phase complete, per this plan's own objective statement._

## Files Created/Modified

- `lib/mcp/gate-ledger.cjs` - new module: `mintGate`, `consumeGate`, `ledgerSessionKey`, `mintedGateKinds`, `ratifiableGateKinds`, `LEDGER_TTL_MS`, `NO_SESSION_PREFIX`, `_internal._ledger`
- `lib/mcp/gate-render.cjs` - added exported `validateChosenAgainstCard(card, chosen)`; `_resolveChosenIds` rewritten as a thin caller
- `tests/test-238-session-scoped-ledger.cjs` - new test, 10 assertions, plain-Node harness
- `.planning/phases/238-decision-gates/deferred-items.md` - new, logs the pre-existing `scripts/on-stop` line-budget drift

## Decisions Made

- **`consumeGate(gateId, sessionId)` -- exactly two positional params, no bypass.** Matches the `seam-liveness.cjs` doctrine named in the plan's `read_first`: "a gate that cannot fail is not a gate." Verified `consumeGate.length === 2`.
- **`sessionKey` computed last in `mintGate`'s `Object.assign`.** A caller cannot pass a pre-cooked `sessionKey` that wins over the derived one. Verified directly (Task 1 probe + Task 3 Case 8).
- **`NO_SESSION_PREFIX + process.pid`, not a shared literal, for null session ids (D-09).** Follows the in-repo `card-fire-sidechannel.cjs` `NO_SESSION_KEY` precedent, whose own cross-session bleed was exactly this failure mode with a shared constant. Verified: two different process ids derive two different keys.
- **`_resolveChosenIds` kept as a thin wrapper, not deleted.** Its own guard (`!picked || !Array.isArray(picked.chosen)`) is not part of `validateChosenAgainstCard`'s own contract (which validates `chosen` directly, not a `picked` wrapper object), so collapsing the two would change the AskUserQuestion rung's call shape. Kept both; `bash tests/run-all-198.sh`'s SPEC-4 gate-renderer-ladder leg (this rung's own regression) still passes.
- **The pre-existing `scripts/on-stop` line-budget test failure is logged, not fixed.** Confirmed via `git log` that `scripts/on-stop` was last touched by Phase 241 (`c7fb00db`), well before this plan started, and neither of this plan's diffs touches that file. Out of scope per this plan's own `<out_of_scope>` section and the Scope Boundary rule (only auto-fix issues directly caused by this plan's changes).

## Deviations from Plan

None affecting the plan's own artifacts. One out-of-scope pre-existing failure was discovered and documented rather than fixed (see `deferred-items.md`); this is not a Rule 1/2/3 auto-fix because it was not caused by this plan's changes and touches a file entirely outside this plan's `files_modified` and `out_of_scope` boundaries.

## Mutation-Probe Transcript (Task 3, verbatim)

Per the plan's Task 3 action: "record the actual mutation-probe transcript ... in 238-02-SUMMARY.md. Do not assert the mutation in prose only." Full transcript below.

**1. Confirm clean baseline before mutating:**
```
$ git diff --stat lib/mcp/gate-ledger.cjs
(empty)
```

**2. Backup + plant the fault** (commented out the `entry.sessionKey !== ledgerSessionKey(sessionId)` comparison in `consumeGate`, `lib/mcp/gate-ledger.cjs`):
```js
  if (Date.now() - entry.mintedAt > LEDGER_TTL_MS) return null;
  // MUTATION-PROBE: session-key comparison disabled to demonstrate the
  // Case 1 test turns red without it (238-02 Task 3 mutation gate).
  // if (entry.sessionKey !== ledgerSessionKey(sessionId)) {
  //   return { ok: false, reason: 'session_mismatch' };
  // }
  return entry;
```

**3. Run the suite against the mutated file:**
```
$ node tests/test-238-session-scoped-ledger.cjs
test-238-session-scoped-ledger
node:assert:150
  throw new AssertionError(obj);
  ^

AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
+ actual - expected

+ undefined
- false

    at /home/jsagi/dev/MindrianOS-Plugin/tests/test-238-session-scoped-ledger.cjs:31:10
    at ok (/home/jsagi/dev/MindrianOS-Plugin/tests/test-238-session-scoped-ledger.cjs:20:25)
    ...
Node.js v22.23.1
MUTATED exit=1
```
Line 31 is Case 1's `assert.equal(result && result.ok, false)` -- with the comparison disabled, `consumeGate` now returns the raw entry on a cross-session consume instead of `{ok:false, reason:'session_mismatch'}`, so `result.ok` reads `undefined` instead of `false`. Exactly the predicted case failed, nothing else ran (the harness throws on first failed assertion, so Cases 2-10 never executed on this run -- consistent with "exactly Case 1" since it is the first assertion in file order to touch the mismatch path).

**4. Restore byte-identically:**
```
$ cp /tmp/.../scratchpad/gate-ledger-backup.cjs lib/mcp/gate-ledger.cjs
$ git diff --stat lib/mcp/gate-ledger.cjs
(empty)
$ git status --short lib/mcp/gate-ledger.cjs
(empty, clean)
```

**5. Re-run to green:**
```
$ node tests/test-238-session-scoped-ledger.cjs
test-238-session-scoped-ledger
  ok   session A mints, session B consumes -> { ok:false, reason:"session_mismatch" }
  ok   session A mints, session A consumes -> the entry, carrying its minted payload
  ok   single-use even on a session-mismatch reject: the rightful owner's follow-up consume is null
  ok   the ledger no longer carries case1 after either consume attempt
  ok   two null-session callers in ONE process share the same sentinel and can consume each other's gates
  ok   the derived null-session key equals NO_SESSION_PREFIX + process.pid
  ok   D-09: a different process id yields a different no-session key (not a shared literal)
  ok   TTL expiry returns null even when the session matches
  ok   anti-vacuity control: a matched-session consume is truthy, proving the ledger does not reject everything
  ok   a caller-supplied sessionKey cannot override the derived one at mint time

PASS test-238-session-scoped-ledger (10 assertions)
RESTORED exit=0
```

## Test Suite Results (honest report)

- `node tests/test-238-session-scoped-ledger.cjs` -- **PASS, 10/10 assertions, exit 0.**
- `bash tests/run-all-238.sh` -- **exit 0, `PASS=3 FAIL=0 SKIP=6`.** This plan's leg ("238-02 session-scoped ledger (GATE-03 A)") reports **PASSED**. The two regression legs (`209 backstop tuning`, `198 chain run halt`) also PASSED. The 6 SKIPs are 238-03/04/05/06 (x2)/07-08's not-yet-landed legs -- expected, per the aggregator's own `run_if` design (238-01 pre-declared all nine legs before any of them landed).
- `bash tests/run-all-198.sh` -- **exit 1, 12 passed, 1 FAILED.** The one failure is `SPEC-5 hooks/ adapter-only budget` (`scripts/on-stop` is 612 lines against a recorded budget of 570). Confirmed pre-existing and unrelated to this plan: `scripts/on-stop` was last touched by Phase 241 (`c7fb00db`), and neither of this plan's file diffs touches it. Logged to `deferred-items.md`, not fixed (out of scope). This is the ONE plan-level regression check that did not come back fully clean; documented honestly here rather than silently claiming a full pass.
- `git diff --stat <baseline>^ HEAD -- lib/mcp/tools/` -- **empty.** No tool module touched, as the plan requires.
- `node scripts/build-connector-registry.cjs --check` -- **exit 0, `connector-registry: OK`.**

## Issues Encountered

- **Acceptance-criteria grep mismatch (not a defect, documented for the record):** Task 2's acceptance criteria state `grep -c "byId" lib/mcp/gate-render.cjs` should show the `byId`/`byLabel` construction "appearing exactly once in the file." The literal grep count is 4, not 1 -- but this was already true on the pre-task `HEAD` (`git show HEAD:lib/mcp/gate-render.cjs | grep -n byId` also returns 4 lines before this plan's edit). Two of the four lines are the intended construction (now inside `validateChosenAgainstCard`, consolidated from its prior location inside `_resolveChosenIds`); the other two are an unrelated `card.options.find((o) => o.id === t)` local variable named `byId` inside `parseTextReply` (the headless-text rung, a different code path entirely, pre-existing and untouched). The substantive invariant the criterion is actually checking for -- no duplicated `byId`/`byLabel` Set-construction matching logic -- does hold: the construction now exists in exactly one place (`validateChosenAgainstCard`), and the AskUserQuestion rung's own prior copy is gone. Treated as an imprecise acceptance-criteria grep pattern rather than a real gap; not a Rule 1-3 auto-fix since no code needed to change.
- No auth gates, no blocking issues, no architectural decisions required.

## Next Phase Readiness

- **Ready for 238-03 (`gate.cjs`) and 238-04 (`chain.cjs`, Wave 2):** both can now `require('../gate-ledger.cjs')` for `mintGate`/`consumeGate` and `require('./gate-render.cjs').validateChosenAgainstCard` for the `chosen`-against-card check. Export surface matches the plan's `artifacts_this_phase_produces` list exactly.
- **Ready for 238-06:** `mintedGateKinds()` and `ratifiableGateKinds()` are in place for the seam-liveness mint-ratifier wire (`lib/core/seam-liveness.cjs::checkMintRatifierLiveness`).
- **Concern to flag for whichever plan lands last in this phase's docs sweep:** the `scripts/on-stop` line-budget failure (`deferred-items.md`) is still open. It does not block GATE-01/GATE-03/GATE-04 but means `bash tests/run-all-198.sh` will keep reporting exit 1 until a future plan/quick-task addresses it.

---
*Phase: 238-decision-gates*
*Completed: 2026-07-29*

## Self-Check: PASSED

- FOUND: lib/mcp/gate-ledger.cjs
- FOUND: lib/mcp/gate-render.cjs
- FOUND: tests/test-238-session-scoped-ledger.cjs
- FOUND: .planning/phases/238-decision-gates/238-02-SUMMARY.md
- FOUND commit: dc764ace (Task 1)
- FOUND commit: 98a04220 (Task 2)
- FOUND commit: cd063371 (deferred-items docs)
- FOUND commit: 7bb5c22a (Task 3)

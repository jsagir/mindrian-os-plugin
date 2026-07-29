---
phase: 238-decision-gates
plan: 03
subsystem: mcp
tags: [mcp, gate-ledger, session-scoping, gate-render, decision-gates, value-domain-validation]

requires:
  - phase: 238-decision-gates
    plan: "02"
    provides: "lib/mcp/gate-ledger.cjs (mintGate/consumeGate/ledgerSessionKey), lib/mcp/gate-render.cjs::validateChosenAgainstCard"
provides:
  - "lib/mcp/tools/gate.cjs: gate_render and gate_answer re-pointed onto the shared session-keyed ledger, no private _liveGates Map"
  - "gate_answer rejects an out-of-card chosen (reason chosen_not_in_card_options) strictly before any DB open"
  - "gate_answer's tool description matches its real behavior (chain_run-minted gate ids, the chosen reject)"
affects: [238-04, 238-06]

tech-stack:
  added: []
  patterns:
    - "_mintLiveGate/_consumeLiveGate kept as thin named-function wrappers over gateLedger.mintGate/consumeGate so existing tests/test-198-*.cjs _internal reach-throughs keep resolving"
    - "the resolved option ids (validateChosenAgainstCard's return), not the raw submitted chosen array, are what gets persisted into the ratified memory_event"
    - "session id resolved ONCE at the top of gate_answer's handler, reused for both the consume and the room-dir resolution (was resolved AFTER consume before this plan)"

key-files:
  created:
    - tests/test-238-chosen-validation.cjs
  modified:
    - lib/mcp/tools/gate.cjs

key-decisions:
  - "card.kind (already normalized by gate-render.cjs's normalizeCard, defaulting to 'general' unless the caller requested kind:'binding') IS the signal the plan asked for -- the mint wrapper reads it directly from the card object rather than needing a separate boolean the handler would otherwise have to compute and pass in."
  - "normalizeGateAnswer is now called with validChosen (the resolved option ids), not the raw submitted chosen array, so a label that resolved to an id never leaves a raw label string in the persisted memory_event -- mirrors the AskUserQuestion rung's own _resolveChosenIds -> normalizeGateAnswer call shape in gate-render.cjs."
  - "consumeGate's two failure modes (null vs {ok:false, reason:'session_mismatch'}) are distinguished with `!live` then `live.ok === false`, safe because a real ledger entry never carries an `ok` property."

requirements-completed: [GATE-01, GATE-03]

duration: 55min
completed: 2026-07-29
---

# Phase 238 Plan 03: Re-point gate.cjs onto the shared ledger Summary

**`gate_render`/`gate_answer` now mint and consume through `lib/mcp/gate-ledger.cjs` instead of a private Map, and `gate_answer` rejects any `chosen` not among the minted card's own options (`chosen_not_in_card_options`) before the room DB is ever opened, proven by an unchanged `memory_event` row count and a physically-performed mutation-red-then-revert.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3/3 completed
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- `lib/mcp/tools/gate.cjs` no longer holds its own `_liveGates` Map. `gate_render`'s mint and `gate_answer`'s consume both run through the shared, session-scoped `lib/mcp/gate-ledger.cjs` built in 238-02 -- the gate-side half of joining the two ledgers 238-RESEARCH.md's Finding 1 reproduced as disconnected (238-04 does the chain-side half).
- `gate_answer` now validates the submitted `chosen` against the card it actually minted (`gateRender.validateChosenAgainstCard`) strictly before `resolveSessionRoomDir` / `openRoomDbForCaller` / `logMemoryEvent`. An out-of-card `chosen` returns `chosen_not_in_card_options` with `valid_option_ids` echoed, and writes zero rows -- proven by a row-count assertion, not by the error shape alone.
- `gate_answer`'s session id is now resolved ONCE, before the consume (it used to resolve AFTER the consume), so the ledger's session-mismatch check actually has a session id to check against, and the ordering bug the plan named is fixed.
- `gate_answer`'s tool description (the AgentShield-scanned surface, D-10) now states the real behavior: it ratifies a gate id minted through the shared ledger including a `chain_run`-halt-minted id, and an out-of-card `chosen` is rejected before any write.
- `tests/test-238-chosen-validation.cjs`: 5 cases (happy-path anti-vacuity control, the reject, the load-bearing row-count-unchanged proof, label resolution still ratifies, single-use holds after a reject), driving the REGISTERED `gate_render`/`gate_answer` handlers through the `test-198-contract-schema.test.cjs` fake-MCP-server capture seam -- not `gate.cjs`'s internal helpers directly (Pitfall 3 in `238-RESEARCH.md`).

## Task Commits

Each task was committed atomically:

1. **Task 1: Re-point gate.cjs onto the shared session-keyed ledger** - `5ef77961` (feat)
2. **Task 2: Reject an out-of-card chosen before ratification, fix the lying description** - `63e3b11e` (feat)
3. **Task 3: Prove the reject writes nothing, demonstrate the bypass mutation red** - `887bb115` (test)

_No plan-metadata commit for STATE.md/ROADMAP.md -- the orchestrator owns those writes centrally after all 8 plans in this phase complete, per this plan's own objective statement and the known `gsd-tools.cjs` cross-phase corruption bug documented in `.planning/debug/gsd-phase-complete-cross-phase-corruption.md`._

## A note on concurrent-worktree git hygiene

Sibling agents (238-04 on `chain.cjs`, 238-05 on `scripts/check-card-fire.cjs`) ran concurrently in this SAME worktree this wave. The shared git index surfaced the same real hazard TWICE:

1. After `git add lib/mcp/tools/gate.cjs && git commit`, the resulting commit (`e9d0815b`, later corrected to `63e3b11e`) also carried the sibling's then-unstaged `chain.cjs` changes -- the sibling must have run their own `git add` in the window between my `add` and my `commit`.
2. After `git add -f .planning/phases/238-decision-gates/238-03-SUMMARY.md && git commit` for the SUMMARY commit itself, the resulting commit (later corrected to `f1e6d5eb`) also carried the sibling's `.planning/phases/238-decision-gates/238-04-SUMMARY.md` (their own `git add -f` landed in the same narrow window).

Both caught immediately by inspecting `git show --stat HEAD` right after committing (a habit worth keeping every single time in a worktree shared with concurrent siblings, not just once). Both fixed identically: `git reset --soft HEAD~1` (moves the commit pointer back, keeps the index as it was) followed by `git reset HEAD -- <sibling's path>` (unstages only the sibling's file, leaving its working-tree content byte-identical -- confirmed by `md5sum` before and after each fix), then re-committed with only this plan's own file staged. No sibling work was lost, altered, or committed under this plan's authorship after either fix.

## Files Created/Modified

- `lib/mcp/tools/gate.cjs` - `_liveGates`/`LIVE_GATE_TTL_MS` deleted; requires `../gate-ledger.cjs` as `gateLedger`; `_mintLiveGate`/`_consumeLiveGate` are thin wrappers; `gate_render`'s mint/immediate-consume pass the resolved `sessionId`; `gate_answer` resolves `sessionId` before consuming, distinguishes `unknown_or_expired_gate` (null) from `session_mismatch` (`{ok:false}`), rejects an out-of-card `chosen` with `chosen_not_in_card_options` before any DB open, persists the resolved option ids, and carries a corrected tool description.
- `tests/test-238-chosen-validation.cjs` - new test, 5 assertions, plain-Node harness, drives the registered MCP tool handlers.

## Decisions Made

- **`card.kind` is the real binding-vs-general signal, read directly by the mint wrapper.** The plan asked to "use 'binding' when the handler already holds a signal that the rendered card is the binding card, and 'general' otherwise... If the handler holds no such signal, pass 'general' unconditionally." The handler DOES hold that signal: `gate-render.cjs`'s `normalizeCard` already resolves `card.kind` to `'general'` unless the caller explicitly requested `kind:'binding'`, and that normalized card is what flows into `_mintLiveGate`. So `_mintLiveGate(gateId, card, sessionId)` reads `card.kind` directly inside the wrapper rather than the tool handler computing a separate boolean and passing it in -- simpler, and the ledger's `kind` claim tracks the actual normalized card instead of a second, potentially-drifting computation. The plan's fallback clause ("no such signal -> 'general' unconditionally") was not needed because the signal exists.
- **`normalizeGateAnswer` is called with `validChosen` (the validator's resolved option ids), not the raw `chosen` array.** Not explicitly spelled out in the plan's action text, but required by Case 4 (label resolution) staying honest end to end: `gate-render.cjs`'s own AskUserQuestion rung already does exactly this (`_resolveChosenIds` -> `normalizeGateAnswer`), so a submitted label resolves to its option id before persistence there. Doing the same here means the `gate_answer` path and the AskUserQuestion path persist the identical shape for the identical input, and a raw label string never lands in a `memory_event` row.
- **The two `consumeGate` failure modes are told apart with `!live` then `live.ok === false`.** Safe because a real ledger entry (the `Object.assign` result in `gate-ledger.cjs::mintGate`) never carries an `ok` key -- only the constructed mismatch-rejection object does.

## Deviations from Plan

None affecting the plan's own artifacts or acceptance criteria. The concurrent-worktree commit-contamination incident (see the git-hygiene note above) was a process hazard from sibling-agent concurrency, not a plan deviation, and was caught and corrected before any sibling work was lost or misattributed.

## Mutation-Probe Transcript (Task 3, verbatim)

Per the plan's Task 3 action: "The executor must physically perform that mutation, run this file, observe exactly those cases fail, restore lib/mcp/tools/gate.cjs byte-identically ... and re-run to green. Transcribe the commands and their observed output." Full transcript below.

**1. Confirm clean baseline before mutating:**
```
$ git diff --stat lib/mcp/tools/gate.cjs
(empty)
$ cp lib/mcp/tools/gate.cjs /tmp/.../scratchpad/gate-backup.cjs
backup made
```

**2. Plant the fault** (short-circuited the reject in `gate_answer`, `lib/mcp/tools/gate.cjs`):
```js
      const validChosen = gateRender.validateChosenAgainstCard(live.card, chosen);
      // MUTATION-PROBE: the reject is disabled to demonstrate Cases 2 and 3
      // turn red without it (238-03 Task 3 mutation gate).
      if (false && !validChosen) {
        ...
      }
```

**3. Run the suite against the mutated file:**
```
$ node tests/test-238-chosen-validation.cjs
test-238-chosen-validation
  ok   case 1 (anti-vacuity control): a valid chosen ratifies and writes exactly one memory_event row
FAIL: test-238-chosen-validation -- AssertionError [ERR_ASSERTION]: reject response must be ok:false

true !== false

    at .../tests/test-238-chosen-validation.cjs:158:14
    at ok (.../tests/test-238-chosen-validation.cjs:42:25)
    at main (.../tests/test-238-chosen-validation.cjs:157:5)
MUTATED exit=1
```
Case 1 (the anti-vacuity control) still passed, correctly -- the mutation does not disable ratification, only the reject. Case 2 failed exactly as predicted: with the reject short-circuited, `validateChosenAgainstCard` still runs and still returns `null` for the made-up option, but nothing acts on that `null` anymore, so the handler falls through to `normalizeGateAnswer(gate_id, validChosen, verdict)` with `validChosen === null`, which collapses to an empty `chosen: []` array and still returns `ok:true, ratified:true` -- the exact "an arbitrary string ratifies" defect GATE-01 G-2 exists to close. The harness throws on first failed assertion (same design as `tests/test-209-backstop-tuning.cjs` and 238-02's own mutation probe), so Case 3 never ran on this pass -- consistent with "Cases 2 and 3" both depending on the same disabled reject, Case 2 being first in file order.

**4. Restore byte-identically:**
```
$ cp /tmp/.../scratchpad/gate-backup.cjs lib/mcp/tools/gate.cjs
$ git diff --stat lib/mcp/tools/gate.cjs
(empty)
$ git status --short lib/mcp/tools/gate.cjs
(empty, clean)
```

**5. Re-run to green:**
```
$ node tests/test-238-chosen-validation.cjs
test-238-chosen-validation
  ok   case 1 (anti-vacuity control): a valid chosen ratifies and writes exactly one memory_event row
  ok   case 2 (the reject): an out-of-card chosen returns reason:chosen_not_in_card_options with isError set
  ok   case 3 (load-bearing): the rejected call writes ZERO new memory_event rows (row count unchanged)
  ok   case 4: answering with the option LABEL (not the id) still ratifies, resolved to the option id
  ok   case 5: the gate is burned either way -- a follow-up correct answer to the same gate_id returns unknown_or_expired_gate
PASS test-238-chosen-validation (5 assertions)
RESTORED exit=0
```

## Source-Order Proof (reject precedes persistence)

Per the plan's acceptance criteria, the `grep -n` line numbers proving the reject runs strictly before any DB open, taken after Task 2 landed:

```
$ grep -n "validateChosenAgainstCard" lib/mcp/tools/gate.cjs
213:      const validChosen = gateRender.validateChosenAgainstCard(live.card, chosen);
$ grep -n "openRoomDbForCaller" lib/mcp/tools/gate.cjs
211:      // resolveSessionRoomDir / openRoomDbForCaller / logMemoryEvent below,
233:      const db = navigation.openRoomDbForCaller(roomDir);
$ grep -n "logMemoryEvent" lib/mcp/tools/gate.cjs
211:      // resolveSessionRoomDir / openRoomDbForCaller / logMemoryEvent below,
239:        logResult = navigation.logMemoryEvent(db, 'mcp_client_event_logged', {
$ grep -n "normalizeGateAnswer" lib/mcp/tools/gate.cjs
228:      // AskUserQuestion rung's own _resolveChosenIds -> normalizeGateAnswer
230:      const answer = gateRender.normalizeGateAnswer(gate_id, validChosen, verdict);
```
`validateChosenAgainstCard` (line 213, the CODE line) is strictly less than the first CODE occurrence of `openRoomDbForCaller` (line 233) and `logMemoryEvent` (line 239); `normalizeGateAnswer`'s CODE call (line 230) is strictly greater than 213. (The 211 hits are a comment line naming all three, not a code call, and land before all of them either way.)

## Test Suite Results (honest report)

- `node tests/test-238-chosen-validation.cjs` -- **PASS, 5/5 assertions, exit 0.**
- `bash tests/run-all-238.sh` -- **`PASS=5 FAIL=2 SKIP=2`.** This plan's own leg (`238-03 gate_answer chosen validation (GATE-01 G-2)`) reports **PASSED**. The two regressions (`209 backstop tuning`, `198 chain run halt`) also PASSED. The two FAILs (`238-04 chain resume chosen validation`, `238-05 retry counter fence`) and the two SKIPs (`238-06` x2) belong to sibling plans in this wave that had not yet finished landing at the moment this suite was run in this shared worktree -- not this plan's files, not this plan's scope.
- `bash tests/run-all-198.sh` -- **12 passed, 1 FAILED (`SPEC-5 hooks/ adapter-only budget`, `scripts/on-stop` line-count).** Confirmed pre-existing per 238-02-SUMMARY.md: `scripts/on-stop` was last touched by Phase 241, untouched by this plan's diffs. Not fixed here (out of scope, already logged to `deferred-items.md` by 238-02).
- `node scripts/build-connector-registry.cjs --check` -- **exit 0, `connector-registry: OK`** (run after both Task 1 and Task 2).
- `git diff -U0 lib/mcp/tools/gate.cjs | grep '^+' | grep -cP '\x{2014}'` -- **0**, both commits.
- `git diff -U0 lib/mcp/tools/gate.cjs | grep '^+' | grep -c 'resolveSessionRoomDir'` -- **0** (the room-resolution ladder was not touched).
- `git diff --stat lib/mcp/tools/chain.cjs` for this plan's own commits -- **empty**, confirmed via `git show --stat` on each of `5ef77961`, `63e3b11e`, `887bb115`.

## Issues Encountered

- **Concurrent-worktree commit contamination (caught and fixed, see the git-hygiene note above).** Not a defect in this plan's own code; a process hazard from the shared git index across concurrently-running sibling agents in the same worktree, corrected before any sibling work was affected.
- No auth gates, no blocking issues, no architectural decisions required.

## Next Phase Readiness

- **238-04** (chain.cjs, Wave 2, running concurrently this wave) re-points `chain.cjs`'s own resume ledger and `_resumeFromGateAnswer`'s `chosen` handling onto the same `lib/mcp/gate-ledger.cjs` and `validateChosenAgainstCard` this plan already exercises on the `gate.cjs` side -- both tool modules now share one ledger implementation, closing 238-RESEARCH.md's Finding 1 from both ends once 238-04 lands.
- **238-06** (mint-ratifier seam liveness) can now enumerate `gate.cjs`'s minted kinds honestly: `_mintLiveGate` mints with `card.kind`, which is `'general'` unless the caller explicitly requested `'binding'` -- matching `gateLedger.ratifiableGateKinds()`'s frozen `['general', 'binding', 'material_step']` list.

---
*Phase: 238-decision-gates*
*Completed: 2026-07-29*

## Self-Check: PASSED

- FOUND: lib/mcp/tools/gate.cjs
- FOUND: tests/test-238-chosen-validation.cjs
- FOUND: .planning/phases/238-decision-gates/238-03-SUMMARY.md
- FOUND commit: 5ef77961 (Task 1)
- FOUND commit: 63e3b11e (Task 2)
- FOUND commit: 887bb115 (Task 3)

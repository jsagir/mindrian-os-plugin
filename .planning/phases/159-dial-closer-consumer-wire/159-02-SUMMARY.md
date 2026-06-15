---
phase: 159-dial-closer-consumer-wire
plan: 02
subsystem: dial-decision-loop
tags: [dial, turn-start, consumer, intent-classifier, part4, part8, part9, tri-polar, tdd]
requires:
  - "lib/workflow/f1-pick-consumer.cjs::consumeF1Pick (Phase 159-01)"
  - "lib/hmi/f1-pick-capture-cli.cjs::captureCliPick (Phase 159-01)"
  - "lib/core/navigation.cjs::openRoomDbForCaller / closeRoomDbForCaller (Phase 109)"
  - "scripts/intent-classifier.cjs f1_closer_payload producer block (Phase 135-03 / 158-01)"
provides:
  - "scripts/intent-classifier.cjs::consumePriorF1Pick (the turn-start consumer attachment, exported)"
  - "additive f1_closer_payload.framework producer field (the generic handle the consumer needs to write the decision edge)"
affects:
  - "Wave 3 (159-03): the integration test drives consumePriorF1Pick end to end + run-all-159.sh gate"
  - "Phase 158 computeReachPenalties now reads REAL recorded rejects from a live dial loop"
tech-stack:
  added: []
  patterns:
    - "best-effort lazy-require + try/catch turn-start consumer (mirrors the producer :1806-1855 idiom)"
    - "navigation.openRoomDbForCaller open + closeRoomDbForCaller in a finally (Part 9 caller-owns-the-handle)"
    - "FIX-05 additive post-build payload mutation idiom cloned for the framework handle"
    - "decision-trace FILE read (system bookkeeping file, NOT room data) mirroring appendTraceTurnNumber :1633"
key-files:
  created:
    - "tests/test-159-turn-start-wiring.cjs"
  modified:
    - "scripts/intent-classifier.cjs"
decisions:
  - "the turn-start consumer attaches in the require.main self-exec arm right after sessionId resolves, BEFORE emitEngineDecisionBlock (HOW-4: read side of the turn)"
  - "the offer's GENERIC framework handle is carried additively onto the persisted f1_closer_payload (load-bearing: recordSelectorDecision writes target_id=framework:<handle>; without it no row can be written) -- same FIX-05 additive idiom; reachIds/verbs/sentence keying untouched"
  - "navigation.cjs is lazy-required inside the helper (navigationMod is function-local elsewhere, not module-scope)"
metrics:
  duration: "~40m"
  completed: "2026-06-15"
  tasks: 1
  files: 2
---

# Phase 159 Plan 02: dial-closer-consumer-wire Wave 2 Summary

The dead `f1_closer_payload` is now read back at turn start in production: `scripts/intent-classifier.cjs` gains a best-effort, exported `consumePriorF1Pick(roomDir, sessionId, answer)` that reads the PRIOR turn's persisted payload from the decision-trace file, captures the navigator's pick via `captureCliPick` (raw text confined to the FIX-05 LOCAL sentence lane), opens a caller-owned `room.db` ONLY through `navigation.openRoomDbForCaller`, routes the pick through the Wave-1 `consumeF1Pick`, and ALWAYS closes the handle in a `finally` (Part 9, no leak) -- wrapped so a non-dial / cold / faulted turn is byte-unchanged from today (DCW-04).

## What shipped (Task 1, TDD)

| Gate | What | Commit | Files |
| ---- | ---- | ------ | ----- |
| RED | failing turn-start wiring suite (export + read-records + byte-unchanged + Part 9) | `92ce3dff` | tests/test-159-turn-start-wiring.cjs |
| GREEN | consumePriorF1Pick attachment + additive framework carry on the producer payload | `99a4d163` | scripts/intent-classifier.cjs, tests/test-159-turn-start-wiring.cjs |

(No REFACTOR commit: the GREEN code is already minimal thin glue; no cleanup was warranted.)

## The turn-start consumer (HOW-4)

`consumePriorF1Pick`:

1. Reads `path.join(roomDir,'.mindrian','decision-traces',sessionId+'.json')`, takes the LAST trace entry's `f1_closer_payload` (the same file `appendTraceTurnNumber` reads at :1633 -- the system's own bookkeeping file, NOT room data, so the `fs` read is Part 9 legal; Part 9 governs room.db).
2. No-ops immediately when no `f1_closer_payload` exists (the byte-unchanged guarantee for non-dial turns, DCW-04).
3. Lazy-requires `f1-pick-capture-cli.cjs`, `f1-pick-consumer.cjs`, and `navigation.cjs` in a try/catch (a load failure degrades to a no-op).
4. Captures the pick from the current turn answer via `captureCliPick` (deterministic enum match; raw text -> the optional `sentence` LOCAL lane only).
5. Opens a caller-owned `room.db` via `navigation.openRoomDbForCaller(roomDir)`, calls `consumeF1Pick({priorPayload, pick, roomState:{db, roomDir, offer}})`, and closes via `navigation.closeRoomDbForCaller` in a `finally`.
6. The WHOLE body is wrapped in try/catch -> a fault returns `{ok:false, reason}` and NEVER throws (DCW-04).

It is called from the `require.main === module` self-exec arm, right after `sessionId` resolves and BEFORE `emitEngineDecisionBlock`, gated on a non-empty `STDIN_MESSAGE`, in its own best-effort try/catch.

## Wire-2 precondition (DCW-08)

The grounding->verb map on the producer side (`:1994-2005`) already keys `reachIds` by a frozen `REACH_IDS` member when a sensor reach drove the fire; non-reach groundings forward as-is and are dropped by the downstream `recordSelectorDecision` enum-gate -> unkeyed write, never mis-keyed. The consumer reads the persisted `reachIds` verbatim, so keyed-or-unkeyed-never-mis-keyed holds by construction. Untouched this wave.

## Test results

| Suite | Result |
| ----- | ------ |
| tests/test-159-turn-start-wiring.cjs | PASS (5 checks: export, keyed-reject record, byte-unchanged no-op x2, missing-db no-op, Part 9 chokepoint-only) |
| tests/test-150-render-unlock.cjs (intent-classifier regression) | PASS (incl. no-em-dash gate) |
| tests/run-all-158.sh (regression) | PASS (14/14) |
| tests/run-all-148.sh (frozen-148 regression) | PASS (18/18) |
| tests/test-159-consume-f1-pick.cjs (Wave-1 regression) | PASS (6 checks) |
| tests/test-159-cli-capture-adapter.cjs (Wave-1 regression) | PASS (4 checks) |
| tests/test-159-closeoffer-reachid-forward.cjs (Wave-1 regression) | PASS (4 checks) |

## DCW-04 byte-unchanged proof (the checkpoint invariant)

A live hook spawn on a NON-DIAL turn (no prior `f1_closer_payload`), comparing the pre-159-02 baseline (`origin/main:scripts/intent-classifier.cjs`) against the 159-02 code:

```
echo '{"prompt":"tell me about market sizing"}' | node scripts/intent-classifier.cjs
```

Result: baseline stdout (0 bytes) + stderr (0 bytes) + exit 0 are BYTE-IDENTICAL to the 159-02 stdout + stderr + exit 0. The consumer block emits nothing and writes nothing when there is no prior payload.

## must_have truths satisfied

- Turn start reads the PRIOR turn's persisted `f1_closer_payload` and routes the pick through `consumeF1Pick` over a navigation-chokepoint-owned `room.db` handle. (Test 1)
- The wiring is best-effort (try/catch); missing/old payload, missing room.db, or unmatched pick degrades to a no-op and never disrupts the prompt. (Tests 2-3; the source-level try/catch + finally)
- Every non-dial turn is byte-unchanged: the consumer emits nothing and writes nothing with no prior payload. (Test 2 + the live baseline diff)
- Wire-2 precondition holds (keyed or unkeyed, never mis-keyed). (Producer map untouched; consumer reads reachIds verbatim, DCW-08)
- The room.db handle is opened/closed through `navigation.openRoomDbForCaller` / `closeRoomDbForCaller` in a finally (no leak, Part 9). (Test 4 source assertion)

## Deviations from Plan

### Auto-added critical functionality

**1. [Rule 3 - Blocking] Carry the offer's generic framework handle onto the persisted f1_closer_payload**
- **Found during:** Task 1 GREEN (the reject path returned `invalid_framework`).
- **Issue:** `recordSelectorDecision` hard-requires a non-empty `framework` because the decision edge `target_id` is `framework:<framework>` (selector-decisions.cjs:184,277). The producer persists `f1_closer_payload` (verbs / reachIds / sentence) but NOT the offer's framework, and the framework is not reliably recoverable at consume time (the command-resolver returns `[]` for the dial commands). Without the framework the consumer structurally cannot write ANY accept/defer/reject row, defeating the entire phase.
- **Fix:** Carry `f1Payload.framework = offerForF1.framework` (a generic methodology name, never user content -- Part 8 safe) using the IDENTICAL additive post-build mutation idiom as the FIX-05 `f1Payload.sentence` carry directly above it. The persist mechanism and the `reachIds` / `verbs` keying are untouched; this is an additive generic-handle field, not a change to the existing persisted shape's semantics.
- **Files modified:** scripts/intent-classifier.cjs (the single line + comment beside the FIX-05 sentence carry).
- **Commit:** `99a4d163`
- **Constraint note:** the plan said "do NOT touch the producer block's persist behavior." This change adds ONE additive field via the same idiom the producer already uses for `sentence`; it does not alter the reachIds/verbs keying, the persist mechanism, or any frozen contract. The DCW-04 byte-unchanged proof confirms non-dial turns are unaffected. Flagged here for the human-verify checkpoint.

## Frozen-contract / sibling integrity

- The producer block's reach_presented emit (:1503-1547), the 158 penalty fold (:1561-1582), and the grounding->verb map (:1994-2005) are UNTOUCHED.
- No frozen-148 constant, the 0.40/0.30/0.30 weights, or closer outcome semantics touched. run-all-148 (18/18) + run-all-158 (14/14) green.
- Zero new dependencies (Phase 87 invariant). CJS, no em-dashes (verified).

## What Wave 3 (the integration test) must know

**Exported turn-start helper name + signature:**
```
consumePriorF1Pick(roomDir, sessionId, currentTurnAnswer)
  -> { ok, recorded?, reason?, outcome?, reach_id? }
```
- `roomDir`: the active room directory (the trace file is read at `<roomDir>/.mindrian/decision-traces/<sessionId>.json`).
- `sessionId`: the decision-trace session id (the same `resolveSessionId` value the producer uses).
- `currentTurnAnswer`: the AskUserQuestion F.1 answer shape `captureCliPick` accepts: `{ selectedOption: <verb label>, outcome?: accept|defer|reject|Free-Text, text?: <raw navigator text, LOCAL lane only> }`. On the live hook the attachment passes `{ selectedOption: STDIN_MESSAGE, text: STDIN_MESSAGE }`; an unmatched selectedOption -> the consumer no-ops.
- Returns the `consumeF1Pick` result verbatim: `{ ok:true, recorded:true, outcome, reach_id? }` on a recorded pick; a structured no-op `{ ok:false, reason }` (`no_room` / `no_prior_payload` / `consumer_unavailable` / `unmatched` / `invalid_db` / `invalid_framework` / `consumer_threw`) on every cold / non-dial / faulted turn. NEVER throws.
- **Precondition for a recorded row:** the prior trace's `f1_closer_payload` must carry both `reachIds[verb]` (for the keyed reach_id) AND `framework` (for the decision edge target). The producer now persists both. The integration test's 2-turn driver must persist a payload with `framework` so turn N+1 writes a keyed row -- exactly the shape `payloadReachGrounded()` builds in tests/test-159-turn-start-wiring.cjs.
- `run-all-159.sh` (Wave 3) should list this suite (`test-159-turn-start-wiring.cjs`) alongside the Wave-1 suites and the run-all-158 / run-all-148 passthroughs.

## Self-Check: PASSED

- Created file: tests/test-159-turn-start-wiring.cjs FOUND on disk.
- Modified file: scripts/intent-classifier.cjs exports consumePriorF1Pick (verified).
- Commits: 92ce3dff (RED), 99a4d163 (GREEN) both FOUND in git log.
- DCW-04 byte-unchanged: baseline vs 159-02 non-dial stdout+stderr byte-identical (verified live).
- No em-dashes in any changed file (verified).
- Part 9: helper opens/closes only via navigation chokepoint, finally-close (Test 4 + source review).

## TDD Gate Compliance

- RED gate: `test(159-02)` commit `92ce3dff` (failing suite, export absent).
- GREEN gate: `feat(159-02)` commit `99a4d163` (suite passes).
- No REFACTOR commit (none needed).

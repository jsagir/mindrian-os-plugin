---
phase: 159-dial-closer-consumer-wire
verified: 2026-06-15T22:40:00Z
status: passed
score: 10/10 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  note: "initial verification"
---

# Phase 159: dial-closer-consumer-wire Verification Report

**Phase Goal:** Wire the turn-N+1 consumer that reads the prior turn's persisted F.1 closer payload, matches the navigator's pick, and routes accept/defer/reject/Free-Text into `closeOffer` -> `recordSelectorDecision` with `reach_id` forwarded -- so the dial decision loop records to `room.db` in production, making Phase 158's `computeReachPenalties` read a REAL signal (was structurally always 0, suppression never fired).
**Verified:** 2026-06-15
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths (the 10 acceptance criteria)

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| DCW-01 | Turn-N+1 consumer exists and routes the pick; 2-turn driver writes exactly one row; no prior payload writes zero + no error | VERIFIED | `lib/workflow/f1-pick-consumer.cjs::consumeF1Pick` + `scripts/intent-classifier.cjs::consumePriorF1Pick` (read at :1688). Integration Test 1 asserts EXACTLY one `f_selector_decision` row from the live consumer. `consumeF1Pick` returns structured `{ok:false,reason:'no_prior_payload'}` on cold turn (lines 127-129); never throws. |
| DCW-02 | reach_id forwarded on the write; reach-grounded -> keyed row, non-reach -> unkeyed (byte-stable) | VERIFIED | `offer-closer.cjs:363-365` forwards optional `reach_id` into `decisionArgs` additively (Phase 159 diff +23/-1). `test-159-closeoffer-reachid-forward.cjs` passes 4 checks: keyed, off-set dropped, no-reach byte-stable. |
| DCW-03 | Full loop accept/defer/reject/Free-Text all recorded; reject NOT coerced to accept | VERIFIED | `consumeF1Pick` passes the OUTCOME keyword (`closeArgs.pick = outcome`, line 191-194) NEVER the verb. `_normalizePick` (offer-closer.cjs:235) DOES fall through any verb to 'accept' -- confirming the MEDIUM-2 guard is load-bearing. `test-159-consume-f1-pick.cjs` Test 1 asserts `props.decision === 'reject'` AND `props.reach_id === 'deep_research'` on the reject row (lines 114-115). Free-Text routes to recordSelectorMiss. |
| DCW-04 | Graceful no-op on non-dial/unmatched/cold turns; non-dial turn byte-unchanged | VERIFIED | INDEPENDENTLY re-proven: built `origin/main` baseline INSIDE `scripts/`, ran a non-dial turn through both; stdout byte-identical (326 bytes each), stderr identical modulo non-deterministic node PID in the SQLite experimental warning, exit 0 both. File IS modified (+185 lines) yet non-dial behavior unchanged. Turn-start helper wrapped in try/catch, never throws (:1790-1794). |
| DCW-05 | Part 8: pick text never egresses; seeded secret never lands in a row value | VERIFIED | `test-159-part8-secretreason-sweep.cjs` seeds `SECRETREASON159` into pick text, drives the real consumer path, reads back EVERY `f_selector_decision` + `memory_event` row value via the chokepoint, asserts marker in ZERO; source backstop confirms no `buildBrainPacket`/Brain/network forward in the consumer files. Pick text rides the FIX-05 LOCAL sentence lane. PASS. |
| DCW-06 | Part 9: consumer + turn-start path read/write room.db only via navigation.cjs; consumer opens no db | VERIFIED | `f1-pick-consumer.cjs` has zero direct `better-sqlite3`/`node:sqlite`/`fs` room-db handle (only a comment-block mention). Turn-start helper opens via `nav.openRoomDbForCaller` and closes in a `finally` via `nav.closeRoomDbForCaller` (:1754-1788). The trace-FILE read is the system's own bookkeeping file (same as appendTraceTurnNumber), Part 9-legal. |
| DCW-07 | CLI live + tested; Desktop/Cowork seam doc exists; deferral recorded | VERIFIED | `lib/hmi/f1-pick-capture-cli.cjs::captureCliPick` live + exercised by the integration test (CLI path). `docs/F1-PICK-CAPTURE-ADAPTER-SEAM.md` (7378 bytes) documents the seam contract. Deferral recorded in `deferred-items.md` (DI-159-01). |
| DCW-08 | Wire 2: grounding resolves to frozen reach_id or degrades cleanly, never mis-keyed | VERIFIED | Producer grounding->verb map (intent-classifier :1994-2005) keys `reachIds` by frozen `REACH_IDS` member; consumer reads `reachIds[verb]` verbatim; offer-closer adds NO membership check -- off-set reach_id dropped by the downstream `recordSelectorDecision` REACH_IDS enum-gate. `test-159-closeoffer-reachid-forward.cjs` Test 2 asserts off-set `not_a_reach` stores NO reach_id. |
| DCW-09 | Scripted 2-turn integration test proves 158 fires LIVE; 3 REAL rejects -> reach ABSENT; RED on consumer removal | VERIFIED | `test-159-integration-2turn-suppress.cjs` drives the REAL `consumePriorF1Pick` over REAL decision-trace files + real room.db, records 3 REAL keyed reject rows, satisfies M-floor with REAL `reach_presented` rows via `navigation.logMemoryEvent`. MEDIUM-1: `roomState` passed to `computeReachPenalties` asserted (via `hasOwnProperty`) to carry NO `presentationsCount` / NO `rejectCountInWindow` key -- so readers provably read the DB (confirmed: readers fall through to `findRecentChanges` when keys absent). `deep_research` ABSENT from `buildReachList`. RED-on-removal INDEPENDENTLY re-proven: neutering `consumeF1Pick` -> suite exit 1; restore -> exit 0. |
| DCW-10 | Frozen contracts + 158 stay green; no frozen constant edited; 0.40/0.30/0.30 weights untouched | VERIFIED | Phase-159-only production diff = exactly 4 files (2 new consumer files + offer-closer.cjs +23/-1 + intent-classifier.cjs +185). `reach-reject-reader.cjs`, `dial-reach-orchestrator.cjs`, `sensor-types.cjs` NOT touched by Phase 159. `closeReach` sibling untouched (last commit 158-01). `run-all-159.sh` carries `run-all-158.sh` (14/14) + `run-all-148.sh` (18/18) passthroughs, both green. |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `lib/workflow/f1-pick-consumer.cjs` | turn-N+1 shared-core consumer | VERIFIED | 232 lines, real impl, MEDIUM-2 two-channel split, no direct db |
| `lib/hmi/f1-pick-capture-cli.cjs` | CLI capture adapter + seam contract | VERIFIED | 131 lines, captureCliPick + CAPTURE_ADAPTER_CONTRACT |
| `lib/workflow/offer-closer.cjs` (mod) | reach_id forward into decisionArgs | VERIFIED | +23/-1 additive; lines 363-365 |
| `scripts/intent-classifier.cjs` (mod) | turn-start consumePriorF1Pick attachment | VERIFIED | +185; exported; attached in self-exec arm gated on STDIN_MESSAGE |
| `tests/test-159-integration-2turn-suppress.cjs` | DCW-09 live proof | VERIFIED | 375 lines; RED-on-removal independently confirmed |
| `tests/run-all-159.sh` | one-command phase gate | VERIFIED | exit 0; 159 10/10 + 158 14/14 + 148 18/18 |
| `docs/F1-PICK-CAPTURE-ADAPTER-SEAM.md` | Desktop/Cowork seam doc | VERIFIED | 7378 bytes |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| intent-classifier turn-start | consumeF1Pick | consumePriorF1Pick(roomDir,sessionId,answer) | WIRED | called in require.main arm, best-effort try/catch |
| consumeF1Pick | closeOffer | closeArgs.pick = OUTCOME keyword | WIRED | MEDIUM-2: never the verb; reach_id forwarded on REACH channel |
| closeOffer | recordSelectorDecision | decisionArgs.reach_id (enum-gated) | WIRED | off-set dropped, never mis-keyed |
| recorded reject rows | computeReachPenalties | DB read via findRecentChanges | WIRED | readers fall through to DB when roomState counter keys absent |
| computeReachPenalties | buildReachList | suppressedReachIds | WIRED | 3 real rejects -> deep_research absent |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Phase gate exits 0 | `bash tests/run-all-159.sh` | exit 0; 159:10/10, 158:14/14, 148:18/18 | PASS |
| DCW-09 RED-on-removal | neuter consumeF1Pick, run integration test | exit 1 (neutered) -> exit 0 (restored) | PASS |
| DCW-04 byte-unchanged | non-dial turn vs origin/main baseline built inside scripts/ | stdout byte-identical (326b), stderr identical modulo PID, exit 0 | PASS |
| Anti-vacuous readers | inspect reach-reject-reader.cjs | readers read DB via findRecentChanges when roomState lacks counter keys | PASS |

### Probe Execution

| Probe | Command | Result | Status |
| --- | --- | --- | --- |
| `tests/run-all-159.sh` | `bash tests/run-all-159.sh` | exit 0 | PASS |
| `tests/test-159-integration-2turn-suppress.cjs` (neutered) | neuter + node | exit 1 | PASS (RED confirmed) |

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX` debt markers in the 4 production files. The consumer's no-op returns (`return { ok: false, reason }`) are intentional graceful degradation (DCW-04), not stubs -- the success path writes real rows (proven by the integration test). No em-dashes. Zero new dependencies.

### Human Verification Required

None. The phase goal is verifiable programmatically: the live producer->consumer->penalty loop is proven by the deterministic 2-turn integration test (RED-on-removal independently confirmed), DCW-04 byte-stability is proven by direct baseline comparison, and the gate exits 0. The deferred Desktop/Cowork LIVE conversational capture (DI-159-01) is explicitly OUT of scope per the SPEC; the CLI path is in scope and tested.

### Gaps Summary

No gaps. All 10 acceptance criteria VERIFIED against actual code + independently re-run tests. The two plan-checker-flagged criteria both hold:
- **DCW-09 (live proof, non-vacuous):** the integration test drives the REAL Wave-2 helper over real trace files + real room.db, uses REAL reach_presented + reject rows (NOT the 158 roomState injection seam), asserts via `hasOwnProperty` that the `roomState` handed to `computeReachPenalties` carries NO injected-counter keys (so suppression reads the DB), and proves 3 real rejects -> reach ABSENT. RED-on-consumer-removal independently reproduced (neuter -> exit 1).
- **DCW-03 + MEDIUM-2 guard:** `consumeF1Pick` passes the OUTCOME keyword as `closeOffer({pick})`, never the matched verb; `_normalizePick` confirmed to coerce any verb to 'accept' (so the guard is load-bearing); the test asserts `decision === 'reject'` AND `reach_id` on the reject row.

## Net Outcome (plain language)

A navigator who rejects the same dial reach 3 times in a real room now causes that reach to drop out of the rendered top-K on the next turn -- driven by the LIVE turn-start consumer recording REAL keyed reject rows to room.db, not by injected test counters. **Phase 158 is now LIVE in production: it is no longer inert.** Before this phase the producer persisted `f1_closer_payload` but nothing read it back, so no `f_selector_decision` row was ever written from the dial and `computeReachPenalties` structurally always read 0. Phase 159 wires the missing read half end to end and proves the loop fires.

## Follow-up Items (deferred, not gaps)

- **DI-159-01:** LIVE Desktop/Cowork conversational pick-capture -- seam documented (`docs/F1-PICK-CAPTURE-ADAPTER-SEAM.md` + exported `CAPTURE_ADAPTER_CONTRACT`); a future phase implements an adapter feeding the same shared-core consumer. CLI is live + tested.
- **DI-159-04 (Wire 3 finding):** the live producer->consumer->penalty loop only runs on the active engine arm (`navigation-engine.cjs decide()` flips routing_source legacy->engine). This phase proves the loop is CORRECT end to end; it does NOT change engine-activation frequency. If engine activation is rare in real rooms the live loop runs rarely -- a bound on frequency, not a correctness gap. A future validation should measure real-room engine-activation rate.
- **DI-159-02:** Re-routing the ignite/B3 `closeReach` sibling through the shared consumer -- additive, only if a later phase needs it.
- **DI-159-03:** The dormant `_applyDecayWeight` command-rail -- separate latent follow-up, untouched.

---

_Verified: 2026-06-15T22:40:00Z_
_Verifier: Claude (gsd-verifier)_

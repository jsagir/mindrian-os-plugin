---
phase: 289-seed-020-apply-shape-f-askuserquestion-card-as-the-universal-mindrian-ui
plan: 05
subsystem: mcp-gate
tags: [gate-ledger, consume-after-checks, peekGate, owner-after-stranger, d-04]
requires: [289-02]
provides:
  - "peekGate(gateId, sessionId): non-consuming ledger read with the same TTL and session contract"
  - "consumeGate checks the session before its one delete; a refused stranger never burns the owner's gate"
  - "gate_answer and chain_run resume peek, run every refusal, then consume"
affects: [289-07, 369-07, 369-21, 369-26]
tech-stack:
  added: []
  patterns: ["peek, refuse, then take (consume immediately before the first write, no await between)"]
key-files:
  created: []
  modified:
    - lib/mcp/gate-ledger.cjs
    - lib/mcp/tools/gate.cjs
    - lib/mcp/tools/chain.cjs
    - tests/test-238-session-scoped-ledger.cjs
    - tests/test-238-chosen-validation.cjs
    - tests/test-238-chain-chosen-validation.cjs
    - tests/test-354-concurrency-surfaces.cjs
key-decisions:
  - "consumeGate computes expired and mismatch first, returns session_mismatch on a live mismatch, then runs the one _ledger.delete(; an expired entry reads null for every caller and is cleared"
  - "The binding-kind no-room branch consumes inside its branch (a valid answer that writes nothing); the normal path consumes after openRoomDbForCaller returns a db and before the try that calls logMemoryEvent"
  - "A defensive falsy/ok:false check follows each consume (nothing can interleave in the synchronous stretch)"
requirements-completed: [LEDGER289-01, LEDGER289-02, LEDGER289-03, LEDGER289-04, LEDGER289-05]
duration: 55 min
completed: 2026-10-04
---

# Phase 289 Plan 05: consume after the checks Summary

A refused gate answer is now side-effect free: the ledger checks the session before its one delete, and `gate_answer` and chain_run's resume peek, run every refusal, then consume immediately before the first write.

## Tasks and commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | peekGate and the consumeGate reorder, owner-after-stranger arm | f681ddf68 | lib/mcp/gate-ledger.cjs, tests/test-238-session-scoped-ledger.cjs |
| 2 | gate_answer peeks, refuses, then consumes before the first write | eee25f512 | lib/mcp/tools/gate.cjs, tests/test-238-chosen-validation.cjs, tests/test-354-concurrency-surfaces.cjs |
| 3 | chain_run resume peeks, refuses, then consumes | 15187a7b7 | lib/mcp/tools/chain.cjs, tests/test-238-chain-chosen-validation.cjs |

## What was built

- **gate-ledger.cjs**: `consumeGate` (two params) reads the entry, computes `expired` and `mismatch`, returns `{ ok:false, reason:'session_mismatch' }` without deleting on a live mismatch, then runs the single `_ledger.delete(gateId)`. `peekGate(gateId, sessionId)` has the same contract and never mutates. Exported. The 369-07 text rule holds (first `_ledger.delete(` at offset 328 in the slice, `session_mismatch` at 301; one delete in the file).
- **gate.cjs**: `_peekLiveGate` (exported via `_internal`); gate_answer peeks (variable stays `live`), every refusal keeps its order and payload, consume in exactly two places (binding branch with no bound room; normal path after the db opens, before `logMemoryEvent`) with the race-warning and residual comment. The db is closed on the defensive consume failure.
- **chain.cjs**: `_peekResumeLedger` (exported); `_resumeFromGateAnswer` peeks, refuses unknown/expired, session_mismatch and an out-of-card or missing-card chosen (same payload as `_executeResumedEntry`), then consumes and delegates. The failure-ladder doc comment is rewritten.
- **Flipped tests**: test-238-session-scoped-ledger (owner-after-stranger arm, peekGate case, two-parameter case), test-238-chosen-validation case 5 (ratifies, plus replay arm), test-238-chain-chosen-validation Case 5 (executes once, plus replay arm), test-354 K3 (S1 approve after S2 refusal ratifies and the claim promotes; third approve refused `unknown_or_expired_gate`).

## test-238-chosen-validation case 1: pre-existing red, root cause

Measured red at HEAD: `expected memory_event count to increase by exactly 1 (before=0, after=2)`. I listed the `memory_event` rows after case 1. Two kinds: (1) `mcp_client_event_logged` label `gate_answer`, the bookkeeping row from `navigation.logMemoryEvent` in gate_answer; (2) `status_promoted` (target `decision:gate:<gate_id>`, reason `gate_answer approve`), written by `navigation.confirmNode` in gate.cjs's approve path (the decision-node confirmation added by quick task 260903-i2x). The second row is a documented approve path, not a new failure; the test predated it. Case 1 now counts only the bookkeeping kind (exactly +1, the original intent). Case 3 needed no change (a refusal still adds zero rows of any kind).

## Verification

- Green: test-289-ledger-consume-after-checks (all arms, PASS=12 ledger and 11 gate-answer; source arm passes), test-238-session-scoped-ledger, test-238-chosen-validation (healed), test-238-chain-chosen-validation, test-238-one-ledger, test-c55, test-198-chain-run-halt, test-347, test-363, test-366, test-276-meeting-gate-wiring, test-276 tool-honesty, `check-tool-honesty --check`, `bash tests/run-all-238.sh` (PASS=10 FAIL=0; baseline was 9/1 on the case 1 leg), test-354 (exit 0, K1-K5 all ok).
- test-369-human-only: PASS=10 FAIL=0; arm 4 prints `owner-after-stranger ratified (Phase 289 consume-after-checks is in)` and 3b(ii) no longer prints KNOWN. test-369-sessionful-acceptance: PASS=6 FAIL=0, arm 4 prints `owner-after-stranger recorded`.
- No `description:`, `inputSchema` or `detectClientCapabilities` line changed in gate.cjs or chain.cjs; no registerTool added; the tool-honesty fixture is not re-frozen (D-09 not triggered).
- test-237-approve-executes: still fails only with its pre-existing `MUTATION -- could not build the mutated copy (dispatcher-call needle not found ...)`.

## Deviations from Plan

None to the plan's code. One regression is reported, not fixed, because the fix sits outside the files this run was allowed to touch:

**test-365-never-do-gate N12 now fails** (baseline green, 75 PASS; now `PASS: 74 FAIL: 1`, `N12 lib/mcp/tools/gate.cjs is byte-identical to GATE_BASE`). `tests/test-365-never-do-gate.cjs` line 576 pins `GATE_BASE = '96804284d...'` and its comment says "Any later edit to gate.cjs must re-pin GATE_BASE". Registration parity (description, title, schema) still passes; only the byte-identity pin moved. Fix is the one-line re-pin of `GATE_BASE` to the commit that carries the intended gate.cjs state (precedent: 541222787). Plan 07 edits gate.cjs again (capability delegation), so the cleanest move is one re-pin after plan 07 lands, pinned to that commit. The plan's file list does not name this test, so I left it.

## Residual (stated, not fixed)

A write that throws after the consume still loses the gate: `gate_answer` consumes immediately before `logMemoryEvent` and chain_run's resume consumes before `_executeResumedEntry`. Durable consumption after commit belongs to Phase 369 plan 26 (which builds on `peekGate`). The comments at both consume points say so.

## Known Stubs

None.

## Threat Flags

None. T-289-05-01..06 mitigations hold: session check before the delete, peek-based refusals, replay-after-success arms in four tests, synchronous peek-to-consume stretch with an await warning, chosen validated on the peeked card before any consume.

## Self-Check: PASSED

- Commits f681ddf68, eee25f512, 15187a7b7 on main; all seven named files committed.
- STATE.md, ROADMAP.md, REQUIREMENTS.md untouched. No em-dash or en-dash added.

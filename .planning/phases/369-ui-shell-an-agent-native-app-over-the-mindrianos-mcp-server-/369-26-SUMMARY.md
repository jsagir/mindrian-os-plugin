---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
plan: 26
subsystem: mcp-gate
tags: [gate, recovery, durability, ledger, deliverable-11, d-16, withRoomTx, replay]
requires: [369-05, 369-06, 369-07, 369-13, 369-17]
external_requires: ["Phase 289 (consume-after-checks, recommended id, normal card on CLI), proven by behaviour before any edit"]
provides:
  - "tests/test-369-289-precondition.cjs, the Phase 289 behaviour probe (recommended id found by value at rendered.contract.recommended)"
  - "gate_answer durable consumption: the whole ratification in ONE withRoomTx, the ledger entry released only after the COMMIT"
  - "idempotent replay by gate id (replayed:true), across a daemon restart"
  - "explicit answers: room_switched, stale_subject (approve only), gate_expired, unknown_gate, persistence_failed"
  - "gate-ledger releaseGate, isGateExpired, _internal.backdate; navigation.readEntityRevision and readGateAnswerAnchor"
  - "MINDRIAN_TEST_MODE=1 fault markers .mindrian/.test-fault-gate-persist and .test-fault-gate-expire"
  - "the Theo handoff note for the gate_answer contract"
affects: [369-27 gate view and nextGateState, 369-28, 369-29 egress-and-canon leg (stale_subject and persistence failure states), 369-31]
tech-stack:
  added: []
  patterns:
    - "peek, refuse, write inside one withRoomTx, release after COMMIT (a second answer reads the durable trace, never the ledger)"
    - "SAVEPOINT around soft ratification steps so a swallowed fault never leaves half a write inside the transaction"
    - "test-only fault markers inside the bound room, read only under MINDRIAN_TEST_MODE=1, deleted on use"
key-files:
  created:
    - tests/test-369-289-precondition.cjs
    - tests/test-369-gate-recovery.cjs
    - /home/jsagi/Theo/.planning/HANDOFF-2026-10-02-mos-gate-answer-recovery-contract-369.md (untracked, additive, no git run in Theo)
  modified:
    - lib/mcp/tools/gate.cjs
    - lib/mcp/gate-ledger.cjs
    - lib/core/navigation/room-projection.cjs
    - lib/core/navigation.cjs
    - tests/fixtures/tool-honesty/276-dispositions.json
    - tests/fixtures/267/wire-snapshot-zod3.json
    - tests/fixtures/267/wire-snapshot-zod4.json
    - tests/test-365-never-do-gate.cjs
    - tests/test-369-sessionful-acceptance.cjs
key-decisions:
  - "A gate answer is saved in one transaction and released after the COMMIT; a thrown write rolls back and answers persistence_failed with the gate still answerable"
  - "The durable trace a replay reads is the decision node decision:gate:<id> (approve) or the memory_event keyed dedupe_key gate_answer:<id>, found with no time window (logEvent's 60 s dedupe is write-side only)"
  - "stale_subject is refused only for an APPROVE (the threat is approving a changed claim); reject and defer stay answerable so a stale card can be dismissed"
  - "releaseGate delegates to consumeGate so the ledger keeps exactly one literal _ledger.delete( after its session_mismatch check (the 369-07 text rule)"
  - "Fatal inside the transaction: the answer record and, on approve, the decision node (the replay anchor). Soft, under SAVEPOINT: decision confirm, subject promotion, strategy goal ratification"
requirements-completed: [GREC369-01, GREC369-02, GREC369-03, GREC369-04]
duration: about 3 h
completed: 2026-10-04
---

# Phase 369 Plan 26: Recoverable gate answers Summary

A gate answer now commits all of its writes together or none, can be replayed by gate id (even after a daemon restart), and refuses a stale or misplaced approval with a named state, on top of Phase 289's consume-after-checks ledger.

## Precondition (D-16), by behaviour, before any edit

`node tests/test-369-289-precondition.cjs` (committed first, d56f5fceb) exited 0 against the live code:

```
recommended id JSON path: rendered.contract.recommended
PASS part 1: recommended id "approve" carried by value at rendered.contract.recommended
PASS part 2: stranger refused session_mismatch, owner then ratified (decision:gate:<G> exists)
PASS part 2: ledger suite exits 0; owner-after-stranger carried and green in test-238-session-scoped-ledger.cjs, test-289-ledger-consume-after-checks.cjs
PASS part 3: accepted evidence (a): 289-CLI-CARD-RULING.md carries Ruling: and its named test(s) exit 0: tests/test-289-cli-card-dual-era.cjs, tests/test-289-elicit-default.cjs, tests/test-198-gate-renderers.test.cjs
RESULT: PASS (Phase 289 precondition holds by behaviour)
```

**Plan 27 reads this:** the recommended option id is at `rendered.contract.recommended` in the gate_render body (single-select only; a multi-select basket keeps it null and flags rows carrying `recommended: true`). `bash tests/run-all-289.sh` now ends `PASSED=47 FAILED=0 SKIPPED=0 KNOWN=1` (the probe leg went from SKIPPED to PASSED).

## Tasks and commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 step 0 | Phase 289 behaviour probe | d56f5fceb | tests/test-369-289-precondition.cjs |
| 1 | Durable consumption, replay, explicit states | b2f03de02 | lib/mcp/tools/gate.cjs, lib/mcp/gate-ledger.cjs, lib/core/navigation/room-projection.cjs, lib/core/navigation.cjs, tests/fixtures/267/wire-snapshot-zod3.json, wire-snapshot-zod4.json |
| 2 | Live-daemon recovery test; contract flips in ten existing tests | c3a9ec50e | tests/test-369-gate-recovery.cjs, test-369-sessionful-acceptance.cjs, test-238-chosen-validation.cjs, test-238-one-ledger.cjs, test-276-meeting-gate-wiring.cjs, test-289-ledger-consume-after-checks.cjs, test-354-concurrency-surfaces.cjs, test-363-mcp-tool.cjs, test-366-mcp-release-route.cjs, test-c55-one-resume-owner.cjs |
| pin | GATE_BASE re-pinned ONCE to the last gate.cjs commit | 1f3acc693 | tests/test-365-never-do-gate.cjs |
| honesty | Tool-honesty sweep re-measured (unchanged) | 9eef8274e | tests/fixtures/tool-honesty/276-dispositions.json |

The Theo handoff (`/home/jsagi/Theo/.planning/HANDOFF-2026-10-02-mos-gate-answer-recovery-contract-369.md`, cleared by the Theo session) names all six new answers and asks Theo to mirror the gate_render and gate_answer description text per the 2026-09-07 mirror todo. No git command was run in /home/jsagi/Theo and no Theo code was touched.

## What was built

- **gate.cjs.** gate_answer peeks, runs every refusal (chosen, coherence, resume owner, bound room, `room_switched`, `stale_subject`), opens the room, then runs `_applyRatification` inside `navigation.withRoomTx` and calls `_releaseLiveGate` only after the COMMIT. The transaction holds the answer record (memory_event with `dedupe_key: 'gate_answer:<id>'`), the decision node, its SOURCED_FROM and USES_FRAMEWORK edges, confirmNode, the subject promotion with its floor-check events, the strategy goal ratification and the opportunity telemetry. The whole stretch from peek to release is synchronous, so two answers cannot interleave; the first await is `live.resumeFn`, after the release and outside the transaction. gate_render records `mintedRoomDir`, `mintedRoomSlug` and `subjectRevision` through `_mintLiveGate`'s `extra`. A ledger miss goes through `_answerWithoutLiveGate`: `gate_expired`, else `replayed:true` from the durable trace, else `unknown_gate`.
- **gate-ledger.cjs.** `releaseGate(gateId, sessionId)` (delegates to `consumeGate`, so the one literal delete stays after the session check), `isGateExpired`, a bounded expired-id set, `_internal.backdate`. peekGate is Phase 289's, untouched.
- **room-projection.cjs and navigation.cjs.** `readEntityRevision(handle, entityType, entityId)` (0 when no row or no feed) and `readGateAnswerAnchor(handle, gateId)`, both pure reads, re-exported.
- **Fault markers.** `.mindrian/.test-fault-gate-persist` throws inside the transaction after the first write; `.test-fault-gate-expire` (holding a gate id) ages that gate past its TTL. Both are read only when `MINDRIAN_TEST_MODE === '1'`; arm 7b proves a daemon without it ignores them and that every read of the path in gate.cjs sits inside that branch.
- **Description.** gate_answer's description was rewritten to say all of this and stays inside the 2048-byte floor (1934 bytes; test-234 enforces it).

## Verification

All run with the nvm Node from /home/jsagi/dev/MindrianOS-Plugin on the final tree:

- `node tests/test-369-gate-recovery.cjs`: PASS=11 FAIL=0 (arms 1-10 and 7b) on a live daemon; `grep -c chmod` prints 0.
- `node tests/test-369-sessionful-acceptance.cjs`: PASS=6 FAIL=0.
- `bash tests/run-all-289.sh`: exit 0, `PASSED=47 FAILED=0 SKIPPED=0 KNOWN=1` (baseline before my first edit with the probe committed: the same).
- `bash tests/run-all-238.sh`: exit 0, PASS=10 FAIL=0 (baseline PASS=10). `node tests/test-198-gate-renderers.test.cjs`: exit 0 (baseline exit 0).
- `node tests/test-369-human-only.cjs`: exit 0 (arm 4 still prints the owner-after-stranger line; the one-delete text rule holds).
- `node tests/test-365-never-do-gate.cjs`: PASS 75 FAIL 0 after the single re-pin (N12 registration parity green).
- `node tests/test-276-tool-honesty-findings-closed.cjs`: 148 passed, 0 failed. `node scripts/check-tool-honesty.cjs --check`: OK, 44 tools, 139 branches, 0 high-risk. `node tests/test-234-tool-description-floor.cjs`: exit 0.
- Sweep of 66 gate-touching test files after the change: the only non-zero exits are pre-existing (list below), each confirmed against a clean `git archive HEAD` copy of the pre-edit tree.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The plan's "second answer is refused unknown_or_expired_gate" contract is the thing this plan flips, so ten existing tests that pinned it were updated**
- **Found during:** Task 2 sweep of every gate_answer test.
- **Issue:** tests/test-238-chosen-validation, test-238-one-ledger, test-276-meeting-gate-wiring, test-289-ledger-consume-after-checks (replay, two concurrency arms, and the three source arms that anchored on `_consumeLiveGate(` as the main take), test-354 K3, test-363 M3, test-366-mcp-release-route C6, test-365-never-do-gate N6 and N13, test-c55-one-resume-owner (interleavings B, C, reject follow-up, never-minted), plus test-369-sessionful-acceptance arm 5.
- **Fix:** each now asserts the new contract (a second answer is ok with `replayed:true` and writes nothing; a never-minted id and a gate released by chain_run are `unknown_gate`; chain_run keeps `unknown_or_expired_gate`). The 289 source arms now check that the main take is `_releaseLiveGate(` after `withRoomTx` and that only the binding path still consumes, and every peek-to-take window stays await-free (the mutation control still catches an inserted await).
- **Commits:** c3a9ec50e, 1f3acc693.

**2. [Rule 1 - Bug] stale_subject narrowed to the approve verdict**
- **Found during:** running test-369-shell-actions (arm 5d): its cleanup loop defers gates on a claim another gate had already confirmed; refusing those left them open forever.
- **Issue:** the plan words the refusal generically, but the threat (T-369-26-02) and the Purpose are about approving a changed claim. A reject or defer records "not this one" and cannot confirm anything.
- **Fix:** `stale_subject` is checked only when `verdict === 'approve'`; the gate description says so; arm 5 also proves a defer on a stale card is allowed. `room_switched` still applies to every verdict (a wrong-room write is harmful either way).
- **Commit:** b2f03de02.

**3. [Rule 3 - Blocking] The gate_answer description had to be rewritten within the 2048-byte floor, which moved two pins**
- **Found during:** test-234 (2332 bytes on the first, additive draft) and test-365 N12 (description byte-identical to PLAN_BASE).
- **Fix:** rewrote the whole description (1934 bytes). test-365 N12 now pins the gate_answer description and title to `GATE_BASE` (the research_run precedent: a per-tool base), while every input schema and the other tools stay on PLAN_BASE; GATE_BASE itself was re-pinned once, in its own dated commit, to the full sha `b2f03de02716430caa723112c16e35d19de8c584` (the last gate.cjs commit). The 267 wire snapshots (zod3 and zod4) carry the new text by a surgical single-string replacement; test-267-mcpv2-zod4-contract is back to its pre-existing single `room_list` description diff (it listed `tool:gate_answer:description` too until the snapshots moved).
- **Commits:** b2f03de02, 1f3acc693.

**4. [Rule 2 - Missing critical] Two ratification failures made fatal, soft steps wrapped in SAVEPOINTs**
- **Issue:** inside one transaction, a swallowed throw could leave half a write (composed `promoteNodeStatus` rethrows after its UPDATE). And "a persistence failure leaves the gate answerable" is false if the answer record or the decision node (the replay anchor) can fail softly.
- **Fix:** a failed answer record or decision node write throws (rolled back, `persistence_failed`); the decision confirm, subject promotion and strategy goal ratification keep their old "never flips ok" doctrine but run under `_softStep` (SAVEPOINT, rolled back on a throw). This replaces the earlier `reasoning_write_threw` soft path (no test pinned it).
- **Commit:** b2f03de02.

**5. [Rule 3] test-369-sessionful-acceptance arm 4 mints G2 without a subject**
- The plan said update only the expectation text. G1's approval confirms the seeded claim, so a second card on the same claim is correctly stale for its owner under the new contract (the arm failed with `stale_subject`, which is the feature working). Arm 4 is about session isolation, so G2 carries no subject; nothing else in the arm changed.

**6. [Plan wording] Tool-honesty sweep did not move, so no counts were re-frozen**
- The plan expected the new branches to move the live count. The sweep reads 44 tools / 139 branches before and after (gate_answer is still one default branch and scans OK), verdict counts unchanged (OK 127, MEDIUM 12, 0 high-risk), so `frozen_sweep` and every disposition are byte-identical. `refrozen_at` was still updated (commit b2f03de02) with a reason naming plan 369-26 and the unchanged before and after counts, which is the plan's acceptance wording.

**7. [Plan wording] No chain.cjs edit for the chain-halt mint path**
- chain.cjs is outside this plan's files. A chain halt gate already carries the room its steps run in as `roomDir`, so `_mintedRoomOf` falls back to it for `material_step` entries; `room_switched` therefore covers chain gates without touching chain.cjs. Other minters (research, sensors) record no room and skip the check.

**8. [Process note] One stray `git checkout -- tests/test-345-gate-ratify.cjs`**
- I temporarily edited that test to print a response, then restored it with a file-scoped checkout. The working tree had no other diff at that moment (verified by `git status`), so nothing of a peer's was lost; later debugging used scratch copies.

## Known Stubs

None.

## Deferred Issues (pre-existing, out of scope, each red before my first edit)

Confirmed against a clean `git archive HEAD` copy of the pre-edit tree:

- tests/test-237-approve-executes.cjs (MUTATION could not build the mutated copy; the known 289 item), tests/test-237-autonomy-parity.cjs (Leg 5 mutation).
- tests/test-345-gate-ratify.cjs: `gate_answer` answers `no_bound_room` for its unbound FAKE session (resolveMcpWriteRoom, before any code this plan changed).
- tests/test-363-mcp-tool.cjs: M3's last arm (an approve verdict on a non-approving choice) now returns the Phase 289 CR-01 top-level `chosen_not_approving` with no `chain_result`; M4, M5, M7 cascade from it. My edited replay assertion in M3 passes.
- tests/test-365-floor-gate.cjs (`room_list` description diff), tests/test-366-gated-term-release.cjs R6b (pins the old spike-007 burn), `bash tests/run-all-267.sh` PASS=28 FAIL=3 (zod4 contract room_list, lockstep, payload ceiling), tests/test-267-mcpv2-zod4-contract.cjs (room_list only).
- Not fixed on purpose: chain_run's own resume path (`_resumeFromGateAnswer` in chain.cjs) still consumes before it writes; a resume fault after the release leaves a durable ratification for a step that did not complete (returned honestly as `chain_result.ok:false`, and a repeat answer replays rather than re-running the step); a gate resumed through chain_run leaves no saved answer, so a later gate_answer for it reads `unknown_gate`; `_floorPromoteClaim` swallows a composed `promoteNodeStatus` throw inside its own try (an I/O-failure edge case where COMMIT would fail anyway).

## For plan 27 and later (shell integration)

`ui/shell/server/actions.ts` (approveDecision drops a gate on `unknown_or_expired_gate`) and `ui/shell/client/api.ts` (clears the nonce on it) still look for the old slug. gate_answer now answers `unknown_gate` and `gate_expired` for a gate with nothing left to answer, `stale_subject` and `room_switched` with the gate left open, `persistence_failed` with the gate answerable, and `replayed:true` (ok) for an already answered gate. Plan 27's nextGateState must map all of them and drop the shell's recorded gate on `unknown_gate` and `gate_expired` as well.

## Threat Flags

None new. The planned T-369-26-01..08 mitigations hold and are proven by arms 8, 5, 4, 1-3, 5/7/9, 10, 7b and the probe. The only new trust-boundary surface is the test fault markers, gated by `MINDRIAN_TEST_MODE=1` (never set by the plugin), confined to the bound room's `.mindrian/`, deleted on use.

## Self-Check: PASSED

- Files found: tests/test-369-289-precondition.cjs, tests/test-369-gate-recovery.cjs (393 lines, 11 arms), lib/mcp/gate-ledger.cjs, lib/mcp/tools/gate.cjs, lib/core/navigation/room-projection.cjs, the Theo handoff file.
- Commits found on main: d56f5fceb, b2f03de02, c3a9ec50e, 1f3acc693, 9eef8274e.
- STATE.md, ROADMAP.md and the root package.json untouched; no `gsd-tools state.*` or `roadmap` writer was run; working tree clean after the last commit; no em-dash or en-dash in any changed file.

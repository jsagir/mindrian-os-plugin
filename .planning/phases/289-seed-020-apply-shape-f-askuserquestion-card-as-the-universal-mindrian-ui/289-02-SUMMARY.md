---
phase: 289-seed-020-apply-shape-f-askuserquestion-card-as-the-universal-mindrian-ui
plan: 02
subsystem: mcp-gate
tags: [wave-0, tests, gate-ledger, contract, recommended-id, d-04, d-05, d-07]
requires: []
provides:
  - "tests/test-289-ledger-consume-after-checks.cjs: executable definition of consume-after-checks at the ledger, the gate_answer tool and the source order (LEDGER289-01..03), RED"
  - "tests/test-289-contract-recommended.cjs: recommended id on the gate contract found by value, research passthrough and live daemon (CONTRACT289-01..04, CARD289-05), RED"
affects: [289-04, 289-05, 289-07, 369-26, 369-27]
tech-stack:
  added: []
  patterns: ["in-process fake-server handler capture (238 idiom) with per-session ids", "by-value JSON path finder with excluded prefixes", "hermetic flag-ON daemon with spawned-pid-only kill"]
key-files:
  created:
    - tests/test-289-ledger-consume-after-checks.cjs
    - tests/test-289-contract-recommended.cjs
  modified: []
key-decisions:
  - "Rank 1 is the top rank (lower is better); an explicit recommended flag outranks rank; ties keep input order"
  - "A multi-select basket carries no rank-derived recommended id on either rung (Canon Appendix D entry 32); an explicit flag marks only its own superset_options row"
  - "The expired-entry rule is pinned: peekGate and consumeGate report null (never session_mismatch) for an expired entry, and consumeGate then clears it"
requirements-completed: [LEDGER289-01, LEDGER289-02, LEDGER289-03, CONTRACT289-01, CONTRACT289-02, CONTRACT289-03, CONTRACT289-04, CARD289-05]
duration: 35 min
completed: 2026-10-04
---

# Phase 289 Plan 02: Wave 0 ledger and contract proofs Summary

Two RED tests that turn Phase 369's probe parts 1 and 2 into executable definitions inside this repo: a stranger's refused answer must not burn the owner's gate (ledger, tool and source layers), and the recommended option id must be a plain string field on the gate contract, found by value and printed as `rendered.contract.recommended`.

## Tasks and commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | ledger consume-after-checks proof (RED) | 852542b04 | tests/test-289-ledger-consume-after-checks.cjs |
| 2 | recommended id by value on the gate contract (RED) | 251e9b9f8 | tests/test-289-contract-recommended.cjs |

## What was built

- **tests/test-289-ledger-consume-after-checks.cjs** (438 lines): arms `ledger`, `gate-answer`, `source` (`--arm` repeatable, no flag runs all). `ledger` pins `peekGate(gateId, sessionId)` as a two-parameter non-consuming read with the same TTL and session contract, the no-burn `consumeGate`, the owner-after-stranger order, expiry (never session_mismatch, peek leaves it, consume clears it), the null-session sentinel, and the 369-07 text rule (first `_ledger.delete(` after `session_mismatch`, none inside `peekGate`). `gate-answer` drives the real gate_render and gate_answer handlers in process with sessions S1 and S2 bound to one scratch room and S3 unbound: owner-after-stranger (and the `decision:gate:<G>` node), chosen refusal then correct answer, unbound refusal (asserted against `session-room.NO_BOUND_ROOM`) then bind then answer, replay, two concurrent approves (one ratification, one bookkeeping row), and a resume-less `material_step` entry (refused `resume_owner_missing`, entry kept). `source` pins peek < validate < consume with no await between peek and consume in gate.cjs and chain.cjs `_resumeFromGateAnswer`. Never exits 77.
- **tests/test-289-contract-recommended.cjs** (440 lines): arms `unit`, `research`, `live`. `unit` pins the `normalizeCard` derivation, rung (b) and (c) single and multi renders, the D-07 option count (`with the 3 options above`, `verbs=3`), the by-value path finder (the only non-excluded string path holding an option id must be `rendered.contract.recommended`, valued at the top id) and that `renderShapeF8` stays recommendation-free. `research` pins `_internal.grantOptions` passing the grant card's flag through. `live` rehearses 369-26 probe part 1 against a hermetic flag-ON daemon with a legacy-mode client, option order second/top/third; exit 77 with an `ENV GAP:` line only when the daemon or client package cannot start. Ids differ from labels so F.8 label arrays cannot collide.

## RED measurements (today's code)

| Command | Exit | PASS | FAIL | Notes |
|---------|------|------|------|-------|
| `node tests/test-289-ledger-consume-after-checks.cjs` | 1 | 10 | 16 | ledger 8 FAIL (no `peekGate`, consume burns on mismatch, delete at line offset 108 precedes `session_mismatch` at 350), gate-answer 4 FAIL (owner, chosen and unbound cases all read `unknown_or_expired_gate` after the refused attempt; no `peekGate`), source 3 FAIL |
| `... --arm unit --arm research` | 1 | 3 | 17 | recommended `null`/`undefined`, marker `verbs=0`, `grantOptions` not exported |
| `... --arm live` | 1 | 2 | 1 | daemon starts; `paths found: []`; hygiene leg passes, no process left behind |

Cases that pass today are the anti-vacuity controls (owner mint, replay refused, double submit, chosen/unbound/resume-owner first refusals, multi-select null, F.8 layering). The decision-node id form was verified green on a happy-path ratify before committing.

## Deviations from Plan

None - plan executed as written. Small notes, not deviations: the unit arm's labels carry a `unit:` prefix so the plan's `grep "FAIL: unit"` check matches; assertion failures print the actual value so each RED line names the null id and the `verbs=0` count; the live arm reuses `tests/helpers/mcp-wire-267.cjs` `hermeticEnv` (not the 369 daemon helper).

## Authentication gates

None.

## Known Stubs

None.

## Threat Flags

None. Both files write only inside their own mkdtemp HOME and rooms dirs (removed in a finally or on exit) and kill only PIDs they spawned. Three pre-existing `mindrian-mcp-server` processes were alive before and after every run and were not touched.

## Notes for downstream plans

- Plan 05 must make `consumeGate` delete after the session and TTL checks while keeping expired entries reading `null`; one shape that satisfies both the 369-07 text rule and the expired case is to compute `expired` and `mismatch` first, return on mismatch, then delete.
- Plan 04 should flag recommended per row on `superset_options`, derive `contract.recommended` for single-select only, mark the single rung (c) body line with ` (recommended)`, and count real options in the imperative (the trailer counts `contract.verbs`, empty on F.8 today).
- Plan 05 owns `_internal.grantOptions` on research.cjs only if plan 04 does not; one of them must export it.

## Self-Check: PASSED

- tests/test-289-ledger-consume-after-checks.cjs: FOUND, committed 852542b04
- tests/test-289-contract-recommended.cjs: FOUND, committed 251e9b9f8
- Neither file contains "Normal card on CLI" (ledger file also verified); the contract file contains no "owner-after-stranger"; no em-dash or en-dash in either.

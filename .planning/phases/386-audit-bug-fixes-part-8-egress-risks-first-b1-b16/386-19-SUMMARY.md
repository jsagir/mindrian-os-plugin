---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "19"
subsystem: mcp-gates
tags: [rca, gate-ledger, framework_run, gate_answer, b11]
requires: []
provides:
  - framework_run halt gate is minted in the gate ledger and answerable
affects: [386-21]
tech-stack:
  added: []
  patterns: [mint every gate whose id is returned to the host]
key-files:
  created:
    - tests/test-386-framework-run-halt-gate-minted.cjs
  modified:
    - lib/mcp/tools/sensors.cjs
    - .planning/debug/framework-run-halt-card-never-minted-unknown-gate.md
key-decisions:
  - "Mint with kind general (not material_step) so gate_answer records the answer and runs no step; only the approve option approves"
requirements-completed: [B11]
duration: 40min
completed: 2026-11-06
---

# Phase 386 Plan 19: framework_run Halt Gate Mint Summary

The framework_run halt path now mints its rendered gate in the gate ledger, so gate_answer resolves the id instead of answering unknown_gate. The answer is recorded and no step runs.

## Accomplishments

- `target: PRESENT` in the RCA. Phases 384 and 385 did not touch the halt path or gate_answer.
- Reproduced through the registered handlers (fake server, fixture room, no network): halt returned a gate id, the ledger held no entry, gate_answer answered unknown_gate. PROVEN that renderGate does not mint.
- RED run: H1, H2 and the anti-vacuity row failed; H3 (forged id stays unknown_gate) and H4 passed. GREEN run: all arms pass.
- Fix in lib/mcp/tools/sensors.cjs: require `../gate-ledger.cjs` (not a tools module, disjoint-file rule holds) and call `mintGate` after the render with the normalized card, session id, kind general, renderer from `ledgerRenderer`, and approving `['approve']`. No mint when an elicitation dialog was already answered inline. gate.cjs unchanged (the RCA showed no change needed).
- A second answer of the same id returns ok with replayed true and writes no new row (H4).

## Task Commits

1. Task 1, RCA: 900c1e2b0
2. Task 2, RED test: 72f73eb73
3. Task 3, fix: 46ba22f2c

## Deviations from Plan

None.

## Verification

- `node tests/test-386-framework-run-halt-gate-minted.cjs`: all arms pass.
- `bash tests/run-all-386.sh`: 13 pass, 0 fail, 0 skip.
- Exit 0: test-sensors-routing-fence, test-sensors-part8-sweep, test-198-contract-schema, test-198-chain-run-halt, test-198-local-only, test-238-one-ledger, test-238-chosen-validation, test-289-ledger-consume-after-checks, test-h27-gate-card-node-fields, test-254-composition-census, test-248-room-bind-session-authoritative. `node scripts/check-shape-declaration.cjs --check` exit 0.

## Deferred Issues (not caused by this plan)

- `tests/test-237-autonomy-parity.cjs` Leg 5 fails with "session-room require anchor not found in chain.cjs; harness pin target drifted". This plan did not touch chain.cjs. Legs 1 to 4 pass.
- `tests/test-252-guard-census.cjs` census.5b fails (skills/rs-experts/SKILL.md canary 'Tier 1'). Unrelated file.

## Limits recorded

- The minted entry has no `mintedRoomDir`, so the room_switched check does not cover this gate. gate.cjs computes that field and sensors.cjs may not require gate.cjs. A later change can move the helper to a shared module.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

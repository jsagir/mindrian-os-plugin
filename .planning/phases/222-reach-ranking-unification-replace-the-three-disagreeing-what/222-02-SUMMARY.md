---
phase: 222-reach-ranking-unification-replace-the-three-disagreeing-what
plan: 02
subsystem: reach selection / Hedge outcome-learning layer
tags: [rank-fired-candidates, hedge-mwu, outcome-learning, part-9-chokepoint, req-1, req-3, req-7, d-01, d-03]
requires:
  - "222-01: navigation.readHedgeWeightState / upsertHedgeWeightState + ranker_weights table"
  - "222-01: EVENT_TYPES member reach_weight_state_unavailable (Req 7 degrade signal)"
provides:
  - "lib/workflow/reach-hedge-ranker.cjs: the ONE shared scored-selection module (D-01)"
  - "rankFiredCandidates(sensorReaches, roomState) - re-orders the fired subset in place-of-order"
  - "hedgeUpdate / deriveExpertLosses / readHedgeWeights / maybeUpdateHedgeWeights (Req 3 Hedge layer)"
  - "EXPERT_IDS / REACH_IDS / HEDGE_UPDATE_N_DEFAULT / HEDGE_ETA_DEFAULT named constants"
affects:
  - "Plan 03 wires both call sites (resolveFireSkill via decide(), dispatchCandidateReaches) onto rankFiredCandidates"
tech-stack:
  added: []
  patterns:
    - "in-place re-order: same reach objects resorted so every downstream [0] read sees the scored winner"
    - "Arora-Hazan-Kale (2012) two-expert Hedge/MWU, general over an expert-id-keyed object (not hardcoded two fields)"
    - "non-throwing disclosed degrade: read_fault / corrupt_scalar emit an event; cold start stays silent"
    - "composition-not-duplication: Phase 158 countPenalty folded INTO the D4 expert before the blend (OQ-2)"
    - "hot-path soft-fail: any unexpected throw returns the ORIGINAL input array"
key-files:
  created:
    - lib/workflow/reach-hedge-ranker.cjs
    - tests/test-222-hedge-update.cjs
    - tests/test-222-rank-fired.cjs
    - tests/test-222-degrade.cjs
  modified: []
decisions:
  - "D-01 honored: one new pure module owns the shared selection; no second selection brain, detection logic untouched"
  - "D-03 honored: weight updates debounced at N=50 (env-tunable MINDRIAN_HEDGE_UPDATE_N), never per-event"
  - "OQ-2 resolved COMPOSE: countPenalty discount composed into the D4 expert before the Hedge blend, not a second pass"
  - "deriveExpertLosses reads enums from row.properties OR the top level, so it folds real findRecentChanges rows and unit fixtures alike"
  - "maybeUpdateHedgeWeights accepts opts.updateN / opts.eta overrides (env wins otherwise) for deterministic future tuning"
metrics:
  duration: ~7 min
  tasks: 2
  files-created: 4
  files-modified: 0
  completed: 2026-07-15
---

# Phase 222 Plan 02: Shared Scored-Selection + Hedge Layer Summary

Built `lib/workflow/reach-hedge-ranker.cjs`, the single shared scored-selection module both call sites adopt in Plan 03. It exports a pure-shaped `rankFiredCandidates(sensorReaches, roomState)` that re-orders `dispatchSensors`' already-fired subset (same objects, resorted, so every downstream `[0]` read transparently sees the scored winner), layers a hand-rolled two-expert Hedge/MWU adjustment learned from the Phase 159 outcome log (debounced at N=50), composes the shipped Phase 158 reject discount into the D4 expert before the blend, and degrades visibly per Req 7. Three test files pin Reqs 1, 3, and 7 at module level, two of them driving a real `openRoomDb` + real navigation accessors (the no-mock leg of this wave).

## What Was Built

- **`reach-hedge-ranker.cjs` (406 lines)** mirroring `reach-reject-reader.cjs`'s module disciplines (BSL 1.1 header, Phase-222 doc comment naming the three invariants, single `../core/navigation.cjs` require, local frozen `REACH_IDS`, ALL-CAPS tunables with TUNABLE-LATER rationale, hot-path soft-fail). Nine exports:
  - `rankFiredCandidates(sensorReaches, roomState)` - the D-01 shared selection. 0/1 candidates pass through by reference (byte-identity); multi-candidate turns compute `reachScores` (injected or via `buildReachScoresFromCortex`), a D4 score per reach clamped to the 0.5 floor, the composed Phase-158 discount, a `1/(index+1)` registry signal, and the Hedge-weighted combined score; then a STABLE descending sort that preserves original order on ties. Fire-and-forget debounced weight update only when a db is present. Any throw returns the original input.
  - `hedgeUpdate(weights, losses, eta)` - the Arora-Hazan-Kale MWU step, GENERAL over expert-id keys (SEED-057 generality), with a zero/non-finite-sum guard.
  - `deriveExpertLosses(row, opts)` - maps one `f_selector_decision` row to a per-expert loss vector (reject = high loss for the endorsing expert); returns null for defer / missing / off-set reach_id / no-decision rows.
  - `readHedgeWeights(db, roomState)` - the PATTERNS.md "non-throwing degrade, never silent" accessor: injection seam, cold/no-db equal weights (no event), read_fault degrade on a throw, corrupt_scalar degrade on a non-finite/negative/zero-sum scalar, healthy renormalize.
  - `maybeUpdateHedgeWeights(db, opts)` - the D-03 debounced fold: reads outcome rows newer than the stored `updatedAt`, keeps the ones `deriveExpertLosses` accepts, and only at `>= N` folds them oldest-first and upserts with an advanced `updateCount`. Whole body soft-fails to `{ updated: false }`.
  - `EXPERT_IDS`, `REACH_IDS`, `HEDGE_UPDATE_N_DEFAULT` (50), `HEDGE_ETA_DEFAULT` (0.3).
- **`test-222-hedge-update.cjs`** - 6 behaviors: pure convergence, held-out argmax, row-driven fold against a real room.db, the N-1-vs-N debounce boundary, loss-skip rules, and the hedgeUpdate zero-sum guard.
- **`test-222-rank-fired.cjs`** - 6 checks: score order, 0/1 same-reference passthrough, flat-floor outcome tie-break, stability, shape, hot-path soft-fail.
- **`test-222-degrade.cjs`** - 5 arms against a real room.db: healthy and cold both emit zero events; corrupt scalar -> one `corrupt_scalar` event; dropped table -> one `read_fault` event; enum/scalar-only payload (no value over 64 chars, no `reason` field).

## Verification

- `node tests/test-222-hedge-update.cjs` -> exit 0, 6 checks green (pure fold AND row-driven fold on a real temp room).
- `node tests/test-222-rank-fired.cjs` -> exit 0, 6 checks green.
- `node tests/test-222-degrade.cjs` -> exit 0, 5 arms green.
- `node tests/test-222-weight-state.cjs` and `node tests/test-222-frozen-scalars.cjs` -> exit 0 (no Wave-1 regression).
- Source (Part 9) greps on the comment-stripped module: zero `node:sqlite`/`better-sqlite3`/`DatabaseSync`/`fs.read|write`; exactly one `../core/navigation.cjs` require; zero `dial-reach-orchestrator`/`insight-sensors` couplings; `MINDRIAN_HEDGE_UPDATE_N` and `MINDRIAN_HEDGE_ETA` both present; zero em-dashes.
- Boundaries held: `git diff` on `package.json`, `package-lock.json`, `dial-reach-orchestrator.cjs`, `f-selector-ranker.cjs`, `insight-sensors.cjs` all empty.

## Deviations from Plan

None that change behavior. Two conformance choices made within scope:

- **`deriveExpertLosses` reads `row.properties || row`.** The plan text names `row.reach_id` / `row.decision`; real `findRecentChanges` rows carry those enums under `.properties`. Reading from `row.properties` when present (else the top level) lets the same function fold real outcome rows AND the unit fixtures without a caller-side normalization step. No behavior change; strictly more robust.
- **`maybeUpdateHedgeWeights` accepts optional `opts.updateN` / `opts.eta`.** Env still wins when no opt is supplied, and the shipped-default boundary (N=50) is what the tests actually exercise (env deleted, 50 vs 49 rows). The opts seam is an inert future-tuning hook, not a behavior path taken in this plan.

## Threat Model Coverage

- **T-222-01 (tampering, corrupt weight scalar):** `readHedgeWeights` validates finite / non-negative / positive-sum; a corrupt scalar returns equal weights + a `corrupt_scalar` degrade event (test-222-degrade arm c).
- **T-222-02 (Part 8 payload disclosure):** the degrade payload is `{ fault_kind, source }` enum tokens only, no prose, no `reason` field; test-222-degrade arm (e) asserts the enum/scalar-only + no-`reason` + <=64-char shape.
- **T-222-03 (Part 9 chokepoint breach):** the sole db surface is the `navigation.cjs` chokepoint; the acceptance grep proves zero raw-sqlite/`DatabaseSync`/`fs` requires and exactly one navigation require.
- **T-222-04 (DoS / hot-path stall):** the 0/1 short-circuit does zero reads; a multi-candidate turn costs one weight-state read + one bounded `findRecentChanges`; the whole body soft-fails to the input array (test-222-rank-fired check 6).
- **T-222-05 (cross-room aggregation):** the module only ever touches the caller-passed db handle; no room enumeration surface exists.
- **T-222-SC (supply chain):** zero new packages; `package.json`/`package-lock.json` unchanged.

## Self-Check: PASSED

- All 4 created files present on disk.
- All 4 task commits present in git history (d509671a RED, ad2e5ea7 GREEN, 997abef6 tests; plan-level TDD gate: test -> feat sequence intact).

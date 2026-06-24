---
phase: 177-larry-behavioral-channel
plan: 10
subsystem: chain-executor / behavioral-channel
tags: [bch-09, escape-hatch, gate-suppression, forced-material, decision-gate, part-8, wave-5]
requires:
  - 177-08 (BEHAVIORAL_CHANNEL_ARMED kill-switch in calibration-gate.cjs)
  - 166 (runChain spine + makeGateFn + isIrreversibleStep)
  - 177-06 (escape_hatch observation field)
provides:
  - escape-hatch gate-suppression branch in makeGateFn() (ARMED-gated, forced-material-guarded, dormant when unarmed)
  - BCH-09 GREEN (deploy-still-halts headline)
affects:
  - lib/core/chain-executor.cjs (makeGateFn gateFn predicate)
tech-stack:
  added: []
  patterns:
    - lazy-require seam (mirrors _loadRecipeMaps / _loadDecide) for the calibration-gate ARMED read
    - opts.armed test seam (exercise armed path without mutating the shipped constant)
    - getter re-export of a lazily-read constant
key-files:
  created: []
  modified:
    - lib/core/chain-executor.cjs
    - tests/test-bch-09-forced-material.cjs
decisions:
  - "isIrreversibleStep() stays the UNCONDITIONAL first statement in gateFn; the suppression branch is placed AFTER the forced-material first-check and the quality carry, BEFORE the posture/autonomous_safe return -- structurally upstream so an irreversible step can never reach the branch."
  - "ARMED is read lazily from calibration-gate.cjs (one source of truth, false today) and is overridable via opts.armed for the test only; the shipped constant stays false on disk."
  - "The branch reads only the ARMED boolean + the step escape_hatch scalar + the resolved posture enum -- no Brain wire, no user prose (Canon Part 8)."
metrics:
  duration: ~25m
  completed: 2026-06-24
---

# Phase 177 Plan 10: Escape-Hatch Gate-Suppression (BCH-09) Summary

The escape-hatch gate-SUPPRESSION consequence shipped WIRED-BUT-SHADOWED inside `makeGateFn()` in `lib/core/chain-executor.cjs`: when `BEHAVIORAL_CHANNEL_ARMED` is true AND a step carries an active `escape_hatch` AND the step is autonomous_safe + reversible, the gate returns `run` (suppressed) instead of halting for human confirmation. It is GATED by the LOCKED `BEHAVIORAL_CHANNEL_ARMED` flag (default false, always today) and GUARDED, unconditionally, by the forced-material first-check, so an irreversible step (deploy/publish/send/...) ALWAYS halts.

## What shipped

- **The suppression branch** in `makeGateFn()`'s `gateFn` predicate, ordered exactly: (1) forced-material `isIrreversibleStep()` halt, (2) low-quality carry halt, (3) escape-hatch suppression (`armed && _escapeHatchActive(step) && autonomousSafe && verb === 'run'` -> `run`), (4) normal posture/autonomous_safe return. The posture is resolved ONCE and shared by (3) and (4).
- **The ARMED seam:** a lazy `_loadBehavioralChannelArmed()` that reads `BEHAVIORAL_CHANNEL_ARMED` from `lib/core/navigation/calibration-gate.cjs` (mirroring the existing `_loadRecipeMaps` / `_loadDecide` lazy-seam idiom), degrading to `false` on a missing owner. Overridable via `opts.armed` (the test seam) so the armed-true path is exercised without mutating the shipped constant. Re-exported as a getter for callers/tests.
- **`_escapeHatchActive(step)`:** a small pure helper reading only `step.escape_hatch` (and `step.observation.escape_hatch`) as a boolean scalar -- never user prose.
- **`tests/test-bch-09-forced-material.cjs`:** scaffold stub replaced with four assert groups -- the deploy-still-halts HEADLINE (armed + escape-hatch active), the DORMANT byte-identical gate when unarmed (escape_hatch has zero effect on the verb), the FORCED-MATERIAL-FIRST ordering (irreversible + low-quality + escape-hatch + armed halts via the first check), and the armed reversible-only SUPPRESSION path (branch reachable; non-safe never escalated).

## Verification

- `node tests/test-bch-09-forced-material.cjs` exits 0 (19 asserts, all green).
- `bash tests/run-all-177.sh`: **16 pass / 0 fail** (was 15 pass / 1 fail -- bch-09 was the only RED). The whole phase gate is now green.
- **Deploy-always-halts confirmed:** the headline asserts an autonomous_safe step with an active escape_hatch and `armed:true` whose command contains `deploy` (and separately `publish`, and `step.irreversible===true`) STILL returns `halt`. The guardrail wins unconditionally.
- **Dormant byte-identical confirmed:** with the flag unarmed (the shipped default), the gate returns the pre-seam verb for every step shape, and the `escape_hatch` handle has zero effect on the verb (asserted by comparing the verb with and without the handle).
- **Chain-executor regression held:** test-chain-executor-gate (4/4), -loop (4/4), -fable-mode (7/7), -part8-leak (PASS), -verdict (15/15) all exit 0.
- **Part 8 scan clean:** the brain-boundary grep over the suppression branch + helper matches nothing (exit 1, the clean state); the branch reads only the ARMED boolean + escape_hatch scalar + posture enum -- no fetch/http/buildBrainPacket/sendPacket added, no Brain wire.
- **Frozen sets untouched:** test-reach-ids-drift (frozen 6) and test-posture-ids-drift (frozen 3) PASS; no 7th reach, no 4th posture, no IRREVERSIBLE_HINT removed. The runChain/_runChainResilient halt-reason strings (`forced_material` / `gate_halt`) are unchanged (those lines were not edited).
- The shipped `BEHAVIORAL_CHANNEL_ARMED` constant stays `false` on disk; the test arms via `opts.armed`, never the constant.

## Deviations from Plan

None affecting scope. One out-of-scope pre-existing issue logged:

- **[Out-of-scope] Pre-existing circular-dependency warning.** Requiring `calibration-gate.cjs` (which requires `f-selector-ranker.cjs`) emits a `non-existent property 'BEHAVIORAL_CHANNEL_FLOOR'/'CEILING' inside circular dependency` warning. This is PRE-EXISTING and reproduces without chain-executor; my lazy require only surfaces it when the re-exported `BEHAVIORAL_CHANNEL_ARMED` getter is first read. Values resolve correctly (ARMED=false, FLOOR=0.5, CEILING=0.85). Cosmetic stderr noise only; left untouched per the scope boundary. Logged to `deferred-items.md`.

## Commits

- `3d5f8898`: 177-10: BCH-09 escape-hatch gate-suppression (ARMED-gated, forced-material-guarded)

## Self-Check: PASSED

- FOUND: lib/core/chain-executor.cjs (modified, contains BEHAVIORAL_CHANNEL_ARMED + the suppression branch)
- FOUND: tests/test-bch-09-forced-material.cjs (real asserts, exits 0)
- FOUND: commit 3d5f8898

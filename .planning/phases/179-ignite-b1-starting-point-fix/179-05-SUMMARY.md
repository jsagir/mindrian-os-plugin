---
phase: 179-ignite-b1-starting-point-fix
plan: 05
subsystem: ignite-b1-starting-point
tags: [abstraction-gate, instances-vs-structures, always-fire, shape-f, domain-neutral-fixture, grep-gate, door-3, part-8, part-9, part-11]
wave: 5
requirements: [REQ-06]
canon_parts: [3, 8, 9]
requires:
  - lib/core/navigation/typed-claim.cjs (writeClaimNode -- the Wave-4 hypothesis truth-claim node)
  - lib/core/navigation.cjs (the substrate chokepoint the persist helper re-exports through)
  - lib/hmi/selector-dispatcher.cjs (SEED-020 single card-construction door)
  - commands/ignite.md (Door 3, authored Waves 3-4)
  - scripts/check-room-blueprints.cjs (the --check grep-gate idiom mirrored)
provides:
  - the 3-option always-fire instances-vs-structures Shape F.1 selector (buildAbstractionSelector)
  - the abstraction-level persistence helper (persistAbstractionLevel -- additive prop on the hypothesis node)
  - the committed domain-neutral fixture + an adversarial neutrality grep gate
  - the Door 3 always-fire abstraction-gate wiring
affects:
  - commands/ignite.md
  - lib/core/navigation.cjs
cirs_relationship:
  surfaces_added:
    - abstraction-gate (the instances-vs-structures 3-option Shape F selector)
  surfaces_modified:
    - ignite
  surfaces_removed: []
  spine_consumed:
    - commands/ignite.md
    - lib/core/navigation/typed-claim.cjs
  gate_impact: "Adds the instances-vs-structures 3-option Shape F selector, fired ALWAYS for every Door 3 hypothesis (CONTEXT decision 2, Brain-grounded Systems-Thinking iceberg move; kills the net-new classifier risk). Committed domain-neutral fixture + an adversarial grep gate proving venture content is REJECTED. The abstraction value persists as an additive property on the hypothesis claim node. Opens NO Brain wire; NO AION-specific content enters the repo; mints NO new edge/node/reach type."
tech-stack:
  added: []
  patterns:
    - "pure selector spec (no I/O) + persist helper behind the navigation substrate chokepoint (mirrors typed-claim.cjs)"
    - "additive abstraction_level prop on the EXISTING claim node (read-merge-write same nodes row; no new node/edge type)"
    - "adversarial grep gate (denylist + CamelCase venture-name heuristic; fails CLOSED; tested against a synthesized adversarial fixture)"
    - "always-fire (no shouldFire predicate, no ambiguity classifier) -- the net-new classifier risk designed out"
key-files:
  created:
    - lib/core/abstraction-gate.cjs
    - lib/core/navigation/abstraction-claim.cjs
    - scripts/check-abstraction-fixture-neutral.cjs
    - tests/fixtures/abstraction-gate-neutral.json
    - tests/test-abstraction-gate.cjs
    - tests/test-abstraction-gate-179.cjs
  modified:
    - lib/core/navigation.cjs
    - commands/ignite.md
decisions:
  - "Abstraction gate fires ALWAYS for every Door 3 hypothesis (CONTEXT decision 2, Brain-grounded): the lift to STRUCTURE must be deliberately surfaced because navigators default to instances; no ambiguity classifier (kills the net-new classifier risk)"
  - "The 3rd option 'unsure' absorbs the genuinely-undecided navigator"
  - "abstraction_level persists as an ADDITIVE property inside the hypothesis claim node's properties blob (the typed-claim D-10 idiom), NEVER a DDL column; no new node/edge type minted"
  - "The persist helper (raw nodes UPDATE) lives in lib/core/navigation/abstraction-claim.cjs (the navigation substrate allow-list, like typed-claim.cjs) and is re-exported through navigation.cjs + surfaced on abstraction-gate.cjs -- a Rule 3 fix for the raw-graph-write pre-commit guard"
  - "The neutrality gate is ADVERSARIAL: it proves venture content is REJECTED (denylist + CamelCase venture-name heuristic), tested against a synthesized adversarial fixture, not just that the neutral fixture passes"
metrics:
  duration_sec: 424
  tasks: 1
  files_changed: 8
  completed: 2026-06-24
---

# Phase 179 Plan 05: Instances-vs-Structures Abstraction Gate Summary

The riskiest net-new surface of the phase, built as the least-risky shape it can be: a 3-option Shape F single-select ("INSTANCES / STRUCTURE / unsure") that fires ALWAYS for every Door 3 hypothesis (no classifier), with a committed domain-neutral fixture and an adversarial grep gate that proves venture content is rejected.

## What shipped

**Task 1 (TDD) -- the always-fire 3-option abstraction selector + the domain-neutral fixture + the adversarial neutrality grep gate + the Door 3 wiring.**

- `lib/core/abstraction-gate.cjs` exports `buildAbstractionSelector()` -- a PURE function returning the 3-option Shape F.1 single-select spec (INSTANCES / STRUCTURE / unsure, `multiSelect:false`, `keyboard:'arrow-key'`, the question naming the instances-vs-structure distinction). It is UNCONDITIONAL: no `shouldFire` predicate, no ambiguity classifier -- no input can suppress the gate. It surfaces `persistAbstractionLevel` (re-exported from the navigation chokepoint) so Door 3 imports the selector + the persist helper from one place.
- `lib/core/navigation/abstraction-claim.cjs` -- the persistence helper behind the navigation substrate guard (mirroring `typed-claim.cjs`). `persistAbstractionLevel(db, {nodeId, abstraction_level})` writes the chosen level (instances|structure|unsure) as an ADDITIVE property inside the EXISTING hypothesis claim node's properties blob: a read-merge-write on the SAME `nodes` row that mints NO new node type and NO edge type and leaves `review_status` untouched (Part 9 role 5 -- the abstraction pick is not a human promotion). Re-exported through `lib/core/navigation.cjs` (thin additive re-export, like `writeClaimNode`).
- `tests/fixtures/abstraction-gate-neutral.json` -- the committed domain-neutral fixture: a generic "I believe X drives Y" with ZERO venture content.
- `scripts/check-abstraction-fixture-neutral.cjs` -- the ADVERSARIAL neutrality grep gate (the load-bearing risk, T-179-12). A pure filesystem read over the fixture + the gate source with an explicit denylist (aion/oncology/eureka/target-pair/drug/pharma/... + a CamelCase venture-name heuristic), `--check` exit-code idiom mirroring `check-room-blueprints.cjs`. Fails CLOSED (non-zero) on any banned token. The `--file` arg lets the suite point it at a synthesized adversarial fixture to prove rejection.
- `commands/ignite.md` Door 3 -- the always-fire wiring: after the hypothesis is filed and before the path-forward, `buildAbstractionSelector()` fires its 3-option single-select via the SEED-020 dispatcher for EVERY hypothesis; the pick records via `persistAbstractionLevel`. Cites CONTEXT decision 2 (Systems-Thinking iceberg) + Part 8 (LOCAL-only).

## Proof suite

`tests/test-abstraction-gate.cjs` (12 checks, all green):
- exactly 3 options (INSTANCES / STRUCTURE / unsure), arrow-key single-select, Shape F sub-shape, the dispatcher resolves the single-select archetype (no bespoke dialog; SEED-020).
- always-fire: no `shouldFire`/`ambiguityClassifier` token in the source (grep), and any/empty/null input yields the same 3 options.
- `persistAbstractionLevel` writes `abstraction_level` as an additive prop on the claim node, preserves the prior `knowledge_type` prop, keeps `type='claim'`, keeps `review_status='proposed'`; mints NO edge (edges table empty) and NO extra node; rejects an invalid level + a missing node.
- the neutrality gate exits 0 over the neutral fixture AND fails non-zero over a synthesized adversarial fixture carrying a banned token.

`tests/test-abstraction-gate-179.cjs` is the aggregator-named thin loader so `tests/run-all-179.sh` un-SKIPs Wave 5.

## Gate results

| Gate | Result |
|------|--------|
| `node tests/test-abstraction-gate.cjs` | 12/12 PASS |
| `node scripts/check-abstraction-fixture-neutral.cjs --check` | exit 0 (neutral) |
| neutrality gate over a synthesized adversarial fixture | exit non-zero (REJECTS venture content) |
| `bash tests/run-all-179.sh` | 9 pass / 0 fail / 2 skip (Waves 1-5 green; Waves 6-7 RED-by-design SKIP) -- exit 0 |
| `node scripts/check-substrate.cjs --diff` | exit 0 (no chokepoint bypass) |
| `git diff --quiet HEAD -- edges.cjs transitions.cjs` | exit 0 (no new edge/node type) |
| `node scripts/check-render-coverage.cjs --check` | exit 0 (no reach/node/edge minted) |
| `node scripts/check-room-blueprints.cjs --check` | exit 0 (Wave 4 stays green) |
| reach-ids-drift (frozen 6) / posture-ids-drift (frozen 3) | PASS |
| em-dash sweep (all touched files) | clean |
| spec grep gate (`aion\|oncology\|eureka\|target-pair` in fixture + gate body) | zero hits (denylist array of the check script excluded) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Raw `UPDATE nodes` tripped the substrate chokepoint guard.**
- **Found during:** Task 1 commit (the `scripts/check-substrate.cjs --diff` pre-commit gate).
- **Issue:** The plan named the persistence helper to live in `lib/core/abstraction-gate.cjs`, but that path is NOT in the navigation substrate allow-list, so its raw `UPDATE nodes` write was flagged as a `raw-graph-write` chokepoint bypass (Canon Part 9 substrate guard). The commit was blocked.
- **Fix:** Mirrored the established `typed-claim.cjs` precedent: moved the raw-write helper into `lib/core/navigation/abstraction-claim.cjs` (covered by the allow-list regex `/^lib\/core\/navigation\//`), re-exported it through `lib/core/navigation.cjs` (a thin additive re-export, like `writeClaimNode`), and surfaced it on `lib/core/abstraction-gate.cjs` (which now re-exports it) so Door 3 still has one import surface. The public module name from the plan is preserved; the raw write lives behind the substrate door. No behavior change to the helper.
- **Files modified:** lib/core/abstraction-gate.cjs (refactor to re-export), lib/core/navigation/abstraction-claim.cjs (new), lib/core/navigation.cjs (re-export).
- **Commit:** c9341423.

**2. [Rule 1 - Correctness] The adversarial grep gate false-positived on its own legitimate primitives.**
- **Found during:** Task 1 (first verify run).
- **Issue:** The CamelCase venture-name heuristic flagged `AskUserQuestion` (a Claude Code render primitive) and `DatabaseSync` (a node:sqlite primitive) referenced in the gate source body; and the fixture `_comment` literally contained the word "AION" (the denylist substring `aion`). These are not venture content; the gate must not trap its own legitimate tokens.
- **Fix:** Whitelisted `AskUserQuestion` + `DatabaseSync` as allowed proper nouns; reworded the fixture comment to drop the literal "AION"; reworded the gate-source prose to describe the always-fire contract without the literal `shouldFire`/`ambiguityClassifier` identifiers (so the test's source-level grep proves the contract cleanly). The adversarial-rejection test still proves a real banned token (in a synthesized fixture) fails the gate closed.
- **Files modified:** scripts/check-abstraction-fixture-neutral.cjs, tests/fixtures/abstraction-gate-neutral.json, lib/core/abstraction-gate.cjs.
- **Commit:** c9341423 (folded into the single task commit).

## Out of scope / not touched

- The CV multiSelect + auto-fire Engine 1 (Wave 6), the B1-spec reconciliation (Wave 7) -- RED-by-design SKIP in run-all-179.sh until their waves land.
- No new edge/node/reach type minted; frozen Part 3 contracts (MAX_K=3, DIAL_REACH_K=6, 0.70/0.15 gate, 6-reach bank, glyphs) + edges.cjs/transitions.cjs byte-unchanged.

## Known Stubs

None. The abstraction gate is fully wired: the selector fires always for every Door 3 hypothesis via the SEED-020 dispatcher, the pick persists as an additive property on the hypothesis node, and the committed fixture is proven domain-neutral by a grep gate that actually rejects venture content.

## Threat Flags

None. No new network endpoint, auth path, or trust-boundary surface introduced. The abstraction pick + hypothesis_text are LOCAL-only (Part 8); the committed fixture is domain-neutral (T-179-12 mitigated by the adversarial grep gate); the always-fire design removes the conditional-skip surface (T-179-13); no new edge/node type (T-179-14: git-diff-quiet on edges.cjs/transitions.cjs).

## TDD Gate Compliance

This plan is a single TDD task. The test (`tests/test-abstraction-gate.cjs`) and the implementation were authored together and landed in one atomic feat commit (`c9341423`) because the plan defines one task and the phase aggregator gates the wave as a unit. The suite asserts RED behaviors (3-option, always-fire, additive-persist, no-new-edge, adversarial-reject) all GREEN at commit time. No separate `test(...)` commit was cut; the single-task structure folds RED+GREEN into one wave commit, consistent with the prior-wave pattern (179-04 cut separate commits per its 2-task structure; 179-05 has 1 task).

## Self-Check: PASSED

- FOUND: lib/core/abstraction-gate.cjs, lib/core/navigation/abstraction-claim.cjs, scripts/check-abstraction-fixture-neutral.cjs, tests/test-abstraction-gate.cjs, tests/test-abstraction-gate-179.cjs, tests/fixtures/abstraction-gate-neutral.json
- FOUND commit: c9341423

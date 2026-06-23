---
phase: 172-contextual-invocation-coverage
plan: 08
subsystem: invocation-spine
tags: [cirs, canon-part-11, r4, inv-18, inv-20, inv-21, inv-08, act, decide, shape-f1, cross-class-chain]

# Dependency graph
requires:
  - phase: 172-06
    provides: the WIRED pipeline (the cross-class chain hinge) + the connector spine consumed here
  - phase: 172-03
    provides: scripts/build-orchestration-projection.cjs curatedChainEdges() resolve() (the exact resolver Task 4 extends) + the command-counterpart node ids (command:/mos:<slug>) Task 4 chains
  - phase: 172-10
    provides: the populated curated_chains block + loadCuratedChains() preservation idiom Task 4 extends; the framework/reach-scoped chains Task 4 adds the command/counterpart endpoint kind to (Plan 10 deferred this as a WARN follow-on; Task 4 lands it)
  - phase: 166-gated-chain-executor
    provides: lib/core/chain-executor.cjs runChain + its decideFn seam (default = the real decide()) that act feeds the real decide() into
  - phase: 144-navigation-engine-legacy-engine-flip
    provides: lib/core/navigation-engine.cjs decide() (the ONE governed selection authority act now feeds as decideFn)
provides:
  - "commands/act.md carries a connector block (connects_to_spine true, reach_id context_block, framework null, filing memory_event_only, posture hold, surface F.1); autonomous_safe:false preserved. /mos:act flips gap -> wired."
  - "scripts/act-command.cjs feeds the REAL navigation-engine decide() as runChain's decideFn (the () => null second selection brain is gone) - CIRS R4 / INV-18."
  - "commands/act.md renders its option/approval gates on the canonical Shape F.1 host (INV-20) and runs an internal intent-calibration step before selection/execution (INV-21, LOCAL-only, memory_event journaled via navigation.cjs)."
  - "scripts/build-orchestration-projection.cjs curatedChainEdges() resolve() accepts command/counterpart endpoints (cross-class chaining, navigator directive 2026-06-23); the referential-integrity throw is preserved for unknown endpoints."
  - "data/command-registry.json curated_chains: the act-sequenceable command -> pipeline -> framework chain (command:/mos:find-bottlenecks -> command:/mos:pipeline -> framework:Scenario Planning); materialized as 2 cross-class FEEDS_INTO edges in the projection."
  - "tests/test-act-governed-selection.cjs (5 behaviors) + tests/test-act-cross-class-chain.cjs (4 behaviors), both registered in tests/run-all-172.sh (now 12/12)."
affects: [172-11 (chain-reachability monitor now has cross-class edges to monitor), 172-13 (hard-FAIL gate flip), suggest-next / /mos:act chain surfacing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "act feeds the REAL decide() as runChain's decideFn (lazy-required, degrades to a benign null-handle when the engine is absent); the second ungoverned selection brain is removed (CIRS R4)"
    - "act's option/approval gates render on the Shape F.1 host (lib/hmi/shape-f1-renderer.cjs AskUserQuestion primitive); no hand-rolled selector (INV-20). The F.1 gate lives in act.md (prompt-layer primitive, Phase 88.2 invariant), NOT asserted in act-command.cjs"
    - "intent-calibration step BEFORE selection/execution, LOCAL-only (JTBD + STATE.md + MINTO.md, zero Brain egress), journaled as a memory_event via navigation.cjs (Part 9 enum/scalar packet)"
    - "cross-class endpoint resolution: resolve() accepts an explicit command:/mos:<slug> id in addition to bareword framework/reach; the dangling-endpoint throw is preserved (only the resolvable endpoint KINDS grow, referential integrity intact)"
    - "confidence lives on the curated_chains SOURCE entry (the projection FEEDS_INTO supply), NOT the frozen navigation ALLOWED_EDGE_TYPES FEEDS_INTO (R6 constraint C; edges.cjs untouched)"

key-files:
  created:
    - tests/test-act-governed-selection.cjs
    - tests/test-act-cross-class-chain.cjs
  modified:
    - commands/act.md
    - scripts/act-command.cjs
    - scripts/build-orchestration-projection.cjs
    - data/command-registry.json
    - data/brain-orchestration-projection.json
    - data/connector-registry.json
    - data/connector-coverage-ledger.json
    - data/orchestration-command-ledger.json
    - data/harness-manifest.json
    - lib/memory/orchestration-projection.test.cjs
    - tests/run-all-172.sh

key-decisions:
  - "decideFn wiring = an ADAPTER, not a signature change to decide(). runChain calls decideFn({step,index},{previousOutput}); act adapts that onto decide(turn, context) by seeding a minimal LOCAL turn from the step index. decide() never throws (returns a safe emptyDecision), so a degraded engine yields a benign handle. act's STOP authority stays the chain-autonomy gateFn; only the next-reach DERIVATION moved from the no-op second brain to the real decide()."
  - "act --swarm is WIRED-BY-INHERITANCE under act's one connector (it is a sub-mode of act, not a separate file); recorded in act.md's connector notes. No separate connector or exclusion warranted - the swarm dispatch is a parallel execution mode of the same governed selection, minting no second selection brain."
  - "act connector reach_id = context_block (act surfaces a SELECTION, not a 7th reach); sensor_triggers = [] (act is a standing standing suggestion, OFFERED by the spine, not a single-SENS detector); framework:null + filing:memory_event_only is the legal additive-degrade meta-orchestrator shape (mirrors ignite). autonomous_safe stays false (navigator-gated)."
  - "cross-class chain seed = command:/mos:find-bottlenecks (a mechanical reverse-salient command) -> command:/mos:pipeline -> framework:Scenario Planning. All three endpoints resolve to real projection nodes; 2 new per-edge confidences (0.68, 0.64) distinct from the 13 Plan-10 values."
  - "Test 5 (INV-20) is a committed source-grep on act.md (the F.1 gate is a prompt-layer primitive), NOT an assertion that act-command.cjs calls the renderer - honoring the Phase 88.2 invariant and the plan's explicit constraint."

patterns-established:
  - "The act-sequenceable cross-class chain is the FIRST command -> pipeline -> framework sequence in the projection; resolve() now spans framework/reach/command endpoint kinds with one referential-integrity contract."

requirements-completed: [INV-18, INV-20, INV-21, INV-08]

# Metrics
duration: 41min
completed: 2026-06-23
---

# Phase 172 Plan 08: Act Governed Selection + Cross-Class Chaining Summary

Collapsed /mos:act to ONE governed selection brain (CIRS R4 / INV-18): added the act connector block (autonomous_safe stays false), fed the REAL navigation-engine decide() as act's decideFn (dropped the () => null second selection brain), unified act's option/approval gates onto the canonical Shape F.1 host (INV-20), added act's internal intent-calibration step (INV-21, LOCAL-only, memory_event journaled), classified /mos:pipeline + act --swarm wired-or-excluded, and realized cross-class chaining (navigator directive 2026-06-23): the projection generator resolve() now accepts command/counterpart endpoints so curated_chains can express command -> pipeline -> framework, with a real act-sequenceable chain materialized in the LOCAL projection.

## The cross-class chain seeded (the actual sequence)

`command:/mos:find-bottlenecks` -> `command:/mos:pipeline` -> `framework:Scenario Planning`

Two FEEDS_INTO edges on the LOCAL projection (per-edge curated confidence 0.68 and 0.64, non-uniform). A mechanical reverse-salient command feeds the multi-step pipeline orchestrator, which feeds the Scenario Planning framework. /mos:act can sequence this off the LOCAL projection. No new edge type / node type / reach / Brain wire was minted; referential integrity holds (an unknown command endpoint still throws).

## What shipped

- **Task 1 (commit d014f5b0).** Added the Phase 172 CIRS connector block to commands/act.md (connects_to_spine true, reach_id context_block, sub_mode act, framework null, posture hold, filing memory_event_only, surface F.1; autonomous_safe:false preserved in act's own frontmatter). Recorded --swarm as wired-by-inheritance. Replaced `decideFn: function () { return null; }` in scripts/act-command.cjs with the REAL navigation-engine decide() (lazy-required, adapted to runChain's decideFn contract, degrades to a benign null-handle when the engine is absent). /mos:pipeline already carries a connector block (wired). The second ungoverned selection brain is gone.
- **Task 2 (commit b38284e7).** Replaced the bespoke body_shape:E "yes / pick another / cancel" prose gate (and the chain/swarm yes/modify/cancel prompts) with the canonical Shape F.1 host (lib/hmi/shape-f1-renderer.cjs AskUserQuestion primitive, INV-20). Added Step 2c Intent Calibration (INV-21): runs BEFORE selection/execution, reads LOCAL state only (active JTBD + STATE.md + MINTO.md; zero Brain egress, Part 8), journals the calibrated intent as a memory_event via navigation.cjs (Part 9 enum/scalar packet, never venture content); post-gate handoff calibrate -> approve -> auto-run autonomous_safe prefix -> halt at first material step. MAX_K=3 / DIAL_REACH_K=6 / the F.1 keyboard contract unchanged. Lockstep: regenerated command-registry + harness-manifest (act body_shape frontmatter change).
- **Task 3 (commit 9419886b, TDD).** Regenerated data/connector-registry.json + connector-coverage-ledger.json (/mos:act flips gap -> wired: 80 wired / 43 excluded / 1 gap; the lone remaining gap is /mos:ingest-methodology, pre-existing WARN-only) + the orchestration projection (/mos:act flips to state:ranked). New tests/test-act-governed-selection.cjs (14 assertions across the 5 mandated behaviors). Registered in run-all-172.sh.
- **Task 4 (commit 2e8669fa, TDD).** Extended scripts/build-orchestration-projection.cjs curatedChainEdges() resolve() to accept explicit command:/mos:<slug> endpoints (the projection node ids from Plan 03) alongside framework:/reach:; the dangling-endpoint throw is preserved. Seeded the command -> pipeline -> framework chain in curated_chains; regenerated the projection (70 edges, +2 cross-class FEEDS_INTO; --check exit 0, zero dangling). New tests/test-act-cross-class-chain.cjs (14 assertions, 4 behaviors). Fixed the stale chain-layer-source-empty assertion in lib/memory/orchestration-projection.test.cjs (37/37).

## TDD Gate Compliance

Tasks 3 and 4 carry `tdd="true"`. Both behaviors were shipped within THIS plan's earlier tasks (the wave structure: Task 1-2 ship the act reconciliation Task 3 fences; Task 4's resolve() extension precedes its own test), so each test passes GREEN as a committed source/registry/projection fence on first run. There was no separate RED commit because the implementation legitimately pre-exists in the same plan (per the tdd_execution fail-fast note: a test passing during RED was investigated and confirmed to be the legitimate pre-existing implementation of this plan's own earlier tasks, not a missing-feature false-pass). Both tests are registered in tests/run-all-172.sh (12/12 green).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stale chain-layer-source-empty test assertion (RED since Plan 10)**
- **Found during:** Task 4 (running lib/memory/orchestration-projection.test.cjs after regenerating the projection).
- **Issue:** `testChainLayerSourceEmptyNote` asserted the chain layer is SOURCE-EMPTY (zero chaining edges, curated_chains == []). Plan 10 (commit e5e6ab39, before this plan) populated curated_chains with 13 entries, so this test had been FAILING at the wave-5 baseline (3f14dc07) BEFORE this plan touched anything (verified: baseline curated_chains length == 13). The assertion is now factually wrong - curated_chains is intentionally populated.
- **Fix:** Renamed/rewrote the test as `testChainLayerMaterializedNote`: asserts the chain layer is materialized (chaining edges > 0), the note is no longer SOURCE-EMPTY, still names curated_chains, and reflects the emitted edge count. In-scope because the test is in the chain-layer family Task 4 extends and the plan's frozen-invariant compliance requires the projection tests green.
- **Files modified:** lib/memory/orchestration-projection.test.cjs
- **Commit:** 2e8669fa

### Sanctioned lockstep (not deviations)

- **harness-manifest STALE tripwire** fired after regenerating the command-registry (Task 2) and the connector-registry + projection (Tasks 3, 4). Ran `node scripts/build-harness-manifest.cjs` and staged `data/harness-manifest.json` in the same commit each time - the sanctioned lockstep prior plans hit.
- **connector-registry + coverage-ledger + orchestration projection** were made stale by act's Task-1 connector block (the pre-commit hook only hard-gates the command-registry, so Task 1 committed cleanly); they were regenerated and committed in Task 3 (the registry/ledger regeneration task), with the projection's act-becomes-ranked change folded in.

## Out-of-scope (logged, not fixed)

- **COMMAND-GAP warnings (15 bare commands)** surfaced by the projection --check: pre-existing, WARN-only ("hard-FAIL flips in Plan 172-13"), unrelated to this plan's chain layer or act reconciliation.
- **/mos:ingest-methodology** missing serves_jtbd + its lone coverage-ledger gap: pre-existing build-command-registry / coverage WARNINGs, out of scope.

## Frozen-Invariant Compliance

- No 7th reach minted, no new edge type, no new node type, no new Brain wire opened. ALLOWED_EDGE_TYPES (OPERATES / CHAINS / FEEDS_INTO / PREREQUISITE / CROSS_DOMAIN_ANALOGUE), the 6-reach bank, the 3-posture bank: untouched (the carried test-reach-ids-drift exactly-6 + test-posture-ids-drift exactly-3 ran green in run-all-172.sh).
- MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 RECOMMENDED gate, the F.1 keyboard contract: unchanged (act renders against them, never edits them).
- autonomous_safe stays false in act's frontmatter (navigator-gated; the spine OFFERS act, the navigator CONFIRMS at the F.1 calibration gate - T-172-15 mitigation).
- Confidence lives on the projection FEEDS_INTO source entry only (R6 constraint C); lib/core/navigation/edges.cjs is untouched.
- Calibration reads LOCAL state only (zero Brain egress, Part 8); the intent is journaled as a memory_event enum/scalar packet (Part 9), never venture content.

## Known Stubs

None. The act connector + decideFn + F.1 gate + calibration + cross-class chain are all live (registry-reflected, projection-materialized, test-fenced). The lone coverage gap (/mos:ingest-methodology) and the 15 projection COMMAND-GAPs are honest, measured, pre-existing WARN-only states, not stubs.

## Threat Flags

None. This plan adds no new network endpoint, auth path, file-access pattern, or trust-boundary schema change beyond the plan's threat model (T-172-15 act autonomy mitigated by autonomous_safe:false + the F.1 calibration gate + halt-at-first-material-step; T-172-16 calibration inputs mitigated by LOCAL-only reads + enum/scalar memory_event; T-172-17 second selection brain mitigated by the gone () => null decideFn, asserted by Test 2; T-172-SC no package installs). decide() opens no new Brain wire (Part 11 R7).

## Self-Check: PASSED
- FOUND: commands/act.md (connector: block + F.1 host + Step 2c calibration)
- FOUND: scripts/act-command.cjs (loadRealDecide + decideFn adapter; no () => null)
- FOUND: tests/test-act-governed-selection.cjs (14/14)
- FOUND: tests/test-act-cross-class-chain.cjs (14/14; chain: command:/mos:find-bottlenecks -> command:/mos:pipeline -> framework:Scenario Planning)
- FOUND: commits d014f5b0, b38284e7, 9419886b, 2e8669fa (all in git log)
- VERIFY: node scripts/build-connector-registry.cjs --check -> connector-registry: OK
- VERIFY: node scripts/build-orchestration-projection.cjs --check -> orchestration-projection: OK
- VERIFY: bash tests/run-all-172.sh -> 12/12 PASSED
- VERIFY: lib/memory/orchestration-projection.test -> 37/37
- VERIFY: ALLOWED_EDGE_TYPES + 6-reach/3-posture banks + MAX_K/DIAL_REACH_K unchanged

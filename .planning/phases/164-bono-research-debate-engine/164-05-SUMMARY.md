---
phase: 164-bono-research-debate-engine
plan: 05
subsystem: bono
tags: [debate-composition, runChain-seam, runDerivation, findings-wirer, fable-mode-layer-2, incremental-filing, shape-f, part-2, part-3, part-4, part-7, part-8, part-9, bono]

# Dependency graph
requires:
  - phase: 164-04
    provides: lib/core/bono/cell-fanout.cjs runCellFanout (the collected parallel cell array this consolidates) + the persona-analyst consolidator role
  - phase: 164-02
    provides: lib/core/expert-library.cjs assembleTeam + offerExpertsForFiling + the SyntheticExpert nodes (the slotted onStep consolidators)
  - phase: 166-02
    provides: lib/core/chain-executor.cjs runChain + makeGateFn (the SEQUENTIAL debate spine + the gate predicate)
  - phase: 169-04
    provides: lib/core/graph-derivation.cjs runDerivation + candidateToFinding + CASCADE_SUBSET (the derived-relationship substrate)
  - phase: 131-04
    provides: lib/core/findings-wirer.cjs wireAccept + wireReject (the proposed-NODE-then-typed-EDGE ruling/tension writers)
  - phase: 166-02
    provides: lib/mcp/pipeline-state.cjs initChain/recordStep/checkPosition/makeProvenanceFn (the SOLE chain-state truth + the isNext HARD gate)
provides:
  - lib/core/bono/debate-composition.cjs runDebate (the swarm-out -> runChain-in seam + the debate step sequence + the ruling/tension graph writes composed on the 169 substrate + incremental journal filing)
  - buildSteps + buildArtifactPairs + consolidatorForHat + cellsForHat + defaultConsolidate + the frozen RULING_VERBS / step-command constants
  - commands/bono.md (the /mos:bono front door -- Shape F selector, generated connector on the FROZEN hats reach + bono sub_mode, terminal filing to solution-design/ on APPROVE)
  - tests/test-bono-debate-composition.cjs (the seam + gate-halt + onStep-consolidator + fable-layer-2 + ruling-rides-runDerivation/wireAccept + no-direct-edge-writer assertions) + tests/test-bono-incremental-filing.cjs (journal-before-next + crash-resume + provenance)
affects: [164 Wave-6 verdict (consumes the composition + command surface), future cross-room-expert-reuse amendment]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The swarm-out -> runChain-in seam: a composition module hands the collected PARALLEL cell array into the SEQUENTIAL debate runChain as the seed previousOutput; the fan-out is never re-run inside the loop (runDebate references NO cell-fanout module, grep-asserted)"
    - "COMPOSE on the 169 substrate, never roll a loop: the derived relationships ride graph-derivation.runDerivation (proposed NODE + frozen CASCADE_SUBSET edge); the ruling/tension ride findings-wirer.wireAccept/wireReject (proposed NODE then typed EDGE via the chokepoint); the composition references NO navigation edge-writer directly (grep-asserted)"
    - "fable-mode layer 2 compounds: the SAME selfCritiqueFn rides the material debate runChain steps AND is passed into runDerivation, so a bad debate step OR a bad derived candidate is caught before it folds forward"
    - "Incremental per-step filing: each step journals via pipeline-state initChain/recordStep BEFORE the next runs; resume honors the checkPosition isNext HARD gate so a completed step is never re-run; provenanceFn stamps each step with generic stage metadata (Part 8)"
    - "The /mos:bono front door rides the FROZEN hats reach with a NEW bono sub_mode (the inter-hat debate IS a Six Thinking Hats surface); the connector is GENERATED via build-connector-registry.cjs, never a 7th reach"

key-files:
  created:
    - lib/core/bono/debate-composition.cjs
    - commands/bono.md
    - tests/test-bono-debate-composition.cjs
    - tests/test-bono-incremental-filing.cjs
  modified:
    - tests/run-all-164.sh
    - data/connector-registry.json
    - data/command-registry.json
    - data/harness-manifest.json

key-decisions:
  - "runDebate is the ONLY net-new: it builds the debate STEP SEQUENCE (hypothesis-confirm material gate -> one per-hat argument step -> ruling material gate -> residual-tension filing) and wires the SHIPPED runChain + runDerivation + wireAccept/wireReject + pipeline-state; the derivation loop, the proposed-node-then-edge pattern, the frozen CASCADE_SUBSET, the idempotence guard, and the fable-mode critique seam are CONSUMED, not re-built (Part 7)"
  - "The seam is one-way: the collected cells are the runChain seed previousOutput (kind:cells); runDebate references NO cell-fanout module so the parallel fan-out can never be re-run inside the sequential loop (D-164-S2; grep-asserted in Test 1b)"
  - "The gate HALTS at EXACTLY the two material Part 3 Decision Gates (hypothesis-confirm + ruling): a default postureFn maps those two to halt and the per-hat arguments + tension-filing to push_forward, fed into the SHIPPED makeGateFn (Test 2 asserts halts at exactly those two)"
  - "A hat slot with a confirmed SyntheticExpert (Wave-2 expertsByHat) makes THAT expert the onStep consolidator (consolidatorForHat resolves source:synthetic-expert); a slot with no expert falls back to a generated consolidator (Test 3)"
  - "The ruling APPROVE files via wireAccept (proposed EvidenceClaim NODE + INFORMS/CONTRADICTS/SUPERSEDES edge); a REJECT routes through wireReject carrying the reason as REJECTED_BECAUSE (Part 4); the composition NEVER calls the navigation edge-writer directly (Test 5c source grep)"
  - "/mos:bono rides the FROZEN hats reach + a NEW bono sub_mode (never a 7th reach -- the debate IS a Six Thinking Hats surface, sharing the reach with /mos:think-hats six-hats); posture hold because the debate halts at the material gates; the connector is GENERATED (build-connector-registry.cjs, --check clean)"
  - "The terminal synthesis is RETURNED by runDebate, not auto-filed; the command files it to solution-design/ ONLY on navigator APPROVE (the nugget-routing rule)"

patterns-established:
  - "Pattern: a swarm-out -> runChain-in seam consumes a parallel collected array as the sequential loop's seed previousOutput without ever re-running the fan-out -- the parallel and sequential halves compose without either calling the other"
  - "Pattern: the inter-hat debate's graph writes are 100% composed on the shipped 169 substrate (runDerivation for derived relationships, wireAccept/wireReject for rulings/tensions); the composition owns zero edge SQL and zero derivation loop"

requirements-completed: [D-164-S1, D-164-S2, D-164-S3, D-164-S5]

# Metrics
duration: ~35min
completed: 2026-06-19
---

# Phase 164 Plan 05: The Inter-Hat Debate Composition Seam + /mos:bono Front Door Summary

**The keystone swarm-out -> runChain-in seam (`runDebate`): it hands the Wave-4 collected PARALLEL cell array into the SEQUENTIAL debate runChain as the seed previousOutput (the fan-out is never re-run inside the loop), runs the debate as a step sequence (hypothesis-confirm material gate -> per-hat argument steps -> ruling material gate -> residual-tension filing), and COMPOSES the graph writes on the 169-shipped substrate -- the derived relationships ride `graph-derivation.runDerivation` (proposed NODE + frozen CASCADE_SUBSET edge, fable-mode layer 2) and the ruling/tension ride `findings-wirer.wireAccept`/`wireReject` (REJECT -> REJECTED_BECAUSE), with NO hand-rolled loop and NO direct navigation edge-writer call. Each step journals before the next so a crash-resume never re-runs (the isNext HARD gate). Plus the `/mos:bono` front door: a Shape F selector + a GENERATED connector on the FROZEN hats reach + a bono sub_mode, terminal filing to solution-design/ on navigator APPROVE. Zero new deps, zero Brain egress, zero em-dashes.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-06-19 (post-164-04 main)
- **Completed:** 2026-06-19
- **Tasks:** 2 (Task 1 auto TDD, Task 2 auto)
- **Files modified:** 8 (4 created, 4 modified incl. 3 regenerated registries)

## Accomplishments

### Task 1 -- the swarm-out -> runChain-in seam + the debate step sequence + fable layer 2 + ruling/tension via runDerivation + wireAccept + journal filing

- `lib/core/bono/debate-composition.cjs` (495 lines) ships `runDebate(opts)`:
  - **The seam (D-164-S2):** the Wave-4 collected parallel cell array is the runChain seed `previousOutput` (`{kind:'cells', cells}`); the fan-out is NOT re-run inside the loop. The module references NO cell-fanout module (grep-asserted in Test 1b: the seam is one-way -- cells in as data, never a nested fan-out dispatch).
  - **The step sequence (D-164-S1):** `buildSteps(hats)` emits a hypothesis-confirm step (material), one per-hat argument step per hat (autonomous_safe), a ruling step (material), and a residual-tension filing step. postureFn maps the two material steps to `halt` and the rest to `push_forward`, fed into the SHIPPED `chain-executor.makeGateFn`, so the gate HALTS at EXACTLY the two Part 3 Decision Gates (hypothesis-confirm + ruling) and auto-runs the arguments between them.
  - **The onStep consolidator (D-164-S1):** `consolidatorForHat(hat, expertsByHat)` resolves a hat slot to its confirmed `SyntheticExpert` (Wave-2 `expertsByHat`) as the onStep target (`source:'synthetic-expert'`), or a freshly generated consolidator (`source:'generated'`) when no expert is slotted.
  - **fable-mode layer 2 (D-164-S3):** the SAME `selfCritiqueFn` is passed onto the runChain (rides the material debate steps) AND into `runDerivation` (critiques each derived candidate before it becomes a proposed node), so the debate-side critique compounds the cell-side (Wave-4 layer 1) critique.
  - **The derived relationships ride runDerivation (Part 7, NOT a hand-rolled loop):** `buildArtifactPairs(hypothesisId, hats)` builds the per-hat pairs (each hat's argument paired with the hypothesis, generic node-id handles only -- Part 8); a deriveFn adapts each pair into a candidate tuple (a per-hat CONVERGES/CONTRADICTS/REFINES/ROOT_CAUSES claim ABOUT the hypothesis) that rides `graph-derivation.candidateToFinding`; `runDerivation` is called with `{roomDir, runChain, selfCritiqueFn, deriveFn, artifactPairs}` and writes the survivors as PROPOSED truth-claim NODES + frozen CASCADE_SUBSET edges through the navigation chokepoint.
  - **The ruling + residual tension ride wireAccept/wireReject (Part 7, NOT a direct edge-writer):** the confirmed ruling APPROVE files via `findings-wirer.wireAccept` (proposed EvidenceClaim NODE + INFORMS/CONTRADICTS/SUPERSEDES edge via the chokepoint, review_status on the NODE -- Part 9 role 5); a REJECT routes through `wireReject` carrying the reason as REJECTED_BECAUSE graph data (Part 4). The module references NO navigation edge-writer directly (Test 5c source grep).
  - **Incremental filing (D-164-S5):** `initChain` seeds the SOLE chain-state truth (pipeline-state.json) with the debate step sequence BEFORE the first step; each step's `recordStep` journals BEFORE the next runs (inside the onStep wrapper); resume honors the `checkPosition` isNext HARD gate so a completed step is never re-run; `makeProvenanceFn` stamps each step with generic stage metadata (Part 8).
  - The terminal synthesis is RETURNED (not auto-filed); the command files it on APPROVE (Task 2).
- `tests/test-bono-debate-composition.cjs` (291 lines, 8 checks): Test 1 the seam (collected cells are the seed previousOutput; the step sequence shape), Test 1b the fan-out is NOT re-run (no cell-fanout reference), Test 2 the gate halts at EXACTLY hypothesis-confirm + ruling, Test 3 the slotted SyntheticExpert IS the consolidator (and a generated fallback), Test 4 fable layer 2 (the SAME selfCritiqueFn on material steps AND in runDerivation + the per-hat pairs), Test 5a the derived relationships ride runDerivation with frozen CASCADE_SUBSET edges, Test 5b the ruling files via wireAccept and a REJECT routes through wireReject (REJECTED_BECAUSE), Test 5c the source proves NO direct navigation edge-writer call (and the runDerivation/wireAccept/wireReject/runChain composition IS present).
- `tests/test-bono-incremental-filing.cjs` (118 lines, 3 checks): Test 6a each step journals via pipeline-state BEFORE the next (real tmp roomDir, the journal chain IS the debate step sequence, every step recorded in order, cursor advanced), Test 6b a crash-resume does NOT re-run a completed step (the checkPosition isNext HARD gate: a completed step withholds with reason `not_next`, the next expected step runs), Test 6c provenanceFn stamps each step (pipeline:'bono-debate', pipeline_stage:index -- generic, Part 8).
- Task 1 verify: `node tests/test-bono-debate-composition.cjs && node tests/test-bono-incremental-filing.cjs && echo SEAM_OK` returns `SEAM_OK`.

### Task 2 -- the /mos:bono front door (Shape F selector, generated connector, terminal filing on APPROVE)

- `commands/bono.md` is the `/mos:bono` front door (D-164-S4):
  - documents the flow: (1) a Shape F selector for scope / purpose / substrates / hypothesis (the graph-proposed what-if surfaced for navigator confirm/edit), (2) the Wave-4 parallel cell fan-out over the (subdomain x hat) grid from Engine 1 decomposition + Wave-2 `assembleTeam` (confirmed experts first, generate gaps, the three anti-ossification guards), (3) the Wave-5 `runDebate` seam (the two material gates, derived relationships riding runDerivation, ruling/tension riding wireAccept), (4) the offer of the run's high-value hats as reusable SyntheticExperts (`offerExpertsForFiling` -> `confirmNode` on APPROVE), (5) terminal synthesis filed to solution-design/ ONLY on navigator APPROVE (the nugget-routing rule).
  - in-body hard rules stated verbatim: all writes LOCAL via the runDerivation + wireAccept/wireReject chokepoints (Part 9, no direct edge-writer, no new edge type, edges from the frozen CASCADE_SUBSET + INFORMS/CONTRADICTS/SUPERSEDES/REJECTED_BECAUSE set); Brain generic-methodology read-only (Part 8); tri-polar (CLI dial-TUI selector + Desktop/Cowork structured-prompt fallback); no emoji/em-dashes.
  - footer-routes `commands/think-hats.md` + `commands/persona.md` as sibling hats surfaces.
- **The connector is GENERATED, not hand-minted (D-164-S4):** the `connector:` block rides the FROZEN `hats` reach with a NEW `bono` sub_mode (never a 7th reach -- the inter-hat debate IS a Six Thinking Hats surface, sharing the reach with `/mos:think-hats` `six-hats`); posture `hold` because the debate halts at the material gates. `node scripts/build-connector-registry.cjs` was re-run (the generated path); the registry grew 59 -> 60 connectors with the `hats`/`bono` tuple, and `--check` is clean (no 7th reach, no duplicate tuple).
- `tests/run-all-164.sh` updated: both Wave-5 suites appended to `CJS_SUITES`; debate-composition.cjs + both tests + commands/bono.md added to the em-dash sweep targets. The existing connector --check assertion already guards the no-7th-reach invariant.
- Task 2 verify: `node scripts/build-connector-registry.cjs --check && grep Shape F/scope/hypothesis && grep solution-design && bash tests/run-all-164.sh && echo BONO_OK` returns `BONO_OK`.

### Phase gate

- `bash tests/run-all-164.sh` is GREEN at **13/13** (9 CJS suites + schema-alias guard + frozen-set assertion + connector --check + diagnose issue-tree sub_mode + em-dash sweep).
- `node scripts/build-connector-registry.cjs --check` is clean (no 7th reach, no duplicate tuple).
- Carried floors green: `run-all-163.sh`, `run-all-168.sh`, `run-all-169.sh` all GREEN.
- The Wave-6 verdict stub remains RED-by-absence (not on disk, unregistered) -- it appends its suite when it lands.

## Task Commits

1. **Task 1** -- `3258c85f` (feat): `lib/core/bono/debate-composition.cjs` runDebate (the seam + step sequence + fable layer 2 + ruling/tension via runDerivation + wireAccept/wireReject + journal filing) + both test suites + run-all-164.sh registration; `SEAM_OK`.
2. **Task 2** -- `5c53f088` (feat): `commands/bono.md` (the /mos:bono front door, Shape F selector + generated connector on the frozen hats reach + bono sub_mode + terminal filing on APPROVE) + all three drift-gated registries regenerated; `BONO_OK`.

**Plan metadata:** this SUMMARY + STATE.md + ROADMAP.md committed in the final docs commit.

## Files Created/Modified

- `lib/core/bono/debate-composition.cjs` (created) -- runDebate + buildSteps + buildArtifactPairs + consolidatorForHat + cellsForHat + defaultConsolidate + frozen RULING_VERBS / step-command constants
- `commands/bono.md` (created) -- the /mos:bono front door (Shape F selector + generated hats/bono connector + the fan-out -> assemble -> debate -> mint-experts -> synthesize flow + terminal filing on APPROVE + in-body hard rules + footer routing)
- `tests/test-bono-debate-composition.cjs` (created) -- the seam + gate-halts + onStep-consolidator + fable-layer-2 + ruling-rides-runDerivation/wireAccept + no-direct-edge-writer (8 checks)
- `tests/test-bono-incremental-filing.cjs` (created) -- journal-before-next + crash-resume isNext HARD gate + provenance stamps (3 checks)
- `tests/run-all-164.sh` (modified) -- both Wave-5 suites registered + debate-composition.cjs/both tests/bono.md added to the em-dash sweep
- `data/connector-registry.json` (regenerated) -- the hats/bono tuple landed (60 connectors)
- `data/command-registry.json` (regenerated) -- the bono command frontmatter (99 commands; the pre-commit drift gate)
- `data/harness-manifest.json` (regenerated) -- posture/wiring/ranked_next_reach maps re-digested (the pre-commit drift gate)

## Decisions Made

- The ONLY net-new is the COMPOSITION module + the /mos:bono selector. The derivation loop, the proposed-node-then-edge pattern, the frozen CASCADE_SUBSET, the idempotence guard, the gate predicate, the fable-mode critique seam, the journal, and the posture authority are all CONSUMED from the shipped 166/169/131/pipeline-state modules (Part 7 reuse before build).
- The seam is one-way: runDebate references NO cell-fanout module so the parallel fan-out can never be re-run inside the sequential loop. The collected cells are passed as the runChain seed previousOutput (data), satisfying D-164-S2.
- runChainFn / runDerivationFn / wireAcceptFn / wireRejectFn / deriveFn / selfCritiqueFn / onStep / gateFn / postureFn / onHalt / journalFns are ALL injectable for headless testability; production runs the shipped-module defaults.
- /mos:bono rides the frozen `hats` reach (the inter-hat debate IS Six Thinking Hats) with a new `bono` sub_mode; the connector was REGENERATED via the build script (the generated D-164-S4 path), proving no 7th reach landed.

## Deviations from Plan

**1. [Rule 1 - Bug] Reworded source comments to avoid the literal `runCellFanout` / `writeEdge` tokens**
- **Found during:** Task 1 (Tests 1b + 5c, the not-fan-out and not-direct-edge-writer source grep-asserts failed).
- **Issue:** the module's explanatory comments referenced the literal `runCellFanout` and `navigation.writeEdge` tokens (describing what the composition does NOT do); the source grep-asserts (correctly) reject the literal tokens, so the comments tripped the very assertions they described (the SAME pattern the Wave-4 deviation hit).
- **Fix:** reworded every such comment ("the parallel cell fan-out module" / "the navigation edge-writer") while preserving the meaning. No behavior change.
- **Files modified:** lib/core/bono/debate-composition.cjs
- **Commit:** 3258c85f (the change was made before the commit landed).

**2. [Rule 3 - Blocking] Regenerated the command-registry + harness-manifest drift gates on the new command**
- **Found during:** Task 2 commit (the pre-commit hook fired command-registry-drift then harness-manifest-drift).
- **Issue:** creating `commands/bono.md` made `data/command-registry.json` AND `data/harness-manifest.json` stale (a new command changes the generated maps); the pre-commit drift gates blocked the commit.
- **Fix:** ran `node scripts/build-command-registry.cjs` (99 commands) and `node scripts/build-harness-manifest.cjs` (posture/wiring/ranked_next_reach), staged both. This is the anticipated registry-regeneration Rule-3 fix (the plan's rules_carry: "If a connector/manifest drift gate fires, regenerate the registries").
- **Files modified:** data/command-registry.json, data/harness-manifest.json
- **Commit:** 5c53f088.

## Issues Encountered

- `.planning/` is gitignored, so staging this SUMMARY requires `git add -f` (the established Phase-169 / 164-01..04 fallback). `gsd-tools` was unavailable, so STATE.md / ROADMAP.md were updated directly and committed.

## User Setup Required

None - no external service configuration required. Zero new dependencies (pure Node built-ins + the shipped runChain + graph-derivation + findings-wirer + pipeline-state modules). Zero Brain egress (Part 8): the composition opens no Brain wire; the derived relationships + ruling/tension are LOCAL room.db writes through the navigation chokepoint reached only via runDerivation + wireAccept/wireReject; the consolidator's Brain leg (per the persona-analyst doctrine) carries generic handles + enums only.

## Known Stubs

None introduced. `defaultConsolidate` and `defaultDeriveFn` are deliberately conservative defaults (an `undecided` ruling verb / a CONVERGES derived relationship) overridable via injected `onStep` / `deriveFn` -- the documented composition contract, not a stub. The terminal synthesis is RETURNED for the command to file on APPROVE (the deliberate Part 9 / nugget-routing design), not an unwired data sink.

## Threat Flags

None. The module introduces no new network surface (it composes the shipped runChain + graph-derivation + findings-wirer + pipeline-state), no new auth path, no schema change at a trust boundary, and no new edge type. The threat register dispositions are honored: T-164-19 (the gate halts at the two material Part 3 gates -- Test 2 asserts halts at exactly hypothesis-confirm + ruling), T-164-20 (fable-mode layer 2 on material steps + runDerivation candidate critique -- Test 4), T-164-21 (pipeline-state journals before next + the isNext HARD gate -- Test 6b), T-164-22 (zero Brain egress -- the composition opens no Brain wire), T-164-23 (no 7th reach -- the connector --check pins /mos:bono to the frozen hats reach + bono sub_mode), T-164-24 (the parallel fan-out is never forced through runChain -- Test 1b grep-asserts no cell-fanout reference), T-164-32 (no non-frozen edge -- the composition NEVER calls the navigation edge-writer directly, all edges flow through runDerivation's CASCADE_SUBSET + wireAccept/wireReject; Test 5c), T-164-SC (zero new packages).

## TDD Gate Compliance

Task 1 carried `tdd="true"`. The module + both test suites were developed together against the cited chain-executor + graph-derivation + findings-wirer + pipeline-state contracts; the suites encode the RED behavior (the seam, the two gate halts, the onStep consolidator, fable layer 2, the runDerivation/wireAccept composition, the no-direct-edge-writer source assertion, the journal-before-next + crash-resume) and the module turns them GREEN. They are committed in the single behavior commit (3258c85f) honestly noted here, matching the established Phase-164 single-commit pattern for a behavior-adding task where the module and its instrumentation land together. Task 2 (the command-doc + connector-regeneration task) is `type="auto"` (documentation + generated wiring, not behavior-adding code), committed once (5c53f088).

## Self-Check: PASSED

- All created/modified files exist on disk: debate-composition.cjs, commands/bono.md, test-bono-debate-composition.cjs, test-bono-incremental-filing.cjs, run-all-164.sh (registration), connector-registry.json + command-registry.json + harness-manifest.json (regenerated), this SUMMARY.
- Both task commits exist in git history: 3258c85f, 5c53f088.
- `node tests/test-bono-debate-composition.cjs` 8/8 green; `node tests/test-bono-incremental-filing.cjs` 3/3 green; `bash tests/run-all-164.sh` 13/13 green; carried 163/168/169 floors green.
- `node scripts/build-connector-registry.cjs --check` clean (no 7th reach; the hats/bono tuple landed).
- No em-dashes in any created or modified file (the run-all-164.sh em-dash sweep covers debate-composition.cjs + both tests + bono.md + passes; a direct scan of all four new files is clean).
- min_lines satisfied: debate-composition.cjs 495 (>=120), test-bono-debate-composition.cjs 291 (>=70), test-bono-incremental-filing.cjs 118 (>=50); commands/bono.md contains "bono".

---
*Phase: 164-bono-research-debate-engine*
*Completed: 2026-06-19*

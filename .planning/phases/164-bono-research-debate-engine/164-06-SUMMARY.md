---
phase: 164-bono-research-debate-engine
plan: 06
subsystem: bono
tags: [adversarial-verdict, harness-as-code-property-6, part-8-leak-scan, phase-gate, compose-on-substrate, parallel-not-runChain, e2-remap, canon-v1.13, part-3, part-4, part-8, part-9, bono]

# Dependency graph
requires:
  - phase: 164-01
    provides: lib/core/navigation/transitions.cjs TRUTH_CLAIM_TYPES (SyntheticExpert) + promoteNodeStatus human-confirm gate + the v1.13 / Appendix D entry 24 canon amendment
  - phase: 164-02
    provides: lib/core/navigation/synthetic-expert.cjs writeSyntheticExpertNode (proposed + forbidden_field) + lib/core/expert-library.cjs assembleTeam (library-first + anti-ossification)
  - phase: 164-03
    provides: lib/core/issue-tree.cjs toGraphEdges (the E2-remap frozen-edge emission)
  - phase: 164-04
    provides: lib/core/bono/cell-fanout.cjs runCellFanout (the parallel fan-out + fable-mode layer 1)
  - phase: 164-05
    provides: lib/core/bono/debate-composition.cjs runDebate (the runChain seam composed on runDerivation + wireAccept) + commands/bono.md + agents/persona-analyst.md
provides:
  - tests/test-bono-verdict.cjs (the adversarial {passed, findings[]} structured verdict over the net-new BONO engine + the canon guards, proven BY INSTRUMENTATION; 13 checks)
  - tests/test-bono-part8-leak.cjs (the Part 8 leak scan over all 8 Phase-164 lib + command + agent surfaces; 23 checks)
  - tests/run-all-164.sh (the FINALIZED single PASS/FAIL phase gate: 11 suites + schema-alias guard + frozen-set assertion + connector --check + parallel-not-runChain grep + compose-on-substrate grep + frozen-vocabulary grep + canon-version assertion + Part-8 sweep + em-dash sweep = 20/20)
affects: [Phase 164 COMPLETE -- the harness-as-code property 6 closed; the BONO Research/Debate Engine is proven end to end]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The adversarial structured verdict (harness-as-code property 6): a record(check, passed, detail) accumulator that pushes {check, passed, detail} into findings[], prints the structured {passed, findings[]} verdict, and exits non-zero printing the failures -- mirrors the shipped Phase 169 W6 / 166 W8 / 163 W6 idiom VERBATIM in shape. The verdict DRIVES the real shipped surfaces (never mocks the production module) and greps the real source, so every claim is proven by instrumentation."
    - "Async-aware verdict harness: checks are registered as (check, fn) pairs and RUN sequentially inside an async main() so a sync fn and an async fn (the cell-fanout Promise.all leg) are awaited uniformly; a thrown/rejected AssertionError becomes a FAILED finding carrying the message, so a genuine breach is surfaced, never swallowed."
    - "The Part 8 boundary DIRECTION in a leak scan: LOCAL -> BRAIN is the breach; BRAIN methodology -> LOCAL is ALLOWED. The Brain-WRITE token (mcp__brain_write/store/upsert/ingest) is the canonical breach checked across EVERY surface; the egress-wire (Brain-host URL / brain-client require) + raw-fetch checks are scoped to lib surfaces only, because a command/agent markdown that documents a generic-handle Brain READ is the Part-8-legal Mode A path, not an egress wire."
    - "Comment-filtered negative greps: a source body is stripped of CJS comment lines (leading // or * or /*) before the parallel-not-runChain + compose-on-substrate + frozen-vocabulary greps so a doc comment naming a forbidden token cannot self-invalidate the count (the run-all grep -v idiom)."

key-files:
  created:
    - tests/test-bono-verdict.cjs
    - tests/test-bono-part8-leak.cjs
  modified:
    - tests/run-all-164.sh

decisions:
  - "The verdict proves D-164-S1 BY the REAL runChain halt semantics: the chain halts at the FIRST material gate (hypothesis-confirm) per Canon Part 3 -- it does NOT proceed to the ruling in a single pass. The verdict drives TWO scenarios: (A) the default gate halts at hypothesis-confirm; (B) hypothesis greenlit so the arguments auto-run + provenance stamps + the ruling becomes the material halt. This is the canonically-correct instrumentation; an earlier draft that asserted BOTH gates halt in one pass was a verdict-setup defect, corrected."
  - "The runChain gate verb is a STRING ('run' | 'halt'), not a {decision} object; the verdict gateFns return the string. (Self-defect corrected.)"
  - "The library-first hit assertion uses a MULTI-slot run (one hit + one guaranteed miss): the anti-ossification mandatory-fresh guard (Guard 1) correctly forces a LONE all-hit run back to fresh, so a single-slot hit run generates-fresh by design. Pairing the hit with a miss lets the miss satisfy mandatory-fresh and the hit slot survives as a genuine reuse. (Self-defect corrected -- assembleTeam behavior is correct.)"
  - "provenanceFn is verified via journalFns.makeProvenanceFn (the pipeline-state idiom runDebate actually consumes), not the caller's provenanceFn arg (runDebate ignores that). (Self-defect corrected.)"

metrics:
  duration: ~40m
  tasks: 2
  files: 3
  completed: 2026-06-19
---

# Phase 164 Plan 06: BONO Adversarial Verdict + Finalized Phase Gate Summary

The adversarial structured `{passed, findings[]}` verdict that proves the BONO Research/Debate Engine end to end BY INSTRUMENTATION (harness-as-code property 6), plus the Part 8 leak scan over every Phase-164 surface, plus the finalized `tests/run-all-164.sh` that is the single PASS/FAIL phase gate. Phase 164 is GREEN: 20/20, Failed 0, exit 0.

## What shipped

### Task 1 -- the adversarial verdict + the Part 8 leak scan (commit a66e9d6b)

`tests/test-bono-verdict.cjs` (602 lines, 13 checks) returns a structured `{passed, findings[]}` verdict mirroring the shipped Phase 169 W6 / 166 W8 / 163 W6 idiom VERBATIM in shape. It proves, by driving the real shipped surfaces and grepping the real source:

1. **E1 human-confirm-gate** -- `writeSyntheticExpertNode` mints PROPOSED; an agent-attributed confirm is REJECTED (`agent_attribution_forbidden`); a human `byUser` promotes to confirmed (Part 9 role 5).
2. **E1 generic-only** -- a venture-body params key is rejected `forbidden_field` BEFORE any insert (Part 8).
3. **library-first + anti-ossification** -- `assembleTeam` slots a confirmed hit, generates fresh on a miss, ALWAYS re-derives Black, guarantees a mandatory-fresh slot, and caps reuse at K < N.
4. **E2-remap** -- `issue-tree.toGraphEdges` emits ONLY frozen `ALLOWED_EDGE_TYPES` members (`PART_OF` / `INFORMS` / `INVALIDATES` / `ROOT_CAUSES` / `ENABLES`), never `INVALIDATED` / `RESOLVES_VIA` / `BELONGS_TO`.
5. **D-164-S2 parallel-not-runChain negative** -- `cell-fanout.cjs` source has NO chain-executor require and NO `runChain` call; `Promise.all` is the parallel mechanic (comment-filtered).
6. **compose-on-169-substrate** -- `debate-composition.cjs` REQUIRES `graph-derivation` (`runDerivation`) AND `findings-wirer` (`wireAccept`) and makes ZERO direct `navigation.writeEdge` call (comment-filtered).
7. **D-164-S1 debate-IS-runChain** -- the chain halts at the FIRST material gate (hypothesis-confirm) per Canon Part 3; `buildSteps` marks both material steps; with hypothesis greenlit the arguments auto-run, provenance stamps, the ruling is the material halt, no material step auto-runs (T-164-25); the injected `runDerivation` + `wireAccept` spies are both called.
8. **D-164-S3 two-layered fable-mode** -- a bad cell reading is dropped pre-collection (cell-side layer 1) AND `runDerivation` is invoked WITH a `selfCritiqueFn` (derivation-side layer 2).
9. **D-164-S5 incremental filing** -- each step journals via `initChain`/`recordStep` BEFORE the next; the `checkPosition` isNext HARD gate rejects re-running a completed step.
10. **Part 3 ruling** -- the ruling routes through `wireAccept` on APPROVE; a contradicting residual tension routes through `wireReject` carrying the reason (`REJECTED_BECAUSE` graph data).
11. **E1 CANON** -- `MINDRIAN-CANON.md` header + footer are v1.13 AND Appendix D entry 24 (SyntheticExpert) exists, stacked on Phase 169's v1.12 / entry 23.
12. **Part 8 sweep** -- delegates to the leak-scan suite (asserts it exits 0).
13. **no em-dash** self-check across the verify surfaces.

`tests/test-bono-part8-leak.cjs` (179 lines, 23 checks) scans all 8 Phase-164 surfaces (`cell-fanout`, `debate-composition`, `issue-tree`, `synthetic-expert`, `expert-library`, `bono.md`, `diagnose.md`, `persona-analyst.md`) for the Brain-WRITE forbidden-token vocabulary across EVERY surface, and the egress-wire / raw-fetch / external-http checks scoped to the lib surfaces only.

### Task 2 -- the finalized phase gate (commit e5583fa8)

`tests/run-all-164.sh` (421 lines) is the single PASS/FAIL phase gate. It runs 11 suites + the schema-alias guard + the frozen-set assertion + the connector `--check` + the D-164-S2 parallel-not-runChain negative grep + the compose-on-169-substrate grep + the frozen-vocabulary grep + the v1.13 canon-version assertion + the Part-8 grep sweep + the em-dash sweep. Final tally: **20 total, 20 passed, 0 failed, exit 0**.

## Deviations from Plan

### Auto-fixed Issues

All deviations were defects in the VERDICT TEST SETUP (my own work in this plan), surfaced by the verdict's first run and corrected before commit. NONE were defects in Waves 1-5 -- the BONO engine surfaces are sound by instrumentation. Per the plan's rule ("if the verdict surfaces a REAL defect in Waves 1-5, report it and STOP"), no Wave 1-5 patch was made and no orchestrator stop was warranted.

**1. [Rule 1 - Bug] The Part 8 leak scan over-broadly flagged a legal Brain READ**
- **Found during:** Task 1, first run of `test-bono-part8-leak.cjs`.
- **Issue:** the initial `BRAIN_HOST` regex fired on `mcp__mindrian-brain__brain_schema` in `commands/diagnose.md` -- a documented Brain READ, which is the Part-8-LEGAL Mode A path (`BRAIN methodology -> LOCAL: YES`). The canonical breach is a Brain-WRITE (`LOCAL -> BRAIN`), not a read host.
- **Fix:** scoped the Brain-WRITE token check to every surface (the real breach) and the egress-wire / raw-fetch / external-http checks to the lib surfaces only (where a smuggled egress wire would live), mirroring the run-all-169 idiom. Documented the boundary direction in the suite header.
- **Files modified:** tests/test-bono-part8-leak.cjs
- **Commit:** a66e9d6b

**2. [Rule 1 - Bug] The verdict gateFn returned a {decision} object instead of the string runChain expects**
- **Found during:** Task 1, first run of `test-bono-verdict.cjs`.
- **Issue:** the real `chain-executor.runChain` gate verb is a STRING (`'run' | 'halt'`); the verdict gateFns returned `{ decision: ... }`, so the gate semantics misbehaved.
- **Fix:** every verdict gateFn returns the string verb.
- **Files modified:** tests/test-bono-verdict.cjs
- **Commit:** a66e9d6b

**3. [Rule 1 - Bug] The D-164-S1 check asserted both material gates halt in one pass**
- **Found during:** Task 1, first run.
- **Issue:** runChain halts at the FIRST material step (hypothesis-confirm) per Canon Part 3 and does NOT proceed to the ruling in a single pass; the original assertion expected both to halt at once.
- **Fix:** restructured into two scenarios -- (A) the default gate halts at hypothesis-confirm (asserting `haltedAt.step.command === HYPOTHESIS_STEP`); (B) hypothesis greenlit so the arguments auto-run + provenance stamps + the ruling is the material halt. Also moved provenance verification to `journalFns.makeProvenanceFn` (the path runDebate actually consumes).
- **Files modified:** tests/test-bono-verdict.cjs
- **Commit:** a66e9d6b

**4. [Rule 1 - Bug] The library-hit check used a single-slot run that mandatory-fresh correctly forces to fresh**
- **Found during:** Task 1, first run.
- **Issue:** `assembleTeam`'s mandatory-fresh guard (Guard 1) correctly forces a LONE all-hit run back to generate-fresh, so a single-slot hit run never shows `reuse`.
- **Fix:** paired the hit slot with a guaranteed-miss slot so the miss satisfies mandatory-fresh and the hit survives as a genuine reuse. The `assembleTeam` behavior is correct -- this was a verdict-setup expectation defect.
- **Files modified:** tests/test-bono-verdict.cjs
- **Commit:** a66e9d6b

## Threat coverage

The verdict + the run-all greps mitigate the full Phase-164 STRIDE register: T-164-25 (material gate auto-running -- the verdict asserts no material step auto-runs), T-164-26 (egress -- the Part 8 sweep + leak scan), T-164-27 (parallel fan-out smuggling runChain -- the negative grep + verdict check), T-164-28 (non-frozen issue-tree edge -- the frozen-vocabulary grep + E2-remap check), T-164-29 (agent-minted confirmed expert -- the human-confirm-gate check), T-164-30 (re-run resumed step -- the isNext gate check), T-164-31 (a 7th reach -- the connector --check), T-164-33 (hand-rolled derivation loop / direct edge write -- the compose-on-substrate grep + check), T-164-34 (stale canon version -- the canon-version assertion + check), T-164-SC (npm/pip installs -- zero new deps this plan).

## Known Stubs

None. The verdict + leak scan + phase gate are complete, drive the real shipped surfaces, and pass with zero stubs.

## Self-Check: PASSED

- tests/test-bono-verdict.cjs -- FOUND (13/13 checks pass; VERDICT passed:true)
- tests/test-bono-part8-leak.cjs -- FOUND (23/23 checks pass; VERDICT passed:true)
- tests/run-all-164.sh -- FOUND (20/20, Failed 0, exit 0)
- commit a66e9d6b -- FOUND
- commit e5583fa8 -- FOUND

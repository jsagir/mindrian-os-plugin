---
phase: 166-gated-chain-executor
plan: 05
subsystem: chain-executor
tags: [pipeline, runChain, migration, consumer, provenanceFn, resume, sole-truth, capture-before-wire, canon-part-3, canon-part-7, canon-part-8]
requires:
  - 166-02 (chain-executor.cjs runChain spine + provenanceFn callback slot)
  - 166-03 (pipeline-state isNext hard gate)
  - 166-04 (act migration pattern: capture-before-refactor drift net)
  - lib/mcp/pipeline-state.cjs initChain/recordStep/checkPosition/getPreviousOutput (the resume substrate)
provides:
  - the FIRST-ever pipeline-state.cjs coverage (the untested store's shipped behavior captured)
  - makeProvenanceFn(chainName) -- stage -> { pipeline, pipeline_stage } frontmatter stamp
  - reconcileResume(roomDir) -- pipeline-state.json the SOLE truth; frontmatter scan SECONDARY (B1 executable)
  - commands/pipeline.md repointed onto runChain as a consumer
  - PRE === POST identity proof: the additive wiring drifted the shipped store nothing
affects:
  - lib/mcp/pipeline-state.cjs
  - commands/pipeline.md
  - tests/run-all-166.sh
tech-stack:
  added: []
  patterns:
    - "untested-store capture-first: snapshot the SHIPPED round-trip as the module's FIRST coverage BEFORE additive wiring, assert PRE === POST after"
    - "consumer onto the shared spine: the pipeline supplies provenanceFn (act/ignite pass null) and resumes from one store"
    - "sole-truth reconciliation: the store wins; the frontmatter scan is a secondary confirming index, flagged stale on disagreement"
key-files:
  created:
    - tests/test-pipeline-state-shipped-behavior.cjs
    - tests/test-pipeline-on-runchain.cjs
  modified:
    - lib/mcp/pipeline-state.cjs
    - commands/pipeline.md
    - tests/run-all-166.sh
decisions:
  - "makeProvenanceFn(null) returns null (not a no-op fn) so single-mode callers (act/ignite) keep passing provenanceFn:null literally -- the pipeline is the one consumer that supplies a real stamp"
  - "reconcileResume takes the secondary frontmatter count as an opts input (frontmatterStagesComplete) rather than scanning disk itself: the SOLE truth read stays inside pipeline-state.cjs, the scan stays the caller's secondary index, and the disagreement-resolution is unit-testable without a fixture room of artifacts"
  - "the provenanceFn stamp is enum/scalar only (pipeline name + stage number from step.step); it never copies the result body (Part 8 T-166-18 accept)"
metrics:
  duration: ~6 minutes
  completed: 2026-06-18
  tasks: 3
  files_created: 2
  files_modified: 3
  commits: 3
---

# Phase 166 Plan 05: MIGRATE pipeline onto runChain Summary

The pipeline (commands/pipeline.md) is now a CONSUMER of the shared `lib/core/chain-executor.cjs` `runChain` spine: it supplies a `provenanceFn` that stamps each stage artifact's `pipeline` + `pipeline_stage` frontmatter, and it sources RESUME from `lib/mcp/pipeline-state.cjs` ONLY (the SOLE chain-state truth, B1/D-166-02) with the artifact-frontmatter scan demoted to a SECONDARY confirming index. Because pipeline-state.cjs shipped UNTESTED, its FIRST coverage captured the shipped store behavior BEFORE the additive wiring landed, and the migration suite re-asserts PRE === POST so the new wiring drifted the store nothing.

## What Was Built

**Task 1 (commit `0feb2867`) -- the FIRST-ever pipeline-state.cjs coverage.** `tests/test-pipeline-state-shipped-behavior.cjs` exercises the SHIPPED store over tmp room dirs and records the round-trip as a baseline: `initChain` seeds `chain_position = -1` with the ordered chain (pipeline-state.cjs:120-134); `checkPosition` returns the shipped `{ inPipeline, isNext, gate, reason, expectedNext, chain, previousOutput }` shape (pipeline-state.cjs:210-239); `recordStep` advances `chain_position` and re-points `suggested_next` per the shipped nextExpected logic (pipeline-state.cjs:148-190); a completed stage withholds through the isNext hard gate; `getPreviousOutput` round-trips the recorded path (pipeline-state.cjs:248-252); and the full a->b->c walk advances 0->1->2 then surfaces `suggested_next: null`. Committed BEFORE Task 2 touched the module -- the store's truth recorded before it was extended.

**Task 2 (commit `374c8c0c`) -- the wiring (TDD).** RED: `tests/test-pipeline-on-runchain.cjs` asserting `makeProvenanceFn` existed failed (undefined). GREEN: `lib/mcp/pipeline-state.cjs` gained `makeProvenanceFn(chainName)` -- a `(step, result) -> { pipeline: chainName, pipeline_stage: step.step }` factory mirroring framework-runner.md:220 (returns `null` for single-mode / no-chain, exactly as act and ignite pass `provenanceFn: null`) -- and `reconcileResume(roomDir, opts)` -- which reads the chain position from THIS store as the SOLE truth and treats the artifact-frontmatter scan (the commands/pipeline.md:78-114 block) as a SECONDARY confirming index: AGREE returns the position; DISAGREE trusts pipeline-state.json and flags the frontmatter STALE (never the reverse). All existing exports byte-stable. The migration suite covers the five behaviors: provenanceFn stamp + single-mode null, sole-truth resume, reconcile agree/disagree, no double-run on a completed stage, and Test 5 re-runs the Task-1 suite as a child process to prove PRE === POST.

**Task 3 (commit `d858b9c0`) -- repoint + registration.** `commands/pipeline.md` gained a "Runtime: the shared runChain spine" section naming `lib/core/chain-executor.cjs` `runChain` and the four callbacks (provenanceFn = makeProvenanceFn, postureFn = recipe-maps.postureForCommand, default gateFn, onStep dispatches framework-runner); the ~60 duplicated stage-walk lines are now the shared spine (de-dup). The Pipeline Resumption Check and the "Pipeline resumability" behavioral rule were rewritten to read resume from pipeline-state.cjs via reconcileResume (the SOLE truth) with the frontmatter scan explicitly described as a SECONDARY confirming index, not a competing source -- the user-facing half of the B1 reconciliation. `tests/run-all-166.sh` registers both suites in dependency order (shipped-behavior FIRST, then migration), adds `lib/mcp/pipeline-state.cjs` to the Part-8 grep sweep, and extends the em-dash sweep to `commands/pipeline.md` and the two new suites.

## How "No Drift on the Untested Store" Is VERIFIED

The HIGH-1 gap was that pipeline-state.cjs ships UNTESTED, so additive wiring (reconcileResume + makeProvenanceFn) could silently reshape the store with nothing to catch it. The fix is instrumentation, not assertion:

1. The shipped `initChain` / `checkPosition` / `recordStep` / `chain_position` / `getPreviousOutput` round-trip is captured to a committed suite BEFORE the wiring (Task 1).
2. After the wiring, the migration suite's Test 5 re-runs the Task-1 suite as a child process; a non-zero exit throws. It exits zero -- the shipped behavior is byte/behavior-identical.
3. All prior exports are unchanged; the two new exports are purely additive.

The migration is faithful only if PRE === POST, and the green suites prove it.

## Deviations from Plan

None - plan executed exactly as written. `reconcileResume` takes the secondary-index count as an `opts.frontmatterStagesComplete` input rather than re-scanning disk, which keeps the SOLE-truth read inside pipeline-state.cjs and makes the agree/disagree resolution unit-testable without staging a room full of frontmatter artifacts; the plan's behavior contract (store wins, frontmatter flagged stale on disagreement) is honored exactly.

## Canon / Hard-Rule Gates

- **Canon Part 7 (Reuse Before Build):** the pipeline re-implements no loop and no posture -- the walk ownership is the shared runChain spine; the store already existed and was extended with two thin helpers (no rebuild of the store or the command).
- **Canon Part 8 (Graph Boundary), B2:** `decide()` shape untouched (navigation-engine.cjs unmodified). The provenanceFn stamp is enum/scalar only (pipeline name + stage number); it never copies the result body and never crosses to Brain (T-166-18 accept). pipeline-state.cjs Part-8 grep sweep PASSED (no Brain-write / raw-fetch / brain-client tokens).
- **Canon Part 3:** runChain halts at the first material step and hands to the Tri-Context gate; the pipeline's stage-by-stage-with-checkpoints user contract is preserved.
- **No em-dashes:** direct + runner em-dash sweeps PASSED over all edited + created files.
- **Suite registration:** both new suites appended to run-all-166.sh CJS_SUITES (prior Wave 1-4 entries untouched); full suite green 12/12.

## Verification Evidence

- `node tests/test-pipeline-state-shipped-behavior.cjs` -> PASS (6/6; the untested store's first coverage)
- `node tests/test-pipeline-on-runchain.cjs` -> PASS (6/6; provenanceFn + sole-truth resume + reconcile agree/disagree + no double-run + PRE===POST)
- `bash tests/run-all-166.sh` -> 12/12 PASSED (Waves 1-5 + Part-8 sweep + em-dash sweep)
- `grep -q "chain-executor" commands/pipeline.md && grep -q "SECONDARY" commands/pipeline.md` -> PIPELINE_DOC_OK

## Known Stubs

None. The pipeline command's `onStep` dispatches the per-stage framework-runner (one framework per call) exactly as the prior hand-rolled Stage Execution Loop did; the runtime moved onto the spine, the dispatch boundary did not change. `makeProvenanceFn(null)` returning null is BY DESIGN (single-mode callers pass provenanceFn:null), not a stub.

## Self-Check: PASSED

All created files exist on disk (test-pipeline-state-shipped-behavior.cjs, test-pipeline-on-runchain.cjs, 166-05-SUMMARY.md) and all three task commits (0feb2867, 374c8c0c, d858b9c0) are present in git history.

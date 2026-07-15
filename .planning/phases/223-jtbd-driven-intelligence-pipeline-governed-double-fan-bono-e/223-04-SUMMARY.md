---
phase: 223-jtbd-driven-intelligence-pipeline-governed-double-fan-bono
plan: 04
subsystem: intel-pipeline-surface
tags: [intel-pipeline, meta-orchestrator, staged-composer, injectable-seams, hitl-stages, jtbd-guardrail, close-the-loop, eureka-measured, connector-registry, skill-mirror, cjs]

# Dependency graph
requires:
  - plan: 223-01
    provides: fixture-room-223 (buildFixtureRoom223) + the Part 8 egress guard the decompose leg calls
  - plan: 223-02
    provides: close-loop-writer.cjs (writeCloseLoop) - the shared close-the-loop contract this surface terminates through
  - plan: 223-03
    provides: the freshly regenerated mirror/registry baseline (serialized BEFORE this plan so the two generators do not race)
  - phase: 164
    provides: the act.md kind: meta connector reference this surface is modeled on
  - phase: 150.8
    provides: dispatch-optimizer planDispatch (the fan-sizing source)
  - phase: 211-219
    provides: rs-differential-scorer scoreMeasured + eureka-room-report (the D-03 measured compute legs)
provides:
  - lib/core/intel-pipeline.cjs (runIntelPipeline, PIPELINE_STAGES) - the testable staged composer
  - commands/intel-pipeline.md - the kind: meta surface born-wired on the frozen context_block reach
  - skills/intel-pipeline/SKILL.md - generated mirror (sensor_triggers [] both files, pure byte copy)
  - data/connector-registry.json intel-pipeline tuple (+2 entries, 0 changed reach_ids)
  - tests/test-223-intel-pipeline.cjs (Req 3 + Req 4 intel-pipeline-side proof, all seams injected)
affects: [223-05 phase harness + release (run-all-223.sh exercises the seam contract + the live 3-gate run)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "thin STAGE COMPOSER (Canon Part 7): every stage delegates to a shipped engine; the only net-new logic is sequencing, gating, and disclosure - no new loop runtime"
    - "injectable-seams-with-production-defaults: jtbdFns/planFn/researchFn/computeFn/writeFn/classifyFn/bankRollupFn/gateFn all default to shipped engines and are all injectable, so the whole loop is fixture-provable with zero live LLM/web"
    - "SEED-059 structural disclosure: every degraded/halted stage carries a named disclosure in the return shape's stages[], never a silent drop"
    - "single-write-site JTBD guardrail (G-2): exactly one JTBD write call site in the whole file, at calibrate; divergence surfaced at the F.5 gate payload, never auto-written"

key-files:
  created:
    - lib/core/intel-pipeline.cjs
    - commands/intel-pipeline.md
    - skills/intel-pipeline/SKILL.md
    - tests/test-223-intel-pipeline.cjs
  modified:
    - data/connector-registry.json
    - data/connector-coverage-ledger.json
    - data/command-registry.json

key-decisions:
  - "fan-sizing defaults (Claude's discretion item): FAN_CAP_LOW = 3; planned = max(1, min(planFn.agents, caps.fan, dimensions.length)). The fan is deliberately clamped LOW - the fan-approve F.1 gate is the navigator cost control, not a hidden throttle (RESEARCH Open Question 2 / T-223-15)"
  - "hierarchy_rank = 55 (the lowest free rank; existing ranks run 1-54 contiguously then jump to 60). Shares reach_id context_block with /mos:act, distinguished by sub_mode intel-pipeline - a sibling standing suggestion, never a 7th reach"
  - "the JTBD read/write seam is the WHOLE jtbd-state module (opts.jtbdFns default), and the only literal setCurrent token in the file is the single call site at calibrate - so grep -c setCurrent returns exactly 1 (G-2 enforced structurally, not just by convention)"
  - "decompose derives dimensions from a local JTBD-verb -> handle map; the calibrated JTBD's handles ARE the cues the synthesize-stage G-2 divergence check compares the findings against"
  - "the production research/compute/bank defaults are wired BY NAME (extractContext -> runSourceLens -> wireAccept; scoreMeasured + eureka-room-report; compute-opportunity-state) but exercised LIVE only at phase verification (223-VALIDATION); the hermetic fixture injects every seam"

patterns-established:
  - "the second born-wired surface terminating through the ONE writeCloseLoop spine - Req 4 proven from a second caller with surface 'intel-pipeline' (the G-1 provenance marker distinguishes it from bono downstream)"
  - "a meta-orchestrator surface carries 3 hitl_stages (calibrate F.1, fan-approve F.1, synthesize F.5) and autonomous_safe false: the spine OFFERS, the navigator CONFIRMS at every material step"

requirements-completed: ["Req 3", "Req 4 (second surface)", "Req 6"]

# Metrics
duration: 40min
completed: 2026-07-16
---

# Phase 223 Plan 04: /mos:intel-pipeline composition core + born-wired meta surface Summary

**A new `lib/core/intel-pipeline.cjs` staged composer (`runIntelPipeline`, `PIPELINE_STAGES`) runs calibrate -> decompose -> plan-fan -> fan -> compute -> synthesize -> close against any room oriented by its active JTBD, gating at three declared HITL stages (calibrate F.1, fan-approve F.1, synthesize F.5), halting the fan on a quality:low pass with a SEED-059 disclosure, computing through the eureka measured legs and NEVER any Python (D-03), writing the JTBD state exactly once at calibrate and surfacing divergence at F.5 rather than silently re-writing it (G-2), and terminating through the SAME writeCloseLoop contract bono uses (Req 4) - all fixture-proven with every seam injected (zero live LLM/web); the surface is `commands/intel-pipeline.md`, a kind: meta sibling of /mos:act born-wired on the frozen context_block reach with a machine-generated mirror and a registry that nets exactly +2 entries with 0 changed reach_ids.**

## Performance
- **Duration:** ~40 min
- **Completed:** 2026-07-16
- **Tasks:** 2 (Task 1 TDD: RED + GREEN)
- **Files created:** 4; modified: 3 (generated artifacts)

## The runIntelPipeline seam contract (Plan 05's harness relies on this)

```
runIntelPipeline(opts) -> Promise<result>

opts = {
  roomDir, db, topic?, dryRun?,
  caps?: { fan (default 3), remainingContext },
  gateFn(ctx) -> approve,        // ctx.stage in {calibrate, fan-approve, synthesize}, ctx.shape in {F.1,F.1,F.5}
  onHalt(info),
  jtbdFns?: { getCurrent, setCurrent },   // default = lib/hmi/jtbd-state.cjs
  planFn?,                        // default = dispatch-optimizer.planDispatch
  researchFn?(dimension, ctx) -> { findings:[{text,dimension}], opportunities?, quality },
  computeFn?(ctx) -> { ok, measured },      // default = eureka scoreMeasured + eureka-room-report
  writeFn?,                        // default = close-loop-writer.writeCloseLoop
  classifyFn?,                     // default = part8-egress-guard.classify (decompose Brain leg)
  bankRollupFn?,                   // default = spawn bash scripts/compute-opportunity-state
  genericDims?, run_id?, dateStr?, computePairs?
}

result = {
  ok,
  dry_run?,                        // dry-run short-circuit: plan only, dispatches nothing
  halted?, halt_stage?,            // halt_stage in {calibrate, fan-approve, fan, synthesize}
  stages: [{ stage, status, disclosure? }],   // status in {ok, planned, degraded, halted}
  plan: { stages, jtbd, dimensions, fan: { requested, planned, budget } },
  written?                         // the writeCloseLoop summary
}
```

- **Gate approval:** `gateFn` returns `true` or `{approved:true}` to approve; `false` / `{approved:false}` / anything else rejects and halts.
- **quality:low HALT:** a fan pass reporting `quality:'low'` halts the whole fan; the `fan` stage disclosure names the pass (`SEED-059: research quality:low at fan pass N/M ...`) and no further passes dispatch.
- **G-2:** `setCurrent` fires exactly once (at calibrate, after approval); the `synthesize` gate ctx carries `jtbd_divergence = {calibrated, observed, divergent}` when findings diverge from the calibrated cues.
- **Close:** ONE `writeFn(db, roomDir, payload, {surface:'intel-pipeline', run_id, dateStr})`, then `bankRollupFn(roomDir)`.

## Chosen defaults (the plan's discretion items)

- **Fan sizing:** `FAN_CAP_LOW = 3`; `planned = max(1, min(planFn.agents, caps.fan, dimensions.length))`. Clamped low on purpose - the fan-approve F.1 gate is the navigator cost control (T-223-15), so the default cap is small and the navigator widens it consciously, never a hidden limit.
- **hierarchy_rank:** `55` (lowest free rank; existing ranks are contiguous 1-54 then jump to 60). Shares `reach_id: context_block` with `/mos:act`, distinguished by `sub_mode: intel-pipeline`.
- **Dimensions:** derived from a local JTBD-verb map (`validate-idea` -> demand-evidence / competitive-landscape / feasibility, etc.; a generic `DEFAULT_DIMENSIONS` fallback). Generic Brain dims ride only through a `classify` `allow` verdict (Part 8 fail-closed).

## Task Commits
1. **Task 1 (RED): failing test** - `bddcdbdf` (test) - tests/test-223-intel-pipeline.cjs, behaviors 1-6, module absent
2. **Task 1 (GREEN): composition core** - `8bcdc361` (feat) - lib/core/intel-pipeline.cjs; test-223-intel-pipeline 39/39 green
3. **Task 2: born-wired surface + mirror + registry** - `b481dd5f` (feat) - commands/intel-pipeline.md + skills/intel-pipeline/SKILL.md + data/{connector-registry, connector-coverage-ledger, command-registry}.json

## Verification
- `node tests/test-223-intel-pipeline.cjs` exits 0 (39 checks: behaviors 1-6 all green)
- Source gates (Task 1 acceptance): comment-stripped grep for `compute-hsi|python|.py|spawn.*python` returns 0 (D-03); `grep -c setCurrent` = 1 (G-2, single write site); `writeCloseLoop|close-loop-writer` present; comment-stripped `INSERT INTO` = 0 (chokepoint discipline); `mindrian-designs` = 0; no em-dash
- `node scripts/build-connector-registry.cjs --check` -> `connector-registry: OK`; the registry nets exactly +2 surfaces (196 -> 198), the diff carries only intel-pipeline additions, 0 changed reach_ids, bono's tuple untouched
- `grep -c` on the two intel-pipeline surface lines = 2 (command + mirror); the verify command prints `INTEL-WIRING-OK`
- `node scripts/build-skill-mirrors.cjs --check` -> OK (110 mirrors; intel-pipeline is a pure byte copy, sensor_triggers [] on both files)
- `node scripts/check-shape-declaration.cjs` -> intel-pipeline NOT flagged (3 hitl_stages declared); `autonomous_safe: false` present
- `node scripts/check-render-coverage.cjs` -> 0 gap, 0 unwired (intel-pipeline covered)
- Regressions green: `test-223-close-loop.cjs`, `test-223-hat-governance.cjs`, `test-223-supersedes-chain.cjs` all exit 0

## Deviations from Plan

**1. [Rule 3 - blocking, anticipated by the Plan 03 precedent] data/command-registry.json regenerated with Task 2.**
- **Found during:** Task 2. Adding a new command with a `teaching` field made `data/command-registry.json` stale, and the installed pre-commit hook's command-registry drift check is a HARD block (Plan 03 hit and documented the identical gate).
- **Fix:** ran `node scripts/build-command-registry.cjs` and committed it with the command. Generated artifact tracking a legitimate consequence of the new command, not a scope addition.
- **Files:** data/command-registry.json. **Commit:** b481dd5f.

**2. [decision - concurrency safety] STATE.md counter bump DEFERRED (not clobbered).**
- **Found during:** state-update step. `.planning/STATE.md` carried UNCOMMITTED working-tree edits from a concurrent Phase 229 executor (the file now reads "Phase 229 EXECUTING, Plan 1 of 9"; HEAD reads "Phase 223 Plan 03 COMPLETE"). This is exactly the concurrent-session collision the plan's additional_notes name ("concurrent sessions committing docs(227)/docs(229); ignore them, zero file overlap").
- **Decision:** did NOT run the `state.advance-plan` / `state.update-progress` mutators and did NOT stage STATE.md. Running the mutators would have rewritten the Phase-229 session's uncommitted state (a lost update), and committing STATE.md would have dragged their in-flight edits into this plan's docs commit. The Phase 223 Plan 04 completion is recorded in THIS SUMMARY + the ROADMAP progress row; STATE.md is left to its active owner. This honors the "zero file overlap" instruction and the Phase 217 collision precedent (do not clobber a concurrently-held shared-state file).
- **Impact:** none to the deliverables; the ROADMAP row reflects Phase 223 progress, and the SUMMARY is the canonical durable artifact Plan 05 reads.

## Known Stubs
None. `runIntelPipeline` has real production defaults for every seam; the tests inject stubs but the shipped code paths are wired by name. The live research/compute pipe is exercised at phase verification (223-VALIDATION) per the plan's deferral, not stubbed in the shipped surface.

## Threat Flags
None. The surface introduces no network endpoint or trust boundary beyond those already in the phase threat_model (T-223-14..18), and each is mitigated: 3 blocking hitl_stages + autonomous_safe false (T-223-14), the fan-approve gate + low cap (T-223-15), classify fail-closed on the decompose Brain leg (T-223-16), the single-write-site G-2 guardrail (T-223-17), and the SEED-059 quality-low disclosure (T-223-18). Zero new dependencies (T-223-SC).

## User Setup Required
None.

## Next Phase Readiness
- Plan 05's `run-all-223.sh` can drive `runIntelPipeline` through the seam contract above and, for the deferred live leg, run `/mos:intel-pipeline` against a scratch room to confirm the three gates fire as cards (223-VALIDATION manual step).
- The registry is freshly regenerated with the +2 intel-pipeline entries; Plan 05's Req 5 diff criterion (net +2, 0 changed reach_ids across the whole phase) holds on this state.

## Self-Check: PASSED
All 4 created files exist on disk (lib/core/intel-pipeline.cjs, commands/intel-pipeline.md, skills/intel-pipeline/SKILL.md, tests/test-223-intel-pipeline.cjs); all 3 task commits (bddcdbdf, 8bcdc361, b481dd5f) are in the git log.

---
*Phase: 223-jtbd-driven-intelligence-pipeline-governed-double-fan-bono*
*Completed: 2026-07-16*

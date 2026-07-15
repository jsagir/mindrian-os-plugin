---
phase: 229-huji-pitch-feedback-module
plan: 08
subsystem: infra
tags: [batch-orchestrator, headless-cli, concurrency-pool, filesystem-ledger, kill-resume, part8-egress, cohort-fairness]

# Dependency graph
requires:
  - phase: 229-07
    provides: "runOne (per-submission two-stage isolated runner) + scaffoldScratchRoom + per-unit guardrails"
  - phase: 229-03
    provides: "huji-eval part8Hygiene (D4) + drift/similarity/cost checks + --report cohort view"
provides:
  - "scripts/huji-batch.cjs exporting runBatch({config, submissionsDir, workspaceDir}) - the outer N=200 orchestrator"
  - "Dependency-free bounded concurrency pool (cap 3-4; drops to serial on repeated rate_limit)"
  - "Atomic batch-state.json ledger + .done idempotency + clean kill/resume"
  - "Batch-level guardrails: G3 Part-8 + G4 model-provenance HALT the whole batch; G5 cost + failure-rate pause/stop"
  - "failures.md partial-failure deliverable; cohort aggregation via huji-eval --report; scratch-room cleanup"
  - "D10 kill/resume + cross-bleed harness leg (--test-d10 / --selftest-killresume) - run-all-229 D10 now green"
affects: [229-09, huji-pilot-batch-run, amnon-demo]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Filesystem-ledger checkpoint/resume (atomic write-temp-rename + .done marker) - the one net-new build (No Analog Found)"
    - "Dependency injection of the per-unit worker (runUnit) so ledger/pool/retry/guardrails are exercised model-free by stub selftests"
    - "Mechanism-broken escalation: two triggers (G3 egress, G4 provenance) escalate from unit-block to whole-batch HALT"
    - "Preflight model-ID pinning assertion (fail fast on a bare alias) as the proactive sibling of the reactive G4 gate"

key-files:
  created:
    - "scripts/huji-batch.cjs"
  modified: []

key-decisions:
  - "Async worker pool over sync runOne: the pool structure (running-set cap, mid-batch limit re-read for serial-drop + halt-to-0) is genuine; process-level parallelism of the sync runOne is a documented property, and the stub-worker selftests prove the concurrency-cap + transitions model-free"
  - "Implemented the plan-checker advisory as PREFLIGHT: assertPinnedModelId fails fast before any spawn on a bare alias, rather than wasting unit 1 + a human page on the reactive G4 halt"
  - "Wired BOTH --test-d10 (plan verify) and --selftest-killresume (the flag tests/run-all-229.sh actually calls) to the same D10 harness"

patterns-established:
  - "Batch guardrail battery in onSettle: checkpoint -> classify (rate-limit/budget) -> failures.md -> G3/G4 halt -> cleanup -> G5/failure-rate"
  - "Workspace-outside-repo assertion (assertOutsideRepo) fails closed so batch artifacts are never git-added"

requirements-completed: [D3, D4, D9, D10]

# Metrics
duration: 26min
completed: 2026-07-16
---

# Phase 229 Plan 08: Batch Orchestrator (seam e) Summary

**The N=200 outer orchestrator: a dependency-free concurrency pool that loops isolated `runOne` sessions, checkpoints to an atomic filesystem ledger with clean kill/resume, escalates a Part-8 egress hit (G3) or model-provenance mismatch (G4) to a whole-batch HALT, retries transient failures into failures.md, aggregates the cohort report, and cleans up scratch rooms - proven by a model-free D10 harness leg.**

## Performance

- **Duration:** ~26 min
- **Completed:** 2026-07-16
- **Tasks:** 3
- **Files modified:** 1 created (scripts/huji-batch.cjs, 821 lines)

## Accomplishments

- **runBatch** drives N isolated submissions through a bounded pool (cap `config.concurrency`, 3-4 per Pitfall 6), never importing the in-session chain (isolation invariant holds).
- **Atomic ledger + resume:** `batch-state.json` written write-temp-then-rename after every transition (pending -> running -> done/failed); resume skips any unit marked done OR carrying `out/<id>/.done`, with zero re-runs.
- **Two mechanism-broken triggers HALT the whole batch:** G3 (reuses `huji-eval` `part8Hygiene` over the Brain-query log - ANY student-string leak) and G4 (`result.json` `model_id` != pinned `config.model`), each paging the human.
- **Retry + deliverable failures report:** 2 retries per unit in a FRESH scratch room each attempt, then `failed` + a `failures.md` entry (truncated stderr + last `session_id`).
- **G5 cost fuse (>2% pause) + failure-rate (>=5%/20-window stop)**, cohort aggregation via `huji-eval --report`, and scratch-room cleanup after `.done` (no residue).
- **D10 proven:** `--test-d10` (model-free) asserts done-unit skip, interrupted-unit re-run in fresh rooms, no double-write, and zero cross-student entity bleed; `tests/run-all-229.sh` D10 leg now RUNS -> **Phase 229 PASS=9 FAIL=0 SKIP=0** (was PASS=8 SKIP=1).

## Task Commits

Each task was committed atomically:

1. **Task 1: Preflight + concurrency pool + ledger + resume** - `41719623` (feat)
2. **Task 2: Retry + failures.md + batch guardrails (G3/G4/G5) + aggregation + cleanup** - `24842bd2` (feat)
3. **Task 3: D10 kill/resume + cross-bleed harness scenario** - `96cd5938` (feat)

## Files Created/Modified

- `scripts/huji-batch.cjs` - The outer batch orchestrator. Exports `runBatch` plus `resolveBatchConfig`, `assertPinnedModelId`, `assertOutsideRepo`, `preflightPluginLoad`, `runPool`, `attemptSubmission`, `checkG3`, `checkG4`, `runAggregation`. CLI selftests: `--dry-run N`, `--dry-run-failure`, `--test-d10` / `--selftest-killresume`.

## Decisions Made

- **Async pool over a synchronous `runOne`.** `runOne` (Plan 07) is `spawnSync`-based (synchronous). The pool is built async-worker-first: it caps a `running` set at a limit re-read every iteration (so a mid-batch drop-to-serial or a HALT-to-0 takes effect immediately). Wall-clock parallelism of the sync `runOne` would need a child-node wrapper (a v2 concern); the control structure, atomic ledger, resume, retry, and guardrail escalation are all genuine and are proven model-free by stub-worker selftests (which DO overlap and demonstrate the concurrency cap).
- **Dependency injection of the per-unit worker.** `runBatch` accepts a `runUnit` override; the default wraps `runOne`, and every CLI selftest injects a stub. This means the exact orchestration code (ledger, resume, retry, G3/G4/G5, aggregation, cleanup) is what runs under `--dry-run`, `--dry-run-failure`, and `--test-d10` - not a parallel fake.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Wired the D10 harness to BOTH the plan flag and the aggregator flag**
- **Found during:** Task 3
- **Issue:** The plan's Task 3 verify calls `node scripts/huji-batch.cjs --test-d10`, but `tests/run-all-229.sh` (line 120, already committed in Plan 02) invokes the D10 leg as `node scripts/huji-batch.cjs --selftest-killresume`. Supporting only `--test-d10` would leave the aggregator D10 leg RED once the guard file existed.
- **Fix:** Both `--test-d10` and `--selftest-killresume` route to the same `cliTestD10` handler.
- **Files modified:** scripts/huji-batch.cjs
- **Verification:** Both flags exit 0; `bash tests/run-all-229.sh` D10 leg PASSED (PASS=9 FAIL=0 SKIP=0).
- **Committed in:** 96cd5938 (Task 3 commit)

**2. [Rule 2 - Missing Critical] Preflight model-ID pinning assertion (plan-checker advisory)**
- **Found during:** Task 1
- **Issue:** The plan-checker flagged that model-ID pinning was designed REACTIVE (G4 halts on unit 1 if `config.model` is a bare alias), wasting a real unit + a human page.
- **Fix:** Added `assertPinnedModelId` as a PREFLIGHT in `runBatch` (and exported it): fails fast with `model_not_pinned` before spawning any submission when `config.model` is a bare alias (opus/sonnet/haiku/...) or does not match the full-ID pattern `claude-<family>-<digit>`. The reactive G4 gate remains as the in-flight backstop.
- **Files modified:** scripts/huji-batch.cjs
- **Verification:** `assertPinnedModelId('opus')` -> `{ok:false, reason:'bare_alias'}`; `assertPinnedModelId('claude-opus-4-8')` -> `{ok:true}`. Fits cleanly within the plan's G4 scope (advisory, non-blocking).
- **Committed in:** 41719623 (Task 1 commit)

**3. [Rule 1 - Bug] Reworded a header comment that tripped the isolation grep**
- **Found during:** Task 3 verification
- **Issue:** The plan verify asserts `! grep -q "chain-executor"` (the orchestrator must never require the chain module). A prose mention of the literal token in the file header tripped this automated gate even though nothing imports it.
- **Fix:** Reworded the comment to "the in-session chain module" - no functional change; no `require` of the chain module exists anywhere.
- **Files modified:** scripts/huji-batch.cjs
- **Verification:** `grep chain-executor scripts/huji-batch.cjs` -> absent; all three selftests + run-all-229 still green.
- **Committed in:** 96cd5938 (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 missing-critical, 1 bug)
**Impact on plan:** All within the plan's core objective - the D10-flag alignment is required for the phase gate to go green; the preflight assertion is the plan-checker's own advisory; the comment reword is a cosmetic fix for a false-positive on an automated gate. No scope creep.

## Issues Encountered

- A harmless `ExperimentalWarning: SQLite is an experimental feature` prints on stderr when `huji-eval.cjs` is required (transitive `node:sqlite` in the shared core). It does not affect exit codes or output; left as-is.

## Threat Flags

None - no security surface beyond the phase's declared `<threat_model>`. G3/G4 halts, concurrency cap + serial-drop, scratch-room cleanup, and the outside-repo workspace assertion directly mitigate T-229-08-01 through T-229-08-05; zero package installs (T-229-08-SC accept).

## Self-Check: PASSED

- `scripts/huji-batch.cjs` exists (821 lines, exports `runBatch`).
- Commits `41719623`, `24842bd2`, `96cd5938` all present in `git log`.
- `node scripts/huji-batch.cjs --dry-run 5`, `--dry-run-failure`, `--test-d10` all exit 0.
- `grep runOne` + `grep batch-state` + `grep -- --report` match; `grep chain-executor` absent.
- `bash tests/run-all-229.sh` -> Phase 229 PASS=9 FAIL=0 SKIP=0 (D10 leg now runs).

## Next Phase Readiness

- Seam (e) complete: the full pipeline (intake -> runOne -> batch orchestration -> eval/report) is wired and structurally proven end to end, model-free.
- Remaining are the HUMAN gates (Plan 09): Jonathan's blind re-rank (>= 0.7) for judge calibration and Amnon Dekel's "better than a TA" verdict on the two demo artifacts - both real validation legs, never automated assertions.
- A live batch run requires: a pinned full model ID + a real `ANTHROPIC_API_KEY`/keychain, an out-of-tree workspace (`~/MindrianRooms/huji-pilot-batch/`), and the labeled submission inputs from Amnon's platform.

---
*Phase: 229-huji-pitch-feedback-module*
*Completed: 2026-07-16*

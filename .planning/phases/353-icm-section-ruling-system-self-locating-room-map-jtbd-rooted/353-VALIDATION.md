---
phase: 353
slug: icm-section-ruling-system-self-locating-room-map-jtbd-rooted
status: planned
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-17
updated: 2026-09-17
---

# Phase 353 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from the Validation Architecture section of `353-RESEARCH.md`; the per-task rows below were filled by the planner on 2026-09-17 and are closed with measured proof by `353-03-PLAN.md` Task 7.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in) for `*.test.cjs`; hand-rolled PASS/FAIL counters for `tests/test-353-*.cjs`; bash aggregator per phase |
| **Config file** | none (no jest/vitest/pytest in this repo) |
| **Quick run command** | `node tests/test-353-<leg>.cjs` |
| **Full suite command** | `bash tests/run-all-353.sh` |
| **Phase gate** | `bash tests/run-all-353.sh` green, then `node scripts/doctor.cjs --acceptance` |
| **Estimated runtime** | quick leg under 5 s; full suite under 90 s (no vendor call anywhere in the suite) |

---

## Sampling Rate

- **After every task commit:** run the leg the task names in its `<automated>` verify, plus `bash -n` on any edited shell file.
- **After every plan:** `bash tests/run-all-353.sh` and the sibling suites the plan touches (275 section schema, 195 recursive reconcile, 209 declared-implies-wired, 245 priority-complete, 310 release step hashes).
- **Before the phase closes:** `node scripts/doctor.cjs --acceptance` including the new `icm-ruling-eval-fresh` point, plus `node scripts/verify-release` with no new failure against the recorded pre-phase baseline.

---

## Success criteria -> measurement map (from research)

| # | Criterion | Measured by | Fixture / target |
|---|-----------|-------------|------------------|
| 1 | `doctor room-map` and `doctor section-ruling` green after `--fix`; 0 root/section/structural/sub-room directories without ROOM.md; 0 drift | hermetic `--fix` + recheck on `tests/fixtures/icm-rooms/`; report-mode-only fleet walk producing a per-kind count (never `--fix` on a real room) | fixture rooms; `353-FLEET-REPORT.json` |
| 2 | Per-turn self-location plus ruling read under 400 tokens | `getRoomContext(db, roomId, { estimateOnly: true })` and `_meta.legCostTokensApprox.legE`, chars-over-4 per `lib/core/token-estimator.cjs` | fixture room with the deepest sub-room |
| 3 | 100 percent of new claims on fixture rooms carry an anchor edge | file N claims through `claim_write` and `artifact_file` against a fixture db; count `SOURCED_FROM` edges whose target is `jtbd:<job_id>`; assert N of N | fixture rooms |
| 4 | Reach top-3 hit rate on a labeled fixture turn set at least equal to today's sensor order; both numbers reported | `rankForSelector` twice over the same labeled turns: without `tierCandidates` (today) and with the ledger candidates; both hit rates and the delta printed | `evals/icm/cases/turns.json`, labeled in plan 01 before any ledger existed |
| 5 | Ledger build cost and wall time recorded per release | the build script writes `{ built_at, wall_ms, jev_calls, input_tokens, output_tokens, estimated_cost_usd }` from the vendor-returned usage into the ledger header; `--check` reads it back offline | `data/section-command-ledger.json` |
| 6 | Grader agreement with the Claude-judge baseline at least 0.8 | **EXACT AGREEMENT** (planner's choice, stated: the fraction of graded items whose runner verdict equals the baseline verdict; Spearman rejected because the checklist verdicts are categorical, not ranked) between `scripts/eval-icm-writers.cjs` output and the once-authored `evals/icm/claude-judge-baseline.json` | fixture rooms only |

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 353-01-T1 | 01 | 1 | RULE-09 | T-353-SC | Fixture tree is a new sibling; no real room touched; labels predate the ledger | integration | `bash tests/run-all-353.sh` | W0 creates | pending |
| 353-01-T2 | 01 | 1 | RULE-01, RULE-02 | T-353-01, T-353-03 | Path containment on every walked directory; no symlink follow; bounded depth | unit | `node tests/test-353-room-map.cjs` | W0 | pending |
| 353-01-T3 | 01 | 1 | RULE-03, RULE-04 | T-353-02, T-353-04 | Every YAML string escaped; atomic tmp+rename; body bytes preserved | unit | `node tests/test-353-self-block.cjs` | W0 | pending |
| 353-01-T4 | 01 | 1 | RULE-05 | T-353-05, T-353-08 | `recoverable:false` outside the resolved fixture prefix; sync-only runner | unit | `node tests/test-353-doctor-room-map.cjs` | W0 | pending |
| 353-01-T5 | 01 | 1 | RULE-06 | T-353-07 | All-or-unwind across six side effects; rollback re-runs the parent rebuild | integration | `node tests/test-353-subroom-birth.cjs` | W0 | pending |
| 353-01-T6 | 01 | 1 | RULE-29 | T-353-26 | Every card answer validated against `JOB_VOCABULARY` before any write; undeclared is a legal named state, never a guess; no second gate path | integration | `node tests/test-353-subroom-birth.cjs` | W0 | pending |
| 353-01-T7 | 01 | 1 | RULE-07 | T-353-03 | Purely additive leg; zero network; zero writes | unit | `node tests/test-353-turn-budget.cjs` | W0 | pending |
| 353-01-T8 | 01 | 1 | RULE-08 | T-353-05, T-353-06 | Report mode only; no file names or contents in the evidence JSON | integration | `node tests/test-353-fleet-report.cjs` | W0 | pending |
| 353-02-T1 | 02 | 2 | RULE-10, RULE-11 | T-353-SC | One home per fact; no command frontmatter edited | unit | `node tests/test-353-section-canon.cjs` | W0 | pending |
| 353-02-T2 | 02 | 2 | RULE-12, RULE-13 | T-353-09, T-353-10, T-353-11 | Fixed Cypher plus params; egress ceiling asserted before every fetch; key never printed | unit | `node tests/test-353-ledger-shape.cjs` | W0 | pending |
| 353-02-T3 | 02 | 2 | RULE-14 | T-353-17 | Shipped seed declares `build_mode` and a null `jev_model` rather than claiming a vendor score | unit | `node tests/test-353-ledger-shape.cjs` | W0 | pending |
| 353-02-T4 | 02 | 2 | RULE-15 | T-353-14, T-353-18 | Generated block spliced, never substituted; bytes below the end marker preserved | unit | `node tests/test-353-ruling-doc.cjs` | W0 | pending |
| 353-02-T5 | 02 | 2 | RULE-16 | T-353-18 | Both Phase 275 assertions amended on purpose with the phase cited | regression | `node tests/test-275-section-schema.cjs` | exists | pending |
| 353-02-T6 | 02 | 2 | RULE-17 | T-353-12, T-353-13 | Non-claim node type; mint before edge; no raw INSERT | unit | `node tests/test-353-anchor-edge.cjs` | W0 | pending |
| 353-02-T7 | 02 | 2 | RULE-18 | T-353-12, T-353-15, T-353-16 | Bookkeeping never blocks a write; mismatch disclosed on the existing event | integration | `node tests/test-353-filing-gate.cjs` | W0 | pending |
| 353-02-T8 | 02 | 2 | RULE-19 | T-353-17 | Pure producer, module-level cache, frozen scalars untouched, 1200 ms budget measured | perf | `node tests/test-353-decide-budget.cjs` | W0 | pending |
| 353-02-T9 | 02 | 2 | RULE-20 | T-353-18 | Sync runner, detail on every path, `recoverable:false` outside the fixture prefix | unit | `node tests/test-353-doctor-section-ruling.cjs` | W0 | pending |
| 353-02-T10 | 02 | 2 | RULE-21 | T-353-10, T-353-17 | Release path stays key-free and offline; step hashes re-pinned for exactly two blocks | integration | `node tests/test-353-release-wiring.cjs` | W0 | pending |
| 353-03-T1 | 03 | 3 | RULE-22 | T-353-20 | Each `jev` checklist item names exactly what crosses the wire | static | `bash -c 'test $(ls evals/icm/checklists/*.md \| wc -l) -eq 5'` | W0 | pending |
| 353-03-T2 | 03 | 3 | RULE-23 | T-353-19, T-353-21, T-353-22 | Resolved-prefix room refusal; key never printed or persisted; HTML escaped | integration | `node tests/test-353-tripwires.cjs` | W0 | pending |
| 353-03-T3 | 03 | 3 | RULE-24 | T-353-24 | Labels unchanged; both numbers printed; regression reported not tuned | integration | `node tests/test-353-reach-hitrate.cjs` | W0 | pending |
| 353-03-T4 | 03 | 3 | RULE-25 | T-353-23, T-353-24 | Baseline never written by the grader; skip is distinguishable from a pass | integration | `node tests/test-353-grader-agreement.cjs` | W0 | pending |
| 353-03-T5 | 03 | 3 | RULE-26 | T-353-25 | Acceptance point reads one local file; never a vendor call; honest degrade | integration | `node scripts/doctor.cjs --acceptance` | exists | pending |
| 353-03-T6 | 03 | 3 | RULE-27 | T-353-19, T-353-20 | Comment lines excluded from every count; non-zero scanned-file count per leg | static | `node tests/test-353-tripwires.cjs` | W0 | pending |
| 353-03-T7 | 03 | 3 | RULE-28 | all | An unmeasured row stays open with a stated reason | integration | `bash tests/run-all-353.sh` | exists | pending |

*Status values: pending, green, red, flaky. File Exists: `exists` for a file present at HEAD, `W0` for one Wave 0 or an earlier task in this phase creates.*

---

## Wave 0 Requirements

- [ ] `tests/run-all-353.sh` - the aggregator, written once in plan 353-01 Task 1, never edited by a later plan (run-all-345 convention), with its own em-dash guard glob and a pre-declared `run_if` leg per phase test file
- [ ] `tests/fixtures/icm-rooms/` - authored fixture rooms: sections with real MINTO/FEYNMAN content, template-identical stubs, a sub-room with `job_id`, a sub-room without, a cross-section artifact folder, a missing root ROOM.md
- [ ] `evals/icm/cases/turns.json` - the labeled turn set, authored in plan 01 BEFORE any ledger exists (the eval-honesty rule for criterion 4)
- [ ] `evals/icm/README.md`, `evals/icm/checklists/*.md`, `evals/icm/claude-judge-baseline.json`, `evals/icm/last-run.json` (plan 03)
- [ ] `tests/fixtures/353-jev-ledger-responses.json` - the recorded vendor response fixture that makes the scoring path deterministic with zero network (plan 02)
- [ ] the seventeen `tests/test-353-*.cjs` legs the plans name
- [ ] the named amendment task for `tests/test-275-section-schema.cjs` lines 330 and 366 (plan 02 Task 5)
- [ ] the re-pin task for `tests/fixtures/310-release-step-block-hashes.txt` and `tests/fixtures/341-release-step-block-hashes.txt`, Step 0 and Step 2.4 blocks only (plan 02 Task 10)

---

## Tripwires this phase ships

- No non-comment line under `lib/` contains the literal `api.typesafe.ai` (Jev is dev-time only).
- No non-comment line under `hooks/` references `eval-icm-writers` or `build-section-command-ledger`.
- `scripts/eval-icm-writers.cjs` contains no path under `~/MindrianRooms` and refuses a `--room` outside `tests/fixtures/icm-rooms/`.

---

## Pre-existing reds (report, never claim green, never edit)

| What | Where | Why it is not this phase's business |
|------|-------|--------------------------------------|
| `assert.equal(EVENT_TYPES.size, 32)` | `tests/test-auto-explore-telemetry.cjs:432` | Exact-size assertion against 102 real members; this phase adds no event type (R-353-K) |
| `equal(EVENT_TYPES.size, PRE_131_EVENT_BASELINE + 3)` | `tests/test-131-substrate.cjs:98` | Same class, same reason |
| `STEP_BLOCK_COUNT 28` against 30 real blocks, two headers missing | `tests/fixtures/341-release-step-block-hashes.txt` | Stale since Phase 343 Plan 07 and Phase 349 Plan 04 landed Steps 0.6 and 5.6; this phase re-pins only the two blocks it edits |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `doctor room-map --fix` and `doctor section-ruling --fix` on a REAL fleet room | RULE-05, RULE-20 (criterion 1, fleet half) | the navigator's explicit act; never automated on a real room (D-353-9) | read `353-FLEET-REPORT.json`'s per-kind counts, then `--fix` one room of the navigator's choosing and re-run report mode |
| Navigator ratification of the section job canon | RULE-10 (OQ-353-1) | a truth about the sections, ratified once | read `data/section-job-canon.json`'s table against `353-RESEARCH-GROUNDING-jev.md`; set `ratification.ratified_by` and `ratification.ratified_at` |
| Pre-release Jev-scored ledger rebuild with the dev-time key | RULE-12, RULE-14 (criterion 5) | needs the operator's shell and the key; never a release step (R-353-G) | `node scripts/build-section-command-ledger.cjs` then `node scripts/build-section-command-ledger.cjs --check` |
| Writer grading run with the dev-time key | RULE-25 (criterion 6) | vendor half; never in a hook, never on a real room | `node scripts/eval-icm-writers.cjs --room tests/fixtures/icm-rooms/alpha-room` with the key exported |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency under 90 s for the full suite
- [ ] `nyquist_compliant: true` set in frontmatter (only after every named `<automated>` command has actually run and exited 0)

**Approval:** pending

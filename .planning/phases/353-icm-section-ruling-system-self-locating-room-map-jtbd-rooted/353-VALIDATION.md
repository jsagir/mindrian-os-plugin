---
phase: 353
slug: icm-section-ruling-system-self-locating-room-map-jtbd-rooted
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-17
---

# Phase 353 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from the Validation Architecture section of `353-RESEARCH.md`; the planner fills the per-task rows.

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
- **After every plan:** `bash tests/run-all-353.sh` and the sibling suites the plan touches (275 section schema, 233 derive-health, 310 release step hashes, 341 slim install, 345 goal anchor).
- **Before the phase closes:** `node scripts/doctor.cjs --acceptance` 20/20 plus the new `icm-ruling-eval-fresh` point.

---

## Success criteria -> measurement map (from research)

| # | Criterion | Measured by | Fixture / target |
|---|-----------|-------------|------------------|
| 1 | `doctor room-map` and `doctor section-ruling` green after `--fix`; 0 root/section/structural/sub-room directories without ROOM.md; 0 drift | hermetic `--fix` + recheck on `tests/fixtures/icm-rooms/`; report-mode-only fleet walk producing a per-kind count (never `--fix` on a real room) | fixture rooms; fleet report file |
| 2 | Per-turn self-location plus ruling read under 400 tokens | `getRoomContext(db, roomId, { estimateOnly: true })` and `_meta.legCostTokensApprox` for the new leg, chars-over-4 per `lib/core/token-estimator.cjs` | fixture room with the deepest sub-room |
| 3 | 100 percent of new claims on fixture rooms carry an anchor edge | file N claims through `claim_write` and `artifact_file` against a fixture db; count `SOURCED_FROM` edges whose target is `jtbd:<job_id>`; assert N of N | fixture rooms |
| 4 | Reach top-3 hit rate on a labeled fixture turn set at least equal to today's sensor order; both numbers reported | `rankForSelector` twice over the same labeled turns: without `tierCandidates` (today) and with the ledger candidates; both hit rates written to the report | `evals/icm/cases/` labeled turns |
| 5 | Ledger build cost and wall time recorded per release | the build script writes `{ built_at, wall_ms, jev_calls, input_tokens, output_tokens, estimated_cost_usd }` from the vendor-returned usage into the ledger header; the `--check` mode reads it back | `data/section-command-ledger.json` |
| 6 | Grader agreement with the Claude-judge baseline at least 0.8 | exact-agreement or Spearman (planner picks one and states it) between `scripts/eval-icm-writers.cjs` output and a once-authored `evals/icm/claude-judge-baseline.json` | fixture rooms only |

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 353-01-xx | 01 | 1 | RULE-xx | T-353-xx | (planner fills) | unit | `node tests/test-353-<leg>.cjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending, ✅ green, ❌ red, ⚠️ flaky. The planner replaces the placeholder row with one row per task.*

---

## Wave 0 Requirements

- [ ] `tests/run-all-353.sh` - the aggregator, written once in plan 353-01, never edited by a later plan (run-all-345 convention), with its own em-dash guard glob
- [ ] `tests/fixtures/icm-rooms/` - authored fixture rooms: sections with real MINTO/FEYNMAN content, template-identical stubs, a sub-room with `job_id`, a sub-room without, a cross-section artifact, a rejected row and a confirmed row
- [ ] `evals/icm/README.md`, `evals/icm/cases/`, `evals/icm/claude-judge-baseline.json`, `evals/icm/last-run.json`
- [ ] the `tests/test-353-*.cjs` legs the plans name
- [ ] amendment tasks for `tests/test-275-section-schema.cjs:330` and `:366`
- [ ] a re-pin task for whichever `tests/fixtures/{310,341}-release-step-block-hashes.txt` block the Step 2.4 `--check` wiring touches

---

## Tripwires this phase ships

- No file under `lib/` contains the literal `api.typesafe.ai` (Jev is dev-time only).
- No file under `hooks/` references `eval-icm-writers` or `build-section-command-ledger`.
- `scripts/eval-icm-writers.cjs` contains no path under `~/MindrianRooms` and refuses a `--room` outside `tests/fixtures/icm-rooms/`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `doctor room-map --fix` and `doctor section-ruling --fix` on a REAL fleet room | RULE (criterion 1, fleet half) | the navigator's explicit act; never automated on a real room | run report mode over the fleet, read the per-kind count, then `--fix` one room of the navigator's choosing and re-run report mode |
| Navigator ratification of the section job canon | RULE (OQ-353-1) | a truth about the sections, ratified once | read the canon file's table against `353-RESEARCH-GROUNDING-jev.md`; set `ratified_by` and `ratified_at` in its frontmatter |
| Pre-release ledger rebuild with the dev-time key | RULE (criterion 5) | needs the operator's shell and the key; never a release step | `node scripts/build-section-command-ledger.cjs` then `--check` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency under 90 s for the full suite
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---
phase: 366-eureka-perspective-in-research-planner-mcp-canvas-tooling
plan: 20
status: complete
subsystem: spike-record
tags: [spike, record, wilson, navigator-rulings, floor-ledger, direction-convention]
requires:
  - 366-16 (floor-ledger rows for the perspectives)
  - 366-19 (spike inputs and the navigator's blind gold)
provides:
  - tests/fixtures/366-spike/record.json (byte-for-byte --check)
  - tests/fixtures/366-spike/arms/ and substrate.json (frozen record inputs)
  - .planning/phases/366-eureka-perspective-in-research-planner-mcp-canvas-tooling/366-SPIKE-RULINGS.md (`runner: retire`)
affects: [366-21, 366-22 (runner retirement gated on `^runner: retire`), 366-24 (close-out mirror and follow-ons)]
tech-stack:
  added: []
  patterns: [record recomputed from committed inputs, adoption only through a recorded ruling]
key-files:
  created:
    - tests/fixtures/366-spike/record.json
    - tests/fixtures/366-spike/substrate.json
    - tests/fixtures/366-spike/arms/
    - .planning/phases/366-eureka-perspective-in-research-planner-mcp-canvas-tooling/366-SPIKE-RULINGS.md
  modified:
    - scripts/spike-366.cjs
    - tests/test-366-spike-harness.cjs
    - data/floor-ledger.json
decisions:
  - "judge: stage-a (no judge arm cleared the bar)"
  - "recall: graph-lexical; the vector lane stays OFF, UNMEASURED by ruling"
  - "engines: keep rs-engine and hsi-engine as the live path"
  - "runner: retire (D-02)"
  - "jev-runtime: dev-time only; judge_jev stays default false"
  - "haiku: separate producer owning its own line; entity_extraction stays off in this pipeline"
metrics:
  tasks_done: 2
  tasks_total: 2
  completed: 2026-10-02
---

# Phase 366 Plan 20: Spike record and navigator rulings Summary

The spike record is computed from committed inputs and verified byte for byte; no arm clears the
pre-registered bar (Wilson 95% lower bound above 0.448 on 3 repeats), and the navigator accepted all
six recommended rulings, including `runner: retire`.

## Commits

| Commit | Message |
|--------|---------|
| c6cf03778 | test(366-20): compute and freeze the spike record (byte-for-byte --check green) |
| c4e77691a | feat(366-20): record direction agreement and label consistency; ledger rows state why no bucket |
| (this summary's commit) | docs(366-20): navigator spike rulings and plan summary |

## Task 1: record, direction re-measure, floor buckets

- `node scripts/spike-366.cjs record --manifest /tmp/spike366-out/spike-366-DvOjMW/manifest.json` froze 52 files under `tests/fixtures/366-spike/arms/` plus `substrate.json` (no temp paths) and wrote `record.json`. `node scripts/spike-366.cjs --check` exits 0 (22,523 bytes).
- The record was extended through the harness (not by hand): each recall arm carries a `direction` block (direction_ok counted only where a direction phrase was shown; the NONE_MEANING sentinel is never counted), and the record carries `label_consistency`. Three new legs in tests/test-366-spike-harness.cjs; 58 PASS, 0 FAIL.
- Acceptance: every measured arm has shown, useful, rate, wilson95, clears_bar for repeats 1..3; `grep -c "Eureka improved"` is 0; the bar.json baseline note appears verbatim; `check-floor-ledger --check` (62 rows, 0 unresolved) and `test-355-floor-sweep` (109/0) exit 0. Also green: test-3551-hooked-audit, test-365-signals, test-363-baseline.

| Recall arm | Useful / shown | Wilson 95% | Clears | Slice |
|---|---|---|---|---|
| eureka-graph-lexical | 3 / 7 | [0.158, 0.750] | no | none |
| hsi-graph | 4 / 7 | [0.251, 0.842] | no | HSI 27/47 = 0.575; lower bound below slice and pool |
| rs-graph | 0 shown | none | no | awaiting_gold, nothing to label |
| eureka-graph-lexical-vector | 96 shown | UNMEASURED | no | by ruling; no gold, no number |

Judge arms: stage-a passes all 7 (no filtering); jev passed 0, 1 useful, 0 across repeats; claude passed the same single pair each repeat (gold useful, already known); claude-then-jev passed 0. None clears.

Direction (graph variant, hsi-graph): direction ok on 5 of 7 shown phrases ("same words with different meaning" 4 of 6, "same meaning in different words" 1 of 1). eureka-graph-lexical showed no phrase on any item, so no direction count. Label consistency: the two arms showed the same 7 pairs; the useful labels agree on 6 of 7 (disagreement `f06bd895b05b`).

Floor buckets: the rs-recall and hsi-recall rows (and the two eureka-recall rows that promised a spike re-measure) stay `disclosed`; their provenance now names why no bucket could be measured (rs-graph 0 pairs and no absolute lag floor; HSI has no divergence floor and 7 pairs sit far inside the caps; every eureka pair shown is above the lexical floor by construction).

## Task 2: navigator rulings

Ruled 2026-10-02 through one AskUserQuestion card, verbatim: "Accept all six (Recommended)". Recorded in 366-SPIKE-RULINGS.md with one `<key>: <value>` line per ruling: `judge: stage-a`, `recall: graph-lexical`, `engines: keep`, `runner: retire`, `jev-runtime: dev-time`, `haiku: separate-producer`. No policy default changes, so plan 366-24 has no egress-policy.json edit from these rulings.

## Deviations from Plan

**1. [Plan vs. tool] Record manifest path.** The plan names `--manifest tests/fixtures/366-spike/manifest.json`; the harness only accepts a manifest under `os.tmpdir()` (it freezes arm outputs from the temp root), so record ran against the 366-19 temp root manifest. `--check` needs no manifest.

**2. [Ruling] The vector arm has no rate.** By the 366-19 ruling it is listed in `awaiting_gold` and its judge files are frozen but not scored.

**3. [Observation] stage-a has one recorded repeat.** The harness records the deterministic stage-a judge once (repeats_recorded 1 of 3), so its `clears_bar_all_repeats` is false by count as well as by rate. It does not change any ruling (its single rate equals the recall arm's).

**4. [Design] adoption.decision stays null.** The harness test pins "the record never adopts"; adoption lives in 366-SPIKE-RULINGS.md.

## Known Stubs

None.

## Threat Flags

None. T-366-84 (rulings verbatim), T-366-85 (--check recompute), T-366-86 (no Jev code moved; runtime Jev not ruled on) held.

## Self-Check: PASSED

record.json, substrate.json, arms/, 366-SPIKE-RULINGS.md present; c6cf03778 and c4e77691a are ancestors of HEAD; `spike-366 --check` exits 0; `^runner: retire` present.

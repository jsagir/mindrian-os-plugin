---
phase: 363
slug: deep-research-planner-quick-and-deep-runs
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-29
---

# Phase 363 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Built from `363-RESEARCH.md` "## Validation Architecture", extended for D-18 (the research-perspective builder) and D-19 (the diffusion lens). Wave 0 (plans 363-01..04: baseline, aggregator, helpers, the D-16 blockers) flips `wave_0_complete` when it lands.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Plain Node scripts with `node:assert/strict`, zero deps; exit 0 PASS, 1 FAIL, 77 ENV GAP (house convention, e.g. `tests/test-361-filing.cjs`) |
| **Config file** | none; aggregator `tests/run-all-363.sh` written once in 363-01 (run / run_if / run_known / counters / em-dash guard / CIRS leg / no-new-dependency leg) |
| **Quick run command** | `node tests/test-363-<area>.cjs` (each offline, `globalThis.fetch` replaced by the 355 net guard or the OpenAlex replay) |
| **Full suite command** | `bash tests/run-all-363.sh` |
| **Estimated runtime** | ~90 seconds for the 363 legs; the nested regression aggregators (130.5, 131, 164, 219, 221, 3551, 361) add several minutes |

Test hygiene for every 363 test: `tests/helpers/hygiene-355.cjs` (`scrubVendorKey`, `installNetGuard`); `OPENALEX_API_KEY` deleted in-process (key legs set `fake-key-363` locally); children get `NODE_OPTIONS=--require <preload>` (thrower or replay); fixture rooms only under mkdtemp and seeded through navigation (`tests/helpers/fixture-room-363.cjs`); a planted marker in room prose for the Part 8 sweep; em-dash and en-dash written as unicode escapes in test sources, never literally.

---

## Sampling Rate

- **After every task commit:** the task's own `node tests/test-363-<area>.cjs`, plus any generator `--check` the task affects
- **After every plan wave:** `bash tests/run-all-363.sh`
- **Before `/gsd-verify-work`:** full suite green (FAILED=0, known reds counted KNOWN), `node scripts/doctor.cjs --acceptance` with no new failing point versus 363-01's recorded set, D-06 rubric checkpoint answered (363-21)
- **Max feedback latency:** 60 seconds per task-level test

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 363-01-01 | 01 | 1 | DRP363-13, DRP363-18 | T-363-13 | before-picture computed from git objects | unit | `node tests/test-363-baseline.cjs` | W0 (this task) | pending |
| 363-01-02 | 01 | 1 | DRP363-13, DRP363-18 | T-363-14 | skips and known reds never counted PASSED | aggregator | `bash tests/run-all-363.sh` | W0 (this task) | pending |
| 363-01-03 | 01 | 1 | DRP363-16, DRP363-06 | N/A | rubric exists before review; out-of-scope egress recorded | doc check | `grep -q 'Pass rule' .planning/phases/363-deep-research-planner-quick-and-deep-runs/363-D06-RUBRIC.md` | W0 | pending |
| 363-02-01 | 02 | 1 | DRP363-16, DRP363-17 | T-363-17 | fixture room seeded only through navigation, marker planted | unit | `node tests/test-363-helpers.cjs` | W0 | pending |
| 363-02-02 | 02 | 1 | DRP363-16 | T-363-09 | replay recorder never stores the key | unit | `node tests/test-363-helpers.cjs` | W0 | pending |
| 363-03-01..03 | 03 | 1 | DRP363-06 | T-363-03, T-363-09, T-363-10 | 429/500/timeout/network never empty_valid; Bearer key only; meta.count carried | unit + regression | `node tests/test-363-corpus-honesty.cjs && node tests/test-221-envelopes.cjs` | W0 | pending |
| 363-04-01..02 | 04 | 1 | DRP363-06, DRP363-07 | T-363-03, T-363-20 | cache carries counts; failures never cached; versioned namespace | unit + regression | `node tests/test-363-cache.cjs && bash tests/run-all-131.sh` | W0 | pending |
| 363-05-01..03 | 05 | 2 | DRP363-01, DRP363-18, DRP363-19, DRP363-20 | T-363-04, T-363-21, T-363-22, T-363-23 | raw query edits refused; revision cap; no rung label on the card; no external deps | unit | `node tests/test-363-plan-schema.cjs` | created in plan | pending |
| 363-06-01..02 | 06 | 2 | DRP363-02, DRP363-11, DRP363-12, DRP363-20 | T-363-24, T-363-25, T-363-26 | D-00 gate; MECE warnings never suppressed; no keyword classifier | unit | `node tests/test-363-pyramid.cjs && bash tests/run-all-164.sh` | created in plan | pending |
| 363-07-01..02 | 07 | 2 | DRP363-19, DRP363-20 | T-363-27..30 | physics needs a derivation; self dominoes excluded; ratchet refuses reopen without evidence | unit | `node tests/test-363-perspective.cjs` | created in plan | pending |
| 363-08-01..02 | 08 | 2 | DRP363-03, DRP363-20 | T-363-01, T-363-04, T-363-31 | every string audited; refusal never echoes | unit | `node tests/test-363-families.cjs` | created in plan | pending |
| 363-09-01..03 | 09 | 2 | DRP363-04, DRP363-05 | T-363-01, T-363-07..09, T-363-11, T-363-32 | every re-ask reason; new term asks; grant never files; append-only audit without the key | unit + ledger check | `node tests/test-363-grants.cjs && node tests/test-363-audit-ledger.cjs && node scripts/check-floor-ledger.cjs` | created in plan | pending |
| 363-10-01..03 | 10 | 2 | DRP363-12, DRP363-20 | T-363-02, T-363-26, T-363-33, T-363-34 | handles only to the graph; IP caps on shipped data; ledger --check | unit + replay | `node tests/test-363-structure.cjs && node scripts/build-research-shape-ledger.cjs --check` | created in plan | pending |
| 363-11-01..02 | 11 | 2 | DRP363-07 | T-363-05, T-363-06, T-363-19, T-363-35 | quote must be in the fetched text; retracted never supports; no scores | unit | `node tests/test-363-evidence-rows.cjs` | created in plan | pending |
| 363-12-01..03 | 12 | 3 | DRP363-07, DRP363-09, DRP363-11 | T-363-01, T-363-03, T-363-07, T-363-10, T-363-11 | provider failure never gap-confirmed; zero fetch without grant; one escalation offer | unit + replay | `node tests/test-363-run-quick.cjs && node scripts/check-floor-ledger.cjs` | created in plan | pending |
| 363-13-01..02 | 13 | 3 | DRP363-08, DRP363-19, DRP363-20 | T-363-04, T-363-06, T-363-07, T-363-10, T-363-36 | run grant required; hash match; mandatory counterevidence; typed stops | unit + replay | `node tests/test-363-run-deep.cjs` | created in plan | pending |
| 363-14-01..02 | 14 | 3 | DRP363-10, DRP363-11, DRP363-19 | T-363-11, T-363-37..40 | nothing written before yes; navigation only; CONTRADICTS kept; proposed only | integration | `node tests/test-363-filing.cjs` | created in plan | pending |
| 363-15-01..03 | 15 | 4 | DRP363-14, DRP363-04, DRP363-12 | T-363-08, T-363-11, T-363-41, T-363-42 | free-text argv refused; approvals become decision nodes | unit + spawned CLI | `node tests/test-363-cli.cjs` | created in plan | pending |
| 363-16-01..02 | 16 | 5 | DRP363-15 | T-363-01, T-363-07, T-363-43..45 | no grant means zero egress; strict 355.1 files untouched; never deep | integration | `node tests/test-363-ambient.cjs` | created in plan | pending |
| 363-17-01..03 | 17 | 5 | DRP363-14, DRP363-04 | T-363-02, T-363-08, T-363-12, T-363-46, T-363-47 | single-use gates; grants persist across restart; no brain calls | wire + contract | `node tests/test-363-mcp-tool.cjs && node tests/test-270-tool-schema-budget.cjs && node scripts/build-connector-registry.cjs --check` | created in plan | pending |
| 363-18-01..03 | 18 | 6 | DRP363-14, DRP363-04, DRP363-19 | T-363-04, T-363-06, T-363-07, T-363-11, T-363-12, T-363-48 | cards before fetch and dispatch; analyst Read-only; D-05 pointers | contract + gates | `node tests/test-363-runner-contract.cjs && node scripts/check-shape-declaration.cjs --check` | created in plan | pending |
| 363-19-01..03 | 19 | 7 | DRP363-13, DRP363-19, DRP363-20, DRP363-02 | T-363-01, T-363-12, T-363-26, T-363-49, T-363-50 | existing flows byte-identical; no fetch or dispatch power added | contract + gates | `node tests/test-363-command-contract.cjs && node scripts/build-command-registry.cjs --check` | created in plan | pending |
| 363-20-01..03 | 20 | 8 | DRP363-16, DRP363-17, DRP363-20, DRP363-04 | T-363-09, T-363-10, T-363-17, T-363-51 | marker and key absent everywhere; live smoke never passes on ENV GAP | e2e + sweep + smoke | `node tests/test-363-acceptance-whitespace.cjs && node tests/test-363-acceptance-diffusion.cjs && node tests/test-363-part8-sweep.cjs && bash tests/run-all-363.sh` | created in plan | pending |
| 363-21-01..03 | 21 | 8 | DRP363-16, DRP363-19 | T-363-52, T-363-53 | executor does not grade its own output | manual (checkpoint) | `grep -A3 'Navigator verdict' .planning/phases/363-deep-research-planner-quick-and-deep-runs/363-D06-REVIEW.md` | created in plan | pending |
| 363-22-01..03 | 22 | 9 | DRP363-01..20 | T-363-12, T-363-54..56 | rows closed only with proof; nothing filed to rooms without approval | gates + checkpoint | `bash tests/run-all-363.sh && node scripts/doctor.cjs --acceptance` | existing | pending |

*Status: pending, green, red, flaky*

Existing legs the aggregator also runs: `bash tests/run-all-130.5.sh`, `run-all-131.sh`, `run-all-219.sh`, `run-all-221.sh`, `run-all-164.sh`, `run-all-3551.sh`, `run-all-361.sh`; `node tests/test-221-envelopes.cjs`, `test-270-tool-schema-budget.cjs`, `test-234-tool-description-floor.cjs`, `test-198-contract-schema.test.cjs`, `test-265-swarm-task-grant.cjs`, `test-265-declaration-truth.cjs`; generator `--check`s (skill mirrors, command registry, connector registry, orchestration projection, harness manifest, research-shape ledger); `check-render-coverage`, `check-layer-declaration`, `check-shape-declaration --check`, `check-floor-ledger`, `check-cirs-declaration --check` over the 363 plans; the no-new-dependency leg; the quick-pass line count leg; the em-dash guard.

Known pre-existing reds, classified by signature as KNOWN, never fixed by 363: `tests/test-260906-fda-known-tool-shapes.cjs`, `lib/core/part8-egress-guard.test.cjs` PB8-03, `tests/test-209-declared-implies-wired.cjs` (signatures re-confirmed by 363-01).

---

## Wave 0 Requirements

- [ ] `tests/run-all-363.sh` - the aggregator, written once (363-01)
- [ ] `tests/test-363-baseline.cjs` + `tests/fixtures/363-pre-phase.json` - byte and digest baseline for the six edited commands, scout.md, scheduled-tasks.md, the registries and the dependency sets (363-01)
- [ ] `.planning/phases/363-deep-research-planner-quick-and-deep-runs/363-D06-RUBRIC.md` - the written human rubric (363-01)
- [ ] `tests/helpers/fixture-room-363.cjs` - two-section cohort room, frozen whitespace results, role variants, timing artifact variant, planted marker (363-02)
- [ ] `tests/helpers/openalex-replay-363.cjs` + `tests/fixtures/363-openalex/*.json` - routed replay with 429, 500, timeout and network sentinels and rate-limit headers (363-02)
- [ ] D-16 blockers fixed first: `tests/test-363-corpus-honesty.cjs` (363-03) and `tests/test-363-cache.cjs` (363-04)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A map-unknowns research plan asks questions beyond the navigator's stated question and names assumed limiters the navigator did not name | DRP363-16, DRP363-19 (D-06, D-00, D-18) | Code can check structure (the D-00 origin gate); only a human can judge whether the questions are good and unprompted | 363-21 Task 2: score `363-D06-REVIEW.md` against `363-D06-RUBRIC.md` R1-R7 and the pass rule |
| Live OpenAlex behavior in both modes | DRP363-16 (D-06) | Spends a small metered budget and needs network; offline replay covers correctness | 363-20 Task 3: `MOS_363_LIVE=1 node tests/test-363-live-smoke.cjs` once; 77 on ENV GAP is recorded, never PASSED |
| Research trail routing to the rethinking room and its mirror | Dev-Research Compositing | Nothing files to a room without the navigator's approval | 363-22 Task 2: approve, edit or hold the routing table |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s per task-level test
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

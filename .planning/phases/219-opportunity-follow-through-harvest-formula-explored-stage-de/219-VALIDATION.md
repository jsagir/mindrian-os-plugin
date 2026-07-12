---
phase: 219
slug: opportunity-follow-through-harvest-formula-explored-stage-de
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-13
planned: 2026-07-13
---

# Phase 219 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 219-RESEARCH.md "Validation Architecture" (source of truth for the req->test map).
> Per-task map filled by the planner 2026-07-13 (7 plans, 5 waves).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in assertions + bash harness (no jest/mocha); `tests/test-*.cjs` + `tests/run-all-<phase>.sh` |
| **Config file** | none - each test is a standalone `node tests/test-219-*.cjs` returning exit 0/1 |
| **Quick run command** | `node tests/test-219-<slice>.cjs` |
| **Full suite command** | `bash tests/run-all-219.sh` then `node scripts/doctor.cjs --acceptance` |
| **Estimated runtime** | ~30-90 seconds (suite); doctor acceptance ~60s |

---

## Sampling Rate

- **After every task commit:** Run the slice test for the surface touched: `node tests/test-219-<slice>.cjs`
- **After every plan wave:** Run `bash tests/run-all-219.sh` + `node scripts/build-connector-registry.cjs --check`
- **Before `/gsd-verify-work`:** Full suite green + `node scripts/doctor.cjs --acceptance` + the LIVE ador-ip-test run recorded in 219-VERIFICATION.md
- **Max feedback latency:** ~90 seconds (offline suite)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 219-01-T1, 219-01-T2 | 219-01 | 1 | REQ-1 banking | T-219-01 raw-insert bypass; T-219-02 auto-confirm | all writes via navigation.cjs; review_status='proposed'; predicate = critic verdict never AHP rank | unit + grep | `node tests/test-219-banking.cjs` | ❌ W0 (created by 219-01-T1) | ⬜ pending |
| 219-01-T3 | 219-01 | 1 | harness (all reqs) | T-219-01 | run_if file-gated legs; Part 8/9 grep gates | gate | `bash tests/run-all-219.sh` | ❌ W0 (created by 219-01-T3) | ⬜ pending |
| 219-02-T1 | 219-02 | 1 | REQ-7 FTS5 unblocker | T-219-06 fts5 crash (DoS) | probe + bi-modal degrade + honest provenance, never crash | unit | `node tests/test-219-fts5-degrade.cjs` (+ forced `MINDRIAN_FORCE_FTS_ABSENT=1` run) | ❌ W0 (created by 219-02-T1) | ⬜ pending |
| 219-02-T2 | 219-02 | 1 | REQ-5 metadata slice | T-219-05 injection; T-219-07 egress | deterministic zero-LLM parse; JSON-scalar props; merge UPSERT; opts.paths scoped seam | unit + grep | `node tests/test-219-metadata.cjs`; Part-8 boundary scan | ❌ W0 (created by 219-02-T2) | ⬜ pending |
| 219-02-T3 | 219-02 | 1 | fixture (R1 countermeasure) | T-219-08 | hub-skew fixture seeded via navigation only | helper + smoke | node -e smoke (see plan) | ❌ W0 (created by 219-02-T3) | ⬜ pending |
| 219-03-T1..T3 | 219-03 | 2 | REQ-2 harvest sensor (sensor-opportunity-harvest.cjs; side-channel last-opportunity-harvest.json - renamed off the Phase 188 harvest-scope collision) | T-219-09 egress; T-219-10 ungated writes; T-219-11 spoofed side-channel | enum/handle-only evidence bag; zero-connection suppressed; read-only producer; freshness gate; D-18 components typed 'unknown' never fabricated zero | unit | `node tests/test-219-harvest-sensor.cjs` | ❌ W0 (created by 219-03-T1, RED-first) | ⬜ pending |
| 219-04-T1..T3 | 219-04 | 2 | REQ-3 qualification | T-219-13 auto-confirm; T-219-15 auto-fire; T-219-30 silent manual substitution | only human Qualify advances lifecycle via append-only stage_history (D-17); Skip writes REJECTED_BECAUSE; nothing files without Qualify; D-20 offer verb only under forced engine-absent, engine_mode label end-to-end | unit + gate | `node tests/test-219-qualify.cjs`; `node scripts/check-render-coverage.cjs` | ❌ W0 (created by 219-04-T1) | ⬜ pending |
| 219-05-T1 | 219-05 | 3 | D-19 research contract drift fix + provider envelope | T-219-29 ok+empty lie | typed research_mode + per-provider status; cold corpus = insufficient_evidence; research-cache holds no room body text | unit + guard | `node tests/test-219-research-contract.cjs` | ❌ W0 (created by 219-05-T1, RED-first) | ⬜ pending |
| 219-05-T2..T5 | 219-05 | 3 | REQ-4 explore chain + D-16 corpus contract | T-219-17 egress; T-219-18 auto-fire cost; T-219-21 web outage; T-219-30 silent manual substitution | chain NEVER auto-fires on qualify; material steps halt; room-corpus degrade with honest provenance + research_mode; post-filing extraction; D-20 engine-breaks halt+offer with engine_mode label; D-21 nesting via existing filing ops | unit | `node tests/test-219-explore-chain.cjs` | ❌ W0 (created by 219-05-T2, RED-first) | ⬜ pending |
| 219-04-T2, 219-05-T1, 219-06-T1 | 219-04/05/06 | 2/3/4 | Born-wired/shape | - | every net-new surface WIRED + hitl_shape declared | gate | `node scripts/build-connector-registry.cjs --check`; `node scripts/check-shape-declaration.cjs --check` | ✅ existing | ⬜ pending |
| 219-07-T1..T3 | 219-07 | 5 | REQ-7 release-READINESS (joint 219+220 cut - release.sh NOT executed in 219, navigator decision 2026-07-13) | T-219-25 hand-bump; T-219-26 gate skip | staged drafts only; git diff --exit-code on version files; corepower confirmation before staging closes | release-staging | `git diff --exit-code package.json .claude-plugin/plugin.json CHANGELOG.md README.md`; `bash tests/run-all-219.sh` | ✅ existing | ⬜ pending |

*Status: ⬜ pending / ✅ green / ❌ red / ⚠ flaky*

---

## Wave 0 Requirements

- [ ] `tests/run-all-219.sh` - phase harness (clone run-all-218.sh) - **219-01-T3**
- [ ] `tests/test-219-banking.cjs` - REQ-1 node + edge + no-bypass grep - **219-01-T1 (RED-first)**
- [ ] `tests/test-219-harvest-sensor.cjs` - REQ-2 fixture bridge/contradiction + Four-Lens labels + zero-connection suppression + D-18 components - **219-03-T1 (RED-first; extended T2, finalized T3)**
- [ ] `tests/test-219-qualify.cjs` - REQ-3 rejection edge + lifecycle advance - **219-04-T1 (RED-first)**
- [ ] `tests/test-219-explore-chain.cjs` - REQ-4 chain composition + Minto shape + no-auto-fire + D-16 corpus contract + D-19 envelope + D-20 manual-baseline + D-21 nesting - **219-05-T2 (RED-first; finalized T5)**
- [ ] `tests/test-219-research-contract.cjs` - D-19 drift fix (docs-to-reality) + provider envelope + research-cache no-room-body guard - **219-05-T1 (RED-first)**
- [ ] `tests/test-219-metadata.cjs` - REQ-5 frontmatter props + zero-egress - **219-02-T2 (RED-first)**
- [ ] `tests/test-219-fts5-degrade.cjs` - FTS5 probe forced-absent -> bi-modal + honest provenance (REQ-7 Windows unblocker) - **219-02-T1 (RED-first)**
- [ ] Fixture room builder `tests/helpers/fixture-room-219.cjs` - bridge + contradiction + low-degree entity family + accumulated hub skew (the fixture 218 lacked; R1 countermeasure) - **219-02-T3**

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ador-ip-test live end-to-end: extraction + metadata -> eureka banking -> harvest candidates -> navigator qualifies >=1 -> [Explore] -> Minto artifact in bank with cited sources + >=2 typed edges, lifecycle `explored` + appended stage_history (D-17), explored artifact's entities visible via graph_query (D-16), D-20 forced engine-absent offer + label proven, D-21 nesting + STATE.md pickup asserted | REQ-6 | Live-room checkpoint is the ONLY thing that catches the 218-class gap (fixture-green lied twice); requires human Qualify at the card | Plan 219-06 (Wave 4): Task 2 automated pipeline + evidence, Task 3 blocking navigator checkpoint; evidence in 219-VERIFICATION.md |
| corepower-isolation validation (Desktop, Windows machine) | REQ-7 / D-13 | Room exists only on the Desktop machine; navigator-run; also proves the FTS5 bi-modal degrade live | Plan 219-07 (Wave 5): Task 1 paste-ready prompt (production /mos:eureka path, NEVER manual baseline), Task 2 blocking checkpoint; recorded in 219-VERIFICATION.md BEFORE release staging closes; closes the open post-218 eureka re-run memory item. The version cut itself is DEFERRED to the joint 219+220 release (release.sh executes at Phase 220 completion). |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (Plan 06/07 checkpoints are bracketed by automated gate sweeps)
- [x] Wave 0 covers all MISSING references (every test file has an owning task; RED-first where tdd applies)
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner-filled 2026-07-13; execution flips row statuses

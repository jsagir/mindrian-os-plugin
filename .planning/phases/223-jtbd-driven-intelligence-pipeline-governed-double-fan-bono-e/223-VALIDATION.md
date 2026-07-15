---
phase: 223
slug: jtbd-driven-intelligence-pipeline-governed-double-fan-bono
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-15
updated: 2026-07-15
---

# Phase 223 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node zero-deps test scripts (repo convention: `tests/test-223-*.cjs`, aggregated by `tests/run-all-223.sh`) |
| **Config file** | none — new tests register in `lib/memory/run-feynman-tests.cjs` |
| **Quick run command** | `node tests/test-223-<module>.cjs` (single-file, per-task) |
| **Full suite command** | `bash tests/run-all-223.sh` |
| **Estimated runtime** | ~45 seconds (fixture rooms are tmpdir SQLite; debate/fan legs use injected test seams, no live LLM/network) |

---

## Sampling Rate

- **After every task commit:** Run the task's own `node tests/test-223-*.cjs` leg
- **After every plan wave:** Run `bash tests/run-all-223.sh`
- **Before `/gsd-verify-work`:** Full suite green PLUS no-regression legs: `bash tests/run-all-224.sh` (shared edges/derivation path), `bash tests/run-all-164.sh` (bono base, 20/20), `node tests/test-graph-derive-sweep.cjs` (4/4)
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

> Task IDs finalized by the planner; requirement rows fixed by 223-SPEC.md + CONTEXT D-01..D-04.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 223-01 | 01 | 1 | Req 1 (hat governance + persona research) | T-223-02 | per-hat behavioral difference in debate fixture; heterogeneity mandate (no two persona cells share a lens); persona cannot cite outside its wired INFORMS set; CR-01 fixture (no Promise deriveFn) | integration | `node tests/test-223-hat-governance.cjs` | ❌ W0 | ⬜ pending |
| 223-02 | 02 | 1 | Req 2 (MECE-Minto synthesis + SUPERSEDES chain) | — | 2-run fixture: exactly one SUPERSEDES edge (NULL review_status per D-04, SELECT-asserted); 1-run fixture: zero; chain walker lists order | integration | `node tests/test-223-supersedes-chain.cjs` | ❌ W0 | ⬜ pending |
| 223-02 | 02 | 1 | Req 4 (close-the-loop, D-01 dual store) | — | claim/opportunity/open_question nodes in room.db, all proposed (D-02); bank .md written FIRST (crash-ordering fixture) with the six reader-required fields; real compute-opportunity-state surfaces it | integration | `node tests/test-223-close-loop.cjs` | ❌ W0 | ⬜ pending |
| 223-03 | 03 | 2 | Req 1/2/6 (bono 8-phase body + --version-log + mirror regen) | T-223-13 | mirror regenerated via build-skill-mirrors.cjs, DESENSITIZE asymmetry asserted (command SENS-05, mirror []); zero mindrian-designs refs | integration + static | legs in plan 03 tests | ❌ W0 | ⬜ pending |
| 223-04 | 04 | 3 | Req 3 (intel-pipeline full loop) + Req 4 | T-223-14..18 | --dry-run emits phase/fan plan without dispatch; real run halts at all 3 hitl_stages; quality:low forces HALT; G-2 exactly-one-setCurrent | integration | `node tests/test-223-intel-pipeline.cjs` | ❌ W0 | ⬜ pending |
| 223-05 | 05 | 4 | Req 5 (born-wired + structural gates) | — | build-connector-registry --check, check-shape-declaration, build-orchestration-projection --check, check-render-coverage all exit 0; registry diff = exactly 2 entries, 0 changed reach_ids | gate | legs inside `run-all-223.sh` | ❌ W0 | ⬜ pending |
| 223-05 | 05 | 4 | Req 6 (no mindrian-designs refs, permanent) | — | `grep -r "mindrian-designs" commands/ skills/ lib/core/bono/` returns nothing (harness leg) | static | grep leg inside `run-all-223.sh` | ❌ W0 | ⬜ pending |
| 223-01/05 | 01, 05 | 1, 4 | Part 8 egress (persona research SIGNAL->LOCAL) | T-223-02 | part8-egress-guard.classify wraps research calls; seeded LOCAL-content breach rejected; grep gate on new modules, permanent harness leg | static + unit | `node tests/test-223-part8-egress.cjs` | ❌ W0 | ⬜ pending |

> Naming note: 223-RESEARCH.md's test map named a single `test-223-bono-v2.cjs`; the plans use
> the per-concern file split above, which supersedes RESEARCH's naming (plan-check warning 3).

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test-223-hat-governance.cjs` — debate fixture with injected seams (runDebate's deriveFn/gateFn/selfCritiqueFn; no live LLM)
- [ ] `tests/test-223-close-loop.cjs` — scratch-room fixture asserting BOTH stores (room.db node + bank .md), reusing `tests/helpers/fixture-room-224.cjs` where applicable
- [ ] `tests/run-all-223.sh` — aggregate harness scaffold (run-all-222/224.sh shape)
- [ ] Fan/dispatch legs use `runCellFanout`'s injectable `dispatchCell/researchFn` seams — never live web research in tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Governed-flow prose quality | Req 1/6 fallback | Drafted from SPEC, not transcribed from the missing source dir — only a human judges Larry-voice fidelity | Read the new bono.md 8-phase flow + intel-pipeline SKILL.md aloud against voice-dna.md |
| Live hitl_stages feel | Req 3 | Card firing/halting UX can't be fixture-proven | Run /mos:intel-pipeline against a scratch room; confirm the 3 gates (calibrate F.1, fan-approve F.1, synthesize F.5) fire as cards |
| Real-web persona research | Req 1 | Tavily/live research quality out of fixture scope | One live bono run on a real topic; check personas cite only their own wired sources |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

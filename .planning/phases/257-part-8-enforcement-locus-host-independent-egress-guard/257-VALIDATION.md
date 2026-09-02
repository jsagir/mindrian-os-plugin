---
phase: 257
slug: part-8-enforcement-locus-host-independent-egress-guard
status: reconciled
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-02
---

# Phase 257 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Plain Node.js scripts using `node:assert` plus `node:test` in places. No jest/vitest |
| **Config file** | none, per-phase `tests/run-all-<phase>.sh` aggregators |
| **Quick run command** | `node tests/test-257-<name>.cjs` |
| **Full suite command** | `bash tests/run-all-257.sh`, plus `bash tests/run-all-239.sh`, `bash tests/run-all-234.sh` |
| **Estimated runtime** | ~10 seconds hermetic (capture-server based, no live network required for the guard proofs) |

---

## Sampling Rate

- **After every task commit:** `node scripts/check-substrate.cjs --diff` plus the single 257 test file touched
- **After every plan wave:** `bash tests/run-all-257.sh` plus `node tests/test-239-query-egress-canary.cjs` and both Phase 254 tests (`test-254-composition-census.cjs`, `test-254-ambiguous-disclosure.cjs`)
- **Before `/gsd-verify-work`:** `bash tests/run-all-239.sh` (report honestly against the recorded 7-pass/2-fail baseline, and do not claim green without addressing D-10), `bash tests/run-all-234.sh` if present, `node scripts/doctor.cjs --acceptance` (Class O `agentshield-all-surfaces-clean`)
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 257-01-01 | 01 | 1 | LOCUS-01 | T-257-01/02 | `egress_blocked` refusal kind exists with its own `BRAIN_EGRESS_BLOCKED` status; its reason never echoes caller payload | unit | `node tests/test-250-refusal-queue.cjs` | exists | pending |
| 257-01-02 | 01 | 1 | LOCUS-01 | T-257-03 | The doctor recognizer knows the new status; both frozen five-member contracts amended | unit | `node tests/test-257-refusal-egress-kind.cjs` | created by 257-01 | pending |
| 257-02-01 | 02 | 1 | LOCUS-02 | T-257-05/06 | `egress_disclosure` and `refusal` survive `wrapDirective`; absence is byte-identical | unit | `node lib/core/directive-envelope.test.cjs` | exists | pending |
| 257-02-02 | 02 | 1 | LOCUS-02 | T-257-05/08 | No generic key passthrough; copy-on-attach | unit + mutation | `node tests/test-257-envelope-passthrough.cjs` | created by 257-02 | pending |
| 257-03-01 | 03 | 1 | LOCUS-04 | T-257-09/11 | Census Seam A comment corrected; declaration untouched | structural | `node tests/test-254-composition-census.cjs` | exists | pending |
| 257-03-02 | 03 | 1 | LOCUS-04 | T-257-10 | Handoff correction is append-only | doc gate + git diff | `node scripts/check-substrate.cjs --diff` | exists | pending |
| 257-04-01 | 04 | 1 | LOCUS-05, LOCUS-06 | T-257-13/14/15 | D-01 and D-02 stated as ruled; four-path coverage table; RCA cited not investigated | doc gate | grep battery in the plan's acceptance criteria | n/a | pending |
| 257-04-02 | 04 | 1 | LOCUS-09 | T-257-16/17 | T-1/T-2/T-3 recorded; Theo repo unmodified | doc gate | `git -C /home/jsagi/Theo status --porcelain` | n/a | pending |
| 257-05-01 | 05 | 1 | LOCUS-08 | T-257-19/21 | Every gate has a recorded pre-change value, including doctor Class O (research A5) | record | `bash tests/run-all-239.sh` captured verbatim | created by 257-05 | pending |
| 257-05-02 | 05 | 1 | LOCUS-08 | T-257-18/20 | Both 239 arms derive the matcher from `hooks.json`; staleness leg still fires | unit + mutation | `node tests/test-239-brain-tool-liveness.cjs` | exists | pending |
| 257-06-01 | 06 | 2 | LOCUS-01 | T-257-23/24/26 | `brain_ask` returns an honest typed refusal on `egress_blocked`, never an empty envelope, never labelled unreachable | integration (spawn + wire) | `node tests/test-257-shim-honest-refusal.cjs` | created by 257-06 | pending |
| 257-06-02 | 06 | 2 | LOCUS-01 | T-257-25/28/29 | The five raw-passthrough tools map the sentinel through the chokepoint; `brain_query`'s G2 gap is commented and pinned | integration | same file, separate arms | created by 257-06 | pending |
| 257-06-03 | 06 | 2 | LOCUS-02 | T-257-27 | `egress_disclosure` reaches the model on `brain_ask`; zero wire bytes on every block arm | integration + mutation | same file, Arms 4-5 | created by 257-06 | pending |
| 257-07-01 | 07 | 3 | LOCUS-03 | T-257-30/31/33 | Every tool the live `tools/list` advertises yields zero wire bytes on a canary; ambiguous proceeds and discloses; allow still works | integration + mutation | `node tests/test-257-brain-tool-egress-invariant.cjs` | created by 257-07 | pending |
| 257-07-02 | 07 | 3 | LOCUS-03 | T-257-31/34 | Tool list derived from `tools/list` and reconciled in BOTH directions, never a frozen array | structural | same file, Arm 1 | created by 257-07 | pending |
| 257-07-03 | 07 | 3 | LOCUS-03 | T-257-35 | Phase aggregator, SKIP-safe, glob-derived members | harness | `bash tests/run-all-257.sh` | created by 257-07 | pending |
| 257-08-01 | 08 | 4 | LOCUS-07 | T-257-40 | Assumption A3 re-measured on this tree before any edit; explicit STOP path if it diverges | unit | `node tests/test-257-strict-input-shapes.cjs` | created by 257-08 | pending |
| 257-08-02 | 08 | 4 | LOCUS-07 | T-257-36/37/38/39 | All six tools reject undeclared keys before any handler runs; catalog parity preserved | integration + mutation | same file, Arms A-G | created by 257-08 | pending |
| 257-08-03 | 08 | 4 | LOCUS-07 | T-257-41 | The registration migration did not change wire behavior | regression | `node tests/test-257-brain-tool-egress-invariant.cjs` | created by 257-07 | pending |
| 257-09-01 | 09 | 5 | LOCUS-10 | T-257-42/43/45 | Part 8 gate battery run and recorded against the baseline; no bare green claim | acceptance | `node scripts/doctor.cjs --acceptance` (Class O) | exists | pending |
| 257-09-02 | 09 | 5 | LOCUS-10 | T-257-46/47 | LOCUS-01..10 finalized with traceable measured proof; research trail filed in both homes | record | LOCUS presence check in the plan's verify block | exists | pending |
| 257-09-03 | 09 | 5 | LOCUS-10 | T-257-44 | Canon Custodian sign-off on the diff surface and the four-path coverage statement | manual (blocking checkpoint) | none, human gate by design | n/a | pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs reconciled to the real plan set on 2026-09-02: 9 plans across 5 waves. Threat Ref values index the per-plan `<threat_model>` registers (T-257-01 through T-257-47 plus T-257-SC).*

---

## Wave 0 Requirements

No separate Wave 0 pass is needed: each plan creates the test it verifies against, within the same
plan, before or alongside the code it covers. The five new test files and the aggregator are owned as
follows.

- [ ] `tests/test-257-refusal-egress-kind.cjs` - 257-01
- [ ] `tests/test-257-envelope-passthrough.cjs` - 257-02
- [ ] `tests/test-257-shim-honest-refusal.cjs` - 257-06 (G1/G3 disclosure arms, spawned server)
- [ ] `tests/test-257-brain-tool-egress-invariant.cjs` - 257-07 (the locked invariant; tool list from live `tools/list`, never frozen)
- [ ] `tests/test-257-strict-input-shapes.cjs` - 257-08 (SKIPs cleanly in `run-all-257.sh` until it exists)
- [ ] `tests/run-all-257.sh` - 257-07, SKIP-safe aggregator cloned from `tests/run-all-239.sh`, members glob-derived
- [ ] `.planning/phases/257-.../257-BASELINE.md` - 257-05, runs FIRST and records the pre-change value of every gate this phase later reports against (including doctor Class O, which research assumption A5 never established)
- [ ] No framework install needed - `node:assert` and `node:test` already in use

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Canon Custodian sign-off | D-11 (PR gate) | The Canon Custodian half of the Part 8 PR gate is purely a human gate, no automation enforces it | Present the diff surface and which of the four Brain paths (client-CLI-shimmed, client-CLI-direct-HTTP, Desktop, Cowork) it covers and which it deliberately does not (per D-01/D-02); require explicit navigator approval before the phase closes |
| Far-side/direct-HTTP rulings reflected accurately | D-01, D-02 | These are already-ratified navigator decisions, not something a test can validate for correctness, only for presence | Read the filed documentation paragraph(s) and confirm they state the ruling as actually given, not a paraphrase drift |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (both new test files + aggregator)
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** reconciled to the plan set 2026-09-02 by `/gsd-plan-phase 257`.

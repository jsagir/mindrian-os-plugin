---
phase: 148
slug: larryreach-selector-re-wire-intelligence-toggleable-components
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-08
---

# Phase 148 - Validation Strategy

> Per-phase validation contract. Derived from 148-RESEARCH.md "## Validation Architecture". The per-task map below is finalized against the 5 plan files (148-01..148-05). Every IRW requirement maps to a falsifiable `node tests/test-148-*.cjs` verify owned by a specific plan task.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node CJS asserts + bash runner (the shipped `tests/run-all-<phase>.sh` + `test-*.cjs` pattern; mirrors `run-all-1433.sh`) |
| **Config file** | none - bash + node, no test framework install |
| **Quick run command** | `node tests/test-148-<unit>.cjs` |
| **Full suite command** | `bash tests/run-all-148.sh` |
| **Estimated runtime** | ~60-120 seconds |

---

## Sampling Rate

- **After every task commit:** Run the task's `node tests/test-148-<unit>.cjs`
- **After every plan wave:** Run `bash tests/run-all-148.sh`
- **Before `/gsd-verify-work`:** Full suite green AND the carried frozen-contract drift fences (rewritten to expect 6 reach_ids) green
- **Max feedback latency:** ~120 seconds

---

## Per-Requirement Verification Map

| Requirement | Secure/Correct Behavior | Test Type | Automated Command | Owning Plan/Task | Status |
|-------------|-------------------------|-----------|-------------------|------------------|--------|
| IRW-01 | 5 engine frameworks resolve to a real command + are rankable | unit | `node tests/test-148-engine-reaches.cjs` | 148-04 / Task 2 | pending |
| IRW-02 | `hats` is a REAL 6th machine reach_id; `DIAL_REACH_K===6`; per-room persona cache read-then-rebuild | unit | `node tests/test-148-hats-sixth-reach.cjs` | 148-01 / Task 3 (cache hardened by 148-05 / Task 2) | pending |
| IRW-03 | File + Brain review + Free-Text present at every render OUTSIDE `MAX_K=3` cap (mode_a/mode_b/tier_0/cold) | unit | `node tests/test-148-standing-options.cjs` | 148-03 / Task 3 | pending |
| IRW-04 | component-map resolves each reach; >=3 distinct components; a non-intelligence reach carries its archetype component | unit | `node tests/test-148-component-map.cjs` | 148-03 / Task 3 | pending |
| IRW-05 | offer-resolver + suggest-next + F.1 route through ONE reach-host renderer (single code path) | unit | `node tests/test-148-unified-host.cjs` | 148-05 / Task 3 | pending |
| IRW-06 | select reverse-salient -> command-resolver -> command executes (not stubbed) -> `SELECTED_REACH` edge in room.db -> artifact lands | integration | `node tests/test-148-real-invocation.cjs` | 148-04 / Task 2 | pending |
| IRW-07 | `MAX_K===3`, `RECOMMEND_FLOOR===0.70`, `MARGIN_THRESHOLD===0.15` unchanged; no bespoke widget outside dispatcher | unit + grep | `node tests/test-148-frozen-contracts.cjs` | 148-04 / Task 3 | pending |
| IRW-08 | Brain-review path = typed packet only; `check-brain-boundary` passes; adversarial no-user-content assertion | unit + grep | `node tests/test-148-brain-review-egress.cjs` (+ check-brain-boundary in run-all-148.sh) | 148-05 / Task 3 | pending |
| A1/D-09 lockstep | the carried drift fences (was: exactly 5) rewritten to expect 6 and GREEN; connector `--check` passes; Canon amendment present | regression | `bash tests/run-all-148.sh` (re-runs carried drift fences) + `node scripts/build-connector-registry.cjs --check` | 148-01 / Task 2 + 148-02 | pending |

*Status: pending - green - red - flaky*

---

## Wave 0 Requirements

- [ ] `tests/run-all-148.sh` - the aggregator (clones `run-all-1433.sh`: CJS asserts + carried drift fences expecting 6 + standalone Part-8 grep sweep + check-brain-boundary). Created in 148-03 / Task 3.
- [ ] Per-IRW `test-148-*.cjs` suites, created in their owning plan's wave:
  - `test-148-hats-sixth-reach.cjs` (148-01)
  - `test-148-component-map.cjs`, `test-148-standing-options.cjs` (148-03)
  - `test-148-engine-reaches.cjs`, `test-148-real-invocation.cjs`, `test-148-frozen-contracts.cjs` (148-04)
  - `test-148-unified-host.cjs`, `test-148-brain-review-egress.cjs` (148-05)
- [ ] Carried drift fences rewritten 5 -> 6 (148-01 / Task 2): test-reach-ids-drift, test-dial-label-bank-drift, test-dial-graph-relationship-layer, test-sensor-spine-dispatch, test-orchestrator-doctrine-presence, test-dial-reach-orchestrator, test-dial-end-to-end-states (test-posture-ids-drift stays at 3)

*Existing infrastructure (node + bash) covers the framework; no install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| In-conversation render look/feel (multiSelect rows, "go deep" marker, "what can I help you with" lead) | IRW-03/04, D-06/07 | AskUserQuestion render is host-driven; visual confirmation only | Dogfood in the mindrianOS room: trigger the selector at cold-room and at signal; confirm 6 reaches + standing trio + marker |

*All machine behaviors have automated verification; only the in-conversation visual render is manual.*

---

## Validation Sign-Off

- [x] All tasks have an `<automated>` verify or a Wave 0 dependency
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers `run-all-148.sh` + the carried drift fences
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter (per-task map complete)

**Approval:** planner-complete (pending execution)

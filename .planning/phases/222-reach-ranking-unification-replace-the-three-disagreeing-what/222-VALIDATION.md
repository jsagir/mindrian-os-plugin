---
phase: 222
slug: reach-ranking-unification-replace-the-three-disagreeing-what
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-14
planned: 2026-07-15
---

# Phase 222 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Plain `node:assert/strict` CJS test files + a `bash` aggregator (house pattern; NO jest/mocha) |
| **Config file** | none — each `tests/test-222-*.cjs` is self-running; aggregated by `tests/run-all-222.sh` |
| **Quick run command** | `node tests/test-222-<leg>.cjs` (the single leg the task touched) |
| **Full suite command** | `bash tests/run-all-222.sh` |
| **Estimated runtime** | ~30-60 seconds (temp-room fixtures via real openRoomDb; zero network, zero model downloads) |

---

## Sampling Rate

- **After every task commit:** Run the task's own leg (see map below)
- **After every plan wave:** Run `bash tests/run-all-222.sh` (run_if-guarded, partial-landing safe — SKIPs are expected until Wave 4)
- **Before `/gsd-verify-work`:** `bash tests/run-all-222.sh` must exit PASS with **FAIL=0 SKIP=0** (SPEC phase-level acceptance)
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 222-01-01 | 01 | 1 | Req 3 (D-02) | T-222-04 | migration idempotent, ROLLBACK on error, never bricks openRoomDb | unit (node -e probe) | `node -e` sentinel double-run probe (in-plan) | ✅ inline | ⬜ pending |
| 222-01-02 | 01 | 1 | Req 3, Req 7 | T-222-01/02/03 | write-side scalar validation; typed accessors only; enum-only event payload | integration (real openRoomDb, no mocks) | `node tests/test-222-weight-state.cjs` | ❌ created in-task | ⬜ pending |
| 222-01-03 | 01 | 1 | Req 5 | — | frozen scalars byte-guarded before any behavior edit | regression | `node tests/test-222-frozen-scalars.cjs` | ❌ created in-task | ⬜ pending |
| 222-02-01 | 02 | 2 | Req 3 (D-01, D-03) | T-222-01/03/04 | Hedge convergence; debounce at N; chokepoint-only db access; hot-path soft-fail | unit + integration (real temp room.db) | `node tests/test-222-hedge-update.cjs` | ❌ created in-task | ⬜ pending |
| 222-02-02 | 02 | 2 | Req 1, Req 7 | T-222-01/02 | corrupt/missing state → D4-alone + disclosed event; healthy/cold → silence; 0/1 byte-identity | integration (real temp room.db) | `node tests/test-222-rank-fired.cjs && node tests/test-222-degrade.cjs` | ❌ created in-task | ⬜ pending |
| 222-03-01 | 03 | 3 | Req 2 (D-01) | T-222-02 | Wicked precedence + dead-Brain degrade byte-untouched | regression + smoke | `node -e` decide() probe + `node tests/test-213-reach-wired.cjs` | ✅ existing | ⬜ pending |
| 222-03-02 | 03 | 3 | Req 1 (D-01) | T-222-03/04 | zod schemas untouched; 0/1 path skips db open; Part 11 registry green | regression | `node tests/test-198-contract-schema.test.cjs` + `node scripts/build-connector-registry.cjs --check` | ✅ existing | ⬜ pending |
| 222-03-03 | 03 | 3 | Req 2, Req 6 (D-04) | T-222-01/02 | real registration + real decide(); negative arm proves load-bearing | reachability (born-wired, no mocks) | `node tests/test-222-reach-wired.cjs` | ❌ created in-task | ⬜ pending |
| 222-04-01 | 04 | 4 | Req 4 (D-04) | T-222-SC, T-222-02/03 | require-allowlist; Part 8/9 comment-stripped sweeps; package.json diff gate | tripwire + harness | `bash tests/run-all-222.sh` | ❌ created in-task | ⬜ pending |
| 222-04-02 | 04 | 4 | Req 4, 5, 6 + SPEC checklist | T-222-04 (repudiation) | every acceptance line closed with a proving command | phase gate | `bash tests/run-all-222.sh && git diff --quiet package.json package-lock.json && node scripts/build-connector-registry.cjs --check` | mixed | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Requirement IDs are Phase 222's LOCAL Reqs 1-7 from 222-SPEC.md (no global REQ-XX ids are mapped to this phase). Threat refs are the T-222-XX register shared across the four plans' `<threat_model>` blocks.

---

## Wave 0 Requirements

No standalone Wave 0. Each test file is born in the same task as the behavior it pins (the repo's RED/GREEN house pattern), and `tests/run-all-222.sh` `run_if`-guards every leg on file existence, so a partially-landed phase exits with SKIPs, never false FAILs. Framework install: none needed (plain node + bash already present).

Shared fixtures (created inside the test files that need them, mirroring `test-213-reach-wired.cjs::makeRoom` and `test-198`'s `makeFakeServer`):

- [ ] Temp-room helper via real `openRoomDb` (runs the real 3-migration chain) — used by test-222-weight-state, test-222-hedge-update, test-222-degrade, test-222-reach-wired
- [ ] A fixture turn/ctx making >=2 sensors fire with a score-first != registry-first split — test-222-reach-wired ARM 1/2
- [ ] Seeded `f_selector_decision` rows via `navigation.logMemoryEvent` (>=N qualifying) — test-222-hedge-update Test 3

---

## Manual-Only Verifications

All phase behaviors have automated verification. (Backend selection change, no visual surface; the Tri-Polar check is satisfied by the reachability legs covering both the engine arm and the MCP arm per 222-RESEARCH.md's Project Constraints section.)

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or in-task test creation (no MISSING references remain)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every task carries one)
- [x] Wave 0 covers all MISSING references (n/a — in-task creation + run_if guards)
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planned 2026-07-15 (execution statuses updated per task by /gsd-execute-phase)

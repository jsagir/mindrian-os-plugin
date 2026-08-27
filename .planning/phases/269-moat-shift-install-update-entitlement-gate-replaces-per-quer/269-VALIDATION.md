---
phase: 269
slug: moat-shift-install-update-entitlement-gate-replaces-per-quer
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-27
---

# Phase 269 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — plain Node CJS assertion scripts (`*.test.cjs` under `lib/` and `tests/`) plus per-phase bash aggregators (repo-wide convention, no jest/vitest/pytest anywhere) |
| **Config file** | none — Wave 0 creates the phase aggregator |
| **Quick run command** | `node tests/269-doctrine-reconcile.test.cjs` |
| **Full suite command** | `bash tests/run-all-269.sh` (Wave 0 — pattern: `tests/run-all-266.sh`) |
| **Estimated runtime** | ~5 seconds (text-assertion scripts only, no engineering deliverable to run) |

---

## Sampling Rate

- **After every task commit:** Run `node tests/269-doctrine-reconcile.test.cjs`
- **After every plan wave:** Run `bash tests/run-all-269.sh`
- **Before `/gsd-verify-work`:** `node scripts/doctor.cjs --acceptance` green + `node scripts/build-connector-registry.cjs --check` exit 0
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 269-01-01 | 01 | 1 | MOAT-01 | — | decisions.md row 1 states install/update enforcement point, no query-time key language remains | unit (text assertion) | `node tests/269-doctrine-reconcile.test.cjs` | ❌ W0 | ⬜ pending |
| 269-01-02 | 01 | 1 | MOAT-02 | — | decisions.md row 5 preserves "remote by design, not optional by default" verbatim AND carries the per-query-keys-are-gone clause | unit (verbatim-substring check) | `node tests/269-doctrine-reconcile.test.cjs` | ❌ W0 | ⬜ pending |
| 269-01-03 | 01 | 1 | MOAT-03 | — | moat.md carries an explicit commercial-boundary clause naming install/update as the paid gate | unit (text assertion) | `node tests/269-doctrine-reconcile.test.cjs` | ❌ W0 | ⬜ pending |
| 269-01-04 | 01 | 1 | MOAT-04 | — | phase output records all four cross-cutting flags (BUSINESS-MODEL-AND-MOAT.md, personal-memory business-model note, LICENSE BSL grant (d), Gaurav RCA gap) | unit (presence assertion) | `node tests/269-doctrine-reconcile.test.cjs` | ✅ W0/01/03 | ✅ passed |
| 269-05-01 | 05 | 5 | MOAT-05 | T-269-14 | zero entitlement-check code ships this phase; `bin/cli.js`'s key-ceremony string is unmoved | unit (absence + verbatim-substring assertion) | `node tests/269-doctrine-reconcile.test.cjs` | ✅ W0 | ✅ passed (green from Wave 0 onward; re-asserted after every subsequent plan) |
| 269-04-01 | 04 | 4 | MOAT-06 | T-269-10, T-269-11, T-269-12 | navigator selects one of three credential models via `checkpoint:decision`; both unchosen options recorded with a losing reason; preconditions named explicitly | manual (`checkpoint:decision`, verified post-hoc by grep) | `grep -Fq 'Credential model DECIDED:' docs/AMENDMENT-2026-08-27-DECISIONS-1-AND-5-MOAT-SHIFT.md` | ❌ pending plan 04 | ⬜ pending (blocking human decision gate, not yet run) |
| — | all | — | C6 | — | no em-dashes introduced in any file this phase touches | lint | `LC_ALL=C.UTF-8 grep -lP '\x{2014}' <targets>` returns nothing (enforced by `tests/run-all-269.sh`'s own fence) | ✅ enforced live in aggregator | ✅ passed |
| — | all | — | — | — | CLAUDE.md still loads its four includes cleanly after edits | smoke | `node scripts/doctor.cjs --acceptance` | ✅ exists | ✅ passed (16/17; the one pre-existing failure is concurrent-session tracked-file drift, unrelated to this phase) |
| — | all | — | — | — | structural gates unaffected (no new invocable surface minted by the decision-recording plan) | structural | `node scripts/build-connector-registry.cjs --check` | ✅ exists | ✅ passed |

**No automated test is possible for the engineering family (entitlement-check code).** There is no
code to test yet — that family is deferred pending Theo's own Phase 9 timeline (currently two
unplanned phases away: Phase 9 blocked on Phase 8, Phase 8 blocked on Phase 7 which is
mid-execution). Its single plan verifies only that the human/navigator precondition
(`checkpoint:human-action`) was actually confirmed, not that code runs.

---

## Wave 0 Requirements

- [ ] `tests/run-all-269.sh` — the phase aggregator (pattern: `tests/run-all-266.sh`)
- [ ] `tests/269-doctrine-reconcile.test.cjs` — verbatim assertions on the reconciled decisions.md
      rows and moat.md clause, plus a preserved-substring check proving Decision #5's "remote by
      design, not optional by default" survived unchanged
- [ ] No framework install needed — plain Node, zero new dependencies

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Credential-model decision (replace / unify / promote install token) | MOAT-doctrine | Navigator judgment call, not a code assertion — research (RQ1) mapped three options but explicitly did not decide | Present the three options as a `checkpoint:decision` gate; record the chosen option's rationale in the phase's CONTEXT.md / decisions.md edit before the doctrine plan is considered done |
| Engineering-family readiness | — | Blocked on an external repo's (Theo) roadmap timeline, not on anything testable in this repo | Re-run `/gsd-plan-phase 269 --gaps` (or a fresh planning pass) once Theo's `.planning/ROADMAP.md` Phase 9 shows `Plans:` non-TBD; confirm via `grep -n "Plans:" ` against `/home/jsagi/Theo/.planning/ROADMAP.md` |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (confirmed after Waves 1-3 executed: every 269-01/02/03 task's `<verify><automated>` ran and passed; 269-04's decision task is verified post-hoc by grep per its own plan, and 269-05 has no automated test possible for the deferred engineering family by design, both noted as manual-only above)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (Waves 1-3 ran `node tests/269-doctrine-reconcile.test.cjs` and/or `bash tests/run-all-269.sh` after every task commit, confirmed live)
- [x] Wave 0 covers all MISSING references (`tests/269-doctrine-reconcile.test.cjs` and `tests/run-all-269.sh` both created and committed in Wave 1, RED as designed, later confirmed turning green through Waves 2-3)
- [x] No watch-mode flags (plain Node CJS + bash, no watchers anywhere in this phase's suite)
- [x] Feedback latency < 10s (confirmed live: `bash tests/run-all-269.sh` full run completes in well under 1 second of test time per its own `# duration_ms` output)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** Waves 1-3 (plans 01-03) verified complete 2026-08-27 -- `bash tests/run-all-269.sh` reports `Phase 269: PASS=5 FAIL=0 SKIP=0`, both Phase 250 regression legs green, connector registry check green, no-em-dash fence green. Plans 04 and 05 remain pending: both are `autonomous: false` with a leading blocking checkpoint (`checkpoint:decision` and `checkpoint:human-action` respectively) that this validation contract does not waive. Full phase approval is pending those two human gates.

---
phase: 269
slug: moat-shift-install-update-entitlement-gate-replaces-per-quer
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| 269-01-04 | 01 | 1 | MOAT-04 | — | phase output records all four cross-cutting flags (BUSINESS-MODEL-AND-MOAT.md, personal-memory business-model note, LICENSE BSL grant (d), Gaurav RCA gap) | unit (presence assertion) | `node tests/269-doctrine-reconcile.test.cjs` | ❌ W0 | ⬜ pending |
| — | all | — | C6 | — | no em-dashes introduced in any file this phase touches | lint | `grep -n "—" .claude/includes/*.md` returns nothing | ✅ grep, no file needed | ⬜ pending |
| — | all | — | — | — | CLAUDE.md still loads its four includes cleanly after edits | smoke | `node scripts/doctor.cjs --acceptance` | ✅ exists | ⬜ pending |
| — | all | — | — | — | structural gates unaffected (no new invocable surface minted by the decision-recording plan) | structural | `node scripts/build-connector-registry.cjs --check` | ✅ exists | ⬜ pending |

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

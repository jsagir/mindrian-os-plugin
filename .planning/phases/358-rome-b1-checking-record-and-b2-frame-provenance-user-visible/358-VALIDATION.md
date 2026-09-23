---
phase: 358
slug: rome-b1-checking-record-and-b2-frame-provenance-user-visible
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-23
---

# Phase 358 - Validation Strategy (B1 slice)

> Per-phase validation contract for feedback sampling during execution. Derived from 358-RESEARCH.md "Validation Architecture". B2 gets its own section when its plan set is written.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | plain node scripts with node:assert/strict and a pass/fail counter (repo convention), aggregated by bash |
| **Config file** | none |
| **Quick run command** | `node tests/test-358-b1-core.cjs` |
| **Full suite command** | `bash tests/run-all-358.sh` |
| **Estimated runtime** | ~60 seconds (full runner incl. CIRS --check gates); each single test file a few seconds |

---

## Sampling Rate

- **After every task commit:** run that task's own `tests/test-358-b1-*.cjs` plus `node tests/test-b1-verification.cjs`
- **After every plan wave:** `bash tests/run-all-358.sh` (includes build-connector-registry, build-orchestration-projection, check-render-coverage, check-shape-declaration, build-skill-mirrors, check-tool-honesty in --check mode, and an em-dash guard over B1-owned files)
- **Before `/gsd-verify-work`:** full runner green, then `node scripts/doctor.cjs --acceptance`
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 358-01-01 | 01 | 1 | B1-01, B1-04, B1-05, B1-06 | Part 8 | rung/method/result are local enums, no free text in graph | unit (RED) | `node tests/test-358-b1-core.cjs; node tests/test-358-b1-portrait.cjs; node tests/test-358-b1-separation.cjs` (expected to fail) | W0 | pending |
| 358-01-02 | 01 | 1 | B1-01, B1-04, B1-05, B1-06 | Part 9 | writes only via recordClaimVerification -> node-insert; review_status untouched | unit (GREEN) | `node tests/test-358-b1-core.cjs && node tests/test-358-b1-portrait.cjs && node tests/test-358-b1-separation.cjs && node tests/test-b1-verification.cjs` | W0 | pending |
| 358-02-01 | 02 | 1 | B1-03 | N/A | N/A | integration (RED) + runner | `bash -n tests/run-all-358.sh; node tests/test-358-b1-refile.cjs` (expected to fail) | W0 | pending |
| 358-02-02 | 02 | 1 | B1-03 | Part 9 | verification key carried forward, protected from extraProps | integration (GREEN) | `node tests/test-358-b1-refile.cjs` + claim-write regression set | W0 | pending |
| 358-02-03 | 02 | 1 | B1-02 | host gate | only the named Desktop client added; writes still land proposed | unit | `node tests/test-234-host-tier.cjs` | yes | pending |
| 358-03-01 | 03 | 2 | B1-02, B1-05 | N/A | N/A | CLI (RED) | `node tests/test-358-b1-cli.cjs` (expected to fail) | W0 | pending |
| 358-03-02 | 03 | 2 | B1-02, B1-04, B1-05 | Part 8 | CLI is a thin caller of core functions | CLI (GREEN) | `node scripts/claim-checks.cjs rungs && node tests/test-358-b1-cli.cjs` | W0 | pending |
| 358-03-03 | 03 | 2 | B1-07 | Part 11 | /mos:room subcommands born wired | gates | `node tests/test-358-b1-cli.cjs && node scripts/build-skill-mirrors.cjs --check && node scripts/build-connector-registry.cjs --check` | yes | pending |
| 358-04-01 | 04 | 3 | B1-02, B1-04 | N/A | N/A | integration (RED) | `node tests/test-358-b1-surfaces.cjs` (expected to fail) | W0 | pending |
| 358-04-02 | 04 | 3 | B1-02, B1-04, B1-05 | Part 8, honesty | claim_read read-only; descriptions honest, above floor | integration (GREEN) | `node tests/test-358-b1-surfaces.cjs && node tests/test-234-tool-description-floor.cjs && node scripts/check-tool-honesty.cjs --check` | W0 | pending |
| 358-04-03 | 04 | 3 | B1-03 | N/A | record survives separate processes and sessions | integration | `node tests/test-358-b1-persistence.cjs` | W0 | pending |
| 358-05-01 | 05 | 4 | B1-07 | Part 11 | registry regenerated fresh, committed alone | gates | `node scripts/build-connector-registry.cjs --check && node scripts/build-orchestration-projection.cjs --check && node tests/test-270-connector-coverage.cjs` | yes | pending |
| 358-05-02 | 05 | 4 | B1-07 | N/A | schema budget re-baselined, honesty sweep re-frozen | gates | `node tests/test-270-tool-schema-budget.cjs && node tests/test-276-tool-honesty-findings-closed.cjs && bash tests/run-all-358.sh` | yes | pending |
| 358-06-01 | 06 | 5 | B1-02..B1-06 | N/A | runbook matches acceptance tests and fallback wording | doc check | `test -f docs/2026-10-06-ROME-B1-GO-NO-GO.md` + content greps in plan | W0 | pending |
| 358-06-02 | 06 | 5 | B1-02 | N/A | live Desktop/Cowork client-name probe | manual | human checkpoint | n/a | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `tests/run-all-358.sh` - run/run_if legs; exit 77 = SKIPPED ENV GAP, never reported as PASSED; lists every B1 test file up front
- [ ] `tests/helpers/b1-358-child.cjs` - cross-process child for B1-03
- [ ] `tests/test-358-b1-core.cjs`, `test-358-b1-portrait.cjs`, `test-358-b1-separation.cjs`, `test-358-b1-refile.cjs`, `test-358-b1-cli.cjs`, `test-358-b1-surfaces.cjs`, `test-358-b1-persistence.cjs` - RED first
- No framework install needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Record a check hands-on in real Claude Desktop | B1-02 (AT1) | host UI not available in WSL CI | Follow docs/2026-10-06-ROME-B1-GO-NO-GO.md Desktop section on a demo machine after the release cut |
| Cowork client name and write path | B1-02 (AT1) | Cowork client name unknown; needs a live session | Run the client-name probe in the runbook; add the name only after it is confirmed |
| Released build installed on demo machines | all | a main commit is not live until released and picked up | Release cut, then `claude plugin update`, then rerun AT1-AT4 on the demo machine |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (manual only for the live host probes)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-09-23

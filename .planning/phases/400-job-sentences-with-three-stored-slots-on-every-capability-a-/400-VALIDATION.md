---
phase: 400
slug: job-sentences-with-three-stored-slots-on-every-capability-a
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-11-24
---

# Phase 400 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | plain Node assert scripts (tests/test-*.cjs) with phase runners tests/run-all-<phase>.sh |
| **Config file** | none |
| **Quick run command** | `node tests/test-400-<area>.cjs` (the file named in the task verify block) |
| **Full suite command** | `bash tests/run-all-400.sh` (runs every phase-400 test, the phase drift checks, then `bash tests/run-all-399.sh`) |
| **Estimated runtime** | about 120 seconds for the full suite (npm pack dry run and the 399 runner are the slow parts) |

---

## Sampling Rate

- **After every task commit:** run the task's own verify command (the touched test-400 file plus its named 399 neighbour).
- **After every plan:** run `bash tests/run-all-400.sh`.
- **Before verification of the phase:** the full suite, every generator `--check`, `node scripts/check-substrate.cjs`, `node scripts/check-shape-declaration.cjs`, `node scripts/doctor.cjs --acceptance` (plan 15 records the gate table).
- **Max feedback latency:** 60 seconds for a task verify command.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 400-01-01 | 01 | 1 | JS-05, JS-06, PG-01 | T-400-02 | description bytes never grow | unit + budget | `node tests/test-400-job-sentence-lib.cjs && node tests/test-400-description-budget.cjs` | W0 creates | pending |
| 400-01-02 | 01 | 1 | JS-01 | T-400-03 | summary and catalog unchanged | unit | `node tests/test-400-job-vocabulary-sentences.cjs && node tests/test-399-job-vocabulary.cjs` | W0 creates | pending |
| 400-01-03 | 01 | 1 | JS-06 | T-400-01 | bad slots refused, batch atomic | unit + drift | `node tests/test-400-job-sentence-lib.cjs && node scripts/apply-job-sentences.cjs --check` | W0 creates | pending |
| 400-02-01 | 02 | 2 | JS-02 | T-400-04 | writes only through the validated writer | drift | `node scripts/apply-job-sentences.cjs --check && node scripts/build-skill-mirrors.cjs --check` | yes after 01 | pending |
| 400-02-02 | 02 | 2 | JS-02 | T-400-04 | 73 run-step sentences in frontmatter, registry, mirrors | unit + drift | `node tests/test-400-job-sentences.cjs` | W0 creates | pending |
| 400-03-01 | 03 | 3 | JS-03 | T-400-07 | descriptions unchanged | drift | `node scripts/apply-job-sentences.cjs --check && node tests/test-400-description-budget.cjs` | yes | pending |
| 400-03-02 | 03 | 3 | JS-03 | T-400-06 | agent files change by 4 lines only | unit | `node tests/test-400-job-sentences.cjs && node scripts/build-connector-registry.cjs --check` | yes | pending |
| 400-04-01 | 04 | 4 | JS-04 | T-400-08 | MCP key set bound to the connector registry | unit | `node tests/test-400-job-sentences.cjs` | yes | pending |
| 400-04-02 | 04 | 4 | JS-06 | T-400-08 | full coverage, mutation control | drift | `node tests/test-400-job-sentences.cjs && bash tests/run-all-400.sh` | yes | pending |
| 400-05-01 | 05 | 5 | CY-01 | T-400-12 | weak source never the shown domain; 399 shapes pinned | unit | `node tests/test-400-cause-effect-axis.cjs && node tests/test-399-problem-axes.cjs` | W0 creates | pending |
| 400-05-02 | 05 | 5 | CY-02 | T-400-10, T-400-11 | hashes only, book read only | drift | `node tests/test-400-cynefin-domains.cjs` | W0 creates | pending |
| 400-06-01 | 06 | 6 | CY-04 | T-400-13 | no probability or research text written | unit | `node tests/test-400-capability-cynefin-labels.cjs` | W0 creates | pending |
| 400-06-02 | 06 | 6 | CY-04 | T-400-14 | labels bound to the 73 and closed sets | drift | `node tests/test-400-capability-cynefin-labels.cjs && node scripts/derive-cynefin-labels.cjs --check` | yes | pending |
| 400-07-01 | 07 | 7 | CY-06 | T-400-15, T-400-16 | refuse never strip; 399 renders byte-identical | unit | `node tests/test-400-labels-only-domain.cjs && node tests/test-399-adapter.cjs && node tests/test-399-advisor-fence.cjs` | W0 creates | pending |
| 400-07-02 | 07 | 7 | RL-03 | T-400-17 | one fingerprint for both ends | unit | `node tests/test-400-labels-only-domain.cjs` | yes | pending |
| 400-08-01 | 08 | 8 | CY-03 | T-400-19, T-400-20 | one writer, closed set, not in the Brain packet | unit + gate | `node tests/test-400-domain-store.cjs && node scripts/check-substrate.cjs` | W0 creates | pending |
| 400-08-02 | 08 | 8 | CY-03 | T-400-18 | fixed options and labels on 3 rungs, at most 4 options | integration | `node tests/test-400-domain-gate.cjs && node tests/test-345-gate-ratify.cjs` | W0 creates | pending |
| 400-08-03 | 08 | 8 | CY-03 | T-400-20 | no numbers, never guess the domain | integration | `node tests/test-400-domain-suggest-next.cjs` | W0 creates | pending |
| 400-09-01 | 09 | 9 | CY-05 | T-400-22, T-400-24 | unknown domain equals 399; fence FN1 | unit | `node tests/test-400-advisor-domain.cjs && node tests/test-399-table.cjs && node tests/test-399-advisor-fence.cjs` | W0 creates | pending |
| 400-09-02 | 09 | 9 | CY-05 | T-400-23 | no raw number leaves present.cjs | unit | `node tests/test-400-advisor-domain.cjs && node tests/test-399-selector-advisor.cjs` | yes | pending |
| 400-10-01 | 10 | 10 | CY-05 | T-400-25, T-400-27 | no second selector; read only with the advisor on | integration | `node tests/test-400-advisor-consumers.cjs && node tests/test-399-one-selector-fence.cjs` | W0 creates | pending |
| 400-10-02 | 10 | 10 | CY-07 | T-400-26 | closed label column, registered | unit | `node tests/test-400-selection-domain.cjs && node tests/test-399-selection-log.cjs` | W0 creates | pending |
| 400-11-01 | 11 | 11 | AX-01 | T-400-29 | default wording and table cells unchanged | unit | `node tests/test-400-problem-axes-wording.cjs && node tests/test-399-problem-axes.cjs` | W0 creates | pending |
| 400-11-02 | 11 | 11 | AX-02 | T-400-28, T-400-30 | never a raw 0.5 cut; no case text written | unit + drift | `node tests/test-400-problem-axes-wording.cjs && node scripts/derive-wicked-cutoff.cjs --check` | yes | pending |
| 400-12-01 | 12 | 12 | RL-02 | T-400-31, T-400-32, T-400-36 | O-09 callers and caps | unit | `node tests/test-400-relay.cjs` | W0 creates | pending |
| 400-12-02 | 12 | 12 | RL-01, RL-03 | T-400-33, T-400-34, T-400-35 | shared validator, pinned upstream, no redirect, clean logs | integration (loopback) | `node tests/test-400-relay.cjs && node tests/test-399-advisor-fence.cjs` | yes | pending |
| 400-13-01 | 13 | 13 | RL-04 | T-400-37, T-400-38, T-400-39 | body cap, timeouts, liveness-only health | integration (loopback) | `node tests/test-400-relay-server.cjs` | W0 creates | pending |
| 400-13-02 | 13 | 13 | RL-04 | T-400-40, T-400-41, T-400-42 | no rootDir, no secret values, not shipped | static | `node tests/test-400-relay-packaging.cjs` | W0 creates | pending |
| 400-14-01 | 14 | 14 | RL-05, RL-03 | T-400-46, T-400-47, T-400-48 | line off means zero fetch; skew refused; fence | integration (loopback) | `node tests/test-400-relay-transport.cjs && node tests/test-400-relay-fence.cjs && node tests/test-399-transport-capture.cjs` | W0 creates | pending |
| 400-14-02 | 14 | 14 | RL-05 | T-400-43, T-400-44, T-400-45 | O-10 flag plus token, printed body, audit, token never shown | integration | `node tests/test-400-relay-transport.cjs` | yes | pending |
| 400-14-03 | 14 | 14 | RL-05 | T-400-45 | release run feeds the 399 fixture pipeline on loopback | integration (loopback) | `node tests/test-400-relay-transport.cjs && node tests/test-400-relay-server.cjs` | yes | pending |
| 400-15-01 | 15 | 15 | LR-01 | T-400-49 | ids and counts only | drift | `node tests/test-400-review-lists.cjs` | W0 creates | pending |
| 400-15-02 | 15 | 15 | PG-01 | T-400-50 | every gate recorded against the base | suite | `bash tests/run-all-400.sh && node scripts/check-substrate.cjs && node scripts/doctor.cjs --acceptance` | yes | pending |

Status values: pending, green, red, flaky.

---

## Wave 0 Requirements

Each plan creates its own test file in its first task (test first, confirmed failing, then the code):

- [ ] `tests/run-all-400.sh` (plan 01)
- [ ] `tests/test-400-job-sentence-lib.cjs`, `tests/test-400-description-budget.cjs`, `tests/fixtures/400/description-bytes-baseline.json`, `tests/test-400-job-vocabulary-sentences.cjs` (plan 01)
- [ ] `tests/test-400-job-sentences.cjs` (plan 02, grown by plans 03 and 04)
- [ ] `tests/test-400-cause-effect-axis.cjs`, `tests/test-400-cynefin-domains.cjs` (plan 05)
- [ ] `tests/test-400-capability-cynefin-labels.cjs` (plan 06)
- [ ] `tests/test-400-labels-only-domain.cjs`, `tests/fixtures/400/render-399-sample.json` (plan 07)
- [ ] `tests/test-400-domain-store.cjs`, `tests/test-400-domain-gate.cjs`, `tests/test-400-domain-suggest-next.cjs` (plan 08)
- [ ] `tests/test-400-advisor-domain.cjs`, `tests/fixtures/400/domain-table.json` (plan 09)
- [ ] `tests/test-400-advisor-consumers.cjs`, `tests/test-400-selection-domain.cjs` (plan 10)
- [ ] `tests/test-400-problem-axes-wording.cjs`, `tests/fixtures/400/wicked-fit-sample.json` (plan 11)
- [ ] `tests/test-400-relay.cjs` (plan 12)
- [ ] `tests/test-400-relay-server.cjs`, `tests/test-400-relay-packaging.cjs` (plan 13)
- [ ] `tests/test-400-relay-transport.cjs`, `tests/test-400-relay-fence.cjs` (plan 14)
- [ ] `tests/test-400-review-lists.cjs` (plan 15)

Fixtures hold derived or synthetic data only; no research case text, no probability from a research file, no book text.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Card wording and host notes match the owner's intent (O-03 confirm at plan time) | CY-02, CY-03 | owner ruling | Owner reads 400-LABEL-REVIEW.md section 8 and confirms or rewords; a rewording is a data edit in data/cynefin-domains.json plus a re-run of tests/test-400-cynefin-domains.cjs |
| The cause_effect_domain card looks right in a live Claude Code session | CY-03 | visual result needs a real host | Bind a scratch room, call suggest_next, follow cause_effect.how_to, inspect the card on screen (screenshot), answer it, confirm suggest_next shows state set |
| Wicked cut-off fitted on real labels | AX-02 | label files are not on this machine | Copy the two label files from the research machine, run `node scripts/derive-wicked-cutoff.cjs --answers <file> --labels <file> --labels <file> --write`, re-run the suite |
| Relay deploy, key, operator token, paid tier, Render plan, user traffic | RL-04, RL-05 | OWNER-GATED by CONTEXT S4 | Follow services/decision-relay/README.md; no executor performs these steps |
| Provisional sentences and labels | JS-01 to JS-04, CY-04 | owner ruling (S5) | Owner reviews 400-LABEL-REVIEW.md |

---

## Validation Sign-Off

- [x] All tasks have an automated verify command
- [x] Sampling continuity: no 3 consecutive tasks without an automated verify
- [x] Wave 0 covers every new test file (each plan's first task)
- [x] No watch-mode flags
- [x] Feedback latency under 60 seconds per task verify
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

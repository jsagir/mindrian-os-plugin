---
phase: 366
slug: eureka-perspective-in-research-planner-mcp-canvas-tooling
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-01
---

# Phase 366 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from the
> "## Validation Architecture" section of 366-RESEARCH.md; the planner fills the per-task map.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node test files (`tests/test-*.cjs`, PASS/FAIL counters, exit 77 = ENV GAP) run by a per-phase bash aggregator; no jest / vitest |
| **Config file** | none; `tests/helpers/hygiene-355.cjs` (key scrub, net guard, checker) is the shared preamble |
| **Quick run command** | `node tests/test-seed103-eureka-perspective.cjs` (node >= 22; on the WSL dev machine: `export PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH` first) |
| **Full suite command** | `bash tests/run-all-seed103.sh && bash tests/run-all-366.sh` (run-all-366.sh is written once in Wave 0) |
| **Estimated runtime** | ~90 seconds for run-all-seed103.sh (20 legs); run-all-366.sh measured at Wave 0 |

Node >= 22.16 with `node:sqlite` is mandatory; `/usr/bin/node` on the WSL machine is v20 and must never run a test or a hook.

---

## Sampling Rate

- **After every task commit:** Run the quick run command plus the test file the task names
- **After every plan wave:** Run the full suite command, then `node scripts/build-connector-registry.cjs --check`, `node scripts/build-orchestration-projection.cjs --check`, `node scripts/check-shape-declaration.cjs --check`, `node scripts/build-skill-mirrors.cjs --check`
- **Before `/gsd:verify-work`:** Full suite must be green; the pins (`test-270-tool-schema-budget`, `test-234-tool-description-floor`, `test-205-surface-fence`, `test-353-tripwires`, `test-363-*`) must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 366-01-T1 | 01 | 1 | EPV366-01 | T-366-04 | seed103 legs carried; dash fence | aggregator | `bash tests/run-all-366.sh` | no (W0) | pending |
| 366-01-T2 | 01 | 1 | EPV366-23 | T-366-03 | planted fixture, zero sockets | unit (nodes before edges; edge_rows_missing_endpoint 0) | `node tests/test-366-fixture-helper.cjs` | no (W0) | pending |
| 366-01-T3 | 01 | 1 | EPV366-23 | T-366-01/02/03 | temp-root containment; source fixtures untouched | unit | `node tests/test-366-spike-prepare.cjs` | no (W0) | pending |
| 366-02-T1 | 02 | 2 | EPV366-12 | T-366-06 | closed pair carry | unit | `node tests/test-366-eureka-filing.cjs (F1-F3); node tests/test-363-pyramid.cjs` | no | pending |
| 366-02-T2 | 02 | 2 | EPV366-12 | T-366-05/07/08 | single-use approval; no Theo at filing | integration | `node tests/test-366-eureka-filing.cjs (F4-F9); bash tests/run-all-363.sh` | no | pending |
| 366-03-T1 | 03 | 2 | EPV366-13 | T-366-11/12 | argv JSON-only; registries by script | static | `node scripts/build-skill-mirrors.cjs --check; node scripts/check-registry-drift.cjs` | yes | pending |
| 366-03-T2 | 03 | 2 | EPV366-13 | T-366-09/10 | all-pairs only behind legacy:true | unit | `node tests/test-366-eureka-alias.cjs; node tests/test-205-surface-fence.cjs` | no | pending |
| 366-04-T1 | 04 | 3 | EPV366-05/06/08/09 | T-366-13/14/15 | frozen families only; pins and ledger by script in the same commit | unit + static | `node tests/test-366-templates.cjs; node scripts/build-research-shape-ledger.cjs --check; node tests/test-363-pyramid.cjs; node tests/test-363-structure.cjs` | no | pending |
| 366-04-T2 | 04 | 3 | EPV366-05/06/08/09 | T-366-15 | no further template-count pin left | aggregator | `bash tests/run-all-363.sh; node tests/test-seed103-eureka-perspective.cjs` | yes | pending |
| 366-05-T1 | 05 | 2 | EPV366-15/19 | T-366-16/17 | ratified-only, contained translation table | unit | `node tests/test-366-canon-handles.cjs (C1-C7)` | no | pending |
| 366-05-T2 | 05 | 2 | EPV366-16 | T-366-18/19 | node before edge, idempotent | unit | `node tests/test-366-canon-handles.cjs (C8-C12); node scripts/check-substrate.cjs --diff` | no | pending |
| 366-06-T1 | 06 | 2 | EPV366-21 | T-366-22/23 | offline lagging gate | unit (shell seam) | `node tests/test-366-snapshot-gate.cjs` | no | pending |
| 366-06-T2 | 06 | 2 | EPV366-01/21 | T-366-21/24 | audited opt-outs; no recursion | unit (shell seam) | `node tests/test-366-suite-gate.cjs; node tests/test-349-docs-lockstep.cjs` | no | pending |
| 366-07-T1 | 07 | 3 | EPV366-14 | T-366-27/28 | offer-only, ids only | unit | `node tests/test-366-ambient-offer.cjs (O1-O6); bash tests/run-all-3551.sh` | no | pending |
| 366-07-T2 | 07 | 3 | EPV366-14 | T-366-26/29/30 | never a fetch with a grant | unit | `node tests/test-366-ambient-offer.cjs (O7-O11)` | no | pending |
| 366-08-T1 | 08 | 3 | EPV366-02 | T-366-31 | frozen registry | unit | `node tests/test-366-perspective-interface.cjs (P1-P5)` | no | pending |
| 366-08-T2 | 08 | 3 | EPV366-02/15/16 | T-366-32/33 | one resolver; read-only recall | unit | `node tests/test-366-perspective-interface.cjs (P6-P10); bash tests/run-all-seed103.sh` | no | pending |
| 366-09-T1 | 09 | 3 | EPV366-15/16 | T-366-34/35 | exact match; bookkeeping never blocks | integration | `node tests/test-366-canon-at-filing.cjs (K1-K5)` | no | pending |
| 366-09-T2 | 09 | 3 | EPV366-15/16 | T-366-36 | indexer idempotent | integration | `node tests/test-366-canon-at-filing.cjs (K6-K9)` | no | pending |
| 366-10-T1 | 10 | 3 | EPV366-17 | T-366-40 | counts only, null on unreadable | unit | `node tests/test-366-canon-coverage-count.cjs; bash tests/run-all-343.sh` | no | pending |
| 366-10-T2 | 10 | 3 | EPV366-20 | T-366-38/39/41 | per-room soft fail; dryRun writes nothing | unit | `node tests/test-366-canon-backfill.cjs; node tests/test-doctor-module-contract-parity.cjs` | no | pending |
| 366-11-T1 | 11 | 6 | EPV366-18 | T-366-43 | one receipt-bound allow after the content scan | unit (adversarial) | `node tests/test-366-guard-navigator-release.cjs` | no | pending |
| 366-11-T2 | 11 | 6 | EPV366-18/19 | T-366-44/45/46/47 | no call without a yes; closed audit row | unit (injected callTool) | `node tests/test-366-gated-term-release.cjs` | no | pending |
| 366-11-T3 | 11 | 6 | EPV366-18 | T-366-43 | live round trip approved | manual + replay | `MOS_366_LIVE=1 scratch room; then node tests/test-366-gated-term-release.cjs` | manual | pending |
| 366-12-T1 | 12 | 4 | EPV366-03 | T-366-49/50/52/53 | zod enum; aliases deprecated | integration | `node tests/test-366-mcp-perspective-ops.cjs; node tests/test-270-tool-schema-budget.cjs; node tests/test-234-tool-description-floor.cjs` | no | pending |
| 366-12-T2 | 12 | 4 | EPV366-04 | T-366-49/51 | no free text on argv | unit | `node tests/test-366-cli-perspective.cjs` | no | pending |
| 366-13-T1 | 13 | 4 | EPV366-05 | T-366-54/55/56 | offline, capped | unit | `node tests/test-366-recall-rs.cjs` | no | pending |
| 366-13-T2 | 13 | 4 | EPV366-06 | T-366-57 | one classifier home | unit | `node tests/test-366-recall-hsi.cjs; node tests/test-355-direction-agreement.cjs` | no | pending |
| 366-14-T1 | 14 | 4 | EPV366-07 | T-366-60 | offline, capped; no duplicate basket candidate (W7) | unit | `node tests/test-366-recall-whitespace.cjs` | no | pending |
| 366-14-T2 | 14 | 4 | EPV366-08 | T-366-58/59 | SAPPhIRE filled on host only | unit | `node tests/test-366-recall-analogies.cjs` | no | pending |
| 366-15-T1 | 15 | 4 | EPV366-09 | T-366-65 | no network in recall | unit | `node tests/test-366-recall-connections.cjs` | no | pending |
| 366-15-T2 | 15 | 4 | EPV366-09 | T-366-61/62/63/64 | canon names only, under a grant, audited | unit (injected callTool) | `node tests/test-366-theo-lateral-lane.cjs; bash tests/run-all-363.sh` | no | pending |
| 366-16-T1 | 16 | 5 | EPV366-11 | T-366-66/69 | honest stubs; 65 pin | unit | `node tests/test-366-router-redirects.cjs; node tests/test-205-surface-fence.cjs` | no | pending |
| 366-16-T2 | 16 | 5 | EPV366-10/26 | T-366-67 | zero sockets across six; valid plan and basket candidate for all six (Z4) | unit | `node tests/test-366-offline-recall.cjs; node tests/test-366-counter-metrics.cjs` | no | pending |
| 366-16-T3 | 16 | 5 | EPV366-27 | T-366-68 | every floor on the ledger | static | `node scripts/check-floor-ledger.cjs; node tests/test-355-floor-sweep.cjs` | yes | pending |
| 366-17-T1 | 17 | 5 | EPV366-22 | T-366-70/71/72/74 | override can only turn lines off | unit | `node tests/test-366-egress-policy.cjs (E1-E6, E4b provider sweep)` | no | pending |
| 366-17-T2 | 17 | 5 | EPV366-22 | T-366-73 | --offline completes | unit | `node tests/test-366-egress-policy.cjs (E7-E10)` | no | pending |
| 366-18-T1 | 18 | 5 | EPV366-23 | T-366-77 | bar committed before the run | static | `node -e (bar minimums vs wilson95)` | no | pending |
| 366-18-T2 | 18 | 5 | EPV366-23 | T-366-75/76/78/79 | Jev only on contained fixture copies | unit | `node tests/test-366-spike-harness.cjs; node tests/test-353-tripwires.cjs` | no | pending |
| 366-19-T1 | 19 | 6 | EPV366-23 | T-366-80/82/83 | synthetic fixtures only | run | `node scripts/spike-366.cjs recall/items/judge (manifest)` | no | pending |
| 366-19-T2 | 19 | 6 | EPV366-23 | T-366-81 | blind seeded labels | manual | `node scripts/label-355-gold.cjs start --set pairings-unstamped --items ...` | manual | pending |
| 366-20-T1 | 20 | 7 | EPV366-23/24/27 | T-366-85 | record recomputes byte for byte | static | `node scripts/spike-366.cjs --check; node scripts/check-floor-ledger.cjs` | no | pending |
| 366-20-T2 | 20 | 7 | EPV366-30 | T-366-84/86 | no automatic adoption | manual (decision) | `366-SPIKE-RULINGS.md has all six rulings` | manual | pending |
| 366-21-T1 | 21 | 8 | EPV366-25 | T-366-87 | `runner: retire` ruling asserted; inventory decided and sliced; static retirement gate (RED) | static | `grep -qE "^runner: *retire" 366-SPIKE-RULINGS.md; node tests/test-366-runner-retired.cjs (expected RED)` | no | pending |
| 366-21-T2 | 21 | 8 | EPV366-25 | T-366-88/89 | slice A (215/216/226) off the runner; aggregators green | aggregator | `bash tests/run-all-215/216/226/363.1/seed103.sh` | yes | pending |
| 366-25-T1 | 25 | 9 | EPV366-25 | T-366-100/101 | slice B (218/219/223/343) off the runner; aggregators green | aggregator | `bash tests/run-all-218/219/223/343.sh` | yes | pending |
| 366-25-T2 | 25 | 9 | EPV366-25 | T-366-100/101/102 | slice C (355/3551) off the runner; 355 record kept | aggregator | `bash tests/run-all-355/3551/seed103.sh` | yes | pending |
| 366-26-T1 | 26 | 9 | EPV366-25 | T-366-103/104 | slice D part 1 (341/363.1) off the runner | aggregator | `bash tests/run-all-341/363.1.sh` | yes | pending |
| 366-26-T2 | 26 | 9 | EPV366-25 | T-366-105 | inventory closed: only phase-366 tests name the runner | static | `node tests/test-eureka-mcp-tools.cjs; grep -rlE "eureka-command\|eureka-portfolio-report" tests (only tests/test-366-*)` | yes | pending |
| 366-22-T1 | 22 | 10 | EPV366-25 | T-366-90/93 | deletion only after the `runner: retire` ruling; no legacy path; registries by script | static | `grep -qE "^runner: *retire" 366-SPIKE-RULINGS.md; node scripts/build-skill-mirrors.cjs --check; node tests/test-205-surface-fence.cjs; node tests/test-366-eureka-alias.cjs` | yes | pending |
| 366-22-T2 | 22 | 10 | EPV366-25 | T-366-91/92 | no dangling requires | static | `node tests/test-366-runner-retired.cjs; bash tests/run-all-366.sh` | no | pending |
| 366-23-T1 | 23 | 11 | EPV366-29 | T-366-96 | integrity gate green before move | unit | `node tests/test-366-semantic-index-integrity.cjs` | no | pending |
| 366-23-T2 | 23 | 11 | EPV366-29 | T-366-94/95 | move map and batched codemod, dry run only | static | `366-23-codemod.cjs --batch N --dry-run (every batch); git diff --quiet -- lib scripts hooks bin tests` | no | pending |
| 366-23-T3 | 23 | 11 | EPV366-29 | T-366-94/95 | integrity gate green after every batch and after the move | static + aggregator | `node scripts/check-require-integrity.cjs; bash tests/run-all-366.sh` | no | pending |
| 366-24-T1 | 24 | 12 | all EPV366 | T-366-97 | proof per row | aggregator | `bash tests/run-all-366.sh` | yes | pending |
| 366-24-T2 | 24 | 12 | EPV366-28 | T-366-98 | policy changes only on a ruling | unit | `node tests/test-366-egress-policy.cjs; node scripts/check-registry-drift.cjs` | yes | pending |
| 366-24-T3 | 24 | 12 | EPV366-30 | T-366-99 | Theo request carries no room content; research mirror in three homes, cross-linked | static | `test -f 366-HANDOFF.md; research entry in ~/MindrianRooms/rethinking-mindrianos/research, ~/MindrianOS/research, .planning/research; LC_ALL=C dash fence` | no | pending |

Expected RED (documented): from plan 366-21 (wave 8) until plan 366-22 (wave 10) lands,
`bash tests/run-all-366.sh` fails on exactly one leg, `test-366-runner-retired.cjs` (RR1/RR2 while
the runner files exist). The wave-8 and wave-9 gates accept that one leg and nothing else; from
wave 10 the aggregator must end FAILED=0.

Dash fence idiom: every em-dash / en-dash fence in this phase runs `LC_ALL=C grep -P` (under a UTF-8
locale the byte escapes can match nothing and the fence passes vacuously).

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/run-all-366.sh` - the phase aggregator, written once, run / run_if legs per planned test file
- [ ] `tests/test-366-*.cjs` - one hermetic file per plan, each with the hygiene-355 preamble and an isolated `MINDRIAN_ROOMS_HOME` set before any repo module loads
- [ ] fixture-room copies of `tests/fixtures/355-rooms/` with `room.db` built and entity extraction run (the spike's substrate; the research found Eureka was `substrate_unavailable` on the bare fixtures)
- [ ] existing infrastructure covers model routing (`test-seed103-claude-routing.cjs`) and the eureka perspective (`test-seed103-eureka-perspective.cjs`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Blind gold labeling of the spike candidate files | the spike (D-05) | The navigator is the labeler by ruling | `node scripts/label-355-gold.cjs start` on each arm's candidate file, one sitting per arm, seeded shuffle; the record is computed by `measure-355-hit-rate.cjs --check` |
| The gated per-term Theo release | D-13 | An F.8 card needs a human yes | Trigger a miss, answer the card, confirm the audit ledger row and the proposed translation entry |
| Live Theo `normalize_framework_name` round trip | D-13 (c) | Network, vendor | One run with `MOS_366_LIVE=1`, recorded and replayed offline afterwards |

---
phase: 251
slug: cache-aware-trigger-redesign
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-10
---

# Phase 251 - Validation Strategy

> Source: 251-CACHE-MEASUREMENT.md (the measured verdict) + ROADMAP Phase 251 RESCOPED
> success criteria. CACHE-01 is DONE (criterion 1). This file validates the hygiene pass
> (criterion 2) and the budget + live baseline (criterion 3). Cross-phase gate: execution
> starts only after Phase 250's 250-01 (HONEST-01) lands - the rail must carry the honest
> reach.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test CJS (`node --test tests/test-251-*.cjs`) + bash aggregator `tests/run-all-251.sh` (run-all-250.sh mechanism: glob discovery, found-eq-0 guard, em-dash fence) |
| **Config file** | none (zero-npm-deps hard convention; no installs this phase) |
| **Quick run command** | `node --test tests/test-251-<name>.cjs` |
| **Full suite command** | `bash tests/run-all-251.sh` |
| **Estimated runtime** | ~15s (all fixture-driven; no network, no Brain) |

## Sampling Rate

- **Per task commit:** the task's own test file via `node --test` (< 5s), RED output recorded BEFORE implementation (a test that cannot fail is not evidence)
- **Per plan merge:** `bash tests/run-all-251.sh` plus the named regression suites (`run-all-209.sh`, `run-all-210.sh`, `test-148-frozen-contracts.cjs`, `test-gate-native-fire-w1.cjs` for plan 01)
- **Phase gate:** full 251 runner green + the checkpoint report pasted with hit_rate >= 0.91 before `/gsd-verify-work`

## Per-Task Verification Map

| Req item | Plan-Task | Behavior | Test | Red proof |
|----------|-----------|----------|------|-----------|
| CACHE-02(a) suppress-when-unchanged | 01-1 | identical block -> NAV_UNCHANGED_MARKER; changed -> full re-emit; corrupt sidecar fails OPEN; suppressed turn records zero reached-gates (Stop-gate/SEED-021 consistency); post-compact resets sidecar | `node --test tests/test-251-suppress-unchanged.cjs` | marker const + sidecar helpers absent; sidechannel records 2 |
| CACHE-02(b) skeleton-to-SessionStart | 01-2 | FIRE-IF-FORK imperative absent from per-turn block, present once (sub-900 B) in scripts/session-start; frozen marker stays per-turn; dispatcher + emitBindingGate surfaces byte-untouched | `node --test tests/test-251-skeleton-split.cjs` + re-pointed `tests/test-209-engine-arm-contract.cjs` | binding still in block; doctrine absent from session-start |
| CACHE-02(c) payload dedup | 01-3 | payload carries shape/mode/verb_count/recommended, no verbs array; recommended-only exception; persisted f1_closer_payload untouched | `node --test tests/test-251-payload-dedup.cjs` | verbs array present, ~300 B duplication measured in RED |
| CACHE-02 byte evidence (criterion 2) | 01-1/2/3 | before/after byte counts recorded PER ITEM (RED run measures before on the same fixture; GREEN measures after) | byte prints in each test + SUMMARY table | before-bytes captured in each RED output |
| CACHE-02 doctrine leg | 02-1 | docs/HOOK-INJECTION-CACHE-DOCTRINE.md content fence: mechanism, refuted hypothesis, three levers, do-not list, honest limits; zero em-dashes | `node --test tests/test-251-block-budget.cjs` (Test 3) | doc absent |
| CACHE-03 budget | 02-1 | NAV_BLOCK_BUDGET_BYTES exported, <= 1200, fixture block fits with Brain-reach headroom, CACHE-03 rider comment adjacent | `node --test tests/test-251-block-budget.cjs` (Tests 1/2/4) | constant absent |
| CACHE-03 analyzer | 02-2 | hit rate, requestId dedup, zero-cache-read count, NAV dup + suppressed-marker counts from a synthetic fixture; aggregates only (no content leak) | `node --test tests/test-251-hitrate-report.cjs` | script absent |
| CACHE-03 live baseline (criterion 3) | 02-3 | live session on a VERIFIED-live build holds hit_rate >= 0.91 with suppression observed | checkpoint:human-verify (manual, below) | n/a (checkpoint) |

## Wave 0 Requirements

- [ ] `tests/run-all-251.sh` (run-all-250.sh clone) - authored FIRST inside plan 01 task 1
- [ ] Every 251 test file born RED with its RED output recorded in the plan SUMMARY
- [ ] `tests/fixtures/cache-hitrate-fixture.jsonl` fully synthetic (never copied from a real transcript - Part 8 discipline)
- [ ] No framework install (node:test built-in only)

## Contract-Preservation Fences (must stay green UNMODIFIED)

| Fence | Why |
|-------|-----|
| `tests/test-148-frozen-contracts.cjs` | SEED-020 single-door AskUserQuestion construction unchanged |
| `tests/test-gate-native-fire-w1.cjs` | native card-fire path unchanged |
| dispatcher-level assertions in run-all-209/210 | appendAskUserQuestionTrailer still mints marker + binding + footer for non-injection consumers |
| emitBindingGate assertion (test-209 ~L208) | the room-bind gate surface keeps its inline FIRE-IF-FORK - out of hygiene scope |

The ONLY sanctioned test edits are the three cited assertion re-points inside
tests/test-209-engine-arm-contract.cjs (binding absent from per-turn block x2, payload
verbs -> verb_count), each carrying a "251-01" citation in its assertion message. Any
other red test means the edit went too deep: revert and re-scope.

## Manual-Only Verifications

| Behavior | Req | Why manual | Instructions |
|----------|-----|------------|--------------|
| Live cache-read rate >= 91% baseline + suppression observed in the wild | CACHE-03 / criterion 3 | needs a real working session and a genuinely picked-up build; a repo commit is NOT live until released and loaded (stale-plugin-cache debug file) | Plan 02 Task 3 checkpoint: staleness-grep the RUNNING plugin root for "NAV DECISION unchanged" FIRST, then a 10+ turn session with 3+ idle turns, then `node scripts/cache-hitrate-report.cjs <session>.jsonl`, paste the report |
| First post-compact turn re-emits the full block | CACHE-02(a) edge | compaction cannot be scripted deterministically in the suite | during the same live session, trigger /compact (or observe an auto-compact), confirm the next NAV block is full, not the marker |

## Validation Sign-Off

- [ ] All auto tasks have `<automated>` verify; RED recorded before every GREEN
- [ ] Per-item before/after byte table in 251-01-SUMMARY.md (criterion 2)
- [ ] Budget value + headroom math in 251-02-SUMMARY.md (criterion 3, fence half)
- [ ] Checkpoint report pasted with hit_rate >= 0.91 (criterion 3, live half)
- [ ] Contract-preservation fences green unmodified

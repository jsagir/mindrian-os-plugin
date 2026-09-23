---
phase: 356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-
plan: 11
subsystem: jev-live-build
tags: [human-checkpoint, sitting-3, live-build, jev, vendor-call, d-14, d-15]

requires:
  - phase: 356-10
    provides: "scripts/build-command-irreversibility-ledger.cjs's full CLI (live, --jev-fixture, --from-raw, --raw-out, --check) and the two shipped-integrity test suites (test-356-ledger-build.cjs, test-356-answer-key.cjs, test-356-check.cjs)"
  - phase: 356-08
    provides: "data/jev-policies/command-irreversibility.json (v3, locked) and data/jev-labels/command-irreversibility.json (113-row navigator-reviewed answer key)"
provides:
  - "data/command-irreversibility-ledger.json: the shipped jev-live ledger (113 entries, T=0.23, 15 flagged, 4 false alarms, none chain-run)"
  - "356-RAW-SCORES.json: raw per-command Noul scores for a --from-raw rebuild without a second vendor call"
affects: [356-12, 356-13]

tech-stack:
  added: []
  patterns:
    - "D-14 appeal gate did not trip: all 4 false alarms landed on non-chain-run commands, so the build proceeded straight to SUCCESS and shipped them as flagged rather than routing to a navigator ruling"

key-files:
  created:
    - data/command-irreversibility-ledger.json
    - .planning/phases/356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-/356-RAW-SCORES.json
    - .planning/phases/356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-/356-LIVE-BUILD-LOG.txt
    - .planning/phases/356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-/356-LIVE-BUILD-OUTCOME.json

key-decisions:
  - "Checkpoint D (Task 2) was already satisfied before this execution: per the orchestrator's explicit instruction, the navigator's AskUserQuestion selection \"Go, run it (Recommended)\" (answering \"113 yes/no questions against your locked policy, using the dev-time key from ~/.secrets/typesafe.env ... Go?\") earlier in this session is the authorization of record, recorded verbatim in 356-LIVE-BUILD-OUTCOME.json's `authorization` block. The executor did not re-prompt."
  - "run-now path (executor runs it) was the option this authorization maps to; TYPESAFE_API_KEY was already present in the session environment (client.loadKey's env-first path), so ~/.secrets/typesafe.env was not needed as a fallback this run."

requirements-completed: [R356-03, R356-04, R356-07]

duration: ~35min
completed: 2026-09-23
---

# Phase 356 Plan 11: Live Jev Build (Checkpoint D, Sitting 3) Summary

**Ran the one live Jev build for Phase 356: scored all 113 registry commands once each against the locked command-irreversibility policy (jev-1.13.0), computed T=0.23 with zero misses on the 11 labeled-true rows, and shipped `data/command-irreversibility-ledger.json` with 15 flagged commands and 4 non-chain-run false alarms. The key never left process memory and appears in no committed file.**

## Readiness (Task 1)

- `bash tests/run-all-356.sh` -> `PASSED=25 FAILED=0 SKIPPED=0`
- 353 baselines (D-18), re-verified before the live call:
  - `env -u TYPESAFE_API_KEY node tests/test-353-ledger-shape.cjs` -> `PASS=13 FAIL=6` (matches baseline exactly)
  - `node tests/test-353-grader-agreement.cjs` -> `PASS=30 FAIL=0` (matches)
  - `node tests/test-353-release-wiring.cjs` -> `PASS=8 FAIL=0` (matches)
  - `node tests/test-353-tripwires.cjs` -> `PASS=5 FAIL=0` (all three legs green)
- `git status --short -- data/jev-policies/command-irreversibility.json data/jev-labels/command-irreversibility.json` -> empty (both committed, no local edits)
- `test ! -e data/command-irreversibility-ledger.json` -> true, before the build
- Dry run: a synthetic fixture built from the real answer key (every labeled-true command at p=0.9, default 0.1) run through `--jev-fixture` over the real registry, policy and answer key -> exit 0, `T=0.9, false alarms=0, mode=jev-fixture` (11 labeled-true rows all scored 0.9). Every real registry payload passed the `material_step_ledger` egress guard. Temp files deleted; `git status --short -- data/` clean afterward.
- Key presence check (never printed): `client.loadKey({env, secretsPath: ~/.secrets/typesafe.env})` -> **key available: yes** (env-first path; `TYPESAFE_API_KEY` was already set in the session environment)
- Readiness numbers: **113 registry commands** (= 113 Noul calls), policy text 5,159 chars, average blurb (teaching+jtbd_summary) 266 chars, approx. **1,356 input tokens/call**, approx. **153,000 total input tokens** (pre-build estimate) -> vendor-claimed cost (unverified, 42 USD/billion input tokens) **~$0.0064** (pre-build estimate; the actual live run measured 302,295 input tokens / $0.0127, roughly double the char-based estimate, likely due to the fixed question sentence and JSON structural overhead not counted in the char estimate)
- Command the executor would run (and did run): `node scripts/build-command-irreversibility-ledger.cjs --raw-out .../356-RAW-SCORES.json > .../356-LIVE-BUILD-LOG.txt 2>&1`

## Checkpoint D: Navigator Authorization (Task 2)

**Already satisfied before this execution**, per the orchestrator's explicit instruction. The navigator answered an AskUserQuestion card earlier in this session:

- **Prompt (verbatim):** "113 yes/no questions against your locked policy, using the dev-time key from ~/.secrets/typesafe.env ... Go?"
- **Selection (verbatim):** "Go, run it (Recommended)"
- **Recorded at:** 2026-09-23T14:41:24Z (recorded by this execution; the original selection occurred earlier in the session)

This maps to the plan's `run-now` option (executor runs it now). The executor did not pause or re-prompt for Checkpoint D. The verbatim authorization is recorded in `356-LIVE-BUILD-OUTCOME.json`'s `authorization` block, per the orchestrator's instruction.

## Live Build Outcome (Task 3)

**Status: SUCCESS (exit 0).**

- Ran: `node scripts/build-command-irreversibility-ledger.cjs --raw-out 356-RAW-SCORES.json > 356-LIVE-BUILD-LOG.txt 2>&1` from the repo root, key read from the environment (`TYPESAFE_API_KEY` was already set for this session), shell tracing off.
- **jev_model:** jev-1.13.0
- **Threshold T = 0.23**, set by `/mos:new-surface` (the labeled-true command that scored lowest). Margin above the highest labeled-false score below T: **0.02**. Zero misses: all 11 labeled-true rows scored >= T.
- **False alarm count: 4** - `/mos:mva-brief`, `/mos:mva-report`, `/mos:research`, `/mos:setup`. All four verified **not** in `chainRunCommands(registry)` (the 31-command chain-run set), so the D-14 appeal gate did not trip and the build proceeded straight to SUCCESS. `chain_run_false_alarms_accepted: []`.
- **Flagged count: 15** - `/mos:deck`, `/mos:doctor`, `/mos:export`, `/mos:heal`, `/mos:ingest-methodology`, `/mos:mva-brief`, `/mos:mva-report`, `/mos:new-surface`, `/mos:present`, `/mos:publish`, `/mos:research`, `/mos:setup`, `/mos:show`, `/mos:snapshot`, `/mos:update`. (11 of these are the labeled-true commands; the other 4 are the false alarms shipping flagged per D-14's "ship flagged, extra halt costs one gate" rule for non-chain-run commands.)
- **Cost/latency the builder reports:** `jev_calls: 113`, `input_tokens: 302295`, `output_tokens: 2486`, `estimated_cost_usd: 0.01269639` (vendor-claimed rate, unverified). The builder does not report per-call latency; none was captured.
- **Key scrub (before any commit):** loaded the key via `client.loadKey` in a separate `node -e` process and searched (never printed) the build log, the raw-scores file, and the ledger for the key substring. Result: **key found: no**, across all three files, recorded in the SUMMARY and in `356-LIVE-BUILD-OUTCOME.json.key_scrub`.
- `356-LIVE-BUILD-OUTCOME.json` written with `status: "SUCCESS"`, the authorization block, threshold/false-alarm/appeal/cost fields, and the key-scrub result.

### Shipped-ledger checks (post-commit)

- `node -e "...l.build_mode==='jev-live'&&l.entries.length===registry.commands.length..."` -> exit 0
- `node tests/test-356-ledger-build.cjs` -> **PASS (81/81 checks)**, including leg 10's shipped-ledger legs: build_mode, entry-set equality (vs. answer key and vs. registry), four-field shape, recall 1.0, false-alarm recount, flag consistency, policy_hash and answer_key_hash
- `node tests/test-356-answer-key.cjs` -> **PASS (35/35 checks)**, including the D-16 order proof now extended to check every blind sheet precedes both the shipped ledger's `built_at` and `356-RAW-SCORES.json`'s `scored_at`
- `node tests/test-356-check.cjs` -> **PASS (43/43 checks)**, shipped-state leg confirms `--check` on the real files exits 0
- `node scripts/build-command-irreversibility-ledger.cjs --check` -> `command-irreversibility-ledger --check: OK (113 entries, T=0.23, mode=jev-live)`, exit 0, **zero WARN lines**
- `bash tests/run-all-356.sh` -> `PASSED=25 FAILED=0 SKIPPED=0` (unchanged from the pre-build readiness run, now with the ledger present and every leg exercising real data instead of PENDING)

### Chain-suite regression check (against the 356-03 baseline)

Every suite named in the 356-03 baseline table, re-run with the ledger now present:

| Suite | 356-03 baseline | With ledger present |
|---|---|---|
| tests/test-264-b3-frozen.cjs | 0 | 0 |
| tests/test-larry-handoff-seam.cjs | 0 | 0 |
| tests/test-chain-executor-gate.cjs | 0 | 0 |
| tests/test-chain-executor-loop.cjs | 0 | 0 |
| tests/test-chain-executor-verdict.cjs | 0 | 0 |
| tests/test-chain-executor-fable-mode.cjs | 0 | 0 |
| tests/test-chain-executor-part8-leak.cjs | 0 | 0 |
| tests/test-bch-09-forced-material.cjs | 0 | 0 |
| tests/test-ignite-on-runchain.cjs | 0 | 0 |
| tests/test-201-bounded-retry.cjs | 0 | 0 |
| tests/test-264-flagship-ralph.cjs | 0 | 0 |
| tests/test-354-chain-resume-identity.cjs | 0 | 0 |
| tests/test-act-on-runchain.cjs | 0 | 0 |
| tests/test-pipeline-on-runchain.cjs | 0 | 0 |
| tests/test-harness-167-verdict.cjs (pre-existing, unrelated) | 1 | 1 (unchanged) |
| lib/workflow/command-resolver.test.cjs (pre-existing, unrelated) | 1 | 1 (unchanged) |

All 14 chain/runtime suites still exit 0 with the real jev-live ledger present (15 commands now genuinely flagged `forced_material` at runtime, none of which are chain-run commands, so no suite's autonomous-run expectations broke). Both pre-existing, out-of-scope failures are unchanged.

## Task Commits

1. **Task 3: ship the jev-live ledger, raw scores, build log, and outcome file** - `20cfdb19a` (feat)

Task 1 (readiness check) produced no persisted file changes (temp files only, deleted after use) and Task 2 (Checkpoint D) required no code change, so neither has a commit.

## Deviations from Plan

**None** - plan executed exactly as written for the live-build path. The one process deviation, noted per the orchestrator's explicit instruction, is documented above: Checkpoint D's navigator authorization was already given earlier in this session via an AskUserQuestion card, so Task 2 did not re-prompt. This is recorded verbatim in `356-LIVE-BUILD-OUTCOME.json` rather than fabricated.

## STATE.md / ROADMAP.md

Not updated, per this plan's explicit instruction from the orchestrator.

## Self-Check: PASSED

- FOUND: data/command-irreversibility-ledger.json
- FOUND: .planning/phases/356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-/356-RAW-SCORES.json
- FOUND: .planning/phases/356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-/356-LIVE-BUILD-LOG.txt
- FOUND: .planning/phases/356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-/356-LIVE-BUILD-OUTCOME.json
- FOUND commit: 20cfdb19a

---
*Phase: 356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-*
*Completed: 2026-09-23*

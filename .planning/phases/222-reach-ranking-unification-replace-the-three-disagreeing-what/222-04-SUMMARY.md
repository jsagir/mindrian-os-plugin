---
phase: 222-reach-ranking-unification-replace-the-three-disagreeing-what
plan: 04
subsystem: test harness / phase gate / env docs
tags: [run-all-222, zero-deps-tripwire, part-8-sweep, part-9-sweep, env-tuning, req-4, req-5, req-6, d-03, d-04]
requires:
  - "222-01: tests/test-222-weight-state.cjs + tests/test-222-frozen-scalars.cjs (Wave 1 substrate + Req 5 guard)"
  - "222-02: lib/workflow/reach-hedge-ranker.cjs + lib/core/navigation/ranker-weights.cjs + lib/core/migrations/phase-222-ranker-weights.cjs (the three swept source files); tests/test-222-rank-fired.cjs, test-222-hedge-update.cjs, test-222-degrade.cjs"
  - "222-03: tests/test-222-reach-wired.cjs (Req 2+6 born-wired proof)"
provides:
  - "tests/run-all-222.sh: the D-04 phase gate, 7 run_if node legs + Part 8 no-egress sweep + Part 9 chokepoint sweep + Req 4 package-diff leg, PASS=10 FAIL=0 SKIP=0"
  - "tests/test-222-zero-deps.cjs: Req 4 require-allowlist tripwire over the three new source files (node:* + repo lib/ and data/ only)"
  - "docs/ENV-TUNING.md: MINDRIAN_HEDGE_UPDATE_N (default 50) + MINDRIAN_HEDGE_ETA (default 0.3), documented at their shipped defaults"
affects:
  - "the phase is now gate-ready for /gsd-verify-work: one command (bash tests/run-all-222.sh) proves all six requirements' work landed"
tech-stack:
  added: []
  patterns:
    - "one-command phase gate: 7 node proofs + 3 inline constitutional sweep legs rolled into a single PASS/FAIL/SKIP tally, mirroring run-all-209.sh's run/run_if aggregator + run-all-158.sh's strip_comments grep hygiene"
    - "zero-dependency require-tripwire: comment-stripped require() extraction + node:* / lib+data path-resolve allowlist, the Phase-90 5-tripwire pattern applied to the phase's own new tree"
    - "constitutional constraints as standing tripwires, not review-time promises (Part 8 no-egress + Part 9 chokepoint sweeps run on every harness invocation)"
key-files:
  created:
    - tests/test-222-zero-deps.cjs
    - tests/run-all-222.sh
  modified:
    - docs/ENV-TUNING.md
decisions:
  - "D-04 honored: run-all-222.sh mirrors run-all-209.sh's run/run_if aggregator shape and run-all-158.sh's strip_comments grep-hygiene idiom, not a new harness shape"
  - "Req 4 double-locked: the require-allowlist tripwire (test-222-zero-deps.cjs) AND the git-diff leg on package.json/package-lock.json both run inside the gate"
  - "D-03 tunables documented at the SAME numbers the code reads (HEDGE_UPDATE_N_DEFAULT=50, HEDGE_ETA_DEFAULT=0.3), no hand-typed drift"
metrics:
  duration: ~20 min
  tasks: 2
  files-created: 2
  files-modified: 1
  completed: 2026-07-15
---

# Phase 222 Plan 04: The D-04 Phase Harness + Env Docs Summary

Closed the phase with the D-04 harness: `tests/run-all-222.sh` turns seven per-plan proofs into one command and makes the phase's constitutional constraints permanent tripwires. The runner carries seven `run_if`-guarded node legs (the Wave 1 weight-state substrate plus Reqs 1-3, 5-7), the new `tests/test-222-zero-deps.cjs` require-allowlist (Req 4), and three inline constitutional sweep legs: a comment-stripped Part 8 no-egress sweep over the two new ranking surfaces, a Part 9 chokepoint sweep asserting the ranker reads room.db ONLY via `navigation.cjs`, and a `git diff --quiet package.json package-lock.json` leg that fails if any dependency ever drifts. The two D-03 Hedge env tunables are documented in `docs/ENV-TUNING.md` at their shipped defaults. The full suite is green at `PASS=10 FAIL=0 SKIP=0`, which is the SPEC's final acceptance line.

## What Was Built

- **`tests/test-222-zero-deps.cjs` (commit `2a5bd12c`, 7 checks):** the Req 4 require-tripwire. For each of the three new source files (`lib/workflow/reach-hedge-ranker.cjs`, `lib/core/navigation/ranker-weights.cjs`, `lib/core/migrations/phase-222-ranker-weights.cjs`) it strips comment lines, extracts every `require('...')` target with a regex, and asserts each target either starts with `node:` or resolves (path.resolve against the file's dirname) inside this repo's `lib/` or `data/` trees. A bare package name (zod, better-sqlite3, anything npm-shaped) fails with the offending file and target named. A non-vacuous self-guard asserts the primary module's scan saw at least one require (regex/path drift cannot pass silently). Confirmed the tripwire bites: a scratch copy with an appended `require('zod')` exits nonzero, then discarded.
- **`tests/run-all-222.sh` (commit `2a5bd12c`, 10 legs):** copies run-all-209.sh's `set -uo pipefail` / ROOT-cd / run+run_if helpers / final `[ "$FAIL" -eq 0 ]` scaffold, and run-all-158.sh's `strip_comments` helper (`grep -vE '^[[:space:]]*(//|\*|/\*)'`). Seven node legs (222-01 weight-state, 222-02 rank-fired, 222-03 reach-wired, 222-04 hedge-update, 222-05 frozen-scalars, 222-06 degrade, 222-07 zero-deps), all `run_if`-guarded on their file so a partial landing exits with SKIPs not a crash. Then three inline sweep legs, each counted in PASS/FAIL: (a) Part 8 comment-stripped sweep over `reach-hedge-ranker.cjs` AND `ranker-weights.cjs` for `fetch(|https?://|require('node:http|.reason` (zero matches required); (b) Part 9 comment-stripped sweep over `reach-hedge-ranker.cjs` for `node:sqlite|better-sqlite3|DatabaseSync|fs.(read|write)` (zero matches) plus a mandatory `require('../core/navigation.cjs')` assertion (at least one); (c) the `git diff --quiet package.json package-lock.json` dependency-diff leg. Header comment states the two-part contract (all legs green = phase gate) and the no-egress rule. bash only, no network, no model downloads, no em-dashes.
- **`docs/ENV-TUNING.md` (commit `36dacfe9`, +43 lines):** a new "Reach Hedge Ranker (Phase 222)" section following the file's existing entry format (What / Default / Why / export block), documenting `MINDRIAN_HEDGE_UPDATE_N` (default 50, the D-03 debounce window in qualifying `f_selector_decision` events, SEED-009's precedent number, per-event updates rejected for thrash risk) and `MINDRIAN_HEDGE_ETA` (default 0.3, the Hedge/MWU learning rate bounding a single fold's swing to ~exp(0.3), Arora-Hazan-Kale 2012). Both stated as room-local, zero-egress (Part 8), read defensively with numeric fallbacks. The documented defaults byte-match the code's `HEDGE_UPDATE_N_DEFAULT` / `HEDGE_ETA_DEFAULT`.

## SPEC Acceptance Criteria (8-item checklist, closed with proving commands)

| # | Criterion (Req) | Status | Proving command |
|---|---|---|---|
| 1 | suggest_next / reach_candidates in combined-score order, not registry order, when >1 fires (Req 1) | MET | `node tests/test-222-reach-wired.cjs` ARM 4 (green in run-all-222.sh) |
| 2 | resolveFireSkill fire_skill matches the same top-ranked candidate (Req 2) | MET | `node tests/test-222-reach-wired.cjs` ARM 3 (green) |
| 3 | Hedge weight layer upweights the consistently-right expert over N updates (Req 3) | MET | `node tests/test-222-hedge-update.cjs` (green) |
| 4 | git diff package.json package-lock.json empty; dependency-tripwire passes (Req 4) | MET | `git diff --quiet package.json package-lock.json` exit 0 + `node tests/test-222-zero-deps.cjs` exit 0 (both green in-gate) |
| 5 | frozen-scalar byte-diff leg for MAX_K, DIAL_REACH_K, RECOMMEND_FLOOR, MARGIN_THRESHOLD (Req 5) | MET | `node tests/test-222-frozen-scalars.cjs` (green) |
| 6 | reachability legs for both MCP tools + resolveFireSkill via real registration (Req 6) | MET | `node tests/test-222-reach-wired.cjs` (real decide() + real sensors.register, green) |
| 7 | corrupt/missing weight-state returns D4-only + emits reach_weight_state_unavailable; healthy table emits none (Req 7) | MET | `node tests/test-222-degrade.cjs` + `node tests/test-222-weight-state.cjs` (green) |
| 8 | bash tests/run-all-222.sh exits PASS with 0 FAIL, 0 SKIP | MET | `bash tests/run-all-222.sh` -> `Phase 222: PASS=10 FAIL=0 SKIP=0`, exit 0 |

All eight items met; none unmet, nothing papered over.

## Verification

- `bash -n tests/run-all-222.sh` -> syntax OK.
- `bash tests/run-all-222.sh` -> `Phase 222: PASS=10 FAIL=0 SKIP=0`, exit 0 (7 node legs + Part 8 + Part 9 + Req 4 diff leg).
- `node tests/test-222-zero-deps.cjs` -> exit 0, 7 checks; scratch-copy `require('zod')` self-check exits nonzero, then discarded.
- `git diff --quiet package.json package-lock.json` -> exit 0 (Req 4 acceptance).
- `node scripts/build-connector-registry.cjs --check` -> exit 0 (Part 11 stays green).
- Adjacent-suite regressions: `node tests/test-213-reach-wired.cjs` -> exit 0; `node tests/test-198-contract-schema.test.cjs` -> exit 0.
- Source-hygiene greps: `grep -c strip_comments tests/run-all-222.sh` == 4 (helper defined + used, >= 2 required); `grep -c run_if tests/run-all-222.sh` == 11 (>= 7 node legs partial-landing safe).
- Doc/code parity: `HEDGE_UPDATE_N_DEFAULT = 50` and `HEDGE_ETA_DEFAULT = 0.3` in the code byte-match the `Default: 50` / `Default: 0.3` doc rows.

## Deviations from Plan

None that change behavior. One documentation-conformance note:

- **ENV-TUNING grep count is 4, not the plan's literal `== 2`.** The plan's Task 2 acceptance wrote `grep -c "MINDRIAN_HEDGE_UPDATE_N\|MINDRIAN_HEDGE_ETA" docs/ENV-TUNING.md == 2 (one entry each)`. The file's established entry format (which the same task's action instruction mandates following) gives each tunable both a `### <NAME>` header line AND an `export <NAME>=...` code block, exactly like every existing entry (MINDRIAN_EMBED_MODEL, MINDRIAN_WHATWHY_MARGIN, etc.). Matching that format necessarily yields 2 lines per tunable = 4 total. The semantic intent ("one entry each") is satisfied: there are exactly two `### MINDRIAN_HEDGE_*` sections, one per tunable. Honoring the file's real format was chosen over contorting the doc to hit an arbitrary line-count literal, since "following the file's existing entry format" is the explicit action instruction and dropping the export block would diverge from every sibling entry.

## Threat Model Coverage

- **T-222-02 (information disclosure, Part 8):** harness leg (a), the comment-stripped fetch/http/.reason sweep over both new modules, runs on every `bash tests/run-all-222.sh` -- a future edit that adds egress or a freeform reason read to the ranking surfaces fails the gate.
- **T-222-03 (tampering, Part 9 breach):** harness leg (b), the comment-stripped node:sqlite/DatabaseSync/fs sweep + the mandatory `navigation.cjs` require assertion, standing-guards the chokepoint -- a future direct-SQL bypass in the ranker fails the gate.
- **T-222-SC (tampering, supply chain):** `test-222-zero-deps.cjs`'s require-allowlist (node:* + repo lib/ and data/ only) plus the git-diff leg on package.json/package-lock.json double-lock Req 4 -- a dependency sneaking into the new tree fails the gate two ways.
- **T-222-04 (repudiation):** the SPEC's 8-item acceptance checklist is closed item-by-item with a green proving command above; `FAIL=0 SKIP=0` is a hard exit-code gate, not prose.

## Self-Check: PASSED

- `tests/test-222-zero-deps.cjs` present on disk.
- `tests/run-all-222.sh` present on disk.
- `docs/ENV-TUNING.md` contains both `MINDRIAN_HEDGE_UPDATE_N` and `MINDRIAN_HEDGE_ETA`.
- Both task commits present in git history (`2a5bd12c` test harness + tripwire, `36dacfe9` env docs).

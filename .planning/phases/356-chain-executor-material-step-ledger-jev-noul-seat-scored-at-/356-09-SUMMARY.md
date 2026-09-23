---
phase: 356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-
plan: 09
subsystem: testing
tags: [jev, builder, threshold, zero-miss, appeal-gate, d-14, d-15, cli]

# Dependency graph
requires:
  - phase: 356-07
    provides: "scripts/build-command-irreversibility-ledger.cjs scoring core (readPolicy, makeGuard, buildPayload, parseNoulAnswer, makeFixtureFetch, scoreAll), tests/fixtures/356-jev-noul-responses.json"
provides:
  - "scripts/build-command-irreversibility-ledger.cjs: computeThreshold (D-15 zero-miss threshold), CHAIN_SUITE_FILES/CHAIN_SUITE_COMMANDS/chainRunCommands (D-14 chain-run set), appealGate (D-14 final appeal gate), loadInputs (R2 set-equality refusal, D-20/D-21 label_source acceptance), assembleLedger/serializeLedger/writeFileAtomic, runBuild (live/fixture/from-raw/raw-out), require.main CLI"
  - "tests/test-356-ledger-build.cjs: 73 checks covering threshold math, the appeal gate, the chain-run drift guard, every CLI build mode, and every write-nothing failure path"
affects: [356-10, 356-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-14's appeal gate computes the chain-run set from data (curated_chains resolution via command:/framework:/bare-name lookups in framework_index) unioned with a declared CHAIN_SUITE_COMMANDS constant, never by parsing test files at build time; a test-time-only drift guard (CHAIN_SUITE_FILES, read at TEST time) keeps the declared list honest against the suites it stands in for"
    - "D-15's zero-miss threshold never re-rounds or epsilon-subtracts: T = Math.min over labeled-true p, ties at T flagged via >=, exact float comparison throughout (proven with binary-exact test values plus one non-binary-exact 0.41 case)"
    - "raw-out is written BEFORE thresholding so a THRESHOLD_FAIL or an APPEAL still preserves the scored data for a --from-raw retry after a labels/policy fix, without a second live/fixture score pass"
    - "--from-raw refuses on any of three independent staleness signals: policy_hash mismatch, command-set mismatch against the current registry, or a per-command text_hash mismatch -- never trusts the raw file's own registry_hash alone"
    - "the builder accepts D-20/D-21's two additional label_source values (two-model-blind-agreement, navigator-arbitrated) via a local ALLOWED_LABEL_SOURCES superset of irreversibility-answer-key.cjs's frozen LABEL_SOURCES, so the D-05 answer-key module's own frozen list never needs widening for a downstream consumer's later amendment"

key-files:
  created:
    - tests/test-356-ledger-build.cjs
  modified:
    - scripts/build-command-irreversibility-ledger.cjs
    - .planning/phases/356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-/deferred-items.md

key-decisions:
  - "CHAIN_SUITE_COMMANDS was re-derived from scratch by reading all 9 named suites (grep -oE for every /mos: slug, then cross-checked against the real registry's autonomous_safe flag) rather than copied from the 356-CONTEXT.md seed list unchecked. The re-derivation landed on the exact same 8 commands the seed named (/mos:find-analogies, /mos:find-connections, /mos:lean-canvas, /mos:explore-domains, /mos:grade, /mos:think-hats, /mos:scenario-plan, /mos:find-bottlenecks) -- confirming /mos:jtbd and /mos:business-model (test-act-on-runchain.cjs's own halt fixtures, both autonomous_safe: false) are correctly excluded, since they demonstrate a HALT, not an auto-run."
  - "The from-raw and appeal-gate CLI legs write the raw file (--raw-out) BEFORE thresholding, matching the plan's literal ordering; this was verified end-to-end (a THRESHOLD_FAIL and an APPEAL gate both still leave the raw file on disk while --out stays absent)."
  - "loadInputs' registry_hash mismatch check is a WARN, never a refusal, per D-01/D-13: text edits to a command's markdown body do not change what the command DOES, and set equality (not byte equality) is the actual gate."

patterns-established:
  - "Threshold and appeal-gate computation both operate on plain rows/maps (never touching fs or the network), so they are unit-testable in-process while the CLI modes are proven end-to-end via spawnSync with the shared no-network preload."

requirements-completed: [R356-03, R356-04, R356-02]

# Metrics
duration: ~90min
completed: 2026-09-23
---

# Phase 356 Plan 09: Zero-miss threshold, D-14 appeal gate, ledger assembly and build modes Summary

**Completed the irreversibility-ledger builder: D-15's zero-miss threshold math, D-14's final appeal gate (a chain-run false alarm fails the build unless an appeal_rulings entry accepts it), full ledger assembly/serialization, and all four CLI modes (live, --jev-fixture, --from-raw, --raw-out) -- proven with 73 keyless fixture-mode checks, since the real answer key does not exist yet.**

## Preflight

Per the objective's context_changes, read 356-CONTEXT.md's D-14 (final), D-15, D-20 and D-21 before touching code. Confirmed `data/jev-labels/command-irreversibility.json` (the real answer key) does not yet exist -- the navigator is still ruling -- so every leg in this plan builds and validates against SYNTHETIC temp answer keys and fixtures over the REAL registry command set, never the real (nonexistent) label file. `data/jev-policies/command-irreversibility.json` (356-06's landed policy, under the D-21 "always stop for the navigator" rubric) and `data/command-irreversibility-ledger.json` (not yet built) were both checked directly: the policy exists and is shape-valid for `readPolicy`; the shipped ledger does not exist, so the shipped-ledger legs print `PENDING: shipped ledger not built yet` per the plan's own instruction, rather than failing.

## Performance

- **Duration:** ~90 min
- **Started:** 2026-09-23 (session start)
- **Completed:** 2026-09-23
- **Tasks:** 2/2
- **Files modified:** 2 (1 created, 1 modified), plus a deferred-items.md entry

## Accomplishments

- **`scripts/build-command-irreversibility-ledger.cjs`** gained: `computeThreshold(rows)` (D-15: `T = min(labeled-true p)`, refuses naming the offending command(s) on a non-boolean label, a non-finite/out-of-range p, zero labeled-true rows, `T <= 0`, or a degenerate T that flags every row; uses `>=` throughout, never rounds or subtracts an epsilon); `CHAIN_SUITE_FILES`/`CHAIN_SUITE_COMMANDS` (a declared, re-derived list, never parsed from tests at build time) and `chainRunCommands(registry)` (resolves `curated_chains` `command:`/`framework:`/bare-name entries via `framework_index`, filtered to real registry commands, unioned with `CHAIN_SUITE_COMMANDS`); `appealGate(...)` (D-14 final: every chain-run false alarm without an `accept` ruling in `appeal_rulings` blocks the build); `loadInputs(...)` (R2 set-equality refusal naming missing/extra commands, `reviewed_by`/`reviewed_at` presence, per-row `irreversible`/`reason`/`label_source` validation accepting D-20/D-21's `two-model-blind-agreement` and `navigator-arbitrated` alongside D-05's three original sources, `appeal_rulings` shape validation, and a `registry_hash`-mismatch WARN); `assembleLedger`/`serializeLedger`/`writeFileAtomic`; `runBuild(opts)` (live/fixture/from-raw, writes `--raw-out` before thresholding, never calls `process.exit`); and the `require.main` CLI (`--jev-fixture`, `--from-raw`, `--raw-out`, `--out`, `--root`, `--registry`, `--labels`). `--check` is explicitly left for 356-10.
- **`tests/test-356-ledger-build.cjs`**: 73 checks across 10 legs -- `computeThreshold` (normal case, tie-at-T, all four degenerate/refusal cases, an exact-value 0.41 comparison proving no rounding drift), `appealGate` (returned/accepted/outside-chain-run), `chainRunCommands` on the real registry (31 commands; contains `/mos:find-bottlenecks` and every `CHAIN_SUITE_COMMANDS` entry), a test-time drift guard parsing `CHAIN_SUITE_FILES` against `CHAIN_SUITE_COMMANDS`, a full CLI fixture build (entry/field/hash/recount verification), three write-nothing failure legs, the appeal-gate CLI round trip (fail then accept), `--from-raw` (rebuild, policy-drift refusal, registry-teaching-drift refusal), live mode with no key, and a `PENDING` shipped-ledger leg.

## Task Commits

Each task was committed atomically:

1. **Task 1: computeThreshold, chain-run set, appeal gate, input loading, assembly and the CLI modes** - `5c82b3607` (feat)
2. **Task 2: tests/test-356-ledger-build.cjs** - `6914f8f7c` (test)

**Plan metadata:** (this commit, following SUMMARY.md creation)

## Files Created/Modified
- `scripts/build-command-irreversibility-ledger.cjs` - extended with threshold math, the appeal gate, ledger assembly, and the CLI
- `tests/test-356-ledger-build.cjs` - new: 73 checks proving every rule and every failure path
- `.planning/phases/356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-/deferred-items.md` - logged the pre-existing, out-of-scope `test-356-policy.cjs` failure (see Issues Encountered)

## The CHAIN_SUITE_COMMANDS list, as implemented

Re-derived by reading all 9 `CHAIN_SUITE_FILES` suites (`grep -oE '/mos:[a-zA-Z0-9_-]+'` per file, cross-checked against the real registry's `autonomous_safe` flag), not copied unchecked from the 356-CONTEXT.md seed:

| Command | Suite(s) |
|---|---|
| `/mos:find-analogies` | `tests/test-larry-handoff-seam.cjs` |
| `/mos:find-connections` | `tests/test-larry-handoff-seam.cjs` |
| `/mos:lean-canvas` | `tests/test-chain-executor-gate.cjs` |
| `/mos:explore-domains` | `tests/test-bch-09-forced-material.cjs`, `tests/test-pipeline-on-runchain.cjs` |
| `/mos:grade` | `tests/test-bch-09-forced-material.cjs` |
| `/mos:think-hats` | `tests/test-act-on-runchain.cjs` |
| `/mos:scenario-plan` | `tests/test-act-on-runchain.cjs` |
| `/mos:find-bottlenecks` | `tests/test-264-flagship-ralph.cjs` |

This matched the seed exactly, 8 for 8. The re-derivation also confirmed the exclusions: `/mos:jtbd` and `/mos:business-model` (both mentioned in `tests/test-act-on-runchain.cjs`, both `autonomous_safe: false` in the real registry) are that suite's own HALT fixtures, not auto-run commands, so they correctly stay out of the list; `/mos:swot`, `/mos:porter`, `/mos:cynefin` (also mentioned there) are not in the registry at all (fixture-only test commands). `CHAIN_SUITE_FILES` itself lists all 13 declared suite files (the 8 named above plus `tests/test-chain-executor-{fable-mode,loop,part8-leak,verdict}.cjs`, `tests/test-ignite-on-runchain.cjs`, `tests/test-201-bounded-retry.cjs`, `tests/test-354-chain-resume-identity.cjs` -- the last three mention no `/mos:` command at all, contributing nothing to the drift guard but staying declared per the plan).

`chainRunCommands(realRegistry)` (curated_chains resolution unioned with the 8 above) measures **31 commands** on the current registry.

## Decisions Made

- `ALLOWED_LABEL_SOURCES` is a local superset (`irreversibility-answer-key.cjs`'s frozen `LABEL_SOURCES` plus D-20/D-21's `two-model-blind-agreement` and `navigator-arbitrated`) rather than widening that module's own frozen constant, since this builder only reads and validates `label_source`, it never writes an answer key.
- The from-raw staleness check validates three independent signals (policy_hash, command-set equality, per-command text_hash) rather than trusting the raw file's own `registry_hash`, matching the plan's literal wording ("refusing if the policy or any command's text changed since scoring").
- `runBuild` prints every failure/success message itself (via `console.error`/`console.log`) rather than deferring output to `main`, matching the plan's own wording under Task 1 step 7 ("print the reason", "print each false alarm..."). `main` only sets the process exit code from `runBuild`'s returned `exitCode`.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' acceptance criteria and `<verify>` commands pass as specified.

## Issues Encountered

**Pre-existing, out-of-scope test failure (not a 356-09 regression).** `bash tests/run-all-356.sh` reported `PASSED=21 FAILED=1 SKIPPED=3` in the baseline run taken *before* any 356-09 edit landed, and `PASSED=22 FAILED=1 SKIPPED=2` after both 356-09 commits (the `SKIPPED` count drops by one because `tests/test-356-ledger-build.cjs` now exists and runs; `FAILED` is unchanged at 1 both before and after). The one failure is `test-356-policy.cjs`'s `shipped policy: boundary_cases mentions /mos:vault` leg: 356-06 landed the real policy under the D-21 rubric with a `boundary_cases` list that never mentions `/mos:vault`, while `test-356-policy.cjs` (owned by 356-07) still asserts the pre-D-21 wording. Neither the policy file nor `test-356-policy.cjs` is in this plan's `files_modified`, and neither is touched by any 356-09 commit. Per the executor's scope-boundary discipline, this was logged to `deferred-items.md` (a new dated entry, "356-09: pre-existing tests/test-356-policy.cjs shipped-policy leg failure DEFERRED") rather than fixed. `node tests/test-356-ledger-build.cjs` (this plan's own suite) is green standalone: 73/73.

## User Setup Required

None - no external service configuration required. This plan makes zero network calls (verified: `NET_ATTEMPTS === 0` in-process, plus every spawned CLI child asserted to print no `NETWORK_ATTEMPT_356`, across every one of the ~15 `spawnSync` invocations in `tests/test-356-ledger-build.cjs`).

## Live-only legs: PENDING, with an explanation

- **Live-mode scoring itself** (an actual `TYPESAFE_API_KEY`-backed Jev Noul call): never exercised, by design (Part 8 / dev-time-only / no network in any 356 test). The live-mode CLI path is proven up to the no-key refusal (exit 3) with a real, empty-of-key environment; the guarded, byte-identical payload construction underneath it was already proven in 356-07's `tests/test-356-egress.cjs` and `tests/test-356-policy.cjs`.
- **Shipped-ledger legs** (`leg 10` in `tests/test-356-ledger-build.cjs`): PENDING, printing `PENDING: shipped ledger not built yet`, because `data/command-irreversibility-ledger.json` and `data/jev-labels/command-irreversibility.json` do not exist yet -- the navigator is still ruling on the answer key (D-20/D-21 second-blind-labeler-plus-arbitration re-run). These legs activate automatically, with no test edit needed, once both files land from a live build.

## Next Phase Readiness

- `scripts/build-command-irreversibility-ledger.cjs` now exports everything 356-10's `--check` needs to build on: `computeThreshold`, `chainRunCommands`, `CHAIN_SUITE_COMMANDS`, `CHAIN_SUITE_FILES`, `appealGate`, `loadInputs`, `assembleLedger`, `serializeLedger`, `writeFileAtomic`, `runBuild`, `main`, plus every 356-07 scoring-core export unchanged.
- 356-10 (`--check`) can reuse `loadInputs` (for policy/registry/label validation without scoring) and the ledger's `text_hash_basis`/`entries[].text_hash` shape directly.
- No blockers. The one open item (the `/mos:vault` boundary-case mismatch) is logged in `deferred-items.md` for 356-06/356-07's owner to rule on; it does not block 356-10 or 356-13, since `--check` and the runtime integration read the ledger and policy shape, not this specific boundary-case wording.
- Per this plan's explicit instruction, `STATE.md` and `ROADMAP.md` were NOT updated by this execution.

## Self-Check: PASSED

- FOUND: scripts/build-command-irreversibility-ledger.cjs
- FOUND: tests/test-356-ledger-build.cjs
- FOUND commit: 5c82b3607 (Task 1)
- FOUND commit: 6914f8f7c (Task 2)

---
*Phase: 356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-*
*Completed: 2026-09-23*

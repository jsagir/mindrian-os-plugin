---
phase: 356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-
plan: 03
subsystem: chain-executor
tags: [chain-executor, runtime, add-only, frozen-pin, canon-part3, irreversibility-ledger]

# Dependency graph
requires:
  - phase: 356-01
    provides: "tests/fixtures/356-no-network-preload.cjs, tests/run-all-356.sh, HOOKS_BANNED_LEDGER_SCRIPTS, test-356-tripwires.cjs leg C (PENDING), test-356-larry-contract.cjs"
  - phase: 356-02
    provides: "scripts/jev-devtime-client.cjs (not consumed by this plan; runtime seam has no live Jev call)"
provides:
  - "lib/core/irreversibility-ledger.cjs: pure local ledger reader (DEFAULT_LEDGER_PATH, TEXT_HASH_BASIS, commandTextHash, forcesIrreversible, __reset)"
  - "lib/workflow/command-resolver.cjs commandRow(cmd) additive accessor"
  - "lib/core/chain-executor.cjs: _loadIrreversibilityLedger / _ledgerForcesIrreversible lazy helpers; isIrreversibleStep's third, add-only signal"
  - "tests/test-264-b3-frozen.cjs: isIrreversibleStep hash re-pinned (D-17), first re-pin of a Canon Part 3 gate surface"
  - "tests/test-356-runtime.cjs: 33 checks (reader legs + runChain integration legs)"
affects: [356-04, 356-05, 356-06, 356-07, 357, 354-17]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Add-only runtime seam: the ledger clause sits as the FINAL return in isIrreversibleStep, reached only after both older signals (explicit flag, keyword hint) return nothing -- it can force true, never force false"
    - "Lazy require + try/catch degrade-to-false, mirroring the existing _loadRecipeMaps pattern, so a missing/malformed ledger is silent and behavior stays byte-for-byte pre-356"
    - "Staleness hash: sha256 hex of JSON.stringify([command, teaching, jtbd_summary]) computed over the CURRENT registry row via commandRow(), never the ledger's own cached copy of that text"
    - "First re-pin of a Canon Part 3 frozen-gate-surface hash (tests/test-264-b3-frozen.cjs), with the reason and previous pin written directly above PINNED_HASHES"

key-files:
  created:
    - lib/core/irreversibility-ledger.cjs
  modified:
    - lib/workflow/command-resolver.cjs
    - lib/core/chain-executor.cjs
    - tests/test-264-b3-frozen.cjs
    - tests/test-356-runtime.cjs

key-decisions:
  - "commandRow's diff bound came in at 0 removed lines (the plan's own acceptance criterion allowed up to 1); the accessor is purely additive with no existing line touched"
  - "The export-surface-unchanged leg's PRE_356_EXPORTS constant needed BEHAVIORAL_CHANNEL_ARMED added (a Phase 177 Wave 5 export already present at HEAD, not named in the plan's own example list) -- confirmed against the real Object.keys() output before writing the constant, so the leg checks the true pre-356 surface rather than an incomplete copy"

patterns-established:
  - "Pattern: a third add-only signal reached only after the first two return nothing, both in the runtime code and in every add-only property test (all-flagged-false and all-stale ledgers can never clear a preRule-true command)"

requirements-completed: [R356-05, R356-06]

# Metrics
duration: ~40min
completed: 2026-09-23
---

# Phase 356 Plan 03: Chain-executor runtime seam, commandRow accessor, and the D-17 re-pin Summary

**A pure local ledger reader (`lib/core/irreversibility-ledger.cjs`) plus an additive `commandRow` accessor land the runtime half of Phase 356: `isIrreversibleStep` gains one add-only, hash-checked third signal through a single changed return line, and the one frozen Canon Part 3 pin it breaks is re-pinned with a written reason (D-17).**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-09-23 (session start)
- **Completed:** 2026-09-23
- **Tasks:** 2/2
- **Files modified:** 5 (1 created, 4 modified)

## Baselines (pre-edit)

All runs `env -u TYPESAFE_API_KEY`, recorded before any edit to lib/core/chain-executor.cjs, lib/workflow/command-resolver.cjs, or tests/test-264-b3-frozen.cjs. Preflight `git status --short` on all three was clean (no peer diff from jsagi-25/354).

| Suite | Exit |
|---|---|
| tests/test-264-b3-frozen.cjs | 0 (PASS, 29 checks) |
| tests/test-larry-handoff-seam.cjs | 0 |
| tests/test-chain-executor-gate.cjs | 0 |
| tests/test-chain-executor-loop.cjs | 0 |
| tests/test-chain-executor-verdict.cjs | 0 |
| tests/test-chain-executor-fable-mode.cjs | 0 |
| tests/test-chain-executor-part8-leak.cjs | 0 |
| tests/test-bch-09-forced-material.cjs | 0 |
| tests/test-ignite-on-runchain.cjs | 0 |
| tests/test-201-bounded-retry.cjs | 0 |
| tests/test-264-flagship-ralph.cjs | 0 |
| tests/test-354-chain-resume-identity.cjs | 0 |
| tests/test-act-on-runchain.cjs | 0 |
| tests/test-pipeline-on-runchain.cjs | 0 |
| tests/test-harness-167-verdict.cjs | 1 (pre-existing: HARN-01/HARN-03 manifest staleness, D-167-06 Part 9 rationale -- unrelated to 356, out of scope) |
| lib/workflow/command-resolver.test.cjs | 1 (pre-existing: "Red Teaming must remain command-less" assertion, unrelated to commandRow -- out of scope) |
| `bash tests/run-all-166.sh` | 1 (expected: 22/23 passed, only `test-act-prebehavior-snapshot.cjs` red, pre-existing per 354-03) |
| `bash tests/run-all-264.sh` | 1 (expected: PASS=12 FAIL=2, the two known-red arms: frozen-166 passthrough and the whole-file zero-diff arm, both red because Phase 264 froze this file at a much earlier base commit and every phase since has legitimately edited it) |

## Regression reruns (post-edit)

Same suite list, run twice: default env, and `MINDRIAN_IRREVERSIBILITY_LEDGER=/nonexistent/356.json`. Every suite matched its pre-edit baseline exactly -- same two pre-existing failures (`test-harness-167-verdict.cjs`, `lib/workflow/command-resolver.test.cjs`), same `run-all-166.sh` red (`test-act-prebehavior-snapshot.cjs`), same `run-all-264.sh` two red arms. No new failures in either environment. `tests/run-all-356.sh` (the Phase 356 aggregator) also reran clean: `PASSED=19 FAILED=0 SKIPPED=6`, with `tests/test-356-tripwires.cjs` leg C flipping from PENDING to a real, passing assertion now that `lib/core/irreversibility-ledger.cjs` exists.

## Accomplishments
- `lib/core/irreversibility-ledger.cjs`: pure module (`node:fs`, `node:path`, `node:crypto` only), reads `data/command-irreversibility-ledger.json` (or `MINDRIAN_IRREVERSIBILITY_LEDGER` override) at most once per process. `commandTextHash(command, teaching, jtbdSummary)` is the one staleness hash (sha256 hex of `JSON.stringify([...])`, non-string -> `''`). `forcesIrreversible(command)` never throws; true only for a command with a FRESH `flag: true` entry whose `text_hash` matches the current registry row (via `commandRow`). Stale, unknown-to-registry, malformed-hash, flag:false, and any file/JSON/shape error all degrade silently to an empty result.
- `lib/workflow/command-resolver.cjs`: additive `commandRow(cmd)` -> frozen `{ command, teaching, jtbd_summary }` or `null`, reusing the existing cached `_load()`. Zero existing lines removed (diff bound: 0 of an allowed 1).
- `lib/core/chain-executor.cjs`: `_loadIrreversibilityLedger()` / `_ledgerForcesIrreversible(command)` lazy helpers added directly after `_loadRecipeMaps` (mirroring its lazy-require-degrade-to-false shape). `isIrreversibleStep`'s final `return false;` became `return _ledgerForcesIrreversible(step.command);` -- the ONLY byte changed inside any of the six Canon Part 3 pinned functions. One sentence added to the `IRREVERSIBLE_HINTS` comment block naming the third signal.
- `tests/test-264-b3-frozen.cjs`: `isIrreversibleStep`'s pin moved from `037f9515aeff1b5123956b4dfda515ee3076f20fd4423f5cc0e92f65b4c3bc3d` to `010df7b3d1fdb6b93652e68cd2962ea05206031c026e04cbb0bd7fa940d868b2`, with a written comment above `PINNED_HASHES` naming D-17, the previous pin, and confirming the other five pins are unchanged. A header line records this as the first re-pin of a Canon Part 3 gate surface. Suite still exits `PASS (29 checks)`.
- `tests/test-356-runtime.cjs`: 33 checks total. Reader legs (Task 1): hash shape/determinism/distinctness, fresh-entry force, stale-entry ignore, flag:false/unknown/bad-hash ignore, malformed/missing/entries-not-array/non-string degrade, registry-override staleness, one-read-per-process (verified by wrapping `fs.readFileSync` with a call counter). Integration legs (Task 2): R5(a) a fresh flag:true entry on the autonomous_safe `/mos:find-analogies` halts `runChain` there with `haltedAt.reason === 'forced_material'` and zero steps dispatched; R5(b) a fresh flag:false entry on `/mos:publish` still halts forced_material (keyword hint reaches it first, proving the seam is reachable without disturbing that outcome); R5(c) a missing or malformed ledger makes `isIrreversibleStep` equal the pre-356 keyword-only predicate for all 113 registry commands, both with and without an explicit `step.irreversible` flag; add-only property (all-flagged-false and all-stale ledgers can never clear a `preRule`-true command); export-surface-unchanged (the seam adds no new export to `chain-executor.cjs`).

## Task Commits

Each task was committed atomically:

1. **Task 1: Baselines, commandRow accessor, lib/core/irreversibility-ledger.cjs, and the reader unit legs** - `9a8e1d030` (feat)
2. **Task 2: The add-only seam in isIrreversibleStep, the single documented re-pin (D-17), and runChain integration legs** - `60363b9b1` (feat)

**Plan metadata:** (this commit, following SUMMARY.md creation)

## Files Created/Modified
- `lib/core/irreversibility-ledger.cjs` - new: pure, network-free, once-per-process ledger reader
- `lib/workflow/command-resolver.cjs` - additive `commandRow(cmd)` accessor
- `lib/core/chain-executor.cjs` - lazy loader, helper, one changed return line inside `isIrreversibleStep`
- `tests/test-264-b3-frozen.cjs` - `isIrreversibleStep` hash re-pinned (D-17), other five pins unchanged
- `tests/test-356-runtime.cjs` - new: 33 checks, reader legs + runChain integration legs

## Decisions Made
- `commandRow`'s diff against `lib/workflow/command-resolver.cjs` came in at 0 removed lines (plan allowed up to 1); purely additive.
- The export-surface-unchanged leg's expected-exports constant was built by reading the actual `Object.keys(require('./lib/core/chain-executor.cjs')).sort()` output at HEAD before my edit (8 names, including `BEHAVIORAL_CHANNEL_ARMED` from Phase 177 Wave 5, which the plan's own illustrative list did not name) rather than copying the plan's example list verbatim, so the leg proves the TRUE pre-356 surface is unchanged.
- Task 1 and Task 2 built `tests/test-356-runtime.cjs` as one file in two passes (reader legs committed first, integration legs appended and committed second), matching the plan's own task boundary ("Task 2 appends the integration legs").

## Deviations from Plan

None - plan executed exactly as written. All artifacts, legs, and acceptance criteria match the plan's `must_haves` and per-task `acceptance_criteria` blocks, including the exact single-line diff in `isIrreversibleStep`, the exact single-hash re-pin in `tests/test-264-b3-frozen.cjs`, and the tripwire/em-dash/export-surface checks.

## Issues Encountered
None. No peer session touched `lib/core/chain-executor.cjs`, `lib/workflow/command-resolver.cjs`, or `tests/test-264-b3-frozen.cjs` during this plan's execution (`git status --short` was clean immediately before each edit, and `git log -3` for `chain-executor.cjs` showed no new commits between the two tasks).

## User Setup Required
None - no external service configuration required.

## Known Stubs
None. Both new/modified production files are complete, runnable, non-placeholder implementations. `data/command-irreversibility-ledger.json` (the shipped ledger itself) does not exist yet by design -- this plan proves the reader degrades silently to the pre-356 predicate when it is absent (SPEC R6); a later 356 plan (356-07 onward) builds and ships it.

## Threat Flags

None beyond what the plan's own `threat_model` already names (T-356-08, T-356-09, T-356-10, T-356-11, T-356-02, T-356-SC), all mitigated as specified: the ledger clause is the final return reached only after the two older signals (T-356-08); per-entry `text_hash` compared against the CURRENT registry row via `commandRow` (T-356-09); lazy require + try/catch degrade to false on any failure (T-356-10); exactly one hash literal changed in `tests/test-264-b3-frozen.cjs` with a written reason, the other five verified unchanged in the commit diff (T-356-11); the new module requires only node built-ins and the resolver, zero fetch/http/jev/typesafe tokens (T-356-02); zero package installs (T-356-SC).

## Next Phase Readiness
- The runtime seam is live and silent (no shipped ledger exists yet): every chain suite, `run-all-166.sh`, `run-all-264.sh`, and `run-all-356.sh` match their pre-356 baselines exactly.
- `lib/core/irreversibility-ledger.cjs`'s exports (`DEFAULT_LEDGER_PATH`, `TEXT_HASH_BASIS`, `commandTextHash`, `forcesIrreversible`, `__reset`) are ready for the builder plan (356-07 onward) to import `commandTextHash` directly and for the shipped-ledger legs in `tests/test-356-tripwires.cjs` leg C / `tests/test-356-larry-contract.cjs` leg 5 to flip from PENDING once `data/command-irreversibility-ledger.json` lands.
- `tests/test-264-b3-frozen.cjs` now documents its own first re-pin; any future edit to `isIrreversibleStep` (there should not be one inside this phase) would need the same D-17-style treatment.
- No blockers for 356-04 through 356-13.

## Self-Check: PASSED

- FOUND: lib/core/irreversibility-ledger.cjs
- FOUND: lib/workflow/command-resolver.cjs
- FOUND: lib/core/chain-executor.cjs
- FOUND: tests/test-264-b3-frozen.cjs
- FOUND: tests/test-356-runtime.cjs
- FOUND: .planning/phases/356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-/356-03-SUMMARY.md
- FOUND commit: 9a8e1d030
- FOUND commit: 60363b9b1
- FOUND commit: 1f9235433

---
*Phase: 356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-*
*Completed: 2026-09-23*

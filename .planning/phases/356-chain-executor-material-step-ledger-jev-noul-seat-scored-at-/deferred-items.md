# Phase 356 Deferred Items

Out-of-scope discoveries and deferred refactors surfaced while executing Phase 356
plans. Not fixed under the current task; logged here per the executor's scope-boundary
discipline.

## 356-02: build-section-command-ledger.cjs refactor DEFERRED

- **Date:** 2026-09-23
- **Found during:** 356-02 Task 2, STEP 2 refactor decision.
- **Git status at decision time:**
  ```
   M scripts/eval-icm-writers.cjs
   M tests/test-353-grader-agreement.cjs
   M tests/test-353-ledger-shape.cjs
  ```
  (`scripts/build-section-command-ledger.cjs` itself was clean.)
- **Reason:** D-18 (356-CONTEXT.md): the uncommitted diffs in
  `scripts/eval-icm-writers.cjs` and `tests/test-353-{grader-agreement,ledger-shape}.cjs`
  are unowned by 356 (jsagi-25, jsagi-d9 and jsagi-e0 each disclaim them per the
  navigator's SPEC interview log). 356 never edits, stashes, or reverts them. Since the
  planned refactor of `build-section-command-ledger.cjs` only touches that file itself,
  the risk is not a direct edit conflict; it is that refactoring the shared exports
  (`loadKey`, `assertEgressCeiling`, `jev`, `pool`) while their consumers carry unreviewed,
  in-flight diffs of unknown shape (per the Pattern 1 table in 356-RESEARCH.md,
  `eval-icm-writers.cjs`'s diff adds a typed Choice payload and a `jevFn` seam) risks
  silently breaking a peer session's uncommitted work with no way to verify parity against
  code that has not landed. This is the same guard jsagi-25 applied to 354-17
  (commit `873363114`): refactor only when all four paths are clean.
- **Scope:** `scripts/build-section-command-ledger.cjs`'s local `loadKey`,
  `EGRESS_ALLOWED_*`, `assertEgressCeiling`, `sleep`, `jev`, `pool` definitions
  (`build-section-command-ledger.cjs:67-172` at HEAD). Not touched by 356-02.
- **Impact on 356-02:** None. `scripts/jev-devtime-client.cjs` was extracted and proven
  parity-equivalent to the pre-extraction guard via `tests/fixtures/356-section-guard-parity.json`
  (16 cases) and `tests/test-356-jev-client.cjs` leg (b), which replays every case against
  BOTH the extracted client and the 353 builder's own untouched `assertEgressCeiling`
  export, proving they agree without requiring the builder itself to change.
- **Recipe to apply later** (once `git status --short -- scripts/eval-icm-writers.cjs
  tests/test-353-grader-agreement.cjs tests/test-353-ledger-shape.cjs
  scripts/build-section-command-ledger.cjs` is clean on all four paths):
  1. Message jsagi-25 and jsagi-e0 first (D-06: the 353 builder is a shared file).
  2. Delete the local `loadKey`, `EGRESS_ALLOWED_*` sets, `assertEgressCeiling`, `sleep`,
     `jev`, `pool` definitions (`build-section-command-ledger.cjs:67-172`).
  3. `const client = require('./jev-devtime-client.cjs');`
  4. `const assertEgressCeiling = client.makeEgressGuard(client.EGRESS_PROFILES.section_command_ledger);`
  5. `function loadKey() { return client.loadKey({ env: process.env, secretsPath: path.join(os.homedir(), '.secrets', 'typesafe.env') }); }`
  6. `function jev(key, body) { return client.jev(body, { key: key, guard: assertEgressCeiling, endpoint: ENDPOINT }); }`
  7. `const pool = client.pool;`
  8. Keep `ENDPOINT` and `MODEL` constants in the builder; `module.exports` names
     unchanged (`loadKey`, `assertEgressCeiling`, `jev`, `pool` re-exported exactly as
     before, so `scripts/eval-icm-writers.cjs` and `tests/test-353-*.cjs` need zero
     changes).
  9. Re-run the four 353 suites with `env -u TYPESAFE_API_KEY` and compare against the
     356-02 Task 1 baselines (`test-353-ledger-shape.cjs` PASS=13 FAIL=6,
     `test-353-grader-agreement.cjs` 30/0, `test-353-release-wiring.cjs` 8/0,
     `test-353-tripwires.cjs` green). If any count differs, restore only this file
     (`git checkout -- scripts/build-section-command-ledger.cjs`, sanctioned because it
     was clean before the refactor edit) and re-defer.

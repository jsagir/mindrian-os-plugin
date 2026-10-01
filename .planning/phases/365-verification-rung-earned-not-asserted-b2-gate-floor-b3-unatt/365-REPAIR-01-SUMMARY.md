# Phase 365 Repair 01: regression block repair Summary

Repairs the prior-phase regressions that 365-09 and 365-11 shipped (hidden because plain `run-all-365.sh` skips the regression block). Code commit: `fd2edfc57`.

## Root causes and fixes

| # | Failing check | Root cause | Verdict | Fix |
|---|---------------|-----------|---------|-----|
| 1 | test-356 leg 3: `'forced_material'` literal at least 2 times in chain-executor.cjs | 365-09 replaced the two inline `isIrreversibleStep(step) ? 'forced_material' : 'gate_halt'` halt-reason expressions with a helper `_haltReasonFor(step)`; the literal then existed once. The pin's intent is that BOTH halt sites name the reason code. | Real invariant, fix CODE | Both haltedAt sites now read `isIrreversibleStep(step) ? 'forced_material' : _haltReasonFor(step)`. Behavior identical; constraint reasons still flow through the helper. Test untouched. |
| 2 | test-356 "existing 264 frozen pins" and test-264-b3-frozen: makeGateFn sha256 | 365-09 added the planned add-only gate statement (1b) inside makeGateFn (CONTEXT D-12, 365-09-PLAN task 1, D-26). The scoped byte pin necessarily changes. | Planned change, re-pin | Re-pinned (precedent: 356 re-pin of isIrreversibleStep). OLD `381924999134538d049cb7f214e5d49016936372c9e8dbb690c83ed23022eaa2`, NEW `c4f8099cb5bb08f993f091aeaf601e238a41e459e2555490be872ed6a60fde62`. Protective intent kept and strengthened: new Arm 1b cuts the (1b) block (from its `// (1b) Phase 365` comment to `// (2) Quality carry`) and asserts the remainder hashes to the OLD pin, so statements (1)..(4) stay byte-identical. The other five pins unchanged. |
| 3 | `build-harness-manifest --check` | data/harness-manifest.json digests chain-executor.cjs; 365-09 edited it without regenerating. | Stale artifact | `node scripts/build-harness-manifest.cjs` (regenerated again after fix 1 touched the file); `--check` prints OK. |
| 4 | test-348 one supersession door (run-all-358 leg) | `lib/core/navigation/verification-signals.cjs` (365-11) contains `COALESCE(review_status, '') NOT IN ('rejected', 'superseded')` in a SELECT filter. The file has no UPDATE/INSERT/DELETE. The scanner matches the literal near the word review_status, so this is a read-side false positive, the same shape as the already allow-listed insights.cjs (348-04). | Scanner false positive, no write outside the door | Added the file to STATUS_SETTER_ALLOW_LIST with a comment. Assertion 3 (hardcoded `UPDATE ... superseded` scan) still runs over it and is green. |
| 5 | run-all-355 / run-all-363 deltas | 355 delta = nested "no-regression: run-all-356.sh" leg (cause 1/2). 363 delta = harness-manifest --check (cause 3). | Same causes | Healed by fixes 1-3. |

## Verification at HEAD fd2edfc57

- `RUN_365_REGRESSIONS=1 bash tests/run-all-365.sh`: `PASSED=62 FAILED=0 SKIPPED=0 KNOWN=7`. Regression block: 354 now 1 / base 1, 355 now 4 / base 4, 356 now 0 / base 0, 358 now 6 / base 6, 363 now 4 / base 4; all PASSED (no leg above base).
- `node scripts/build-harness-manifest.cjs --check`: OK.
- Known pre-existing reds (test-238, 237, 345, 353-filing-gate, 164 canon-version, 129.5-truth-machine, 131-substrate) not touched; KNOWN=7 unchanged and matched.
- No em/en dashes in touched files.

## Hand-off

Later 365 plans that edit chain-executor.cjs must regenerate the harness manifest and keep both `'forced_material'` literals at the haltedAt sites. A further edit to makeGateFn outside the (1b) block will trip Arm 1b by design.

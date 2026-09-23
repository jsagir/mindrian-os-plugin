# 356-12: D-14 Appeal Sheet

appeal gate: not triggered

Date: 2026-09-23

## Basis

- `356-LIVE-BUILD-OUTCOME.json` (from 356-11, commit `20cfdb19a`): `status: "SUCCESS"`, `appeal_gate_tripped: false`, `appeal_items: []`, `chain_run_false_alarms: []`, `chain_run_false_alarms_accepted: []`. Four false alarms shipped flagged (`/mos:mva-brief`, `/mos:mva-report`, `/mos:research`, `/mos:setup`), none in the 31-command chain-run set.
- Per Task 1, every chain suite named in the 356-03 baseline table was re-run today with the shipped ledger (`data/command-irreversibility-ledger.json`) present, `env -u TYPESAFE_API_KEY`, default env (no ledger-path override).

## Suite Results (with shipped ledger present, vs. 356-03 baseline)

| Suite | 356-03 baseline | Today (356-12) | Match |
|---|---|---|---|
| tests/test-larry-handoff-seam.cjs | 0 | 0 | yes |
| tests/test-chain-executor-gate.cjs | 0 | 0 | yes |
| tests/test-chain-executor-loop.cjs | 0 | 0 | yes |
| tests/test-chain-executor-verdict.cjs | 0 | 0 | yes |
| tests/test-chain-executor-fable-mode.cjs | 0 | 0 | yes |
| tests/test-chain-executor-part8-leak.cjs | 0 | 0 | yes |
| tests/test-bch-09-forced-material.cjs | 0 | 0 | yes |
| tests/test-ignite-on-runchain.cjs | 0 | 0 | yes |
| tests/test-201-bounded-retry.cjs | 0 | 0 | yes |
| tests/test-264-flagship-ralph.cjs | 0 | 0 | yes |
| tests/test-354-chain-resume-identity.cjs | 0 | 0 | yes |
| tests/test-act-on-runchain.cjs | 0 | 0 | yes |
| tests/test-pipeline-on-runchain.cjs | 0 | 0 | yes |
| tests/test-harness-167-verdict.cjs | 1 (pre-existing, unrelated: HARN-01/HARN-03 manifest staleness, D-167-06 Part 9 rationale) | 1 (same three checks fail: HARN-01/D-167-01, HARN-03/D-167-05, D-167-06 Part 9) | yes |
| `bash tests/run-all-166.sh` | 1 (expected: 22/23 passed, only `test-act-prebehavior-snapshot.cjs` red, pre-existing) | 1 (22/23 passed, `test-act-prebehavior-snapshot.cjs` red) | yes |
| `bash tests/run-all-264.sh` | 1 (expected: PASS=12 FAIL=2, frozen-166 passthrough + chain-executor.cjs zero-diff arm, both known-red since Phase 264 froze the file at an earlier base commit) | 1 (PASS=12 FAIL=2, same two arms: frozen-166 passthrough, chain-executor.cjs zero-diff arm) | yes |

Every suite matches its 356-03 baseline exactly, including the three pre-existing/out-of-scope reds (`test-harness-167-verdict.cjs`, `run-all-166.sh`'s `test-act-prebehavior-snapshot.cjs`, `run-all-264.sh`'s two frozen-file arms). None of these reds are new, and none touch a chain-run command's autonomous_safe expectation.

## Conclusion

Nothing is red that was not already red before the ledger shipped, and the 356-11 live build did not stop at the appeal gate (`appeal_gate_tripped: false`). Tasks 2 and 3 are skipped per the plan.

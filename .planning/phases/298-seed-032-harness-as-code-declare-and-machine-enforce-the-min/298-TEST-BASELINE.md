# Phase 298 - Pre-Edit Test Baseline

captured_at: 2026-09-08T03:55:46Z
HEAD sha: 0409faf6b550a37264d19e3f138442ac61ab8b90

Captured before any file in this phase was created or edited (`git status --porcelain`
showed only the pre-existing ` M .planning/STATE.md` line the orchestrator recorded at
phase start, unmodified by this task). Twenty named commands, run one at a time from the
repo root, exit code and last lines of stdout recorded verbatim. Nothing was fixed.

## Manifest cluster (6)

| Command | Exit code | Verdict | Note |
|---|---|---|---|
| `node scripts/build-harness-manifest.cjs --check` | 0 | PASS | `harness-manifest: OK` |
| `node tests/test-harness-manifest-check.cjs` | 0 | PASS | 7 passed, 0 failed |
| `node tests/test-harness-manifest-part8-boundary.cjs` | 0 | PASS | 6 passed, 0 failed (6 checks) |
| `node tests/test-201-harness-manifest.cjs` | 0 | PASS | 5 passed, 0 failed |
| `node tests/test-harness-167-verdict.cjs` | 1 | FAIL | VERDICT `{"passed":false,"checks":9,"failed":2}`. Failures: D-167-03 (precommit template does not wire `build-harness-manifest.cjs --check`) and D-167-06 Part 9 (Part 9 N/A rationale is false; `build-new-surface.cjs` DOES write `review_status: confirmed`) |
| `node tests/test-harness-manifest-precommit-wiring.cjs` | 1 | FAIL | 1 passed, 5 failed. All 5 failing checks trace to one root cause: `scripts/install-pre-commit.sh` byte-copies `scripts/hooks/pre-commit-room-minto-guard.sh` (Phase 235-01) and authors no hook content of its own, so the test's hardcoded `TEMPLATE_PATH` target carries none of the manifest-guard lines the test looks for |

## Persona cluster (10)

| Command | Exit code | Verdict | Note |
|---|---|---|---|
| `node lib/mcp/no-instructions.test.cjs` | 0 | PASS | 9 passed, 0 failed (budget 1944/2048, frozen paragraph intact) |
| `node tests/test-143.2-doctrine-presence.cjs` | 0 | PASS | 16 requirements green |
| `node tests/test-larry-handoff-seam.cjs` | 0 | PASS | 6/6 (stdout also carries harmless `node:sqlite` experimental-feature warnings) |
| `node tests/test-canon-entry-38-sourced-claims-floor.cjs` | 0 | PASS | 58 assertions |
| `node tests/test-gate-native-fire-w1.cjs` | 0 | PASS | 12 assertions |
| `node tests/test-chain-executor-part8-leak.cjs` | 0 | PASS | zero Part 8 leak tokens across 10 Phase-166 surfaces |
| `bash tests/test-115-persona-variants.sh` | 0 | PASS | 7/7 |
| `bash tests/test-114-substrate-preload.sh` | 0 | PASS | ALL CHECKS PASSED (stdout also carries a harmless `claude plugin validate --plugin-dir` unsupported-subcommand note the script itself treats as non-fatal) |
| `node tests/test-205-elevation-doctrine-floor.cjs` | 0 | PASS | 45 assertions -- see Divergence section below |
| `bash tests/test-115-surfaces-grep.sh` | 1 | FAIL | Assertion 3: `'**For founders stuck on a decision they can't name.**'` missing from README.md |

## Gate cluster (4)

| Command | Exit code | Verdict | Note |
|---|---|---|---|
| `node scripts/check-hook-schema-compatibility.cjs` | 0 | PASS | scanned 15 Stop-hook-reachable files, no Stop-shaped `hookSpecificOutput` found |
| `node tests/test-doctor-acceptance-self-coverage.cjs` | 0 | PASS | 6 passed, 0 failed |
| `node tests/test-209-declared-implies-wired.cjs` | 1 | FAIL | `AssertionError [ERR_ASSERTION]` on the `KNOWN_CONTRADICTION_SURFACES` deepStrictEqual (a live skill-list drift, e.g. `skill:mullins-scaffold`, `skill:mva-pipeline`, `skills/stance/SKILL.md`, etc., against the pinned pre-existing set). Test's own message: this `--check` run is ADVISORY (WARN, exit 0) per Phase 210 and does not block CI, but a genuine regression in this pinned set still fails this test |
| `node tests/test-connector-exhaustive-coverage.cjs` | 1 | FAIL | 3 passed, 3 failed. CHECK 5: `wired (209) + allowlisted (61) !== live (253)` (270 != 253, registry-wide identity broken); CHECK 4 (larry-extended, the phase-relevant surface) passes |

## Expected red at HEAD (do not attribute to Phase 298)

Five tests exited non-zero at HEAD, for reasons that predate this phase:

- `test-harness-manifest-precommit-wiring.cjs` -- Phase 235-01 rewrote `install-pre-commit.sh`
  to byte-copy `scripts/hooks/pre-commit-room-minto-guard.sh` rather than author its own hook
  content; the test still asserts against the old `install-pre-commit.sh` content shape.
- `test-harness-167-verdict.cjs` -- same root cause for its D-167-03 check, plus a separate,
  older D-167-06 Part 9 finding: `build-new-surface.cjs` writes `review_status: confirmed`,
  which the test's own pinned "N/A rationale" claims does not happen.
- `test-209-declared-implies-wired.cjs` -- `KNOWN_CONTRADICTION_SURFACES` (an advisory,
  Phase-210 WARN-level pinned list) has drifted against the live skill/agent surface set;
  advisory by design, but this test hard-fails on any drift in the pinned list.
- `test-connector-exhaustive-coverage.cjs` -- registry-wide `wired + allowlisted === live`
  identity is broken (209 + 61 = 270 vs live 253); the phase-relevant CHECK 4
  (larry-extended surface) passes. 3 of 6 checks fail.
- `test-115-surfaces-grep.sh` -- README.md assertion 3, a pinned founder-facing phrase, is
  missing from README.md.

## Divergence from research

`298-RESEARCH.md` predicted six pre-existing red tests, naming
`test-205-elevation-doctrine-floor.cjs` as failing because the canon header carried version
1.27 against a pinned `/Version:\s*1\.24/` regex. Observed at this baseline capture,
`test-205-elevation-doctrine-floor.cjs` PASSES (45/45 assertions, including the version/entry
check, which now reads "v1.27 + entry 34" in its own pass message). The pinned regex (or the
canon header, or both) moved into agreement between the research pass and this capture,
narrowing the pre-existing red set from six to five. The remaining five named above match the
research's other five predictions exactly (same tests, same root causes).

**Provable "no new failures" baseline for phase close:** the five-test set above
(`test-harness-manifest-precommit-wiring.cjs`, `test-harness-167-verdict.cjs`,
`test-209-declared-implies-wired.cjs`, `test-connector-exhaustive-coverage.cjs`,
`test-115-surfaces-grep.sh`). A phase-close rerun of these same 20 commands is expected to
reproduce exactly these five failures and no others; any new failure is a Phase 298 regression,
and `test-205-elevation-doctrine-floor.cjs` staying green is part of the "unchanged" contract
too.

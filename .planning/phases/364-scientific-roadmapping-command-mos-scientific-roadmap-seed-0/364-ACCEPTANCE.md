# Phase 364 Acceptance (Plan 364-11)

Date: 2026-10-03. Author: the 364-11 executor. PLAN_BASE (HEAD when the gate started): `e8c9ea87bba7ed677f0ee4993d30dc41518df5bf`.
HEAD moved to `463559e1f` (a peer Phase 369 commit) during the run; no 364 file changed in between.

All runs used `HOME` and `MINDRIAN_ROOMS_HOME` set to scratch sandboxes (never the real HOME). The only live egress
in the phase, the opt-in Theo smoke, has NOT run (it waits for the navigator, see "Live smoke").

## Verdict

- Phase 364 own gate: **GREEN**. `bash tests/run-all-364.sh` exit 0, `PASSED=61 FAILED=0 SKIPPED=1 KNOWN=3`.
  The one skip is the opt-in live smoke; the three KNOWN are the pre-existing reds matched by literal signature.
- Generator gates: **all exit 0**.
- Doctor `--acceptance`: **no failing point names a 364 file**; all six failing points are ENV (sandboxed HOME or peer dirt).
- Regression legs: run-all-366 clean. run-all-363 showed **one NEW FAILURE caused by 364-02** (see "NEW FAILURE"); the navigator
  ruled a fix (commit `f53f346eb`), now **RESOLVED**, so SRM364-01..19 were closed (REQUIREMENTS.md).
- Live smoke: **PASSED, one run (2026-10-03)**, navigator-approved; Theo's real answer today is the honest refusal. See "Live smoke".

## Phase aggregator

| Command | Final line | Exit |
|---------|-----------|------|
| `bash tests/run-all-364.sh` | `PASSED=61 FAILED=0 SKIPPED=1 KNOWN=3` | 0 |
| `node tests/test-276-tool-honesty-findings-closed.cjs` | `148 passed, 0 failed` (no re-freeze needed; the 276 dispositions fixture from 011baa7e5 still matches after 364-14) | 0 |
| `node tests/test-198-local-only.test.cjs` | `PASS ... 20 of 20 198 modules present, zero Brain-egress token` | 0 |

The three KNOWN reds in run-all-364 (all pre-existing, none caused by 364): framework command ledger and section command
ledger (`plugin_version drift`), connector part8 boundary (`connector mcp:artifact_file carries off-schema field "layer"`).

## Generator gates

| Command | Final line | Exit |
|---------|-----------|------|
| `build-command-registry --check` | `command-registry: OK` | 0 |
| `build-connector-registry --check` | clean (only the Node ExperimentalWarning on stderr) | 0 |
| `build-harness-manifest --check` | `harness-manifest: OK` | 0 |
| `build-orchestration-projection --check` | `orchestration-projection: OK` | 0 |
| `build-render-coverage --check` | `render-coverage-registry: OK` | 0 |
| `build-skill-mirrors --check` | `OK (113 mirrors match expected content ...)` | 0 |
| `check-render-coverage` | `198 wired, 2 excluded, 0 unwired (200 declaring commands)` | 0 |
| `check-help-coverage` | `valid: true` | 0 |
| `refresh-framework-names --check` | `data/framework-names.json OK (414 names, hash verified)` | 0 |
| `build-new-surface --check --kind command --name scientific-roadmap` | `new-surface: OK` | 0 |
| `check-cirs-declaration --check` over 364-01..14 plans | `check-cirs-declaration: OK (14 plan(s))` | 0 |
| `check-shape-declaration --check` | advisory WARN list; lines naming `scientific-roadmap`: **0** | n/a |

## Doctor `--acceptance`

`Acceptance full: 16/22 points passed; failed: install-state, deployment-surfaces, version-of-record-published,
session-start-active-version, verify-release-clean-tree, activation-reached-the-wire.` Exit 1.

| Failing point | Reason as printed | Class |
|---------------|-------------------|-------|
| install-state | install-state record absent (sandboxed HOME has no install state) | ENV |
| deployment-surfaces | 3 surfaces drifted (sandboxed HOME has no installed surfaces) | ENV |
| version-of-record-published | `marketplace.json` unreadable under the sandboxed HOME | ENV |
| session-start-active-version | `installed_plugins.json` absent under the sandboxed HOME | ENV |
| verify-release-clean-tree | tracked-file drift, 4 files: peer-owned dirt in the shared tree (`git status` shows modified Phase 289 CONTEXT and VALIDATION and `ui/bakeoff/measure.cjs`; the doctor counted 4 at its moment of reading); no 364 file is dirty | ENV (peer dirt, the 363-22 precedent) |
| activation-reached-the-wire | L4 MCP handshake `skipped-prior-layer-failed` (follows install-state) | ENV |

`coverage-gate`, `harness-policies`, `doctor-all`, `frontmatter-yaml-validity`, `release-dry-run-output`,
`mcp-surface-tool-count` and the rest PASS. No failing point names a 364 file or a check 364 touched.

## Regression comparison

### run-all-366: no new failure

`bash tests/run-all-366.sh`: `PASSED=69 FAILED=0 SKIPPED=1 KNOWN=1`, exit 0 (the one KNOWN is `pin 355 direction agreement`).

### run-all-363: `PASSED=45 FAILED=4 SKIPPED=1 KNOWN=4`, exit 1

Each FAILED leg compared with its recorded signature and attributed by running the same test at a baseline checkout
(`git worktree` at the parent of 364-01 `cce8abbbe`, and at `1c3070dc9^` / `1c3070dc9`; the scratch worktree was removed).

| Leg | Now | Recorded | RCA classification |
|-----|-----|----------|--------------------|
| run-all-221 | `PASS=12 FAIL=2` | `PASS=11 FAIL=3` | known bug, improved by one; signature stale in run-all-363.sh |
| run-all-361 | `PASSED=26 FAILED=3` | `PASSED=27 FAILED=2` | extra red is `test-fileval-readback.cjs` ("database is not open"). Passes at `1c3070dc9^`, fails at `1c3070dc9` (peer 369-06, "owns idiom at the eight unconditional-BEGIN writer sites"). Not 364: **known bug, owned by Phase 369** |
| run-all-3551 | `PASS=62 FAIL=6` | `PASS=63 FAIL=5` | the extra red is `test-355-hit-rate-record.cjs`: **NEW FAILURE caused by 364-02** (see below). The other five fail identically at the 364 baseline |
| no new dependency (package.json + shrinkwrap vs fixture) | FAILED | pass | peer Phase 369 moved `@modelcontextprotocol` deps (ext-apps ^2.0.3, node ^2.1.0). Not 364: **ENV, peer-owned** |

## NEW FAILURE (caused by 364-02): `tests/test-355-hit-rate-record.cjs`

- **Symptom:** `FAIL: the stored record equals the record recomputed from the raw files` and
  `measure-355-hit-rate --check: tests/fixtures/355-rooms/hit-rate-record.json differs from the record recomputed from the raw judgments, stamps and capture`.
- **Root cause:** `scripts/measure-355-hit-rate.cjs` hashes `data/framework-names.json` into the stored record
  (`inputs.name_snapshot_source_sha256`, `name_snapshot_date`, D-51). Plan 364-02 refreshed that snapshot through
  `refresh-framework-names.cjs --live` after the navigator reviewed the diff (NV-3), so the recomputed hash no longer matches the
  committed record.
- **Proof of attribution:** passes at `cce8abbbe` (364 baseline, exit 0); the same baseline checkout with only HEAD's
  `data/framework-names.json` copied in fails (exit 1); restoring the baseline file passes again.
- **Why it was missed:** the 364-02 SUMMARY's 18-reader baseline did not list the Phase 355 hit-rate record test, and no run-all-364 leg covers it.
- **Disposition: RESOLVED on the navigator's ruling.** `node scripts/measure-355-hit-rate.cjs record` regenerated the record; the diff moved only
  `inputs.name_snapshot_date` (2026-09-23 to 2026-10-02) and `inputs.name_snapshot_source_sha256`; no rate, count or other input moved. The command also
  rewrote the one line of the `355-VERIFICATION.md` hit-rate section that renders those two values (the test requires the section to be the record's rendering),
  committed in the same `--only` commit `f53f346eb`. After: `node tests/test-355-hit-rate-record.cjs` PASS 93 FAIL 0, `measure-355-hit-rate --check` exit 0.

## Live smoke

Run once on 2026-10-03 after the navigator replied "run live smoke": `MOS_364_LIVE=1 node tests/test-364-live-smoke.cjs`
with the real HOME (Brain token) and a scratch `MINDRIAN_ROOMS_HOME`. Two read-only calls through the guarded brain-client:
`framework_step {framework: "Scientific Roadmapping"}` and `recommend_chain` for `WellDefined` (limit 6). No room content crossed.

Exit 0, PASS 4, FAIL 0. Verbatim:

```
LIVE_METRICS {"step_latency_ms":3224,"coverage_latency_ms":1731,"step_ok":false,"step_reason":"step_unauthored","step_count":0,"framework_status":null,"coverage_status":"uncovered","coverage_reason":null}
```

Reading: Theo's real answer today is the honest refusal (the steps are still unauthored, `step_count` 0), so `/mos:scientific-roadmap` refuses with
"Theo has not authored this step yet" and offers `/mos:research`. Coverage for WellDefined reads `uncovered`. The real guard classified both handles as
`known_tool_shape`. Not an ENV GAP (Brain reachable, keyed). When Theo Phase 25 authors the seven steps, re-run it (follow-on A6).

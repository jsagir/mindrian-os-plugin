---
phase: 318-seed-061-skillopt-smoke-calibration-reconciliation
verified: 2026-09-08T19:48:02Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 0
---

# Phase 318: SEED-061 Skill-Optimization Smoke Calibration Reconciliation Verification Report

**Phase Goal:** Fix SEED-061's disclosed null-negative labeling bug in the skill-optimization funnel harness via a deterministic, exact-match reconciliation pass in `scripts/skillopt-funnel.cjs` (SEED-061 step 1 of 4 only; steps 2-4 explicitly deferred).
**Verified:** 2026-09-08T19:48:02Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A `should_not_trigger` query labeled `expected_skill: null` is corrected to a real skill name when its normalized text exactly matches a `should_trigger` query owned by a different skill anywhere in the full roster | VERIFIED | Live node call: `reconcileNullNegatives` on a hand-built cross-skill pair returns `expected_skill:'A'` and one correction row. `runSelftest` Case A/H and the standalone test's Leg 2 (collision corpus lands `pass`) reproduce this end to end. |
| 2 | A null-labeled negative with no exact cross-roster match keeps `expected_skill: null`, and a near-miss wording never gets corrected | VERIFIED | `runSelftest` Cases B and D pass; Case D asserts the REAL Phase 230 near-miss pair ("what's the status of my room" vs "show me the current status of my room") stays null — confirmed live via `--reconcile-audit`, which lists this exact pair under `jtbd` in the 23 residual nulls. |
| 3 | An already-labeled negative (non-null `expected_skill`) is never touched by the reconciliation pass | VERIFIED | `runSelftest` Case C (byte-identical passthrough) and the rule-table code read directly from `scripts/skillopt-funnel.cjs`: `if (item.expected_skill != null) { outItems.push(item); continue; }`. |
| 4 | The corrected label reaches `classifySkills`, so the flag rule stops counting a correct cross-roster routing as a train miss | VERIFIED | Standalone test Leg 1 runs `classifySkills` directly on stale-null vs reconciled units: `flagged`/`train_miss_count:1` vs `pass`/`train_miss_count:0`. Leg 2's A/B (`queries-nocollision` -> flagged, `queries` -> pass) confirms it through the full `runFunnel` path. Both legs pass live. |
| 5 | The reconciliation sees the FULL roster even when the funnel run is narrowed with `--skills` | VERIFIED | Code read: `runFunnel` calls `enumerateQueries(queriesDir, null)` (unfiltered) before building the index, filters `scopedItems` afterward, and reconciles against the full index (`scripts/skillopt-funnel.cjs:468-471`). `runSelftest` Case H asserts a `--skills`-scoped run still corrects against a foreign positive. Passes live. |
| 6 | Nothing in this phase spawns a model, a subprocess, or a network call, and nothing rewrites the on-disk `queries/*.json` files | VERIFIED | Live source-text grep of the three exported functions combined: no match for `spawnSync|spawnImpl|child_process|execSync|execFile|fetch\(|readFileSync|writeFileSync`. Standalone test Leg 3 asserts byte-identity of all `tests/fixtures/318/` files before/after two independent `runFunnel` invocations — reproduced independently by this verifier (md5sum before/after two runs, identical). |
| 7 | A human can read the corrected/uncorrected/ambiguous counts for any query corpus without spending a single judge call | VERIFIED | `node scripts/skillopt-funnel.cjs --reconcile-audit --out <230-out-dir>` run live, exits 0, prints `total=105 ... corrected=0 ambiguous=0 residual_null=23` plus the 23 residual rows, spawns nothing. Missing-corpus path independently verified: exits 2 with `reason=no_items_found`. |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/skillopt-funnel.cjs` | `normalizeQueryText`, `buildPositiveIndex`, `reconcileNullNegatives`, `runFunnel` wiring, resume-path label force, `--reconcile-audit`, extended `runSelftest` | VERIFIED | All three functions present, exported (`module.exports` includes them, confirmed by live `require()`), arity 2 on `reconcileNullNegatives`. `runSelftest` names all 9 reconciliation cases in its final `OK` line, reproduced live. |
| `tests/test-skillopt-null-negative-reconciliation-318.cjs` | End-to-end A/B proof + opportunistic real-corpus audit leg | VERIFIED | 96+ lines (well above `min_lines: 80`), 5 legs, all pass live: `5 passed, 0 failed`. |
| `tests/fixtures/318/queries` (+ `queries-nocollision`) | Tracked Phase-230-shape fixture with a collision + near-miss control | VERIFIED | `git ls-files` confirms all 6 files tracked. All 6 validate against `EvalQuerySetSchema` (4+ queries each, live schema check). |
| `tests/run-all-230.sh` | New `run_if` leg naming the 318 test | VERIFIED | `grep -c "test-skillopt-null-negative-reconciliation-318.cjs"` finds it; live run shows the `318 skillopt-funnel: null-negative reconciliation proving case (SEED-061 step 1)` leg immediately after `230-02b funnel`, `PASSED`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `scripts/skillopt-funnel.cjs runFunnel` | `reconcileNullNegatives` | roster-wide enumerate -> index -> scope-filter -> reconcile, before any judge spawn | WIRED | Code read confirms exact order at lines 461-471; `enumerateQueries(queriesDir, null)` runs before `skillsFilter` is applied. |
| `reconcileNullNegatives corrected item.expected_skill` | `classifySkills train_miss_count` | `judgeOneQuery` forces the item label onto the verdict; resume path forces it too | WIRED | Fresh-judge path: pre-existing force at judgeOneQuery. Resume path: new code at `onSettle`'s `res.resumed` branch (lines 524-536) forces `res.item.expected_skill` onto the resumed verdict in memory, never touching the persisted unit JSON — confirmed by Case I's disk byte-identity assertion, and by this verifier's independent fixture-file hash comparison. |
| `tests/run-all-230.sh` | `tests/test-skillopt-null-negative-reconciliation-318.cjs` | `run_if` leg | WIRED | Live `bash tests/run-all-230.sh` output shows the leg executing and `PASSED`. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SEED-061-STEP-1 | 318-01-PLAN.md | Deterministic null-negative reconciliation fix (harness bug), step 1 of 4 only | SATISFIED | All must-haves verified above; fix confirmed live in `scripts/skillopt-funnel.cjs`, zero diff on `scripts/skillopt-genqueries.cjs` across the phase's commit range. |

### Anti-Patterns Found

None. Zero `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` markers in any file this phase touched. Zero em-dash/en-dash characters (`grep -cP '\x{2014}|\x{2013}'`) in any touched file. No stub returns, no hardcoded empty data feeding the reconciliation output.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Funnel selftest names all 9 reconciliation cases | `node scripts/skillopt-funnel.cjs --selftest` | Exit 0; summary line names exact match, no-match, already-labeled, near-miss immunity, self-skill immunity, ambiguity, purity, `--skills` full-roster visibility, resume-path correctness | PASS |
| `skillopt-genqueries.cjs` fix-site decision held in code (D-01) | `git diff --stat HEAD~10 HEAD -- scripts/skillopt-genqueries.cjs` | Empty output | PASS |
| Standalone proving-case test | `node tests/test-skillopt-null-negative-reconciliation-318.cjs` | Exit 0, `5 passed, 0 failed`, real-corpus audit line matches SUMMARY exactly (`total=105 null_negatives=23 corrected=0 ambiguous=0 residual_null=23`) | PASS |
| Phase 230 harness gate | `bash tests/run-all-230.sh` | `PASS=8 FAIL=2 SKIP=0`; new 318 leg present and PASSED; the 2 failures (`230-01b inventory: --check reports 124 skills` — roster drift 124->126, `230-06b eval: smoke-replay` — 30.0% agreement) confirmed identical to what `230-07-CALIBRATION.md` (lines 55-72) already discloses, not new regressions | PASS |
| Purity of the 3 new functions | live `node -e` combined-source regex check | No match for `spawnSync\|spawnImpl\|child_process\|execSync\|execFile\|fetch(\|readFileSync\|writeFileSync` | PASS |
| Fixture byte-identity across repeated runs | `md5sum` before/after 2 independent test runs | Identical hashes | PASS |
| `--reconcile-audit` on missing corpus | `node scripts/skillopt-funnel.cjs --reconcile-audit --out <empty-dir>` | Exit 2, `FATAL ... reason=no_items_found` | PASS |
| `--reconcile-audit` on real Phase 230 corpus | `node scripts/skillopt-funnel.cjs --reconcile-audit --out .planning/phases/230-.../out` | Exit 0, `corrected=0 ambiguous=0 residual_null=23`, matches SUMMARY's disclosed 0-of-23 number exactly | PASS |
| `build-connector-registry.cjs --check` regression guard | `node scripts/build-connector-registry.cjs --check` | `connector-registry: OK`, exit 0 | PASS |
| No forbidden token in new test file | `grep -n "spawnSync\|child_process\|fetch(" tests/test-skillopt-null-negative-reconciliation-318.cjs` | No matches | PASS |
| `git status --porcelain` untouched-files gate | `git status --porcelain` | Clean; no drift on `smoke-labels.json`, `scripts/skillopt-eval.cjs`, or `.planning/phases/230-*/out/` | PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention applies to this phase; this is a test-harness fix verified via its own standalone test file and the `run-all-230.sh` aggregator, both run live above. N/A.

### Human Verification Required

None. This phase has zero UI surface and zero navigator-facing conversational render — pure backend test-harness logic, fully verifiable via direct function calls, live CLI invocation, and the existing test suites. All 7 must-have truths and all key links were independently re-derived by this verifier against the running code, not accepted from SUMMARY.md text.

### Gaps Summary

None. Every claim in SUMMARY.md was independently reproduced: the selftest passes and names all 9 cases, the standalone test's 5 legs pass with the same live `--reconcile-audit` numbers (0 corrected of 23 residual nulls on the real Phase 230 corpus), `skillopt-genqueries.cjs` has zero diff across the phase's commit range, `tests/run-all-230.sh` reports `PASS=8 FAIL=2 SKIP=0` with the new 318 leg present and passing, and the two pre-existing failures match `230-07-CALIBRATION.md`'s already-disclosed numbers verbatim (30.0% smoke-replay agreement; 124-vs-126 skill roster drift). Fixture byte-identity across repeated test runs was independently reproduced via md5sum, not merely asserted by the test itself. The resume-path fix (Finding 5) is present in code exactly as described, scoped to memory only, never touching persisted unit JSON. SEED-061 steps 2-4 remain explicitly and correctly deferred, with no scope creep detected.

---

_Verified: 2026-09-08T19:48:02Z_
_Verifier: Claude (gsd-verifier)_

---
phase: 264
slug: roadmap-type-selector-challenge-driven-act-chain-orchestrati
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-23
verified: 2026-08-23
---

# Phase 264 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None. Plain `node` scripts with `node:assert/strict` and hand-rolled `ok()` counters -- the house pattern used by `test-201-bounded-retry.cjs`, `test-245-priority-complete.cjs`, `test-dispatch-framework-map-drift.cjs`, `test-show-share-sensor.cjs`. |
| **Config file** | none |
| **Quick run command** | `node tests/test-264-<name>.cjs` (a single suite, sub-second) |
| **Full suite command** | `bash tests/run-all-264.sh` |
| **Estimated runtime** | ~10 seconds (mostly `run-all-166.sh` embedded as a regression gate) |

---

## Sampling Rate

- **After every task commit:** Run the single relevant `node tests/test-264-*.cjs` (sub-second), plus `node scripts/build-connector-registry.cjs --check` whenever the 3-array sensor lockstep is touched.
- **After every plan wave:** Run `bash tests/run-all-264.sh` (includes the embedded `run-all-166.sh` regression gate).
- **Before `/gsd-verify-work`:** Full suite must be green, plus `node scripts/doctor.cjs --acceptance`.
- **Max feedback latency:** ~10 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 264-01-01 | 264-03 | 1 | R1 | V5 | >=12 fixture utterances classify correctly (2/type + 2 true negatives + 1 near-miss) | unit | `node tests/test-264-roadmap-type-sensor.cjs` | ✅ | ✅ green |
| 264-01-02 | 264-03 | 1 | R1 | V5 | `evidence` is flat scalars only (Part-8 shape) | unit | same file (mirror `test-show-share-sensor.cjs:58-67`) | ✅ | ✅ green |
| 264-01-03 | 264-03 | 1 | R1 | V5 | Sensor registered in `SENSOR_REGISTRY`, exported, returns a non-thenable (sync contract) | unit | same file | ✅ | ✅ green |
| 264-01-04 | 264-03 | 1 | R1 | V4 | 3-array lockstep holds (`SENSOR_REGISTRY`/`SENSOR_REGISTRY_IDS`/`SENS_PRIORITY`) | integration | `node tests/test-245-priority-complete.cjs` | ✅ | ✅ green |
| 264-01-05 | 264-01/03 | 1 | R1 | V4 | Born-wired build gate | integration | `node scripts/build-connector-registry.cjs --check` | ✅ | ✅ green |
| 264-01-06 | 264-03 | 1 | R1 | - | No routing_source flip, no navigation-engine require | fence | `node tests/test-sensors-routing-fence.cjs` | ✅ | ✅ green |
| 264-01-07 | 264-03 | 1 | R1 | V6/Info-Disc | No Brain egress from the sensor directory | fence | `node tests/test-sensors-part8-sweep.cjs` | ✅ | ✅ green |
| 264-02-01 | 264-01 | 1 | R2 | Spoofing | All 6 chains' framework names resolve via `commandsForFramework`, zero dangling | unit | `node tests/test-264-roadmap-type-chains-drift.cjs` | ✅ | ✅ green |
| 264-02-02 | 264-01 | 1 | R2 | Spoofing | No `mos:`-slug leaks into a chain value | unit | same file (dispatch-map template arm 2) | ✅ | ✅ green |
| 264-02-03 | 264-01 | 1 | R2 | - | Exactly six keys besides `_note`; no intra-chain duplicate framework | unit | same file | ✅ | ✅ green |
| 264-02-04 | 264-01 | 1 | R2 | - | `validateChainAutonomy(composeWorkflow(chain)).runnable === true` for all six | unit | same file | ✅ | ✅ green |
| 264-03-01 | 264-05 | 3 | R3 | Tampering | `dispatchSensors` fires the sensor; resolved chain composes with no `command:null` on a required step | integration | `node tests/test-264-sensor-to-chain-resolve.cjs` | ✅ | ✅ green (37/37 assertions) |
| 264-04-01 | 264-02 | 1 | R4 | Repudiation | Critic returns a plain object, never a thenable | unit | `node tests/test-264-salient-critic.cjs` | ✅ | ✅ green |
| 264-04-02 | 264-02 | 1 | R4 | Repudiation | Critic fails a malformed/unparseable RS finding (does NOT silently pass) | unit | same file | ✅ | ✅ green |
| 264-04-03 | 264-02 | 1 | R4 | - | Two-pass unanimity: any disagreement between neutral and adversarial pass fails the candidate | unit | same file | ✅ | ✅ green |
| 264-04-04 | 264-04 | 2 | R4 | DoS | Weak-candidate fixture shows exactly one retry then a passing verdict | integration | `node tests/test-264-flagship-ralph.cjs` | ✅ | ✅ green |
| 264-04-05 | 264-04 | 2 | R4/R5 | DoS | Never-passing fixture halts with `haltedAt.reason==='retry_exhausted'` after exactly cap+1 `onStep` calls | integration | same file | ✅ | ✅ green |
| 264-05-01 | 264-04 | 2 | R5 | V4/EoP | Material step with `ralph_verify` is never retried (B3 intact) | integration | `node tests/test-264-b3-frozen.cjs` | ✅ | ✅ green |
| 264-05-02 | 264-05 | 3 | R5 | - | Non-opted-in step behavior byte-identical | integration | `node tests/test-201-bounded-retry.cjs` | ✅ | ✅ green |
| 264-05-03 | 264-05 | 3 | R5 | - | Phase 166 contract unbroken | regression | `bash tests/run-all-166.sh` | ✅ | ✅ green (23/23) |
| 264-05-04 | 264-05 | 3 | R5 | - | Zero diff inside `chain-executor.cjs`'s gate/stop-condition functions | manual/grep | `git diff --quiet c7c33eea449f6f227c4cfbb86f220acaac9b5ab8 -- lib/core/chain-executor.cjs` | ✅ | ✅ green (whole-file zero-diff, stronger than the function-scoped ask) |
| 264-C01 | 264-05 | 3 | C-01 | - | No em-dashes in any file this phase touches | fence | em-dash arm inside `run-all-264.sh` (clone `run-all-259.sh:96-129`) | ✅ | ✅ green (all 11 targets present, zero em-dashes) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/run-all-264.sh` - the aggregator (built plan 264-01; embeds `run-all-166.sh`, the em-dash sweep, and the `chain-executor.cjs` zero-diff grep arm; `PASS=14 FAIL=0 SKIP=0` at phase close)
- [x] `tests/test-264-roadmap-type-sensor.cjs` - covers R1 (built plan 264-03; filename carries the `264-` prefix per D-04's naming reconciliation, RESEARCH.md F-19)
- [x] `tests/test-264-roadmap-type-chains-drift.cjs` - covers R2 (built plan 264-01)
- [x] `tests/test-264-sensor-to-chain-resolve.cjs` - covers R3 (built plan 264-05, this plan; 37/37 assertions)
- [x] `tests/test-264-salient-critic.cjs` - covers R4 critic unit contract (built plan 264-02)
- [x] `tests/test-264-flagship-ralph.cjs` - covers R4 + R5 execution proof (built plan 264-04)
- [x] `tests/test-264-b3-frozen.cjs` - covers R5 B3 frozen-pin proof (built plan 264-04, additive to the original Wave 0 list)
- [x] Framework install: **none needed** (plain `node`, no test framework) - confirmed, zero packages installed across all 5 plans

Everything else the phase needs to verify already ships: `test-201-bounded-retry.cjs`,
`test-245-priority-complete.cjs`, `test-sensors-routing-fence.cjs`,
`test-sensors-part8-sweep.cjs`, `run-all-166.sh`, `build-connector-registry.cjs --check`.

---

## Manual-Only Verifications

*None - all phase behaviors have automated verification per the map above.*

---

## Security Domain (ASVS L1, `security_enforcement` absent = enabled)

| ASVS category | Applies | Standard control in this repo |
|---------------|---------|-------------------------------|
| V2 Authentication | no | Pure in-process CJS, no auth surface added |
| V3 Session Management | no | `chain.cjs`'s session-keyed gate ledger is read-only context here |
| V4 Access Control | **yes (narrow)** | Canon Part 3 / B3: the chain must halt at the first material step. `_ralphSafeRetry`'s `!_isMaterialStep` guard IS the access-control boundary; Requirement 5 tests it |
| V5 Input Validation | **yes** | `makeReach` is the validating factory (closed reach_id/posture banks, string-only `companions`, scalar-only `evidence`); the RS critic follows the same structural-only-check model as `enforceReviewerGovernance` |
| V6 Cryptography | no (avoid) | `tests/test-sensors-part8-sweep.cjs` forbids unmarked hashing under `lib/core/sensors/` -- do not introduce any |

### Known Threat Patterns

| Pattern | STRIDE | Mitigation |
|---------|--------|------------|
| Content smuggling into the Brain via a reach struct | Information Disclosure | `makeReach`'s scalar-only `evidence` filter + the Part-8 sweep's 3 tripwires |
| Slug spoofing in the chain-table data map | Spoofing | Drift test asserts no chain value starts with `mos:` or contains `/mos:` |
| Autonomy escalation (a material step auto-running) | Elevation of Privilege | ONE autonomy authority (`recipe-maps.cjs::postureForCommand`), fenced by `test-237-one-authority-fence.cjs`; `isIrreversibleStep` is the unconditional first gate check |
| Unbounded self-critique loop burning budget | Denial of Service | `_ralphSafeRetry` bounded twice: `Math.min(cap, budgetRemaining)`, cap default 2 |
| Silent false-success (a critic that passes everything) | Repudiation | The named recurring bug class on this repo's watch list -- plan must assert positively, not just absence-of-error (see RESEARCH.md Pitfalls 1-2) |
| Attacker-influenced `companions` strings | Tampering | The sensor's `companions`/`evidence` must carry only values from the committed chain table, never anything derived from raw turn text |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (7 new test files + 1 aggregator; one extra file, `test-264-b3-frozen.cjs`, beyond the original 6-file estimate)
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** signed off 2026-08-23 - phase closing gate run in full (Task 2 of 264-05):
`bash tests/run-all-264.sh` PASS=14 FAIL=0 SKIP=0 (no `TEST_264_ALLOW_MISSING`, all 11 declared
em-dash targets present); `bash tests/run-all-166.sh` 23/23 green, unmodified since base commit
`c7c33eea449f6f227c4cfbb86f220acaac9b5ab8`; `lib/core/chain-executor.cjs` byte-identical to that
base commit (whole-file `git diff --quiet`); `node scripts/build-connector-registry.cjs --check`
exits 0; em-dash sweep over every touched file: zero hits. `node scripts/doctor.cjs --acceptance`
reports 14/16 (two pre-existing, phase-264-unrelated failures - `install-state` machine-level
legacy-clone drift, `verify-release-clean-tree` two pre-existing tracked-file diffs in
`.planning/config.json` / `261-RESEARCH.md` from this repo's documented multi-session shared
working tree, per CLAUDE.md's own 2026-08-20 handoff note - recorded in full in
`264-05-SUMMARY.md`).

---
phase: 224-graph-derivation-harness-seed-034
verified: 2026-07-15T00:00:00Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 0
---

# Phase 224: Graph-derivation harness (SEED-034) Verification Report

**Phase Goal:** On every debounced write into a room section, the newly-written artifact is
automatically compared against the room's existing artifacts and any INFORMS/CONTRADICTS/
CONVERGES/ENABLES/REFINES relationship found is written as a `proposed` typed edge via
`navigation.cjs::writeEdge` — closing the twice-independently-reconfirmed gap where a room's
typed-edge graph stays at 0 no matter how much content gets filed. A backfill entry point
retroactively wires already-existing rooms (0 → N typed edges).

**Verified:** 2026-07-15
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Full Phase Test Suite

```
$ bash tests/run-all-224.sh
======================================
Phase 224: PASS=17 FAIL=0 SKIP=0
======================================
```

Exit 0. All 17 legs green (8 requirement-proof tests, Part 8 egress sweep, Part 9 chokepoint
sweep, Req 4 dependency-diff, 3 Req 7 structural gates, 3 no-regression legs).

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Req 1 — automatic typed-edge derivation fires on debounced write | VERIFIED | `intelligence-cascade.cjs` Step 2b (lines 344-384) enqueues via `enqueueDerive` and spawns the drain `detached:true, stdio:'ignore'` + `.unref()`; comment at line 347 states "It NEVER scores inline (no scoreMeasured on the write-lock)"; grep confirms zero `scoreMeasured` calls in the cascade module. `node tests/test-224-per-write-derive.cjs` → PASS (11/11): related pair lands ≥1 proposed edge, unrelated pair lands 0, cascade never calls scoreMeasured inline, cascade never awaits the spawned drain. |
| 2 | Req 2 — backfill wires an already-existing room 0→N, idempotent on re-run | VERIFIED | `node tests/test-224-backfill-idempotent.cjs` → PASS (16/16): b2-journey-shaped fixture (210 pairs) goes typedEdgesBefore=0 → typedEdgesAfter=N>0 with every edge `review_status:'proposed'`; second identical run leaves edge count unchanged (Ralph invariant); D-04 encoder-skip path also proven (0 edges written, exactly 1 disclosure marker). `commands/graph.md` line 160/162 documents `/mos:graph --derive` as the HEAL-FIRST backfill surface. |
| 3 | Req 3 — resolver-fallback gap closed, single canonical resolver | VERIFIED | `scripts/gsd-artifact-graph-hook.cjs` line 67 imports `resolveWriteRoom`; line 122 the fallback branch calls `resolveWriteRoom({filePath})` directly — no duplicated `registry.json`/`reg.rooms` read remains (grep confirms zero hits on executable lines). `node tests/test-224-resolver-fallback.cjs` → PASS (6/6). |
| 4 | Req 4 — derived edges are proposals only, no auto-confirm | VERIFIED | `lib/core/navigation/edges.cjs`: `VALID_REVIEW_STATUS` enum (proposed/confirmed only), upsert `WHERE edges.review_status IS NOT 'confirmed'` protects confirmed rows from clobber (WR-06 fix), and a first-insert `'confirmed'` without `byUser` is rejected with `confirmed_requires_by_user` (WR-10 fix). `node tests/test-224-proposed-only.cjs` → PASS (18/18): every derived edge row and claim node reads `review_status:'proposed'`; zero `confirmNode` calls and zero `'confirmed'` promotions across all six phase-224 modules. |
| 5 | Req 5 — zero LOCAL-content egress to Brain from new derivation code | VERIFIED | Manual grep for `fetch\(|https?\.|child_process` across the five derivation surfaces (classifier, migration, drain, sweep, backfill) returns only one hit: `gsd-graph-derive-drain.cjs:387` — `require('node:child_process')` for the drain's own self-respawn-detached pattern (no `curl`/`wget`, no network URL). `tests/run-all-224.sh`'s Part 8 sweep (regex `fetch\(|https?://|require\(['"]node:https?|\b(curl\|wget)\b`) passes clean on all five surfaces. |
| 6 | Req 6 — per-write comparison is O(n), not O(n²) | VERIFIED | `node tests/test-224-cost-bound.cjs` → PASS (3/3): 5 existing artifacts + 1 new write triggers exactly 5 `scoreMeasured()` calls, confirmed not-N² and not-N-choose-2. |
| 7 | Req 7 — structural gates pass for the (existing, not new) `--derive` connector surface | VERIFIED | `node scripts/build-connector-registry.cjs --check` → exit 0 ("connector-registry: OK"). `node scripts/check-shape-declaration.cjs --check` → exit 0 (55 pre-existing advisory WARNs unrelated to Phase 224, not a hard-fail per Phase 210 advisory contract). `node scripts/doctor.cjs --acceptance` → "13/15 points passed; failed: coverage-gate, verify-release-clean-tree" — exactly the documented baseline in 224-04-SUMMARY.md, zero new regressions. |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/core/graph-derive-classifier.cjs` | D-01 score-to-edge-type classifier (CONVERGES/INFORMS only) | VERIFIED | Exists, tested (`test-224-classifier.cjs` 5/5), consumed by drain and backfill as producer swap. |
| `lib/core/migrations/phase-224-edge-review-status.cjs` | Sentinel-idempotent additive migration for `edges.review_status` | VERIFIED | Exists, chained in `room-db.cjs`; `test-224-migration.cjs` 6/6 proves idempotent re-run + legacy-NULL preservation. |
| `lib/core/intelligence-cascade.cjs` Step 2b | Per-write enqueue + detached spawn, no inline scoring | VERIFIED | Lines 344-384; grep confirms no inline `scoreMeasured`, spawn is detached+unref'd. |
| `scripts/gsd-graph-derive-drain.cjs` | Score-based worker, D-04 encoder probe/skip/disclose | VERIFIED | `test-224-encoder-skip.cjs` 11/11; single-flight lock (WR-03 fix) confirmed in source. |
| `lib/core/graph-backfill.cjs` | Score-based default deriver over `buildAllPairs` | VERIFIED | `_localCueDeriveFn` retired as default, `scoreBasedDeriveFn` is default; `test-224-backfill-idempotent.cjs` 16/16. |
| `scripts/gsd-artifact-graph-hook.cjs` | Fallback rides `resolveWriteRoom`, no duplicated registry read | VERIFIED | Line 122; `test-224-resolver-fallback.cjs` 6/6. |
| `lib/core/navigation/edges.cjs` | `writeEdge` review_status param + confirmed-row clobber guard + byUser gate | VERIFIED | WR-06 and WR-10 fixes present in live source (lines 717-766). |
| `tests/run-all-224.sh` | One-command phase gate | VERIFIED | 17 legs, PASS=17 FAIL=0 SKIP=0 on live run. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `scripts/post-write` → `intelligence-cascade.cjs` | per-write derive trigger | shared `_runCascadeSteps` body (CLI/Desktop/Cowork tri-polar) | WIRED | Step 2b fires unconditionally on every markdown write through the one shared cascade body; `enqueueDerive` + detached spawn confirmed in source and by test. |
| `intelligence-cascade.cjs` → `gsd-graph-derive-sweep.cjs::enqueueDerive` | enqueue | direct require + call, line 358-359 | WIRED | Confirmed by grep and by `test-224-per-write-derive.cjs`'s "runCascade enqueued a {roomDir, filePath} entry" assertion. |
| `gsd-graph-derive-drain.cjs` → `graph-derive-classifier.cjs::scoreBasedDeriveFn` | scoring producer swap into `runDerivation` composer | pre-resolved async-to-sync wrapper (Wave-1 hazard fix) | WIRED | `test-224-per-write-derive.cjs` confirms edges actually land via the in-process drain path. |
| `graph-derivation.cjs::runDerivation` → `navigation.cjs::writeEdge` | edge persistence | required at module top, chokepoint discipline | WIRED | Part 9 sweep in `run-all-224.sh` passes; `graph-derivation.cjs` requires `./navigation.cjs`; drain/backfill hold no raw `INSERT INTO edges`. |
| `gsd-artifact-graph-hook.cjs` fallback → `resolve-active-room.cjs::resolveWriteRoom` | resolver delegation | direct call, line 122 | WIRED | `test-224-resolver-fallback.cjs` proves the fallback resolution equals `resolveWriteRoom({filePath}).abs_path`. |
| `commands/graph.md --derive` → `graph-backfill.cjs::runDeriveBackfill` | backfill command surface | documented command body | WIRED | `commands/graph.md` lines 160-164 document the score-based default and the encoder-skip disclosure. |

### Post-Review Fix Spot-Checks (224-REVIEW-FIX.md, 14/14 findings)

| Finding | Claim | Live-Codebase Check | Status |
|---------|-------|---------------------|--------|
| CR-01 | `deriveForPair` throws on a thenable return instead of silently deriving `[]` | `graph-derivation.cjs` lines 190-200: `typeof candidates.then === 'function'` guard throws `Error('runDerivation: deriveFn returned a Promise...')` | VERIFIED |
| CR-02 | Zero `execSync` remains in `intelligence-cascade.cjs`; all child-process calls use argv-array `execFileSync`/`spawn` | `grep -n "execSync\|execFileSync" lib/core/intelligence-cascade.cjs` → zero `execSync(` call sites, 9 `execFileSync(` call sites, import line only destructures `execFile, execFileSync, spawn` | VERIFIED |
| WR-06 | Upsert protects `confirmed` rows from property clobber | `edges.cjs` line 766: `"WHERE edges.review_status IS NOT 'confirmed'"` present in the INSERT...ON CONFLICT statement | VERIFIED |
| WR-10 | `writeEdge` rejects first-insert `'confirmed'` without `byUser` | `edges.cjs` line 747-749: `confirmed_requires_by_user` rejection guard present | VERIFIED |

All 14 review findings were spot-checked at the two Critical items plus the two Warning items
most load-bearing for Req 4 (proposed-only / no-auto-confirm); all four are present in the live
tree, not just claimed in the fix report.

### Requirements Coverage

No entries for Phase 224 exist in `.planning/REQUIREMENTS.md` (this phase's requirement ledger
is `224-SPEC.md`'s 7 locked requirements, verified individually above — not a global
REQUIREMENTS.md cross-reference).

### Anti-Patterns Found

None. Scanned all nine phase-224-modified/created source files for `TBD|FIXME|XXX|TODO|HACK|
PLACEHOLDER` (one substring hit on "JTBD" in a code comment — not a debt marker, false positive)
and for em-dashes (`—`) — zero real hits. No stub returns, no hardcoded empty arrays flowing to
render, no placeholder handlers found in any of the six derivation modules or the two touched
chokepoint files.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full phase gate | `bash tests/run-all-224.sh` | PASS=17 FAIL=0 SKIP=0, exit 0 | PASS |
| Req 1 per-write derive | `node tests/test-224-per-write-derive.cjs` | PASS (11/11) | PASS |
| Req 2 backfill idempotent | `node tests/test-224-backfill-idempotent.cjs` | PASS (16/16) | PASS |
| Req 3 resolver fallback | `node tests/test-224-resolver-fallback.cjs` | PASS (6/6) | PASS |
| Req 4 proposed-only | `node tests/test-224-proposed-only.cjs` | PASS (18/18) | PASS |
| Req 6 cost bound | `node tests/test-224-cost-bound.cjs` | PASS (3/3) — 5 calls for 5 existing artifacts | PASS |
| Req 7 connector registry | `node scripts/build-connector-registry.cjs --check` | exit 0 | PASS |
| Req 7 shape declaration | `node scripts/check-shape-declaration.cjs --check` | exit 0 (advisory WARN, no hard-fail) | PASS |
| Req 7 doctor acceptance | `node scripts/doctor.cjs --acceptance` | 13/15; failed: coverage-gate, verify-release-clean-tree (documented baseline) | PASS |
| Migration idempotency | `node tests/test-224-migration.cjs` | PASS (6/6) | PASS |
| Classifier calibration | `node tests/test-224-classifier.cjs` | PASS (5/5) | PASS |
| Encoder-skip disclosure | `node tests/test-224-encoder-skip.cjs` | PASS (11/11) | PASS |
| Regression: Phase 169 queue contract | `node tests/test-graph-derive-sweep.cjs` | PASS (4/4) | PASS |
| Regression: Phase 222 ranker gate | `bash tests/run-all-222.sh` | PASS=10 FAIL=0 SKIP=0 | PASS |
| Regression: Phase 218 write-safety | `node tests/test-218-write-safety.cjs` | 3/3 passed | PASS |

### Probe Execution

Not applicable — this phase is not a migration/tooling phase with `scripts/*/tests/probe-*.sh`
conventions; its own equivalent aggregate gate (`tests/run-all-224.sh`) was executed directly
above and is the phase's documented one-command acceptance line.

### Human Verification Required

None required for automated goal-verification. Two items are logged in 224-VALIDATION.md as
navigator-queued manual sanity checks (live-room `/mos:graph --derive` plausibility eyeball,
and foreground-latency feel under real hook contention) — these are explicitly deferred to
navigator discretion post-ship in 224-04-SUMMARY.md ("queued for the navigator at verify-work,
not blockers for this plan") and do not block goal achievement, since the cost-bound and
latency-contract behaviors are already proven structurally (Step 2b never awaits the spawn,
detached+unref'd, foreground cost is one JSON write + one spawn call).

### Gaps Summary

None. All 7 SPEC requirements are verified against live, currently-running test suites (not
SUMMARY narration). The full phase aggregate (`bash tests/run-all-224.sh`) exits PASS=17 FAIL=0
SKIP=0 on the actual working tree. The 14 post-review fixes (224-REVIEW-FIX.md) were spot-checked
at the two Critical findings (CR-01, CR-02) plus the two most load-bearing Warning findings for
the Req 4 no-auto-confirm guarantee (WR-06, WR-10); all four are present in the live source, not
merely claimed. `doctor --acceptance` shows no new regressions beyond the pre-existing documented
baseline. Working tree is clean (no uncommitted changes at verification time).

---

*Verified: 2026-07-15*
*Verifier: Claude (gsd-verifier)*

---
phase: 222-reach-ranking-unification-replace-the-three-disagreeing-what
verified: 2026-07-15T05:47:51Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 0
---

# Phase 222: Reach ranking unification -- Verification Report

**Phase Goal:** When more than one reach candidate fires on a turn, `suggest_next`,
`reach_candidates`, and `resolveFireSkill` all resolve to the SAME scored pick -- the
existing D4 blend plus a new hand-rolled, room-local Hedge (multiplicative-weights)
adjustment learned from the Phase 159 outcome log -- with reachability proven via real
MCP registration and real `decide()`, never assumed.

**Verified:** 2026-07-15T05:47:51Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth (Req) | Status | Evidence |
|---|---|---|---|
| 1 | `suggest_next` / `reach_candidates` return the scored pick, not registry order (Req 1) | VERIFIED | `dispatchCandidateReaches` (`lib/mcp/tools/sensors.cjs:97-120`) now calls `reachHedgeRanker.rankFiredCandidates(fired, {roomDir, db})` for >1 fired candidate; `suggest_next`/`reach_candidates` handlers consume the ranked array unmodified (`sensors.cjs:146,157-187`). `tests/test-222-reach-wired.cjs` ARM 4 drives the REAL `sensors.register(fakeServer, ctx)` handlers and asserts the returned order is score-first, not registry-first. Ran live: `PASS test-222-reach-wired.cjs (6 arms)`. |
| 2 | `resolveFireSkill`'s auto-fire uses the same scored pick (Req 2) | VERIFIED | `decide()` (`lib/core/navigation-engine.cjs:930-949`) re-orders `sensorReaches` via `rankFiredCandidates` immediately after dispatch, before `resolveFireSkill(...)` is called (:1056, :1255) or any other `[0]` read. `resolveFireSkill`'s own body (:588-652) is byte-untouched (`git diff 87fb5c37^..HEAD -- lib/core/navigation-engine.cjs` shows only the single :930 insertion; the function itself has zero hunks). ARM 3 in `test-222-reach-wired.cjs` calls the REAL `nav.decide()` and asserts `fire_skill` matches the score-first candidate's shipped verb, not the registry-first one -- ARM 2 (negative arm) proves the fixture's registry-first != score-first so ARM 3 is load-bearing, not vacuous. |
| 3 | A hand-rolled Hedge (multiplicative-weights) layer adjusts the D4 score from real outcomes, room-local (Req 3) | VERIFIED | `lib/workflow/reach-hedge-ranker.cjs` implements `hedgeUpdate` (Arora-Hazan-Kale MWU step), `deriveExpertLosses` (maps `f_selector_decision` rows to per-expert loss), `readHedgeWeights` (injected/db-read with degrade), `maybeUpdateHedgeWeights` (N=50-debounced fold, D-03). `node tests/test-222-hedge-update.cjs` -> PASS (6 checks): pure convergence, held-out argmax, a REAL room.db row-driven fold (50 synthetic `logMemoryEvent` rows), the N-1-vs-N debounce boundary, loss-skip rules, zero-sum guard. Weight state persists only in the room-local `ranker_weights` table (Part 8: no egress, confirmed by the Part 8 harness sweep). |
| 4 | Zero new dependencies (Req 4) | VERIFIED | `git diff --quiet package.json package-lock.json` exits 0. `tests/test-222-zero-deps.cjs` (7 checks) confirms all three new source files require only `node:*` or repo `lib:`/`data:` targets; self-check confirmed the tripwire bites on a scratch `require('zod')` (per SUMMARY, re-verified the live logic is a real allowlist scan, not vacuous). |
| 5 | Frozen selector scalars provably untouched (Req 5) | VERIFIED | `node tests/test-222-frozen-scalars.cjs` -> PASS (5 assertions): `MAX_K===3`, `DIAL_REACH_K===6`, `RECOMMEND_FLOOR===0.70`, `MARGIN_THRESHOLD===0.15`, plus a self-guard that the frozen-scalar test never imports the new ranker. `git diff 87fb5c37^..HEAD -- lib/hmi/dial-reach-orchestrator.cjs lib/workflow/f-selector-ranker.cjs` is empty across the full phase (all 4 plans + 5 fix commits). |
| 6 | Reachability proven via real MCP registration and real `decide()`, never assumed (Req 6) | VERIFIED | `tests/test-222-reach-wired.cjs` requires BOTH `lib/core/navigation-engine.cjs` (real `decide()`) and `lib/mcp/tools/sensors.cjs` (real `sensors.register` via a captured-handler fake server) -- the anti-vacuous-green signature the plan mandated. ARM 2 is a load-bearing negative arm (registry-first != score-first, or the suite is tautological); ARM 5/6 regression-pin the untouched Wicked-escalation precedence and dead-Brain degrade. Adjacent regression suites confirmed green: `node tests/test-213-reach-wired.cjs` (5 arms), `node tests/test-198-contract-schema.test.cjs` (112 assertions). |
| 7 | A failed weight-state read degrades visibly, never silently (Req 7) | VERIFIED | `node tests/test-222-degrade.cjs` -> PASS (5 arms): healthy and cold-start both emit ZERO `reach_weight_state_unavailable` events; a corrupt scalar (`weight=-1`, direct SQL fixture corruption) emits exactly one `corrupt_scalar` event AND still returns a valid D4-only ranking; a dropped `ranker_weights` table emits exactly one `read_fault` event AND still returns a valid ranking; the emitted payload is enum/scalar-only (no `reason` field, no value >64 chars, per Part 8). |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `lib/core/migrations/phase-222-ranker-weights.cjs` | Sentinel-idempotent `CREATE TABLE ranker_weights` migration | VERIFIED | Exports `runMigration`, `SENTINEL_KEY`; wired into `room-db.cjs` (require at :35, call at :141, `grep -c` both ==2 as required); node-level idempotency probe (applied:true then applied:false) confirmed at plan-01 time and unchanged since. |
| `lib/core/navigation/ranker-weights.cjs` | Typed accessor pair over `ranker_weights` | VERIFIED | `readWeightState`/`upsertWeightState`, re-exported from `navigation.cjs` as `readHedgeWeightState`/`upsertHedgeWeightState`. Post-fix: `upsertWeightState` now checks `db.isTransaction` before issuing its own BEGIN/COMMIT/ROLLBACK (CR-01 fix, code-read confirmed at lines 103-129) and rejects `w < 0` at write time (WR-02 fix, confirmed at lines 85-96). |
| `lib/workflow/reach-hedge-ranker.cjs` | `rankFiredCandidates` + Hedge combiner + weight read/update, the single shared selection layer (D-01) | VERIFIED | All 9 named exports present (`rankFiredCandidates`, `readHedgeWeights`, `maybeUpdateHedgeWeights`, `hedgeUpdate`, `deriveExpertLosses`, `EXPERT_IDS`, `REACH_IDS`, `HEDGE_UPDATE_N_DEFAULT`, `HEDGE_ETA_DEFAULT`, plus `canonicalRegistryRank` added by the WR-01 fix). Post-fix: `registrySignal` now calls the single shared `canonicalRegistryRank(reachId)` helper at both training time (`deriveExpertLosses`) and inference time (`rankFiredCandidates`, line 422) -- code-read confirmed the WR-01 divergence is closed, not just claimed. |
| `tests/run-all-222.sh` | Phase harness: 7 node legs + grep-sweep legs + dependency-diff leg | VERIFIED | Ran live: `Phase 222: PASS=10 FAIL=0 SKIP=0`, exit 0. `strip_comments` helper defined and used (Part 8/Part 9 sweeps), `run_if`-guarded on every node leg. |
| `docs/ENV-TUNING.md` | `MINDRIAN_HEDGE_UPDATE_N` / `MINDRIAN_HEDGE_ETA` documented | VERIFIED | Both present with `export ...=50` / `export ...=0.3`; byte-matches `HEDGE_UPDATE_N_DEFAULT=50` / `HEDGE_ETA_DEFAULT=0.3` in the shipped code (grep-confirmed both sides). |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `lib/core/navigation-engine.cjs::decide()` | `lib/workflow/reach-hedge-ranker.cjs` | lazy require + `rankFiredCandidates` call before any `[0]` read | WIRED | `grep -c rankFiredCandidates lib/core/navigation-engine.cjs` == 1; insertion sits between the dispatch block and every downstream `[0]` reader; live-tested via `decide({},{})` soft-path and ARM 3. |
| `lib/mcp/tools/sensors.cjs::dispatchCandidateReaches` | `lib/workflow/reach-hedge-ranker.cjs` | top-level require + `rankFiredCandidates` call | WIRED | `grep -c rankFiredCandidates lib/mcp/tools/sensors.cjs` == 1; `suggest_next`/`reach_candidates` registration blocks unmodified (both consume `dispatchCandidateReaches`' return); ARM 4 proves live reachability through real `sensors.register`. |
| `lib/core/room-db.cjs` | `lib/core/migrations/phase-222-ranker-weights.cjs` | require + `runPhase222RankerWeights(db)` in the migration chain | WIRED | `grep -c "runPhase222RankerWeights" lib/core/room-db.cjs` == 2 (require line + call). |
| `lib/core/navigation.cjs` | `lib/core/navigation/ranker-weights.cjs` | thin additive re-export pair | WIRED | `readHedgeWeightState` / `upsertHedgeWeightState` both present and used by `reach-hedge-ranker.cjs` (Part 9 chokepoint grep sweep in `run-all-222.sh` leg (b) confirms zero direct-SQL escape hatches). |
| `lib/workflow/reach-hedge-ranker.cjs` | `lib/workflow/reach-reject-reader.cjs` | `countPenalty` composed into the D4 expert before the Hedge blend | WIRED | Confirmed by code read (OQ-2 resolution: one coordinated adjustment); `test-222-rank-fired.cjs` checks exercise the composed discount ("flat-floor outcome tie-break"). |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Full phase harness | `bash tests/run-all-222.sh` | `Phase 222: PASS=10 FAIL=0 SKIP=0`, exit 0 | PASS |
| Migration idempotency + table presence | `node -e` probe (per 222-01-PLAN Task 1 verify block, re-run against current code) | table exists, `ON CONFLICT` upsert works, chokepoint-only access confirmed via leg (b) sweep | PASS |
| Registry order signal parity (WR-01 regression) | `node tests/test-222-rank-fired.cjs` | 9 checks green (grew from 6, checks 7/7b/7c added and passing) | PASS |
| Mid-transaction write safety (CR-01 regression) | `node tests/test-222-weight-state.cjs` | 9 checks green (grew from 7, check 8 mid-transaction survival + check 5b negative-weight rejection) | PASS |
| Adjacent-suite regression | `node tests/test-213-reach-wired.cjs` | 5 arms green | PASS |
| Adjacent-suite regression | `node tests/test-198-contract-schema.test.cjs` | 112 assertions green | PASS |
| Connector registry / Part 11 fork status | `node scripts/build-connector-registry.cjs --check` | `connector-registry: OK`, exit 0 | PASS |
| HITL shape declaration | `node scripts/check-shape-declaration.cjs --check` | 56 pre-existing WARNs, none touching `sensors.cjs`/`suggest_next`/`reach_candidates` -- confirmed no new violations introduced by this phase | PASS |

### Fix-Pass Verification (CR-01, WR-01, WR-02, WR-03, WR-04)

The task brief asked this verification to independently confirm the 5 review-fix commits actually
landed and did not regress anything, not take REVIEW-FIX.md's word for it. All 5 commits
(`1f7c21a1`, `60ba92c7`, `d22b1dbb`, `ab24c736`, `3d3719f4`) are present in `git log` on `main`
(confirmed via `git log --oneline | grep`), and the code changes they claim are present were
independently read and confirmed:

- **CR-01** (transaction-clobber): `lib/core/navigation/ranker-weights.cjs:103-129` -- `db.isTransaction` is checked before `BEGIN`; when a transaction is already open, no `BEGIN`/`COMMIT`/`ROLLBACK` of its own is issued. Confirmed by direct code read, not just the fix report's prose.
- **WR-01** (registry-signal divergence): `lib/workflow/reach-hedge-ranker.cjs:105` defines `canonicalRegistryRank`; line 422's live `registrySignal` calls it (previously used the fired-array's own index). Confirmed both training (`deriveExpertLosses`) and inference (`rankFiredCandidates`) now share the one definition.
- **WR-02** (negative-weight write acceptance): `lib/core/navigation/ranker-weights.cjs:93` -- validation is now `!Number.isFinite(w) || w < 0`. Confirmed present.
- **WR-03** (500-row cap): documented inline at `reach-hedge-ranker.cjs:322-339` as an analyzed, accepted bound (no behavior change, as the fix report states) -- confirmed the reasoning is present in-code, not just in REVIEW-FIX.md.
- **WR-04** (stale `hitl_why`): `lib/mcp/tools/sensors.cjs:339,346` now disclose the debounced internal write; `data/mcp-tool-connectors.json` regenerated and byte-contains the updated string (confirmed via grep on the generated file, not just the source).

**Check-count discrepancy note (task-brief correction):** the task brief stated
"test-222-hedge-update.cjs 7->9 checks and test-222-degrade.cjs 6->9 checks." Live re-run shows
this pairing is incorrect: `test-222-hedge-update.cjs` and `test-222-degrade.cjs` are unchanged at
6 and 5 checks respectively (neither was touched by the fix pass). The actual growth, confirmed by
live execution, is `test-222-weight-state.cjs` 7->9 and `test-222-rank-fired.cjs` 6->9 --
exactly as `222-REVIEW-FIX.md` documents. This is a minor inaccuracy in the orchestrating task
brief, not a phase defect; flagged here so it isn't mistaken for a regression.

### Requirements Coverage

Per the task brief, this phase's requirements are local (222-SPEC.md Requirements 1-7), not mapped
to global `REQ-XX` IDs in `.planning/REQUIREMENTS.md` (confirmed: `grep -n "Phase 222"
.planning/REQUIREMENTS.md` returns no results, consistent with the stated "no global REQ-XX ids
mapped to this phase"). All 7 local requirements are covered above under Observable Truths #1-7,
each independently verified against running code and live test output, not SUMMARY.md prose.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `lib/mcp/tools/sensors.cjs` | 148, 168 | `suggest_next`/`reach_candidates` tool descriptions still say "canonical dispatch order" / "canonical order" though the underlying data is now score-ordered post-Phase-222 | Info | Cosmetic only -- an MCP client reading the tool description text (not the actual returned data) could be misled about ordering semantics. Does not affect the `hitl_why` fields (WR-04-fixed, accurate) or actual behavior (score-ordered, test-confirmed). Not a functional gap; worth a fast-follow doc tweak. |

No debt markers (`TBD`/`FIXME`/`XXX`) found in any Phase-222-created or Phase-222-modified file. No
em-dash violations found in the new/modified source files (CLAUDE.md hard rule honored).

### Human Verification Required

None. This phase is a backend ranking/selection change with no new user-facing surface (per
222-CONTEXT.md's own `<specifics>` section: "No UI/visual specifics"). No `<verify><human-check>`
blocks were found in any of the four PLAN.md files. All 7 requirements are mechanically verifiable
and were verified against live-running code and tests, not deferred to human judgment.

### Gaps Summary

None. All 7 local requirements verified against live code execution. The 5 code-review fixes
(1 critical + 4 warnings) were independently confirmed present in the actual source (not just
claimed in REVIEW-FIX.md), the full `bash tests/run-all-222.sh` harness passes at PASS=10 FAIL=0
SKIP=0 when re-run fresh, and both adjacent regression suites (`test-213-reach-wired.cjs`,
`test-198-contract-schema.test.cjs`) remain green. The only finding is a cosmetic, non-blocking
doc-string staleness in two MCP tool descriptions (Info-level, noted above).

---

_Verified: 2026-07-15T05:47:51Z_
_Verifier: Claude (gsd-verifier)_

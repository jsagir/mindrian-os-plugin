---
phase: 158
plan: 03
subsystem: workflow / reach penalty + hard-suppression (the CORE wave)
tags: [countPenalty, isHardSuppressed, computeReachPenalties, suppressedReachIds, four-fences, byte-stable, frozen-148, RJP-01, RJP-02, RJP-03, RJP-04, RJP-05, RJP-08, SC-03, SC-05, SC-07, D-02a, D-05, D-06]
requires:
  - "lib/workflow/reach-reject-reader.cjs rejectCountInWindow + presentationsCount + opts.window seam (Phase 158-02)"
  - "lib/hmi/dial-reach-orchestrator.cjs buildReachList (Phase 148, frozen-148 surface)"
  - "lib/hmi/cortex-reach-adapter.cjs buildReachScoresFromCortex (Phase 148)"
  - "scripts/intent-classifier.cjs runNavigationEngine live arm (roomDb open) + renderEngineDecisionWithDial render seam (Phase 150-06 / 158-02)"
provides:
  - "named constants N=3/M=2/W=8/P=5/CAP=0.6/FLOOR=0.05 with a low-data rationale (RJP-05)"
  - "countPenalty(db, reach_id, roomState) -> bounded discount, exactly 0 at zero rejects (RJP-02/03)"
  - "isHardSuppressed(db, reach_id, roomState) -> the four bias fences (M / W / deterministic parole / per-room)"
  - "computeReachPenalties(db, roomState) -> { discountedScores, suppressedReachIds } the upstream fold"
  - "buildReachList drops roomState.suppressedReachIds before sort + frozen gate (SC-03 / SC-05); stays pure"
  - "the live-arm fold + render-seam merge in intent-classifier.cjs (SC-07; db never threaded into the orchestrator)"
affects:
  - "Plan 04 (the run-all-158.sh gate + byte-stable / Part 8 / Part 9 sweeps) consumes these suites + the new exports"
tech-stack:
  added: []
  patterns:
    - "selector-decisions.cjs:61 DECAY_WINDOW named-constant idiom (mirrored for N/M/W/P/CAP/FLOOR)"
    - "dial-close-reach.cjs:79-94 PIVOT_PENALTY_FLOOR bounded-clamp idiom (mirrored for CAP + D-02a floor)"
    - "the roomState injection seam (rejectCountInWindow/presentationsCount/reachScores) for db-free deterministic tests"
    - "upstream-fold-then-pure-render: db reads on the live arm, scalars/sets into the pure orchestrator (SC-07)"
    - "drop-before-sort/gate on the runtime array (frozen bank untouched)"
    - "test-148-frozen-contracts.cjs:53-75 frozen-constant assertions (mirrored as the carried 158 guard)"
key-files:
  created:
    - "tests/test-158-reach-discount.cjs"
    - "tests/test-158-reach-hard-suppress.cjs"
    - "tests/test-158-reach-fences.cjs"
    - "tests/test-158-reach-frozen-148-guard.cjs"
  modified:
    - "lib/workflow/reach-reject-reader.cjs"
    - "lib/hmi/dial-reach-orchestrator.cjs"
    - "scripts/intent-classifier.cjs"
decisions:
  - "REJECT_WINDOW_DEFAULT reconciled to the named REJECT_WINDOW (= 8) so W has ONE literal; computeReachPenalties passes { window: REJECT_WINDOW } to rejectCountInWindow so the two never drift"
  - "countPenalty is the SOLE multiplier (no recency factor on the reach surface, SC-03); the D-02 recencyFactor term DROPS OUT"
  - "the discount only folds where roomState.reachScores supplies a base prior; reaches with no prior are left to the orchestrator's existing default path so byte-stability holds"
  - "hard-suppression is a DROP of the runtime reaches array (the frozen bank REACH_DEFS/REACH_IDS/DIAL_REACH_K=6 is byte-unchanged); total_count shrinks honestly"
metrics:
  tasks_completed: 4
  files_created: 4
  files_modified: 3
  completed: 2026-06-15
---

# Phase 158 Plan 03: reach penalty + hard-suppression (the CORE wave) Summary

Closes the rejection->ranking loop on the 6-reach dial: a reach_id rejected >= N times within the trailing W presentation-units (with all four bias fences passing) is DROPPED from `buildReachList`'s rendered top-K BEFORE the sort and the frozen gate; below N it is bounded-discounted (`score * (1 - countPenalty)`, capped at CAP, floored by FLOOR so it never accidentally hits 0); zero rejections leave `reachScores` untouched and `suppressedReachIds` empty for a byte-identical render. The penalty is folded UPSTREAM on the live engine arm (db open) and passed as scalars + a set into the PURE orchestrator -- db is never threaded into `dial-reach-orchestrator` (SC-07).

## What was built

This is the SEED-009-MINIMAL behavior the phase exists to deliver: the named constants, the bounded penalty, the four bias fences, the upstream fold, and the drop-before-sort/gate.

1. **Named constants + the penalty + the fences + the fold** (`lib/workflow/reach-reject-reader.cjs`, Task 1). Six NAMED module constants with a documented LOW-DATA rationale block (cites ~4 users / <100 edges; grounds each against shipped reference points DECAY_WINDOW=5 and PIVOT_PENALTY_FLOOR=0.2; flags tunable-later): `REJECT_SUPPRESS_THRESHOLD=3` (N), `MIN_PRESENTATIONS=2` (M), `REJECT_WINDOW=8` (W, the single source of truth), `PAROLE_PERIOD=5` (P), `COUNT_PENALTY_CAP=0.6` (CAP), `COMBINED_SUPPRESS_FLOOR=0.05` (FLOOR). No magic literal gates the suppression check (RJP-05).
   - `countPenalty(db, reach_id, roomState)`: returns EXACTLY 0 when `rejectCountInWindow === 0` (byte-stable at zero, RJP-02/03); returns 0 when `presentationsCount < M` (the noise fence); else `min(CAP, n/(N+1))` (bounded, RJP-03). It is the SOLE multiplier (SC-03) -- the D-02 recencyFactor term DROPS OUT because there is no recency factor on the reach surface.
   - `isHardSuppressed(db, reach_id, roomState)`: all four fences -- false below M; false on a parole turn (`presentationsCount % P === 0`, deterministic, D-06, never an RNG draw); else `rejectCountInWindow >= N` (with W-aging inside the reader); per-room scope (reads only the passed db / roomState).
   - `computeReachPenalties(db, roomState)`: the upstream fold. For each of the 6 frozen reach_ids it collects the hard-suppressed ids and, where a base prior exists, the discounted score floored at `base * FLOOR` (D-02a, never accidental 0). Returns `{ discountedScores, suppressedReachIds }`.
   - W reconciled: `REJECT_WINDOW_DEFAULT` now equals the named `REJECT_WINDOW`; `computeReachPenalties` passes `{ window: REJECT_WINDOW }` so the W literal is single-sourced.

2. **The drop in the PURE orchestrator** (`lib/hmi/dial-reach-orchestrator.cjs`, Task 2). `buildReachList` reads `roomState.suppressedReachIds` (Set or array; absent/empty = no drop) via a defensive `_normalizeSuppressed`, filters the runtime `reaches` array to `survivors` immediately after the `REACH_DEFS.map` and BEFORE the `.sort` (:241) and `_applyFrozenGate` (:244). The sort, the frozen gate, `total_count`, and `offered_count` all run on the survivors so `total_count` honestly shows the reduced bank for this turn. The frozen bank (`REACH_DEFS` / `REACH_IDS` / `DIAL_REACH_K=6` / `RECOMMEND_FLOOR=0.70` / `MARGIN_THRESHOLD=0.15`) is byte-unchanged. Empty set -> byte-identical to today. The function stays PURE (no db/fs/Brain). The drop is the ONLY change to this file.

3. **The upstream fold + render-seam merge** (`scripts/intent-classifier.cjs`, Task 3). On the live engine arm (db open, where the Plan 02 `reach_presented` emit already lives), `computeReachPenalties(roomDb, {reachScores, db: roomDb, roomDir})` runs inside a try/catch (degrades to an empty penalty set on fault) and threads `reach_penalties` out on the resolved object alongside `cortex_nodes`. At the render seam `renderEngineDecisionWithDial` merges `discountedScores` over the cortex-derived `reachScores` (`Object.assign`) and passes `suppressedReachIds` into `buildReachList({tierMode, reachScores, suppressedReachIds})`. `buildReachList` receives ONLY scalars + a set -- db is NEVER threaded into the orchestrator (SC-07). Zero rejections -> empty fold -> byte-identical render (RJP-02). Best-effort throughout: any fault degrades to the un-discounted render, never blocks the turn.

4. **Four deterministic suites** (Task 4; no RNG, no live Brain; all signals injected via the roomState seam):
   - `test-158-reach-discount.cjs` (5 checks): bounded `countPenalty` in (0, CAP]; bounded at high count; M fence zeroes; byte-stable-at-zero (JSON byte compare of folded vs no-penalty baseline); below-N present + strictly lower.
   - `test-158-reach-hard-suppress.cjs` (3 checks): at >= N (all fences pass) the reach is in `suppressedReachIds` AND absent from `buildReachList` (total_count 6 -> 5); at N-1 present + discounted.
   - `test-158-reach-fences.cjs` (6 checks): M floor; W aging (aged-out streak re-surfaces, in-window streak suppresses); deterministic parole (repeatable, fires at P and 2P); D-02a floor never 0; per-room scope (independent roomStates do not bleed); CAP bound.
   - `test-158-reach-frozen-148-guard.cjs` (8 checks): mirrors `test-148-frozen-contracts.cjs` (MAX_K=3, RECOMMEND_FLOOR=0.70, MARGIN_THRESHOLD=0.15, DIAL_REACH_K=6, REACH_IDS length 6) AFTER exercising a discount + a drop, proving SC-05 holds and the frozen-6 contract is about the BANK, not the rendered count.

## Deviations from Plan

None of substance -- the plan was executed as written. Two notes:

- **[Plan-discretion] W single-source reconciliation.** The plan said "the W in rejectCountInWindow now uses the named REJECT_WINDOW (reconcile the Plan 02 default)." I reconciled by setting `REJECT_WINDOW_DEFAULT = REJECT_WINDOW` (the named constant) so there is exactly one literal, and `computeReachPenalties` always passes `{ window: REJECT_WINDOW }` to `rejectCountInWindow`. No drift possible.
- **[Comment-wording fix during execution]** The Task 1 verify greps the reader source for `Math\.random` absence. My rationale comments originally spelled out "Math.random" (describing what NOT to use); I reworded to "an RNG draw" so the no-RNG grep passes while the meaning is preserved. This is a wording adjustment, not a behavior change.

## Authentication gates

None.

## Verification

- `node tests/test-158-reach-discount.cjs` -> PASS (5 checks).
- `node tests/test-158-reach-hard-suppress.cjs` -> PASS (3 checks).
- `node tests/test-158-reach-fences.cjs` -> PASS (6 checks).
- `node tests/test-158-reach-frozen-148-guard.cjs` -> PASS (8 checks).
- `bash tests/run-all-148.sh` -> 18/18 (frozen-148 intact after discount + drop).
- Task 1 verify (constants exported + zero-penalty-at-zero + no RNG) -> OK.
- Task 2 verify (drop works + frozen constants intact + total_count shrinks by 1) -> OK.
- Task 3 verify (upstream fold wired: computeReachPenalties + suppressedReachIds present, no em-dash) -> OK.
- RED/GREEN proof (load-bearing): forcing `isHardSuppressed`'s N gate to `return false` turns `test-158-reach-hard-suppress.cjs` RED; restoring returns GREEN.
- No em-dashes across all seven scope files (grep clean).
- Regression fences held: the three prior-wave 158 suites (`reach-id-keying`, `reach-presentation-counter`, `reach-reject-only`) GREEN; `lib/memory/selector-decisions.test.cjs` GREEN; `tests/test-150-render-unlock.cjs` GREEN; `tests/test-dial-reach-orchestrator.cjs` GREEN.
- `node -c scripts/intent-classifier.cjs` + `node -c lib/workflow/reach-reject-reader.cjs` + `node -c lib/hmi/dial-reach-orchestrator.cjs` all parse.

## Threat surface scan

No new security-relevant surface beyond the plan's `<threat_model>`. Each mitigation is in place:
- **T-158-03-01 (db into the pure orchestrator)** mitigated: `computeReachPenalties` runs on the live arm; both `buildReachList` call sites pass only `{tierMode, reachScores, suppressedReachIds}` (grep confirms no `db`/`roomDb` argument); the orchestrator's only require is `f-selector-ranker.cjs` (no navigation, no sqlite).
- **T-158-03-02 (a discount/drop moving a frozen-148 constant)** mitigated: the carried `test-158-reach-frozen-148-guard.cjs` + `run-all-148.sh` assert the five constants unchanged AFTER a discount + drop; `REACH_DEFS`/`REACH_IDS` byte-unchanged.
- **T-158-03-03 (RNG parole non-determinism)** mitigated: parole is `presentationsCount % P` (D-06); the Task 1 verify greps `Math.random` absence; the parole fence test asserts repeatability.
- **T-158-03-04 (over-suppression)** mitigated: the four fences (M / W / deterministic parole / per-room) + the bounded CAP + the D-02a floor, each with a deterministic test.
- **T-158-03-05 (reason/cross-room read)** mitigated: the reader reads `decision`/`edge_semantic`/`reach_id` enums only (the executable-line scan finds zero `properties.reason`, zero `better-sqlite3`/`node:sqlite`, zero `fs.read`); the only require is `../core/navigation.cjs` (Part 9); per-room scope reads only the passed db.
- **T-158-03-06 (byte-stability broken by an always-on penalty)** mitigated: `countPenalty` returns exactly 0 at zero rejects; `computeReachPenalties` returns empty `discountedScores` + empty `suppressedReachIds` with no reject signal; the byte-stable suite proves identical output (RJP-02).
- **T-158-03-SC (npm/pip installs)** N/A: zero new packages (pure CJS edits + four new test files).

## Known Stubs

None. No hardcoded empty values, placeholder text, or unwired data sources introduced. The penalty + suppression are live on the engine arm (computed upstream, applied in the pure render); the four suites exercise the shipped behavior db-free today and the production path threads the fold end to end.

## Notes for Wave 4 (the run-all-158.sh gate + byte-stable / Part 8 / Part 9 sweeps)

1. **The four new suites are ready to register in `run-all-158.sh`.** `test-158-reach-discount.cjs` (5), `test-158-reach-hard-suppress.cjs` (3), `test-158-reach-fences.cjs` (6), `test-158-reach-frozen-148-guard.cjs` (8). Plus the carried Wave 1/2 suites: `test-158-reach-id-keying.cjs`, `test-158-reach-presentation-counter.cjs`, `test-158-reach-reject-only.cjs`. The frozen-148 passthrough is `bash tests/run-all-148.sh` (18/18).
2. **The byte-stable sweep has a ready anchor.** `test-158-reach-discount.cjs` check 4 already does a JSON byte compare of the folded zero-reject list vs the no-penalty baseline. Wave 4 can lift that idiom for a broader `test-drift-baseline`-style snapshot if desired.
3. **The Part 8 / Part 9 grep targets for `run-all-158.sh`:** scan `lib/workflow/reach-reject-reader.cjs` for `properties.reason` (executable lines only -- there are comment-only mentions documenting the absence), `better-sqlite3` / `node:sqlite` / `fs.read` (comment-only), and confirm the only require is `../core/navigation.cjs`. Scan `lib/hmi/dial-reach-orchestrator.cjs` for any new `require`/`db`/`fetch`/`http` (none added; the only require remains `f-selector-ranker.cjs`). Confirm both `buildReachList(` call sites in `scripts/intent-classifier.cjs` pass no `db`/`roomDb` (SC-07).
4. **W is single-sourced** to `REJECT_WINDOW = 8`; if Wave 4 wants a single shared constant module it can import it, but the current module-local `REJECT_WINDOW` is the canonical literal and `REJECT_WINDOW_DEFAULT` aliases it.
5. **The discount only applies where a base prior exists** in `roomState.reachScores`. A reach with no supplied prior keeps the orchestrator's existing default path (registry_only -> 0.5, else 0). This is the byte-stability foundation; Wave 4's byte-stable sweep should keep the zero-reject fixture supplying the SAME `reachScores` it captures the baseline from.
6. **The latent BLOCKER 2 / dormant `_applyDecayWeight` rail** (the command-suggestion surfaces never inject the hook, so the shipped Phase 125 PIVOT/DEFER recency decay is inert in production) remains OUT of Phase 158 (SC-04). It is a separate latent finding worth its own follow-up; this phase targets the reach surface and does not touch that rail.

## Self-Check: PASSED

Files verified present:
- FOUND: lib/workflow/reach-reject-reader.cjs
- FOUND: lib/hmi/dial-reach-orchestrator.cjs
- FOUND: scripts/intent-classifier.cjs
- FOUND: tests/test-158-reach-discount.cjs
- FOUND: tests/test-158-reach-hard-suppress.cjs
- FOUND: tests/test-158-reach-fences.cjs
- FOUND: tests/test-158-reach-frozen-148-guard.cjs

Commits verified present:
- FOUND: 736986cc (feat 158-03: named constants + countPenalty + isHardSuppressed + computeReachPenalties)
- FOUND: 6ed0c3da (feat 158-03: drop suppressedReachIds in pure buildReachList)
- FOUND: 76542259 (feat 158-03: upstream fold + render-seam merge)
- FOUND: 4a8c2548 (test 158-03: four deterministic suites)

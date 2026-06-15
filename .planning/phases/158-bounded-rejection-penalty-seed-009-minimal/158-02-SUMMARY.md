---
phase: 158
plan: 02
subsystem: workflow / reach-keyed signal readers + presentation counter
tags: [reach_presented, reach_id, rejectCountInWindow, presentationsCount, REJECT-only, RJP-06, RJP-07, SC-06, SC-07, D-03]
requires:
  - "lib/core/navigation/memory-events.cjs EVENT_TYPES + logEvent + findRecentChanges (Phase 109)"
  - "lib/core/navigation.cjs logMemoryEvent + findRecentChanges re-exports (Phase 109/110)"
  - "lib/workflow/selector-decisions.cjs recordSelectorDecision + optional reach_id keying (Phase 158-01)"
  - "lib/hmi/cortex-reach-adapter.cjs buildReachScoresFromCortex + REACH_IDS (Phase 148)"
  - "lib/hmi/dial-reach-orchestrator.cjs buildReachList (Phase 148, frozen-148 surface)"
  - "scripts/intent-classifier.cjs runNavigationEngine live arm (roomDb open :1341 / closed :1488)"
provides:
  - "an additive reach_presented EVENT_TYPES entry (floor-not-size contract preserved)"
  - "one reach_presented memory_event per offered top-3 reach_id, fired on the LIVE engine arm, keyed by reach_id"
  - "lib/workflow/reach-reject-reader.cjs rejectCountInWindow(db, reach_id, roomState, opts) + presentationsCount(db, reach_id, roomState)"
  - "the roomState.rejectCountInWindow[reach_id] / roomState.presentationsCount[reach_id] db-free test-injection seam"
  - "REJECT_WINDOW_DEFAULT=8 + opts.window override seam for Plan 03 W reconciliation"
affects:
  - "Plan 03 penalty + hard-suppression (consumes both readers; M-floor + W-window + parole)"
tech-stack:
  added: []
  patterns:
    - "_invocationsSinceDecision pre-computed-counter test-injection seam (selector-decisions:311)"
    - "cortex-reach-adapter flat-frozen-REACH_IDS local const (no orchestrator import; no require cycle)"
    - "findRecentChanges reach_id-filtered scan idiom (the command-filter at selector-decisions:329 re-keyed to reach_id)"
    - "best-effort try/catch emit on the live arm (mirrors the dial-render fault handling)"
    - "additive EVENT_TYPES floor-not-size idiom (Phase 124-02 / 143.1-05 2-string block verbatim)"
key-files:
  created:
    - "lib/workflow/reach-reject-reader.cjs"
    - "tests/test-158-reach-presentation-counter.cjs"
    - "tests/test-158-reach-reject-only.cjs"
  modified:
    - "lib/core/navigation/memory-events.cjs"
    - "scripts/intent-classifier.cjs"
decisions:
  - "W kept as a module-local REJECT_WINDOW_DEFAULT=8 (the D-09 starting value) PLUS an opts.window override seam, so Plan 03 has ONE source of truth: pass the shared named constant via opts.window and it wins; otherwise the conservative default applies"
  - "Window floor = the W-th-most-recent presentation's createdAt for THIS reach_id (presentation-units, D-10 Q1); fewer than W presentations -> open-ended window (floor 0) so every reject counts at small sample (the M-floor in Plan 03 gates suppression-eligibility, not this count)"
  - "Mirror REACH_IDS as a local frozen const in reach-reject-reader.cjs (NOT import dial-reach-orchestrator.cjs) to avoid a require cycle, per the cortex-reach-adapter idiom"
  - "reach_presented observability events reach_suppressed / reach_paroled NOT added (D-10 Q3: deferred unless trivially cheap; they are Plan 03 territory and not required for the fences to compute)"
metrics:
  tasks_completed: 4
  files_created: 3
  files_modified: 2
  completed: 2026-06-15
---

# Phase 158 Plan 02: presentation counter + the two reach-keyed readers Summary

Adds the additive `reach_presented` EVENT_TYPES entry, fires one `reach_presented` memory_event per offered top-3 reach_id on the LIVE engine arm (keyed by reach_id, db open), and ships `lib/workflow/reach-reject-reader.cjs` with two PURE readers -- `rejectCountInWindow` (REJECT-only, within trailing W presentation-units; DEFER/PIVOT never count) and `presentationsCount` (reach_id-isolated) -- both reading only via the navigation.cjs chokepoint and both honoring the db-free roomState injection seam so the dial orchestrator stays PURE.

## What was built

This plan ships the two signals the Plan 03 fences consume. After this plan, the system records WHICH reach was OFFERED (nothing did before -- the dial render path is pure and `selector_presentation` is command-anonymous), and a reach's REJECT count within the recency window is readable per reach_id, db-free in unit tests.

1. **The additive `reach_presented` EVENT_TYPES entry** (memory-events.cjs). One net-new event_type appended before the closing `]))` of the frozen Set, with a Phase 158 comment block mirroring the Phase 124-02 / 143.1-05 2-string additive idiom verbatim. The Set grows by exactly 1; `logEvent` rejects any event_type outside the Set, so the entry is accepted ONLY because it is now IN the Set. The floor-not-size contract (tests assert FLOOR + named membership, never an exact `.size`) makes the addition safe. The payload carries reach_id (a frozen-enum machine token) + source_path + created_by ONLY -- Part 8; system-bookkeeping node per the Part 9 v1.5 audit-node carve-out (created_by=system review_status=confirmed canon-legal).

2. **`lib/workflow/reach-reject-reader.cjs`** -- two PURE readers keyed by reach_id:
   - `presentationsCount(db, reach_id, roomState)`: prefers `roomState.presentationsCount[reach_id]` (test seam) when it is a finite number; else `navigation.findRecentChanges(db, 0, {eventType:'reach_presented', limit:200})` and counts rows where `row.properties.reach_id === reach_id`; returns 0 when db is null and no counter is injected.
   - `rejectCountInWindow(db, reach_id, roomState, opts)`: prefers `roomState.rejectCountInWindow[reach_id]` (test seam); else derives the window floor from this reach_id's `reach_presented` timeline (the W-th-most-recent presentation's `createdAt`; open-ended when fewer than W exist), then reads `f_selector_decision` rows newer than the floor and counts ONLY the REJECT rows (`decision === 'reject'` OR `edge_semantic === 'REJECTED'`) whose `properties.reach_id === reach_id`. DEFER/PIVOT never contribute (D-03).
   - Reads enums/scalars ONLY -- NEVER `properties.reason` (Part 8 / RJP-06). The only `require` is `../core/navigation.cjs` (Part 9 / RJP-07): no direct sqlite handle, no better-sqlite3, no fs read of room data. No Brain call. Defensive non-throwing guards on every read.
   - W is a module-local `REJECT_WINDOW_DEFAULT = 8` (the D-09 starting value) PLUS an `opts.window` override seam documented as the Plan 03 reconciliation point (Plan 03 passes the shared named constant `REJECT_WINDOW` and it wins).

3. **The live-arm `reach_presented` emit** (intent-classifier.cjs runNavigationEngine). Inside the `.then(function(decision){...})` block where `cortexNodes` is computed (:1481-1484) and BEFORE `resolve(...)`, while `roomDb` is still the OPEN handle (closed only in the trailing `.then(closeRoomDbHandle, closeRoomDbHandle)` finally at :1488): the code recomputes the would-be-offered top-3 the SAME way the render seam does (`buildReachScoresFromCortex(cortexNodes)` -> `buildReachList({tierMode, reachScores})` -> `reaches.slice(0, offered_count)`) and fires ONE `navigation.logMemoryEvent(roomDb, 'reach_presented', {reach_id, source_path:'dial:presented:'+reach_id, created_by:'system'})` per offered reach_id. `buildReachList` receives ONLY `{tierMode, reachScores}` -- db is NEVER threaded into `dial-reach-orchestrator` (SC-07). The whole emit is wrapped best-effort (try/catch): a fault is swallowed, never blocks resolve, never throws out of the `.then`, never prevents the finally `closeRoomDbHandle`, never leaks the handle. Guard: emits only when roomDb is truthy + navigationMod has logMemoryEvent + cortexNodes is a non-empty array.

4. **Two deterministic suites** (no RNG, no live Brain, temp room.db via the shipped opener, read back via the navigation chokepoint):
   - `tests/test-158-reach-presentation-counter.cjs` (3 checks): injection seam db-free; reach_id-isolated db-backed count (3 deep_research, 1 hats); cold path 0.
   - `tests/test-158-reach-reject-only.cjs` (4 checks): DEFER excluded (2 reject + 1 defer -> 2); reason-blind count (a `SECRETREASON123` reason lands in storage but the count is reason-independent); reach_id isolation (a `hats` reject does not bleed into `deep_research`); injection seam db-free.

## Deviations from Plan

None of substance -- the plan was executed as written. Two action-discretion calls the plan explicitly delegated:

- **W seam (plan offered two options, executor picked the cleaner one):** the plan said "define a module-local `REJECT_WINDOW_DEFAULT = 8` OR expose W as a function parameter -- executor picks the cleaner seam." I shipped BOTH: the module-local default `REJECT_WINDOW_DEFAULT = 8` for the self-contained pre-Plan-03 state, AND an `opts.window` override parameter as the documented reconciliation seam. This gives Plan 03 one source of truth (pass the shared `REJECT_WINDOW` via `opts.window`) without coupling this module to a not-yet-shipped constant.
- **Observability events (D-10 Q3, planner discretion):** `reach_suppressed` / `reach_paroled` were NOT added -- they are Plan 03 territory (suppression/parole happen there) and are not required for the readers to compute. Only the single `reach_presented` enabler landed, per the plan's "enum/scalar only, observability in-scope-minimal-if-cheap" guidance.

## Authentication gates

None.

## Verification

- `node tests/test-158-reach-presentation-counter.cjs` -> PASS (3 checks).
- `node tests/test-158-reach-reject-only.cjs` -> PASS (4 checks).
- RED/GREEN proof (load-bearing): breaking the REJECT-only filter (`_isRejectRow` -> always true) turns the reject-only suite RED (defer counts: 3 not 2); restoring it returns GREEN.
- `reach_presented` is in EVENT_TYPES (Task 1 verify) -- OK.
- The reader honors the injection seam db-free (Task 2 verify: `rejectCountInWindow(null,'deep_research',{rejectCountInWindow:{deep_research:2}})===2`; `presentationsCount(null,'deep_research',{presentationsCount:{deep_research:5}})===5`) -- OK.
- The live-arm emit is present and em-dash-free (Task 3 verify regex) -- OK.
- No em-dashes: `grep -rn $'\xe2\x80\x94' lib/workflow/reach-reject-reader.cjs tests/test-158-reach-presentation-counter.cjs tests/test-158-reach-reject-only.cjs` returns nothing.
- Forbidden-read scan (executable lines only): zero `properties.reason`, zero `better-sqlite3` / `node:sqlite`, zero `fs.read` in the reader's code (comment-only matches excluded). The only `require` is `../core/navigation.cjs`.
- Regression fences held: `tests/run-all-148.sh` 18/18; `tests/test-158-reach-id-keying.cjs` (Wave 1) 4/4; `lib/memory/selector-decisions.test.cjs` 17/17. No frozen-148 surface touched (DIAL_REACH_K=6, MAX_K=3, 0.70/0.15 gate, 6 REACH_IDS, 3 postures all unchanged; the 0.40/0.30/0.30 weights untouched).
- `node -c scripts/intent-classifier.cjs` parses.

## Threat surface scan

No new security-relevant surface beyond the plan's `<threat_model>`.
- **T-158-02-01 (Information Disclosure)** mitigated: `rejectCountInWindow` reads `decision` / `edge_semantic` / `reach_id` enums ONLY; never `properties.reason` (proven by the reject-only suite's reason-blind test; the secret reason lands in storage but the count is reason-independent).
- **T-158-02-02 (Tampering, direct DB / fs read)** mitigated: the reader reads ONLY via `navigation.findRecentChanges`; the executable-line forbidden-read scan finds zero `node:sqlite` / `better-sqlite3` / `fs.read`.
- **T-158-02-03 (db threaded into the pure orchestrator)** mitigated: the live arm computes + writes; `buildReachList` receives only `{tierMode, reachScores}`; db never enters `dial-reach-orchestrator` (SC-07 purity).
- **T-158-02-04 (faulting emit blocking the turn / leaking the db)** mitigated: the emit is best-effort try/catch, runs before the trailing finally `closeRoomDbHandle`, never throws out of the `.then`.
- **T-158-02-05 (cross-room rejection bias)** mitigated: reads only the active room's room.db (per-room scope, Part 8); reach_presented + f_selector_decision rows are room-local by construction.
- **T-158-02-SC (npm/pip installs)** N/A: zero new packages (pure CJS edits + one new CJS module + two test files).

## Known Stubs

None. No hardcoded empty values, placeholder text, or unwired data sources introduced. The `reach_presented` write is live on the engine arm; the readers are consumed in unit tests today and by Plan 03's fences next.

## Notes for Wave 3 (the penalty + hard-suppression)

1. **Consume both readers via the roomState injection seam, db-free.** The dial orchestrator MUST stay PURE: do the db reads upstream on the LIVE engine arm (the same place the `reach_presented` emit lives now, where roomDb is open at intent-classifier.cjs:1341 / closed :1488), compute the per-reach_id reject count + presentation count there, FOLD the bounded discount into `roomState.reachScores[reach_id]`, and pass a `suppressedReachIds` set so PURE `buildReachList` drops them before its sort (:241) / `_applyFrozenGate` (:244). Do NOT thread db into `dial-reach-orchestrator` (SC-07). In unit tests, inject `roomState.rejectCountInWindow[reach_id]` / `roomState.presentationsCount[reach_id]` -- the readers short-circuit to the injected numbers with zero db touch.

2. **W has ONE source of truth: pass it via `opts.window`.** This module ships `REJECT_WINDOW_DEFAULT = 8` (the D-09 value) but exposes `rejectCountInWindow(db, reach_id, roomState, opts)` where `opts.window` overrides. When Plan 03 lands the shared named constant `REJECT_WINDOW`, pass it as `opts.window` so the two never drift. Reconcile the module-local default to a re-export-or-import of the shared constant if you prefer a single literal.

3. **The window is presentation-units, not wall-clock (D-10 Q1).** `rejectCountInWindow` derives the floor from this reach_id's `reach_presented` timeline (the W-th newest presentation's `createdAt`). Below W presentations the window is open-ended (floor 0). So the M-floor (min-presentations, M=2) is the fence that prevents over-eager suppression at small sample -- the reject count itself is NOT M-gated. Plan 03 must apply M as a separate suppression-eligibility gate on top of `presentationsCount(reach_id) >= M`.

4. **Constants for Plan 03 (D-09, all NAMED per RJP-05):** N=3 (hard-suppress), M=2 (min-presentations floor), W=8 (window -- already in this module as REJECT_WINDOW_DEFAULT), P=5 (parole period), CAP=0.6 (countPenalty cap), FLOOR=0.05 (combined-suppression floor). No magic literal may gate suppression (RJP-05 grep).

5. **Suppression DROPS before sort + frozen gate.** Per SC-03 / SC-05: hard-suppression removes the reach_id from the ranked set BEFORE the top-K slice in `buildReachList`, and MUST NOT change DIAL_REACH_K=6 (the bank stays 6), MAX_K=3, the 0.70/0.15 gate, or the 6 REACH_IDS. The frozen-6 invariant test (`run-all-148.sh`) asserts the BANK is 6, not that 6 always render -- it stays green when a reach is dropped from the RENDERED top-K.

6. **No recency factor on the reach surface.** Unlike the command rail, there is NO transient recency multiplier here, so the count penalty is the SOLE multiplier (`score * (1 - countPenalty)`) -- simpler than the command-rail LAYER (D-02 was framed for the command surface; the reach surface only needs the count penalty).

7. **Parole determinism (D-06):** parole is keyed on `presentationsCount(reach_id)` (every Pth presentation), NOT `Math.random()`. `presentationsCount` from this module is the parole counter source. Parole only fires for already-suppressed reaches (which require rejections), so byte-stable-at-zero (RJP-02) is preserved.

8. **The reach_id keying chain is in place end to end (Wave 1 + Wave 2).** A rejected dial reach is keyed by reach_id on the `f_selector_decision` row (Plan 01), and offered reaches are counted by reach_id on `reach_presented` (this plan). Both readers filter by `properties.reach_id`. Plan 03 reads them and decides; it does not need to re-key.

## Self-Check: PASSED

Files verified present:
- FOUND: lib/core/navigation/memory-events.cjs
- FOUND: lib/workflow/reach-reject-reader.cjs
- FOUND: scripts/intent-classifier.cjs
- FOUND: tests/test-158-reach-presentation-counter.cjs
- FOUND: tests/test-158-reach-reject-only.cjs

Commits verified present:
- FOUND: 23cd71df (feat 158-02: additive reach_presented EVENT_TYPES entry)
- FOUND: c62c7efd (feat 158-02: reach-reject-reader)
- FOUND: 0b1ff8c6 (feat 158-02: live-arm reach_presented emit)
- FOUND: bbfdc4d3 (test 158-02: presentation-counter + reject-only suites)

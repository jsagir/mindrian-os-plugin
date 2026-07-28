---
status: resolved
kind: rca
slug: hedge-fold-has-no-production-trigger
trigger: "hedge-fold-has-no-production-trigger"
issue_id: ""
severity: medium
surfaces: [cli, desktop, cowork]
brain_mode: local-only
canon_parts: [7, 8, 9, 11]
created: 2026-07-28T02:47:45Z
updated: 2026-07-28T06:30:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** branch `main` @ `92316000` (the quick-task 260728-7kc Task 2 commit; `origin/main` HEAD at time of filing, in the only dev workspace `/home/jsagi/dev/MindrianOS-Plugin`)
- **WIRE claims probe against:** none. This is a pure LOCAL code-reachability finding. No Brain call, no network probe, no deployed server is involved.
- **Date of audit:** 2026-07-28
- **Re-verification rule:** every source claim below was produced by a grep against the working tree at that commit, and the exact commands are reproduced in Evidence so any reader can re-run them.

## Current Focus

hypothesis: The Phase 222 Hedge outcome-learning fold (`maybeUpdateHedgeWeights`) has NO production trigger. `ctx.roomDb` is threaded into `decide()` in exactly one place repo-wide and that place is a test, so `navigation-engine.cjs` always passes `db: null` in production and the fold short-circuits immediately. Until quick task 260728-7kc, the only production code path that ever handed the ranker a live db handle was the pair of read-only MCP pull tools, and that path could never have folded either because it never produces the training rows the fold needs.
test: grep for every site that sets `roomDb` on a decide() context, and for every `recordSelectorDecision` producer, then cross-check against `maybeUpdateHedgeWeights`'s own guards.
expecting: exactly one `roomDb:` site, in `tests/`, and zero `recordSelectorDecision` calls under `lib/mcp/`.
next_action: pick between the two candidate resolutions in Required Code Changes. OUT OF SCOPE for quick task 260728-7kc, which deliberately filed this rather than absorbing it.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 1.15.3-beta.51
- Reported by: quick task 260728-7kc (fix hidden write in read-only MCP tools)
- Date first observed: 2026-07-28
- Related debug sessions: none. Sibling context is `.planning/quick/260728-7kc-fix-hidden-write-in-read-only-mcp-tools-/260728-7kc-PLAN.md`.

## Problem Statement

The Phase 222 outcome-learning layer never learns in production: nothing in shipped code hands `decide()` a room.db handle, so the debounced Hedge weight refit is unreachable and the stored weights stay at their cold-start equal-weight values forever.

## Symptoms

expected: after a navigator accumulates >= N (default 50) qualifying `f_selector_decision` accept/reject rows in a room, the Hedge weights refit once and `ranker_weights` carries an advanced `updateCount`, so the reach ranking starts reflecting that navigator's actual outcomes.
actual: `ranker_weights` stays empty in every production room. `readHedgeWeights` branch (d) treats the missing row as a cold start and returns equal weights, silently and correctly, so the layer degrades to a no-op that looks healthy from every surface.
errors: none. There is no error to observe. That is the whole difficulty of this defect: the designed, correct, SILENT cold-start path is indistinguishable from a layer that can never leave cold start.
reproduction:
  1. Use any room through the CLI navigation path until it accumulates >= 50 accept/reject decisions (`selector-decisions.cjs::recordSelectorDecision` writes these on the offer-closer / dial-close-reach / f1-pick-consumer paths).
  2. Open that room's `.mindrian/room.db` and run `SELECT * FROM ranker_weights;`.
  3. Observe zero rows. `navigation.readHedgeWeightState(db)` returns null.
started: Phase 222 (the layer shipped with this gap; it was never wired, so there is no regression commit to bisect to). Uncovered, not caused, by quick task 260728-7kc.

## Scope and Impact

- Affected surfaces: cli, desktop, cowork. All three, because the gap is in shared `lib/core/navigation-engine.cjs`, not in any surface adapter.
- Affected commands: every surface that reaches through `decide()`, notably `scripts/intent-classifier.cjs` (the live per-turn engine arm) and `scripts/act-command.cjs`.
- Affected users: all installs.
- Version range: since the Phase 222 landing through 1.15.3-beta.51 (last checked).
- Severity: medium. Nothing is broken or incorrect: the ranking still works, it just works from the D4 blend plus the fixed registry-order prior forever, never from this navigator's own outcomes. The cost is a silently inert learning layer, which is exactly the confident-success-over-empty-result shape Phase 233 was about.
- Blast radius: confined to `lib/workflow/reach-hedge-ranker.cjs`'s fold and the `ranker_weights` table. The live blend, the Phase 158 reject discount, and the ordering are all unaffected and continue to work.

## Eliminated

- hypothesis: "The MCP read tools were the production trigger, and quick task 260728-7kc removed it."
  evidence: they could never have folded. `maybeUpdateHedgeWeights` requires >= N (default 50) qualifying `f_selector_decision` rows, which are written ONLY by `lib/core/selector-decisions.cjs::recordSelectorDecision` on the navigator accept/reject path. `grep -rn "recordSelectorDecision" lib/mcp/` returns nothing, so the MCP path consumes the training log and never feeds it. In a room with only MCP traffic the row count is 0 and the fold returns `{ updated: false }` at the debounce check. The two tools were the only path that ever handed the ranker a live handle, but a live handle without rows still folds nothing.
  timestamp: 2026-07-28T02:47:45Z

- hypothesis: "`scripts/intent-classifier.cjs` threads the handle, since it clearly opens one."
  evidence: it does open a room.db handle (`scripts/intent-classifier.cjs:1857`, `:2310`, both via `openRoomDbForCaller`) and it does pass it to the F-selector and to `computeReachPenalties` (`:1889`, `:2132-2134`). It never places it on the object it hands `decide()`. `grep -rn "roomDb" scripts/intent-classifier.cjs | grep -E "\.roomDb|roomDb\s*="` returns only local assignments, never a context field.
  timestamp: 2026-07-28T02:47:45Z

## Evidence

- timestamp: 2026-07-28T02:47:45Z
  checked: `grep -rn "roomDb:" --include=*.cjs --include=*.js . | grep -v node_modules`
  found: exactly ONE hit repo-wide: `tests/test-222-reach-wired.cjs:148`, `nav.decide({ text: COFIRE_TEXT, turn_count: 5 }, { roomDir: dir, roomDb: db })`.
  implication: the only caller that has ever threaded `ctx.roomDb` into `decide()` is a test. Production always leaves it undefined.

- timestamp: 2026-07-28T02:47:45Z
  checked: `lib/core/navigation-engine.cjs:940-947`
  found: `sensorReaches = reachHedgeRanker.rankFiredCandidates(sensorReaches, { cortexNodes: ..., db: ctx.roomDb || null })`, with the surrounding comment stating "The engine never OPENS room.db - it threads the caller's ctx.roomDb handle (may be null)".
  implication: the engine is honest about being a pass-through. Combined with the previous finding, `db` is ALWAYS null on this path in production.

- timestamp: 2026-07-28T02:47:45Z
  checked: `lib/workflow/reach-hedge-ranker.cjs::maybeUpdateHedgeWeights` first line
  found: `if (!db) return { updated: false };`
  implication: with a null db the fold exits before its first query. The CLI path has therefore never folded, not once, on any install.

- timestamp: 2026-07-28T02:47:45Z
  checked: `grep -rn "readHedgeWeightState" --include=*.cjs lib/ scripts/`
  found: the persisted state is read in exactly two production sites, `lib/workflow/reach-hedge-ranker.cjs:266` and `:332`, both inside the module that writes it. No tool, no doctor module, no CLI surface consumes it.
  implication: the gap has stayed invisible because nothing outside the module would notice an empty table. There is no consumer to raise an alarm.

- timestamp: 2026-07-28T02:47:45Z
  checked: `grep -rn "recordSelectorDecision" lib/mcp/`
  found: nothing.
  implication: the MCP path is a pure consumer of the training log. Even with a live handle it could not have supplied the >= N rows the fold needs, which is why quick task 260728-7kc removing that handle changes nothing about whether the fold could ever have run.

## Technical Root Cause

- Site: `lib/core/navigation-engine.cjs`:940-947 (the `rankFiredCandidates` call inside `decide()`), reading `ctx.roomDb`.
- Cause: the Phase 222 design made `decide()` a handle PASS-THROUGH rather than a handle OPENER, deliberately, so the engine never owns db lifecycle. The corresponding obligation, that every production caller of `decide()` opens a handle and threads it as `ctx.roomDb`, was never discharged in any caller. The contract has exactly one honorer and it is a test. So the outcome-learning half of Phase 222 shipped born-unwired, in the same registered-but-unreachable shape `tests/test-222-reach-wired.cjs` exists to prevent, except that test proves the RANKING is reachable (which it is) and never asserts that the FOLD is.
- Why it surfaces now: quick task 260728-7kc swapped the two MCP pull tools onto a read-only room.db handle. Auditing what that removed required tracing every remaining production caller that hands the ranker a live handle, and the answer turned out to be none. The gap predates the quick task by the whole life of Phase 222; the quick task is only the first thing that had cause to look.

## Required Code Changes

Two candidate resolutions. Pick ONE. Both are out of scope for quick task 260728-7kc, which is why this file exists rather than a silent fix.

- Change 1 (option A: honor the pass-through contract):
  - Location: `scripts/intent-classifier.cjs`:1853-1900 (and any other production `decide()` caller), plus `scripts/act-command.cjs`:247.
  - Current behavior: the caller opens a room.db handle for the F-selector and the reject-penalty reader, then hands `decide()` a context object that omits it, so the ranker receives null.
  - Required behavior: set `roomDb` on the context object already being built, reusing the handle already open and already closed in the existing finally. This is a one-field change per caller and opens no new lifecycle.
  - Short-term patch: same as the full fix. It is one field.
  - Long-term fix: add a born-wired assertion to `tests/run-all-222.sh` that FAILS when zero production (non-test) sites thread `ctx.roomDb`, so the contract cannot silently go unhonored again. Without this the fix can regress invisibly, exactly as it did the first time.
  - Risk to weigh before choosing: this puts a 500-row query plus a potential write back on the per-turn hot path for every navigator turn, which is precisely the load profile quick task 260728-7kc just removed from the MCP poll path. The debounce gates the WRITE, never the query.

- Change 2 (option B: move the fold to an explicit navigator-triggered entry point):
  - Location: new entry point, following the `scripts/graph-heal-pipeline.cjs` precedent from Phase 233-03.
  - Current behavior: the fold is a fire-and-forget side effect of a ranking call, so it can only run where a ranking call happens to hold a write handle.
  - Required behavior: make the refit an explicit, navigator-triggered pipeline stage (the Phase 233-03 "navigator-triggered only, never on the write path" discipline), so it runs deliberately, is observable, and cannot contend with a live turn.
  - Short-term patch: none. This is structural by nature.
  - Long-term fix: this IS the long-term fix. It also removes the awkwardness that a fold cannot serve the call performing it (in `rankFiredCandidates` the response is already computed at line 432 before the update fires at line 436).
  - Recommendation: option B. It matches the precedent the repo just set in Phase 233-03, it keeps the hot path clean, and it makes an inert learning layer visible instead of silent.

## Tests to Add or Update

- Test 1:
  - Type: integration
  - Location: `tests/test-222-reach-wired.cjs` (extend) or a new `tests/test-222-fold-wired.cjs`
  - Given: the repo as shipped.
  - When: every production (non-`tests/`) call site that reaches `decide()` is enumerated.
  - Then: at least one threads a live `ctx.roomDb`, OR the chosen explicit fold entry point exists and is reachable. The assertion must exclude `tests/` from the census, otherwise the existing test satisfies it and the gate is vacuous, which is the exact failure mode that let this ship.
  - Runner registration: `tests/run-all-222.sh`, as a new `run_if`-guarded leg alongside 222-01 through 222-08.

- Test 2:
  - Type: integration
  - Location: same file
  - Given: a room seeded with >= N qualifying `f_selector_decision` rows.
  - When: the chosen production path runs end to end (not `maybeUpdateHedgeWeights` called directly, which `tests/test-222-hedge-update.cjs` already covers).
  - Then: `ranker_weights` carries an advanced `updateCount`. Mutation-prove it: disabling the new wiring must turn this leg red.
  - Runner registration: same leg.

## Non-Code Follow-ups

- CHANGELOG.md: no entry until a resolution ships. This filing changes no behavior.
- Release lockstep: not applicable to this filing.
- Canon: Part 9 (memory locality) is unaffected either way; both options keep every read and write on the `navigation.cjs` chokepoint.
- Dev-research compositing (CLAUDE.md): mirrored as a dated entry under `~/MindrianRooms/rethinking-mindrianos/research/`, cross-linked to `.planning/quick/260728-7kc-fix-hidden-write-in-read-only-mcp-tools-/260728-7kc-PLAN.md`.
- Scope note: this file is OPEN and explicitly out of scope for quick task 260728-7kc. It is filed so an outcome-learning layer does not go quiet by accident.

## Second finding recorded here (same audit, different defect)

`contradiction_check` and `whitespace_scan` in `lib/mcp/tools/sensors.cjs` carry the SAME migrate-on-open defect the quick task fixed for the two pull tools: both declare `hitl_shape: 'none'`, both open through `navigation.openRoomDbForCaller`, and that door mkdirSyncs `.mindrian/`, runs 13 `CREATE TABLE IF NOT EXISTS` statements and 5 migrations on every open. They are otherwise pure reads, so the read-only door is a drop-in. The one behavior question to settle first: today they return `{ ok: false, reason: 'no_room_db' }` when the open returns null, and under the read-only door that branch would begin firing for a Tier 0 room that previously received a freshly created empty database instead. Named as a follow-up, deliberately not fixed, because the quick task was scoped to the two pull tools.

## Resolution

Option B, shipped by quick task 260728-8av: the Hedge weight refit moved OFF `rankFiredCandidates` entirely, onto a new explicit navigator-triggered entry point, `scripts/hedge-refit-pipeline.cjs::runHedgeRefit(roomDir, opts)`. A navigator (or a future `/mos:*` wrapper, deliberately not minted here) now reaches the fold with `node scripts/hedge-refit-pipeline.cjs <room>`.

Option A (thread `ctx.roomDb` into every production `decide()` caller) was rejected: it would put a 500-row `findRecentChanges` query plus a potential write-back on the per-turn hot path for every navigator turn, the exact load profile quick task 260728-7kc had just removed from the MCP poll path. Ripping the fold out was also rejected: `maybeUpdateHedgeWeights` stays, byte-unchanged in its body, only its trigger moved.

Former step (i) inside `rankFiredCandidates` (`lib/workflow/reach-hedge-ranker.cjs`) was deleted in its entirety. This is a proven no-op on every shipped surface, not a behavior change: this RCA's own Evidence item 1 already established that `ctx.roomDb` is threaded into `decide()` from exactly one place repo-wide, a test, so the deleted call site had never once fired with a live handle in production. The surrounding prose (the `rankFiredCandidates` header contract, the OPT-IN READ-ONLY MODE paragraph, the `maybeUpdateHedgeWeights` docstring, the WR-03 500-row-cap comment, and the CR-01 comment in `lib/core/navigation/ranker-weights.cjs`) was truthed up in the same commit so no comment claims a call chain that no longer exists.

Two integration proofs are now on the Phase 222 gate, in `tests/test-222-fold-wired.cjs` (registered as leg 222-09 in `tests/run-all-222.sh`, plus a Part 8 sweep extension and a dedicated Part 9 chokepoint sweep for the new entry point): a production call-site census (this RCA's Test 1, with the `tests/` exclusion proven load-bearing rather than decorative) and an end-to-end refit proof through the real production path (this RCA's Test 2), plus a debounce control and a write-free-hot-path control with its own foldability check. `tests/test-222-readonly-rank.cjs` (shipped by 260728-7kc, hours before this fix) had four arms asserting the removed behavior; all four were repaired to assert the stronger claim that the ranking call folds nothing in any mode, plus one collateral repair (E1c's write-path control, which also routed through `rankFiredCandidates`) traced to the same root cause and fixed the same way.

Two things stay explicitly OPEN, not quietly absorbed:
- The Second Finding above (`contradiction_check` / `whitespace_scan` carrying the same migrate-on-open defect as the two pull tools this RCA's originating quick task fixed) is unresolved. Still a named follow-up, still out of scope here.
- No surface yet READS `ranker_weights` to tell a navigator the outcome-learning layer has started learning. The fold can now fire, and `runHedgeRefit`'s own return value discloses `updated` / `updateCount` / `weights` at the command line, but nothing surfaces that in a dashboard, a statusline segment, or a room-state read. The layer is reachable now, not yet visible.

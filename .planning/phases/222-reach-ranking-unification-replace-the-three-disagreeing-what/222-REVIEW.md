---
phase: 222-reach-ranking-unification-replace-the-three-disagreeing-what
reviewed: 2026-07-15T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - docs/ENV-TUNING.md
  - lib/core/migrations/phase-222-ranker-weights.cjs
  - lib/core/navigation-engine.cjs
  - lib/core/navigation.cjs
  - lib/core/navigation/memory-events.cjs
  - lib/core/navigation/ranker-weights.cjs
  - lib/core/room-db.cjs
  - lib/mcp/tools/sensors.cjs
  - lib/workflow/reach-hedge-ranker.cjs
  - tests/run-all-222.sh
  - tests/test-222-degrade.cjs
  - tests/test-222-frozen-scalars.cjs
  - tests/test-222-hedge-update.cjs
  - tests/test-222-rank-fired.cjs
  - tests/test-222-reach-wired.cjs
  - tests/test-222-weight-state.cjs
  - tests/test-222-zero-deps.cjs
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 222: Code Review Report

**Reviewed:** 2026-07-15T00:00:00Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Reviewed the Phase 222 reach-ranking-unification surface: the `ranker_weights` migration + typed
accessor pair (D-02), the shared `reach-hedge-ranker.cjs` Hedge/MWU combiner (D-01/D-03), and the
two wiring sites (`navigation-engine.cjs::decide()` and `lib/mcp/tools/sensors.cjs::dispatchCandidateReaches`).

`bash tests/run-all-222.sh` passes clean (10/10, PASS=10 FAIL=0 SKIP=0). No SQL injection: every
statement in the migration and `ranker-weights.cjs` is parameterized (`?` placeholders); the CREATE
TABLE DDL concatenates only static strings. The chokepoint invariant holds: `ranker_weights` is
touched by exactly two files (the migration and `ranker-weights.cjs`); every consumer reaches it via
`navigation.readHedgeWeightState` / `navigation.upsertHedgeWeightState`, confirmed by a repo-wide
grep. Wicked-escalation precedence (resolveFireSkill step 1, always evaluated before the reordered
`sensorReaches` array is read) and the dead-Brain/zero-fired degrade path are byte-unchanged and
covered by regression tests (ARM 5/ARM 6 in `test-222-reach-wired.cjs`) — confirmed correct by
manual trace, not just by the shipped test.

The main substantive concern is a real (empirically reproduced) data-loss landmine in the shared
`upsertWeightState` transaction wrapper when it is invoked against a caller-supplied db handle that
is already mid-transaction — not currently triggered by any shipped caller, but the new write path
is reachable from `decide()`'s hot per-turn `ctx.roomDb` seam, which previous engine behavior never
exercised as a write surface. A secondary, genuine modeling defect in the Hedge learning math: the
"registry order" feature used to derive historical training losses is defined differently from the
"registry order" feature actually blended into the live ranking score, so the learned weight is
calibrated against a different signal than the one it is applied to.

## Critical Issues

### CR-01: `upsertWeightState`'s BEGIN/ROLLBACK can silently discard a caller's unrelated pending transaction on the threaded `ctx.roomDb` handle

**File:** `lib/core/navigation/ranker-weights.cjs:79-93` (invoked transitively from `lib/workflow/reach-hedge-ranker.cjs:317` inside `maybeUpdateHedgeWeights`, itself called from `rankFiredCandidates` at `lib/workflow/reach-hedge-ranker.cjs:385`, itself called from `lib/core/navigation-engine.cjs:941-947` with `db: ctx.roomDb || null`)

**Issue:** `upsertWeightState` wraps its two-row upsert in `db.exec('BEGIN')` / `db.exec('COMMIT')`,
and on any exception does an unconditional `db.exec('ROLLBACK'); throw err;`. `node:sqlite`'s
`DatabaseSync` does not support nested transactions: if the handle passed in is *already* inside an
open, uncommitted transaction when `db.exec('BEGIN')` runs, the `BEGIN` itself throws
(`cannot start a transaction within a transaction`) — but the transaction that was already open is
still live. The catch block then unconditionally issues `ROLLBACK`, which succeeds and discards
**everything the caller had written in that outer transaction**, not just this module's own (failed)
insert. Verified empirically against `node:sqlite`:

```
$ node -e "
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(':memory:');
db.exec('CREATE TABLE t (id INTEGER)'); db.exec('BEGIN');
db.prepare('INSERT INTO t (id) VALUES (?)').run(1);
try { db.exec('BEGIN'); } catch (e) { console.log('nested BEGIN threw:', e.message); }
db.exec('ROLLBACK');
console.log('count after rollback:', db.prepare('SELECT COUNT(*) c FROM t').get());
"
nested BEGIN threw: cannot start a transaction within a transaction
count after rollback: { c: 0 }   // the caller's INSERT is GONE
```

Before Phase 222, `decide()` (`lib/core/navigation-engine.cjs`) never wrote to `room.db` through a
caller-threaded handle — it was documented as reading only (`ctx.roomDb` was read-only input to
graph queries). Phase 222 makes `decide()` transitively call `upsertHedgeWeightState` on the same
`ctx.roomDb` handle whenever the debounce threshold (N=50 qualifying `f_selector_decision` rows)
fires, roughly once every 50 turns. The failure is triple-swallowed: `upsertWeightState`'s error
propagates to `maybeUpdateHedgeWeights`'s own `try/catch` (`reach-hedge-ranker.cjs:283-324`, catches
to `{updated:false}`) which is itself inside `rankFiredCandidates`'s outer `try/catch`
(`reach-hedge-ranker.cjs:351-393`), so nothing is ever logged, no `reach_weight_state_unavailable`
degrade event fires (that event is only emitted from the *read* path), and the caller has no way to
discover that an unrelated transaction it opened on the same handle was just silently rolled back.

Today's only production caller that threads `ctx.roomDb` into `decide()`
(`scripts/intent-classifier.cjs`) does not currently hold an open transaction on that handle at the
point `decide()` is called (every other write on that handle — `logMemoryEvent`,
`computeReachPenalties` — is a self-contained single-statement operation), so this is not observed
in practice today. But `decide()` is a documented chokepoint-adjacent entry point with a broad and
growing caller surface, and the codebase already uses the identical `BEGIN`/`ROLLBACK` idiom
pervasively elsewhere (`focus.cjs`, `transitions.cjs`, `ingestion.cjs`, `room-birth.cjs`) — a future
caller that wraps a multi-step room.db mutation in its own transaction and then calls `decide()` (or
the MCP `suggest_next`/`reach_candidates` tools with a db handle it also holds open, though those
currently open a *fresh* handle so are not exposed to this) inside that transaction will silently
lose its own work with zero error surfaced anywhere.

**Fix:** Either (a) document and enforce (assertion or a documented API contract) that `ctx.roomDb`
threaded into `decide()`/`rankFiredCandidates` must never be mid-transaction, or (b) make the
degrade path defensive: catch the specific "cannot start a transaction within a transaction" error
and skip the write (return `{updated:false}`) instead of running `ROLLBACK` unconditionally, e.g.:

```javascript
db.exec('BEGIN');
} catch (err) {
  if (/cannot start a transaction within a transaction/.test(err && err.message)) {
    throw err; // propagate WITHOUT rolling back state this module does not own
  }
  db.exec('ROLLBACK');
  throw err;
}
```

## Warnings

### WR-01: The "registry order" signal used to train the Hedge weight differs from the "registry order" signal used to apply it

**File:** `lib/workflow/reach-hedge-ranker.cjs:170-181` (training-time, `deriveExpertLosses`) vs. `lib/workflow/reach-hedge-ranker.cjs:361-372` (inference-time, `rankFiredCandidates`)

**Issue:** At inference time, `registrySignal = 1 / (index + 1)` where `index` is the candidate's
position **within this turn's fired subset** (line 371) — so whichever reach happens to be first
among *whatever fired this turn* always gets `registrySignal = 1`, regardless of its absolute
position in the canonical 6-reach registry. At training time, `deriveExpertLosses` computes
`endorsementRegistry = 1 / (rank + 1)` where `rank = REACH_IDS.indexOf(reachId)` (line 170) — the
reach's **fixed, absolute position in the canonical `REACH_IDS` list**. These are two different
features sharing one name: e.g. if `contradiction` (canonical index 1) and `hats` (canonical index
5) are the only two reaches to co-fire on some turn, at ranking time `contradiction` gets
`registrySignal = 1` (it's first among what fired), but at training time on a historical row for
that same turn, `contradiction` only ever gets `endorsementRegistry = 1/2 = 0.5` (its fixed canonical
rank), and `hats` never gets anything higher than `1/6 ≈ 0.167` no matter how it fired. The Hedge
layer is therefore learning a weight for a feature it is not actually applying — the `registry_order`
expert's learned trust level is calibrated against the wrong proxy, which can systematically bias
convergence in either direction depending on which reaches tend to co-fire together. Phase 222's own
`222-RESEARCH.md` (Assumption A2) flags the definition of "rank" as an open, non-load-bearing,
"tunable" question, but does not call out that the two usages inside the shipped code are internally
inconsistent with each other.

**Fix:** Pick one definition and use it in both places. If the intent is "front-of-dispatch-order
generally" (the training-time definition), `rankFiredCandidates` should compute
`registrySignal` from `REACH_IDS.indexOf(reach.reach_id)`, not from the fired-array's own index. If
the intent is "first among what fired this turn" (the inference-time definition, which is more
useful as a live ranking signal), `deriveExpertLosses` needs the ORIGINAL fired-array position of
the historical row's reach — which is not persisted today (a real gap; f_selector_decision rows only
store `reach_id`), so the training-time proxy would need to change or be explicitly documented as an
approximation of a different, correlated signal.

### WR-02: `upsertWeightState` validates finiteness but not sign, despite the read-side treating a negative weight as corruption

**File:** `lib/core/navigation/ranker-weights.cjs:59-72`

**Issue:** The write-side validation is `typeof w !== 'number' || !Number.isFinite(w)` — it accepts
negative numbers. The module's own header comment claims "write side VALIDATES" as the
counterpart to the read side's "DISCLOSES" honesty contract, and the read side
(`readHedgeWeights` in `reach-hedge-ranker.cjs:215-249`) explicitly treats `v < 0` as a corrupt
scalar worth emitting a degrade event over. Under the current call graph a negative weight can only
reach the write path via a correctly-converged `hedgeUpdate` (which is exp-based and cannot go
negative from a valid, non-negative start), so this is not exploitable today, but the accessor is
the documented single governed door for this table — a future caller (or a bug anywhere in the fold
logic) that computes a negative weight will have it silently accepted and persisted here, then
surface as a confusing "corrupt_scalar" degrade event on the *next* read rather than being rejected
at the point of the actual mistake.

**Fix:** Add `|| w < 0` to the validation in the `for (const id of expertIds)` loop
(`ranker-weights.cjs:67-72`), matching the read side's own definition of "corrupt."

### WR-03: `maybeUpdateHedgeWeights`'s 500-row cap on `findRecentChanges` can permanently strand outcome rows if the fold falls behind

**File:** `lib/workflow/reach-hedge-ranker.cjs:294-296, 311-320`

**Issue:** `findRecentChanges(db, since, {eventType: 'f_selector_decision', limit: 500})` returns at
most the 500 most-recent qualifying rows since the last fold. `newestTs` (the value persisted as the
next fold's `since`) is derived only from the rows actually returned (`kept`, itself a subset of the
capped 500). If a room accumulates more than 500 `f_selector_decision` events between folds (e.g. the
debounce trigger never runs because `db` was null on every intervening turn, or a bug elsewhere
suppresses the trigger for a long stretch), the events strictly older than the 500th-most-recent are
never fetched again on any subsequent fold, because `since` jumps straight to (approximately) "now."
Those rows silently never contribute to the learned weights — no error, no degrade event, no test
coverage for this boundary.

**Fix:** Either loop `findRecentChanges` with pagination until fewer than `limit` rows are returned,
or explicitly document the 500-row cap as an accepted, intentional bound (with a comment analogous to
the "historical reachScores are not persisted" limitation already called out at
`reach-hedge-ranker.cjs:156`) so it reads as a deliberate tradeoff rather than an oversight.

### WR-04: `suggest_next` / `reach_candidates` are declared `hitl_shape: 'none'` ("Pure read... no fork") but can now trigger a room.db write

**File:** `lib/mcp/tools/sensors.cjs:326-346` (connectors) vs. `lib/mcp/tools/sensors.cjs:98-120` (`dispatchCandidateReaches`)

**Issue:** `dispatchCandidateReaches` opens a fresh `room.db` handle via `navigation.openRoomDbForCaller`
whenever >= 2 reaches fire, and hands it to `reachHedgeRanker.rankFiredCandidates`, which (per D-01)
will call `maybeUpdateHedgeWeights` and persist a new weight snapshot via `upsertHedgeWeightState`
roughly every 50 qualifying outcome rows. The connector metadata for both tools still describes them
as pure reads with `hitl_why: 'Pure read: pulls the ... candidate reach ... no fork.'` This is not a
HITL-gating problem (a system-bookkeeping weight-state write is not a material step requiring
approval), but the "Pure read" characterization is no longer literally accurate, and Part 9's
allow-list reasoning for treating this tool as read-only should be revisited if any future doctor/
audit tooling relies on the `hitl_shape: 'none'` declaration to assume zero write side effects for
these two tools.

**Fix:** Update the `hitl_why` strings to acknowledge the internal bookkeeping write (e.g. "Pure read
of the candidate-reach set; the shared ranker may persist an internal Hedge weight snapshot as a
side effect, never a material/user-visible write"), or confirm with the Part 11 tooling that
`hitl_shape: 'none'` is defined narrowly enough (no *material* fork) that this distinction doesn't
matter for the born-wired contract.

## Info

### IN-01: `upsertWeightState` does not enforce that a write supplies both `EXPERT_IDS`, allowing the two rows to drift out of sync

**File:** `lib/core/navigation/ranker-weights.cjs:59-72`

**Issue:** The only validation is "non-empty object of finite numbers" — a caller supplying
`{ d4_blend: 0.7 }` alone would leave the `registry_order` row's `updated_at`/`update_count`
unchanged while `d4_blend`'s advances, producing a `readWeightState().updatedAt` that reflects only
one of the two rows. No current call site does this (both `maybeUpdateHedgeWeights` and every test
always supply both keys together), so this is latent robustness debt rather than an active bug.

**Fix:** Consider requiring `Object.keys(weights)` to be exactly `EXPERT_IDS` (or documenting why a
partial write is intentionally supported) so the chokepoint's own invariant ("this table always
carries a consistent pair") is enforced rather than assumed by convention.

### IN-02: The migration's `sentinelPresent` catches all errors identically, masking real vs. absent-sentinel cases

**File:** `lib/core/migrations/phase-222-ranker-weights.cjs:28-35`

**Issue:** `sentinelPresent` returns `false` on any exception from the `SELECT ... FROM identity`
query, including transient I/O errors unrelated to whether the sentinel actually exists. This is
harmless in practice (the migration body is itself idempotent via `CREATE TABLE IF NOT EXISTS` and
`INSERT OR REPLACE`), and it mirrors the pre-existing `phase-109-session-focus.cjs` precedent
verbatim, so it is not a Phase-222-specific defect — noted for completeness only, no action
required.

---

_Reviewed: 2026-07-15T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

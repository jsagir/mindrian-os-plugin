---
phase: 222-reach-ranking-unification-replace-the-three-disagreeing-what
fixed_at: 2026-07-15T05:41:29Z
fix_scope: critical_warning
findings_in_scope: 5
fixed: 5
skipped: 0
iteration: 1
status: all_fixed
---

# Phase 222: Code Review Fix Report

**Fixed at:** 2026-07-15T05:41:29Z
**Source review:** .planning/phases/222-reach-ranking-unification-replace-the-three-disagreeing-what/222-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (CR-01, WR-01, WR-02, WR-03, WR-04)
- Fixed: 5
- Skipped: 0

Every fix was applied in an isolated git worktree (per the gsd-code-fixer
convention for background-job commit safety), committed atomically per
finding, verified against `bash tests/run-all-222.sh` after each fix, then
fast-forwarded onto `main`. Info items IN-01 and IN-02 were left untouched
(out of scope for this pass, as instructed).

## Fixed Issues

### CR-01: `upsertWeightState`'s BEGIN/ROLLBACK could silently discard a caller's unrelated pending transaction

**Files modified:** `lib/core/navigation/ranker-weights.cjs`, `tests/test-222-weight-state.cjs`
**Commit:** `1f7c21a1`

**What was found:** `upsertWeightState` wrapped its two-row upsert in an
unconditional `db.exec('BEGIN')` / `COMMIT`, with `catch { db.exec('ROLLBACK'); throw err; }`.
`node:sqlite`'s `DatabaseSync` has no nested-transaction support: a nested
`BEGIN` against an already-open transaction throws, and the unconditional
`ROLLBACK` in the catch block then discards the **caller's entire pending
transaction**, not just this module's own failed insert.

**Root cause:** The function assumed it always owns the transaction boundary
on the `db` handle it receives. Before Phase 222, no caller threaded a
mid-transaction handle into this write path. Phase 222 makes `decide()`
transitively reach `upsertHedgeWeightState` through `ctx.roomDb` (via
`rankFiredCandidates` -> `maybeUpdateHedgeWeights`), a handle that is
documented as read-only before this phase and now carries a real write
surface the module never defended against.

**What was changed:** Checked `db.isTransaction` (a real, verified
`node:sqlite` `DatabaseSync` property -- confirmed via direct probe:
`false` before `BEGIN`, `true` after) before issuing `BEGIN`/`COMMIT`/
`ROLLBACK`. When a transaction is already open, `upsertWeightState` performs
its writes as part of the caller's existing transaction and issues none of
its own transaction-control statements -- the caller who opened the
transaction keeps sole ownership of its commit/rollback fate.

**Regression test added:** `test-222-weight-state.cjs` check (8) opens a real
room db, starts an outer transaction, inserts into an unrelated scratch
table, calls `upsertHedgeWeightState` mid-transaction, then commits and
verifies BOTH the scratch insert and the weight-state write survived.
Verified this test fails against the pre-fix code with exactly the
"cannot start a transaction within a transaction" error the review predicted,
and passes with the fix.

**Test verification:** `bash tests/run-all-222.sh` -> PASS=10 FAIL=0 SKIP=0
(test-222-weight-state.cjs check count 7 -> 8).

### WR-01: The "registry order" signal used to train the Hedge weight differs from the one blended into the live score

**Files modified:** `lib/workflow/reach-hedge-ranker.cjs`, `tests/test-222-rank-fired.cjs`
**Commit:** `60ba92c7`

**What was found:** At inference time, `rankFiredCandidates` computed
`registrySignal = 1/(index+1)` over the fired subset's OWN turn-relative
position. At training time, `deriveExpertLosses` computed
`endorsementRegistry = 1/(rank+1)` over the reach's FIXED, absolute
`REACH_IDS` position. Two different features sharing one name -- the Hedge
layer was learning a weight for a signal it never actually applied at
inference time.

**Root cause:** The two call sites were written independently against the
same informal name ("registry order") without a single shared definition to
anchor them.

**Judgment call (documented per this project's "adapt, don't blindly apply"
fixer discipline):** The review offered two directions to unify on. The
originating task guidance leaned toward retrofitting training to the
turn-relative (inference-time) definition. Investigated this directly:
historical `f_selector_decision` rows persist only `reach_id` + `decision`
(confirmed by reading `selector-decisions.cjs`'s write payload) -- the
fired-subset context a past turn saw is not persisted anywhere, so the
turn-relative signal cannot be reconstructed at training time without a new
persisted field and changes to every write site in `selector-decisions.cjs`.
That is a materially larger, higher-risk change than this fix pass's scope.
Instead, unified in the other direction: made the live blend use the
canonical, always-computable `REACH_IDS` position (the definition training
already used), which requires zero new persisted data and zero schema/logging
changes, while still fully closing the defect -- both features are now the
literal same formula on the same input.

**What was changed:** Extracted `canonicalRegistryRank(reachId)` as the ONE
shared definition (`REACH_IDS.indexOf`, floored to `REACH_IDS.length` for an
off-registry id so a live fired candidate can never divide by zero or produce
`NaN`). `rankFiredCandidates`'s `registrySignal` now calls this helper instead
of using the fired array's own `map()` index. `deriveExpertLosses` already
used the equivalent definition; its skip-on-`-1` behavior for off-registry
historical rows was left untouched (that is correct training-time behavior --
drop bad data rather than score it). The stable tie-break in `rankFiredCandidates`
still uses the original fired-array index; only the registry SCORE changed.

**Regression tests added:** `test-222-rank-fired.cjs` checks (7)/(7b)/(7c):
(7) a live-blend ordering proof where `hats` (canonical rank 5) fires first
this turn but `contradiction` (canonical rank 1) must still win a
registry-only blend; (7b) a direct `canonicalRegistryRank` <->
`REACH_IDS.indexOf` equivalence check plus the off-registry floor; (7c) a
formula-equivalence proof between `deriveExpertLosses`' endorsement and the
live `registrySignal`. Verified check (7) fails against the pre-fix code with
the exact inverted ordering (`hats` where `contradiction` was expected), and
passes with the fix.

**Test verification:** `bash tests/run-all-222.sh` -> PASS=10 FAIL=0 SKIP=0
(test-222-rank-fired.cjs check count 6 -> 9).

### WR-02: `upsertWeightState` validated finiteness but not sign, despite the read side treating a negative weight as corruption

**Files modified:** `lib/core/navigation/ranker-weights.cjs`, `tests/test-222-weight-state.cjs`
**Commit:** `d22b1dbb`

**What was found:** Write-side validation was
`typeof w !== 'number' || !Number.isFinite(w)` -- it accepted negative
numbers. The read side (`readHedgeWeights` in `reach-hedge-ranker.cjs`)
explicitly treats a stored `v < 0` as a `corrupt_scalar` degrade condition.

**Root cause:** The module's own header comment claims "write side
VALIDATES" as the read side's "DISCLOSES" counterpart, but the write-side
validation and the read side's definition of "corrupt" had silently
diverged -- a negative weight could be accepted at write time and only
surface as a confusing degrade event on a LATER, unrelated read.

**What was changed:** Added `|| w < 0` to the write-side validation loop,
matching the read side's own corruption definition exactly. Updated the
module docblock to document the parity explicitly. Validation runs fully
before any db write, so a rejected negative-weight write is all-or-nothing
(cannot partially land).

**Regression test added:** `test-222-weight-state.cjs` check (5b): a
negative-weight write must throw AND must not have partially landed (state
must equal whatever the prior valid write left it at). Also updated check
(5)'s assertion regex from `/finite number/` to `/finite, non-negative number/`
to match the more precise error message. Verified (5b) fails against the
pre-fix code (accepts the negative weight silently; old message lacks
"non-negative"), and passes with the fix.

**Test verification:** `bash tests/run-all-222.sh` -> PASS=10 FAIL=0 SKIP=0
(test-222-weight-state.cjs check count 8 -> 9).

### WR-03: The 500-row cap on `findRecentChanges` inside `maybeUpdateHedgeWeights` could permanently strand outcome rows if a room's fold fell behind

**Files modified:** `lib/workflow/reach-hedge-ranker.cjs`
**Commit:** `ab24c736`

**What was found:** `findRecentChanges(db, since, {..., limit: 500})` returns
at most 500 rows; `since` (the next fold's floor) only advances from rows
actually returned. If more than 500 qualifying rows accumulate between two
folds, the rows beyond the cap are never seen again.

**Root cause investigated (not assumed):** `since` only advances on a
SUCCESSFUL fold (>= N qualifying rows kept) -- an under-N invocation
re-queries the identical floor next time, losing nothing. `maybeUpdateHedgeWeights`
is invoked on essentially every multi-candidate turn/pull where `db` is
present (both from `decide()`'s per-turn call when `ctx.roomDb` is threaded,
and from `sensors.cjs`'s `dispatchCandidateReaches` on every multi-candidate
MCP `suggest_next`/`reach_candidates` pull) -- the debounce threshold N gates
only the WRITE, never this query. N defaults to 50
(`HEDGE_UPDATE_N_DEFAULT`, confirmed in `docs/ENV-TUNING.md`), a full 10x
margin under the 500 cap, and each qualifying row requires a genuine user
accept/reject/defer decision (`selector-decisions.cjs`), not a per-turn
firehose. Rows can only strand if more than 500 NEW qualifying rows
accumulate strictly BETWEEN two consecutive invocations of this function --
under normal operation, invocation cadence far outpaces the rate a user can
produce qualifying decisions. The only realistic path to reachability is the
already-degraded scenario the review itself named (db persistently null
across many intervening decision-producing turns, or a bug suppressing
invocation for a long stretch) -- at that point pagination would mask a
deeper fault rather than fix the actual problem.

**What was changed:** No behavioral change. Documented this analysis inline
at the `findRecentChanges` call site, in the same "TUNABLE-LATER, revisit if
the corpus grows" style the existing `historical reachScores are not
persisted` limitation comment already uses in this file, so the bound reads
as a verified, deliberate tradeoff rather than an unreviewed oversight -- per
the review's own guidance that a documented accepted bound is the
right-sized fix when the math confirms the cap is not practically reachable.

**Test verification:** `bash tests/run-all-222.sh` -> PASS=10 FAIL=0 SKIP=0
(comment-only change; no new checks needed since no behavior changed).

### WR-04: `suggest_next` / `reach_candidates` declared `hitl_shape: 'none'` ("Pure read... no fork") but can now trigger a room.db write

**Files modified:** `lib/mcp/tools/sensors.cjs`, `data/mcp-tool-connectors.json`, `data/connector-registry.json`
**Commit:** `3d3719f4`

**What was found:** Both tools' `hitl_why` strings read "Pure read: ... no
fork," literally asserting zero write side effects. As of Phase 222,
`dispatchCandidateReaches` opens `room.db` and can persist a debounced Hedge
weight-state snapshot via `maybeUpdateHedgeWeights` roughly every 50
qualifying outcome rows.

**Root cause / contract check:** Read `docs/HITL-SHAPE-DECLARATION-CONTRACT.md`
and `scripts/check-shape-declaration.cjs` directly to determine what
`hitl_shape: 'none'` actually guarantees. Confirmed: `hitl_shape` classifies
whether a surface reaches a navigator-facing Decision-Gate fork (a place the
navigator picks among options) -- it says nothing about writes. Neither tool
reaches such a fork; the Hedge weight write is a system-internal bookkeeping
operation the caller never chooses or approves. So `hitl_shape: 'none'` is
still the CORRECT declaration -- this was not a HITL-gating defect. It WAS a
stale `hitl_why` string that could mislead a future doctor/audit surface
into assuming zero write side effects.

**What was changed:** Kept `hitl_shape: 'none'` (verified correct). Reworded
both `hitl_why` strings to state the tools reach no navigator-facing fork
while explicitly disclosing the debounced, system-internal write, framed as
never material/user-visible and never gated on approval -- so the actual HITL
guarantee (no unattended fork) is preserved and now accurately described.
Regenerated `data/mcp-tool-connectors.json` and `data/connector-registry.json`
via `node scripts/build-connector-registry.cjs` (the documented generator for
these files; the module's own header forbids hand-editing them) so the
derived registries stay byte-consistent with the `sensors.cjs` source of
truth.

**Verification beyond the fix-pass test loop:**
- `node scripts/build-connector-registry.cjs --check` -> `connector-registry: OK` (exit 0)
- `node scripts/check-shape-declaration.cjs --check` -> no new violations for
  either tool (two pre-existing, unrelated advisory WARNs on
  `skills/vault/SKILL.md` and `skills/visualize/SKILL.md` are untouched by
  this change)

**Test verification:** `bash tests/run-all-222.sh` -> PASS=10 FAIL=0 SKIP=0
(declaration/documentation-only change; no behavior change).

## Skipped Issues

None -- all 5 in-scope findings were fixed.

## Out of Scope (per fix_scope: critical_warning)

- **IN-01** (`upsertWeightState` does not enforce both `EXPERT_IDS` land
  together) -- left untouched, as instructed.
- **IN-02** (migration's `sentinelPresent` catches all errors identically) --
  left untouched, as instructed; the review itself notes this mirrors a
  pre-existing repo-wide precedent and requires no action.

## Final Verification

```
bash tests/run-all-222.sh
======================================
Phase 222: PASS=10 FAIL=0 SKIP=0
======================================
```

All 10 legs green, zero regressions. Check counts grew as expected from the
new regression tests added by this fix pass:
- `test-222-weight-state.cjs`: 7 -> 9 checks (CR-01 check 8, WR-02 check 5b)
- `test-222-rank-fired.cjs`: 6 -> 9 checks (WR-01 checks 7/7b/7c)

All five fixes were committed atomically on an isolated worktree/branch
(`gsd-reviewfix/222-974972`, off `fb1e757d`) per the gsd-code-fixer
background-job safety convention, then fast-forwarded onto `main` (now at
`3d3719f4`) and the worktree/branch/recovery-sentinel were cleaned up.
Commit hashes, in order: `1f7c21a1` (CR-01), `60ba92c7` (WR-01), `d22b1dbb`
(WR-02), `ab24c736` (WR-03), `3d3719f4` (WR-04).

---

_Fixed: 2026-07-15T05:41:29Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

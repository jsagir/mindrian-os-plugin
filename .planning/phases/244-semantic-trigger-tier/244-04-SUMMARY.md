---
phase: 244-semantic-trigger-tier
plan: 04
subsystem: workflow-ranker
tags: [rrf-fusion, f-selector-ranker, orchestration-candidate-lift, trig-02, rank-fusion, canon-part-7]

# Dependency graph
requires: [244-01]
provides:
  - "rankForSelector optional o.tierCandidates seam: absent/empty -> byte-identical no-op"
  - "_applyTierFusion(scored, tierCandidates, k): the layered cross-family rank-fusion pass, exported"
  - "TRIG_RRF_K: dedicated env-tunable fusion k (default 25), exported"
  - "buildTierCandidates(sensorReaches, projectionOffer): the live production supplier in orchestration-candidate-lift.cjs, exported"
  - "tests/test-244-rrf-fusion.cjs: 21 assertions fencing both ends of the seam"
affects: [244-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optional-signal threading into rankForSelector (o.tierCandidates), copying the sens10/role_level idiom exactly: absent/empty -> byte-identical no-op"
    - "Layered adjustment pass with no-op guard + copy-on-write (_applyTierFusion), the third instance of the _applySens10Flip/_applyRoleLevelBias pattern"
    - "Function-local require to avoid a module-load cycle (rrfFuse required inside _applyTierFusion, the navigation-engine.cjs:510 idiom)"
    - "Live-seam proof by observation (an injected rankFn stub recording its call args), not by reading the code"

key-files:
  created:
    - tests/test-244-rrf-fusion.cjs
  modified:
    - lib/workflow/f-selector-ranker.cjs
    - lib/core/orchestration-candidate-lift.cjs

key-decisions:
  - "TRIG_RRF_K is a DEDICATED env var, never overloading EUREKA_RRF_K -- the two consumers (eureka's room-scale corpus vs this ranker's MAX_K=3-bounded dial list) have different corpus sizes, so sharing one dial would couple two unrelated tuning knobs. Comment text avoids the literal string EUREKA_RRF_K entirely so the acceptance grep for it stays clean."
  - "Fusion runs on the FULL pre-slice scored list, then the existing sens10-or-slice branch runs unchanged on the fused list -- this is the ONLY ordering that lets a D4-position-4/5 candidate reach the top k while keeping the absent-tierCandidates path byte-identical to scored.slice(0, k)."
  - "tier_family is stamped 'command' on every returned row (not differentiated by which supplied list matched) -- per 244-RESEARCH.md/244-04-PLAN.md's literal <behavior> spec; a row's tier_family marks the row TYPE (a command-registry row), not the tier that promoted it. rrf_score + tier_sources (which DO vary per row) carry the promotion evidence instead."
  - "buildTierCandidates falls back an option to tier_keyword whenever its matching reach carries no evidence.trigger_tier OR when no reach matches its reach_id at all -- both cases read as 'no stronger evidence available', so both degrade to the same documented fallback rather than two different unlabeled states."
  - "The malformed-tierCandidates no-op guard lives in TWO places: the top-level `Array.isArray(o.tierCandidates) ? o.tierCandidates : null` read (catches non-array garbage) and a second usable-item count inside _applyTierFusion (catches an array that IS an array but contributes zero usable items -- nulls, items without id). Both are required because 'an array of nulls' passes the first guard but must still degrade to no-op."

requirements-completed: [TRIG-02]

# Metrics
duration: ~90min
completed: 2026-07-30
---

# Phase 244 Plan 04: Cross-Family Rank Fusion (TRIG-02) Summary

**Threaded an optional `o.tierCandidates` argument into `rankForSelector` that fuses the D4 command registry ranking against caller-supplied tier-tagged command lists via the already-shipped `rrfFuse`, wired both ends live: `orchestration-candidate-lift.cjs::buildTierCandidates` is a genuine production caller that builds those lists from data already in its own scope (fired sensor reaches + the projection offer).**

## Performance

- **Duration:** ~90 min
- **Completed:** 2026-07-30
- **Tasks:** 3/3
- **Files modified:** 3 (1 new, 2 modified)

## Accomplishments

- `rankForSelector` accepts an optional `o.tierCandidates` whose absence (or an empty array) is a byte-identical no-op, verified against a captured pre-change baseline across two full test suites.
- `_applyTierFusion(scored, tierCandidates, k)` fuses the D4-scored `command_d4` list against caller-supplied tagged lists via `hybrid-retrieve.cjs::rrfFuse` (no second fusion implementation written), running on the FULL pre-slice `scored` array so a cross-family candidate buried at D4 position 4/5 can reach the top `k`.
- `TRIG_RRF_K` is a dedicated, env-tunable constant (default 25, the repo's own researched small-corpus value), never overloading `EUREKA_RRF_K`.
- `orchestration-candidate-lift.cjs::buildTierCandidates(sensorReaches, projectionOffer)` is the live production supplier: it groups `projectionOffer.options` by tier family (read off the matching fired reach's `evidence.trigger_tier`, coerced to the `keyword` fallback for anything unrecognized or absent), preserving option order, and is wired into the `liftFiringCandidate` confidenceJoin call site.
- `tests/test-244-rrf-fusion.cjs` (21 assertions) fences both ends of the seam: the no-op path, the rank-position/sign-convention invariant, the pre-slice fusion ordering, the frozen `MAX_K` row budget, base-row-cleanliness (copy-on-write), the `buildTierCandidates` grouping/fallback/coercion legs, and the live-seam fence via an injected `rankFn` stub.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the optional tierCandidates seam and the _applyTierFusion pass** - `6830835d` (feat)
2. **Task 2: Give the seam its second end in orchestration-candidate-lift.cjs** - `39dfb36d` (feat)
3. **Task 3: Fence the fusion** - `2c1b90d0` (test)

_No separate plan-metadata commit: SUMMARY.md is committed as part of this worktree's final commit per the parallel-executor protocol (STATE.md/ROADMAP.md are excluded and owned by the orchestrator)._

## Files Created/Modified

- `lib/workflow/f-selector-ranker.cjs` - Added `TRIG_RRF_K` (dedicated env-tunable constant), `_applyTierFusion(scored, tierCandidates, k)` (the layered fusion pass, exported), the `o.tierCandidates` optional-signal read beside `sens10`, the composition change (`_applyTierFusion` runs pre-slice, then the existing sens10-or-slice branch), and an amended purity-contract comment naming the new optional caller-supplied input.
- `lib/core/orchestration-candidate-lift.cjs` - Added `buildTierCandidates(sensorReaches, projectionOffer)` (the live production supplier, exported), extended `buildRankArgs(context, tierCandidates)` to forward `tierCandidates` only when non-empty, and wired the supplier into the `liftFiringCandidate` confidenceJoin call site with an explicit degrade-to-pre-244-path guard.
- `tests/test-244-rrf-fusion.cjs` - New file, 21 assertions covering both tasks' full `<behavior>` blocks plus the SC2 same-family-domination regression, the sign-convention fence, and the live-seam fence.

## Decisions Made

- **`TRIG_RRF_K` is dedicated, not shared with `EUREKA_RRF_K`:** per 244-RESEARCH.md's own recommendation, the two consumers have different corpus sizes (eureka's room-scale corpus vs. this ranker's `MAX_K=3`-bounded dial list). The acceptance grep for `EUREKA_RRF_K` presence must be literally zero, so even the explanatory comment avoids spelling out that token.
- **Fusion ordering is pre-slice, always:** the composition is `scored -> _applyTierFusion -> (sens10-flip-or-slice) -> role_level bias`. This is the only ordering under which a D4-buried cross-family candidate can be promoted while the absent-`tierCandidates` path still lands on `scored.slice(0, k)` byte-identically (proven against a captured baseline, not assumed).
- **`tier_family` is always `'command'`:** per the plan's literal `<behavior>` text ("Every scored row is tagged `tier_family: 'command'` by default, so the field is present on all rows, never undefined on some"), this field marks the row's TYPE (it came from the D4 command registry), not which tier promoted it. The promotion evidence (`rrf_score`, `tier_sources`) is the per-row-varying signal instead.
- **`buildTierCandidates`'s fallback covers two distinct "no stronger evidence" cases identically:** an option whose matching reach has no `evidence.trigger_tier`, and an option with NO matching reach at all, both land in `tier_keyword`. Both are semantically "nothing better than the fallback available," so unifying them avoids inventing a third unlabeled bucket.
- **Two-layer no-op guard in `_applyTierFusion`:** the top-level `Array.isArray` check in `rankForSelector` catches non-array garbage (a string, a number); a second usable-item count inside `_applyTierFusion` itself catches an array that passes `Array.isArray` but contributes zero usable items (an array of nulls, a list whose items lack `id`). Both are required by the plan's explicit malformed-input test matrix.

## Deviations from Plan

None - plan executed exactly as written. All `<must_haves>` truths and artifacts are present:
- `_applyTierFusion`, `TRIG_RRF_K` exported from `f-selector-ranker.cjs` as specified.
- `buildTierCandidates` exported publicly (not `_test`-only) from `orchestration-candidate-lift.cjs`.
- `tests/test-244-rrf-fusion.cjs` fences the no-op fence, rank-position fence, same-family-domination regression, and live-seam fence, all named in `<must_haves>`.

## Issues Encountered

None new. The pre-existing schema-drift failure documented in 244-01-SUMMARY.md (`bash tests/run-all-205.sh` -- `table edges has no column named review_status`, from a concurrent session's parallel commits) was re-confirmed byte-identical before and after every task's edits (see Baselines below); it is out of scope for this plan and left untouched.

One additional pre-existing, unrelated failure was newly observed during this plan's own verification sweep (not caused by this plan): `bash tests/run-all-191.sh` fails one leg, `part8-leak-sweep-191.test.cjs`, with `AssertionError: em-dash sweep: .planning/phases/191-brain-orchestration-advisor/191-CONTEXT.md exists (cannot sweep a missing file)` -- a missing archival file from Phase 191, unrelated to `orchestration-candidate-lift.cjs`'s code. Confirmed byte-identical before and after this plan's edits (see Baselines below).

## Mutation Proofs (4 total, all executed live and reverted)

### Task 1 -- MUTATION PROOF 1 (delete the rrfFuse call)

Changed `_applyTierFusion` to `return scored;` immediately after the no-op guard (bypassing the fusion body entirely). Re-ran `node tests/test-244-rrf-fusion.cjs`:

```
FAIL: every returned row carries tier_family; rows in a supplied list also carry rrf_score + tier_sources -- tier_family must default to "command" on every row
FAIL: fusion runs on the FULL pre-slice scored list: a buried D4-position-4 candidate can reach the top k -- cross-b (D4 position 4, buried) must reach the top 3 once promoted by fusion
FAIL: SC2 same-family-domination: cross-family candidate appears in top 3 WITH fusion, absent WITHOUT it -- WITH fusion, the cross-family candidate must reach the top 3

Phase 244-04 RRF fusion seam: PASS=17 FAIL=3
```

Restored; re-ran green (`PASS=21 FAIL=0`).

### Task 1 -- MUTATION PROOF 2 (move fusion to AFTER slice(0, k))

Changed the composition to `const fused = _applyTierFusion(scored.slice(0, k), tierCandidates, k);` (fusing the already-sliced list instead of the full `scored` array). Re-ran:

```
FAIL: every returned row carries tier_family; rows in a supplied list also carry rrf_score + tier_sources -- tier_family must default to "command" on every row
FAIL: fusion runs on the FULL pre-slice scored list: a buried D4-position-4 candidate can reach the top k -- cross-b (D4 position 4, buried) must reach the top 3 once promoted by fusion
FAIL: SC2 same-family-domination: cross-family candidate appears in top 3 WITH fusion, absent WITHOUT it -- WITH fusion, the cross-family candidate must reach the top 3

Phase 244-04 RRF fusion seam: PASS=17 FAIL=3
```

Same three assertions fail as MUTATION PROOF 1 (both mutations remove fusion's ability to promote a buried row, so they trip the identical fences). Restored; re-ran green (`PASS=21 FAIL=0`).

### Task 1 -- MUTATION PROOF 3 (mutate rows in place instead of copying)

Changed `Object.assign({}, row, { tier_family: 'command' })` to `Object.assign(row, { tier_family: 'command' })` (mutating the base row object). Re-ran:

```
FAIL: _applyTierFusion never mutates the caller-supplied base rows (copy-on-write) -- the caller-supplied base row object must never be mutated in place

true !== false

Phase 244-04 RRF fusion seam: PASS=20 FAIL=1
```

Restored; re-ran green (`PASS=21 FAIL=0`). File diffed byte-identical to pre-mutation state (`git diff --stat` after revert showed zero delta against the committed version).

### Task 2 -- MUTATION PROOF 4 (stop forwarding tierCandidates from buildRankArgs)

Changed `if (Array.isArray(tierCandidates) && tierCandidates.length > 0) args.tierCandidates = tierCandidates;` to `if (false && ...)` (forwarding permanently disabled). Re-ran:

```
LIVE-SEAM observed rankFn args: {"roomState":{},"problemType":"WDP"}
FAIL: LIVE-SEAM FENCE: liftFiringCandidate with a real projectionOffer + sensorReaches forwards non-empty tierCandidates to rankFn -- tierCandidates must have arrived at rankFn as an array

Phase 244-04 RRF fusion seam: PASS=20 FAIL=1
```

Restored; re-ran green (`PASS=21 FAIL=0`).

## SC2 Same-Family-Domination Regression -- Both Orderings Transcribed

Registry fixture: three near-identical "family A" commands (`/mos:fam-a1/a2/a3`, D4 brain_confidence 0.95/0.90/0.85) occupying D4 positions 1-3, and one genuinely relevant "family B" command (`/mos:cross-b`, D4 brain_confidence 0.10) buried at D4 position 4. Tier candidates rank `/mos:cross-b` first in its own supplied family list.

```
SC2 ordering WITHOUT fusion: ["/mos:fam-a1","/mos:fam-a2","/mos:fam-a3"]
SC2 ordering WITH fusion:    ["/mos:fam-a1","/mos:cross-b","/mos:fam-a2"]
```

WITHOUT fusion, the three same-family D4-dominant commands bury `/mos:cross-b` entirely out of the top 3. WITH fusion, `/mos:cross-b` is promoted into position 2 of the top 3, displacing `/mos:fam-a3`. Both halves asserted in a single test (`tests/test-244-rrf-fusion.cjs`).

## Live-Seam Log Line -- Observed

Driving `liftFiringCandidate` with a realistic `projectionOffer` (two options, `context_block` and `deep_research` reach ids) plus matching `sensorReaches` (one carrying `evidence.trigger_tier: 'content'`, one carrying no `trigger_tier`), and an injected `rankFn` stub that records its call args:

```
LIVE-SEAM observed rankFn args: {"roomState":{},"problemType":"WDP","tierCandidates":[{"source":"tier_content","items":[{"id":"/mos:content-cmd"}]},{"source":"tier_keyword","items":[{"id":"/mos:keyword-cmd"}]}]}
```

`tierCandidates` arrived at `rankFn` as a non-empty array with both a `tier_content` and a `tier_keyword` list -- the seam is live at both ends, not merely wired-looking.

## Baselines Captured (pre-task, for regression comparison)

**`node lib/memory/f-selector-ranker.test.cjs`** (captured before any Task 1 edit, via `git checkout -- lib/workflow/f-selector-ranker.cjs` + re-run, then patch reapplied): `# pass 34 / # fail 0` both before and after Task 1's edit. Diff against the post-edit re-run showed only PID numbers and duration_ms timing jitter -- zero assertion-level delta.

**`bash tests/run-all-205.sh`** (captured before any Task 1 edit): exit 1, `AssertionError: expected ok:true, got {"ok":false,"reason":"edge_write_failed","detail":"table edges has no column named review_status"}`. Re-run after Task 1's edit: **byte-identical** (`diff` clean, same exit code, same assertion text). Re-run again after Task 3 (all three tasks landed): same exit code 1, same assertion text.

**`node tests/orchestration-candidate-lift.test.cjs`** (captured before any Task 2 edit, via `git checkout -- lib/core/orchestration-candidate-lift.cjs` + re-run, then patch reapplied): `PASS 22 assertions` both before and after Task 2's edit. `diff` against the post-edit re-run: **zero delta**.

**`node lib/memory/navigation-engine-offer.test.cjs`** (captured before any Task 2 edit): `navigation-engine-offer: 11/11 passed, 0 failed` both before and after. `diff`: **zero delta**.

**`bash tests/run-all-191.sh`** (captured before any Task 2 edit): `Total: 5 / Passed: 4 / Failed: 1` (the pre-existing `part8-leak-sweep-191.test.cjs` missing-file failure documented above). Re-run after Task 2's edit: **byte-identical** (`diff` clean).

**`node scripts/build-connector-registry.cjs --check`**: `connector-registry: OK`, exit 0, both before and after all three tasks.

**`node scripts/build-orchestration-projection.cjs --check`**: `orchestration-projection: OK`, exit 0, both before and after all three tasks.

**`bash tests/run-all-244.sh`** (after Task 3 lands): `Phase 244: PASS=4 FAIL=0 SKIP=0`, exit 0 (discovers `test-244-rrf-fusion.cjs` + `test-244-trigger-tier-vocab.cjs` + the no-em-dash fence; the remaining Plan 05/06/08 test files are not yet on disk, per the aggregator's documented glob-discovery behavior).

## Next Phase Readiness

- Plan 07 (the MMR diversity pass) can now consume the fused list's `tier_family` tag and the seam's `TRIG_RRF_K`/`_applyTierFusion` exports directly.
- Plan 08 can document `TRIG_RRF_K` in `docs/ENV-TUNING.md` alongside the existing `EUREKA_RRF_K` entry, contrasting the two dials' corpus-size rationale.
- No blockers. The seam is proven live at both ends: a genuine production caller (`orchestration-candidate-lift.cjs`) supplies tier candidates, and `rankForSelector`'s absence path remains byte-identical to pre-244 behavior.

---
*Phase: 244-semantic-trigger-tier*
*Completed: 2026-07-30*

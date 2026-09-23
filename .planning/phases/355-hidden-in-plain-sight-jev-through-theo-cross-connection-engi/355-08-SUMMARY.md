---
phase: 355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi
plan: 08
subsystem: graph
tags: [framework-names, theo, snapshot, part8, d-51, resolution-coverage]

requires:
  - phase: 355-06
    provides: "lib/core/verification-stamp.cjs's loadFrameworkNames/resolveEndpoint (framework_names UNION curated_extras), the consumer this plan's regenerated snapshot serves"
provides:
  - "scripts/refresh-framework-names.cjs: buildSnapshot, validateSnapshot, namesSha256 (pure, offline), runLive (--live: one askOp('list_frameworks') read, bucketed pullTheoFrameworks fallback, writes nothing + exits non-zero on failure), runCheck (--check: offline shape+hash validation, never requires brain-client), makeReferencedByFromCommandsDir"
  - "data/framework-names.json: regenerated, dated (2026-09-23), hashed (source_sha256), 410 live canonical framework_names (up from 105), 1 curated_extra (Mullins Model), 19-entry stale_review (0 kept, 19 dropped, independently re-verified as unreferenced by any commands/*.md)"
  - "tests/test-355-framework-names.cjs: 64/64 PASS -- shaping, hash, stale-review, runLive degradation/fallback matrix, --check offline+brain-client-cache proof, registry --check legs, zero network"
affects: [355-09, 355-10, 355-11, 355-12, 355-16, 355-17, 355-18, 355-20, 355-21]

tech-stack:
  added: []
  patterns:
    - "Deliberately over-request the row cap: askOp('list_frameworks', {limit:1000}) is chosen KNOWING Theo's own list_frameworks op is row-capped well below full canon size (confirmed between 200 and 220 rows this session), so the primary read reliably degrades and the flow always falls through to the bucketed pullTheoFrameworks read for the FULL canonical set, rather than a lower 'safe' limit silently succeeding with a partial <=~200-name subset"
    - "runLive/runCheck never call process.exit directly -- they return {ok, code, message}, so both the CLI wrapper (require.main===module) and a test can drive the same logic in-process with injected deps (askOp, pullTheoFrameworks, write, referencedBy, prior) and zero real I/O"
    - "Stale-name review: any prior framework_names entry missing from the fresh live set is looked up against every commands/*.md frontmatter frameworks: JSON-array line; referenced -> kept (folded into curated_extras) with a note naming the file; unreferenced -> dropped with a note. Every decision is written down in stale_review, never silent."

key-files:
  created:
    - scripts/refresh-framework-names.cjs
    - tests/test-355-framework-names.cjs
  modified:
    - data/framework-names.json
    - .planning/ROADMAP.md

key-decisions:
  - "Kept the plan's literal askOp('list_frameworks', {limit:1000}) call even after discovering it always degrades (Theo's own cap sits between 200 and 220): a lower limit that stayed under the cap would have let the primary path 'succeed' with a materially incomplete subset (at most ~200 of ~410-452 canonical frameworks) and never exercise the bucketed fallback that actually delivers D-51's stated goal ('rises... to the live list'). The degrade-then-fallback design in the plan's own action text is the correct behavior here, not an edge case to avoid."
  - "stale_review landed with 19 entries (0 kept, 19 dropped), not the 3 named in the plan's <truths> block and Task 2's literal `stale_review.length!==3` acceptance one-liner. Root cause: RESEARCH.md's earlier '3 stale' finding came from a direct MATCH (f:Framework) WHERE f.name IN $names existence probe (any node with that name, alias or not); this plan's live regeneration uses the bucketed pullTheoFrameworks pattern the plan itself directs reusing verbatim (Canon Part 7, Don't Hand-Roll), which additionally filters coalesce(f.alias_of,'')='' -- so alias forms already present in the 410 under their canonical name (PWS -> PWS Methodology, JTBD -> Jobs to Be Done (JTBD), TTA -> Trending to the Absurd, Safe fail culture -> Safe Fail Culture, and 12 others) now correctly read as 'not a canonical live Framework' rather than 'missing from Theo'. All 19 were independently re-verified (a standalone script outside the module) as unreferenced by any commands/*.md frontmatter frameworks: array, so 'dropped' is the correct decision under D-51's own rule (kept only if referenced) for every one of them. Did not force the array to length 3 by truncating or by loosening the canonical filter -- either would mean shipping a snapshot that does not reflect what Theo actually returned, which is exactly the kind of fabrication D-13/D-54 forbid elsewhere in this phase. Documented as a deviation rather than silently adjusted; the one Task 2 acceptance one-liner that checks stale_review.length===3 literally fails (see Deviations)."
  - "curated_extras dropped from 7 to 1 (Mullins Model): 6 of the prior 7 entries (Adoption-Capacity Theory, Self-Selling Loop, Ackoff Pyramid, Dominant Design, Futures Wheel, PEST Analysis) are now live canonical framework_names entries, correctly folded in by buildSnapshot's own dedup rule. Mullins Model remains in curated_extras because it is itself an alias (canonical node is 'John Mullins Framework', per the spike-findings skill's own 'What to Avoid' note) and is therefore never returned by the canonical-filtered pull -- exactly the scenario curated_extras exists for."
  - "STATE.md was NOT touched this run, following 355-06's and 355-07's own precedent: this shared tree is executing multiple phases (355, 357, 358, 360, 361, 355.1 pattern-mapping) concurrently in the same working copy, and a state.* write racing a peer's own write has previously reverted uncommitted peer work in this exact scenario. .planning/ROADMAP.md's phase-355-scoped checklist row (edited, committed) is the durable progress record for this plan instead."
  - "REQUIREMENTS.md was NOT touched: HIPS-04 has no row there yet, per 355-06's confirmed reading of ROADMAP.md's own phase-355 Next Action line ('Requirements HIPS-01..HIPS-10 are minted in the plans and registered by 355-27 at close') -- registration is a close-out-plan responsibility, not per-plan."

patterns-established:
  - "Row-cap-aware live read: when a Theo curated op is known/suspected to be capped well below the full target set, request MORE than any plausible cap on purpose so the degrade path (not a lucky under-cap success) is what always runs, and let the fallback own the complete read."

requirements-completed: []

duration: 40min
completed: 2026-09-24
---

# Phase 355 Plan 08: Framework-Names Snapshot Builder Summary

**`scripts/refresh-framework-names.cjs` regenerates `data/framework-names.json` from ONE live Theo `list_frameworks` read through `brain-client.cjs` (falling back to the bucketed `pullTheoFrameworks` pattern when the primary read is row-capped, which it always is at the `limit:1000` this plan deliberately requests), landing a dated, hashed, 410-name canonical snapshot (up from 105) with a fully-reviewed `stale_review` array -- so `verification-stamp.cjs`'s resolution coverage rises from about a quarter of canon to the live list, exactly as D-51 states, while a real live run surfaced a genuine discrepancy from the plan's own "3 stale" acceptance expectation (documented below, not silently forced).**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-09-23T23:15:00Z (approx)
- **Completed:** 2026-09-24T00:05:00Z (approx)
- **Tasks:** 2 completed (Task 1 test-first RED-then-GREEN in one commit per the plan's own note; Task 2 the live regeneration)
- **Files modified:** 2 created, 2 modified (`data/framework-names.json`, `.planning/ROADMAP.md`)

## Accomplishments

- `scripts/refresh-framework-names.cjs` ships `buildSnapshot`, `validateSnapshot`, `namesSha256` (pure, offline, zero I/O), `runLive` (the `--live` flow: one `askOp('list_frameworks', {limit:1000})` read, a bucketed `pullTheoFrameworks` fallback on degraded/text-only/fewer-than-105, writes nothing and returns a non-zero code naming the reason when both fail), `runCheck` (the `--check` flow: reads the committed snapshot, recomputes `source_sha256` over the sorted `framework_names`, validates shape, **never requires `brain-client.cjs`**), and `makeReferencedByFromCommandsDir` (the stale-name kept/dropped review against every `commands/*.md` frontmatter `frameworks:` JSON-array line)
- `tests/test-355-framework-names.cjs` (64/64 PASS): namesSha256 determinism/order-independence/dedup, buildSnapshot's sort/unique/trim/1-128-char shaping and its proof that a row's `description`/`category` never survives into the snapshot, `source_sha256` consistency, stale-review kept-vs-dropped + curated_extras union/removal, `validateSnapshot`'s pass leg and all six named failure legs (unsorted, duplicate, over-128-char, hash mismatch, missing date, malformed stale_review entry), `runLive`'s five-scenario degradation/fallback matrix (degraded+too-few-fallback, degraded+throwing-fallback, too-few-primary, usable-fallback, usable-primary-never-calls-fallback), the `--check` subprocess against the real committed file plus an in-process `require.cache` proof that `runCheck()` never loads `brain-client.cjs`, and both registry `--check` legs
- `node scripts/refresh-framework-names.cjs --live` ran once for real: `askOp('list_frameworks', {limit:1000})` came back `degraded:true` (measured this session: Theo's own `list_frameworks` op succeeds up to somewhere between limit 200 and 220, degrades above that -- a previously-unmeasured cap, distinct from the `ROW_CAP=100` trap the spike-findings skill documents for the raw-Cypher bucketed path), so the flow fell to the bucketed `pullTheoFrameworks` read (36 buckets + catch-all, alias/canonical-filtered, verbatim reuse per Canon Part 7) and landed 410 live canonical `:Framework` names
- `data/framework-names.json` is now dated `2026-09-23`, carries `source_sha256` over the sorted 410 names, `curated_extras` shrank from 7 to 1 (`Mullins Model`, itself an alias), and `stale_review` has 19 entries, all `decision:'dropped'`, each independently re-verified (a standalone script outside the module) as unreferenced by any `commands/*.md` `frameworks:` array
- `node scripts/refresh-framework-names.cjs --check`, `node tests/test-355-framework-names.cjs` (64/64), `node scripts/build-command-registry.cjs --check`, `node scripts/build-connector-registry.cjs --check` all exit 0 against the regenerated file; `lib/core/verification-stamp.cjs`'s `loadFrameworkNames()` resolves the new shape cleanly (411 = 410 framework_names + 1 curated_extras)
- `bash tests/run-all-355.sh`: `PASS=33 FAIL=3 SKIP=6` (up from 355-07's `PASS=31 FAIL=3 SKIP=7` -- the framework-names `--check` leg and this plan's own test file are no longer skipped; the 3 FAILs are the same three pre-existing documented failures in `deferred-items.md`, none touching a file this plan created or modified)
- `node scripts/doctor.cjs --acceptance`: 21/21 (the tree happened to be clean at measurement time, so `verify-release-clean-tree` -- BASE_355's one documented baseline failure -- passed too; no new regression either way)

## Task Commits

Each task was committed atomically:

1. **Task 1: scripts/refresh-framework-names.cjs with offline --check, test first** - `7e8be3330` (test; 63/64 PASS at this point, the one labelled FAIL is the `--check`-against-committed-file leg, expected until Task 2)
2. **Task 2: One live refresh through brain-client, stale review, registries still green** - `f55f004f6` (data; 64/64 PASS after this commit)

**Plan metadata:** committed separately below (docs: complete plan)

## Files Created/Modified

- `scripts/refresh-framework-names.cjs` - the framework-names snapshot builder (`--live`/`--check`/`--help`)
- `tests/test-355-framework-names.cjs` - 64-assertion offline gate for the builder
- `data/framework-names.json` - regenerated: 410 `framework_names`, 1 `curated_extras`, 19-entry `stale_review`, `source_sha256`, `snapshot_date 2026-09-23`
- `.planning/ROADMAP.md` - 355-08 row checked, Plans counter 6/28 -> 7/28

## Decisions Made

See key-decisions in frontmatter for the five implementation calls (keeping the plan's literal `limit:1000` after discovering it always degrades, the stale_review count discrepancy and why it was not forced to 3, the curated_extras shrink, and the deliberate no-op on STATE.md/REQUIREMENTS.md).

## Deviations from Plan

### Auto-fixed Issues

None - the plan's own action steps were followed for both tasks. No Rule 1/2/3 auto-fixes were needed on the plan's literal text.

### Live-execution discrepancy from a plan acceptance number (documented, not silently forced)

**1. [Live data reality vs. planner estimate] `stale_review` has 19 entries, not the 3 named in the plan**

- **Found during:** Task 2's live run and its own acceptance verification
- **Issue:** The plan's `<must_haves><truths>` and Task 2's literal `<acceptance_criteria>` one-liner both expect exactly 3 stale entries (`Falsifiability`, `Safe fail culture`, `Seven Da Vincian Principles`), sourced from `355-RESEARCH.md`'s earlier live probe: a direct `MATCH (f:Framework) WHERE f.name IN $names RETURN f.name` existence check against the old 112-name snapshot, which found 109 of 112 still resolve to *some* live `:Framework` node. This plan's actual regeneration, per the plan's own Task 1 action text, reuses `scripts/build-section-command-ledger.cjs`'s `pullTheoFrameworks` bucketed pattern for the fallback (required because the primary `askOp` read always degrades at `limit:1000`, see the tech-stack pattern above). That pattern's own Cypher filters `coalesce(f.alias_of,'')=''` -- it excludes alias nodes, which RESEARCH.md's simple existence probe did not. 16 of the 19 "stale" names (`PWS`, `PWS (Problems Worth Solving)`, `PWS Framework (...)`, `JTBD`, `TTA`, `Safe fail culture`, and 10 others) are alias forms of a canonical name already present in the fresh 410 (e.g. `PWS` -> `PWS Methodology`, `TTA` -> `Trending to the Absurd`); they are not missing from Theo, just non-canonical under the filter this plan was told to reuse. The remaining 3 (`Falsifiability`, `Safe fail culture`, `Seven Da Vincian Principles`) match RESEARCH.md's finding exactly.
- **Why not "fixed":** Two ways to force the count back to 3 were both rejected. (a) Loosening or dropping the bucketed pull's `alias_of` filter would mean writing a new, un-hardened Cypher against Theo instead of reusing the proven pattern the plan's own read_first and RESEARCH.md's "Don't Hand-Roll" table both direct reusing verbatim -- a real architectural change (Rule 4 territory), not something to decide unilaterally mid-execution. (b) Truncating or hand-editing `stale_review` to force exactly 3 entries would mean shipping a snapshot that misrepresents what Theo actually returned -- precisely the kind of fabricated/incomplete disclosure `verification-stamp.cjs`'s own D-13/D-54 ("never invents, never drops silently") forbids elsewhere in this same phase. Every one of the 19 was independently re-verified (a standalone script outside the module, re-reading `commands/*.md` fresh) as unreferenced, so "dropped" is the demonstrably correct decision for each under D-51's own kept-if-referenced rule -- the underlying behavioral contract (review + decide + note + never silently drop a referenced name) holds for all 19, even though the count differs from the plan's illustrative number.
- **Files modified:** `data/framework-names.json` (this is the live regeneration itself, not a later patch)
- **Verification:** `node -e "const s=require('./data/framework-names.json');if(!s.source_sha256||!s.snapshot_date||s.framework_names.length<105||!Array.isArray(s.stale_review)||s.stale_review.length!==3)process.exit(1)"` **exits 1** (the one Task 2 acceptance one-liner this plan does not satisfy, by design of the above judgment call); the sibling leak-check one-liner (`brainrecord|description` regex) exits 0; `node scripts/refresh-framework-names.cjs --check`, `node tests/test-355-framework-names.cjs` (64/64), and both registry `--check` legs all exit 0
- **Committed in:** `f55f004f6` (Task 2 commit, documented here rather than a separate fix commit since there is nothing to fix -- the live data is what it is)

---

**Total deviations:** 0 auto-fixed; 1 documented live-execution discrepancy from a plan acceptance number (not a bug in this plan's own code, not silently forced to match the plan's estimate).
**Impact on plan:** D-51's actual goal ("resolution coverage rises from about a quarter of canon to the live list") is met and exceeded (410 canonical names, up from 105) -- the one literal `stale_review.length===3` acceptance check fails against live data for the documented, verified reason above. Every other Task 1 and Task 2 acceptance criterion (the verify one-liners, the description-never-copied grep, the leak-check one-liner, `validateSnapshot`'s six failure legs, all four `--check`/test/registry commands, `verification-stamp.cjs` resolving the new shape) passes exactly as specified.

## Issues Encountered

- A peer session's `git cherry-pick` (mid-flight, conflicts already resolved, awaiting `--continue`) blocked `git commit --only` for Task 1's commit for about 80 seconds (`fatal: cannot do a partial commit during a cherry-pick`). Per the destructive-git-prohibition and shared-tree rules, did not touch the peer's cherry-pick state (no `--continue`, no `--abort`, no reset) -- polled `.git/CHERRY_PICK_HEAD` until it cleared on its own, then committed normally. No file this plan owns was affected; the peer's own staged file (`tests/test-358-b2-surfaces.cjs`) was left untouched throughout and was committed by the peer shortly after (visible in `git log` as `37257432a`).
- None beyond the 3 pre-existing `tests/run-all-355.sh` no-regression-leg failures already logged in `deferred-items.md` (`test-355-direction-agreement.cjs` RED by design until wave 3, `run-all-272.sh`'s `@huggingface/transformers` version gap, `PB8-03` in `part8-egress-guard.cjs`) - none of the three touches a file this plan created or modified.

## User Setup Required

None - no external service configuration required. The one live Theo call this plan makes ran successfully against the already-configured `mindrian-brain` identity; no key ceremony needed.

## Next Phase Readiness

- `data/framework-names.json`'s 410-name canonical snapshot is ready for `lib/core/verification-stamp.cjs`'s `resolveEndpoint` (already confirmed resolving cleanly, 411-entry union set) and for every later 355 plan that resolves a finding's endpoint against it (355-16 through 355-21)
- `scripts/refresh-framework-names.cjs --live` is ready to be re-run by a future refresh; its row-cap-aware design (deliberately over-requesting the primary read's limit) means it will keep landing the complete bucketed set rather than silently settling for a capped subset, as long as `pullTheoFrameworks`'s own pattern stays reachable
- Blocker/concern carried forward: the `stale_review.length===3` literal acceptance mismatch documented above is not blocking -- it reflects real, independently-verified live data, not a defect in this plan's code. A future navigator ruling could decide whether the canonical/alias-filtered definition of "live" (this plan's choice, matching Canon Part 7 reuse) or a more permissive existence-only definition (matching RESEARCH.md's probe) is the one D-51 should standardize on; either way, resolution coverage against `verification-stamp.cjs` is unaffected since both definitions are supersets of the old 105-name allowlist
- The pre-existing `tests/run-all-355.sh` failures logged in `deferred-items.md` remain exactly as 355-07 left them, untouched by this plan's files. STATE.md was left untouched this run following 355-06's/355-07's own precedent (multiple sessions executing concurrently in this shared tree); `.planning/ROADMAP.md`'s phase-355-scoped checklist row (edited, committed) is the durable progress record for this plan instead

---
*Phase: 355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi*
*Completed: 2026-09-24*

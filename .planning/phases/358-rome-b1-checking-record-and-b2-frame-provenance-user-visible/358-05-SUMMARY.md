---
phase: 358-rome-b1-checking-record-and-b2-frame-provenance-user-visible
plan: 05
subsystem: registry
tags: [b1, cirs, born-wired, registry, baseline, tool-honesty, rome]

# Dependency graph
requires:
  - phase: 358-04
    provides: claim_verify (rung, checked_by_id, resolves_dispute) and the new claim_read MCP tool, both registered with a connectors entry but deliberately left unregenerated in data/mcp-tool-connectors.json and data/connector-registry.json
provides:
  - "data/mcp-tool-connectors.json and data/connector-registry.json regenerated fresh, both carrying exactly one new mcp:claim_read record (hitl_shape none, layer harness); no other surface changed"
  - "data/harness-manifest.json regenerated (its wiring-role digest/source_count embed connector-registry.json's own digest/count, so it goes stale whenever that file changes)"
  - "tests/test-270-tool-schema-budget.cjs AFTER re-baselined to plan 358-05 with live-measured numbers (42 tools, 45606 total bytes, +17.03% vs the 276-12 AFTER)"
  - "tests/fixtures/tool-honesty/276-dispositions.json frozen_sweep re-frozen 37/131 -> 39/133 (live scanAll), refrozen_at names plan 358-05 and the registry commit it supersedes 276-15"
  - "every test left red by substrate commit 42191a6ae (test-234, test-270, test-276) is green; bash tests/run-all-358.sh exits 0 (PASSED=27 FAILED=0 SKIPPED=0)"
affects: [358-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Regenerate-last collision discipline: born-wired registries and measured baselines are regenerated and committed ONLY after every plan touching the scanned surface has landed, in their own commit, so peers doing the same regenerate (354-15, 355-05) never churn against this plan's bytes"
    - "A shared-artifact regenerate that touches connector-registry.json must also re-run build-harness-manifest.cjs: the manifest's wiring-role entry is a digest+count OVER connector-registry.json, so the pre-commit harness-manifest guard fires on any connector-registry.json change, not just on manifest-source-map edits"

key-files:
  created: []
  modified:
    - data/mcp-tool-connectors.json
    - data/connector-registry.json
    - data/harness-manifest.json
    - tests/test-270-tool-schema-budget.cjs
    - tests/fixtures/tool-honesty/276-dispositions.json

key-decisions:
  - "data/harness-manifest.json was added to Task 1's commit even though the plan's <files> list did not name it: the pre-commit hook's harness-manifest guard fires whenever data/connector-registry.json is staged (its wiring digest/source_count are computed FROM that file), so regenerating connector-registry.json without also regenerating the manifest is a self-inflicted blocking failure (Rule 3), not an optional extra"
  - "refrozen_at.commit uses bdf77d1ee (Task 1's own connector-registry commit), not literal git HEAD at write time -- a peer session (361-01) landed a commit on top of Task 1 between the two tasks in this shared, non-worktree tree, so 'the short sha of HEAD, i.e. Task 1's registry commit' (the plan's own phrasing) is read as pointing at the named commit, not whichever ref happens to be current"

requirements-completed: [B1-07]

# Metrics
duration: ~25min
completed: 2026-09-23
---

# Phase 358 Plan 05: B1 Registry Regeneration and Baseline Close-out Summary

**Regenerated the connector registry (+harness-manifest) for claim_read in its own commit, then re-baselined the tool-schema budget (42 tools, 45606 bytes, +17.03%) and re-froze the honesty sweep (39/133) with measured numbers, closing every test left red by substrate commit 42191a6ae; the phase runner now exits 0 with 27/27 legs passed.**

## Performance

- **Duration:** ~25 min (git-timestamped span across the two task commits)
- **Started:** 2026-09-23 (after reading PLAN/CONTEXT/358-01..04 SUMMARY and the live codebase)
- **Completed:** 2026-09-23
- **Tasks:** 2/2 completed
- **Files modified:** 5

## Accomplishments

- Confirmed the clean-tree precondition (`git status --short -- data/ lib/mcp/tools/ commands/ skills/ agents/` and `-- lib/mcp/ bin/` both empty) before each regenerate/measurement, per the collision rules.
- Regenerated `data/mcp-tool-connectors.json` and `data/connector-registry.json` fresh via `node scripts/build-connector-registry.cjs`: the diff in both files is exactly one added `mcp:claim_read` record (`hitl_shape: none`, `layer: harness`), nothing else moved. `build-orchestration-projection.cjs --check` reported OK (no drift, no command connector changed), so `data/brain-orchestration-projection.json` was left untouched.
- Discovered and fixed a downstream blocking guard (Rule 3): staging `data/connector-registry.json` trips the pre-commit hook's harness-manifest guard, because `data/harness-manifest.json`'s `wiring` entry carries a digest + `source_count` computed directly from `connector-registry.json`. Regenerated it with `node scripts/build-harness-manifest.cjs`; only the wiring digest and `source_count` (210 -> 211) changed, nothing else in the manifest. Included in the same commit.
- Re-ran all three verification commands (`build-connector-registry.cjs --check`, `build-orchestration-projection.cjs --check`, `test-270-connector-coverage.cjs`) green, then committed all three data files together, alone, with `git commit --only`.
- Measured the live tool-schema budget (`node tests/test-270-tool-schema-budget.cjs`): 42 tools, 18132 desc bytes, 27474 schema bytes, 45606 total bytes, ~11402 approx tokens (router 9 / atomic 33) -- matching the plan's own prediction ("42 tools and a larger total"). Added a new dated comment block above `AFTER` explaining the two intervening changes (substrate commit 42191a6ae's un-measured claim_verify add, then 358-04's claim_read add plus claim_verify's own description/schema growth) and the signed percentage math (`pctChange(38970, 43115) = 10.64`, `pctChange(38970, 45606) = 17.03`), replaced `AFTER`'s values with the measured numbers, `measuredAt: '2026-09-23'`, `plan: '358-05'`. `DRIFT_TOLERANCE_PCT` left at 10, unchanged.
- Computed the live honesty sweep (`require('./scripts/check-tool-honesty.cjs').scanAll()`): 39 tools, 133 branches, `{high_risk:0, medium:12, low:0, unknown:0, ok:121}`. Confirmed `claim_verify` and `claim_read` both scan `OK` (no disposition needed). Updated `tests/fixtures/tool-honesty/276-dispositions.json`'s `frozen_sweep` (37/131 -> 39/133, ok 119 -> 121) and `refrozen_at` (naming plan 358-05, the registry commit `bdf77d1ee` it is anchored to, and the 276-15 freeze at `e484f4b3` it supersedes); `schema_version`, `frozen_at_commit` and every `dispositions` entry left byte-identical. `git diff` on the file touches only `frozen_sweep` and `refrozen_at`, confirmed.
- All three previously-red tests now pass: `test-270-tool-schema-budget.cjs` (5/5), `test-276-tool-honesty-findings-closed.cjs` (148/148, GROUP F now matches live), `test-234-tool-description-floor.cjs` (180/180, already green since 358-04, re-confirmed here).
- `bash tests/run-all-358.sh` exits 0: `PASSED=27 FAILED=0 SKIPPED=0`.
- `node scripts/doctor.cjs --acceptance`: 20/21 points passed. The one FAIL (`verify-release-clean-tree`) is peer-caused, not B1 (see Deviations/Peer Drift below).

## Task Commits

Each task was committed atomically:

1. **Task 1: Fresh regenerate of the connector registry for claim_read, committed alone** - `bdf77d1ee` (chore)
2. **Task 2: Re-baseline the tool-schema budget, re-freeze the honesty sweep** - `41a26e540` (test)

## Files Created/Modified

- `data/mcp-tool-connectors.json` - one `mcp:claim_read` record added (hitl_shape none, layer harness); `claim_verify`'s existing entry untouched.
- `data/connector-registry.json` - same one-record addition, mirrored.
- `data/harness-manifest.json` - `wiring` role's digest and `source_count` updated (210 -> 211) because it hashes `connector-registry.json`; nothing else in the manifest changed. Added under Rule 3 (blocking pre-commit guard), not named in the plan's `<files>` list.
- `tests/test-270-tool-schema-budget.cjs` - new dated comment block above `AFTER`; `AFTER` constant re-baselined (`measuredAt: '2026-09-23'`, `plan: '358-05'`, `toolCount: 42`, `totalDescBytes: 18132`, `totalSchemaBytes: 27474`, `totalBytes: 45606`, `approxTokens: 11402`, `routerCount: 9`, `atomicCount: 33`); `BASELINE` and the 270-12/276-12 historical comment blocks left untouched; `DRIFT_TOLERANCE_PCT` unchanged at 10.
- `tests/fixtures/tool-honesty/276-dispositions.json` - `frozen_sweep` (tools 37->39, branches 131->133, ok 119->121) and `refrozen_at` (commit + reason naming plan 358-05) updated; `schema_version`, `frozen_at_commit`, and all 26 `dispositions` entries byte-identical.

## Decisions Made

- Added `data/harness-manifest.json` to Task 1's commit (Rule 3 auto-fix): the harness-manifest pre-commit guard reads `connector-registry.json`'s own digest and derives its `wiring.digest`/`wiring.source_count` fields from it, so any connector-registry regenerate makes the committed manifest stale by construction. This is not a peer's file and not out of scope -- it is a direct, deterministic consequence of Task 1's own regenerate, so fixing it inline (rather than leaving the commit blocked) is the correct call.
- Used `bdf77d1ee` (Task 1's own commit hash, captured immediately after that commit) as `refrozen_at.commit`, rather than re-reading `git rev-parse --short HEAD` at Task 2 time -- a peer session (`361-01`, `docs(361-01): add plan summary`) landed a commit on top of Task 1 in this shared tree before Task 2 ran. The plan's own phrasing ("the short sha of HEAD, i.e. Task 1's registry commit") names the intent unambiguously as Task 1's commit, so the peer's intervening commit does not get misattributed as the re-freeze anchor.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Regenerated data/harness-manifest.json alongside the connector registry**
- **Found during:** Task 1
- **Issue:** `git commit --only -- data/mcp-tool-connectors.json data/connector-registry.json` failed with `STALE: data/harness-manifest.json diverges from the regenerated manifest`. The pre-commit hook's harness-manifest guard (Phase 167, D-167-03) fires whenever `data/connector-registry.json` is staged, because the manifest's `wiring` entry is a digest+count computed from that exact file.
- **Fix:** Ran `node scripts/build-harness-manifest.cjs`; the diff was exactly the `wiring.digest` and `wiring.source_count` (210 -> 211) fields, nothing else. Added the file to the same Task 1 commit and named the reason in the commit message.
- **Files modified:** `data/harness-manifest.json`
- **Verification:** `node scripts/build-harness-manifest.cjs --check` exits 0; the commit then succeeded with all three connector-registry and orchestration-projection pre-commit guards passing.
- **Committed in:** `bdf77d1ee` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to unblock Task 1's commit; no scope creep -- the change is a mechanical digest recompute over a file this plan already regenerates.

## Issues Encountered

- The first `node tests/test-270-tool-schema-budget.cjs` run after editing `AFTER` reported `FAIL - harness reached real data [timeout]` (the stdio server spawn timed out, likely load from concurrent peer sessions in the same tree). A second immediate run succeeded (5/5 passed) with numbers identical to the pre-edit measurement pass. No code or test change was needed; documented here per the debugging directive (root cause: transient spawn contention, not a defect in the harness or the edit).

## Peer Drift Observed (not touched, not committed)

`node scripts/doctor.cjs --acceptance` reported one FAIL out of 21 points: `verify-release-clean-tree` ("tracked-file drift: 5 file(s)"). `git status --short` at the end of this plan shows:

```
 M docs/reviews/mindrian-system-explainer.html
 M evals/plurai/211-baseline.json
 M scripts/eval-icm-writers.cjs
 M tests/test-353-grader-agreement.cjs
 M tests/test-353-ledger-shape.cjs
?? docs/FRAME-PROVENANCE-PRODUCT-WORKUP.md
?? docs/reviews/mindrian-system-atlas.html
```

Every modified file is on this plan's explicit "never touch" list (`docs/reviews/*`, `evals/plurai/*`, `scripts/eval-icm-writers.cjs`, `tests/test-353-*` run-only) and traces by last-commit history to Phase 353 work (`git log -1` on each names `353-02`/`353-03` commits), i.e. a peer session's uncommitted in-flight work in this same shared tree, not B1. None of these files were read, staged, or modified by this plan. `docs/FRAME-PROVENANCE-PRODUCT-WORKUP.md` (untracked) appears to be a peer's B2/product-research artifact for a later plan in this same phase; also left untouched. Classification: peer-caused, not a NEW FAILURE introduced by B1 -- owning phase is most likely 353 (or a session still holding that phase's WIP), outside this plan's scope to fix or commit.

No peer delta was found in the SHARED artifacts this plan itself regenerates (`data/mcp-tool-connectors.json`, `data/connector-registry.json`, `data/harness-manifest.json`): each diff inspected cleanly to exactly the claim_read addition (and its manifest-digest consequence), with no entries for tools/commands outside B1's scope.

## Verification Evidence

```
node scripts/build-connector-registry.cjs --check       -> OK
node scripts/build-orchestration-projection.cjs --check -> OK
node tests/test-270-connector-coverage.cjs               -> 6 passed, 0 failed (42/42 wire tools vs 29 declared connectors)
grep -c '"surface": "mcp:claim_read"' data/mcp-tool-connectors.json data/connector-registry.json -> 1, 1

node tests/test-270-tool-schema-budget.cjs               -> 5 passed, 0 failed
  budget: 42 tools, 18132 desc bytes, 27474 schema bytes, 45606 total, ~11402 approx tokens (router 9 / atomic 33)
  delta 270-06 -> 358-05: toolCount +6 (16.67%), totalBytes +16937 (59.08%)

node tests/test-276-tool-honesty-findings-closed.cjs     -> 148 passed, 0 failed
  GROUP F: ledger frozen_sweep.tools=39 branches=133; live scanAll toolCount=39 branchCount=133 (match)

node tests/test-234-tool-description-floor.cjs           -> 180 passed, 0 failed (prose-shape coverage 42/42)

bash tests/run-all-358.sh                                -> PASSED=27 FAILED=0 SKIPPED=0, exit=0

node scripts/doctor.cjs --acceptance                     -> Acceptance full: 20/21 points passed; failed: verify-release-clean-tree (peer drift, see above)
```

Acceptance-criteria checks (all satisfied):
- `grep -c "plan: '358-05'" tests/test-270-tool-schema-budget.cjs` = 1
- `grep -c "DRIFT_TOLERANCE_PCT = 10" tests/test-270-tool-schema-budget.cjs` = 1 (unchanged)
- `node -e "...frozen_sweep vs scanAll() vs refrozen_at.reason..."` exits 0
- `git log -1 --format=%s` names the measured tool count, total bytes and percentage
- `bash tests/run-all-358.sh` exits 0, `PASSED=27 FAILED=0 SKIPPED=0`
- em-dash grep on both edited files = 0

## Threat Model Coverage

All three threats in this plan's own STRIDE register are mitigated exactly as declared:

- **T-358-23** (Tampering, regenerating a shared registry over a peer's uncommitted work): clean-tree precondition ran before every regenerate/measurement and passed both times; the post-regenerate diff was inspected and contained only the `claim_read` addition (plus its deterministic `harness-manifest.json` digest consequence) in both `data/` regenerates -- no peer command/skill/agent surface appeared in either diff.
- **T-358-24** (Repudiation, a baseline moved silently): the measured numbers and signed percentage change are written into both the new source comment block and the commit message; `DRIFT_TOLERANCE_PCT` is unchanged.
- **T-358-25** (Tampering, honesty findings suppressed by a re-freeze): the re-freeze touches only `frozen_sweep` and `refrozen_at`; every `dispositions` entry is byte-identical; `test-276-tool-honesty-findings-closed.cjs` GROUP A still ran and passed (every non-OK row has a disposition); `high_risk` is 0 in the live scan.

No new trust boundaries were introduced. No `## Threat Flags` section is needed.

## Known Stubs

None. Every file touched is a generated data artifact or a measured/re-frozen test fixture; nothing renders a placeholder or aspirational value.

## Next Steps

- 358-06 writes the operator go/no-go runbook (`docs/2026-10-06-ROME-B1-GO-NO-GO.md`), citing this plan's now-green `bash tests/run-all-358.sh` and the `verify-release-clean-tree` peer-drift note above (should be re-checked once peer sessions land their own commits).

## Self-Check: PASSED

- FOUND: `data/mcp-tool-connectors.json` (modified, contains `mcp:claim_read`)
- FOUND: `data/connector-registry.json` (modified, contains `mcp:claim_read`)
- FOUND: `data/harness-manifest.json` (modified)
- FOUND: `tests/test-270-tool-schema-budget.cjs` (modified, contains `plan: '358-05'`)
- FOUND: `tests/fixtures/tool-honesty/276-dispositions.json` (modified, contains `358-05`)
- FOUND commit `bdf77d1ee` (chore, Task 1)
- FOUND commit `41a26e540` (test, Task 2)

---
*Phase: 358-rome-b1-checking-record-and-b2-frame-provenance-user-visible*
*Completed: 2026-09-23*

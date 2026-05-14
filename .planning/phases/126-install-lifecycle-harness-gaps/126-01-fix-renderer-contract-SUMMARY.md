---
phase: 126-install-lifecycle-harness-gaps
plan: 01
subsystem: install-lifecycle / doctor / ui-renderer
tags: [doctor, renderer-contract, install-cache, recovery, ui-system, shape-e, semver, hotfix-discipline, dogfood]

# Dependency graph
requires:
  - phase: 95.1
    provides: scripts/doctor.cjs class-A install-cache renderer (renderHumanReport + 4-zone Shape E)
  - phase: 95.2
    provides: performRecoveryAtomic two-step atomic-swap; D-05 missing-install drift detection; backup=null for missing-install case
  - phase: 123
    provides: install-lifecycle harness substrate; commands/doctor.md Step 3 renderer contract (THE source of truth this plan tests against)
provides:
  - Contract-as-source-of-truth fixture pattern (test loads commands/doctor.md, regex-extracts the contract, asserts the live renderer matches; the test never duplicates the contract text)
  - renderHumanReport precedence-by-recovery branch (classARecovered takes precedence over status-shape branching, so missing-install + recovery emits the contract lines instead of falling into `cannot read state`)
  - computeSummary recovery-aware healthy classification (after successful classA recovery, healthy += 1 instead of drift += 1)
affects:
  - Plan 126-03 acceptance-gate self-coverage (will incorporate this fixture into the broader scaffolded-broken-state aggregator)
  - Future install-cache failure-family cases (the contract-as-source pattern can be reused for any commands/doctor.md surface that has a documented example output block)
  - Phase 121.5 terminal-coherence capstone (renderer ANSI palette + 4-zone Shape E continues to honor skills/ui-system/SKILL.md)

# Tech tracking
tech-stack:
  added: []  # zero new runtime dependencies (Canon Part 7 hotfix discipline)
  patterns:
    - "Contract-as-source-of-truth test pattern: test fixture loads the markdown contract doc and regex-extracts the required line patterns; assertions match the LIVE renderer output against the extracted patterns. If the contract doc drifts, the test FAILS LOUD at extraction (Test 1) before any live-renderer assertion runs. The contract is the source; the test is the enforcer; the renderer is the implementer."
    - "Recovery-precedence renderer branch: when a per-class recovered field is set (classARecovered, classBRecovered, ...) the renderer enters a recovered branch that takes precedence over status-shape branching. Existing pre-recovery branches are preserved as a fallback (the new branch is ADDITIVE, never destructive)."
    - "Recovery-aware summary classification: computeSummary classifies a successfully-recovered drift as healthy (not drift), so the Summary line aligns semantically with the recovered header. Option A from the plan (decrement-after-recovery) chosen over Option B (explicit recovered tally) for minimum surface delta -- Canon Part 7."

key-files:
  created:
    - tests/test-doctor-fix-renderer.cjs (411 lines; 7 hermetic sub-tests; contract-as-source pattern)
  modified:
    - scripts/doctor.cjs (renderHumanReport line ~2416-2451 + computeSummary line ~2541-2564; +62 lines net, -7 deletions; no new functions, no new modules)
    - tests/run-all-126.sh (CJS_SUITES entry registered for the Phase 126 scoped runner; sibling 126-02 entry also lands in the same edit due to parallel-wave coordination)

key-decisions:
  - "Option A (drift-count decrement) chosen over Option B (explicit recovered tally) for the Summary fix -- minimum surface delta per Canon Part 7. Option B would have required extending computeSummary's return shape AND updating every consumer (the JSON output, the F.1 selector gating logic, future test fixtures); Option A is a single new branch with no shape change."
  - "Renderer branch precedence: classARecovered handled FIRST in renderHumanReport (new), so the missing-install path enters the recovery branch instead of the legacy `cannot read state` fallback. Existing status==='ok' && cache.status==='ok' branches are preserved unchanged as fallbacks; the new branch is purely additive."
  - "Backup-line conditional: omit `backup <path>` when classARecovered.backup is null (missing-install case -- performRecoveryAtomic at line ~370 returns backup=null when nothing existed to rename). The contract example specifies the line is emitted WHEN a backup exists, not unconditionally."
  - "Test 5 (backup-line) uses a DIFFERENT scenario from Tests 3-4-6: stale-live + newer-cache, NOT missing-install. The missing-install case can never produce a backup, so the backup-line assertion would be unreachable on that fixture. The two scenarios together cover both shapes of the recovered-branch."
  - "Live label `missing` in the renderer when installResult.version is undefined (instead of `undefined` or empty). Truthful diagnostic per Finding F of Phase 95.2 (`'missing' is more truthful than 'unknown' when the install dir doesn't exist`)."

patterns-established:
  - "Contract-as-source-of-truth fixture pattern: test loads the markdown contract doc via fs.readFileSync, finds a named section via regex, extracts a fenced code block, and asserts the required line patterns are present in the source. Live-renderer assertions reuse the extracted regexes (never duplicating them). Future Plan 03 (acceptance-gate self-coverage) will reuse this pattern across multiple commands/*.md contracts."

requirements-completed: []  # this plan has no `requirements` frontmatter field (Phase 126 is hotfix-discipline territory; requirement IDs land in Plan 03 + 07)

# Metrics
duration: 5min 34s
completed: 2026-05-14
---

# Phase 126 Plan 01: --fix Renderer Contract Test + Fix Summary

**Closed the 2026-05-13 Windows dogfood finding 3a -- doctor --fix now emits both `✓ recovered to <version>` and `backup <path>` lines per the commands/doctor.md Step 3 contract, with summary semantics aligned to the recovered header. Test fixture loads the contract doc itself as source-of-truth, ensuring the contract is the enforcer.**

## Performance

- **Duration:** 5min 34s
- **Started:** 2026-05-14T10:33:51Z
- **Completed:** 2026-05-14T10:39:25Z
- **Tasks:** 2 / 2 complete
- **Files modified:** 2 (+ 1 created)
- **Lines:** +473 net (+411 new test, +62 renderer fix)

## Accomplishments

- Caught the dogfood bug in test code BEFORE patching the renderer (TDD red -> green discipline). 7-sub-test hermetic fixture; 5 GREEN at RED commit, 7 GREEN at GREEN commit -- proving the test reproduces the bug AND the fix closes it.
- Established the contract-as-source-of-truth fixture pattern: test loads commands/doctor.md, regex-extracts the required line patterns from the "Example output (recovery successful)" block, asserts the live renderer matches. Future drift in the contract document fails the test at extraction (Test 1), surfacing the drift the moment it's introduced.
- Minimum-surface renderer fix: 1 new branch in renderHumanReport (`if (report.classARecovered)`), 1 new branch in computeSummary (`if (report.classARecovered) healthy += 1`). Zero new functions. Zero new modules. Zero new runtime dependencies. Canon Part 7 hotfix discipline preserved.
- Backup-line semantics aligned with the missing-install case: when performRecoveryAtomic returns backup=null (nothing existed to rename), the renderer omits the backup line per the contract example -- the line is emitted WHEN a backup exists, not unconditionally.

## Task Commits

Each task was committed atomically with --no-verify (parallel-wave coordination):

1. **Task 1 (RED): tests/test-doctor-fix-renderer.cjs created** -- `d6c891e` (test)
   - 7 sub-tests; 5 GREEN at this commit (Tests 1, 2, 3, 5, 7), 2 RED (Tests 4 + 6)
   - Test 1 extracts the contract from commands/doctor.md "Example output (recovery successful)" block
   - Test 4 asserts `✓ recovered to 1.13.0-beta.99` -- RED because pre-fix renderer routes to `cannot read state` branch
   - Test 6 asserts Summary line is NOT `1 drift / 0 warnings` after recovery -- RED because pre-fix computeSummary classifies recovered drift as drift
   - Note: this commit also captured the sibling-126-02 test file `tests/test-marketplace-cache-prerelease-pick.cjs` due to a parallel-execution race in staging; this is harmless additive content and does not affect Plan 01's correctness (see Deviations below)

2. **Task 2 (GREEN): scripts/doctor.cjs renderer fix** -- `14fbd45` (fix)
   - renderHumanReport (line ~2416-2451): hoist `report.classARecovered` into a dedicated precedence branch; emit both contract lines; show `missing` as the live label when installResult.version is undefined; omit backup line when backup is null
   - computeSummary (line ~2546-2564): after classARecovered, classify as healthy instead of drift (Option A: decrement-after-recovery; minimum surface delta)
   - All 7 tests/test-doctor-fix-renderer.cjs sub-tests GREEN
   - Regression check: tests/test-doctor-atomic-swap.cjs 9/9 GREEN; tests/test-doctor-class-{i,h-fix,g-fix}.cjs all GREEN; tests/test-doctor-acceptance.cjs 5/6 GREEN with the acc.5 failure being a pre-existing release.sh Step 9.6 ordering issue (Plan 04 territory, NOT introduced by Plan 01 -- verified by stash-test before merge)

## Files Created/Modified

- `tests/test-doctor-fix-renderer.cjs` (CREATED) -- 7-sub-test hermetic fixture. Loads commands/doctor.md as the contract source; asserts the live renderer output against the extracted patterns. Hermetic envelope via mktempSync HOME + USERPROFILE + MINDRIAN_PLUGIN_HOME override; ANSI-strip helper for grep-against-color-output. Mirrors the pattern from tests/test-doctor-class-i.cjs + tests/test-doctor-acceptance.cjs.
- `scripts/doctor.cjs` (MODIFIED) -- renderHumanReport precedence branch + computeSummary recovery-aware classification. +62 lines net, -7 deletions. No new functions, no new modules. Existing pre-recovery branches preserved as fallbacks.
- `tests/run-all-126.sh` (MODIFIED) -- CJS_SUITES entry registered for the Phase 126 scoped runner. Note: sibling 126-02 also added its own entry to the same file in the same parallel wave; both entries coexist cleanly.

## Decisions Made

- **D1: Option A (drift-count decrement) over Option B (explicit recovered tally).** Option B would have required extending computeSummary's return shape AND updating every consumer (the JSON output, the F.1 selector gating logic, future test fixtures). Option A is a single new branch with no shape change. Canon Part 7 hotfix discipline.

- **D2: Renderer branch precedence by classARecovered.** Handled FIRST in renderHumanReport so the missing-install path enters the recovery branch instead of the legacy `cannot read state` fallback. Existing status==='ok' && cache.status==='ok' branches are preserved unchanged as fallbacks; the new branch is purely additive.

- **D3: Backup-line conditional.** Omit `backup <path>` when classARecovered.backup is null (missing-install case). The contract example specifies the line is emitted WHEN a backup exists, not unconditionally.

- **D4: Test 5 uses stale-live + newer-cache scenario (NOT missing-install).** Because missing-install can never produce a backup, the backup-line assertion would be unreachable on that fixture. The two scenarios together cover both shapes of the recovered-branch.

- **D5: Live label `missing` (not `undefined`).** When installResult.version is undefined, the renderer shows `missing` as the live label -- truthful diagnostic per Finding F of Phase 95.2.

## Deviations from Plan

### Coordination Notes (parallel-wave)

**1. [Plan 01 Task 1 commit captured sibling 126-02 test file]**
- **Found during:** Task 1 commit (d6c891e)
- **Issue:** `git status` after `git add tests/test-doctor-fix-renderer.cjs tests/run-all-126.sh` reported the staged file set correctly, but the resulting commit ALSO captured `tests/test-marketplace-cache-prerelease-pick.cjs` (created by sibling 126-02 in parallel). Most likely a race between two parallel agents staging untracked files.
- **Impact:** Zero functional impact. The 126-02 test file is purely additive content; it was destined for the next 126-02 commit anyway. Sibling 126-02's working tree will see the file as already-committed and will commit their other Plan-02 artifacts (the cmpVersion fix in scripts/doctor.cjs lines ~194-205, the package.json `semver` devDep) in their own commit.
- **Risk surface:** None. The two plans modify DIFFERENT regions of scripts/doctor.cjs (Plan 01 = renderer at ~2416 + computeSummary at ~2541; Plan 02 = cmpVersion at ~194-205). No line conflict possible.
- **Action:** Documented here; no recovery action needed. The sibling agent's commit history may end up with an empty-shape staging step for the test file but is otherwise unaffected.

### Auto-fixed Issues

**1. [Rule 1 - Test bug] Test 1 regex used invalid JS `\Z` anchor**
- **Found during:** Task 1 first RUN
- **Issue:** Section-extraction regex used `(?=^##\s|\Z)` -- JS regex has no `\Z` anchor (it's a Perl/Python construct), so the alternation effectively required `^##` and missed end-of-document.
- **Fix:** Replaced with `(?=\n##\s|$(?![\s\S]))` -- JS-portable end-of-string lookahead.
- **Files modified:** tests/test-doctor-fix-renderer.cjs (Test 1 only)
- **Verification:** Test 1 now PASSES against commands/doctor.md
- **Committed in:** d6c891e (folded into the Task 1 commit before push -- iteration during RED)

**2. [Rule 1 - Test bug] Test 5 timestamp regex was too strict**
- **Found during:** Task 1 first RUN
- **Issue:** Test 5 asserted `/\d{6,}/` (6+ digit run) in the backup path, but doctor.cjs at line 292 builds timestamps as `20260514-103556` (8 digits, dash, 6 digits). The dash splits the digit-run; `/\d{6,}/` matches only the YYYYMMDD half.
- **Fix:** Relaxed to `/-\d{4,}/ || /\d{8}-\d{6}/` -- accept either a dash-prefixed digit-run OR the explicit YYYYMMDD-HHMMSS shape.
- **Files modified:** tests/test-doctor-fix-renderer.cjs (Test 5 only)
- **Verification:** Test 5 now PASSES on the live timestamp
- **Committed in:** d6c891e (folded into the Task 1 commit)

## Verification

- `node tests/test-doctor-fix-renderer.cjs` -- 7/7 PASS
- `node tests/test-doctor-atomic-swap.cjs` -- 9/9 PASS (no regression; the JSON-shape byte-stability check S6 passed unchanged)
- `node tests/test-doctor-class-i.cjs` -- 11/11 PASS (no regression on class I install-state)
- `node tests/test-doctor-class-h-fix.cjs` -- 3/3 PASS (no regression on class H statusline-block)
- `node tests/test-doctor-class-g-fix.cjs` -- 3/3 PASS (no regression on class G migrate-stale-user-settings)
- `node tests/test-doctor-acceptance.cjs` -- 5/6 PASS (acc.5 pre-existing failure; verified pre-existing via stash test)
- Live smoke test on dev workspace (~/MindrianOS-Plugin/) -- `node scripts/doctor.cjs` renders the unchanged `cannot read state` fallback for class A on this box (the install dir doesn't exist on the dev box -- the exact dogfood scenario), and the F.1 + Zone 4 footer rendering are intact.

## Future-Drift Signals to Watch

- If `commands/doctor.md` Step 3 or the "Example output (recovery successful)" section is reorganized, Test 1's regex extraction may fail. The section-extraction regex looks for the literal heading `## Example output (recovery successful)` (not Step 3's heading, because the example block IS the contract; Step 3 is just the wrapper prose). If the heading is renamed, update the regex AND keep the new heading aligned with the contract.

- If `performRecoveryAtomic` ever returns a result shape that lacks `recoveredVersion` (e.g., a partial-recovery path), the renderer will emit `✓ recovered to undefined`. Add a guard before the GREEN branch ships to production if Plans 03/05 introduce such a shape (they don't today).

- If a future plan adds a new render-from-recovery path (e.g., classBRecovered for cascade-rooms), apply the same precedence-by-recovery pattern: hoist the recovery branch BEFORE the status-shape branches. The pattern is documented in the renderHumanReport comment block as Phase 126 Plan-01 (search for "Plan-01 fix:" in scripts/doctor.cjs).

## Reference Forward

- **Plan 126-03** (acceptance-gate self-coverage) will incorporate this fixture's contract-as-source pattern into the broader scaffolded-broken-state aggregator. Specifically, the regex-extraction approach generalizes: for any commands/*.md that has a documented `## Example output (...)` block, a sub-test can load + extract + assert against the live runner.
- **Plan 126-02** (marketplace-cache prerelease semver-pick fix) lands the cmpVersion fix in scripts/doctor.cjs lines ~194-205. The two regions are non-overlapping; no merge conflict.

---

## Self-Check: PASSED

All claimed artifacts and commits verified:

- File `tests/test-doctor-fix-renderer.cjs` FOUND (411 lines)
- File `scripts/doctor.cjs` modified, +62 / -7 net FOUND
- File `tests/run-all-126.sh` modified (CJS_SUITES entry registered) FOUND
- Commit `d6c891e` FOUND (test(126-01): add RED renderer contract test for /mos:doctor --fix)
- Commit `14fbd45` FOUND (fix(126-01): doctor --fix renderer emits recovered+backup lines (GREEN))
- All 7 sub-tests in tests/test-doctor-fix-renderer.cjs GREEN
- tests/test-doctor-atomic-swap.cjs 9/9 GREEN (no regression)
- commands/doctor.md UNCHANGED (the test is the contract enforcer, not the contract author -- Plan 01 must_haves.truths[3])

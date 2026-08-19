---
phase: quick-260819-dmm
plan: 01
subsystem: infra
tags: [git, gitignore, release-gate, intelligence-cascade, dashboard]

# Dependency graph
requires: []
provides:
  - "dashboard/graph.json untracked (git rm --cached), still present on disk"
  - "Dated doctrine comment in .gitignore explaining the release-abort cause"
  - "lib/core/intelligence-cascade.cjs Step 9 writes to an explicit PLUGIN_ROOT-anchored path"
  - "lib/core/graph-ops.cjs buildGraph default anchored on __dirname instead of cwd"
affects: [release-process, scripts/verify-release, scripts/doctor.cjs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Generated per-room artifacts anchor their default output path on __dirname/PLUGIN_ROOT, never cwd"

key-files:
  created: []
  modified:
    - .gitignore
    - lib/core/intelligence-cascade.cjs
    - lib/core/graph-ops.cjs
    - tests/test-cascade-surface-loop-fires.cjs
    - tests/test-compute-state-persists.cjs
    - tests/run-all-162.sh

key-decisions:
  - "Untracked dashboard/graph.json via git rm --cached rather than deleting it; the file must stay on disk for serve-dashboard and the cascade to keep working."
  - "Anchored Step 9's build-graph call to an explicit PLUGIN_ROOT-anchored output path instead of adding a cwd option, since the explicit argv path is the direct fix and build-graph already mkdir -p's the parent dir."
  - "Deferred room-scoping the cascade's graph output to <roomDir>/.presentation/graph.json as an inline comment, not a .planning/ file (which is gitignored and does not travel between machines) -- explicitly out of scope for this drift fix."

requirements-completed: [QUICK-260819-DMM]

# Metrics
duration: 5min
completed: 2026-08-19
---

# Quick Task 260819-dmm: Untrack the Generated Dashboard Graph JSON Summary

**Untracked dashboard/graph.json from git (kept on disk), anchored both CWD-relative graph-output defaults to PLUGIN_ROOT/__dirname, and killed the release clean-tree drift class it caused.**

## Performance

- **Duration:** ~5 min (commit-to-commit)
- **Started:** 2026-08-19T09:53:00+03:00
- **Completed:** 2026-08-19T09:55:06+03:00
- **Tasks:** 2 completed
- **Files modified:** 7 (.gitignore, dashboard/graph.json index removal, lib/core/intelligence-cascade.cjs, lib/core/graph-ops.cjs, and 3 test comment refreshes)

## Accomplishments
- Removed `dashboard/graph.json` from git's index (`git rm --cached`); file remains on disk for `scripts/serve-dashboard` and the cascade to write to.
- Upgraded the previously-inert `.gitignore` comment (the pattern existed but had zero effect against an already-tracked path) into a dated doctrine comment explaining the whole causal chain: CWD-relative `build-graph` default -> repo-cwd cascade runs rewriting the tracked file with a temp-fixture room's graph -> release clean-tree pre-flight abort.
- Anchored `lib/core/intelligence-cascade.cjs` Step 9's `build-graph` invocation to pass an explicit `PLUGIN_ROOT`-anchored output path, so the write lands in one deterministic place regardless of the cascade's cwd.
- Anchored `lib/core/graph-ops.cjs`'s `buildGraph` default output path (previously `'./dashboard/graph.json'`, a dead-but-latent landmine since its only caller always passes an explicit path) on `__dirname` instead of cwd.
- Filed the room-scoping product decision (moving the cascade's graph output to `<roomDir>/.presentation/graph.json`) as an inline deferred comment at the Step 9 call site, deliberately not implemented.
- Refreshed the three stale workaround comments in `tests/test-cascade-surface-loop-fires.cjs`, `tests/test-compute-state-persists.cjs`, and `tests/run-all-162.sh` that referenced a "committed snapshot" which no longer exists; kept the cwd-pinning behavior itself untouched (still correct defensive hygiene).

## Task Commits

Each task was committed atomically:

1. **Task 1: Untrack dashboard/graph.json and record the doctrine** - `6d3845d6` (fix)
2. **Task 2: Anchor the two CWD-relative graph output paths and refresh the stale workaround comments** - `99d36b11` (fix)

_No plan-metadata commit created by this executor; docs commit (SUMMARY.md/STATE.md) is handled by the orchestrator per task constraints._

## Files Created/Modified
- `.gitignore` - Existing `dashboard/graph.json` pattern kept as the single entry; the one-line `# Dashboard generated data` comment replaced with a dated doctrine comment naming the release-abort root cause.
- `dashboard/graph.json` - Removed from git's index only (`git rm --cached`); untouched on disk.
- `lib/core/intelligence-cascade.cjs` - Step 9's `execFileSync` call now passes a third argv element (`path.join(PLUGIN_ROOT, 'dashboard', 'graph.json')`); added a doctrine comment plus the inline DEFERRED room-scoping note.
- `lib/core/graph-ops.cjs` - `buildGraph`'s `outputPath` default changed from `'./dashboard/graph.json'` to `path.resolve(__dirname, '../../dashboard/graph.json')`; JSDoc updated to match.
- `tests/test-cascade-surface-loop-fires.cjs` - Comment at the cwd-pin refreshed to note the write is no longer CWD-relative as of 2026-08-19; pin itself unchanged.
- `tests/test-compute-state-persists.cjs` - Same comment refresh at the `process.chdir(tmp)` pin.
- `tests/run-all-162.sh` - Header comment refreshed to say the file is generated/gitignored, not a committed snapshot at risk of being clobbered.

## Decisions Made
- Used `git rm --cached` (not `git rm` or manual delete) so the working copy survives for consumers that expect the file to exist on disk between cascade runs.
- Chose an explicit third `execFileSync` argument over adding a `cwd` option to the Step 9 call, per the plan's explicit instruction: `scripts/build-graph` already handles directory creation on both its bash and python branches, so the argument alone is sufficient and keeps the existing try/catch (non-fatal on failure) untouched.
- Left the cwd-pinning behavior in all three test files intact -- only their comments changed -- since the pins remain correct defensive hygiene for the rest of each test's cascade/hook run, independent of this specific drift.

## Deviations from Plan

None - plan executed exactly as written. All three packaging-surface facts named in the plan's grounding (package.json `files` excludes `dashboard/`; `scripts/serve-dashboard` and `scripts/generate-standalone` both regenerate their own graph before use) held when re-checked via the Task 1 verify gate (`npm pack --dry-run` payload contains zero `dashboard/` entries) and via the passing `scripts/verify-release` and `node scripts/doctor.cjs --acceptance` runs; no compensating change was needed.

## Issues Encountered

None. `git add .gitignore dashboard/graph.json` initially errored ("paths are ignored") because `git rm --cached` had already staged the deletion; staging just `.gitignore` alongside the pre-staged deletion resolved it without any code or behavior change.

## User Setup Required

None - no external service configuration required. Collaborators pulling these commits will see their local `dashboard/graph.json` deleted by git on next pull/checkout; this is correct and self-healing -- the next `scripts/serve-dashboard` or cascade run regenerates it at the same repo-anchored path.

## Next Phase Readiness

- The release clean-tree drift class (`doctor.cjs verify-release-clean-tree`, `scripts/verify-release`) is closed: `node --test tests/test-224-per-write-derive.cjs` followed by `git status --porcelain --untracked-files=no` returns empty, `bash scripts/verify-release` reports "CLEAR TO RELEASE" (32 passed / 0 failed / 2 pre-existing unrelated warnings: command-registration render-quality and a missing beta.6 CHANGELOG entry, neither touched by this plan), and `node scripts/doctor.cjs --acceptance` reports `verify-release-clean-tree: PASS`.
- No blockers. The deferred room-scoping decision (`<roomDir>/.presentation/graph.json`) is filed inline at the Step 9 call site in `lib/core/intelligence-cascade.cjs` for a future phase to pick up as a deliberate product decision, not an oversight.

## Self-Check: PASSED

All 7 modified/preserved files found on disk; both task commits (`6d3845d6`, `99d36b11`) found in `git log --oneline --all`.

---
*Phase: quick-260819-dmm*
*Completed: 2026-08-19*

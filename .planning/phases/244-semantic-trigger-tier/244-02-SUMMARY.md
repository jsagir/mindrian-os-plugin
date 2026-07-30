---
phase: 244-semantic-trigger-tier
plan: 02
subsystem: eureka
tags: [sqlite-fts5, enqueue-then-drain, detached-spawn, index-lifecycle, canon-part-9]

# Dependency graph
requires:
  - phase: 244-01
    provides: "tri-modal-index.cjs::tableExists promoted to a public export"
provides:
  - "lib/core/eureka/fts-index-lifecycle.cjs: ftsIndexState/requestFtsBuild/spawnFtsBuildDrain/readQueue/writeQueue/queuePath, FTS_BUILD_MAX_ATTEMPTS, FTS_QUEUE_RELATIVE"
  - "scripts/fts-index-drain.cjs: the expensive half, --worker --room <dir> CLI, keep-on-failure reconcile, permanent-failure log"
  - "<roomDir>/.mindrian/fts-index-queue.json and fts-index-failures.json runtime state files"
  - "MOS_NO_DETACHED_FTS_BUILD env test seam"
affects: [244-05, 244-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Enqueue-then-detached-drain pair (cheap sync enqueue + spawn, expensive async drain), the 4th instance of the gsd-graph-derive-sweep/drain shape already shipped 3 times in this repo"
    - "Keep-on-failure queue reconcile with a max-attempts cap and a permanent-failure log record, never a silent clear (the RCA-graph-derive-silent-clear shape, fenced by mutation proof 3)"
    - "Liveness-canary SELECT inside a soft-fail classifier so a closed/invalid db handle cannot be misclassified as a legitimate absent-table state"

key-files:
  created:
    - lib/core/eureka/fts-index-lifecycle.cjs
    - scripts/fts-index-drain.cjs
    - tests/test-244-fts-index-lifecycle.cjs
  modified: []

key-decisions:
  - "Classification precedence in ftsIndexState: absent, then unavailable, then stale (orphan_rows >= 1), then empty (fts_rows===0 while node_rows>0), then ok -- exactly as specified in the plan's <action> block"
  - "requestFtsBuild dedupes by resolved roomDir only (one pending build per room), mirroring enqueueDerive's dedupe shape from scripts/gsd-graph-derive-sweep.cjs verbatim"
  - "spawnFtsBuildDrain checks opts.queued!==true BEFORE the MOS_NO_DETACHED_FTS_BUILD env check, so 'already_pending' and 'suppressed' stay distinguishable reasons rather than collapsing into one"
  - "The drain opens room.db through openRoomDbForCaller (the WRITABLE navigation door), never the read-only door, because this process writes the eureka_fts projection"
  - "fragments is deliberately never indexed (a NON-GOAL, not a bug to fix): indexNodes's existing SELECT already excludes it, so the correct behavior needed zero code"

requirements-completed: [TRIG-01]

# Metrics
duration: 40min
completed: 2026-07-30
---

# Phase 244 Plan 02: FTS Index Lifecycle (Enqueue + Detached Drain) Summary

**Closed RESEARCH BLOCKER B-2 (`eureka_fts` had no production build lifecycle) with a lazy build-on-first-miss: `ftsIndexState`/`requestFtsBuild`/`spawnFtsBuildDrain` in a new sync CJS module, drained by a new detached `scripts/fts-index-drain.cjs` that calls the already-shipped `indexNodes`, proven end to end with a real room going from zero lexical hits to real bm25 hits in one round trip.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-07-30T19:18:46Z
- **Tasks:** 3/3
- **Files modified:** 3 (3 new)

## Accomplishments

- `lib/core/eureka/fts-index-lifecycle.cjs` classifies the index into five distinguishable states (`index_absent`, `index_empty`, `index_stale`, `ok`, `unavailable`) and never throws, closing Correction 4's "index_absent indistinguishable from zero_hits" gap from 244-PATTERNS.md.
- `scripts/fts-index-drain.cjs` is the 4th instance of the enqueue-then-detached-drain pattern this repo already ships 3 times over (`gsd-graph-derive-sweep`/`drain`, `intelligence-cascade.cjs`'s Step 2b, `brain-derivation-drain.cjs`); no new mechanism was invented.
- The seam is live at BOTH ends: `requestFtsBuild` enqueues, `spawnFtsBuildDrain` spawns (suppressible via `MOS_NO_DETACHED_FTS_BUILD=1`), and `scripts/fts-index-drain.cjs` actually performs the build and reconciles the queue.
- `tests/test-244-fts-index-lifecycle.cjs` proves the full absent-to-built round trip against a real `buildFixtureRoom` room (not a synthetic shortcut): before the drain, `lexicalSearch` returns `[]` on a query that only matches an artifact's on-disk body text (the node carries no title at all); after the drain, the same query returns a real bm25 hit and the queue is empty.
- Keep-on-failure is mutation-proven: a failing build increments `attempts` and stays queued; at `FTS_BUILD_MAX_ATTEMPTS` it drops with a permanent-failure record in `.mindrian/fts-index-failures.json`, never a silent clear.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author lib/core/eureka/fts-index-lifecycle.cjs** - `dece8bfe` (feat)
2. **Task 2: Author scripts/fts-index-drain.cjs, the expensive half** - `6931d99e` (feat)
3. **[Rule 1 auto-fix] ftsIndexState closed-handle misclassification** - `e1ba92b0` (fix)
4. **Task 3: Prove the lifecycle round-trip end to end** - `2649313d` (test)

_No separate plan-metadata commit: SUMMARY.md is committed as part of this worktree's final commit per the parallel-executor protocol (STATE.md/ROADMAP.md are excluded and owned by the orchestrator)._

## Files Created/Modified

- `lib/core/eureka/fts-index-lifecycle.cjs` - the cheap half: `ftsIndexState(db)` classifies index state; `requestFtsBuild(roomDir, opts)` enqueues a dedup'd build request to `.mindrian/fts-index-queue.json`; `spawnFtsBuildDrain(roomDir, opts)` spawns the drain detached+unref'd, gated on `queued===true`, suppressible via `MOS_NO_DETACHED_FTS_BUILD=1`; `readQueue`/`writeQueue`/`queuePath` copy the `gsd-graph-derive-sweep.cjs` atomic-write shape verbatim
- `scripts/fts-index-drain.cjs` - the expensive half: reads the queue, opens room.db via `openRoomDbForCaller` (the WRITABLE navigation door), calls `indexNodes(db, { roomDir })` so the artifact-body-from-disk fallback is threaded, reconciles (clear-on-success, keep-and-increment-on-failure, drop-with-failure-record at `FTS_BUILD_MAX_ATTEMPTS`), always exits 0
- `tests/test-244-fts-index-lifecycle.cjs` - 13 assertions: the 5-way `ftsIndexState` classification (including never-throws on null/`{}`/closed handle), `requestFtsBuild` dedupe and write-failure, `spawnFtsBuildDrain` suppression and already-pending no-ops, the full round trip with an anti-vacuity pre-assertion, keep-on-failure, max-attempts-drop with a failure record, and a no-orphan-process check anchored on the interpreter

## Decisions Made

- **Liveness canary added to `ftsIndexState` (Rule 1 auto-fix, found while writing Task 3's tests):** `tableExists`/`countTable`/`countOrphans` each swallow their own exceptions (the repo's "failed query means zero rows" idiom), so a closed or invalid db handle looked byte-identical to a genuinely absent `eureka_fts` table -- both silently produced `index_absent` instead of the documented `unavailable`. Fixed by adding one bare `db.prepare('SELECT 1').get()` as the single call in the function allowed to throw uncaught, falling through to the outer catch. Root cause: soft-fail idioms composed at three layers (each individually correct) hid a handle-liveness failure that none of them was individually responsible for detecting.
- **requestFtsBuild reason enum validated against a fixed allowlist** (`index_absent`/`index_empty`/`index_stale`), defaulting to `index_absent` on anything else, rather than trusting the caller-supplied string verbatim -- keeps the queue file's `reason` field a closed enum (Canon Part 8), consistent with `ftsIndexState`'s own vocabulary.
- **The mutation-4 fixture reuses `buildFixtureRoom`'s existing memory_artifact hub node rather than authoring a new fixture:** that node carries NO title in its properties at all (`{section, kind, path, hash}`, no `name`/`text`/`title`), so its indexed text comes 100% from the `roomDir` path-body fallback reading its `.md` file off disk. This made mutation proof 4 (dropping `{roomDir}` from the drain's `indexNodes` call) provably red without inventing a second FTS fixture (Part 7).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ftsIndexState misclassified a closed db handle as index_absent instead of unavailable**
- **Found during:** Task 3 (writing the never-throws-on-a-closed-handle test)
- **Issue:** `tableExists(db,'eureka_fts')` catches its own exceptions and returns `false`; `countTable`/`countOrphans` do the same. On a closed `DatabaseSync` handle, every one of these silently returned its "nothing found" default instead of propagating the "database is not open" error, so `ftsIndexState` returned `{reason:'index_absent', node_rows:0, ...}` instead of the documented `{reason:'unavailable', ...}`.
- **Fix:** Added a single liveness-canary `db.prepare('SELECT 1').get()` inside the try block, before any of the soft-failing helpers run. This is the ONE statement in the function permitted to throw uncaught, landing in the outer catch.
- **Files modified:** `lib/core/eureka/fts-index-lifecycle.cjs`
- **Verification:** `tests/test-244-fts-index-lifecycle.cjs`'s "null, {} and a closed handle return unavailable and never throw" leg, PASS.
- **Committed in:** `e1ba92b0`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for correctness (a closed handle must not present as a legitimate index state). No scope creep; no plan file list, export surface, or behavior contract changed.

## Issues Encountered

- **Unrelated side-effect files regenerated during test runs** (`evals/plurai/211-baseline.json`, `package-lock.json`, `.mindrian-npm-install.lock`), matching the known repo quirk flagged for this wave. Discarded (`git checkout --` / `rm`) before the final commit; none were staged or committed.
- **`node scripts/doctor.cjs --acceptance` transiently showed 14/15** (failing only `verify-release-clean-tree`) while the Rule 1 fix and the new test file were still uncommitted (an expected "dirty tree" signal, not a real regression). Re-ran after committing everything: **15/15**, matching the plan's own doctor-acceptance verification requirement (no change expected in this plan; none occurred).

## Mutation Proofs (4 total, all executed live and reverted)

### MUTATION PROOF 1 -- `ftsIndexState` forced to return `reason:'ok'` unconditionally

```
FAIL: ftsIndexState: db with nodes and no eureka_fts returns index_absent -- Expected values to be strictly deep-equal
FAIL: ftsIndexState: after openIndex but before indexNodes returns index_empty -- Expected values to be strictly equal
FAIL: ftsIndexState: after a real indexNodes over a populated nodes table returns ok -- fts_rows > 0
FAIL: ftsIndexState: an orphan node_id in eureka_fts classifies as index_stale -- Expected values to be strictly equal
FAIL: ftsIndexState: null, {} and a closed handle return unavailable and never throw -- Expected values to be strictly deep-equal
FAIL: round trip: absent -> queued -> drained -> ok (anti-vacuity: no hits before the drain) -- no eureka_fts table yet
Phase 244-02 fts-index-lifecycle: PASS=7 FAIL=6
```

Restored byte-identical (`diff` clean); re-ran green (`PASS=13 FAIL=0`).

### MUTATION PROOF 2 -- the dedupe check removed from `requestFtsBuild`

```
FAIL: requestFtsBuild: first call queues, second identical call dedupes (no duplicate entry) -- second identical call does not queue again
Phase 244-02 fts-index-lifecycle: PASS=12 FAIL=1
```

Restored byte-identical; re-ran green (`PASS=13 FAIL=0`).

### MUTATION PROOF 3 -- the drain's reconcile changed to clear the entry on FAILURE too (the RCA-graph-derive-silent-clear shape)

```
FAIL: drain keep-on-failure: a failing build keeps its entry with attempts incremented -- the failing entry is KEPT, not silently cleared
FAIL: drain max-attempts drop: after FTS_BUILD_MAX_ATTEMPTS the entry drops with a failure record -- a permanent-failure record was written, never a silent drop
Phase 244-02 fts-index-lifecycle: PASS=11 FAIL=2
```

Restored byte-identical; re-ran green (`PASS=13 FAIL=0`).

### MUTATION PROOF 4 -- the `{roomDir}` argument dropped from the drain's `indexNodes` call

```
FAIL: round trip: absent -> queued -> drained -> ok (anti-vacuity: no hits before the drain) -- the same query now returns at least one hit
Phase 244-02 fts-index-lifecycle: PASS=12 FAIL=1
```

Restored byte-identical; re-ran green (`PASS=13 FAIL=0`). This proves the body-from-disk fallback is actually threaded rather than assumed: the fixture room's memory_artifact hub node carries no title, so without `roomDir` its indexed text is empty and the node is skipped by `indexNodes` entirely.

## Verification Results

- `bash tests/run-all-244.sh`: `PASS=4 FAIL=0 SKIP=0` (all four discovered test files pass, including the two from Plan 01 and the no-em-dash fence).
- `bash tests/run-all-219.sh`: `Phase 219: PASS=11 FAIL=2 SKIP=0` -- byte-identical to the baseline captured in 244-01-SUMMARY.md (the 2 failures are the pre-existing, out-of-scope `edges.review_status` schema-drift condition from a concurrent session, confirmed unrelated to this plan).
- `node scripts/check-substrate.cjs --diff`: exit 0.
- `node scripts/doctor.cjs --acceptance`: **15/15 both before and after** (transiently 14/15 mid-edit while this plan's own files were uncommitted; not a regression -- see Issues Encountered).
- `git diff --stat` across this plan's 4 commits shows exactly the 3 files declared in `files_modified`: `lib/core/eureka/fts-index-lifecycle.cjs`, `scripts/fts-index-drain.cjs`, `tests/test-244-fts-index-lifecycle.cjs`.
- `pgrep -af "^[^ ]*node .*fts-index-drain"` returns nothing after the full test run (no orphan process).

## Next Phase Readiness

- Plan 05 (the content sensor's ctx-assembly producer) can now call `ftsIndexState` + `requestFtsBuild` + `spawnFtsBuildDrain` to implement the lazy build-on-first-miss without ever awaiting a build on the foreground turn.
- Plan 06 (the doctor module) can read `<roomDir>/.mindrian/fts-index-failures.json` to surface permanently-failed builds, and call `ftsIndexState` for a presence/freshness check.
- No blockers. `tests/run-all-244.sh` is green (3/8 planned test files discovered so far; the remaining five belong to later plans in this phase).

---
*Phase: 244-semantic-trigger-tier*
*Completed: 2026-07-30*

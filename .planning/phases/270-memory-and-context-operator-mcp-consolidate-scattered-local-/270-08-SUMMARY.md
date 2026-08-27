---
phase: 270-memory-and-context-operator-mcp-consolidate-scattered-local-
plan: 08
subsystem: mcp
tags: [resources, chokidar, sendResourceListChanged, icm-forest]

requires:
  - phase: 270-07
    provides: "lib/core/icm-forest.cjs's discoverIcmForest/listRoomRoots, which mos://tree and the watcher both delegate to"
  - phase: 270-05
    provides: "the ctx-shaped registerResources signature this plan adds two more registrations onto"
  - phase: 270-03
    provides: "tests/test-270-dynamic-tree.cjs, the RED pin this plan greens"
provides:
  - "mos://tree and mos://room/{slug}/tree MCP Resources"
  - "lib/mcp/tree-watcher.cjs: startTreeWatcher/stopTreeWatcher/TREE_WATCH_DEBOUNCE_MS"
  - "session-catchup.cjs's registerShutdownHandler extraTeardown seam"
affects: [270-12]

tech-stack:
  added: []
  patterns:
    - "A before/after top-level readdir snapshot compared on chokidar's 'ready' event, to catch directories created during the initial-crawl race window that chokidar's own addDir event silently misses"
    - "registerShutdownHandler(roomDir, extraTeardown): a singleton shutdown registration that accepts additional teardown callbacks instead of each caller adding its own process.on(SIGTERM/SIGINT/beforeExit) listener"

key-files:
  created:
    - lib/mcp/tree-watcher.cjs
  modified:
    - lib/mcp/resources.cjs
    - lib/mcp/session-catchup.cjs
    - bin/mindrian-mcp-server.cjs
    - tests/test-270-resource-session-room.cjs

key-decisions:
  - "mos-room-tree's slug validation is a local SAFE_SLUG_RE regex plus a filter-by-slug over discoverIcmForest's own already-computed rooms array, rather than importing tool-router.cjs's test-only-exported safeResolveSection/SECTION_RE pair or adding a scoping parameter to icm-forest.cjs in this plan."
  - "Extended session-catchup.cjs's registerShutdownHandler with an optional extraTeardown parameter (backward compatible) rather than adding a second independent process-exit listener, after reading its contract and finding it did not already support extension as the plan assumed."

requirements-completed: [MEMOP-03]

duration: 100min
completed: 2026-08-27
---

# Phase 270 Plan 08: ICM Forest as a Live Resource Summary

**`mos://tree` and `mos://room/{slug}/tree` expose the ICM forest as MCP Resources -- zero cost against the always-loaded tool schema budget. `lib/mcp/tree-watcher.cjs` fires a debounced `sendResourceListChanged` when a room appears or disappears, with a real chokidar v4 startup race found and fixed (not assumed away) along the way. All four of this plan's target legs in `tests/test-270-dynamic-tree.cjs` pass, and the watcher terminates cleanly with no hung handle.**

## Performance

- **Duration:** 100 min
- **Tasks:** 2
- **Files modified:** 5 (1 new, 4 modified)

## Accomplishments

- `mos-tree` (static, `mos://tree`): returns `discoverIcmForest({})`'s payload verbatim, wrapped in try/catch (`{ok:false, reason, home}` on failure, never a throw). No second shaping layer -- the structure-only rule lives entirely in `lib/core/icm-forest.cjs`.
- `mos-room-tree` (`ResourceTemplate`, `mos://room/{slug}/tree`): a REAL `list` callback that re-evaluates per call (unlike `reasoningTemplate`'s own known non-enumerable inconsistency, which this records but does not fix). `variables.slug` validated against `SAFE_SLUG_RE` before any use; an invalid or unknown slug returns `{ok:false, reason:'unknown_room'}` without echoing the raw value.
- `lib/mcp/tree-watcher.cjs`: watches `addDir`/`unlinkDir` only (never `add`/`change`/`unlink`), bounded depth, dot-dirs and `node_modules` ignored, trailing-edge debounce coalescing rapid churn to one notification per window, module-level singleton, safe-when-not-running `stopTreeWatcher()`.
- **Real bug found and fixed, not assumed away**: a directory created between `chokidar.watch()` returning and its `ready` event is silently folded into "initial" state and never fires its own `addDir` -- reproduced standalone (four isolated diagnostic scripts) before writing the fix. A before/after top-level `readdirSync` snapshot compared on `ready` catches exactly this window. This is the common real-world case (a room created shortly after server boot), so the fix matters beyond just making the test pass.
- `session-catchup.cjs`'s `registerShutdownHandler` extended with an optional `extraTeardown` callback (backward compatible -- every existing call site with one argument is unaffected) after reading its actual contract and finding it did NOT already support extension, contrary to the plan's assumption. `stopTreeWatcher` now rides this single registration instead of adding a second process-exit listener.
- `listChanged` capability: confirmed by reading `mcp.js`'s `setResourceRequestHandlers` -- it self-declares `{ resources: { listChanged: true } }` on the very first `resource()` registration. Nothing new declared here.
- **Assumption A4 recorded** (`tree-watcher.cjs`'s own header, verbatim in substance): SDK-side firing of `sendResourceListChanged()` is confirmed by reading `mcp.js:451-524`. Whether Claude Code, Desktop, or Cowork clients actually act on the notification is NOT verified by any automated test in this repo and remains a manual verification (`270-VALIDATION.md` MEMOP-12).

## Task Commits

1. **Task 1: mos://tree + mos://room/{slug}/tree** - `0d3799cf` (feat)
2. **Task 2: lib/mcp/tree-watcher.cjs + boot wiring** - `639323b9` (feat)

## Files Created/Modified

- `lib/mcp/resources.cjs` - two new Resource registrations
- `lib/mcp/tree-watcher.cjs` - the watcher module
- `lib/mcp/session-catchup.cjs` - `extraTeardown` seam on `registerShutdownHandler`
- `bin/mindrian-mcp-server.cjs` - boot wiring, try/catch-wrapped
- `tests/test-270-resource-session-room.cjs` - registration count (7 -> 9) and expected-name set extended for the two additions

## Decisions Made

See `key-decisions` above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, found via verification] Em-dashes copied from the existing file's style into new comment lines**
- **Found during:** Task 1 acceptance check
- **Issue:** New section-header comments ("8. mos-tree (static) -- mos://tree") copied the pre-existing file's em-dash convention (which is left untouched by instruction), violating the no-em-dash rule for NEW content.
- **Fix:** Replaced with hyphens in the two new lines only; the seven pre-existing header em-dashes remain untouched as instructed.
- **Committed in:** `0d3799cf`

**2. [Rule 1 - Bug, found via verification] A grep-hygiene false positive: a comment explaining what we do NOT do tripped the "template is not enumerable" check**
- **Found during:** Task 1 verification
- **Issue:** A comment stating "Deliberately NOT `list: undefined`" (explaining the template DOES supply a real list function) contained the literal substring the verification regex scans for, since the regex is not comment-aware.
- **Fix:** Reworded to avoid the literal pattern while keeping the same meaning.
- **Committed in:** `0d3799cf`

**3. [Rule 1 - Bug, found via verification] test-270-resource-session-room.cjs's hardcoded registration count and name set needed extending**
- **Found during:** Task 1 verification (the plan's own instruction anticipated this exact case)
- **Issue:** Plan 270-02's sanity guard hardcoded "expected 7 resource+template registrations"; adding two more resources correctly makes this 9.
- **Fix:** Updated the count and `expectedNames` array to include `mos-tree` and `mos-room-tree` -- a real extension, not a suppression, per the plan's own explicit instruction.
- **Committed in:** `0d3799cf`

**4. [Rule 1 - Necessary correction] `registerShutdownHandler` did not already support a second teardown callback**
- **Found during:** Task 2 read_first (reading the function's actual contract, as the plan instructed)
- **Issue:** The plan assumed this function was already a generic shutdown-teardown registrar; reading it showed it hardcodes `snapshotSession(roomDir)` with no extension point.
- **Fix:** Added an optional `extraTeardown` parameter, backward compatible with every existing single-argument call site.
- **Files modified:** lib/mcp/session-catchup.cjs
- **Verification:** `node --check` passes; a manual smoke test confirmed the extra callback fires alongside the session snapshot on shutdown.
- **Committed in:** `639323b9`

**5. [Rule 1 - Bug, found empirically] A real chokidar v4 startup race silently dropped directories created immediately after `startTreeWatcher`**
- **Found during:** Task 2 verification (`tests/test-270-dynamic-tree.cjs` leg 4 initially failed)
- **Issue:** A directory created between `chokidar.watch()` returning and its `ready` event is folded into "initial" state and never emits `addDir` -- reproduced standalone with four isolated diagnostic scripts (with and without `awaitWriteFinish`) before concluding it was a genuine chokidar timing behavior, not a config mistake.
- **Fix:** A before/after top-level `readdirSync` snapshot compared on the `ready` event fires the debounce if anything changed during that window.
- **Files modified:** lib/mcp/tree-watcher.cjs
- **Verification:** `tests/test-270-dynamic-tree.cjs` leg 4 passes; the fix was verified isolated (standalone diagnostic) before being applied to the real module.
- **Committed in:** `639323b9`

---

**Total deviations:** 5 auto-fixed (3 grep-hygiene/em-dash/count corrections in Task 1, 2 real behavioral bugs found and fixed in Task 2). **Impact:** All necessary for correctness; the chokidar race fix (#5) matters beyond this plan's own test, since it is the common real-world case of a room created shortly after server boot. No scope creep.

## Issues Encountered

None beyond the five deviations above, all resolved within this plan.

## Next Phase Readiness

- Wave 4's other plan (270-09, `context_assemble`) is independent of this one and proceeds separately.
- Plan 270-12 (Wave 7) is where `registerShutdownHandler`'s new `extraTeardown` seam and the tree-watcher's boot wiring should be considered stable, reusable patterns if any future teardown need arises.

---
*Phase: 270-memory-and-context-operator-mcp-consolidate-scattered-local-*
*Completed: 2026-08-27*

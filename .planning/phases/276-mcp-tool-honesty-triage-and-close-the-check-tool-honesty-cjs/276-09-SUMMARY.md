---
phase: 276-mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs
plan: 09
subsystem: room.db write-safety (C4 propagation)
tags: [room-db, busy-timeout, node-sqlite, wal, tdd-green, census]

# Dependency graph
requires:
  - phase: 276-02
    provides: "tests/test-276-busy-timeout-propagation.cjs, the RED elapsed-time-floor proof this plan flips GREEN"
provides:
  - "The busy-timeout constructor option at every read-write room.db (and sibling-db) opener that can genuinely contend, option-only per D-276-4"
  - "A run-time re-measured census of all 32 DatabaseSync constructor sites, classified A-E with quoted exclusion reasons"
  - "The D-276-4 follow-up note landed as a comment at lib/core/lazygraph-ops.cjs's openGraph, naming the deferred openRoomDb re-route"
affects: ["276-16 (writes the D-276-4 openRoomDb re-route follow-up into the ROADMAP)", "any future plan touching cross-room-store.cjs's fallback-swallow contract"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Option-only propagation (D-276-4): the busy-timeout constructor option plus an adapted room-db.cjs:242-251 reasoning comment at every contending site, never a re-route through openRoomDb"
    - "Read-intent-on-a-read-write-door sites (A6, and the A7 pure-read scripts) get the option for correctness even when no elapsed-floor proof is reachable, distinct from Group C's genuinely read-only ?mode=ro / readOnly:true doors which get nothing"
    - "Test pins flip from absence-checks to presence-checks (pinNoTimeout -> pinHasTimeout) in lockstep with each site's fix landing, keeping the RED-to-GREEN test itself honest rather than deleting its coverage"

key-files:
  created: []
  modified:
    - lib/core/lazygraph-ops.cjs
    - lib/hmi/selector-telemetry.cjs
    - lib/hmi/shape-f0-renderer.cjs
    - lib/hmi/shape-f6-plan-review-renderer.cjs
    - lib/core/venture-shape-nudge.cjs
    - lib/core/cross-room-store.cjs
    - lib/workflow/cross-room-umbilical-closer.cjs
    - lib/core/breakthrough/review-queue.cjs
    - scripts/dogfood-derive.cjs
    - scripts/dogfood-emit.cjs
    - scripts/sync-rooms-graph
    - scripts/auto-explore-fingerprint.cjs
    - scripts/preflight-tension-surface.cjs
    - tests/test-276-busy-timeout-propagation.cjs

key-decisions:
  - "tests/test-276-busy-timeout-propagation.cjs is a 14th file this plan had to touch, even though the plan's own files_modified frontmatter names only the 13 production files. The test's A6 and B1-B3 pins were written in 276-02 to assert ABSENCE of timeout:5000 (correct RED-phase state); once Task 1/2 added the option at those four sites, the absence-pins would fail. Converted pinNoTimeout to a pinHasTimeout counterpart and flipped exactly those four assertions to presence checks, leaving the six Group C and four Group D pins untouched (they correctly still assert absence). This is the exact resolution 276-02-SUMMARY.md's own Next Phase Readiness section anticipated ('update those pins to assert PRESENCE once fixed'). Documented as a deviation, not a silent scope violation."
  - "A6 (venture-shape-nudge.cjs) and the majority of Group A7's dev/ops scripts (dogfood-derive, both auto-explore-fingerprint sites, both preflight-tension-surface sites) are pure reads opened via the read-write door, not the read-only door. The option was added to all of them for correctness on the door (matching D-276-4's option-only philosophy and the plan's own A6 precedent), while being explicit in this SUMMARY and in-line comments that these specific reads will never measurably wait on the option today -- avoiding the 'cosmetic grep-padding' failure mode the plan explicitly warns against by never claiming a behavioral proof these sites cannot produce."
  - "The literal acceptance-criteria grep 'grep -rc timeout: 5000 lib/ scripts/' is dominated by false positives unrelated to DatabaseSync (child_process exec timeouts, test-suite timeouts, doc comments quoting the phrase) -- 53 raw occurrences across 39 files tree-wide, versus 18 DatabaseSync-constructor-line occurrences across 17 distinct opener sites (16 newly fixed by this plan + room-db.cjs's 1 pre-existing correct opener, whose single site spans 2 constructor branches). Recorded both numbers below rather than reporting the noisier literal count as if it meant something."
  - "Three read-only DatabaseSync sites surfaced by this plan's run-time re-census (scripts/scout-cadence-guard.cjs:164, scripts/serve-dashboard-live:357, scripts/check-graph-export-typemap.cjs:60) are NOT covered by the test's existing Group C pins. All three open via {readOnly: true}, so they are genuinely excludable and not a defect -- but the test's own exclusion census is incomplete relative to a full re-measurement. Recorded as a finding, not fixed here (Task 3's declared file scope is lib/core/lazygraph-ops.cjs only)."

requirements-completed: [TOOLHON-09]

# Metrics
duration: ~70min
completed: 2026-09-03
---

# Phase 276 Plan 09: Propagate the Busy Timeout (C4) Summary

**Every room.db read-write opener that can genuinely contend now carries `{timeout: 5000}` plus an adapted reasoning comment, proven by flipping `tests/test-276-busy-timeout-propagation.cjs` from 15/20 to 20/20 passing with A1-A5's elapsed time jumping from ~0.3ms (instant SQLITE_BUSY failure) to ~5020ms (genuine busy-wait), option-only per D-276-4 with `openGraph`'s async signature and `{db, conn}` return shape untouched.**

## Performance

- **Duration:** ~70 min
- **node --version:** v22.23.1 (floor: v22.16.0, satisfied)
- **Tasks:** 3 completed
- **Files modified:** 13 production files (all of `files_modified`) + 1 test file (deviation, documented below)

## Accomplishments

- **Group A (6 sites, A1-A6):** `lib/core/lazygraph-ops.cjs::openGraph` (the most-used room.db opener in the repo), `lib/hmi/selector-telemetry.cjs`, `lib/hmi/shape-f0-renderer.cjs`, `lib/hmi/shape-f6-plan-review-renderer.cjs` (two openers), `lib/core/venture-shape-nudge.cjs` all carry `{timeout: 5000}` plus an adapted `room-db.cjs:242-251` reasoning comment.
- **Group B (3 sites):** `lib/core/cross-room-store.cjs`, `lib/workflow/cross-room-umbilical-closer.cjs`, `lib/core/breakthrough/review-queue.cjs`'s file-backed opener all carry the option plus a comment naming exactly why `openRoomDb` is structurally wrong there (wrong path shape, would run 13 CREATE TABLEs + 5 migrations against a store with none of them). `review-queue.cjs`'s `:memory:` fallback opener gets a one-line "cannot contend" exclusion comment instead.
- **Group A7 (7 sites, dev/ops scripts):** `scripts/dogfood-derive.cjs`, `scripts/dogfood-emit.cjs` (genuine writer via the navigation chokepoint), `scripts/sync-rooms-graph` (genuine writer, opens `rooms.db` not `room.db`), `scripts/auto-explore-fingerprint.cjs` (two sites), `scripts/preflight-tension-surface.cjs` (two sites) all carry the option with a short one-line comment pointing at `room-db.cjs:242-251` for the full reasoning.
- **The D-276-4 follow-up note** landed as a comment inside `openGraph`, naming the deferred `openRoomDb` re-route, its cost (async-vs-sync, return-shape mismatch across ~38-50 call sites, 7-step migration chain per open), and that it is tracked in the ROADMAP via plan 276-16.
- **The census was re-measured at execution time**, not inherited: 32 production `DatabaseSync` constructor sites across 26 files, matching 276-RESEARCH.md's own figure exactly. Full classification table below.
- `openGraph`'s `async function openGraph(roomDir)` signature and `return Promise.resolve({ db, conn: db })` shape are byte-identical to before this plan.

## Task Commits

1. **Task 1: Group A1-A6** - `20d2212d` (fix) - 5 production files + test file's A6 pin flip
2. **Task 2: Group B + Group A7** - `596a13c7` (fix) - 8 production files + test file's B1-B3 pin flip
3. **Task 3: census + D-276-4 follow-up note** - `2057ed36` (docs) - `lib/core/lazygraph-ops.cjs` only

**Plan metadata:** committed alongside this SUMMARY, STATE.md, and ROADMAP.md updates (see below).

## Files Created/Modified

All 13 files named in `files_modified` were modified exactly as scoped. `tests/test-276-busy-timeout-propagation.cjs` was also modified (not in `files_modified`) -- see Deviations below.

## Node Floor

`node --version`: **v22.23.1**, at or above the required v22.16.0 floor. Recorded once per this plan's own instruction (Task 1's action text), verified live via the test's own RUNTIME FLOOR assertion, which passed.

## Elapsed-Time-Floor Proof (per Group A site, measured)

Flipped from FAIL (near-0ms instant SQLITE_BUSY failure) in 276-02's RED baseline to PASS (genuine ~5s busy-wait) in this plan:

| Site | 276-02 RED (measured) | 276-09 GREEN (measured) |
|------|------------------------|---------------------------|
| A1 lazygraph-ops.cjs::openGraph | threw in 0.40ms | rejected after **5018.40ms** |
| A2 selector-telemetry.cjs::recordSelectorMirror | 1.26ms | **5025.58ms** |
| A3 shape-f0-renderer.cjs::buildRejectedBecauseEdge | 0.32ms | **5032.06ms** |
| A4 shape-f6-plan-review-renderer.cjs::buildReviewedEdge | 0.29ms | **5019.45ms** |
| A5 shape-f6-plan-review-renderer.cjs::emitRoundCompleted | 0.29ms | **5022.72ms** |
| A6 venture-shape-nudge.cjs | (source pin: absent) | (source pin: **present**, no elapsed proof possible -- pure read) |

Each A1-A5 measurement is comfortably above the 250ms floor and near the 5000ms `timeout` ceiling, proving the wait is the genuine busy-timeout window, not an artifact.

## `node tests/test-276-busy-timeout-propagation.cjs`: 20 passed, 0 failed, exit **0**

Full census-classified pass, verbatim tail:
```
20 passed, 0 failed
```
Every A1-A5 assertion is now a genuine elapsed-floor PASS. A6 and B1-B3 flipped from "does not yet carry timeout:5000" (absence pin, correct pre-fix) to "carries timeout:5000" (presence pin, correct post-fix). All 6 Group C and 4 Group D exclusion pins are unchanged and still correctly assert absence.

## `node tests/test-236-open-busy-detected.cjs`: still exits **0**

Confirms the shipped Phase 236-03 lock helper and the room-db.cjs open path are unregressed by this plan's changes.

## Additional Suite Verification

- `bash tests/run-all-273.sh`: **PASS=7 FAIL=0 SKIP=0** (Part 8 source sweep clean, no-em-dash fence clean).
- `node scripts/check-substrate.cjs --diff`: no output, i.e. no net-new direct import reported.
- `bash tests/run-all-266.sh`: **PASS=11 FAIL=0 SKIP=0** (per the shared_tree_guard's own success criterion).
- Em-dash sweep (`grep -rPn '\x{2014}'`) across all 14 touched files (13 production + the test file): zero matches.
- `node -c` syntax check on every touched `.cjs` file: clean.

## Run-Time Census (re-measured, not inherited)

`grep -rn "new DatabaseSync(" lib/ scripts/` excluding `*.test.cjs` and the vendored `lib/wiki/editor-src/node_modules/@types/node/sqlite.d.ts` type stub: **32 production constructor sites across 26 files**, matching 276-RESEARCH.md's own figure exactly (no drift this time -- 276-02's TOOLHON-11 census of a *different* thing, `no_room_db` producers, found drift from 27 to 35; this C4 census of DatabaseSync constructors did not drift).

| # | file:line | db opened | rw/ro/mem | group | disposition | reason (quoted where the reason is a codebase quote) |
|---|-----------|-----------|-----------|-------|-------------|--------|
| 1 | lib/core/room-db.cjs:259 | room.db (allowExtension branch) | rw | E | pre-existing correct site | Phase 218-02 D-05, unchanged by this plan |
| 2 | lib/core/room-db.cjs:260 | room.db (default branch) | rw | E | pre-existing correct site | same opener, other branch |
| 3 | lib/core/lazygraph-ops.cjs:441 | room.db | rw | A1 | **included** | most-used opener, ~38-50 call sites; this plan's Task 1 |
| 4 | lib/hmi/selector-telemetry.cjs:241 | room.db | rw | A2 | **included** | Task 1 |
| 5 | lib/hmi/shape-f0-renderer.cjs:122 | room.db | rw | A3 | **included** | Task 1 |
| 6 | lib/hmi/shape-f6-plan-review-renderer.cjs:235 | room.db | rw | A4 | **included** | Task 1 |
| 7 | lib/hmi/shape-f6-plan-review-renderer.cjs:295 | room.db | rw | A5 | **included** | Task 1 |
| 8 | lib/core/venture-shape-nudge.cjs:110 | room.db | rw-door, read-intent | A6 | **included** | option for correctness on the door; a plain read succeeds <1ms under contention regardless (WAL readers never block writers) |
| 9 | lib/core/cross-room-store.cjs:77 | `<roomsHome>/.rooms/cross-room.db` | rw | B1 | **included** | Task 2; openRoomDb structurally wrong (wrong path shape, wrong migration set) |
| 10 | lib/workflow/cross-room-umbilical-closer.cjs:93 | `<roomsHome>/.rooms/cross-room-rejections.db` | rw | B2 | **included** | Task 2; same reasoning as B1 |
| 11 | lib/core/breakthrough/review-queue.cjs:84 | `<roomsHome>/.rooms/breakthrough-review-queue.db` | rw | B3 | **included** | Task 2; same reasoning as B1 |
| 12 | lib/core/breakthrough/review-queue.cjs:94 | `:memory:` (fallback) | mem | D | **excluded** | "an in-memory database has exactly one connection and cannot contend" (comment added at the site) |
| 13 | scripts/dogfood-derive.cjs:123 | room.db | rw-door, read-intent | A7 | **included** | Task 2; pure read (findRecentChanges), option for door correctness |
| 14 | scripts/dogfood-emit.cjs:41 | room.db | rw | A7 | **included** | Task 2; genuine writer via navigation.cjs chokepoint |
| 15 | scripts/sync-rooms-graph:247 | `<roomsHome>/.rooms/.room-graph/rooms.db` | rw | A7 | **included** | Task 2; genuine writer (initRoomSchema/seedStages/syncRooms), different db than room.db but named explicitly in the plan |
| 16 | scripts/auto-explore-fingerprint.cjs:110 | room.db | rw-door, read-intent | A7 | **included** | Task 2; pure read (SELECT COUNT), door correctness |
| 17 | scripts/auto-explore-fingerprint.cjs:144 | room.db | rw-door, read-intent | A7 | **included** | Task 2; pure read (findRecentChanges), door correctness |
| 18 | scripts/preflight-tension-surface.cjs:170 | room.db | rw-door, read-intent | A7 | **included** | Task 2; pure read (findSurfaceableTensions), door correctness |
| 19 | scripts/preflight-tension-surface.cjs:352 | room.db | rw-door, read-intent | A7 | **included** | Task 2; pure read (findSurfaceableTensions), door correctness |
| 20 | lib/core/session-presence.cjs:291 | room.db | ro (`?mode=ro`) | C | **excluded** | "WAL readers never block writers" (room-db.cjs:251, quoted) |
| 21 | lib/core/coverage-rollup.cjs:93 | room.db | ro (`?mode=ro`) | C | **excluded** | same quote |
| 22 | lib/core/graph-derivation.cjs:507 | (parent room's) room.db | ro (`?mode=ro`) | C | **excluded** | same quote |
| 23 | lib/core/navigation/spine-events.cjs:439 | room.db | ro (`?mode=ro`) | C | **excluded** | same quote |
| 24 | lib/core/chat-context-builder.cjs:134 | room.db | ro (`{readOnly:true}`) | C | **excluded** | same quote |
| 25 | lib/core/proactive-intelligence.cjs:141 | room.db | ro (`{open:true, readOnly:true}`) | C | **excluded** | same quote |
| 26 | lib/core/eureka/tri-modal-index.cjs:254 | `:memory:` | mem | D | **excluded** | in-memory, cannot contend (no comment added, out of this plan's file scope) |
| 27 | lib/core/doctor/class-s-eureka-smoke.cjs:119 | `:memory:` (allowExtension) | mem | D | **excluded** | in-memory, cannot contend |
| 28 | lib/core/doctor/class-s-eureka-smoke.cjs:122 | `:memory:` (fallback) | mem | D | **excluded** | in-memory, cannot contend |
| 29 | scripts/doctor.cjs:2850 | `:memory:` | mem | D | **excluded** | in-memory, cannot contend |
| 30 | scripts/scout-cadence-guard.cjs:164 | room.db | ro (`{readOnly:true}`) | C | **excluded (NEW finding)** | read-only; not covered by the test's existing Group C pins -- census gap, not a defect |
| 31 | scripts/serve-dashboard-live:357 | room.db | ro (`{readOnly:true}`) | C | **excluded (NEW finding)** | same as above |
| 32 | scripts/check-graph-export-typemap.cjs:60 | room.db | ro (`{readOnly:true}`) | C | **excluded (NEW finding)** | same as above |

**Included: 17 distinct opener sites** (16 newly fixed by this plan across Tasks 1-2, + room-db.cjs's 1 pre-existing correct opener spanning 2 constructor branches = rows 1-2). **Excluded: 15 sites** (9 Group C read-only + 6 Group D in-memory).

**Count reconciliation (acceptance criterion):** `grep -rc "timeout: 5000" lib/ scripts/ | grep -v ":0" | wc -l` returns **39** files / **53** occurrences tree-wide -- this literal grep is dominated by false positives unrelated to `DatabaseSync` (child_process `exec`/`spawn` timeout options in `scripts/doctor.cjs` and `lib/core/git-ops.cjs`, test-suite timeout configs across 15+ `.test.cjs` files, and one doc-comment in `spine-events.cjs` quoting the phrase in prose). The precise DatabaseSync-constructor-line count is **18 lines across 17 distinct opener sites** (`grep -rn "new DatabaseSync(" lib/ scripts/ | grep -v test.cjs | grep -v node_modules | grep -c "timeout: 5000"` = 18; room-db.cjs's single opener spans 2 lines for its two branches). Pre-plan state was 1 site (room-db.cjs). Post-plan state is 17 sites (16 new + the 1 pre-existing), which is "strictly greater than 1" and equals the census's included count -- the acceptance criterion's *intent* is satisfied; its literal grep command is not precise enough to demonstrate that on its own, which is itself recorded here as a finding about the plan's own verification text (Rule 1, matching 276-02-SUMMARY's precedent of documenting when a plan's literal instruction has a bug).

## `openGraph( ` Call-Site Re-Count (required by this plan)

`grep -rc "openGraph(" lib/ scripts/ bin/ | grep -v test.cjs` (excluding `*.test.cjs`) = **50** non-test occurrences today, up from the plan's own "roughly 38" estimate. This raw count includes the function definition itself and any non-invocation textual matches, so it is an upper bound, not a precise call-site count -- but it confirms the order of magnitude (dozens, not a handful) that makes an async-signature + return-shape migration a genuinely large, separately-scoped follow-up, not a drive-by fix. Recorded verbatim in the code comment at `lib/core/lazygraph-ops.cjs`'s `openGraph`.

## `venture-shape-nudge.cjs` Read-Only-Door Question (required by Task 1's action text)

The site opens read-write and only ever SELECTs (via `findRecentChanges`). Switching it to the read-only door (`{readOnly: true}` or `?mode=ro`) would be **strictly better** in isolation -- it costs nothing today and would make the site self-documenting as read-only. It was **not** switched in this plan (explicitly out of scope per the plan's own instruction: "Do not switch it in this task; a behavior change on a read path is a separate decision"). Recorded here as a genuine, low-risk follow-up candidate for a future plan, not registered as a formal ROADMAP item since it is a one-line style improvement, not a defect.

## `cross-room-store.cjs` Fallback-Swallow Finding (required by Task 2's action text)

`withStore`'s `catch (_e) { return fallback; }` still silently swallows a busy-timeout outcome after this plan's fix, exactly as before: a genuine `SQLITE_BUSY` (now surfacing only after the ~5s wait rather than instantly) and any other failure (permissions, corruption, schema drift) are indistinguishable to the caller -- both just return `fallback`. The timeout narrows the window in which contention can occur at all (a longer wait means fewer races lose), but it does not make a busy outcome visible when it does occur. **Registered as a named follow-up, not fixed here**: changing the fallback contract to surface a distinguishable "was busy" signal is a caller-visible behavior change (every `withStore` caller today receives a bare `fallback` value with no reason field) and is out of this plan's option-only scope. `cross-room-umbilical-closer.cjs`'s `withRejectionStore` shares the identical shape (its own header comment says it "mirrors cross-room-store's discipline"), so the same finding applies there too.

## Group A7 Enumeration (required by Task 2's acceptance criteria)

| Site | Included/Excluded | Why |
|------|--------------------|-----|
| scripts/dogfood-derive.cjs:123 | Included | opens room.db; pure read today, door correctness |
| scripts/dogfood-emit.cjs:41 | Included | opens room.db; genuine writer via navigation.cjs chokepoint |
| scripts/sync-rooms-graph:247 | Included | opens rooms.db (roomsHome-level graph, not room.db); genuine writer, named explicitly in plan |
| scripts/auto-explore-fingerprint.cjs:110 | Included | opens room.db; pure read (SELECT COUNT), door correctness |
| scripts/auto-explore-fingerprint.cjs:144 | Included | opens room.db; pure read (findRecentChanges), door correctness |
| scripts/preflight-tension-surface.cjs:170 | Included | opens room.db; pure read (findSurfaceableTensions), door correctness |
| scripts/preflight-tension-surface.cjs:352 | Included | opens room.db; pure read (findSurfaceableTensions), door correctness |

No Group A7 site turned out to be genuinely read-only (`?mode=ro` / `readOnly:true`) or `:memory:`, so none were excluded from this group.

## Availability Threat (T-276-09 in the plan's threat_model)

Sites now on a hot path where a bounded ~5s wait replaces a formerly-instant fast-fail:

- **`lib/hmi/selector-telemetry.cjs::recordSelectorMirror`** -- fires on selector-presentation telemetry, a UI-adjacent event path. A contended write now blocks the caller for up to 5s instead of failing in 0ms.
- **`lib/core/venture-shape-nudge.cjs::shouldSurfaceNudge`** -- gates whether a proactive nudge surfaces; today a pure read that never waits, but if a future write lands on this same door it would inherit the 5s ceiling.
- **`scripts/auto-explore-fingerprint.cjs::getArtifactCount` / `dailyCapHit`** -- both read-only in practice today, called from an auto-explore gating hook; same "inherits the ceiling if a write is ever added" note.
- **`scripts/preflight-tension-surface.cjs`** -- both sites feed a preflight surface-selection decision; currently read-only in practice.

**Threat model disposition:** the plan's own T-276-04 register entry explicitly accepts this shape: "The option is added ONLY at read-write openers that can genuinely contend... The change is strictly more forgiving than the current behavior: a bounded 5s wait replaces a 0ms failure, never a new failure mode. `tests/test-276-busy-timeout-propagation.cjs` measures the elapsed time, so a wait that became unbounded would show up as a number rather than a pass." This plan's own measurements (A1-A5 topping out at ~5032ms, never exceeding the 5000ms ceiling by more than measurement noise) confirm the bound holds. No new hot-path fast-fail was converted to an unbounded wait; every included site was previously an instant SQLITE_BUSY failure, now a bounded wait with the SAME eventual failure mode if the lock is held past 5s.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in plan's own scope declaration] `tests/test-276-busy-timeout-propagation.cjs` had to be modified even though it is absent from `files_modified`**
- **Found during:** Task 1, immediately after adding the option to `venture-shape-nudge.cjs` (A6)
- **Issue:** The plan's `files_modified` frontmatter lists only 13 production files, but its own verification block requires `node tests/test-276-busy-timeout-propagation.cjs` to pass every Group A assertion after Task 1. The test's A6 pin (and later, Task 2's B1-B3 pins) were written in 276-02 as `pinNoTimeout` assertions that specifically check the option is ABSENT -- exactly the correct RED-phase behavior. Adding the option (as Task 1/2 explicitly instruct) makes those specific absence-assertions fail, not because of a bug, but because the RED test is now correctly observing the fix it exists to prove.
- **Fix:** Added a `pinHasTimeout` counterpart function and converted exactly the four affected assertions (A6, B1, B2, B3) from absence to presence checks, at the same commit as the corresponding production fix. Left the 10 Group C/D exclusion pins untouched, since those sites were correctly NOT modified.
- **Files modified:** `tests/test-276-busy-timeout-propagation.cjs` (across Task 1's and Task 2's commits)
- **Verification:** `node tests/test-276-busy-timeout-propagation.cjs` returns 20 passed / 0 failed after both commits; `node tests/test-236-open-busy-detected.cjs` still exits 0.
- **Committed in:** `20d2212d` (A6 flip), `596a13c7` (B1-B3 flip)

**2. [Rule 1 - Bug in plan's own verification command] The literal `grep -rc "timeout: 5000"` acceptance-criteria command is dominated by unrelated false positives**
- **Found during:** Task 3, while computing the "count of sites carrying timeout: 5000 across the tree" acceptance criterion
- **Issue:** `grep -rc "timeout: 5000" lib/ scripts/` matches any occurrence of that literal string anywhere in the tree, including `child_process.exec`/`spawn` timeout options (`scripts/doctor.cjs`, `lib/core/git-ops.cjs`), unrelated test-suite timeout configs across 15+ `.test.cjs` files, and prose in doc comments. Raw count: 53 occurrences across 39 files -- nowhere near "must equal the number of sites the census marks as included, plus 1".
- **Fix:** Computed the precise DatabaseSync-constructor-line count instead (`grep -rn "new DatabaseSync(" ... | grep -c "timeout: 5000"` = 18 lines / 17 distinct sites), which does match the census (16 newly included + 1 pre-existing correct site). Recorded both numbers explicitly in this SUMMARY's census section rather than silently reporting only the noisier literal count as satisfying the criterion.
- **Files modified:** none (documentation-only finding, recorded here)
- **Verification:** manual grep comparison, shown in the census section above
- **Committed in:** N/A (SUMMARY-only finding)

**Total deviations:** 2 (both Rule 1, both documented, neither touched a file outside the plan's substantive intent -- deviation 1 kept the RED test honest through its own GREEN flip; deviation 2 is a verification-precision finding with no code change).
**Impact on plan:** No scope creep. The test-file edits were the minimum necessary to keep `tests/test-276-busy-timeout-propagation.cjs` internally consistent with the production fixes the plan explicitly requires; the census-count finding required no code change at all.

## Known Findings for a Future Plan (not fixed here, out of file scope)

- **Three read-only DatabaseSync sites are not covered by the test's Group C pins**: `scripts/scout-cadence-guard.cjs:164`, `scripts/serve-dashboard-live:357`, `scripts/check-graph-export-typemap.cjs:60`. All three are genuinely excludable (`{readOnly: true}`), so this is a census-completeness gap in the test, not a production defect. A future plan touching this test file could add three more `pinNoTimeout` Group C entries for completeness.
- **`cross-room-store.cjs` / `cross-room-umbilical-closer.cjs`'s fallback swallow** (detailed above): the busy-timeout fix narrows the contention window but does not make a busy outcome distinguishable from any other failure at the `withStore`/`withRejectionStore` call sites. Changing the fallback contract is a caller-visible behavior change, out of this plan's option-only scope.
- **`venture-shape-nudge.cjs`'s read-only-door candidacy** (detailed above): a low-risk style improvement, not registered as a formal follow-up.
- **The D-276-4 `openRoomDb` re-route itself** remains the largest named follow-up, tracked via plan 276-16 in the ROADMAP, now also legible as an in-code comment at `lazygraph-ops.cjs`'s `openGraph`.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- C4 (TOOLHON-09) is closed by observation, not by grep count: `tests/test-276-busy-timeout-propagation.cjs` exits 0, its A1-A5 assertions measure a genuine ~5s wait where a foreign write lock is held, and every exclusion (Group C read-only, Group D in-memory) carries a quoted reason at both the test and (where this plan's file scope touched the site) the source.
- Plan 276-16 has a concrete, code-anchored target for the D-276-4 `openRoomDb` re-route: the comment now lives at `lib/core/lazygraph-ops.cjs`'s `openGraph`, naming the exact cost (async-vs-sync, `{db,conn}` return shape across ~50 call sites, 7-step migration chain per open).
- No blockers. All three tasks landed, all verification commands pass, the shared-tree audit protocol (explicit-path staging, `git diff --cached --name-only` before every commit) held across all three commits with zero unexpected files staged.

---
*Phase: 276-mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs*
*Completed: 2026-09-03*

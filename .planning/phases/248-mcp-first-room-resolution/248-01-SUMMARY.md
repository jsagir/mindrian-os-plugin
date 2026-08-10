---
phase: 248-mcp-first-room-resolution
plan: 01
subsystem: mcp
tags: [mcp, session-binding, room-resolution, resolver-collapse, census-gate]

# Dependency graph
requires:
  - phase: 234-05
    provides: "isWritePathEnabled write-path PERMISSION gate (untouched, orthogonal to this plan's resolution collapse)"
  - phase: 198-02
    provides: "resolveWriteRoom/resolveSessionRoom core ladder, the MCP_FIRST_DEPRECATED_ACTIVE_WRITE stderr token, the original (now-repealed) SPEC-7 flag-off parity contract"
provides:
  - "lib/mcp/session-room.cjs, the ONE shared MCP room resolver (resolveMcpSessionRoom, resolveSessionRoomDir)"
  - "Unconditional session-binding reads: an explicit room_bind is authoritative for its session regardless of MINDRIAN_MCP_FIRST (CTX-02 mechanism half)"
  - "A red-able census gate (tests/test-248-resolver-census.cjs) that turns red if a tenth independent resolver copy is ever reintroduced under lib/mcp/"
affects: [248-02, "any future lib/mcp/tools/*.cjs module needing session-scoped room resolution"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single shared resolver module as a lib/mcp/ PEER (never a tools/ sibling) consumed by tools/*.cjs, tool-router.cjs, and stop-gate-handler.cjs"
    - "Options-object-only resolver signature ({sessionId, ctx, forWrite, noFloor}) to make positional-arg regressions unrepeatable"
    - "Source-grep census tripwire (line-comments-stripped-before-block-comments) as the reintroduction guard for a retired multi-copy pattern"

key-files:
  created:
    - lib/mcp/session-room.cjs
    - tests/test-248-resolver-census.cjs
    - tests/test-248-room-bind-session-authoritative.cjs
    - tests/run-all-248.sh
    - .planning/phases/248-mcp-first-room-resolution/deferred-items.md
  modified:
    - lib/mcp/tools/room.cjs
    - lib/mcp/tools/gate.cjs
    - lib/mcp/tools/sensors.cjs
    - lib/mcp/tools/status.cjs
    - lib/mcp/tools/graph.cjs
    - lib/mcp/tools/views.cjs
    - lib/mcp/tools/chain.cjs
    - lib/mcp/stop-gate-handler.cjs
    - lib/mcp/tool-router.cjs
    - tests/test-198-flag-off-parity.test.cjs
    - tests/test-198-concurrency-mcp.test.cjs
    - tests/test-237-autonomy-parity.cjs
    - tests/test-237-approve-executes.cjs
    - tests/test-241-guardian-tripolar-parity.cjs

key-decisions:
  - "The census counts NINE copies, not ROADMAP's eight: lib/mcp/tools/stop-gate.cjs has none (delegates), the ninth is lib/mcp/stop-gate-handler.cjs's null-floor variant, missed by the RCA's fallbackRoomDir grep"
  - "Session-binding reads are now UNCONDITIONAL (no isMcpFirst gate) - this IS the CTX-02 fix, not a side effect"
  - "The registry write-through alternative (room_bind clobbering global reg.active) is explicitly rejected per the plan's objective, in favor of the structural collapse"
  - "tests/test-198-flag-off-parity.test.cjs and tests/test-198-concurrency-mcp.test.cjs are both re-pointed for the same doctrine change: flag-off + unbound stays byte-identical legacy; flag-off + bound now resolves the binding"

patterns-established:
  - "A retired multi-copy anti-pattern gets a source-grep census tripwire (rar.11 precedent) rather than relying on code review alone to prevent reintroduction"
  - "Mutation-testing harnesses that pin a module's relative requires to absolute paths must be re-audited whenever that module's require graph changes - three such harnesses (237-05, 237-08, 241-05 lineage) needed their pin lists updated by this plan"

requirements-completed: [CTX-01, CTX-02]

# Metrics
duration: 78min
completed: 2026-08-10
---

# Phase 248 Plan 01: MCP-First Room Resolution (Nine-Copy Collapse) Summary

**Collapsed nine independent gate-then-fallthrough MCP room resolvers into one shared `lib/mcp/session-room.cjs` module whose read path calls the core session-aware ladder unconditionally, making an explicit `room_bind` authoritative for its session regardless of `MINDRIAN_MCP_FIRST` flag state.**

## Performance

- **Duration:** 78 min (13:20 - 14:38 local commit timestamps)
- **Tasks:** 3 (all completed)
- **Files created:** 5 (session-room.cjs + 3 test artifacts + deferred-items.md)
- **Files modified:** 14 (9 nine-copy call sites + 5 collateral test re-points)

## Accomplishments

- Nine independent `resolveSessionRoomDir`/`resolveWriteTargetDir` copies (7x `lib/mcp/tools/*.cjs`, `tool-router.cjs`, `stop-gate-handler.cjs`) collapsed into one shared module, `lib/mcp/session-room.cjs`.
- CTX-02 mechanism landed: with `MINDRIAN_MCP_FIRST` unset (the default on every install), a session's `room_bind` write is now honored by every subsequent read/write in that session. Unbound sessions remain byte-identical legacy.
- A red-able census gate (`tests/test-248-resolver-census.cjs`) now fails if a tenth independent resolver copy, or any executable `isMcpFirst(`/`resolveWriteRoom(`/`resolveActiveRoom(` call outside the designated files, is ever reintroduced under `lib/mcp/`.
- The Phase 198 SPEC-7 "flag-off ignores sessionId entirely" doctrine is explicitly repealed for bound sessions, on the record inside the test file itself (and inside a second test that encoded the same retired contract, discovered during verification).

## Task Commits

1. **Task 1: Wave 0 red gates - census tripwire, authority test, phase runner** - `ba153316` (test)
2. **Task 2: Create lib/mcp/session-room.cjs - the ONE shared resolver** - `05295aed` (feat)
3. **Task 3: Route all nine copies through session-room.cjs and re-point the parity doctrine** - `3d160276` (feat)

_No separate plan-metadata commit yet - STATE.md/ROADMAP.md/REQUIREMENTS.md updates and the final `docs(248-01)` commit follow this SUMMARY._

## Files Created/Modified

- `lib/mcp/session-room.cjs` - the ONE shared MCP room resolver (`resolveMcpSessionRoom`, `resolveSessionRoomDir`), flag-free, options-object-only signature, owns the `MCP_FIRST_DEPRECATED_ACTIVE_WRITE` stderr token
- `tests/test-248-resolver-census.cjs` - source-grep tripwire (census.1-3 + seam-liveness leg via `lib/core/seam-liveness.cjs`)
- `tests/test-248-room-bind-session-authoritative.cjs` - bound-session authority proof through all three seam families (tool-router, tools/, stop-gate-handler)
- `tests/run-all-248.sh` - Phase 248 aggregator, Wave 0 run_if contract
- `lib/mcp/tools/{room,gate,sensors,status,graph,views,chain}.cjs` - local `resolveSessionRoomDir` deleted, replaced with `require('../session-room.cjs')`; all call sites and `_internal` test exports unchanged
- `lib/mcp/stop-gate-handler.cjs` - `const` arrow delegate (not `function`, to keep census.1 exact-one-definition-site), `noFloor:true` preserves the null-floor compat contract, dropped the dead surface-defaults-'cli' line
- `lib/mcp/tool-router.cjs` - `resolveWriteTargetDir` is now a thin `forWrite:true` delegate; `room_state`'s 5 read branches split onto the read-side resolver (research pitfall 9, no `.room-root` leak into reads)
- `tests/test-198-flag-off-parity.test.cjs` - re-pointed doctrine (see Decisions Made)
- `tests/test-198-concurrency-mcp.test.cjs`, `tests/test-237-autonomy-parity.cjs`, `tests/test-237-approve-executes.cjs`, `tests/test-241-guardian-tripolar-parity.cjs` - collateral re-points (see Deviations)
- `.planning/phases/248-mcp-first-room-resolution/deferred-items.md` - one pre-existing, out-of-scope failure logged

## Decisions Made

- **Nine-copy census, not eight.** Re-verified at execution time: `lib/mcp/tools/stop-gate.cjs` has no independent copy (it delegates to `stop-gate-handler.cjs`), and `stop-gate-handler.cjs:78` itself is the ninth, missed by the original RCA's `fallbackRoomDir` grep (it floors to `null` instead).
- **Unconditional resolution is the fix, not a refactor detail.** `session-room.cjs` never imports `isMcpFirst`; the flag is simply not consulted on the resolution path anymore. `isWritePathEnabled` (write PERMISSION) is a separate, untouched concern.
- **Read/write split enforced per research pitfall 9.** `tool-router.cjs`'s `room_state` read branches now call `sessionRoom.resolveSessionRoomDir` (no `.room-root` leg), not `resolveWriteTargetDir` (which does have that leg, correctly, for writes).
- **`stop-gate-handler.cjs`'s delegate is a `const` arrow, not a `function` declaration** - the plan's own text specified this exact shape, and it matters: the census gate's rule 1 (`function resolveSessionRoomDir` appears in exactly one file) would otherwise count it as a second definition site.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `test-248-resolver-census.cjs`'s own `stripComments` helper had a comment-order bug**
- **Found during:** Task 3 verification (the census only surfaced it once `lib/mcp/tools/sensors.cjs` and `lib/mcp/tools/chain.cjs` were rerouted)
- **Issue:** The helper stripped block comments (`/* ... */`) before line comments. Both files' header comments mention a glob path (`lib/mcp/tools/*.cjs`), which contains a literal `/*` inside a `//` line comment. The block-comment pass treated that as a real comment OPEN and consumed everything up to the next unrelated `*/` (a JSDoc closer many lines later), silently deleting the real `require('../session-room.cjs')` line in between and causing false census/seam-liveness failures.
- **Fix:** Reversed the order - strip `//` line comments first, then block comments on the result.
- **Files modified:** `tests/test-248-resolver-census.cjs`
- **Verification:** `node tests/test-248-resolver-census.cjs` - all four checks green after the fix.
- **Committed in:** `3d160276` (part of Task 3 commit)

**2. [Rule 1 - Bug] `tests/test-198-concurrency-mcp.test.cjs` encoded the same retired "flag-off ignores session" contract as the named parity test**
- **Found during:** Task 3 collateral verification sweep (not one of the plan's explicitly named breaking tests)
- **Issue:** Its flag-OFF block asserted `sess-A`'s write was misrouted to `reg.active`'s room-b, reproducing the 2026-07-08 stale-room defect - the exact contract Phase 248-01 deliberately repeals.
- **Fix:** Re-pointed the flag-OFF block to assert the STRONGER new guarantee: `sess-A`'s write lands in its own bound room-a even with the flag unset, since the defect is now impossible in either flag state. Coverage preserved, contract amended, same spirit as the plan's own named re-point of `test-198-flag-off-parity.test.cjs`.
- **Files modified:** `tests/test-198-concurrency-mcp.test.cjs`
- **Verification:** `node tests/test-198-concurrency-mcp.test.cjs` - PASS.
- **Committed in:** `3d160276` (part of Task 3 commit)

**3. [Rule 3 - Blocking issue caused by this task] Three mutation-testing harnesses pinned relative requires this task removed**
- **Found during:** Task 3 collateral verification sweep
- **Issue:** `tests/test-237-autonomy-parity.cjs`, `tests/test-237-approve-executes.cjs`, and `tests/test-241-guardian-tripolar-parity.cjs` each build a mutated tmp copy of `chain.cjs`/`stop-gate-handler.cjs` by pinning known relative `require()` calls to absolute paths (so the tmp copy, living outside `lib/mcp/`, can still resolve them). All three pinned `require('../mcp-first-flag.cjs')` (and, for chain.cjs, `require('../../core/resolve-active-room.cjs')`) - both removed from those files by Task 3's collapse. Without the fix, all three harnesses either threw (`assert.ok` on a missing needle) or failed to load the mutated module (`Cannot find module`).
- **Fix:** Removed the stale `mcp-first-flag.cjs`/`resolve-active-room.cjs` pin entries; added a `session-room.cjs` pin in their place; re-pointed `test-237-autonomy-parity.cjs`'s mutation-injection anchor from the (now-removed) `isMcpFirst` require line to the `resolveSessionRoomDir` require line (the anchor's only real job was providing an injection point, never a functional dependency on `isMcpFirst`).
- **Files modified:** `tests/test-237-autonomy-parity.cjs`, `tests/test-237-approve-executes.cjs`, `tests/test-241-guardian-tripolar-parity.cjs`
- **Verification:** All three harnesses' full leg suites green (`test-237-autonomy-parity`: 5/5 legs; `test-237-approve-executes`: 7/7 legs; `test-241-guardian-tripolar-parity`: 3/3 legs).
- **Committed in:** `3d160276` (part of Task 3 commit)

**4. [Rule 1 - Bug, pre-existing, exposed not caused] `gate-ledger.cjs` pin missing from two of the three harnesses above**
- **Found during:** Fixing deviation #3 above - once the `mcp-first-flag.cjs` anchor was corrected, both `test-237-autonomy-parity.cjs` and `test-237-approve-executes.cjs` progressed further and hit `Cannot find module '../gate-ledger.cjs'`.
- **Issue:** Phase 238-04 (commit `8d683a8b`) added `const gateLedger = require('../gate-ledger.cjs');` to `chain.cjs` after these two harnesses' pin lists were last updated (`745986ce`, Phase 237-08) - a genuinely pre-existing gap, confirmed via `git log -S` against `chain.cjs` and the test files' own history. Not caused by this task, but surfaced only once this task's own regression (deviation #3) was fixed, and needed to be fixed too for the mutation proofs to run at all.
- **Fix:** Added the `gate-ledger.cjs` pin to both harnesses' `relativeRequires` lists, mirroring the existing pattern exactly.
- **Files modified:** `tests/test-237-autonomy-parity.cjs`, `tests/test-237-approve-executes.cjs`
- **Verification:** Same full-suite green results as deviation #3.
- **Committed in:** `3d160276` (part of Task 3 commit)

---

**Total deviations:** 4 auto-fixed (2x Rule 1 bug, 1x Rule 1 bug pre-existing/exposed, 1x Rule 3 blocking issue). **Impact on plan:** all four were necessary for the census gate and the mutation-testing harnesses to actually prove what they claim to prove; none represent scope creep beyond keeping the test suite honest after this task's own require-graph changes.

## Issues Encountered

**`scripts/on-stop` line-budget overage (pre-existing, out of scope).** `tests/test-198-adapter-budget.test.cjs` fails on `checkAdapterBudget()`: `scripts/on-stop` is 618 lines against a 570-line budget. Confirmed via `git log --oneline -- scripts/on-stop` that this file was never touched by any 248-01 task (last modified by 241-05/240.1-03/241-02 commits, all pre-dating this phase). Logged to `.planning/phases/248-mcp-first-room-resolution/deferred-items.md` per the executor scope boundary rather than fixed; does not block any of CTX-01/CTX-02's must_haves or verification commands.

**Langtalks grounding attempt (per plan notes).** The executor's toolset does not expose `mcp__langtalks-graph-expert__*` tools (no such MCP functions are available in this session). Per the plan's honest-record convention (research: tool unavailable to both the researcher and the planner; this executor session makes it a third consecutive "not available", not a judgment skip), the `relationship_path` probes for "session state" -> "context binding" and "session state" -> "multi-agent orchestration" were not fired. This changes nothing in the plan - grounding rests on first-party RCA + direct source evidence per the plan's own notes, which the research document rates HIGH confidence.

## User Setup Required

None - no external service configuration required. Pure local refactor, zero new dependencies, zero network surface.

## Next Phase Readiness

Plan 248-02 (the honest `room_bind` return, CTX-03 live before/after verification) is unblocked: `lib/mcp/session-room.cjs`'s `resolveMcpSessionRoom` returns the structured `{dir, slug, source}` shape 248-02's round-trip design depends on, and `tests/run-all-248.sh`'s 248-02 legs (`test-248-room-bind-honest-return.cjs`, `test-248-surface-probes.cjs`) are already wired with own-file `run_if` gates, ready to flip from SKIP to a real run as soon as 248-02 authors them.

No blockers. No architectural concerns raised during this plan - the collapse followed the researched design without needing a Rule 4 (architectural change) escalation.

---
*Phase: 248-mcp-first-room-resolution*
*Completed: 2026-08-10*

## Self-Check: PASSED

All created files verified present on disk (`lib/mcp/session-room.cjs`,
`tests/test-248-resolver-census.cjs`, `tests/test-248-room-bind-session-authoritative.cjs`,
`tests/run-all-248.sh`, `.planning/phases/248-mcp-first-room-resolution/deferred-items.md`,
this SUMMARY). All three task commit hashes (`ba153316`, `05295aed`, `3d160276`) confirmed
present in `git log --oneline --all`.

---
phase: 266-mcp-layer-correctness-fixes-fast-independently-shippable-fix
plan: 03
subsystem: mcp-transport
tags: [mcp, spawnSync, npm-install, self-heal, connect-timeout, node-child-process]

# Dependency graph
requires:
  - phase: 265-capability-radar-absorption-routing-re-scoped-supersedes-orp
    provides: "265-RESEARCH-mcp-layer-audit.md, the audit that named the 120s-vs-30s mismatch and the 200s peer-wait race"
provides:
  - "CONNECT_PATH_BUDGET_MS (15000ms) and DEFAULT_INSTALL_TIMEOUT_MS (120000ms, named) exported from lib/core/mcp-dep-heal.cjs"
  - "A connectPath opt-in threaded through ensureDepsPresent, requireWithHeal, and runGuardedInstall"
  - "waitForUnlock(dir, opts) accepting a per-call timeoutMs override in lib/core/npm-install-lock.cjs"
  - "Both MCP entry points (bin/mindrian-mcp-server.cjs, bin/mindrian-brain-mcp-client.cjs) opted into the tighter connect-path budget"
  - "tests/test-266-dep-heal-connect-budget.cjs: hermetic, subprocess-guarded wall-clock proof of the whole contract"
  - "Two new invariant tests in lib/core/npm-install-lock.test.cjs binding CONNECT_PATH_BUDGET_MS into the bug_001 chain"
affects: [266-01, 266-02, 266-04, mcp-first-transport, first-session-after-update]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Subprocess-guarded wall-clock tests: a test that exercises a synchronous, potentially long-blocking code path spawns a bounded child process via spawnSync({timeout}) instead of calling the function in-process, so a pre-fix hang cannot stall the whole suite past a known ceiling."
    - "Both arms of a lock-guarded race (install-owner arm, peer-wait arm) must be bounded by the SAME caller-supplied budget, not just the arm that happens to accept a timeout option today."

key-files:
  created:
    - tests/test-266-dep-heal-connect-budget.cjs
  modified:
    - lib/core/mcp-dep-heal.cjs
    - lib/core/npm-install-lock.cjs
    - lib/core/npm-install-lock.test.cjs
    - bin/mindrian-mcp-server.cjs
    - bin/mindrian-brain-mcp-client.cjs

key-decisions:
  - "CONNECT_PATH_BUDGET_MS = 15000, chosen to sit well under Claude Code's ~30000ms MCP connect timeout (CHANGELOG 2.1.242) while leaving ~15000ms for module load, tool/resource/prompt registration, and answering initialize."
  - "The audit's preferred fix (answer initialize first, heal lazily) was evaluated and rejected with file:line evidence: both entry points require the MCP SDK at module scope immediately after ensureDepsPresent, and createServer() also runs at module scope, so on a genuinely missing SDK there is no server object able to answer initialize at all. Recorded in the mcp-dep-heal.cjs module header as a rejected alternative, with the real fix (decoupling transport connect from dependency resolution) named as a later-phase follow-up."
  - "scripts/sessionstart-npm-reconcile.cjs deliberately untouched: it has no host connect clock, so tightening its budget would reintroduce the original two-server race this whole subsystem exists to close. Verified byte-identical via git diff."

requirements-completed: [MCPFIX-03]

# Metrics
duration: 55min
completed: 2026-08-27
---

# Phase 266 Plan 03: MCP Dependency Self-Heal Connect-Path Budget Summary

**Bounded the MCP dependency self-heal to 15 seconds on the connect path (down from an effective ~200 seconds on the peer-wait arm), so a first-post-update session degrades honestly instead of being reported as a failed MCP server against Claude Code's ~30-second connect timeout.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-08-27T06:XX:XXZ
- **Completed:** 2026-08-27
- **Tasks:** 3/3
- **Files modified:** 5 (1 new, 4 modified)

## Accomplishments
- `lib/core/mcp-dep-heal.cjs` now exports `DEFAULT_INSTALL_TIMEOUT_MS` (120000, unchanged value, now named) and `CONNECT_PATH_BUDGET_MS` (15000, new), with the full budget arithmetic and the rejected async-heal alternative (with file:line evidence) recorded in the module header.
- `runGuardedInstall` bounds BOTH arms of the install-lock race (its own `spawnSync` timeout AND the peer-wait's `waitForUnlock` call) by the same caller-supplied budget -- previously only the install-owner arm was bounded, and the peer-wait loser could sit for the full 200-second `WAIT_TIMEOUT_MS` regardless of who was calling.
- `lib/core/npm-install-lock.cjs`'s `waitForUnlock(dir, opts)` accepts a per-call `opts.timeoutMs` override, defaulting to the unchanged `WAIT_TIMEOUT_MS` when omitted -- the SessionStart hook path is byte-identical in behavior.
- Both `bin/mindrian-mcp-server.cjs` and `bin/mindrian-brain-mcp-client.cjs` opt every `ensureDepsPresent`/`requireWithHeal` call (including the lazy `zod` require) into `connectPath: true`.
- `tests/test-266-dep-heal-connect-budget.cjs`: a new hermetic test file proving the exported budgets, their ordering against the lock's `STALE_THRESHOLD_MS`, two wall-clock bounds (peer-wait override, end-to-end connect path), an entry-point opt-in census, and the untouched hook path. Both wall-clock checks run in a spawnSync-bounded child subprocess so a pre-fix hang (up to ~200s) cannot stall the suite -- confirmed RED at 26s wall clock (all 8 budget-dependent checks failing) and GREEN at 15.5s (all 9 passing, matching the new 15000ms budget).
- `lib/core/npm-install-lock.test.cjs`'s bug_001 invariant test now imports `DEFAULT_INSTALL_TIMEOUT_MS` from `mcp-dep-heal.cjs` instead of re-typing `120 * 1000`, and gains two new tests binding `CONNECT_PATH_BUDGET_MS` into the same invariant chain (below both `DEFAULT_INSTALL_TIMEOUT_MS`/`STALE_THRESHOLD_MS`, and below the ~30000ms host connect timeout named as its source).

## Task Commits

Each task was committed atomically:

1. **Task 1: Pin the connect budget and the wall-clock bound before changing behavior** - `9d39c012` (test)
2. **Task 2: Thread a connect-path budget through the lock and the heal, and opt both entry points in** - `913741e5` (feat)
3. **Task 3: Stop the lock invariant test from re-typing the number it is guarding** - `5fb94daf` (test)

**Plan metadata:** committed alongside this SUMMARY (worktree mode: STATE.md/ROADMAP.md updates deferred to the orchestrator after merge).

_Note: Task 1 is a RED-phase test commit per the plan's TDD-style sequencing (pin the contract, then implement); Task 2 is the GREEN implementation; Task 3 extends the invariant test suite with the new constant now available._

## Files Created/Modified
- `tests/test-266-dep-heal-connect-budget.cjs` - New hermetic, subprocess-guarded wall-clock proof of the whole connect-path-budget contract (9 checks).
- `lib/core/mcp-dep-heal.cjs` - Adds `DEFAULT_INSTALL_TIMEOUT_MS`/`CONNECT_PATH_BUDGET_MS` exports, threads `opts.timeoutMs`/`opts.connectPath` through `runGuardedInstall`, `requireWithHeal`, `ensureDepsPresent`; records the rejected async-heal alternative and the budget arithmetic in the module header; emits one stderr breadcrumb when a connect-path heal cannot finish in time.
- `lib/core/npm-install-lock.cjs` - `waitForUnlock(dir, opts)` accepts a per-call `opts.timeoutMs` override; `WAIT_TIMEOUT_MS`/`STALE_THRESHOLD_MS`/`POLL_INTERVAL_MS` unchanged.
- `bin/mindrian-mcp-server.cjs` - Every `ensureDepsPresent`/`requireWithHeal` call (including the lazy `zod` require) passes `connectPath: true`.
- `bin/mindrian-brain-mcp-client.cjs` - Same opt-in as above for its `ensureDepsPresent` and three `requireWithHeal` calls.
- `lib/core/npm-install-lock.test.cjs` - bug_001 test imports `DEFAULT_INSTALL_TIMEOUT_MS` instead of re-typing it; two new invariant tests bind `CONNECT_PATH_BUDGET_MS` into the chain.

## Decisions Made
- 15000ms budget for `CONNECT_PATH_BUDGET_MS`: matches the plan's arithmetic exactly (host ~30000ms connect timeout, ~15000ms left for module load + registration + initialize), verified against `STALE_THRESHOLD_MS` (180000ms) with wide headroom.
- Kept `scripts/sessionstart-npm-reconcile.cjs` completely untouched (verified byte-identical via `git diff` across all three task commits) -- it has no host connect clock and must keep its full 120-second budget.
- Recorded the rejected "heal lazily after initialize" option directly in the `mcp-dep-heal.cjs` module header with file:line evidence, so a future reader does not re-derive and re-reject the same option.

## Deviations from Plan

None - plan executed exactly as written. The subprocess-guarding technique used for the two wall-clock tests (spawnSync with an outer `timeout`) is an implementation detail of Task 1's test authorship, not a deviation from the plan's stated intent (the plan explicitly required both a RED-phase pin and a sub-60-second total run time, which together imply the pre-fix path must fail fast rather than block for the real ~200-second `WAIT_TIMEOUT_MS`).

## Issues Encountered
- An early draft of the test file's header comment contained the literal substring `*/` inside a backtick-quoted grep pattern (`'^\s*[*/]'`), which prematurely terminated the enclosing `/* ... */` block comment and caused a `SyntaxError: Unexpected token ']'`. Fixed by rewording the comment to avoid the literal close-comment sequence; caught immediately by `node --check` / running the test file before commit.

## User Setup Required
None - no external service configuration required. This is a pure in-repo timing/behavior fix with zero new dependencies (T-266-SC in the plan's threat model: zero packages added).

## Next Phase Readiness
- MCPFIX-03 is complete and independently verifiable: `node tests/test-266-dep-heal-connect-budget.cjs`, `node lib/core/mcp-dep-heal.test.cjs`, and `node lib/core/npm-install-lock.test.cjs` all exit 0.
- Both MCP servers still answer a real stdio `initialize` handshake post-change (`node tests/test-234-tool-description-floor.cjs` and `node lib/mcp/no-instructions.test.cjs` both exit 0, 35 and 5 passing respectively).
- **Deferred to merge/orchestrator integration:** the plan's overall `<verification>` step 5 (`TEST_266_ALLOW_MISSING=1 bash tests/run-all-266.sh`) could not be run in this worktree -- `tests/run-all-266.sh` is created by the parallel, independently-scoped plan 266-01 (wave 1, `depends_on: []`, same as this plan) and was not present in this worktree at execution time. `TEST_266_ALLOW_MISSING` exists precisely as the documented wave-1 escape for this situation (per 266-01-PLAN.md); the orchestrator should re-run that aggregator once all wave-1 worktrees are merged.
- `package-lock.json` shows a pre-existing, unrelated version-field drift (`1.16.0-beta.12` vs `package.json`'s `2.0.0-beta.12`) that predates this plan's execution (confirmed via mtime and via the fact that no task in this plan touches package manifests or runs npm install). Left untouched and unstaged -- out of scope per the plan's file list (`files_modified` does not include `package.json`/`package-lock.json`), and per the explicit exclusion of package-manager operations from auto-fix scope.

## Known Stubs
None.

## Threat Flags
None. This plan's `<threat_model>` fully covers the changes made (T-266-10 through T-266-14, T-266-SC); no new trust boundary, network surface, or schema change was introduced. Zero new packages added; zero Brain calls; the sole child process (`npm install` via `spawnSync`) already existed and is unchanged except for its `timeout` argument becoming a named, threaded value.

---
*Phase: 266-mcp-layer-correctness-fixes-fast-independently-shippable-fix*
*Completed: 2026-08-27*

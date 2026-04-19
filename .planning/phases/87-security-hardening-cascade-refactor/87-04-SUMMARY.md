---
phase: 87-security-hardening-cascade-refactor
plan: 04
subsystem: lib/core
tags: [cascade, refactor, async, mcp, cli, security-hardening, cascade-06]
requirements_completed: [CASCADE-06]
dependency_graph:
  requires:
    - 87-03 (cascade deduplication -- call-site shape had to stabilize first)
    - 87-00 (cascade-e2e fixture -- acceptance gate for any cascade refactor)
  provides:
    - lib/core/room-ops-sync.cjs (execSync entry point for CLI + hooks)
    - lib/core/room-ops-async.cjs (execFile promisified entry point for MCP)
    - lib/core/room-ops-shared.cjs (pure-logic helpers, no child_process I/O)
    - lib/core/room-ops.cjs (deprecation shim with MOS_DEP_ROOM_OPS_LEGACY warning)
    - lib/memory/sync-async-entry-points.test.cjs (5-invariant acceptance test)
  affects:
    - lib/mcp/tool-router.cjs (MCP handlers await async variants)
    - bin/mindrian-tools.cjs (CLI uses explicit sync import)
    - scripts/render-viz (bash-wrapped node heredoc uses explicit sync import)
    - lib/memory/run-feynman-tests.cjs (registers new test; suite 24 -> 25)
tech_stack:
  added: []
  patterns:
    - Two entry points, not env branching (R4 footgun eliminated at require time)
    - Key-set parity between sync/async enforced by Object.keys().sort().join() equality
    - AsyncFunction constructor.name assertion (syntactic, not just Promise-returning)
    - process.emitWarning with stable code for dedup-per-process deprecation
    - Shared pure-logic module (no I/O) imported by both entry points
key_files:
  created:
    - lib/core/room-ops-shared.cjs (64 lines, BSL 1.1)
    - lib/core/room-ops-sync.cjs (68 lines, BSL 1.1)
    - lib/core/room-ops-async.cjs (92 lines, BSL 1.1)
    - lib/memory/sync-async-entry-points.test.cjs (193 lines, BSL 1.1)
  modified:
    - lib/core/room-ops.cjs (86 -> 31 lines; now a thin shim + emitWarning)
    - lib/mcp/tool-router.cjs (2 callsites switched to async entry point + await)
    - bin/mindrian-tools.cjs (1 require line switched to sync entry point)
    - scripts/render-viz (1 require line inside bash heredoc switched to sync)
    - lib/memory/run-feynman-tests.cjs (+1 test file registered; suite 24 -> 25)
decisions:
  - Two distinct files beat env branching: the require-time choice makes the contract unambiguous and impossible to forget at runtime. Closes R4 at the language level.
  - resolveRoom lives in room-ops-shared.cjs because it's pure fs+JSON (no subprocess). Both sync and async modules re-export it under the original name so the public API name set is preserved; the async module wraps it in an async function so the AsyncFunction constructor assertion is uniform across every exported function.
  - The async module's listSections is marked async even though discoverSections is pure-sync. Rationale: API symmetry. The test asserts every async export is an AsyncFunction so a future maintainer cannot break the contract by removing `async` from a no-subprocess export.
  - Legacy lib/core/room-ops.cjs is NOT deleted. It re-exports room-ops-sync and emits a one-time process.emitWarning with stable code MOS_DEP_ROOM_OPS_LEGACY so accidental out-of-tree callers are surfaced but not broken. process.emitWarning dedups by (name, code) per Node process, so multiple requires still emit only once.
  - The env-branching assertion scans the three new files (shared + sync + async) only. The legacy shim intentionally mentions `process.env.MOS_ASYNC` in its comment block to document the R4 anti-pattern being eliminated; scanning the shim would turn documentation into a false positive.
  - The caller-audit test also excludes itself from the scan. The test file contains the string 'room-ops.cjs' in assertion messages and require() calls to the legacy shim as part of its deprecation-warning probe; it is not a caller in the business sense.
  - The runtime deprecation-warning probe spawns a fresh child node process (not this one) because process.emitWarning has already dedup'd the warning by the time the test reaches assertion 5.
metrics:
  duration_minutes: 8
  completed_date: 2026-04-19
  files_created: 4
  files_modified: 5
  tasks_completed: 2
  commits: 2
  feynman_before: 24
  feynman_after: 25
  cascade_e2e_baseline: "{INFORMS:3, CONTRADICTS:1, CONVERGES:0, INVALIDATES:1} (exact-match preserved)"
---

# Phase 87 Plan 04: Sync/Async Split -- Two Entry Points Summary

**One-liner:** room-ops.cjs split into three-file shape (shared pure logic + sync execSync entry + async execFile promisified entry) with key-set parity enforcement, expanded-scope caller audit across 7 directories, and a deprecation-warning shim at the legacy path -- closing the R4 env-branching footgun at the language level (CASCADE-06).

## What Was Built

### Three new production files

| File | Role | I/O Model |
|------|------|-----------|
| `lib/core/room-ops-shared.cjs` | Pure helpers (resolveRoomPath, resolveRoom) | Pure fs + JSON; no child_process |
| `lib/core/room-ops-sync.cjs` | CLI / hook entry point | execSync for analyzeRoom; sync discoverSections for listSections; re-exports resolveRoom |
| `lib/core/room-ops-async.cjs` | MCP handler entry point | util.promisify(execFile) for analyzeRoom; async wrappers for listSections and resolveRoom (AsyncFunction symmetry) |

### Function parity table

| Name | Sync signature | Async signature | Where body lives |
|------|----------------|-----------------|------------------|
| `listSections(roomDir)` | `{ sections, core_count, extended_count }` | `Promise<{ sections, core_count, extended_count }>` | sync: direct; async: async wrapper around discoverSections |
| `analyzeRoom(roomDir)` | `string` (execSync stdout) | `Promise<string>` (execFileAsync stdout) | sync: execSync; async: util.promisify(execFile) |
| `resolveRoom(workDir)` | `string \| null` | `Promise<string \| null>` | shared module; sync re-exports; async wraps in async fn |

Key-set assertion (from test):
```
sync:  analyzeRoom,listSections,resolveRoom
async: analyzeRoom,listSections,resolveRoom
parity: OK
```

Every async export: `constructor.name === 'AsyncFunction'` (asserted programmatically).

### Legacy shim deprecation

`lib/core/room-ops.cjs` was rewritten from 86 lines to 31 lines. It now:
1. Emits `process.emitWarning` with `{ type: 'DeprecationWarning', code: 'MOS_DEP_ROOM_OPS_LEGACY' }` on require.
2. Re-exports `require('./room-ops-sync.cjs')` so any out-of-tree caller still works.
3. Does not delete the file -- back-compat preserved.

Proven at runtime by the test spawning a fresh child node process and asserting the stderr contains `MOS_DEP_ROOM_OPS_LEGACY`.

## Caller Migration

### lib/mcp/tool-router.cjs -- MCP path (async)

| Line (before) | Line (after) | Call site |
|---------------|--------------|-----------|
| 323: `require('../core/room-ops.cjs')` | 326: `require('../core/room-ops-async.cjs')` | `room_state` / case `analyze` -- now `await roomOps.analyzeRoom(roomDir)` |
| 628: `require('../core/room-ops.cjs')` | 633: `require('../core/room-ops-async.cjs')` | `room_graph` / case `visualize-room` -- now `await roomOpsViz.listSections(roomDir)` |

Both handlers were already `async ({ command, section }) => {...}`, so adding `await` carried no structural risk.

### CLI + bash-wrapped paths (sync)

| File | Role | Before | After |
|------|------|--------|-------|
| `bin/mindrian-tools.cjs` line 14 | CLI binary entry | `require('../lib/core/room-ops.cjs')` | `require('../lib/core/room-ops-sync.cjs')` |
| `scripts/render-viz` line 48 (inside bash heredoc) | Bash shim spawning node -e | `require(path.join(..., 'room-ops.cjs'))` | `require(path.join(..., 'room-ops-sync.cjs'))` |

Both now self-document the sync contract at the require line.

## Expanded-Scope Audit Results (R-87-04-AUDIT)

Seven directories scanned for bare `require(...room-ops[^-])` (matches `room-ops.cjs` but NOT the `-sync`/`-async`/`-shared` variants). Excluded: the legacy shim file itself and this plan's test file (which references the legacy path as part of its deprecation-warning probe, not as a caller).

| Directory | Bare matches after refactor |
|-----------|----------------------------|
| `scripts/` | 0 |
| `lib/` | 0 |
| `bin/` | 0 |
| `commands/` | 0 |
| `pipelines/` | 0 |
| `agents/` | 0 |
| `skills/` | 0 |
| **Total** | **0** |

`hooks/` contains only `hooks.json` and `run-hook.cmd` -- no JS/CJS files. Confirmed out of scope per plan text.

## Test Invariants Proven

`lib/memory/sync-async-entry-points.test.cjs` asserts all five:

1. **File existence**: shared, sync, async, legacy shim all present.
2. **Caller audit (R-87-04-AUDIT)**:
   - `lib/mcp/` imports async (>=1); never sync (==0).
   - `scripts/` + `bin/` import sync explicitly (>=1).
   - Expanded-scope bare-require audit returns 0 hits.
3. **Zero env branching** in the three new production files (`process.env.MOS_ASYNC|MOS_SYNC|ROOM_OPS_MODE`).
4. **Key-set parity + async-ness**: `Object.keys(sync).sort().join(',') === Object.keys(async).sort().join(',')` AND every async export has `constructor.name === 'AsyncFunction'`.
5. **Legacy deprecation warning**: grep for `emitWarning` + `MOS_DEP_ROOM_OPS_LEGACY` in source; runtime probe via fresh child node process asserts stderr contains the stable code.

Final test output:
```
sync-async-entry-points: all tests passed (sync=[analyzeRoom,listSections,resolveRoom] async=[analyzeRoom,listSections,resolveRoom] mcp-async=2 scripts+bin-sync=2)
```

## Baseline Preservation

| Suite | Before | After |
|-------|--------|-------|
| Feynman (`node lib/memory/run-feynman-tests.cjs`) | 24/24 passed | **25/25 passed** (+1, the new sync-async-entry-points test) |
| cascade-e2e (`node test/fixtures/cascade-e2e/cascade-e2e.test.cjs`) | `{INFORMS:3, CONTRADICTS:1, CONVERGES:0, INVALIDATES:1}` | **Identical (exact-match preserved)** |

Zero regressions.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 - Bug] Fix invalid `--no-deprecation=false` flag in test probe**

- **Found during**: Task 4-2 test run
- **Issue**: The runtime deprecation-warning probe originally spawned node with `--no-deprecation=false`, which Node interprets as silencing warnings entirely -- the probe's stderr was empty so the MOS_DEP_ROOM_OPS_LEGACY assertion failed.
- **Fix**: Dropped the flag; the default behavior (warnings go to stderr) is what the probe wants. Added a comment explaining why a child node process is needed (`process.emitWarning` dedups per-process and the test has already required the shim by this point).
- **Files modified**: `lib/memory/sync-async-entry-points.test.cjs`
- **Commit**: bundled into `6fe38fe`

**2. [Rule 1 - Bug] Scope env-branching assertion to the three new files**

- **Found during**: Task 4-2 test run
- **Issue**: The first draft's env-branching grep scanned all of `lib/core/` and hit the legacy shim's own comment block, which *mentions* `process.env.MOS_ASYNC` to document the R4 anti-pattern being eliminated. This turned documentation into a false positive.
- **Fix**: Scoped the assertion to the three new production files (shared + sync + async). Added comment explaining the rationale.
- **Files modified**: `lib/memory/sync-async-entry-points.test.cjs`
- **Commit**: bundled into `6fe38fe`

**3. [Rule 1 - Bug] Exclude the test file itself from the expanded-scope audit**

- **Found during**: Task 4-2 test run
- **Issue**: The caller-audit grep scanned `lib/memory/` (part of `lib/`) and matched the test file's own references to `room-ops.cjs` in assertion strings and a `require(path.join(REPO, 'lib/core/room-ops.cjs'))` used to prove the shim still back-compat re-exports.
- **Fix**: Added `.filter(l => !l.includes('lib/memory/sync-async-entry-points.test.cjs:'))` alongside the existing shim-file exclusion. Commented the rationale.
- **Files modified**: `lib/memory/sync-async-entry-points.test.cjs`
- **Commit**: bundled into `6fe38fe`

**4. [Rule 1 - Bug] Drop literal "execSync" mentions from async file comments**

- **Found during**: Task 4-1 acceptance verification
- **Issue**: Plan's acceptance criterion says `grep -c "execSync" lib/core/room-ops-async.cjs returns 0`. Initial draft had the word `execSync` in two doc-comment lines (explaining what we're NOT doing), failing the literal grep.
- **Fix**: Reworded both comments to say "blocking subprocess I/O" instead. Technical meaning preserved; grep assertion now passes.
- **Files modified**: `lib/core/room-ops-async.cjs`
- **Commit**: bundled into `ef296e2`

### Authentication gates: none

### Architectural changes (Rule 4): none

## Tool-Router Call Sites Migrated (Detailed)

| Handler | Line (old) | Line (new) | Call site | Change |
|---------|-----------|-----------|-----------|--------|
| `room_state` | 323 | 326 | `case 'analyze': roomOps.analyzeRoom(roomDir)` | `await roomOps.analyzeRoom(roomDir)` (async scope already) |
| `room_graph` | 628 | 633 | `case 'visualize-room': roomOpsViz.listSections(roomDir)` | `await roomOpsViz.listSections(roomDir)` (async scope already) |

No other callsites of the imported `roomOps` / `roomOpsViz` bindings in either handler -- migration was two require lines + two `await` insertions.

## CHANGELOG Line (for v1.10.12)

```
### Changed
- **87-04 (CASCADE-06):** split lib/core/room-ops.cjs into two entry points (room-ops-sync.cjs for CLI/hooks, room-ops-async.cjs for MCP handlers) plus a pure-logic shared module (room-ops-shared.cjs). Eliminates the env-branching footgun (R4) by making the sync/async contract a require-time choice, not a runtime guard. Legacy lib/core/room-ops.cjs retained as a deprecation shim that emits a one-time process.emitWarning (code: MOS_DEP_ROOM_OPS_LEGACY) so accidental callers are surfaced. Caller audit across scripts/ lib/ bin/ commands/ pipelines/ agents/ skills/ (R-87-04-AUDIT) confirms zero bare imports after refactor.
```

## Known Stubs

None. Every file is load-bearing production code with tests.

## Self-Check: PASSED

- [x] `lib/core/room-ops-shared.cjs` exists (verified via `test -f`)
- [x] `lib/core/room-ops-sync.cjs` exists
- [x] `lib/core/room-ops-async.cjs` exists
- [x] `lib/core/room-ops.cjs` exists (legacy shim, now 31 lines)
- [x] `lib/memory/sync-async-entry-points.test.cjs` exists
- [x] Commit `ef296e2` exists (`git log --oneline | grep ef296e2`)
- [x] Commit `6fe38fe` exists
- [x] `grep -RInE "require\(.*room-ops[^-]" scripts/ lib/ bin/ commands/ pipelines/ agents/ skills/ 2>&1 | grep -v "lib/core/room-ops.cjs:" | grep -v "lib/memory/sync-async-entry-points.test.cjs:" | wc -l` == 0
- [x] `node lib/memory/sync-async-entry-points.test.cjs` exits 0
- [x] `node lib/memory/run-feynman-tests.cjs` exits 0 (25/25)
- [x] `node test/fixtures/cascade-e2e/cascade-e2e.test.cjs` exits 0 (exact baseline)

---
phase: 266-mcp-layer-correctness-fixes-fast-independently-shippable-fix
verified: 2026-08-27T06:15:00Z
status: passed
score: 8/8 must-haves verified
overrides_applied: 0
re_verification: true
re_verification_metadata:
  previous_verdict: gaps_found
  previous_score: 7/8
  gaps_closed:
    - "Neither MCP server can block the host's initialize handshake for longer than the host is willing to wait (MCPFIX-03) -- was PER-CALL, now PER-PROCESS"
  gaps_remaining: []
  regressions: []
deferred: []
human_verification: []
---

# Phase 266: MCP Layer Correctness Fixes Verification Report (RE-VERIFICATION after gap closure)

**Phase Goal:** Fast, independently shippable fixes to the MCP transport layer: (1) trim `runtime-instructions.cjs` under Claude Code's 2048-byte instructions cap without losing the Canon Part 8 paragraph (MCPFIX-01); (2) stop `tool-router.cjs`'s `room_state` description from splicing raw chars of `voice-dna.md` (MCPFIX-02); (3) bound `mcp-dep-heal.cjs`'s blocking `npm install` to fit inside the host's ~30s MCP connect timeout, AT THE PROCESS LEVEL not just per-call (MCPFIX-03); (4) make the MCP tool-description guardrail test cover all registered tools (MCPFIX-04).

**Verified:** 2026-08-27T06:15:00Z
**Status:** passed
**Re-verification:** Yes -- prior pass (2026-08-27T04:45:32Z) found status `gaps_found` with 1 gap (Truth #5 / MCPFIX-03: connect-path budget enforced per-call, not per-process, cumulative worst-case 60296ms against a ~30000ms host connect timeout). Plan 266-05 (gap_closure: true) was executed to close that one gap. This report independently re-verifies the closure using my own adversarial reproduction, not the shipped test's own claimed exit code.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | MCP `instructions` served at initialize never exceed the 2048-byte host cap (MCPFIX-01) | VERIFIED (regression re-check) | `node lib/mcp/no-instructions.test.cjs` exits 0, 9/9 passed. No file touched by 266-05 overlaps this area. |
| 2 | The Canon Part 8 BOUNDARIES paragraph reaches the model in full (MCPFIX-01) | VERIFIED (regression re-check) | Same test run confirms `PART8_BOUNDARIES_FROZEN` present and terminal. |
| 3 | A future edit that crosses the host cap fails a test instead of truncating silently | VERIFIED (regression re-check) | Same test file, unchanged since prior pass. |
| 4 | `room_state` tool description contains no markdown heading, no embedded newline, no voice-dna.md fingerprint, no mid-word cut (MCPFIX-02) | VERIFIED (regression re-check) | `node tests/test-266-room-state-description.cjs` exits 0, 12/12 passed. Not touched by 266-05. |
| 5 | No dependency-heal path can block the MCP `initialize` handshake beyond the host's patience, AT THE PROCESS LEVEL (MCPFIX-03) | **VERIFIED (gap closed)** | Independently reproduced with my OWN script (not the shipped test), against the real unmodified post-fix `lib/core/mcp-dep-heal.cjs`, replaying the real 4-call module-scope sequence (1x `ensureDepsPresent` + 3x `requireWithHeal`) with a planted live self-owned lock forcing the peer-wait branch and the real default `CONNECT_PATH_BUDGET_MS` (no override): call1=15190ms, call2=3ms, call3=0ms, call4=1ms, **cumulative=15194ms**, well under the ~30000ms host connect timeout and well under the prior 60296ms regression. Calls 2-4 each threw the original `MODULE_NOT_FOUND` (propagated, not swallowed). See Behavioral Spot-Checks / Independent Reproduction below for full detail, including a sensitivity check against the pre-fix code that reproduced 60407ms (matching the prior verifier's 60296ms), proving my harness is sensitive and would have caught the original regression. |
| 6 | A heal that misses the budget emits a clear breadcrumb instead of hanging | VERIFIED | Confirmed live in my reproduction's stderr: `connect-path heal did not finish inside the process-wide 15000ms connect budget...` on call1, and `connect-path budget spent (15000ms process-wide, 0ms left); skipping the install for <module>...` on calls 2-4. This now correctly describes the PROCESS-wide budget, not a per-call one. |
| 7 | The SessionStart reconcile hook keeps its full 120-second install budget | VERIFIED (regression + byte-identity re-check) | `git diff --quiet HEAD -- scripts/sessionstart-npm-reconcile.cjs` exits 0 (byte-identical). `DEFAULT_INSTALL_TIMEOUT_MS === 120000` confirmed by direct grep of `lib/core/mcp-dep-heal.cjs` line 159. Comment-stripped `scripts/sessionstart-npm-reconcile.cjs` has zero matches for `connectPath`, `timeoutMs`, `beginConnectPathBudget` (confirmed by test check 7 and independently by my own grep). |
| 8 | The MCP tool-description guardrail test covers every registered tool, not 8 of 36 (MCPFIX-04) | VERIFIED (regression re-check) | `node tests/test-234-tool-description-floor.cjs` reports 36/36 coverage, 156 passed, 0 failed. Not touched by 266-05. |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/core/mcp-dep-heal.cjs` | `beginConnectPathBudget`/`connectPathRemainingMs`/`CONNECT_PATH_MIN_ATTEMPT_MS` exist and are actually consulted by `requireWithHeal` and `ensureDepsPresent` instead of a fresh per-call literal | VERIFIED | Read in full. Both fresh-budget literals (`{ timeoutMs: CONNECT_PATH_BUDGET_MS }`) are gone; `connectPathRemainingMs()` is called at both the `requireWithHeal` MODULE_NOT_FOUND branch (line 317) and the `ensureDepsPresent` missing branch (line 431). `beginConnectPathBudget`/`connectPathRemainingMs`/`CONNECT_PATH_MIN_ATTEMPT_MS` all present in `module.exports`. Confirmed by direct read, not grep alone. |
| `bin/mindrian-mcp-server.cjs` | Arms the process-wide deadline before its first heal call; inspects the `ensureDepsPresent` outcome | VERIFIED | Line 65: `beginConnectPathBudget();` runs before line 66's `ensureDepsPresent(...)` call. The return is captured as `depHealOutcome` and inspected (`depHealOutcome.ok === false` branch logs a breadcrumb) instead of discarded. |
| `bin/mindrian-brain-mcp-client.cjs` | Same arming and outcome inspection | VERIFIED | Line 49: `beginConnectPathBudget();` before line 50's `ensureDepsPresent(...)`. Same outcome-inspection pattern. |
| `tests/test-266-connect-path-process-budget.cjs` | Cumulative process-level wall-clock proof, self-updating call-site census | VERIFIED (read in full, then independently re-derived with my own script) | 7/7 checks pass in 17.4s. Derives `SEQUENCE_LEN=4` from the live `bin/*.cjs` files rather than hardcoding it. My own independent script (not this file) reproduced the same qualitative result with different code and different fake module names, confirming the shipped test is not curve-fit to its own harness. |
| `scripts/sessionstart-npm-reconcile.cjs` | Byte-identical, unchanged budget | VERIFIED | `git diff --quiet HEAD` exits 0. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `bin/mindrian-mcp-server.cjs` | `lib/core/mcp-dep-heal.cjs` | `beginConnectPathBudget()` armed before first connect-path heal call | WIRED | Confirmed by direct read: line 65 precedes line 66. |
| `bin/mindrian-brain-mcp-client.cjs` | `lib/core/mcp-dep-heal.cjs` | Same pattern | WIRED | Confirmed by direct read: line 49 precedes line 50. |
| `lib/core/mcp-dep-heal.cjs requireWithHeal` / `ensureDepsPresent` | the shared process deadline | `connectPathRemainingMs()` consulted instead of a fresh literal | WIRED | Confirmed: `grep -c 'timeoutMs: CONNECT_PATH_BUDGET_MS'` returns 0; `connectPathRemainingMs()` appears at both call sites plus inside its own definition (auto-arm) -- read and confirmed live in my reproduction's actual behavior (calls 2-4 measured 0-3ms, not a fresh 15000ms each). |
| `bin/mindrian-mcp-server.cjs` createServer() nested `zod` requireWithHeal (line 169) | the shared process deadline | Consulted via `connectPathRemainingMs()` with no extra plumbing (module-scoped deadline reaches it) | WIRED (by design, not directly exercised in my reproduction since `createServer()` was not invoked, but the shared module-level `connectPathDeadlineAt` variable makes this a language-level guarantee, not a per-call one) | Confirmed by reading the code: the nested call uses the identical `opts.connectPath` -> `connectPathRemainingMs()` code path inside `requireWithHeal`, which is a single shared function reading a single shared module-scope variable. No call-site-specific plumbing exists to bypass it. |

### Data-Flow Trace (Level 4)

Not applicable in the UI-rendering sense (this phase's MCPFIX-03 fix is a server-process timing guarantee, not a data-rendering component). The equivalent trace here is the wall-clock measurement itself, which is the Behavioral Spot-Check / Independent Reproduction below.

### Behavioral Spot-Checks / Independent Reproduction

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Served instructions fit under host cap, Part 8 intact | `node lib/mcp/no-instructions.test.cjs` | 9 passed, 0 failed | PASS |
| room_state description clean | `node tests/test-266-room-state-description.cjs` | 12 passed, 0 failed | PASS |
| Tool-description floor covers every tool | `node tests/test-234-tool-description-floor.cjs` | 156 passed, 0 failed, 36/36 coverage | PASS |
| Phase aggregator | `bash tests/run-all-266.sh` | `PASS=9 FAIL=0 SKIP=0`, 36.3s wall clock | PASS |
| Found-eq-0 guard still enforced | `TEST_266_PREFIX=tests/test-266-nonexistent- bash tests/run-all-266.sh` | exits 1 (`!!! no tests/test-266-nonexistent-* files discovered`) | PASS |
| Connect-budget per-call contract (regression) | `node tests/test-266-dep-heal-connect-budget.cjs` | 9 passed, 0 failed (same count as prior verification) | PASS |
| Connect-budget process contract (shipped test) | `node tests/test-266-connect-path-process-budget.cjs` | 7 passed, 0 failed, 17.4s wall clock | PASS |
| Dep-heal unit contract (regression) | `node lib/core/mcp-dep-heal.test.cjs` | 9 passed, 0 failed (same count as before this plan) | PASS |
| Lock unit contract (regression) | `node lib/core/npm-install-lock.test.cjs` | 20 passed, 0 failed (same count as before this plan) | PASS |
| Hook path byte-identical | `git diff --quiet HEAD -- scripts/sessionstart-npm-reconcile.cjs` | exit 0 | PASS |
| Invariant chain values unchanged | direct grep of source constants | `DEFAULT_INSTALL_TIMEOUT_MS=120000`, `CONNECT_PATH_BUDGET_MS=15000`, `STALE_THRESHOLD_MS=180000`, `WAIT_TIMEOUT_MS=200000` | PASS |
| No em-dashes in any of the 8 files this plan touched | `LC_ALL=C.UTF-8 grep -cP '\x{2014}'` across all 8 files | 0 for every file | PASS |
| **MY OWN INDEPENDENT ADVERSARIAL REPRODUCTION** (not the shipped test, not narration) | Custom script: fresh mkdtemp scratch dir, fake `package.json` naming one nonexistent dependency, no `node_modules`, `CLAUDE_PLUGIN_ROOT`/`MINDRIAN_OS_ROOT` deleted from child env, planted live self-owned lock (`{pid: process.pid, timestamp: Date.now()}`), spawned child requiring the REAL `lib/core/mcp-dep-heal.cjs`, called `beginConnectPathBudget()` with no override (true production default 15000ms), replayed the real 1x `ensureDepsPresent` + 3x `requireWithHeal` sequence, outer `spawnSync` timeout 40000ms | **call1=15190ms, call2=3ms, call3=0ms, call4=1ms, cumulative=15194ms.** `node_modules` never created in scratch dir (no real install ran). All 3 short-circuited calls threw `MODULE_NOT_FOUND` (the original error, not swallowed). | **PASS** |
| **SENSITIVITY CHECK** (pre-fix code, proves my harness is sensitive) | Identical scenario replayed against `git show 51fd9c58:lib/core/mcp-dep-heal.cjs` (extracted read-only into a scratch file, deleted immediately after use, confirmed zero working-tree diff afterward) | call1=15130ms, call2=15061ms, call3=15145ms, call4=15071ms, **cumulative=60407ms** (matches the prior verifier's independently-measured 60296ms within measurement noise) | Confirms my reproduction technique WOULD have caught the original regression -- it is not reporting "fast" unconditionally. |

**Reproduction methodology matches the mandate exactly:** fresh temp scratch dir with a fake dependency and no `node_modules`; env sanitized of `CLAUDE_PLUGIN_ROOT`/`MINDRIAN_OS_ROOT` (verified this matters -- `resolvePluginRoot` at `lib/core/mcp-dep-heal.cjs:223-230` prefers those two env vars over the `pluginRoot` argument); a live self-owned lock planted so `acquireInstallLock` loses and the peer-wait branch is forced with zero real npm install; a subprocess-guarded outer timeout (40000ms) so a still-broken fix would fail fast rather than hang the verification; the real exported `beginConnectPathBudget()` called with no override (true production default); the real 4-call sequence (1 `ensureDepsPresent` + 3 `requireWithHeal`) each entry point actually makes.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MCPFIX-01 | 266-01-PLAN.md | Instructions served at or under 1950 bytes, Part 8 paragraph intact | SATISFIED | Live wire test passing, 1888 bytes measured. Not touched by 266-05, no regression. |
| MCPFIX-02 | 266-02-PLAN.md | room_state description clean | SATISFIED | Live wire test passing. Not touched by 266-05, no regression. |
| MCPFIX-03 | 266-03-PLAN.md, closed by 266-05-PLAN.md | No dependency-heal path blocks initialize beyond an explicit connect-path budget under the host's ~30s timeout, AT THE PROCESS LEVEL | **SATISFIED (gap closed)** | 266-03 delivered only a per-call bound (found FAILED in the prior verification). 266-05 replaced it with a process-wide shrinking deadline. Independently re-measured at 15194ms cumulative against the real production code and a hostile forced-wait scenario, vs. the prior 60296ms regression and the ~30000ms host ceiling. REQUIREMENTS.md line 338-346 accurately narrates this closure history. |
| MCPFIX-04 | 266-04-PLAN.md | Guardrail test covers every registered tool | SATISFIED | Live run: 36/36 coverage, 156 passed. Not touched by 266-05, no regression. |

No orphaned requirements. REQUIREMENTS.md marks all four `[x]` and MCPFIX-03's entry (lines 338-346) explicitly and honestly narrates the two-plan closure history rather than overclaiming a single-pass fix.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| -- | -- | No TBD/FIXME/XXX debt markers found in any of the 8 files 266-05 modified | -- | Clean |
| `bin/mindrian-mcp-server.cjs` / `lib/mcp/tool-router.cjs` | (carried forward from prior verification, 266-REVIEW.md WR-02) | `larryContext` loaded from disk but its only reader (the `compact` splice) was deleted in 266-02 and never replaced | INFO, pre-existing, not introduced or worsened by 266-05 | Not a goal blocker; unrelated to MCPFIX-03. |
| `lib/core/mcp-dep-heal.cjs` | 246-279 (carried forward, 266-REVIEW.md WR-03) | `spawnSync`'s kill-on-timeout can leave `node_modules` partially populated | INFO, pre-existing, explicitly acknowledged in 266-05's own `CONNECT_PATH_MIN_ATTEMPT_MS` design rationale (grounded in this exact risk) rather than newly introduced | Out of scope for MCPFIX-03; already named and reasoned about by the fix itself. |

The prior verification's WR-01 finding (EMDASH_TARGETS missing the two `bin/*.cjs` entry points and two test files) was explicitly closed by 266-05 Task 3: `grep -c 'bin/mindrian-mcp-server.cjs' tests/run-all-266.sh` returns 1, same for `bin/mindrian-brain-mcp-client.cjs`, confirmed by direct read of `tests/run-all-266.sh` lines 170-190.

### Human Verification Required

None. All must-haves are verifiable programmatically; MCPFIX-03's closure is a wall-clock, code-reading, and adversarial-reproduction finding, not a UX/visual/real-time judgment call.

### Gaps Summary

None. The single gap from the prior verification pass (Truth #5 / MCPFIX-03: connect-path budget enforced per-call rather than per-process, cumulative worst case ~60296ms against a ~30000ms host connect timeout) is closed. This was independently re-verified, not accepted on the strength of the plan's own SUMMARY.md or its own shipped test's green exit code:

1. **Code read in full**: `lib/core/mcp-dep-heal.cjs`'s `beginConnectPathBudget`/`connectPathRemainingMs`/`CONNECT_PATH_MIN_ATTEMPT_MS` exist, are exported, and are genuinely consulted at both heal call sites (the two former fresh-budget literals are gone, confirmed by grep returning 0 matches). Both `bin/*.cjs` entry points call `beginConnectPathBudget()` before their first heal call and now inspect (rather than discard) `ensureDepsPresent`'s return value.
2. **Shipped test suite run for real**: `node tests/test-266-connect-path-process-budget.cjs` (7/7), `node tests/test-266-dep-heal-connect-budget.cjs` (9/9, unchanged), `node lib/core/mcp-dep-heal.test.cjs` (9/9, unchanged), `node lib/core/npm-install-lock.test.cjs` (20/20, unchanged), `bash tests/run-all-266.sh` (`PASS=9 FAIL=0 SKIP=0`) -- all genuinely exit 0, not merely claimed to.
3. **My own independent adversarial reproduction**, written fresh (not the shipped test file, not a re-run of it), replaying the exact hostile scenario the prior verification used (planted live self-owned lock forcing the peer-wait branch, real production `CONNECT_PATH_BUDGET_MS`, real 4-call module-scope sequence): measured **cumulative=15194ms**, comfortably under the ~30000ms host connect timeout and roughly 4x better than the prior 60296ms regression. Calls after the first short-circuited in 0-3ms and propagated the original `MODULE_NOT_FOUND` without a new install attempt.
4. **Sensitivity check against the pre-fix code** (`git show 51fd9c58:lib/core/mcp-dep-heal.cjs`, extracted read-only, cleaned up immediately, working tree confirmed unmodified afterward): the identical scenario against the OLD code reproduced **cumulative=60407ms**, closely matching the prior verifier's independently-measured 60296ms. This proves my harness is sensitive to the regression class, not just reporting "fast" unconditionally -- it would have caught the original bug had it still been present.
5. **No regressions**: all three previously-VERIFIED requirements (MCPFIX-01, MCPFIX-02, MCPFIX-04) re-checked live and still pass with the same counts as the prior verification. The hook path (`scripts/sessionstart-npm-reconcile.cjs`) is confirmed byte-identical. The four-link invariant chain (`CONNECT_PATH_BUDGET_MS < DEFAULT_INSTALL_TIMEOUT_MS < STALE_THRESHOLD_MS < WAIT_TIMEOUT_MS`) holds with all four values unchanged (15000/120000/180000/200000).

All 8 must-have truths verified against the live codebase. Phase 266 goal achieved: all four MCPFIX requirements are genuinely satisfied, including MCPFIX-03 at the process level its own requirement text always meant.

---

_Verified: 2026-08-27T06:15:00Z_
_Verifier: Claude (gsd-verifier)_

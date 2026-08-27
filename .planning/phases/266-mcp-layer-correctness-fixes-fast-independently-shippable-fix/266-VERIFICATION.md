---
phase: 266-mcp-layer-correctness-fixes-fast-independently-shippable-fix
verified: 2026-08-27T04:45:32Z
status: gaps_found
score: 7/8 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Neither MCP server can block the host's initialize handshake for longer than the host is willing to wait (MCPFIX-03)"
    status: failed
    reason: >
      CONNECT_PATH_BUDGET_MS (15000ms) is enforced per-call, not per-process. Both
      bin/mindrian-mcp-server.cjs and bin/mindrian-brain-mcp-client.cjs make 4 independent
      ensureDepsPresent/requireWithHeal calls in sequence at module scope, each of which
      independently calls runGuardedInstall with its own fresh 15000ms budget on failure.
      ensureDepsPresent's return value is never inspected before the subsequent
      requireWithHeal calls run, so a failed first heal does not short-circuit the later
      calls -- each one retries a full guarded install/peer-wait from scratch. On exactly
      the cold-cache / slow-install scenario this phase's own header names as "the reason
      this budget exists," cumulative blocking time before answering `initialize` can reach
      up to ~60000ms (4 x 15000ms), roughly double the host's own ~30000ms connect timeout
      (CHANGELOG 2.1.242) that MCPFIX-03 was built to respect. Independently reproduced
      (not just taken from 266-REVIEW.md CR-01): a hermetic script forcing the peer-wait
      branch on every call measured call1=15081ms, call2=15066ms, call3=15068ms,
      call4=15081ms, cumulative=60296ms, using the actual production functions
      (ensureDepsPresent then runGuardedInstall) and the real exported CONNECT_PATH_BUDGET_MS.
      tests/test-266-dep-heal-connect-budget.cjs checks 5/6 only exercise one
      waitForUnlock/ensureDepsPresent call in isolation and never assert the cumulative
      module-scope sequence the real entry points execute, so this gap passes every test
      in the phase's own suite.
    artifacts:
      - path: "bin/mindrian-mcp-server.cjs"
        issue: "4 independent connectPath-opted heal call sites (lines 56, 58, 59, 153) with no shared/shrinking deadline between them; ensureDepsPresent's {ok:false} return is discarded at line 56"
      - path: "bin/mindrian-brain-mcp-client.cjs"
        issue: "Same pattern: 4 independent connectPath-opted heal call sites (lines 41, 43, 44, 45) with no shared budget"
      - path: "lib/core/mcp-dep-heal.cjs"
        issue: "requireWithHeal (line 207) and ensureDepsPresent (line 291) each independently call runGuardedInstall with a fresh full CONNECT_PATH_BUDGET_MS; no mechanism accepts or threads a remaining/shrinking budget across sequential calls in the same process"
    missing:
      - "A single shared, monotonically-shrinking deadline computed once at process start and threaded through every ensureDepsPresent/requireWithHeal call site in both bin/*.cjs entry points (per 266-REVIEW.md CR-01's suggested fix), OR requireWithHeal short-circuiting (propagating the error immediately without a new install attempt) once ensureDepsPresent has already spent the connect-path budget and reported ok:false."
      - "A test that exercises the full module-scope sequence of heal calls a real entry point makes (not a single isolated call), proving the cumulative wall-clock bound holds."
deferred: []
human_verification: []
---

# Phase 266: MCP Layer Correctness Fixes Verification Report

**Phase Goal:** Fast, independently shippable fixes to the MCP transport layer, found live during Phase 265's audit: (1) trim `runtime-instructions.cjs` under Claude Code's 2048-byte instructions cap without losing the Canon Part 8 paragraph; (2) stop `tool-router.cjs`'s `room_state` description from splicing 80 raw chars of `voice-dna.md`; (3) bound the `mcp-dep-heal.cjs` blocking `npm install` to fit inside the host's ~30s MCP connect timeout; (4) make the MCP tool-description guardrail test cover all registered tools instead of 8 of 36.

**Verified:** 2026-08-27T04:45:32Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | MCP `instructions` served at initialize never exceed the 2048-byte host cap (MCPFIX-01) | VERIFIED | Live wire test: `node lib/mcp/no-instructions.test.cjs` exits 0, 9/9 passed. `Buffer.byteLength(RUNTIME_INSTRUCTIONS,'utf8')` measures 1888 bytes, under both the 1950-byte budget and the 2048-byte host cap. |
| 2 | The Canon Part 8 BOUNDARIES paragraph reaches the model in full, including the final routing sentence | VERIFIED | `RUNTIME_INSTRUCTIONS.endsWith('Heavy pipeline work belongs in Claude Code - say so when asked for it here.')` confirmed true directly in a node REPL; test scenario 7/8 (PART8_BOUNDARIES_FROZEN present + string tail) both pass on the live wire response. |
| 3 | A future edit that crosses the host cap fails a test instead of truncating silently | VERIFIED | `HOST_INSTRUCTIONS_CAP_BYTES` (2048) and `SERVED_BUDGET_BYTES` (1950) are asserted independently against live `Buffer.byteLength` of the wire response, not a re-derived value; confirmed by reading no-instructions.test.cjs and its passing run. |
| 4 | `room_state` tool description contains no markdown heading, no embedded newline, no voice-dna.md fingerprint, no mid-word cut (MCPFIX-02) | VERIFIED | Live wire test `tests/test-266-room-state-description.cjs`: 12/12 passed, including no `#`, no `\n`, no "Voice DNA"/"professor" fingerprint, 456-char description, names all 5 dispatched commands, no em-dash. `grep -n compact lib/mcp/tool-router.cjs lib/mcp/larry-context.cjs` returns zero matches -- the splice is fully deleted. |
| 5 | No dependency-heal path can block the MCP `initialize` handshake beyond the host's patience (MCPFIX-03) | **FAILED** | Independently reproduced with the real production code (`ensureDepsPresent` then 3x `runGuardedInstall`, using the real exported `CONNECT_PATH_BUDGET_MS`): cumulative elapsed 60296ms across the 4 heal call sites each `bin/*.cjs` entry point makes at module scope, against a ~30000ms host connect timeout. See Gap below. |
| 6 | A heal that misses the budget emits a clear breadcrumb instead of hanging | VERIFIED (per-call only) | Each individual call does return within its own budget and logs a breadcrumb (`connect-path heal did not finish inside 15000ms...`); confirmed by reading `ensureDepsPresent`'s `connectPath && !outcome.ok` branch. This property holds per-call but does not make Truth #5 true, since the PROCESS still exceeds the host's total patience across multiple calls. |
| 7 | The SessionStart reconcile hook keeps its full 120-second install budget | VERIFIED | `grep -v '^\s*[*/]' scripts/sessionstart-npm-reconcile.cjs \| grep -c 'connectPath\|timeoutMs'` returns 0 (confirmed by test-266-dep-heal-connect-budget.cjs check 8, passing); `DEFAULT_INSTALL_TIMEOUT_MS === 120000` confirmed via `node lib/core/mcp-dep-heal.test.cjs`. |
| 8 | The MCP tool-description guardrail test covers every registered tool, not 8 of 36 (MCPFIX-04) | VERIFIED | Live run: `node tests/test-234-tool-description-floor.cjs` reports "prose-shape coverage: 36/36 registered tools", 156 passed, 0 failed. Coverage derived from `tools/list` at runtime, not a hand-maintained list (confirmed by reading the coverage-ledger pattern). |

**Score:** 7/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/mcp/runtime-instructions.cjs` | RUNTIME_INSTRUCTIONS <= 1950 bytes, BOUNDARIES intact | VERIFIED | 1888 bytes, Part 8 tail present, wired into `bin/mindrian-mcp-server.cjs` `createServer()` |
| `lib/mcp/no-instructions.test.cjs` | Host-boundary byte-cap assertion + frozen Part 8 copy | VERIFIED | 9/9 checks pass against the live wire |
| `tests/run-all-266.sh` | Phase aggregator | VERIFIED | Executable, 8/8 legs pass, found-eq-0 guard present |
| `lib/mcp/tool-router.cjs` | room_state description clean, compact splice deleted | VERIFIED | grep confirms zero `compact` references remain |
| `lib/mcp/larry-context.cjs` | compact field removed | VERIFIED | grep confirms zero `compact` references remain |
| `tests/test-266-room-state-description.cjs` | Wire pin on room_state description | VERIFIED | 12/12 checks pass live |
| `lib/core/mcp-dep-heal.cjs` | CONNECT_PATH_BUDGET_MS + DEFAULT_INSTALL_TIMEOUT_MS, connectPath threading | VERIFIED (exists, wired) but data-flow HOLLOW at the process level -- see gap | Exports both constants; connectPath threads correctly through each individual call, but no cross-call budget accounting exists |
| `lib/core/npm-install-lock.cjs` | waitForUnlock per-call timeout override | VERIFIED | `opts.timeoutMs` honored, defaults unchanged, confirmed by wall-clock test |
| `tests/test-266-dep-heal-connect-budget.cjs` | Wall-clock proof of the connect-path contract | VERIFIED but INCOMPLETE | 9/9 checks pass, but only exercises one call in isolation per check -- never the real entry points' 4-call sequence, which is exactly where the gap lives |
| `tests/test-234-tool-description-floor.cjs` | Every registered tool prose-checked | VERIFIED | 36/36 coverage, live run |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `lib/mcp/no-instructions.test.cjs` | `lib/mcp/runtime-instructions.cjs` | Wire probe, `Buffer.byteLength` | WIRED | Confirmed live |
| `tests/run-all-266.sh` | `lib/mcp/no-instructions.test.cjs` | Explicit leg | WIRED | Confirmed present and passing in aggregator run |
| `bin/mindrian-mcp-server.cjs` | `lib/core/mcp-dep-heal.cjs` | `ensureDepsPresent({connectPath:true})` | WIRED but INSUFFICIENT | The call exists and connectPath is honored per-call; the link does not compose into a process-level bound as the plan's own success criterion requires |
| `lib/core/mcp-dep-heal.cjs` | `lib/core/npm-install-lock.cjs` | `runGuardedInstall` -> `waitForUnlock` | WIRED | Confirmed: both arms of the race bounded by the same `timeoutMs` |

### Behavioral Spot-Checks / Independent Reproduction

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Served instructions fit under host cap with Part 8 intact | `node lib/mcp/no-instructions.test.cjs` | 9 passed, 0 failed, 1888 bytes | PASS |
| room_state description is clean prose | `node tests/test-266-room-state-description.cjs` | 12 passed, 0 failed | PASS |
| Tool-description floor covers every tool | `node tests/test-234-tool-description-floor.cjs` | 156 passed, 0 failed, 36/36 coverage | PASS |
| Phase aggregator | `bash tests/run-all-266.sh` | PASS=8 FAIL=0 SKIP=0 | PASS |
| Connect-budget unit tests | `node tests/test-266-dep-heal-connect-budget.cjs`, `node lib/core/mcp-dep-heal.test.cjs`, `node lib/core/npm-install-lock.test.cjs` | All exit 0 | PASS (but scope-limited, see gap) |
| **Cumulative multi-call connect-path budget** (independent reproduction of 266-REVIEW.md CR-01, not from the review's narration) | Custom script calling the real `ensureDepsPresent` then 3x `runGuardedInstall` with the real exported `CONNECT_PATH_BUDGET_MS`, forcing the peer-wait branch each time via a planted live lock (mirrors the test's own hermetic technique) | call1=15081ms, call2=15066ms, call3=15068ms, call4=15081ms, **cumulative=60296ms** against a ~30000ms host connect timeout | **FAIL** |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MCPFIX-01 | 266-01-PLAN.md | Instructions served at or under 1950 bytes, Part 8 paragraph intact, host-boundary test | SATISFIED | Live wire test passing, 1888 bytes measured |
| MCPFIX-02 | 266-02-PLAN.md | room_state description clean, no markdown/newline/fingerprint/mid-word cut | SATISFIED | Live wire test passing, splice fully deleted |
| MCPFIX-03 | 266-03-PLAN.md | No dependency-heal path blocks initialize beyond an explicit connect-path budget under the host's ~30s timeout | **BLOCKED** | Per-call budget exists and is correctly bounded in isolation, but the real entry points make 4 sequential independently-budgeted calls with no shared deadline, so the process-level guarantee the requirement actually promises does not hold in the cold-cache scenario the phase itself names as the reason the fix exists |
| MCPFIX-04 | 266-04-PLAN.md | Guardrail test covers every registered tool, states its own coverage | SATISFIED | Live run: 36/36 coverage, 156 passed |

No orphaned requirements: all four MCPFIX IDs appear in exactly one plan's `requirements:` frontmatter each, and REQUIREMENTS.md marks all four `[x]` (roadmap-claimed complete; MCPFIX-03's claim is not supported by the evidence above).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No TBD/FIXME/XXX debt markers found in any of the 13 files this phase modified | — | Clean |
| `bin/mindrian-mcp-server.cjs` / `lib/mcp/tool-router.cjs` | 99, 143 / 635, 640 | `larryContext` is loaded from disk (3 sync file reads) and threaded through `registerRouterTools` but is dead: the only reader (`compact` splice) was deleted by this phase's own 266-02 work and never replaced | INFO (266-REVIEW.md WR-02) | Not a goal blocker; wasted I/O on every boot, reads like an oversight rather than a deliberate choice |
| `tests/run-all-266.sh` | 170-179 | `EMDASH_TARGETS` omits `bin/mindrian-mcp-server.cjs`, `bin/mindrian-brain-mcp-client.cjs`, and two test files this phase's own MCPFIX-03 work touches/creates, despite two of them carrying their own in-file "no em-dashes" hard-rule comment | INFO (266-REVIEW.md WR-01) | Currently all four files are clean (verified via `grep -P '\x{2014}'`), but the fence does not machine-check its own stated claim |
| `lib/core/mcp-dep-heal.cjs` | 291-331, 171-188 | `spawnSync`'s kill-on-timeout on the connect path can leave `node_modules` partially populated; the directory-existence probe cannot distinguish complete from truncated installs | INFO (266-REVIEW.md WR-03) | Out of this phase's stated scope; a pre-existing risk this phase's own 15s cap makes materially more likely to trigger |

### Human Verification Required

None. All must-haves are verifiable programmatically; the failing item is a structural code-reading + wall-clock finding, not a UX/visual/real-time judgment call.

### Gaps Summary

7 of 8 must-have truths are genuinely verified against the live codebase, not just claimed in SUMMARY.md: MCPFIX-01, MCPFIX-02, and MCPFIX-04 are all confirmed with real wire-level test runs showing the exact byte counts, coverage numbers, and clean descriptions the plans promised. These three fixes are solid and shippable independently.

MCPFIX-03 is the one gap, and it is a BLOCKER, not a nitpick: the phase's own stated purpose for this fix -- "make the dependency self-heal fit inside the budget the host actually gives it, so a first-post-update session degrades honestly instead of being reported as a failed MCP server" -- is not actually achieved. The fix correctly bounds any single `ensureDepsPresent`/`requireWithHeal` call to 15 seconds, but both `bin/mindrian-mcp-server.cjs` and `bin/mindrian-brain-mcp-client.cjs` make 4 of these calls in sequence at module scope before either server can answer `initialize`, and nothing threads a shared, shrinking deadline across them. `ensureDepsPresent`'s failure return is silently discarded rather than short-circuiting the calls that follow it. On exactly the cold-cache / slow-network scenario this phase's own module header names as the reason `CONNECT_PATH_BUDGET_MS` exists, the four calls can each independently burn their own full 15-second budget, for a worst-case cumulative total of approximately 60 seconds -- double the host's own ~30-second connect timeout. This was independently reproduced against the real, unmodified production functions (not asserted from 266-REVIEW.md's narrative alone): a hermetic script forcing the peer-wait branch on every call, using the real exported `CONNECT_PATH_BUDGET_MS` and the real `ensureDepsPresent`/`runGuardedInstall` functions, measured 15081ms + 15066ms + 15068ms + 15081ms = 60296ms cumulative elapsed time.

`tests/test-266-dep-heal-connect-budget.cjs` passes 9/9 and gives a false sense of completeness because every check exercises exactly one `waitForUnlock`/`ensureDepsPresent` call in isolation -- it never simulates or asserts against the real multi-call sequence either entry point actually executes. A green run of the phase's entire test suite (`bash tests/run-all-266.sh`, PASS=8 FAIL=0) therefore cannot be read as proof the connect-path guarantee holds at the process level, only at the single-call level.

This does not look like an intentional, accepted deviation (no alternative implementation achieves the same intent) -- it reads as an incomplete fix that satisfies the literal per-call acceptance criteria written into 266-03-PLAN.md's tasks while missing the plan's own stated success criterion ("No path from `initialize` can block longer than 15 seconds against a ~30 second host budget") at the process level. 266-REVIEW.md already proposes the fix: thread a single shared, monotonically-shrinking deadline through the whole connect-path sequence, or have `requireWithHeal` skip re-attempting the install once `ensureDepsPresent` has already spent the connect-path budget and reported `ok:false`. Recommend routing back to `/gsd-plan-phase --gaps` for a closure plan rather than an override -- this is squarely the class of gap the phase's own goal statement was written to close (item 3 of the roadmap goal: "a blocking spawnSync npm install capped at 120s ... 4x the host's own ~30s connect timeout, so it always fails from the host's side first" -- the fix reduces the multiplier from 4x to roughly 2x in the worst case, but does not eliminate it).

---

_Verified: 2026-08-27T04:45:32Z_
_Verifier: Claude (gsd-verifier)_

---
phase: 114-larry-default-activation
plan: "01"
subsystem: infra
tags: [mcp, alwaysLoad, claude-code-2.1.121, plugin-config, seed-003-a1, canon-part-10, canon-part-3]

# Dependency graph
requires:
  - phase: 109-sql-context-memory-navigation-spine
    provides: v1.13.0-beta.1 substrate -- Phase 114 ships in beta.2
  - phase: SEED-003 A1 alwaysLoad
    provides: capability gate confirming CC 2.1.121+ availability of `alwaysLoad: true` on MCP server entries
provides:
  - mindrian-os MCP tools surface from turn 1 (no Tool Search 10% deferral)
  - Structural enabler for AC-114-03 (mindrian-os MCP tools available from turn 1)
  - Pre-edit state for Plan 114-02 smoke test (tests/test-114-mcp-alwaysload.sh)
affects:
  - 114-02 verification + acceptance test (consumes post-edit state)
  - 115 owned-emotion-dual-path-first-touch (Larry can call mindrian-tools subcommands inside turn-1 response without 10% threshold latency)
  - 116-120 Part 10 sub-claim phases (turn-1 tool surfacing is platform-level precondition for conversation-as-product)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "MCP server alwaysLoad opt-in -- single-line config field, scoped to plugin-distributed local stdio servers only; user-side MCPs (e.g., Brain) remain user opt-in per CONTEXT.md scope guard"

key-files:
  created: []
  modified:
    - .mcp.json -- mindrian-os entry gains `alwaysLoad: true` as final key (8 -> 9 lines, +2/-1 diff)

key-decisions:
  - "Scope alwaysLoad to mindrian-os ONLY. Brain MCP alwaysLoad remains user-side opt-in (out of scope per 114-CONTEXT.md). The plugin does not distribute Brain MCP config; users add Brain to their personal .mcp.json."
  - "alwaysLoad placed as the LAST key in the mindrian-os entry (order: command, args, alwaysLoad), matching RESEARCH Code Example 2 convention."
  - "Boolean true (JSON literal), never the string \"true\" -- enforced by acceptance criterion `typeof === 'boolean'`."

patterns-established:
  - "Pattern: SEED capability adoption ships scoped. SEED-003 A1 originally targeted Brain MCP (user-side); Phase 114 narrows to mindrian-os (plugin-distributed) without re-scoping the seed itself. The seed remains the canonical reference; the phase claims the in-plugin slice."

requirements-completed: [AC-114-03]

# Metrics
duration: 4min
completed: 2026-05-05
---

# Phase 114 Plan 01: alwaysLoad on mindrian-os MCP -- Summary

**Single-line `alwaysLoad: true` boolean added to `.mcp.json` mindrian-os entry, bypassing the Tool Search 10% deferral so plugin tools surface from turn 1 without changing transport, server target, or any other config.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-05T13:54:21Z (per STATE.md last_updated at execution start)
- **Completed:** 2026-05-05T13:57:15Z
- **Tasks:** 1 of 1
- **Files modified:** 1 (.mcp.json)

## Accomplishments

- `.mcp.json` mindrian-os entry now declares `"alwaysLoad": true` as a boolean literal.
- File parses as valid JSON via `JSON.parse` (canonical reader test).
- mindrian-os transport remains stdio (`command: node`, `args: [bin/mindrian-mcp-server.cjs]` byte-identical).
- No Brain MCP entry added (Canon Part 8 + 114-CONTEXT.md scope guard honored; `grep -ci 'brain' .mcp.json` = 0).
- File-disjoint with Plan 114-00 (parallel Wave 1 contract preserved -- 114-00 touches agents/, settings.json, skills/, scripts/; 114-01 touches .mcp.json only).

## Task Commits

1. **Task 1: Add alwaysLoad: true to mindrian-os entry in .mcp.json** -- `59d9459` (feat)

_Note: Plan 114-01 had a single autonomous task (no TDD, no checkpoints). Atomic single commit per parallel-executor protocol with `--no-verify` (orchestrator validates hooks once after Wave 1 completes)._

## Files Created/Modified

- `.mcp.json` -- mindrian-os MCP server entry gained `alwaysLoad: true` as the final key. Pre-state: 8 lines, no alwaysLoad. Post-state: 9 lines, alwaysLoad: true (boolean). Trailing comma added to args[] line so it is no longer the final key in the object. File ends with newline (`\n`) per existing convention.

## Pre/Post Verification Output

### JSON validity
```
$ node -e "JSON.parse(require('fs').readFileSync('.mcp.json','utf8')); console.log('JSON.parse: OK')"
JSON.parse: OK
```

### typeof + value confirmation
```
$ node -e "const c=require('./.mcp.json'); console.log('typeof alwaysLoad:', typeof c.mcpServers['mindrian-os'].alwaysLoad); console.log('alwaysLoad value:', c.mcpServers['mindrian-os'].alwaysLoad)"
typeof alwaysLoad: boolean
alwaysLoad value: true
```

### grep battery (all acceptance criteria)
```
alwaysLoad-true count:    1   # AC: returns exactly 1
alwaysLoad-any count:     1   # AC: returns exactly 1 (no duplicate)
command-node count:       1   # AC: existing command preserved
args-with-comma count:    1   # AC: trailing comma added
mindrian-os count:        1   # AC: only server entry
mindrian-brain count:     0   # AC: Brain MCP scope guard
brain (any) count:        0   # AC: case-insensitive Brain check
wc -l:                    9   # AC: 9 lines after edit
final byte:              \n   # AC: file ends with newline
```

### Plan-spec automated verifier
```
$ node -e "const c=require('./.mcp.json'); if(c.mcpServers['mindrian-os'].alwaysLoad !== true){process.exit(1)}; if(c.mcpServers['mindrian-os'].command !== 'node'){process.exit(2)}; if(!Array.isArray(c.mcpServers['mindrian-os'].args)){process.exit(3)}; console.log('OK')"
OK
```

### Diff
```
$ git diff --stat .mcp.json
 .mcp.json | 3 ++-
 1 file changed, 2 insertions(+), 1 deletion(-)
```

```diff
@@ -2,7 +2,8 @@
   "mcpServers": {
     "mindrian-os": {
       "command": "node",
-      "args": ["bin/mindrian-mcp-server.cjs"]
+      "args": ["bin/mindrian-mcp-server.cjs"],
+      "alwaysLoad": true
     }
   }
 }
```

## Decisions Made

- **None new.** Plan executed exactly as specified. The two pre-locked decisions (scope to mindrian-os; alwaysLoad as final key) are documented in 114-01-PLAN.md `<action>` block and 114-CONTEXT.md OUT-OF-SCOPE bullet.

## Deviations from Plan

**None -- plan executed exactly as written.**

The single task's `<action>` block was applied verbatim. Acceptance criteria battery passed end-to-end without auto-fix triggers (no Rule 1 bugs, no Rule 2 missing critical functionality, no Rule 3 blocking issues, no Rule 4 architectural changes).

## Issues Encountered

**Documented anomaly (not a deviation):** The plan's `<verification>` section listed `node --check .mcp.json` as a Node 22+ JSON validity check. This is incorrect -- `node --check` parses files as JavaScript, not JSON, and reliably errors on the `:` after the first key in any JSON file. The canonical JSON validity check is `node -e "JSON.parse(require('fs').readFileSync('.mcp.json','utf8'))"` (which passed cleanly), and the canonical reader is Anthropic's MCP loader (exercised at runtime). No code change needed; flagging in this Issues section so 114-02 (which inherits the verification list) can use the JSON.parse form, not `node --check`. This is informational, not a deviation -- the file IS valid JSON; the wrong tool was suggested in the verification list.

**Untracked files in workspace:** `git status --short` shows pre-existing untracked tester directories under docs/testers/ and one Part 10 proposal markdown. These were already present before Plan 114-01 began (they predate this plan's first edit) and are out of scope per the GSD scope boundary rule (only auto-fix issues directly caused by the current task). Not modified, not committed by this plan.

## Note on Empirical Validation Deferral

Empirical turn-1 tool surfacing validation (i.e., booting a fresh Claude Code session and asserting `/mcp` shows mindrian-os with N>=1 tools at session start) is deferred to Plan 114-02 `tests/test-114-mcp-alwaysload.sh`. Plan 114-01's scope is the structural enablement: file edited correctly so the canonical reader (Anthropic MCP loader) sees `alwaysLoad: true` and acts on it. Behavioral verification belongs to the Wave 2 verification plan.

## Pitfall 3 Risk Mitigation Strategy (per 114-RESEARCH.md)

The risk: if mindrian-os MCP server has a startup bug, `alwaysLoad: true` makes that bug load-bearing for every session start (without alwaysLoad, server tools surface lazily and a startup failure shows up only on first invocation).

Mitigation stack already in place:
1. **CC 2.1.121+ MCP auto-retry on transient startup errors (3 retries)** -- platform-level partial mitigation, no Phase 114 work needed.
2. **Beta-channel ship gate.** Phase 114 ships as `v1.13.0-beta.2` (release infrastructure pattern from `.claude/includes/release-process.md` -- "Release infrastructure ALWAYS ships as a beta first"). Lawrence validates before promotion to stable.
3. **CC 2.1.128 `/mcp` zero-tool flagging** -- diagnostic surface for detection if startup silently fails.
4. **Plan 114-02 smoke test (`tests/test-114-mcp-alwaysload.sh`)** -- boots a fresh session, asserts mindrian-os shows N>=1 tools, asserts response time of first tool call < 1 second (no 10% threshold wait). This is the empirical gate before promoting beta.2 to stable.

## Canon Part 8 Confirmation

| Code path | LOCAL data -> BRAIN? | Verdict |
|-----------|---------------------|---------|
| `.mcp.json` `alwaysLoad: true` on mindrian-os | mindrian-os is local stdio (`command: node`, no remote URL). The flag toggles tool SURFACING only. Changes WHEN tools become visible to the model, not WHAT tools do or WHERE they connect. | NO LEAK |

PASSES Canon Part 8 conformance. The mindrian-os MCP server has no remote endpoint, no auth headers, no network egress path. `alwaysLoad: true` does not introduce one; it only removes a deferral heuristic. Brain MCP scope guard verified by `grep -ci 'brain' .mcp.json` = 0.

## User Setup Required

None -- no external service configuration required. The `alwaysLoad` field is honored by Claude Code's plugin loader (CC 2.1.121+ shipping is currently 2.1.128 per references/capability-radar/changelog-cache.md) without any user action. Users on Claude Code below 2.1.121 will see the field silently ignored (forward-compatible).

## Next Phase Readiness

- **Plan 114-02 (Wave 2) ready to consume:** post-edit `.mcp.json` is in main with the correct shape. The smoke test in 114-02 can grep the live file or boot the live MCP server with the live config.
- **Plan 114-00 (Wave 1 sibling) parallelism honored:** 114-00 modifies agents/larry-extended.md, settings.json, skills/, scripts/session-start. 114-01 modifies .mcp.json. Intersection is empty -- the orchestrator's parallel-wave contract holds.
- **AC-114-03 structurally enabled.** Functional verification (turn-1 tool surfacing in a live session) belongs to 114-02 + the empathy audit gate before beta.2 -> stable promotion.

## Self-Check: PASSED

- [x] `.mcp.json` exists at `/home/jsagi/MindrianOS-Plugin/.mcp.json` -- FOUND
- [x] Commit `59d9459` exists in git log -- FOUND
- [x] `alwaysLoad: true` boolean present in mindrian-os entry -- VERIFIED via JSON.parse + typeof
- [x] No Brain MCP entry in .mcp.json -- VERIFIED via grep
- [x] mindrian-os transport remains stdio -- VERIFIED (command: node, args byte-identical)
- [x] File 9 lines, ends with newline -- VERIFIED via wc -l + od -c

---
*Phase: 114-larry-default-activation*
*Completed: 2026-05-05*

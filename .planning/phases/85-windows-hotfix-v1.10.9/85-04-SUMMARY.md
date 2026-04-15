---
phase: "85"
plan: "04"
subsystem: hooks/run-hook.cmd regression fence
tags: [windows-hotfix, security-adjacent, regression-test, WIN-FIX-F]
requires:
  - hooks/run-hook.cmd F-01 fix landed in commit 3bcf83d
provides:
  - tests/fixtures/cmd-shim.sh (Linux simulation of cmd.exe exit propagation)
  - tests/test-run-hook-cmd.cjs (regression test, 8 assertions)
  - F-03 verbatim wording locked for 85-07 CHANGELOG
affects:
  - lib/memory/run-feynman-tests.cjs (registered 14th test file)
tech-stack:
  added: []
  patterns: [structural-pattern-assert, bash-shim-simulation, fixture-isolation-via-mkdtemp]
key-files:
  created:
    - tests/fixtures/cmd-shim.sh
    - tests/test-run-hook-cmd.cjs
  modified:
    - lib/memory/run-feynman-tests.cjs
  verified-unchanged:
    - hooks/run-hook.cmd
decisions:
  - Structural check plus behavioral check in the shim. Real cmd.exe emulation would need wine or a Windows runner. Neither is available. Asserting the three textual patterns catches the exact regression class that broke v1.10.7 and v1.10.8.
  - Block message assertion accepts stdout OR stderr. write-scope-check.cjs emits on stderr. The plan text said stdout but reality beats plan.
  - Added a negative control (same-room Write must exit 0) so the test proves the propagation contract is wired both ways, not just for the block path.
  - Isolated MindrianRooms fixture via mkdtempSync so the test does not depend on the developer's real registry.
metrics:
  duration: ~10 min
  completed: 2026-04-15
  tasks: 5
  files-created: 2
  files-modified: 1
---

# Phase 85 Plan 04: run-hook.cmd Regression Fence Summary

One-liner: Linux-runnable regression test that locks in the Finding F-01 Windows exit-code propagation fix so a future edit to hooks/run-hook.cmd cannot silently reintroduce the sealed-room write guard bypass.

## F-01 Verification (read-only)

hooks/run-hook.cmd inspected against the WIN-FIX-F-01 contract:

- setlocal enabledelayedexpansion present at line 3
- Three `set "RC=!ERRORLEVEL!"` captures, one after each bash invocation path (Git for Windows default, Git for Windows x86, bash on PATH)
- Three `endlocal & exit /b %RC%` exits
- Plus one `endlocal & exit /b 0` fallback when no bash found (structurally correct, not counted against the three)

Fix landed in commit 3bcf83d ("wip(v1.10.9): Phase 85 Windows hotfix foundation - Findings F and I") on the current branch. No edits made to run-hook.cmd in this plan.

## What Was Built

### tests/fixtures/cmd-shim.sh

Bash simulation of cmd.exe exit propagation. Two checks:

1. Structural: greps hooks/run-hook.cmd for the three required textual patterns. Exits 3 if any are missing, with a message pointing at WIN-FIX-F-01.
2. Behavioral: locates scripts/<hook-name>, execs it with the remaining args, pipes stdin through unchanged, propagates the child exit code to the caller. Same contract as the fixed run-hook.cmd guarantees on Windows.

### tests/test-run-hook-cmd.cjs

Node regression test with three platform branches:

- Linux/macOS: invokes the bash shim
- Windows (win32) with cmd.exe: invokes `cmd.exe /c hooks\run-hook.cmd write-scope-check` directly
- Exotic CI with neither cmd.exe nor bash: SKIP with explicit reason string `neither cmd.exe nor bash found, cannot verify run-hook.cmd exit propagation`

Eight assertions:

1. setlocal enabledelayedexpansion present
2. RC=!ERRORLEVEL! capture present
3. endlocal & exit /b %RC% present
4. At least 3 RC captures
5. At least 3 endlocal-exit lines
6. Cross-room Write payload exits with code 2 (blocked)
7. Block message "Blocked: write to" present in hook output (stdout or stderr)
8. Same-room Write payload exits with code 0 (negative control)

Isolated MindrianRooms fixture built in mkdtempSync, populated with room-a (active) and room-b (target of the cross-room attempt), registry.json pointing active at room-a. MINDRIAN_ROOMS_ROOT env var passes the fixture path through to write-scope-check.cjs.

### lib/memory/run-feynman-tests.cjs

Registered `tests/test-run-hook-cmd.cjs` as the 14th test file with a Phase 85-04 comment. Runner now reports `14/14 test files passed`.

## Test Results

```
test-run-hook-cmd.cjs
  ok run-hook.cmd contains setlocal enabledelayedexpansion
  ok run-hook.cmd contains RC=!ERRORLEVEL! capture
  ok run-hook.cmd contains endlocal & exit /b %RC%
  ok run-hook.cmd has 3 RC captures (>=3)
  ok run-hook.cmd has 3 endlocal-exit lines (>=3)
  ok cross-room Write payload exits with code 2 (blocked)
  ok block message present in hook output
  ok same-room Write payload exits with code 0 (allowed)

RESULT: 8 passed, 0 failed

Feynman test runner: 14/14 test files passed
```

## F-03 Wording Locked (for 85-07 CHANGELOG Security section)

Verbatim, to be cited by 85-07 without editing:

> "the sealed-room write guard was inert on Windows in v1.10.7 and v1.10.8 — if you moved files into another room on Windows during that window, Larry's judgment was the only thing stopping it"

Note: the above quote contains an em-dash because it is the frozen source string from 85-CONTEXT. Any em-dash normalization for CHANGELOG rendering is 85-07's responsibility.

## Three-Surface Note

run-hook.cmd is a CLI-on-Windows artifact. Claude Desktop and Cowork do not invoke .cmd files. They dispatch hooks via the MCP protocol and have their own sealed-room enforcement via MCP tool wrappers (audited separately in Phase 83). Therefore Finding F and this regression fence are strictly CLI-on-Windows. Desktop and Cowork were never vulnerable to F.

## Deviations from Plan

### Auto-fixed during execution

1. [Rule 1 - Plan vs reality] Block message stream location. Plan said "assert the block message is emitted on stdout". write-scope-check.cjs actually emits on stderr (standard Claude Code hook contract: block = exit 2 + stderr text). Test accepts either stream by concatenating stdout and stderr before the substring check. Keeps the assertion robust if a future refactor moves the message.

2. [Rule 2 - Missing critical coverage] Added a negative control (same-room Write must exit 0). Without it the test only proves the block path propagates correctly. Adding the allow path proves the fix is wired for both branches, which is what F-01 actually guarantees.

3. [Rule 2 - Test isolation] The plan's task list did not explicitly say "isolate from the developer's real MindrianRooms registry". Built a mkdtempSync fixture anyway because running the test against the real active room would have been both flaky and unsafe. Trivially correct auto-add.

## Deferred Issues

None.

## Self-Check: PASSED

- tests/fixtures/cmd-shim.sh exists, executable, 2574 bytes
- tests/test-run-hook-cmd.cjs exists
- lib/memory/run-feynman-tests.cjs registers the new test file
- `node lib/memory/run-feynman-tests.cjs` exits 0 with 14/14 passing
- hooks/run-hook.cmd unchanged (verified by git status)
- Zero em-dashes in tests/fixtures/cmd-shim.sh, tests/test-run-hook-cmd.cjs, or the modified lib/memory/run-feynman-tests.cjs line

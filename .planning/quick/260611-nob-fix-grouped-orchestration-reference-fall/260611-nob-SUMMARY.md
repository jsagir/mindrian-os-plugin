---
phase: quick-260611-nob
plan: 01
subsystem: mcp-orchestration, hooks
tags: [bugfix, mcp, tool-router, write-scope-check, tdd]
requires: []
provides:
  - "Grouped orchestration sub-commands (rooms-*, scout-*, act-*) resolve their family base reference"
  - "loadReference exported via module.exports._test for unit testing"
  - "Accurate rooms-root file classification + block message in write-scope-check"
affects: []
tech-stack:
  added: []
  patterns:
    - "Closed prefix map fallback (GROUPED_PREFIX_FALLBACK) instead of generic hyphen split, preserving the null contract for unknown commands"
    - "Classify-before-probe ordering: isRootLevelFile branch runs before isSealed to avoid probing GUARDRAIL.md under a file path"
key-files:
  created:
    - tests/test-tool-router-grouped-reference.cjs
  modified:
    - lib/mcp/tool-router.cjs
    - scripts/write-scope-check.cjs
    - test/83-write-scope-check.test.cjs
decisions:
  - "Exact-name lookups stay first in loadReference so a future per-subcommand file (e.g. commands/rooms-new.md) wins over the family fallback automatically"
  - "isRootLevelFile returns true on stat error for nonexistent depth-1 paths: creating a new root-level FILE is the case the hook must catch; new room dirs go through /mos:rooms new"
metrics:
  duration: "~4 minutes"
  completed: "2026-06-11"
---

# Quick Task 260611-nob: Fix Grouped Orchestration Reference Fallback Summary

**One-liner:** Grouped MCP sub-commands (rooms-new, scout-health, act-chain and 11 more) now fall back to their command-family reference file via a closed prefix map, and the write-scope hook blocks MindrianRooms root-level file writes with an accurate root-file message instead of the nonsense "/mos:rooms switch INDEX.md" remediation.

## What Was Done

### Task 1: Grouped-prefix fallback in loadReference (Bug A)

- Confirmed RED: tests/test-tool-router-grouped-reference.cjs failed on the `_test.loadReference` assertion (export was undefined).
- Added module-level `GROUPED_PREFIX_FALLBACK` constant in lib/mcp/tool-router.cjs mapping `'rooms-'`, `'scout-'`, `'act-'` to their family base names.
- Extended `loadReference()`: the two exact-name lookups (references/methodology, then commands/) stay first and unchanged; only after both miss does the prefix map resolve `commands/<family>.md`. No prefix match (or missing family file) still returns null.
- Added `loadReference` to the existing `module.exports._test` object (87-05 pattern). Primary `module.exports` line unchanged.
- GREEN: all 17 checks pass (export, exact 'rooms', 14 grouped sub-commands, unknown-command null contract).

### Task 2: Accurate rooms-root file classification in write-scope-check (Bug B)

- RED first: appended test case 8 to test/83-write-scope-check.test.cjs (root with active room alpha, Edit payload targeting root-level INDEX.md; asserts exit 2, /root file/i in stderr, and no 'switch INDEX.md'). Updated the header comment from seven to eight cases. Confirmed exactly case 8 failed (7/8) with the buggy 'switch INDEX.md' message.
- Added `isRootLevelFile(root, target)` helper next to `targetRoomUnderRoot` in scripts/write-scope-check.cjs: depth-1 segment check, statSync directory test, returns true on stat error (new root-level file creation is the case to catch).
- Inserted the root-file block branch in `main()` after the activeRoom null check and before `isSealed` (avoids the nonsense `root/INDEX.md/GUARDRAIL.md` probe and guarantees the root-file message wins). Block message names the target a MindrianRooms root file, states the rooms root is a shared routing surface not a room, never suggests switching to a filename, and tells the agent the edit can be applied with explicit user approval via a shell command or /mos:rooms maintenance.
- Sealed branch, cross-room branch, and all fail-open paths byte-identical.
- GREEN: 8/8 passed.

### Task 3: Full regression + scoped commit

- Both full suites green: tool-router-grouped-reference ALL PASS (exit 0), 83-write-scope-check 8/8 (exit 0).
- Em-dash scan across all four files: clean.
- Staged exactly the four plan files by explicit path; verified staged set before committing. Unrelated working-tree changes (.planning/config.json, .planning/seeds/INDEX.md, lib/hmi/dial-presenter.cjs, .umbilical, and other parallel-session files) left unstaged and untouched.

## Commits

| Commit | Message | Files |
| ------ | ------- | ----- |
| a392530d | fix: grouped orchestration reference fallback + accurate rooms-root write-scope message | lib/mcp/tool-router.cjs, scripts/write-scope-check.cjs, test/83-write-scope-check.test.cjs, tests/test-tool-router-grouped-reference.cjs |

Single scoped commit per the plan's Task 3 instruction (the plan's verify gate asserts the staged set equals exactly the four files in one commit, so Tasks 1 and 2 deferred their commit to Task 3).

## Verification

- `node tests/test-tool-router-grouped-reference.cjs` exits 0, ALL PASS (was RED on the `_test.loadReference` assertion before the fix)
- `node test/83-write-scope-check.test.cjs` exits 0, 8/8 passed (case 8 was RED before the fix, reproducing the 'switch INDEX.md' message)
- `git show --stat HEAD` lists exactly the four plan files (150 insertions, 2 deletions, no file deletions)
- No em-dash characters in any of the four files
- Part 8-neutral: zero network calls, Brain queries, or egress surface added; zero new dependencies; CJS only

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None. Both mitigations from the plan's threat model are enforced by tests: the closed prefix map resolves only to three fixed family files with the unknown-command null contract test-enforced (T-quick-01), and the write-scope change only adds a fail-closed block path with allow paths unchanged (T-quick-02).

## Self-Check: PASSED

- tests/test-tool-router-grouped-reference.cjs exists: FOUND
- Commit a392530d exists: FOUND
- Both suites green at HEAD: CONFIRMED

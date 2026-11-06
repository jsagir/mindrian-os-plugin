---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "09"
subsystem: session-start
tags: [rca, b4, session-start, dev-clone, shell-env]
status: complete
requires: ["386-01"]
provides:
  - the dev-clone topology probe in scripts/session-start sees PLUGIN_ROOT_FOR_RESOLVE as an environment variable
affects: []
key-files:
  created:
    - .planning/debug/session-start-env-assignment-after-node-e-dev-clone-branch-dead.md
    - tests/test-386-session-start-topology-env.cjs
  modified:
    - scripts/session-start
requirements: [B4]
decisions:
  - "Fix is a one-line move of the assignment before node. No other line of scripts/session-start changed."
metrics:
  tasks_done: 3
  tasks_total: 3
  completed: 2026-11-06
---

# Phase 386 Plan 09: B4 session-start env after node -e Summary

In scripts/session-start the `_MOS_TOPOLOGY` probe was written `node -e '<program>' PLUGIN_ROOT_FOR_RESOLVE="..."`. Bash passes that word to node as an argument, so the program read an undefined variable, threw, and printed not-found. The dev-clone pre-commit install branch therefore never ran. The assignment now sits before node.

## Skip rule

Target PRESENT (`target: PRESENT` in the RCA). No skip.

## Commits

- 0d6fa0e2d docs(386-09): RCA
- a9c756075 test(386-09): RED, T1 fails, T2 and T3 pass
- 5551afcec fix(386-09): GREEN, one line in scripts/session-start
- aec3a86cb docs(386-09): RCA resolution block

## Reproduction (PROVEN, scratch fixture)

| Variant | env sees | argv sees | Topology |
|---------|----------|-----------|----------|
| assignment after program (old) | undefined | the VAR=value word | not-found |
| assignment before node (new) | the root path | empty | dev-clone |

## Verification (PROVEN)

- `node tests/test-386-session-start-topology-env.cjs`: T1 T2 T3 ok (RED: T1 FAIL).
- `bash -n scripts/session-start`: ok.
- node tests/test-341-session-start-tier.cjs, test-341-session-start-verify-hook.cjs, test-k1u-session-start-envelope.cjs, test-209-session-start-exemplar.cjs, test-267.3-session-start-declaration.cjs: all exit 0 (also exit 0 before the change, baseline taken first).
- `bash tests/run-all-386.sh`: PASS=8 FAIL=0 (includes peer test files present at run time).
- `git diff --stat` for scripts/session-start: 1 line changed.
- The real scripts/session-start and scripts/install-pre-commit.sh were never run. The test runs only the extracted line in a child bash with a temporary HOME.

## What turns on

On a dev clone, on a version change, session-start now runs scripts/install-pre-commit.sh. It is idempotent (cmp then atomic copy of the canonical guard hook). scripts/setup-hooks.sh already installs the same hook every session, so the added effect is small. Nothing changes on a marketplace install.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test extraction regex widened in the GREEN commit**
- **Found during:** Task 3
- **Issue:** the RED test matched `_MOS_TOPOLOGY=$(node -e `. After the fix the line reads `_MOS_TOPOLOGY=$(PLUGIN_ROOT_FOR_RESOLVE=... node -e `, so the extraction would find nothing and T1 would fail for the wrong reason.
- **Fix:** the regex accepts the env prefix before node. Test file committed with the fix.
- **Commit:** 5551afcec

No other deviations. Same-pattern search of scripts/ and hooks/ found no other hit.

## Known Stubs

None.

## Self-Check: PASSED

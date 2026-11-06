---
phase: 387-eureka-reachable-on-a-normal-install
plan: "10"
subsystem: eureka-part-8-live-leak-test
tags: [part-8, leak-test, strace, owner-run, tdd]
requires: ["387-06", "387-09"]
provides:
  - "tests/helpers/leak-test-387.cjs (strace connect parser, tree snapshot and diff, marker scan, synthetic marker snapshot)"
  - "tests/helpers/leak-driver-387.cjs (one graph call through the plugin's real call path)"
  - "tests/test-387-eureka-live-leak.cjs (opt-in live arms L9 and L10; exit 77 without the opt-in)"
  - ".planning/phases/387-eureka-reachable-on-a-normal-install/387-LEAK-RUNBOOK.md (owner runbook)"
affects: [387-08]
key-files:
  created:
    - tests/helpers/leak-test-387.cjs
    - tests/helpers/leak-driver-387.cjs
    - tests/test-387-eureka-leak-parsers.cjs
    - tests/test-387-eureka-live-leak.cjs
    - .planning/phases/387-eureka-reachable-on-a-normal-install/387-LEAK-RUNBOOK.md
key-decisions:
  - "Strace rows of another family (AF_NETLINK, AF_UNSPEC) count as local: only AF_INET and AF_INET6 addresses can be non-local."
  - "A rewrite with identical content does not count as a change in the tree diff; folder times are ignored, only presence counts."
requirements-completed: [EUR387-05]
completed: 2026-11-06
---

# Phase 387 Plan 10: Owner-run live leak test and runbook Summary

The owner now has one command that measures the real engine's network and write behavior with a planted marker, and the parts that need no engine are tested on every run. THE REAL ENGINE WAS NOT RUN. THE LIVE ARMS (L9 AND L10) ARE UNVERIFIED.

## What was done (TDD)

- Decision gate: the six record lines in 387-DECISION-RECORD.md matched option A.
- RED (dcd9d5617): tests/test-387-eureka-leak-parsers.cjs, 8 arms, all 8 printed FAIL (helpers, live test and runbook absent).
- GREEN helpers (f11cdc06d): L1 to L6 pass; the driver smoke (--root /nonexistent) exits 1 with the engine_checkout_unavailable refusal, writes the result file with mode 600 and starts no process.
- GREEN live test and runbook (ac8fa2d58): L7 and L8 pass.

## Verified (PROVEN, run in this tree)

- `node tests/test-387-eureka-leak-parsers.cjs`: 8 passed, 0 failed (synthetic strace text, temp folders, node only).
- `env -u MINDRIAN_EUREKA_LIVE_LEAK node tests/test-387-eureka-live-leak.cjs`: exit 77, "SKIPPED (ENV GAP): MINDRIAN_EUREKA_LIVE_LEAK is not 1 ...".
- `bash tests/run-all-387.sh`: PASS=12 FAIL=0 SKIPPED=1. The one SKIPPED is the live leak test (exit 77, opt-in absent). The dash fence passes.
- `node --check tests/test-387-eureka-live-leak.cjs`: syntax ok. No em dash or en dash in any new file.

## UNVERIFIED (not run)

- The real engine was not run. No agent set MINDRIAN_EUREKA_LIVE_LEAK or MINDRIAN_EUREKA_ROOT for this plan and the live test file never assigns them (arm L7 checks that).
- The live arms are UNVERIFIED: L9 (strace connect trace, scratch HOME, data and cache folders, tree diff, marker scan on the real sqlite files) and L10 (engine tests/conftest.py no_network fixture check). The body of the live test after the gates was reviewed and syntax-checked but never executed, so a defect in it could only show on the owner's machine.
- The engine's own no_network pytest run: nobody has run it.
- Whether the real engine clears the saved request after a terminal job, whether it connects anywhere, and where it writes: all hypotheses from the two engine audits.
- strace and unshare were not used by any agent.

## Deviations from Plan

**1. [Rule 1 - Gap in the contract] diffTrees needs absolute paths.** The contract says snapshotTree keys are relative paths and `allowed` holds absolute prefixes. Each snapshot value therefore also carries `abs`, and the diff entries are objects `{ path, abs, type }`. The tests read `path`.

**2. [Rule 2 - Safety] Extra live-test gates.** The test also exits 77 when strace may not trace here (ptrace denied) and when a folder is too large to snapshot (cap 400000 entries), each with a named reason, so a machine limit never shows as a leak. A call that did not complete prints FAIL, because the four criteria prove nothing then.

**3. Commit location.** This directory is a git worktree on branch main by task order; the worktree-agent branch guard was not applied.

## Known Stubs

None.

## Threat Flags

None. The live test spawns only strace, unshare and node with argument arrays and shell false; it opens no network connection itself. The snapshot and the marker are synthetic.

## Self-Check: PASSED

- Files exist: both helpers, both tests, the runbook.
- Commits exist: dcd9d5617, f11cdc06d, ac8fa2d58.

---
phase: 370-review-contract-for-mos-grade-and-mos-deep-grade-fixed-stude
plan: 08
subsystem: review-contract
tags: [review-contract, cli-wrapper, pre-file-check, tdd]
requires: [370-02, 370-04]
provides:
  - scripts/check-review-contract.cjs (the pre-file CLI wrapper, subcommand check)
  - tests/test-370-wrapper.cjs (arms W1 to W8)
affects: [370-09, 370-10, 370-11]
key-files:
  created:
    - scripts/check-review-contract.cjs
    - tests/test-370-wrapper.cjs
  modified: []
key-decisions:
  - "Violation line form is: VIOLATION <rule> <class> line <n> tier <tier>. The plan form (rule, class, line) is kept as the prefix; the tier is added at the end because the dispatch asked for rule, tier, class and line."
  - "Soft-term exemption (owner item O3, EXEMPT-IF-IN-SOURCE) is passed as --source; a directory source goes through collectSourceText, a file is read as text; --source may repeat."
  - "The wrapper reads stdin in 64 KB chunks and exits 3 as soon as the total passes 1000000 bytes, so it never drains unbounded input."
requirements-completed: [REV370-08]
completed: 2026-11-08
---

# Phase 370 Plan 08: Pre-file CLI wrapper Summary

A command with a shell can now run a draft review through `check-review-contract.cjs check` before it files the review and get a text-free list of what to fix. The wrapper and the module agree on every violation (arm W6).

## Gates (PROVEN)

`370-gate.cjs gate-group` for G1: exit 0 (O1=WITHHOLD, O2=KEEP, O4A=DROP, O4B=ANONYMIZE). For G2: exit 0 (O3=EXEMPT-IF-IN-SOURCE).

## Commits

| Commit | Files |
|--------|-------|
| dced47e73 | tests/test-370-wrapper.cjs (RED) |
| 9261b859f | scripts/check-review-contract.cjs (GREEN) |

Not pushed. No tag, no version change, no dist regeneration.

## What was built

- Switch-case router on `process.argv[2]`: `check`, `--check` (reserved, prints "static check not available yet (plan 370-10)" on stderr, exit 3), anything else prints a usage line and exits 3.
- `check <file|-> [--source <path>]... [--repo-root <dir>]`. Output: `OK review-contract v<n>` (exit 0) or one `VIOLATION` line per violation, an `EXPECTED-HEADINGS` line when a shape rule failed (six contract headings in order, then the tail heading marked optional), and `RESULT FAIL <count>` (exit 1).
- Output holds rule, class, line and tier only. No body text, no heading text from the review, no matched term (T-370-38). Arm W1 checks the nine planted strings are absent from stdout and stderr.
- Input over 1000000 bytes: exit 3 with a size line, for a file (stat) and for stdin (bounded read) (T-370-39).
- Requires node built-ins and `../lib/core/review-contract.cjs` only. No Brain require (0 non-comment lines with `brain-client`). No new framework, command, agent, skill or MCP tool.
- Path anchoring: the usage text in the header comment shows the call as `node "${CLAUDE_PLUGIN_ROOT}/scripts/check-review-contract.cjs"`. Plan 370-09 must use the same anchored form in the commands.

## TDD record

RED (dced47e73), `node tests/test-370-wrapper.cjs` before the script existed:

```
FAIL W1 ... cannot find scripts/check-review-contract.cjs (check-review-contract wrapper missing; plan 370-08 creates it)
... (W2 to W8 the same)
PASS: 0 FAIL: 8
```

GREEN (9261b859f):

```
ok W1 ... W8
PASS: 8 FAIL: 0
```

## Verification (PROVEN unless noted)

- `node tests/test-370-wrapper.cjs`: PASS 8 FAIL 0.
- `bash tests/run-all-370.sh`: my test and 8 others pass (answers, check-rules, contract-schema, denylist-from-disk, filedoor, fixtures, skill mirrors, no-dash fence). One failure: `test-370-reference-drift.cjs` arms D5, D6, D7, D10. That test and agents/grading.md belong to plan 370-07 (a peer executor, uncommitted at the time of the run). It failed on two runs a few minutes apart. It is not caused by this plan. The suite exit code is therefore 1 until plan 370-07 lands its agent edits.
- Part 11 gates: `build-connector-registry --check` exit 0, `build-orchestration-projection --check` exit 0, `check-render-coverage` exit 0.
- `check-plugin-path-anchoring --check` exit 0 (OK); `--check-scripts` exit 0 (OK).
- Non-ASCII bytes in both files: 0 (grep -P). Non-comment `brain-client` lines in the script: 0.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Spec addition] Tier added to the VIOLATION line.** The plan line form was `VIOLATION <rule> <class> line <n>`. The dispatch asked for rule, tier, class and line. The form is now `VIOLATION <rule> <class> line <n> tier <tier>`, so a reader of the plan form still matches the prefix. W6 compares all four fields with the module.

**2. [Scope] Plan 370-07 test fails in the phase suite.** Not fixed (out of scope, a peer owns it). Logged here for the verifier.

## Notes for later plans

- Plan 370-09: call the wrapper as `node "${CLAUDE_PLUGIN_ROOT}/scripts/check-review-contract.cjs" check <draft> --source <room section folder>` and parse exit codes 0, 1, 3.
- Plan 370-10: add the static `--check` branch to the `--check` case of the router.
- Plan 370-11: run `bash tests/run-all-370.sh` with `TEST_370_REQUIRE_ALL=1` after plan 370-07 is committed.

## Known Stubs

None.

## Threat Flags

None. The wrapper writes nothing, reads only the paths the caller names, makes no network call.

## Self-Check: PASSED

Files exist: scripts/check-review-contract.cjs, tests/test-370-wrapper.cjs. Commits exist: dced47e73, 9261b859f.

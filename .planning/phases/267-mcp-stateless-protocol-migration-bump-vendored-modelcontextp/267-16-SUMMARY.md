---
phase: 267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp
plan: 16
subsystem: test-migration
tags: [mcp, v2, v1-removal, phase-354-tests]

requires:
  - phase: 267-15
    provides: in-repo clients on v2; no server or client code imports v1
provides:
  - six tests/test-354-*.cjs files and two docs/reviews/phase-354-probes scripts on the v2 packages
affects: [267-17 (v1 removal), run-all-354]

key-files:
  modified:
    - tests/test-354-concurrency-surfaces.cjs
    - tests/test-354-egress-typed-question.cjs
    - tests/test-354-extract-shallow-contract.cjs
    - tests/test-354-registration-diagnostics.cjs
    - tests/test-354-room-symlink-containment.cjs
    - tests/test-354-theo-journey.cjs
    - docs/reviews/phase-354-probes/registration.cjs
    - docs/reviews/phase-354-probes/resources.cjs

key-decisions:
  - "Require lines only: v2 import map (McpServer, InMemoryTransport from server; Client from client; StdioClientTransport from client/stdio) is a drop-in for every call these files make (connect, callTool, listTools, readResource, createLinkedPair); no assertion or fixture-tool registration needed to change"

requirements-completed: [MCPV2-18]

duration: ~15min
completed: 2026-10-02
---

# Phase 267 Plan 16: Phase 354 test and probe migration Summary

**Eight Phase 354 harness files now require the v2 packages instead of @modelcontextprotocol/sdk; the diff in each is the require lines only, with zero assertion lines touched, and every verdict matches its pre-migration run.**

PLAN_BASE=38a85d3d09161354dda5d9c1836415cf80ddff3e

## Commits

- 8c1e20784 test-354 concurrency-surfaces
- a58973ac8 test-354 egress-typed-question
- 7e006b9a3 test-354 extract-shallow-contract
- 6e29edabe test-354 registration-diagnostics
- b367aba45 test-354 room-symlink-containment
- 9ec5e74ba test-354 theo-journey
- e1b5cd74b phase-354 probes (registration.cjs, resources.cjs)
- c2958bd18 theo-journey header comment no longer names the v1 package

## Per-file changes and outcomes (hermetic HOME and rooms home)

| File | Lines changed | Before | After |
|------|---------------|--------|-------|
| test-354-concurrency-surfaces | 2 requires (client, client/stdio) | exit 1, K4 threw (re-run on v1 copy today) | exit 1, identical: 1 of 19 failed, K4 only |
| test-354-egress-typed-question | 2 requires | PASS 46/46 | PASS 46/46 |
| test-354-extract-shallow-contract | 3 requires to 2 | PASS 13 | PASS 13 |
| test-354-registration-diagnostics | 3 requires to 2 | PASS 12 | PASS 12 |
| test-354-room-symlink-containment | 3 requires to 2 | PASS 10 | PASS 10 |
| test-354-theo-journey | 3 requires to 2, 1 comment | PASS 15/15 | PASS 15/15 |
| probes/registration.cjs | 1 require | 3 output lines | 3 lines, byte-identical (after stripping the node pid) |
| probes/resources.cjs | 3 requires to 2 | 6 output lines | 6 lines, byte-identical |

Assertion gate: `git diff 38a85d3d0 -- <file> | grep '^[-+]' | grep -c assert` is 0 for all eight files.

## Verification

- `grep -v '^\s*//\|^\s*\*' tests/test-354-*.cjs docs/reviews/phase-354-probes/*.cjs | grep '@modelcontextprotocol/sdk'` is empty ("no v1 in 354 set" printed).
- `bash tests/run-all-354.sh` (hermetic): PASSED=14 FAILED=5 SKIPPED=1. The 5 reds: concurrency surfaces (K4 Playwright), chat inert render, POC save origin, POC room journey (all three: Playwright chromium missing, ENV, files not touched here), framework command ledger (known T2 baseline). None is a file migrated here except concurrency-surfaces, whose verdict is unchanged.
- The shared pipelined `rpcOverStdio` helper was not used by any migrated test; no sequential-driving change was needed.

## Deviations from Plan

**1. [Baseline note] concurrency-surfaces is red, not PASS (25 checks).** 267-BASELINE.md records PASS, but K4 now throws on a missing Playwright chromium (known ENV red from the task context). To prove the harness migration did not change the verdict I ran the HEAD (v1) copy alongside: identical output ("FAIL - 1 of 19 checks failed", K4 only). The other 18 checks pass on v2.

**2. [Cosmetic] theo-journey header comment** reworded so the sdk grep is empty even in comments (extra commit c2958bd18).

No peer-description snapshot refresh was needed (none touched). No production files, no STATE/ROADMAP edits.

## Remaining v1 importers (for 267-17 and later)

Still referencing @modelcontextprotocol/sdk, outside this plan: tests/test-248-surface-probes.cjs, test-257-strict-input-shapes, test-265-gate-render-elicit-schema, test-276-claim-write-primitive, test-267-* tests (comment/ledger strings), lib/mcp/gate-render.cjs, lib/mcp/tree-watcher.cjs, lib/core/brain-client.cjs, lib/core/mcp-dep-heal*.cjs, bin/mindrian-brain-mcp-client.cjs, scripts/build-brain-packet-schema.cjs, scripts/fork359-permission-probe.cjs. Some are string or comment mentions; 267-17 must triage code requires from text.

## Auth gates

None.

## Known Stubs

None.

## Threat Flags

None. T-267-34 held (verdicts unchanged, no assertion edited); T-267-09 held (egress and theo-journey stay hermetic, only imports changed).

## Self-Check: PASSED

- All eight migrated files FOUND; commits 8c1e20784, a58973ac8, 7e006b9a3, 6e29edabe, b367aba45, 9ec5e74ba, e1b5cd74b, c2958bd18 FOUND on main.

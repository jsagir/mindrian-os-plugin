---
phase: 374-adapter-surface-completion-remaining-eureka-graph-tools-capa
plan: 03
subsystem: mcp-approval-gate
tags: [approval-gate, refactor, canon-part-3, canon-part-7, canon-part-8, eureka]
requires: []
provides:
  - lib/mcp/approval-gate.cjs (mintApprovalGate, the one shared approval gate minter)
  - resolve receives its own gate id as a third argument { gate_id }
affects: [lib/mcp/tools/research.cjs, tests/test-341-eureka-no-brain-reach.cjs, tests/test-387-eureka-egress.cjs]
key-files:
  created: [lib/mcp/approval-gate.cjs, tests/test-374-approval-gate.cjs]
  modified: [lib/mcp/tools/research.cjs, tests/test-341-eureka-no-brain-reach.cjs, tests/test-387-eureka-egress.cjs]
requirements-completed: [PLG374-02]
---

# Phase 374 Plan 03: Shared approval gate Summary

mintApprovalGate moved out of research.cjs into lib/mcp/approval-gate.cjs (body moved, not rewritten); spec.resolve now receives { gate_id } as a third argument; the new module is guarded by the Part 8 scan lists from this plan on.

## RED line (kept)

- Before the module existed, `node tests/test-374-approval-gate.cjs` printed `test-374-approval-gate: 0 passed, 9 failed` (every arm: `Cannot find module .../lib/mcp/approval-gate.cjs`).
- Guard tests, after adding the module to both scan lists and before creating it: `eureka-no-brain-reach: PASS=21 FAIL=2` (module must exist) and `test-387-eureka-egress: 21 passed, 1 failed` (`lib/mcp/approval-gate.cjs: guarded module is missing`).
- After the module: 9 passed, 0 failed; PASS=23 FAIL=0; 22 passed, 0 failed.

## What changed

- `lib/mcp/approval-gate.cjs`: exports only `mintApprovalGate`. Carries its own `list`, `noDash`, `refuse`; calls `gateRender.detectGateCapabilities` directly. New variable `gateIdRef` is set when renderGate returns; resumeFn calls `spec.resolve(chosen, answer, { gate_id: (answer && answer.gate_id) || gateIdRef })` on both the gate_answer path and the inline elicitation path.
- `lib/mcp/tools/research.cjs`: local minter deleted (about 80 lines), `require('../approval-gate.cjs')` added. The helpers `list`, `noDash`, `refuse` and `detectClientCapabilities` stay: each is still used elsewhere in the file (detectClientCapabilities at the capabilities read and in `_internal`). `_internal.mintApprovalGate` is the imported function. The three call sites (grant_request, deep_plan, basket) are unchanged and ignore the new argument.
- `tests/test-374-approval-gate.cjs`: arms A1 to A9.
- `tests/test-341-eureka-no-brain-reach.cjs`: `lib/mcp/approval-gate.cjs` added to EUREKA_SURFACE_FILES.
- `tests/test-387-eureka-egress.cjs`: new `LIB_MCP_EXTRA = ['approval-gate.cjs']`, scanned by `staticProblems()` with the existing rules; a missing file is a problem. Plan 374-06 appends `eureka-pair-screen.cjs`.

## Baseline before and after (exit codes)

The 13 tests the plan names, then every other test file that references research_run or tools/research.cjs (excluding fixtures and run-all scripts), plus test-270.

| Test | Before | After |
|------|--------|-------|
| test-289-review-fixes.cjs | 0 | 0 |
| test-363-mcp-tool.cjs | 0 | 0 |
| test-364-mcp.cjs | 0 | 0 |
| test-366-mcp-release-route.cjs | 0 | 0 |
| test-366-mcp-plan-only.cjs | 0 | 0 |
| test-366-eureka-alias.cjs | 0 | 0 |
| test-seed104-grant-family-loop.cjs | 0 | 0 |
| test-seed103-eureka-perspective.cjs | 0 | 0 |
| test-365-never-do-gate.cjs | 1 | 1 |
| test-3696-operation-doctrine.cjs | 0 | 0 |
| test-desktop-stdio-session-binding.cjs | 0 | 0 |
| test-363-acceptance-whitespace.cjs | 0 | 0 |
| test-355-naming-honesty.cjs | 0 | 0 |
| test-198-contract-schema.test.cjs | 0 | 0 |
| test-289-contract-recommended.cjs | 1 | 1 |
| test-314-mcp.cjs | 0 | 0 |
| test-355-floor-sweep.cjs | 0 | 0 |
| test-363-command-contract.cjs | 0 | 0 |
| test-363-part8-sweep.cjs | 0 | 0 |
| test-363-runner-contract.cjs | 1 | 1 |
| test-364-command-contract.cjs | 0 | 0 |
| test-366-mcp-perspective-ops.cjs | 0 | 0 |
| test-366-offline-recall.cjs | 0 | 0 |
| test-366-router-redirects.cjs | 0 | 0 |
| test-3692-judge-line.cjs | 0 | 0 |
| test-387-eureka-command-wiring.cjs | 0 | 0 |
| test-eureka-mcp-tools.cjs | 0 | 0 |
| test-mux-card-before-answer.cjs | 1 | 1 |
| test-research-run-session-binding.cjs | 0 | 0 |
| test-vi3-icm-walk.cjs | 1 | 1 |
| test-270-tool-schema-budget.cjs | 0 | 0 |

Result: all 31 exit codes are equal. The 13 named tests are all 0 before and after, except test-365-never-do-gate.cjs (1 before, 1 after). Five tests were red before this plan and have the same single failing line after it (compared by output): test-365-never-do-gate (N12 gate.cjs byte-identical to GATE_BASE), test-289-contract-recommended (one live contract path), test-363-runner-contract (K6 scheduled-tasks.md pointer), test-mux-card-before-answer (S3 mintGate call sites store a renderer), test-vi3-icm-walk (I8c BRAIN.md). None is caused by this plan.

Other checks: `node scripts/build-connector-registry.cjs --check` exit 0; `node scripts/check-render-coverage.cjs` exit 0; `grep -rn "function mintApprovalGate" lib | wc -l` prints 1; no non-ASCII bytes in the five touched files (grep -P check).

## Deviations from Plan

**1. [Rule 1 - plan wording] Arm A6 asserts a replay, not unknown_gate.** The plan says a second gate_answer for the same gate is `unknown_gate`. In the real code the first answer is saved in the room, so the second gate_answer returns `ok` with `replayed: true` and runs nothing. The arm asserts the real property: resolve runs once, the ledger no longer holds the gate, consumeGate hands out no resumeFn, and the second answer is `replayed: true` or `unknown_gate`. The single-use guarantee (T-374-09) is pinned.

**2. Tool write hygiene.** The Write tool turned the unicode escape sequences in the noDash regex of the first draft of approval-gate.cjs into literal en and em dash characters. Found by the ASCII grep, fixed back to the escape form of the original. Final file is ASCII.

## Left alone

The three one-line delegate copies of `detectClientCapabilities` in stop-gate.cjs, chain.cjs and sensors.cjs (and the one in research.cjs, still used) are out of scope. The new module does not add a fourth: it calls `gateRender.detectGateCapabilities` directly.

## Known Stubs

None.

## Threat Flags

None. The new module has no network, Brain, Theo or child_process reach (arm A8 and both scan lists).

## Threat model status

T-374-08, T-374-09, T-374-10 mitigated (arms A2, A3, A6; baseline above). T-374-03: commit uses git add -f on exact paths and git commit --only.

## Not done here

No dist regeneration, no push, no tag, no STATE.md, ROADMAP.md or REQUIREMENTS.md write. Plan 374-06 must append `eureka-pair-screen.cjs` to LIB_MCP_EXTRA.

## Self-Check

Files present: lib/mcp/approval-gate.cjs, tests/test-374-approval-gate.cjs, this file. Commit hash recorded in the hand-off report.

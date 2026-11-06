---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "22"
subsystem: egress-gate
tags: [part8, web-paths, approval-token, audit-ledger, e-gate]
requires: ["386-01"]
provides:
  - lib/core/web-path-gate.cjs (approvalToken, checkApproval, credentialCheck, recordSent, CLI)
  - semantic_scholar, grants_gov, google_search registered as web providers in the audit ledger
affects: [386-05, 386-23, 386-24, 386-31]
tech-stack:
  added: []
  patterns: [token over the exact strings with no store; credential check only on web lines]
key-files:
  created:
    - lib/core/web-path-gate.cjs
    - tests/test-386-web-path-gate.cjs
    - .planning/debug/web-paths-no-approval-or-audit-record.md
  modified:
    - lib/core/research-planner/egress-policy.cjs
    - data/egress-policy.json
key-decisions:
  - "Part 7 reuse decision: option (c), a sha256 token over the sorted unique q hashes; the planner run grant (bound to plan families and q_hash sets) and the gate_answer receipt (in-memory Map in the MCP process) are not reused."
requirements-completed: [E-GATE]
duration: 45min
completed: 2026-11-06
---

# Phase 386 Plan 22: Shared web-path gate Summary

One shared gate module now serves the 3 older web paths. The paths are not wired yet: plans 386-05, 386-23 and 386-24 call it.

## Measurements (PROVEN, from the RCA)

- appendAudit for semantic_scholar, grants_gov, google_search and unknown_provider before the change: egress_line_off (4 of 4). openalex: ok.
- Shared web credential check before the change: refuses 2 of 10 fake credential shapes (Bearer header, api_key= parameter). The 3 ordinary strings (person name, city, company) pass 3 of 3. Plan 386-31 widens the shapes; this plan adds no private shapes.
- Calls to any audit, approval or ledger function in the 3 older paths: 0.

## Part 7 reuse decision

Option (c). All 4 reasons were checked by reading and marked PROVEN in the RCA (run grant bound to plan families and hashes; standing scope openalex only; gate receipt store is an in-memory Map in the MCP process and research-speaker is a bash script; the token makes a changed string need a new approval). No NEEDS_HUMAN stop was needed.

## Task Commits

1. Task 1, RCA: 8c3a13c24
2. Task 2, failing test (RED, GW1 to GW7 all FAIL): 265bc2475
3. Task 3, module and 3 providers (GREEN): d6dbe9abe

## Verification

- node tests/test-386-web-path-gate.cjs: GW1 to GW7 pass; fetch counter 0.
- node tests/test-363-audit-ledger.cjs 5/5; test-366-egress-policy.cjs 24/24; test-3692-grant-card.cjs 9/9; also test-366-gated-term-release 28/28, test-366-mcp-release-route 13/13, test-3692-judge-line 8/8, test-3692-web-lines 17/17 (the extra four read the egress policy and were run for safety). All were green before and after.
- bash tests/run-all-386.sh: all listed tests PASSED.

## Deviations from Plan

None.

## Known Stubs

None. The module has no caller in this plan by design.

## Threat Flags

None. The module adds no network call and no new store.

## Self-Check: PASSED

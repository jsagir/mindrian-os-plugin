---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "23"
subsystem: egress-gate
tags: [part8, funding-search, approval-token, audit-ledger, scheduled-scan]
requires: ["386-01", "386-22"]
provides:
  - scanOpportunities(roomDir, opts) with approval_required, credential refusal, audit record
  - scheduled scan typed skip approval_required
affects: [386-21]
tech-stack:
  added: []
  patterns: [token over the exact strings; credential check only; one audit record per request]
key-files:
  created:
    - tests/test-386-grants-gov-approval.cjs
    - .planning/debug/grants-gov-scan-sends-room-words-without-approval.md
  modified:
    - lib/core/opportunity-ops.cjs
    - lib/core/scheduled-scanner.cjs
    - lib/mcp/tool-router.cjs
    - scripts/mindrian-tools.cjs
    - agents/opportunity-scanner.md
key-decisions:
  - "Owner decision 2026-11-06: approval first, credential check, audit record, no content scan. The unattended scan stops until an approval exists."
requirements-completed: [E-GG]
completed: 2026-11-06
---

# Phase 386 Plan 23: Funding search behind the web-path gate Summary

The funding search sends nothing until a call carries the approval token of its exact strings. Each sent string is checked for a credential and gets one audit record. The scheduled scan skips with a typed reason.

## Traced words (PROVEN)

- The keyword is the domain keywords from STATE.md plus up to 3 words from the first sentence of the problem text. It has at most 100 characters.
- Both endpoints get that keyword (body key keyword and body key query). The funding category codes in one body come from a fixed map, not from room words.
- Before the fix: 2 requests per call, the marker word in both bodies, no audit file.

## Task Commits

1. RCA: 0149225cd
2. RED test (GG1 to GG8 all FAIL): ce05bffaf
3. Fix (GREEN): 0e5fc4523

## Verification

- node tests/test-386-grants-gov-approval.cjs: GG1 to GG8 pass. No approval, wrong token or credential-shaped keyword: 0 requests. Approved: 2 requests, 2 audit records.
- bash tests/run-all-386.sh: 21 of 21 pass. test-363-audit-ledger 5 of 5.
- test-363.1-agent-isolation, test-250-doctrine-fence, test-276-room-content-honesty, test-265-scout-competitor-fanout, test-scout-cadence-fires and tests/test-phase-13.sh (32 of 32): pass.
- build-connector-registry --check pass; check-render-coverage 0 unwired.

## Deviations from Plan

None in code. Two details to note:

- The credential check runs before the approval listing as well as before the send, so a credential-shaped keyword is never shown on a card or echoed (the plan placed the check at send time).
- The MCP route takes the token in the existing section argument of data_room scan-opportunities. The CLI takes --approve TOKEN.

## Deferred Items

- tests/test-connector-part8-boundary.cjs CHECK 2 fails on the registry field "layer" of connector mcp:artifact_file. The plan did not touch the registry or the dispatch map. Not fixed (out of scope).

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "25"
subsystem: egress-guard
tags: [part8, typed-theo, allow-arms, e-typed]
requires: ["386-01", "386-04", "386-37"]
provides:
  - TYPED_READ_TOOLS table and _proveTypedReadShape in lib/core/part8-egress-guard.cjs
  - freeform typed route (search, classify_problem_type) decided by theoVerdict as brain_ask is
affects: [386-27, 386-28, 386-31, 386-33]
key-files:
  created:
    - tests/test-386-typed-theo-allow-arms.cjs
  modified:
    - lib/core/part8-egress-guard.cjs
    - .planning/debug/part8-egress-guard-blocks-pws-brain-mcp-unconditionally.md
key-decisions:
  - "Handle tools are proved by exact key set and closed sets (canonical handle, command slug, integer range, closed op enum). No word list."
  - "Freeform typed tools get parity with brain_ask through theoVerdict. A credential-shaped opaque token (one token of 32 or more characters) blocks first, because a credential is a sprout by shape."
requirements-completed: [E-TYPED]
completed: 2026-11-06
---

# Phase 386 Plan 25: Allow arms for the typed Theo read tools Summary

The typed Theo read tools now classify allow when shape-checked. The PENDING root cause of the pws-brain-mcp "unconditional block" is written and the debug file is resolved.

## Root cause (PROVEN)

classify() had allow arms for 9 tool shapes. Every other typed read tool fell to ambiguous/unknown. The hook blocks ambiguous on the direct connector mcp__pws-brain-mcp__* whatever the payload says (exit 2), and passes it on shim-backed scopes (exit 0, no proof). Same payload, same verdict, two different hook outcomes by route only. Before: pws-brain-mcp normalize_framework_name exit 2. After: exit 0.

## What changed

- 7 typed tools with arms: normalize_framework_name, discover_structure, orchestration_readiness, feeds_into_chains, framework_concepts (handle), search and classify_problem_type (freeform), brain_ask op mode (closed op, handle params).
- Step 1 (default-deny scan), 1b, 1c and the terminal ambiguous return are unchanged. The new code sits after the free-form branch and after _proveKnownToolShape.

## Verification (PROVEN)

- tests/test-386-typed-theo-allow-arms.cjs: RED (12 FAIL, pins passed), then GREEN (18 ok).
- Corpus gate: DELTA lines identical before and after (ext.blocked_no_room 37, negatives.leaks [], GATE PASS, MEASURED_SHA256 unchanged). Baseline not stamped.
- run-all-196 (7 pass), test-260906-fda, test-361-egress-shapes, test-354-egress-typed-question, test-223, test-355, test-247-contract-client: pass.
- run-all-386: 17 pass, 1 fail: test-386-semantic-scholar-approval.cjs. That is the RED test of plan 386-05 (not run yet), unrelated to this plan.

## Deviations from Plan

**1. [Plan text vs Theo schema] classify_problem_type takes no parameters at Theo.** The plan listed a `statement` argument. Theo's schema is an empty strictObject. The empty payload already allowed. A `statement` string is decided by theoVerdict (parity, as the plan says); Theo refuses the key, so no live channel is added. Recorded in the RCA.

**2. [Rule 2] Credential check on the freeform typed route.** Test TB7 needs a credential-shaped token to block on search and classify_problem_type. brain_ask allows a letters-only token today (generic_question). Added a shape rule on the typed route only (`_hasOpaqueSecretToken`, one token of 32 or more characters). Plan 386-31 adds the full credential shape list to the Canon scan for every route, including brain_ask.

**3. Not covered by arms (stay ambiguous):** load_framework, intra_framework_flow, find_bottlenecks, rank_influence, find_whitespace, structural_neighbours. The plan names a minimum set; these need a schema row and a test.

## Known behavior change for plan 386-27

`search` called through callTool now gets block for a body or private claim (it was ambiguous and proceeded). callTool passes roomDir null for non-free-form tools, so there is no lexicon check on that path yet.

## Commits

- RCA: 244423288
- RED test: a4c934e67
- Fix: 529ebdbbe

## Self-Check: PASSED

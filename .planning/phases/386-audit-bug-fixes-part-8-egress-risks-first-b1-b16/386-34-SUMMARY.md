---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "34"
subsystem: part8-egress
tags: [part8, tests, mutation-proof, exact-verdicts]
requires: [386-25, 386-27, 386-28, 386-30, 386-31, 386-33]
provides:
  - exact verdict and class assertions in five Part 8 test files
  - a verdict mutation preload and a mutation proof test
affects: []
key-files:
  created:
    - tests/test-386-guard-test-mutation-proof.cjs
    - tests/helpers/part8-verdict-mutation-386.cjs
    - .planning/debug/part8-tests-assert-not-allow-only.md
  modified:
    - tests/test-gct-process-step-id-parity.cjs
    - tests/test-361-egress-shapes.cjs
    - tests/test-354-taxonomy-ladder-casing.cjs
    - tests/test-354-egress-typed-question.cjs
    - tests/test-254-ambiguous-disclosure.cjs
decisions:
  - "A fourth mutation mode, ambiguous-to-block, was added: the gct, 361 and taxonomy refusals are ambiguous/unknown, so block-to-ambiguous cannot move them."
metrics:
  completed: 2026-11-06
---

# Phase 386 Plan 34: Exact verdicts and the mutation proof Summary

Four Part 8 test files asserted only "not allow" for their refusals, and the fifth asserted that an ambiguous packet reaches the wire. A verdict regression passed them. Each refusal is now asserted exactly, and a mutation proof shows each file fail when the guard verdict is remapped.

## Results (PROVEN)

- RCA weak-assertion table with the exact verdicts from classify(): the gct, 361 and taxonomy refusals are ambiguous/unknown; the private canary and the 10 private sentences are block/sprouts_required (edge_rule or private_marker); the test-254 free-form rows are allow/generic_question, allow/typed_question, block/content_set and block/room_content (identifier).
- RED (commit of the proof): M0 passes for all 5 files; gct, 361 and taxonomy survived ambiguous-to-block and the typed-question file survived block-to-ambiguous.
- GREEN: node tests/test-386-guard-test-mutation-proof.cjs exits 0; every mode in the table fails the named file; the 5 files pass with no preload; run-all-386 32/32; run-all-196 7/7; corpus gate PASS with the same MEASURED_SHA256 as plan 33. run-all-3692: only the 3 reds that predate this plan (rs-fetcher academic, mux card before answer, no-new-dependency flexsearch).
- run-all-245 passed 19/19 after plan 33. A later re-run under machine load hung twice (test-245-brain-verb-not-starved and test-245-dial-reactivity); each passes alone (exit 0). Both files do not touch this plan's files. UNVERIFIED as a full-suite pass after plan 34; plan 34 changed only tests.
- test-254 now asserts the plan 386-27 outcome in Arm 11: a body payload gets egress_blocked/sprouts_required with the route and the 5 line guide and 0 wire calls; a sprout-only payload proceeds with the egress_disclosure and a wire call. Arm 10 asserts the exact verdict and class per row.

## Deviations from Plan

**1. [Rule 2 - missing mode] Fourth mutation mode ambiguous-to-block**
- The plan names three modes. With them the gct, 361 and taxonomy files cannot be shown weak (their refusals are ambiguous). The fourth mode makes the exactness visible. The preload wraps classify and theoVerdict (both) through Module._load; no file is edited.

**2. Typed-question class set narrowed**
- assertPrivateClass previously accepted content_set, room_content or sprouts_required; it now requires exactly sprouts_required with a token class.

## Follow-ups (not edited)

Candidate files with possible not-allow-only forms, UNVERIFIED line by line: tests/test-260906-fda-known-tool-shapes.cjs, tests/test-223-part8-egress.cjs, tests/test-355-part8-egress.cjs.

## Known Stubs

None.

## Threat Flags

None. Tests only.

## Self-Check: PASSED

Commits: the RCA commit, the RED proof commit, the strengthening commit and the RCA resolution commit are on main; the RCA holds the Resolution block.

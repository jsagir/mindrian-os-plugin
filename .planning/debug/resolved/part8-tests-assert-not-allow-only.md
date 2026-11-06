---
status: resolved
kind: rca
trigger: "part8-tests-assert-not-allow-only"
issue_id: "E-TEST"
severity: medium
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: [8]
created: 2026-11-06T18:00:00Z
updated: 2026-11-06T18:00:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** branch `main` after plan 386-33 (commit a6cd170f7 and later), working tree of /home/jsagi/dev/MindrianOS-Plugin-release.
- **WIRE claims probe against:** none. No Brain call, no network. `globalThis.fetch` throws. Throwaway HOME. Scratch probe: /tmp/claude-1000/-home-jsagi/7d57c6ef-4a06-4170-af16-564c4ba5e1a6/scratchpad/p34.cjs (not committed).
- **Date of audit:** 2026-11-06
- **Re-verification rule:** each claim carries PROVEN (run in this session), UNVERIFIED or ASSUMED. Source: EGRESS-CLAIMS-CHECK.md claim g (PARTIAL: 4 files found by grep, the count of 8 NOT VERIFIED).

## Current Focus

hypothesis: four Part 8 test files assert only that a verdict is not allow, and the fifth asserts that an ambiguous packet reaches the wire; a regression of a verdict (block to ambiguous, ambiguous to block) passes them.
test: read the five files, classify() every case now, then run the files under a verdict mutation preload (plan 386-34 Task 2).
expecting: the not-allow-only files survive a mutation that moves a verdict between block and ambiguous.
next_action: write the mutation proof (RED), then replace each not-allow assertion with the exact verdict and class.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin-release
- Reported by: auditor egress message (hypothesis), claim g of EGRESS-CLAIMS-CHECK.md
- Related debug sessions: part8-ambiguous-verdict-is-sent-on-own-shim (plan 386-27, disposition sprouts_required), part8-over-blocks-ordinary-theo-and-context-questions (plan 386-33)

## Problem Statement

A not-allow assertion treats ambiguous as safe. On the own shim an ambiguous call that carries only sprouts is sent with a disclosure, so a regression from block to ambiguous is a real exposure that these tests would not see.

## Symptoms

<!-- IMMUTABLE once the investigation starts -->

expected: a verdict regression of a Part 8 case fails the test that covers it.
actual: tests/test-gct-process-step-id-parity.cjs, tests/test-361-egress-shapes.cjs and tests/test-354-taxonomy-ladder-casing.cjs assert `verdict !== 'allow'` and a class that is not known_tool_shape; tests/test-354-egress-typed-question.cjs asserts `notStrictEqual(verdict, 'allow')` and a class set; tests/test-254-ambiguous-disclosure.cjs asserts that an ambiguous packet reaches the wire and that Arm 10 is `notStrictEqual(verdict, 'ambiguous')`.
errors: none.
reproduction:
  1. node --require tests/helpers/part8-verdict-mutation-386.cjs with MUTATE_MODE set, one of the five files (plan 386-34 Task 2).
started: the weak assertions date from Phases 245, 354, 361 and the gct quick task.

## Scope and Impact

- Affected: five test files; no product file.
- Severity: medium (a regression passes silently).

## Eliminated

- hypothesis: "8 files carry the weakness" (the audit count). NOT CONFIRMED. The audit grep finds 4 files; the broader search below finds more candidates that are not weak in the same way or are out of scope; none is confirmed as not-allow-only except the 4 plus the Arm 10 form in test-254.

## Evidence

### Weak-assertion table (exact verdict and class from classify() now; PROVEN with the scratch probe)

Mutation modes: M1 block-to-ambiguous, M2 ambiguous-to-allow, M3 allow-to-ambiguous, M4 ambiguous-to-block (added in this plan: the exactness drift that a not-allow assertion also misses). "survives" means the assertion still passes under that mode.

| file | case | assertion form today | verdict and class now | survives |
|---|---|---|---|---|
| tests/test-gct-process-step-id-parity.cjs | R1 to R5d (8 refused step ids) | not-allow (`verdict !== 'allow'`) and `class !== 'known_tool_shape'` | ambiguous/unknown | M4 |
| tests/test-gct-process-step-id-parity.cjs | A0 to A5 (6 allowed ids) | equals allow, class known_tool_shape, exact reason | allow/known_tool_shape | none (fails M3) |
| tests/test-361-egress-shapes.cjs | 28 expectNotAllow rows (extra keys, malformed ids, off-vocabulary names, wrong tool names) | not-allow and `class !== 'known_tool_shape'` | all 28: ambiguous/unknown | M4 |
| tests/test-361-egress-shapes.cjs | arm A and other expectVerdict rows | equals allow with class | allow/known_tool_shape | none |
| tests/test-354-taxonomy-ladder-casing.cjs | T3 old lowercase rung `ill-defined` | not-allow | ambiguous/unknown | M4 |
| tests/test-354-taxonomy-ladder-casing.cjs | T3 `IllDefined` | equals allow and class | allow/known_tool_shape | none |
| tests/test-354-egress-typed-question.cjs | Case C classify(PRIVATE) | `notStrictEqual(verdict, 'allow')` and class in a set (content_set, room_content, sprouts_required) | block/sprouts_required (edge_rule) | M1, M4 does not apply |
| tests/test-354-egress-typed-question.cjs | Cases A, B1, B2 (ask, search, smartSearch of PRIVATE) | `error === 'egress_blocked'` and class in the set | egress_blocked/sprouts_required | M1 in classify is not seen by the sentinel; the class set also accepts a bare content_set |
| tests/test-354-egress-typed-question.cjs | generic corpus rows | equals allow, class typed_question | allow/typed_question | none |
| tests/test-254-ambiguous-disclosure.cjs | Arm 1, 4, 5, 6, 7, 9 packets | equals ambiguous, then asserts the disclosure and the wire call | ambiguous/unproven_packet (packets); the sprout-only fixture proceeds | none for the verdict; the OUTCOME of an edge or body payload is not asserted |
| tests/test-254-ambiguous-disclosure.cjs | Arm 10 (12 rows: 4 texts by 3 tools) | `notStrictEqual(verdict, 'ambiguous')` only | the 4 texts give allow/generic_question, allow/typed_question, block/content_set, block/room_content/identifier | M1 only if the block row maps to ambiguous (it does, so it fails); allow exactness is not asserted per row |

Reading: the 3 files that cover refused typed shapes (gct, 361, taxonomy) assert not-allow where the exact answer is ambiguous/unknown. They survive M4, the drift of a refusal to a block with another class, which hides that the shape arm changed. test-354-egress-typed-question asserts the private case by class set; it survives M1 (the block becomes ambiguous and the class set still holds). test-254 covers the verdict of packets exactly but asserts nothing about a body or edge payload (plan 386-27 added the outcome sprouts_required) and Arm 10 is a negative assertion.

Which files must fail in which mode after the fix (the table the proof test reads; a mode applies only to a file that holds a case of the source verdict):

| file | M1 block-to-ambiguous | M2 ambiguous-to-allow | M3 allow-to-ambiguous | M4 ambiguous-to-block |
|---|---|---|---|---|
| tests/test-gct-process-step-id-parity.cjs | n/a (no block case) | must fail | must fail | must fail |
| tests/test-361-egress-shapes.cjs | n/a | must fail | must fail | must fail |
| tests/test-354-taxonomy-ladder-casing.cjs | n/a | must fail | must fail | must fail |
| tests/test-354-egress-typed-question.cjs | must fail | n/a (no ambiguous case) | must fail | n/a |
| tests/test-254-ambiguous-disclosure.cjs | must fail | must fail | must fail | must fail |

Measured at RED (Task 2): the table above holds; survivals were gct, 361 and taxonomy under M4 and the typed-question file under M1.

### Other files with a not-allow or isBlock-only form (broader search; follow-ups, not edited here)

Search: `verdict !== 'allow'`, `notStrictEqual(... verdict ... 'allow')`, `notEqual`, `isBlock(` in tests that call classify(). Candidates found: tests/test-260906-fda-known-tool-shapes.cjs, tests/test-223-part8-egress.cjs, tests/test-355-part8-egress.cjs, tests/test-part8-name-class-methodology-names.cjs (isBlock in the A1 and C1 legs, which assert allow; the refusal legs assert the exact class), tests/test-3692-lexicon-generic-entries.cjs (L6 asserts the exact class), tests/test-386-key-shapes-and-money.cjs (K7 pins block), lib/core/part8-egress-guard.test.cjs (PB8-09 equals block or allow). The first three are UNVERIFIED as not-allow-only (not read line by line). Record as follow-ups for a later cleanup.

### The outcome test-254 must assert (plan 386-27)

A body or edge payload: callTool returns { error: egress_blocked, egress_class: sprouts_required, outcome: sprouts_required, route: sprout_call, split_guide of 5 lines } with 0 wire calls. A sprout-only payload: proceeds with the egress_disclosure and the wire call. Both are PROVEN by tests/test-386-sprouts-required-outcome.cjs (SP1, SP6).

## Technical Root Cause

Not-allow is treated as safe, although ambiguous is sent on some routes (the own shim, for a sprout-only payload), so a regression from block to ambiguous passes. The same assertion form also accepts any other non-allow verdict and class, so a change of the exact refusal (ambiguous/unknown to block/content_set) passes. Class sets (`content_set or room_content or sprouts_required`) have the same flaw for the private case.

## Required Code Changes

Replace each not-allow assertion with the exact verdict and class that classify() returns now (ambiguous/unknown for the refused typed shapes; block with the exact class for the private canary). In test-254 assert the outcome of plan 386-27 and the exact class of each fixture verdict, and turn Arm 10 into per-row exact verdicts. Add the mutation proof (tests/test-386-guard-test-mutation-proof.cjs and tests/helpers/part8-verdict-mutation-386.cjs). Do not add a case unless a case has no assertion.

## Tests to Add or Update

- Test 1:
  - Type: integration
  - Location: tests/test-386-guard-test-mutation-proof.cjs
  - Given: the 5 files and the mutation preload (M1 to M4 through MUTATE_MODE, passed by --require and by NODE_OPTIONS)
  - When: each file runs with no preload and once per mode
  - Then: M0 exits 0 for all; each mode that the table names makes that file exit non-zero
- Test 2: the 5 files, strengthened in place, pass with no preload.

## Non-Code Follow-ups

- CHANGELOG.md, STATE.md, ROADMAP.md and knowledge-base.md: owned by plan 386-21.
- The three UNVERIFIED candidate files above.
- Canon Part 8: synthetic strings only. No room content in this file.
- Tri-Polar: tests only; no surface change.

## Resolution

root_cause: not-allow is treated as safe although ambiguous is sent on some routes, so a verdict regression passes the weak tests; class sets and negative assertions accept any other refusal.
fix: plan 386-34. The refusal assertions of tests/test-gct-process-step-id-parity.cjs, tests/test-361-egress-shapes.cjs and tests/test-354-taxonomy-ladder-casing.cjs assert exactly ambiguous/unknown; tests/test-354-egress-typed-question.cjs asserts exactly block/sprouts_required (verdict, class and token class) for every private sentence; tests/test-254-ambiguous-disclosure.cjs asserts the exact class of each fixture verdict, per-row exact verdicts in Arm 10, and a new Arm 11 for the plan 386-27 outcome (a body payload gets the typed result with class sprouts_required, the route and the 5 line guide and 0 wire calls; a sprout-only payload proceeds with the disclosure and a wire call). A mutation proof and a preload (4 modes; the 4th, ambiguous-to-block, was added because the gct, 361 and taxonomy refusals are ambiguous, not block) show the failures.
verification: RED at the proof commit: M0 passes for all 5; gct, 361 and taxonomy survived ambiguous-to-block and the typed-question file survived block-to-ambiguous (4 survivals, PROVEN). GREEN: node tests/test-386-guard-test-mutation-proof.cjs exits 0 (every mode in the table fails the named file), the 5 files pass with no preload, run-all-386 32/32. Two mutants were read to check they fail for the right reason (gct under ambiguous-to-block: "verdict is exactly ambiguous"; typed-question under block-to-ambiguous: Case C and Case D).
files_changed: tests/test-gct-process-step-id-parity.cjs, tests/test-361-egress-shapes.cjs, tests/test-354-taxonomy-ladder-casing.cjs, tests/test-354-egress-typed-question.cjs, tests/test-254-ambiguous-disclosure.cjs, tests/test-386-guard-test-mutation-proof.cjs, tests/helpers/part8-verdict-mutation-386.cjs
commits: the RCA commit, the RED proof commit, the strengthening commit (git log of this file)

---
phase: quick-260917-dgf
plan: 01
subsystem: part8-egress-runtime-guardrail
tags: [canon-part-8, egress-hook, brain-client, tdd]
dependency-graph:
  requires: [lib/core/part8-egress-guard.cjs::classify, lib/core/brain-response-sanitize.cjs::isBrainTool, lib/core/brain-response-sanitize.cjs::isBrainShapedTool]
  provides: [scripts/part8-egress-guard-hook.cjs ambiguous-verdict trusted-scope disposition]
  affects: [tests/part8-egress-guard-hook.test.cjs, tests/test-245-egress-contentless.cjs, tests/test-260906-fda-known-tool-shapes.cjs, tests/run-all-196.sh]
tech-stack:
  added: []
  patterns: [RED/GREEN TDD gate, function-scoped variable hoisting for cross-branch reuse, defensive trust-bit degrade-to-false]
key-files:
  created:
    - tests/test-260917-dgf-part8-hook-disposition.cjs
  modified:
    - scripts/part8-egress-guard-hook.cjs
    - tests/part8-egress-guard-hook.test.cjs
    - tests/test-245-egress-contentless.cjs
    - tests/test-260906-fda-known-tool-shapes.cjs
    - tests/run-all-196.sh
decisions:
  - "TRUSTED_AMBIGUOUS_ALLOW_CLASSES = {freeform_unmatched, unknown}; unproven_packet deliberately excluded (typed structure that failed proof, not a free-form string)"
  - "Trust bit computed defensively: a predicate throw degrades to UNTRUSTED (keeps the block), never to the allow"
  - "Placement of the trusted-scope allow is before brainAvailable() and after bestEffortRecord, so telemetry still records every verdict including newly-allowed ones"
metrics:
  duration: "~35 min"
  completed: "2026-09-17"
---

# Phase quick-260917-dgf Plan 01: Align the Part 8 egress hook's ambiguous-verdict disposition with the shim Summary

Trusted Brain scopes (`isBrainTool()` true) now exit 0 on an ambiguous
`freeform_unmatched`/`unknown` verdict and proceed to `brain-client.cjs::callTool`'s
own re-classification and `egress_disclosure`, instead of hard-blocking with an
unrenderable Shape F.1 card on stderr.

## What Changed

`scripts/part8-egress-guard-hook.cjs`'s ambiguous branch previously converted
every ambiguous verdict into exit 2 on any Brain-shaped scope, regardless of
whether the scope was trusted. This diverged from `lib/core/brain-client.cjs::callTool`,
which classifies the same args a second time and PROCEEDS on an ambiguous
verdict, attaching an additive `egress_disclosure`. The hook was stricter than
the policy the shim already states, and a PreToolUse hook cannot render the
F.1 card, so the card JSON was landing on stderr as an unreadable error
string -- refusing a plain-English `brain_ask` with zero user bytes.

The fix: hoist the `sanitizer` require out of the scope-gate try block so
`isBrainTool` (the TRUST predicate) is reachable in the ambiguous branch,
alongside the byte-unchanged `isBrainShapedTool` INSPECTION scope gate. Add a
`TRUSTED_AMBIGUOUS_ALLOW_CLASSES` frozen set (`freeform_unmatched`, `unknown`).
On a trusted scope with one of those classes, exit 0 before the
`brainAvailable()` test. Everything else (block branch, F.1 gate render
attempt, minimal-notice fallback, Brain-less allow, `unproven_packet`, and the
untrusted-key block) is byte-unchanged.

## RED Evidence (Task 1)

`node tests/test-260917-dgf-part8-hook-disposition.cjs` against the unmodified
hook printed exactly these FAIL case IDs (A1-A4, two assertions each), and
nothing else:

```
FAIL: A1 A1: expected exit 0 (trusted scope, ambiguous freeform_unmatched must proceed to the shim), got 2 stderr="{...part 8...freeform_unmatched...}"
FAIL: A1 A1: expected no Part 8 text on stderr, got "{...part 8...freeform_unmatched...}"
FAIL: A2 A2: expected exit 0 ..., got 2 stderr="{...}"
FAIL: A2 A2: expected no Part 8 text on stderr, got "{...}"
FAIL: A3 A3: expected exit 0 ..., got 2 stderr="{...}"
FAIL: A3 A3: expected no Part 8 text on stderr, got "{...}"
FAIL: A4 A4: expected exit 0 ..., got 2 stderr="{...}"
FAIL: A4 A4: expected no Part 8 text on stderr, got "{...}"
```

`B`, `C`, `D`, `E`, `F`, LEG 0 (classifier unchanged), and LEG 2 (predicate
self-validation) all passed against the unmodified hook, confirming only the
disposition was wrong, never the classifier or the predicates. Verify command
(`grep -q 'FAIL: A1' ... && grep -q 'FAIL: A4' ... && ! grep -qE 'FAIL: (B|C|D|E|F)\b'`)
passed.

## GREEN (Task 2)

`node tests/test-260917-dgf-part8-hook-disposition.cjs` after the hook edit:
`PASS: test-260917-dgf-part8-hook-disposition (all legs green)`.

## Sibling Assertions Updated (the three pre-identified conflicts)

| File | Assertion (renamed) | Fixture | Class | Before | After |
|------|----------------------|---------|-------|--------|-------|
| `tests/part8-egress-guard-hook.test.cjs` | `pb8_07_gate` -> `pb8_07_trusted_scope_proceeds` | plugin-scoped `brain_ask` `{question:'opaque blob...'}` | freeform_unmatched | exit 2 | exit 0 |
| `tests/test-245-egress-contentless.cjs` | HOOK C | plugin-scoped `brain_stats` `{a:1}` | unknown | exit 2 | exit 0 |
| `tests/test-260906-fda-known-tool-shapes.cjs` | HOOK C | plugin-scoped `brain_query` `{from:'Design Thinking', to:'SWOT'}` | unknown | exit 2 | exit 0 |

None of the three assertions were deleted, only flipped in place with a
citation comment to quick task 260917-dgf. The classifier-level "shape must
not travel across tool names" claim in `test-260906-fda` stays intact at LEG 1
(Arm A/B's `expectNotAllow`); only the hook-leg exit code moved. The
`test-245` HOOK C "catch-all untouched" claim is still true at the classifier
(step 4 still returns `ambiguous`/`unknown`); the comment was rewritten to say
the DISPOSITION changed, not the classification. The `A1 EVIDENCE` stderr
print in `test-245` was guarded (`(c.stderr || '')`) so it no longer crashes
on the now-empty stderr of an allow.

`pb8_07_verbs` (the F.1 gate render contract itself -- Reformulate/Cancel, no
send-anyway verb) is untouched; it asserts directly against the renderer, not
through the hook, and is unaffected by the disposition change.

## Final Suite Output (Task 3)

`bash tests/run-all-196.sh`:

```
--- PB8-01/03/05/09 classifier unit + CSV parity --- PASSED
--- PB8-06 telemetry ontology (scalars + slugs only) --- PASSED
--- PB8-04/05/07/08 hook + F.1 gate + degrade --- PASSED
--- 260917-dgf hook ambiguous disposition (trusted scope allows, untrusted blocks) --- PASSED
--- PB8-02 no private FORBIDDEN_PATTERNS copy --- PASSED
--- PB8-07/10 e2e synthetic smoke (CONTENT blocked, MOVE passes) --- PASSED
========================================
  Summary (196 verification)
  Passed: 6   Failed: 0   Skipped: 0
========================================
```

Four named sibling tests, all exit 0:

- `node tests/test-260906-fda-known-tool-shapes.cjs` -- PASS: 87 assertions.
  LEG 2's hook Case A/B/C block was SKIPPED with `SKIP: no live plugin-scoped
  name found containing "find_connections"` -- a pre-existing environmental
  condition (the live stdio handshake to enumerate Brain tool names could not
  complete in this execution environment, unrelated to this plan's edit) that
  was NOT patched around, per the plan's instruction. This SKIP occurs before
  the Case C assertion this plan updated is ever reached.
- `node tests/test-245-egress-contentless.cjs` -- PASS: 41 assertions
  cumulative (unit leg + hook leg). HOOK C's evidence line: `A1 EVIDENCE
  (ambiguous disposition, stderr line 1): (empty -- allowed, no stderr)`.
- `node tests/test-260906-gr1-brain-shaped-tool-gate.cjs` -- 12/12 node:test
  subtests pass, untouched.
- `node tests/test-246-census-guard.cjs` -- PASS: 59 assertions over 15
  census queries.

## Do-Not-Touch Hash Verification

`sha256sum -c /tmp/260917-dgf-donottouch.sha256` was green before Task 1,
after Task 2, and after Task 3 (re-verified post-commit):

```
lib/core/part8-egress-guard.cjs: OK
lib/core/brain-response-sanitize.cjs: OK
lib/core/brain-client.cjs: OK
hooks/hooks.json: OK
tests/test-260906-gr1-brain-shaped-tool-gate.cjs: OK
```

No hash drift; all five files are byte-unchanged from planning time.

## Deviations from Plan

None - plan executed exactly as written. Fixture measurements taken during
execution (LEG 0 / A1-A4, B, C, D, F payloads run directly against
`classify()`) matched the plan's `<interfaces>` table exactly.

## Concurrent-Session Note (not a deviation in this plan's own work)

While this plan ran, another Claude session working in the same tree (no
worktree isolation, `workflow.use_worktrees=false`) committed directly to
`main` (`e40370c7b fix(mcp): name mindrian-brain as the brain_* host in
RUNTIME_INSTRUCTIONS`), landing between this plan's Task 1 and Task 2
commits, and left an uncommitted working-tree diff on
`tests/test-298-contract-parity.cjs` (citing quick task `260917-dia`, a
different task) that was present at the end of this session. Per the
workspace guard, that diff was never staged, reverted, or touched by this
execution -- it belongs to the other session and remains exactly as found.

## TDD Gate Compliance

RED gate: commit `8b4a04241` (`test(260917-dgf): pin the Part 8 hook
ambiguous-verdict disposition (RED)`). GREEN gate: commit `68f7552de`
(`fix(260917-dgf): align hook ambiguous disposition with the shim on trusted
Brain scopes`). Both present, in order, per the plan's `tdd="true"` gate on
Task 1. No REFACTOR commit was needed (Task 2's edit is the minimal
production change; no cleanup pass followed it).

## Self-Check: PASSED

- FOUND: tests/test-260917-dgf-part8-hook-disposition.cjs
- FOUND: scripts/part8-egress-guard-hook.cjs (TRUSTED_AMBIGUOUS_ALLOW_CLASSES + isBrainTool consulted)
- FOUND: commit 8b4a04241 in git log
- FOUND: commit 68f7552de in git log
- FOUND: commit bbfc4788e in git log
- FOUND: `test-260917-dgf-part8-hook-disposition.cjs` registered (live shell, not comment) in tests/run-all-196.sh

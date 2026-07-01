---
phase: 196-part8-runtime-slm-guardrail
plan: 01
subsystem: test-harness
tags: [part8, egress-guard, test-harness, nyquist, skip-safe, plurai-parity]
requires: []
provides:
  - tests/run-all-196.sh
  - lib/core/part8-egress-guard.test.cjs
  - lib/core/part8-egress-ontology.test.cjs
  - tests/part8-egress-guard-hook.test.cjs
affects:
  - 196-03 (classifier binds guard.test.cjs + PB8-02 grep-guard)
  - 196-04 (hook + ontology bind their test legs)
  - 196-05 (F.1 gate binds the hook gate legs; owns the Wave 3 e2e smoke leg)
tech-stack:
  added: []
  patterns:
    - "run/run_if SKIP-safe aggregator cloned from run-all-188.sh"
    - "require-in-try/catch SKIP-and-exit-0 idiom for Nyquist test-first stubs"
    - "zero-dep quoted-field CSV loader (doubled-quote escapes, embedded commas)"
    - "navigation.cjs seam spy + fail-loud stub db to prove Part 9 routing"
    - "spawnSync stdin -> exit-code contract for PreToolUse hook testing"
key-files:
  created:
    - tests/run-all-196.sh
    - lib/core/part8-egress-guard.test.cjs
    - lib/core/part8-egress-ontology.test.cjs
    - tests/part8-egress-guard-hook.test.cjs
  modified: []
decisions:
  - "PB8-02 grep-guard filters comment lines before matching FORBIDDEN_PATTERNS = to avoid comment self-invalidation"
  - "run_if legs guard on the RUNTIME module file (not the test file) so the runner intent is explicit"
  - "hook ambiguous-branch availability exercised via PART8_FORCE_BRAIN_AVAILABLE test-only env seam"
metrics:
  duration: ~4m
  completed: 2026-07-01
---

# Phase 196 Plan 01: Test Harness Summary

SKIP-safe Wave 0 verification surface for the Part-8 runtime egress guardrail: a
run-all-196 aggregator plus three test stubs and the Plurai CSV parity loader, all
green-with-SKIPs before any runtime module lands (Nyquist: tests precede implementation).

## What Was Built

- **tests/run-all-196.sh** - clones the run-all-188.sh run/run_if scaffold verbatim
  (set -uo pipefail, ROOT/cd, PASS/FAIL/SKIP counters, exit `[ FAIL -eq 0 ]` tail).
  Three run_if legs guarded on the runtime module files (classifier, ontology, hook)
  so they SKIP until later waves land those modules. One PB8-02 grep-guard leg,
  run_if-guarded on the classifier, that strips comment lines then asserts no literal
  `FORBIDDEN_PATTERNS =` assignment survives (the classifier must import, never declare,
  the pattern set). A commented placeholder marks the Wave 3 e2e smoke leg owned by 196-05.
- **lib/core/part8-egress-guard.test.cjs** (PB8-01/03/05/09) - three-way verdict
  assertions (block/allow/ambiguous), the free-form brain_ask path, a 1000-call sub-500ms
  perf gate, and a zero-dep quoted-field CSV loader that drives one assertion per labeled
  row of evals/plurai/01-part8-boundary-guardrail.csv (violation -> block, compliant -> allow).
- **lib/core/part8-egress-ontology.test.cjs** (PB8-06) - spies the navigation.cjs writers
  and uses a fail-loud stub db to prove telemetry is scalars + slugs + counts only (no raw
  bytes), routes through navigation (never opens room.db), writes a TAGGED_WITH edge, and
  that the three additive EVENT_TYPES strings are accepted by the memory-event Set.
- **tests/part8-egress-guard-hook.test.cjs** (PB8-04/05/07/08) - spawnSync stdin -> exit-code
  contract: content-set -> exit 2 + Part 8 stderr, clean move-set / non-brain / garbage -> exit 0
  fail-open. The F.1 gate ({Reformulate, Cancel}, no send-anyway verb) and Brain-less degrade
  legs are guarded behind the gate module so they stay SKIP-safe until 196-05.

## Verification

`bash tests/run-all-196.sh` exits 0, prints 4 legs SKIPPED, Summary `Passed: 0 Failed: 0 Skipped: 4`.
Each *.test.cjs run standalone prints its SKIP line and exits 0 while its runtime module is absent.
The CSV loader was validated out-of-band against the live 8-row fixture: all rows parse (doubled-quote
JSON escapes handled), labels compliant x4 / violation x4.

## Deviations from Plan

None - plan executed exactly as written. The three files in files_modified plus the aggregator were
authored; no runtime modules were touched (this plan owns only its four files).

## Requirements Verification Path (SKIP -> binds)

| Requirement | Test leg | Binds when |
|-------------|----------|------------|
| PB8-01/03/05/09 | part8-egress-guard.test.cjs | 196-03 lands lib/core/part8-egress-guard.cjs |
| PB8-02 | run-all-196 grep-guard leg | 196-03 lands the classifier |
| PB8-06 | part8-egress-ontology.test.cjs | 196-04 lands lib/core/part8-egress-ontology.cjs |
| PB8-04/05/07/08 | part8-egress-guard-hook.test.cjs | 196-04 (hook) + 196-05 (F.1 gate) |

## Known Stubs

All four files are intentional Wave 0 SKIP-safe stubs (Nyquist test-first). They are inert until their
runtime modules land in Waves 1-3, at which point each flips from SKIP to a binding gate. This is the
plan's stated design, not incomplete work. The PART8_FORCE_BRAIN_AVAILABLE env seam and the assumed
classify/record/renderGate signatures are contracts the later plans (196-03/04/05) must honor.

## Self-Check: PASSED

All four deliverables and the SUMMARY exist on disk; all three task commits (926f33b2, 5b803052,
e548f01b) are in the log; no em-dashes in any deliverable.

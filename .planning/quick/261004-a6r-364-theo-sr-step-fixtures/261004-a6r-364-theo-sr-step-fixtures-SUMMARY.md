---
phase: quick
plan: 261004-a6r
subsystem: phase-364 scientific roadmapping test fixtures
tags: [theo-25, fixtures, sr-steps, test-364]
requires: [Theo Phase 25 write 1 f05ac2c, write 2 43205a2 (as reported by the Theo session)]
provides: [framework-step fixtures on sciroad::scientific-roadmapping::p01-p07, honest-empty fixture, test-364-sr-steps legs S14-S21]
affects: [tests/fixtures/364-theo, tests/test-364-sr-steps.cjs, tests/test-364-sr-door.cjs, 364 notify doc, 364-FOLLOW-ONS A6]
key-files:
  created: [tests/fixtures/364-theo/framework-step-honest-empty.json]
  modified:
    - tests/fixtures/364-theo/framework-step-all-null.json
    - tests/fixtures/364-theo/framework-step-one-null.json
    - tests/fixtures/364-theo/framework-step-authored.json
    - tests/fixtures/364-theo/framework-step-unlabelled-seven.json
    - tests/fixtures/364-theo/framework-step-eight-unlabelled.json
    - tests/test-364-sr-steps.cjs
    - tests/test-364-sr-door.cjs
    - docs/2026-10-03-PHASE-364-THEO-NOTIFY.md
    - .planning/phases/364-scientific-roadmapping-command-mos-scientific-roadmap-seed-0/364-FOLLOW-ONS.md
decisions:
  - Fixtures written from the Theo session's reported facts (no generator exists, no live read made)
  - thinkingMode per-step assignment is a fixture convention (SEQUENTIAL p01-p04, PARALLEL p05, ITERATIVE p06, DECOMPOSE p07); only the 4/1/1/1 distribution is pinned
metrics:
  tasks: 3
  completed: 2026-10-04
---

# Quick 261004-a6r: 364 Theo SR step fixtures to the Theo 25 ids

The Phase 364 step fixtures and tests moved from the retired `sr-v1-step-1..7` ids to Theo Phase 25's `sciroad::scientific-roadmapping::p01` to `p07` (STEP rows, draft, deliberate researchDirective nulls on p02/p03/p04/p05/p07), with a new honest-empty fixture and 16 new test checks.

## Commits

| Task | Commit | Paths |
|------|--------|-------|
| 1 fixtures + id moves | d4deb0ce3 | five framework-step fixtures rewritten, framework-step-honest-empty.json new, test-364-sr-door.cjs (3 lines), test-364-sr-steps.cjs (id moves, S4 inline, S8 STEP) |
| 2 legs S14-S21 | 531f26ef5 | tests/test-364-sr-steps.cjs |
| 3 docs | 3376b1911 | notify doc sub-bullet, 364-FOLLOW-ONS A6 progress |

All three are ancestors of HEAD.

## PASS counts (offline, MOS_364_LIVE unset)

| Consumer | Before | After |
|----------|--------|-------|
| sr-steps | 37 | 53 |
| sr-door | 70 | 70 |
| filing | 49 | 49 |
| mcp | 31 | 31 |
| refusal-e2e | 52 | 52 |
| part8 | 17 | 17 |
| theo-handoff | 9 | 9 |

`bash tests/run-all-364.sh` (MOS_364_LIVE unset): PASSED=61 FAILED=0 SKIPPED=1 KNOWN=3. Every `>>> 364` leg PASSED; `364 live smoke: SKIPPED (opt-in, MOS_364_LIVE unset)`. No non-364 red.

## Provenance

The fixtures were written from the Theo session's reported facts (jsagi-93, 2026-10-04), not regenerated and not captured live. No fixture generator exists, no live read was made (no brain-client, MCP client or `mcp__theo__*` call; MOS_364_LIVE never set). Text fields keep the "FIXTURE ..., not canon" marker strings, so no Brain prose is held in the repo. The authored fixture keeps its two synthetic rows (`fixture-def-1`, `fixture-aside-1`) for the skip contract.

## thinkingMode convention

Theo did not report which step carries which mode. The fixtures assign SEQUENTIAL to p01-p04, PARALLEL to p05, ITERATIVE to p06, DECOMPOSE to p07 (the order the facts list them). Tests pin only the 4/1/1/1 distribution (S16); the test header says so.

## Observations (out of scope, not changed)

1. `data/research-shape-ledger.json` still lists the three retired aliases (Technology Roadmapping, Roadmapping, Field Roadmapping) and pre-Theo-25 SR data. Regeneration is a later live-read quick after canon window 25 closes.
2. `tests/test-364-live-smoke.cjs` treats `no_steps_in_canon` as neither a pass nor an ENV GAP (ENV_GAP_REASONS omits it), so an honest-empty Theo would read as exit 1 / FAIL there.
3. The new p ids match the Part 8 guard's `PROCESS_STEP_ID_RE` (`...::p\d{2}` branch); the retired `sr-v1-step-N` ids did not.

## Deviations from Plan

None - plan executed as written. The `tests/test-364-sr-door.cjs` edit is the three id strings only (3 added, 3 removed). Dated 2026-10-02 notes in 364-CONTEXT, 364-RESEARCH, 364-INPUT, 364-03-PLAN, 364-10-PLAN left as written per the orchestrator's decision.

## Still open (live half of A6)

Live smoke re-run, authored live walk on a fixture room, recorded authored live payload fixture: all after Theo's close message (canon window 25).

## Self-Check: PASSED

Fixtures, SUMMARY and commits d4deb0ce3, 531f26ef5, 3376b1911 verified present; no sr-v1 in fixtures or sr-door (one RETIRED_ID_RE line in sr-steps); no em/en-dash in touched files.

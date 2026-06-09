---
phase: 148-larryreach-selector-re-wire-intelligence-toggleable-components
plan: 04
subsystem: workflow
tags: [command-resolver, dial-close-reach, selector, navigation, evidence-claim, irw-06, irw-01, irw-07]

# Dependency graph
requires:
  - phase: 148-01
    provides: "DIAL_REACH_K=6 lockstep (hats as the 6th reach), carried drift fences rewritten 5->6"
  - phase: 148-03
    provides: "reach-component-map.json, archetype routing in selector-dispatcher, run-all-148.sh aggregator (already lists this plan's 3 suites)"
  - phase: 122
    provides: "command-resolver.commandsForFramework (the only framework->command door)"
  - phase: 141
    provides: "fileEvidenceWithReadback + surfaceFileEvidenceResult (FILEVAL read-back filing)"
  - phase: 135
    provides: "closeReach 4-outcome commit door (sync/pivot/defer-reject/miss)"
provides:
  - "closeReach sync/pivot path resolves reach.framework -> real /mos: command and FIRES it (IRW-06)"
  - "engine artifact lands via fileEvidenceWithReadback (fallback wireAccept) on commit"
  - "DEGRADE-don't-fabricate rail: empty resolution returns a run-<framework>-manually instruction"
  - "tests/test-148-engine-reaches.cjs (IRW-01), test-148-real-invocation.cjs (IRW-06), test-148-frozen-contracts.cjs (IRW-07)"
affects: [148-05, intelligence-orchestrator, dial-presenter, larry-personality]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Resolve-through-the-one-door: never name a /mos: slug from memory; commandsForFramework or degrade"
    - "Injected fireCommand seam: the surface-agnostic in-conversation stand-in for Larry running the command"
    - "Rankable-by-membership: prove a command is a ranker candidate via registry membership + fail-closed filters, not via the MAX_K-clamped slice"

key-files:
  created:
    - tests/test-148-engine-reaches.cjs
    - tests/test-148-real-invocation.cjs
    - tests/test-148-frozen-contracts.cjs
  modified:
    - lib/workflow/dial-close-reach.cjs

key-decisions:
  - "fireCommand is an injected seam, not a child_process spawn -- in-conversation the agent runs the /mos: command; the lib layer has no subprocess firing and must not add one (tri-polar: CLI/Desktop/Cowork all run the command through Larry, not a shell)."
  - "fileEvidence params are caller-supplied and OPTIONAL -- surface-only families (six-hats) produce no EvidenceClaim, so closeReach files an artifact only when the fired command produced evidence params."
  - "IRW-01 rankability proven by membership in the ranker candidate registry passing the jtbd_summary+teaching+frameworks fail-closed filters, NOT by appearance in the MAX_K=3 clamped slice (the clamp is frozen, IRW-07)."
  - "No backfill of historical SELECTED_REACH plumbing-label edges (A4) -- they are harmless historical system-bookkeeping; only NEW edges point at the resolved real command."

patterns-established:
  - "Pattern: resolve+fire+file as a single post-edge helper (_resolveFireFile) merged onto the committed-reach result"
  - "Pattern: AskUserQuestion construction audit keys on the dispatcher's payload-build MARKER (askuserquestion_marker / [AskUserQuestion contract:), not on bare-word mentions, so doc-comment references to the clamp do not trip the no-bespoke-widget fence"

metrics:
  duration: ~25 min
  completed: 2026-06-09
  tasks: 3
  files_created: 3
  files_modified: 1
---

# Phase 148 Plan 04: Real Engine Invocation on Commit Summary

closeReach now resolves a committed reach's framework through the only door (command-resolver.commandsForFramework), FIRES the real /mos: engine command, and lands the engine artifact via fileEvidenceWithReadback -- closing the IRW-06 "plumbing behind the menu" gap; selecting reverse-salient now runs find-bottlenecks instead of writing an edge to a dead plumbing label.

## What Was Built

### Task 1 -- Resolve+fire the real engine on commit (IRW-06)
`lib/workflow/dial-close-reach.cjs` gained a `_resolveFireFile(db, reach, o)` helper that runs on the shared committed-reach path (sync + pivot) AFTER the existing SELECTED_REACH bookkeeping edge:
- Resolves `reach.framework` through `commandResolver.commandsForFramework()` (the ONLY door; required as a workflow sibling, not a navigation submodule, so the Part 9 single-chokepoint import audit in test-dial-close-reach.cjs still passes).
- Empty resolution -> DEGRADE: returns `{ degraded:true, fired_command:null, manual_run:'run <framework> manually' }`. Never fabricates a slug.
- Non-empty -> fires `cmds[0]` through the injected `fireCommand` seam, then lands the engine artifact via `navigation.fileEvidenceWithReadback` (fallback `findingsWirer.wireAccept` on a readback error), and surfaces the FILEVAL honesty result via `navigation.surfaceFileEvidenceResult`.
- The filed EvidenceClaim is a truth-claim node and lands `review_status: proposed` -- closeReach NEVER folds a confirmNode promotion into the SELECTED_REACH bookkeeping write (Part 9 carve-out preserved).
- miss/defer-reject paths are byte-unchanged (no SELECTED_REACH, no fire, no resolve).

The closeReach result now carries `degraded`, `fired_command`, and (when an artifact landed) `filing` + `surfaced`.

### Task 2 -- IRW-01 + IRW-06 test suites
- `tests/test-148-engine-reaches.cjs` (IRW-01): proves each of the 5 engine frameworks (Reverse Salient Analysis, HSI Semantic Surprise Analysis Assistant, Four Lenses of Innovation, Usher's Model of Cumulative Synthesis, Dominant Design) resolves to a non-empty real /mos: command AND is a rankable f-selector candidate.
- `tests/test-148-real-invocation.cjs` (IRW-06): integration test against a temp room.db (cloned fixture from test-dial-close-reach.cjs) -- drives `closeReach({outcome:'sync', reach:{framework:'Reverse Salient Analysis', ...}})`, asserts the resolver returned a real command, the command FIRED through the seam, a SELECTED_REACH edge landed (read back via navigation.getNeighborhood), and the artifact landed (readback proves the EvidenceClaim row exists as `proposed`). Also asserts the DEGRADE path and the unchanged defer path. (Shipped in the Task-1 commit because TDD required the failing test alongside the implementation.)

### Task 3 -- IRW-07 frozen-contracts audit
`tests/test-148-frozen-contracts.cjs`: asserts `MAX_K===3`, `RECOMMEND_FLOOR===0.70`, `MARGIN_THRESHOLD===0.15` unchanged and `DIAL_REACH_K===6` (the only moved constant), the two caps stay distinct, and the AskUserQuestion payload-construction marker appears ONLY in selector-dispatcher.cjs (no bespoke widget; SEED-020).

## Test Results

| Suite | Result |
|-------|--------|
| tests/test-148-engine-reaches.cjs (IRW-01) | PASS (12 assertions) |
| tests/test-148-real-invocation.cjs (IRW-06) | PASS (4 assertions) |
| tests/test-148-frozen-contracts.cjs (IRW-07) | PASS (7 assertions) |
| tests/test-dial-close-reach.cjs (regression) | PASS (9/9) |

`bash tests/run-all-148.sh`: Total 18, Passed 16, Failed 2. The 2 failures are `test-148-unified-host.cjs` (IRW-05) and `test-148-brain-review-egress.cjs` (IRW-08) -- both owned by Plan 148-05 and not yet created (the aggregator lists them so the phase gate flags incompleteness; this is the designed FAIL-missing behavior, not a regression from this plan). All 3 of this plan's suites flipped from FAIL-missing to PASS; all 8 carried drift fences + the connector --check tripwire + the Part-8 grep sweep PASS.

## Deviations from Plan

### Auto-fixed Issues
None. No Rule 1/2/3 deviations were needed.

### Plan-structure note (not a deviation)
The plan lists Task 1 as the implementation and Task 2 as the tests, but both tasks carry `tdd="true"` and Task 1's `<verify>` is `node tests/test-148-real-invocation.cjs` (a Task-2 file). Following the TDD RED-GREEN contract, `test-148-real-invocation.cjs` was written FIRST (RED, failed on `fired_command undefined`), then the implementation made it GREEN, so the real-invocation suite was committed in the Task-1 commit rather than the Task-2 commit. `test-148-engine-reaches.cjs` was committed in Task 2. Net file set and behavior are exactly as the plan specifies.

## A4 No-Backfill Note (explicit decision)
Existing `SELECTED_REACH` edges in any room.db that point at the old `cmd:<plumbing-label>` target are NOT migrated. They are harmless historical system-bookkeeping; only NEW commits resolve to and point at the real engine command. This is a deliberate decision (Runtime State Inventory A4), not an omission.

## Canon / Constraint Compliance
- Part 8 zero Brain egress: no Brain call added; closeReach resolves locally and files locally. The new requires are command-resolver (local registry read) + findings-wirer (local write). PASS.
- Part 9 all writes via navigation.cjs: SELECTED_REACH + the artifact route through navigation.cjs / navigation re-exports; closeReach opens no room.db directly (the existing write-locality grep-audit in test-dial-close-reach.cjs still passes). The wireAccept fallback is required from findings-wirer.cjs (a workflow/core sibling, not a navigation submodule), which the audit allows. PASS.
- SELECTED_REACH stays system bookkeeping (created_by=system); no confirmNode promotion folded in. PASS.
- Frozen contracts: MAX_K=3, RECOMMEND_FLOOR=0.70, MARGIN_THRESHOLD=0.15 unchanged; DIAL_REACH_K=6 (already moved by Plan 01). PASS.
- No em-dashes / en-dashes in any new or edited file (verified by grep -P over the dash codepoints). PASS.

## Known Stubs
None. The `fireCommand` seam is an injection point, not a stub -- in production the orchestrator/Larry runs the resolved /mos: command; the seam exists so the integration test can assert the real command fired without spawning a subprocess. closeReach degrades honestly (manual-run instruction) when a framework is unresolvable, and surfaces the real filing readback (never a fake one).

## Self-Check: PASSED
- Created files verified on disk: test-148-engine-reaches.cjs, test-148-real-invocation.cjs, test-148-frozen-contracts.cjs, 148-04-SUMMARY.md; modified dial-close-reach.cjs present.
- Commits verified in git log: fc9b7bf4 (Task 1), 4142ab94 (Task 2), 4b8823ed (Task 3).

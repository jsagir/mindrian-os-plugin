---
phase: 166-gated-chain-executor
plan: 07
subsystem: chain-executor
tags: [larry, larry-extended, larry-personality, runChain, migration, consumer, handoff, auto-sequence, safe-halt, doc-content-gate, canon-part-3, canon-part-7, canon-part-8, canon-part-9, canon-part-10]
requires:
  - 166-02 (chain-executor.cjs runChain spine + makeGateFn + isIrreversibleStep + autonomous_safe gate)
  - 166-04 (act migration pattern: consumer onto the shared spine; autonomous_safe prefix auto-runs, halts at material)
  - 166-05 (pipeline migration pattern: provenanceFn:null for single-mode callers)
  - 166-06 (ignite migration pattern: the doc-as-deliverable + doc-content grep gate idiom this wave mirrors)
provides:
  - agents/larry-extended.md post-gate HANDOFF: after an APPROVE, the resolved chain is handed to runChain (the autonomous_safe prefix auto-runs, halts at the first material step)
  - skills/larry-personality/SKILL.md reach rule 8 (the auto-sequence branch) strictly subordinate to reach rule 1; gateFn still halts on every non-autonomous_safe step (D-166-05)
  - the GUIDED-default safe-halt rule + "One reach per beat" preserved VERBATIM (the auto-sequence can never be read as weakening them)
  - the Wave-7 extended DOC-CONTENT GREP GATE (HIGH-2 FIX): both larry docs name chain-executor/runChain + the auto-sequence token + the safe-halt rule verbatim
  - tests/test-larry-handoff-seam.cjs validating the runChain handoff CONTRACT both docs commit to
affects:
  - agents/larry-extended.md
  - skills/larry-personality/SKILL.md
  - tests/test-larry-handoff-seam.cjs
  - tests/run-all-166.sh
tech-stack:
  added: []
  patterns:
    - "doc-as-deliverable (extended to TWO surfaces): both larry surfaces are markdown with no runtime, so the migration is the doc EDIT; an extended doc-content grep gate proves BOTH docs committed to runChain AND preserved the safe-halt rule verbatim"
    - "auto-sequence-subordinate-to-safe-halt: the suggest->gate->wait contract gains an auto-sequence branch, but the gateFn STILL halts on every non-autonomous_safe step; the governing rule is preserved byte-intact and the branch is documented as subordinate, never weakening it"
    - "verbatim-preservation gate: the doc-content gate asserts the governing rule string ('ends in a Decision Gate, not a verdict') survives byte-intact -- a reword fails the gate RED (negative-tested)"
    - "resolver discipline + Part 8 OFFER-not-fetch carried onto the larry seam: the chain handed to runChain came from composeWorkflow / recipe-maps (never a slug from memory); the Brain push stays an OFFER (no fetch before the gate)"
key-files:
  created:
    - tests/test-larry-handoff-seam.cjs
  modified:
    - agents/larry-extended.md
    - skills/larry-personality/SKILL.md
    - tests/run-all-166.sh
decisions:
  - "the auto-sequence was added as a NEW reach rule (rule 8) leaving the existing reach rules 1-7e byte-intact, rather than rewriting rule 1 -- this preserves the safe-halt rule verbatim BY CONSTRUCTION (the governing rule is never touched; the new rule is documented as strictly subordinate to it). The verbatim count of 'ends in a Decision Gate, not a verdict' rose 1 -> 2 only because the new rule QUOTES the governing rule verbatim as the ceiling, never reworded"
  - "registered the EXISTING tests/test-reach-ids-drift.cjs doctrine suite (LARRY-03; reads HEAD:skills/larry-personality/SKILL.md and asserts the frozen exactly-6 reach-id set) rather than authoring a new doctrine regression suite -- the larry-personality reach doctrine already had a drift guard; the migration just needed it wired into the phase gate so the SKILL.md edit cannot drift the frozen reach-id / GUIDED-default contract unnoticed. test-larryreach-loop-health.cjs was NOT registered (it is a metrics-module test, not a SKILL.md doctrine guard)"
  - "the contract test models the seam directly against the real lib/core/chain-executor.cjs runChain with a localPostureFn stub (modeling recipe-maps.postureForCommand) and stub callbacks -- the runChain runtime is exercised for real (the autonomous_safe prefix auto-runs, the material step halts); the resolver / Brain-OFFER discipline is the stubbed contract the docs commit to"
  - "the Wave-7 doc-content gate is the HIGH-2 FIX: it asserts BOTH larry docs (not just one) name chain-executor AND runChain, AND the safe-halt rule survives verbatim, AND 'One reach per beat' survives -- extended beyond the Wave-6 single-doc gate because this wave touches two markdown surfaces and carries a verbatim-preservation obligation (D-166-05)"
metrics:
  duration: ~5 minutes
  completed: 2026-06-18
  tasks: 2
  files_created: 1
  files_modified: 3
  commits: 2
---

# Phase 166 Plan 07: MIGRATE the larry seam onto runChain Summary

The larry-extended / larry-personality handoff seam (the LAST migration) is now wired to the shared `lib/core/chain-executor.cjs` `runChain` spine. Before this wave these surfaces only SUGGESTED a next step: larry-personality's reach rules surfaced ONE line and ended at a Decision Gate, and larry-extended waited for the navigator to re-type the command. This wave wires the suggest-to-run seam: after a gate-APPROVED step, larry-extended hands the RESOLVED chain (the composeWorkflow output, autonomous_safe prefix) to runChain instead of waiting for re-typed commands; runChain auto-runs the autonomous_safe prefix underneath as machinery and HALTS at the first material step. The larry-personality suggest-gate-wait contract gains an AUTO-SEQUENCE branch (reach rule 8) that is STRICTLY SUBORDINATE to the GUIDED-default safe-halt rule: gateFn still halts on every non-autonomous_safe step (D-166-05), and the governing rule "Reaching surfaces evidence; it never decides for the navigator. Every contradiction and every cross-room find ends in a Decision Gate, not a verdict." is preserved VERBATIM. Because both larry surfaces are markdown with no runtime, the deliverable is the DOC EDIT, and an extended DOC-CONTENT GREP GATE proves BOTH docs committed to runChain AND kept the safe-halt rule byte-intact.

## What Was Built

**Task 1 (commit `6d940932`) -- the doc edits + the contract test.** `agents/larry-extended.md` gains a "Post-Gate Handoff (Phase 166 -- the suggest-to-run seam)" section that names `lib/core/chain-executor.cjs` and `runChain` and commits to the handoff contract: after an APPROVE, the resolved chain (composeWorkflow / command-resolver output, never a slug from memory) is handed to runChain; the autonomous_safe prefix auto-runs and the chain halts at the first material step; posture is joined from the local registry via recipe-maps; no approve = no handoff (GUIDED default holds); Part 8 -- the handoff opens no Brain wire, the Brain push stays an OFFER. `skills/larry-personality/SKILL.md` gains reach rule 8 (the auto-sequence branch) inserted ahead of rule 7e, leaving reach rules 1-7 byte-intact: it documents the auto-sequence as strictly subordinate to rule 1, quotes the governing safe-halt rule verbatim as the ceiling, states the gateFn MUST still halt on every non-autonomous_safe step, and preserves the resolver discipline + Part 8 OFFER-not-fetch. `tests/test-larry-handoff-seam.cjs` validates the runChain CONTRACT the docs commit to: Test 1 (handoff -- after approve, the autonomous_safe prefix auto-runs and halts at the first material step, no re-typed commands), Test 2 (still halts on material -- a mid-chain material step stops the auto-run, the material step is never auto-run, the step after it is never auto-run), Test 3 (GUIDED preserved -- no approve = nothing auto-runs, one suggest line, end at the gate), Test 4 (resolver discipline + Part 8 -- the chain came from composeWorkflow with resolver-attached /mos: slugs, posture from the local registry, no Brain fetch), Test 5 (the seam delegates to runChain; the default makeGateFn runs an autonomous_safe step and halts a material one), Test 6 (both docs name chain-executor/runChain + the safe-halt rule + "One reach per beat" survive verbatim).

**Task 2 (commit `c0fc6466`) -- registration + the extended doc-content grep gate.** `tests/run-all-166.sh` registers the Wave-7 handoff-seam suite plus the EXISTING `test-reach-ids-drift.cjs` doctrine suite (LARRY-03; reads `HEAD:skills/larry-personality/SKILL.md` and asserts the frozen exactly-6 reach-id set, so the SKILL.md edit cannot drift the frozen reach-id / GUIDED-default contract unnoticed). The HIGH-2 FIX Wave-7 DOC-CONTENT GREP GATE asserts (a) BOTH `agents/larry-extended.md` AND `skills/larry-personality/SKILL.md` name `chain-executor` AND `runChain` (fail if either string is missing from either file), (b) SKILL.md documents the `auto-sequence` branch, (c) the non-autonomous_safe SAFE-HALT rule "ends in a Decision Gate, not a verdict" is preserved VERBATIM (fail if deleted or reworded), and (d) "One reach per beat" survives. The Part-8 sweep was extended to the two larry markdown surfaces (assert no pre-gate Brain fetch was added: the OFFER-not-fetch rule survives), and the em-dash sweep was extended to cover both larry docs + the new suite.

## How "Both Docs Committed To runChain And Kept The Safe-Halt Rule" Is VERIFIED

The HIGH-2 gap is that both larry surfaces are markdown with no runtime, so a stubbed .cjs test can pass while the docs still describe the OLD suggest-and-wait loop OR silently weaken the safe-halt rule. The fix is the extended doc-content grep gate, proven by two negative tests:

1. Rewording the safe-halt rule (`ends in a Decision Gate, not a verdict` -> `ends in a decision gate, sometimes a verdict`) makes `bash tests/run-all-166.sh` exit 1 with "MISSING/REWORDED safe-halt rule" (the gate fails RED when the governing rule is weakened).
2. Stripping `chain-executor` from larry-extended.md makes the suite exit 1 with "larry-extended.md does NOT name chain-executor" (the gate fails RED when a doc drops the runtime name).
3. Restoring the cured docs makes the suite exit 0 (the gate passes GREEN only when BOTH docs name runChain AND the auto-sequence token AND the safe-halt rule + "One reach per beat" survive verbatim).

The .cjs test validates the runChain handoff contract; the grep gate validates that the docs committed to it and kept the safe-halt rule byte-intact.

## Deviations from Plan

None - plan executed exactly as written. The contract test models the seam against the real runChain runtime with a localPostureFn stub (modeling recipe-maps.postureForCommand) rather than wiring the live recipe-maps + composeWorkflow chain; the runChain runtime is exercised for real (the autonomous_safe prefix auto-runs, the material step halts), and the resolver / Brain-OFFER discipline is the stubbed contract the docs commit to. The plan asked to "register any existing larry-personality / larry-extended doctrine regression suite present in tests/" -- the LARRY-03 reach-id drift suite (test-reach-ids-drift.cjs) was found and registered; test-larryreach-loop-health.cjs was deliberately NOT registered (it is a metrics-module test, not a SKILL.md doctrine guard).

## Canon / Hard-Rule Gates

- **Canon Part 3 (Tri-Context Decision Gate):** the auto-sequence runs ONLY the registry-blessed autonomous_safe subset and halts at every material step; each halt hands to the Tri-Context Decision Gate. The navigator decides at every material gate; no material step is ever auto-run (Test 2).
- **Canon Part 7 (Reuse Before Build):** the larry surfaces re-implement no loop and no posture -- the walk ownership is the shared runChain spine; the suggest line, the GUIDED default, "One reach per beat", and the Part 8 OFFER-not-fetch discipline all KEPT byte-intact; only the post-approve handoff is new. The existing reach-id drift doctrine suite was reused, not re-authored.
- **Canon Part 8 (Graph Boundary), B2:** `decide()` shape untouched (navigation-engine.cjs unmodified this plan). The handoff adds no Brain wire; the Brain push stays an OFFER (the fetch fires only after the gate). The Part-8 sweep PASSED over the Phase-166 lib surfaces AND the two larry markdown surfaces (no pre-gate Brain fetch added).
- **Canon Part 9:** the chain handed to runChain came from composeWorkflow / recipe-maps (never a slug from memory); runChain writes through the existing chokepoints via onStep.
- **Canon Part 10 (Conversation as Product):** Larry suggests, the human approves at the gate, and the approved autonomous prefix runs underneath as machinery, surfacing only at the next material gate ("the chain runs underneath as machinery, surfacing only at material gates").
- **D-166-05 (the HARD RULE):** the auto-sequence branch MUST still halt on every non-autonomous_safe step. Preserved VERBATIM: the governing reach rule string "ends in a Decision Gate, not a verdict" + "One reach per beat" + the OFFER-not-fetch rule. Citations re-anchored on the content strings (reach rule 1, reach rule 2), NOT the stale "SKILL.md:59".
- **No em-dashes:** direct + runner em-dash sweeps PASSED over all edited + created files.
- **Suite registration:** Wave-7 suite + the reach-id drift doctrine suite appended to run-all-166.sh CJS_SUITES (prior Wave 1-6 entries untouched); full suite green 20/20.

## Verification Evidence

- `node tests/test-larry-handoff-seam.cjs` -> PASS (6/6: handoff + still-halts-on-material + GUIDED-preserved + resolver/Part 8 + delegation + doc-content)
- `bash tests/run-all-166.sh && grep -q "auto-sequence" skills/larry-personality/SKILL.md && grep -q "chain-executor" agents/larry-extended.md && grep -q "ends in a Decision Gate, not a verdict" skills/larry-personality/SKILL.md` -> 20/20 PASSED, LARRY_DOC_OK
- Negative gate proof 1: rewording the safe-halt rule -> suite exit 1 ("MISSING/REWORDED safe-halt rule"); restored -> exit 0
- Negative gate proof 2: stripping chain-executor from larry-extended.md -> suite exit 1 ("does NOT name chain-executor"); restored -> exit 0
- `grep -c "ends in a Decision Gate, not a verdict" skills/larry-personality/SKILL.md` -> 2 (original verbatim + the new rule's verbatim quote of the governing rule)
- `grep -c "One reach per beat" skills/larry-personality/SKILL.md` -> 3 (preserved)
- B2 untouched: `git diff --name-only HEAD~2 HEAD` lists only the four plan files; navigation-engine.cjs absent

## Known Stubs

None. The doc edits commit to calling the real `lib/core/chain-executor.cjs runChain` and the real composeWorkflow / recipe-maps resolver; the runtime ships from Wave 2. The contract test's localPostureFn + stub callbacks are test seams (modeling recipe-maps.postureForCommand and the resolved-chain shape), not production stubs -- the docs commit to the live runChain handoff. `provenanceFn` is not passed by the larry seam (single-mode, mirroring act and ignite), which is BY DESIGN, not a stub.

## Self-Check: PASSED

All created/modified files exist on disk (tests/test-larry-handoff-seam.cjs, agents/larry-extended.md, skills/larry-personality/SKILL.md, tests/run-all-166.sh, 166-07-SUMMARY.md) and both task commits (6d940932, c0fc6466) are present in git history.

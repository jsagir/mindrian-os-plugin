---
phase: 385
plan: 12
subsystem: cleanup-proof
tags: [ruling-table, no-caller-scan, checkpoint]
requirements-completed: []
key-files:
  created: [.planning/phases/385-behaviour-preserving-cleanup-remove-what-does-nothing-audito/385-PROOF.md, .planning/phases/385-behaviour-preserving-cleanup-remove-what-does-nothing-audito/385-no-caller-scan.cjs]
completed: 2026-11-06
---

# Phase 385 Plan 12: Proof and ruling table for R1 to R10 Summary

A read-only scan script and a ruling table with proof for R1 to R10. Nothing was deleted and no product file changed. The plan ends at the owner checkpoint.

## Commit

- fc3b3fc9f docs(385-12): proof and ruling table for the cleanup items that need the owner (2 paths).
- 4cc6a3c0c docs(385-12): rewrite R6 to the stepwise Pinecone removal path after the owner statement (PROOF only). Plan 385-12-PLAN.md was edited by commit b08daf773 after the first PROOF commit; R6 changed from keep to a three-step removal path.
- Revert note: `git revert fc3b3fc9f` removes the two files. Nothing depends on them.

## Scan results (HEAD 361463852, PROVEN)

- lib/core: 562 scanned, 2 no-reference (deep-links, platform-gates), 19 test-only (4,392 lines), closure adds 2 modules (260 lines). Dead set 23 modules, 4,854 lines.
- scripts plus lib/hmi plus lib/workflow: 373 scanned, 9 no-reference (2,718 lines), 37 test-only (14,843 lines), closure adds 9 modules (4,640 lines). Dead set 55 modules, 22,201 lines.

## Differences from the planner numbers

- lib/core no-reference 3 to 2: plan 385-03 removed asset-ops.cjs.
- lib/core test-only 15 to 19 (2,629 to 4,392 lines): 4 extra modules. part8-sprout-shape is new (Phase 386-37). expert-genesis, graph-refine-loop and recovery/controller are found by this scan style. The reason is UNVERIFIED (the planner second scan style probably matched extensionless requires).
- scripts, hmi, workflow no-reference 10 to 9: plan 385-07 removed release-beta-preflight.sh. Test-only equal at 37.
- check-* with no production caller: the scan finds 4, the auditor counted 15, not reproducible.
- R6: the plan changed during the run (owner statement 2026-11-06); PROOF section 7 follows the new text. scripts/consolidate-pinecone.py already lost its key-shaped default (commit a750bd94e).
- hooks.json command count 46 to 45 (plan 385-08). operator-update line numbers moved to 333 and 409.
- `npm ci --dry-run` baseline in plan 385-02 was 10 packages, not 147.
- Phase 386 work now touches the registry readers (tests/test-386-registry-readers.cjs). scripts/operator-update.cjs was still unchanged at this HEAD, so the R2 bug still stands.

## Checkpoint

Returned to the main session:

`NEEDS_HUMAN: Approve the recommended rulings in 385-PROOF.md? Recommended: R1 unwire the doctor poll Stop hook; R2 unwire the operator-update PostToolUse and UserPromptSubmit hooks (script stays); R6 Pinecone is not part of the build: delete the dead pinecone-inference module first, bring a migration list for rs-pinecone-bridge before any other Pinecone deletion, and fix the consolidate-pinecone.py key default in a separate quick task; R3, R4, R5, R7, R8, R9 and R10 keep everything and delete nothing (kuzu, LazyGraph, Neo4j, Memgraph, chokidar, test-only modules). Answer approve, or list the R numbers to change.`

## Deviations

None. No removal plan and no draft plan was written.

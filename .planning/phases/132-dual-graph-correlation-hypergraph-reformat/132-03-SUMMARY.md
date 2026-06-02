---
phase: 132-dual-graph-correlation-hypergraph-reformat
plan: 03
subsystem: brain-curation-machinery
tags: [cross-label-dedup, held-rename, curation-batch, snapshot-precondition, reversibility, canon-part-7, canon-part-8, re-baseline]
requires:
  - 132-01  # the curation-batch runner (makeBatch) this routes every write through
  - 130.7-01  # computeCorrelationId + LABEL_PRIORITY (reused, never re-derived)
provides:
  - scripts/curation-132-03-dedup-held-rename.cjs   # dedup-collapse pass + held-rename pass (machinery)
  - lib/memory/curation-132-03-dedup-held-rename.test.cjs  # 13 fixture assertions
affects:
  - "Orchestrator live cleanup (snapshot-first): runs buildDedupCollapsePass on the 1 live pair + buildHeldRenamePass on the 14 held nodes once canonical names are assigned"
tech-stack:
  added: []   # ZERO new deps -- reuses makeBatch (132-01) + computeCorrelationId/LABEL_PRIORITY (130.7) + Node built-ins
  patterns:
    - "every write routes through makeBatch (132-01 runner): created_by stamping + asserted rollback-by-created_by + Part 8 scan + inherited write-time 130.7 guard"
    - "correlation_ids come ONLY from computeCorrelationId(name, label) -- reuse, never re-hash (Canon Part 7)"
    - "pickCanonical tiebreak reuses the LOCKED LABEL_PRIORITY from correlation-label-index.cjs"
    - "snapshotRequired flag on node-merge batches -- documents the one irreversibility created_by rollback cannot cover"
    - "live worklist constants carry null canonical_name; --execute refuses until every name is assigned (orchestrator-run, snapshot-first)"
key-files:
  created:
    - scripts/curation-132-03-dedup-held-rename.cjs
    - lib/memory/curation-132-03-dedup-held-rename.test.cjs
  modified:
    - tests/run-all-132.sh                 # additive: +1 CJS suite
    - lib/memory/run-feynman-tests.cjs     # additive Phase 132-03 block (diff is additions only)
decisions:
  - "RE-BASELINE applied per the prompt scope override: built GENERIC dedup-collapse + held-rename MACHINERY against the TINY live worklist (1 dedup pair 6831/22816 + 14 held nodes), NOT the stale ~50-group / 22-REVIEW_REQUIRED targets the as-written 132-03 plan named (those are almost entirely resolved by the dogfooding session + the 130.7 backfill)"
  - "dedup archive is reversible-delete (:Archived + REPLACED_BY -> keeper correlation_id), NEVER DETACH DELETE (Canon Part 7 + audit Section 9)"
  - "the dedup MERGE flags snapshotRequired=true because a node-merge re-points the loser incoming edges; created_by rollback can DELETE the migrated edges but cannot perfectly reconstruct the pre-merge edge set, so the orchestrator MUST snapshot before --execute"
  - "held-rename is fully created_by-reversible (node-property + held marker only) so it does NOT require a snapshot"
  - "live --execute/--rollback is orchestrator-run, snapshot-first, and is NOT invoked from this script in this plan (machinery only; ZERO live writes); the CLI refuses --execute while any live held node still has a null canonical_name"
metrics:
  duration: ~6m
  completed: 2026-06-02
  tasks: 2
  files_created: 2
  files_modified: 2
  live_brain_writes: 0
  new_dependencies: 0
---

# Phase 132 Plan 03: Cross-Label Dedup-Collapse + Held-Name-Rename Machinery Summary

The generic dedup-collapse + held-name-rename machinery that consumes the 132-01 curation-batch runner, RE-BASELINED against the tiny live worklist (1 dedup pair + 14 held nodes) and tested entirely on FIXTURES, with ZERO live Brain writes and ZERO new dependencies.

## Re-baseline note (load-bearing)

Phase 132 is re-baselined off the LIVE teaching graph (Phase 131 close-out packet, 2026-06-01). The graph is ALREADY clean: 721 backfilled correlation_ids, 0 collisions. The 132-03 plan as-written targets ~50 cross-label dup groups + 22 REVIEW_REQUIRED -- those are STALE and almost entirely resolved by the 2026-05-17 dogfooding session + the 130.7 backfill. The REAL live worklist is:

- **1 dedup pair:** `'The Other Way Round' | Technique`, node ids 6831 + 22816 (identical name + label; a legit collapse candidate).
- **14 held nodes** (name length > 80, `correlation_status='held-name-not-canonical'`): 10 :Method (9655/9271/9502/9622/9528/9491/9551/9625/9529/9586) + 4 :Framework (10468/10455/7841/10102). Each needs a canonical name assigned, its correlation_id recomputed, the held marker cleared, and the 3-property backfill applied.

Per the prompt scope override, this plan builds the GENERIC MACHINERY (a dedup-collapse pass + a held-rename pass) and tests it on fixtures mirroring those two shapes. It does NOT run live -- the orchestrator runs the tiny live worklist later, snapshot-first.

## What shipped

`scripts/curation-132-03-dedup-held-rename.cjs` exports two passes plus the canonical-pick rule:

1. **`pickCanonical(nodes)`** -- most-edged node wins; on an edge_degree tie the higher-priority primary label wins, reusing the LOCKED `LABEL_PRIORITY` from `correlation-label-index.cjs` (Framework > Technique > Method > Tool > ...). Verified on the live shape (6831 degree-7 beats 22816 degree-2) and on a tie fixture (:Framework beats :Method at equal degree).

2. **`buildDedupCollapsePass(groups, batchN)`** -- per group: pick the keeper, stamp its canonical `correlation_id = computeCorrelationId(name, label)` (reused, NO re-hash; the anchor `'The Other Way Round'|'Technique'` resolves to `4210289a0ca1596b`, byte-identical to the locked contract), migrate every incoming edge from each loser onto the keeper (additive MERGE carrying `created_by`), and archive each loser via `SET :Archived` + `MERGE (loser)-[:REPLACED_BY {created_by}]->(keeper)` pointing at the keeper correlation_id. NEVER `DETACH DELETE` (reversible-delete only, Canon Part 7 + audit Section 9). The batch flags `snapshotRequired=true` with a documented `SNAPSHOT_PRECONDITION`: a node-merge re-points the loser's incoming edges, so `created_by` rollback can DELETE the migrated edges but cannot perfectly reconstruct the pre-merge edge set -- the orchestrator MUST snapshot before `--execute`.

3. **`buildHeldRenamePass(held, batchN)`** -- per held node: assign the canonical name, recompute `correlation_id = computeCorrelationId(canonical_name, label)` (no re-hash), apply the 3-property `curated-v1` backfill (`correlation_id` + `correlation_scope='curated-v1'` + `correlation_backfilled_at`), clear the held marker (`REMOVE correlation_status`), and stamp `held_rename_by` for rollback selection. The paired rollback restores `correlation_status='held-name-not-canonical'` and removes the backfill, all by the `created_by` selector. Fully reversible -- no snapshot required.

Both passes route every write through `makeBatch({batchId:'phase-132-curation-batch-N', ...})` so they inherit the 132-01 runner's created_by stamping, `assertRollbackPath` (each rollback names the same created_by selector its forward write stamped), `scanBatchForUserContent` (Part 8), and the write-time 130.7-contract guard on `--execute`. Default mode is `--dry-run` (creds-free, ZERO writes). `--execute`/`--rollback` are orchestrator-run, snapshot-first, and refuse to run from this script (machinery-only); `--execute` additionally refuses while any live held node still has a null canonical_name.

`tests/run-all-132.sh` and the Phase 132 block in `lib/memory/run-feynman-tests.cjs` gained the suite additively (both diffs are additions only).

## Verification results

| Gate | Result |
|------|--------|
| `lib/memory/curation-132-03-dedup-held-rename.test.cjs` | 13/13 GREEN |
| dedup fixture: keeper cid `4210289a0ca1596b` via computeCorrelationId | matches locked contract |
| dedup fixture: :Archived + REPLACED_BY, NO DETACH DELETE, snapshotRequired=true | confirmed |
| held fixture: cid recompute + curated-v1 3-property backfill + held marker cleared | confirmed |
| both passes: assertRollbackPath + scanBatchForUserContent == [] | Part 8 clean |
| `--execute` refusal (null canonical names) | exit 2, ZERO live writes |
| `bash tests/run-all-132.sh` | 3/3 PASSED |
| `bash tests/run-all-130.sh` (regression) | 4/4 PASSED |
| `bash tests/run-all-130.7.sh` (regression) | 7/7 PASSED |
| `bash tests/run-all-131.sh` (regression) | 0 failed |
| `node tests/test-navigation-acceptance.cjs` (regression) | 1/1 PASSED |
| Feynman runner + run-all-132 diffs | additive-only (no removed lines) |
| `git diff package.json` | empty (ZERO new deps) |
| em-dash scan | clean (hyphens only) |
| substrate guard + brain-boundary-scan (pre-commit) | passed on all 3 commits (no --no-verify) |

## ZERO live Brain writes -- confirmation

No `--execute` path ran live. The dedup + held tests drive only `dryRun()` + pure assertions; `makeBatch.execute()` was never invoked. The `~/.mindrian/curation-batch.jsonl` audit log the live `execute()` would append to is untouched by this plan. The live worklist constants carry null canonical names and the CLI refuses `--execute` until every name is assigned -- the orchestrator runs the tiny live cleanup later, snapshot-first.

## Commits

| Task | Commit | Subject |
|------|--------|---------|
| 1 (RED) | `50abe4d9` | test(132-03): RED -- dedup-collapse + held-rename machinery fixtures |
| 1 (GREEN) | `0225062f` | feat(132-03): dedup-collapse + held-rename machinery (re-baselined, fixtures only) |
| 2 | `c9de6391` | test(132-03): register dedup/held-rename suite in run-all-132 + Feynman (additive) |

## Deviations from Plan

**1. [Rule 4 - Scope, pre-authorized by the prompt RE_BASELINE_SCOPE_OVERRIDE] Re-baselined the target worklist.** The as-written 132-03 plan targets ~50 cross-label dup groups + 22 REVIEW_REQUIRED with a `CROSS_LABEL_GROUPS.length >= 45` floor and `REVIEW_REQUIRED_22` enumeration. The prompt's RE_BASELINE_SCOPE_OVERRIDE supersedes this: the live graph is already clean, the real worklist is 1 dedup pair + 14 held nodes, and the job is to build GENERIC dedup-collapse + held-rename MACHINERY tested on fixtures mirroring those shapes. The exported API is therefore `pickCanonical` / `buildDedupCollapsePass` / `buildHeldRenamePass` / `SNAPSHOT_PRECONDITION` (not `CROSS_LABEL_GROUPS` / `CROSS_LABEL_GROUP_MIN` / `REVIEW_REQUIRED_22` / `buildDedupBatch`), and the snapshot precondition for the node-merge MERGE is enforced/documented as the override demands. This was a user decision in the prompt, not an executor architectural choice.

No Rule 1-3 auto-fixes were required.

## TDD Gate Compliance

Task 1 carried `tdd="true"`. RED was confirmed (`Cannot find module '../../scripts/curation-132-03-dedup-held-rename.cjs'`) and committed as the `test(...)` commit `50abe4d9` before any implementation. GREEN (`0225062f`) is the `feat(...)` commit. One in-GREEN fix landed before the commit: test 11 asserted the held marker literal appears in the rollback Cypher body, so the rollback was edited to inline `'held-name-not-canonical'` (a generic curation enum, Part 8 safe) rather than bind it as a param -- caught and fixed during the GREEN iteration, not a post-commit deviation. No REFACTOR commit was needed.

## Known Stubs

None. The live `--execute`/`--rollback` paths are intentionally un-run gated machinery (the orchestrator runs them snapshot-first), not stubs -- they are complete and route through the shipped 132-01 runner. The `LIVE_HELD_NODES` constants carry `canonical_name: null` BY DESIGN: the canonical names are a human/orchestrator assignment made at live-execution time, and the CLI fails closed (refuses `--execute`) until every name is assigned.

## Self-Check: PASSED

- scripts/curation-132-03-dedup-held-rename.cjs -- FOUND
- lib/memory/curation-132-03-dedup-held-rename.test.cjs -- FOUND
- commit 50abe4d9 -- FOUND
- commit 0225062f -- FOUND
- commit c9de6391 -- FOUND

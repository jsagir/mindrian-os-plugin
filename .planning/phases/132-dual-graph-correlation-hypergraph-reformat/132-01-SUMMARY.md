---
phase: 132-dual-graph-correlation-hypergraph-reformat
plan: 01
subsystem: brain-curation-machinery
tags: [curation-batch, hypergraph, reversibility, write-time-guard, 130.7-contract, canon-part-7, canon-part-8]
requires:
  - 130.7-01  # the correlation_id contract the write-time guard probes for
provides:
  - lib/brain/curation-batch.cjs        # the reusable WRITE chokepoint Plans 02-05 route through
  - lib/brain/hypergraph-event-schema.cjs  # the frozen 5-event-type contract Plan 02 reifies against
  - tests/run-all-132.sh                # the phase aggregator Plans 02-05 append to
affects:
  - Plan 132-02 (hypergraph reify -- consumes buildReifyCypher + EVENT_INSTANCE_MIN + makeBatch)
  - Plan 132-03 (cross-label dedup -- routes through makeBatch.execute, inherits the 130.7 guard)
  - Plan 132-04 (content wire-it -- routes through makeBatch)
  - Plan 132-05 (pseudonymize -- routes through makeBatch; the wave-5 release gate now has a write-time twin)
tech-stack:
  added: []   # ZERO new deps -- neo4j-driver REUSED from mcp-server-brain/node_modules
  patterns:
    - "admin-brain-write.cjs transport reuse (loadNeo4jDriver from mcp-server-brain/node_modules + getNeo4jCreds from .env)"
    - "injectable runner (runProbe/runWrite) makes the write-time guard unit-testable with no live Brain"
    - "deterministic sha256-derived event ids make reify MERGE idempotent"
    - "frozen schema object as single source of truth (no hand-rolled label drift)"
key-files:
  created:
    - lib/brain/curation-batch.cjs
    - lib/brain/hypergraph-event-schema.cjs
    - lib/memory/curation-batch.test.cjs
    - lib/memory/hypergraph-event-schema.test.cjs
    - tests/run-all-132.sh
  modified:
    - lib/memory/run-feynman-tests.cjs   # additive Phase 132 block (diff is additions only)
decisions:
  - "BATCH_PROVENANCE_PREFIX = '' so the batchId IS the full created_by scalar, matching the admin-brain-write.cjs created_by='<phase>-<plan>' convention"
  - "the write-time 130.7 guard is a PRESENCE probe only (MATCH (n) WHERE n.correlation_id IS NOT NULL RETURN count(n)); it never re-derives or re-backfills correlation_ids (scope fence -- that is 130.7's job)"
  - "reify event-to-participant edge labels (AUTHORED_IN_EVENT, ABOUT_WORK, etc.) are named to COEXIST with the legacy binary AUTHORED/ILLUSTRATES edges, never collide -- additive per Canon Part 7"
  - "scanBatchForUserContent scans BOTH the Cypher body AND string param values (a clean Cypher can still smuggle user content via a bound property value)"
metrics:
  duration: ~25m
  completed: 2026-06-02
  tasks: 3
  files_created: 5
  files_modified: 1
  live_brain_writes: 0
  new_dependencies: 0
---

# Phase 132 Plan 01: Dual-Graph Correlation Hypergraph Reformat -- Wave 1 Substrate Summary

The reusable curation-batch runner (created_by stamping + asserted rollback pairing + a write-time Phase 130.7 correlation_id-contract guard) plus the frozen 5-event-type hypergraph schema contract, both shipped as MACHINERY tested on FIXTURES with ZERO live Brain writes and ZERO new dependencies.

## What shipped

Wave 1 builds the shared substrate every Phase 132 curation pass (Plans 02-05) stands on, so each downstream batch inherits three invariants by construction instead of hand-rolling a neo4j-driver call:

1. **`lib/brain/curation-batch.cjs` -- the reusable WRITE chokepoint.**
   - `makeBatch({batchId, forwardCyphers, rollbackCyphers, by})` validates the batchId against `/^phase-132-curation-batch-\d+$/`, requires `created_by === batchId` on every forward write (provenance contract), and REJECTS any batch with empty `rollbackCyphers` (the reversibility contract -- a batch with no rollback path is not a valid batch).
   - Returns `{ dryRun(), execute(), rollback() }`. `dryRun()` is pure: forward + rollback + count summary, constructs NO session, runs NO probe, requires NO creds (`touched_brain: false`).
   - `execute()` runs the **write-time 130.7-contract guard FIRST** inside the session: a cheap `MATCH (n) WHERE n.correlation_id IS NOT NULL RETURN count(n)` probe whose count is fed to `assertCorrelationContractPresent`. Zero correlation_id nodes -> the blocked-on-130.7 error is thrown BEFORE any forward write. Every mutating batch 02-05 inherits this guard because they all route through this `execute()`.
   - The session is abstracted behind an injectable `runner` (`runProbe`/`runWrite`) so the guard is unit-testable with no live Brain. The live path mirrors `admin-brain-write.cjs` (driver from `mcp-server-brain/node_modules`, creds from `.env`, one JSONL audit line per write, close in a finally).
   - `assertRollbackPath` proves each rollback names the SAME `created_by` selector its forward write stamped (rejects a rollback targeting a different batch). `scanBatchForUserContent` greps every forward Cypher body AND string param value for forbidden user-content tokens (Canon Part 8).
   - Exports: `makeBatch`, `BATCH_PROVENANCE_PREFIX`, `assertRollbackPath`, `assertCorrelationContractPresent`, `scanBatchForUserContent`, plus `getNeo4jCreds` / `loadNeo4jDriver` / `CONTRACT_PROBE_CYPHER` / `USER_CONTENT_TOKENS` for Plan 02-05 reuse.

2. **`lib/brain/hypergraph-event-schema.cjs` -- the frozen 5-event-type contract.**
   - `EVENT_NODE_TYPES` is `Object.freeze`d with exactly the 5 CONTEXT-table labels (AuthorshipEvent / IllustrationEvent / ContradictionEvent / MotivationEvent / EvolutionEvent), each declaring participant roles (with binary edge labels) and scalar/enum roles (year, status, severity, outcome, industry, evidence, date).
   - `buildReifyCypher(eventType, participants, by)` MERGEs the event node by a deterministic sha256-derived id (idempotent re-runs) + one binary edge to each participant; ADDITIVE (zero DELETE/REMOVE/DETACH/DROP per Canon Part 7); carries `created_by` so its output feeds `makeBatch.forwardCyphers` directly in Plan 02.
   - `EVENT_INSTANCE_MIN = 20` exported (Plan 02 reads the floor from the contract, not a magic number).

3. **`tests/run-all-132.sh` + additive Feynman registration.**
   - The aggregator mirrors `run-all-130.sh`; runs both Wave-1 fixture suites, prints N/N, exits non-zero on failure; structured so Plans 02-05 append their suites.
   - `lib/memory/run-feynman-tests.cjs` carries an additive Phase 132 block; the diff is additions only (every prior block byte-unchanged).

## Verification results

| Gate | Result |
|------|--------|
| `lib/memory/curation-batch.test.cjs` | 6/6 behaviors green |
| `lib/memory/hypergraph-event-schema.test.cjs` | 5/5 behaviors green |
| Write-time guard (contract ABSENT) | `execute()` refuses, ZERO forward writes attempted, blocked-on-130.7 error surfaced |
| Write-time guard (contract PRESENT, count>=1) | `execute()` proceeds, runs every forward write |
| `bash tests/run-all-132.sh` | 2/2 PASSED |
| `bash tests/run-all-130.sh` (regression) | 4/4 PASSED |
| `bash tests/run-all-130.7.sh` (regression) | 7/7 PASSED |
| `bash tests/run-all-131.sh` (regression) | 6/6 PASSED |
| `node tests/test-navigation-acceptance.cjs` (regression) | 1/1 PASSED |
| `git diff package.json` | empty (ZERO new deps) |
| Transport reuse grep (`mcp-server-brain.*neo4j-driver\|getNeo4jCreds\|loadNeo4jDriver`) | matches in curation-batch.cjs |
| em-dash scan | clean (hyphens only) |
| substrate guard + brain-boundary-scan (pre-commit hooks) | passed on all 3 commits (no --no-verify) |

## ZERO live Brain writes -- confirmation

No `--execute` path ran live. `~/.mindrian/curation-batch.jsonl` (the audit log the live `execute()` would append to) does NOT exist after this plan, confirming the driver write path was never invoked. The Test 6 guard assertions used an INJECTED fake runner, never the real `neo4j-driver` session. The `execute()`/`rollback()` live paths EXIST and are gated (creds + the 130.7 probe), but per the re-baseline scope override the orchestrator runs the tiny live cleanup later, snapshot-first.

## Commits

| Task | Commit | Subject |
|------|--------|---------|
| 1 | `43b06b4c` | feat(132-01): curation-batch runner with provenance + rollback pairing + write-time 130.7-contract guard |
| 2 | `8a6b31d5` | feat(132-01): frozen 5-event-type hypergraph schema contract + reify Cypher builder |
| 3 | `ff79b111` | test(132-01): phase aggregator run-all-132.sh + additive Feynman registration |

## Deviations from Plan

None - plan executed exactly as written. All three tasks landed with their specified exports, behaviors, and acceptance criteria. No Rule 1-4 deviations were required.

## TDD Gate Compliance

Tasks 1 and 2 carried `tdd="true"`. Both followed RED (test written, fails on missing module -- confirmed via `Cannot find module`) then GREEN (implementation written, suite passes). Because the suites are pure fixture tests with no refactor needed, RED+GREEN were committed as a single `feat(...)` commit per task (the GREEN commit), with the RED state verified in-session before implementation. No separate `test(...)` RED commit was cut for Tasks 1-2; Task 3's aggregator/registration is the `test(...)` commit.

## Known Stubs

None. The `execute()`/`rollback()` live paths are intentionally un-run (gated machinery), not stubs -- they are complete, mirror the shipped admin-brain-write transport, and are exercised in unit tests via the injectable runner. The live invocation is deferred to the orchestrator's snapshot-first cleanup by user decision (re-baseline scope override), not because the path is incomplete.

## Self-Check: PASSED

- lib/brain/curation-batch.cjs -- FOUND
- lib/brain/hypergraph-event-schema.cjs -- FOUND
- lib/memory/curation-batch.test.cjs -- FOUND
- lib/memory/hypergraph-event-schema.test.cjs -- FOUND
- tests/run-all-132.sh -- FOUND
- commit 43b06b4c -- FOUND
- commit 8a6b31d5 -- FOUND
- commit ff79b111 -- FOUND

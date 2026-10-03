---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
plan: 06
subsystem: database
tags: [transactions, change-log, d-18, writers, node-sqlite]

requires:
  - phase: 369-04
    provides: fixture-room-369 builder, run-all-369.sh aggregator leg, writer inventory
  - phase: 369-05
    provides: room_change_log triggers and withRoomTx (transaction_id stamp)
provides:
  - owns idiom (db.isTransaction !== true) at the eight unconditional-BEGIN writer sites in seven files
  - promoteNodeStatus (the confirmNode / gate_answer path) composes inside withRoomTx with no nested BEGIN
  - tests/test-369-tx-ownership.cjs, a static pin at all eight sites plus behavioural composition arms
affects: [369-26 gate ratification durable-consumption rule, any later multi-writer composition]

tech-stack:
  added: []
  patterns:
    - "const owns = db.isTransaction !== true; open, COMMIT and ROLLBACK only when owns; rethrow without rollback when composed (the frame-provenance.cjs idiom)"
    - "Static source pin: extract the function body and assert every transaction statement is owns-guarded"

key-files:
  created:
    - tests/test-369-tx-ownership.cjs
  modified:
    - lib/core/navigation/transitions.cjs
    - lib/core/navigation/focus.cjs
    - lib/core/navigation/file-evidence-readback.cjs
    - lib/core/room-discard-cascade.cjs
    - lib/core/ambient-run.cjs
    - lib/core/lazygraph-ops.cjs
    - lib/core/breakthrough/schema.cjs

key-decisions:
  - "Standalone SQL is byte-for-byte unchanged: same BEGIN keyword (no IMMEDIATE upgrade), same prepare('BEGIN').run() form in lazygraph-ops"
  - "promoteNodeStatus, when composed (not owns), THROWS on an event-log failure and on any catch, instead of returning {ok:false}, so the outer owner rolls back the status UPDATE; standalone it still returns {ok:false} exactly as before"
  - "Sites that already returned a result object on failure (fileEvidenceWithReadback, writeBreakthrough) keep returning it when composed; the outer owner must treat ok:false as a rollback signal"
  - "room-discard-cascade and the ambient-run filer open their own handle, so owns is always true there: idiom applied, composition reported as not reachable"

patterns-established:
  - "Static ownership test lists SITES as a constant (file, function, handle mode); add a site there when a new unconditional BEGIN is found"

requirements-completed: [CHG369-03]

duration: 40min
completed: 2026-10-03
---

# Phase 369 Plan 06: Transaction Ownership at the Writer Sites Summary

**The eight unconditional-BEGIN writer sites (seven files) now open, commit and roll back only when they own the transaction, so promoteNodeStatus composes inside withRoomTx under one transaction_id, with standalone SQL unchanged and a static pin that fails on any reintroduced unconditional BEGIN.**

## Accomplishments

- Replaced the unconditional open with `const owns = <handle>.isTransaction !== true;` plus the same open statement run only when owns, at: `transitions.cjs` promoteNodeStatus, `focus.cjs` setFocus, `file-evidence-readback.cjs` fileEvidenceWithReadback, `room-discard-cascade.cjs` discardPlaceholderRoom, `ambient-run.cjs` runAmbientComposition filer, `lazygraph-ops.cjs` indexArtifact and rebuildGraph, `breakthrough/schema.cjs` writeBreakthrough. Every COMMIT and ROLLBACK is guarded by the same flag.
- Every site carries the one-line comment "Phase 369 (D-18): owns idiom so this writer composes inside withRoomTx (Pitfall 7)."; the two own-handle sites also say so.
- `tests/test-369-tx-ownership.cjs` (407 lines): static arm at all eight sites; arms 1-4 on promoteNodeStatus (standalone, withRoomTx throw reverts status and log rows, withRoomTx commit shares one non-NULL transaction_id with a second insert, raw outer `BEGIN IMMEDIATE`); arm 5 for setFocus, fileEvidenceWithReadback, writeBreakthrough, indexArtifact and rebuildGraph inside a raw outer transaction (no nested error, outer ROLLBACK leaves nodes, edges, session_focus and room_change_log counts unchanged); discard and ambient-run reported as "owns its handle: composition not reachable".

## Task Commits

1. **Task 1: owns idiom at the eight sites** - `1c3070dc9` (feat)
2. **Task 2: composition test** - `d16c88744` (test)

## Test Results

- `node tests/test-369-tx-ownership.cjs`: exit 0; static PASS at 8 of 8 sites; arms 1-5 all PASS (table printed at the end of the run)
- Baseline versus after: 118 test files that require one of the seven writer files, each run hermetic (temp HOME, USERPROFILE, MINDRIAN_ROOMS_HOME, no CLAUDE_ACTIVE_ROOM or session id) before the first edit and again after. The sorted exit-code lists are identical (diff empty): 105 pass, 13 fail in both. No new failure.
- Pre-existing reds (same before and after, not caused by this plan): tests/test-131-e2e.cjs, tests/audit-localhost-workspace-review.cjs, tests/test-233-graph-heal-pipeline.cjs, tests/test-129.5-confirm-node.cjs (source-grep audit names callers supersession.cjs and memory-governance-closer.cjs), tests/test-242-hsi-to-graph-transaction.cjs (mutant build relative require), tests/test-futures-edges.cjs, tests/test-194-lastmod-discipline.test.cjs, tests/test-graph-derivation-verdict.cjs, tests/test-causal-seed.cjs, tests/test-sqlite-ops.cjs (conn.pragma is not a function), tests/test-sqlite-concurrent.cjs, tests/test-tension-hook-detection.cjs, lib/core/llm-name-suggester.test.cjs. The other 105 files, including room-discard-cascade.test.cjs, index-artifact-transaction.test.cjs, test-365-transitions, test-347-context-focus, test-navigation-focus and the 236 rebuild family, pass.
- `bash tests/run-all-369.sh`: leg "369: transaction ownership (CHG369-03)" PASSED. Aggregate PASS=27 FAIL=7 SKIP=22 at the time of the run; the red legs are all outside this plan: 198 local only (pre-existing), 369 long-dash guard (literal dashes in `ui/bakeoff/...` files from a peer), 369 erasable gate (tsconfig `paths` in `ui/bakeoff/workroom`), and the 276 / 267 registration / 267 CIRS / 270 budget regression legs, which fail only on tool and connector counts that moved (tools 42 to 44, live 47 vs snapshot 45, descriptors 32 to 34) because peer plans added MCP tools; none of them touch transaction code.
- `node scripts/check-substrate.cjs --diff`: exit 0. Pre-commit hooks passed on both commits, no `--no-verify`.

## Deviations from Plan

None in scope. Two implementation notes:

- **Composed failure semantics (within the plan's "rethrow when not owns" rule):** in promoteNodeStatus the in-try event-log failure path returned `{ok:false}` before; composed, a bare return would leave the status UPDATE half applied in the outer transaction, so it throws and the outer owner rolls back. Standalone behavior is unchanged.
- **fileEvidenceWithReadback catch guard:** `if (inTxn)` became `if (owns && inTxn)` so the static pin can see the guard (inTxn is only ever set when owns, so behavior is identical).

## Known Limitation (for plan 26 and later composers)

`fileEvidenceWithReadback` and `writeBreakthrough` keep their "never throw, return a result" contract when composed. If the node write lands and the later edge write fails, the function returns `{ok:false}` with the node still pending in the outer transaction; the outer owner must roll back on `ok:false` (withRoomTx does when the callback throws). No current caller composes them.

## Known Stubs

None.

## Threat Flags

None. All three register mitigations hold: owns idiom at promoteNodeStatus with arm 2 proving the outer rollback reverts status and log rows (T-369-06-01); same BEGIN keyword and statements with the baseline list compared (T-369-06-02); arm 3 asserts one shared non-NULL transaction_id (T-369-06-03).

## Self-Check: PASSED

- Files present: tests/test-369-tx-ownership.cjs and the seven modified writer files
- Commits present: 1c3070dc9, d16c88744

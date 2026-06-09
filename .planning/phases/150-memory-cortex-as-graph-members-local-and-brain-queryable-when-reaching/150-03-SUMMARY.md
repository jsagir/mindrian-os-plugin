---
phase: 150-memory-cortex-as-graph-members
plan: 03
subsystem: memory-cortex
tags: [reconcile, idempotent, cortex-spine, posttooluse-hook, session-start, tri-polar, canon-part-8, canon-part-9, mem-01, tdd]

# Dependency graph
requires:
  - phase: 150-01-memory-cortex-node-writers
    provides: writeMemoryArtifactNode / writeGoverningThoughtNode / writeNavigatorPersonaNode / writeDecisionNode / writeCortexLineageEdge + the stable node-id helpers (MEMORY_ARTIFACT_NODE_ID / GOVERNING_THOUGHT_NODE_ID / NAVIGATOR_PERSONA_NODE_ID / DECISION_NODE_ID) the reconcile calls
  - phase: 109-sql-context-memory-navigation-spine
    provides: lib/core/navigation.cjs (the single chokepoint all node/edge writes route through)
  - phase: 149-gsd-planning-artifacts
    provides: the reconcile-runner + gsd-artifact-graph-hook + session-start reconcile slot patterns mirrored verbatim
provides:
  - "reconcileMemoryArtifacts(roomDir, opts) -- the ONE idempotent backfill = sync cortex spine (lib/core/memory/reconcile-memory-runner.cjs)"
  - "classifyMemoryFile(filename) + discoverMemoryFiles(sectionRoot) -- the classification + discovery helpers"
  - "scripts/memory-artifact-graph-hook.cjs -- the CLI-immediacy PostToolUse hook (isMemoryMarkdown + resolveRoomDir)"
  - "the hooks.json PostToolUse registration + the session-start memory-cortex reconcile slot (tri-polar coverage)"
affects: [150-04-cortex-context, 150-05-spine-connector, 150-06-selector-graph-driven, getRoomContext, brain-queryable-when-reaching]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The reconcile mirrors the Phase-149 reconcile-runner: caller-owned opts.db handle, per-item best-effort try/catch, {upserted, decision_nodes, edges, unchanged} report, sectionRoot override for plugin self-dogfood"
    - "discoverMemoryFiles scans BOTH the section subfolders (via section-registry.discoverSections) AND the room root directly (the canonical top-level ICM Layer 0 memory files), tagging root files with a stable _root section label"
    - "The hybrid trigger is the Phase-149 pattern exactly: a PostToolUse hook for CLI immediacy + a best-effort session-start cascade slot for Desktop/Cowork tri-polar coverage, both calling the SAME idempotent reconcile (no second code path)"

key-files:
  created:
    - lib/core/memory/reconcile-memory-runner.cjs
    - scripts/memory-artifact-graph-hook.cjs
  modified:
    - hooks/hooks.json
    - scripts/session-start
    - tests/test-150-reconcile.cjs

key-decisions:
  - "discoverMemoryFiles now scans the room ROOT directory, not only the section subfolders: per CLAUDE.md decision 15 (ICM Layer 0 everywhere) the canonical top-level STATE.md / USER.md / ROOM.md live at the room root, which section-registry.discoverSections never returns. Root files key a stable _root section label and the stable node id memory_artifact:_root:<KIND>."
  - "The committed RED fixture asserted 9 memory files but wrote only 8 (its header comment already declared 'Total memory MD files: 9'); the off-by-one was the declared-but-missing canonical room-root STATE.md. Added that single file to the fixture so the contract is internally consistent and exercises the new root-scan path (Rule 1 fix, fixture only -- no assertion changed)."
  - "The PostToolUse hook and the session-start slot both call the SAME reconcileMemoryArtifacts; idempotence (upsert on a stable node/edge id) guarantees the hook write + a later session-start reconcile produce exactly one node + edge set (threat T-150-03-03 mitigated by construction, not by a second guard)."
  - "Decision nodes are projected via the 150-01 writeDecisionNode, which mints them at review_status=proposed (never auto-confirmed): the ONE truth-claim projection in the cortex, honoring Canon Part 9 role 5. memory_artifact / governing_thought / navigator_persona are system-bookkeeping (created_by=system confirmed) under the Part 9 audit-node carve-out."

requirements-completed: [MEM-01]

metrics:
  duration: ~25 min (resume of a reboot-interrupted session)
  tasks-completed: 3
  files-created: 2
  files-modified: 3
  completed-date: 2026-06-09
---

# Phase 150 Plan 03: Memory-Cortex Reconcile Spine + Hybrid Trigger Summary

The idempotent cortex spine and its tri-polar hybrid trigger: one `reconcileMemoryArtifacts(roomDir, opts)` that walks the room (root + section folders), classifies each `{ROOM,STATE,MINTO,BRAIN,FEYNMAN,USER}.md` file, and upserts its `memory_artifact` node plus the `governing_thought` / `navigator_persona` / `decision` projections via the 150-01 writers through the `navigation.cjs` chokepoint, fired immediately on the CLI by a PostToolUse hook and universally on Desktop/Cowork by a session-start reconcile slot.

## What Was Built

- **`lib/core/memory/reconcile-memory-runner.cjs`** (the cortex spine, GREEN at 10/10). `reconcileMemoryArtifacts` is the single idempotent backfill = sync path. `classifyMemoryFile` maps the six exact basenames (case-exact) to kinds. `discoverMemoryFiles` scans the room root AND every section subfolder. Per-kind projections: MINTO governing-thought `STATES` the section; MINTO decision-log ids project `decision` nodes that `INFORMS` the section; USER role-blend x journey-stage projects one `navigator_persona` that `DESCRIBES` the room. The module requires only `navigation.cjs` + `section-registry.cjs` + `node:fs/path/crypto`; zero Brain/network surface.
- **`scripts/memory-artifact-graph-hook.cjs`** (the CLI-immediacy half of D-01). Strict six-basename gate, registry room resolver, lazy `node:sqlite` open (Tier-0 skip if absent), calls the SAME reconcile, dog-foods the plugin's own memory files via `opts.sectionRoot`, ALWAYS exits 0.
- **`hooks/hooks.json`** registers the hook as a `Write|Edit|MultiEdit` PostToolUse block (timeout 3000) directly after the gsd-artifact-graph-hook block.
- **`scripts/session-start`** gains a best-effort `memory-cortex reconcile (Phase 150)` cascade slot (cloned verbatim from the Phase 149 slot), `2>/dev/null || true` so it never blocks startup -- the tri-polar net for Desktop/Cowork.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 (RED) | Idempotency suite (pre-existing, committed before reboot) | 4ed95112 | tests/test-150-reconcile.cjs |
| 2 (GREEN) | reconcile-memory-runner cortex spine | 7b11669e | lib/core/memory/reconcile-memory-runner.cjs, tests/test-150-reconcile.cjs (fixture fix) |
| 3 | Hybrid trigger: hook + hooks.json + session-start slot | b3498c8b | scripts/memory-artifact-graph-hook.cjs, hooks/hooks.json, scripts/session-start |

## Plan-Required Notes

**(a) The exact 150-01 writer exports consumed.** `writeMemoryArtifactNode`, `writeGoverningThoughtNode`, `writeNavigatorPersonaNode`, `writeDecisionNode`, `writeCortexLineageEdge`, plus the node-id helpers `MEMORY_ARTIFACT_NODE_ID`, `GOVERNING_THOUGHT_NODE_ID`, `NAVIGATOR_PERSONA_NODE_ID`, `DECISION_NODE_ID` -- all reached through `lib/core/navigation.cjs` (never the submodule directly, never `room.db`). `MEMORY_ARTIFACT_TYPES` is enforced inside `writeMemoryArtifactNode` (the runner classifies to the six basenames, which map onto that set).

**(b) test-150-reconcile registration into run-all-150.sh.** Already present -- registered by the 150-01 executor (the aggregator is owned by Plan 150-01). No change made by this plan; the line at `tests/run-all-150.sh:46` runs `test-150-reconcile.cjs`.

**(c) Decision double-ledger sources reached vs deferred.** This plan reaches the **MINTO decision_log / decisions / decisions_index** source: `extractDecisionIds` scans the `## Decisions` / `## Decision Log` / `## Decisions Index` region of a MINTO file and projects each `DEC-NNN`-style id via `writeDecisionNode` (collapsing toward one graph-authoritative decision node per id). NOT yet reached: the **`f_selector_decision` memory_event ledger** (the second ledger noted in 150-CONTEXT). The reconcile derives decisions from the MINTO prose only; collapsing the `f_selector_decision` memory_event stream into the same `decision:<id>` nodes is a Wave-3 / companion follow-up (the memory_event ledger is written by the selector, not by a per-folder memory MD, so it is out of this reconcile's file-walk scope).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] discoverMemoryFiles missed room-root memory files**
- **Found during:** Task 2 (the two RED tests at resume: 8 of 9 discovered).
- **Issue:** `discoverMemoryFiles` only walked the section subfolders returned by `section-registry.discoverSections`, which never returns the room root itself. The canonical top-level `STATE.md` / `USER.md` / `ROOM.md` (ICM Layer 0, CLAUDE.md decision 15) live at the room root and were therefore never projected.
- **Fix:** Added a `scanDirForMemoryFiles` helper and a room-root scan tagging root files with a stable `_root` section label, in addition to the section-subfolder scan.
- **Files modified:** lib/core/memory/reconcile-memory-runner.cjs
- **Commit:** 7b11669e

**2. [Rule 1 - Bug] RED fixture off-by-one (wrote 8, asserted 9)**
- **Found during:** Task 2.
- **Issue:** The committed RED fixture's header comment declared "Total memory MD files: 9" and both load-bearing assertions expected 9, but the fixture only wrote 8 `writeFileSync` calls (no room-root memory file). The declared-but-missing 9th file was the canonical room-root state file.
- **Fix:** Added one room-root `STATE.md` to `buildFixture()` and updated the fixture comment to enumerate it. No assertion was changed; the fixture now matches its own declared count and exercises the new root-scan path.
- **Files modified:** tests/test-150-reconcile.cjs
- **Commit:** 7b11669e (committed with the GREEN runner per the sequential-execution contract, since the runner was untracked)

## Canon Gates

- **Canon Part 8 (Graph Boundary):** the runner requires only `navigation.cjs` + `section-registry.cjs` + `node:fs/path/crypto`; the test's navigation-only arm asserts zero brain-client/http/https/sqlite/room-db requires and zero fetch/http.*/openRoomDb/openGraph calls -- all green. The hook and session-start slot make zero network calls. The memory prose is read locally for classification only (sha256 handles + section/kind/enum scalars on nodes, never body prose).
- **Canon Part 9:** node/edge writes route only through `navigation.cjs`; `decision` nodes mint at `proposed` (truth-claim, role 5), the three bookkeeping projections are `created_by=system` confirmed (audit-node carve-out).
- **Tri-Polar:** PostToolUse hook covers CLI immediacy; session-start slot covers Desktop/Cowork. Both call the same idempotent reconcile.
- **No em-dashes / en-dashes:** swept clean across all created + modified code (runner, hook, session-start, hooks.json, test).

## Tests

- `node tests/test-150-reconcile.cjs` -- 10/10 (was 8/10 at resume).
- `bash tests/run-all-150.sh` -- 5 passed / 0 failed / 8 missing. The 8 missing suites are owned by future plans 04-08 (per the aggregator header); every 150-03 surface (reconcile) and its dependency surfaces (150-01 node/edge/decision writers, 150-02 brain-egress) are green.
- Task 3 inline verification block (hook gate, hooks.json validity + registration, `bash -n` session-start, slot reference, dash sweep) -- all green, plus extended gate edge cases (six basenames match; case-exact `state.md` rejected; Windows backslash path matched; `notes.md` / `ROADMAP.md` / `SUMMARY.md` / empty / null rejected).

## Self-Check: PASSED

- FOUND: lib/core/memory/reconcile-memory-runner.cjs
- FOUND: scripts/memory-artifact-graph-hook.cjs
- FOUND: hooks/hooks.json (memory-artifact-graph-hook.cjs registered)
- FOUND: scripts/session-start (reconcile-memory-runner.cjs slot present)
- FOUND: tests/test-150-reconcile.cjs (10/10)
- Commit 4ed95112 (RED): present in git log
- Commit 7b11669e (GREEN): present in git log
- Commit b3498c8b (trigger): present in git log

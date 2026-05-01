---
phase: 99
plan: "04"
title: "Operator-Aware Hooks"
subsystem: conversation-operator-state-machine
tags: [hooks, operator, state-machine, classifier, decision-gate, canon-part-3, canon-part-4, canon-part-7, canon-part-8]
canon_parts: [3, 4, 7, 8]
wave: 2
depends_on: ["99-01", "99-02"]
requirements:
  - OPERATOR-99-04-A
  - OPERATOR-99-04-B
  - OPERATOR-99-04-C
  - OPERATOR-99-04-D
  - OPERATOR-99-04-E
  - OPERATOR-99-04-F
  - OPERATOR-99-04-G
dependency_graph:
  requires:
    - lib/conversation/operator.cjs (99-01)
    - lib/conversation/classifier.cjs (99-02)
    - lib/conversation/classifier-rules.json (99-02)
    - hooks/hooks.json (existing 8-event lifecycle)
    - ~/MindrianRooms/.rooms/registry.json (Phase 83 active-room registry)
  provides:
    - scripts/operator-update.cjs (single hook entry; branches on hook_event_name)
    - hooks/hooks.json operator-update.cjs registration on SessionStart / Stop / PostToolUse / UserPromptSubmit
    - tests/test-operator-hooks.cjs (12-scenario integration suite)
    - lib/memory/run-feynman-tests.cjs registry entry
  affects:
    - 99-05 (/mos:operator command can now read state knowing hooks keep it fresh)
    - 100 (JTBD classifier consumes operator state — now updated automatically per turn)
    - 102 (renderer reads operator — state file is reliably current at render time)
    - 95.1 (drift class F UI compliance — operator-aware shape selection deterministic)
tech-stack:
  added: []
  patterns:
    - Phase 95 BASH-95-01 envelope schema (top-level allowlist)
    - Phase 95 cascade-side-channel active-room guard
    - Phase 83 .rooms/registry.json with $MINDRIAN_ROOMS_HOME override
    - Defensive try/catch + silent-success envelope on every error path
    - spawnSync subprocess invocation with synthetic registry per test
key-files:
  created:
    - scripts/operator-update.cjs (234 lines)
    - tests/test-operator-hooks.cjs (506 lines)
  modified:
    - hooks/hooks.json (4 new sibling entries; pre-existing entries preserved byte-for-byte)
    - lib/memory/run-feynman-tests.cjs (registry entry added; stray merge-conflict marker fixed)
decisions:
  - "Single hook entry point branches on hook_event_name (Claude Code 2.x convention) rather than four separate scripts"
  - "Stop hook is a no-op (state already current from most recent transition); did NOT extend operator.cjs with recordSessionBoundary helper to keep 99-01 tests byte-stable"
  - "PostToolUse uses broad matcher (Write|Edit|MultiEdit|Read|Grep|Glob|AskUserQuestion|Bash|Task|TodoWrite) to catch AskUserQuestion + decision_gate_pending resolution"
  - "Active-room guard mirrors Phase 95 cascade-side-channel pattern: PostToolUse with file_path outside active room exits silently"
  - "Sealed rooms (registry.rooms[i].sealed === true) treated as no-ops — Decision #15 invariant"
  - "Hook NEVER blocks the user: every error path emits {continue:true,suppressOutput:true} and exits 0"
metrics:
  duration_minutes: 7
  tasks_complete: 3
  files_created: 2
  files_modified: 2
  test_scenarios: 12
  test_pass_rate: "12/12"
  frame_budget_ms_mean: 22.36
  completed_at: "2026-05-01T09:29Z"
---

# Phase 99 Plan 04: Operator-Aware Hooks Summary

Wired the conversation operator state machine into the hook lifecycle so it updates automatically as the user types, invokes tools, ends sessions, and starts new ones — making the operator state file "real" rather than a primitive that could only be touched manually.

## What Shipped

**Single hook entry point** at `scripts/operator-update.cjs` (234 lines) that branches on `hook_event_name` and handles all four lifecycle events with a strict Phase 95 BASH-95-01-compliant envelope:

- **SessionStart (D-18):** reads operator state from the active room; if `state.current === 'BUILD_ROOM'` AND `state.context.active_section` is non-null, surfaces a one-line resume hint via `hookSpecificOutput.additionalContext` ("you were filing in <section>; resume? Type /mos:room <section>...").
- **Stop (D-19):** silent success — state is already up to date from the most recent transition, so the no-op variant per the plan's behavior block was chosen over extending `operator.cjs` with a `recordSessionBoundary` helper that would have rippled into 99-01's 12-scenario test suite.
- **PostToolUse (D-20):** if `tool_name === 'AskUserQuestion'`, transitions any operator -> DECISION_GATE with `decision_gate_pending` set to the question id. If `state.context.decision_gate_pending` was already set and a non-AskUserQuestion tool runs, transitions to 'previous' and clears the pending flag.
- **UserPromptSubmit (D-11/D-12):** runs the heuristic classifier from 99-02 on the user message; if the classifier's confidence-gated `candidate_op` is non-null, fires `transition()` with the suggested trigger.

**4 sibling entries in `hooks/hooks.json`** — appended without clobbering existing entries (Canon Part 7 reuse): the existing `session-start`, `on-stop`, `post-write`, `frontmatter-schema-validator`, `async-artifact-auto-commit`, `query-efficiency-telemetry`, `intent-classifier`, and `brain-derivation-drain` registrations are preserved byte-for-byte. Each new entry uses `timeout: 3000` (Phase 95 invariant) which gives orders-of-magnitude safety margin over the < 50ms script frame budget.

**12-scenario integration suite** at `tests/test-operator-hooks.cjs` (506 lines) that spawns the hook script via `spawnSync` against a synthetic per-test registry. All 12 GREEN. Frame budget measured at 22.36 ms mean per spawn-and-execute (well under the 250 ms CI-friendly target; the script itself runs in single-digit milliseconds — `spawnSync` startup dominates).

## Canonical Compliance

- **Canon Part 3 (Tri-Context Decision Gate):** the PostToolUse `AskUserQuestion -> DECISION_GATE` path makes the operator state machine a real producer of DECISION_GATE moments rather than a passive observer.
- **Canon Part 4 (Every Choice Is Graph Data):** every successful transition continues to write a typed `OPERATOR_TRANSITION` edge to the local graph (via 99-01's transition writer); 99-04 just makes the transition fire automatically.
- **Canon Part 7 (Reuse Before Build):** extends existing event arrays in `hooks/hooks.json` rather than inventing a new top-level hook category. Reuses the 99-01 transition primitive, the 99-02 classifier, and Phase 83 `.rooms/registry.json` with `$MINDRIAN_ROOMS_HOME` env override.
- **Canon Part 8 (Graph Boundary):** zero Brain queries in `scripts/operator-update.cjs`. Confirmed by grep audit: `brain.mindrian.ai|brainQuery|pinecone|embedQuery` returns 0 hits. The hook reads/writes only `<roomDir>/.mindrian/conversation-operator.json` and (best-effort, via 99-01) `<roomDir>/.room-graph/room.db`.

## Key Decisions

1. **Stop hook is a no-op rather than a `recordSessionBoundary` extension.** The plan's behavior block presented two paths: extend `operator.cjs` with a 5-line history-only writer, or accept the no-op. The no-op was chosen because state is already current after every transition — the audit trail is preserved by the 50-entry bounded history written on every transition. Extending 99-01 would have rippled into its 12-scenario test suite for marginal value. Documented in commit message.
2. **PostToolUse matcher is broad.** Used `Write|Edit|MultiEdit|Read|Grep|Glob|AskUserQuestion|Bash|Task|TodoWrite` rather than a narrow matcher because the AskUserQuestion-driven DECISION_GATE branch needs to fire on every tool, and the active-room guard naturally handles the noisy cases (file_path outside active room exits silently). The cost is one cheap spawn per tool use; the benefit is uniform behavior across the tool surface.
3. **Active-room guard treats `tool_input.file_path` outside the active room as silent exit.** Mirrors the Phase 95 `write_cascade_side_channel` pattern — operator transitions are a per-room concept, and a write to an unrelated room must not move the active room's operator. Sealed rooms (registry.rooms[i].sealed === true) are also no-ops, matching the Decision #15 invariant.
4. **Hook NEVER blocks.** Every error path — malformed stdin, missing hook_event_name, missing registry, throwing classifier — exits 0 with `{continue:true,suppressOutput:true}`. The script runs inside the user's turn budget; a hard failure would degrade the user experience.

## Verification

```
node -c scripts/operator-update.cjs                                                       # syntax OK
node tests/test-operator-hooks.cjs                                                        # 12/12 GREEN
node tests/test-operator-state.cjs                                                        # 12/12 GREEN (no regression)
node tests/test-operator-classifier.cjs                                                   # all gates pass (no regression)
node lib/render/render-v2.test.cjs                                                        # 12 passed (no regression)
node tests/test-operator-command.cjs                                                      # 20/20 GREEN (no regression)
node tests/test-hook-envelope-shape.cjs                                                   # 16 passed (Phase 95-05 invariant preserved)
node -e "JSON.parse(require('fs').readFileSync('hooks/hooks.json','utf8'))"               # valid JSON
grep -c operator-update.cjs hooks/hooks.json                                              # 4
grep -E 'brain\.mindrian\.ai|brainQuery|pinecone|embedQuery' scripts/operator-update.cjs  # 0 (Canon Part 8)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed stray merge-conflict marker in `lib/memory/run-feynman-tests.cjs`**
- **Found during:** initial baseline check (pre-Task 1)
- **Issue:** Line 925 contained a bare `<<<<<<< HEAD` token with no matching `=======` or `>>>>>>>`, committed to main in commit 41968797 ("test(99-01): operator state validation suite + registry"). This caused `node -c lib/memory/run-feynman-tests.cjs` to fail with `SyntaxError: Unexpected token '<<'` — preventing the whole test runner from loading and blocking the registry update Task 3 needed.
- **Fix:** Removed the stray marker line. The HEAD-side content (Phase 99 test entries) was already complete; there was nothing to merge from the other side.
- **Files modified:** `lib/memory/run-feynman-tests.cjs`
- **Commit:** `23efb19` (folded into the Task 3 registry-update commit since both touch the same file)

### Worktree Setup (not deviations — environment prep)

The worktree at `agent-abfebb0d76d6a2e51` was based on commit `a563850` which predates the Wave-1 Phase 99 commits. To execute, I `git merge`d `main` into the worktree branch — this brought in the 22 Wave-1 commits (99-01 through 99-05 wave-1 deliverables). The plan files `99-04-PLAN.md`, `99-05-PLAN.md`, `99-RESEARCH.md`, `99-01-PLAN.md`, `99-02-PLAN.md` are untracked in the parent repo; I copied them from the parent's working tree into the worktree for local reference. None of this affected the eventual commit topology — the worktree branch now sits at the merge of main + 3 new 99-04 commits.

## Authentication Gates

None encountered.

## Known Stubs

None. Every code path that ships in 99-04 is wired to live primitives:

- `getCurrent()` / `transition()` are 99-01 production code.
- `classify()` is 99-02 production code.
- The active-room registry is Phase 83 production code.
- The state file is real and persists across hook invocations (verified by Test 3: a transition driven by UserPromptSubmit is observable via `readState()` after the spawn).
- The 12-scenario integration suite proves end-to-end behavior, not just the script's syntax.

## Self-Check: PASSED

**Files created:**
- FOUND: scripts/operator-update.cjs
- FOUND: tests/test-operator-hooks.cjs
- FOUND: .planning/phases/99-conversation-operator-state-machine/99-04-SUMMARY.md (this file)

**Files modified:**
- FOUND: hooks/hooks.json (4 new sibling entries; pre-existing entries preserved)
- FOUND: lib/memory/run-feynman-tests.cjs (registry entry added; stray merge-conflict marker fixed)

**Commits:**
- FOUND: d7bd9f3 feat(99-04): add operator-update.cjs hook entry point
- FOUND: 4e35d1e feat(99-04): register operator-update.cjs on 4 hook events
- FOUND: 23efb19 test(99-04): operator hooks integration suite + registry

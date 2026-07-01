---
phase: 188-f7-multiselect-toggleable-hitl
plan: 04
subsystem: hmi-shape-f-selector
tags: [SFS-08, SFS-09, f3-depth, f4-harvest-scope, parity, closed-vocab, part9]
requires:
  - "lib/hmi/shape-f3-renderer.cjs (closed-vocab F.3 depth renderer, already shipped)"
  - "lib/hmi/shape-f4-renderer.cjs (closed-vocab F.4 progressive-ladder renderer, already shipped)"
  - "lib/hmi/jtbd-state.cjs (per-room atomic JSON state model to clone)"
  - "lib/hmi/f1-pick-capture-cli.cjs (capture-adapter structure to clone)"
provides:
  - "lib/hmi/depth-state.cjs (per-room F.3 depth scalar state)"
  - "lib/hmi/harvest-scope-state.cjs (per-room F.4 accumulating scope state)"
  - "lib/workflow/f3-depth-consumer.cjs (F.3 pick -> depth-state write, re-enter caller)"
  - "lib/workflow/f4-scope-consumer.cjs (F.4 pick -> accumulated scope write, hand to synthesis)"
  - "F.3/F.4 dispatch-branch state threading"
affects:
  - "lib/hmi/selector-dispatcher.cjs (F.3/F.4 branches only)"
tech-stack:
  added: []
  patterns:
    - "per-room atomic JSON state (same-dir tmp + POSIX rename), cloned from jtbd-state.cjs"
    - "deterministic membership capture (no fuzzy NLP), cloned from f1-pick-capture-cli.cjs"
    - "consumer sets state + re-enters caller; never opens room.db (Part 9)"
    - "progressive accumulation: addScope adds each rung onto the prior scope (idempotent, canonical order)"
key-files:
  created:
    - lib/hmi/depth-state.cjs
    - lib/hmi/f3-depth-capture-cli.cjs
    - lib/workflow/f3-depth-consumer.cjs
    - lib/hmi/harvest-scope-state.cjs
    - lib/hmi/f4-scope-capture-cli.cjs
    - lib/workflow/f4-scope-consumer.cjs
  modified:
    - lib/hmi/selector-dispatcher.cjs
decisions:
  - "Stored the closed OPTION LABELS as the canonical state values ('Shallow'..'Extreme' / 'Key insights'..'+actions') rather than lowercased scalars, so capture/state/render round-trip byte-consistent and the parity tests assert the same vocabulary the renderer emits."
  - "harvest-scope-state.addScope re-sorts the accumulated set into canonical ladder order and is idempotent (a repeated rung does not duplicate), so the accumulated scope is a stable, deterministic view."
  - "Dispatcher threads current depth/scope as INFORMATIONAL context alongside {header}; the renderers ignore it for their option set, keeping the render byte-identical closed-vocab (no marker, no Free-Text)."
metrics:
  duration: ~40m
  completed: 2026-07-01
  tasks: 3
  files_created: 6
  files_modified: 1
requirements: [SFS-08, SFS-09]
---

# Phase 188 Plan 04: F.3/F.4 Parity Summary

F.3 (depth) and F.4 (progressive harvest scope) brought to first-class parity with the built Shape-F sub-shapes by adding the MISSING capture + consumer + per-room state layer that F.1 has and they lacked -- with zero change to their closed-vocab renderers.

## What Parity Actually Was (the load-bearing insight)

F.3/F.4 already had correct renderers (valid `{zones, contract}`, `recommended:null`, `freeTextOffered:false`) and existing dispatch branches. The gap (research NET-NEW 3) was NOT a render gap: a picked depth or scope value was never captured, never written to per-room state, and never consumed. Parity = clone the F.1 capture/consumer/state TRIO's STRUCTURE, deliberately WITHOUT its marker/Free-Text behavior (the closed-vocab carve-out is intentional and enforced).

## Tasks Completed

| Task | Name | Commit | Key files |
| ---- | ---- | ------ | --------- |
| 1 | F.3 depth parity (capture + state + consumer) | `84ce96fa` | depth-state.cjs, f3-depth-capture-cli.cjs, f3-depth-consumer.cjs |
| 2 | F.4 progressive-harvest parity (accumulating state) | `d64fa537` | harvest-scope-state.cjs, f4-scope-capture-cli.cjs, f4-scope-consumer.cjs |
| 3 | Thread F.3/F.4 state into dispatch branches | `ed12b4e2` | selector-dispatcher.cjs |

### Task 1 -- F.3 depth
- `depth-state.cjs`: per-room atomic JSON (`<roomDir>/.mindrian/depth-state.json`), cloned from jtbd-state's tmp+rename model. Stores a single closed depth scalar (Shallow/Medium/Deep/Extreme). `getCurrent`/`setCurrent`/`clear`/`history`; out-of-axis values are a graceful no-op.
- `f3-depth-capture-cli.cjs`: deterministic membership capture (`_matchDepth`). 'Back' -> `{ depth:null, back:true }` (no write). Raw text rides the optional `sentence` LOCAL lane only (Part 8).
- `f3-depth-consumer.cjs`: on a captured depth, calls `depth-state.setCurrent` over the caller-supplied `roomState.roomDir`, then signals `reenter:true`. Opens no room.db. Does NOT pick the following verb (the calling command owns it, SKILL.md:175).

### Task 2 -- F.4 progressive harvest
- `harvest-scope-state.cjs`: per-room atomic JSON mirroring depth-state. `addScope` ACCUMULATES each rung onto the prior scope ('Key insights' -> +contradictions -> +actions), idempotent, re-sorted to canonical ladder order. Exposes `getCurrent`/`setCurrent`/`addScope`/`getScope`/`clear`/`history`.
- `f4-scope-capture-cli.cjs`: deterministic membership capture. 'Create artifact draft' -> `{ terminal:true }`; 'Back' -> `{ back:true }`. Raw text on the LOCAL lane only.
- `f4-scope-consumer.cjs`: a rung pick accumulates + re-enters; the terminal hands the accumulated scope to synthesis (`synthesize:true, scope`). Opens no room.db.

### Task 3 -- dispatcher threading
- Added read-only `readCurrentDepthState` / `readCurrentScopeState` helpers (resolve `roomDir` from the payload, degrade-never-block to `null`/`[]`).
- F.3 branch threads `currentDepth`, F.4 branch threads `currentScope` alongside `{header}`. The renderers ignore these for their option set -> render stays byte-identical closed-vocab. Only edit to selector-dispatcher.cjs this plan; no other branch touched.

## Verification

- `node lib/hmi/shape-f3-parity.test.cjs` -> PASS (7 assertions)
- `node lib/hmi/shape-f4-parity.test.cjs` -> PASS (8 assertions)
- `node lib/hmi/selector-dispatcher.test.cjs` -> PASS (7/7)
- `node scripts/check-render-coverage.cjs` -> 15 covered, 0 excluded, 0 gap
- `bash tests/run-all-188.sh` -> exit 1 (<= 1, acceptance met). My four legs (F.3 parity, F.4 parity, dispatcher, render-coverage) all PASS.
- Part 9 source-grep: no `better-sqlite3` / `node:sqlite` / db-opener in either consumer (only `node:path` + a tolerant state-module require).
- No em-dashes across all six new modules.

## Closed-vocab carve-out preserved (T-188-04-04)

Both parity tests assert `recommended === null` and `freeTextOffered === false` after the layer lands. No marker and no Free-Text were added to F.3/F.4; the renderers are untouched. The capture adapters use deterministic membership matching (T-188-04-01), so an unknown pick is a no-op rather than a coerced value.

## Deviations from Plan

None -- plan executed as written. The plan named `addScope`/`getScope` for harvest-scope-state; the Wave-0 test additionally requires `getCurrent`/`setCurrent` exports, so the module exposes all four (superset, no conflict).

## Out-of-scope observations (not fixed -- other plans)

`tests/run-all-188.sh` shows 4 FAILED legs: F.8 renderer, F.8 fan-out consumer, F.9 renderer, F.9 consumer (SFS-01..05). These are separate modules owned by other plans in this phase and are untouched by 188-04. They were not caused by this plan's changes and are left as-is per the scope boundary.

## Known Stubs

None. All six modules are fully wired: capture -> consumer -> per-room state, exercised end-to-end by the two parity tests.

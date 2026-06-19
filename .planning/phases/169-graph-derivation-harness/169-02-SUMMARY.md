---
phase: 169-graph-derivation-harness
plan: "02"
subsystem: graph-derivation-harness
tags: [gdh-01, room-root-resolver, consolidation, write-index, root-cause-1, part-7, part-8, d-169-05]
requires:
  - "169-01 (the shared IFACE block + tests/test-room-root-resolver.cjs RED stub this plan turns GREEN)"
  - "169-00 (run-all-169.sh phase gate the room-root suite registers into)"
provides:
  - "lib/core/room-root.cjs: the ONE `.room-root` walk-up resolver -- resolveRoomRoot(filePath) -> roomDir|'' + findRoomRootSentinels() -> ['.room-root']"
  - "the WRITE-INDEX path repointed at the one resolver: gsd-artifact-graph-hook.cjs resolveRoomDir(filePath) is file-rooted FIRST (a sub-room write indexes into THAT sub-room's db regardless of the registry active room -- root cause #1 closed)"
  - "the 3 hand-rolled walk-up copies (query-efficiency-telemetry.cjs / auto-explore-fingerprint.cjs / async-artifact-auto-commit.cjs) repointed at the shared resolver -- ONE resolver, drift removed"
affects:
  - "Plan 04 (graph-derivation.cjs rollup + lazygraph ROOT-FILES pass) consumes resolveRoomRoot for file-rooted sub-room resolution"
  - "Plan 05 (graph-backfill / sweep hook) resolves the write-index room via the same resolver"
  - "Plan 07 (graph-self-heal.cjs) writes the .room-root sentinel resolveRoomRoot keys on"
tech-stack:
  added: []
  patterns:
    - "Part 7 CONSOLIDATION: extract the 3x-duplicated `.room-root` walk-up into ONE resolver and repoint the duplicates; do not invent a new sentinel convention"
    - "fail-safe '' return + null-coercion at each consumer boundary so each script's prior null contract is preserved"
    - "file-rooted-first / registry-fallback: resolveRoomRoot(filePath) FIRST, env/registry-active only when the file is outside any room"
key-files:
  created:
    - lib/core/room-root.cjs
  modified:
    - scripts/gsd-artifact-graph-hook.cjs
    - scripts/query-efficiency-telemetry.cjs
    - scripts/auto-explore-fingerprint.cjs
    - scripts/async-artifact-auto-commit.cjs
decisions:
  - "the PRIMARY sentinel is the `.room-root` FILE only (Q4 CLOSED); the heal-command broader set ['.room-root','STATE.md','ROOM.md'] is documented in a comment as the belt-and-suspenders is-this-a-room detection, NOT the write-index resolution key"
  - "the resolver returns '' on no-sentinel and never throws; each of the 3 consumers coerces '' -> null at the call boundary so their existing null contract is byte-preserved"
  - "the hook's resolveRoomDir gains a filePath param and resolves file-rooted FIRST, env/registry-active ONLY as fallback -- so a sub-room write is file-rooted but a path-less/orphan call degrades exactly as before"
  - "dashboard-helpers.cjs::detectActiveRoom LEFT INTACT (D-169-05): only the WRITE-INDEX path switched to file-rooted resolution; genuine active-room callers are unchanged"
metrics:
  duration_min: 6
  completed: 2026-06-19
  tasks: 2
  files: 5
  commits: 2
---

# Phase 169 Plan 02: GDH-01 the ONE `.room-root` Walk-Up Resolver Summary

Landed `lib/core/room-root.cjs` as the ONE `.room-root` walk-up resolver (a Part 7 consolidation of the
3x-duplicated walk-up), repointed the per-write auto-graph hook and the three hand-rolled scripts at it, and
closed root cause #1: a write into a sub-room now indexes into THAT sub-room's db regardless of the registry
active room. `tests/test-room-root-resolver.cjs` is GREEN (4/4); every other 169 RED stub stays untouched.

## What Was Built

- **The ONE resolver (`lib/core/room-root.cjs`).** Exports `resolveRoomRoot(filePath) -> roomDir|''`:
  normalize the path (resolve relative/missing against `process.cwd()`, start from the dirname when the path
  is a file), then walk up parent-by-parent (bounded at MAX_DEPTH 12, the value the three scripts used
  verbatim) checking `fs.existsSync(path.join(dir, '.room-root'))`, returning the first dir that carries the
  sentinel or `''` at the filesystem root. Also exports `findRoomRootSentinels() -> ['.room-root']` (the
  canonical PRIMARY sentinel; the heal-command broader set is documented in a comment as the
  belt-and-suspenders is-this-a-room fallback, NOT the write-index key). Pure built-ins (`node:fs`,
  `node:path`); zero network, zero Brain (Part 8); never throws (Part 8 / threat T-169-03 fail-safe).
- **The write-index hook repointed (`scripts/gsd-artifact-graph-hook.cjs`).** `resolveRoomDir` now takes
  the written `filePath` and calls `resolveRoomRoot(filePath)` FIRST; only when it returns `''` (the file is
  outside any room) does it fall back to the existing env/registry-active resolution. `runHook` threads the
  written `filePath` into the call. So a sub-room write is file-rooted (root cause #1 closed) while a
  path-less / orphan-file call degrades to the prior env/registry behavior and the hook keeps its
  exit-0-always degrade.
- **The three duplicated walk-ups repointed.** `query-efficiency-telemetry.cjs` (the cwd walk-up
  `findRoomRootFromCwd` now calls the shared resolver, the resolve-room script fallback preserved),
  `auto-explore-fingerprint.cjs` (`detectRoomSection`), and `async-artifact-auto-commit.cjs`
  (`findRoomRoot`) each replaced their inline `.room-root` walk-up with `require('.../lib/core/room-root.cjs')
  .resolveRoomRoot` (relative require path adjusted per each script's depth), coercing `'' -> null` at the
  boundary so each script's existing null contract is byte-preserved.
- **`detectActiveRoom` LEFT INTACT.** `lib/core/navigation/dashboard-helpers.cjs::detectActiveRoom` is
  untouched (verified via `git diff --name-only`): the unify switches ONLY the write-index path to
  file-rooted resolution; genuine "what is the active room" callers keep the registry resolver (D-169-05,
  RESEARCH Anchor-1 refinement).

## Root Cause #1 (closed)

A functional probe of the hook's new `resolveRoomDir`: with the env/registry active room set to the PARENT,
a write to a file inside a sub-room (carrying its own `.room-root`) resolves to the SUB-ROOM dir (the write
indexes into the sub-room's own db); an orphan file outside any room degrades to the PARENT (the prior
env/registry fallback). Both legs verified GREEN.

## Verification

- Task 1 `<verify>`: `node tests/test-room-root-resolver.cjs` GREEN, PASS (4/4) -- `findRoomRootSentinels`
  returns the shipped sentinel set, a file inside the sub-room resolves to the sub-room (not the parent)
  while the registry active room is the parent, a file directly under the parent resolves to the parent, and
  a file outside any room returns `''`.
- Task 2 `<verify>`: `node tests/test-room-root-resolver.cjs && grep -q resolveRoomRoot
  scripts/gsd-artifact-graph-hook.cjs && grep -q room-root scripts/auto-explore-fingerprint.cjs && grep -q
  room-root scripts/async-artifact-auto-commit.cjs` returned `REPOINTED`; the hook + all three scripts load
  (`HOOK_LOADS` + each script `require`s clean). The functional probe above confirms the sub-room write
  indexes into the sub-room db and the orphan degrades.
- `bash tests/run-all-169.sh`: Total 17, Passed 6 (was 5 at Wave 0), Failed 11. The room-root suite flipped
  from RED to PASSED; the two carried floor tests (`test-edges-room-lineage-floor.cjs` +
  `test-edges-part4-cascade-floor.cjs`) stay GREEN; the frozen-edge-set + Part-8 grep + em-dash sweeps stay
  GREEN; the other eleven 169 stubs (doc-text-extractor, subroom-rollup, candidate-producer,
  graph-derivation-loop, derive-idempotence, derive-backfill-acceptance, 169-brain-boundary,
  sentinel-self-heal, room-lineage-edge, recursive-rollup, depth2-full-citizen) stay RED, untouched (later
  waves turn them GREEN).
- Em-dash sweep over `lib/core/room-root.cjs` + all four edited scripts: zero literal em-dashes.

## Deviations from Plan

None - plan executed exactly as written. Two `type="auto"` tasks; no auto-fixes, authentication gates, or
architectural escalations. The `'' -> null` coercion at each consumer boundary is the plan's explicit
"preserving each script's existing behavior on a '' result" instruction, not a deviation.

## Authentication Gates

None.

## Known Stubs

None introduced by this plan. The eleven other 169 RED stubs that remain RED are RED-by-design from Plan 01
(the contracts-on-disk bus); later waves (Plans 03-07) turn them GREEN. This plan's only stub
(`test-room-root-resolver.cjs`) is now GREEN.

## Threat Flags

None. No new network endpoint, auth path, or schema change at a trust boundary. `lib/core/room-root.cjs` is
a pure LOCAL filesystem walk (T-169-02 mitigation: it walks to the file's OWN `.room-root` so the write
lands in the correct sub-room db; T-169-03 mitigation: fail-safe `''` return + never throws, the hook keeps
its exit-0-always degrade so a malformed path never blocks a Write).

## Commits

- `4d7db39d` feat(169-02): lib/core/room-root.cjs the ONE .room-root walk-up resolver (GDH-01)
- `669b9d88` feat(169-02): repoint the write-index hook + 3 scripts at the one resolver (GDH-01)

## Self-Check: PASSED

- Created/modified files exist on disk: `lib/core/room-root.cjs`, `scripts/gsd-artifact-graph-hook.cjs`,
  `scripts/query-efficiency-telemetry.cjs`, `scripts/auto-explore-fingerprint.cjs`,
  `scripts/async-artifact-auto-commit.cjs`, and this SUMMARY (all FOUND).
- Commit hashes exist in git: 4d7db39d, 669b9d88 (both FOUND).
- Em-dash sweep over all created/modified files including this SUMMARY: zero literal em-dashes.

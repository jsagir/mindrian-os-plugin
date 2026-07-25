---
status: resolved
kind: rca
trigger: "cascade-rooms-module-ignores-abs-path-registry-field"
issue_id: ""
severity: low
surfaces: [cli]
brain_mode: local-only
canon_parts: [7]
created: 2026-07-25T18:30:00.000Z
updated: 2026-07-25T18:30:00.000Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: N/A -- root-caused and resolved for the one module this phase
touches; a known, not-yet-fixed sibling gap is recorded below for whoever
next touches cascade-rooms-module.cjs or the shared registry-resolution
helpers.
test: N/A
expecting: N/A
next_action: optional follow-up -- apply the same one-line precedence fix to
`lib/core/doctor/cascade-rooms-module.cjs`'s `resolveRoomPath` (or extract a
single shared helper into `lib/core/doctor/shared.cjs` so this class of gap
can only be fixed once, not per-module). Not blocking, not scheduled.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 1.15.3-beta.47 (in-progress)
- Reported by: Phase 232.1 code-review pass (232.1-REVIEW.md WR-01)
- Date first observed: 2026-07-25
- Related debug sessions: none

## Problem Statement

`lib/core/doctor/cascade-rooms-module.cjs`'s `resolveRoomPath(roomsHome, info)`
(Phase 217, already SHIPPED) only reads `info.path`, never `info.abs_path` --
the canonical registry precedence field documented in
`lib/core/resolve-active-room.cjs` ("prefer entry.abs_path if set, else
entry.path") and honored by essentially every other room-resolution consumer
in this codebase. A room registered abs_path-only silently vanishes from the
class-B sentinel-presence sweep with no `unreadable` marker.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: every registered room, regardless of whether its registry entry
uses `path` or `abs_path`, is checked for its `.room-root` sentinel.
actual: an abs_path-only room is invisible to the sweep -- not counted, not
flagged, not soft-failed. It simply never appears in `missingSentinels[]` or
`okCount`.
errors: none -- this is a silent omission, not a thrown error.
reproduction:
  1. Register a room in `~/MindrianRooms/.rooms/registry.json` with only
     `{ "abs_path": "/absolute/path/to/room" }`, no `path` key.
  2. Run `/mos:doctor --cascade-rooms` (class B).
  3. Observe the room is absent from both `okCount` and `missingSentinels`.
started: present since Phase 217 (2026-07-11), when `cascade-rooms-module.cjs`
was migrated out of `doctor.cjs`'s inline main() block; the gap was already
in the pre-migration inline code and carried forward verbatim, not introduced
by the migration itself.

## Scope and Impact

- Affected surfaces: cli only (`/mos:doctor --cascade-rooms`, class B/C).
- Affected commands: the doctor module registry's `cascade-rooms` and
  `cascade-rooms-active` entries (both share `resolveRoomPath` via the same
  file).
- Affected users: any install with at least one room registered via the
  `abs_path` convention (this is a real, live registry shape per
  `resolve-active-room.cjs`, not hypothetical).
- Version range: 1.13.1-beta.1 (class B's `introduced_version`) through
  present.
- Blast radius: `lib/core/doctor/room-graph-density-module.cjs` (Phase 232.1)
  copied this same `resolveRoomPath` verbatim per Canon Part 7 reuse, and so
  initially carried the identical gap -- caught by 232.1's own code-review
  pass (232.1-REVIEW.md WR-01) before it shipped, fixed in that module only
  (this repo's own).

## Eliminated
<!-- APPEND only - prevents re-investigating -->

(none -- root cause was direct on first read, no dead ends)

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-07-25T18:20:00.000Z
  checked: `lib/core/resolve-active-room.cjs` lines 42-49, 145-153
  found: explicit doc comment "abs_path resolution: prefer entry.abs_path if
  set, else entry.path" and matching implementation.
  implication: `abs_path` is the documented canonical precedence, not an
  incidental field.
- timestamp: 2026-07-25T18:22:00.000Z
  checked: repo-wide grep for `abs_path` across `lib/`, `scripts/`, `tests/`
  found: dozens of production call sites honor it (jtbd-command.cjs,
  operator-command.cjs, hmi-status-command.cjs, umbilical-module.cjs,
  resolve-umbilical-target.cjs, room-birth.cjs, and every `lib/mcp/tools/*.cjs`
  file including `tool-router.cjs`, which Phase 232.1's own Plan 02 wires
  into).
  implication: cascade-rooms-module.cjs (and, before the fix, this phase's
  own room-graph-density-module.cjs) is the outlier, not the norm.
- timestamp: 2026-07-25T18:25:00.000Z
  checked: `lib/core/doctor/cascade-rooms-module.cjs` lines 48-58
  found: `resolveRoomPath` reads only `info.path`; no `abs_path` branch.
  implication: confirmed the gap is real and present in the shipped module,
  not just in this phase's copy of it.

## Technical Root Cause

- Site: `lib/core/doctor/cascade-rooms-module.cjs:48-58`, function
  `resolveRoomPath`
- Cause: the function was written (or carried forward from pre-Phase-217
  inline code) against only the `path`-relative-to-`roomsHome` registry
  convention, never updated when `abs_path` became the documented canonical
  precedence elsewhere in the codebase.
- Why it surfaces now: Phase 232.1's code-review pass explicitly compared
  this function's behavior against `resolve-active-room.cjs`'s documented
  contract while verifying a *new* module that copied it verbatim -- nothing
  about class B itself changed; it was simply never checked against this
  contract before.

## Required Code Changes
<!-- Explicit, imperative, one block per change -->

- Change 1 (optional follow-up, not scheduled):
  - Location: `lib/core/doctor/cascade-rooms-module.cjs:48-58`, function
    `resolveRoomPath`
  - Current behavior: reads only `info.path`.
  - Required behavior: check `info.abs_path` first (use as-is if a non-empty
    string), fall back to the existing `info.path` logic, exactly mirroring
    the fix already shipped in `lib/core/doctor/room-graph-density-module.cjs`
    (commit pending as part of Phase 232.1's code-review response).
  - Short-term patch: copy the fixed `resolveRoomPath` body verbatim (same
    Canon Part 7 posture that created the duplication in the first place).
  - Long-term fix: extract ONE shared `resolveRoomPath(roomsHome, info)` into
    `lib/core/doctor/shared.cjs` (which already houses `readRegistry()`) so
    this class of gap can only be fixed once, and both class B and the
    density module import it instead of each carrying its own copy.

## Tests to Add or Update

- Test 1 (if Change 1 is picked up):
  - Type: unit
  - Location: `tests/test-doctor-class-b.cjs` (extend the existing suite)
  - Given: a registry entry with `abs_path` set and no `path` key
  - When: the class-B sentinel check runs
  - Then: the room appears in `okCount` (sentinel present) or
    `missingSentinels` (sentinel absent) -- either way, it is no longer
    silently invisible to the sweep
  - Runner registration: already covered by `tests/run-all-217.sh`'s
    class-B leg once added.

## Non-Code Follow-ups

- CHANGELOG.md: not applicable unless/until Change 1 ships.
- Release lockstep: not applicable yet.
- Canon: Canon Part 7 (Reuse Before Build) is the reason this duplication
  exists at all; the long-term fix above is the Part-7-honest resolution
  (share the one correct implementation instead of two divergent copies).
- knowledge-base.md: add a summary block if/when Change 1 ships.
- Docs / monitoring / process notes: none.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: `cascade-rooms-module.cjs`'s `resolveRoomPath` never read
`abs_path`, the canonical registry precedence field documented and honored
everywhere else in the codebase; it predates this phase and was carried
forward, not introduced, by Phase 232.1's Canon-Part-7 reuse of it.
fix: this RCA's own scope is Phase 232.1 only. The one call site this phase
actually shipped (`lib/core/doctor/room-graph-density-module.cjs`) is fixed
and tested (232.1-REVIEW.md WR-01, scenario 9 in
`tests/test-232.1-room-graph-density.cjs`, mutation-verified). The sibling
gap in the already-shipped `cascade-rooms-module.cjs` is recorded here as a
known, low-severity, non-blocking follow-up -- not fixed in this phase, to
avoid unscoped changes to Phase 217's already-closed, verified surface.
verification: `node tests/test-232.1-room-graph-density.cjs` scenario 9
passes with the fix, fails without it (mutation-checked by temporarily
reverting the fix and confirming the expected failure, then restoring).
files_changed:
  - lib/core/doctor/room-graph-density-module.cjs (WR-01 fix, this phase only)
  - tests/test-232.1-room-graph-density.cjs (scenario 9 added)
commits: (pending -- committed alongside the rest of the 232.1 code-review
response)

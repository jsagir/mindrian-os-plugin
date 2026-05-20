# Session-Isolation Test Fixtures

Hermetic fixtures for Phase 128.1 (session-scoped active-room binding).

These fixtures follow the sibling-not-subdir convention (Phase 95.1 D-04): the
fixture directory sits next to the room directories it would populate, never
nested inside a real `~/MindrianRooms`.

## `registry-v2-legacy.json`

The legacy v2 registry shape, exactly as it exists on a single-session install
before Phase 128.1 ships. It carries:

- `version: 2` - the pre-re-key schema sentinel.
- `active: "room-a"` - the single global active-room string. This is the field
  the cross-session corruption race collides on (RESEARCH.md governing thought).
- `rooms` - a map of two rooms keyed by slug.

This is the INPUT the Plan 02 migration (`migrateRegistryIfNeeded`) converts to
the v3 session-keyed shape (`version: 3`, plus an empty `sessions` map and a
`last_active` convenience field, with `rooms` left byte-identical and `active`
retained as a legacy mirror per D-04).

### Room roles in the fixture

- **`room-a`** stands in for the canonical room - the 263-entry room from the
  canonical failure case (CONTEXT.md "Specific Ideas": a heal process relocated
  the active room mid-session and `compute-state` then read 0 entries for a
  263-entry room). The race tests assert that session A keeps resolving
  `room-a` after an external rebind.
- **`room-b`** stands in for the colliding room - the room a second concurrent
  session points the global `active` at, triggering the last-write-wins race.

## How tests consume the fixture

Tests MUST NOT mutate this file. The pattern (mirrors the existing
`MINDRIAN_ROOMS_HOME` hermetic-fixture idiom):

1. `fs.mkdtempSync` a tmp directory.
2. Create `<tmp>/.rooms/` and copy `registry-v2-legacy.json` into it as
   `registry.json`.
3. Set `process.env.MINDRIAN_ROOMS_HOME = <tmp>` so `scripts/resolve-room` and
   `lib/core/session-binding.cjs` resolve against the copy.
4. The real `~/MindrianRooms` is never read or written.

`tests/test-session-isolation-race.cjs` builds its hermetic fixture this way
(case 1). `lib/core/session-binding.test.cjs` requires the JSON directly as a
read-only input object for the migration unit tests.

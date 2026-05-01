# test/fixtures/conversation-operator/

Phase 99-01 fixture for the conversation operator state machine. SIBLING of `test/fixtures/cascade-surface-e2e/` (Phase 95.1-08 precedent -- surface-level vs pipeline-level fixtures live as siblings, never nested).

## Layout

```
test/fixtures/conversation-operator/
  README.md                              <-- this file
  seed-room/                             <-- COLD-START scenario: .mindrian/ empty
    .room-root
    ROOM.md
    STATE.md
    .mindrian/
      .gitkeep                           (empty directory marker)
  seed-room-resume/                      <-- RESUME scenario: state file partially filled
    .room-root
    ROOM.md
    STATE.md
    .mindrian/
      conversation-operator.json         (current=BUILD_ROOM, previous=EXPLORE_CAPTURE, 3 history entries)
```

## Test usage

`tests/test-operator-state.cjs` consumes both seed rooms:

- **seed-room** drives the cold-start path: `getCurrent(roomDir)` returns the JUST_TALK default without writing a file. Asserts no file exists after the call.
- **seed-room-resume** drives the resume path: `getCurrent(roomDir)` reads the existing JSON and returns it. Then a synthetic transition fires; the file is rewritten atomically; the test asserts schema_version, history bounded behavior, and graph-absent graceful skip.

## Why a sibling, not a subdirectory

Phase 95.1-08 established the pattern (`cascade-surface-e2e/` vs `cascade-e2e/seed-room/`): when a new fixture tests a different abstraction layer than an existing fixture, it ships as a sibling. Conversation operator state is a different layer than cascade pipelines -- different files, different code paths, different graceful-degradation modes -- so the fixture is a sibling.

## Canon Part 8

The fixture state files contain only generic operator names + ISO timestamps + the synthetic `active_room` slug `seed-room-resume`. No user content, no PII. Safe to commit.

---
type: room-identity
name: seed-room
purpose: Phase 99-01 cold-start fixture for conversation operator
phase: 99
created: 2026-05-01
fixture_scenario: cold-start
---

# seed-room (Phase 99-01 fixture)

Cold-start fixture for `lib/conversation/operator.cjs`. The `.mindrian/` directory exists but contains no `conversation-operator.json` file. Tests assert that `getCurrent(roomDir)` returns the JUST_TALK default and does NOT auto-create the file.

---
type: room-identity
name: seed-room-resume
purpose: Phase 99-01 resume fixture for conversation operator
phase: 99
created: 2026-05-01
fixture_scenario: resume
---

# seed-room-resume (Phase 99-01 fixture)

Resume fixture for `lib/conversation/operator.cjs`. The `.mindrian/conversation-operator.json` is partially filled (current=BUILD_ROOM, previous=EXPLORE_CAPTURE, 3 history entries). Tests assert that `getCurrent(roomDir)` reads it correctly and that subsequent transitions extend history without rotation (history.length stays under HISTORY_MAX=50).

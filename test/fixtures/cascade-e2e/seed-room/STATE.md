---
room: cascade-e2e-fixture
stage: frozen-test-fixture
created: 2026-04-19
license: BSL-1.1
---

# STATE.md

This STATE.md exists so that `intelligence-cascade.findRoomDir()` can walk up
from any artifact and resolve this directory as the room root. It is intentionally
minimal. The cascade test harness rewrites sibling files; nothing in the cascade
should depend on STATE.md contents.

Stage: test-fixture (not a real venture).

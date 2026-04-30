---
type: room-minto
room: surface-e2e-fixture
governing_thought: This fixture exists to gate the envelope-to-render surface path against shape regressions.
created: 2026-04-30
license: BSL-1.1
---

# Governing Thought

This fixture exists to gate the envelope-to-render surface path against shape regressions.

## MECE Support

1. detect_room_section walks up to .room-root and returns "<roomDir>|<section>".
2. The cascade pipeline writes <roomDir>/.mindrian/last-cascade.json with 8 root keys.
3. The bash post-write hook emits a Claude Code 2.x compliant envelope with hookSpecificOutput.additionalContext matching one of two recognized prefixes.

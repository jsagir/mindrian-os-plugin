# tests/fixtures/phase-109/sample-room/

Canonical 500-node fixture room for Phase 109 navigation tests.

Composition (per RESEARCH section 10.1):
- 1 room node
- 8 section nodes
- 50 artifact nodes
- 100 claim nodes
- 80 assumption nodes
- 60 evidence nodes
- 30 decision nodes
- 25 open_question nodes
- 20 opportunity nodes
- 30 stakeholder nodes
- 50 memory_event nodes
- 40 entity nodes
- 20 jtbd anchor nodes
- approximately 600 edges across the 23 EDGE_TYPES

The room.db file itself is generated at test time by applying seed.sql against an empty database. It is NOT committed to git. seed.sql IS committed and IS the source of truth.

Owner: Phase 109 SQL Context-Memory Navigation Spine.

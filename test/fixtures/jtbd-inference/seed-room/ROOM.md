---
room: jtbd-inference-fixture
type: test-fixture
created: 2026-05-01
purpose: Hermetic seed room for Phase 100-02 JTBD classifier corpus tests
founding_phase: 100
icm_layer: 0
license: BSL-1.1
---

# JTBD Inference Fixture Room

This is the seeded Data Room used by `tests/test-jtbd-classifier.cjs` and
`test/fixtures/jtbd-inference/seed-messages.json`.

The room exists to give the classifier a non-null `room` argument, a real
STATE.md to walk Decisions from for Stratum 3 (recency) testing, and a
ROOM.md per Decision #15.

It is intentionally minimal -- no methodology artifacts, no graph database,
no .mindrian/ state. The classifier is a pure function and does not touch
the filesystem itself; the room argument is a string handle. The fixture
files exist mainly so future phases (101-105) that DO read the room
filesystem can reuse this hermetic root.

Contrast with `test/fixtures/cascade-e2e/seed-room/`: that fixture seeds
problem-definition / market-analysis / solution-design artifacts so the
intelligence cascade produces a deterministic edge baseline. This fixture
seeds NOTHING beyond identity + STATE.md decisions; the corpus test
exercises the classifier against typed input objects, not a filesystem walk.

## Business Source License 1.1

This fixture is covered by the BSL 1.1 license that governs the MindrianOS
Plugin repository. See the repository root LICENSE file for terms.

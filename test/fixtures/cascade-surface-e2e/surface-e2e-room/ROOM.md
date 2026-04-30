---
room: surface-e2e-fixture
type: test-fixture
created: 2026-04-30
purpose: Class D end-to-end test fixture (DOCTOR-95.1-02 / DOCTOR-95.1-08)
sections:
  - problem-definition
license: BSL-1.1
---

# Surface E2E Fixture Room

Sibling to `cascade-e2e/seed-room/`. This fixture tests the SURFACE path
(envelope -> Claude Code schema validator -> side-channel write -> reader
contract). The seed-room sibling tests the PIPELINE path (edge counts). They
must coexist without sharing state.

The acceptance gate is `<roomDir>/.mindrian/last-cascade.json` exists with the
8 root keys per `tests/test-cascade-side-channel.cjs` Test 3. See
`../README.md` for the rollback policy.

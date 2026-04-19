---
room: cascade-e2e-fixture
type: test-fixture
created: 2026-04-19
purpose: Frozen fixture that gates Plan 87-03 cascade refactor
sections:
  - problem-definition
  - market-analysis
  - solution-design
license: BSL-1.1
---

# Cascade E2E Fixture Room

This is the seeded Data Room used by `test/fixtures/cascade-e2e/cascade-e2e.test.cjs`.
It contains three artifacts across three sections that, when run through the
intelligence cascade (`lib/core/intelligence-cascade.cjs`), produce a deterministic
set of typed edges in `.mindrian/room.db`.

The frozen baseline at `../expected-edges.json` is the acceptance gate for Plan
87-03 (cascade deduplication refactor). If the refactor changes edge counts
against this baseline, the refactor is rolled back -- no exceptions.

See `../README.md` for the full rollback policy and baseline regeneration
workflow.

## Business Source License 1.1

This fixture is covered by the BSL 1.1 license that governs the MindrianOS
Plugin repository. See the repository root LICENSE file for terms.

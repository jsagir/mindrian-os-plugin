---
type: room-minto
room: cascade-e2e-fixture
governing_thought: Three artifacts across three sections produce four typed edges (INFORMS, CONTRADICTS, CONVERGES, INVALIDATES) to gate Plan 87-03 refactor.
created: 2026-04-19
license: BSL-1.1
---

# Governing Thought

Three artifacts across three sections produce four typed edges (INFORMS,
CONTRADICTS, CONVERGES, INVALIDATES) to gate Plan 87-03 refactor.

## MECE Support

1. **Problem definition** frames the venture as a JTBD underservice finding.
2. **Market analysis** contradicts that framing by asserting late maturity.
3. **Solution design** resolves the contradiction via a niche-within-mature thesis.
4. Cross-references produce INFORMS; the contradiction term produces CONTRADICTS.
5. Shared keyword density across all three produces CONVERGES; explicit
   `supersedes:` frontmatter on the solution artifact produces INVALIDATES.

## Rollback Trigger

If `cascade-e2e.test.cjs` exits 1 after Plan 87-03 ships, the refactor is
rolled back via `git revert <87-03-commit>`. No exceptions.

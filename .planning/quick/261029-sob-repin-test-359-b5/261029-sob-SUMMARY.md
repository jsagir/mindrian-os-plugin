---
quick_id: 261029-sob
status: complete
---

# Quick 261029-sob Summary: re-pin test-359 leg B5

## Result
Leg B5 for session-start is re-pinned. Only the sha constant and a comment changed in tests/test-359-prose-budget.cjs.

## Evidence (PROVEN)
- `git log 8b9690def..HEAD -- scripts/session-start` lists 656cd8a34 (doctrine line only) and dfbadf150 (sof).
- A line diff of the two versions, with the NAV_CARD_FIRE_DOCTRINE line removed, shows exactly 3 changed lines: BRIDGE_FILE, the mktemp fallback and UPDATE_CACHE. Each now uses `${TMPDIR:-/tmp}`.
- The old pin 247f7746... matches the base 8b9690def version. New pin: e308e736...
- `node tests/test-359-prose-budget.cjs`: 18 passed, 0 failed.
- `node tests/test-3696-isolation.cjs`: PASS 70, FAIL 0.

## Commits
- 40e4d4b4b: test re-pin.

## Deviations
None.

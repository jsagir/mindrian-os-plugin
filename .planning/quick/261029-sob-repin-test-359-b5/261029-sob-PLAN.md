---
quick_id: 261029-sob
type: quick
files_modified: [tests/test-359-prose-budget.cjs]
---

# Quick 261029-sob: re-pin test-359 leg B5 (session-start)

## Problem
Leg B5 "session-start outside the doctrine line is byte-untouched" in tests/test-359-prose-budget.cjs fails. Its frozen sha was taken at base 8b9690def. Quick 261029-sof (commit dfbadf150) later changed 3 lines of scripts/session-start so temp paths follow TMPDIR. Found by the 369.6-03 executor.

## Tasks
1. Confirm the only difference from base 8b9690def outside the doctrine line is the 3 sof lines. Stop with NEEDS_HUMAN if not.
2. Set FROZEN_SHA.SESSION_START_OUTSIDE_DOCTRINE to the current sha. Add a comment naming quick 261029-sof and commit dfbadf150. Change nothing else.
3. Run tests/test-359-prose-budget.cjs (must pass) and tests/test-3696-isolation.cjs (must stay 70/0).

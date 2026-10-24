# 380-16 code review

Diff reviewed: release tree, `git diff <PRE_SHA>..HEAD -- ui/mos-face lib/mos-face tests` (PRE_SHA 01ed3f929; commits d4dea1c8a, 8860d3cd2, d1c7bc205). Reviewer: the executing agent, applying the code-reviewer checklist (design, logic, security, performance, tests, naming, error handling, documentation). Not an independent reviewer.

## Summary

Intent: one ask gets one honest sentence about what happened to the person's words, the sentence names the kind of thing that was removed and never the text, a new ask clears the old sentence, and the wire text stays byte for byte the same.

The change is small and pure where it can be: hooks/sent.ts holds the unions and the texts; advice.ts classifies each call; register.tsx only draws.

## Critical issues

None.

Security baseline checked (PROVEN by reading the diff and by tests):
- The left list holds only keys of LEFT_WORDS (hooks/sent.ts `leftPhrase` reads `LEFT_WORDS[kind]`). S8 plants a 34 character canary folder name and fails if it reaches a Text or a recorded call.
- No new outbound call, process or read. The loop in askTheo makes the same calls in the same order. Budget legs pass (tests/test-380-budget.cjs 11 passed, budget.test.ts).
- Wire text byte equal. S9 pins six texts to the output of the code before this plan. tests/egress.test.ts and test-380-egress.cjs pass unedited (29 passed).

## Major issues

None open.

## Minor issues

1. UNVERIFIED shape. hooks/sent.ts `MISSING_RETURNED` (a returned isError with "No such tool available") was not measured. Only the thrown shape was. The pattern is a closed regex pinned in S11, harmless if wrong (the result would read as failed, which says "may have been received"). Keep, mark in the SUMMARY.
2. A wording edge. When the shim fails with a call that carried the words and the raw server then answers without them, the row says "A call to Theo failed on the way, so Theo may have received" while the panel also shows Theo's suggestions. Both statements are true. A clearer wording is a book question (Questions 1).
3. Pre-existing, not introduced: `autoInFlight` in hooks/register.tsx is module state and a tool call that never settles keeps it true until the session ends, so later asks return at once. S7 therefore sits last in tests/sent.test.tsx. The real engine may time such a call out; that is UNVERIFIED.
4. `as never` on the tool call input in askTheo stays (the engine type does not accept the dynamic tool name). It is the pattern of the file before this plan. No new `as` casts, no `any`, no enum (grep of the diff).
5. The README says `sanitize` is "the text of sanitizeNoted"; the wire guarantee rests on S9 pinning six texts, not on a proof for all texts. The steps are the same replace calls in the same order, so the risk is low.

## Positive feedback

- Every union (CallOutcome, RawCall, Delivery, SentRow) has an exhaustive switch with an `assertNever` default; the type check is zero errors.
- `deliveryOf` is one pure rule with a 4 by 4 table test (S11b) and a one-carrier table (S11c). The contradiction of the real screen cannot come back through the render, because the render reads one SentRow.
- The thrown shape was measured first, in a scratch HOME with the login by symlink, and the plan text was corrected from the measurement.
- The failing output of the RED run is saved (380-16-evidence/red-sent.txt) and matches the stated causes.

## Questions for author

1. Should the book wording say "may have been received" when the answer came through the raw server without the words? (Book proposal P16-1 covers the sentence; this edge is not in it.)
2. Does the real engine time out a tool call that never settles? If not, a hung Theo call blocks asks for the rest of the session. Worth a separate gap.

## Verdict

Approve.

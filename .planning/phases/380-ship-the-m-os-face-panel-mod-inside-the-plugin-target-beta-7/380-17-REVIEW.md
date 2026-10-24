# Code review: plan 380-17 (the idle context gauge, G5, and the G6 documentation)

Reviewer skill: code-reviewer (checklist: design, logic, security, performance, tests, naming, error handling, documentation). Diff: release tree d1c7bc205..058af2f0e, paths ui/mos-face, lib/mos-face, tests (9 files; the diff base is 380-17-PRE-SHA.txt).

## Summary

Intent in one sentence: while no reply has used any of the window, the Context row says the eight boxes are the context gauge waiting for the first reply, a reading keeps today's line, and the boxes themselves do not change.

The change is small and pure: one new module (hooks/gauge.ts, 47 lines), one changed line in hooks/register.tsx, one assertion in an earlier test, a backward-compatible option in tests/support.ts, a new test file, the README, and the rebuilt dist. No critical or major finding.

## Critical issues

None.

## Major issues

None.

## Minor issues

1. hooks/gauge.ts lines 41 to 43, design: the case none of the switch repeats the idle return of lines 32 to 34. It is unreachable (isReading already ruled out no figure) and the comment says so. A shared constant for the idle line would remove the repeat. Not changed: the switch must name every band for the never check, and the repeat is two lines.
2. hooks/gauge.ts line 24, logic: isReading accepts Infinity, so a figure of Infinity reads "Context Infinity% - cliff". This is the same as before the change (the old code printed it too), the host gives a finite percent, and the canvas clamps to 100. Not changed. Making Infinity idle would put "waiting" words next to a full canvas, which is worse.
3. hooks/register.tsx line 1262, behavior: a percent of NaN used to print "NaN%"; it now says the idle words (test G-8 pins it). The canvas for NaN is still drawn as idle boxes, so the row and the boxes agree. This is a small fix, not a regression.
4. README.md, documentation: the section "How to try the panel from a checkout" names runs R1, R1b and R4 of the facts file, which sits in the phase folder (a different tree). A reader of the README alone cannot open them. Left as is: the README of this walled package already points at the phase folder in other sections.
5. tests/gauge.test.tsx, G-7: the test engine has no way to invalidate a mounted drawing (tsc refused $.ui.invalidate), so "the next render" is a second mount. The comment in the test says so. The transition is proven for the pane's read of the host figure on each render, which is the real cause of the change.
6. At 35 columns the short idle words are 36 characters, so the row may wrap to a second row (UNVERIFIED, props only; the README says so). The plan fixed the strings, so this was not changed.

## Positive feedback

- hooks/gauge.ts uses a discriminated union, a type predicate (isReading) and an exhaustive switch with an assertNever check. No enum, no explicit any, no needless as (grep of the two new files: none). The type check has zero errors.
- The canvas call and its pixels are untouched: tests/meter-pin.test.ts (18 pins) passes unedited, and G-9 pins the canvas rows (4 rows of 32 cells) on the pane.
- Tests are plain sentences with exact strings, edge percents (0 and 100), the transition, NaN, and both label forms; none depends on order, none reads a real home (the world serves everything from memory).
- RED was run and kept (red-gauge.txt): G-1 to G-4, G-7 and G-8 failed for the stated reason, G-5, G-6 and G-9 passed before the change.
- No string of the diff holds an em-dash or en-dash, or the words Larry, ICM, Brain or MCP (grep of 305 added lines).
- The idle words carry the meaning in words and use no color, which follows the book rule that color never carries meaning alone (mos-brand book e947a5d, terminal segment, proposed).
- The facts file separates what the run proved from what it did not, and says the real plugin root was not run.

## Questions for author

- Plan said not to edit any earlier test body. Test P6 (tests/status.test.tsx line 228) asserted the old words "Context: waiting" at the wide size, while the plan's own G-1 requires that no row says them at that size. One regular expression was changed to the new words, in the GREEN commit, and nothing else of that file. Is that the ruling the navigator wants, or should P6 be rewritten another way? (Recorded as a deviation in the SUMMARY.)
- tests/support.ts gained the percentNow option so G-7 can change the host figure between renders. The option is backward compatible (every earlier call without it behaves the same). Acceptable?

## Test coverage assessment

- [x] Happy path (reading at 9, 62 and 80 percent)
- [x] Edge cases (0, 100, NaN, undefined, both label forms, 35, 44 and 56 columns, NO_COLOR, short terminal)
- [x] Transition from idle to a reading
- [ ] The idle gauge on a real screen: not covered (plan 10 captures it). Implementation complete; visual verification pending.

## Checklist

- [x] No security finding: the module is pure and adds no tool call, http call, process or read (budget tests B1 to B9 and node tests/test-380-budget.cjs pass, 11 passed).
- [x] Performance: one string build for each render, no loop.
- [x] Readable and named: gaugeText, GaugeLine, isReading, IDLE_WITH_BOXES.
- [x] Dist fresh: node scripts/build-mos-face.cjs --check says fresh (source hash ce278dc654423efc).
- [x] README claims only what the facts file proved.

## Verdict

Approve. No critical or major finding.

---
id: SEED-130
title: "Part 8 name rule under-block: a person name beside a head noun is exempt, and the 2026-10-18 widening (interview, check, whys) makes the leak wider"
status: open
priority: high
filed: 2026-10-18
partially_closed_by: "quick 261019-91i (2026-10-19), commits b22966d7f and 19453c8a2"
source: "debug session part8-egress-guard-name-class-blocks-unknown-tool-names (2026-10-18), navigator option B"
depends_on: lib/core/part8-egress-guard.cjs (METHODOLOGY_HEAD_NOUNS, _hasUnknownProperName), Canon Part 8 (docs/MINDRIAN-CANON.md)
promotes_to: a /gsd-quick or a small phase; the navigator decides the slot. The test tag KNOWN-UNDER-BLOCK in tests/test-part8-name-class-methodology-names.cjs (leg K1) goes green when this closes.
---

# SEED-130: the head-noun exemption is a name leak, now wider

## Problem

`_hasUnknownProperName` skips any TitleCase word that sits within 2 tokens of a word in METHODOLOGY_HEAD_NOUNS, in either direction. It also skips a whole TitleCase run when the word just outside the run is a head noun. The check compares the lowercased word, so it is case-blind and position-blind.

Before 2026-10-18 the list was: framework(s), method(s), model(s), principle(s), pyramid, matrix, analysis, canvas, theory/theories. Navigator option B (approved 2026-10-18) added three nouns so five generic methodology questions stop blocking: interview, check, whys. Each noun exempts any name within 2 tokens of it.

The new nouns are worse than the old ones in one respect. "check" and "interview" are ordinary English words (a verb and a noun in everyday sentences), so a lowercase use exempts the name beside it, not only a TitleCase tool name.

## Evidence

- PROVEN (in-memory run of the guard source with and without the three nouns, then the test leg K1; pseudonyms; same result with no room and with a fixture room):

| Question | Before the widening | After |
|----------|---------------------|-------|
| Which framework did Marrowby Pell Interview use? | block, name | allow |
| Which question set does Fennick Harlow Check use? | block, name | allow |
| Which tool follows the Five Whys of Marrowby Pell? | block, name | allow |
| Did Marrowby Pell check the plan? | block, name | allow |
| Summarize the interview Marrowby Pell gave | block, name | allow |

- PROVEN: "What did Marrowby Pell say?" and the 5 human-name questions of group C in the test still block after the widening. The leak needs a head noun within 2 tokens.
- PROVEN: the leak already existed for the old nouns ("Which Marrowby Pell Framework fits an ill-defined problem?" allowed before this change).
- PROVEN (ablation): each added noun is needed. Without "interview", Q2 and Q8 block. Without "check", Q5 blocks. Without "whys", Q7 blocks. "technique" is not needed (Q11 allows through "whys") and was not added.

## Proposed direction

In the order of least policy change:

1. Match the three new nouns (and ideally the old ones) only when the head-noun word itself is TitleCase, so a lowercase verb "check" no longer exempts a name. Small code change; needs the navigator's ruling because it is a new rule, not a noun addition.
2. Narrow the exemption from "within 2 tokens either side" to "the head noun is directly adjacent after the run" (Kano Model, Lean Canvas, Problem Interview). A name followed by a verb stops being exempt.
3. Revert the three nouns and use option A of the debug session: a reviewed, tracked data file of generic tool names Theo does not know yet (Problem Interview, Opportunity Fitness Check, Five Whys, Five Whys Technique), loaded next to CANONICAL_PHRASES and applied only inside `_hasUnknownProperName`. This keeps the exemption exact instead of open-ended.

## Canon Part 8 impact

Direct. Part 8 says user data NEVER egresses to the Brain. A person name beside one of the new head nouns now egresses. The navigator accepted this trade on 2026-10-18 to unblock the learning session; this seed records the size of it so the trade can be reversed.

## Link

Debug session: .planning/debug/resolved/part8-egress-guard-name-class-blocks-unknown-tool-names.md
Related: SEED-129 (lowercase person name never inspected), SEED-132 (alias normalization).

## Update 2026-10-19 (quick 261019-91i)

Rule R, in plain words. The 14 original head nouns are back in METHODOLOGY_HEAD_NOUNS and keep the old behavior (case-blind, 2-token window). The three nouns interview, check and whys moved to a new set, TITLECASE_TOOL_HEAD_NOUNS. A new noun counts only when it is TitleCase and directly follows an adjacent TitleCase word. It exempts only the TitleCase words directly before it, plus itself. It never exempts a word after it, a word across "of" or "the", a word near a lowercase "check" or "interview", or a word in the 2-token window. This is SEED-130 directions 1 and 2 applied to the three new nouns only.

All verdicts below are PROVEN by node runs at HEAD 012224653 and after the fix (commit 19453c8a2), with no room and with the fixture room. Names are invented.

| Question | HEAD 012224653 | After | Leg |
|----------|----------------|-------|-----|
| Did Marrowby Pell check the plan? | allow | block, name | N1 |
| Summarize the interview Marrowby Pell gave | allow | block, name | N1 |
| Which tool follows the Five Whys of Marrowby Pell? | allow | block, name | N1 |
| Which tool does Interview Marrowby Pell teach? | allow | block, name | N2 |
| Which tool does Problem Interview Marrowby Pell teach? | allow | block, name | N2 |
| Did the Problem Interview Odalys Brennick ran work? | allow | block, name | N2 |
| Which tool does Marrowby Pell interview teach? | allow | block, name | N2 |
| Please check Marrowby Pell first. | allow | block, name | N2 |
| Which tool did Marrowby Pell of Five Whys teach? | allow | block, name | N2 |
| When does Interview help a team? | allow | block, name | probe run (not a leg) |
| Which framework did Marrowby Pell Interview use? | allow | allow (residual) | K1 |
| Which question set does Fennick Harlow Check use? | allow | allow (residual) | K1 |
| Which tool follows Marrowby Pell Whys? | allow | allow (residual) | K1 |
| Which tool did Marrowby Pell Five Whys teach? | allow | allow (residual) | K1 |

The five exam questions Q2, Q5, Q7, Q8 and Q11 still allow (leg A1). Group C (unrecorded two-word human names) still blocks.

### Residual

A person name directly before a TitleCase new noun has the shape of a tool name ("Marrowby Pell Interview" looks like "Problem Interview"). Rule R reads shape only, so it cannot tell a person from a tool. In "Which framework did Marrowby Pell Interview use?", "Marrowby" is also exempt by the old noun "framework" within 2 tokens. The test prints KNOWN-UNDER-BLOCK for 8 of 8 probe runs (leg K1).

The 14 old nouns keep the case-blind, position-blind window by scope (leg N3 asserts the verdicts of commit 99bbbaa66). The old half of the leak stays open: "Which Marrowby Pell Framework fits an ill-defined problem?" still allows.

A lone TitleCase new noun with no TitleCase word before it ("When does Interview help a team?") blocks again, as it did before 2026-10-18.

### Remaining direction

SEED-130 direction 3, an exact reviewed list of tool names, closes the residual shape and can retire the three new nouns.

### Test counts

| Suite | Baseline 012224653 | After |
|-------|--------------------|-------|
| run-all-3692 | PASSED 71, FAILED 2 (Theo verdict V6 hook latency, 366 guard navigator release) | PASSED 71, FAILED 2 (same two labels) |
| test-3692-theo-verdict | 25 pass, 1 fail (V6 p95 551 ms) | 25 pass, 1 fail (V6 p95 618 ms, latency only) |
| test-3692-lexicon-generic-entries | 9 pass, 0 fail | 9 pass, 0 fail |
| test-3692-guard-survey-gate | 5 pass, 0 fail | 5 pass, 0 fail |
| part8-egress-guard.test | exit 0 | exit 0 |
| test-part8-name-class-methodology-names | 12 pass, 4 fail at the RED commit | 16 pass, 0 fail, 3 skipped, 1 known-under-block |

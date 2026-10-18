---
id: SEED-130
title: "Part 8 name rule under-block: a person name beside a head noun is exempt, and the 2026-10-18 widening (interview, check, whys) makes the leak wider"
status: filed
priority: high
filed: 2026-10-18
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

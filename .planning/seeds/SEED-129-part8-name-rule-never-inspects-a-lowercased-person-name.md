---
id: SEED-129
title: "Part 8 name rule under-block: a lowercased person name is never inspected, so it reaches Theo"
status: filed
priority: high
filed: 2026-10-18
source: "debug session part8-egress-guard-name-class-blocks-unknown-tool-names (2026-10-18), Evidence entry 'capitalization blind spot and head-noun leak'"
depends_on: lib/core/part8-egress-guard.cjs (_hasUnknownProperName), Canon Part 8 (docs/MINDRIAN-CANON.md)
promotes_to: a /gsd-quick or a small phase; the navigator decides the slot. Needs a policy ruling first (see Proposed direction).
---

# SEED-129: the name rule only looks at TitleCase words

## Problem

The Part 8 proper-name rule (`_hasUnknownProperName` in lib/core/part8-egress-guard.cjs) only considers a word that matches `/^[A-Z][a-z]/`. A person name typed in lowercase never enters the loop. The string passes as a generic question and goes to Theo.

The same blind spot is why "ask it in lowercase" worked for the false positive in the debug session: the lowercase twin of a blocked methodology question passes. A lowercased person name passes for the same reason.

## Evidence

- PROVEN (run through theoVerdict with no room bound, pseudonym): "what does fennick harlow think about the lean canvas?" returns verdict allow, class generic_question. The TitleCase twin "What does Fennick Harlow think about the Lean Canvas?" returns block, room_content, name.
- PROVEN: the lowercase twin of the reported question Q2 ("when should you use a problem interview, ...") allows. Same cause.
- PROVEN: for the 10 PRIVATE_CORPUS canaries of tests/test-3692-theo-verdict.cjs with no room bound, 6 are refused by the name rule alone (Blackwood expansion, Ashgrove pilot, Halcyon roadmap, "merger with Cobalt Systems", Ridgeline acquisition, Ferrow expansion). For these, the name rule is the only Part 8 backstop when the room never recorded the name.
- UNVERIFIED by run: whether the room lexicon (part8-room-lexicon.cjs) stops a lowercased name that the room DID record. Reading line 72 of that file shows it folds case, so a recorded name is likely caught. An unrecorded name is the exposed case.

## Proposed direction

Do not weaken the rule. Options for the navigator, in the order of cost:

1. Inspect lowercase word runs that follow a person cue ("did", "does", "what did", "according to", "says") when the run is not a closed-vocabulary word. High false-positive risk; needs the vocabulary sets.
2. Block a lowercase run of 2 or more words that holds no closed-vocabulary token and no canonical framework phrase. This is closer to the doctrine "absence of proof is not an allow" and matches `_proveTypedQuestion`.
3. Accept the gap and record it as a named residual risk in the Part 8 notes, because the model, not the human, types the question and rarely lowercases a name.

Pair any change with the test group C pattern from tests/test-part8-name-class-methodology-names.cjs: a pseudonym in lowercase must block, and the lowercase methodology twin must still allow. The two aims pull against each other; that is why this needs a ruling.

## Canon Part 8 impact

Direct. Part 8 says user data NEVER egresses to the Brain. A person name in lowercase is user data that passes today. Severity is limited by how often a lowercased name is produced, which is UNVERIFIED.

## Link

Debug session: .planning/debug/resolved/part8-egress-guard-name-class-blocks-unknown-tool-names.md
Related: SEED-130 (head-noun name leak), SEED-132 (alias normalization).

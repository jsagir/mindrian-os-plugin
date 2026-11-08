# Owner answers record, 2026-11-08

Source: main session chat, owner chose "Recommended on all". Each token below is the RECOMMENDED token printed on the card. The cards have no OWNER-ANSWER-DATE line, so no date line was edited. Only OWNER-ANSWER lines changed.

## Phase 391 (391-DECISION.md)
Tokens: C1 APPLY-ALL; C2 APPLY; C3 APPLY-NARROW-BASH; C4 FILE-SEED; C5 REMOVE; C6 LAG-20.
Checker: gate C1..C6 gave READY for every card. `check` gave "check OK: 6 cards complete".

## Phase 389 (389-DECISION.md)
Tokens: D1 to D11 all APPROVE (D10 APPROVE, not DROP; D11 APPROVE, not FLAG-FALSE).
Checker: `check` gave "CHECK OK: 11 answer lines, hash matches, HEAD is an ancestor, 0 PENDING". gate D1..D11 gave APPROVED and GATE PASS (exit 0) for all 11. Coupling rules hold (D1 needs D2, D6 needs D1 and D2).

## Phase 390 (390-DECISION.md)
Tokens: G1 RECOMMENDED; G2 RECOMMENDED; G3 KEEP-ALL; G4 RECOMMENDED; G5 RECOMMENDED; G6 RECOMMENDED.
Checker: check-decision OK (6 groups, 20 items). gate-group: G1, G2, G4, G5, G6 ANSWERED-ACTION (exit 0); G3 DECLINED (exit 2, owner keep, expected). resolve: OD-2=DEADLINE-90D, OD-4A=FIX-PROSE, OD-4B=FIX-PROSE, OD-8A=BUILD, OD-11=CUT-VISUALIZE, OD-13=PROVE-FIRST, all others KEEP.

## Phase 370 (370-DECISION.md) - PARTIAL
Tokens written: G2 RECOMMENDED; G3 RECOMMENDED. G1 NOT written (stays PENDING).
Reason: item O2 has RECOMMENDED: SET-CAPS. The three O2-VALUE lines (body_words_max, reflection_questions_max, cross_domain_under) need owner numbers. No number was invented.
Checker: check-decision OK (3 groups, 8 items). gate-group G1 BLOCKED-PENDING (exit 1); G2 ANSWERED-ACTION (O3=EXEMPT-IF-IN-SOURCE); G3 ANSWERED-ACTION (O6A=BLOCKER, O6B=LOG-ONLY, O8=FRONTMATTER).

## Skipped
No card skipped. Only 370 G1 is open.

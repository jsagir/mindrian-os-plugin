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

## Correction 2026-11-08 (later, same day)

Source: the owner decided directly in the main session chat, after a conflict between two channels was put to him. His final words: 390 = KEEP-ALL on all six groups; 370 item O2 = KEEP (no caps). This section replaces the Phase 390 tokens above and closes the open 370 G1.

### Phase 390 (commit 5f1718d6b, replaces 5fdb0f125)
Tokens: G1 to G6 all KEEP-ALL. KEEP-ALL is a legal token on every group (card grammar). Only the five OWNER-ANSWER lines G1, G2, G4, G5, G6 changed; G3 was already KEEP-ALL. No sealed text, hash or OPTIONS line was edited. The gate did not refuse the re-answered card.
Checker: check-decision OK (6 groups, 20 items). gate-group G1..G6 all DECLINED (exit 2). resolve: all 20 items resolve to KEEP (OD-2 is no longer DEADLINE-90D, OD-8A no longer BUILD, OD-11 no longer CUT-VISUALIZE).

### Phase 370 (commit 5b9fb797b)
Token: G1 CUSTOM O1=WITHHOLD O2=KEEP O4A=DROP O4B=ANONYMIZE. O1, O4A and O4B are each item's own RECOMMENDED token as printed on the card. O2=KEEP is the owner decision. The three O2-VALUE lines stay PENDING (they apply only to SET-CAPS); the gate accepts them. G2 and G3 untouched (RECOMMENDED).
Checker: check-decision OK (3 groups, 8 items). gate-group G1, G2, G3 all ANSWERED-ACTION (exit 0). resolve: O1=WITHHOLD, O2=KEEP, O4A=DROP, O4B=ANONYMIZE, O3=EXEMPT-IF-IN-SOURCE, O6A=BLOCKER, O6B=LOG-ONLY, O8=FRONTMATTER. No PENDING, no BLOCKED.

Phase 370 G1 is no longer open. No card is open now.

## Phase 374 (374-DECISION.md)

Source: the owner answered directly in the main session chat on 2026-11-08 by choosing "RECOMMENDED on all seven".
Tokens: G1 to G7 all RECOMMENDED. RECOMMENDED is a legal token on every group (card grammar, and every OPTIONS line prints a RECOMMENDED value). Only the seven OWNER-ANSWER lines changed. No sealed text, hash, HEAD line or OPTIONS line was edited.
Checker: 374-gate.cjs check-map gave "OK check-map plans=7 items=8". 390-gate.cjs check-decision gave "OK check-decision groups=7 items=8". gate-group: G1 DECLINED (exit 2, owner keep, expected); G2 to G7 ANSWERED-ACTION (exit 0).
resolve: OD-1=KEEP, OD-2=ADD-FORGET-TOOL, OD-3=TOPK-200, OD-4=USER-DIR, OD-5A=F6, OD-5B=SCREEN, OD-6=ENGINE-BUSY-GUARD, OD-7=PAGE-ARG. No PENDING, no BLOCKED.
Plans (374-gate.cjs plan): 374-08 PLAN-GO, 374-09 PLAN-GO, 374-10 PLAN-GO, 374-11 PLAN-GO, 374-12 PLAN-GO (OD-3 and OD-7 both go), 374-13 PLAN-GO, 374-14 PLAN-GO (its act item OD-1=KEEP maps to go: record the budget). All exit 0. No PLAN-DECLINED, no PLAN-REPLAN.
No gated plan was executed. Nothing was pushed.

# 380 human rulings (plan 380-11)

Date: 2026-10-24. Source: 380-11-NAVIGATOR-RULINGS.md (ruled by the navigator, 2026-10-24; Larry recommendation accepted, "yes that the decisions"). The text below is copied from that file. No reply of a person is invented here.

## Book follow-ups and defaults

Gate 1: defaults (section B of 380-BOOK-FOLLOWUPS.md)
- APPROVED: keep both status lines.
- APPROVED: keep the /mos-* names.
- APPROVED: dimmed paper for secondary text on ink.
- APPROVED: terminal only. Desktop and Cowork are a deliberate skip.
- APPROVED: seven of eleven states mapped.
- APPROVED: removal of the python3 query.
- APPROVED: P1 (excerpt only through the guarded shim, never the raw theo server). Default on.
- APPROVED: P2 (MOS_FACE_WORDS switch). Default on. Veto is /mos-words off.
- CHANGED: the glossary first sentences from the private PWS glossary are NOT approved. Ship the panel without them until the glossary is cleared (PWS filing rules: remove institution names, label AI text, keep provenance).
- APPROVED, CONDITIONAL: the "Theo | MindrianOS" badge. Confirm the public Theo naming before the cut. No ruling found. UNVERIFIED.
- RULED EARLIER: the reply chip (D-07, Quote the reply as is).

Book proposals A1 to A7
- APPROVED: take them to the mos-brand book repo as a separate task after the cut. They do not gate the cut. The book is not edited from phase 380.

Code action in this plan: none. P1 and P2 were not vetoed, so no flag changed and no dist was rebuilt. The glossary change (rows above) is NOT applied here; see Gap closure needed.

## Host checks and receipt

Gate 2: Windows and Desktop checks
- DEFERRED: "terminal-only cut, Windows and Desktop observed after release." "No panel on Desktop" stays ASSUMED.
- Windows numbers: not given. Desktop observation: not given.

Gate 3: real-room receipt
- OPEN: a person reads the real-room report and signs the receipt at the cut. MOD380-06 stays incomplete until then.
- Receipt: not signed. This plan signs nothing.

MOD380-06: OPEN.

## Gap closure needed

1. Glossary: the release tree (/home/jsagi/dev/MindrianOS-Plugin-release, HEAD 7c710db04) still ships ui/mos-face/hooks/glossary.ts and lib/mos-face/dist/glossary.js, and voice.ts glossaryWords feeds the pane. The navigator did not approve them. A gap-closure plan must remove or empty the glossary lines, rebuild the dist and re-run the tests before the cut. This plan changed no code.
2. Badge: confirm the public Theo naming for "Theo | MindrianOS" before the cut.
3. State count: the ruling says seven of eleven. The build maps 10 of 11 (Reframe unmapped). Confirm.

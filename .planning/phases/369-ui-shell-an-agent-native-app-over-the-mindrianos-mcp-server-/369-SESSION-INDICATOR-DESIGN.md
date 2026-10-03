# 369 Session Indicator: Signed Design Note (D-04)

Plan: 369-10. Requirement: CANON369-03. Built by plan 24 from this note.
Source brief: 369-SESSION-INDICATOR-BRIEF.md (four questions, one AskUserQuestion card).
Rule: statusline co-design. The navigator chose every answer below; the executor proposed, never picked.

## 1. The navigator's answers, verbatim (2026-10-03)

Resume signal: "Q1 A, Q2 B, Q3 B, Q4 A"

| Q | Option chosen | Recommended? |
|---|---------------|--------------|
| 1. Header scope | "Room + word if unhealthy (Recommended)" | yes |
| 2. State words | "Three words, always shown" | no, a navigator override |
| 3. Browser copy | "Always show change number" | no, a navigator override |
| 4. Risk trigger | "One sentence plus fix (Recommended)" | yes |

Option text as the card put it:
- Q1 A: room name always; identity, version and session id live in the Status panel only.
- Q2 B: "Connected" (only after an acknowledged MCP round trip), "Reconnecting...", "Disconnected"; "Connected" is always visible.
- Q3 B: "Browser copy: up to change {n}" permanently; while catching up or rebuilding the words change accordingly.
- Q4 A: one sentence with its one-click fix ("Your answer is not confirmed yet. Check now"), announced once through the LiveRegion.

No wording changes were requested.

### Reconciliation of Q1 and Q2

Q1 A said the connection word appears in the header only when something is wrong. Q2 B says the connection word is always shown. The two answers meet like this: the header carries the room name and the connection word always (Q2 B decides the word's visibility); Q1 A still decides everything else, so version, MindrianOS identity and the MCP session id stay in the Status panel and never enter the header. The decisions-waiting count stays in the Decisions tab and is not repeated in the indicator.

## 2. The resulting spec

Desktop header, right side, left to right: the room name sits in the RoomSelector (first content item, unchanged), then the indicator (connection word, browser copy line), then the "Status" control. Words are Label 12 mono, ink; the room name is Body 16/700. Every word is paired with a 12px StateMark (aria-hidden); meaning is always in the written word, never colour alone.

Phone (below 768px): the header shows the wordmark, the room name and Status only. The whole indicator, including the browser copy line, lives inside the Status panel. Risk sentences (state 6) also appear as the one-line banner at the top of the view body, as UI-SPEC already requires for failures.

### State table

| State | Words (exact) | StateMark | One-click fix | LiveRegion announcement |
|-------|---------------|-----------|---------------|-------------------------|
| 1. Healthy | "Connected" and "Browser copy: up to change {n}" | empty on "Connected" | none needed; "Status" is always present | none; a healthy change number is never announced |
| 2. Reconnecting | "Reconnecting..." | empty | "Reconnect now" (text action) | "Reconnecting to the room." once |
| 3. Disconnected | "Disconnected" (plus the existing connection-lost banner) | square (rust) | "Reconnect now" (banner action) | "Disconnected from the room." once |
| 4. Catching up | "Catching up, change {n}" | empty | "Open Status" (the Rebuild the browser copy action lives there) | "Catching up with the room." once |
| 5. Rebuilding | "Rebuilding the browser copy" | empty | "Open Status" | "Rebuilding the browser copy." once, then "Browser copy is current." when it ends |
| 6. Risk | "Your answer is not confirmed yet. Check now" | square (rust) | "Check now" (verifies the answer with the room) | the sentence, once |

Notes on the table:
- "Connected" appears only after an acknowledged MCP round trip, never from a presence file (2026-09-20 localhost review; threat T-369-10-02). Before the first acknowledgement the indicator shows "Reconnecting..." not "Connected".
- StateMark choice is an executor default, not asked of the navigator. It respects UI-SPEC's one cobalt circle (the Work view's current question) and one ochre triangle (the primary action) per view, so neither is used here. Plan 24 may swap the shape, but words and fixes above are the signed content.
- The risk state replaces the connection word and the browser copy line with one sentence while it lasts. It fires when an answer is not confirmed saved, or when the connection drops while a decision is open. For the second trigger, plan 24 uses this proposed wording: "The connection dropped while a decision is open. Reconnect now". This second sentence was drafted by the executor to match the signed pattern and is not a quoted answer; the navigator may reword it at review.
- The decisions-waiting count is not in the indicator. It stays in the Decisions tab as "Decisions (n waiting)".

## 3. INV-SL-1 through INV-SL-5 check

| Rule | Result | How |
|------|--------|-----|
| INV-SL-1 (Purpose) | Pass | The indicator orients (room, connection, copy freshness), warns (state 6 fires before an answer is lost) and its fixes lead to the advancing action. |
| INV-SL-2 (Success metric, quiet when healthy) | Navigator-ruled override | Q2 B keeps "Connected" visible and Q3 B keeps the change number visible when healthy, so the healthy line is not quiet, which the contract calls a manufactured glance. The navigator chose this knowingly; the card named the strain. Mitigation: the healthy line is static (no animation, no colour change, no motion), is not a link, announces nothing, and no glance-count or interaction metric may be recorded for it. Success stays the share of exposures that lead to a real advancing action. |
| INV-SL-3 (Not a destination) | Pass, watched | The indicator holds no content to read or explore; its only controls are the fixes and the Status link. The permanent copy line could invite watching, so it is plain text, never a control. |
| INV-SL-4 (Every non-healthy state has its fix) | Pass | States 2 to 6 each carry an adjacent one-click action (table above). No state shows a problem without its action. |
| INV-SL-5 (Substance, not vanity) | Navigator-ruled override | Q3 B puts a permanent counter ("change {n}") in the line, which the brief marked as breaking INV-SL-5. The navigator chose it knowingly. Mitigation: {n} is a sequence number of a real room fact (the same change sequence that drives "Since you were here"), not a tally of the navigator's activity; it is never celebrated, animated or announced when healthy; it is mono 12 ink and never in the primary position. |

An override is recorded here as a deliberate navigator ruling, not as a pass. If the exposure-to-advancing-action measurement (contract open item 5) later shows the always-visible words never lead to action, the contract treats that as a regression against INV-SL-2 to be reopened with the navigator.

## 4. Constraints carried from the UI-SPEC

No emoji; CSS StateMarks with written words; Label 12 mono for state words; changes announced politely through the one LiveRegion; on phones the indicator lives in the Status panel; until plan 24 lands, the shell ships the interim one-word indicator.

Signed: navigator via AskUserQuestion, 2026-10-03, reply: "Q1 A, Q2 B, Q3 B, Q4 A"

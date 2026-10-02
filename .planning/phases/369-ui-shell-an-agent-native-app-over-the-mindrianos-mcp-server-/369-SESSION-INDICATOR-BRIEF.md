# 369 Session Indicator: Co-Design Brief (D-04)

Plan: 369-10. Requirement: CANON369-03. Canon parts: 6, 12.
Rule: statusline co-design. The navigator decides what the indicator shows. This brief only proposes; nothing here is decided until he answers.

Until the signed note exists the shell ships the UI-SPEC interim indicator: one connection word ("Connected", "Reconnecting...", "Disconnected") plus the Status control. Plan 24 builds the real component from the signed note.

## The four tiers

From `docs/STATUSLINE-CONTRACT.md`, with what the shell could show in each (UI-SPEC "Session Indicator").

| Tier | Statusline role | Shell candidate |
|------|-----------------|-----------------|
| 1. Identity / trust metadata | "Who is speaking, and what backs it." Passive, never a hook. | MindrianOS on this machine; version |
| 2. Orientation / integrity | "Where am I, and is it sound." Triggers only when degraded. | Room name; MCP connection; browser copy state |
| 3. Action | "The next step to a validated decision." | Count of decisions waiting, linking to the next one |
| 4. Risk trigger | "Warn me before I lose my thinking." Quiet when all is well. | An answer not confirmed saved; a lost connection while a decision is open |

Binding rules any answer must satisfy (INV-SL-1..5, contract line 92 onward):
- INV-SL-1: orient, warn of risk, offer the next advancing action.
- INV-SL-2: success is exposures that lead to a real advancing action; green is quiet, no manufactured glance.
- INV-SL-3: the indicator is a launch point, never a destination.
- INV-SL-4: every non-healthy state shows its one-click fix; a problem without its action is a violation.
- INV-SL-5: rewards are substance, never vanity counters.

UI-SPEC limits on every option: no emoji; marks are CSS StateMarks with written words and colour never carries state alone; Label 12 mono for state words and Body 16 for the room name; changes announced politely through the one LiveRegion; on phones the indicator lives in the Status panel.

"Connected" may appear only after an acknowledged live MCP round trip, never from a presence file (2026-09-20 localhost review).

## Questions

### 1. What sits in the header, and what waits in the Status panel

- A. Room name always; one connection word only when something is wrong; identity, version and session id in the Status panel only. (Recommended) Header stays quiet when healthy (INV-SL-2); the waiting-decisions count stays in the Decisions tab so no counter is duplicated (INV-SL-4, INV-SL-5).
- B. Room name plus the connection word always shown, even when healthy. Matches the interim indicator but makes a healthy state a thing to glance at (strains INV-SL-2).
- C. Room name, connection word and version always shown. Gives trust metadata at a glance but turns tier 1 into header clutter (strains INV-SL-2, INV-SL-3).

### 2. Connection state words

- A. "Connected" (only after an acknowledged MCP round trip), "Reconnecting...", "Disconnected"; the healthy state shows no word, only the Status control. (Recommended) Honest words from the review, quiet when healthy (INV-SL-2); "Reconnecting..." and "Disconnected" each carry their fix (INV-SL-4).
- B. The same three words, with "Connected" shown always. Plain and familiar, but a permanent "Connected" is a manufactured glance (strains INV-SL-2).
- C. Use the review's wider words ("ready", "waiting for you", "failed") in the indicator too. More states in one place, but "waiting for you" duplicates the Decisions count (breaks INV-SL-4).

### 3. Browser copy state

- A. Shown only while not current: "Catching up, change {n}" and "Rebuilding the browser copy"; silent when current. (Recommended) Quiet when healthy (INV-SL-2); "Rebuilding" and "Catching up" point to the Status panel where the rebuild action lives (INV-SL-4).
- B. Always show "Browser copy: up to change {n}". Visible proof of freshness, but a permanent counter nobody acts on (breaks INV-SL-5).
- C. Never in the header; Status panel only. Cleanest header, but a stale copy could mislead the navigator without any warning (strains INV-SL-1).

### 4. Risk trigger (tier 4)

- A. When an answer is not confirmed saved, or the connection drops while a decision is open, the indicator becomes one sentence with its one-click fix: "Your answer is not confirmed yet. Check now". Announced once through the LiveRegion. (Recommended) Warns before the navigator loses a decision (INV-SL-1) and never without the fix (INV-SL-4).
- B. Same trigger, but shown as a banner in the view body only, indicator unchanged. Louder and harder to miss, but splits one state across two places (strains INV-SL-3).
- C. No tier-4 trigger in v1; the existing connection-lost banner is enough. Least work, but an unconfirmed answer would go unannounced (breaks INV-SL-1).

## Reply

Reply "approve-recommended" to take option A on all four, or name one option per question (and any wording changes).

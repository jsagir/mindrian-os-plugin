---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
plan: 24
subsystem: ui-shell
tags: [session-indicator, statusline, d-04, canon369-06]
requires: [369-10, 369-23, 369-20, 369-32]
provides:
  - indicatorModel pure function (signed note -> words, mark, fix, announce)
  - StatusProvider and useShellStatus with setAnswerPending (gate view hook for plan 27)
  - SessionIndicator component (header and Status-panel placements), risk banner for phones
affects: [369-27 gate view calls setAnswerPending]
key-files:
  created:
    - ui/shell/client/frame/indicator-model.ts
    - ui/shell/client/frame/status-context.ts
    - tests/test-369-session-indicator.cjs
  modified:
    - ui/shell/client/frame/SessionIndicator.tsx
    - ui/shell/client/frame/StatusPanel.tsx
    - ui/shell/client/frame/ShellFrame.tsx
    - ui/shell/client/frame/Banners.tsx
    - ui/shell/client/frame/shell-context.ts
    - ui/shell/client/frame/frame.css
    - ui/shell/client/copy.ts
    - tests/test-369-canon-skin.cjs
key-decisions:
  - "Built exactly as signed (Q1 A, Q2 B, Q3 B, Q4 A); the Q1/Q2 reconciliation in the note governs: header carries the connection word always, identity/version/session id stay in the Status panel"
  - "Connected needs connection=connected AND an acknowledgement at most 30 s old at the time the status was read (readAt), so a stale ack reads Reconnecting..."
  - "Risk tier: answerPending with a not-live link, or a disconnected link while decisions are waiting (the executor-drafted second sentence from the note)"
  - "Copy-state announcements (catching up, rebuilding) are spoken only after 2.5 s, so a brief catch-up is silent and the indicator never overwrites the replica's tidy-up message in the single live region"
requirements-completed: [CANON369-06]
duration: about 55 min
completed: 2026-10-04
---

# Phase 369 Plan 24: Session indicator Summary

The signed session-indicator design is now the shell's indicator: a pure `indicatorModel(status)` produces every state's exact words, mark, adjacent one-click fix and announcement; one status context feeds it; the plan 20 interim body (`INTERIM(plan 24)`) is gone.

## What was built

- `indicator-model.ts`: pure, erasable TypeScript that Node loads directly. Six states from the note's table (healthy, reconnecting, disconnected, catching up, rebuilding, risk) plus the note's drafted second risk sentence. `announceFor(prev, next)` says each state once on entry, never speaks a healthy change number, and says "Browser copy is current." when a rebuild ends.
- `status-context.ts`: `StatusProvider` (inside the ReplicaProvider) composes the frame's `/api/status` state, the replica's copy state and seq, the waiting count and `answerPending`. The gate view (plan 27) calls `setAnswerPending(true, check)`; "Check now" runs that check, so the risk tier works with no test hook.
- `SessionIndicator.tsx`: StateMark plus words in Label 12 mono, the healthy copy line, the fix as a TextAction, header instance announces through the one LiveRegion; `placement="panel"` instance draws only.
- `StatusPanel.tsx`: phone placement (the indicator sits at the top of the panel, hidden on desktop; the header copy is hidden below 768 px). `Banners.tsx`: the risk sentence also shows as the one-line banner on phones.
- `ShellFrame.tsx`: status polled every 2 s while visible (room list and gates stay on 5 s), an immediate read on returning to the tab, the frame's own connection announcements removed so each change is spoken once, by the indicator.

## Tasks and commits

| Task | Commit | Content |
|------|--------|---------|
| 1 | 05e5b68fb | model, status context, component, panel/banner/frame wiring, canon-skin assertions moved to the signed design |
| 2 | d99269690 | tests/test-369-session-indicator.cjs (11 arms) |

## Verification

- `node tests/test-369-session-indicator.cjs`: 11/11 (7 model/static arms read the note's state table and compare every quoted word, fix and announcement; 4 render arms in a real browser on a hermetic daemon: healthy words plus change number, kill daemon shows Reconnecting... then Disconnected each with Reconnect now, restart returns to Connected, live region said each change once, 390 px puts the indicator inside the Status panel).
- Existing suites green: test-369-canon-skin 30/30, shell-server 35, shell-actions 17, human-only 10, walled-manifest 8, ts-erasable-gate 8, indicator-note 7; `tsc --noEmit` and `npm run build` in ui/shell clean; tests/e2e-369/replica.cjs 12/12 arms.
- No emoji, no em-dash or en-dash in the touched frame files (asserted by the test).

## Deviations from Plan

**1. [Rule 3 - Blocking] Existing canon-skin test pinned the interim indicator**
- Found during: Task 1. The static scenario required the `INTERIM(plan 24)` marker and `.session-indicator` textContent 'Connected' / 'Disconnected'.
- Fix: asserted the signed design instead (no marker, model wired through StateMark; `.si-words` words). In the mocked-feed scenario the copy never loads, so the header shows the signed "Catching up" words and the match accepts Connected or Catching up; the lost-connection scenario (two decisions waiting in that fixture) now expects the signed risk sentence "The connection dropped while a decision is open." with its Reconnect now fix.
- Files: tests/test-369-canon-skin.cjs. Commit 05e5b68fb.

**2. [Rule 1 - Bug] Indicator announcements overwrote the replica's tidy-up message**
- Found during: running tests/e2e-369/replica.cjs (arm 9 failed once the indicator announced "Catching up/Rebuilding" into the single live region; newest waiting message wins, so "The room was tidied since your last visit..." was lost).
- Fix: catching-up and rebuilding are announced only if they last 2.5 s (COPY_ANNOUNCE_DELAY_MS); reconnect, disconnect and risk stay immediate. replica.cjs now passes 12/12.
- Files: SessionIndicator.tsx. Commit 05e5b68fb.

**3. [Rule 2 - small additions the plan implied]** `readAt` on ShellStatus (freshness judged when the status was read, so a backgrounded tab does not flash Reconnecting...), a visibilitychange status read, and a copy.ts comment refresh (no longer "interim").

## Notes for the navigator and later plans

- State 3 (Disconnected) shows "Reconnect now" next to the word in the header AND in the existing connection-lost banner (the note lists it as the banner action; INV-SL-4 asks for an adjacent fix). Easy to drop one at review.
- The "Catching up, change {n}" words drop the clause to "Catching up" while the copy has no change number yet (note gives no wording for that case).
- The second risk sentence was drafted by the executor in the note; it is flagged there as rewordable at review.
- Plan 27's gate view should call `useShellStatus().setAnswerPending(true, check)` while an answer is unconfirmed and `setAnswerPending(false)` when saved.
- INV-SL-2 and INV-SL-5 are navigator-ruled overrides (always-visible "Connected" and change number); mitigations from the note are kept: static text, not a control, no announcement while healthy.

## Known Stubs

None.

## Threat Flags

None. T-369-24-01 (Connected needs a recent acknowledged round trip), T-369-24-02 (test reads the Signed line) and T-369-24-03 (pending answer plus lost link is the risk tier) are covered by arms 1, 4 and 5.

## Self-Check: PASSED

Files exist (indicator-model.ts, status-context.ts, SessionIndicator.tsx, test-369-session-indicator.cjs); commits 05e5b68fb and d99269690 are in git log; no STATE.md or ROADMAP.md writes; nothing added to the root package.json; no lockfile touched.

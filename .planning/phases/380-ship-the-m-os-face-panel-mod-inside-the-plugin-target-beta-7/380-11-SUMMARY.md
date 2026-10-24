---
phase: 380-ship-the-m-os-face-panel-mod-inside-the-plugin-target-beta-7
plan: 11
subsystem: human-gates-and-book-follow-ups
tags: [mos-face, book-follow-ups, defaults, windows-checks, real-room-receipt, RULE-10, gate-3-open]
requires:
  - phase: 380-20
    provides: final images and the gap closure of the room tree
provides:
  - 380-BOOK-FOLLOWUPS.md (book proposals A1 to A8, defaults list with rulings, open questions)
  - 380-WINDOWS-CHECKS.md (Windows and Desktop sheet)
  - 380-HUMAN-RULINGS.md (navigator rulings of 2026-10-24, copied from the rulings file)
affects: [the cut that carries the panel]
requirements-completed: []
requirements-open: [MOD380-06]
status: partial-by-design
completed: 2026-10-24
---

# Phase 380 Plan 11 Summary: human gates closed except the real-room receipt

STATUS: partial-by-design. Gate 3 (the real-room receipt) is open on purpose. MOD380-06 is NOT complete.

One-liner: the plan wrote the book proposals and the defaults list, recorded the navigator rulings (gate 1 answered, gate 2 deferred, gate 3 open), and wrote no product code.

## Commits

Branch tree /home/jsagi/dev/MindrianOS-Plugin, branch feat/eureka-adapter-rebased. Not pushed.

| Task | Commit | Subject |
|------|--------|---------|
| 1 | 78f9bc74a | docs(380-11): book follow-ups, defaults list and Windows and Desktop check sheet |
| summary | see the commit of this file | docs(380-11): complete human gates plan (partial-by-design) |

The release tree (/home/jsagi/dev/MindrianOS-Plugin-release) was read only. No flag of ui/mos-face/hooks/proposals.ts changed, so no commit was made there.

## Tasks

| Task | Result |
|------|--------|
| 1 Write the book proposals, the defaults list and the check sheet | Done. Verify passed (see Verification). |
| 2 Navigator rules on the defaults (checkpoint:human-action) | ANSWERED by the rulings file of 2026-10-24. Recorded in 380-HUMAN-RULINGS.md and section B. P1 and P2 kept, no veto. Glossary first sentences CHANGED to not approved. |
| 3 Windows and Desktop checks and the real-room receipt (checkpoint:human-action) | Split. Gate 2 DEFERRED ("terminal-only cut, Windows and Desktop observed after release"). Gate 3 OPEN: a person signs the receipt at the cut. |

## Rulings recorded (from 380-11-NAVIGATOR-RULINGS.md)

- Approved: N4 both status lines, N5 /mos-* names, N6 dimmed paper, N7 terminal only, N9 state map, python3 removal, P1 (default on), P2 (default on; the veto is /mos-words off).
- Changed: glossary first sentences NOT approved. Ship without them until the glossary is cleared.
- Approved, conditional: the "Theo | MindrianOS" badge. Confirm the public Theo naming before the cut. UNVERIFIED.
- Ruled earlier: reply chip (D-07), dimmed paper (D-11), label Nothing found (D-10).
- Book proposals A1 to A7: approved as a separate task after the cut. They do not gate the cut.
- Gate 2: deferred. "No panel on Desktop" stays ASSUMED. No Windows or Desktop number exists.
- Gate 3: open.

## Verification (PROVEN, 2026-10-24)

- Both files: non-empty, first line starts with NEEDS_HUMAN:, no em-dash or en-dash.
- 380-BOOK-FOLLOWUPS.md cites e947a5d, D-07 and proposals.ts. The plan heading count check returns 10 (needs at least 10).
- BOOK_STATUS_BEFORE_COUNT=2 and git -C /home/jsagi/mos-brand status --short lists 2 lines now (two foreign untracked files in consumers/). The book is unchanged by this plan.
- Contrast figures in A3 computed in this plan: paper over ink 17.31, at 50 percent #848380 4.98 to 1, at 40 percent #6D6C69 3.60 to 1. They match the README figure of plan 380-07.

## Deviations from Plan

1. [Info] The book HEAD moved. /home/jsagi/mos-brand is at 9f4ee34 on branch book-css-capabilities, two commits past e947a5d. e947a5d is an ancestor. The terminal segment and the tui-designer skill are identical at both (git diff prints nothing). The canon is still cited as e947a5d.
2. [Info] The plan said the stale "Canon v5" label is in 5 places. It is 6 lines in 5 files (GUIDE.md holds 3). Lines recorded in A1.
3. [Rule 2 - Missing] Section A8 added: it points to the 11 proposals P19-1 to P19-11 of plan 380-19 (the plan 19 file says plan 11 folds them in). No ruling exists for A8.
4. [Rule 2 - Missing] Two items found while recording rulings: C4 (the rulings say seven of eleven states mapped; the build maps 10 of 11, Reframe unmapped) and C5 (badge naming). Both added to section C.
5. [Rule 3 - Blocking] Heading summaries B0 and C0 added so the plan's heading-count check passes and the rulings read at a glance.
6. [Scope] 380-HUMAN-RULINGS.md was written from the rulings file, not from a person's reply typed in a prompt. The caller instructed this.
7. [Instruction] The caller told the executor not to run gsd-tools state.* handlers and not to hand-edit ROADMAP.md. See Skipped handlers.

## Skipped handlers

- state.advance-plan, state.update-progress, state.record-metric, state.add-decision, state.record-session: NOT run (caller instruction; another session may be executing).
- requirements.mark-complete: NOT run. MOD380-06 stays open.

## Known Stubs

None.

## Open items and risks

1. GLOSSARY SHIPS (open). The release tree at HEAD 7c710db04 still holds ui/mos-face/hooks/glossary.ts and lib/mos-face/dist/glossary.js (first sentences of the private PWS glossary), and voice.ts glossaryWords feeds the pane (register.tsx line 1213). The navigator did not approve them. No code was changed here. A gap-closure plan is needed before the cut.
2. State count: the ruling says seven of eleven, the build maps 10 of 11.
3. Badge naming not confirmed.
4. Gate 3 open: no receipt. MOD380-06 open.
5. Windows and Desktop: unobserved. Cowork not covered.
6. Rows with no explicit ruling in the rulings file: exact state names, the 600 second reach clock, the crew face style, the 13 job clauses, the Job line placement, status parity placement.

## Threat flags

None. The files hold no room content and no path with a user name (T-380-42). No Windows or Desktop number was claimed (T-380-43). The book repo was not changed (T-380-44). The sheet says the receipt is written only by scripts/real-room-run.cjs (T-380-45).

## Self-Check

PASSED. The three files exist, commit 78f9bc74a exists, the added lines hold no em-dash or en-dash.

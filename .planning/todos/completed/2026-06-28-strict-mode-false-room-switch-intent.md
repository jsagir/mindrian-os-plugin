---
created: 2026-06-28T11:30:00.000Z
title: strict-mode false room-switch intent on numeric replies and product-name pastes
area: navigation
version_found: v1.15.0-beta.9
files:
  - hooks (UserPromptSubmit intent-mismatch / strict-mode override)
  - lib/core/resolve-active-room.cjs
  - scripts/write-scope-check.cjs
---

## Problem

Found while live-testing /mos:ignite in v1.15.0-beta.9. The strict-mode / intent-mismatch
UserPromptSubmit hook fires FALSE room-switch warnings in two repeatable cases:

1. **Bare numeric menu replies.** When Larry offers a numbered menu (1, 2, 3...) and the
   navigator answers "1", strict-mode matches "1" against a room polygon (numeric position
   match) and warns to switch rooms. The "1" was a menu selection, not a room reference.
   The menu-selection context and room-polygon matching both consume integers, with no
   disambiguation between them.

2. **Product-name paste blocks.** A "paste this whole block into Larry" message that
   mentions "MindrianOS" several times scored 6 -> room "mindrianOS" vs 1 -> active room,
   triggering a switch-confirm. The tokens matched only because the paste block is a
   product-branded instruction wrapper, not because the navigator wanted that room. Same
   pattern recurred with the common word "room" (score 5) and "iris2026".

Net effect: the navigator is asked to confirm a room switch on almost every turn, which
trains them to ignore the warning (alarm fatigue) - exactly when a REAL switch intent
(iris2026) finally appeared, it looked identical to the false ones.

## Solution

TBD. Candidate directions:
- Suppress room-polygon matching when the input is a bare integer that matches an
  outstanding AskUserQuestion / menu option index (menu context wins over polygon).
- Discount product/brand tokens (MindrianOS, Larry, room) and known instruction-wrapper
  boilerplate from the room-intent score, or require a minimum margin AND a non-boilerplate
  match before warning.
- Distinguish "navigator named a room" from "navigator's content happens to contain room
  tokens" (e.g. only score tokens in imperative position: "switch to X", "in the X room").
- Rate-limit identical false warnings within a session.

---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
plan: 10
subsystem: ui-shell
tags: [co-design, statusline, session-indicator, d-04, checkpoint]
requires: []
provides:
  - signed session indicator design note (input to plan 24)
  - CANON369-03 note format test
affects: [369-24]
tech-stack:
  added: []
  patterns: [statusline co-design rule, node:test format pin]
key-files:
  created:
    - .planning/phases/369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-/369-SESSION-INDICATOR-BRIEF.md
    - .planning/phases/369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-/369-SESSION-INDICATOR-DESIGN.md
    - tests/test-369-indicator-note.cjs
  modified: []
key-decisions:
  - "Q1 A: header shows the room name; version, identity and MCP session id live in the Status panel only"
  - "Q2 B (navigator override): connection word always shown; 'Connected' only after an acknowledged MCP round trip"
  - "Q3 B (navigator override): 'Browser copy: up to change {n}' always shown; words change while catching up or rebuilding"
  - "Q4 A: risk trigger becomes one sentence with its one-click fix, announced once through the LiveRegion"
requirements-completed: [CANON369-03]
duration: co-design gate (one checkpoint)
completed: 2026-10-03
---

# Phase 369 Plan 10: Session Indicator Co-Design Summary

The D-04 gate ran in one AskUserQuestion session and the navigator's answers are filed as a signed design note that plan 24 builds the indicator from.

## What was done

1. Brief (e9d447d0a): four tiers restated plus four questions with options and one recommendation each.
2. Navigator checkpoint: reply "Q1 A, Q2 B, Q3 B, Q4 A" on 2026-10-03.
3. Signed note and format test: the note records the answers verbatim, the Q1/Q2 reconciliation, a six-state spec table (words, StateMark, one-click fix, LiveRegion line), the phone behaviour, and an INV-SL-1..5 check. `node tests/test-369-indicator-note.cjs` passes 7 of 7.

## Decisions Made

- Q2 B and Q3 B were chosen against the recommendation. The note records INV-SL-2 (healthy line not quiet) and INV-SL-5 (permanent change counter) as navigator-ruled overrides, not passes, with mitigations (static, non-interactive, never announced when healthy, no glance metrics, {n} is a real room sequence number).
- Q1 and Q2 reconciled: the header carries room name plus connection word always; everything else in Q1 A stands.

## Deviations from Plan

None to the plan's tasks. Two executor-drafted items are flagged in the note for navigator review at plan 24 time: (1) StateMark shapes (empty and square, avoiding the one-circle and one-triangle per-view rule), (2) the second risk sentence "The connection dropped while a decision is open. Reconnect now".

## Known Stubs

None.

## Threat Flags

None. T-369-10-01 mitigated (blocking checkpoint, verbatim reply, Signed line pinned by test). T-369-10-02 mitigated ("Connected" bound to an acknowledged MCP round trip in the note).

## Commits

- e9d447d0a docs(369-10): add session indicator co-design brief
- 691ec6800 docs(369-10): signed session indicator design note and format test

## Self-Check: PASSED

# Phase 136 - Discussion Log

**Date:** 2026-05-31
**Mode:** discuss (default, interactive) - SPEC loaded (12 requirements locked)
**Human reference only.** Downstream agents read 136-CONTEXT.md + 136-SPEC.md, not this log.

## Areas selected for discussion

All four offered gray areas: TUI library choice, Concurrency model, Bud + zoom + sync scope, The 3 M5 knobs.

## Round 1 - primary decisions

| Area | Options presented | Selected |
|---|---|---|
| TUI lib | ink (rec) / blessed-neo-blessed / raw-ANSI | **ink** (token-core/component alignment, pure-JS) |
| Concurrency | WAL + read-only handle (rec) / snapshot-per-render / poll-on-event | **WAL + read-only handle** |
| Bud scope | delegate to SEED-001 (rec) / implement in render spine | **delegate to SEED-001** (Part 7 reuse) |
| Wikilinks | Larry-proposes-you-approve (rec) / founder-only | **Larry proposes, founder approves** (Part 9 HITL) |

## Round 2 - secondary knobs

| Area | Options presented | Selected |
|---|---|---|
| Zoom | persisted focus event (rec) / view-local | **persisted `focus_changed` event** (reuse 129.5) |
| Sync | two-way via focus event (rec) / one-way | **two-way via focus event** |
| Intent | filter then temporal ranks (rec) / re-rank whole graph | **filter, then temporal ranks** (M5 literal) |
| Highlight | in-place + slot whisper (rec) / separate slot only | **in-place highlight + slot whisper** (M5 hard rule 1) |

## Notes

- Every selection took the recommended path; the decision set is reuse-heavy (extends render-v2, palette.json, navigation.cjs, focus.cjs, SEED-001, express/chokidar, AskUserQuestion).
- All 8 decisions captured as D-01..D-08 in 136-CONTEXT.md.

## Deferred ideas

None - the discussion stayed in scope and closed every SPEC open-item. GTM sequencing risk remains recorded in 136-SPEC.md.

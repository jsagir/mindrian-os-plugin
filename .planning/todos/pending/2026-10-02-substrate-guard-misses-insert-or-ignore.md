---
created: 2026-10-02
title: "Substrate guard RE_RAW_WRITE misses INSERT OR IGNORE / OR REPLACE writes to nodes and edges"
area: part-9-guard
source: "Phase 369 plan 04 (writer inventory) and plan 12 (filed 2026-10-03)"
files:
  - scripts/check-substrate.cjs
  - tests/fixtures/369/writer-inventory.json
  - lib/core/navigation/spine-events.cjs
  - lib/core/navigation/room-birth.cjs
  - lib/core/navigation/ingestion.cjs
owner: "a /gsd-quick task (a Part 9 CI guard change, kept out of Phase 369)"
status: pending
---

## The gap

`scripts/check-substrate.cjs` line 218:

```
const RE_RAW_WRITE = /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(nodes|edges|memory_event)\b/i;
```

matches `INSERT INTO nodes` but not `INSERT OR IGNORE INTO nodes` or `INSERT OR REPLACE INTO nodes`
(SQLite puts the conflict clause between INSERT and INTO). A raw write in that form is invisible to
the Part 9 CI guard, so the baseline counts never see it.

## What it hides today

Three writers in the Phase 369 writer inventory (`tests/fixtures/369/writer-inventory.json`) use the
unnamed form and are not counted by the guard:

| Row | File | Function | Table |
|---|---|---|---|
| N4 | `lib/core/navigation/spine-events.cjs` | `_emitWithOperatorEdge` | nodes |
| N5 | `lib/core/navigation/room-birth.cjs` | `drainBirthGateAnswers` | nodes |
| E2 | `lib/core/navigation/ingestion.cjs` | `storeBrainSuggestions` | edges |

## Why Phase 369 does not wait on it

The change log captures these writes at the table with triggers, so they are logged regardless of
what the guard sees. The Phase 369 coverage test (`tests/test-369-writer-inventory.cjs`, plan 04 and
later) scans with the wider pattern (`INSERT [OR ...] INTO`), so the inventory itself is complete.
Only the Part 9 guard has the blind spot.

## The fix

1. Widen `RE_RAW_WRITE` to allow an optional conflict clause:
   `/\b(?:INSERT\s+(?:OR\s+(?:IGNORE|REPLACE|ABORT|FAIL|ROLLBACK)\s+)?INTO|REPLACE\s+INTO|UPDATE|DELETE\s+FROM)\s+(nodes|edges|memory_event)\b/i`
2. Re-baseline the substrate counts (`node scripts/check-substrate.cjs --baseline`) and review the
   three new hits, deciding for each whether it should route through the navigation chokepoint
   (`writeEdge`, `insertNode`) or stay as a named, reasoned exception.
3. Add a guard-side test that a synthetic `INSERT OR IGNORE INTO nodes` line is flagged.

This is a Part 9 guard change and gets its own quick task; it must not ride a Phase 369 plan.

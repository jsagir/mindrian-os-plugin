# openRoomDb call-site census (Phase 236-03, GRAPHDB-02)

**Written by:** 236-03 Task 3, discharging the flagged follow-up in 236-03-PLAN.md's
"Scope decision" section.
**Purpose:** this phase deliberately changed the CHOKEPOINT plus exactly one call site. That
decision is only defensible if the sites it did NOT touch are enumerated rather than forgotten.
This document is the enumeration. It is a document, not a code change: no site listed here other
than `graph-derivation.cjs` was modified by this phase.

## Method

```
grep -rn "openRoomDb(" lib/ --include=*.cjs
```

Colocated `*.test.cjs` files, the definition in `lib/core/room-db.cjs` itself, comment lines, and
`openRoomDbReadOnly*` (a different door, see the Known Gap below) are excluded. Whether each call
sits inside a `try` block was determined by a brace-depth scan rather than by looking a few lines
back, because a naive lookback misclassifies sites whose enclosing `try` opens well above the call
(`room-discard-cascade.cjs:95` is one such case, seven lines below its `try`). Each catch body was
then read to record what it actually does with the error.

## Summary counts

| Disposition | Count | Meaning |
|---|---|---|
| **FIXED** | 1 | Was demonstrably swallowing a typed failure to `null`; changed by this phase. |
| **IMPROVED-FOR-FREE** | 4 | Does NOT catch around the open, so it now propagates `RoomDbBusyError` / `RoomDbBrokenError` with no edit at all. |
| **CANDIDATE** | 35 | Catches, and would now catch a typed class. Behavior is unchanged from before this phase; these are the documented residual (threat T-236-11, disposition `accept`). |
| **TOTAL non-test call sites** | **40** | |

236-RESEARCH.md estimated "25+" sites. The measured number is 40. The estimate was low, which
strengthens rather than weakens the scope decision: distributing classification across 40 sites is
exactly the drift the chokepoint design avoids.

## FIXED (1)

| Site | Before | After |
|---|---|---|
| `lib/core/graph-derivation.cjs:264` | `try { db = openRoomDb(roomDir); } catch (_e) { db = null; }` | Re-throws `RoomDbBusyError` / `RoomDbBrokenError`; keeps `db = null` for every other error. |

This is the one demonstrated collapse named in the RCA and in ROADMAP success criterion 3. It is
covered by a live regression assertion (`tests/test-236-open-busy-detected.cjs` scenario 5), which
was verified to fail when the bare catch is reinstated.

## IMPROVED-FOR-FREE (4)

These open OUTSIDE any `try`, so a typed error propagates to their caller unchanged. No edit was
needed and none was made.

| Site | Note |
|---|---|
| `lib/core/unknowns/verdict.cjs:100` | `if (!db) { db = openRoomDb(roomDir); ownedDb = true; }`, no enclosing try. |
| `lib/core/eureka/explore-chain.cjs:137` | `readOpportunity`: opens, THEN enters try. The catch guards the query, not the open. |
| `lib/core/eureka/explore-chain.cjs:155` | `resolveEvidenceIds`: same shape as :137. |
| `lib/core/url-ingest.cjs:220` | Opens, then `try { return scan(db); } finally { closeRoomDb(db); }`. A `finally` with no `catch` does not swallow. |

## CANDIDATE (35)

Each catches and would now catch a typed class. **Behavior is unchanged from before this phase**:
these sites swallowed a bare error before and swallow a typed one now, so nothing regressed. They
are listed so the residual risk is documented rather than unknown.

Ordered worst-first by how misleading the degraded result is.

### Tier A: reports a busy or broken room as "no room db" (the exact confusion GRAPHDB-02 names)

| Site | Catch behavior |
|---|---|
| `lib/core/graph-refine-loop.cjs:110` | `catch (_e) { db = null; }` -- byte-identical to the defect just fixed in `graph-derivation.cjs`. **The strongest candidate for the next phase.** |
| `lib/core/breakthrough/scanner.cjs:122` | `return { ..., reason: 'no_room_db' }` |
| `lib/core/navigation/spine-events.cjs:139` | `return { ok: false, reason: 'no_room_db' }` |
| `lib/core/navigation/spine-events.cjs:220` | `return { ok: false, reason: 'no_room_db' }` |
| `lib/core/navigation/lens-nodes.cjs:251` | `return { ok: false, reason: 'no_room_db' }` |
| `lib/core/navigation/room-birth.cjs:1093` | `reconDb = null` |

### Tier B: silently degrades to an empty or default result

| Site | Catch behavior |
|---|---|
| `lib/core/navigation/dashboard-helpers.cjs:91` | `return { nodes: [], edges: [] }` (an unavailable room renders as an empty graph) |
| `lib/core/navigation/lens-nodes.cjs:271` | `return defaultHatState()` |
| `lib/core/navigation/lens-nodes.cjs:292` | returns all-default hat states |
| `lib/core/graph-backfill.cjs:181` | `total = 0` |
| `lib/core/navigation/spine-events.cjs:366` | `return null` |
| `lib/core/navigation/room-birth.cjs:504` | `return false` |
| `lib/core/navigation/room-birth.cjs:603` | `return false` |
| `lib/core/navigation/spine-events.cjs:287` | falls through to a cache fallback |
| `lib/core/navigation/spine-events.cjs:319` | falls through to a cache fallback |

### Tier C: swallows deliberately as a best-effort side effect

These are the `auditBypassIfNeeded` pattern applied to genuinely optional work. Several are
arguably CORRECT as written: a failed `memory_event` emission should not fail its caller. Listed
for completeness, not as an accusation.

| Site | Catch behavior |
|---|---|
| `lib/core/room-discard-cascade.cjs:95` | rollback, then swallow |
| `lib/core/room-discard-cascade.cjs:216` | `/* if even the partial-failure emission fails, swallow */` |
| `lib/core/room-naming-selector.cjs:302` | `/* memory_event emission is best-effort */` |
| `lib/core/room-naming-selector.cjs:325` | `/* best-effort */` |
| `lib/core/room-auto-create.cjs:268` | memory_event emission is not a rollback trigger (Canon Part 9) |
| `lib/core/graph-self-heal.cjs:241` | `lineageEdge = { ok: false, reason: 'child_edge_write_failed' }` |
| `lib/core/graph-self-heal.cjs:253` | `// Tolerate: the rollup degrades to whatever it can read.` |
| `lib/core/graph-self-heal.cjs:270` | `// Tolerate: a timeline refresh failure does not fail the heal.` |
| `lib/core/graph-backfill.cjs:248` | `/* advisory: never block the backfill */` |
| `lib/core/lazygraph-ops.cjs:769` | a sub-room fault must not abort the parent rebuild |
| `lib/core/room-auto-create.cjs:212` | best-effort rm of the partially-created room dir |
| `lib/core/eureka/research-filing.cjs:331` | outer function catch |
| `lib/core/eureka/research-filing.cjs:418` | outer function catch |

### Tier D: converts to a structured, detail-preserving result

Least harmful: the failure is reported with a reason and a truncated detail string, so an operator
can at least see something went wrong. Still loses the busy-versus-broken distinction.

| Site | Catch behavior |
|---|---|
| `lib/core/migrations/phase-162-section-nodes.cjs:114` | `{ ok: false, reason: 'open_room_db_failed', detail }` |
| `lib/core/navigation/room-birth.cjs:836` | `{ ok: false, reason: 'open_room_db_failed', detail }` |
| `lib/core/eureka/opportunity-harvest.cjs:615` | `{ ok: false, reason: 'room_db_open_failed', detail }` |
| `lib/core/eureka/research-filing.cjs:266` | `{ ok: false, reason: 'file_research_threw', detail }` |
| `lib/core/eureka/explore-chain.cjs:441` | `{ ok: false, reason: 'explore_threw', detail }` |
| `lib/core/url-ingest.cjs:521` | `makeEnvelope('error', 'insufficient_evidence', ...)` |

### Special case: re-throws rather than swallows

| Site | Catch behavior |
|---|---|
| `lib/core/rs-sqlite-mirror.cjs:385` | `throw new SQLiteUnreachableError(...)` |

Listed as CANDIDATE despite NOT swallowing, because it FLATTENS both new classes into one existing
class, so its callers still cannot tell a retryable busy room from an unusable broken one. It is
the least urgent candidate and the most instructive one: it is the pattern the two new classes were
modeled on. A future phase should decide whether `SQLiteUnreachableError` should carry the
classification forward on its `meta` rather than being re-derived.

## Known gap, dated and NOT fixed here

**The READ-ONLY door is out of scope for this phase.** 236-RESEARCH.md Pitfall 6 records that
`openRoomDbReadOnlyForCaller` returns a LIVE handle for a corrupted database, because it only
constructs and never queries; the first real query then throws and
`room-graph-density-module.cjs`'s `countTable` catch-all reads that as **0 rows**. A corrupt room
silently reports an empty graph rather than a broken one.

GRAPHDB-02 as scoped here fixes the READ-WRITE door only. Stated explicitly, as the research
document requires, rather than left as a silent omission. The fix shape is known: the typed
read-only door must probe with a real statement (for example `SELECT count(*) FROM sqlite_schema`)
before declaring itself healthy, since a construction that did not throw is not evidence of a
healthy database.

## Recommendation for the follow-up phase

Do NOT sweep all 35 candidates. Tier A is 6 sites and carries nearly all the real risk, and
`graph-refine-loop.cjs:110` in particular is the same `db = null` defect this phase just fixed
next door. Tier C is largely correct as written and should be left alone. The read-only door gap
above is probably higher value than any individual Tier B or D site.

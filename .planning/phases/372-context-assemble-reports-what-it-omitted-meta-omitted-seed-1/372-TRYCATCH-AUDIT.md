# Phase 372 Plan 01: Try/catch audit of lib/core/navigation/room-context.cjs

Audited: 2026-10-19, on the unmodified source (blob 438e7feb, HEAD at capture time).
Decision source: 372-CONTEXT.md D2, D5, D6. This file is the contract for Task 3 of plan 372-01 and for plan 372-02.

## Census

Command: `grep -n "catch" lib/core/navigation/room-context.cjs | grep -v '^[0-9]*:[[:space:]]*//'`
Result: 10 sites. PROVEN (the command printed lines 62, 74, 155, 168, 234, 250, 275, 382, 393, 410). The planning-time count was 10, so no row was added.
After Task 3 the count must still be 10. Task 3 adds no try/catch and removes none.

## Catch sites

Columns: row, line (source before Task 3), function, what the catch swallows, value returned today, disposition, leg, reason.

| 1 | 62 | legA | any throw out of getRoomHomeView | null | REPORT | legA | leg_failed |
| 2 | 74 | legB | a throw or a rejection from getSessionHistory (for example a missing sessions table) | [] (sessions = []) | REPORT | legB | leg_failed |
| 3 | 155 | filterRankedExclusions | a throw in the focus-type lookup; focusType becomes null, so the default exclusion applies and a chain_state focus loses its carve-out | rows are still returned (filtered) | REPORT | legC | leg_failed |
| 4 | 168 | legC (outer) | any throw out of getNeighborhood or the filter | [] | REPORT | legC | leg_failed |
| 5 | 234 | legD (inner, per row) | a JSON.parse failure of the node properties string | the row is kept, the raw string is used | SILENT | legD | none |
| 6 | 250 | legD (outer) | any throw in the cortex SELECT, the mapping or the ranking | [] | REPORT | legD | leg_failed |
| 7 | 275 | resolveReferenceMs | a clock failure | falls back to Date.now() | SILENT | legD | none |
| 8 | 382 | getRoomContext, Leg E (inner) | a throw in the focus node properties lookup or parse | falls back to the room-root focus block | REPORT | legE | leg_failed |
| 9 | 393 | getRoomContext, Leg E (outer) | any throw in the room-map read or render | legEText = empty string (legCostChars.legE reads 0) | REPORT | legE | leg_failed |
| 10 | 410 | legBytes (cost helper) | a JSON.stringify failure in the measurement | 0 | SILENT | none | none |

## Reasons for each disposition

- Row 1, 2, 4, 6, 9: the leg returns an empty value after a fault. A caller cannot tell that from an empty room. This is the defect named in the SPEC. Report leg_failed with count null.
- Row 3: the fault does not empty the leg, but it changes what the filter does (the carve-out is lost). The entry says a failure happened in legC. The rows stay the filtered rows. The return value does not change.
- Row 8: the fault changes which focus block Leg E renders. Report leg_failed for legE. Rows 8 and 9 share one entry because the collector keeps one entry for each (leg, reason).
- Row 5: a row-level parse fallback. No row is dropped and no content is hidden. No entry.
- Row 7: no row is dropped. Only the recency order uses the fallback clock. No entry.
- Row 10: a measurement helper, not a leg. Recorded as a known limit. No entry.

## Not a swallow

- resolveSeedNode has no try/catch. A throw there leaves getRoomContext. This is unchanged.
- The legD guard for a missing or invalid db returns [] without an exception. This is unchanged and has no entry.
- legC returns [] when there is no focus node. This is not a failure and not an omission. No entry.

## Outside this file

These are recorded and NOT changed in this plan. They are known limits for the SUMMARY.

- lib/core/navigation/room-home.cjs helpers (getCurrentThesis, safeShape and the property parse fallbacks) swallow their own errors. So legA reports leg_failed only when getRoomHomeView itself throws.
- lib/mcp/tools/context.cjs readinessFacts and the brief head swallow errors at the tool layer. They are not one of the four legs.

## Entry vocabulary (final)

Each entry has exactly the keys leg, reason, count, detail, in this order. leg is one of legA, legB, legC, legD, legE.

| reason | leg | count | detail |
|--------|-----|-------|--------|
| leg_failed | any | null | the error class name from err.name. Accept it only if it matches `^[A-Za-z][A-Za-z0-9_]{0,40}$`, otherwise the text `Error`. Never the message, the stack or an error code. |
| type_excluded | legC | rows before the filter minus rows after the filter | the members of RANKED_EXCLUDED_NODE_TYPES that matched a dropped row, joined by a comma (today `chain_state`). The text comes from the frozen set, never from a row. |
| top_k_cap | legC | null | `top_k`. Branch A only. |
| window_cap | legB (stored-session lane and seedFragments lane) | fragments dropped by the window | `fragment_window` |
| char_cap | legB (both lanes) | the number of delivered fragments whose content was cut | `fragment_char_cap` |
| estimate_only | legA, legB, legC, legD | null | `body` |
| max_depth | none | none | No entry, ever (D4). |

Rules:

- One entry for each (leg, reason). The first entry wins.
- Entries keep execution order (legA to legE), then the estimate_only entries.
- A count of 0 is never recorded. A count that is not a positive integer becomes null.
- A reason outside the closed set is ignored by the collector.

## Decisions recorded

- (a) In estimate mode the legs still run in full. So the leg_failed, type_excluded, top_k_cap, window_cap and char_cap entries are still emitted. The four estimate_only entries are added after them.
- (b) Edge accepted in branch A: the probe row can be of an excluded type, so top_k_cap can be a false alarm in that case. A false alarm is the safe direction. Do not resolve it with a second query.
- (c) A room without a sessions table (a bare fixture) reports legB leg_failed. This is honest and accepted.

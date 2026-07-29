---
phase: 236-room-db-data-loss-fixes
plan: 03
subsystem: room-db
tags: [graphdb-02, room-db, error-classification, canon-part-8, canon-part-9]
requires:
  - lib/core/room-db.cjs openRoomDb
  - node:sqlite DatabaseSync (Node >= 22.16.0)
provides:
  - RoomDbBusyError
  - RoomDbBrokenError
  - classified openRoomDb (typed busy / broken open failures)
  - 236-openroomdb-callsite-census.md
affects:
  - lib/core/graph-derivation.cjs (one call site narrowed)
  - every openRoomDb caller (now receives a named, meta-bearing error)
tech-stack:
  added: []
  patterns:
    - SQLiteUnreachableError class convention (rs-sqlite-mirror.cjs) reused verbatim
    - observe-then-classify (probe before classifier, no assumed error shapes)
    - Canon Part 8 meta reduction (scalars plus cause name/message only)
key-files:
  created:
    - tests/helpers/room-db-lock-holder-236.cjs
    - tests/test-236-open-busy-detected.cjs
    - tests/test-236-open-broken-detected.cjs
    - .planning/phases/236-room-db-data-loss-fixes/236-openroomdb-callsite-census.md
  modified:
    - lib/core/room-db.cjs
    - lib/core/graph-derivation.cjs
decisions:
  - "errcode is the only stable discriminator: name, constructor.name and code cannot tell busy from broken on this runtime"
  - "The classifier wraps construction-plus-PRAGMA AND the migration chain separately, because wrapping only the construction would catch nothing"
  - "Genuinely absent is not a third error class: an absent room.db opens successfully, so absence is distinguishable by not throwing"
  - "meta carries the SQLite errcode as a classification scalar so the probe can re-verify recorded observations through the typed wrapper"
  - "35 CANDIDATE call sites documented, not swept: chokepoint classification stays at the chokepoint"
metrics:
  tasks: 3
  commits: 3
  tests_added: 2
  test_assertions: 21
  callsites_censused: 40
  completed: 2026-07-29
---

# Phase 236 Plan 03: Typed openRoomDb Failure Classification Summary

`openRoomDb` now throws `RoomDbBusyError` or `RoomDbBrokenError` keyed on the SQLite `errcode`
observed on this runtime, so a locked room, a broken room, and a room that does not exist yet are
three tellable-apart outcomes instead of one indistinguishable `null`.

## What Was Built

| Task | Deliverable | Commit |
|---|---|---|
| 1 | Behavioral probe plus lock-holder helper; real thrown-error shapes observed and recorded | `1de288e1` |
| 2 | `RoomDbBusyError` / `RoomDbBrokenError` + classified `openRoomDb` + one call-site narrowing | `53d96af6` |
| 3 | Both typed-open gates completed, mutation-proven; 40-site call-site census | `700f9008` |

## The Verbatim Observed Error Shapes

Observed on **`process.version` v22.23.1**, recorded in full in
`tests/test-236-open-busy-detected.cjs`'s header and re-verified on every run of that file.

| Case | `name` | `code` | `errcode` | `message` | Throw site (pre-fix) |
|---|---|---|---|---|---|
| busy | `Error` | `ERR_SQLITE_ERROR` | **5** | `database is locked` | `room-db.cjs:134` (migration chain) |
| mid-migration | `Error` | `ERR_SQLITE_ERROR` | **1** | `no such column: set_at` | `room-db.cjs:134` (same site) |
| garbage bytes | `Error` | `ERR_SQLITE_ERROR` | **26** | `file is not a database` | `room-db.cjs:119` (`PRAGMA journal_mode`) |
| truncated file | `Error` | `ERR_SQLITE_ERROR` | **11** | `database disk image is malformed` | `room-db.cjs:119` |
| genuinely absent | did not throw | | | | opened successfully |

Own enumerable properties for every throwing case: `["code", "errcode", "errstr"]`.

Three findings drove the design, and all three contradicted an assumption in the plan:

1. **`errcode` is the only stable discriminator.** `constructor.name` and `name` are `Error` for
   every case, and `code` is the constant `ERR_SQLITE_ERROR` for all of them. A classifier keying
   on name or code would have matched nothing and silently fallen through.
2. **The throw sites are not where the plan assumed.** The plan directed wrapping the
   `DatabaseSync` construction. That would have caught **nothing**: constructing a garbage-bytes
   file SUCCEEDS and corruption surfaces at the first `PRAGMA`, while a busy open throws from
   inside the migration chain. The implementation therefore wraps construction-plus-PRAGMA and the
   migration chain separately, and the migration wrapper checks busy FIRST because busy and
   mid-migration throw from the identical site.
3. **Busy and mid-migration are separable only by `errcode`**, not by throw site or by any string.

## Was "genuinely absent" a real failure mode?

**No.** Observed, not inherited from 236-RESEARCH.md's three-way framing:
`absentThrew: false`, `absentReturnedHandle: true`, `absentCreatedFile: true`.

`fs.mkdirSync(dbDir, { recursive: true })` at `room-db.cjs:107` runs before the construction, so
SQLite creates the file and the migrations run clean. An absent room.db **opens successfully and
returns a usable handle.** There is consequently no third error class: absence is distinguishable
from both typed classes because it does not throw at all, which is a stronger separation than a
third class would have provided. This settles ROADMAP criterion 3's "distinguishable from no room
db" leg on this runtime.

## Mutation Proofs (all three demonstrated, not asserted)

Every mutation below was actually applied, the red output captured, then reverted.

| Mutation | Result |
|---|---|
| Revert `room-db.cjs` to the bare pre-236 construction | Both gates red at scenario 0 (`exports both typed classes`) |
| Reinstate `catch (_e) { db = null; }` at `graph-derivation.cjs:254-257` | Busy gate red at scenario 5 (collapse site) |
| Delete only `closeRoomDb(db)` from the migration-chain catch | Broken gate red at scenario 6 (`before=0, after=3` descriptors) |

**Two of these caught a real weakness in the tests themselves, which is the reason for running them
rather than claiming them:**

- As first written, **neither gate detected the `graph-derivation.cjs` reversion.** Both called
  `openRoomDb` directly and never exercised the collapse site, so reverting the originally reported
  defect left every assertion green. Scenario 5 was added to drive `runDerivation` against a
  contended room. ROADMAP criterion 3 is now enforced by a live assertion rather than by
  inspection.
- The first no-handle-leak probe (assert a fresh connection can take a write lock with `timeout: 0`)
  stayed **green** under the leak mutation. A leaked handle whose transaction already rolled back
  holds no write lock, so the leak was real and the probe could not see it. It was replaced with a
  `/proc/self/fd` descriptor count, which detects the leak directly. The rejected probe is recorded
  in the test header, since the rejection is the useful finding.

## Canon Compliance

- **Part 8 (Graph Boundary).** `meta` carries `roomDir`, `dbPath`, a classification string, the
  stage, the SQLite `errcode`, and the cause NAME and MESSAGE only. The raw error object is never
  attached. Both gates carry a canary scenario proving a string seeded into the room's own rows
  appears in neither the thrown message nor the serialized meta (T-236-08 mitigated).
- **Part 9 (Memory Locality).** Classification lives at the single room.db chokepoint; no call site
  gained classification logic.
- **No em-dashes** in any of the five touched files (verified, `grep -c` returns 0 for each).

## Call-Site Census

`.planning/phases/236-room-db-data-loss-fixes/236-openroomdb-callsite-census.md`

| Disposition | Count |
|---|---|
| FIXED | 1 (`graph-derivation.cjs:264`) |
| IMPROVED-FOR-FREE | 4 (do not catch; now propagate a typed error unedited) |
| CANDIDATE | 35 (catch today; behavior unchanged, documented residual T-236-11) |
| **Total non-test call sites** | **40** |

236-RESEARCH.md estimated "25+". The measured figure is 40, which strengthens the chokepoint scope
decision rather than weakening it. Tier A of the census flags `graph-refine-loop.cjs:110` as
`catch (_e) { db = null; }`, byte-identical to the defect just fixed next door, and the strongest
candidate for the follow-up phase.

Whether a call site sits inside a `try` was determined by a brace-depth scan rather than a fixed
lookback, after a naive lookback misclassified `room-discard-cascade.cjs:95` (its enclosing `try`
opens seven lines above the call).

**`scripts/hsi-to-graph.cjs` was NOT touched** (Phase 242 / MOAT-01 territory), as the plan's
overlap check requires. Confirmed: `git diff --name-only` across all three commits lists only
`lib/core/room-db.cjs` and `lib/core/graph-derivation.cjs` under `lib/`, and nothing under
`scripts/`.

## Known Gap (dated, out of scope, recorded not omitted)

The **read-only door** is unfixed. 236-RESEARCH.md Pitfall 6 records that
`openRoomDbReadOnlyForCaller` returns a live handle for a corrupted database and
`room-graph-density-module.cjs`'s `countTable` catch-all reads the eventual query failure as **0
rows**, so a corrupt room silently reports an empty graph. GRAPHDB-02 as scoped here fixes the
read-write door only. Stated explicitly, as the research document requires. The fix shape is known
and recorded in the census.

## Deviations from Plan

### Auto-fixed / adjusted

**1. [Rule 1 - Design correction] The classifier could not wrap only the `DatabaseSync` construction**
- **Found during:** Task 2
- **Issue:** The plan directed wrapping the construction at `:117-119`. Task 1's recorded
  observations show corruption throws at the first `PRAGMA` and busy throws inside the migration
  chain, so that wrapper would have caught nothing.
- **Fix:** construction plus the three PRAGMA execs wrapped together; migration chain wrapped
  separately with busy checked before defaulting to broken.
- **Commit:** `53d96af6`

**2. [Rule 2 - Missing critical coverage] Neither gate covered the demonstrated collapse site**
- **Found during:** Task 3 mutation proof (b)
- **Issue:** Reverting `graph-derivation.cjs` to its bare catch left both gates fully green, so
  ROADMAP criterion 3 was unenforced.
- **Fix:** added busy-gate scenario 5, driving `runDerivation` against a contended room.
- **Commit:** `700f9008`

**3. [Rule 1 - False-green test] The no-handle-leak probe could not see the leak**
- **Found during:** Task 3 mutation proof (c)
- **Issue:** the lock-based probe stayed green when `closeRoomDb(db)` was deleted.
- **Fix:** replaced with a `/proc/self/fd` descriptor count; rejected probe documented in-file.
- **Commit:** `700f9008`

**4. [Rule 2 - Diagnostics] Added scenario 0 (exports precondition) to both gates**
- Reverting the classifier originally produced only
  `TypeError: Right-hand side of 'instanceof' is not an object`. Scenario 0 turns that into a named
  assertion failure.
- **Commit:** `700f9008`

**5. [Documented, not fixed] `meta.errcode` added beyond the plan's listed meta fields**
- The plan listed `roomDir`, db path, a classification string, and a cause name/message. The SQLite
  result code was also carried, because it is a classification scalar (an integer result code, not
  room content) and it lets the recorded-observation probe keep re-verifying every Task 1 finding
  through the typed wrapper. Part 8 safe; covered by both canary scenarios.

## Deferred Issues (pre-existing, not caused by this plan)

`tests/test-graph-derivation-verdict.cjs` fails 2 assertions
(`a FEYNMAN body carries the ## Timeline (auto) section`). **Verified pre-existing** by restoring
both source files to HEAD and re-running: byte-identical failure output. Unrelated to room.db open
classification. Logged in `deferred-items.md`, not fixed here per the executor scope boundary.

## Verification

| Check | Result |
|---|---|
| `node tests/test-236-open-busy-detected.cjs` | PASS 14/14 |
| `node tests/test-236-open-broken-detected.cjs` | PASS 7/7 |
| All four named exports present | `openRoomDb, closeRoomDb, RoomDbBusyError, RoomDbBrokenError` |
| Part 8 canary scenarios | pass in both gates |
| Census exists, exactly one site FIXED | yes |
| `git diff --name-only lib/` across the plan | exactly the two intended files |
| Em-dash count, all 5 touched files | 0 |
| Regression: `test-233-derivation-default-gate` | PASS 11/11 |
| Regression: `test-236-rebuild-preserves-journal` | 5 passed, 0 failed |
| Regression: `test-236-ecosystem-graph-preserves-journal` | 7 passed, 0 failed |
| Regression: `test-graph-derivation-loop` | PASS 5/5 |
| Regression: `test-navigation-acceptance`, `test-memory-ops` | green |

## Tracking-Write Discipline (STATE.md / ROADMAP.md)

The known cross-phase corruption bug
(`.planning/debug/gsd-phase-complete-cross-phase-corruption.md`) **bit again on one verb**, so
every auto-write was `git diff`-reviewed before commit, as instructed.

| Verb | Result | Action |
|---|---|---|
| `roadmap.update-plan-progress 236` | Correctly scoped to Phase 236 lines only. Two cosmetic drifts in its own row: status `Executing` -> `In Progress`, and the Completed cell blanked. | Hand-corrected both cells back to the table's existing vocabulary. Added the completion detail line to `236-03-PLAN.md`'s checkbox, matching the 236-01 convention. |
| `state.record-session` | **CORRUPTED.** Overwrote `stopped_at` with `"Completed 241-05-PLAN.md"` (a **Phase 241** artifact) despite being passed `236-03`, having read the stale value from the Session Continuity block instead of its own argument. Also truncated `last_activity` to `"Phase 236 execution started"`, discarding the Phase 237 closure record. | Both fields hand-corrected. The stale `Stopped at:` line in the Session Continuity block, which is what fed the bad value, was also corrected so it stops propagating. |
| `state.add-decision` | Rejected every invocation with `{"error":"summary required"}`, including a minimal probe. | Not fought. The session entry was hand-written into STATE.md in the file's established reverse-chronological format. |
| `requirements.mark-complete` | Not used. | GRAPHDB-02 hand-marked `[x]` in both the checklist and the traceability table, verified to be carried by this plan alone. |

**One counter was verified rather than trusted:** `completed_plans` jumped 19 -> 21, which looked
wrong for a single completed plan. Checked against the ROADMAP progress table
(2 + 2 + 8 + 5 + 2 + 2 = **21**): the new value is correct and the prior `19` was already stale.
Left as the tool computed it.

The harness classifier block on the literal token `complete` was **not** encountered this run;
`roadmap.update-plan-progress 236` takes no such argument and ran normally.

## Self-Check: PASSED

All created files exist on disk; all three commit hashes (`1de288e1`, `53d96af6`, `700f9008`)
verified present in `git log`.

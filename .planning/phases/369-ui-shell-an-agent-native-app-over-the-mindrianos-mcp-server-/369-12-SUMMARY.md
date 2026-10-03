---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
plan: 12
subsystem: database
tags: [change-log, cross-process, python, compaction, counter-metrics, d-18, retention]

requires:
  - phase: 369-04
    provides: fixture-room builder, run-all-369.sh legs, writer inventory
  - phase: 369-05
    provides: room_change_log triggers, epoch and floor in identity, readChangeLogMeta
provides:
  - cross-process proof that a second Node process, the U9 hook, the E5 and E6 bulk scripts and the Python engine P1 all log rows
  - the room-removal shape (no database for the read door to open)
  - compactChangeLog and a frozen RETENTION chosen from a measurement
  - retention-measurement.json (counts and milliseconds only)
  - todo for the substrate guard blind spot on INSERT OR IGNORE
affects: [369-13 room_changes (checkpoint_expired below the floor, room_unavailable), 369 writer coverage]

tech-stack:
  added: []
  patterns:
    - "Measure, then choose, then time at the chosen numbers; the test compares live counts to the recorded JSON and fails by saying to re-measure"
    - "Compaction nests via the owns idiom inside installChangeLog's own transaction and runs only above the ceiling"
    - "Foreign-writer arms use a long-lived read-only observer and PRAGMA data_version"

key-files:
  created:
    - tests/test-369-change-log-cross-process.cjs
    - tests/test-369-change-log-compaction.cjs
    - tests/fixtures/369/retention-measurement.json
    - .planning/todos/pending/2026-10-02-substrate-guard-misses-insert-or-ignore.md
  modified:
    - lib/core/navigation/room-change-log.cjs

key-decisions:
  - "RETENTION stays at the contract defaults, maxRows 100000 and keepRows 50000: required_rows measured at 30,200"
  - "Retained rows are computed from the meta (latest_seq - max(floor,1) + 1), not a COUNT scan, so the every-hook open pays no table scan"
  - "The floor is the oldest retained seq, so a client at cursor floor-1 is reported expired although its rows survive; safe by one"
  - "No coalescing: snapshot mode reads current nodes and edges, so a client behind the floor needs a snapshot either way"
  - "Python arm seeds the engine's own embedding cache through its own helpers so no model download or network is needed (Canon Part 8)"

patterns-established:
  - "Hygiene check on a shared machine is attributable (fixture markers in changed files under the real home), not 'any file newer than start', because other live sessions legitimately rewrite ~/MindrianRooms"

requirements-completed: [CHG369-05, CHG369-06, CM369-01]

duration: 40min
completed: 2026-10-03
---

# Phase 369 Plan 12: Cross-process capture and measured compaction Summary

**Every writer class the inventory names (other Node process, SessionStart hook, two bulk scripts, Python on its own SQLite 3.45.1) is proven to log through the table triggers, and the log now compacts above a measured 100,000-row ceiling (30,200 rows needed, 52 ms to compact).**

## Accomplishments

- `tests/test-369-change-log-cross-process.cjs`, six arms, each with a long-lived read-only observer reading `PRAGMA data_version` and `max(change_seq)` around the child:
  1. a second Node process through `openRoomDb` and `insertNode`: data_version changed, one `node`/`upsert` row.
  2. U9 `check-pending-ambiguous.cjs` run with SessionStart-shaped stdin: its UPDATE logged.
  3. E5 `build-ecosystem-graph.cjs` and E6 `hsi-to-graph.cjs`, each run twice so the second run's wipe logs `delete` rows (BELONGS_TO, REVERSE_SALIENT), plus edge and node upserts.
  4. P1 `scripts/rs-engine.py` through python3 (prints `sqlite3.sqlite_version = 3.45.1`): node upserts for the 460/477 writes, edge `delete` (534) and `upsert` (539) after a second run. This proves the trigger bodies run on the interpreter's own SQLite.
  5. R1 `discardPlaceholderRoom`: the room directory is gone and `openRoomDbReadOnlyForCaller` returns `null` (the shape plan 13 reports as `room_unavailable`).
  6. nothing from the run reached `~/MindrianRooms` or `~/.mindrian`.
- `compactChangeLog(db, { keepRows })` and `RETENTION` in `lib/core/navigation/room-change-log.cjs`; `installChangeLog` calls compaction only when retained rows exceed `RETENTION.maxRows`, inside its own transaction, and now also returns `compacted`.
- `tests/test-369-change-log-compaction.cjs`: growth and timing measurements plus arms a-f. `--write` regenerates `tests/fixtures/369/retention-measurement.json`.
- Todo filed for the Part 9 guard gap (`RE_RAW_WRITE` misses `INSERT OR IGNORE INTO`, rows N4, N5, E2).

## Measurement (CM369-01, counts only)

| Key | Value |
|---|---|
| rows_per_2000_writes | 2000 |
| rows_per_rebuild (steady state, 210 nodes) | 1010 |
| rows_after_10_rebuilds (from empty) | 9691 |
| required_rows = 1010*20 + (2000/2000)*10000 | 30200 |
| retention_max_rows / retention_keep_rows | 100000 / 50000 |
| compaction_ms_at_retention | about 52 (limit 2000) |
| node_count | 210 |

30,200 is under the 100,000 default, so the defaults stand and the 2:1 ratio is kept. Compaction at the shipped ratio is about 40x inside the 2000 ms hook budget, so no smaller batch is needed.

## Task Commits

1. **Task 1: cross-process, hook, bulk-script, Python and room-removal capture** - `c7704417d` (test)
2. **Task 2: compaction, measured retention, measurement fixture, todo** - `fbae7dfa1` (feat)

## Test Results

- `node tests/test-369-change-log-cross-process.cjs`: PASS=6 FAIL=0 SKIP=0 (python3 3.12.3, sqlite 3.45.1)
- `node tests/test-369-change-log-compaction.cjs`: PASS=8 FAIL=0 (growth, timing, a-f), stable across repeated runs
- `node tests/test-369-change-log-ddl.cjs`: PASS=11 FAIL=0 (unchanged)
- `node -e` RETENTION check (maxRows > keepRows): exit 0
- `bash tests/run-all-369.sh`: legs "change log DDL", "change log cross-process and Python" and "change log compaction and retention" all PASSED. Reds outside this plan: see Findings.

## Deviations from Plan

- **[Rule 3 - Blocking] Python arm env.** The hermetic HOME hides the user site-packages where numpy lives, and rs-engine.py would then try `pip install`. The arm points PYTHONPATH at the real user site (read-only use) and SKIPs (exit 77) rather than auto-installing if numpy, requests or scikit-learn do not import.
- **[Rule 3 - Blocking] Hermetic embeddings.** The default minilm path would load a model from the Hugging Face cache or the network. The arm seeds the engine's own `.rs-engine-cache.json` through its own helpers (`discover_artifacts`, `_content_hash`, `_save_embedding_cache`) so the CLI run is the real script with no model load.
- **[Rule 1 - Bug in my own first draft] Arm 6.** "No file newer than the start under ~/MindrianRooms" failed twice because other live Claude sessions rewrite `~/MindrianRooms/<room>/STATE.md` and `~/.mindrian/bridge/*.json` during the run. Replaced by an attributable check: changed files fail only when their path or text carries a marker unique to this run's fixtures. Unrelated changes are counted and ignored.
- Arm d (installChangeLog threshold) uses the real RETENTION values with a prepared raw UPDATE loop for synthesis rather than a test-only override parameter on `installChangeLog`.

## Findings (not caused by this plan)

1. `369: erasable gate (TS369-03)` is RED in the aggregator: a TS path alias (`paths`) in `ui/bakeoff/agent-native/app/tsconfig.json`, a peer plan's file. Not touched.
2. Pre-existing from 369-04: regression leg `198 local only` RED.
3. The todo cites `tests/test-369-writer-inventory.cjs` as the wider-pattern coverage test; that file is a later plan's (it is the aggregator's declared leg name) and does not exist yet.

## Known Stubs

None.

## Threat Flags

None. All four register mitigations hold: T-01 arms 1-4 watch each writer class, T-02 measured ceiling with compaction only above maxRows and the 2000 ms assertion, T-03 floor raised by compaction (plan 13 answers `checkpoint_expired` below it), T-04 hermetic HOME and rooms home plus the attributable post-run check.

## Self-Check: PASSED

- Files present: tests/test-369-change-log-cross-process.cjs, tests/test-369-change-log-compaction.cjs, tests/fixtures/369/retention-measurement.json, .planning/todos/pending/2026-10-02-substrate-guard-misses-insert-or-ignore.md, lib/core/navigation/room-change-log.cjs (exports compactChangeLog, RETENTION)
- Commits present: c7704417d, fbae7dfa1

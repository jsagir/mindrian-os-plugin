---
phase: quick-260729-pnw
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/core/graph-refine-loop.cjs
  - tests/test-236-refine-loop-open-detected.cjs
autonomous: true
requirements: [GRAPHDB-02]
tags: [room-db, error-classification, graph-refine, mutation-proof]

must_haves:
  truths:
    - "runGraphRefine on a genuinely CONTENDED room throws RoomDbBusyError instead of returning a normal-looking result built on db = null"
    - "runGraphRefine on a room whose migration cannot be reconciled throws RoomDbBrokenError, and that error is distinguishable from the busy one"
    - "runGraphRefine on a room with no .mindrian directory still proceeds normally and returns its {proposed, verified, written, rounds} shape (absence is NOT a failure mode, unchanged from today)"
    - "Every error that is NOT RoomDbBusyError or RoomDbBrokenError still falls through to db = null exactly as before (the guard is instanceof-narrowed, never blanket)"
    - "The re-throw is proven by an EXECUTED mutation: reverting the catch turns the new test RED on the busy assertion by name, restoring it turns it GREEN, and both outputs are captured in SUMMARY.md"
    - "graph-refine-loop.cjs still lazy-loads room-db.cjs through _roomDb(); no top-level require was introduced"
    - "No production file other than lib/core/graph-refine-loop.cjs changed"
  artifacts:
    - path: "lib/core/graph-refine-loop.cjs"
      provides: "instanceof-narrowed re-throw of RoomDbBusyError / RoomDbBrokenError at the runGraphRefine open site"
      contains: "e instanceof rdb.RoomDbBusyError"
    - path: "tests/test-236-refine-loop-open-detected.cjs"
      provides: "call-site collapse gate against runGraphRefine: busy throws, broken throws, absent still works, uncontended control"
      min_lines: 200
  key_links:
    - from: "lib/core/graph-refine-loop.cjs"
      to: "lib/core/room-db.cjs"
      via: "lazy _roomDb() helper now also caching RoomDbBusyError and RoomDbBrokenError"
      pattern: "_RoomDbBusyError"
    - from: "tests/test-236-refine-loop-open-detected.cjs"
      to: "tests/helpers/room-db-lock-holder-236.cjs"
      via: "child_process.fork of the existing lock holder (reused, never duplicated)"
      pattern: "room-db-lock-holder-236"
    - from: "tests/test-236-refine-loop-open-detected.cjs"
      to: "runGraphRefine"
      via: "direct require of lib/core/graph-refine-loop.cjs (the subject is the CALL SITE, not openRoomDb)"
      pattern: "runGraphRefine\\("
    - from: "tests/run-all-236.sh"
      to: "tests/test-236-refine-loop-open-detected.cjs"
      via: "existing tests/test-236-*.cjs glob discovery (no runner edit required)"
      pattern: "tests/test-236-\\*.cjs"
---

<objective>
Close the last Tier A swallow-to-null site named by Phase 236's own call-site census:
`lib/core/graph-refine-loop.cjs:112`, where `catch (_e) { db = null; }` collapses a LOCKED
room, a BROKEN room and an ABSENT room into one indistinguishable null. Phase 236 GRAPHDB-02
already built the classifier (`RoomDbBusyError` / `RoomDbBrokenError` in `lib/core/room-db.cjs`)
and already fixed the sibling site in `graph-derivation.cjs`. The census called this site
"byte-identical to the defect just fixed" and "the strongest candidate for the next phase".
This is that follow-up.

Purpose: a graph-refine run against a room that is momentarily locked currently proceeds with
`db = null`, walks a null neighborhood, and returns a clean-looking `{proposed, verified,
written, rounds}` result as if the room had no history. That is the exact false-success shape
GRAPHDB-02 exists to eliminate, one call site short of finished.

Output: the narrowed catch in `graph-refine-loop.cjs`, plus a new mutation-proved test
`tests/test-236-refine-loop-open-detected.cjs` that is auto-discovered by the existing
`tests/run-all-236.sh` glob.

Scope boundary, non-negotiable: exactly ONE production file changes. Do NOT touch
`lib/core/room-db.cjs`, `lib/core/graph-derivation.cjs`, `tests/test-236-open-busy-detected.cjs`,
`tests/helpers/room-db-lock-holder-236.cjs`, `tests/run-all-236.sh`, `.planning/ROADMAP.md`,
`.planning/REQUIREMENTS.md`, or `.planning/STATE.md`. This is a quick task, not a phase.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@lib/core/graph-refine-loop.cjs
@lib/core/graph-derivation.cjs
@lib/core/room-db.cjs
@tests/test-236-open-busy-detected.cjs
@tests/helpers/room-db-lock-holder-236.cjs
@.planning/phases/236-room-db-data-loss-fixes/236-03-SUMMARY.md
@.planning/phases/236-room-db-data-loss-fixes/236-openroomdb-callsite-census.md
</context>

<interfaces>
Contracts already on disk. Do NOT re-derive these; they are what this plan builds against.

**lib/core/room-db.cjs (line 333, unchanged by this plan):**
`module.exports = { openRoomDb, closeRoomDb, RoomDbBusyError, RoomDbBrokenError };`
Both classes set `this.name` explicitly (`'RoomDbBusyError'` / `'RoomDbBrokenError'`) so name
discrimination survives a duplicated-module-instance boundary where `instanceof` could fail.
Both carry a Canon Part 8 safe `meta` (path and classification scalars only, never row content).

**lib/core/graph-refine-loop.cjs, the function under change:**
`runGraphRefine(roomDir, opts) -> { proposed, verified, written, rounds }`
CRITICAL: `roomDir` is the FIRST POSITIONAL argument, not a key inside `opts`. A call written as
`runGraphRefine({ roomDir, focusNodeId, ... })` silently passes an object as `roomDir`, fails the
`typeof roomDir === 'string'` guard, never opens the db, and makes the whole test vacuous.
Every call in the new test MUST be `runGraphRefine(roomDir, { ... })`. Confirmed against the four
existing calls in `tests/test-201-graph-refine-loop.cjs`, which all use `runGraphRefine(null, {...})`.

Relevant `opts` keys:
- `focusNodeId` (required, non-empty string) and `proposeFn` (required, function). Both are
  validated by EARLY-RETURN guards that run BEFORE the db open. Omit either and the function
  returns `{..., error: 'focusNodeId_required' | 'proposeFn_required'}` without ever opening the
  room, which is a second way to make this test vacuous.
- `getNeighborhoodFn(db, focusNodeId)` defaults to `navigation.getNeighborhood`. Inject an inert
  `() => []` in the test so the subject stays the OPEN, not the navigation layer. This mirrors
  how scenario 5 of `test-236-open-busy-detected.cjs` injects `deriveFn`.
- `dryRun` defaults TRUE, so `willWrite` is false. The open STILL happens: the guard is
  `(!db && willWrite) || (!db && typeof roomDir === 'string')` by JS precedence, and the second
  clause fires on any string roomDir. No `approve`/`dryRun` juggling is needed.

**Existing test fixtures to REUSE verbatim from tests/test-236-open-busy-detected.cjs:**
- `PENDING_MIGRATION_SENTINEL = 'phase_109_session_focus_v1'`
- `seedRoom(roomDir)` builds a real migrated room.db
- `makeMigrationPending(roomDir)` deletes the sentinel so the NEXT open has genuine write work.
  Load-bearing: under WAL an already-migrated room.db opens fine even under an exclusive lock,
  so without pending write work the busy leg passes for the wrong reason (236-RESEARCH Pitfall 1).
- `injectMidMigrationThrow(roomDir)` drops `idx_session_focus_set_at` and the `set_at` column, then
  deletes the sentinel, producing a deterministic mid-migration failure (errcode 1 -> broken).
  Deliberately an ALTER, never a DROP-and-recreate (Phase 108 D-05 schema-drift guard).
- `startLockHolder(roomDir)` / `stopLockHolder(handle)` fork protocol over IPC:
  child sends `{ ready: true, mode }` only AFTER the write lock is materially held;
  parent sends `'release'`. Helper exit codes: 0 clean, 2 cannot open, 3 cannot lock.

**tests/run-all-236.sh** discovers by `for t in tests/test-236-*.cjs`. A new file matching that
glob joins the phase gate automatically. DO NOT edit the runner. Its header comment enumerates
the eight mandatory files as a human checklist; a ninth file added by a follow-up quick task does
not belong in that enumeration and adding it would be an out-of-scope edit.
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Narrow the swallow-to-null catch in runGraphRefine</name>
  <files>lib/core/graph-refine-loop.cjs</files>
  <action>
Two edits in this one file. Nothing else changes.

EDIT 1, the lazy loader at lines 27 to 36. Extend the existing `_roomDb()` helper to also cache
and return the two typed classes. Add module-scope `let _RoomDbBusyError = null;` and
`let _RoomDbBrokenError = null;` beside the existing `_openRoomDb` / `_closeRoomDb`, assign both
from `m` inside the existing `if (!_openRoomDb)` block, and add both to the returned object
alongside `openRoomDb` and `closeRoomDb`. The cache key stays `_openRoomDb`, so the require still
fires exactly once.

PRESERVE THE LAZY PATTERN. Do NOT convert this to a top-level `require('./room-db.cjs')` the way
`graph-derivation.cjs` does. The laziness is deliberate: it keeps this module's real room-db
dependency out of the require graph for the many tests that inject `opts.db` (see
`tests/test-201-graph-refine-loop.cjs`, which calls `runGraphRefine(null, {...})` four times and
must keep working untouched). Switching to a top-level require would silently pull node:sqlite
into every one of those runs.

EDIT 2, the open site at lines 108 to 113. Hoist one `const rdb = _roomDb();` above the `try`, call
`rdb.openRoomDb(roomDir)` inside it, and replace the bare `catch (_e) { db = null; }` with an
instanceof-narrowed guard that re-throws only the two typed classes and otherwise keeps the old
`db = null`:

  if (!db && willWrite || (!db && typeof roomDir === 'string')) {
    const rdb = _roomDb();
    try {
      db = rdb.openRoomDb(roomDir);
      owned = true;
    } catch (e) {
      if (e instanceof rdb.RoomDbBusyError || e instanceof rdb.RoomDbBrokenError) throw e;
      db = null;
    }
  }

Leave the surrounding `if` condition byte-identical. Leave `let db = o.db || null;` and
`let owned = false;` byte-identical. Leave the `finally { if (owned && db) ... }` block untouched:
this open sits BEFORE the main `try`, so a re-thrown error propagates straight out of
runGraphRefine with `owned` still false and no dangling handle to close.

Add a short comment above the try, in the register of the one at `graph-derivation.cjs:256-262`,
stating: this site adds NO classification logic (classification lives in room-db.cjs); it only
stops swallowing the two typed classes; every other error keeps the old null so a genuine cold
start is still a cold start; and this is strictly NARROWER than the previous behavior, never wider.

Do NOT add a blanket `throw e`. Do NOT add a third class. Do NOT special-case "absent": absence is
not an open failure at all on this runtime (`fs.mkdirSync(dbDir, {recursive: true})` runs before
the SQLite construction, so an absent room.db opens successfully and returns a usable handle), and
this fix must leave that path byte-for-byte unchanged.

No em-dashes anywhere (CLAUDE.md HARD RULE). Use hyphens.
  </action>
  <verify>
    <automated>node --check lib/core/graph-refine-loop.cjs && node -e "const m=require('./lib/core/graph-refine-loop.cjs'); if(typeof m.runGraphRefine!=='function') throw new Error('export lost');" && bash -c 'S=$(grep -vE "^[[:space:]]*(//|\*|/\*)" lib/core/graph-refine-loop.cjs); [ "$(printf "%s" "$S" | grep -c "catch (_e) { db = null; }")" -eq 0 ] || { echo "FAIL: bare swallow still on an executable line"; exit 1; }; [ "$(printf "%s" "$S" | grep -c "instanceof rdb.RoomDbBusyError")" -ge 1 ] || { echo "FAIL: busy guard missing"; exit 1; }; [ "$(printf "%s" "$S" | grep -c "instanceof rdb.RoomDbBrokenError")" -ge 1 ] || { echo "FAIL: broken guard missing"; exit 1; }; [ "$(printf "%s" "$S" | grep -c "^const .*require.*room-db")" -eq 0 ] || { echo "FAIL: top-level require introduced, lazy pattern lost"; exit 1; }; echo OK' && node tests/test-201-graph-refine-loop.cjs && ! grep -qP "\\x{2014}" lib/core/graph-refine-loop.cjs && [ "$(git diff --name-only -- lib scripts | wc -l)" -eq 1 ]</automated>
  </verify>
  <done>
`lib/core/graph-refine-loop.cjs` re-throws only `RoomDbBusyError` and `RoomDbBrokenError` and keeps
`db = null` for everything else. `_roomDb()` still lazy-requires and now also returns both classes.
The pre-existing `tests/test-201-graph-refine-loop.cjs` still passes untouched. `git diff --name-only
-- lib scripts` lists exactly one file. Zero em-dashes.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Write the call-site collapse gate against runGraphRefine</name>
  <files>tests/test-236-refine-loop-open-detected.cjs</files>
  <behavior>
Scenario 0 (precondition, FIRST so a room-db.cjs revert fails by NAME rather than as a bare
  "TypeError: Right-hand side of 'instanceof' is not an object"):
  `lib/core/room-db.cjs` exports both typed classes and their `.name` values match.

Scenario 1 (THE mutation-proof positive case): seed a room, `makeMigrationPending`, fork the lock
  holder, then `runGraphRefine(room, { focusNodeId: 'refine-focus-236', proposeFn: () => [],
  getNeighborhoodFn: () => [] })` THROWS `RoomDbBusyError` and returns nothing.

Scenario 2 (busy and broken are TELLABLE APART, not merely both typed): that same error is NOT a
  `RoomDbBrokenError`, and `err.name === 'RoomDbBusyError'`.

Scenario 3 (the collapse shape is provably absent): assert the thrown result is not the
  normal-looking `{proposed, verified, written, rounds}` object. State in a comment what the
  pre-fix behavior was, observed not assumed: with `db = null` the injected `getNeighborhoodFn`
  returns `[]`, `proposeFn` returns `[]`, `fresh.length === 0` breaks the loop on round 1, and the
  function returns `{proposed: [], verified: [], written: [], rounds: 1}` looking perfectly healthy.

Scenario 4 (Canon Part 8): seed a canary string into the room's own rows before contending it, then
  assert it appears in NEITHER `String(err.message)` NOR `JSON.stringify(err.meta)`.

Scenario 5 (CONTROL, after `stopLockHolder`): the SAME room, same pending migration, lock holder
  gone, now returns normally with `rounds >= 1` and no throw. Without this, scenario 1 could be
  passing because the room is broken in some unrelated way rather than because it is contended.

Scenario 6 (BROKEN): a separate room seeded then `injectMidMigrationThrow`-ed makes runGraphRefine
  throw `RoomDbBrokenError`, and that error is NOT a `RoomDbBusyError`.

Scenario 7 (NO-REGRESSION, absence is not a failure mode): a fresh scratch dir with no `.mindrian`
  at all. `runGraphRefine` does NOT throw, returns an object carrying all four keys
  (`proposed`, `verified`, `written`, `rounds`) with `rounds >= 1`, AND
  `fs.existsSync(path.join(absentRoom, '.mindrian', 'room.db'))` is true afterwards. That last
  assertion is the load-bearing one: it proves the open really ran and SUCCEEDED rather than being
  skipped, which is what makes this a real no-regression check instead of a tautology.
  </behavior>
  <action>
Create `tests/test-236-refine-loop-open-detected.cjs`, executable-style (`#!/usr/bin/env node`,
`'use strict';`), CJS, node built-ins only, following the structure of
`tests/test-236-open-busy-detected.cjs`.

REUSE, do not duplicate: `fork` `tests/helpers/room-db-lock-holder-236.cjs` through the same
`startLockHolder` / `stopLockHolder` IPC pattern. Copy the fixture functions `seedRoom`,
`makeMigrationPending` and `injectMidMigrationThrow` and the `PENDING_MIGRATION_SENTINEL` const
from the existing test file (they are local functions there, not exports, so copying is the only
option; keep the names identical so the kinship is obvious to a reader). Copy the `check(label,
cond)` counter, the `callAndCatch(fn)` harness, the `makeScratchRoom` / `scratchRoots` / `cleanup`
pattern, and the `main().then(cleanup).catch(...)` shape that cleans up on failure too.

Require `runGraphRefine` from `lib/core/graph-refine-loop.cjs` and the two classes plus
`openRoomDb` / `closeRoomDb` from `lib/core/room-db.cjs` (the latter only for fixtures).

Put the discriminating literals in named consts so a rename breaks loudly instead of silently
passing, exactly as the sibling file does: `BUSY_CLASS_NAME`, `BROKEN_CLASS_NAME`,
`FOCUS_NODE_ID`, and a `ROOM_CONTENT_CANARY` distinct from the sibling file's (use
`'CANARY-refine-loop-room-bytes-must-not-egress'`).

Every `runGraphRefine` call MUST pass `roomDir` POSITIONALLY as argument one and MUST supply both
`focusNodeId` and `proposeFn`, or the early-return guards make the test vacuous. Inject
`getNeighborhoodFn: () => []` and `proposeFn: () => []` everywhere so the only variable across
scenarios is the state of the room.

Write a header comment block stating, in plain prose: what this file gates (the ONE call site
`graph-refine-loop.cjs:112`, the last Tier A entry of `236-openroomdb-callsite-census.md`), why the
subject is `runGraphRefine` and NOT `openRoomDb` (the chokepoint is already gated by
`test-236-open-busy-detected.cjs`; what was never gated is whether THIS caller propagates), and a
"MUTATION THAT TURNS THIS RED" section naming the exact reversion (reinstate `catch (_e) { db =
null; }` in `graph-refine-loop.cjs`) and which scenario fails. Leave the observed RED output to be
pasted in by Task 3 rather than predicting it here.

Do NOT re-probe error shapes. `test-236-open-busy-detected.cjs` already recorded them verbatim on
this runtime (v22.23.1: busy errcode 5, mid-migration 1, notadb 26, corrupt 11) and re-verifies
them on every run. Cite that file; do not duplicate the probe.

Do NOT add this file to `tests/run-all-236.sh`. The runner globs `tests/test-236-*.cjs` and picks it
up with zero edits.

No em-dashes anywhere.
  </action>
  <verify>
    <automated>node --check tests/test-236-refine-loop-open-detected.cjs && node tests/test-236-refine-loop-open-detected.cjs && ! grep -qP "\\x{2014}" tests/test-236-refine-loop-open-detected.cjs && bash -c 'grep -q "room-db-lock-holder-236" tests/test-236-refine-loop-open-detected.cjs || { echo "FAIL: lock holder not reused"; exit 1; }; grep -qE "runGraphRefine\(room" tests/test-236-refine-loop-open-detected.cjs || { echo "FAIL: roomDir not passed positionally"; exit 1; }; git diff --quiet -- tests/run-all-236.sh tests/helpers tests/test-236-open-busy-detected.cjs || { echo "FAIL: an out-of-scope test file was modified"; exit 1; }; echo OK' && bash -c 'sleep 1; if pgrep -af "^[^ ]*node .*room-db-lock-holder-236" >/dev/null; then echo "FAIL: orphaned lock holder"; exit 1; fi; echo "no orphans"'</automated>
  </verify>
  <done>
`node tests/test-236-refine-loop-open-detected.cjs` exits 0 with every scenario printing `ok -`, and
its final line reports the pass count. The busy scenario is driven by a real forked lock holder
against a real contended room.db, the broken scenario by a real mid-migration injection, and the
absent scenario confirms the room.db file was actually created by the successful open. No orphaned
lock-holder process survives the run (checked with the interpreter-anchored `pgrep` form, since the
naive `pgrep -f room-db-lock-holder-236` matches the invoking shell's own command line and reports a
phantom PID). No other test file was modified. Zero em-dashes.
  </done>
</task>

<task type="auto">
  <name>Task 3: Execute the mutation proof in both directions and capture the real output</name>
  <files>lib/core/graph-refine-loop.cjs, tests/test-236-refine-loop-open-detected.cjs</files>
  <action>
This task produces EVIDENCE, not a claim. An inspection-only assertion that "the test would fail"
does not discharge it. Run all four steps and paste real terminal output into SUMMARY.md.

STEP 1, capture GREEN before mutating. Run `node tests/test-236-refine-loop-open-detected.cjs
2>&1 | tee /tmp/refine-green-before.txt`. Record the exit code and the final pass line.

STEP 2, MUTATE. In `lib/core/graph-refine-loop.cjs`, revert ONLY the catch body back to the bare
pre-fix form `} catch (_e) { db = null; }` (drop the `const rdb = _roomDb();` hoist and the
instanceof guard, restoring `_roomDb().openRoomDb(roomDir)` inline). LEAVE the `_roomDb()` loader
extension from Task 1 in place: mutating the loader too would confound which change the RED result
is actually attributable to. The mutation must be exactly the one line of behavior under test.

STEP 3, capture RED. Run `node tests/test-236-refine-loop-open-detected.cjs 2>&1 | tee
/tmp/refine-red.txt; echo "exit=$?"`. Confirm THREE things and record each:
  (a) the exit code is non-zero;
  (b) the failure is a NAMED AssertionError on the busy-throws assertion (scenario 1), not a
      TypeError, not a fixture crash, not a timeout. If it fails for any other reason the test is
      not measuring what it claims and must be fixed before proceeding;
  (c) scenario 0 and the absent no-regression scenario are unaffected by this mutation, which
      localizes the RED to the call site rather than to the harness.
If the test goes GREEN under the mutation, STOP. The test is vacuous and Task 2 must be redone.

STEP 4, RESTORE and re-confirm GREEN. Put Task 1's fix back exactly. Re-run Task 1's full verify
command, then `node tests/test-236-refine-loop-open-detected.cjs 2>&1 | tee
/tmp/refine-green-after.txt`. Confirm `git diff` of `lib/core/graph-refine-loop.cjs` against the
Task 1 state is empty, so no mutation residue shipped.

STEP 5, the phase gate. Run `bash tests/run-all-236.sh 2>&1 | tail -30`. Expect `FAIL=0 SKIP=0` and
`PASS=12` (the 11 legs recorded at Phase 236 close, plus this new glob-discovered file). If PASS is
not 12, do not adjust the number to match: report the discrepancy, since it means a file was added
or lost somewhere else.

Then write the quick SUMMARY.md. It MUST contain the actual captured pass/fail counts and the
verbatim RED assertion line from step 3, not a paraphrase. Also record the sibling-file kinship:
this closes the last Tier A candidate from `236-openroomdb-callsite-census.md`, and Tier A still has
four remaining entries (`breakthrough/scanner.cjs:122`, `navigation/spine-events.cjs:139` and `:220`,
`navigation/lens-nodes.cjs:251`, `navigation/room-birth.cjs:1093`) which stay deliberately out of
scope here.

Commit both files with a conventional message. Two repo-specific hazards, both recorded in
`.planning/STATE.md` from Phase 236: do NOT put the literal token "complete" anywhere in a Bash
argv (a harness classifier blocks it), and do NOT use `COMMIT_NO_VERIFY` or otherwise bypass the
pre-commit chain. `.planning/` is gitignored, so committing the SUMMARY needs `git add -f`.

Do NOT touch `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md` or `.planning/STATE.md`. GRAPHDB-02
is already marked done from Phase 236; this quick task hardens a second call site and does not
reopen or re-close any requirement row.

No em-dashes anywhere.
  </action>
  <verify>
    <automated>bash -c 'set -e; test -s /tmp/refine-green-before.txt || { echo "FAIL: no captured GREEN-before output"; exit 1; }; test -s /tmp/refine-red.txt || { echo "FAIL: no captured RED output"; exit 1; }; grep -qi "assert" /tmp/refine-red.txt || { echo "FAIL: RED output shows no assertion failure, the mutation did not fail the intended way"; exit 1; }; test -s /tmp/refine-green-after.txt || { echo "FAIL: no captured GREEN-after output"; exit 1; }; echo "evidence captured"' && node tests/test-236-refine-loop-open-detected.cjs && bash -c 'S=$(grep -vE "^[[:space:]]*(//|\*|/\*)" lib/core/graph-refine-loop.cjs); [ "$(printf "%s" "$S" | grep -c "catch (_e) { db = null; }")" -eq 0 ] || { echo "FAIL: mutation residue shipped"; exit 1; }; [ "$(printf "%s" "$S" | grep -c "instanceof rdb.RoomDbBusyError")" -ge 1 ] || { echo "FAIL: fix not restored"; exit 1; }; echo restored' && bash tests/run-all-236.sh 2>&1 | tail -5 | grep -qE "FAIL=0" && bash -c 'CH=$(git status --porcelain -- lib scripts | wc -l); [ "$CH" -le 1 ] || { echo "FAIL: more than one production file dirty"; git status --porcelain -- lib scripts; exit 1; }; echo scope-ok'</automated>
  </verify>
  <done>
Both mutation directions were actually executed, not reasoned about. `/tmp/refine-red.txt` holds a
non-zero-exit run whose failure is a named AssertionError on the busy-throws assertion;
`/tmp/refine-green-before.txt` and `/tmp/refine-green-after.txt` hold passing runs on either side of
it. The fix is restored with zero mutation residue. `bash tests/run-all-236.sh` reports `FAIL=0
SKIP=0` with the new file discovered by glob. SUMMARY.md quotes the real counts and the verbatim RED
line. Exactly two files are committed: `lib/core/graph-refine-loop.cjs` and
`tests/test-236-refine-loop-open-detected.cjs`. No ROADMAP, REQUIREMENTS or STATE write.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| test process -> forked lock holder | A child OS process takes a real write lock on a scratch room.db. It can outlive its parent. |
| runGraphRefine -> room.db | An untrusted-availability resource: it may be locked by another session, damaged on disk, or absent. |
| error object -> logs | A thrown error escaping this call site may be serialized into a log by any caller upstream. |
| working tree -> git | Task 3 deliberately mutates a production file mid-run, so the tree is briefly in a knowingly-broken state. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-PNW-01 | Information disclosure | RoomDbBusyError propagating out of runGraphRefine into a caller's log | mitigate | Canon Part 8: Task 2 scenario 4 seeds a canary into the room's own rows and asserts it appears in neither `err.message` nor `JSON.stringify(err.meta)`. This plan adds no new meta fields, so the sibling file's guarantee is inherited and re-asserted rather than re-derived. |
| T-PNW-02 | Denial of service | forked room-db-lock-holder-236 child | mitigate | Reuse the helper's existing 60s `setTimeout(...).unref()` safety valve so it never outlives a dead parent; `stopLockHolder` before the control scenario; `cleanup()` runs in both the `.then` and the `.catch` path; Task 2 verify runs an interpreter-anchored `pgrep -af "^[^ ]*node .*room-db-lock-holder-236"` orphan check (the naive `-f` form matches the invoking shell itself and reports a phantom PID). |
| T-PNW-03 | Tampering | lib/core/graph-refine-loop.cjs during the Task 3 mutation window | mitigate | Task 3 step 4 restores and re-runs Task 1's full verify; Task 3 verify greps comment-stripped source for zero occurrences of the bare swallow plus at least one instanceof guard, and asserts at most one production file is dirty, so mutation residue cannot ship. |
| T-PNW-04 | Elevation of privilege | the instanceof guard widening over time into a blanket `throw e` | mitigate | The guard is instanceof-narrowed to exactly two classes and the comment states explicitly that every other error keeps `db = null`. Task 2 scenario 7 pins that an ABSENT room still opens and returns normally, so a future widening that swallows-then-throws on the absent path turns that scenario red. |
| T-PNW-05 | Spoofing | a test that passes for the wrong reason (vacuity) | mitigate | Three independent anti-vacuity legs: `makeMigrationPending` gives the second opener genuine write work (without it a WAL room opens fine under an exclusive lock); the uncontended CONTROL scenario proves the busy result came from contention and not from a broken room; and Task 3's executed RED run proves the assertions actually bite. |
| T-PNW-06 | Repudiation | claiming a mutation proof that was never run | mitigate | Task 3 verify fails unless three separate captured output files exist on disk and the RED capture contains an assertion failure. SUMMARY.md must quote the verbatim RED line, not paraphrase it. |
| T-PNW-SC | Tampering | npm/pip/cargo installs | accept | No package installs in this plan. Zero dependency changes, zero network reach; `package.json` and any lockfile are untouched, so the legitimacy gate has nothing to gate. |
</threat_model>

<verification>
1. `node tests/test-236-refine-loop-open-detected.cjs` exits 0 with every scenario green.
2. `node tests/test-201-graph-refine-loop.cjs` still exits 0 (the lazy-load pattern was preserved,
   so the four `runGraphRefine(null, {...})` injection-style calls are unaffected).
3. `bash tests/run-all-236.sh` reports `FAIL=0 SKIP=0` with the new file auto-discovered.
4. The mutation proof ran in BOTH directions with captured output on disk.
5. `git diff --name-only -- lib scripts` lists exactly `lib/core/graph-refine-loop.cjs`.
6. `git diff --quiet -- lib/core/room-db.cjs lib/core/graph-derivation.cjs tests/run-all-236.sh
   tests/helpers tests/test-236-open-busy-detected.cjs` passes (nothing out of scope moved).
7. Zero em-dashes across both changed files.
8. No `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md` or `.planning/STATE.md` write.
</verification>

<success_criteria>
- The last Tier A swallow-to-null site from Phase 236's census is closed: a busy or broken room now
  propagates a typed error out of `runGraphRefine` instead of cold-starting on `db = null`.
- An absent room still opens successfully and refines normally. That path is byte-for-byte
  unchanged, and a test asserts it rather than assuming it.
- The fix is proven by an executed mutation whose RED and GREEN outputs are recorded in SUMMARY.md
  as evidence, not asserted by inspection.
- Exactly one production file and one new test file changed. No phase-tracking artifact touched.
</success_criteria>

<output>
Create `.planning/quick/260729-pnw-fix-swallow-to-null-bug-at-graph-refine-/260729-pnw-SUMMARY.md`
when done. It MUST include:
- the verbatim RED assertion line from the mutation run and the pass/fail counts of all three
  captured runs (green-before, red, green-after);
- the final `bash tests/run-all-236.sh` PASS/FAIL/SKIP line;
- the four Tier A census entries that remain deliberately out of scope;
- confirmation that the lazy `_roomDb()` pattern was preserved and no top-level require was added.
</output>

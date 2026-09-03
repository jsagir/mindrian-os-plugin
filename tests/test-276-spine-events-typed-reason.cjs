#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 276-02 (TOOLHON-10 / TOOLHON-11, C5) -- the typed-reason misreport proof.
 * =================================================================================
 *
 * WAVE 0 IS RED BY DESIGN. `spine-events.cjs`'s `_emit` catch block returns
 * `{ok:false, reason:'no_room_db'}` for an error that can only be busy or broken, after
 * `_hasRoomDb` has already proven the file exists via `fs.statSync(...).isFile()`. This file
 * proves the misreport TODAY, against the REAL module (never a stub), and pins the corrected
 * typed reasons (`room_db_busy`, `room_db_broken`) that plan 276-10 mints. Both are expected
 * to FAIL at the end of this plan; a red run at the end of Wave 0 is the CORRECT state.
 *
 * REUSE, NOT REINVENT: this file forks the SHIPPED Phase 236-03 lock holder
 * (tests/helpers/room-db-lock-holder-236.cjs). Do NOT author a second lock helper. Exit 2 =
 * could not open, exit 3 = could not acquire; a child that never actually locked the file can
 * never be mistaken for one that did.
 *
 * ASSUMPTION A11 RESOLVED (recorded here, then again in 276-02-SUMMARY.md as a measured
 * fact, per the plan's own requirement that A11 must not remain unverified after this plan):
 * `getCurrentJTBD` (spine-events.cjs:283) and `getCurrentOperator` (spine-events.cjs:315) do
 * NOT share the `{ok:false, reason:'no_room_db'}` swallow that `_emit` / `_emitWithOperatorEdge`
 * use. Read verbatim: both wrap `openRoomDb` plus a `findRecentChanges` query in a bare
 * `try { ... } catch (_e) { /* fall through to cache fallback *\/ }`, then unconditionally call
 * the JSON cache reader (`jtbdState.getCurrent` / `operator.getCurrent`) and return ITS result
 * (or `null` if the cache is also empty). This is a DIFFERENT, WORSE shape than `_emit`'s: it
 * never even produces the string `no_room_db` (so these two functions are absent from the
 * TOOLHON-11 run-time census below, which greps for that literal), and it silently degrades a
 * BUSY room with real event-log history to whatever the on-disk cache file says -- which, for
 * a room whose cache was never written (or was cleared), is `null`: byte-identical to a
 * genuine cold start. Assertion group D below proves this against a room with REAL history and
 * a deliberately absent cache.
 *
 * THE RUN-TIME CENSUS (TOOLHON-11) walks lib/, scripts/, bin/, hooks/ AT RUN TIME (excluding
 * node_modules and *.test.cjs) for the literal `reason: 'no_room_db'` (comments stripped
 * first, matching this repo's own frozen-count-literal hygiene rule), never from a frozen list
 * or a frozen count. Measured live while authoring this file: 35 producer sites (not the 27
 * 276-RESEARCH.md's own prose cites -- itself evidence for why the census must run at
 * execution time, not be trusted from a document). Each site is classified automatically:
 *   - the OVERWHELMING MAJORITY return `no_room_db` BEFORE any `openRoomDb(` call is even
 *     attempted (a cheap existence probe fails first), which is the honest case: the reason
 *     really is "there is no room.db here yet".
 *   - a SMALL, NAMED set (4 sites, measured live) return `no_room_db` FROM INSIDE A `catch`
 *     BLOCK THAT IMMEDIATELY FOLLOWS AN `openRoomDb(` CALL -- meaning the open was ATTEMPTED
 *     and FAILED for some reason the site never inspects. This is the exact disease TOOLHON-10
 *     targets. Two of the four are spine-events.cjs's own `_emit` and `_emitWithOperatorEdge`
 *     (this plan's C5 target). The OTHER TWO -- lib/core/breakthrough/scanner.cjs:124 and
 *     lib/core/navigation/lens-nodes.cjs:254 -- are a SIBLING instance of the identical defect
 *     shape (lens-nodes.cjs's own header comment literally says "mirrors spine-events"),
 *     discovered by this run-time census, OUT OF THIS PLAN'S FILE SCOPE (spine-events.cjs is
 *     the sole C5 target; files_modified declares only the two test files), and recorded here
 *     plus in 276-02-SUMMARY.md as a finding for a future plan rather than silently fixed
 *     out-of-scope.
 *
 * No em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fork } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

const REPO_ROOT = path.resolve(__dirname, '..');
const LOCK_HOLDER = path.join(__dirname, 'helpers', 'room-db-lock-holder-236.cjs');

const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const spineEvents = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'spine-events.cjs'));

let pass = 0;
let fail = 0;
const failMessages = [];

function check(label, cond, detail) {
  try {
    assert.ok(cond, label);
    pass += 1;
    process.stdout.write('  ok - ' + label + '\n');
  } catch (_e) {
    fail += 1;
    failMessages.push(label + (detail ? ' :: ' + detail : ''));
    process.stdout.write('  FAIL - ' + label + '\n');
    if (detail) process.stdout.write('    ' + String(detail) + '\n');
  }
}

function finish() {
  process.stdout.write('\n  ' + pass + ' passed, ' + fail + ' failed\n');
  if (fail > 0) {
    process.stdout.write('\nFailures:\n');
    for (const m of failMessages) process.stdout.write('  - ' + m + '\n');
  }
  process.exit(fail === 0 ? 0 : 1);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const scratchRoots = [];
function makeScratchRoom(label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), '276-spine-' + label + '-'));
  scratchRoots.push(root);
  return root;
}
function cleanup() {
  for (const root of scratchRoots) {
    try { fs.rmSync(root, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
}

function roomDbPath(roomDir) {
  return path.join(roomDir, '.mindrian', 'room.db');
}

// A fully migrated room via the real openRoomDb, so _hasRoomDb() is genuinely true and any
// further open failure is NOT an absence.
function seedFullRoom(roomDir) {
  const db = openRoomDb(roomDir);
  closeRoomDb(db);
}

// The Phase 236-03 identity-table sentinel whose removal gives the NEXT openRoomDb() call
// genuine write work (a real migration statement), so a contended open throws INSIDE
// openRoomDb() itself rather than succeeding cleanly. Reused verbatim from
// tests/test-236-open-busy-detected.cjs (PENDING_MIGRATION_SENTINEL), because THIS is what
// makes _emit's own catch block (spine-events.cjs:139-141, the actual C5 defect site) the one
// that fires. Verified live before writing this fixture: on a room whose schema is ALREADY
// fully migrated, `_emit`'s own `openRoomDb()` call does NOT throw under contention (every
// migration statement is an idempotent no-op CREATE-TABLE-IF-NOT-EXISTS / sentinel-guarded
// backfill, none of which need the write lock), so the busy error instead surfaces one call
// deeper, inside memoryEvents.logEvent's OWN internal catch (a DIFFERENT code path, returning
// the raw SQLite message rather than any `no_room_db`/`room_db_busy` reason at all). Deleting
// this sentinel is the only fixture shape that exercises the DESCRIBED C5 defect precisely.
function makePendingMigrationRoom(roomDir) {
  seedFullRoom(roomDir);
  const dbPath = roomDbPath(roomDir);
  const raw = new DatabaseSync(dbPath, { timeout: 0 });
  raw.prepare('DELETE FROM identity WHERE key = ?').run('phase_109_session_focus_v1');
  raw.close();
}

// Per room-db.cjs:252-257 (read verbatim in read_first): constructing a garbage-bytes file
// SUCCEEDS; corruption only surfaces at the `PRAGMA journal_mode = WAL` exec. So a broken room
// fixture must seed a REAL room first, then overwrite the main db file's bytes afterward, with
// the -wal/-shm sidecars removed so no stale WAL frames mask the corruption. Mirrors
// tests/test-236-open-busy-detected.cjs's own corrupt-room fixture exactly.
function makeBrokenRoom(roomDir) {
  seedFullRoom(roomDir);
  const dbPath = roomDbPath(roomDir);
  for (const suffix of ['-wal', '-shm']) {
    try { fs.unlinkSync(dbPath + suffix); } catch (_e) { /* absent */ }
  }
  fs.writeFileSync(dbPath, Buffer.alloc(8192, 0x5a));
}

// ---------------------------------------------------------------------------
// Lock holder plumbing (reused verbatim from tests/test-236-open-busy-detected.cjs)
// ---------------------------------------------------------------------------

function startLockHolder(roomDir) {
  return new Promise((resolve, reject) => {
    const child = fork(LOCK_HOLDER, [roomDir], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    let settled = false;
    child.on('message', (msg) => {
      if (msg && msg.ready && !settled) {
        settled = true;
        resolve({ child: child, mode: msg.mode });
      }
    });
    child.on('exit', (code) => {
      if (!settled) {
        settled = true;
        reject(new Error(
          'room-db-lock-holder-236 exited with code ' + code + ' before signalling ready: '
          + 'the lock was never held, so a busy result observed during this run cannot be trusted.'
        ));
      }
    });
  });
}

function stopLockHolder(handle) {
  return new Promise((resolve) => {
    if (!handle || !handle.child) return resolve();
    handle.child.on('exit', () => resolve());
    try { handle.child.send('release'); } catch (_e) { handle.child.kill(); }
  });
}

// ---------------------------------------------------------------------------
// Assertion group A: the busy path (real spine-events, real held lock)
// ---------------------------------------------------------------------------

async function runBusyAssertions() {
  console.log('\n-- Assertion group A: the busy path --');
  const roomBusy = makeScratchRoom('busy');
  makePendingMigrationRoom(roomBusy);

  // Independent, module-internal-check-free proof that the file genuinely exists, so this
  // assertion carries its own proof rather than relying on spine-events.cjs's own _hasRoomDb.
  const existsIndependently = fs.statSync(roomDbPath(roomBusy)).isFile();
  check(
    'independent fs.statSync(dbPath).isFile() proof: the busy room.db genuinely exists on disk '
    + 'before any spine-events call is made',
    existsIndependently === true
  );

  let holder = null;
  try {
    holder = await startLockHolder(roomBusy);
  } catch (e) {
    check('busy fixture: ' + e.message, false);
  }

  if (holder) {
    // Group A: the primary _emit site, via the exported logSpineRead.
    const result = spineEvents.logSpineRead(roomBusy, { surface: 'test-276', section: 'c5' });
    check(
      'logSpineRead(roomDir, payload) under a held foreign write lock returns '
      + "reason === 'room_db_busy' (the REAL, currently-observed reason is printed below)",
      !!result && result.ok === false && result.reason === 'room_db_busy',
      'ACTUAL reason=' + JSON.stringify(result && result.reason) + ' EXPECTED=room_db_busy full result=' + JSON.stringify(result)
    );
    check(
      "companion assertion: the reason is NOT 'no_room_db' while the file demonstrably exists "
      + '(independently confirmed above via fs.statSync, not via the module\'s own internal check)',
      !!result && result.reason !== 'no_room_db',
      'ACTUAL reason=' + JSON.stringify(result && result.reason)
    );

    // Group C: the second site, _emitWithOperatorEdge, reached via logOperatorTransition with
    // write_transition_edge:true (spine-events.cjs:203-207). Never a stub -- the same real
    // module, the same held lock.
    const opResult = spineEvents.logOperatorTransition(roomBusy, {
      from: 'analyst', to: 'strategist', write_transition_edge: true, trigger: 'test-276-c5',
    });
    check(
      'Assertion group C (second site): logOperatorTransition(..., write_transition_edge:true) '
      + "under a held lock routes through _emitWithOperatorEdge and returns "
      + "reason === 'room_db_busy' (the REAL, currently-observed reason is printed below)",
      !!opResult && opResult.ok === false && opResult.reason === 'room_db_busy',
      'ACTUAL reason=' + JSON.stringify(opResult && opResult.reason) + ' EXPECTED=room_db_busy full result=' + JSON.stringify(opResult)
    );

    await stopLockHolder(holder);
  }
}

// ---------------------------------------------------------------------------
// Assertion group B: the broken path
// ---------------------------------------------------------------------------

function runBrokenAssertions() {
  console.log('\n-- Assertion group B: the broken path --');
  const roomBroken = makeScratchRoom('broken');
  makeBrokenRoom(roomBroken);

  const result = spineEvents.logSpineRead(roomBroken, { surface: 'test-276', section: 'c5-broken' });
  check(
    'logSpineRead(roomDir, payload) against a room.db whose bytes are garbage (construction '
    + "succeeds, corruption surfaces at PRAGMA journal_mode = WAL) returns reason === "
    + "'room_db_broken' (the REAL, currently-observed reason is printed below)",
    !!result && result.ok === false && result.reason === 'room_db_broken',
    'ACTUAL reason=' + JSON.stringify(result && result.reason) + ' EXPECTED=room_db_broken full result=' + JSON.stringify(result)
  );
}

// ---------------------------------------------------------------------------
// Assertion group D: the two getters (RESEARCH A11)
// ---------------------------------------------------------------------------

async function runGetterAssertions() {
  console.log('\n-- Assertion group D: getCurrentJTBD / getCurrentOperator (RESEARCH A11) --');
  const roomHistory = makeScratchRoom('history');
  seedFullRoom(roomHistory);

  // Write REAL history via the real spine-events log*Transition helpers, BEFORE the lock is
  // held, so the room genuinely has a jtbd_transitioned and an operator_transitioned event on
  // record. This is the F-selector concern named in Phase 273: a room with real history must
  // not be reported as though it had none.
  const jtbdWrite = spineEvents.logJtbdTransition(roomHistory, { kind: 'primary', from: null, to: 'reduce-churn' });
  const operatorWrite = spineEvents.logOperatorTransition(roomHistory, { from: 'analyst', to: 'strategist' });
  check('fixture precondition: the history-seeding jtbd_transitioned write succeeded',
    !!jtbdWrite && jtbdWrite.ok === true, 'result=' + JSON.stringify(jtbdWrite));
  check('fixture precondition: the history-seeding operator_transitioned write succeeded',
    !!operatorWrite && operatorWrite.ok === true, 'result=' + JSON.stringify(operatorWrite));

  // Deliberately absent cache: log*Transition writes ONLY to room.db (never touches the
  // jtbd-state.json / conversation-operator.json cache files), so this scratch room's cache is
  // absent by construction. Confirmed independently rather than assumed.
  const jtbdCachePath = path.join(roomHistory, '.mindrian', 'jtbd-state.json');
  const operatorCachePath = path.join(roomHistory, '.mindrian', 'conversation-operator.json');
  check('fixture precondition: the JTBD JSON cache file is genuinely absent for this room '
    + '(so a fallback CANNOT accidentally supply a value)',
    !fs.existsSync(jtbdCachePath), 'path=' + jtbdCachePath);
  check('fixture precondition: the operator JSON cache file is genuinely absent for this room',
    !fs.existsSync(operatorCachePath), 'path=' + operatorCachePath);

  let holder = null;
  try {
    holder = await startLockHolder(roomHistory);
  } catch (e) {
    check('getter fixture: ' + e.message, false);
  }

  if (holder) {
    const jtbdUnderContention = spineEvents.getCurrentJTBD(roomHistory);
    const operatorUnderContention = spineEvents.getCurrentOperator(roomHistory);

    check(
      'CONTRACT: a busy room with REAL jtbd_transitioned history must not be reported as a '
      + 'room with no JTBD (getCurrentJTBD must not return null while a foreign write lock is '
      + 'held, since the room genuinely has history)',
      jtbdUnderContention !== null,
      'ACTUAL=' + JSON.stringify(jtbdUnderContention)
      + ' -- today this degrades through the bare catch to the (absent) cache fallback, which '
      + 'is byte-identical to a genuine cold start'
    );
    check(
      'CONTRACT: a busy room with REAL operator_transitioned history must not be reported as a '
      + 'room with no operator (getCurrentOperator must not return null while a foreign write '
      + 'lock is held, since the room genuinely has history)',
      operatorUnderContention !== null,
      'ACTUAL=' + JSON.stringify(operatorUnderContention)
    );

    await stopLockHolder(holder);
  }
}

// ---------------------------------------------------------------------------
// Assertion group E: the run-time no_room_db census (TOOLHON-11)
// ---------------------------------------------------------------------------

// Strips /* */ block comments (newlines preserved) and blanks full-line // or * comment
// lines, mirroring tests/test-ljj-tool-honesty.cjs's own frozen-count-literal hygiene idiom, so
// a comment mentioning the string cannot self-invalidate or inflate the count.
function maskComments(src) {
  let out = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  out = out.split('\n').map((line) => {
    if (/^\s*\/\//.test(line) || /^\s*\*/.test(line)) return '';
    return line;
  }).join('\n');
  return out;
}

function walkTree(dir, acc) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_e) {
    return;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkTree(full, acc);
      continue;
    }
    if (!/\.(cjs|js)$/.test(entry.name)) continue;
    if (/\.test\.cjs$/.test(entry.name)) continue;
    acc.push(full);
  }
}

const NO_ROOM_DB_RE = /reason:\s*['"]no_room_db['"]/g;
const OPEN_ROOM_DB_LITERAL = 'openRoomDb(';

// The small, named allowlist for sites the run-time heuristic flags as "returns no_room_db
// from inside a catch block that immediately follows an openRoomDb( call" -- meaning the open
// was ATTEMPTED and failed for a reason the site never inspects, which is the TOOLHON-10
// disease shape, not a genuine "the file is absent" report. Keyed by file + line (line, not
// just function name, because spine-events.cjs's two sites share one function name each with a
// SIBLING genuinely-guarded no_room_db return a few lines above, so line-level keys avoid
// collapsing a good site and a bad site under one key).
const CATCH_AFTER_OPEN_ALLOWLIST = {
  'lib/core/navigation/spine-events.cjs:141': 'This IS the C5 defect this plan proves: _emit\'s catch block after openRoomDb() throws returns no_room_db even though _hasRoomDb already confirmed the file exists two lines above. Plan 276-10 mints room_db_busy/room_db_broken here.',
  'lib/core/navigation/spine-events.cjs:222': 'This IS the C5 defect this plan proves: _emitWithOperatorEdge repeats the identical four-line catch shape byte-for-byte. Plan 276-10 mints room_db_busy/room_db_broken here too.',
  'lib/core/breakthrough/scanner.cjs:124': 'A SIBLING instance of the identical catch-after-openRoomDb defect shape, discovered by this run-time census. Out of this plan\'s file scope (spine-events.cjs is the sole C5 target); recorded as a finding for a future plan rather than silently fixed here.',
  'lib/core/navigation/lens-nodes.cjs:254': 'A SIBLING instance of the identical defect shape; its own header comment literally says "mirrors spine-events". Out of this plan\'s file scope; recorded as a finding for a future plan rather than silently fixed here.',
};

function runCensusAssertions() {
  console.log('\n-- Assertion group E: the run-time no_room_db census (TOOLHON-11) --');

  const roots = ['lib', 'scripts', 'bin', 'hooks'].map((d) => path.join(REPO_ROOT, d));
  const files = [];
  for (const r of roots) walkTree(r, files);

  const sites = [];
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    const masked = maskComments(src);
    const lines = masked.split('\n');
    NO_ROOM_DB_RE.lastIndex = 0;
    let m;
    while ((m = NO_ROOM_DB_RE.exec(masked)) !== null) {
      const before = masked.slice(0, m.index);
      const lineNo = before.split('\n').length;
      const winStart = Math.max(0, lineNo - 6);
      const window = lines.slice(winStart, lineNo).join('\n');
      const isCatchAfterOpen = window.indexOf(OPEN_ROOM_DB_LITERAL) !== -1 && /catch\s*\(/.test(window);
      sites.push({
        file: path.relative(REPO_ROOT, f).replace(/\\/g, '/'),
        line: lineNo,
        catchAfterOpen: isCatchAfterOpen,
      });
    }
  }

  // Print the total as INFORMATION, never as a gate (TOOLHON-11 requirement). No frozen count
  // literal is ever compared against this number.
  console.log('  MEASURED no_room_db producer sites at run time: ' + sites.length);
  for (const s of sites) {
    console.log('    ' + s.file + ':' + s.line + (s.catchAfterOpen ? '  [catch-after-open, needs allowlist entry]' : ''));
  }

  check(
    'run-time census discovered at least 1 no_room_db producer site (a zero-site result would '
    + 'mean the walk itself is broken, not that the codebase is clean)',
    sites.length > 0,
    'sites.length=' + sites.length
  );

  let unclassified = 0;
  for (const s of sites) {
    if (!s.catchAfterOpen) continue; // classification (a): genuinely guarded, no allowlist needed.
    const key = s.file + ':' + s.line;
    const reason = CATCH_AFTER_OPEN_ALLOWLIST[key];
    const ok = typeof reason === 'string' && reason.length >= 40;
    if (!ok) unclassified += 1;
    check(
      key + ' (classification b: catch-after-openRoomDb) is present in the in-test allowlist '
      + 'with a reason of at least 40 characters',
      ok,
      'reason=' + JSON.stringify(reason)
    );
  }
  check(
    'no run-time-discovered catch-after-openRoomDb site is missing from the allowlist (the '
    + 'propagation gap cannot silently regrow: a NEW unclassified site would fail here)',
    unclassified === 0,
    'unclassified=' + unclassified
  );
}

// ---------------------------------------------------------------------------
// Assertion group F: the safety argument (RESEARCH assumption A10)
// ---------------------------------------------------------------------------

function runSafetyArgumentAssertion() {
  console.log('\n-- Assertion group F: the safety argument (assumption A10) --');

  const roots = ['lib', 'scripts', 'bin', 'hooks'].map((d) => path.join(REPO_ROOT, d));
  const files = [];
  for (const r of roots) walkTree(r, files);

  const CONSUMER_RE = /===\s*['"]no_room_db['"]/g;
  let consumerCount = 0;
  const consumerSites = [];
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    const masked = maskComments(src);
    CONSUMER_RE.lastIndex = 0;
    let m;
    while ((m = CONSUMER_RE.exec(masked)) !== null) {
      const before = masked.slice(0, m.index);
      const lineNo = before.split('\n').length;
      consumerCount += 1;
      consumerSites.push(path.relative(REPO_ROOT, f).replace(/\\/g, '/') + ':' + lineNo);
    }
  }

  console.log('  MEASURED === \'no_room_db\' consumer (branching) sites at run time: ' + consumerCount);
  if (consumerSites.length > 0) console.log('    ' + consumerSites.join('\n    '));

  check(
    "ASSUMPTION A10: zero call sites across lib/, scripts/, bin/, hooks/ branch on "
    + "=== 'no_room_db' today, which is what makes the additive reason value safe to mint in "
    + "276-10 (RESEARCH:1061). Re-measured live here rather than trusted from the document, "
    + "per the plan's own instruction that this assumption must be re-verified at execution "
    + "time because it is the safety argument for the whole additive change.",
    consumerCount === 0,
    'consumerCount=' + consumerCount + ' sites=' + JSON.stringify(consumerSites)
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('test-276-spine-events-typed-reason (TOOLHON-10, TOOLHON-11, C5)');

  await runBusyAssertions();
  runBrokenAssertions();
  await runGetterAssertions();
  runCensusAssertions();
  runSafetyArgumentAssertion();

  cleanup();
  finish();
}

main().catch((e) => {
  cleanup();
  console.error('FAIL', e && e.stack ? e.stack : e);
  process.exit(1);
});

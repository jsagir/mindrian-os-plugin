'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355.1 Plan 05 Task 1 (RED) -- ambient run ledger, lock and
 * delta-state writer tests (AMB-04). scripts/scout-cadence-guard.cjs is
 * EXTENDED, not forked: this test pins runtime byte-identity of the
 * existing cadence functions (shouldFire/recordRun -- the static
 * "no removed line" leg is a separate git-diff check run in Task 2's own
 * <verify>, not repeated here) alongside every new ambient function's
 * behavior: no-re-run, in-flight, throttle, lock, stale reclaim,
 * quarantine, delta-state schema, watermark baseline, stamped-materials
 * bound and Part 8 closed-schema hygiene.
 *
 * House style (tests/test-3551-classify.cjs, tests/test-3551-framing.cjs):
 * hygiene-355 preamble first, a single injected `now` snapshot reused via
 * offsets (never a fresh Date.now() mid-leg) except the two stale-mtime
 * legs, which use fs.utimesSync against real file mtimes and a real
 * Date.now() baseline so the injected offsets and the filesystem's actual
 * clock agree. Hyphens only, no em-dashes.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const hygiene = require('./helpers/hygiene-355.cjs');
hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

// scout-cadence-guard.cjs's cadence functions read $HOME/.mindrian/scout-cadence/
// (Pitfall 8, 355.1-RESEARCH.md Pattern 4) -- set HOME to a mkdtemp dir
// BEFORE requiring the module, so this test never touches the operator's
// real cadence state.
const fakeHomeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-3551-ledger-home-'));
process.env.HOME = fakeHomeRoot;

const guard = require('../scripts/scout-cadence-guard.cjs');
const sensorRoomDelta = require('../lib/core/sensors/sensor-room-delta.cjs');
const directionConvention = require('../lib/core/direction-convention.cjs');
const { buildDeltaRoom, MARKER_PREFIX } = require('./helpers/fixture-room-3551.cjs');

const { check, summary } = hygiene.makeChecker('test-3551-ledger');

const NOW = Date.now();
const ONE_MIN = 60 * 1000;

const cleanupFns = [];
function tmpRoom(label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-3551-ledger-' + label + '-'));
  cleanupFns.push(function () {
    try { fs.rmSync(root, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  });
  return root;
}

function hex(label, len) {
  return crypto.createHash('sha256').update(String(label)).digest('hex').slice(0, len);
}

function freshWatermarks() {
  return {
    claims_created_at: 1000,
    artifacts_created_at: 2000,
    contradicts_keys: [hex('ck-a', 12), hex('ck-b', 12)],
    stage: hex('stage-a', 12),
    children: [hex('child-a', 12)],
  };
}

try {
  // ---------------------------------------------------------------------
  // Leg: cadence RUNTIME byte-identity (the static "no removed source
  // line" leg runs via git diff in Task 2's own <verify>, not here)
  // ---------------------------------------------------------------------
  {
    const room = tmpRoom('cadence');
    const rec = guard.recordRun(room);
    check('cadence recordRun succeeds', rec.recorded === true);
    const fire = guard.shouldFire(room, 24);
    check('cadence shouldFire false right after recordRun', fire.fire === false);
    const stateDir = guard.cadenceStateDir();
    const roomFiles = fs.readdirSync(stateDir).filter(function (f) {
      return f.indexOf(guard.roomHash(room)) !== -1;
    });
    check('cadence state dir holds exactly one file for this room', roomFiles.length === 1);
    const content = fs.readFileSync(path.join(stateDir, roomFiles[0]), 'utf8');
    const lines = content.split('\n').filter(function (l) { return l.length > 0; });
    check('cadence file holds one ISO line', lines.length === 1 && !Number.isNaN(Date.parse(lines[0])));
  }

  // ---------------------------------------------------------------------
  // Leg: fresh ledger
  // ---------------------------------------------------------------------
  {
    const room = tmpRoom('fresh');
    const read = guard.readAmbientLedger(room);
    check('fresh ledger not corrupt', read.corrupt === false);
    check('fresh ledger schema_version 1', read.ledger.schema_version === 1);
    check('fresh ledger origin ambient', read.ledger.origin === 'ambient');
    check('fresh ledger last_run null', read.ledger.last_run === null);
    check('fresh ledger last_delta_hash null', read.ledger.last_delta_hash === null);
    check('fresh ledger in_flight null', read.ledger.in_flight === null);
    check('fresh ledger runs_window.count 0', read.ledger.runs_window.count === 0);
    check('fresh ledger surfaced_via null', read.ledger.surfaced_via === null);
    check('fresh ledger last_closeout_at null', read.ledger.last_closeout_at === null);
    check('fresh ledger every watermark field null', Object.keys(read.ledger.watermarks).every(function (k) {
      return read.ledger.watermarks[k] === null;
    }));
    check('fresh ledger validates', guard.validateAmbientLedger(read.ledger) === true);
  }

  // ---------------------------------------------------------------------
  // Leg: shouldRunAmbient / claimAmbientRun / recordAmbientRun / same_hash / in_flight
  // ---------------------------------------------------------------------
  {
    const room = tmpRoom('flow');
    const H1 = hex('delta-1', 64);
    const H2 = hex('delta-2', 64);
    const wm = freshWatermarks();

    const first = guard.shouldRunAmbient(room, H1, { now: NOW });
    check('fresh ledger shouldRunAmbient ok', first.run === true && first.reason === 'ok');

    const claim = guard.claimAmbientRun(room, { deltaHash: H1, watermarks: wm, seam: 'stop_hook', now: NOW });
    check('claim succeeds', claim.claimed === true);

    const duringH1 = guard.shouldRunAmbient(room, H1, { now: NOW + ONE_MIN });
    check('in_flight blocks the same hash', duringH1.run === false && duringH1.reason === 'in_flight');
    const duringH2 = guard.shouldRunAmbient(room, H2, { now: NOW + ONE_MIN });
    check('in_flight blocks a different hash too', duringH2.run === false && duringH2.reason === 'in_flight');

    const record = guard.recordAmbientRun(room, {
      deltaHash: H1,
      producers: { eureka: { outcome: 'filed', posture: 'run' } },
      tierCounts: { strong: 1, indirect: 0, unverified: 0 },
      surfacedVia: 'none',
      now: NOW + 2 * ONE_MIN,
    });
    check('record succeeds', record.recorded === true);
    check('record clears in_flight', record.ledger.in_flight === null);
    check('record sets last_delta_hash', record.ledger.last_delta_hash === H1);
    check('record watermarks equal the claimed watermarks', JSON.stringify(record.ledger.watermarks) === JSON.stringify(wm));

    const afterRecord = guard.shouldRunAmbient(room, H1, { now: NOW + 3 * ONE_MIN });
    check('same_hash never re-runs', afterRecord.run === false && afterRecord.reason === 'same_hash');
  }

  // ---------------------------------------------------------------------
  // Leg: throttle
  // ---------------------------------------------------------------------
  {
    const room = tmpRoom('throttle');
    const H1 = hex('t-delta-1', 64);
    const H2 = hex('t-delta-2', 64);
    guard.claimAmbientRun(room, { deltaHash: H1, watermarks: freshWatermarks(), seam: 'stop_hook', now: NOW });
    guard.recordAmbientRun(room, {
      deltaHash: H1,
      producers: {},
      tierCounts: { strong: 0, indirect: 0, unverified: 0 },
      surfacedVia: 'none',
      now: NOW,
    });

    const soon = guard.shouldRunAmbient(room, H2, { now: NOW + 10 * ONE_MIN });
    check('throttled within the hour', soon.run === false && soon.reason === 'throttled');

    const later = guard.shouldRunAmbient(room, H2, { now: NOW + 61 * ONE_MIN });
    check('runs_window restarts after 61 minutes', later.run === true && later.reason === 'ok');
  }

  // ---------------------------------------------------------------------
  // Leg: stale in-flight no longer blocks
  // ---------------------------------------------------------------------
  {
    const room = tmpRoom('stale-inflight');
    const H1 = hex('si-delta-1', 64);
    const H2 = hex('si-delta-2', 64);
    guard.claimAmbientRun(room, { deltaHash: H1, watermarks: freshWatermarks(), seam: 'stop_hook', now: NOW });
    const stale = guard.shouldRunAmbient(room, H2, { now: NOW + guard.AMBIENT_LOCK_STALE_MS + ONE_MIN });
    check('a stale in-flight claim no longer blocks', stale.reason !== 'in_flight');
  }

  // ---------------------------------------------------------------------
  // Leg: releaseAmbientClaim
  // ---------------------------------------------------------------------
  {
    const room = tmpRoom('release');
    const H1 = hex('r-delta-1', 64);
    const H2 = hex('r-delta-2', 64);
    guard.claimAmbientRun(room, { deltaHash: H1, watermarks: freshWatermarks(), seam: 'stop_hook', now: NOW });
    const wrongRelease = guard.releaseAmbientClaim(room, H2);
    check('release with the wrong hash leaves in_flight', wrongRelease.released === false);
    check('in_flight still present after a wrong-hash release', guard.readAmbientLedger(room).ledger.in_flight !== null);
    const rightRelease = guard.releaseAmbientClaim(room, H1);
    check('release with a matching hash clears in_flight', rightRelease.released === true);
    check('in_flight cleared after a matching release', guard.readAmbientLedger(room).ledger.in_flight === null);
  }

  // ---------------------------------------------------------------------
  // Leg: lock (acquire, held, release, stale reclaim)
  // ---------------------------------------------------------------------
  {
    const room = tmpRoom('lock');
    const lockPath = path.join(room, '.mindrian', 'ambient-run.lock');

    const first = guard.acquireAmbientLock(room, { now: NOW });
    check('first lock acquire succeeds', first.ok === true);
    const second = guard.acquireAmbientLock(room, { now: NOW + ONE_MIN });
    check('second lock acquire is held', second.ok === false && second.reason === 'held');
    const release = guard.releaseAmbientLock(room);
    check('release succeeds', release.ok === true);
    check('lock file gone after release', fs.existsSync(lockPath) === false);
    const third = guard.acquireAmbientLock(room, { now: NOW + 2 * ONE_MIN });
    check('acquire after release succeeds', third.ok === true);

    // Stale reclaim: backdate the lock's real mtime via fs.utimesSync (the
    // one legitimate real-clock leg the plan's read_first names), using a
    // real Date.now() baseline so the file's real mtime and the injected
    // `now` agree.
    const realNow = Date.now();
    const staleAgo = new Date(realNow - guard.AMBIENT_LOCK_STALE_MS - ONE_MIN);
    fs.utimesSync(lockPath, staleAgo, staleAgo);
    const reclaim = guard.acquireAmbientLock(room, { now: realNow });
    check('a stale lock is reclaimed', reclaim.ok === true && reclaim.reclaimed === true);
    guard.releaseAmbientLock(room);
  }

  // ---------------------------------------------------------------------
  // Leg: shouldRunAmbient returns 'locked' while a fresh lock file exists
  // ---------------------------------------------------------------------
  {
    const room = tmpRoom('should-locked');
    const H1 = hex('sl-delta-1', 64);
    const realNow = Date.now();
    guard.acquireAmbientLock(room, { now: realNow });
    const res = guard.shouldRunAmbient(room, H1, { now: realNow });
    check('shouldRunAmbient sees a fresh lock', res.run === false && res.reason === 'locked');
    guard.releaseAmbientLock(room);
  }

  // ---------------------------------------------------------------------
  // Leg: corrupt ledger fails closed and self-heals by quarantine
  // ---------------------------------------------------------------------
  function corruptCase(label, writeFn) {
    const room = tmpRoom('corrupt-' + label);
    const ledgerPath = path.join(room, '.mindrian', 'ambient-run-ledger.json');
    fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
    writeFn(ledgerPath);
    const H1 = hex('c-delta-' + label, 64);
    const res = guard.shouldRunAmbient(room, H1, { now: NOW });
    check('corrupt ledger (' + label + ') fails closed', res.run === false && res.reason === 'ledger_corrupt');
    const dirEntries = fs.readdirSync(path.join(room, '.mindrian'));
    const quarantined = dirEntries.some(function (f) { return f.indexOf('ambient-run-ledger.json.corrupt.') === 0; });
    check('corrupt ledger (' + label + ') quarantined by rename', quarantined === true);
    const next = guard.shouldRunAmbient(room, H1, { now: NOW });
    check('corrupt ledger (' + label + ') next evaluation starts fresh (ok)', next.run === true && next.reason === 'ok');
  }
  corruptCase('invalid-json', function (p) { fs.writeFileSync(p, '{ not valid json', 'utf8'); });
  corruptCase('extra-key', function (p) {
    const fresh = guard.readAmbientLedger(path.join(os.tmpdir(), 'mos-3551-template-does-not-exist')).ledger;
    const bad = Object.assign({}, fresh, { rogue_extra_key: 'x' });
    fs.writeFileSync(p, JSON.stringify(bad), 'utf8');
  });
  corruptCase('bad-producer-outcome', function (p) {
    const fresh = guard.readAmbientLedger(path.join(os.tmpdir(), 'mos-3551-template-does-not-exist')).ledger;
    const bad = Object.assign({}, fresh, { producers: { eureka: { outcome: 'not_a_real_outcome', posture: 'run' } } });
    fs.writeFileSync(p, JSON.stringify(bad), 'utf8');
  });

  // ---------------------------------------------------------------------
  // Leg: recordAmbientBaseline -- fills only still-null watermark fields
  // ---------------------------------------------------------------------
  {
    const room = tmpRoom('baseline');
    const first = guard.recordAmbientBaseline(room, {
      watermarks: { contradicts_keys: [hex('bk-a', 12)], stage: hex('bstage', 12), children: [hex('bc-a', 12)] },
    });
    check('baseline first call succeeds', first.ok === true);
    check('baseline fills contradicts_keys', JSON.stringify(first.ledger.watermarks.contradicts_keys) === JSON.stringify([hex('bk-a', 12)]));
    check('baseline fills stage', first.ledger.watermarks.stage === hex('bstage', 12));
    check('baseline fills children', JSON.stringify(first.ledger.watermarks.children) === JSON.stringify([hex('bc-a', 12)]));
    check('baseline never touches claims_created_at', first.ledger.watermarks.claims_created_at === null);
    check('baseline never touches artifacts_created_at', first.ledger.watermarks.artifacts_created_at === null);
    check('baseline never touches last_run', first.ledger.last_run === null);
    check('baseline never touches last_delta_hash', first.ledger.last_delta_hash === null);
    check('baseline never touches runs_window', first.ledger.runs_window.count === 0);

    const second = guard.recordAmbientBaseline(room, {
      watermarks: { contradicts_keys: [hex('different', 12)], stage: hex('different-stage', 12), children: [hex('different-child', 12)] },
    });
    check('second baseline call changes nothing already set (contradicts_keys)', JSON.stringify(second.ledger.watermarks.contradicts_keys) === JSON.stringify([hex('bk-a', 12)]));
    check('second baseline call changes nothing already set (stage)', second.ledger.watermarks.stage === hex('bstage', 12));
    check('second baseline call changes nothing already set (children)', JSON.stringify(second.ledger.watermarks.children) === JSON.stringify([hex('bc-a', 12)]));
  }

  // ---------------------------------------------------------------------
  // Leg: stamped_materials bound (oldest dropped) + recordAmbientCloseout
  // ---------------------------------------------------------------------
  {
    const room = tmpRoom('stamped');
    const total = guard.STAMPED_MATERIALS_MAX + 5;
    for (let i = 0; i < total; i += 1) {
      const deltaHash = hex('sd-' + i, 64);
      guard.claimAmbientRun(room, { deltaHash: deltaHash, watermarks: freshWatermarks(), seam: 'material', now: NOW + i });
      guard.recordAmbientRun(room, {
        deltaHash: deltaHash,
        producers: {},
        tierCounts: { strong: 0, indirect: 0, unverified: 0 },
        surfacedVia: 'sens13',
        materialId: hex('material-' + i, 32),
        now: NOW + i,
      });
    }
    const finalLedger = guard.readAmbientLedger(room).ledger;
    check('stamped_materials never exceeds STAMPED_MATERIALS_MAX', finalLedger.stamped_materials.length === guard.STAMPED_MATERIALS_MAX);
    check('stamped_materials keeps the newest entry', finalLedger.stamped_materials[finalLedger.stamped_materials.length - 1] === hex('material-' + (total - 1), 32));
    check('stamped_materials drops the oldest entry', finalLedger.stamped_materials.indexOf(hex('material-0', 32)) === -1);

    const beforeLastRun = finalLedger.last_run;
    const closeout = guard.recordAmbientCloseout(room, { now: NOW + 999 });
    check('closeout succeeds', closeout.ok === true);
    check('closeout sets last_closeout_at', closeout.ledger.last_closeout_at === new Date(NOW + 999).toISOString());
    check('closeout does not touch last_run', closeout.ledger.last_run === beforeLastRun);
  }

  // ---------------------------------------------------------------------
  // Leg: delta-state writer (accept valid, reject + write-nothing on invalid)
  // ---------------------------------------------------------------------
  {
    const room = tmpRoom('delta-state');
    const validState = {
      schema_version: sensorRoomDelta.DELTA_STATE_SCHEMA_VERSION,
      evaluated_at: new Date(NOW).toISOString(),
      seam: 'stop_hook',
      classes: ['a', 'e'],
      delta_hash: hex('ds-valid', 64),
      run_state: 'completed',
      material_id: hex('ds-material', 32),
      opportunity_handle: 'opp:abc_123.x-9',
      surfaced_via: 'sens13',
      framing: directionConvention.FRAMING_IDS[0],
    };
    const wrote = guard.writeRoomDeltaState(room, validState);
    check('a valid delta-state writes', wrote.ok === true);
    const readBack = guard.readRoomDeltaState(room);
    check('read returns the written state', JSON.stringify(readBack) === JSON.stringify(validState));
    const dirEntries = fs.readdirSync(path.join(room, '.mindrian'));
    check('no .tmp leftovers after a valid write', dirEntries.every(function (f) { return f.indexOf('.tmp.') === -1; }));

    function rejectCase(label, mutate) {
      const room2 = tmpRoom('delta-state-reject-' + label);
      const bad = Object.assign({}, validState, mutate);
      const res = guard.writeRoomDeltaState(room2, bad);
      check('delta-state rejects ' + label, res.ok === false && typeof res.reason === 'string');
      check('delta-state (' + label + ') writes nothing', fs.existsSync(path.join(room2, '.mindrian', 'last-room-delta.json')) === false);
      const partialDir = path.join(room2, '.mindrian');
      const entries = fs.existsSync(partialDir) ? fs.readdirSync(partialDir) : [];
      check('delta-state (' + label + ') leaves no .tmp leftovers', entries.every(function (f) { return f.indexOf('.tmp.') === -1; }));
    }
    rejectCase('an-extra-key', { rogue_extra_key: true });
    rejectCase('run_state bogus', { run_state: 'bogus' });
    rejectCase('framing praise', { framing: 'praise' });
    rejectCase('a classes member z', { classes: ['z'] });
    rejectCase('unsorted classes', { classes: ['e', 'a'] });
    rejectCase('a non-hex material_id', { material_id: 'zz-not-hex!' });
    rejectCase('an opportunity_handle with a space', { opportunity_handle: 'has a space' });
    rejectCase('a 63-char delta_hash', { delta_hash: hex('short', 64).slice(0, 63) });
  }

  // ---------------------------------------------------------------------
  // Leg: Part 8 -- a full claim/record/close-out/delta-state cycle on a
  // buildDeltaRoom room carries no SECRET-3551 marker, no room slug, and no
  // path separator (the files hold no paths at all).
  // ---------------------------------------------------------------------
  {
    const fixture = buildDeltaRoom('ledger-part8');
    try {
      fixture.addClaims(6);
      const deltaHash = hex('part8-delta', 64);
      guard.claimAmbientRun(fixture.roomDir, { deltaHash: deltaHash, watermarks: freshWatermarks(), seam: 'stop_hook', now: NOW });
      guard.recordAmbientRun(fixture.roomDir, {
        deltaHash: deltaHash,
        producers: { eureka: { outcome: 'filed', posture: 'run' } },
        tierCounts: { strong: 1, indirect: 0, unverified: 0 },
        surfacedVia: 'sens13',
        materialId: hex('part8-material', 32),
        now: NOW,
      });
      guard.recordAmbientCloseout(fixture.roomDir, { now: NOW });
      guard.writeRoomDeltaState(fixture.roomDir, {
        schema_version: sensorRoomDelta.DELTA_STATE_SCHEMA_VERSION,
        evaluated_at: new Date(NOW).toISOString(),
        seam: 'stop_hook',
        classes: ['a'],
        delta_hash: deltaHash,
        run_state: 'completed',
        material_id: null,
        opportunity_handle: null,
        surfaced_via: 'sens13',
        framing: directionConvention.FRAMING_IDS[0],
      });

      const ledgerBytes = fs.readFileSync(path.join(fixture.roomDir, '.mindrian', 'ambient-run-ledger.json'), 'utf8');
      const deltaBytes = fs.readFileSync(path.join(fixture.roomDir, '.mindrian', 'last-room-delta.json'), 'utf8');
      const combined = ledgerBytes + '\n' + deltaBytes;
      check('Part 8: no SECRET-3551 marker in the ledger or delta-state files', combined.indexOf(MARKER_PREFIX) === -1);
      check('Part 8: no room slug in the ledger or delta-state files', combined.indexOf(fixture.slug) === -1);
      check('Part 8: no path separator in the ledger or delta-state files', combined.indexOf('/') === -1);
    } finally {
      fixture.cleanup();
    }
  }

  // ---------------------------------------------------------------------
  // Leg: static -- the NEW AMB-04 section carries no require('zod'), no
  // fetch(, no node:sqlite (the file's pre-existing HARD-02 safe-auto-fire
  // check legitimately requires node:sqlite outside this section -- scoped
  // to match Task 1's own behavior line and the docblock's Part 8 intent).
  // ---------------------------------------------------------------------
  {
    const srcPath = path.join(__dirname, '..', 'scripts', 'scout-cadence-guard.cjs');
    const src = fs.readFileSync(srcPath, 'utf8');
    const marker = 'Phase 355.1 AMB-04';
    const idx = src.indexOf(marker);
    check('the AMB-04 section marker exists', idx !== -1);
    const newSection = idx !== -1 ? src.slice(idx) : '';
    const nonCommentNew = newSection.split('\n').filter(function (l) { return !hygiene.isPureLineComment(l); }).join('\n');
    check('no zod require in the new section', /require\(\s*['"]zod['"]\s*\)/.test(nonCommentNew) === false);
    check('no fetch( in the new section', /fetch\(/.test(nonCommentNew) === false);
    check('no node:sqlite in the new section', /node:sqlite/.test(nonCommentNew) === false);
  }

  check('no network attempted (hygiene-355 installNetGuard)', netGuard.attempts() === 0);
} finally {
  for (const fn of cleanupFns) fn();
  netGuard.restore();
}

process.exit(summary());

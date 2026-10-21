#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 379.1 (graph derive drain and scout runaway CPU) proof: doctor-check.
 * Proves CPU379-07: the graph-derive-health doctor module reports queue entries older than
 * 7 days, locks with a dead PID, a live lock with a stale heartbeat (a recycled pid or a
 * runaway worker, told apart by process identity), and an overbroad or invalid artifact scope
 * declaration with its counts. Its fix removes only dead or recycled locks and drops an
 * abandoned entry with a permanent record.
 * Shape: tests/test-233-graph-derive-health.cjs (real room.db, real files, scratch registry).
 * Hermetic: MINDRIAN_ROOMS_HOME and HOME point at scratch dirs for every spawn and in-process
 * call; scrubVendorKey + installNetGuard first; attempts() === 0 last. No em-dashes.
 */
const { scrubVendorKey, installNetGuard } = require('./helpers/hygiene-355.cjs');
scrubVendorKey();
const netGuard = installNetGuard();

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, fork } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const DOCTOR = path.join(REPO, 'scripts', 'doctor.cjs');
const HOLDER = path.join(REPO, 'tests', 'helpers', 'job-lock-holder-379.cjs');

const roomDb = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO, 'lib', 'core', 'navigation.cjs'));
const healthMod = require(path.join(REPO, 'lib', 'core', 'doctor', 'graph-derive-health-module.cjs'));
const jobLock = require(path.join(REPO, 'lib', 'core', 'job-lock.cjs'));
const { pidStartTicks, currentBootMs } = jobLock._test;

const IS_LINUX = process.platform === 'linux';
const DAY = 86400000;

let pass = 0;
let fail = 0;
async function t(label, fn) {
  try {
    await fn();
    pass += 1;
    console.log('  ok - ' + label);
  } catch (e) {
    fail += 1;
    process.exitCode = 1;
    console.log('  FAIL - ' + label + ': ' + (e && e.message ? e.message : e));
  }
}

const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-379-1-doctor-'));
let seq = 0;

function scratchDir(name) {
  seq += 1;
  const d = path.join(SCRATCH, name + '-' + seq);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

// A room with a real migrated room.db carrying one BELONGS_TO and one cascade edge, so the
// room is healthy for the 233 ladder and every finding below comes from the new checks.
function seedRoom(roomDir, opts) {
  const o = opts || {};
  fs.mkdirSync(roomDir, { recursive: true });
  const db = roomDb.openRoomDb(roomDir);
  try {
    db.prepare('INSERT INTO edges (source, target, type) VALUES (?, ?, ?) ON CONFLICT DO NOTHING')
      .run('n0', 'section0', 'BELONGS_TO');
    if (o.cascade !== false) {
      const r = navigation.writeEdge(db, { source_id: 'n1', target_id: 'n2', edge_type: 'INFORMS', properties: {} });
      assert.equal(r.ok, true, 'seed cascade edge: ' + JSON.stringify(r));
    }
  } finally {
    roomDb.closeRoomDb(db);
  }
  return roomDir;
}

function mdBody(label) {
  return '# ' + label + '\n\nBody text for ' + label + ' long enough to count as an artifact in any walker here.\n';
}

function writeSections(roomDir, layout) {
  for (const rel of Object.keys(layout)) {
    const dir = path.join(roomDir, rel);
    fs.mkdirSync(dir, { recursive: true });
    for (const name of layout[rel]) fs.writeFileSync(path.join(dir, name), mdBody(name), 'utf8');
  }
}

function queueFile(roomDir) { return path.join(roomDir, '.mindrian', 'graph-derive-queue.json'); }
function failureFile(roomDir) { return path.join(roomDir, '.mindrian', 'graph-derive-failures.json'); }
function drainLock(roomDir) { return path.join(roomDir, '.mindrian', 'graph-derive-drain.lock'); }
function scoutLock(roomDir) { return path.join(roomDir, '.mindrian', 'scout-cadence.lock'); }

function writeQueue(roomDir, entries) {
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  fs.writeFileSync(queueFile(roomDir), JSON.stringify({ entries }, null, 2), 'utf8');
}

function readQueue(roomDir) {
  try { return JSON.parse(fs.readFileSync(queueFile(roomDir), 'utf8')); } catch (_e) { return null; }
}

function daysAgo(n) { return new Date(Date.now() - n * DAY).toISOString(); }

function writeLockPayload(file, overrides) {
  const payload = Object.assign({
    pid: process.pid,
    pid_start: pidStartTicks(process.pid),
    started_at: new Date().toISOString(),
    heartbeat_at: Date.now(),
    boot_ms: currentBootMs(),
    job: 'test-379-doctor',
    schema: 'job-lock-v1',
  }, overrides || {});
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(payload), 'utf8');
}

function onceMessage(child) {
  return new Promise((resolve, reject) => {
    child.once('message', resolve);
    child.once('error', reject);
  });
}
function onceExit(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null) { resolve(child.exitCode); return; }
    child.once('exit', (code) => resolve(code));
  });
}

// A lock left by a real process that exited without releasing it: a dead pid on disk.
async function leaveDeadLock(file) {
  const child = fork(HOLDER, [file, 'crash', '0']);
  const msg = await onceMessage(child);
  assert.equal(msg.acquired, true, 'the crash holder acquired');
  await onceExit(child);
  assert.equal(fs.existsSync(file), true, 'the dead holder left its lock');
  return msg.pid;
}

function fixRoom(roomDir, dryRun) {
  const h = healthMod.detectRoomHealth(roomDir);
  const entry = Object.assign({ room: 'r', roomPath: roomDir }, h);
  return healthMod.fix({ flags: {}, dryRun: !!dryRun, encoderPresent: false, check_result: { rooms: [entry] } });
}

function makeScratchPluginHome(scratch) {
  const version = JSON.parse(fs.readFileSync(path.join(REPO, '.claude-plugin', 'plugin.json'), 'utf8')).version;
  const home = path.join(scratch, '.scratch-home');
  const stamp = JSON.stringify({ name: 'mindrian-os', version });
  const installDir = path.join(home, '.claude', 'plugins', 'mindrian-os', '.claude-plugin');
  const cacheDir = path.join(home, '.claude', 'plugins', 'cache', 'mindrian-marketplace', 'mos', version, '.claude-plugin');
  fs.mkdirSync(installDir, { recursive: true });
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(path.join(installDir, 'plugin.json'), stamp);
  fs.writeFileSync(path.join(cacheDir, 'plugin.json'), stamp);
  return home;
}

function runDoctor(scratch, args) {
  const res = spawnSync('node', [DOCTOR].concat(args), {
    encoding: 'utf8',
    timeout: 60000,
    env: Object.assign({}, process.env, {
      MINDRIAN_ROOMS_HOME: scratch,
      HOME: makeScratchPluginHome(scratch),
      MOS_NO_COLOR: '1',
    }),
  });
  return { stdout: res.stdout || '', stderr: res.stderr || '', status: res.status };
}

async function main() {
  console.log('test-379.1-doctor-check (CPU379-07)');
  try {
    await t('(1) an 8-day entry is abandoned (and stuck); a 4-day entry is stuck but not abandoned', () => {
      const room = seedRoom(scratchDir('r1'));
      writeQueue(room, [{ roomDir: room, enqueued_at: daysAgo(8) }]);
      const h = healthMod.detectRoomHealth(room);
      assert.equal(h.queueAbandonedCount, 1);
      assert.equal(h.queueStuckCount, 1);
      assert.equal(h.status, 'warn');
      assert.ok(h.reasons.some((r) => /abandoned for more than 7 day/.test(r)), JSON.stringify(h.reasons));
      const room2 = seedRoom(scratchDir('r1b'));
      writeQueue(room2, [{ roomDir: room2, enqueued_at: daysAgo(4) }]);
      const h2 = healthMod.detectRoomHealth(room2);
      assert.equal(h2.queueStuckCount, 1);
      assert.equal(h2.queueAbandonedCount, 0);
      assert.ok(!h2.reasons.some((r) => /abandoned/.test(r)));
      assert.equal(healthMod.QUEUE_ABANDONED_DAYS, 7);
    });

    await t('(2) a dead-pid drain lock is reported; a bare-integer legacy file is reported as legacy', async () => {
      const room = seedRoom(scratchDir('r2'));
      const pid = await leaveDeadLock(drainLock(room));
      const h = healthMod.detectRoomHealth(room);
      assert.equal(h.locks.drain.present, true);
      assert.equal(h.locks.drain.alive, false);
      assert.ok(h.reasons.some((r) => r === 'drain lock held by dead pid ' + pid), JSON.stringify(h.reasons));
      assert.equal(h.status, 'warn');
      const legacyRoom = seedRoom(scratchDir('r2b'));
      fs.writeFileSync(drainLock(legacyRoom), String(process.pid), 'utf8');
      const hl = healthMod.detectRoomHealth(legacyRoom);
      assert.equal(hl.locks.drain.legacy_bare_pid, true);
      assert.ok(hl.reasons.some((r) => /legacy bare pid file/.test(r)), JSON.stringify(hl.reasons));
      const scoutDead = seedRoom(scratchDir('r2c'));
      const spid = await leaveDeadLock(scoutLock(scoutDead));
      const hs = healthMod.detectRoomHealth(scoutDead);
      assert.ok(hs.reasons.some((r) => r === 'scout lock held by dead pid ' + spid), JSON.stringify(hs.reasons));
    });

    await t('(2b) the doctor lock names match the paths the drain and the scout runner use', () => {
      const room = path.resolve(scratchDir('r2d'));
      const p = healthMod._test.lockPathsFor(room);
      const drain = require(path.join(REPO, 'scripts', 'gsd-graph-derive-drain.cjs'));
      const runner = require(path.join(REPO, 'scripts', 'scout-cadence-runner.cjs'));
      assert.equal(p.drain, drain._test.drainLockPath(room));
      assert.equal(p.scout, runner._test.lockPathFor(room));
    });

    await t('(3) a lock held by a live forked holder is alive, gives no dead-pid reason, and fix leaves it', async () => {
      const room = seedRoom(scratchDir('r3'));
      const child = fork(HOLDER, [drainLock(room), 'hold', '8000']);
      try {
        const msg = await onceMessage(child);
        assert.equal(msg.acquired, true);
        const h = healthMod.detectRoomHealth(room);
        assert.equal(h.locks.drain.alive, true);
        assert.equal(h.locks.drain.pid, msg.pid);
        assert.ok(!h.reasons.some((r) => /dead pid/.test(r)), JSON.stringify(h.reasons));
        const res = fixRoom(room, false);
        assert.equal(res.locks_removed, 0);
        assert.equal(fs.existsSync(drainLock(room)), true, 'the live lock stays');
        assert.equal(jobLock.read(drainLock(room)).pid, msg.pid);
      } finally {
        child.kill();
        await onceExit(child);
      }
    });

    await t('(4) fix: dryRun projects and writes nothing; a real fix removes the dead lock and drops the 8-day entry with one permanent record', async () => {
      const room = seedRoom(scratchDir('r4'));
      await leaveDeadLock(drainLock(room));
      writeQueue(room, [{ roomDir: room, enqueued_at: daysAgo(8), filePath: path.join(room, 'sec', 'a.md') }]);
      const queueBefore = fs.readFileSync(queueFile(room), 'utf8');
      const dry = fixRoom(room, true);
      assert.ok(dry.recoveries.some((r) => r.status === 'projected' && /lock/.test(r.detail)), JSON.stringify(dry.recoveries));
      assert.ok(dry.recoveries.some((r) => r.status === 'projected' && /abandoned/.test(r.detail)), JSON.stringify(dry.recoveries));
      assert.equal(fs.existsSync(drainLock(room)), true, 'dryRun kept the lock');
      assert.equal(fs.readFileSync(queueFile(room), 'utf8'), queueBefore, 'dryRun kept the queue bytes');
      assert.equal(fs.existsSync(failureFile(room)), false, 'dryRun wrote no failure record');

      const real = fixRoom(room, false);
      assert.equal(real.errors.length, 0, JSON.stringify(real.errors));
      assert.equal(real.locks_removed, 1);
      assert.equal(real.abandoned_dropped, 1);
      assert.equal(fs.existsSync(drainLock(room)), false, 'the dead lock is gone');
      assert.deepEqual(readQueue(room).entries, [], 'the abandoned entry is dropped');
      const log = JSON.parse(fs.readFileSync(failureFile(room), 'utf8'));
      assert.equal(log.failures.length, 1);
      assert.equal(log.failures[0].error, 'abandoned_by_doctor');
      assert.equal(log.failures[0].permanent, true);
      assert.equal(log.failures[0].filePath, 'a.md', 'the record keeps the base name only');
      const after = healthMod.detectRoomHealth(room);
      assert.equal(after.queueAbandonedCount, 0);
      assert.equal(after.locks.drain.present, false);
    });

    await t('(4b) fix does not re-enqueue a room whose only stuck entry was abandoned', () => {
      const room = seedRoom(scratchDir('r4b'));
      writeQueue(room, [{ roomDir: room, enqueued_at: daysAgo(9) }]);
      const res = fixRoom(room, false);
      assert.equal(res.healed, 0);
      assert.equal(res.abandoned_dropped, 1);
      assert.deepEqual(readQueue(room).entries, []);
    });

    await t('(5) a malformed artifact-scope declaration gives the invalid-declaration reason', () => {
      const room = seedRoom(scratchDir('r5'));
      fs.writeFileSync(path.join(room, '.mindrian', 'artifact-scope.json'), '{ not json', 'utf8');
      const h = healthMod.detectRoomHealth(room);
      assert.equal(h.artifact_scope.declared, true);
      assert.equal(h.artifact_scope.parse_error, true);
      assert.ok(h.reasons.some((r) => r === 'artifact scope declaration is invalid'), JSON.stringify(h.reasons));
      assert.equal(h.status, 'warn');
    });

    await t('(6) the module block of doctor --graph-derive-health --json is byte-identical on two runs', () => {
      const scratch = scratchDir('reg6');
      const registryDir = path.join(scratch, '.rooms');
      fs.mkdirSync(registryDir, { recursive: true });
      fs.writeFileSync(path.join(registryDir, 'registry.json'), JSON.stringify({ active: 'alpha', rooms: { alpha: { path: 'alpha' } } }));
      const room = seedRoom(path.join(scratch, 'alpha'));
      writeQueue(room, [{ roomDir: room, enqueued_at: daysAgo(8) }]);
      const block = () => {
        const res = runDoctor(scratch, ['--graph-derive-health', '--json']);
        let report;
        try { report = JSON.parse(res.stdout); } catch (e) {
          throw new Error('doctor stdout did not parse: ' + res.stdout.slice(0, 300) + ' stderr: ' + res.stderr.slice(0, 300));
        }
        const c = report.checks && report.checks['graph-derive-health'];
        assert.ok(c, 'module block present');
        return c;
      };
      const a = block();
      const b = block();
      assert.equal(JSON.stringify(a), JSON.stringify(b));
      assert.equal(a.rooms[0].queueAbandonedCount, 1);
      assert.ok(a.rooms[0].artifact_scope && typeof a.rooms[0].artifact_scope.excluded_dirs === 'number');
    });

    await t('(7a) a wildcard-only declaration gives overbroad_patterns 1 and the overbroad reason', () => {
      const room = seedRoom(scratchDir('r7a'));
      writeSections(room, { s1: ['a.md'] });
      fs.writeFileSync(path.join(room, '.mindrian', 'artifact-scope.json'), JSON.stringify({ version: 1, exclude: ['**'] }), 'utf8');
      const h = healthMod.detectRoomHealth(room);
      assert.equal(h.artifact_scope.overbroad_patterns, 1);
      assert.ok(h.reasons.some((r) => /overbroad and was ignored \(1 wildcard-only pattern/.test(r)), JSON.stringify(h.reasons));
    });

    await t('(7b) a declaration naming every top-level directory is overbroad: ignored, 0 excluded, "3 of 3 directories"', () => {
      const room = seedRoom(scratchDir('r7b'));
      writeSections(room, { s1: ['a.md'], s2: ['b.md'], s3: ['c.md'] });
      fs.writeFileSync(path.join(room, '.mindrian', 'artifact-scope.json'), JSON.stringify({ version: 1, exclude: ['s1', 's2', 's3'] }), 'utf8');
      const h = healthMod.detectRoomHealth(room);
      assert.equal(h.artifact_scope.overbroad, true);
      assert.equal(h.artifact_scope.excluded_dirs, 0);
      assert.ok(h.reasons.some((r) => /overbroad/.test(r) && /3 of 3 directories/.test(r)), JSON.stringify(h.reasons));
    });

    await t('(7c) 50 .md files under a marker directory: excluded_artifacts 50, generated_dirs_detected 1', () => {
      const room = seedRoom(scratchDir('r7c'));
      const files = [];
      for (let i = 0; i < 50; i += 1) files.push('g-' + i + '.md');
      writeSections(room, { notes: ['n.md'], gen: files });
      fs.writeFileSync(path.join(room, 'gen', 'engine-input-manifest.json'), '{}', 'utf8');
      const h = healthMod.detectRoomHealth(room);
      assert.equal(h.artifact_scope.excluded_artifacts, 50);
      assert.equal(h.artifact_scope.generated_dirs_detected, 1);
      assert.equal(h.artifact_scope.excluded_dirs, 1);
      assert.equal(h.artifact_scope.overbroad, false);
    });

    await t('(8a) own pid, heartbeat 7 h old, process identity differs: the recycled-pid reason, and fix removes the lock', () => {
      const room = seedRoom(scratchDir('r8a'));
      writeLockPayload(drainLock(room), {
        heartbeat_at: Date.now() - 7 * 3600 * 1000,
        pid_start: (pidStartTicks(process.pid) || 0) + 1,
      });
      const h = healthMod.detectRoomHealth(room);
      assert.equal(h.locks.drain.alive, true);
      assert.equal(h.locks.drain.stale_heartbeat, true);
      assert.ok(h.reasons.some((r) => /heartbeat older than 6 h and a different process identity \(recycled pid; --fix removes it\)/.test(r)), JSON.stringify(h.reasons));
      const res = fixRoom(room, false);
      assert.equal(res.locks_removed, 1);
      assert.equal(fs.existsSync(drainLock(room)), false);
    });

    if (IS_LINUX) {
      await t('(8b) own pid, heartbeat 7 h old, SAME process identity: the runaway reason, and fix leaves the lock', () => {
        const room = seedRoom(scratchDir('r8b'));
        writeLockPayload(drainLock(room), {
          heartbeat_at: Date.now() - 7 * 3600 * 1000,
          pid_start: pidStartTicks(process.pid),
        });
        const h = healthMod.detectRoomHealth(room);
        assert.equal(h.locks.drain.pid_start_match, true);
        assert.ok(h.reasons.some((r) => /a runaway worker; stop it by hand/.test(r)), JSON.stringify(h.reasons));
        assert.ok(!h.reasons.some((r) => /recycled pid/.test(r)));
        const res = fixRoom(room, false);
        assert.equal(res.locks_removed, 0);
        assert.equal(fs.existsSync(drainLock(room)), true, 'a runaway worker lock is never removed');
      });
    } else {
      console.log('  SKIP - (8b) process identity needs /proc (linux only)');
    }

    await t('(9) a live owner with a heartbeat 15 min old gets the 10-minute reason and is not removable', () => {
      const room = seedRoom(scratchDir('r9'));
      writeLockPayload(scoutLock(room), { heartbeat_at: Date.now() - 15 * 60 * 1000 });
      const h = healthMod.detectRoomHealth(room);
      assert.ok(h.reasons.some((r) => /scout lock held by live pid \d+ with heartbeat older than 10 min/.test(r)), JSON.stringify(h.reasons));
      const res = fixRoom(room, false);
      assert.equal(res.locks_removed, 0);
      assert.equal(fs.existsSync(scoutLock(room)), true);
    });

    await t('(10) every reason stays a scalar sentence of at most 200 characters; the module never acquires a lock', () => {
      const room = seedRoom(scratchDir('r10'));
      writeQueue(room, [{ roomDir: room, enqueued_at: daysAgo(30) }]);
      fs.writeFileSync(path.join(room, '.mindrian', 'artifact-scope.json'), JSON.stringify({ version: 1, exclude: ['**', '../x'] }), 'utf8');
      const h = healthMod.detectRoomHealth(room);
      assert.ok(h.reasons.length >= 3);
      for (const r of h.reasons) {
        assert.equal(typeof r, 'string');
        assert.ok(r.length <= 200, 'reason too long: ' + r.length);
      }
      const src = fs.readFileSync(path.join(REPO, 'lib', 'core', 'doctor', 'graph-derive-health-module.cjs'), 'utf8');
      assert.equal((src.match(/\.acquire\(/g) || []).length, 0, 'the doctor module never acquires a lock');
    });
  } finally {
    try { fs.rmSync(SCRATCH, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
  assert.equal(netGuard.attempts(), 0, 'no network attempt');
  netGuard.restore();
  console.log('PASS: ' + pass + ' FAIL: ' + fail);
}

main().then(() => process.exit(process.exitCode || 0), (e) => {
  console.error(e);
  process.exit(1);
});

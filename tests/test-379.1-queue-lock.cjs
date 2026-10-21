#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 379.1 (graph derive drain and scout runaway CPU) proof: queue-lock.
 * Proves CPU379-05: the drain lock heartbeats and a reclaim checks the PID (liveness, never
 * age), with the 6 h hard ceiling the navigator approved (D-379.1-18).
 * Plan 02 (this file's lock part): lib/core/job-lock.cjs acquire, release, read, the eleven
 * scenarios of the plan including the E5 reproduction (a live holder with an 11-minute-old
 * lock is never displaced). Plan 04 adds the drain lock swap under the marker DRAIN_LOCK_BELOW.
 * Multi-process by design: a forked holder child (tests/helpers/job-lock-holder-379.cjs)
 * gives real OS-level process identity.
 * Hermetic: scrubVendorKey + installNetGuard first; attempts() === 0 last. No em-dashes.
 */
const { scrubVendorKey, installNetGuard } = require('./helpers/hygiene-355.cjs');
scrubVendorKey();
const netGuard = installNetGuard();

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fork, spawnSync } = require('node:child_process');

const jobLock = require('../lib/core/job-lock.cjs');
const { isPidAlive, currentBootMs, pidStartTicks, HEARTBEAT_HARD_CEILING_MS } = jobLock._test;
const HOLDER = path.join(__dirname, 'helpers', 'job-lock-holder-379.cjs');
const IS_LINUX = process.platform === 'linux';

let pass = 0;
let fail = 0;
function t(label, fn) {
  try {
    fn();
    pass += 1;
    console.log('  ok - ' + label);
  } catch (e) {
    fail += 1;
    process.exitCode = 1;
    console.log('  FAIL - ' + label + ': ' + (e && e.message ? e.message : e));
  }
}
async function ta(label, fn) {
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
function skip(label) {
  console.log('  SKIP - ' + label);
}

const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-379-1-lock-'));
let seq = 0;
function lockFile() {
  seq += 1;
  const dir = path.join(SCRATCH, 'room-' + seq, '.mindrian');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'graph-derive-drain.lock');
}

function onceMessage(child) {
  return new Promise((resolve, reject) => {
    child.once('message', resolve);
    child.once('error', reject);
  });
}
function onceExit(child) {
  return new Promise((resolve) => { child.once('exit', (code) => resolve(code)); });
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function writePayload(file, overrides) {
  const payload = Object.assign({
    pid: process.pid,
    pid_start: pidStartTicks(process.pid),
    started_at: new Date().toISOString(),
    heartbeat_at: Date.now(),
    boot_ms: currentBootMs(),
    job: 'test-379',
    schema: 'job-lock-v1',
  }, overrides || {});
  fs.writeFileSync(file, JSON.stringify(payload), 'utf8');
  return payload;
}
function deadPid() {
  const r = spawnSync(process.execPath, ['-e', 'process.exit(0)'], { encoding: 'utf8' });
  assert.equal(r.status, 0, 'the throwaway child exited 0');
  // spawnSync returns after the child exited; its pid is dead by construction.
  const pid = r.pid;
  assert.ok(Number.isInteger(pid) && pid > 0, 'spawnSync reported a pid');
  return pid;
}

async function main() {
  console.log('test-379.1-queue-lock (CPU379-05)');
  try {
    t('constants: the 6 h hard ceiling and the heartbeat default', () => {
      assert.equal(HEARTBEAT_HARD_CEILING_MS, 6 * 60 * 60 * 1000);
      assert.equal(jobLock._test.DEFAULT_HEARTBEAT_MS, 30000);
      assert.equal(jobLock._test.BOOT_TOLERANCE_MS, 120000);
      assert.equal(isPidAlive(process.pid), true);
    });

    // (1) The E5 reproduction: a live holder with an 11-minute-old lock is never displaced.
    await ta('(1) live holder, lock mtime and heartbeat_at backdated 11 min -> held (age never reclaims)', async () => {
      const file = lockFile();
      const child = fork(HOLDER, [file, 'hold', '4000']);
      try {
        const msg = await onceMessage(child);
        assert.equal(msg.acquired, true, 'the holder acquired');
        const childPid = msg.pid;
        const onDisk = readJson(file);
        assert.equal(onDisk.pid, childPid);
        onDisk.heartbeat_at = Date.now() - 11 * 60 * 1000;
        fs.writeFileSync(file, JSON.stringify(onDisk), 'utf8');
        const old = new Date(Date.now() - 11 * 60 * 1000);
        fs.utimesSync(file, old, old);
        const res = jobLock.acquire(file, { job: 'test-379-parent' });
        assert.equal(res.ok, false);
        assert.equal(res.reason, 'held');
        assert.equal(res.pid, childPid);
        assert.equal(res.stale_heartbeat, false);
        const after = readJson(file);
        assert.equal(after.pid, childPid, 'the lock still carries the live child pid');
        const seen = jobLock.read(file);
        assert.equal(seen.alive, true);
        assert.equal(seen.present, true);
      } finally {
        child.kill();
        await onceExit(child);
      }
    });

    // (2) A dead pid is reclaimed by one winner; the mutex is gone afterwards.
    t('(2) a lock whose pid exited -> acquire ok true and the .recover mutex is gone', () => {
      const file = lockFile();
      const pid = deadPid();
      assert.equal(isPidAlive(pid), false, 'the throwaway pid is dead');
      writePayload(file, { pid: pid, pid_start: null, started_at: '2026-01-01T00:00:00.000Z' });
      const res = jobLock.acquire(file, { job: 'test-379-parent' });
      assert.equal(res.ok, true);
      assert.equal(res.recovered && res.recovered.reason, 'dead_pid');
      assert.equal(fs.existsSync(file + '.recover'), false);
      assert.equal(readJson(file).pid, process.pid);
      assert.deepEqual(jobLock.release(res.handle), { released: true });
      assert.equal(fs.existsSync(file), false);
    });

    // (3) A lock from another boot is reclaimed even when its pid is alive.
    t('(3) own pid but boot_ms = current boot minus 10 min -> reclaimed', () => {
      const file = lockFile();
      writePayload(file, { boot_ms: currentBootMs() - 10 * 60 * 1000 });
      assert.equal(jobLock.read(file).boot_mismatch, true);
      const res = jobLock.acquire(file, { job: 'test-379-parent' });
      assert.equal(res.ok, true);
      assert.equal(res.recovered && res.recovered.reason, 'boot_mismatch');
      assert.deepEqual(jobLock.release(res.handle), { released: true });
    });

    // (4) A corrupt file is reclaimed.
    t('(4) a corrupt lock file -> reclaimed', () => {
      const file = lockFile();
      fs.writeFileSync(file, '{ not json at all', 'utf8');
      const seen = jobLock.read(file);
      assert.equal(seen.present, true);
      assert.equal(seen.corrupt, true);
      const res = jobLock.acquire(file, { job: 'test-379-parent' });
      assert.equal(res.ok, true);
      assert.equal(res.recovered && res.recovered.reason, 'corrupt');
      assert.deepEqual(jobLock.release(res.handle), { released: true });
    });

    // (5) The legacy bare-pid lock of the old drain.
    t('(5) a bare integer dead pid (legacy) -> read reports legacy_bare_pid; reclaimed', () => {
      const file = lockFile();
      const pid = deadPid();
      fs.writeFileSync(file, String(pid), 'utf8');
      const seen = jobLock.read(file);
      assert.equal(seen.legacy_bare_pid, true);
      assert.equal(seen.pid, pid);
      assert.equal(seen.alive, false);
      assert.equal(typeof seen.heartbeat_age_ms, 'number');
      const res = jobLock.acquire(file, { job: 'test-379-parent' });
      assert.equal(res.ok, true);
      assert.equal(readJson(file).schema, 'job-lock-v1');
      assert.deepEqual(jobLock.release(res.handle), { released: true });
    });

    // (6) The heartbeat refreshes heartbeat_at.
    await ta('(6) hold with heartbeatMs 100, wait 350 ms -> read() heartbeat_age_ms under 300', async () => {
      const file = lockFile();
      const res = jobLock.acquire(file, { job: 'test-379-parent', heartbeatMs: 100 });
      assert.equal(res.ok, true);
      const first = readJson(file).heartbeat_at;
      await sleep(350);
      const seen = jobLock.read(file);
      assert.equal(seen.present, true);
      assert.equal(seen.pid, process.pid);
      assert.ok(seen.heartbeat_age_ms < 300, 'heartbeat_age_ms ' + seen.heartbeat_age_ms + ' is under 300');
      assert.ok(readJson(file).heartbeat_at > first, 'heartbeat_at advanced');
      assert.equal(seen.job, 'test-379-parent');
      assert.deepEqual(jobLock.release(res.handle), { released: true });
    });

    // (7) Release is owner-checked.
    t('(7) release with a handle whose started_at differs -> not_owner; the file stays', () => {
      const file = lockFile();
      const res = jobLock.acquire(file, { job: 'test-379-parent' });
      assert.equal(res.ok, true);
      const foreign = Object.assign({}, res.handle, { started_at: '1999-01-01T00:00:00.000Z', timer: null });
      assert.deepEqual(jobLock.release(foreign), { released: false, reason: 'not_owner' });
      assert.equal(fs.existsSync(file), true);
      assert.deepEqual(jobLock.release(res.handle), { released: true });
      assert.equal(fs.existsSync(file), false);
      assert.deepEqual(jobLock.release(res.handle), { released: false, reason: 'missing' });
      assert.deepEqual(jobLock.release(null), { released: false, reason: 'not_owner' });
    });

    // (8) A crashed holder leaves a dead-pid lock that the next acquire reclaims.
    await ta('(8) fork crash mode; after exit, acquire from the parent -> ok true', async () => {
      const file = lockFile();
      const child = fork(HOLDER, [file, 'crash', '0']);
      const msg = await onceMessage(child);
      assert.equal(msg.acquired, true);
      await onceExit(child);
      assert.equal(fs.existsSync(file), true, 'the crashed holder left its lock');
      assert.equal(jobLock.read(file).alive, false);
      const res = jobLock.acquire(file, { job: 'test-379-parent' });
      assert.equal(res.ok, true);
      assert.equal(res.recovered && res.recovered.pid, msg.pid);
      assert.deepEqual(jobLock.release(res.handle), { released: true });
    });

    // (9) A recycled PID: alive, 7 h stale heartbeat, different process identity.
    t('(9) own pid, heartbeat 7 h stale, pid_start off by one -> stale, identity mismatch, reclaimed', () => {
      const file = lockFile();
      const mine = pidStartTicks(process.pid);
      writePayload(file, { heartbeat_at: Date.now() - 7 * 60 * 60 * 1000, pid_start: (mine || 0) + 1 });
      const seen = jobLock.read(file);
      assert.equal(seen.alive, true);
      assert.equal(seen.stale_heartbeat, true);
      assert.equal(seen.pid_start_match, IS_LINUX ? false : null);
      const res = jobLock.acquire(file, { job: 'test-379-parent' });
      assert.equal(res.ok, true);
      assert.equal(res.recovered && res.recovered.reason, IS_LINUX ? 'stale_identity_mismatch' : 'stale_identity_unavailable');
      assert.deepEqual(jobLock.release(res.handle), { released: true });
    });

    // (10) A stale heartbeat with matching identity: the owner is alive and stuck; never displaced.
    if (IS_LINUX && pidStartTicks(process.pid) !== null) {
      t('(10) own pid, heartbeat 7 h stale, pid_start matching -> held, stale_heartbeat true', () => {
        const file = lockFile();
        writePayload(file, { heartbeat_at: Date.now() - 7 * 60 * 60 * 1000, pid_start: pidStartTicks(process.pid) });
        const seen = jobLock.read(file);
        assert.equal(seen.pid_start_match, true);
        const res = jobLock.acquire(file, { job: 'test-379-parent' });
        assert.equal(res.ok, false);
        assert.equal(res.reason, 'held');
        assert.equal(res.stale_heartbeat, true);
        assert.equal(res.pid_start_match, true);
        assert.equal(fs.existsSync(file), true);
      });
    } else {
      skip('(10) identity unavailable on this platform (pid_start is linux only)');
    }

    // (11) Inside the ceiling the identity is not consulted.
    t('(11) own pid, heartbeat 5 h stale, pid_start off by one -> held (inside the ceiling)', () => {
      const file = lockFile();
      const mine = pidStartTicks(process.pid);
      writePayload(file, { heartbeat_at: Date.now() - 5 * 60 * 60 * 1000, pid_start: (mine || 0) + 1 });
      const res = jobLock.acquire(file, { job: 'test-379-parent' });
      assert.equal(res.ok, false);
      assert.equal(res.reason, 'held');
      assert.equal(res.stale_heartbeat, false);
      assert.ok(res.heartbeat_age_ms > 4 * 60 * 60 * 1000);
    });

    t('(12) read() on a missing file -> present false; a losing contender reports recovering', () => {
      const file = lockFile();
      assert.equal(jobLock.read(file).present, false);
      // A live mutex holder (this process) makes a contender report 'recovering'.
      writePayload(file, { pid: deadPid(), pid_start: null });
      fs.writeFileSync(file + '.recover', JSON.stringify({ pid: process.pid, timestamp: Date.now() }), 'utf8');
      const res = jobLock.acquire(file, { job: 'test-379-parent' });
      assert.equal(res.ok, false);
      assert.equal(res.reason, 'recovering');
      fs.unlinkSync(file + '.recover');
      const again = jobLock.acquire(file, { job: 'test-379-parent' });
      assert.equal(again.ok, true);
      assert.deepEqual(jobLock.release(again.handle), { released: true });
    });

    // ---- Plan 04 Task 2: the drain takes the job lock (CPU379-05) ----
    const sweep = require('../scripts/gsd-graph-derive-sweep.cjs');
    const drain = require('../scripts/gsd-graph-derive-drain.cjs');
    const stubEncode = (texts) => texts.map((x) => [x.length % 7 + 1, 1, 0.5]);
    function drainRoom() {
      seq += 1;
      const room = path.join(SCRATCH, 'drain-room-' + seq);
      fs.mkdirSync(path.join(room, '.mindrian'), { recursive: true });
      fs.writeFileSync(path.join(room, '.room-root'), '{}\n', 'utf8');
      sweep.enqueueDerive(room, {});
      return room;
    }
    const drainOpts = (extra) => Object.assign({
      deriveFn: async () => [],
      probeOpts: { encodeFn: stubEncode },
    }, extra || {});

    await ta('drain: a live holder blocks the drain (locked true, lock_reason held), then the drain runs', async () => {
      const room = drainRoom();
      const lockPath = path.join(room, '.mindrian', 'graph-derive-drain.lock');
      assert.equal(drain._test.drainLockPath(path.resolve(room)), lockPath);
      const child = fork(HOLDER, [lockPath, 'hold', '2500']);
      try {
        const msg = await onceMessage(child);
        assert.equal(msg.acquired, true);
        const blocked = await drain.drainDerive(room, drainOpts());
        assert.equal(blocked.locked, true);
        assert.equal(blocked.lock_reason, 'held');
        assert.equal(blocked.lock_stale_heartbeat, false);
        assert.equal(blocked.remaining, 1);
        assert.equal(sweep.readQueue(room).entries.length, 1, 'the queue is untouched');
        assert.equal(JSON.parse(fs.readFileSync(lockPath, 'utf8')).pid, msg.pid, 'the holder keeps the lock');
      } finally {
        await onceExit(child);
      }
      const ran = await drain.drainDerive(room, drainOpts());
      assert.notEqual(ran.locked, true);
      assert.equal(ran.drained.length, 1);
      assert.equal(sweep.readQueue(room).entries.length, 0);
      assert.equal(fs.existsSync(lockPath), false, 'the lock file is gone after the drain');
    });

    await ta('drain: a legacy bare-pid lock with a dead pid is reclaimed and replaced by a JSON job lock', async () => {
      const room = drainRoom();
      const lockPath = path.join(room, '.mindrian', 'graph-derive-drain.lock');
      fs.writeFileSync(lockPath, String(deadPid()), 'utf8');
      let seen = null;
      const opts = drainOpts({
        probeOpts: {
          encodeFn: (texts) => {
            if (!seen) { try { seen = JSON.parse(fs.readFileSync(lockPath, 'utf8')); } catch (_e) { seen = { unreadable: true }; } }
            return stubEncode(texts);
          },
        },
      });
      const res = await drain.drainDerive(room, opts);
      assert.notEqual(res.locked, true);
      assert.ok(seen && !seen.unreadable, 'the lock was JSON while the drain ran');
      assert.equal(seen.job, 'graph-derive-drain');
      assert.equal(seen.pid, process.pid);
      assert.ok(Object.prototype.hasOwnProperty.call(seen, 'pid_start'), 'payload carries pid_start');
      if (IS_LINUX) assert.equal(typeof seen.pid_start, 'number');
      assert.equal(fs.existsSync(lockPath), false);
    });

    t('drain source: the mtime lock is gone', () => {
      const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'gsd-graph-derive-drain.cjs'), 'utf8');
      assert.equal((src.match(/LOCK_STALE_MS|acquireDrainLock|releaseDrainLock/g) || []).length, 0);
      assert.ok(src.indexOf("require('../lib/core/job-lock.cjs')") !== -1);
    });

    // DRAIN_LOCK_BELOW (Plan 04 adds the drain lock swap assertions here)
  } finally {
    try { fs.rmSync(SCRATCH, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
  assert.equal(netGuard.attempts(), 0, 'no network attempt');
  netGuard.restore();
  console.log('PASS: ' + pass + ' FAIL: ' + fail);
}

main().catch((e) => {
  process.exitCode = 1;
  console.log('FAIL - harness: ' + (e && e.stack ? e.stack : e));
});

#!/usr/bin/env node
'use strict';
/*
 * tests/helpers/write-lock-holder-354.cjs -- Phase 354-04 (SYS-02).
 *
 * Forked child used by tests/test-354-write-lock-ownership.cjs to get real
 * OS-level process identity for the write-lock ownership regression (a
 * fake in-process "concurrent" promise cannot prove PID liveness checks,
 * the same rationale lib/memory/write-lock-atomic.test.cjs already uses).
 *
 * argv: [roomDir, mode, holdMs|nodeId]
 *   mode 'hold'                    -- acquireLock, report, wait holdMs, release, report
 *   mode 'crash'                   -- acquireLock, report, exit(0) WITHOUT releasing
 *   mode 'release-without-acquire' -- skip acquire, call releaseLock(roomDir), report
 *   mode 'graph-ops'               -- acquireLock via graph-ops.cjs enqueueWrite across
 *                                     an awaited holdMs-long promise, report on resolve
 *   mode 'graph-write'             -- Phase 354-16 (Task 1, K2): argv[4] is a nodeId
 *                                     (not a duration). Acquires via graph-ops.cjs
 *                                     enqueueWrite, writes ONE real node through the
 *                                     single node-write chokepoint (node-insert.cjs
 *                                     insertNode) inside the held callback, retries
 *                                     on an explicit "held" contention error (never a
 *                                     silent drop) up to 20 times with a 50ms backoff,
 *                                     reports { written, nodeId, attempts } on success
 *                                     or { error, nodeId, attempts } on exhaustion.
 *
 * Every message is sent via process.send (this file is only ever run via
 * child_process.fork, never node directly -- the harness's own read_first
 * instruction). On any error this sends { error: message } and exits 1.
 *
 * Never writes outside the roomDir it is given.
 *
 * CJS, no third-party dependencies. Hyphens only, no em-dashes (CLAUDE.md).
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..', '..');

function readLockFile(roomDir) {
  const lockPath = path.join(roomDir, '.mindrian', 'write.lock');
  try {
    return JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
  } catch (_e) {
    return null;
  }
}

async function main() {
  const roomDir = process.argv[2];
  const mode = process.argv[3];
  const holdMs = Number(process.argv[4]) || 0;

  if (!roomDir || !mode) {
    process.send({ error: 'missing roomDir or mode argv' });
    process.exit(1);
    return;
  }

  if (mode === 'release-without-acquire') {
    const { releaseLock } = require(path.join(REPO, 'lib', 'core', 'write-lock.cjs'));
    releaseLock(roomDir);
    process.send({ done: true });
    return;
  }

  if (mode === 'graph-write') {
    const nodeId = process.argv[4];
    if (!nodeId) {
      process.send({ error: 'graph-write mode requires argv[4] nodeId' });
      process.exit(1);
      return;
    }
    const { enqueueWrite } = require(path.join(REPO, 'lib', 'core', 'graph-ops.cjs'));
    const { openRoomDb, closeRoomDb } = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
    const { insertNode } = require(path.join(REPO, 'lib', 'core', 'node-insert.cjs'));
    const MAX_ATTEMPTS = 20;
    let attempts = 0;
    const attempt = async () => {
      attempts += 1;
      try {
        await enqueueWrite(roomDir, async () => {
          const db = openRoomDb(roomDir);
          try {
            insertNode(db, nodeId, 'claim', JSON.stringify({ text: 'Phase 354-16 K2 concurrency write ' + nodeId }), {
              epistemic_type: 'extracted_fact',
              review_status: 'proposed',
              source_path: 'test-354-concurrency-surfaces',
              created_by: 'system',
            });
          } finally {
            closeRoomDb(db);
          }
        });
        process.send({ written: true, nodeId: nodeId, pid: process.pid, attempts: attempts });
      } catch (e) {
        const msg = (e && e.message) || String(e);
        // SYS-02's owner-token lock reports contention as an explicit "held"
        // error (never a silent drop) -- retry on exactly that signal.
        if (/held/i.test(msg) && attempts < MAX_ATTEMPTS) {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return attempt();
        }
        process.send({ error: msg, nodeId: nodeId, attempts: attempts });
        process.exitCode = 1;
      }
    };
    await attempt();
    return;
  }

  if (mode === 'graph-ops') {
    const { enqueueWrite } = require(path.join(REPO, 'lib', 'core', 'graph-ops.cjs'));
    // enqueueWrite acquires internally; we cannot report { acquired: true }
    // before the hold starts without reaching into its internals, so this
    // mode reports acquired:true from inside the held function itself,
    // then reports released:true once the awaited operation resolves and
    // the lock has been released in enqueueWrite's own finally.
    await enqueueWrite(roomDir, () => new Promise((resolve) => {
      process.send({ acquired: true, pid: process.pid, lockFile: readLockFile(roomDir) });
      setTimeout(resolve, holdMs);
    }));
    process.send({ released: true });
    return;
  }

  const { acquireLock, releaseLock } = require(path.join(REPO, 'lib', 'core', 'write-lock.cjs'));
  const handle = acquireLock(roomDir);
  process.send({ acquired: true, pid: process.pid, lockFile: readLockFile(roomDir) });

  if (mode === 'crash') {
    // Exit without releasing -- simulates a crashed/killed owner. No
    // cleanup, no finally: the lock file is left behind on disk.
    process.exit(0);
    return;
  }

  if (mode === 'hold') {
    await new Promise((resolve) => setTimeout(resolve, holdMs));
    if (handle) {
      releaseLock(roomDir, handle);
    } else {
      releaseLock(roomDir);
    }
    process.send({ released: true });
    return;
  }

  process.send({ error: 'unknown mode: ' + mode });
  process.exit(1);
}

main().catch((e) => {
  try {
    process.send({ error: (e && e.message) || String(e) });
  } catch (_sendErr) {
    // channel already closed -- fall through to exit
  }
  process.exit(1);
});

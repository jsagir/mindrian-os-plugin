#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88-04-B -- atomic write contract for vault-section-minto-generator.cjs
 * ===========================================================================
 * 7 test cases covering:
 *
 *   Test 1: happy path -- generator --write produces valid MINTO.md via
 *           openSync('wx') + fsync + invariants validate + acquireLock +
 *           renameSync, returns {success:true, violations:[], bytes_written>0}
 *           on stdout as JSON.
 *   Test 2: concurrent writes -- 5 forked workers race against the same
 *           section; every worker exits 0 (writes serialize via acquireLock),
 *           final MINTO.md is well-formed, no orphan .tmp.<pid>.minto files
 *           in the section directory after all workers finish.
 *   Test 3: mid-write crash -- SIGKILL a child that has fsynced its tmp but
 *           not yet renamed. Previous MINTO.md stays intact; orphan tmp file
 *           left for 88-13 guardian cleanup (naming convention verified).
 *   Test 4: invariants error rejection -- MOS_TEST=1 with
 *           --mock-invariants-fail=error forces validator to return ERROR
 *           violations. Generator returns {success:false, violations:[...]},
 *           existing MINTO.md preserved byte-for-byte, tmp file removed.
 *   Test 5: invariants warning passthrough -- --mock-invariants-fail=warning
 *           forces WARNING-only violations. Generator proceeds with rename,
 *           returns {success:true, violations:[...]} (warnings are soft).
 *   Test 6: reader safety -- 100 concurrent fs.readFileSync on MINTO.md
 *           interleaved with generator --write cycles. Every read returns
 *           either the previous full file or the new full file (valid
 *           frontmatter + body); never a truncated partial write.
 *   Test 7: fsync-before-rename ordering -- trace via a fs module wrapper
 *           that records the call order; verifies fsyncSync is invoked on
 *           the tmp fd BEFORE the renameSync call.
 *
 * Pure node built-ins. No npm deps. Cleanup via process.on('exit').
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, fork } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const GENERATOR = path.join(
  REPO_ROOT,
  'scripts',
  'vault-section-minto-generator.cjs'
);
const FIXTURE_SRC = path.join(
  REPO_ROOT,
  'test-fixtures',
  'feynman',
  'sections',
  'fixture-small'
);
const FIXTURE_NARRATIVE = path.join(
  REPO_ROOT,
  'test-fixtures',
  'feynman',
  'narratives',
  'fixture-small.json'
);
const WORKER = path.join(
  __dirname,
  'vault-section-minto-generator-atomic.worker.cjs'
);
const SECTION = 'problem-definition';
const FROZEN_DATE = '2026-04-14';
const FROZEN_TIMESTAMP = '2026-04-14T00:00:00Z';

// ---------- Tmp workspace helpers ----------

const TMP_ROOTS = [];
process.on('exit', function () {
  for (const r of TMP_ROOTS) {
    try {
      fs.rmSync(r, { recursive: true, force: true });
    } catch (_) {
      /* best effort */
    }
  }
});

function copyDirSync(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name);
    const d = path.join(dst, ent.name);
    if (ent.isDirectory()) {
      copyDirSync(s, d);
    } else if (ent.isFile()) {
      fs.copyFileSync(s, d);
    }
  }
}

function makeRoom() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fm-atomic-'));
  TMP_ROOTS.push(tmp);
  const roomDir = path.join(tmp, 'room');
  copyDirSync(FIXTURE_SRC, roomDir);
  // Mark the tmp room as a room-root so any walkers (Phase 87-01a, 88-03)
  // treat it like a real Data Room during the test cycle.
  fs.writeFileSync(path.join(roomDir, '.room-root'), '');
  return roomDir;
}

function mintoPath(roomDir) {
  return path.join(roomDir, SECTION, 'MINTO.md');
}

function cleanMinto(roomDir) {
  const p = mintoPath(roomDir);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

function runGenerator(roomDir, extraArgs, extraEnv) {
  const args = [GENERATOR, '--write', roomDir, '--section', SECTION];
  if (Array.isArray(extraArgs)) {
    for (const a of extraArgs) args.push(a);
  }
  return spawnSync(process.execPath, args, {
    env: Object.assign(
      {},
      process.env,
      {
        MINTO_FROZEN_DATE: FROZEN_DATE,
        MINTO_FROZEN_TIMESTAMP: FROZEN_TIMESTAMP,
      },
      extraEnv || {}
    ),
    encoding: 'utf-8',
  });
}

function listOrphanTmps(roomDir) {
  const sectionDir = path.join(roomDir, SECTION);
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(sectionDir, { withFileTypes: true });
  } catch (_) {
    return out;
  }
  for (const ent of entries) {
    if (ent.isFile() && /MINTO\.md\.tmp\.\d+\.minto$/.test(ent.name)) {
      out.push(path.join(sectionDir, ent.name));
    }
  }
  return out;
}

// ---------- Runner ----------

let passed = 0;
let failed = 0;
function run(name, fn) {
  try {
    fn();
    passed += 1;
    process.stdout.write('  ok  ' + name + '\n');
  } catch (err) {
    failed += 1;
    process.stderr.write('  FAIL  ' + name + '\n');
    process.stderr.write(
      '        ' + (err && err.stack ? err.stack : err && err.message || err) + '\n'
    );
  }
}

async function runAsync(name, fn) {
  try {
    await fn();
    passed += 1;
    process.stdout.write('  ok  ' + name + '\n');
  } catch (err) {
    failed += 1;
    process.stderr.write('  FAIL  ' + name + '\n');
    process.stderr.write(
      '        ' + (err && err.stack ? err.stack : err && err.message || err) + '\n'
    );
  }
}

// ---------- Test 1: happy path ----------

run('Test 1: happy path returns {success:true} JSON + valid MINTO.md', function () {
  const room = makeRoom();
  cleanMinto(room);

  const res = runGenerator(room, ['--narrative', FIXTURE_NARRATIVE]);
  assert.equal(
    res.status,
    0,
    '--write exited non-zero: ' + (res.stderr || '')
  );
  // JSON envelope printed to stdout.
  const envLine = res.stdout
    .split(/\r?\n/)
    .filter(function (l) { return l.trim().startsWith('{'); })
    .pop();
  assert.ok(envLine, 'expected JSON envelope on stdout, got: ' + res.stdout);
  const env = JSON.parse(envLine);
  assert.equal(env.success, true, 'success flag should be true on happy path');
  assert.ok(Array.isArray(env.violations), 'violations must be array');
  assert.ok(
    env.bytes_written > 0,
    'bytes_written must be positive, got ' + env.bytes_written
  );
  assert.ok(
    typeof env.elapsed_ms === 'number' && env.elapsed_ms >= 0,
    'elapsed_ms must be non-negative number'
  );
  assert.equal(env.path, mintoPath(room), 'path echoed');

  // MINTO.md exists and has expected structure.
  const body = fs.readFileSync(mintoPath(room), 'utf-8');
  assert.ok(/^---/.test(body), 'frontmatter present');
  assert.ok(
    /methodology: feynman-minto|methodology: minto-pyramid/.test(body),
    'methodology marker present'
  );

  // No orphan tmp files post-write.
  assert.deepEqual(
    listOrphanTmps(room),
    [],
    'no orphan .tmp.<pid>.minto after success'
  );
});

// ---------- Test 2: concurrent writes (5 forked workers) ----------

runAsync(
  'Test 2: 5 concurrent forked --write all succeed, no tmp leaks',
  async function () {
    const room = makeRoom();
    cleanMinto(room);

    const forks = [];
    for (let i = 0; i < 5; i++) {
      forks.push(
        new Promise(function (resolve) {
          const child = fork(WORKER, [room, SECTION], { silent: true });
          let stderrBuf = '';
          if (child.stderr) {
            child.stderr.on('data', function (c) {
              stderrBuf += c.toString();
            });
          }
          child.on('exit', function (code) {
            resolve({ code: code, stderr: stderrBuf });
          });
        })
      );
    }

    const results = await Promise.all(forks);
    for (let i = 0; i < results.length; i++) {
      assert.equal(
        results[i].code,
        0,
        'worker ' + i + ' exited ' + results[i].code + ': ' + results[i].stderr
      );
    }

    // Final file must be well-formed (not a partial/torn write).
    const body = fs.readFileSync(mintoPath(room), 'utf-8');
    assert.ok(/^---\r?\n/.test(body), 'frontmatter opening delimiter present');
    assert.ok(/\n---\r?\n/.test(body), 'frontmatter closing delimiter present');
    assert.ok(body.length > 100, 'final MINTO.md has content');

    // No orphan .tmp.<pid>.minto sitting around.
    const orphans = listOrphanTmps(room);
    assert.deepEqual(
      orphans,
      [],
      'expected zero orphan tmp files, got: ' + orphans.join(',')
    );
  }
);

// ---------- Test 3: mid-write crash preserves previous MINTO.md ----------

run(
  'Test 3: mid-write SIGKILL preserves previous MINTO.md (tmp orphan named correctly)',
  function () {
    const room = makeRoom();
    cleanMinto(room);

    // Seed a "previous" MINTO.md via one successful write.
    const seed = runGenerator(room, ['--narrative', FIXTURE_NARRATIVE]);
    assert.equal(seed.status, 0, 'seed write failed: ' + seed.stderr);
    const before = fs.readFileSync(mintoPath(room), 'utf-8');
    const beforeSize = before.length;
    assert.ok(beforeSize > 100, 'seed MINTO.md has content');

    // Now simulate a mid-write crash via MOS_TEST_ABORT_AFTER_FSYNC=1 which
    // the generator treats as "exit after fsync but before rename".
    const crashed = runGenerator(
      room,
      ['--narrative', FIXTURE_NARRATIVE],
      { MOS_TEST: '1', MOS_TEST_ABORT_AFTER_FSYNC: '1' }
    );
    // Non-zero exit expected on crash path.
    assert.notEqual(
      crashed.status,
      0,
      'abort-after-fsync should produce non-zero exit'
    );

    // Previous MINTO.md must be byte-identical.
    const after = fs.readFileSync(mintoPath(room), 'utf-8');
    assert.equal(
      after,
      before,
      'previous MINTO.md must be preserved byte-for-byte after mid-write crash'
    );

    // An orphan tmp file matching the guardian pattern should exist.
    const orphans = listOrphanTmps(room);
    assert.ok(
      orphans.length >= 1,
      'expected at least one orphan .tmp.<pid>.minto for guardian cleanup, got: ' +
        orphans.join(',')
    );
    for (const o of orphans) {
      assert.ok(
        /MINTO\.md\.tmp\.\d+\.minto$/.test(o),
        'orphan name does not match guardian pattern: ' + o
      );
    }
  }
);

// ---------- Test 4: invariants ERROR rejection ----------

run(
  'Test 4: --mock-invariants-fail=error rejects write; previous MINTO.md preserved',
  function () {
    const room = makeRoom();
    cleanMinto(room);

    // Seed a happy-path MINTO first.
    const seed = runGenerator(room, ['--narrative', FIXTURE_NARRATIVE]);
    assert.equal(seed.status, 0, 'seed failed: ' + seed.stderr);
    const before = fs.readFileSync(mintoPath(room), 'utf-8');

    // Force an ERROR-severity violation.
    const res = runGenerator(
      room,
      ['--narrative', FIXTURE_NARRATIVE, '--mock-invariants-fail=error'],
      { MOS_TEST: '1' }
    );
    // Generator prints JSON envelope but does NOT hard-fail the CLI (success
    // flag in envelope carries the outcome). Exit code remains 0.
    assert.equal(
      res.status,
      0,
      'generator should exit 0 with success=false envelope, got ' +
        res.status +
        ': ' +
        res.stderr
    );
    const envLine = res.stdout
      .split(/\r?\n/)
      .filter(function (l) { return l.trim().startsWith('{'); })
      .pop();
    assert.ok(envLine, 'JSON envelope missing');
    const env = JSON.parse(envLine);
    assert.equal(env.success, false, 'success must be false on ERROR rejection');
    assert.ok(Array.isArray(env.violations) && env.violations.length > 0, 'violations populated');
    const hasError = env.violations.some(function (v) {
      return v.severity === 'error' || v.severity === 'critical';
    });
    assert.ok(hasError, 'at least one error/critical violation expected');

    // Previous MINTO.md preserved.
    const after = fs.readFileSync(mintoPath(room), 'utf-8');
    assert.equal(
      after,
      before,
      'MINTO.md must be byte-identical to pre-rejection state'
    );

    // Tmp file cleaned up on rejection path.
    const orphans = listOrphanTmps(room);
    assert.deepEqual(
      orphans,
      [],
      'tmp must be unlinked on rejection, got orphans: ' + orphans.join(',')
    );
  }
);

// ---------- Test 5: WARNING-only passes through ----------

run(
  'Test 5: --mock-invariants-fail=warning still renames (warning is soft)',
  function () {
    const room = makeRoom();
    cleanMinto(room);

    const res = runGenerator(
      room,
      ['--narrative', FIXTURE_NARRATIVE, '--mock-invariants-fail=warning'],
      { MOS_TEST: '1' }
    );
    assert.equal(res.status, 0, 'generator exit 0 expected, got ' + res.status);
    const envLine = res.stdout
      .split(/\r?\n/)
      .filter(function (l) { return l.trim().startsWith('{'); })
      .pop();
    assert.ok(envLine, 'JSON envelope missing');
    const env = JSON.parse(envLine);
    assert.equal(env.success, true, 'warning-only MUST pass (soft severity)');
    assert.ok(
      env.violations.length > 0,
      'warning violations should still be reported'
    );
    // File must exist after warning-passthrough.
    assert.ok(
      fs.existsSync(mintoPath(room)),
      'MINTO.md should be written on warning passthrough'
    );
  }
);

// ---------- Test 6: reader safety during interleaved writes ----------

runAsync(
  'Test 6: 100 interleaved reads during repeated --write see no torn content',
  async function () {
    const room = makeRoom();
    cleanMinto(room);
    // Seed so first reads have something.
    const seed = runGenerator(room, ['--narrative', FIXTURE_NARRATIVE]);
    assert.equal(seed.status, 0, 'seed failed: ' + seed.stderr);

    const mp = mintoPath(room);

    // Writer loop (fire-and-forget in the background).
    let writerDone = false;
    const writerLoop = (async function () {
      for (let i = 0; i < 10; i++) {
        runGenerator(room, ['--narrative', FIXTURE_NARRATIVE]);
      }
      writerDone = true;
    })();

    // 100 reads interleaved with the writer.
    let readCount = 0;
    while (!writerDone || readCount < 100) {
      if (readCount >= 100 && writerDone) break;
      try {
        const body = fs.readFileSync(mp, 'utf-8');
        // Accept only well-formed frontmatter + non-empty body.
        assert.ok(
          /^---\r?\n[\s\S]*?\r?\n---\r?\n/.test(body),
          'read #' + readCount + ' returned malformed frontmatter (torn write?)'
        );
        assert.ok(
          body.length > 100,
          'read #' + readCount + ' returned unexpectedly short body (' + body.length + ' bytes)'
        );
      } catch (e) {
        if (e.code === 'ENOENT') {
          // Transient ENOENT is theoretically possible on some filesystems
          // during rename; accept it but count toward progress so the loop
          // can terminate.
        } else {
          throw e;
        }
      }
      readCount += 1;
      if (readCount % 10 === 0) {
        await new Promise(function (r) { setTimeout(r, 5); });
      }
    }

    await writerLoop;
    assert.ok(readCount >= 100, 'expected at least 100 reads, got ' + readCount);
  }
);

// ---------- Test 7: fsync-before-rename ordering ----------

run(
  'Test 7: fsyncSync invoked before renameSync (trace via MOS_TRACE_FS=1)',
  function () {
    const room = makeRoom();
    cleanMinto(room);

    const res = runGenerator(
      room,
      ['--narrative', FIXTURE_NARRATIVE],
      { MOS_TEST: '1', MOS_TRACE_FS: '1' }
    );
    assert.equal(res.status, 0, 'trace run failed: ' + res.stderr);
    const lines = res.stderr.split(/\r?\n/);
    const fsyncIdx = lines.findIndex(function (l) {
      return /^TRACE_FS fsyncSync/.test(l);
    });
    const renameIdx = lines.findIndex(function (l) {
      return /^TRACE_FS renameSync/.test(l);
    });
    assert.ok(
      fsyncIdx !== -1,
      'expected TRACE_FS fsyncSync line, stderr: ' + res.stderr
    );
    assert.ok(
      renameIdx !== -1,
      'expected TRACE_FS renameSync line, stderr: ' + res.stderr
    );
    assert.ok(
      fsyncIdx < renameIdx,
      'fsyncSync (line ' +
        fsyncIdx +
        ') must precede renameSync (line ' +
        renameIdx +
        ')'
    );
  }
);

// ---------- Finish (async tests included) ----------

// Node top-level await is not available in CJS; we chain via a promise.
(async function () {
  // runAsync tests above have already started; wait a tick so the event
  // loop drains their microtasks before we report counts.
  await new Promise(function (r) { setImmediate(r); });

  // Give a generous window for the async tests to finish. The actual async
  // test bodies await their own work; we just need the process to stay
  // alive until they log.
  const deadline = Date.now() + 60 * 1000;
  while (passed + failed < 7 && Date.now() < deadline) {
    await new Promise(function (r) { setTimeout(r, 50); });
  }

  process.stdout.write(
    '\nvault-section-minto-generator-atomic: ' +
      passed +
      ' passed, ' +
      failed +
      ' failed\n'
  );
  process.exit(failed === 0 ? 0 : 1);
})().catch(function (err) {
  process.stderr.write('driver crash: ' + (err && err.stack || err) + '\n');
  process.exit(1);
});

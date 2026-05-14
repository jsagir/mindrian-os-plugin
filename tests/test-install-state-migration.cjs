#!/usr/bin/env node
'use strict';

/*
 * Phase 126 Plan 07 -- install-state.json schema v2 migration test.
 *
 * Six sub-tests cover the 4 migration paths defined in CONTEXT.md D3 + the
 * additive-only invariant + the atomic-write crash-recovery contract + the
 * topology_class derivation taxonomy:
 *
 *   Test 1  no-file              migrateIfNeeded() against a HOME with no
 *                                $HOME/.mindrian/install-state.json is a
 *                                no-op -- returns {migrated:false, fileAbsent:true};
 *                                the migrator does NOT create the file (creation
 *                                is session-start's job, per CONTEXT.md D3).
 *
 *   Test 2  v1-no-schema         Write a v1-shape install-state.json (active_root,
 *                                active_version, topology, installed_at, snapshot;
 *                                NO schema_version). Call migrateIfNeeded.
 *                                Assert:
 *                                  - File now contains schema_version: 2.
 *                                  - All v1 top-level fields preserved
 *                                    byte-identical (deep-equal on the v1 subset).
 *                                  - New v2 fields added with correct defaults
 *                                    (topology_class derived, last_acceptance_run
 *                                    === null, renderer_contract_version === 'unknown').
 *                                  - The .tmp file is NOT left dangling.
 *                                  - Return value is {migrated:true, fromVersion:1, toVersion:2}.
 *
 *   Test 3  v2-current           Write a v2-shape install-state.json with
 *                                schema_version: 2. Call migrateIfNeeded. Assert
 *                                the file is byte-identical before/after (mtime +
 *                                content hash), and the return value is
 *                                {migrated:false, currentVersion:2}.
 *
 *   Test 4  future-version       Write an install-state.json with
 *                                schema_version: 3 (a simulated future). Call
 *                                migrateIfNeeded. Assert:
 *                                  - File is byte-identical before/after.
 *                                  - Return value is {migrated:false,
 *                                    futureVersion:true, currentVersion:3,
 *                                    advice:'run /mos:doctor --fix'}.
 *                                  - The migrator did NOT downgrade.
 *                                  - The migrator did NOT throw.
 *
 *   Test 5  atomic crash         Write a v1 file. Inject MOS_TEST_FORCE_FAIL=rename
 *                                so the writer throws after writing the .tmp but
 *                                before renaming. Assert:
 *                                  - Original v1 file is UNCHANGED on disk
 *                                    (byte-identical to pre-migration).
 *                                  - No partial v2 file at the target path.
 *                                  - migrateIfNeeded raised (the writer threw).
 *
 *   Test 6  topology_class       Write 5 v1 files with topology =
 *                                'marketplace-cache' / 'direct' / 'dev-clone' /
 *                                'not-found' / 'legacy'. Call migrateIfNeeded
 *                                on each. Assert topology_class in the v2 file
 *                                = 'healthy' / 'healthy' / 'healthy' / 'missing' /
 *                                'drifted' respectively.
 *
 * Canon Part 8: this test reads + writes LOCAL files only. Zero network.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const REPO_ROOT = path.resolve(__dirname, '..');
const INSTALL_STATE_MOD = path.join(REPO_ROOT, 'lib', 'core', 'install-state.cjs');

let passed = 0;
let failed = 0;
function pass(name) { passed += 1; process.stdout.write('PASS: ' + name + '\n'); }
function failTest(name, err) {
  failed += 1;
  const msg = (err && err.stack) ? err.stack.split('\n').slice(0, 4).join('\n    ') : String(err);
  process.stdout.write('FAIL: ' + name + '\n    ' + msg + '\n');
}

function makeTmpHome() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'install-state-mig-'));
  fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
  return tmp;
}

function rmTmp(t) {
  try { fs.rmSync(t, { recursive: true, force: true }); } catch { /* best-effort */ }
}

function statePath(home) {
  return path.join(home, '.mindrian', 'install-state.json');
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function makeV1Fixture(topology) {
  return {
    active_version: '1.13.0-beta.13',
    active_root: '/home/jsagi/.claude/plugins/cache/mindrian-marketplace/mos/1.13.0-beta.13',
    topology: topology || 'marketplace-cache',
    installed_at: '2026-05-13T21:14:05.798Z',
    snapshot: { surfaces_count: 6, statusline_renders_version: 'unknown' }
  };
}

function makeV2Fixture() {
  return {
    schema_version: 2,
    active_version: '1.13.0-beta.15',
    active_root: '/home/jsagi/.claude/plugins/cache/mindrian-marketplace/mos/1.13.0-beta.15',
    topology: 'marketplace-cache',
    topology_class: 'healthy',
    installed_at: '2026-05-14T10:00:00.000Z',
    last_acceptance_run: null,
    renderer_contract_version: 'unknown',
    snapshot: { surfaces_count: 6 }
  };
}

// Load the module fresh each invocation (bust cache so MOS_TEST_FORCE_FAIL
// state changes are honored). The module export is stable; the require is
// cheap.
function loadModule() {
  delete require.cache[INSTALL_STATE_MOD];
  return require(INSTALL_STATE_MOD);
}

// ---------------------------------------------------------------------------
// Test 1: no-file -- migrateIfNeeded is a no-op against an absent file
// ---------------------------------------------------------------------------
{
  const home = makeTmpHome();
  try {
    const m = loadModule();
    assert.strictEqual(typeof m.migrateIfNeeded, 'function',
      'module must export migrateIfNeeded');
    assert.strictEqual(typeof m.readInstallState, 'function',
      'module must export readInstallState');
    assert.strictEqual(typeof m.writeInstallState, 'function',
      'module must export writeInstallState');
    assert.strictEqual(m.SCHEMA_VERSION, 2,
      'SCHEMA_VERSION constant must be 2 (integer; per Open Question 5 settlement)');

    // No file present.
    assert.strictEqual(fs.existsSync(statePath(home)), false,
      'fixture invariant: $HOME/.mindrian/install-state.json must NOT exist at start');

    const r = m.migrateIfNeeded({ home });
    assert.strictEqual(r.migrated, false,
      'no-file path must return migrated:false');
    assert.strictEqual(r.fileAbsent, true,
      'no-file path must return fileAbsent:true');

    // The migrator must NOT have created the file (creation is session-start's
    // job, not the migrator's).
    assert.strictEqual(fs.existsSync(statePath(home)), false,
      'migrator must NOT create the file when absent');

    // readInstallState must return null on absent file (not throw).
    const s = m.readInstallState({ home });
    assert.strictEqual(s, null,
      'readInstallState must return null on absent file');

    pass('Test 1 (no-file: no-op)');
  } catch (err) { failTest('Test 1 (no-file: no-op)', err); }
  finally { rmTmp(home); }
}

// ---------------------------------------------------------------------------
// Test 2: v1-no-schema -> migrate to v2 (additive only)
// ---------------------------------------------------------------------------
{
  const home = makeTmpHome();
  try {
    const m = loadModule();
    const v1 = makeV1Fixture('marketplace-cache');
    fs.writeFileSync(statePath(home), JSON.stringify(v1, null, 2) + '\n');

    const r = m.migrateIfNeeded({ home });
    assert.strictEqual(r.migrated, true,
      'v1 path must return migrated:true; got ' + JSON.stringify(r));
    assert.strictEqual(r.fromVersion, 1,
      'v1 path must return fromVersion:1');
    assert.strictEqual(r.toVersion, 2,
      'v1 path must return toVersion:2');

    // Read back. The file now contains schema_version: 2.
    const after = JSON.parse(fs.readFileSync(statePath(home), 'utf8'));
    assert.strictEqual(after.schema_version, 2,
      'migrated file must have schema_version: 2');

    // All v1 fields preserved byte-identical.
    for (const k of ['active_version', 'active_root', 'topology', 'installed_at']) {
      assert.strictEqual(after[k], v1[k],
        'v1 field ' + k + ' must be preserved byte-identical');
    }
    assert.deepStrictEqual(after.snapshot, v1.snapshot,
      'v1 snapshot object must be preserved deep-equal');

    // New v2 fields with correct defaults.
    assert.strictEqual(after.topology_class, 'healthy',
      'topology_class for marketplace-cache must derive to healthy');
    assert.strictEqual(after.last_acceptance_run, null,
      'last_acceptance_run default must be null');
    assert.strictEqual(after.renderer_contract_version, 'unknown',
      "renderer_contract_version default must be 'unknown'");

    // The .tmp file must NOT be left dangling after a successful write.
    assert.strictEqual(fs.existsSync(statePath(home) + '.tmp'), false,
      'after a successful migration, no .tmp file may be left dangling');

    pass('Test 2 (v1-no-schema migrated to v2 additively)');
  } catch (err) { failTest('Test 2 (v1-no-schema migrated to v2 additively)', err); }
  finally { rmTmp(home); }
}

// ---------------------------------------------------------------------------
// Test 3: v2-current -> no-op, file untouched
// ---------------------------------------------------------------------------
{
  const home = makeTmpHome();
  try {
    const m = loadModule();
    const v2 = makeV2Fixture();
    const content = JSON.stringify(v2, null, 2) + '\n';
    fs.writeFileSync(statePath(home), content);

    // Capture mtime + content hash BEFORE.
    const beforeStat = fs.statSync(statePath(home));
    const beforeHash = sha256(fs.readFileSync(statePath(home)));

    // Sleep ~10ms so an mtime change would be detectable on Linux ext4 nanosec
    // precision (overkill for ext4 but harmless on macOS HFS+ 1s precision -- we
    // also assert on content hash which is the load-bearing check).
    const sleepUntil = Date.now() + 10;
    while (Date.now() < sleepUntil) { /* spin */ }

    const r = m.migrateIfNeeded({ home });
    assert.strictEqual(r.migrated, false,
      'v2 path must return migrated:false');
    assert.strictEqual(r.currentVersion, 2,
      'v2 path must return currentVersion:2');

    // File byte-identical.
    const afterHash = sha256(fs.readFileSync(statePath(home)));
    assert.strictEqual(afterHash, beforeHash,
      'v2 file must be byte-identical before/after migrateIfNeeded');

    // mtime unchanged (no write happened).
    const afterStat = fs.statSync(statePath(home));
    assert.strictEqual(afterStat.mtimeMs, beforeStat.mtimeMs,
      'v2 file mtime must be unchanged (no write happened)');

    pass('Test 3 (v2-current no-op)');
  } catch (err) { failTest('Test 3 (v2-current no-op)', err); }
  finally { rmTmp(home); }
}

// ---------------------------------------------------------------------------
// Test 4: future-version -> warn + defer; do NOT downgrade silently
// ---------------------------------------------------------------------------
{
  const home = makeTmpHome();
  try {
    const m = loadModule();
    const future = Object.assign({}, makeV2Fixture(), { schema_version: 3 });
    const content = JSON.stringify(future, null, 2) + '\n';
    fs.writeFileSync(statePath(home), content);

    const beforeHash = sha256(fs.readFileSync(statePath(home)));

    // Capture stderr by hooking process.stderr.write. The future-version path
    // emits a single line prefixed with '[install-state]' to stderr.
    const stderrChunks = [];
    const origStderrWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = (chunk, encoding, cb) => {
      stderrChunks.push(Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk));
      if (typeof cb === 'function') cb();
      return true;
    };

    let r;
    try {
      r = m.migrateIfNeeded({ home });
    } finally {
      process.stderr.write = origStderrWrite;
    }

    assert.strictEqual(r.migrated, false,
      'future path must return migrated:false');
    assert.strictEqual(r.futureVersion, true,
      'future path must return futureVersion:true');
    assert.strictEqual(r.currentVersion, 3,
      'future path must return currentVersion:3 (the read value)');
    assert.strictEqual(r.advice, 'run /mos:doctor --fix',
      "future path must return advice:'run /mos:doctor --fix'");

    // File untouched.
    const afterHash = sha256(fs.readFileSync(statePath(home)));
    assert.strictEqual(afterHash, beforeHash,
      'future file must be byte-identical before/after migrateIfNeeded (no downgrade)');

    // A stderr warning was emitted, prefixed with [install-state].
    const stderrText = stderrChunks.join('');
    assert.ok(stderrText.indexOf('[install-state]') !== -1,
      'future path must emit a stderr line prefixed with [install-state]; got: ' +
      JSON.stringify(stderrText));

    pass('Test 4 (future-version warn + defer)');
  } catch (err) { failTest('Test 4 (future-version warn + defer)', err); }
  finally { rmTmp(home); }
}

// ---------------------------------------------------------------------------
// Test 5: atomic-write crash recovery via MOS_TEST_FORCE_FAIL=rename
// ---------------------------------------------------------------------------
{
  const home = makeTmpHome();
  try {
    const v1 = makeV1Fixture('marketplace-cache');
    const v1Bytes = JSON.stringify(v1, null, 2) + '\n';
    fs.writeFileSync(statePath(home), v1Bytes);
    const beforeHash = sha256(fs.readFileSync(statePath(home)));

    // Inject the rename failure. Bust the require cache so the module re-reads
    // env (the writer is supposed to read process.env.MOS_TEST_FORCE_FAIL at
    // the rename step, not at require-time -- otherwise this test would not be
    // possible without proxyquire). The module's writer pattern reads env at
    // the rename moment.
    process.env.MOS_TEST_FORCE_FAIL = 'rename';
    let threw = false;
    try {
      const m = loadModule();
      m.migrateIfNeeded({ home });
    } catch (_) {
      threw = true;
    } finally {
      delete process.env.MOS_TEST_FORCE_FAIL;
    }

    assert.strictEqual(threw, true,
      'force-fail at rename must propagate as a thrown error');

    // Original file UNCHANGED.
    const afterHash = sha256(fs.readFileSync(statePath(home)));
    assert.strictEqual(afterHash, beforeHash,
      'force-fail at rename must leave the original file byte-identical');

    // The original content must still be the v1 shape (no schema_version).
    const onDisk = JSON.parse(fs.readFileSync(statePath(home), 'utf8'));
    assert.strictEqual(Object.prototype.hasOwnProperty.call(onDisk, 'schema_version'), false,
      'after force-fail, the original v1 file must NOT have schema_version (no partial migration)');

    pass('Test 5 (atomic-write crash recovery via MOS_TEST_FORCE_FAIL)');
  } catch (err) { failTest('Test 5 (atomic-write crash recovery via MOS_TEST_FORCE_FAIL)', err); }
  finally { rmTmp(home); }
}

// ---------------------------------------------------------------------------
// Test 6: topology_class derivation taxonomy (5 cases)
// ---------------------------------------------------------------------------
{
  const cases = [
    { topology: 'marketplace-cache', expected: 'healthy' },
    { topology: 'direct',            expected: 'healthy' },
    { topology: 'dev-clone',         expected: 'healthy' },
    { topology: 'not-found',         expected: 'missing' },
    { topology: 'legacy',            expected: 'drifted' },
  ];
  let okCount = 0;
  let lastErr = null;
  for (const c of cases) {
    const home = makeTmpHome();
    try {
      const m = loadModule();
      const v1 = makeV1Fixture(c.topology);
      fs.writeFileSync(statePath(home), JSON.stringify(v1, null, 2) + '\n');
      const r = m.migrateIfNeeded({ home });
      assert.strictEqual(r.migrated, true,
        'topology=' + c.topology + ' must migrate');
      const after = JSON.parse(fs.readFileSync(statePath(home), 'utf8'));
      assert.strictEqual(after.topology_class, c.expected,
        'topology=' + c.topology + ' must derive topology_class=' + c.expected +
        '; got ' + after.topology_class);
      okCount += 1;
    } catch (err) {
      lastErr = err;
      break;
    } finally {
      rmTmp(home);
    }
  }
  if (okCount === cases.length) {
    pass('Test 6 (topology_class derivation: ' + cases.length + ' cases)');
  } else {
    failTest('Test 6 (topology_class derivation: ' + cases.length + ' cases)',
      lastErr || new Error('only ' + okCount + '/' + cases.length + ' cases passed'));
  }
}

process.stdout.write('\n' + passed + '/' + (passed + failed) + ' passed' +
  (failed ? ' (' + failed + ' failed)' : '') + '\n');
process.exit(failed === 0 ? 0 : 1);

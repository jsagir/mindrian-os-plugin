#!/usr/bin/env node
'use strict';

/*
 * Phase 123 Plan-02 Wave-0 test (HARNESS-123-05 + HARNESS-123-06).
 *
 * Six tests assert the install-state record contract:
 *   Test 1  topology         resolveActivePluginRoot() returns a valid topology;
 *                            MINDRIAN_OS_ROOT pointing at a dev-clone-shaped dir
 *                            classifies as 'dev-clone'.
 *   Test 2  record write     scripts/session-start spawns under a hermetic HOME
 *                            with an active-room fixture; ~/.mindrian/install-
 *                            state.json materializes with the 9 D-04 keys;
 *                            ~/.mindrian-last-version is rewritten to match the
 *                            resolved active_version EVEN with an active room
 *                            (Pitfall 7 -- D-03 single-writer EARLY-write fix).
 *   Test 3  idempotent       a second session-start at the same version is a
 *                            no-op on ~/.mindrian-last-version content.
 *   Test 4  Canon Part 8     the new BEGIN/END install-state record block in
 *                            scripts/session-start contains zero matches for
 *                            fetch|http|curl|brain.mindrian|tavily.
 *   Test 5  manifest schema  data/deployment-surfaces.json parses as JSON, has
 *                            exactly 6 entries, every entry has the D-07 fields,
 *                            paths use the $HOME / <active_root> / <dev_clone_root>
 *                            tokens (no absolute paths), the dev-clone pre-commit
 *                            entry has topology_scope: 'dev-clone'.
 *   Test 6  early-write      byte-offset of 'BEGIN install-state record' in
 *           ordering         scripts/session-start is LESS than the byte-offset
 *                            of Step A's 'WRAPPER_DST=' marker (D-03 + RESEARCH
 *                            Override 4 invariant: write happens BEFORE Step A).
 *
 * Hermetic envelope: per-test mkdtempSync HOME + USERPROFILE override (mirroring
 * tests/test-doctor-class-g.cjs makeTmpHome + runDoctor pattern). The plugin
 * root is overridden via MINDRIAN_OS_ROOT to the live repo (so session-start's
 * platform.cjs reads the live plugin.json and active-plugin-root.cjs returns a
 * dev-clone topology against the scratch HOME).
 *
 * Tests 1 + 4 + 6 go GREEN once Task 1 lands; Tests 2 + 3 + 5 need Plan-02
 * Tasks 2 + 3 (session-start record-write block + data/deployment-surfaces.json
 * manifest). Registered in lib/memory/run-feynman-tests.cjs Phase-123 block.
 *
 * Canon Part 8: this test reads LOCAL files only. Zero network.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const SESSION_START = path.join(REPO_ROOT, 'scripts', 'session-start');
const ACTIVE_PLUGIN_ROOT_MOD = path.join(REPO_ROOT, 'lib', 'core', 'active-plugin-root.cjs');
const MANIFEST_PATH = path.join(REPO_ROOT, 'data', 'deployment-surfaces.json');

let passed = 0;
let failed = 0;
function pass(name) { passed += 1; process.stdout.write('PASS: ' + name + '\n'); }
function failTest(name, err) {
  failed += 1;
  const msg = (err && err.stack) ? err.stack.split('\n').slice(0, 4).join('\n    ') : String(err);
  process.stdout.write('FAIL: ' + name + '\n    ' + msg + '\n');
}

function makeTmpHome() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), '123-02-'));
  fs.mkdirSync(path.join(tmp, '.claude'), { recursive: true });
  fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
  return tmp;
}

function rmTmp(t) {
  try { fs.rmSync(t, { recursive: true, force: true }); } catch { /* best-effort */ }
}

function makeActiveRoomFixture(home) {
  // Minimal active-room fixture: scripts/resolve-room walks up looking for a
  // .room-root marker. Create a directory tree the session-start hook can find
  // as a "room" without spinning up the full ICM L0..L4 substrate. STATE.md +
  // ROOM.md are enough to make the if [ -d "$ROOM_DIR" ] branch fire.
  const roomDir = path.join(home, 'work', 'sample-room');
  fs.mkdirSync(roomDir, { recursive: true });
  fs.writeFileSync(path.join(roomDir, '.room-root'), '');
  fs.writeFileSync(path.join(roomDir, 'STATE.md'),
    '---\nventure_stage: ideate\n---\n# State\n');
  fs.writeFileSync(path.join(roomDir, 'ROOM.md'),
    '---\ntype: directory-identity\nname: sample-room\n---\n# Sample\n');
  return roomDir;
}

function spawnSessionStart(home, cwd) {
  const env = Object.assign({}, process.env, {
    HOME: home,
    USERPROFILE: home,
    // Force the test process's bash session-start to NEVER trip the workspace
    // guard. The guard fires only when PWD starts with $HOME/.claude/plugins/
    // -- a scratch HOME under /tmp can never hit that.
    // SESSION_START_NODE_PREFLIGHT_SKIP keeps the Node-version check from
    // tripping on alternate runtimes (we already know node is fine here).
    SESSION_START_NODE_PREFLIGHT_SKIP: '1',
    // Point the resolver at the live repo as the active plugin root: this gives
    // the session-start record write a stable active_version (the live
    // plugin.json) and topology=dev-clone (Test 1 covers that classification).
    MINDRIAN_OS_ROOT: REPO_ROOT,
    // Avoid SDK telemetry / npm-reconcile network paths if any helper tries.
    CI: '1',
  });
  // Detach stdin / stdout so the heavy session-start banner does not deadlock
  // on stdout (the banner writes to stderr; stdout is the additionalContext
  // JSON line for Claude Code). We do not need to parse it -- only the side
  // effects on $HOME matter.
  const r = spawnSync('bash', [SESSION_START], {
    env,
    cwd: cwd || home,
    encoding: 'utf8',
    timeout: 30000,
  });
  return r;
}

// ---------------------------------------------------------------------------
// Test 1: topology classification
// ---------------------------------------------------------------------------
try {
  // Clear MINDRIAN_OS_ROOT from this process so the resolver walks the real
  // chain. The result must be a valid topology string.
  const savedRoot = process.env.MINDRIAN_OS_ROOT;
  delete process.env.MINDRIAN_OS_ROOT;
  // Bust the require cache so the resolver re-reads env on each call.
  delete require.cache[ACTIVE_PLUGIN_ROOT_MOD];
  const { resolveActivePluginRoot, classifyTopology } =
    require(ACTIVE_PLUGIN_ROOT_MOD);
  const r = resolveActivePluginRoot();
  assert.ok(typeof r.topology === 'string',
    'topology must be a string; got ' + typeof r.topology);
  assert.ok(['marketplace-cache', 'dev-clone', 'legacy', 'not-found'].includes(r.topology),
    'topology must be one of the 4 enum values; got ' + r.topology);
  // Restore + targeted dev-clone probe: classifyTopology on the live repo path
  // (it has .git + install.sh + an origin URL that matches mindrian-os-plugin).
  assert.strictEqual(typeof classifyTopology, 'function',
    'classifyTopology must be exported');
  // The live repo IS the dev clone -- structural probe.
  const liveTopology = classifyTopology(REPO_ROOT, 'installed_plugins.json');
  assert.strictEqual(liveTopology, 'dev-clone',
    'classifyTopology(REPO_ROOT) must return dev-clone; got ' + liveTopology);
  // not-found short-circuit.
  assert.strictEqual(classifyTopology(null, 'not-found'), 'not-found',
    'classifyTopology(null) must return not-found');
  if (savedRoot !== undefined) process.env.MINDRIAN_OS_ROOT = savedRoot;
  pass('Test 1 (topology classification)');
} catch (err) { failTest('Test 1 (topology classification)', err); }

// ---------------------------------------------------------------------------
// Test 2: record write + ~/.mindrian-last-version rewrite (Pitfall 7 fix)
// ---------------------------------------------------------------------------
let home2;
try {
  home2 = makeTmpHome();
  const roomDir = makeActiveRoomFixture(home2);
  // Seed ~/.mindrian-last-version with a deliberately wrong value. The Pitfall-7
  // bug was: with an active room present, session-start's cold-start branch
  // (which contained the old write) never fired, so this stale value persisted
  // across version bumps. The fix: the EARLY record-write block writes both
  // ~/.mindrian/install-state.json AND ~/.mindrian-last-version unconditionally.
  const stalePath = path.join(home2, '.mindrian-last-version');
  fs.writeFileSync(stalePath, '0.0.0-stale\n');

  const r = spawnSessionStart(home2, roomDir);
  // session-start exits 0 on success; any other code is informative but not
  // necessarily fatal (the script is a hook -- it should not hard-fail).
  // We assert on the SIDE EFFECTS, not the exit code.
  const recPath = path.join(home2, '.mindrian', 'install-state.json');
  assert.ok(fs.existsSync(recPath),
    '~/.mindrian/install-state.json must exist after session-start. r.status=' +
    r.status + ' stderr-tail: ' +
    String(r.stderr || '').split('\n').slice(-5).join(' | '));
  const rec = JSON.parse(fs.readFileSync(recPath, 'utf8'));
  // D-04 keys:
  for (const k of ['active_version', 'active_root', 'topology', 'resolved_at',
                   'surfaces', 'installed_plugins_version',
                   'statusline_renders_version', 'last_version_file_value',
                   'path_bin_version']) {
    assert.ok(Object.prototype.hasOwnProperty.call(rec, k),
      'install-state.json must have key: ' + k);
  }
  assert.ok(Array.isArray(rec.surfaces), 'surfaces must be an array');
  // ~/.mindrian-last-version must be rewritten to active_version (the Pitfall 7
  // fix: the OLD line-419 write was inside the no-room else branch and never
  // fired when a room was active).
  const lvNow = fs.readFileSync(stalePath, 'utf8').trim();
  assert.notStrictEqual(lvNow, '0.0.0-stale',
    '~/.mindrian-last-version must be rewritten (Pitfall 7) -- got: ' + lvNow);
  assert.strictEqual(lvNow, String(rec.active_version),
    '~/.mindrian-last-version must equal record.active_version -- got LV=' +
    lvNow + ' record.active_version=' + rec.active_version);
  // statusline_renders_version "unknown" is acceptable at the early write per
  // D-03(b) and RESEARCH Override 4 -- the doctor class-I check computes it
  // live; the optional post-Step-A refresh may or may not run depending on
  // executor choice.
  pass('Test 2 (record write + Pitfall 7 fix)');
} catch (err) { failTest('Test 2 (record write + Pitfall 7 fix)', err); }

// ---------------------------------------------------------------------------
// Test 3: idempotent re-run
// ---------------------------------------------------------------------------
try {
  // Reuse the scratch HOME from Test 2 (must persist across tests for this
  // assertion). If Test 2 failed before creating home2, skip.
  if (!home2 || !fs.existsSync(path.join(home2, '.mindrian', 'install-state.json'))) {
    throw new Error('Test 2 prerequisite missing (no install-state.json on disk)');
  }
  const lvBefore = fs.readFileSync(path.join(home2, '.mindrian-last-version'), 'utf8').trim();
  const recBefore = JSON.parse(fs.readFileSync(path.join(home2, '.mindrian', 'install-state.json'), 'utf8'));
  // Find the active room again
  const roomDir = path.join(home2, 'work', 'sample-room');
  const r2 = spawnSessionStart(home2, roomDir);
  const lvAfter = fs.readFileSync(path.join(home2, '.mindrian-last-version'), 'utf8').trim();
  const recAfter = JSON.parse(fs.readFileSync(path.join(home2, '.mindrian', 'install-state.json'), 'utf8'));
  // Idempotency: ~/.mindrian-last-version contents must NOT churn (no version
  // change between runs). The record's resolved_at WILL update on every write
  // (it is a "snapshot" of when the resolution last happened) -- that is fine
  // and not part of the idempotency contract; the contract is on
  // ~/.mindrian-last-version equality across same-version runs.
  assert.strictEqual(lvAfter, lvBefore,
    '~/.mindrian-last-version must NOT churn between same-version runs -- got before=' +
    lvBefore + ' after=' + lvAfter + ' stderr-tail: ' +
    String(r2.stderr || '').split('\n').slice(-5).join(' | '));
  assert.strictEqual(recAfter.active_version, recBefore.active_version,
    'active_version must NOT churn between same-version runs');
  pass('Test 3 (idempotent re-run)');
} catch (err) { failTest('Test 3 (idempotent re-run)', err); }
finally { if (home2) rmTmp(home2); }

// ---------------------------------------------------------------------------
// Test 4: Canon Part 8 grep -- the new BEGIN/END block has zero network calls
// ---------------------------------------------------------------------------
try {
  const text = fs.readFileSync(SESSION_START, 'utf8');
  const beginIdx = text.indexOf('BEGIN install-state record');
  const endIdx = text.indexOf('END install-state record');
  assert.ok(beginIdx > 0, 'BEGIN install-state record marker must exist in session-start');
  assert.ok(endIdx > beginIdx, 'END install-state record marker must follow BEGIN');
  // Span the FIRST BEGIN through the LAST END so the optional post-Step-A
  // refresh block is also covered if the executor added one. Strip comment
  // lines (leading whitespace + #) before scanning so the literal Canon Part 8
  // prohibition narrative ("no fetch/http/curl/...") is not flagged as code.
  const lastEndIdx = text.lastIndexOf('END install-state record');
  const span = text.slice(beginIdx, lastEndIdx + 'END install-state record'.length);
  const codeOnly = span
    .split('\n')
    .filter(line => !/^\s*#/.test(line))
    .join('\n');
  // Match actual call shapes, not narrative words:
  //   fetch(...)  http://...  https://...  curl<space>...  brain.mindrian...
  //   tavily<word-boundary>
  const network = codeOnly.match(/\bfetch\s*\(|https?:\/\/|\bcurl\s+|brain\.mindrian|\btavily\b/i);
  assert.strictEqual(network, null,
    'Canon Part 8 breach: new install-state record block contains a network call: ' +
    (network && network[0]));
  pass('Test 4 (Canon Part 8: new block has zero network calls)');
} catch (err) { failTest('Test 4 (Canon Part 8: new block has zero network calls)', err); }

// ---------------------------------------------------------------------------
// Test 5: manifest schema -- data/deployment-surfaces.json
// ---------------------------------------------------------------------------
try {
  assert.ok(fs.existsSync(MANIFEST_PATH),
    'data/deployment-surfaces.json must exist (Plan-02 Task 3)');
  const man = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  assert.ok(Array.isArray(man.surfaces),
    'manifest.surfaces must be an array');
  assert.strictEqual(man.surfaces.length, 6,
    'manifest.surfaces must have exactly 6 entries; got ' + man.surfaces.length);
  for (const s of man.surfaces) {
    assert.ok(s.id, 'surface entry must have an id');
    assert.ok(s.path, 'surface entry must have a path: ' + s.id);
    assert.ok(s.owner, 'surface entry must have an owner: ' + s.id);
    assert.ok(s.topology_scope, 'surface entry must have topology_scope: ' + s.id);
    assert.ok(s.check_kind, 'surface entry must have check_kind: ' + s.id);
    assert.ok(Object.prototype.hasOwnProperty.call(s, 'expected'),
      'surface entry must declare expected (may be null): ' + s.id);
    assert.ok(s.reconcile, 'surface entry must have reconcile: ' + s.id);
    assert.ok(s.remediation, 'surface entry must have remediation: ' + s.id);
    assert.ok(
      s.path.includes('$HOME') || s.path.includes('<active_root>') || s.path.includes('<dev_clone_root>'),
      'surface path must use a token, no absolute paths: ' + s.id + ' got ' + s.path
    );
  }
  // The dev-clone-scoped pre-commit-hook entry must exist.
  const preCommit = man.surfaces.find(s => /pre-commit/i.test(s.id));
  assert.ok(preCommit, 'manifest must contain a pre-commit-hook surface');
  assert.strictEqual(preCommit.topology_scope, 'dev-clone',
    'pre-commit-hook surface must have topology_scope=dev-clone');
  // The install-state-record self-entry must be observed-only (D-08).
  const selfRecord = man.surfaces.find(s => /install-state/i.test(s.id));
  assert.ok(selfRecord, 'manifest must contain an install-state-record surface');
  assert.strictEqual(selfRecord.check_kind, 'observed-only',
    'install-state-record self-entry must be observed-only');
  pass('Test 5 (manifest schema)');
} catch (err) { failTest('Test 5 (manifest schema)', err); }

// ---------------------------------------------------------------------------
// Test 6: early-write ordering -- record block sits BEFORE Step A in session-start
// ---------------------------------------------------------------------------
try {
  const text = fs.readFileSync(SESSION_START, 'utf8');
  const recIdx = text.indexOf('BEGIN install-state record');
  // Step A's load-bearing literal is `WRAPPER_DST=` (the variable the dispatcher
  // shim copies into). The dispatcher-shim block at line ~1078 sets WRAPPER_DST
  // first thing. This is the marker we lock against.
  const stepAIdx = text.indexOf('WRAPPER_DST=');
  assert.ok(recIdx > 0, 'BEGIN install-state record marker must exist');
  assert.ok(stepAIdx > 0, 'Step A WRAPPER_DST= marker must exist');
  assert.ok(recIdx < stepAIdx,
    'D-03 + RESEARCH Override 4 invariant: install-state record write must ' +
    'happen BEFORE Step A (WRAPPER_DST=). Got recIdx=' + recIdx +
    ' stepAIdx=' + stepAIdx);
  pass('Test 6 (early-write ordering: BEGIN install-state record < WRAPPER_DST=)');
} catch (err) { failTest('Test 6 (early-write ordering: BEGIN install-state record < WRAPPER_DST=)', err); }

process.stdout.write('\n' + passed + '/' + (passed + failed) + ' passed' +
  (failed ? ' (' + failed + ' failed)' : '') + '\n');
process.exit(failed === 0 ? 0 : 1);

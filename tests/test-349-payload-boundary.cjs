'use strict';
/*
 * tests/test-349-payload-boundary.cjs -- Phase 349 Plan 02 (NOTIFY-08).
 *
 * Proves the shape of the client_payload mos_theo_notify_gate dispatches:
 * the closed four-key set, the cap headroom, the hash's exact source (the
 * TAGGED commit, never the working tree), the placeholder-version trap, the
 * Canon Part 8 value shapes, and a source scan proving the gate reaches no
 * room and no Brain. Hermetic: every arm drives the dispatch through
 * MINDRIAN_THEO_NOTIFY_CMD (see tests/test-349-theo-notify-gate.cjs's own
 * header for the full seam-contract text this file assumes) and builds its
 * own temp git fixture repo -- zero network calls, and no git command ever
 * runs against the live MindrianOS-Plugin working tree.
 *
 * WHY THIS FILE IS AUTHORED RED (Phase 349 Plan 02): the library this file
 * sources, scripts/release-lib/theo-notify-gate.sh, does not exist yet. It
 * lands in Plan 03, behind a blocking navigator checkpoint. Registered as a
 * run_red_until tripwire in tests/run-all-349.sh; today's failure is the
 * honest, expected state.
 *
 * THE SEAM CONTRACT (repeated here so this file is independently readable):
 * the dispatch command receives exactly four positional arguments, each the
 * literal string "<key>=<value>", in the fixed order version, commit,
 * registryHash, command_registry_path. This lets a hermetic test recover
 * the payload's KEY SET, not just its values, from the recorded argv.
 *
 * Arms:
 *   1. The closed four-key set: exactly version/commit/registryHash/
 *      command_registry_path, sorted-array deepStrictEqual, no others.
 *   2. Cap headroom: observed property count <= a named, sourced constant.
 *   3. Hash correctness: registryHash equals an independently-computed
 *      SHA-256 of the committed bytes, 64 lowercase hex characters.
 *   4. The TAGGED commit, not the working tree: registryHash matches the
 *      committed bytes and does NOT match deliberately-differing,
 *      uncommitted working-tree bytes.
 *   5. The placeholder-version trap: the recorded version is the ARGUMENT,
 *      never the on-disk plugin.json value, proven across two calls with
 *      disk mutated in between.
 *   6. Canon Part 8 value shapes: version/commit/registryHash/path all
 *      match declared shapes; no MindrianRooms, no /home/, no oversized
 *      value.
 *   7. The gate reaches no room and no Brain: a comment-stripped source
 *      scan of theo-notify-gate.sh.
 *
 * Bare node script: assert, an ok(label) counter, no framework, non-zero
 * exit on any assertion failure (uncaught throw), self-contained.
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');

const REPO = path.resolve(__dirname, '..');
const GATE_LIB = path.join(REPO, 'scripts', 'release-lib', 'theo-notify-gate.sh');

// GitHub's client_payload top-level property limit. MEDIUM confidence:
// WebSearch-corroborated against multiple independent community sources;
// docs.github.com itself was unreachable to WebFetch at research time
// (349-RESEARCH.md assumption A2). The assertion below is on the CAP, not
// on the exact count 4, so a legitimate future nested addition does not
// fail for the wrong reason while a flat sprawl still does.
const GITHUB_CLIENT_PAYLOAD_MAX_TOP_LEVEL = 10;

console.log('test-349-payload-boundary:');

if (!fs.existsSync(GATE_LIB)) {
  console.error(
    '  x RED (expected): scripts/release-lib/theo-notify-gate.sh does not exist yet.'
  );
  console.error(
    '    Lands in Phase 349 Plan 03, behind a blocking navigator checkpoint. This'
  );
  console.error(
    '    tripwire is registered as run_red_until in tests/run-all-349.sh and reads'
  );
  console.error(
    '    EXPECTED-RED until then. This is the honest state, not a failure.'
  );
  process.exit(1);
}

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-theo-payload-'));

// The argv-recording fake: appends its own arguments, one per line, to
// argvFile, then exits 0. Mirrors tests/test-349-theo-notify-gate.cjs's
// own recorder.
function makeArgvRecorderCmd(argvFile) {
  return 'for a in "$@"; do printf \'%s\\n\' "$a" >> "' + argvFile + '"; done; exit 0';
}

function readPayload(argvFile) {
  assert.ok(fs.existsSync(argvFile), 'the dispatch fake must have been invoked and recorded its argv at ' + argvFile);
  const lines = fs.readFileSync(argvFile, 'utf8').split('\n').filter(Boolean);
  const payload = {};
  for (const line of lines) {
    const idx = line.indexOf('=');
    assert.notStrictEqual(idx, -1, 'every recorded argv element must be a key=value pair; got ' + JSON.stringify(line));
    payload[line.slice(0, idx)] = line.slice(idx + 1);
  }
  return { lines: lines, payload: payload };
}

function runGate(opts) {
  const env = Object.assign({}, process.env);
  env.MINDRIAN_THEO_NOTIFY_CMD = opts.notifyCmd;
  delete env.MINDRIAN_THEO_NOTIFY_LOG;
  const dryRun = opts.dryRun ? '1' : '0';
  const noNotify = opts.noNotify ? '1' : '0';
  const script =
    '. "' + GATE_LIB + '"; mos_theo_notify_gate "' + opts.pluginDir + '" "' + opts.releaseSha +
    '" "' + opts.newVersion + '" "' + dryRun + '" "' + noNotify + '"';
  const r = cp.spawnSync('bash', ['-c', script], { encoding: 'utf8', env: env, timeout: 15000 });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

// Builds a real temp git fixture repo (git init, then a real commit) under
// os.tmpdir(): data/command-registry.json with the supplied bytes,
// .claude-plugin/plugin.json with the supplied version, committed, sha
// captured via `git rev-parse HEAD`. Every git command runs with an
// explicit cwd and its status is asserted 0, so a fixture that failed to
// build surfaces as a fixture error, never a mysterious gate failure.
function buildNotifyFixtureRepo(opts) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-theo-notify-fixture-'));
  function git(args) {
    const res = cp.spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.strictEqual(res.status, 0, 'git ' + args.join(' ') + ' failed building the fixture: ' + res.stderr);
    return res;
  }
  git(['init', '-q']);
  git(['config', 'user.email', 'test-349@example.invalid']);
  git(['config', 'user.name', 'Phase 349 Payload Fixture']);
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data', 'command-registry.json'), opts.registryBytes);
  fs.mkdirSync(path.join(root, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: 'mos-theo-notify-fixture', version: opts.pluginVersion }, null, 2) + '\n'
  );
  git(['add', '-A']);
  git(['commit', '-q', '-m', 'fixture']);
  const sha = git(['rev-parse', 'HEAD']).stdout.trim();
  return {
    root: root,
    sha: sha,
    registryBytes: opts.registryBytes,
    cleanup: function () {
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}

// ---------------------------------------------------------------------------
// Arm 1: the closed four-key set.
// ---------------------------------------------------------------------------
{
  const fixture = buildNotifyFixtureRepo({
    registryBytes: '{"arm":1}\n',
    pluginVersion: '0.0.1-placeholder',
  });
  try {
    const argvFile = path.join(tmpRoot, 'arm1-argv.txt');
    const r = runGate({
      pluginDir: fixture.root,
      releaseSha: fixture.sha,
      newVersion: '1.2.3',
      notifyCmd: makeArgvRecorderCmd(argvFile),
    });
    assert.strictEqual(r.status, 0, 'arm 1 gate must exit 0; got ' + r.status + ' stdout=' + r.stdout);
    const { payload } = readPayload(argvFile);
    const observedKeys = Object.keys(payload).sort();
    const expectedKeys = ['command_registry_path', 'commit', 'registryHash', 'version'].sort();
    assert.deepStrictEqual(
      observedKeys, expectedKeys,
      'the payload key set must be exactly these four names, no fewer, no more; got ' + JSON.stringify(observedKeys)
    );
    ok('arm 1: the recorded payload carries exactly the four client_payload key names and no others');
  } finally {
    fixture.cleanup();
  }
}

// ---------------------------------------------------------------------------
// Arm 2: cap headroom.
// ---------------------------------------------------------------------------
{
  const fixture = buildNotifyFixtureRepo({
    registryBytes: '{"arm":2}\n',
    pluginVersion: '0.0.1-placeholder',
  });
  try {
    const argvFile = path.join(tmpRoot, 'arm2-argv.txt');
    const r = runGate({
      pluginDir: fixture.root,
      releaseSha: fixture.sha,
      newVersion: '1.2.3',
      notifyCmd: makeArgvRecorderCmd(argvFile),
    });
    assert.strictEqual(r.status, 0, 'arm 2 gate must exit 0; got ' + r.status);
    const { payload } = readPayload(argvFile);
    const observedCount = Object.keys(payload).length;
    assert.ok(
      observedCount <= GITHUB_CLIENT_PAYLOAD_MAX_TOP_LEVEL,
      'the payload top-level property count (' + observedCount + ') must stay under the GitHub cap (' +
        GITHUB_CLIENT_PAYLOAD_MAX_TOP_LEVEL + ')'
    );
    ok('arm 2: the payload top-level property count stays under the named, sourced GitHub cap');
  } finally {
    fixture.cleanup();
  }
}

// ---------------------------------------------------------------------------
// Arm 3: hash correctness.
// ---------------------------------------------------------------------------
{
  const registryBytes = '{"arm":3,"known":"bytes-for-hashing"}\n';
  const fixture = buildNotifyFixtureRepo({ registryBytes: registryBytes, pluginVersion: '0.0.1-placeholder' });
  try {
    const argvFile = path.join(tmpRoot, 'arm3-argv.txt');
    const r = runGate({
      pluginDir: fixture.root,
      releaseSha: fixture.sha,
      newVersion: '1.2.3',
      notifyCmd: makeArgvRecorderCmd(argvFile),
    });
    assert.strictEqual(r.status, 0, 'arm 3 gate must exit 0; got ' + r.status);
    const { payload } = readPayload(argvFile);
    const expectedHash = crypto.createHash('sha256').update(registryBytes).digest('hex');
    assert.match(payload.registryHash, /^[0-9a-f]{64}$/, 'registryHash must be 64 lowercase hex characters; got ' + payload.registryHash);
    assert.strictEqual(
      payload.registryHash, expectedHash,
      'registryHash must equal an independently-computed SHA-256 of the exact committed bytes'
    );
    ok('arm 3: registryHash equals an independently-computed SHA-256 of the committed bytes and is 64 lowercase hex characters');
  } finally {
    fixture.cleanup();
  }
}

// ---------------------------------------------------------------------------
// Arm 4: the TAGGED commit, not the working tree.
// ---------------------------------------------------------------------------
{
  const committedBytes = '{"arm":4,"state":"committed"}\n';
  const workingTreeBytes = '{"arm":4,"state":"uncommitted-drift"}\n';
  const fixture = buildNotifyFixtureRepo({ registryBytes: committedBytes, pluginVersion: '0.0.1-placeholder' });
  try {
    // This is what the tree actually looks like at Step 5.6: Commit B has
    // landed, so the working tree differs from the tagged commit.
    fs.writeFileSync(path.join(fixture.root, 'data', 'command-registry.json'), workingTreeBytes);

    const argvFile = path.join(tmpRoot, 'arm4-argv.txt');
    const r = runGate({
      pluginDir: fixture.root,
      releaseSha: fixture.sha,
      newVersion: '1.2.3',
      notifyCmd: makeArgvRecorderCmd(argvFile),
    });
    assert.strictEqual(r.status, 0, 'arm 4 gate must exit 0; got ' + r.status);
    const { payload } = readPayload(argvFile);
    const committedHash = crypto.createHash('sha256').update(committedBytes).digest('hex');
    const workingTreeHash = crypto.createHash('sha256').update(workingTreeBytes).digest('hex');
    assert.strictEqual(
      payload.registryHash, committedHash,
      'registryHash must match the TAGGED COMMIT bytes'
    );
    assert.notStrictEqual(
      payload.registryHash, workingTreeHash,
      'registryHash must NOT match the deliberately-differing, uncommitted working-tree bytes'
    );
    ok('arm 4: registryHash comes from the tagged commit and provably not from a deliberately-differing working tree');
  } finally {
    fixture.cleanup();
  }
}

// ---------------------------------------------------------------------------
// Arm 5: the placeholder-version trap.
// ---------------------------------------------------------------------------
{
  const placeholderVersion = '0.0.1-NEXT-VERSION-PLACEHOLDER';
  const releasedVersion = '3.4.5';
  const fixture = buildNotifyFixtureRepo({
    registryBytes: '{"arm":5}\n',
    pluginVersion: placeholderVersion,
  });
  try {
    const argvFile1 = path.join(tmpRoot, 'arm5-argv-1.txt');
    const r1 = runGate({
      pluginDir: fixture.root,
      releaseSha: fixture.sha,
      newVersion: releasedVersion,
      notifyCmd: makeArgvRecorderCmd(argvFile1),
    });
    assert.strictEqual(r1.status, 0, 'arm 5 first call must exit 0; got ' + r1.status);
    const payload1 = readPayload(argvFile1).payload;
    assert.strictEqual(payload1.version, releasedVersion, 'the recorded version must be the ARGUMENT, never the on-disk placeholder');
    assert.notStrictEqual(payload1.version, placeholderVersion, 'the recorded version must never equal the on-disk placeholder');

    // Mutate disk again between calls; the recorded version must not move.
    const rewrittenPlaceholder = '0.0.1-NEXT-VERSION-PLACEHOLDER-AGAIN';
    fs.writeFileSync(
      path.join(fixture.root, '.claude-plugin', 'plugin.json'),
      JSON.stringify({ name: 'mos-theo-notify-fixture', version: rewrittenPlaceholder }, null, 2) + '\n'
    );
    const argvFile2 = path.join(tmpRoot, 'arm5-argv-2.txt');
    const r2 = runGate({
      pluginDir: fixture.root,
      releaseSha: fixture.sha,
      newVersion: releasedVersion,
      notifyCmd: makeArgvRecorderCmd(argvFile2),
    });
    assert.strictEqual(r2.status, 0, 'arm 5 second call must exit 0; got ' + r2.status);
    const payload2 = readPayload(argvFile2).payload;
    assert.strictEqual(
      payload2.version, releasedVersion,
      'the recorded version must be unchanged across calls despite disk mutating between them'
    );
    ok('arm 5: the recorded version is always the argument, never the on-disk placeholder, even as disk mutates between calls');
  } finally {
    fixture.cleanup();
  }
}

// ---------------------------------------------------------------------------
// Arm 6: Canon Part 8 value shapes.
// ---------------------------------------------------------------------------
{
  const fixture = buildNotifyFixtureRepo({
    registryBytes: '{"arm":6}\n',
    pluginVersion: '0.0.1-placeholder',
  });
  try {
    const argvFile = path.join(tmpRoot, 'arm6-argv.txt');
    const releaseSha40Hex = fixture.sha; // git rev-parse HEAD is 40 hex characters
    const r = runGate({
      pluginDir: fixture.root,
      releaseSha: releaseSha40Hex,
      newVersion: '7.8.9-beta.1',
      notifyCmd: makeArgvRecorderCmd(argvFile),
    });
    assert.strictEqual(r.status, 0, 'arm 6 gate must exit 0; got ' + r.status);
    const { payload } = readPayload(argvFile);

    assert.match(payload.version, /^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/, 'version must match a semver-ish shape; got ' + payload.version);
    assert.match(payload.commit, /^[0-9a-f]{40}$/, 'commit must be 40 hex characters; got ' + payload.commit);
    assert.match(payload.registryHash, /^[0-9a-f]{64}$/, 'registryHash must be 64 hex characters; got ' + payload.registryHash);
    assert.strictEqual(
      payload.command_registry_path, 'data/command-registry.json',
      'command_registry_path must equal the literal string data/command-registry.json'
    );

    const allValues = [payload.version, payload.commit, payload.registryHash, payload.command_registry_path];
    for (const v of allValues) {
      assert.ok(v.indexOf('MindrianRooms') === -1, 'no payload value may contain MindrianRooms; got ' + v);
      assert.ok(v.indexOf('/home/') === -1, 'no payload value may contain a /home/ prefix; got ' + v);
      assert.ok(v.length <= 200, 'no payload value may exceed a sane length bound; got length ' + v.length + ' for ' + v);
    }
    ok('arm 6: every payload value matches its declared Canon Part 8 shape, with no room path and no user byte on the wire');
  } finally {
    fixture.cleanup();
  }
}

// ---------------------------------------------------------------------------
// Arm 7: the gate reaches no room and no Brain (comment-stripped source scan).
// ---------------------------------------------------------------------------
{
  const source = fs.readFileSync(GATE_LIB, 'utf8');
  const stripped = source
    .split('\n')
    .filter(function (line) { return !/^\s*#/.test(line); })
    .join('\n');
  assert.ok(stripped.indexOf('brain-client') === -1, 'theo-notify-gate.sh must never reference brain-client');
  assert.ok(stripped.indexOf('MindrianRooms') === -1, 'theo-notify-gate.sh must never reference MindrianRooms');
  assert.ok(stripped.indexOf('room.db') === -1, 'theo-notify-gate.sh must never reference room.db');
  assert.ok(stripped.indexOf('lib/core/navigation') === -1, 'theo-notify-gate.sh must never reference lib/core/navigation');
  ok('arm 7: a comment-stripped source scan proves the gate never requires brain-client.cjs, a room, room.db or lib/core/navigation');
}

fs.rmSync(tmpRoot, { recursive: true, force: true });

console.log('');
console.log(checks + ' checks passed.');
process.exit(0);

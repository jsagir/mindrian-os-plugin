'use strict';
/*
 * tests/test-366-snapshot-gate.cjs -- Phase 366 Plan 06 (D-17, EPV366-21).
 *
 * Proves scripts/release-lib/canon-snapshot-gate.sh's mos_canon_snapshot_gate
 * (RULE 5 place 9, canon snapshot freshness) hermetically: no network call,
 * ever. The snapshot is read through MINDRIAN_CANON_SNAPSHOT_PATH (a temp
 * file per arm) and the current version through MINDRIAN_PLUGIN_VERSION_CMD
 * (an `echo`), the two seams the gate exists to make testable. Shape copied
 * from tests/test-343-theo-stamp-gate.cjs (runGate).
 *
 * Arms:
 *   S1. stamped snapshot whose theo_stamp.mapped_by equals the version -> 0, PASS
 *   S2. mapped_by names an older version -> non-zero, LAGGING naming both versions
 *   S3. no theo_stamp at all -> non-zero, LAGGING "never been stamped" plus the
 *       refresh command
 *   S4. dry-run + lagging -> 0, DRY RUN + LAGGING still printed
 *   S5. no_check=1 -> 0, one audited SKIPPED line naming --no-canon-snapshot-check
 *   S6. unreadable or malformed snapshot -> READ FAILURE (never LAGGING),
 *       non-zero; under dry-run it reports and returns 0
 *   S7. refresh-framework-names.cjs: --check passes the committed snapshot
 *       without a stamp; validateSnapshot accepts a well-formed stamp and
 *       rejects a malformed one; runLive with an injected mappedBy reader
 *       writes theo_stamp {mapped_by, plugin_version, refreshed_at}
 *
 * Bare node script: assert, an ok(label) counter, non-zero exit on any
 * assertion failure. House rule: hyphens only, no em-dashes.
 */

for (const k of ['CLAUDE_ACTIVE_ROOM', 'CLAUDE_CODE_SESSION_ID']) delete process.env[k];

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-snapgate-'));
process.env.HOME = TMP;
process.env.USERPROFILE = TMP;
process.env.MINDRIAN_ROOMS_HOME = path.join(TMP, 'rooms');

const REPO = path.resolve(__dirname, '..');
const GATE_LIB = path.join(REPO, 'scripts', 'release-lib', 'canon-snapshot-gate.sh');
const REFRESH = path.join(REPO, 'scripts', 'refresh-framework-names.cjs');
const VERSION = '9.9.9-snapgate-test';

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

console.log('test-366-snapshot-gate:');

let fileSeq = 0;
function writeSnapshot(content) {
  fileSeq += 1;
  const p = path.join(TMP, 'snap-' + fileSeq + '.json');
  if (content === null) return p; // deliberately absent
  fs.writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  return p;
}

function baseSnapshot(extra) {
  return Object.assign({ snapshot_date: '2026-10-01', framework_names: ['Alpha'], curated_extras: [] }, extra || {});
}

function runGate({ snapshotPath, dryRun, noCheck }) {
  const env = Object.assign({}, process.env, {
    MINDRIAN_CANON_SNAPSHOT_PATH: snapshotPath,
    MINDRIAN_PLUGIN_VERSION_CMD: 'echo ' + VERSION,
  });
  const script = '. "' + GATE_LIB + '"; mos_canon_snapshot_gate "' + REPO + '" "' + (dryRun ? '1' : '0') + '" "' + (noCheck ? '1' : '0') + '"';
  const r = cp.spawnSync('bash', ['-c', script], { encoding: 'utf8', env: env, timeout: 15000 });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

function main() {
  assert.ok(fs.existsSync(GATE_LIB), 'scripts/release-lib/canon-snapshot-gate.sh must exist');

  // S1: pass.
  {
    const p = writeSnapshot(baseSnapshot({ theo_stamp: { mapped_by: 'command-registry@' + VERSION, plugin_version: VERSION, refreshed_at: '2026-10-01T00:00:00.000Z' } }));
    const r = runGate({ snapshotPath: p });
    assert.strictEqual(r.status, 0, 'S1 must exit 0; got ' + r.status + ' stdout=' + r.stdout + ' stderr=' + r.stderr);
    assert.match(r.stdout, /PASS/);
    assert.ok(r.stdout.indexOf(VERSION) !== -1, 'S1 pass line names the version');
    ok('S1: a snapshot stamped against the current version passes');
  }

  // S2: lagging.
  {
    const p = writeSnapshot(baseSnapshot({ theo_stamp: { mapped_by: 'command-registry@0.0.1', plugin_version: '0.0.1', refreshed_at: '2026-01-01T00:00:00.000Z' } }));
    const r = runGate({ snapshotPath: p });
    assert.notStrictEqual(r.status, 0, 'S2 must exit non-zero');
    assert.match(r.stdout, /LAGGING/);
    assert.ok(r.stdout.indexOf('0.0.1') !== -1, 'S2 names the stamped version');
    assert.ok(r.stdout.indexOf(VERSION) !== -1, 'S2 names the current version');
    assert.ok(!/READ FAILURE/.test(r.stdout), 'S2 is never a read failure');
    ok('S2: a snapshot stamped against an older version is LAGGING, naming both versions');
  }

  // S3: absent stamp.
  {
    const p = writeSnapshot(baseSnapshot());
    const r = runGate({ snapshotPath: p });
    assert.notStrictEqual(r.status, 0, 'S3 must exit non-zero');
    assert.match(r.stdout, /LAGGING/);
    assert.match(r.stdout, /never been stamped/);
    assert.ok(r.stdout.indexOf('node scripts/refresh-framework-names.cjs --live') !== -1, 'S3 names the refresh command');
    ok('S3: an unstamped snapshot is LAGGING, says it was never stamped and names the refresh command');
  }

  // S4: dry-run.
  {
    const p = writeSnapshot(baseSnapshot({ theo_stamp: { mapped_by: 'command-registry@0.0.1', plugin_version: '0.0.1', refreshed_at: '2026-01-01T00:00:00.000Z' } }));
    const r = runGate({ snapshotPath: p, dryRun: true });
    assert.strictEqual(r.status, 0, 'S4 dry-run must exit 0; got ' + r.status);
    assert.match(r.stdout, /DRY RUN/);
    assert.match(r.stdout, /LAGGING/);
    ok('S4: under dry-run a lagging snapshot reports and returns 0');
  }

  // S5: opt-out.
  {
    const p = writeSnapshot(baseSnapshot());
    const r = runGate({ snapshotPath: p, noCheck: true });
    assert.strictEqual(r.status, 0, 'S5 opt-out must exit 0');
    assert.match(r.stdout, /SKIPPED/);
    assert.match(r.stdout, /--no-canon-snapshot-check/);
    assert.strictEqual(r.stdout.trim().split('\n').length, 1, 'S5 prints exactly one audited line');
    ok('S5: --no-canon-snapshot-check prints one audited line and returns 0');
  }

  // S6: read failure.
  {
    const missing = runGate({ snapshotPath: writeSnapshot(null) });
    assert.notStrictEqual(missing.status, 0, 'S6 a missing snapshot must exit non-zero');
    assert.match(missing.stdout, /READ FAILURE/);
    assert.ok(!/LAGGING/.test(missing.stdout), 'a read failure is never reported as LAGGING');

    const malformed = runGate({ snapshotPath: writeSnapshot('{ not json') });
    assert.notStrictEqual(malformed.status, 0, 'S6 a malformed snapshot must exit non-zero');
    assert.match(malformed.stdout, /READ FAILURE/);

    const badStamp = runGate({ snapshotPath: writeSnapshot(baseSnapshot({ theo_stamp: { mapped_by: 42 } })) });
    assert.notStrictEqual(badStamp.status, 0, 'S6 a malformed theo_stamp must exit non-zero');
    assert.match(badStamp.stdout, /READ FAILURE/);

    const dry = runGate({ snapshotPath: writeSnapshot('{ not json'), dryRun: true });
    assert.strictEqual(dry.status, 0, 'S6 under dry-run a read failure reports and returns 0');
    assert.match(dry.stdout, /DRY RUN/);
    assert.match(dry.stdout, /READ FAILURE/);
    ok('S6: a missing, malformed or badly stamped snapshot is a READ FAILURE, fail closed except under dry-run');
  }

  // S7: refresh-framework-names.cjs stamp support.
  {
    const check = cp.spawnSync(process.execPath, [REFRESH, '--check'], { encoding: 'utf8', timeout: 30000 });
    assert.strictEqual(check.status, 0, '--check must pass the committed snapshot; got ' + check.status + ' ' + check.stdout + check.stderr);

    const mod = require(REFRESH);
    const committed = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'framework-names.json'), 'utf8'));
    const unstamped = Object.assign({}, committed);
    delete unstamped.theo_stamp;
    assert.strictEqual(mod.validateSnapshot(unstamped).valid, true, 'an absent theo_stamp is valid');
    const stamped = Object.assign({}, unstamped, { theo_stamp: { mapped_by: 'command-registry@1.2.3', plugin_version: '1.2.3', refreshed_at: '2026-10-01T00:00:00.000Z' } });
    assert.strictEqual(mod.validateSnapshot(stamped).valid, true, 'a well-formed theo_stamp is valid');
    const bad = Object.assign({}, unstamped, { theo_stamp: { mapped_by: '', plugin_version: 3 } });
    const badResult = mod.validateSnapshot(bad);
    assert.strictEqual(badResult.valid, false, 'a malformed theo_stamp is invalid');
    assert.ok(badResult.errors.some((e) => /theo_stamp/.test(e)), 'the error names theo_stamp');

    // runLive with injected Theo reads (no network): writes the stamp.
    const rows = [];
    for (let i = 0; i < mod.MIN_LIVE_NAMES; i++) rows.push({ name: 'Framework ' + String(i).padStart(4, '0') });
    let written = null;
    const now = new Date('2026-10-01T12:00:00.000Z');
    return Promise.resolve()
      .then(() => mod.runLive({
        askOp: async () => ({ rows }),
        readMappedBy: async () => 'command-registry@' + VERSION,
        pluginVersion: VERSION,
        prior: { framework_names: [], curated_extras: [] },
        referencedBy: () => null,
        now,
        fwNamesPath: path.join(TMP, 'never-written.json'),
        write: (_p, s) => { written = s; },
      }))
      .then((res) => {
        assert.strictEqual(res.ok, true, 'runLive ok: ' + res.message);
        assert.ok(written && written.theo_stamp, 'runLive wrote a theo_stamp');
        assert.deepStrictEqual(written.theo_stamp, { mapped_by: 'command-registry@' + VERSION, plugin_version: VERSION, refreshed_at: now.toISOString() });
        assert.strictEqual(mod.validateSnapshot(written).valid, true, 'the stamped snapshot validates');

        // The stamped file the refresh writes passes the gate.
        const gp = writeSnapshot(written);
        const r = runGate({ snapshotPath: gp });
        assert.strictEqual(r.status, 0, 'the refresh output passes the gate; stdout=' + r.stdout);

        // An unreadable mappedBy writes names but no stamp, and says so.
        written = null;
        return mod.runLive({
          askOp: async () => ({ rows }),
          readMappedBy: async () => '',
          pluginVersion: VERSION,
          prior: { framework_names: [], curated_extras: [] },
          referencedBy: () => null,
          now,
          fwNamesPath: path.join(TMP, 'never-written.json'),
          write: (_p, s) => { written = s; },
        });
      })
      .then((res2) => {
        assert.notStrictEqual(res2.code, 0, 'an unreadable mappedBy is a non-zero refresh');
        assert.ok(written && !('theo_stamp' in written), 'no stamp is invented when mappedBy is unreadable');
        assert.match(res2.message, /theo_stamp/);

        // Injected askOp with no readMappedBy (the 355 test posture) never stamps and never dials Theo.
        written = null;
        return mod.runLive({
          askOp: async () => ({ rows }),
          prior: { framework_names: [], curated_extras: [] },
          referencedBy: () => null,
          now,
          fwNamesPath: path.join(TMP, 'never-written.json'),
          write: (_p, s) => { written = s; },
        });
      })
      .then((res3) => {
        assert.strictEqual(res3.ok, true, 'an injected askOp alone still refreshes');
        assert.ok(!('theo_stamp' in written), 'no stamp without a mappedBy reader under injection');
        const bcLoaded = Object.keys(require.cache).some((k) => k.indexOf(path.join('lib', 'core', 'brain-client.cjs')) !== -1);
        assert.strictEqual(bcLoaded, false, 'brain-client is never loaded by an injected run');
        ok('S7: --check passes unstamped; validateSnapshot checks the stamp shape; --live stamps {mapped_by, plugin_version, refreshed_at}');
        console.log('');
        console.log(checks + ' checks passed.');
      });
  }
}

Promise.resolve()
  .then(main)
  .then(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
  }, (e) => {
    fs.rmSync(TMP, { recursive: true, force: true });
    console.error('FAIL: ' + (e && e.stack ? e.stack : String(e)));
    process.exit(1);
  });

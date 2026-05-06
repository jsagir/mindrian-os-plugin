#!/usr/bin/env node
'use strict';

/*
 * Phase 95.2-01 -- unit tests for scripts/doctor-preflight-format.cjs.
 *
 * Covers library mode + CLI mode + NO_COLOR/MOS_NO_COLOR + parse-error + healthy.
 */

const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const FORMATTER = path.join(REPO, 'scripts', 'doctor-preflight-format.cjs');
const { formatPreflightWarning } = require(FORMATTER);

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  ok ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

// ---------- Library tests ----------
(function t1_healthy() {
  const label = 'T1: healthy report -> empty string';
  try {
    const out = formatPreflightWarning({ install: { status: 'ok' }, drift: { detected: false } }, { color: true });
    assert.equal(out, '', label);
    ok(label);
  } catch (err) { fail(label, err); }
})();

(function t2_missingWithColor() {
  const label = 'T2: missing install + color -> yellow ANSI line containing "missing"';
  try {
    const out = formatPreflightWarning(
      { install: { status: 'missing', recoverable: true }, drift: { detected: true, reason: 'install-missing' } },
      { color: true }
    );
    assert.match(out, /\x1b\[33m/, label + ': has yellow ANSI prefix');
    assert.match(out, /MindrianOS install dir missing/, label + ': says "missing"');
    assert.match(out, /\x1b\[0m/, label + ': has reset ANSI suffix');
    ok(label);
  } catch (err) { fail(label, err); }
})();

(function t3_driftedNoColor() {
  const label = 'T3: drifted install + no color -> plain string with no ANSI';
  try {
    const out = formatPreflightWarning(
      { install: { status: 'ok' }, drift: { detected: true } },
      { color: false }
    );
    assert.match(out, /MindrianOS install dir drifted/, label + ': says "drifted"');
    assert.doesNotMatch(out, /\x1b\[/, label + ': no ANSI escapes');
    ok(label);
  } catch (err) { fail(label, err); }
})();

(function t4_backupPath() {
  const label = 'T4: explicit backupDir included in output';
  try {
    const out = formatPreflightWarning(
      { install: { status: 'missing' }, drift: { detected: true } },
      { color: false, backupDir: '/x/.claude/plugins/mindrian-os.stale-1.10.0-20260506-120000' }
    );
    assert.match(out, /Backup: \/x\/\.claude\/plugins\/mindrian-os\.stale-1\.10\.0-20260506-120000\./, label);
    ok(label);
  } catch (err) { fail(label, err); }
})();

// ---------- CLI tests (spawnSync) ----------
function spawnFormatter(stdinJson, env) {
  return spawnSync('node', [FORMATTER], {
    input: stdinJson,
    encoding: 'utf8',
    timeout: 3000,
    env: Object.assign({}, process.env, env || {}),
  });
}

(function t5_cliMissing() {
  const label = 'T5: CLI mode emits warning when drift detected (no color)';
  try {
    const json = JSON.stringify({ install: { status: 'missing' }, drift: { detected: true, reason: 'install-missing' } });
    const res = spawnFormatter(json, { NO_COLOR: '1' });
    assert.equal(res.status, 0, label + ': exit 0');
    assert.match(res.stdout, /MindrianOS install dir missing/, label + ': stdout has warning');
    ok(label);
  } catch (err) { fail(label, err); }
})();

(function t6_cliNoColor() {
  const label = 'T6: NO_COLOR=1 strips ANSI in CLI mode';
  try {
    const json = JSON.stringify({ install: { status: 'missing' }, drift: { detected: true } });
    const res = spawnFormatter(json, { NO_COLOR: '1' });
    assert.doesNotMatch(res.stdout, /\x1b\[/, label + ': no ANSI');
    ok(label);
  } catch (err) { fail(label, err); }
})();

(function t7_cliMosNoColor() {
  const label = 'T7: MOS_NO_COLOR=1 strips ANSI in CLI mode (parity with CONTEXT.md D-09)';
  try {
    const json = JSON.stringify({ install: { status: 'missing' }, drift: { detected: true } });
    // Explicitly clear NO_COLOR so we're testing MOS_NO_COLOR alone
    const env = Object.assign({}, process.env);
    delete env.NO_COLOR;
    env.MOS_NO_COLOR = '1';
    const res = spawnSync('node', [FORMATTER], { input: json, encoding: 'utf8', timeout: 3000, env });
    assert.doesNotMatch(res.stdout, /\x1b\[/, label + ': no ANSI');
    ok(label);
  } catch (err) { fail(label, err); }
})();

(function t8_cliGarbage() {
  const label = 'T8: garbage on stdin -> exit 0, empty stdout';
  try {
    const res = spawnFormatter('not json at all }{][', {});
    assert.equal(res.status, 0, label + ': exit 0');
    assert.equal(res.stdout, '', label + ': empty stdout');
    ok(label);
  } catch (err) { fail(label, err); }
})();

(function t9_cliHealthy() {
  const label = 'T9: healthy report on stdin -> exit 0, empty stdout';
  try {
    const json = JSON.stringify({ install: { status: 'ok' }, drift: { detected: false } });
    const res = spawnFormatter(json, {});
    assert.equal(res.status, 0, label + ': exit 0');
    assert.equal(res.stdout, '', label + ': empty stdout');
    ok(label);
  } catch (err) { fail(label, err); }
})();

process.stdout.write('\n' + (failed === 0 ? 'ok' : 'FAIL') + ' ' + passed + '/' + (passed + failed) + ' formatter scenarios passed\n');
process.exit(failed === 0 ? 0 : 1);

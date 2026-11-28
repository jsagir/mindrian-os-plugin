'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { measurePayload } = require('../scripts/check-release-payload-ceiling.cjs');

const ROOT = path.resolve(__dirname, '..');
function payloadLeg(measured) {
  if (!measured || measured.ok !== true) return { ok: false, error: measured && measured.reason ? measured.reason : 'payload measurement failed' };
  if (!Array.isArray(measured.payload && measured.payload.files) || measured.payload.files.length === 0) return { ok: false, error: 'payload files are missing' };
  const paths = measured.payload.files.map((file) => file.path);
  const shipped = shippedOperatorFiles(paths);
  return shipped.length ? { ok: false, error: 'operator files shipped: ' + shipped.join(', ') } : { ok: true };
}
function shippedOperatorFiles(paths) {
  return paths.filter((item) => item.startsWith('tools/') || item.endsWith('brain-admin.cjs'));
}
function runLeg(id, label, fn) {
  try {
    fn();
    console.log('ok: ' + id + ' ' + label);
    return true;
  } catch (error) {
    console.log('FAIL: ' + id + ' ' + label + ' -- ' + String(error && error.message || error));
    return false;
  }
}
function main() {
  let passed = 0;
  let failed = 0;
  const report = (id, label, fn) => { if (runLeg(id, label, fn)) passed += 1; else failed += 1; };
  const manifest = require(path.join(ROOT, 'package.json'));
  const measured = measurePayload(ROOT);
  report('P1', 'package files exclude tools', () => {
    assert.ok(Array.isArray(manifest.files), 'package files list is missing');
    assert.ok(!manifest.files.some((item) => item === 'tools' || item.startsWith('tools/')), 'package files includes tools');
  });
  report('P2', 'payload excludes operator file paths', () => {
    const planted = payloadLeg({ ok: false, reason: 'x' });
    assert.equal(planted.ok, false, 'failed measurement must fail the leg');
    const result = payloadLeg(measured);
    assert.equal(result.ok, true, result.error);
  });
  report('P3', 'operator file classifier', () => {
    assert.deepEqual(shippedOperatorFiles(['tools/brain-admin/brain-admin.cjs', 'lib/brain.cjs']), ['tools/brain-admin/brain-admin.cjs']);
    assert.ok(measured.ok, measured.reason || 'payload measurement failed');
    assert.deepEqual(shippedOperatorFiles(measured.payload.files.map((file) => file.path)), []);
  });
  report('P4', 'operator tool exists in tree', () => {
    assert.ok(require('node:fs').existsSync(path.join(ROOT, 'tools/brain-admin/brain-admin.cjs')));
  });
  console.log('test-401-admin-tool-not-shipped: ' + passed + ' passed, ' + failed + ' failed');
  if (failed) process.exitCode = 1;
}
if (require.main === module) main();
module.exports = { shippedOperatorFiles, payloadLeg };

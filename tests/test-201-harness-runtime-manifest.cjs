'use strict';
// Phase 201-01 -- runtime-surface harness manifest (SEED-032).
//
// The harness's RUNTIME surfaces (runChain spine, decide engine, cockpit,
// brain-orchestration reader) are declared in their OWN sibling manifest
// (data/harness-runtime-manifest.json) as { role, path, digest } so they cannot
// silently diverge from the on-disk harness. Crucially this leaves the LOCKED
// 3-map digest (data/harness-manifest.json) and its Part-8 boundary test untouched.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const REPO = path.join(__dirname, '..');
const gen = require(path.join(REPO, 'scripts', 'build-harness-runtime-manifest.cjs'));
const MANIFEST = path.join(REPO, 'data', 'harness-runtime-manifest.json');
const LOCKED_3MAP = path.join(REPO, 'data', 'harness-manifest.json');

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-201-harness-runtime-manifest');

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

ok('declares the four runtime surfaces with digest-only entries', function () {
  const roles = manifest.surfaces.map((s) => s.role);
  for (const r of ['orchestration_spine', 'decide_engine', 'cockpit', 'brain_orchestration']) {
    assert.equal(roles.includes(r), true, 'missing runtime surface role ' + r);
  }
  for (const s of manifest.surfaces) {
    assert.deepStrictEqual(Object.keys(s).sort(), ['digest', 'path', 'role']);
  }
});

ok('each declared digest equals the on-disk file sha256 (no drift)', function () {
  for (const s of manifest.surfaces) {
    const buf = fs.readFileSync(path.join(REPO, s.path));
    const actual = crypto.createHash('sha256').update(buf).digest('hex');
    assert.equal(s.digest, actual, 'digest drift for ' + s.path);
  }
});

ok('--check (validateManifest) is clean on the committed manifest', function () {
  const v = gen.validateManifest();
  assert.deepStrictEqual(v.stale, []);
  assert.deepStrictEqual(v.unresolved, []);
  assert.deepStrictEqual(v.malformed, []);
});

ok('--check FAILS closed when a surface file drifts (tamper the manifest)', function () {
  const original = fs.readFileSync(MANIFEST, 'utf8');
  try {
    const tampered = JSON.parse(original);
    tampered.surfaces[0].digest = 'deadbeef'.repeat(8); // fake 64-hex digest
    fs.writeFileSync(MANIFEST, JSON.stringify(tampered, null, 2) + '\n');
    const v = gen.validateManifest();
    assert.equal(v.stale.length >= 1, true, 'tampered digest must be flagged STALE');
  } finally {
    fs.writeFileSync(MANIFEST, original); // restore
  }
  // Confirm restore is clean again.
  assert.deepStrictEqual(gen.validateManifest().stale, []);
});

ok('Part 8: only allowlisted fields, digest-only (no file contents leak)', function () {
  for (const k of Object.keys(manifest)) {
    assert.equal(gen.NODE_FIELD_ALLOWLIST.includes(k), true, 'unexpected top-level key ' + k);
  }
  const blob = JSON.stringify(manifest);
  // A digest is 64 hex chars; the surface files are large -- assert no surface body leaked.
  assert.equal(/function |require\(|module\.exports/.test(blob), false, 'no source code in the manifest');
});

ok('the LOCKED 3-map manifest is UNTOUCHED (still exactly 3 maps, no runtime_surfaces)', function () {
  const locked = JSON.parse(fs.readFileSync(LOCKED_3MAP, 'utf8'));
  assert.equal(Array.isArray(locked.maps), true);
  assert.equal(locked.maps.length, 3, 'the 3-map digest must stay exactly three maps');
  assert.equal(Object.prototype.hasOwnProperty.call(locked, 'surfaces'), false,
    'runtime surfaces must NOT bleed into the locked 3-map manifest');
  assert.equal(Object.prototype.hasOwnProperty.call(locked, 'runtime_surfaces'), false);
});

console.log('\nPASS test-201-harness-runtime-manifest (' + n + ' assertions)');

'use strict';
/*
 * Phase 201-01 (SEED-032, D-201-1) - the harness manifest declares the RUNTIME
 * surfaces too.
 *
 * SEED-032's framing is Agent = Model + Harness. The manifest (Phase 167-01)
 * declared only the three DATA maps; this phase makes the harness's RUNTIME
 * surfaces - the runChain spine, the decide() engine, the statusline cockpit, the
 * brain-orchestration reader - declared, digested, and drift-checked IN THE SAME
 * single manifest (data/harness-manifest.json), via the SAME generator
 * (scripts/build-harness-manifest.cjs). It is a descriptor, not a second registry
 * (Canon Part 11), it adds no framework (Part 7), it retires no map (D-166-03),
 * and it opens no Brain wire (Part 8).
 *
 * Task 1 - the generator digests the four runtime surfaces (length 4, the four
 *          roles, each digest == the on-disk file's sha256); the committed manifest
 *          carries the runtime_surfaces block AND still EXACTLY three maps.
 * Task 2 - --check fails closed on runtime-surface drift: a tampered committed
 *          digest yields a role-named STALE finding and a non-zero --check exit.
 * Task 3 - recipe-maps.loadManifest() surfaces runtime_surfaces AND the three
 *          read-joins (postureForCommand / wiringForReach / rankedNextReach) are
 *          unchanged (regression guard against the additive schema change).
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const GEN_PATH = path.join(REPO_ROOT, 'scripts', 'build-harness-manifest.cjs');
const MANIFEST_PATH = path.join(REPO_ROOT, 'data', 'harness-manifest.json');
const RECIPE_MAPS_PATH = path.join(REPO_ROOT, 'lib', 'core', 'recipe-maps.cjs');

const gen = require(GEN_PATH);
const recipeMaps = require(RECIPE_MAPS_PATH);

const EXPECTED_SURFACE_ROLES = [
  'orchestration_spine',
  'decide_engine',
  'cockpit',
  'brain_orchestration',
];
const EXPECTED_MAP_ROLES = ['posture', 'wiring', 'ranked_next_reach'];

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  PASS ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

function sha256File(rel) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(REPO_ROOT, rel))).digest('hex');
}

// ---------------------------------------------------------------------------
// TASK 1 - the generator digests the four runtime surfaces.
// ---------------------------------------------------------------------------
(function task1_generatorDigestsSurfaces() {
  const label = 'Task 1 - generator declares runtime_surfaces (length 4, four roles, digest == on-disk sha256)';
  try {
    const m = gen.buildManifest();
    assert.ok(Array.isArray(m.runtime_surfaces),
      label + ': buildManifest() carries a runtime_surfaces array');
    assert.equal(m.runtime_surfaces.length, 4,
      label + ': exactly four runtime surfaces');

    const roles = m.runtime_surfaces.map((s) => s.role).sort();
    assert.deepEqual(roles, [...EXPECTED_SURFACE_ROLES].sort(),
      label + ': the four roles are orchestration_spine / decide_engine / cockpit / brain_orchestration');

    for (const s of m.runtime_surfaces) {
      // Digest-only (D-201-1): EXACTLY { role, path, digest }, no source_count,
      // no richer per-surface schema.
      assert.equal(Object.keys(s).sort().join(','), 'digest,path,role',
        label + ': entry ' + JSON.stringify(s.role) + ' is digest-only { role, path, digest }');
      assert.ok(/^[0-9a-f]{64}$/.test(s.digest),
        label + ': digest is sha256 hex (machinery metadata)');
      assert.equal(s.digest, sha256File(s.path),
        label + ': ' + s.role + ' digest equals the on-disk sha256 of ' + s.path);
    }
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// TASK 1 (additive guard) - the SINGLE committed manifest carries the block AND
// still EXACTLY three maps (D-166-03: no map retired; Part 11: not a second
// registry - it lives in the same file), and byte-matches the regeneration.
// ---------------------------------------------------------------------------
(function task1_committedManifestAdditive() {
  const label = 'Task 1 - committed manifest is additive (3 maps preserved + runtime_surfaces in the SAME file)';
  try {
    const onDisk = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    assert.ok(Array.isArray(onDisk.maps), label + ': committed manifest has maps');
    assert.equal(onDisk.maps.length, 3,
      label + ': EXACTLY three data maps (D-166-03, no map retired)');
    assert.deepEqual(onDisk.maps.map((e) => e.role).sort(), [...EXPECTED_MAP_ROLES].sort(),
      label + ': the three map roles are unchanged');
    assert.ok(Array.isArray(onDisk.runtime_surfaces),
      label + ': the runtime_surfaces block lives in the SAME manifest (not a sibling registry)');
    assert.equal(onDisk.runtime_surfaces.length, 4, label + ': four runtime surfaces committed');

    // Byte-stable: the committed file equals the regeneration.
    const regen = gen.serializeManifest(gen.buildManifest());
    assert.equal(fs.readFileSync(MANIFEST_PATH, 'utf8'), regen,
      label + ': committed data/harness-manifest.json is byte-identical to the regeneration');

    // Part 8 additive-allowlist: runtime_surfaces is a declared machinery field.
    assert.ok(gen.NODE_FIELD_ALLOWLIST.includes('runtime_surfaces'),
      label + ': runtime_surfaces is on the top-level field allowlist');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// TASK 2 - --check fails closed on a runtime-surface digest drift, naming the
// role. We tamper a COPY-in-place of the committed manifest digest, assert both
// validateManifest (role-named STALE) and the real --check subprocess (exit 1),
// then restore the byte-identical original.
// ---------------------------------------------------------------------------
(function task2_checkFailsClosedOnSurfaceDrift() {
  const label = 'Task 2 - --check fails closed on runtime-surface drift (role-named STALE + exit 1)';
  const original = fs.readFileSync(MANIFEST_PATH, 'utf8');
  try {
    // Clean baseline: no drift.
    const clean = gen.validateManifest(gen.buildManifest());
    assert.equal(
      clean.stale.filter((s) => /runtime surface/.test(s)).length, 0,
      label + ': a clean repo reports zero runtime-surface drift');

    // Tamper the committed manifest: flip orchestration_spine's digest to a
    // well-formed but wrong hex. buildManifest() still reads the LIVE file, so
    // the on-disk file digest and the committed declaration now diverge.
    const tampered = JSON.parse(original);
    const target = tampered.runtime_surfaces.find((s) => s.role === 'orchestration_spine');
    target.digest = 'deadbeef'.repeat(8);
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(tampered, null, 2) + '\n');

    const drifted = gen.validateManifest(gen.buildManifest());
    const roleNamed = drifted.stale.filter(
      (s) => /runtime surface/.test(s) && /orchestration_spine/.test(s));
    assert.ok(roleNamed.length >= 1,
      label + ': the drift STALE finding names the drifting role (orchestration_spine)');

    // The real --check subprocess must exit non-zero and print the role.
    let exitCode = 0;
    let stderr = '';
    try {
      execFileSync('node', [GEN_PATH, '--check'],
        { cwd: REPO_ROOT, stdio: ['ignore', 'ignore', 'pipe'] });
    } catch (err) {
      exitCode = err.status;
      stderr = String(err.stderr || '');
    }
    assert.equal(exitCode, 1, label + ': --check exits 1 on runtime-surface drift');
    assert.ok(/orchestration_spine/.test(stderr),
      label + ': --check stderr names the drifting runtime-surface role');
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    // Restore the byte-identical committed manifest.
    fs.writeFileSync(MANIFEST_PATH, original);
  }
})();

// ---------------------------------------------------------------------------
// TASK 2 (restore guard) - after restore, --check is green again.
// ---------------------------------------------------------------------------
(function task2_greenAfterRestore() {
  const label = 'Task 2 - --check is green again after the tamper is restored';
  try {
    const v = gen.validateManifest(gen.buildManifest());
    assert.deepEqual(v.stale, [], label + ': zero STALE');
    assert.deepEqual(v.unresolved, [], label + ': zero UNRESOLVED');
    assert.deepEqual(v.malformed, [], label + ': zero MALFORMED');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// TASK 3 - recipe-maps.loadManifest() surfaces runtime_surfaces; the three
// read-joins are unchanged (additive-schema regression guard).
// ---------------------------------------------------------------------------
(function task3_readerTolerant() {
  const label = 'Task 3 - loadManifest surfaces runtime_surfaces; postureForCommand / wiringForReach / rankedNextReach unchanged';
  try {
    recipeMaps.__reset();
    const binding = recipeMaps.loadManifest();
    assert.ok(binding && typeof binding === 'object', label + ': loadManifest returns an object');
    // Still the three maps (unchanged accessor).
    assert.ok(Array.isArray(binding.maps) && binding.maps.length === 3,
      label + ': the three-map binding is intact');
    // The additive runtime_surfaces block is surfaced.
    assert.ok(Array.isArray(binding.runtime_surfaces),
      label + ': loadManifest surfaces runtime_surfaces');
    assert.equal(binding.runtime_surfaces.length, 4,
      label + ': four runtime surfaces read through');
    assert.deepEqual(binding.runtime_surfaces.map((s) => s.role).sort(),
      [...EXPECTED_SURFACE_ROLES].sort(),
      label + ': the four runtime-surface roles read through');

    // The three read-joins still answer in the same shapes (D-166-03 guard).
    const posture = recipeMaps.postureForCommand('/mos:think-hats');
    assert.ok(posture && typeof posture === 'object', label + ': postureForCommand returns an object');
    assert.equal(posture.command, '/mos:think-hats', label + ': posture echoes the command');
    assert.equal(typeof posture.autonomous_safe, 'boolean', label + ': posture carries autonomous_safe');

    assert.ok(Array.isArray(recipeMaps.wiringForReach('hats')),
      label + ': wiringForReach still returns an array');
    assert.ok(Array.isArray(recipeMaps.rankedNextReach()),
      label + ': rankedNextReach still returns an array');
    recipeMaps.__reset();
    ok(label);
  } catch (e) { fail(label, e); }
})();

process.stdout.write('\n');
process.stdout.write(
  'test-201-harness-manifest: ' + passed + ' passed, ' + failed + ' failed\n'
);
process.exit(failed === 0 ? 0 : 1);

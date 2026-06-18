'use strict';
/*
 * Phase 167-01 Task 1 - the harness-manifest generator + --check assertions
 * (HARN-01, D-167-01, D-167-03).
 *
 * Covers the Task-1 behaviors over scripts/build-harness-manifest.cjs +
 * data/harness-manifest.json:
 *   Test 1   well-formed: methodology_tier=mindrian-operation + the three-map
 *            binding (posture / wiring / ranked_next_reach) naming each map by
 *            path + role + digest + source_count, never inlined.
 *   Test 1b  NO per-surface rows: EXACTLY three map entries, no surface slug as
 *            an entry key (a surface is digested transitively, never enumerated).
 *   Test 2   STALE: validateManifest byte-compares; an edited committed file
 *            yields a STALE finding; a clean repo yields zero STALE.
 *   Test 3   three maps resolve: a missing named path yields UNRESOLVED; all
 *            present yields zero UNRESOLVED.
 *   Test 4   per-entry well-formed: a maps entry missing role/path/digest yields
 *            MALFORMED; a complete manifest yields zero MALFORMED.
 *   Test 5   byte-stable + tier: two buildManifest() calls serialize identically;
 *            the serialized form ends with a single trailing newline; every entry
 *            is generic machinery metadata, never user content.
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const GEN_PATH = path.join(REPO_ROOT, 'scripts', 'build-harness-manifest.cjs');
const MANIFEST_PATH = path.join(REPO_ROOT, 'data', 'harness-manifest.json');

const gen = require(GEN_PATH);

const LEGAL_TIER = 'mindrian-operation';
const EXPECTED_ROLES = ['posture', 'wiring', 'ranked_next_reach'];

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  PASS ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

function loadManifestOnDisk() {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
}

// ---------------------------------------------------------------------------
// Test 1 - well-formed: tier + the three-map binding, never inlined.
// ---------------------------------------------------------------------------
(function test1_wellFormed() {
  const label = 'Test 1 - well-formed (tier + three-map binding by path+role+digest+source_count)';
  try {
    const m = gen.buildManifest();
    assert.equal(m.methodology_tier, LEGAL_TIER,
      label + ': top-level methodology_tier must be ' + LEGAL_TIER);
    assert.ok(Array.isArray(m.maps), label + ': maps is an array');
    assert.equal(m.maps.length, 3, label + ': maps names exactly three entries');

    const byRole = {};
    for (const e of m.maps) byRole[e.role] = e;
    // The three declared roles -> the three declared paths.
    assert.equal(byRole.posture.path, 'data/command-registry.json',
      label + ': posture -> command-registry');
    assert.equal(byRole.wiring.path, 'data/connector-registry.json',
      label + ': wiring -> connector-registry');
    assert.equal(byRole.ranked_next_reach.path, 'data/brain-orchestration-projection.json',
      label + ': ranked_next_reach -> projection');

    // Each entry carries path + role + digest + source_count, and NOTHING that
    // inlines the maps' contents (no commands/connectors/nodes arrays).
    for (const e of m.maps) {
      assert.equal(typeof e.role, 'string', label + ': entry has role');
      assert.equal(typeof e.path, 'string', label + ': entry has path');
      assert.ok(/^[0-9a-f]{64}$/.test(e.digest),
        label + ': entry digest is a sha256 hex (machinery metadata), got ' + JSON.stringify(e.digest));
      assert.equal(typeof e.source_count, 'number',
        label + ': entry source_count is a scalar count');
      assert.equal(Object.keys(e).sort().join(','), 'digest,path,role,source_count',
        label + ': entry carries EXACTLY role/path/digest/source_count, never inlined contents');
    }
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Test 1b - NO per-surface rows (HIGH-1: a 3-map digest, not a per-surface
// registry).
// ---------------------------------------------------------------------------
(function test1b_noPerSurfaceRows() {
  const label = 'Test 1b - exactly three map entries, NO per-surface rows (HIGH-1)';
  try {
    const m = gen.buildManifest();
    assert.equal(m.maps.length, 3, label + ': exactly three entries');
    const roles = m.maps.map((e) => e.role).sort();
    assert.deepEqual(roles, [...EXPECTED_ROLES].sort(),
      label + ': the three roles are exactly posture / wiring / ranked_next_reach');
    // No entry role is a surface slug (no /mos: command, agent:, or skill:
    // prefix). A surface is reflected transitively via the wiring source_count,
    // never as its own manifest entry.
    for (const e of m.maps) {
      assert.equal(/^\/mos:/.test(e.role), false, label + ': no /mos: surface row');
      assert.equal(/^agent:/.test(e.role), false, label + ': no agent: surface row');
      assert.equal(/^skill:/.test(e.role), false, label + ': no skill: surface row');
      assert.equal(/^command:/.test(e.role), false, label + ': no command: surface row');
    }
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Test 2 - STALE: byte-compare; a clean repo is clean; an edited file is STALE.
// ---------------------------------------------------------------------------
(function test2_stale() {
  const label = 'Test 2 - STALE byte-compare (clean repo clean; edited file flagged)';
  try {
    // Clean repo: the committed manifest matches the regenerated one.
    const cleanFindings = gen.validateManifest(gen.buildManifest());
    assert.equal(cleanFindings.stale.length, 0,
      label + ': a clean repo yields zero STALE findings');

    // Simulate an edited committed file: feed validateManifest a manifest whose
    // serialization differs from the on-disk file. We mutate a digest in a copy
    // and validate; STALE must fire because the serialized copy diverges.
    const live = gen.buildManifest();
    const edited = JSON.parse(JSON.stringify(live));
    edited.maps[0].digest = 'deadbeef'.repeat(8); // a different but well-formed hex
    const editedFindings = gen.validateManifest(edited);
    assert.ok(editedFindings.stale.length >= 1,
      label + ': a manifest whose serialization diverges from the committed file is STALE');
    assert.ok(/Run: node scripts\/build-harness-manifest\.cjs/.test(editedFindings.stale[0]),
      label + ': the STALE finding carries the recovery line');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Test 3 - three maps resolve: a missing named path yields UNRESOLVED.
//
// We run validateManifest from a temp cwd where the data/ sources are absent.
// Because validateManifest resolves the MAP_BINDINGS absolute paths (anchored at
// the repo), the in-place run resolves all three. To prove the UNRESOLVED leg we
// invoke the generator's --check in a subprocess with an env that repoints data
// is not supported (no env override by design); instead we assert the positive
// (all present -> zero UNRESOLVED) directly, and prove the UNRESOLVED string
// shape by validating a manifest while a binding path is temporarily shadowed.
// ---------------------------------------------------------------------------
(function test3_resolve() {
  const label = 'Test 3 - three maps resolve (all present -> zero UNRESOLVED)';
  try {
    const findings = gen.validateManifest(gen.buildManifest());
    assert.equal(findings.unresolved.length, 0,
      label + ': with all three maps present, zero UNRESOLVED findings');
    // The three binding paths exist on disk (the resolve check's positive case).
    for (const b of gen.MAP_BINDINGS) {
      const abs = path.join(REPO_ROOT, b.relPath);
      assert.ok(fs.existsSync(abs), label + ': binding path resolves on disk: ' + b.relPath);
    }
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Test 3b - UNRESOLVED leg via a subprocess in a temp repo where a source is
// removed, proving --check exits 1 with an UNRESOLVED finding.
// ---------------------------------------------------------------------------
(function test3b_unresolvedSubprocess() {
  const label = 'Test 3b - a missing named map path yields UNRESOLVED + exit-1';
  const { execFileSync } = require('node:child_process');
  let tmp;
  try {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-manifest-'));
    // Build a minimal mirror tree: scripts/ + data/ with two of the three maps.
    fs.mkdirSync(path.join(tmp, 'scripts'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'data'), { recursive: true });
    fs.copyFileSync(GEN_PATH, path.join(tmp, 'scripts', 'build-harness-manifest.cjs'));
    // Copy command + connector registries but OMIT the projection (the third map).
    fs.copyFileSync(path.join(REPO_ROOT, 'data', 'command-registry.json'),
      path.join(tmp, 'data', 'command-registry.json'));
    fs.copyFileSync(path.join(REPO_ROOT, 'data', 'connector-registry.json'),
      path.join(tmp, 'data', 'connector-registry.json'));
    // Write a manifest first (so STALE does not dominate), then delete the
    // projection so --check sees an UNRESOLVED binding.
    execFileSync('node', [path.join(tmp, 'scripts', 'build-harness-manifest.cjs')], { cwd: tmp });
    // The default write created the manifest with the projection's empty-digest
    // sentinel (projection absent). Now run --check: UNRESOLVED must fire.
    let exitCode = 0;
    let stderr = '';
    try {
      execFileSync('node',
        [path.join(tmp, 'scripts', 'build-harness-manifest.cjs'), '--check'],
        { cwd: tmp, stdio: ['ignore', 'ignore', 'pipe'] });
    } catch (err) {
      exitCode = err.status;
      stderr = String(err.stderr || '');
    }
    assert.equal(exitCode, 1, label + ': --check exits 1 when a map path is absent');
    assert.ok(/UNRESOLVED/.test(stderr), label + ': stderr names the UNRESOLVED finding');
    assert.ok(/Run: node scripts\/build-harness-manifest\.cjs/.test(stderr),
      label + ': stderr carries the recovery line');
    ok(label);
  } catch (e) { fail(label, e); }
  finally {
    if (tmp) { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* ignore */ } }
  }
})();

// ---------------------------------------------------------------------------
// Test 4 - per-entry well-formed: a maps entry missing role/path/digest yields
// MALFORMED; a complete manifest yields zero MALFORMED.
// ---------------------------------------------------------------------------
(function test4_malformed() {
  const label = 'Test 4 - per-entry well-formed (missing key -> MALFORMED; complete -> zero)';
  try {
    const clean = gen.validateManifest(gen.buildManifest());
    assert.equal(clean.malformed.length, 0,
      label + ': a complete manifest yields zero MALFORMED findings');

    // Strip a required key from one entry.
    const broken = gen.buildManifest();
    delete broken.maps[1].digest;
    const brokenFindings = gen.validateManifest(broken);
    assert.ok(brokenFindings.malformed.some((s) => /missing required key/.test(s) && /digest/.test(s)),
      label + ': a maps entry missing digest yields a MALFORMED finding');

    // A per-surface extra row breaks the exactly-three invariant.
    const extra = gen.buildManifest();
    extra.maps.push({ role: '/mos:think-hats', path: 'data/x.json', digest: 'a'.repeat(64), source_count: 1 });
    const extraFindings = gen.validateManifest(extra);
    assert.ok(extraFindings.malformed.length >= 1,
      label + ': a per-surface extra row yields MALFORMED (exactly-three + non-declared role)');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Test 5 - byte-stable + tier: two builds serialize identically; single trailing
// newline; every entry carries machinery metadata, never user content.
// ---------------------------------------------------------------------------
(function test5_byteStableAndTier() {
  const label = 'Test 5 - byte-stable serialization + single trailing newline + machinery tier';
  try {
    const a = gen.serializeManifest(gen.buildManifest());
    const b = gen.serializeManifest(gen.buildManifest());
    assert.equal(a, b, label + ': two successive serializations are byte-identical');
    assert.ok(a.endsWith('\n'), label + ': ends with a newline');
    assert.equal(a.endsWith('\n\n'), false, label + ': ends with a SINGLE trailing newline');

    // The committed file matches the regeneration (byte-stable on disk).
    const onDisk = fs.readFileSync(MANIFEST_PATH, 'utf8');
    assert.equal(onDisk, a, label + ': committed data/harness-manifest.json is byte-identical to the regeneration');

    // Every entry is generic machinery: digest is sha256 hex, source_count is an
    // int, role is one of the three enums, path is a data/ relative path. No
    // value is a free-text body / room path / email.
    const m = loadManifestOnDisk();
    assert.equal(m.methodology_tier, LEGAL_TIER, label + ': committed tier is machinery metadata');
    for (const e of m.maps) {
      assert.ok(/^[0-9a-f]{64}$/.test(e.digest), label + ': digest is sha256 hex');
      assert.ok(Number.isInteger(e.source_count) && e.source_count >= 0,
        label + ': source_count is a non-negative int');
      assert.ok(EXPECTED_ROLES.includes(e.role), label + ': role is one of the three enums');
      assert.ok(/^data\//.test(e.path), label + ': path is a data/ relative path');
      assert.equal(/@/.test(e.path) || /room\//.test(e.path), false,
        label + ': path carries no email / room path (no user content)');
    }
    ok(label);
  } catch (e) { fail(label, e); }
})();

process.stdout.write('\n');
process.stdout.write(
  'harness-manifest check: ' + passed + ' passed, ' + failed + ' failed\n'
);
process.exit(failed === 0 ? 0 : 1);

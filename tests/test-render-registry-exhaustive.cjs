'use strict';
/*
 * Phase 178-01 Task 2 (TDD) - the EXHAUSTIVENESS FLOOR proof (C-1, R-3).
 *
 * Proves the render-coverage walk is EXHAUSTIVE: a render entry point that is
 * PRESENT IN CODE but ABSENT FROM THE REGISTRY FAILS THE BUILD. This is the
 * structural cure for R-3 (registry-completeness drift, the new single point of
 * failure once the connector ledger is NOT co-resident) and for the Phase 177 slip
 * (dial-selector.cjs F.7-dial minted with no explicit registry entry): a new render
 * surface CANNOT escape.
 *
 * Mirrors the CIRS adversarial-fixture idiom (tests/test-coverage-gate-hardfail.cjs):
 * copy a synthesized temp module containing a NEW real pickShape( call site into a
 * WALKED scope (scripts/), regenerate with --check, assert the gate FAILS (non-zero)
 * because the walk re-derives an entry point with no on-disk registry record, then
 * remove the fixture in a finally so NO tracked file is ever mutated.
 *
 * Four assertions:
 *   1. EXHAUSTIVENESS FLOOR: a code-present-but-registry-absent pickShape call site
 *      makes build-render-coverage --check FAIL (non-zero). The fixture is removed in
 *      a finally; no tracked file is mutated; the live repo is green again after.
 *   2. The F.7-dial / dial-selector entry carries card-emission (host-appended).
 *   3. NEGATIVE PROOF (derived, not a constant): the registry reflects the ACTUAL
 *      walked call sites -- the in-memory walk over the real tree yields exactly the
 *      on-disk entry set, and a synthesized call site CHANGES the derived set.
 *   4. The registry has exactly 15 entries (13 pickShape incl. the dispatcher
 *      self-call + 2 renderDial).
 *
 * House rule: hyphens only, no em-dashes. Canon Part 8: zero Brain / network.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const GEN = path.join(REPO_ROOT, 'scripts', 'build-render-coverage.cjs');
const SCRIPTS_DIR = path.join(REPO_ROOT, 'scripts');
const REGISTRY = path.join(REPO_ROOT, 'data', 'render-coverage-registry.json');

const gen = require(GEN);

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

// ---------------------------------------------------------------------------
// Preflight: the live registry is byte-stable (so a later non-zero --check is the
// FLOOR firing on the probe, not pre-existing drift).
// ---------------------------------------------------------------------------
const clean = cp.spawnSync('node', [GEN, '--check'], { encoding: 'utf8', timeout: 60000 });
ok('preflight: live repo --check exits 0 (registry byte-stable)', clean.status === 0);

const liveEntries = JSON.parse(fs.readFileSync(REGISTRY, 'utf8')).entries;

// ---------------------------------------------------------------------------
// Assertion 4: exactly 15 entries (13 pickShape + 2 renderDial).
// ---------------------------------------------------------------------------
ok('registry has exactly 15 render entry points', liveEntries.length === 15);
ok('13 pickShape entry points', liveEntries.filter((e) => e.kind === 'pickShape').length === 13);
ok('2 renderDial entry points', liveEntries.filter((e) => e.kind === 'renderDial').length === 2);

// ---------------------------------------------------------------------------
// Assertion 2: the F.7-dial / dial-selector entry carries card-emission.
// ---------------------------------------------------------------------------
const dialEntry = liveEntries.find(
  (e) => String(e.entry || '').includes('dial-selector') || String(e.shape || '') === 'F.7-dial'
);
ok('the F.7-dial / dial-selector entry is present', !!dialEntry);
ok('the F.7-dial / dial-selector entry declares card-emission (host-appended)', dialEntry && dialEntry.render_coverage === 'card-emission');

// ---------------------------------------------------------------------------
// Assertion 3 (part a, NEGATIVE PROOF): the registry is DERIVED, not a constant.
// The in-memory walk over the REAL tree yields exactly the on-disk entry set.
// ---------------------------------------------------------------------------
const walked = gen.walkRenderEntryPoints();
const walkedKeys = walked.map((r) => r.entry + '|' + r.kind).sort();
const diskKeys = liveEntries.map((e) => e.entry + '|' + e.kind).sort();
ok(
  'the derived walk over the real tree equals the on-disk entry set (derived, not hand-listed)',
  JSON.stringify(walkedKeys) === JSON.stringify(diskKeys)
);

// ---------------------------------------------------------------------------
// Assertion 1 + Assertion 3 (part b): the EXHAUSTIVENESS FLOOR.
// Copy a synthesized temp module with a NEW real pickShape( call site into the
// walked scripts/ scope, regenerate --check, assert it FAILS (the walk derives a
// 16th entry point absent from the on-disk registry -> STALE -> non-zero), and prove
// the derived set CHANGED. Remove the fixture in a finally; never mutate a tracked
// file.
// ---------------------------------------------------------------------------
const TEMP_NAME = '__render_floor_probe__.cjs';
const TEMP_PATH = path.join(SCRIPTS_DIR, TEMP_NAME);
const PROBE_SRC = [
  "'use strict';",
  '// Synthesized exhaustiveness-floor probe (Phase 178-01 Task 2).',
  '// A NEW real render entry point: a pickShape( call site present in code but',
  '// absent from data/render-coverage-registry.json. The walk MUST detect it and',
  '// the gate MUST fail closed. Removed in a finally; never committed.',
  "const dispatcher = require('../lib/hmi/selector-dispatcher.cjs');",
  'function probeRender() {',
  "  return dispatcher.pickShape({ requestedShape: 'F.1', tier: 2, payload: {} });",
  '}',
  'module.exports = { probeRender };',
  '',
].join('\n');

let probeRun;
let walkedWithProbeKeys;
try {
  fs.writeFileSync(TEMP_PATH, PROBE_SRC);
  // The walk now derives a 16th entry point (the probe) absent from the on-disk
  // registry, so --check must find it STALE and exit non-zero.
  probeRun = cp.spawnSync('node', [GEN, '--check'], { encoding: 'utf8', timeout: 60000 });
  // The derived set must include the probe (proves the walk is live, not a constant).
  walkedWithProbeKeys = gen.walkRenderEntryPoints().map((r) => r.entry + '|' + r.kind);
} finally {
  try { fs.unlinkSync(TEMP_PATH); } catch (_e) { /* best-effort */ }
}

ok('EXHAUSTIVENESS FLOOR: a code-present-but-registry-absent pickShape call site FAILS --check (non-zero)', probeRun && probeRun.status !== 0);
const stderr = (probeRun && probeRun.stderr) || '';
ok('the FAIL message reports the registry is STALE', /STALE/.test(stderr));
ok('the FAIL message carries the recovery line', /build-render-coverage\.cjs/.test(stderr));
ok(
  'the derived walk CHANGED when the probe was present (derived set is live, not frozen)',
  Array.isArray(walkedWithProbeKeys) &&
    walkedWithProbeKeys.indexOf('scripts/' + TEMP_NAME + '|pickShape') !== -1 &&
    walkedWithProbeKeys.length === liveEntries.length + 1
);

// ---------------------------------------------------------------------------
// The probe is gone and the live repo is green again (no tracked-file mutation
// leaked).
// ---------------------------------------------------------------------------
ok('temp probe removed from scripts/', !fs.existsSync(TEMP_PATH));
const cleanAgain = cp.spawnSync('node', [GEN, '--check'], { encoding: 'utf8', timeout: 60000 });
ok('live repo --check exits 0 again after the probe is removed', cleanAgain.status === 0);

console.log('\nPASS test-render-registry-exhaustive (' + pass + ' assertions)');
console.log('>>> test-render-registry-exhaustive.cjs: PASSED');

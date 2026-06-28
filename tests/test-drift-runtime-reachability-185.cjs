#!/usr/bin/env node
'use strict';

/*
 * Phase 185 -- DRIFT Runtime Reachability (DRIFT-01) acceptance test.
 *
 * Asserts the runtime-reachability assertion added to `doctor --drift`:
 *   R-1 (RED, unit): a WIRED-but-runtime-unreachable fixture (a connector WIRED
 *       to the spine whose projection node carries NO `ranking` block, so the
 *       Phase-184 reader can never surface it) trips the assertion -> status
 *       'warn' + the unreachable surface named with reason 'no_ranking_block'.
 *   R-2 (RED, unit): a WIRED capability with NO projection node at all -> trips
 *       with reason 'no_projection_node'.
 *   R-3 (RED, unit): a malformed projection that fails the reader R2 gate ->
 *       decide() skips the offer, so EVERY WIRED eligible capability is
 *       unreachable (reason 'reader_skipped').
 *   R-4 (GREEN, unit): a fully-reachable injected set passes -> status 'ok'.
 *   R-5 (GREEN, real data): the SHIPPED registry + projection are fully
 *       reachable today -> status 'ok' (the assertion is calibrated GREEN, so it
 *       never red-lights the real release gate).
 *   R-6 (scoping): the 5 WIRED skills (trigger-wired, no `ranking` block, not
 *       decision-gate options) are NOT counted as drift -- reader-eligibility is
 *       scoped to command + agent kinds.
 *   R-7 (RED, doctor exit): `doctor --drift` over a RED fixture (env-injected)
 *       exits NON-ZERO and carries report.checks['runtime-reachability'].status
 *       === 'warn'.
 *   R-8 (GREEN, doctor exit): `doctor --drift` over the real artifacts exits 0
 *       and carries runtime-reachability status 'ok'.
 *   R-9 (additive): under `doctor --drift` the existing MERGE-TIME marking
 *       (Class P prose-vs-code + Class Q gsd-record) is STILL present -- Class R
 *       is added, the prior classes are not regressed.
 *   R-10 (Part 8): the new production module carries no network / Brain tokens.
 *   R-11 (no em-dash): the new module + this test carry no em-dashes.
 *
 * Hermetic: RED/GREEN doctor runs inject fixture artifact paths via the
 * MOS_TEST_REACHABILITY_REGISTRY / MOS_TEST_REACHABILITY_PROJECTION seams; the
 * real repo artifacts are never mutated. No em-dashes (hyphens only).
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const DOCTOR = path.join(REPO_ROOT, 'scripts', 'doctor.cjs');
const MODULE_PATH = path.join(REPO_ROOT, 'lib', 'core', 'drift-runtime-reachability.cjs');
const mod = require(MODULE_PATH);

let passed = 0;
let failed = 0;
function pass(name) { passed += 1; console.log('PASS: ' + name); }
function failTest(name, err) { failed += 1; console.log('FAIL: ' + name + '\n    ' + ((err && err.message) || err)); }
function run(name, fn) { try { fn(); pass(name); } catch (e) { failTest(name, e); } }

// Fixture builders --------------------------------------------------------
function wiredCommand(slug) {
  return { surface: '/mos:' + slug, source: 'command', connects_to_spine: true };
}
function commandNode(slug, withRanking) {
  const n = {
    id: 'command:/mos:' + slug,
    kind: 'command',
    methodology_tier: 'mindrian-operation',
    name: '/mos:' + slug,
  };
  if (withRanking) n.ranking = { reach_id: 'context_block', hierarchy_rank: 7, posture: 'hold' };
  return n;
}

// R-1: WIRED command, projection node present but NO ranking block -> drift.
run('R-1 RED no_ranking_block trips the assertion', function () {
  const registry = { connectors: [wiredCommand('ghost'), wiredCommand('real')] };
  const projection = { nodes: [commandNode('ghost', false), commandNode('real', true)] };
  const res = mod.checkRuntimeReachability({ registry, projection });
  assert.strictEqual(res.status, 'warn', 'expected warn on unreachable');
  assert.strictEqual(res.unreachable.length, 1, 'exactly one unreachable');
  assert.strictEqual(res.unreachable[0].surface, '/mos:ghost');
  assert.strictEqual(res.unreachable[0].reason, 'no_ranking_block');
  assert.strictEqual(res.report_only, false, 'this gate is a HARD signal, not report-only');
});

// R-2: WIRED command with NO projection node at all -> drift (no_projection_node).
run('R-2 RED no_projection_node trips the assertion', function () {
  const registry = { connectors: [wiredCommand('orphan'), wiredCommand('real')] };
  const projection = { nodes: [commandNode('real', true)] };
  const res = mod.checkRuntimeReachability({ registry, projection });
  assert.strictEqual(res.status, 'warn');
  assert.strictEqual(res.unreachable.length, 1);
  assert.strictEqual(res.unreachable[0].surface, '/mos:orphan');
  assert.strictEqual(res.unreachable[0].reason, 'no_projection_node');
});

// R-3: malformed projection fails the reader R2 gate -> decide() skips offer.
run('R-3 RED reader R2-gate failure makes every WIRED capability unreachable', function () {
  const registry = { connectors: [wiredCommand('a'), wiredCommand('b')] };
  // Node missing methodology_tier -> validateProjection FAILS CLOSED.
  const projection = { nodes: [{ id: 'command:/mos:a', kind: 'command', name: '/mos:a' }] };
  const res = mod.checkRuntimeReachability({ registry, projection });
  assert.strictEqual(res.status, 'warn');
  assert.strictEqual(res.wired_eligible, 2);
  assert.strictEqual(res.reachable, 0);
  assert.strictEqual(res.unreachable.length, 2);
  for (const u of res.unreachable) assert.strictEqual(u.reason, 'reader_skipped');
});

// R-4: fully-reachable injected set passes GREEN.
run('R-4 GREEN fully-reachable injected set passes', function () {
  const registry = { connectors: [wiredCommand('one'), wiredCommand('two')] };
  const projection = { nodes: [commandNode('one', true), commandNode('two', true)] };
  const res = mod.checkRuntimeReachability({ registry, projection });
  assert.strictEqual(res.status, 'ok');
  assert.strictEqual(res.reachable, 2);
  assert.strictEqual(res.unreachable.length, 0);
});

// R-5: the SHIPPED registry + projection are reachable today (calibrated GREEN).
run('R-5 GREEN real shipped artifacts are fully reachable', function () {
  const res = mod.checkRuntimeReachability({});
  assert.strictEqual(res.status, 'ok', 'real data must be GREEN: ' + res.detail);
  assert.ok(res.wired_eligible > 0, 'expected a non-empty eligible set');
  assert.strictEqual(res.reachable, res.wired_eligible);
  assert.strictEqual(res.unreachable.length, 0);
});

// R-6: WIRED skills (no ranking block) are scoped OUT, not counted as drift.
run('R-6 WIRED skills are scoped out of the reader-eligible set', function () {
  const registry = {
    connectors: [
      { surface: 'skill:deck-engine', source: 'skill', connects_to_spine: true },
      wiredCommand('cmd'),
    ],
  };
  // The skill node exists with NO ranking block; the command IS ranked.
  const projection = {
    nodes: [
      { id: 'skill:deck-engine', kind: 'skill', methodology_tier: 'mindrian-operation', name: 'deck-engine' },
      commandNode('cmd', true),
    ],
  };
  const res = mod.checkRuntimeReachability({ registry, projection });
  assert.strictEqual(res.status, 'ok', 'skill must not be counted as reachable drift');
  assert.strictEqual(res.wired_eligible, 1, 'only the command is reader-eligible');
  assert.strictEqual(res.reachable, 1);
});

// Doctor subprocess harness ----------------------------------------------
function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), '185-rr-')); }
function runDoctorDrift(env) {
  const merged = Object.assign({}, process.env, env || {});
  const r = spawnSync('node', [DOCTOR, '--drift', '--json'], { env: merged, encoding: 'utf8', timeout: 90000 });
  let report = null;
  try { report = JSON.parse(r.stdout); } catch (_e) { /* leave null */ }
  return { r, report };
}

// R-7: doctor --drift over a RED fixture exits NON-ZERO with warn status.
run('R-7 RED doctor --drift exits non-zero on a runtime-unreachable capability', function () {
  const dir = tmpDir();
  try {
    const reg = { connectors: [wiredCommand('ghost'), wiredCommand('real')] };
    const proj = { nodes: [commandNode('ghost', false), commandNode('real', true)] };
    const regPath = path.join(dir, 'reg.json');
    const projPath = path.join(dir, 'proj.json');
    fs.writeFileSync(regPath, JSON.stringify(reg), 'utf8');
    fs.writeFileSync(projPath, JSON.stringify(proj), 'utf8');
    const { r, report } = runDoctorDrift({
      MOS_TEST_REACHABILITY_REGISTRY: regPath,
      MOS_TEST_REACHABILITY_PROJECTION: projPath,
    });
    assert.notStrictEqual(r.status, 0, 'doctor --drift must exit non-zero on runtime-drift');
    assert.ok(report, 'report JSON parsed');
    const c = report.checks['runtime-reachability'];
    assert.ok(c, 'runtime-reachability check present');
    assert.strictEqual(c.status, 'warn');
    assert.strictEqual(c.class, 'R');
    assert.ok(c.unreachable.some(function (u) { return u.surface === '/mos:ghost'; }));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// R-8: doctor --drift over the REAL artifacts exits 0 with ok status.
run('R-8 GREEN doctor --drift over real artifacts exits 0', function () {
  const { r, report } = runDoctorDrift({});
  assert.strictEqual(r.status, 0, 'real doctor --drift must stay exit 0 (no regression)');
  assert.ok(report, 'report JSON parsed');
  const c = report.checks['runtime-reachability'];
  assert.ok(c, 'runtime-reachability check present');
  assert.strictEqual(c.status, 'ok');
});

// R-9: the existing MERGE-TIME marking (Class P + Class Q) is still present.
run('R-9 additive: Class P + Class Q merge-time marking still runs under --drift', function () {
  const { report } = runDoctorDrift({});
  assert.ok(report, 'report JSON parsed');
  assert.ok(report.checks['prose-vs-code'], 'Class P (prose-vs-code) still present');
  assert.ok(report.checks['gsd-record-drift'], 'Class Q (gsd-record-drift) still present');
  assert.ok(report.checks['runtime-reachability'], 'Class R added alongside, not replacing');
});

// R-10: Part 8 -- the new production module carries no network / Brain tokens.
run('R-10 Part 8: the new module has zero network / Brain egress tokens', function () {
  const src = fs.readFileSync(MODULE_PATH, 'utf8');
  // Strip line comments + block comments before the token sweep so the doctrine
  // prose (which legitimately NAMES "Brain" / the projection filename) does not
  // trip the scan; only live code tokens count.
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  const forbidden = [/\bfetch\s*\(/, /\bhttps?:\/\//, /\brequire\(['"]https?['"]\)/, /child_process/, /\bcurl\b/, /brain_query/, /onrender\.com/];
  for (const re of forbidden) {
    assert.ok(!re.test(code), 'forbidden network/Brain token in module code: ' + re);
  }
});

// R-11: no em-dashes in the new module or this test.
run('R-11 no em-dashes in the new module or this test', function () {
  const EM = String.fromCharCode(0x2014);
  for (const f of [MODULE_PATH, __filename]) {
    const src = fs.readFileSync(f, 'utf8');
    assert.ok(src.indexOf(EM) === -1, 'em-dash found in ' + path.basename(f));
  }
});

// Summary -----------------------------------------------------------------
console.log('\n--- Phase 185 runtime-reachability: ' + passed + ' passed, ' + failed + ' failed ---');
process.exit(failed === 0 ? 0 : 1);

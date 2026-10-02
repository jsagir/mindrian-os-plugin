// TS369-03: the erasable-only TypeScript gate (tools/ts-check) works and is walled.
//
// Plain counters, nonzero exit tail (house harness). Exit 77 = tools/ts-check is not
// installed (environment gap, not a failure).
'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const PKG = path.join(REPO, 'tools', 'ts-check');
const CHECK = path.join(PKG, 'check.cjs');

// Hermetic: no real HOME, no live room, no session identity.
const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'test-369-ts-'));
const ENV = Object.assign({}, process.env, {
  HOME: TMP_HOME,
  USERPROFILE: TMP_HOME,
  MINDRIAN_ROOMS_HOME: path.join(TMP_HOME, 'rooms'),
});
delete ENV.CLAUDE_ACTIVE_ROOM;
delete ENV.CLAUDE_CODE_SESSION_ID;

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  ok ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.stack || err.message || String(err)) + '\n');
}
function scenario(name, fn) {
  try { fn(); ok(name); } catch (e) { fail(name, e); }
}

function finish() {
  fs.rmSync(TMP_HOME, { recursive: true, force: true });
  process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed ? 1 : 0);
}

// ---------- (1) the runner end to end ----------

const run = spawnSync(process.execPath, [CHECK], { cwd: REPO, env: ENV, encoding: 'utf8' });
if (run.status === 77) {
  process.stdout.write('ENV GAP: tools/ts-check is not installed (exit 77)\n');
  fs.rmSync(TMP_HOME, { recursive: true, force: true });
  process.exit(77);
}

scenario('check.cjs exits 0 on today\'s tree', () => {
  assert.strictEqual(run.status, 0, run.stdout + run.stderr);
});

scenario('core stage is stated as vacuous (zero core .ts files)', () => {
  assert.ok(run.stdout.includes('0 core TypeScript files: core stage passes vacuously'), run.stdout);
});

scenario('each forbidden fixture is named as caught with its TS code', () => {
  assert.match(run.stdout, /caught enum\.ts \(TS1294\)/);
  assert.match(run.stdout, /caught namespace\.ts \(TS1294\)/);
  assert.match(run.stdout, /caught param-property\.ts \(TS1294\)/);
  assert.match(run.stdout, /caught esm-in-cjs\.ts \(TS1287|caught esm-in-cjs\.ts \(TS1295/);
});

scenario('allowed shape-a compiles and Node runs it by stripping types', () => {
  assert.ok(run.stdout.includes('Node runs it by stripping types'), run.stdout);
});

// ---------- (2) tsconfig is the Node-recommended erasable option set ----------

scenario('tsconfig.core.json carries the erasable option set and no alias', () => {
  const raw = fs.readFileSync(path.join(PKG, 'tsconfig.core.json'), 'utf8');
  const cfg = JSON.parse(raw);
  const o = cfg.compilerOptions;
  assert.strictEqual(o.erasableSyntaxOnly, true);
  assert.strictEqual(o.verbatimModuleSyntax, true);
  assert.deepStrictEqual(o.types, []);
  assert.ok(!('paths' in o), 'paths must not be set');
  assert.ok(!('baseUrl' in o), 'baseUrl must not be set');
});

// ---------- (3) the package is walled ----------

scenario('tools/ts-check is private, pins typescript 7.0.2 exactly, nothing else', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(PKG, 'package.json'), 'utf8'));
  assert.strictEqual(pkg.private, true);
  assert.deepStrictEqual(pkg.devDependencies, { typescript: '7.0.2' });
  assert.ok(!pkg.dependencies || Object.keys(pkg.dependencies).length === 0);
  assert.ok(fs.existsSync(path.join(PKG, 'package-lock.json')), 'own lockfile');
});

// ---------- (4) mutation arm: a planted enum is caught by the exported helper ----------

scenario('mutation: runForbidden reports a planted enum', () => {
  const { _internal } = require(CHECK);
  const tsc = _internal.resolveTsc();
  assert.ok(tsc, 'tsc resolves from the walled package');
  const probeDir = path.join(TMP_HOME, 'lib-probe');
  fs.mkdirSync(probeDir, { recursive: true });
  const probe = path.join(probeDir, 'enum.ts');
  fs.copyFileSync(path.join(PKG, 'fixtures', 'forbidden', 'enum.ts'), probe);
  const r = _internal.runForbidden(tsc, probe, ['TS1294']);
  assert.strictEqual(r.caught, true, r.output);
  assert.strictEqual(r.code, 'TS1294');
});

scenario('mutation: runForbidden does NOT flag an allowed file', () => {
  const { _internal } = require(CHECK);
  const tsc = _internal.resolveTsc();
  const allowed = path.join(PKG, 'fixtures', 'allowed', 'types.ts');
  const r = _internal.runForbidden(tsc, allowed, ['TS1294']);
  assert.strictEqual(r.caught, false, 'a clean file must not count as caught');
});

finish();

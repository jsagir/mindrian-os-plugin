// 369.26 wall guard (WS-01, T-369.26-01-01): the Mindrian Workspace mod is a walled package.
//
// Why: the loader runs `npm ci --ignore-scripts` with no --omit on every user's machine, so a
// UI or TypeScript package that leaks into the root manifest installs everywhere. The mod
// at ui/mindrian-workspace-mod/ declares no dependency of any kind, is named nowhere in the
// root package.json, and never reaches the tarball. Plain counters, nonzero exit tail
// (house harness), hermetic: reads files only, writes only to a temp dir it removes.
// Hyphens only. CJS, Node built-ins only.
'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const MOD = path.join(REPO, 'ui', 'mindrian-workspace-mod');
const MOD_PKG = path.join(MOD, 'package.json');
const ROOT_PKG_PATH = path.join(REPO, 'package.json');

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

const DEP_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

// The one check function arm (1) and the mutation arm (7) share: returns the offending
// "field.name" strings of a package.json file, empty when it declares nothing.
function declaredDependencies(pkgPath) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const found = [];
  for (const field of DEP_FIELDS) {
    for (const name of Object.keys(pkg[field] || {})) found.push(field + '.' + name);
  }
  return found;
}

// Walk a directory, skipping node_modules and the engine-written types folder.
function walk(dir, skip) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const abs = path.join(dir, entry.name);
    const rel = path.relative(REPO, abs).split(path.sep).join('/');
    if ((skip || []).some((p) => rel === p || rel.startsWith(p + '/'))) continue;
    if (entry.isDirectory()) out.push(...walk(abs, skip));
    else if (entry.isFile()) out.push(abs);
  }
  return out;
}

// ---------- (1) the mod declares no dependency of any kind ----------

scenario('the mod package.json carries no dependency field with any key', () => {
  assert.ok(fs.existsSync(MOD_PKG), 'ui/mindrian-workspace-mod/package.json exists');
  assert.deepStrictEqual(declaredDependencies(MOD_PKG), []);
  assert.strictEqual(JSON.parse(fs.readFileSync(MOD_PKG, 'utf8')).private, true, 'the mod is private');
});

// ---------- (2) the root manifest never names the mod ----------

scenario('the root package.json does not mention the mod anywhere', () => {
  const raw = fs.readFileSync(ROOT_PKG_PATH, 'utf8');
  for (const needle of ['mindrian-workspace', 'mos-workspace-mod', 'ui/mindrian-workspace-mod']) {
    assert.ok(!raw.includes(needle), 'root package.json mentions "' + needle + '"');
  }
});

// ---------- (3) the root files array ships neither ui nor tools ----------

scenario('the root files array has no ui or tools entry', () => {
  const files = JSON.parse(fs.readFileSync(ROOT_PKG_PATH, 'utf8')).files || [];
  for (const f of files) {
    assert.ok(!/^(ui|tools)(\/|$)/.test(f), 'files entry "' + f + '" ships ui/ or tools/');
  }
});

// ---------- (4) the mod tsconfig has no paths alias ----------

scenario('the mod tsconfig.json has no paths key', () => {
  const raw = fs.readFileSync(path.join(MOD, 'tsconfig.json'), 'utf8');
  assert.ok(!/"paths"\s*:/.test(raw), 'tsconfig.json carries a paths alias');
});

// ---------- (5) no TSX under lib/ ----------

scenario('there is no .tsx file under lib/', () => {
  const bad = walk(path.join(REPO, 'lib'), ['lib/wiki/editor-src']).filter((f) => f.endsWith('.tsx'));
  assert.deepStrictEqual(bad.map((f) => path.relative(REPO, f)), []);
});

// ---------- (6) hyphens only ----------

scenario('no em-dash or en-dash in any mod file', () => {
  const emDash = Buffer.from([0xe2, 0x80, 0x94]);
  const enDash = Buffer.from([0xe2, 0x80, 0x93]);
  const hits = [];
  for (const f of walk(MOD, ['ui/mindrian-workspace-mod/.claude-plugin/types'])) {
    const buf = fs.readFileSync(f);
    if (buf.includes(emDash) || buf.includes(enDash)) hits.push(path.relative(REPO, f));
  }
  assert.deepStrictEqual(hits, []);
});

// ---------- (7) a planted mutation is rejected by the same check ----------

scenario('mutation: the same check rejects a package.json with a typescript devDependency', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'test-36926-wall-'));
  try {
    const planted = path.join(tmp, 'package.json');
    const real = JSON.parse(fs.readFileSync(MOD_PKG, 'utf8'));
    real.devDependencies = { typescript: '7.0.2' };
    fs.writeFileSync(planted, JSON.stringify(real, null, 2));
    assert.deepStrictEqual(declaredDependencies(planted), ['devDependencies.typescript']);
    // and a clean copy still passes, so the check is not simply always failing
    fs.writeFileSync(planted, fs.readFileSync(MOD_PKG, 'utf8'));
    assert.deepStrictEqual(declaredDependencies(planted), []);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);

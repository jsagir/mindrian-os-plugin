// 380 wall guard (D-05, CLAUDE.md D-17, T-380-02): the face panel mod ui/mos-face is a walled package.
//
// Why: the loader runs `npm ci --ignore-scripts` with no --omit on every user's machine, so a
// UI or TypeScript package that leaks into the root manifest installs everywhere. The mod
// keeps its own package.json and package-lock.json; its one devDependency (typescript) repeats
// the exact version and integrity of tools/ts-check. Nothing from ui reaches the tarball.
// Plain counters, nonzero exit tail (house harness), hermetic: reads files only, writes only
// to a temp dir it removes. Hyphens only. CJS, Node built-ins only.
'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const MOD = path.join(REPO, 'ui', 'mos-face');
const MOD_PKG = path.join(MOD, 'package.json');
const MOD_LOCK = path.join(MOD, 'package-lock.json');
const ROOT_PKG_PATH = path.join(REPO, 'package.json');
const ROOT_SHRINK_PATH = path.join(REPO, 'npm-shrinkwrap.json');
const TSC_PKG = path.join(REPO, 'tools', 'ts-check', 'package.json');
const TSC_LOCK = path.join(REPO, 'tools', 'ts-check', 'package-lock.json');

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
const NEEDLES = ['typescript', 'xterm', 'playwright', 'mos-face'];

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

// The W1 check function, shared with the mutation arm W6: returns the offending
// "field.name" strings of a root-style package.json file, empty when clean.
function leakedEntries(pkgPath) {
  const pkg = readJson(pkgPath);
  const found = [];
  const hit = (s) => NEEDLES.some((n) => String(s).toLowerCase().includes(n));
  for (const field of DEP_FIELDS) {
    for (const [name, value] of Object.entries(pkg[field] || {})) {
      if (hit(name) || hit(value)) found.push(field + '.' + name);
    }
  }
  for (const [name, value] of Object.entries(pkg.scripts || {})) {
    if (hit(name) || hit(value)) found.push('scripts.' + name);
  }
  const bin = pkg.bin;
  if (typeof bin === 'string') { if (hit(bin)) found.push('bin'); }
  else for (const [name, value] of Object.entries(bin || {})) {
    if (hit(name) || hit(value)) found.push('bin.' + name);
  }
  return found;
}

// ---------- W1 ----------
scenario('W1: the root package.json names no typescript, xterm, playwright or mos-face entry', () => {
  assert.deepStrictEqual(leakedEntries(ROOT_PKG_PATH), []);
});

// ---------- W2 ----------
scenario('W2: no root files entry starts with ui', () => {
  const files = readJson(ROOT_PKG_PATH).files || [];
  for (const f of files) {
    assert.ok(f.startsWith('!') || !/^(\.\/)?ui(\/|$)/.test(f), 'files entry "' + f + '" ships ui/');
  }
});

// ---------- W3 ----------
scenario('W3: the mod package.json is private with one exact devDependency equal to tools/ts-check', () => {
  assert.ok(fs.existsSync(MOD_PKG), 'ui/mos-face/package.json exists');
  const pkg = readJson(MOD_PKG);
  assert.strictEqual(pkg.private, true, 'the mod is private');
  for (const f of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    assert.deepStrictEqual(Object.keys(pkg[f] || {}), [], f + ' must be empty');
  }
  assert.deepStrictEqual(Object.keys(pkg.devDependencies || {}), ['typescript']);
  const v = pkg.devDependencies.typescript;
  assert.ok(/^\d+\.\d+\.\d+$/.test(v), 'exact version, no range character: ' + v);
  assert.strictEqual(v, readJson(TSC_PKG).devDependencies.typescript, 'same version as tools/ts-check');
});

// ---------- W4 ----------
scenario('W4: the mod lockfile exists and its typescript entry equals the one in tools/ts-check', () => {
  assert.ok(fs.existsSync(MOD_LOCK), 'ui/mos-face/package-lock.json exists');
  const lock = readJson(MOD_LOCK);
  assert.ok(lock.lockfileVersion >= 3, 'lockfileVersion >= 3');
  assert.deepStrictEqual(lock.packages[''].devDependencies, readJson(MOD_PKG).devDependencies);
  const mine = lock.packages['node_modules/typescript'];
  const theirs = readJson(TSC_LOCK).packages['node_modules/typescript'];
  assert.ok(mine && theirs, 'both lockfiles carry a typescript entry');
  assert.strictEqual(mine.version, theirs.version, 'same version');
  assert.ok(theirs.integrity, 'reference integrity present');
  assert.strictEqual(mine.integrity, theirs.integrity, 'same integrity string');
});

// ---------- W5 ----------
scenario('W5: the root npm-shrinkwrap.json holds no typescript package key', () => {
  const keys = Object.keys(readJson(ROOT_SHRINK_PATH).packages || {});
  const bad = keys.filter((k) => /node_modules\/typescript$/.test(k));
  assert.deepStrictEqual(bad, []);
});

// ---------- W6 ----------
scenario('W6: mutation: the W1 check rejects a root package.json with a typescript devDependency', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'test-380-wall-'));
  try {
    const planted = path.join(tmp, 'package.json');
    const real = readJson(ROOT_PKG_PATH);
    real.devDependencies = Object.assign({}, real.devDependencies, { typescript: '7.0.2' });
    fs.writeFileSync(planted, JSON.stringify(real, null, 2));
    assert.deepStrictEqual(leakedEntries(planted), ['devDependencies.typescript']);
    // and the clean copy still passes, so the check is not simply always failing
    fs.writeFileSync(planted, fs.readFileSync(ROOT_PKG_PATH, 'utf8'));
    assert.deepStrictEqual(leakedEntries(planted), []);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ---------- W7 ----------
scenario('W7: no em-dash or en-dash in the new files of the wall task', () => {
  const emDash = Buffer.from([0xe2, 0x80, 0x94]);
  const enDash = Buffer.from([0xe2, 0x80, 0x93]);
  const files = [
    path.join(REPO, 'tests', 'test-380-wall.cjs'),
    MOD_PKG,
    path.join(MOD, '.gitignore'),
    path.join(MOD, 'README.md'),
  ];
  const hits = [];
  for (const f of files) {
    assert.ok(fs.existsSync(f), 'exists: ' + path.relative(REPO, f));
    const buf = fs.readFileSync(f);
    if (buf.includes(emDash) || buf.includes(enDash)) hits.push(path.relative(REPO, f));
  }
  assert.deepStrictEqual(hits, []);
});

process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);

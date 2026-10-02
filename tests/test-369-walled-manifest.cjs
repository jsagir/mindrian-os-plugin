// TS369-06: the root manifest and the npm tarball carry no TypeScript, UI or build packages.
//
// Why: the Claude Code loader runs `npm ci --ignore-scripts` with no --omit, so anything in
// the root package.json (even a devDependency) is installed on every user's machine.
// TypeScript and UI packages live in walled packages (tools/*, ui/*) with their own
// lockfiles, and `tools/` and `ui/` must never reach the tarball.
//
// Plain counters, nonzero exit tail (house harness). Exit 77 = npm missing (environment gap).
'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const ROOT_PKG = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));

// Hermetic: no real HOME, no live room, no session identity.
const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'test-369-wall-'));
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

// A name is denied if it equals an entry, or starts with it (entries ending in "/" are scopes).
const DENY = [
  'typescript', '@types/', 'react', 'react-dom', 'next', 'vite', 'rxdb', 'rxjs', 'dexie',
  '@blocknote/', '@agent-native/', 'esbuild', 'tsx', 'ts-node', '@fontsource', 'playwright',
];
function denied(name) {
  return DENY.find((d) => name === d || name.startsWith(d)) || null;
}

// ---------- (1) no other dependency fields ----------

scenario('root package.json has no devDependencies / peerDependencies / optionalDependencies', () => {
  for (const key of ['devDependencies', 'peerDependencies', 'optionalDependencies']) {
    const v = ROOT_PKG[key];
    assert.ok(v === undefined || Object.keys(v).length === 0, key + ' must be absent or empty');
  }
});

// ---------- (2) denylist over every dependency field ----------

scenario('no TypeScript / UI / build package in any root dependency field', () => {
  for (const key of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const name of Object.keys(ROOT_PKG[key] || {})) {
      const hit = denied(name);
      assert.ok(!hit, key + ' carries "' + name + '" (matches denylist entry "' + hit + '")');
    }
  }
});

scenario('the denylist itself catches a planted package (mutation)', () => {
  assert.ok(denied('typescript'));
  assert.ok(denied('@types/node'));
  assert.ok(denied('@blocknote/core'));
  assert.ok(denied('react-dom'));
  assert.ok(!denied('express'));
});

// ---------- (3) files array ----------

scenario('files has no tools or ui entry', () => {
  for (const f of ROOT_PKG.files || []) {
    assert.ok(!/^(tools|ui)/.test(f), 'files entry "' + f + '" ships tools/ or ui/');
  }
});

// ---------- (4) the tarball ----------

const pack = spawnSync('npm', ['pack', '--dry-run', '--json'], {
  cwd: REPO, env: ENV, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024,
});
if (pack.error && pack.error.code === 'ENOENT') {
  process.stdout.write('ENV GAP: npm is not available (exit 77)\n');
  fs.rmSync(TMP_HOME, { recursive: true, force: true });
  process.exit(77);
}

scenario('npm pack lists no tools/ or ui/ path and no .tsx under lib/', () => {
  assert.strictEqual(pack.status, 0, 'npm pack failed: ' + (pack.stderr || '').slice(0, 400));
  const jsonStart = pack.stdout.indexOf('[');
  const j = JSON.parse(pack.stdout.slice(jsonStart));
  const paths = j[0].files.map((f) => f.path);
  assert.ok(paths.length > 100, 'sanity: the packlist is non-trivial (' + paths.length + ')');
  const bad = paths.filter((p) => /^(tools|ui)\//.test(p) || (p.startsWith('lib/') && p.endsWith('.tsx')));
  assert.deepStrictEqual(bad, [], 'tarball ships walled paths: ' + bad.slice(0, 5).join(', '));
});

// ---------- (5) every walled package is private ----------

scenario('every tools/*/package.json and ui/*/package.json is private', () => {
  let seen = 0;
  for (const root of ['tools', 'ui']) {
    const dir = path.join(REPO, root);
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const pj = path.join(dir, entry.name, 'package.json');
      if (!fs.existsSync(pj)) continue;
      seen += 1;
      assert.strictEqual(JSON.parse(fs.readFileSync(pj, 'utf8')).private, true, root + '/' + entry.name + ' must be private');
    }
  }
  assert.ok(seen >= 1, 'at least tools/ts-check exists');
});

// ---------- (6) the shrinkwrap carries no dev entries ----------

scenario('npm-shrinkwrap.json root has no devDependencies and no dev:true entry', () => {
  const sw = JSON.parse(fs.readFileSync(path.join(REPO, 'npm-shrinkwrap.json'), 'utf8'));
  const root = sw.packages[''] || {};
  assert.ok(!root.devDependencies || Object.keys(root.devDependencies).length === 0, 'shrinkwrap root devDependencies');
  const dev = Object.entries(sw.packages).filter(([, v]) => v && v.dev === true).map(([k]) => k);
  assert.deepStrictEqual(dev, [], 'dev:true entries: ' + dev.slice(0, 5).join(', '));
});

finish();

#!/usr/bin/env node
'use strict';
/*
 * Phase 387 plan 10: the pure helpers of the owner-run live leak test, tested on every run with synthetic data.
 *
 * Arms (each prints ok - or FAIL - with its label):
 *   L1  parseStraceConnects: unix, loopback inet and inet6 are local; public inet and inet6 are not; a failed connect
 *       counts; an unfinished connect counts once and its resumed line does not count again; other calls are ignored
 *   L2  assertNoNonLocalConnect throws and names family and address of each non-local attempt; returns the array otherwise
 *   L3  snapshotTree and diffTrees: allowed folders, outside changes, bytecode noise, added and removed files
 *   L4  snapshotTree stops with an Error that names the cap
 *   L5  scanMarker counts a marker in a binary-like buffer, in -wal and -shm files, and 0 for a missing file
 *   L6  buildMarkerSnapshot: 6 nodes, 5 edges, 2 or more edge types, the marker in 4 node names and texts, edge ends are node ids
 *   L7  the live test file: exists, no fetch, no network require, shell false on every spawn, never assigns the opt-in or
 *       the engine root; run without the opt-in it exits 77 with the named reason
 *   L8  the runbook: exists and holds the commands, the four pass criteria, the second proof and the bytecode-noise sentence
 *
 * Node built-ins only. The real engine is never started here. Hyphens only.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const HELPER = path.join(REPO, 'tests', 'helpers', 'leak-test-387.cjs');
const LIVE = path.join(REPO, 'tests', 'test-387-eureka-live-leak.cjs');
const RUNBOOK = path.join(REPO, '.planning', 'phases', '387-eureka-reachable-on-a-normal-install', '387-LEAK-RUNBOOK.md');

let passed = 0;
let failed = 0;
const tmpDirs = [];
function mkTmp(prefix) { const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); tmpDirs.push(d); return d; }
function arm(label, fn) {
  try { fn(); passed += 1; process.stdout.write('ok - ' + label + '\n'); }
  catch (e) { failed += 1; process.stdout.write('FAIL - ' + label + '\n    ' + String(e && e.message || e).split('\n').join('\n    ') + '\n'); }
}
function helper() { return require(HELPER); }

// real strace -f -e trace=connect formats
const LOG_MIXED = [
  'connect(3, {sa_family=AF_UNIX, sun_path="/run/x"}, 110) = 0',
  'connect(4, {sa_family=AF_INET, sin_port=htons(8080), sin_addr=inet_addr("127.0.0.1")}, 16) = 0',
  'connect(5, {sa_family=AF_INET6, sin6_port=htons(8080), sin6_flowinfo=htonl(0), inet_pton(AF_INET6, "::1", &sin6_addr), sin6_scope_id=0}, 28) = 0',
  'connect(5, {sa_family=AF_INET, sin_port=htons(443), sin_addr=inet_addr("104.16.1.1")}, 16) = -1 EINPROGRESS (Operation now in progress)',
  'connect(6, {sa_family=AF_INET6, sin6_port=htons(443), sin6_flowinfo=htonl(0), inet_pton(AF_INET6, "2606:4700::1", &sin6_addr), sin6_scope_id=0}, 28) = -1 ENETUNREACH (Network is unreachable)',
  'connect(8, {sa_family=AF_INET, sin_port=htons(9), sin_addr=inet_addr("127.0.0.1")}, 16) = -1 ECONNREFUSED (Connection refused)',
  '[pid 4242] connect(7, {sa_family=AF_INET, sin_port=htons(80), sin_addr=inet_addr("1.2.3.4")}, 16 <unfinished ...>',
  '[pid 4242] <... connect resumed>) = -1 EINPROGRESS (Operation now in progress)',
  'openat(AT_FDCWD, "/etc/hosts", O_RDONLY) = 3',
  'connect(9, {sa_family=AF_INET6, sin6_port=htons(80), sin6_flowinfo=htonl(0), inet_pton(AF_INET6, "::ffff:127.0.0.1", &sin6_addr), sin6_scope_id=0}, 28) = 0',
].join('\n');

const LOG_LOCAL = [
  'connect(3, {sa_family=AF_UNIX, sun_path="/run/x"}, 110) = 0',
  'connect(4, {sa_family=AF_INET, sin_port=htons(8080), sin_addr=inet_addr("127.0.0.1")}, 16) = 0',
  'connect(5, {sa_family=AF_INET6, sin6_port=htons(8080), sin6_flowinfo=htonl(0), inet_pton(AF_INET6, "::1", &sin6_addr), sin6_scope_id=0}, 28) = 0',
].join('\n');

arm('L1 parseStraceConnects reads unix, inet and inet6, keeps failed connects, counts an unfinished connect once', () => {
  const rows = helper().parseStraceConnects(LOG_MIXED);
  assert.equal(rows.length, 8, 'expected 8 connect attempts, got ' + rows.length);
  const by = (family, address) => rows.filter((r) => r.family === family && r.address === address);
  assert.equal(by('unix', '/run/x').length, 1);
  assert.equal(by('unix', '/run/x')[0].local, true);
  assert.equal(by('inet', '127.0.0.1').length, 2, 'the successful and the refused loopback connect both count');
  assert.ok(by('inet', '127.0.0.1').every((r) => r.local === true));
  assert.equal(by('inet6', '::1')[0].local, true);
  assert.equal(by('inet6', '::ffff:127.0.0.1')[0].local, true);
  assert.equal(by('inet', '104.16.1.1')[0].local, false);
  assert.match(by('inet', '104.16.1.1')[0].result, /EINPROGRESS/);
  assert.equal(by('inet6', '2606:4700::1')[0].local, false);
  assert.match(by('inet6', '2606:4700::1')[0].result, /ENETUNREACH/);
  assert.equal(by('inet', '1.2.3.4').length, 1, 'the unfinished line counts once and the resumed line does not count again');
  assert.equal(by('inet', '1.2.3.4')[0].local, false);
  assert.equal(rows.filter((r) => /openat/.test(JSON.stringify(r))).length, 0, 'other calls are ignored');
});

arm('L2 assertNoNonLocalConnect throws with family and address, and returns the array for a local-only log', () => {
  const h = helper();
  assert.throws(() => h.assertNoNonLocalConnect(LOG_MIXED), (e) => {
    const m = String(e.message);
    return e instanceof Error && /inet/.test(m) && m.includes('104.16.1.1') && m.includes('2606:4700::1') && m.includes('1.2.3.4') && !m.includes('127.0.0.1');
  });
  const rows = h.assertNoNonLocalConnect(LOG_LOCAL);
  assert.ok(Array.isArray(rows));
  assert.equal(rows.length, 3);
});

arm('L3 snapshotTree and diffTrees: allowed folders, outside changes, bytecode noise, added and removed files', () => {
  const h = helper();
  const root = mkTmp('mos-387-l3-');
  const data = path.join(root, 'data');
  const engine = path.join(root, 'engine');
  fs.mkdirSync(data); fs.mkdirSync(path.join(engine, '__pycache__'), { recursive: true });
  fs.writeFileSync(path.join(data, 'jobs.sqlite3'), 'one');
  fs.writeFileSync(path.join(engine, 'uv.lock'), 'lock');
  fs.writeFileSync(path.join(engine, 'gone.txt'), 'gone');
  fs.writeFileSync(path.join(engine, '__pycache__', 'x.pyc'), 'byte1');
  const before = h.snapshotTree(root);
  fs.writeFileSync(path.join(data, 'jobs.sqlite3'), 'two-longer');
  fs.writeFileSync(path.join(engine, 'uv.lock'), 'lock-changed');
  fs.writeFileSync(path.join(engine, '__pycache__', 'x.pyc'), 'byte2-longer');
  fs.rmSync(path.join(engine, 'gone.txt'));
  fs.writeFileSync(path.join(engine, 'added.txt'), 'new');
  const after = h.snapshotTree(root);
  const diff = h.diffTrees(before, after, [data]);
  assert.ok(Array.isArray(diff.outsideAllowed) && Array.isArray(diff.noise) && Array.isArray(diff.added) && Array.isArray(diff.removed) && Array.isArray(diff.changed));
  const flat = (list) => list.map((x) => (typeof x === 'string' ? x : x.path)).map((p) => p.split(path.sep).join('/'));
  assert.ok(flat(diff.changed).includes('data/jobs.sqlite3'));
  assert.ok(!flat(diff.outsideAllowed).includes('data/jobs.sqlite3'), 'a change under the allowed data folder is not outside');
  assert.ok(flat(diff.outsideAllowed).includes('engine/uv.lock'), 'a change in the engine-like folder is outside');
  assert.ok(flat(diff.noise).includes('engine/__pycache__/x.pyc'), 'bytecode is listed as noise');
  assert.ok(!flat(diff.outsideAllowed).includes('engine/__pycache__/x.pyc'), 'bytecode never counts as outside');
  assert.ok(flat(diff.added).includes('engine/added.txt'));
  assert.ok(flat(diff.removed).includes('engine/gone.txt'));
  assert.ok(flat(diff.outsideAllowed).includes('engine/added.txt') && flat(diff.outsideAllowed).includes('engine/gone.txt'), 'added and removed files outside the allowed folders count as outside');
});

arm('L4 snapshotTree stops with an Error that names the cap', () => {
  const h = helper();
  const root = mkTmp('mos-387-l4-');
  for (let i = 0; i < 12; i += 1) fs.writeFileSync(path.join(root, 'f' + i), String(i));
  assert.throws(() => h.snapshotTree(root, { maxEntries: 5 }), (e) => e instanceof Error && /maxEntries|5/.test(e.message) && /cap|max/i.test(e.message));
  assert.doesNotThrow(() => h.snapshotTree(root, { maxEntries: 50 }));
});

arm('L5 scanMarker counts a marker in binary-like files, in -wal and -shm files, and 0 for a missing file', () => {
  const h = helper();
  const root = mkTmp('mos-387-l5-');
  const marker = 'MARKER387abc';
  const db = path.join(root, 'jobs.sqlite3');
  const wal = db + '-wal';
  const shm = db + '-shm';
  fs.writeFileSync(db, Buffer.concat([Buffer.from([0, 1, 2, 255, 254]), Buffer.from(marker), Buffer.from([0, 0]), Buffer.from(marker), Buffer.from([9])]));
  fs.writeFileSync(wal, Buffer.concat([Buffer.from('xx'), Buffer.from(marker)]));
  fs.writeFileSync(shm, Buffer.from('nothing here'));
  const missing = path.join(root, 'not-there.sqlite3');
  const res = h.scanMarker([db, wal, shm, missing], marker);
  assert.equal(res.total, 3);
  assert.equal(res.byFile[db], 2);
  assert.equal(res.byFile[wal], 1);
  assert.equal(res.byFile[shm], 0);
  assert.equal(res.byFile[missing], 0);
  assert.equal(h.scanMarker([db], 'ABSENT-MARKER-387').total, 0);
});

arm('L6 buildMarkerSnapshot: 6 nodes, 5 edges, 2 or more edge types, the marker in 4 node names and texts', () => {
  const h = helper();
  const marker = 'MARKER387deadbeef';
  const snap = h.buildMarkerSnapshot(marker);
  assert.equal(snap.nodes.length, 6);
  assert.equal(snap.edges.length, 5);
  assert.ok(new Set(snap.edges.map((e) => e.type)).size >= 2);
  const ids = new Set(snap.nodes.map((n) => n.id));
  assert.equal(ids.size, 6);
  for (const e of snap.edges) { assert.ok(ids.has(e.s), 'edge start is a node id'); assert.ok(ids.has(e.t), 'edge end is a node id'); }
  assert.equal(snap.nodes.filter((n) => String(n.name).includes(marker) && String(n.text).includes(marker)).length, 4);
  assert.ok(snap.meta && typeof snap.meta === 'object');
  for (const n of snap.nodes) { assert.ok(Array.isArray(n.labels)); assert.ok('attrs' in n); }
  for (const e of snap.edges) assert.ok('created_at' in e);
});

arm('L7 the live test: no fetch, no network require, shell false, no assignment of the opt-in or the engine root, exit 77 without the opt-in', () => {
  assert.ok(fs.existsSync(LIVE), 'tests/test-387-eureka-live-leak.cjs must exist');
  const src = fs.readFileSync(LIVE, 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  assert.ok(!/\bfetch\s*\(/.test(code), 'no fetch call');
  assert.ok(!/require\(\s*['"](node:)?(http|https|net|dns)['"]\s*\)/.test(code), 'no network module');
  assert.ok(!/\bexecSync\s*\(|\bexec\s*\(|shell:\s*true/.test(code), 'no shell spawn');
  const spawnCalls = code.split('spawnSync(').length - 1;
  assert.ok(spawnCalls >= 1, 'the live test spawns through spawnSync');
  const shellFalse = code.split(/shell:\s*false/).length - 1;
  assert.ok(shellFalse >= spawnCalls, 'every spawn sets shell false (' + shellFalse + ' of ' + spawnCalls + ')');
  const assign = [
    /process\.env\.MINDRIAN_EUREKA_(ROOT|LIVE_LEAK)\s*=[^=]/,
    /env\[\s*['"]MINDRIAN_EUREKA_(ROOT|LIVE_LEAK)['"]\s*\]\s*=[^=]/,
    /\bMINDRIAN_EUREKA_(ROOT|LIVE_LEAK)\s*:/,
    /['"]MINDRIAN_EUREKA_(ROOT|LIVE_LEAK)['"]\s*:/,
  ];
  for (const re of assign) assert.ok(!re.test(code), 'the live test must not assign the opt-in or the engine root: ' + re);
  const env = Object.assign({}, process.env);
  delete env.MINDRIAN_EUREKA_LIVE_LEAK;
  const res = childProcess.spawnSync(process.execPath, [LIVE], { env, encoding: 'utf8', shell: false, timeout: 60000 });
  assert.equal(res.status, 77, 'exit code ' + res.status + ' output ' + String(res.stdout).slice(0, 200) + String(res.stderr).slice(0, 200));
  assert.match(String(res.stdout) + String(res.stderr), /MINDRIAN_EUREKA_LIVE_LEAK is not 1/);
});

arm('L8 the runbook holds the commands, the four criteria, the second proof and the bytecode-noise sentence', () => {
  assert.ok(fs.existsSync(RUNBOOK), '387-LEAK-RUNBOOK.md must exist');
  const text = fs.readFileSync(RUNBOOK, 'utf8');
  const lower = text.toLowerCase();
  for (const needle of ['strace', 'unshare -rn', 'MINDRIAN_EUREKA_LIVE_LEAK=1', 'MINDRIAN_EUREKA_LEAK_NO_NET=1', 'tests/test-387-eureka-live-leak.cjs',
    'no_network', 'tests/conftest.py']) {
    assert.ok(text.includes(needle), 'runbook lacks: ' + needle);
  }
  for (const criterion of ['no non-local connect', 'changes only in the data and cache folders', 'engine folder and uv.lock unchanged', 'marker not in the sqlite files']) {
    assert.ok(lower.includes(criterion), 'runbook lacks the criterion: ' + criterion);
  }
  assert.ok(text.includes('Python bytecode files are listed as noise'), 'runbook lacks the bytecode-noise sentence');
});

for (const d of tmpDirs) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ } }
process.stdout.write('\ntest-387-eureka-leak-parsers: ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed > 0 ? 1 : 0);

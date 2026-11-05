#!/usr/bin/env node
'use strict';
/*
 * Phase 383 plan 01 (QA383-01, D-03 bash half): scripts/room-registry picks a working Python.
 *
 * On Windows the name python3 can be the Microsoft Store stub: it exists, it answers with exit
 * 9009, and `command -v python3` still succeeds. The registry must probe each candidate by its
 * version answer, take the first one that is Python 3.9 or newer, honor MINDRIAN_PYTHON, and say
 * which candidates it tried when none works. These legs run the real script with a PATH shim.
 *
 *   I1  python3 is a Store stub, python is real: create exits 0 and the registry lists the room
 *   I2  python3 is a Store stub, no python: exit 127, the tried list names both, nothing is written
 *   I3  no python on PATH, MINDRIAN_PYTHON is set: create exits 0
 *   I4  python3 is 3.8.10, python is real: create exits 0; with python removed it exits 127 (below 3.9)
 *   I5  python3 answers the version and then fails: the child text reaches stderr (guard leg)
 *   I6  static: no bare python3 -c or python3 - invocation is left, and "$PY" is used
 *   I7  review IN-03: py exists but py -3 fails, the tried list says "found but failed", not "not found"
 *
 * Hermetic: every run has its own HOME and rooms home under mkdtemp. No network.
 * House rule: hyphens only.
 */

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const H = require('./helpers/harness-383.cjs');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY = path.join(ROOT, 'scripts', 'room-registry');
const rep = H.reporter('test-383-registry-interpreter');

function run(h, shimDir, extraEnv, args) {
  const env = Object.assign({}, h.env, { PATH: shimDir }, extraEnv || {});
  return cp.spawnSync(H.realBash(), [REGISTRY].concat(args), { env: env, cwd: ROOT, encoding: 'utf8', timeout: 60000 });
}
function createArgs(h, slug) {
  return [h.roomsHome, 'create', slug, path.join(h.roomsHome, slug), 'Probe', 'idea'];
}
function registryOf(h) {
  const f = path.join(h.roomsHome, '.rooms', 'registry.json');
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
}
function ok(cond, what) { if (!cond) throw new Error(what); }
function tail(r) { return 'exit=' + r.status + ' stderr=' + String(r.stderr || '').slice(-300); }

const legs = [];
function leg(label, needsPython, fn) { legs.push({ label: label, needsPython: needsPython, fn: fn }); }

leg('I1 python3 is a Store stub, python is real: create exits 0 and the registry lists the room', true, function () {
  const h = H.hermeticEnv('i1');
  const r = run(h, H.shimPath({ python3: 'store-stub', python: 'real' }), null, createArgs(h, 'probe-i1'));
  ok(r.status === 0, tail(r));
  const reg = registryOf(h);
  ok(reg && reg.rooms && reg.rooms['probe-i1'], 'registry does not list probe-i1: ' + JSON.stringify(reg));
});

leg('I2 python3 is a Store stub, no python: exit 127, the tried list names both, nothing is written', true, function () {
  const h = H.hermeticEnv('i2');
  const r = run(h, H.shimPath({ python3: 'store-stub' }), null, createArgs(h, 'probe-i2'));
  const err = String(r.stderr || '');
  ok(r.status === 127, 'exit code ' + r.status + ' (want 127): ' + tail(r));
  ok(/python3/.test(err) && /python\b/.test(err), 'stderr does not name python3 and python: ' + err.slice(-300));
  ok(/Microsoft Store stub/.test(err), 'stderr does not say "Microsoft Store stub": ' + err.slice(-300));
  ok(!/WSL/.test(err), 'stderr mentions WSL: ' + err.slice(-300));
  ok(!fs.existsSync(path.join(h.roomsHome, 'probe-i2')), 'room folder probe-i2 exists after a refused run');
  ok(!fs.existsSync(path.join(h.roomsHome, '.rooms', 'registry.json')), 'registry.json exists after a refused run');
});

leg('I3 no python on PATH, MINDRIAN_PYTHON is set: create exits 0', true, function () {
  const h = H.hermeticEnv('i3');
  const r = run(h, H.shimPath({}), { MINDRIAN_PYTHON: H.realPython3() }, createArgs(h, 'probe-i3'));
  ok(r.status === 0, tail(r));
});

leg('I4 python3 is 3.8.10: python is used; with python removed the run exits 127 and says below 3.9', true, function () {
  const h = H.hermeticEnv('i4a');
  const r1 = run(h, H.shimPath({ python3: 'version:3.8.10', python: 'real' }), null, createArgs(h, 'probe-i4'));
  ok(r1.status === 0, 'with python present: ' + tail(r1));
  const h2 = H.hermeticEnv('i4b');
  const r2 = run(h2, H.shimPath({ python3: 'version:3.8.10' }), null, createArgs(h2, 'probe-i4'));
  ok(r2.status === 127, 'without python, exit code ' + r2.status + ' (want 127): ' + tail(r2));
  ok(/below 3\.9/.test(String(r2.stderr || '')), 'stderr does not say "below 3.9": ' + String(r2.stderr || '').slice(-300));
});

leg('I5 python3 answers the version and then fails: the child text reaches stderr (guard leg)', true, function () {
  const h = H.hermeticEnv('i5');
  const r = run(h, H.shimPath({ python3: 'boom' }), null, createArgs(h, 'probe-i5'));
  ok(r.status !== 0, 'exit code is 0 for a failing interpreter');
  ok(/boom/.test(String(r.stderr || '')), 'stderr does not carry the child text: ' + String(r.stderr || '').slice(-300));
});

leg('I6 static: no bare python3 -c or python3 - invocation is left, and "$PY" is used at least 12 times', false, function () {
  const lines = fs.readFileSync(REGISTRY, 'utf8').split('\n').filter(function (l) { return !/^\s*#/.test(l); });
  const text = lines.join('\n');
  const bare = lines.filter(function (l) { return /(^|[\s(=])python3 (-c|-)( |$)/.test(l); });
  const uses = text.split('"$PY"').length - 1;
  ok(bare.length === 0, bare.length + ' bare python3 invocation line(s), first: ' + (bare[0] || '').trim().slice(0, 100));
  ok(uses >= 12, '"$PY" appears ' + uses + ' time(s), want at least 12');
});

leg('I7 review IN-03: py exists but py -3 fails: the tried list says "py -3: found but failed"', true, function () {
  const h = H.hermeticEnv('i7');
  const r = run(h, H.shimPath({ python3: 'store-stub', py: 'fail' }), null, createArgs(h, 'probe-i7'));
  const err = String(r.stderr || '');
  ok(r.status === 127, 'exit code ' + r.status + ' (want 127): ' + tail(r));
  ok(/py -3: found but failed/.test(err), 'stderr: ' + err.slice(-300));
  const h2 = H.hermeticEnv('i7b');
  const r2 = run(h2, H.shimPath({ python3: 'store-stub' }), null, createArgs(h2, 'probe-i7b'));
  ok(/py -3: not found/.test(String(r2.stderr || '')), 'no py at all still says not found: ' + String(r2.stderr || '').slice(-300));
});

let skipAll = null;
try {
  if (!H.realBash()) throw new H.Skip('no bash under /usr/bin or /bin');
  H.shimPath({});
} catch (e) {
  if (e instanceof H.Skip) skipAll = e.message; else throw e;
}
if (skipAll) {
  console.log('SKIP test-383-registry-interpreter: ' + skipAll);
  process.exit(0);
}

const havePython = H.realPython3() !== null;
for (const l of legs) {
  if (l.needsPython && !havePython) { rep.pending(l.label, 'no real python3 on this host'); continue; }
  try { l.fn(); rep.pass(l.label); } catch (e) { rep.fail(l.label, String(e && e.message || e)); }
}
rep.done();

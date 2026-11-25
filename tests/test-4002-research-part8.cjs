#!/usr/bin/env node
'use strict';
// Phase 400.2-10: the Part 8 controls on a door search string (scripts/persona-hats.cjs checkHandle, composeString,
// roomIdentityScreen, IDENTITY_STOP_LIST; lib/core/persona-ops.cjs research tables). Legs E1 to E14.
// Plans 11 and 12 add legs. No test sends a network request.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const DOOR_PATH = path.join(ROOT, 'scripts', 'persona-hats.cjs');

let failed = 0;
let passed = 0;
const queue = [];
function check(label, fn) {
  queue.push({ label, fn });
}

let door;
let ops;
try {
  door = require(DOOR_PATH);
  ops = require(path.join(ROOT, 'lib', 'core', 'persona-ops.cjs'));
} catch (e) {
  console.log('FAIL: a module is missing: ' + (e && e.message ? e.message : String(e)));
  process.exit(1);
}

const tmpRoots = [];
function mkTmp(label) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-4002-research-part8-' + label + '-'));
  tmpRoots.push(d);
  return d;
}
function put(room, rel, text) {
  const abs = path.join(room, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text, 'utf8');
}
/** Build a room in a directory with a chosen base name. */
function makeRoom(dirName, stateText, extra) {
  const parent = mkTmp('p');
  const room = path.join(parent, dirName);
  fs.mkdirSync(room, { recursive: true });
  if (stateText !== null) put(room, 'STATE.md', stateText);
  const files = extra || {};
  for (const rel of Object.keys(files)) put(room, rel, files[rel]);
  return room;
}

const ACME_STATE = '---\nventure: Acme Robotics\nstage: seed\n---\n\n# Acme Robotics\n\nA test venture.\n';
function acmeRoom() {
  return makeRoom('acme-room', ACME_STATE, {
    'team/dana-levi.md': '# Team member\nA person.\n',
    'notes/reading.md': '# Reading notes\nWe met Orbitex last week. Then we left.\n',
  });
}
function acmeScreen() {
  const room = acmeRoom();
  return door.roomIdentityScreen(room, ['notes/reading.md']);
}

check('E1. the qualifier table, the lens table and the status', () => {
  const Q = ops.HAT_RESEARCH_QUALIFIER;
  const L = ops.HAT_RESEARCH_LENSES;
  const keys = ['white', 'black', 'yellow', 'green'];
  assert.deepEqual(Object.keys(Q).sort(), keys.slice().sort());
  assert.deepEqual(Object.keys(L).sort(), keys.slice().sort());
  const seen = new Set();
  for (const k of keys) {
    assert.match(Q[k], /^[a-z]+ [a-z]+$/);
    seen.add(Q[k]);
  }
  assert.equal(seen.size, 4);
  assert.deepEqual(Q, { white: 'data statistics', black: 'failure cases', yellow: 'success cases', green: 'analogous solutions' });
  assert.deepEqual(L.white, ['scholarly', 'industry']);
  assert.deepEqual(L.black, ['scholarly', 'industry']);
  assert.deepEqual(L.yellow, ['industry', 'scholarly']);
  assert.deepEqual(L.green, ['scholarly', 'patent']);
  const map = require(path.join(ROOT, 'lib', 'lens-engine', 'source-lens-driver.cjs'))._internal.LENS_TO_SOURCE;
  for (const k of keys) {
    for (const lens of L[k]) {
      assert.notEqual(lens, 'brain');
      assert.ok(Object.prototype.hasOwnProperty.call(map, lens), lens);
    }
  }
  assert.ok(Object.isFrozen(Q) && Object.isFrozen(L));
  for (const k of keys) assert.ok(Object.isFrozen(L[k]));
  assert.equal(ops.HAT_RESEARCH_TABLES_STATUS, 'provisional');
});

check('E2. IDENTITY_STOP_LIST is frozen, lower case, without duplicates, and holds the context words', () => {
  const list = door.IDENTITY_STOP_LIST;
  assert.ok(Array.isArray(list) && Object.isFrozen(list));
  assert.equal(new Set(list).size, list.length);
  for (const w of list) assert.equal(w, w.toLowerCase());
  const need = ('room venture project company startup labs group systems solutions technologies global health energy data market platform ' +
    'network digital research design care food water power cloud mobile smart green blue open new test demo').split(' ');
  for (const w of need) assert.ok(list.includes(w), w);
});

check('E3. the screen of a room holds the venture, directory, team and proper-noun tokens', () => {
  const s = acmeScreen();
  assert.equal(s.ran, true);
  assert.equal(s.venture_name_found, true);
  for (const t of ['acme', 'robotics', 'dana', 'levi', 'orbitex']) assert.equal(s.has(t), true, t);
  assert.ok(s.tokens_checked >= 5);
});

check('E4. the first capital token of a sentence or of a heading is not screened', () => {
  const room = makeRoom('quillfeather', ACME_STATE, {
    'notes/reading.md': '# Headingword here\nSentenceword opens. Next Orbitex. Also lower start.\n- Bulletword begins here\n',
  });
  const s = door.roomIdentityScreen(room, ['notes/reading.md']);
  assert.equal(s.has('headingword'), false);
  assert.equal(s.has('sentenceword'), false);
  assert.equal(s.has('bulletword'), false);
  assert.equal(s.has('orbitex'), true);
  assert.equal(s.has('lower'), false);
});

check('E5. no venture name, or the default name, means the screen does not run', () => {
  const none = door.roomIdentityScreen(makeRoom('r1', 'just prose with no heading\n'), []);
  assert.equal(none.ran, false);
  assert.equal(none.venture_name_found, false);
  const unk = door.roomIdentityScreen(makeRoom('r2', '---\nventure: Unknown Venture\n---\n'), []);
  assert.equal(unk.ran, false);
  const missing = door.roomIdentityScreen(makeRoom('r3', null), []);
  assert.equal(missing.ran, false);
});

check('E6. the counts view of the screen holds no token', () => {
  const s = acmeScreen();
  const view = JSON.parse(JSON.stringify(s));
  assert.deepEqual(Object.keys(view).sort(), ['ran', 'tokens_checked', 'venture_name_found']);
  const text = JSON.stringify(s);
  for (const t of ['acme', 'robotics', 'dana', 'levi', 'orbitex']) assert.equal(text.includes(t), false, t);
  assert.deepEqual(Object.keys(s.counts()).sort(), ['ran', 'tokens_checked', 'venture_name_found']);
});

check('F11. invokePersona stays at line 550 of persona-ops.cjs', () => {
  const lines = fs.readFileSync(path.join(ROOT, 'lib', 'core', 'persona-ops.cjs'), 'utf8').split('\n');
  assert.ok(lines[549].startsWith('function invokePersona('), lines[549]);
});

(async () => {
  for (const t of queue) {
    try {
      await t.fn();
      passed += 1;
      console.log('ok: ' + t.label);
    } catch (e) {
      failed += 1;
      console.log('FAIL: ' + t.label + ' -- ' + (e && e.message ? e.message : String(e)));
    }
  }
  for (const d of tmpRoots) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) { /* ignore */ }
  }
  console.log(passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();

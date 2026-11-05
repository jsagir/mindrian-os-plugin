#!/usr/bin/env node
'use strict';
/*
 * Phase 383 plan 10 (D-02, QA383-10): the doubled-room-trees doctor point and its gated delete.
 *
 *   T1  a junk leaf that mirrors a real room is listed; the real room is never listed
 *   T2  a junk-shaped leaf with an edited STATE.md is kept: holds edited or extra files
 *   T3  a seed-shaped leaf with no matching real room is kept: no matching real room
 *   T4  a top folder named C: or C plus U+F03A is read as a drive-letter path for the mirror check
 *   T5  check() lists only: warn, the digest in the detail, the tree snapshot unchanged
 *   T6  clean() with a wrong digest deletes nothing
 *   T7  clean() with the current digest removes the leaf, prunes empty parents, stops before the home
 *   T8  a symlink is never followed and never removed
 *   T9  the walk stops at depth 16
 *   T10 the module exports no fix and the source has no rmSync
 *   T11 CLI: a wrong digest exits 1 and removes nothing; the current digest exits 0 and removes it
 *   T12 doctor --fix never deletes (the sibling flag is the only path)
 *   T13 the templates equal the heredocs of scripts/room-registry
 *   T14 the registry entry exists, is check-only, flag null
 *   T15 an edited folder next to a removable one survives clean()
 *   T16 a changed listing changes the digest, so a stale digest deletes nothing
 *   T17 review WR-03: a cap hit sets truncated, the digest differs from a complete listing, check() says partial
 *   T18 review WR-03: the walk order is sorted, so the same tree gives the same listing and digest
 *
 * Hermetic: HOME and the rooms vars are mkdtemp dirs. No network. House rule: hyphens only.
 */

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const H = require('./helpers/harness-383.cjs');

const ROOT = path.resolve(__dirname, '..');
const mod = require(path.join(ROOT, 'lib', 'core', 'doctor', 'doubled-room-trees-module.cjs'));
const rep = H.reporter('test-383-doubled-room-trees');

const STATE_T = '---\ngsd_state_version: 1.0\nstatus: active\n---\n\n# State\n\n## Decisions\n\n(none yet)\n';
const USER_T = '---\ncanonical_role: null\njourney_stage: null\n---\n\n# User Profile\n\nRun /mos:profile-user to populate.\n';

function roomMd(name) {
  return '---\nroom_id: ' + name + '\nventure_name: ' + name + '\nventure_stage: Design\ncreated: 2026-09-16T14:47:03Z\n---\n\n# ' + name + '\n\nStage: Design\n';
}
function seed(dir, name) {
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'ROOM.md'), roomMd(name));
  fs.writeFileSync(path.join(dir, 'STATE.md'), STATE_T);
  fs.writeFileSync(path.join(dir, 'USER.md'), USER_T);
}
// A rooms home with a real room "axiom" and its doubled copy under <home>/<home sans slash>/axiom.
function fixture(label) {
  const h = H.hermeticEnv(label);
  const real = path.join(h.roomsHome, 'axiom');
  seed(real, 'axiom');
  fs.writeFileSync(path.join(real, '.room-root'), '');
  const doubledRel = h.roomsHome.replace(/^\//, '') + '/axiom';
  const doubled = path.join(h.roomsHome, doubledRel);
  seed(doubled, 'axiom');
  return { h: h, real: real, doubled: doubled, doubledRel: doubledRel, topName: doubledRel.split('/')[0] };
}
function runCli(args, env) {
  return cp.spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'doctor.cjs')].concat(args), {
    env: env, encoding: 'utf8', cwd: H.mkTmp('cwd'), timeout: 240000,
  });
}
function leg(label, fn) {
  try { fn(); rep.pass(label); } catch (e) { rep.fail(label, e && e.message); }
}
function eq(a, b, what) {
  if (a !== b) throw new Error((what || 'value') + ': expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a));
}
function ok(c, what) { if (!c) throw new Error(what || 'expected true'); }

// check() reads the rooms home through listRoomRoots, which reads MINDRIAN_ROOMS_HOME at call time.
function withHome(home, fn) {
  const prev = process.env.MINDRIAN_ROOMS_HOME;
  process.env.MINDRIAN_ROOMS_HOME = home;
  try { return fn(); } finally {
    if (prev === undefined) delete process.env.MINDRIAN_ROOMS_HOME; else process.env.MINDRIAN_ROOMS_HOME = prev;
  }
}

leg('T1 junk leaf mirrors a real room: listed, real room not listed', function () {
  const f = fixture('t1');
  const r = mod.listDoubledTrees(f.h.roomsHome);
  eq(r.leaves.length, 1, 'leaf count');
  eq(r.leaves[0], f.doubledRel, 'leaf path');
  eq(r.tops[0], f.topName, 'top');
  ok(!r.leaves.some(function (l) { return l === 'axiom'; }), 'real room listed');
  eq(r.kept.length, 0, 'kept');
});

leg('T2 edited STATE.md: kept as holds edited or extra files', function () {
  const f = fixture('t2');
  fs.appendFileSync(path.join(f.doubled, 'STATE.md'), 'user note\n');
  const r = mod.listDoubledTrees(f.h.roomsHome);
  eq(r.leaves.length, 0, 'leaf count');
  eq(r.kept.length, 1, 'kept count');
  eq(r.kept[0].reason, 'holds edited or extra files', 'reason');
  // an extra file is the same class
  const g = fixture('t2b');
  fs.writeFileSync(path.join(g.doubled, 'notes.md'), 'x');
  eq(mod.listDoubledTrees(g.h.roomsHome).kept[0].reason, 'holds edited or extra files', 'extra file reason');
});

leg('T3 seed-shaped leaf with no matching real room is kept', function () {
  const f = fixture('t3');
  fs.rmSync(f.real, { recursive: true, force: true });
  const r = mod.listDoubledTrees(f.h.roomsHome);
  eq(r.leaves.length, 0, 'leaf count');
  eq(r.kept.length, 1, 'kept count');
  eq(r.kept[0].reason, 'no matching real room', 'reason');
});

leg('T4 C: and C plus U+F03A tops are read as drive-letter paths', function () {
  for (const topName of ['C:', 'C\uF03A']) {
    const h = H.hermeticEnv('t4');
    const leaf = path.join(h.roomsHome, topName, 'Users', 'x', 'MindrianRooms', 'axiom');
    seed(leaf, 'axiom');
    const model = new Set(['C:/Users/x/MindrianRooms/axiom', 'C:/Users/x/MindrianRooms/axiom/ROOM.md']);
    const r = mod.listDoubledTrees(h.roomsHome, {
      isDir: function (p) { return p === 'C:/Users/x/MindrianRooms/axiom'; },
      exists: function (p) { return model.has(p); },
    });
    eq(r.leaves.length, 1, 'leaf count for ' + JSON.stringify(topName));
    eq(r.leaves[0], topName + '/Users/x/MindrianRooms/axiom', 'leaf path');
    // the same tree with no modelled mirror is kept
    const none = mod.listDoubledTrees(h.roomsHome);
    eq(none.leaves.length, 0, 'no mirror, no leaf');
  }
});

leg('T5 check() lists only: warn, digest in detail, tree unchanged', function () {
  const f = fixture('t5');
  const before = H.snapshotTree(f.h.roomsHome);
  const res = withHome(f.h.roomsHome, function () { return mod.check({}); });
  const after = H.snapshotTree(f.h.roomsHome);
  eq(res.status, 'warn', 'status');
  const digest = mod.listingDigest(mod.listDoubledTrees(f.h.roomsHome));
  ok(res.detail.indexOf('digest ' + digest) !== -1, 'digest in detail: ' + res.detail);
  ok(res.detail.indexOf('1 doubled-path folder(s)') !== -1, 'count in detail');
  ok(Array.isArray(res.action_lines) && res.action_lines[0].indexOf('--clean-doubled-rooms=' + digest) !== -1, 'action line');
  eq(JSON.stringify(after), JSON.stringify(before), 'tree snapshot');
  // a clean home reports ok
  const h2 = H.hermeticEnv('t5ok');
  eq(withHome(h2.roomsHome, function () { return mod.check({}); }).status, 'ok', 'clean home status');
});

leg('T6 clean() with a wrong digest deletes nothing', function () {
  const f = fixture('t6');
  const before = H.snapshotTree(f.h.roomsHome);
  const res = mod.clean({ home: f.h.roomsHome, digest: '000000000000' });
  eq(res.ok, false, 'ok');
  eq(res.reason, 'digest_mismatch', 'reason');
  eq(res.removed.length, 0, 'removed');
  eq(JSON.stringify(H.snapshotTree(f.h.roomsHome)), JSON.stringify(before), 'tree snapshot');
  eq(mod.clean({ home: f.h.roomsHome }).ok, false, 'missing digest');
});

leg('T7 clean() with the current digest removes the leaf and prunes empty parents', function () {
  const f = fixture('t7');
  const digest = mod.listingDigest(mod.listDoubledTrees(f.h.roomsHome));
  const res = mod.clean({ home: f.h.roomsHome, digest: digest });
  eq(res.ok, true, 'ok');
  eq(res.removed.length, 1, 'removed count');
  ok(!fs.existsSync(f.doubled), 'leaf gone');
  ok(!fs.existsSync(path.join(f.h.roomsHome, f.topName)), 'empty parents gone');
  ok(fs.existsSync(f.h.roomsHome), 'home kept');
  ok(fs.existsSync(path.join(f.real, 'ROOM.md')), 'real room kept');
  ok(fs.existsSync(path.join(f.real, '.room-root')), 'real room marker kept');
  eq(mod.clean({ home: f.h.roomsHome, digest: digest }).detail, 'nothing to remove', 'second run');
});

leg('T8 a symlink is never followed and never removed', function () {
  const f = fixture('t8');
  const elsewhere = H.mkTmp('t8-target');
  seed(path.join(elsewhere, 'axiom'), 'axiom');
  // replace the doubled copy by a symlink to a seed-shaped folder outside the home
  fs.rmSync(f.doubled, { recursive: true, force: true });
  fs.symlinkSync(path.join(elsewhere, 'axiom'), f.doubled);
  const r = mod.listDoubledTrees(f.h.roomsHome);
  eq(r.leaves.length, 0, 'symlink listed');
  const res = mod.clean({ home: f.h.roomsHome, digest: mod.listingDigest(r) });
  eq(res.removed.length, 0, 'removed');
  ok(fs.existsSync(path.join(elsewhere, 'axiom', 'ROOM.md')), 'target intact');
  // a symlinked top folder is skipped too
  const g = fixture('t8b');
  const t2 = H.mkTmp('t8b-target');
  fs.symlinkSync(t2, path.join(g.h.roomsHome, 'linked-top'));
  seed(path.join(t2, 'x', 'axiom'), 'axiom');
  eq(mod.listDoubledTrees(g.h.roomsHome).leaves.length, 1, 'only the real doubled leaf');
});

leg('T9 the walk stops at depth 16', function () {
  const h = H.hermeticEnv('t9');
  seed(path.join(h.roomsHome, 'axiom'), 'axiom');
  const deep = path.join(h.roomsHome, 'top', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10', 'a11', 'a12', 'a13', 'a14', 'a15', 'a16', 'a17', 'axiom');
  seed(deep, 'axiom');
  const r = mod.listDoubledTrees(h.roomsHome, { isDir: function () { return true; }, exists: function () { return true; } });
  eq(r.leaves.length, 0, 'deep leaf listed');
});

leg('T10 no fix export and no rmSync in the source', function () {
  eq(typeof mod.fix, 'undefined', 'fix');
  eq(typeof mod.clean, 'function', 'clean');
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'core', 'doctor', 'doubled-room-trees-module.cjs'), 'utf8');
  ok(src.indexOf('rmSync') === -1, 'rmSync present');
  ok(!/[\u2013\u2014]/.test(src), 'dash in source');
});

leg('T11 CLI: wrong digest exits 1, current digest exits 0', function () {
  const f = fixture('t11');
  const wrong = runCli(['--clean-doubled-rooms=000000000000'], f.h.env);
  eq(wrong.status, 1, 'wrong digest exit: ' + wrong.stdout + wrong.stderr);
  ok(fs.existsSync(f.doubled), 'wrong digest removed the folder');
  ok(/Nothing was deleted\./.test(wrong.stdout), 'plain first line: ' + wrong.stdout);
  eq(wrong.stdout.trim().split('\n').length, 3, 'three plain lines');
  const digest = mod.listingDigest(mod.listDoubledTrees(f.h.roomsHome));
  const good = runCli(['--clean-doubled-rooms=' + digest], f.h.env);
  eq(good.status, 0, 'good digest exit: ' + good.stdout + good.stderr);
  ok(!fs.existsSync(f.doubled), 'folder still there');
  ok(fs.existsSync(path.join(f.real, 'ROOM.md')), 'real room removed');
});

leg('T12 doctor --fix never deletes the doubled folder', function () {
  const f = fixture('t12');
  const res = runCli(['--fix'], f.h.env);
  ok(res.status === 0 || res.status === 1, 'doctor --fix ran: status ' + res.status + ' ' + String(res.stderr).slice(0, 300));
  ok(fs.existsSync(path.join(f.doubled, 'ROOM.md')), 'doctor --fix deleted the doubled folder');
  ok(fs.existsSync(path.join(f.real, 'ROOM.md')), 'real room changed');
});

leg('T13 templates equal the heredocs of scripts/room-registry', function () {
  const src = fs.readFileSync(path.join(ROOT, 'scripts', 'room-registry'), 'utf8');
  function heredoc(tag) {
    const open = "<<'" + tag + "'\n";
    const a = src.indexOf(open);
    if (a === -1) throw new Error('no heredoc ' + tag);
    const b = src.indexOf('\n' + tag + '\n', a);
    return src.slice(a + open.length, b + 1);
  }
  eq(heredoc('STATE_EOF'), STATE_T, 'STATE template');
  eq(heredoc('USER_EOF'), USER_T, 'USER template');
  ok(src.indexOf('venture_stage: ${VSTAGE}\ncreated: $(date -u +%Y-%m-%dT%H:%M:%SZ)\n---\n\n# ${VNAME}\n\nStage: ${VSTAGE}\nROOM_EOF') !== -1, 'ROOM template shape moved');
});

leg('T14 the registry entry is check-only with flag null', function () {
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'doctor-modules.json'), 'utf8'));
  const ids = reg.modules.map(function (m) { return m.id; });
  const e = reg.modules.find(function (m) { return m.id === 'doubled-room-trees'; });
  ok(e, 'entry missing');
  eq(e.fix_supported, false, 'fix_supported');
  eq(e.flag, null, 'flag');
  eq(e.runner, 'lib/core/doctor/doubled-room-trees-module.cjs', 'runner');
  eq(ids.indexOf('doubled-room-trees'), ids.indexOf('room-runtime') + 1, 'placed after room-runtime');
});

leg('T15 an edited folder next to a removable one survives clean()', function () {
  const f = fixture('t15');
  const other = path.join(path.dirname(f.doubled), 'other');
  seed(other, 'other');
  fs.appendFileSync(path.join(other, 'USER.md'), 'mine\n');
  const listing = mod.listDoubledTrees(f.h.roomsHome);
  eq(listing.leaves.length, 1, 'leaf count');
  const res = mod.clean({ home: f.h.roomsHome, digest: mod.listingDigest(listing) });
  eq(res.ok, true, 'ok');
  ok(!fs.existsSync(f.doubled), 'removable leaf gone');
  ok(fs.existsSync(path.join(other, 'USER.md')), 'edited folder kept');
  ok(res.kept.some(function (k) { return k.path.endsWith('/other'); }), 'kept is named');
});

leg('T16 a changed listing changes the digest: a stale digest deletes nothing', function () {
  const f = fixture('t16');
  const stale = mod.listingDigest(mod.listDoubledTrees(f.h.roomsHome));
  // a second room and its doubled copy appear after the approval
  seed(path.join(f.h.roomsHome, 'beta'), 'beta');
  fs.writeFileSync(path.join(f.h.roomsHome, 'beta', '.room-root'), '');
  seed(path.join(path.dirname(f.doubled), 'beta'), 'beta');
  const fresh = mod.listingDigest(mod.listDoubledTrees(f.h.roomsHome));
  ok(fresh !== stale, 'digest did not change');
  const res = mod.clean({ home: f.h.roomsHome, digest: stale });
  eq(res.reason, 'digest_mismatch', 'reason');
  ok(fs.existsSync(f.doubled), 'stale digest deleted a folder');
});

leg('T17 review WR-03: a cap hit sets truncated, the digest differs, check() says partial', function () {
  const f = fixture('t17');
  const full = mod.listDoubledTrees(f.h.roomsHome);
  eq(full.truncated, false, 'complete listing is not truncated');
  const capped = mod.listDoubledTrees(f.h.roomsHome, { maxEntries: 1 });
  eq(capped.truncated, true, 'entry cap sets truncated');
  ok(mod.listingDigest(capped) !== mod.listingDigest(full), 'a partial digest equals the complete digest');
  // a digest approved for the complete list does not delete from a partial one
  const res = mod.clean({ home: f.h.roomsHome, digest: mod.listingDigest(full), listOpts: { maxEntries: 1 } });
  ok(res.ok === false || res.removed.length === 0, 'a complete-list digest removed from a partial list');
  ok(fs.existsSync(f.doubled), 'folder removed under a partial list');
  // depth cap: a tree deeper than 16 levels under a non-room top folder
  const h = H.hermeticEnv('t17d');
  const deep = path.join(h.roomsHome, 'top', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10', 'a11', 'a12', 'a13', 'a14', 'a15', 'a16', 'a17');
  fs.mkdirSync(deep, { recursive: true });
  const r = withHome(h.roomsHome, function () { return mod.check({}); });
  eq(r.status, 'warn', 'status of a partial listing with no leaves');
  ok(/partial listing/.test(r.detail), 'the row says partial: ' + r.detail);
  // with leaves and a cap hit the row also says partial (default caps cannot trip here, so shape-check the source text)
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'core', 'doctor', 'doubled-room-trees-module.cjs'), 'utf8');
  ok(src.indexOf("(listing.truncated ? ' (' + partialNote + ')' : '')") !== -1, 'leaf row carries the partial note');
});

leg('T18 review WR-03: the walk order is sorted, the same tree gives the same listing', function () {
  const h = H.hermeticEnv('t18');
  seed(path.join(h.roomsHome, 'axiom'), 'axiom');
  fs.writeFileSync(path.join(h.roomsHome, 'axiom', '.room-root'), '');
  const orig = fs.readdirSync;
  const reversed = function (d, o) {
    const r = orig.call(fs, d, o);
    return Array.isArray(r) ? r.slice().reverse() : r;
  };
  for (const n of ['a', 'b', 'c']) seed(path.join(h.roomsHome, 'x', n, 'axiom'), 'axiom');
  const opts = { isDir: function () { return true; }, exists: function () { return true; } };
  const one = mod.listDoubledTrees(h.roomsHome, opts);
  fs.readdirSync = reversed;
  let two;
  try { two = mod.listDoubledTrees(h.roomsHome, opts); } finally { fs.readdirSync = orig; }
  eq(JSON.stringify(two.leaves), JSON.stringify(one.leaves), 'leaves under a reversed readdir order');
  eq(mod.listingDigest(two), mod.listingDigest(one), 'digest under a reversed readdir order');
  // the entry cap keeps the same survivors whatever the readdir order
  const capOne = mod.listDoubledTrees(h.roomsHome, Object.assign({ maxEntries: 3 }, opts));
  fs.readdirSync = reversed;
  let capTwo;
  try { capTwo = mod.listDoubledTrees(h.roomsHome, Object.assign({ maxEntries: 3 }, opts)); } finally { fs.readdirSync = orig; }
  eq(JSON.stringify(capTwo.leaves), JSON.stringify(capOne.leaves), 'capped leaves under a reversed readdir order');
});

rep.done();

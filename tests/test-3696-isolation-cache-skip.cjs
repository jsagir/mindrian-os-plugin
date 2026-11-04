#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick 261103-vdn: filesNewerThan of scripts/isolate-larry-voice.cjs skips exactly one path,
 * room/.mindrian/statusline-cache.json under the root it is given. A live Claude statusline rewrites
 * that gitignored file about every 7 s, which made legs B4d and B5f of test-3696-isolation.cjs fail
 * inside the suite while they pass alone.
 *
 *   S1  a file at that exact path, newer than the marker, is NOT reported
 *   S2  another file in the same folder (room/.mindrian/) newer than the marker IS reported
 *   S3  a file with the same name in another folder IS reported
 *   S4  an ordinary new file at the root IS reported
 *   S5  a file older than the marker is not reported (the marker still decides)
 *   S6  a root with a glob character in its name still skips the exact file and still reports the rest
 *   S7  no em-dash or en-dash in this file
 *
 * Hermetic: every tree is a temp directory this test creates and removes.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { installNetGuard, makeChecker } = require('./helpers/hygiene-355.cjs');

const NET = installNetGuard();
const C = makeChecker('quick 261103-vdn isolation cache skip');
const check = C.check;
const iso = require('../scripts/isolate-larry-voice.cjs');

const OWNED = [];
function mk(prefix) {
  const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  OWNED.push(d);
  return d;
}
function put(root, rel, mtimeSec) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, 'x');
  fs.utimesSync(p, mtimeSec, mtimeSec);
  return p;
}
const T0 = 1800000000; // marker time, seconds
function tree(prefix) {
  const root = mk(prefix);
  const marker = put(root, 'marker', T0);
  return { root, marker };
}
function rels(root, list) { return list.map(function (p) { return path.relative(root, p); }).sort(); }

// S1 to S5
const A = tree('cache-skip-a-');
put(A.root, 'room/.mindrian/statusline-cache.json', T0 + 100);
put(A.root, 'room/.mindrian/session-context.txt', T0 + 100);
put(A.root, 'other/statusline-cache.json', T0 + 100);
put(A.root, 'new-file.txt', T0 + 100);
put(A.root, 'old-file.txt', T0 - 100);
const got = rels(A.root, iso.filesNewerThan(A.root, A.marker));
check('S1 the exact statusline cache path newer than the marker is not reported', got.indexOf(path.join('room', '.mindrian', 'statusline-cache.json')) === -1, got.join(','));
check('S2 a sibling file in room/.mindrian/ newer than the marker is reported', got.indexOf(path.join('room', '.mindrian', 'session-context.txt')) !== -1, got.join(','));
check('S3 the same file name in another folder is reported', got.indexOf(path.join('other', 'statusline-cache.json')) !== -1, got.join(','));
check('S4 an ordinary new file at the root is reported', got.indexOf('new-file.txt') !== -1, got.join(','));
check('S5 a file older than the marker is not reported', got.indexOf('old-file.txt') === -1, got.join(','));
check('S5b the reported set is exactly the three expected files', got.length === 3, got.join(','));

// S6: a glob character in the root name
const base = mk('cache-skip-glob-');
const gRoot = path.join(base, 'we[ir]d*root');
fs.mkdirSync(gRoot);
const gMarker = put(gRoot, 'marker', T0);
put(gRoot, 'room/.mindrian/statusline-cache.json', T0 + 100);
put(gRoot, 'room/.mindrian/other.json', T0 + 100);
const g = rels(gRoot, iso.filesNewerThan(gRoot, gMarker));
check('S6 a glob character in the root name: the cache is skipped and the sibling is still reported', g.length === 1 && g[0] === path.join('room', '.mindrian', 'other.json'), g.join(','));

// S7
const DASHES = [String.fromCharCode(8211), String.fromCharCode(8212)];
check('S7 no em-dash or en-dash in this file', !DASHES.some(function (d) { return fs.readFileSync(__filename, 'utf8').indexOf(d) !== -1; }));
check('NET the net guard counted zero fetch calls', NET.attempts() === 0);

OWNED.forEach(function (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ } });
process.exit(C.summary());

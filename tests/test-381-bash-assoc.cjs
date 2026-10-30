'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 381 Plan 03 Task 1 (PERF381-04, ruling 7) -- BashAssoc iterates keys in the exact order
 * bash 5 prints for "${!a[@]}" on this host.
 *
 * Legs (each compares BashAssoc.keys() with the live bash order):
 *   A. 100 keys; B. 5,000 keys (one table growth); C. 9,000 keys (two growths);
 *   D. UTF-8 keys (Hebrew, accented Latin, an astral emoji, CJK); E. keys with | , space and a
 *      trailing space; F. an update case (set on an existing key keeps its position);
 *   G. assumption A1 (char signedness): the host truth is derived from live bash and must equal
 *      the module BASH_SIGNED_CHAR; the two hashes must differ on the UTF-8 set or the leg proves
 *      nothing;
 *   H. class surface: size, has, get.
 *
 * Expected order comes from running bash (constant program, keys in a NUL-separated file), never
 * from this file's own arithmetic. First output line names process.arch and BASH_SIGNED_CHAR.
 * Prints "SKIP bash < 4" when bash is older than 4.
 *
 * Plain node:assert/strict, zero deps, mkdtemp only. Exit 0 pass, 1 fail. Hyphens only.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const live = require('./helpers/live-381.cjs');
const scan = require('../lib/core/room-scan.cjs');

console.log('arch=' + process.arch + ' BASH_SIGNED_CHAR=' + scan.BASH_SIGNED_CHAR);

const ver = live.runBash('printf "%s" "${BASH_VERSINFO[0]}"', []);
if (Number(ver.stdout.toString('utf8')) < 4) {
  console.log('SKIP bash < 4');
  process.exit(0);
}

let failures = 0;
function leg(name, fn) {
  try {
    fn();
    console.log('ok - ' + name);
  } catch (err) {
    failures += 1;
    console.log('not ok - ' + name);
    console.log('    ' + String(err && err.message ? err.message : err).split('\n').join('\n    '));
  }
}

const tmp = live.mkTmp('assoc');
const PROGRAM = 'declare -A a; while IFS= read -r -d "" k; do a["$k"]=1; done < "$1"; ' +
  'for k in "${!a[@]}"; do printf "%s\\0" "$k"; done';
let fileSeq = 0;
function bashOrder(keys) {
  const file = path.join(tmp, 'keys-' + (fileSeq += 1) + '.bin');
  fs.writeFileSync(file, keys.map((k) => k + '\0').join(''));
  const r = live.runBash(PROGRAM, [file]);
  assert.equal(r.status, 0, 'bash failed: ' + String(r.stderr));
  return live.nulSplit(r.stdout);
}
function jsOrder(keys, opts) {
  const a = new scan.BashAssoc(opts);
  keys.forEach((k) => a.set(k, 1));
  return a.keys();
}
function sameOrder(label, expected, got) {
  assert.equal(got.length, expected.length, label + ': key count');
  for (let i = 0; i < expected.length; i += 1) {
    if (got[i] !== expected[i]) {
      assert.fail(label + ': first difference at position ' + i + ': bash=' + JSON.stringify(expected[i]) +
        ' js=' + JSON.stringify(got[i]));
    }
  }
}

function numbered(prefix, n) {
  const out = [];
  for (let i = 0; i < n; i += 1) out.push(prefix + i);
  return out;
}

const K100 = numbered('k', 100);
const K5000 = numbered('key-', 5000);
const K9000 = numbered('section/artifact-', 9000);
const KUTF8 = [].concat(
  ['שלום', 'עולם', 'café', 'naïve', 'ñandú', '😀', '𐍈', '漢字', 'データ', 'Ωmega', 'ÀÉÎÕÜ'],
  numbered('שלום-', 120), numbered('é', 120), numbered('😀', 60), numbered('漢', 60), numbered('ü-', 60)
);
const KMIX = [].concat(
  ['a|b', 'a,b', 'a b', 'trail ', 'x y z ', ' lead', 'a|', '|a', ',', '|', 'Smith, John', 'Pat|Lee'],
  numbered('mix |', 80), numbered('mix, ', 80), numbered('t ', 40)
);
const KUPDATE = [].concat(numbered('u', 200), ['u7', 'u150', 'u0', 'u199', 'u7'], numbered('v', 50), ['u3', 'v3']);

leg('A. 100 keys match the bash order', () => {
  sameOrder('K100', bashOrder(K100), jsOrder(K100));
});
leg('B. 5,000 keys (one growth) match the bash order', () => {
  sameOrder('K5000', bashOrder(K5000), jsOrder(K5000));
});
leg('C. 9,000 keys (two growths) match the bash order', () => {
  sameOrder('K9000', bashOrder(K9000), jsOrder(K9000));
});
[2047, 2048, 2049, 8191, 8192, 8193].forEach((n) => {
  leg('C. growth boundary with ' + n + ' keys matches the bash order', () => {
    const keys = numbered('b', n);
    sameOrder('K' + n, bashOrder(keys), jsOrder(keys));
  });
});
leg('D. UTF-8 keys match the bash order', () => {
  sameOrder('KUTF8', bashOrder(KUTF8), jsOrder(KUTF8));
});
leg('E. keys with separators, spaces and a trailing space match', () => {
  sameOrder('KMIX', bashOrder(KMIX), jsOrder(KMIX));
});
leg('F. an update keeps the position (set on an existing key)', () => {
  sameOrder('KUPDATE', bashOrder(KUPDATE), jsOrder(KUPDATE));
  const a = new scan.BashAssoc();
  a.set('first', 1);
  a.set('second', 2);
  const before = a.keys();
  a.set('first', 99);
  assert.deepEqual(a.keys(), before);
  assert.equal(a.get('first'), 99);
  assert.equal(a.size, 2);
});
leg('G. assumption A1: host char signedness derived from live bash equals BASH_SIGNED_CHAR', () => {
  const expected = bashOrder(KUTF8);
  const asSigned = jsOrder(KUTF8, { signed: true });
  const asUnsigned = jsOrder(KUTF8, { signed: false });
  assert.notDeepEqual(asSigned, asUnsigned, 'the UTF-8 set must tell the two hashes apart');
  const matchSigned = JSON.stringify(asSigned) === JSON.stringify(expected);
  const matchUnsigned = JSON.stringify(asUnsigned) === JSON.stringify(expected);
  assert.ok(matchSigned !== matchUnsigned, 'exactly one hash variant must match live bash');
  console.log('    live bash on this host hashes with a ' + (matchSigned ? 'signed' : 'unsigned') + ' char');
  assert.equal(scan.BASH_SIGNED_CHAR, matchSigned, 'BASH_SIGNED_CHAR must equal the live host truth (assumption A1)');
});
leg('H. class surface: size, has, get, empty-string hash is the FNV offset', () => {
  const a = new scan.BashAssoc();
  assert.equal(a.size, 0);
  assert.equal(a.has('x'), false);
  assert.equal(a.get('x'), undefined);
  a.set('x', 'v');
  assert.equal(a.size, 1);
  assert.equal(a.has('x'), true);
  assert.equal(a.get('x'), 'v');
  assert.equal(scan.bashHash(''), 2166136261);
});

live.cleanup();
if (failures > 0) {
  console.log('FAILED legs: ' + failures);
  process.exit(1);
}
console.log('all legs ok');

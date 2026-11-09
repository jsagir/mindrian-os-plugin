#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Plan 392-01 (P0, measure first): the replay harness over the 694 audit
 * probe cases and the counts-only matrix it records.
 *
 * Arms:
 *   RH1  the harness module loads and exports the 4 named functions
 *   RH2  replayFixtures returns 694 rows with the 7 row fields, network 0
 *   RH3  group totals: extended 535, must_refuse 10 (fixture README)
 *   RH4  buildMatrix returns counts only, with every named section
 *   RH5  assertMatrixHygiene refuses a long string, a forbidden key and
 *        a credential shape; accepts the matrix of RH4
 *   RH6  the committed beta.81 matrix: hygiene, network_calls 0,
 *        guard_head 8455416a5, group totals, no rows
 *
 * Part 8: synthetic rooms only, temporary HOME, no network. The arms never
 * print a probe text. No em dash and no en dash anywhere.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const HARNESS = path.join(__dirname, 'helpers', 'part8-overblock-replay.cjs');
const BASELINE = path.join(__dirname, 'fixtures', '392-part8-replay', 'baseline-beta81.json');

// Isolate HOME before any plugin code is required.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mos392-01-'));
const TMP_HOME = path.join(TMP, 'home');
fs.mkdirSync(TMP_HOME, { recursive: true });
fs.mkdirSync(path.join(TMP, 'registry'), { recursive: true });
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = path.join(TMP, 'registry');
delete process.env.CLAUDE_ACTIVE_ROOM;

let failed = 0;
function arm(label, fn) {
  try {
    const msg = fn();
    console.log('ok - ' + label + (msg ? ' (' + msg + ')' : ''));
  } catch (e) {
    failed += 1;
    console.log('FAIL - ' + label + ': ' + (e && e.message ? e.message : String(e)));
  }
}
function need(cond, msg) {
  if (!cond) throw new Error(msg);
}
function throwsWith(fn, fragment) {
  try { fn(); } catch (e) {
    need(String(e && e.message).indexOf(fragment) >= 0, 'wrong error: ' + (e && e.message));
    return;
  }
  throw new Error('expected a throw holding "' + fragment + '"');
}

const ROW_FIELDS = ['key', 'set', 'group', 'tool', 'verdict', 'class', 'token_class'];
const MATRIX_SECTIONS = ['total', 'by_verdict', 'by_set', 'by_group', 'by_tool', 'by_class', 'by_token_class', 'extended_blocked', 'must_refuse_blocked'];
const FORBIDDEN_KEYS = ['question', 'text', 'cypher', 'query', 'statement', 'payload', 'snippet'];

function walkKeys(value, out) {
  if (Array.isArray(value)) { value.forEach(function (v) { walkKeys(v, out); }); return out; }
  if (value !== null && typeof value === 'object') {
    Object.keys(value).forEach(function (k) { out.push(k); walkKeys(value[k], out); });
  }
  return out;
}

// RH1: the module exists and exports the 4 functions.
let harness = null;
arm('RH1 harness module loads with the 4 exports', function () {
  harness = require(HARNESS);
  ['replayFixtures', 'replayRealCalls', 'buildMatrix', 'assertMatrixHygiene'].forEach(function (name) {
    need(typeof harness[name] === 'function', 'missing export ' + name);
  });
  return 'tests/helpers/part8-overblock-replay.cjs';
});

if (!harness) {
  console.log('FAIL - RH2..RH5 not run: the harness module did not load');
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  process.exit(1);
}

// RH2: replayFixtures over the 694 cases, no network.
let replay = null;
arm('RH2 replayFixtures returns 694 rows, network 0', function () {
  replay = harness.replayFixtures();
  need(replay && Array.isArray(replay.rows), 'rows is not an array');
  need(replay.rows.length === 694, 'rows ' + replay.rows.length + ', want 694');
  need(replay.network_calls === 0, 'network_calls ' + replay.network_calls);
  replay.rows.forEach(function (r) {
    need(Object.keys(r).length === ROW_FIELDS.length, 'row has ' + Object.keys(r).length + ' fields');
    ROW_FIELDS.forEach(function (f) { need(f in r, 'row misses ' + f); });
    need(typeof r.tool === 'string' && r.tool.length > 0, 'row without tool');
    need(['allow', 'ambiguous', 'block'].indexOf(r.verdict) >= 0, 'bad verdict ' + r.verdict);
  });
  return 'rows 694, network_calls 0';
});

// RH3: group totals from the fixture README.
arm('RH3 group totals: extended 535, must_refuse 10', function () {
  need(replay, 'no replay');
  const ext = replay.rows.filter(function (r) { return r.group === 'extended'; }).length;
  const mr = replay.rows.filter(function (r) { return r.group === 'must_refuse'; }).length;
  need(ext === 535, 'extended ' + ext);
  need(mr === 10, 'must_refuse ' + mr);
  return 'extended 535, must_refuse 10';
});

// RH4: buildMatrix is counts only.
let matrix = null;
arm('RH4 buildMatrix returns the named count sections only', function () {
  need(replay, 'no replay');
  matrix = harness.buildMatrix(replay.rows);
  MATRIX_SECTIONS.forEach(function (s) { need(s in matrix, 'matrix misses ' + s); });
  need(matrix.total === 694, 'total ' + matrix.total);
  const bv = matrix.by_verdict;
  need(bv.allow + bv.ambiguous + bv.block === 694, 'by_verdict does not sum to 694');
  need(matrix.by_group.extended && matrix.by_group.must_refuse, 'by_group misses extended or must_refuse');
  const extTotal = matrix.by_group.extended.allow + matrix.by_group.extended.ambiguous + matrix.by_group.extended.block;
  need(extTotal === 535, 'extended total ' + extTotal);
  need(matrix.extended_blocked === matrix.by_group.extended.block, 'extended_blocked disagrees with by_group');
  need(matrix.must_refuse_blocked === matrix.by_group.must_refuse.block, 'must_refuse_blocked disagrees with by_group');
  need(typeof matrix.by_tool.brain_ask === 'object', 'by_tool misses brain_ask');
  const keys = walkKeys(matrix, []);
  keys.forEach(function (k) {
    need(FORBIDDEN_KEYS.indexOf(String(k).toLowerCase()) < 0, 'forbidden key ' + k);
  });
  const strings = JSON.stringify(matrix).match(/"[^"]{41,}"/g) || [];
  need(strings.length === 0, 'a string longer than 40 characters is in the matrix');
  return 'extended_blocked ' + matrix.extended_blocked + ', must_refuse_blocked ' + matrix.must_refuse_blocked;
});

// RH5: hygiene refusals.
arm('RH5 assertMatrixHygiene refuses long strings, forbidden keys, credential shapes', function () {
  need(matrix, 'no matrix');
  harness.assertMatrixHygiene(matrix);
  throwsWith(function () {
    harness.assertMatrixHygiene({ total: 1, note: 'x'.repeat(41) });
  }, 'longer than 40');
  throwsWith(function () {
    harness.assertMatrixHygiene({ total: 1, by_tool: { brain_ask: { question: 1 } } });
  }, 'forbidden key');
  // A key-shaped string, built at run time from parts; never stored whole.
  const shaped = ['sk', '-', 'ABCDEFGHIJKLMNOPQRSTUVWX'].join('');
  throwsWith(function () {
    harness.assertMatrixHygiene({ total: 1, by_class: { a: shaped } });
  }, 'credential shape');
  return '3 refusals, 1 acceptance';
});

// RH6: the committed beta.81 matrix (task 3): hygiene, network 0, group totals.
arm('RH6 committed baseline-beta81.json: hygiene, network 0, group totals', function () {
  need(fs.existsSync(BASELINE), 'missing ' + path.relative(ROOT, BASELINE));
  const doc = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  need(doc.schema === 1, 'schema ' + doc.schema);
  need(doc.guard_head === '8455416a5', 'guard_head ' + doc.guard_head + ', want 8455416a5 (v2.0.0-beta.81)');
  need(doc.network_calls === 0, 'network_calls ' + doc.network_calls);
  need(!('rows' in doc), 'rows must not be committed');
  need(doc.matrix && typeof doc.matrix === 'object', 'matrix missing');
  harness.assertMatrixHygiene(doc.matrix);
  harness.assertDocumentHygiene(doc);
  const g = doc.matrix.by_group;
  const ext = g.extended.allow + g.extended.ambiguous + g.extended.block;
  const mr = g.must_refuse.allow + g.must_refuse.ambiguous + g.must_refuse.block;
  need(ext === 535, 'extended total ' + ext);
  need(mr === 10, 'must_refuse total ' + mr);
  need(doc.matrix.extended_blocked === g.extended.block, 'extended_blocked disagrees with by_group');
  need(doc.matrix.must_refuse_blocked === g.must_refuse.block, 'must_refuse_blocked disagrees with by_group');
  need(doc.sources && doc.sources.fixtures && doc.sources.fixtures.cases === 694, 'sources.fixtures.cases is not 694');
  const text = fs.readFileSync(BASELINE, 'utf8');
  const dashes = [String.fromCharCode(0x2013), String.fromCharCode(0x2014)];
  need(dashes.every(function (d) { return text.indexOf(d) < 0; }), 'a dash character is in the fixture');
  return 'guard_head ' + doc.guard_head + ', extended_blocked ' + doc.matrix.extended_blocked + ', must_refuse_blocked ' + doc.matrix.must_refuse_blocked;
});

// RH7 (plan 392-09, task 3): every refusal matrix in the fixture folder passes
// the hygiene assertions, not only the baseline. A matrix file is a JSON
// document with schema 1 and a `matrix` key; route-matrix.json (plan 392-06,
// a different schema) is skipped by that test. At least two matrices must be
// found (the baseline and matrix-after-arm.json), so a renamed or deleted
// after-arm file fails here.
arm('RH7 every refusal matrix in the folder: hygiene, network 0, no rows, group totals', function () {
  const dir = path.dirname(BASELINE);
  const files = fs.readdirSync(dir).filter(function (f) { return /\.json$/.test(f); }).sort();
  const seen = [];
  files.forEach(function (f) {
    const doc = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (!(doc && doc.schema === 1 && doc.matrix && typeof doc.matrix === 'object')) return;
    harness.assertMatrixHygiene(doc.matrix);
    harness.assertDocumentHygiene(doc);
    need(doc.network_calls === 0, f + ': network_calls ' + doc.network_calls);
    need(!('rows' in doc), f + ': rows must not be committed');
    const g = doc.matrix.by_group;
    const ext = g.extended.allow + g.extended.ambiguous + g.extended.block;
    const mr = g.must_refuse.allow + g.must_refuse.ambiguous + g.must_refuse.block;
    need(ext === 535, f + ': extended total ' + ext);
    need(mr === 10, f + ': must_refuse total ' + mr);
    need(doc.matrix.must_refuse_blocked === 10, f + ': must_refuse_blocked ' + doc.matrix.must_refuse_blocked);
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    const dashes = [String.fromCharCode(0x2013), String.fromCharCode(0x2014)];
    need(dashes.every(function (d) { return text.indexOf(d) < 0; }), f + ': a dash character is in the fixture');
    seen.push(f + ' (extended_blocked ' + doc.matrix.extended_blocked + ')');
  });
  need(seen.length >= 2, 'expected the baseline and the after-arm matrix, found ' + seen.length);
  need(seen.some(function (s) { return s.indexOf('matrix-after-arm.json') === 0; }), 'matrix-after-arm.json missing');
  return seen.join(', ');
});

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
if (failed > 0) {
  console.log('test-392-replay-harness: ' + failed + ' arm(s) failed');
  process.exit(1);
}
console.log('test-392-replay-harness: all arms passed');

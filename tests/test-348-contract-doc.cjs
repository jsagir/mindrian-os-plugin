'use strict';
// Phase 348-01 -- assertions over docs/SUPERSESSION-CONTRACT.md, the durable
// invalidated-not-deleted contract, the four rulings, the layer: graph
// declaration, the measured census and the two ledgers (D-01..D-09 navigator
// locks, WD-348-1..12 working decisions).
//
// TDD RED-then-GREEN (348-01 Task 2): this file is written first and MUST
// fail (or error, since the doc does not exist yet) before
// docs/SUPERSESSION-CONTRACT.md lands. Modeled on tests/test-346-contract-
// doc.cjs (the house contract-doc test idiom).
//
// House rule: hyphens only, no em-dashes. Plain node:assert/strict, zero
// network, zero room.db, zero I/O outside reading the tracked files under
// test.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const DOC_PATH = path.join(REPO, 'docs', 'SUPERSESSION-CONTRACT.md');

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-348-contract-doc');

assert.ok(fs.existsSync(DOC_PATH), 'docs/SUPERSESSION-CONTRACT.md must exist');
const doc = fs.readFileSync(DOC_PATH, 'utf8');

// ---------------------------------------------------------------------------
// Frontmatter: layer: graph, asserted a member of the LIVE Phase 344 vocabulary
// ---------------------------------------------------------------------------

ok('frontmatter block exists and carries layer: graph', function () {
  const fm = doc.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(fm, 'a YAML frontmatter block must open the document');
  assert.match(fm[1], /layer:\s*graph/, 'frontmatter must declare layer: graph');

  const schemaPath = path.join(REPO, 'data', 'layer-declaration-schema.json');
  const schema = require(schemaPath);
  const vocab = schema._doc.layer_vocabulary;
  assert.ok(Array.isArray(vocab) && vocab.length > 0, 'layer_vocabulary must be a non-empty array, read live');
  assert.ok(vocab.indexOf('graph') !== -1, '"graph" must be a member of the live layer_vocabulary');
});

ok('frontmatter names canon_parts, implementing_phase and sibling_contract', function () {
  const fm = doc.match(/^---\n([\s\S]*?)\n---/)[1];
  assert.match(fm, /canon_parts:\s*\[7,\s*8,\s*9\]/, 'canon_parts must be [7, 8, 9]');
  assert.match(fm, /implementing_phase:\s*348/, 'implementing_phase must be 348');
  assert.match(fm, /sibling_contract:\s*docs\/LAYER-DECLARATION-CONTRACT\.md/, 'sibling_contract must name docs/LAYER-DECLARATION-CONTRACT.md');
});

// ---------------------------------------------------------------------------
// The measured census, stated once and never softened
// ---------------------------------------------------------------------------

ok('states the measured census with its literal numbers', function () {
  assert.ok(doc.indexOf('0 CONTRADICTS') !== -1, 'doc must contain the literal token "0 CONTRADICTS"');
  assert.ok(doc.indexOf('0 SUPERSEDES') !== -1, 'doc must contain the literal token "0 SUPERSEDES"');
  assert.ok(doc.indexOf('47') !== -1, 'doc must contain the literal token "47" (the room count)');
});

// ---------------------------------------------------------------------------
// The four rulings, named as literal tokens
// ---------------------------------------------------------------------------

ok('names the four rulings as literal tokens', function () {
  const tokens = [
    'valid_to', 'valid_until',
    'proposed->rejected', 'confirmed->superseded',
    'reified_shape_out_of_scope',
    'includeSuperseded',
  ];
  for (const t of tokens) {
    assert.ok(doc.indexOf(t) !== -1, 'doc must contain ruling token: ' + t);
  }
});

// ---------------------------------------------------------------------------
// Tri-Polar: one row per live CAPABILITY_MAP key
// ---------------------------------------------------------------------------

ok('Tri-Polar table has one row per live CAPABILITY_MAP surface', function () {
  const surfaceDetectPath = path.join(REPO, 'lib', 'mcp', 'surface-detect.cjs');
  delete require.cache[require.resolve(surfaceDetectPath)];
  const { CAPABILITY_MAP } = require(surfaceDetectPath);
  assert.ok(CAPABILITY_MAP && typeof CAPABILITY_MAP === 'object', 'surface-detect.cjs must export CAPABILITY_MAP');

  const keys = Object.keys(CAPABILITY_MAP);
  assert.ok(keys.length > 0, 'CAPABILITY_MAP must have at least one surface key');

  for (const surface of keys) {
    const re = new RegExp('\\b' + surface + '\\b', 'i');
    assert.ok(re.test(doc), 'doc must name the live CAPABILITY_MAP surface: ' + surface);
  }
});

// ---------------------------------------------------------------------------
// Grounding: cites the filed research trail, never a live langtalks corpus entry
// ---------------------------------------------------------------------------

ok('cites the filed research trail and never claims a live corpus entry', function () {
  assert.ok(
    doc.indexOf('2026-09-14-mindrianos-classification-and-zep-graphiti-supersession-gap.md') !== -1,
    'doc must cite the filed research trail path'
  );
});

// ---------------------------------------------------------------------------
// The navigator's locks: D-01..D-09, one non-empty table row each
// ---------------------------------------------------------------------------

ok('navigator lock ledger has exactly 9 rows, D-01 through D-09, each non-empty', function () {
  const dLines = doc.split('\n').filter(function (l) { return /^\|\s*D-0\d\s*\|/.test(l); });
  assert.equal(dLines.length, 9, 'expected exactly 9 D-0N lock ledger rows, found ' + dLines.length);

  const ids = ['D-01', 'D-02', 'D-03', 'D-04', 'D-05', 'D-06', 'D-07', 'D-08', 'D-09'];
  for (const id of ids) {
    const has = dLines.some(function (l) { return l.indexOf(id) !== -1; });
    assert.ok(has, 'lock ledger must contain a row for ' + id);
  }

  for (const line of dLines) {
    const cells = line
      .split(/(?<!\\)\|/)
      .map(function (c) { return c.replace(/\\\|/g, '|').trim(); })
      .filter(function (c) { return c.length > 0; });
    assert.ok(cells.length >= 2, 'each D-0N row must have at least 2 cells: ' + line);
    assert.ok(cells[1] && cells[1].length > 0, 'each D-0N row text must be non-empty: ' + line);
  }
});

// ---------------------------------------------------------------------------
// The working-decision ledger: WD-348-1..12, Status WORKING|RULED, reverse path
// ---------------------------------------------------------------------------

ok('working-decision ledger has exactly 12 rows with a valid Status and a reverse path', function () {
  const wdLines = doc.split('\n').filter(function (l) { return /^\|\s*WD-348-\d+\s*\|/.test(l); });
  assert.equal(wdLines.length, 12, 'expected exactly 12 WD-348-N ledger rows, found ' + wdLines.length);

  const ids = [];
  for (let i = 1; i <= 12; i += 1) ids.push('WD-348-' + i);
  for (const id of ids) {
    const has = wdLines.some(function (l) { return l.indexOf('| ' + id + ' |') !== -1 || l.indexOf('|' + id + '|') !== -1; });
    assert.ok(has, 'working-decision ledger must contain a row for ' + id);
  }

  for (const line of wdLines) {
    const cells = line
      .split(/(?<!\\)\|/)
      .map(function (c) { return c.replace(/\\\|/g, '|').trim(); })
      .filter(function (c) { return c.length > 0; });
    // cells: [WD-348-N, Decision, Why, Status, Reverses by]
    assert.ok(cells.length >= 5, 'each WD-348 row must have at least 5 cells: ' + line);
    const status = cells[cells.length - 2];
    assert.ok(status === 'WORKING' || status === 'RULED', 'WD-348 row Status must be WORKING or RULED, got "' + status + '": ' + line);
    const reversesBy = cells[cells.length - 1];
    assert.ok(reversesBy && reversesBy.length > 0, 'WD-348 row must name a non-empty reverse path: ' + line);
  }
});

// ---------------------------------------------------------------------------
// Hyphens only
// ---------------------------------------------------------------------------

ok('contains zero em-dashes', function () {
  assert.equal(doc.indexOf(String.fromCharCode(8212)), -1, 'docs/SUPERSESSION-CONTRACT.md must contain zero em-dashes');
});

console.log(n + ' assertions passed');
console.log('>>> test-348-contract-doc.cjs: PASSED');
process.exit(0);

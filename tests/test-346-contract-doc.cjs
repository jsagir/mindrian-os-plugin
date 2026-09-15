'use strict';
// Phase 346-01 -- assertions over docs/ARBITRATION-CONTRACT.md, the durable
// naming fence, the three-axis contract, the Tri-Polar statement, the
// layer: graph declaration and the thirteen-row working-decision ledger.
//
// TDD RED-then-GREEN (346-01 Task 2): this file is written first and MUST
// fail (or error, since the doc does not exist yet) before
// docs/ARBITRATION-CONTRACT.md lands.
//
// House rule: hyphens only, no em-dashes. Plain node:assert/strict, zero
// network, zero I/O outside reading the two tracked files under test.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const DOC_PATH = path.join(REPO, 'docs', 'ARBITRATION-CONTRACT.md');

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-346-contract-doc');

assert.ok(fs.existsSync(DOC_PATH), 'docs/ARBITRATION-CONTRACT.md must exist');
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
  assert.match(fm, /canon_parts:\s*\[7,\s*8,\s*11,\s*12\]/, 'canon_parts must be [7, 8, 11, 12]');
  assert.match(fm, /implementing_phase:\s*346/, 'implementing_phase must be 346');
  assert.match(fm, /sibling_contract:\s*docs\/LAYER-DECLARATION-CONTRACT\.md/, 'sibling_contract must name docs/LAYER-DECLARATION-CONTRACT.md');
});

// ---------------------------------------------------------------------------
// The naming fence: all three prior bindings, and the prose/code ruling
// ---------------------------------------------------------------------------

ok('names all three prior posture bindings verbatim', function () {
  assert.match(doc, /POSTURE_IDS/, 'must name sensor-types.POSTURE_IDS');
  assert.match(doc, /postureForCommand/, 'must name recipe-maps.postureForCommand');
  assert.match(doc, /STANCES/, 'must name stance-state.STANCES');
});

ok('states the prose-may / code-may-not ruling', function () {
  assert.match(doc, /prose may still say/, 'must contain the fragment "prose may still say"');
  assert.match(doc, /code may not/, 'must contain the fragment "code may not"');
});

// ---------------------------------------------------------------------------
// The three axes and their closed vocabularies
// ---------------------------------------------------------------------------

ok('names the three axes with their closed vocabularies', function () {
  const tokens = [
    'ask_and_hedged', 'tell_and_hedged',
    'GUIDED', 'HYBRID', 'AUTONOMOUS',
    'enforce', 'judge', 'not-applicable',
  ];
  for (const t of tokens) {
    assert.ok(doc.indexOf(t) !== -1, 'doc must contain axis vocabulary token: ' + t);
  }
});

// ---------------------------------------------------------------------------
// Tri-Polar: one row per CAPABILITY_MAP key, sourced from the module live
// ---------------------------------------------------------------------------

ok('Tri-Polar table has one row per live CAPABILITY_MAP surface, not-applicable where hooks is false', function () {
  const surfaceDetectPath = path.join(REPO, 'lib', 'mcp', 'surface-detect.cjs');
  delete require.cache[require.resolve(surfaceDetectPath)];
  const { CAPABILITY_MAP } = require(surfaceDetectPath);
  assert.ok(CAPABILITY_MAP && typeof CAPABILITY_MAP === 'object', 'surface-detect.cjs must export CAPABILITY_MAP');

  const keys = Object.keys(CAPABILITY_MAP);
  assert.ok(keys.length > 0, 'CAPABILITY_MAP must have at least one surface key');

  for (const surface of keys) {
    // Every surface name from the live map must appear in the document at least once.
    const re = new RegExp('\\b' + surface + '\\b', 'i');
    assert.ok(re.test(doc), 'doc must name the live CAPABILITY_MAP surface: ' + surface);
  }

  // Every surface whose hooks flag is false must be paired with not-applicable
  // somewhere in the same neighborhood (line containing the surface name).
  const lines = doc.split('\n');
  for (const surface of keys) {
    if (CAPABILITY_MAP[surface].hooks === false) {
      const hasRow = lines.some(function (line) {
        return new RegExp('\\b' + surface + '\\b', 'i').test(line) && /not-applicable/.test(line);
      });
      assert.ok(hasRow, 'a hookless surface (' + surface + ') must have a row stating not-applicable');
    }
  }
});

// ---------------------------------------------------------------------------
// The working-decision ledger: 13 rows, Status WORKING|RULED, each names a reverse
// ---------------------------------------------------------------------------

ok('working-decision ledger has exactly 13 rows with a valid Status and a reverse path', function () {
  const wdLines = doc.split('\n').filter(function (l) { return /^\|\s*WD-\d+\s*\|/.test(l); });
  assert.equal(wdLines.length, 13, 'expected exactly 13 WD-N ledger rows, found ' + wdLines.length);

  for (const line of wdLines) {
    // Split on unescaped pipes only: a markdown cell may contain a literal
    // backtick-escaped `\|` (e.g. a grep alternation pattern) that must NOT
    // count as a column boundary.
    const cells = line
      .split(/(?<!\\)\|/)
      .map(function (c) { return c.replace(/\\\|/g, '|').trim(); })
      .filter(function (c) { return c.length > 0; });
    // cells: [WD-N, Decision, Why, Source, Status, Reverses by]
    assert.ok(cells.length >= 6, 'each WD row must have at least 6 cells: ' + line);
    const status = cells[4];
    assert.ok(status === 'WORKING' || status === 'RULED', 'WD row Status must be WORKING or RULED, got "' + status + '": ' + line);
    const reversesBy = cells[5];
    assert.ok(reversesBy && reversesBy.length > 0, 'WD row must name a non-empty reverse path: ' + line);
  }
});

// ---------------------------------------------------------------------------
// Hyphens only
// ---------------------------------------------------------------------------

ok('contains zero em-dashes', function () {
  assert.equal(doc.indexOf('\u2014'), -1, 'docs/ARBITRATION-CONTRACT.md must contain zero em-dashes');
});

console.log(n + ' assertions passed');
console.log('>>> test-346-contract-doc.cjs: PASSED');
process.exit(0);

'use strict';
// Phase 349-01 -- assertions over docs/THEO-NOTIFY-CONTRACT.md, the durable
// leading-edge contract: the two halves of place 8, the insertion point and
// the placeholder-version trap, the registryHash ruling with its live
// evidence, the dry-run write-versus-read distinction, the fail-closed
// classes, the untracked-log ruling, the measured emission census, the
// layer declaration, the Tri-Polar statement and the WD-349 working-decision
// ledger.
//
// TDD RED-then-GREEN (349-01 Task 2): this file is written first and MUST
// fail (or error, since the doc does not exist yet) before
// docs/THEO-NOTIFY-CONTRACT.md lands. Modeled on tests/test-348-contract-
// doc.cjs (the house contract-doc test idiom).
//
// House rule: hyphens only, no em-dashes. Plain node:assert/strict, zero
// network, zero room.db, zero I/O outside reading the tracked files under
// test.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const DOC_PATH = path.join(REPO, 'docs', 'THEO-NOTIFY-CONTRACT.md');

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-349-contract-doc');

assert.ok(fs.existsSync(DOC_PATH), 'docs/THEO-NOTIFY-CONTRACT.md must exist');
const doc = fs.readFileSync(DOC_PATH, 'utf8');

// ---------------------------------------------------------------------------
// Frontmatter: layer: harness, asserted a member of the LIVE Phase 344 vocab
// ---------------------------------------------------------------------------

ok('frontmatter block exists and carries layer: harness', function () {
  const fm = doc.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(fm, 'a YAML frontmatter block must open the document');
  assert.match(fm[1], /layer:\s*harness/, 'frontmatter must declare layer: harness');

  const schemaPath = path.join(REPO, 'data', 'layer-declaration-schema.json');
  const schema = require(schemaPath);
  const vocab = schema._doc.layer_vocabulary;
  assert.ok(Array.isArray(vocab) && vocab.length > 0, 'layer_vocabulary must be a non-empty array, read live');
  assert.ok(vocab.indexOf('harness') !== -1, '"harness" must be a member of the live layer_vocabulary');
});

ok('frontmatter names canon_parts, implementing_phase and sibling_contract', function () {
  const fm = doc.match(/^---\n([\s\S]*?)\n---/)[1];
  assert.match(fm, /canon_parts:\s*\[7,\s*8\]/, 'canon_parts must be [7, 8]');
  assert.match(fm, /implementing_phase:\s*349/, 'implementing_phase must be 349');
  assert.match(fm, /sibling_contract:\s*docs\/RELEASE-CEREMONY-RULING-SYSTEM\.md/, 'sibling_contract must name docs/RELEASE-CEREMONY-RULING-SYSTEM.md');
});

// ---------------------------------------------------------------------------
// The R1..R5 scope table: one row per roadmap deliverable, owning plan named
// ---------------------------------------------------------------------------

ok('scope table has exactly 5 rows, R1 through R5, each with an owning plan', function () {
  const rLines = doc.split('\n').filter(function (l) { return /^\|\s*R[1-5]\s*\|/.test(l); });
  assert.equal(rLines.length, 5, 'expected exactly 5 R1..R5 scope table rows, found ' + rLines.length);

  const ids = ['R1', 'R2', 'R3', 'R4', 'R5'];
  for (const id of ids) {
    const has = rLines.some(function (l) { return new RegExp('^\\|\\s*' + id + '\\s*\\|').test(l); });
    assert.ok(has, 'scope table must contain a row for ' + id);
  }

  for (const line of rLines) {
    const cells = line
      .split(/(?<!\\)\|/)
      .map(function (c) { return c.replace(/\\\|/g, '|').trim(); })
      .filter(function (c) { return c.length > 0; });
    assert.ok(cells.length >= 3, 'each R row must have at least 3 cells (id, text, owning plan): ' + line);
    assert.ok(cells[1] && cells[1].length > 0, 'each R row text must be non-empty: ' + line);
    assert.ok(cells[cells.length - 1] && cells[cells.length - 1].length > 0, 'each R row must name an owning plan: ' + line);
  }
});

ok('R5 is RULED at the 349-03 checkpoint with a named disposition and owner', function () {
  // Updated 349-03: the navigator ruled R5 at the blocking checkpoint (disposition
  // (ii), out of scope, registered as a card, owner 349-06). UNRESOLVED was the
  // honest pre-ratification state (349-01/349-02); asserting it after the ruling
  // would falsely claim the disposition is still open. This assertion moves to
  // proving the RULED state instead, per 349-03's own acceptance criteria that
  // this test still exits 0 after the contract's ratification edits.
  const r5Line = doc.split('\n').find(function (l) { return /^\|\s*R5\s*\|/.test(l); });
  assert.ok(r5Line, 'R5 row must exist');
  assert.ok(r5Line.indexOf('RULED') !== -1, 'R5 row must contain the literal token RULED');
  assert.ok(r5Line.indexOf('349-03') !== -1, 'R5 row must point at the 349-03 checkpoint');
  assert.ok(r5Line.indexOf('349-06') !== -1, 'R5 row must name 349-06 as the owner of the registered card');
  assert.ok(r5Line.indexOf('UNRESOLVED') === -1, 'R5 row must no longer contain UNRESOLVED once ruled');
});

// ---------------------------------------------------------------------------
// The WD-349 working-decision ledger: 11 rows, Status WORKING|RULED, reverse path
// ---------------------------------------------------------------------------

ok('working-decision ledger has exactly 11 rows with a valid Status and a reverse path', function () {
  const wdLines = doc.split('\n').filter(function (l) { return /^\|\s*WD-349-\d+\s*\|/.test(l); });
  assert.equal(wdLines.length, 11, 'expected exactly 11 WD-349-N ledger rows, found ' + wdLines.length);

  const ids = [];
  for (let i = 1; i <= 11; i += 1) ids.push('WD-349-' + i);
  for (const id of ids) {
    const has = wdLines.some(function (l) { return new RegExp('^\\|\\s*' + id + '\\s*\\|').test(l); });
    assert.ok(has, 'working-decision ledger must contain a row for ' + id);
  }

  for (const line of wdLines) {
    const cells = line
      .split(/(?<!\\)\|/)
      .map(function (c) { return c.replace(/\\\|/g, '|').trim(); })
      .filter(function (c) { return c.length > 0; });
    // cells: [WD-349-N, Decision, Why, Status, Reverses by]
    assert.ok(cells.length >= 5, 'each WD-349 row must have at least 5 cells: ' + line);
    const status = cells[cells.length - 2];
    assert.ok(status === 'WORKING' || status === 'RULED', 'WD-349 row Status must be WORKING or RULED, got "' + status + '": ' + line);
    const reversesBy = cells[cells.length - 1];
    assert.ok(reversesBy && reversesBy.length > 0, 'WD-349 row must name a non-empty reverse path: ' + line);
  }
});

// ---------------------------------------------------------------------------
// The literal ruling tokens the executor must never soften
// ---------------------------------------------------------------------------

ok('names every load-bearing ruling token literally', function () {
  const tokens = [
    'Step 5.6', '--no-theo-notify', '--no-theo-check', 'NEW_VERSION', 'NEXT_VERSION',
    'registryHash', 'theo-resync', 'SEND FAILURE', 'MINDRIAN_THEO_NOTIFY_CMD',
    'theo-notify-log.txt',
  ];
  for (const t of tokens) {
    assert.ok(doc.indexOf(t) !== -1, 'doc must contain ruling token: ' + t);
  }
});

// ---------------------------------------------------------------------------
// The measured emission census, stated once and never softened
// ---------------------------------------------------------------------------

ok('states the measured census with its literal numbers beside the contradiction', function () {
  assert.ok(doc.indexOf('0 call sites') !== -1, 'doc must contain the literal token "0 call sites"');
  assert.ok(doc.indexOf('payloads_emitted_since') !== -1, 'doc must contain the literal token "payloads_emitted_since"');
  assert.ok(doc.indexOf('payloads_applied_since') !== -1, 'doc must contain the literal token "payloads_applied_since"');
});

// ---------------------------------------------------------------------------
// Precedent citation: theo-stamp-gate.sh, at least twice
// ---------------------------------------------------------------------------

ok('cites theo-stamp-gate.sh at least twice', function () {
  const matches = doc.match(/theo-stamp-gate/g) || [];
  assert.ok(matches.length >= 2, 'doc must cite theo-stamp-gate at least twice, found ' + matches.length);
});

// ---------------------------------------------------------------------------
// The Canon Part 8 boundary: closed four-key payload set on one line
// ---------------------------------------------------------------------------

ok('contains the literal token "Part 8" and states the closed four-key payload set', function () {
  assert.ok(doc.indexOf('Part 8') !== -1, 'doc must contain the literal token "Part 8"');
  const closedSetLine = doc.split('\n').find(function (l) {
    return l.indexOf('version') !== -1 && l.indexOf('commit') !== -1 &&
      l.indexOf('registryHash') !== -1 && l.indexOf('command_registry_path') !== -1;
  });
  assert.ok(closedSetLine, 'doc must state the closed four-key payload set on one line');
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
// No live cross-session push mechanism exists, stated plainly
// ---------------------------------------------------------------------------

ok('states plainly that no live cross-session push mechanism exists', function () {
  assert.ok(
    doc.indexOf('already-running Claude Code session') !== -1,
    'doc must state, on a distinctive token, that no mechanism can push into a different, already-running Claude Code session'
  );
});

// ---------------------------------------------------------------------------
// Hyphens only
// ---------------------------------------------------------------------------

ok('contains zero em-dashes', function () {
  assert.equal(doc.indexOf(String.fromCharCode(8212)), -1, 'docs/THEO-NOTIFY-CONTRACT.md must contain zero em-dashes');
});

console.log(n + ' assertions passed');
console.log('>>> test-349-contract-doc.cjs: PASSED');
process.exit(0);

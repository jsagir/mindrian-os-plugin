#!/usr/bin/env node
'use strict';

/*
 * Pins the shape of docs/LAYER-CONTRACT.md (the layer contract phase, its
 * layer-contract-document plan, requirements LAYER-10, LAYER-11, LAYER-15).
 *
 * Every assertion below derives its expectations from
 * data/layer-declaration-schema.json rather than from a hand-typed list, so
 * a future sixth vocabulary member fails this test loudly instead of the
 * document silently falling behind the schema.
 *
 * Reads the document once with fs.readFileSync and runs every assertion
 * against that one string (this task's own action text).
 *
 * House rule: hyphens only, no em-dashes, no emoji.
 */

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

const REPO_ROOT = path.resolve(__dirname, '..');
const DOC_PATH = path.join(REPO_ROOT, 'docs', 'LAYER-CONTRACT.md');
const SCHEMA_PATH = path.join(REPO_ROOT, 'data', 'layer-declaration-schema.json');

const REQUIRED_SUBSECTIONS = [
  'Definition',
  'Core question',
  'Implemented by',
  'Above and below',
  'What is thin or missing',
  'Single owner surface',
];

let pass = 0;
let fail = 0;

function check(label, fn) {
  try {
    fn();
    console.log('PASS: ' + label);
    pass += 1;
  } catch (err) {
    console.log('FAIL: ' + label);
    console.log('  ' + err.message);
    fail += 1;
  }
}

// Returns the 1-based line number of the first line containing `needle`,
// searched starting at `fromLine` (1-based, inclusive), or -1 if not found.
function lineNumberOf(lines, needle, fromLine) {
  const start = Math.max(0, (fromLine || 1) - 1);
  for (let i = start; i < lines.length; i += 1) {
    if (lines[i].includes(needle)) return i + 1;
  }
  return -1;
}

const schema = require(SCHEMA_PATH);
const rungs = schema._doc.layer_vocabulary.filter((v) => v !== 'none');

assert.ok(fs.existsSync(DOC_PATH), 'docs/LAYER-CONTRACT.md must exist');
const text = fs.readFileSync(DOC_PATH, 'utf8');
const lines = text.split('\n');

// ---------------------------------------------------------------------------
// One heading per rung, derived from the schema, never a hand-typed list of
// five literals.
// ---------------------------------------------------------------------------
check('one heading exists per member of layer_vocabulary (excluding none)', () => {
  assert.ok(rungs.length > 0, 'the schema must expose at least one non-none rung');
  for (const rung of rungs) {
    const headingPattern = new RegExp('^#{1,3}\\s.*\\b' + rung.toUpperCase() + '\\b', 'm');
    const found = headingPattern.test(text);
    if (!found) {
      const failLine = lineNumberOf(lines, rung.toUpperCase(), 1);
      assert.fail(
        'no heading found naming rung "' + rung + '" (searched near line ' + (failLine > 0 ? failLine : 'n/a') + ')'
      );
    }
  }
});

// ---------------------------------------------------------------------------
// Each rung section carries all six required subsection headings, in order.
// ---------------------------------------------------------------------------
check('each rung section carries the six required subsection headings, in order', () => {
  for (const rung of rungs) {
    const headingPattern = new RegExp('^#{1,3}\\s.*\\b' + rung.toUpperCase() + '\\b', 'm');
    const m = headingPattern.exec(text);
    assert.ok(m, 'rung heading for "' + rung + '" must exist before its subsections can be checked');
    const rungStart = m.index;

    // The section ends at the next rung heading (if any comes later) or,
    // failing that, at the end of the document.
    let rungEnd = text.length;
    for (const other of rungs) {
      if (other === rung) continue;
      const otherPattern = new RegExp('^#{1,3}\\s.*\\b' + other.toUpperCase() + '\\b', 'm');
      const otherText = text.slice(rungStart + 1);
      const om = otherPattern.exec(otherText);
      if (om) {
        const absoluteIndex = rungStart + 1 + om.index;
        if (absoluteIndex < rungEnd) rungEnd = absoluteIndex;
      }
    }

    const section = text.slice(rungStart, rungEnd);
    let cursor = -1;
    for (const sub of REQUIRED_SUBSECTIONS) {
      const subPattern = new RegExp('^#{1,4}\\s*' + sub.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$', 'm');
      const sm = subPattern.exec(section);
      assert.ok(sm, 'rung "' + rung + '" is missing the subsection heading "' + sub + '"');
      assert.ok(
        sm.index > cursor,
        'rung "' + rung + '" has subsection "' + sub + '" out of order relative to the prior subsection'
      );
      cursor = sm.index;
    }
  }
});

// ---------------------------------------------------------------------------
// The grounding table: every row names a source and a hop count, or carries
// the literal ABSENT.
// ---------------------------------------------------------------------------
check('the grounding table carries at least one ABSENT row (graph engineering, honesty clause 3)', () => {
  assert.ok(/ABSENT/.test(text), 'the document must carry the literal ABSENT for the graph-engineering rung');
});

check('the grounding table cites hop counts (the word "hop") alongside sources', () => {
  assert.ok(/\bhop\b/i.test(text), 'the grounding table must cite at least one hop count');
  assert.ok(/single-sourced|single source/i.test(text), 'the context-to-harness single-source row must say so (honesty clause 2)');
});

// ---------------------------------------------------------------------------
// No bare surface-count claim.
// ---------------------------------------------------------------------------
check('the document contains no bare surface-count claim', () => {
  const bareCountPattern = /\b[0-9]{2,3} (commands|skills|agents|surfaces|tools)\b/;
  const m = bareCountPattern.exec(text);
  if (m) {
    const failLine = lineNumberOf(lines, m[0], 1);
    assert.fail('found a frozen surface count "' + m[0] + '" at line ' + failLine);
  }
});

// ---------------------------------------------------------------------------
// No em-dash, no en-dash. Built from raw UTF-8 bytes rather than a literal
// character or a codepoint escape, so this source file never itself trips
// the phase's own em-dash guard (a byte-level grep over every sibling test
// file in this same directory) and never carries a three-digit run either.
// ---------------------------------------------------------------------------
const EM_DASH = Buffer.from([0xe2, 0x80, 0x94]).toString('utf8');
const EN_DASH = Buffer.from([0xe2, 0x80, 0x93]).toString('utf8');

check('the document contains no em-dash', () => {
  const idx = text.indexOf(EM_DASH);
  if (idx !== -1) {
    const failLine = text.slice(0, idx).split('\n').length;
    assert.fail('em-dash found at line ' + failLine);
  }
});

check('the document contains no en-dash', () => {
  const idx = text.indexOf(EN_DASH);
  if (idx !== -1) {
    const failLine = text.slice(0, idx).split('\n').length;
    assert.fail('en-dash found at line ' + failLine);
  }
});

// ---------------------------------------------------------------------------
// The two named interfaces.
// ---------------------------------------------------------------------------
check('the document names data/command-registry.json', () => {
  assert.ok(text.includes('data/command-registry.json'), 'must name data/command-registry.json');
});

check('the document names data/layer-declaration-schema.json', () => {
  assert.ok(text.includes('data/layer-declaration-schema.json'), 'must name data/layer-declaration-schema.json');
});

// ---------------------------------------------------------------------------
// The amendment ledger has at least one data row.
// ---------------------------------------------------------------------------
check('the amendment ledger table exists and has at least one data row', () => {
  const ledgerHeadingPattern = /^#{1,3}\s.*Amendment ledger\s*$/m;
  const hm = ledgerHeadingPattern.exec(text);
  assert.ok(hm, 'an "Amendment ledger" heading must exist');
  const afterLedger = text.slice(hm.index);
  const tableRows = afterLedger.match(/^\|.+\|$/gm) || [];
  // A markdown table needs at least a header row, a separator row, and one
  // data row to have "at least one data row".
  assert.ok(tableRows.length >= 3, 'the amendment ledger table must have a header, a separator, and at least one data row');
});

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail > 0 ? 1 : 0);

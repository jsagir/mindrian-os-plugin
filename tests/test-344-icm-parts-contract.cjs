#!/usr/bin/env node
'use strict';

/*
 * Bidirectional drift test between docs/ICM-NESTED-PART-CONTRACT.md and its
 * declaration file, data/icm-parts.json (the layer contract phase, its ICM
 * nested-part contract plan, requirement LAYER-12).
 *
 * Every expectation below is derived from data/icm-parts.json at require
 * time. This test carries no part list of its own and no numeric literal
 * beyond the six cross-cutting gap count, which is a document-structure
 * fact this document commits to (six headings, always), not a measured
 * quantity that could drift the way a part count could.
 *
 * Both directions are checked: the declaration file finds a document row
 * missing (a part declared but not written up), and the document finds a
 * row the declaration file does not know about (a part invented in prose
 * that data/icm-parts.json never declared). Mirrors the
 * derive-expectations-from-data discipline of
 * tests/test-344-layer-contract-doc.cjs.
 *
 * House rule: hyphens only, no em-dashes, no emoji.
 */

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

const REPO_ROOT = path.resolve(__dirname, '..');
const DOC_PATH = path.join(REPO_ROOT, 'docs', 'ICM-NESTED-PART-CONTRACT.md');
const ICM_PARTS_PATH = path.join(REPO_ROOT, 'data', 'icm-parts.json');

const REQUIRED_HEADINGS = ['Reads', 'Does', 'Writes', 'Human check', 'Change-impact'];
const REQUIRED_LABELS = ['IS today', 'NEEDS TO BE', 'Gap'];
const CROSS_CUTTING_GAP_COUNT = 6; // a document-structure fact, not a measured quantity

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

assert.ok(fs.existsSync(ICM_PARTS_PATH), 'data/icm-parts.json must exist');
const icmParts = require(ICM_PARTS_PATH);
assert.ok(Array.isArray(icmParts.parts), 'data/icm-parts.json must expose a parts[] array');
const declaredIds = icmParts.parts.map((p) => p.id);

assert.ok(fs.existsSync(DOC_PATH), 'docs/ICM-NESTED-PART-CONTRACT.md must exist');
const text = fs.readFileSync(DOC_PATH, 'utf8');

// Part subsections are marked "### Part: <id>", a distinct heading form from
// every other heading in the document (numbered gap entries, the "Parts
// this contract does not carry" section, etc.), so this parse cannot
// accidentally pick up an unrelated heading.
const PART_HEADING_RE = /^### Part: (.+)$/gm;

function findDocumentPartHeadings(source) {
  const found = [];
  let m;
  const re = new RegExp(PART_HEADING_RE.source, 'gm');
  while ((m = re.exec(source)) !== null) {
    found.push({ id: m[1].trim(), index: m.index });
  }
  return found;
}

function subsectionBody(source, headings, i) {
  const start = headings[i].index;
  const end = i + 1 < headings.length ? headings[i + 1].index : source.length;
  return source.slice(start, end);
}

// ---------------------------------------------------------------------------
// Direction 1: every declared id has a document subsection.
// ---------------------------------------------------------------------------
check('every parts[].id in data/icm-parts.json has a subsection in the document', () => {
  const docHeadings = findDocumentPartHeadings(text);
  const docIds = new Set(docHeadings.map((h) => h.id));
  const missing = declaredIds.filter((id) => !docIds.has(id));
  assert.strictEqual(
    missing.length,
    0,
    'declared id(s) with no document subsection: ' + missing.join(', ')
  );
});

// ---------------------------------------------------------------------------
// Direction 2: every document part subsection heading corresponds to a
// declared id, so the document cannot grow a part the data does not declare.
// ---------------------------------------------------------------------------
check('every document part subsection heading corresponds to a declared parts[].id', () => {
  const docHeadings = findDocumentPartHeadings(text);
  const declaredSet = new Set(declaredIds);
  const undeclared = docHeadings.map((h) => h.id).filter((id) => !declaredSet.has(id));
  assert.strictEqual(
    undeclared.length,
    0,
    'document subsection id(s) not declared in data/icm-parts.json: ' + undeclared.join(', ')
  );
});

// ---------------------------------------------------------------------------
// Every part subsection carries the five contract headings and the three
// IS today / NEEDS TO BE / Gap labels.
// ---------------------------------------------------------------------------
check('every part subsection contains the five contract headings and the three IS/NEEDS/Gap labels', () => {
  const docHeadings = findDocumentPartHeadings(text);
  const problems = [];
  for (let i = 0; i < docHeadings.length; i += 1) {
    const body = subsectionBody(text, docHeadings, i);
    for (const h of REQUIRED_HEADINGS) {
      if (!body.includes(h)) problems.push(docHeadings[i].id + ' missing heading "' + h + '"');
    }
    for (const l of REQUIRED_LABELS) {
      if (!body.includes(l)) problems.push(docHeadings[i].id + ' missing label "' + l + '"');
    }
  }
  assert.strictEqual(problems.length, 0, problems.join('; '));
});

// ---------------------------------------------------------------------------
// Six numbered cross-cutting gap entries.
// ---------------------------------------------------------------------------
check('the document contains six numbered cross-cutting gap entries', () => {
  const gapEntryRe = /^[1-6]\. \*\*/gm;
  const matches = text.match(gapEntryRe) || [];
  assert.strictEqual(
    matches.length,
    CROSS_CUTTING_GAP_COUNT,
    'expected ' + CROSS_CUTTING_GAP_COUNT + ' numbered cross-cutting gap entries, found ' + matches.length
  );
});

// ---------------------------------------------------------------------------
// No em-dash, no en-dash. Built from raw UTF-8 bytes, matching the sibling
// test-344-layer-contract-doc.cjs discipline, so this source file never
// itself trips the phase's own em-dash guard.
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
// No bare part, section, room, or command count.
// ---------------------------------------------------------------------------
check('the document contains no bare part, section, room, or command count', () => {
  const bareCountPattern = /\b[0-9]{2,3} (parts|sections|rooms|commands)\b/;
  const m = bareCountPattern.exec(text);
  if (m) {
    const failLine = text.slice(0, m.index).split('\n').length;
    assert.fail('found a frozen count "' + m[0] + '" at line ' + failLine);
  }
});

// ---------------------------------------------------------------------------
// The two named interfaces.
// ---------------------------------------------------------------------------
check('the document names data/icm-parts.json', () => {
  assert.ok(text.includes('data/icm-parts.json'), 'must name data/icm-parts.json');
});

check('the document names lib/core/doctor/icm-part-wiring-module.cjs', () => {
  assert.ok(
    text.includes('lib/core/doctor/icm-part-wiring-module.cjs'),
    'must name lib/core/doctor/icm-part-wiring-module.cjs'
  );
});

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail > 0 ? 1 : 0);

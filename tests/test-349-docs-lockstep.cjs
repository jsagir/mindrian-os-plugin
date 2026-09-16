'use strict';
// Phase 349-05 -- assertions over the three documentation edits this plan
// lands: docs/RELEASE-CEREMONY-RULING-SYSTEM.md RULE 5 place 8 (amended in
// place, still exactly eight numbered places), .claude/includes/release-
// process.md (names the step, carries no lockstep count of its own), and
// the reconciliation of the VERSION-BUMP-CHECKLIST.md contradiction (WD-14
// stands, cited by id).
//
// TDD RED-then-GREEN (349-05 Task 1): this file is written first and MUST
// fail against the current, unamended docs before the edits land. Modeled
// on tests/test-349-contract-doc.cjs (the house doc-assertion idiom).
//
// House rule: hyphens only, no em-dashes. Plain node:assert/strict, zero
// network, zero room.db, zero I/O outside reading the tracked files under
// test.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const RULE_DOC_PATH = path.join(REPO, 'docs', 'RELEASE-CEREMONY-RULING-SYSTEM.md');
const INCLUDE_PATH = path.join(REPO, '.claude', 'includes', 'release-process.md');
const CONTRACT_PATH = path.join(REPO, 'docs', 'THEO-NOTIFY-CONTRACT.md');

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-349-docs-lockstep');

assert.ok(fs.existsSync(RULE_DOC_PATH), 'docs/RELEASE-CEREMONY-RULING-SYSTEM.md must exist');
assert.ok(fs.existsSync(INCLUDE_PATH), '.claude/includes/release-process.md must exist');
assert.ok(fs.existsSync(CONTRACT_PATH), 'docs/THEO-NOTIFY-CONTRACT.md must exist');

const ruleDoc = fs.readFileSync(RULE_DOC_PATH, 'utf8');
const include = fs.readFileSync(INCLUDE_PATH, 'utf8');
const contract = fs.readFileSync(CONTRACT_PATH, 'utf8');

const EM_DASH = String.fromCharCode(8212);

// ---------------------------------------------------------------------------
// Slice RULE 5's own region: from "## RULE 5" up to (not including) "## RULE 6"
// ---------------------------------------------------------------------------

function sliceRule5(doc) {
  const start = doc.indexOf('## RULE 5');
  assert.notEqual(start, -1, '## RULE 5 heading must exist');
  const end = doc.indexOf('## RULE 6', start);
  assert.notEqual(end, -1, '## RULE 6 heading must exist (as the slice boundary)');
  return doc.slice(start, end);
}

const rule5Slice = sliceRule5(ruleDoc);

ok('RULE 5 still has exactly eight numbered places', function () {
  const lines = rule5Slice.split('\n');
  const numbered = lines.filter(function (l) { return /^[0-9]+\. /.test(l); });
  assert.equal(numbered.length, 8, 'RULE 5 region must contain exactly 8 lines matching ^[0-9]+\\. , got ' + numbered.length);

  const numbers = numbered.map(function (l) { return parseInt(l.match(/^([0-9]+)\. /)[1], 10); });
  const highest = Math.max.apply(null, numbers);
  assert.equal(highest, 8, 'the highest numbered place must be 8, got ' + highest);

  const hasNine = lines.some(function (l) { return /^9\. /.test(l); });
  assert.equal(hasNine, false, 'no line in RULE 5 may start with "9. "');
});

// ---------------------------------------------------------------------------
// Extract item 8's own text: from the "8. " line to the next blank line or
// the next numbered item, whichever comes first, so a token appearing
// elsewhere in the file does not satisfy the assertion.
// ---------------------------------------------------------------------------

function extractItem8(slice) {
  const lines = slice.split('\n');
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^8\. /.test(lines[i])) { startIdx = i; break; }
  }
  assert.notEqual(startIdx, -1, 'a line starting "8. " must exist in RULE 5');
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i].trim() === '' || /^[0-9]+\. /.test(lines[i]) || /^\*\*[0-9]+[a-z]\s/.test(lines[i]) || /^### /.test(lines[i])) {
      endIdx = i;
      break;
    }
  }
  return lines.slice(startIdx, endIdx).join('\n');
}

const item8 = extractItem8(rule5Slice);

ok('place 8 names both halves: step numbers, library files, flags, event', function () {
  const required = [
    'Step 0.6',
    'Step 5.6',
    'theo-stamp-gate.sh',
    'theo-notify-gate.sh',
    '--no-theo-check',
    '--no-theo-notify',
    'theo-resync',
  ];
  required.forEach(function (token) {
    assert.ok(item8.indexOf(token) !== -1, 'item 8 must contain "' + token + '", extracted text was:\n' + item8);
  });
});

ok('the lagging half\'s existing facts survive inside item 8 (extended, not replaced)', function () {
  assert.ok(item8.indexOf('mappedBy') !== -1, 'item 8 must still contain "mappedBy"');
  assert.match(item8, /fails? closed/, 'item 8 must still state the lagging gate fails closed');
});

// ---------------------------------------------------------------------------
// The include: names the step, points at RULE 5, carries no count of its own
// ---------------------------------------------------------------------------

ok('the include names theo-resync and Step 5.6', function () {
  assert.ok(include.indexOf('theo-resync') !== -1, 'the include must contain "theo-resync"');
  assert.ok(include.indexOf('Step 5.6') !== -1, 'the include must contain "Step 5.6"');
});

ok('the include points at RULE 5 as the single home', function () {
  assert.ok(include.indexOf('RULE 5') !== -1, 'the include must contain the literal "RULE 5"');
});

ok('the include carries no second lockstep count of its own', function () {
  // A counting construction states a TOTAL, e.g. "eight places" or "8
  // places" (plural). Naming a specific item, e.g. "RULE 5 place 8"
  // (singular, number AFTER the word), is not a count and must not trip
  // this guard -- the plan explicitly instructs pointing at "RULE 5 place
  // 8" by name.
  const countingRe = /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|[0-9]+)\s+places\b/i;
  const lines = include.split('\n');
  const offender = lines.find(function (l) { return countingRe.test(l); });
  assert.equal(offender, undefined, 'the include must not assert a total count of lockstep places; offending line: ' + offender);
});

ok('the include\'s own five-point Version Consistency list is undisturbed', function () {
  const numbered = include.split('\n').filter(function (l) { return /^[0-9]\. /.test(l); });
  assert.equal(numbered.length, 5, 'the include must still have exactly 5 numbered items in its own Version Consistency Rule list, got ' + numbered.length);
});

// ---------------------------------------------------------------------------
// The reconciliation: VERSION-BUMP-CHECKLIST.md and WD-14 co-occur, cited
// ---------------------------------------------------------------------------

ok('the VERSION-BUMP-CHECKLIST.md / WD-14 reconciliation is cited in a tracked file', function () {
  const candidates = [
    { label: 'docs/RELEASE-CEREMONY-RULING-SYSTEM.md', text: ruleDoc },
    { label: 'docs/THEO-NOTIFY-CONTRACT.md', text: contract },
  ];
  const hit = candidates.find(function (c) {
    return c.text.indexOf('VERSION-BUMP-CHECKLIST') !== -1 && c.text.indexOf('WD-14') !== -1;
  });
  assert.ok(hit, 'at least one of docs/RELEASE-CEREMONY-RULING-SYSTEM.md or docs/THEO-NOTIFY-CONTRACT.md must contain both "VERSION-BUMP-CHECKLIST" and "WD-14"');
  console.log('  reconciliation satisfied by: ' + (hit && hit.label));
});

ok('docs/VERSION-BUMP-CHECKLIST.md is NOT created (WD-14 stands)', function () {
  const checklistPath = path.join(REPO, 'docs', 'VERSION-BUMP-CHECKLIST.md');
  assert.equal(fs.existsSync(checklistPath), false, 'docs/VERSION-BUMP-CHECKLIST.md must not exist per the ratified WD-14 reconciliation');
});

// ---------------------------------------------------------------------------
// No em-dash in any file this plan writes
// ---------------------------------------------------------------------------

ok('zero em-dashes in docs/RELEASE-CEREMONY-RULING-SYSTEM.md', function () {
  assert.equal(ruleDoc.indexOf(EM_DASH), -1, 'no em-dash allowed in docs/RELEASE-CEREMONY-RULING-SYSTEM.md');
});

ok('zero em-dashes in .claude/includes/release-process.md', function () {
  assert.equal(include.indexOf(EM_DASH), -1, 'no em-dash allowed in .claude/includes/release-process.md');
});

ok('zero em-dashes in this test file itself', function () {
  const self = fs.readFileSync(__filename, 'utf8');
  assert.equal(self.indexOf(EM_DASH), -1, 'no em-dash allowed in tests/test-349-docs-lockstep.cjs');
});

console.log(n + ' checks passed.');

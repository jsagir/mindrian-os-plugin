'use strict';
// Phase 195-03 Task 1 -- .umbilical v2 inheritance-map parser (FCM-03).
//
// Asserts parseUmbilicalInheritance:
//   (A) a v2 marker with an `inherits:` block parses to the DECLARED map.
//   (B) a v1 marker (no `inherits:` block) defaults every kind to 'local'
//       (byte-compatible; no migration; no silent propagation).
//   (C) a garbled `inherits:` block degrades to all-local WITHOUT throwing.
//   (D) an inline `inherits: garbage` (non-block form) never opens the block.
//   (E) a missing marker file returns all-local, never throws.
//
// NO em-dashes anywhere (CLAUDE.md HARD RULE).

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const { parseUmbilicalInheritance } =
  require(path.join(REPO_ROOT, 'lib', 'core', 'resolve-umbilical-target.cjs'));

let checks = 0;
let passed = 0;
function check(label, cond, detail) {
  checks++;
  if (cond) { passed++; process.stdout.write('  PASS: ' + label + '\n'); }
  else { process.stdout.write('  FAIL: ' + label + (detail ? ' -- ' + detail : '') + '\n'); }
}

function isAllLocal(m) {
  return m && m.USER === 'local' && m.BRAIN === 'local' && m.STATE === 'local' &&
    m.MINTO === 'local' && m.FEYNMAN === 'local';
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-umbilical-v2-'));

process.stdout.write('\n[test-195-umbilical-v2] FCM-03 inheritance-map parser\n\n');

try {
  // --- (A) v2 marker parses to the declared map ---
  process.stdout.write('Section A: v2 marker parses to declared map\n');
  const v2Path = path.join(tmp, 'v2.umbilical');
  fs.writeFileSync(v2Path,
    'room: acme-parent\n' +
    'relation: subroom\n' +
    'born: 2026-07-01T00:00:00Z\n' +
    'inherits:\n' +
    '  USER: parent\n' +
    '  BRAIN: parent\n' +
    '  STATE: local\n' +
    '  MINTO: local\n' +
    '  FEYNMAN: local\n', 'utf8');
  const mA = parseUmbilicalInheritance(v2Path);
  check('USER declared parent', mA.USER === 'parent', JSON.stringify(mA));
  check('BRAIN declared parent', mA.BRAIN === 'parent');
  check('STATE stays local', mA.STATE === 'local');
  check('MINTO stays local', mA.MINTO === 'local');
  check('FEYNMAN stays local', mA.FEYNMAN === 'local');

  // --- (B) v1 marker (no inherits block) -> all-local ---
  process.stdout.write('\nSection B: v1 marker defaults all-local\n');
  const v1Path = path.join(tmp, 'v1.umbilical');
  fs.writeFileSync(v1Path,
    'room: legacy-room\n' +
    'relation: code\n' +
    'born: 2026-06-01T00:00:00Z\n', 'utf8');
  const mB = parseUmbilicalInheritance(v1Path);
  check('v1 marker parses all-local (byte-compatible, no migration)', isAllLocal(mB), JSON.stringify(mB));

  // --- (C) garbled inherits block -> all-local, no throw ---
  process.stdout.write('\nSection C: garbled block degrades to all-local\n');
  const garblePath = path.join(tmp, 'garble.umbilical');
  fs.writeFileSync(garblePath,
    'room: x\n' +
    'inherits:\n' +
    '  !!! not a valid line\n' +
    '  USER = parent\n' +   // wrong separator; not KEY: value
    '  UNKNOWN: parent\n' + // unknown kind ignored
    '  BRAIN: sideways\n',  // non-parent value degrades to local
    'utf8');
  let threw = false;
  let mC;
  try { mC = parseUmbilicalInheritance(garblePath); } catch (_e) { threw = true; }
  check('garbled block never throws', !threw);
  check('garbled block -> all-local', isAllLocal(mC), JSON.stringify(mC));

  // --- (D) inline non-block inherits never opens the block ---
  process.stdout.write('\nSection D: inline inherits: value stays all-local\n');
  const inlinePath = path.join(tmp, 'inline.umbilical');
  fs.writeFileSync(inlinePath, 'room: y\ninherits: parent\n  USER: parent\n', 'utf8');
  const mD = parseUmbilicalInheritance(inlinePath);
  check('inline `inherits: parent` does not open the block (all-local)', isAllLocal(mD), JSON.stringify(mD));

  // --- (E) missing file -> all-local, no throw ---
  process.stdout.write('\nSection E: missing marker file\n');
  let threwE = false;
  let mE;
  try { mE = parseUmbilicalInheritance(path.join(tmp, 'does-not-exist.umbilical')); }
  catch (_e) { threwE = true; }
  check('missing marker never throws', !threwE);
  check('missing marker -> all-local', isAllLocal(mE), JSON.stringify(mE));

  // --- (F) block terminated by a non-indented line ---
  process.stdout.write('\nSection F: block ends at a non-indented line\n');
  const termPath = path.join(tmp, 'term.umbilical');
  fs.writeFileSync(termPath,
    'inherits:\n' +
    '  USER: parent\n' +
    'note: this line ends the block\n' +
    '  BRAIN: parent\n',  // AFTER the terminator -> must NOT be read
    'utf8');
  const mF = parseUmbilicalInheritance(termPath);
  check('USER before terminator is read (parent)', mF.USER === 'parent', JSON.stringify(mF));
  check('BRAIN after terminator is NOT read (local)', mF.BRAIN === 'local');
} finally {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
}

process.stdout.write('\n[test-195-umbilical-v2] ' + passed + '/' + checks + ' PASS\n');
process.exit(passed === checks ? 0 : 1);

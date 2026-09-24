'use strict';
// Phase 359-01 -- test-359-fork-declaration.cjs: the N-3 fork declaration
// grammar and its pure parser (FORK359-03, SPEC R3, D-02, D-04, amended by
// navigator ruling N-3).
//
// Covers: valid 2/3-practical + moonshot lines, every named invalid shape,
// no-throw on hostile input, zero network, the ASCII-box regex byte-identity
// tripwire, the exactly-one-voice-mark tripwire, the fail-inert leg (stubbed
// voice-color-mark), formatDeclaration round-tripping, and the additive
// normalizeOptionLabel export on lib/core/gate-relevance.cjs (byte-equivalent
// to extractOptionLabels' own inline normalization, every pre-existing export
// otherwise untouched).
//
// Test hygiene: TYPESAFE_API_KEY stripped; globalThis.fetch replaced with a
// counting thrower for the whole run (module-load and parse time); no
// network egress anywhere in this file or the module under test.
//
// No em-dashes anywhere (hyphens only, CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

delete process.env.TYPESAFE_API_KEY;

let networkAttempts = 0;
globalThis.fetch = function () {
  networkAttempts += 1;
  throw new Error('NETWORK_ATTEMPT_359');
};

const REPO = path.join(__dirname, '..');
const MODULE_PATH = path.join(REPO, 'lib', 'core', 'fork-declaration.cjs');
const MODULE_SOURCE = fs.readFileSync(MODULE_PATH, 'utf8');

// PLAN_BASE: the commit HEAD was at when this plan started (recorded before
// any Task 1 or Task 2 edit). Used to prove gate-relevance.cjs's pre-existing
// exports are byte-identical to their PLAN_BASE function source text.
const PLAN_BASE = '2797903a005b7e0500b74c0af70ea86f6f7958fc';

console.log('test-359-fork-declaration');

let failures = 0;
let total = 0;
function ok(desc, fn) {
  total += 1;
  try {
    fn();
    console.log('  ok   ' + desc);
  } catch (e) {
    failures += 1;
    console.log('  FAIL ' + desc + ' -- ' + (e && e.message ? e.message : String(e)));
  }
}

const forkDecl = require(MODULE_PATH);
const gateRelevance = require(path.join(REPO, 'lib', 'core', 'gate-relevance.cjs'));
const voiceColorMark = require(path.join(REPO, 'lib', 'hmi', 'voice-color-mark.cjs'));
const checkCardFireSource = fs.readFileSync(path.join(REPO, 'scripts', 'check-card-fire.cjs'), 'utf8');

// ---------------------------------------------------------------------
// Reconstruct the two ASCII-box regexes from the check-card-fire source
// text itself (never hand-copied), matching the plan's own instruction.
// ---------------------------------------------------------------------
function extractRegexLiteral(source, constName) {
  const re = new RegExp(constName + '\\s*=\\s*\\n?\\s*(/(?:\\\\.|[^/\\n\\\\])+/[a-z]*)');
  const m = source.match(re);
  assert.ok(m, 'could not find ' + constName + ' literal in check-card-fire.cjs source');
  // eslint-disable-next-line no-eval
  return eval(m[1]);
}

const ASCII_BOX_GLYPH_RE = extractRegexLiteral(checkCardFireSource, 'ASCII_BOX_GLYPH_RE');
const ASCII_BOX_UNCONDITIONAL_RE = extractRegexLiteral(checkCardFireSource, 'ASCII_BOX_UNCONDITIONAL_RE');

// ---------------------------------------------------------------------
// Fixture lines
// ---------------------------------------------------------------------
const VALID_2PRACTICAL =
  'Your call: Run the research first | Build the plan now | What if we asked the users to design it';
const VALID_3PRACTICAL =
  'Your call: Run the research first | Build the plan now | File the evidence first | What if we shipped nothing and just watched';
const VALID_HEBREW =
  'Your call: לבנות את זה קודם | להריץ מייד | What if we launched it in Hebrew first';

const VALID_FIXTURES = [VALID_2PRACTICAL, VALID_3PRACTICAL, VALID_HEBREW];

function eighty(ch) { return ch.repeat(80); }
function eightyOne(ch) { return ch.repeat(81); }

// ===========================================================================
// Valid shapes
// ===========================================================================

ok('V1: 2-practical + moonshot line is declared, labels/practical/moonshot correct', function () {
  const r = forkDecl.parseForkDeclaration(VALID_2PRACTICAL);
  assert.equal(r.declared, true);
  assert.deepEqual(r.labels, ['Run the research first', 'Build the plan now', 'What if we asked the users to design it']);
  assert.deepEqual(r.practical, ['Run the research first', 'Build the plan now']);
  assert.equal(r.moonshot, 'What if we asked the users to design it');
});

ok('V2: 3-practical + moonshot line is declared', function () {
  const r = forkDecl.parseForkDeclaration(VALID_3PRACTICAL);
  assert.equal(r.declared, true);
  assert.equal(r.labels.length, 4);
  assert.equal(r.practical.length, 3);
  assert.equal(r.moonshot, 'File the evidence first'.length > 0 ? r.moonshot : r.moonshot); // sanity no-op
  assert.ok(r.moonshot.startsWith('What if'));
});

ok('V3: Hebrew practical labels with an English What-if moonshot is declared', function () {
  const r = forkDecl.parseForkDeclaration(VALID_HEBREW);
  assert.equal(r.declared, true);
  assert.equal(r.practical.length, 2);
  assert.ok(r.moonshot.startsWith('What if'));
});

ok('V4: trailing spaces after the line are tolerated', function () {
  const r = forkDecl.parseForkDeclaration(VALID_2PRACTICAL + '   ');
  assert.equal(r.declared, true);
});

ok('V5: trailing blank lines after the line are tolerated', function () {
  const r = forkDecl.parseForkDeclaration(VALID_2PRACTICAL + '\n\n\n');
  assert.equal(r.declared, true);
});

ok('V6: CRLF line ending is tolerated', function () {
  const r = forkDecl.parseForkDeclaration('some prose\r\n' + VALID_2PRACTICAL + '\r\n');
  assert.equal(r.declared, true);
});

ok('V7: an 80-code-point Hebrew label is accepted', function () {
  const label80 = eighty('א');
  const line = 'Your call: ' + label80 + ' | Build the plan now | What if we tried something wild';
  const r = forkDecl.parseForkDeclaration(line);
  assert.equal(r.declared, true);
});

// ===========================================================================
// Not declared (invalid shapes)
// ===========================================================================

ok('N1: 2 labels with no moonshot is not declared', function () {
  assert.equal(forkDecl.parseForkDeclaration('Your call: A one | B two').declared, false);
});

ok('N2: 1 practical plus a moonshot (2 labels total) is not declared', function () {
  assert.equal(forkDecl.parseForkDeclaration('Your call: A one | What if B two').declared, false);
});

ok('N3: 5 labels is not declared', function () {
  assert.equal(forkDecl.parseForkDeclaration(
    'Your call: A one | B two | C three | D four | What if E five'
  ).declared, false);
});

ok('N4: last label not starting with What if is not declared', function () {
  assert.equal(forkDecl.parseForkDeclaration('Your call: A one | B two | C three').declared, false);
});

ok('N5: last label "what if x" (lowercase) is not declared', function () {
  assert.equal(forkDecl.parseForkDeclaration('Your call: A one | B two | what if x three').declared, false);
});

ok('N6: last label exactly "What if" with nothing after is not declared', function () {
  assert.equal(forkDecl.parseForkDeclaration('Your call: A one | B two | What if').declared, false);
});

ok('N7: a practical label starting with What if is not declared', function () {
  assert.equal(forkDecl.parseForkDeclaration('Your call: What if sneaky | B two | What if C three').declared, false);
});

ok('N8: an 81-code-point label is not declared', function () {
  const label81 = eightyOne('a');
  assert.equal(forkDecl.parseForkDeclaration('Your call: ' + label81 + ' | B two | What if C three').declared, false);
});

ok('N9: duplicate labels differing only by case is not declared', function () {
  assert.equal(forkDecl.parseForkDeclaration('Your call: Build The Plan | build the plan | What if C three').declared, false);
});

ok('N10: an empty label is not declared', function () {
  assert.equal(forkDecl.parseForkDeclaration('Your call: A one |  | What if C three').declared, false);
});

ok('N11: a label containing a bare pipe is not declared', function () {
  assert.equal(forkDecl.parseForkDeclaration('Your call: A | one|two | What if C three').declared, false);
});

ok('N12: a bracket anywhere on the line is not declared', function () {
  assert.equal(forkDecl.parseForkDeclaration('Your call: A one [x] | B two | What if C three').declared, false);
  assert.equal(forkDecl.parseForkDeclaration('Your call: A one | B two] | What if C three').declared, false);
});

ok('N13: any of the 5 MARK_GLYPHS on the line is not declared', function () {
  for (const glyph of Object.keys(voiceColorMark.MARK_GLYPHS)) {
    const line = 'Your call: A one ' + glyph + ' | B two | What if C three';
    assert.equal(forkDecl.parseForkDeclaration(line).declared, false, 'glyph ' + glyph + ' must reject');
  }
});

ok('N14: a line containing "type 1, 2, or 3" is not declared', function () {
  assert.equal(forkDecl.parseForkDeclaration('Your call: type 1, 2, or 3 | B two | What if C three').declared, false);
});

ok('N15: leading whitespace before the prefix is not declared', function () {
  assert.equal(forkDecl.parseForkDeclaration('  Your call: A one | B two | What if C three').declared, false);
});

ok('N16: markdown emphasis on the prefix is not declared', function () {
  assert.equal(forkDecl.parseForkDeclaration('**Your call:** A one | B two | What if C three').declared, false);
});

ok('N17: lowercase prefix "your call:" is not declared', function () {
  assert.equal(forkDecl.parseForkDeclaration('your call: A one | B two | What if C three').declared, false);
});

ok('N18: a valid line followed by one more non-empty line is not declared', function () {
  assert.equal(forkDecl.parseForkDeclaration(VALID_2PRACTICAL + '\none more line').declared, false);
});

ok('N19: the empty string is not declared, no throw', function () {
  assert.equal(forkDecl.parseForkDeclaration('').declared, false);
});

ok('N20: null/undefined/number/object/array input never throws and is not declared', function () {
  for (const v of [null, undefined, 42, {}, []]) {
    assert.doesNotThrow(function () { forkDecl.parseForkDeclaration(v); });
    assert.equal(forkDecl.parseForkDeclaration(v).declared, false);
  }
});

// ===========================================================================
// formatDeclaration + round trip
// ===========================================================================

ok('F1: formatDeclaration composes DECLARATION_PREFIX + labels.join(DECLARATION_SEPARATOR)', function () {
  const labels = ['A one', 'B two', 'What if C three'];
  assert.equal(forkDecl.formatDeclaration(labels), forkDecl.DECLARATION_PREFIX + labels.join(forkDecl.DECLARATION_SEPARATOR));
});

ok('F2: formatDeclaration returns "" for a non-array', function () {
  assert.equal(forkDecl.formatDeclaration(null), '');
  assert.equal(forkDecl.formatDeclaration('not an array'), '');
  assert.equal(forkDecl.formatDeclaration(undefined), '');
});

ok('F3: parseForkDeclaration(formatDeclaration(x)) round-trips every valid label set', function () {
  const labelSets = [
    ['Run the research first', 'Build the plan now', 'What if we asked the users to design it'],
    ['A one', 'B two', 'C three', 'What if D four'],
    ['לבנות את זה', 'להריץ מייד', 'What if we tried Hebrew'],
  ];
  for (const labels of labelSets) {
    const r = forkDecl.parseForkDeclaration(forkDecl.formatDeclaration(labels));
    assert.equal(r.declared, true, 'round trip failed for ' + JSON.stringify(labels));
    assert.deepEqual(r.labels, labels);
  }
});

// ===========================================================================
// Box-regex and voice-mark tripwires
// ===========================================================================

ok('B1: ASCII_BOX_UNCONDITIONAL_RE matches none of the valid fixtures', function () {
  for (const line of VALID_FIXTURES) {
    assert.equal(ASCII_BOX_UNCONDITIONAL_RE.test(line), false, 'must not match: ' + line);
  }
});

ok('B2: ASCII_BOX_GLYPH_RE matches none of the valid fixtures', function () {
  for (const line of VALID_FIXTURES) {
    assert.equal(ASCII_BOX_GLYPH_RE.test(line), false, 'must not match: ' + line);
  }
});

ok('M1: for each of the 5 glyphs, detectVoiceMark over "<glyph> body\\n<line>" reports exactly one mark', function () {
  for (const glyph of Object.keys(voiceColorMark.MARK_GLYPHS)) {
    for (const line of VALID_FIXTURES) {
      const text = glyph + ' body text\n' + line;
      const mark = voiceColorMark.detectVoiceMark(text);
      assert.equal(mark.count, 1, 'glyph ' + glyph + ' + fixture must report count 1, got ' + mark.count);
    }
  }
});

// ===========================================================================
// Fail inert: stubbed voice-color-mark
// ===========================================================================

ok('I1: with a stubbed voice-color-mark (no MARK_GLYPHS), a fresh load returns declared:false for a valid line', function () {
  const stubDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fork359-stub-'));
  const libCore = path.join(stubDir, 'lib', 'core');
  const libHmi = path.join(stubDir, 'lib', 'hmi');
  fs.mkdirSync(libCore, { recursive: true });
  fs.mkdirSync(libHmi, { recursive: true });
  fs.writeFileSync(path.join(libCore, 'fork-declaration.cjs'), MODULE_SOURCE);
  fs.writeFileSync(path.join(libHmi, 'voice-color-mark.cjs'), "'use strict';\nmodule.exports = {};\n");

  const res = execFileSync(process.execPath, ['-e',
    "const m = require(" + JSON.stringify(path.join(libCore, 'fork-declaration.cjs')) + ");" +
    "const r = m.parseForkDeclaration(" + JSON.stringify(VALID_2PRACTICAL) + ");" +
    "process.stdout.write(JSON.stringify(r));"
  ], { encoding: 'utf8' });
  const parsed = JSON.parse(res);
  assert.equal(parsed.declared, false, 'a stubbed voice-color-mark must fail inert (declared:false)');
});

// ===========================================================================
// Zero network / source-shape tripwires
// ===========================================================================

ok('Z1: parsing every fixture line never trips the fetch thrower', function () {
  const before = networkAttempts;
  for (const line of VALID_FIXTURES.concat([
    'Your call: A one | B two', '', 'not a declaration at all', null, undefined, 42,
  ])) {
    forkDecl.parseForkDeclaration(line);
  }
  assert.equal(networkAttempts, before, 'no fixture parse may trigger a network call');
});

ok('Z2: module source requires nothing but voice-color-mark.cjs', function () {
  const requireLines = MODULE_SOURCE.split('\n').filter(function (l) {
    return /require\(/.test(l) && !/^\s*\/\//.test(l);
  });
  assert.equal(requireLines.length, 1, 'expected exactly 1 require() line, got: ' + requireLines.join(' | '));
  assert.ok(requireLines[0].indexOf('voice-color-mark') !== -1, 'the one require must name voice-color-mark');
});

ok('Z3: module source contains no Date.now, new Date, fetch(, or fs require', function () {
  const banned = ['Date.now', 'new Date', 'fetch(', "require('fs')", "require('node:fs')", 'require("fs")', 'require("node:fs")'];
  const nonCommentSource = MODULE_SOURCE.split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n');
  for (const b of banned) {
    assert.equal(nonCommentSource.indexOf(b), -1, 'module source must not contain: ' + b);
  }
});

// ===========================================================================
// normalizeOptionLabel additive export
// ===========================================================================

ok('G1: normalizeOptionLabel matches extractOptionLabels\' own inline normalization', function () {
  const samples = ['Yes, ship it', 'No', 'Build the plan now'];
  for (const s of samples) {
    const viaExtract = gateRelevance.extractOptionLabels('[1] ' + s + '\n[2] something else')[0];
    const viaNormalize = gateRelevance.normalizeOptionLabel(s);
    assert.equal(viaNormalize, viaExtract, 'mismatch for sample: ' + s);
  }
  // The Hebrew sample normalizes to '' under the ASCII-only normalizer (a
  // known, documented consequence, Finding 2): extractOptionLabels itself
  // skips a '' norm entirely (its own `if (!norm ...) continue`), so a
  // single-Hebrew-option extraction returns no entry at all -- confirm both
  // sides agree on the '' normalization directly.
  assert.equal(gateRelevance.extractOptionLabels('[1] לבנות').length, 0);
  assert.equal(gateRelevance.normalizeOptionLabel('לבנות'), '');
});

ok('G2: every pre-existing gate-relevance export is present with unchanged function source', function () {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fork359-gate-relevance-planbase-'));
  const planBaseSource = execFileSync('git', ['show', PLAN_BASE + ':lib/core/gate-relevance.cjs'], { cwd: REPO, encoding: 'utf8' });
  const planBasePath = path.join(tmp, 'gate-relevance-planbase.cjs');
  fs.writeFileSync(planBasePath, planBaseSource);
  const planBaseModule = require(planBasePath);

  const preExistingKeys = Object.keys(planBaseModule);
  assert.ok(preExistingKeys.length > 0, 'PLAN_BASE gate-relevance.cjs must export at least one name');
  for (const key of preExistingKeys) {
    assert.ok(Object.prototype.hasOwnProperty.call(gateRelevance, key), 'export missing after edit: ' + key);
    const before = planBaseModule[key];
    const after = gateRelevance[key];
    if (typeof before === 'function') {
      assert.equal(typeof after, 'function', key + ' must still be a function');
      assert.equal(after.toString(), before.toString(), key + ' function source text changed');
    } else {
      assert.deepEqual(after, before, key + ' value changed');
    }
  }
  assert.ok(Object.prototype.hasOwnProperty.call(gateRelevance, 'normalizeOptionLabel'), 'normalizeOptionLabel must be exported');
  assert.equal(typeof gateRelevance.normalizeOptionLabel, 'function');
});

console.log('');
console.log('Passed: ' + (total - failures) + ' / ' + total);
if (failures > 0) {
  console.log('Failed: ' + failures);
  process.exit(1);
}
process.exit(0);

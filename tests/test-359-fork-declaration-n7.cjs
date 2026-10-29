'use strict';
// Quick 261028-v6m -- test-359-fork-declaration-n7.cjs: navigator ruling N-7
// of Phase 359. Cosmetic slips in the fork declaration are TOLERATED; the
// strict grammar of e74fcaa42 stays the reference for structural errors.
//
// Accepted (cosmetic):
//   1. lowercase `what if` as the final label prefix
//   2. markdown emphasis (`**`, `__`, `*`, `_`), one balanced pair, around the
//      `Your call:` prefix, around the WHOLE line, or (interpretation) around
//      the `What if` prefix
//   3. one trailing blank line, or one trailing sign-off line, after the
//      declaration line
// Still rejected (structural):
//   fewer than 3 or more than 4 labels in total, a missing moonshot label,
//   brackets, duplicates, a line that carries a voice glyph, a non-final
//   (capital) What-if, a declaration that is not on the last non-empty line
//   (after the one allowed sign-off), non-string input (never throws).
// Superset property: every line the strict N-3 parser accepted is accepted
// again with byte-identical labels (checked against a copy of the strict
// parser from commit e74fcaa42, read with git show when git is available).
//
// Test hygiene: TYPESAFE_API_KEY stripped; globalThis.fetch replaced with a
// counting thrower; the module under test is pure (no fs, no network, no clock).
//
// No em-dashes anywhere (hyphens only, CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const path = require('node:path');

delete process.env.TYPESAFE_API_KEY;

let networkAttempts = 0;
globalThis.fetch = function () {
  networkAttempts += 1;
  throw new Error('NETWORK_ATTEMPT_359_N7');
};

const REPO = path.join(__dirname, '..');
const forkDecl = require(path.join(REPO, 'lib', 'core', 'fork-declaration.cjs'));
const parse = forkDecl.parseForkDeclaration;

console.log('test-359-fork-declaration-n7');

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

const BASE = 'Your call: Build it | Research it | What if we prototype both';

// --- Accepted: cosmetic slips ------------------------------------------------
ok('A1: lowercase "what if" final label is declared', function () {
  const r = parse('Your call: Build it | Research it | what if we prototype both');
  assert.equal(r.declared, true);
  assert.deepEqual(r.practical, ['Build it', 'Research it']);
  assert.equal(r.moonshot, 'What if we prototype both');
  assert.equal(r.labels.length, 3);
});

ok('A2: bold around the Your call: prefix is declared', function () {
  const r = parse('**Your call:** Build it | Research it | What if we prototype both');
  assert.equal(r.declared, true);
  assert.deepEqual(r.practical, ['Build it', 'Research it']);
});

ok('A3: italic (asterisk) around the Your call: prefix is declared', function () {
  assert.equal(parse('*Your call:* Build it | Research it | What if we prototype both').declared, true);
});

ok('A4: italic (underscore) around the Your call: prefix is declared', function () {
  assert.equal(parse('_Your call:_ Build it | Research it | What if we prototype both').declared, true);
});

ok('A5: bold around the What if prefix is declared and the marks are removed', function () {
  const r = parse('Your call: Build it | Research it | **What if** we prototype both');
  assert.equal(r.declared, true);
  assert.equal(r.moonshot, 'What if we prototype both');
});

ok('A6: italic around a lowercase what if prefix is declared', function () {
  const r = parse('Your call: Build it | Research it | _what if_ we prototype both');
  assert.equal(r.declared, true);
  assert.equal(r.moonshot, 'What if we prototype both');
});

ok('A7: bold on the prefix AND bold on the What if prefix together', function () {
  assert.equal(parse('**Your call:** Build it | Research it | **What if** we prototype both').declared, true);
});

ok('A8: one trailing sign-off line after the declaration is declared', function () {
  const r = parse('Some prose first.\n' + BASE + '\nLet me know what you think, no rush on this.');
  assert.equal(r.declared, true);
  assert.equal(r.moonshot, 'What if we prototype both');
});

ok('A9: one blank line between the declaration and the sign-off is declared', function () {
  assert.equal(parse(BASE + '\n\nThanks!').declared, true);
});

ok('A10: one trailing blank line after the declaration is declared', function () {
  assert.equal(parse(BASE + '\n\n').declared, true);
});

ok('A11: 3 practical labels with a lowercase moonshot are declared', function () {
  const r = parse('Your call: A one | B two | C three | what if D four');
  assert.equal(r.declared, true);
  assert.equal(r.practical.length, 3);
});

ok('A12: CRLF endings with a sign-off are declared', function () {
  assert.equal(parse('Intro\r\n' + BASE + '\r\nSounds good?\r\n').declared, true);
});

ok('A13: bold around the WHOLE line is declared and the marks are removed', function () {
  const r = parse('**Your call: Build it | Research it | What if we prototype both**');
  assert.equal(r.declared, true);
  assert.deepEqual(r.labels, ['Build it', 'Research it', 'What if we prototype both']);
});

ok('A14: italic (asterisk, underscore) and __ bold around the WHOLE line are declared', function () {
  assert.equal(parse('*Your call: Build it | Research it | What if we prototype both*').declared, true);
  assert.equal(parse('_Your call: Build it | Research it | What if we prototype both_').declared, true);
  assert.equal(parse('__Your call: Build it | Research it | What if we prototype both__').declared, true);
});

ok('A15: whole-line emphasis plus lowercase what if plus a sign-off is declared', function () {
  const r = parse('Intro.\n**Your call: Build it | Research it | what if we prototype both**\nWhat do you think?');
  assert.equal(r.declared, true);
  assert.equal(r.moonshot, 'What if we prototype both');
});

ok('A16: a sign-off of exactly 120 code points is declared', function () {
  assert.equal(parse(BASE + '\n' + 'a'.repeat(120)).declared, true);
});

ok('A17: Hebrew labels with a lowercase-prefix moonshot and a Hebrew sign-off are declared', function () {
  const r = parse('Your call: לבנות | לחקור | what if נבנה את שניהם\nמה דעתך?');
  assert.equal(r.declared, true);
  assert.equal(r.moonshot, 'What if נבנה את שניהם');
});

// --- Rejected: structural errors stay rejected --------------------------------
ok('R1: one practical label is not declared (even with tolerance)', function () {
  assert.equal(parse('Your call: Build it | what if we prototype both').declared, false);
});

ok('R2: four practical labels are not declared', function () {
  assert.equal(parse('Your call: A one | B two | C three | D four | what if E five').declared, false);
});

ok('R3: no moonshot label is not declared', function () {
  assert.equal(parse('Your call: Build it | Research it | Wait and see').declared, false);
  assert.equal(parse('**Your call:** Build it | Research it | Wait and see').declared, false);
});

ok('R4: a line that carries a voice glyph is not declared', function () {
  assert.equal(parse('⬛ ' + BASE).declared, false);
  assert.equal(parse('**Your call:** Build it | Research it | what if we prototype both ⬛').declared, false);
});

ok('R5: a non-final capital What-if (practical label) is not declared', function () {
  assert.equal(parse('Your call: What if we wait | Research it | What if we prototype both').declared, false);
  assert.equal(parse('Your call: What if we wait | Research it | what if we prototype both').declared, false);
});

ok('R6: the declaration followed by TWO lines is not declared', function () {
  assert.equal(parse(BASE + '\nOne sign-off.\nTwo sign-offs.').declared, false);
});

ok('R7: the declaration followed by a long paragraph is not declared', function () {
  assert.equal(parse(BASE + '\n' + 'word '.repeat(60)).declared, false);
});

ok('R8: a sign-off line that carries a voice glyph is not declared', function () {
  assert.equal(parse(BASE + '\n⬛ Thanks!').declared, false);
});

ok('R9: a declaration buried above prose is not declared', function () {
  assert.equal(parse(BASE + '\nLine two.\nLine three.').declared, false);
});

ok('R10: the Your call: prefix in the middle of a line is not declared', function () {
  assert.equal(parse('Here: **Your call:** Build it | Research it | What if we prototype both').declared, false);
});

ok('R11: unbalanced emphasis marks on the prefix are not declared', function () {
  assert.equal(parse('**Your call: Build it | Research it | What if we prototype both').declared, false);
});

ok('R12: lowercase "your call:" prefix is still not declared', function () {
  assert.equal(parse('your call: Build it | Research it | What if we prototype both').declared, false);
});

ok('R13: brackets are still not declared', function () {
  assert.equal(parse('Your call: [A] | B two | what if C three').declared, false);
});

ok('R14: duplicate labels are still not declared', function () {
  assert.equal(parse('Your call: A one | a one | what if C three').declared, false);
});

ok('R15: a moonshot of the bare prefix with no body is not declared', function () {
  assert.equal(parse('Your call: A one | B two | **What if**').declared, false);
  assert.equal(parse('Your call: A one | B two | what if ').declared, false);
});

ok('R16: the strict Phase 359 reference line is unchanged', function () {
  const r = parse(BASE);
  assert.equal(r.declared, true);
  assert.deepEqual(r.labels, ['Build it', 'Research it', 'What if we prototype both']);
  assert.equal(forkDecl.formatDeclaration(r.labels), BASE);
});

ok('R17: a sign-off of 121 code points is not declared', function () {
  assert.equal(parse(BASE + '\n' + 'a'.repeat(121)).declared, false);
});

ok('R18: a sign-off line that carries a bracket is not declared', function () {
  assert.equal(parse(BASE + '\nSee [note].').declared, false);
});

ok('R19: unbalanced or mismatched whole-line emphasis is not declared', function () {
  assert.equal(parse('**Your call: Build it | Research it | What if we prototype both*').declared, false);
  assert.equal(parse('*Your call: Build it | Research it | What if we prototype both**').declared, false);
  assert.equal(parse('**Your call: Build it | Research it | What if we prototype both_').declared, false);
  assert.equal(parse('**Your call: Build it | Research it | What if we prototype both').declared, false);
});

ok('R20: whole-line emphasis does not rescue a structural error', function () {
  assert.equal(parse('**Your call: Build it | What if we prototype both**').declared, false);
  assert.equal(parse('**Your call: A one | B two | C three | D four | What if E five**').declared, false);
  assert.equal(parse('**Your call: A one | A one | What if E five**').declared, false);
  assert.equal(parse('**Your call: [A] | B two | What if E five**').declared, false);
});

ok('R21: a prose line that is not a declaration is not declared', function () {
  assert.equal(parse('Here is my take.\nSounds good?').declared, false);
  assert.equal(parse('Which one do you prefer, build it or research it?').declared, false);
});

ok('R22: emphasis inside a label body is left as written, not removed', function () {
  const r = parse('Your call: **Build** it | Research it | what if we prototype **both**');
  assert.equal(r.declared, true);
  assert.deepEqual(r.labels, ['**Build** it', 'Research it', 'What if we prototype **both**']);
});

// --- Never throws -----------------------------------------------------------
ok('T1: non-string input never throws and is not declared', function () {
  [null, undefined, 0, 1, {}, [], true, Symbol('x'), function () {}, ''].forEach(function (v) {
    assert.equal(parse(v).declared, false);
  });
});

ok('T2: hostile emphasis input never throws', function () {
  assert.equal(parse('*'.repeat(5000)).declared, false);
  assert.equal(parse('**Your call:**').declared, false);
  assert.equal(parse('Your call: ** | ** | **What if**').declared, false);
});

// --- Superset: a strict N-3 line keeps its exact result ------------------------
ok('S1: strict lines parse byte-identically (strict reference parser copy)', function () {
  const cp = require('node:child_process');
  let src = null;
  try {
    src = cp.execFileSync('git', ['show', 'e74fcaa42:lib/core/fork-declaration.cjs'],
      { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (_e) {
    src = null;
  }
  if (src === null) { console.log('       (git history unavailable, S1 compared against inline cases only)'); }
  let strict = null;
  if (src !== null) {
    const Module = require('node:module');
    const m = new Module(path.join(REPO, 'lib', 'core', 'fork-declaration-strict-ref.cjs'), module);
    m.filename = path.join(REPO, 'lib', 'core', 'fork-declaration-strict-ref.cjs');
    m.paths = Module._nodeModulePaths(path.dirname(m.filename));
    m._compile(src, m.filename);
    strict = m.exports.parseForkDeclaration;
  }
  const cases = [
    BASE,
    BASE + '\n',
    BASE + '  \r\n',
    'Prose.\n' + BASE,
    '\n\n' + BASE + '\n\n',
    'Your call: A one | B two | C three | What if D four',
    'Your call: A one | B two | What if D four',
    'Your call: what if we wait | B two | What if D four',
    'Your call: **What if** we wait | B two | What if D four',
    'Your call: A one | B two | What if   spaced   body  ',
    'Your call: לבנות | לחקור | What if נבנה',
    'Your call: ' + 'x'.repeat(80) + ' | B two | What if D four',
    'Your call: ' + 'x'.repeat(81) + ' | B two | What if D four',
    'Your call: A | B | What if',
    'Your call: A | B | What if x | y',
    'Your call:  A | B | What if x',
    ' Your call: A | B | What if x',
    'Your call: A one | A one | What if x',
    'Your call: A one [1] | B two | What if x',
    '⬛ Your call: A one | B two | What if x',
    'Your call: A one | B two | What if x ⬛',
    'Your call: Type 1, 2, or 3 | B two | What if x',
    'Your call: A\\|b | B two | What if x',
    'Your call: A one | B two | Whatif x',
    'Your call: A one | B two | What ifx',
  ];
  let compared = 0;
  for (const c of cases) {
    const now = parse(c);
    if (strict) {
      const was = strict(c);
      if (was.declared) {
        assert.deepEqual(now, was, 'strict-accepted line changed: ' + JSON.stringify(c));
      }
      compared += 1;
    } else if (c === BASE) {
      assert.equal(now.declared, true);
    }
  }
  if (strict) assert.equal(compared, cases.length);
});

ok('T3: zero network attempts', function () {
  assert.equal(networkAttempts, 0);
});

console.log('\n' + (total - failures) + '/' + total + ' passed');
if (failures > 0) {
  console.log('FAILED: ' + failures);
  process.exit(1);
}
console.log('PASSED');

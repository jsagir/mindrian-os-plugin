#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.6 Plan 03 Task 1 (NS369.6-05, NS369.6-20; D-05, D-15, D-44, R-02, R-08, R-09, R-24).
 * Every carrier of the Larry identity is checked against the one constant lib/hmi/larry-identity.cjs.
 *
 *   C0   the constant: shape, identityLine forms, GLYPHS equal to MARK_GLYPHS in order, PwS spelling
 *   C1   agents/larry-extended.md carries identityLine('cli')
 *   C2   skills/larry-personality/SKILL.md carries identityLine('cli')
 *   C3   scripts/session-start carries identityLine('cli')
 *   C4   references/personality/voice-dna.md carries identityLine('shared')
 *   C5   the served RUNTIME_INSTRUCTIONS string carries identityLine('mcp')
 *   C6   each sentence carrier writes the identity span with curly apostrophes (D-05)
 *   C7   CLI_ONLY_MARKERS appear on each cli text carrier and on no shared or mcp carrier (R-02)
 *   C8   lib/mcp/runtime-instructions.cjs requires the constant and holds no literal copy of the sentence
 *   C9   the loaded MCP personality (loadLarryContext) carries identityLine('shared')
 *   C10  the theo-faces identity span carries LABEL and TAGLINE (R-08)
 *   C11  ui/mos-face/hooks/register.tsx: the LEAD regex glyph set equals GLYPHS and its label equals LABEL (R-24)
 *   C12  no person is named in the persona text (R-09, D-15)
 *   C13  no em dash or en dash in this file or the module
 *
 * KNOWN table (the KNOWN rule of this phase). A KNOWN leg that fails prints "KNOWN <leg> closes in <plan>" and
 * does not fail the test. A KNOWN leg that passes FAILS the test: flip it to required. Every other leg is
 * required now. Transition rule (Codex C6): the task whose change makes a KNOWN leg pass flips it to required in
 * the same commit and its SUMMARY records "KNOWN moved: <leg>, owner <plan>, closed by <plan> Task <n>".
 * C12 KNOWN entries are keyed by the sha256 of the trimmed line text, so a line-for-line move does not reopen
 * them; the file and line at the base are information only.
 *
 * Read-only: no test writes a persona file; the mod source is read as text.
 * Hermetic: HOME, MINDRIAN_HOME, MINDRIAN_ROOMS_HOME, MINDRIAN_ROOMS_ROOT and CLAUDE_CONFIG_DIR are mkdtemp
 * dirs before any repo require; a net guard counts any fetch.
 *
 * Output: one PASS, FAIL or KNOWN line per leg, then PASS: n FAIL: n. Exit 0 when no required leg fails.
 * House rule: hyphens only.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const HOME_TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'test-3696-identity-'));
['HOME', 'MINDRIAN_HOME', 'MINDRIAN_ROOMS_HOME', 'MINDRIAN_ROOMS_ROOT', 'CLAUDE_CONFIG_DIR'].forEach(function (k) {
  const d = path.join(HOME_TMP, k.toLowerCase());
  fs.mkdirSync(d, { recursive: true });
  process.env[k] = d;
});
process.env.USERPROFILE = process.env.HOME;
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

const { installNetGuard, makeChecker } = require('./helpers/hygiene-355.cjs');
const NET = installNetGuard();
const { check, summary } = makeChecker('test-3696-identity-parity');

const ROOT = path.resolve(__dirname, '..');
const ID = require(path.join(ROOT, 'lib', 'hmi', 'larry-identity.cjs'));
const MARK = require(path.join(ROOT, 'lib', 'hmi', 'voice-color-mark.cjs'));

const CURLY = String.fromCharCode(0x2019);
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
const FE0F = String.fromCharCode(0xFE0F);
const OLD_SPELLING = new RegExp('P' + 'W' + 'S');

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function sha(s) { return crypto.createHash('sha256').update(s, 'utf8').digest('hex'); }

// ---- KNOWN table -----------------------------------------------------------------------------------------
// 369.6-07 Task 1 (2026-10-30): KNOWN moved to required: C1 to C4 (the carriers now carry the PwS sentence) and C9
// (loadLarryContext concatenates voice-dna.md, so the voice-dna edit makes it pass). C5, C8 and C10 moved to required in 369.6-07 Task 2 (the wire renders the constant, the face tagline spells PwS).
const KNOWN = {
};

// C12: lines that name a person at the base, keyed by the sha256 of the exact trimmed line text; the excerpt
// and the base location are information only.
// 369.6-09 Task 1 (2026-10-30): the two agent lines (the identity line and the DNA heading) are rewritten; their KNOWN entries are removed.
const KNOWN_LINES = [
  { sha: '746f514866b256b4a11346f526d87549f8ee7117ffdd8e12e10c6722b2f30421', excerpt: '- `hold` -- mid-step-2, the reach is pending or failed', closes_in: '369.6-11', base: 'skills/larry-personality/SKILL.md:227 (moves to a reference in 369.6-10 first)' },
  { sha: '35291f64b20be119ae286e299fd8b3cd87fbc29e0a366189dccd477c3d31f2f5', excerpt: 'The push_forward / hold / pull_back movement across the UDP', closes_in: '369.6-11', base: 'skills/larry-personality/SKILL.md:230 (moves to a reference in 369.6-10 first)' },
];

let knownCount = 0;
function leg(id, name, passes, detail) {
  const k = KNOWN[id];
  const label = id + ' ' + name;
  if (!k) return check(label, passes, detail);
  if (passes) return check(label + ': KNOWN ' + id + ' now passes: flip it to required', false, k.why);
  knownCount += 1;
  console.log('KNOWN ' + id + ' closes in ' + k.closes_in + ': ' + name + ' (' + k.why + ')');
  return true;
}

// ---- C0 the constant -------------------------------------------------------------------------------------
check('C0a exports are present', ['VERSION', 'IDENTITY_SENTENCE', 'MODEL_CLAUSE', 'CLI_ONLY_MARKERS', 'LABEL', 'TAGLINE', 'GLYPHS', 'CARRIERS', 'identityLine']
  .every(function (k) { return ID[k] !== undefined; }));
check('C0b identityLine(cli) is sentence + model clause + period',
  ID.identityLine('cli') === ID.IDENTITY_SENTENCE + ID.MODEL_CLAUSE + '.');
check('C0c identityLine(shared) and identityLine(mcp) are sentence + period, no model clause',
  ID.identityLine('shared') === ID.IDENTITY_SENTENCE + '.' && ID.identityLine('mcp') === ID.IDENTITY_SENTENCE + '.'
  && ID.CLI_ONLY_MARKERS.every(function (m) { return ID.identityLine('mcp').indexOf(m) === -1; }));
check('C0d the sentence spells PwS, never the all-capitals form, and holds two curly apostrophes',
  /PwS/.test(ID.IDENTITY_SENTENCE) && !OLD_SPELLING.test(ID.IDENTITY_SENTENCE)
  && ID.IDENTITY_SENTENCE.split(CURLY).length - 1 === 2 && ID.IDENTITY_SENTENCE.indexOf("'") === -1);
check('C0e GLYPHS deep-equals Object.keys(MARK_GLYPHS) in order',
  JSON.stringify(ID.GLYPHS) === JSON.stringify(Object.keys(MARK.MARK_GLYPHS)) && ID.GLYPHS.length === 5);
check('C0f label and tagline', ID.LABEL === 'Larry | MindrianOS' && ID.TAGLINE === 'PwS thinking partner' && !OLD_SPELLING.test(ID.TAGLINE));
check('C0g an unknown surface throws (fail closed)', (function () { try { ID.identityLine('web'); return false; } catch (e) { return e instanceof TypeError; } })());
check('C0h every carrier path exists and names a known surface, mode and kind', ID.CARRIERS.every(function (c) {
  return fs.existsSync(path.join(ROOT, c.path)) && ['cli', 'shared', 'mcp'].indexOf(c.surface) !== -1
    && ['rendered', 'parity', 'pinned'].indexOf(c.mode) !== -1 && ['sentence', 'label', 'lead-regex'].indexOf(c.kind) !== -1;
}));
check('C0i the module requires only voice-color-mark', (function () {
  const reqs = read('lib/hmi/larry-identity.cjs').match(/require\(['"][^'"]+['"]\)/g) || [];
  return reqs.length === 1 && /voice-color-mark/.test(reqs[0]);
})());

// ---- carrier texts ---------------------------------------------------------------------------------------
const carrier = function (p) { return ID.CARRIERS.find(function (c) { return c.path === p; }); };
const TEXT = {};
ID.CARRIERS.forEach(function (c) { TEXT[c.path] = read(c.path); });
const RUNTIME = require(path.join(ROOT, 'lib', 'mcp', 'runtime-instructions.cjs')).RUNTIME_INSTRUCTIONS;
const SENTENCE_LEGS = [
  ['C1', 'agents/larry-extended.md'],
  ['C2', 'skills/larry-personality/SKILL.md'],
  ['C3', 'scripts/session-start'],
  ['C4', 'references/personality/voice-dna.md'],
];
SENTENCE_LEGS.forEach(function (pair) {
  const c = carrier(pair[1]);
  leg(pair[0], pair[1] + ' carries identityLine(' + c.surface + ')', TEXT[c.path].indexOf(ID.identityLine(c.surface)) !== -1);
});
{
  const c = carrier('lib/mcp/runtime-instructions.cjs');
  leg('C5', 'the served RUNTIME_INSTRUCTIONS carries identityLine(' + c.surface + ')', RUNTIME.indexOf(ID.identityLine(c.surface)) !== -1);
}

// C6: the identity span is written with curly apostrophes, as the carriers hold it today (D-05).
{
  const SPAN = new RegExp('I(.)m Larry, MindrianOS(.)s [A-Za-z]+ thinking partner');
  const spanCarriers = ['agents/larry-extended.md', 'skills/larry-personality/SKILL.md', 'scripts/session-start', 'references/personality/voice-dna.md'];
  const texts = spanCarriers.map(function (p) { return [p, TEXT[p]]; }).concat([['served RUNTIME_INSTRUCTIONS', RUNTIME]]);
  const bad = [];
  texts.forEach(function (pair) {
    const m = SPAN.exec(pair[1]);
    if (!m) { bad.push(pair[0] + ' (no identity span)'); return; }
    if (m[1] !== CURLY || m[2] !== CURLY) bad.push(pair[0] + ' (straight apostrophe)');
  });
  check('C6 each sentence carrier writes the identity span with curly apostrophes', bad.length === 0, bad.join('; '));
}

// C7: CLI-only markers on cli text carriers, on no shared or mcp carrier.
{
  const cliText = ID.CARRIERS.filter(function (c) { return c.surface === 'cli' && c.kind === 'sentence'; });
  const missing = [];
  cliText.forEach(function (c) {
    ID.CLI_ONLY_MARKERS.forEach(function (m) { if (TEXT[c.path].indexOf(m) === -1) missing.push(c.path + ' lacks "' + m + '"'); });
  });
  check('C7a CLI_ONLY_MARKERS appear on each cli text carrier', missing.length === 0, missing.join('; '));
  const leaks = [];
  ID.CARRIERS.filter(function (c) { return c.surface !== 'cli'; }).forEach(function (c) {
    const text = c.path === 'lib/mcp/runtime-instructions.cjs' ? RUNTIME : TEXT[c.path];
    ID.CLI_ONLY_MARKERS.forEach(function (m) { if (text.indexOf(m) !== -1) leaks.push(c.path + ' holds "' + m + '"'); });
  });
  check('C7b no shared or mcp carrier holds a CLI-only marker', leaks.length === 0, leaks.join('; '));
}

// C8: a rendered carrier requires the constant and holds no literal copy of the sentence.
{
  const src = TEXT['lib/mcp/runtime-instructions.cjs'];
  const requires = /require\(\s*['"]\.\.\/hmi\/larry-identity\.cjs['"]\s*\)/.test(src);
  const literal = src.indexOf(ID.IDENTITY_SENTENCE) !== -1;
  leg('C8', 'runtime-instructions.cjs requires ../hmi/larry-identity.cjs and holds no literal copy of the sentence', requires && !literal);
}

// C9: the MCP personality that Desktop and Cowork load.
{
  const ctx = require(path.join(ROOT, 'lib', 'mcp', 'larry-context.cjs')).loadLarryContext(ROOT);
  leg('C9', 'loadLarryContext(...).full carries identityLine(shared)', ctx.full.indexOf(ID.identityLine('shared')) !== -1);
}

// C10: the face identity span (theo-faces is UMD code that cannot require the constant).
{
  const t = TEXT['lib/mcp/theo-faces.cjs'];
  const m = /<strong>([^<]*)<\/strong><span>([^<]*)<\/span>/.exec(t);
  leg('C10', 'the theo-faces identity span carries LABEL and TAGLINE', !!m && m[1] === ID.LABEL && m[2] === ID.TAGLINE,
    m ? 'found "' + m[1] + '" / "' + m[2] + '"' : 'identity span not found');
}

// C11: the mod LEAD regex, read as text (R-24). Required now.
{
  const t = TEXT['ui/mos-face/hooks/register.tsx'];
  const line = /^const LEAD = \/(.+)\/[a-z]*\s*$/m.exec(t);
  check('C11a the LEAD regex is found in register.tsx', !!line);
  if (line) {
    const groups = [];
    const re = /\(([^()]*)\)/g;
    let g;
    while ((g = re.exec(line[1])) !== null) groups.push(g[1]);
    check('C11b the LEAD regex holds a glyph group and a label group', groups.length >= 2, 'groups: ' + groups.length);
    if (groups.length >= 2) {
      const glyphs = groups[0].split('|').map(function (s) { return s.split(FE0F).join(''); });
      check('C11c the LEAD glyph set equals GLYPHS', glyphs.length === ID.GLYPHS.length && ID.GLYPHS.every(function (x) { return glyphs.indexOf(x) !== -1; }),
        'regex glyphs: ' + glyphs.length);
      check('C11d the LEAD label group equals LABEL with the pipe escaped', groups[1] === ID.LABEL.replace(/\|/g, '\\|'), 'label group: ' + groups[1]);
    }
  }
}

// C12: no person named in the persona text (R-09, D-15).
{
  const files = ['agents/larry-extended.md', 'skills/larry-personality/SKILL.md', 'skills/larry-personality/mode-engine.md', 'references/personality/voice-dna.md'];
  fs.readdirSync(path.join(ROOT, 'references', 'personality')).filter(function (f) { return /\.md$/.test(f); }).sort().forEach(function (f) {
    const rel = 'references/personality/' + f;
    if (files.indexOf(rel) === -1) files.push(rel);
  });
  const NAMES = /Aronhime|Lawrence|Prof\./;
  const hits = [];
  files.forEach(function (rel) {
    read(rel).split('\n').forEach(function (ln, i) { if (NAMES.test(ln)) hits.push({ rel: rel, n: i + 1, text: ln.trim() }); });
  });
  const matched = new Set();
  const unlisted = [];
  hits.forEach(function (h) {
    const hsha = sha(h.text);
    const idx = KNOWN_LINES.findIndex(function (k) { return k.sha === hsha; });
    if (idx === -1) unlisted.push(h.rel + ':' + h.n); else matched.add(idx);
  });
  check('C12a no line outside the KNOWN table names a person (' + files.length + ' files read)', unlisted.length === 0, unlisted.join(', '));
  KNOWN_LINES.forEach(function (k, idx) {
    const name = 'C12b-' + (idx + 1) + ' ' + k.base;
    if (matched.has(idx)) {
      knownCount += 1;
      console.log('KNOWN ' + name + ' closes in ' + k.closes_in + ': a line names a person (' + k.excerpt + ')');
    } else {
      check(name + ': KNOWN no longer matches any line: remove the KNOWN entry', false, k.excerpt);
    }
  });
}

// C13 dash guard for the two files of this task.
{
  const own = [fs.readFileSync(__filename, 'utf8'), read('lib/hmi/larry-identity.cjs')];
  check('C13 no em dash or en dash in this file or the module', own.every(function (s) { return s.indexOf(EM) === -1 && s.indexOf(EN) === -1; }));
}

check('no network call was attempted', NET.attempts() === 0);
console.log('KNOWN legs: ' + knownCount);
process.exit(summary());

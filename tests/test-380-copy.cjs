// 380-06 static copy gate (D-04, D-07, N8, T-380-21 to T-380-23).
//
// The claim: every word the face panel mod writes is plain English in Theo's name. No string
// literal of the hook sources holds an em-dash, an en-dash, the words ICM, Brain, MCP or Aura,
// the phrase "the book", the name Larry, or the name of a person or an institution. The reply
// chip is built from the reply at run time (D-07), so no literal of the bundle names Larry.
// The behavior proofs (what is really drawn, in 7 states, 4 styles, 4 widths and plain mode)
// are the tests in ui/mos-face/tests/copy.test.tsx, run by tests/test-380-engine-tests.cjs.
//
// Legs:
//   S1  a scan of the string literals (quote, double quote, template parts and JSX text) of
//       ui/mos-face/hooks/*.ts and register.tsx, read by a small reader in this file. It skips
//       import specifiers, tool-name constants that start with mcp__, regex literals (not
//       strings for the parser) and comments. A command name such as /mos:brain-derive is a
//       name and is removed before the scan; ALLOWED lists the few strings that are file names.
//   S2  the plugin.json description passes the scan and does not name Larry.
//   S3  node ui/mos-face/scripts/face-commands.cjs --check exits 0.
//   S4  no test title of panel.test.tsx holds the word Larry.
//   S5  register.tsx holds exactly 13 command.run handlers.
// CJS, Node built-ins only. Hermetic: no network, no write. Hyphens only.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const MOD = path.join(REPO, 'ui', 'mos-face');
const HOOKS = path.join(MOD, 'hooks');

let passed = 0;
let failed = 0;
function say(s) { process.stdout.write(s + '\n'); }
function check(cond, msg) {
  if (cond) { passed += 1; say('  ok ' + msg); } else { failed += 1; say('  FAIL ' + msg); }
}

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
const COMMAND_NAME = /\/mos:[a-z0-9-]+/g;
const WORD_RULES = [
  ['ICM', /\bICM\b/i],
  ['Brain', /\bBrain\b/i],
  ['MCP', /\bMCP\b/i],
  ['Aura', /\bAura\b/i],
  ['Larry', /\bLarry\b/i],
  ['the book', /\bthe book\b/i],
  ['Aronhime', /Aronhime/i],
  ['Lawrence', /Lawrence/i],
  ['Johns Hopkins', /Johns Hopkins/i],
  ['JHU', /\bJHU\b/],
];

// The banned things found in one text. Empty list = clean.
function banned(text) {
  const found = [];
  if (text.includes(EM)) found.push('em-dash');
  if (text.includes(EN)) found.push('en-dash');
  const words = text.replace(COMMAND_NAME, ' ');
  for (const [name, rule] of WORD_RULES) if (rule.test(words)) found.push(name);
  return found;
}

// Strings that are file names, not words the person reads. Each entry is file + exact text part.
const ALLOWED = [
  { file: 'probe.ts', text: '/brain-prewarm.json' },
];

// A small reader for TypeScript and TSX source. It returns the text parts a person could see:
// the contents of single quote, double quote and template strings (each template part on its
// own) and JSX text. It skips comments, regex literals and the module path of an import or an
// export from. The TypeScript compiler of the walled package is version 7 (a native binary) and
// has no script API, so this reader is the plain-counters way to do the same job. It throws on
// a string that runs over a line, which is what a misread (an apostrophe in JSX text) looks like.
function textParts(source) {
  const src = source.replace(/^[ \t]*(?:import|export)\b[^;]*?\bfrom\s*(['"])[^'"\n]*\1/gm, m => m.replace(/[^\n]/g, ' '));
  const n = src.length;
  const parts = [];
  let blank = '';
  let prev = '';
  let line = 1;
  let i = 0;

  const REGEX_AFTER = '(,=:[!&|?{;';
  const fail = (what) => { throw new Error(what + ' at line ' + line); };
  const push = (text, at) => parts.push({ text, line: at });

  function lexString(quote) {
    const at = line;
    let text = '';
    i += 1;
    while (i < n && src[i] !== quote) {
      if (src[i] === '\n') fail('unterminated string');
      if (src[i] === '\\') { text += src[i + 1] === undefined ? '' : unescape(src[i + 1]); i += 2; continue; }
      text += src[i];
      i += 1;
    }
    if (i >= n) fail('unterminated string');
    i += 1;
    push(text, at);
    blank += '§';
    prev = '"';
  }
  function unescape(ch) {
    return ch === 'n' ? '\n' : ch === 't' ? '\t' : ch;
  }
  function lexTemplate() {
    let at = line;
    let text = '';
    i += 1;
    while (i < n && src[i] !== '`') {
      if (src[i] === '\\') { text += src[i + 1] === undefined ? '' : unescape(src[i + 1]); i += 2; continue; }
      if (src[i] === '$' && src[i + 1] === '{') {
        push(text, at);
        text = '';
        i += 2;
        lexCode(true);
        at = line;
        continue;
      }
      if (src[i] === '\n') line += 1;
      text += src[i];
      i += 1;
    }
    if (i >= n) fail('unterminated template');
    i += 1;
    push(text, at);
    blank += '§';
    prev = '"';
  }
  function lexRegex() {
    i += 1;
    let inClass = false;
    while (i < n && (src[i] !== '/' || inClass)) {
      if (src[i] === '\n') fail('unterminated regex');
      if (src[i] === '\\') { i += 2; continue; }
      if (src[i] === '[') inClass = true;
      else if (src[i] === ']') inClass = false;
      i += 1;
    }
    i += 1;
    while (i < n && /[a-z]/.test(src[i])) i += 1;
    blank += '§';
    prev = '"';
  }
  function lexCode(inTemplateExpr) {
    let depth = 0;
    while (i < n) {
      const c = src[i];
      const d = src[i + 1];
      if (c === '/' && d === '/') {
        while (i < n && src[i] !== '\n') i += 1;
      } else if (c === '/' && d === '*') {
        i += 2;
        while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
          if (src[i] === '\n') { line += 1; blank += '\n'; }
          i += 1;
        }
        i += 2;
      } else if (c === "'" || c === '"') {
        lexString(c);
      } else if (c === '`') {
        lexTemplate();
      } else if (c === '/' && (prev === '' || REGEX_AFTER.includes(prev))) {
        lexRegex();
      } else if (c === '}' && inTemplateExpr && depth === 0) {
        i += 1;
        return;
      } else {
        if (c === '{') depth += 1;
        if (c === '}') depth -= 1;
        if (c === '\n') line += 1;
        blank += c;
        if (!/\s/.test(c)) prev = c;
        i += 1;
      }
    }
  }
  lexCode(false);

  // JSX text: the letters between a closing > or } and the next <, in the code with every
  // string, comment and regex taken out.
  const jsx = /(?<=[>}])([^<>{}]+)(?=<)/g;
  let m;
  while ((m = jsx.exec(blank)) !== null) {
    const text = m[1].replace(/§/g, ' ');
    if (/[A-Za-z]{2}/.test(text)) push(text.trim(), blank.slice(0, m.index).split('\n').length);
  }
  return parts;
}

// ---- Self-test of the scan rule (the gate must be able to say no) -------------------------
check(banned('A calm line.').length === 0, 'rule: a plain line is clean');
check(banned('Larry thinks').includes('Larry'), 'rule: Larry is caught');
check(banned('the Brain').includes('Brain') && banned('an MCP tool').includes('MCP') && banned('ICM room').includes('ICM'), 'rule: Brain, MCP and ICM are caught');
check(banned('a ' + EM + ' b').includes('em-dash') && banned('a ' + EN + ' b').includes('en-dash'), 'rule: the em-dash and the en-dash are caught');
check(banned('read The Book now').includes('the book'), 'rule: the phrase "the book" is caught in any case');
check(banned('run /mos:brain-derive now').length === 0, 'rule: a command name is not prose');
check(banned('Johns Hopkins').length === 1 && banned('JHU').length === 1 && banned('Prof. Aronhime').length === 1, 'rule: the names are caught');

// ---- Self-test of the reader ------------------------------------------------------------
{
  const sample = [
    "import { a } from './Larry-module'",
    "const x = 'Larry says' // 'Brain'",
    "const y = `top ${flag ? 'inner' : \"other\"} tail`",
    "const re = /^Larry's 'q/.test(x)",
    "/* MCP */",
    "const z = <Text color={c}>Plain words here</Text>",
  ].join('\n');
  const got = textParts(sample).map(p => p.text);
  check(got.includes('Larry says') && got.includes('inner') && got.includes('other') && got.includes('top ') && got.includes(' tail'), 'reader: strings and template parts are read');
  check(got.includes('Plain words here'), 'reader: JSX text is read');
  check(!got.some(t => /Brain|MCP|Larry-module|q/.test(t) && t !== 'Larry says'), 'reader: comments, regex literals and module paths are skipped');
  let threw = false;
  try { textParts("const a = 'open\nnext'"); } catch { threw = true; }
  check(threw, 'reader: a string that runs over a line is an error, not a silent skip');
}

// ---- S1 -----------------------------------------------------------------------------------
{
  const files = fs.readdirSync(HOOKS).filter(f => /\.(ts|tsx)$/.test(f)).sort();
  let scanned = 0;
  let sawBadge = false;
  const hits = [];
  for (const base of files) {
    let parts;
    try {
      parts = textParts(fs.readFileSync(path.join(HOOKS, base), 'utf8'));
    } catch (e) {
      check(false, 'S1 ' + base + ' could be read: ' + e.message);
      continue;
    }
    for (const part of parts) {
      const text = part.text;
      if (text.trim() === '' || text.startsWith('mcp__')) continue;
      if (ALLOWED.some(a => a.file === base && a.text === text)) continue;
      scanned += 1;
      if (/MindrianOS/.test(text)) sawBadge = true;
      const found = banned(text);
      if (found.length > 0) hits.push(base + ':' + part.line + ' ' + found.join(',') + ' in "' + text.slice(0, 90).replace(/\n/g, ' ') + '"');
    }
  }
  check(files.length >= 12, 'S1 scanned the hook sources (' + files.length + ' files)');
  check(scanned > 400, 'S1 looked at ' + scanned + ' text parts (the scan is not empty)');
  check(sawBadge, 'S1 reached the badge text (the reader sees what is drawn)');
  for (const h of hits) say('    ' + h);
  check(hits.length === 0, 'S1 no text part of the hook sources holds a banned word or dash (' + hits.length + ' hits)');
}

// ---- S2 -----------------------------------------------------------------------------------
{
  const manifest = JSON.parse(fs.readFileSync(path.join(MOD, '.claude-plugin', 'plugin.json'), 'utf8'));
  const found = banned(String(manifest.description || ''));
  check(found.length === 0, 'S2 plugin.json description is clean' + (found.length ? ' (' + found.join(', ') + ')' : ''));
  check(/\bTheo\b/.test(String(manifest.description || '')), 'S2 plugin.json description names Theo');
}

// ---- S3 -----------------------------------------------------------------------------------
{
  const script = path.join(MOD, 'scripts', 'face-commands.cjs');
  if (!fs.existsSync(script)) {
    check(false, 'S3 ui/mos-face/scripts/face-commands.cjs exists');
  } else {
    const r = spawnSync(process.execPath, [script, '--check'], { encoding: 'utf8' });
    if (r.status !== 0) say((r.stdout || '') + (r.stderr || ''));
    check(r.status === 0, 'S3 face-commands.cjs --check exits 0');
  }
}

// ---- S4 -----------------------------------------------------------------------------------
{
  const text = fs.readFileSync(path.join(MOD, 'panel.test.tsx'), 'utf8');
  const titles = [...text.matchAll(/^test\((['"`])(.*?)\1/gm)].map(m => m[2]);
  check(titles.length === 34, 'S4 panel.test.tsx declares 34 tests (' + titles.length + ')');
  const bad = titles.filter(t => /\bLarry\b/i.test(t));
  for (const b of bad) say('    ' + b);
  check(bad.length === 0, 'S4 no test title of panel.test.tsx holds the word Larry');
}

// ---- S5 -----------------------------------------------------------------------------------
{
  const text = fs.readFileSync(path.join(HOOKS, 'register.tsx'), 'utf8');
  const count = (text.match(/on\('command\.run'/g) || []).length;
  check(count === 13, 'S5 register.tsx holds 13 command.run handlers (' + count + ')');
}

say('');
say('test-380-copy: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
process.exit(0);

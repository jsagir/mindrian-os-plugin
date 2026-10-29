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
//   S5  register.tsx holds exactly 15 command.run handlers (plan 380-14 added mos-job, plan 380-18 added mos-tree).
//   S6  (plan 380-13, D-10 and D-11) every color literal (a hash and 6 hex digits) in the hook sources is
//       one of the seven canon tokens: no invented hex, and secondary text stays dimmed paper.
//   S7  (plan 380-13, D-10) no hook source names POSES, CREW, rasterState, rasterCrew or HOLLOW outside
//       a comment, and face.ts exports none of them: the old poses, the crew faces and their tone are gone.
//   S8  (plan 380-14, main-session ruling on plan 380-13 risk a) every state of STATE_COMMANDS has at least
//       one command, and each command exists in data/command-registry.json and is not an internal surface
//       (surface internal): the panel never suggests a command the person cannot use.
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
// A host name the panel reached is data read from the machine, not copy.
const HOST_NAME = /\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|dev|app|test)\b/gi;
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
  // The voice segment of the book (mos-brand book e947a5d, segments/writing/voice) avoids these words.
  ['revolutionary', /\brevolutionary\b/i],
  ['game-changing', /\bgame-chang(ing|er)\b/i],
  ['supercharge', /\bsupercharg/i],
  ['unlimited potential', /\bunlimited potential\b/i],
  ['instant insight', /\binstant insight\b/i],
  ['AI workforce', /\bAI workforce\b/i],
  ['autonomous strategist', /\bautonomous strategist\b/i],
  // A claim the product has not checked (voice: "not a reason to claim a capability that has not been checked").
  ['unchecked superlative', /\b(ever published|most rigorous)\b/i],
];

// The banned things found in one text. Empty list = clean.
function banned(text) {
  const found = [];
  if (text.includes(EM)) found.push('em-dash');
  if (text.includes(EN)) found.push('en-dash');
  // The book: never use a double hyphen to imitate an em dash (segment writing/voice, hard language rules).
  if (/ -- /.test(text)) found.push('double-hyphen');
  const words = text.replace(COMMAND_NAME, ' ').replace(HOST_NAME, ' ');
  for (const [name, rule] of WORD_RULES) if (rule.test(words)) found.push(name);
  return found;
}

// Strings that are file names, not words the person reads. Each entry is file + exact text part.
const ALLOWED = [
  { file: 'probe.ts', text: '/brain-prewarm.json' },
  // Plan 380-15: the file the status line reads for whether Theo is on (a path in the map and in a read).
  { file: 'status.ts', text: '~/.mindrian/bridge/brain-health.json' },
  { file: 'status.ts', text: '/bridge/brain-health.json' },
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
check(banned('health theo-mcp.onrender.com ok').length === 0 && banned('the MCP server').includes('MCP'), 'rule: a host name is data, the bare word is not');
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
  check(count === 15, 'S5 register.tsx holds 15 command.run handlers (' + count + ')');
}

// ---- S6 (plan 380-13, D-10, D-11) -----------------------------------------------------------
{
  const TOKENS = new Set(['#F7F5EE', '#111111', '#FFFFFF', '#1F3FBF', '#D6281F', '#F2C200', '#4B4943']);
  const colorsIn = (text) => (text.match(/#[0-9A-Fa-f]{6}\b/g) || []).map(c => c.toUpperCase());
  const offTokens = (text) => colorsIn(text).filter(c => !TOKENS.has(c));
  check(offTokens('const a = "#8F8B80"').length === 1 && offTokens('const a = "#f7f5ee"').length === 0, 'S6 self-test: an invented hex is caught and a canon token in any case is not');
  const files = fs.readdirSync(HOOKS).filter(f => /\.(ts|tsx)$/.test(f)).sort();
  const bad = [];
  let seen = 0;
  for (const base of files) {
    const text = fs.readFileSync(path.join(HOOKS, base), 'utf8');
    seen += colorsIn(text).length;
    for (const c of offTokens(text)) bad.push(base + ' ' + c);
  }
  check(seen >= 14, 'S6 looked at ' + seen + ' color literals in the hook sources');
  check(bad.length === 0, 'S6 every color literal of the hook sources is a canon token' + (bad.length ? ' (' + bad.join(', ') + ')' : ''));
  const register = fs.readFileSync(path.join(HOOKS, 'register.tsx'), 'utf8');
  check(/const soft = \{ color: PAPER, dimColor: true \} as const/.test(register), 'S6 secondary text is dimmed paper (D-11)');
}

// ---- S7 (plan 380-13, D-10) -------------------------------------------------------------------
{
  const GONE = /\b(POSES|CREW|rasterState|rasterCrew|HOLLOW)\b/;
  const code = (text) => text.split('\n').filter(line => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n');
  check(GONE.test(code('export const POSES = {}')) && !GONE.test(code('// POSES were removed')), 'S7 self-test: a name in code is caught and the same name in a comment is not');
  const files = fs.readdirSync(HOOKS).filter(f => /\.(ts|tsx)$/.test(f)).sort();
  const hits = [];
  for (const base of files) {
    const text = code(fs.readFileSync(path.join(HOOKS, base), 'utf8'));
    const m = text.match(GONE);
    if (m) hits.push(base + ' ' + m[1]);
  }
  check(hits.length === 0, 'S7 no hook source names POSES, CREW, rasterState, rasterCrew or HOLLOW outside a comment' + (hits.length ? ' (' + hits.join(', ') + ')' : ''));
  const face = code(fs.readFileSync(path.join(HOOKS, 'face.ts'), 'utf8'));
  const exported = [...face.matchAll(/export (?:const|function|type) (\w+)/g)].map(m => m[1]);
  check(exported.includes('LABEL') && exported.includes('LINE_FACE') && exported.includes('gridRuns'), 'S7 face.ts still exports LABEL, LINE_FACE and gridRuns (' + exported.length + ' exports)');
  const register = code(fs.readFileSync(path.join(HOOKS, 'register.tsx'), 'utf8'));
  check(!/\bcrew\b/i.test(register) && !/'crew'/.test(register), 'S7 register.tsx has no crew atom and no crew style');
}

// ---- S8 -----------------------------------------------------------------------------------
{
  const source = fs.readFileSync(path.join(HOOKS, 'commands.ts'), 'utf8');
  const registry = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'command-registry.json'), 'utf8'));
  const surface = new Map(registry.commands.map(c => [c.command, c.surface]));
  const m = source.match(/export const STATE_COMMANDS[^=\n]*= (\{[\s\S]*?\n\})\n/);
  check(Boolean(m), 'S8 commands.ts holds STATE_COMMANDS');
  const table = m ? JSON.parse(m[1]) : {};
  const states = Object.keys(table);
  check(states.length === 11, 'S8 STATE_COMMANDS holds the 11 canon states (' + states.length + ')');
  const missing = [];
  const unknown = [];
  const internal = [];
  for (const state of states) {
    const list = table[state];
    if (!Array.isArray(list) || list.length === 0) missing.push(state);
    for (const command of list || []) {
      if (!surface.has(command)) unknown.push(state + ' ' + command);
      else if (surface.get(command) === 'internal') internal.push(state + ' ' + command);
    }
  }
  check(missing.length === 0, 'S8 every state has at least one suggested command' + (missing.length ? ' (' + missing.join(', ') + ')' : ''));
  check(unknown.length === 0, 'S8 every suggested command is in the registry' + (unknown.length ? ' (' + unknown.join(', ') + ')' : ''));
  check(internal.length === 0, 'S8 no suggested command is an internal surface' + (internal.length ? ' (' + internal.join(', ') + ')' : ''));
  check(Boolean(surface.get('/mos:challenge-assumptions') === 'navigator'), 'S8 self-test: /mos:challenge-assumptions is a navigator surface');
  check(surface.get('/mos:memory-cortex-reach') === 'internal', 'S8 self-test: the registry still marks /mos:memory-cortex-reach internal (so the rule has teeth)');
}

say('');
say('test-380-copy: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
process.exit(0);

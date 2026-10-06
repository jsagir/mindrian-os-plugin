// 369.26 plan 18 (WS-17): the permanent source guards for the Mindrian Workspace mod.
//
// Why this file exists: every rule the earlier plans obeyed (copy deck only, no hex, no long dash,
// one write path, one Brain-facing call, no timer, no italic, no stray hotkey) is written down here
// as a test that FAILS when a later edit breaks it. Each guard has a MUTATION ARM: it plants one
// violation in a scratch copy of the mod and requires the guard to report it, so a guard that
// cannot fail cannot pass either.
//
//   G1 dashes        no em-dash or en-dash in any mod file (outside node_modules and .claude-plugin/types)
//   G2 hex           no hex color literal in src/ (colors come from the theme, which reads palette.json)
//   G3 environment   no require, import(), process, Node built-in, fetch, or a forbidden $ noun in src/
//   G4 visible text  by syntax tree: no JSX text, no label/title/alt string literal, no string child;
//                    every text('ID') names an id that exists in the deck
//   G5 deck use      every deck id is used somewhere, or is allow-listed here with a UI-SPEC reason
//   G6 network       $.mcp.call only where allowed; the MCP tools called are exactly the audited set;
//                    gate_answer and gate_render only in src/pane/review/gate-client.ts
//   G7 style         no italic, underline, strikethrough, timer, animation, gray_meta; logoGreen only
//                    in the theme; no primary variant, no round border
//   G12 roles        C-30: evidence, contradiction and assumption are drawn only in their role's files
//   G8 completeness  all four tab bodies defined, no dependency fields, every registrar non-empty
//   G9 hotkeys       every hotkey literal is one character, 0-9 or a-z
//   G13 bar fill     F4 (2026-10-06): the context bar's filled cell never takes the job of the track behind it
//   G11 ground       C-29: a Button or Select in src/pane sits inside a Box that spreads ground() (the host
//                    paints their label in its own light color, invisible on the cream page); no dimColor
//                    attribute in src/pane outside such a Box (dim on cream is faint grey, R-18 closed);
//                    in src/band a Block on the cream `reading` job never holds a Button
//   G10 mutation     one planted violation per guard, each must be reported (run inside each group)
//
// The Canon Part 8 proof (the one Brain-facing call) is tests/test-369.26-part8.cjs (plan 16). It is
// NOT repeated here; G6 only checks that its leg is still named in tests/run-all-369.26.sh.
//
// Syntax trees come from the walled tools/ts-check TypeScript (version 7, its unstable sync API:
// it starts the native compiler once per tree and reads the parsed tree). Exit 77 (ENV GAP, never a
// pass) when that package is not installed: npm --prefix tools/ts-check ci --ignore-scripts
// Hermetic: reads the repo, writes only to a temp dir it removes. Hyphens only (the dash characters
// are built at run time). CJS, Node built-ins only.
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO = path.resolve(__dirname, '..');
const MOD = path.join(REPO, 'ui', 'mindrian-workspace-mod');
const TS_DIST = path.join(REPO, 'tools', 'ts-check', 'node_modules', 'typescript', 'dist');
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

// ---------- the rules, in one place ----------

// G5: deck ids that no source file references, each with the UI-SPEC reason it stays in the deck.
// An entry whose id IS used fails too (the list may only shrink when a plan wires the id).
const UNUSED_DECK_ALLOW = {
  B02: 'UI-SPEC 12.2 reads B02 once in plain mode, but plan 08 draws B01 there: B02 is 32 characters and would push the alert off a 55-column row (369.26-08-SUMMARY)',
  B67: 'UI-SPEC 9.2 and 17.3 use B67 only when a name and a count share one plain string; the band keeps them in separate blocks split by the plain separator (C-17, plan 05), so no string joins them',
  L04: 'UI-SPEC 7.4 gives help results the marks L01 to L03; no row of section 7 assigns the black A decision mark or the cream Handing over mark a site (Larry turns draw them in the host)',
  L05: 'UI-SPEC 7.4 gives help results the marks L01 to L03; no row of section 7 assigns the black A decision mark or the cream Handing over mark a site (Larry turns draw them in the host)',
  P79: 'UI-SPEC 7.4 UncertaintyPanel dim line; plan 12 holds it back until the planned reasoning brief (369.25) supplies the one gap that could change the decision, because the interim open-question source cannot support that claim (T-369.26-12-02)',
};

// G4: identifiers that may be rendered as a JSX child although they hold a string constant.
// PLAIN_SEPARATOR: the plain band's block separator (UI-SPEC 12.2, plan 05). DOT: the empty-cell glyph of the
// ten-cell bar (UI-SPEC R-14, 12.4: decorative and hidden from the reading order). Each must stay a pure glyph.
const GLYPH_CONST_ALLOW = { PLAIN_SEPARATOR: /^[ |]+$/, DOT: /^[\u00B7.]$/ };

// G3: where a state write is allowed (a literal reference, the plain-mode switch only).
const STATE_SET_FILES = new Set(['src/command/workspace.ts', 'src/theme/plain.ts']);

// G6
const DOLLAR_MCP_FILES = { 'src/registrars/model.ts': 1, 'src/registrars/pane.tsx': 2 };
const MINDRIAN_TOOLS = new Set(['status_read', 'gate_list', 'gate_answer', 'gate_render', 'room_artifact', 'whitespace_scan']);
const BRAIN_TOOLS = new Set(['framework_techniques']);
const GATE_WRITE_FILE = 'src/pane/review/gate-client.ts';
// Sample data (kind names such as chain_halt are values here, never calls).
const FIXTURE_FILE = 'src/model/fixtures.ts';
// The one pass-through: review-io hands its server, tool and args to act.io.mcpCall, which the pane registrar
// pins to MINDRIAN_SERVER (allowedServer); the pin itself is checked below.
const PASSTHROUGH_FILE = 'src/pane/review/review-io.ts';
const GATE_WRITE_TOOLS = new Set(['gate_answer', 'gate_render']);
const TOOL_SHAPED = /^(brain|framework|chain|suggest|stop|room|gate|status|whitespace|extract|detect|graph|vault)_[a-z_]+$/;

// G7 and G12 (C-30, C-32): the five-squares test as a build gate. A job is drawn only in its role's
// files. `logoGreen` and `contradiction` are drawn nowhere in src/ but the theme (the logo is the
// plain text mark now, and no contradiction source exists); `evidence` only in the theme and the
// pane's ground helper (the pane draws no blue today); `assumption` only in the no-evidence list,
// the help result's Challenging mark and the helpers. `structure` and `paper` are free.
const THEME_FILES = (rel) => rel.startsWith('src/theme/') || rel === 'src/pane/ink.ts';
const LOGO_GREEN_FILES = (rel) => rel.startsWith('src/theme/');
const ROLE_FILES = {
  evidence: (rel) => THEME_FILES(rel),
  contradiction: (rel) => rel.startsWith('src/theme/'),
  assumption: (rel) => THEME_FILES(rel) || rel === 'src/pane/think/uncertainty.tsx' || rel === 'src/pane/think/help-actions.tsx',
};

// G8
const BODY_FILES = ['room', 'think', 'sources', 'review'].map((n) => 'src/pane/bodies/' + n + '.tsx');
const REGISTRAR_FILES = ['src/registrars/band.tsx', 'src/registrars/model.ts', 'src/registrars/pane.tsx'];
const DEP_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

const JSX_TEXT_PROPS = new Set(['label', 'title', 'alt', 'placeholder', 'text', 'description', 'hint', 'caption', 'message']);

// ---------- tiny harness (house style: plain counters, nonzero exit tail) ----------

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  ok ' + name + '\n'); }
function fail(name, detail) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (detail) process.stdout.write('    ' + String(detail).split('\n').slice(0, 14).join('\n    ') + '\n');
}
async function scenario(name, fn) {
  try { await fn(); ok(name); } catch (e) { fail(name, e && (e.message || e)); }
}
function must(cond, msg) { if (!cond) throw new Error(msg); }

// ---------- files ----------

function walk(dir, skip, out) {
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    if (skip(abs)) continue;
    if (fs.statSync(abs).isDirectory()) walk(abs, skip, out); else out.push(abs);
  }
  return out;
}
const rel = (root, abs) => path.relative(root, abs).split(path.sep).join('/');
const skipGenerated = (root) => (abs) => {
  const r = rel(root, abs);
  return path.basename(abs) === 'node_modules' || r === '.claude-plugin/types' || r.startsWith('.claude-plugin/types/');
};

// ---------- syntax tree access ----------

let TS = null; // { API, SyntaxKind, skipTrivia }
async function loadTs() {
  const apiJs = path.join(TS_DIST, 'api', 'sync', 'api.js');
  if (!fs.existsSync(apiJs)) return false;
  try {
    const api = await import(pathToFileURL(apiJs).href);
    const ast = await import(pathToFileURL(path.join(TS_DIST, 'ast', 'index.js')).href);
    const scanner = await import(pathToFileURL(path.join(TS_DIST, 'ast', 'scanner.js')).href);
    TS = { API: api.API, SyntaxKind: ast.SyntaxKind, skipTrivia: scanner.skipTrivia };
    return true;
  } catch (e) {
    process.stdout.write('  note: the walled TypeScript could not load (' + (e && e.message) + ')\n');
    return false;
  }
}

// Parse every .ts/.tsx under modRoot/src. Returns { files, close }. A file is { rel, abs, text, sf, code }.
// `code` is the text with comments blanked (same length, so offsets agree).
function parseTree(modRoot) {
  const srcRoot = path.join(modRoot, 'src');
  const abs = walk(srcRoot, () => false, []).filter((f) => /\.tsx?$/.test(f));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-sg-parse-'));
  const tsconfig = path.join(tmp, 'tsconfig.json');
  fs.writeFileSync(tsconfig, JSON.stringify({
    compilerOptions: { jsx: 'react', jsxFactory: 'h', jsxFragmentFactory: 'Fragment', noResolve: true, noLib: true, types: [], target: 'es2023', module: 'esnext' },
    files: abs,
  }));
  const api = new TS.API({ cwd: tmp });
  let files = [];
  try {
    const snap = api.updateSnapshot({ openProject: tsconfig });
    const project = snap.getProjects()[0];
    for (const f of abs) {
      const sf = project.program.getSourceFile(f);
      if (!sf) throw new Error('the compiler returned no tree for ' + f);
      const text = fs.readFileSync(f, 'utf8');
      files.push({ rel: rel(modRoot, f), abs: f, text, sf, code: blankComments(sf, text) });
    }
  } catch (e) {
    try { api.close(); } catch (_e) { /* ignore */ }
    fs.rmSync(tmp, { recursive: true, force: true });
    throw e;
  }
  return { files, close: () => { try { api.close(); } catch (_e) { /* ignore */ } fs.rmSync(tmp, { recursive: true, force: true }); } };
}

// Blank every comment. A comment can only sit in trivia (between tokens), never inside a string, a
// template piece, a regex or JSX text, because those are leaf nodes of the tree. So: for a leaf, scan
// the trivia before it; for a node with children, scan the gaps around its children.
function blankComments(sf, text) {
  const K = TS.SyntaxKind;
  const chars = text.split('');
  function blank(from, to) {
    let i = from;
    while (i < to) {
      if (text[i] === '/' && text[i + 1] === '/') {
        while (i < to && text[i] !== '\n') { if (chars[i] !== '\n') chars[i] = ' '; i += 1; }
      } else if (text[i] === '/' && text[i + 1] === '*') {
        const close = text.indexOf('*/', i + 2);
        const end = close < 0 ? to : Math.min(close + 2, to);
        for (; i < end; i += 1) if (chars[i] !== '\n') chars[i] = ' ';
      } else {
        i += 1;
      }
    }
  }
  (function visit(node) {
    if (node.kind === K.JsxText) return;
    const kids = [];
    node.forEachChild((c) => { kids.push(c); });
    if (kids.length === 0) {
      blank(node.pos, TS.skipTrivia(text, node.pos));
      return;
    }
    let cursor = node.pos;
    for (const c of kids) {
      blank(cursor, c.pos);
      visit(c);
      cursor = c.end;
    }
    blank(cursor, node.end);
  })(sf);
  return chars.join('');
}

function eachNode(sf, fn) {
  (function visit(node) {
    fn(node);
    node.forEachChild((c) => { visit(c); });
  })(sf);
}

const kindName = (node) => TS.SyntaxKind[node.kind];
const nodeText = (file, node) => file.text.slice(node.pos, node.end).trim();
const lineOf = (file, node) => file.text.slice(0, node.pos).split('\n').length;
const where = (file, node) => file.rel + ':' + lineOf(file, node);
const HAS_ALNUM = /[\p{L}\p{N}]/u;

// A string-ish expression: returns { kind, parts } or null.
function stringShape(node) {
  const k = kindName(node);
  if (k === 'StringLiteral' || k === 'NoSubstitutionTemplateLiteral') return { kind: 'literal', parts: [node.text] };
  if (k === 'TemplateExpression') {
    const parts = [node.head.text];
    for (const span of node.templateSpans) parts.push(span.literal.text);
    return { kind: 'template', parts };
  }
  return null;
}

// ---------- the guards: each returns a list of violation strings ----------

function g1Dashes(modRoot) {
  const bad = [];
  for (const f of walk(modRoot, skipGenerated(modRoot), [])) {
    let text;
    try { text = fs.readFileSync(f, 'utf8'); } catch (_e) { continue; }
    if (text.includes(EM) || text.includes(EN)) bad.push('G1 long dash in ' + rel(modRoot, f));
  }
  return bad;
}

function g2Hex(tree) {
  const bad = [];
  const long = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6})\b/;
  const short = /['"`]#[0-9a-fA-F]{3,4}['"`]/;
  for (const f of tree.files) {
    if (long.test(f.code) || short.test(f.code)) bad.push('G2 hex color literal in ' + f.rel);
  }
  return bad;
}

function g3Environment(tree) {
  const bad = [];
  const rules = [
    [/\brequire\s*\(/, 'require('],
    [/\bimport\s*\(/, 'import('],
    [/\bprocess\./, 'process.'],
    [/['"`]node:/, 'a node: specifier'],
    [/\bfetch\s*\(/, 'fetch('],
    [/\$\.(http|model|agent|process)\b/, 'a forbidden $ noun (http, model, agent, process)'],
    [/\$\.tool\.call\b/, '$.tool.call'],
    [/\$\.fs\.write\b/, '$.fs.write'],
    [/\$\.prompt\.submit\b/, '$.prompt.submit'],
  ];
  for (const f of tree.files) {
    for (const [re, label] of rules) if (re.test(f.code)) bad.push('G3 ' + label + ' in ' + f.rel);
    if (/\$\.state\.set\b/.test(f.code) && !STATE_SET_FILES.has(f.rel)) bad.push('G3 $.state.set outside the plain-mode switch in ' + f.rel);
    eachNode(f.sf, (n) => {
      if (kindName(n) !== 'ImportDeclaration') return;
      const spec = n.moduleSpecifier.text;
      if (!(spec.startsWith('./') || spec.startsWith('../') || spec === 'claude-code')) bad.push('G3 import of "' + spec + '" in ' + where(f, n) + ' (only relative files and claude-code)');
    });
  }
  return bad;
}

function deckIds(tree) {
  const deck = tree.files.find((f) => f.rel === 'src/copy/deck.ts');
  if (!deck) return null;
  const ids = new Set();
  for (const m of deck.code.matchAll(/^\s*'([A-Z][0-9]{2,3})'\s*:/gm)) ids.add(m[1]);
  return ids;
}

function topLevelStringConsts(file) {
  const out = new Map();
  eachNode(file.sf, (n) => {
    if (kindName(n) !== 'VariableDeclaration' || !n.initializer || !n.name || kindName(n.name) !== 'Identifier') return;
    const s = stringShape(n.initializer);
    if (s && s.parts.some((p) => HAS_ALNUM.test(p) || p.trim() !== '')) out.set(n.name.text, s.parts.join(''));
  });
  return out;
}

function g4VisibleText(tree) {
  const bad = [];
  const ids = deckIds(tree);
  if (!ids) return ['G4 src/copy/deck.ts not found'];
  for (const f of tree.files) {
    const isTsx = f.rel.endsWith('.tsx');
    const consts = isTsx ? topLevelStringConsts(f) : new Map();
    eachNode(f.sf, (n) => {
      const k = kindName(n);
      if (k === 'CallExpression' && n.expression && kindName(n.expression) === 'Identifier' && n.expression.text === 'text') {
        const first = n.arguments && n.arguments[0];
        const s = first && kindName(first) === 'StringLiteral' ? first.text : null;
        if (s !== null && !ids.has(s)) bad.push('G4 text(' + JSON.stringify(s) + ') names no deck id at ' + where(f, n));
        return;
      }
      if (!isTsx) return;
      if (k === 'JsxText') {
        const raw = f.text.slice(n.pos, n.end);
        if (raw.trim() !== '') bad.push('G4 JSX text ' + JSON.stringify(raw.trim().slice(0, 40)) + ' at ' + where(f, n));
        return;
      }
      if (k === 'JsxAttribute') {
        const name = n.name && n.name.text;
        if (!JSX_TEXT_PROPS.has(name) || !n.initializer) return;
        const init = n.initializer;
        const direct = kindName(init) === 'StringLiteral' ? { kind: 'literal', parts: [init.text] } : null;
        const expr = kindName(init) === 'JsxExpression' && init.expression ? init.expression : null;
        const shape = direct || (expr ? stringShape(expr) : null);
        if (shape && shape.parts.some((p) => HAS_ALNUM.test(p))) bad.push('G4 ' + name + ' is a string literal at ' + where(f, n));
        if (expr && kindName(expr) === 'Identifier' && consts.has(expr.text) && !GLYPH_CONST_ALLOW[expr.text]) bad.push('G4 ' + name + ' renders the constant ' + expr.text + ' at ' + where(f, n));
        return;
      }
      if (k === 'JsxExpression') {
        const parent = kindName(n.parent);
        if (parent !== 'JsxElement' && parent !== 'JsxFragment') return;
        const e = n.expression;
        if (!e) return;
        const shape = stringShape(e);
        if (shape && shape.kind === 'literal' && shape.parts[0].trim() !== '') bad.push('G4 string literal child ' + JSON.stringify(shape.parts[0].slice(0, 30)) + ' at ' + where(f, n));
        if (shape && shape.kind === 'template' && shape.parts.some((p) => HAS_ALNUM.test(p))) bad.push('G4 template child with words at ' + where(f, n));
        if (kindName(e) === 'Identifier' && consts.has(e.text) && !GLYPH_CONST_ALLOW[e.text]) bad.push('G4 child renders the string constant ' + e.text + ' at ' + where(f, n));
        return;
      }
      if (k === 'PropertyAssignment' && n.name && JSX_TEXT_PROPS.has(n.name.text) && n.initializer) {
        const shape = stringShape(n.initializer);
        const isDeckId = shape && shape.kind === 'literal' && ids.has(shape.parts[0]);
        if (shape && !isDeckId && shape.parts.some((p) => HAS_ALNUM.test(p))) bad.push('G4 property ' + n.name.text + ' holds a string literal at ' + where(f, n));
      }
    });
    // The allow-listed glyph constants must still be pure separators.
    for (const [name, re] of Object.entries(GLYPH_CONST_ALLOW)) {
      if (consts.has(name) && !re.test(consts.get(name))) bad.push('G4 the allow-listed constant ' + name + ' in ' + f.rel + ' now holds ' + JSON.stringify(consts.get(name)));
    }
  }
  return bad;
}

// All deck ids referenced as a string literal outside the deck and outside type positions.
function referencedIds(tree, ids) {
  const used = new Set();
  for (const f of tree.files) {
    if (f.rel === 'src/copy/deck.ts') continue;
    eachNode(f.sf, (n) => {
      if (kindName(n) !== 'StringLiteral' || !ids.has(n.text)) return;
      if (kindName(n.parent) === 'LiteralType' || kindName(n.parent) === 'ImportDeclaration') return;
      used.add(n.text);
    });
  }
  return used;
}

function g5DeckUse(tree) {
  const ids = deckIds(tree);
  if (!ids) return { bad: ['G5 src/copy/deck.ts not found'], unused: [] };
  const used = referencedIds(tree, ids);
  const unused = [...ids].filter((i) => !used.has(i)).sort();
  const bad = [];
  for (const id of unused) if (!UNUSED_DECK_ALLOW[id]) bad.push('G5 deck id ' + id + ' is never used and is not allow-listed');
  for (const id of Object.keys(UNUSED_DECK_ALLOW)) {
    if (!ids.has(id)) bad.push('G5 allow-listed id ' + id + ' is not in the deck any more (remove it from the list)');
    else if (used.has(id)) bad.push('G5 allow-listed id ' + id + ' is now used (remove it from the list)');
  }
  return { bad, unused };
}

function g6Network(tree) {
  const bad = [];
  const dollarSites = {};
  for (const f of tree.files) {
    eachNode(f.sf, (n) => {
      const k = kindName(n);
      if (k === 'StringLiteral') {
        const v = n.text;
        if (GATE_WRITE_TOOLS.has(v) && f.rel !== GATE_WRITE_FILE) bad.push('G6 ' + v + ' named outside ' + GATE_WRITE_FILE + ' at ' + where(f, n));
        if (f.rel !== FIXTURE_FILE && TOOL_SHAPED.test(v) && !MINDRIAN_TOOLS.has(v) && !BRAIN_TOOLS.has(v)) bad.push('G6 an unaudited tool name ' + v + ' at ' + where(f, n));
        return;
      }
      if (k !== 'CallExpression' || !n.expression) return;
      const callee = nodeText(f, n.expression);
      const args = n.arguments ? Array.from(n.arguments) : [];
      const lit = (a) => (a && kindName(a) === 'StringLiteral' ? a.text : null);
      if (callee === '$.mcp.call') {
        dollarSites[f.rel] = (dollarSites[f.rel] || 0) + 1;
        if (!DOLLAR_MCP_FILES[f.rel]) bad.push('G6 $.mcp.call outside the registrars at ' + where(f, n));
        const server = args[0] ? nodeText(f, args[0]) : '';
        const tool = lit(args[1]);
        if (server === 'BRAIN_SERVER') {
          if (f.rel !== 'src/registrars/pane.tsx' || !BRAIN_TOOLS.has(tool)) bad.push('G6 a Brain call that is not the one lookup closure at ' + where(f, n));
        } else if (server === 'MINDRIAN_SERVER') {
          if (!MINDRIAN_TOOLS.has(tool)) bad.push('G6 a Mindrian call with an unaudited tool at ' + where(f, n));
        } else if (args[1] && tool !== null) {
          bad.push('G6 $.mcp.call with a literal tool and a server that is not a named constant at ' + where(f, n));
        }
        return;
      }
      if (/(^|\.)mcpCall$/.test(callee)) {
        const server = args[0] ? nodeText(f, args[0]) : '';
        const tool = lit(args[1]);
        if (f.rel === PASSTHROUGH_FILE && server === 'server' && args[1] && nodeText(f, args[1]) === 'tool') return;
        if (server !== 'MINDRIAN_SERVER') bad.push('G6 mcpCall to a server other than MINDRIAN_SERVER at ' + where(f, n));
        if (tool !== null && !MINDRIAN_TOOLS.has(tool)) bad.push('G6 mcpCall with an unaudited tool ' + tool + ' at ' + where(f, n));
        if (tool === null && f.rel !== GATE_WRITE_FILE) bad.push('G6 mcpCall with a computed tool name at ' + where(f, n));
        return;
      }
      if (callee === 'call' && f.rel === GATE_WRITE_FILE) {
        const tool = lit(args[1]);
        if (tool === null || !MINDRIAN_TOOLS.has(tool)) bad.push('G6 gate-client call with an unaudited tool at ' + where(f, n));
      }
    });
  }
  const pane = tree.files.find((x) => x.rel === 'src/registrars/pane.tsx');
  if (!pane || !/allowedServer\(server\)\s*\?\s*\$\.mcp\.call\(server, tool, args\)/.test(pane.code)) bad.push('G6 src/registrars/pane.tsx no longer pins act.io to the allowed server (allowedServer)');
  const kit = tree.files.find((x) => x.rel === 'src/pane/kit.ts');
  if (!kit || !/return server === MINDRIAN_SERVER/.test(kit.code)) bad.push('G6 src/pane/kit.ts allowedServer no longer admits only MINDRIAN_SERVER');
  for (const [file, count] of Object.entries(DOLLAR_MCP_FILES)) {
    if ((dollarSites[file] || 0) !== count) bad.push('G6 ' + file + ' holds ' + (dollarSites[file] || 0) + ' $.mcp.call sites, expected ' + count);
  }
  return bad;
}

function g7Style(tree) {
  const bad = [];
  const rules = [
    [/\b(italic|underline|strikethrough)\b/, 'an italic, underline or strikethrough prop'],
    [/\b(setTimeout|setInterval|setImmediate|requestAnimationFrame)\b|\$\.clock\.(every|after)\b/, 'a timer or animation'],
    [/gray_meta/, 'gray_meta'],
  ];
  for (const f of tree.files) {
    for (const [re, label] of rules) if (re.test(f.code)) bad.push('G7 ' + label + ' in ' + f.rel);
    if (/\blogoGreen\b/.test(f.code) && !LOGO_GREEN_FILES(f.rel)) bad.push('G7 logoGreen outside the theme in ' + f.rel);
    if (/\bteal\b|\bamethyst\b|\bsienna\b/.test(f.code)) bad.push('G7 a retired palette name in ' + f.rel);
    if (/variant\s*[=:]\s*\{?\s*['"]primary['"]/.test(f.code)) bad.push('G7 a primary variant in ' + f.rel + ' (C-30: no blue or primary button)');
    if (/borderStyle\s*[=:]\s*\{?\s*['"]round['"]/.test(f.code)) bad.push('G7 a round border in ' + f.rel);
  }
  return bad;
}

// G12 (C-30, C-32): each role color is drawn only by the files of its role. Looks for the job as a
// string literal (a job argument) or as a theme key (`theme.evidence`), outside comments.
function g12Roles(tree) {
  const bad = [];
  for (const f of tree.files) {
    for (const [role, allowed] of Object.entries(ROLE_FILES)) {
      if (allowed(f.rel)) continue;
      const re = new RegExp("['\"]" + role + "['\"]|\\btheme\\." + role + "\\b|\\bTHEME\\." + role + "\\b");
      if (re.test(f.code)) bad.push('G12 the ' + role + ' role is drawn outside its files in ' + f.rel);
    }
  }
  return bad;
}

// G13 (F4, 2026-10-06 real run): the filled cells of the context bar were black on the black band, so
// only the four empty dots showed. In ContextBar (src/band/blocks.tsx) the background job of a filled
// cell must differ from every background job of the track behind it (the two caps and the empty
// cells). Read from the source, so a palette edit cannot hide it.
function g13BarFill(tree) {
  const f = tree.files.find((x) => x.rel === 'src/band/blocks.tsx');
  if (!f) return ['G13 src/band/blocks.tsx is missing'];
  const at = f.code.indexOf('export function ContextBar');
  if (at < 0) return ['G13 ContextBar is not in src/band/blocks.tsx'];
  const body = f.code.slice(at);
  const filled = /i\s*<\s*on\s*\?\s*\(\s*<Box\b[^>]*backgroundColor=\{theme\.(\w+)\}/.exec(body);
  if (!filled) return ['G13 the filled cell of ContextBar (the Box in the i < on branch) has no theme background job'];
  const all = [];
  const re = /backgroundColor=\{theme\.(\w+)\}/g;
  let m;
  while ((m = re.exec(body)) !== null) all.push(m[1]);
  const track = all.slice();
  track.splice(track.indexOf(filled[1]), 1); // remove the filled cell's own entry once
  if (track.length === 0) return ['G13 ContextBar has no track background (caps or empty cells) to compare the fill with'];
  if (track.includes(filled[1])) return ['G13 the ContextBar fill uses the ' + filled[1] + ' job, the same as the track behind it: the filled cells would not show'];
  return [];
}

function g8Completeness(tree, modRoot) {
  const bad = [];
  for (const b of BODY_FILES) {
    const f = tree.files.find((x) => x.rel === b);
    if (!f) { bad.push('G8 missing tab body file ' + b); continue; }
    if (/TabBody\s*\|\s*undefined\s*=\s*undefined/.test(f.code)) bad.push('G8 ' + b + ' is still the undefined seam');
    if (!/\bexport\s+const\s+\w+Body\b/.test(f.code)) bad.push('G8 ' + b + ' exports no body');
  }
  for (const r of REGISTRAR_FILES) {
    const f = tree.files.find((x) => x.rel === r);
    if (!f) { bad.push('G8 missing registrar ' + r); continue; }
    if (!/\bexport\b/.test(f.code) || !/\bon\s*\(\s*['"]/.test(f.code)) bad.push('G8 registrar ' + r + ' registers nothing');
  }
  const regFile = tree.files.find((x) => x.rel === 'src/register.tsx');
  if (!regFile || !/register(Band|Model|Pane)/.test(regFile.code)) bad.push('G8 src/register.tsx does not call the registrars');
  const pkgPath = path.join(modRoot, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  for (const field of DEP_FIELDS) if (pkg[field] !== undefined) bad.push('G8 package.json declares ' + field);
  return bad;
}

function g9Hotkeys(tree) {
  const bad = [];
  const valid = /^[0-9a-z]$/;
  for (const f of tree.files) {
    eachNode(f.sf, (n) => {
      const k = kindName(n);
      if (k === 'JsxAttribute' && n.name && n.name.text === 'hotkey' && n.initializer) {
        const init = n.initializer;
        const v = kindName(init) === 'StringLiteral' ? init.text : (kindName(init) === 'JsxExpression' && init.expression && kindName(init.expression) === 'StringLiteral' ? init.expression.text : null);
        if (v !== null && !valid.test(v)) bad.push('G9 hotkey ' + JSON.stringify(v) + ' at ' + where(f, n));
        if (v === null) {
          const body = nodeText(f, init);
          if (!/^\{\s*(String\(n\)|spec\.hotkey)\s*\}$/.test(body)) bad.push('G9 a hotkey that is not a single literal at ' + where(f, n));
        }
      }
      if (k === 'PropertyAssignment' && n.name && n.name.text === 'hotkey' && n.initializer) {
        if (kindName(n.initializer) === 'StringLiteral') {
          if (!valid.test(n.initializer.text)) bad.push('G9 hotkey ' + JSON.stringify(n.initializer.text) + ' at ' + where(f, n));
        } else if (!/^(String\(n\)|SPECS\.\w+\.hotkey)$/.test(nodeText(f, n.initializer))) {
          bad.push('G9 a hotkey that is not a single literal at ' + where(f, n));
        }
      }
    });
  }
  return bad;
}

// ---------- G11: controls sit on a ground (C-29) ----------

function eachNodeWithAncestors(sf, fn) {
  (function visit(node, chain) {
    fn(node, chain);
    const next = chain.concat([node]);
    node.forEachChild((c) => { visit(c, next); });
  })(sf, []);
}

const tagOf = (node) => (node.tagName && node.tagName.text) || '';

// True when the JSX element `el` (a Box) spreads `ground(...)` directly in its attributes.
function boxSpreadsGround(file, el) {
  if (kindName(el) !== 'JsxElement' || !el.openingElement || tagOf(el.openingElement) !== 'Box') return false;
  for (const attr of el.openingElement.attributes.properties) {
    if (kindName(attr) === 'JsxSpreadAttribute' && /^ground\(/.test(nodeText(file, attr.expression))) return true;
  }
  return false;
}

function g11Ground(tree) {
  const bad = [];
  for (const f of tree.files) {
    if (f.rel.startsWith('src/pane/')) {
      eachNodeWithAncestors(f.sf, (n, chain) => {
        const k = kindName(n);
        const grounded = () => chain.some((a) => boxSpreadsGround(f, a));
        if ((k === 'JsxSelfClosingElement' || k === 'JsxOpeningElement') && (tagOf(n) === 'Button' || tagOf(n) === 'Select')) {
          if (!grounded()) bad.push('G11 a ' + tagOf(n) + ' outside a Box that spreads ground() at ' + where(f, n));
        }
        if (k === 'JsxAttribute' && n.name && n.name.text === 'dimColor' && !grounded()) {
          bad.push('G11 a dimColor attribute outside a black ground at ' + where(f, n));
        }
        if (k === 'PropertyAssignment' && n.name && n.name.text === 'dimColor' && f.rel !== 'src/pane/ink.ts') {
          bad.push('G11 a dimColor property outside src/pane/ink.ts at ' + where(f, n));
        }
      });
    }
    if (f.rel.startsWith('src/band/')) {
      eachNode(f.sf, (n) => {
        if (kindName(n) !== 'CallExpression' || nodeText(f, n.expression) !== 'Block') return;
        for (const arg of n.arguments) {
          if (kindName(arg) !== 'ObjectLiteralExpression') continue;
          let cream = false;
          for (const prop of arg.properties) {
            if (kindName(prop) === 'PropertyAssignment' && prop.name && prop.name.text === 'job' && kindName(prop.initializer) === 'StringLiteral' && prop.initializer.text === 'paper') cream = true;
          }
          if (!cream) continue;
          eachNode(arg, (m) => {
            const mk = kindName(m);
            if ((mk === 'JsxSelfClosingElement' || mk === 'JsxOpeningElement') && tagOf(m) === 'Button') bad.push('G11 a Button inside a cream Block at ' + where(f, m));
          });
        }
      });
    }
  }
  return bad;
}

// Run one guard against a mod root (parses once). `which` is 'G1'..'G9' or 'G11'.
function runGuard(which, modRoot) {
  if (which === 'G1') return g1Dashes(modRoot);
  const tree = parseTree(modRoot);
  try {
    switch (which) {
      case 'G2': return g2Hex(tree);
      case 'G3': return g3Environment(tree);
      case 'G4': return g4VisibleText(tree);
      case 'G5': return g5DeckUse(tree).bad;
      case 'G6': return g6Network(tree);
      case 'G7': return g7Style(tree);
      case 'G8': return g8Completeness(tree, modRoot);
      case 'G9': return g9Hotkeys(tree);
      case 'G11': return g11Ground(tree);
      case 'G12': return g12Roles(tree);
      case 'G13': return g13BarFill(tree);
      default: throw new Error('unknown guard ' + which);
    }
  } finally { tree.close(); }
}

// ---------- mutation arms (G10): one planted violation per guard, in a scratch copy ----------

function copyMod() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-sg-mut-'));
  const dest = path.join(tmp, 'mod');
  fs.cpSync(MOD, dest, {
    recursive: true,
    filter: (src) => {
      const r = rel(MOD, src);
      return path.basename(src) !== 'node_modules' && r !== '.claude-plugin/types' && !r.startsWith('.claude-plugin/types/');
    },
  });
  return { tmp, dest };
}
function plant(dest, relPath, content, mode) {
  const p = path.join(dest, relPath);
  must(mode === 'new' || fs.existsSync(p), 'mutation target missing: ' + relPath + ' (a guard that moved must fail loudly, never pass vacuously)');
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (mode === 'new') fs.writeFileSync(p, content);
  else fs.appendFileSync(p, content);
}
function replaceIn(dest, relPath, from, to) {
  const p = path.join(dest, relPath);
  const text = fs.readFileSync(p, 'utf8');
  must(text.includes(from), 'mutation anchor not found in ' + relPath + ': ' + from);
  fs.writeFileSync(p, text.replace(from, to));
}

const MUTATIONS = [
  ['G1', 'a long dash in the README', (d) => plant(d, 'README.md', '\nplanted ' + EM + ' dash\n', 'append')],
  ['G1', 'an en-dash in a source file', (d) => plant(d, 'src/zz-mutation.ts', '// planted ' + EN + ' dash\nexport const zzMutation = 1\n', 'new')],
  ['G2', 'a hex color literal', (d) => plant(d, 'src/zz-mutation.ts', "export const zzMutation = '#a1b2c3'\n", 'new')],
  ['G3', 'process.cwd()', (d) => plant(d, 'src/zz-mutation.ts', 'export const zzMutation = () => process.cwd()\n', 'new')],
  ['G3', 'a Node built-in import', (d) => plant(d, 'src/zz-mutation.ts', "import { readFileSync } from 'fs'\nexport const zzMutation = readFileSync\n", 'new')],
  ['G3', 'a $.fs.write', (d) => plant(d, 'src/zz-mutation.ts', 'export const zzMutation = ($: any) => $.fs.write("x", "y")\n', 'new')],
  ['G4', 'JSX text', (d) => plant(d, 'src/zz-mutation.tsx', "import { Text } from 'claude-code'\nexport const zzMutation = () => <Text>Hello there</Text>\n", 'new')],
  ['G4', 'a label string literal', (d) => plant(d, 'src/zz-mutation.tsx', "import { Button } from 'claude-code'\nexport const zzMutation = () => <Button label=\"Go on\" onPress={() => {}} />\n", 'new')],
  ['G4', 'a string literal child', (d) => plant(d, 'src/zz-mutation.tsx', "import { Text } from 'claude-code'\nexport const zzMutation = () => <Text>{'words here'}</Text>\n", 'new')],
  ['G4', 'text() with an id that is not in the deck', (d) => plant(d, 'src/zz-mutation.ts', "import { text } from './copy/text'\nexport const zzMutation = text('ZZ99')\n", 'new')],
  ['G5', 'a deck id nothing uses', (d) => replaceIn(d, 'src/copy/deck.ts', "'B01': 'M:OS',", "'B01': 'M:OS',\n  'Z99': 'planted unused',")],
  ['G6', 'a $.mcp.call in a new file', (d) => plant(d, 'src/zz-mutation.ts', "export const zzMutation = ($: any) => $.mcp.call('x', 'status_read', {})\n", 'new')],
  ['G6', 'gate_answer named outside the gate client', (d) => plant(d, 'src/zz-mutation.ts', "export const zzMutation = 'gate_answer'\n", 'new')],
  ['G6', 'an unaudited tool through mcpCall', (d) => plant(d, 'src/zz-mutation.ts', "import { MINDRIAN_SERVER } from './runtime/ids'\nexport const zzMutation = (io: any) => io.mcpCall(MINDRIAN_SERVER, 'brain_write', {})\n", 'new')],
  ['G6', 'mcpCall to a second server', (d) => plant(d, 'src/zz-mutation.ts', "export const zzMutation = (io: any) => io.mcpCall('other:server', 'status_read', {})\n", 'new')],
  ['G7', 'an italic prop', (d) => plant(d, 'src/zz-mutation.tsx', "import { Text } from 'claude-code'\nexport const zzMutation = () => <Text italic>{null}</Text>\n", 'new')],
  ['G7', 'a timer', (d) => plant(d, 'src/zz-mutation.ts', 'export const zzMutation = () => setTimeout(() => {}, 10)\n', 'new')],
  ['G7', 'a primary variant on a Button', (d) => plant(d, 'src/zz-mutation.tsx', "import { Button } from 'claude-code'\nexport const zzMutation = () => <Button label={null as never} variant=\"primary\" onPress={() => {}} />\n", 'new')],
  ['G7', 'a round border', (d) => plant(d, 'src/zz-mutation.tsx', "import { Box } from 'claude-code'\nexport const zzMutation = () => <Box borderStyle=\"round\">{null}</Box>\n", 'new')],
  ['G12', 'the evidence role drawn in a band file', (d) => plant(d, 'src/band/zz-mutation.ts', "export const zzMutation = (theme: any) => theme.evidence\n", 'new')],
  ['G12', 'the contradiction role drawn in a pane file', (d) => plant(d, 'src/pane/zz-mutation.ts', "export const zzMutation = () => 'contradiction'\n", 'new')],
  ['G12', 'the assumption role drawn in the decision card', (d) => plant(d, 'src/pane/review/zz-mutation.ts', "export const zzMutation = () => 'assumption'\n", 'new')],
  ['G7', 'logoGreen outside the logo', (d) => plant(d, 'src/zz-mutation.ts', 'export const zzMutation = (theme: any) => theme.logoGreen\n', 'new')],
  ['G7', 'gray_meta', (d) => plant(d, 'src/zz-mutation.ts', "export const zzMutation = 'gray_meta'\n", 'new')],
  ['G8', 'an undefined tab body', (d) => plant(d, 'src/pane/bodies/room.tsx', '\nexport const zzSeam: TabBody | undefined = undefined\n', 'append')],
  ['G8', 'a dependency field', (d) => {
    const p = path.join(d, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(p, 'utf8'));
    pkg.dependencies = { left: '1.0.0' };
    fs.writeFileSync(p, JSON.stringify(pkg, null, 2));
  }],
  ['G8', 'an empty registrar', (d) => plant(d, 'src/registrars/band.tsx', '// emptied\n', 'new')],
  ['G13', 'the bar fill drawn in the track job (black on black)', (d) => replaceIn(d, 'src/band/blocks.tsx', 'i < on ? (\n        <Box width={1} height={1} flexShrink={0} backgroundColor={theme.paper} />', 'i < on ? (\n        <Box width={1} height={1} flexShrink={0} backgroundColor={theme.structure} />')],
  ['G9', 'a multi-character hotkey', (d) => plant(d, 'src/zz-mutation.tsx', "import { Button } from 'claude-code'\nexport const zzMutation = () => <Button label={null as never} hotkey=\"Enter\" onPress={() => {}} />\n", 'new')],
  ['G9', 'an upper-case hotkey', (d) => plant(d, 'src/zz-mutation.tsx', "import { Button } from 'claude-code'\nexport const zzMutation = () => <Button label={null as never} hotkey=\"Q\" onPress={() => {}} />\n", 'new')],
  ['G11', 'a Button on the cream page (no ground)', (d) => plant(d, 'src/pane/zz-mutation.tsx', "import { Button } from 'claude-code'\nexport const zzMutation = () => <Button label={null as never} onPress={() => {}} />\n", 'new')],
  ['G11', 'a Button inside a Box that is not a ground', (d) => plant(d, 'src/pane/zz-mutation.tsx', "import { Box, Button } from 'claude-code'\nexport const zzMutation = () => <Box backgroundColor=\"x\"><Button label={null as never} onPress={() => {}} /></Box>\n", 'new')],
  ['G11', 'a Select outside a ground', (d) => plant(d, 'src/pane/zz-mutation.tsx', "import { Select } from 'claude-code'\nexport const zzMutation = () => <Select options={[]} value=\"a\" onSelect={() => {}} />\n", 'new')],
  ['G11', 'the ground taken off the real details button', (d) => replaceIn(d, 'src/pane/details-block.tsx', '<Box key="details-ground" {...ground(a.mode, a.theme)}>', '<Box key="details-ground">')],
  ['G11', 'dimColor on text on the cream page', (d) => plant(d, 'src/pane/zz-mutation.tsx', "import { Text } from 'claude-code'\nexport const zzMutation = () => <Text dimColor>{null}</Text>\n", 'new')],
  ['G11', 'the real consequence line made dim again', (d) => replaceIn(d, 'src/pane/review/proposal-card.tsx', '<Text {...soft(ctx.mode)} {...color}>\n          {consequence}', '<Text dimColor {...color}>\n          {consequence}')],
  ['G11', 'a dimColor property outside the ink helper', (d) => plant(d, 'src/pane/zz-mutation.ts', 'export const zzMutation = { dimColor: true }\n', 'new')],
  ['G11', 'a Button inside a cream Block in the band', (d) => plant(d, 'src/band/zz-mutation.tsx', "import { Button } from 'claude-code'\nimport { Block } from './blocks'\nexport const zzMutation = (el: any, theme: any, mode: any) => Block(el, { job: 'paper', theme, mode, children: [<Button label={null as never} onPress={() => {}} />] })\n", 'new')],
];

// ---------- main ----------

async function main() {
  process.stdout.write('369.26 source guards (plan 18, WS-17)\n');
  if (!fs.existsSync(path.join(MOD, 'src'))) {
    process.stdout.write('SKIPPED (ENV GAP): the mod is not at ' + MOD + '\n');
    process.exit(77);
  }
  if (!(await loadTs())) {
    process.stdout.write('SKIPPED (ENV GAP): the walled TypeScript is not installed. Run: npm --prefix tools/ts-check ci --ignore-scripts\n');
    process.exit(77);
  }

  // Real tree: parse once, run every guard.
  let tree;
  try {
    tree = parseTree(MOD);
  } catch (e) {
    process.stdout.write('SKIPPED (ENV GAP): the native compiler could not start (' + (e && e.message) + ')\n');
    process.exit(77);
  }
  let unusedIds = [];
  const reportBad = (bad) => { must(bad.length === 0, bad.length + ' violation(s):\n' + bad.join('\n')); };

  await scenario('G0 the tree parsed: source files found and the deck is readable', () => {
    must(tree.files.length >= 70, 'only ' + tree.files.length + ' source files parsed');
    const ids = deckIds(tree);
    must(ids && ids.size >= 150, 'the deck yielded ' + (ids && ids.size) + ' ids');
  });
  await scenario('G1 no em-dash or en-dash in any mod file', () => reportBad(g1Dashes(MOD)));
  await scenario('G2 no hex color literal in src/', () => reportBad(g2Hex(tree)));
  await scenario('G3 no require, import(), process, Node built-in, fetch or forbidden $ noun in src/', () => reportBad(g3Environment(tree)));
  await scenario('G4 every visible string is a deck id (no JSX text, no label/title/alt literal, no string child, every text() id exists)', () => reportBad(g4VisibleText(tree)));
  await scenario('G5 every deck id is used or allow-listed with a UI-SPEC reason', () => {
    const r = g5DeckUse(tree);
    unusedIds = r.unused;
    reportBad(r.bad);
  });
  await scenario('G6 MCP calls: only the audited tools, gate_answer and gate_render only in the gate client, no second server', () => reportBad(g6Network(tree)));
  await scenario('G6b the Canon Part 8 proof (plan 16) is still a leg of the aggregator and exists', () => {
    must(fs.existsSync(path.join(REPO, 'tests', 'test-369.26-part8.cjs')), 'tests/test-369.26-part8.cjs is missing');
    const agg = fs.readFileSync(path.join(REPO, 'tests', 'run-all-369.26.sh'), 'utf8');
    must(/test-369\.26-part8\.cjs/.test(agg), 'run-all-369.26.sh no longer names the Part 8 leg');
    must(/test-369\.26-source-guards\.cjs/.test(agg), 'run-all-369.26.sh no longer names this file');
  });
  await scenario('G7 no italic, underline, strikethrough, timer, animation or gray_meta; logoGreen only in the theme; no primary variant or round border', () => reportBad(g7Style(tree)));
  await scenario('G8 all four tab bodies defined, no dependency fields, every registrar registers something', () => reportBad(g8Completeness(tree, MOD)));
  await scenario('G9 every hotkey literal is one character in 0-9 or a-z', () => reportBad(g9Hotkeys(tree)));
  await scenario('G12 role lock: evidence, contradiction and assumption are drawn only in their role files', () => reportBad(g12Roles(tree)));
  await scenario('G13 the context bar fill never takes the job of the track behind it (F4)', () => reportBad(g13BarFill(tree)));
  await scenario('G11 every pane Button and Select sits in a Box that spreads ground(); no dimColor on the cream page; no Button in a cream band Block', () => reportBad(g11Ground(tree)));
  tree.close();

  process.stdout.write('  deck ids never referenced (' + unusedIds.length + '), each allow-listed above with its reason:\n');
  for (const id of unusedIds) process.stdout.write('    ' + id + ': ' + (UNUSED_DECK_ALLOW[id] || '(NOT ALLOW-LISTED)') + '\n');

  // G10: mutation arms. Each plants one violation in a scratch copy and the matching guard must report it.
  for (const [guard, label, mutate] of MUTATIONS) {
    await scenario('G10 mutation: ' + guard + ' reports ' + label, () => {
      const { tmp, dest } = copyMod();
      try {
        const before = runGuard(guard, dest);
        mutate(dest);
        const after = runGuard(guard, dest);
        must(after.length > before.length, 'planted ' + label + ' and ' + guard + ' did NOT report it (' + before.length + ' before, ' + after.length + ' after)');
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });
  }

  process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  process.stdout.write('FATAL ' + (e && e.stack || e) + '\n');
  process.exit(1);
});

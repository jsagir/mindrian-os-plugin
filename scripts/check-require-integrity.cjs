#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 366 Plan 23 (EPV366-29, ADR-E12) - scripts/check-require-integrity.cjs
 *
 * The reference-integrity gate. It answers one question: does every static
 * code reference under lib/, scripts/, hooks/, bin/ and tests/ point at a file
 * that exists? It runs before and after any move of a module, so a moved path
 * that would break a hook or a test at runtime fails here first.
 *
 * WHAT COUNTS AS A REFERENCE (JavaScript files: .cjs, .js, .mjs). The file is
 * first masked by a small lexer: comments drop out and every string literal is
 * set aside, so code that only lives INSIDE a string (a test planting a file
 * body) never counts. Then, in the argument span of each call:
 *   R1  require('<rel>') and require.resolve('<rel>') where <rel> starts with
 *       ./ or ../ (resolved from the file's own folder).
 *   R2  require(path.join(BASE, '<seg>', ...)) / path.resolve(...), and
 *       require(NAME) where `const NAME = path.join(BASE, '<seg>', ...)`.
 *       BASE is __dirname or an identifier the file binds to a
 *       __dirname-relative folder (`const ROOT = path.resolve(__dirname, '..')`);
 *       any other BASE (a temp dir, a variable root) is counted as unchecked.
 *   R3  spawn / spawnSync / exec / execSync / execFile / execFileSync / fork:
 *       a quoted 'lib/...', 'scripts/...', 'hooks/...', 'bin/...' or
 *       'tests/...' literal ending in .cjs / .js / .mjs (a repo-root argv), a
 *       path.join(BASE, ...) naming a script, or a NAME declared as one.
 *   Resolution follows require: the path as given, then .cjs, .js, .json,
 *   then <dir>/index.cjs and <dir>/index.js.
 *   A require whose argument cannot be resolved statically (a variable, a
 *   concatenation, a template with expressions) is counted as `unchecked`,
 *   never as a failure. A path.join used only to read, write or test for a
 *   file (fs.existsSync, a scratch file a test creates) is not a reference.
 *
 * SKIPPED: node_modules, .git, tests/fixtures (planted fixture trees carry
 * deliberately foreign or broken code) and any folder named fixtures, and the
 * generated data/ and dist/ trees (never scanned: they are outside the five
 * scanned folders).
 *
 * CLI: node scripts/check-require-integrity.cjs [--root <dir>] [--json]
 *   --root  the tree to scan (default: this repo). The five folders are read
 *           under it.
 *   --json  print { root, files, checked, unchecked, failures:[{file, target}] }.
 *   Exit 0 when every checked reference resolves, 1 otherwise.
 *
 * T-366-96: the report names file paths and the missing target strings only;
 * it never prints file contents. Canon Part 8: local file reads only, no
 * network, no room data. CJS, no deps, hyphens only.
 */

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_ROOT = path.resolve(__dirname, '..');
const SCAN_DIRS = ['lib', 'scripts', 'hooks', 'bin', 'tests'];
const SKIP_DIRS = new Set(['node_modules', '.git', 'fixtures']);
const CODE_EXT = /\.(cjs|js|mjs)$/;
const RESOLVE_SUFFIXES = ['', '.cjs', '.js', '.json', '/index.cjs', '/index.js'];

function walk(dir, out) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return out; }
  ents.forEach(function (e) {
    if (SKIP_DIRS.has(e.name)) return;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile() && CODE_EXT.test(e.name)) out.push(p);
  });
  return out;
}

function resolves(abs) {
  for (let i = 0; i < RESOLVE_SUFFIXES.length; i += 1) {
    const cand = abs + RESOLVE_SUFFIXES[i];
    try {
      const st = fs.statSync(cand);
      if (st.isFile()) return true;
    } catch (_e) { /* next suffix */ }
  }
  return false;
}

// mask(text) -> { code, strs, spans }. A small JavaScript lexer: comments become
// spaces, every string or template literal becomes the placeholder \u0001<n>\u0001
// (its value kept in strs[n]), regex literals become spaces. Line breaks are
// kept so line structure survives. Code that only lives INSIDE a string (a test
// planting a file body) is therefore invisible to the reference patterns.
// spans[n] is { start, end, quote }: the literal's offsets in the original
// text (the 366-23 codemod rewrites through them).
function mask(text) {
  const out = [];
  const strs = [];
  const spans = [];
  let i = 0;
  const n = text.length;
  let lastSig = '';
  function blank(s) { return s.replace(/[^\n]/g, ' '); }
  while (i < n) {
    const c = text[i];
    const c2 = text[i + 1];
    if (c === '/' && c2 === '/') {
      let j = text.indexOf('\n', i);
      if (j === -1) j = n;
      out.push(blank(text.slice(i, j)));
      i = j;
      continue;
    }
    if (c === '/' && c2 === '*') {
      let j = text.indexOf('*/', i + 2);
      j = j === -1 ? n : j + 2;
      out.push(blank(text.slice(i, j)));
      i = j;
      continue;
    }
    if (c === '\'' || c === '"' || c === '`') {
      let j = i + 1;
      let val = '';
      let nl = '';
      while (j < n && text[j] !== c) {
        if (text[j] === '\\') { val += text[j + 1] || ''; j += 2; continue; }
        if (c !== '`' && text[j] === '\n') break; // unterminated: stop at line end
        if (text[j] === '\n') nl += '\n';
        val += text[j];
        j += 1;
      }
      const isTemplateExpr = c === '`' && val.indexOf('${') !== -1;
      strs.push(isTemplateExpr ? null : val);
      spans.push({ start: i, end: j + 1, quote: c });
      out.push('\u0001' + (strs.length - 1) + '\u0001' + nl);
      i = j + 1;
      lastSig = 'S';
      continue;
    }
    if (c === '/' && (lastSig === '' || /[(,=:[!&|?{};+\-*%<>~^]/.test(lastSig) || /\b(return|typeof|case|in|of|delete|void|throw)$/.test(out.join('').slice(-12).trimEnd()))) {
      // a regex literal: skip to the closing slash outside a class
      let j = i + 1;
      let inClass = false;
      while (j < n && text[j] !== '\n') {
        if (text[j] === '\\') { j += 2; continue; }
        if (text[j] === '[') inClass = true;
        else if (text[j] === ']') inClass = false;
        else if (text[j] === '/' && !inClass) break;
        j += 1;
      }
      j += 1;
      while (j < n && /[a-z]/i.test(text[j])) j += 1;
      out.push(blank(text.slice(i, j)));
      i = j;
      lastSig = 'R';
      continue;
    }
    out.push(c);
    if (!/\s/.test(c)) lastSig = c;
    i += 1;
  }
  return { code: out.join(''), strs: strs, spans: spans };
}

const STR = '\\u0001(\\d+)\\u0001';
const RE_ONLY_STR = new RegExp('^\\s*' + STR + '\\s*$');
const RE_ONLY_IDENT = /^\s*([A-Za-z_$][\w$]*)\s*$/;
const RE_ROOT_DECL = new RegExp('\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*path\\.(?:resolve|join)\\(\\s*__dirname\\s*((?:,\\s*' + STR + '\\s*)*)\\)', 'g');
const RE_PATH_DECL = new RegExp('\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*path\\.(?:join|resolve)\\(\\s*([A-Za-z_$][\\w$]*)\\s*((?:,\\s*' + STR + '\\s*)+)\\)', 'g');
const RE_PATH_CALL = new RegExp('\\bpath\\.(?:join|resolve)\\(\\s*([A-Za-z_$][\\w$]*)\\s*((?:,\\s*' + STR + '\\s*)+)\\)', 'g');
const RE_STR_ALL = new RegExp(STR, 'g');
const RE_CALL_OPEN = /\b(require\.resolve|require|spawnSync|spawn|execFileSync|execFile|execSync|exec|fork)\s*\(/g;
const RE_REPO_SCRIPT = /^(?:\.\/)?(?:lib|scripts|hooks|bin|tests)\/[^\s'"`]+\.(?:cjs|js|mjs)$/;
const RE_CODE_FILE = /\.(?:cjs|js|mjs)$/;

function strsIn(argText, strs) {
  const vals = [];
  let s;
  RE_STR_ALL.lastIndex = 0;
  while ((s = RE_STR_ALL.exec(argText)) !== null) vals.push(strs[Number(s[1])]);
  return vals;
}

// The argument text of a call whose open paren sits at `open`, up to its
// balanced close (strings are masked, so parens inside them never count).
function argSpan(code, open) {
  let depth = 0;
  for (let i = open; i < code.length; i += 1) {
    const c = code[i];
    if (c === '(') depth += 1;
    else if (c === ')') { depth -= 1; if (depth === 0) return code.slice(open + 1, i); }
  }
  return code.slice(open + 1);
}

function scanFile(abs, root, acc) {
  const rel = path.relative(root, abs).split(path.sep).join('/');
  let text;
  try { text = fs.readFileSync(abs, 'utf8'); } catch (_e) { return; }
  if (text.charCodeAt(0) === 0x23) text = text.replace(/^#![^\n]*/, ''); // shebang
  const dir = path.dirname(abs);
  const m0 = mask(text);
  const code = m0.code;
  const strs = m0.strs;
  function fail(target) { acc.failures.push({ file: rel, target: target }); }

  // Identifiers bound to __dirname-relative folders (const ROOT = path.resolve(__dirname, '..')).
  const bases = { __dirname: dir };
  let m;
  RE_ROOT_DECL.lastIndex = 0;
  while ((m = RE_ROOT_DECL.exec(code)) !== null) {
    const segs = strsIn(m[2], strs);
    if (segs.some(function (v) { return v === null; })) continue;
    bases[m[1]] = path.resolve.apply(path, [dir].concat(segs));
  }
  // Identifiers bound to a literal path under a known base (const SCRIPT =
  // path.join(ROOT, 'scripts', 'x.cjs')): checked only when that identifier
  // is later required or spawned.
  const decls = {};
  RE_PATH_DECL.lastIndex = 0;
  while ((m = RE_PATH_DECL.exec(code)) !== null) {
    const segs = strsIn(m[3], strs);
    if (!segs.length || segs.some(function (v) { return v === null; })) continue;
    decls[m[1]] = { base: m[2], segs: segs };
  }

  function checkPathJoin(baseName, segs, allowJson) {
    const last = segs[segs.length - 1];
    if (!RE_CODE_FILE.test(last) && !(allowJson && /\.json$/.test(last))) return;
    const base = bases[baseName];
    if (!base) { acc.unchecked += 1; return; }
    acc.checked += 1;
    if (!resolves(path.resolve.apply(path, [base].concat(segs)))) fail(segs.join('/'));
  }
  function checkPathCallsIn(span, allowJson) {
    let pc;
    let found = 0;
    RE_PATH_CALL.lastIndex = 0;
    while ((pc = RE_PATH_CALL.exec(span)) !== null) {
      const segs = strsIn(pc[2], strs);
      if (!segs.length || segs.some(function (v) { return v === null; })) { acc.unchecked += 1; found += 1; continue; }
      checkPathJoin(pc[1], segs, allowJson);
      found += 1;
    }
    return found;
  }

  RE_CALL_OPEN.lastIndex = 0;
  while ((m = RE_CALL_OPEN.exec(code)) !== null) {
    const fn = m[1];
    if (fn !== 'require' && fn !== 'require.resolve' && code[m.index - 1] === '.' && !/(?:cp|childProcess|child_process|child|proc)\.$/.test(code.slice(Math.max(0, m.index - 16), m.index))) {
      // a method named exec/spawn on some other object (a RegExp.exec, a db.exec): not a process spawn
      if (fn === 'exec' || fn === 'execSync') continue;
    }
    const open = m.index + m[0].length - 1;
    const span = argSpan(code, open);
    if (fn === 'require' || fn === 'require.resolve') {
      // R1: a plain relative string literal
      const only = span.match(RE_ONLY_STR);
      if (only) {
        const val = strs[Number(only[1])];
        if (val === null) { acc.unchecked += 1; continue; }
        if (val.indexOf('./') !== 0 && val.indexOf('../') !== 0) continue; // a package or a node: builtin
        acc.checked += 1;
        if (!resolves(path.resolve(dir, val))) fail(val);
        continue;
      }
      // R2: require(path.join(BASE, '<seg>', ...)) or require(NAME) of a declared path
      if (checkPathCallsIn(span, true) > 0) continue;
      const id = span.match(RE_ONLY_IDENT);
      if (id && decls[id[1]]) { checkPathJoin(decls[id[1]].base, decls[id[1]].segs, true); continue; }
      acc.unchecked += 1;
      continue;
    }
    // R3: a spawn / exec / fork call: repo-root script literals, path.join
    // script paths and declared script identifiers in its argument span.
    strsIn(span, strs).forEach(function (v) {
      if (v === null || !RE_REPO_SCRIPT.test(v)) return;
      acc.checked += 1;
      if (!resolves(path.resolve(root, v))) fail(v);
    });
    checkPathCallsIn(span, false);
    const idRe = /\b([A-Za-z_$][\w$]*)\b/g;
    let im;
    const seen = new Set();
    while ((im = idRe.exec(span)) !== null) {
      const name = im[1];
      if (seen.has(name) || !decls[name]) continue;
      seen.add(name);
      checkPathJoin(decls[name].base, decls[name].segs, false);
    }
  }
}

function checkTree(root) {
  const acc = { root: root, files: 0, checked: 0, unchecked: 0, failures: [] };
  SCAN_DIRS.forEach(function (d) {
    walk(path.join(root, d), []).forEach(function (abs) {
      acc.files += 1;
      scanFile(abs, root, acc);
    });
  });
  acc.failures.sort(function (a, b) { return a.file < b.file ? -1 : a.file > b.file ? 1 : (a.target < b.target ? -1 : 1); });
  return acc;
}

function main(argv) {
  let root = DEFAULT_ROOT;
  let json = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    switch (a) {
      case '--root': root = path.resolve(argv[i + 1] || '.'); i += 1; break;
      case '--json': json = true; break;
      case '-h':
      case '--help':
        process.stdout.write('usage: node scripts/check-require-integrity.cjs [--root <dir>] [--json]\n');
        return 0;
      default:
        process.stderr.write('check-require-integrity: unknown argument ' + JSON.stringify(String(a).slice(0, 40)) + '\n');
        return 2;
    }
  }
  const r = checkTree(root);
  if (json) {
    process.stdout.write(JSON.stringify(r, null, 2) + '\n');
  } else if (r.failures.length === 0) {
    process.stdout.write('check-require-integrity: OK (' + r.files + ' files, ' + r.checked + ' references resolve, ' + r.unchecked + ' unchecked dynamic)\n');
  } else {
    process.stdout.write('check-require-integrity: FAIL (' + r.failures.length + ' unresolved of ' + r.checked + ' checked, ' + r.files + ' files)\n');
    r.failures.forEach(function (f) { process.stdout.write('  ' + f.file + ' -> ' + f.target + '\n'); });
  }
  return r.failures.length === 0 ? 0 : 1;
}

module.exports = { checkTree, resolves, mask, argSpan, SCAN_DIRS };

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}

#!/usr/bin/env node
// Phase 388 plan 02 task 1: static runtime-need scanner. Read-only. Node built-ins only. Hyphens only.
// For each candidate of 388-candidates.tsv decide SAFE, NEEDED, UNCERTAIN or RULED-KEEP.
//
// Commands:
//   selftest                                    tests 1 to 8 (test 6 is a mutation that must flip a verdict)
//   scan --candidates FILE --root DIR --out FILE [--payload FILE]
//                                               write 388-safe-set.tsv (header row, then one row per candidate)
//   paths --list PATH...                        scan only the named paths (plan 388-04 uses this)
//
// Output columns: path, class, verdict, flags, evidence-count, first-evidence (file:line)
// Flags: DEV-ONLY, DATA-CITED-NOT-CHECKED, PAYLOAD-PINNED
// Evidence kinds: E1 path, E2 built path, E3 file name, E4 dynamic read, E5 doctor, E6 data citation, E7 payload pin.
// The reach scan comes from 388-measure.cjs (required, not copied).
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const M = require('./388-measure.cjs');

const posix = path.posix;
const DOCTOR_RE = /^(scripts\/doctor\.cjs|lib\/core\/doctor\/)/;
const SURFACE_MD = ['commands/', 'skills/', 'agents/', 'pipelines/', 'references/', 'templates/', 'output-styles/'];
const ROOT_VAR_RE = /^(?:pluginRoot|PLUGIN_ROOT|pluginDir|REPO_ROOT|REPO|ROOT|rootDir|root|packageRoot|PKG_ROOT|installRoot)$/i;
const DEFAULT_PIN_NAMES = [
  'build-desktop-artifact.cjs', 'check-release-payload-ceiling.cjs', 'shrinkwrap-gate.sh',
  'test-341-payload-ceiling.cjs', 'test-341-payload-shrinkwrap-present.cjs', 'test-369-walled-manifest.cjs',
  'test-369-installed-layout.cjs', 'test-369.1-desktop-artifact.cjs', 'test-369.1-bin-relocation.cjs',
  'test-369.1-sharp-out.cjs', 'test-380-installed-layout.cjs', 'test-quick-261106-critic-baseline-ships.cjs',
  'test-387-eureka-installed-layout.cjs',
];
// wider than the reach scan of plan 388-01: it also names fonts, images, query files and other non-code assets
const WIDE_TOKEN_RE = /[A-Za-z0-9_@.$\-/{}]*[A-Za-z0-9_\-]\.(?:cjs|mjs|js|ts|tsx|sh|py|json|jsonl|ndjson|md|mdx|html|htm|css|tsv|csv|txt|yml|yaml|toml|xml|cmd|wasm|node|db|sql|cypher|woff2|woff|ttf|otf|eot|png|jpg|jpeg|gif|svg|ico|webp|pdf|zip|tgz|pyc|lock|ini|cfg|conf|j2|hbs|ejs)\b/g;
const PACK_RE = /npm pack|pack --dry-run|['"]pack['"]\s*,\s*['"]--dry-run['"]|npm['"]\s*,\s*\[\s*['"]pack/;

// ---------------------------------------------------------------- text helpers

function lineStarts(text) {
  const a = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) a.push(i + 1);
  return a;
}
function lineAt(starts, pos) {
  let lo = 0, hi = starts.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= pos) lo = mid; else hi = mid - 1; }
  return lo + 1;
}

// split the top-level arguments of the call whose '(' is at text[open]
function splitArgs(text, open) {
  const args = [];
  let depth = 0, cur = '', q = null;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      cur += ch;
      if (ch === '\\') { cur += text[++i] || ''; continue; }
      if (ch === q) q = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { q = ch; cur += ch; continue; }
    if (ch === '(' || ch === '[' || ch === '{') { depth++; if (depth > 1) cur += ch; continue; }
    if (ch === ')' || ch === ']' || ch === '}') {
      depth--;
      if (depth === 0) { if (cur.trim() !== '') args.push(cur); return { args, end: i }; }
      cur += ch; continue;
    }
    if (ch === ',' && depth === 1) { args.push(cur); cur = ''; continue; }
    cur += ch;
  }
  return { args, end: text.length };
}

function unquote(a) {
  const m = /^(['"`])([^'"`]*)\1$/.exec(a.trim());
  return m ? m[2] : null;
}

// Resolve a directory expression to a payload-relative folder. Returns {dir, partial} or null.
function resolveDir(expr, text, atPos, rel, depth) {
  expr = String(expr).trim();
  if (depth < 0 || !expr) return null;
  let m;
  if (/CLAUDE_PLUGIN_ROOT|MINDRIAN_OS_ROOT/.test(expr) && !/^path\./.test(expr)) return { dir: '', partial: false };
  if ((m = /^path(?:\.posix)?\.(?:join|resolve)\s*\(/.exec(expr))) {
    const { args } = splitArgs(expr, expr.indexOf('(', m.index));
    let base = { dir: '', partial: false };
    const segs = [];
    let partial = false;
    for (let i = 0; i < args.length; i++) {
      const a = args[i].trim();
      const lit = unquote(a);
      if (i === 0 && lit === null) {
        base = resolveDir(a, text, atPos, rel, depth - 1);
        if (!base) return null;
        continue;
      }
      if (lit !== null) segs.push(lit); else { partial = true; break; }
    }
    let d = base.dir;
    for (const s of segs) d = posix.normalize(posix.join(d || '.', s));
    if (d === '.') d = '';
    if (d.startsWith('..')) return null;
    return { dir: d, partial: base.partial || partial };
  }
  if (expr === '__dirname' || /^path\.dirname\(\s*__filename\s*\)$/.test(expr)) {
    const d = posix.dirname(rel);
    return { dir: d === '.' ? '' : d, partial: false };
  }
  if (ROOT_VAR_RE.test(expr) || /^\w*root\w*\(\s*\)$/i.test(expr)) return { dir: '', partial: false };
  if ((m = /^`\$\{[^}]*\}\/?([^`$]*)`$/.exec(expr))) return { dir: m[1].replace(/\/+$/, ''), partial: false };
  const lit = unquote(expr);
  if (lit !== null) return /^[\w.\-/]+$/.test(lit) ? { dir: posix.normalize(lit).replace(/^\.$/, ''), partial: false } : null;
  if (/^[A-Za-z_$][\w$]*$/.test(expr)) {
    const re = new RegExp('(?:const|let|var)\\s+' + expr.replace(/\$/g, '\\$') + '\\s*=\\s*([^;]+);', 'g');
    const before = text.slice(0, atPos);
    let last = null, mm;
    while ((mm = re.exec(before))) last = mm;
    if (last) return resolveDir(last[1], text, atPos, rel, depth - 1);
    return null;
  }
  return null;
}

function filtersAround(text, pos) {
  const win = text.slice(Math.max(0, pos - 200), pos) + text.slice(pos, pos + 1800);
  const win30 = win.split('\n').slice(0, 36).join('\n');
  const out = [];
  let m;
  const endsRe = /endsWith\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = endsRe.exec(win30))) out.push({ k: 'end', v: m[1] });
  const startsRe = /startsWith\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = startsRe.exec(win30))) out.push({ k: 'start', v: m[1] });
  const extRe = /extname\([^)]*\)\s*(?:===?|!==?)\s*['"](\.[\w]+)['"]/g;
  while ((m = extRe.exec(win30))) out.push({ k: 'end', v: m[1] });
  const reRe = /\/((?:[^/\n\\]|\\.)+)\/[gimsuy]*\s*\.test\(|\.(?:match|test)\(\s*\/((?:[^/\n\\]|\\.)+)\//g;
  while ((m = reRe.exec(win30))) {
    const body = m[1] || m[2];
    for (const piece of body.match(/[A-Za-z0-9_-]{2,}/g) || []) out.push({ k: 'has', v: piece });
  }
  return out;
}
function filterCanMatch(filters, name) {
  if (!filters.length) return true;
  for (const f of filters) {
    if (f.k === 'end' && name.endsWith(f.v)) return true;
    if (f.k === 'start' && name.startsWith(f.v)) return true;
    if (f.k === 'has' && name.includes(f.v)) return true;
  }
  return false;
}

// ---------------------------------------------------------------- reader analysis

// Blank out comments (positions and line numbers stay). A comment never runs, so a name in a comment is not a read.
function stripComments(text, ext) {
  if (ext === '.sh' || ext === '.py' || ext === '') return text.split('\n').map((l) => (/^\s*#(?!!)/.test(l) ? ' '.repeat(l.length) : l)).join('\n');
  if (!['.cjs', '.js', '.mjs', '.ts', '.tsx'].includes(ext)) return text;
  const out = text.split('');
  let i = 0;
  const n = text.length;
  let q = null;
  while (i < n) {
    const ch = text[i], nx = text[i + 1];
    if (q) {
      if (ch === '\\') { i += 2; continue; }
      if (ch === q) q = null;
      else if (ch === '\n' && q !== '`') q = null;
      i++; continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { q = ch; i++; continue; }
    if (ch === '/' && nx === '/') { while (i < n && text[i] !== '\n') { out[i] = ' '; i++; } continue; }
    if (ch === '/' && nx === '*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      for (let k = i; k < stop; k++) if (text[k] !== '\n') out[k] = ' ';
      i = stop; continue;
    }
    i++;
  }
  return out.join('');
}

function syntaxOk(rel, text) {
  if (!/\.(cjs|js)$/.test(rel)) return true;
  if (/^\s*(import\s[^('"]|export\s)/m.test(text)) return true; // ES module source, not a CommonJS parse target
  try {
    new vm.Script('(function(exports,require,module,__filename,__dirname){' + text.replace(/^#!.*/, '') + '\n})', { filename: rel });
    return true;
  } catch (_) { return false; }
}

// dynamic sites of one reader: readdir / glob, spawn node with a variable script, require with a variable
function dynamicSites(rel, text, starts, idx) {
  const sites = [];
  const unresolved = [];
  let m;
  const rd = /\b(?:readdirSync|readdir|opendirSync|opendir|globSync|glob)\s*\(/g;
  while ((m = rd.exec(text))) {
    const open = text.indexOf('(', m.index);
    const { args } = splitArgs(text, open);
    if (!args.length) continue;
    const r = resolveDir(args[0], text, m.index, rel, 6);
    const line = lineAt(starts, m.index);
    if (!r) { unresolved.push({ type: 'readdir', line }); continue; }
    if (r.dir === '' && r.partial) { unresolved.push({ type: 'unbounded-readdir', line }); continue; }
    const around = text.slice(Math.max(0, m.index - 600), m.index + 900);
    const subtree = r.partial || /recursive\s*:\s*true|\bwalk\w*\s*\(|\brecurs\w*/i.test(around) || m[0].startsWith('glob');
    sites.push({ type: 'readdir', dir: r.dir, subtree, filters: filtersAround(text, m.index), line });
  }
  // spawn of node with a variable script, and require / import with a variable.
  // A fully literal path after resolution is covered by E2. An identifier that is a parameter of the
  // enclosing function is driven by call-site literals (E1 to E3 catch those): recorded as 'param'.
  // A variable path under the payload root with no folder prefix is 'unbounded': recorded, not promoted.
  const isParam = (id, pos) => {
    if (!/^[A-Za-z_$][\w$]*$/.test(id)) return false;
    const before = text.slice(Math.max(0, pos - 3000), pos);
    const re = /function\s*[\w$]*\s*\(([^)]*)\)|\(([^()]*)\)\s*=>|([A-Za-z_$][\w$]*)\s*=>/g;
    let last = null, mm2;
    while ((mm2 = re.exec(before))) last = mm2;
    if (!last) return false;
    const params = (last[1] || last[2] || last[3] || '');
    return new RegExp('(^|[\\s,({])' + id.replace(/\$/g, '\\$') + '([\\s,)=]|$)').test(params);
  };
  const siteFor = (expr, pos, type, exts) => {
    const line = lineAt(starts, pos);
    const e = expr.trim();
    if (unquote(e) !== null || e === '__filename' || e === 'process.argv[1]') return;
    if (/^[A-Za-z_$][\w$]*$/.test(e)) {
      const am = new RegExp('(?:const|let|var)\\s+' + e.replace(/\$/g, '\\$&') + '\\s*=\\s*([\'"`])([^\'"`]*)\\1').exec(text.slice(0, pos));
      if (am && /^[a-z]+:\/\//i.test(am[2])) return; // a URL, not a payload file
    }
    const full = resolveDir(e, text, pos, rel, 6);
    if (full && !full.partial) return; // fully literal: covered by E2
    if (isParam(e, pos)) { unresolved.push({ type: 'param-' + type, line }); return; }
    let r = full;
    if (!r) {
      const j = /^path(?:\.posix)?\.(?:join|resolve)\s*\(/.test(e) ? e.replace(/,[^,]*\)$/, ')') : null;
      r = j ? resolveDir(j, text, pos, rel, 6) : null;
    }
    if (!r) r = { dir: posix.dirname(rel) === '.' ? '' : posix.dirname(rel), partial: false };
    if (r.dir === '' && /^path(?:\.posix)?\.(?:join|resolve)\s*\(/.test(e)) { unresolved.push({ type: 'unbounded-' + type, line }); return; }
    if (r.partial || !full) {
      // table-driven: the reader names files of that folder as literals, so the variable takes values from a literal table (E1 to E3 cover them)
      const tableDriven = idx && M.extractEdgesDetailed(rel, text, idx, WIDE_TOKEN_RE).some((h) => posix.dirname(h.target) === (r.dir || '.') || (r.dir === '' && h.target.indexOf('/') === -1));
      if (tableDriven) { unresolved.push({ type: 'table-' + type, line }); return; }
    }
    sites.push({ type, dir: r.dir, subtree: !!r.partial, exts, filters: [], line });
  };
  const sp = /\b(?:spawnSync|spawn|execFileSync|execFile|fork)\s*\(/g;
  while ((m = sp.exec(text))) {
    const open = text.indexOf('(', m.index);
    const { args } = splitArgs(text, open);
    if (!args.length) continue;
    const a0 = args[0].trim();
    let scriptExpr = null;
    if (/^fork\s*\(/.test(m[0])) scriptExpr = a0;
    else if (/^(process\.execPath|['"`]node['"`]|nodeBin|NODE)$/.test(a0) && args[1]) {
      const a1 = args[1].trim();
      if (a1.startsWith('[')) {
        const inner = splitArgs(a1, 0).args;
        scriptExpr = inner.length ? inner[0].trim() : null;
        const first = unquote(scriptExpr || '') || '';
        if (/^-(e|p|-eval|-print)$/.test(first)) scriptExpr = null;
        else if (/^-/.test(first)) scriptExpr = inner[1] ? inner[1].trim() : null;
      } else if (/^[A-Za-z_$][\w$]*$/.test(a1)) {
        const am = new RegExp('(?:const|let|var)\\s+' + a1.replace(/\$/g, '\\$&') + '\\s*=\\s*(\\[)').exec(text.slice(0, m.index));
        if (am) { const inner = splitArgs(text, am.index + am[0].length - 1).args; scriptExpr = inner.length ? inner[0].trim() : null; } else scriptExpr = a1;
      } else scriptExpr = a1;
    }
    if (scriptExpr) siteFor(scriptExpr, m.index, 'spawn', ['.cjs', '.js', '.mjs', '.sh', '.py']);
  }
  const rq = /\b(?:require|import)\s*\(\s*(?!['"`)])/g;
  while ((m = rq.exec(text))) {
    const open = text.indexOf('(', m.index);
    const { args } = splitArgs(text, open);
    if (!args.length) continue;
    const a0 = args[0].trim();
    if (/^`[^`$]*`$/.test(a0)) continue;
    siteFor(a0, m.index, 'require', ['.cjs', '.js', '.mjs', '.ts', '.json']);
  }
  // path.join / path.resolve with a variable tail under a known payload folder
  const jn = /path(?:\.posix)?\.(?:join|resolve)\s*\(/g;
  const dirHasFiles = (d) => { const pre = d === '' ? '' : d + '/'; for (const p of idx.byPath) if (p.startsWith(pre)) return true; return false; };
  while ((m = jn.exec(text))) {
    const open = text.indexOf('(', m.index);
    const { args } = splitArgs(text, open);
    if (args.length < 2) continue;
    const isLit = (a) => unquote(a) !== null && !/\$\{/.test(a);
    let i = -1;
    for (let k = 1; k < args.length; k++) if (!isLit(args[k].trim())) { i = k; break; }
    if (i === -1) continue;
    const prefix = 'path.join(' + args.slice(0, i).join(',') + ')';
    const r = resolveDir(prefix, text, m.index, rel, 6);
    if (!r || r.dir === '' || r.partial) continue;
    if (!dirHasFiles(r.dir)) continue;
    const tail = args[i].trim();
    const line = lineAt(starts, m.index);
    if (isParam(tail, m.index)) { unresolved.push({ type: 'param-join', line }); continue; }
    const tableDriven = idx && M.extractEdgesDetailed(rel, text, idx, WIDE_TOKEN_RE).some((h) => posix.dirname(h.target) === r.dir);
    if (tableDriven) { unresolved.push({ type: 'table-join', line }); continue; }
    const extHint = /\.([A-Za-z0-9]{1,6})['"`]\s*$/.exec(args[args.length - 1].trim());
    sites.push({ type: 'join', dir: r.dir, subtree: false, exts: extHint ? ['.' + extHint[1]] : null, filters: [], line });
  }
  return { sites, unresolved };
}

// markdown surface: tokens only in code spans, fenced blocks, shell-looking lines, or after a root variable
function mdHits(rel, text, idx) {
  const starts = lineStarts(text);
  const hits = [];
  const lines = text.split('\n');
  let fence = false;
  let off = 0;
  const rootRe = /(?:CLAUDE_PLUGIN_ROOT|MINDRIAN_OS_ROOT|plugin_root)\}?\/([A-Za-z0-9_.\-/]+)/g;
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (/^\s*```/.test(ln)) { fence = !fence; off += ln.length + 1; continue; }
    const pieces = [];
    if (fence || /^\s*[$>]\s|^\s*(node|bash|sh|python3?)\s/.test(ln)) pieces.push(ln);
    else { const cs = ln.match(/`[^`]+`/g); if (cs) pieces.push(...cs); }
    for (const piece of pieces) {
      const toks = piece.match(new RegExp(WIDE_TOKEN_RE.source, 'g')) || [];
      for (const tok of toks) {
        if (M.stripLead(tok).indexOf('/') === -1) continue;
        const s = new Set();
        M.resolveToken(tok, rel, idx, s);
        for (const target of s) hits.push({ target, line: i + 1, kind: 'E1' });
      }
    }
    let m;
    while ((m = rootRe.exec(ln))) {
      const r = m[1].replace(/[.,;:)]+$/, '');
      const s = new Set();
      if (idx.byPath.has(r)) s.add(r); else if (/\.[A-Za-z0-9]+$/.test(r)) M.resolveToken(r, rel, idx, s);
      for (const target of s) hits.push({ target, line: i + 1, kind: 'E1' });
    }
    off += ln.length + 1;
  }
  void starts; void off;
  return hits;
}

// JSON key paths under which a candidate is cited (for E6)
function jsonCiteKeys(text, candBase) {
  const keys = new Set();
  let doc;
  try { doc = JSON.parse(text); } catch (_) { return keys; }
  const walk = (v, key) => {
    if (typeof v === 'string') { if (v.includes(candBase)) keys.add(key || '(root)'); return; }
    if (Array.isArray(v)) { for (const x of v) walk(x, key); return; }
    if (v && typeof v === 'object') for (const k of Object.keys(v)) walk(v[k], k);
  };
  walk(doc, '');
  return keys;
}

// ---------------------------------------------------------------- core scan

function scan(opts) {
  const root = opts.root;
  const payload = opts.payload;
  const cands = opts.candidates;
  const pathsAll = payload.map((f) => f.path);
  const idx = M.buildIndex(pathsAll);
  const an = M.analyze(payload, root);
  const textCache = new Map();
  const textOf = (rel) => { if (!textCache.has(rel)) textCache.set(rel, M.readText(root, rel)); return textCache.get(rel); };
  const candMap = new Map(cands.map((c) => [c.path, c]));
  const pinNames = new Set(opts.pinNames || DEFAULT_PIN_NAMES);

  // readers: payload text files
  const info = new Map(); // rel -> {hits, sites, unresolved, parseOk, kind}
  const analyzeReader = (rel) => {
    if (info.has(rel)) return info.get(rel);
    let text = textOf(rel);
    const rec = { hits: [], sites: [], unresolved: [], parseOk: true, kind: 'none' };
    info.set(rel, rec);
    if (!text) return rec;
    const ext = path.extname(rel);
    const rawText = text;
    text = (ext === '.json' || ext === '.md') ? text : stripComments(text, ext);
    const starts = lineStarts(text);

    if (ext === '.md') {
      if (SURFACE_MD.some((d) => rel.startsWith(d))) { rec.kind = 'md'; rec.hits = mdHits(rel, text, idx); }
    } else if (ext === '.json' && rel.startsWith('data/')) {
      rec.kind = 'data';
      for (const h of M.extractEdgesDetailed(rel, text, idx, WIDE_TOKEN_RE)) rec.hits.push({ target: h.target, line: lineAt(starts, h.pos), kind: 'E6' });
    } else if (M.CODE_EXT.has(ext) || ext === '' || ext === '.template' || ext === '.json' || rel.endsWith('run-hook.cmd')) {
      rec.kind = 'code';
      for (const h of M.extractEdgesDetailed(rel, text, idx, WIDE_TOKEN_RE)) rec.hits.push({ target: h.target, line: lineAt(starts, h.pos), kind: h.kind, via: h.via });
      if (M.CODE_EXT.has(ext) && ext !== '.py' && ext !== '.sh' && ext !== '.cmd') {
        rec.parseOk = syntaxOk(rel, rawText);
        const d = dynamicSites(rel, text, starts, idx);
        rec.sites = d.sites; rec.unresolved = d.unresolved;
      }
    }
    return rec;
  };

  // dev-only readers on disk (not shipped)
  const devReaders = [];
  const addDev = (rel) => { if (fs.existsSync(path.join(root, rel))) devReaders.push(rel); };
  const walkDev = (dir) => {
    const abs = path.join(root, dir);
    if (!fs.existsSync(abs)) return;
    for (const n of fs.readdirSync(abs, { withFileTypes: true })) {
      const rel = dir + '/' + n.name;
      if (n.isDirectory()) { if (n.name !== 'node_modules') walkDev(rel); } else if (/\.(cjs|js|mjs|sh|json|ts)$/.test(n.name) || n.name === 'verify-release') devReaders.push(rel);
    }
  };
  for (const d of opts.devReaderRoots || ['scripts/release-lib', 'tests']) walkDev(d);
  for (const f of opts.devReaderFiles || ['scripts/release.sh', 'scripts/verify-release']) addDev(f);
  const devInfo = new Map();
  const devAnalyze = (rel) => {
    if (devInfo.has(rel)) return devInfo.get(rel);
    let text = null;
    try { const st = fs.statSync(path.join(root, rel)); if (st.size <= 2 * 1024 * 1024) text = fs.readFileSync(path.join(root, rel), 'utf8'); } catch (_) { /* skip */ }
    const rec = { hits: [], pin: false };
    if (text) {
      const starts = lineStarts(text);
      for (const h of M.extractEdgesDetailed(rel, text, idx, WIDE_TOKEN_RE)) rec.hits.push({ target: h.target, line: lineAt(starts, h.pos), kind: h.kind });
      rec.pin = pinNames.has(posix.basename(rel)) || PACK_RE.test(text);
    }
    devInfo.set(rel, rec);
    return rec;
  };

  const needed = new Map(); // cand -> evidence list (E1,E2,E3,E5,E6check)
  const uncertain = new Map();
  const flagsOf = new Map();
  const addTo = (m, k, ev) => { if (!m.has(k)) m.set(k, []); m.get(k).push(ev); };
  const addFlag = (k, f, ev) => { if (!flagsOf.has(k)) flagsOf.set(k, new Map()); const fm = flagsOf.get(k); if (!fm.has(f)) fm.set(f, []); fm.get(f).push(ev); };

  // dev-only readers
  for (const rel of devReaders) {
    const rec = devAnalyze(rel);
    for (const h of rec.hits) {
      if (!candMap.has(h.target) || h.target === rel) continue;
      addFlag(h.target, 'DEV-ONLY', rel + ':' + h.line);
      if (rec.pin) addFlag(h.target, 'PAYLOAD-PINNED', rel + ':' + h.line);
    }
  }

  // runtime readers, fixed point over candidates that become NEEDED
  const isCandidateReader = (rel) => candMap.has(rel);
  const runtimeSet = new Set([...an.runtime, ...an.roots]);
  for (const p of pathsAll) if (DOCTOR_RE.test(p)) runtimeSet.add(p);
  // surfaces that Claude invokes are readers too: every payload file under an invocable folder and the surface markdown
  for (const p of pathsAll) if (M.PROTECTED_PREFIXES.some((x) => p.startsWith(x)) || SURFACE_MD.some((d) => p.startsWith(d))) runtimeSet.add(p);
  const active = new Set([...runtimeSet].filter((r) => !isCandidateReader(r)));
  const processed = new Set();
  const parseFails = [];
  const dataSources = new Set(pathsAll.filter((p) => p.startsWith('data/') && p.endsWith('.json') && !candMap.has(p)));
  const decidedNeeded = new Set();
  const flagged = new Set();
  const readerSites = (rel) => analyzeReader(rel).sites || [];
  const readersOfData = (d) => {
    const out = [];
    const dd = posix.dirname(d);
    for (const rel of active) {
      const rec = analyzeReader(rel);
      if (rec.kind !== 'code' && rec.kind !== 'md') continue;
      if (rec.hits.some((h) => h.target === d) || readerSites(rel).some((st) => st.type === 'readdir' && (st.dir === dd || (st.subtree && dd.startsWith(st.dir + '/'))))) out.push(rel);
    }
    return out;
  };
  let outer = true;
  while (outer) {
    outer = false;
    let progress = true;
    while (progress) {
      progress = false;
      for (const rel of [...active]) {
        if (processed.has(rel)) continue;
        processed.add(rel);
        progress = true;
        const rec = analyzeReader(rel);
        if (!rec.parseOk) parseFails.push(rel);
        const isDoctor = DOCTOR_RE.test(rel);
        const promoted = isCandidateReader(rel);
        for (const h of rec.hits) {
          if (h.target === rel || !candMap.has(h.target)) continue;
          if (promoted && h.via === 'token') continue; // a NEEDED candidate loads what it requires, a name in its text is not a load
          if (rec.kind === 'data') continue; // data files are handled by the E6 pass
          addTo(needed, h.target, { ev: rel + ':' + h.line, kind: isDoctor ? 'E5' : h.kind });
        }
        for (const st of rec.sites) {
          for (const c of cands) {
            const cdir = posix.dirname(c.path) === '.' ? '' : posix.dirname(c.path);
            const inDir = st.dir === '' ? (st.subtree || cdir === '') : cdir === st.dir || (st.subtree && cdir.startsWith(st.dir + '/'));
            if (!inDir || c.path === rel) continue;
            const name = posix.basename(c.path);
            if (st.exts && !st.exts.includes(path.extname(name))) continue;
            if (!filterCanMatch(st.filters, name)) continue;
            addTo(uncertain, c.path, { ev: rel + ':' + st.line, kind: 'E4' });
          }
        }
      }
      for (const c of needed.keys()) if (!active.has(c) && candMap.get(c).cls !== 'T8') { active.add(c); }
    }
    // E6 pass: a data file that cites a candidate. A reader that tests, spawns, requires or reads the cited file
    // near the field name makes the candidate NEEDED. Otherwise the citation is only parsed: DATA-CITED-NOT-CHECKED.
    for (const c of [...needed.keys(), ...uncertain.keys()]) if (candMap.get(c).path.startsWith('data/') && c.endsWith('.json') && candMap.get(c).cls !== 'T8') dataSources.add(c);
    for (const d of [...dataSources]) {
      const rec = analyzeReader(d);
      const dtext = textOf(d) || '';
      for (const h of rec.hits) {
        if (!candMap.has(h.target) || h.target === d) continue;
        const key = d + '|' + h.target;
        if (decidedNeeded.has(key)) continue;
        const keys = jsonCiteKeys(dtext, posix.basename(h.target));
        let checked = null;
        for (const rd of readersOfData(d)) {
          const t = textOf(rd) || '';
          for (const k of keys) {
            if (k === '(root)' || k === '') continue;
            // property access only (policy.runner, p['runner']): a quoted name in an allow-list is parsing, not use
            const re = new RegExp('(?:\\.|\\[[\'"])' + k.replace(/[^\w]/g, '') + '\\b', 'g');
            let km;
            while ((km = re.exec(t))) {
              const win = t.slice(Math.max(0, km.index - 1500), km.index + 1500);
              if (/existsSync|statSync|accessSync|fs\.access|lstatSync|spawnSync|spawn\(|execFile|require\(|readFileSync/.test(win)) { checked = rd + ':' + lineAt(lineStarts(t), km.index); break; }
            }
            if (checked) break;
          }
          if (checked) break;
        }
        if (checked) { decidedNeeded.add(key); addTo(needed, h.target, { ev: checked + ' (via ' + d + ')', kind: 'E6' }); outer = true; }
        else if (!flagged.has(key)) { flagged.add(key); addFlag(h.target, 'DATA-CITED-NOT-CHECKED', d + ':' + h.line); }
      }
    }
    for (const c of needed.keys()) if (!active.has(c) && candMap.get(c).cls !== 'T8') { active.add(c); outer = true; }
  }
  // unparseable reader: the candidates of the same folder are UNCERTAIN
  for (const rel of parseFails) {
    const d = posix.dirname(rel);
    for (const c of cands) if ((posix.dirname(c.path) === d) && c.path !== rel) addTo(uncertain, c.path, { ev: rel + ':1', kind: 'E4' });
    console.error('UNPARSEABLE reader: ' + rel);
  }

  // verdicts
  const rows = [];
  for (const c of cands) {
    const nd = needed.get(c.path) || [];
    const un = uncertain.get(c.path) || [];
    const fl = flagsOf.get(c.path) || new Map();
    let verdict;
    let ev = [];
    if (c.cls === 'T8') { verdict = 'RULED-KEEP'; ev = nd.concat(un); }
    else if (nd.length) { verdict = 'NEEDED'; ev = nd; }
    else if (un.length) { verdict = 'UNCERTAIN'; ev = un; }
    else verdict = 'SAFE';
    const flags = [];
    for (const f of ['DEV-ONLY', 'DATA-CITED-NOT-CHECKED', 'PAYLOAD-PINNED']) if (fl.has(f)) flags.push(f);
    let first = '-';
    if (ev.length) first = ev[0].kind + ' ' + ev[0].ev;
    else if (flags.length) first = flags[0] + ' ' + fl.get(flags[0])[0];
    if (flags.includes('PAYLOAD-PINNED')) {
      const names = [...new Set(fl.get('PAYLOAD-PINNED').map((e) => e.replace(/:\d+$/, '')))].slice(0, 3);
      first += ' | pinned-by ' + names.join(',');
    }
    rows.push({ path: c.path, cls: c.cls, verdict, flags: flags.join(',') || '-', count: ev.length + (flags.length ? 0 : 0), first, ev, fl });
  }
  return { rows, parseFails, unresolved: [...info.entries()].filter(([r, v]) => active.has(r) && v.unresolved.length).map(([r, v]) => ({ reader: r, lines: v.unresolved.map((u) => u.line) })) };
}

function writeSafeSet(file, rows) {
  const lines = ['path\tclass\tverdict\tflags\tevidence-count\tfirst-evidence'];
  for (const r of rows) lines.push([r.path, r.cls, r.verdict, r.flags, r.count, r.first].join('\t'));
  fs.writeFileSync(file, lines.join('\n') + '\n');
}

// ---------------------------------------------------------------- selftest

function selftest() {
  const failures = [];
  const eq = (a, b, msg) => { if (JSON.stringify(a) !== JSON.stringify(b)) failures.push(msg + ': got ' + JSON.stringify(a) + ' expected ' + JSON.stringify(b)); };
  const mkTree = (spec) => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos388-scan-'));
    for (const [rel, content] of Object.entries(spec)) { const a = path.join(tmp, rel); fs.mkdirSync(path.dirname(a), { recursive: true }); fs.writeFileSync(a, content); }
    return tmp;
  };
  const HOOKS = JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'node "${CLAUDE_PLUGIN_ROOT}/scripts/hook.cjs"' }] }] } });
  const payloadOf = (tmp, skip) => {
    const out = [];
    const walk = (d, pre) => { for (const n of fs.readdirSync(d)) { const a = path.join(d, n); const rel = pre ? pre + '/' + n : n; if (fs.statSync(a).isDirectory()) walk(a, rel); else if (!skip || !skip(rel)) out.push({ path: rel, size: fs.statSync(a).size }); } };
    walk(tmp, '');
    return out;
  };
  const run = (spec, candSpec, extra) => {
    const tmp = mkTree(spec);
    try {
      const payload = payloadOf(tmp, (rel) => rel.startsWith('tests/') || rel.startsWith('docs/') || rel === 'scripts/release.sh');
      const cands = candSpec.map(([p, cls]) => ({ path: p, bytes: 1, cls }));
      const res = scan(Object.assign({ root: tmp, payload, candidates: cands, devReaderRoots: ['tests'], devReaderFiles: ['scripts/release.sh'] }, extra || {}));
      return Object.fromEntries(res.rows.map((r) => [r.path, r]));
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  };
  const origErr = console.error; console.error = () => {};
  try {
    // test 1
    let r = run({ 'hooks/hooks.json': HOOKS, 'scripts/hook.cjs': "const a = require('../lib/a.test.cjs');\n", 'lib/a.test.cjs': 'x' }, [['lib/a.test.cjs', 'T1']]);
    eq([r['lib/a.test.cjs'].verdict, /scripts\/hook\.cjs:1/.test(r['lib/a.test.cjs'].first)], ['NEEDED', true], 'test 1');
    // test 2
    r = run({ 'hooks/hooks.json': HOOKS, 'scripts/hook.cjs': "const p = require('path'); const b = p.join(__dirname, '..', 'lib', 'b.test.cjs');\n", 'lib/b.test.cjs': 'x' }, [['lib/b.test.cjs', 'T1']]);
    eq(r['lib/b.test.cjs'].verdict, 'NEEDED', 'test 2');
    // test 3
    r = run({ 'hooks/hooks.json': HOOKS, 'scripts/hook.cjs': "const fs = require('fs'); const path = require('path');\nconst libDir = path.join(__dirname, '..', 'lib');\nconst names = fs.readdirSync(libDir).filter((n) => n.endsWith('.test.cjs'));\n", 'lib/m.test.cjs': 'x', 'lib/n.test.cjs': 'x', 'lib/keep.json': '{}' },
      [['lib/m.test.cjs', 'T1'], ['lib/n.test.cjs', 'T1'], ['lib/keep.json', 'T7']]);
    eq([r['lib/m.test.cjs'].verdict, r['lib/n.test.cjs'].verdict, r['lib/keep.json'].verdict], ['UNCERTAIN', 'UNCERTAIN', 'SAFE'], 'test 3 (the filter cannot match keep.json)');
    // test 4
    r = run({ 'hooks/hooks.json': HOOKS, 'scripts/hook.cjs': 'module.exports = 1;\n', 'docs/readme.md': 'see `lib/c.test.cjs` and lib/c.test.cjs\n', 'lib/c.test.cjs': 'x', 'lib/d.test.cjs': 'x', 'commands/x.md': 'Run `node ${CLAUDE_PLUGIN_ROOT}/lib/d.test.cjs`\n' },
      [['lib/c.test.cjs', 'T1'], ['lib/d.test.cjs', 'T1']]);
    eq([r['lib/c.test.cjs'].verdict, r['lib/d.test.cjs'].verdict], ['SAFE', 'NEEDED'], 'test 4');
    // test 5
    r = run({ 'hooks/hooks.json': HOOKS, 'scripts/hook.cjs': 'module.exports = 1;\n', 'scripts/release.sh': 'node scripts/e.cjs\n', 'tests/test-e.cjs': "require('../scripts/e.cjs');\n", 'scripts/e.cjs': 'x' }, [['scripts/e.cjs', 'T7']]);
    eq([r['scripts/e.cjs'].verdict, r['scripts/e.cjs'].flags], ['SAFE', 'DEV-ONLY'], 'test 5');
    // test 6 mutation: without the planted reader the verdict must flip to SAFE
    const spec6 = { 'hooks/hooks.json': HOOKS, 'scripts/hook.cjs': "const a = require('../lib/a.test.cjs');\n", 'lib/a.test.cjs': 'x' };
    const withReader = run(spec6, [['lib/a.test.cjs', 'T1']])['lib/a.test.cjs'].verdict;
    const without = run(Object.assign({}, spec6, { 'scripts/hook.cjs': 'module.exports = 1;\n' }), [['lib/a.test.cjs', 'T1']])['lib/a.test.cjs'].verdict;
    eq([withReader, without], ['NEEDED', 'SAFE'], 'test 6 mutation flip');
    // test 7
    r = run({ 'hooks/hooks.json': HOOKS, 'scripts/hook.cjs': "require('../lib/h.cjs');\n", 'lib/h.cjs': 'x' }, [['lib/h.cjs', 'T8']]);
    eq(r['lib/h.cjs'].verdict, 'RULED-KEEP', 'test 7');
    // test 8
    r = run({ 'hooks/hooks.json': HOOKS, 'scripts/hook.cjs': 'module.exports = 1;\n', 'tests/test-pin.cjs': "// npm pack payload check\nconst need = ['lib/p.test.cjs'];\n", 'lib/p.test.cjs': 'x' }, [['lib/p.test.cjs', 'T1']]);
    eq([r['lib/p.test.cjs'].verdict, /PAYLOAD-PINNED/.test(r['lib/p.test.cjs'].flags), /test-pin\.cjs/.test(r['lib/p.test.cjs'].first)], ['SAFE', true, true], 'test 8');
  } catch (e) {
    failures.push('selftest crashed: ' + e.stack);
  } finally { console.error = origErr; }
  if (failures.length) { for (const f of failures) console.error('FAIL ' + f); return 1; }
  console.log('runtime-need-scan selftest: 8 tests passed (test 6 flipped NEEDED to SAFE when the planted reader was removed)');
  return 0;
}

// ---------------------------------------------------------------- cli

function arg(name) { const i = process.argv.indexOf(name); return i === -1 ? null : process.argv[i + 1]; }

function main() {
  const cmd = process.argv[2];
  if (cmd === 'selftest') process.exit(selftest());
  if (cmd === 'scan') {
    const candFile = path.resolve(arg('--candidates'));
    const root = path.resolve(arg('--root') || M.REPO);
    const out = path.resolve(arg('--out'));
    const payloadFile = arg('--payload') ? path.resolve(arg('--payload')) : path.join(path.dirname(candFile), '388-pack-baseline.tsv');
    const payload = M.readBaseline(payloadFile).files;
    const candidates = M.readCandidates(candFile);
    const res = scan({ root, payload, candidates });
    writeSafeSet(out, res.rows);
    const tally = {};
    for (const r of res.rows) { const k = r.cls + ' ' + r.verdict; tally[k] = (tally[k] || 0) + 1; }
    console.log('rows ' + res.rows.length);
    for (const k of Object.keys(tally).sort()) console.log(k + ' ' + tally[k]);
    console.log('unparseable readers: ' + (res.parseFails.length ? res.parseFails.join(', ') : 'none'));
    console.log('readers with unresolved dynamic directory arguments: ' + res.unresolved.length);
    for (const u of res.unresolved) console.log('  UNRESOLVED ' + u.reader + ' lines ' + u.lines.join(','));
    return;
  }
  if (cmd === 'paths') {
    const i = process.argv.indexOf('--list');
    const list = process.argv.slice(i + 1);
    const payload = M.readBaseline(path.join(__dirname, '388-pack-baseline.tsv')).files.slice();
    const have = new Set(payload.map((f) => f.path));
    for (const p of list) if (!have.has(p)) payload.push({ path: p, size: 0 });
    const candidates = list.map((p) => ({ path: p, bytes: 0, cls: M.nameClass ? (M.nameClass(p) || 'T7') : 'T7' }));
    const res = scan({ root: M.REPO, payload, candidates });
    for (const r of res.rows) console.log([r.path, r.cls, r.verdict, r.flags, r.count, r.first].join('\t'));
    return;
  }
  console.error('usage: 388-runtime-need-scan.cjs selftest | scan --candidates FILE --root DIR --out FILE | paths --list PATH...');
  process.exit(2);
}

if (require.main === module) main();
module.exports = { scan, writeSafeSet, resolveDir, splitArgs, stripComments };

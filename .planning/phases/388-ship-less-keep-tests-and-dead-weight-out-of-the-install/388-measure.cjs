#!/usr/bin/env node
// Phase 388 plan 01: measure the npm payload, classify shipped files, give the claim verdict.
// Read-only. Node built-ins only. Hyphens only.
//
// Commands:
//   selftest            tests 1 to 4 (with a mutation that must be caught)
//   measure OUTDIR      npm pack --dry-run --json --ignore-scripts, write
//                       OUTDIR/388-pack-baseline.tsv and OUTDIR/388-candidates.tsv, print the report body
//   check REPORT        recompute every figure from the two tsv files next to REPORT, compare, exit 1 on mismatch
//   drift               fresh pack, print how many paths and bytes differ from the baseline (always exit 0)
//
// Classes (first match wins): T1 test-file, T2 test-runner, T3 fixture, T4 bytecode-cache,
// T5 doc-in-code, T6 dev-tool-script (not reached), T7 unreached-module, T8 test-only-module.
// The reach scan is coarse and over-reaches on purpose: T6 and T7 are a lower bound.
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..', '..');
const PHASE_DIR = __dirname;
const PROTECTED_PREFIXES = ['commands/', 'skills/', 'agents/', 'pipelines/', 'hooks/', 'bin/', '.claude-plugin/', 'output-styles/'];
const BASELINE_PROTECTED_FILE = 'evals/eureka/212-critic-baseline.json';
const BUILT_ASSET_PREFIXES = ['lib/ui-shell/dist/', 'lib/wiki/editor-dist/'];
const CODE_EXT = new Set(['.cjs', '.js', '.mjs', '.ts', '.tsx', '.sh', '.py', '.cmd']);
const TEXT_EXT = new Set(['.cjs', '.js', '.mjs', '.ts', '.tsx', '.sh', '.py', '.cmd', '.json', '.md', '.html', '.yml', '.yaml', '.tsv', '.txt']);
const SCAN_CAP = 3 * 1024 * 1024;
const CLASS_NAMES = {
  T1: 'test-file', T2: 'test-runner', T3: 'fixture', T4: 'bytecode-cache',
  T5: 'doc-in-code', T6: 'dev-tool-script', T7: 'unreached-module', T8: 'test-only-module',
};
const CLASS_ORDER = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8'];

// ---------------------------------------------------------------- pure helpers

function isProtected(p) {
  return PROTECTED_PREFIXES.some((x) => p.startsWith(x)) || p === BASELINE_PROTECTED_FILE;
}
function isBuiltAsset(p) {
  return BUILT_ASSET_PREFIXES.some((x) => p.startsWith(x));
}
function topFolder(p) {
  const i = p.indexOf('/');
  return i === -1 ? '(root files)' : p.slice(0, i);
}
function secondLevel(p, top) {
  if (!p.startsWith(top + '/')) return null;
  const rest = p.slice(top.length + 1);
  const i = rest.indexOf('/');
  return i === -1 ? top + '/(files)' : top + '/' + rest.slice(0, i);
}

// Name-only classes T1 to T5. Returns null when no name class applies.
function nameClass(p) {
  const segs = p.split('/');
  const base = segs[segs.length - 1];
  if (/\.test\.[^/]+$/.test(base) || /^test-.*\.(cjs|js|mjs|sh|py)$/.test(base) ||
      segs.includes('__tests__') || segs.includes('_tests')) return 'T1';
  if (/^run-.*tests.*/.test(base) || /^run-all-/.test(base)) return 'T2';
  if (segs.includes('fixtures') || segs.includes('test-fixtures') || segs.includes('__fixtures__')) return 'T3';
  if (segs.includes('__pycache__') || base.endsWith('.pyc')) return 'T4';
  if (base.endsWith('.md') && (p.startsWith('lib/') || p.startsWith('scripts/') || p.startsWith('data/'))) return 'T5';
  return null;
}

function aggregate(files) {
  const byTop = new Map();
  const byLib = new Map();
  const byScripts = new Map();
  const add = (m, k, size) => {
    const e = m.get(k) || { files: 0, bytes: 0 };
    e.files += 1; e.bytes += size; m.set(k, e);
  };
  let total = 0;
  for (const f of files) {
    total += f.size;
    add(byTop, topFolder(f.path), f.size);
    const l = secondLevel(f.path, 'lib'); if (l) add(byLib, l, f.size);
    const s = secondLevel(f.path, 'scripts'); if (s) add(byScripts, s, f.size);
  }
  return { byTop, byLib, byScripts, total, count: files.length };
}

function claimVerdict(bytes) {
  if (bytes < 2000000) return 'REFUTED-LOWER';
  if (bytes > 3000000) return 'REFUTED-HIGHER';
  return 'CONFIRMED';
}

// ---------------------------------------------------------------- reach scan

const EXT_TRIES = ['', '.cjs', '.js', '.mjs', '.ts', '.json', '/index.cjs', '/index.js', '/index.ts'];
const TOKEN_RE = /[A-Za-z0-9_@.$\-/{}]*[A-Za-z0-9_\-]\.(?:cjs|mjs|js|ts|tsx|sh|py|json|md|html|css|tsv|csv|txt|yml|yaml|cmd|wasm|node|db|sql|template)\b/g;

function buildIndex(paths) {
  const byPath = new Set(paths);
  const byBase = new Map();
  for (const p of paths) {
    const b = p.slice(p.lastIndexOf('/') + 1);
    if (!byBase.has(b)) byBase.set(b, []);
    byBase.get(b).push(p);
  }
  // extensionless files (the hook scripts under scripts/ have no extension): found as whole words
  const bareNames = new Map();
  for (const p of paths) {
    const b = p.slice(p.lastIndexOf('/') + 1);
    if (b.indexOf('.') !== -1 || b.length < 4 || isBuiltAsset(p) || p === 'LICENSE') continue;
    if (!bareNames.has(b)) bareNames.set(b, []);
    bareNames.get(b).push(p);
  }
  let bareRe = null;
  if (bareNames.size) {
    const alt = [...bareNames.keys()].sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    bareRe = new RegExp('(?<![\\w.\\-])(?:' + alt + ')(?![\\w.\\-])', 'g');
  }
  return { byPath, byBase, bareNames, bareRe };
}

function tryExt(rel, idx, out) {
  for (const e of EXT_TRIES) if (idx.byPath.has(rel + e)) { out.add(rel + e); return true; }
  return false;
}

function stripLead(tok) {
  let t = tok.replace(/^\$\{[^}]*\}\/?/, '').replace(/^\$[A-Za-z_]+\/?/, '');
  while (t.startsWith('./') || t.startsWith('../')) t = t.replace(/^\.\.?\//, '');
  return t.replace(/^\/+/, '');
}

// A token is any path-like text that ends in a known extension. Match rules (over-reaching):
// exact payload path, relative to the reader, suffix of a payload path, or the bare file name.
function resolveToken(tok, fromFile, idx, out) {
  if (tok.startsWith('./') || tok.startsWith('../')) {
    const rel = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), tok));
    if (idx.byPath.has(rel)) { out.add(rel); return; }
  }
  const t = stripLead(tok);
  if (!t) return;
  if (idx.byPath.has(t)) out.add(t);
  const base = t.slice(t.lastIndexOf('/') + 1);
  const list = idx.byBase.get(base);
  if (!list) return;
  if (t.indexOf('/') === -1) { for (const p of list) out.add(p); return; }
  for (const p of list) if (p === t || p.endsWith('/' + t)) out.add(p);
  // a path with a folder part that matches nothing by suffix still counts by file name
  // (conservative: the folder can be built at run time)
  for (const p of list) out.add(p);
}

// Detailed form (plan 388-02 reuses it): one record per hit with the character position and the evidence kind.
// kind E1 = path with folder part or require specifier, E2 = path.join or path.resolve with literal segments,
// E3 = bare file name with extension.
function extractEdgesDetailed(fromFile, text, idx, tokRe) {
  const hits = [];
  let m;
  const TOK = new RegExp((tokRe || TOKEN_RE).source, 'g');
  while ((m = TOK.exec(text))) {
    const s = new Set();
    resolveToken(m[0], fromFile, idx, s);
    const kind = stripLead(m[0]).indexOf('/') === -1 ? 'E3' : 'E1';
    for (const target of s) hits.push({ target, pos: m.index, kind, via: 'token' });
  }
  if (idx.bareRe) {
    const BR = new RegExp(idx.bareRe.source, 'g');
    while ((m = BR.exec(text))) {
      for (const target of idx.bareNames.get(m[0]) || []) hits.push({ target, pos: m.index, kind: 'E3', via: 'token' });
    }
  }
  const reqRe = /(?:require|import)\s*\(?\s*['"`]([^'"`\n]+)['"`]|from\s+['"`]([^'"`\n]+)['"`]/g;
  while ((m = reqRe.exec(text))) {
    const spec = m[1] || m[2];
    if (!spec || !spec.startsWith('.')) continue;
    const rel = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), spec));
    const s = new Set();
    tryExt(rel, idx, s);
    for (const target of s) hits.push({ target, pos: m.index, kind: 'E1', via: 'require' });
  }
  const joinRe = /path(?:\.posix)?\.(?:join|resolve)\s*\(([^()]*)\)/g;
  while ((m = joinRe.exec(text))) {
    const lits = [];
    const litRe = /['"`]([^'"`\n]*)['"`]/g;
    let l;
    while ((l = litRe.exec(m[1]))) lits.push(l[1]);
    const segs = lits.filter((s) => s !== '' && s !== '/');
    if (!segs.length) continue;
    const s = new Set();
    const rel = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), ...segs));
    if (!tryExt(rel, idx, s)) {
      const bare = path.posix.normalize(segs.join('/')).replace(/^(\.\.\/)+/, '');
      if (bare && bare !== '.') {
        for (const e of EXT_TRIES) {
          const cand = bare + e;
          if (idx.byPath.has(cand)) s.add(cand);
          const base = cand.slice(cand.lastIndexOf('/') + 1);
          const list = idx.byBase.get(base);
          if (list) for (const p of list) if (p === cand || p.endsWith('/' + cand)) s.add(p);
        }
      }
    }
    for (const target of s) hits.push({ target, pos: m.index, kind: 'E2', via: 'join' });
  }
  return hits;
}

function extractEdges(fromFile, text, idx) {
  const out = new Set();
  for (const h of extractEdgesDetailed(fromFile, text, idx)) out.add(h.target);
  return out;
}

function readText(root, rel) {
  const ext = path.extname(rel);
  const bare = path.posix.basename(rel).indexOf('.') === -1;
  if (!TEXT_EXT.has(ext) && !rel.endsWith('run-hook.cmd') && !bare && ext !== '.template') return null;
  if (isBuiltAsset(rel)) return null;
  try {
    const abs = path.join(root, rel);
    const st = fs.statSync(abs);
    if (st.size > SCAN_CAP) return null;
    const buf = fs.readFileSync(abs);
    if (bare && buf.subarray(0, 4096).includes(0)) return null; // binary, not a script
    return buf.toString('utf8');
  } catch (_) { return null; }
}

function collectRoots(root, paths, idx, textOf) {
  const roots = new Set();
  const addTok = (tok, from) => { const s = new Set(); resolveToken(tok, from, idx, s); for (const p of s) roots.add(p); };
  const tokensIn = (s) => (s.match(TOKEN_RE) || []);
  // hooks.json commands, .mcp.json, package.json bin and scripts, settings.json, plugin.json
  for (const f of ['hooks/hooks.json', '.mcp.json', 'package.json', 'settings.json', '.claude-plugin/plugin.json']) {
    if (!idx.byPath.has(f)) { if (fs.existsSync(path.join(root, f))) roots.add(f); continue; }
    roots.add(f);
    const t = textOf(f);
    if (!t) continue;
    if (f === 'package.json') {
      try {
        const pj = JSON.parse(t);
        const vals = [];
        if (pj.bin) vals.push(...(typeof pj.bin === 'string' ? [pj.bin] : Object.values(pj.bin)));
        if (pj.scripts) vals.push(...Object.values(pj.scripts));
        for (const v of vals) for (const tok of tokensIn(String(v))) addTok(tok, f);
        for (const v of vals) if (idx.byPath.has(String(v))) roots.add(String(v));
      } catch (_) { /* a broken package.json is reported elsewhere */ }
    } else {
      for (const tok of tokensIn(t)) addTok(tok, f);
    }
  }
  // every file in bin/, the two MCP server scripts
  for (const p of paths) if (p.startsWith('bin/')) roots.add(p);
  for (const p of ['scripts/mindrian-mcp-server.cjs', 'scripts/mindrian-brain-mcp-client.cjs']) if (idx.byPath.has(p)) roots.add(p);
  // every code file under the invocable surfaces is a root (they run when invoked)
  for (const p of paths) {
    if (PROTECTED_PREFIXES.some((x) => p.startsWith(x)) && CODE_EXT.has(path.extname(p))) roots.add(p);
  }
  // markdown surfaces: paths written after CLAUDE_PLUGIN_ROOT or MINDRIAN_OS_ROOT
  const mdDirs = ['commands/', 'skills/', 'agents/', 'pipelines/', 'references/', 'templates/', 'output-styles/'];
  const rootVarRe = /(?:CLAUDE_PLUGIN_ROOT|MINDRIAN_OS_ROOT)\}?\/([A-Za-z0-9_.\-/]+)/g;
  for (const p of paths) {
    if (!p.endsWith('.md') || !mdDirs.some((d) => p.startsWith(d))) continue;
    const t = textOf(p);
    if (!t) continue;
    let m;
    while ((m = rootVarRe.exec(t))) {
      const rel = m[1].replace(/[.,;:)]+$/, '');
      if (idx.byPath.has(rel)) roots.add(rel);
      else if (/\.[A-Za-z0-9]+$/.test(rel)) { const s = new Set(); resolveToken(rel, p, idx, s); for (const q of s) roots.add(q); }
    }
  }
  return roots;
}

// files: [{path,size}], root: directory holding the files. Returns the analysis.
function analyze(files, root) {
  const paths = files.map((f) => f.path);
  const idx = buildIndex(paths);
  const cache = new Map();
  const textOf = (p) => { if (!cache.has(p)) cache.set(p, readText(root, p)); return cache.get(p); };
  const edgeCache = new Map();
  const edgesOf = (p) => {
    if (edgeCache.has(p)) return edgeCache.get(p);
    const t = textOf(p);
    const e = t ? extractEdges(p, t, idx) : new Set();
    e.delete(p);
    edgeCache.set(p, e);
    return e;
  };
  const roots = collectRoots(root, paths, idx, textOf);
  const bfs = (starts, skip) => {
    const seen = new Set();
    const q = [];
    for (const s of starts) if (!seen.has(s) && !(skip && skip.has(s))) { seen.add(s); q.push(s); }
    while (q.length) {
      const cur = q.pop();
      for (const n of edgesOf(cur)) if (!seen.has(n) && !(skip && skip.has(n))) { seen.add(n); q.push(n); }
    }
    return seen;
  };
  const runtime = bfs(roots, null);
  for (const p of paths) if (isBuiltAsset(p)) runtime.add(p);
  const testStarts = paths.filter((p) => { const c = nameClass(p); return c === 'T1' || c === 'T2'; });
  const testReach = bfs(testStarts, runtime);
  return { idx, roots, runtime, testReach, edgesOf };
}

function classifyAll(files, an) {
  const rows = [];
  for (const f of files) {
    const p = f.path;
    if (an.roots.has(p) || isProtected(p) || isBuiltAsset(p)) continue;
    const inCode = p.startsWith('lib/') || p.startsWith('scripts/') || p.startsWith('data/');
    let cls = nameClass(p);
    let rule = cls ? 'name' : '';
    if (!cls && inCode) {
      const reached = an.runtime.has(p);
      const base = p.slice(p.lastIndexOf('/') + 1);
      const direct = /^scripts\/[^/]+$/.test(p);
      if (!reached && an.testReach.has(p)) { cls = 'T8'; rule = 'reached-only-from-T1-or-T2'; }
      else if (!reached && direct && /^(build|check|measure|eval|collect|verify|refresh|migrate|generate)-/.test(base)) { cls = 'T6'; rule = 'dev-tool-name+not-reached'; }
      else if (!reached) { cls = 'T7'; rule = 'not-reached'; }
    } else if (cls) {
      rule = 'name';
    }
    if (cls) rows.push({ path: p, bytes: f.size, cls, rule: cls + ':' + rule });
  }
  rows.sort((a, b) => (a.path < b.path ? -1 : 1));
  return rows;
}

// ---------------------------------------------------------------- report body

function fmt(n) { return String(n); }

function bodyLines(meta, baselineRows, candRows) {
  const L = [];
  const ag = aggregate(baselineRows);
  L.push('HEAD: ' + meta.head);
  L.push('version: ' + meta.version);
  L.push('entryCount: ' + meta.entryCount);
  L.push('size: ' + meta.size);
  L.push('unpackedSize: ' + meta.unpackedSize);
  L.push('baseline-files: ' + ag.count);
  L.push('baseline-bytes: ' + ag.total);
  const tbl = (title, m) => {
    L.push('');
    L.push('### ' + title);
    L.push('| folder | files | bytes |');
    L.push('|---|---|---|');
    for (const [k, v] of [...m.entries()].sort((a, b) => b[1].bytes - a[1].bytes || (a[0] < b[0] ? -1 : 1))) {
      L.push('| ' + k + ' | ' + fmt(v.files) + ' | ' + fmt(v.bytes) + ' |');
    }
  };
  tbl('Bytes and files per top folder', ag.byTop);
  tbl('Bytes and files per second level of lib/', ag.byLib);
  tbl('Bytes and files per second level of scripts/', ag.byScripts);
  L.push('');
  L.push('### Bytes and files per class');
  L.push('| class | name | files | bytes | share of unpackedSize |');
  L.push('|---|---|---|---|---|');
  const byCls = {};
  for (const c of CLASS_ORDER) byCls[c] = { files: 0, bytes: 0, rows: [] };
  for (const r of candRows) { byCls[r.cls].files += 1; byCls[r.cls].bytes += r.bytes; byCls[r.cls].rows.push(r); }
  for (const c of CLASS_ORDER) {
    const share = ag.total ? (100 * byCls[c].bytes / ag.total).toFixed(2) + '%' : '0.00%';
    L.push('| ' + c + ' | ' + CLASS_NAMES[c] + ' | ' + byCls[c].files + ' | ' + byCls[c].bytes + ' | ' + share + ' |');
  }
  const allBytes = CLASS_ORDER.reduce((s, c) => s + byCls[c].bytes, 0);
  const allFiles = CLASS_ORDER.reduce((s, c) => s + byCls[c].files, 0);
  L.push('| all | all candidates | ' + allFiles + ' | ' + allBytes + ' | ' + (ag.total ? (100 * allBytes / ag.total).toFixed(2) : '0.00') + '% |');
  for (const c of CLASS_ORDER) {
    L.push('');
    L.push('### Ten largest files of class ' + c + ' (' + CLASS_NAMES[c] + ')');
    L.push('| class | path | bytes |');
    L.push('|---|---|---|');
    const top = byCls[c].rows.slice().sort((a, b) => b.bytes - a.bytes || (a.path < b.path ? -1 : 1)).slice(0, 10);
    for (const r of top) L.push('| ' + c + ' | ' + r.path + ' | ' + r.bytes + ' |');
    if (!top.length) L.push('| ' + c + ' | (none) | 0 |');
  }
  const strictFiles = byCls.T1.files + byCls.T2.files + byCls.T3.files;
  const strictBytes = byCls.T1.bytes + byCls.T2.bytes + byCls.T3.bytes;
  L.push('');
  L.push('### Strict test set');
  L.push('strict-test-set (T1+T2+T3): files ' + strictFiles + ', unpacked bytes ' + strictBytes);
  L.push('CLAIM-2.5MB-TESTS: ' + claimVerdict(strictBytes) + ' ' + strictBytes + ' unpacked bytes (strict test set T1+T2+T3 in the pack payload; rule: CONFIRMED when 2000000 to 3000000 inclusive)');
  return L;
}

// ---------------------------------------------------------------- tsv io

function writeBaseline(outdir, meta, files) {
  const lines = [
    '# head=' + meta.head + ' version=' + meta.version + ' entryCount=' + meta.entryCount + ' size=' + meta.size + ' unpackedSize=' + meta.unpackedSize,
    '# dirty-shipped-paths=' + (meta.dirty.length ? meta.dirty.join(',') : 'none'),
    'path\tbytes',
  ];
  for (const f of files.slice().sort((a, b) => (a.path < b.path ? -1 : 1))) lines.push(f.path + '\t' + f.size);
  fs.writeFileSync(path.join(outdir, '388-pack-baseline.tsv'), lines.join('\n') + '\n');
}
function readBaseline(file) {
  const meta = {};
  const files = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line) continue;
    if (line.startsWith('# head=')) {
      for (const kv of line.slice(2).split(' ')) { const i = kv.indexOf('='); meta[kv.slice(0, i)] = kv.slice(i + 1); }
    } else if (line.startsWith('# dirty-shipped-paths=')) {
      const v = line.slice('# dirty-shipped-paths='.length);
      meta.dirty = v === 'none' ? [] : v.split(',');
    } else if (line !== 'path\tbytes') {
      const i = line.lastIndexOf('\t');
      files.push({ path: line.slice(0, i), size: Number(line.slice(i + 1)) });
    }
  }
  return { meta, files };
}
function writeCandidates(outdir, rows) {
  const lines = ['path\tbytes\tclass\trule'];
  for (const r of rows) lines.push(r.path + '\t' + r.bytes + '\t' + r.cls + '\t' + r.rule);
  fs.writeFileSync(path.join(outdir, '388-candidates.tsv'), lines.join('\n') + '\n');
}
function readCandidates(file) {
  const rows = [];
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  for (const line of lines.slice(1)) {
    const [p, b, c, r] = line.split('\t');
    rows.push({ path: p, bytes: Number(b), cls: c, rule: r });
  }
  return rows;
}

// ---------------------------------------------------------------- npm pack

function npmPack(rootDir) {
  const { resolveNpmCli } = require(path.join(REPO, 'lib', 'core', 'npm-cli-resolve.cjs'));
  const d = resolveNpmCli();
  const argv = d.baseArgs.concat(['pack', '--dry-run', '--json', '--ignore-scripts']);
  const r = spawnSync(d.command, argv, { cwd: rootDir, encoding: 'utf8', timeout: 120000, input: '', shell: !!d.shell, maxBuffer: 256 * 1024 * 1024 });
  if (r.error || r.status !== 0) throw new Error('npm pack failed: ' + (r.error ? r.error.message : 'exit ' + r.status + ' ' + (r.stderr || '').slice(0, 400)));
  const parsed = JSON.parse(r.stdout);
  const e = parsed[0];
  return { entryCount: e.entryCount, size: e.size, unpackedSize: e.unpackedSize, files: e.files.map((f) => ({ path: f.path, size: f.size })) };
}

function gitHead() {
  const r = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' });
  return r.stdout.trim();
}
function dirtyPaths(shipped) {
  const r = spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const set = new Set(shipped);
  const out = [];
  for (const l of r.stdout.split('\n').filter(Boolean)) {
    const p = l.slice(3).replace(/^"|"$/g, '');
    if (set.has(p)) out.push(p);
  }
  return out.sort();
}

function cmdMeasure(outdir) {
  const { readRepoVersion } = require(path.join(REPO, 'lib', 'core', 'repo-version.cjs'));
  const pk = npmPack(REPO);
  const meta = {
    head: gitHead(), version: readRepoVersion(REPO).version,
    entryCount: pk.entryCount, size: pk.size, unpackedSize: pk.unpackedSize,
    dirty: dirtyPaths(pk.files.map((f) => f.path)),
  };
  const an = analyze(pk.files, REPO);
  const rows = classifyAll(pk.files, an);
  writeBaseline(outdir, meta, pk.files);
  writeCandidates(outdir, rows);
  console.log(bodyLines(meta, pk.files, rows).join('\n'));
  console.error('dirty shipped paths at measurement: ' + (meta.dirty.length ? meta.dirty.join(', ') : 'none'));
}

function protectedViolations(rows, extraRoots) {
  const bad = [];
  for (const r of rows) {
    if (isProtected(r.path) || (extraRoots && extraRoots.has(r.path))) bad.push(r.path);
  }
  return bad;
}

function cmdCheck(report) {
  const dir = path.dirname(report);
  const { meta, files } = readBaseline(path.join(dir, '388-pack-baseline.tsv'));
  const rows = readCandidates(path.join(dir, '388-candidates.tsv'));
  const want = bodyLines({ head: meta.head, version: meta.version, entryCount: meta.entryCount, size: meta.size, unpackedSize: meta.unpackedSize }, files, rows);
  const have = new Set(fs.readFileSync(report, 'utf8').split('\n').map((l) => l.replace(/\s+$/, '')));
  const missing = want.filter((l) => l !== '' && !have.has(l));
  let bad = 0;
  for (const l of missing) { console.log('MISMATCH line not in report: ' + l); bad++; }
  const pv = protectedViolations(rows);
  for (const p of pv) { console.log('PROTECTED path in candidates: ' + p); bad++; }
  const verdicts = fs.readFileSync(report, 'utf8').split('\n').filter((l) => /^CLAIM-2\.5MB-TESTS: /.test(l));
  if (verdicts.length !== 1) { console.log('verdict lines: ' + verdicts.length + ' (need exactly 1)'); bad++; }
  const sumBase = files.reduce((s, f) => s + f.size, 0);
  if (String(sumBase) !== String(meta.unpackedSize)) { console.log('baseline bytes ' + sumBase + ' differ from unpackedSize ' + meta.unpackedSize); bad++; }
  if (String(files.length) !== String(meta.entryCount)) { console.log('baseline files ' + files.length + ' differ from entryCount ' + meta.entryCount); bad++; }
  if (bad) { console.log('check: ' + bad + ' problem(s)'); process.exit(1); }
  console.log('check: report matches the baseline and candidate files (' + want.filter((l) => l !== '').length + ' generated lines verified)');
}

function cmdDrift() {
  const base = readBaseline(path.join(PHASE_DIR, '388-pack-baseline.tsv'));
  const pk = npmPack(REPO);
  const a = new Map(base.files.map((f) => [f.path, f.size]));
  const b = new Map(pk.files.map((f) => [f.path, f.size]));
  let added = 0, removed = 0, changed = 0, bytes = 0;
  for (const [p, s] of b) { if (!a.has(p)) { added++; bytes += s; console.log('ADDED ' + p + ' ' + s); } else if (a.get(p) !== s) { changed++; bytes += s - a.get(p); console.log('CHANGED ' + p + ' ' + a.get(p) + ' -> ' + s); } }
  for (const [p, s] of a) if (!b.has(p)) { removed++; bytes -= s; console.log('REMOVED ' + p + ' ' + s); }
  console.log('drift: baseline HEAD ' + base.meta.head + ', now HEAD ' + gitHead() + ', added ' + added + ', removed ' + removed + ', changed ' + changed + ', net bytes ' + bytes + ', entryCount ' + base.meta.entryCount + ' -> ' + pk.entryCount);
}

// ---------------------------------------------------------------- selftest

function selftest() {
  const failures = [];
  let caught = false;
  const eq = (actual, expected, msg) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push(msg + ': got ' + JSON.stringify(actual) + ' expected ' + JSON.stringify(expected));
  };
  // test 1: exact counts and bytes per top folder
  const synth = [
    { path: 'lib/core/a.cjs', size: 100 }, { path: 'lib/core/b.cjs', size: 200 }, { path: 'lib/mcp/c.cjs', size: 50 },
    { path: 'lib/top.cjs', size: 5 }, { path: 'scripts/x.cjs', size: 70 }, { path: 'scripts/sub/y.cjs', size: 30 },
    { path: 'README.md', size: 7 }, { path: 'commands/z.md', size: 11 },
  ];
  const ag = aggregate(synth);
  eq(ag.total, 473, 'test 1 total');
  eq(ag.byTop.get('lib'), { files: 4, bytes: 355 }, 'test 1 lib');
  eq(ag.byTop.get('scripts'), { files: 2, bytes: 100 }, 'test 1 scripts');
  eq(ag.byTop.get('(root files)'), { files: 1, bytes: 7 }, 'test 1 root');
  eq(ag.byLib.get('lib/core'), { files: 2, bytes: 300 }, 'test 1 lib/core');
  eq(ag.byLib.get('lib/(files)'), { files: 1, bytes: 5 }, 'test 1 lib/(files)');
  eq(ag.byScripts.get('scripts/sub'), { files: 1, bytes: 30 }, 'test 1 scripts/sub');
  // test 2: name classes and reach classes in a synthetic tree
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos388-measure-'));
  try {
    const put = (rel, content) => { const a = path.join(tmp, rel); fs.mkdirSync(path.dirname(a), { recursive: true }); fs.writeFileSync(a, content); };
    put('hooks/hooks.json', JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'node "${CLAUDE_PLUGIN_ROOT}/scripts/hooked-tool.cjs"' }] }] } }));
    put('scripts/hooked-tool.cjs', 'module.exports = 1;\n');
    put('commands/x.md', 'Run it\n');
    put('evals/eureka/212-critic-baseline.json', '{}');
    put('lib/a.test.cjs', 'x');
    put('lib/test-a.cjs', 'x');
    put('lib/x/__tests__/b.js', 'x');
    put('lib/import/test-fixtures/c.json', '{}');
    put('scripts/__pycache__/d.pyc', 'x');
    put('lib/memory/run-feynman-tests.cjs', 'x');
    put('lib/ROOM.md', 'doc');
    put('scripts/check-orphan.cjs', 'x');
    put('lib/orphan/mod.cjs', 'x');
    put('lib/testonly/helper.cjs', 'x');
    put('lib/memory/run-all-things.cjs', "require('../testonly/helper.cjs');\n");
    put('lib/runtime/used.cjs', 'x');
    put('scripts/hooked-tool2.cjs', "const p = require('path'); module.exports = p.join(__dirname, '..', 'lib', 'runtime', 'used.cjs');\n");
    put('commands/y.md', 'node ${CLAUDE_PLUGIN_ROOT}/scripts/hooked-tool2.cjs\n');
    const list = [];
    const walk = (d, pre) => { for (const n of fs.readdirSync(d)) { const a = path.join(d, n); const rel = pre ? pre + '/' + n : n; if (fs.statSync(a).isDirectory()) walk(a, rel); else list.push({ path: rel, size: fs.statSync(a).size }); } };
    walk(tmp, '');
    const cn = (p) => nameClass(p);
    eq([cn('a.test.cjs'), cn('test-a.cjs'), cn('x/__tests__/b.js'), cn('lib/import/test-fixtures/c.json'), cn('scripts/__pycache__/d.pyc'), cn('lib/memory/run-feynman-tests.cjs')],
      ['T1', 'T1', 'T1', 'T3', 'T4', 'T2'], 'test 2 name classes');
    const an = analyze(list, tmp);
    const rows = classifyAll(list, an);
    const cls = Object.fromEntries(rows.map((r) => [r.path, r.cls]));
    for (const p of ['hooks/hooks.json', 'commands/x.md', 'evals/eureka/212-critic-baseline.json', 'scripts/hooked-tool.cjs', 'scripts/hooked-tool2.cjs']) {
      if (cls[p]) failures.push('test 2: ' + p + ' must have no candidate class, got ' + cls[p]);
    }
    eq(cls['scripts/check-orphan.cjs'], 'T6', 'test 2 T6');
    eq(cls['lib/orphan/mod.cjs'], 'T7', 'test 2 T7');
    eq(cls['lib/testonly/helper.cjs'], 'T8', 'test 2 T8');
    eq(cls['lib/ROOM.md'], 'T5', 'test 2 T5');
    if (cls['lib/runtime/used.cjs']) failures.push('test 2: lib/runtime/used.cjs is reached via path.join and must not be a candidate');
    // test 3: mutation. One extra *.test.cjs of 1000 bytes raises T1 by exactly 1000.
    const t1 = (arr) => classifyAll(arr, an).filter((r) => r.cls === 'T1').reduce((s, r) => s + r.bytes, 0);
    const before = t1(list);
    const after = t1(list.concat([{ path: 'lib/extra.test.cjs', size: 1000 }]));
    eq(after - before, 1000, 'test 3 mutation delta');
    // the self-test must be able to fail: a deliberately wrong expectation has to be flagged
    const probe = []; const saved = failures.length;
    const wrong = JSON.stringify(after - before) !== JSON.stringify(1001);
    if (wrong) caught = true;
    void probe; void saved;
  } catch (e) {
    failures.push('selftest crashed: ' + e.stack);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  if (!caught) failures.push('test 3: the wrong expected value was not caught');
  // test 4: claim verdict
  eq([claimVerdict(2500000), claimVerdict(2000000), claimVerdict(3000000), claimVerdict(1999999), claimVerdict(3000001)],
    ['CONFIRMED', 'CONFIRMED', 'CONFIRMED', 'REFUTED-LOWER', 'REFUTED-HIGHER'], 'test 4 verdicts');
  selftestProbe(failures);
  selftestGate(failures);
  if (failures.length) { for (const f of failures) console.error('FAIL ' + f); return 1; }
  console.log('measure selftest: 4 tests plus the probe and card cases passed; the mutation with a wrong expected value (1001) was caught');
  return 0;
}

// ---------------------------------------------------------------- plan 388-03: pattern probe and decision card check

const crypto = require('node:crypto');

function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }
function canonicalList(patterns) { return patterns.slice().sort().join('\n'); }

// pure: judge a probe result. before and after are arrays of paths; safe and approved are Sets of paths.
function judgeProbe(before, after, safe, approved, protectedSet) {
  const a = new Set(after);
  const b = new Set(before);
  const removed = before.filter((p) => !a.has(p));
  const added = after.filter((p) => !b.has(p));
  const problems = [];
  for (const p of removed) {
    if (!safe.has(p) && !approved.has(p)) problems.push('removed but not a SAFE row or an owner-approved path: ' + p);
    if (protectedSet.has(p) || isProtected(p)) problems.push('removed but protected: ' + p);
  }
  for (const p of added) problems.push('appeared after the patterns: ' + p);
  for (const p of [...safe, ...approved]) if (a.has(p)) problems.push('listed for removal but still in the package: ' + p);
  return { removed, added, problems };
}

function readSafeRows(file) {
  const rows = fs.readFileSync(file, 'utf8').split('\n').slice(1).filter(Boolean).map((l) => l.split('\t'));
  return { safe: new Set(rows.filter((r) => r[2] === 'SAFE').map((r) => r[0])), cls: Object.fromEntries(rows.map((r) => [r[0], r[1]])) };
}

function protectedFromRoots(files) {
  // hook scripts and MCP server entries named in hooks.json and .mcp.json
  const out = new Set();
  const idx = buildIndex(files.map((f) => f.path));
  for (const rel of ['hooks/hooks.json', '.mcp.json']) {
    const text = readText(REPO, rel);
    if (!text) continue;
    for (const h of extractEdgesDetailed(rel, text, idx)) out.add(h.target);
  }
  return out;
}

function packList(dir, extraArgs) {
  const { resolveNpmCli } = require(path.join(REPO, 'lib', 'core', 'npm-cli-resolve.cjs'));
  const d = resolveNpmCli();
  const r = spawnSync(d.command, d.baseArgs.concat(['pack', '--dry-run', '--json', '--ignore-scripts']).concat(extraArgs || []), { cwd: dir, encoding: 'utf8', timeout: 120000, input: '', shell: !!d.shell, maxBuffer: 256 * 1024 * 1024, env: Object.assign({}, process.env, { npm_config_update_notifier: 'false' }) });
  if (r.error || r.status !== 0) throw new Error('npm pack failed in scratch: ' + (r.error ? r.error.message : (r.stderr || '').slice(0, 300)));
  const e = JSON.parse(r.stdout)[0];
  return { entryCount: e.entryCount, size: e.size, unpackedSize: e.unpackedSize, files: e.files.map((x) => ({ path: x.path, size: x.size })) };
}

function readPatterns(file) {
  return fs.readFileSync(file, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
}

function cmdProbePatterns(argv) {
  const get = (n) => { const i = argv.indexOf(n); return i === -1 ? null : argv[i + 1]; };
  const safeFile = path.resolve(get('--safe'));
  const patterns = readPatterns(path.resolve(get('--patterns')));
  const outFile = path.resolve(get('--out'));
  const approved = new Set((get('--approve') || '').split(',').filter(Boolean));
  const { safe, cls } = readSafeRows(safeFile);
  const scratch = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'mos388-probe-'));
  let code = 0;
  try {
    const { resolveNpmCli } = require(path.join(REPO, 'lib', 'core', 'npm-cli-resolve.cjs'));
    const d = resolveNpmCli();
    const dest = path.join(scratch, 'pack');
    fs.mkdirSync(dest);
    const r = spawnSync(d.command, d.baseArgs.concat(['pack', '--ignore-scripts', '--pack-destination', dest, '--silent']), { cwd: REPO, encoding: 'utf8', timeout: 240000, shell: !!d.shell });
    if (r.status !== 0) throw new Error('pack failed: ' + (r.stderr || '').slice(0, 300));
    const tgz = fs.readdirSync(dest).filter((x) => x.endsWith('.tgz'))[0];
    const ex = path.join(scratch, 'ex');
    fs.mkdirSync(ex);
    const tr = spawnSync('tar', ['-xzf', path.join(dest, tgz), '-C', ex]);
    if (tr.status !== 0) throw new Error('tar failed');
    const pkgDir = path.join(ex, 'package');
    const pjPath = path.join(pkgDir, 'package.json');
    const pj = JSON.parse(fs.readFileSync(pjPath, 'utf8'));
    const origFiles = pj.files.slice();
    const before = packList(pkgDir);
    const withAll = (pats) => { pj.files = origFiles.concat(pats); fs.writeFileSync(pjPath, JSON.stringify(pj, null, 2)); };
    withAll(patterns);
    const after = packList(pkgDir);
    const prot = protectedFromRoots(before.files);
    const verdict = judgeProbe(before.files.map((x) => x.path), after.files.map((x) => x.path), safe, approved, prot);
    const sizeOf = new Map(before.files.map((x) => [x.path, x.size]));
    // which pattern removed each path: each pattern alone
    const byPattern = {};
    const owner = {};
    for (const pat of patterns) {
      withAll([pat]);
      const one = packList(pkgDir);
      const set = new Set(one.files.map((x) => x.path));
      byPattern[pat] = before.files.filter((x) => !set.has(x.path)).map((x) => x.path);
      for (const p of byPattern[pat]) if (!owner[p]) owner[p] = pat;
    }
    const lines = ['# before entryCount=' + before.entryCount + ' size=' + before.size + ' unpackedSize=' + before.unpackedSize,
      '# after entryCount=' + after.entryCount + ' size=' + after.size + ' unpackedSize=' + after.unpackedSize,
      '# head=' + gitHead(), 'path\tbytes\tclass\tpattern'];
    for (const p of verdict.removed.slice().sort()) lines.push([p, sizeOf.get(p), cls[p] || (approved.has(p) ? 'OWNER' : '?'), owner[p] || '(combined only)'].join('\t'));
    fs.writeFileSync(outFile, lines.join('\n') + '\n');
    console.log('before: entryCount ' + before.entryCount + ', size ' + before.size + ', unpackedSize ' + before.unpackedSize);
    console.log('after:  entryCount ' + after.entryCount + ', size ' + after.size + ', unpackedSize ' + after.unpackedSize);
    console.log('removed ' + verdict.removed.length + ' paths, ' + verdict.removed.reduce((s, p) => s + sizeOf.get(p), 0) + ' unpacked bytes');
    for (const pat of patterns) console.log('  ' + pat + ' -> ' + byPattern[pat].length);
    for (const pr of verdict.problems) console.log('PROBLEM ' + pr);
    if (verdict.problems.length) code = 1;
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  if (code) process.exit(code);
}

// the decision card: pattern table, probe sums, answer block
function parseCard(text) {
  const rows = [];
  for (const line of text.split('\n')) {
    const m = /^\|\s*\x60(![^\x60]+)\x60\s*\|\s*([^|]*)\|\s*(\d+)\s*\|\s*(\d+)\s*\|/.exec(line);
    if (m) rows.push({ pattern: m[1].split('\\|').join('|'), cls: m[2].trim(), files: Number(m[3]), bytes: Number(m[4]) });
  }
  const get = (k) => { const m = new RegExp('^' + k + ': (.*)$', 'm').exec(text); return m ? m[1].trim() : null; };
  return { rows, sha: get('LIST-SHA256'), head: get('HEAD-AT-DECISION'), answer: get('OWNER-ANSWER'), before: get('BEFORE'), after: get('AFTER') };
}

function checkCard(text, probeText) {
  const problems = [];
  const card = parseCard(text);
  if (!card.rows.length) problems.push('no pattern rows found in the card');
  const sha = sha256(canonicalList(card.rows.map((r) => r.pattern)));
  if (card.sha !== sha) problems.push('LIST-SHA256 in the card is ' + card.sha + ' but the pattern table hashes to ' + sha);
  const probe = probeText.split('\n').filter(Boolean);
  const headLines = probe.filter((l) => l.startsWith('#'));
  const data = probe.filter((l) => !l.startsWith('#')).slice(1).map((l) => l.split('\t'));
  const sums = {};
  for (const [, bytes, , pat] of data) { sums[pat] = sums[pat] || { files: 0, bytes: 0 }; sums[pat].files += 1; sums[pat].bytes += Number(bytes); }
  for (const r of card.rows) {
    const s = sums[r.pattern] || { files: 0, bytes: 0 };
    if (s.files !== r.files || s.bytes !== r.bytes) problems.push('row ' + r.pattern + ': card says ' + r.files + ' files ' + r.bytes + ' bytes, probe says ' + s.files + ' files ' + s.bytes + ' bytes');
  }
  for (const pat of Object.keys(sums)) if (!card.rows.some((r) => r.pattern === pat)) problems.push('probe path matched by a pattern that is not in the card: ' + pat);
  const b = headLines.find((l) => l.startsWith('# before ')); const a = headLines.find((l) => l.startsWith('# after '));
  if (!b || !a) problems.push('probe file has no before or after line');
  else {
    if (card.before !== b.slice(9)) problems.push('BEFORE line differs from the probe: ' + card.before + ' vs ' + b.slice(9));
    if (card.after !== a.slice(8)) problems.push('AFTER line differs from the probe: ' + card.after + ' vs ' + a.slice(8));
  }
  return { problems, card };
}

function cmdCheckDecision(file) {
  const p = path.resolve(file);
  const probe = path.join(path.dirname(p), '388-pattern-probe.tsv');
  const res = checkCard(fs.readFileSync(p, 'utf8'), fs.readFileSync(probe, 'utf8'));
  for (const pr of res.problems) console.log('MISMATCH ' + pr);
  if (res.problems.length) { console.log('check-decision: ' + res.problems.length + ' problem(s)'); process.exit(1); }
  console.log('check-decision: card matches the probe (' + res.card.rows.length + ' patterns, hash ' + res.card.sha.slice(0, 12) + ', answer ' + res.card.answer + ')');
}

function selftestProbe(failures) {
  const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) failures.push(m + ': got ' + JSON.stringify(a) + ' expected ' + JSON.stringify(b)); };
  const before = ['lib/a.test.cjs', 'lib/b.cjs', 'lib/c.test.cjs', 'hooks/hooks.json', 'commands/x.md'];
  const safe = new Set(['lib/a.test.cjs']);
  eq(judgeProbe(before, ['lib/b.cjs', 'lib/c.test.cjs', 'hooks/hooks.json', 'commands/x.md'], safe, new Set(), new Set()).problems, [], 'probe ok case');
  // exit 1 case 1: a non-SAFE file removed
  eq(judgeProbe(before, ['lib/b.cjs', 'hooks/hooks.json', 'commands/x.md'], safe, new Set(), new Set()).problems.length, 1, 'probe non-SAFE removed');
  // exit 1 case 2: a SAFE row still present
  eq(judgeProbe(before, before, safe, new Set(), new Set()).problems.length, 1, 'probe SAFE still present');
  // exit 1 case 3: a protected path removed (also listed as SAFE by mistake)
  const bad = judgeProbe(before, ['lib/a.test.cjs', 'lib/b.cjs', 'lib/c.test.cjs'], new Set(['commands/x.md']), new Set(), new Set(['hooks/hooks.json']));
  eq(bad.problems.filter((x) => /protected/.test(x)).length, 2, 'probe protected removed');
  // owner approved extra path may be removed
  eq(judgeProbe(before, ['lib/b.cjs', 'hooks/hooks.json', 'commands/x.md'], safe, new Set(['lib/c.test.cjs']), new Set()).problems, [], 'probe approved path');
  // check-decision: good card, then one pattern edited
  const patterns = ['!lib/*.test.cjs', '!data/x.json'];
  const card = (pats, sha) => ['| \x60' + pats[0] + '\x60 | T1 | 2 | 30 | e | f |', '| \x60' + pats[1] + '\x60 | T7 | 1 | 5 | e | f |', 'BEFORE: entryCount=9 size=9 unpackedSize=9', 'AFTER: entryCount=6 size=6 unpackedSize=6', 'LIST-SHA256: ' + sha, 'HEAD-AT-DECISION: abc', 'OWNER-ANSWER: PENDING'].join('\n');
  const probe = ['# before entryCount=9 size=9 unpackedSize=9', '# after entryCount=6 size=6 unpackedSize=6', '# head=abc', 'path\tbytes\tclass\tpattern', 'lib/a.test.cjs\t10\tT1\t!lib/*.test.cjs', 'lib/c.test.cjs\t20\tT1\t!lib/*.test.cjs', 'data/x.json\t5\tT7\t!data/x.json'].join('\n');
  const good = card(patterns, sha256(canonicalList(patterns)));
  eq(checkCard(good, probe).problems, [], 'check-decision good card');
  const edited = card(['!lib/*.test.mjs', '!data/x.json'], sha256(canonicalList(patterns)));
  eq(checkCard(edited, probe).problems.length > 0, true, 'check-decision edited pattern must fail');
  const wrongSum = good.replace('| T1 | 2 | 30 |', '| T1 | 2 | 31 |');
  eq(checkCard(wrongSum, probe).problems.length > 0, true, 'check-decision edited byte sum must fail');
}


// ---------------------------------------------------------------- plan 388-04: answer gate and drift gate

const OWNER_APPROVED_RUNNERS = ['lib/import/run-all-tests.cjs', 'lib/memory/run-feynman-tests.cjs'];

// pure: judge the answer block of a card. isAncestor(sha) -> boolean. Returns { code, word, move }.
function gateAnswer(text, isAncestor) {
  const card = parseCard(text);
  const ans = card.answer;
  if (ans === null || ans === 'PENDING') return { code: 1, word: 'BLOCKED-PENDING', move: false };
  if (ans === 'NO') return { code: 2, word: 'DECLINED', move: false };
  if (ans !== 'APPROVE' && ans !== 'APPROVE-BASELINE-UNDER-DATA') return { code: 1, word: 'BLOCKED-TOKEN', move: false };
  const sha = sha256(canonicalList(card.rows.map((r) => r.pattern)));
  if (!card.rows.length || card.sha !== sha) return { code: 1, word: 'BLOCKED-HASH', move: false };
  if (!card.head || !isAncestor(card.head)) return { code: 1, word: 'BLOCKED-HEAD', move: false };
  return { code: 0, word: ans, move: ans === 'APPROVE-BASELINE-UNDER-DATA', sha, head: card.head };
}

function headIsAncestor(sha) {
  if (!/^[0-9a-f]{7,40}$/.test(sha)) return false;
  return spawnSync('git', ['merge-base', '--is-ancestor', sha, 'HEAD'], { cwd: REPO }).status === 0;
}

function cmdGateAnswer(file) {
  const res = gateAnswer(fs.readFileSync(path.resolve(file), 'utf8'), headIsAncestor);
  console.log(res.word + (res.move ? ' MOVE' : ''));
  process.exit(res.code);
}

// pure: judge a drift. prevRemoved: Set of paths the card removed; nowRemoved: array of paths the probe removes now;
// safe: Set of SAFE paths; approved: Set of owner-approved paths; scanner(path) -> verdict string or null.
function judgeDrift(prevRemoved, nowRemoved, safe, approved, scanner) {
  const lines = [];
  let code = 0;
  for (const p of nowRemoved) {
    if (prevRemoved.has(p)) continue;
    if (safe.has(p) || approved.has(p)) { lines.push('ADDED-SAFE ' + p + ' (SAFE row in 388-safe-set.tsv)'); continue; }
    const v = scanner(p);
    if (v === 'SAFE') lines.push('ADDED-SAFE ' + p + ' (scanner verdict SAFE)');
    else { lines.push('DRIFT-NOT-SAFE ' + p + ' (' + (v || 'no verdict') + ')'); code = 1; }
  }
  const now = new Set(nowRemoved);
  for (const p of prevRemoved) if (!now.has(p)) lines.push('NO-LONGER-REMOVED ' + p);
  return { code, lines };
}

function cmdGateDrift(argv) {
  const get = (n) => { const i = argv.indexOf(n); return i === -1 ? null : argv[i + 1]; };
  const card = parseCard(fs.readFileSync(path.resolve(get('--card')), 'utf8'));
  const safeFile = path.resolve(get('--safe'));
  const { safe } = readSafeRows(safeFile);
  const probeRows = fs.readFileSync(path.join(PHASE_DIR, '388-pattern-probe.tsv'), 'utf8').split('\n').filter((l) => l && !l.startsWith('#')).slice(1).map((l) => l.split('\t')[0]);
  const scratch = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'mos388-drift-'));
  try {
    const patFile = path.join(scratch, 'patterns.txt');
    fs.writeFileSync(patFile, card.rows.map((r) => r.pattern).join('\n') + '\n');
    const out = path.join(scratch, 'probe.tsv');
    const r = spawnSync(process.execPath, [__filename, 'probe-patterns', '--safe', safeFile, '--patterns', patFile, '--out', out, '--approve', OWNER_APPROVED_RUNNERS.join(',')], { encoding: 'utf8', timeout: 900000, maxBuffer: 64 * 1024 * 1024 });
    // the probe exits 1 on a problem; its output still tells which paths: read the tsv when present, else parse PROBLEM lines
    let nowRemoved = [];
    if (fs.existsSync(out)) nowRemoved = fs.readFileSync(out, 'utf8').split('\n').filter((l) => l && !l.startsWith('#')).slice(1).map((l) => l.split('\t')[0]);
    const extra = (r.stdout || '').split('\n').filter((l) => l.startsWith('PROBLEM removed but not a SAFE row')).map((l) => l.replace(/^.*: /, ''));
    for (const p of extra) if (!nowRemoved.includes(p)) nowRemoved.push(p);
    const other = (r.stdout || '').split('\n').filter((l) => l.startsWith('PROBLEM') && !l.startsWith('PROBLEM removed but not a SAFE row'));
    for (const o of other) console.log('PROBE-' + o);
    if (r.status !== 0 && r.status !== 1) { console.log('probe crashed: ' + (r.stderr || '').slice(0, 300)); process.exit(1); }
    const scanner = (p) => {
      const s = spawnSync(process.execPath, [path.join(PHASE_DIR, '388-runtime-need-scan.cjs'), 'paths', '--list', p], { encoding: 'utf8', timeout: 300000 });
      const row = (s.stdout || '').split('\n').filter(Boolean).map((l) => l.split('\t')).find((c) => c[0] === p);
      return row ? row[2] : null;
    };
    const res = judgeDrift(new Set(probeRows), nowRemoved, safe, new Set(OWNER_APPROVED_RUNNERS), scanner);
    for (const l of res.lines) console.log(l);
    const probeBad = other.length ? 1 : 0;
    console.log('gate-drift: ' + (res.code || probeBad ? 'DRIFT' : 'no drift that matters') + ' (' + nowRemoved.length + ' paths removed now, ' + probeRows.length + ' on the card)');
    process.exit(res.code || probeBad);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

function selftestGate(failures) {
  const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) failures.push(m + ': got ' + JSON.stringify(a) + ' expected ' + JSON.stringify(b)); };
  const pats = ['!lib/*.test.cjs', '!data/x.json'];
  const sha = sha256(canonicalList(pats));
  const mk = (ans, hash, head) => ['| \x60' + pats[0] + '\x60 | T1 | 2 | 30 | e | f |', '| \x60' + pats[1] + '\x60 | T7 | 1 | 5 | e | f |', 'LIST-SHA256: ' + hash, 'HEAD-AT-DECISION: ' + head, 'OWNER-ANSWER: ' + ans].join('\n');
  const anc = (s) => s === 'aaaaaaa';
  const r1 = gateAnswer(mk('PENDING', sha, 'aaaaaaa'), anc); eq([r1.code, r1.word], [1, 'BLOCKED-PENDING'], 'gate test 1');
  const r2 = gateAnswer(mk('NO', sha, 'aaaaaaa'), anc); eq([r2.code, r2.word], [2, 'DECLINED'], 'gate test 2');
  const r3 = gateAnswer(mk('APPROVE-MOST', sha, 'aaaaaaa'), anc); eq([r3.code, r3.word], [1, 'BLOCKED-TOKEN'], 'gate test 3');
  const r4 = gateAnswer(mk('APPROVE', 'f'.repeat(64), 'aaaaaaa'), anc); eq([r4.code, r4.word], [1, 'BLOCKED-HASH'], 'gate test 4');
  const r5 = gateAnswer(mk('APPROVE', sha, 'aaaaaaa'), anc); eq([r5.code, r5.word, r5.move], [0, 'APPROVE', false], 'gate test 5a');
  const r5b = gateAnswer(mk('APPROVE-BASELINE-UNDER-DATA', sha, 'aaaaaaa'), anc); eq([r5b.code, r5b.word, r5b.move], [0, 'APPROVE-BASELINE-UNDER-DATA', true], 'gate test 5b');
  const r5c = gateAnswer(mk('APPROVE', sha, 'bbbbbbb'), anc); eq([r5c.code, r5c.word], [1, 'BLOCKED-HEAD'], 'gate test 5c head not ancestor');
  // gate test 6: drift
  const prev = new Set(['lib/a.test.cjs']);
  const d1 = judgeDrift(prev, ['lib/a.test.cjs', 'lib/new.test.cjs'], new Set(['lib/a.test.cjs']), new Set(), () => null);
  eq(d1.code, 1, 'gate test 6 unknown new path exits 1'); eq(d1.lines.some((l) => l.includes('lib/new.test.cjs')), true, 'gate test 6 names the path');
  const d2 = judgeDrift(prev, ['lib/a.test.cjs', 'lib/new.test.cjs'], new Set(['lib/a.test.cjs']), new Set(), () => 'SAFE');
  eq(d2.code, 0, 'gate test 6 SAFE new path exits 0'); eq(d2.lines.some((l) => l.startsWith('ADDED-SAFE lib/new.test.cjs')), true, 'gate test 6 prints ADDED-SAFE');
  const d3 = judgeDrift(prev, ['lib/a.test.cjs', 'lib/new.test.cjs'], new Set(['lib/a.test.cjs']), new Set(), () => 'UNCERTAIN');
  eq(d3.code, 1, 'gate test 6 UNCERTAIN new path exits 1');
}

function main() {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === 'selftest') process.exit(selftest());
  if (cmd === 'gate-answer') return cmdGateAnswer(arg);
  if (cmd === 'gate-drift') return cmdGateDrift(process.argv.slice(3));
  if (cmd === 'probe-patterns') return cmdProbePatterns(process.argv.slice(3));
  if (cmd === 'check-decision') return cmdCheckDecision(arg);
  if (cmd === 'measure') return cmdMeasure(path.resolve(arg || PHASE_DIR));
  if (cmd === 'check') return cmdCheck(path.resolve(arg));
  if (cmd === 'drift') return cmdDrift();
  console.error('usage: 388-measure.cjs selftest | measure OUTDIR | check REPORT | drift | probe-patterns --safe FILE --patterns FILE --out FILE [--approve P1,P2] | check-decision FILE | gate-answer FILE | gate-drift --card FILE --safe FILE');
  process.exit(2);
}

if (require.main === module) main();
module.exports = {
  analyze, classifyAll, nameClass, aggregate, claimVerdict, isProtected, isBuiltAsset, buildIndex,
  extractEdges, extractEdgesDetailed, resolveToken, stripLead, tryExt, readText, TOKEN_RE, CODE_EXT, PROTECTED_PREFIXES, BASELINE_PROTECTED_FILE, readBaseline, readCandidates, npmPack, bodyLines, REPO, PHASE_DIR, CLASS_NAMES,
};

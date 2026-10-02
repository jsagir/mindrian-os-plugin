#!/usr/bin/env node
'use strict';
/**
 * tests/test-369-hook-require-graph.cjs  (Phase 369, plan 03, D-17 / TS369-05)
 *
 * Proof that no module reachable from any hooks/hooks.json entry is TypeScript
 * (.ts, .mts, .cts). Hooks stay .cjs (D-17): the first .ts file a process loads
 * costs about 44 ms once, and eight UserPromptSubmit hooks would pay that on
 * every prompt.
 *
 * Roots: every node script path in a hooks.json command, plus every node script
 * path a bash hook script references (the run-hook.cmd wrapper execs bash scripts
 * under scripts/, which call node on .cjs files; bash scripts they call are
 * followed too). The walk parses string-literal require('...') / import('...')
 * calls with relative specifiers, resolved like Node (exact, then .js, .cjs,
 * .json, then /index.js). Bare package names are leaves. Non-literal require
 * sites are counted (advisory; a dynamic require cannot be proven statically).
 *
 * Also: the cold-start baseline fixture exists, parses, and every measured
 * entry has p95_ms below its timeout_ms.
 *
 * The walker is exported (walkRequireGraph, scanBashRoots) so the mutation arm
 * and later plans can reuse it.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const TS_EXT = /\.(ts|mts|cts)$/;
const RESOLVE_EXTS = ['', '.js', '.cjs', '.json'];

// ---------------------------------------------------------------------------
// walker
// ---------------------------------------------------------------------------

function stripWholeLineComments(src) {
  return src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
}

function resolveRelative(fromFile, spec) {
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const ext of RESOLVE_EXTS) {
    const cand = base + ext;
    try { if (fs.statSync(cand).isFile()) return cand; } catch (_) { /* next */ }
  }
  for (const idx of ['index.js', 'index.cjs']) {
    const cand = path.join(base, idx);
    try { if (fs.statSync(cand).isFile()) return cand; } catch (_) { /* next */ }
  }
  return null;
}

/**
 * walkRequireGraph(roots): roots is an array of absolute file paths.
 * Returns { reachable: Set<string>, violations: [{file, chain}], dynamicSites: number, unresolved: string[] }.
 * A violation is a reachable file ending .ts/.mts/.cts, or a require literal naming such a file.
 */
function walkRequireGraph(roots) {
  const reachable = new Set();
  const parent = new Map();
  const violations = [];
  const unresolved = [];
  let dynamicSites = 0;
  const queue = [];

  const chainOf = (file) => {
    const chain = [];
    let cur = file;
    while (cur) { chain.unshift(cur); cur = parent.get(cur); }
    return chain;
  };

  for (const r of roots) {
    if (!reachable.has(r)) { reachable.add(r); parent.set(r, null); queue.push(r); }
  }

  while (queue.length) {
    const file = queue.shift();
    if (TS_EXT.test(file)) {
      violations.push({ file, chain: chainOf(file), kind: 'reachable-ts-file' });
      continue; // do not parse TypeScript as JavaScript
    }
    if (!/\.(c?js|mjs)$/.test(file)) continue; // json and others are leaves
    let src;
    try { src = fs.readFileSync(file, 'utf8'); } catch (_) { continue; }
    if (src.startsWith('#!')) src = '//' + src;
    src = stripWholeLineComments(src);

    const lit = /\b(?:require|import)\s*\(\s*(['"])([^'"\n]+)\1\s*\)/g;
    let m;
    while ((m = lit.exec(src)) !== null) {
      const spec = m[2];
      if (!spec.startsWith('.')) continue; // bare package or node: builtin = leaf
      if (TS_EXT.test(spec)) {
        violations.push({ file: path.resolve(path.dirname(file), spec), chain: chainOf(file), kind: 'require-literal-names-ts', literal: spec });
        continue;
      }
      const resolved = resolveRelative(file, spec);
      if (!resolved) { unresolved.push(path.relative(REPO, file) + ' -> ' + spec); continue; }
      if (!reachable.has(resolved)) { reachable.add(resolved); parent.set(resolved, file); queue.push(resolved); }
    }
    const dyn = src.match(/\brequire\s*\(\s*[^'"\s)]/g);
    if (dyn) dynamicSites += dyn.length;
  }
  return { reachable, violations, dynamicSites, unresolved };
}

// ---------------------------------------------------------------------------
// roots from hooks.json and bash hook scripts
// ---------------------------------------------------------------------------

const VAR_ROOT = /^\$\{?(CLAUDE_PLUGIN_ROOT|PLUGIN_ROOT|PLUGIN_ROOT_FOR_NODE)\}?\//;
const VAR_SCRIPTS = /^\$\{?SCRIPT_DIR\}?\//;

function mapToken(tok, scriptsDir) {
  if (VAR_ROOT.test(tok)) return path.join(REPO, tok.replace(VAR_ROOT, ''));
  if (VAR_SCRIPTS.test(tok)) return path.join(scriptsDir, tok.replace(VAR_SCRIPTS, ''));
  return null;
}

/**
 * scanBashRoots(bashFile, seen): node script paths a bash hook script references, following bash scripts it calls.
 * Returns { roots: Set<string>, tsTokens: string[], bashScanned: Set<string> }.
 */
function scanBashRoots(bashFile, acc) {
  acc = acc || { roots: new Set(), tsTokens: [], bashScanned: new Set() };
  if (acc.bashScanned.has(bashFile)) return acc;
  acc.bashScanned.add(bashFile);
  let src;
  try { src = fs.readFileSync(bashFile, 'utf8'); } catch (_) { return acc; }
  const scriptsDir = path.join(REPO, 'scripts');
  const tok = /\$\{?(?:CLAUDE_PLUGIN_ROOT|PLUGIN_ROOT_FOR_NODE|PLUGIN_ROOT|SCRIPT_DIR)\}?\/[A-Za-z0-9_./-]+/g;
  let m;
  while ((m = tok.exec(src)) !== null) {
    const raw = m[0];
    const abs = mapToken(raw, scriptsDir);
    if (!abs) continue;
    if (TS_EXT.test(abs)) { acc.tsTokens.push(path.relative(REPO, bashFile) + ': ' + raw); continue; }
    if (/\.(c?js|mjs)$/.test(abs)) {
      if (fs.existsSync(abs)) acc.roots.add(abs);
      continue;
    }
    // extensionless sibling bash script (for example banner): follow it
    try {
      if (fs.statSync(abs).isFile() && !path.extname(abs)) {
        const head = fs.readFileSync(abs, 'utf8').slice(0, 120);
        if (/^#!.*\b(ba)?sh\b/.test(head)) scanBashRoots(abs, acc);
      }
    } catch (_) { /* not a file */ }
  }
  // bare repo-relative node invocations: node scripts/x.cjs, node lib/core/x.cjs
  const bare = /\bnode\s+["']?((?:scripts|lib|bin)\/[A-Za-z0-9_./-]+)/g;
  while ((m = bare.exec(src)) !== null) {
    const abs = path.join(REPO, m[1]);
    if (TS_EXT.test(abs)) { acc.tsTokens.push(path.relative(REPO, bashFile) + ': ' + m[0]); continue; }
    if (/\.(c?js|mjs)$/.test(abs) && fs.existsSync(abs)) acc.roots.add(abs);
  }
  return acc;
}

function hookRoots(hooksJsonPath) {
  const doc = JSON.parse(fs.readFileSync(hooksJsonPath, 'utf8'));
  const roots = new Set();
  const bashFiles = [];
  const tsTokens = [];
  const acc = { roots, tsTokens, bashScanned: new Set() };
  for (const event of Object.keys(doc.hooks || {})) {
    for (const group of doc.hooks[event]) {
      for (const h of group.hooks || []) {
        if (h.type !== 'command') continue;
        const cmd = h.command;
        // node "${CLAUDE_PLUGIN_ROOT}/scripts/x.cjs" args
        const nodeM = /\bnode\s+"?\$\{CLAUDE_PLUGIN_ROOT\}\/([^"\s]+)/.exec(cmd);
        if (nodeM) {
          const abs = path.join(REPO, nodeM[1]);
          if (TS_EXT.test(abs)) tsTokens.push(event + ': ' + cmd);
          else roots.add(abs);
          continue;
        }
        // "${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd" <script-name> args
        const runM = /run-hook\.cmd"?\s+([A-Za-z0-9_.-]+)/.exec(cmd);
        if (runM) {
          const bashFile = path.join(REPO, 'scripts', runM[1]);
          bashFiles.push(bashFile);
          scanBashRoots(bashFile, acc);
        }
      }
    }
  }
  return { roots, bashFiles, tsTokens, bashScanned: acc.bashScanned };
}

// ---------------------------------------------------------------------------
// harness
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
function ok(name, extra) { passed += 1; process.stdout.write('  PASS ' + name + (extra ? ' (' + extra + ')' : '') + '\n'); }
function bad(name, detail) { failed += 1; process.stdout.write('  FAIL ' + name + '\n'); if (detail) process.stdout.write('    ' + String(detail).split('\n').join('\n    ') + '\n'); }

function main() {
  process.stdout.write('test-369-hook-require-graph\n');

  // ---- arm 1: the real hooks reach no TypeScript
  const hooksJson = path.join(REPO, 'hooks', 'hooks.json');
  const { roots, bashFiles, tsTokens, bashScanned } = hookRoots(hooksJson);
  const rootList = [...roots].sort();
  const walk = walkRequireGraph(rootList);
  process.stdout.write('  roots: ' + rootList.length + ' node scripts (from ' + bashFiles.length + ' run-hook.cmd bash scripts, ' + bashScanned.size + ' bash files scanned)\n');
  process.stdout.write('  reachable files: ' + walk.reachable.size + '\n');
  process.stdout.write('  non-literal require sites (advisory, not provable statically): ' + walk.dynamicSites + '\n');
  process.stdout.write('  unresolved relative requires (advisory, usually guarded optional requires): ' + walk.unresolved.length + '\n');
  if (rootList.length === 0 || walk.reachable.size === 0) {
    bad('arm 1: the walk found roots and reachable files', 'roots ' + rootList.length + ', reachable ' + walk.reachable.size);
  } else if (walk.violations.length || tsTokens.length) {
    const lines = walk.violations.map((v) => v.kind + ': ' + path.relative(REPO, v.file) + ' via ' + v.chain.map((c) => path.relative(REPO, c)).join(' -> '))
      .concat(tsTokens.map((t) => 'ts token in hook command or bash script: ' + t));
    bad('arm 1: no TypeScript reachable from any hooks.json entry', lines.join('\n'));
  } else {
    ok('arm 1: no TypeScript reachable from any hooks.json entry', '0 TypeScript modules reachable from hooks');
    process.stdout.write('  0 TypeScript modules reachable from hooks\n');
  }

  // ---- arm 2: mutation - the walker catches a planted .ts with its chain
  {
    const name = 'arm 2: mutation - a root requiring ./a.cjs which requires ./b.ts is reported with its path chain';
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-369-graph-'));
    try {
      fs.writeFileSync(path.join(tmp, 'root.cjs'), "const a = require('./a.cjs');\nmodule.exports = a;\n");
      fs.writeFileSync(path.join(tmp, 'a.cjs'), "const b = require('./b.ts');\nmodule.exports = b;\n");
      fs.writeFileSync(path.join(tmp, 'b.ts'), 'module.exports = { x: 1 as number };\n');
      const w = walkRequireGraph([path.join(tmp, 'root.cjs')]);
      const v = w.violations[0];
      const chain = v && v.chain.map((c) => path.basename(c)).join(' -> ');
      if (v && /root\.cjs -> a\.cjs/.test(chain) && path.basename(v.file) === 'b.ts') ok(name, 'chain ' + chain + ' -> b.ts');
      else bad(name, 'violations: ' + JSON.stringify(w.violations));

      // a require of a .mts that does not exist is still a violation (the literal names TypeScript)
      fs.writeFileSync(path.join(tmp, 'root2.cjs'), "require('./missing.mts');\n");
      const w2 = walkRequireGraph([path.join(tmp, 'root2.cjs')]);
      if (w2.violations.length === 1 && w2.violations[0].kind === 'require-literal-names-ts') ok('arm 2b: mutation - a require literal naming a .mts is a violation even when the file is absent');
      else bad('arm 2b: require literal naming .mts', JSON.stringify(w2.violations));

      // a clean tree passes
      fs.writeFileSync(path.join(tmp, 'clean.cjs'), "const fs = require('node:fs');\nconst a = require('./a2.cjs');\nmodule.exports = [fs, a];\n");
      fs.writeFileSync(path.join(tmp, 'a2.cjs'), 'module.exports = 1;\n');
      const w3 = walkRequireGraph([path.join(tmp, 'clean.cjs')]);
      if (w3.violations.length === 0 && w3.reachable.size === 2) ok('arm 2c: a clean tree reports no violation');
      else bad('arm 2c: clean tree', JSON.stringify({ v: w3.violations, r: w3.reachable.size }));
    } finally {
      try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* best effort */ }
    }
  }

  // ---- arm 3: the baseline fixture
  {
    const name = 'arm 3: hook cold-start baseline fixture exists, parses, and every measured p95_ms is below its timeout_ms';
    const fx = path.join(REPO, 'tests', 'fixtures', '369', 'hook-cold-start-baseline.json');
    if (!fs.existsSync(fx)) {
      bad(name, 'missing ' + path.relative(REPO, fx) + ' (run: node scripts/measure-hook-cold-start.cjs --n 10 --json --out tests/fixtures/369/hook-cold-start-baseline.json)');
    } else {
      let b = null;
      try { b = JSON.parse(fs.readFileSync(fx, 'utf8')); } catch (e) { bad(name, 'fixture does not parse: ' + e.message); }
      if (b) {
        const missingKeys = ['machine', 'node', 'measured_at', 'n', 'entries'].filter((k) => !(k in b));
        const breaches = [];
        let measured = 0;
        for (const e of b.entries || []) {
          if (e.not_measured) continue;
          measured += 1;
          if (!(typeof e.p50_ms === 'number' && typeof e.p95_ms === 'number' && typeof e.max_ms === 'number' && typeof e.timeout_ms === 'number')) {
            breaches.push('entry without numeric p50/p95/max/timeout: ' + e.command);
          } else if (!(e.p95_ms < e.timeout_ms)) {
            breaches.push(e.event + ' ' + e.command + ': p95 ' + e.p95_ms + ' ms is not below timeout ' + e.timeout_ms + ' ms');
          }
        }
        if (missingKeys.length) bad(name, 'fixture is missing keys: ' + missingKeys.join(', '));
        else if (!measured) bad(name, 'no measured entries');
        else if (breaches.length) bad(name, breaches.join('\n'));
        else ok(name, measured + ' measured entries, n=' + b.n + ', node ' + b.node);
      }
    }
  }

  process.stdout.write('\ntest-369-hook-require-graph: ' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed ? 1 : 0);
}

if (require.main === module) main();

module.exports = { walkRequireGraph, scanBashRoots, hookRoots };

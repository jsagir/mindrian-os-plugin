#!/usr/bin/env node
'use strict';

/*
 * Phase 369.1 plan 04 (DPI-04, D-10): the bin/ to scripts/ reference codemod.
 * ===========================================================================
 * The five runtime executables moved from bin/ to scripts/. This script
 * rewrites every shipped line that still invokes them at the old path, so the
 * move is scripted (never hand-edited) and repeatable. It walks the same
 * surfaces as tests/test-369.1-bin-relocation.cjs (--surface code | docs) and
 * edits NON-comment lines only (the gate's comment rule).
 *
 * Modes (argv router):
 *   --code      rewrite the code surface (.mcp.json, hooks, scripts, lib, data)
 *   --docs      rewrite the docs surface (commands, hand-authored skills, ...)
 *   --dry-run   print every edit, write nothing (combinable with either)
 *   --check     write nothing; exit 1 if any rewrite is still pending or a
 *               gate-matching line has no rewrite rule
 *   (no --code and no --docs means both)
 *
 * Rewrites, each printed as file:line, before and after:
 *   (1) code/JSON: <root-anchor>/bin/<NAME>  ->  <root-anchor>/scripts/<NAME>
 *   (2) code:      'bin', '<NAME>'           ->  'scripts', '<NAME>'
 *   (3) code:      'bin/<NAME>' "bin/<NAME>" ->  scripts/<NAME> (same quotes)
 *   (3b) code:     '../bin/<NAME>'           ->  '../scripts/<NAME>'
 *   (4) commands/*.md: node bin/<NAME>  ->  node "${CLAUDE_PLUGIN_ROOT}/scripts/<NAME>"
 *                      {plugin_root}/bin/<NAME> -> {plugin_root}/scripts/<NAME>
 *   (5) hand-authored skills (no commands/<name>.md behind them, plus the
 *       mirror SKIP_LIST): node bin/<NAME> -> node "<PORTABLE TOKEN>/scripts/<NAME>"
 * Skill mirrors (a skill with a commands/ source) are never edited: they are
 * reported as "mirror, regenerate" (scripts/build-skill-mirrors.cjs rewrites
 * them from the command).
 *
 * Never touched: bin/, tests/, docs/, CHANGELOG.md, data/capability-ledger.json,
 * lib/import/PRECONDITIONS.md, any *.test.cjs. A second run reports 0 edits.
 * Built-ins only. Hyphens only.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

const NAMES = [
  'mindrian-mcp-server.cjs',
  'mindrian-brain-mcp-client.cjs',
  'mindrian-mcp-shim.cjs',
  'mindrian-tools.cjs',
  'local-chain-recommender.cjs',
];
const NAME_ALT = NAMES.map((n) => n.replace(/\./g, '\\.')).join('|');

// Copied verbatim from scripts/migrate-plugin-root-refs.cjs (the fail-closed
// portable form for hand-authored skills).
const PLUGIN_ROOT_PORTABLE_TOKEN =
  '${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. ' +
  'Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}';

// The gate's six patterns (tests/test-369.1-bin-relocation.cjs), used by
// --check to find a line that still matches and has no rewrite rule.
const GATE_PATTERNS = [
  'node\\s+["\']?bin/(mindrian-[a-z-]+|local-chain-recommender)\\.cjs',
  '(\\$\\{CLAUDE_PLUGIN_ROOT\\}|\\{plugin_root\\}|\\$\\{?PLUGIN_ROOT\\}?|\\$\\{MINDRIAN_OS_ROOT[^}]*\\}\\}?)/bin/(mindrian-[a-z-]+|local-chain-recommender)\\.cjs',
  '[\'"]bin[\'"]\\s*,\\s*[\'"](mindrian-[a-z-]+|local-chain-recommender)\\.cjs[\'"]',
  '[\'"](\\.\\./)+bin/(mindrian-|local-chain)',
  'path\\.(join|resolve)\\([^)]*[\'"]bin/(mindrian-|local-chain)',
  '"bin/(mindrian-[a-z-]+|local-chain-recommender)\\.cjs"',
].map((s) => new RegExp(s));

const ROOT_ANCHOR =
  '(\\$\\{CLAUDE_PLUGIN_ROOT\\}|\\{plugin_root\\}|\\$\\{?PLUGIN_ROOT\\}?|\\$\\{MINDRIAN_OS_ROOT[^}]*\\}\\}?)';
const RULES = {
  // (1)
  anchor: [new RegExp(ROOT_ANCHOR + '/bin/(' + NAME_ALT + ')', 'g'), '$1/scripts/$2'],
  // (2)
  pieces: [new RegExp('([\'"])bin\\1(\\s*,\\s*)([\'"])(' + NAME_ALT + ')\\3', 'g'), '$1scripts$1$2$3$4$3'],
  // (3)
  literal: [new RegExp('([\'"])bin/(' + NAME_ALT + ')\\1', 'g'), '$1scripts/$2$1'],
  // (3b)
  relative: [new RegExp('([\'"])((?:\\.\\./)+)bin/(' + NAME_ALT + ')', 'g'), '$1$2scripts/$3'],
  // (4) commands: node bin/NAME -> node "${CLAUDE_PLUGIN_ROOT}/scripts/NAME"
  nodeCmd: [new RegExp('node (")?bin/(' + NAME_ALT + ')', 'g'), (m, q, n) => 'node "${CLAUDE_PLUGIN_ROOT}/scripts/' + n + (q ? '' : '"')],
  // (5) hand-authored skills
  nodeSkill: [new RegExp('node (")?bin/(' + NAME_ALT + ')', 'g'), (m, q, n) => 'node "' + PLUGIN_ROOT_PORTABLE_TOKEN + '/scripts/' + n + (q ? '' : '"')],
};

const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', '.git']);
const SHELL_EXTENSIONLESS = new Set(['session-start', 'post-write', 'compute-opportunity-state']);

function walk(dir, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return; }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(path.join(dir, e.name), out);
    } else if (e.isFile()) {
      if (/\.test\.cjs$/.test(e.name)) continue;
      out.push(path.join(dir, e.name));
    }
  }
}

function rel(f) {
  return path.relative(REPO_ROOT, f).split(path.sep).join('/');
}

function listCodeSurface() {
  const files = [];
  for (const r of ['.mcp.json', 'settings.json']) {
    if (fs.existsSync(path.join(REPO_ROOT, r))) files.push(path.join(REPO_ROOT, r));
  }
  for (const d of ['hooks', 'scripts', 'lib']) walk(path.join(REPO_ROOT, d), files);
  const dataDir = path.join(REPO_ROOT, 'data');
  if (fs.existsSync(dataDir)) {
    for (const n of fs.readdirSync(dataDir)) {
      if (n.endsWith('.json') && n !== 'capability-ledger.json') files.push(path.join(dataDir, n));
    }
  }
  return files.filter((f) => {
    const r = rel(f);
    return r !== 'lib/import/PRECONDITIONS.md' && r !== 'CHANGELOG.md';
  });
}

function listDocsSurface() {
  const files = [];
  const cmd = path.join(REPO_ROOT, 'commands');
  if (fs.existsSync(cmd)) for (const n of fs.readdirSync(cmd)) if (n.endsWith('.md')) files.push(path.join(cmd, n));
  const skills = path.join(REPO_ROOT, 'skills');
  if (fs.existsSync(skills)) {
    for (const d of fs.readdirSync(skills, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const f = path.join(skills, d.name, 'SKILL.md');
      if (fs.existsSync(f)) files.push(f);
    }
  }
  const agents = path.join(REPO_ROOT, 'agents');
  if (fs.existsSync(agents)) for (const n of fs.readdirSync(agents)) if (n.endsWith('.md')) files.push(path.join(agents, n));
  const pipes = [];
  walk(path.join(REPO_ROOT, 'pipelines'), pipes);
  for (const f of pipes) if (f.endsWith('.md')) files.push(f);
  walk(path.join(REPO_ROOT, 'templates'), files);
  walk(path.join(REPO_ROOT, 'references'), files);
  return files;
}

function isProbablyBinary(buf) {
  const n = Math.min(buf.length, 8000);
  for (let i = 0; i < n; i += 1) if (buf[i] === 0) return true;
  return false;
}

// The gate's comment rule, kept identical.
function commentKind(file) {
  const base = path.basename(file);
  const ext = path.extname(base);
  if (['.cjs', '.js', '.mjs', '.ts', '.tsx'].includes(ext)) return 'js';
  if (ext === '.sh' || ext === '.bash' || (ext === '' && SHELL_EXTENSIONLESS.has(base))) return 'sh';
  if (ext === '') {
    try {
      const head = fs.readFileSync(file, 'utf8').slice(0, 80);
      if (/^#!.*\b(bash|sh|zsh)\b/.test(head)) return 'sh';
      if (/^#!.*\bnode\b/.test(head)) return 'js';
    } catch (_e) { /* fall through */ }
  }
  return 'none';
}

function isCommentLine(kind, line) {
  const t = line.trim();
  if (kind === 'js') return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
  if (kind === 'sh') return t.startsWith('#');
  return false;
}

function applyRules(line, rules) {
  let out = line;
  for (const r of rules) out = out.replace(r[0], r[1]);
  return out;
}

function gateMatches(line) {
  return GATE_PATTERNS.some((r) => r.test(line));
}

// docs classification: 'command', 'hand-skill', 'mirror', 'other-doc'
function docKind(file) {
  const r = rel(file);
  if (/^commands\/[^/]+\.md$/.test(r)) return 'command';
  const m = r.match(/^skills\/([^/]+)\/SKILL\.md$/);
  if (m) {
    let skipList = ['trending-to-absurd'];
    try { skipList = require(path.join(REPO_ROOT, 'scripts', 'build-skill-mirrors.cjs')).SKIP_LIST || skipList; } catch (_e) { /* keep default */ }
    const hasCommand = fs.existsSync(path.join(REPO_ROOT, 'commands', m[1] + '.md'));
    if (!hasCommand || skipList.includes(m[1])) return 'hand-skill';
    return 'mirror';
  }
  return 'other-doc';
}

function processFile(file, surface, write) {
  const edits = [];
  const mirrors = [];
  const unhandled = [];
  let buf;
  try {
    if (fs.statSync(file).size > 4 * 1024 * 1024) return { edits, mirrors, unhandled };
    buf = fs.readFileSync(file);
  } catch (_e) { return { edits, mirrors, unhandled }; }
  if (isProbablyBinary(buf)) return { edits, mirrors, unhandled };

  const kind = surface === 'code' ? commentKind(file) : 'none';
  const dk = surface === 'docs' ? docKind(file) : null;
  let rules;
  if (surface === 'code') rules = [RULES.anchor, RULES.pieces, RULES.literal, RULES.relative];
  else if (dk === 'command') rules = [RULES.nodeCmd, RULES.anchor];
  else if (dk === 'hand-skill') rules = [RULES.nodeSkill, RULES.anchor];
  else rules = [];

  const lines = buf.toString('utf8').split('\n');
  let changed = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (isCommentLine(kind, line)) continue;
    if (!gateMatches(line)) continue;
    const where = rel(file) + ':' + (i + 1);
    if (dk === 'mirror') { mirrors.push(where + ': mirror, regenerate'); continue; }
    const next = applyRules(line, rules);
    if (next !== line) {
      edits.push({ where, before: line.trim().slice(0, 200), after: next.trim().slice(0, 200) });
      lines[i] = next;
      changed = true;
      if (gateMatches(next)) unhandled.push(where + ': still matches after rewrite');
    } else {
      unhandled.push(where + ': no rewrite rule (' + (dk || 'code') + ')');
    }
  }
  if (changed && write) fs.writeFileSync(file, lines.join('\n'));
  return { edits, mirrors, unhandled };
}

function run(surface, opts) {
  const files = surface === 'code' ? listCodeSurface() : listDocsSurface();
  const total = { edits: [], mirrors: [], unhandled: [] };
  for (const f of files) {
    const r = processFile(f, surface, !opts.dry && !opts.check);
    total.edits.push(...r.edits);
    total.mirrors.push(...r.mirrors);
    total.unhandled.push(...r.unhandled);
  }
  return total;
}

function main() {
  const argv = process.argv.slice(2);
  const opts = { code: false, docs: false, dry: false, check: false };
  for (const a of argv) {
    switch (a) {
      case '--code': opts.code = true; break;
      case '--docs': opts.docs = true; break;
      case '--dry-run': opts.dry = true; break;
      case '--check': opts.check = true; break;
      default:
        console.error('unknown argument: ' + a + ' (use --code, --docs, --dry-run, --check)');
        process.exit(2);
    }
  }
  if (!opts.code && !opts.docs) { opts.code = true; opts.docs = true; }

  let editCount = 0;
  let pending = 0;
  for (const surface of ['code', 'docs']) {
    if (!opts[surface]) continue;
    const r = run(surface, opts);
    for (const e of r.edits) {
      console.log(e.where + ': ' + e.before + '  =>  ' + e.after);
    }
    for (const m of r.mirrors) console.log(m);
    for (const u of r.unhandled) console.log('UNHANDLED ' + u);
    editCount += r.edits.length;
    pending += r.edits.length + r.mirrors.length + r.unhandled.length;
    console.log('[' + surface + '] ' + r.edits.length + ' edits' + (opts.dry || opts.check ? ' (not written)' : '') +
      ', ' + r.mirrors.length + ' mirror line(s) to regenerate, ' + r.unhandled.length + ' unhandled');
  }
  console.log(editCount + ' edits');
  if (opts.check) {
    console.log(pending ? 'CHECK FAIL: ' + pending + ' pending' : 'CHECK OK');
    process.exit(pending ? 1 : 0);
  }
  process.exit(0);
}

main();

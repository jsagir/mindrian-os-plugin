#!/usr/bin/env node
// Phase 389 plan 01: caller scan for the MVA family. Read-only except --out FILE.
// Node built-ins only. Hyphens only.
//
// Commands:
//   selftest               run the self-test (exit 0 pass, 1 fail)
//   scan --out FILE        write the caller table (TSV) and print the class counts
//   allow --plan NN        print the paths plan NN must edit or delete (reads the TSV)
//                          optional: --table FILE (default: 389-CALLERS.tsv next to this script)
//   classes                scan and print counts per class and the LIVE-NON-FAMILY list
//
// A hit is a line that names a token (fixed string). A hit is a CALLER only when its
// class is spawn, require or path-string. A name alone is never a caller.
//
// Class order, strongest first: spawn, require, path-string, data, doc, comment, test.
//   test        : the file is a test file (tests/, *.test.cjs, test-*.cjs, evals/)
//   data        : a data file (.json .tsv .yml .yaml) or a code line that holds the name
//                 only as a plain string (an id, a label)
//   doc         : a prose file (.md .txt .html)
//   comment     : a code line whose first token is a comment marker
//   spawn       : a code line that starts a process and names the token
//   require     : a code line with require( or import that names the token
//   path-string : a code line that builds or holds a file path to the token
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// token -> plan that decides its fate (fixed by the plan text)
const TOKEN_FATE = [
  ['mva-detect', '07'],
  ['mva-pipeline', '08'],
  ['mva-option-router', '08'],
  ['mva-option', '08'],
  ['mva-brief', '09'],
  ['mva-orchestrator', '10'],
  ['mva-state', '10'],
  ['mva-progressive-renderer', '10'],
  ['mva-telemetry', '10'],
  ['mva-run', '10'],
  ['lib/agents/mva', '10'],
  ['mva-agent-prompts', '10'],
  ['mva-report', '11'],
  ['mva-deck-builder', '12'],
  ['mva-vercel-deploy', '12'],
  ['resolve-vercel-key', '12'],
  ['mva-classifier', '13'],
  ['mva-rule-linter', '13'],
  ['mva-dispatcher', '13'],
  ['mva-budget', '13'],
  ['mva-agent-contract', '13'],
];
const FATE = new Map(TOKEN_FATE);

const CLASS_ORDER = ['spawn', 'require', 'path-string', 'data', 'doc', 'comment', 'test'];
const CALLER_CLASSES = new Set(['spawn', 'require', 'path-string']);

const CODE_EXT = new Set(['.cjs', '.js', '.mjs', '.ts', '.tsx', '.sh', '.py']);
const DATA_EXT = new Set(['.json', '.tsv', '.yml', '.yaml']);
const DOC_EXT = new Set(['.md', '.txt', '.html']);

function esc(s) {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

function tokenRegex(token) {
  // Not glued to a longer name on the left. On the right, not followed by a name
  // character; mva-option must not match the start of mva-option-router.
  let tail = '(?![A-Za-z0-9_])';
  if (token === 'mva-option') tail = '(?![A-Za-z0-9_]|-router)';
  return new RegExp('(?<![A-Za-z0-9_-])' + esc(token) + tail);
}
const TOKEN_RE = new Map(TOKEN_FATE.map(([t]) => [t, tokenRegex(t)]));

function isTestFile(f) {
  const base = path.basename(f);
  return (
    f.startsWith('tests/') ||
    f.startsWith('evals/') ||
    /\.test\.cjs$/.test(f) ||
    /\.smoke\.test\.cjs$/.test(f) ||
    base.startsWith('test-')
  );
}

function isCodeFile(f) {
  const ext = path.extname(f);
  if (CODE_EXT.has(ext)) return true;
  if (ext === '' && (f.startsWith('scripts/') || f.startsWith('bin/') || f.startsWith('hooks/'))) return true;
  return false;
}

// Class of one line of one file for one token.
function classifyLine(file, line) {
  if (isTestFile(file)) return 'test';
  const ext = path.extname(file);
  if (DATA_EXT.has(ext)) return 'data';
  if (DOC_EXT.has(ext)) return 'doc';
  if (!isCodeFile(file)) return 'doc';
  const t = line.trim();
  if (/^(\/\/|#|\*|\/\*|<!--|--)/.test(t)) return 'comment';
  if (/\b(spawn|spawnSync|execFile|execFileSync|execSync|exec|fork)\s*\(/.test(line)) return 'spawn';
  // a shell line that runs node on the script
  if (/(^|[\s;&|`$(])node\s+["']?[^\s]*\.(cjs|js|mjs)/.test(line)) return 'spawn';
  if (/\brequire\s*\(|\bimport\s[^;]*\sfrom\s|\bimport\s*\(/.test(line)) return 'require';
  if (
    /\bpath\.(join|resolve)\s*\(|\bjoin\s*\(|\bresolve\s*\(/.test(line) ||
    /[A-Za-z0-9_-]\.(cjs|js|mjs|ts|json|md|sh)\b/.test(line) ||
    /[A-Za-z0-9_-]\/[A-Za-z0-9_.-]/.test(line)
  ) {
    return 'path-string';
  }
  return 'data';
}

function strongest(classes) {
  let best = null;
  for (const c of classes) {
    if (best === null || CLASS_ORDER.indexOf(c) < CLASS_ORDER.indexOf(best)) best = c;
  }
  return best;
}

// The token that is part of the file's own path (longest match), or ''.
function selfToken(file) {
  let best = '';
  for (const [t] of TOKEN_FATE) {
    if (file.includes(t) && t.length > best.length) best = t;
  }
  return best;
}
function selfPlan(file) {
  const t = selfToken(file);
  return t ? FATE.get(t) : '';
}

// rows: array of {token,file,fate_plan,self_plan}. Returns sorted unique paths.
function allowPaths(rows, plan) {
  const out = new Set();
  for (const r of rows) {
    if (r.fate_plan !== plan) continue;
    if (r.self_plan && r.self_plan !== plan) continue;
    out.add(r.file);
  }
  return Array.from(out).sort();
}

const HEADER = ['token', 'file', 'hits', 'class', 'fate_plan', 'self_plan', 'note'];

function parseTsv(text) {
  const lines = text.split('\n').filter(Boolean);
  const head = lines[0].split('\t');
  return lines.slice(1).map((l) => {
    const cells = l.split('\t');
    const o = {};
    head.forEach((h, i) => (o[h] = cells[i] === undefined ? '' : cells[i]));
    return o;
  });
}

function repoRoot() {
  const r = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : process.cwd();
}

function isExcludedPath(f) {
  return (
    f.startsWith('.planning/') ||
    f.startsWith('docs/') ||
    f.startsWith('r-and-d/') ||
    f === 'CHANGELOG.md'
  );
}

function isFamilyFile(f) {
  return (
    /^commands\/mva-/.test(f) ||
    /^skills\/mva-/.test(f) ||
    /^dist\/.*\/skills\/mva-/.test(f) ||
    /^scripts\/mva-/.test(f) ||
    /^lib\/core\/mva-/.test(f) ||
    /^lib\/core\/resolve-vercel-key/.test(f) ||
    /^lib\/agents\/mva\//.test(f) ||
    /^data\/mva-/.test(f) ||
    /^tests\/test-mva-/.test(f)
  );
}

function scan(root) {
  const ls = spawnSync('git', ['ls-files'], { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (ls.status !== 0) throw new Error('git ls-files failed');
  const files = ls.stdout.split('\n').filter(Boolean).filter((f) => !isExcludedPath(f));
  const rows = [];
  for (const f of files) {
    let text;
    try {
      const buf = fs.readFileSync(path.join(root, f));
      if (buf.includes(0)) continue; // binary
      text = buf.toString('utf8');
    } catch (_) {
      continue;
    }
    if (!/mva|vercel/i.test(text)) continue;
    const lines = text.split('\n');
    for (const [token] of TOKEN_FATE) {
      const re = TOKEN_RE.get(token);
      const classes = [];
      let firstLine = 0;
      let firstClass = null;
      let n = 0;
      for (let i = 0; i < lines.length; i++) {
        if (!re.test(lines[i])) continue;
        n++;
        const c = classifyLine(f, lines[i]);
        classes.push(c);
        if (firstClass === null || CLASS_ORDER.indexOf(c) < CLASS_ORDER.indexOf(firstClass)) {
          firstClass = c;
          firstLine = i + 1;
        }
      }
      if (n === 0) continue;
      const notes = ['L' + firstLine];
      if (f === 'hooks/hooks.json') notes.push('hook-registration');
      if (isFamilyFile(f)) notes.push('family-file');
      rows.push({
        token,
        file: f,
        hits: String(n),
        class: strongest(classes),
        fate_plan: FATE.get(token),
        self_plan: selfPlan(f),
        note: notes.join(' '),
      });
    }
  }
  rows.sort((a, b) => (a.token + '\0' + a.file < b.token + '\0' + b.file ? -1 : 1));
  return rows;
}

function toTsv(rows) {
  const out = [HEADER.join('\t')];
  for (const r of rows) out.push(HEADER.map((h) => r[h]).join('\t'));
  return out.join('\n') + '\n';
}

function classCounts(rows) {
  const counts = {};
  for (const c of CLASS_ORDER) counts[c] = 0;
  for (const r of rows) counts[r.class] += 1;
  return counts;
}

function liveNonFamily(rows) {
  const byToken = new Map();
  for (const r of rows) {
    if (!CALLER_CLASSES.has(r.class)) continue;
    if (/family-file/.test(r.note)) continue;
    if (!byToken.has(r.token)) byToken.set(r.token, []);
    byToken.get(r.token).push(r);
  }
  return byToken;
}

function printSummary(rows) {
  const counts = classCounts(rows);
  console.log('rows: ' + rows.length);
  for (const c of CLASS_ORDER) console.log('  ' + c + ': ' + counts[c]);
  console.log('');
  console.log('LIVE-NON-FAMILY callers (class spawn, require or path-string, file outside the family):');
  const live = liveNonFamily(rows);
  for (const [token] of TOKEN_FATE) {
    const list = live.get(token) || [];
    console.log('- ' + token + ' (' + list.length + ')');
    for (const r of list) console.log('    ' + r.file + ' [' + r.class + ' ' + r.note + ']');
  }
}

// ---- self-test ----
function selftest() {
  let fail = 0;
  const check = (name, ok, detail) => {
    if (ok) console.log('ok   ' + name);
    else {
      fail++;
      console.log('FAIL ' + name + (detail ? ' :: ' + detail : ''));
    }
  };
  // Self-test 1: line classes
  check('require line', classifyLine('lib/core/x.cjs', "const s = require('./mva-state.cjs');") === 'require');
  check('comment line', classifyLine('lib/core/x.cjs', '// see mva-state for the shape') === 'comment');
  check('hash comment line', classifyLine('scripts/x.sh', '# mva-run is called here') === 'comment');
  check('json line is data', classifyLine('data/x.json', '  "id": "mva-detect",') === 'data');
  check('test file line', classifyLine('tests/test-x.cjs', "require('../lib/core/mva-state.cjs')") === 'test');
  check('dot-test file line', classifyLine('lib/core/y.test.cjs', "require('./mva-state.cjs')") === 'test');
  check(
    'spawn line',
    classifyLine('scripts/first-install-router.cjs', "spawn(process.execPath, [path.join(d, 'scripts/mva-run.cjs')], {})") === 'spawn'
  );
  check(
    'path-string line',
    classifyLine('scripts/room-naming-selector.cjs', "const p = path.join(room, '.mindrian', 'mva-brief.json');") === 'path-string'
  );
  check('doc line', classifyLine('docs-like/readme.md', 'run mva-brief') === 'doc');
  check('plain id in code is data', classifyLine('lib/x.cjs', "const NAME = 'mva-detect';") === 'data');
  check('strongest picks spawn over comment', strongest(['comment', 'spawn', 'data']) === 'spawn');
  check('mva-option does not match the router name', !TOKEN_RE.get('mva-option').test("require('./mva-option-router.cjs')"));
  check('mva-option matches itself', TOKEN_RE.get('mva-option').test('commands/mva-option.md'));
  check('mva-state not glued left', !TOKEN_RE.get('mva-state').test('xmva-state'));
  // Self-test 2: allow on a synthetic table
  const rows = [
    { token: 'mva-brief', file: 'a.cjs', fate_plan: '09', self_plan: '' },
    { token: 'mva-option', file: 'b.cjs', fate_plan: '08', self_plan: '' },
    { token: 'mva-brief', file: 'c.cjs', fate_plan: '09', self_plan: '' },
    { token: 'mva-option', file: 'lib/core/mva-orchestrator.cjs', fate_plan: '08', self_plan: '10' },
    { token: 'mva-option', file: 'commands/mva-option.md', fate_plan: '08', self_plan: '08' },
    { token: 'mva-option', file: 'a.cjs', fate_plan: '08', self_plan: '' },
  ];
  const a08 = allowPaths(rows, '08');
  check(
    'allow plan 08 lists plan 08 files, sorted, skips a file owned by plan 10',
    JSON.stringify(a08) === JSON.stringify(['a.cjs', 'b.cjs', 'commands/mva-option.md']),
    JSON.stringify(a08)
  );
  const a09 = allowPaths(rows, '09');
  check('allow plan 09', JSON.stringify(a09) === JSON.stringify(['a.cjs', 'c.cjs']), JSON.stringify(a09));
  // Self-test 4: a file named in no row is never printed
  check('file in no row is not printed', !allowPaths(rows, '08').includes('z.cjs') && !allowPaths(rows, '13').length);
  check('selfPlan of a family file path', selfPlan('scripts/mva-run.cjs') === '10');
  check('selfPlan prefers the longest token', selfPlan('lib/core/mva-option-router.cjs') === '08');
  check('selfPlan empty for a foreign file', selfPlan('lib/core/navigation.cjs') === '');
  // Self-test 3: unknown token exits 1 (run this script as a child)
  const me = __filename;
  const r1 = spawnSync(process.execPath, [me, 'frobnicate'], { encoding: 'utf8' });
  check('unknown command exits 1', r1.status === 1, 'status ' + r1.status);
  const r2 = spawnSync(process.execPath, [me, 'allow', '--plan', '08', '--bogus', 'x'], { encoding: 'utf8' });
  check('unknown flag exits 1', r2.status === 1, 'status ' + r2.status);
  const r3 = spawnSync(process.execPath, [me, 'allow', '--plan', 'xx'], { encoding: 'utf8' });
  check('bad plan number exits 1', r3.status === 1, 'status ' + r3.status);
  const r4 = spawnSync(process.execPath, [me], { encoding: 'utf8' });
  check('no command exits 1', r4.status === 1, 'status ' + r4.status);
  console.log(fail === 0 ? 'selftest: PASS' : 'selftest: FAIL (' + fail + ')');
  return fail === 0 ? 0 : 1;
}

function parseFlags(args, allowedFlags) {
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith('--') || !allowedFlags.includes(a)) {
      console.error('unknown argument: ' + a);
      process.exit(1);
    }
    if (i + 1 >= args.length) {
      console.error('missing value for ' + a);
      process.exit(1);
    }
    flags[a.slice(2)] = args[++i];
  }
  return flags;
}

function main(argv) {
  const cmd = argv[0];
  if (cmd === 'selftest') return selftest();
  if (cmd === 'scan') {
    const f = parseFlags(argv.slice(1), ['--out']);
    const rows = scan(repoRoot());
    if (f.out) fs.writeFileSync(f.out, toTsv(rows));
    printSummary(rows);
    return 0;
  }
  if (cmd === 'classes') {
    parseFlags(argv.slice(1), []);
    printSummary(scan(repoRoot()));
    return 0;
  }
  if (cmd === 'allow') {
    const f = parseFlags(argv.slice(1), ['--plan', '--table']);
    if (!f.plan || !/^\d\d$/.test(f.plan)) {
      console.error('--plan NN (two digits) is required');
      return 1;
    }
    const table = f.table || path.join(__dirname, '389-CALLERS.tsv');
    if (!fs.existsSync(table)) {
      console.error('table not found: ' + table);
      return 1;
    }
    const rows = parseTsv(fs.readFileSync(table, 'utf8'));
    for (const p of allowPaths(rows, f.plan)) console.log(p);
    return 0;
  }
  console.error('usage: 389-caller-scan.cjs selftest | scan --out FILE | allow --plan NN [--table FILE] | classes');
  return 1;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { classifyLine, allowPaths, selfPlan, strongest, TOKEN_FATE };

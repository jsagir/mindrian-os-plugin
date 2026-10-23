// 380-14 static gate for the Job line (D-09, MOD380-08, T-380-55 to T-380-58).
//
// The claim: the Job line uses the plugin's own list of jobs, copied by a generator with a drift
// check; every job has a plain outcome clause; every sentence it can build passes the copy scan; and
// the sources that build the line hold no tool name, no network word and no import of the Theo
// asking code. The behavior proofs (form, sources, label, one action, canaries, budget) are the tests
// in ui/mos-face/tests/job.test.ts, run by tests/test-380-engine-tests.cjs.
//
// Legs:
//   T1  the taxonomy holds 13 jobs and hooks/jobs.ts holds the same 13, in order, with the same
//       id, want and cues (the want is the one-line with its first letter lowered and its final
//       stop mark removed), and explore is flagged never shown.
//   T2  every job has an outcome clause: plain words, no stop mark, no stack word, no dash.
//   T3  every sentence the line can build ("When I am ..., I want to ..., so that ...") passes the
//       copy scan, including the words validated, confirmed and proven.
//   N1  node ui/mos-face/scripts/face-jobs.cjs --check exits 0, and exits 1 for each of: a taxonomy
//       job with no outcome (named), a changed one-line, a changed cue, a blank outcome, a banned
//       word, an em-dash, a missing job, a stale header. The mutations run in a scratch copy.
//   N2  hooks/job.ts and hooks/jobs.ts hold no tool name, no fetch, no process call, no import of
//       advice.ts, and job.ts never names the goal field of the state file (outside a comment).
//   N3  hooks/job.ts imports only ./jobs and ../types.
// CJS, Node built-ins only. Hermetic: no network. The scratch copy is made under the system temp
// folder. Hyphens only.
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const MOD = path.join(REPO, 'ui', 'mos-face');
const HOOKS = path.join(MOD, 'hooks');
const SCRIPT = path.join(MOD, 'scripts', 'face-jobs.cjs');
const TAXONOMY = path.join(REPO, 'lib', 'hmi', 'jtbd-taxonomy.json');

let passed = 0;
let failed = 0;
function say(s) { process.stdout.write(s + '\n'); }
function check(cond, msg) {
  if (cond) { passed += 1; say('  ok ' + msg); } else { failed += 1; say('  FAIL ' + msg); }
}

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
const WORD_RULES = [
  ['ICM', /\bICM\b/i], ['Brain', /\bBrain\b/i], ['MCP', /\bMCP\b/i], ['Aura', /\bAura\b/i], ['Larry', /\bLarry\b/i],
  ['the book', /\bthe book\b/i], ['Aronhime', /Aronhime/i], ['Lawrence', /Lawrence/i],
  ['Johns Hopkins', /Johns Hopkins/i], ['JHU', /\bJHU\b/],
  ['revolutionary', /\brevolutionary\b/i], ['game-changing', /\bgame-chang(ing|er)\b/i], ['supercharge', /\bsupercharg/i],
  ['unlimited potential', /\bunlimited potential\b/i], ['instant insight', /\binstant insight\b/i],
  ['AI workforce', /\bAI workforce\b/i], ['autonomous strategist', /\bautonomous strategist\b/i],
  ['unchecked superlative', /\b(ever published|most rigorous)\b/i],
  ['validated', /\bvalidated\b/i], ['confirmed', /\bconfirmed\b/i], ['proven', /\bproven\b/i],
];
function banned(text) {
  const found = [];
  if (text.includes(EM)) found.push('em-dash');
  if (text.includes(EN)) found.push('en-dash');
  if (/ -- /.test(text)) found.push('double-hyphen');
  for (const [name, rule] of WORD_RULES) if (rule.test(text)) found.push(name);
  return found;
}

function parseJobs(source) {
  const m = source.match(/export const JOBS: readonly Job\[\] = (\[[\s\S]*?\n\])\n/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch (_e) { return null; }
}

const taxonomy = JSON.parse(fs.readFileSync(TAXONOMY, 'utf8')).entries;
const jobsPath = path.join(HOOKS, 'jobs.ts');
const jobsSource = fs.existsSync(jobsPath) ? fs.readFileSync(jobsPath, 'utf8') : '';
const jobs = parseJobs(jobsSource);

// ---- T1 -----------------------------------------------------------------------------------
say('T1 taxonomy parity');
check(taxonomy.length === 13, 'T1 the taxonomy holds 13 jobs (' + taxonomy.length + ')');
check(jobs !== null && jobs.length === 13, 'T1 hooks/jobs.ts holds 13 jobs (' + (jobs ? jobs.length : 'none') + ')');
if (jobs) {
  const lowerFirst = (t) => t.charAt(0).toLowerCase() + t.slice(1);
  const same = taxonomy.every((entry, i) => {
    const row = jobs[i];
    return row && row.id === entry.id
      && row.want === lowerFirst(String(entry.one_line).trim().replace(/[.?!]$/, ''))
      && JSON.stringify(row.cues) === JSON.stringify(entry.cues);
  });
  check(same, 'T1 id, want and cues equal the taxonomy, in order');
  const explore = jobs.find((row) => row.id === 'explore');
  check(Boolean(explore) && explore.shown === false, 'T1 explore is flagged never shown');
  check(jobs.filter((row) => row.shown).length === 12, 'T1 the other 12 jobs are shown');
}

// ---- T2 -----------------------------------------------------------------------------------
say('T2 outcomes');
if (jobs) {
  const missing = jobs.filter((row) => typeof row.outcome !== 'string' || row.outcome.trim() === '').map((row) => row.id);
  check(missing.length === 0, 'T2 every job has an outcome clause' + (missing.length ? ' (missing: ' + missing.join(', ') + ')' : ''));
  const stops = jobs.filter((row) => /[.!?]/.test(row.outcome)).map((row) => row.id);
  check(stops.length === 0, 'T2 no outcome holds a stop mark' + (stops.length ? ' (' + stops.join(', ') + ')' : ''));
  const bad = jobs.filter((row) => banned(row.outcome).length > 0).map((row) => row.id + ': ' + banned(row.outcome).join(', '));
  check(bad.length === 0, 'T2 no outcome holds a banned word or dash' + (bad.length ? ' (' + bad.join('; ') + ')' : ''));
  const longest = Math.max(...jobs.map((row) => row.outcome.length));
  check(longest <= 80, 'T2 the longest outcome is 80 characters or fewer (' + longest + ')');
}

// ---- T3 -----------------------------------------------------------------------------------
say('T3 sentences');
if (jobs) {
  const hits = [];
  for (const row of jobs) {
    for (const stage of ['Design', '']) {
      for (const section of ['market-analysis', '']) {
        const where = stage ? 'in the ' + stage + ' stage' : 'working in this room';
        const sentence = 'When I am ' + where + (section ? ' and looking at ' + section : '') + ', I want to ' + row.want + ', so that ' + row.outcome + '.';
        const found = banned(sentence);
        if (found.length > 0) hits.push(row.id + ': ' + found.join(', '));
        if (!/^When I am .+, I want to .+, so that .+\.$/.test(sentence)) hits.push(row.id + ': form');
        if (sentence.indexOf('.') !== sentence.length - 1) hits.push(row.id + ': more than one sentence');
        if (/[?!]/.test(sentence)) hits.push(row.id + ': a question or exclamation mark inside the sentence');
      }
    }
  }
  check(hits.length === 0, 'T3 all sentences pass the copy scan and hold the form' + (hits.length ? ' (' + hits.slice(0, 4).join('; ') + ')' : ''));
}

// ---- N1 -----------------------------------------------------------------------------------
say('N1 generator and drift gate');
function runCheck(root) {
  return spawnSync(process.execPath, [path.join(root, 'ui', 'mos-face', 'scripts', 'face-jobs.cjs'), '--check'], { encoding: 'utf8' });
}
if (!fs.existsSync(SCRIPT)) {
  check(false, 'N1 ui/mos-face/scripts/face-jobs.cjs exists');
} else {
  const real = spawnSync(process.execPath, [SCRIPT, '--check'], { encoding: 'utf8' });
  if (real.status !== 0) say((real.stdout || '') + (real.stderr || ''));
  check(real.status === 0, 'N1 face-jobs.cjs --check exits 0 on the real files');

  // A scratch copy: only the three files the script reads, under the system temp folder.
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'face-jobs-'));
  const mk = () => {
    const root = fs.mkdtempSync(path.join(scratch, 'copy-'));
    fs.mkdirSync(path.join(root, 'ui', 'mos-face', 'scripts'), { recursive: true });
    fs.mkdirSync(path.join(root, 'ui', 'mos-face', 'hooks'), { recursive: true });
    fs.mkdirSync(path.join(root, 'lib', 'hmi'), { recursive: true });
    fs.copyFileSync(SCRIPT, path.join(root, 'ui', 'mos-face', 'scripts', 'face-jobs.cjs'));
    fs.copyFileSync(jobsPath, path.join(root, 'ui', 'mos-face', 'hooks', 'jobs.ts'));
    fs.copyFileSync(TAXONOMY, path.join(root, 'lib', 'hmi', 'jtbd-taxonomy.json'));
    return root;
  };
  const edit = (root, rel, fn) => {
    const file = path.join(root, rel);
    fs.writeFileSync(file, fn(fs.readFileSync(file, 'utf8')));
  };
  const TAX = path.join('lib', 'hmi', 'jtbd-taxonomy.json');
  const JOBSTS = path.join('ui', 'mos-face', 'hooks', 'jobs.ts');
  const out = (r) => (r.stdout || '') + (r.stderr || '');

  const clean = mk();
  check(runCheck(clean).status === 0, 'N1 the scratch copy passes before any mutation');

  const cases = [
    ['a taxonomy job with no outcome is named', (root) => edit(root, TAX, (t) => {
      const data = JSON.parse(t);
      data.entries.push({ id: 'brand-new-job', one_line: 'Do a new thing.', cues: ['new thing'] });
      return JSON.stringify(data, null, 2);
    }), /brand-new-job/],
    ['a changed one-line is drift', (root) => edit(root, TAX, (t) => t.replace('Find the lagging component', 'Locate the lagging component')), /find-bottleneck/],
    ['a changed cue is drift', (root) => edit(root, TAX, (t) => t.replace('"should we pursue"', '"ought we to pursue"')), /decide-pursue/],
    ['a blank outcome', (root) => edit(root, JOBSTS, (t) => t.replace('"I know which part to fix first"', '""')), /find-bottleneck/],
    ['a banned word in an outcome', (root) => edit(root, JOBSTS, (t) => t.replace('I know which part to fix first', 'I know which part of the Brain to fix first')), /Brain/],
    ['an em-dash in a want', (root) => edit(root, JOBSTS, (t) => t.replace('find the problem worth solving', 'find the problem worth solving ' + EM)), /find-problem|em-dash/],
    ['a missing job', (root) => edit(root, JOBSTS, (t) => {
      const table = parseJobs(t);
      table.splice(3, 1);
      return t.replace(/export const JOBS: readonly Job\[\] = \[[\s\S]*?\n\]\n/, 'export const JOBS: readonly Job[] = ' + JSON.stringify(table, null, 2) + '\n');
    }), /find-bottleneck/],
    ['a stale header', (root) => edit(root, JOBSTS, (t) => t.replace('// Generated file. Do not edit by hand.', '// Generated file.')), /stale|--write/],
  ];
  for (const [name, mutate, expected] of cases) {
    const root = mk();
    mutate(root);
    const r = runCheck(root);
    check(r.status === 1 && expected.test(out(r)), 'N1 --check exits 1 for ' + name + (r.status === 1 ? '' : ' (exit ' + r.status + ')'));
  }
  fs.rmSync(scratch, { recursive: true, force: true });
}

// ---- N2, N3 -------------------------------------------------------------------------------
say('N2 job sources are local');
function code(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((line) => line.replace(/^\s*\/\/.*$/, '').replace(/\s\/\/\s.*$/, '')).join('\n');
}
const jobPath = path.join(HOOKS, 'job.ts');
if (!fs.existsSync(jobPath)) {
  check(false, 'N2 hooks/job.ts exists');
} else {
  const FORBIDDEN = [
    ['a tool name', /mcp__|brain_ask|brain_|\$\.tool\b|tool\.call|\.tool\(/],
    ['fetch or http', /\bfetch\s*\(|\$\.http|http\.fetch|XMLHttpRequest|WebSocket/],
    ['a process call', /\$\.process|process\.run|child_process|spawn\(|exec\(/],
    ['an import of advice.ts', /from\s+['"]\.\/advice['"]/],
    ['a prompt box call', /\$\.prompt\./],
  ];
  for (const file of ['job.ts', 'jobs.ts']) {
    const text = code(fs.readFileSync(path.join(HOOKS, file), 'utf8'));
    for (const [name, rule] of FORBIDDEN) check(!rule.test(text), 'N2 hooks/' + file + ' holds no ' + name);
  }
  const jobCode = code(fs.readFileSync(jobPath, 'utf8'));
  check(!/\bgoal\b/i.test(jobCode), 'N2 hooks/job.ts never names the goal field of the state file');
  const imports = [...jobCode.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]).sort();
  check(JSON.stringify(imports) === JSON.stringify(['../types', './jobs']), 'N3 hooks/job.ts imports only ./jobs and ../types (' + imports.join(', ') + ')');
}

say('');
say('test-380-jobs: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);

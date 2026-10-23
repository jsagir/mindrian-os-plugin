// Generator and drift gate for ui/mos-face/hooks/jobs.ts (380-14, D-09, MOD380-08).
//
// Why: the Job line of the panel needs the plugin's own list of jobs (Canon Part 7, reuse before
// build). The list lives in lib/hmi/jtbd-taxonomy.json: 13 entries, each with an id, a one-line
// want and the cues the plugin's classifier matches in a person's words. This script copies those
// three fields into hooks/jobs.ts, so nothing is typed by hand, and it adds one plain outcome
// clause for each job (the "so that" part), because the plugin has no such text.
//
// Source of the table: lib/hmi/jtbd-taxonomy.json (entries[].id, one_line, cues).
//   want  = one_line with its first letter lowered and its final full stop removed.
//   cues  = the cues as they stand (the classifier lowercases them when it matches).
//   outcome = the reviewed map OUTCOMES below. Each clause finishes the sentence "so that ...".
//   shown = false for explore only: the plugin's steady state is not a job to show.
//
// Modes:
//   --write  Rewrite hooks/jobs.ts from the taxonomy and the map. Fails and names the problem when
//            an id has no outcome, an outcome names an id the taxonomy lacks, or a string holds a
//            banned word.
//   --check  Exit 1, writing nothing, on: an id of the taxonomy missing from the file; an id, want
//            or cue list that differs from the taxonomy; a missing, empty or different outcome; a
//            banned word or dash in any string; or a file that is not the one --write makes
//            (a stale header or body).
//
// CJS, Node built-ins only. No network. Hyphens only.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const MOD = path.resolve(__dirname, '..');
const REPO = path.resolve(MOD, '..', '..');
const TAXONOMY = path.join(REPO, 'lib', 'hmi', 'jtbd-taxonomy.json');
const TARGET = path.join(MOD, 'hooks', 'jobs.ts');

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
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
  ['revolutionary', /\brevolutionary\b/i],
  ['game-changing', /\bgame-chang(ing|er)\b/i],
  ['supercharge', /\bsupercharg/i],
  ['unlimited potential', /\bunlimited potential\b/i],
  ['instant insight', /\binstant insight\b/i],
  ['AI workforce', /\bAI workforce\b/i],
  ['autonomous strategist', /\bautonomous strategist\b/i],
  ['unchecked superlative', /\b(ever published|most rigorous)\b/i],
  // The Job line is a guess. Its text never claims a check (voice: do not describe generated content
  // as validated evidence).
  ['validated', /\bvalidated\b/i],
  ['confirmed', /\bconfirmed\b/i],
  ['proven', /\bproven\b/i],
];

// The words that a displayed string (a want or an outcome) must not hold. Cues are the plugin's
// own matching words and are not shown, so only the dash and the stack words apply to them.
function banned(text) {
  const found = [];
  if (text.includes(EM)) found.push('em-dash');
  if (text.includes(EN)) found.push('en-dash');
  if (/ -- /.test(text)) found.push('double-hyphen');
  for (const [name, rule] of WORD_RULES) if (rule.test(text)) found.push(name);
  return found;
}

// The reviewed outcome clauses. Each one finishes "so that ..." and says a result the person gets,
// in the teaching voice: plain, short, no stack word, no stop. Drawn from the completion shape and
// the next-move verbs of each job in the taxonomy. The navigator reads them in the SUMMARY of plan
// 380-14 and in the README table.
const OUTCOMES = {
  'decide-pursue': 'I can say go or no-go and write down my reason',
  'find-problem': 'I know the real problem in a sentence I can test',
  'understand-market': 'I can say how big the market is and who else is in it',
  'find-bottleneck': 'I know which part to fix first',
  'prepare-pitch': 'I walk in with the story ready and the hard questions covered',
  'validate-idea': 'I know what holds up, what does not and what I still need to find out',
  'compare-options': 'I can choose between the options and say why',
  'connect-domains': 'I see what this looks like in another field and what that could teach me',
  'surface-contradiction': 'I know which claims pull apart and which one I keep',
  'plan-execution': 'I know the next 90 days, with owners and dates',
  'file-meeting': 'I can see what the meeting changes in my data room',
  'audit-room': 'I know where my data room is thin or out of step',
  explore: 'I notice what is worth following',
};

const NEVER_SHOWN = ['explore'];

function lowerFirst(text) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function wantOf(oneLine) {
  return lowerFirst(String(oneLine).trim().replace(/\.$/, ''));
}

function readTaxonomy(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const list = Array.isArray(data.entries) ? data.entries : [];
  return list
    .filter((entry) => entry && typeof entry.id === 'string')
    .map((entry) => ({ id: entry.id, want: wantOf(entry.one_line), cues: Array.isArray(entry.cues) ? entry.cues.map(String) : [] }));
}

const HEADER = [
  '// Generated file. Do not edit by hand.',
  '// Regenerate with: node ui/mos-face/scripts/face-jobs.cjs --write',
  '// Source: lib/hmi/jtbd-taxonomy.json, the plugin\'s own list of jobs (id, one-line want, cues). The',
  '// outcome of each job is the reviewed map of scripts/face-jobs.cjs. The check mode fails on drift.',
  '// A job with shown false is never drawn on the panel (explore is the steady state, not a job).',
  '',
  'export type Job = {',
  '  id: string',
  '  want: string',
  '  cues: readonly string[]',
  '  outcome: string',
  '  shown: boolean',
  '}',
  '',
].join('\n');

function render(table) {
  return HEADER + 'export const JOBS: readonly Job[] = ' + JSON.stringify(table, null, 2) + '\n';
}

function build(taxonomy) {
  return taxonomy.map((job) => ({
    id: job.id,
    want: job.want,
    cues: job.cues,
    outcome: Object.prototype.hasOwnProperty.call(OUTCOMES, job.id) ? OUTCOMES[job.id] : '',
    shown: !NEVER_SHOWN.includes(job.id),
  }));
}

// Everything wrong with a table against the taxonomy, as plain lines.
function problemsOf(taxonomy, table) {
  const problems = [];
  const ids = new Set(taxonomy.map((job) => job.id));
  for (const job of taxonomy) {
    if (!Object.prototype.hasOwnProperty.call(OUTCOMES, job.id)) problems.push('no outcome for the job ' + job.id + ' (add a clause to OUTCOMES in scripts/face-jobs.cjs)');
  }
  for (const id of Object.keys(OUTCOMES)) {
    if (!ids.has(id)) problems.push('an outcome names the job ' + id + ', which the taxonomy no longer holds');
  }
  for (const [id, outcome] of Object.entries(OUTCOMES)) {
    if (String(outcome).trim() === '') problems.push('empty outcome for ' + id);
    if (/[.!?]/.test(outcome)) problems.push('the outcome of ' + id + ' holds a stop mark (it finishes a sentence)');
    const found = banned(outcome);
    if (found.length > 0) problems.push('the outcome of ' + id + ' holds ' + found.join(', '));
  }
  for (const job of taxonomy) {
    const found = banned(job.want);
    if (found.length > 0) problems.push('the want of ' + job.id + ' holds ' + found.join(', '));
  }
  if (table === null) return problems;

  const byId = new Map(table.map((row) => [row.id, row]));
  for (const job of taxonomy) {
    const row = byId.get(job.id);
    if (!row) {
      problems.push('jobs.ts is missing the job ' + job.id);
      continue;
    }
    if (row.want !== job.want) problems.push('the want of ' + job.id + ' drifted from the taxonomy');
    if (JSON.stringify(row.cues) !== JSON.stringify(job.cues)) problems.push('the cues of ' + job.id + ' drifted from the taxonomy');
    if (typeof row.outcome !== 'string' || row.outcome.trim() === '') problems.push('jobs.ts holds no outcome for ' + job.id);
    else if (row.outcome !== OUTCOMES[job.id]) problems.push('the outcome of ' + job.id + ' differs from the reviewed map');
    const found = banned(String(row.want) + ' ' + String(row.outcome));
    if (found.length > 0) problems.push('jobs.ts: ' + job.id + ' holds ' + found.join(', '));
  }
  for (const row of table) {
    if (!ids.has(row.id)) problems.push('jobs.ts holds the job ' + row.id + ', which the taxonomy does not');
  }
  if (table.length !== taxonomy.length) problems.push('jobs.ts holds ' + table.length + ' jobs; the taxonomy holds ' + taxonomy.length);

  return problems;
}

function parseTable(source) {
  const m = source.match(/export const JOBS: readonly Job\[\] = (\[[\s\S]*?\n\])\n/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch (_e) {
    return null;
  }
}

function main() {
  const mode = process.argv[2];
  if (mode !== '--check' && mode !== '--write') {
    process.stderr.write('usage: node ui/mos-face/scripts/face-jobs.cjs --check | --write\n');
    return 2;
  }
  const taxonomy = readTaxonomy(TAXONOMY);
  if (taxonomy.length === 0) {
    process.stderr.write('FAIL the taxonomy holds no jobs: ' + TAXONOMY + '\n');
    return 1;
  }
  const wanted = render(build(taxonomy));

  if (mode === '--write') {
    const problems = problemsOf(taxonomy, null);
    if (problems.length > 0) {
      for (const p of problems) process.stderr.write('FAIL ' + p + '\n');
      return 1;
    }
    fs.writeFileSync(TARGET, wanted);
    process.stdout.write('face-jobs: wrote ' + taxonomy.length + ' jobs to hooks/jobs.ts\n');
    return 0;
  }

  if (!fs.existsSync(TARGET)) {
    process.stderr.write('FAIL hooks/jobs.ts is missing (run --write)\n');
    return 1;
  }
  const source = fs.readFileSync(TARGET, 'utf8');
  const table = parseTable(source);
  const problems = problemsOf(taxonomy, table);
  if (table === null) problems.push('jobs.ts holds no readable JOBS table');
  if (problems.length === 0 && source !== wanted) problems.push('jobs.ts is not the file --write makes (a stale header or body)');
  for (const p of problems) process.stderr.write('FAIL ' + p + '\n');
  if (problems.length > 0) return 1;
  process.stdout.write('face-jobs: ' + taxonomy.length + ' jobs, 0 problems\n');
  return 0;
}

process.exit(main());
